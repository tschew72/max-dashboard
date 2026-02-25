import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const filter = searchParams.get('filter') ?? 'flagged'   // 'flagged' | 'all'
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '25', 10))
  const skip   = (page - 1) * limit

  const where =
    filter === 'flagged'
      ? { recommendation: { in: ['warn', 'block'] } }
      : {}

  const [logs, total] = await Promise.all([
    prisma.shieldLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id:              true,
        createdAt:       true,
        source:          true,
        consumer:        true,
        textPreview:     true,
        score:           true,
        level:           true,
        recommendation:  true,
        findingsJson:    true,
        processingNotes: true,
        evasionDetected: true,
        charCount:       true,
        engineVersion:   true,
        durationMs:      true,
      },
    }),
    prisma.shieldLog.count({ where }),
  ])

  // Parse findingsJson back to array, add matched excerpts
  const enriched = logs.map(log => {
    let findings: unknown[] = []
    try { findings = JSON.parse(log.findingsJson) } catch {}
    return { ...log, findings, findingsJson: undefined }
  })

  return NextResponse.json({
    logs: enriched,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}
