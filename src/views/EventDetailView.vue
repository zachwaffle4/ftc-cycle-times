<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DistributionChart from '../components/DistributionChart.vue'
import FieldBreakdownTable from '../components/FieldBreakdownTable.vue'
import MatchTable from '../components/MatchTable.vue'
import NextUpCard from '../components/NextUpCard.vue'
import ScheduleDeltaBarChart from '../components/ScheduleDeltaBarChart.vue'
import ScheduleDeltaLineChart from '../components/ScheduleDeltaLineChart.vue'
import StatsGrid from '../components/StatsGrid.vue'
import { fetchEventInfo } from '../api/client'
import type { ApiV3Event } from '../api/types'
import { useEventRows, isLiveEvent } from '../composables/useEventRows'
import { exportEventCsv } from '../lib/csv'
import { cycleTimes, deltas, scheduledCycleTimes, scorePostDelays, scopedRows } from '../lib/stats'

const props = defineProps<{ year: string; code: string }>()
const cmpYear = computed(() => Number(props.year))
const eventCode = computed(() => props.code)

const { event, teamCount, processed, loading, error } = useEventRows(cmpYear, eventCode)

// A multi-division event's own page only holds its combined finals; the divisions
// (where qualification play happens) are separate events not otherwise linked
// from here, so surface them explicitly. Likewise surface a link back up to the
// parent event when viewing a division.
const parentEvent = ref<ApiV3Event | null>(null)
watch(
  () => event.value?.parentEventCode,
  async (parentCode) => {
    parentEvent.value = parentCode ? await fetchEventInfo(cmpYear.value, parentCode) : null
  },
  { immediate: true },
)

const rows = computed(() => processed.value?.rows ?? [])
const qualRows = computed(() => scopedRows(rows.value, 'qual'))
const playoffRows = computed(() => scopedRows(rows.value, 'playoff'))

const qualCts = computed(() => cycleTimes(rows.value, 'qual'))
const qualDeltas = computed(() => deltas(rows.value, 'qual'))
const qualSchedCts = computed(() => scheduledCycleTimes(rows.value, 'qual'))
const qualScorePostDelays = computed(() => scorePostDelays(rows.value, 'qual'))
const qualOutlierCount = computed(() => qualRows.value.filter((r) => r.cycleTime != null && r.isOutlier).length)
const qualMinInfo = computed(() => {
  const candidates = qualRows.value.filter((r) => r.cycleTime != null && !r.isOutlier).sort((a, b) => (a.cycleTime as number) - (b.cycleTime as number))
  return candidates.length ? { match: candidates[0].matchLabel } : null
})

const playoffCts = computed(() => cycleTimes(rows.value, 'playoff'))
const playoffDeltas = computed(() => deltas(rows.value, 'playoff'))
const playoffSchedCts = computed(() => scheduledCycleTimes(rows.value, 'playoff'))
const playoffOutlierCount = computed(() => playoffRows.value.filter((r) => r.cycleTime != null && r.isOutlier).length)
const playoffMinInfo = computed(() => {
  const candidates = playoffRows.value.filter((r) => r.cycleTime != null && !r.isOutlier).sort((a, b) => (a.cycleTime as number) - (b.cycleTime as number))
  return candidates.length ? { match: candidates[0].matchLabel } : null
})
const playoffDeltaChart = computed(() => {
  const withDelta = playoffRows.value.filter((r) => r.delta != null)
  return {
    labels: withDelta.map((r) => r.matchLabel),
    values: withDelta.map((r) => +((r.delta as number) / 60).toFixed(2)),
  }
})

const backHref = computed(() => (event.value ? `/region/${cmpYear.value}/${event.value.regionCode}` : `/home/${cmpYear.value}`))
const live = computed(() => isLiveEvent(event.value))

function onExport(): void {
  exportEventCsv(eventCode.value, rows.value)
}
</script>

<template>
  <div>
    <router-link :to="backHref" class="back-btn">← Back</router-link>

    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="error" class="error">Error: {{ error }}</div>
    <template v-else-if="event">
      <div class="card">
        <div class="event-header-info" style="margin-bottom: 16px">
          <div style="font-size: 1.1rem; font-weight: 600">
            {{ event.name }}
            <span v-if="live" class="status-live" style="font-size: 0.75rem; padding: 2px 7px; border-radius: 4px; vertical-align: middle">● Live</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--muted); margin-top: 2px">
            {{ [event.city, event.state, event.country].filter(Boolean).join(', ') }}
            · {{ event.startDate }}
            <template v-if="teamCount">· {{ teamCount }} teams</template>
            · {{ event.regionCode }}
          </div>
          <div v-if="parentEvent" style="font-size: 0.85rem; margin-top: 6px">
            ↑ Part of
            <router-link :to="`/event/${year}/${parentEvent.code}`">{{ parentEvent.name }}</router-link>
          </div>
          <div v-if="event.divisions?.length" style="font-size: 0.85rem; margin-top: 6px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap">
            Divisions:
            <router-link
              v-for="d in event.divisions"
              :key="d.eventCode"
              :to="`/event/${year}/${d.eventCode}`"
              class="btn-ghost"
            >
              {{ d.name }}
            </router-link>
          </div>
        </div>
        <h2>Cycle Time Statistics (Qual)</h2>
        <StatsGrid :cts="qualCts" :deltas="qualDeltas" :sched-cts="qualSchedCts" :min-info="qualMinInfo" :outlier-count="qualOutlierCount" :matches-per-team="processed?.matchesPerTeam" :score-post-delays="qualScorePostDelays" />
      </div>

      <NextUpCard :qual-rows="qualRows" :timezone="event.timezone" />

      <div class="charts-grid">
        <div class="card">
          <h2>Distribution</h2>
          <DistributionChart :cycle-times="qualCts" />
        </div>
        <div class="card">
          <h2>Ahead / Behind Schedule</h2>
          <ScheduleDeltaLineChart :rows="qualRows" />
        </div>
      </div>

      <FieldBreakdownTable :rows="qualRows" />

      <div v-if="playoffRows.length" class="card">
        <h2>Playoff Statistics</h2>
        <StatsGrid :cts="playoffCts" :deltas="playoffDeltas" :sched-cts="playoffSchedCts" :min-info="playoffMinInfo" :outlier-count="playoffOutlierCount" />
        <div class="charts-grid" style="margin-top: 14px">
          <div class="card">
            <h2>Playoff Cycle Time Distribution</h2>
            <DistributionChart :cycle-times="playoffCts" />
          </div>
          <div class="card">
            <h2>Playoff Ahead / Behind</h2>
            <ScheduleDeltaBarChart :labels="playoffDeltaChart.labels" :values="playoffDeltaChart.values" />
          </div>
        </div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
          <h2 style="margin-bottom: 0">Match Log</h2>
          <button class="btn-ghost" @click="onExport">⬇ Export CSV</button>
        </div>
        <MatchTable :rows="rows" :timezone="event.timezone" />
      </div>
    </template>
  </div>
</template>
