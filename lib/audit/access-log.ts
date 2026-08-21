'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Log a read of a beneficiary record. Call this from any server-side
 * flow that surfaces identifiable candidate data — the candidate
 * detail page, the outcomes report (for each candidate whose data is
 * rendered), the CSV export, the tokenised partner view once
 * authenticated. Fire-and-forget: the log write never blocks the
 * calling flow, and a failure to log never fails the read.
 *
 * Underpins GDPR data-subject-access-request responses ("show me
 * every access of my record"). Also useful for spotting unusual
 * access patterns during a security review.
 */
export async function logCandidateAccess(
  candidateId: string,
  opts?: { accessType?: 'view' | 'export' | 'report_generated'; route?: string; requestId?: string },
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('candidate_access_log').insert({
      candidate_id: candidateId,
      accessed_by: user.user?.id ?? null,
      access_type: opts?.accessType ?? 'view',
      route: opts?.route ?? null,
      request_id: opts?.requestId ?? null,
    } as never);
  } catch (e) {
    // Best-effort logging; never block a read.
    console.error('[audit/access-log] logCandidateAccess failed', {
      candidateId, error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Batch variant — logs one row per candidate id at once. Use when
 * rendering a report that surfaces many candidates in one query
 * (aggregate impact report, cohort roster) to keep the audit
 * granular without N separate insert round-trips.
 */
export async function logCandidateAccessBatch(
  candidateIds: string[],
  opts?: { accessType?: 'view' | 'export' | 'report_generated'; route?: string; requestId?: string },
): Promise<void> {
  if (candidateIds.length === 0) return;
  try {
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    const rows = candidateIds.map(id => ({
      candidate_id: id,
      accessed_by: user.user?.id ?? null,
      access_type: opts?.accessType ?? 'view',
      route: opts?.route ?? null,
      request_id: opts?.requestId ?? null,
    }));
    await supabase.from('candidate_access_log').insert(rows as never);
  } catch (e) {
    console.error('[audit/access-log] logCandidateAccessBatch failed', {
      count: candidateIds.length, error: e instanceof Error ? e.message : String(e),
    });
  }
}
