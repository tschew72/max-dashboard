'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, RefreshCw, Wifi, WifiOff, Cpu, HardDrive, CheckSquare, Briefcase, Brain, Zap } from 'lucide-react'

interface HealthData {
  gateway: { status: string; pid?: number }
  memory: { total: number; used: number; percent: number }
  disk: { total: string; used: string; percent: number }
  jobs: { total: number; errors: number; disabled: number }
  tasks: { BACKLOG: number; IN_PROGRESS: number; REVIEW: number; DONE: number }
  lastLearning: string | null
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded ${className}`} style={{ background: 'var(--border)' }} />
}

function ProgressBar({ value, max, color = 'var(--accent)' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--accent-light)' }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function minutesAgo(iso: string | null): string {
  if (!iso) return 'Unknown'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: '#6b7280',
  IN_PROGRESS: '#3b82f6',
  REVIEW: '#f59e0b',
  DONE: '#10b981',
}

export default function HomePage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  const fetchHealth = useCallback(async () => {
    try {
      const [healthRes, tasksRes] = await Promise.all([
        fetch('/api/system/health'),
        fetch('/api/tasks'),
      ])
      const health = await healthRes.json()
      const tasksData = await tasksRes.json()
      const taskCounts = { BACKLOG: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 }
      if (Array.isArray(tasksData)) {
        for (const t of tasksData) {
          if (t.status in taskCounts) taskCounts[t.status as keyof typeof taskCounts]++
        }
      }
      setData({ ...health, tasks: taskCounts })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchHealth()
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="text-lg font-bold text-white">Max</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="w-9 h-9 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--muted)' }}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleLogout}
            className="w-9 h-9 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--muted)' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 grid grid-cols-1 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>

        {/* Card 1: Gateway Status */}
        <Card title="Gateway Status" icon={<Wifi size={16} />}>
          {loading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: data?.gateway?.status === 'running' ? '#10b981' : '#ef4444' }}
              />
              <div>
                <p className="text-base font-semibold text-white capitalize">{data?.gateway?.status || 'Unknown'}</p>
                {data?.gateway?.pid && (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>PID: {data.gateway.pid}</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Card 2: Context Window */}
        <Card title="Context Window" icon={<Brain size={16} />}>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white font-medium">59k / 150k tokens</span>
              <span style={{ color: 'var(--muted)' }}>39%</span>
            </div>
            <ProgressBar value={59} max={150} />
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>⚠ Live data coming soon</p>
          </div>
        </Card>

        {/* Card 3: Jobs Health */}
        <Card title="Jobs Health" icon={<Briefcase size={16} />}>
          {loading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{data?.jobs?.total ?? 0}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>{data?.jobs?.errors ?? 0}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Errors</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: 'var(--muted)' }}>{data?.jobs?.disabled ?? 0}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Disabled</p>
              </div>
            </div>
          )}
        </Card>

        {/* Card 4: Tasks Overview */}
        <Card title="Tasks Overview" icon={<CheckSquare size={16} />}>
          {loading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="flex flex-col gap-1.5">
              {(['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const).map(status => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>{status.replace('_', ' ')}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{data?.tasks?.[status] ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Card 5: Server Stats */}
        <Card title="Server Stats" icon={<Cpu size={16} />}>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: 'var(--muted)' }}>RAM</span>
                  <span className="text-white font-medium">{data?.memory?.used ?? 0}MB / {data?.memory?.total ?? 0}MB ({data?.memory?.percent ?? 0}%)</span>
                </div>
                <ProgressBar
                  value={data?.memory?.percent ?? 0}
                  max={100}
                  color={(data?.memory?.percent ?? 0) > 80 ? '#ef4444' : 'var(--accent)'}
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: 'var(--muted)' }}>Disk</span>
                  <span className="text-white font-medium">{data?.disk?.used ?? 0} / {data?.disk?.total ?? 0} ({data?.disk?.percent ?? 0}%)</span>
                </div>
                <ProgressBar
                  value={data?.disk?.percent ?? 0}
                  max={100}
                  color={(data?.disk?.percent ?? 0) > 80 ? '#ef4444' : '#10b981'}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Card 6: Last Learning */}
        <Card title="Last Learning" icon={<Zap size={16} />}>
          {loading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <div>
              <p className="text-base font-semibold text-white">
                Last cycle: {minutesAgo(data?.lastLearning ?? null)}
              </p>
              {data?.lastLearning && (
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {new Date(data.lastLearning).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}
