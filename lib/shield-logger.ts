import { prisma } from './db'
import type { AnalysisResult } from './shield-engine'

export type ShieldConsumer = 'dashboard' | 'mcp' | 'plugin' | 'unknown'

export async function logShieldScan(
  result: AnalysisResult,
  opts: {
    consumer?: ShieldConsumer
    source?: string   // URL or label of the content being scanned
    durationMs?: number
  } = {}
): Promise<void> {
  try {
    // Only persist WARN and BLOCK; ALLOW scans are counted via a summary row
    // Actually: log everything for accurate metrics, truncate safe text previews
    const textPreview = result.processedText.slice(0, 400)

    await prisma.shieldLog.create({
      data: {
        source:          opts.source ?? null,
        consumer:        opts.consumer ?? 'unknown',
        textPreview,
        score:           result.score,
        level:           result.level,
        recommendation:  result.recommendation,
        findingsJson:    JSON.stringify(result.findings),
        processingNotes: result.processingNotes,
        evasionDetected: result.evasionDetected ?? false,
        charCount:       result.charCount,
        engineVersion:   result.engineVersion,
        durationMs:      opts.durationMs ?? null,
      },
    })
  } catch (err) {
    // Never let logging failures break the shield itself
    console.error('[shield-logger] Failed to log scan:', err)
  }
}
