'use client'
import { useEffect, useState, useCallback } from 'react'

type Range = '7d' | '14d' | '30d'

interface AnalyticsData {
  range: string
  tasks: {
    total: number
    byStatus: Record<string, number>
    overdue: number
    inProgress: number
    done: number
    byDay: Record<string, number>
  }
  agents: {
    totalRuns: number
    successRuns: number
    successRate: number
    avgDurationMs: number
    byDay: Record<string, number>
  }
  tokens: {
    total: number
    input: number
    output: number
    estimatedCostUsd: number
    byDay: Record<string, number>
    byModel: Record<string, number>
  }
}

function BarChart({ data, color = '#7c3aed', height = 80, showLabels = false }: {
  data: Record<string, number>
  color?: string
  height?: number
  showLabels?: boolean
}) {
  const entries = Object.entries(data)
  if (!entries.length) return null
  const max = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className="flex items-end gap-0.5 w-full" style={{ height }}>
      {entries.map(([day, val]) => {
        const pct = Math.round((val / max) * 100)
        const dateLabel = day.slice(5) // MM-DD
        return (
          <div key={day} className="flex flex-col items-center flex-1 gap-0.5 h-full justify-end" title={`${day}: ${val}`}>
            <div
              className="w-full rounded-sm transition-all duration-300"
              style={{
                height: `${Math.max(pct, val > 0 ? 4 : 0)}%`,
                background: val > 0 ? color : 'var(--border)',
                minHeight: val > 0 ? 2 : 0,
              }}
            />
            {showLabels && entries.length <= 14 && (
              <span className="text-[8px] rotate-45 origin-left" style={{ color: 'var(--muted)' }}>
                {dateLabel}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-xl font-bold" style={{ color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

function fmtDuration(ms: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?range=${r}`)
      const json = await res.json()
      setData(json)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(range) }, [range, fetchData])

  const taskStatusColors: Record<string, string> = {
    DONE: '#57d9a3',
    IN_PROGRESS: '#579dff',
    REVIEW: '#ffab00',
    BACKLOG: '#626f86',
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-bold flex-1" style={{ color: 'var(--text)' }}>📊 Analytics</h1>
        <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {(['7d', '14d', '30d'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: range === r ? 'var(--accent)' : 'transparent',
                color: range === r ? '#fff' : 'var(--muted)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl h-40 animate-pulse" style={{ background: 'var(--card)' }} />
            ))}
          </div>
        ) : data ? (
          <>
            {/* ── Tasks ── */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>✅ Tasks</h2>
              <div className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatChip label="Total" value={data.tasks.total} />
                  <StatChip label="Done" value={data.tasks.done} color="#57d9a3" />
                  <StatChip label="In Progress" value={data.tasks.inProgress} color="#579dff" />
                  <StatChip label="Overdue" value={data.tasks.overdue} color="#ff8f73" />
                </div>

                {/* Status breakdown */}
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(data.tasks.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: (taskStatusColors[status] ?? '#626f86') + '22', color: taskStatusColors[status] ?? '#626f86' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: taskStatusColors[status] ?? '#626f86' }} />
                      {status.replace('_', ' ')} ({count})
                    </div>
                  ))}
                </div>

                {/* Bar chart: tasks created per day */}
                <div>
                  <div className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>Tasks created per day</div>
                  <BarChart data={data.tasks.byDay} color="#7c3aed" height={60} />
                  <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                    <span>{Object.keys(data.tasks.byDay)[0]}</span>
                    <span>Today</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Agent Runs ── */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>🤖 Agent Runs</h2>
              <div className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatChip label="Total Runs" value={data.agents.totalRuns} />
                  <StatChip label="Success Rate" value={`${data.agents.successRate}%`} color="#57d9a3" />
                  <StatChip label="Avg Duration" value={fmtDuration(data.agents.avgDurationMs)} color="#579dff" />
                </div>

                {/* Bar chart: runs per day */}
                <div>
                  <div className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>Runs per day</div>
                  <BarChart data={data.agents.byDay} color="#0ea5e9" height={60} />
                  <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                    <span>{Object.keys(data.agents.byDay)[0]}</span>
                    <span>Today</span>
                  </div>
                </div>

                {/* Success bar */}
                {data.agents.totalRuns > 0 && (
                  <div>
                    <div className="flex justify-between text-[11px] mb-1" style={{ color: 'var(--muted)' }}>
                      <span>Success vs errors</span>
                      <span style={{ color: '#57d9a3' }}>{data.agents.successRuns}/{data.agents.totalRuns}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#ff563022' }}>
                      <div className="h-full rounded-full" style={{ width: `${data.agents.successRate}%`, background: '#57d9a3' }} />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Token Usage ── */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>🧠 Token Usage</h2>
              <div className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <StatChip label="Total Tokens" value={fmtTokens(data.tokens.total)} />
                  <StatChip label="Est. Cost (USD)" value={`$${data.tokens.estimatedCostUsd.toFixed(2)}`} color="#f59e0b" />
                  <StatChip label="Input" value={fmtTokens(data.tokens.input)} color="#579dff" />
                  <StatChip label="Output" value={fmtTokens(data.tokens.output)} color="#a78bfa" />
                </div>

                {/* Bar chart: tokens per day */}
                {Object.values(data.tokens.byDay).some(v => v > 0) && (
                  <div>
                    <div className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>Tokens per day</div>
                    <BarChart data={data.tokens.byDay} color="#a78bfa" height={60} />
                    <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                      <span>{Object.keys(data.tokens.byDay)[0]}</span>
                      <span>Today</span>
                    </div>
                  </div>
                )}

                {/* Model breakdown */}
                {Object.keys(data.tokens.byModel).length > 0 && (
                  <div>
                    <div className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>By model</div>
                    <div className="space-y-1.5">
                      {Object.entries(data.tokens.byModel)
                        .sort((a, b) => b[1] - a[1])
                        .map(([model, tokens]) => {
                          const pct = data.tokens.total > 0 ? Math.round((tokens / data.tokens.total) * 100) : 0
                          const shortName = model.split('/').pop() ?? model
                          return (
                            <div key={model}>
                              <div className="flex justify-between text-[11px] mb-0.5" style={{ color: 'var(--muted)' }}>
                                <span className="truncate">{shortName}</span>
                                <span>{fmtTokens(tokens)} ({pct}%)</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#7c3aed' }} />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {data.tokens.total === 0 && (
                  <p className="text-sm text-center py-2" style={{ color: 'var(--muted)' }}>No token data in this period</p>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--muted)' }}>Failed to load analytics</div>
        )}
      </div>
    </div>
  )
}
