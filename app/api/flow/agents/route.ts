import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const OPENCLAW_CONFIG = '/root/.openclaw/openclaw.json'
const AGENTS_DIR = '/root/.openclaw/agents'
const RUNS_DIR = '/root/.openclaw/cron/runs'
const JOBS_FILE = '/root/.openclaw/cron/jobs.json'

// Agent metadata (id → display info)
const AGENT_META: Record<string, { name: string; emoji: string; role: string }> = {
  main:       { name: 'Max',      emoji: '⚡', role: 'Orchestrator' },
  ba:         { name: 'Bea',      emoji: '📋', role: 'Business Analyst' },
  dev:        { name: 'Dev',      emoji: '💻', role: 'Full-Stack Engineer' },
  ux:         { name: 'Umi',      emoji: '🎨', role: 'UX Designer' },
  researcher: { name: 'Alex',     emoji: '🔍', role: 'Researcher' },
  sales:      { name: 'Sam',      emoji: '📈', role: 'Sales' },
  qa:         { name: 'Quinn',    emoji: '🧪', role: 'QA Engineer' },
  devops:     { name: 'Dex',      emoji: '🚀', role: 'DevOps' },
  cfo:        { name: 'Cleo',     emoji: '💰', role: 'CFO' },
  ciso:       { name: 'Kai',      emoji: '🛡️', role: 'CISO' },
  writer:     { name: 'Wren',     emoji: '✍️', role: 'Writer' },
  ops:        { name: 'Ops',      emoji: '⚙️', role: 'Operations' },
  marketing:  { name: 'Maya',     emoji: '📣', role: 'Marketing' },
  webdev:     { name: 'Webrin',   emoji: '🌐', role: 'Web Developer' },
}

// Pricing: [inputRatePerMToken, outputRatePerMToken]
const PRICING: Record<string, [number, number]> = {
  'claude-sonnet': [3.0, 15.0],
  'claude-opus':   [15.0, 75.0],
  'claude-haiku':  [0.25, 1.25],
}

function calcCost(model: string | null, usage: { input_tokens?: number; output_tokens?: number } | null): number {
  if (!model || !usage) return 0
  const key = Object.keys(PRICING).find(k => model.toLowerCase().includes(k)) || 'claude-sonnet'
  const [inRate, outRate] = PRICING[key]
  return ((usage.input_tokens || 0) / 1e6) * inRate + ((usage.output_tokens || 0) / 1e6) * outRate
}

function getAgentModel(agentId: string): string {
  try {
    const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    const agents = config?.agents?.list || []
    const agent = agents.find((a: { id: string }) => a.id === agentId)
    if (!agent?.model) return 'claude-sonnet-4'
    if (typeof agent.model === 'string') return agent.model
    return agent.model.primary || 'claude-sonnet-4'
  } catch {
    return 'claude-sonnet-4'
  }
}

function getAgentIds(): string[] {
  try {
    const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    return (config?.agents?.list || []).map((a: { id: string }) => a.id)
  } catch {
    return Object.keys(AGENT_META)
  }
}

interface SessionData {
  updatedAt: number
}

function getAgentSessions(agentId: string): Record<string, SessionData> {
  const sessionsFile = path.join(AGENTS_DIR, agentId, 'sessions', 'sessions.json')
  try {
    return JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'))
  } catch {
    return {}
  }
}

interface RecentRun {
  runAt: string
  status: string
  durationMs: number
  costUsd: number
}

interface CronRunRecord {
  action?: string
  status?: string
  runAtMs?: number
  ts?: number
  durationMs?: number
  model?: string | null
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null
  sessionId?: string | null
  summary?: string | null
}

// ── Agent runs ──────────────────────────────────────────────
// Main agent: read cron/runs JSONL files
// Other agents: read sessions.json (each entry = one subagent dispatch)
function getAgentRuns(agentId: string): { runs: RecentRun[]; totalCost7d: number; runsToday: number; lastRunAt: string | null } {
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 3600 * 1000
  const todayStart = new Date().setHours(0, 0, 0, 0)

  if (agentId === 'main') {
    return getMainAgentRuns(sevenDaysAgo, todayStart)
  }

  // Subagent: read sessions.json
  const sessions = getAgentSessions(agentId)
  const entries = Object.values(sessions)
    .map(s => s.updatedAt)
    .filter(t => t > 0)
    .sort((a, b) => b - a)

  const runs: RecentRun[] = entries.slice(0, 10).map(t => ({
    runAt: new Date(t).toISOString(),
    status: 'success',
    durationMs: 0,
    costUsd: 0,
  }))

  const runsToday = entries.filter(t => t > todayStart).length
  const lastRunAt = entries.length > 0 ? new Date(entries[0]).toISOString() : null

  return { runs, totalCost7d: 0, runsToday, lastRunAt }
}

function getMainAgentRuns(sevenDaysAgo: number, todayStart: number): { runs: RecentRun[]; totalCost7d: number; runsToday: number; lastRunAt: string | null } {
  const allRuns: Array<{ runAtMs: number; status: string; durationMs: number; costUsd: number; tokens: number }> = []

  try {
    const files = fs.readdirSync(RUNS_DIR).filter(f => f.endsWith('.jsonl'))
    for (const file of files) {
      try {
        const lines = fs.readFileSync(path.join(RUNS_DIR, file), 'utf-8').split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const run: CronRunRecord = JSON.parse(line)
            if (run.action !== 'finished') continue
            const costUsd = calcCost(run.model || null, run.usage || null)
            allRuns.push({
              runAtMs: run.runAtMs || run.ts || 0,
              status: run.status || 'unknown',
              durationMs: run.durationMs || 0,
              costUsd,
              tokens: run.usage?.total_tokens || 0,
            })
          } catch { /* skip bad line */ }
        }
      } catch { /* skip bad file */ }
    }
  } catch { /* no runs dir */ }

  allRuns.sort((a, b) => b.runAtMs - a.runAtMs)

  const runs: RecentRun[] = allRuns.slice(0, 10).map(r => ({
    runAt: new Date(r.runAtMs).toISOString(),
    status: r.status,
    durationMs: r.durationMs,
    costUsd: r.costUsd,
  }))

  const runs7d = allRuns.filter(r => r.runAtMs > sevenDaysAgo)
  const totalCost7d = runs7d.reduce((s, r) => s + r.costUsd, 0)
  const runsToday = allRuns.filter(r => r.runAtMs > todayStart).length
  const lastRunAt = allRuns.length > 0 ? new Date(allRuns[0].runAtMs).toISOString() : null

  return { runs, totalCost7d, runsToday, lastRunAt }
}

// ── Agent status ────────────────────────────────────────────
// Use JSONL file mtime for accurate real-time detection
function isAgentActive(agentId: string): boolean {
  const dir = path.join(AGENTS_DIR, agentId, 'sessions')
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))
    return files.some(f => {
      const stat = fs.statSync(path.join(dir, f))
      return Date.now() - stat.mtimeMs < 90_000
    })
  } catch {
    return false
  }
}

function getAgentStatus(agentId: string): { status: 'idle' | 'running' | 'done' | 'error'; lastUpdated: number } {
  const dir = path.join(AGENTS_DIR, agentId, 'sessions')
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))
    if (!files.length) return { status: 'idle', lastUpdated: 0 }

    const mtimes = files.map(f => fs.statSync(path.join(dir, f)).mtimeMs)
    const latest = Math.max(...mtimes)
    const now = Date.now()

    if (latest > now - 90_000) return { status: 'running', lastUpdated: latest }
    if (latest > now - 120_000) return { status: 'done', lastUpdated: latest }
    return { status: 'idle', lastUpdated: latest }
  } catch {
    return { status: 'idle', lastUpdated: 0 }
  }
}

// ── Edges ───────────────────────────────────────────────────
function buildEdges(agentIds: string[]): Array<{
  source: string
  target: string
  count: number
  lastAt: string | null
  active: boolean
}> {
  // Build activity counts from session data
  const edgeMap = new Map<string, { count: number; lastAt: number }>()

  for (const agentId of agentIds) {
    if (agentId === 'main') continue
    const sessions = getAgentSessions(agentId)
    const sessionCount = Object.keys(sessions).length
    if (sessionCount > 0) {
      let lastAt = 0
      for (const sess of Object.values(sessions)) {
        if (sess.updatedAt > lastAt) lastAt = sess.updatedAt
      }
      edgeMap.set(`main→${agentId}`, { count: sessionCount, lastAt })
    }
  }

  // Pre-compute active status for all agents
  const activeMap = new Map<string, boolean>()
  for (const id of agentIds) {
    activeMap.set(id, isAgentActive(id))
  }

  // Known workflow relationships
  const knownEdges: Array<{ source: string; target: string }> = [
    { source: 'main', target: 'ba' },
    { source: 'main', target: 'dev' },
    { source: 'main', target: 'researcher' },
    { source: 'main', target: 'sales' },
    { source: 'main', target: 'ux' },
    { source: 'main', target: 'qa' },
    { source: 'main', target: 'devops' },
    { source: 'main', target: 'cfo' },
    { source: 'main', target: 'writer' },
    { source: 'main', target: 'ciso' },
    { source: 'main', target: 'ops' },
    { source: 'main', target: 'marketing' },
    { source: 'main', target: 'webdev' },
    { source: 'ba', target: 'dev' },
    { source: 'ba', target: 'ux' },
    { source: 'dev', target: 'qa' },
    { source: 'devops', target: 'dev' },
  ]

  const edges: Array<{ source: string; target: string; count: number; lastAt: string | null; active: boolean }> = []

  for (const { source, target } of knownEdges) {
    const key = `${source}→${target}`
    const existing = edgeMap.get(key)
    const isSourceRunning = activeMap.get(source) || false
    const isTargetRunning = activeMap.get(target) || false

    edges.push({
      source,
      target,
      count: existing?.count || 0,
      lastAt: existing?.lastAt ? new Date(existing.lastAt).toISOString() : null,
      active: isSourceRunning && isTargetRunning,
    })
  }

  return edges
}

// ── Workflow chains ─────────────────────────────────────────
function buildChains(agentIds: string[]): Array<{
  id: string
  steps: Array<{ agentId: string; status: string; startAt: string; durationMs: number }>
  startAt: string
  status: 'success' | 'failed' | 'running'
}> {
  interface ActivityEntry {
    agentId: string
    updatedAt: number
  }

  const activities: ActivityEntry[] = []
  const now = Date.now()
  const cutoff = now - 24 * 3600 * 1000

  for (const agentId of agentIds) {
    const sessions = getAgentSessions(agentId)
    for (const sess of Object.values(sessions)) {
      if (sess.updatedAt > cutoff) {
        activities.push({ agentId, updatedAt: sess.updatedAt })
      }
    }
  }

  activities.sort((a, b) => a.updatedAt - b.updatedAt)

  const chains: Array<{
    id: string
    steps: Array<{ agentId: string; status: string; startAt: string; durationMs: number }>
    startAt: string
    status: 'success' | 'failed' | 'running'
  }> = []

  let currentChain: ActivityEntry[] = []

  const flushChain = () => {
    if (currentChain.length < 2) return
    const seen = new Map<string, ActivityEntry>()
    for (const a of currentChain) seen.set(a.agentId, a)
    const deduped = Array.from(seen.values()).sort((a, b) => a.updatedAt - b.updatedAt)
    const chainStart = deduped[0].updatedAt
    const isRunning = deduped.some(a => a.updatedAt > now - 2 * 60 * 1000)
    chains.push({
      id: `chain-${chainStart}`,
      steps: deduped.map(a => ({
        agentId: a.agentId,
        status: a.updatedAt > now - 2 * 60 * 1000 ? 'running' : 'done',
        startAt: new Date(a.updatedAt).toISOString(),
        durationMs: 0,
      })),
      startAt: new Date(chainStart).toISOString(),
      status: isRunning ? 'running' : 'success',
    })
  }

  for (const activity of activities) {
    if (currentChain.length === 0 || activity.updatedAt - currentChain[currentChain.length - 1].updatedAt < 10 * 60 * 1000) {
      currentChain.push(activity)
    } else {
      flushChain()
      currentChain = [activity]
    }
  }
  flushChain()

  return chains.slice(-10).reverse()
}

// ── GET handler ─────────────────────────────────────────────
export async function GET() {
  const agentIds = getAgentIds()

  const agents = agentIds.map(id => {
    const meta = AGENT_META[id] || { name: id, emoji: '🤖', role: 'Agent' }
    const model = getAgentModel(id)
    const { status } = getAgentStatus(id)
    const { runs, totalCost7d, runsToday, lastRunAt } = getAgentRuns(id)

    return {
      id,
      name: meta.name,
      emoji: meta.emoji,
      role: meta.role,
      model: model.replace('anthropic/', ''),
      status,
      lastRunAt,
      lastRunStatus: runs.length > 0 ? runs[0].status : null,
      lastRunDurationMs: runs.length > 0 ? runs[0].durationMs : null,
      recentRuns: runs.slice(0, 5),
      totalCost7d,
      totalTokens7d: 0,
      runsToday,
    }
  })

  const edges = buildEdges(agentIds)
  const chains = buildChains(agentIds)

  return NextResponse.json({ agents, edges, chains })
}
