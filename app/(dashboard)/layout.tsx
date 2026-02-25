import BottomNav from '@/components/ui/BottomNav'
import { CommandPalette } from '@/components/CommandPalette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </div>
      <BottomNav />
      <CommandPalette />
    </div>
  )
}
