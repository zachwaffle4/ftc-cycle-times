<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AggregateEntry } from '../composables/useAggregateStats'
import { fmtDeltaObj, fmtDur } from '../lib/format'
import { cycleTimes, deltas, mean, median, stddev } from '../lib/stats'

const props = defineProps<{
  entries: AggregateEntry[]
  leagueNames: Map<string, string>
  year: number
  regionCode: string
}>()

interface LeagueRow {
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

const leagueRows = computed<LeagueRow[]>(() => {
  const byLeague = new Map<string, AggregateEntry[]>()
  for (const e of props.entries) {
    const code = e.event.leagueCode
    if (!code) continue
    if (!byLeague.has(code)) byLeague.set(code, [])
    byLeague.get(code)!.push(e)
  }

  const rows: LeagueRow[] = []
  for (const [code, group] of byLeague) {
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
      name: props.leagueNames.get(code) ?? code,
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
  { label: 'League', sortable: true },
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

function sortVal(l: LeagueRow, col: number): string | number {
  switch (col) {
    case 0:
      return l.name
    case 1:
      return l.eventCount
    case 2:
      return l.matchesPlayed
    case 3:
      return l.meanCt ?? Infinity
    case 4:
      return l.medianCt ?? Infinity
    case 5:
      return l.stdDevCt ?? Infinity
    case 6:
      return l.avgDelta ?? Infinity
    default:
      return 0
  }
}

const sortedRows = computed(() => {
  const rows = [...leagueRows.value]
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
  <div v-if="leagueRows.length" class="card">
    <h2>By League</h2>
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
          <tr v-for="l in sortedRows" :key="l.code">
            <td><strong>{{ l.name }}</strong></td>
            <td class="muted-cell">{{ l.eventCount }}</td>
            <td class="muted-cell">
              {{ l.matchesPlayed }}
              <span v-if="l.outlierCount" style="font-size: 0.78rem">({{ l.outlierCount }} outlier{{ l.outlierCount === 1 ? '' : 's' }})</span>
            </td>
            <td>{{ fmtDur(l.meanCt) }}</td>
            <td>{{ fmtDur(l.medianCt) }}</td>
            <td class="muted-cell">{{ fmtDur(l.stdDevCt) }}</td>
            <td :class="l.avgDelta != null ? fmtDeltaObj(l.avgDelta).cls : ''">{{ fmtDeltaObj(l.avgDelta).text }}</td>
            <td>
              <router-link :to="`/league/${year}/${regionCode}/${l.code}`" class="btn-ghost">View →</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
