'use client'
import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, Clock, BookOpen, Zap, Radio } from 'lucide-react'

interface ActivityEvent {
  id: string
  type: 'error' | 'cron' | 'learning' | 'info'
  description: string
  timestamp: string
  raw?: string
}

const TYPE_CONFIG = {
  error: { icon: AlertCircle, color: '#ef4444', label: 'Error' },
  cron: { icon: Clock, color: '#3b82f6', label: 'Cron' },
  learning: { icon: BookOpen, color: '#10b981', label: 'Learning' },
  info: { icon: Zap, color: '#a78bfa', label: 'Info' },
}

type Filter = 'all' | 'error' | 'cron' | 'learning'

function ActivityItem({ event }: { event: ActivityEvent }) {
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.info
  const Icon = cfg.icon
  return (
    <div className="flex gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ background: `${cfg.color}22` }}>
        <Icon size={14} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: `${cfg.color}22`, color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-white leading-snug break-words">{event.description}</p>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="w-8 h-8 rounded-full animate-pulse flex-shrink-0" style={{ background: 'var(--border)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'var(--border)' }} />
        <div className="h-4 w-full rounded animate-pulse" style={{ background: 'var(--border)' }} />
      </div>
    </div>
  )
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Load initial events
    fetch('/api/activity')
      .then(r => r.json())
      .then((data: ActivityEvent[]) => {
        setEvents(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // SSE for live updates
    const es = new EventSource('/api/activity/stream')
    esRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.onmessage = (e) => {
      try {
        const newEvents: ActivityEvent[] = JSON.parse(e.data)
        if (newEvents.length > 0) {
          setEvents(prev => [...newEvents, ...prev].slice(0, 200))
        }
      } catch {
        // ignore
      }
    }

    return () => {
      es.close()
      setConnected(false)
    }
  }, [])

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter)

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'error', label: 'Errors' },
    { id: 'cron', label: 'Cron' },
    { id: 'learning', label: 'Learning' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-white">📡 Activity</h1>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: connected ? '#10b981' : 'var(--muted)' }} />
            <span className="text-xs" style={{ color: connected ? '#10b981' : 'var(--muted)' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
        {/* Filter chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: filter === f.id ? 'var(--accent)' : 'var(--card)',
                color: filter === f.id ? 'white' : 'var(--muted)',
                border: `1px solid ${filter === f.id ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1">
        {loading ? (
          [1, 2, 3, 4, 5].map(i => <Skeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
            <Radio size={32} className="mb-3" />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          filtered.map(event => <ActivityItem key={event.id} event={event} />)
        )}
      </div>
    </div>
  )
}
