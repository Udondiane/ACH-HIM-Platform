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

const dateOrEmpty = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal(''));

export const projectSchema = z.object({
  project_ref: z.string().trim().min(1, 'Reference required').max(60),
  name: z.string().trim().min(1, 'Name required').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  type: z.enum(PROJECT_TYPES),
  weight_ratio: z.enum(WEIGHT_RATIOS),
  hybrid_option: z.enum(HYBRID_OPTIONS).optional().or(z.literal('')),
  stability_blend: z.coerce.number().min(0).max(1).default(0),
  optional_scheme: z.enum(OPTIONAL_SCHEMES).default('simple_average'),
  classification_q1: z.enum(['A','B','C']).optional().or(z.literal('')),
  classification_q2: z.enum(['A','B','C']).optional().or(z.literal('')),
  classification_q3: z.enum(['A','B','C']).optional().or(z.literal('')),
  classification_q4: z.enum(['A','B','C']).optional().or(z.literal('')),
  start_date: dateOrEmpty,
  end_date: dateOrEmpty,
  status: z.string().default('active'),
});

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
