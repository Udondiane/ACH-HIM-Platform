import Link from 'next/link';
import { Compass, BookOpen, Activity, Clock, Layers, ArrowRight, Map } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { CAP_DOMAINS, CAP_DOMAIN_LABELS, CAP_DOMAIN_HINTS } from '@/lib/projects/schema';
import { PROGRAMME_ACTIVITIES } from '@/lib/activities/definitions';

export const dynamic = 'force-static';

const TIMEPOINTS = [
  { label: 'Baseline',           description: 'At intake. Anchors every later measurement.' },
  { label: 'End of placement',   description: 'For workforce programmes: ~3 months after placement starts.' },
  { label: '6-month retention',  description: '6 months after placement starts (or intervention start for non-placement programmes).' },
  { label: '12-month retention', description: '12 months after placement starts. Tests whether change held.' },
];

const FACTOR_TYPES = [
  { id: 'personal',      label: 'Personal',      description: 'Within the candidate — skills, confidence, motivation, language. What training and coaching directly shift.' },
  { id: 'social',        label: 'Social',        description: 'Relationships and networks — peer support, mentors, trust in services. What community and connection shift.' },
  { id: 'environmental', label: 'Environmental', description: 'Systems and context — workplace inclusion, legal status, access. What policy and employer practice shift.' },
];

export default function MethodologyHubPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        miniLabel="Evaluation Surface"
        title="HIM methodology"
        description="The Holistic Impact Metric framework — how ACH measures change for refugee beneficiaries. Use this section to design measurement for any project, regardless of whether it runs on the live Impact Tracker."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <Link href="/methodology/domains" className="block">
          <Card className="hover:bg-ach-page transition-colors h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
                  <Layers className="h-3 w-3" />The 7 capability domains
                </div>
                <ArrowRight className="h-4 w-4 text-ach-navy/40" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-ach-navy/80">Employment, Education, Housing, Health, Belonging, Social Participation, Rights — what HIM captures across a beneficiary&apos;s integration journey.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/methodology/timepoints" className="block">
          <Card className="hover:bg-ach-page transition-colors h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />The 4 timepoints
                </div>
                <ArrowRight className="h-4 w-4 text-ach-navy/40" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-ach-navy/80">Baseline, end of placement, 6 months, 12 months. When we measure and why each one matters.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/methodology/activities" className="block">
          <Card className="hover:bg-ach-page transition-colors h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />Activity → factor model
                </div>
                <ArrowRight className="h-4 w-4 text-ach-navy/40" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-ach-navy/80">Programme managers tick what their project delivers. The platform derives which factors to measure. No factor-level configuration needed.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/methodology/toc" className="block">
          <Card className="hover:bg-ach-page transition-colors h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
                  <Map className="h-3 w-3" />ACH&apos;s Theory of Change
                </div>
                <ArrowRight className="h-4 w-4 text-ach-navy/40" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-ach-navy/80">How HIM operationalises ACH&apos;s Service Users + Wider Systems Change Theory of Change — and where the live platform sits within it.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/methodology/glossary" className="block">
          <Card className="hover:bg-ach-page transition-colors h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3" />Glossary
                </div>
                <ArrowRight className="h-4 w-4 text-ach-navy/40" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-ach-navy/80">Plain-English definitions: capability, factor, indicator, ITT, completers, baseline window, intention to treat.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/projects/new" className="block">
          <Card className="hover:bg-ach-page transition-colors h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 flex items-center gap-1.5">
                  <Compass className="h-3 w-3" />Design a measurement plan
                </div>
                <ArrowRight className="h-4 w-4 text-ach-navy/40" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-ach-navy/80">Walk through the project setup flow: pick capability domains, tick activities, see the measurement set that results — no need to involve real candidates.</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Capability domains at a glance</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CAP_DOMAINS.map(d => (
              <div key={d} className="rounded-[10px] border-[0.5px] border-ach-border p-3">
                <div className="text-[13px] font-medium text-ach-navy">{CAP_DOMAIN_LABELS[d]}</div>
                <div className="text-[12px] text-ach-navy/65 mt-0.5">{CAP_DOMAIN_HINTS[d]}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Three factor types</div>
          <div className="text-[12px] text-ach-navy/60 mt-0.5">
            Every factor in HIM is one of these three types — the assessor sees this tagged on each question they ask.
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FACTOR_TYPES.map(ft => (
              <div key={ft.id} className="rounded-[10px] border-[0.5px] border-ach-border p-3">
                <div className="text-[13px] font-medium text-ach-navy">{ft.label}</div>
                <div className="text-[12px] text-ach-navy/65 mt-1 leading-snug">{ft.description}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">Four timepoints</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TIMEPOINTS.map(tp => (
              <div key={tp.label} className="rounded-[10px] border-[0.5px] border-ach-border p-3">
                <div className="text-[13px] font-medium text-ach-navy">{tp.label}</div>
                <div className="text-[12px] text-ach-navy/65 mt-1 leading-snug">{tp.description}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60">12 programme activities</div>
          <div className="text-[12px] text-ach-navy/60 mt-0.5">
            What programme managers tick at project setup. Each activity activates a curated set of HIM factors — those are what gets measured.
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PROGRAMME_ACTIVITIES.map(act => (
              <div key={act.id} className="rounded-[10px] border-[0.5px] border-ach-border p-3">
                <div className="text-[13px] font-medium text-ach-navy">{act.label}</div>
                <div className="text-[11.5px] text-ach-navy/65 mt-0.5 leading-snug">{act.hint}</div>
                <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/45 mt-1.5">
                  Touches: {act.domains.map(d => CAP_DOMAIN_LABELS[d as keyof typeof CAP_DOMAIN_LABELS] ?? d).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
