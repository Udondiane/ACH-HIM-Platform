# HIM Platform · Enhancement Backlog

Short, dated log of enhancements and known items to pick up during the Azure migration and Phase 7 alpha-period support (per `HANDOVER.md` Appendix F).

Not a bug tracker (use GitHub issues for bugs once the repo is in ACH's org) and not a roadmap (that lives with the product owner). This file is for *known enhancement work* that is scoped but not yet built.

Format: one `###` entry per item. Oldest at the bottom. Mark done items with a strikethrough and the date closed, so the history stays visible.

---

### 60-day auto-deletion of voice recordings

- **Logged:** 2026-10-07 — Enobong Udondian
- **Priority:** Medium (compliance; adds a defined retention position where one does not currently exist)
- **Status:** Backlog
- **Target phase:** Phase 7 (alpha-period support) — can be built earlier if the engineer has capacity during migration

**Why**

GDPR data-minimisation and the ACH consent framing both expect a defined retention window for raw voice recordings. The transcript is retained as text in `assessment_responses.narrative`; the raw audio file is what gets purged after the window.

**Scope**

1. **Migration** — add `deleted_at timestamptz` and `deletion_reason text` nullable columns to `assessment_attachments`.
2. **Deletion script** — `scripts/delete-old-voice-recordings.mjs`:
   - Reads env `RETENTION_AUDIO_DAYS` (default `60`).
   - Finds `assessment_attachments` rows where `mime_type` starts with `audio/`, `uploaded_at < now() - interval 'N days'`, and `deleted_at is null`.
   - Deletes the blob from the `assessment-evidence` Supabase Storage bucket.
   - Writes `deleted_at = now()`, `deletion_reason = 'retention_policy_60d'` on the row.
   - Logs count of records processed, failed, skipped.
   - Read-only on `assessment_responses` — transcripts are preserved.
3. **Scheduled runner** — `.github/workflows/retention-audio-cleanup.yml`, daily at 03:00 UTC. Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub secrets. Reuses the pattern from `.github/workflows/nightly-backup.yml`.
4. **UI tweak** — in the assessment attachment list component, if `deleted_at` is set and `mime_type` starts with `audio/`, show "Voice recording deleted — retention policy ({date})" in place of the download button. Transcript still renders.
5. **Compliance note** — add a "Retention" subsection to `docs/deployment/08-compliance.md` recording the policy, mechanism, and audit field.

**Design decisions (agreed defaults)**

- Soft delete the DB row (`deleted_at` set) so the audit trail of "a voice recording existed here" survives. The blob is hard-deleted.
- Clock starts from `uploaded_at` (file age).
- Consent-withdrawal does not trigger this policy — that remains a separate immediate-deletion action.
- Retention length configurable via `RETENTION_AUDIO_DAYS` env var; defaults to 60.

**Estimated effort:** ~90 minutes end-to-end for the engineer, including the UI update and the compliance-doc change.

**Not in scope**

- Auto-deletion of non-audio attachments (PDFs, images). Those are evidence packs and have different retention requirements — out of scope for this item.
- Immediate deletion on consent withdrawal (separate backlog item once that one is scoped).
- Retention for the transcript text. Transcript remains until the parent assessment is deleted or the candidate exercises right-to-erasure.

---
