import { NextResponse } from 'next/server'
import { pdQuery, PD_CUSTOMER_ID } from '@/lib/pd-db'
import { getCached, setCached } from '@/lib/cache'

export const dynamic = 'force-dynamic'

const CACHE_KEY = `shield_stats_${PD_CUSTOMER_ID}`
const CACHE_TTL = 30_000  // 30s — stats don't need to be real-time

export async function GET() {
  const cached = getCached(CACHE_KEY)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT', 'Cache-Control': 'max-age=30, stale-while-revalidate=60' } })
  }
  const cid = PD_CUSTOMER_ID
  // Exclude manual/test scans from statistics — only count real production traffic
  const EXCL = `AND (source IS NULL OR source NOT IN ('manual', 'test', 'playground'))`

  const [
    totalRes, todayRes, weekRes,
    distRes,
    evasionRes, avgScoreRes,
    dailyRes, topCatRes, sourceRes, latencyRes,
  ] = await Promise.all([
    pdQuery<{ count: string }>(`SELECT COUNT(*) as count FROM "ShieldScan" WHERE "customerId"=$1 ${EXCL}`, [cid]),
    pdQuery<{ count: string }>(`SELECT COUNT(*) as count FROM "ShieldScan" WHERE "customerId"=$1 AND "createdAt" >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Singapore') ${EXCL}`, [cid]),
    pdQuery<{ count: string }>(`SELECT COUNT(*) as count FROM "ShieldScan" WHERE "customerId"=$1 AND "createdAt" >= NOW() - INTERVAL '7 days' ${EXCL}`, [cid]),
    pdQuery<{ allow: string; warn: string; block: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE recommendation='allow') AS allow,
        COUNT(*) FILTER (WHERE recommendation='warn')  AS warn,
        COUNT(*) FILTER (WHERE recommendation='block') AS block
      FROM "ShieldScan" WHERE "customerId"=$1 ${EXCL}
    `, [cid]),
    pdQuery<{ count: string }>(`SELECT COUNT(*) as count FROM "ShieldScan" WHERE "customerId"=$1 AND "evasionDetected"=true ${EXCL}`, [cid]),
    pdQuery<{ avg: string }>(`SELECT AVG(score) as avg FROM "ShieldScan" WHERE "customerId"=$1 ${EXCL}`, [cid]),
    pdQuery<{ date: string; allow: string; warn: string; block: string }>(`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "createdAt" AT TIME ZONE 'Asia/Singapore'), 'YYYY-MM-DD') AS date,
        COUNT(*) FILTER (WHERE recommendation='allow') AS allow,
        COUNT(*) FILTER (WHERE recommendation='warn')  AS warn,
        COUNT(*) FILTER (WHERE recommendation='block') AS block
      FROM "ShieldScan"
      WHERE "customerId"=$1 AND "createdAt" >= NOW() - INTERVAL '14 days' ${EXCL}
      GROUP BY 1 ORDER BY 1
    `, [cid]),
    pdQuery<{ category: string; count: string }>(`
      SELECT finding->>'category' AS category, COUNT(*) AS count
      FROM "ShieldScan", jsonb_array_elements("findingsJson"::jsonb) AS finding
      WHERE "customerId"=$1 AND "createdAt" >= NOW() - INTERVAL '30 days'
        AND recommendation IN ('warn','block') ${EXCL}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 12
    `, [cid]),
    pdQuery<{ source: string | null; count: string }>(`
      SELECT COALESCE(source, 'mcp') AS source, COUNT(*) AS count
      FROM "ShieldScan" WHERE "customerId"=$1 ${EXCL}
      GROUP BY 1 ORDER BY 2 DESC
    `, [cid]),
    pdQuery<{ p50: number; p95: number; avg_ms: number }>(`
      SELECT
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "durationMs") AS p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95,
        AVG("durationMs") AS avg_ms
      FROM (
        SELECT "durationMs" FROM "ShieldScan"
        WHERE "customerId"=$1 AND "durationMs" IS NOT NULL ${EXCL}
        ORDER BY "createdAt" DESC LIMIT 1000
      ) sub
    `, [cid]),
  ])

  const total     = parseInt(totalRes[0]?.count ?? '0', 10)
  const dist      = distRes[0] ?? { allow: '0', warn: '0', block: '0' }
  const allow     = parseInt(dist.allow, 10)
  const warn      = parseInt(dist.warn,  10)
  const block     = parseInt(dist.block, 10)
  const latency   = latencyRes[0]

  const result = {
    total,
    today:  parseInt(todayRes[0]?.count ?? '0', 10),
    week:   parseInt(weekRes[0]?.count  ?? '0', 10),
    distribution: {
      allow, warn, block,
      allowPct: total > 0 ? Math.round((allow / total) * 100) : 0,
      warnPct:  total > 0 ? Math.round((warn  / total) * 100) : 0,
      blockPct: total > 0 ? Math.round((block / total) * 100) : 0,
    },
    evasionCount: parseInt(evasionRes[0]?.count ?? '0', 10),
    avgScore:     Math.round(parseFloat(avgScoreRes[0]?.avg ?? '0')),
    daily: dailyRes.map(r => ({
      date: r.date,
      allow: parseInt(r.allow, 10), warn: parseInt(r.warn, 10), block: parseInt(r.block, 10),
      total: parseInt(r.allow, 10) + parseInt(r.warn, 10) + parseInt(r.block, 10),
    })),
    topCategories: topCatRes.map(r => ({ category: r.category, count: parseInt(r.count, 10) })),
    consumers: sourceRes.map(r => ({ consumer: r.source ?? 'mcp', count: parseInt(r.count, 10) })),
    latency: {
      p50: Math.round(Number(latency?.p50  ?? 0)),
      p95: Math.round(Number(latency?.p95  ?? 0)),
      avg: Math.round(Number(latency?.avg_ms ?? 0)),
    },
  }
  setCached(CACHE_KEY, result, CACHE_TTL)
  return NextResponse.json(result, { headers: { 'X-Cache': 'MISS', 'Cache-Control': 'max-age=30, stale-while-revalidate=60' } })
}
