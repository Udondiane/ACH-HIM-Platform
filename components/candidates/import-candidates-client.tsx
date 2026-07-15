'use client';

import { useState, useTransition } from 'react';
import { Upload, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { parseCsv, mapRow, type ImportRow } from '@/lib/candidates/import';
import { bulkImportCandidatesAction } from '@/lib/candidates/actions';
import { Button } from '@/components/ui/button';

interface CohortOpt { id: string; label: string; }

export function ImportCandidatesClient({ cohorts }: { cohorts: CohortOpt[] }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [cohortId, setCohortId] = useState<string>('');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ created: number; skipped: number; failed: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setErr(null);
    setResult(null);
    try {
      const text = await f.text();
      const raw = parseCsv(text);
      const mapped = raw.map(mapRow);
      setRows(mapped);
      // Auto-tick rows without blocking errors
      const auto = new Set<number>();
      mapped.forEach((r, i) => { if (r.errors.length === 0) auto.add(i); });
      setTicked(auto);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to parse file');
    }
  };

  const toggle = (i: number) => {
    setTicked(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const tickAll = (val: boolean) => {
    if (val) setTicked(new Set(rows.map((_, i) => i).filter(i => rows[i].errors.length === 0)));
    else setTicked(new Set());
  };

  const doImport = () => {
    setErr(null);
    setResult(null);
    const selected = Array.from(ticked)
      .filter(i => rows[i].errors.length === 0)
      .map(i => ({
        mapped: rows[i].mapped as Record<string, unknown>,
        application_source_data: rows[i].application_source_data,
      }));
    if (selected.length === 0) { setErr('Tick at least one row to import.'); return; }

    startTransition(async () => {
      const res = await bulkImportCandidatesAction({
        rows: selected,
        cohortId: cohortId || undefined,
      });
      if (!res.ok) { setErr(res.error); return; }
      setResult({ created: res.created, skipped: res.skipped_duplicates, failed: res.failed.length });
      // Clear the imported rows so accidental re-import is harder
      setRows([]);
      setTicked(new Set());
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[10px] border-[0.5px] border-ach-border bg-ach-page/50 p-4">
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 mt-0.5 text-ach-navy/60 shrink-0" />
          <div className="text-[12.5px] text-ach-navy/80 space-y-1">
            <p><strong>Accepts any CSV</strong> — export from MS Forms, Google Forms, Excel, whatever the application form was.</p>
            <p><strong>Only two things are required per row:</strong> a name column, and at least one contact (email or phone).</p>
            <p><strong>Any column that doesn&apos;t match a HIM field</strong> — e.g., IKEA&apos;s &ldquo;Can you commute to BS5?&rdquo; — is preserved on the candidate record as application data. Nothing is lost.</p>
          </div>
        </div>
      </div>

      <div>
        <label className="inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 cursor-pointer hover:bg-ach-page">
          <Upload className="h-4 w-4 text-ach-navy/70" />
          <span className="text-[12.5px] text-ach-navy">Choose CSV file…</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
        </label>
        {err && (
          <div className="mt-2 flex items-start gap-2 text-[12.5px] text-[#8B3A4F]">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
            <span>{err}</span>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-[12.5px] text-ach-navy/70">
              <strong>{rows.length}</strong> rows in file · <strong>{ticked.size}</strong> ticked to import · <strong>{rows.filter(r => r.errors.length > 0).length}</strong> with errors
            </div>
            <div className="flex items-center gap-2 text-[11.5px]">
              <button type="button" onClick={() => tickAll(true)}  className="text-ach-navy underline">Tick all valid</button>
              <span className="text-ach-navy/40">·</span>
              <button type="button" onClick={() => tickAll(false)} className="text-ach-navy underline">None</button>
            </div>
          </div>

          <div className="rounded-[10px] border-[0.5px] border-ach-border bg-white overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="text-left text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 border-b-[0.5px] border-ach-border sticky top-0 bg-white">
                <tr>
                  <th className="p-2 w-6"></th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">English</th>
                  <th className="p-2">Extra fields</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ach-border">
                {rows.map((r, i) => {
                  const disabled = r.errors.length > 0;
                  const on = ticked.has(i);
                  return (
                    <tr key={i} className={disabled ? 'bg-ach-rose/10' : ''}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={disabled}
                          onChange={() => toggle(i)}
                          className="h-4 w-4 rounded border-ach-border text-ach-navy focus:ring-ach-navy/40"
                        />
                      </td>
                      <td className="p-2">
                        {r.mapped.given_name || <span className="text-ach-navy/40">—</span>}
                        {r.mapped.family_name && ` ${r.mapped.family_name}`}
                      </td>
                      <td className="p-2 text-ach-navy/70">{r.mapped.email || '—'}</td>
                      <td className="p-2 text-ach-navy/70">{r.mapped.phone || '—'}</td>
                      <td className="p-2 text-ach-navy/70">{r.mapped.english_level || '—'}</td>
                      <td className="p-2 text-ach-navy/55 text-[11px]">
                        {Object.keys(r.application_source_data).length > 0
                          ? `${Object.keys(r.application_source_data).length} extras`
                          : '—'}
                      </td>
                      <td className="p-2">
                        {r.errors.length > 0 ? (
                          <span className="text-[#8B3A4F]" title={r.errors.join('; ')}>Missing required</span>
                        ) : (
                          <span className="text-emerald-800">Ready</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 block">
                Auto-enrol imported candidates into cohort (optional)
              </label>
              <select
                value={cohortId}
                onChange={e => setCohortId(e.target.value)}
                className="w-[420px] rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
              >
                <option value="">— do not auto-enrol —</option>
                {cohorts.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <Button onClick={doImport} disabled={pending || ticked.size === 0}>
              {pending ? 'Importing…' : `Import ${ticked.size} candidate${ticked.size === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      )}

      {result && (
        <div className="rounded-[10px] border-[0.5px] border-emerald-200 bg-emerald-50/60 p-3 text-[12.5px] text-emerald-900">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Import complete
          </div>
          <div className="mt-1 text-emerald-800">
            {result.created} candidate{result.created === 1 ? '' : 's'} created
            {result.skipped > 0 && ` · ${result.skipped} skipped (duplicate email or NI number)`}
            {result.failed > 0 && ` · ${result.failed} failed to import`}
          </div>
        </div>
      )}
    </div>
  );
}
