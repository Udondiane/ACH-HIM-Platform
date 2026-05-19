'use client';

import { useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import {
  linkPartnerToCohortAction, linkCandidateToCohortAction,
  unlinkPartnerFromCohortAction, unlinkCandidateFromCohortAction,
} from '@/lib/cohorts/actions';
import { PARTNER_TYPE_LABELS } from '@/lib/partners/schema';

// ─── Link partner to cohort ────────────────────────────────
interface LinkPartnerProps {
  cohortId: string;
  availablePartners: { id: string; name: string; type: string; status: string }[];
}

export function LinkPartnerToCohort({ cohortId, availablePartners }: LinkPartnerProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [partnerId, setPartnerId] = useState<string>('');
  const [sponsorshipCount, setSponsorshipCount] = useState<number>(0);
  const [engagementFee, setEngagementFee] = useState<number>(0);
  const [isLead, setIsLead] = useState(false);

  const reset = () => {
    setPartnerId(''); setSponsorshipCount(0); setEngagementFee(0); setIsLead(false);
  };

  const submit = () => {
    if (!partnerId) return;
    startTransition(async () => {
      await linkPartnerToCohortAction(
        cohortId, partnerId, sponsorshipCount, engagementFee, isLead,
      );
      reset();
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={availablePartners.length === 0}>
          <Plus className="h-3.5 w-3.5" />Link partner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a partner to this cohort</DialogTitle>
          <DialogDescription>
            Capture the sponsorship commitment and engagement fee. You can edit these later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Partner</Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger><SelectValue placeholder="Choose a partner" /></SelectTrigger>
              <SelectContent>
                {availablePartners.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {PARTNER_TYPE_LABELS[p.type as keyof typeof PARTNER_TYPE_LABELS] ?? p.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sponsorships</Label>
              <Input
                type="number" min={0} value={sponsorshipCount}
                onChange={e => setSponsorshipCount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Engagement fee (£)</Label>
              <Input
                type="number" min={0} step="0.01" value={engagementFee}
                onChange={e => setEngagementFee(Number(e.target.value))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-ach-navy/80 cursor-pointer">
            <input
              type="checkbox" checked={isLead}
              onChange={e => setIsLead(e.target.checked)}
              className="h-4 w-4 rounded border-ach-border"
            />
            Lead partner (relevant for single-partner cohorts)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !partnerId}>
            {pending ? 'Linking…' : 'Link partner'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Link candidate to cohort ──────────────────────────────
interface LinkCandidateProps {
  cohortId: string;
  availableCandidates: { id: string; candidate_ref: string; given_name: string; status: string }[];
  cohortPartners: { partner_id: string; partners?: { name: string } | null }[];
}

export function LinkCandidateToCohort({
  cohortId, availableCandidates, cohortPartners,
}: LinkCandidateProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [candidateId, setCandidateId] = useState<string>('');
  const [sponsorId, setSponsorId] = useState<string>('__none');

  const submit = () => {
    if (!candidateId) return;
    startTransition(async () => {
      await linkCandidateToCohortAction(
        cohortId,
        candidateId,
        sponsorId === '__none' ? null : sponsorId,
      );
      setCandidateId(''); setSponsorId('__none');
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={availableCandidates.length === 0}>
          <Plus className="h-3.5 w-3.5" />Enrol candidate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enrol a candidate in this cohort</DialogTitle>
          <DialogDescription>
            Optionally tie the candidate to a specific sponsoring partner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Candidate</Label>
            <Select value={candidateId} onValueChange={setCandidateId}>
              <SelectTrigger><SelectValue placeholder="Choose a candidate" /></SelectTrigger>
              <SelectContent>
                {availableCandidates.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.candidate_ref} · {c.given_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Sponsoring partner (optional)</Label>
            <Select value={sponsorId} onValueChange={setSponsorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No specific sponsor</SelectItem>
                {cohortPartners.map(cp => (
                  <SelectItem key={cp.partner_id} value={cp.partner_id}>
                    {cp.partners?.name ?? cp.partner_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !candidateId}>
            {pending ? 'Enrolling…' : 'Enrol candidate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Unlink row (used in tables) ───────────────────────────
export function UnlinkRow({ kind, id, cohortId }: {
  kind: 'partner' | 'candidate'; id: string; cohortId: string;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm(`Remove this ${kind} from the cohort?`)) return;
    startTransition(async () => {
      if (kind === 'partner') {
        await unlinkPartnerFromCohortAction(id, cohortId);
      } else {
        await unlinkCandidateFromCohortAction(id, cohortId);
      }
    });
  };

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="text-ach-navy/40 hover:text-[#8B3A4F] transition-colors p-1 rounded disabled:opacity-50"
      aria-label={`Remove ${kind}`}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
