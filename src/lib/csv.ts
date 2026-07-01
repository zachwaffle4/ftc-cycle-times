import type { ApiV3Event } from '../api/types'
import type { MatchRow } from './matchProcessing'
import { cycleTimes, deltas, mean, median, scheduledCycleTimes, stddev } from './stats'

function csvVal(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s
}

function downloadCsv(filename: string, headers: string[], dataRows: unknown[][]): void {
  const lines = [headers.map(csvVal).join(',')]
  for (const row of dataRows) lines.push(row.map(csvVal).join(','))
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportEventCsv(eventCode: string, rows: MatchRow[]): void {
  const headers = [
    'Match',
    'Scheduled (unix)',
    'Actual (unix)',
    'Scheduled CT (s)',
    'Cycle Time (s)',
    'Delta Schedule (s)',
    'Score Post Delay (s)',
    'Is Outlier',
    'Is Replay',
  ]
  const data = rows.map((r) => [
    r.matchLabel,
    r.scheduled ?? '',
    r.actual ?? '',
    r.scheduledCT != null ? Math.round(r.scheduledCT) : '',
    r.cycleTime != null ? Math.round(r.cycleTime) : '',
    r.delta != null ? Math.round(r.delta) : '',
    r.scorePostDelay != null ? Math.round(r.scorePostDelay) : '',
    r.isOutlier ? 1 : 0,
    r.isReplay ? 1 : 0,
  ])
  downloadCsv(`${eventCode}_matches.csv`, headers, data)
}

export interface AggEventEntry {
  event: ApiV3Event
  rows: MatchRow[] | undefined
}

export function exportAggCsv(slug: string, entries: AggEventEntry[]): void {
  const headers = [
    'Event Code',
    'Event Name',
    'Region',
    'City',
    'State',
    'Matches Played',
    'Avg Sched CT (s)',
    'Mean CT (s)',
    'Median CT (s)',
    'Std Dev (s)',
    'Avg Delta (s)',
  ]
  const data = entries.map(({ event, rows }) => {
    const cts = cycleTimes(rows, 'qual')
    const ds = deltas(rows, 'qual')
    const sc = scheduledCycleTimes(rows, 'qual')
    const played = (rows ?? []).filter((r) => r.phase === 'qual' && r.actual != null).length
    return [
      event.code,
      event.name,
      event.regionCode,
      event.city ?? '',
      event.state ?? '',
      played,
      sc.length ? Math.round(mean(sc)) : '',
      cts.length ? Math.round(mean(cts)) : '',
      cts.length ? Math.round(median(cts)) : '',
      cts.length ? Math.round(stddev(cts)) : '',
      ds.length ? Math.round(mean(ds)) : '',
    ]
  })
  downloadCsv(`${slug}_events.csv`, headers, data)
}
