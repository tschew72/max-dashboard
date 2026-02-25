import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(tags)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { name, color } = await req.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const tag = await prisma.tag.create({ data: { name, color: color || '#626f86' } })
    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
