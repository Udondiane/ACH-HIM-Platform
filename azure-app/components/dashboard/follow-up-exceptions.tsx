import Link from 'next/link';
import { AlertTriangle, Clock, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

export async function FollowUpExceptions() {
  const supabase = createClient();

  const [flaggedRes, noRespRes, dueRes] = await Promise.all([
    supabase.from('follow_up_dispatches').select('id, candidate_id', { count: 'exact', head: false }).eq('response_flagged', true).eq('status', 'flagged'),
    supabase.from('follow_up_dispatches').select('id', { count: 'exact', head: false }).eq('status', 'no_response'),
    supabase.from('follow_up_dispatches').select('id', { count: 'exact', head: false }).in('status', ['queued', 'sent']).lte('due_date', new Date().toISOString().slice(0, 10)),
  ]);

  const flagged = (flaggedRes.data as any[])?.length ?? 0;
  const noResp  = (noRespRes.data as any[])?.length ?? 0;
  const due     = (dueRes.data as any[])?.length ?? 0;

  const total = flagged + noResp + due;
  if (total === 0) return null;

  return (
    <Card className="border-[#B8862C]/25 bg-[#FBF2E0]/50">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">Follow-up exceptions</div>
            <div className="text-[13px] text-ach-navy leading-relaxed">
              HIM has automated the routine. These are the items that need your judgement.
            </div>
          </div>
          <Link
            href="/follow-ups"
            className="text-[12px] text-ach-navy underline underline-offset-2 hover:text-ach-navy/70 whitespace-nowrap"
          >
            Open queue →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <ExceptionTile icon={AlertTriangle} tone="alert" count={flagged} label="Concerning" hint="auto-flagged from response text" />
          <ExceptionTile icon={Clock} tone="warn" count={noResp} label="Unresponsive" hint="3+ attempts, no reply" />
          <ExceptionTile icon={Phone} tone="focus" count={due} label="Due today" hint="ready to work" />
        </div>
      </CardContent>
    </Card>
  );
}

function ExceptionTile({ icon: Icon, tone, count, label, hint }: {
  icon: any; tone: 'alert' | 'warn' | 'focus'; count: number; label: string; hint: string;
}) {
  const colour = tone === 'alert' ? 'text-[#8B3E52]' : tone === 'warn' ? 'text-[#B8862C]' : 'text-ach-navy';
  return (
    <div className="rounded-[8px] bg-white border border-ach-border/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${colour}`} />
        <div className="text-[10.5px] uppercase tracking-[1.1px] text-ach-navy/60">{label}</div>
      </div>
      <div className={`text-[22px] font-serif ${colour}`}>{count}</div>
      <div className="text-[10.5px] text-ach-navy/55">{hint}</div>
    </div>
  );
}
