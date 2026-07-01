import { CURRENT_YEAR, CURRENT_YEAR_ROWS_TTL_MS } from '../config'
import { lsGet, lsSet } from './cache'
import type {
  ApiV3Event,
  ApiV3EventParticipants,
  ApiV3League,
  ApiV3Match,
  ApiV3Matches,
  ApiV3Region,
  ApiV3Season,
} from './types'

const BASE_URL = 'https://ftc-api.firstinspires.org'
const API_KEY = import.meta.env.VITE_FTC_API_KEY as string | undefined

if (!API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('VITE_FTC_API_KEY is not set — API calls will fail. See .env.example.')
}

function ftcUrl(path: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${BASE_URL}${path}${sep}api_key=${API_KEY ?? ''}`
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(ftcUrl(path))
  if (!res.ok) {
    throw new Error(`FTC API request failed (${res.status}): ${path}`)
  }
  return (await res.json()) as T
}

function isPastSeason(cmpYear: number): boolean {
  return cmpYear < CURRENT_YEAR
}

const seasonsCache: { value: ApiV3Season[] | null } = { value: null }
export async function fetchSeasons(): Promise<ApiV3Season[]> {
  if (seasonsCache.value) return seasonsCache.value
  const cached = lsGet<ApiV3Season[]>('seasons')
  if (cached) {
    seasonsCache.value = cached
    return cached
  }
  const data = await getJson<{ seasons: ApiV3Season[] }>('/api/v3/seasons')
  seasonsCache.value = data.seasons
  lsSet('seasons', data.seasons, 24 * 60 * 60 * 1000)
  return data.seasons
}

const eventsCache = new Map<number, ApiV3Event[]>()
export async function fetchSeasonEvents(cmpYear: number): Promise<ApiV3Event[]> {
  if (eventsCache.has(cmpYear)) return eventsCache.get(cmpYear)!
  const cacheKey = `events_${cmpYear}`
  const cached = lsGet<ApiV3Event[]>(cacheKey)
  if (cached) {
    eventsCache.set(cmpYear, cached)
    return cached
  }
  const data = await getJson<{ events: ApiV3Event[] }>(`/api/v3/seasons/${cmpYear}/events`)
  const events = data.events.filter((e) => e.published)
  eventsCache.set(cmpYear, events)
  lsSet(cacheKey, events, isPastSeason(cmpYear) ? null : 60 * 60 * 1000)
  return events
}

export async function fetchRegions(cmpYear: number): Promise<ApiV3Region[]> {
  const cacheKey = `regions_${cmpYear}`
  const cached = lsGet<ApiV3Region[]>(cacheKey)
  if (cached) return cached
  const data = await getJson<{ regions: ApiV3Region[] }>(`/api/v3/seasons/${cmpYear}/regions`)
  lsSet(cacheKey, data.regions, isPastSeason(cmpYear) ? null : 24 * 60 * 60 * 1000)
  return data.regions
}

export async function fetchRegionLeagues(cmpYear: number, regionCode: string): Promise<ApiV3League[]> {
  const cacheKey = `leagues_${cmpYear}_${regionCode}`
  const cached = lsGet<ApiV3League[]>(cacheKey)
  if (cached) return cached
  try {
    const data = await getJson<{ leagues: ApiV3League[] }>(
      `/api/v3/seasons/${cmpYear}/regions/${regionCode}/leagues`,
    )
    lsSet(cacheKey, data.leagues, isPastSeason(cmpYear) ? null : 24 * 60 * 60 * 1000)
    return data.leagues
  } catch {
    // Fails soft: a region with no leagues (or an API hiccup) shouldn't block
    // rendering that region's non-league events.
    return []
  }
}

export async function fetchEventInfo(cmpYear: number, eventCode: string): Promise<ApiV3Event | null> {
  try {
    return await getJson<ApiV3Event>(`/api/v3/seasons/${cmpYear}/events/${eventCode}`)
  } catch {
    return null
  }
}

export async function fetchEventTeamCount(cmpYear: number, eventCode: string): Promise<number> {
  try {
    const data = await getJson<ApiV3EventParticipants>(
      `/api/v3/seasons/${cmpYear}/events/${eventCode}/teams`,
    )
    return data.participants.length
  } catch {
    return 0
  }
}

function isCompletedByToday(event: ApiV3Event | undefined): boolean {
  if (!event) return false
  const today = new Date().toISOString().slice(0, 10)
  return event.endDate < today
}

/** Fetches raw matches for an event, with the same caching tiers the reference
 *  implementation uses: past seasons cache forever, current-season completed
 *  events cache with a TTL, live events are never persisted to localStorage. */
export async function fetchEventMatches(
  cmpYear: number,
  eventCode: string,
  bustCache = false,
): Promise<ApiV3Match[] | null> {
  const cacheKey = `matches_${cmpYear}_${eventCode}`
  if (!bustCache) {
    const cached = lsGet<ApiV3Match[]>(cacheKey)
    if (cached) return cached
  }
  let data: ApiV3Matches
  try {
    data = await getJson<ApiV3Matches>(`/api/v3/seasons/${cmpYear}/events/${eventCode}/matches`)
  } catch {
    return null
  }
  const matches = data.matches

  if (isPastSeason(cmpYear)) {
    lsSet(cacheKey, matches, null)
  } else {
    const events = eventsCache.get(cmpYear)
    const event = events?.find((e) => e.code === eventCode)
    if (isCompletedByToday(event)) {
      lsSet(cacheKey, matches, CURRENT_YEAR_ROWS_TTL_MS)
    }
    // Still live/unknown — memory-only, refetched on next load.
  }
  return matches
}
