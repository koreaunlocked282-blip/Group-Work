import { admin, allow, corsHeaders, fail, hashSecret, ipBucket, limitKey, normalizeSecret, respond, trustedClientIp } from '../_shared/common.ts'

const CODE = /^KX-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/
const MAX_BYTES = 10 * 1024 * 1024
const MAX_FILES = 4
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
}

// what the file really is, from its first bytes (never trust the name or the declared type)
function sniff(b: Uint8Array): { kind: 'image' | 'audio'; mime: string } | null {
  const s = (i: number, t: string) => [...t].every((c, k) => b[i + k] === c.charCodeAt(0))
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', mime: 'image/jpeg' }
  if (b[0] === 0x89 && s(1, 'PNG')) return { kind: 'image', mime: 'image/png' }
  if (s(0, 'RIFF') && s(8, 'WEBP')) return { kind: 'image', mime: 'image/webp' }
  if (s(0, 'RIFF') && s(8, 'WAVE')) return { kind: 'audio', mime: 'audio/wav' }
  if (s(0, 'OggS')) return { kind: 'audio', mime: 'audio/ogg' }
  if (s(0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { kind: 'audio', mime: 'audio/mpeg' }
  if (s(4, 'ftyp')) return { kind: 'audio', mime: 'audio/mp4' }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: 'audio', mime: 'audio/webm' }
  return null
}

Deno.serve(async (req) => {
  const h = corsHeaders(req)
  if (!h) return new Response(null, { status: 403 })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (req.method !== 'POST') return fail(405, 'invalid_request', h)
  try {
    const raw = await req.text()
    if (raw.length > 6000) return fail(413, 'invalid_request', h)
    let body; try { body = JSON.parse(raw) } catch { return fail(400, 'invalid_request', h) }
    if (body.action !== 'prepare' && body.action !== 'finalize') return fail(400, 'invalid_request', h)

    const ip = trustedClientIp(req)
    if (!ip) { console.error('client_ip_unavailable'); return fail(503, 'server_error', h) }
    const sb = admin()
    if (!(await allow(sb, 'evidence_ip', await limitKey('ip', ipBucket(ip)), 40, '1 hour')))
      return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })

    const code = typeof body.case_code === 'string' ? body.case_code.trim().toUpperCase() : ''
    if (!CODE.test(code)) return fail(400, 'invalid_request', h)
    if (!(await allow(sb, 'evidence_case', await limitKey('case', code), 20, '1 hour')))
      return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })

    // who is asking: tracking secret (anonymous report) or the signed-in owner
    let reportId: string | null = null
    const norm = typeof body.tracking_secret === 'string' ? normalizeSecret(body.tracking_secret) : ''
    if (norm.length === 20) {
      const { data } = await sb.rpc('evidence_report', { _case_code: code, _secret_hash: await hashSecret(norm), _user_id: null })
      reportId = data ?? null
    } else {
      const tk = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
      if (!tk || tk === req.headers.get('apikey') || tk === Deno.env.get('SUPABASE_ANON_KEY')) return fail(400, 'invalid_request', h)
      const { data: u, error: ue } = await sb.auth.getUser(tk)
      if (ue || !u.user) return fail(401, 'unauthorized', h)
      const { data } = await sb.rpc('evidence_report', { _case_code: code, _secret_hash: null, _user_id: u.user.id })
      reportId = data ?? null
    }
    if (!reportId) return fail(404, 'not_found', h)

    const files = Array.isArray(body.files) ? body.files : null
    if (!files || files.length < 1 || files.length > MAX_FILES) return fail(400, 'invalid_request', h)
    const { data: have } = await sb.rpc('evidence_count', { _report_id: reportId })
    if ((have ?? 0) + files.length > MAX_FILES) return fail(400, 'too_many_files', h)
    const bucket = sb.storage.from('evidence')

    if (body.action === 'prepare') {
      const out: { path: string; token: string }[] = []
      for (const f of files) {
        const ext = typeof f?.type === 'string' ? EXT[f.type] : undefined
        if (!ext || !Number.isInteger(f.size) || f.size < 1 || f.size > MAX_BYTES) return fail(400, 'invalid_file', h)
        const path = `${reportId}/${crypto.randomUUID()}.${ext}`
        const { data, error } = await bucket.createSignedUploadUrl(path)
        if (error || !data) { console.error('signed upload url failed'); return fail(500, 'server_error', h) }
        out.push({ path, token: data.token })
      }
      return respond(200, { uploads: out }, h)
    }

    // finalize: check every uploaded object, keep the good ones
    let saved = 0, rejected = 0
    for (const f of files) {
      const path = typeof f?.path === 'string' ? f.path : ''
      if (!path.startsWith(reportId + '/') || path.includes('..') || path.length > 120) { rejected++; continue }
      const { data: blob, error } = await bucket.download(path)
      if (error || !blob) { rejected++; continue }
      const kind = blob.size >= 1 && blob.size <= MAX_BYTES ? sniff(new Uint8Array(await blob.slice(0, 16).arrayBuffer())) : null
      if (!kind) { await bucket.remove([path]); rejected++; continue }
      const { data: ok, error: ae } = await sb.rpc('add_report_file', { _report_id: reportId, _path: path, _kind: kind.kind, _mime: kind.mime, _bytes: blob.size, _offer: f.offer === true })
      if (ae || !ok) { await bucket.remove([path]); rejected++; continue }
      saved++
    }
    return respond(200, { saved, rejected }, h)
  } catch (e) {
    console.error('evidence error', (e as Error).message === 'config' ? 'config' : 'unexpected')
    return fail(500, 'server_error', h)
  }
})
