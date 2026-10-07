/* DEMO SEED CLEANUP — one-off tidy-up of placeholder partner and
   Delphi-expert rows used during development, so demos ship without
   partner-specific example data. This is NOT an action against any
   real partnership; it is tidy-up of demo-only fixtures.

   Run in Supabase SQL Editor. Each statement is idempotent and safe
   to re-run.

   What it does:
   1. Removes placeholder Aston Business School demo partner + contact
   2. Reassigns Burges Salmon demo entry from 'capability_investor' to
      'training_partner' (correct taxonomy)
   3. Replaces Aston-affiliated placeholder Delphi expert rows with
      generic UK academic placeholders
   4. Rewrites evidence pack methodology section to use generic text */

delete from public.partner_contacts
 where partner_id = $bk$11111111-1111-1111-1111-000000000006$bk$::uuid;

delete from public.partners
 where id = $bk$11111111-1111-1111-1111-000000000006$bk$::uuid;

update public.partners
   set type = $bk$training_partner$bk$,
       notes = $bk$ED&I-led; pays ACH to deliver cultural-awareness and inclusion training to legal-team staff. Not a placement buyer.$bk$
 where id = $bk$11111111-1111-1111-1111-000000000001$bk$::uuid;

update public.delphi_experts
   set name  = $bk$Dr Hannah Pearson$bk$,
       email = $bk$h.pearson@bristol.example$bk$
 where id = $bk$99999999-9999-9999-9999-000000000001$bk$::uuid;

update public.delphi_experts
   set name  = $bk$Prof Aidan Walsh$bk$,
       email = $bk$a.walsh@kcl.example$bk$
 where id = $bk$99999999-9999-9999-9999-000000000002$bk$::uuid;

update public.evidence_pack_sections
   set content = $bk$ACH has supported refugee resettlement in Bristol and Birmingham since 2008. The Bridge to Employment programme operationalises ACH's holistic capability framework with named employer partners, delivering measurable employment, education, and progression outcomes for refugee candidates.$bk$
 where pack_id     = $bk$bbbbbbbb-bbbb-bbbb-bbbb-000000000001$bk$::uuid
   and section_key = $bk$organisational_overview$bk$;
