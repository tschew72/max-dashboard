/**
 * Simple in-memory TTL cache for API routes.
 * Prevents hammering the DB on every page visit.
 */
const store = new Map<string, { value: unknown; expiresAt: number }>()

export function getCached<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { store.delete(key); return null }
  return entry.value as T
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function invalidate(key: string): void {
  store.delete(key)
}
