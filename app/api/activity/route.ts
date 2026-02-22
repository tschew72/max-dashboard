import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'

function classifyLine(line: string): { type: 'error' | 'cron' | 'learning' | 'info'; description: string } {
  const lower = line.toLowerCase()
  if (lower.includes('error') || lower.includes('err:') || lower.includes('failed') || lower.includes('exception')) {
    return { type: 'error', description: line.trim() }
  }
  if (lower.includes('cron') || lower.includes('job') || lower.includes('scheduled') || lower.includes('trigger')) {
    return { type: 'cron', description: line.trim() }
  }
  if (lower.includes('learning') || lower.includes('memory') || lower.includes('cycle') || lower.includes('training')) {
    return { type: 'learning', description: line.trim() }
  }
  return { type: 'info', description: line.trim() }
}

function parseTimestamp(line: string): string {
  // Try to extract ISO timestamp or similar
  const isoMatch = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/)
  if (isoMatch) return new Date(isoMatch[0]).toISOString()
  return new Date().toISOString()
}

export async function GET() {
  const events = []

  try {
    // Find latest log file
    let logContent = ''
    try {
      const files = execSync('ls -t /tmp/openclaw-0/*.log 2>/dev/null', { encoding: 'utf8' })
        .trim().split('\n').filter(Boolean)
      if (files.length > 0) {
        logContent = readFileSync(files[0], 'utf8')
      }
    } catch {
      // No log files
    }

    if (logContent) {
      const lines = logContent.split('\n')
        .filter(l => l.trim().length > 0)
        .slice(-100)

      for (const line of lines.reverse()) {
        const { type, description } = classifyLine(line)
        events.push({
          id: randomUUID(),
          type,
          description,
          timestamp: parseTimestamp(line),
          raw: line,
        })
      }
    }
  } catch (e) {
    console.error('Activity route error:', e)
  }

  return NextResponse.json(events)
}
