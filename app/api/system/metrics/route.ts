import { NextResponse } from 'next/server'
import fs from 'fs'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

let prevCpu: { idle: number; total: number } | null = null
let prevCpuTime = 0

function parseProcStat(): { idle: number; total: number } | null {
  try {
    const stat = fs.readFileSync('/proc/stat', 'utf-8')
    const line = stat.split('\n').find(l => l.startsWith('cpu '))
    if (!line) return null
    const parts = line.trim().split(/\s+/).slice(1).map(Number)
    // user nice system idle iowait irq softirq steal
    const idle = parts[3] + (parts[4] || 0)
    const total = parts.reduce((a, b) => a + b, 0)
    return { idle, total }
  } catch {
    return null
  }
}

function getCpu(): number {
  const now = Date.now()
  const curr = parseProcStat()
  if (!curr) return -1

  if (prevCpu && now - prevCpuTime < 30000) {
    const idleDelta = curr.idle - prevCpu.idle
    const totalDelta = curr.total - prevCpu.total
    prevCpu = curr
    prevCpuTime = now
    if (totalDelta === 0) return 0
    return Math.round(100 * (1 - idleDelta / totalDelta))
  }

  // First call or stale — take two samples 100ms apart
  const first = curr
  const secondRaw = parseProcStat()
  if (!secondRaw) {
    prevCpu = curr
    prevCpuTime = now
    return -1
  }
  // Use synchronous delay
  try { execSync('sleep 0.1') } catch {}
  const second = parseProcStat()
  if (!second) {
    prevCpu = curr
    prevCpuTime = now
    return -1
  }
  const idleDelta = second.idle - first.idle
  const totalDelta = second.total - first.total
  prevCpu = second
  prevCpuTime = Date.now()
  if (totalDelta === 0) return 0
  return Math.round(100 * (1 - idleDelta / totalDelta))
}

function getMem(): number {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8')
    const lines: Record<string, number> = {}
    for (const line of meminfo.split('\n')) {
      const m = line.match(/^(\w+):\s+(\d+)/)
      if (m) lines[m[1]] = parseInt(m[2])
    }
    const total = lines['MemTotal']
    const available = lines['MemAvailable'] ?? (lines['MemFree'] + (lines['Buffers'] || 0) + (lines['Cached'] || 0))
    if (!total) return -1
    return Math.round((1 - available / total) * 100)
  } catch {
    return -1
  }
}

function getDisk(): number {
  try {
    const out = execSync('df / --output=pcent | tail -1').toString().trim().replace('%', '').trim()
    return parseInt(out) || -1
  } catch {
    return -1
  }
}

export async function GET() {
  return NextResponse.json({
    cpu: getCpu(),
    mem: getMem(),
    disk: getDisk(),
    timestamp: new Date().toISOString(),
  })
}
