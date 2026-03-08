import { NextRequest, NextResponse } from 'next/server'
import { pdQuery, PD_CUSTOMER_ID } from '@/lib/pd-db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const filter = searchParams.get('filter') ?? 'flagged'   // 'flagged' | 'all'
  const src    = searchParams.get('src') ?? 'all'           // 'all' | 'general' | 'research'
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '25', 10))
  const skip   = (page - 1) * limit

  // Build WHERE clauses
  const conditions: string[] = [`s."customerId" = $1`]
  const params: unknown[] = [PD_CUSTOMER_ID]

  if (filter === 'flagged') {
    params.push(['warn', 'block'])
    conditions.push(`s.recommendation = ANY($${params.length})`)
  }

  if (src === 'general') {
    conditions.push(`s.source IS NULL`)
  } else if (src === 'research') {
    params.push(['web:research', 'web_search'])
    conditions.push(`s.source = ANY($${params.length})`)
  }

  const whereClause = conditions.join(' AND ')

  const [logs, countResult] = await Promise.all([
    pdQuery<{
      id: string; requestId: string; createdAt: Date; source: string | null;
      textPreview: string; score: number; level: string; recommendation: string;
      findingsJson: string; processingNotes: string[]; evasionDetected: boolean;
      charCount: number; engineVersion: string; durationMs: number | null; mode: string | null;
      keyPrefix: string; keyLabel: string;
    }>(`
      SELECT
        s.id, s."requestId", s."createdAt", s.source,
        s."textPreview", s.score, s.level, s.recommendation,
        s."findingsJson", s."processingNotes", s."evasionDetected",
        s."charCount", s."engineVersion", s."durationMs", s.mode,
        k."keyPrefix", k.label AS "keyLabel"
      FROM "ShieldScan" s
      JOIN "ApiKey" k ON k.id = s."apiKeyId"
      WHERE ${whereClause}
      ORDER BY s."createdAt" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, skip]),
    pdQuery<{ count: string }>(`
      SELECT COUNT(*) as count FROM "ShieldScan" s
      WHERE ${whereClause}
    `, params),
  ])

  const total = parseInt(countResult[0]?.count ?? '0', 10)
  const enriched = logs.map(log => {
    let findings: unknown[] = []
    try { findings = JSON.parse(log.findingsJson) } catch {}
    return { ...log, findings, findingsJson: undefined }
  })

  return NextResponse.json({ logs: enriched, total, page, pages: Math.ceil(total / limit) })
}
