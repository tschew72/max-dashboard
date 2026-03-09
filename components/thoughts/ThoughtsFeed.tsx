'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

interface ThoughtEntry {
  id: string
  type: 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'session' | 'model_change' | 'usage' | 'other'
  content: string
  timestamp?: string
  raw?: any
}

function parseThought(data: any): ThoughtEntry[] {
  const entries: ThoughtEntry[] = []
  const ts = data.timestamp || ''
  const id = data.id || Math.random().toString(36).slice(2)

  if (data.type === 'session') {
    entries.push({ id, type: 'session', content: `Session started: ${data.id}`, timestamp: ts })
    return entries
  }

  if (data.type === 'model_change') {
    entries.push({ id, type: 'model_change', content: `Model: ${data.modelId}`, timestamp: ts })
    return entries
  }

  if (data.type === 'message' && data.message) {
    const msg = data.message
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'thinking' && block.thinking) {
          entries.push({ id: `${id}-think`, type: 'thinking', content: block.thinking, timestamp: ts })
        } else if (block.type === 'text' && block.text) {
          entries.push({ id: `${id}-text`, type: 'text', content: block.text, timestamp: ts })
        } else if (block.type === 'toolCall' || block.type === 'tool_use') {
          const name = block.name || block.toolName || 'unknown'
          const input = block.input ? JSON.stringify(block.input).slice(0, 200) : ''
          entries.push({ id: `${id}-tool-${name}`, type: 'tool_call', content: `${name}(${input})`, timestamp: ts })
        }
      }
    } else if (msg.role === 'toolResult' || msg.role === 'tool') {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '').slice(0, 200)
      entries.push({ id: `${id}-result`, type: 'tool_result', content, timestamp: ts })
    }
    return entries
  }

  return entries
}

const TYPE_STYLES: Record<string, { color: string; prefix: string; italic?: boolean; opacity?: number; mono?: boolean }> = {
  thinking: { color: '#a78bfa', prefix: '💭', italic: true, opacity: 0.7, mono: true },
  text: { color: '#e6edf3', prefix: '💬', mono: false },
  tool_call: { color: '#58a6ff', prefix: '🔧', mono: true },
  tool_result: { color: '#3fb950', prefix: '✓', mono: true },
  session: { color: '#484f58', prefix: '▶', mono: false },
  model_change: { color: '#484f58', prefix: '🔄', mono: false },
  usage: { color: '#484f58', prefix: '📊', mono: true },
  other: { color: '#8b949e', prefix: '·', mono: false },
}

export default function ThoughtsFeed({
  agent = 'main',
  maxLines = 50,
  compact = false,
}: {
  agent?: string
  maxLines?: number
  compact?: boolean
}) {
  const [entries, setEntries] = useState<ThoughtEntry[]>([])
  const [connected, setConnected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Auto-scroll tracking
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    autoScrollRef.current = atBottom
  }, [])

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [entries])

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let retryDelay = 1000

    function connect() {
      es = new EventSource(`/api/thoughts/stream?agent=${agent}&lines=${maxLines}`)

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'connected') {
            setConnected(true)
            retryDelay = 1000
            return
          }
          if (parsed.type === 'ping') return
          if (parsed.type === 'session_change') {
            setEntries([])
            return
          }
          if (parsed.type === 'thought' && parsed.data) {
            const newEntries = parseThought(parsed.data)
            if (newEntries.length > 0) {
              setEntries(prev => {
                const combined = [...prev, ...newEntries]
                return combined.slice(-200) // keep last 200
              })
            }
          }
        } catch { /* ignore */ }
      }

      es.onerror = () => {
        setConnected(false)
        es?.close()
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000)
          connect()
        }, retryDelay)
      }
    }

    connect()
    return () => {
      es?.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [agent, maxLines])

  const displayEntries = compact ? entries.slice(-5) : entries

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            🧠 Live Thoughts
          </span>
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: connected ? '#3fb950' : '#f85149',
              boxShadow: connected ? '0 0 6px #3fb950' : '0 0 6px #f85149',
            }}
          />
        </div>
        {compact && (
          <a href="/thoughts" className="text-[10px] font-semibold" style={{ color: '#579dff' }}>
            Full View →
          </a>
        )}
      </div>

      {/* Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto"
        style={{
          height: compact ? 200 : 500,
          padding: '8px 12px',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: compact ? 11 : 12,
          lineHeight: 1.5,
        }}
      >
        {displayEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--muted)' }}>
            <span className="text-sm">Waiting for thoughts…</span>
          </div>
        ) : (
          displayEntries.map((entry, i) => {
            const style = TYPE_STYLES[entry.type] || TYPE_STYLES.other
            return (
              <div
                key={`${entry.id}-${i}`}
                className="py-0.5"
                style={{
                  color: style.color,
                  fontStyle: style.italic ? 'italic' : 'normal',
                  opacity: style.opacity || 1,
                  fontFamily: style.mono ? "'JetBrains Mono', monospace" : 'inherit',
                }}
              >
                <span className="mr-1.5 select-none">{style.prefix}</span>
                <span style={{ wordBreak: 'break-word' }}>
                  {entry.content.length > (compact ? 150 : 500)
                    ? entry.content.slice(0, compact ? 150 : 500) + '…'
                    : entry.content}
                </span>
              </div>
            )
          })
        )}
        <div ref={sentinelRef} />
      </div>

      {/* Scroll indicator */}
      {!compact && !autoScrollRef.current && entries.length > 10 && (
        <button
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight
              autoScrollRef.current = true
            }
          }}
          className="w-full py-1.5 text-[11px] font-semibold text-center"
          style={{ background: '#161b22', color: '#579dff', borderTop: '1px solid var(--border)', cursor: 'pointer', border: 'none' }}
        >
          ↓ New thoughts
        </button>
      )}
    </div>
  )
}
