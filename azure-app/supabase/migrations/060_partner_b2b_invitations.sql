-- Partner B2B invitations (Microsoft Entra external identity model)
--
-- Replaces the legacy magic-URL token model with proper per-person
-- accounts. Each partner staff member is invited as an Entra B2B guest
-- (Microsoft account) OR via Entra External ID email OTP (for partners
-- without Microsoft). On first sign-in we map their Entra `oid` to the
-- partner they belong to via `partner_users`.

create table if not exists partner_invitations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  invited_email text not null,
  invited_display_name text,
  role text not null default 'partner-viewer'
    check (role in ('partner-admin', 'partner-viewer')),
  -- Which identity provider the invitation was raised through.
  provider text not null default 'entra-b2b'
    check (provider in ('entra-b2b', 'entra-external-id-otp', 'legacy-token')),
  -- Microsoft Graph invitation id (returned by POST /v1.0/invitations)
  graph_invitation_id text,
  -- The redeem URL emailed to the invitee. Stored for support ("resend link")
  redeem_url text,
  status text not null default 'pending'
    check (status in ('pending', 'redeemed', 'revoked', 'failed')),
  invited_by uuid,  -- references auth user oid (Entra)
  invited_at timestamptz not null default now(),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  last_error text,
  unique (partner_id, invited_email)
);

create index if not exists idx_partner_invitations_partner
  on partner_invitations(partner_id);
create index if not exists idx_partner_invitations_email_lower
  on partner_invitations(lower(invited_email));

-- Live mapping: which Entra user IDs belong to which partner.
-- Populated on first successful sign-in of an invited user.
create table if not exists partner_users (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  entra_oid text not null unique,
  email text not null,
  display_name text,
  role text not null default 'partner-viewer'
    check (role in ('partner-admin', 'partner-viewer')),
  invitation_id uuid references partner_invitations(id) on delete set null,
  first_signed_in_at timestamptz not null default now(),
  last_signed_in_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index if not exists idx_partner_users_partner
  on partner_users(partner_id);
create index if not exists idx_partner_users_email_lower
  on partner_users(lower(email));

-- Helper: resolve the partner_id for the currently-signed-in Entra user.
-- The app calls this by setting the session variable app.current_entra_oid
-- from the request context (see lib/azure/db-context.ts).
create or replace function current_partner_id_from_entra() returns uuid
language sql stable as $$
  select partner_id from partner_users
  where entra_oid = current_setting('app.current_entra_oid', true)
    and disabled_at is null
  limit 1;
$$;
