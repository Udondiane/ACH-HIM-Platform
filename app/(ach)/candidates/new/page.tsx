import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { CandidateForm } from '@/components/candidates/candidate-form';
import { createCandidateAction } from '@/lib/candidates/actions';

export default function NewCandidatePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/candidates"
        backLabel="Candidates"
        miniLabel="Network"
        title="Add candidate"
      />
      <Card>
        <CardContent className="pt-6">
          <CandidateForm action={createCandidateAction} cancelHref="/candidates" submitLabel="Create candidate" />
        </CardContent>
      </Card>
    </div>
  );
}
