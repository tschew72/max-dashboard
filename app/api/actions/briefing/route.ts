import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST() {
  try {
    const output = execSync('openclaw cron trigger briefing 2>&1', { timeout: 30000, encoding: 'utf8' })
    return NextResponse.json({ ok: true, output })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
