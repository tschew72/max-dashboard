'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Cpu, HardDrive, MemoryStick, Clock, Play, Square, RotateCcw, ArrowDownUp, Layers } from 'lucide-react'

interface SystemData {
  cpu: { load1: number; load5: number; load15: number; count: number; pct: number }
  ram: { usedPct: number; usedGb: string; totalGb: string }
  disk: { used: string; total: string; pct: number }
  uptime: { seconds: number; str: string }
  hostname: string
  pm2: Pm2Process[]
  swap: { used: string; total: string; pct: number }
  network: { rxBytes: number; txBytes: number; interface: string }
}

interface Pm2Process {
  id: number
  name: string
  pid: number
  status: string
  cpu: number
  memory: number
  memoryMb: number
  pm_uptime: number
  restart_time: number
}

function StatCard({ icon, label, value, sub, pct, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string
  pct?: number; color?: string
}) {
  const accent = color ?? '#7c3aed'
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: accent }}>{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</span>
        </div>
        {pct !== undefined && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: accent + '22', color: accent }}>
            {pct}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{sub}</div>}
      {pct !== undefined && (
        <div className="mt-3 rounded-full overflow-hidden h-1.5" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%`, background: pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : accent }} />
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    online: { bg: '#36b37e22', fg: '#57d9a3' },
    stopped: { bg: '#ff563022', fg: '#ff8f73' },
    errored: { bg: '#ff563022', fg: '#ff5630' },
    stopping: { bg: '#ff8b0022', fg: '#ffab00' },
    launching: { bg: '#0052cc22', fg: '#579dff' },
  }
  const c = colors[status] ?? { bg: 'var(--border)', fg: 'var(--muted)' }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.fg }}>
      {status}
    </span>
  )
}

function uptimeStr(ms: number): string {
  if (!ms) return '—'
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

export default function SystemPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/system')
      const json = await res.json()
      setData(json)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  const pm2Action = async (name: string, action: string) => {
    const key = `${name}-${action}`
    setActionState(s => ({ ...s, [key]: 'pending' }))
    try {
      const res = await fetch(`/api/system/pm2/${encodeURIComponent(name)}/${action}`, { method: 'POST' })
      const json = await res.json()
      setActionState(s => ({ ...s, [key]: json.ok ? 'ok' : 'err' }))
      setTimeout(() => {
        setActionState(s => { const n = { ...s }; delete n[key]; return n })
        fetchData()
      }, 2000)
    } catch {
      setActionState(s => ({ ...s, [key]: 'err' }))
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-bold flex-1" style={{ color: 'var(--text)' }}>
          🖥 System
        </h1>
        <button onClick={fetchData}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'var(--card)', color: 'var(--muted)' }}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-2xl h-28 animate-pulse" style={{ background: 'var(--card)' }} />
            ))
          ) : data ? (
            <>
              <StatCard
                icon={<Cpu size={16} />}
                label="CPU Load (1m)"
                value={data.cpu.load1.toFixed(2)}
                sub={`${data.cpu.count} cores · 5m: ${data.cpu.load5.toFixed(2)}`}
                pct={Math.min(data.cpu.pct, 100)}
                color="#7c3aed"
              />
              <StatCard
                icon={<MemoryStick size={16} />}
                label="RAM Used"
                value={`${data.ram.usedGb} GB`}
                sub={`of ${data.ram.totalGb} GB total`}
                pct={data.ram.usedPct}
                color="#0ea5e9"
              />
              <StatCard
                icon={<HardDrive size={16} />}
                label="Disk Used"
                value={data.disk.used}
                sub={`of ${data.disk.total} total`}
                pct={data.disk.pct}
                color="#f59e0b"
              />
              <StatCard
                icon={<Clock size={16} />}
                label="Uptime"
                value={data.uptime.str}
                sub={data.hostname}
                color="#10b981"
              />
              <StatCard
                icon={<Layers size={16} />}
                label="Swap Used"
                value={data.swap.used}
                sub={`of ${data.swap.total} total`}
                pct={data.swap.pct}
                color="#8b5cf6"
              />
              <StatCard
                icon={<ArrowDownUp size={16} />}
                label="Network I/O"
                value={fmtBytes(data.network.rxBytes)}
                sub={`TX: ${fmtBytes(data.network.txBytes)} · ${data.network.interface}`}
                color="#06b6d4"
              />
            </>
          ) : null}
        </div>

        {/* PM2 process list */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            PM2 Processes
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl h-16 animate-pulse" style={{ background: 'var(--card)' }} />
              ))}
            </div>
          ) : !data?.pm2?.length ? (
            <div className="rounded-xl p-6 text-center text-sm" style={{ background: 'var(--card)', color: 'var(--muted)' }}>
              No PM2 processes found
            </div>
          ) : (
            <div className="space-y-2">
              {data.pm2.map((proc) => (
                <div key={proc.id} className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{proc.name}</span>
                        <StatusBadge status={proc.status} />
                      </div>
                      <div className="text-[11px] mt-0.5 flex gap-3" style={{ color: 'var(--muted)' }}>
                        <span>PID {proc.pid}</span>
                        <span>Up: {uptimeStr(proc.pm_uptime)}</span>
                        <span>↺ {proc.restart_time}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>{proc.cpu.toFixed(1)}% CPU</div>
                      <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{proc.memoryMb} MB</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => pm2Action(proc.name, 'restart')}
                      disabled={actionState[`${proc.name}-restart`] === 'pending'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                      style={{ background: '#0052cc22', color: '#579dff', border: '1px solid #0052cc44' }}
                    >
                      <RotateCcw size={11} className={actionState[`${proc.name}-restart`] === 'pending' ? 'animate-spin' : ''} />
                      {actionState[`${proc.name}-restart`] === 'ok' ? 'Restarted!' : actionState[`${proc.name}-restart`] === 'err' ? 'Error' : 'Restart'}
                    </button>
                    <button
                      onClick={() => pm2Action(proc.name, 'stop')}
                      disabled={actionState[`${proc.name}-stop`] === 'pending' || proc.status !== 'online'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                      style={{ background: '#ff563022', color: '#ff8f73', border: '1px solid #ff563044' }}
                    >
                      <Square size={11} />
                      {actionState[`${proc.name}-stop`] === 'ok' ? 'Stopped!' : 'Stop'}
                    </button>
                    {proc.status !== 'online' && (
                      <button
                        onClick={() => pm2Action(proc.name, 'start')}
                        disabled={actionState[`${proc.name}-start`] === 'pending'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                        style={{ background: '#36b37e22', color: '#57d9a3', border: '1px solid #36b37e44' }}
                      >
                        <Play size={11} />
                        {actionState[`${proc.name}-start`] === 'ok' ? 'Started!' : 'Start'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
