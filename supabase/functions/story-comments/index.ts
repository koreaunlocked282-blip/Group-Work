// story-comments: post, report or delete a comment on an approved public story.
// Posting and deleting need a signed-in user. The public version of a comment goes through the same automatic
// check as stories (phone numbers, emails, ID numbers, people's names, business details) and is never published
// if that check is unavailable. Reports are one per device per comment (salted hash); 3 reports hide a comment.
import { admin, allow, corsHeaders, fail, ipBucket, limitKey, respond, trustedClientIp } from '../_shared/common.ts'
import { checkStory } from '../_shared/story-check.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEVICE = /^[0-9a-f]{32}$/
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|kr|io|co|me|ly|xyz|site)\b)/i
const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-haiku-5-5'

Deno.serve(async (req) => {
  const h = corsHeaders(req)
  if (!h) return new Response(null, { status: 403 })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (req.method !== 'POST') return fail(405, 'invalid_request', h)
  try {
    const raw = await req.text()
    if (raw.length > 4000) return fail(413, 'invalid_request', h)
    let b; try { b = JSON.parse(raw) } catch { return fail(400, 'invalid_request', h) }
    const action = b.action
    const ip = trustedClientIp(req)
    if (!ip) return fail(503, 'server_error', h)
    const sb = admin(), ipk = await limitKey('ip', ipBucket(ip))
    if (!(await allow(sb, 'cm_ip_hour', ipk, 150, '1 hour'))) return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })

    if (action === 'report') {
      const id = typeof b.comment_id === 'string' ? b.comment_id.toLowerCase() : '', dev = typeof b.device === 'string' ? b.device.toLowerCase() : ''
      if (!UUID.test(id) || !DEVICE.test(dev)) return fail(400, 'invalid_request', h)
      const { data, error } = await sb.rpc('report_story_comment', { _comment: id, _reporter: await limitKey('cmreport:' + id, dev) })
      if (error) return error.code === 'P0002' ? fail(404, 'not_found', h) : fail(500, 'server_error', h)
      return respond(200, { reports: data }, h)
    }

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return fail(401, 'unauthorized', h)
    const { data: u, error: ue } = await sb.auth.getUser(jwt)
    if (ue || !u?.user) return fail(401, 'unauthorized', h)
    const uid = u.user.id

    if (action === 'delete') {
      const id = typeof b.comment_id === 'string' ? b.comment_id.toLowerCase() : ''
      if (!UUID.test(id)) return fail(400, 'invalid_request', h)
      const { data } = await sb.rpc('delete_own_comment', { _comment: id, _author: uid })
      return data ? respond(200, { deleted: true }, h) : fail(404, 'not_found', h)
    }

    if (action === 'post') {
      const story = typeof b.story_id === 'string' ? b.story_id.toLowerCase() : ''
      const parent = typeof b.parent_id === 'string' ? b.parent_id.toLowerCase() : null
      const text = typeof b.text === 'string' ? b.text.replace(/\s+\n/g, '\n').trim() : ''
      if (!UUID.test(story) || (parent !== null && !UUID.test(parent)) || text.length < 1 || text.length > 800) return fail(400, 'invalid_request', h)
      if (LINK.test(text)) return respond(422, { error: 'no_links' }, h)
      const uk = await limitKey('cmuser', uid)
      if (!(await allow(sb, 'cm_user_hour', uk, 12, '1 hour')) || !(await allow(sb, 'cm_user_day', uk, 40, '1 day')))
        return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })
      const chk = await checkStory(text, Deno.env.get('ANTHROPIC_API_KEY'), MODEL)
      if (chk.unavailable) return fail(503, 'check_unavailable', h)
      if (!chk.clean) return respond(422, { error: 'needs_cleaning', cleaned: chk.cleaned, reasons: chk.reasons }, h)
      const { data, error } = await sb.rpc('add_story_comment', { _story: story, _parent: parent, _author: uid, _body: text })
      if (error) return error.code === 'P0002' ? fail(404, 'not_found', h) : fail(500, 'server_error', h)
      return respond(200, { id: data }, h)
    }
    return fail(400, 'invalid_request', h)
  } catch (e) {
    console.error('story-comments error', (e as Error).message === 'config' ? 'config' : 'unexpected')
    return fail(500, 'server_error', h)
  }
})
