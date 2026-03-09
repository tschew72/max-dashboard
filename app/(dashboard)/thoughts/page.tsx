'use client'
import { useState } from 'react'
import ThoughtsFeed from '@/components/thoughts/ThoughtsFeed'

const AGENTS = [
  { id: 'main', name: 'Max', emoji: '⚡' },
  { id: 'ba', name: 'Bea', emoji: '📋' },
  { id: 'dev', name: 'Dev', emoji: '💻' },
  { id: 'qa', name: 'Quinn', emoji: '🧪' },
  { id: 'ux', name: 'Umi', emoji: '🎨' },
  { id: 'researcher', name: 'Alex', emoji: '🔍' },
  { id: 'sales', name: 'Sam', emoji: '📈' },
  { id: 'devops', name: 'Dex', emoji: '🚀' },
  { id: 'cfo', name: 'Cleo', emoji: '💰' },
  { id: 'ciso', name: 'Kai', emoji: '🛡️' },
  { id: 'writer', name: 'Wren', emoji: '✍️' },
  { id: 'ops', name: 'Ops', emoji: '⚙️' },
  { id: 'marketing', name: 'Maya', emoji: '📣' },
  { id: 'webdev', name: 'Webrin', emoji: '🌐' },
]

export default function ThoughtsPage() {
  const [selectedAgent, setSelectedAgent] = useState('main')

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-4 pb-3 flex items-center justify-between"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-xl font-bold text-white">🧠 Live Thoughts</h1>
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Real-time agent chain-of-thought</p>
        </div>
        <select
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm"
          style={{
            background: 'var(--card)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {AGENTS.map(a => (
            <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
          ))}
        </select>
      </div>

      <div className="px-4 pt-4">
        <ThoughtsFeed agent={selectedAgent} maxLines={50} />
      </div>
    </div>
  )
}
