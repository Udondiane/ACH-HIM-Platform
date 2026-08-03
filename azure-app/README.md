# HIM · Azure-native rebuild

Fresh Next.js 14 app for ACH's Holistic Impact Metric platform, built from the ground up on the Microsoft/Azure stack.

Runs alongside the existing Supabase/Vercel build in `../` — this is the parallel Azure track ACH's ICT + external vendor will complete.

## Stack

| Layer | Service |
|---|---|
| Hosting | **Azure Static Web Apps** (Node function host, standalone Next.js output) |
| Database | **Azure Database for PostgreSQL Flexible Server** |
| Auth | **Microsoft Entra ID** via NextAuth v5 — every ACH M365 user, no per-seat fee |
| Storage | **Azure Blob Storage** (managed identity in prod, connection string in dev) |
| Secrets | **Azure Key Vault** (via App Configuration) |
| Monitoring | **Azure Application Insights** (add via SWA integration) |

## Local dev

```bash
cd azure-app
cp .env.example .env
# Fill in DATABASE_URL pointing at a local Postgres for dev
# Leave AUTH_DISABLED=true to skip the Entra login flow locally

npm install
npm run db:migrate          # applies db/schema.sql
npm run dev                 # http://localhost:3100
```

## What's ported so far

- ✅ Landing page + sign-in link
- ✅ Sidebar navigation
- ✅ Dashboard (live domain + counts against Azure Postgres)
- ✅ Beneficiaries list (live table)
- ✅ Projects list (live cards)
- ✅ Framework library (live 7-domain breakdown with metric counts)
- ✅ Entra ID auth wiring (NextAuth v5 · Microsoft provider)
- ✅ Azure Blob Storage adapter
- ✅ Full DDL schema (`db/schema.sql`) — de-Supabase-ified: no `auth.uid()`, no PostgREST-only constructs
- ✅ Azure Static Web Apps deploy config (`staticwebapp.config.json`)

## What still needs building (the vendor's Phase 1)

Ordered by user-facing priority:

1. **Data seeding** — port the 148 indicators + 72 metrics from the Supabase migration into `db/framework-seed.sql`
2. **Assessment runner** — full 7-domain scoring UI (in the parent app at `app/(ach)/projects/[id]/assess/[assessmentId]/page.tsx`)
3. **Enrolment flow** — auto-cohort creation on first beneficiary enrolment
4. **Consent capture** — granular consent screens
5. **Outcomes tracker** — live tick grid per project
6. **Follow-up queue** — 3/6/12mo dispatch model
7. **Featured quotes + case study builder**
8. **Impact library**
9. **Sample impact report** (both single-cohort and programme-level)
10. **RLS policies** — turn on once Entra rollout is complete; policies read `current_setting('app.current_user_id')` instead of `auth.uid()`
11. **Storage integration** — evidence attachments on assessments (uses `lib/storage.ts`)
12. **Bulk import** — CSV/Excel beneficiary import (port from `lib/candidates/import.ts`)

The parent app (`../`) contains the current working versions of every one of these — the vendor's task is to port the UI and adapt data-access from `@supabase/supabase-js` calls to `sql\`\`` calls against `lib/db.ts`.

## Provisioning the Azure resources

One-time setup, roughly 30–45 min via Azure Portal or Bicep:

1. **Resource group** — `ach-him-prod` (region: UK South)
2. **Azure Database for PostgreSQL Flexible Server**
   - Burstable B1ms (~£5/mo with nonprofit discount)
   - Enable "Allow public access from any Azure service" temporarily; move to Private Endpoint for production
3. **Azure Storage Account**
   - StorageV2, LRS, hot tier
   - Create containers: `evidence`, `case-studies`, `reports`
4. **App Registration** (Microsoft Entra ID)
   - Add redirect URIs: `https://<swa>.azurestaticapps.net/api/auth/callback/microsoft-entra-id` + local `http://localhost:3100/api/auth/callback/microsoft-entra-id`
   - Create a client secret; copy Application (client) ID + Directory (tenant) ID
5. **Azure Static Web Apps**
   - Free tier is fine for pilot; upgrade to Standard for custom domain + auth + SLA
   - Point at this repo, build path `azure-app/`, output `.next`
   - App settings: paste the env vars from `.env.example` with real values
6. **Azure Key Vault** (optional, recommended)
   - Store the DB password + Storage account key + Entra client secret
   - Wire via App Configuration references

## Nonprofit discount

Apply via https://nonprofit.microsoft.com/en-us/getting-started before provisioning to unlock:
- $3,500 (~£2,750) annual Azure credit — covers infra roughly indefinitely at HIM's traffic profile
- 75% discount on Azure services beyond credit
- Free Microsoft 365 nonprofit tenant (usually already active)

## Handover state

This repository is the **starter scaffold** — architecture, config, auth, storage, database, and 4 demonstrator pages. Any Microsoft-experienced vendor can extend it into feature parity with the parent Supabase app. Estimated 3–6 weeks of focused work depending on the fidelity target.

The parent Supabase/Vercel build stays running throughout — ACH doesn't turn off the existing app until the Azure version reaches parity and passes UAT.
