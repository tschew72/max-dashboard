import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface SpawnBody {
  agentId: string
  task: string
  model?: string
  timeoutSeconds?: number
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SpawnBody

    if (!body.agentId || !body.task) {
      return NextResponse.json(
        { error: 'agentId and task are required' },
        { status: 400 }
      )
    }

    const openclawUrl = 'http://localhost:8787/api/spawn'
    try {
      const res = await fetch(openclawUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: body.agentId,
          task: body.task,
          model: body.model || undefined,
          timeoutSeconds: body.timeoutSeconds || 300,
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ ok: true, ...data })
      }

      const text = await res.text().catch(() => '')
      return NextResponse.json(
        { error: `OpenClaw API returned ${res.status}`, detail: text },
        { status: res.status }
      )
    } catch {
      return NextResponse.json(
        {
          error: 'OpenClaw API unavailable',
          detail: 'Could not reach the local OpenClaw gateway at localhost:8787. Ensure the gateway is running.',
        },
        { status: 501 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
