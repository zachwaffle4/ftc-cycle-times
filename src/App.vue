<script setup lang="ts">
import { connectionLost, lastSuccessAt } from './composables/connectionBanner'
import { cycleTimeAttribution, toggleCycleTimeAttribution } from './composables/cycleTimeAttribution'
import { computed } from 'vue'

const bannerText = computed(() => {
  const timeStr = lastSuccessAt.value
    ? new Date(lastSuccessAt.value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : 'unknown'
  return `⚠ Connection lost · Last successful update: ${timeStr}`
})

const attributionLabel = computed(() =>
  cycleTimeAttribution.value === 'later' ? 'Cycle time: charged to later match' : 'Cycle time: charged to earlier match',
)
const attributionButtonTitle = computed(() =>
  cycleTimeAttribution.value === 'later' ? 'Click to switch to earlier-match attribution' : 'Click to switch to later-match attribution',
)
const attributionInfo =
  'Which match a cycle-time gap is shown on:\n\n' +
  '• Earlier match (default, FTCLive) — the gap is "time until the next match", shown on the match that just finished. This is the convention FTCLive uses.\n\n' +
  '• Later match (FRC-style) — the gap is "time since the previous match", shown on the match that just started. This is the convention the FRC Cycle Time Report uses.\n\n' +
  'This does not change any calculations, only which match (and which field, in the By Field/By Division breakdowns) each gap is attributed to.'
</script>

<template>
  <div v-if="connectionLost" id="connection-banner">{{ bannerText }}</div>
  <div class="container">
    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-bottom: 4px">
      <span :title="attributionInfo" style="cursor: help; color: var(--muted); font-size: 0.85rem">ⓘ</span>
      <button class="btn-ghost" :title="attributionButtonTitle" @click="toggleCycleTimeAttribution">⇄ {{ attributionLabel }}</button>
    </div>
    <router-view />
  </div>
</template>
