/**
 * Uplift computation utilities for Capability Investor reporting.
 *
 * Always reports TWO numbers:
 *   - Completers basis: average across candidates who completed the
 *                       full timepoint sequence (baseline + exit)
 *   - Intention-to-treat: average across ALL starters; dropouts are
 *                         held at their baseline score (zero uplift)
 *
 * Per the master design (§6): the cardinal sin in evaluation is dropping
 * leavers from the denominator to flatter the result. Both numbers are
 * shown together on every Capability Investor report.
 */

export interface AssessmentResponse {
  candidate_id: string;
  assessment_id: string;
  timepoint: 'baseline' | 'mid_3mo' | 'exit_6mo' | 'followup_12mo';
  domain: string;
  numeric_value: number | null;
}

export interface UpliftByDomain {
  domain: string;
  baselineAvg: number | null;
  exitAvgCompleters: number | null;
  exitAvgItt: number | null;
  upliftCompleters: number | null;
  upliftItt: number | null;
  completersN: number;
  starterN: number;
}

/**
 * Compute domain-level uplift from a flat list of assessment responses.
 * Domain values are averaged per candidate-per-timepoint, then averaged
 * across the candidate cohort.
 *
 * @param starters Set of candidate IDs that started the project. Used as
 *                 the ITT denominator. Anyone in the responses but NOT in
 *                 starters is ignored (e.g. exploratory assessments).
 */
export function computeUplift(
  responses: AssessmentResponse[],
  starters: string[],
  domains: string[],
): UpliftByDomain[] {
  const starterSet = new Set(starters);

  // Step 1: per-candidate per-domain per-timepoint average
  type Bucket = Map<string, Map<string, number[]>>; // candidate -> domain -> values
  const baseline: Bucket = new Map();
  const exit: Bucket = new Map();

  for (const r of responses) {
    if (!starterSet.has(r.candidate_id)) continue;
    if (r.numeric_value == null) continue;
    const target = r.timepoint === 'baseline'
      ? baseline
      : (r.timepoint === 'exit_6mo' || r.timepoint === 'followup_12mo' ? exit : null);
    if (!target) continue;
    if (!target.has(r.candidate_id)) target.set(r.candidate_id, new Map());
    const m = target.get(r.candidate_id)!;
    if (!m.has(r.domain)) m.set(r.domain, []);
    m.get(r.domain)!.push(r.numeric_value);
  }

  const candidateDomainAvg = (b: Bucket, candidateId: string, domain: string): number | null => {
    const m = b.get(candidateId);
    if (!m) return null;
    const arr = m.get(domain);
    if (!arr || arr.length === 0) return null;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  };

  // Step 2: per-domain aggregates
  return domains.map(domain => {
    let baselineSum = 0, baselineN = 0;
    let exitSumCompleters = 0, exitNCompleters = 0;
    let upliftSumCompleters = 0;
    let upliftSumItt = 0;

    for (const candidateId of starterSet) {
      const baseAvg = candidateDomainAvg(baseline, candidateId, domain);
      const exitAvg = candidateDomainAvg(exit, candidateId, domain);

      if (baseAvg != null) {
        baselineSum += baseAvg;
        baselineN += 1;
      }
      if (baseAvg != null && exitAvg != null) {
        exitSumCompleters += exitAvg;
        exitNCompleters += 1;
        upliftSumCompleters += (exitAvg - baseAvg);
        upliftSumItt += (exitAvg - baseAvg);
      } else if (baseAvg != null) {
        // Dropout/no exit assessment: ITT holds at baseline => zero uplift
        upliftSumItt += 0;
      }
    }

    return {
      domain,
      baselineAvg: baselineN > 0 ? baselineSum / baselineN : null,
      exitAvgCompleters: exitNCompleters > 0 ? exitSumCompleters / exitNCompleters : null,
      exitAvgItt: null, // not generally meaningful; we report uplift directly
      upliftCompleters: exitNCompleters > 0 ? upliftSumCompleters / exitNCompleters : null,
      upliftItt: starterSet.size > 0 ? upliftSumItt / starterSet.size : null,
      completersN: exitNCompleters,
      starterN: starterSet.size,
    };
  });
}

export interface CohortFunnel {
  applicants: number;
  enrolled: number;
  starters: number;
  completers: number;
  placedWithPartner: number;
  placedElsewhere: number;
  intoEducation: number;
  healthOrPersonal: number;
  disengaged: number;
  followable: number;
  otherExits: number;
  stillInProgramme: number;
}

/**
 * Build the cohort completion funnel from candidate exit_reason values.
 * 'starters' is the count of cohort_candidates rows; everything else is
 * derived from the candidates' exit_reason and status fields.
 */
export function computeFunnel(
  cohortCandidates: { exit_reason: string | null; status: string }[],
): Omit<CohortFunnel, 'applicants' | 'enrolled'> {
  const f = {
    starters: cohortCandidates.length,
    completers: 0,
    placedWithPartner: 0,
    placedElsewhere: 0,
    intoEducation: 0,
    healthOrPersonal: 0,
    disengaged: 0,
    followable: 0,
    otherExits: 0,
    stillInProgramme: 0,
  };
  for (const c of cohortCandidates) {
    switch (c.exit_reason) {
      case 'got_job_with_partner': f.placedWithPartner += 1; f.completers += 1; break;
      case 'got_job_elsewhere':    f.placedElsewhere    += 1; f.completers += 1; break;
      case 'education_training':   f.intoEducation      += 1; f.completers += 1; break;
      case 'health':               f.healthOrPersonal   += 1; break;
      case 'disengaged':           f.disengaged         += 1; break;
      case 'followable':           f.followable         += 1; break;
      case 'other':                f.otherExits         += 1; break;
      default:
        if (c.status === 'completed' || c.status === 'placed' || c.status === 'progressed') {
          f.completers += 1;
        } else if (c.status === 'withdrawn') {
          f.disengaged += 1;
        } else {
          f.stillInProgramme += 1;
        }
    }
  }
  return f;
}
