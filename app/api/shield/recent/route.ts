import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const scans = await prisma.shieldLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        textPreview: true,
        score: true,
        level: true,
        recommendation: true,
        charCount: true,
        durationMs: true,
        consumer: true,
      },
    })
    return NextResponse.json({ scans })
  } catch (err) {
    console.error('Shield recent scans error:', err)
    return NextResponse.json({ scans: [] })
  }
}
