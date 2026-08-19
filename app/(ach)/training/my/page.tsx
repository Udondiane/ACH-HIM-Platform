import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';

export default async function MyClassesPage() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

  // Scope to the tutor's own sessions when a real user session is present.
  // Under AUTH_DISABLED (pilot demo mode) there is no distinct user; the
  // page falls back to showing all sessions with the informational note at
  // the bottom of the render.
  const { data: { user } } = await supabase.auth.getUser();
  const tutorScope = user?.id ?? null;

  let query = supabase
    .from('training_sessions')
    .select('id, session_number, session_title, scheduled_date, scheduled_start, scheduled_end, room, tutor_name, tutor_id, status, training_programmes(id, name)')
    .gte('scheduled_date', today)
    .lte('scheduled_date', in7Days)
    .order('scheduled_date')
    .order('scheduled_start');
  if (tutorScope) {
    query = query.eq('tutor_id', tutorScope);
  }
  const { data: sessRes } = await query;

  const sessions = (sessRes as any[]) ?? [];

  // Count enrolled learners per session (via programme's enrolments).
  const programmeIds = Array.from(new Set(sessions.map(s => s.training_programmes?.id).filter(Boolean)));
  let enrolCounts = new Map<string, number>();
  if (programmeIds.length > 0) {
    const { data: enrolRes } = await supabase
      .from('training_enrolments')
      .select('programme_id')
      .in('programme_id', programmeIds)
      .eq('status', 'enrolled');
    for (const e of (enrolRes as any[]) ?? []) {
      enrolCounts.set(e.programme_id, (enrolCounts.get(e.programme_id) ?? 0) + 1);
    }
  }

  // Group by day
  const byDay = new Map<string, any[]>();
  for (const s of sessions) {
    if (!byDay.has(s.scheduled_date)) byDay.set(s.scheduled_date, []);
    byDay.get(s.scheduled_date)!.push(s);
  }

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        miniLabel="Training"
        title="My classes"
        description={`Today is ${todayLabel}. Sessions for the next 7 days.`}
      />

      {sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-10 w-10" />}
            title="No sessions in the next 7 days"
            description="Nothing scheduled. Head to Training to add a session."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(byDay.entries()).map(([day, dayS]) => {
            const isToday = day === today;
            const d = new Date(day);
            return (
              <Card key={day} className={isToday ? 'border-ach-navy/40' : undefined}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">
                        {isToday ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'long' })}
                      </div>
                      <div className="text-[15px] font-medium text-ach-navy mt-0.5">
                        {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                      </div>
                    </div>
                    <div className="text-[11.5px] text-ach-navy/60">{dayS.length} session{dayS.length === 1 ? '' : 's'}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {dayS.map(s => {
                      const enrolCount = enrolCounts.get(s.training_programmes?.id) ?? 0;
                      return (
                        <li key={s.id}>
                          <Link
                            href={`/training/sessions/${s.id}`}
                            className="block rounded-[10px] border-[0.5px] border-ach-border bg-white hover:bg-ach-page/50 px-3 py-3 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[14px] font-medium text-ach-navy leading-tight">
                                  {s.training_programmes?.name ?? 'Session'}
                                </div>
                                {s.session_title && (
                                  <div className="text-[12.5px] text-ach-navy/70 mt-0.5">{s.session_title}</div>
                                )}
                                <div className="text-[11.5px] text-ach-navy/60 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                  {s.scheduled_start && (
                                    <span>
                                      {s.scheduled_start.slice(0, 5)}
                                      {s.scheduled_end && `–${s.scheduled_end.slice(0, 5)}`}
                                    </span>
                                  )}
                                  {s.room && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.room}</span>}
                                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{enrolCount}</span>
                                </div>
                              </div>
                              <Badge>{s.status}</Badge>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!tutorScope && (
        <div className="mt-4 text-[11px] text-ach-navy/50 italic">
          Showing every session. Sign in with a tutor account to see only sessions assigned to you.
        </div>
      )}
    </div>
  );
}
