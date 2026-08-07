# HIM Platform — Handover Pack

**Prepared for:** ACH leadership, ACH ICT, incoming managed-service vendor
**Purpose:** Everything needed to receive HIM Platform as the KTP concludes and route it to a sustainable operating model on Microsoft infrastructure.

---

## 1 · Executive summary

The **Holistic Impact Metric (HIM) Platform** is a working, production-grade Next.js application built during the KTP between ACH and Aston University. It measures beneficiary outcomes across a 7-domain capability framework and generates funder-grade impact reporting. It has been in live use for ACH's Bridge to Employment programme and holds real cohort data.

This document packages HIM for handover to:

- **ACH ICT** — the ongoing owner of the vendor relationship and Azure tenant
- **A third-party managed-service vendor** — code review, testing, migration support, ongoing maintenance
- **ACH programme leads and super-users** — day-to-day operators

**Recommended path forward:** migrate from the current Vercel + Supabase hosting to ACH's Microsoft (Azure) environment, hand day-to-day management to a vendor under ICT's contract, and keep HIM live as a strategic asset for grant funding, commercial licensing, and thought leadership.

---

## 2 · What HIM is

### The measurement engine (~85% of the code)
Universal capability measurement platform for any refugee, migrant, or vulnerable-adult programme:

- **7-domain HIM framework** — Employment, Housing, Education & Skills, Health & Wellbeing, Belonging & Identity, Social Participation, Rights & Citizenship
- **72 metrics, 148 indicators** — reviewable in-app
- **Assessment engine** — baseline (T0) + follow-ups (T1/T2/T3), 1–5 scoring with per-factor guides
- **Voice-recorded assessments** with Whisper transcription + AI-assisted scoring (consent-gated)
- **Evidence attachment** (up to 25 MB per file)
- **Consent + audit + baseline hardlock** — GDPR-aligned governance
- **Multi-language** — English + Arabic-ready, extensible
- **Aggregate + per-cohort reporting** in HTML, PDF, Word, Excel

### The employability module (~15% of the code)
Adds the layer needed to measure work-based outcomes:

- **Employment partner directory + IKEA-style workforce questions**
- **Placement tracking** with 30/60/90-day retention
- **Bridge to Employment financial reality report** (true cost per candidate, employer contribution, funding gap)
- **Milestones** (offer, start, 90-day, 12-month, progression)

### Why the split matters
Because HIM is a general measurement engine with an employability module, it can be repurposed for housing, wellbeing, women's-group, or education programmes with modest additional development. This is central to the post-KTP commercial and grant strategy.

---

## 3 · Current state

| Aspect | Detail |
|---|---|
| **Hosting** | Vercel (Next.js managed) |
| **Data + auth + storage** | Supabase (Postgres + Auth + Storage) |
| **AI** | Azure OpenAI (already migrated) |
| **Repo** | GitHub · `Udondiane/ACH-HIM-Platform` |
| **Active branch** | `claude/quirky-ramanujan-iRusz` |
| **Users** | ACH staff + partner staff (currently via magic URL tokens) |
| **Live data** | Bridge to Employment programme — real candidates, real placements, real outcomes |
| **Codebase size** | ~42k lines of human-authored code (717 tracked files) |

---

## 4 · What's changing at handover

Three concurrent moves:

1. **Infrastructure** — from Vercel + Supabase → Azure (Static Web Apps + Postgres + Blob + Entra ID)
2. **Access model** — from magic URL tokens → Entra B2B / External ID per-user sign-in
3. **Operations** — from KTP associate → third-party managed vendor under ACH ICT contract

The application itself does not change. Users log in slightly differently; everything else is identical.

---

## 5 · Tech stack (current → target)

| Concern | Current (Vercel/Supabase) | Target (Azure) |
|---|---|---|
| Hosting | Vercel | **Azure Static Web Apps** |
| Database | Supabase Postgres | **Azure Database for PostgreSQL Flexible Server** |
| Staff auth | Supabase Auth (magic link) | **Microsoft Entra ID** via NextAuth v5 |
| Partner auth (Microsoft) | Magic URL tokens | **Entra B2B guest invitations** via Microsoft Graph |
| Partner auth (non-Microsoft) | Magic URL tokens | **Entra External ID** email OTP (optional) |
| File storage | Supabase Storage | **Azure Blob Storage** |
| AI (chat + Whisper) | Azure OpenAI | Azure OpenAI (unchanged) |
| Secrets | Env vars in Vercel | **Azure Key Vault** via App Configuration |
| Monitoring | Vercel logs | **Azure Application Insights** |

The full application (pages, components, business logic) is unchanged between deployments — an adapter layer translates Supabase calls into Azure equivalents so no downstream code was touched.

---

## 6 · Repo layout — the overlay pattern

```
/                     ← Parent app (Vercel + Supabase deploy target)
├── app/              ← 65 routes
├── components/       ← UI kit + domain components
├── lib/              ← Server actions, schemas, Supabase clients
├── supabase/         ← 60 migrations + seed data
├── messages/         ← next-intl translations
└── azure-app/        ← Azure overlay (34 tracked files, ~3,000 lines)
    ├── lib/azure/          ← Supabase-shaped adapter
    ├── lib/partner-access/ ← Entra B2B invitation flow
    ├── scripts/            ← Migration scripts (data + files)
    ├── supabase/           ← Migration 060 (new tables)
    └── bootstrap.sh        ← Reconstructs the full working folder
```

**Only ~3,000 lines are Azure-specific** — the rest of the working folder is bootstrapped from `../` on demand. See `azure-app/AZURE-HANDOVER.md` (Appendix A) for the technical detail.

---

## 7 · Migration plan — five sessions

Recommended sequencing. Each session has a defined stop point.

| # | Session | Duration | Who's in the room |
|---|---|---|---|
| 1 | Azure provisioning | ~90 min | ACH ICT + KTP associate |
| 2 | Schema + dry-run migration | ~60 min | KTP associate |
| 3 | Cutover rehearsal (real data → Azure, both sites still live) | ~90 min | KTP associate |
| 4 | Partner cutover (invite partner staff to Entra) | ~60 min | KTP associate + ACH programme lead |
| 5 | DNS cutover + old system decommission | ~45 min + 24h monitor | ACH ICT |

Total active time: ~5–6 hours across ~2 weeks.

Full details in Appendix D.

---

## 8 · Vendor scope

**Type of engagement:** code review + testing + ongoing managed service.
**The vendor does not build features.** Everything is built.

### One-off engagement (~8–9 days ≈ £4–6k)
| Task | Days |
|---|---|
| Code review — ~3,000 lines of Azure-specific code | 4–6 |
| Provision Azure per checklist | 1 |
| Run `db:migrate`, `data:migrate`, `files:migrate` | 1 |
| End-to-end UAT with real programme data | 2 |
| Sign-off pack (test report, runbook confirmation) | 0.5 |

### Ongoing (annual)
| Tier | Cost | Includes |
|---|---|---|
| **Standard** | £22,000–£36,000/yr | Uptime monitoring, patches, backups, quarterly reviews, small-change bundle, SLA response |
| Premium (optional) | £40,000+/yr | Adds feature-build hours, faster SLA, dedicated engineer |

### What's expressly not the vendor's job
- Building new features (goes through a separate quote)
- Product decisions (ACH + KTP associate own the roadmap)
- Training end-users (super-users handle this)
- Owning ACH's DNS or tenant credentials (those stay with ICT)

---

## 9 · ACH ICT scope

Detailed 37-item list in Appendix B. The critical five are:

| # | ICT non-negotiable | Why only ICT can do it |
|---|---|---|
| 1 | Apply for Microsoft Cloud for Nonprofits credit | Halves the migration bill |
| 2 | Update DPIA + privacy notice | Legal blocker to moving data |
| 3 | Attend Session 1 (~90 min) provisioning | ICT holds Azure tenant credentials |
| 4 | Grant admin consent for Graph `User.Invite.All` | Only a Global Admin can grant this |
| 5 | Update DNS record at cutover | Only ICT holds the DNS credential |

**Total ICT time commitment:** ~4–5 hours active + quarterly reviews.

---

## 10 · Operating model post-handover

Three tracks for how changes get made:

### 🟢 Track 1 — self-serve (no code, no vendor)
Content, configuration, framework text, partner questions, consent forms, user access. Done from inside the app or via Entra. **Cost: zero. Time: minutes.**

### 🟡 Track 2 — new features (vendor build)
New reports, new domains, new integrations. **You scope, vendor builds.** Product ownership stays with ACH (+ KTP associate initially).
Cost: vendor day rate × estimate.

### 🔴 Track 3 — data corrections (vendor only)
Editing production database rows. **Never bypass the vendor here** — mistakes are permanent.

### Three environments protect this model
```
Dev (your laptop) → Staging (vendor Azure) → Production (vendor Azure)
   Free prototype     Test freely              Vendor deploys only
```

The KTP associate (and any successor) retains full ability to prototype on branches and staging. The vendor becomes the gatekeeper between "working branch" and "production" — not a blocker on experimentation.

---

## 11 · Cost model

### One-off (migration window)
| Item | Cost |
|---|---|
| Vendor migration engagement | £4,000–£6,000 |
| Entra B2B / External ID setup | £2,400–£3,600 (bundleable into above) |
| Data migration script vendor time | included in above |
| **Total one-off** | **£5,000–£10,000** |

### Recurring (annual)
| Item | Cost |
|---|---|
| Vendor managed service (Standard tier) | £22,000–£36,000/yr |
| Azure hosting | ~£0 (covered by Nonprofit credit) |
| Azure OpenAI (chat + Whisper) | £43–150/yr at pilot scale |
| Entra licensing | £0 (nonprofit tier) |
| Domain + SSL | ~£15/yr |
| **Total recurring** | **£22,000–£36,000/yr** |

### Non-financial cost
- ACH ICT: ~4–5 hours one-off + quarterly reviews thereafter
- ACH programme lead: 5 days of super-user training
- KTP associate: 5–6 hours across the five migration sessions

---

## 12 · Risks & mitigations

| Risk | Mitigation |
|---|---|
| Vendor selection drags → tool goes stale | Start procurement in parallel with Nonprofit credit application (both take 3–5 working days) |
| ICT declines to own vendor relationship | Frame ICT's role as "contract owner, not builder" upfront (see Section 9) |
| Super-users don't get protected time → adoption stalls | Written commitment from programme lead before Session 4 |
| B2E timeline slips → app can't prove itself | Continue running Vercel/Supabase in parallel until Azure is proven |
| DPO delays sign-off → migration blocked | DPIA updated before Session 1; not after |
| Vendor lock-in with the new vendor | Contract clause: data export in open format on 30 days' notice |
| KTP associate can't influence roadmap post-handover | Contract clause: read + branch-push access retained (see Section 10) |
| Azure spend accidentally spikes | Cost cap + email alert set in Session 1 |

---

## 13 · Definition of Done for handover

Handover is complete when **all** of the following are true:

- [ ] Vendor code review signed off (defects logged + resolved)
- [ ] Azure environment provisioned + healthy
- [ ] All data migrated + verified (row counts match)
- [ ] All files migrated to Azure Blob (checksums match)
- [ ] All active partners on Entra sign-in (magic tokens deprecated)
- [ ] DNS switched to Azure
- [ ] Vercel + Supabase decommissioned (or on read-only safety net for 30 days)
- [ ] Named ICT contact handed to programme lead + super-users
- [ ] Runbook approved by ICT
- [ ] Vendor SLA in effect
- [ ] Cost caps + monitoring alerts configured
- [ ] Backup restore drill completed successfully
- [ ] This document + Appendix A read + acknowledged by ACH ICT and vendor

---

## 14 · Contact & escalation

| Role | Named contact | Held responsibilities |
|---|---|---|
| KTP associate | *[Your name]* — udondiane@gmail.com | Product owner during migration; roadmap post-migration |
| Academic supervisor (Aston) | *[Supervisor name]* | Evidence base + thought leadership |
| ACH executive sponsor | *[To be named]* | Budget approval; vendor sign-off |
| ACH ICT lead | *[To be named]* | Vendor relationship; Azure tenant; DPO liaison |
| ACH programme lead (B2E) | *[To be named]* | Super-user coordination; day-to-day product decisions |
| Vendor (managed service) | *[To be named at contract signature]* | Ongoing operations; SLA delivery |
| Vendor escalation | *[To be named at contract signature]* | Incident escalation |
| DPO | *[Name]* | Data protection sign-off |

### Escalation ladder
1. End-user issue → super-user
2. Unresolved → vendor support (SLA response)
3. Vendor SLA breach → ACH ICT lead → vendor account manager
4. ICT can't resolve → ACH executive sponsor
5. Post-KTP product decisions → KTP associate + ACH programme lead (year 1–2), then ACH product committee

---

## 15 · Appendices

| Appendix | Location |
|---|---|
| **A. Technical handover — Azure migration detail** | `azure-app/AZURE-HANDOVER.md` |
| **B. ACH ICT tabular scope (37 items)** | Section below |
| **C. Feature list — universal vs employability-specific** | Section below |
| **D. Session-by-session migration playbook** | Section below |
| **E. Repo file inventory (Azure-specific)** | Section below |
| **F. Post-handover change process** | Section below |
| G. Deployment docs (existing) | `docs/deployment/` |

---

## Appendix B · ACH ICT tabular scope

### Before Session 1 — pre-flight (3–5 working days lead time)

| # | Task | What it means | Priority |
|---|---|---|---|
| 1 | Microsoft Cloud for Nonprofits credit | Apply on Microsoft's Nonprofits portal with ACH's charity number. ~£2,750 free Azure spend/year | 🔴 |
| 2 | DPIA updated | Internal doc — refresh whenever data flow changes | 🔴 |
| 3 | RoPA updated | Add Microsoft + Azure OpenAI as processors | 🔴 |
| 4 | Privacy notice updated | Public statement — must name Microsoft before data moves | 🔴 |
| 5 | Data classification confirmed | Is HIM data "special category" under GDPR? Refugee status arguably is | 🔴 |
| 6 | Vendor DPA signed | Contract stopping vendor using data for anything else | 🔴 |
| 7 | Cyber insurance confirmed | Policy covers Azure hosting + AI processing | 🟡 |

### Session 1 — provisioning (ICT in the room, ~90 min)

| # | Task | Priority |
|---|---|---|
| 8 | Confirm the Azure tenant (existing M365 or fresh) | 🔴 |
| 9 | Create resource group `ach-him-prod` | 🔴 |
| 10 | Provision PostgreSQL Flexible Server (B1ms, UK South) | 🔴 |
| 11 | Provision Storage Account + 3 containers | 🔴 |
| 12 | Provision Static Web App | 🔴 |
| 13 | Provision Azure OpenAI + deployments | 🔴 |
| 14 | Set billing — cost centre + spend cap + alert | 🔴 |
| 15 | Assign Azure RBAC roles | 🔴 |
| 16 | Create workforce App Registration in Entra | 🔴 |
| 17 | Generate client secret (24-month expiry) | 🔴 |
| 18 | Grant admin consent for Graph `User.Invite.All` | 🔴 Global Admin only |
| 19 | Note Tenant GUID + App (client) ID | 🔴 |
| 20 | Entra External ID tenant (optional) | 🟡 |
| 21 | Paste env vars into Static Web App configuration | 🔴 |
| 22 | Azure Key Vault | 🟢 |

### Between Session 1 and 2

| # | Task | Priority |
|---|---|---|
| 23 | Time-boxed Supabase access for vendor | 🟡 |
| 24 | Add HIM URL to ACH's SSO catalogue | 🟢 |

### Session 4 — partner cutover

| # | Task | Priority |
|---|---|---|
| 25 | Approve partner-invitation email template | 🟡 |
| 26 | Draft "can't sign in" playbook for support | 🟡 |

### Session 5 — DNS cutover

| # | Task | Priority |
|---|---|---|
| 27 | Update DNS record — `him.ach.org.uk` → Azure | 🔴 ICT only |
| 28 | Confirm SSL cert provisions correctly | 🟡 |
| 29 | Watch Application Insights for 24h | 🟡 |
| 30 | "We've moved" comms to staff + partners | 🟡 |

### Post-migration housekeeping

| # | Task | Timing |
|---|---|---|
| 31 | Backup restore drill | Week 1 |
| 32 | Access review | Week 2 |
| 33 | Downgrade Supabase to read-only | Week 1 |
| 34 | Cancel Vercel billing | Week 2 |
| 35 | Delete Supabase project | Week 4 |
| 36 | Onboarding + offboarding SOP written | Week 4 |
| 37 | Named ICT contact handed to super-users | Week 4 |

### Recurring (forever)

| Task | Cadence |
|---|---|
| Access review | Quarterly |
| Azure cost review | Monthly |
| Vendor / support review | Quarterly |
| Security review (certs, DPA, DBS) | Yearly |
| SLT / trustee update on HIM | Quarterly |

---

## Appendix C · Feature list — universal vs employability-specific

### 🌍 Universal (~85% of the code)
Works for any programme measuring outcomes over time.

- Programme setup (projects, activities, cohorts)
- Beneficiary intake + consent
- HIM 7-domain framework (72 metrics, 148 indicators)
- Assessment engine (T0/T1/T2/T3)
- Whisper voice recorder + AI transcript analysis
- Evidence attachment
- Baseline hardlock + audit trail
- Beneficiary interim outcomes tracker
- Follow-up scheduling
- Cohort reporting + distance travelled
- Aggregate dashboard
- Featured quotes + case studies
- Multi-language (Arabic-ready)
- Framework library / capability investors view
- Consent + GDPR + audit + retention
- Access & identity (Entra staff + partner)
- Custom activities log
- Data exports (docx / xlsx / pdf)

### 💼 Employability-specific (~15% of the code)

- Employment partner directory
- Partner shortlisting / matching
- Partner questions (IKEA-style workforce set)
- Placement records + partner timepoints
- Milestones (offer / start / 90-day / 12-month / progression)
- Bridge to Employment demo pages + financial model
- Employment outcomes catalogue

### Implication
HIM can be pitched to funders of housing, wellbeing, integration, women's-group or education programmes with modest adaptation. This underwrites the post-KTP commercial and grant strategy.

---

## Appendix D · Session-by-session migration playbook

### Session 1 — Azure provisioning (~90 min)
**Who:** ACH ICT + KTP associate
**Goal:** live Azure environment with sign-in page returning 200

Walk through the checklist in Section 9 / Appendix B.
- Nonprofit credit applied
- All Azure resources provisioned
- Entra App Registration configured + admin consent granted
- All env vars copied into SWA
- **Stop point:** first request to the sign-in page returns 200

### Session 2 — Schema + dry-run (~60 min)
**Who:** KTP associate
**Goal:** know the migration will work before touching real data

- `npm run db:migrate` — applies all 60 migrations to Azure Postgres
- Sign in as ACH staff, dashboard renders (empty state)
- `npm run data:migrate -- --step=dump` — pulls Supabase snapshot
- `npm run files:migrate` (dry-run) — counts + estimates
- **Stop point:** validated dry-run

### Session 3 — Cutover rehearsal (~90 min)
**Who:** KTP associate
**Goal:** two working parallel copies (old and new)

- Snapshot Supabase (safety net)
- `npm run data:migrate -- --step=all` — dump, schema, restore, verify
- `npm run files:migrate -- --commit` — Blob copy
- `npm run files:migrate -- --verify` — checksum spot-check
- Sign in as real ACH staff on Azure, click through a live cohort
- **Stop point:** Azure and Vercel/Supabase behave identically

### Session 4 — Partner cutover (~60 min)
**Who:** KTP associate + ACH programme lead
**Goal:** all active partners on Entra sign-in

- Turn on Entra External ID (if applicable)
- For each active partner, use the invitations admin UI
- Confirm first partner redemption creates `partner_users` row
- **Stop point:** magic-token dependence eliminated

### Session 5 — DNS cutover + monitoring (~45 min + 24h)
**Who:** ACH ICT drives
**Goal:** production traffic on Azure

- DNS: `him.ach.org.uk` → Azure Static Web App
- Wait for propagation (~15–30 min)
- Watch Application Insights for 24h
- Decommission Vercel after 24h quiet; Supabase to read-only for 30 days
- **Stop point:** ACH is entirely on its Microsoft environment

---

## Appendix E · Repo file inventory (Azure-specific, 34 files, ~3,000 lines)

### Azure adapter (8 files)
```
azure-app/lib/azure/pool.ts
azure-app/lib/azure/query-builder.ts
azure-app/lib/azure/auth.ts
azure-app/lib/azure/entra.ts
azure-app/lib/azure/storage.ts
azure-app/lib/azure/graph.ts
azure-app/lib/azure/openai.ts
azure-app/lib/azure/client.ts
```

### Partner B2B invitations (5 files)
```
azure-app/lib/partner-access/actions.ts
azure-app/lib/partner-access/schema.ts
azure-app/lib/partner-access/post-signin.ts
azure-app/components/partners/partner-invitations.tsx
azure-app/supabase/migrations/060_partner_b2b_invitations.sql
```

### Overrides on parent behaviour (7 files)
```
azure-app/app/(ach)/partners/[id]/page.tsx
azure-app/app/(auth)/sign-in/page.tsx
azure-app/app/api/auth/[...nextauth]/route.ts
azure-app/lib/partners/resolve-current.ts
azure-app/lib/supabase/server.ts
azure-app/lib/supabase/client.ts
azure-app/lib/supabase/middleware.ts
```

### Migration scripts (3 files)
```
azure-app/scripts/migrate.mjs
azure-app/scripts/migrate-data.mjs
azure-app/scripts/migrate-files.mjs
```

### Deploy configuration (6 files)
```
azure-app/package.json
azure-app/next.config.js
azure-app/staticwebapp.config.json
azure-app/tsconfig.json
azure-app/postcss.config.js
azure-app/.env.example
```

### Handover pack (5 files)
```
azure-app/AZURE-HANDOVER.md
azure-app/README.md
azure-app/bootstrap.sh
azure-app/db/schema.sql
azure-app/.gitignore
```

**Everything else in a working folder is bootstrapped from parent (`../`) via `bash bootstrap.sh`.**

---

## Appendix F · Post-handover change process

For any HIM change after handover, use the flow below.

### Content / config change (no vendor)
1. Open the app admin UI
2. Edit — live immediately
3. Log the change in the Framework/Config version history

### UI tweak / bug fix / small change (batched)
1. KTP associate (or ACH-nominated developer) pushes a branch
2. Bundle 5–10 small changes weekly into one PR
3. Vendor reviews + merges
4. Vendor CI deploys to production

### New feature
1. Write a one-page spec (template in `docs/handover/feature-spec-template.md`)
2. Vendor scopes + quotes
3. ACH approves budget
4. Vendor builds in staging
5. UAT sign-off by ACH programme lead
6. Deploy to production

### Data correction (vendor-only)
1. Raise ticket describing the fix + audit reason
2. Vendor confirms + executes with audit trail
3. Vendor reports back on completion

### Emergency incident (vendor SLA)
1. Super-user or ACH staff report → vendor support
2. Vendor triages per SLA (typically 2h ack, 8h fix)
3. If SLA breach → ACH ICT escalates
4. Post-incident review at next quarterly

### Never bypass
- Direct pushes to `main` without vendor review
- Manual production DB edits
- New third-party dependencies without vendor knowledge
- New API integrations without DPIA update

---

## Sign-off

By accepting this handover pack, the receiving party confirms understanding of:
- The scope of HIM Platform as described
- The migration plan as described
- The vendor + ICT + programme-lead responsibilities as described
- The Definition of Done criteria in Section 13
- The operating model + change process in Section 10 + Appendix F

| Role | Name | Date | Signature |
|---|---|---|---|
| KTP associate (handing over) | *[Your name]* | | |
| ACH executive sponsor | | | |
| ACH ICT lead | | | |
| ACH programme lead | | | |
| Vendor account lead | | | |

---

*This document is version-controlled in the HIM repository at `HANDOVER.md`. Updates require a PR to the repository main branch.*
