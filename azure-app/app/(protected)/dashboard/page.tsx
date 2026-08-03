import { sql } from '@/lib/db';

interface DomainRow {
  id: string;
  name: string;
  metric_count: number;
}

interface Counts {
  candidates: number;
  projects: number;
  cohorts: number;
  placements: number;
}

export default async function DashboardPage() {
  // Live queries against Azure Postgres. Renders a skeleton state if
  // the DB is empty (first-run before schema seeds).
  let counts: Counts = { candidates: 0, projects: 0, cohorts: 0, placements: 0 };
  let domains: DomainRow[] = [];
  let dbError: string | null = null;

  try {
    const [c, p, co, pl] = await Promise.all([
      sql`SELECT count(*)::int AS n FROM candidates`,
      sql`SELECT count(*)::int AS n FROM projects`,
      sql`SELECT count(*)::int AS n FROM cohorts`,
      sql`SELECT count(*)::int AS n FROM placements`,
    ]);
    counts = {
      candidates:  (c[0]?.n as number) ?? 0,
      projects:    (p[0]?.n as number) ?? 0,
      cohorts:     (co[0]?.n as number) ?? 0,
      placements:  (pl[0]?.n as number) ?? 0,
    };
    domains = await sql<DomainRow>`
      SELECT d.id, d.name, count(fd.factor_id)::int AS metric_count
      FROM domains d
      LEFT JOIN factor_domains fd ON fd.domain_id = d.id
      GROUP BY d.id, d.name, d.sort_order
      ORDER BY d.sort_order
    `;
  } catch (e: any) {
    dbError = e?.message ?? String(e);
  }

  return (
    <div className="max-w-5xl">
      <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-2">
        Holistic Impact Metric
      </div>
      <h1 className="font-serif text-[32px] font-medium text-ach-navy tracking-[-0.005em] mb-8">
        Impact overview
      </h1>

      {dbError && (
        <div className="bg-ach-rose/10 border border-ach-rose/30 rounded-[6px] p-4 mb-6 text-[13px] text-[#8B3A4F]">
          <span className="font-medium">Database not reachable.</span> Configure DATABASE_URL and run{' '}
          <code className="font-mono bg-white px-1 py-0.5 rounded">psql &lt; db/schema.sql</code> against
          your Azure Postgres instance. Error: <code className="font-mono text-[11.5px]">{dbError}</code>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Kpi label="Beneficiaries" value={counts.candidates} />
        <Kpi label="Projects" value={counts.projects} />
        <Kpi label="Cohorts" value={counts.cohorts} />
        <Kpi label="Placements" value={counts.placements} />
      </div>

      <div className="bg-white border border-ach-border rounded-[6px] p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div className="font-serif text-[19px] font-medium text-ach-navy">The seven HIM domains</div>
          <div className="text-[10.5px] font-mono uppercase tracking-[1.4px] text-ach-navy/55">
            Framework · {domains.length} loaded
          </div>
        </div>
        {domains.length === 0 ? (
          <div className="text-[13px] text-ach-navy/60 italic">
            Load the framework: <code className="font-mono bg-ach-page px-1 py-0.5 rounded">psql &lt; db/framework-seed.sql</code>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {domains.map(d => (
              <li key={d.id} className="flex items-baseline justify-between px-3 py-2 rounded-[4px] bg-ach-page/40">
                <span className="text-[13.5px] text-ach-navy">{d.name}</span>
                <span className="text-[11px] font-mono text-ach-navy/60 tabular-nums">
                  {d.metric_count} metric{d.metric_count === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-ach-border rounded-[6px] p-4">
      <div className="text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/55">{label}</div>
      <div className="font-serif text-[28px] tabular-nums text-ach-navy leading-none mt-1.5">{value}</div>
    </div>
  );
}
