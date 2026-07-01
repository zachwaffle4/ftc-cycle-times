<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import type { TooltipItem } from 'chart.js'
import '../lib/chartSetup'

const props = defineProps<{
  labels: string[]
  actualData: (number | null)[]
  medianData: (number | null)[]
  schedData: (number | null)[]
}>()

const hasData = computed(() => props.actualData.some((v) => v != null))

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: 'Avg Actual CT',
      data: props.actualData,
      borderColor: '#3b82f6',
      backgroundColor: '#3b82f618',
      pointRadius: 4,
      pointBackgroundColor: '#3b82f6',
      tension: 0.3,
      fill: false,
    },
    {
      label: 'Median Actual CT',
      data: props.medianData,
      borderColor: '#a78bfa',
      backgroundColor: '#a78bfa18',
      pointRadius: 4,
      pointBackgroundColor: '#a78bfa',
      tension: 0.3,
      fill: false,
    },
    {
      label: 'Avg Scheduled CT',
      data: props.schedData,
      borderColor: '#10b981',
      backgroundColor: '#10b98118',
      borderDash: [5, 4],
      pointRadius: 4,
      pointBackgroundColor: '#10b981',
      tension: 0.3,
      fill: false,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, labels: { color: '#cbd5e1', font: { size: 12 } } },
    tooltip: {
      callbacks: {
        label: (item: TooltipItem<'line'>) =>
          `${item.dataset.label}: ${item.raw == null ? '—' : (item.raw as number).toFixed(2) + ' min'}`,
      },
    },
  },
  scales: {
    x: { grid: { color: '#88888822' } },
    y: { title: { display: true, text: 'Minutes' }, beginAtZero: false, grid: { color: '#88888822' } },
  },
}
</script>

<template>
  <div class="chart-wrap">
    <Line v-if="hasData" :data="chartData" :options="chartOptions" />
    <p v-else style="color: var(--muted); font-size: 0.875rem">No cycle time data available yet.</p>
  </div>
</template>
