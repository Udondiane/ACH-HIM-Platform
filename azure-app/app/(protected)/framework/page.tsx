import { sql } from '@/lib/db';

interface DomainRow {
  id: string;
  name: string;
}
interface FactorRow {
  id: string;
  name: string;
  conversion_factor_type: string;
  measurement_question: string | null;
  domain_id: string;
  indicator_count: number;
}

export default async function FrameworkPage() {
  let domains: DomainRow[] = [];
  let factors: FactorRow[] = [];
  let err: string | null = null;
  try {
    domains = await sql<DomainRow>`SELECT id, name FROM domains ORDER BY sort_order`;
    factors = await sql<FactorRow>`
      SELECT f.id, f.name, f.conversion_factor_type, f.measurement_question,
             fd.domain_id,
             (SELECT count(*)::int FROM indicators i WHERE i.factor_id = f.id) AS indicator_count
      FROM factors f
      JOIN factor_domains fd ON fd.factor_id = f.id
      ORDER BY fd.domain_id, f.name
    `;
  } catch (e: any) { err = e?.message ?? String(e); }

  const byDomain: Record<string, FactorRow[]> = {};
  for (const f of factors) (byDomain[f.domain_id] ??= []).push(f);

  return (
    <div className="max-w-5xl">
      <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-2">Methodology</div>
      <h1 className="font-serif text-[32px] font-medium text-ach-navy tracking-[-0.005em] mb-6">Framework library</h1>

      {err && (
        <div className="bg-ach-rose/10 border border-ach-rose/30 rounded-[6px] p-4 text-[13px] text-[#8B3A4F] mb-4">
          Database error: <code className="font-mono text-[11.5px]">{err}</code>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Domains" value={domains.length} />
        <Stat label="Metrics" value={factors.length} />
        <Stat label="Methodology" value="HIM v1.0" />
      </div>

      {domains.map(d => {
        const facs = byDomain[d.id] ?? [];
        return (
          <section key={d.id} className="bg-white border border-ach-border rounded-[6px] p-5 mb-4">
            <div className="flex items-baseline justify-between mb-3">
              <div className="font-serif text-[19px] font-medium text-ach-navy">{d.name}</div>
              <div className="text-[10.5px] font-mono uppercase tracking-[1.4px] text-ach-navy/55">
                {facs.length} metric{facs.length === 1 ? '' : 's'}
              </div>
            </div>
            {facs.length === 0 ? (
              <div className="text-[13px] text-ach-navy/55 italic">No metrics loaded for this domain yet.</div>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                {facs.map(f => (
                  <li key={f.id} className="flex items-baseline justify-between border-b border-dotted border-ach-border/70 pb-1.5">
                    <span className="text-ach-navy">{f.name}</span>
                    <span className="text-[10.5px] font-mono text-ach-navy/50 tabular-nums shrink-0 ml-2">
                      {f.conversion_factor_type} · {f.indicator_count} ind
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-ach-border rounded-[6px] p-4">
      <div className="text-[10.5px] uppercase tracking-[1.4px] font-mono text-ach-navy/55">{label}</div>
      <div className="font-serif text-[22px] tabular-nums text-ach-navy leading-none mt-1.5">{value}</div>
    </div>
  );
}
