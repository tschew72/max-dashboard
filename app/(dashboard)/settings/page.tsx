'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, User, Palette, Clock, Info, Monitor, Sun, Moon } from 'lucide-react'

interface JWTPayload {
  sub?: string
  username?: string
  discriminator?: string
  avatar?: string
  discordId?: string
  iat?: number
  exp?: number
  [key: string]: unknown
}

interface ServerInfo {
  hostname: string
  nodeVersion: string
  openClawVersion: string
  uptime: string
  platform: string
  arch: string
}

function parseJwt(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    // Base64url → base64 → JSON
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      payload.length + (4 - (payload.length % 4)) % 4, '='
    )
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function getCookieToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--accent-light)' }}>{icon}</span>
        <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Row({ label, value, action }: { label: string; value?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value}</span>}
        {action}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [jwt, setJwt] = useState<JWTPayload | null>(null)
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null)
  const [compact, setCompact] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const token = getCookieToken()
    if (token) setJwt(parseJwt(token))

    // Load compact mode from localStorage
    setCompact(localStorage.getItem('compact-mode') === 'true')

    // Load theme
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null
    const currentTheme = savedTheme ?? 'dark'
    setTheme(currentTheme)
    document.documentElement.classList.toggle('light', currentTheme === 'light')

    // Fetch server info
    fetch('/api/settings/info').then(r => r.json()).then(setServerInfo).catch(() => {})
  }, [])

  const signOut = async () => {
    setSigningOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    router.push('/login')
  }

  const toggleCompact = (val: boolean) => {
    setCompact(val)
    localStorage.setItem('compact-mode', String(val))
    document.documentElement.classList.toggle('compact', val)
  }

  const toggleTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('light', newTheme === 'light')
  }

  // Derive Discord user info from JWT
  const discordId = jwt?.discordId ?? jwt?.sub ?? jwt?.id as string ?? null
  const username = jwt?.username ?? jwt?.name as string ?? 'Unknown'
  const avatar = jwt?.avatar as string ?? null
  const avatarUrl = discordId && avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/0.png`

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-3 flex items-center"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-base font-bold" style={{ color: 'var(--text)' }}>⚙️ Settings</h1>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* A: Profile */}
        <Section title="Profile" icon={<User size={16} />}>
          <div className="flex items-center gap-4 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={username} width={56} height={56}
              className="rounded-full" style={{ border: '2px solid var(--accent)' }}
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
            />
            <div>
              <div className="text-base font-bold" style={{ color: 'var(--text)' }}>{username}</div>
              {discordId && <div className="text-xs" style={{ color: 'var(--muted)' }}>ID: {discordId}</div>}
            </div>
          </div>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ background: '#ff563022', color: '#ff8f73', border: '1px solid #ff563044' }}
          >
            <LogOut size={15} />
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </Section>

        {/* B: Appearance */}
        <Section title="Appearance" icon={<Palette size={16} />}>
          <Row
            label="Compact mode"
            action={
              <button
                onClick={() => toggleCompact(!compact)}
                className="w-12 h-6 rounded-full transition-colors relative"
                style={{ background: compact ? 'var(--accent)' : 'var(--border)' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow"
                  style={{ left: compact ? '26px' : '2px' }}
                />
              </button>
            }
          />
          <Row
            label="Theme"
            value={
              <span className="flex items-center gap-1.5 text-sm">
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
            }
            action={
              <button
                onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-12 h-6 rounded-full transition-colors relative"
                style={{ background: theme === 'light' ? '#f59e0b' : 'var(--border)' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow"
                  style={{ left: theme === 'light' ? '26px' : '2px' }}
                />
              </button>
            }
          />
        </Section>

        {/* C: Session */}
        <Section title="Session" icon={<Clock size={16} />}>
          {jwt ? (
            <>
              <Row label="Issued" value={jwt.iat ? fmtDate(jwt.iat) : '—'} />
              <Row label="Expires" value={jwt.exp ? fmtDate(jwt.exp) : '—'} />
              {jwt.exp && (
                <Row
                  label="Status"
                  value={
                    <span style={{ color: jwt.exp * 1000 > Date.now() ? '#57d9a3' : '#ff8f73' }}>
                      {jwt.exp * 1000 > Date.now() ? '✅ Valid' : '❌ Expired'}
                    </span>
                  }
                />
              )}
              <div className="pt-3">
                <button
                  onClick={signOut}
                  disabled={signingOut}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  <LogOut size={15} />
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm text-center py-2" style={{ color: 'var(--muted)' }}>No session token found</div>
          )}
        </Section>

        {/* D: About */}
        <Section title="About" icon={<Info size={16} />}>
          {serverInfo ? (
            <>
              <Row label="Hostname" value={serverInfo.hostname} />
              <Row label="Node.js" value={serverInfo.nodeVersion} />
              <Row label="OpenClaw" value={serverInfo.openClawVersion.split(' ').slice(0, 2).join(' ')} />
              <Row label="Uptime" value={serverInfo.uptime} />
              <Row label="Platform" value={`${serverInfo.platform} (${serverInfo.arch})`} />
            </>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: 'var(--bg)' }} />
              ))}
            </div>
          )}
        </Section>

        {/* App info */}
        <div className="text-center py-2">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Max Dashboard</div>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Monitor size={12} style={{ color: 'var(--muted)' }} />
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>dash.vincechew.me</span>
          </div>
        </div>
      </div>
    </div>
  )
}
