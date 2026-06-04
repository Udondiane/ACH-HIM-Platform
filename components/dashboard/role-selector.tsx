import Link from 'next/link';
import { STAFF_ROLES, type StaffRoleId } from '@/lib/roles/staff-roles';

const ACCENT_CLASSES = {
  navy:  'bg-ach-navy/5 border-ach-navy/20 hover:bg-ach-navy/10 text-ach-navy',
  slate: 'bg-ach-slate-tint border-ach-slate-blue/30 hover:bg-ach-slate-tint/70 text-ach-slate-deep',
  olive: 'bg-[#EEF1E8] border-[#3C6B47]/25 hover:bg-[#E5E9DD] text-[#3C6B47]',
  rose:  'bg-ach-rose/10 border-ach-rose/30 hover:bg-ach-rose/15 text-[#8B3A4F]',
} as const;

const ICON_CLASSES = {
  navy:  'text-ach-navy/70',
  slate: 'text-ach-slate-deep/70',
  olive: 'text-[#3C6B47]/70',
  rose:  'text-[#8B3A4F]/70',
} as const;

export function RoleSelector({ activeRole }: { activeRole?: StaffRoleId }) {
  return (
    <div className="mb-5">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">
        Role views
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAFF_ROLES.map(role => {
          const isActive = activeRole === role.id;
          const accentBox = ACCENT_CLASSES[role.accent];
          const accentIcon = ICON_CLASSES[role.accent];
          return (
            <Link
              key={role.id}
              href={role.href}
              className={`block rounded-[12px] p-3.5 border-[0.5px] transition-colors ${accentBox} ${
                isActive ? 'ring-2 ring-offset-2 ring-ach-navy/30' : ''
              }`}
            >
              <div className="flex items-start gap-2.5">
                <role.icon className={`h-5 w-5 mt-0.5 shrink-0 ${accentIcon}`} />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium leading-tight">{role.label}</div>
                  <div className="text-[11.5px] mt-1 leading-snug opacity-75">
                    {role.description}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
