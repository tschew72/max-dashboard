import { NextResponse } from 'next/server'
import fs from 'fs'

const SESSIONS_FILE = '/root/.openclaw/agents/main/sessions/sessions.json'

interface MessageEntry {
  type: string
  id: string
  timestamp: string
  message?: {
    role: string
    content: Array<{
      type: string
      text?: string
      thinking?: string
      name?: string
      arguments?: unknown
      toolCallId?: string
      toolName?: string
      content?: Array<{ type: string; text?: string }>
    }>
  }
}

type MsgContent = NonNullable<MessageEntry['message']>['content']

function extractText(content: MsgContent | undefined): string {
  if (!content) return ''
  return content
    .map((c: MsgContent[number]) => {
      if (c.type === 'text') return c.text || ''
      if (c.type === 'thinking') return `[thinking: ${(c.thinking || '').slice(0, 100)}...]`
      if (c.type === 'toolCall') return `[tool: ${c.name}(${JSON.stringify(c.arguments || {}).slice(0, 80)})]`
      if (c.type === 'toolResult') {
        const inner = (c.content || []).map((x: { text?: string }) => x.text || '').join('').slice(0, 200)
        return `[result: ${inner}]`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function getSessionFile(sessionKey: string): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'))
    const sess = data[sessionKey]
    if (!sess) return null
    return sess.sessionFile || null
  } catch { return null }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const sessionKey = url.searchParams.get('sessionKey')
  if (!sessionKey) return NextResponse.json({ error: 'sessionKey required' }, { status: 400 })

  const sessionFile = getSessionFile(sessionKey)
  if (!sessionFile) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  let lines: string[]
  try {
    lines = fs.readFileSync(sessionFile, 'utf-8').split('\n').filter(Boolean)
  } catch {
    return NextResponse.json({ error: 'Session file not readable' }, { status: 500 })
  }

  // Parse messages
  const messages: Array<{
    id: string
    role: string
    timestamp: string
    text: string
    toolCalls: string[]
  }> = []

  for (const line of lines) {
    try {
      const entry: MessageEntry = JSON.parse(line)
      if (entry.type !== 'message' || !entry.message) continue
      const { role, content } = entry.message

      const toolCalls = (content || [])
        .filter(c => c.type === 'toolCall')
        .map(c => `${c.name}(${JSON.stringify(c.arguments || {}).slice(0, 60)})`)

      const textParts = (content || [])
        .filter(c => c.type === 'text')
        .map(c => c.text || '')
        .join('\n')
        .trim()

      messages.push({
        id: entry.id,
        role,
        timestamp: entry.timestamp,
        text: textParts.slice(0, 500),
        toolCalls,
      })
    } catch { /* skip */ }
  }

  // Summary
  const firstUser = messages.find(m => m.role === 'user')
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  const allToolCalls = messages.flatMap(m => m.toolCalls)
  const toolFreq: Record<string, number> = {}
  for (const t of allToolCalls) {
    const name = t.split('(')[0]
    toolFreq[name] = (toolFreq[name] || 0) + 1
  }
  const toolSummary = Object.entries(toolFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  return NextResponse.json({
    sessionKey,
    sessionFile,
    totalMessages: messages.length,
    firstUserMessage: firstUser?.text?.slice(0, 800) || null,
    lastAssistantMessage: lastAssistant?.text?.slice(0, 800) || null,
    toolSummary,
    recentMessages: messages.slice(-8).map(m => ({
      role: m.role,
      timestamp: m.timestamp,
      text: m.text.slice(0, 300),
      toolCalls: m.toolCalls.slice(0, 3),
    })),
  })
}
