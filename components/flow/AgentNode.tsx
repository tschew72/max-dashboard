'use client'
import { memo, useRef, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import type { AgentNodeData, AgentStatus } from './types'

const STATUS_COLORS: Record<AgentStatus, { glow: string; border: string; bg: string }> = {
  idle: {
    glow: 'rgba(124,58,237,0.15)',
    border: 'rgba(255,255,255,0.08)',
    bg: 'rgba(255,255,255,0.04)',
  },
  running: {
    glow: 'rgba(124,58,237,0.6)',
    border: 'rgba(167,139,250,0.6)',
    bg: 'rgba(124,58,237,0.12)',
  },
  done: {
    glow: 'rgba(34,197,94,0.5)',
    border: 'rgba(34,197,94,0.5)',
    bg: 'rgba(34,197,94,0.08)',
  },
  error: {
    glow: 'rgba(239,68,68,0.5)',
    border: 'rgba(239,68,68,0.6)',
    bg: 'rgba(239,68,68,0.08)',
  },
}

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: '#6b7280',
  running: '#7c3aed',
  done: '#22c55e',
  error: '#ef4444',
}

function AgentNodeComponent({ data }: { data: Record<string, unknown> }) {
  const agentData = data as unknown as AgentNodeData
  const { emoji, name, role, status } = agentData
  const colors = STATUS_COLORS[status]
  const isRunning = status === 'running'
  const isDone = status === 'done'
  const isError = status === 'error'

  // Status-change flash: brief scale pulse when transitioning to 'running'
  const prevStatusRef = useRef(status)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (prevStatusRef.current !== 'running' && status === 'running') {
      setFlash(true)
      const timer = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(timer)
    }
    prevStatusRef.current = status
  }, [status])

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: flash ? [1, 1.06, 1] : 1,
        opacity: 1,
        x: isError ? [0, 6, -6, 4, -4, 0] : 0,
      }}
      transition={
        flash
          ? { scale: { duration: 0.5, ease: 'easeOut' } }
          : isError
            ? { x: { duration: 0.4, repeat: 2 }, scale: { type: 'spring', stiffness: 300 } }
            : { type: 'spring', stiffness: 300, damping: 20 }
      }
      whileHover={{ scale: 1.08, y: -4, transition: { type: 'spring', stiffness: 400, damping: 15 } }}
      style={{
        width: 130,
        height: 90,
        position: 'relative',
        overflow: 'visible',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', width: 7, height: 7, zIndex: 20 }} />

      {/* Layer 1: Outer ambient glow */}
      <div
        style={{
          position: 'absolute',
          inset: -15,
          borderRadius: 24,
          background: colors.glow,
          filter: 'blur(20px)',
          opacity: isRunning ? 0.8 : 0.4,
          transition: 'all 0.4s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Ripple rings (running only) */}
      {isRunning && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 130,
              height: 90,
              marginTop: -45,
              marginLeft: -65,
              borderRadius: 14,
              border: '1px solid rgba(124,58,237,0.4)',
              animation: 'agent-ripple 2s ease-out infinite',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 130,
              height: 90,
              marginTop: -45,
              marginLeft: -65,
              borderRadius: 14,
              border: '1px solid rgba(124,58,237,0.3)',
              animation: 'agent-ripple 2s ease-out infinite 1s',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* Layer 2: Rotating rings (running/error) */}
      {(isRunning || isError) && (
        <svg
          width="160"
          height="120"
          viewBox="0 0 160 120"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <g transform="translate(80, 60)">
            {/* Ring 1 */}
            <ellipse
              rx="78"
              ry="55"
              fill="none"
              stroke={isError ? '#ef4444' : '#7c3aed'}
              strokeWidth="1.5"
              strokeDasharray="40 160"
              strokeLinecap="round"
              style={{ animation: 'agent-ring-1 2s linear infinite', transformOrigin: 'center' }}
            />
            {/* Ring 2 (reverse) */}
            <ellipse
              rx="72"
              ry="50"
              fill="none"
              stroke={isError ? '#f87171' : '#a78bfa'}
              strokeWidth="1"
              strokeDasharray="20 180"
              strokeLinecap="round"
              style={{ animation: 'agent-ring-2 1.5s linear infinite', transformOrigin: 'center' }}
            />
            {/* Ring 3 */}
            <ellipse
              rx="66"
              ry="45"
              fill="none"
              stroke={isError ? 'rgba(239,68,68,0.25)' : 'rgba(124,58,237,0.25)'}
              strokeWidth="1"
              strokeDasharray="10 190"
              strokeLinecap="round"
              style={{ animation: 'agent-ring-3 3s linear infinite', transformOrigin: 'center' }}
            />
          </g>
        </svg>
      )}

      {/* Done rings (green, static fade) */}
      {isDone && (
        <svg
          width="160"
          height="120"
          viewBox="0 0 160 120"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <g transform="translate(80, 60)">
            <ellipse
              rx="72"
              ry="50"
              fill="none"
              stroke="#22c55e"
              strokeWidth="1"
              strokeDasharray="30 170"
              strokeLinecap="round"
              opacity="0.5"
            />
          </g>
        </svg>
      )}

      {/* Layer 3: Glass card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 12,
          background: colors.bg,
          backdropFilter: isRunning ? 'blur(16px)' : 'blur(12px)',
          WebkitBackdropFilter: isRunning ? 'blur(16px)' : 'blur(12px)',
          border: `1px solid ${colors.border}`,
          boxShadow: isRunning
            ? '0 0 40px rgba(124,58,237,0.6), 0 0 80px rgba(124,58,237,0.2)'
            : isDone
              ? '0 0 30px rgba(34,197,94,0.3)'
              : isError
                ? '0 0 30px rgba(239,68,68,0.3), 0 0 60px rgba(239,68,68,0.15)'
                : '0 0 20px rgba(124,58,237,0.15)',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease',
          animation: status === 'idle' ? 'pulse-glow 2s ease-in-out infinite' : undefined,
          zIndex: 5,
        }}
      >
        {/* Row 1: emoji + status dot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">{emoji}</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: STATUS_DOT[status],
              boxShadow: `0 0 8px ${STATUS_DOT[status]}`,
              animation: isRunning ? 'pulse-glow 1s ease-in-out infinite' : undefined,
            }}
          />
        </div>

        {/* Row 2: name */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: status === 'idle' ? '#94a3b8' : '#e2e8f0',
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
            color: '#475569',
            background: 'rgba(124,58,237,0.1)',
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
      </div>

      {/* Done checkmark overlay */}
      {isDone && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 24,
            height: 24,
            background: '#22c55e',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(34,197,94,0.6)',
            animation: 'agent-done 5s ease-out forwards',
            zIndex: 20,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="100"
              style={{ animation: 'draw-check 0.6s ease forwards' }}
            />
          </svg>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', width: 7, height: 7, zIndex: 20 }} />
    </motion.div>
  )
}

export default memo(AgentNodeComponent)
