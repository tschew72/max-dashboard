import { NextRequest, NextResponse } from 'next/server'
import { signJWT } from '@/lib/auth'

const BASE_URL = 'https://dash.vincechew.me'

function redirect(path: string) {
  return NextResponse.redirect(`${BASE_URL}${path}`)
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code) {
    return redirect('/login?error=discord_denied')
  }

  try {
    // ── 1. Exchange code for access token ──────────────────────────────────
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    })

    if (!tokenRes.ok) {
      console.error('Discord token exchange failed:', await tokenRes.text())
      return redirect('/login?error=token_failed')
    }

    const tokenData = await tokenRes.json()

    // ── 2. Fetch Discord user info ──────────────────────────────────────────
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userRes.ok) {
      return redirect('/login?error=user_fetch_failed')
    }

    const user = await userRes.json()

    // ── 3. Check allowlist ─────────────────────────────────────────────────
    const allowedId = process.env.DISCORD_ALLOWED_USER_ID
    if (user.id !== allowedId) {
      console.warn(`Discord OAuth: blocked user ${user.id} (${user.username})`)
      return redirect('/login?error=unauthorized')
    }

    // ── 4. Issue JWT session cookie ────────────────────────────────────────
    const token = await signJWT({
      user: user.username,
      discordId: user.id,
      avatar: user.avatar,
      role: 'admin',
      via: 'discord',
    })

    const res = redirect('/')
    res.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return res
  } catch (err) {
    console.error('Discord OAuth callback error:', err)
    return redirect('/login?error=server_error')
  }
}
