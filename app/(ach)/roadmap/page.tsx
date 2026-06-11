import { CheckCircle2, Wrench, Lock, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export const dynamic = 'force-static';

type Status = 'available' | 'in_development' | 'requires_ach_setup';

interface Feature {
  label: string;
  status: Status;
  note?: string;
}

interface Section {
  product: 'Evaluation Surface' | 'Impact Tracker' | 'Governance & Infrastructure';
  description: string;
  features: Feature[];
}

const ROADMAP: Section[] = [
  {
    product: 'Evaluation Surface',
    description: 'The planning tool. Used to design measurement for any ACH project. No real beneficiary data. Available to all staff today.',
    features: [
      { label: 'Project design (capability domains, activities)', status: 'available' },
      { label: 'Auto-derived measurement set from activities ticked', status: 'available' },
      { label: 'HIM methodology hub — domains, factors, timepoints, types', status: 'available' },
      { label: 'Theory of Change explorer (ACH Service Users + Wider Systems Change)', status: 'in_development', note: 'Browse-only view now; mapping projects → ToC nodes coming' },
      { label: 'Glossary of HIM terms', status: 'available' },
      { label: 'Standalone assessment question preview (without running a real assessment)', status: 'in_development' },
      { label: 'Measurement Plan PDF export', status: 'in_development' },
      { label: 'Public deployment as a separate sharable URL', status: 'in_development', note: 'Currently lives inside the gated app' },
    ],
  },
  {
    product: 'Impact Tracker',
    description: 'The live delivery platform. Real beneficiary data, real outcomes, real funder reporting. IKEA pilot uses this from July 2026.',
    features: [
      { label: 'Beneficiary intake with data collection consent', status: 'available' },
      { label: 'Cohort creation, enrolment, partner linkage', status: 'available' },
      { label: 'Live HIM assessments — 4 timepoints, activity-driven factors', status: 'available' },
      { label: 'Training delivery + bulk attendance roster', status: 'available' },
      { label: 'Support log (IAG, casework, follow-ups)', status: 'available' },
      { label: 'Interview pipeline (ACH selection + partner interviews)', status: 'available' },
      { label: 'Placement creation + auto-generated retention milestones', status: 'available' },
      { label: 'Workforce-anchored timepoints (placement-date driven)', status: 'available' },
      { label: 'Per-role dashboards (adviser / tutor / specialist / engagement)', status: 'available' },
      { label: 'Partner management (workforce, capability investor, training, grant funder)', status: 'available' },
      { label: 'Partner portal (workforce + capability investor)', status: 'available' },
      { label: 'Audio recording consent + Whisper transcription', status: 'available', note: 'Requires Azure OpenAI configuration' },
      { label: 'Capability Investor Report (per cohort)', status: 'available' },
      { label: 'Aggregate / network-level capability radar', status: 'available' },
      { label: 'TOMs crosswalk for social value reporting', status: 'available' },
      { label: 'Funder-specific report templates (Comic Relief, WMCA, lottery funders)', status: 'in_development' },
      { label: 'Household Impact strand (optional secondary measurement for candidates with dependents)', status: 'in_development', note: 'Per IKEA / Hiliary Jenkins ask, pending Aston methodology review' },
      { label: 'Rubbixx integration (housing data)', status: 'requires_ach_setup', note: 'IT to confirm API access on ACH\'s Rubbixx plan' },
    ],
  },
  {
    product: 'Governance & Infrastructure',
    description: 'Organisational scaffolding required before the Impact Tracker can hold real refugee beneficiary data. ACH IT, Legal, and DPO lead. Not a build problem — a process and approval problem.',
    features: [
      { label: 'DPIA approved by ACH DPO', status: 'requires_ach_setup' },
      { label: 'Data Processing Agreements signed with Supabase + Vercel', status: 'requires_ach_setup' },
      { label: 'Microsoft 365 SSO integration', status: 'requires_ach_setup' },
      { label: 'Role-based access control (RBAC) enforcement', status: 'requires_ach_setup', note: 'Roles exist as UI labels; RLS policies to be configured' },
      { label: 'Multi-factor authentication enforced on every account', status: 'requires_ach_setup' },
      { label: 'Audit logging for sensitive data access + exports', status: 'in_development', note: 'Supabase logs writes; dedicated audit trail still to be built' },
      { label: 'Documented Subject Access Request + deletion process', status: 'requires_ach_setup' },
      { label: 'Documented breach notification runbook (72-hour ICO window)', status: 'requires_ach_setup' },
      { label: 'Backup + Disaster Recovery runbook', status: 'requires_ach_setup' },
      { label: 'Microsoft Tech for Social Impact verification (90% Azure discount)', status: 'requires_ach_setup' },
      { label: 'Azure UK South migration (post-pilot)', status: 'requires_ach_setup' },
      { label: 'Transition of repo, Vercel, Supabase ownership to ACH', status: 'requires_ach_setup', note: 'Currently lives on personal accounts from the KTP build phase' },
      { label: 'Security audit + penetration test', status: 'requires_ach_setup' },
      { label: 'Accessibility audit (WCAG 2.2 AA)', status: 'requires_ach_setup' },
    ],
  },
];

const STATUS_META: Record<Status, { label: string; icon: React.ElementType; cls: string }> = {
  available: {
    label: 'Available',
    icon: CheckCircle2,
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  in_development: {
    label: 'In development',
    icon: Wrench,
    cls: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  requires_ach_setup: {
    label: 'Requires ACH setup',
    icon: Lock,
    cls: 'bg-ach-slate-tint text-ach-slate-deep border-ach-slate-blue/30',
  },
};

export default function RoadmapPage() {
  const totals = ROADMAP.reduce(
    (acc, section) => {
      for (const f of section.features) acc[f.status] += 1;
      return acc;
    },
    { available: 0, in_development: 0, requires_ach_setup: 0 } as Record<Status, number>,
  );

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        miniLabel="Status"
        title="Roadmap & feature status"
        description="Every feature in the platform, grouped by which product it belongs to and what its current status is. Two products: the Evaluation Surface for planning, the Impact Tracker for live delivery. Plus the governance scaffolding that the Impact Tracker depends on."
      />

      <Card className="mb-5">
        <CardContent className="pt-5">
          <div className="grid grid-cols-3 gap-3">
            <StatTile status="available" count={totals.available} />
            <StatTile status="in_development" count={totals.in_development} />
            <StatTile status="requires_ach_setup" count={totals.requires_ach_setup} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {ROADMAP.map(section => (
          <Card key={section.product}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-ach-navy/60" />
                <div className="text-[15px] font-medium text-ach-navy">{section.product}</div>
              </div>
              <div className="text-[12.5px] text-ach-navy/65 mt-1">{section.description}</div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {section.features.map(f => {
                  const meta = STATUS_META[f.status];
                  const Icon = meta.icon;
                  return (
                    <div key={f.label} className="flex items-start justify-between gap-3 p-2.5 rounded-[10px] border-[0.5px] border-ach-border bg-white">
                      <div className="min-w-0">
                        <div className="text-[13px] text-ach-navy">{f.label}</div>
                        {f.note && (
                          <div className="text-[11.5px] text-ach-navy/55 mt-0.5">{f.note}</div>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[1.2px] font-medium rounded-full px-2 py-0.5 border-[0.5px] shrink-0 ${meta.cls}`}>
                        <Icon className="h-3 w-3" />{meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">How to read this</div>
        </CardHeader>
        <CardContent className="text-[13px] text-ach-navy/80 space-y-2">
          <p>
            <span className="font-medium text-emerald-800">Available</span> — works today. You can use this feature now.
          </p>
          <p>
            <span className="font-medium text-amber-900">In development</span> — being built. Live within the next 1–8 weeks depending on priority.
          </p>
          <p>
            <span className="font-medium text-ach-slate-deep">Requires ACH setup</span> — the platform supports it, but ACH needs to complete an organisational step before it can be activated. IT, DPO, Legal, or leadership-level approvals.
          </p>
          <p className="pt-2 text-[12px] text-ach-navy/65">
            The pilot with IKEA in July 2026 needs every Impact Tracker feature marked <span className="text-emerald-800 font-medium">Available</span> plus the Governance items resolved. The Evaluation Surface is independently usable from now.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ status, count }: { status: Status; count: number }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <div className={`rounded-[10px] border-[0.5px] p-3 ${meta.cls}`}>
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[1.2px] font-medium">
        <Icon className="h-3 w-3" />{meta.label}
      </div>
      <div className="text-[26px] font-medium mt-1 tabular-nums leading-none">{count}</div>
    </div>
  );
}
