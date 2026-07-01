// Hand-trimmed TypeScript interfaces for the FTC Data API v3, covering only the
// fields this app reads. See "FTC Data API v3 Spec.json" at the repo root for the
// full OpenAPI spec.

export interface ApiV3Season {
  yearString: string
  cmpYear: number
  gameName: string
  kickoffTime: string
}

export interface ApiV3Coordinates {
  latitude: number
  longitude: number
}

export type ApiV3EventType =
  | 'SCRIMMAGE'
  | 'LEAGUE_MEET'
  | 'QUALIFIER'
  | 'LEAGUE_TOURNAMENT'
  | 'SUPER_QUALIFIER'
  | 'CHAMPIONSHIP'
  | 'OTHER'
  | 'INNOVATION'
  | 'FIRST_CHAMPIONSHIP'
  | 'OFF_SEASON'
  | 'KICKOFF'
  | 'PREMIER'

export type ApiV3EventFormat = 'TRADITIONAL' | 'REMOTE' | 'HYBRID'

export interface ApiV3Division {
  eventCode: string
  name: string
}

export interface ApiV3Event {
  code: string
  name: string
  type: ApiV3EventType
  format: ApiV3EventFormat
  startDate: string
  endDate: string
  regionCode: string
  leagueCode?: string | null
  parentEventCode?: string | null
  divisions?: ApiV3Division[]
  venue?: string
  city?: string
  state?: string
  country?: string
  coordinates?: ApiV3Coordinates | null
  website?: string
  fieldCount: number
  published: boolean
  timezone: string
}

export interface ApiV3Region {
  code: string
  name: string
}

export interface ApiV3League {
  code: string
  name: string
  remote?: boolean
  location?: string
  parentCode?: string
}

export interface ApiV3SimpleTeam {
  number: string
  name: string
  displayNumber: string
}

export interface ApiV3Team extends ApiV3SimpleTeam {
  affiliations?: string
  city?: string
  stateProv?: string
  country?: string
  rookieCmpYear?: number
  website?: string
  homeRegionCode?: string
  coordinates?: ApiV3Coordinates | null
}

export type ApiV3CompetingType = 'FULL' | 'REMOTE'

export interface ApiV3EventParticipant {
  team: ApiV3Team
  competingType: ApiV3CompetingType
  divisionEventCode?: string | null
}

export interface ApiV3EventParticipants {
  participants: ApiV3EventParticipant[]
}

export interface ApiV3MatchTeam {
  team: ApiV3SimpleTeam
  surrogate: boolean
  onField?: boolean
  disqualified?: boolean
}

export interface ApiV3MatchAlliance {
  teams: ApiV3MatchTeam[]
}

export interface ApiV3PlayoffMatchAlliance extends ApiV3MatchAlliance {
  seed?: number
}

export type ApiV3AllianceColor = 'RED' | 'BLUE'

export interface ApiV3AllianceMatchResults {
  winner?: ApiV3AllianceColor
  redScore: number
  blueScore: number
}

export type ApiV3TournamentLevel = 'QUALIFICATION' | 'SEMIFINAL' | 'FINAL' | 'PLAYOFF' | 'PRACTICE'

/** Covers both ApiV3AllianceSimpleMatchParticipants (qual/practice) and
 *  ApiV3AlliancePlayoffMatchParticipants (playoff, alliances carry a seed). */
export interface ApiV3AllianceMatchParticipants {
  type: string
  redAlliance: ApiV3PlayoffMatchAlliance
  blueAlliance: ApiV3PlayoffMatchAlliance
}

/** A traditional-event match. Remote/single-team events use a different shape
 *  (ApiV3SingleTeamMatch) that this app does not support. */
export interface ApiV3Match {
  type: string
  shortName: string
  displayName: string
  field: number
  tournamentLevel: ApiV3TournamentLevel
  scheduledStartTime?: string | null
  startTime?: string | null
  postTime?: string | null
  commitTime?: string | null
  series: number
  number: number
  matchResults?: ApiV3AllianceMatchResults
  teams: ApiV3AllianceMatchParticipants
}

export interface ApiV3Matches {
  matches: ApiV3Match[]
}

export interface ApiV3Events {
  events: ApiV3Event[]
}

export interface ApiV3Regions {
  regions: ApiV3Region[]
}

export interface ApiV3Leagues {
  leagues: ApiV3League[]
}

export interface ApiV3Seasons {
  seasons: ApiV3Season[]
}
