/* Evidence attachments for assessments + supabase storage bucket setup.

   The bucket is private (not public). Reads go through signed URLs
   generated server-side from createSignedUrl(). RLS on the bucket
   restricts access to ACH staff; partners never see raw files. */

create table if not exists public.assessment_attachments (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  mime_type       text,
  size_bytes      integer,
  uploaded_by     uuid references auth.users(id),
  uploaded_at     timestamptz not null default now()
);

create index if not exists idx_attachments_assessment
  on public.assessment_attachments(assessment_id);

alter table public.assessment_attachments enable row level security;

drop policy if exists "attachments_ach_all" on public.assessment_attachments;
create policy "attachments_ach_all" on public.assessment_attachments
  for all using (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  ) with check (
    (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  );

/* Create the storage bucket. Public=false; signed URLs only. */
insert into storage.buckets (id, name, public)
values ('assessment-evidence', 'assessment-evidence', false)
on conflict (id) do nothing;

/* Bucket policies: only ACH staff can read/write/delete. Service role
   bypasses RLS, so the server-side upload route works without needing
   a separate policy. */
drop policy if exists "Allow ACH staff read assessment-evidence" on storage.objects;
create policy "Allow ACH staff read assessment-evidence" on storage.objects
  for select using (
    bucket_id = 'assessment-evidence'
    and (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  );

drop policy if exists "Allow ACH staff write assessment-evidence" on storage.objects;
create policy "Allow ACH staff write assessment-evidence" on storage.objects
  for insert with check (
    bucket_id = 'assessment-evidence'
    and (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  );

drop policy if exists "Allow ACH staff delete assessment-evidence" on storage.objects;
create policy "Allow ACH staff delete assessment-evidence" on storage.objects
  for delete using (
    bucket_id = 'assessment-evidence'
    and (select 1 from public.user_roles where user_id = auth.uid() and role = 'ach_staff') is not null
  );
