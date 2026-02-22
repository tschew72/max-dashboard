'use client'
import { useEffect, useState, useCallback } from 'react'
import { Play, RefreshCw, AlertCircle, CheckCircle, Circle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Job {
  id: string
  name: string
  schedule: string
  scheduleDesc: string
  lastRun?: string
  nextRun?: string
  errorCount: number
  enabled: boolean
  source: 'openclaw' | 'cron'
  status: 'ok' | 'error' | 'disabled'
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
      style={{ background: checked ? 'var(--accent)' : 'var(--border)' }}
    >
      <div
        className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ left: checked ? '1.25rem' : '0.25rem' }}
      />
    </button>
  )
}

function JobCard({ job, onTrigger, onToggle }: {
  job: Job
  onTrigger: () => void
  onToggle: (enabled: boolean) => void
}) {
  const statusColor = job.status === 'error' ? '#ef4444' : job.status === 'disabled' ? 'var(--muted)' : '#10b981'
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderLeft: job.status === 'error' ? '4px solid #ef4444' : '1px solid var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} />
            <p className="text-sm font-semibold text-white truncate">{job.name}</p>
            {job.errorCount > 0 && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#ef444422', color: '#ef4444' }}>
                {job.errorCount} err
              </span>
            )}
          </div>
          <p className="text-xs mb-2 font-mono" style={{ color: 'var(--accent-light)' }}>{job.scheduleDesc || job.schedule}</p>
          <div className="flex gap-4 text-xs" style={{ color: 'var(--muted)' }}>
            {job.lastRun && (
              <span>Last: {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}</span>
            )}
            {job.nextRun && (
              <span>Next: {formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {job.source === 'openclaw' && (
            <ToggleSwitch checked={job.enabled} onChange={onToggle} />
          )}
          <button
            onClick={onTrigger}
            className="w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--accent-light)' }}
          >
            <Play size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--card)' }}>
      <div className="h-4 w-48 rounded mb-2" style={{ background: 'var(--border)' }} />
      <div className="h-3 w-32 rounded mb-3" style={{ background: 'var(--border)' }} />
      <div className="h-3 w-full rounded" style={{ background: 'var(--border)' }} />
    </div>
  )
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [triggering, setTriggering] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      const data = await res.json()
      setJobs(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchJobs()
  }

  const handleTrigger = async (job: Job) => {
    setTriggering(job.id)
    try {
      await fetch(`/api/jobs/${job.id}/trigger`, { method: 'POST' })
    } catch (e) {
      console.error(e)
    } finally {
      setTriggering(null)
    }
  }

  const handleToggle = async (job: Job, enabled: boolean) => {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, enabled } : j))
    // In a real implementation, call an API to update
  }

  const openClawJobs = jobs.filter(j => j.source === 'openclaw')
  const cronJobs = jobs.filter(j => j.source === 'cron')

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-lg font-bold text-white">⚙️ Jobs</h1>
        <button
          onClick={handleRefresh}
          className="w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ color: 'var(--muted)' }}
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* OpenClaw Jobs */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            OpenClaw Jobs ({loading ? '…' : openClawJobs.length})
          </h2>
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} />)
            ) : openClawJobs.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No OpenClaw jobs configured</p>
            ) : (
              openClawJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={{ ...job, id: triggering === job.id ? job.id : job.id }}
                  onTrigger={() => handleTrigger(job)}
                  onToggle={(enabled) => handleToggle(job, enabled)}
                />
              ))
            )}
          </div>
        </section>

        {/* System Cron */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            System Cron ({loading ? '…' : cronJobs.length})
          </h2>
          <div className="space-y-3">
            {loading ? (
              [1, 2].map(i => <Skeleton key={i} />)
            ) : cronJobs.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No system cron jobs</p>
            ) : (
              cronJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onTrigger={() => handleTrigger(job)}
                  onToggle={(enabled) => handleToggle(job, enabled)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
