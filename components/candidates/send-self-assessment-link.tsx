'use client';

import { useState, useTransition } from 'react';
import { Send, Copy, Check, MessageSquare, Mail } from 'lucide-react';
import { createSelfAssessmentTokenAction } from '@/lib/self-assessment/actions';
import {
  SELF_ASSESSMENT_TIMEPOINTS,
  SELF_ASSESSMENT_TIMEPOINT_LABELS,
  SelfAssessmentTimepoint,
} from '@/lib/self-assessment/schema';

type Project = { id: string; name: string | null; project_ref: string | null };

export function SendSelfAssessmentLink({
  candidateId,
  candidatePhone,
  candidateEmail,
  projects,
}: {
  candidateId: string;
  candidatePhone?: string | null;
  candidateEmail?: string | null;
  projects: Project[];
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? '');
  const [timepoint, setTimepoint] = useState<SelfAssessmentTimepoint>('mid_3mo');
  const [generated, setGenerated] = useState<{ url: string; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setGenerated(null);
    setCopied(false);
    setError(null);
  }

  function handleGenerate() {
    if (!projectId) {
      setError('Please pick a project.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createSelfAssessmentTokenAction({
        candidate_id: candidateId,
        project_id:   projectId,
        timepoint,
      });
      if (res.ok) {
        setGenerated({ url: res.url, expires_at: res.expires_at });
      } else {
        setError(res.error);
      }
    });
  }

  function handleCopy() {
    if (!generated) return;
    navigator.clipboard.writeText(generated.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsappMessage = generated
    ? `Hi — here is your HIM self-assessment link. It takes about 10 minutes. ${generated.url}`
    : '';
  const whatsappHref = candidatePhone && generated
    ? `https://wa.me/${candidatePhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`
    : null;
  const mailtoHref = candidateEmail && generated
    ? `mailto:${candidateEmail}?subject=${encodeURIComponent('Your HIM self-assessment link')}&body=${encodeURIComponent(whatsappMessage)}`
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-medium border-[0.5px] border-ach-border bg-white text-ach-navy hover:bg-ach-page transition-colors"
      >
        <Send className="h-3.5 w-3.5" />
        Send self-assessment link
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ach-navy/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-[14px] max-w-md w-full p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[1.2px] text-ach-navy/55">Self-assessment</div>
                <h2 className="text-[16px] font-medium text-ach-navy mt-0.5">Send link to candidate</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-ach-navy/55 hover:text-ach-navy text-[18px]">×</button>
            </div>

            {!generated ? (
              <div className="space-y-4">
                {projects.length === 0 ? (
                  <p className="text-[13px] text-ach-navy/70">
                    This candidate isn't enrolled on any project yet. Enrol them on a cohort first.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1.5">Project</label>
                      <select
                        value={projectId}
                        onChange={e => setProjectId(e.target.value)}
                        className="w-full h-10 px-3 rounded-[10px] border-[0.5px] border-ach-border bg-white text-[13.5px] text-ach-navy"
                      >
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name ?? p.project_ref ?? p.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-[1.2px] text-ach-navy/55 mb-1.5">Timepoint</label>
                      <div className="flex gap-2">
                        {SELF_ASSESSMENT_TIMEPOINTS.map(tp => (
                          <button
                            key={tp}
                            type="button"
                            onClick={() => setTimepoint(tp)}
                            className={`flex-1 h-10 px-3 rounded-[10px] text-[13px] font-medium border-[0.5px] transition-colors ${
                              timepoint === tp
                                ? 'bg-ach-navy text-ach-cream border-ach-navy'
                                : 'bg-white text-ach-navy/70 border-ach-border hover:bg-ach-page'
                            }`}
                          >
                            {SELF_ASSESSMENT_TIMEPOINT_LABELS[tp]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="text-[12px] text-[#7B2A3C] bg-[#F7E3E7] rounded-[8px] px-3 py-2">
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={pending}
                      onClick={handleGenerate}
                      className="w-full h-10 rounded-[10px] bg-ach-navy text-ach-cream text-[13.5px] font-medium disabled:opacity-50"
                    >
                      {pending ? 'Generating…' : 'Generate link'}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[10px] bg-ach-page border-[0.5px] border-ach-border p-3 text-[12.5px] text-ach-navy break-all font-mono">
                  {generated.url}
                </div>
                <div className="text-[11.5px] text-ach-navy/60">
                  Expires {new Date(generated.expires_at).toLocaleDateString('en-GB')}. Single-use.
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="h-10 rounded-[10px] border-[0.5px] border-ach-border bg-white text-ach-navy text-[12.5px] font-medium flex items-center justify-center gap-1.5 hover:bg-ach-page"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <a
                    href={whatsappHref ?? '#'}
                    target="_blank"
                    rel="noopener"
                    className={`h-10 rounded-[10px] border-[0.5px] border-ach-border bg-white text-ach-navy text-[12.5px] font-medium flex items-center justify-center gap-1.5 hover:bg-ach-page ${!whatsappHref ? 'opacity-40 pointer-events-none' : ''}`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                  <a
                    href={mailtoHref ?? '#'}
                    className={`h-10 rounded-[10px] border-[0.5px] border-ach-border bg-white text-ach-navy text-[12.5px] font-medium flex items-center justify-center gap-1.5 hover:bg-ach-page ${!mailtoHref ? 'opacity-40 pointer-events-none' : ''}`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </a>
                </div>
                {(!whatsappHref || !mailtoHref) && (
                  <div className="text-[11px] text-ach-navy/55">
                    {!candidatePhone && 'Add a phone number on the candidate to enable WhatsApp. '}
                    {!candidateEmail && 'Add an email to enable Email send.'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full h-10 rounded-[10px] border-[0.5px] border-ach-border bg-white text-ach-navy text-[13px] font-medium hover:bg-ach-page"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
