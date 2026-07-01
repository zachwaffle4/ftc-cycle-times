<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AggregateEventTable from '../components/AggregateEventTable.vue'
import DistributionChart from '../components/DistributionChart.vue'
import ScheduleDeltaBarChart from '../components/ScheduleDeltaBarChart.vue'
import StatsGrid from '../components/StatsGrid.vue'
import { fetchSeasonEvents } from '../api/client'
import type { ApiV3Event } from '../api/types'
import { useAggregateStats } from '../composables/useAggregateStats'
import { exportAggCsv } from '../lib/csv'
import { deltas, mean } from '../lib/stats'

const props = defineProps<{ year: string; month: string }>()
const cmpYear = computed(() => Number(props.year))
const monthNum = computed(() => Number(props.month))
const monthLabel = computed(() =>
  new Date(2000, monthNum.value - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
)

const allEvents = ref<ApiV3Event[]>([])
const loadingEvents = ref(true)
const eventsError = ref<string | null>(null)

async function loadEvents(): Promise<void> {
  loadingEvents.value = true
  eventsError.value = null
  try {
    allEvents.value = await fetchSeasonEvents(cmpYear.value)
  } catch (e) {
    eventsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingEvents.value = false
  }
}
watch(cmpYear, loadEvents, { immediate: true })
onMounted(loadEvents)

const monthEvents = computed(() => allEvents.value.filter((e) => Number(e.startDate.slice(5, 7)) === monthNum.value))

const { entries, includedEntries, excluded, toggleExclude, toggleAll, pooled, loading, progress } = useAggregateStats(
  cmpYear,
  monthEvents,
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
  exportAggCsv(`${cmpYear.value}_${monthLabel.value.toLowerCase()}`, includedEntries.value)
}
</script>

<template>
  <div>
    <router-link :to="`/home/${year}`" class="back-btn">← All Events</router-link>
    <div class="page-title">{{ monthLabel }} {{ year }}</div>
    <p class="page-sub">All events starting in {{ monthLabel }}</p>

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
