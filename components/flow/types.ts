export type AgentStatus = 'idle' | 'running' | 'done' | 'error'

export interface AgentNodeData {
  id: string
  name: string
  emoji: string
  role: string
  model: string
  status: AgentStatus
  lastRunAt: string | null
  lastRunStatus: string | null
  lastRunDurationMs: number | null
  recentRuns: AgentRun[]
  totalCost7d: number
  totalTokens7d: number
  runsToday: number
}

export interface AgentRun {
  runAt: string
  status: string
  durationMs: number
  costUsd: number
}

export interface AgentEdgeData {
  source: string
  target: string
  count: number
  lastAt: string | null
}

export interface ChainStep {
  agentId: string
  status: string
  startAt: string
  durationMs: number
}

export interface WorkflowChain {
  id: string
  steps: ChainStep[]
  startAt: string
  status: 'success' | 'failed' | 'running'
}

export interface FlowData {
  agents: AgentNodeData[]
  edges: AgentEdgeData[]
  chains: WorkflowChain[]
}
