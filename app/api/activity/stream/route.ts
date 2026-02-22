import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'

function classifyLine(line: string): { type: 'error' | 'cron' | 'learning' | 'info'; description: string } {
  const lower = line.toLowerCase()
  if (lower.includes('error') || lower.includes('err:') || lower.includes('failed') || lower.includes('exception')) {
    return { type: 'error', description: line.trim() }
  }
  if (lower.includes('cron') || lower.includes('job') || lower.includes('scheduled') || lower.includes('trigger')) {
    return { type: 'cron', description: line.trim() }
  }
  if (lower.includes('learning') || lower.includes('memory') || lower.includes('cycle') || lower.includes('training')) {
    return { type: 'learning', description: line.trim() }
  }
  return { type: 'info', description: line.trim() }
}

let lastLineCount = 0

function getNewLines(): string[] {
  try {
    const files = execSync('ls -t /tmp/openclaw-0/*.log 2>/dev/null', { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean)
    if (files.length === 0) return []

    const content = readFileSync(files[0], 'utf8')
    const lines = content.split('\n').filter(l => l.trim().length > 0)

    if (lines.length <= lastLineCount) return []
    const newLines = lines.slice(lastLineCount)
    lastLineCount = lines.length
    return newLines
  } catch {
    return []
  }
}

export async function GET() {
  const encoder = new TextEncoder()
  lastLineCount = 0

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      // Send initial ping
      send(JSON.stringify([]))

      // Poll every 5 seconds
      const interval = setInterval(() => {
        try {
          const newLines = getNewLines()
          if (newLines.length > 0) {
            const events = newLines.map(line => {
              const { type, description } = classifyLine(line)
              return {
                id: randomUUID(),
                type,
                description,
                timestamp: new Date().toISOString(),
                raw: line,
              }
            })
            send(JSON.stringify(events))
          } else {
            // Heartbeat
            send(JSON.stringify([]))
          }
        } catch {
          // Continue on error
        }
      }, 5000)

      // Clean up when client disconnects
      return () => clearInterval(interval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
