'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Cpu, Zap, Activity,
  ChevronDown, ChevronUp, LayoutList, AlertTriangle, X,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Run {
  jobId: string
  jobName: string
  status: string
  summary: string | null
  error: string | null
  runAtMs: number
  durationMs: number
  model: string | null
  usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null
  sessionId: string | null
  costUsd: number
  timedOut: boolean
  delivered: boolean | null
}

interface Session {
  sessionId: string
  sessionKey: string   // full key e.g. agent:main:discord:channel:...
  label: string
  updatedAt: number
  model: string | null
  totalTokens: number
  contextTokens: number | null
  inputTokens: number
  outputTokens: number
}

interface SessionDetail {
  sessionKey: string
  totalMessages: number
  firstUserMessage: string | null
  lastAssistantMessage: string | null
  toolSummary: { name: string; count: number }[]
  recentMessages: {
    role: string
    timestamp: string
    text: string
    toolCalls: string[]
  }[]
}

function SessionDetailModal({ sessionKey, label, onClose }: {
  sessionKey: string
  label: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/agents/session?sessionKey=${encodeURIComponent(sessionKey)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setDetail)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [sessionKey])

  const roleColor = (role: string) =>
    role === 'user' ? '#388bfd' : role === 'assistant' ? '#3fb950' : '#626f86'
  const roleLabel = (role: string) =>
    role === 'user' ? '👤 User' : role === 'assistant' ? '🤖 Assistant' : '🔧 Tool'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 720, margin: '0 auto',
        background: '#0d1117', border: '1px solid #30363d',
        borderRadius: '16px 16px 0 0', padding: '20px 16px 32px',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 15 }}>{label}</div>
            <div style={{ color: '#626f86', fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>
              {sessionKey}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#21262d', border: '1px solid #30363d', color: '#8b949e',
            borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
          }}>✕ Close</button>
        </div>

        {loading && <div style={{ textAlign: 'center', color: '#626f86', padding: 40 }}>Loading session…</div>}
        {error && <div style={{ color: '#f85149', padding: 16 }}>Error: {error}</div>}

        {detail && (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '6px 12px', color: '#8b949e', fontSize: 12 }}>
                💬 {detail.totalMessages} messages
              </span>
              {detail.toolSummary.slice(0, 4).map(t => (
                <span key={t.name} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '6px 12px', color: '#388bfd', fontSize: 12 }}>
                  🔧 {t.name} ×{t.count}
                </span>
              ))}
            </div>

            {/* First user message (task / prompt) */}
            {detail.firstUserMessage && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#388bfd', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>📋 TASK / PROMPT</div>
                <div style={{
                  background: '#0d1f35', border: '1px solid #1f3a5f',
                  borderRadius: 10, padding: '10px 14px',
                  color: '#e6edf3', fontSize: 12, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {detail.firstUserMessage}
                  {detail.firstUserMessage.length >= 800 && (
                    <span style={{ color: '#626f86' }}> …[truncated]</span>
                  )}
                </div>
              </div>
            )}

            {/* Last assistant message (output) */}
            {detail.lastAssistantMessage && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#3fb950', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>✅ LAST OUTPUT</div>
                <div style={{
                  background: '#0d1f12', border: '1px solid #1a4d27',
                  borderRadius: 10, padding: '10px 14px',
                  color: '#e6edf3', fontSize: 12, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {detail.lastAssistantMessage}
                  {detail.lastAssistantMessage.length >= 800 && (
                    <span style={{ color: '#626f86' }}> …[truncated]</span>
                  )}
                </div>
              </div>
            )}

            {/* Recent messages */}
            {detail.recentMessages.length > 0 && (
              <div>
                <div style={{ color: '#626f86', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>🕐 RECENT MESSAGES</div>
                {detail.recentMessages.map((m, i) => (
                  <div key={i} style={{
                    background: '#161b22', border: `1px solid #21262d`,
                    borderLeft: `3px solid ${roleColor(m.role)}`,
                    borderRadius: 8, padding: '8px 12px', marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: roleColor(m.role), fontSize: 11, fontWeight: 600 }}>
                        {roleLabel(m.role)}
                      </span>
                      <span style={{ color: '#626f86', fontSize: 10 }}>
                        {new Date(m.timestamp).toLocaleTimeString('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {m.text && (
                      <div style={{ color: '#8b949e', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {m.text}
                      </div>
                    )}
                    {m.toolCalls.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {m.toolCalls.map((tc, j) => (
                          <span key={j} style={{ background: '#1f2937', color: '#388bfd', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                            {tc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface JobStat {
  jobId: string
  name: string
  totalRuns: number
  okRuns: number
  errorRuns: number
  successRate: number
  avgDurationMs: number
  totalTokens: number
  totalCostUsd: number
  avgCostUsd: number
  lastRunAt: number | null
  lastStatus: string
  consecutiveErrors: number
  timedOutCount: number
}

interface FlakyJob {
  jobId: string
  name: string
  consecutiveErrors: number
  lastError: string
}

interface AgentData {
  runs: Run[]
  sessions: Session[]
  activeSessions: Session[]
  stats: { total: number; ok: number; errors: number; totalTokens: number; totalCostUsd: number }
  jobStats: JobStat[]
  tokenTrend: number[]
  flakyJobs: FlakyJob[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function fmtTokens(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

function fmtCost(usd: number) {
  if (usd === 0) return '$0.00'
  if (usd < 0.001) return `$${usd.toFixed(5)}`
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

// ─── Token Trend Sparkline ────────────────────────────────────────────────────

function TokenSparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const h = 32
  const w = 400
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / max) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#626f86', fontSize: 10, marginBottom: 3 }}>Token trend</div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: h, display: 'block' }}
      >
        <polyline
          points={pts}
          fill="none"
          stroke="#388bfd"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

// ─── Flaky Job Banner ────────────────────────────────────────────────────────

function FlakyBanner({ jobs, onDismiss }: { jobs: FlakyJob[]; onDismiss: () => void }) {
  if (jobs.length === 0) return null
  return (
    <div style={{
      background: '#2d1515',
      border: '1px solid #7a2020',
      borderRadius: 10,
      padding: '10px 14px',
      marginBottom: 14,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <AlertTriangle size={14} color="#f0883e" />
        <span style={{ color: '#f0883e', fontWeight: 600, fontSize: 12 }}>
          {jobs.length} flaky job{jobs.length > 1 ? 's' : ''} detected
        </span>
        <button
          onClick={onDismiss}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            cursor: 'pointer', color: '#626f86', padding: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>
      {jobs.map(j => (
        <div key={j.jobId} style={{
          background: '#1a0e0e', borderRadius: 6, padding: '6px 10px',
          marginBottom: 4, display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{
            background: '#5a1d1d', color: '#f85149', fontSize: 10,
            padding: '1px 6px', borderRadius: 4, flexShrink: 0, fontWeight: 700,
          }}>
            {j.consecutiveErrors}✗
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#e6edf3', fontSize: 12, fontWeight: 600 }}>{j.name}</div>
            {j.lastError && (
              <div style={{
                color: '#8b949e', fontSize: 11, marginTop: 2,
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>{j.lastError}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Run Card ────────────────────────────────────────────────────────────────

function RunCard({ run, compact = false }: { run: Run; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const ok = run.status === 'ok'

  const clean = (s: string | null) => s?.replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim() || ''
  const preview = clean(ok ? run.summary : run.error)
  const lines = preview?.split('\n').filter(Boolean) || []
  const short = lines[0] || ''
  const hasMore = lines.length > 1

  const deliveryBadge =
    run.delivered === true ? (
      <span style={{ color: '#3fb950', fontSize: 10, flexShrink: 0 }}>💬✓</span>
    ) : run.delivered === false ? (
      <span style={{ color: '#f85149', fontSize: 10, flexShrink: 0 }}>💬✗</span>
    ) : null

  const timedOutBadge = run.timedOut ? (
    <span style={{
      background: '#2d1a00', color: '#f0883e', fontSize: 10,
      padding: '1px 5px', borderRadius: 4, flexShrink: 0,
    }}>⏱ Timed out</span>
  ) : null

  if (compact) {
    return (
      <div style={{
        background: ok ? '#161b22' : '#1a0e0e',
        border: `1px solid ${ok ? '#21262d' : '#5a1d1d'}`,
        borderLeft: `3px solid ${ok ? '#238636' : '#da3633'}`,
        borderRadius: 8, padding: '5px 10px', marginBottom: 4,
        display: 'flex', alignItems: 'center', gap: 6, minHeight: 30, flexWrap: 'nowrap',
      }}>
        {ok
          ? <CheckCircle2 size={12} color="#3fb950" style={{ flexShrink: 0 }} />
          : <XCircle size={12} color="#f85149" style={{ flexShrink: 0 }} />}
        <span style={{
          color: '#e6edf3', fontSize: 12, fontWeight: 500,
          flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>{run.jobName}</span>
        {timedOutBadge}
        {deliveryBadge}
        <span style={{ color: '#626f86', fontSize: 11, flexShrink: 0 }}>{timeAgo(run.runAtMs)}</span>
        <span style={{ color: '#626f86', fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Clock size={9} />{fmtDuration(run.durationMs)}
        </span>
        {run.usage && (
          <span style={{ color: '#626f86', fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Zap size={9} />{fmtTokens(run.usage.total_tokens)}
            {run.costUsd > 0 && (
              <span style={{ color: '#626f86', fontSize: 10, marginLeft: 2 }}>{fmtCost(run.costUsd)}</span>
            )}
          </span>
        )}
        {run.model && (
          <span style={{ background: '#1f2937', color: '#8b949e', fontSize: 10, padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
            {run.model.replace('claude-', '')}
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: ok ? '#161b22' : '#1a0e0e',
      border: `1px solid ${ok ? '#21262d' : '#5a1d1d'}`,
      borderLeft: `3px solid ${ok ? '#238636' : '#da3633'}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ marginTop: 1 }}>
          {ok
            ? <CheckCircle2 size={15} color="#3fb950" />
            : <XCircle size={15} color="#f85149" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: 13 }}>{run.jobName}</span>
            <span style={{ color: '#626f86', fontSize: 11 }}>{timeAgo(run.runAtMs)}</span>
            <span style={{ color: '#626f86', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} />{fmtDuration(run.durationMs)}
            </span>
            {run.usage && (
              <span style={{ color: '#626f86', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Zap size={10} />{fmtTokens(run.usage.total_tokens)} tok
                {run.costUsd > 0 && (
                  <span style={{ color: '#626f86', fontSize: 10, marginLeft: 2 }}>{fmtCost(run.costUsd)}</span>
                )}
              </span>
            )}
            {run.model && (
              <span style={{
                background: '#1f2937', color: '#8b949e', fontSize: 10,
                padding: '1px 6px', borderRadius: 4,
              }}>{run.model.replace('claude-', '')}</span>
            )}
            {timedOutBadge}
            {deliveryBadge}
          </div>

          {preview && (
            <div style={{ marginTop: 6 }}>
              <p style={{
                color: ok ? '#8b949e' : '#ffa198', fontSize: 12, margin: 0,
                lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {expanded ? preview : short}
              </p>
              {hasMore && (
                <button onClick={() => setExpanded(!expanded)} style={{
                  background: 'none', border: 'none', color: '#388bfd',
                  fontSize: 11, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {expanded ? <><ChevronUp size={11} />Show less</> : <><ChevronDown size={11} />Show more ({lines.length - 1} more lines)</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session, active, compact = false,
  onKill, onClick,
}: {
  session: Session
  active: boolean
  compact?: boolean
  onKill?: (id: string) => void
  onClick?: (s: Session) => void
}) {
  const [killing, setKilling] = useState(false)
  const ctxPct = session.contextTokens
    ? Math.round((session.totalTokens / session.contextTokens) * 100)
    : null

  const label = session.label
    .replace(/^Cron:\s*/i, '')
    .replace(/^Discord:\s*/i, '')

  const handleKill = async () => {
    if (!confirm(`Kill session "${label}"?`)) return
    setKilling(true)
    try {
      await fetch('/api/agents/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      })
      onKill?.(session.sessionId)
    } catch { /* ignore */ } finally {
      setKilling(false)
    }
  }

  if (compact) {
    return (
      <div onClick={() => onClick?.(session)} style={{
        background: active ? '#0d1f12' : '#161b22',
        border: `1px solid ${active ? '#1a4d27' : '#21262d'}`,
        borderRadius: 8, padding: '5px 10px', marginBottom: 4,
        display: 'flex', alignItems: 'center', gap: 8, minHeight: 28,
        cursor: onClick ? 'pointer' : 'default',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: active ? '#3fb950' : '#30363d',
          boxShadow: active ? '0 0 4px #3fb950' : 'none',
        }} />
        <span style={{
          color: '#e6edf3', fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{label}</span>
        <span style={{ color: '#626f86', fontSize: 11, flexShrink: 0 }}>{timeAgo(session.updatedAt)}</span>
        {session.model && (
          <span style={{ color: '#626f86', fontSize: 11, flexShrink: 0 }}>
            {session.model.replace('claude-', '')}
          </span>
        )}
        {ctxPct !== null && (
          <>
            <span style={{ color: ctxPct > 80 ? '#f0883e' : '#626f86', fontSize: 11, flexShrink: 0 }}>
              {fmtTokens(session.totalTokens)} tok
            </span>
            <div style={{ width: 32, flexShrink: 0 }}>
              <div style={{ height: 3, background: '#21262d', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${Math.min(ctxPct, 100)}%`,
                  background: ctxPct > 80 ? '#f0883e' : ctxPct > 50 ? '#388bfd' : '#3fb950',
                }} />
              </div>
            </div>
          </>
        )}
        {active && onKill && (
          <button onClick={handleKill} disabled={killing} style={{
            background: killing ? '#21262d' : '#2d1515',
            border: '1px solid #5a1d1d', color: '#f85149',
            borderRadius: 5, padding: '2px 6px', cursor: killing ? 'default' : 'pointer',
            fontSize: 10, flexShrink: 0, opacity: killing ? 0.6 : 1,
          }}>
            {killing ? '…' : '✕'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div onClick={() => onClick?.(session)} style={{
      background: active ? '#0d1f12' : '#161b22',
      border: `1px solid ${active ? '#1a4d27' : '#21262d'}`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: active ? '#3fb950' : '#30363d',
        boxShadow: active ? '0 0 6px #3fb950' : 'none',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#e6edf3', fontSize: 13, fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ color: '#626f86', fontSize: 11 }}>{timeAgo(session.updatedAt)}</span>
          {session.model && (
            <span style={{ color: '#626f86', fontSize: 11 }}>
              {session.model.replace('claude-', '')}
            </span>
          )}
          {ctxPct !== null && (
            <span style={{ color: ctxPct > 80 ? '#f0883e' : '#626f86', fontSize: 11 }}>
              {fmtTokens(session.totalTokens)} / {fmtTokens(session.contextTokens!)} tok ({ctxPct}%)
            </span>
          )}
        </div>
      </div>
      {ctxPct !== null && (
        <div style={{ width: 40, flexShrink: 0 }}>
          <div style={{ height: 3, background: '#21262d', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${Math.min(ctxPct, 100)}%`,
              background: ctxPct > 80 ? '#f0883e' : ctxPct > 50 ? '#388bfd' : '#3fb950',
            }} />
          </div>
        </div>
      )}
      {active && onKill && (
        <button onClick={handleKill} disabled={killing} style={{
          background: killing ? '#21262d' : '#2d1515',
          border: '1px solid #5a1d1d', color: '#f85149',
          borderRadius: 6, padding: '4px 10px', cursor: killing ? 'default' : 'pointer',
          fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3,
          opacity: killing ? 0.6 : 1,
        }}>
          {killing ? '…' : <><X size={10} /> Kill</>}
        </button>
      )}
    </div>
  )
}

// ─── By Job Tab ───────────────────────────────────────────────────────────────

type JobSort = 'most-runs' | 'most-errors' | 'highest-cost' | 'last-run'

function ByJobTab({ jobStats, onSelectJob }: { jobStats: JobStat[]; onSelectJob: (jobId: string) => void }) {
  const [sort, setSort] = useState<JobSort>('last-run')

  const sorted = [...jobStats].sort((a, b) => {
    if (sort === 'most-runs') return b.totalRuns - a.totalRuns
    if (sort === 'most-errors') return b.errorRuns - a.errorRuns
    if (sort === 'highest-cost') return b.totalCostUsd - a.totalCostUsd
    return (b.lastRunAt || 0) - (a.lastRunAt || 0)
  })

  const srColor = (rate: number) =>
    rate >= 90 ? '#3fb950' : rate >= 70 ? '#f0883e' : '#f85149'

  return (
    <div>
      {/* Sort bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#626f86', fontSize: 11, alignSelf: 'center' }}>Sort:</span>
        {([
          ['most-runs', 'Most runs'],
          ['most-errors', 'Most errors'],
          ['highest-cost', 'Highest cost'],
          ['last-run', 'Last run'],
        ] as [JobSort, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setSort(val)} style={{
            background: sort === val ? '#21262d' : 'none',
            border: `1px solid ${sort === val ? '#388bfd' : '#30363d'}`,
            color: sort === val ? '#e6edf3' : '#626f86',
            borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 500,
          }}>{label}</button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#626f86', padding: 40 }}>No job data</div>
      ) : (
        sorted.map(job => (
          <div key={job.jobId} style={{
            background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
            padding: '10px 14px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
              {/* Name */}
              <button
                onClick={() => onSelectJob(job.jobId)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: '#388bfd', fontWeight: 600, fontSize: 13, textAlign: 'left',
                  flex: '1 1 auto', minWidth: 0,
                }}
              >
                {job.name}
              </button>
              {/* Consecutive errors badge */}
              {job.consecutiveErrors > 0 && (
                <span style={{
                  background: '#5a1d1d', color: '#f85149', fontSize: 10,
                  padding: '1px 6px', borderRadius: 4, fontWeight: 700, flexShrink: 0,
                }}>
                  {job.consecutiveErrors}✗ streak
                </span>
              )}
            </div>

            {/* Metrics row */}
            <div style={{
              display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap',
              fontSize: 11, color: '#626f86',
            }}>
              <span>{job.totalRuns} runs</span>
              <span style={{ color: srColor(job.successRate), fontWeight: 600 }}>
                {job.totalRuns > 0 ? `${job.successRate.toFixed(0)}%` : 'n/a'} ok
              </span>
              {job.errorRuns > 0 && (
                <span style={{ color: '#f85149' }}>{job.errorRuns} err</span>
              )}
              {job.timedOutCount > 0 && (
                <span style={{ color: '#f0883e' }}>{job.timedOutCount} timeout</span>
              )}
              {job.avgDurationMs > 0 && (
                <span>avg {fmtDuration(job.avgDurationMs)}</span>
              )}
              {job.totalTokens > 0 && (
                <span><Zap size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> {fmtTokens(job.totalTokens)}</span>
              )}
              {job.totalCostUsd > 0 && (
                <span style={{ color: '#f0883e' }}>{fmtCost(job.totalCostUsd)}</span>
              )}
              {job.lastRunAt && (
                <span>{timeAgo(job.lastRunAt)}</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

const LOG_OPTIONS = [
  ['git-sync', 'Git Sync'],
  ['disk-monitor', 'Disk Monitor'],
  ['security-audit', 'Security Audit'],
  ['openclaw-update', 'OpenClaw Update'],
  ['email-monitor', 'Email Monitor'],
  ['eod-digest', 'EOD Digest'],
  ['calendar-brief', 'Calendar Brief'],
  ['readwise-cleanup', 'Readwise Cleanup'],
  ['cve-scan', 'CVE Scan'],
  ['o365-health', 'O365 Health'],
  ['file-size', 'File Size'],
  ['metadata-healer', 'Metadata Healer'],
]

interface LogData {
  file: string
  lines: string[]
  totalLines: number
  error?: string
}

function colorLogLine(line: string): string {
  const u = line.toUpperCase()
  if (/ERROR|FAIL|FAILED|CRITICAL/.test(u)) return '#f85149'
  if (/WARN|WARNING|⚠/.test(u)) return '#f0883e'
  if (/\bOK\b|✓|SUCCESS|PASSED|DONE/.test(u)) return '#3fb950'
  return '#8b949e'
}

function LogsTab() {
  const [file, setFile] = useState('security-audit')
  const [lines, setLines] = useState(50)
  const [logData, setLogData] = useState<LogData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/agents/logs?file=${file}&lines=${lines}`)
      setLogData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [file, lines])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={file}
          onChange={e => setFile(e.target.value)}
          style={{
            flex: '1 1 auto', background: '#161b22', border: '1px solid #30363d',
            color: '#e6edf3', borderRadius: 8, padding: '7px 10px', fontSize: 12, cursor: 'pointer',
          }}
        >
          {LOG_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <input
          type="number"
          value={lines}
          min={10}
          max={500}
          onChange={e => setLines(Math.max(10, Math.min(500, Number(e.target.value))))}
          style={{
            width: 72, background: '#161b22', border: '1px solid #30363d',
            color: '#e6edf3', borderRadius: 8, padding: '7px 10px', fontSize: 12,
          }}
        />
        <button onClick={fetchLogs} disabled={loading} style={{
          background: 'none', border: '1px solid #30363d', color: '#8b949e',
          borderRadius: 8, padding: '7px 12px', cursor: loading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
          opacity: loading ? 0.6 : 1,
        }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Output */}
      {logData?.error ? (
        <div style={{ color: '#f85149', fontSize: 12, padding: '12px 0' }}>{logData.error}</div>
      ) : (
        <>
          {logData && (
            <div style={{ color: '#626f86', fontSize: 10, marginBottom: 6 }}>
              Showing {logData.lines.length} of {logData.totalLines} lines
            </div>
          )}
          <pre style={{
            background: '#0d1117', border: '1px solid #21262d', borderRadius: 10,
            padding: '12px 14px', overflow: 'auto', fontSize: 11, lineHeight: 1.6,
            margin: 0, maxHeight: 480,
          }}>
            {loading && !logData ? (
              <span style={{ color: '#626f86' }}>Loading…</span>
            ) : (logData?.lines || []).map((line, i) => (
              <div key={i} style={{ color: colorLogLine(line) }}>{line}</div>
            ))}
          </pre>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'feed' | 'by-job' | 'logs'

export default function AgentsPage() {
  const [data, setData] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [filter, setFilter] = useState<'all' | 'ok' | 'error'>('all')
  const [search, setSearch] = useState('')
  const [compact, setCompact] = useState(false)
  const [tab, setTab] = useState<Tab>('feed')
  const [flakyDismissed, setFlakyDismissed] = useState(false)
  const [jobFilter, setJobFilter] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents?hours=${hours}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
      setLastRefresh(Date.now())
    }
  }, [hours])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const handleSelectJob = (jobId: string) => {
    const name = data?.runs.find(r => r.jobId === jobId)?.jobName || jobId
    setJobFilter(name)
    setSearch(name)
    setTab('feed')
  }

  const filteredRuns = (data?.runs || []).filter(r => {
    if (filter === 'ok' && r.status !== 'ok') return false
    if (filter === 'error' && r.status !== 'error') return false
    if (search && !r.jobName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = data?.stats
  const active = data?.activeSessions || []

  const handleKill = useCallback(() => {
    setTimeout(load, 1500)
  }, [load])

  // Tab bar styles
  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${tab === t ? '#388bfd' : 'transparent'}`,
    color: tab === t ? '#388bfd' : '#626f86',
  })

  return (
    <div style={{ padding: '16px 16px 100px', maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={20} color="#388bfd" />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>Agents</h1>
          {active.length > 0 && (
            <span style={{
              background: '#0d1f12', border: '1px solid #238636', color: '#3fb950',
              fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
            }}>{active.length} active</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setCompact(c => !c)} style={{
            background: compact ? '#21262d' : 'none',
            border: `1px solid ${compact ? '#388bfd' : '#30363d'}`,
            color: compact ? '#388bfd' : '#8b949e',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
          }}>
            <LayoutList size={12} />Compact
          </button>
          <button onClick={load} style={{
            background: 'none', border: '1px solid #30363d', color: '#8b949e',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
          }}>
            <RefreshCw size={12} />Refresh
          </button>
        </div>
      </div>

      {/* Flaky banner */}
      {!flakyDismissed && data && data.flakyJobs.length > 0 && (
        <FlakyBanner jobs={data.flakyJobs} onDismiss={() => setFlakyDismissed(true)} />
      )}

      {/* Stats bar (5 cards) */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
          {([
            { label: 'Runs', value: stats.total, color: '#388bfd', icon: <Activity size={13} /> },
            { label: 'OK', value: stats.ok, color: '#3fb950', icon: <CheckCircle2 size={13} /> },
            { label: 'Errors', value: stats.errors, color: stats.errors > 0 ? '#f85149' : '#626f86', icon: <XCircle size={13} /> },
            { label: 'Tokens', value: fmtTokens(stats.totalTokens), color: '#f0883e', icon: <Zap size={13} /> },
            { label: 'Cost', value: fmtCost(stats.totalCostUsd || 0), color: '#a371f7', icon: <span style={{ fontSize: 13 }}>$</span> },
          ] as { label: string; value: string | number; color: string; icon: React.ReactNode }[]).map(s => (
            <div key={s.label} style={{
              background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
              padding: '8px 10px', textAlign: 'center',
            }}>
              <div style={{ color: s.color, marginBottom: 3, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
              <div style={{ color: '#e6edf3', fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ color: '#626f86', fontSize: 10, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Active sessions */}
      {active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ color: '#3fb950', fontSize: 13, fontWeight: 600, margin: '0 0 8px',
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950',
              display: 'inline-block', boxShadow: '0 0 6px #3fb950' }} />
            Running now
          </h2>
          {active.map(s => (
            <SessionCard
              key={s.sessionId} session={s} active compact={compact}
              onKill={handleKill}
              onClick={setSelectedSession}
            />
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #21262d', marginBottom: 14,
        gap: 0,
      }}>
        <button style={tabStyle('feed')} onClick={() => setTab('feed')}>Feed</button>
        <button style={tabStyle('by-job')} onClick={() => setTab('by-job')}>By Job</button>
        <button style={tabStyle('logs')} onClick={() => setTab('logs')}>Logs</button>
      </div>

      {/* ── Feed Tab ── */}
      {tab === 'feed' && (
        <>
          {/* Filters + Search */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); if (jobFilter && e.target.value !== jobFilter) setJobFilter(null) }}
              placeholder="Filter by job name…"
              style={{
                flex: 1, minWidth: 160, background: '#161b22', border: '1px solid #30363d',
                borderRadius: 8, padding: '7px 12px', color: '#e6edf3', fontSize: 13, outline: 'none',
              }}
            />
            {(['all', 'ok', 'error'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? '#21262d' : 'none',
                border: `1px solid ${filter === f ? '#388bfd' : '#30363d'}`,
                color: filter === f ? '#e6edf3' : '#626f86',
                borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              }}>
                {f === 'all' ? 'All' : f === 'ok' ? '✓ OK' : '✗ Errors'}
              </button>
            ))}
            <select value={hours} onChange={e => setHours(Number(e.target.value))} style={{
              background: '#161b22', border: '1px solid #30363d', color: '#8b949e',
              borderRadius: 8, padding: '7px 10px', fontSize: 12, cursor: 'pointer',
            }}>
              <option value={6}>Last 6h</option>
              <option value={24}>Last 24h</option>
              <option value={48}>Last 48h</option>
            </select>
          </div>

          {/* Sparkline */}
          {data?.tokenTrend && data.tokenTrend.some(v => v > 0) && (
            <TokenSparkline data={data.tokenTrend} />
          )}

          {/* Runs list */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#626f86', padding: 40 }}>Loading…</div>
          ) : filteredRuns.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#626f86', padding: 40 }}>
              {search || filter !== 'all' ? 'No runs match filter' : 'No runs in this time range'}
            </div>
          ) : (
            <>
              <div style={{ color: '#626f86', fontSize: 11, marginBottom: 8 }}>
                {filteredRuns.length} runs · last refresh {timeAgo(lastRefresh)}
                {jobFilter && (
                  <button onClick={() => { setSearch(''); setJobFilter(null) }} style={{
                    marginLeft: 8, background: 'none', border: '1px solid #30363d',
                    color: '#388bfd', borderRadius: 5, padding: '1px 6px', fontSize: 10,
                    cursor: 'pointer',
                  }}>× clear filter</button>
                )}
              </div>
              {filteredRuns.map((run, i) => (
                <RunCard key={`${run.jobId}-${run.runAtMs}-${i}`} run={run} compact={compact} />
              ))}
            </>
          )}

          {/* Sessions (all) */}
          {data && data.sessions.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h2 style={{ color: '#8b949e', fontSize: 13, fontWeight: 600, margin: '0 0 8px',
                display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cpu size={13} color="#626f86" /> Sessions (24h)
              </h2>
              {data.sessions.slice(0, 20).map(s => (
                <SessionCard key={s.sessionId} session={s} active={false} compact={compact} onClick={setSelectedSession} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── By Job Tab ── */}
      {tab === 'by-job' && (
        <ByJobTab
          jobStats={data?.jobStats || []}
          onSelectJob={handleSelectJob}
        />
      )}

      {/* ── Logs Tab ── */}
      {tab === 'logs' && <LogsTab />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetailModal
          sessionKey={selectedSession.sessionKey}
          label={selectedSession.label}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  )
}
