'use client'
import type { AgentSummary, RecentActivityEntry } from '@/lib/flow/parse-sessions'
import { useState } from 'react'

function formatTimeAgo(isoDate: string | null): string {
  if (!isoDate) return 'never'
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

interface SystemOverviewProps {
  agents: AgentSummary[]
  recentActivity: RecentActivityEntry[]
}

export default function SystemOverview({ agents, recentActivity }: SystemOverviewProps) {
  const [activityExpanded, setActivityExpanded] = useState(false)

  const mostRecent = agents.find(a => a.lastActiveAt !== null)

  return (
    <div>
      {/* All Quiet header */}
      <div style={{
        background: 'rgba(13, 13, 26, 0.5)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: '16px 24px',
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 16, color: '#f1f5f9', fontWeight: 500 }}>
          😴 All Quiet — No active work
        </div>
        {mostRecent && (
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Last activity: {mostRecent.emoji} {mostRecent.name} finished {formatTimeAgo(mostRecent.lastActiveAt)}
          </div>
        )}
      </div>

      {/* Agent Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {agents.map(agent => (
          <div
            key={agent.id}
            style={{
              background: 'rgba(13, 13, 26, 0.6)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 12,
              padding: 16,
              cursor: 'default',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
          >
            {/* Header: emoji + name */}
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>
              {agent.emoji} {agent.name}
            </div>
            {/* Role */}
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              {agent.role}
            </div>
            {/* Activity line */}
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
              Last: {formatTimeAgo(agent.lastActiveAt)} • {agent.runsToday} today
            </div>
            {/* Task preview */}
            {agent.lastTaskPreview && (
              <div style={{
                fontSize: 13,
                color: '#64748b',
                fontStyle: 'italic',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                &ldquo;{agent.lastTaskPreview}&rdquo;
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div
            style={{
              fontSize: 13,
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              userSelect: 'none',
            }}
            onClick={() => setActivityExpanded(!activityExpanded)}
          >
            <span style={{ flex: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            <span>Recent Activity (last 24h) {activityExpanded ? '▾' : '▸'}</span>
            <span style={{ flex: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }} />
          </div>

          {activityExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentActivity.slice(0, 10).map((entry, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                  }}
                >
                  <span>{entry.emoji} {entry.agentName}</span>
                  <span style={{ color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    — {entry.taskPreview ? `"${entry.taskPreview.slice(0, 60)}"` : '—'}
                  </span>
                  <span style={{ flexShrink: 0 }}>{formatTimeAgo(entry.startedAt)}</span>
                  <span style={{
                    flexShrink: 0,
                    color: entry.status === 'running' ? '#a78bfa' : '#22c55e',
                    fontSize: 11,
                  }}>
                    {entry.status === 'running' ? '● running' : '✓ done'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
