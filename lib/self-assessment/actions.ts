'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createTokenSchema, submitSchema, SelfAssessmentTimepoint } from './schema';

export type CreateTokenResult =
  | { ok: true; token: string; url: string; expires_at: string }
  | { ok: false; error: string };

export type SubmitResult = { ok: true } | { ok: false; error: string };

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL
      ?? process.env.VERCEL_URL
      ?? 'http://localhost:3000'
  ).replace(/\/+$/, '');
}

export async function createSelfAssessmentTokenAction(
  input: { candidate_id: string; project_id: string; timepoint: SelfAssessmentTimepoint },
): Promise<CreateTokenResult> {
  const parsed = createTokenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map(i => i.message).join('; ') };
  }

  const supabase = createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const token = newToken();

  const { data, error } = await supabase
    .from('self_assessment_tokens')
    .insert({
      token,
      candidate_id: parsed.data.candidate_id,
      project_id: parsed.data.project_id,
      timepoint: parsed.data.timepoint,
      created_by: userRes?.user?.id ?? null,
    } as never)
    .select('token, expires_at')
    .single();

  if (error) return { ok: false, error: error.message };
  const row = data as { token: string; expires_at: string };

  return {
    ok: true,
    token: row.token,
    url: `${siteUrl()}/self-assess/${row.token}`,
    expires_at: row.expires_at,
  };
}

export async function submitSelfAssessmentAction(input: {
  token: string;
  responses: { factor_id: string; score: number | null; narrative?: string }[];
  reflection?: string;
}): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map(i => i.message).join('; ') };
  }

  const svc = createServiceClient();

  const { data: tokenRow, error: tokenErr } = await svc
    .from('self_assessment_tokens')
    .select('id, candidate_id, project_id, timepoint, expires_at, completed_at, revoked_at')
    .eq('token', parsed.data.token)
    .maybeSingle();

  if (tokenErr) return { ok: false, error: tokenErr.message };
  if (!tokenRow)  return { ok: false, error: 'Link not found.' };

  const t = tokenRow as any;
  if (t.revoked_at)                                 return { ok: false, error: 'Link has been revoked.' };
  if (new Date(t.expires_at) < new Date())          return { ok: false, error: 'Link has expired.' };
  if (t.completed_at)                               return { ok: false, error: 'This self-assessment has already been submitted.' };

  // Upsert an assessment at this timepoint for this (candidate, project).
  const { data: assessmentRow, error: aErr } = await svc
    .from('assessments')
    .upsert({
      candidate_id: t.candidate_id,
      project_id:   t.project_id,
      timepoint:    t.timepoint,
      status:       'completed',
      notes:        'Self-submitted via tokenised link.',
    } as never, { onConflict: 'candidate_id,project_id,timepoint' })
    .select('id')
    .single();

  if (aErr) return { ok: false, error: aErr.message };
  const assessmentId = (assessmentRow as { id: string }).id;

  // For each factor response, find its indicators and write one response row per indicator.
  for (const r of parsed.data.responses) {
    const { data: indicators } = await svc
      .from('indicators')
      .select('id')
      .eq('factor_id', r.factor_id);

    const indicatorRows = (indicators as { id: string }[] | null) ?? [];
    if (indicatorRows.length === 0) continue;

    if (r.score !== null) {
      const rows = indicatorRows.map(ind => ({
        assessment_id: assessmentId,
        indicator_id:  ind.id,
        numeric_value: r.score,
      }));
      await svc
        .from('assessment_responses')
        .upsert(rows as never, { onConflict: 'assessment_id,indicator_id' });
    }

    if (r.narrative && r.narrative.trim()) {
      await svc
        .from('assessment_factor_responses')
        .upsert({
          assessment_id:   assessmentId,
          factor_id:       r.factor_id,
          response_text:   r.narrative.trim(),
          captured_via:    'typed',
          spoken_language: 'en',
        } as never, { onConflict: 'assessment_id,factor_id' });
    }
  }

  // Reflection (optional) goes on the assessment notes field, appended.
  if (parsed.data.reflection && parsed.data.reflection.trim()) {
    await svc
      .from('assessments')
      .update({
        notes: `Self-submitted via tokenised link.\n\nReflection: ${parsed.data.reflection.trim()}`,
      } as never)
      .eq('id', assessmentId);
  }

  // Mark the token completed.
  await svc
    .from('self_assessment_tokens')
    .update({ completed_at: new Date().toISOString() } as never)
    .eq('id', t.id);

  revalidatePath(`/candidates/${t.candidate_id}`);
  return { ok: true };
}

export async function markTokenOpenedAction(token: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('self_assessment_tokens')
    .update({ opened_at: new Date().toISOString() } as never)
    .eq('token', token)
    .is('opened_at', null);
}
