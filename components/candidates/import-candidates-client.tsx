'use client';

import { useState, useTransition } from 'react';
import { Upload, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseCsv, mapRow, type ImportRow } from '@/lib/candidates/import';
import { bulkImportCandidatesAction, previewDuplicatesAction } from '@/lib/candidates/actions';
import { Button } from '@/components/ui/button';

interface CohortOpt { id: string; label: string; }

export function ImportCandidatesClient({ cohorts, defaultCohortId }: { cohorts: CohortOpt[]; defaultCohortId?: string }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [duplicateMatches, setDuplicateMatches] = useState<Map<number, { matchRef: string; matchName: string; matchedOn: 'email' | 'phone' | 'ni' }>>(new Map());
  const [cohortId, setCohortId] = useState<string>(defaultCohortId ?? '');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ created: number; skipped: number; failed: number; failedDetails: Array<{ row: number; error: string }> } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setErr(null);
    setResult(null);
    try {
      const isXlsx = /\.xlsx$/i.test(f.name) || /\.xls$/i.test(f.name);
      let raw: Record<string, string>[];

      if (isXlsx) {
        // Parse xlsx client-side via SheetJS. Reads the first sheet,
        // uses the first row as headers, converts every cell to string
        // so downstream mapping works identically to CSV path.
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) throw new Error('The Excel file has no sheets.');
        const sheet = wb.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' }) as unknown[][];
        if (json.length === 0) throw new Error('The first sheet is empty.');
        const headers = (json[0] as unknown[]).map(h => String(h ?? '').trim());
        raw = json.slice(1).map(row => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            const v = (row as unknown[])[i];
            obj[h] = v === null || v === undefined ? '' : String(v).trim();
          });
          return obj;
        });
      } else {
        const text = await f.text();
        raw = parseCsv(text);
      }

      const mapped = raw.map(mapRow);
      setRows(mapped);
      // Start with nothing ticked — staff should consciously choose who
      // gets imported (skim the parsed rows, spot obvious mistakes) rather
      // than defaulting to "everything valid goes in". "Select all" is
      // one click away for the common case of importing the whole batch.
      setTicked(new Set());
      setDuplicateMatches(new Map());

      // Ask the server which parsed rows would collide with existing
      // candidates. Fire-and-forget: if it fails, we just proceed
      // without the warning tags (the server-side dedup still runs
      // at import time).
      const dupePayload = mapped.map(r => ({
        email: r.mapped.email ?? null,
        phone: r.mapped.phone ?? null,
        ni_number: r.mapped.ni_number ?? null,
      }));
      try {
        const res = await previewDuplicatesAction(dupePayload);
        if (res.ok) {
          const m = new Map<number, { matchRef: string; matchName: string; matchedOn: 'email' | 'phone' | 'ni' }>();
          for (const match of res.matches) {
            m.set(match.row, { matchRef: match.matchRef, matchName: match.matchName, matchedOn: match.matchedOn });
          }
          setDuplicateMatches(m);
        }
      } catch { /* silent — server dedup at import time is the backstop */ }
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
      setResult({
        created: res.created,
        skipped: res.skipped_duplicates,
        failed: res.failed.length,
        failedDetails: res.failed,
      });
      // Keep failed rows visible in the table so the user can see which
      // ones didn't land. Only clear the ticked set — a re-attempt is a
      // deliberate act. Also clear if everything succeeded.
      if (res.failed.length === 0) {
        setRows([]);
      }
      setTicked(new Set());
    });
  };

  return (
    <div className="space-y-5">
      {/* Info card removed at ACH request — the file picker below is
          self-explanatory and the template link now lives inline with
          the picker. Kept the outer div so surrounding spacing rules
          still apply consistently. */}
      <div className="flex items-center gap-2 text-[12px] text-ach-navy/60">
        <Download className="h-3.5 w-3.5" />
        <a
          href="/beneficiary-import-template.csv"
          download
          className="text-ach-navy underline underline-offset-2 hover:text-ach-navy/80"
        >
          Download the template CSV</a>
      </div>

      <div>
        <label className="inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 cursor-pointer hover:bg-ach-page">
          <Upload className="h-4 w-4 text-ach-navy/70" />
          <span className="text-[12.5px] text-ach-navy">Choose CSV or Excel file…</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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

      {rows.length > 0 && rows.filter(r => r.errors.length === 0).length === 0 && (
        <div className="rounded-[10px] border-[0.5px] border-[#8B3A4F]/30 bg-ach-rose/10 p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 text-[#8B3A4F] shrink-0" />
            <div className="text-[12.5px] text-ach-navy/80 space-y-2 flex-1">
              <p className="font-medium text-ach-navy">None of the rows imported cleanly. Most likely cause: the column headers in your file don't match what HIM recognises.</p>
              <p><strong>Columns found in your file:</strong> <span className="font-mono text-[11.5px] text-ach-navy/70">{Object.keys(rows[0]?.raw ?? {}).join(' · ') || '(no headers detected)'}</span></p>
              <p><strong>What HIM needs at minimum:</strong> a name column (e.g. "First Name" or "Given Name") and a contact column (e.g. "Email", "Phone", "Mobile").</p>
              <p>Download the template CSV above, match your file's headers to it, and re-upload.</p>
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-[12.5px] text-ach-navy/70">
              <strong>{rows.length}</strong> rows in file · <strong>{ticked.size}</strong> ticked to import · <strong>{rows.filter(r => r.errors.length > 0).length}</strong> with errors
              {duplicateMatches.size > 0 && (
                <> · <strong className="text-[#8B6D1F]">{duplicateMatches.size} possible duplicate{duplicateMatches.size === 1 ? '' : 's'}</strong></>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11.5px]">
              <button type="button" onClick={() => tickAll(true)}  className="text-ach-navy underline">Select all valid</button>
              <span className="text-ach-navy/40">·</span>
              <button type="button" onClick={() => tickAll(false)} className="text-ach-navy underline">Clear selection</button>
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
                  const dupe = duplicateMatches.get(i);
                  const on = ticked.has(i);
                  const rowBg = disabled
                    ? 'bg-ach-rose/10'
                    : dupe ? 'bg-[#E8C25E]/15' : '';
                  return (
                    <tr key={i} className={rowBg}>
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
                        ) : dupe ? (
                          <span
                            className="text-[#8B6D1F]"
                            title={`Matches existing candidate by ${dupe.matchedOn} — will be skipped if imported`}
                          >
                            Possible dupe · {dupe.matchRef}
                          </span>
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
        <div className={`rounded-[10px] border-[0.5px] p-3 text-[12.5px] ${
          result.failed > 0 && result.created === 0
            ? 'border-[#8B3A4F]/30 bg-ach-rose/10 text-[#8B3A4F]'
            : result.failed > 0
              ? 'border-[#E8C25E]/40 bg-[#E8C25E]/10 text-ach-navy'
              : 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {result.failed > 0 && result.created === 0
              ? <AlertCircle className="h-4 w-4" />
              : <CheckCircle2 className="h-4 w-4" />}
            {result.failed > 0 && result.created === 0
              ? 'Import failed'
              : result.failed > 0
                ? 'Import partially completed'
                : 'Import complete'}
          </div>
          <div className="mt-1">
            {result.created} candidate{result.created === 1 ? '' : 's'} created
            {result.skipped > 0 && ` · ${result.skipped} skipped (duplicate email or NI number)`}
            {result.failed > 0 && ` · ${result.failed} failed to import`}
          </div>
          {result.failedDetails.length > 0 && (
            <details className="mt-3 text-[12px]">
              <summary className="cursor-pointer font-medium underline underline-offset-2">
                Why {result.failed === 1 ? 'this row' : 'these rows'} failed
              </summary>
              <div className="mt-2 space-y-2">
                {(() => {
                  // Group by identical error message so the same root
                  // cause across many rows shows once, not ten times.
                  const groups = new Map<string, number[]>();
                  for (const f of result.failedDetails) {
                    if (!groups.has(f.error)) groups.set(f.error, []);
                    groups.get(f.error)!.push(f.row);
                  }
                  return Array.from(groups.entries()).map(([msg, rows]) => (
                    <div key={msg} className="rounded-[8px] bg-white/60 border-[0.5px] border-current/20 px-2.5 py-2">
                      <div className="font-mono text-[11.5px] break-words">{msg}</div>
                      <div className="text-[11px] opacity-70 mt-1">
                        Affects row{rows.length === 1 ? '' : 's'} {rows.slice(0, 20).join(', ')}
                        {rows.length > 20 && ` +${rows.length - 20} more`}
                      </div>
                      {(/column.*does not exist|schema cache|Could not find/i.test(msg)) && (
                        <div className="text-[11.5px] mt-2 pt-2 border-t border-current/15">
                          <strong>Likely cause:</strong> a database migration has not been applied.
                          The bulk import writes columns that migration 064
                          adds (email, phone, date_of_birth, gender, immigration_status, etc.).
                          If those columns aren&apos;t on the DB yet, PostgREST refuses the insert.
                          Ask your ICT team to paste the migration 064 SQL block into the
                          Supabase SQL Editor, then retry.
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
