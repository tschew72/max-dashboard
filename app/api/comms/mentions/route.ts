import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'

export async function GET() {
  try {
    const raw = readFileSync('/root/.outlook-mcp/mention-state.json', 'utf8')
    const data = JSON.parse(raw)

    const mentions = Array.isArray(data) ? data : (data.mentions || data.items || [])

    // Filter pending (not resolved, not snoozed)
    const now = new Date()
    const pending = mentions.filter((m: Record<string, unknown>) => {
      if (m.response_status === 'resolved') return false
      if (m.snooze_until && new Date(m.snooze_until as string) > now) return false
      return true
    })

    return NextResponse.json(pending)
  } catch {
    // File doesn't exist or parse error
    return NextResponse.json([])
  }
}
