import { writeFileSync, readFileSync, existsSync } from 'fs'

const EVENT_FILE = '/tmp/max-dashboard-task-events.json'

export function emitTaskEvent(type: 'created' | 'updated' | 'deleted', taskId: string) {
  try {
    const event = { type, taskId, ts: Date.now() }
    writeFileSync(EVENT_FILE, JSON.stringify(event))
  } catch {
    // non-fatal
  }
}

export function readTaskEvent(): { type: string; taskId: string; ts: number } | null {
  try {
    if (!existsSync(EVENT_FILE)) return null
    return JSON.parse(readFileSync(EVENT_FILE, 'utf8'))
  } catch {
    return null
  }
}
