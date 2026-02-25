import { NextResponse } from 'next/server'
import os from 'os'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(execCb)

async function getOpenClawVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync('openclaw --version 2>&1', { timeout: 5000 })
    return stdout.trim().split('\n')[0] ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function GET() {
  const [clawVersion] = await Promise.all([getOpenClawVersion()])

  const uptimeSecs = os.uptime()
  const days = Math.floor(uptimeSecs / 86400)
  const hours = Math.floor((uptimeSecs % 86400) / 3600)
  const mins = Math.floor((uptimeSecs % 3600) / 60)
  const uptimeStr = days > 0 ? `${days}d ${hours}h ${mins}m` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return NextResponse.json({
    hostname: os.hostname(),
    nodeVersion: process.version,
    openClawVersion: clawVersion,
    uptime: uptimeStr,
    platform: process.platform,
    arch: process.arch,
  })
}
