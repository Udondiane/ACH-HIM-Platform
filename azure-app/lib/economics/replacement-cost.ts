/**
 * Replacement-cost methodology, HIM Methodology Specification §9.1.
 *
 * Salary-band → percentage of annual salary used as the replacement-cost
 * estimate when a candidate is retained beyond the sector benchmark. Sources:
 * Oxford Economics (2014); CIPD Absence & Turnover research.
 *
 * The percentages are conservative: applied only against placements retained
 * for 12+ months AND only for the count that exceeds the industry-expected
 * 12-month retention rate.
 *
 * This lives in `lib/` (not inside a React component) so any surface that
 * needs to reason about £-per-retained-placement — dashboards, exports, PDF
 * reports, funder summaries — reads the same numbers. Update here, once.
 *
 * The audit flagged four overlapping monetisation tables in the wider
 * system (sroi_proxies, equivalence_values, toms_codes+crosswalk, and this
 * map). Consolidating those is a product decision; this file at least
 * removes the "hardcoded in a React file" tail.
 */
export const REPLACEMENT_COST_PCT: Record<string, number> = {
  volume:   0.16, // Entry level (<£25k) — 16%
  standard: 0.50, // Mid-range (£25–35k) — 50%
  premium:  0.75, // Senior (£35–50k) — 75%
};

export const SALARY_BAND_LABELS: Record<string, string> = {
  volume:   'Entry (<£25k)',
  standard: 'Mid-range (£25–35k)',
  premium:  'Senior (£35–50k)',
};

/**
 * Industry-expected 12-month retention rate (sector benchmark, indicative).
 * We only claim replacement-cost savings on placements that BEAT this rate,
 * so the same-benchmark-would-have-happened-anyway share is excluded.
 */
export const SECTOR_BENCHMARK_12MO = 0.68;

/**
 * Compute the replacement-cost saving for a single placement, given its
 * salary band and actual salary. Returns 0 if the band isn't recognised
 * or the salary is missing.
 */
export function replacementCostSaving(salaryBand: string | null | undefined, salaryActual: number | null | undefined): number {
  if (!salaryBand || salaryActual == null) return 0;
  const pct = REPLACEMENT_COST_PCT[salaryBand] ?? 0;
  return Number(salaryActual) * pct;
}
