/* Rule-based at-risk computation. First rule: any candidate in
   'enrolled' or 'in_programme' status with no support log entry in
   the last 21 days gets flagged. Designed to be re-run on a schedule
   (Supabase pg_cron, Vercel cron, or manually) without side effects
   beyond updating the flag.

   Manually-set flags whose reason does NOT match the rule's reason
   string are preserved - caseworkers who set "Mental-health concern"
   on a candidate are not stomped on by this job. */

create or replace function public.recompute_at_risk_flags()
returns table(updated_count bigint) language plpgsql as $body$
declare
  cutoff date := current_date - interval '21 days';
  changes bigint := 0;
begin
  /* Flag candidates with no contact in the last 21 days */
  with stale as (
    select c.id from public.candidates c
     where c.status in ('enrolled', 'in_programme')
       and not exists (
         select 1 from public.candidate_support s
          where s.candidate_id = c.id and s.provided_on >= cutoff
       )
  )
  update public.candidates c
     set at_risk = true,
         at_risk_reason = 'No contact > 3 weeks'
   where c.id in (select id from stale)
     and (c.at_risk = false or c.at_risk_reason = 'No contact > 3 weeks' or c.at_risk_reason is null);
  get diagnostics changes = row_count;

  /* Clear the flag if the rule reason no longer applies (recent contact) */
  update public.candidates c
     set at_risk = false,
         at_risk_reason = null
   where c.at_risk = true
     and c.at_risk_reason = 'No contact > 3 weeks'
     and exists (
       select 1 from public.candidate_support s
        where s.candidate_id = c.id and s.provided_on >= cutoff
     );

  return query select changes;
end;
$body$;

comment on function public.recompute_at_risk_flags is
  'Re-evaluates rule-based at-risk flags. Currently: no support contact in 21 days for enrolled/in_programme candidates. Safe to re-run; preserves manually-set flags with custom reasons.';

/* To schedule via Supabase pg_cron (must enable pg_cron extension first):

     create extension if not exists pg_cron;
     select cron.schedule(
       'recompute-at-risk',
       '0 6 * * *',
       'select public.recompute_at_risk_flags()'
     );

   Or trigger from a Vercel cron job hitting /api/cron/recompute-at-risk. */
