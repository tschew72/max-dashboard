'use client'
import { useEffect } from 'react'
import { Server, CheckCircle2, AlertTriangle, Container } from 'lucide-react'
import Link from 'next/link'
import { usePanelFetch } from '@/hooks/usePanelFetch'
import { PanelSkeleton } from './DashboardSkeleton'
import type { InfraPanelData } from '@/types/dashboard'

function StatusBadge({ status }: { status: string }) {
  const isOnline = status === 'online' || status === 'running'
  const isError = status === 'errored' || status === 'exited'
  const color = isOnline ? '#36b37e' : isError ? '#ff5630' : '#626f86'
  const bg = isOnline ? '#36b37e22' : isError ? '#ff563022' : '#626f8622'
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color, background: bg }}>
      {status}
    </span>
  )
}

function formatUptime(ms: number): string {
  if (!ms) return '—'
  const totalSec = Math.floor((Date.now() - ms) / 1000)
  if (totalSec < 60) return `${totalSec}s`
  if (totalSec < 3600) return `${Math.floor(totalSec / 60)}m`
  if (totalSec < 86400) return `${Math.floor(totalSec / 3600)}h`
  return `${Math.floor(totalSec / 86400)}d`
}

export default function InfraHealthPanel({ onSSERefresh }: { onSSERefresh?: number }) {
  const { data, loading, refetch } = usePanelFetch<InfraPanelData>('/api/dashboard/infra')

  useEffect(() => {
    if (onSSERefresh) refetch()
  }, [onSSERefresh, refetch])

  if (loading || !data) return <PanelSkeleton rows={4} />

  const { pm2, docker, pm2Count, dockerCount, errorCount } = data

  // Sort: errored/stopped first
  const sortedPM2 = [...pm2].sort((a, b) => {
    if (a.status !== 'online' && b.status === 'online') return -1
    if (a.status === 'online' && b.status !== 'online') return 1
    return 0
  })

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#626f86' }}>
          <Server size={11} /> Infrastructure
        </p>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: '#ff563022', color: '#ff8f73' }}>
              <AlertTriangle size={9} /> {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[10px]" style={{ color: '#626f86' }}>
            {pm2Count} processes · {dockerCount} containers
          </span>
        </div>
      </div>

      {/* PM2 */}
      <div className="px-3 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider px-1 pb-1.5 pt-1" style={{ color: '#3d4f61' }}>PM2</p>
        <div className="space-y-1">
          {sortedPM2.map(p => (
            <Link href="/system" key={p.name}>
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                style={{
                  background: p.status !== 'online' ? '#1a0e0e' : '#161b22',
                  border: `1px solid ${p.status !== 'online' ? '#5a1d1d' : '#21262d'}`,
                }}>
                <span className="text-xs font-medium text-white flex-1 truncate">{p.name}</span>
                <StatusBadge status={p.status} />
                <span className="text-[10px] w-8 text-right" style={{ color: '#626f86' }}>{formatUptime(p.uptime)}</span>
                <span className="text-[10px] w-10 text-right" style={{ color: '#626f86' }}>{p.memory}MB</span>
                {p.restarts > 0 && (
                  <span className="text-[10px]" style={{ color: '#ff8f73' }}>↻{p.restarts}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Docker */}
      {docker.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider px-1 pb-1.5 pt-1 flex items-center gap-1" style={{ color: '#3d4f61' }}>
            <Container size={9} /> Docker
          </p>
          <div className="space-y-1">
            {docker.map(c => (
              <div key={c.name} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                style={{
                  background: c.state !== 'running' ? '#1a0e0e' : '#161b22',
                  border: `1px solid ${c.state !== 'running' ? '#5a1d1d' : '#21262d'}`,
                }}>
                <span className="text-xs font-medium text-white flex-1 truncate">{c.name}</span>
                <StatusBadge status={c.state} />
                <span className="text-[10px]" style={{ color: '#626f86' }}>{c.uptime}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
