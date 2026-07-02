# FTC Cycle Times

A web app for analyzing FIRST Tech Challenge match cycle times — how consistently
an event, league, or region runs on schedule — using data from the
[FTC Data API v3](https://ftc-api.firstinspires.org).

**Cycle time** is the elapsed time between the *actual start* of one match and the
next. This tool shows per-match cycle times and schedule deviation for a single
event, plus pooled stats and comparison tables across a league, region, month, or
season.

Inspired by [phil-lopreiato/frc-cycle-times](https://github.com/phil-lopreiato/frc-cycle-times),
which does the same analysis for FRC events using TBA data. FTC's data model has no
"week" concept and organizes events by region/league instead of district, so the
view structure here is adapted accordingly — see the views below.

## Views

| View | Route | Description |
|---|---|---|
| Home | `/home/:year` | All of a season's regions, with a jump-to-event search |
| Event Detail | `/event/:year/:code` | Per-match cycle times, Δ schedule charts, live "Next Up" card |
| Region Home | `/region/:year/:regionCode` | A region's leagues, plus its non-league events (championships, qualifiers, off-season, etc.) |
| League Home | `/league/:year/:regionCode/:leagueCode` | A league's meets + tournament, with pooled stats |
| Region Overall | `/region/:year/:regionCode/overall` | Pooled stats across an entire region's season |
| Month Aggregate | `/month/:year/:month` | Pooled stats for all events starting in a given month |
| Season Overview | `/season/:year` | Pooled stats across the whole season, plus a cycle-time-by-month trend |

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
cp .env.example .env             # then fill in VITE_FTC_API_KEY — see below
cp .dev.vars.example .dev.vars   # optional, for the v2 fallback — see below
bun run dev
```

Other scripts: `bun run build`, `bun run preview`, `bun run deploy` (deploys via Wrangler).

The dev/build/deploy commands all run through [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/),
which serves the app through a Cloudflare Worker (`worker/index.ts`) both locally
and in production — this is what lets the v2 API fallback proxy below run in dev too.

## API key

Get a key from the [FTC Data API account page](https://ftc-scoring.firstinspires.org/account/apiKeys)
and set it as `VITE_FTC_API_KEY` in `.env`. Per the API's own docs, v3 keys are
meant to be distributed with the applications that use them and don't need to be
kept secret — but each key is tied to a FIRST account, so don't commit your `.env`.

## v2 API fallback

A handful of v3 endpoints (region-scoped ones, like listing a region's leagues)
are currently broken in production. Where that happens, the app falls back to
the legacy [FTC Events API v2](https://ftc-events.firstinspires.org/try-it-out/index.html),
proxied through `worker/index.ts` rather than called directly from the browser,
because v2 sends no CORS headers and its docs explicitly warn against embedding
a v2 username/token in client-side code.

To enable the fallback, request v2 credentials from the same try-it-out page,
then set `FTC_V2_USERNAME`/`FTC_V2_TOKEN` in `.dev.vars` for local dev (picked
up automatically by Wrangler — never committed) and as Worker secrets in
production via `wrangler secret put FTC_V2_TOKEN` (or the Cloudflare dashboard).
Without credentials configured, the app falls back further to a heuristic
league-name guesser (see `src/lib/leagueNames.ts`) instead of failing outright.

Note v2 numbers seasons by kickoff year, one less than v3's `cmpYear` — e.g.
cmpYear 2026 is v2 season 2025. The proxy handles this conversion.

## License

GPLv3 — see [LICENSE](./LICENSE).
