'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Plus, X, Calendar, AlertCircle, AlignLeft, GripVertical, Search, Archive, LayoutList } from 'lucide-react'
import dynamic from 'next/dynamic'
const RichTextEditor = dynamic(() => import('@/components/ui/RichTextEditor').then(m => ({ default: m.RichTextEditor })), { ssr: false })
const RichTextRender = dynamic(() => import('@/components/ui/RichTextEditor').then(m => ({ default: m.RichTextRender })), { ssr: false })
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// ─── Types ────────────────────────────────────────────────────────────────────
type TaskStatus = 'BACKLOG' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
type Assignee = 'MAX' | 'VINCE' | 'BOTH'
type Label = 'WORK' | 'PERSONAL' | 'CONSULTING' | 'VAPT' | 'DEFENSEWATCH' | 'REMINDER'

interface Tag {
  id: string
  name: string
  color: string
}

interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: Priority
  assignee: Assignee
  label: Label
  dueDate?: string
  order: number
  source?: string
  sourceId?: string
  createdAt: string
  deletedAt?: string
  parentId?: string
  subtasks?: { id: string; title: string; status: string }[]
  recurrence?: string
  recurrenceNextDue?: string
  tags?: { tag: Tag }[]
  _count?: { subtasks: number; comments: number }
}

interface Filters {
  search: string
  priority: string
  assignee: string
  overdue: boolean
  view: 'board' | 'archive'
  compact: boolean
}

interface Comment {
  id: string
  author: string
  body: string
  createdAt: string
  updatedAt: string
}

interface ActivityItem {
  id: string
  actor: string
  action: string
  meta: string | null
  createdAt: string
}

const defaultFilters: Filters = {
  search: '',
  priority: '',
  assignee: '',
  overdue: false,
  view: 'board',
  compact: false,
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LABEL_COLORS: Record<Label, string> = {
  WORK: '#0052cc',
  PERSONAL: '#6554c0',
  CONSULTING: '#ff8b00',
  VAPT: '#bf2600',
  DEFENSEWATCH: '#00875a',
  REMINDER: '#0065ff',
}

const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🟢',
}

const ASSIGNEE_EMOJI: Record<Assignee, string> = {
  MAX: '⚡',
  VINCE: '🧑',
  BOTH: '👥',
}
const ASSIGNEE_LABEL: Record<Assignee, string> = {
  MAX:   'Max',
  VINCE: 'Vince',
  BOTH:  'Both',
}
const ASSIGNEE_COLOR: Record<Assignee, { bg: string; color: string; border: string }> = {
  MAX:   { bg: '#6554c022', color: '#a78bfa', border: '#6554c044' },
  VINCE: { bg: '#0052cc22', color: '#579dff', border: '#0052cc44' },
  BOTH:  { bg: '#36b37e22', color: '#57d9a3', border: '#36b37e44' },
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'BACKLOG',     label: 'Backlog',     color: '#626f86' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: '#0065ff' },
  { id: 'REVIEW',      label: 'Review',      color: '#ff8b00' },
  { id: 'DONE',        label: 'Done',        color: '#36b37e' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

function buildUrl(f: Filters): string {
  const params = new URLSearchParams()
  if (f.view === 'archive') params.set('archived', 'true')
  if (f.search) params.set('search', f.search)
  if (f.priority) params.set('priority', f.priority)
  if (f.assignee) params.set('assignee', f.assignee)
  if (f.overdue) params.set('overdue', 'true')
  return `/api/tasks?${params.toString()}`
}

// ─── Pure card UI (no drag wiring) ───────────────────────────────────────────
function TaskCardContent({
  task,
  isDragging = false,
  dragHandleProps,
  compact = false,
}: {
  task: Task
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  compact?: boolean
}) {
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
  const formattedDue = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null
  const isTeams = task.source === 'TEAMS'
  const plainDesc = task.description ? stripHtml(task.description) : null
  const doneSubtasks = task.subtasks?.filter(s => s.status === 'DONE').length ?? 0

  // ── Compact row ─────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-2 rounded-md transition-all"
        style={{
          background: isDragging ? '#2c3a47' : '#22272b',
          border: `1px solid ${isDragging ? '#0052cc66' : '#2c333a'}`,
          borderLeft: `3px solid ${LABEL_COLORS[task.label]}`,
          boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.4)' : '0 1px 2px rgba(0,0,0,0.3)',
          opacity: isDragging ? 0.95 : 1,
          minHeight: 34,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          style={{ color: '#3d4f61' }}
        >
          <GripVertical size={12} />
        </div>
        {/* Priority */}
        <span className="flex-shrink-0 text-xs leading-none">{PRIORITY_LABELS[task.priority]}</span>
        {/* Title */}
        <p
          className="flex-1 min-w-0 text-xs font-medium text-white leading-snug"
          style={{
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {task.title}
        </p>
        {/* Teams badge */}
        {isTeams && (
          <span className="flex-shrink-0 text-[9px] font-semibold px-1 py-0.5 rounded"
            style={{ background: '#0065ff22', color: '#579dff' }}>MS</span>
        )}
        {/* Overdue / due */}
        {formattedDue && (
          <span
            className="flex-shrink-0 text-[10px] flex items-center gap-0.5"
            style={{ color: isOverdue ? '#ff8f73' : '#626f86' }}
          >
            {isOverdue && <AlertCircle size={8} />}
            {formattedDue}
          </span>
        )}
        {/* Assignee */}
        <span
          className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: ASSIGNEE_COLOR[task.assignee].bg, color: ASSIGNEE_COLOR[task.assignee].color, border: `1px solid ${ASSIGNEE_COLOR[task.assignee].border}` }}
        >
          {ASSIGNEE_EMOJI[task.assignee]} {ASSIGNEE_LABEL[task.assignee]}
        </span>
      </div>
    )
  }

  // ── Full card ────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-lg transition-all"
      style={{
        background: isDragging ? '#2c3a47' : '#22272b',
        border: `1px solid ${isDragging ? '#0052cc66' : '#2c333a'}`,
        boxShadow: isDragging
          ? '0 12px 32px rgba(0,0,0,0.5), 0 0 0 2px #0052cc44'
          : '0 1px 2px rgba(0,0,0,0.3)',
        opacity: isDragging ? 0.95 : 1,
        transform: isDragging ? 'rotate(1.5deg)' : undefined,
      }}
    >
      {/* Label color bar */}
      <div className="h-2 rounded-t-lg" style={{ background: LABEL_COLORS[task.label] }} />
      <div className="p-3">
        {/* Header row: grip + source badge */}
        <div className="flex items-start gap-1.5 mb-1.5">
          <div
            {...dragHandleProps}
            className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing touch-none"
            style={{ color: '#3d4f61' }}
          >
            <GripVertical size={14} />
          </div>
          <div className="flex-1 min-w-0">
            {(isTeams || task.source === 'MAX') && (
              <div className="mb-1">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={isTeams
                    ? { background: '#0065ff22', color: '#579dff' }
                    : { background: '#6554c022', color: '#a78bfa' }
                  }
                >
                  {isTeams ? '💬 Teams' : '⚡ Max'}
                </span>
              </div>
            )}
            <p className="text-sm text-white font-medium leading-snug">{task.title}</p>
          </div>
        </div>

        {/* Description preview */}
        {plainDesc && (
          <div className="flex items-start gap-1.5 mb-2 pl-5">
            <AlignLeft size={11} className="mt-0.5 flex-shrink-0" style={{ color: '#626f86' }} />
            <p
              className="text-xs leading-relaxed"
              style={{
                color: '#626f86',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {plainDesc}
            </p>
          </div>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2 pl-5">
            {task.tags.map(tt => (
              <span
                key={tt.tag.id}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  background: tt.tag.color + '33',
                  color: tt.tag.color,
                  border: `1px solid ${tt.tag.color}44`,
                }}
              >
                {tt.tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Subtask progress bar */}
        {task._count && task._count.subtasks > 0 && (
          <div className="mb-2 pl-5">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full" style={{ background: '#2c333a' }}>
                <div
                  className="h-1 rounded-full"
                  style={{
                    background: '#36b37e',
                    width: `${Math.round((doneSubtasks / task._count.subtasks) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[10px]" style={{ color: '#8c9bab' }}>
                {doneSubtasks}/{task._count.subtasks}
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 flex-wrap pl-5">
          <div className="flex items-center gap-2">
            <span className="text-sm">{PRIORITY_LABELS[task.priority]}</span>
            {formattedDue && (
              <span
                className="text-[11px] flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium"
                style={{
                  background: isOverdue ? '#ff563022' : '#2c333a',
                  color: isOverdue ? '#ff8f73' : '#8c9bab',
                  border: `1px solid ${isOverdue ? '#ff563044' : 'transparent'}`,
                }}
              >
                {isOverdue && <AlertCircle size={9} />}
                <Calendar size={9} />
                {formattedDue}
              </span>
            )}
            {/* Comment count */}
            {task._count && task._count.comments > 0 && (
              <span className="text-[11px] flex items-center gap-0.5" style={{ color: '#8c9bab' }}>
                💬 {task._count.comments}
              </span>
            )}
          </div>
          <span className="text-base">{ASSIGNEE_EMOJI[task.assignee]}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Sortable card wrapper ────────────────────────────────────────────────────
function SortableTaskCard({
  task,
  onClick,
  bulkMode,
  isSelected,
  onToggleSelect,
  onRefresh,
  compact = false,
}: {
  task: Task
  onClick: () => void
  bulkMode: boolean
  isSelected: boolean
  onToggleSelect: () => void
  onRefresh: () => void
  compact?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } })

  // Swipe gesture state
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const swipeDeltaX = useRef(0)
  const swipeIsHorizontal = useRef(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeAction, setSwipeAction] = useState<'archive' | 'done' | null>(null)
  const swipeWrapRef = useRef<HTMLDivElement>(null)

  // Pending confirmation state — set after swipe, cleared on confirm/cancel
  const [pendingAction, setPendingAction] = useState<'archive' | 'done' | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Must use imperative listener with passive:false so preventDefault() works
  useEffect(() => {
    const el = swipeWrapRef.current
    if (!el) return
    const onMove = (e: TouchEvent) => {
      if (swipeStartX.current === null || isDragging || bulkMode || pendingAction) return
      const dx = e.touches[0].clientX - swipeStartX.current
      const dy = e.touches[0].clientY - (swipeStartY.current ?? 0)

      // Decide gesture direction on first significant movement
      if (!swipeIsHorizontal.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      if (!swipeIsHorizontal.current) {
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical — cancel swipe, let page scroll
          swipeStartX.current = null
          return
        }
        swipeIsHorizontal.current = true
      }

      // It's horizontal — block the page from scrolling
      e.preventDefault()
      swipeDeltaX.current = dx
      const clamped = Math.max(-120, Math.min(120, dx))
      setSwipeOffset(clamped)
      setSwipeAction(clamped < -50 ? 'archive' : clamped > 50 ? 'done' : null)
    }
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [isDragging, bulkMode, pendingAction])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDragging || bulkMode || pendingAction) return
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
    swipeDeltaX.current = 0
    swipeIsHorizontal.current = false
  }

  const handleTouchEnd = () => {
    if (swipeStartX.current === null) return
    swipeStartX.current = null
    const dx = swipeDeltaX.current
    setSwipeOffset(0)
    setSwipeAction(null)
    // Threshold met → ask for confirmation instead of executing immediately
    if (Math.abs(dx) > 100) {
      setPendingAction(dx < 0 ? 'archive' : 'done')
    }
  }

  const handleConfirm = async () => {
    if (!pendingAction || confirming) return
    setConfirming(true)
    try {
      if (pendingAction === 'archive') {
        await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archive: true }),
        })
      } else {
        await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DONE' }),
        })
      }
      onRefresh()
    } finally {
      setConfirming(false)
      setPendingAction(null)
    }
  }

  const handleCancelSwipe = () => {
    setPendingAction(null)
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    cursor: 'pointer',
    position: 'relative',
  }

  return (
    <div
      ref={(node) => { setNodeRef(node); (swipeWrapRef as React.MutableRefObject<HTMLDivElement | null>).current = node }}
      style={style}
      className="relative overflow-hidden rounded-lg"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe action backgrounds (while swiping) */}
      {swipeAction === 'archive' && (
        <div
          className="absolute inset-0 flex items-center justify-end pr-4 rounded-lg z-0"
          style={{ background: '#ff5630' }}
        >
          <span className="text-white font-bold text-sm">📦 Archive</span>
        </div>
      )}
      {swipeAction === 'done' && (
        <div
          className="absolute inset-0 flex items-center pl-4 rounded-lg z-0"
          style={{ background: '#36b37e' }}
        >
          <span className="text-white font-bold text-sm">✓ Done</span>
        </div>
      )}

      {/* Confirmation overlay — shown after swipe threshold, before action fires */}
      {pendingAction && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-lg px-3"
          style={{
            background: pendingAction === 'archive' ? '#ff563099' : '#36b37e99',
            backdropFilter: 'blur(2px)',
          }}
        >
          <p className="text-white font-bold text-sm text-center">
            {pendingAction === 'archive' ? '📦 Archive this task?' : '✅ Mark as Done?'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancelSwipe}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-60"
              style={{ background: '#fff', color: pendingAction === 'archive' ? '#ff5630' : '#36b37e' }}
            >
              {confirming ? '…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Sliding card content */}
      <div
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.25s ease' : 'none',
          position: 'relative',
          zIndex: 1,
        }}
        onClick={bulkMode ? onToggleSelect : onClick}
      >
        {bulkMode && (
          <div
            className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center"
            style={{
              background: isSelected ? '#0052cc' : 'transparent',
              borderColor: isSelected ? '#0052cc' : '#626f86',
            }}
          >
            {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
          </div>
        )}
        <TaskCardContent
          task={task}
          dragHandleProps={bulkMode ? undefined : { ...attributes, ...listeners }}
          isDragging={isDragging}
          compact={compact}
        />
      </div>
    </div>
  )
}

// ─── Droppable column container ───────────────────────────────────────────────
function DroppableColumn({ id, children, compact }: { id: string; children: React.ReactNode; compact?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'column', columnId: id } })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto px-2 pb-1 min-h-[60px] transition-colors rounded-lg ${compact ? 'space-y-1' : 'space-y-2'}`}
      style={{
        background: isOver ? 'rgba(0,82,204,0.06)' : 'transparent',
        outline: isOver ? '1px dashed #0052cc55' : '1px solid transparent',
      }}
    >
      {children}
    </div>
  )
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────
function BottomSheet({
  open, onClose, title, children, footer,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop — full screen */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      {/* Sheet — floats above the bottom nav bar */}
      <div
        className="relative rounded-t-2xl flex flex-col"
        style={{
          background: '#1d2125',
          border: '1px solid #2c333a',
          borderBottom: 'none',
          maxHeight: 'calc(92vh - 64px - env(safe-area-inset-bottom, 0px))',
          marginBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2c333a' }} />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} style={{ color: '#8c9bab' }}><X size={20} /></button>
        </div>
        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 pb-4 flex-1">{children}</div>
        {/* Sticky footer — always visible, never scrolls away */}
        {footer && (
          <div
            className="flex-shrink-0 px-5 pt-3 pb-4"
            style={{
              borderTop: '1px solid #2c333a',
              background: '#1d2125',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Select / Date fields ─────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const s = {
    background: '#22272b', border: '1px solid #2c333a', color: '#b6c2cf',
    width: '100%', borderRadius: '4px', padding: '8px 12px', fontSize: '14px', outline: 'none',
  } as React.CSSProperties
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#8c9bab' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={s}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#8c9bab' }}>{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} style={{
        background: '#22272b', border: '1px solid #2c333a', color: '#b6c2cf',
        width: '100%', borderRadius: '4px', padding: '8px 12px', fontSize: '14px', outline: 'none',
      }} />
    </div>
  )
}

// ─── Form shape ───────────────────────────────────────────────────────────────
interface TaskFormData {
  title: string; description: string; status: TaskStatus; priority: Priority
  assignee: Assignee; label: Label; dueDate: string; recurrence: string
}
const defaultForm: TaskFormData = {
  title: '', description: '', status: 'BACKLOG', priority: 'MEDIUM',
  assignee: 'BOTH', label: 'WORK', dueDate: '', recurrence: 'NONE',
}

// ─── Task form (create / edit) ────────────────────────────────────────────────
function TaskForm({ data, onChange, onSubmit, submitLabel, onDelete }: {
  data: TaskFormData; onChange: (d: TaskFormData) => void
  onSubmit: () => void; submitLabel: string; onDelete?: () => void
}) {
  const set = (key: keyof TaskFormData) => (v: string) => onChange({ ...data, [key]: v })
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#8c9bab' }}>Title</label>
        <input value={data.title} onChange={e => set('title')(e.target.value)}
          placeholder="Task title..." autoFocus
          style={{ background: '#22272b', border: '1px solid #2c333a', color: '#b6c2cf', width: '100%', borderRadius: '4px', padding: '10px 12px', fontSize: '14px', outline: 'none' }} />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#8c9bab' }}>Description</label>
        <RichTextEditor value={data.description} onChange={set('description')}
          placeholder="Write task details, acceptance criteria, steps, context, links..." minHeight={220} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Status" value={data.status} onChange={set('status')} options={[
          { value: 'BACKLOG', label: 'Backlog' }, { value: 'IN_PROGRESS', label: 'In Progress' },
          { value: 'REVIEW', label: 'Review' }, { value: 'DONE', label: 'Done' }]} />
        <SelectField label="Priority" value={data.priority} onChange={set('priority')} options={[
          { value: 'LOW', label: '🟢 Low' }, { value: 'MEDIUM', label: '🟡 Medium' },
          { value: 'HIGH', label: '🟠 High' }, { value: 'URGENT', label: '🔴 Urgent' }]} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Assignee" value={data.assignee} onChange={set('assignee')} options={[
          { value: 'MAX', label: '🤖 Max' }, { value: 'VINCE', label: '👤 Vince' }, { value: 'BOTH', label: '👥 Both' }]} />
        <SelectField label="Label" value={data.label} onChange={set('label')} options={[
          { value: 'WORK', label: 'Work' }, { value: 'PERSONAL', label: 'Personal' },
          { value: 'CONSULTING', label: 'Consulting' }, { value: 'VAPT', label: 'VAPT' },
          { value: 'DEFENSEWATCH', label: 'DefenseWatch' }, { value: 'REMINDER', label: 'Reminder' }]} />
      </div>
      <DateField label="Due Date" value={data.dueDate} onChange={set('dueDate')} />
      <SelectField label="Recurrence" value={data.recurrence || 'NONE'} onChange={set('recurrence')} options={[
        { value: 'NONE', label: '🚫 None' },
        { value: 'DAILY', label: '📅 Daily' },
        { value: 'WEEKLY', label: '📅 Weekly' },
        { value: 'MONTHLY', label: '📅 Monthly' },
      ]} />
      <div className="flex gap-2 pt-2">
        {onDelete && (
          <button onClick={onDelete} className="flex-1 h-11 rounded-lg text-sm font-semibold"
            style={{ background: '#ff563022', color: '#ff8f73', border: '1px solid #ff563044' }}>Delete</button>
        )}
        <button onClick={onSubmit} disabled={!data.title.trim()}
          className="flex-1 h-11 rounded-lg text-sm font-bold text-white disabled:opacity-40"
          style={{ background: '#0052cc' }}>{submitLabel}</button>
      </div>
    </div>
  )
}

// ─── Inline quick-add row ─────────────────────────────────────────────────────
function AddCardRow({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const submit = () => { if (title.trim()) { onAdd(title.trim()); setTitle(''); setOpen(false) } }

  if (!open) return (
    <button className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm"
      style={{ color: '#8c9bab' }} onClick={() => setOpen(true)}>
      <Plus size={16} />Add a card
    </button>
  )
  return (
    <div className="space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false) }}
        placeholder="Card title..." autoFocus className="w-full rounded-lg p-2 text-sm"
        style={{ background: '#22272b', border: '1px solid #2c333a', color: '#b6c2cf', outline: 'none' }} />
      <div className="flex gap-2">
        <button onClick={submit} disabled={!title.trim()}
          className="px-3 py-1.5 rounded text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: '#0052cc' }}>Add</button>
        <button onClick={() => { setOpen(false); setTitle('') }}
          className="px-3 py-1.5 rounded text-sm" style={{ color: '#8c9bab' }}><X size={16} /></button>
      </div>
    </div>
  )
}

// ─── Task detail (read-only + subtasks + tags) ────────────────────────────────
function TaskDetailSheet({
  task,
  onRefresh,
}: {
  task: Task
  onRefresh: () => void
}) {
  const [currentAssignee, setCurrentAssignee] = useState<Assignee>(task.assignee)
  const [reassigning, setReassigning] = useState(false)

  const handleReassign = async (assignee: Assignee) => {
    if (assignee === currentAssignee || reassigning) return
    setReassigning(true)
    const prev = currentAssignee
    setCurrentAssignee(assignee) // optimistic
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee }),
      })
      if (!res.ok) setCurrentAssignee(prev) // rollback
      else onRefresh()
    } catch { setCurrentAssignee(prev) }
    finally { setReassigning(false) }
  }

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
  const formattedDue = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  // Subtask state
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  // Tag state
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [availableTags, setAvailableTags] = useState<Tag[]>([])

  // Comment state
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentBody, setCommentBody] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentBody, setEditCommentBody] = useState('')

  // Activity log state
  const [activityOpen, setActivityOpen] = useState(false)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/activity`)
      const data = await res.json()
      setActivities(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    finally { setLoadingActivity(false) }
  }, [task.id])

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`)
      const data = await res.json()
      setComments(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    finally { setLoadingComments(false) }
  }, [task.id])

  useEffect(() => { fetchComments() }, [fetchComments])

  const submitComment = async () => {
    if (!commentBody.trim()) return
    setSubmittingComment(true)
    try {
      await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: 'MAX', body: commentBody }),
      })
      setCommentBody('')
      fetchComments()
    } catch (e) { console.error(e) }
    finally { setSubmittingComment(false) }
  }

  const deleteComment = async (cid: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/comments/${cid}`, { method: 'DELETE' })
      fetchComments()
    } catch (e) { console.error(e) }
  }

  const saveEditComment = async (cid: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/comments/${cid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editCommentBody }),
      })
      setEditingCommentId(null)
      fetchComments()
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then((data: Tag[]) => setAvailableTags(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [])

  const toggleSubtask = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DONE' ? 'IN_PROGRESS' : 'DONE'
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      onRefresh()
    } catch (e) { console.error(e) }
  }

  const submitSubtask = async () => {
    if (!newSubtaskTitle.trim()) return
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSubtaskTitle.trim(),
          parentId: task.id,
          status: 'BACKLOG',
          priority: task.priority,
          assignee: task.assignee,
          label: task.label,
          source: 'MANUAL',
        }),
      })
      setNewSubtaskTitle('')
      setAddingSubtask(false)
      onRefresh()
    } catch (e) { console.error(e) }
  }

  const addTag = async (tagId: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      })
      setShowTagPicker(false)
      onRefresh()
    } catch (e) { console.error(e) }
  }

  const removeTag = async (tagId: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      })
      onRefresh()
    } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-5">
      {/* Title + metadata */}
      <div className="flex items-start gap-3">
        <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ background: LABEL_COLORS[task.label] }} />
        <h3 className="text-lg font-bold text-white leading-snug">{task.title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#22272b', color: '#b6c2cf' }}>
          {PRIORITY_LABELS[task.priority]} {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
        </span>
        {/* Inline assignee switcher */}
        <div className="flex gap-1 p-0.5 rounded-full" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
          {(['MAX', 'VINCE', 'BOTH'] as Assignee[]).map(a => {
            const active = currentAssignee === a
            const c = ASSIGNEE_COLOR[a]
            return (
              <button
                key={a}
                onClick={() => handleReassign(a)}
                disabled={reassigning}
                className="px-2.5 py-1 rounded-full text-xs font-bold transition-all disabled:opacity-60"
                style={active
                  ? { background: c.bg, color: c.color, border: `1px solid ${c.border}` }
                  : { background: 'transparent', color: '#626f86', border: '1px solid transparent' }
                }
              >
                {ASSIGNEE_EMOJI[a]} {ASSIGNEE_LABEL[a]}
              </button>
            )
          })}
        </div>
        {formattedDue && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: isOverdue ? '#ff563022' : '#22272b', color: isOverdue ? '#ff8f73' : '#b6c2cf' }}>
            <Calendar size={11} />{formattedDue}{isOverdue && ' ⚠️'}
          </span>
        )}
        {task.source === 'TEAMS' && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#0065ff22', color: '#579dff' }}>
            💬 Teams
          </span>
        )}
      </div>

      {/* Description */}
      {task.description && task.description !== '<p></p>' ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#626f86' }}>Description</p>
          <div className="rounded-lg p-4" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
            <RichTextRender html={task.description} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg p-4 text-center" style={{ background: '#22272b', border: '1px dashed #2c333a' }}>
          <p className="text-xs" style={{ color: '#4b5563' }}>No description added yet</p>
        </div>
      )}

      {/* Subtasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#626f86' }}>
            Subtasks {task._count?.subtasks ? `(${task._count.subtasks})` : ''}
          </p>
          <button
            onClick={() => setAddingSubtask(true)}
            className="text-xs px-2 py-1 rounded"
            style={{ background: '#22272b', color: '#579dff' }}
          >+ Add</button>
        </div>

        {task.subtasks?.map(sub => (
          <div
            key={sub.id}
            className="flex items-center gap-2 py-1.5 px-3 rounded-lg mb-1"
            style={{ background: '#22272b' }}
          >
            <input
              type="checkbox"
              checked={sub.status === 'DONE'}
              onChange={() => toggleSubtask(sub.id, sub.status)}
              className="w-4 h-4 rounded"
              style={{ accentColor: '#0052cc' }}
            />
            <span
              className="text-sm flex-1"
              style={{
                color: sub.status === 'DONE' ? '#626f86' : '#b6c2cf',
                textDecoration: sub.status === 'DONE' ? 'line-through' : 'none',
              }}
            >{sub.title}</span>
          </div>
        ))}

        {addingSubtask && (
          <div className="flex gap-2 mt-2">
            <input
              value={newSubtaskTitle}
              onChange={e => setNewSubtaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitSubtask()
                if (e.key === 'Escape') setAddingSubtask(false)
              }}
              placeholder="Subtask title..."
              autoFocus
              className="flex-1 rounded px-3 py-2 text-sm"
              style={{ background: '#22272b', border: '1px solid #2c333a', color: '#b6c2cf', outline: 'none' }}
            />
            <button
              onClick={submitSubtask}
              className="px-3 py-2 rounded text-sm font-semibold text-white"
              style={{ background: '#0052cc' }}
            >Add</button>
          </div>
        )}

        {!task.subtasks?.length && !addingSubtask && (
          <p className="text-xs py-2" style={{ color: '#4b5563' }}>No subtasks yet</p>
        )}
      </div>

      {/* Tags */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#626f86' }}>Tags</p>
        <div className="flex flex-wrap gap-2">
          {task.tags?.map(tt => (
            <span
              key={tt.tag.id}
              className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 cursor-pointer"
              style={{
                background: tt.tag.color + '33',
                color: tt.tag.color,
                border: `1px solid ${tt.tag.color}44`,
              }}
              onClick={() => removeTag(tt.tag.id)}
            >
              {tt.tag.name} ×
            </span>
          ))}
          <button
            onClick={() => setShowTagPicker(v => !v)}
            className="text-xs px-2.5 py-1 rounded-full"
            style={{ background: '#22272b', color: '#8c9bab', border: '1px dashed #2c333a' }}
          >+ Tag</button>
        </div>
        {showTagPicker && (
          <div className="mt-2 p-2 rounded-lg" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
            {availableTags
              .filter(t => !task.tags?.some(tt => tt.tag.id === t.id))
              .map(tag => (
                <button
                  key={tag.id}
                  onClick={() => addTag(tag.id)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-left"
                  style={{ color: '#b6c2cf' }}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                  {tag.name}
                </button>
              ))}
            {availableTags.filter(t => !task.tags?.some(tt => tt.tag.id === t.id)).length === 0 && (
              <p className="text-xs px-2 py-1" style={{ color: '#626f86' }}>All tags applied</p>
            )}
          </div>
        )}
      </div>

      {/* Comments */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#626f86' }}>
          Comments {comments.length > 0 ? `(${comments.length})` : ''}
        </p>

        {/* Comment list */}
        <div className="space-y-3 mb-4">
          {loadingComments ? (
            <div className="h-12 rounded-lg animate-pulse" style={{ background: '#22272b' }} />
          ) : comments.length === 0 ? (
            <p className="text-xs py-1" style={{ color: '#4b5563' }}>No comments yet. Be the first.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="rounded-lg p-3" style={{ background: '#22272b', border: '1px solid #2c333a' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{c.author === 'MAX' ? '🤖' : '👤'}</span>
                    <span className="text-xs font-semibold" style={{ color: '#b6c2cf' }}>{c.author}</span>
                    <span className="text-[11px]" style={{ color: '#626f86' }}>
                      {new Date(c.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditingCommentId(c.id); setEditCommentBody(c.body) }}
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ color: '#8c9bab' }}>Edit</button>
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ color: '#ff8f73' }}>✕</button>
                  </div>
                </div>
                {editingCommentId === c.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editCommentBody}
                      onChange={e => setEditCommentBody(e.target.value)}
                      rows={3}
                      className="w-full rounded p-2 text-sm"
                      style={{ background: '#161b20', border: '1px solid #2c333a', color: '#b6c2cf', outline: 'none', resize: 'none' }}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEditComment(c.id)}
                        className="px-3 py-1 rounded text-xs font-semibold text-white"
                        style={{ background: '#0052cc' }}>Save</button>
                      <button onClick={() => setEditingCommentId(null)}
                        className="px-3 py-1 rounded text-xs"
                        style={{ color: '#8c9bab' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap" style={{ color: '#b6c2cf', lineHeight: 1.6 }}>{c.body}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* New comment input */}
        <div className="space-y-2">
          <textarea
            value={commentBody}
            onChange={e => setCommentBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment() }}
            placeholder="Add a comment... (Ctrl+Enter to submit)"
            rows={3}
            className="w-full rounded-lg p-3 text-sm"
            style={{ background: '#22272b', border: '1px solid #2c333a', color: '#b6c2cf', outline: 'none', resize: 'none' }}
          />
          <button
            onClick={submitComment}
            disabled={!commentBody.trim() || submittingComment}
            className="w-full h-9 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: '#0052cc' }}>
            {submittingComment ? 'Posting...' : '💬 Add Comment'}
          </button>
        </div>
      </div>

      {/* Activity Log */}
      <div>
        <button
          onClick={() => {
            const next = !activityOpen
            setActivityOpen(next)
            if (next && activities.length === 0) loadActivity()
          }}
          className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: '#626f86' }}
        >
          <span>Activity Log</span>
          <span style={{ fontSize: '10px' }}>{activityOpen ? '▲' : '▼'}</span>
        </button>
        {activityOpen && (
          <div className="space-y-3 mb-2">
            {loadingActivity ? (
              <div className="h-10 rounded animate-pulse" style={{ background: '#22272b' }} />
            ) : activities.length === 0 ? (
              <p className="text-xs py-1" style={{ color: '#4b5563' }}>No activity recorded yet</p>
            ) : (
              activities.map(a => {
                const m = a.meta ? (() => { try { return JSON.parse(a.meta) } catch { return {} } })() : {}
                const actionLabel = (() => {
                  switch (a.action) {
                    case 'created': return 'created this task'
                    case 'status_changed': return `moved ${m.from ?? ''} → ${m.to ?? ''}`
                    case 'priority_changed': return `changed priority ${m.from ?? ''} → ${m.to ?? ''}`
                    case 'comment_added': return 'added a comment'
                    case 'archived': return 'archived this task'
                    case 'restored': return 'restored from archive'
                    default: return a.action
                  }
                })()
                const actionIcon = (() => {
                  switch (a.action) {
                    case 'created': return '✨'
                    case 'status_changed': return '🔄'
                    case 'priority_changed': return '🎯'
                    case 'comment_added': return '💬'
                    case 'archived': return '📦'
                    case 'restored': return '♻️'
                    default: return '📝'
                  }
                })()
                const diff = Date.now() - new Date(a.createdAt).getTime()
                const mins = Math.floor(diff / 60000)
                const relTime = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
                return (
                  <div key={a.id} className="flex items-start gap-2">
                    <span className="text-sm mt-0.5 flex-shrink-0">{actionIcon}</span>
                    <div>
                      <span className="text-xs" style={{ color: '#b6c2cf' }}>
                        <span className="font-semibold">{a.actor}</span>{' '}{actionLabel}
                      </span>
                      <span className="text-[11px] ml-2" style={{ color: '#626f86' }}>{relTime}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Task detail action buttons (sticky footer) ───────────────────────────────
function TaskDetailActions({
  task,
  onEdit,
  onRefresh,
}: {
  task: Task
  onEdit: () => void
  onRefresh: () => void
}) {
  const [askingMax, setAskingMax] = useState(false)
  const [maxQueued, setMaxQueued] = useState(task.status === 'IN_PROGRESS' && task.assignee === 'MAX')
  // Two-step: false = idle, true = instructions panel open
  const [expanded, setExpanded] = useState(false)
  const [instructions, setInstructions] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea when panel opens
  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 60)
  }, [expanded])

  const handleConfirm = async () => {
    if (maxQueued || task.status === 'DONE') return
    setAskingMax(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/ask-max`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: instructions.trim() || undefined }),
      })
      const data = await res.json()
      if (data.ok) { setMaxQueued(true); setExpanded(false); onRefresh() }
    } catch (e) { console.error(e) }
    finally { setAskingMax(false) }
  }

  const handleCancel = () => { setExpanded(false); setInstructions('') }

  // Already queued / done state
  if (maxQueued || task.status === 'DONE') {
    return (
      <div className="flex gap-2">
        {task.status !== 'DONE' && (
          <div
            className="flex-1 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: '#36b37e22', color: '#57d9a3', border: '1px solid #36b37e44' }}
          >
            ✅ Max is on it
          </div>
        )}
        <button
          onClick={onEdit}
          className={`h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5 ${task.status !== 'DONE' ? 'flex-none px-6' : 'flex-1'}`}
          style={{ background: '#0052cc' }}
        >
          ✏️ Edit
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Expanded instructions panel */}
      {expanded && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: '#22272b', border: '1px solid #6554c055' }}
        >
          <p className="text-xs font-semibold" style={{ color: '#a78bfa' }}>
            💬 Additional instructions for Max <span style={{ color: '#626f86', fontWeight: 400 }}>(optional)</span>
          </p>
          <textarea
            ref={inputRef}
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleConfirm()
              if (e.key === 'Escape') handleCancel()
            }}
            placeholder="e.g. Focus on the login page first, skip the admin panel…"
            rows={3}
            className="w-full rounded-lg p-2.5 text-sm resize-none"
            style={{
              background: '#161b20',
              border: '1px solid #2c333a',
              color: '#b6c2cf',
              outline: 'none',
            }}
          />
          <p className="text-[10px]" style={{ color: '#3d4f61' }}>Ctrl+Enter to send · Esc to cancel</p>
        </div>
      )}

      {/* Button row */}
      <div className="flex gap-2">
        {/* Cancel (only when expanded) */}
        {expanded && (
          <button
            onClick={handleCancel}
            className="flex-none h-11 px-4 rounded-xl text-sm font-semibold"
            style={{ background: '#22272b', color: '#8c9bab', border: '1px solid #2c333a' }}
          >
            Cancel
          </button>
        )}

        {/* Ask Max / Confirm */}
        <button
          onClick={expanded ? handleConfirm : () => setExpanded(true)}
          disabled={askingMax}
          className="flex-1 h-11 rounded-xl text-sm font-bold disabled:opacity-70 flex items-center justify-center gap-2 transition-all"
          style={{ background: 'linear-gradient(135deg, #6554c0, #8777d9)', color: '#fff', boxShadow: '0 2px 12px #6554c040' }}
        >
          {askingMax
            ? <><span className="animate-spin text-base">⚙️</span> Assigning…</>
            : expanded
              ? <>⚡ Send to Max</>
              : <>⚡ Ask Max</>
          }
        </button>

        {/* Edit (hidden when instructions panel is open to save space) */}
        {!expanded && (
          <button
            onClick={onEdit}
            className="flex-none h-11 px-6 rounded-xl text-sm font-bold text-white flex items-center justify-center"
            style={{ background: '#0052cc' }}
          >
            ✏️ Edit
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Archive card ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  BACKLOG:     { label: 'Backlog',     color: '#626f86', bg: '#22272b' },
  IN_PROGRESS: { label: 'In Progress', color: '#579dff', bg: '#0052cc22' },
  REVIEW:      { label: 'Review',      color: '#ffa500', bg: '#ffa50022' },
  DONE:        { label: 'Done',        color: '#57d9a3', bg: '#36b37e22' },
}
const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  TEAMS:    { label: '💬 Teams',    color: '#579dff' },
  MAX:      { label: '⚡ Max',      color: '#a78bfa' },
  INTERNAL: { label: 'Internal',    color: '#626f86' },
  MANUAL:   { label: 'Manual',      color: '#626f86' },
}

function ArchiveCard({
  task,
  selected,
  onSelect,
  onRestore,
  onDelete,
}: {
  task: Task
  selected: boolean
  onSelect: (id: string) => void
  onRestore: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const plainDesc = task.description ? stripHtml(task.description) : null
  const shortDesc = plainDesc && plainDesc.length > 120 ? plainDesc.slice(0, 120) + '…' : plainDesc
  const needsExpand = plainDesc && plainDesc.length > 120

  const archivedDate = task.deletedAt
    ? new Date(task.deletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const statusInfo = STATUS_BADGE[task.status] ?? STATUS_BADGE.BACKLOG
  const src = (task.source ?? 'MANUAL').toUpperCase()
  const sourceInfo = SOURCE_BADGE[src] ?? SOURCE_BADGE.MANUAL

  return (
    <div
      className="archive-card rounded-xl overflow-hidden transition-all"
      style={{
        background: selected ? '#0052cc18' : '#1d2125',
        border: `1px solid ${selected ? '#579dff55' : '#2c333a'}`,
      }}
    >
      {/* Label stripe */}
      <div className="h-1 rounded-t-xl" style={{ background: LABEL_COLORS[task.label] }} />

      {/* Main row */}
      <div className="p-3 flex items-start gap-2.5">
        {/* Checkbox */}
        <button
          onClick={() => onSelect(task.id)}
          className="flex-shrink-0 mt-0.5 w-4 h-4 rounded flex items-center justify-center"
          style={{
            background: selected ? '#579dff' : 'transparent',
            border: `1.5px solid ${selected ? '#579dff' : '#444c56'}`,
          }}
        >
          {selected && <span className="text-white text-[10px] leading-none">✓</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug mb-1.5" style={{ color: '#c9d1d9' }}>
            {task.title}
          </p>

          {/* Description */}
          {plainDesc && (
            <p
              className="text-xs leading-relaxed mb-2 cursor-pointer"
              style={{ color: '#8b949e' }}
              onClick={() => needsExpand && setExpanded(e => !e)}
            >
              {expanded ? plainDesc : shortDesc}
              {needsExpand && (
                <span className="ml-1 font-semibold" style={{ color: '#579dff' }}>
                  {expanded ? ' show less' : ' show more'}
                </span>
              )}
            </p>
          )}

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {/* Status */}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: statusInfo.bg, color: statusInfo.color, border: `1px solid ${statusInfo.color}44` }}>
              {statusInfo.label}
            </span>
            {/* Priority */}
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: '#22272b', color: '#8b949e', border: '1px solid #2c333a' }}>
              {PRIORITY_LABELS[task.priority]} {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
            </span>
            {/* Assignee */}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: '#22272b', color: '#8b949e', border: '1px solid #2c333a' }}>
              {ASSIGNEE_EMOJI[task.assignee]}
            </span>
            {/* Source */}
            {task.source && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: sourceInfo.color + '22', color: sourceInfo.color, border: `1px solid ${sourceInfo.color}44` }}>
                {sourceInfo.label}
              </span>
            )}
            {/* Tags */}
            {task.tags?.map(tt => (
              <span key={tt.tag.id} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: tt.tag.color + '22', color: tt.tag.color, border: `1px solid ${tt.tag.color}33` }}>
                {tt.tag.name}
              </span>
            ))}
          </div>

          {/* Archived date */}
          {archivedDate && (
            <p className="text-[10px] flex items-center gap-1" style={{ color: '#444c56' }}>
              <span>📦</span> Archived {archivedDate}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={onRestore}
            className="text-[11px] px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap"
            style={{ background: '#0052cc22', color: '#579dff', border: '1px solid #0052cc44' }}>
            ↩ Restore
          </button>
          {confirmDel ? (
            <button onClick={onDelete}
              className="text-[11px] px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap"
              style={{ background: '#ff563033', color: '#ff8f73', border: '1px solid #ff563055' }}>
              Confirm
            </button>
          ) : (
            <button onClick={() => setConfirmDel(true)}
              className="text-[11px] px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap"
              style={{ background: 'transparent', color: '#444c56', border: '1px solid #2c333a' }}>
              🗑 Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Search + Filter bar ──────────────────────────────────────────────────────
function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (f: Filters) => void
}) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value })

  const chipBase: React.CSSProperties = {
    background: '#22272b',
    border: '1px solid #2c333a',
    color: '#b6c2cf',
    borderRadius: '9999px',
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    flexShrink: 0,
  }
  const chipActive: React.CSSProperties = {
    ...chipBase,
    background: '#0052cc',
    border: '1px solid #0052cc',
    color: '#fff',
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 overflow-x-auto flex-shrink-0"
      style={{ background: '#1d2125', borderBottom: '1px solid #2c333a' }}
    >
      {/* Search input */}
      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        style={{
          background: '#22272b',
          border: '1px solid #2c333a',
          borderRadius: '9999px',
          padding: '5px 12px',
          minWidth: 140,
        }}
      >
        <Search size={12} style={{ color: '#626f86', flexShrink: 0 }} />
        <input
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          placeholder="Search..."
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#b6c2cf',
            fontSize: '12px',
            width: '100%',
            minWidth: 80,
          }}
        />
        {filters.search && (
          <button onClick={() => set('search', '')} style={{ color: '#626f86', lineHeight: 1 }}>
            <X size={11} />
          </button>
        )}
      </div>

      {/* Priority filter */}
      <select
        value={filters.priority}
        onChange={e => set('priority', e.target.value)}
        style={filters.priority ? chipActive : chipBase}
      >
        <option value="">All Priorities</option>
        <option value="URGENT">🔴 Urgent</option>
        <option value="HIGH">🟠 High</option>
        <option value="MEDIUM">🟡 Medium</option>
        <option value="LOW">🟢 Low</option>
      </select>

      {/* Assignee filter */}
      <select
        value={filters.assignee}
        onChange={e => set('assignee', e.target.value)}
        style={filters.assignee ? chipActive : chipBase}
      >
        <option value="">All Assignees</option>
        <option value="MAX">🤖 Max</option>
        <option value="VINCE">👤 Vince</option>
        <option value="BOTH">👥 Both</option>
      </select>

      {/* Overdue toggle */}
      <button
        onClick={() => set('overdue', !filters.overdue)}
        style={filters.overdue ? chipActive : chipBase}
      >
        ⚠️ Overdue
      </button>

      {/* Archive toggle */}
      <button
        onClick={() => set('view', filters.view === 'archive' ? 'board' : 'archive')}
        style={filters.view === 'archive' ? chipActive : chipBase}
        className="flex items-center gap-1"
      >
        <Archive size={12} /> Archive
      </button>

      {/* Compact toggle */}
      <button
        onClick={() => set('compact', !filters.compact)}
        style={filters.compact ? chipActive : chipBase}
        className="flex items-center gap-1"
        title="Compact view"
      >
        <LayoutList size={12} /> Compact
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(defaultFilters)

  const [viewTask, setViewTask] = useState<Task | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editForm, setEditForm] = useState<TaskFormData>(defaultForm)
  const [createForCol, setCreateForCol] = useState<TaskStatus | null>(null)
  const [createForm, setCreateForm] = useState<TaskFormData>(defaultForm)

  // DnD state
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const dragJustEndedRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchTasks = useCallback(async (currentFilters?: Filters) => {
    const f = currentFilters ?? filters
    try {
      const res = await fetch(buildUrl(f))
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    fetchTasks(filters)
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time: re-fetch when any task changes on the server (debounced)
  useEffect(() => {
    let es: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout>
    let debounceTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      es = new EventSource('/api/tasks/stream')
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          if (event.type !== 'ping') {
            // Debounce: batch rapid SSE events (e.g. from multi-PATCH drag ops)
            clearTimeout(debounceTimeout)
            debounceTimeout = setTimeout(() => fetchTasks(), 300)
          }
        } catch { /* ignore */ }
      }
      es.onerror = () => {
        es?.close()
        // Reconnect after 5s
        retryTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      es?.close()
      clearTimeout(retryTimeout)
      clearTimeout(debounceTimeout)
    }
  }, [fetchTasks])

  // ── Grouped by status, sorted by order ───────────────────────────────────
  const grouped = useCallback(
    () => COLUMNS.reduce((acc, col) => {
      acc[col.id] = tasks.filter(t => t.status === col.id).sort((a, b) => a.order - b.order)
      return acc
    }, {} as Record<TaskStatus, Task[]>),
    [tasks]
  )()

  // ── DnD handlers ──────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const task = tasks.find(t => t.id === active.id)
    if (task) setActiveTask(task)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const activeTask = tasks.find(t => t.id === activeId)
    if (!activeTask) return

    const overTask = tasks.find(t => t.id === overId)
    const overColumnId = overTask
      ? overTask.status
      : (COLUMNS.find(c => c.id === overId)?.id ?? null)

    if (!overColumnId || overColumnId === activeTask.status) return

    setTasks(prev => prev.map(t =>
      t.id === activeId ? { ...t, status: overColumnId as TaskStatus } : t
    ))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    dragJustEndedRef.current = true
    setTimeout(() => { dragJustEndedRef.current = false }, 200)

    if (!over) { fetchTasks(); return }

    const activeId = active.id as string
    const overId = over.id as string

    const movedTask = tasks.find(t => t.id === activeId)
    if (!movedTask) return

    const overTask = tasks.find(t => t.id === overId)
    const targetStatus = overTask
      ? overTask.status
      : (COLUMNS.find(c => c.id === overId)?.id ?? movedTask.status) as TaskStatus

    // All tasks in target column except the moved one, in current order
    const colTasks = tasks
      .filter(t => t.status === targetStatus && t.id !== activeId)
      .sort((a, b) => a.order - b.order)

    // Find insertion index
    let insertAt = colTasks.length
    if (overTask && overTask.id !== activeId) {
      const idx = colTasks.findIndex(t => t.id === overId)
      if (idx >= 0) insertAt = idx
    }

    const reordered = [...colTasks]
    reordered.splice(insertAt, 0, { ...movedTask, status: targetStatus })

    // Assign sequential order values
    const updates = reordered.map((t, i) => ({ id: t.id, status: targetStatus, order: i }))

    // Optimistic update
    setTasks(prev => {
      const rest = prev.filter(t => t.status !== targetStatus)
      const updated = updates.map(u => ({
        ...prev.find(t => t.id === u.id)!,
        status: u.status,
        order: u.order,
      }))
      return [...rest, ...updated]
    })

    // Persist — check each response; revert optimistic update on any failure
    try {
      const responses = await Promise.all(updates.map(u =>
        fetch(`/api/tasks/${u.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: u.status, order: u.order }),
        })
      ))
      const failed = responses.filter(r => !r.ok)
      if (failed.length > 0) {
        console.error(`[dragEnd] ${failed.length} PATCH(es) failed — reverting to server state`)
        fetchTasks()
      }
    } catch (e) {
      console.error('[dragEnd] network error — reverting to server state', e)
      fetchTasks()
    }
  }

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  // Reset delete confirmation whenever selection changes
  const toggleSelection = useCallback((id: string) => {
    setConfirmBulkDelete(false)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Sheet navigation ──────────────────────────────────────────────────────
  const openView = (task: Task) => {
    if (dragJustEndedRef.current) return
    if (bulkMode) return
    setViewTask(task)
  }
  const switchToEdit = () => {
    if (!viewTask) return
    setEditForm({
      title: viewTask.title,
      description: viewTask.description || '',
      status: viewTask.status,
      priority: viewTask.priority,
      assignee: viewTask.assignee,
      label: viewTask.label,
      dueDate: viewTask.dueDate ? viewTask.dueDate.split('T')[0] : '',
      recurrence: viewTask.recurrence || 'NONE',
    })
    setEditTask(viewTask)
    setViewTask(null)
  }
  const openCreate = useCallback((status: TaskStatus) => {
    setCreateForCol(status); setCreateForm({ ...defaultForm, status })
  }, [])

  // When detail sheet refreshes, update the viewTask from fetched tasks
  const handleRefresh = useCallback(async () => {
    await fetchTasks()
    // Update viewTask with fresh data if it's still open
    if (viewTask) {
      setViewTask(prev => {
        if (!prev) return prev
        // Will be updated via tasks state on next render
        return prev
      })
    }
  }, [fetchTasks, viewTask])

  // Sync viewTask from tasks array when tasks refresh
  useEffect(() => {
    if (viewTask) {
      const fresh = tasks.find(t => t.id === viewTask.id)
      if (fresh) setViewTask(fresh)
    }
  }, [tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuickAdd = async (status: TaskStatus, title: string) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status, priority: 'MEDIUM', assignee: 'BOTH', label: 'WORK', source: 'MANUAL' }),
      })
      if (res.ok) fetchTasks()
    } catch (e) { console.error(e) }
  }

  const handleCreate = async () => {
    if (!createForm.title.trim()) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, dueDate: createForm.dueDate || null, source: 'MANUAL' }),
      })
      if (res.ok) { setCreateForCol(null); setCreateForm(defaultForm); fetchTasks() }
    } catch (e) { console.error(e) }
  }

  const handleEdit = async () => {
    if (!editTask || !editForm.title.trim()) return
    try {
      const res = await fetch(`/api/tasks/${editTask.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, dueDate: editForm.dueDate || null }),
      })
      if (res.ok) { setEditTask(null); fetchTasks() }
    } catch (e) { console.error(e) }
  }

  const handleDelete = async () => {
    if (!editTask) return
    try {
      await fetch(`/api/tasks/${editTask.id}`, { method: 'DELETE' })
      setEditTask(null); fetchTasks()
    } catch (e) { console.error(e) }
  }

  const [selectedArchive, setSelectedArchive] = useState<Set<string>>(new Set())
  const [archiveSort, setArchiveSort] = useState<'newest' | 'priority' | 'status'>('newest')
  const [archiveSearch, setArchiveSearch] = useState('')

  const toggleArchiveSelect = (id: string) =>
    setSelectedArchive(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAllArchive = () =>
    setSelectedArchive(filteredArchive.length === selectedArchive.size ? new Set() : new Set(filteredArchive.map(t => t.id)))

  const filteredArchive = useMemo(() => {
    let list = [...tasks]
    if (archiveSearch.trim()) {
      const q = archiveSearch.toLowerCase()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && stripHtml(t.description).toLowerCase().includes(q))
      )
    }
    if (archiveSort === 'newest') list.sort((a, b) => new Date(b.deletedAt ?? 0).getTime() - new Date(a.deletedAt ?? 0).getTime())
    else if (archiveSort === 'priority') {
      const ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      list.sort((a, b) => (ORDER[a.priority] ?? 2) - (ORDER[b.priority] ?? 2))
    } else if (archiveSort === 'status') {
      const ORDER: Record<string, number> = { DONE: 0, IN_PROGRESS: 1, REVIEW: 2, BACKLOG: 3 }
      list.sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3))
    }
    return list
  }, [tasks, archiveSearch, archiveSort])

  const handleRestore = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restore: true }),
      })
      setSelectedArchive(prev => { const n = new Set(prev); n.delete(taskId); return n })
      fetchTasks()
    } catch (e) { console.error(e) }
  }

  const handlePermanentDelete = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      setSelectedArchive(prev => { const n = new Set(prev); n.delete(taskId); return n })
      fetchTasks()
    } catch (e) { console.error(e) }
  }

  const handleBulkRestore = async () => {
    await Promise.all([...selectedArchive].map(id => handleRestore(id)))
    setSelectedArchive(new Set())
  }

  const handleBulkDelete = async () => {
    await Promise.all([...selectedArchive].map(id => handlePermanentDelete(id)))
    setSelectedArchive(new Set())
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable]')
      ) return
      if (viewTask || editTask || createForCol !== null) return

      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault()
          openCreate('BACKLOG')
          break
        case '/':
          e.preventDefault()
          document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus()
          break
        case 'Escape':
          setViewTask(null)
          setEditTask(null)
          setCreateForCol(null)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [viewTask, editTask, createForCol, openCreate])

  return (
    <div className="h-screen flex flex-col" style={{ background: '#1d2125' }}>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3 flex-shrink-0"
        style={{ background: '#1d2125', borderBottom: '1px solid #2c333a' }}
      >
        <h1 className="text-base font-bold text-white flex-1">📋 Tasks</h1>
        <span className="hidden md:flex items-center gap-3 text-xs" style={{ color: '#3d4f61' }}>
          <span><kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#22272b', border: '1px solid #2c333a' }}>N</kbd> new</span>
          <span><kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#22272b', border: '1px solid #2c333a' }}>/</kbd> search</span>
          <span><kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#22272b', border: '1px solid #2c333a' }}>Esc</kbd> close</span>
        </span>
        <button
          onClick={() => { setBulkMode(b => !b); setSelectedIds(new Set()); setConfirmBulkDelete(false) }}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold"
          style={{
            background: bulkMode ? '#0052cc22' : '#22272b',
            color: bulkMode ? '#579dff' : '#b6c2cf',
            border: `1px solid ${bulkMode ? '#0052cc44' : '#2c333a'}`,
          }}>
          {bulkMode ? '✕ Cancel' : '☑ Select'}
        </button>
      </div>

      {/* ── Filter bar ── */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* ── Archive view ── */}
      {filters.view === 'archive' ? (
        <div className="flex-1 overflow-y-auto"
          style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Archive toolbar */}
          <div className="sticky top-0 z-10 px-3 pt-3 pb-2 space-y-2" style={{ background: '#161b22' }}>
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: '#1d2125', border: '1px solid #2c333a' }}>
              <Search size={13} style={{ color: '#626f86', flexShrink: 0 }} />
              <input
                value={archiveSearch}
                onChange={e => setArchiveSearch(e.target.value)}
                placeholder="Search archived tasks…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#c9d1d9' }}
              />
              {archiveSearch && (
                <button onClick={() => setArchiveSearch('')} style={{ color: '#626f86' }}><X size={12} /></button>
              )}
            </div>

            {/* Row: count + sort */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold" style={{ color: '#626f86' }}>
                📦 {filteredArchive.length} archived{archiveSearch ? ` (filtered)` : ''}
              </span>
              <div className="flex gap-1">
                {(['newest', 'priority', 'status'] as const).map(s => (
                  <button key={s} onClick={() => setArchiveSort(s)}
                    className="text-[10px] font-bold px-2 py-1 rounded-full capitalize"
                    style={{
                      background: archiveSort === s ? '#0052cc33' : '#1d2125',
                      color: archiveSort === s ? '#579dff' : '#626f86',
                      border: `1px solid ${archiveSort === s ? '#0052cc55' : '#2c333a'}`,
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk action bar */}
            {filteredArchive.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={selectAllArchive}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  style={{ background: '#1d2125', color: '#8b949e', border: '1px solid #2c333a' }}>
                  <span className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: selectedArchive.size === filteredArchive.length ? '#579dff' : 'transparent', border: `1.5px solid ${selectedArchive.size === filteredArchive.length ? '#579dff' : '#444c56'}` }}>
                    {selectedArchive.size === filteredArchive.length && <span className="text-white text-[9px]">✓</span>}
                  </span>
                  {selectedArchive.size === filteredArchive.length ? 'Deselect all' : 'Select all'}
                </button>
                {selectedArchive.size > 0 && (
                  <>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full"
                      style={{ background: '#0052cc22', color: '#579dff' }}>
                      {selectedArchive.size} selected
                    </span>
                    <button onClick={handleBulkRestore}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: '#0052cc22', color: '#579dff', border: '1px solid #0052cc44' }}>
                      ↩ Restore all
                    </button>
                    <button onClick={handleBulkDelete}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: '#ff563022', color: '#ff8f73', border: '1px solid #ff563044' }}>
                      🗑 Delete all
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Cards */}
          <div className="px-3 pb-3 space-y-2">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="rounded-xl h-20 animate-pulse" style={{ background: '#1d2125' }} />
              ))
            ) : filteredArchive.length === 0 ? (
              <div className="rounded-xl p-10 text-center mt-4" style={{ background: '#1d2125', border: '1px dashed #2c333a' }}>
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm font-semibold" style={{ color: '#4b5563' }}>
                  {archiveSearch ? 'No matches in archive' : 'Archive is empty'}
                </p>
              </div>
            ) : (
              filteredArchive.map(task => (
                <ArchiveCard
                  key={task.id}
                  task={task}
                  selected={selectedArchive.has(task.id)}
                  onSelect={toggleArchiveSelect}
                  onRestore={() => handleRestore(task.id)}
                  onDelete={() => handlePermanentDelete(task.id)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        /* ── Kanban board with DnD ── */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto"
            style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex gap-3 h-full p-3"
              style={{ minWidth: `${COLUMNS.length * 284}px`, alignItems: 'flex-start' }}>

              {COLUMNS.map(col => {
                const colTasks = grouped[col.id] || []
                return (
                  <div key={col.id} className="flex flex-col flex-shrink-0 rounded-xl"
                    style={{ width: 272, background: '#101204', maxHeight: 'calc(100vh - 165px)' }}>

                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                        <span className="text-sm font-bold text-white">{col.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: '#2c333a', color: '#8c9bab' }}>{colTasks.length}</span>
                        <button onClick={() => openCreate(col.id)}
                          className="w-6 h-6 flex items-center justify-center rounded"
                          style={{ color: '#8c9bab' }}><Plus size={16} /></button>
                      </div>
                    </div>

                    {/* Droppable + sortable cards */}
                    <SortableContext
                      items={colTasks.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <DroppableColumn id={col.id} compact={filters.compact}>
                        {loading
                          ? [1, 2].map(i => (
                              <div key={i} className="rounded-lg h-20 animate-pulse" style={{ background: '#22272b' }} />
                            ))
                          : colTasks.map(task => (
                              <SortableTaskCard
                                key={task.id}
                                task={task}
                                onClick={() => openView(task)}
                                bulkMode={bulkMode}
                                isSelected={selectedIds.has(task.id)}
                                onToggleSelect={() => toggleSelection(task.id)}
                                onRefresh={fetchTasks}
                                compact={filters.compact}
                              />
                            ))
                        }
                        {!loading && colTasks.length === 0 && (
                          <div className="h-12 rounded-lg border border-dashed flex items-center justify-center"
                            style={{ borderColor: '#2c333a' }}>
                            <span className="text-xs" style={{ color: '#3d4f61' }}>Drop here</span>
                          </div>
                        )}
                      </DroppableColumn>
                    </SortableContext>

                    {/* Quick add */}
                    <div className="px-2 pb-2 pt-1">
                      <AddCardRow onAdd={title => handleQuickAdd(col.id, title)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Drag overlay (floating ghost card) ── */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
            {activeTask && (
              <div style={{ width: 272, pointerEvents: 'none' }}>
                <TaskCardContent task={activeTask} isDragging compact={filters.compact} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Task detail sheet ── */}
      <BottomSheet
        open={!!viewTask}
        onClose={() => setViewTask(null)}
        title={viewTask?.label ?? 'Task'}
        footer={viewTask && (
          <TaskDetailActions
            task={viewTask}
            onEdit={switchToEdit}
            onRefresh={handleRefresh}
          />
        )}
      >
        {viewTask && (
          <TaskDetailSheet
            task={viewTask}
            onRefresh={handleRefresh}
          />
        )}
      </BottomSheet>

      {/* ── Edit sheet ── */}
      <BottomSheet
        open={!!editTask}
        onClose={() => setEditTask(null)}
        title={editTask?.source === 'TEAMS' ? '💬 Edit Teams Reminder' : 'Edit Task'}
      >
        {editTask && (
          <TaskForm data={editForm} onChange={setEditForm} onSubmit={handleEdit}
            submitLabel="Save Changes" onDelete={handleDelete} />
        )}
      </BottomSheet>

      {/* ── Create sheet ── */}
      <BottomSheet open={createForCol !== null} onClose={() => setCreateForCol(null)}
        title={`New Task — ${COLUMNS.find(c => c.id === createForCol)?.label}`}>
        <TaskForm data={createForm} onChange={setCreateForm} onSubmit={handleCreate} submitLabel="Create Card" />
      </BottomSheet>

      {/* ── Bulk action toolbar ── */}
      {bulkMode && selectedIds.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3 flex items-center gap-2"
          style={{
            background: '#1d2125',
            borderTop: '1px solid #2c333a',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <span className="text-sm font-semibold text-white flex-1">{selectedIds.size} selected</span>
          <select
            defaultValue=""
            onChange={async (e) => {
              if (!e.target.value) return
              const status = e.target.value as TaskStatus
              await Promise.all([...selectedIds].map(id =>
                fetch(`/api/tasks/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status }),
                })
              ))
              setSelectedIds(new Set())
              setBulkMode(false)
              fetchTasks()
              e.target.value = ''
            }}
            style={{ background: '#22272b', border: '1px solid #2c333a', color: '#b6c2cf', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', outline: 'none' }}
          >
            <option value="">Move to...</option>
            <option value="BACKLOG">Backlog</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REVIEW">Review</option>
            <option value="DONE">Done</option>
          </select>
          <button
            onClick={async () => {
              await Promise.all([...selectedIds].map(id =>
                fetch(`/api/tasks/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ archive: true }),
                })
              ))
              setSelectedIds(new Set())
              setBulkMode(false)
              fetchTasks()
            }}
            className="h-9 px-3 rounded-lg text-sm font-semibold"
            style={{ background: '#ff563022', color: '#ff8f73', border: '1px solid #ff563044' }}
          >
            Archive
          </button>
          {confirmBulkDelete ? (
            <button
              onClick={async () => {
                await Promise.all([...selectedIds].map(id =>
                  fetch(`/api/tasks/${id}`, { method: 'DELETE' })
                ))
                setSelectedIds(new Set())
                setBulkMode(false)
                setConfirmBulkDelete(false)
                fetchTasks()
              }}
              className="h-9 px-3 rounded-lg text-sm font-bold"
              style={{ background: '#ff5630', color: '#fff' }}
            >
              Confirm Delete
            </button>
          ) : (
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="h-9 px-3 rounded-lg text-sm font-semibold"
              style={{ background: '#ff563033', color: '#ff8f73', border: '1px solid #ff563066' }}
            >
              🗑 Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
