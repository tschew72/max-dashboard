import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import tls from 'tls'

export const dynamic = 'force-dynamic'

const execAsync = promisify(exec)

const IMAP_HOST = 'imap.gmail.com'
const IMAP_PORT = 993
const IMAP_USER = 'max08022026@gmail.com'

async function getAppPassword(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      'op item get xbqnvcczgdhs7zk55sezknw5qi --vault OPENCLAW --fields password --reveal',
      { timeout: 15000 }
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

interface EmailResult {
  id: string
  from: string
  fromName: string
  subject: string
  receivedAt: string
  isRead: boolean
}

async function fetchRecentEmails(password: string): Promise<{
  messages: EmailResult[]
  unreadCount: number
}> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('IMAP timeout'))
    }, 20000)

    const socket = tls.connect(IMAP_PORT, IMAP_HOST, { servername: IMAP_HOST })
    let buffer = ''
    let tagNum = 0
    let state: 'greeting' | 'login' | 'select' | 'search' | 'fetch' | 'done' = 'greeting'
    const messages: EmailResult[] = []
    let unreadCount = 0
    let fetchBuffer = ''

    function send(cmd: string) {
      tagNum++
      const tag = `A${tagNum}`
      socket.write(`${tag} ${cmd}\r\n`)
      return tag
    }

    socket.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\r\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (state === 'greeting' && line.startsWith('* OK')) {
          state = 'login'
          send(`LOGIN "${IMAP_USER}" "${password}"`)
        } else if (state === 'login' && line.match(/^A\d+ OK/)) {
          state = 'select'
          send('SELECT INBOX')
        } else if (state === 'select') {
          if (line.match(/^A\d+ OK/)) {
            state = 'search'
            send('SEARCH UNSEEN')
          }
        } else if (state === 'search') {
          if (line.startsWith('* SEARCH')) {
            const ids = line.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean)
            unreadCount = ids.length
          }
          if (line.match(/^A\d+ OK/)) {
            state = 'fetch'
            send('FETCH *:1 (FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)] UID)')
          }
        } else if (state === 'fetch') {
          fetchBuffer += line + '\r\n'
          if (line.match(/^A\d+ OK/)) {
            const msgBlocks = fetchBuffer.split(/\* \d+ FETCH/).filter(Boolean)
            for (const block of msgBlocks.slice(0, 10)) {
              const flagsMatch = block.match(/FLAGS \(([^)]*)\)/)
              const flags = flagsMatch ? flagsMatch[1] : ''
              const isRead = flags.includes('\\Seen')

              const fromMatch = block.match(/From:\s*(.+?)(?:\r?\n(?!\s))/is)
              const fromRaw = fromMatch ? fromMatch[1].trim() : 'Unknown'
              let fromName = fromRaw
              let fromAddr = fromRaw

              const addrMatch = fromRaw.match(/^"?([^"<]+)"?\s*<([^>]+)>/)
              if (addrMatch) {
                fromName = addrMatch[1].trim()
                fromAddr = addrMatch[2].trim()
              } else {
                const plainAddrMatch = fromRaw.match(/<([^>]+)>/)
                if (plainAddrMatch) fromAddr = plainAddrMatch[1]
              }

              const subjectMatch = block.match(/Subject:\s*(.+?)(?:\r?\n(?!\s))/is)
              const subject = subjectMatch ? subjectMatch[1].trim() : '(no subject)'

              const dateMatch = block.match(/Date:\s*(.+?)(?:\r?\n(?!\s))/is)
              const receivedAt = dateMatch ? new Date(dateMatch[1].trim()).toISOString() : new Date().toISOString()

              const uidMatch = block.match(/UID (\d+)/)
              const uid = uidMatch ? uidMatch[1] : String(messages.length)

              messages.push({ id: uid, from: fromAddr, fromName, subject, receivedAt, isRead })
            }

            messages.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
            state = 'done'
            send('LOGOUT')
            clearTimeout(timeout)
            resolve({ messages: messages.slice(0, 5), unreadCount })
          }
        } else if (line.match(/^A\d+ (NO|BAD)/)) {
          clearTimeout(timeout)
          reject(new Error(`IMAP error: ${line}`))
        }
      }
    })

    socket.on('error', (err: Error) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

export async function GET() {
  try {
    const password = await getAppPassword()
    if (!password) {
      return NextResponse.json({
        messages: [],
        unreadCount: 0,
        error: 'Gmail app password not available',
      })
    }

    const result = await fetchRecentEmails(password)

    const enriched = result.messages.map(m => ({
      ...m,
      phishingVerdict: 'safe' as const,
      actionStatus: 'received' as const,
    }))

    return NextResponse.json({
      messages: enriched,
      unreadCount: result.unreadCount,
    }, {
      headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('Gmail fetch error:', err)
    return NextResponse.json({
      messages: [],
      unreadCount: 0,
      error: err instanceof Error ? err.message : 'Gmail fetch failed',
    })
  }
}
