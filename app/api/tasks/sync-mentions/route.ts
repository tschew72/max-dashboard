import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import fs from 'fs'

const MENTION_STATE_PATHS = [
  '/root/.outlook-mcp/mention-state.json',
  '/root/.home/.outlook-mcp/mention-state.json',
]

function readMentionState(): Record<string, any> {
  for (const p of MENTION_STATE_PATHS) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'))
      }
    } catch { /* skip */ }
  }
  return {}
}

export async function POST() {
  try {
    const state = readMentionState()
    const mentions = state.mentions_tracking || {}

    let created = 0
    let skipped = 0
    let markedDone = 0

    for (const [id, mention] of Object.entries(mentions) as [string, any][]) {
      const existing = await prisma.task.findFirst({ where: { sourceId: id } })

      if (mention.response_status === 'done' || mention.response_status === 'resolved') {
        // If we have a task for this mention and it's not done yet, mark it done
        if (existing && existing.status !== 'DONE') {
          await prisma.task.update({
            where: { id: existing.id },
            data: { status: 'DONE', completedAt: new Date() }
          })
          markedDone++
        }
        continue
      }

      if (mention.response_status !== 'pending') {
        skipped++
        continue
      }

      // Check if snoozed
      if (mention.snooze_until) {
        try {
          const snoozeTime = new Date(mention.snooze_until)
          if (new Date() < snoozeTime) { skipped++; continue }
        } catch { /* skip */ }
      }

      if (existing) {
        skipped++
        continue
      }

      // Create new task from mention
      const sender = mention.sender || 'Unknown'
      const chat = mention.chat_topic || 'Teams'
      const text = mention.text || ''
      const truncated = text.length > 80 ? text.slice(0, 80) + '…' : text

      await prisma.task.create({
        data: {
          title: `Reply to ${sender} — ${chat}`,
          description: truncated || undefined,
          status: 'BACKLOG',
          priority: 'HIGH',
          assignee: 'VINCE',
          label: 'REMINDER',
          source: 'TEAMS',
          sourceId: id,
          order: 0,
        }
      })
      created++
    }

    return NextResponse.json({ ok: true, created, skipped, markedDone })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
