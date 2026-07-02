import { ref, watch, type Ref } from 'vue'
import { fetchEventMatches } from '../api/client'
import type { ApiV3Division } from '../api/types'
import { processMatches, type MatchRow } from '../lib/matchProcessing'
import { scopedRows } from '../lib/stats'

export interface DivisionData {
  code: string
  name: string
  qualRows: MatchRow[]
}

/** Fetches + processes qual match data for each of a multi-division event's
 *  divisions, so a "By Division" breakdown can be shown on the parent event's
 *  page (the parent's own matches endpoint only holds combined finals). */
export function useDivisionStats(cmpYear: Ref<number>, divisions: Ref<ApiV3Division[]>) {
  const divisionData = ref<DivisionData[]>([])
  const loading = ref(false)

  async function load(): Promise<void> {
    if (!divisions.value.length) {
      divisionData.value = []
      return
    }
    loading.value = true
    try {
      divisionData.value = await Promise.all(
        divisions.value.map(async (d) => {
          const matches = await fetchEventMatches(cmpYear.value, d.eventCode)
          const rows = matches ? processMatches(matches).rows : []
          return { code: d.eventCode, name: d.name, qualRows: scopedRows(rows, 'qual') }
        }),
      )
    } finally {
      loading.value = false
    }
  }

  watch([cmpYear, divisions], load, { immediate: true })

  return { divisionData, loading }
}
