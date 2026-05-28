/* Set up multi-type support on the live database.

   Migration 021 adds the `types` column and a trigger that keeps the
   legacy `type` column in sync with types[1]. This script:

   1. Ensures every existing partner has at least one entry in types[]
      (backfilled from their legacy `type` value)
   2. Adds the second type to Burges Salmon so it appears as both a
      Training Partner and a Capability Investor (the real-world case
      that motivated multi-type support)

   Safe to run multiple times. */

update public.partners
   set types = array[type]
 where type is not null
   and (types is null or array_length(types, 1) is null or array_length(types, 1) = 0);

/* Burges Salmon: training_partner (primary) + capability_investor.
   They commission training for their staff AND have sponsored
   candidate cohorts historically. Both relationships should be
   visible on their partner-portal dashboard. */
update public.partners
   set types = array[$bk$training_partner$bk$, $bk$capability_investor$bk$]::public.partner_type[]
 where id = $bk$11111111-1111-1111-1111-000000000001$bk$::uuid;

/* Confirmation query - shows every partner with their types array */
select id, name, type as legacy_type, types from public.partners order by name;
