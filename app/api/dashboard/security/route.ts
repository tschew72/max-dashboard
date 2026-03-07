import { NextResponse } from 'next/server'
import fs from 'fs'
import pg from 'pg'

export const dynamic = 'force-dynamic'

const JOBS_FILE = '/root/.openclaw/cron/jobs.json'

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:IttpQGczrT91qrdUEHENGsYvpnRIN6aa@127.0.0.1:5433/ingestshield',
  max: 2,
})

interface SecurityAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  source: 'phishing' | 'promptdome' | 'cron'
  sourceLabel: string
  time: string
  timeMs: number
  detail?: string
  link?: string
}

export async function GET() {
  const alerts: SecurityAlert[] = []

  // 1. PromptDome blocks (last 24h)
  try {
    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT id, "createdAt", "textPreview", score, recommendation
         FROM "ShieldScan"
         WHERE recommendation = 'block' AND "createdAt" >= NOW() - INTERVAL '24 hours'
         ORDER BY "createdAt" DESC LIMIT 10`
      )
      for (const row of result.rows) {
        alerts.push({
          id: `pd-${row.id}`,
          severity: 'critical',
          title: `Prompt injection blocked (score: ${row.score})`,
          source: 'promptdome',
          sourceLabel: 'PromptDome',
          time: new Date(row.createdAt).toISOString(),
          timeMs: new Date(row.createdAt).getTime(),
          detail: row.textPreview?.substring(0, 80),
          link: '/shield',
        })
      }
    } finally {
      client.release()
    }
  } catch { /* PromptDome DB unavailable */ }

  // 2. Cron failures
  try {
    const jobsData = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'))
    for (const job of jobsData.jobs || []) {
      const ce = job.state?.consecutiveErrors || 0
      if (ce > 0) {
        const lastRunAt = job.state?.lastRunAtMs || Date.now()
        alerts.push({
          id: `cron-${job.id}`,
          severity: ce >= 3 ? 'critical' : 'warning',
          title: `${job.name}: ${ce} consecutive error${ce !== 1 ? 's' : ''}`,
          source: 'cron',
          sourceLabel: 'Cron Jobs',
          time: new Date(lastRunAt).toISOString(),
          timeMs: lastRunAt,
          detail: job.state?.lastError?.substring(0, 100),
          link: '/jobs',
        })
      }
    }
  } catch { /* jobs file unavailable */ }

  // Sort: critical first, then warning, then info; within same severity newest first
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => {
    const so = severityOrder[a.severity] - severityOrder[b.severity]
    if (so !== 0) return so
    return b.timeMs - a.timeMs
  })

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount = alerts.filter(a => a.severity === 'warning').length
  const infoCount = alerts.filter(a => a.severity === 'info').length

  return NextResponse.json({
    alerts,
    criticalCount,
    warningCount,
    infoCount,
  }, {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
  })
}
