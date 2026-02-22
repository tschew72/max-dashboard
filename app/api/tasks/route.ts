import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: [{ status: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }],
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
      },
    })
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('POST /api/tasks error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
