// Cloudflare Worker: serves the built static app, plus a small server-side
// proxy for the legacy FTC Events API v2. v2 is used only as a fallback for
// v3 endpoints currently broken in production (see fetchRegionLeagues in
// src/api/client.ts). It's proxied here rather than called directly from the
// browser because v2 (a) sends no CORS headers at all, and (b) explicitly
// warns that distributing an app with a v2 username/token embedded in it —
// even base64-encoded — will get that token blocked. Credentials therefore
// live only in Worker env vars (FTC_V2_USERNAME/FTC_V2_TOKEN), never in
// client-side JS.

interface Env {
  FTC_V2_USERNAME?: string
  FTC_V2_TOKEN?: string
  ASSETS: { fetch(request: Request): Promise<Response> }
}

const V2_BASE_URL = 'https://ftc-api.firstinspires.org'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  })
}

async function handleV2Leagues(url: URL, env: Env): Promise<Response> {
  const cmpYear = Number(url.searchParams.get('cmpYear'))
  const regionCode = url.searchParams.get('regionCode')
  if (!cmpYear || !regionCode) {
    return jsonResponse({ error: 'cmpYear and regionCode query params are required' }, 400)
  }
  if (!env.FTC_V2_USERNAME || !env.FTC_V2_TOKEN) {
    return jsonResponse({ error: 'v2 API credentials not configured on the server' }, 501)
  }

  const v2Season = cmpYear - 1 // v2 numbers seasons by kickoff year, one less than v3's cmpYear
  const auth = btoa(`${env.FTC_V2_USERNAME}:${env.FTC_V2_TOKEN}`)
  const upstream = await fetch(
    `${V2_BASE_URL}/v2.0/${v2Season}/leagues?regionCode=${encodeURIComponent(regionCode)}`,
    { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } },
  )
  const body = await upstream.text()
  return new Response(body, {
    status: upstream.status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/v2/leagues') {
      return handleV2Leagues(url, env)
    }
    return env.ASSETS.fetch(request)
  },
}
