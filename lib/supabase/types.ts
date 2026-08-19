// Database type for Supabase client.
// Kept intentionally narrow — only the auth-relevant tables are typed
// here. All other queries use runtime casts because the framework
// evolves through migrations faster than the generated type would.

export type UserRole = 'ach_staff' | 'partner' | 'candidate';

/**
 * Sub-role within ach_staff. Determines which UI surfaces the user
 * sees and which server actions they can invoke. Nullable — a null
 * team_role on an ach_staff row is treated as full-access (backward
 * compatibility for the pilot).
 *
 * See migration 061 for the canonical definition.
 */
export type AchTeamRole =
  | 'employability_coach'
  | 'trainer'
  | 'support_worker'
  | 'programme_lead'
  | 'bid_business_dev'
  | 'board'
  | 'finance_contracts'
  | 'ict_admin';

export type Database = {
  public: {
    Tables: {
      user_roles: {
        Row: {
          user_id: string;
          role: UserRole;
          team_role: AchTeamRole | null;
          partner_id: string | null;
          candidate_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: UserRole;
          team_role?: AchTeamRole | null;
          partner_id?: string | null;
          candidate_id?: string | null;
        };
        Update: Partial<{
          role: UserRole;
          team_role: AchTeamRole | null;
          partner_id: string | null;
          candidate_id: string | null;
        }>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      ach_team_role: AchTeamRole;
    };
  };
};
