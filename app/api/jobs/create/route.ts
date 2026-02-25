import { NextResponse } from 'next/server'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(execCb)

interface CreateJobBody {
  name: string
  scheduleKind: 'interval' | 'cron' | 'once'
  every?: string           // e.g. "10m", "1h"
  cronExpr?: string        // e.g. "0 9 * * 1-5"
  at?: string              // e.g. "+20m", ISO datetime
  payloadKind: 'agentTurn' | 'systemEvent'
  message: string
  announce: boolean
  sessionTarget: 'isolated' | 'main'
  description?: string
}

function sanitize(s: string): string {
  // Remove shell-dangerous characters
  return s.replace(/[`$\\|&;<>(){}[\]!]/g, '')
}

export async function POST(req: Request) {
  let body: CreateJobBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'Message/payload is required' }, { status: 400 })
  }

  const args: string[] = ['openclaw', 'cron', 'add']

  // Name
  args.push('--name', sanitize(body.name.trim()))

  // Schedule
  if (body.scheduleKind === 'interval') {
    if (!body.every?.trim()) return NextResponse.json({ error: 'Interval "every" is required' }, { status: 400 })
    args.push('--every', sanitize(body.every.trim()))
  } else if (body.scheduleKind === 'cron') {
    if (!body.cronExpr?.trim()) return NextResponse.json({ error: 'Cron expression is required' }, { status: 400 })
    args.push('--cron', sanitize(body.cronExpr.trim()))
  } else if (body.scheduleKind === 'once') {
    if (!body.at?.trim()) return NextResponse.json({ error: 'Time is required for one-shot jobs' }, { status: 400 })
    args.push('--at', sanitize(body.at.trim()))
    args.push('--delete-after-run')
  }

  // Payload
  if (body.payloadKind === 'agentTurn') {
    args.push('--message', sanitize(body.message.trim()))
    args.push('--session', body.sessionTarget === 'main' ? 'main' : 'isolated')
  } else {
    args.push('--system-event', sanitize(body.message.trim()))
  }

  // Delivery
  if (body.announce) {
    args.push('--announce')
  }

  // Description
  if (body.description?.trim()) {
    args.push('--description', sanitize(body.description.trim()))
  }

  // JSON output for parsing job ID
  args.push('--json')

  const cmd = args.map(a => (a.startsWith('--') ? a : `"${a}"`)).join(' ')

  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 })
    const output = stdout.trim() || stderr.trim()

    try {
      const json = JSON.parse(output)
      return NextResponse.json({ ok: true, jobId: json.id ?? json.jobId ?? null, raw: json })
    } catch {
      return NextResponse.json({ ok: true, jobId: null, output })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
