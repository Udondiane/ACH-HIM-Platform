import Link from 'next/link';
import { Download, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PROGRAMME_CATEGORY_LABELS } from '@/lib/training/schema';

export const dynamic = 'force-dynamic';

interface ProgrammeStats {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  status: string;
  enrolled: number;
  completed: number;
  withdrawn: number;
  waiting: number;
  totalSessions: number;
  deliveredSessions: number;
  avgAttendancePct: number;
  certificatesIssued: number;
}

export default async function TrainingReportsPage() {
  const supabase = createClient();

  const [progRes, enrolRes, sessRes, attRes, certRes] = await Promise.all([
    supabase.from('training_programmes').select('id, name, code, category, status'),
    supabase.from('training_enrolments').select('programme_id, status'),
    supabase.from('training_sessions').select('id, programme_id, status'),
    supabase.from('training_attendance').select('candidate_id, status, session_id, training_sessions!inner(programme_id)'),
    supabase.from('training_certificates').select('programme_id'),
  ]);

  const programmes = (progRes.data as any[]) ?? [];
  const enrolments = (enrolRes.data as any[]) ?? [];
  const sessions = (sessRes.data as any[]) ?? [];
  const attendance = (attRes.data as any[]) ?? [];
  const certificates = (certRes.data as any[]) ?? [];

  const stats: ProgrammeStats[] = programmes.map(p => {
    const pEnrols = enrolments.filter(e => e.programme_id === p.id);
    const pSessions = sessions.filter(s => s.programme_id === p.id);
    const pAtt = attendance.filter(a => a.training_sessions?.programme_id === p.id);
    const pCerts = certificates.filter(c => c.programme_id === p.id);

    const sessionsWithAttendance = new Set(pAtt.map(a => a.session_id)).size;
    const presentMarks = pAtt.filter(a => a.status === 'present' || a.status === 'late').length;
    const totalPossibleMarks = sessionsWithAttendance * (pEnrols.filter(e => ['enrolled','completed'].includes(e.status)).length);
    const avgAttendancePct = totalPossibleMarks > 0 ? (presentMarks / totalPossibleMarks) * 100 : 0;

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      category: p.category,
      status: p.status,
      enrolled: pEnrols.filter(e => e.status === 'enrolled').length,
      completed: pEnrols.filter(e => e.status === 'completed').length,
      withdrawn: pEnrols.filter(e => e.status === 'withdrawn').length,
      waiting: pEnrols.filter(e => e.status === 'waiting_list').length,
      totalSessions: pSessions.length,
      deliveredSessions: pSessions.filter(s => s.status === 'delivered').length,
      avgAttendancePct,
      certificatesIssued: pCerts.length,
    };
  });

  const totals = stats.reduce((a, s) => ({
    enrolled: a.enrolled + s.enrolled,
    completed: a.completed + s.completed,
    withdrawn: a.withdrawn + s.withdrawn,
    sessions: a.sessions + s.totalSessions,
    delivered: a.delivered + s.deliveredSessions,
    certificates: a.certificates + s.certificatesIssued,
  }), { enrolled: 0, completed: 0, withdrawn: 0, sessions: 0, delivered: 0, certificates: 0 });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        backHref="/training"
        backLabel="Training"
        miniLabel="Reports"
        title="Programme performance"
        description="Delivery, attendance, completion, and certification across all training programmes."
        actions={
          <Link href="/api/training/export">
            <Button variant="secondary"><Download className="h-3.5 w-3.5" />Export CSV</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-5">
        <StatCard label="Enrolments (active)" value={totals.enrolled} />
        <StatCard label="Completed" value={totals.completed} />
        <StatCard label="Withdrawn" value={totals.withdrawn} />
        <StatCard label="Sessions scheduled" value={totals.sessions} />
        <StatCard label="Sessions delivered" value={totals.delivered} />
        <StatCard label="Certificates issued" value={totals.certificates} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-ach-navy/60" />
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Programme-level breakdown</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b-[0.5px] border-ach-border text-left">
                  <Th>Programme</Th>
                  <Th>Category</Th>
                  <Th align="right">Enrolled</Th>
                  <Th align="right">Completed</Th>
                  <Th align="right">Withdrawn</Th>
                  <Th align="right">Sessions</Th>
                  <Th align="right">Delivered</Th>
                  <Th align="right">Avg attend</Th>
                  <Th align="right">Certs</Th>
                </tr>
              </thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.id} className="border-b-[0.5px] border-ach-border last:border-0 hover:bg-ach-page/40">
                    <Td>
                      <Link href={`/training/programmes/${s.id}`} className="text-ach-navy hover:underline">
                        {s.name}
                        {s.code && <span className="text-ach-navy/50 font-normal"> · {s.code}</span>}
                      </Link>
                    </Td>
                    <Td className="text-ach-navy/70">{s.category ? PROGRAMME_CATEGORY_LABELS[s.category as keyof typeof PROGRAMME_CATEGORY_LABELS] : '—'}</Td>
                    <Td align="right" className="tabular-nums">{s.enrolled}</Td>
                    <Td align="right" className="tabular-nums">{s.completed}</Td>
                    <Td align="right" className="tabular-nums text-ach-navy/60">{s.withdrawn}</Td>
                    <Td align="right" className="tabular-nums">{s.totalSessions}</Td>
                    <Td align="right" className="tabular-nums">{s.deliveredSessions}</Td>
                    <Td align="right" className="tabular-nums">{s.avgAttendancePct.toFixed(0)}%</Td>
                    <Td align="right" className="tabular-nums">{s.certificatesIssued}</Td>
                  </tr>
                ))}
                {stats.length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-ach-navy/60">No programmes yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-3">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1">{label}</div>
      <div className="text-[20px] font-semibold text-ach-navy tabular-nums">{value}</div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`py-2 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>;
}
function Td({ children, align = 'left', className = '' }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <td className={`py-2 ${align === 'right' ? 'text-right' : ''} ${className}`}>{children}</td>;
}
