# `_archive/` — parked but reinstatable

Routes, components, and server actions that were removed from the live
application but preserved here in case they need to come back.

Nothing in this folder is compiled or routed by Next.js. It is excluded
from TypeScript checking (`tsconfig.json`) and ESLint (`.eslintignore`),
so the presence of files here does not affect production builds or CI.

## Why archive rather than delete

Archived rather than deleted so that reinstating a feature is a `mv`
command, not a `git checkout` archaeology exercise. If any of these
routes turns out to be actively used by ACH after all, restoring the
feature takes 30 seconds.

Every entry below lists the exact `mv` commands to reinstate.

## What is archived

### ACH-side analytical + reference routes

Removed because they were built for methodology completeness during the
KTP but do not have active users in operational ACH work.

| Feature | Path in archive | Reinstate command |
|---|---|---|
| Delphi panel evaluation | `_archive/routes/ach/delphi/` | `mv _archive/routes/ach/delphi 'app/(ach)/delphi'` |
| Dose-response analysis | `_archive/routes/ach/dr-analysis/` | `mv _archive/routes/ach/dr-analysis 'app/(ach)/dr-analysis'` |
| Equivalence values reference | `_archive/routes/ach/equivalence/` | `mv _archive/routes/ach/equivalence 'app/(ach)/equivalence'` |
| TOMs code crosswalk | `_archive/routes/ach/toms-crosswalk/` | `mv _archive/routes/ach/toms-crosswalk 'app/(ach)/toms-crosswalk'` |
| Framework library viewer | `_archive/routes/ach/admin-framework/` | `mkdir -p 'app/(ach)/admin' && mv _archive/routes/ach/admin-framework 'app/(ach)/admin/framework'` |
| Evidence pack builder | `_archive/routes/ach/evidence-pack/` | `mv _archive/routes/ach/evidence-pack 'app/(ach)/evidence-pack'` |
| Cohort capability report | `_archive/routes/ach/capability-report/` | `mv _archive/routes/ach/capability-report 'app/(ach)/cohorts/[id]/capability-report'` |
| Career Progression + Engagement Reports (index) | `_archive/routes/ach/reports/` | `mv _archive/routes/ach/reports 'app/(ach)/reports'` (then re-add sidebar link + 'Reports' section) |
| Training delivery report (KPIs + programme table) | `_archive/routes/ach/training-reports/` | `mv _archive/routes/ach/training-reports 'app/(ach)/training/reports'` (then re-add the header link + `BarChart3` import in `app/(ach)/training/page.tsx`) |
| Retention milestones dashboard | `_archive/routes/ach/milestones/` | `mv _archive/routes/ach/milestones 'app/(ach)/milestones'` (then re-add sidebar link + `revalidatePath('/milestones')` in `lib/placements/actions.ts`) |

### Role-specific dashboards (consolidated to `/dashboard`)

The four role-specific dashboards were superseded by a single
`/dashboard` view. Kept here in case ACH decides to route different
roles to different landing pages later.

| Route | Path in archive | Reinstate command |
|---|---|---|
| Adviser dashboard | `_archive/routes/ach/dashboard-adviser/` | `mv _archive/routes/ach/dashboard-adviser 'app/(ach)/dashboard/adviser'` |
| Tutor dashboard | `_archive/routes/ach/dashboard-tutor/` | `mv _archive/routes/ach/dashboard-tutor 'app/(ach)/dashboard/tutor'` |
| Specialist dashboard | `_archive/routes/ach/dashboard-specialist/` | `mv _archive/routes/ach/dashboard-specialist 'app/(ach)/dashboard/specialist'` |
| Engagement dashboard | `_archive/routes/ach/dashboard-engagement/` | `mv _archive/routes/ach/dashboard-engagement 'app/(ach)/dashboard/engagement'` |

### Authenticated partner portal sub-routes

Removed because workforce partners access their data collection surface
via `/report/[token]`, not via a login. If a future partner type (e.g. a
Capability Investor with regular access) needs an authenticated dashboard,
reinstate the relevant subsection.

| Route | Path in archive | Reinstate command |
|---|---|---|
| Partner audit entries | `_archive/routes/partner/audit-entries/` | `mv _archive/routes/partner/audit-entries 'app/(partner)/partner/audit-entries'` |
| Partner capability view | `_archive/routes/partner/capability/` | `mv _archive/routes/partner/capability 'app/(partner)/partner/capability'` |
| Partner development fund | `_archive/routes/partner/development-fund/` | `mv _archive/routes/partner/development-fund 'app/(partner)/partner/development-fund'` |
| Partner inclusion | `_archive/routes/partner/inclusion/` | `mv _archive/routes/partner/inclusion 'app/(partner)/partner/inclusion'` |
| Partner interviews (auth) | `_archive/routes/partner/interviews/` | `mv _archive/routes/partner/interviews 'app/(partner)/partner/interviews'` |
| Partner milestones | `_archive/routes/partner/milestones/` | `mv _archive/routes/partner/milestones 'app/(partner)/partner/milestones'` |
| Partner placements | `_archive/routes/partner/placements/` | `mv _archive/routes/partner/placements 'app/(partner)/partner/placements'` |
| Partner sponsorships | `_archive/routes/partner/sponsorships/` | `mv _archive/routes/partner/sponsorships 'app/(partner)/partner/sponsorships'` |

### Components and server actions

Components and server actions used only by the archived routes are
mirrored under `_archive/components/` and `_archive/actions/`
respectively. Each reinstate command in the table above should be
paired with reinstating any exclusive dependencies from these folders.
When in doubt, `grep -r <symbol> _archive/` shows what was archived
alongside a given route.

## Deleting the archive

If, after a period of confident non-use (recommend six months), it is
clear these features are not coming back, the entire `_archive/` folder
can be deleted in a single commit. Git history preserves the content.
