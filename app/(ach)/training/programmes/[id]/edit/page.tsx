import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProgrammeForm } from '@/components/training/programme-form';
import { updateProgrammeAction } from '@/lib/training/actions';

export const dynamic = 'force-dynamic';

export default async function EditProgrammePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase.from('training_programmes').select('*').eq('id', params.id).maybeSingle();
  if (!p) notFound();
  const action = updateProgrammeAction.bind(null, params.id);
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        backHref={`/training/programmes/${params.id}`}
        backLabel={(p as any).name}
        miniLabel="Edit"
        title="Edit programme"
      />
      <Card>
        <CardContent className="pt-6">
          <ProgrammeForm action={action} initial={p as any} cancelHref={`/training/programmes/${params.id}`} />
        </CardContent>
      </Card>
    </div>
  );
}
