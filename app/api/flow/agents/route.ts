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
  model?: string | null
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
}

function getAgentSessions(agentId: string): Record<string, SessionData> {
  const sessionsFile = path.join(AGENTS_DIR, agentId, 'sessions', 'sessions.json')
  try {
    return JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'))
  } catch {
    return {}
  }
}

interface RunRecord {
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

function getJobRuns(): Array<{
  jobId: string
  status: string
  runAtMs: number
  durationMs: number
  model: string | null
  costUsd: number
  tokens: number
  sessionId: string | null
}> {
  const runs: Array<{
    jobId: string
    status: string
    runAtMs: number
    durationMs: number
    model: string | null
    costUsd: number
    tokens: number
    sessionId: string | null
  }> = []

  try {
    const files = fs.readdirSync(RUNS_DIR).filter(f => f.endsWith('.jsonl'))
    for (const file of files) {
      const jobId = file.replace('.jsonl', '')
      try {
        const lines = fs.readFileSync(path.join(RUNS_DIR, file), 'utf-8').split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const run: RunRecord = JSON.parse(line)
            if (run.action !== 'finished') continue
            const costUsd = calcCost(run.model || null, run.usage || null)
            runs.push({
              jobId,
              status: run.status || 'unknown',
              runAtMs: run.runAtMs || run.ts || 0,
              durationMs: run.durationMs || 0,
              model: run.model || null,
              costUsd,
              tokens: run.usage?.total_tokens || 0,
              sessionId: run.sessionId || null,
            })
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  return runs.sort((a, b) => b.runAtMs - a.runAtMs)
}

function getJobNames(): Record<string, string> {
  try {
    const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'))
    const map: Record<string, string> = {}
    for (const job of data.jobs || []) map[job.id] = job.name
    return map
  } catch {
    return {}
  }
}

// Derive agent status from sessions
function getAgentStatus(agentId: string): { status: 'idle' | 'running' | 'done' | 'error'; lastUpdated: number } {
  const sessions = getAgentSessions(agentId)
  let latestUpdate = 0
  const now = Date.now()
  const fiveMinAgo = now - 5 * 60 * 1000

  for (const sess of Object.values(sessions)) {
    if (sess.updatedAt > latestUpdate) latestUpdate = sess.updatedAt
  }

  // Active in last 2 minutes = running
  if (latestUpdate > now - 2 * 60 * 1000) {
    return { status: 'running', lastUpdated: latestUpdate }
  }
  // Active in last 5 minutes = done (recently completed)
  if (latestUpdate > fiveMinAgo) {
    return { status: 'done', lastUpdated: latestUpdate }
  }
  return { status: 'idle', lastUpdated: latestUpdate }
}

// Build edge data from session keys (subagent patterns)
function buildEdges(agentIds: string[]): Array<{
  source: string
  target: string
  count: number
  lastAt: string | null
}> {
  const edgeMap = new Map<string, { count: number; lastAt: number }>()

  for (const agentId of agentIds) {
    const sessions = getAgentSessions(agentId)
    for (const [sessionKey, sess] of Object.entries(sessions)) {
      // Pattern: agent:<spawner>:subagent:<uuid> in <target>'s sessions means <spawner> spawned <target>
      // But actually session keys in each agent's folder indicate who spawned them
      // Session key format: agent:<agentId>:subagent:<uuid>
      const subagentMatch = sessionKey.match(/^agent:(\w+):subagent:/)
      if (subagentMatch) {
        const spawnerInKey = subagentMatch[1]
        // If this session is in agentId's folder but the key says it's for spawnerInKey,
        // that means spawnerInKey spawned agentId
        if (spawnerInKey === agentId) {
          // This is a subagent session of agentId itself - agentId spawned a sub-task
          // The "main" agent often spawns other agents
          // We can't determine the target from just the key
          continue
        }
      }
    }
  }

  // Alternative: look at main's sessions for subagent spawns → each agent
  // Main spawns all agents, agents spawn sub-tasks
  // Build known spawn relationships from session presence
  for (const agentId of agentIds) {
    if (agentId === 'main') continue
    const sessions = getAgentSessions(agentId)
    const hasActivity = Object.keys(sessions).length > 0
    if (hasActivity) {
      // main → agentId edge
      const key = `main→${agentId}`
      let lastAt = 0
      for (const sess of Object.values(sessions)) {
        if (sess.updatedAt > lastAt) lastAt = sess.updatedAt
      }
      edgeMap.set(key, {
        count: Object.keys(sessions).length,
        lastAt,
      })
    }

    // Check for subagent sessions within this agent (agent spawning sub-tasks)
    for (const sessionKey of Object.keys(sessions)) {
      if (sessionKey.includes(':subagent:')) {
        // This agent has subagent sessions
        // e.g. agent:dev:subagent:xxx means dev spawned a sub-task
        // Without more data, we track self-spawning sub-tasks
      }
    }
  }

  // Known workflow relationships from Bea's spec
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
    { source: 'ba', target: 'dev' },
    { source: 'ba', target: 'ux' },
    { source: 'dev', target: 'qa' },
    { source: 'devops', target: 'dev' },
  ]

  const edges: Array<{ source: string; target: string; count: number; lastAt: string | null }> = []

  for (const { source, target } of knownEdges) {
    const key = `${source}→${target}`
    const existing = edgeMap.get(key)
    edges.push({
      source,
      target,
      count: existing?.count || 1,
      lastAt: existing?.lastAt ? new Date(existing.lastAt).toISOString() : null,
    })
  }

  return edges
}

// Build workflow chains from recent session activity
function buildChains(agentIds: string[]): Array<{
  id: string
  steps: Array<{ agentId: string; status: string; startAt: string; durationMs: number }>
  startAt: string
  status: 'success' | 'failed' | 'running'
}> {
  // Group recent activity into chains based on temporal proximity
  interface ActivityEntry {
    agentId: string
    sessionKey: string
    updatedAt: number
  }

  const activities: ActivityEntry[] = []
  const now = Date.now()
  const cutoff = now - 24 * 3600 * 1000 // last 24h

  for (const agentId of agentIds) {
    const sessions = getAgentSessions(agentId)
    for (const [sessionKey, sess] of Object.entries(sessions)) {
      if (sess.updatedAt > cutoff) {
        activities.push({ agentId, sessionKey, updatedAt: sess.updatedAt })
      }
    }
  }

  activities.sort((a, b) => a.updatedAt - b.updatedAt)

  // Cluster activities within 10-minute windows into chains
  const chains: Array<{
    id: string
    steps: Array<{ agentId: string; status: string; startAt: string; durationMs: number }>
    startAt: string
    status: 'success' | 'failed' | 'running'
  }> = []

  let currentChain: ActivityEntry[] = []
  for (const activity of activities) {
    if (currentChain.length === 0 || activity.updatedAt - currentChain[currentChain.length - 1].updatedAt < 10 * 60 * 1000) {
      currentChain.push(activity)
    } else {
      if (currentChain.length >= 2) {
        // Deduplicate by agentId, keep latest
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
      currentChain = [activity]
    }
  }

  // Process last chain
  if (currentChain.length >= 2) {
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

  // Return last 10 chains, most recent first
  return chains.slice(-10).reverse()
}

export async function GET() {
  const agentIds = getAgentIds()
  const jobRuns = getJobRuns()
  const jobNames = getJobNames()
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 3600 * 1000
  const todayStart = new Date().setHours(0, 0, 0, 0)

  const agents = agentIds.map(id => {
    const meta = AGENT_META[id] || { name: id, emoji: '🤖', role: 'Agent' }
    const model = getAgentModel(id)
    const { status } = getAgentStatus(id)

    // Find runs associated with this agent
    // Job names often contain agent name references
    const agentRuns = jobRuns.filter(r => {
      const name = (jobNames[r.jobId] || '').toLowerCase()
      return name.includes(id) || r.sessionId?.includes(`agent:${id}`)
    })

    const recentRuns = agentRuns.slice(0, 5).map(r => ({
      runAt: new Date(r.runAtMs).toISOString(),
      status: r.status,
      durationMs: r.durationMs,
      costUsd: r.costUsd,
    }))

    const runs7d = agentRuns.filter(r => r.runAtMs > sevenDaysAgo)
    const totalCost7d = runs7d.reduce((s, r) => s + r.costUsd, 0)
    const totalTokens7d = runs7d.reduce((s, r) => s + r.tokens, 0)
    const runsToday = agentRuns.filter(r => r.runAtMs > todayStart).length

    const lastRun = agentRuns[0]

    return {
      id,
      name: meta.name,
      emoji: meta.emoji,
      role: meta.role,
      model: model.replace('anthropic/', ''),
      status,
      lastRunAt: lastRun ? new Date(lastRun.runAtMs).toISOString() : null,
      lastRunStatus: lastRun?.status || null,
      lastRunDurationMs: lastRun?.durationMs || null,
      recentRuns,
      totalCost7d,
      totalTokens7d,
      runsToday,
    }
  })

  const edges = buildEdges(agentIds)
  const chains = buildChains(agentIds)

  return NextResponse.json({ agents, edges, chains })
}
