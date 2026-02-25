'use client'
import { useEffect, useState, useCallback } from 'react'
import { Brain, BookOpen, Calendar, ChevronRight, ChevronLeft, Search, X, FileText, Folder, Home, Loader2, Pin } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface MemoryFile {
  name: string
  path: string
  size: number
  modified: string
  isPinned: boolean
}

interface KBFile {
  name: string
  path: string
  size: number
  modified: string
}

interface KBDir {
  name: string
}

// ─── Markdown renderer (lightweight, no deps) ─────────────────────────────────
function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let codeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCode) {
        out.push(`<pre style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;overflow-x:auto;font-size:12px;margin:8px 0;"><code>${codeLines.map(l => l.replace(/</g,'&lt;').replace(/>/g,'&gt;')).join('\n')}</code></pre>`)
        codeLines = []
        inCode = false
      } else {
        inCode = true
      }
      continue
    }

    if (inCode) { codeLines.push(line); continue }

    if (line.startsWith('#### ')) {
      out.push(`<h4 style="font-size:13px;font-weight:700;margin:16px 0 4px;color:var(--text);">${inline(line.slice(5))}</h4>`)
    } else if (line.startsWith('### ')) {
      out.push(`<h3 style="font-size:14px;font-weight:700;margin:20px 0 6px;color:var(--accent-light);">${inline(line.slice(4))}</h3>`)
    } else if (line.startsWith('## ')) {
      out.push(`<h2 style="font-size:16px;font-weight:700;margin:24px 0 8px;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:6px;">${inline(line.slice(3))}</h2>`)
    } else if (line.startsWith('# ')) {
      out.push(`<h1 style="font-size:20px;font-weight:800;margin:0 0 16px;color:var(--text);">${inline(line.slice(2))}</h1>`)
    } else if (line.match(/^[-*] /)) {
      out.push(`<div style="display:flex;gap:8px;margin:3px 0;"><span style="color:var(--accent-light);margin-top:2px;">•</span><span style="color:var(--text);font-size:13px;">${inline(line.slice(2))}</span></div>`)
    } else if (line.match(/^\d+\. /)) {
      const m = line.match(/^(\d+)\. (.*)/)
      if (m) out.push(`<div style="display:flex;gap:8px;margin:3px 0;"><span style="color:var(--muted);font-size:12px;min-width:16px;">${m[1]}.</span><span style="color:var(--text);font-size:13px;">${inline(m[2])}</span></div>`)
    } else if (line.match(/^---+$/)) {
      out.push(`<hr style="border:none;border-top:1px solid var(--border);margin:20px 0;" />`)
    } else if (line.trim() === '') {
      out.push(`<div style="height:8px;"></div>`)
    } else {
      out.push(`<p style="color:var(--text);font-size:13px;line-height:1.6;margin:4px 0;">${inline(line)}</p>`)
    }
  }

  // handle tables (simple: | col | col |)
  return out.join('\n')
}

function inline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-size:11px;">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent-light);text-decoration:underline;">$1</a>')
}

// ─── File size formatter ───────────────────────────────────────────────────────
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseDateFromFilename(name: string): string {
  const m = name.match(/(\d{4}-\d{2}-\d{2})/)
  if (m) {
    const d = new Date(m[1])
    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return name.replace('.md', '')
}

// ─── Viewer panel ─────────────────────────────────────────────────────────────
function FileViewer({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  const html = renderMarkdown(content)
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={onClose} style={{ color: 'var(--muted)' }}>
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-sm truncate flex-1" style={{ color: 'var(--text)' }}>{title}</span>
      </div>
      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

// ─── Memory Tab ───────────────────────────────────────────────────────────────
function MemoryTab() {
  const [files, setFiles] = useState<MemoryFile[]>([])
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<{ title: string; content: string } | null>(null)
  const [loadingFile, setLoadingFile] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/brain/memory')
      .then(r => r.json())
      .then(d => { setFiles(d.files || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const openFile = useCallback(async (file: MemoryFile) => {
    setLoadingFile(file.path)
    try {
      const r = await fetch(`/api/brain/memory/content?path=${encodeURIComponent(file.path)}`)
      const d = await r.json()
      setViewer({ title: file.isPinned ? '🧠 Long-Term Memory' : parseDateFromFilename(file.name), content: d.content || '' })
    } finally {
      setLoadingFile(null)
    }
  }, [])

  const filtered = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  if (viewer) return <FileViewer title={viewer.title} content={viewer.content} onClose={() => setViewer(null)} />

  return (
    <div>
      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search memory files…"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')} style={{ color: 'var(--muted)' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--muted)' }} /></div>
      ) : (
        <div className="px-4 flex flex-col gap-3">
          {filtered.map(file => (
            <button
              key={file.path}
              onClick={() => openFile(file)}
              disabled={loadingFile === file.path}
              className="text-left w-full rounded-2xl p-4 flex items-start gap-3 transition-opacity"
              style={{
                background: file.isPinned ? 'linear-gradient(135deg, var(--accent)22, var(--card))' : 'var(--card)',
                border: `1px solid ${file.isPinned ? 'var(--accent)' : 'var(--border)'}`,
                opacity: loadingFile === file.path ? 0.6 : 1,
              }}
            >
              <div className="shrink-0 mt-0.5">
                {file.isPinned ? <Pin size={18} style={{ color: 'var(--accent-light)' }} /> : <Calendar size={18} style={{ color: 'var(--muted)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                  {file.isPinned ? '🧠 Long-Term Memory' : parseDateFromFilename(file.name)}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {fmtSize(file.size)} · {fmtDate(file.modified)}
                </div>
                {file.isPinned && (
                  <div className="text-xs mt-1" style={{ color: 'var(--accent-light)' }}>Curated long-term memories</div>
                )}
              </div>
              {loadingFile === file.path ? (
                <Loader2 size={16} className="animate-spin shrink-0 mt-1" style={{ color: 'var(--muted)' }} />
              ) : (
                <ChevronRight size={16} className="shrink-0 mt-1" style={{ color: 'var(--muted)' }} />
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>No files found</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Knowledge Tab ────────────────────────────────────────────────────────────
const KB_ROOT = '/root/.openclaw/workspace/02-KNOWLEDGE'

function KnowledgeTab() {
  const [currentDir, setCurrentDir] = useState(KB_ROOT)
  const [dirs, setDirs] = useState<string[]>([])
  const [files, setFiles] = useState<KBFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewer, setViewer] = useState<{ title: string; content: string } | null>(null)
  const [loadingFile, setLoadingFile] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<{ name: string; path: string }[]>([])

  const loadDir = useCallback(async (dir: string) => {
    setLoading(true)
    setSearch('')
    try {
      const r = await fetch(`/api/brain/knowledge?dir=${encodeURIComponent(dir)}`)
      const d = await r.json()
      setDirs(d.dirs || [])
      setFiles(d.files || [])
      setCurrentDir(d.currentDir || dir)

      // Build breadcrumbs
      const rel = (d.currentDir || dir).replace(KB_ROOT, '')
      const parts = rel.split('/').filter(Boolean)
      const crumbs = [{ name: '02-KNOWLEDGE', path: KB_ROOT }]
      let acc = KB_ROOT
      for (const p of parts) {
        acc = acc + '/' + p
        crumbs.push({ name: p, path: acc })
      }
      setBreadcrumbs(crumbs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDir(KB_ROOT) }, [loadDir])

  const openFile = useCallback(async (file: KBFile) => {
    setLoadingFile(file.path)
    try {
      const r = await fetch(`/api/brain/knowledge/content?path=${encodeURIComponent(file.path)}`)
      const d = await r.json()
      setViewer({ title: file.name, content: d.content || '' })
    } finally {
      setLoadingFile(null)
    }
  }, [])

  const filteredDirs = dirs.filter(d => d.toLowerCase().includes(search.toLowerCase()))
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  if (viewer) return <FileViewer title={viewer.title} content={viewer.content} onClose={() => setViewer(null)} />

  return (
    <div>
      {/* Breadcrumb */}
      <div className="px-4 pb-3 flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.path} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight size={12} style={{ color: 'var(--muted)' }} />}
            <button
              onClick={() => loadDir(crumb.path)}
              className="text-xs px-2 py-1 rounded-lg"
              style={{
                color: i === breadcrumbs.length - 1 ? 'var(--text)' : 'var(--accent-light)',
                background: i === breadcrumbs.length - 1 ? 'var(--card)' : 'transparent',
                fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
              }}
            >
              {i === 0 ? <Home size={12} /> : crumb.name}
            </button>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by name…"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')} style={{ color: 'var(--muted)' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--muted)' }} /></div>
      ) : (
        <div className="px-4 flex flex-col gap-2">
          {/* Dirs */}
          {filteredDirs.map(dir => (
            <button
              key={dir}
              onClick={() => loadDir(currentDir + '/' + dir)}
              className="text-left w-full rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <Folder size={18} style={{ color: 'var(--accent-light)' }} />
              <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{dir}</span>
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </button>
          ))}

          {/* Files */}
          {filteredFiles.map(file => (
            <button
              key={file.path}
              onClick={() => openFile(file)}
              disabled={loadingFile === file.path}
              className="text-left w-full rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                opacity: loadingFile === file.path ? 0.6 : 1,
              }}
            >
              <FileText size={18} style={{ color: 'var(--muted)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: 'var(--text)' }}>{file.name}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{fmtSize(file.size)}</div>
              </div>
              {loadingFile === file.path ? (
                <Loader2 size={16} className="animate-spin shrink-0" style={{ color: 'var(--muted)' }} />
              ) : (
                <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--muted)' }} />
              )}
            </button>
          ))}

          {filteredDirs.length === 0 && filteredFiles.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
              {search ? 'No matches found' : 'Empty directory'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BrainPage() {
  const [tab, setTab] = useState<'memory' | 'knowledge'>('memory')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 pt-6 pb-4"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Brain size={24} style={{ color: 'var(--accent-light)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Brain</h1>
        </div>

        {/* Tabs */}
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setTab('memory')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === 'memory' ? 'var(--accent)' : 'transparent',
              color: tab === 'memory' ? '#fff' : 'var(--muted)',
            }}
          >
            <Calendar size={15} />
            Memory
          </button>
          <button
            onClick={() => setTab('knowledge')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === 'knowledge' ? 'var(--accent)' : 'transparent',
              color: tab === 'knowledge' ? '#fff' : 'var(--muted)',
            }}
          >
            <BookOpen size={15} />
            Knowledge
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4 pb-6">
        {tab === 'memory' ? <MemoryTab /> : <KnowledgeTab />}
      </div>
    </div>
  )
}
