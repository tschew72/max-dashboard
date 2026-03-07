'use client'
import { useEffect, useState } from 'react'
import { Bot, CheckCircle2, Circle, ChevronRight, Filter } from 'lucide-react'
import Link from 'next/link'
import { usePanelFetch } from '@/hooks/usePanelFetch'
import { PanelSkeleton } from './DashboardSkeleton'
import { extractAgentName, AGENT_MAP } from '@/lib/agents'

interface AgentRun {
  jobName: string
  jobId: string
  status: string
  runAtMs: number
  durationMs: number
  model: string | null
  usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null
  costUsd: number
  summary: string | null
}

interface AgentData {
  runs: AgentRun[]
  activeSessions: { sessionId: string; label: string; updatedAt: number }[]
}

type FilterTab = 'all' | 'ok' | 'error'

function formatDuration(ms: number): { text: string; color: string } {
  if (ms < 30000) return { text: ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`, color: '#36b37e' }
  if (ms < 120000) return { text: `${(ms / 1000).toFixed(0)}s`, color: '#ff8b00' }
  return { text: `${Math.floor(ms / 60000)}m`, color: '#ff5630' }
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function AgentActivityPanel({ onSSERefresh }: { onSSERefresh?: number }) {
  const { data, loading, refetch } = usePanelFetch<AgentData>('/api/agents?hours=6')
  const [filter, setFilter] = useState<FilterTab>('all')

  useEffect(() => {
    if (onSSERefresh) refetch()
  }, [onSSERefresh, refetch])

  if (loading || !data) return <PanelSkeleton rows={3} />

  const runs = (data.runs || []).slice(0, 15)
  const filtered = filter === 'all' ? runs : runs.filter(r => filter === 'ok' ? r.status === 'ok' : r.status !== 'ok')

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#626f86' }}>
          <Bot size={11} /> Agent Activity
        </p>
        <Link href="/agents" className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: '#0052cc22', color: '#579dff' }}>
          View all →
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="px-4 pb-2 flex gap-1">
        {(['all', 'ok', 'error'] as FilterTab[]).map(tab => (
          <button key={tab} onClick={() => setFilter(tab)}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize"
            style={{
              background: filter === tab ? '#0052cc33' : 'transparent',
              color: filter === tab ? '#579dff' : '#626f86',
            }}>
            {tab === 'ok' ? 'Succeeded' : tab === 'error' ? 'Failed' : 'All'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 pb-4 pt-1 flex items-center gap-2" style={{ color: '#626f86' }}>
          <CheckCircle2 size={14} />
          <p className="text-sm">No recent agent activity</p>
        </div>
      ) : (
        <div className="px-3 pb-3 pt-1 space-y-1">
          {filtered.slice(0, 8).map((run, i) => {
            const ok = run.status === 'ok'
            const { name: agentName, emoji: agentEmoji } = extractAgentName(run.jobName)
            const dur = formatDuration(run.durationMs)
            const ago = (() => {
              const s = Math.floor((Date.now() - run.runAtMs) / 1000)
              if (s < 60) return `${s}s ago`
              if (s < 3600) return `${Math.floor(s / 60)}m ago`
              return `${Math.floor(s / 3600)}h ago`
            })()
            const modelShort = run.model
              ? run.model.replace('claude-', '').replace('anthropic/', '').split('-').slice(0, 2).join('-')
              : null

            return (
              <div key={`${run.runAtMs}-${i}`} className="rounded-lg px-2.5 py-2"
                style={{
                  background: ok ? '#161b22' : '#1a0e0e',
                  border: `1px solid ${ok ? '#21262d' : '#5a1d1d'}`,
                  borderLeft: `3px solid ${ok ? '#238636' : '#da3633'}`,
                }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-shrink-0">{agentEmoji}</span>
                  <span className="text-xs font-medium text-white flex-1 truncate">{run.jobName}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: '#626f86' }}>{ago}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 pl-6">
                  <span className="text-[10px] font-semibold" style={{ color: dur.color }}>{dur.text}</span>
                  {modelShort && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#2c333a', color: '#8c9bab' }}>
                      {modelShort}
                    </span>
                  )}
                  {run.usage && (
                    <span className="text-[10px]" style={{ color: '#626f86' }}>
                      {formatTokens(run.usage.total_tokens)} tok
                    </span>
                  )}
                  {run.costUsd > 0 && (
                    <span className="text-[10px]" style={{ color: '#626f86' }}>
                      ${run.costUsd.toFixed(3)}
                    </span>
                  )}
                </div>
                {run.summary && (
                  <p className="text-[10px] mt-1 pl-6 truncate" style={{ color: '#626f86' }}>
                    {run.summary.substring(0, 80)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
