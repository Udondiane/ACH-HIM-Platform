update public.projects set
  funding_model = $bk$hybrid$bk$,
  funder_name   = $bk$Comic Relief (transitioning out Oct 2026)$bk$,
  capability_questionnaire = $bk${"employment":"primary","education":"primary","belonging":"supporting","social":"supporting","health":"supporting"}$bk$::jsonb
 where id = $bk$44444444-4444-4444-4444-000000000001$bk$::uuid;

update public.projects set
  funding_model = $bk$commercial$bk$,
  funder_name   = null,
  capability_questionnaire = $bk${"employment":"not_addressed","education":"supporting","belonging":"primary","social":"primary","health":"supporting"}$bk$::jsonb
 where id = $bk$44444444-4444-4444-4444-000000000002$bk$::uuid;

update public.projects set
  funding_model = $bk$funded$bk$,
  funder_name   = $bk$Bristol City Council Refugee Reception Service$bk$,
  capability_questionnaire = $bk${"employment":"supporting","education":"supporting","belonging":"primary","social":"primary","health":"supporting"}$bk$::jsonb
 where id = $bk$44444444-4444-4444-4444-000000000003$bk$::uuid;

update public.projects set
  funding_model = $bk$commercial$bk$,
  funder_name   = null,
  capability_questionnaire = $bk${"employment":"not_addressed","education":"supporting","belonging":"primary","social":"primary","health":"not_addressed"}$bk$::jsonb
 where id = $bk$44444444-4444-4444-4444-000000000004$bk$::uuid;
