import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PARTNER_TYPES, PARTNER_TYPE_LABELS } from '@/lib/partners/schema';

type Search = { type?: string; archived?: string };

export default async function PartnersListPage({ searchParams }: { searchParams?: Search }) {
  const supabase = createClient();
  const showArchived = searchParams?.archived === '1';

  let query = supabase
    .from('partners')
    .select('id, name, type, types, status, sector, region, employee_count')
    .order('created_at', { ascending: false });

  if (searchParams?.type && (PARTNER_TYPES as readonly string[]).includes(searchParams.type)) {
    // Array containment: partners.types contains the filter value
    query = query.contains('types', [searchParams.type]);
  }

  if (!showArchived) {
    query = query.neq('status', 'closed');
  }

  const { data: partners, error } = await query;

  const { count: archivedCount } = await supabase
    .from('partners')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'closed');

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Network"
        title="Partners"
        description="Capability Investors, Workforce Partners, and Training Partners. Partners are created through project setup — when a Programme Lead adds a project and names the partners involved, HIM auto-creates the partner records here."
      />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <FilterPill href="/partners" label="All" active={!searchParams?.type} />
        {PARTNER_TYPES.map(t => (
          <FilterPill
            key={t}
            href={`/partners?type=${t}${showArchived ? '&archived=1' : ''}`}
            label={PARTNER_TYPE_LABELS[t]}
            active={searchParams?.type === t}
          />
        ))}
        {(archivedCount ?? 0) > 0 && (
          <Link
            href={showArchived
              ? (searchParams?.type ? `/partners?type=${searchParams.type}` : '/partners')
              : (searchParams?.type ? `/partners?type=${searchParams.type}&archived=1` : '/partners?archived=1')}
            className={`ml-auto px-3 py-1 rounded-full text-[12px] border-[0.5px] transition-colors ${
              showArchived
                ? 'bg-ach-navy text-ach-cream border-ach-navy'
                : 'bg-white text-ach-navy/60 border-ach-border hover:bg-ach-page'
            }`}
          >
            {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
          </Link>
        )}
      </div>

      {error && (
        <div className="text-[13px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30 mb-4">
          {error.message}
        </div>
      )}

      {!partners || partners.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="No partners yet"
            description="Partners are created through project setup. Create a project and name the partners involved — HIM will add them here automatically."
            action={
              <Link href="/projects/new" className="btn-primary inline-flex">Create a project</Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Sector</Th>
                <Th>Region</Th>
                <Th>Employees</Th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p: any) => (
                <tr key={p.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/50 transition-colors">
                  <Td>
                    <Link href={`/partners/${p.id}`} className="text-ach-navy font-medium hover:underline">
                      {p.name}
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {((p.types as string[] | null) ?? (p.type ? [p.type] : [])).map((t: string) => (
                        <Badge key={t} variant={t as any}>{PARTNER_TYPE_LABELS[t as keyof typeof PARTNER_TYPE_LABELS] ?? t}</Badge>
                      ))}
                    </div>
                  </Td>
                  <Td><Badge variant={p.status}>{p.status}</Badge></Td>
                  <Td className="text-ach-navy/70">{p.sector ?? '—'}</Td>
                  <Td className="text-ach-navy/70">{p.region ?? '—'}</Td>
                  <Td className="text-ach-navy/70 tabular-nums">{p.employee_count?.toLocaleString() ?? '—'}</Td>
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
  return (
    <th className="text-left px-4 py-3 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">
      {children}
    </th>
  );
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-[12px] border-[0.5px] transition-colors ${
        active
          ? 'bg-ach-navy text-ach-cream border-ach-navy'
          : 'bg-white text-ach-navy/70 border-ach-border hover:bg-ach-page'
      }`}
    >
      {label}
    </Link>
  );
}
