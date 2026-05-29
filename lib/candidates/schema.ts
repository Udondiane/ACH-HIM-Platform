import { z } from 'zod';

export const CANDIDATE_STATUSES = [
  'applicant','enrolled','in_programme','completed','placed','progressed','withdrawn',
] as const;

export const CANDIDATE_STATUS_LABELS: Record<typeof CANDIDATE_STATUSES[number], string> = {
  applicant:    'Applicant',
  enrolled:     'Enrolled',
  in_programme: 'In programme',
  completed:    'Completed programme',
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
  'followable',
  'other',
] as const;

export const EXIT_REASON_LABELS: Record<typeof EXIT_REASONS[number], string> = {
  got_job_with_partner: 'Got job with partner',
  got_job_elsewhere:    'Got job elsewhere',
  education_training:   'Education / further training',
  health:               'Health / personal circumstances',
  disengaged:           'Disengaged',
  followable:           'Followable - can recontact',
  other:                'Other',
};

export const EXIT_REASON_HINTS: Record<typeof EXIT_REASONS[number], string> = {
  got_job_with_partner: 'WIN. Placed with the cohort\'s lead workforce partner.',
  got_job_elsewhere:    'WIN. Got a job through another route - still a programme success.',
  education_training:   'WIN. Moved into further education or vocational training.',
  health:               'Left due to health, caring or other personal circumstances.',
  disengaged:           'Stopped engaging without explanation.',
  followable:           'Lost contact but follow-up possible.',
  other:                'Other reason - capture in exit notes.',
};

export const candidateSchema = z.object({
  candidate_ref:     z.string().trim().max(60).optional().or(z.literal('')),
  given_name:        z.string().trim().min(1, 'Given name required').max(120),
  family_name:       z.string().trim().max(120).optional().or(z.literal('')),
  preferred_locale:  z.enum(LOCALES).default('en'),
  country_of_origin: z.string().trim().max(120).optional().or(z.literal('')),
  arrival_year:      z.coerce.number().int().min(1980).max(2100).optional().or(z.literal('')),
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
});

export type CandidateInput = z.infer<typeof candidateSchema>;
