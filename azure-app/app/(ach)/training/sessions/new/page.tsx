import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { SessionForm } from '@/components/training/session-form';
import { createSessionAction } from '@/lib/training/actions';

export const dynamic = 'force-dynamic';

export default async function NewSessionPage({ searchParams }: { searchParams?: { programme?: string } }) {
  const supabase = createClient();
  const [{ data: progs }, { data: cohorts }] = await Promise.all([
    supabase.from('training_programmes').select('id, name').eq('status', 'active').order('name'),
    supabase.from('cohorts').select('id, cohort_ref, name').order('start_date', { ascending: false, nullsFirst: false }).limit(50),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        backHref="/training"
        backLabel="Training"
        miniLabel="New session"
        title="Schedule a training session"
      />
      <Card>
        <CardContent className="pt-6">
          <SessionForm
            action={createSessionAction}
            programmes={(progs as any[]) ?? []}
            cohorts={(cohorts as any[]) ?? []}
            initialProgrammeId={searchParams?.programme}
            cancelHref="/training"
            submitLabel="Schedule session"
          />
        </CardContent>
      </Card>
    </div>
  );
}
