<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AggregateEventTable from '../components/AggregateEventTable.vue'
import CtByMonthChart from '../components/CtByMonthChart.vue'
import DistributionChart from '../components/DistributionChart.vue'
import LeagueBreakdownTable from '../components/LeagueBreakdownTable.vue'
import ScheduleDeltaBarChart from '../components/ScheduleDeltaBarChart.vue'
import StatsGrid from '../components/StatsGrid.vue'
import { fetchRegionLeagues, fetchRegions, fetchSeasonEvents } from '../api/client'
import type { ApiV3Event, ApiV3League } from '../api/types'
import { useAggregateStats } from '../composables/useAggregateStats'
import { exportAggCsv } from '../lib/csv'
import { buildLeagueNameMap } from '../lib/leagueNames'
import { buildMonthlySeries } from '../lib/monthlySeries'

const props = defineProps<{ year: string; regionCode: string }>()
const cmpYear = computed(() => Number(props.year))

const regionName = ref(props.regionCode)
const allEvents = ref<ApiV3Event[]>([])
const leagues = ref<ApiV3League[]>([])
const loadingEvents = ref(true)
const eventsError = ref<string | null>(null)

async function loadEvents(): Promise<void> {
  loadingEvents.value = true
  eventsError.value = null
  try {
    const [regions, leagueList, events] = await Promise.all([
      fetchRegions(cmpYear.value),
      fetchRegionLeagues(cmpYear.value, props.regionCode),
      fetchSeasonEvents(cmpYear.value),
    ])
    regionName.value = regions.find((r) => r.code === props.regionCode)?.name ?? props.regionCode
    leagues.value = leagueList
    allEvents.value = events.filter((e) => e.regionCode === props.regionCode)
  } catch (e) {
    eventsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingEvents.value = false
  }
}
watch([cmpYear, () => props.regionCode], loadEvents, { immediate: true })
onMounted(loadEvents)

const { entries, includedEntries, excluded, toggleExclude, toggleAll, pooled, loading, progress } = useAggregateStats(
  cmpYear,
  allEvents,
)

const qual = computed(() => pooled('qual'))
const totalMatches = computed(() =>
  includedEntries.value.reduce((s, e) => s + (e.rows ?? []).filter((r) => r.phase === 'qual' && r.actual != null).length, 0),
)

const tableEntries = computed(() =>
  entries.value.map((e) => ({
    event: e.event,
    rows: e.rows,
    teamCount: e.teamCount,
    matchesPerTeam: e.matchesPerTeam,
    eventHref: `/event/${cmpYear.value}/${e.event.code}`,
  })),
)

const monthly = computed(() => buildMonthlySeries(includedEntries.value))
const leagueNames = computed(() => buildLeagueNameMap(leagues.value, allEvents.value))

function onExport(): void {
  exportAggCsv(`${props.regionCode}_season`.toLowerCase(), includedEntries.value)
}
</script>

<template>
  <div>
    <router-link :to="`/region/${year}/${regionCode}`" class="back-btn">← {{ regionCode }} Events</router-link>
    <div class="page-title">{{ regionName }} – {{ year }} Season</div>
    <p class="page-sub">All region events{{ totalMatches ? ` · ${totalMatches.toLocaleString()} matches played` : '' }}</p>

    <div v-if="loadingEvents || loading" class="loading">Loading region events… ({{ progress.done }}/{{ progress.total }})</div>
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
          <h2>Avg Δ Schedule by Month</h2>
          <ScheduleDeltaBarChart :labels="monthly.labels" :values="monthly.deltaData" />
        </div>
      </div>
      <div class="card">
        <h2>Cycle Time by Month</h2>
        <CtByMonthChart :labels="monthly.labels" :actual-data="monthly.actualData" :median-data="monthly.medianData" :sched-data="monthly.schedData" />
      </div>
      <LeagueBreakdownTable :entries="includedEntries" :league-names="leagueNames" :year="cmpYear" :region-code="regionCode" />
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
