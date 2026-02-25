import { NextResponse } from 'next/server'

// Password login disabled — use Discord OAuth at /api/auth/discord
export async function POST() {
  return NextResponse.json({ error: 'Password login is disabled' }, { status: 403 })
}
