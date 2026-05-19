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

export const candidateSchema = z.object({
  candidate_ref:     z.string().trim().min(1, 'Reference required').max(60),
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
});

export type CandidateInput = z.infer<typeof candidateSchema>;
