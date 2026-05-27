import { z } from 'zod';

export const PROJECT_TYPES = ['depth', 'hybrid', 'breadth'] as const;
export const PROJECT_TYPE_LABELS: Record<typeof PROJECT_TYPES[number], string> = {
  depth: 'Depth-oriented',
  hybrid: 'Hybrid',
  breadth: 'Breadth-oriented',
};

export const WEIGHT_RATIOS = [
  'd1_1', 'd2_1', 'd3_1', 'd4_1', 'd5_1',
  'b2_1', 'b3_1', 'b4_1',
] as const;

export const WEIGHT_RATIO_LABELS: Record<typeof WEIGHT_RATIOS[number], string> = {
  d1_1: 'Equal (1:1) — α 0.50 / β 0.50',
  d2_1: 'Depth 2:1 — α 0.67 / β 0.33',
  d3_1: 'Depth 3:1 — α 0.75 / β 0.25 (exemplar)',
  d4_1: 'Depth 4:1 — α 0.80 / β 0.20',
  d5_1: 'Depth 5:1 — α 0.83 / β 0.17',
  b2_1: 'Breadth 2:1 — α 0.33 / β 0.67',
  b3_1: 'Breadth 3:1 — α 0.25 / β 0.75 (exemplar)',
  b4_1: 'Breadth 4:1 — α 0.20 / β 0.80',
};

export const HYBRID_OPTIONS = ['A', 'B'] as const;
export const HYBRID_OPTION_LABELS: Record<typeof HYBRID_OPTIONS[number], string> = {
  A: 'Option A — fixed equal weights (V1 default)',
  B: 'Option B — interpolated from classification (V2)',
};

export const OPTIONAL_SCHEMES = ['simple_average', 'coverage_weighted'] as const;
export const OPTIONAL_SCHEME_LABELS: Record<typeof OPTIONAL_SCHEMES[number], string> = {
  simple_average: 'Simple average (V1)',
  coverage_weighted: 'Coverage-weighted (V2)',
};

export const FUNDING_MODELS = ['funded', 'hybrid', 'commercial'] as const;
export type FundingModel = typeof FUNDING_MODELS[number];
export const FUNDING_MODEL_LABELS: Record<FundingModel, string> = {
  funded:     'Funded',
  hybrid:     'Hybrid',
  commercial: 'Commercial',
};
export const FUNDING_MODEL_HINTS: Record<FundingModel, string> = {
  funded:     'Restricted funding from a trust, foundation, or statutory body covers delivery.',
  hybrid:     'Combines grant funding with buyer fees.',
  commercial: 'Buyer pays at or near full cost recovery. Project sustains itself and may generate surplus that supports other work.',
};

export const CAP_DOMAINS = ['employment', 'housing', 'education', 'health', 'belonging', 'social', 'rights'] as const;
export type CapDomain = typeof CAP_DOMAINS[number];
export const CAP_DOMAIN_LABELS: Record<CapDomain, string> = {
  employment: 'Employment',
  housing:    'Housing',
  education:  'Education & skills',
  health:     'Health & wellbeing',
  belonging:  'Belonging & identity',
  social:     'Social participation',
  rights:     'Rights & citizenship',
};
export const CAP_DOMAIN_HINTS: Record<CapDomain, string> = {
  employment: 'Access to and progression in paid work.',
  housing:    'Securing and maintaining stable housing.',
  education:  'Skills, qualifications, English language, vocational training.',
  health:     'Mental and physical health, resilience, access to care.',
  belonging:  'Settlement, cultural connection, dignity in the community.',
  social:     'Networks, friendships, civic and community participation.',
  rights:     'Knowledge and exercise of rights, citizenship pathway.',
};

export const CAP_ANSWERS = ['not_addressed', 'supporting', 'primary'] as const;
export type CapAnswer = typeof CAP_ANSWERS[number];
export const CAP_ANSWER_LABELS: Record<CapAnswer, string> = {
  not_addressed: 'Not addressed',
  supporting:    'Supporting outcome',
  primary:       'Primary focus',
};

const capAnswerSchema = z.enum(CAP_ANSWERS).optional().or(z.literal(''));

const dateOrEmpty = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal(''));

export const projectSchema = z.object({
  project_ref: z.string().trim().max(60).optional().or(z.literal('')),
  name: z.string().trim().min(1, 'Name required').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  funding_model: z.enum(FUNDING_MODELS).optional().or(z.literal('')),
  funder_name: z.string().trim().max(200).optional().or(z.literal('')),
  type: z.enum(PROJECT_TYPES),
  weight_ratio: z.enum(WEIGHT_RATIOS),
  hybrid_option: z.enum(HYBRID_OPTIONS).optional().or(z.literal('')),
  stability_blend: z.coerce.number().min(0).max(1).default(0),
  optional_scheme: z.enum(OPTIONAL_SCHEMES).default('simple_average'),
  classification_q1: z.enum(['A','B','C']).optional().or(z.literal('')),
  classification_q2: z.enum(['A','B','C']).optional().or(z.literal('')),
  classification_q3: z.enum(['A','B','C']).optional().or(z.literal('')),
  classification_q4: z.enum(['A','B','C']).optional().or(z.literal('')),
  cap_employment: capAnswerSchema,
  cap_housing:    capAnswerSchema,
  cap_education:  capAnswerSchema,
  cap_health:     capAnswerSchema,
  cap_belonging:  capAnswerSchema,
  cap_social:     capAnswerSchema,
  cap_rights:     capAnswerSchema,
  start_date: dateOrEmpty,
  end_date: dateOrEmpty,
  status: z.string().default('active'),
});

export function deriveCapabilitiesFromAnswers(answers: Partial<Record<CapDomain, CapAnswer | ''>>): {
  domain: CapDomain;
  role: 'core' | 'optional';
}[] {
  const out: { domain: CapDomain; role: 'core' | 'optional' }[] = [];
  for (const d of CAP_DOMAINS) {
    const ans = answers[d];
    if (ans === 'primary') out.push({ domain: d, role: 'core' });
    else if (ans === 'supporting') out.push({ domain: d, role: 'optional' });
  }
  return out;
}

/**
 * Derive the project type and weight ratio from how many capability domains
 * the user marked as Core vs Optional. Keeps the methodology compliant
 * (depth-oriented when the project has a clear single/dual focus, hybrid
 * when it spreads across many areas) while removing the cognitive burden
 * of picking these directly.
 */
export function deriveTypeAndWeight(coreCount: number, optionalCount: number): {
  type: typeof PROJECT_TYPES[number];
  weight_ratio: typeof WEIGHT_RATIOS[number];
} {
  if (coreCount === 0 && optionalCount === 0) {
    return { type: 'depth', weight_ratio: 'd3_1' };
  }
  if (coreCount === 0) {
    // No primary focus picked, only supporting. Project is broad by definition.
    return { type: 'breadth', weight_ratio: optionalCount >= 3 ? 'b3_1' : 'b2_1' };
  }
  if (coreCount === 1) {
    if (optionalCount === 0)      return { type: 'depth',  weight_ratio: 'd5_1' };
    if (optionalCount <= 2)       return { type: 'depth',  weight_ratio: 'd3_1' };
    /* 3+ */                       return { type: 'depth',  weight_ratio: 'd2_1' };
  }
  if (coreCount === 2) {
    if (optionalCount === 0)      return { type: 'depth',  weight_ratio: 'd4_1' };
    if (optionalCount <= 2)       return { type: 'depth',  weight_ratio: 'd3_1' };
    /* 3 */                        return { type: 'hybrid', weight_ratio: 'd2_1' };
  }
  // coreCount === 3
  if (optionalCount === 0)        return { type: 'depth',  weight_ratio: 'd3_1' };
  if (optionalCount === 1)        return { type: 'depth',  weight_ratio: 'd2_1' };
  /* 2 */                          return { type: 'hybrid', weight_ratio: 'd1_1' };
}

export const FUNDING_QUESTION_LABELS: Record<FundingModel | 'unset', { core: string; optional: string; coreHint: string; optionalHint: string }> = {
  funded: {
    core:        'What outcomes did the funder commission this project to achieve?',
    coreHint:    'Pick 1–3. These are the outcomes the funder expects the project to deliver and report on.',
    optional:    'What broader social value does the project also create?',
    optionalHint:'Pick any additional impacts that strengthen the funder narrative without being the headline ask.',
  },
  hybrid: {
    core:        'What outcomes do you commit to demonstrating to the buyer and the funder?',
    coreHint:    'Pick 1–3. These are the outcomes you stand behind in both commercial and grant reporting.',
    optional:    'What additional impacts strengthen the case for sustained investment?',
    optionalHint:'Pick any further outcomes the project also touches — useful for moving fully commercial later.',
  },
  commercial: {
    core:        'What outcomes does the buyer specifically pay for?',
    coreHint:    'Pick 1–3. The outcomes the buyer expects to see in their reporting line.',
    optional:    'What additional value does the project deliver beyond the buyer ask?',
    optionalHint:'Pick any further impacts — useful for ED&I, social value, or wider ESG narratives.',
  },
  unset: {
    core:        'What outcomes is this project designed to achieve?',
    coreHint:    'Pick 1–3 capability areas that the project actively works to improve.',
    optional:    'What other impacts might the project generate?',
    optionalHint:'Pick any further capability areas the project touches, even if they are not the headline outcome.',
  },
};

export const CLASSIFICATION_QUESTIONS = [
  {
    key: 'classification_q1',
    label: 'Primary objective',
    options: {
      A: 'Deep, lasting change in a specific capability',
      C: 'Mix of focused and broad development',
      B: 'Improvement across several life areas',
    },
  },
  {
    key: 'classification_q2',
    label: 'Participation intensity',
    options: {
      A: 'Intensive — multiple sessions per week',
      C: 'Moderate — weekly or biweekly',
      B: 'Light-touch — occasional engagement',
    },
  },
  {
    key: 'classification_q3',
    label: 'Service delivery',
    options: {
      A: 'Single, specialised intervention',
      C: 'Coordinated set of interventions',
      B: 'Many parallel touchpoints across domains',
    },
  },
  {
    key: 'classification_q4',
    label: 'Expected change pattern',
    options: {
      A: 'Large change in one capability area',
      C: 'Moderate change across a few capabilities',
      B: 'Small improvements across many capabilities',
    },
  },
] as const;

export type ProjectInput = z.infer<typeof projectSchema>;
