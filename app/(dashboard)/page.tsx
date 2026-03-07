'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, RefreshCw, Plus, LayoutDashboard, AlertTriangle, Clock, Zap, Server, CheckCircle2, Circle, ChevronRight, ThumbsUp, ThumbsDown, Timer, BrainCircuit, Bot } from 'lucide-react'
import Link from 'next/link'
import { useDashboardSSE } from '@/hooks/useDashboardSSE'
import SecurityAlertsWidget from '@/components/dashboard/SecurityAlertsWidget'
import GmailInboxPanel from '@/components/dashboard/GmailInboxPanel'
import PromptDomePanel from '@/components/dashboard/PromptDomePanel'
import InfraHealthPanel from '@/components/dashboard/InfraHealthPanel'
import AgentActivityPanel from '@/components/dashboard/AgentActivityPanel'

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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function greeting(): { text: string; emoji: string } {
  const h = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', hour12: false })
  const hour = parseInt(h)
  if (hour < 6) return { text: 'Working late', emoji: '🌙' }
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' }
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤' }
  if (hour < 21) return { text: 'Good evening', emoji: '🌆' }
  return { text: 'Good night', emoji: '🌙' }
}

function sgtTime(): string {
  return new Date().toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

const STATUS_CONFIG = {
  BACKLOG:     { color: '#626f86', label: 'Backlog' },
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
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: '#2c333a' }} />
}

function StatChip({
  icon, label, value, color = '#b6c2cf', bg = '#22272b',
}: {
  icon: React.ReactNode; label: string; value: string | number; color?: string; bg?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl p-3 flex-1" style={{ background: bg, border: '1px solid #2c333a' }}>
      <span style={{ color }}>{icon}</span>
      <span className="text-xl font-bold" style={{ color }}>{value}</span>
      <span className="text-[11px] font-medium text-center leading-tight" style={{ color: '#626f86' }}>{label}</span>
    </div>
  )
}

function DonutRing({ data }: { data: { value: number; color: string; label: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <svg viewBox="0 0 80 80" className="w-24 h-24">
        <circle cx="40" cy="40" r="30" fill="none" stroke="#2c333a" strokeWidth="10" />
      </svg>
    )
  }

  const radius = 30
  const circ = 2 * Math.PI * radius
  let offset = 0

  return (
    <svg viewBox="0 0 80 80" className="w-24 h-24" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="40" cy="40" r={radius} fill="none" stroke="#22272b" strokeWidth="10" />
      {data.map((d, i) => {
        const pct = d.value / total
        const dash = circ * pct
        const gap = circ - dash
        const seg = (
          <circle
            key={i}
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={d.color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
          />
        )
        offset += dash
        return seg
      })}
    </svg>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#2c333a' }}>
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
        style={{ borderBottom: '1px solid #2c333a20' }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: LABEL_COLORS[task.label] ?? '#626f86' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug truncate">{task.title}</p>
          {due && (
            <p className="text-[11px] mt-0.5" style={{ color: isOverdue ? '#ff8f73' : '#626f86' }}>
              {isOverdue
                ? `⚠ ${Math.abs(daysUntil!)}d overdue`
                : daysUntil === 0
                  ? '📅 Due today'
                  : daysUntil === 1
                    ? '📅 Due tomorrow'
                    : `📅 ${daysUntil}d`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs">{PRIORITY_EMOJI[task.priority]}</span>
          <ChevronRight size={12} style={{ color: '#3d4f61' }} />
        </div>
      </div>
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  // Core task + health data (loaded independently)
  const [tasks, setTasks] = useState<Task[]>([])
  const [health, setHealth] = useState<HealthData | null>(null)
  const [nextJob, setNextJob] = useState<Job | null>(null)
  const [reviewTasks, setReviewTasks] = useState<Task[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [tasksLoading, setTasksLoading] = useState(true)
  const [healthLoading, setHealthLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [time, setTime] = useState('')
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  // SSE refresh triggers — increment to trigger panel refetch
  const [sseRefresh, setSSERefresh] = useState<Record<string, number>>({
    gmail: 0, infra: 0, promptdome: 0, agents: 0, security: 0,
  })

  const { connected: sseConnected, subscribe } = useDashboardSSE()

  // Subscribe to SSE events to trigger panel refetches
  useEffect(() => {
    const unsubs = [
      subscribe('tasks', () => { fetchTasks(); fetchHealth() }),
      subscribe('health', () => fetchHealth()),
      subscribe('gmail', () => setSSERefresh(p => ({ ...p, gmail: p.gmail + 1 }))),
      subscribe('infra', () => setSSERefresh(p => ({ ...p, infra: p.infra + 1 }))),
      subscribe('promptdome', () => setSSERefresh(p => ({ ...p, promptdome: p.promptdome + 1 }))),
      subscribe('agents', () => setSSERefresh(p => ({ ...p, agents: p.agents + 1 }))),
      subscribe('security', () => setSSERefresh(p => ({ ...p, security: p.security + 1 }))),
    ]
    return () => unsubs.forEach(u => u())
  }, [subscribe])

  const fetchTasks = useCallback(async () => {
    try {
      const [tasksRes, jobsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/jobs'),
      ])
      const tasksRaw = tasksRes.ok ? await tasksRes.json() : []
      const allTasks: Task[] = Array.isArray(tasksRaw) ? tasksRaw : []
      setTasks(allTasks)
      setReviewTasks(allTasks.filter(t => t.status === 'REVIEW'))

      if (jobsRes.ok) {
        const jobs: Job[] = await jobsRes.json()
        const enabled = jobs.filter(j => j.enabled && j.nextRun && j.source === 'openclaw')
        enabled.sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime())
        setNextJob(enabled[0] ?? null)
      }
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

  const refreshAll = useCallback(() => {
    setRefreshing(true)
    Promise.all([fetchTasks(), fetchHealth()]).finally(() => setRefreshing(false))
    // Trigger all panel refetches
    setSSERefresh(p => ({
      gmail: p.gmail + 1,
      infra: p.infra + 1,
      promptdome: p.promptdome + 1,
      agents: p.agents + 1,
      security: p.security + 1,
    }))
  }, [fetchTasks, fetchHealth])

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
    setTime(sgtTime())
    // Independent data fetches — no blocking
    fetchTasks()
    fetchHealth()
    const clockInterval = setInterval(() => setTime(sgtTime()), 10000)
    return () => clearInterval(clockInterval)
  }, [fetchTasks, fetchHealth])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const now = new Date()
  const loading = tasksLoading

  // ── Derived stats ────────────────────────────────────────────────────────
  const activeTasks  = tasks.filter(t => t.status !== 'DONE')
  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE')
  const urgentTasks  = tasks.filter(t => t.priority === 'URGENT' && t.status !== 'DONE')
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
    <div className="min-h-screen pb-24" style={{ background: '#1d2125' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 px-4 pt-4 pb-3 flex items-start justify-between"
        style={{ background: '#1d2125', borderBottom: '1px solid #2c333a' }}>
        <div>
          <p className="text-xs font-medium" style={{ color: '#626f86' }}>{greetEmoji} {greet}</p>
          <h1 className="text-xl font-bold text-white leading-tight flex items-center gap-2">
              Vince
              {sseConnected && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#3fb950', boxShadow: '0 0 6px #3fb950' }} title="Live" />
              )}
            </h1>
          <p className="text-[11px] mt-0.5" style={{ color: '#626f86' }}>{time}</p>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <button onClick={refreshAll}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: '#22272b', color: '#8c9bab' }}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleLogout}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: '#22272b', color: '#8c9bab' }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Stat chips ── */}
        <div className="flex gap-3">
          {loading ? (
            <>
              <Skeleton className="h-20 flex-1" />
              <Skeleton className="h-20 flex-1" />
              <Skeleton className="h-20 flex-1" />
            </>
          ) : (
            <>
              <StatChip icon={<LayoutDashboard size={16} />} label="Active" value={activeTasks.length} />
              <StatChip
                icon={<AlertTriangle size={16} />} label="Overdue" value={overdueTasks.length}
                color={overdueTasks.length > 0 ? '#ff8f73' : '#626f86'}
                bg={overdueTasks.length > 0 ? '#ff563011' : '#22272b'}
              />
              <StatChip
                icon={<Zap size={16} />} label="Urgent" value={urgentTasks.length}
                color={urgentTasks.length > 0 ? '#ff8b00' : '#626f86'}
                bg={urgentTasks.length > 0 ? '#ff8b0011' : '#22272b'}
              />
            </>
          )}
        </div>

        {/* ── Security Alerts (conditional — top when alerts exist) ── */}
        <SecurityAlertsWidget onSSERefresh={sseRefresh.security} />

        {/* ── Gmail Inbox ── */}
        <GmailInboxPanel onSSERefresh={sseRefresh.gmail} />

        {/* ── Pending Approvals ── */}
        {!loading && reviewTasks.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#22272b', border: '1px solid #6554c033' }}>
            <div className="px-4 pt-3 pb-2 flex items-center gap-2" style={{ background: '#6554c008' }}>
              <ThumbsUp size={12} style={{ color: '#9f8fef' }} />
              <p className="text-xs font-semibold uppercase tracking-wider flex-1" style={{ color: '#9f8fef' }}>
                Pending Approval — {reviewTasks.length}
              </p>
            </div>
            <div className="px-3 pb-3 pt-2 space-y-2">
              {reviewTasks.slice(0, 3).map(t => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl p-3"
                  style={{ background: '#1d2125', border: '1px solid #2c333a' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate leading-snug">{t.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#626f86' }}>{t.assignee} · {t.label}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      disabled={approvingId === t.id}
                      onClick={() => approveTask(t.id, true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: '#36b37e22', color: '#57d9a3', border: '1px solid #36b37e44' }}>
                      <ThumbsUp size={11} /> Approve
                    </button>
                    <button
                      disabled={approvingId === t.id}
                      onClick={() => approveTask(t.id, false)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: '#ff563011', color: '#ff8f73', border: '1px solid #ff563033' }}>
                      <ThumbsDown size={11} /> Reject
                    </button>
                  </div>
                </div>
              ))}
              {reviewTasks.length > 3 && (
                <Link href="/tasks">
                  <p className="text-center text-xs py-1" style={{ color: '#626f86' }}>+{reviewTasks.length - 3} more</p>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── PromptDome Live Stats ── */}
        <PromptDomePanel onSSERefresh={sseRefresh.promptdome} />

        {/* ── Infrastructure Health ── */}
        <InfraHealthPanel onSSERefresh={sseRefresh.infra} />

        {/* ── Agent Activity Feed ── */}
        <AgentActivityPanel onSSERefresh={sseRefresh.agents} />

        {/* ── Task Progress ring + breakdown ── */}
        <div className="rounded-2xl p-4" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#626f86' }}>Task Progress</p>
            <Link href="/tasks" className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#0052cc22', color: '#579dff' }}>
              View board →
            </Link>
          </div>

          {loading ? <Skeleton className="h-32" /> : (
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <DonutRing data={donutData} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-white">{donePct}%</span>
                  <span className="text-[10px]" style={{ color: '#626f86' }}>done</span>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const count = statusCounts[key as keyof typeof statusCounts]
                  const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: '#8c9bab' }}>{cfg.label}</span>
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

        {/* ── Upcoming (next 48h) ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#626f86' }}>
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
            <div className="px-4 pb-4 pt-1 flex items-center gap-2" style={{ color: '#626f86' }}>
              <CheckCircle2 size={14} />
              <p className="text-sm">Nothing due in the next 48 hours 🎉</p>
            </div>
          ) : (
            <div className="px-1 pb-1">
              {upcomingTasks.slice(0, 5).map(t => <TaskRow key={t.id} task={t} />)}
              {upcomingTasks.length > 5 && (
                <Link href="/tasks">
                  <p className="text-center text-xs py-2" style={{ color: '#626f86' }}>
                    +{upcomingTasks.length - 5} more
                  </p>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div className="rounded-2xl p-4" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#626f86' }}>Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/tasks?new=1">
              <div className="flex items-center gap-2 rounded-xl px-3 py-3"
                style={{ background: '#0052cc', color: '#fff' }}>
                <Plus size={16} />
                <span className="text-sm font-semibold">New Task</span>
              </div>
            </Link>
            <Link href="/tasks">
              <div className="flex items-center gap-2 rounded-xl px-3 py-3"
                style={{ background: '#2c333a', color: '#b6c2cf', border: '1px solid #3d4f61' }}>
                <LayoutDashboard size={16} />
                <span className="text-sm font-semibold">View Board</span>
              </div>
            </Link>
            <Link href="/jobs">
              <div className="flex items-center gap-2 rounded-xl px-3 py-3"
                style={{ background: '#2c333a', color: '#b6c2cf', border: '1px solid #3d4f61' }}>
                <Zap size={16} />
                <span className="text-sm font-semibold">Cron Jobs</span>
              </div>
            </Link>
            <Link href="/brain">
              <div className="flex items-center gap-2 rounded-xl px-3 py-3"
                style={{ background: '#2c333a', color: '#b6c2cf', border: '1px solid #3d4f61' }}>
                <BrainCircuit size={16} />
                <span className="text-sm font-semibold">Brain</span>
              </div>
            </Link>
          </div>
        </div>

        {/* ── System Health ── */}
        <div className="rounded-2xl p-4 space-y-4" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#626f86' }}>
              <Server size={10} className="inline mr-1" />System Health
            </p>
            {health && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full"
                  style={{ background: health.gateway.status === 'running' ? '#36b37e' : '#ff5630' }} />
                <span className="text-[11px] font-medium capitalize"
                  style={{ color: health.gateway.status === 'running' ? '#36b37e' : '#ff5630' }}>
                  {health.gateway.status}
                </span>
              </div>
            )}
          </div>

          {healthLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : health ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: '#8c9bab' }}>RAM</span>
                  <span className="font-semibold text-white">
                    {health.memory.used}MB / {health.memory.total}MB
                    <span className="ml-1.5 font-normal" style={{ color: health.memory.percent > 80 ? '#ff8f73' : '#626f86' }}>
                      ({health.memory.percent}%)
                    </span>
                  </span>
                </div>
                <ProgressBar pct={health.memory.percent}
                  color={health.memory.percent > 80 ? '#ff5630' : '#0065ff'} />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: '#8c9bab' }}>Disk</span>
                  <span className="font-semibold text-white">
                    {health.disk.used} / {health.disk.total}
                    <span className="ml-1.5 font-normal" style={{ color: health.disk.percent > 80 ? '#ff8f73' : '#626f86' }}>
                      ({health.disk.percent}%)
                    </span>
                  </span>
                </div>
                <ProgressBar pct={health.disk.percent}
                  color={health.disk.percent > 80 ? '#ff5630' : '#36b37e'} />
              </div>
              <div className="flex gap-3 pt-1">
                <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#1d2125' }}>
                  <p className="text-lg font-bold text-white">{health.jobs.total}</p>
                  <p className="text-[11px]" style={{ color: '#626f86' }}>Jobs</p>
                  {health.jobs.errors > 0 && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#ff8f73' }}>{health.jobs.errors} error{health.jobs.errors !== 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#1d2125' }}>
                  <p className="text-sm font-bold text-white">{relTime(health.lastLearning)}</p>
                  <p className="text-[11px]" style={{ color: '#626f86' }}>Last cycle</p>
                </div>
                <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#1d2125' }}>
                  {health.gateway.status === 'running'
                    ? <CheckCircle2 size={18} className="mx-auto" style={{ color: '#36b37e' }} />
                    : <Circle size={18} className="mx-auto" style={{ color: '#ff5630' }} />
                  }
                  <p className="text-[11px] mt-1 capitalize" style={{ color: '#626f86' }}>Gateway</p>
                </div>
              </div>

              {health.openclaw && (
                <div className="rounded-xl p-3 flex items-center justify-between gap-3"
                  style={{
                    background: '#1d2125',
                    border: `1px solid ${health.openclaw.upToDate ? '#2c333a' : '#ff8b0033'}`,
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
                      <p className="text-[10px] mt-1 font-mono" style={{ color: '#626f86' }}>
                        latest: v{health.openclaw.latest}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#626f86' }}>Health data unavailable</p>
          )}
        </div>

      </div>
    </div>
  )
}
