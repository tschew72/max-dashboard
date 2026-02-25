'use client'
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, ExternalLink, Clock, MapPin } from 'lucide-react'

interface CalEvent {
  id: string
  title: string
  start?: string
  end?: string
  dueDate?: string
  isAllDay?: boolean
  location?: string
  organizer?: string
  category: 'work' | 'teams' | 'personal' | 'task'
  source: 'o365' | 'task'
  joinUrl?: string
  webLink?: string
  preview?: string
  status?: string
  priority?: string
}

const CAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  work:     { bg: '#1d4ed822', text: '#93c5fd', border: '#3b82f6' },
  teams:    { bg: '#7c3aed22', text: '#c4b5fd', border: '#7c3aed' },
  personal: { bg: '#16a34a22', text: '#86efac', border: '#22c55e' },
  task:     { bg: '#37415122', text: '#9ca3af', border: '#6b7280' },
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
}

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-SG', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore',
  })
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'Asia/Singapore' })
}

function EventChip({ event, onClick }: { event: CalEvent; onClick: () => void }) {
  const c = CAT_COLORS[event.category] ?? CAT_COLORS.work
  const time = event.start ? fmtTime(event.start) : event.dueDate ? fmtTime(event.dueDate) : ''
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded px-2 py-1 mb-0.5 text-[11px] font-medium truncate leading-snug"
      style={{ background: c.bg, color: c.text, borderLeft: `2px solid ${c.border}` }}
      title={event.title}
    >
      {time && <span className="opacity-70 mr-1">{time}</span>}
      {event.title}
    </button>
  )
}

function EventSheet({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const c = CAT_COLORS[event.category] ?? CAT_COLORS.work
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl p-5 space-y-4 max-h-[70vh] overflow-y-auto"
        style={{ background: 'var(--card)', borderTop: `3px solid ${c.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 inline-block"
              style={{ background: c.bg, color: c.text }}>
              {event.category === 'task' ? 'Task' : event.category === 'teams' ? 'Teams / Meeting' : event.category === 'personal' ? 'Personal' : 'Work'}
            </span>
            <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>{event.title}</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={20} /></button>
        </div>

        {(event.start || event.dueDate) && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <Clock size={14} />
            {event.isAllDay ? (
              <span>All day</span>
            ) : event.start && event.end ? (
              <span>{fmtTime(event.start)} – {fmtTime(event.end)}</span>
            ) : event.dueDate ? (
              <span>Due: {fmtTime(event.dueDate)}</span>
            ) : null}
          </div>
        )}

        {event.location && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <MapPin size={14} />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {event.organizer && (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text)' }}>Organizer: </span>
            {event.organizer}
          </div>
        )}

        {event.preview && (
          <div className="rounded-xl p-3 text-sm leading-relaxed" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
            {event.preview}
          </div>
        )}

        {event.status && (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            Status: <span style={{ color: 'var(--text)' }}>{event.status}</span>
            {event.priority && <span> · Priority: <span style={{ color: 'var(--text)' }}>{event.priority}</span></span>}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {event.joinUrl && (
            <a href={event.joinUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <ExternalLink size={14} /> Join Meeting
            </a>
          )}
          {event.webLink && (
            <a href={event.webLink} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              <ExternalLink size={14} /> Open in Outlook
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()))
  const [events, setEvents] = useState<CalEvent[]>([])
  const [tasks, setTasks] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [tokenAvailable, setTokenAvailable] = useState(true)

  const days = getWeekDays(weekStart)
  const today = new Date()

  // Responsive: detect mobile to show 3-day view
  const [is3Day, setIs3Day] = useState(false)
  useEffect(() => {
    const check = () => setIs3Day(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // For 3-day view: yesterday / today / tomorrow centered
  const [centerDate, setCenterDate] = useState(() => new Date())
  const visibleDays = is3Day
    ? [
        new Date(centerDate.getTime() - 86400000),
        new Date(centerDate),
        new Date(centerDate.getTime() + 86400000),
      ]
    : days

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const fetchData = useCallback(async (start: Date, end: Date) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`)
      const json = await res.json()
      setEvents(Array.isArray(json.events) ? json.events : [])
      setTasks(Array.isArray(json.tasks) ? json.tasks : [])
      setTokenAvailable(json.tokenAvailable ?? false)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const start = is3Day
      ? new Date(centerDate.getTime() - 86400000)
      : weekStart
    const end = is3Day
      ? new Date(centerDate.getTime() + 86400000 * 2)
      : weekEnd
    fetchData(start, end)
  }, [weekStart, centerDate, is3Day, fetchData])

  const prevWeek = () => {
    if (is3Day) {
      setCenterDate(d => new Date(d.getTime() - 86400000 * 3))
    } else {
      setWeekStart(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n })
    }
  }
  const nextWeek = () => {
    if (is3Day) {
      setCenterDate(d => new Date(d.getTime() + 86400000 * 3))
    } else {
      setWeekStart(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n })
    }
  }
  const goToday = () => {
    setWeekStart(getMondayOf(new Date()))
    setCenterDate(new Date())
  }

  const allItems = [...events, ...tasks]
  const getDayItems = (day: Date) =>
    allItems.filter(e => {
      const dateStr = e.start ?? e.dueDate ?? ''
      if (!dateStr) return false
      return isSameDay(new Date(dateStr), day)
    }).sort((a, b) => {
      const at = new Date(a.start ?? a.dueDate ?? 0).getTime()
      const bt = new Date(b.start ?? b.dueDate ?? 0).getTime()
      return at - bt
    })

  const weekLabel = is3Day
    ? `${fmtDate(visibleDays[0])} – ${fmtDate(visibleDays[2])}`
    : `${weekStart.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-3 flex-shrink-0"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--card)', color: 'var(--muted)' }}>
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 text-center">
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>📅 {weekLabel}</div>
            {!tokenAvailable && (
              <div className="text-[10px]" style={{ color: '#f59e0b' }}>O365 unavailable · tasks only</div>
            )}
          </div>
          <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'var(--card)', color: 'var(--muted)' }}>
            <ChevronRight size={16} />
          </button>
          <button onClick={goToday} className="px-3 h-8 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--card)', color: 'var(--accent-light)', border: '1px solid var(--border)' }}>
            Today
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex gap-2 px-4 py-4">
            {visibleDays.map((_, i) => (
              <div key={i} className="flex-1 rounded-xl h-64 animate-pulse" style={{ background: 'var(--card)' }} />
            ))}
          </div>
        ) : (
          <div className={`grid px-3 py-3 gap-2`}
            style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }}>
            {visibleDays.map((day) => {
              const isToday = isSameDay(day, today)
              const items = getDayItems(day)
              return (
                <div key={day.toISOString()} className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--card)', border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}` }}>
                  {/* Day header */}
                  <div className="py-2 px-2 text-center sticky top-0"
                    style={{ background: isToday ? 'var(--accent)' : 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                    <div className="text-[10px] font-semibold uppercase"
                      style={{ color: isToday ? '#fff' : 'var(--muted)' }}>
                      {day.toLocaleDateString('en-SG', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-bold"
                      style={{ color: isToday ? '#fff' : 'var(--text)' }}>
                      {day.getDate()}
                    </div>
                    {items.length > 0 && (
                      <div className="text-[9px] mt-0.5" style={{ color: isToday ? 'rgba(255,255,255,0.7)' : 'var(--muted)' }}>
                        {items.length} event{items.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {/* Events */}
                  <div className="p-1.5 min-h-[80px]">
                    {items.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <span className="text-[10px]" style={{ color: 'var(--border)' }}>—</span>
                      </div>
                    ) : (
                      items.map(e => (
                        <EventChip key={e.id} event={e} onClick={() => setSelected(e)} />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 flex gap-3 flex-wrap flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)' }}>
        {Object.entries(CAT_COLORS).map(([cat, c]) => (
          <div key={cat} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--muted)' }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.border }} />
            {cat === 'teams' ? 'Teams/Meeting' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </div>
        ))}
      </div>

      {/* Event detail bottom sheet */}
      {selected && <EventSheet event={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
