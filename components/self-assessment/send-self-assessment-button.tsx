'use client';

import { useState, useTransition } from 'react';
import { Send, Copy, Check, Loader2, X, MessageCircle, Mail } from 'lucide-react';
import { createSelfAssessmentTokenAction, type Timepoint } from '@/lib/self-assessment/actions';

interface Props {
  candidateId: string;
  candidateName: string;
  projectId: string;
  projectName: string;
  defaultPhone?: string | null;
  defaultEmail?: string | null;
}

const TIMEPOINTS: { id: Timepoint; label: string }[] = [
  { id: 'baseline',      label: 'Baseline' },
  { id: 'mid_3mo',       label: '3 months' },
  { id: 'exit_6mo',      label: '6 months (exit)' },
  { id: 'followup_12mo', label: '12 months' },
];

/**
 * Staff-side "Send self-assessment link" affordance for the candidate
 * detail page. Generates a token via createSelfAssessmentTokenAction,
 * then offers three shareable formats:
 *   - WhatsApp (opens WhatsApp with the message pre-filled to the
 *     candidate's number if we have one)
 *   - Email (opens the default mail client with subject + body)
 *   - Copy link (paste anywhere)
 */
export function SendSelfAssessmentButton({
  candidateId, candidateName, projectId, projectName, defaultPhone, defaultEmail,
}: Props) {
  const [open, setOpen] = useState(false);
  const [timepoint, setTimepoint] = useState<Timepoint>('mid_3mo');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    setError(null);
    setUrl(null);
    startTransition(async () => {
      const res = await createSelfAssessmentTokenAction({
        candidateId, projectId, timepoint,
      });
      if (res.ok) setUrl(res.url);
      else setError(res.error);
    });
  };

  const message = url
    ? `Hi ${candidateName.split(' ')[0]}, ACH would love to hear how ${projectName} has been for you. Tap this link to share your reflection — it takes a few minutes and you can type or speak your answer: ${url}`
    : '';

  const waHref = url
    ? `https://wa.me/${defaultPhone ? normalisePhoneForWa(defaultPhone) : ''}?text=${encodeURIComponent(message)}`
    : '';
  const mailtoHref = url && defaultEmail
    ? `mailto:${defaultEmail}?subject=${encodeURIComponent('Your ACH reflection link')}&body=${encodeURIComponent(message)}`
    : '';

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no-op */ }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-1.5 text-[12px] text-ach-navy hover:bg-ach-page"
      >
        <Send className="h-3.5 w-3.5" />
        Send self-assessment link
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-[12px] p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Send self-assessment link</div>
              <button onClick={() => setOpen(false)} className="text-ach-navy/50 hover:text-ach-navy">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[12.5px] text-ach-navy/75 mb-4">
              Generate a link {candidateName} can open on their phone to answer the closing reflection question. Link works once and expires in 14 days.
            </p>

            <label className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-2 block">Timepoint</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {TIMEPOINTS.map(t => (
                <label
                  key={t.id}
                  className={`flex items-center gap-2 p-2.5 rounded-[10px] border-[0.5px] cursor-pointer ${
                    timepoint === t.id
                      ? 'border-ach-navy bg-ach-navy text-ach-cream'
                      : 'border-ach-border bg-white text-ach-navy/80 hover:bg-ach-page'
                  }`}
                >
                  <input
                    type="radio"
                    name="timepoint"
                    value={t.id}
                    checked={timepoint === t.id}
                    onChange={() => setTimepoint(t.id)}
                    className="sr-only"
                  />
                  <span className="text-[12.5px]">{t.label}</span>
                </label>
              ))}
            </div>

            {!url ? (
              <button
                type="button"
                onClick={generate}
                disabled={pending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] bg-ach-navy text-ach-cream px-4 py-2.5 text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {pending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</> : 'Generate link'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-[8px] border-[0.5px] border-ach-border bg-ach-page/40 p-2.5">
                  <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1">Link (single-use, 14 days)</div>
                  <div className="text-[11.5px] font-mono text-ach-navy [overflow-wrap:anywhere]">{url}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#25D366] text-white px-4 py-2.5 text-[13px] font-medium hover:opacity-90"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {defaultPhone ? 'Share on WhatsApp' : 'Open WhatsApp (pick a contact)'}
                  </a>
                  {defaultEmail && (
                    <a
                      href={mailtoHref}
                      className="inline-flex items-center justify-center gap-2 rounded-[10px] border-[0.5px] border-ach-border bg-white text-ach-navy px-4 py-2.5 text-[13px] font-medium hover:bg-ach-page"
                    >
                      <Mail className="h-4 w-4" />
                      Email to {defaultEmail}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center justify-center gap-2 rounded-[10px] border-[0.5px] border-ach-border bg-white text-ach-navy px-4 py-2.5 text-[13px] font-medium hover:bg-ach-page"
                  >
                    {copied ? <><Check className="h-4 w-4 text-emerald-700" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 text-[12px] text-[#8B3A4F]">{error}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** WhatsApp click-to-chat expects digits only, no leading + or 0.
 *  UK numbers: strip leading 0 and prepend 44 if not already
 *  international. */
function normalisePhoneForWa(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return `44${digits.slice(1)}`;
  return digits;
}
