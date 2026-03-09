'use client'
import { useEffect, useState } from 'react'

interface Metrics {
  cpu: number
  mem: number
  disk: number
}

function getColor(pct: number): string {
  if (pct < 0) return '#8b949e'
  if (pct < 60) return '#3fb950'
  if (pct < 80) return '#d29922'
  return '#f85149'
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const color = getColor(value)
  const display = value < 0 ? 'N/A' : `${value}%`

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold tracking-wider" style={{ color: '#8b949e', minWidth: 32 }}>
        {label}
      </span>
      <div
        className="rounded-full overflow-hidden"
        style={{ width: 80, height: 8, background: '#21262d' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: value < 0 ? 0 : `${Math.min(100, value)}%`,
            background: color,
            transition: 'width 0.5s ease, background 0.5s ease',
          }}
        />
      </div>
      <span
        className="text-[11px] font-bold font-mono"
        style={{ color, minWidth: 32, textAlign: 'right' }}
      >
        {display}
      </span>
    </div>
  )
}

export default function SystemMetricsBar() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  useEffect(() => {
    const fetchMetrics = () =>
      fetch('/api/system/metrics')
        .then(r => r.json())
        .then(setMetrics)
        .catch(() => {})
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 10000)
    return () => clearInterval(interval)
  }, [])

  if (!metrics) return null

  return (
    <div
      className="flex items-center justify-center gap-6 flex-wrap py-2 px-4 rounded-xl"
      style={{
        background: '#161b22',
        border: '1px solid #21262d',
      }}
    >
      <MetricBar label="CPU" value={metrics.cpu} />
      <MetricBar label="RAM" value={metrics.mem} />
      <MetricBar label="DISK" value={metrics.disk} />
    </div>
  )
}
