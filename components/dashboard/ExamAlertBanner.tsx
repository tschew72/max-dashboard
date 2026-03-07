'use client'
import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const EXAM_DATE = new Date('2026-03-09T21:30:00+08:00')
const DISMISS_KEY = 'exam-alert-dismissed-2026-03-09'

export default function ExamAlertBanner() {
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flash
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const diff = EXAM_DATE.getTime() - now.getTime()
  if (diff <= 0 || dismissed) return null

  const totalMins = Math.floor(diff / 60000)
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60

  const isUrgent = diff < 24 * 60 * 60 * 1000
  const bgColor = isUrgent ? '#dc2626' : '#7c3aed'

  const countdownText = days > 0
    ? `${days}d ${hours}h ${mins}m`
    : `${hours}h ${mins}m`

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${bgColor}44` }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: `${bgColor}18` }}>
        <AlertTriangle size={16} style={{ color: bgColor, flexShrink: 0 }} className={isUrgent ? 'animate-pulse' : ''} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            📝 PECB ISO 27001 Lead Auditor Exam
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Mon 9 Mar · 9:30 PM SGT — <strong style={{ color: isUrgent ? '#ff8f73' : '#c4b5fd' }}>{countdownText} remaining</strong>
          </div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
            ⏰ Launch PECB app 30 min early · 🪪 ID ready
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/calendar" className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: bgColor, color: '#fff' }}>
            View
          </Link>
          <button onClick={dismiss} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}>
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
