import type { ApiV3Event, ApiV3League } from '../api/types'

function longestCommonPrefix(strings: string[]): string {
  if (!strings.length) return ''
  const sorted = [...strings].sort()
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  let i = 0
  while (i < first.length && i < last.length && first[i] === last[i]) i++
  return first.slice(0, i)
}

function cleanPrefix(prefix: string): string {
  return prefix.replace(/[\s#\-–—.:]*\d*\s*$/, '').trim()
}

/** Last-resort fallback for when fetchRegionLeagues can't return a real name for
 * a leagueCode (FTC's region-scoped v3 endpoints were broken for a while and
 * occasionally hiccup even now — see fetchRegionLeagues in api/client.ts).
 * Derives a readable name from the league's own event names instead:
 *   1. Prefer the League Tournament event's name, stripping a trailing
 *      "League Tournament" suffix and re-adding "League" (e.g. "East Bay
 *      League Tournament" -> "East Bay League").
 *   2. Otherwise use the longest common prefix across all the league's event
 *      names, trimmed of trailing separators/numbers (e.g. "Arrowhead Meet 1"
 *      / "Arrowhead Meet 2" -> "Arrowhead Meet").
 *   3. Otherwise fall back to the league code. */
export function deriveLeagueName(code: string, leagueEvents: ApiV3Event[]): string {
  const tourney = leagueEvents.find((e) => e.type === 'LEAGUE_TOURNAMENT')
  if (tourney) {
    const stripped = tourney.name.replace(/\s+league\s+tournament\s*$/i, '').trim()
    return stripped === tourney.name.trim() ? tourney.name.trim() : `${stripped} League`
  }
  const prefix = cleanPrefix(longestCommonPrefix(leagueEvents.map((e) => e.name)))
  return prefix.length >= 4 ? prefix : code
}

/** Builds a leagueCode -> display name map for every league referenced by
 * `events`, preferring real names from `leagues` (the fetchRegionLeagues
 * result) and falling back to deriveLeagueName for any leagueCode it missed. */
export function buildLeagueNameMap(leagues: ApiV3League[], events: ApiV3Event[]): Map<string, string> {
  const names = new Map(leagues.map((l) => [l.code, l.name]))
  const codes = new Set(events.map((e) => e.leagueCode).filter((c): c is string => !!c))
  for (const code of codes) {
    if (!names.has(code)) {
      names.set(code, deriveLeagueName(code, events.filter((e) => e.leagueCode === code)))
    }
  }
  return names
}
