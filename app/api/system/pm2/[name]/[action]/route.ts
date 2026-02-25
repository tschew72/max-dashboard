import { NextResponse } from 'next/server'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(execCb)

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string; action: string }> }
) {
  const { name, action } = await params

  if (!['restart', 'stop', 'start'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Sanitize name — allow alphanumeric, dash, underscore, dot
  if (!/^[\w.\-]+$/.test(name)) {
    return NextResponse.json({ error: 'Invalid process name' }, { status: 400 })
  }

  try {
    const { stdout, stderr } = await execAsync(`pm2 ${action} "${name}" 2>&1`)
    return NextResponse.json({ ok: true, output: stdout + stderr })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
