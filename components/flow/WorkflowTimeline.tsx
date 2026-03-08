'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { WorkflowChain } from './types'

const AGENT_META: Record<string, { emoji: string; name: string }> = {
  main:       { emoji: '⚡', name: 'Max' },
  ba:         { emoji: '📋', name: 'Bea' },
  dev:        { emoji: '💻', name: 'Dev' },
  ux:         { emoji: '🎨', name: 'Umi' },
  researcher: { emoji: '🔍', name: 'Alex' },
  sales:      { emoji: '📈', name: 'Sam' },
  qa:         { emoji: '🧪', name: 'Quinn' },
  devops:     { emoji: '🚀', name: 'Dex' },
  cfo:        { emoji: '💰', name: 'Cleo' },
  ciso:       { emoji: '🛡️', name: 'Kai' },
  writer:     { emoji: '✍️', name: 'Wren' },
  ops:        { emoji: '⚙️', name: 'Ops' },
  marketing:  { emoji: '📣', name: 'Maya' },
}

function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return ''
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

const STATUS_BORDER: Record<string, string> = {
  success: 'rgba(34, 197, 94, 0.3)',
  failed: 'rgba(239, 68, 68, 0.3)',
  running: 'rgba(234, 179, 8, 0.3)',
}

const STATUS_BG: Record<string, string> = {
  success: 'rgba(34, 197, 94, 0.12)',
  failed: 'rgba(239, 68, 68, 0.12)',
  running: 'rgba(234, 179, 8, 0.12)',
}

const STATUS_COLOR: Record<string, string> = {
  success: '#22c55e',
  failed: '#ef4444',
  running: '#eab308',
}

export default function WorkflowTimeline({
  chains,
  selectedChainId,
  onSelectChain,
}: {
  chains: WorkflowChain[]
  selectedChainId: string | null
  onSelectChain: (id: string | null) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('flow-timeline-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleCollapse = () => {
    setCollapsed(prev => {
      localStorage.setItem('flow-timeline-collapsed', String(!prev))
      return !prev
    })
  }

  return (
    <div
      style={{
        height: collapsed ? 40 : 120,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        transition: 'height 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          height: 40,
          cursor: 'pointer',
        }}
        onClick={toggleCollapse}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          Workflow Chains ({chains.length})
        </span>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
          }}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Timeline rows */}
      {!collapsed && (
        <div
          style={{
            overflowX: 'auto',
            overflowY: 'auto',
            padding: '0 16px 12px',
            maxHeight: 80,
          }}
        >
          {chains.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 12 }}>
              No workflow chains yet
            </div>
          ) : (
            chains.map(chain => {
              const isSelected = selectedChainId === chain.id
              return (
                <div
                  key={chain.id}
                  onClick={() => onSelectChain(isSelected ? null : chain.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    outline: isSelected ? '1px solid #7c3aed' : 'none',
                    background: isSelected ? 'rgba(124, 58, 237, 0.05)' : 'transparent',
                    marginBottom: 2,
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Timestamp */}
                  <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 40, flexShrink: 0 }}>
                    {fmtTime(chain.startAt)}
                  </span>

                  {/* Steps */}
                  {chain.steps.map((step, i) => {
                    const meta = AGENT_META[step.agentId] || { emoji: '🤖', name: step.agentId }
                    return (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {i > 0 && (
                          <span style={{ color: 'var(--muted)', fontSize: 12, padding: '0 2px' }}>→</span>
                        )}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 100,
                            fontSize: 12,
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            background: STATUS_BG[step.status === 'done' ? 'success' : step.status] || STATUS_BG.success,
                            color: STATUS_COLOR[step.status === 'done' ? 'success' : step.status] || STATUS_COLOR.success,
                            border: `1px solid ${STATUS_BORDER[step.status === 'done' ? 'success' : step.status] || STATUS_BORDER.success}`,
                          }}
                        >
                          {meta.emoji} {meta.name}
                        </span>
                      </span>
                    )
                  })}

                  {/* Duration */}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--muted)',
                      minWidth: 40,
                      textAlign: 'right',
                      flexShrink: 0,
                      marginLeft: 'auto',
                    }}
                  >
                    {chain.steps.length > 0
                      ? fmtDuration(
                          chain.steps.reduce((s, st) => s + st.durationMs, 0) ||
                            new Date(chain.steps[chain.steps.length - 1].startAt).getTime() -
                              new Date(chain.startAt).getTime()
                        )
                      : ''}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
