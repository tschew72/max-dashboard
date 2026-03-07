export const AGENT_MAP: Record<string, { emoji: string; color: string }> = {
  max:  { emoji: '🤖', color: '#579dff' },
  alex: { emoji: '🔍', color: '#9f8fef' },
  sam:  { emoji: '💼', color: '#ff8b00' },
  bea:  { emoji: '📋', color: '#36b37e' },
  dev:  { emoji: '💻', color: '#0065ff' },
  quinn:{ emoji: '🧪', color: '#ff5630' },
  umi:  { emoji: '🎨', color: '#e774bb' },
  dex:  { emoji: '🚀', color: '#00b8d9' },
  cleo: { emoji: '💰', color: '#36b37e' },
  wren: { emoji: '✍️', color: '#6554c0' },
  kai:  { emoji: '🛡', color: '#ff5630' },
  ops:  { emoji: '⚙️', color: '#626f86' },
  maya: { emoji: '🌐', color: '#00875a' },
}

export function extractAgentName(jobName: string): { name: string; emoji: string } {
  const lower = jobName.toLowerCase()
  for (const [key, val] of Object.entries(AGENT_MAP)) {
    if (lower.includes(key) || lower.startsWith(`agent:${key}`)) {
      return { name: key.charAt(0).toUpperCase() + key.slice(1), emoji: val.emoji }
    }
  }
  return { name: 'Agent', emoji: '🤖' }
}
