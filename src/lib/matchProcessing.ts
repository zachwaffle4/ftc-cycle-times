import { BREAK_GAP } from '../config'
import type { ApiV3Match, ApiV3TournamentLevel } from '../api/types'

export type MatchPhase = 'qual' | 'playoff'

/** Which match a cycle-time gap gets attributed to: the one that just
 *  started ('later', this app's original convention — "time since the
 *  previous match") or the one that just finished ('earlier' — "time until
 *  the next match", matching the FTCLive local-server tool's convention). */
export type CycleTimeAttribution = 'later' | 'earlier'

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
  /** Seconds between two consecutive played matches' actual starts, attributed to
   *  the earlier or later of the pair depending on CycleTimeAttribution. */
  cycleTime: number | null
  /** Seconds between two consecutive matches' scheduled starts, attributed the
   *  same way as cycleTime. */
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

function processMatchGroup(matches: ApiV3Match[], phase: MatchPhase, attribution: CycleTimeAttribution): MatchRow[] {
  const sorted = [...matches].sort((a, b) => matchTournamentOrder(a) - matchTournamentOrder(b))

  const rawRows = sorted.map(m => ({
    m,
    scheduled: toEpochSeconds(m.scheduledStartTime),
    actual: toEpochSeconds(m.startTime),
    postTime: toEpochSeconds(m.postTime)
  }))

  // Fix FTCLive day-wrap bugs (where scheduled time has the wrong date relative to actual)
  // 1. Anchor scheduled time to actual time if the match was played
  for (const r of rawRows) {
    if (r.scheduled != null && r.actual != null) {
      let diff = r.scheduled - r.actual
      while (diff < -12 * 3600) { r.scheduled += 24 * 3600; diff += 24 * 3600 }
      while (diff > 12 * 3600) { r.scheduled -= 24 * 3600; diff -= 24 * 3600 }
    }
  }
  
  // 2. Fix unplayed matches relative to previous matches
  for (let i = 1; i < rawRows.length; i++) {
    if (rawRows[i].scheduled != null && rawRows[i-1].scheduled != null) {
      let diff = rawRows[i].scheduled! - rawRows[i-1].scheduled!
      while (diff < -12 * 3600) { rawRows[i].scheduled! += 24 * 3600; diff += 24 * 3600 }
    }
  }

  const rows: MatchRow[] = rawRows.map((r, i) => {
    const { m, scheduled, actual, postTime } = r

    let isPostBreak = i === 0
    if (i > 0) {
      const prevScheduled = rawRows[i - 1].scheduled
      const schedGap = scheduled != null && prevScheduled != null ? scheduled - prevScheduled : null
      if (schedGap != null && schedGap > BREAK_GAP) isPostBreak = true
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
      scheduledCT: null,
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

  // Scheduled cycle time, in schedule order — attributed to whichever row the
  // current `attribution` setting points at, same as actual cycle time below.
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].isPostBreak) continue
    const prevScheduled = rows[i - 1].scheduled
    const schedGap = rows[i].scheduled != null && prevScheduled != null ? (rows[i].scheduled as number) - prevScheduled : null
    if (schedGap == null) continue
    const owner = attribution === 'earlier' ? rows[i - 1] : rows[i]
    owner.scheduledCT = schedGap
  }

  // Compute cycle times in actual play order; fall back to actual-gap break detection
  // only when schedule data is unavailable (running late would otherwise inflate gaps).
  // The gap between a match and its predecessor is attributed to whichever row the
  // current `attribution` setting points at — see CycleTimeAttribution.
  const played = rows.filter((r) => r.actual != null).sort((a, b) => (a.actual as number) - (b.actual as number))
  for (let i = 1; i < played.length; i++) {
    const gap = (played[i].actual as number) - (played[i - 1].actual as number)
    const owner = attribution === 'earlier' ? played[i - 1] : played[i]
    if (played[i].scheduled == null || played[i - 1].scheduled == null) {
      if (gap > BREAK_GAP) {
        played[i].isPostBreak = true
      } else {
        owner.cycleTime = gap
        played[i].isPostBreak = false
      }
    } else if (!played[i].isPostBreak) {
      owner.cycleTime = gap
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

export function processMatches(matches: ApiV3Match[], attribution: CycleTimeAttribution = 'earlier'): ProcessedMatches {
  const qualMatches = matches.filter((m) => m.tournamentLevel === 'QUALIFICATION')
  const playoffMatches = matches.filter((m) => m.tournamentLevel === 'SEMIFINAL' || m.tournamentLevel === 'FINAL' || m.tournamentLevel === 'PLAYOFF')
  // PRACTICE matches are intentionally excluded — not officially scheduled play.

  const rows = [
    ...processMatchGroup(qualMatches, 'qual', attribution),
    ...processMatchGroup(playoffMatches, 'playoff', attribution),
  ]

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
