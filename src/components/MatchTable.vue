<script setup lang="ts">
import { computed } from 'vue'
import { fmtDeltaObj, fmtDur, fmtTime } from '../lib/format'
import type { MatchRow } from '../lib/matchProcessing'

const props = defineProps<{ rows: MatchRow[]; timezone?: string }>()

const tzLabel = computed(() => {
  if (!props.timezone) return 'Time'
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: props.timezone, timeZoneName: 'short' }).formatToParts(
      new Date(),
    )
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? 'Time'
  } catch {
    return 'Time'
  }
})

interface DisplayRow {
  kind: 'match' | 'break' | 'replay-gap'
  row?: MatchRow
  gapLabel?: string
}

const displayRows = computed<DisplayRow[]>(() => {
  const qualReplayNums = new Set(props.rows.filter((r) => r.phase === 'qual' && r.isReplay).map((r) => r.matchNum))
  let prevActualMatchNum = -1
  const out: DisplayRow[] = []

  for (let i = 0; i < props.rows.length; i++) {
    const r = props.rows[i]
    let hasReplayGap = false
    if (r.phase === 'qual' && r.actual != null && !r.isReplay && prevActualMatchNum >= 0 && r.matchNum > prevActualMatchNum + 1) {
      const gapNums: string[] = []
      for (let mn = prevActualMatchNum + 1; mn < r.matchNum; mn++) {
        if (qualReplayNums.has(mn)) gapNums.push(`Q${mn}`)
      }
      if (gapNums.length) {
        out.push({ kind: 'replay-gap', gapLabel: `— ${gapNums.join(', ')} played out of order —` })
        hasReplayGap = true
      }
    }
    if (r.isPostBreak && i > 0 && !r.isReplay && !hasReplayGap) {
      out.push({ kind: 'break' })
    }
    out.push({ kind: 'match', row: r })
    if (r.phase === 'qual' && r.actual != null && !r.isReplay) prevActualMatchNum = r.matchNum
  }
  return out
})

function deltaFor(r: MatchRow) {
  return fmtDeltaObj(r.delta)
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Match</th>
          <th>Scheduled ({{ tzLabel }})</th>
          <th>Actual ({{ tzLabel }})</th>
          <th>Δ Schedule</th>
          <th>Sched CT</th>
          <th>Cycle Time</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(dr, i) in displayRows" :key="i">
          <tr v-if="dr.kind === 'break'" class="break-row">
            <td colspan="6">— break —</td>
          </tr>
          <tr v-else-if="dr.kind === 'replay-gap'" class="replay-gap-row">
            <td colspan="6">{{ dr.gapLabel }}</td>
          </tr>
          <tr
            v-else
            :class="{ 'replay-row': dr.row!.isReplay, 'outlier-row': !dr.row!.isReplay && dr.row!.isOutlier }"
          >
            <td>
              <strong>{{ dr.row!.matchLabel }}</strong>
              <span v-if="dr.row!.isReplay" class="replay-badge">REPLAY</span>
            </td>
            <td class="muted-cell">{{ fmtTime(dr.row!.scheduled, timezone) }}</td>
            <td>
              <span v-if="dr.row!.actual">{{ fmtTime(dr.row!.actual, timezone) }}</span>
              <span v-else class="muted-cell">not played</span>
            </td>
            <td :class="deltaFor(dr.row!).cls">{{ deltaFor(dr.row!).text }}</td>
            <td class="muted-cell">{{ fmtDur(dr.row!.scheduledCT) }}</td>
            <td :class="{ 'muted-cell': dr.row!.cycleTime == null }">
              {{ fmtDur(dr.row!.cycleTime) }}
              <span v-if="dr.row!.isOutlier && !dr.row!.isReplay" class="outlier-badge">(outlier)</span>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
