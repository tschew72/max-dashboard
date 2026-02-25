import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const JOBS_FILE = '/root/.openclaw/cron/jobs.json'
const RUNS_DIR = '/root/.openclaw/cron/runs'
const SESSIONS_FILE = '/root/.openclaw/agents/main/sessions/sessions.json'

// Pricing: [inputRatePerMToken, outputRatePerMToken]
const PRICING: Record<string, [number, number]> = {
  'claude-sonnet': [3.0, 15.0],
  'claude-opus': [15.0, 75.0],
  'claude-haiku': [0.25, 1.25],
}

function calcCost(model: string | null, usage: { input_tokens?: number; output_tokens?: number } | null): number {
  if (!model || !usage) return 0
  const key = Object.keys(PRICING).find(k => model.toLowerCase().includes(k)) || 'claude-sonnet'
  const [inRate, outRate] = PRICING[key]
  return ((usage.input_tokens || 0) / 1e6) * inRate + ((usage.output_tokens || 0) / 1e6) * outRate
}

interface JobRecord {
  id: string
  name: string
  payload?: { timeoutSeconds?: number }
  state?: {
    consecutiveErrors?: number
    lastError?: string
    lastStatus?: string
    lastRunAtMs?: number
  }
}

interface JobStat {
  jobId: string
  name: string
  totalRuns: number
  okRuns: number
  errorRuns: number
  successRate: number
  avgDurationMs: number
  totalTokens: number
  totalCostUsd: number
  avgCostUsd: number
  lastRunAt: number | null
  lastStatus: string
  consecutiveErrors: number
  timedOutCount: number
}

interface FlakyJob {
  jobId: string
  name: string
  consecutiveErrors: number
  lastError: string
}

interface JobsData {
  jobs: JobRecord[]
}

function readJobsData(): JobsData {
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8')) as JobsData
  } catch { return { jobs: [] } }
}

function readJobNames(): Record<string, string> {
  const data = readJobsData()
  const map: Record<string, string> = {}
  for (const job of data.jobs) map[job.id] = job.name
  return map
}

function readJobTimeouts(): Record<string, number> {
  const data = readJobsData()
  const map: Record<string, number> = {}
  for (const job of data.jobs) {
    if (job.payload?.timeoutSeconds) map[job.id] = job.payload.timeoutSeconds
  }
  return map
}

function readRecentRuns(
  jobNames: Record<string, string>,
  jobTimeouts: Record<string, number>,
  limitHours: number
) {
  const cutoff = Date.now() - limitHours * 3600 * 1000
  const runs: Array<{
    jobId: string
    jobName: string
    status: string
    summary: string | null
    error: string | null
    runAtMs: number
    durationMs: number
    model: string | null
    usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null
    sessionId: string | null
    costUsd: number
    timedOut: boolean
    delivered: boolean | null
  }> = []

  try {
    const files = fs.readdirSync(RUNS_DIR).filter((f: string) => f.endsWith('.jsonl'))
    for (const file of files) {
      const jobId = file.replace('.jsonl', '')
      const filePath = path.join(RUNS_DIR, file)
      const timeoutSec = jobTimeouts[jobId] || null
      try {
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const run = JSON.parse(line)
            if (run.action !== 'finished') continue
            if ((run.runAtMs || run.ts) < cutoff) continue
            const durationMs: number = run.durationMs || 0
            const timedOut = timeoutSec != null ? durationMs >= (timeoutSec - 2) * 1000 : false
            const deliveredRaw = run.delivered
            const delivered: boolean | null = deliveredRaw === true ? true : deliveredRaw === false ? false : null
            const costUsd = calcCost(run.model || null, run.usage || null)
            runs.push({
              jobId,
              jobName: jobNames[jobId] || jobId.slice(0, 8),
              status: run.status,
              summary: run.summary || null,
              error: run.error || null,
              runAtMs: run.runAtMs || run.ts,
              durationMs,
              model: run.model || null,
              usage: run.usage || null,
              sessionId: run.sessionId || null,
              costUsd,
              timedOut,
              delivered,
            })
          } catch { /* skip bad lines */ }
        }
      } catch { /* skip unreadable files */ }
    }
  } catch { /* skip if dir missing */ }

  return runs.sort((a, b) => b.runAtMs - a.runAtMs)
}

function buildJobStats(
  runs: ReturnType<typeof readRecentRuns>,
  jobNames: Record<string, string>,
  jobsData: JobsData
): JobStat[] {
  const byJob: Record<string, ReturnType<typeof readRecentRuns>> = {}
  for (const run of runs) {
    if (!byJob[run.jobId]) byJob[run.jobId] = []
    byJob[run.jobId].push(run)
  }

  // Also include jobs that had no runs in window (from jobs.json state)
  const jobStateMap: Record<string, JobRecord> = {}
  for (const job of jobsData.jobs) jobStateMap[job.id] = job

  const stats: JobStat[] = []

  const allJobIds = new Set([...Object.keys(byJob), ...Object.keys(jobStateMap)])
  for (const jobId of allJobIds) {
    const jobRuns = byJob[jobId] || []
    const jobRecord = jobStateMap[jobId]
    const name = jobNames[jobId] || jobId.slice(0, 8)
    const totalRuns = jobRuns.length
    const okRuns = jobRuns.filter(r => r.status === 'ok').length
    const errorRuns = jobRuns.filter(r => r.status === 'error').length
    const successRate = totalRuns > 0 ? (okRuns / totalRuns) * 100 : 0
    const avgDurationMs = totalRuns > 0
      ? jobRuns.reduce((s, r) => s + r.durationMs, 0) / totalRuns
      : 0
    const totalTokens = jobRuns.reduce((s, r) => s + (r.usage?.total_tokens || 0), 0)
    const totalCostUsd = jobRuns.reduce((s, r) => s + r.costUsd, 0)
    const avgCostUsd = totalRuns > 0 ? totalCostUsd / totalRuns : 0
    const lastRunAt = jobRuns.length > 0 ? jobRuns[0].runAtMs : (jobRecord?.state?.lastRunAtMs || null)
    const lastStatus = jobRuns.length > 0 ? jobRuns[0].status : (jobRecord?.state?.lastStatus || '')
    const consecutiveErrors = jobRecord?.state?.consecutiveErrors || 0
    const timedOutCount = jobRuns.filter(r => r.timedOut).length

    stats.push({
      jobId,
      name,
      totalRuns,
      okRuns,
      errorRuns,
      successRate,
      avgDurationMs,
      totalTokens,
      totalCostUsd,
      avgCostUsd,
      lastRunAt,
      lastStatus,
      consecutiveErrors,
      timedOutCount,
    })
  }

  return stats.sort((a, b) => (b.lastRunAt || 0) - (a.lastRunAt || 0))
}

function buildTokenTrend(
  runs: ReturnType<typeof readRecentRuns>,
  hours: number
): number[] {
  const now = Date.now()
  const buckets = new Array<number>(hours).fill(0)
  for (const run of runs) {
    const age = now - run.runAtMs
    const bucket = Math.floor(age / (3600 * 1000))
    if (bucket >= 0 && bucket < hours) {
      buckets[hours - 1 - bucket] += run.usage?.total_tokens || 0
    }
  }
  return buckets
}

function buildFlakyJobs(jobsData: JobsData, jobNames: Record<string, string>): FlakyJob[] {
  const flaky: FlakyJob[] = []
  for (const job of jobsData.jobs) {
    const ce = job.state?.consecutiveErrors || 0
    if (ce > 0) {
      flaky.push({
        jobId: job.id,
        name: jobNames[job.id] || job.id.slice(0, 8),
        consecutiveErrors: ce,
        lastError: job.state?.lastError || '',
      })
    }
  }
  return flaky.sort((a, b) => b.consecutiveErrors - a.consecutiveErrors)
}

// Channel ID → friendly name map
const DISCORD_CHANNELS: Record<string, string> = {
  '1473965360364392480': '#general',
  '1473990130468524063': '#notifications',
  '1474182609851383909': '#news',
  '1474182841716703305': '#learning',
  '1474184061953245316': '#o365',
}

function deriveLabel(sessionId: string, existingLabel: string): string {
  if (existingLabel && existingLabel.trim()) return existingLabel

  // agent:main:main → "Main Session"
  if (sessionId === 'agent:main:main') return 'Main Session'

  // agent:main:discord:channel:<id> → "#channel-name"
  const discordMatch = sessionId.match(/discord:channel:(\d+)$/)
  if (discordMatch) {
    const chName = DISCORD_CHANNELS[discordMatch[1]]
    return chName ? `Discord ${chName}` : `Discord channel:${discordMatch[1]}`
  }

  // agent:main:subagent:<uuid> → "Sub-agent <short-id>"
  const subagentMatch = sessionId.match(/subagent:([a-f0-9-]{8})/)
  if (subagentMatch) return `Sub-agent ${subagentMatch[1]}`

  // agent:main:telegram:* → "Telegram"
  if (sessionId.includes(':telegram:')) return 'Telegram'

  // Fallback: last segment
  const parts = sessionId.split(':')
  return parts[parts.length - 1] || sessionId
}

function readSessions() {
  try {
    const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) as Record<string, unknown>
    const cutoff = Date.now() - 24 * 3600 * 1000
    return Object.entries(data)
      .filter(([, s]) => (s as { updatedAt: number }).updatedAt > cutoff)
      .map(([sessionKey, s]) => {
        const sess = s as {
          sessionId: string
          label?: string
          updatedAt: number
          model?: string | null
          totalTokens?: number
          contextTokens?: number | null
          inputTokens?: number
          outputTokens?: number
        }
        return {
          sessionId: sess.sessionId,   // UUID (for display)
          sessionKey,                   // Full key e.g. agent:main:discord:channel:... (for detail lookup)
          label: deriveLabel(sessionKey, sess.label || ''),
          updatedAt: sess.updatedAt,
          model: sess.model || null,
          totalTokens: sess.totalTokens || 0,
          contextTokens: sess.contextTokens || null,
          inputTokens: sess.inputTokens || 0,
          outputTokens: sess.outputTokens || 0,
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch { return [] }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const hours = parseInt(url.searchParams.get('hours') || '24')

  const jobsData = readJobsData()
  const jobNames = readJobNames()
  const jobTimeouts = readJobTimeouts()
  const runs = readRecentRuns(jobNames, jobTimeouts, hours)
  const sessions = readSessions()

  // Active = updated in last 5 min
  const activeCutoff = Date.now() - 5 * 60 * 1000
  const activeSessions = sessions.filter((s) => s.updatedAt > activeCutoff)

  // Stats
  const total = runs.length
  const ok = runs.filter(r => r.status === 'ok').length
  const errors = runs.filter(r => r.status === 'error').length
  const totalTokens = runs.reduce((sum, r) => sum + (r.usage?.total_tokens || 0), 0)
  const totalCostUsd = runs.reduce((sum, r) => sum + r.costUsd, 0)

  const jobStats = buildJobStats(runs, jobNames, jobsData)
  const tokenTrend = buildTokenTrend(runs, hours)
  const flakyJobs = buildFlakyJobs(jobsData, jobNames)

  return NextResponse.json({
    runs,
    sessions,
    activeSessions,
    stats: { total, ok, errors, totalTokens, totalCostUsd },
    jobStats,
    tokenTrend,
    flakyJobs,
  })
}
