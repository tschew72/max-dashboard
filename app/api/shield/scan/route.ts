import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text: string }

    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const promptdomeUrl = 'https://promptdome.cyberforge.one/api/v1/scan'
    try {
      const res = await fetch(promptdomeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body.text }),
        signal: AbortSignal.timeout(15000),
      })

      if (res.ok) {
        const data = await res.json()
        return NextResponse.json(data)
      }

      return NextResponse.json(
        { error: `PromptDome returned ${res.status}` },
        { status: res.status }
      )
    } catch {
      return NextResponse.json(
        { error: 'PromptDome unavailable. Check if the service is running.' },
        { status: 502 }
      )
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
