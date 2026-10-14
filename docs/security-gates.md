# Security gate status

Last updated: 2026-10-14. This document records what has actually been verified, and what has not.

| Gate | Status | What it means |
|---|---|---|
| G1: runtime | **Limited pass (failure paths only)** | Both Edge Functions boot in the real Supabase runtime and return the expected error responses. This is **not** full integration proof. |
| G2 Step A: local IP tests | **Passed (60/60)** | Local, no-network tests against the repository source. Not the deployed runtime. |
| G2: live spoof-resistance | **BLOCKED** | No successful live spoof-resistance test exists. |
| G3: browser CORS | **Not tested** | |

## G1: limited runtime failure-path checks
One request to each function, from localhost, with a dummy Turnstile token and an invalid tracking code:
- `submit-report` returned HTTP 400 `captcha_failed`; `track-case` returned HTTP 404 `not_found`.
- Both responses carried `Access-Control-Allow-Origin: http://localhost:5173`.
- Function logs showed normal boots and no runtime errors. The rate-limit function was reached and stored four rows with 64-character hexadecimal key hashes. The report tables stayed empty.

Not covered: a successful report submission, a signed-in submission, successful tracking, the Turnstile success path, a rate-limit refusal, a bearer-token check, and a browser-originated request. The identity of the configured Turnstile secret was not confirmed. The platform reports function version 4 while the deployed bundle hashes are unchanged since deployment; the reason for the version number is unexplained.

## G2 Step A: local tests, 60/60 passed
`tests/edge/ip-handling/run.mjs` ran against a copy of the `submit-report` source with only the `npm:` import replaced by a local stub. It checked that `X-Forwarded-For`, `X-Real-IP` and `Forwarded` never supply the client IP, that changing them does not change the derived rate-limit key, that missing, empty, malformed and multi-value `CF-Connecting-IP` values fail closed, that IPv4, IPv4-mapped IPv6 and IPv6 /64 bucketing behave as specified, and that identical trusted IPs give identical keys while different IPs give different keys. It ran on Node, not Deno or the Supabase runtime.

## G2 live verification: BLOCKED
A live request that included a client-supplied `CF-Connecting-IP` header was rejected by Cloudflare (HTTP 403, error code 1000) before it reached the function. Cloudflare's documentation lists a client-sent `CF-Connecting-IP` header among the causes of that error, but the exact trigger was not isolated. There has been **no successful live spoof-resistance test**. Not shown live: that forged forwarding headers leave the rate-limit key unchanged, and that the key follows each client's real IP rather than one shared value.

## G3: browser CORS
Not tested. Preflight behaviour, requested-header handling and invalid-Origin rejection have not been verified in a real browser against the deployed functions.

## Other open items
- No `npm install`, lockfile or `vite build` has been completed.
- Four rate-limit test rows from G1 remain in the database and need cleanup before production.
- Production Turnstile keys, production secrets, `APP_ENV=production`, and the production origin in `ALLOWED_ORIGINS` are not configured.
- No production hosting deployment exists.
