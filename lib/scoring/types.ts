/**
 * Scoring library — shared types.
 * Every type traces back to a section of the HIM spec.
 */

export type DomainId =
  | 'employment' | 'housing' | 'education'
  | 'health' | 'belonging' | 'social' | 'rights';

export const ALL_DOMAINS: DomainId[] = [
  'employment','housing','education','health','belonging','social','rights',
];

export type ConversionFactorType = 'personal' | 'social' | 'environmental';

export type CapabilityRole = 'core' | 'optional';

export type ProjectType = 'depth' | 'hybrid' | 'breadth';

/**
 * Weight ratio identifiers map directly to spec §3.3 / §3.4 tables.
 * Asymmetry preserved: depth permits 5:1, breadth only 4:1 (spec §3.4 note).
 */
export type WeightRatio =
  | 'd1_1' | 'd2_1' | 'd3_1' | 'd4_1' | 'd5_1'
  | 'b2_1' | 'b3_1' | 'b4_1';

export type HybridOption = 'A' | 'B';

export type OptionalScheme = 'simple_average' | 'coverage_weighted';

export type AssessmentTimepoint =
  | 'baseline' | 'mid_3mo' | 'exit_6mo' | 'followup_12mo';

/** A single indicator response, pre-normalisation. */
export type IndicatorResponse = {
  indicatorId: string;
  factorId: string;
  domainIds: DomainId[];     // multi-domain for universal factors
  conversionFactorType: ConversionFactorType;
  isUniversal: boolean;
  measurementMethod: 'likert_1_5' | 'likert_1_10' | 'yes_no' | 'count' | 'checklist' | 'narrative';
  numericValue: number | null;
  narrative?: string | null;
  checklistItems?: string[];
};

/** A capability (domain) selection on a project, with optional factor narrowing. */
export type ProjectCapability = {
  domain: DomainId;
  role: CapabilityRole;
  /** Empty = use all factors for the domain. */
  selectedFactors: string[];
};

/** Per-timepoint snapshot at the candidate level. */
export type AssessmentSnapshot = {
  candidateId: string;
  timepoint: AssessmentTimepoint;
  responses: IndicatorResponse[];
};

/** Inputs to HIM calculation for a single project / candidate / timepoint. */
export type HimInputs = {
  projectType: ProjectType;
  weightRatio: WeightRatio;
  hybridOption?: HybridOption;          // only relevant when projectType==='hybrid'
  optionalScheme?: OptionalScheme;      // default simple_average (v1)
  stabilityBlend?: number;              // 0–1, v2 blending factor; default 0
  capabilities: ProjectCapability[];
  responses: IndicatorResponse[];       // single-timepoint
  // Optional multi-timepoint trajectory for stability blending (v2)
  trajectory?: AssessmentSnapshot[];
  // Optional inclusion-assessment-derived environmental factors (V2 §12.2)
  inclusionEnvScores?: Partial<Record<DomainId, number>>; // 0–5 per domain
};

export type DomainAggregate = {
  domain: DomainId;
  role: CapabilityRole;
  // mean across the domain's selected factors, scaled 0–5
  domainMean: number;
  // per-factor breakdown for UI tooltips
  factors: Array<{
    factorId: string;
    factorMean: number;
    factorType: ConversionFactorType;
    indicators: Array<{ indicatorId: string; value: number; isNarrativeOnly: boolean }>;
  }>;
};

export type HimResult = {
  projectType: ProjectType;
  weightRatio: WeightRatio;
  alpha: number;        // depth weight
  beta: number;         // breadth weight
  coreScore: number;    // 0–1
  optionalScore: number; // 0–1
  him: number;          // 0–1
  /** Set when stabilityBlend > 0 and trajectory available */
  stabilityScore?: number;
  /** Per-domain breakdown for UI */
  domainBreakdown: DomainAggregate[];
  /** Trace of derivations for audit / debugging */
  trace: {
    coreDomains: DomainId[];
    optionalDomains: DomainId[];
    coreMeans: number[];           // means before /5
    optionalMeans: number[];
    optionalScheme: OptionalScheme;
    notes: string[];
  };
};
