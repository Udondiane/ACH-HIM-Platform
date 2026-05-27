'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, FolderKanban,
  CircleDollarSign, BookOpen, BadgeCheck, Lightbulb, FileText,
  Languages, BarChart3, ScrollText, Calculator,
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
  { href: '/equivalence',        label: 'Equivalence',      icon: BookOpen },
  { href: '/verified-network',   label: 'Verified network', icon: BadgeCheck },
  { section: 'Method (V2)' },
  { href: '/delphi',             label: 'Delphi panels',    icon: Lightbulb },
  { href: '/dr-analysis',        label: 'DR analysis',      icon: BarChart3 },
  { section: 'Reports' },
  { href: '/evidence-pack',      label: 'Evidence packs',   icon: FileText },
  { href: '/reports',            label: 'Other reports',    icon: ScrollText },
  { section: 'Admin' },
  { href: '/translations',       label: 'Translations',     icon: Languages },
] as const;

export function AchSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-[228px] shrink-0 border-r-[0.5px] border-ach-border bg-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6 border-b-[0.5px] border-ach-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <img
            src="/ach-logo.svg"
            alt="ACH"
            className="h-10 w-auto shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
              Ashley Community
            </span>
            <span className="text-[13px] font-medium text-ach-navy mt-0.5">
              HIM Platform
            </span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((item, idx) => {
          if ('section' in item) {
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
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] text-[13px] transition-colors',
                active
                  ? 'bg-ach-page text-ach-navy font-medium'
                  : 'text-ach-navy/70 hover:bg-ach-page hover:text-ach-navy'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t-[0.5px] border-ach-border text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/40">
        v0.1 · Internal preview
      </div>
    </aside>
  );
}
