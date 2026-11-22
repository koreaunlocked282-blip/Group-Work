import { admin, allow, corsHeaders, fail, ipBucket, limitKey, respond, trustedClientIp } from '../_shared/common.ts'

const TEST_SECRET = /^[123]x0{20,}[A-Z]{2}$/

async function verifyTurnstile(token: unknown, ip: string) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) return false
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) throw new Error('config')
  if (Deno.env.get('APP_ENV') === 'production' && TEST_SECRET.test(secret)) throw new Error('config')
  const form = new FormData()
  form.append('secret', secret); form.append('response', token); form.append('remoteip', ip)
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(5000) })
  if (!r.ok) throw new Error('turnstile_unavailable')
  return (await r.json()).success === true
}

// Anyone can suggest a feature (no account). Bot check + rate limit; only admins can read the suggestions.
Deno.serve(async (req) => {
  const h = corsHeaders(req)
  if (!h) return new Response(null, { status: 403 })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (req.method !== 'POST') return fail(405, 'invalid_request', h)
  try {
    const raw = await req.text()
    if (raw.length > 6000) return fail(413, 'invalid_request', h)
    let b; try { b = JSON.parse(raw) } catch { return fail(400, 'invalid_request', h) }
    const text = typeof b?.body === 'string' ? b.body.trim() : ''
    const contact = typeof b?.contact === 'string' ? b.contact.trim() : ''
    if (text.length < 10 || text.length > 1000 || contact.length > 120) return fail(400, 'invalid_request', h)
    const ip = trustedClientIp(req)
    if (!ip) return fail(503, 'server_error', h)
    const sb = admin()
    if (!(await allow(sb, 'feature_ip', await limitKey('ip', ipBucket(ip)), 5, '1 day'))) return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })
    if (!(await verifyTurnstile(b.turnstile_token, ip))) return fail(400, 'captcha_failed', h)
    const { error } = await sb.rpc('add_feature_request', { _body: text, _contact: contact || null })
    if (error) { console.error('add_feature_request failed', error.code); return fail(500, 'server_error', h) }
    return respond(200, { ok: true }, h)
  } catch (e) {
    console.error('feature-request error', (e as Error).message === 'config' ? 'config' : 'unexpected')
    return fail(500, 'server_error', h)
  }
})
