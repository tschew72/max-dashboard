import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

/** Fire openclaw cron run in the background — does NOT block the response */
function triggerAsync(id: string) {
  const child = spawn('openclaw', ['cron', 'run', id], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  triggerAsync(id)
  return NextResponse.json({ ok: true, jobId: id, message: 'Job triggered in background' })
}
