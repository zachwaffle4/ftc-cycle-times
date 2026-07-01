import { LS_PREFIX } from '../config'

interface CacheEntry<T> {
  data: T
  expires: number | null
}

export function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    const { data, expires } = JSON.parse(raw) as CacheEntry<T>
    if (expires && Date.now() > expires) {
      localStorage.removeItem(LS_PREFIX + key)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function lsSet<T>(key: string, data: T, ttlMs?: number | null): void {
  try {
    const entry: CacheEntry<T> = { data, expires: ttlMs ? Date.now() + ttlMs : null }
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
  } catch {
    // quota exceeded — fail silently, same as the reference implementation
  }
}
