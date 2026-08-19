# HIM Platform · Codebase Orientation

A short guide for any developer joining this codebase. Read this first, keep it open while you work for the first week.

Last reviewed: August 2026

---

## 1 · What HIM is (in engineering terms)

A **Next.js 14 App Router** application with:
- React 18 UI (server + client components)
- TypeScript strict mode
- Tailwind CSS + shadcn/ui primitives
- Supabase (Postgres) for data, auth, and file storage
- Azure OpenAI for AI features (Whisper transcription + GPT-4o mini scoring)
- Deployed on Vercel
- next-intl for 11-language support

Single-tenant, multi-role application (ach_staff / partner / candidate) with row-level security enforced at the database layer.

---

## 2 · Repo structure

```
ACH-HIM-Platform/
├── app/                        # Next.js App Router — routes, pages, API
│   ├── (ach)/                  # ACH-staff route group (dashboard, admin, etc.)
│   │   ├── dashboard/
│   │   ├── candidates/         # Beneficiaries — the case-worker workspace
│   │   ├── projects/
│   │   ├── cohorts/
│   │   ├── partners/
│   │   ├── training/
│   │   ├── follow-ups/
│   │   ├── pricing/
│   │   ├── admin/
│   │   │   ├── users/          # ICT admin — user management (new, Aug 2026)
│   │   │   ├── framework/
│   │   │   └── partner-question-sets/
│   │   └── layout.tsx          # Shared ACH chrome (sidebar + topbar)
│   ├── (partner)/              # Partner-portal route group
│   ├── (auth)/                 # Sign-in / set-password / reset-password / mfa-enrol
│   ├── report/[token]/         # Tokenised partner-report surface (no login)
│   ├── auth/callback/          # Supabase OTP + invite + reset callback
│   ├── api/                    # HTTP endpoints
│   │   ├── ai/                 # Whisper transcription, GPT scoring
│   │   ├── cron/               # Nightly at-risk recalculation
│   │   └── training/           # CSV export
│   ├── page.tsx                # Public landing page
│   ├── layout.tsx              # Root layout (i18n provider)
│   ├── error.tsx / global-error.tsx  # Error boundaries
│   └── globals.css             # Design tokens + Tailwind base
│
├── components/                 # Reusable React components
│   ├── ach/                    # Sidebar, topbar, shared ACH chrome
│   ├── partner-portal/         # Partner-side chrome
│   ├── admin/                  # /admin/users console + related
│   ├── ui/                     # Buttons, cards, page headers (shadcn-derived)
│   ├── assessments/            # Assessment runner, indicator scorer
│   ├── candidates/             # Beneficiary forms + widgets
│   ├── partners/               # Partner forms + token widgets
│   ├── projects/               # Project forms
│   ├── training/               # Training subsystem widgets
│   ├── charts/                 # Recharts wrappers
│   └── translations/           # Locale switcher
│
├── lib/                        # Server-side logic + utilities
│   ├── auth/
│   │   ├── capabilities.ts     # Team-role capability predicates
│   │   ├── dev-bypass.ts       # AUTH_DISABLED flag + synthetic user
│   │   └── guard.ts            # (portable pattern from hardened ZIP)
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client + service client
│   │   ├── middleware.ts       # Session refresh + public-route logic
│   │   ├── auth.ts             # requireUser() + SessionUser type
│   │   └── types.ts            # Database types (narrow, hand-maintained)
│   ├── admin/
│   │   └── users-actions.ts    # Invite / update / deactivate / reset password / reset MFA
│   ├── candidates/             # Beneficiary server actions + schema
│   ├── partners/               # Partner server actions + schema
│   ├── projects/               # Project server actions + schema
│   ├── cohorts/
│   ├── training/
│   ├── pricing/
│   ├── follow-ups/
│   ├── assessments/
│   ├── scoring/                # Pure scoring library (Delphi, AHP, HIM)
│   ├── i18n/                   # Locale config + tiering policy
│   └── utils/
│
├── messages/                   # i18n messages (11 locales)
│   └── en/common.json          # English source of truth
│
├── supabase/
│   └── migrations/             # 61 SQL migrations, numbered 001-061
│
├── tests/
│   └── scoring/                # Vitest unit tests for the scoring library
│
├── docs/                       # Living documentation
│   ├── RUNBOOK.md              # Operations runbook (Aug 2026)
│   ├── CODEBASE.md             # This file
│   ├── data-model/             # ER diagram + generation script
│   └── deployment/             # Earlier deployment docs
│
├── scripts/                    # Standalone Node scripts (data cleanup, etc.)
├── public/                     # Static assets
├── middleware.ts               # Next.js middleware (delegates to lib/supabase/middleware.ts)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.example                # Documented environment-variable template
```

---

## 3 · "I need to change X — where do I look?"

Most common tasks mapped to files:

| Task | Files to open |
|---|---|
| Change a page's UI | `app/(ach)/<area>/page.tsx` — server component that fetches data and renders |
| Change a form's fields | `components/<area>/<name>-form.tsx` — client component with the form JSX |
| Change what happens when a form submits | `lib/<area>/actions.ts` — the server action |
| Change validation rules | `lib/<area>/schema.ts` — Zod schema |
| Change the sidebar navigation | `components/ach/sidebar.tsx` — the `NAV` array at the top |
| Change page copy or empty-state text | Search for the exact string with `grep -rn "text I want to change"` |
| Change a database schema | Create a new numbered migration in `supabase/migrations/` — don't edit existing migrations |
| Change auth rules for a page | Add `requireUser(['ach_staff'])` at the top of the page's server component |
| Change what fields a partner can see | RLS policy in the relevant migration + `resolveCurrentPartner()` in `lib/partners/` |
| Add a new AI feature | `app/api/ai/<name>/route.ts` — follow the pattern of `analyze-transcript` |
| Change training programme fields | `lib/training/schema.ts` + `components/training/programme-form.tsx` + migration if adding columns |
| Change the framework (domains, factors, indicators) | Migration (`029_him_reference_taxonomy.sql` seeds the current one) |
| Change the runbook | `docs/RUNBOOK.md` — update in the same commit as any operational change |

---

## 4 · How to run locally

### Prerequisites

- Node.js 20+
- A Supabase project (or use the shared dev project)
- `.env.local` file (copy from `.env.example` and fill in)

### Setup

```bash
git clone https://github.com/Udondiane/ACH-HIM-Platform.git
cd ACH-HIM-Platform
npm install
cp .env.example .env.local   # then edit with real values
npm run dev
```

Visit http://localhost:3000. If Supabase env is wired, you land on the landing page. If `NEXT_PUBLIC_AUTH_DISABLED=true`, you land on the dashboard as a synthetic staff user.

### Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build (catches type errors + runtime issues) |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest suite (scoring library) |
| `npx tsc --noEmit` | Type-check without building |

---

## 5 · How to add a new page

Server component (default — for anything that reads from the database):

```tsx
// app/(ach)/example/page.tsx
import { requireUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function ExamplePage() {
  const user = await requireUser(['ach_staff']);
  const supabase = createClient();

  const { data } = await supabase
    .from('some_table')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader miniLabel="Section" title="Page title" />
      {/* content */}
    </div>
  );
}
```

Client component (only when you need `useState`, event handlers, or browser APIs):

```tsx
'use client';

import { useState } from 'react';
// ...
```

The `(ach)` group has the ACH sidebar + topbar wrapped by `app/(ach)/layout.tsx`. If a new page belongs in the sidebar, add it to the `NAV` array in `components/ach/sidebar.tsx`.

---

## 6 · How to add a new server action

Convention: one `actions.ts` file per subsystem, all `'use server'` at the top.

```ts
// lib/example/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  status: z.enum(['draft', 'active']),
});

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createExampleAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  await requireUser(['ach_staff']);   // ← auth check — always

  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, error: 'Fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('examples')
    .insert(parsed.data as never)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/examples');
  return { ok: true, id: (data as { id: string }).id };
}
```

**Every server action MUST:**
- Call `requireUser(...)` first (or an equivalent auth check)
- Validate input (Zod is the house style)
- Use `createClient()` (respects RLS) — only use `createServiceClient()` when deliberately bypassing RLS (documented in a comment)
- Call `revalidatePath()` for any page that displays the affected data

---

## 7 · How to add a new database migration

Migrations live in `supabase/migrations/` and are numbered sequentially. **Never edit an existing migration** — write a new one that alters what came before.

```sql
-- supabase/migrations/062_add_example_column.sql
alter table public.examples
  add column if not exists description text;

-- If adding a table, remember to enable RLS + write policies
```

Apply with Supabase CLI:
```bash
supabase db push
```
Or paste directly into the Supabase SQL Editor.

**RLS is required on every user-facing table.** If you add a table without RLS, the anon key can read/write it — which means anyone on the internet can. See `docs/RUNBOOK.md` §1 and existing migrations for the policy pattern.

---

## 8 · Key patterns in this codebase

### 8.1 · Auth model

Two layers:
- **Database role** (`user_roles.role`) — enforced by RLS. Three values: `ach_staff`, `partner`, `candidate`.
- **Team role** (`user_roles.team_role`) — enforced at the application layer for ach_staff subtypes. Eight values (see `lib/auth/capabilities.ts`).

Capability predicates in `lib/auth/capabilities.ts` — `canManageUsers`, `canWriteBeneficiaries`, etc. — hide/show UI and gate server actions.

### 8.2 · Route groups

- `app/(ach)/` — ACH staff surfaces
- `app/(partner)/` — partner portal
- `app/(auth)/` — sign-in and account-lifecycle pages
- Route groups don't appear in the URL. They just share a layout.

### 8.3 · Server actions vs. API routes

- **Server actions** — used for form submissions, mutations, anything triggered from the UI. Type-safe, no manual JSON handling.
- **API routes** — used when something external calls into HIM (Vercel cron, third-party webhook, non-HIM client). Fewer of these on purpose.

### 8.4 · Data-shape casts

Supabase's TypeScript types are narrow (`lib/supabase/types.ts` covers only auth-critical tables). Most queries end with `as any[]` or a targeted cast. This is deliberate — the migration cadence is faster than the generated types would keep up with. It means we lose some type safety on data access, but we keep migration velocity.

### 8.5 · The tokenised report pattern

Partners access their timepoint reports via `/report/[token]` — no login. The token is a long random string stored in `partner_access_tokens`, generated by ACH staff from the partner detail page. Time-limited, revocable, scoped to one partner. Used because most partners will never sign in but still need to submit data.

### 8.6 · Design tokens

Every colour, spacing, radius, and font weight is in `tailwind.config.ts` under theme extension. Don't hardcode colours in components — use the `ach-*` tokens (`text-ach-navy`, `bg-ach-page`, `border-ach-border`).

### 8.7 · i18n tiering

- Tier A: `en` — source of truth
- Tier B: `ar`, `fr`, `es`, `uk` — machine-translated, `__reviewed: false` (needs native review)
- Tier C: `fa`, `ps`, `ti`, `so`, `ckb`, `sq` — stubs, fall back to English with a per-locale banner

If you add a UI string, add it to `messages/en/common.json`. Other locales inherit until reviewed.

---

## 9 · Things NOT to do

- **Do not commit `.env.local` or any secret** — `.gitignore` guards against it; if you see one about to be committed, stop
- **Do not edit an existing migration** — always write a new one
- **Do not add a table without RLS** — the anon key is public; unprotected tables are read/write to the world
- **Do not bypass `requireUser()` in a server action** — even for "small" actions
- **Do not hardcode Supabase URLs, Vercel URLs, or Azure endpoints** — use env vars
- **Do not use `createServiceClient()` for user-facing queries** — it bypasses RLS
- **Do not commit binary files > 1 MB** — use Supabase Storage instead
- **Do not delete users from `auth.users`** — deactivate (removes their role row, bans the auth account, keeps history intact)

---

## 10 · Where to find help

| Question | Where to look |
|---|---|
| How is X operated? | `docs/RUNBOOK.md` |
| What's the database shape? | `docs/data-model/him_schema.png` + migrations |
| Why does the code do X? | Git blame the specific line, read the commit message |
| Where's the invite flow? | `lib/admin/users-actions.ts` (server) + `app/auth/callback/route.ts` (redirect logic) + `app/(auth)/set-password/page.tsx` (UI) |
| Where do RLS policies live? | Each table's migration in `supabase/migrations/` |
| How is auth wired? | `middleware.ts` → `lib/supabase/middleware.ts` → `lib/supabase/auth.ts` → `lib/auth/dev-bypass.ts` (for pilot bypass) |
| What environment variables exist? | `.env.example` — documented template |
| What migrations create the framework? | `029_him_reference_taxonomy.sql` seeds domains/factors/indicators; `059_reseed_framework_from_xlsx.sql` is the latest full reseed |
| Who owns what? | Credential inventory (in ACH's password vault, not in this repo) |

---

## 11 · Onboarding checklist for a new developer

- [ ] Read this document
- [ ] Read `docs/RUNBOOK.md`
- [ ] Look at `docs/data-model/him_schema.png`
- [ ] Clone the repo, set up `.env.local`, get it running locally
- [ ] Sign into HIM as yourself
- [ ] Read a few server actions (`lib/candidates/actions.ts` is representative)
- [ ] Read a few migrations to see the schema evolution style
- [ ] Read the last 20 commits to see how the team writes commit messages
- [ ] Read the audit trail schema (migration `011`)
- [ ] Sit with a case worker for an hour and watch them use HIM (or watch a screen recording)

---

*Update this document as the codebase evolves. It should never go more than a quarter without a review.*
