'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, Users, FileText, ScrollText,
  Building2, GraduationCap, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Partner {
  id: string;
  name: string;
  type: string;
  types?: string[];
}

export function PartnerSidebar({ partner }: { partner: Partner | null }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const asParam = search?.get('as');
  const qs = asParam ? `?as=${encodeURIComponent(asParam)}` : '';

  const types: string[] = partner?.types ?? (partner?.type ? [partner.type] : []);

  const items: Array<
    | { section: string }
    | { href: string; label: string; icon: any }
  > = [
    { href: '/partner-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  if (types.includes('workforce_partner')) {
    items.push(
      { section: 'Hiring' },
      { href: '/partner/placements',    label: 'Placements',         icon: Users },
      { href: '/partner/milestones',    label: 'Retention milestones', icon: ScrollText },
      { section: 'Impact' },
      { href: '/partner/development-fund', label: 'Development fund', icon: GraduationCap },
    );
  }
  if (types.includes('capability_investor')) {
    items.push(
      { section: 'Investment' },
      { href: '/partner/sponsorships',  label: 'Sponsorships',       icon: Building2 },
      { href: '/partner/capability',    label: 'Capability uplift',  icon: GraduationCap },
    );
  }
  if (types.includes('training_partner')) {
    items.push(
      { section: 'Practice change' },
      { href: '/partner/audit-entries', label: 'Audit entries',      icon: ShieldCheck },
      { href: '/partner/inclusion',     label: 'Inclusion assessment', icon: GraduationCap },
    );
  }

  items.push(
    { section: 'Reports' },
    { href: '/partner/reports', label: 'Reports', icon: FileText },
  );

  return (
    <aside className="w-[228px] shrink-0 border-r-[0.5px] border-ach-border bg-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6 border-b-[0.5px] border-ach-border">
        <Link href={`/partner-dashboard${qs}`} className="flex flex-col">
          <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Partner portal</span>
          <span className="text-[15px] font-medium text-ach-navy mt-0.5 truncate">
            {partner?.name ?? 'Partner'}
          </span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {items.map((item, idx) => {
          if ('section' in item) {
            return (
              <div key={`section-${idx}`} className="px-2 mt-5 mb-1.5 first:mt-1 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/40">
                {item.section}
              </div>
            );
          }
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={`${item.href}${qs}`}
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] text-[13px] transition-colors',
                active ? 'bg-ach-page text-ach-navy font-medium' : 'text-ach-navy/70 hover:bg-ach-page hover:text-ach-navy'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t-[0.5px] border-ach-border text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/40">
        v0.1 · Partner portal
      </div>
    </aside>
  );
}
