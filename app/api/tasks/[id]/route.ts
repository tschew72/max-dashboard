import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import fs from 'fs'
import { spawn } from 'child_process'
import { emitTaskEvent } from '@/lib/taskEvents'
import { createActivity } from '@/lib/activity'

const MENTION_STATE_PATHS = [
  '/root/.outlook-mcp/mention-state.json',
  '/root/.home/.outlook-mcp/mention-state.json',
]
const MAX_QUEUE_PATH = '/root/.openclaw/workspace/data/max-queue.json'
const DISCORD_CHANNEL = '1473965360364392480'

function syncMaxQueueDone(taskId: string) {
  try {
    if (!fs.existsSync(MAX_QUEUE_PATH)) return
    const queue: Record<string, unknown>[] = JSON.parse(fs.readFileSync(MAX_QUEUE_PATH, 'utf8'))
    const updated = queue.map(q =>
      q.taskId === taskId ? { ...q, status: 'done', completedAt: new Date().toISOString() } : q
    )
    fs.writeFileSync(MAX_QUEUE_PATH, JSON.stringify(updated, null, 2))
  } catch { /* best-effort */ }
}

function notifyDone(title: string, assignee: string, source: string | null) {
  try {
    const who = assignee === 'MAX' ? 'Max' : assignee === 'VINCE' ? 'Vince' : 'Both'
    const src = source === 'TEAMS' ? ' · 💬 Teams' : source === 'MAX' ? ' · ⚡ Max' : ''
    const msg = `✅ **Task Done** · *${title}* (${who}${src})`
    // Fire-and-forget: don't block the PATCH response on Discord delivery
    const child = spawn(
      'openclaw',
      ['message', 'send', '--channel', 'discord', '--target', DISCORD_CHANNEL, '--message', msg],
      { detached: true, stdio: 'ignore' }
    )
    child.unref()
  } catch { /* non-fatal */ }
}

function syncMentionDone(sourceId: string) {
  for (const p of MENTION_STATE_PATHS) {
    try {
      if (!fs.existsSync(p)) continue
      const state = JSON.parse(fs.readFileSync(p, 'utf-8'))
      if (state.mentions_tracking?.[sourceId]) {
        state.mentions_tracking[sourceId].response_status = 'resolved'
        state.mentions_tracking[sourceId].completed_at = new Date().toISOString()
        fs.writeFileSync(p, JSON.stringify(state, null, 2))
        return
      }
    } catch { /* skip */ }
  }
}

function computeNextDue(from: Date, recurrence: string): Date | null {
  const next = new Date(from)
  switch (recurrence) {
    case 'DAILY':   next.setDate(next.getDate() + 1); break
    case 'WEEKLY':  next.setDate(next.getDate() + 7); break
    case 'MONTHLY': next.setMonth(next.getMonth() + 1); break
    default: return null
  }
  return next
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()

    // Fetch before update so we can diff for activity log + detect real DONE transitions
    const existing = await prisma.task.findUnique({ where: { id } })

    // Only treat as "marking done" when actually transitioning INTO DONE (not reordering already-DONE tasks)
    const markingDone = body.status === 'DONE' && existing?.status !== 'DONE'

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.assignee !== undefined && { assignee: body.assignee }),
        ...(body.label !== undefined && { label: body.label }),
        ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
        ...(body.order !== undefined && { order: body.order }),
        ...(markingDone && { completedAt: new Date() }),
        ...(body.archive === true && { deletedAt: new Date() }),
        ...(body.restore === true && { deletedAt: null }),
        ...(body.parentId !== undefined && { parentId: body.parentId }),
        ...(body.recurrence !== undefined && { recurrence: body.recurrence }),
        ...(body.recurrenceNextDue !== undefined && { recurrenceNextDue: body.recurrenceNextDue ? new Date(body.recurrenceNextDue) : null }),
      },
      include: {
        _count: { select: { subtasks: true, comments: true } },
        subtasks: { where: { deletedAt: null }, select: { id: true, title: true, status: true } },
        tags: { include: { tag: true } },
      },
    })

    // If marking a Teams reminder as done, sync back to mention-state.json
    if (markingDone && task.source === 'TEAMS' && task.sourceId) {
      syncMentionDone(task.sourceId)
    }

    // If marking done: clean Max queue + notify Discord
    if (markingDone) {
      syncMaxQueueDone(id)
      notifyDone(task.title, task.assignee, task.source)
    }

    // Auto-escalate: if overdue by 3+ days and not URGENT, bump priority
    if (task.dueDate && task.status !== 'DONE' && task.priority !== 'URGENT') {
      const daysOverdue = Math.floor((Date.now() - new Date(task.dueDate).getTime()) / 86400000)
      if (daysOverdue >= 3) {
        await prisma.task.update({ where: { id }, data: { priority: 'URGENT' } })
        task.priority = 'URGENT'
      }
    }

    // Activity log recording
    if (existing) {
      if (body.status !== undefined && body.status !== existing.status) {
        await createActivity(id, 'SYSTEM', 'status_changed', { from: existing.status, to: body.status })
      }
      if (body.priority !== undefined && body.priority !== existing.priority) {
        await createActivity(id, 'SYSTEM', 'priority_changed', { from: existing.priority, to: body.priority })
      }
      if (body.archive === true) {
        await createActivity(id, 'SYSTEM', 'archived', {})
      }
      if (body.restore === true) {
        await createActivity(id, 'SYSTEM', 'restored', {})
      }
    }

    // Recurring task: when marking DONE and recurrence is set, spawn next instance
    if (body.status === 'DONE' && task.recurrence && task.recurrence !== 'NONE' && task.dueDate) {
      const nextDue = computeNextDue(new Date(task.dueDate), task.recurrence as string)
      if (nextDue) {
        await prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            status: 'BACKLOG',
            priority: task.priority,
            assignee: task.assignee,
            label: task.label,
            dueDate: nextDue,
            order: 0,
            parentId: task.parentId,
            recurrence: task.recurrence,
            source: 'SYSTEM',
          },
        })
      }
    }

    emitTaskEvent('updated', task.id)

    return NextResponse.json(task)
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.task.delete({ where: { id } })
    emitTaskEvent('deleted', id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
