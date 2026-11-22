import { checkStory } from '../_shared/story-check.ts'
import { admin, allow, corsHeaders, fail, hashSecret, ipBucket, limitKey, newSecret, normalizeSecret, respond, trustedClientIp } from '../_shared/common.ts'

const CATEGORY = ['university_classroom','workplace_parttime','housing_landlord','public_service_business','racism','language_discrimination','harassment_verbal','online_harassment','immigration_admin','public_transport_space','healthcare_service','other']
const TREATMENT = ['discrimination','harassment','refusal_of_service','unfair_treatment','threat','other']
const RESOLUTION = ['unresolved','resolved','partly_resolved','ongoing']
const HELP = ['none','university_office','employer','police','labor_or_human_rights_office','other']
const VISIBILITY = ['private','pattern_after_review','public_after_review']
const WORKPLACE = ['part_time_job','restaurant','factory','delivery','retail','other_workplace']
const HOUSING = ['landlord','real_estate_agency','dormitory','shared_housing','rental_contract','other_housing']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DISTRICT = /^[a-z0-9-]{3,80}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TEST_SECRET = /^[123]x0{20,}[A-Z]{2}$/ // Cloudflare's published dummy secrets

const okDate = (v: unknown) => {
  if (typeof v !== 'string' || !DATE.test(v)) return false
  const d = new Date(v + 'T00:00:00Z')
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

// whitelist: unknown fields are ignored (so user_id, email, address etc. are never read); invalid -> null
// deno-lint-ignore no-explicit-any
function parse(b: any) {
  if (typeof b !== 'object' || b === null) return null
  const one = (v: unknown, set: string[]) => (typeof v === 'string' && set.includes(v) ? v : null)
  const category = one(b.category, CATEGORY), treatment = one(b.treatment, TREATMENT)
  const resolution = one(b.resolution ?? 'unresolved', RESOLUTION), help = one(b.help_sought ?? 'none', HELP)
  const visibility = one(b.visibility ?? 'private', VISIBILITY), language = one(b.language ?? 'en', ['en', 'ko'])
  const workplace = b.workplace_category ? one(b.workplace_category, WORKPLACE) : null
  const housing = b.housing_category ? one(b.housing_category, HOUSING) : null
  const university = b.university_id ? (typeof b.university_id === 'string' && UUID.test(b.university_id) ? b.university_id : 'bad') : null
  const description = typeof b.description === 'string' ? b.description.trim() : ''
  const district = typeof b.district_code === 'string' && DISTRICT.test(b.district_code) ? b.district_code : null
  const consent = b.pattern_consent === true || visibility === 'public_after_review'
  if (!category || !treatment || !resolution || !help || !visibility || !language || !district) return null
  if ((b.workplace_category && !workplace) || (b.housing_category && !housing) || university === 'bad') return null
  if (description.length < 10 || description.length > 5000) return null
  if (!okDate(b.date_from) || !okDate(b.date_to) || b.date_from > b.date_to) return null
  if (consent && visibility !== 'pattern_after_review' && visibility !== 'public_after_review') return null
  const publicText = typeof b.public_text === 'string' ? b.public_text.trim() : ''
  if (visibility === 'public_after_review' && (publicText.length < 10 || publicText.length > 5000)) return null
  return { publicText, category, treatment, description, district, university, workplace, housing, dateFrom: b.date_from, dateTo: b.date_to, resolution, help, visibility, consent, language }
}

async function verifyTurnstile(token: unknown, ip: string) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) return false
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) throw new Error('config')
  // production guard: the dummy secret accepts the public dummy token, so it must never run in production
  if (Deno.env.get('APP_ENV') === 'production' && TEST_SECRET.test(secret)) throw new Error('config')
  const form = new FormData()
  form.append('secret', secret); form.append('response', token); form.append('remoteip', ip)
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(5000) })
  if (!r.ok) throw new Error('turnstile_unavailable') // fail closed
  return (await r.json()).success === true
}

Deno.serve(async (req) => {
  const h = corsHeaders(req)
  if (!h) return new Response(null, { status: 403 })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
  if (req.method !== 'POST') return fail(405, 'invalid_request', h)
  try {
    const raw = await req.text()
    if (raw.length > 20000) return fail(413, 'invalid_request', h)
    let body; try { body = JSON.parse(raw) } catch { return fail(400, 'invalid_request', h) }

    // no trustworthy client IP -> refuse safely (no fallback, no shared bucket)
    const ip = trustedClientIp(req)
    if (!ip) { console.error('client_ip_unavailable'); return fail(503, 'server_error', h) }

    const sb = admin(), key = await limitKey('ip', ipBucket(ip))
    if (!(await allow(sb, 'submit_hour', key, 5, '1 hour')) || !(await allow(sb, 'submit_day', key, 20, '1 day')))
      return fail(429, 'rate_limited', h, { 'Retry-After': '3600' })

    const p = parse(body)
    if (!p) return fail(400, 'invalid_request', h)

    // signed-in only if the Auth server accepts the bearer token; the user id never comes from the body
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    const isProjectKey = !token || token === req.headers.get('apikey') || token === Deno.env.get('SUPABASE_ANON_KEY')
    let userId: string | null = null
    if (!isProjectKey) {
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data.user) return fail(401, 'unauthorized', h)
      userId = data.user.id
    }

    if (!(await verifyTurnstile(body.turnstile_token, ip))) return fail(400, 'captcha_failed', h)

    // Public version: checked again on the server (the browser preview is only a convenience).
    // Clean text is published at once; otherwise the redacted text is held for the moderator. Fail closed.
    let storyAuto = false, storyText: string | null = null, storyNotes: string | null = null
    if (p.visibility === 'public_after_review') {
      const v = await checkStory(p.publicText, Deno.env.get('ANTHROPIC_API_KEY'), Deno.env.get('AI_MODEL') ?? 'claude-haiku-5-5')
      storyAuto = v.clean && !v.unavailable
      storyText = storyAuto ? p.publicText : v.cleaned
      storyNotes = storyAuto ? null : (v.unavailable ? 'Automatic check unavailable. ' : '') + v.reasons.join('; ')
    }

    const secret = userId ? null : newSecret()
    const secretHash = secret ? await hashSecret(normalizeSecret(secret)) : null

    const { data, error } = await sb.rpc('submit_report', {
      _category: p.category, _treatment: p.treatment, _description: p.description, _district_code: p.district,
      _university_id: p.university, _workplace_category: p.workplace, _housing_category: p.housing,
      _date_from: p.dateFrom, _date_to: p.dateTo, _resolution: p.resolution, _help_sought: p.help,
      _visibility: p.visibility, _pattern_consent: p.consent, _language: p.language,
      _user_id: userId, _secret_hash: secretHash,
      _public_text: storyText, _public_auto: storyAuto, _check_notes: storyNotes,
    })
    if (error) {
      console.error('submit_report failed', error.code) // code only: no message, no content
      return error.code === '22023' ? fail(400, 'invalid_request', h) : fail(500, 'server_error', h)
    }
    const out: Record<string, unknown> = secret ? { case_code: data, tracking_secret: secret } : { case_code: data }
    if (p.visibility === 'public_after_review') out.story = storyAuto ? 'published' : 'held'
    return respond(201, out, h)
  } catch (e) {
    console.error('submit-report error', (e as Error).message === 'config' ? 'config' : 'unexpected')
    return fail(500, 'server_error', h)
  }
})
