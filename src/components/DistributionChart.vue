<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import '../lib/chartSetup'
import { BUCKET_SEC } from '../config'
import { fmtDur } from '../lib/format'

const props = defineProps<{ cycleTimes: number[] }>()

const chartData = computed(() => {
  const buckets = new Map<number, number>()
  for (const ct of props.cycleTimes) {
    const b = Math.floor(ct / BUCKET_SEC) * BUCKET_SEC
    buckets.set(b, (buckets.get(b) ?? 0) + 1)
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b)
  const labels: string[] = []
  const data: number[] = []
  if (keys.length) {
    for (let b = keys[0]; b <= keys[keys.length - 1]; b += BUCKET_SEC) {
      labels.push(fmtDur(b))
      data.push(buckets.get(b) ?? 0)
    }
  }
  return {
    labels,
    datasets: [{ data, backgroundColor: '#3b82f6b3', borderColor: '#3b82f6', borderWidth: 1 }],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { title: { display: true, text: 'Cycle Time (m:ss)' }, grid: { color: '#88888822' } },
    y: { title: { display: true, text: 'Matches' }, beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#88888822' } },
  },
}
</script>

<template>
  <div class="chart-wrap">
    <Bar v-if="cycleTimes.length" :data="chartData" :options="chartOptions" />
    <p v-else style="color: var(--muted); font-size: 0.875rem">No cycle time data available yet.</p>
  </div>
</template>
