import Link from 'next/link';
import { Layers, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { COHORT_STATUSES, COHORT_STATUS_LABELS, COHORT_STRUCTURE_LABELS } from '@/lib/cohorts/schema';

type Search = { status?: string };

export default async function CohortsListPage({ searchParams }: { searchParams?: Search }) {
  const supabase = createClient();
  let q = supabase
    .from('cohorts')
    .select('id, cohort_ref, name, structure, status, location, start_date, target_size')
    .order('start_date', { ascending: false, nullsFirst: false });

  if (searchParams?.status && (COHORT_STATUSES as readonly string[]).includes(searchParams.status)) {
    q = q.eq('status', searchParams.status);
  }
  const { data: cohorts, error } = await q;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Network"
        title="Cohorts"
        description="Programme cohorts. Multi-partner cohorts pool sponsorships; single-partner cohorts are bespoke."
        actions={
          <Link href="/cohorts/new"><Button><Plus className="h-4 w-4" />New cohort</Button></Link>
        }
      />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <FilterPill href="/cohorts" label="All" active={!searchParams?.status} />
        {COHORT_STATUSES.map(s => (
          <FilterPill key={s} href={`/cohorts?status=${s}`} label={COHORT_STATUS_LABELS[s]} active={searchParams?.status === s} />
        ))}
      </div>

      {error && (
        <div className="text-[13px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30 mb-4">
          {error.message}
        </div>
      )}

      {!cohorts || cohorts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers className="h-10 w-10" />}
            title="No cohorts yet"
            description="Create your first cohort. You'll add partners and candidates from the cohort's detail page."
            action={<Link href="/cohorts/new"><Button><Plus className="h-4 w-4" />New cohort</Button></Link>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(cohorts as any[]).map(c => (
            <Link key={c.id} href={`/cohorts/${c.id}`}>
              <Card className="hover:bg-ach-page transition-colors h-full">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{c.cohort_ref}</div>
                    <Badge>{COHORT_STATUS_LABELS[c.status as keyof typeof COHORT_STATUS_LABELS]}</Badge>
                  </div>
                  <h3 className="text-[15px] font-medium text-ach-navy">{c.name}</h3>
                  <div className="text-[12px] text-ach-navy/60 mt-2 flex items-center gap-2 flex-wrap">
                    <span>{COHORT_STRUCTURE_LABELS[c.structure as keyof typeof COHORT_STRUCTURE_LABELS]}</span>
                    {c.location && <><span>·</span><span>{c.location}</span></>}
                    {c.start_date && <><span>·</span><span>Starts {new Date(c.start_date).toLocaleDateString('en-GB')}</span></>}
                    {c.target_size && <><span>·</span><span>Target {c.target_size}</span></>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-[12px] border-[0.5px] transition-colors ${
        active ? 'bg-ach-navy text-ach-cream border-ach-navy' : 'bg-white text-ach-navy/70 border-ach-border hover:bg-ach-page'
      }`}
    >
      {label}
    </Link>
  );
}
