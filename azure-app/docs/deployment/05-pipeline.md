# HIM Platform · CI/CD Pipeline (Phase 5)

**Status:** Green — CI configured; deploys still tied to Vercel personal account
**Last reviewed:** 2026-07-22

---

## 1 · Continuous integration

**Config:** `.github/workflows/ci.yml`

Runs on every pull request and every push to `main`. Six parallel jobs:

| Job | What it checks |
|---|---|
| `install` | `npm ci` — installs and caches `node_modules` |
| `lint` | `npm run lint` — ESLint + Next.js recommended rules |
| `typecheck` | `npx tsc --noEmit` — strict TypeScript |
| `test` | `npm test` — Vitest unit tests (currently `lib/scoring/**/*.test.ts`) |
| `build` | `npm run build` — verifies Next.js production build |
| `security-audit` | `npm audit --audit-level=high` + gitleaks secret scan |

**Concurrency:** Duplicate PR pushes cancel previous runs to save minutes.

**Branch protection to apply on `main` (see `01-code-ownership.md` §3):**
- Require `lint`, `typecheck`, `test`, `build`, `security-audit` all pass before merge
- Require review from someone other than PR author
- No direct pushes to `main`

---

## 2 · Test coverage (current + target)

### Current

- `lib/scoring/*.test.ts` — HIM composite scoring, classification, factor rollups
- Vitest configured for TS

### Target for org-wide readiness

The paths that MUST have tests before HIM is called production-ready:

- Auth guard on every server action (once SSO lands)
- RLS enforcement — a small integration test that spins up a Postgres, applies migrations, and verifies a non-privileged user can't read another partner's placements
- Consent gate on AI transcript analysis
- Bulk import — parse a known-good CSV, verify row count + a spot check
- Placement offer + retention check upserts (idempotency)
- Rate limit — verify 429 after N calls

**Estimated test suite build:** ~1–2 days of engineering to hit "the paths that would embarrass us if they broke."

---

## 3 · Continuous deployment

### Current

- **Vercel** auto-deploys on push to `main` (personal account, personal repo)
- Preview deploys created per pull request

### Target for org-wide

**Environments:**

| Environment | Purpose | Data | Deploy trigger |
|---|---|---|---|
| **Development** | Local dev on engineer's laptop | Local dev DB or shared dev Supabase | `npm run dev` |
| **Staging** | Integration testing, product review | Anonymised subset of production or synthetic data | Push to `main` |
| **Production** | ACH live | Real ACH data | Tag `v*` on `main` |

Each environment has its own Vercel/Azure project, its own Supabase project (or DB), its own env vars, and its own domain.

**Guardrails:**
- Production deploys require a tagged release + optional manual approval in Vercel/Azure
- No human has write credentials that can reach production DB — deploys happen through the pipeline, all migrations too
- Rollback: previous Vercel deployment is one click; DB rollback runs the down migration from the pipeline

---

## 4 · Database migration in CI

**Current:** Migrations applied manually to Supabase via SQL Editor.

**Target:**
- New migration files added under `supabase/migrations/` in the PR
- CI step runs migrations against a fresh test Postgres to verify they apply cleanly
- On production deploy, the pipeline runs `supabase db push` (or equivalent) against the production DB *before* the app updates
- Rollback plan documented per migration if it can't be undone by re-running previous state

**Safety rule:** No `DROP TABLE`, no `DROP COLUMN` without ACH data-governance sign-off. Column drops use a two-phase approach: mark as unused → deploy → drop in a later release.

---

## 5 · Preview deploys

Every PR gets a preview URL from Vercel — automatic today, worth preserving. Post-migration to Azure Container Apps, preview deploys are configurable but less automatic; alternative is Azure Static Web Apps' PR preview slots.

---

## 6 · Rollback

**Vercel current:** Every deploy is a distinct URL. Rolling back = promoting a previous deployment to production. One click.

**Post-Azure:** Azure Container Apps supports revision-based deploys — set a previous revision to 100% traffic to roll back.

**Document per release:** the rollback command must be one line, tested at least once for real (not just theoretically), and known to whoever's on call.

---

## 7 · Secrets in CI

**Never:**
- Log secret values (mask them in GH Actions — the default when set as encrypted secrets)
- Give the CI service account credentials that reach production DB or storage
- Store secrets in the workflow YAML itself

**Do:**
- Store all secrets in GitHub Actions encrypted secrets (Repository Settings → Secrets and variables → Actions)
- Reference as `${{ secrets.NAME }}`
- Rotate every 90 days or on staff departure

Placeholder build-time env vars in the CI config are safe non-secret values (e.g. dummy Supabase URLs) — only for the build to succeed.

---

## 8 · What's still open

| Item | Blocker |
|---|---|
| Wire migration application into CI | Needs a decision on whether to keep Supabase or migrate to Azure Postgres |
| Add integration tests for RLS enforcement | Post-SSO |
| Move Vercel to ACH team account | ACH IT |
| Add staging environment | ACH hosting provisioned |
| Add release-tagging + changelog automation | Post-migration to ACH GitHub org |

---

## Change log

| Date | Change |
|---|---|
| 2026-07-22 | Initial CI configured (`ci.yml`). Six jobs: install, lint, typecheck, test, build, security-audit. Deploy pipeline pending Azure migration. |
