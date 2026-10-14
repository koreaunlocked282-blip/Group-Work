# Korea Unlocked

A free, non-commercial safety and discrimination-reporting platform for international students in South Korea.

**Status: pre-production prototype.** The backend is partly verified (see [docs/security-gates.md](docs/security-gates.md)). The frontend has **not** been built or tested with a real `npm install` / `vite build`, and nothing is deployed to production hosting.

**Verification status** (details and limits in [docs/security-gates.md](docs/security-gates.md)):

| Gate | Status |
|---|---|
| G1 runtime | Limited pass: failure-path checks only, not full integration proof |
| G2 Step A, local IP tests | 60/60 passed (local tests against the source, not the deployed runtime) |
| G2 live spoof-resistance | **BLOCKED**: no successful live test |
| G3 browser CORS | Not tested |

**Production readiness: not complete.** The production origin, production Turnstile configuration, production secrets and environment (`APP_ENV=production`), and hosting deployment are all still to do.

**Repository contents arrive in stages.** This first baseline contains documentation and configuration only. Frontend source, Supabase migrations and Edge Functions, and tests are added in later, separately approved stages, so some files mentioned below are not in the repository yet.

## Where things live
- **GitHub (this repository):** source code, SQL migrations, configuration templates, tests and documentation only.
- **Supabase (hosted project):** the live database, authentication, deployed Edge Functions and all secrets. Real student reports and user accounts exist only there.
- **Never in this repository:** real reports, user data, API secrets, `.env` files, tracking credentials or key material.

## Stack
- Frontend: a single-page `index.html` with `src/` (**planned for a later stage; not present in this Stage 1 package**), intended to be served with Vite and `@supabase/supabase-js`.
- Supabase: Postgres with row-level security, Auth (email/password, PKCE), and two Edge Functions, `submit-report` and `track-case`.
- Cloudflare Turnstile for anonymous submissions.

## Local setup (not yet verified)
These steps describe the intended workflow. **They have not been run end to end:** no dependency install, lockfile or production build has been completed for this repository, and there is no `package-lock.json` yet.
1. Copy `.env.example` to `.env.local` and fill in the three public `VITE_` values.
2. Install dependencies and start the dev server with the scripts in `package.json` (Node >= 20.19; dev origin `http://localhost:5173`).

## Secrets
Edge Function secrets are stored only in Supabase: `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_SALT` (at least 32 characters) and `ALLOWED_ORIGINS` (exact origins, comma-separated). Set `APP_ENV=production` in production so Cloudflare's dummy Turnstile secrets are refused. Never put the service-role key, the Turnstile secret or the salt in a `VITE_` variable or in this repository.

## Database
`supabase/migrations/` (**planned for a later stage; not present in this Stage 1 package**) will hold the SQL applied to the Supabase project, with the original versions and names. It contains schema, policies, functions and reference data (provinces, districts, universities), and no user data.

## Security design (summary)
- The two functions are public by design (`verify_jwt = false`) so anonymous reporting works. Access control is enforced in code: exact Origin allow-list, client IP taken only from `cf-connecting-ip` (no fallback; missing or invalid value fails closed), salted-hash rate limits, Turnstile verification and Auth-server token validation.
- Raw IP addresses are not stored. Errors are fixed generic codes. Anonymous case tracking uses a server-generated secret that is stored only as a salted hash.
- Several of these properties are not yet verified in the live deployment. See the gate status document before relying on them.

## Tests
`tests/edge/ip-handling/run.mjs` (**planned for a later stage; not present in this Stage 1 package**) is a local, no-network test of the client-IP and rate-limit-key logic. Run it with Node >= 22: `node --experimental-strip-types --no-warnings tests/edge/ip-handling/run.mjs`. It tests a copy of the function source, not the deployed runtime.

## Documentation
- [docs/security-gates.md](docs/security-gates.md): verification status.
- [docs/korea-unlocked-system-architecture.svg](docs/korea-unlocked-system-architecture.svg): architecture diagram.
