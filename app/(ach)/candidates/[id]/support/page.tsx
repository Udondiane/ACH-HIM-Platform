import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SupportForm } from '@/components/support/support-form';
import { createSupportAction, deleteSupportAction } from '@/lib/support/actions';
import { SUPPORT_KIND_LABELS } from '@/lib/support/schema';

export default async function CandidateSupportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [candidateRes, supportsRes] = await Promise.all([
    supabase.from('candidates').select('id, candidate_ref, given_name, status').eq('id', params.id).maybeSingle(),
    supabase.from('candidate_support')
      .select('*')
      .eq('candidate_id', params.id)
      .order('provided_on', { ascending: false }),
  ]);

  if (!candidateRes.data) notFound();
  const c = candidateRes.data as any;
  const rows = (supportsRes.data as any[]) ?? [];

  async function handleDelete(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await deleteSupportAction(id, params.id);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        backHref={`/candidates/${params.id}`}
        backLabel={c.candidate_ref}
        miniLabel="Support log"
        title="Ongoing support"
        description="Every IAG session, casework call, follow-up, or referral. Applies to candidates both before and after placement, hired and unhired alike - the wraparound support that defines ACH's offer."
      />

      <div className="space-y-3 mb-5">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-[13px] text-ach-navy/60 text-center">
              No support recorded yet. Add the first entry below.
            </CardContent>
          </Card>
        ) : (
          rows.map(s => (
            <Card key={s.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge>{SUPPORT_KIND_LABELS[s.kind as keyof typeof SUPPORT_KIND_LABELS]}</Badge>
                      <span className="text-[12px] text-ach-navy/70">{new Date(s.provided_on).toLocaleDateString('en-GB')}</span>
                      {s.duration_mins && <span className="text-[11px] text-ach-navy/55">{s.duration_mins} min</span>}
                    </div>
                    {s.caseworker && <div className="text-[11.5px] text-ach-navy/55">{s.caseworker}</div>}
                  </div>
                  <form action={handleDelete}>
                    <input type="hidden" name="id" value={s.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-[#8B3A4F]"><Trash2 className="h-3 w-3" /></Button>
                  </form>
                </div>
                <p className="text-[13px] text-ach-navy/85 whitespace-pre-wrap mt-1">{s.summary}</p>
                {(s.next_action || s.next_action_by) && (
                  <div className="mt-3 pt-3 border-t-[0.5px] border-ach-border">
                    <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">Next action {s.next_action_by ? `by ${new Date(s.next_action_by).toLocaleDateString('en-GB')}` : ''}</div>
                    <p className="text-[12.5px] text-ach-navy/75 whitespace-pre-wrap">{s.next_action ?? '—'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-3">Log support given</div>
          <SupportForm
            action={createSupportAction}
            candidateId={params.id}
            cancelHref={`/candidates/${params.id}`}
            submitLabel="Log support"
          />
        </CardContent>
      </Card>
    </div>
  );
}
