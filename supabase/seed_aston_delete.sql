/* Aggressive Aston removal - matches by name to catch any UUID variant.
   Also cleans dependent rows in case Aston had related data added via
   the UI (partner_contacts, audit_entries, inclusion_assessments,
   cohort_partners). Safe to re-run. */

/* Clean up any related rows first to avoid FK constraint errors */
delete from public.partner_contacts
 where partner_id in (
   select id from public.partners where name ilike $bk$%Aston%$bk$
 );

delete from public.audit_entries
 where partner_id in (
   select id from public.partners where name ilike $bk$%Aston%$bk$
 );

delete from public.inclusion_assessments
 where partner_id in (
   select id from public.partners where name ilike $bk$%Aston%$bk$
 );

delete from public.cohort_partners
 where partner_id in (
   select id from public.partners where name ilike $bk$%Aston%$bk$
 );

delete from public.cohort_candidates
 where sponsoring_partner_id in (
   select id from public.partners where name ilike $bk$%Aston%$bk$
 );

delete from public.partners
 where name ilike $bk$%Aston%$bk$;

/* Confirmation query: should return 0 rows if delete worked */
select id, name, type from public.partners where name ilike $bk$%Aston%$bk$;
