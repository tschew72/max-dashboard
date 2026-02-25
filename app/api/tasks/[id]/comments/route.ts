import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(comments)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    if (!body.author || !body.body) {
      return NextResponse.json({ error: 'author and body required' }, { status: 400 })
    }
    const comment = await prisma.comment.create({
      data: { taskId: id, author: body.author, body: body.body },
    })
    await createActivity(id, body.author, 'comment_added', { preview: body.body.substring(0, 80) })
    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
