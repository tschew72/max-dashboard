import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MEMORY_DIR = '/root/.openclaw/workspace/memory'
const MEMORY_MD = '/root/.openclaw/workspace/MEMORY.md'

export async function GET() {
  const files: { name: string; path: string; size: number; modified: string; isPinned: boolean }[] = []

  // Pinned: MEMORY.md (long-term memory)
  try {
    const stat = fs.statSync(MEMORY_MD)
    files.push({
      name: 'MEMORY.md',
      path: MEMORY_MD,
      size: stat.size,
      modified: stat.mtime.toISOString(),
      isPinned: true,
    })
  } catch {}

  // Daily memory files
  try {
    const entries = fs.readdirSync(MEMORY_DIR)
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue
      const full = path.join(MEMORY_DIR, entry)
      try {
        const stat = fs.statSync(full)
        files.push({
          name: entry,
          path: full,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          isPinned: false,
        })
      } catch {}
    }
  } catch {}

  // Sort daily files by modified desc (pinned stays at top)
  const pinned = files.filter(f => f.isPinned)
  const daily = files.filter(f => !f.isPinned).sort((a, b) => b.modified.localeCompare(a.modified))

  return NextResponse.json({ files: [...pinned, ...daily] })
}
