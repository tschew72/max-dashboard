import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000, encoding: 'utf8' }).toString()
  } catch {
    return ''
  }
}

function parseGatewayStatus(output: string) {
  const running = output.toLowerCase().includes('running')
  const pidMatch = output.match(/pid[:\s]+(\d+)/i) || output.match(/(\d+)/)
  return {
    status: running ? 'running' : 'stopped',
    pid: pidMatch ? parseInt(pidMatch[1]) : undefined,
  }
}

function parseMemory(output: string) {
  const lines = output.trim().split('\n')
  const memLine = lines.find(l => l.toLowerCase().startsWith('mem:'))
  if (!memLine) return { total: 0, used: 0, percent: 0 }
  const parts = memLine.trim().split(/\s+/)
  const total = parseInt(parts[1]) || 0
  const used = parseInt(parts[2]) || 0
  const percent = total > 0 ? Math.round((used / total) * 100) : 0
  return { total, used, percent }
}

function parseDisk(output: string) {
  const lines = output.trim().split('\n')
  const diskLine = lines[1]
  if (!diskLine) return { total: '0G', used: '0G', percent: 0 }
  const parts = diskLine.trim().split(/\s+/)
  // Filesystem, Size, Used, Avail, Use%, Mounted
  const total = parts[1] || '0G'
  const used = parts[2] || '0G'
  const percentStr = parts[4] || '0%'
  const percent = parseInt(percentStr.replace('%', '')) || 0
  return { total, used, percent }
}

function getOpenClawVersion(): { current: string; latest: string; upToDate: boolean } {
  const current = safeExec('openclaw --version').trim()
  const latest = safeExec('npm info openclaw version 2>/dev/null || pnpm info openclaw version 2>/dev/null').trim()
  const upToDate = !!current && !!latest && current === latest
  return { current: current || 'unknown', latest: latest || 'unknown', upToDate }
}

function getLastLearning(): string | null {
  try {
    const dir = '/root/.openclaw/workspace/01-MEMORY/daily'
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({ name: f, mtime: statSync(join(dir, f)).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    return files.length > 0 ? files[0].mtime.toISOString() : null
  } catch {
    return null
  }
}

function getJobsHealth() {
  try {
    const raw = readFileSync('/root/.openclaw/cron/jobs.json', 'utf8')
    const jobs = JSON.parse(raw)
    const jobList = Array.isArray(jobs) ? jobs : Object.values(jobs)
    const errors = jobList.filter((j: unknown) => (j as { errorCount?: number }).errorCount && (j as { errorCount: number }).errorCount > 0).length
    const disabled = jobList.filter((j: unknown) => !(j as { enabled?: boolean }).enabled).length
    return { total: jobList.length, errors, disabled }
  } catch {
    return { total: 0, errors: 0, disabled: 0 }
  }
}

export async function GET() {
  const gatewayOutput = safeExec('openclaw gateway status')
  const memOutput = safeExec('free -m')
  const diskOutput = safeExec('df -h /')

  const gateway = parseGatewayStatus(gatewayOutput)
  const memory = parseMemory(memOutput)
  const disk = parseDisk(diskOutput)
  const jobs = getJobsHealth()
  const lastLearning = getLastLearning()
  const openclaw = getOpenClawVersion()

  return NextResponse.json({ gateway, memory, disk, jobs, lastLearning, openclaw })
}
