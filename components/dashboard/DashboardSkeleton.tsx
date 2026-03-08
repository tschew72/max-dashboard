'use client'

export function PanelSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 space-y-3 ${className}`} style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="animate-pulse rounded h-4 w-32" style={{ background: 'var(--border)' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded h-8 w-full" style={{ background: 'var(--border)' }} />
      ))}
    </div>
  )
}

export function StatChipSkeleton() {
  return <div className="animate-pulse rounded-xl h-20 flex-1" style={{ background: 'var(--border)' }} />
}
