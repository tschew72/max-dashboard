import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'

const JOBS_PATH = '/root/.openclaw/cron/jobs.json'

/** Fire openclaw cron run in the background — does NOT block the response */
function triggerAsync(id: string) {
  const child = spawn('openclaw', ['cron', 'run', id], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const raw = readFileSync(JOBS_PATH, 'utf8')
    const data = JSON.parse(raw)
    const jobs: Record<string, unknown>[] = data?.jobs ?? (Array.isArray(data) ? data : Object.values(data))

    const job = jobs.find((j: Record<string, unknown>) => j.id === id)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const jobName = String(job.name ?? id)
    const prevErrors = Number((job.state as Record<string, unknown>)?.consecutiveErrors ?? 0)

    // Clear error state
    if (!job.state) job.state = {}
    const state = job.state as Record<string, unknown>
    state.consecutiveErrors = 0
    state.lastStatus = 'ok'

    writeFileSync(JOBS_PATH, JSON.stringify(data, null, 2))

    // Fire run in background — don't wait
    triggerAsync(id)

    return NextResponse.json({ ok: true, jobId: id, jobName, prevErrors, errorsCleared: true, triggered: true })
  } catch (error) {
    console.error(`POST /api/jobs/${id}/heal error:`, error)
    return NextResponse.json({ error: 'Heal failed', detail: String(error) }, { status: 500 })
  }
}
