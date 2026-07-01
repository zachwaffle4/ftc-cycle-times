<script setup lang="ts">
import { computed, ref } from 'vue'
import { fmtDeltaObj, fmtDur } from '../lib/format'
import type { MatchRow } from '../lib/matchProcessing'
import { cycleTimes, deltas, mean, median, scheduledCycleTimes, stddev } from '../lib/stats'
import type { ApiV3Event } from '../api/types'

export interface AggTableEntry {
  event: ApiV3Event
  rows: MatchRow[] | undefined
  teamCount?: number
  matchesPerTeam?: number
  eventHref: string
}

const props = defineProps<{ entries: AggTableEntry[]; excluded: Set<number> }>()
const emit = defineEmits<{ (e: 'toggle-exclude', idx: number): void; (e: 'toggle-all', checked: boolean): void }>()

const cols = [
  { label: '', sortable: false },
  { label: 'Region', sortable: true },
  { label: 'Event', sortable: true },
  { label: 'Location', sortable: true },
  { label: 'Matches', sortable: true },
  { label: 'Teams', sortable: true },
  { label: 'Matches/Team', sortable: true },
  { label: 'Avg Sched CT', sortable: true },
  { label: 'Mean CT', sortable: true },
  { label: 'Median CT', sortable: true },
  { label: 'Std Dev', sortable: true },
  { label: 'Avg Δ Sched', sortable: true },
]

const sortCol = ref<number | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

function played(rows: MatchRow[] | undefined): number {
  return (rows ?? []).filter((r) => r.phase === 'qual' && r.actual != null).length
}

function sortVal(e: AggTableEntry, col: number): string | number {
  switch (col) {
    case 1:
      return e.event.regionCode
    case 2:
      return e.event.name
    case 3:
      return [e.event.city, e.event.state].filter(Boolean).join(', ')
    case 4:
      return played(e.rows)
    case 5:
      return e.teamCount ?? 0
    case 6:
      return e.matchesPerTeam ?? 0
    case 7: {
      const s = scheduledCycleTimes(e.rows, 'qual')
      return s.length ? mean(s) : Infinity
    }
    case 8: {
      const c = cycleTimes(e.rows, 'qual')
      return c.length ? mean(c) : Infinity
    }
    case 9: {
      const c = cycleTimes(e.rows, 'qual')
      return c.length ? median(c) : Infinity
    }
    case 10: {
      const c = cycleTimes(e.rows, 'qual')
      return c.length ? stddev(c) : Infinity
    }
    case 11: {
      const d = deltas(e.rows, 'qual')
      return d.length ? mean(d) : Infinity
    }
    default:
      return 0
  }
}

const sortedIndices = computed(() => {
  const indices = props.entries.map((_, i) => i)
  if (sortCol.value == null) return indices
  const hasPlayed = (i: number) => played(props.entries[i].rows) > 0
  indices.sort((a, b) => {
    const ap = hasPlayed(a)
    const bp = hasPlayed(b)
    if (!ap && bp) return 1
    if (ap && !bp) return -1
    const va = sortVal(props.entries[a], sortCol.value as number)
    const vb = sortVal(props.entries[b], sortCol.value as number)
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return indices
})

function sortBy(col: number): void {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = 'asc'
  }
}

const allChecked = computed(() => props.entries.length > 0 && props.entries.every((_, i) => !props.excluded.has(i)))

function statsFor(e: AggTableEntry) {
  const cts = cycleTimes(e.rows, 'qual')
  const ds = deltas(e.rows, 'qual')
  const schedCts = scheduledCycleTimes(e.rows, 'qual')
  return { cts, avgD: ds.length ? fmtDeltaObj(mean(ds)) : { text: '—', cls: '' }, schedCts }
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th v-for="(c, ci) in cols" :key="ci" :class="{ sortable: c.sortable, 'sort-active': sortCol === ci }" @click="c.sortable && sortBy(ci)">
            <template v-if="ci === 0">
              <input type="checkbox" :checked="allChecked" title="Select / deselect all" @change="emit('toggle-all', ($event.target as HTMLInputElement).checked)" />
            </template>
            <template v-else>
              {{ c.label }}
              <i v-if="c.sortable" style="margin-left: 4px; opacity: 0.5; font-style: normal">{{ sortCol === ci ? (sortDir === 'asc' ? '▲' : '▼') : '▲' }}</i>
            </template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="i in sortedIndices" :key="entries[i].event.code" :style="excluded.has(i) ? { opacity: 0.35 } : undefined">
          <td>
            <input type="checkbox" :checked="!excluded.has(i)" title="Include in aggregate" @change="emit('toggle-exclude', i)" />
          </td>
          <td class="muted-cell">{{ entries[i].event.regionCode }}</td>
          <td>
            <router-link :to="entries[i].eventHref">{{ entries[i].event.name }}</router-link>
            <span class="muted-cell"> ({{ entries[i].event.code }})</span>
          </td>
          <td class="muted-cell">{{ [entries[i].event.city, entries[i].event.state].filter(Boolean).join(', ') }}</td>
          <td class="muted-cell">{{ played(entries[i].rows) || '—' }}</td>
          <td class="muted-cell">{{ entries[i].teamCount || '—' }}</td>
          <td class="muted-cell">{{ entries[i].matchesPerTeam || '—' }}</td>
          <td class="muted-cell">{{ statsFor(entries[i]).schedCts.length ? fmtDur(mean(statsFor(entries[i]).schedCts)) : '—' }}</td>
          <td>{{ statsFor(entries[i]).cts.length ? fmtDur(mean(statsFor(entries[i]).cts)) : '—' }}</td>
          <td>{{ statsFor(entries[i]).cts.length ? fmtDur(median(statsFor(entries[i]).cts)) : '—' }}</td>
          <td>{{ statsFor(entries[i]).cts.length ? fmtDur(stddev(statsFor(entries[i]).cts)) : '—' }}</td>
          <td :class="statsFor(entries[i]).avgD.cls">{{ statsFor(entries[i]).avgD.text }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
