import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'

const MEMORY_DIR = '/root/.openclaw/workspace/memory'
const MEMORY_MD = '/root/.openclaw/workspace/MEMORY.md'

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path')
  if (!filePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  // Security: only allow paths in memory dir or exact MEMORY.md
  const isMemoryDir = filePath.startsWith(MEMORY_DIR + '/')
  const isMemoryMd = filePath === MEMORY_MD
  if (!isMemoryDir && !isMemoryMd) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
