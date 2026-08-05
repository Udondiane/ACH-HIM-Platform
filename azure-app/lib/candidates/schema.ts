import { z } from 'zod';

export const CANDIDATE_STATUSES = [
  'applicant','in_programme','placed','progressed','withdrawn',
] as const;

export const CANDIDATE_STATUS_LABELS: Record<typeof CANDIDATE_STATUSES[number], string> = {
  applicant:    'Applicant',
  in_programme: 'In programme',
  placed:       'Placed',
  progressed:   'Progressed',
  withdrawn:    'Withdrawn',
};

export const LOCALES = ['en','ar','fr','es','uk','fa','ps','ti','so','ckb','sq'] as const;
export const LOCALE_NAMES: Record<typeof LOCALES[number], string> = {
  en: 'English', ar: 'العربية', fr: 'Français', es: 'Español', uk: 'Українська',
  fa: 'فارسی', ps: 'پښتو', ti: 'ትግርኛ', so: 'Soomaali', ckb: 'کوردیی ناوەندی', sq: 'Shqip',
};

export const EXIT_REASONS = [
  'got_job_with_partner',
  'got_job_elsewhere',
  'education_training',
  'health',
  'disengaged',
  'other',
] as const;

export const EXIT_REASON_LABELS: Record<typeof EXIT_REASONS[number], string> = {
  got_job_with_partner: 'Got job with partner',
  got_job_elsewhere:    'Got job elsewhere',
  education_training:   'Education / further training',
  health:               'Health / personal circumstances',
  disengaged:           'Disengaged',
  other:                'Other',
};

export const EXIT_REASON_HINTS: Record<typeof EXIT_REASONS[number], string> = {
  got_job_with_partner: 'WIN. Placed with the cohort\'s lead workforce partner.',
  got_job_elsewhere:    'WIN. Got a job through another route - still a programme success.',
  education_training:   'WIN. Moved into further education or vocational training.',
  health:               'Left due to health, caring or other personal circumstances.',
  disengaged:           'Stopped engaging without explanation.',
  other:                'Other reason - capture in exit notes.',
};

export const PROGRESSION_TYPES = [
  'promotion',
  'second_job',
  'higher_role_elsewhere',
  'further_study',
  'self_employment',
  'other',
] as const;

export const PROGRESSION_TYPE_LABELS: Record<typeof PROGRESSION_TYPES[number], string> = {
  promotion:             'Promoted in same role / employer',
  second_job:            'Took on a second job',
  higher_role_elsewhere: 'Moved to a higher role at a different employer',
  further_study:         'Continued into further study while working',
  self_employment:       'Started own business / self-employment',
  other:                 'Other (describe)',
};

export const candidateSchema = z.object({
  candidate_ref:     z.string().trim().max(60).optional().or(z.literal('')),
  given_name:        z.string().trim().min(1, 'Given name required').max(120),
  family_name:       z.string().trim().min(1, 'Family name required').max(120),
  preferred_locale:  z.enum(LOCALES).default('en'),
  country_of_origin: z.string().trim().min(1, 'Country of origin required').max(120),
  arrival_year:      z.coerce.number().int().min(1980).max(2100),
  english_level:     z.string().trim().max(20).optional().or(z.literal('')),
  status:            z.enum(CANDIDATE_STATUSES).default('applicant'),
  career_goal_summary: z.string().trim().max(2000).optional().or(z.literal('')),
  development_plan:    z.string().trim().max(4000).optional().or(z.literal('')),
  notes:             z.string().trim().max(4000).optional().or(z.literal('')),
  is_ach_tenant:     z.preprocess(v => v === 'on' || v === true || v === 'true', z.boolean()).default(false),
  at_risk:           z.preprocess(v => v === 'on' || v === true || v === 'true', z.boolean()).default(false),
  at_risk_reason:    z.string().trim().max(500).optional().or(z.literal('')),
  exit_reason:       z.enum(EXIT_REASONS).optional().or(z.literal('')),
  exit_date:         z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().or(z.literal('')),
  exit_notes:        z.string().trim().max(2000).optional().or(z.literal('')),
  progression_type:  z.enum(PROGRESSION_TYPES).optional().or(z.literal('')),
  progression_notes: z.string().trim().max(2000).optional().or(z.literal('')),
}).superRefine((val, ctx) => {
  if (val.status === 'progressed' && !val.progression_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['progression_type'],
      message: 'Please describe how the candidate progressed.',
    });
  }
  if (val.progression_type === 'other' && !val.progression_notes?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['progression_notes'],
      message: 'Required when progression type is Other.',
    });
  }
});

export type CandidateInput = z.infer<typeof candidateSchema>;
