# ACH HIM Platform

Production Next.js 14 + TypeScript + Supabase implementation of the HIM (Holistic Impact Metric) platform for Ashley Community & Housing, in partnership with Aston Business School (CREME / Advanced Services Group).

> **Build status:** Session 1 of 8 complete — foundation scaffolding. See `BUILD_LOG.md` for what ships in each subsequent session.

---

## Stack

- **Next.js 14** (App Router, strict TypeScript, server actions)
- **Supabase** Postgres + Auth (three roles, RLS-gated)
- **Tailwind CSS** + **shadcn/ui** (radix primitives)
- **next-intl** for the 11-language candidate surface
- **react-pdf** + **docx** for Evidence Pack and Career Progression Report exports
- **@google/generative-ai** (Gemini 1.5 Flash) for AI-assisted Evidence Pack drafting
- **Vitest** for scoring-library unit tests

---

## Scope (binding)

This build follows the HIM Methodology Specification v1 (Udondian, May 2026) **with two memo-driven overrides**:

1. **Pricing model.** The Dynamic Pricing Tool implements ACH's per-candidate £2,170 sponsorship floor + salary-band placement and retention fee model (memo §3–5), **not** the spec's Workforce Solutions Standard/Plus per-hire packages.
2. **Partner taxonomy.** Three partner types: **Capability Investor**, **Workforce Partner**, **Training Partner**. The spec's "Cohort Contributor" classification collapses into a small Capability Investor.

Everywhere else, the HIM spec is authoritative. All V1 (§19.1) and V2 (§19.2) features ship working — nothing stubbed.

---

## Translation tiering policy

The platform supports 11 languages, but **not at uniform quality**. Per ACH guidance:

| Tier | Locales | Status | UI behaviour |
| --- | --- | --- | --- |
| A | `en` | Native source of truth | Full UI |
| B | `ar`, `fr`, `es`, `uk` | Machine-translated, **pending native review** | Full UI; every string flagged `reviewed: false` in `/ach/translations`; ACH staff can edit |
| C | `fa`, `ps`, `ti`, `so`, `ckb`, `sq` | **Needs native review — do not machine-translate** | UI falls back to English; a single human-reviewed banner sentence (per locale) tells the user "Translation pending — please use English for now or contact your caseworker" |

The `/ach/translations` admin panel (built in session 8) lets staff view, edit, mark reviewed, filter by language/status, and export/import JSON for sending strings to community reviewers.

---

## Local development

### Prerequisites
- Node.js 20+
- A Supabase project (free tier is fine)
- Optional: a Gemini API key (for AI drafting in the Evidence Pack)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase URL, anon key, and service-role key.
# GEMINI_API_KEY is optional — the rest of the app works without it.

# 3. Run migrations against your Supabase project
# (Either via the Supabase Dashboard SQL editor, or via the Supabase CLI:)
supabase db push
# Optional: seed demo data
psql "$DATABASE_URL" -f supabase/seed.sql

# 4. Promote your first ACH staff user
# After signing in once (which creates an auth.users row), run:
#   insert into public.user_roles (user_id, role) values ('YOUR-UUID', 'ach_staff');
# in the Supabase SQL editor.

# 5. Start the dev server
npm run dev
```

### Tests

```bash
npm test
```

The scoring library (`lib/scoring/`) has full Vitest coverage. Hand-calc references in tests are documented inline and traceable to spec sections.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import into Vercel.
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never `NEXT_PUBLIC_`)
   - `GEMINI_API_KEY` *(optional)*
   - `NEXT_PUBLIC_SITE_URL` *(your production domain)*
4. Deploy.
5. In Supabase Dashboard → Authentication → URL Configuration, set the **Site URL** to your Vercel domain so magic-link redirects work.

### Importing from the zip (Windows)

If you received this build as a `.zip`:

```powershell
# 1. Extract the zip
Expand-Archive ach-him-platform.zip -DestinationPath .\ach-him-platform
cd ach-him-platform

# 2. Initialize a fresh git repo
git init
git add .
git commit -m "Initial commit — HIM platform"

# 3. Create an empty repo on github.com, then:
git remote add origin https://github.com/YOUR-USER/ach-him-platform.git
git branch -M main
git push -u origin main

# 4. Deploy via the Vercel dashboard (import from GitHub).
```

---

## Project layout

```
/app
  /(auth)/sign-in/             — magic-link sign-in
  /(ach)/                      — ACH staff workspace (gated)
  /(partner)/                  — partner dashboard (gated)
  /(candidate)/                — candidate surface (gated, multilingual)
  /auth/callback/              — Supabase OTP exchange
/components
  /ui/                         — shadcn primitives
  /ach/                        — custom ACH-branded components
/lib
  /scoring/                    — HIM, DR, Delphi, stability, coverage-weighting math
  /supabase/                   — client, server, middleware, auth, types
  /i18n/                       — locale config + next-intl request handler
  /reports/                    — PDF + Word generation
  /ai/                         — Gemini integration (cache, rate-limit, graceful degrade)
  /equivalence/                — locally-derived social value equivalence library
  /utils/                      — formatting helpers (£, HIM score, deltas)
/messages/                     — translation JSON, 11 locales
/supabase
  /migrations/                 — numbered SQL migrations
  /seed.sql                    — demo seed (Burges Salmon, Pret, Doyle, B&K, IKEA)
/tests/                        — Vitest specs for scoring
```

---

## Out of scope (deliberately, per spec §19.3)

The following are **not** built and should not be requested as additions without revisiting the methodology:

- Combined partner-level HIM score
- Candidate Suitability metric on partner dashboards
- "% of workforce vs sector typical" comparator
- Simpson's diversity index
- Average tenure metric
- Candidate-level pricing or fee structures
- Partner-vs-partner comparison rankings

---

*Ashley Community &amp; Housing · in partnership with Aston Business School*
