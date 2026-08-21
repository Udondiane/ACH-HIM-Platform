import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArchiveQuoteButton } from '@/components/featured-quotes/archive-button';

export const metadata = { title: 'Featured quotes library' };

export default async function FeaturedQuotesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('featured_quotes')
    .select('id, quote_text, context, speaker_type, source_type, use_anonymised, display_name, tagged_at, candidate_id, cohort_id, candidates(candidate_ref, given_name), cohorts(name)')
    .is('archived_at', null)
    .order('tagged_at', { ascending: false })
    .limit(200);
  const quotes = (data as any[]) ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader miniLabel="Reports" title="Featured quotes library" />
      <p className="text-[13px] text-ach-navy/70 -mt-2 mb-5">
        Curated quotes from assessments, timepoint feedback and interviews. Feed into close-out reports, 12-month impact reports and case studies.
        Consent-gated: quotes only appear when the candidate has granted quoting consent.
      </p>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-[13px] text-ach-navy/70">
            <p className="mb-2">No featured quotes yet.</p>
            <p className="text-ach-navy/55">
              Assessors can flag a response as feature-worthy during any assessment (see the small
              &ldquo;Candidate voice&rdquo; panel under each indicator). Flagged responses become available for curation into
              the reports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {quotes.map(q => (
            <Card key={q.id}>
              <CardContent className="pt-5 pb-4">
                <div className="text-[14px] text-ach-navy font-serif italic leading-relaxed">
                  &ldquo;{q.quote_text}&rdquo;
                </div>
                <div className="flex items-center flex-wrap gap-2 text-[11.5px] text-ach-navy/60 mt-2">
                  <Badge>{q.speaker_type}</Badge>
                  <Badge>from {q.source_type.replace('_', ' ')}</Badge>
                  {q.use_anonymised
                    ? <span>Anonymised</span>
                    : <span>By name: {q.display_name ?? '—'}</span>}
                  {q.context && <span className="italic">&middot; {q.context}</span>}
                </div>
                <div className="flex items-center gap-3 text-[11.5px] text-ach-navy/55 mt-2">
                  {q.candidates?.candidate_ref && (
                    <Link href={`/candidates/${q.candidate_id}`} className="hover:text-ach-navy underline underline-offset-2">
                      {q.candidates.candidate_ref}
                    </Link>
                  )}
                  {q.cohorts?.name && (
                    <Link href={`/cohorts/${q.cohort_id}`} className="hover:text-ach-navy underline underline-offset-2">
                      {q.cohorts.name}
                    </Link>
                  )}
                  <span className="ml-auto text-ach-navy/40">
                    tagged {new Date(q.tagged_at).toLocaleDateString('en-GB')}
                  </span>
                  <ArchiveQuoteButton id={q.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
