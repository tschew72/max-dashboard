import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'

const MENTIONS_FILE = '/root/.outlook-mcp/mention-state.json'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const raw = readFileSync(MENTIONS_FILE, 'utf8')
    const data = JSON.parse(raw)

    let mentions = Array.isArray(data) ? data : (data.mentions || data.items || [])

    mentions = mentions.map((m: Record<string, unknown>) => {
      if (m.id === id) {
        return {
          ...m,
          ...(body.response_status && { response_status: body.response_status }),
          ...(body.snooze_until && { snooze_until: body.snooze_until }),
        }
      }
      return m
    })

    const updated = Array.isArray(data) ? mentions : { ...data, mentions }
    writeFileSync(MENTIONS_FILE, JSON.stringify(updated, null, 2))

    return NextResponse.json({ ok: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update mention'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
