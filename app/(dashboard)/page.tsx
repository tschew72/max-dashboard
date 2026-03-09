'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  LogOut, RefreshCw, Plus, LayoutDashboard, AlertTriangle, Clock, Zap,
  Server, CheckCircle2, Circle, ChevronRight, ChevronDown, ChevronUp,
  ThumbsUp, ThumbsDown, BrainCircuit, Bot, Shield, Mail, Calendar,
  Activity, ServerOff, Search, X
} from 'lucide-react'
import Link from 'next/link'
import { useDashboardSSE } from '@/hooks/useDashboardSSE'
import SecurityAlertsWidget from '@/components/dashboard/SecurityAlertsWidget'
import GmailInboxPanel from '@/components/dashboard/GmailInboxPanel'
import PromptDomePanel from '@/components/dashboard/PromptDomePanel'
import InfraHealthPanel from '@/components/dashboard/InfraHealthPanel'
import AgentActivityPanel from '@/components/dashboard/AgentActivityPanel'
import ExamAlertBanner from '@/components/dashboard/ExamAlertBanner'
import { AGENT_MAP } from '@/lib/agents'
import SystemMetricsBar from '@/components/dashboard/SystemMetricsBar'
import TokenEconomyPanel from '@/components/dashboard/TokenEconomyPanel'
import ThoughtsFeed from '@/components/thoughts/ThoughtsFeed'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Task {
  id: string
  title: string
  status: string
  priority: string
  assignee: string
  label: string
  dueDate?: string
  _count?: { subtasks: number; comments: number }
}

interface HealthData {
  gateway: { status: string; pid?: number }
  memory: { total: number; used: number; percent: number }
  disk: { total: string; used: string; percent: number }
  jobs: { total: number; errors: number; disabled: number }
  lastLearning: string | null
  openclaw: { current: string; latest: string; upToDate: boolean } | null
}

interface Job {
  id: string
  name: string
  scheduleDesc: string
  nextRun: string | null
  lastStatus: string
  enabled: boolean
  source: string
  category: string
  consecutiveErrors?: number
  state?: { consecutiveErrors?: number }
}

interface KPIData {
  tasksInProgress: number
  agentRunsToday: number
  agentSuccessRate: number
  shieldScansToday: number
  shieldBlockCount: number
  unreadEmails: number
  cronErrors: number
}

interface ScanResult {
  recommendation: string
  score?: number
  findings?: Array<{ category: string; description: string }>
  findingsJson?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function greeting(): { text: string; emoji: string } {
  const h = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', hour12: false })
  const hour = parseInt(h)
  if (hour < 6) return { text: 'Working late', emoji: '🌙' }
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' }
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤' }
  if (hour < 21) return { text: 'Good evening', emoji: '🌆' }
  return { text: 'Good night', emoji: '🌙' }
}

function formatSgtTime(date: Date): string {
  return date.toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  })
}

const STATUS_CONFIG = {
  BACKLOG:     { color: 'var(--muted)', label: 'Backlog' },
  IN_PROGRESS: { color: '#0065ff', label: 'In Progress' },
  REVIEW:      { color: '#ff8b00', label: 'Review' },
  DONE:        { color: '#36b37e', label: 'Done' },
}

const PRIORITY_EMOJI: Record<string, string> = {
  URGENT: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢'
}

const LABEL_COLORS: Record<string, string> = {
  WORK: '#0052cc', PERSONAL: '#6554c0', CONSULTING: '#ff8b00',
  VAPT: '#bf2600', DEFENSEWATCH: '#00875a', REMINDER: '#0065ff',
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--border)' }} />
}

function DonutRing({ data }: { data: { value: number; color: string; label: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <svg viewBox="0 0 80 80" className="w-24 h-24">
        <circle cx="40" cy="40" r="30" fill="none" stroke="var(--border)" strokeWidth="10" />
      </svg>
    )
  }
  const radius = 30
  const circ = 2 * Math.PI * radius
  let offset = 0
  return (
    <svg viewBox="0 0 80 80" className="w-24 h-24" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--card)" strokeWidth="10" />
      {data.map((d, i) => {
        const pct = d.value / total
        const dash = circ * pct
        const gap = circ - dash
        const seg = (
          <circle key={i} cx="40" cy="40" r={radius} fill="none" stroke={d.color}
            strokeWidth="10" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset} />
        )
        offset += dash
        return seg
      })}
    </svg>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  )
}

function TaskRow({ task }: { task: Task }) {
  const due = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = due && due < new Date() && task.status !== 'DONE'
  const daysUntil = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null
  return (
    <Link href="/tasks">
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg active:bg-white/5"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: LABEL_COLORS[task.label] ?? 'var(--muted)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug truncate">{task.title}</p>
          {due && (
            <p className="text-[11px] mt-0.5" style={{ color: isOverdue ? '#ff8f73' : 'var(--muted)' }}>
              {isOverdue
                ? `⚠ ${Math.abs(daysUntil!)}d overdue`
                : daysUntil === 0 ? 'Due today'
                : daysUntil === 1 ? 'Due tomorrow'
                : `${daysUntil}d`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs">{PRIORITY_EMOJI[task.priority]}</span>
          <ChevronRight size={12} style={{ color: 'var(--border)' }} />
        </div>
      </div>
    </Link>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  icon, value, label, subtitle, isError, href,
}: {
  icon: React.ReactNode; value: number | string; label: string
  subtitle?: string; isError?: boolean; href: string
}) {
  return (
    <Link href={href}>
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl p-3 min-w-0 flex-1 transition-colors"
        style={{
          background: isError ? '#ff563015' : 'var(--card)',
          border: `1px solid ${isError ? '#ff563044' : 'var(--border)'}`,
        }}>
        <span style={{ color: isError ? '#ff8f73' : 'var(--muted)' }}>{icon}</span>
        <span className="text-xl font-bold" style={{ color: isError ? '#ff8f73' : 'var(--text)' }}>{value}</span>
        <span className="text-[10px] font-medium text-center leading-tight" style={{ color: 'var(--muted)' }}>{label}</span>
        {subtitle && (
          <span className="text-[10px] text-center leading-tight" style={{ color: isError ? '#ff8f73' : '#579dff' }}>{subtitle}</span>
        )}
      </div>
    </Link>
  )
}

// ─── Spawn Agent Modal ────────────────────────────────────────────────────────
function SpawnAgentModal({ onClose }: { onClose: () => void }) {
  const [agentId, setAgentId] = useState('')
  const [task, setTask] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const agents = Object.entries(AGENT_MAP).map(([key, val]) => ({
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    emoji: val.emoji,
  }))

  const handleSubmit = async () => {
    if (!agentId || !task.trim()) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/agents/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, task: task.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: 'Agent started. Watch Activity for updates.' })
        setTimeout(onClose, 2000)
      } else {
        setResult({ ok: false, message: data.error || 'Spawn failed.' })
      }
    } catch {
      setResult({ ok: false, message: 'Action failed. No changes were made.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Bot size={16} style={{ color: '#579dff' }} /> Spawn Agent
        </p>
        <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}>
          <X size={14} />
        </button>
      </div>
      <select
        value={agentId}
        onChange={(e) => setAgentId(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
      >
        <option value="">Select agent…</option>
        {agents.map(a => (
          <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
        ))}
      </select>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Describe the task…"
        rows={3}
        className="w-full rounded-lg px-3 py-2 text-sm resize-none"
        style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !agentId || !task.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
          style={{ background: '#0052cc', color: 'var(--text)' }}
        >
          {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
          {submitting ? 'Spawning…' : 'Spawn'}
        </button>
        {result && (
          <span className="text-xs" style={{ color: result.ok ? '#57d9a3' : '#ff8f73' }}>
            {result.message}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Shield Scan Panel ────────────────────────────────────────────────────────
function ShieldScanPanel({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)

  const handleScan = async () => {
    if (!text.trim()) return
    setScanning(true)
    setResult(null)
    try {
      const res = await fetch('/api/shield/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setResult(data)
      } else {
        setResult({ recommendation: 'error' })
      }
    } catch {
      setResult({ recommendation: 'error' })
    } finally {
      setScanning(false)
    }
  }

  const verdictColor: Record<string, string> = {
    allow: '#36b37e', warn: '#ff8b00', block: '#ff5630', error: 'var(--muted)',
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Shield size={16} style={{ color: '#ff5630' }} /> PromptDome Scan
        </p>
        <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}>
          <X size={14} />
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text to scan for prompt injection…"
        rows={3}
        className="w-full rounded-lg px-3 py-2 text-sm resize-none"
        style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleScan}
          disabled={scanning || !text.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
          style={{ background: '#ff563022', color: '#ff8f73', border: '1px solid #ff563044' }}
        >
          {scanning ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
        {result && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase"
            style={{
              background: `${verdictColor[result.recommendation] || 'var(--muted)'}22`,
              color: verdictColor[result.recommendation] || 'var(--muted)',
            }}
          >
            {result.recommendation}{result.score != null ? ` · ${(result.score * 100).toFixed(0)}%` : ''}
          </span>
        )}
      </div>
      {result && result.recommendation !== 'error' && result.findings && result.findings.length > 0 && (
        <div className="space-y-1 pt-1">
          {result.findings.map((f, i) => (
            <p key={i} className="text-xs" style={{ color: 'var(--muted)' }}>
              <span className="font-semibold" style={{ color: '#ff8b00' }}>{f.category}:</span> {f.description}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  // WI-083: Live Clock
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const [tasks, setTasks] = useState<Task[]>([])
  const [health, setHealth] = useState<HealthData | null>(null)
  const [kpi, setKPI] = useState<KPIData | null>(null)
  const [reviewTasks, setReviewTasks] = useState<Task[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [tasksLoading, setTasksLoading] = useState(true)
  const [healthLoading, setHealthLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [infraCollapsed, setInfraCollapsed] = useState(true) // collapsed by default on mobile
  const [showSpawnModal, setShowSpawnModal] = useState(false)
  const [showScanPanel, setShowScanPanel] = useState(false)
  const router = useRouter()

  // SSE refresh triggers
  const [sseRefresh, setSSERefresh] = useState<Record<string, number>>({
    gmail: 0, infra: 0, promptdome: 0, agents: 0, security: 0,
  })

  const { connected: sseConnected, subscribe } = useDashboardSSE()

  useEffect(() => {
    const unsubs = [
      subscribe('tasks', () => { fetchTasks(); fetchHealth() }),
      subscribe('health', () => fetchHealth()),
      subscribe('gmail', () => { setSSERefresh(p => ({ ...p, gmail: p.gmail + 1 })); fetchKPI() }),
      subscribe('infra', () => setSSERefresh(p => ({ ...p, infra: p.infra + 1 }))),
      subscribe('promptdome', () => { setSSERefresh(p => ({ ...p, promptdome: p.promptdome + 1 })); fetchKPI() }),
      subscribe('agents', () => { setSSERefresh(p => ({ ...p, agents: p.agents + 1 })); fetchKPI() }),
      subscribe('security', () => setSSERefresh(p => ({ ...p, security: p.security + 1 }))),
    ]
    return () => unsubs.forEach(u => u())
  }, [subscribe])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      const tasksRaw = res.ok ? await res.json() : []
      const allTasks: Task[] = Array.isArray(tasksRaw) ? tasksRaw : []
      setTasks(allTasks)
      setReviewTasks(allTasks.filter(t => t.status === 'REVIEW'))
    } catch (e) {
      console.error('Tasks fetch error:', e)
    } finally {
      setTasksLoading(false)
    }
  }, [])

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/system/health')
      if (res.ok) setHealth(await res.json())
    } catch (e) {
      console.error('Health fetch error:', e)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const fetchKPI = useCallback(async () => {
    try {
      const [agentsRes, promptdomeRes, gmailRes, jobsRes] = await Promise.allSettled([
        fetch('/api/agents'),
        fetch('/api/dashboard/promptdome'),
        fetch('/api/dashboard/gmail'),
        fetch('/api/jobs'),
      ])

      let agentRunsToday = 0
      let agentSuccessRate = 0
      if (agentsRes.status === 'fulfilled' && agentsRes.value.ok) {
        const data = await agentsRes.value.json()
        agentRunsToday = data.stats?.total ?? 0
        agentSuccessRate = agentRunsToday > 0 ? Math.round(((data.stats?.ok ?? 0) / agentRunsToday) * 100) : 0
      }

      let shieldScansToday = 0
      let shieldBlockCount = 0
      if (promptdomeRes.status === 'fulfilled' && promptdomeRes.value.ok) {
        const data = await promptdomeRes.value.json()
        shieldScansToday = data.todayTotal ?? 0
        shieldBlockCount = data.blockCount ?? 0
      }

      let unreadEmails = 0
      if (gmailRes.status === 'fulfilled' && gmailRes.value.ok) {
        const data = await gmailRes.value.json()
        unreadEmails = data.unreadCount ?? 0
      }

      let cronErrors = 0
      if (jobsRes.status === 'fulfilled' && jobsRes.value.ok) {
        const jobs: Job[] = await jobsRes.value.json()
        cronErrors = jobs.filter(j => (j.consecutiveErrors ?? j.state?.consecutiveErrors ?? 0) > 0).length
      }

      setKPI(prev => ({
        tasksInProgress: prev?.tasksInProgress ?? 0,
        agentRunsToday,
        agentSuccessRate,
        shieldScansToday,
        shieldBlockCount,
        unreadEmails,
        cronErrors,
      }))
    } catch (e) {
      console.error('KPI fetch error:', e)
    }
  }, [])

  // Update tasks-in-progress KPI when tasks change
  useEffect(() => {
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length
    setKPI(prev => prev ? { ...prev, tasksInProgress: inProgress } : null)
  }, [tasks])

  const refreshAll = useCallback(() => {
    setRefreshing(true)
    Promise.all([fetchTasks(), fetchHealth(), fetchKPI()]).finally(() => setRefreshing(false))
    setSSERefresh(p => ({
      gmail: p.gmail + 1, infra: p.infra + 1, promptdome: p.promptdome + 1,
      agents: p.agents + 1, security: p.security + 1,
    }))
  }, [fetchTasks, fetchHealth, fetchKPI])

  const approveTask = useCallback(async (id: string, approve: boolean) => {
    setApprovingId(id)
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: approve ? 'DONE' : 'BACKLOG' }),
      })
      setReviewTasks(prev => prev.filter(t => t.id !== id))
    } finally {
      setApprovingId(null)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    fetchTasks()
    fetchHealth()
    fetchKPI()
    // Check mobile for infra collapse default
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setInfraCollapsed(false)
    }
  }, [fetchTasks, fetchHealth, fetchKPI])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const loading = tasksLoading

  // ── Derived stats ────────────────────────────────────────────────────────
  const activeTasks  = tasks.filter(t => t.status !== 'DONE')
  const doneTasks    = tasks.filter(t => t.status === 'DONE')
  const donePct      = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0

  const upcomingTasks = tasks
    .filter(t => {
      if (!t.dueDate || t.status === 'DONE') return false
      const d = new Date(t.dueDate)
      return d >= now && d <= new Date(now.getTime() + 48 * 3600000)
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())

  const statusCounts = {
    BACKLOG: tasks.filter(t => t.status === 'BACKLOG').length,
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    REVIEW: tasks.filter(t => t.status === 'REVIEW').length,
    DONE: doneTasks.length,
  }

  const donutData = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    value: statusCounts[key as keyof typeof statusCounts],
    color: cfg.color,
    label: cfg.label,
  }))

  const { text: greet, emoji: greetEmoji } = mounted ? greeting() : { text: 'Hello', emoji: '👋' }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>

      {/* ── Header with Live Clock (WI-083) ── */}
      <div className="sticky top-0 z-40 px-4 pt-4 pb-3 flex items-start justify-between"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{greetEmoji} {greet}</p>
          <h1 className="text-xl font-bold text-white leading-tight flex items-center gap-2">
            Vince
            {sseConnected && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#3fb950', boxShadow: '0 0 6px #3fb950' }} title="Live" />
            )}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>{mounted ? formatSgtTime(now) : ''}</p>
            {health && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: health.gateway.status === 'running' ? '#36b37e' : '#ff5630' }} />
                <span className="text-[10px] font-medium" style={{ color: health.gateway.status === 'running' ? '#36b37e' : '#ff5630' }}>
                  Gateway: {health.gateway.status === 'running' ? 'online' : 'offline'}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <button onClick={refreshAll}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--card)', color: 'var(--muted)' }}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleLogout}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--card)', color: 'var(--muted)' }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── 0. System Metrics Bar (WI-103) ── */}
        <SystemMetricsBar />

        {/* ── 1. Security Alerts (conditional) ── */}
        <SecurityAlertsWidget onSSERefresh={sseRefresh.security} />

        {/* ── 2. Exam Countdown Banner ── */}
        <ExamAlertBanner />

        {/* ── 3. KPI Strip (WI-080) ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {!kpi ? (
            <>
              <Skeleton className="h-[88px] flex-1 min-w-[80px]" />
              <Skeleton className="h-[88px] flex-1 min-w-[80px]" />
              <Skeleton className="h-[88px] flex-1 min-w-[80px]" />
              <Skeleton className="h-[88px] flex-1 min-w-[80px]" />
              <Skeleton className="h-[88px] flex-1 min-w-[80px]" />
            </>
          ) : (
            <>
              <KPICard
                icon={<Activity size={16} />}
                value={kpi.tasksInProgress}
                label="In Progress"
                href="/tasks"
              />
              <KPICard
                icon={<Bot size={16} />}
                value={kpi.agentRunsToday}
                label="Agent Runs"
                subtitle={kpi.agentRunsToday > 0 ? `${kpi.agentSuccessRate}% ok` : undefined}
                href="/agents"
              />
              <KPICard
                icon={<Shield size={16} />}
                value={kpi.shieldScansToday}
                label="Scans"
                subtitle={kpi.shieldBlockCount > 0 ? `${kpi.shieldBlockCount} blocked` : undefined}
                isError={kpi.shieldBlockCount > 0}
                href="/security"
              />
              <KPICard
                icon={<Mail size={16} />}
                value={kpi.unreadEmails}
                label="Unread"
                href="/gmail"
              />
              <KPICard
                icon={<AlertTriangle size={16} />}
                value={kpi.cronErrors}
                label="Cron Errors"
                isError={kpi.cronErrors > 0}
                href="/jobs"
              />
            </>
          )}
        </div>

        {/* ── 4. Quick Actions (WI-081) ── */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Quick Actions</p>
          <div className="grid grid-cols-4 gap-2">
            <Link href="/tasks?new=1">
              <div className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center"
                style={{ background: '#0052cc', color: 'var(--text)' }}>
                <Plus size={18} />
                <span className="text-[11px] font-semibold leading-tight">New Task</span>
              </div>
            </Link>
            <button onClick={() => { setShowSpawnModal(!showSpawnModal); setShowScanPanel(false) }}>
              <div className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center"
                style={{ background: showSpawnModal ? '#0065ff22' : 'var(--border)', color: showSpawnModal ? '#579dff' : 'var(--text)', border: `1px solid ${showSpawnModal ? '#579dff44' : 'var(--border)'}` }}>
                <Bot size={18} />
                <span className="text-[11px] font-semibold leading-tight">Spawn Agent</span>
              </div>
            </button>
            <button onClick={() => { setShowScanPanel(!showScanPanel); setShowSpawnModal(false) }}>
              <div className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center"
                style={{ background: showScanPanel ? '#ff563015' : 'var(--border)', color: showScanPanel ? '#ff8f73' : 'var(--text)', border: `1px solid ${showScanPanel ? '#ff563044' : 'var(--border)'}` }}>
                <Shield size={18} />
                <span className="text-[11px] font-semibold leading-tight">Run Scan</span>
              </div>
            </button>
            <Link href="/calendar">
              <div className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center"
                style={{ background: 'var(--border)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                <Calendar size={18} />
                <span className="text-[11px] font-semibold leading-tight">Today</span>
              </div>
            </Link>
          </div>
          {showSpawnModal && (
            <div className="mt-3">
              <SpawnAgentModal onClose={() => setShowSpawnModal(false)} />
            </div>
          )}
          {showScanPanel && (
            <div className="mt-3">
              <ShieldScanPanel onClose={() => setShowScanPanel(false)} />
            </div>
          )}
        </div>

        {/* ── 5. Tasks (col-span-3) + Agent Activity (col-span-2) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Tasks Column */}
          <div className="lg:col-span-3 space-y-4">
            {/* Pending Approvals */}
            {!loading && reviewTasks.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid #6554c033' }}>
                <div className="px-4 pt-3 pb-2 flex items-center gap-2" style={{ background: '#6554c008' }}>
                  <ThumbsUp size={12} style={{ color: '#9f8fef' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider flex-1" style={{ color: '#9f8fef' }}>
                    Pending Approval — {reviewTasks.length}
                  </p>
                </div>
                <div className="px-3 pb-3 pt-2 space-y-2">
                  {reviewTasks.slice(0, 3).map(t => (
                    <div key={t.id} className="flex items-center gap-2 rounded-xl p-3"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate leading-snug">{t.title}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{t.assignee} · {t.label}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button disabled={approvingId === t.id} onClick={() => approveTask(t.id, true)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: '#36b37e22', color: '#57d9a3', border: '1px solid #36b37e44' }}>
                          <ThumbsUp size={11} /> Approve
                        </button>
                        <button disabled={approvingId === t.id} onClick={() => approveTask(t.id, false)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: '#ff563011', color: '#ff8f73', border: '1px solid #ff563033' }}>
                          <ThumbsDown size={11} /> Push back
                        </button>
                      </div>
                    </div>
                  ))}
                  {reviewTasks.length > 3 && (
                    <Link href="/tasks">
                      <p className="text-center text-xs py-1" style={{ color: 'var(--muted)' }}>View {reviewTasks.length - 3} more →</p>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Task Progress ring + breakdown */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Task Progress</p>
                <Link href="/tasks" className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: '#0052cc22', color: '#579dff' }}>
                  Open Board
                </Link>
              </div>
              {loading ? <Skeleton className="h-32" /> : (
                <div className="flex items-center gap-5">
                  <div className="relative flex-shrink-0">
                    <DonutRing data={donutData} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold text-white">{donePct}%</span>
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>done</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2.5">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                      const count = statusCounts[key as keyof typeof statusCounts]
                      const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: 'var(--muted)' }}>{cfg.label}</span>
                            <span className="font-semibold text-white">{count}</span>
                          </div>
                          <ProgressBar pct={pct} color={cfg.color} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Upcoming (next 48h) */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  <Clock size={10} className="inline mr-1" />Upcoming · 48h
                </p>
                {!loading && upcomingTasks.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: '#0052cc22', color: '#579dff' }}>{upcomingTasks.length}</span>
                )}
              </div>
              {loading ? (
                <div className="px-4 pb-3 space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : upcomingTasks.length === 0 ? (
                <div className="px-4 pb-4 pt-2 flex flex-col items-center gap-1" style={{ color: 'var(--muted)' }}>
                  <CheckCircle2 size={20} />
                  <p className="text-sm font-medium text-white">Nothing on the clock.</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>No tasks due in the next 48 hours. Rare. Enjoy it.</p>
                </div>
              ) : (
                <div className="px-1 pb-1">
                  {upcomingTasks.slice(0, 5).map(t => <TaskRow key={t.id} task={t} />)}
                  {upcomingTasks.length > 5 && (
                    <Link href="/tasks">
                      <p className="text-center text-xs py-2" style={{ color: 'var(--muted)' }}>
                        View {upcomingTasks.length - 5} more →
                      </p>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Agent Activity Column */}
          <div className="lg:col-span-2">
            <AgentActivityPanel onSSERefresh={sseRefresh.agents} />
          </div>
        </div>

        {/* ── 6. PromptDome + Gmail ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PromptDomePanel onSSERefresh={sseRefresh.promptdome} />
          <GmailInboxPanel onSSERefresh={sseRefresh.gmail} />
        </div>

        {/* ── 7. Token Economy + Live Thoughts (WI-100, WI-102) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TokenEconomyPanel />
          <ThoughtsFeed agent="main" maxLines={20} compact />
        </div>

        {/* ── 8. Infrastructure (collapsible) ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setInfraCollapsed(!infraCollapsed)}
            className="w-full px-4 py-3 flex items-center justify-between"
          >
            <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
              <Server size={12} /> Infrastructure
            </p>
            {infraCollapsed ? <ChevronDown size={14} style={{ color: 'var(--muted)' }} /> : <ChevronUp size={14} style={{ color: 'var(--muted)' }} />}
          </button>
          {!infraCollapsed && (
            <div className="px-4 pb-4 space-y-4">
              <InfraHealthPanel onSSERefresh={sseRefresh.infra} />

              {/* System Health */}
              <div className="space-y-3">
                {healthLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                  </div>
                ) : health ? (
                  <>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span style={{ color: 'var(--muted)' }}>RAM</span>
                        <span className="font-semibold text-white">
                          {health.memory.used}MB / {health.memory.total}MB
                          <span className="ml-1.5 font-normal" style={{ color: health.memory.percent > 80 ? '#ff8f73' : 'var(--muted)' }}>
                            ({health.memory.percent}%)
                          </span>
                        </span>
                      </div>
                      <ProgressBar pct={health.memory.percent} color={health.memory.percent > 80 ? '#ff5630' : '#0065ff'} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span style={{ color: 'var(--muted)' }}>Disk</span>
                        <span className="font-semibold text-white">
                          {health.disk.used} / {health.disk.total}
                          <span className="ml-1.5 font-normal" style={{ color: health.disk.percent > 80 ? '#ff8f73' : 'var(--muted)' }}>
                            ({health.disk.percent}%)
                          </span>
                        </span>
                      </div>
                      <ProgressBar pct={health.disk.percent} color={health.disk.percent > 80 ? '#ff5630' : '#36b37e'} />
                    </div>
                    {health.openclaw && (
                      <div className="rounded-xl p-3 flex items-center justify-between gap-3"
                        style={{
                          background: 'var(--bg)',
                          border: `1px solid ${health.openclaw.upToDate ? 'var(--border)' : '#ff8b0033'}`,
                        }}>
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">⚡</span>
                          <div>
                            <p className="text-xs font-semibold text-white">OpenClaw</p>
                            <p className="text-[11px] font-mono" style={{ color: '#579dff' }}>v{health.openclaw.current}</p>
                          </div>
                        </div>
                        {health.openclaw.upToDate ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: '#36b37e22', color: '#57d9a3' }}>
                            <CheckCircle2 size={10} /> Up to date
                          </span>
                        ) : (
                          <div className="text-right">
                            <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: '#ff8b0022', color: '#ff8b00' }}>
                              ↑ Update available
                            </span>
                            <p className="text-[10px] mt-1 font-mono" style={{ color: 'var(--muted)' }}>
                              latest: v{health.openclaw.latest}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-4" style={{ color: 'var(--muted)' }}>
                    <ServerOff size={20} />
                    <p className="text-sm font-medium text-white">Health check failed.</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Cannot reach the health endpoint. Check gateway status.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
