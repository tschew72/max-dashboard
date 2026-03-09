import fs from 'fs'
import path from 'path'

// ── Constants ────────────────────────────────────────────────
const AGENTS_DIR = '/root/.openclaw/agents'
const OPENCLAW_CONFIG = '/root/.openclaw/openclaw.json'

const RUNNING_THRESHOLD = 90_000      // 90 seconds
const DONE_THRESHOLD = 300_000        // 5 minutes
const RECENT_THRESHOLD = 86_400_000   // 24 hours

// ── Agent Metadata ───────────────────────────────────────────
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

// ── Types ────────────────────────────────────────────────────
export interface SessionEntry {
  sessionId: string
  updatedAt: number
  spawnDepth?: number
  spawnedBy?: string
  channel?: string
  groupId?: string
  groupChannel?: string
  sessionFile?: string
  chatType?: string
}

export interface ActiveStep {
  agentId: string
  agentName: string
  emoji: string
  role: string
  status: 'running' | 'done'
  sessionKey: string
  spawnedBy: string | null
  startedAt: string
  taskPreview: string
  lastTool: string | null
}

export interface ActiveChain {
  id: string
  startedAt: string
  rootAgent: string
  steps: ActiveStep[]
}

export interface AgentSummary {
  id: string
  name: string
  emoji: string
  role: string
  model: string
  status: 'idle' | 'running' | 'done'
  lastActiveAt: string | null
  lastTaskPreview: string | null
  runsToday: number
  totalRuns: number
}

export interface RecentActivityEntry {
  agentId: string
  agentName: string
  emoji: string
  taskPreview: string
  startedAt: string
  endedAt: string | null
  spawnedBy: string | null
  status: 'success' | 'running'
}

export interface FlowState {
  activeChains: ActiveChain[]
  agents: AgentSummary[]
  recentActivity: RecentActivityEntry[]
}

// ── Utilities ────────────────────────────────────────────────

export function formatTimeAgo(isoDate: string | null): string {
  if (!isoDate) return 'never'
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function parseParentAgentId(spawnedBy: string): string {
  // "agent:main:discord:channel:..." → "main"
  return spawnedBy.split(':')[1] || 'unknown'
}

function getSessionStatus(updatedAt: number, now: number): 'running' | 'done' | 'idle' {
  const age = now - updatedAt
  if (age < RUNNING_THRESHOLD) return 'running'
  if (age < DONE_THRESHOLD) return 'done'
  return 'idle'
}

// ── Task Preview Cache ───────────────────────────────────────
const taskPreviewCache = new Map<string, string>()

function extractTaskPreview(sessionFile: string, sessionId: string): string {
  const cached = taskPreviewCache.get(sessionId)
  if (cached !== undefined) return cached

  try {
    // Read only first ~30KB to find the user message quickly
    const fd = fs.openSync(sessionFile, 'r')
    const buf = Buffer.alloc(30_000)
    const bytesRead = fs.readSync(fd, buf, 0, 30_000, 0)
    fs.closeSync(fd)

    const content = buf.toString('utf-8', 0, bytesRead)
    const lines = content.split('\n')

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)
        if (entry.type === 'message' && entry.message?.role === 'user') {
          let text = ''
          const msgContent = entry.message.content
          if (typeof msgContent === 'string') {
            text = msgContent
          } else if (Array.isArray(msgContent)) {
            const textBlock = msgContent.find((b: { type: string }) => b.type === 'text')
            text = textBlock?.text || ''
          }

          // Strip [Subagent Context] preamble — find [Subagent Task]:
          const taskMatch = text.indexOf('[Subagent Task]:')
          if (taskMatch !== -1) {
            text = text.substring(taskMatch + '[Subagent Task]:'.length).trim()
          }

          // Also strip leading ## headers / markdown noise for cleaner preview
          text = text.replace(/^#+\s+.*\n/gm, '').trim()

          const preview = text.slice(0, 120).replace(/\n/g, ' ').trim()
          taskPreviewCache.set(sessionId, preview)
          return preview
        }
      } catch { /* skip bad line */ }
    }
  } catch { /* file not found or read error */ }

  taskPreviewCache.set(sessionId, '')
  return ''
}

function extractLastTool(sessionFile: string): string | null {
  try {
    const stat = fs.statSync(sessionFile)
    // Read last ~20KB for tool calls
    const size = stat.size
    const readSize = Math.min(size, 20_000)
    const fd = fs.openSync(sessionFile, 'r')
    const buf = Buffer.alloc(readSize)
    fs.readSync(fd, buf, 0, readSize, Math.max(0, size - readSize))
    fs.closeSync(fd)

    const content = buf.toString('utf-8')
    const lines = content.split('\n').filter(l => l.trim())

    // Scan in reverse for toolCall
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i])
        if (entry.type === 'message' && entry.message?.role === 'assistant') {
          const blocks = entry.message.content
          if (Array.isArray(blocks)) {
            for (let j = blocks.length - 1; j >= 0; j--) {
              if (blocks[j].type === 'toolCall' || blocks[j].type === 'tool_use') {
                return blocks[j].name || blocks[j].toolName || null
              }
            }
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* file error */ }
  return null
}

// ── Core Scanner ─────────────────────────────────────────────

function getAgentIds(): string[] {
  try {
    const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'))
    return (config?.agents?.list || []).map((a: { id: string }) => a.id)
  } catch {
    return Object.keys(AGENT_META)
  }
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

function getAgentSessions(agentId: string): Record<string, SessionEntry> {
  const sessionsFile = path.join(AGENTS_DIR, agentId, 'sessions', 'sessions.json')
  try {
    return JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'))
  } catch {
    return {}
  }
}

interface SubagentInfo {
  agentId: string
  sessionKey: string
  session: SessionEntry
  parentAgentId: string
  status: 'running' | 'done'
}

export function buildFlowState(): FlowState {
  const agentIds = getAgentIds()
  const now = Date.now()
  const todayStart = new Date().setHours(0, 0, 0, 0)

  // Step 1: Scan all sessions
  const allSessions = new Map<string, Record<string, SessionEntry>>()
  for (const agentId of agentIds) {
    allSessions.set(agentId, getAgentSessions(agentId))
  }

  // Step 2: Find active/recent subagent sessions
  const activeSubagents: SubagentInfo[] = []
  for (const [agentId, sessions] of allSessions) {
    for (const [key, session] of Object.entries(sessions)) {
      if (!key.includes('subagent')) continue
      if (!session.spawnedBy) continue
      const status = getSessionStatus(session.updatedAt, now)
      if (status === 'idle') continue // Only running or done

      activeSubagents.push({
        agentId,
        sessionKey: key,
        session,
        parentAgentId: parseParentAgentId(session.spawnedBy),
        status,
      })
    }
  }

  // Step 3: Build chains by walking spawnedBy links
  // Group by root: find root for each subagent by walking parent chain
  const chainGroups = new Map<string, SubagentInfo[]>()

  for (const sub of activeSubagents) {
    // Walk up the chain to find the root
    let rootId = sub.parentAgentId
    // Check if parent is itself a subagent in our active set
    const parentSub = activeSubagents.find(s => s.agentId === rootId && s.sessionKey !== sub.sessionKey)
    if (parentSub) {
      rootId = parentSub.parentAgentId
    }
    // Use root as chain key
    const chainKey = rootId
    if (!chainGroups.has(chainKey)) chainGroups.set(chainKey, [])
    chainGroups.get(chainKey)!.push(sub)
  }

  const activeChains: ActiveChain[] = []
  for (const [rootAgentId, subs] of chainGroups) {
    // Sort by spawn depth or updatedAt
    subs.sort((a, b) => (a.session.spawnDepth || 0) - (b.session.spawnDepth || 0))

    const steps: ActiveStep[] = []

    // Add root agent as first step
    const rootMeta = AGENT_META[rootAgentId] || { name: rootAgentId, emoji: '🤖', role: 'Agent' }
    const rootSessions = allSessions.get(rootAgentId) || {}
    // Find root agent's most recent non-subagent session
    let rootUpdatedAt = 0
    let rootSessionFile = ''
    let rootSessionId = ''
    for (const [key, sess] of Object.entries(rootSessions)) {
      if (key.includes('subagent')) continue
      if (sess.updatedAt > rootUpdatedAt) {
        rootUpdatedAt = sess.updatedAt
        rootSessionFile = sess.sessionFile || ''
        rootSessionId = sess.sessionId || ''
      }
    }
    const rootStatus = getSessionStatus(rootUpdatedAt, now)
    if (rootStatus !== 'idle') {
      steps.push({
        agentId: rootAgentId,
        agentName: rootMeta.name,
        emoji: rootMeta.emoji,
        role: rootMeta.role,
        status: rootStatus as 'running' | 'done',
        sessionKey: `root:${rootAgentId}`,
        spawnedBy: null,
        startedAt: new Date(rootUpdatedAt).toISOString(),
        taskPreview: rootSessionFile ? extractTaskPreview(rootSessionFile, rootSessionId) : '',
        lastTool: rootStatus === 'running' && rootSessionFile ? extractLastTool(rootSessionFile) : null,
      })
    }

    // Add subagent steps
    for (const sub of subs) {
      const meta = AGENT_META[sub.agentId] || { name: sub.agentId, emoji: '🤖', role: 'Agent' }
      const sessionFile = sub.session.sessionFile || ''
      steps.push({
        agentId: sub.agentId,
        agentName: meta.name,
        emoji: meta.emoji,
        role: meta.role,
        status: sub.status,
        sessionKey: sub.sessionKey,
        spawnedBy: sub.parentAgentId,
        startedAt: new Date(sub.session.updatedAt).toISOString(),
        taskPreview: sessionFile ? extractTaskPreview(sessionFile, sub.session.sessionId) : '',
        lastTool: sub.status === 'running' && sessionFile ? extractLastTool(sessionFile) : null,
      })
    }

    if (steps.length > 0) {
      const earliest = steps.reduce((min, s) => {
        const t = new Date(s.startedAt).getTime()
        return t < min ? t : min
      }, Infinity)
      activeChains.push({
        id: `chain-${rootAgentId}-${earliest}`,
        startedAt: new Date(earliest).toISOString(),
        rootAgent: rootAgentId,
        steps,
      })
    }
  }

  // Sort chains by start time (most recent first)
  activeChains.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  // Step 4: Build agents summary
  const agents: AgentSummary[] = agentIds.map(id => {
    const meta = AGENT_META[id] || { name: id, emoji: '🤖', role: 'Agent' }
    const model = getAgentModel(id)
    const sessions = allSessions.get(id) || {}
    const entries = Object.values(sessions)

    let latestUpdated = 0
    let latestSubagentFile = ''
    let latestSubagentId = ''
    let runsToday = 0
    let totalRuns = entries.length

    for (const [key, sess] of Object.entries(sessions)) {
      if (sess.updatedAt > latestUpdated) latestUpdated = sess.updatedAt
      if (sess.updatedAt > todayStart) runsToday++
      if (key.includes('subagent') && sess.sessionFile) {
        if (!latestSubagentFile || sess.updatedAt > new Date(latestSubagentId ? latestUpdated : 0).getTime()) {
          latestSubagentFile = sess.sessionFile
          latestSubagentId = sess.sessionId
        }
      }
    }

    // Find most recent subagent session for task preview
    let lastTaskPreview: string | null = null
    if (latestSubagentFile && latestSubagentId) {
      const preview = extractTaskPreview(latestSubagentFile, latestSubagentId)
      if (preview) lastTaskPreview = preview
    }

    const status = getSessionStatus(latestUpdated, now)

    return {
      id,
      name: meta.name,
      emoji: meta.emoji,
      role: meta.role,
      model: model.replace('anthropic/', ''),
      status: status === 'idle' ? 'idle' : status === 'running' ? 'running' : 'done',
      lastActiveAt: latestUpdated > 0 ? new Date(latestUpdated).toISOString() : null,
      lastTaskPreview,
      runsToday,
      totalRuns,
    }
  })

  // Sort agents: running first, then done, then by lastActiveAt desc
  agents.sort((a, b) => {
    const statusOrder = { running: 0, done: 1, idle: 2 }
    const aDiff = statusOrder[a.status]
    const bDiff = statusOrder[b.status]
    if (aDiff !== bDiff) return aDiff - bDiff
    const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
    const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
    return bTime - aTime
  })

  // Step 5: Build recent activity
  const recentActivity: RecentActivityEntry[] = []
  for (const [agentId, sessions] of allSessions) {
    for (const [key, session] of Object.entries(sessions)) {
      if (!key.includes('subagent')) continue
      if (now - session.updatedAt > RECENT_THRESHOLD) continue

      const meta = AGENT_META[agentId] || { name: agentId, emoji: '🤖', role: 'Agent' }
      const sessionFile = session.sessionFile || ''
      const preview = sessionFile ? extractTaskPreview(sessionFile, session.sessionId) : ''
      const status = getSessionStatus(session.updatedAt, now)

      recentActivity.push({
        agentId,
        agentName: meta.name,
        emoji: meta.emoji,
        taskPreview: preview,
        startedAt: new Date(session.updatedAt).toISOString(),
        endedAt: status === 'idle' || status === 'done' ? new Date(session.updatedAt).toISOString() : null,
        spawnedBy: session.spawnedBy ? parseParentAgentId(session.spawnedBy) : null,
        status: status === 'running' ? 'running' : 'success',
      })
    }
  }

  recentActivity.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  recentActivity.splice(20)

  return { activeChains, agents, recentActivity }
}

export { AGENTS_DIR, getAgentIds }
