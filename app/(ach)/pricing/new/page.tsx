import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { QuoteForm } from '@/components/pricing/quote-form';

export default async function NewQuotePage() {
  const supabase = createClient();
  const [{ data: partners }, { data: cohorts }, { data: params }] = await Promise.all([
    supabase.from('partners').select('id, name, type').eq('status', 'active').order('name'),
    supabase.from('cohorts').select('id, name, cohort_ref').order('start_date', { ascending: false }),
    supabase.from('pricing_parameters').select('*').eq('id', 1).maybeSingle(),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        miniLabel="Operations · Pricing"
        title="New quote"
        description="Fill in the partner, candidate count and expected hire mix. The total, margin, and traffic-light flag update live."
      />
      <Card>
        <CardContent className="pt-6">
          <QuoteForm
            partners={(partners as any[]) ?? []}
            cohorts={(cohorts as any[]) ?? []}
            params={params as any}
          />
        </CardContent>
      </Card>
    </div>
  );
}
