import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'

const JOBS_PATH = '/root/.openclaw/cron/jobs.json'

function triggerAsync(id: string) {
  const child = spawn('openclaw', ['cron', 'run', id], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

export async function POST() {
  try {
    const raw = readFileSync(JOBS_PATH, 'utf8')
    const data = JSON.parse(raw)
    const jobs: Record<string, unknown>[] = data?.jobs ?? (Array.isArray(data) ? data : Object.values(data))

    const errored = jobs.filter((j: Record<string, unknown>) => {
      const state = j.state as Record<string, unknown> | undefined
      return Number(state?.consecutiveErrors ?? 0) > 0 || state?.lastStatus === 'error'
    })

    if (errored.length === 0) {
      return NextResponse.json({ ok: true, healed: 0, message: 'No errored jobs found' })
    }

    const results: { id: string; name: string; prevErrors: number }[] = []

    for (const job of errored) {
      const state = (job.state ?? {}) as Record<string, unknown>
      const prevErrors = Number(state.consecutiveErrors ?? 0)

      // Clear error state
      state.consecutiveErrors = 0
      state.lastStatus = 'ok'
      job.state = state

      results.push({ id: String(job.id), name: String(job.name ?? job.id), prevErrors })
    }

    // Write all cleared states at once
    writeFileSync(JOBS_PATH, JSON.stringify(data, null, 2))

    // Fire all re-runs in background — non-blocking
    for (const r of results) triggerAsync(r.id)

    return NextResponse.json({ ok: true, healed: results.length, results })
  } catch (error) {
    console.error('POST /api/jobs/heal-all error:', error)
    return NextResponse.json({ error: 'Heal-all failed', detail: String(error) }, { status: 500 })
  }
}
