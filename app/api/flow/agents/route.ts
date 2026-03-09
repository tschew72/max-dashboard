import { NextResponse } from 'next/server'
import { buildFlowState } from '@/lib/flow/parse-sessions'

export async function GET() {
  try {
    const state = buildFlowState()
    return NextResponse.json(state)
  } catch (error) {
    console.error('Flow agents error:', error)
    return NextResponse.json({ activeChains: [], agents: [], recentActivity: [] })
  }
}
