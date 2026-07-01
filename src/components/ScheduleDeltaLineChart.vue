<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import type { TooltipItem } from 'chart.js'
import '../lib/chartSetup'
import { schedDeltaColor } from '../lib/format'
import type { MatchRow } from '../lib/matchProcessing'

const props = defineProps<{ rows: MatchRow[] }>()

const built = computed(() => {
  const schedRows = props.rows.filter((r) => r.delta != null)
  const replayNums = new Set(props.rows.filter((r) => r.isReplay).map((r) => r.matchNum))

  const values: (number | null)[] = []
  const labels: (number | null)[] = []
  const ptColors: string[] = []
  const breakNullIdxs: number[] = []
  const replayGaps: { idx: number; label: string }[] = []

  for (let i = 0; i < schedRows.length; i++) {
    const row = schedRows[i]
    if (i > 0 && row.isPostBreak) {
      const gapNums: string[] = []
      for (let mn = schedRows[i - 1].matchNum + 1; mn < row.matchNum; mn++) {
        if (replayNums.has(mn)) gapNums.push(`Q${mn}`)
      }
      if (gapNums.length) {
        replayGaps.push({ idx: values.length, label: `— ${gapNums.join(', ')} replay gap —` })
      } else {
        breakNullIdxs.push(values.length)
        values.push(null)
        labels.push(null)
        ptColors.push('transparent')
      }
    } else if (i > 0) {
      const gapNums: string[] = []
      for (let mn = schedRows[i - 1].matchNum + 1; mn < row.matchNum; mn++) {
        if (replayNums.has(mn)) gapNums.push(`Q${mn}`)
      }
      if (gapNums.length) {
        replayGaps.push({ idx: values.length, label: `— ${gapNums.join(', ')} replay gap —` })
      }
    }
    const d = +((row.delta as number) / 60).toFixed(2)
    values.push(d)
    labels.push(row.matchNum)
    ptColors.push(schedDeltaColor(d))
  }

  return { values, labels, ptColors, breakNullIdxs, replayGaps }
})

const chartData = computed(() => ({
  labels: built.value.labels,
  datasets: [
    {
      data: built.value.values.map((v) => (v === null ? null : 0)),
      borderColor: '#88888866',
      borderDash: [4, 4],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      tension: 0,
      spanGaps: false,
    },
    {
      label: 'Δ Schedule',
      data: built.value.values,
      borderColor: '#3b82f6',
      backgroundColor: '#3b82f618',
      fill: true,
      tension: 0.2,
      pointRadius: 3,
      pointBackgroundColor: built.value.ptColors,
      pointBorderColor: built.value.ptColors,
      spanGaps: false,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    verticalBreaks: { indices: built.value.breakNullIdxs, replayGaps: built.value.replayGaps },
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: TooltipItem<'line'>[]) => (items[0]?.label != null ? 'Match ' + items[0].label : undefined),
        label: (item: TooltipItem<'line'>) =>
          item.datasetIndex === 0 || item.raw == null
            ? undefined
            : ((item.raw as number) >= 0 ? '+' : '') + (item.raw as number).toFixed(2) + ' min ' + ((item.raw as number) >= 0 ? 'ahead' : 'behind'),
      },
      filter: (item: TooltipItem<'line'>) => item.datasetIndex === 1 && item.raw != null,
    },
  },
  scales: {
    x: { title: { display: true, text: 'Match #' }, grid: { color: '#88888822' } },
    y: {
      title: { display: true, text: '+ ahead  /  − behind (min)' },
      grid: { color: (c: { tick: { value: number } }) => (c.tick.value === 0 ? '#88888888' : '#88888822') },
    },
  },
}))
</script>

<template>
  <div class="chart-wrap">
    <Line v-if="built.values.length" :data="chartData" :options="chartOptions" />
    <p v-else style="color: var(--muted); font-size: 0.875rem">No schedule data available yet.</p>
  </div>
</template>
