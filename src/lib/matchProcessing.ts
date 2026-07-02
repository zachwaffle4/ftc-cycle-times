import { BREAK_GAP } from '../config'
import type { ApiV3Match, ApiV3TournamentLevel } from '../api/types'

export type MatchPhase = 'qual' | 'playoff'

export interface MatchRow {
  matchNum: number
  matchLabel: string
  displayName: string
  sortOrder: number
  phase: MatchPhase
  tournamentLevel: ApiV3TournamentLevel
  field: number
  /** Scheduled start, unix seconds. */
  scheduled: number | null
  /** Actual start, unix seconds. */
  actual: number | null
  /** Score-posted time, unix seconds. */
  postTime: number | null
  /** Seconds between this match's actual start and the previous played match's. */
  cycleTime: number | null
  /** Seconds between this match's scheduled start and the previous match's. */
  scheduledCT: number | null
  isPostBreak: boolean
  /** scheduled - actual: positive = running ahead, negative = running behind. */
  delta: number | null
  /** postTime - actual: how long the score took to post after the match started. */
  scorePostDelay: number | null
  isOutlier: boolean
  isReplay: boolean
  redTeams: string[]
  blueTeams: string[]
  redScore?: number
  blueScore?: number
  winner?: 'RED' | 'BLUE'
}

export interface ProcessedMatches {
  rows: MatchRow[]
  matchesPerTeam?: number
  teamCount?: number
}

function toEpochSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : Math.round(ms / 1000)
}

function playoffLevelOrder(level: ApiV3TournamentLevel): number {
  switch (level) {
    case 'PLAYOFF':
      return 1
    case 'SEMIFINAL':
      return 2
    case 'FINAL':
      return 3
    default:
      return 9
  }
}

function matchTournamentOrder(m: ApiV3Match): number {
  if (m.tournamentLevel === 'QUALIFICATION') return m.number || 0
  return 1_000_000 + playoffLevelOrder(m.tournamentLevel) * 10_000 + (m.series || 0) * 100 + (m.number || 0)
}

function iqrOutlierBounds(values: number[]): { lo: number; hi: number } {
  if (values.length < 4) return { lo: -Infinity, hi: Infinity }
  const s = [...values].sort((a, b) => a - b)
  const q1 = s[Math.floor(s.length * 0.25)]
  const q3 = s[Math.floor(s.length * 0.75)]
  const iqr = q3 - q1
  return { lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr }
}

function processMatchGroup(matches: ApiV3Match[], phase: MatchPhase): MatchRow[] {
  const sorted = [...matches].sort((a, b) => matchTournamentOrder(a) - matchTournamentOrder(b))

  const rows: MatchRow[] = sorted.map((m, i) => {
    const scheduled = toEpochSeconds(m.scheduledStartTime)
    const actual = toEpochSeconds(m.startTime)
    const postTime = toEpochSeconds(m.postTime)

    let scheduledCT: number | null = null
    let isPostBreak = i === 0
    if (i > 0) {
      const prevScheduled = toEpochSeconds(sorted[i - 1].scheduledStartTime)
      const schedGap = scheduled != null && prevScheduled != null ? scheduled - prevScheduled : null
      if (schedGap != null && schedGap > BREAK_GAP) isPostBreak = true
      else scheduledCT = schedGap
    }

    const delta = scheduled != null && actual != null ? scheduled - actual : null
    const scorePostDelay = actual != null && postTime != null ? postTime - actual : null

    const red = m.teams.redAlliance.teams.filter((t) => !t.surrogate).map((t) => t.team.displayNumber)
    const blue = m.teams.blueAlliance.teams.filter((t) => !t.surrogate).map((t) => t.team.displayNumber)

    return {
      matchNum: m.number,
      matchLabel: m.shortName,
      displayName: m.displayName,
      sortOrder: matchTournamentOrder(m),
      phase,
      tournamentLevel: m.tournamentLevel,
      field: m.field,
      scheduled,
      actual,
      postTime,
      cycleTime: null,
      scheduledCT,
      isPostBreak,
      delta,
      scorePostDelay,
      isOutlier: false,
      isReplay: false,
      redTeams: red,
      blueTeams: blue,
      redScore: m.matchResults?.redScore,
      blueScore: m.matchResults?.blueScore,
      winner: m.matchResults?.winner,
    }
  })

  // Compute cycle times in actual play order; fall back to actual-gap break detection
  // only when schedule data is unavailable (running late would otherwise inflate gaps).
  const played = rows.filter((r) => r.actual != null).sort((a, b) => (a.actual as number) - (b.actual as number))
  for (let i = 1; i < played.length; i++) {
    const gap = (played[i].actual as number) - (played[i - 1].actual as number)
    if (played[i].scheduled == null || played[i - 1].scheduled == null) {
      if (gap > BREAK_GAP) {
        played[i].isPostBreak = true
      } else {
        played[i].cycleTime = gap
        played[i].isPostBreak = false
      }
    } else if (!played[i].isPostBreak) {
      played[i].cycleTime = gap
    }
  }

  // Out-of-order replay detection (qual only — playoffs interleave by series, so
  // sortOrder doesn't represent strict play order there).
  if (phase === 'qual') {
    for (const r of rows) {
      const actual = r.actual
      if (actual == null) continue
      const replayed = rows.some((r2) => r2.actual != null && r2.sortOrder > r.sortOrder && r2.actual < actual)
      if (replayed) {
        r.isReplay = true
        r.delta = null
        r.isOutlier = true
      }
    }
  }

  const rawCts = rows.map((r) => r.cycleTime).filter((v): v is number => v != null)
  const { lo, hi } = iqrOutlierBounds(rawCts)
  for (const r of rows) {
    if (r.cycleTime != null && (r.cycleTime < lo || r.cycleTime > hi)) r.isOutlier = true
  }

  return rows
}

export function processMatches(matches: ApiV3Match[]): ProcessedMatches {
  const qualMatches = matches.filter((m) => m.tournamentLevel === 'QUALIFICATION')
  const playoffMatches = matches.filter((m) => m.tournamentLevel === 'SEMIFINAL' || m.tournamentLevel === 'FINAL' || m.tournamentLevel === 'PLAYOFF')
  // PRACTICE matches are intentionally excluded — not officially scheduled play.

  const rows = [...processMatchGroup(qualMatches, 'qual'), ...processMatchGroup(playoffMatches, 'playoff')]

  rows.sort((a, b) => {
    if (a.actual != null && b.actual != null) return a.actual - b.actual
    if (a.actual != null) return -1
    if (b.actual != null) return 1
    if (a.scheduled != null && b.scheduled != null) return a.scheduled - b.scheduled
    if (a.scheduled != null) return -1
    if (b.scheduled != null) return 1
    return a.sortOrder - b.sortOrder
  })

  const teamCounts = new Map<string, number>()
  for (const m of qualMatches) {
    for (const alliance of [m.teams.redAlliance, m.teams.blueAlliance]) {
      for (const t of alliance.teams) {
        if (t.surrogate) continue
        teamCounts.set(t.team.number, (teamCounts.get(t.team.number) ?? 0) + 1)
      }
    }
  }

  let matchesPerTeam: number | undefined
  let teamCount: number | undefined
  if (teamCounts.size > 0) {
    const freqs = new Map<number, number>()
    for (const v of teamCounts.values()) freqs.set(v, (freqs.get(v) ?? 0) + 1)
    let best = 0
    let bestFreq = 0
    for (const [val, freq] of freqs) {
      if (freq > bestFreq) {
        best = val
        bestFreq = freq
      }
    }
    matchesPerTeam = best
    teamCount = teamCounts.size
  }

  return { rows, matchesPerTeam, teamCount }
}
