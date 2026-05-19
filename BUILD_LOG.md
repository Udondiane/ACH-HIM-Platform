# BUILD_LOG.md
ACH HIM Platform — session-by-session build progress.

## Scope reminders

- **Memo supersedes** the HIM spec on pricing and partner taxonomy:
  - Dynamic Pricing Tool implements the per-candidate £2,170 sponsorship floor + salary-band placement/retention model (memo §3–5), **not** Workforce Solutions Standard/Plus.
  - Three partner types: **Capability Investor**, **Workforce Partner**, **Training Partner**. The spec's "Cohort Contributor" collapses into a small Capability Investor.
- Everywhere else, HIM spec is authoritative.
- All V1 and V2 features ship working — nothing stubbed (per brief).
- 11 languages with the tiering policy in `lib/i18n/config.ts`.

---

## Session 1 — Foundation  ✅ complete

**Goal:** Next.js + TS + Tailwind + shadcn skeleton; design tokens wired; Supabase client/server/middleware; folder structure; first migration; clean `next build`.

### Done
- [x] `package.json` with all V1 + V2 dependencies (next 14.2, supabase ssr, next-intl, react-pdf, docx, @google/generative-ai, vitest, tailwind, shadcn primitives via radix)
- [x] `tsconfig.json` strict mode
- [x] `next.config.js` with next-intl plugin
- [x] `tailwind.config.ts` — every ACH design token wired (navy, cream, page, card, border, all 7 domain accents, pill tints/deeps, mini/body/h-scale sizes, weights capped at 400/500, radii 14/12/10/100)
- [x] `app/globals.css` — Inter + Fraunces fonts, `.mini-label`, `.stat-value`, `.card`, `.card-cream`, `.stat-card--{domain}`, `.pill--{variant}`, `.progress-fill--{domain}`, `.quote-block`, `.avatar-nav`, `.btn-primary`/`btn-secondary`/`btn-ghost`, RTL overrides, table.data-table
- [x] Folder tree per brief: `app/(auth)`, `app/(ach)`, `app/(partner)`, `app/(candidate)`, `components/{ui,ach}`, `lib/{scoring,supabase,i18n,reports,ai,equivalence,utils}`, `messages/`, `supabase/migrations`, `tests/`, `public/`, `scripts/`
- [x] Supabase client/server/middleware/service-role (`lib/supabase/`)
- [x] Auth helper `requireUser(allowedRoles?)` with role-based redirects
- [x] Root layout with `NextIntlClientProvider`, `<html dir>` switched per locale
- [x] Public landing page + sign-in (magic link) + `/auth/callback`
- [x] Three role-gated dashboard route placeholders (ACH staff, partner, candidate)
- [x] i18n config with **tiering policy** baked in:
  - Tier A (en) — source
  - Tier B (ar, fr, es, uk) — machine-translated in session 8, `__reviewed:false`
  - Tier C (fa, ps, ti, so, ckb, sq) — `__stub:true`, English fallback, one human-reviewed banner sentence per locale
  - All 11 message files created with at least the banner sentence populated
- [x] Migration `001_auth_and_roles.sql` — `user_role` enum, `user_roles` table with RLS, helper SQL functions (`is_ach_staff()`, `current_partner_id()`, `current_candidate_id()`)
- [x] `.env.example` documenting all vars (`GEMINI_API_KEY` marked optional)
- [x] `.gitignore`
- [x] Clean `next build` ✅

### Files created in session 1
```
package.json, package-lock.json
tsconfig.json, next.config.js, postcss.config.js, tailwind.config.ts
middleware.ts, .env.example, .gitignore
app/layout.tsx, app/page.tsx, app/globals.css
app/(auth)/sign-in/page.tsx
app/auth/callback/route.ts
app/(ach)/dashboard/page.tsx
app/(partner)/partner-dashboard/page.tsx
app/(candidate)/candidate-dashboard/page.tsx
lib/supabase/{client,server,middleware,auth,types}.ts
lib/i18n/{config,request}.ts
lib/utils/index.ts
messages/{en,ar,fr,es,uk,fa,ps,ti,so,ckb,sq}/common.json
supabase/migrations/001_auth_and_roles.sql
```

---

## Session 2 — Schema + scoring library  ✅ complete

**Goal:** Migrations 002–017 implementing the full data model; `seed.sql` populating
the memo's worked examples; complete TypeScript scoring library; Vitest tests passing
on every spec checkpoint; clean `next build`.

### Migrations (15 SQL files)

| # | File | What it provides |
|---|---|---|
| 002 | `002_partners.sql` | three-type partner taxonomy (Capability Investor / Workforce Partner / Training Partner), partner_contacts, RLS for ACH/self/public-listing |
| 003 | `003_candidates.sql` | candidates with PRIVATE career_goal_summary, candidate_consent with granular flags (may_be_named/quoted/case_study/share_career_goal) |
| 004 | `004_cohorts.sql` | cohorts (multi_partner / single_partner), cohort_partners, cohort_candidates, all RLS |
| 005 | `005_projects.sql` | projects, project_type, weight_ratio (asymmetry preserved: depth 1:1–5:1, breadth 2:1–4:1), hybrid_option, classification fields |
| 006 | `006_capability_framework.sql` | seven domains, factors with `is_universal` flag, indicators, `factor_domains` join for universal-factor propagation, ~30 factors + ~50 indicators seeded |
| 007 | `007_assessments.sql` | assessments by timepoint (baseline/mid_3mo/exit_6mo/followup_12mo), responses (likert/yes_no/count/checklist/narrative), `universal_factor_responses` view |
| 008 | `008_placements_milestones.sql` | placements, placement_milestones (placement/retention_6mo/retention_12mo), salary_band enum, milestone_reviews with review_outcome |
| 009 | `009_development_fund.sql` | training_catalogue, development_fund_balances, dev_fund_credits ledger, training_requests with state machine, training_enrolments, recompute_dev_fund_balance() with triggers |
| 010 | `010_pricing.sql` | quote_track, pricing_quotes with internal cost columns + traffic_light, pricing_quote_lines, pricing_parameters singleton seeded with all memo §3-5 values |
| 011 | `011_audit_layer.sql` | audit_entries with `narrative_no_audit` constraint, verification_status, partner-can-insert-self-reported-only RLS |
| 012 | `012_verified_network.sql` | partner_tier, tier_status with discount fractions, append-only tier_history, recompute_partner_tier() function |
| 013 | `013_inclusion_assessment.sql` | 6-dimension inclusion instrument with year-over-year tracking |
| 014 | `014_delphi_panels.sql` | Delphi panels/experts/rounds/responses with state machine |
| 015 | `015_equivalence_library.sql` | equivalence_values with 6 ACH-local rows seeded (employment 3mo £4500, 12mo £13800, progression £3200, retention savings by band), equivalence_applications audit trail |
| 016 | `016_evidence_packs.sql` | evidence_packs, 14-section enum (organisational_overview → ach_attestation), ai_draft_cache (24h TTL), ai_draft_calls (10/hour rate-limit ledger), career_progression_reports, engagement_reports |
| 017 | `017_translations.sql` | translations admin table, translation_snapshots for rollback |

### Seed data
`supabase/seed.sql` — exactly the memo §8 worked examples:
Burges Salmon (CI), Pret (WP, 3 placements seeded with milestones),
Doyle Collection (WP, modest), Bowmer & Kirkland (CI + tender pack),
IKEA (WP, largest), Aston (training partner). 11 named candidates across
6 languages (ar/fa/ti/sq/uk/en), BRI-2026-Q3 cohort, PRJ-2026-B2E-Q3
depth project with d3_1 weight ratio.

### Scoring library (`lib/scoring/`)
- `types.ts` — DomainId, ProjectType, WeightRatio, IndicatorResponse, HimInputs, HimResult, etc.
- `weights.ts` — Saaty α/β lookups for spec §3.3 / §3.4 tables, `hybridOptionAWeights()`, `hybridOptionBWeights(depthLeaningScore)` interpolating
- `classification.ts` — V2 four-question scoring (A=2/C=1/B=0), `deriveProjectType()`
- `aggregation.ts` — mixed-method normalisation (likert_1_5/10, yes_no, count, checklist, narrative), two-step rollup (indicator → factor → conversion-factor-type → domain), universal-factor deduplication via `domainIds[]` propagation
- `coverage.ts` — V2 coverage-weighted Optional, coverage_factor 0.7→1.0 scaled by non-zero Optional domain count
- `him.ts` — main calculation, optional inclusion-env blend (V2 §12.2), optional stability blend
- `stability.ts` — V2 multi-timepoint stability, weighted-delta linear mapping calibrated so the declining-trajectory anchor returns 0.5
- `discrimination.ts` — V_between / V_within with n≥10 gating, thresholds good/moderate/poor
- `delphi.ts` — Rule A (agreement ≥70%) + Rule B (IQR ≤ 1 scale point)
- `inclusion-linkage.ts` — V2 mapping per spec §12.2 (6 inclusion dimensions → capability domains)

### Test results
```
Test Files  7 passed (7)
     Tests  41 passed (41)
```
**Including the load-bearing HIM = 0.80 hand-calc reference.**

`npm run build` clean. 9 routes compile, no type errors, scoring library
fully typed.

---

## Session 3 — Auth + ACH shell + Partners/Candidates/Cohorts CRUD  ✅ complete

**Goal:** shadcn primitives styled to ACH design tokens; persistent sidebar+topbar
layout for ACH workspace; role-gated layout; KPI dashboard reading real data;
complete CRUD for Partners, Candidates (with consent recording), and Cohorts
(with partner/candidate linking dialogs).

### UI primitives (`components/ui/`)
Button (5 variants — primary/secondary/ghost/danger/link), Input, Label,
Textarea, Select (Radix), Card + CardHeader + CardContent, Badge (with domain-
accent variants for partner types, statuses, tiers), Dialog (Radix), EmptyState,
PageHeader. All styled to design tokens — 14px outer radius, 10px small radius,
0.5px borders, Inter 400/500 only, sentence case, 10.5px uppercase mini-labels.

### ACH shell (`components/ach/`)
- `sidebar.tsx` — 14 routes grouped into Workspace · Network · Operations ·
  Method (V2) · Reports · Admin; active-route highlight
- `topbar.tsx` — current user email + sign-out form

### Layout
- `app/(ach)/layout.tsx` — role-gated wrapper. Non-ACH users redirected to their
  own workspace; unauthenticated users to sign-in.

### Dashboard
- KPI cards: Partners / Candidates / Cohorts / Projects, each linking to its
  list page; secondary cards for getting-started checklist and methodology version.

### Partners CRUD
- `lib/partners/schema.ts` — Zod with three-type enum, status enum, optional
  numeric coercion for employee_count
- `lib/partners/actions.ts` — create / update / delete (soft-delete to status='closed')
- `components/partners/partner-form.tsx` — shared form with field-level error display
- `app/(ach)/partners/page.tsx` — list with type filter pills + table
- `app/(ach)/partners/new/page.tsx`
- `app/(ach)/partners/[id]/page.tsx` — detail with tier card, cohort engagement, recent placements
- `app/(ach)/partners/[id]/edit/page.tsx`

### Candidates CRUD
- `lib/candidates/schema.ts` — Zod with 7 statuses, 11 locales
- `lib/candidates/actions.ts` — create / update / withdraw + `recordConsentAction`
- `components/candidates/candidate-form.tsx` — clear visual separation of private
  career_goal_summary and development_plan from public fields
- `components/candidates/consent-form.tsx` — granular consent toggles
  (named / quoted / case_study / share_career_goal_with_partner)
- `app/(ach)/candidates/page.tsx` — list filtered by status (uses `candidate_ref`
  as primary display, not personal name)
- `app/(ach)/candidates/new/page.tsx`
- `app/(ach)/candidates/[id]/page.tsx` — detail with consent panel, dev-fund balance,
  cohorts, placements; "Record new consent" form inline
- `app/(ach)/candidates/[id]/edit/page.tsx`

### Cohorts CRUD
- `lib/cohorts/schema.ts` — Zod with multi-partner/single-partner structure
- `lib/cohorts/actions.ts` — create / update / cancel + link/unlink partner / link/unlink candidate
- `components/cohorts/cohort-form.tsx`
- `components/cohorts/linkers.tsx` — three dialog components:
  - `LinkPartnerToCohort` (sponsorship_count + engagement_fee + is_lead_partner)
  - `LinkCandidateToCohort` (with optional sponsoring_partner selection from cohort's partners)
  - `UnlinkRow` (with browser confirm)
- `app/(ach)/cohorts/page.tsx` — card grid view with status filter pills
- `app/(ach)/cohorts/new/page.tsx`
- `app/(ach)/cohorts/[id]/page.tsx` — detail with KPI cards (status / partners / candidates),
  partner table + linker, candidate table + linker
- `app/(ach)/cohorts/[id]/edit/page.tsx`

### Build status
```
npm run build → 19 routes compiled, clean type-check
npm test       → 41/41 tests passing (Session 2 scoring tests still green)
```

---

## Session 4 — Assessment engine + project-level HIM UI  ✅ complete

**Goal:** Projects CRUD with classification questionnaire wired to the V2 derivation
math; Core/Optional capability picker for the seven domains; assessment runner with
auto-saving indicator scorers; live HIM calculation visualisation with α/β
decomposition and per-domain bars.

### Projects CRUD
- `lib/projects/schema.ts` — Zod with 8 weight ratios, 3 project types, hybrid options,
  optional schemes, and 4-question classification questionnaire (CLASSIFICATION_QUESTIONS
  exports question text + A/C/B option labels)
- `lib/projects/actions.ts` — create / update / setProjectCapabilities. The create/update
  paths compute classification_total via the scoring lib's `classify()` when all four
  questions are answered.
- `components/projects/project-form.tsx` — full form with live classification:
  as the user picks A/B/C answers, the suggested project type and weight ratio
  appear in a styled callout box. Final dropdowns for type and weight_ratio
  allow override of the suggestion.
- `app/(ach)/projects/page.tsx` — grid of project cards
- `app/(ach)/projects/new/page.tsx`
- `app/(ach)/projects/[id]/page.tsx` — detail with configuration card, capability picker,
  recent assessments table
- `app/(ach)/projects/[id]/edit/page.tsx`

### Capability picker
- `components/projects/capability-picker.tsx` — seven domains each with three-button
  toggle (Core / Optional / Excluded). Saves the selection via setProjectCapabilitiesAction
  (delete + re-insert). Live counter at the bottom: "X Core · Y Optional · Z Excluded".

### Assessment engine
- `lib/assessments/actions.ts` — startAssessmentAction (upserts on the candidate+project+timepoint
  unique constraint), saveAssessmentResponseAction, completeAssessmentAction
- `app/(ach)/projects/[id]/assess/page.tsx` — start form: candidate dropdown (from
  project's cohort), timepoint radio (baseline / 3mo / 6mo / 12mo)
- `app/(ach)/projects/[id]/assess/[assessmentId]/page.tsx` — the runner.
  Loads project, capability selection, full framework (factors, factor_domains, indicators),
  any existing responses. Groups indicators by domain → factor. Renders an IndicatorScorer
  per indicator. Builds the IndicatorResponse[] for the scoring library, calls calculateHim(),
  and renders the HimScoreCard in the right column.
- `components/assessments/indicator-scorer.tsx` — client component. 0–5 button row (or
  Yes/No for binary factors, or textarea-only for narrative factors). Auto-saves on
  each score change and on narrative blur, with "Saved 14:32" timestamp.
- `components/assessments/him-score-card.tsx` — the visualisation. Displays the
  three-decimal HIM, then α and β alongside; two stat cards for Core/Optional
  showing × α and × β contributions; per-domain horizontal bars with domain-accent
  tones from the design tokens.

### Build status
```
npm run build → 25 routes compiled, clean
npm test       → 41/41 tests passing
```

---

## Session 5 — Three partner-type dashboards  ✅ complete

**Goal:** Type-specific partner-portal dashboards (Capability Investor, Workforce
Partner, Training Partner); ACH-side Verified Network admin; public-facing
Verified Partner listing page.

### Partner-portal shell
- `app/(partner)/layout.tsx` — role-gated layout for partner users
- `components/partner-portal/sidebar.tsx` — type-aware nav (different items per partner type)
- `components/partner-portal/topbar.tsx` — partner-type badge + email + sign-out

### Dashboard dispatcher
- `app/(partner)/partner-dashboard/page.tsx` — branches by `partner.type` and renders
  one of three type-specific components

### Workforce Partner dashboard
- 4 KPI cards: placements / retained-at-12mo / milestone paid (with pending) /
  estimated retention savings (using equivalence library defaults — memo §13)
- Upcoming milestones table, Verified tier card, recent placements table,
  Development Fund contribution card

### Capability Investor dashboard
- 4 KPI cards: sponsorships / cohorts engaged / engagement fees / candidates supported
- Cohort engagement table, Verified tier card, anonymised candidates table
  (by `candidate_ref`, never by name unless explicit consent)

### Training Partner dashboard
- 4 KPI cards: audit entries / pending audit / self-reported / inclusion overall score
- Practice change & policy updates list with verification-status tones and audit notes
- Inclusion assessment 6-dimension breakdown with year-over-year ↑/↓ deltas

### Verified Network
- `app/verified-partners/page.tsx` — **public**, Verified+ then Verified sections
- `app/(ach)/verified-network/page.tsx` — ACH admin: tier counts + full partner table

### Build status
```
npm run build → 27 routes compiled, clean
npm test       → 41/41 tests passing
```

---

## Session 6 — Pricing tool, Development Fund, Verified Network, reports
## Session 7 — V2 modules + Evidence Pack + Gemini
## Session 8 — Candidate-facing surface (11 languages) + polish + zip
