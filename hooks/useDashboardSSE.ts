'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { SSEEventType } from '@/types/dashboard'

type SSEHandler = (data: unknown) => void

export function useDashboardSSE() {
  const [connected, setConnected] = useState(false)
  const handlersRef = useRef<Map<SSEEventType, SSEHandler>>(new Map())
  const esRef = useRef<EventSource | null>(null)

  const subscribe = useCallback((type: SSEEventType, handler: SSEHandler) => {
    handlersRef.current.set(type, handler)
    return () => { handlersRef.current.delete(type) }
  }, [])

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      const es = new EventSource('/api/dashboard/stream')
      esRef.current = es

      es.onopen = () => setConnected(true)

      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          const type = msg.type as SSEEventType
          if (type === 'ping') return
          const handler = handlersRef.current.get(type)
          if (handler) handler(msg.data)
        } catch { /* ignore */ }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      esRef.current?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])

  return { connected, subscribe }
}
