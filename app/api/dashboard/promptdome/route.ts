import { NextResponse } from 'next/server'
import pg from 'pg'

export const dynamic = 'force-dynamic'

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:IttpQGczrT91qrdUEHENGsYvpnRIN6aa@127.0.0.1:5433/ingestshield',
  max: 3,
})

export async function GET() {
  const client = await pool.connect()
  try {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)

    const [todayRes, distRes, catRes, recentRes, customerRes] = await Promise.all([
      client.query(
        `SELECT COUNT(*) as total FROM "ShieldScan" WHERE "createdAt" >= $1`,
        [todayStart]
      ),
      client.query(
        `SELECT recommendation, COUNT(*) as count FROM "ShieldScan" WHERE "createdAt" >= $1 GROUP BY recommendation`,
        [todayStart]
      ),
      client.query(
        `SELECT finding->>'category' as category, COUNT(*) as count
         FROM "ShieldScan", jsonb_array_elements("findingsJson"::jsonb) AS finding
         WHERE "createdAt" >= $1 AND recommendation IN ('warn', 'block')
         GROUP BY 1 ORDER BY 2 DESC LIMIT 3`,
        [weekStart]
      ),
      client.query(
        `SELECT id, "createdAt", recommendation, "textPreview", score
         FROM "ShieldScan" ORDER BY "createdAt" DESC LIMIT 5`
      ),
      client.query(`SELECT COUNT(DISTINCT "customerId") as count FROM "ShieldScan"`),
    ])

    const todayTotal = parseInt(todayRes.rows[0]?.total || '0')
    const dist: Record<string, number> = {}
    for (const row of distRes.rows) {
      dist[row.recommendation] = parseInt(row.count)
    }

    return NextResponse.json({
      todayTotal,
      blockCount: dist['block'] || 0,
      warnCount: dist['warn'] || 0,
      allowCount: dist['allow'] || 0,
      topCategories: catRes.rows.map((r: { category: string; count: string }) => ({
        category: r.category,
        count: parseInt(r.count),
      })),
      recentScans: recentRes.rows.map((r: { id: string; createdAt: Date; recommendation: string; textPreview: string; score: number }) => ({
        id: r.id,
        createdAt: r.createdAt,
        recommendation: r.recommendation,
        textPreview: r.textPreview?.substring(0, 80) || '',
        score: r.score,
      })),
      customerCount: parseInt(customerRes.rows[0]?.count || '0'),
    }, {
      headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('PromptDome stats error:', err)
    return NextResponse.json({
      todayTotal: 0, blockCount: 0, warnCount: 0, allowCount: 0,
      topCategories: [], recentScans: [], customerCount: 0, error: 'PromptDome offline',
    }, { status: 200 })
  } finally {
    client.release()
  }
}
