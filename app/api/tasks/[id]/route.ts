import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import fs from 'fs'

const MENTION_STATE_PATHS = [
  '/root/.outlook-mcp/mention-state.json',
  '/root/.home/.outlook-mcp/mention-state.json',
]

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const markingDone = body.status === 'DONE'

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
      },
    })

    // If marking a Teams reminder as done, sync back to mention-state.json
    if (markingDone && task.source === 'TEAMS' && task.sourceId) {
      syncMentionDone(task.sourceId)
    }

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
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
