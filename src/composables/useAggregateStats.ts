import { computed, ref, watch, type Ref } from 'vue'
import { fetchEventMatches, fetchEventTeamCount } from '../api/client'
import type { ApiV3Event, ApiV3Match } from '../api/types'
import { cycleTimeAttribution } from './cycleTimeAttribution'
import { processMatches, type MatchRow } from '../lib/matchProcessing'
import { cycleTimes, deltas, scheduledCycleTimes } from '../lib/stats'

export interface AggregateEntry {
  event: ApiV3Event
  rows: MatchRow[] | undefined
  teamCount?: number
  matchesPerTeam?: number
}

interface RawEntry {
  event: ApiV3Event
  matches: ApiV3Match[] | null
  teamCount?: number
}

const CONCURRENCY = 4

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let i = 0
  async function worker(): Promise<void> {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** Fetches + processes match data for a set of events (concurrency-limited), and
 *  exposes pooled qual/playoff cycle-time stats across all non-excluded events.
 *  Raw match data is kept separately from the derived rows so toggling the
 *  cycle-time attribution setting re-processes in place, with no refetch. */
export function useAggregateStats(cmpYear: Ref<number>, events: Ref<ApiV3Event[]>) {
  const rawEntries = ref<RawEntry[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const progress = ref({ done: 0, total: 0 })
  const excluded = ref(new Set<number>())

  const entries = computed<AggregateEntry[]>(() =>
    rawEntries.value.map((e) => {
      const processed = e.matches ? processMatches(e.matches, cycleTimeAttribution.value) : undefined
      return {
        event: e.event,
        rows: processed?.rows,
        teamCount: e.teamCount,
        matchesPerTeam: processed?.matchesPerTeam,
      }
    }),
  )

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    progress.value = { done: 0, total: events.value.length }
    try {
      const loaded = await mapWithConcurrency(events.value, CONCURRENCY, async (event) => {
        const [matches, teamCount] = await Promise.all([
          fetchEventMatches(cmpYear.value, event.code),
          fetchEventTeamCount(cmpYear.value, event.code),
        ])
        progress.value = { done: progress.value.done + 1, total: events.value.length }
        return { event, matches, teamCount } satisfies RawEntry
      })
      rawEntries.value = loaded
      // Scrimmages are informal/practice events with less rigorous scheduling —
      // pre-exclude them from pooled stats by default (same mechanism as manually
      // unchecking an event), but leave them visible/re-includable in the table.
      excluded.value = new Set(loaded.flatMap((e, i) => (e.event.type === 'SCRIMMAGE' ? [i] : [])))
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  watch([cmpYear, events], load, { immediate: true })

  function toggleExclude(idx: number): void {
    const next = new Set(excluded.value)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    excluded.value = next
  }

  function toggleAll(checked: boolean): void {
    excluded.value = checked ? new Set() : new Set(entries.value.map((_, i) => i))
  }

  const includedEntries = computed(() => entries.value.filter((_, i) => !excluded.value.has(i)))

  function pooled(scope: 'qual' | 'playoff') {
    const cts: number[] = []
    const ds: number[] = []
    const schedCts: number[] = []
    let outlierCount = 0
    for (const e of includedEntries.value) {
      cts.push(...cycleTimes(e.rows, scope))
      ds.push(...deltas(e.rows, scope))
      schedCts.push(...scheduledCycleTimes(e.rows, scope))
      outlierCount += (e.rows ?? []).filter((r) => r.phase === scope && r.cycleTime != null && r.isOutlier).length
    }
    return { cts, ds, schedCts, outlierCount }
  }

  return { entries, loading, error, progress, excluded, toggleExclude, toggleAll, includedEntries, pooled }
}
