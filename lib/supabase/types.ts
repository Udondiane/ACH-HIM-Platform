// Database type for Supabase client.
// This file is regenerated in session 2 from the actual migrations.
// For now it carries just the auth-essential `user_roles` table.

export type UserRole = 'ach_staff' | 'partner' | 'candidate';

export type Database = {
  public: {
    Tables: {
      user_roles: {
        Row: {
          user_id: string;
          role: UserRole;
          partner_id: string | null;
          candidate_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: UserRole;
          partner_id?: string | null;
          candidate_id?: string | null;
        };
        Update: Partial<{
          role: UserRole;
          partner_id: string | null;
          candidate_id: string | null;
        }>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
  };
};
