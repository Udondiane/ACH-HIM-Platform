insert into public.projects
  (id, project_ref, name, description, type, weight_ratio, hybrid_option, optional_scheme, stability_blend, start_date, status)
values
  (
    $bk$44444444-4444-4444-4444-000000000002$bk$::uuid,
    $bk$PRJ-EDI$bk$,
    $bk$Equality, Diversity & Inclusion Training$bk$,
    $bk$Workplace ED&I capability-building delivered to partner staff. Currently scoped through Burges Salmon under a non-PSL training partnership. Outcomes measured at the participant level - confidence, allyship behaviours, organisational awareness - rather than via cohort intakes.$bk$,
    $bk$breadth$bk$,
    $bk$b3_1$bk$,
    $bk$B$bk$,
    $bk$simple_average$bk$,
    0,
    $bk$2025-01-01$bk$,
    $bk$active$bk$
  ),
  (
    $bk$44444444-4444-4444-4444-000000000003$bk$::uuid,
    $bk$PRJ-IAG$bk$,
    $bk$Refugee Reception Service IAG$bk$,
    $bk$Information, Advice and Guidance for newly-arrived refugees. Delivered individually rather than in cohorts. Captures HIM capability baselines for everyone who engages, even those who do not progress onto an employer-led programme - exactly the social value evidencing IKEA asked for ahead of the July 2026 trial.$bk$,
    $bk$depth$bk$,
    $bk$d2_1$bk$,
    $bk$A$bk$,
    $bk$simple_average$bk$,
    0,
    $bk$2024-01-01$bk$,
    $bk$active$bk$
  ),
  (
    $bk$44444444-4444-4444-4444-000000000004$bk$::uuid,
    $bk$PRJ-CAT$bk$,
    $bk$Cultural Awareness Training$bk$,
    $bk$Bespoke cultural-awareness sessions for employer partners hiring refugees. Mix of half-day workshops and 1:1 coaching for hiring managers. Impact measured via partner-staff capability shifts.$bk$,
    $bk$breadth$bk$,
    $bk$b2_1$bk$,
    $bk$B$bk$,
    $bk$simple_average$bk$,
    0,
    $bk$2024-09-01$bk$,
    $bk$active$bk$
  )
on conflict (id) do nothing;

insert into public.project_capabilities (project_id, domain, role) values
  ($bk$44444444-4444-4444-4444-000000000002$bk$::uuid, $bk$social$bk$,     $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000002$bk$::uuid, $bk$belonging$bk$,  $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000002$bk$::uuid, $bk$education$bk$,  $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000002$bk$::uuid, $bk$health$bk$,     $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$belonging$bk$,  $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$social$bk$,     $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$health$bk$,     $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$education$bk$,  $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000003$bk$::uuid, $bk$employment$bk$, $bk$optional$bk$),
  ($bk$44444444-4444-4444-4444-000000000004$bk$::uuid, $bk$social$bk$,     $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000004$bk$::uuid, $bk$belonging$bk$,  $bk$core$bk$),
  ($bk$44444444-4444-4444-4444-000000000004$bk$::uuid, $bk$education$bk$,  $bk$optional$bk$)
on conflict do nothing;
