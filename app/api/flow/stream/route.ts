import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const AGENTS_DIR = '/root/.openclaw/agents'
const DEBOUNCE_MS = 500

export const dynamic = 'force-dynamic'

// Compute current status for one agent from file mtimes
function getStatus(agentId: string): 'idle' | 'running' | 'done' | 'error' {
  const dir = path.join(AGENTS_DIR, agentId, 'sessions')
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))
    if (!files.length) return 'idle'
    const latest = Math.max(...files.map(f => fs.statSync(path.join(dir, f)).mtimeMs))
    const age = Date.now() - latest
    if (age < 90_000) return 'running'
    if (age < 120_000) return 'done'  // "done" shows for max 2 min (was 5min — too long, looked like running)
    return 'idle'
  } catch { return 'idle' }
}

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const watchers: fs.FSWatcher[] = []
      const debounceMap = new Map<string, ReturnType<typeof setTimeout>>()

      function send(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* client disconnected */ }
      }

      // Send initial snapshot of all agent statuses
      try {
        const agentDirs = fs.readdirSync(AGENTS_DIR)
        const initialStatuses: Record<string, string> = {}
        for (const agentId of agentDirs) {
          initialStatuses[agentId] = getStatus(agentId)
        }
        send({ type: 'connected', ts: Date.now(), statuses: initialStatuses })
      } catch {
        send({ type: 'connected', ts: Date.now() })
      }

      // Watch each agent's sessions directory
      try {
        const agentDirs = fs.readdirSync(AGENTS_DIR)
        for (const agentId of agentDirs) {
          const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
          if (!fs.existsSync(sessionsDir)) continue

          try {
            const watcher = fs.watch(sessionsDir, { persistent: false }, (_event, filename) => {
              if (!filename?.endsWith('.jsonl')) return

              // Debounce — file writes fire multiple events
              const existing = debounceMap.get(agentId)
              if (existing) clearTimeout(existing)
              debounceMap.set(agentId, setTimeout(() => {
                const status = getStatus(agentId)
                send({ type: 'agent-status', agentId, status, ts: Date.now() })
                debounceMap.delete(agentId)
              }, DEBOUNCE_MS))
            })
            watchers.push(watcher)
          } catch { /* agent dir not watchable */ }
        }
      } catch { /* agents dir not readable */ }

      // Heartbeat every 20s to keep connection alive
      const heartbeat = setInterval(() => {
        send({ type: 'ping', ts: Date.now() })
      }, 20_000)

      // Cleanup on cancel
      const cleanup = () => {
        clearInterval(heartbeat)
        watchers.forEach(w => { try { w.close() } catch { /* ignore */ } })
        debounceMap.forEach(t => clearTimeout(t))
      }

      // ReadableStream cancel handler
      return cleanup
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
