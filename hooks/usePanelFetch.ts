'use client'
import { useState, useEffect, useCallback } from 'react'
import type { DashboardPanel } from '@/types/dashboard'

export function usePanelFetch<T>(url: string, interval?: number): DashboardPanel<T> & { refetch: () => void } {
  const [state, setState] = useState<DashboardPanel<T>>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as T
      setState({ data, loading: false, error: null, lastUpdated: Date.now() })
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Fetch failed',
      }))
    }
  }, [url])

  useEffect(() => {
    fetchData()
    if (interval && interval > 0) {
      const id = setInterval(fetchData, interval)
      return () => clearInterval(id)
    }
  }, [fetchData, interval])

  return { ...state, refetch: fetchData }
}
