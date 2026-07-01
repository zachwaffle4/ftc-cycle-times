<script setup lang="ts">
import { connectionLost, lastSuccessAt } from './composables/connectionBanner'
import { computed } from 'vue'

const bannerText = computed(() => {
  const timeStr = lastSuccessAt.value
    ? new Date(lastSuccessAt.value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : 'unknown'
  return `⚠ Connection lost · Last successful update: ${timeStr}`
})
</script>

<template>
  <div v-if="connectionLost" id="connection-banner">{{ bannerText }}</div>
  <div class="container">
    <router-view />
  </div>
</template>
