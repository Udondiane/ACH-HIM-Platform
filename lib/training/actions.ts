'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/auth';
import { assertCan, canManageTraining } from '@/lib/auth/capabilities';
import {
  trainingSchema,
  programmeSchema,
  sessionSchema,
  enrolmentSchema,
  learningOutcomeSchema,
  type AttendanceMark,
} from './schema';

export type TrainingResult = { ok: true; id: string } | { ok: false; error: string };

function fdToPlain(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  for (const k of ['attended_sessions', 'total_sessions']) {
    if (obj[k] === '') obj[k] = undefined;
  }
  return obj;
}

function normalisePayload(input: ReturnType<typeof trainingSchema.parse>) {
  return {
    candidate_id: input.candidate_id,
    cohort_id: input.cohort_id || null,
    training_name: input.training_name,
    trainer: input.trainer || null,
    scheduled_start: input.scheduled_start || null,
    scheduled_end: input.scheduled_end || null,
    attended_sessions: input.attended_sessions === '' ? null : input.attended_sessions ?? null,
    total_sessions: input.total_sessions === '' ? null : input.total_sessions ?? null,
    completion_status: input.completion_status,
    completion_date: input.completion_date || null,
    certificate_url: input.certificate_url || null,
    skills_learnt: input.skills_learnt || null,
    notes: input.notes || null,
  };
}

export async function createTrainingAction(_prev: TrainingResult | null, fd: FormData): Promise<TrainingResult> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const parsed = trainingSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.errors.map(e => e.message).join('; ') };
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('candidate_training')
    .insert({ ...normalisePayload(parsed.data), recorded_by: user.user?.id ?? null } as never)
    .select('id').single();
  if (error) return { ok: false, error: error.message };
  // journey_stage removed in migration 051 — status is driven by placement + baseline
  // events via triggers, not by training log entries.
  revalidatePath(`/candidates/${parsed.data.candidate_id}`);
  revalidatePath(`/candidates/${parsed.data.candidate_id}/training`);
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateTrainingAction(id: string, _prev: TrainingResult | null, fd: FormData): Promise<TrainingResult> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const parsed = trainingSchema.safeParse(fdToPlain(fd));
  if (!parsed.success) return { ok: false, error: parsed.error.errors.map(e => e.message).join('; ') };
  const supabase = createClient();
  const { error } = await supabase
    .from('candidate_training')
    .update(normalisePayload(parsed.data) as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/candidates/${parsed.data.candidate_id}`);
  revalidatePath(`/candidates/${parsed.data.candidate_id}/training`);
  return { ok: true, id };
}

export async function deleteTrainingAction(id: string, candidateId: string) {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const supabase = createClient();
  await supabase.from('candidate_training').delete().eq('id', id);
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath(`/candidates/${candidateId}/training`);
}

/**
 * Bulk-record a single training session against a list of attendees in a
 * cohort. One candidate_training row is created per attendee, all carrying
 * the same training_name / trainer / dates / topic / cohort_id. Used by the
 * tutor cohort roster page so a session can be logged in one form submit
 * rather than per-candidate.
 */
export async function bulkLogTrainingSessionAction(input: {
  cohortId: string;
  candidateIds: string[];
  trainingName: string;
  trainer: string | null;
  sessionDate: string;
  topic: string | null;
  skillsLearnt: string | null;
  completionStatus: 'not_started' | 'in_progress' | 'completed';
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  if (!input.candidateIds.length) return { ok: false, error: 'No attendees selected.' };
  if (!input.trainingName.trim()) return { ok: false, error: 'Training name is required.' };
  if (!input.sessionDate) return { ok: false, error: 'Session date is required.' };

  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const rows = input.candidateIds.map(cid => ({
    candidate_id: cid,
    cohort_id: input.cohortId,
    training_name: input.trainingName.trim(),
    trainer: input.trainer?.trim() || null,
    scheduled_start: input.sessionDate,
    scheduled_end: input.sessionDate,
    attended_sessions: 1,
    total_sessions: 1,
    completion_status: input.completionStatus,
    completion_date: input.completionStatus === 'completed' ? input.sessionDate : null,
    notes: input.topic?.trim() || null,
    skills_learnt: input.skillsLearnt?.trim() || null,
    recorded_by: user.user?.id ?? null,
  }));

  const { error } = await supabase.from('candidate_training').insert(rows as never);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/cohorts/${input.cohortId}/training`);
  for (const cid of input.candidateIds) {
    revalidatePath(`/candidates/${cid}`);
    revalidatePath(`/candidates/${cid}/training`);
  }
  return { ok: true, count: rows.length };
}

// ============================================================
// TRAINING SUBSYSTEM ACTIONS (migration 043)
// ============================================================

export type Result = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fdToObj(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

// ── Programmes ──────────────────────────────────────────────────

export async function createProgrammeAction(_prev: Result | null, fd: FormData): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const parsed = programmeSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const p = parsed.data;
  const { data, error } = await supabase.from('training_programmes').insert({
    name: p.name,
    code: p.code || null,
    description: p.description || null,
    category: p.category || null,
    duration_hours: p.duration_hours ?? null,
    total_sessions: p.total_sessions ?? null,
    certificate_template: p.certificate_template || null,
    status: p.status,
    created_by: user.user?.id ?? null,
  } as never).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/training');
  redirect(`/training/programmes/${(data as { id: string }).id}`);
  return { ok: true };
}

/**
 * Delete a training programme. Cascades to training_sessions, enrolments,
 * attendance, certificates, and the project_training_programmes link
 * (all set as ON DELETE CASCADE in the schema). Use only when the
 * programme was created in error — for a completed programme, use
 * archive (status='archived') instead.
 */
export async function deleteProgrammeAction(id: string): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const supabase = createClient();
  const { error } = await supabase.from('training_programmes').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/training');
  redirect('/training');
}

export async function updateProgrammeAction(id: string, _prev: Result | null, fd: FormData): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const parsed = programmeSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const supabase = createClient();
  const p = parsed.data;
  const { error } = await supabase.from('training_programmes').update({
    name: p.name,
    code: p.code || null,
    description: p.description || null,
    category: p.category || null,
    duration_hours: p.duration_hours ?? null,
    total_sessions: p.total_sessions ?? null,
    certificate_template: p.certificate_template || null,
    status: p.status,
    updated_at: new Date().toISOString(),
  } as never).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/training');
  revalidatePath(`/training/programmes/${id}`);
  return { ok: true, id };
}

// ── Sessions ────────────────────────────────────────────────────

export async function createSessionAction(_prev: Result | null, fd: FormData): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const parsed = sessionSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const s = parsed.data;
  const { data, error } = await supabase.from('training_sessions').insert({
    programme_id: s.programme_id,
    cohort_id: s.cohort_id || null,
    session_number: s.session_number ?? null,
    session_title: s.session_title || null,
    scheduled_date: s.scheduled_date,
    scheduled_start: s.scheduled_start || null,
    scheduled_end: s.scheduled_end || null,
    room: s.room || null,
    tutor_id: s.tutor_id || null,
    tutor_name: s.tutor_name || null,
    status: s.status,
    session_notes: s.session_notes || null,
    created_by: user.user?.id ?? null,
  } as never).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/training/sessions');
  revalidatePath(`/training/programmes/${s.programme_id}`);
  redirect(`/training/sessions/${(data as { id: string }).id}`);
  return { ok: true };
}

export async function updateSessionAction(id: string, _prev: Result | null, fd: FormData): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const parsed = sessionSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const supabase = createClient();
  const s = parsed.data;
  const { error } = await supabase.from('training_sessions').update({
    programme_id: s.programme_id,
    cohort_id: s.cohort_id || null,
    session_number: s.session_number ?? null,
    session_title: s.session_title || null,
    scheduled_date: s.scheduled_date,
    scheduled_start: s.scheduled_start || null,
    scheduled_end: s.scheduled_end || null,
    room: s.room || null,
    tutor_id: s.tutor_id || null,
    tutor_name: s.tutor_name || null,
    status: s.status,
    session_notes: s.session_notes || null,
    updated_at: new Date().toISOString(),
  } as never).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/training/sessions');
  revalidatePath(`/training/sessions/${id}`);
  return { ok: true, id };
}

// ── Enrolments ──────────────────────────────────────────────────

export async function enrolCandidatesAction(input: {
  programmeId: string;
  candidateIds: string[];
  cohortId?: string | null;
  status?: 'enrolled' | 'waiting_list';
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  if (!input.candidateIds.length) return { ok: false, error: 'No learners selected.' };
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const rows = input.candidateIds.map(cid => ({
    candidate_id: cid,
    programme_id: input.programmeId,
    cohort_id: input.cohortId ?? null,
    status: input.status ?? 'enrolled',
    recorded_by: user.user?.id ?? null,
  }));
  const { error } = await supabase.from('training_enrolments').upsert(rows as never, { onConflict: 'candidate_id,programme_id' });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/training/programmes/${input.programmeId}`);
  return { ok: true, count: rows.length };
}

export async function updateEnrolmentStatusAction(input: {
  enrolmentId: string;
  programmeId: string;
  status: 'enrolled' | 'completed' | 'withdrawn' | 'waiting_list' | 'deferred';
  withdrawalReason?: string | null;
}): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const supabase = createClient();
  const payload: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.status === 'completed') payload.completed_date = new Date().toISOString().slice(0, 10);
  if (input.status === 'withdrawn') {
    payload.withdrawn_date = new Date().toISOString().slice(0, 10);
    payload.withdrawal_reason = input.withdrawalReason ?? null;
  }
  const { error } = await supabase.from('training_enrolments').update(payload as never).eq('id', input.enrolmentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/training/programmes/${input.programmeId}`);
  return { ok: true, id: input.enrolmentId };
}

// ── Attendance (bulk upsert) ────────────────────────────────────

export async function markAttendanceAction(input: {
  sessionId: string;
  marks: AttendanceMark[];
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  if (!input.marks.length) return { ok: false, error: 'No attendance marks supplied.' };
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const rows = input.marks.map(m => ({
    session_id: input.sessionId,
    candidate_id: m.candidate_id,
    status: m.status,
    notes: m.notes ?? null,
    marked_by: user.user?.id ?? null,
    marked_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('training_attendance')
    .upsert(rows as never, { onConflict: 'session_id,candidate_id' });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/training/sessions/${input.sessionId}`);
  revalidatePath('/training/my');
  return { ok: true, count: rows.length };
}

export async function markSessionDeliveredAction(sessionId: string): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const supabase = createClient();
  const { error } = await supabase
    .from('training_sessions')
    .update({ status: 'delivered', updated_at: new Date().toISOString() } as never)
    .eq('id', sessionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/training/sessions/${sessionId}`);
  revalidatePath('/training/my');
  return { ok: true, id: sessionId };
}

// ── Session notes ───────────────────────────────────────────────

export async function addSessionNoteAction(input: {
  sessionId: string;
  candidateId: string;
  noteKind: 'observation' | 'concern' | 'achievement' | 'follow_up';
  noteText: string;
}): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  if (!input.noteText.trim()) return { ok: false, error: 'Note text is required.' };
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('training_session_notes').insert({
    session_id: input.sessionId,
    candidate_id: input.candidateId,
    note_kind: input.noteKind,
    note_text: input.noteText.trim(),
    recorded_by: user.user?.id ?? null,
  } as never).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/training/sessions/${input.sessionId}`);
  return { ok: true, id: (data as { id: string }).id };
}

// ── Certificates ────────────────────────────────────────────────

export async function issueCertificateAction(input: {
  candidateId: string;
  programmeId: string;
  enrolmentId?: string | null;
  attendancePct?: number | null;
}): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const cert_no = `CERT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await supabase.from('training_certificates').insert({
    candidate_id: input.candidateId,
    programme_id: input.programmeId,
    enrolment_id: input.enrolmentId ?? null,
    certificate_number: cert_no,
    issued_by: user.user?.id ?? null,
    attendance_pct: input.attendancePct ?? null,
  } as never).select('id').single();
  if (error) return { ok: false, error: error.message };

  if (input.enrolmentId) {
    await supabase.from('training_enrolments').update({
      status: 'completed',
      completed_date: new Date().toISOString().slice(0, 10),
    } as never).eq('id', input.enrolmentId);
  }

  revalidatePath(`/training/programmes/${input.programmeId}`);
  revalidatePath(`/candidates/${input.candidateId}`);
  return { ok: true, id: (data as { id: string }).id };
}

export async function bulkIssueCertificatesAction(input: {
  programmeId: string;
  enrolments: { enrolmentId: string; candidateId: string; attendancePct: number | null }[];
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  if (!input.enrolments.length) return { ok: false, error: 'No learners eligible.' };
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  const year = new Date().getFullYear();
  const rows = input.enrolments.map(e => ({
    candidate_id: e.candidateId,
    programme_id: input.programmeId,
    enrolment_id: e.enrolmentId,
    certificate_number: `CERT-${year}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    issued_by: user.user?.id ?? null,
    attendance_pct: e.attendancePct,
  }));
  const { error } = await supabase.from('training_certificates').insert(rows as never);
  if (error) return { ok: false, error: error.message };

  await supabase.from('training_enrolments').update({
    status: 'completed',
    completed_date: new Date().toISOString().slice(0, 10),
  } as never).in('id', input.enrolments.map(e => e.enrolmentId));

  revalidatePath(`/training/programmes/${input.programmeId}`);
  return { ok: true, count: rows.length };
}

// ── Learning outcomes ──────────────────────────────────────────

export async function addLearningOutcomeAction(_prev: Result | null, fd: FormData): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const parsed = learningOutcomeSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const supabase = createClient();
  const lo = parsed.data;
  const { data, error } = await supabase.from('training_learning_outcomes').insert({
    programme_id: lo.programme_id,
    outcome_code: lo.outcome_code || null,
    outcome_text: lo.outcome_text,
    sort_order: lo.sort_order,
  } as never).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/training/programmes/${lo.programme_id}`);
  return { ok: true, id: (data as { id: string }).id };
}

export async function mapOutcomeToFactorAction(input: {
  learningOutcomeId: string;
  programmeId: string;
  factorId: string;
  evidenceWeight?: number;
}): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const supabase = createClient();
  const { error } = await supabase.from('training_learning_outcome_map').upsert({
    learning_outcome_id: input.learningOutcomeId,
    factor_id: input.factorId,
    evidence_weight: input.evidenceWeight ?? 1.0,
  } as never, { onConflict: 'learning_outcome_id,factor_id' });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/training/programmes/${input.programmeId}`);
  return { ok: true };
}

export async function unmapOutcomeFromFactorAction(input: {
  learningOutcomeId: string;
  factorId: string;
  programmeId: string;
}): Promise<Result> {
  const _guard_user = await requireUser(['ach_staff']);
  assertCan(canManageTraining, _guard_user);
  const supabase = createClient();
  const { error } = await supabase
    .from('training_learning_outcome_map')
    .delete()
    .eq('learning_outcome_id', input.learningOutcomeId)
    .eq('factor_id', input.factorId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/training/programmes/${input.programmeId}`);
  return { ok: true };
}
