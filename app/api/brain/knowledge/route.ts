import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const KB_ROOT = '/root/.openclaw/workspace/02-KNOWLEDGE'

export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get('dir') || KB_ROOT

  // Security: must stay within KB_ROOT
  const resolved = path.resolve(dir)
  if (!resolved.startsWith(KB_ROOT)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true })
    const dirs: string[] = []
    const files: { name: string; path: string; size: number; modified: string }[] = []

    for (const entry of entries) {
      const full = path.join(resolved, entry.name)
      if (entry.isDirectory()) {
        dirs.push(entry.name)
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt') || entry.name.endsWith('.yaml') || entry.name.endsWith('.json')) {
        try {
          const stat = fs.statSync(full)
          files.push({ name: entry.name, path: full, size: stat.size, modified: stat.mtime.toISOString() })
        } catch {}
      }
    }

    dirs.sort()
    files.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ dirs, files, currentDir: resolved })
  } catch {
    return NextResponse.json({ error: 'Directory not found' }, { status: 404 })
  }
}
