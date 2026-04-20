import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { prisma } from '@/lib/db'
import { createActivity } from '@/lib/activity'
import { emitTaskEvent } from '@/lib/taskEvents'

const QUEUE_PATH = '/root/.openclaw/workspace/data/max-queue.json'
const DISCORD_CHANNEL = '1473965360364392480' // #general

function readQueue(): Record<string, unknown>[] {
  try {
    if (!existsSync(QUEUE_PATH)) return []
    return JSON.parse(readFileSync(QUEUE_PATH, 'utf8'))
  } catch { return [] }
}

function writeQueue(items: Record<string, unknown>[]) {
  try {
    const dir = QUEUE_PATH.split('/').slice(0, -1).join('/')
    execFileSync('mkdir', ['-p', dir])
    writeFileSync(QUEUE_PATH, JSON.stringify(items, null, 2))
  } catch { /* best-effort */ }
}

function formatTaskForMax(task: Record<string, unknown>, instructions?: string): string {
  const priority = task.priority as string
  const label = task.label as string
  const assignee = task.assignee as string
  const description = task.description as string | null
  const id = task.id as string
  const title = task.title as string
  const dueDate = task.dueDate as string | null

  const prioEmoji: Record<string, string> = { URGENT: '🚨', HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' }

  return [
    `⚡ **Task Assigned to Max**`,
    ``,
    `**${title}**`,
    `${prioEmoji[priority] ?? '🔵'} ${priority} · ${label}${assignee ? ` · Assignee: ${assignee}` : ''}`,
    dueDate ? `📅 Due: ${new Date(dueDate).toLocaleDateString('en-SG')}` : '',
    ``,
    description ? `📋 **Description:**\n${description.replace(/<[^>]*>/g, '').trim()}` : '',
    instructions ? `\n💬 **Instructions from Vince:**\n${instructions.trim()}` : '',
    ``,
    `🆔 Task ID: \`${id}\``,
    `🔗 dash.vincechew.me/tasks`,
  ].filter(l => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n')
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    // Read optional instructions from body
    let instructions: string | undefined
    try {
      const body = await req.json()
      instructions = body?.instructions?.trim() || undefined
    } catch { /* no body is fine */ }

    // Fetch task
    const task = await prisma.task.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    // Mark IN_PROGRESS (unless already DONE)
    const alreadyDone = task.status === 'DONE'
    if (!alreadyDone) {
      await prisma.task.update({
        where: { id },
        data: { status: 'IN_PROGRESS', assignee: 'MAX' },
      })
      emitTaskEvent('updated', id)
    }

    // Log activity (include instructions if provided)
    await createActivity(id, 'VINCE', 'assigned', {
      note: instructions ? `Asked Max via dashboard: "${instructions}"` : 'Asked Max via dashboard',
    })

    // Add to queue file (heartbeat fallback)
    const queue = readQueue()
    const alreadyQueued = queue.some((q) => q.taskId === id)
    if (!alreadyQueued) {
      queue.push({
        taskId: id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        label: task.label,
        instructions: instructions ?? null,
        queuedAt: new Date().toISOString(),
        status: 'pending',
      })
      writeQueue(queue)
    }

    // Send Discord message to Max — use execFileSync with explicit argv to prevent shell injection
    const message = formatTaskForMax(task as unknown as Record<string, unknown>, instructions)
    try {
      execFileSync(
        'openclaw',
        ['message', 'send', '--channel', 'discord', '--target', DISCORD_CHANNEL, '--message', message],
        { timeout: 10000 }
      )
    } catch (e) {
      console.error('Discord notify failed (non-fatal):', e)
    }

    return NextResponse.json({ ok: true, queued: !alreadyQueued })
  } catch (error) {
    console.error('ask-max error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
