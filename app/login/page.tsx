'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const DISCORD_ERROR_MESSAGES: Record<string, string> = {
  discord_denied: 'Discord login was cancelled.',
  token_failed: 'Discord authentication failed. Try again.',
  user_fetch_failed: 'Could not retrieve Discord profile.',
  unauthorized: 'Your Discord account is not authorised.',
  server_error: 'Something went wrong. Try again.',
}

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function LoginContent() {
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) setError(DISCORD_ERROR_MESSAGES[err] ?? 'Login failed. Try again.')
  }, [searchParams])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-3xl" style={{ background: 'var(--accent)' }}>
            ⚡
          </div>
          <h1 className="text-2xl font-bold text-white">Max Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>AI Command Center</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl text-sm text-center" style={{ background: '#2d1515', border: '1px solid #5a1d1d', color: '#ff8f73' }}>
            {error}
          </div>
        )}

        {/* Discord login */}
        <a
          href="/api/auth/discord"
          className="flex items-center justify-center gap-3 w-full h-14 rounded-xl font-semibold text-base text-white transition-opacity hover:opacity-90"
          style={{ background: '#5865F2' }}
        >
          <DiscordIcon />
          Continue with Discord
        </a>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--muted)' }}>
          Access restricted to authorised accounts only.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
