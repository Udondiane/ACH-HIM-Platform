import Link from 'next/link';
import { Users, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_LABELS, LOCALE_NAMES } from '@/lib/candidates/schema';

type Search = { status?: string };

export default async function CandidatesListPage({ searchParams }: { searchParams?: Search }) {
  const supabase = createClient();
  let q = supabase
    .from('candidates')
    .select('id, candidate_ref, given_name, family_name, preferred_locale, country_of_origin, status, arrival_year')
    .order('created_at', { ascending: false });

  if (searchParams?.status && (CANDIDATE_STATUSES as readonly string[]).includes(searchParams.status)) {
    q = q.eq('status', searchParams.status);
  }

  const { data: candidates, error } = await q;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Network"
        title="Candidates"
        description="Programme participants. Career goals and development plans are private — never shown to partners without explicit consent."
        actions={
          <Link href="/candidates/new">
            <Button><Plus className="h-4 w-4" />Add candidate</Button>
          </Link>
        }
      />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <FilterPill href="/candidates" label="All" active={!searchParams?.status} />
        {CANDIDATE_STATUSES.map(s => (
          <FilterPill key={s} href={`/candidates?status=${s}`} label={CANDIDATE_STATUS_LABELS[s]} active={searchParams?.status === s} />
        ))}
      </div>

      {error && <ErrorBanner message={error.message} />}

      {!candidates || candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No candidates yet"
            description="Add your first candidate to begin tracking capability assessments, placements, and progression."
            action={
              <Link href="/candidates/new">
                <Button><Plus className="h-4 w-4" />Add candidate</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
              <tr>
                <Th>Reference</Th>
                <Th>Given name</Th>
                <Th>Country</Th>
                <Th>Language</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {(candidates as any[]).map(c => (
                <tr key={c.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/50 transition-colors">
                  <Td>
                    <Link href={`/candidates/${c.id}`} className="text-ach-navy font-medium hover:underline">
                      {c.candidate_ref}
                    </Link>
                  </Td>
                  <Td>{c.given_name}</Td>
                  <Td className="text-ach-navy/70">{c.country_of_origin ?? '—'}</Td>
                  <Td className="text-ach-navy/70">{LOCALE_NAMES[c.preferred_locale as keyof typeof LOCALE_NAMES] ?? c.preferred_locale}</Td>
                  <Td><Badge>{CANDIDATE_STATUS_LABELS[c.status as keyof typeof CANDIDATE_STATUS_LABELS] ?? c.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
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
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="text-[13px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30 mb-4">
      {message}
    </div>
  );
}
