-- 038_training_skills_learnt.sql
-- Add a free-text 'skills_learnt' column to candidate_training so a trainer
-- can record what each candidate (or session group) actually walked away
-- with. This is the OUTPUT of a session; 'notes' is the input/topic. The
-- column is nullable so existing rows remain valid.

alter table public.candidate_training
  add column if not exists skills_learnt text;
