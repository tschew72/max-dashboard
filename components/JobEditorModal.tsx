'use client'
import { useState } from 'react'
import { X, Clock, Terminal, Bot, Pencil, Trash2 } from 'lucide-react'

type ScheduleKind = 'interval' | 'cron' | 'once'
type PayloadKind = 'agentTurn' | 'systemEvent'
type SessionTarget = 'isolated' | 'main'

interface Job {
  id: string
  name: string
  schedule: string
  rawMessage?: string
  sessionTarget?: string
  delivery?: { mode?: string }
  enabled: boolean
}

interface FormState {
  name: string
  scheduleKind: ScheduleKind
  every: string
  cronExpr: string
  at: string
  payloadKind: PayloadKind
  message: string
  announce: boolean
  sessionTarget: SessionTarget
  enabled: boolean
}

const INTERVALS = [
  { label: '5 min', value: '5m' },
  { label: '15 min', value: '15m' },
  { label: '30 min', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '1 day', value: '24h' },
]

function detectScheduleKind(expr: string): { kind: ScheduleKind; every: string; cronExpr: string } {
  if (!expr || expr.includes('*') || expr.split(' ').length === 5) {
    return { kind: 'cron', every: '1h', cronExpr: expr || '0 9 * * *' }
  }
  return { kind: 'interval', every: '1h', cronExpr: expr }
}

function humanSchedule(form: FormState): string {
  if (form.scheduleKind === 'interval') {
    const match = form.every.match(/^(\d+)(s|m|h|d)$/)
    if (!match) return `Every ${form.every}`
    const n = parseInt(match[1])
    const unit = { s: 'second', m: 'minute', h: 'hour', d: 'day' }[match[2] as string] ?? match[2]
    return `Every ${n} ${unit}${n !== 1 ? 's' : ''}`
  }
  if (form.scheduleKind === 'cron') return `Cron: ${form.cronExpr || '—'}`
  if (form.scheduleKind === 'once') {
    if (!form.at) return '—'
    if (form.at.startsWith('+')) {
      const match = form.at.match(/^\+(\d+)(s|m|h|d)$/)
      if (match) {
        const n = parseInt(match[1])
        const unit = { s: 'second', m: 'minute', h: 'hour', d: 'day' }[match[2] as string] ?? match[2]
        return `Once, in ${n} ${unit}${n !== 1 ? 's' : ''}`
      }
    }
    try { return `Once at ${new Date(form.at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}` }
    catch { return `Once at ${form.at}` }
  }
  return '—'
}

export function JobEditorModal({
  job,
  onClose,
  onSaved,
}: {
  job: Job
  onClose: () => void
  onSaved?: () => void
}) {
  const { kind, every, cronExpr } = detectScheduleKind(job.schedule)

  const [form, setForm] = useState<FormState>({
    name: job.name,
    scheduleKind: kind,
    every,
    cronExpr,
    at: '',
    payloadKind: 'agentTurn',
    message: job.rawMessage ?? '',
    announce: job.delivery?.mode === 'announce',
    sessionTarget: (job.sessionTarget as SessionTarget) ?? 'isolated',
    enabled: job.enabled,
  })
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm(f => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.ok) {
        setSuccess(true)
        setTimeout(() => { onSaved?.(); onClose() }, 1200)
      } else {
        setError(data.error ?? 'Failed to save')
      }
    } catch (e) { setError(String(e)) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) { onSaved?.(); onClose() }
      else setError(data.error ?? 'Delete failed')
    } catch (e) { setError(String(e)) }
    finally { setDeleting(false) }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Pencil size={16} style={{ color: 'var(--accent-light)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>Edit Job</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
              {job.id.slice(0, 8)}
            </span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto px-5 py-4 space-y-5" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {success && (
            <div className="rounded-xl px-4 py-3 text-sm font-semibold text-center"
              style={{ background: '#36b37e22', color: '#57d9a3', border: '1px solid #36b37e44' }}>
              ✅ Saved!
            </div>
          )}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm"
              style={{ background: '#ff563022', color: '#ff8f73', border: '1px solid #ff563044' }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Job Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          {/* Schedule tabs */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Schedule</label>
            <div className="flex gap-1 p-0.5 rounded-xl mb-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              {(['interval', 'cron', 'once'] as ScheduleKind[]).map(kind => (
                <button key={kind} onClick={() => set('scheduleKind', kind)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold capitalize"
                  style={{
                    background: form.scheduleKind === kind ? 'var(--accent)' : 'transparent',
                    color: form.scheduleKind === kind ? '#fff' : 'var(--muted)',
                  }}>
                  {kind === 'interval' ? '⏱ Interval' : kind === 'cron' ? '📅 Cron' : '🎯 Once'}
                </button>
              ))}
            </div>

            {form.scheduleKind === 'interval' && (
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {INTERVALS.map(({ label, value }) => (
                    <button key={value} onClick={() => set('every', value)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{
                        background: form.every === value ? 'var(--accent)' : 'var(--bg)',
                        color: form.every === value ? '#fff' : 'var(--muted)',
                        border: `1px solid ${form.every === value ? 'transparent' : 'var(--border)'}`,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
                <input value={form.every} onChange={e => set('every', e.target.value)}
                  placeholder="e.g. 30m, 2h, 1d" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            )}

            {form.scheduleKind === 'cron' && (
              <div>
                <input value={form.cronExpr} onChange={e => set('cronExpr', e.target.value)}
                  placeholder="0 9 * * *" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { label: 'Daily 9am', value: '0 9 * * *' },
                    { label: 'Weekdays 9am', value: '0 9 * * 1-5' },
                    { label: 'Hourly', value: '0 * * * *' },
                    { label: 'Daily midnight', value: '0 0 * * *' },
                  ].map(({ label, value }) => (
                    <button key={value} onClick={() => set('cronExpr', value)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.scheduleKind === 'once' && (
              <input value={form.at} onChange={e => set('at', e.target.value)}
                placeholder="+20m or 2026-02-22T09:00:00"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            )}

            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'var(--accent)' + '15', border: '1px solid var(--accent)' + '33' }}>
              <Clock size={12} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
              <span className="text-xs font-medium" style={{ color: 'var(--accent-light)' }}>
                {humanSchedule(form)}
              </span>
            </div>
          </div>

          {/* Payload type */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Payload Type</label>
            <div className="flex gap-2 mb-3">
              {([
                { kind: 'agentTurn' as PayloadKind, label: 'Agent Message', icon: <Bot size={13} /> },
                { kind: 'systemEvent' as PayloadKind, label: 'System Event', icon: <Terminal size={13} /> },
              ]).map(({ kind, label, icon }) => (
                <button key={kind} onClick={() => set('payloadKind', kind)}
                  className="flex items-center gap-2 flex-1 py-2 px-3 rounded-xl text-xs font-semibold"
                  style={{
                    background: form.payloadKind === kind ? 'var(--accent)' + '22' : 'var(--bg)',
                    color: form.payloadKind === kind ? 'var(--accent-light)' : 'var(--muted)',
                    border: `1px solid ${form.payloadKind === kind ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                  {icon} {label}
                </button>
              ))}
            </div>
            <textarea value={form.message} onChange={e => set('message', e.target.value)}
              placeholder="Agent message or system event text"
              rows={5}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          {/* Session target */}
          {form.payloadKind === 'agentTurn' && (
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Session Target</label>
              <div className="flex gap-2">
                {(['isolated', 'main'] as SessionTarget[]).map(t => (
                  <button key={t} onClick={() => set('sessionTarget', t)}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold capitalize"
                    style={{
                      background: form.sessionTarget === t ? 'var(--accent)' + '22' : 'var(--bg)',
                      color: form.sessionTarget === t ? 'var(--accent-light)' : 'var(--muted)',
                      border: `1px solid ${form.sessionTarget === t ? 'var(--accent)' : 'var(--border)'}`,
                    }}>
                    {t === 'isolated' ? '🔒 Isolated' : '🌐 Main Session'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Announce */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Announce results</div>
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Post summary to Discord after each run</div>
            </div>
            <button onClick={() => set('announce', !form.announce)}
              className="w-12 h-6 rounded-full transition-colors relative"
              style={{ background: form.announce ? 'var(--accent)' : 'var(--border)' }}>
              <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow"
                style={{ left: form.announce ? '26px' : '2px' }} />
            </button>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Enabled</div>
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Job will run on schedule when enabled</div>
            </div>
            <button onClick={() => set('enabled', !form.enabled)}
              className="w-12 h-6 rounded-full transition-colors relative"
              style={{ background: form.enabled ? '#36b37e' : 'var(--border)' }}>
              <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow"
                style={{ left: form.enabled ? '26px' : '2px' }} />
            </button>
          </div>

          {/* Delete zone */}
          <div className="pt-2 border-t" style={{ borderColor: '#ff563033' }}>
            <button onClick={handleDelete} disabled={deleting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{
                background: confirmDelete ? '#ff563033' : 'transparent',
                color: '#ff8f73',
                border: '1px solid #ff563044',
              }}>
              <Trash2 size={14} />
              {deleting ? 'Deleting…' : confirmDelete ? '⚠️ Click again to confirm delete' : 'Delete Job'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={submitting || success}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {submitting ? <><span className="animate-spin">⚙️</span> Saving…</> : success ? '✅ Saved!' : <><Pencil size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}
