<script setup lang="ts">
import { computed } from 'vue'
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
  cts: number[]
  ds: number[]
  outlierCount: number
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
      cts,
      ds,
      outlierCount,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
})
</script>

<template>
  <div v-if="leagueRows.length" class="card">
    <h2>By League</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>League</th>
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
          <tr v-for="l in leagueRows" :key="l.code">
            <td><strong>{{ l.name }}</strong></td>
            <td class="muted-cell">{{ l.eventCount }}</td>
            <td class="muted-cell">
              {{ l.matchesPlayed }}
              <span v-if="l.outlierCount" style="font-size: 0.78rem">({{ l.outlierCount }} outlier{{ l.outlierCount === 1 ? '' : 's' }})</span>
            </td>
            <td>{{ l.cts.length ? fmtDur(mean(l.cts)) : '—' }}</td>
            <td>{{ l.cts.length ? fmtDur(median(l.cts)) : '—' }}</td>
            <td class="muted-cell">{{ l.cts.length >= 2 ? fmtDur(stddev(l.cts)) : '—' }}</td>
            <td :class="l.ds.length ? fmtDeltaObj(mean(l.ds)).cls : ''">{{ l.ds.length ? fmtDeltaObj(mean(l.ds)).text : '—' }}</td>
            <td>
              <router-link :to="`/league/${year}/${regionCode}/${l.code}`" class="btn-ghost">View →</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
