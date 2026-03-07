import BottomNav from '@/components/ui/BottomNav'
import Sidebar from '@/components/ui/Sidebar'
import { CommandPalette } from '@/components/CommandPalette'
import { ToastProvider } from '@/components/ui/Toast'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
        <Sidebar />
        <div className="flex-1 min-w-0">
          <div className="md:pb-0" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
            {children}
          </div>
        </div>
        <div className="md:hidden">
          <BottomNav />
        </div>
        <CommandPalette />
      </div>
    </ToastProvider>
  )
}
