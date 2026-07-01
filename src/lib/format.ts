export function fmtDur(s: number | null | undefined): string {
  if (s == null) return '—'
  const abs = Math.round(Math.abs(s))
  return Math.floor(abs / 60) + ':' + String(abs % 60).padStart(2, '0')
}

export function fmtTime(unixSeconds: number | null | undefined, tz?: string): string {
  if (!unixSeconds) return '—'
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true }
  if (tz) opts.timeZone = tz
  return new Date(unixSeconds * 1000).toLocaleTimeString('en-US', opts)
}

export function fmtDate(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  const [y, mo, day] = isoDate.split('-').map(Number)
  return new Date(y, mo - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export interface DeltaDisplay {
  text: string
  cls: '' | 'ahead' | 'early-warn' | 'warning' | 'behind'
}

/** Positive delta = event running ahead of schedule; negative = behind. */
export function fmtDeltaObj(s: number | null | undefined): DeltaDisplay {
  if (s == null) return { text: '—', cls: '' }
  const abs = Math.round(Math.abs(s))
  const str = Math.floor(abs / 60) + ':' + String(abs % 60).padStart(2, '0')
  if (s > 600) return { text: '+' + str, cls: 'behind' } // >10 min early: flagged as unusual
  if (s > 300) return { text: '+' + str, cls: 'early-warn' } // 5-10 min early
  if (s >= 0) return { text: '+' + str, cls: 'ahead' } // <=5 min early
  if (s >= -300) return { text: '−' + str, cls: 'ahead' } // <=5 min behind
  if (s >= -900) return { text: '−' + str, cls: 'warning' } // 5-15 min behind
  return { text: '−' + str, cls: 'behind' } // >15 min behind
}

/** Hex color for a schedule delta in minutes. Positive = early, negative = late. */
export function schedDeltaColor(dMin: number, alpha = ''): string {
  if (dMin > 10) return '#ef4444' + alpha
  if (dMin > 5) return '#f59e0b' + alpha
  if (dMin >= -5) return '#10b981' + alpha
  if (dMin >= -15) return '#f59e0b' + alpha
  return '#ef4444' + alpha
}

export interface EventStatus {
  label: string
  cls: 'status-done' | 'status-live' | 'status-upcoming'
}

export function eventStatus(startDate: string, endDate: string): EventStatus {
  const today = new Date().toISOString().slice(0, 10)
  if (endDate < today) return { label: 'Completed', cls: 'status-done' }
  if (startDate <= today) return { label: 'In Progress', cls: 'status-live' }
  return { label: fmtDate(startDate), cls: 'status-upcoming' }
}
