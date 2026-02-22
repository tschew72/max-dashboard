import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const output = execSync(`openclaw cron trigger ${id}`, {
      timeout: 10000,
      encoding: 'utf8',
    })
    return NextResponse.json({ ok: true, output })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Trigger failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
