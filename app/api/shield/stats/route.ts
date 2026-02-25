import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7)
  const day30Start = new Date(now); day30Start.setDate(now.getDate() - 30)

  const [
    total,
    todayTotal,
    weekTotal,
    allowCount,
    warnCount,
    blockCount,
    evasionCount,
    avgScoreRaw,
    // Daily counts for last 14 days
    dailyRaw,
    // Top categories from last 30 days (WARN+BLOCK only)
    topCategoryScans,
    // Consumer breakdown
    consumerRaw,
    // p50/p95 latency (last 1000 scans)
    latencyRaw,
  ] = await Promise.all([
    prisma.shieldLog.count(),
    prisma.shieldLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.shieldLog.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.shieldLog.count({ where: { recommendation: 'allow' } }),
    prisma.shieldLog.count({ where: { recommendation: 'warn' } }),
    prisma.shieldLog.count({ where: { recommendation: 'block' } }),
    prisma.shieldLog.count({ where: { evasionDetected: true } }),
    prisma.shieldLog.aggregate({ _avg: { score: true } }),
    // Raw daily counts: use a group-by on date truncation via raw SQL
    prisma.$queryRaw<{ date: string; allow: bigint; warn: bigint; block: bigint }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "createdAt" AT TIME ZONE 'Asia/Singapore'), 'YYYY-MM-DD') AS date,
        COUNT(*) FILTER (WHERE recommendation = 'allow') AS allow,
        COUNT(*) FILTER (WHERE recommendation = 'warn')  AS warn,
        COUNT(*) FILTER (WHERE recommendation = 'block') AS block
      FROM "ShieldLog"
      WHERE "createdAt" >= NOW() - INTERVAL '14 days'
      GROUP BY 1
      ORDER BY 1
    `,
    // Top triggered categories
    prisma.$queryRaw<{ category: string; count: bigint }[]>`
      SELECT
        finding->>'category' AS category,
        COUNT(*) AS count
      FROM "ShieldLog",
           jsonb_array_elements("findingsJson"::jsonb) AS finding
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        AND recommendation IN ('warn', 'block')
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 12
    `,
    // Consumer breakdown
    prisma.shieldLog.groupBy({
      by: ['consumer'],
      _count: { consumer: true },
      orderBy: { _count: { consumer: 'desc' } },
    }),
    // Latency stats
    prisma.$queryRaw<{ p50: number; p95: number; avg_ms: number }[]>`
      SELECT
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "durationMs") AS p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs") AS p95,
        AVG("durationMs") AS avg_ms
      FROM (
        SELECT "durationMs" FROM "ShieldLog"
        WHERE "durationMs" IS NOT NULL
        ORDER BY "createdAt" DESC
        LIMIT 1000
      ) sub
    `,
  ])

  const daily = (dailyRaw as { date: string; allow: bigint; warn: bigint; block: bigint }[]).map(r => ({
    date:  r.date,
    allow: Number(r.allow),
    warn:  Number(r.warn),
    block: Number(r.block),
    total: Number(r.allow) + Number(r.warn) + Number(r.block),
  }))

  const topCategories = (topCategoryScans as { category: string; count: bigint }[]).map(r => ({
    category: r.category,
    count: Number(r.count),
  }))

  const consumers = consumerRaw.map(r => ({
    consumer: r.consumer,
    count: r._count.consumer,
  }))

  const latency = latencyRaw[0]

  return NextResponse.json({
    total,
    today: todayTotal,
    week:  weekTotal,
    distribution: {
      allow: allowCount,
      warn:  warnCount,
      block: blockCount,
      allowPct: total > 0 ? Math.round((allowCount / total) * 100) : 0,
      warnPct:  total > 0 ? Math.round((warnCount  / total) * 100) : 0,
      blockPct: total > 0 ? Math.round((blockCount / total) * 100) : 0,
    },
    evasionCount,
    avgScore:    Math.round(avgScoreRaw._avg.score ?? 0),
    daily,
    topCategories,
    consumers,
    latency: {
      p50:  Math.round(Number(latency?.p50  ?? 0)),
      p95:  Math.round(Number(latency?.p95  ?? 0)),
      avg:  Math.round(Number(latency?.avg_ms ?? 0)),
    },
  })
}
