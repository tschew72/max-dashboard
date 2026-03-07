'use server'

import { analyzeText, type ContextProfile } from '@/lib/shield-engine'
import { logShieldScan } from '@/lib/shield-logger'

export async function analyzePrompt(text: string, source?: string, profile: ContextProfile = 'general') {
  const t0 = Date.now()
  const result = analyzeText(text.slice(0, 50_000), profile)
  const durationMs = Date.now() - t0
  // Fire-and-forget log
  logShieldScan(result, { consumer: 'dashboard', source, durationMs }).catch(() => {})
  return { ...result, source: source ?? null }
}
