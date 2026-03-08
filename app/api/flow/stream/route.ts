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

      // Send initial snapshot — all configured agents (including those without dirs yet)
      const ALL_AGENTS = ['main','ba','dev','qa','ux','devops','cfo','ciso','writer','ops','marketing','researcher','sales','webdev']
      try {
        const initialStatuses: Record<string, string> = {}
        for (const agentId of ALL_AGENTS) initialStatuses[agentId] = getStatus(agentId)
        send({ type: 'connected', ts: Date.now(), statuses: initialStatuses })
      } catch {
        send({ type: 'connected', ts: Date.now() })
      }

      // Track which agent dirs we're already watching
      const watchedAgents = new Set<string>()

      function watchAgent(agentId: string) {
        if (watchedAgents.has(agentId)) return
        const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
        if (!fs.existsSync(sessionsDir)) return
        try {
          const watcher = fs.watch(sessionsDir, { persistent: false }, (_event, filename) => {
            if (!filename?.endsWith('.jsonl')) return
            const existing = debounceMap.get(agentId)
            if (existing) clearTimeout(existing)
            debounceMap.set(agentId, setTimeout(() => {
              const status = getStatus(agentId)
              send({ type: 'agent-status', agentId, status, ts: Date.now() })
              debounceMap.delete(agentId)
            }, DEBOUNCE_MS))
          })
          watchers.push(watcher)
          watchedAgents.add(agentId)
        } catch { /* not watchable */ }
      }

      // Watch known agent dirs on startup
      try {
        for (const agentId of fs.readdirSync(AGENTS_DIR)) watchAgent(agentId)
      } catch { /* ignore */ }

      // Also watch the AGENTS_DIR itself for new agent directories being created
      try {
        const parentWatcher = fs.watch(AGENTS_DIR, { persistent: false }, (_event, name) => {
          if (!name) return
          // New agent dir appeared — set up watcher for it
          setTimeout(() => watchAgent(name), 1000) // small delay for dir to be ready
        })
        watchers.push(parentWatcher)
      } catch { /* ignore */ }

      // Periodic rescan every 8s for any new agent dirs (belt + suspenders)
      const rescanInterval = setInterval(() => {
        try {
          for (const agentId of fs.readdirSync(AGENTS_DIR)) {
            if (!watchedAgents.has(agentId)) {
              watchAgent(agentId)
              // Send immediate status for newly discovered agent
              const status = getStatus(agentId)
              if (status !== 'idle') send({ type: 'agent-status', agentId, status, ts: Date.now() })
            }
          }
        } catch { /* ignore */ }
      }, 8_000)

      // Heartbeat every 20s to keep connection alive
      const heartbeat = setInterval(() => {
        send({ type: 'ping', ts: Date.now() })
      }, 20_000)

      // Cleanup on cancel
      const cleanup = () => {
        clearInterval(heartbeat)
        clearInterval(rescanInterval)
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
