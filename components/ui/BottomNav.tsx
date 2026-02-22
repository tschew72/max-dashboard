'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckSquare, Activity, Settings, MessageCircle, Home } from 'lucide-react'

const tabs = [
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/activity', icon: Activity, label: 'Activity' },
  { href: '/jobs', icon: Settings, label: 'Jobs' },
  { href: '/comms', icon: MessageCircle, label: 'Comms' },
  { href: '/', icon: Home, label: 'Home' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ href, icon: Icon, label }) => {
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
      </div>
    </nav>
  )
}
