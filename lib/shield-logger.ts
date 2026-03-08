/**
 * shield-logger.ts — DEPRECATED
 * ShieldLog table removed. All scan logging now goes to PromptDome (ingestshield DB).
 * This file is kept as a no-op stub so the MCP fallback path compiles.
 */
import type { AnalysisResult } from './shield-engine'

export type ShieldConsumer = 'dashboard' | 'mcp' | 'plugin' | 'unknown'

export async function logShieldScan(
  _result: AnalysisResult,
  _opts: { consumer?: ShieldConsumer; source?: string; durationMs?: number } = {}
): Promise<void> {
  // No-op: ShieldLog table removed. Real logging happens via PromptDome API.
}
