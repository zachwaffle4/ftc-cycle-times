<script setup lang="ts">
import { computed } from 'vue'
import { fmtDeltaObj, fmtDur } from '../lib/format'
import { mean, median, stddev } from '../lib/stats'
import StatCard from './StatCard.vue'

const props = withDefaults(
  defineProps<{
    cts: number[]
    deltas: number[]
    schedCts?: number[]
    minInfo?: { match: string; event?: string } | null
    outlierCount?: number
    matchesPerTeam?: number
    scorePostDelays?: number[]
  }>(),
  { schedCts: () => [], outlierCount: 0, minInfo: null, matchesPerTeam: undefined, scorePostDelays: () => [] },
)

const outlierSub = computed(() =>
  props.outlierCount > 0 ? `(${props.outlierCount} outlier${props.outlierCount === 1 ? '' : 's'} excluded)` : null,
)
const minSub = computed(() =>
  props.minInfo ? (props.minInfo.event ? `${props.minInfo.match} · ${props.minInfo.event}` : props.minInfo.match) : null,
)
const avgDelta = computed(() => (props.deltas.length ? mean(props.deltas) : null))
const avgDeltaDisplay = computed(() => fmtDeltaObj(avgDelta.value))
</script>

<template>
  <div v-if="!cts.length" style="color: var(--muted); font-size: 0.875rem">No timing data yet.</div>
  <div v-else class="stats-grid">
    <StatCard :value="cts.length" label="In Scope Matches" :sub="outlierSub" />
    <StatCard :value="fmtDur(mean(cts))" label="Mean CT" />
    <StatCard :value="fmtDur(median(cts))" label="Median CT" :sub="`σ ${fmtDur(stddev(cts))}`" />
    <StatCard :value="fmtDur(Math.min(...cts))" label="Min CT" :sub="minSub" />
    <StatCard v-if="schedCts.length" :value="fmtDur(mean(schedCts))" label="Avg Scheduled CT" />
    <StatCard v-if="avgDelta != null" :value="avgDeltaDisplay.text" label="Mean Δ Schedule" :cls="avgDeltaDisplay.cls" />
    <StatCard v-if="matchesPerTeam" :value="matchesPerTeam" label="Matches / Team" />
    <StatCard v-if="scorePostDelays.length" :value="fmtDur(mean(scorePostDelays))" label="Avg Score-Post Delay" />
  </div>
</template>
