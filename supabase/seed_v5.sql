update public.projects set
  funding_model = $bk$hybrid$bk$,
  funder_name   = $bk$Comic Relief$bk$,
  capability_questionnaire = $bk${"employment":"primary","housing":"supporting","education":"primary","health":"supporting","belonging":"supporting","social":"supporting","rights":"supporting"}$bk$::jsonb
 where id = $bk$44444444-4444-4444-4444-000000000001$bk$::uuid;

update public.projects set
  funding_model = $bk$commercial$bk$,
  funder_name   = null,
  capability_questionnaire = $bk${"employment":"not_addressed","housing":"not_addressed","education":"supporting","health":"supporting","belonging":"primary","social":"primary","rights":"supporting"}$bk$::jsonb
 where id = $bk$44444444-4444-4444-4444-000000000002$bk$::uuid;

update public.projects set
  funding_model = $bk$funded$bk$,
  funder_name   = $bk$Bristol City Council Refugee Reception Service$bk$,
  capability_questionnaire = $bk${"employment":"supporting","housing":"primary","education":"supporting","health":"supporting","belonging":"primary","social":"supporting","rights":"primary"}$bk$::jsonb
 where id = $bk$44444444-4444-4444-4444-000000000003$bk$::uuid;

update public.projects set
  funding_model = $bk$commercial$bk$,
  funder_name   = null,
  capability_questionnaire = $bk${"employment":"not_addressed","housing":"not_addressed","education":"supporting","health":"not_addressed","belonging":"primary","social":"primary","rights":"not_addressed"}$bk$::jsonb
 where id = $bk$44444444-4444-4444-4444-000000000004$bk$::uuid;

delete from public.project_capabilities where project_id in (
  $bk$44444444-4444-4444-4444-000000000001$bk$::uuid,
  $bk$44444444-4444-4444-4444-000000000002$bk$::uuid,
  $bk$44444444-4444-4444-4444-000000000003$bk$::uuid,
  $bk$44444444-4444-4444-4444-000000000004$bk$::uuid
);

insert into public.project_capabilities (project_id, domain, role) values
  ($bk$44444444-4444-4444-4444-000000000001$bk$::uuid, $bk$employment$bk$, $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000001$bk$::uuid, $bk$education$bk$,  $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000001$bk$::uuid, $bk$housing$bk$,    $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000001$bk$::uuid, $bk$health$bk$,     $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000001$bk$::uuid, $bk$belonging$bk$,  $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000001$bk$::uuid, $bk$social$bk$,     $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000001$bk$::uuid, $bk$rights$bk$,     $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000002$bk$::uuid, $bk$belonging$bk$,  $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000002$bk$::uuid, $bk$social$bk$,     $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000002$bk$::uuid, $bk$education$bk$,  $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000002$bk$::uuid, $bk$health$bk$,     $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000002$bk$::uuid, $bk$rights$bk$,     $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$housing$bk$,    $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$belonging$bk$,  $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$rights$bk$,     $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$employment$bk$, $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$education$bk$,  $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$health$bk$,     $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$social$bk$,     $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000004$bk$::uuid, $bk$belonging$bk$,  $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000004$bk$::uuid, $bk$social$bk$,     $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000004$bk$::uuid, $bk$education$bk$,  $bk$optional$bk$)
on conflict do nothing;
