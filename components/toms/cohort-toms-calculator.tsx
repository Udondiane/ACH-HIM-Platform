'use client';

import { useState, useTransition } from 'react';
import { saveCohortTomsClaimAction } from '@/lib/toms/actions';

interface TomsCode {
  id: string;
  measure: string;
  unit: string | null;
  proxy_value_pence: number | null;
  play: 'QUANT' | 'QUAL';
}

interface Claim {
  toms_code: string;
  quantity: number;
  notes: string | null;
}

export function CohortTomsCalculator({
  cohortId,
  codes,
  initialClaims,
}: {
  cohortId: string;
  codes: TomsCode[];
  initialClaims: Claim[];
}) {
  const initialMap = new Map<string, { qty: number; notes: string }>();
  for (const c of initialClaims) initialMap.set(c.toms_code, { qty: Number(c.quantity), notes: c.notes ?? '' });

  const [rows, setRows] = useState<Record<string, { qty: string; notes: string; savedAt: Date | null }>>(() => {
    const o: Record<string, { qty: string; notes: string; savedAt: Date | null }> = {};
    for (const code of codes) {
      const cur = initialMap.get(code.id);
      o[code.id] = { qty: cur ? String(cur.qty) : '', notes: cur?.notes ?? '', savedAt: null };
    }
    return o;
  });
  const [pending, startTransition] = useTransition();

  const persist = (code: string) => {
    const row = rows[code];
    const qty = Number(row.qty) || 0;
    startTransition(async () => {
      await saveCohortTomsClaimAction(cohortId, code, qty, row.notes || null);
      setRows(prev => ({ ...prev, [code]: { ...prev[code], savedAt: new Date() } }));
    });
  };

  const totalGbp = codes.reduce((s, c) => {
    const qty = Number(rows[c.id]?.qty || 0);
    if (qty <= 0 || c.proxy_value_pence == null) return s;
    return s + (qty * c.proxy_value_pence / 100);
  }, 0);

  const quantTotal = codes.filter(c => c.play === 'QUANT').reduce((s, c) => {
    const qty = Number(rows[c.id]?.qty || 0);
    if (qty <= 0 || c.proxy_value_pence == null) return s;
    return s + (qty * c.proxy_value_pence / 100);
  }, 0);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Kpi label="Total £ social value (TOMs)" value={`£${Math.round(totalGbp).toLocaleString()}`} sub="2019 edition proxy values" />
        <Kpi label="Quantitative £ play" value={`£${Math.round(quantTotal).toLocaleString()}`} sub="bank with confidence" />
        <Kpi label="Codes claimed" value={String(codes.filter(c => Number(rows[c.id]?.qty || 0) > 0).length)} sub={`of ${codes.length} available`} />
      </div>

      <div className="overflow-hidden rounded-[12px] border-[0.5px] border-ach-border">
        <table className="w-full text-[12.5px]">
          <thead className="bg-ach-page border-b-[0.5px] border-ach-border">
            <tr>
              <th className="text-left px-3 py-2.5 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">NT code</th>
              <th className="text-left px-3 py-2.5 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Measure</th>
              <th className="text-left px-3 py-2.5 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Unit</th>
              <th className="text-right px-3 py-2.5 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">£ / unit</th>
              <th className="text-right px-3 py-2.5 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Quantity</th>
              <th className="text-right px-3 py-2.5 text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">£ claimed</th>
            </tr>
          </thead>
          <tbody>
            {codes.map(c => {
              const qty = Number(rows[c.id]?.qty || 0);
              const gbpPerUnit = c.proxy_value_pence != null ? c.proxy_value_pence / 100 : 0;
              const claimed = qty * gbpPerUnit;
              return (
                <tr key={c.id} className={`border-b-[0.5px] border-ach-border last:border-0 ${c.play === 'QUANT' ? '' : 'bg-ach-page/30'}`}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5">
                      <span className="text-ach-navy font-medium">{c.id}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] uppercase tracking-[1px] font-medium ${c.play === 'QUANT' ? 'bg-[#5E7A3C] text-white' : 'bg-[#F2C744] text-[#735100]'}`}>
                        {c.play}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-ach-navy/80">{c.measure}</td>
                  <td className="px-3 py-2 align-top text-ach-navy/60 text-[11.5px]">{c.unit ?? '—'}</td>
                  <td className="px-3 py-2 align-top text-right tabular-nums text-ach-navy/75">
                    {c.proxy_value_pence != null ? `£${gbpPerUnit.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={rows[c.id]?.qty ?? ''}
                      onChange={e => setRows(prev => ({ ...prev, [c.id]: { ...prev[c.id], qty: e.target.value } }))}
                      onBlur={() => persist(c.id)}
                      className="w-24 text-right rounded-[8px] border-[0.5px] border-ach-border bg-white px-2 py-1 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-right tabular-nums font-medium text-ach-navy">
                    {claimed > 0 ? `£${Math.round(claimed).toLocaleString()}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-ach-page border-t-[0.5px] border-ach-border">
            <tr>
              <td colSpan={5} className="px-3 py-2.5 text-right text-[11px] uppercase tracking-[1.2px] text-ach-navy/60 font-medium">Total</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium text-ach-navy">£{Math.round(totalGbp).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {pending && <div className="text-[11px] text-ach-navy/55 mt-2 uppercase tracking-[1.2px]">Saving…</div>}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[12px] border-[0.5px] border-ach-border bg-white p-4">
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">{label}</div>
      <div className="text-[20px] font-medium tracking-[-0.5px] text-ach-navy mt-1 tabular-nums">{value}</div>
      <div className="text-[11.5px] text-ach-navy/55 mt-1">{sub}</div>
    </div>
  );
}
