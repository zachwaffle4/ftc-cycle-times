import { ref } from 'vue'

/** Shared across the app: any live-refreshing view reports success/failure here,
 *  and App.vue renders a single global banner when the most recent refresh failed. */
export const connectionLost = ref(false)
export const lastSuccessAt = ref<number | null>(null)

export function markRefreshSuccess(): void {
  lastSuccessAt.value = Date.now()
  connectionLost.value = false
}

export function markRefreshError(): void {
  connectionLost.value = true
}
