import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

export const dynamic = 'force-dynamic'

const AGENTS_DIR = '/root/.openclaw/agents'

// Cache
let cache: { data: any; period: string; ts: number } | null = null
const CACHE_TTL = 60_000

interface AgentTokens {
  id: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  totalCost: number
  sessionCount: number
  lastActive: string | null
}

function getPeriodStart(period: string): number {
  const now = Date.now()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  switch (period) {
    case 'today': return today.getTime()
    case '7d': return now - 7 * 86400000
    case '30d': return now - 30 * 86400000
    default: return 0
  }
}

async function scanAgent(agentId: string, periodStart: number): Promise<AgentTokens> {
  const result: AgentTokens = {
    id: agentId,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    sessionCount: 0,
    lastActive: null,
  }

  const sessionsDir = path.join(AGENTS_DIR, agentId, 'sessions')
  let files: string[]
  try {
    files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'))
  } catch {
    return result
  }

  // Filter files by mtime for performance
  const relevantFiles = files.filter(f => {
    try {
      const stat = fs.statSync(path.join(sessionsDir, f))
      return stat.mtimeMs >= periodStart
    } catch { return false }
  })

  const sessionIds = new Set<string>()

  for (const file of relevantFiles) {
    const filePath = path.join(sessionsDir, file)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const obj = JSON.parse(line)

          // Track session
          if (obj.type === 'session' && obj.id) {
            sessionIds.add(obj.id)
          }

          // Extract usage from assistant messages
          if (obj.type === 'message' && obj.message?.role === 'assistant' && obj.message?.usage) {
            const ts = obj.timestamp ? new Date(obj.timestamp).getTime() : 0
            if (ts && ts < periodStart) continue

            const u = obj.message.usage
            result.inputTokens += u.input || 0
            result.outputTokens += u.output || 0
            result.cacheReadTokens += u.cacheRead || 0
            result.cacheWriteTokens += u.cacheWrite || 0
            result.totalTokens += u.totalTokens || 0

            if (u.cost?.total) {
              result.totalCost += u.cost.total
            }

            if (obj.timestamp) {
              if (!result.lastActive || obj.timestamp > result.lastActive) {
                result.lastActive = obj.timestamp
              }
            }
          }
        } catch { /* skip bad line */ }
      }
    } catch { /* skip bad file */ }
  }

  result.sessionCount = sessionIds.size || relevantFiles.length
  return result
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const period = url.searchParams.get('period') || 'today'

  // Check cache
  if (cache && cache.period === period && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  const periodStart = getPeriodStart(period)

  // Scan all agents
  let agentIds: string[]
  try {
    agentIds = fs.readdirSync(AGENTS_DIR).filter(d => {
      try { return fs.statSync(path.join(AGENTS_DIR, d)).isDirectory() } catch { return false }
    })
  } catch {
    agentIds = []
  }

  const agents = await Promise.all(agentIds.map(id => scanAgent(id, periodStart)))

  // Sort by cost descending
  agents.sort((a, b) => b.totalCost - a.totalCost)

  const totals = {
    inputTokens: agents.reduce((s, a) => s + a.inputTokens, 0),
    outputTokens: agents.reduce((s, a) => s + a.outputTokens, 0),
    cacheReadTokens: agents.reduce((s, a) => s + a.cacheReadTokens, 0),
    cacheWriteTokens: agents.reduce((s, a) => s + a.cacheWriteTokens, 0),
    totalTokens: agents.reduce((s, a) => s + a.totalTokens, 0),
    totalCost: agents.reduce((s, a) => s + a.totalCost, 0),
  }

  // Build daily costs (scan all for period)
  const dailyCosts: Record<string, number> = {}
  for (const agent of agents) {
    // We already aggregated per-agent; for daily we'd need per-line timestamps
    // For now, just show total per agent
  }

  const data = {
    period,
    generated: new Date().toISOString(),
    totals,
    agents: agents.filter(a => a.totalTokens > 0 || a.totalCost > 0),
    totalSessions: agents.reduce((s, a) => s + a.sessionCount, 0),
  }

  cache = { data, period, ts: Date.now() }
  return NextResponse.json(data)
}
