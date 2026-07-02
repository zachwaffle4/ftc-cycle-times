<script setup lang="ts">
import { computed, reactive } from 'vue'
import FieldBreakdownTable from './FieldBreakdownTable.vue'
import type { ApiV3Division } from '../api/types'
import { useDivisionStats } from '../composables/useDivisionStats'
import { fmtDeltaObj, fmtDur } from '../lib/format'
import { cycleTimes, deltas, mean, median, stddev } from '../lib/stats'

const props = defineProps<{ cmpYear: number; divisions: ApiV3Division[] }>()

const cmpYear = computed(() => props.cmpYear)
const divisions = computed(() => props.divisions)
const { divisionData, loading } = useDivisionStats(cmpYear, divisions)

const expanded = reactive(new Set<string>())
function toggle(code: string): void {
  if (expanded.has(code)) expanded.delete(code)
  else expanded.add(code)
}

function statsFor(rows: (typeof divisionData.value)[number]['qualRows']) {
  const cts = cycleTimes(rows, 'qual')
  const ds = deltas(rows, 'qual')
  const outlierCount = rows.filter((r) => r.cycleTime != null && r.isOutlier).length
  return { cts, ds, outlierCount }
}

function fieldCount(rows: (typeof divisionData.value)[number]['qualRows']): number {
  return new Set(rows.map((r) => r.field)).size
}
</script>

<template>
  <div v-if="divisions.length" class="card">
    <h2>By Division</h2>
    <div v-if="loading" class="loading">Loading division data…</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Division</th>
            <th>Matches</th>
            <th>Mean CT</th>
            <th>Median CT</th>
            <th>Std Dev</th>
            <th>Avg Δ Schedule</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="d in divisionData" :key="d.code">
            <tr>
              <td>
                <router-link :to="`/event/${cmpYear}/${d.code}`"><strong>{{ d.name }}</strong></router-link>
              </td>
              <td class="muted-cell">
                {{ statsFor(d.qualRows).cts.length }}
                <span v-if="statsFor(d.qualRows).outlierCount" style="font-size: 0.78rem">
                  ({{ statsFor(d.qualRows).outlierCount }} outlier{{ statsFor(d.qualRows).outlierCount === 1 ? '' : 's' }})
                </span>
              </td>
              <td>{{ statsFor(d.qualRows).cts.length ? fmtDur(mean(statsFor(d.qualRows).cts)) : '—' }}</td>
              <td>{{ statsFor(d.qualRows).cts.length ? fmtDur(median(statsFor(d.qualRows).cts)) : '—' }}</td>
              <td class="muted-cell">{{ statsFor(d.qualRows).cts.length >= 2 ? fmtDur(stddev(statsFor(d.qualRows).cts)) : '—' }}</td>
              <td :class="statsFor(d.qualRows).ds.length ? fmtDeltaObj(mean(statsFor(d.qualRows).ds)).cls : ''">
                {{ statsFor(d.qualRows).ds.length ? fmtDeltaObj(mean(statsFor(d.qualRows).ds)).text : '—' }}
              </td>
              <td>
                <button class="btn-ghost" @click="toggle(d.code)">
                  {{ expanded.has(d.code) ? 'Hide Fields ▲' : 'Show Fields ▼' }}
                </button>
              </td>
            </tr>
            <tr v-if="expanded.has(d.code)">
              <td colspan="7" style="background: var(--bg)">
                <FieldBreakdownTable v-if="fieldCount(d.qualRows) > 1" :rows="d.qualRows" />
                <p v-else-if="d.qualRows.length === 0" style="color: var(--muted); font-size: 0.875rem; margin: 8px 0">
                  No qual timing data for this division yet.
                </p>
                <p v-else style="color: var(--muted); font-size: 0.875rem; margin: 8px 0">
                  Only one field used — no per-field breakdown needed.
                </p>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
