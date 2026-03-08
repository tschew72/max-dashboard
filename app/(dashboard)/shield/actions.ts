'use server'

import { analyzeText, type ContextProfile } from '@/lib/shield-engine'

const PROMPTDOME_URL = process.env.PROMPTDOME_URL ?? 'https://promptdome.cyberforge.one/api/v1/shield'
const PROMPTDOME_KEY = process.env.PROMPTDOME_API_KEY ?? ''

export async function analyzePrompt(text: string, source?: string, profile: ContextProfile = 'general') {
  const t0 = Date.now()
  try {
    const res = await fetch(PROMPTDOME_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PROMPTDOME_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 50_000), source: source ?? 'manual' }),
    })
    if (res.ok) {
      const data = await res.json()
      return { ...data, source: source ?? null }
    }
  } catch {
    // fallback to local engine (offline/unreachable)
  }
  // Local fallback — no logging (no ShieldLog table anymore)
  const result = analyzeText(text.slice(0, 50_000), profile)
  return { ...result, source: source ?? null, durationMs: Date.now() - t0 }
}
