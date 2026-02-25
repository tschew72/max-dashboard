import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const KB_ROOT = '/root/.openclaw/workspace/02-KNOWLEDGE'

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path')
  if (!filePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(KB_ROOT)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const content = fs.readFileSync(resolved, 'utf-8')
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
