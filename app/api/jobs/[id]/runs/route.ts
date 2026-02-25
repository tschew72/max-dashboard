import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const RUNS_DIR = '/root/.openclaw/cron/runs'

interface RunEntry {
  ts: number
  jobId: string
  action: string
  status: 'ok' | 'error' | 'running'
  error?: string
  summary?: string
  delivered?: boolean
  deliveryStatus?: string
  runAtMs?: number
  durationMs?: number
  nextRunAtMs?: number
  model?: string
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number }
  sessionId?: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10')

  // Security: only allow alphanumeric + hyphens in job ID
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const filePath = path.join(RUNS_DIR, `${id}.jsonl`)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ runs: [] })
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    const runs: RunEntry[] = []
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as RunEntry
        // Only include 'finished' or 'started' actions
        if (entry.action === 'finished' || entry.action === 'started') {
          runs.push(entry)
        }
      } catch {}
    }

    // Return last N, newest first
    const recent = runs.reverse().slice(0, limit)

    return NextResponse.json({ runs: recent })
  } catch {
    return NextResponse.json({ runs: [] })
  }
}
