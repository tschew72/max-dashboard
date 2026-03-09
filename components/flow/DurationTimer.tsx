'use client'
import { useState, useEffect } from 'react'

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

interface DurationTimerProps {
  startedAt: string
  running: boolean
}

export default function DurationTimer({ startedAt, running }: DurationTimerProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(startedAt).getTime())

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt, running])

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', color: '#94a3b8', fontSize: 12 }}>
      {formatDuration(elapsed)}
    </span>
  )
}
