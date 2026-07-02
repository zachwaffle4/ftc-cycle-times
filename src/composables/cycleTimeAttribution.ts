import { ref, watch } from 'vue'

export type CycleTimeAttribution = 'later' | 'earlier'

const STORAGE_KEY = 'ct_attribution_mode'

function loadInitial(): CycleTimeAttribution {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'later' ? 'later' : 'earlier'
  } catch {
    return 'earlier'
  }
}

/** Which match a cycle-time gap gets attributed to:
 *  - 'earlier' (default): the match that just finished gets "time until the
 *    next match" — matches the FTCLive local-server tool's convention, which
 *    most FTC volunteers/scorekeepers are already used to.
 *  - 'later': the match that just started gets "time since the previous
 *    match" — this app's original convention, kept for cross-program (FRC)
 *    volunteers used to that convention.
 *  Shared app-wide (not per-event) since it's a display preference, not
 *  event-specific data. */
export const cycleTimeAttribution = ref<CycleTimeAttribution>(loadInitial())

watch(cycleTimeAttribution, (mode) => {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore — quota exceeded or storage disabled
  }
})

export function toggleCycleTimeAttribution(): void {
  cycleTimeAttribution.value = cycleTimeAttribution.value === 'later' ? 'earlier' : 'later'
}
