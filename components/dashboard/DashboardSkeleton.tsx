'use client'

export function PanelSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 space-y-3 ${className}`} style={{ background: '#22272b', border: '1px solid #2c333a' }}>
      <div className="animate-pulse rounded h-4 w-32" style={{ background: '#2c333a' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded h-8 w-full" style={{ background: '#2c333a' }} />
      ))}
    </div>
  )
}

export function StatChipSkeleton() {
  return <div className="animate-pulse rounded-xl h-20 flex-1" style={{ background: '#2c333a' }} />
}
