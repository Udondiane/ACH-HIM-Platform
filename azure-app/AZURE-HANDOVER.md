# HIM · Azure handover pack

This app is a **replica of the parent Supabase/Vercel app** (`../`) built to run in ACH's Microsoft environment. Every page, component, server action, and migration from the parent is copied in verbatim — data access is transparently routed through an Azure adapter so no downstream code needed touching.

## The one-liner architecture

```
Existing 500+ Supabase calls  →  /lib/supabase/{server,client}.ts  →  /lib/azure/client.ts  →  Azure services
                                  (unchanged imports)                 (Supabase-shaped shim)   (Postgres, Blob, Entra ID)
```

## Stack

| Concern | Azure service | Replaces |
|---|---|---|
| Hosting | **Azure Static Web Apps** (Node function host, standalone Next.js output) | Vercel |
| Database | **Azure Database for PostgreSQL Flexible Server** | Supabase Postgres |
| Auth | **Microsoft Entra ID** via NextAuth v5 · Microsoft provider | Supabase Auth (GoTrue) |
| Storage | **Azure Blob Storage** — managed identity in prod, connection string in dev | Supabase Storage |
| Secrets | Env vars mounted from **Azure Key Vault** via App Configuration | .env in Vercel |
| Monitoring | **Azure Application Insights** (SWA integration) | Vercel logs + Sentry |

## Provisioning checklist (30–45 min)

Run once, before first deploy. Region: **UK South** (data residency).

1. **Resource group** — `ach-him-prod`
2. **Azure Database for PostgreSQL Flexible Server**
   - Burstable B1ms (~£5/mo after nonprofit discount)
   - Set admin password (also grant an application role `him_app` for the DATABASE_URL user)
   - Enable Postgres extensions: `pgcrypto`, `uuid-ossp`
3. **Azure Storage Account** (StorageV2, LRS, hot tier)
   - Create containers: `evidence`, `case-studies`, `reports`
4. **App Registration** (Entra ID → App registrations → New)
   - Redirect URIs:
     - `https://<swa>.azurestaticapps.net/api/auth/callback/microsoft-entra-id`
     - `http://localhost:3100/api/auth/callback/microsoft-entra-id` (dev)
   - Certificates & secrets → New client secret (24 months)
   - Copy: Application (client) ID, Directory (tenant) ID, secret value
5. **Azure Static Web Apps** (Free tier for pilot; Standard for custom domain + SLA)
   - Repo: this one; Branch: `claude/azure-native`; App root: `azure-app`; Output: `.next`
   - Environment variables (paste from `.env.example` values):
     - `DATABASE_URL`
     - `AUTH_SECRET` (openssl rand -base64 32)
     - `AUTH_MICROSOFT_ENTRA_ID_ID`, `_SECRET`, `_ISSUER`
     - `AZURE_STORAGE_CONNECTION_STRING` (or `AZURE_STORAGE_ACCOUNT_NAME` + managed identity)
     - `AUTH_DISABLED=false` in prod (leave true only for demos)
6. **Azure Key Vault** (recommended, not required for first deploy)
   - Store the DB password, Storage key, Entra secret
   - Wire via App Configuration references so SWA reads them without env sprawl

## First-run migration

```bash
cd azure-app
cp .env.example .env             # fill in DATABASE_URL and Entra values
npm install
npm run db:migrate               # applies every supabase/migrations/*.sql
                                 # to Azure Postgres, filtering out
                                 # Supabase-only auth.uid() / role grants
```

The migrate script tracks applied files in `_azure_migration_history` and is safe to re-run.

## Local dev

```bash
npm run dev                      # http://localhost:3100
```

Set `AUTH_DISABLED=true` in `.env` to skip the Entra login flow — matches parent-app demo mode.

## What works out of the box after migrate + dev

Every page, every server action, every component from the parent app is present and routed through the Azure adapter. In practice this means:

- Dashboard, Impact overview, Impact library, all 65 route pages
- Enrol beneficiaries, mark project completed, save assessment, upload evidence, etc.
- Featured quotes, case study builder, follow-up queue, sample impact report
- Admin: framework library, partner question sets

## Known limitations — vendor work items (Phase 1 hardening)

The Supabase shim (`/lib/azure/query-builder.ts`) covers 100% of the query methods HIM uses, but three patterns need vendor attention:

### 1. Embedded joins in `.select()` — needs case-by-case rewrite

Occurrences like:
```ts
.select('id, name, cohorts(name, project_id, projects(name))')
```
work in Supabase because PostgREST resolves FKs automatically. On the Azure shim these currently fail (the shim treats the string as literal SQL). Rewrite each occurrence to either:
- an explicit SQL JOIN via the shim's raw `.select('a.*, b.name AS b_name')` + a JOIN clause added to `query-builder.ts`, OR
- a follow-up query in application code.

Find all sites:
```bash
grep -rn "\.select('.*\('" app/ lib/ | wc -l
```

### 2. RLS policies — rewrite from `auth.uid()` to `current_setting('app.current_user_id')`

The migrate script skips RLS policies referencing Supabase's `auth.uid()`. Rewrite them in `db/rls.sql` to read the session variable set by the app layer:

```sql
create policy candidate_own_read on candidates for select
  using (recorded_by::text = current_setting('app.current_user_id', true));
```

App must call `SET LOCAL app.current_user_id = '<uuid>'` at the start of each request — the pattern lives in `lib/azure/client.ts` and needs enabling once ACH's Entra rollout completes.

### 3. Realtime subscriptions

Parent app doesn't use them today; if added later they need Azure Web PubSub or Signalr — not part of this scaffold.

## Framework seed

The 72 metrics + 148 indicators land automatically via `supabase/migrations/059_reseed_framework_from_xlsx.sql` when `npm run db:migrate` runs. No separate seed step.

## Nonprofit discount

Apply at https://nonprofit.microsoft.com/en-us/getting-started **before** provisioning:
- $3,500 (~£2,750) annual Azure credit — covers HIM's infra roughly indefinitely at pilot traffic
- 75% discount on Azure services beyond credit
- M365 nonprofit tenant (likely already active for ACH)

## Handover state

- **All 65 pages present** in `app/(ach)/*`
- **All 74 components present** in `components/*`
- **All 23 server-action modules present** in `lib/*/actions.ts`
- **All 59 migrations present** in `supabase/migrations/*` (migrate script filters Supabase-only bits)
- **All UI dependencies present** in `package.json` (Radix, Recharts, docx, xlsx, next-intl, etc.)
- **Azure adapter complete** in `lib/azure/{pool,query-builder,auth,entra,storage,client}.ts`
- **Deployment config complete**: `staticwebapp.config.json`, `next.config.mjs` with standalone output

The vendor's job is to complete the three known-limitation items above and run UAT with real ACH data. Estimated effort: **2–4 weeks by an experienced Microsoft/Next.js developer**.

Parent Supabase build in `../` stays running throughout — ACH doesn't turn off the existing app until this Azure version reaches parity and passes UAT.
