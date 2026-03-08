import { NextResponse } from 'next/server'
import { pdQuery, PD_CUSTOMER_ID } from '@/lib/pd-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const scans = await pdQuery<{
      id: string; createdAt: Date; textPreview: string; score: number;
      level: string; recommendation: string; charCount: number;
      durationMs: number | null; source: string | null;
    }>(`
      SELECT id, "createdAt", "textPreview", score, level, recommendation,
             "charCount", "durationMs", source
      FROM "ShieldScan"
      WHERE "customerId" = $1
        AND (source IS NULL OR source NOT IN ('manual', 'test', 'playground'))
      ORDER BY "createdAt" DESC
      LIMIT 10
    `, [PD_CUSTOMER_ID])

    // Map source → consumer label for UI compatibility
    const mapped = scans.map(s => ({
      ...s,
      consumer: s.source ?? 'mcp',
    }))

    return NextResponse.json({ scans: mapped }, { headers: { "Cache-Control": "max-age=15, stale-while-revalidate=30" } })
  } catch (err) {
    console.error('Shield recent scans error:', err)
    return NextResponse.json({ scans: [] })
  }
}
