import type { MatchPhase, MatchRow } from './matchProcessing'

export function mean(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
}

export function median(a: number[]): number {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function stddev(a: number[]): number {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length)
}

export function scopedRows(rows: MatchRow[] | undefined, scope?: MatchPhase): MatchRow[] {
  const all = rows ?? []
  if (!scope) return all
  return all.filter((r) => r.phase === scope)
}

export function cycleTimes(rows: MatchRow[] | undefined, scope?: MatchPhase): number[] {
  return scopedRows(rows, scope)
    .filter((r) => r.cycleTime != null && !r.isOutlier)
    .map((r) => r.cycleTime as number)
}

export function scheduledCycleTimes(rows: MatchRow[] | undefined, scope?: MatchPhase): number[] {
  return scopedRows(rows, scope)
    .filter((r) => r.scheduledCT != null)
    .map((r) => r.scheduledCT as number)
}

export function deltas(rows: MatchRow[] | undefined, scope?: MatchPhase): number[] {
  return scopedRows(rows, scope)
    .filter((r) => r.delta != null)
    .map((r) => r.delta as number)
}

export function scorePostDelays(rows: MatchRow[] | undefined, scope?: MatchPhase): number[] {
  return scopedRows(rows, scope)
    .filter((r) => r.scorePostDelay != null)
    .map((r) => r.scorePostDelay as number)
}
