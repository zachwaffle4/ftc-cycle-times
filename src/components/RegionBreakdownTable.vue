<script setup lang="ts">
import { computed } from 'vue'
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
  cts: number[]
  ds: number[]
  outlierCount: number
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
      cts,
      ds,
      outlierCount,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<template>
  <div v-if="regionRows.length" class="card">
    <h2>By Region</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Region</th>
            <th>Events</th>
            <th>Matches</th>
            <th>Mean CT</th>
            <th>Median CT</th>
            <th>Std Dev</th>
            <th>Avg Δ Schedule</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in regionRows" :key="r.code">
            <td><strong>{{ r.name }}</strong> <span class="muted-cell">({{ r.code }})</span></td>
            <td class="muted-cell">{{ r.eventCount }}</td>
            <td class="muted-cell">
              {{ r.matchesPlayed }}
              <span v-if="r.outlierCount" style="font-size: 0.78rem">({{ r.outlierCount }} outlier{{ r.outlierCount === 1 ? '' : 's' }})</span>
            </td>
            <td>{{ r.cts.length ? fmtDur(mean(r.cts)) : '—' }}</td>
            <td>{{ r.cts.length ? fmtDur(median(r.cts)) : '—' }}</td>
            <td class="muted-cell">{{ r.cts.length >= 2 ? fmtDur(stddev(r.cts)) : '—' }}</td>
            <td :class="r.ds.length ? fmtDeltaObj(mean(r.ds)).cls : ''">{{ r.ds.length ? fmtDeltaObj(mean(r.ds)).text : '—' }}</td>
            <td>
              <router-link :to="`/region/${year}/${r.code}`" class="btn-ghost">View →</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
