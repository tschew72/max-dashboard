'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  Home, CheckSquare, Calendar, Monitor, Settings,
  Briefcase, Bot, BarChart2, MessageCircle, Brain, Shield,
  ChevronLeft, ChevronRight, Activity, GitBranch,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/jobs', icon: Briefcase, label: 'Jobs' },
  { href: '/agents', icon: Bot, label: 'Agents' },
  { href: '/flow', icon: GitBranch, label: 'Flow' },
  { href: '/activity', icon: Activity, label: 'Activity' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/comms', icon: MessageCircle, label: 'Comms' },
  { href: '/brain', icon: Brain, label: 'Brain' },
  { href: '/shield', icon: Shield, label: 'Shield' },
  { href: '/system', icon: Monitor, label: 'System' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0"
      style={{
        width: collapsed ? 56 : 200,
        background: '#161b22',
        borderRight: '1px solid #21262d',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Logo area */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ height: 56, borderBottom: '1px solid #21262d' }}
      >
        {!collapsed && (
          <span style={{ color: '#e6edf3', fontWeight: 700, fontSize: 14 }}>⚡ Max</span>
        )}
        <button
          onClick={toggle}
          className="ml-auto flex items-center justify-center"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: '#21262d', color: '#8b949e', border: 'none', cursor: 'pointer',
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg transition-colors"
              style={{
                padding: collapsed ? '8px 0' : '8px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? '#388bfd18' : 'transparent',
                color: active ? '#388bfd' : '#8b949e',
                borderLeft: active ? '3px solid #388bfd' : '3px solid transparent',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
              }}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.5} />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
