'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createQuoteAction, type ActionResult } from '@/lib/pricing/actions';
import { QUOTE_TRACKS, QUOTE_TRACK_LABELS } from '@/lib/pricing/schema';
import { calculateQuote, type PricingParameters, type QuoteInputs } from '@/lib/pricing/calculator';
import { formatGbp, formatGbpDetailed, formatPercent } from '@/lib/utils/format';

interface Props {
  partners: { id: string; name: string; type: string }[];
  cohorts: { id: string; name: string; cohort_ref: string }[];
  params: PricingParameters;
}

const TRAFFIC_TONES: Record<string, string> = {
  green: 'bg-[#3C6B47]/15 text-[#3C6B47] border-[#3C6B47]/30',
  amber: 'bg-[#E8C25E]/15 text-[#8B6914] border-[#E8C25E]/40',
  red:   'bg-[#D67890]/15 text-[#8B3A4F] border-[#D67890]/40',
};

export function QuoteForm({ partners, cohorts, params }: Props) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(createQuoteAction, null);
  const [track, setTrack] = useState<QuoteInputs['track']>('workforce_partner');
  const [candidateCount, setCandidateCount] = useState(5);
  const [hv, setHv] = useState(0);
  const [hs, setHs] = useState(3);
  const [hp, setHp] = useState(0);
  const [r6, setR6] = useState(0.7);
  const [r12, setR12] = useState(0.55);
  const [tender, setTender] = useState(0);

  const live = useMemo(() => calculateQuote(
    {
      track,
      candidate_count: candidateCount,
      expected_hires_volume: hv,
      expected_hires_standard: hs,
      expected_hires_premium: hp,
      retention_6mo_rate: r6,
      retention_12mo_rate: r12,
      tender_pack_fee: tender,
    },
    params,
  ), [track, candidateCount, hv, hs, hp, r6, r12, tender, params]);

  const fe = (k: string) => state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined;
  const isWP = track === 'workforce_partner' || track === 'direct_hirer';

  return (
    <form action={formAction} className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Partner" error={fe('partner_id')}>
            <Select name="partner_id" defaultValue="">
              <SelectTrigger><SelectValue placeholder="Select partner (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {partners.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Cohort" error={fe('cohort_id')}>
            <Select name="cohort_id" defaultValue="">
              <SelectTrigger><SelectValue placeholder="Select cohort (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {cohorts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.cohort_ref} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Track" error={fe('track')}>
          <Select name="track" value={track} onValueChange={v => setTrack(v as QuoteInputs['track'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUOTE_TRACKS.map(t => (
                <SelectItem key={t} value={t}>{QUOTE_TRACK_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Candidate count (sponsorship)" error={fe('candidate_count')}>
          <Input
            name="candidate_count"
            type="number"
            min={0}
            value={candidateCount}
            onChange={e => setCandidateCount(Math.max(0, parseInt(e.target.value || '0', 10)))}
          />
        </Field>

        {isWP && (
          <>
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 pt-2">
              Expected hires by band (memo §5)
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Volume £20–23k" error={fe('expected_hires_volume')}>
                <Input name="expected_hires_volume" type="number" min={0} value={hv} onChange={e => setHv(Math.max(0, parseInt(e.target.value || '0', 10)))} />
              </Field>
              <Field label="Standard £23–28k" error={fe('expected_hires_standard')}>
                <Input name="expected_hires_standard" type="number" min={0} value={hs} onChange={e => setHs(Math.max(0, parseInt(e.target.value || '0', 10)))} />
              </Field>
              <Field label="Premium £28k+" error={fe('expected_hires_premium')}>
                <Input name="expected_hires_premium" type="number" min={0} value={hp} onChange={e => setHp(Math.max(0, parseInt(e.target.value || '0', 10)))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Expected 6-month retention" error={fe('retention_6mo_rate')}>
                <Input name="retention_6mo_rate" type="number" step="0.05" min={0} max={1} value={r6} onChange={e => setR6(Math.min(1, Math.max(0, parseFloat(e.target.value || '0'))))} />
              </Field>
              <Field label="Expected 12-month retention" error={fe('retention_12mo_rate')}>
                <Input name="retention_12mo_rate" type="number" step="0.05" min={0} max={1} value={r12} onChange={e => setR12(Math.min(1, Math.max(0, parseFloat(e.target.value || '0'))))} />
              </Field>
            </div>
          </>
        )}
        {!isWP && (
          <>
            <input type="hidden" name="expected_hires_volume" value={0} />
            <input type="hidden" name="expected_hires_standard" value={0} />
            <input type="hidden" name="expected_hires_premium" value={0} />
            <input type="hidden" name="retention_6mo_rate" value={0} />
            <input type="hidden" name="retention_12mo_rate" value={0} />
          </>
        )}

        <Field label="Tender Support Pack fee (memo §7, £250–500)" error={fe('tender_pack_fee')}>
          <Input
            name="tender_pack_fee"
            type="number"
            min={0}
            max={500}
            value={tender}
            onChange={e => setTender(Math.max(0, parseFloat(e.target.value || '0')))}
          />
        </Field>

        <Field label="Valid until" error={fe('valid_until')}>
          <Input name="valid_until" type="date" />
        </Field>

        <Field label="Notes" error={fe('notes')}>
          <Textarea name="notes" rows={3} placeholder="Optional context for the quote" />
        </Field>

        {state && !state.ok && state.error && (
          <div className="text-[13px] text-[#8B3A4F] bg-ach-rose/10 rounded-[10px] px-3 py-2 border-[0.5px] border-ach-rose/30">
            {state.error}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <SubmitBtn>Save quote</SubmitBtn>
          <Link href="/pricing"><Button variant="ghost" type="button">Cancel</Button></Link>
        </div>
      </div>

      <aside className="bg-ach-page rounded-[14px] p-5 border-[0.5px] border-ach-border h-fit sticky top-6">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Live quote preview</div>
        <div className="text-[32px] font-medium tracking-[-0.5px] text-ach-navy mt-2 leading-none tabular-nums">
          {formatGbp(live.subtotal)}
        </div>
        <div className="mt-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px] ${TRAFFIC_TONES[live.traffic_light]}`}>
            {live.traffic_light}
          </span>
        </div>
        <dl className="mt-5 space-y-2 text-[12px]">
          <Row label="Delivery cost (internal)" value={formatGbpDetailed(live.delivery_cost_internal)} />
          <Row label="Cost-recovery floor" value={formatGbpDetailed(live.cost_recovery_floor)} />
          <Row label="Sustainability floor" value={formatGbpDetailed(live.sustainability_floor)} />
          <Row label="Margin" value={`${formatGbpDetailed(live.margin_amount)} · ${formatPercent(live.margin_pct, 1)}`} />
        </dl>
        <div className="border-t-[0.5px] border-ach-border mt-4 pt-4 space-y-1.5 text-[12px]">
          {live.lines.length === 0 ? (
            <div className="text-ach-navy/50">Add candidates or hires to see the breakdown.</div>
          ) : (
            live.lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="text-ach-navy/70 truncate">{l.label}</span>
                <span className={`tabular-nums shrink-0 ${l.line_total < 0 ? 'text-[#3C6B47]' : 'text-ach-navy'}`}>
                  {formatGbpDetailed(l.line_total)}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ach-navy/60">{label}</dt>
      <dd className="text-ach-navy tabular-nums">{value}</dd>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <div className="text-[12px] text-[#8B3A4F]">{error}</div>}
    </div>
  );
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Saving…' : children}</Button>;
}
