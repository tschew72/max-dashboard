'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, X, Calendar, RefreshCw, AlertCircle, AlignLeft, GripVertical } from 'lucide-react'
import { RichTextEditor, RichTextRender } from '@/components/ui/RichTextEditor'
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
  MAX: '🤖',
  VINCE: '👤',
  BOTH: '👥',
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

// ─── Pure card UI (no drag wiring) ───────────────────────────────────────────
function TaskCardContent({
  task,
  isDragging = false,
  dragHandleProps,
}: {
  task: Task
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}) {
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
  const formattedDue = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null
  const isTeams = task.source === 'TEAMS'
  const plainDesc = task.description ? stripHtml(task.description) : null

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
            {isTeams && (
              <div className="mb-1">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: '#0065ff22', color: '#579dff' }}
                >
                  💬 Teams
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
}: {
  task: Task
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // When dragging this item, show a ghost placeholder
    opacity: isDragging ? 0.35 : 1,
    cursor: 'pointer',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
    >
      <TaskCardContent
        task={task}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ─── Droppable column container ───────────────────────────────────────────────
function DroppableColumn({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'column', columnId: id } })
  return (
    <div
      ref={setNodeRef}
      className="flex-1 overflow-y-auto px-2 pb-1 space-y-2 min-h-[60px] transition-colors rounded-lg"
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
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative rounded-t-2xl max-h-[96vh] flex flex-col"
        style={{ background: '#1d2125', border: '1px solid #2c333a', borderBottom: 'none' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2c333a' }} />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} style={{ color: '#8c9bab' }}><X size={20} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-8 flex-1">{children}</div>
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
  assignee: Assignee; label: Label; dueDate: string
}
const defaultForm: TaskFormData = {
  title: '', description: '', status: 'BACKLOG', priority: 'MEDIUM',
  assignee: 'BOTH', label: 'WORK', dueDate: '',
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

// ─── Task detail (read-only) ──────────────────────────────────────────────────
function TaskDetailSheet({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
  const formattedDue = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ background: LABEL_COLORS[task.label] }} />
        <h3 className="text-lg font-bold text-white leading-snug">{task.title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#22272b', color: '#b6c2cf' }}>
          {PRIORITY_LABELS[task.priority]} {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
        </span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#22272b', color: '#b6c2cf' }}>
          {ASSIGNEE_EMOJI[task.assignee]} {task.assignee.charAt(0) + task.assignee.slice(1).toLowerCase()}
        </span>
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
      <button onClick={onEdit} className="w-full h-11 rounded-lg text-sm font-bold text-white" style={{ background: '#0052cc' }}>
        Edit Task
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const [viewTask, setViewTask] = useState<Task | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editForm, setEditForm] = useState<TaskFormData>(defaultForm)
  const [createForCol, setCreateForCol] = useState<TaskStatus | null>(null)
  const [createForm, setCreateForm] = useState<TaskFormData>(defaultForm)

  // DnD state
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  // Prevent click-after-drag from opening sheet
  const dragJustEndedRef = useRef(false)

  // ── Sensors: 8px tolerance so tiny taps don't accidentally start a drag ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const syncMentions = async () => {
    setSyncing(true)
    try {
      await fetch('/api/tasks/sync-mentions', { method: 'POST' })
      await fetchTasks()
    } catch (e) { console.error(e) }
    finally { setSyncing(false) }
  }
  useEffect(() => { syncMentions() }, []) // eslint-disable-line

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

    // Determine target column
    const overTask = tasks.find(t => t.id === overId)
    const overColumnId = overTask
      ? overTask.status
      : (COLUMNS.find(c => c.id === overId)?.id ?? null)

    if (!overColumnId || overColumnId === activeTask.status) return

    // Optimistically move task to new column
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

    // Determine final column
    const overTask = tasks.find(t => t.id === overId)
    const targetColumnId = overTask
      ? overTask.status
      : (COLUMNS.find(c => c.id === overId)?.id ?? movedTask.status)

    // Compute new order: insert before overTask, or append to column
    const colTasks = tasks
      .filter(t => t.status === targetColumnId && t.id !== activeId)
      .sort((a, b) => a.order - b.order)

    let newOrder: number
    if (overTask && overTask.id !== activeId) {
      const idx = colTasks.findIndex(t => t.id === overId)
      newOrder = idx >= 0 ? idx : colTasks.length
    } else {
      newOrder = colTasks.length
    }

    // Optimistic update: reorder within column
    const newColTasks = [...colTasks]
    newColTasks.splice(newOrder, 0, { ...movedTask, status: targetColumnId as TaskStatus })
    setTasks(prev => {
      const others = prev.filter(t => t.status !== targetColumnId || t.id === activeId)
      const updated = newColTasks.map((t, i) => ({ ...t, order: i }))
      const rest = others.filter(t => t.id !== activeId)
      return [...rest, ...updated]
    })

    // Persist to API
    try {
      await fetch(`/api/tasks/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetColumnId, order: newOrder }),
      })
    } catch (e) {
      console.error(e)
      fetchTasks() // revert on failure
    }
  }

  // ── Sheet navigation ──────────────────────────────────────────────────────
  const openView = (task: Task) => {
    if (dragJustEndedRef.current) return
    setViewTask(task)
  }
  const switchToEdit = () => {
    if (!viewTask) return
    setEditForm({
      title: viewTask.title, description: viewTask.description || '',
      status: viewTask.status, priority: viewTask.priority,
      assignee: viewTask.assignee, label: viewTask.label,
      dueDate: viewTask.dueDate ? viewTask.dueDate.split('T')[0] : '',
    })
    setEditTask(viewTask)
    setViewTask(null)
  }
  const openCreate = (status: TaskStatus) => {
    setCreateForCol(status); setCreateForm({ ...defaultForm, status })
  }

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

  const remindersCount = tasks.filter(t => t.source === 'TEAMS' && t.status !== 'DONE').length

  return (
    <div className="h-screen flex flex-col" style={{ background: '#1d2125' }}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3 flex-shrink-0"
        style={{ background: '#1d2125', borderBottom: '1px solid #2c333a' }}>
        <h1 className="text-base font-bold text-white flex-1">📋 Tasks</h1>
        {remindersCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: '#0065ff22', color: '#579dff' }}>
            💬 {remindersCount} reminder{remindersCount !== 1 ? 's' : ''}
          </span>
        )}
        <button onClick={syncMentions} disabled={syncing}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={{ background: '#22272b', color: '#b6c2cf', border: '1px solid #2c333a' }}>
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />Sync
        </button>
      </div>

      {/* ── Kanban board with DnD ── */}
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
                  style={{ width: 272, background: '#101204', maxHeight: 'calc(100vh - 130px)' }}>

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
                    <DroppableColumn id={col.id}>
                      {loading
                        ? [1, 2].map(i => (
                            <div key={i} className="rounded-lg h-20 animate-pulse" style={{ background: '#22272b' }} />
                          ))
                        : colTasks.map(task => (
                            <SortableTaskCard key={task.id} task={task} onClick={() => openView(task)} />
                          ))
                      }
                      {/* Empty column drop target padding */}
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
              <TaskCardContent task={activeTask} isDragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Task detail sheet ── */}
      <BottomSheet open={!!viewTask} onClose={() => setViewTask(null)} title={viewTask?.label ?? 'Task'}>
        {viewTask && <TaskDetailSheet task={viewTask} onEdit={switchToEdit} />}
      </BottomSheet>

      {/* ── Edit sheet ── */}
      <BottomSheet open={!!editTask} onClose={() => setEditTask(null)}
        title={editTask?.source === 'TEAMS' ? '💬 Edit Teams Reminder' : 'Edit Task'}>
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
    </div>
  )
}
