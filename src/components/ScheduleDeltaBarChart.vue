<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import type { TooltipItem } from 'chart.js'
import '../lib/chartSetup'
import { schedDeltaColor } from '../lib/format'

const props = withDefaults(
  defineProps<{
    labels: string[]
    /** Delta values in minutes; positive = ahead, negative = behind. */
    values: (number | null)[]
    horizontal?: boolean
    tooltipSuffix?: string
  }>(),
  { horizontal: false, tooltipSuffix: 'avg' },
)

const chartData = computed(() => {
  const colors = props.values.map((d) => (d == null ? '#88888866' : schedDeltaColor(d, 'b3')))
  return {
    labels: props.labels,
    datasets: [
      {
        data: props.values,
        backgroundColor: colors,
        borderColor: colors.map((c) => c.replace('b3', '')),
        borderWidth: 1,
      },
    ],
  }
})

const chartOptions = computed(() => ({
  indexAxis: props.horizontal ? ('y' as const) : ('x' as const),
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (item: TooltipItem<'bar'>) =>
          item.raw == null ? 'No data' : ((item.raw as number) >= 0 ? '+' : '') + (item.raw as number).toFixed(2) + ` min ${props.tooltipSuffix}`,
      },
    },
  },
  scales: props.horizontal
    ? {
        x: { title: { display: true, text: '+ ahead  /  − behind (min)' }, grid: { color: '#88888822' } },
        y: { ticks: { font: { size: 11 } }, grid: { display: false } },
      }
    : {
        x: { grid: { display: false } },
        y: { title: { display: true, text: '+ ahead  /  − behind (min)' }, grid: { color: '#88888822' } },
      },
}))
</script>

<template>
  <div class="chart-wrap" :style="horizontal ? { height: Math.max(220, labels.length * 28 + 40) + 'px' } : undefined">
    <Bar v-if="labels.length" :data="chartData" :options="chartOptions" />
    <p v-else style="color: var(--muted); font-size: 0.875rem">No data available yet.</p>
  </div>
</template>
