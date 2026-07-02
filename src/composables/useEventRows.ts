import { computed, ref, watch, type Ref } from 'vue'
import { fetchEventInfo, fetchEventMatches, fetchEventTeamCount } from '../api/client'
import { LIVE_REFRESH_MS } from '../config'
import { cycleTimeAttribution } from './cycleTimeAttribution'
import { processMatches, type ProcessedMatches } from '../lib/matchProcessing'
import type { ApiV3Event, ApiV3Match } from '../api/types'
import { useLiveRefresh } from './useLiveRefresh'

export function isLiveEvent(event: ApiV3Event | null | undefined): boolean {
  if (!event) return false
  const today = new Date().toISOString().slice(0, 10)
  return event.startDate <= today && event.endDate >= today
}

/** Loads an event's info + matches, reprocessing on every param change (or when
 *  the cycle-time attribution setting is toggled — no refetch needed for that),
 *  and polls for fresh match data while the event is in progress. */
export function useEventRows(cmpYear: Ref<number>, eventCode: Ref<string>) {
  const event = ref<ApiV3Event | null>(null)
  const teamCount = ref(0)
  const rawMatches = ref<ApiV3Match[] | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const processed = computed<ProcessedMatches | null>(() =>
    rawMatches.value ? processMatches(rawMatches.value, cycleTimeAttribution.value) : null,
  )

  const { start, stop } = useLiveRefresh(async () => {
    const matches = await fetchEventMatches(cmpYear.value, eventCode.value, true)
    if (matches) rawMatches.value = matches
  }, LIVE_REFRESH_MS)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    stop()
    try {
      const [evt, matches, teams] = await Promise.all([
        fetchEventInfo(cmpYear.value, eventCode.value),
        fetchEventMatches(cmpYear.value, eventCode.value),
        fetchEventTeamCount(cmpYear.value, eventCode.value),
      ])
      event.value = evt
      teamCount.value = teams
      if (!matches) throw new Error('Could not load match data for this event')
      rawMatches.value = matches
      if (isLiveEvent(evt)) start()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  watch([cmpYear, eventCode], load, { immediate: true })

  return { event, teamCount, processed, loading, error }
}
