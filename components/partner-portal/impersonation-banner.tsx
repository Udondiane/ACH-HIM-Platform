import Link from 'next/link';
import { Eye } from 'lucide-react';

export function ImpersonationBanner({ partnerName, partnerId }: { partnerName: string; partnerId: string }) {
  return (
    <div className="bg-ach-slate-tint border-b-[0.5px] border-ach-slate-blue/30 px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[12px] text-ach-slate-deep">
        <Eye className="h-3.5 w-3.5" />
        <span>
          Previewing as <span className="font-medium">{partnerName}</span>
        </span>
      </div>
      <Link
        href={`/partners/${partnerId}`}
        className="text-[12px] text-ach-slate-deep underline hover:no-underline"
      >
        Back to ACH view
      </Link>
    </div>
  );
}
