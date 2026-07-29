-- 058 · Partner question sets · workforce-only IKEA-style flow
--
-- Wipes the seeded workforce / wellbeing / housing sets from
-- migration 048 and reseeds a single 'workforce' set with the
-- IKEA-style questions ACH actually uses. Also extends the response
-- type check constraint with 'choice' and 'date', and adds an
-- 'options' column so multi-choice answers can carry their choices
-- inline.

-- ── Schema extensions ──
alter table public.partner_question_items
  add column if not exists options text;

comment on column public.partner_question_items.options is
  'Pipe-separated list of choices for response_type=choice. e.g. "Direct Supervisor|Store Manager|HR Team Member".';

alter table public.partner_question_items
  drop constraint if exists partner_question_items_response_type_check;

alter table public.partner_question_items
  add constraint partner_question_items_response_type_check
  check (response_type in ('narrative', 'yes_no', 'likert_1_5', 'text_short', 'choice', 'date'));

-- ── Wipe old items and non-workforce sets ──
delete from public.partner_question_items;
delete from public.partner_question_sets where key in ('wellbeing', 'housing');

-- ── Reseed workforce set with IKEA-style questions ──
insert into public.partner_question_sets (key, label, description) values
  ('workforce', 'Workforce partner',
   'For programmes with employer partners providing placements. End-of-placement, 6-month and 12-month retention.')
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description;

insert into public.partner_question_items (set_key, timepoint, ordering, prompt, response_type, options, guidance, is_required) values
  -- END OF PLACEMENT (3 months)
  ('workforce', 'exit_3mo', 10,
   'Which of the following best describes your role in relation to this candidate?',
   'choice',
   'Direct Supervisor|Store Manager|HR Team Member',
   null, true),

  ('workforce', 'exit_3mo', 20,
   'Was the candidate assigned a workplace buddy during onboarding?',
   'choice',
   'Yes|No|Not sure',
   null, true),

  ('workforce', 'exit_3mo', 30,
   'How would you rate the candidate''s performance against role expectations?',
   'choice',
   'Exceeds expectations|Meets expectations|Does not meet expectations',
   null, true),

  ('workforce', 'exit_3mo', 40,
   'What are the candidate''s areas for development?',
   'narrative',
   null, null, false),

  ('workforce', 'exit_3mo', 50,
   'End of Placement decision',
   'choice',
   'Permanent role offered|No further offer made|Other',
   null, true),

  -- 6 MONTHS FROM PLACEMENT START
  ('workforce', 'retention_6mo', 10,
   'Is the candidate still employed at your organisation?',
   'choice',
   'Yes|No|Not sure',
   null, true),

  ('workforce', 'retention_6mo', 20,
   'If yes — current role (if different from placement role)',
   'narrative',
   null, null, false),

  ('workforce', 'retention_6mo', 30,
   'If no — date the candidate left',
   'date',
   null, null, false),

  ('workforce', 'retention_6mo', 40,
   'If no — reason for leaving (if known)',
   'narrative',
   null, null, false),

  -- 12 MONTHS FROM PLACEMENT START
  ('workforce', 'retention_12mo', 10,
   'Is the candidate still employed at your organisation?',
   'choice',
   'Yes|No|Not sure',
   null, true),

  ('workforce', 'retention_12mo', 20,
   'If yes — current role (if different from placement role)',
   'narrative',
   null, null, false),

  ('workforce', 'retention_12mo', 30,
   'If yes — any progression? (e.g. promotion, pay change, new responsibilities or trainings completed)',
   'narrative',
   null, null, false),

  ('workforce', 'retention_12mo', 40,
   'If no — date the candidate left',
   'date',
   null, null, false),

  ('workforce', 'retention_12mo', 50,
   'If no — reason for leaving (if known)',
   'narrative',
   null, null, false);

-- Reset any project that was pointed at a deleted set.
update public.projects
   set partner_question_set_key = 'workforce'
 where partner_question_set_key in ('wellbeing', 'housing')
    or partner_question_set_key is null;
