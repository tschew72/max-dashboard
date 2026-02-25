import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { tagId } = await req.json()
    if (!tagId) return NextResponse.json({ error: 'tagId required' }, { status: 400 })
    await prisma.taskTag.create({ data: { taskId: id, tagId } })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { tagId } = await req.json()
    if (!tagId) return NextResponse.json({ error: 'tagId required' }, { status: 400 })
    await prisma.taskTag.delete({ where: { taskId_tagId: { taskId: id, tagId } } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 })
  }
}
