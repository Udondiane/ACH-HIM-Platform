import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function SessionsListPage({ searchParams }: { searchParams?: { view?: string } }) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const showPast = searchParams?.view === 'past';

  const query = supabase
    .from('training_sessions')
    .select('id, scheduled_date, scheduled_start, room, tutor_name, status, session_number, session_title, training_programmes(id, name)');

  const { data: sessRes } = showPast
    ? await query.lt('scheduled_date', today).order('scheduled_date', { ascending: false }).limit(100)
    : await query.gte('scheduled_date', today).order('scheduled_date');

  const sessions = (sessRes as any[]) ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        backHref="/training"
        backLabel="Training"
        miniLabel="Sessions"
        title={showPast ? 'Past sessions' : 'Upcoming sessions'}
        actions={
          <div className="flex items-center gap-2">
            <Link href={showPast ? '/training/sessions' : '/training/sessions?view=past'} className="text-[12.5px] text-ach-navy/70 underline underline-offset-2">
              {showPast ? 'Upcoming' : 'Past'}
            </Link>
            <Link href="/training/sessions/new">
              <Button><Plus className="h-4 w-4" />Schedule session</Button>
            </Link>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-4">
          {sessions.length === 0 ? (
            <div className="text-[13px] text-ach-navy/60 py-6 text-center">
              No {showPast ? 'past' : 'upcoming'} sessions.
            </div>
          ) : (
            <ul className="text-[13px] divide-y divide-ach-border">
              {sessions.map(s => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <Link href={`/training/sessions/${s.id}`} className="min-w-0 flex-1 hover:bg-ach-page/30 -mx-2 px-2 py-1 rounded-[8px]">
                    <div className="text-ach-navy font-medium">
                      {s.training_programmes?.name ?? 'Session'}
                      {s.session_number && <span className="text-ach-navy/50 font-normal"> · #{s.session_number}</span>}
                    </div>
                    <div className="text-[11.5px] text-ach-navy/60 mt-0.5">
                      {new Date(s.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      {s.scheduled_start && ` · ${s.scheduled_start.slice(0, 5)}`}
                      {s.room && ` · ${s.room}`}
                      {s.tutor_name && ` · ${s.tutor_name}`}
                    </div>
                  </Link>
                  <Badge>{s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
