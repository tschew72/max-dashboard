import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

interface PM2Proc {
  name: string
  pm2_env: {
    status: string
    pm_uptime: number
    restart_time: number
  }
  monit: {
    memory: number
    cpu: number
  }
}

export async function GET() {
  try {
    // PM2 data
    let pm2: { name: string; status: string; uptime: number; restarts: number; memory: number; cpu: number }[] = []
    try {
      const { stdout } = await execAsync('pm2 jlist', { timeout: 10000 })
      const procs: PM2Proc[] = JSON.parse(stdout)
      pm2 = procs.map(p => ({
        name: p.name,
        status: p.pm2_env.status,
        uptime: p.pm2_env.pm_uptime || 0,
        restarts: p.pm2_env.restart_time || 0,
        memory: Math.round((p.monit.memory || 0) / 1024 / 1024),
        cpu: p.monit.cpu || 0,
      }))
    } catch { /* pm2 unavailable */ }

    // Docker data
    let docker: { name: string; status: string; state: string; uptime: string }[] = []
    try {
      const { stdout } = await execAsync('docker ps -a --format "{{json .}}"', { timeout: 10000 })
      const lines = stdout.trim().split('\n').filter(Boolean)
      docker = lines.map(line => {
        const c = JSON.parse(line)
        return {
          name: c.Names || c.Name || '',
          status: c.Status || '',
          state: c.State || (c.Status?.toLowerCase().includes('up') ? 'running' : 'exited'),
          uptime: c.Status || '',
        }
      })
    } catch { /* docker unavailable */ }

    const errorCount = pm2.filter(p => p.status !== 'online').length +
      docker.filter(d => d.state !== 'running').length

    return NextResponse.json({
      pm2,
      docker,
      pm2Count: pm2.length,
      dockerCount: docker.length,
      errorCount,
    }, {
      headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
    })
  } catch {
    return NextResponse.json({ pm2: [], docker: [], pm2Count: 0, dockerCount: 0, errorCount: 0 }, { status: 500 })
  }
}
