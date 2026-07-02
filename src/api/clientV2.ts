// Fallback client for the legacy FTC Events API v2, used only where the v3 API
// is currently broken (see fetchRegionLeagues in client.ts). Unlike v3, v2
// sends no CORS headers and its docs warn that embedding a v2 username/token
// in client-side code will get the token blocked — so instead of calling v2
// directly, this hits our own Worker route (worker/index.ts), which proxies
// to v2 server-side with credentials that never reach the browser.
import type { ApiV3League } from './types'

interface SeasonLeagueModelV2 {
  region: string | null
  code: string | null
  name: string | null
  remote: boolean | null
  parentLeagueCode: string | null
  location: string | null
}

export async function fetchRegionLeaguesV2(cmpYear: number, regionCode: string): Promise<ApiV3League[]> {
  const res = await fetch(`/api/v2/leagues?cmpYear=${cmpYear}&regionCode=${encodeURIComponent(regionCode)}`)
  if (!res.ok) throw new Error(`v2 leagues proxy request failed (${res.status})`)
  const data = (await res.json()) as { leagues: SeasonLeagueModelV2[] | null }
  return (data.leagues ?? [])
    .filter((l): l is SeasonLeagueModelV2 & { code: string; name: string } => !!l.code && !!l.name)
    .map((l) => ({
      code: l.code,
      name: l.name,
      remote: l.remote ?? undefined,
      location: l.location ?? undefined,
      parentCode: l.parentLeagueCode ?? undefined,
    }))
}
