'use client'
import { useEffect } from 'react'
import { Shield, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { usePanelFetch } from '@/hooks/usePanelFetch'
import { PanelSkeleton } from './DashboardSkeleton'
import type { PromptDomePanelData } from '@/types/dashboard'

function VerdictBadge({ verdict }: { verdict: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    block: { color: '#ff5630', bg: '#ff563022', label: 'BLOCK' },
    warn:  { color: '#ff8b00', bg: '#ff8b0022', label: 'WARN' },
    allow: { color: '#36b37e', bg: '#36b37e22', label: 'ALLOW' },
  }
  const c = config[verdict] || config.allow
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  )
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function PromptDomePanel({ onSSERefresh }: { onSSERefresh?: number }) {
  const { data, loading, refetch } = usePanelFetch<PromptDomePanelData>('/api/dashboard/promptdome')

  useEffect(() => {
    if (onSSERefresh) refetch()
  }, [onSSERefresh, refetch])

  if (loading || !data) return <PanelSkeleton rows={4} />

  const { todayTotal, blockCount, warnCount, allowCount, topCategories, recentScans, customerCount } = data
  const barTotal = blockCount + warnCount + allowCount
  const blockPct = barTotal > 0 ? (blockCount / barTotal) * 100 : 0
  const warnPct = barTotal > 0 ? (warnCount / barTotal) * 100 : 0
  const allowPct = barTotal > 0 ? (allowCount / barTotal) * 100 : 0

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          <Shield size={11} /> PromptDome
        </p>
        <div className="flex items-center gap-2">
          {customerCount > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{customerCount} customer{customerCount !== 1 ? 's' : ''}</span>
          )}
          <Link href="/shield" className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#0052cc22', color: '#579dff' }}>
            View details →
          </Link>
        </div>
      </div>

      <div className="px-4 pb-3">
        {/* Hero stat */}
        <div className="text-center py-2">
          <p className="text-3xl font-bold text-white">{todayTotal.toLocaleString()}</p>
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>scans today</p>
        </div>

        {/* Breakdown bar */}
        <div className="mt-2">
          <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            {blockPct > 0 && <div style={{ width: `${blockPct}%`, background: '#ff5630' }} />}
            {warnPct > 0 && <div style={{ width: `${warnPct}%`, background: '#ff8b00' }} />}
            {allowPct > 0 && <div style={{ width: `${allowPct}%`, background: '#36b37e' }} />}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px]" style={{ color: '#ff5630' }}>🚫 {blockCount} block</span>
            <span className="text-[10px]" style={{ color: '#ff8b00' }}>⚠️ {warnCount} warn</span>
            <span className="text-[10px]" style={{ color: '#36b37e' }}>✅ {allowCount} allow</span>
          </div>
        </div>

        {/* Top categories */}
        {topCategories.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--border)' }}>
              Top Threats (7d)
            </p>
            <div className="space-y-1">
              {topCategories.map((cat, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
                  style={{ background: '#161b22', border: '1px solid #21262d' }}>
                  <span className="text-xs text-white truncate flex-1">{cat.category}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#ff563022', color: '#ff8f73' }}>
                    {cat.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        {recentScans.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--border)' }}>
              Recent Scans
            </p>
            <div className="space-y-1">
              {recentScans.map(scan => (
                <div key={scan.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                  style={{ background: '#161b22', border: '1px solid #21262d' }}>
                  <VerdictBadge verdict={scan.recommendation} />
                  <span className="text-[10px] text-white flex-1 truncate">{scan.textPreview}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--muted)' }}>{relTime(scan.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
