'use client'

export default function PageHeader({
  title,
  emoji,
  actions,
  subtitle,
  sticky = true,
}: {
  title: string
  emoji?: string
  actions?: React.ReactNode
  subtitle?: string
  sticky?: boolean
}) {
  return (
    <div
      className={`${sticky ? 'sticky top-0 z-40' : ''} px-4 py-3 flex items-center gap-3 flex-shrink-0`}
      style={{ background: '#1d2125', borderBottom: '1px solid #2c333a' }}
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-white flex items-center gap-2">
          {emoji && <span>{emoji}</span>}
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: '#626f86' }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
