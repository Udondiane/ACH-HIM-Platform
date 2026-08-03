import { sql } from '@/lib/db';

interface Row {
  id: string;
  project_ref: string;
  name: string;
  status: string;
  funding_model: string | null;
  start_date: string | null;
  end_date: string | null;
}

export default async function ProjectsPage() {
  let rows: Row[] = [];
  let err: string | null = null;
  try {
    rows = await sql<Row>`
      SELECT id, project_ref, name, status, funding_model, start_date, end_date
      FROM projects
      ORDER BY project_ref DESC
      LIMIT 50
    `;
  } catch (e: any) { err = e?.message ?? String(e); }

  return (
    <div className="max-w-5xl">
      <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-2">Network</div>
      <h1 className="font-serif text-[32px] font-medium text-ach-navy tracking-[-0.005em] mb-6">Projects</h1>

      {err && (
        <div className="bg-ach-rose/10 border border-ach-rose/30 rounded-[6px] p-4 text-[13px] text-[#8B3A4F] mb-4">
          Database error: <code className="font-mono text-[11.5px]">{err}</code>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white border border-ach-border rounded-[6px] p-8 text-center text-ach-navy/55 italic">
          No projects yet. Seed the database or create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map(r => (
            <div key={r.id} className="bg-white border border-ach-border rounded-[6px] p-4">
              <div className="text-[11px] font-mono text-ach-navy/55">{r.project_ref}</div>
              <div className="text-[15px] font-medium text-ach-navy mt-1">{r.name}</div>
              <div className="flex items-center gap-2 mt-3 text-[11.5px] text-ach-navy/60">
                <span className="uppercase tracking-[1px] font-mono text-[10.5px] px-2 py-0.5 bg-ach-page rounded-full border border-ach-border">
                  {r.status}
                </span>
                {r.funding_model && <span>{r.funding_model}</span>}
                {r.start_date && <span>· from {new Date(r.start_date).toLocaleDateString('en-GB')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
