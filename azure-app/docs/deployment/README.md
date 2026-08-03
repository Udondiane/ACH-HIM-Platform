# HIM Platform · Deployment Pack

The set of documents that turn HIM from *"the KTP Associate's app"* into *"a system ACH owns and can run."*

Each file addresses one phase of the 44-step prototype-to-production checklist adapted for HIM's context.

## Read in this order

| # | Document | Status | Blocker |
|---|---|---|---|
| 00 | [`00-inventory.md`](./00-inventory.md) — stack, secrets, data | ✅ Complete | — |
| 01 | [`01-code-ownership.md`](./01-code-ownership.md) — repo, secret audit, dependencies | ✅ Complete | ACH GitHub org for transfer |
| 02 | [`02-security.md`](./02-security.md) — RLS, authz, rate limits, injection | ✅ Complete (SSO pending) | Entra ID setup |
| 03 | `03-identity.md` — Entra ID SSO wiring | ⏳ Not written | ACH Entra ID decision |
| 04 | `04-environments.md` — dev/staging/prod split | ⏳ Not written | Azure provisioning |
| 05 | [`05-pipeline.md`](./05-pipeline.md) — CI/CD, deploys, rollback | ✅ Complete (deploy pending) | Azure/Vercel account |
| 06 | `06-hosting.md` — Azure Container Apps setup | ⏳ Not written | ACH Azure decisions |
| 07 | `07-observability.md` — Sentry + uptime + LLM spend | ⏳ Not written | Tool choice |
| 08 | [`08-compliance.md`](./08-compliance.md) — DFD, subprocessors, incident response | ✅ Complete (DPIA pending) | DPO sign-off |
| 09 | [`09-runbook.md`](./09-runbook.md) — ops runbook, common failures | ✅ Complete | Named successor |

## What's in this pack today

Every document above marked ✅ is done. They're the answer to *"what would security/IT/compliance ask for?"*

- Stack + data inventory that IT can read in one sitting
- Secret scan showing no credentials leaked in the codebase
- RLS audit finding + fix (migration 044 added)
- Rate limiting on the four AI endpoints
- CI pipeline that runs on every PR (`.github/workflows/ci.yml`)
- Full data flow diagram + subprocessor list + retention policy
- Incident response one-pager
- Operations runbook with the five most common failures + fixes

## What's not in this pack yet

Everything marked ⏳ needs an ACH-side decision or provisioning:

- SSO (Microsoft Entra ID) — the single biggest gap for org-wide readiness
- Azure infrastructure provisioning (Postgres, Container Apps, Blob, Key Vault)
- Hosting migration off Vercel personal account
- Sentry + uptime monitoring accounts
- DPIA signature
- Named successor engineer

## The one-line summary for leadership

*HIM is functionally complete, technically hardened where it can be, and legally-documented. Everything remaining is organisational: hosting, identity, and ownership. Those three decisions unlock the remaining phases (`03-*`, `04-*`, `06-*`, `07-*`).*

---

*Last updated: 2026-07-22*
