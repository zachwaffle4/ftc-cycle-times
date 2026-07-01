<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BREAK_GAP } from '../config'
import { fmtDeltaObj, fmtDur, fmtTime } from '../lib/format'
import type { MatchRow } from '../lib/matchProcessing'
import { cycleTimes, mean } from '../lib/stats'
import StatCard from './StatCard.vue'

const props = defineProps<{ qualRows: MatchRow[]; timezone?: string }>()

const nowSec = ref(Math.floor(Date.now() / 1000))
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    nowSec.value = Math.floor(Date.now() / 1000)
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer != null) clearInterval(timer)
})

const lastPlayed = computed(() => [...props.qualRows].reverse().find((r) => r.actual != null) ?? null)
const nextUp = computed(() => {
  const lp = lastPlayed.value
  if (!lp) return null
  return props.qualRows.find((r) => r.actual == null && r.matchNum > lp.matchNum) ?? null
})

const visible = computed(() => {
  const lp = lastPlayed.value
  const nu = nextUp.value
  if (!lp || !nu || nu.scheduled == null || lp.scheduled == null) return false
  return nu.scheduled - lp.scheduled < BREAK_GAP
})

const schedCT = computed(() => {
  const nu = nextUp.value
  if (!nu) return null
  if (nu.scheduledCT != null) return nu.scheduledCT
  const avg = mean(cycleTimes(props.qualRows, 'qual'))
  return avg || null
})

const expectedStart = computed(() => {
  const lp = lastPlayed.value
  const nu = nextUp.value
  if (!lp?.actual || !nu?.scheduled) return null
  return Math.max(nu.scheduled, lp.actual + (schedCT.value ?? 0))
})

const elapsed = computed(() => (lastPlayed.value?.actual != null ? nowSec.value - lastPlayed.value.actual : null))
const countdown = computed(() => (expectedStart.value != null ? expectedStart.value - nowSec.value : null))

const lastDeltaFmt = computed(() => fmtDeltaObj(lastPlayed.value?.delta))
const lastDeltaLabel = computed(() => {
  const d = lastPlayed.value?.delta ?? 0
  if (d > 60) return 'Ahead'
  if (d >= -60) return 'On Time'
  return 'Behind'
})
const prevCtSub = computed(() =>
  lastPlayed.value?.cycleTime != null ? `prev CT ${fmtDur(lastPlayed.value.cycleTime)}` : null,
)
</script>

<template>
  <div v-if="visible" class="card">
    <h2 style="margin-bottom: 10px"><span class="live-dot" style="margin-right: 6px"></span>Next Up</h2>
    <div class="stats-grid">
      <StatCard
        :value="`${nextUp!.matchLabel}`"
        label="Next Match"
        :sub="`exp. ${fmtTime(expectedStart, timezone)}`"
      />
      <StatCard :value="lastDeltaFmt.text" :label="lastDeltaLabel" :cls="lastDeltaFmt.cls" :sub="prevCtSub" />
      <StatCard
        :value="`<span class=&quot;live-dot&quot; style=&quot;margin-right:4px&quot;></span>${fmtDur(elapsed)}`"
        label="Current CT"
        :sub="schedCT != null ? `sched ${fmtDur(schedCT)}` : null"
      />
      <StatCard
        :value="countdown != null && countdown >= 0 ? fmtDur(countdown) : '—'"
        label="Countdown"
        :sub="countdown != null && countdown >= 0 ? 'to expected start' : 'Passed'"
      />
    </div>
  </div>
</template>
