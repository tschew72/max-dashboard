'use client'
import { useEffect, useState } from 'react'

const AGENT_LABELS: Record<string, { name: string; emoji: string }> = {
  main: { name: 'Max', emoji: '⚡' },
  ba: { name: 'Bea', emoji: '📋' },
  dev: { name: 'Dev', emoji: '💻' },
  qa: { name: 'Quinn', emoji: '🧪' },
  ux: { name: 'Umi', emoji: '🎨' },
  researcher: { name: 'Alex', emoji: '🔍' },
  sales: { name: 'Sam', emoji: '📈' },
  devops: { name: 'Dex', emoji: '🚀' },
  cfo: { name: 'Cleo', emoji: '💰' },
  ciso: { name: 'Kai', emoji: '🛡️' },
  writer: { name: 'Wren', emoji: '✍️' },
  ops: { name: 'Ops', emoji: '⚙️' },
  marketing: { name: 'Maya', emoji: '📣' },
  webdev: { name: 'Webrin', emoji: '🌐' },
}

interface AgentTokenData {
  id: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  totalCost: number
  sessionCount: number
  lastActive: string | null
}

interface TokenData {
  period: string
  totals: {
    totalTokens: number
    totalCost: number
  }
  agents: AgentTokenData[]
  totalSessions: number
}

function fmtCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

const PERIOD_LABELS: Record<string, string> = { today: 'Today', '7d': '7 Days', '30d': '30 Days' }

export default function TokenEconomyPanel() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today')
  const [data, setData] = useState<TokenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const fetchData = () =>
      fetch(`/api/tokens?period=${period}`)
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => setLoading(false))
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [period])

  const maxCost = data?.agents?.[0]?.totalCost || 1
  const topAgent = data?.agents?.[0]

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          💰 Token Economy
        </p>
        <div className="flex gap-1">
          {(['today', '7d', '30d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{
                background: period === p ? '#0052cc' : '#21262d',
                color: period === p ? '#e6edf3' : '#8b949e',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-6 rounded animate-pulse" style={{ background: 'var(--border)' }} />
          <div className="h-16 rounded animate-pulse" style={{ background: 'var(--border)' }} />
        </div>
      ) : !data || data.agents.length === 0 ? (
        <div className="text-center py-4" style={{ color: 'var(--muted)' }}>
          <p className="text-sm">No token usage data for this period.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <span className="text-lg font-bold" style={{ color: '#f0883e' }}>
                {fmtCost(data.totals.totalCost)}
              </span>
              <span className="text-[11px] ml-1.5" style={{ color: 'var(--muted)' }}>
                · {data.totalSessions} sessions
              </span>
            </div>
            {topAgent && (
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                Top: {AGENT_LABELS[topAgent.id]?.emoji || '🤖'}{' '}
                {AGENT_LABELS[topAgent.id]?.name || topAgent.id} ({fmtCost(topAgent.totalCost)})
              </span>
            )}
          </div>

          {/* Agent bars */}
          <div className="space-y-2">
            {data.agents.slice(0, 8).map(agent => {
              const label = AGENT_LABELS[agent.id] || { name: agent.id, emoji: '🤖' }
              const pct = maxCost > 0 ? (agent.totalCost / maxCost) * 100 : 0
              const totalPct = data.totals.totalCost > 0 ? Math.round((agent.totalCost / data.totals.totalCost) * 100) : 0
              const isExpanded = expandedAgent === agent.id

              return (
                <div key={agent.id}>
                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                    className="w-full text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px]">{label.emoji}</span>
                      <span className="text-[11px] font-medium flex-1" style={{ color: '#e6edf3' }}>
                        {label.name}
                      </span>
                      <span className="text-[11px] font-semibold" style={{ color: '#f0883e' }}>
                        {fmtCost(agent.totalCost)}
                      </span>
                      <span className="text-[10px]" style={{ color: '#8b949e' }}>
                        ({totalPct}%)
                      </span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#21262d' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, pct)}%`,
                          background: '#f0883e',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </button>

                  {/* Expanded token breakdown */}
                  {isExpanded && (
                    <div className="mt-1.5 ml-5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]" style={{ color: '#8b949e' }}>
                      <span>Input: {fmtTokens(agent.inputTokens)}</span>
                      <span>Output: {fmtTokens(agent.outputTokens)}</span>
                      <span>Cache Read: {fmtTokens(agent.cacheReadTokens)}</span>
                      <span>Cache Write: {fmtTokens(agent.cacheWriteTokens)}</span>
                      <span>Total Tokens: {fmtTokens(agent.totalTokens)}</span>
                      <span>Sessions: {agent.sessionCount}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
