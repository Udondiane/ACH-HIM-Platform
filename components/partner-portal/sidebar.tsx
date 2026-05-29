'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, Users, FileText, ScrollText, MessageSquare,
  Building2, GraduationCap, ShieldCheck,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Partner {
  id: string;
  name: string;
  type: string;
  types?: string[];
}

const STORAGE_KEY = 'partner_sidebar_collapsed';

export function PartnerSidebar({ partner }: { partner: Partner | null }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const asParam = search?.get('as');
  const qs = asParam ? `?as=${encodeURIComponent(asParam)}` : '';

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
  };

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
      { href: '/partner/interviews',    label: 'Interviews',         icon: MessageSquare },
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
    <aside
      className={cn(
        'shrink-0 border-r-[0.5px] border-ach-border bg-white flex flex-col h-screen sticky top-0 transition-[width] duration-200 ease-out',
        collapsed ? 'w-[64px]' : 'w-[228px]',
        !mounted && 'invisible'
      )}
      aria-label="Partner navigation"
    >
      <div className={cn('border-b-[0.5px] border-ach-border', collapsed ? 'px-3 py-5' : 'px-5 py-6')}>
        <Link href={`/partner-dashboard${qs}`} className={cn('flex', collapsed ? 'items-center justify-center' : 'flex-col')}>
          <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{collapsed ? 'PP' : 'Partner portal'}</span>
          {!collapsed && (
            <span className="text-[15px] font-medium text-ach-navy mt-0.5 truncate">
              {partner?.name ?? 'Partner'}
            </span>
          )}
        </Link>
      </div>

      <nav className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}>
        {items.map((item, idx) => {
          if ('section' in item) {
            if (collapsed) {
              return idx === 0 ? null : (
                <div key={`section-${idx}`} className="my-3 h-px bg-ach-border/70" />
              );
            }
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
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-[10px] text-[13px] transition-colors',
                collapsed ? 'h-9 justify-center' : 'gap-2.5 px-2 py-1.5',
                active ? 'bg-ach-page text-ach-navy font-medium' : 'text-ach-navy/70 hover:bg-ach-page hover:text-ach-navy'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'border-t-[0.5px] border-ach-border flex items-center text-[11.5px] text-ach-navy/55 hover:text-ach-navy hover:bg-ach-page transition-colors',
          collapsed ? 'h-12 justify-center' : 'h-10 px-4 gap-2'
        )}
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-3.5 w-3.5" /><span>Collapse sidebar</span></>}
      </button>

      {!collapsed && (
        <div className="px-5 py-3 border-t-[0.5px] border-ach-border text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/40">
          v0.1 · Partner portal
        </div>
      )}
    </aside>
  );
}
