<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchRegions, fetchSeasonEvents, fetchSeasons } from '../api/client'
import type { ApiV3Event, ApiV3Region, ApiV3Season } from '../api/types'
import EventTypeahead from '../components/EventTypeahead.vue'

const props = defineProps<{ year: string }>()
const router = useRouter()
const cmpYear = computed(() => Number(props.year))

const seasons = ref<ApiV3Season[]>([])
const regions = ref<ApiV3Region[]>([])
const events = ref<ApiV3Event[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const [seasonList, regionList, eventList] = await Promise.all([
      fetchSeasons(),
      fetchRegions(cmpYear.value),
      fetchSeasonEvents(cmpYear.value),
    ])
    seasons.value = seasonList
    regions.value = regionList
    events.value = eventList
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
watch(cmpYear, load, { immediate: true })
onMounted(load)

const regionCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const e of events.value) counts.set(e.regionCode, (counts.get(e.regionCode) ?? 0) + 1)
  return counts
})

const sortedRegions = computed(() =>
  [...regions.value]
    .filter((r) => (regionCounts.value.get(r.code) ?? 0) > 0)
    .sort((a, b) => (regionCounts.value.get(b.code) ?? 0) - (regionCounts.value.get(a.code) ?? 0) || a.name.localeCompare(b.name)),
)

function onYearChange(e: Event): void {
  const y = (e.target as HTMLSelectElement).value
  router.push(`/home/${y}`)
}

function onEventSelect(code: string): void {
  router.push(`/event/${cmpYear.value}/${code}`)
}
</script>

<template>
  <div>
    <div class="home-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 24px">
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
        <h1>⏱ FTC {{ year }} Cycle Times</h1>
        <select v-if="seasons.length" :value="year" style="height: 34px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text)" @change="onYearChange">
          <option v-for="s in seasons" :key="s.cmpYear" :value="s.cmpYear">{{ s.cmpYear }} ({{ s.gameName }})</option>
        </select>
      </div>
      <router-link :to="`/season/${year}`" class="btn-primary">📊 Season Overview</router-link>
    </div>

    <div class="card" style="margin-bottom: 16px">
      <div class="field" style="flex: 1; min-width: 220px">
        <label>Jump to Event</label>
        <EventTypeahead :events="events" @select="onEventSelect" />
      </div>
    </div>

    <div v-if="loading" class="loading">Loading events…</div>
    <div v-else-if="error" class="error">Error: {{ error }}</div>
    <div v-else class="event-list">
      <div v-for="r in sortedRegions" :key="r.code" class="event-row">
        <div class="event-row-info">
          <span class="event-row-name">{{ r.name }} <span style="color: var(--muted); font-weight: 400">({{ r.code }})</span></span>
          <span class="event-row-loc">{{ regionCounts.get(r.code) }} event{{ regionCounts.get(r.code) === 1 ? '' : 's' }}</span>
        </div>
        <div class="event-row-right">
          <router-link :to="`/region/${year}/${r.code}`" class="btn-ghost">View →</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
