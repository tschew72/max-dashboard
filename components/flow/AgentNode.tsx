'use client'
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { AgentNodeData, AgentStatus } from './types'

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#888',
  running: '#7c3aed',
  done: '#22c55e',
  error: '#ef4444',
}

function AgentNodeComponent({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const agentData = data as unknown as AgentNodeData
  const { emoji, name, role, status } = agentData
  const statusColor = STATUS_COLORS[status]

  return (
    <div
      className={`agent-node agent-node--${status}${selected ? ' agent-node--selected' : ''}`}
      style={{
        width: 120,
        height: 80,
        position: 'relative',
        borderRadius: 10,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        background: 'var(--card)',
        border: status === 'running'
          ? '2px solid var(--accent)'
          : status === 'done'
            ? '2px solid #22c55e'
            : status === 'error'
              ? '2px solid #ef4444'
              : '1px solid var(--border)',
        boxShadow: status === 'running'
          ? '0 0 20px rgba(124, 58, 237, 0.35), 0 0 40px rgba(124, 58, 237, 0.15)'
          : status === 'done'
            ? '0 0 16px rgba(34, 197, 94, 0.3)'
            : status === 'error'
              ? '0 0 16px rgba(239, 68, 68, 0.3)'
              : '0 0 8px rgba(124, 58, 237, 0.08)',
        transition: 'all 0.2s ease',
        animation: status === 'error' ? 'agent-shake 0.4s ease-in-out 3' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#2a2a2a', border: 'none', width: 6, height: 6 }} />

      {/* Running ring overlay */}
      {status === 'running' && (
        <div
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: 13,
            border: '2px solid transparent',
            borderTopColor: 'var(--accent)',
            borderRightColor: 'rgba(124, 58, 237, 0.4)',
            animation: 'agent-ring 1s linear infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Done checkmark */}
      {status === 'done' && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 20,
            height: 20,
            background: '#22c55e',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'white',
            animation: 'agent-done 3s ease-out forwards',
            zIndex: 10,
          }}
        >
          ✓
        </span>
      )}

      {/* Row 1: emoji + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 20 }} aria-hidden="true">{emoji}</span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: status === 'running' ? `0 0 6px ${statusColor}` : undefined,
            animation: status === 'idle' ? 'agent-pulse 3s ease-in-out infinite' : undefined,
          }}
          aria-label={status}
        />
      </div>

      {/* Row 2: name */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: status === 'idle' ? 'var(--muted)' : 'var(--text)',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>

      {/* Row 3: role badge */}
      <span
        style={{
          fontSize: 10,
          color: 'var(--accent-light)',
          background: 'rgba(124, 58, 237, 0.12)',
          padding: '2px 6px',
          borderRadius: 100,
          alignSelf: 'flex-start',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        {role}
      </span>

      <Handle type="source" position={Position.Bottom} style={{ background: '#2a2a2a', border: 'none', width: 6, height: 6 }} />
    </div>
  )
}

export default memo(AgentNodeComponent)
