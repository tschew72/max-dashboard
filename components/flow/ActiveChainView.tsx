'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { ActiveChain } from '@/lib/flow/parse-sessions'
import SpawnEdge from './SpawnEdge'
import DurationTimer from './DurationTimer'

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface ActiveChainViewProps {
  chains: ActiveChain[]
}

export default function ActiveChainView({ chains }: ActiveChainViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center' }}>
      <AnimatePresence mode="popLayout">
        {chains.map(chain => (
          <motion.div
            key={chain.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            {/* Chain Header */}
            <div style={{
              width: '100%',
              background: 'rgba(13, 13, 26, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: 12,
              padding: '12px 20px',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 14, color: '#a78bfa', fontWeight: 500 }}>
                🔗 Active Work
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Started {formatTimeAgo(chain.startedAt)}
              </span>
            </div>

            {/* Steps */}
            {chain.steps.map((step, idx) => (
              <div key={step.sessionKey} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {idx > 0 && <SpawnEdge active={step.status === 'running'} />}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  style={{
                    width: '100%',
                    background: 'rgba(13, 13, 26, 0.7)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderLeft: `3px solid ${step.status === 'running' ? '#7c3aed' : '#22c55e'}`,
                    borderRadius: 12,
                    padding: '16px 20px',
                  }}
                >
                  {/* Header: emoji + name + status badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>
                      {step.emoji} {step.agentName}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase' as const,
                      padding: '3px 10px',
                      borderRadius: 100,
                      ...(step.status === 'running'
                        ? {
                            color: '#a78bfa',
                            background: 'rgba(124, 58, 237, 0.15)',
                            animation: 'statusPulse 2s ease-in-out infinite',
                          }
                        : {
                            color: '#22c55e',
                            background: 'rgba(34, 197, 94, 0.1)',
                          }),
                    }}>
                      {step.status === 'running' ? '● RUNNING' : '✓ DONE'}
                    </span>
                  </div>

                  {/* Task preview */}
                  {step.taskPreview && (
                    <div style={{
                      fontSize: 13,
                      color: '#94a3b8',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                      marginBottom: 8,
                    }}>
                      {step.taskPreview}
                    </div>
                  )}

                  {/* Last tool + duration */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#64748b' }}>
                    {step.lastTool && (
                      <span>🔧 {step.lastTool}</span>
                    )}
                    <DurationTimer startedAt={step.startedAt} running={step.status === 'running'} />
                  </div>
                </motion.div>
              </div>
            ))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
