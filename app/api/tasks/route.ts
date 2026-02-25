import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { emitTaskEvent } from '@/lib/taskEvents'
import { createActivity } from '@/lib/activity'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const archived = searchParams.get('archived') === 'true'
    const search = searchParams.get('search')
    const priority = searchParams.get('priority')
    const assignee = searchParams.get('assignee')
    const label = searchParams.get('label')
    const overdue = searchParams.get('overdue') === 'true'
    const parentId = searchParams.get('parentId')

    const where: Record<string, unknown> = {
      deletedAt: archived ? { not: null } : null,
    }
    if (parentId !== null) where.parentId = parentId || null
    else where.parentId = null // top-level tasks only by default
    if (search) where.title = { contains: search, mode: 'insensitive' }
    if (priority) where.priority = priority
    if (assignee) where.assignee = assignee
    if (label) where.label = label
    if (overdue) {
      where.dueDate = { lt: new Date() }
      where.status = { not: 'DONE' }
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { subtasks: true, comments: true } },
        subtasks: { where: { deletedAt: null }, select: { id: true, title: true, status: true } },
        tags: { include: { tag: true } },
      },
    })
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('GET /api/tasks error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description || null,
        status: body.status || 'BACKLOG',
        priority: body.priority || 'MEDIUM',
        assignee: body.assignee || 'BOTH',
        label: body.label || 'WORK',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        order: body.order || 0,
        parentId: body.parentId || null,
        recurrence: body.recurrence || 'NONE',
        recurrenceNextDue: body.recurrenceNextDue ? new Date(body.recurrenceNextDue) : null,
        source: body.source || null,
        sourceId: body.sourceId || null,
      },
      include: {
        _count: { select: { subtasks: true, comments: true } },
        subtasks: { where: { deletedAt: null }, select: { id: true, title: true, status: true } },
        tags: { include: { tag: true } },
      },
    })
    // Handle tags array
    if (body.tags?.length) {
      await prisma.taskTag.createMany({
        data: body.tags.map((tagId: string) => ({ taskId: task.id, tagId })),
        skipDuplicates: true,
      })
    }
    await createActivity(task.id, 'SYSTEM', 'created', { title: task.title })
    emitTaskEvent('created', task.id)
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('POST /api/tasks error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
