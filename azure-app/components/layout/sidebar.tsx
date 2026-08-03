import Link from 'next/link';
import { LayoutDashboard, Users, FolderKanban, BookOpen } from 'lucide-react';

const NAV = [
  { href: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/beneficiaries', label: 'Beneficiaries',  icon: Users },
  { href: '/projects',      label: 'Projects',       icon: FolderKanban },
  { href: '/framework',     label: 'Framework',      icon: BookOpen },
];

export function Sidebar({ userName }: { userName: string }) {
  return (
    <aside className="w-56 shrink-0 border-r border-ach-border bg-ach-page/60 min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-[1.6px] text-ach-navy/60 font-mono">HIM · Azure</div>
        <div className="text-[15px] font-serif font-medium text-ach-navy mt-1">ACH</div>
      </div>
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[6px] text-[13px] text-ach-navy/85 hover:bg-white hover:text-ach-navy transition-colors"
          >
            <item.icon className="h-3.5 w-3.5 opacity-70" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-4 border-t border-ach-border text-[11px] text-ach-navy/60">
        <div className="font-mono text-[10px] uppercase tracking-[1.2px] text-ach-navy/45 mb-1">Signed in</div>
        <div className="truncate">{userName}</div>
      </div>
    </aside>
  );
}
