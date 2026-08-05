import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { BidForm } from '@/components/bids/bid-form';
import { createBidAction } from '@/lib/bids/actions';

export default async function NewBidPage() {
  const supabase = createClient();

  const [frameworksRes, projectsRes, cohortsRes, quotesRes] = await Promise.all([
    supabase.from('bid_financial_frameworks').select('key, label').order('label'),
    supabase.from('projects').select('id, name, project_ref').order('name'),
    supabase.from('cohorts').select('id, name').order('name'),
    supabase.from('featured_quotes').select('id, quote_text, speaker_type').is('archived_at', null).order('tagged_at', { ascending: false }).limit(100),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/bids"
        backLabel="Bid packs"
        miniLabel="Reports"
        title="New bid support pack"
        description="Assemble a bid pack: pull impact evidence from HIM, select a financial framework, add narrative."
      />
      <Card>
        <CardContent className="pt-6">
          <BidForm
            action={createBidAction}
            frameworks={(frameworksRes.data as any[]) ?? []}
            projects={(projectsRes.data as any[]) ?? []}
            cohorts={(cohortsRes.data as any[]) ?? []}
            quotes={(quotesRes.data as any[]) ?? []}
            cancelHref="/bids"
            submitLabel="Create bid pack"
          />
        </CardContent>
      </Card>
    </div>
  );
}
