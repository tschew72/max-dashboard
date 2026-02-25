import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { sessionId?: string }
    const { sessionId } = body
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }
    // Sanitize: only allow alphanumeric + hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(sessionId)) {
      return NextResponse.json({ error: 'invalid sessionId' }, { status: 400 })
    }
    execSync(`openclaw sessions kill ${sessionId}`, { timeout: 10000 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
