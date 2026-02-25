'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CheckSquare, Calendar, Monitor, Settings, MoreHorizontal, Briefcase, Bot, BarChart2, MessageCircle, X, Brain, Shield } from 'lucide-react'
import { useState } from 'react'

const primaryTabs = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/system', icon: Monitor, label: 'System' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const moreTabs = [
  { href: '/jobs', icon: Briefcase, label: 'Jobs' },
  { href: '/agents', icon: Bot, label: 'Agents' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/comms', icon: MessageCircle, label: 'Comms' },
  { href: '/brain', icon: Brain, label: 'Brain' },
  { href: '/shield', icon: Shield, label: 'Shield' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = moreTabs.some(t => pathname.startsWith(t.href))

  return (
    <>
      {/* More panel overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More panel slide-up */}
      <div
        className="fixed left-0 right-0 z-50 rounded-t-2xl transition-transform duration-300"
        style={{
          bottom: moreOpen ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : '-200px',
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          padding: '16px',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>More</span>
          <button onClick={() => setMoreOpen(false)} style={{ color: 'var(--muted)' }}><X size={16} /></button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {moreTabs.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl"
                style={{
                  background: active ? 'var(--accent)' + '22' : 'var(--bg)',
                  color: active ? 'var(--accent-light)' : 'var(--muted)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Main bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex items-center justify-around h-16">
          {primaryTabs.map(({ href, icon: Icon, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
                style={{ color: active ? 'var(--accent-light)' : 'var(--muted)' }}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
            style={{ color: isMoreActive || moreOpen ? 'var(--accent-light)' : 'var(--muted)' }}
            onClick={() => setMoreOpen(v => !v)}
          >
            <MoreHorizontal size={22} strokeWidth={moreOpen ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
