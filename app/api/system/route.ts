import { NextResponse } from 'next/server'
import os from 'os'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(execCb)

async function getDiskUsage(): Promise<{ used: string; total: string; pct: number }> {
  try {
    const { stdout } = await execAsync("df -h / | tail -1")
    const parts = stdout.trim().split(/\s+/)
    // Format: Filesystem Size Used Avail Use% Mounted
    const pct = parseInt(parts[4]?.replace('%', '') ?? '0', 10)
    return { used: parts[2] ?? '?', total: parts[1] ?? '?', pct }
  } catch {
    return { used: '?', total: '?', pct: 0 }
  }
}

interface Pm2Process {
  name: string
  pm_id: number
  pid: number
  pm2_env: {
    status: string
    pm_uptime?: number
    restart_time?: number
    created_at?: number
  }
  monit: {
    cpu: number
    memory: number
  }
}

async function getPm2Processes(): Promise<object[]> {
  try {
    const { stdout } = await execAsync('pm2 jlist 2>/dev/null')
    const list: Pm2Process[] = JSON.parse(stdout.trim())
    return list.map((p) => ({
      id: p.pm_id,
      name: p.name,
      pid: p.pid,
      status: p.pm2_env?.status ?? 'unknown',
      cpu: p.monit?.cpu ?? 0,
      memory: p.monit?.memory ?? 0,
      memoryMb: Math.round((p.monit?.memory ?? 0) / 1024 / 1024),
      pm_uptime: p.pm2_env?.pm_uptime ?? 0,
      restart_time: p.pm2_env?.restart_time ?? 0,
    }))
  } catch {
    return []
  }
}

export async function GET() {
  const cpus = os.cpus()
  const loadavg = os.loadavg()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const uptime = os.uptime()
  const hostname = os.hostname()

  const cpuCount = cpus.length
  const ramUsedPct = Math.round((usedMem / totalMem) * 100)
  const ramUsedGb = (usedMem / 1024 / 1024 / 1024).toFixed(1)
  const ramTotalGb = (totalMem / 1024 / 1024 / 1024).toFixed(1)

  const [disk, pm2] = await Promise.all([getDiskUsage(), getPm2Processes()])

  const days = Math.floor(uptime / 86400)
  const hours = Math.floor((uptime % 86400) / 3600)
  const mins = Math.floor((uptime % 3600) / 60)
  const uptimeStr = days > 0 ? `${days}d ${hours}h ${mins}m` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return NextResponse.json({
    cpu: {
      load1: loadavg[0],
      load5: loadavg[1],
      load15: loadavg[2],
      count: cpuCount,
      pct: Math.round((loadavg[0] / cpuCount) * 100),
    },
    ram: {
      usedPct: ramUsedPct,
      usedGb: ramUsedGb,
      totalGb: ramTotalGb,
    },
    disk,
    uptime: { seconds: uptime, str: uptimeStr },
    hostname,
    pm2,
  })
}
