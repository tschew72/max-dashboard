import { NextResponse } from 'next/server'
import fs from 'fs'

const LOG_MAP: Record<string, string> = {
  'git-sync': '/var/log/git-sync.log',
  'disk-monitor': '/var/log/disk-monitor.log',
  'security-audit': '/var/log/security-audit.log',
  'openclaw-update': '/var/log/openclaw-update.log',
  'email-monitor': '/var/log/email-unread-monitor.log',
  'eod-digest': '/var/log/eod-digest.log',
  'calendar-brief': '/var/log/morning-calendar-brief.log',
  'readwise-cleanup': '/var/log/readwise-cleanup.log',
  'cve-scan': '/var/log/cve-scan.log',
  'o365-health': '/var/log/o365-health-check.log',
  'file-size': '/var/log/file-size-monitor.log',
  'metadata-healer': '/var/log/metadata-healer.log',
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const fileKey = url.searchParams.get('file') || ''
  const lines = Math.min(parseInt(url.searchParams.get('lines') || '50'), 500)

  const filePath = LOG_MAP[fileKey]
  if (!filePath) {
    return NextResponse.json(
      { error: `Unknown log file. Valid keys: ${Object.keys(LOG_MAP).join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const allLines = content.split('\n').filter(Boolean)
    const totalLines = allLines.length
    const lastLines = allLines.slice(-lines)
    return NextResponse.json({ file: fileKey, lines: lastLines, totalLines })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ file: fileKey, lines: [], totalLines: 0, error: msg })
  }
}


