import Link from 'next/link';
import { Plus, GraduationCap, CalendarDays, ClipboardList, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PROGRAMME_CATEGORY_LABELS, PROGRAMME_STATUS_LABELS } from '@/lib/training/schema';

export const dynamic = 'force-dynamic';

export default async function TrainingLandingPage() {
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const in14Days = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

  const [progRes, sessRes, enrolRes] = await Promise.all([
    supabase
      .from('training_programmes')
      .select('id, name, code, category, status, total_sessions, duration_hours, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('training_sessions')
      .select('id, scheduled_date, scheduled_start, room, tutor_name, status, training_programmes(name)')
      .gte('scheduled_date', today)
      .lte('scheduled_date', in14Days)
      .order('scheduled_date'),
    supabase
      .from('training_enrolments')
      .select('id, status', { count: 'exact' })
      .eq('status', 'enrolled'),
  ]);

  const programmes = (progRes.data as any[]) ?? [];
  const upcoming = (sessRes.data as any[]) ?? [];
  const activeEnrolments = enrolRes.count ?? 0;

  const activeProgrammes = programmes.filter(p => p.status === 'active');

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        miniLabel="Training"
        title="Training programmes"
        description="Define programmes, schedule sessions, take attendance, issue certificates. Everything you deliver, in one place — linked to HIM impact."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/training/my">
              <Button variant="secondary"><ClipboardList className="h-3.5 w-3.5" />My classes</Button>
            </Link>
            <Link href="/training/sessions/new">
              <Button variant="secondary"><CalendarDays className="h-3.5 w-3.5" />Schedule session</Button>
            </Link>
            <Link href="/training/programmes/new">
              <Button><Plus className="h-4 w-4" />New programme</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Active programmes" value={activeProgrammes.length} />
        <StatCard label="Enrolled learners" value={activeEnrolments} />
        <StatCard label="Upcoming sessions (14d)" value={upcoming.length} />
        <StatCard label="Total programmes" value={programmes.length} />
      </div>

      {upcoming.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Upcoming sessions</div>
                <div className="text-[12px] text-ach-navy/55 mt-0.5">Next 14 days</div>
              </div>
              <Link href="/training/sessions" className="text-[12px] text-ach-navy/70 underline underline-offset-2">See all</Link>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="text-[13px] divide-y divide-ach-border">
              {upcoming.slice(0, 6).map(s => (
                <li key={s.id} className="py-2 flex items-center justify-between">
                  <div>
                    <Link href={`/training/sessions/${s.id}`} className="text-ach-navy font-medium hover:underline">
                      {s.training_programmes?.name ?? 'Untitled programme'}
                    </Link>
                    <div className="text-[11.5px] text-ach-navy/60 mt-0.5">
                      {new Date(s.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {s.scheduled_start && ` · ${s.scheduled_start.slice(0, 5)}`}
                      {s.room && ` · ${s.room}`}
                      {s.tutor_name && ` · ${s.tutor_name}`}
                    </div>
                  </div>
                  <Badge>{s.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">All programmes</div>
            <Link href="/training/reports" className="text-[12px] text-ach-navy/70 underline underline-offset-2 inline-flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />Reports
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {programmes.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="h-8 w-8 text-ach-navy/30 mx-auto mb-2" />
              <div className="text-[13px] text-ach-navy/70">No programmes yet.</div>
              <div className="text-[12px] text-ach-navy/55 mt-1">Create your first training programme to get started.</div>
              <div className="mt-3">
                <Link href="/training/programmes/new">
                  <Button><Plus className="h-4 w-4" />Create programme</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {programmes.map(p => (
                <Link key={p.id} href={`/training/programmes/${p.id}`}
                  className="rounded-[10px] border-[0.5px] border-ach-border bg-white hover:bg-ach-page p-3 transition-colors">
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">
                    {p.code || '—'}
                  </div>
                  <div className="text-[13.5px] font-medium text-ach-navy leading-tight mb-1">{p.name}</div>
                  <div className="text-[11.5px] text-ach-navy/60 mb-2">
                    {p.category ? PROGRAMME_CATEGORY_LABELS[p.category as keyof typeof PROGRAMME_CATEGORY_LABELS] : '—'}
                    {p.duration_hours ? ` · ${p.duration_hours}h` : ''}
                    {p.total_sessions ? ` · ${p.total_sessions} sessions` : ''}
                  </div>
                  <Badge>{PROGRAMME_STATUS_LABELS[p.status as keyof typeof PROGRAMME_STATUS_LABELS] ?? p.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-3">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">{label}</div>
      <div className="text-[22px] font-semibold text-ach-navy tabular-nums">{value}</div>
    </div>
  );
}
