# HIM · Azure handover pack

This app is a **replica of the parent Supabase/Vercel app** (`../`) built to run in ACH's Microsoft environment. Every page, component, server action, and migration from the parent runs verbatim — data access is transparently routed through an Azure adapter so no downstream code needed touching.

**Vendor scope: code review + testing only.** Everything below is built. The vendor does not need to author new features; they read the code, provision Azure, run the migrations, and sign off on UAT.

## Repo layout — the overlay pattern

`azure-app/` is intentionally NOT a full copy of the parent. Only the ~15 files that are new or genuinely override parent behaviour are tracked here. The rest lives once in `../` and gets bootstrapped in on demand.

```bash
cd azure-app
bash bootstrap.sh    # copies parent files into place (idempotent, no-clobber)
npm install
npm run dev          # http://localhost:3100
```

The `.gitignore` in this folder uses negation patterns so overrides stay tracked while bootstrap-populated files stay clean. This keeps the vendor's review scope honest: **~3,000 lines of Azure-specific code**, not 30,000+ lines of duplicated pages.

The 15 tracked files fall into three groups:
| Group | Files |
|---|---|
| **Azure adapter** | `lib/azure/{pool,query-builder,auth,entra,storage,graph,openai,client}.ts` |
| **Partner B2B invitations** | `lib/partner-access/*.ts`, `components/partners/partner-invitations.tsx`, `supabase/migrations/060_partner_b2b_invitations.sql` |
| **Overrides on parent** | `app/(ach)/partners/[id]/page.tsx`, `app/(auth)/sign-in/page.tsx`, `app/api/auth/[...nextauth]/route.ts`, `lib/partners/resolve-current.ts`, `lib/supabase/{client,middleware,server}.ts` |

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
| Staff auth | **Microsoft Entra ID** via NextAuth v5 · Microsoft provider | Supabase Auth (GoTrue) |
| Partner auth (Microsoft) | **Entra B2B guest invitations** via Microsoft Graph API | Magic URL tokens |
| Partner auth (non-Microsoft) | **Entra External ID** email OTP | — new capability — |
| Storage | **Azure Blob Storage** — managed identity in prod, connection string in dev | Supabase Storage |
| AI (chat + Whisper) | **Azure OpenAI** (UK South) with direct-OpenAI fallback for local dev | Direct OpenAI |
| Secrets | Env vars mounted from **Azure Key Vault** via App Configuration | .env in Vercel |
| Monitoring | **Azure Application Insights** (SWA integration) | Vercel logs + Sentry |

## What is now built (was previously vendor scope)

All of these landed on `claude/quirky-ramanujan-iRusz` so the vendor picks up a complete package:

| Feature | Location |
|---|---|
| Entra B2B partner invitations (server actions + admin UI) | `lib/partner-access/*.ts`, `components/partners/partner-invitations.tsx` |
| Microsoft Graph client (invitation raise + guest disable) | `lib/azure/graph.ts` |
| Post-signin sync (Entra oid → partner_users mapping) | `lib/partner-access/post-signin.ts` |
| Entra External ID provider (email OTP for non-Microsoft partners) | `lib/azure/entra.ts` (conditional on `AUTH_MICROSOFT_EXTERNAL_ID_ISSUER`) |
| Provider-aware sign-in page | `app/(auth)/sign-in/page.tsx` |
| Partner-scope resolution via Entra oid | `lib/partners/resolve-current.ts` |
| Migration for partner_invitations + partner_users tables | `supabase/migrations/060_partner_b2b_invitations.sql` |
| Azure OpenAI adapter with local-dev fallback | `lib/azure/openai.ts` (routes already Azure-native) |
| Supabase → Azure Postgres data migration script | `scripts/migrate-data.mjs` |
| Supabase Storage → Azure Blob file migration script | `scripts/migrate-files.mjs` |
| Whisper in-page recorder (already in components) | `components/assessments/factor-response-field.tsx`, `components/follow-ups/response-form.tsx` |

## Provisioning checklist (30–45 min)

Run once, before first deploy. Region: **UK South** (data residency).

1. **Resource group** — `ach-him-prod`
2. **Azure Database for PostgreSQL Flexible Server**
   - Burstable B1ms (~£5/mo after nonprofit discount)
   - Set admin password (also grant an application role `him_app` for the `DATABASE_URL` user)
   - Enable Postgres extensions: `pgcrypto`, `uuid-ossp`
3. **Azure Storage Account** (StorageV2, LRS, hot tier)
   - Create containers: `assessment-evidence`, `case-studies`, `reports`
4. **App Registration — workforce** (Entra ID → App registrations → New)
   - Redirect URIs:
     - `https://<swa>.azurestaticapps.net/api/auth/callback/microsoft-entra-id`
     - `http://localhost:3100/api/auth/callback/microsoft-entra-id` (dev)
   - Certificates & secrets → New client secret (24 months)
   - **API permissions** → Microsoft Graph → Application permission → `User.Invite.All` — grant admin consent (this powers B2B invitations from the app)
   - Copy: Application (client) ID, Directory (tenant) ID, client secret value
5. **App Registration — External ID (optional but recommended)**
   - Create a separate External ID tenant (`<name>.ciamlogin.com`)
   - App registration inside it, redirect `https://<swa>.azurestaticapps.net/api/auth/callback/entra-external-id`
   - User flow: email-with-code
   - Skip if all partners are Microsoft-401 organisations
6. **Azure Static Web Apps** (Free tier for pilot; Standard for custom domain + SLA)
   - Repo: this one; Branch: `claude/quirky-ramanujan-iRusz`; App root: `azure-app`; Output: `.next`
   - Environment variables (paste from `.env.example` values):
     - `DATABASE_URL`
     - `AUTH_SECRET` (openssl rand -base64 32)
     - `AUTH_MICROSOFT_ENTRA_ID_ID`, `_SECRET`, `_ISSUER`
     - `AZURE_TENANT_ID` (for Graph invitations)
     - `AZURE_STORAGE_CONNECTION_STRING` (or `AZURE_STORAGE_ACCOUNT_NAME` + managed identity)
     - `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_WHISPER_DEPLOYMENT`
     - Optional: `AUTH_MICROSOFT_EXTERNAL_ID_ID`, `_SECRET`, `_ISSUER`, `NEXT_PUBLIC_EXTERNAL_ID_ENABLED=true`
     - `NEXTAUTH_URL=https://<swa>.azurestaticapps.net`
     - `AUTH_DISABLED=false` in prod (leave true only for demos)
7. **Azure Key Vault** (recommended, not required for first deploy)
   - Store the DB password, Storage key, Entra secret, Graph secret, OpenAI key
   - Wire via App Configuration references so SWA reads them without env sprawl

## First-run migration (schema)

```bash
cd azure-app
cp .env.example .env             # fill in DATABASE_URL and Entra values
npm install
npm run db:migrate               # applies every supabase/migrations/*.sql
                                 # to Azure Postgres, filtering out
                                 # Supabase-only auth.uid() / role grants
```

The migrate script tracks applied files in `_azure_migration_history` and is safe to re-run.

## Data migration (existing Supabase → Azure)

Do this once you're satisfied the schema is right and the app runs.

```bash
# Environment for both scripts
export SUPABASE_DB_URL='postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres'
export AZURE_DB_URL='postgresql://achhim@ach-him-pg.postgres.database.azure.com:5432/postgres?sslmode=require'
export SUPABASE_URL='https://<ref>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
export AZURE_STORAGE_CONNECTION_STRING='<from-storage-account>'

# Rows (dump → schema → restore → verify)
npm run data:migrate -- --step=all

# Files (dry-run first, then commit)
npm run files:migrate                 # counts + estimates
npm run files:migrate -- --commit     # actual copy
npm run files:migrate -- --verify     # spot-check
```

Both scripts are idempotent — safe to re-run if something needs retrying.

## Local dev

```bash
npm run dev                      # http://localhost:3100
```

Set `AUTH_DISABLED=true` in `.env` to skip the Entra login flow — matches parent-app demo mode.

For AI without Azure OpenAI credentials, set `USE_DIRECT_OPENAI=true` + `OPENAI_API_KEY=sk-...` — routes will fall back to the public OpenAI API.

## Sign-in flow

- **ACH staff** click `Continue with Microsoft` → land in workforce Entra tenant → back to `/dashboard` (mapped via existing `user_roles` table).
- **Microsoft partners** click the same link → sign in with their own work Microsoft account → arrive as an Entra B2B guest → `syncPartnerUserFromSignin` matches their email to a pending `partner_invitations` row → creates a `partner_users` row → session carries `partnerId` from that point on → land in `/partner-dashboard`.
- **Non-Microsoft partners** click `Email me a one-time code` (if External ID is configured) → email OTP → same post-signin sync flow → `/partner-dashboard`.
- **Legacy shareable links** (`/report/[token]`) still work for one-off snapshot shares — but not for ongoing access.

## Vendor scope: what remains

Vendor performs code review and testing. They do **not** need to author features.

| Vendor task | Est. days |
|---|---|
| Read the codebase + Azure adapter, flag any concerns | 2 |
| Provision Azure resources per the checklist above | 1 |
| Run `db:migrate` + smoke test | 0.5 |
| Run `data:migrate` + `files:migrate` from Supabase | 1 |
| End-to-end UAT with real programme data | 2 |
| Fix any drift found during UAT | 1–2 |
| Sign-off pack for ACH (test report, runbook confirmation) | 0.5 |
| **Total** | **8–9 days** |

Estimated fixed-price: **£4–6k** at typical UK Microsoft partner day rates.

## Known limitations — flag during code review

Three patterns the vendor should verify against the parent app:

### 1. Embedded joins in `.select()`

Occurrences like:
```ts
.select('id, name, cohorts(name, project_id, projects(name))')
```
work in Supabase because PostgREST resolves FKs automatically. On the Azure shim these currently fail (the shim treats the string as literal SQL). Vendor confirms whether the shim's built-in nested-select support covers each occurrence, and rewrites any that don't.

Find all sites:
```bash
grep -rn "\.select('.*\('" app/ lib/ | wc -l
```

### 2. RLS policies

The migrate script skips RLS policies referencing Supabase's `auth.uid()`. If real RLS is needed post-migration (rather than app-layer filters), vendor rewrites in `db/rls.sql`:

```sql
create policy candidate_own_read on candidates for select
  using (recorded_by::text = current_setting('app.current_user_id', true));
```

App calls `SET LOCAL app.current_user_id = '<uuid>'` at the start of each request — the pattern lives in `lib/azure/client.ts`.

For partner-scoped RLS, the migration adds `current_partner_id_from_entra()` for use in policies.

### 3. Realtime subscriptions

Parent app doesn't use them today; if added later they need Azure Web PubSub or SignalR — not part of this scaffold.

## Framework seed

The 72 metrics + 148 indicators land automatically via `supabase/migrations/059_reseed_framework_from_xlsx.sql` when `npm run db:migrate` runs. No separate seed step.

## Nonprofit discount

Apply at https://nonprofit.microsoft.com/en-us/getting-started **before** provisioning:
- $3,500 (~£2,750) annual Azure credit — covers HIM's infra roughly indefinitely at pilot traffic
- 75% discount on Azure services beyond credit
- M365 nonprofit tenant (likely already active for ACH)
- **Entra External ID**: first 50,000 monthly active users free
- **Entra B2B guest users**: free per Microsoft's licensing rules (up to 50k guests per P1/P2 licence held)

## Handover state

- **All 65 pages present** in `app/(ach)/*` + `app/(partner)/*`
- **All components present** in `components/*`
- **All server-action modules present** in `lib/*/actions.ts`
- **All 60 migrations present** in `supabase/migrations/*` (migrate script filters Supabase-only bits)
- **All UI dependencies present** in `package.json` (Radix, Recharts, docx, xlsx, next-intl, etc.)
- **Azure adapter complete** in `lib/azure/{pool,query-builder,auth,entra,storage,graph,openai,client}.ts`
- **Partner Entra flow complete** in `lib/partner-access/*`, `components/partners/partner-invitations.tsx`
- **Data migration scripts complete** in `scripts/migrate-data.mjs`, `scripts/migrate-files.mjs`
- **Deployment config complete**: `staticwebapp.config.json`, `next.config.js` with standalone output

Parent Supabase build in `../` stays running throughout — ACH doesn't turn off the existing app until this Azure version reaches parity and passes UAT.
