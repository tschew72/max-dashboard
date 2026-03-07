'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, Clock, BookOpen, Zap, Radio, Download, ChevronLeft, ChevronRight } from 'lucide-react'

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
const PAGE_SIZE = 20

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

function SkeletonList() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} />)}
    </>
  )
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [page, setPage] = useState(1)
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

  const filtered = useMemo(
    () => filter === 'all' ? events : events.filter(e => e.type === filter),
    [events, filter]
  )

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1) }, [filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginatedEvents = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Export functionality
  const exportData = (format: 'json' | 'csv') => {
    const data = filtered
    let blob: Blob
    let filename: string

    if (format === 'json') {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      filename = `activity-${filter}-${new Date().toISOString().slice(0, 10)}.json`
    } else {
      const headers = 'id,type,description,timestamp\n'
      const rows = data.map(e =>
        `"${e.id}","${e.type}","${e.description.replace(/"/g, '""')}","${e.timestamp}"`
      ).join('\n')
      blob = new Blob([headers + rows], { type: 'text/csv' })
      filename = `activity-${filter}-${new Date().toISOString().slice(0, 10)}.csv`
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

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
          <div className="flex items-center gap-3">
            {/* Export dropdown */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => exportData('json')}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                title="Export as JSON"
              >
                <Download size={11} /> JSON
              </button>
              <button
                onClick={() => exportData('csv')}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                title="Export as CSV"
              >
                <Download size={11} /> CSV
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: connected ? '#10b981' : 'var(--muted)' }} />
              <span className="text-xs" style={{ color: connected ? '#10b981' : 'var(--muted)' }}>
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
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
          <span className="flex-shrink-0 text-[11px] self-center ml-auto" style={{ color: 'var(--muted)' }}>
            {filtered.length} events
          </span>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1">
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
            <Radio size={32} className="mb-3" />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          paginatedEvents.map(event => <ActivityItem key={event.id} event={event} />)
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="sticky bottom-0 flex items-center justify-center gap-3 px-4 py-3"
          style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
