<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { fetchRegionLeagues, fetchRegions, fetchSeasonEvents } from '../api/client'
import type { ApiV3Event, ApiV3League } from '../api/types'
import { eventStatus } from '../lib/format'

const props = defineProps<{ year: string; regionCode: string }>()
const cmpYear = computed(() => Number(props.year))

const regionName = ref(props.regionCode)
const leagues = ref<ApiV3League[]>([])
const events = ref<ApiV3Event[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const [regions, leagueList, allEvents] = await Promise.all([
      fetchRegions(cmpYear.value),
      fetchRegionLeagues(cmpYear.value, props.regionCode),
      fetchSeasonEvents(cmpYear.value),
    ])
    regionName.value = regions.find((r) => r.code === props.regionCode)?.name ?? props.regionCode
    leagues.value = leagueList
    events.value = allEvents.filter((e) => e.regionCode === props.regionCode)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
watch([cmpYear, () => props.regionCode], load, { immediate: true })
onMounted(load)

const leagueCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const e of events.value) {
    if (e.leagueCode) counts.set(e.leagueCode, (counts.get(e.leagueCode) ?? 0) + 1)
  }
  return counts
})

// The FTC leagues-list endpoint can come back empty even when events reference a
// leagueCode (observed live — likely an API-side issue), so fall back to a
// synthetic league entry (code as name) for any leagueCode the endpoint missed.
// This guarantees every event with a leagueCode is still reachable via a league page.
const sortedLeagues = computed(() => {
  const known = new Map(leagues.value.map((l) => [l.code, l]))
  for (const code of leagueCounts.value.keys()) {
    if (!known.has(code)) known.set(code, { code, name: code })
  }
  return [...known.values()].filter((l) => (leagueCounts.value.get(l.code) ?? 0) > 0).sort((a, b) => a.name.localeCompare(b.name))
})

const nonLeagueEvents = computed(() =>
  [...events.value].filter((e) => !e.leagueCode).sort((a, b) => a.startDate.localeCompare(b.startDate)),
)
</script>

<template>
  <div>
    <router-link :to="`/home/${year}`" class="back-btn">← All Events</router-link>
    <div class="home-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 24px">
      <h1>⏱ {{ regionName }} {{ year }} Cycle Times</h1>
      <router-link :to="`/region/${year}/${regionCode}/overall`" class="btn-primary">📊 Region Overall</router-link>
    </div>

    <div v-if="loading" class="loading">Loading events…</div>
    <div v-else-if="error" class="error">Error: {{ error }}</div>
    <template v-else>
      <div v-if="sortedLeagues.length" class="week-section" style="margin-bottom: 24px">
        <div class="week-header" style="margin-bottom: 10px">
          <span class="week-label" style="font-size: 1.1rem; font-weight: 700">Leagues</span>
        </div>
        <div class="event-list">
          <div v-for="l in sortedLeagues" :key="l.code" class="event-row">
            <div class="event-row-info">
              <span class="event-row-name">{{ l.name }} <span style="color: var(--muted); font-weight: 400">({{ l.code }})</span></span>
              <span class="event-row-loc">{{ leagueCounts.get(l.code) }} event{{ leagueCounts.get(l.code) === 1 ? '' : 's' }}</span>
            </div>
            <div class="event-row-right">
              <router-link :to="`/league/${year}/${regionCode}/${l.code}`" class="btn-ghost">View →</router-link>
            </div>
          </div>
        </div>
      </div>

      <div v-if="nonLeagueEvents.length" class="week-section">
        <div class="week-header" style="margin-bottom: 10px">
          <span class="week-label" style="font-size: 1.1rem; font-weight: 700">Non-League Events</span>
        </div>
        <div class="event-list">
          <div v-for="e in nonLeagueEvents" :key="e.code" class="event-row">
            <div class="event-row-info">
              <span class="event-row-name">{{ e.name }} <span style="color: var(--muted); font-weight: 400">({{ e.code }})</span></span>
              <span class="event-row-loc">{{ [e.city, e.state].filter(Boolean).join(', ') }}</span>
              <div v-if="e.divisions?.length" style="margin-top: 4px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 0.78rem">
                <span style="color: var(--muted)">Divisions:</span>
                <router-link v-for="d in e.divisions" :key="d.eventCode" :to="`/event/${year}/${d.eventCode}`">{{ d.name }}</router-link>
              </div>
            </div>
            <div class="event-row-right">
              <span class="event-status" :class="eventStatus(e.startDate, e.endDate).cls">{{ eventStatus(e.startDate, e.endDate).label }}</span>
              <router-link :to="`/event/${year}/${e.code}`" class="btn-ghost">View →</router-link>
            </div>
          </div>
        </div>
      </div>

      <p v-if="!sortedLeagues.length && !nonLeagueEvents.length" style="color: var(--muted); font-size: 0.875rem">
        No events found for this region yet.
      </p>
    </template>
  </div>
</template>
