import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { PartnerForm } from '@/components/partners/partner-form';
import { updatePartnerAction, deletePartnerAction, type ActionResult } from '@/lib/partners/actions';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default async function EditPartnerPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: partner } = await supabase
    .from('partners').select('*').eq('id', params.id).maybeSingle();
  if (!partner) notFound();
  const p = partner as any;

  const action = async (prev: ActionResult | null, fd: FormData) => updatePartnerAction(params.id, prev, fd);
  const handleDelete = async () => { 'use server'; await deletePartnerAction(params.id); };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={`/partners/${params.id}`}
        backLabel={p.name}
        miniLabel="Network"
        title="Edit partner"
      />
      <Card>
        <CardContent className="pt-6">
          <PartnerForm
            action={action}
            initial={p}
            cancelHref={`/partners/${params.id}`}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>

      <Card className="mt-5 border-ach-rose/30">
        <CardContent className="pt-6">
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">Danger zone</div>
          <p className="text-[13px] text-ach-navy/80 mb-3">
            Closing a partner sets their status to <span className="font-medium">closed</span>. Existing placements
            and milestone records are preserved for reporting.
          </p>
          <form action={handleDelete}>
            <Button variant="danger" type="submit">
              <Trash2 className="h-3.5 w-3.5" />Close partner
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
