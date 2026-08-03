import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CohortTomsCalculator } from '@/components/toms/cohort-toms-calculator';

export const metadata = { title: 'TOMs claims' };

async function safeFetch<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    const r = await fn();
    if (r?.error) return fallback;
    return (r?.data ?? fallback) as T;
  } catch { return fallback; }
}

export default async function CohortTomsClaimsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: cohort } = await supabase.from('cohorts').select('*').eq('id', params.id).maybeSingle();
  if (!cohort) notFound();
  const c = cohort as any;

  const [codes, claims] = await Promise.all([
    safeFetch<any[]>(
      () => supabase.from('toms_codes').select('id, measure, unit, proxy_value_pence, play').order('id'),
      [],
    ),
    safeFetch<any[]>(
      () => supabase.from('cohort_toms_claims').select('toms_code, quantity, notes').eq('cohort_id', params.id),
      [],
    ),
  ]);

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="mb-4">
        <Link href={`/cohorts/${params.id}`} className="inline-flex items-center gap-1.5 text-[12px] text-ach-navy/70 hover:text-ach-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to cohort
        </Link>
      </div>

      <PageHeader
        miniLabel="TOMs claims"
        title={c.name ?? 'Cohort TOMs claims'}
        description="Enter National TOMs quantity claims for this cohort. Values populate the aggregate 'TOMs £ social value' KPI and roll into commissioner-facing social value reporting."
      />

      {codes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-[13px] text-ach-navy/70">
            No TOMs codes are loaded. See migration 023 for the seeded set of 13 National TOMs codes and re-run if empty.
          </CardContent>
        </Card>
      ) : (
        <CohortTomsCalculator
          cohortId={c.id}
          codes={codes as any}
          initialClaims={claims as any}
        />
      )}

      <section className="mt-8 text-[11.5px] text-ach-navy/60 leading-relaxed">
        <div className="font-medium text-ach-navy/75 mb-1">How this works</div>
        <p>
          Each row is a National TOMs 2019 measure. Enter the quantity actually delivered for this cohort in the
          box — for example, number of local FTE jobs created, or number of hours of volunteering. Proxy values
          are from the National TOMs framework. HIM computes the total £ social value automatically and surfaces
          it on the aggregate dashboard. Attribution rules from the HIM → TOMs crosswalk apply.
        </p>
      </section>
    </div>
  );
}
