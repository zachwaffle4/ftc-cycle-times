import type { AggregateEntry } from '../composables/useAggregateStats'
import { cycleTimes, deltas, mean, median, scheduledCycleTimes } from './stats'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface MonthlySeries {
  labels: string[]
  actualData: (number | null)[]
  medianData: (number | null)[]
  schedData: (number | null)[]
  deltaData: (number | null)[]
}

/** Buckets qual cycle-time stats by calendar month, keyed by year+month so a
 *  season spanning a year boundary (e.g. Sep 2025 - Apr 2026) sorts and labels
 *  chronologically instead of by month-of-year alone. */
export function buildMonthlySeries(entries: AggregateEntry[]): MonthlySeries {
  const buckets = new Map<string, { year: number; month: number; actual: number[]; sched: number[]; delta: number[] }>()

  for (const e of entries) {
    const year = Number(e.event.startDate.slice(0, 4))
    const month = Number(e.event.startDate.slice(5, 7)) - 1
    const key = `${year}-${month}`
    if (!buckets.has(key)) buckets.set(key, { year, month, actual: [], sched: [], delta: [] })
    const b = buckets.get(key)!
    b.actual.push(...cycleTimes(e.rows, 'qual'))
    b.sched.push(...scheduledCycleTimes(e.rows, 'qual'))
    b.delta.push(...deltas(e.rows, 'qual'))
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => {
    const ba = buckets.get(a)!
    const bb = buckets.get(b)!
    return ba.year - bb.year || ba.month - bb.month
  })

  const years = new Set(sortedKeys.map((k) => buckets.get(k)!.year))
  const multiYear = years.size > 1

  const labels = sortedKeys.map((k) => {
    const b = buckets.get(k)!
    return multiYear ? `${MONTH_LABELS[b.month]} '${String(b.year).slice(2)}` : MONTH_LABELS[b.month]
  })
  const actualData = sortedKeys.map((k) => {
    const a = buckets.get(k)!.actual
    return a.length ? +(mean(a) / 60).toFixed(2) : null
  })
  const medianData = sortedKeys.map((k) => {
    const a = buckets.get(k)!.actual
    return a.length ? +(median(a) / 60).toFixed(2) : null
  })
  const schedData = sortedKeys.map((k) => {
    const s = buckets.get(k)!.sched
    return s.length ? +(mean(s) / 60).toFixed(2) : null
  })
  const deltaData = sortedKeys.map((k) => {
    const d = buckets.get(k)!.delta
    return d.length ? +(mean(d) / 60).toFixed(2) : null
  })

  return { labels, actualData, medianData, schedData, deltaData }
}
