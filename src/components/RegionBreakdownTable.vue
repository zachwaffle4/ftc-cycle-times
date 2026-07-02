<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AggregateEntry } from '../composables/useAggregateStats'
import { fmtDeltaObj, fmtDur } from '../lib/format'
import { cycleTimes, deltas, mean, median, stddev } from '../lib/stats'

const props = defineProps<{
  entries: AggregateEntry[]
  regionNames: Map<string, string>
  year: number
}>()

interface RegionRow {
  code: string
  name: string
  eventCount: number
  matchesPlayed: number
  outlierCount: number
  meanCt: number | null
  medianCt: number | null
  stdDevCt: number | null
  avgDelta: number | null
}

const regionRows = computed<RegionRow[]>(() => {
  const byRegion = new Map<string, AggregateEntry[]>()
  for (const e of props.entries) {
    const code = e.event.regionCode
    if (!byRegion.has(code)) byRegion.set(code, [])
    byRegion.get(code)!.push(e)
  }

  const rows: RegionRow[] = []
  for (const [code, group] of byRegion) {
    const cts: number[] = []
    const ds: number[] = []
    let matchesPlayed = 0
    let outlierCount = 0
    for (const e of group) {
      cts.push(...cycleTimes(e.rows, 'qual'))
      ds.push(...deltas(e.rows, 'qual'))
      matchesPlayed += (e.rows ?? []).filter((r) => r.phase === 'qual' && r.actual != null).length
      outlierCount += (e.rows ?? []).filter((r) => r.phase === 'qual' && r.cycleTime != null && r.isOutlier).length
    }
    rows.push({
      code,
      name: props.regionNames.get(code) ?? code,
      eventCount: group.length,
      matchesPlayed,
      outlierCount,
      meanCt: cts.length ? mean(cts) : null,
      medianCt: cts.length ? median(cts) : null,
      stdDevCt: cts.length >= 2 ? stddev(cts) : null,
      avgDelta: ds.length ? mean(ds) : null,
    })
  }
  return rows
})

const cols = [
  { label: 'Region', sortable: true },
  { label: 'Events', sortable: true },
  { label: 'Matches', sortable: true },
  { label: 'Mean CT', sortable: true },
  { label: 'Median CT', sortable: true },
  { label: 'Std Dev', sortable: true },
  { label: 'Avg Δ Schedule', sortable: true },
  { label: '', sortable: false },
]

const sortCol = ref<number | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

function sortVal(r: RegionRow, col: number): string | number {
  switch (col) {
    case 0:
      return r.name
    case 1:
      return r.eventCount
    case 2:
      return r.matchesPlayed
    case 3:
      return r.meanCt ?? Infinity
    case 4:
      return r.medianCt ?? Infinity
    case 5:
      return r.stdDevCt ?? Infinity
    case 6:
      return r.avgDelta ?? Infinity
    default:
      return 0
  }
}

const sortedRows = computed(() => {
  const rows = [...regionRows.value]
  const col = sortCol.value ?? 0
  rows.sort((a, b) => {
    const va = sortVal(a, col)
    const vb = sortVal(b, col)
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return rows
})

function sortBy(col: number): void {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = 'asc'
  }
}
</script>

<template>
  <div v-if="regionRows.length" class="card">
    <h2>By Region</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th
              v-for="(c, ci) in cols"
              :key="ci"
              :class="{ sortable: c.sortable, 'sort-active': sortCol === ci }"
              @click="c.sortable && sortBy(ci)"
            >
              {{ c.label }}
              <i v-if="c.sortable" style="margin-left: 4px; opacity: 0.5; font-style: normal">{{ sortCol === ci ? (sortDir === 'asc' ? '▲' : '▼') : '▲' }}</i>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in sortedRows" :key="r.code">
            <td><strong>{{ r.name }}</strong> <span class="muted-cell">({{ r.code }})</span></td>
            <td class="muted-cell">{{ r.eventCount }}</td>
            <td class="muted-cell">
              {{ r.matchesPlayed }}
              <span v-if="r.outlierCount" style="font-size: 0.78rem">({{ r.outlierCount }} outlier{{ r.outlierCount === 1 ? '' : 's' }})</span>
            </td>
            <td>{{ fmtDur(r.meanCt) }}</td>
            <td>{{ fmtDur(r.medianCt) }}</td>
            <td class="muted-cell">{{ fmtDur(r.stdDevCt) }}</td>
            <td :class="r.avgDelta != null ? fmtDeltaObj(r.avgDelta).cls : ''">{{ fmtDeltaObj(r.avgDelta).text }}</td>
            <td>
              <router-link :to="`/region/${year}/${r.code}`" class="btn-ghost">View →</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
