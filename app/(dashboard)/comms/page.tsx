'use client'
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Brain, RefreshCw, Plus, Power, Eye, Zap, X,
  MessageSquare, Bell, CheckCheck, Clock
} from 'lucide-react'

interface Mention {
  id: string
  sender: string
  chat: string
  message: string
  timestamp: string
  response_status?: string
}

interface QuickAction {
  label: string
  icon: React.ReactNode
  color: string
  action: () => void
  confirm?: boolean
}

function MentionCard({ mention, onDone, onSnooze }: {
  mention: Mention
  onDone: () => void
  onSnooze: () => void
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)22' }}>
            <MessageSquare size={14} style={{ color: 'var(--accent-light)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{mention.sender}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{mention.chat}</p>
          </div>
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {formatDistanceToNow(new Date(mention.timestamp), { addSuffix: true })}
        </span>
      </div>
      <p className="text-sm mb-3 line-clamp-3" style={{ color: 'var(--text)' }}>{mention.message}</p>
      <div className="flex gap-2">
        <button
          onClick={onSnooze}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          <Clock size={12} />
          Snooze
        </button>
        <button
          onClick={onDone}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          <CheckCheck size={12} />
          Done
        </button>
      </div>
    </div>
  )
}

function ConfirmSheet({ open, onClose, onConfirm, message }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  message: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative rounded-t-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Confirm Action</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={20} /></button>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-xl text-sm font-medium"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="flex-1 h-12 rounded-xl text-sm font-semibold"
            style={{ background: '#ef4444', color: 'white' }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CommsPage() {
  const [tab, setTab] = useState<'mentions' | 'actions'>('mentions')
  const [mentions, setMentions] = useState<Mention[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ label: string; fn: () => void } | null>(null)
  const [actionStatus, setActionStatus] = useState<Record<string, 'loading' | 'done' | null>>({})

  useEffect(() => {
    fetch('/api/comms/mentions')
      .then(r => r.json())
      .then(data => setMentions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDone = async (id: string) => {
    try {
      await fetch(`/api/comms/mentions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_status: 'resolved' }),
      })
      setMentions(prev => prev.filter(m => m.id !== id))
    } catch (e) { console.error(e) }
  }

  const handleSnooze = async (id: string) => {
    const snoozeUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    try {
      await fetch(`/api/comms/mentions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snooze_until: snoozeUntil }),
      })
      setMentions(prev => prev.filter(m => m.id !== id))
    } catch (e) { console.error(e) }
  }

  const runAction = async (key: string, endpoint: string, method = 'POST') => {
    setActionStatus(prev => ({ ...prev, [key]: 'loading' }))
    try {
      await fetch(endpoint, { method })
      setActionStatus(prev => ({ ...prev, [key]: 'done' }))
      setTimeout(() => setActionStatus(prev => ({ ...prev, [key]: null })), 2000)
    } catch (e) {
      setActionStatus(prev => ({ ...prev, [key]: null }))
    }
  }

  const quickActions = [
    {
      key: 'learning',
      label: 'Run Learning\nCycle',
      icon: <Brain size={24} />,
      color: '#10b981',
      action: () => runAction('learning', '/api/actions/learning'),
    },
    {
      key: 'buttons',
      label: 'Refresh\nButtons',
      icon: <RefreshCw size={24} />,
      color: '#3b82f6',
      action: () => runAction('buttons', '/api/actions/refresh-buttons'),
    },
    {
      key: 'task',
      label: 'New Task',
      icon: <Plus size={24} />,
      color: '#a78bfa',
      action: () => { window.location.href = '/tasks' },
    },
    {
      key: 'gateway',
      label: 'Restart\nGateway',
      icon: <Power size={24} />,
      color: '#ef4444',
      action: () => setConfirmAction({
        label: 'Restart Gateway',
        fn: () => runAction('gateway', '/api/actions/restart-gateway'),
      }),
    },
    {
      key: 'memory',
      label: 'View Memory',
      icon: <Eye size={24} />,
      color: '#f59e0b',
      action: () => runAction('memory', '/api/actions/view-memory'),
    },
    {
      key: 'briefing',
      label: 'Run Briefing',
      icon: <Zap size={24} />,
      color: '#06b6d4',
      action: () => runAction('briefing', '/api/actions/briefing'),
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-white">💬 Comms</h1>
          {tab === 'mentions' && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent)22', color: 'var(--accent-light)' }}
            >
              {mentions.length} pending
            </span>
          )}
        </div>
        {/* Tabs */}
        <div className="flex px-4 pb-0">
          {(['mentions', 'actions'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-sm font-medium transition-colors border-b-2"
              style={{
                color: tab === t ? 'var(--accent-light)' : 'var(--muted)',
                borderColor: tab === t ? 'var(--accent-light)' : 'transparent',
              }}
            >
              {t === 'mentions' ? 'Mentions' : 'Quick Actions'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {tab === 'mentions' ? (
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="rounded-xl p-4 h-28 animate-pulse" style={{ background: 'var(--card)' }} />
              ))
            ) : mentions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--muted)' }}>
                <Bell size={32} className="mb-3" />
                <p className="text-sm">No pending mentions</p>
              </div>
            ) : (
              mentions.map(m => (
                <MentionCard
                  key={m.id}
                  mention={m}
                  onDone={() => handleDone(m.id)}
                  onSnooze={() => handleSnooze(m.id)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(action => {
              const status = actionStatus[action.key]
              return (
                <button
                  key={action.key}
                  onClick={action.action}
                  disabled={status === 'loading'}
                  className="rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                  style={{
                    height: 80,
                    background: 'var(--card)',
                    border: `1px solid ${status === 'done' ? action.color + '66' : 'var(--border)'}`,
                  }}
                >
                  <div style={{ color: status === 'done' ? '#10b981' : action.color }}>
                    {status === 'loading' ? <RefreshCw size={24} className="animate-spin" /> : action.icon}
                  </div>
                  <span className="text-xs font-medium text-center leading-tight whitespace-pre-line text-white">
                    {action.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirm Sheet */}
      <ConfirmSheet
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.fn || (() => {})}
        message={`Are you sure you want to ${confirmAction?.label?.toLowerCase()}? This may cause brief interruption.`}
      />
    </div>
  )
}
