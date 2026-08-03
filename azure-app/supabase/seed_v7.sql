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
