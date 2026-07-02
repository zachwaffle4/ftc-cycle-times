<script setup lang="ts">
import { computed } from 'vue'
import { fmtDeltaObj, fmtDur } from '../lib/format'
import type { MatchRow } from '../lib/matchProcessing'
import { mean, median, stddev } from '../lib/stats'

const props = defineProps<{ rows: MatchRow[] }>()

interface FieldStats {
  field: number
  cts: number[]
  ds: number[]
  outlierCount: number
}

const byField = computed<FieldStats[]>(() => {
  const fields = new Map<number, FieldStats>()
  for (const r of props.rows) {
    if (!fields.has(r.field)) fields.set(r.field, { field: r.field, cts: [], ds: [], outlierCount: 0 })
    const f = fields.get(r.field)!
    if (r.cycleTime != null) {
      if (r.isOutlier) f.outlierCount++
      else f.cts.push(r.cycleTime)
    }
    if (r.delta != null) f.ds.push(r.delta)
  }
  return [...fields.values()].sort((a, b) => a.field - b.field)
})

const showTable = computed(() => byField.value.length > 1)
</script>

<template>
  <div v-if="showTable" class="card">
    <h2>By Field</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Matches</th>
            <th>Mean CT</th>
            <th>Median CT</th>
            <th>Std Dev</th>
            <th>Avg Δ Schedule</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in byField" :key="f.field">
            <td><strong>Field {{ f.field }}</strong></td>
            <td class="muted-cell">
              {{ f.cts.length }}
              <span v-if="f.outlierCount" style="font-size: 0.78rem">({{ f.outlierCount }} outlier{{ f.outlierCount === 1 ? '' : 's' }})</span>
            </td>
            <td>{{ f.cts.length ? fmtDur(mean(f.cts)) : '—' }}</td>
            <td>{{ f.cts.length ? fmtDur(median(f.cts)) : '—' }}</td>
            <td class="muted-cell">{{ f.cts.length >= 2 ? fmtDur(stddev(f.cts)) : '—' }}</td>
            <td :class="f.ds.length ? fmtDeltaObj(mean(f.ds)).cls : ''">{{ f.ds.length ? fmtDeltaObj(mean(f.ds)).text : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
