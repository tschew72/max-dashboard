import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'

const RUNS_DIR = '/root/.openclaw/cron/runs'
const JOBS_JSON = '/root/.openclaw/cron/jobs.json'

// Sonnet pricing: $3/1M input + $15/1M output (approximate total at $3/1M for tokens)
const COST_PER_TOKEN = 3 / 1_000_000

function parseDays(range: string): number {
  return parseInt(range.replace('d', ''), 10) || 30
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range') ?? '30d'
  const days = parseDays(range)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // ── Task stats ────────────────────────────────────────────────────────────
  const allTasks = await prisma.task.findMany({
    where: { deletedAt: null },
    select: { id: true, status: true, createdAt: true, dueDate: true, label: true, completedAt: true },
  })

  const recentTasks = allTasks.filter(t => t.createdAt >= since)

  const tasksByStatus: Record<string, number> = {}
  for (const t of allTasks) {
    tasksByStatus[t.status] = (tasksByStatus[t.status] ?? 0) + 1
  }

  const overdue = allTasks.filter(t =>
    t.dueDate && t.dueDate < new Date() && t.status !== 'DONE'
  ).length

  // Tasks by label
  const tasksByLabel: Record<string, number> = {}
  for (const t of allTasks) {
    const label = (t as { label?: string }).label || 'UNLABELED'
    tasksByLabel[label] = (tasksByLabel[label] ?? 0) + 1
  }

  // Completion velocity: done tasks in period / days
  const doneTasks = allTasks.filter(t => t.status === 'DONE' && t.createdAt >= since)
  const completionVelocity = days > 0 ? doneTasks.length / days : 0

  // Tasks created per day (last N days)
  const tasksByDay: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    tasksByDay[key] = 0
  }
  for (const t of recentTasks) {
    const key = t.createdAt.toISOString().slice(0, 10)
    if (key in tasksByDay) tasksByDay[key]++
  }

  // ── Cron run stats ────────────────────────────────────────────────────────
  interface RunRecord {
    ts: number
    status: string
    durationMs?: number
    error?: string
  }

  const runs: RunRecord[] = []

  try {
    const files = readdirSync(RUNS_DIR).filter(f => f.endsWith('.jsonl'))
    for (const file of files) {
      const content = readFileSync(path.join(RUNS_DIR, file), 'utf-8')
      for (const line of content.split('\n').filter(Boolean)) {
        try {
          const r = JSON.parse(line)
          if (r.ts && r.ts >= since.getTime()) runs.push(r)
        } catch { /* skip */ }
      }
    }
  } catch {
    // Fall back to jobs.json lastRun
    try {
      interface JobRecord { id: string; lastRun?: string; lastStatus?: string; lastDurationMs?: number }
      const jobs: JobRecord[] = JSON.parse(readFileSync(JOBS_JSON, 'utf-8'))
      for (const j of jobs) {
        if (j.lastRun && new Date(j.lastRun) >= since) {
          runs.push({
            ts: new Date(j.lastRun).getTime(),
            status: j.lastStatus ?? 'ok',
            durationMs: j.lastDurationMs,
          })
        }
      }
    } catch { /* ignore */ }
  }

  const totalRuns = runs.length
  const successRuns = runs.filter(r => r.status === 'ok').length
  const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0
  const durations = runs.filter(r => r.durationMs && r.durationMs > 0).map(r => r.durationMs ?? 0)
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0

  // Runs per day
  const runsByDay: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    runsByDay[key] = 0
  }
  for (const r of runs) {
    const key = new Date(r.ts).toISOString().slice(0, 10)
    if (key in runsByDay) runsByDay[key]++
  }

  // ── Token usage ────────────────────────────────────────────────────────────
  interface TokenRecord {
    ts: number
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
    model?: string
    totalTokens?: number
  }

  const tokenRecords: TokenRecord[] = []
  try {
    const files = readdirSync(RUNS_DIR).filter(f => f.endsWith('.jsonl'))
    for (const file of files) {
      const content = readFileSync(path.join(RUNS_DIR, file), 'utf-8')
      for (const line of content.split('\n').filter(Boolean)) {
        try {
          const r = JSON.parse(line)
          if (r.ts && r.ts >= since.getTime() && (r.usage || r.totalTokens)) {
            tokenRecords.push(r)
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* ignore */ }

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalTokens = 0
  const modelUsage: Record<string, number> = {}

  for (const r of tokenRecords) {
    const inp = r.usage?.input_tokens ?? 0
    const out = r.usage?.output_tokens ?? 0
    const tot = r.usage?.total_tokens ?? r.totalTokens ?? (inp + out)
    totalInputTokens += inp
    totalOutputTokens += out
    totalTokens += tot
    if (r.model) {
      modelUsage[r.model] = (modelUsage[r.model] ?? 0) + tot
    }
  }

  const estimatedCost = (totalInputTokens * 3 / 1_000_000) + (totalOutputTokens * 15 / 1_000_000)

  // Tokens per day
  const tokensByDay: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    tokensByDay[key] = 0
  }
  for (const r of tokenRecords) {
    const key = new Date(r.ts).toISOString().slice(0, 10)
    if (key in tokensByDay) {
      tokensByDay[key] += r.usage?.total_tokens ?? r.totalTokens ?? 0
    }
  }

  return NextResponse.json({
    range,
    tasks: {
      total: allTasks.length,
      byStatus: tasksByStatus,
      overdue,
      inProgress: tasksByStatus['IN_PROGRESS'] ?? 0,
      done: tasksByStatus['DONE'] ?? 0,
      byDay: tasksByDay,
      byLabel: tasksByLabel,
      completionVelocity,
    },
    agents: {
      totalRuns,
      successRuns,
      successRate,
      avgDurationMs: avgDuration,
      byDay: runsByDay,
    },
    tokens: {
      total: totalTokens,
      input: totalInputTokens,
      output: totalOutputTokens,
      estimatedCostUsd: parseFloat(estimatedCost.toFixed(4)),
      byDay: tokensByDay,
      byModel: modelUsage,
    },
  })
}
