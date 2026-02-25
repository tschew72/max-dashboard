import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { cid } = await params
  try {
    const { body } = await req.json()
    const comment = await prisma.comment.update({ where: { id: cid }, data: { body } })
    return NextResponse.json(comment)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { cid } = await params
  try {
    await prisma.comment.delete({ where: { id: cid } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
