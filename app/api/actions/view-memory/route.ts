import { NextResponse } from 'next/server'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export async function POST() {
  try {
    const dir = '/root/.openclaw/workspace/01-MEMORY/daily'
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 3)

    const memories = files.map(f => ({
      file: f,
      content: readFileSync(join(dir, f), 'utf8').slice(0, 500),
    }))

    return NextResponse.json({ ok: true, memories })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
