import { admin, allow, corsHeaders, fail, ipBucket, limitKey, respond, trustedClientIp } from '../_shared/common.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Moderators only: short-lived (5 minute) preview links for evidence files that wait for a decision.
// The caller's session is verified here and their role is read from user_roles; nobody else gets a link.
Deno.serve(async (req) => {
  const h = corsHeaders(req)
  if (!h) return new Response(null, { status: 403 })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (req.method !== 'POST') return fail(405, 'invalid_request', h)
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return fail(401, 'unauthorized', h)
    const raw = await req.text()
    if (raw.length > 2000) return fail(413, 'invalid_request', h)
    let body; try { body = JSON.parse(raw) } catch { return fail(400, 'invalid_request', h) }
    const ids = Array.isArray(body.ids) ? body.ids : null
    if (!ids || ids.length < 1 || ids.length > 12 || !ids.every((x: unknown) => typeof x === 'string' && UUID.test(x))) return fail(400, 'invalid_request', h)

    const sb = admin()
    const { data: u, error: ue } = await sb.auth.getUser(jwt)
    if (ue || !u?.user) return fail(401, 'unauthorized', h)
    const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', u.user.id).in('role', ['moderator', 'admin'])
    if (!roles || !roles.length) return fail(403, 'forbidden', h)

    const ip = trustedClientIp(req)
    if (!ip) return fail(503, 'server_error', h)
    if (!(await allow(sb, 'mod_sign', await limitKey('ip', ipBucket(ip)), 300, '1 hour'))) return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })

    const { data: files } = await sb.from('report_files').select('id,storage_path,kind,mime').in('id', ids).eq('offer_public', true)
    const rows = files ?? []
    const out: Record<string, { kind: string; mime: string; url: string }> = {}
    if (rows.length) {
      const { data: signed, error: se } = await sb.storage.from('evidence').createSignedUrls(rows.map((r) => r.storage_path), 300)
      if (se || !signed) return fail(500, 'server_error', h)
      rows.forEach((r, i) => { const url = signed[i]?.signedUrl; if (url) out[r.id] = { kind: r.kind, mime: r.mime, url } })
    }
    return respond(200, { files: out }, h)
  } catch (e) {
    console.error('moderation error', (e as Error).message === 'config' ? 'config' : 'unexpected')
    return fail(500, 'server_error', h)
  }
})
