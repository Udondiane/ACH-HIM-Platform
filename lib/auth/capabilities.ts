import type { AchTeamRole } from '@/lib/supabase/types';
import type { SessionUser } from '@/lib/supabase/auth';

/**
 * Human-readable labels for the eight ACH team roles.
 * Used in the admin UI, the sidebar, and any "signed in as" surface.
 */
export const TEAM_ROLE_LABELS: Record<AchTeamRole, string> = {
  employability_coach: 'Employability coach',
  trainer: 'Trainer',
  support_worker: 'Support worker',
  programme_lead: 'Programme lead',
  bid_business_dev: 'Bid & business development',
  board: 'Board / senior leadership',
  finance_contracts: 'Finance & contracts',
  ict_admin: 'ICT administrator',
};

export const TEAM_ROLE_DESCRIPTIONS: Record<AchTeamRole, string> = {
  employability_coach: 'Manage own caseload; view others in the programme.',
  trainer: 'Run training programmes and sessions across ACH.',
  support_worker: 'Manage own caseload; view others in the programme.',
  programme_lead: 'Oversee coaches, trainers and support workers; manage partners.',
  bid_business_dev: 'Impact library, pricing (read), bids and tenders.',
  board: 'Read-only strategic dashboards and cohort reports.',
  finance_contracts: 'Pricing, development fund, TOMs claims, contracts.',
  ict_admin: 'User management, audit log, platform administration.',
};

export const ALL_TEAM_ROLES: AchTeamRole[] = [
  'employability_coach',
  'trainer',
  'support_worker',
  'programme_lead',
  'bid_business_dev',
  'board',
  'finance_contracts',
  'ict_admin',
];

// ------------------------------------------------------------
// Capability checks
// ------------------------------------------------------------
//
// A user with a NULL team_role is treated as full-access ach_staff.
// This preserves the pilot behaviour — every existing user continues
// to see everything until ICT explicitly assigns them a team role.
//
// Partners and candidates are handled by the top-level `role` field
// and route-group middleware; the capability functions below focus
// on distinguishing sub-roles inside ach_staff.
// ------------------------------------------------------------

function isStaff(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'ach_staff';
}

function teamRole(user: SessionUser): AchTeamRole | null {
  return user.teamRole ?? null;
}

/** Full-access fallback for legacy staff users without a team_role. */
function isUnrestrictedStaff(user: SessionUser): boolean {
  return isStaff(user) && teamRole(user) === null;
}

/** ACH ICT Administrator surfaces — user management, audit log. */
export function canManageUsers(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  return teamRole(user) === 'ict_admin';
}

/** View the ACH-wide dashboard (impact overview). */
export function canViewDashboard(user: SessionUser): boolean {
  return isStaff(user);
}

/** Add / edit beneficiary records. */
export function canWriteBeneficiaries(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  return t === 'employability_coach'
      || t === 'support_worker'
      || t === 'programme_lead';
}

/** Read individual beneficiary detail (case files, assessments, voice). */
export function canReadIndividualBeneficiary(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  // Board and Bid/BD deliberately excluded: they see aggregate only,
  // with individual case-studies shared through curated PDF exports.
  return t === 'employability_coach'
      || t === 'trainer'
      || t === 'support_worker'
      || t === 'programme_lead'
      || t === 'finance_contracts';
}

/** Run assessments (create / edit / capture voice). */
export function canRunAssessments(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  return t === 'employability_coach'
      || t === 'support_worker'
      || t === 'programme_lead';
}

/** Manage training programmes, sessions, attendance, certificates. */
export function canManageTraining(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  return t === 'trainer' || t === 'programme_lead';
}

/** Manage partner records and partner access tokens. */
export function canManagePartners(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  return t === 'programme_lead' || t === 'bid_business_dev';
}

/** Use the pricing tool (create / edit quotes). */
export function canWritePricing(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  return t === 'finance_contracts' || t === 'programme_lead';
}

/** View the pricing tool (read only, for bid context). */
export function canReadPricing(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  return t === 'finance_contracts'
      || t === 'programme_lead'
      || t === 'bid_business_dev'
      || t === 'board';
}

/** Development fund ledger. */
export function canManageDevFund(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  return t === 'finance_contracts' || t === 'programme_lead';
}

/** Bids and tender records. */
export function canManageBids(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  return t === 'bid_business_dev' || t === 'programme_lead';
}

/** Impact library curation and featured quotes. */
export function canManageImpactLibrary(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  const t = teamRole(user);
  return t === 'programme_lead' || t === 'bid_business_dev';
}

/** View the impact library and featured quotes (read). */
export function canReadImpactLibrary(user: SessionUser): boolean {
  return isStaff(user);
}

/** Sign-off / lock authority on assessments (currently unused at ACH). */
export function canSignOffAssessment(user: SessionUser): boolean {
  if (!isStaff(user)) return false;
  if (isUnrestrictedStaff(user)) return true;
  return teamRole(user) === 'programme_lead';
}
