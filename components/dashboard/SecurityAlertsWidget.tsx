'use client'
import { useEffect } from 'react'
import { ShieldAlert, AlertTriangle, Info, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { usePanelFetch } from '@/hooks/usePanelFetch'
import type { SecurityPanelData, SecurityAlert } from '@/types/dashboard'

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <ShieldAlert size={14} style={{ color: '#ff5630' }} />
    case 'warning':
      return <AlertTriangle size={14} style={{ color: '#ff8b00' }} />
    default:
      return <Info size={14} style={{ color: '#579dff' }} />
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    critical: { color: '#ff5630', bg: '#ff563022' },
    warning:  { color: '#ff8b00', bg: '#ff8b0022' },
    info:     { color: '#579dff', bg: '#579dff22' },
  }
  const c = config[severity] || config.info
  return (
    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full" style={{ color: c.color, background: c.bg }}>
      {severity}
    </span>
  )
}

export default function SecurityAlertsWidget({ onSSERefresh }: { onSSERefresh?: number }) {
  const { data, loading, refetch } = usePanelFetch<SecurityPanelData>('/api/dashboard/security')

  useEffect(() => {
    if (onSSERefresh) refetch()
  }, [onSSERefresh, refetch])

  // Don't render anything if loading or no alerts
  if (loading || !data || data.alerts.length === 0) return null

  const { alerts, criticalCount, warningCount } = data
  const totalCount = alerts.length
  const headerParts: string[] = []
  if (criticalCount > 0) headerParts.push(`${criticalCount} critical`)
  if (warningCount > 0) headerParts.push(`${warningCount} warning`)

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        background: '#22272b',
        border: `1px solid ${criticalCount > 0 ? '#ff563044' : '#ff8b0033'}`,
      }}>
      <div className="px-4 pt-3 pb-2 flex items-center gap-2"
        style={{ background: criticalCount > 0 ? '#ff563008' : '#ff8b0008' }}>
        <ShieldAlert size={12} style={{ color: criticalCount > 0 ? '#ff5630' : '#ff8b00' }} />
        <p className="text-xs font-semibold uppercase tracking-wider flex-1"
          style={{ color: criticalCount > 0 ? '#ff8f73' : '#ff8b00' }}>
          Security Alerts — {totalCount}
        </p>
        {headerParts.length > 0 && (
          <span className="text-[10px]" style={{ color: '#626f86' }}>
            {headerParts.join(' · ')}
          </span>
        )}
      </div>

      <div className="px-3 pb-3 pt-1 space-y-1">
        {alerts.slice(0, 5).map(alert => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
        {alerts.length > 5 && (
          <p className="text-center text-[10px] py-1" style={{ color: '#626f86' }}>
            +{alerts.length - 5} more alerts
          </p>
        )}
      </div>
    </div>
  )
}

function AlertRow({ alert }: { alert: SecurityAlert }) {
  const content = (
    <div className="flex items-start gap-2 rounded-lg px-2.5 py-2"
      style={{
        background: alert.severity === 'critical' ? '#1a0e0e' : '#161b22',
        border: `1px solid ${alert.severity === 'critical' ? '#5a1d1d' : '#21262d'}`,
      }}>
      <div className="pt-0.5 flex-shrink-0">
        <SeverityIcon severity={alert.severity} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white flex-1 truncate">{alert.title}</span>
          <span className="text-[10px] flex-shrink-0" style={{ color: '#626f86' }}>{relTime(alert.time)}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px]" style={{ color: '#626f86' }}>{alert.sourceLabel}</span>
          {alert.detail && (
            <span className="text-[10px] truncate" style={{ color: '#3d4f61' }}>{alert.detail}</span>
          )}
        </div>
      </div>
      {alert.link && <ChevronRight size={12} className="flex-shrink-0 mt-1" style={{ color: '#3d4f61' }} />}
    </div>
  )

  if (alert.link) {
    return <Link href={alert.link}>{content}</Link>
  }
  return content
}
