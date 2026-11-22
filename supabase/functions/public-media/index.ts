import { admin, allow, corsHeaders, fail, ipBucket, limitKey, respond, trustedClientIp } from '../_shared/common.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Short-lived links for files that the author offered AND a moderator approved, on stories that are currently published.
Deno.serve(async (req) => {
  const h = corsHeaders(req)
  if (!h) return new Response(null, { status: 403 })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (req.method !== 'POST') return fail(405, 'invalid_request', h)
  try {
    const raw = await req.text()
    if (raw.length > 2000) return fail(413, 'invalid_request', h)
    let body; try { body = JSON.parse(raw) } catch { return fail(400, 'invalid_request', h) }
    const ids = Array.isArray(body.ids) ? body.ids : null
    if (!ids || ids.length < 1 || ids.length > 12 || !ids.every((x: unknown) => typeof x === 'string' && UUID.test(x))) return fail(400, 'invalid_request', h)

    const ip = trustedClientIp(req)
    if (!ip) { console.error('client_ip_unavailable'); return fail(503, 'server_error', h) }
    const sb = admin()
    if (!(await allow(sb, 'media_ip', await limitKey('ip', ipBucket(ip)), 300, '1 hour')))
      return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })

    const { data, error } = await sb.rpc('public_media_for', { _ids: ids })
    if (error) { console.error('public_media_for failed', error.code); return fail(500, 'server_error', h) }
    const rows = (data ?? []) as { report_id: string; storage_path: string; kind: string; mime: string }[]
    const media: Record<string, { kind: string; mime: string; url: string }[]> = {}
    if (rows.length) {
      const { data: signed, error: se } = await sb.storage.from('evidence').createSignedUrls(rows.map((r) => r.storage_path), 3600)
      if (se || !signed) return fail(500, 'server_error', h)
      rows.forEach((r, i) => {
        const url = signed[i]?.signedUrl
        if (url) (media[r.report_id] ??= []).push({ kind: r.kind, mime: r.mime, url })
      })
    }
    return respond(200, { media }, h)
  } catch (e) {
    console.error('public-media error', (e as Error).message === 'config' ? 'config' : 'unexpected')
    return fail(500, 'server_error', h)
  }
})
