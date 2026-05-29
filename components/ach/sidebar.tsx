'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, FolderKanban,
  CircleDollarSign, FileText,
  Languages, ScrollText, Calculator, Settings2, BarChart3,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard',          label: 'Dashboard',        icon: LayoutDashboard },
  { section: 'Network' },
  { href: '/partners',           label: 'Partners',         icon: Building2 },
  { href: '/candidates',         label: 'Candidates',       icon: Users },
  { href: '/projects',           label: 'Projects',         icon: FolderKanban },
  { section: 'Operations' },
  { href: '/pricing',            label: 'Pricing tool',     icon: Calculator },
  { href: '/development-fund',   label: 'Development fund', icon: CircleDollarSign },
  { section: 'Reports' },
  { href: '/aggregate',          label: 'Aggregate',        icon: LayoutDashboard },
  { href: '/evidence-pack',      label: 'Evidence packs',   icon: FileText },
  { href: '/toms-crosswalk',     label: 'TOMs crosswalk',   icon: BarChart3 },
  { href: '/reports',            label: 'Other reports',    icon: ScrollText },
  { section: 'Admin' },
  { href: '/admin/projects',     label: 'Project admin',    icon: Settings2 },
  { href: '/translations',       label: 'Translations',     icon: Languages },
] as const;

const STORAGE_KEY = 'ach_sidebar_collapsed';

export function AchSidebar() {
  const pathname = usePathname();
  /* Default to expanded so users who haven't customised get the
     full sidebar on first render. Hydration syncs from localStorage
     once mounted. */
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

  return (
    <aside
      className={cn(
        'shrink-0 border-r-[0.5px] border-ach-border bg-white flex flex-col h-screen sticky top-0 transition-[width] duration-200 ease-out',
        collapsed ? 'w-[64px]' : 'w-[228px]',
        /* Suppress hydration mismatch while syncing from localStorage */
        !mounted && 'invisible'
      )}
      aria-label="Primary navigation"
    >
      <div className={cn('border-b-[0.5px] border-ach-border', collapsed ? 'px-3 py-5' : 'px-5 py-6')}>
        <Link href="/dashboard" className={cn('flex', collapsed ? 'items-center justify-center' : 'flex-col')}>
          <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">ACH</span>
          {!collapsed && (
            <span className="text-[15px] font-medium text-ach-navy mt-0.5">HIM Platform</span>
          )}
        </Link>
      </div>

      <nav className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}>
        {NAV.map((item, idx) => {
          if ('section' in item) {
            if (collapsed) {
              return idx === 0 ? null : (
                <div key={`section-${idx}`} className="my-3 h-px bg-ach-border/70" />
              );
            }
            return (
              <div
                key={`section-${idx}`}
                className="px-2 mt-5 mb-1.5 first:mt-1 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/40"
              >
                {item.section}
              </div>
            );
          }
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-[10px] text-[13px] transition-colors',
                collapsed ? 'h-9 justify-center' : 'gap-2.5 px-2 py-1.5',
                active
                  ? 'bg-ach-page text-ach-navy font-medium'
                  : 'text-ach-navy/70 hover:bg-ach-page hover:text-ach-navy'
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
          v0.1 · Internal preview
        </div>
      )}
    </aside>
  );
}
