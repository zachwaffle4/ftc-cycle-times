import { onBeforeUnmount } from 'vue'
import { markRefreshError, markRefreshSuccess } from './connectionBanner'

/** Polls `callback` every `intervalMs` while active, reporting success/failure to the
 *  shared connection-lost banner state. Call `start()` once the view knows it's live,
 *  `stop()` when navigating away (also called automatically on unmount). */
export function useLiveRefresh(callback: () => Promise<void>, intervalMs: number) {
  let timer: ReturnType<typeof setInterval> | null = null

  async function tick(): Promise<void> {
    try {
      await callback()
      markRefreshSuccess()
    } catch {
      markRefreshError()
    }
  }

  function start(): void {
    stop()
    timer = setInterval(tick, intervalMs)
  }

  function stop(): void {
    if (timer != null) {
      clearInterval(timer)
      timer = null
    }
  }

  onBeforeUnmount(stop)

  return { start, stop, tick }
}
