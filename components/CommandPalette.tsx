'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Home, CheckSquare, Briefcase, Bot, MessageCircle, Settings, BarChart2, Calendar, Monitor, Plus, Zap } from 'lucide-react'

interface Result {
  id: string
  label: string
  sublabel?: string
  group: string
  icon: React.ReactNode
  action: () => void
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([])
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Open/close with Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Fetch tasks + jobs when opened
  useEffect(() => {
    if (!open) { setQuery(''); setSelected(0); return }
    setTimeout(() => inputRef.current?.focus(), 50)
    fetch('/api/tasks').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setTasks(d.map((t: { id: string; title: string }) => ({ id: t.id, title: t.title })))
    }).catch(() => {})
    fetch('/api/jobs').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setJobs(d.map((j: { id: string; name: string }) => ({ id: j.id, name: j.name })))
    }).catch(() => {})
  }, [open])

  const go = useCallback((path: string) => {
    setOpen(false)
    router.push(path)
  }, [router])

  const results: Result[] = []

  // Quick Actions
  const quickActions: Result[] = [
    { id: 'create-task', label: 'Create Task', sublabel: 'Open task board', group: 'Actions', icon: <Plus size={15} />, action: () => { localStorage.setItem('cmd-open-new-task', 'true'); go('/tasks') } },
    { id: 'nav-home', label: 'Home', sublabel: '/', group: 'Pages', icon: <Home size={15} />, action: () => go('/') },
    { id: 'nav-tasks', label: 'Tasks', sublabel: '/tasks', group: 'Pages', icon: <CheckSquare size={15} />, action: () => go('/tasks') },
    { id: 'nav-jobs', label: 'Jobs', sublabel: '/jobs', group: 'Pages', icon: <Briefcase size={15} />, action: () => go('/jobs') },
    { id: 'nav-agents', label: 'Agents', sublabel: '/agents', group: 'Pages', icon: <Bot size={15} />, action: () => go('/agents') },
    { id: 'nav-comms', label: 'Comms', sublabel: '/comms', group: 'Pages', icon: <MessageCircle size={15} />, action: () => go('/comms') },
    { id: 'nav-system', label: 'System', sublabel: '/system', group: 'Pages', icon: <Monitor size={15} />, action: () => go('/system') },
    { id: 'nav-analytics', label: 'Analytics', sublabel: '/analytics', group: 'Pages', icon: <BarChart2 size={15} />, action: () => go('/analytics') },
    { id: 'nav-calendar', label: 'Calendar', sublabel: '/calendar', group: 'Pages', icon: <Calendar size={15} />, action: () => go('/calendar') },
    { id: 'nav-settings', label: 'Settings', sublabel: '/settings', group: 'Pages', icon: <Settings size={15} />, action: () => go('/settings') },
  ]

  const q = query.toLowerCase().trim()
  if (!q) {
    results.push(...quickActions.slice(0, 6))
  } else {
    results.push(...quickActions.filter(a => a.label.toLowerCase().includes(q) || (a.sublabel?.toLowerCase().includes(q) ?? false)))
    // Search tasks
    tasks
      .filter(t => t.title.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach(t => results.push({
        id: `task-${t.id}`, label: t.title, sublabel: 'Task', group: 'Tasks',
        icon: <CheckSquare size={15} />, action: () => go('/tasks'),
      }))
    // Search jobs
    jobs
      .filter(j => j.name.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach(j => results.push({
        id: `job-${j.id}`, label: j.name, sublabel: 'Job', group: 'Jobs',
        icon: <Zap size={15} />, action: () => go('/jobs'),
      }))
  }

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter') { e.preventDefault(); results[selected]?.action() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, selected])

  // Group results
  const groups: Record<string, Result[]> = {}
  for (const r of results) {
    if (!groups[r.group]) groups[r.group] = []
    groups[r.group].push(r)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', margin: '0 16px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--muted)' }}>
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>esc</kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[60vh] py-2">
          {results.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>No results for &ldquo;{query}&rdquo;</div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{group}</div>
                {items.map((item) => {
                  const isSelected = results.indexOf(item) === selected
                  return (
                    <button
                      key={item.id}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                      style={{
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        color: isSelected ? '#fff' : 'var(--text)',
                      }}
                      onMouseEnter={() => setSelected(results.indexOf(item))}
                      onClick={item.action}
                    >
                      <span style={{ color: isSelected ? '#fff' : 'var(--accent-light)', flexShrink: 0 }}>{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.label}</div>
                        {item.sublabel && (
                          <div className="text-[11px] truncate" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--muted)' }}>{item.sublabel}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 flex gap-4 text-[10px]" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
          <span><kbd className="px-1 rounded" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>↑↓</kbd> navigate</span>
          <span><kbd className="px-1 rounded" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>↵</kbd> select</span>
          <span><kbd className="px-1 rounded" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
