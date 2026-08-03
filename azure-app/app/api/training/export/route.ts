import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Programme × learner delivery export.  One row per enrolment with
 * attendance %, status, and certificate status.  Format is the
 * lowest-common-denominator CSV — reformat downstream for specific
 * funder templates (Views XML, ESF returns, etc.) as needed.
 */
export async function GET() {
  const supabase = createClient();

  const [{ data: enrolments }, { data: programmes }, { data: attendance }, { data: certs }] = await Promise.all([
    supabase.from('training_enrolments').select('id, candidate_id, programme_id, status, enrolled_date, completed_date, candidates(candidate_ref, given_name, family_name)'),
    supabase.from('training_programmes').select('id, name, code, category'),
    supabase.from('training_attendance').select('candidate_id, status, session_id, training_sessions!inner(programme_id)'),
    supabase.from('training_certificates').select('candidate_id, programme_id, certificate_number, issued_date'),
  ]);

  const progById = new Map((programmes as any[] ?? []).map(p => [p.id, p]));
  const certByKey = new Map((certs as any[] ?? []).map(c => [`${c.candidate_id}::${c.programme_id}`, c]));

  const attByLearnerProg = new Map<string, { present: number; total: number }>();
  const sessionsByProg = new Map<string, Set<string>>();
  for (const a of (attendance as any[]) ?? []) {
    const progId = a.training_sessions?.programme_id;
    if (!progId) continue;
    if (!sessionsByProg.has(progId)) sessionsByProg.set(progId, new Set());
    sessionsByProg.get(progId)!.add(a.session_id);
    const key = `${a.candidate_id}::${progId}`;
    const cur = attByLearnerProg.get(key) ?? { present: 0, total: 0 };
    if (a.status === 'present' || a.status === 'late') cur.present++;
    attByLearnerProg.set(key, cur);
  }
  for (const [key, v] of attByLearnerProg.entries()) {
    const progId = key.split('::')[1];
    v.total = sessionsByProg.get(progId)?.size ?? 0;
  }

  const header = [
    'candidate_ref', 'given_name', 'family_name',
    'programme_code', 'programme_name', 'programme_category',
    'enrolment_status', 'enrolled_date', 'completed_date',
    'sessions_available', 'sessions_present', 'attendance_pct',
    'certificate_number', 'certificate_issued_date',
  ];
  const rows: string[][] = [header];

  for (const e of (enrolments as any[]) ?? []) {
    const prog = progById.get(e.programme_id);
    const cert = certByKey.get(`${e.candidate_id}::${e.programme_id}`);
    const att = attByLearnerProg.get(`${e.candidate_id}::${e.programme_id}`);
    const pct = att && att.total > 0 ? ((att.present / att.total) * 100).toFixed(0) : '';
    rows.push([
      e.candidates?.candidate_ref ?? '',
      e.candidates?.given_name ?? '',
      e.candidates?.family_name ?? '',
      prog?.code ?? '',
      prog?.name ?? '',
      prog?.category ?? '',
      e.status ?? '',
      e.enrolled_date ?? '',
      e.completed_date ?? '',
      String(att?.total ?? 0),
      String(att?.present ?? 0),
      pct,
      cert?.certificate_number ?? '',
      cert?.issued_date ?? '',
    ]);
  }

  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');

  const filename = `training-delivery-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
