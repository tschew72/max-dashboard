import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000, encoding: 'utf8' })
  } catch {
    return ''
  }
}

function describeCron(schedule: string): string {
  const parts = schedule.trim().split(/\s+/)
  if (parts.length < 5) return schedule

  const [min, hour, dom, month, dow] = parts

  if (min === '*' && hour === '*') return 'Every minute'
  if (dom === '*' && month === '*' && dow === '*') {
    if (min === '0') return `Every day at ${hour}:00`
    return `Daily at ${hour}:${min.padStart(2, '0')}`
  }
  if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`
  if (hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  if (dow !== '*' && !dow.includes(',') && !dow.includes('-')) {
    const dayName = days[parseInt(dow)] || dow
    return `${dayName} at ${hour}:${min.padStart(2, '0')}`
  }

  return schedule
}

export async function GET() {
  const jobs: unknown[] = []

  // Read OpenClaw jobs
  try {
    const raw = readFileSync('/root/.openclaw/cron/jobs.json', 'utf8')
    const ocJobs = JSON.parse(raw)
    const list = Array.isArray(ocJobs) ? ocJobs : Object.entries(ocJobs).map(([id, v]) => ({ id, ...(v as object) }))

    for (const job of list) {
      const j = job as Record<string, unknown>
      jobs.push({
        id: j.id || j.name || String(Math.random()),
        name: j.name || j.id || 'Unnamed Job',
        schedule: j.schedule || j.cron || '',
        scheduleDesc: describeCron(String(j.schedule || j.cron || '')),
        lastRun: j.lastRun || j.last_run || null,
        nextRun: j.nextRun || j.next_run || null,
        errorCount: j.errorCount || j.error_count || 0,
        enabled: j.enabled !== false,
        source: 'openclaw' as const,
        status: !j.enabled ? 'disabled' : ((j.errorCount as number) || 0) > 0 ? 'error' : 'ok',
      })
    }
  } catch {
    // No jobs file
  }

  // Read system cron
  try {
    const crontab = safeExec('crontab -l')
    const lines = crontab.split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 6) continue
      const schedule = parts.slice(0, 5).join(' ')
      const command = parts.slice(5).join(' ')
      jobs.push({
        id: `cron-${schedule}-${command}`.replace(/[^a-z0-9]/gi, '-').slice(0, 40),
        name: command.length > 50 ? command.slice(0, 50) + '…' : command,
        schedule,
        scheduleDesc: describeCron(schedule),
        lastRun: null,
        nextRun: null,
        errorCount: 0,
        enabled: true,
        source: 'cron' as const,
        status: 'ok',
      })
    }
  } catch {
    // No crontab
  }

  return NextResponse.json(jobs)
}
