# HIM Platform · Security Hardening Audit (Phase 2)

**Status:** Amber (RLS gap fixed, rate limiting added, SSO still to land)
**Last audit:** 2026-07-22
**Auditor:** KTP Associate (self-audit — needs independent pen test at cutover)

---

## 1 · Row-level security audit

**Method:** Programmatic scan of `supabase/migrations/*.sql` — every `create table public.X` compared against every `alter table public.X enable row level security` (both static and dynamic-SQL variants).

**Result:** 69 tables total.

| Category | Count |
|---|---|
| RLS enabled with authenticated-user policy | 65 |
| Reference-only tables (RLS not strictly required — public lookup data) | 3 |
| **Gaps found and fixed in this pass** | **1** |

### The gap

`cohort_toms_claims` (created in `016_evidence_packs.sql`) had no RLS enablement.

### Fix

Migration `044_rls_coverage_gap_fix.sql` enables RLS on:
- `cohort_toms_claims` (the actual gap)
- `sroi_proxies`, `toms_codes`, `toms_crosswalk` (reference tables — RLS added defense-in-depth, not strictly required)

All four now have the platform's standard permissive authenticated-user policy: `for all to authenticated using (true) with check (true)`.

### RLS becomes real when SSO lands

Every current RLS policy grants blanket access to any authenticated user. That's because `AUTH_DISABLED=true` means the server uses the Supabase service-role key which bypasses RLS entirely. **The moment SSO wires the current user identity through to the database session, the existing per-table policies (with roles like `is_ach_staff()` and `current_partner_id()`) become the actual enforcement layer.** See `03-identity.md`.

---

## 2 · Server-side authorisation audit

**Pattern in use:** Every mutating operation lives in a `'use server'` action or an API route. No mutations happen from the browser directly. Zod schemas validate input on the server before any database write.

**Verified:**
- All server actions in `lib/*/actions.ts` are marked `'use server'`
- All API routes explicitly parse and validate their JSON body before use
- No authorisation checks are done in browser code (client components) — all lives server-side
- All Supabase writes use the wrapped `createClient()` from `lib/supabase/server.ts`, never a browser-side write

**Gap noted for post-SSO:** the current permissive RLS means "authorization" is enforced by the app layer, not the database. Post-SSO, the RLS policies become the second layer of defense so an app-layer bug doesn't leak everything.

---

## 3 · SQL injection audit

**Method:** Every database call in `lib/` and `app/api/` reviewed for parameterisation.

**Result:** All database access goes through `@supabase/supabase-js` query builder, which parameterises every value. Zero manual SQL string concatenation. Zero `raw()` / literal SQL construction from user input.

**Verified.** No injection risk from application code.

---

## 4 · Rate limiting

**New in this pass:** `lib/security/rate-limit.ts` — simple in-memory token-bucket limiter.

Applied to the four most expensive endpoints:

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/ai/score-factor` | 30 requests | per minute per IP |
| `POST /api/ai/analyze-transcript` | 20 requests | per minute per IP |
| `POST /api/ai/transcribe` | 15 requests | per minute per IP (Whisper is expensive) |
| `POST /api/ai/synthesize-cohort` | 10 requests | per minute per IP |

**Limitation:** In-memory means per-instance. Multiple Vercel/Azure Container App instances get independent counters. For serious production, swap the in-memory backend for Upstash Ratelimit or Azure Cache for Redis behind the same `checkRateLimit()` interface. **Documented in the file's header comment.**

**Not yet rate limited:**
- Server actions (write paths) — recommended addition post-SSO with per-user throttling
- Bulk import endpoint — bounded by file size
- `/api/cron/*` endpoints — protected by shared `CRON_SECRET` header

---

## 5 · Input validation

**Pattern:** All server actions use Zod schemas (`lib/*/schema.ts`). API routes parse `req.json()` inside a try/catch and validate required fields before use.

**Verified:**
- Zod schemas cover every server action input
- Every API route explicitly checks required fields
- File uploads (bulk import, audio) validate size and MIME type before processing
- No user input is passed unvalidated to `eval`, `Function`, `new Function`, or shell commands — no such patterns exist in the codebase

---

## 6 · Output encoding + error handling

**React protects against XSS** by default (React auto-escapes text content in JSX). No `dangerouslySetInnerHTML` outside of controlled markdown-rendering surfaces.

**Server error handling:** All server actions and API routes return structured `{ ok: false, error: string }` responses. No stack traces returned to the client. No internal error details leak.

**Client error handling:** UI shows friendly toast/inline error messages. Full error details logged server-side only (Sentry integration pending — see `07-observability.md`).

---

## 7 · Secret exposure in browser bundle

Verified in Phase 1 (`01-code-ownership.md` §2). Only `NEXT_PUBLIC_*` prefixed variables are inlined in the client bundle. All service-role and API keys stay server-only.

---

## 8 · Authentication (currently deferred)

**Current state:** `AUTH_DISABLED=true` — every request is treated as an ACH-staff synthetic user. This is intentional for the pre-production pilot but is the biggest single security gap for org-wide rollout.

**Path to remediation:** wire Microsoft Entra ID SSO — see `03-identity.md` for the full plan. Nothing else in security signs off cleanly until this lands.

---

## 9 · Dependency vulnerabilities

Covered in `01-code-ownership.md` §4. `npm audit` will be added as a merge-blocking check in the CI pipeline (see `05-pipeline.md`).

---

## 10 · Session/cookie hygiene (post-SSO)

**Post-SSO, ensure:**
- Cookies flagged `HttpOnly`, `Secure`, `SameSite=Lax` (Entra ID adapter defaults get this right)
- Session tokens short-lived with refresh flow
- CSRF token on every state-changing form (Next.js server actions get this by design for same-origin submissions)
- Logout endpoint clears session AND server-side revokes token

---

## 11 · CORS

**Current state:** Same-origin only. No `Access-Control-Allow-Origin: *` anywhere. All API routes are same-origin from the Next.js app.

**Verify at deployment:** if any cross-origin call is added later (e.g. from a marketing subdomain), tighten CORS to a specific allowed origins list.

---

## 12 · What's still open (post this pass)

| Item | Blocker | Priority |
|---|---|---|
| Enforce SSO (kill AUTH_DISABLED) | ACH Entra ID configuration | 🔴 Critical for org-wide |
| Rewrite RLS with real identity | SSO landing | 🔴 Critical |
| Audit-log immutability + retention | Post-SSO | 🟡 Important |
| Move rate-limit backend to distributed store | ACH hosting decision | 🟡 Important |
| Independent pen test | Post-SSO + Azure migration | 🟡 Important |
| Content Security Policy header | Ready to add — recommend `next.config.js` update | 🟢 Nice-to-have |
| Sub-Resource Integrity for third-party scripts | Currently no third-party scripts loaded | 🟢 Not urgent |

---

## 13 · The three risks worth naming to leadership

1. **The AUTH_DISABLED flag is a real risk right now.** If the current production URL is shared with someone unintended, they have full ACH-staff-level access. **Mitigation:** URL is only shared with ACH staff, no crawlers, and Vercel Deployment Protection is on. But it's not audit-safe.
2. **Rate limits are per-instance in-memory.** Under attack from a distributed source, or with the app scaled across multiple instances, limits don't compose. **Mitigation:** at pilot scale, single Vercel instance — this is fine. At org-wide, migrate to Upstash or Azure Cache for Redis before scale-out.
3. **Governance mechanically depends on Azure migration.** All the technical controls above are dependent on ACH owning the infrastructure. Until the platform runs on ACH-controlled accounts with ACH-signed DPAs, the compliance story is incomplete.

---

## Change log

| Date | Change |
|---|---|
| 2026-07-22 | Initial security audit (Phase 2). Fixed `cohort_toms_claims` RLS gap via migration 044. Added rate limiting to 4 AI endpoints via `lib/security/rate-limit.ts`. All other checks passed. |
