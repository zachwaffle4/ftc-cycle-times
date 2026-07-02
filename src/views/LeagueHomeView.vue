<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AggregateEventTable from '../components/AggregateEventTable.vue'
import DistributionChart from '../components/DistributionChart.vue'
import ScheduleDeltaBarChart from '../components/ScheduleDeltaBarChart.vue'
import StatsGrid from '../components/StatsGrid.vue'
import { fetchRegionLeagues, fetchSeasonEvents } from '../api/client'
import type { ApiV3Event } from '../api/types'
import { useAggregateStats } from '../composables/useAggregateStats'
import { exportAggCsv } from '../lib/csv'
import { deriveLeagueName } from '../lib/leagueNames'
import { deltas, mean } from '../lib/stats'

const props = defineProps<{ year: string; regionCode: string; leagueCode: string }>()
const cmpYear = computed(() => Number(props.year))

const leagueName = ref(props.leagueCode)
const allEvents = ref<ApiV3Event[]>([])
const loadingEvents = ref(true)
const eventsError = ref<string | null>(null)

async function loadEvents(): Promise<void> {
  loadingEvents.value = true
  eventsError.value = null
  try {
    const [leagues, events] = await Promise.all([
      fetchRegionLeagues(cmpYear.value, props.regionCode),
      fetchSeasonEvents(cmpYear.value),
    ])
    allEvents.value = events
      .filter((e) => e.regionCode === props.regionCode && e.leagueCode === props.leagueCode)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    // See deriveLeagueName: the leagues-list endpoint is currently broken live,
    // so fall back to deriving a name from this league's own events.
    leagueName.value =
      leagues.find((l) => l.code === props.leagueCode)?.name ?? deriveLeagueName(props.leagueCode, allEvents.value)
  } catch (e) {
    eventsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingEvents.value = false
  }
}
watch([cmpYear, () => props.regionCode, () => props.leagueCode], loadEvents, { immediate: true })
onMounted(loadEvents)

const { entries, includedEntries, excluded, toggleExclude, toggleAll, pooled, loading, progress } = useAggregateStats(
  cmpYear,
  allEvents,
)

const qual = computed(() => pooled('qual'))

const tableEntries = computed(() =>
  entries.value.map((e) => ({
    event: e.event,
    rows: e.rows,
    teamCount: e.teamCount,
    matchesPerTeam: e.matchesPerTeam,
    eventHref: `/event/${cmpYear.value}/${e.event.code}`,
  })),
)

const perEventDelta = computed(() => {
  const withData = includedEntries.value.filter((e) => deltas(e.rows, 'qual').length)
  return {
    labels: withData.map((e) => e.event.name.slice(0, 28)),
    values: withData.map((e) => +(mean(deltas(e.rows, 'qual')) / 60).toFixed(2)),
  }
})

function onExport(): void {
  exportAggCsv(`${props.regionCode}_${props.leagueCode}`.toLowerCase(), includedEntries.value)
}
</script>

<template>
  <div>
    <router-link :to="`/region/${year}/${regionCode}`" class="back-btn">← {{ regionCode }} Events</router-link>
    <div class="page-title">{{ leagueName }}</div>
    <p class="page-sub">League meets & tournament</p>

    <div v-if="loadingEvents || loading" class="loading">Loading events… ({{ progress.done }}/{{ progress.total }})</div>
    <div v-else-if="eventsError" class="error">Error: {{ eventsError }}</div>
    <template v-else>
      <div class="card">
        <h2>Cycle Time Statistics (Qual)</h2>
        <StatsGrid :cts="qual.cts" :deltas="qual.ds" :sched-cts="qual.schedCts" :outlier-count="qual.outlierCount" />
      </div>
      <div class="charts-grid">
        <div class="card">
          <h2>Distribution</h2>
          <DistributionChart :cycle-times="qual.cts" />
        </div>
        <div class="card">
          <h2>Avg Δ Schedule by Event</h2>
          <ScheduleDeltaBarChart :labels="perEventDelta.labels" :values="perEventDelta.values" horizontal />
        </div>
      </div>
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
          <h2 style="margin-bottom: 0">By Event</h2>
          <button class="btn-ghost" @click="onExport">⬇ Export CSV</button>
        </div>
        <AggregateEventTable :entries="tableEntries" :excluded="excluded" @toggle-exclude="toggleExclude" @toggle-all="toggleAll" />
      </div>
    </template>
  </div>
</template>
