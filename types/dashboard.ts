export interface DashboardPanel<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: number | null
}

export type SSEEventType = 'health' | 'tasks' | 'gmail' | 'infra' | 'promptdome' | 'agents' | 'security' | 'ping'

export interface SSEMessage {
  type: SSEEventType
  data: unknown
  timestamp: number
}

// Gmail types
export interface GmailMessage {
  id: string
  from: string
  fromName: string
  subject: string
  receivedAt: string
  isRead: boolean
  phishingVerdict: 'safe' | 'suspicious' | 'blocked' | 'unknown'
  actionStatus: 'executed' | 'received'
  taskLink?: string
}

export interface GmailPanelData {
  messages: GmailMessage[]
  unreadCount: number
}

// Infra types
export interface PM2Process {
  name: string
  status: string
  uptime: number
  restarts: number
  memory: number // MB
  cpu: number
}

export interface DockerContainer {
  name: string
  status: string
  state: string
  uptime: string
}

export interface InfraPanelData {
  pm2: PM2Process[]
  docker: DockerContainer[]
  pm2Count: number
  dockerCount: number
  errorCount: number
}

// PromptDome types
export interface PromptDomePanelData {
  todayTotal: number
  blockCount: number
  warnCount: number
  allowCount: number
  topCategories: { category: string; count: number }[]
  recentScans: {
    id: string
    createdAt: string
    recommendation: string
    textPreview: string
    score: number
  }[]
  customerCount: number
}

// Agent types
export interface AgentRun {
  jobId: string
  jobName: string
  status: string
  runAtMs: number
  durationMs: number
  model: string | null
  usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null
  costUsd: number
  summary: string | null
  agentName: string
  agentEmoji: string
}

export interface AgentPanelData {
  runs: AgentRun[]
  activeSessions: number
}

// Security types
export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertSource = 'phishing' | 'promptdome' | 'cron'

export interface SecurityAlert {
  id: string
  severity: AlertSeverity
  title: string
  source: AlertSource
  sourceLabel: string
  time: string
  timeMs: number
  detail?: string
  link?: string
}

export interface SecurityPanelData {
  alerts: SecurityAlert[]
  criticalCount: number
  warningCount: number
  infoCount: number
}
