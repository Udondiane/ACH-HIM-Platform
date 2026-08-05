# HIM Platform · Operations Runbook (Phase 9)

**Purpose:** Everything the next person needs to run HIM without asking the current KTP Associate. This is what converts "Udo's app" into "a system ACH owns."

**Reading time:** ~30 min · **Bookmark this document.**

**Last reviewed:** 2026-07-22

---

## 1 · What HIM is

HIM (Holistic Impact Metric) is a Next.js 14 + Supabase Postgres platform that operationalises ACH's HIM methodology across:

- Candidate identity + consent management
- HIM assessments (7 domains, 72 factors, 4 timepoints)
- Training programmes + attendance + certificates
- Placements with partners (interview → placement → retention checks)
- AI-assisted second-opinion scoring
- Funder-facing reports

Replaces HACT. Runs the IKEA Bridge to Employment pilot. Extended for the training team.

**What HIM is NOT:** a general-purpose CRM (that's Salesforce, being phased out), a housing management system (that's Rubixx, being onboarded), or a document store (that's SharePoint).

---

## 2 · How to run it locally

```bash
git clone https://github.com/<ACH-org>/HIM-Platform.git
cd HIM-Platform
cp .env.example .env.local
# Fill in .env.local with Supabase URL + anon key + service role key
npm install
npm run dev
# → http://localhost:3000
```

Requires Node 20 (LTS). Optional: Supabase CLI for local Postgres, otherwise point at the shared dev Supabase project.

**First-time gotchas:**

- `NEXT_PUBLIC_AUTH_DISABLED=true` is required until SSO lands — leaves all requests as synthetic ACH-staff user
- If migrations haven't been applied to the DB you point at, the app boots but every read returns an empty array. Apply migrations via Supabase SQL Editor in numerical order.
- Azure OpenAI variables are optional — without them, the AI scoring pipeline is skipped and everything else works.

---

## 3 · Architecture in five sentences

1. Next.js 14 App Router with server components + server actions, deployed on Vercel (target: Azure Container Apps).
2. Postgres database managed by Supabase (target: Azure Database for PostgreSQL Flexible Server, UK South).
3. Every table has RLS enabled with a permissive authenticated-user policy — real enforcement kicks in when SSO (Microsoft Entra ID) replaces `AUTH_DISABLED=true`.
4. AI scoring assist uses Azure OpenAI's GPT-4o (chat) and Whisper (transcription), gated per candidate by explicit consent recorded in `candidate_consent.may_ai_analyse_transcript`.
5. Partners submit interview + placement data via `/report/[token]` — time-boxed tokens scoped to a single partner's placements, no login required.

Full architecture in `00-inventory.md`.

---

## 4 · The five failures most likely to happen

### F1 · "Nothing is loading" (dashboard shows empty rows)

**Cause:** RLS bypass isn't active. Either `NEXT_PUBLIC_AUTH_DISABLED` is unset or `SUPABASE_SERVICE_ROLE_KEY` is missing.

**Fix:**
1. Check Vercel env vars — both must be set for the current deployment
2. Redeploy
3. If just the service key was rotated, update Supabase's key in the env AND rotate the OLD key in Supabase (Settings → API)

### F2 · "Report page 500s"

**Cause:** Usually a schema drift — a migration hasn't run on the target DB.

**Fix:**
1. Check the browser network tab for the failing URL
2. Look at server logs (Vercel Functions tab or Sentry)
3. Search the error text against `supabase/migrations/` — often it's `column X does not exist` because a migration is pending
4. Apply the missing migration via Supabase SQL Editor

### F3 · "IKEA can't fill in the exit report" (403 on `/report/[token]`)

**Cause:** Token expired, revoked, or the placement moved partners.

**Fix:**
1. Go to `/partners/[IKEA-partner-id]` → Partner access tokens card
2. If existing token shows "revoked" or "expired" — generate a new one and email IKEA
3. Confirm the token label so you know who it belongs to
4. Token URL format: `<origin>/report/<token>`

### F4 · "AI scoring returns 429"

**Cause:** Rate limit hit. See `lib/security/rate-limit.ts` for per-endpoint limits.

**Fix:**
1. Confirm it's not an attack — check Vercel Analytics for a spike in requests
2. If legitimate load: adjust the `limit` value in the relevant route file
3. Long term: move rate-limit backend from in-memory to Upstash/Azure Cache for Redis (documented in `02-security.md`)

### F5 · "Migration won't apply"

**Cause:** Usually a naming conflict, a missing prerequisite migration, or a Postgres reserved word (bit us on migration 040 — `current_role` clashes with a Postgres role function).

**Fix:**
1. Read the exact error message
2. Common: `column already exists` → change `add column` to `add column if not exists`
3. Common: reserved word conflict → rename the column
4. Never edit a migration that's already been applied to production — write a new one

---

## 5 · Deploy

### Current (Vercel personal account)

Push to `main` → Vercel auto-deploys to production. Preview deploys on every PR.

### Target (post-migration)

1. Cut a release branch: `release/vX.Y.Z`
2. PR from release branch → `main` (all CI checks must pass)
3. Merge to `main` triggers staging deploy automatically
4. Tag on `main` (`git tag v1.2.3 && git push --tags`) triggers production deploy
5. Vercel/Azure records the deployment as a distinct revision

---

## 6 · Rollback

### App-code rollback

1. In Vercel: Deployments → find the last known-good deploy → "Promote to Production"
2. In Azure Container Apps (post-migration): shift traffic to the previous revision

**One click. Test this once for real before you need it.**

### Database rollback

- **Additive migrations** (add column, add table, add index): rollback = do nothing, forward-only. Safe.
- **Destructive migrations** (drop column, drop table): rollback is impossible without a restore. **Every destructive migration requires DPO + engineering sign-off in the PR.**
- **Data migrations**: write a corresponding "down" script alongside the migration, tested against a staging copy.

**Point-in-time restore** (Supabase Pro plan or Azure Postgres Flexible Server) can recover to any second within the last N days.

---

## 7 · Backups

**Current:** Supabase automatic daily backup, 7-day retention.

**Target (production tier):** 30-day retention + point-in-time restore.

**Restore drill:** every quarter, restore the most recent backup to a temporary Supabase project. Query 5 candidates + confirm data matches expectation. Document date + result in `docs/deployment/restore-drills.md` (to be created on first drill).

---

## 8 · Migrations

**Rule:** Migrations are additive by default. If you're dropping something, you need a written justification in the PR.

**Numbering:** `NNN_snake_case_description.sql`. Always increment.

**Apply order:**
- Local dev: run manually via Supabase SQL Editor or `supabase db push`
- Staging + prod: applied by the deploy pipeline before the app code updates

**Never edit an already-applied migration.** Add a new one that changes what you need.

---

## 9 · Common admin tasks

### Add a new cohort

1. `/cohorts/new` — fill in dates, project, capacity
2. On the cohort detail page, "Link partner to cohort" for each engaged partner
3. Cohort ready to receive candidate enrolments

### Add a new candidate

- Individually: `/candidates/new`
- In bulk: `/candidates/import` (accepts CSV or Excel — matches columns automatically)

### Onboard a new workforce partner

1. `/partners/new` — fill in name, sector, types (at minimum `workforce_partner`), contact
2. On partner detail: add named contacts
3. On partner detail: generate an access token → email URL to their named point-of-contact

### Kick off an AI cohort synthesis

1. `POST /api/ai/synthesize-cohort` with `{ "cohortId": "<uuid>" }`
2. Result stored in `cohort_narrative_synthesis` and shown on the cohort detail page

---

## 10 · Cron jobs

Configured in `vercel.json` (Vercel) or Azure Scheduler (post-migration):

- `/api/cron/recompute-at-risk` — daily 06:00 UTC. Recomputes the at-risk flag based on rule "no support contact in 21 days for enrolled/in_programme candidates."

All cron endpoints require `Authorization: Bearer $CRON_SECRET` header — set the same secret in both the scheduler and the app env vars.

---

## 11 · Named owners

**MUST BE FILLED IN BEFORE THE KTP ENDS.**

| Role | Current | Successor |
|---|---|---|
| Product owner | KTP Associate | ⏳ TBD |
| Engineering — primary | KTP Associate | ⏳ TBD |
| Engineering — backup | none | ⏳ TBD |
| Deployer (only human with prod-deploy access) | KTP Associate | ⏳ TBD |
| Data governance / DPO | ACH DPO | Same |
| Escalation point at Azure OpenAI (post-migration) | N/A | ACH IT |

**Rule for org-wide readiness:** minimum 2 people with primary+backup coverage, both with GitHub access + deploy rights + Supabase project access. No handover moment is complete without this.

---

## 12 · Documentation index

- `docs/deployment/00-inventory.md` — stack, secrets, data sources
- `docs/deployment/01-code-ownership.md` — repo ownership, secret audit, deps
- `docs/deployment/02-security.md` — RLS, authz, rate limits, injection, pentesting
- `docs/deployment/05-pipeline.md` — CI, deploys, environments, rollback
- `docs/deployment/08-compliance.md` — DFD, subprocessors, incident response, GDPR
- `docs/deployment/09-runbook.md` — this document
- `docs/HIM-methodology-spec.md` — the methodology (authoritative)
- `supabase/migrations/*.sql` — every schema change, numbered

**Docs still to write:**
- `03-identity.md` — SSO wiring plan (blocked on Entra ID configuration)
- `04-environments.md` — dev/staging/prod split (blocked on Azure provisioning)
- `06-hosting.md` — Azure Container Apps setup (blocked on ACH Azure decisions)
- `07-observability.md` — Sentry + uptime setup (blocked on tool choice)
- `10-user-guide.md` — end-user documentation per role

---

## 13 · What to do when the current KTP Associate leaves

Immediate checklist for the successor engineer, in this order:

1. **Get GitHub access** to the ACH-owned repo with write + release rights
2. **Get Vercel/Azure access** with deploy rights but NOT direct database access
3. **Get Supabase access** with the read-only role first, then earn write access
4. **Read `docs/deployment/*` in order** (00 → 09)
5. **Deploy a no-op change** (whitespace commit) to prove the pipeline works
6. **Restore a backup** to a staging project to prove that works too
7. **Rotate all secrets** — old KTP Associate's credentials are compromised by definition on departure
8. **Review the last 30 days of Sentry + uptime alerts** if there are any patterns to learn
9. **Meet the DPO, the CEO's assistant, and the workforce partner point-of-contact** for each active partner
10. **Do NOT ship a feature in the first two weeks** — just observe. The system is subtle in places.

---

## Change log

| Date | Change |
|---|---|
| 2026-07-22 | Initial runbook (Phase 9). |
