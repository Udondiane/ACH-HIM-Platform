-- Demo / training-session safety net. Earlier completeAssessmentAction
-- flipped projects.is_locked = true the moment any assessment was marked
-- complete. That made every textarea read-only in the runner, blocking
-- the candidate-facing input for tomorrow's session.
--
-- Wholesale unlock so all existing projects accept edits again. The
-- locking behaviour is also disabled in the application code; this
-- migration just resets the historical state.

UPDATE public.projects
SET is_locked = false
WHERE is_locked = true;
