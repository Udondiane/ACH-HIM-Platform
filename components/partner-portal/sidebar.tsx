'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
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

  // Partner data collection now flows through the tokenised `/report/[token]`
  // surface. The authenticated portal here is retained only as a summary
  // landing page for partners with dashboard access.
  const items: Array<{ href: string; label: string; icon: any }> = [
    { href: '/partner-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

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
        {items.map(item => {
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
          HIM Platform · Partner portal
        </div>
      )}
    </aside>
  );
}
