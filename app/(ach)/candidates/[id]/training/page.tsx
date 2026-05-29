import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrainingForm } from '@/components/training/training-form';
import { createTrainingAction, deleteTrainingAction } from '@/lib/training/actions';
import { COMPLETION_STATUS_LABELS } from '@/lib/training/schema';

export default async function CandidateTrainingPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [candidateRes, trainingsRes] = await Promise.all([
    supabase.from('candidates').select('id, candidate_ref').eq('id', params.id).maybeSingle(),
    supabase.from('candidate_training')
      .select('*, cohorts(cohort_ref)')
      .eq('candidate_id', params.id)
      .order('scheduled_start', { ascending: false, nullsFirst: false }),
  ]);

  if (!candidateRes.data) notFound();
  const c = candidateRes.data as any;
  const rows = (trainingsRes.data as any[]) ?? [];

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteTrainingAction(id, params.id);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        backHref={`/candidates/${params.id}`}
        backLabel={c.candidate_ref}
        miniLabel="Training"
        title="Training delivery"
        description="Pre-placement training, ongoing skills development, accredited qualifications. Tracks attendance, completion, and certificates."
      />

      <div className="space-y-4">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-[13px] text-ach-navy/60 text-center">
              No training records yet. Add the first one below.
            </CardContent>
          </Card>
        ) : (
          rows.map(t => {
            const attendance = (t.attended_sessions && t.total_sessions)
              ? (t.attended_sessions / t.total_sessions) * 100 : null;
            return (
              <Card key={t.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="text-[14px] font-medium text-ach-navy">{t.training_name}</div>
                      <div className="text-[12px] text-ach-navy/60 mt-0.5">
                        {[t.trainer, t.cohorts?.cohort_ref].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <Badge variant={t.completion_status === 'completed' ? 'active' : 'default'}>
                      {COMPLETION_STATUS_LABELS[t.completion_status as keyof typeof COMPLETION_STATUS_LABELS]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px] mt-3">
                    <Stat label="Scheduled">{t.scheduled_start ? `${new Date(t.scheduled_start).toLocaleDateString('en-GB')}${t.scheduled_end ? ` – ${new Date(t.scheduled_end).toLocaleDateString('en-GB')}` : ''}` : '—'}</Stat>
                    <Stat label="Attendance">{attendance != null ? `${attendance.toFixed(0)}%` : '—'}{t.attended_sessions != null && t.total_sessions != null ? ` (${t.attended_sessions}/${t.total_sessions})` : ''}</Stat>
                    <Stat label="Completed on">{t.completion_date ? new Date(t.completion_date).toLocaleDateString('en-GB') : '—'}</Stat>
                    <Stat label="Certificate">{t.certificate_url ? <a href={t.certificate_url} target="_blank" className="underline">Open link</a> : '—'}</Stat>
                  </div>
                  {t.notes && <p className="text-[12.5px] text-ach-navy/75 mt-3 whitespace-pre-wrap">{t.notes}</p>}
                  <form action={handleDelete} className="mt-3 flex justify-end">
                    <input type="hidden" name="id" value={t.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-[#8B3A4F]"><Trash2 className="h-3 w-3" />Remove</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Add training record</div>
            <TrainingForm
              action={createTrainingAction}
              candidateId={params.id}
              cancelHref={`/candidates/${params.id}`}
              submitLabel="Add training record"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55">{label}</div>
      <div className="text-ach-navy mt-0.5">{children}</div>
    </div>
  );
}
