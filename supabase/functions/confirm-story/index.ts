// confirm-story: a reader confirms an approved public story. One confirmation per salted client hash per story.
import { admin, allow, corsHeaders, fail, ipBucket, limitKey, respond, trustedClientIp } from '../_shared/common.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const h = corsHeaders(req)
  if (!h) return new Response(null, { status: 403 })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (req.method !== 'POST') return fail(405, 'invalid_request', h)
  try {
    const raw = await req.text()
    if (raw.length > 500) return fail(413, 'invalid_request', h)
    let body; try { body = JSON.parse(raw) } catch { return fail(400, 'invalid_request', h) }
    const story = typeof body.story_id === 'string' ? body.story_id.toLowerCase() : ''
    if (!UUID.test(story)) return fail(400, 'invalid_request', h)
    const ip = trustedClientIp(req)
    if (!ip) { console.error('client_ip_unavailable'); return fail(503, 'server_error', h) }
    const sb = admin(), bucket = ipBucket(ip), rl = await limitKey('ip', bucket)
    if (!(await allow(sb, 'story_confirm_hour', rl, 30, '1 hour')) || !(await allow(sb, 'story_confirm_day', rl, 100, '1 day')))
      return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })
    const voter = await limitKey('confirm:' + story, bucket)
    const { data, error } = await sb.rpc('confirm_story', { _story: story, _voter: voter })
    if (error) {
      if (error.code === 'P0002') return fail(404, 'not_found', h)
      throw new Error('rpc')
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return fail(404, 'not_found', h)
    return respond(200, { confirmations: row.total, added: row.added }, h)
  } catch (e) {
    console.error('confirm-story error', (e as Error).message === 'config' ? 'config' : 'unexpected')
    return fail(500, 'server_error', h)
  }
})
