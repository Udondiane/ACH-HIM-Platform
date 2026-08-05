'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { savePartnerGrowthObservationAction, savePlacementOfferAction } from '@/lib/partner-timepoints/actions';

const GROWTH_OPTS = [
  { value: 'declined', label: 'Declined' },
  { value: 'no_change', label: 'No change' },
  { value: 'some', label: 'Some growth' },
  { value: 'clear', label: 'Clear growth' },
  { value: 'significant', label: 'Significant growth' },
];

const TASK_OPTS = [
  { value: 'below', label: 'Below expectations' },
  { value: 'meeting', label: 'Meeting expectations' },
  { value: 'exceeding', label: 'Exceeding expectations' },
];

const OFFER_OPTS = [
  { value: 'permanent', label: 'Permanent offer' },
  { value: 'fixed_term_extension', label: 'Fixed-term extension' },
  { value: 'apprenticeship', label: 'Apprenticeship' },
  { value: 'placement_ends', label: 'Placement ends — no further offer' },
  { value: 'none', label: 'No offer decision made' },
];

const RESPONSE_OPTS = [
  { value: '', label: '— select if offer made —' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'no_response', label: 'No response from candidate' },
  { value: 'not_applicable', label: 'Not applicable' },
];

interface Props {
  placementId: string;
  initialGrowth: Record<string, unknown> | null;
  initialOffer: Record<string, unknown> | null;
}

export function PartnerExitForm({ placementId, initialGrowth, initialOffer }: Props) {
  const g = (initialGrowth ?? {}) as Record<string, string | boolean | null>;
  const o = (initialOffer ?? {}) as Record<string, string | null>;

  const [languageGrowth, setLanguageGrowth]         = useState<string>((g.language_growth as string) ?? '');
  const [peerGrowth, setPeerGrowth]                 = useState<string>((g.peer_networks_growth as string) ?? '');
  const [selfEffGrowth, setSelfEffGrowth]           = useState<string>((g.self_efficacy_growth as string) ?? '');
  const [workplaceGrowth, setWorkplaceGrowth]       = useState<string>((g.workplace_norms_growth as string) ?? '');
  const [taskPerf, setTaskPerf]                     = useState<string>((g.task_performance as string) ?? '');
  const [whatStoodOut, setWhatStoodOut]             = useState<string>((g.what_stood_out as string) ?? '');
  const [deiFlag, setDeiFlag]                       = useState<string>(g.dei_target_contribution === true ? 'yes' : g.dei_target_contribution === false ? 'no' : '');
  const [deiNote, setDeiNote]                       = useState<string>((g.dei_target_note as string) ?? '');

  const [offerType, setOfferType]                   = useState<string>((o.offer_type as string) ?? '');
  const [offerReason, setOfferReason]               = useState<string>((o.offer_reason as string) ?? '');
  const [candidateResponse, setCandidateResponse]   = useState<string>((o.candidate_response as string) ?? '');

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setMsg(null);
    startTransition(async () => {
      const growthRes = await savePartnerGrowthObservationAction({
        placementId,
        timepoint: 'exit_3mo',
        languageGrowth: languageGrowth || null,
        peerNetworksGrowth: peerGrowth || null,
        selfEfficacyGrowth: selfEffGrowth || null,
        workplaceNormsGrowth: workplaceGrowth || null,
        taskPerformance: taskPerf || null,
        whatStoodOut: whatStoodOut || null,
        deiTargetContribution: deiFlag === 'yes' ? true : deiFlag === 'no' ? false : null,
        deiTargetNote: deiNote || null,
      });
      if (!growthRes.ok) { setMsg({ ok: false, text: growthRes.error }); return; }

      if (offerType) {
        const offerRes = await savePlacementOfferAction({
          placementId,
          offerType: offerType as 'permanent' | 'fixed_term_extension' | 'apprenticeship' | 'placement_ends' | 'none',
          offerReason: offerReason || null,
          candidateResponse: candidateResponse ? (candidateResponse as 'accepted' | 'declined' | 'no_response' | 'not_applicable') : null,
        });
        if (!offerRes.ok) { setMsg({ ok: false, text: offerRes.error }); return; }
      }

      setMsg({ ok: true, text: 'Saved.' });
    });
  };

  return (
    <div className="space-y-4">
      <Section title="Growth observations (Day 1 → today)">
        <RatingRow label="Language in use at work" value={languageGrowth} onChange={setLanguageGrowth} opts={GROWTH_OPTS} />
        <RatingRow label="Peer connections at work" value={peerGrowth} onChange={setPeerGrowth} opts={GROWTH_OPTS} />
        <RatingRow label="Self-efficacy (approach to difficulty)" value={selfEffGrowth} onChange={setSelfEffGrowth} opts={GROWTH_OPTS} />
        <RatingRow label="Fit with IKEA culture and expectations" value={workplaceGrowth} onChange={setWorkplaceGrowth} opts={GROWTH_OPTS} />
      </Section>

      <Section title="Task performance">
        <RatingRow label="Against role expectations" value={taskPerf} onChange={setTaskPerf} opts={TASK_OPTS} />
      </Section>

      <Section title="What stood out about this candidate">
        <textarea
          value={whatStoodOut}
          onChange={e => setWhatStoodOut(e.target.value)}
          rows={2}
          placeholder="One sentence — a specific example, perspective, or contribution."
          className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
        />
      </Section>

      <Section title="DEI / CSR target contribution">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="radio" name="dei" value="yes" checked={deiFlag === 'yes'} onChange={e => setDeiFlag(e.target.value)} />
            Yes
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="radio" name="dei" value="no" checked={deiFlag === 'no'} onChange={e => setDeiFlag(e.target.value)} />
            No
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="radio" name="dei" value="" checked={deiFlag === ''} onChange={e => setDeiFlag(e.target.value)} />
            Not applicable
          </label>
        </div>
        {deiFlag === 'yes' && (
          <input
            value={deiNote}
            onChange={e => setDeiNote(e.target.value)}
            placeholder="Which target? (optional)"
            className="mt-2 w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
          />
        )}
      </Section>

      <Section title="Exit decision">
        <select
          value={offerType}
          onChange={e => setOfferType(e.target.value)}
          className="w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
        >
          <option value="">— select decision —</option>
          {OFFER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {offerType && (
          <>
            <input
              value={offerReason}
              onChange={e => setOfferReason(e.target.value)}
              placeholder="Brief reason (optional)"
              className="mt-2 w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[12.5px] text-ach-navy placeholder:text-ach-navy/40 focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
            />
            <select
              value={candidateResponse}
              onChange={e => setCandidateResponse(e.target.value)}
              className="mt-2 w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy focus:outline-none focus:ring-1 focus:ring-ach-navy/40"
            >
              {RESPONSE_OPTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </>
        )}
      </Section>

      {msg && (
        <div className={`flex items-center gap-2 text-[12.5px] ${msg.ok ? 'text-emerald-800' : 'text-[#8B3A4F]'}`}>
          {msg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {msg.text}
        </div>
      )}

      <div className="pt-1">
        <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : 'Save exit report'}</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2">{title}</div>
      {children}
    </div>
  );
}

function RatingRow({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: { value: string; label: string }[] }) {
  return (
    <div className="mb-2">
      <div className="text-[12.5px] text-ach-navy mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 rounded-[8px] text-[11.5px] border-[0.5px] ${
              value === o.value
                ? 'bg-ach-navy text-ach-cream border-ach-navy'
                : 'bg-white text-ach-navy/65 border-ach-border hover:bg-ach-page'
            }`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );
}
