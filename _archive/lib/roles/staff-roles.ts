// Staff role definitions for the role-aware dashboard views. The selector
// is a UI affordance for navigation — it does NOT enforce permissions.
// Every authenticated ACH staff user can reach every view; the role pages
// just reshape which work is surfaced first. RBAC arrives in a later
// session via Supabase RLS + a staff_roles table.

import type { LucideIcon } from 'lucide-react';
import {
  Compass,        // adviser
  GraduationCap,  // tutor
  Briefcase,      // employment specialist
  Handshake,      // engagement lead
} from 'lucide-react';

export type StaffRoleId = 'adviser' | 'tutor' | 'specialist' | 'engagement';

export interface StaffRole {
  id: StaffRoleId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Hex tint used on tile + role-page header */
  accent: 'navy' | 'slate' | 'olive' | 'rose';
}

export const STAFF_ROLES: StaffRole[] = [
  {
    id: 'adviser',
    label: 'Careers adviser',
    shortLabel: 'Adviser',
    description: 'IAG sessions, career goals, next actions due.',
    href: '/dashboard/adviser',
    icon: Compass,
    accent: 'navy',
  },
  {
    id: 'tutor',
    label: 'Tutor',
    shortLabel: 'Tutor',
    description: 'Training delivery, attendance rolls, per-cohort training roster.',
    href: '/dashboard/tutor',
    icon: GraduationCap,
    accent: 'slate',
  },
  {
    id: 'specialist',
    label: 'Employment specialist',
    shortLabel: 'Employment',
    description: 'Interview journey, placements, retention check-ins.',
    href: '/dashboard/specialist',
    icon: Briefcase,
    accent: 'olive',
  },
  {
    id: 'engagement',
    label: 'Employer engagement lead',
    shortLabel: 'Engagement',
    description: 'Workforce partners, sponsorships, placements YTD.',
    href: '/dashboard/engagement',
    icon: Handshake,
    accent: 'rose',
  },
];

export function getStaffRole(id: StaffRoleId): StaffRole | undefined {
  return STAFF_ROLES.find(r => r.id === id);
}
