'use client'
import { useState, useEffect, useRef } from 'react'
import ActiveChainView from '@/components/flow/ActiveChainView'
import SystemOverview from '@/components/flow/SystemOverview'
import type { FlowState } from '@/lib/flow/parse-sessions'

function LoadingSkeleton() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 12,
    }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          background: 'rgba(13, 13, 26, 0.6)',
          borderRadius: 12,
          height: 120,
          animation: 'skeletonPulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 100}ms`,
        }} />
      ))}
    </div>
  )
}

export default function FlowPage() {
  const [state, setState] = useState<FlowState | null>(null)
  const [mode, setMode] = useState<'active' | 'overview'>('overview')
  const [transitioning, setTransitioning] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Initial fetch
  useEffect(() => {
    fetch('/api/flow/agents')
      .then(res => res.json())
      .then((data: FlowState) => {
        setState(data)
        setMode(data.activeChains.length > 0 ? 'active' : 'overview')
      })
      .catch(() => {
        setState({ activeChains: [], agents: [], recentActivity: [] })
      })
  }, [])

  // SSE subscription
  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource('/api/flow/stream')
      eventSourceRef.current = es

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'state') {
            const newState: FlowState = msg.data
            setState(newState)

            const shouldBeActive = newState.activeChains.length > 0
            setMode(prev => {
              if (prev !== (shouldBeActive ? 'active' : 'overview')) {
                setTransitioning(true)
                setTimeout(() => setTransitioning(false), 300)
                return shouldBeActive ? 'active' : 'overview'
              }
              return prev
            })
          }
        } catch { /* ignore */ }
      }

      es.onerror = () => {
        es?.close()
        reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      es?.close()
      clearTimeout(reconnectTimer)
    }
  }, [])

  // Fallback poll
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/flow/agents')
        if (res.ok) {
          const data: FlowState = await res.json()
          setState(data)
          setMode(data.activeChains.length > 0 ? 'active' : 'overview')
        }
      } catch { /* next interval */ }
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a12',
      color: '#e2e8f0',
      padding: 24,
    }}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        padding: '0 4px',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
          Agent Flow
        </h1>
        <div>
          {mode === 'active' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a78bfa', fontSize: 13 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#7c3aed',
                animation: 'flowPulse 2s ease-in-out infinite',
              }} />
              Live Activity
            </span>
          ) : (
            <span style={{ color: '#64748b', fontSize: 13 }}>
              System Overview
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{
        transition: 'opacity 0.3s ease',
        opacity: transitioning ? 0.5 : 1,
      }}>
        {state === null ? (
          <LoadingSkeleton />
        ) : mode === 'active' ? (
          <ActiveChainView chains={state.activeChains} />
        ) : (
          <SystemOverview
            agents={state.agents}
            recentActivity={state.recentActivity}
          />
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes flowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(124, 58, 237, 0); }
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes spawnEdgePulse {
          0% { top: 0; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: calc(100% - 6px); opacity: 0; }
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @media (max-width: 768px) {
          .flow-page { padding: 12px !important; }
        }
      `}</style>
    </div>
  )
}
