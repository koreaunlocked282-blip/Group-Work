// check-story: preview check of the public version of a story (no data is stored or logged).
import { admin, allow, corsHeaders, fail, ipBucket, limitKey, respond, trustedClientIp } from './common.ts'
import { checkStory } from './story-check.ts'

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-haiku-5-5'

Deno.serve(async (req) => {
  const h = corsHeaders(req)
  if (!h) return new Response(null, { status: 403 })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (req.method !== 'POST') return fail(405, 'invalid_request', h)
  try {
    const raw = await req.text()
    if (raw.length > 12000) return fail(413, 'invalid_request', h)
    let body; try { body = JSON.parse(raw) } catch { return fail(400, 'invalid_request', h) }
    const ip = trustedClientIp(req)
    if (!ip) { console.error('client_ip_unavailable'); return fail(503, 'server_error', h) }
    const sb = admin(), key = await limitKey('ip', ipBucket(ip))
    if (!(await allow(sb, 'story_check_hour', key, 15, '1 hour')) || !(await allow(sb, 'story_check_day', key, 60, '1 day')))
      return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (text.length < 10 || text.length > 5000) return fail(400, 'invalid_request', h)
    return respond(200, await checkStory(text, Deno.env.get('ANTHROPIC_API_KEY'), MODEL), h)
  } catch (e) {
    console.error('check-story error', (e as Error).message === 'config' ? 'config' : 'unexpected')
    return fail(500, 'server_error', h)
  }
})
