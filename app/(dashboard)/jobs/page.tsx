'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Pause, Zap, Search, X, Wrench, Play, Plus, Pencil, History, ChevronLeft, Loader2, AlertCircle, CheckCircle, Coins } from 'lucide-react'
import { JobCreatorModal } from '@/components/JobCreatorModal'
import { JobEditorModal } from '@/components/JobEditorModal'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string
  name: string
  description: string
  schedule: string
  scheduleDesc: string
  timezone: string
  lastRun: string | null
  nextRun: string | null
  lastDuration: string | null
  lastDurationMs: number
  errorCount: number
  lastStatus: string
  lastError?: string
  enabled: boolean
  source: 'openclaw' | 'cron'
  category: string
  status: 'ok' | 'error' | 'disabled'
  agentId?: string
  sessionTarget?: string
  rawCommand?: string
  rawMessage?: string
  delivery?: { mode?: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) {
    // Future (for nextRun)
    const abs = Math.abs(diff)
    const mins = Math.floor(abs / 60000)
    if (mins < 60) return `in ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `in ${hrs}h ${mins % 60}m`
    return `in ${Math.floor(hrs / 24)}d`
  }
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function absTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

const CATEGORY_ICONS: Record<string, string> = {
  Knowledge: '🧠', Infrastructure: '🖥', Integrations: '🔗',
  Business: '💼', Security: '🔒', Workspace: '📁', General: '⚙️',
}

const CATEGORY_COLORS: Record<string, string> = {
  Knowledge: '#6554c0', Infrastructure: '#0065ff', Integrations: '#00875a',
  Business: '#ff8b00', Security: '#bf2600', Workspace: '#626f86', General: '#3d4f61',
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ job }: { job: Job }) {
  if (!job.enabled) return (
    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: '#2c333a', color: '#626f86' }}>
      <Pause size={9} /> Disabled
    </span>
  )
  if (job.status === 'error') return (
    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: '#ff563022', color: '#ff8f73' }}>
      <XCircle size={9} /> {job.errorCount} error{job.errorCount !== 1 ? 's' : ''}
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: '#36b37e22', color: '#57d9a3' }}>
      <CheckCircle2 size={9} /> OK
    </span>
  )
}

// ─── Job card ─────────────────────────────────────────────────────────────────
// ─── Run History Panel ────────────────────────────────────────────────────────
interface RunEntry {
  ts: number
  action: string
  status: 'ok' | 'error' | 'running'
  error?: string
  summary?: string
  delivered?: boolean
  runAtMs?: number
  durationMs?: number
  model?: string
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number }
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function fmtTokens(n?: number): string {
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function RunHistoryPanel({ job, onClose }: { job: Job; onClose: () => void }) {
  const [runs, setRuns] = useState<RunEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/jobs/${job.id}/runs?limit=10`)
      .then(r => r.json())
      .then(d => { setRuns(d.runs || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [job.id])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#1d2125' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: '#22272b', borderBottom: '1px solid #2c333a' }}>
        <button onClick={onClose} style={{ color: '#626f86' }}><ChevronLeft size={22} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#626f86' }}>Run History</p>
          <p className="text-sm font-bold text-white truncate">{job.name}</p>
        </div>
        <History size={18} style={{ color: '#626f86' }} />
      </div>

      {/* Runs */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: '#626f86' }} />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: '#626f86' }}>No runs recorded yet</div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#2c333a' }}>
            {runs.map((run, i) => {
              const isOk = run.status === 'ok'
              const isExpanded = expanded === i
              const startMs = run.runAtMs ?? run.ts
              const endMs = run.ts

              return (
                <div key={i}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : i)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3"
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                      style={{ background: isOk ? '#36b37e22' : '#ff563022' }}>
                      {isOk
                        ? <CheckCircle size={14} style={{ color: '#57d9a3' }} />
                        : <AlertCircle size={14} style={{ color: '#ff8f73' }} />}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: isOk ? '#36b37e22' : '#ff563022', color: isOk ? '#57d9a3' : '#ff8f73' }}>
                          {isOk ? 'SUCCESS' : 'FAILED'}
                        </span>
                        <span className="text-[11px]" style={{ color: '#626f86' }}>
                          {new Date(endMs).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                      {run.error && !isOk && (
                        <p className="text-xs truncate" style={{ color: '#ff8f73' }}>{run.error.replace(/^Error:\s*/i, '')}</p>
                      )}
                      {isOk && run.summary && (
                        <p className="text-xs truncate" style={{ color: '#8c9bab' }}>{run.summary.slice(0, 100)}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {run.durationMs && (
                          <span className="text-[10px] flex items-center gap-1" style={{ color: '#626f86' }}>
                            <Clock size={9} />{fmtMs(run.durationMs)}
                          </span>
                        )}
                        {run.usage && (
                          <span className="text-[10px] flex items-center gap-1" style={{ color: '#626f86' }}>
                            <Coins size={9} />
                            {fmtTokens(run.usage.cache_read_input_tokens)} cached · {fmtTokens(run.usage.output_tokens)} out
                          </span>
                        )}
                        {run.model && (
                          <span className="text-[10px]" style={{ color: '#626f86' }}>{run.model.split('/').at(-1)}</span>
                        )}
                      </div>
                    </div>

                    <ChevronDown size={14} className="flex-shrink-0 mt-2 transition-transform"
                      style={{ color: '#626f86', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                  </button>

                  {/* Expanded summary */}
                  {isExpanded && (
                    <div className="px-4 pb-4 ml-11">
                      {run.error && !isOk && (
                        <div className="rounded-xl p-3 text-sm" style={{ background: '#ff563011', border: '1px solid #ff563033', color: '#ff8f73' }}>
                          {run.error}
                        </div>
                      )}
                      {run.summary && (
                        <div className="rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap"
                          style={{ background: '#22272b', border: '1px solid #2c333a', color: '#b6c2cf', maxHeight: '300px', overflow: 'auto' }}>
                          {run.summary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function JobCard({ job, onHealed, onEdit }: { job: Job; onHealed: () => void; onEdit: (job: Job) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [healing, setHealing] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [healResult, setHealResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showRuns, setShowRuns] = useState(false)

  const handleHeal = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setHealing(true)
    setHealResult(null)
    try {
      const res = await fetch(`/api/jobs/${job.id}/heal`, { method: 'POST' })
      const data = await res.json()
      setHealResult({ ok: data.ok, msg: data.ok ? `Cleared ${data.prevErrors} error${data.prevErrors !== 1 ? 's' : ''}, re-run triggered` : data.error })
      if (data.ok) setTimeout(onHealed, 1500)
    } catch (e) {
      setHealResult({ ok: false, msg: String(e) })
    } finally {
      setHealing(false)
    }
  }

  const handleTrigger = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setTriggering(true)
    try {
      await fetch(`/api/jobs/${job.id}/trigger`, { method: 'POST' })
    } finally {
      setTriggering(false)
    }
  }

  const borderColor = job.status === 'error' ? '#ff5630' : job.status === 'disabled' ? '#2c333a' : '#2c333a'
  const leftBar = job.status === 'error' ? '#ff5630' : job.status === 'disabled' ? '#626f86' : '#36b37e'

  return (
    <>
    {showRuns && <RunHistoryPanel job={job} onClose={() => setShowRuns(false)} />}
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#22272b', border: `1px solid ${borderColor}`, borderLeft: `3px solid ${leftBar}` }}
    >
      {/* Main row */}
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Category icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-sm"
          style={{ background: (CATEGORY_COLORS[job.category] ?? '#3d4f61') + '22' }}>
          {CATEGORY_ICONS[job.category] ?? '⚙️'}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + badge */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-white leading-snug">{job.name}</p>
            <StatusBadge job={job} />
          </div>

          {/* Schedule */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded"
              style={{ background: '#1d2125', color: '#579dff' }}>
              {job.schedule}
            </span>
            <span className="text-xs" style={{ color: '#8c9bab' }}>→ {job.scheduleDesc}</span>
          </div>

          {/* Last / Next run row */}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {job.lastRun ? (
              <span className="text-[11px] flex items-center gap-1" style={{ color: '#626f86' }}>
                <Clock size={9} /> Last: <span className="text-white font-medium">{relTime(job.lastRun)}</span>
                {job.lastDuration && <span style={{ color: '#3d4f61' }}>· {job.lastDuration}</span>}
              </span>
            ) : (
              <span className="text-[11px]" style={{ color: '#3d4f61' }}>Never run</span>
            )}
            {job.nextRun && (
              <span className="text-[11px] flex items-center gap-1" style={{ color: '#626f86' }}>
                <Zap size={9} /> Next: <span style={{ color: '#57d9a3' }} className="font-medium">{relTime(job.nextRun)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <div className="flex-shrink-0 mt-1" style={{ color: '#3d4f61' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Error message — always visible when job is in error state */}
      {job.status === 'error' && job.lastError && (
        <div className="mx-4 mb-2 rounded-lg px-3 py-2.5 flex gap-2"
          style={{ background: '#ff563015', border: '1px solid #ff563040' }}>
          <XCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#ff8f73' }} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#ff5630' }}>Last Error</p>
            <p className="text-xs leading-relaxed break-words font-mono" style={{ color: '#ff8f73' }}>
              {job.lastError.replace(/^Error:\s*/i, '')}
            </p>
          </div>
        </div>
      )}

      {/* Action buttons row */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap"
        style={{ borderTop: expanded ? 'none' : '1px solid #2c333a11' }}>
        {job.status === 'error' && (
          <button
            onClick={handleHeal}
            disabled={healing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={{ background: '#ff563022', color: '#ff8f73', border: '1px solid #ff563044' }}
          >
            <Wrench size={12} className={healing ? 'animate-spin' : ''} />
            {healing ? 'Healing…' : '🩹 Auto-Heal'}
          </button>
        )}
        {job.source === 'openclaw' && (
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={{ background: '#0052cc22', color: '#579dff', border: '1px solid #0052cc44' }}
          >
            <Play size={11} className={triggering ? 'animate-pulse' : ''} />
            {triggering ? 'Running…' : 'Run Now'}
          </button>
        )}
        {job.source === 'openclaw' && (
          <button
            onClick={e => { e.stopPropagation(); onEdit(job) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: '#6554c022', color: '#a78bfa', border: '1px solid #6554c044' }}
          >
            <Pencil size={11} />
            Edit
          </button>
        )}
        {job.source === 'openclaw' && (
          <button
            onClick={e => { e.stopPropagation(); setShowRuns(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: '#22272b', color: '#626f86', border: '1px solid #3d4f61' }}
          >
            <History size={11} />
            Runs
          </button>
        )}
        {healResult && (
          <span className="text-[11px] font-medium px-2 py-1 rounded-lg"
            style={{ background: healResult.ok ? '#36b37e22' : '#ff563022', color: healResult.ok ? '#57d9a3' : '#ff8f73' }}>
            {healResult.ok ? '✅' : '❌'} {healResult.msg}
          </span>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t" style={{ borderColor: '#2c333a' }}>

          {/* Description */}
          {job.description && (
            <div className="pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#626f86' }}>Purpose</p>
              <p className="text-sm leading-relaxed" style={{ color: '#b6c2cf' }}>{job.description}</p>
            </div>
          )}

          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailCell label="Source" value={job.source === 'openclaw' ? '⚡ OpenClaw' : '🖥 System Cron'} />
            <DetailCell label="Category" value={`${CATEGORY_ICONS[job.category] ?? '⚙️'} ${job.category}`} />
            <DetailCell label="Timezone" value={job.timezone === 'Asia/Singapore' ? '🇸🇬 SGT' : job.timezone} />
            {job.agentId && <DetailCell label="Agent" value={`🤖 ${job.agentId}`} />}
            {job.sessionTarget && <DetailCell label="Session" value={job.sessionTarget} />}
            {job.lastRun && <DetailCell label="Last ran" value={absTime(job.lastRun)} />}
            {job.nextRun && <DetailCell label="Next run" value={absTime(job.nextRun)} />}
            {job.lastDuration && <DetailCell label="Duration" value={`⏱ ${job.lastDuration}`} />}
            {job.lastStatus && job.lastStatus !== '?' && (
              <DetailCell
                label="Last status"
                value={job.lastStatus === 'ok' ? '✅ OK' : `❌ ${job.lastStatus}`}
                color={job.lastStatus === 'ok' ? '#57d9a3' : '#ff8f73'}
              />
            )}
          </div>

          {/* Raw command for system cron */}
          {job.rawCommand && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#626f86' }}>Command</p>
              <code className="text-[11px] break-all rounded-lg px-3 py-2 block"
                style={{ background: '#161b20', color: '#579dff', fontFamily: 'monospace' }}>
                {job.rawCommand}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}

function DetailCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: '#1d2125' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#626f86' }}>{label}</p>
      <p className="text-xs font-medium truncate" style={{ color: color ?? '#b6c2cf' }}>{value}</p>
    </div>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────────
function SummaryBar({ jobs, loading }: { jobs: Job[]; loading: boolean }) {
  const total = jobs.length
  const errors = jobs.filter(j => j.status === 'error').length
  const disabled = jobs.filter(j => !j.enabled).length
  const ok = total - errors - disabled

  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto flex-shrink-0"
      style={{ background: '#1d2125', borderBottom: '1px solid #2c333a' }}>
      {loading ? (
        [1, 2, 3, 4].map(i => (
          <div key={i} className="h-8 w-20 rounded-xl animate-pulse flex-shrink-0" style={{ background: '#22272b' }} />
        ))
      ) : (
        <>
          <Chip label="Total" value={total} color="#b6c2cf" />
          <Chip label="Active" value={ok} color="#57d9a3" bg="#36b37e18" />
          {errors > 0 && <Chip label="Errors" value={errors} color="#ff8f73" bg="#ff563018" />}
          {disabled > 0 && <Chip label="Disabled" value={disabled} color="#626f86" />}
        </>
      )}
    </div>
  )
}

function Chip({ label, value, color, bg }: { label: string; value: number; color: string; bg?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
      style={{ background: bg ?? '#22272b', border: '1px solid #2c333a' }}>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
      <span className="text-[11px]" style={{ color: '#626f86' }}>{label}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Knowledge', 'Infrastructure', 'Integrations', 'Business', 'Security', 'Workspace', 'General']
const SOURCES = ['All', 'OpenClaw', 'Cron']
const STATUS_FILTERS = ['All', 'OK', 'Error', 'Disabled']

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [healingAll, setHealingAll] = useState(false)
  const [healAllResult, setHealAllResult] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showCreator, setShowCreator] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      const data = await res.json()
      setJobs(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  const handleHealAll = async () => {
    setHealingAll(true)
    setHealAllResult(null)
    try {
      const res = await fetch('/api/jobs/heal-all', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setHealAllResult(data.healed === 0 ? 'No errors to heal' : `✅ Healed ${data.healed} job${data.healed !== 1 ? 's' : ''} — re-runs triggered`)
        setTimeout(fetchJobs, 2000)
      } else {
        setHealAllResult(`❌ ${data.error}`)
      }
    } catch (e) {
      setHealAllResult(`❌ ${String(e)}`)
    } finally {
      setHealingAll(false)
    }
  }

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (search && !j.name.toLowerCase().includes(search.toLowerCase()) &&
          !j.description.toLowerCase().includes(search.toLowerCase())) return false
      if (catFilter !== 'All' && j.category !== catFilter) return false
      if (statusFilter === 'OK' && j.status !== 'ok') return false
      if (statusFilter === 'Error' && j.status !== 'error') return false
      if (statusFilter === 'Disabled' && j.enabled) return false
      return true
    })
  }, [jobs, search, catFilter, statusFilter])

  // Group by category within filtered results
  const grouped = useMemo(() => {
    // Errors first, then by category
    const errorJobs = filtered.filter(j => j.status === 'error')
    const rest = filtered.filter(j => j.status !== 'error')

    const byCategory: Record<string, Job[]> = {}
    for (const j of rest) {
      if (!byCategory[j.category]) byCategory[j.category] = []
      byCategory[j.category].push(j)
    }

    return { errorJobs, byCategory }
  }, [filtered])

  const hasErrors = jobs.some(j => j.status === 'error')

  return (
    <div className="h-screen flex flex-col" style={{ background: '#1d2125' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 px-4 py-3 flex flex-col gap-2 flex-shrink-0"
        style={{ background: '#1d2125', borderBottom: '1px solid #2c333a' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-white flex-1">⚙️ Jobs</h1>
          <button
            onClick={() => setShowCreator(true)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold"
            style={{ background: '#7c3aed22', color: '#a78bfa', border: '1px solid #7c3aed44' }}
          >
            <Plus size={13} /> New Job
          </button>
          {hasErrors && (
            <button
              onClick={handleHealAll}
              disabled={healingAll}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold disabled:opacity-60"
              style={{ background: '#ff563022', color: '#ff8f73', border: '1px solid #ff563044' }}
            >
              <Wrench size={12} className={healingAll ? 'animate-spin' : ''} />
              {healingAll ? 'Healing…' : `🩹 Heal All (${jobs.filter(j => j.status === 'error').length})`}
            </button>
          )}
          <button onClick={() => { setRefreshing(true); fetchJobs() }}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: '#22272b', color: '#8c9bab' }}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        {healAllResult && (
          <div className="text-xs font-medium px-3 py-2 rounded-lg"
            style={{ background: healAllResult.startsWith('✅') ? '#36b37e22' : '#ff563022', color: healAllResult.startsWith('✅') ? '#57d9a3' : '#ff8f73' }}>
            {healAllResult}
          </div>
        )}
      </div>

      {/* ── Summary chips ── */}
      <SummaryBar jobs={jobs} loading={loading} />

      {/* ── Search + filters ── */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0"
        style={{ background: '#1d2125', borderBottom: '1px solid #2c333a' }}>
        {/* Search */}
        <div className="flex items-center gap-1.5 flex-shrink-0 rounded-full px-3 py-1.5"
          style={{ background: '#22272b', border: '1px solid #2c333a', minWidth: 130 }}>
          <Search size={11} style={{ color: '#626f86' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs..."
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#b6c2cf', fontSize: '12px', width: '100%' }} />
          {search && <button onClick={() => setSearch('')} style={{ color: '#626f86' }}><X size={10} /></button>}
        </div>

        {/* Status filter */}
        {STATUS_FILTERS.map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
            style={{
              background: statusFilter === f ? '#0052cc' : '#22272b',
              color: statusFilter === f ? '#fff' : '#8c9bab',
              border: `1px solid ${statusFilter === f ? '#0052cc' : '#2c333a'}`,
            }}>
            {f === 'Error' ? '❌' : f === 'Disabled' ? '⏸' : f === 'OK' ? '✅' : ''} {f}
          </button>
        ))}
      </div>

      {/* ── Category filter row ── */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0"
        style={{ borderBottom: '1px solid #2c333a' }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
            style={{
              background: catFilter === c ? (CATEGORY_COLORS[c] ?? '#0052cc') + 'dd' : '#22272b',
              color: catFilter === c ? '#fff' : '#8c9bab',
              border: `1px solid ${catFilter === c ? 'transparent' : '#2c333a'}`,
            }}>
            {c !== 'All' && CATEGORY_ICONS[c]} {c}
          </button>
        ))}
      </div>

      {/* ── Job list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-xl h-24 animate-pulse" style={{ background: '#22272b' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm" style={{ color: '#626f86' }}>No jobs match your filters</p>
          </div>
        ) : (
          <>
            {/* Errors first */}
            {grouped.errorJobs.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
                  style={{ color: '#ff8f73' }}>
                  <XCircle size={12} /> Needs Attention ({grouped.errorJobs.length})
                </h2>
                <div className="space-y-2">
                  {grouped.errorJobs.map(j => <JobCard key={j.id} job={j} onHealed={fetchJobs} onEdit={setEditingJob} />)}
                </div>
              </section>
            )}

            {/* By category */}
            {Object.entries(grouped.byCategory).map(([cat, catJobs]) => (
              <section key={cat}>
                <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
                  style={{ color: CATEGORY_COLORS[cat] ?? '#626f86' }}>
                  {CATEGORY_ICONS[cat]} {cat}
                  <span className="font-bold px-1.5 py-0.5 rounded-full text-[10px]"
                    style={{ background: '#22272b', color: '#626f86' }}>{catJobs.length}</span>
                </h2>
                <div className="space-y-2">
                  {catJobs.map(j => <JobCard key={j.id} job={j} onHealed={fetchJobs} onEdit={setEditingJob} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {/* Job creator modal */}
      {showCreator && (
        <JobCreatorModal
          onClose={() => setShowCreator(false)}
          onCreated={() => { setShowCreator(false); setTimeout(fetchJobs, 500) }}
        />
      )}

      {/* Job editor modal */}
      {editingJob && (
        <JobEditorModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSaved={() => { setEditingJob(null); setTimeout(fetchJobs, 500) }}
        />
      )}
    </div>
  )
}
