import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { buildFlowState, AGENTS_DIR, getAgentIds } from '@/lib/flow/parse-sessions'

export const dynamic = 'force-dynamic'

const DEBOUNCE_MS = 500

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const watchers: fs.FSWatcher[] = []
      let debounceTimer: ReturnType<typeof setTimeout> | null = null

      function send(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* client disconnected */ }
      }

      function pushState() {
        try {
          const state = buildFlowState()
          send({ type: 'state', data: state, ts: Date.now() })
        } catch (e) {
          console.error('Flow SSE rebuild error:', e)
        }
      }

      function debouncedRebuild() {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(pushState, DEBOUNCE_MS)
      }

      // Send initial state
      pushState()

      // Watch each agent's sessions directory
      const agentIds = getAgentIds()
      for (const agentId of agentIds) {
        const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
        if (!fs.existsSync(sessionsDir)) continue
        try {
          const watcher = fs.watch(sessionsDir, { persistent: false }, (_event, filename) => {
            if (filename === 'sessions.json' || filename?.endsWith('.jsonl')) {
              debouncedRebuild()
            }
          })
          watchers.push(watcher)
        } catch { /* not watchable */ }
      }

      // Watch AGENTS_DIR for new agent directories
      try {
        const parentWatcher = fs.watch(AGENTS_DIR, { persistent: false }, () => {
          debouncedRebuild()
        })
        watchers.push(parentWatcher)
      } catch { /* ignore */ }

      // Heartbeat every 20s
      const heartbeat = setInterval(() => {
        send({ type: 'ping', ts: Date.now() })
      }, 20_000)

      // Fallback full rebuild every 30s
      const fallback = setInterval(pushState, 30_000)

      // Cleanup
      const cleanup = () => {
        clearInterval(heartbeat)
        clearInterval(fallback)
        if (debounceTimer) clearTimeout(debounceTimer)
        watchers.forEach(w => { try { w.close() } catch { /* ignore */ } })
      }

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
