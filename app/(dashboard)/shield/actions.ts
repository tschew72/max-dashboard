'use server'

import { analyzeText } from '@/lib/shield-engine'
import { logShieldScan } from '@/lib/shield-logger'

export async function analyzePrompt(text: string, source?: string) {
  const t0 = Date.now()
  const result = analyzeText(text.slice(0, 50_000))
  const durationMs = Date.now() - t0
  // Fire-and-forget log
  logShieldScan(result, { consumer: 'dashboard', source, durationMs }).catch(() => {})
  return { ...result, source: source ?? null }
}
