'use client'

export default function PageHeader({
  title,
  emoji,
  actions,
  subtitle,
  sticky = true,
  badge,
}: {
  title: string
  emoji?: string
  actions?: React.ReactNode
  subtitle?: string
  sticky?: boolean
  badge?: { text: string; color?: string }
}) {
  return (
    <div
      className={`${sticky ? 'sticky top-0 z-40' : ''} px-4 py-3 flex items-center gap-3 flex-shrink-0`}
      style={{ background: 'var(--bg, #1d2125)', borderBottom: '1px solid var(--border, #2c333a)' }}
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text, #fff)' }}>
          {emoji && <span>{emoji}</span>}
          {title}
          {badge && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: (badge.color ?? '#7c3aed') + '22', color: badge.color ?? '#7c3aed' }}
            >
              {badge.text}
            </span>
          )}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted, #626f86)' }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
