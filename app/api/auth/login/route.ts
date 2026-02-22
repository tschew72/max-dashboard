import { NextResponse } from 'next/server'
import { signJWT } from '@/lib/auth'

export async function POST(req: Request) {
  const { password } = await req.json()
  if (password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = await signJWT({ user: 'vince', role: 'admin' })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
