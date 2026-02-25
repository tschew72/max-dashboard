import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const activities = await prisma.taskActivity.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(activities)
  } catch (error) {
    console.error('GET /api/tasks/[id]/activity error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
