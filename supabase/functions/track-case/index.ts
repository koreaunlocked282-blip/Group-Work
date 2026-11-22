import { admin, allow, corsHeaders, fail, hashSecret, ipBucket, limitKey, normalizeSecret, respond, trustedClientIp } from '../_shared/common.ts'

const CODE = /^KX-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/

Deno.serve(async (req) => {
  const h = corsHeaders(req)
  if (!h) return new Response(null, { status: 403 })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (req.method !== 'POST') return fail(405, 'invalid_request', h)
  try {
    const raw = await req.text()
    if (raw.length > 2000) return fail(413, 'invalid_request', h)
    let body; try { body = JSON.parse(raw) } catch { return fail(400, 'invalid_request', h) }

    const ip = trustedClientIp(req)
    if (!ip) { console.error('client_ip_unavailable'); return fail(503, 'server_error', h) }

    const sb = admin()
    if (!(await allow(sb, 'track_ip', await limitKey('ip', ipBucket(ip)), 30, '15 minutes')))
      return fail(429, 'rate_limited', h, { 'Retry-After': '900' })

    if (body.action === 'withdraw_story_owner') { // signed-in owner: no tracking secret needed
      const c = typeof body.case_code === 'string' ? body.case_code.trim().toUpperCase() : ''
      const tk = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
      if (!CODE.test(c) || !tk || tk === req.headers.get('apikey') || tk === Deno.env.get('SUPABASE_ANON_KEY')) return fail(400, 'invalid_request', h)
      const { data: u, error: ue } = await sb.auth.getUser(tk)
      if (ue || !u.user) return fail(401, 'unauthorized', h)
      const { data: ok, error: we } = await sb.rpc('withdraw_story', { _case_code: c, _secret_hash: null, _user_id: u.user.id })
      if (we) { console.error('withdraw failed', we.code); return fail(500, 'server_error', h) }
      return ok ? respond(200, { withdrawn: true }, h) : fail(404, 'not_found', h)
    }

    const code = typeof body.case_code === 'string' ? body.case_code.trim().toUpperCase() : ''
    const norm = typeof body.tracking_secret === 'string' ? normalizeSecret(body.tracking_secret) : ''
    if (!CODE.test(code) || norm.length !== 20) return fail(400, 'invalid_request', h)

    // per-case limit stops guessing across many IPs
    if (!(await allow(sb, 'track_code', await limitKey('case', code), 10, '1 hour')))
      return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })

    if (body.action === 'withdraw_story') {
      const { data: ok, error: we } = await sb.rpc('withdraw_story', { _case_code: code, _secret_hash: await hashSecret(norm), _user_id: null })
      if (we) { console.error('withdraw failed', we.code); return fail(500, 'server_error', h) }
      return ok ? respond(200, { withdrawn: true }, h) : fail(404, 'not_found', h)
    }

    const { data, error } = await sb.rpc('get_case_for_tracking', { _case_code: code, _secret_hash: await hashSecret(norm) })
    if (error) { console.error('tracking failed', error.code); return fail(500, 'server_error', h) }
    if (!data) return fail(404, 'not_found', h) // same answer for wrong code and wrong secret
    return respond(200, data, h) // status, verification, timestamps, history notes only. Never the description.
  } catch (e) {
    console.error('track-case error', (e as Error).message === 'config' ? 'config' : 'unexpected')
    return fail(500, 'server_error', h)
  }
})
