import { NextResponse } from 'next/server'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/lib/db'

const execAsync = promisify(execCb)

async function getO365Token(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('/root/.openclaw/workspace/skills/outlook/scripts/outlook-token.sh get', {
      timeout: 10000,
    })
    // Try to parse JSON output first
    try {
      const json = JSON.parse(stdout.trim())
      return json.access_token ?? json.token ?? null
    } catch {
      // Otherwise look for access_token pattern
      const match = stdout.match(/"access_token"\s*:\s*"([^"]+)"/)
      if (match) return match[1]
      // Last resort: if it's just a token string
      const trimmed = stdout.trim()
      if (trimmed.length > 50 && !trimmed.includes('\n') && !trimmed.includes(' ')) {
        return trimmed
      }
      return null
    }
  } catch (err) {
    console.error('Failed to get O365 token:', err)
    return null
  }
}

interface GraphEvent {
  id: string
  subject: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  location?: { displayName?: string }
  organizer?: { emailAddress?: { name?: string } }
  isAllDay: boolean
  bodyPreview?: string
  onlineMeeting?: { joinUrl?: string } | null
  webLink?: string
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

  // Default to current week (Mon–Sun)
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const startDate = startParam ? new Date(startParam) : monday
  const endDate = endParam ? new Date(endParam) : sunday

  const startISO = startDate.toISOString()
  const endISO = endDate.toISOString()

  // ── Fetch O365 events ────────────────────────────────────────────────────
  let events: object[] = []
  const token = await getO365Token()

  if (token) {
    try {
      const graphUrl = `https://graph.microsoft.com/v1.0/me/calendarView` +
        `?startDateTime=${encodeURIComponent(startISO)}` +
        `&endDateTime=${encodeURIComponent(endISO)}` +
        `&$orderby=start/dateTime` +
        `&$top=50` +
        `&$select=id,subject,start,end,location,organizer,isAllDay,bodyPreview,onlineMeeting,webLink`

      const res = await fetch(graphUrl, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        const data = await res.json()
        events = (data.value ?? []).map((e: GraphEvent) => {
          // Determine color category
          const subject = e.subject?.toLowerCase() ?? ''
          let category: 'work' | 'teams' | 'personal' = 'work'
          if (subject.includes('teams') || subject.includes('microsoft') || e.onlineMeeting) {
            category = 'teams'
          } else if (subject.includes('personal') || subject.includes('family') || subject.includes('holiday')) {
            category = 'personal'
          }

          return {
            id: e.id,
            title: e.subject,
            start: e.start.dateTime,
            end: e.end.dateTime,
            isAllDay: e.isAllDay,
            location: e.location?.displayName,
            organizer: e.organizer?.emailAddress?.name,
            category,
            joinUrl: e.onlineMeeting?.joinUrl,
            webLink: e.webLink,
            preview: e.bodyPreview?.slice(0, 200),
            source: 'o365',
          }
        })
      }
    } catch (err) {
      console.error('Graph API error:', err)
    }
  }

  // ── Fetch tasks with due dates this week ─────────────────────────────────
  let taskDue: object[] = []
  try {
    const tasks = await prisma.task.findMany({
      where: {
        dueDate: { gte: startDate, lte: endDate },
        deletedAt: null,
        status: { not: 'DONE' },
      },
      select: { id: true, title: true, dueDate: true, status: true, priority: true },
    })
    taskDue = tasks.map(t => ({
      id: `task-${t.id}`,
      title: t.title,
      dueDate: t.dueDate?.toISOString(),
      status: t.status,
      priority: t.priority,
      category: 'task',
      source: 'task',
    }))
  } catch { /* ignore */ }

  return NextResponse.json({
    events,
    tasks: taskDue,
    rangeStart: startISO,
    rangeEnd: endISO,
    tokenAvailable: !!token,
  })
}
