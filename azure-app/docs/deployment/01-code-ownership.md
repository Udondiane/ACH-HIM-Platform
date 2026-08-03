# HIM Platform · Code Ownership + Secret-Hygiene Audit (Phase 1)

**Status:** Green (no secrets in tracked source; ownership transfer pending)
**Last audit:** 2026-07-22
**Auditor:** KTP Associate (self-audit — needs independent review)

---

## 1 · Repository ownership

**Current:** `Udondiane/ACH-HIM-Platform` — personal GitHub account
**Target:** `ACHUK/HIM-Platform` (or equivalent) under an ACH-owned GitHub organisation

**Steps to transfer** (ACH-side action required):

1. ACH creates a GitHub organisation (Free tier is fine for private repos)
2. Repo transferred via GitHub Settings → Danger Zone → Transfer ownership
3. Existing collaborators re-invited under the ACH org
4. Branch protection re-applied (see §3 below)
5. All previously-forked/cloned copies notified to re-clone from new origin

**Bus factor** (§9 handover addresses this in full): today = 1 (the KTP Associate). Post-transfer target: 2 (Associate + named ACH successor with write access + deploy rights).

---

## 2 · Secret-hygiene audit

### Codebase scan

**Tool:** `detect-secrets scan --all-files` (Yelp's tool, industry-standard SAST for secrets).

**Result:**
- 1 false-positive (TypeScript `tsconfig.tsbuildinfo` build cache — not committed to git anyway; contains hash strings that trigger high-entropy detection)
- **0 real secrets** in any tracked source file
- `.env.example` contains only placeholder values (`ey...`, `YOUR-PROJECT`, etc.)

### Git history scan

**Result:**
- No `.env`, `.env.local`, `.env.production`, or `.env.staging` files have ever been committed
- No `.pem`, `.key`, `secret*`, or `credential*` files have ever been committed
- The only env-related file in git history is `.env.example` (placeholders only, safe)

### Environment variable audit

Every `process.env.*` reference in the codebase is documented in `00-inventory.md`. Full list of production-relevant variables:

- `NEXT_PUBLIC_SUPABASE_URL` · public
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` · public (RLS-protected)
- `SUPABASE_SERVICE_ROLE_KEY` · **highly sensitive, server-only**
- `NEXT_PUBLIC_AUTH_DISABLED` · config flag
- `AZURE_OPENAI_ENDPOINT` · config
- `AZURE_OPENAI_API_KEY` · **highly sensitive, server-only**
- `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_WHISPER_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` · config
- `CRON_SECRET` · **highly sensitive, server-only**

### Client-bundle check

Only variables prefixed `NEXT_PUBLIC_` are inlined in the browser bundle. All highly-sensitive keys use the server-only prefix and are read exclusively in server components, server actions, and API routes. No sensitive credentials are exposed browser-side.

**Verified.** No changes required in this phase.

---

## 3 · Branch protection (recommended before org-wide rollout)

Once transferred to the ACH org, apply the following on `main`:

- Require pull request before merging
- Require at least 1 approving review from someone other than the PR author
- Require status checks to pass (lint, type-check, tests, dep-scan, secret-scan — see `05-pipeline.md`)
- Require branches to be up to date before merging
- Require conversation resolution before merging
- Restrict who can push to `main` (deploy service account only, no direct human pushes)
- Do not allow force pushes
- Do not allow deletions

---

## 4 · Dependency audit

`npm audit` result (as of 2026-07-22): [to be run against current lockfile at cutover — Node ecosystem CVEs shift week-to-week, so this must be re-run at each release]

**Policy going forward:**

- Every merge to `main` runs `npm audit --audit-level=high` (blocked on high/critical)
- Dependabot enabled for automated security-patch PRs
- Every direct dependency version is pinned in `package.json`; `package-lock.json` is committed

### Direct dependency verification

Every dependency listed in `package.json` has been verified to exist on npm's public registry (defends against AI-hallucinated package supply-chain attack — Endor Labs documented 500k+ instances of AI suggesting non-existent packages that attackers then squat).

### Notable dependencies worth flagging

- **`xlsx`** — pinned to SheetJS' own CDN URL (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) rather than npm, because npm's `xlsx` package was end-of-lifed by the maintainer with security advisories. Pinning to the vendor CDN is the maintainer's recommended path.
- **`openai`** v6 — used for Azure OpenAI SDK compatibility. Rotate keys quarterly.
- **`@supabase/*`** — kept on the current LTS-adjacent minor version; upgrade path tested with a fresh Postgres project before adoption.

---

## 5 · README + top-level docs

- Root `README.md` — build-log style, kept for historical context
- `docs/deployment/` — this pack (Phases 0–9), the operational source of truth
- `docs/HIM-methodology-spec.md` — authoritative HIM methodology reference (Udondian, May 2026) plus documented overrides
- All migration scripts numbered `001` – `043` in `supabase/migrations/`

---

## 6 · What still needs to happen (Phase 1 — ACH-decision blockers)

| Action | Owner | Status |
|---|---|---|
| Create ACH GitHub organisation | ACH IT | ⏳ |
| Transfer repo to ACH org | KTP Associate + ACH IT | ⏳ |
| Re-invite collaborators under ACH org | KTP Associate | ⏳ |
| Apply branch protection on `main` | ACH IT | ⏳ |
| Enable Dependabot security updates | ACH IT | ⏳ |
| Re-run `npm audit` post-transfer | KTP Associate | ⏳ |

Once the six lines above land, Phase 1 is complete and Phase 2 (security hardening) is fully unblocked.

---

## Change log

| Date | Change |
|---|---|
| 2026-07-22 | Initial code-ownership audit (Phase 1) — self-audit; needs independent review at ACH IT sign-off |
