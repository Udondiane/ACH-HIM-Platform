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
