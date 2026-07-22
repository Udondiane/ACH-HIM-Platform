export const SECTION_KEYS = [
  'organisational_overview',
  'programme_overview',
  'current_scale_reach',
  'outcomes_evidence',
  'partner_case_studies',
  'candidate_stories',
  'methodology_academic_grounding',
  'distinctiveness_innovation',
  'theory_of_change',
  'financial_operational',
  'funder_citation_blocks',
  'evidence_references',
  'visual_material',
  'ach_attestation',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  organisational_overview: 'Organisational overview',
  programme_overview: 'Programme overview',
  current_scale_reach: 'Current scale & reach',
  outcomes_evidence: 'Outcomes evidence',
  partner_case_studies: 'Partner case studies',
  candidate_stories: 'Candidate stories',
  methodology_academic_grounding: 'Methodology & academic grounding',
  distinctiveness_innovation: 'Distinctiveness & innovation',
  theory_of_change: 'Theory of change',
  financial_operational: 'Financial & operational',
  funder_citation_blocks: 'Funder citation blocks',
  evidence_references: 'Evidence references',
  visual_material: 'Visual material',
  ach_attestation: 'ACH attestation',
};

export const SECTION_GROUPS: { title: string; keys: SectionKey[] }[] = [
  { title: 'Programme', keys: ['organisational_overview', 'programme_overview', 'current_scale_reach'] },
  { title: 'Evidence', keys: ['outcomes_evidence', 'partner_case_studies', 'candidate_stories', 'evidence_references'] },
  { title: 'Method', keys: ['methodology_academic_grounding', 'distinctiveness_innovation', 'theory_of_change'] },
  { title: 'Operations', keys: ['financial_operational', 'funder_citation_blocks', 'visual_material', 'ach_attestation'] },
];
