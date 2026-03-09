import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const AGENTS_DIR = '/root/.openclaw/agents'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params

  // Validate agentId - alphanumeric + hyphen only
  if (!/^[a-zA-Z0-9-]+$/.test(agentId)) {
    return NextResponse.json({ success: false, error: 'Invalid agent ID' }, { status: 400 })
  }

  // Check agent exists
  const agentDir = path.join(AGENTS_DIR, agentId)
  if (!fs.existsSync(agentDir)) {
    return NextResponse.json({ success: false, error: `Agent '${agentId}' not found` }, { status: 404 })
  }

  // Check if agent has an active session
  const sessionsDir = path.join(agentDir, 'sessions')
  let isActive = false
  try {
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'))
    for (const f of files) {
      const stat = fs.statSync(path.join(sessionsDir, f))
      if (Date.now() - stat.mtimeMs < 90_000) {
        isActive = true
        break
      }
    }
  } catch {}

  if (!isActive) {
    return NextResponse.json({ success: false, error: 'No active session found for this agent' }, { status: 404 })
  }

  // Try to kill the agent process
  let method = 'none'
  try {
    // Try pkill targeting openclaw sessions for this agent
    try {
      execSync(`pkill -f "agent[=:]${agentId}" 2>/dev/null || true`, { timeout: 5000 })
      method = 'pkill-agent'
    } catch {}

    // Also try killing by session key pattern
    try {
      execSync(`pkill -f "agent:${agentId}:" 2>/dev/null || true`, { timeout: 5000 })
      if (method === 'none') method = 'pkill-session'
    } catch {}

    // If agent is a subagent, try to kill its specific process
    try {
      const result = execSync(`ps aux | grep -i "openclaw" | grep -i "${agentId}" | grep -v grep | awk '{print $2}'`, { timeout: 5000 }).toString().trim()
      if (result) {
        const pids = result.split('\n').filter(p => p.trim())
        for (const pid of pids) {
          try {
            process.kill(parseInt(pid), 'SIGTERM')
            method = 'process-kill'
          } catch {}
        }
      }
    } catch {}

    return NextResponse.json({
      success: true,
      agentId,
      method,
      message: `Stop signal sent to agent '${agentId}'`,
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to stop agent',
    }, { status: 500 })
  }
}
