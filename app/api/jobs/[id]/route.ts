import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'

const JOBS_PATH = '/root/.openclaw/cron/jobs.json'

function readJobs() {
  const raw = readFileSync(JOBS_PATH, 'utf8')
  const data = JSON.parse(raw)
  const jobs: Record<string, unknown>[] = data?.jobs ?? (Array.isArray(data) ? data : Object.values(data))
  return { data, jobs }
}

function buildSchedule(body: Record<string, string>) {
  const { scheduleKind, every, cronExpr, at } = body
  if (scheduleKind === 'interval') {
    const match = every?.match(/^(\d+)(s|m|h|d)$/)
    if (!match) throw new Error('Invalid interval format')
    const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
    return { kind: 'every', everyMs: parseInt(match[1]) * units[match[2]], tz: 'Asia/Singapore' }
  }
  if (scheduleKind === 'cron') {
    return { kind: 'cron', expr: cronExpr, tz: 'Asia/Singapore' }
  }
  if (scheduleKind === 'once') {
    const ts = at?.startsWith('+')
      ? new Date(Date.now() + parseDuration(at.slice(1))).toISOString()
      : at
    return { kind: 'at', at: ts }
  }
  throw new Error('Invalid scheduleKind')
}

function parseDuration(s: string): number {
  const match = s.match(/^(\d+)(s|m|h|d)$/)
  if (!match) return 0
  const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
  return parseInt(match[1]) * units[match[2]]
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const { data, jobs } = readJobs()
    const job = jobs.find((j: Record<string, unknown>) => j.id === id)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    // Update fields
    if (body.name) job.name = body.name
    if (body.scheduleKind) job.schedule = buildSchedule(body)
    if (body.message !== undefined) {
      const payload = (job.payload || {}) as Record<string, unknown>
      payload.message = body.message
      job.payload = payload
    }
    if (body.sessionTarget) job.sessionTarget = body.sessionTarget
    if (body.announce !== undefined) {
      job.delivery = body.announce ? { mode: 'announce' } : { mode: 'none' }
    }
    if (body.enabled !== undefined) job.enabled = body.enabled

    writeFileSync(JOBS_PATH, JSON.stringify(data, null, 2))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const raw = readFileSync(JOBS_PATH, 'utf8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      const idx = data.findIndex((j: Record<string, unknown>) => j.id === id)
      if (idx === -1) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      data.splice(idx, 1)
    } else if (data.jobs) {
      const idx = data.jobs.findIndex((j: Record<string, unknown>) => j.id === id)
      if (idx === -1) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      data.jobs.splice(idx, 1)
    }
    writeFileSync(JOBS_PATH, JSON.stringify(data, null, 2))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
