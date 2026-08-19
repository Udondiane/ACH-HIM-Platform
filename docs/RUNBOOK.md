# HIM Platform · Operations Runbook

For whoever is responsible for running HIM day-to-day at ACH. Assumes no prior context. Read a section when you need it — you do not need to read the whole document.

Last reviewed: August 2026 · v1.0

---

## Contents

1. [What HIM is and what runs where](#1-what-him-is-and-what-runs-where)
2. [How to deploy a change](#2-how-to-deploy-a-change)
3. [How to roll back](#3-how-to-roll-back)
4. [How to invite, change, or remove users](#4-how-to-invite-change-or-remove-users)
5. [How to rotate credentials](#5-how-to-rotate-credentials)
6. [How to view logs](#6-how-to-view-logs)
7. [How to restore from backup](#7-how-to-restore-from-backup)
8. [Incident response — first 15 minutes](#8-incident-response--first-15-minutes)
9. [Common problems and their fixes](#9-common-problems-and-their-fixes)
10. [Escalation path](#10-escalation-path)

---

## 1 · What HIM is and what runs where

HIM is a web application. Case workers, programme leads, partners, and administrators all use it through their browser. There is no installed desktop or mobile app.

The application has four layers, each hosted on a different service. Every layer needs to be running for HIM to work.

| Layer | What it does | Where it runs | Managed at |
|---|---|---|---|
| **Web app** | The pages users see; the server actions that read and write data | Vercel | vercel.com — search for the `ach-him-platform` project |
| **Database** | Every beneficiary, partner, placement, assessment, and audit entry | Supabase (Postgres) | supabase.com — the ACH project |
| **File storage** | Uploaded evidence (photos, PDFs) and voice recordings | Supabase Storage | Same Supabase project, "Storage" tab |
| **AI features** | Voice transcription (Whisper) and AI-assisted scoring (GPT-4o mini) | Azure OpenAI (UK South region) | portal.azure.com — the resource in ACH's Azure tenant |

**Simple mental model:**

```
Browser  ──►  Vercel (web app)  ──►  Supabase (data + files)
                    │
                    └──►  Azure OpenAI (AI features)
```

When something breaks, work through the layers in that order. Most incidents are either Vercel (deploy issue) or Supabase (query or storage issue). Azure OpenAI failing only affects the AI features; the rest of HIM keeps working.

---

## 2 · How to deploy a change

HIM deploys automatically. Any commit pushed to the `main` branch on GitHub triggers a fresh Vercel build; if the build succeeds, it goes live in production within about two minutes.

### The routine flow

1. A developer pushes a commit to `main` on GitHub.
2. Vercel receives the webhook and starts a build.
3. Build takes 60–90 seconds. Watch progress at vercel.com → the project → Deployments.
4. On success, Vercel promotes the new build to the production URL automatically.
5. Verify the site is live: open the production URL and confirm the dashboard loads.
6. Verify the health endpoint: `GET /api/health` should return `200`. *(Endpoint available after the hardening layer is ported — see the roadmap.)*

### If the build fails

The Vercel deployment goes red, the previous version stays live, and no users are affected. To diagnose:

1. Vercel → Deployments → click the failed deploy
2. Read the build log — the first red error line usually names the problem
3. Common causes: TypeScript error introduced by the commit, missing environment variable, dependency install failure
4. Push a fix to `main`, or roll back (section 3) if you can't fix quickly

### Deploying to a preview environment first

Every branch other than `main` deploys to a **preview URL** — a temporary Vercel URL used for testing. Preview URLs are automatically protected by Vercel's login gate. Use them to test a change before merging to `main`.

---

## 3 · How to roll back

If a deploy breaks something, roll back to the previous good version. This takes about 30 seconds and requires no code changes.

### Rollback procedure

1. Open vercel.com → the `ach-him-platform` project → **Deployments**
2. Find the last known-good deployment (usually the one before the current live one)
3. Click the three-dot menu (⋯) on that deployment
4. Click **Promote to Production**
5. Confirm
6. Within 30 seconds, that older version is live at the production URL
7. Refresh the browser and confirm the site is back to normal

### When rollback is the right first move

- Users report the site is broken immediately after a deployment
- The production URL is returning errors or a blank page
- The Vercel deploy is green but the app behaves incorrectly

### When rollback will NOT fix it

- Database issues (schema mismatch, corrupted data) — see section 7 for restore
- Third-party outage (Supabase down, Azure down) — see the service status pages listed in section 10
- Environment-variable misconfiguration — the same misconfig applies to old deploys too

**Rule of thumb:** if in doubt, roll back first, then investigate. A working old version is always better than a broken new one while you diagnose.

---

## 4 · How to invite, change, or remove users

All user management happens on one screen: **`/admin/users`**. Only ICT administrators can see this page.

### To invite a new user

1. Sign into HIM as an ICT administrator
2. Open `/admin/users` from the sidebar (Administration section)
3. In the **Invite a new user** form:
   - Type the person's email address
   - Pick their team role from the dropdown
4. Click **Send invitation**
5. They receive an email with a sign-in link within seconds *(check spam if it doesn't arrive within a minute)*

### Team roles at a glance

The eight ACH team roles determine which parts of HIM the user can see and change:

| Team role | Who this is for |
|---|---|
| **Employability coach** | Case workers managing a caseload |
| **Trainer** | Staff who run training programmes and sessions |
| **Support worker** | Staff providing 1-to-1 support with a caseload |
| **Programme lead** | Team managers overseeing coaches / trainers / support workers |
| **Bid & business development** | Team members writing bids, using impact evidence |
| **Board / senior leadership** | Read-only strategic dashboards, no case-level data |
| **Finance & contracts** | Pricing tool, development fund, TOMs claims |
| **ICT administrator** | User management, audit log, backups — no case-level data |

Full permissions per role are documented in the training material.

### To change someone's role

1. Open `/admin/users`
2. Find their row in the user list
3. Click the team-role dropdown on their row
4. Pick the new role — it saves automatically
5. They see the new permissions on their next page load *(they do not need to sign out and back in)*

### To remove someone's access

1. Open `/admin/users`
2. Find their row
3. Click **Deactivate**
4. Confirm

The user's role row is removed and their authentication account is banned. Any active session ends immediately. Historical activity remains in the audit trail — "created by" links stay resolvable.

### If someone needs their access restored

Re-invite them by email. The system will find the existing account and re-attach the new role.

### How sign-in works for invited users

*(Applies once the password + MFA rollout completes.)*

1. First-time invitee receives an email with a link to "set your password"
2. They set a password (minimum 12 characters, mix of types)
3. Optional but strongly recommended: they set up MFA using an authenticator app
4. They sign in with email + password + 6-digit MFA code from that point on
5. If they forget their password, they use the "Forgot password?" link on the sign-in page — self-serve, no ICT intervention needed
6. If they lose their MFA device, an ICT administrator can reset it from `/admin/users`

---

## 5 · How to rotate credentials

Credentials should be rotated on a schedule (annually at minimum) and immediately if a breach or exposure is suspected.

### The credentials HIM uses

| Credential | Where it lives | Where it's used |
|---|---|---|
| Supabase project URL | Vercel env: `NEXT_PUBLIC_SUPABASE_URL` | Public; safe to expose |
| Supabase anon key | Vercel env: `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public; safe to expose |
| Supabase service role key | Vercel env: `SUPABASE_SERVICE_ROLE_KEY` | **Server-only, never exposed to browser** |
| Cron secret | Vercel env: `CRON_SECRET` | Authenticates Vercel's daily cron job |
| Azure OpenAI endpoint | Vercel env: `AZURE_OPENAI_ENDPOINT` | Server-only |
| Azure OpenAI API key | Vercel env: `AZURE_OPENAI_API_KEY` | Server-only |

Full detail lives in the **Credential Inventory** document (separate, stored in the password vault, not in the repo).

### General rotation procedure

1. Generate the new credential at its source (Supabase dashboard, Azure portal, or a random-string generator for `CRON_SECRET`)
2. Add the new credential to Vercel: Project → Settings → Environment Variables → Add (or Edit)
3. Trigger a redeploy: Vercel → Deployments → Redeploy the latest production build
4. Verify the site still works after redeploy — sign in, load the dashboard
5. Revoke the old credential at its source
6. Update the Credential Inventory document with the rotation date and who did it

### If a rotation goes wrong

The site will start returning errors. Roll back the environment change: Vercel → Settings → Environment Variables → set the value back to the old one → redeploy. Then investigate before retrying.

### Rotation schedule

| Credential | Rotate every | Owner |
|---|---|---|
| Supabase service role key | 12 months | ICT admin |
| Cron secret | 12 months | ICT admin |
| Azure OpenAI API key | 12 months (or per Azure policy) | ICT admin |
| Supabase anon key | Only on breach — this is public by design | — |
| Individual user passwords | Users manage their own via "Forgot password?" | Users |

---

## 6 · How to view logs

Two log surfaces cover 99 % of investigations:

### Vercel logs (for anything the web app did)

1. Vercel → the project → **Logs** tab
2. Filter by time range and by severity
3. Look for red rows or messages starting with `[error]`
4. Click a log row to expand and see the full stack trace

**Use Vercel logs when:** users report page errors, pages hang, or a specific action fails.

### Supabase logs (for anything the database did)

1. supabase.com → the ACH project → **Logs** section (in the left sidebar)
2. Sub-tabs: **Postgres**, **Auth**, **Storage**, **Edge Functions**
3. Search by time range
4. Look for anything at `ERROR` level or above

**Use Supabase logs when:** data is missing that should be there, a user says they cannot sign in, or an upload fails.

### Tracing an error report from a user

The user's error page shows a **reference code** — a short string like `abc123def456`. Ask them to send it to you along with the time and what they were doing.

1. Vercel logs → filter by that time window
2. Search for the reference code — Vercel logs include it on the erroring request
3. That log entry has the full stack trace and request context

### What NOT to do in the logs

- Do not attempt to modify logs — they are read-only and audit-relevant
- Do not export raw logs to email or shared drives without redaction — logs contain user IDs and query fragments that may be sensitive
- Do not delete or truncate log retention settings

---

## 7 · How to restore from backup

Supabase takes an automatic daily backup of the entire database. Restore is a controlled operation that you should practise once before you ever need to do it for real (see the restore drill schedule in section 8).

### Backup retention

- **Free tier:** 7 days of daily backups
- **Pro tier:** 30 days of daily backups plus point-in-time recovery
- Confirm the current retention in supabase.com → the project → **Database** → **Backups**

### Restore procedure (planned, not incident)

Practise this on a **non-production Supabase project** first. Never practise on production.

1. In supabase.com → the project → **Backups** → click the backup you want to restore
2. Choose the restore target — for a drill, use a fresh test project
3. Confirm the restore
4. Supabase creates a new database from that backup — takes 5–15 minutes depending on size
5. Once complete, connect the test app to the restored database (change the Supabase URL / keys in a preview Vercel env)
6. Verify the data is present (row counts, spot-check a beneficiary)
7. Document what worked and what did not

### Restore procedure (real incident)

If production data is corrupted or accidentally deleted:

1. **Stop writing to production immediately** — put HIM in maintenance mode or roll to a maintenance page (see section 8)
2. Identify the last backup taken *before* the corrupting change
3. In supabase.com → the project → **Backups** → restore that backup to a **new database instance** (not overwriting production yet — always keep the corrupted version until you have verified the restored version works)
4. Verify the restored database has the correct data
5. Point Vercel's environment variables at the restored database
6. Redeploy
7. Verify HIM works with the restored data
8. Communicate to users what data may have been lost (anything created between the backup and the incident is gone)
9. Only *after* full verification, decommission the corrupted database

### Restore drill schedule

Do a restore drill **once every three months**. Log the outcome in the Credential Inventory document. If a drill fails, treat it as a P1 incident — the backup you cannot restore is worth nothing.

---

## 8 · Incident response — first 15 minutes

Follow this sequence when something is on fire. Do not try to fix root cause in the first 15 minutes — stabilise first, diagnose second.

### Minute 0 · Confirm the incident

- Reproduce it yourself in a private browser
- Check the health endpoint: `GET /api/health` on the production URL

If `/api/health` returns `200` and you cannot reproduce, it may be a single-user issue — see section 9.

### Minute 1–3 · Triage the blast radius

- Is it affecting one user, some users, or all users?
- Is it a specific page, all pages, or one action?
- Are third-party services healthy? Check:
  - status.vercel.com
  - status.supabase.com
  - status.azure.com

### Minute 3–5 · Decide on stabilisation

If the incident is bad enough that users cannot work:

- **If it started right after a deploy:** roll back (section 3). This is by far the most common fix.
- **If Vercel or Supabase is down:** there is nothing to do but wait and communicate. Post an update to users.
- **If the database is being written to incorrectly:** put the app in read-only or maintenance mode — set `MAINTENANCE_MODE=true` in Vercel env (feature to be added if needed), or in the extreme case, take the Vercel deployment offline entirely.

### Minute 5–10 · Communicate

- Post a short factual message to the ACH internal channel: *"HIM is currently unavailable. We are investigating. Next update in 15 minutes."*
- Do not speculate about cause or timeline in the first message. Facts only.

### Minute 10–15 · Diagnose

- Vercel logs — anything in the last 30 minutes at error level (section 6)
- Supabase logs — same window
- Recent commits in GitHub — did something ship recently that could be the cause?

### After the incident

- Write a short **incident note** — what happened, when it started, when it ended, what fixed it, what to change so it does not happen again
- File the note alongside this runbook under `docs/incidents/`
- Review at the next monthly ops meeting

### Standing communication rules

- Users first, always
- If you do not know what caused it, say so
- If you rolled back, say so — it is not a failure, it is the correct move
- Never blame a person in a public message

---

## 9 · Common problems and their fixes

Nine times out of ten, a user issue matches one of these patterns.

| Symptom | Likely cause | First thing to try |
|---|---|---|
| User cannot sign in | They never received the email, or it went to spam | Check spam. If not there, use `/admin/users` to confirm their email is correct. Re-invite if needed. |
| User signs in but sees a blank sidebar | Their `user_roles` row is missing or their `team_role` is not set | Open `/admin/users`, find their row, set their team role. |
| Partner user sees "No partner selected" | Their `partner_id` is not set on the role row | Contact the vendor to fix directly in the database — no UI for this yet |
| Case worker cannot see a beneficiary they expect | The beneficiary is on another coach's caseload, or is in the wrong project | Confirm the beneficiary's assigned coach; verify the case worker's team role is `employability_coach` or above |
| Assessment page reads "locked" | The project is closed for edits, or the assessment status is `reviewed` | Ask the Programme Lead to reopen the project or the assessment |
| Voice recording will not upload | Browser microphone permission denied, or the audio file is too large | Ask the user to check browser microphone permission. Max upload is 25 MB per file. |
| Report PDF export shows blank pages | The beneficiary has no assessment data yet, or the framework is not loaded | Confirm at least one assessment has been captured. Check `/admin/framework` shows the domains. |
| Slow page loads | Vercel cold-start, or a large query. First load slower than subsequent. | Refresh. If persistent, check Vercel logs for slow requests. |
| Sign-in link expired | Links expire 60 minutes after issue | User goes to `/sign-in` and requests a new one |
| "Something went wrong" page with a reference code | An unhandled exception rendered the error boundary | Copy the reference code, look it up in Vercel logs (section 6), take action from the stack trace |
| A user says a report shows the wrong number | Data was recently edited, browser is cached, or the underlying query has a bug | Refresh with `Ctrl+Shift+R`. If still wrong, escalate — this is a data / logic issue, not a config issue |
| Cron job did not run | `CRON_SECRET` is missing or mismatched, or Vercel cron is disabled | Vercel → Settings → Cron Jobs → confirm it is enabled. Check `CRON_SECRET` env var matches what the cron caller sends. |

If a symptom is not on this list, log it — after resolution, add a row here so the next person benefits.

---

## 10 · Escalation path

When ICT is stuck, escalate in this order. Never skip a level unless the level above is unreachable.

### Level 1 · ACH ICT (in-house)

Everything in sections 1–9 of this runbook is intended to be resolvable by the ICT team without external help. If a problem cannot be resolved with the runbook alone, escalate.

### Level 2 · Vendor (post-KTP)

- **Who:** the third-party support vendor engaged for ongoing platform management
- **How to reach:** contact details in the Credential Inventory document, or the vendor contract
- **What to send:** short description of the issue, what has been tried, relevant log excerpts (redact user data), reference codes from users, time window
- **Expected response time:** per the vendor SLA — typically same-day for P1, next business day for P2
- **Cost:** deducted from the pre-paid break-fix day pool

### Level 3 · Third-party service support

Use these only when the issue is clearly with the underlying service, not with HIM itself.

| Service | Support channel | Use when |
|---|---|---|
| Vercel | vercel.com → Help → Support (paid plans) or Community forum (free plans) | Build failing that seems unrelated to code changes; production URL returning 500 with no app-side error |
| Supabase | supabase.com → Help → Support (paid plans) or Discord | Database connection issues; RLS behaviour that does not match policy; backup restore fails |
| Microsoft Azure | portal.azure.com → Support → New Support Request | Azure OpenAI unavailable, quota exceeded, tenant-level issues |
| GitHub | support.github.com | Repository access issues; push failing with authentication errors |

### Emergency contact — data breach or ICO notifiable event

If personal data has been exposed, altered, or lost in a way that could affect refugees or vulnerable adults:

1. **Stop the ongoing exposure** if possible (take the app offline, revoke tokens)
2. **Contact the ACH Data Protection Lead within 1 hour** — the ICO notification clock starts at 72 hours from discovery
3. **Do not delete affected data** — you need it to determine scope
4. **Document everything** — timestamps, what was exposed, who accessed it, what has been done

The DPL will decide whether to notify the ICO and affected individuals. Do not communicate externally until the DPL has approved the message.

---

## Runbook maintenance

This document is versioned in the HIM repository at `docs/RUNBOOK.md`. Every change to the platform that affects operations should be reflected here in the same commit.

**Owners:**
- Content: ACH ICT team
- Editorial review: Whoever holds the ongoing platform management contract

**Review cadence:** Quarterly at minimum. Immediately after any P1 incident.

---

*End of runbook.*
