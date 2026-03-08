import { readTaskEvent } from '@/lib/taskEvents'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const JOB_EVENT_FILE = '/tmp/max-dashboard-job-events.json'
const AGENTS_DIR = '/root/.openclaw/agents'

function readJobEvent(): { type: string; ts: number } | null {
  try {
    if (!existsSync(JOB_EVENT_FILE)) return null
    return JSON.parse(readFileSync(JOB_EVENT_FILE, 'utf8'))
  } catch {
    return null
  }
}

function readAgentStatuses(): Record<string, number> {
  const statuses: Record<string, number> = {}
  try {
    const agents = ['main', 'ba', 'dev', 'ux', 'qa', 'devops', 'cfo', 'writer', 'ciso', 'ops', 'marketing', 'researcher', 'sales']
    for (const agentId of agents) {
      const sessFile = path.join(AGENTS_DIR, agentId, 'sessions', 'sessions.json')
      try {
        if (!existsSync(sessFile)) continue
        const data = JSON.parse(readFileSync(sessFile, 'utf8'))
        let latest = 0
        for (const sess of Object.values(data) as Array<{ updatedAt: number }>) {
          if (sess.updatedAt > latest) latest = sess.updatedAt
        }
        statuses[agentId] = latest
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return statuses
}

export async function GET() {
  const encoder = new TextEncoder()
  let lastTaskTs = Date.now()
  let lastJobTs = Date.now()
  let pingInterval: ReturnType<typeof setInterval> | null = null
  let panelInterval: ReturnType<typeof setInterval> | null = null
  let agentStatusInterval: ReturnType<typeof setInterval> | null = null
  let lastAgentStatuses: Record<string, number> = {}

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

      // Agent status polling every 15s
      agentStatusInterval = setInterval(() => {
        try {
          const currentStatuses = readAgentStatuses()
          for (const [agentId, ts] of Object.entries(currentStatuses)) {
            if (!lastAgentStatuses[agentId] || ts > lastAgentStatuses[agentId]) {
              const now = Date.now()
              const status = ts > now - 2 * 60 * 1000 ? 'running' : ts > now - 5 * 60 * 1000 ? 'done' : 'idle'
              send({ type: 'agent-status', data: { agentId, status, timestamp: new Date(ts).toISOString() } })
            }
          }
          lastAgentStatuses = currentStatuses
        } catch { /* continue */ }
      }, 15000)

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
      if (agentStatusInterval) clearInterval(agentStatusInterval)
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
