# HIM Platform · Stack, Secrets, and Data Inventory

**Purpose:** The document ACH IT and security will ask for first. Everything else in the deployment pack forks from this.

**Last reviewed:** 2026-07-22
**Owner:** KTP Associate (interim) — successor TBD

---

## 1 · Stack

### Application

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 14.2.15 (App Router) | Server components + server actions |
| Runtime | Node.js | 20.x (LTS) | |
| Language | TypeScript | 5.6.3 | Strict mode |
| UI | React + Tailwind + shadcn/ui | 18.3.1 · 3.4 | |
| Charts | Recharts | 3.8 | |
| Validation | Zod | 3.23 | Shared client + server schemas |
| Icons | lucide-react | 0.453 | |
| Localisation | next-intl | 3.21 | Bilingual candidate surface |
| PDF generation | react-pdf, docx | 9.1, 9.0 | Funder reports + Word documents |
| Excel handling | SheetJS (xlsx) | 0.20.3 | Candidate bulk import |

### Data + auth

| Layer | Technology | Notes |
|---|---|---|
| Database | PostgreSQL (managed by Supabase) | 15+ |
| Auth | Supabase Auth (currently `AUTH_DISABLED=true`) | Migration to Microsoft Entra ID planned |
| File storage | Supabase Storage | Audio recordings + attachments |
| Row-level security | Postgres RLS policies (see §4) | Currently bypassed by service-role client while AUTH_DISABLED is on |

### AI + integrations

| Layer | Technology | Notes |
|---|---|---|
| LLM | Azure OpenAI (GPT-4o) | Independent AI scoring per HIM factor after assessor scores; requires per-candidate consent |
| Transcription | Azure OpenAI Whisper | Voice-typed assessment responses |
| Hosting | Vercel (personal account — pending migration to ACH-owned) | |
| Repo | GitHub · `Udondiane/ACH-HIM-Platform` (personal) — pending migration to ACH org | |

### Local development

Node 20 · npm · Supabase CLI (optional) · git.

---

## 2 · Secrets and credentials

**Rule:** No secret is committed. All read from environment variables. Full list of every env var HIM reads:

| Variable | Purpose | Sensitivity | Where set |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public (safe in browser bundle) | Vercel env vars |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Public (RLS-protected) | Vercel env vars |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — used server-side while AUTH_DISABLED is on | **Highly sensitive** — never exposed to browser | Vercel env vars, server-only |
| `AUTH_DISABLED` | Feature flag: skip auth checks (pre-production) | Config | Vercel env vars |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI URL | Config | Vercel env vars |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key | **Highly sensitive** | Vercel env vars |
| `AZURE_OPENAI_DEPLOYMENT_ID` | GPT-4o deployment name | Config | Vercel env vars |
| `AZURE_OPENAI_WHISPER_DEPLOYMENT_ID` | Whisper deployment name | Config | Vercel env vars |
| `AZURE_OPENAI_API_VERSION` | Azure OpenAI API version | Config | Vercel env vars |

**Not committed anywhere.** Git history has been scanned for accidental commits (see `01-security.md`).

**Rotation policy:** All rotatable secrets should be rotated on cutover to ACH ownership and every 6 months thereafter, or immediately on any staff departure.

**Break-glass:** Currently no formal procedure. Post-migration, secrets live in Azure Key Vault with defined access reviewers.

---

## 3 · Data sources HIM touches

### Data HIM stores directly

| Data | Source | Sensitivity | Retention (proposed) |
|---|---|---|---|
| Candidate identity (name, DOB, contact, country of origin, refugee status) | Application forms + candidate input | **Special category (Article 9 GDPR)** — race, religion inferred via country/language | 7 years post-programme exit |
| HIM assessment responses (factor scores + narrative + voice transcripts) | Assessor interviews | Personal + special category | 7 years post-programme exit |
| Voice recordings (if consented) | Assessor interviews | Special category | 90 days after transcription; then transcript retained, audio deleted |
| Candidate consent records | Consent flow | Personal | Full lifecycle + 10 years post |
| Placement + retention outcomes | Partner-provided | Personal (employment data) | 7 years post-programme exit |
| Partner interview outcomes + feedback | Partner-provided via token/portal | Personal | 7 years post-programme exit |
| Training attendance, session notes | Tutor input | Personal | 7 years post-programme exit |
| AI scoring suggestions + rationale | Azure OpenAI | Personal (references transcript) | Aligned with parent assessment record |

### Data HIM reads from external sources

- **Bulk import**: CSV/Excel candidate lists (validated client-side then server-side)
- **Partner submissions**: via `/report/[token]` — token-scoped writes to `placement_offers`, `placement_retention_checks`, `partner_growth_observations`
- **No inbound API calls from external systems currently.** Planned: Rubixx (housing), Microsoft Graph (identity + email).

### Data HIM sends to external sources

- **Azure OpenAI**: Assessment transcripts sent for scoring suggestions **only if candidate has explicit AI-analysis consent** (`candidate_consent.may_ai_analyse_transcript`)
- **No exports to third parties**. Funder reports are generated as Word/PDF downloads by ACH staff — the platform does not push data outwards.

---

## 4 · Databases and tables

**Schema owner:** ACH (public schema)
**Backups:** Supabase automated daily (7-day retention) — needs increasing to 30 days on production tier.

Full ERD is generated from `supabase/migrations/*.sql` (numbered 001–043). Key entity groupings:

- **People**: `candidates`, `candidate_consent`, `candidate_support`, `at_risk` flags
- **Cohorts + partners**: `cohorts`, `partners`, `partner_contacts`, `cohort_partners`, `cohort_candidates`, `partner_shortlist`
- **Assessments**: `assessments`, `assessment_responses`, `assessment_factor_responses`, `factors`, `indicators`, `factor_domains`, `ai_score_suggestions`
- **Placements**: `placements`, `placement_offers`, `placement_retention_checks`, `placement_milestones`
- **Training**: `training_programmes`, `training_sessions`, `training_enrolments`, `training_attendance`, `training_session_notes`, `training_certificates`, `training_learning_outcomes`, `training_learning_outcome_map`
- **Interviews**: `candidate_interviews`
- **Partner access**: `partner_access_tokens`

**Every table has RLS enabled** with an ACH-staff policy (`for all to authenticated using (true) with check (true)`) — permissive while `AUTH_DISABLED` is on. **Real RLS becomes enforceable the moment SSO lands** (see `02-security.md`).

---

## 5 · External services and subprocessors

| Service | Purpose | Data touched | DPA in place? |
|---|---|---|---|
| Supabase Inc. | Database + auth + storage | All ACH data | Standard DPA — needs signing in ACH's name (currently personal account) |
| Vercel Inc. | Hosting + CI | Server logs, request metadata | Standard DPA — needs signing in ACH's name |
| Microsoft Azure (Azure OpenAI) | LLM inference | Transcripts (consent-gated) | Microsoft Enterprise DPA (via Azure subscription) — needs ACH's own Azure subscription |
| GitHub Inc. (Microsoft) | Source code hosting | No candidate data (code only) | Covered under GitHub Enterprise if ACH has one |

**Full subprocessor list** in `08-subprocessors.md`.

---

## 6 · Where HIM runs today (honest current state)

- **Production URL**: Vercel-provided domain (not `him.ach.org.uk`)
- **Database**: Personal Supabase project (`app.supabase.com`)
- **Vercel account**: Personal
- **GitHub**: Personal user account, single repo, one active branch (`claude/quirky-ramanujan-iRusz`)
- **Access**: Anyone with the URL can access ACH-side surfaces (AUTH_DISABLED)
- **Backups**: Supabase default (7 days)
- **Monitoring**: None (no Sentry, no uptime pings)
- **Deploys**: Automatic on push to main via Vercel

**This is the state that needs to change before HIM is "professionally deployable org-wide." Every gap in this list is addressed by the phase docs that follow (`01-*` through `09-*`).**

---

## Change log

| Date | Change |
|---|---|
| 2026-07-22 | Initial inventory (Phase 0) |
