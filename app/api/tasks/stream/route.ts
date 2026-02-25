import { readTaskEvent } from '@/lib/taskEvents'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()
  let lastTs = Date.now()

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* client disconnected */ }
      }

      // Initial ping
      send({ type: 'ping', ts: lastTs })

      const interval = setInterval(() => {
        try {
          const event = readTaskEvent()
          if (event && event.ts > lastTs) {
            lastTs = event.ts
            send(event)
          } else {
            send({ type: 'ping', ts: Date.now() })
          }
        } catch { /* continue */ }
      }, 3000)

      return () => clearInterval(interval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
