import { readTaskEvent } from '@/lib/taskEvents'
import { readFileSync, existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const JOB_EVENT_FILE = '/tmp/max-dashboard-job-events.json'

function readJobEvent(): { type: string; ts: number } | null {
  try {
    if (!existsSync(JOB_EVENT_FILE)) return null
    return JSON.parse(readFileSync(JOB_EVENT_FILE, 'utf8'))
  } catch {
    return null
  }
}

export async function GET() {
  const encoder = new TextEncoder()
  let lastTaskTs = Date.now()
  let lastJobTs = Date.now()
  let pingInterval: ReturnType<typeof setInterval> | null = null
  let panelInterval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* client disconnected */ }
      }

      send({ type: 'ping', ts: Date.now() })

      pingInterval = setInterval(() => {
        try {
          const taskEvent = readTaskEvent()
          if (taskEvent && taskEvent.ts > lastTaskTs) {
            lastTaskTs = taskEvent.ts
            send({ type: 'tasks', data: { taskType: taskEvent.type, taskId: taskEvent.taskId, ts: taskEvent.ts } })
            send({ type: 'health', data: { ts: taskEvent.ts } })
            return
          }

          const jobEvent = readJobEvent()
          if (jobEvent && jobEvent.ts > lastJobTs) {
            lastJobTs = jobEvent.ts
            send({ type: 'agents', data: { ts: jobEvent.ts } })
            send({ type: 'security', data: { ts: jobEvent.ts } })
            return
          }

          send({ type: 'ping', ts: Date.now() })
        } catch { /* continue */ }
      }, 3000)

      // Periodic typed pushes every 30s for data panels
      panelInterval = setInterval(() => {
        const ts = Date.now()
        send({ type: 'infra', data: { ts } })
        send({ type: 'promptdome', data: { ts } })
        send({ type: 'gmail', data: { ts } })
        send({ type: 'security', data: { ts } })
        send({ type: 'agents', data: { ts } })
      }, 30000)
    },
    cancel() {
      if (pingInterval) clearInterval(pingInterval)
      if (panelInterval) clearInterval(panelInterval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
