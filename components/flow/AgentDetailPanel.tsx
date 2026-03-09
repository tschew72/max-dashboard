'use client'
import { useEffect, useCallback, useState } from 'react'
import { X } from 'lucide-react'
import type { AgentNodeData, AgentStatus } from './types'

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#888',
  running: '#7c3aed',
  done: '#22c55e',
  error: '#ef4444',
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function fmtCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function fmtTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function StopButton({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState<string | null>(null)
  const [stopped, setStopped] = useState(false)

  async function handleStop() {
    if (!confirm(`⛔ Stop agent "${agentName}"? This will abort the current session.`)) return
    setStopping(true)
    setStopError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/stop`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Stop failed')
      setStopped(true)
    } catch (err: any) {
      setStopError(err.message)
    } finally {
      setStopping(false)
    }
  }

  if (stopped) return null

  return (
    <div>
      <button
        onClick={handleStop}
        disabled={stopping}
        style={{
          width: '100%',
          padding: 10,
          background: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: stopping ? 'wait' : 'pointer',
          opacity: stopping ? 0.7 : 1,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (!stopping) e.currentTarget.style.background = '#b91c1c' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#dc2626' }}
      >
        {stopping ? '⏳ Stopping…' : '⛔ Stop Agent'}
      </button>
      {stopError && (
        <p style={{ color: '#f87171', fontSize: 11, marginTop: 4, textAlign: 'center' }}>{stopError}</p>
      )}
    </div>
  )
}

export default function AgentDetailPanel({
  agent,
  onClose,
}: {
  agent: AgentNodeData | null
  onClose: () => void
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (agent) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [agent, handleKeyDown])

  return (
    <div
      role="complementary"
      aria-label="Agent details"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 320,
        height: '100%',
        background: 'var(--card)',
        borderLeft: '1px solid var(--border)',
        zIndex: 50,
        transform: agent ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: agent ? '-8px 0 32px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      {agent && (
        <>
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close panel"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>

          {/* Emoji */}
          <div style={{ fontSize: 48, textAlign: 'center', marginTop: 8 }}>{agent.emoji}</div>

          {/* Name */}
          <div style={{ fontSize: 20, fontWeight: 600, textAlign: 'center', color: 'var(--text)' }}>
            {agent.name}
          </div>

          {/* Role */}
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>{agent.role}</div>

          {/* Model + status */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 100,
                background: 'rgba(124, 58, 237, 0.15)',
                color: 'var(--accent-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {agent.model.replace('anthropic/', '').replace('claude-', '')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: STATUS_COLORS[agent.status] }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: STATUS_COLORS[agent.status],
                }}
              />
              {agent.status}
            </span>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)' }} />

          {/* Last 5 runs */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              Recent Runs
            </div>
            {agent.recentRuns.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>No recent runs</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {agent.recentRuns.map((run, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: 'var(--muted)',
                      padding: '4px 0',
                      borderBottom: '1px solid rgba(42,42,42,0.5)',
                    }}
                  >
                    <span style={{ flex: 1 }}>{timeAgo(run.runAt)}</span>
                    <span>{fmtDuration(run.durationMs)}</span>
                    <span>{fmtCost(run.costUsd)}</span>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: run.status === 'ok' ? '#22c55e' : '#ef4444',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)' }} />

          {/* 7-day stats */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              7-Day Summary
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Runs today</span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{agent.runsToday}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total tokens (7d)</span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtTokens(agent.totalTokens7d)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total cost (7d)</span>
                <span style={{ color: '#f0883e', fontWeight: 600 }}>{fmtCost(agent.totalCost7d)}</span>
              </div>
            </div>
          </div>

          {/* Emergency Stop button — only when running */}
          {agent.status === 'running' && (
            <StopButton agentId={agent.id} agentName={agent.name} />
          )}

          {/* Spawn button */}
          <button
            style={{
              width: '100%',
              padding: 12,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 'auto',
              transition: 'background 0.15s, transform 0.1s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#6d28d9'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--accent)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Spawn Task
          </button>
        </>
      )}
    </div>
  )
}
