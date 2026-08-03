import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { BidForm } from '@/components/bids/bid-form';
import { updateBidAction } from '@/lib/bids/actions';

export default async function EditBidPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [bidRes, frameworksRes, projectsRes, cohortsRes, quotesRes] = await Promise.all([
    supabase.from('bids').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('bid_financial_frameworks').select('key, label').order('label'),
    supabase.from('projects').select('id, name, project_ref').order('name'),
    supabase.from('cohorts').select('id, name').order('name'),
    supabase.from('featured_quotes').select('id, quote_text, speaker_type').is('archived_at', null).order('tagged_at', { ascending: false }).limit(100),
  ]);

  if (!bidRes.data) notFound();
  const bid = bidRes.data as any;
  const action = updateBidAction.bind(null, params.id);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref={`/bids/${params.id}`}
        backLabel={bid.name}
        miniLabel="Reports"
        title="Edit bid pack"
      />
      <Card>
        <CardContent className="pt-6">
          <BidForm
            action={action as any}
            initial={bid}
            frameworks={(frameworksRes.data as any[]) ?? []}
            projects={(projectsRes.data as any[]) ?? []}
            cohorts={(cohortsRes.data as any[]) ?? []}
            quotes={(quotesRes.data as any[]) ?? []}
            cancelHref={`/bids/${params.id}`}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
