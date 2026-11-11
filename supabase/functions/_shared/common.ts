import { createClient } from 'npm:@supabase/supabase-js@2'
import { isIP } from 'node:net'

const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const DEFAULT_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type'
// Plain header-name list: "name, name, ..." using only letters, digits, hyphen and underscore (no '*', no other punctuation, no empty items)
const HEADER_NAME_LIST = /^[A-Za-z0-9_-]+(?:\s*,\s*[A-Za-z0-9_-]+)*$/

// Preflight only: echo the browser's requested header names when they form a plain header-name list
// (so newer supabase-js versions that add headers keep working); otherwise the fixed safe list.
function allowHeadersFor(req: Request): string {
  if (req.method !== 'OPTIONS') return DEFAULT_ALLOW_HEADERS
  const asked = req.headers.get('access-control-request-headers')?.trim()
  if (!asked || asked.length > 1000 || !HEADER_NAME_LIST.test(asked)) return DEFAULT_ALLOW_HEADERS
  return [...new Set(asked.split(',').map((s) => s.trim().toLowerCase()))].join(', ')
}

export function corsHeaders(req: Request): Record<string, string> | null {
  const origin = req.headers.get('origin')
  if (!origin || !ALLOWED.includes(origin)) return null // exact allow-list match, never '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': allowHeadersFor(req),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin, Access-Control-Request-Headers',
  }
}

export function respond(status: number, body: unknown, h: Record<string, string>, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...h, ...extra, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
// Errors are always a fixed code. Never a database message, never user data.
export const fail = (status: number, code: string, h: Record<string, string>, extra: Record<string, string> = {}) =>
  respond(status, { error: { code } }, h, extra)

export const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

export async function sha256hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Trusted client IP: ONLY the single value Cloudflare's edge sets. No x-forwarded-for / x-real-ip fallback.
// Returns null if missing or not exactly one valid IP; callers must then refuse the request.
export function trustedClientIp(req: Request): string | null {
  const v = req.headers.get('cf-connecting-ip')?.trim()
  return v && isIP(v) ? v : null
}

// Rate-limit bucket: IPv4 as-is; IPv6 collapsed to its /64 (one client can rotate inside a /64)
export function ipBucket(ip: string): string {
  if (isIP(ip) === 4) return 'v4:' + ip
  const mapped = ip.match(/^(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) return 'v4:' + mapped[1]
  let g: string[]
  if (ip.includes('::')) {
    const [a, b] = ip.split('::')
    const l = a ? a.split(':') : [], r = b ? b.split(':') : []
    g = [...l, ...Array(8 - l.length - r.length).fill('0'), ...r]
  } else g = ip.split(':')
  return 'v6:' + g.slice(0, 4).map((x) => x.padStart(4, '0').toLowerCase()).join(':')
}

// salted hash: raw IPs and raw case codes are never stored
export async function limitKey(scope: string, value: string) {
  const salt = Deno.env.get('RATE_LIMIT_SALT')
  if (!salt || salt.length < 32) throw new Error('config')
  return sha256hex(`${salt}:${scope}:${value}`)
}

export async function allow(sb: ReturnType<typeof admin>, bucket: string, key: string, max: number, window: string) {
  const { data, error } = await sb.rpc('check_rate_limit', { _bucket: bucket, _key_hash: key, _max: max, _window: window })
  if (error) throw new Error('rate_limit_rpc') // fail closed
  return data === true
}

// 20 chars x 5 bits = 100 bits; 256 % 32 = 0, so no modulo bias
export function newSecret() {
  const b = crypto.getRandomValues(new Uint8Array(20))
  let s = ''
  for (const x of b) s += ALPHABET[x % 32]
  return s.match(/.{4}/g)!.join('-')
}
export const normalizeSecret = (s: string) => s.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '')
export const hashSecret = (normalized: string) => sha256hex(`ku-tracking-secret:${normalized}`)
