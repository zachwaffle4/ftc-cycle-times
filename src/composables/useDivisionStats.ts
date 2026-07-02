import { computed, ref, watch, type Ref } from 'vue'
import { fetchEventMatches } from '../api/client'
import type { ApiV3Division, ApiV3Match } from '../api/types'
import { cycleTimeAttribution } from './cycleTimeAttribution'
import { processMatches, type MatchRow } from '../lib/matchProcessing'
import { scopedRows } from '../lib/stats'

export interface DivisionData {
  code: string
  name: string
  qualRows: MatchRow[]
}

interface DivisionRaw {
  code: string
  name: string
  matches: ApiV3Match[] | null
}

/** Fetches + processes qual match data for each of a multi-division event's
 *  divisions, so a "By Division" breakdown can be shown on the parent event's
 *  page (the parent's own matches endpoint only holds combined finals). */
export function useDivisionStats(cmpYear: Ref<number>, divisions: Ref<ApiV3Division[]>) {
  const rawByDivision = ref<DivisionRaw[]>([])
  const loading = ref(false)

  const divisionData = computed<DivisionData[]>(() =>
    rawByDivision.value.map((d) => ({
      code: d.code,
      name: d.name,
      qualRows: d.matches ? scopedRows(processMatches(d.matches, cycleTimeAttribution.value).rows, 'qual') : [],
    })),
  )

  async function load(): Promise<void> {
    if (!divisions.value.length) {
      rawByDivision.value = []
      return
    }
    loading.value = true
    try {
      rawByDivision.value = await Promise.all(
        divisions.value.map(async (d) => ({
          code: d.eventCode,
          name: d.name,
          matches: await fetchEventMatches(cmpYear.value, d.eventCode),
        })),
      )
    } finally {
      loading.value = false
    }
  }

  watch([cmpYear, divisions], load, { immediate: true })

  return { divisionData, loading }
}
