import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const AGENTS_DIR = '/root/.openclaw/agents'

function findLatestSession(agentId: string): string | null {
  const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
  try {
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'))
    if (!files.length) return null
    let latest = ''
    let latestMtime = 0
    for (const f of files) {
      const stat = fs.statSync(path.join(sessionsDir, f))
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs
        latest = f
      }
    }
    return path.join(sessionsDir, latest)
  } catch {
    return null
  }
}

function getLastNLines(filePath: string, n: number): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    return lines.slice(-n)
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const agentId = url.searchParams.get('agent') || 'main'
  const linesParam = parseInt(url.searchParams.get('lines') || '50')

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function send(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* disconnected */ }
      }

      let currentFile = findLatestSession(agentId)
      let fileSize = 0

      // Send initial lines
      if (currentFile) {
        try {
          fileSize = fs.statSync(currentFile).size
        } catch { fileSize = 0 }
        const lines = getLastNLines(currentFile, linesParam)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)
            send({ type: 'thought', data: parsed })
          } catch { /* skip */ }
        }
      }

      send({ type: 'connected', agent: agentId, file: currentFile })

      // Watch for changes
      const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
      let watcher: fs.FSWatcher | null = null
      let pollTimer: ReturnType<typeof setInterval> | null = null

      function readNewLines() {
        if (!currentFile) return
        try {
          const stat = fs.statSync(currentFile)
          if (stat.size <= fileSize) {
            // Check if a new session file appeared
            const newFile = findLatestSession(agentId)
            if (newFile && newFile !== currentFile) {
              currentFile = newFile
              fileSize = 0
              send({ type: 'session_change', file: currentFile })
            }
            return
          }

          // Read new bytes
          const fd = fs.openSync(currentFile, 'r')
          const buf = Buffer.alloc(stat.size - fileSize)
          fs.readSync(fd, buf, 0, buf.length, fileSize)
          fs.closeSync(fd)
          fileSize = stat.size

          const newLines = buf.toString('utf-8').split('\n').filter(l => l.trim())
          for (const line of newLines) {
            try {
              const parsed = JSON.parse(line)
              send({ type: 'thought', data: parsed })
            } catch { /* skip */ }
          }
        } catch { /* ignore */ }
      }

      // Use fs.watch + polling as backup
      try {
        if (fs.existsSync(sessionsDir)) {
          watcher = fs.watch(sessionsDir, { persistent: false }, () => {
            readNewLines()
          })
        }
      } catch { /* ignore */ }

      // Poll every 500ms as backup
      pollTimer = setInterval(readNewLines, 500)

      // Keepalive every 15s
      const keepalive = setInterval(() => {
        send({ type: 'ping', ts: Date.now() })
      }, 15000)

      // Cleanup
      return () => {
        if (watcher) try { watcher.close() } catch {}
        if (pollTimer) clearInterval(pollTimer)
        clearInterval(keepalive)
      }
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
