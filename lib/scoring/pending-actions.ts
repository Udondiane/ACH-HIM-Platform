/* Pending-actions resolver. Surfaces the state transitions a
   caseworker MIGHT be missing - 3-month assessment due, 6-month
   exit assessment due, 12-month follow-up due, retention checkpoint
   due, exit reason missing, at-risk flag set.

   Each item is a row the user can act on. No notifications fired;
   the dashboard widget makes them visible. */

export interface PendingAction {
  kind:
    | 'baseline_missing'
    | 'mid_3mo_due'
    | 'exit_6mo_due'
    | 'followup_12mo_due'
    | 'retention_6mo_due'
    | 'retention_12mo_due'
    | 'exit_reason_missing'
    | 'at_risk_flagged';
  candidateId: string;
  candidateRef: string;
  cohortRef?: string;
  due_in_days?: number;
  reason?: string;
  href: string;
}

const KIND_LABELS: Record<PendingAction['kind'], string> = {
  baseline_missing:      'Baseline assessment missing',
  mid_3mo_due:           '3-month assessment due',
  exit_6mo_due:          '6-month exit assessment due',
  followup_12mo_due:     '12-month follow-up due',
  retention_6mo_due:     '6-month retention check due',
  retention_12mo_due:    '12-month retention check due',
  exit_reason_missing:   'Exit reason missing',
  at_risk_flagged:       'Flagged at-risk',
};

export function labelFor(kind: PendingAction['kind']): string {
  return KIND_LABELS[kind] ?? kind;
}

function monthsBetween(from: Date | string, to: Date = new Date()): number {
  const fromDate = typeof from === 'string' ? new Date(from) : from;
  return (to.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4);
}

export interface CandidateRow {
  id: string;
  candidate_ref: string;
  status: string;
  exit_reason: string | null;
  exit_date: string | null;
  at_risk: boolean;
  at_risk_reason: string | null;
  cohort_candidates?: { cohorts?: { cohort_ref?: string; start_date?: string | null } }[];
}

export interface AssessmentRow {
  candidate_id: string;
  timepoint: string;
}

export interface PlacementRow {
  candidate_id: string;
  start_date: string;
  status: string;
  candidate_ref?: string;
}

export function computePendingActions(
  candidates: CandidateRow[],
  assessments: AssessmentRow[],
  placements: PlacementRow[],
): PendingAction[] {
  const out: PendingAction[] = [];

  const tpByCandidate = new Map<string, Set<string>>();
  for (const a of assessments) {
    if (!tpByCandidate.has(a.candidate_id)) tpByCandidate.set(a.candidate_id, new Set());
    tpByCandidate.get(a.candidate_id)!.add(a.timepoint);
  }

  for (const c of candidates) {
    const tps = tpByCandidate.get(c.id) ?? new Set<string>();
    const cohortRef = c.cohort_candidates?.[0]?.cohorts?.cohort_ref;
    const cohortStart = c.cohort_candidates?.[0]?.cohorts?.start_date;
    const monthsInProgramme = cohortStart ? monthsBetween(cohortStart) : null;

    if (c.at_risk) {
      out.push({ kind: 'at_risk_flagged', candidateId: c.id, candidateRef: c.candidate_ref, cohortRef, reason: c.at_risk_reason ?? undefined, href: `/candidates/${c.id}` });
    }

    if (c.status === 'in_programme' || c.status === 'placed') {
      if (!tps.has('baseline')) {
        out.push({ kind: 'baseline_missing', candidateId: c.id, candidateRef: c.candidate_ref, cohortRef, href: `/candidates/${c.id}` });
      }
    }

    if (monthsInProgramme != null) {
      if (monthsInProgramme >= 3 && !tps.has('mid_3mo')) {
        out.push({ kind: 'mid_3mo_due', candidateId: c.id, candidateRef: c.candidate_ref, cohortRef, due_in_days: Math.round((monthsInProgramme - 3) * 30), href: `/candidates/${c.id}` });
      }
      if (monthsInProgramme >= 6 && !tps.has('exit_6mo')) {
        out.push({ kind: 'exit_6mo_due', candidateId: c.id, candidateRef: c.candidate_ref, cohortRef, due_in_days: Math.round((monthsInProgramme - 6) * 30), href: `/candidates/${c.id}` });
      }
      if (monthsInProgramme >= 12 && !tps.has('followup_12mo')) {
        out.push({ kind: 'followup_12mo_due', candidateId: c.id, candidateRef: c.candidate_ref, cohortRef, due_in_days: Math.round((monthsInProgramme - 12) * 30), href: `/candidates/${c.id}` });
      }
    }

    if (['completed', 'placed', 'progressed', 'withdrawn'].includes(c.status) && !c.exit_reason) {
      out.push({ kind: 'exit_reason_missing', candidateId: c.id, candidateRef: c.candidate_ref, cohortRef, href: `/candidates/${c.id}/edit` });
    }
  }

  for (const p of placements) {
    const months = monthsBetween(p.start_date);
    const cand = candidates.find(c => c.id === p.candidate_id);
    const ref = cand?.candidate_ref ?? p.candidate_ref ?? '—';
    if (months >= 6 && !['completed_6mo', 'completed_12mo', 'left_pre_6mo'].includes(p.status)) {
      out.push({ kind: 'retention_6mo_due', candidateId: p.candidate_id, candidateRef: ref, due_in_days: Math.round((months - 6) * 30), href: `/candidates/${p.candidate_id}` });
    }
    if (months >= 12 && !['completed_12mo', 'left_6_to_12mo'].includes(p.status)) {
      out.push({ kind: 'retention_12mo_due', candidateId: p.candidate_id, candidateRef: ref, due_in_days: Math.round((months - 12) * 30), href: `/candidates/${p.candidate_id}` });
    }
  }

  out.sort((a, b) => {
    if (a.kind === 'at_risk_flagged' && b.kind !== 'at_risk_flagged') return -1;
    if (b.kind === 'at_risk_flagged' && a.kind !== 'at_risk_flagged') return 1;
    return (b.due_in_days ?? 0) - (a.due_in_days ?? 0);
  });

  return out;
}
