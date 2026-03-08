'use client'
import { useEffect } from 'react'
import { Mail, CheckCircle2, AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { usePanelFetch } from '@/hooks/usePanelFetch'
import { PanelSkeleton } from './DashboardSkeleton'
import type { GmailPanelData } from '@/types/dashboard'

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function PhishingBadge({ verdict }: { verdict: string }) {
  switch (verdict) {
    case 'blocked':
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: '#ff5630', background: '#ff563022' }}>🚫 Blocked</span>
    case 'suspicious':
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: '#ff8b00', background: '#ff8b0022' }}>⚠ Suspicious</span>
    default:
      return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: '#36b37e', background: '#36b37e22' }}>🛡 Safe</span>
  }
}

export default function GmailInboxPanel({ onSSERefresh }: { onSSERefresh?: number }) {
  const { data, loading, refetch } = usePanelFetch<GmailPanelData>('/api/dashboard/gmail')

  useEffect(() => {
    if (onSSERefresh) refetch()
  }, [onSSERefresh, refetch])

  if (loading || !data) return <PanelSkeleton rows={3} />

  const { messages, unreadCount } = data

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          <Mail size={11} /> Gmail Inbox
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#0052cc', color: 'var(--text)' }}>
              {unreadCount}
            </span>
          )}
        </p>
        <Link href="/comms" className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: '#0052cc22', color: '#579dff' }}>
          View all →
        </Link>
      </div>

      {messages.length === 0 ? (
        <div className="px-4 pb-4 pt-1 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <Mail size={14} />
          <p className="text-sm">No recent emails</p>
        </div>
      ) : (
        <div className="px-3 pb-3 space-y-1">
          {messages.map(msg => (
            <div key={msg.id} className="rounded-lg px-2.5 py-2"
              style={{
                background: msg.isRead ? '#161b22' : '#0d1117',
                border: `1px solid ${msg.isRead ? '#21262d' : '#0052cc44'}`,
                borderLeft: msg.isRead ? undefined : '3px solid #579dff',
              }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium flex-1 truncate" style={{ color: msg.isRead ? 'var(--muted)' : 'var(--text)' }}>
                  {msg.fromName}
                </span>
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--muted)' }}>{relTime(msg.receivedAt)}</span>
              </div>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: msg.isRead ? 'var(--muted)' : 'var(--text)' }}>
                {msg.subject}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <PhishingBadge verdict={msg.phishingVerdict} />
                {msg.actionStatus === 'executed' ? (
                  <span className="text-[10px]" style={{ color: '#36b37e' }}>✅ Executed</span>
                ) : (
                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>📨 Received</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
