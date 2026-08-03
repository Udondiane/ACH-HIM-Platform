import Link from 'next/link';
import { sql } from '@/lib/db';

interface Row {
  id: string;
  candidate_ref: string;
  given_name: string | null;
  family_name: string | null;
  country_of_origin: string | null;
  status: string;
}

export default async function BeneficiariesPage() {
  let rows: Row[] = [];
  let err: string | null = null;
  try {
    rows = await sql<Row>`
      SELECT id, candidate_ref, given_name, family_name, country_of_origin, status
      FROM candidates
      ORDER BY candidate_ref
      LIMIT 100
    `;
  } catch (e: any) { err = e?.message ?? String(e); }

  return (
    <div className="max-w-5xl">
      <div className="text-[10.5px] uppercase tracking-[1.8px] text-ach-navy/55 font-mono mb-2">Network</div>
      <h1 className="font-serif text-[32px] font-medium text-ach-navy tracking-[-0.005em] mb-6">Beneficiaries</h1>

      {err && (
        <div className="bg-ach-rose/10 border border-ach-rose/30 rounded-[6px] p-4 text-[13px] text-[#8B3A4F] mb-4">
          Database error: <code className="font-mono text-[11.5px]">{err}</code>
        </div>
      )}

      <div className="bg-white border border-ach-border rounded-[6px] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-ach-page/50">
            <tr className="text-[10.5px] uppercase tracking-[1.2px] font-mono text-ach-navy/55">
              <th className="text-left px-4 py-2.5">Ref</th>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Country of origin</th>
              <th className="text-left px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ach-navy/55 italic">
                  No beneficiaries yet. Add one via the API or seed the database.
                </td>
              </tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-t border-ach-border/70 hover:bg-ach-page/40">
                <td className="px-4 py-2.5 font-mono text-[11.5px] text-ach-navy/70">{r.candidate_ref}</td>
                <td className="px-4 py-2.5 text-ach-navy">
                  {[r.given_name, r.family_name].filter(Boolean).join(' ') || <span className="italic text-ach-navy/45">—</span>}
                </td>
                <td className="px-4 py-2.5 text-ach-navy/70">{r.country_of_origin ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-ach-page border border-ach-border text-ach-navy/80 font-mono uppercase tracking-[0.6px]">
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-[11.5px] text-ach-navy/55">
        Showing first 100 rows. <Link href="/dashboard" className="underline underline-offset-2 hover:text-ach-navy">Back to dashboard</Link>
      </div>
    </div>
  );
}
