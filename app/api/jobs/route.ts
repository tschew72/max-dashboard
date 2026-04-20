import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'

function safeExecFile(file: string, args: string[]): string {
  try { return execFileSync(file, args, { timeout: 5000, encoding: 'utf8' }).toString() } catch { return '' }
}

// ─── Cron expression → human readable ────────────────────────────────────────
function describeCron(expr: string, tz = 'UTC'): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5) return expr
  const [min, hour, dom, month, dow] = parts

  const tzLabel = tz === 'Asia/Singapore' ? 'SGT' : tz === 'UTC' ? 'UTC' : tz

  const fmtTime = (h: string, m: string) => {
    const hNum = parseInt(h)
    const mNum = parseInt(m)
    const ampm = hNum >= 12 ? 'PM' : 'AM'
    const h12 = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum
    return `${h12}:${mNum.toString().padStart(2, '0')} ${ampm} ${tzLabel}`
  }

  const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Every N minutes
  if (min.startsWith('*/') && hour === '*') return `Every ${min.slice(2)} min`
  // Every N hours
  if (hour.startsWith('*/') && min === '0') return `Every ${hour.slice(2)}h`
  if (hour.startsWith('*/')) return `Every ${hour.slice(2)}h at :${min.padStart(2, '0')}`

  // Multiple hours same day pattern (e.g. 9,12,15,18,21 → 5 times daily)
  if (hour.includes(',') && dom === '*' && month === '*') {
    const hours = hour.split(',').map(h => fmtTime(h, min))
    if (hours.length <= 3) return `Daily at ${hours.join(', ')}`
    return `${hours.length}x daily (${fmtTime(hour.split(',')[0], min)} – ${fmtTime(hour.split(',').at(-1)!, min)})`
  }

  // Hour range (e.g. 8-18 → business hours)
  if (hour.includes('-') && dom === '*' && month === '*') {
    const [h1, h2] = hour.split('-')
    const dayDesc = dow === '1-5' ? 'Weekdays' : 'Daily'
    return `${dayDesc} ${fmtTime(h1, min)} – ${fmtTime(h2, min)}`
  }

  // Daily
  if (dom === '*' && month === '*' && dow === '*') {
    return `Daily at ${fmtTime(hour, min)}`
  }

  // Weekdays
  if (dow === '1-5' && dom === '*' && month === '*') {
    return `Weekdays at ${fmtTime(hour, min)}`
  }

  // Specific day(s) of week
  if (dow !== '*' && dom === '*' && month === '*') {
    const dayNums = dow.split(',').map(d => {
      // Handle named days like MON, TUE
      const named: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
      return named[d.toUpperCase()] ?? parseInt(d)
    })
    const dayNames = dayNums.map(n => DOW_NAMES[n] ?? '?').join('/')
    return `${dayNames} at ${fmtTime(hour, min)}`
  }

  // Monthly (specific day)
  if (dom !== '*' && month === '*' && dow === '*') {
    const days = dom.split(',').join(', ')
    return `Monthly (${days}th) at ${fmtTime(hour, min)}`
  }

  // Quarterly (specific months)
  if (month !== '*' && dom !== '*') {
    const months = month.split(',').map(m => MONTH_NAMES[parseInt(m)] ?? m).join('/')
    return `Quarterly (${months} ${dom}) at ${fmtTime(hour, min)}`
  }

  return expr
}

// ─── Next run from cron expr ──────────────────────────────────────────────────
// Valid cron chars: digits, *, /, -, commas, and spaces only
const CRON_VALID = /^[\d\*\/\-, ]+$/

function isValidCron(expr: string): boolean {
  return CRON_VALID.test(expr) && expr.trim().split(/\s+/).length >= 5
}

function computeNextRun(expr: string, tz: string): string | null {
  // Reject invalid cron expressions to prevent shell injection
  if (!isValidCron(expr)) return null
  try {
    // Escape single quotes in expr for Python string safety
    const safeExpr = expr.replace(/'/g, "'\\''")
    const safeTz = tz.replace(/'/g, "'\\''")
    const pythonScript = `from croniter import croniter
from datetime import datetime
import pytz
try:
    zone = pytz.timezone('${safeTz}')
    now = datetime.now(zone)
    cron = croniter('${safeExpr}', now)
    nxt = cron.get_next(datetime)
    print(nxt.isoformat())
except Exception as e:
    print('')
`
    const result = safeExecFile('python3', ['-c', pythonScript]).trim()
    return result || null
  } catch { return null }
}

// ─── Duration formatting ──────────────────────────────────────────────────────
function fmtDuration(ms: number | undefined): string | null {
  if (!ms) return null
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// ─── Extract short description from payload message ───────────────────────────
function extractDesc(message: string | undefined): string {
  if (!message) return ''
  // Remove markdown headers, bullets, leading whitespace
  const clean = message
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/#{1,4}\s+/g, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\n{2,}/g, ' • ')
    .replace(/\n/g, ' ')
    .trim()
  return clean.length > 180 ? clean.slice(0, 180) + '…' : clean
}

// ─── Friendly cron job names ──────────────────────────────────────────────────
function friendlyCronName(command: string): { name: string; desc: string } {
  const cmd = command.toLowerCase()
  if (cmd.includes('teams_mention_monitor')) return { name: 'Teams Mention Monitor', desc: 'Checks for new @mentions in Microsoft Teams and logs them' }
  if (cmd.includes('tracker_reminder')) return { name: 'Teams Tracker Reminder', desc: 'Sends Discord reminders for unactioned Teams mentions with buttons' }
  if (cmd.includes('daily_briefing')) return { name: 'Daily Briefing', desc: 'Sends a daily morning briefing with key highlights' }
  if (cmd.includes('metadata-healer')) return { name: 'Metadata Auto-Healer', desc: 'Auto-adds YAML frontmatter headers to /02-KNOWLEDGE files' }
  if (cmd.includes('openclaw-healthcheck')) return { name: 'OpenClaw Health Check', desc: 'Monitors OpenClaw gateway health every 5 minutes' }
  if (cmd.includes('reaction_monitor')) return { name: 'Discord Reaction Monitor', desc: 'Monitors button reactions on Discord tracker messages' }
  if (cmd.includes('due-date-reminder')) return { name: 'Task Due Date Reminder', desc: 'Sends Discord alerts for tasks due in the next 48h and overdue tasks' }
  if (cmd.includes('overdue-escalation')) return { name: 'Task Overdue Escalation', desc: 'Escalates tasks overdue by 3+ days to URGENT priority' }
  // Fallback: extract script name
  const scriptMatch = command.match(/\/([^/]+\.py|[^/]+\.sh)\b/)
  return { name: scriptMatch ? scriptMatch[1].replace(/[-_]/g, ' ').replace(/\.(py|sh)$/, '') : command.slice(0, 50), desc: command }
}

// ─── Category tagging ─────────────────────────────────────────────────────────
function categoryFromName(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('learning') || n.includes('intelligence') || n.includes('pattern') || n.includes('knowl') || n.includes('iso') || n.includes('taxonomy')) return 'Knowledge'
  if (n.includes('git') || n.includes('deploy') || n.includes('infra') || n.includes('disk') || n.includes('health') || n.includes('update') || n.includes('audit') || n.includes('backup')) return 'Infrastructure'
  if (n.includes('teams') || n.includes('o365') || n.includes('email') || n.includes('readwise') || n.includes('news') || n.includes('mail')) return 'Integrations'
  if (n.includes('sales') || n.includes('consult') || n.includes('revenue') || n.includes('commit') || n.includes('reminder') || n.includes('drift')) return 'Business'
  if (n.includes('security') || n.includes('cve') || n.includes('threat') || n.includes('vulnerability')) return 'Security'
  if (n.includes('phase') || n.includes('archive') || n.includes('metadata') || n.includes('memory') || n.includes('workspace')) return 'Workspace'
  return 'General'
}

export async function GET() {
  const jobs: unknown[] = []

  // ── OpenClaw jobs ────────────────────────────────────────────────────────
  try {
    const raw = readFileSync('/root/.openclaw/cron/jobs.json', 'utf8')
    const parsed = JSON.parse(raw)
    const list: Record<string, unknown>[] = parsed?.jobs ?? (Array.isArray(parsed) ? parsed : Object.values(parsed))

    for (const j of list) {
      const state = (j.state || {}) as Record<string, unknown>
      const sched = (j.schedule || {}) as Record<string, unknown>
      const payload = (j.payload || {}) as Record<string, unknown>
      const expr = String(sched.expr || j.cron || '')
      const tz = String(sched.tz || 'UTC')

      const lastRunMs = Number(state.lastRunAtMs) || 0
      const nextRunMs = Number(state.nextRunAtMs) || 0
      const errCount = Number(state.consecutiveErrors) || 0
      const enabled = j.enabled !== false
      const lastStatus = String(state.lastStatus || '?')

      jobs.push({
        id: j.id || j.name,
        name: j.name,
        description: extractDesc(String(payload.message || '')),
        rawMessage: String(payload.message || ''),
        schedule: expr,
        scheduleDesc: describeCron(expr, tz),
        timezone: tz,
        lastRun: lastRunMs ? new Date(lastRunMs).toISOString() : null,
        nextRun: nextRunMs ? new Date(nextRunMs).toISOString() : null,
        lastDuration: fmtDuration(Number(state.lastDurationMs) || 0),
        lastDurationMs: Number(state.lastDurationMs) || 0,
        errorCount: errCount,
        lastStatus,
        lastError: String(state.lastError || ''),
        enabled,
        source: 'openclaw',
        category: categoryFromName(String(j.name || '')),
        status: !enabled ? 'disabled' : errCount > 0 ? 'error' : lastStatus === 'error' ? 'error' : 'ok',
        agentId: j.agentId,
        sessionTarget: j.sessionTarget,
        delivery: j.delivery,
      })
    }
  } catch (e) {
    console.error('jobs read error', e)
  }

  // ── System cron ──────────────────────────────────────────────────────────
  try {
    const crontab = safeExecFile('crontab', ['-l'])
    const lines = crontab.split('\n').filter(l => l.trim() && !l.startsWith('#'))
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 6) continue
      const expr = parts.slice(0, 5).join(' ')
      const command = parts.slice(5).join(' ')
      const { name, desc } = friendlyCronName(command)
      const id = `cron-${Buffer.from(line).toString('base64').slice(0, 20)}`
      jobs.push({
        id,
        name,
        description: desc,
        schedule: expr,
        scheduleDesc: describeCron(expr, 'UTC'),
        timezone: 'UTC',
        lastRun: null,
        nextRun: null,
        lastDuration: null,
        errorCount: 0,
        lastStatus: 'ok',
        enabled: true,
        source: 'cron',
        category: categoryFromName(name),
        status: 'ok',
        rawCommand: command,
      })
    }
  } catch { /* no crontab */ }

  return NextResponse.json(jobs)
}
