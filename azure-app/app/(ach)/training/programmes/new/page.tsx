import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ProgrammeForm } from '@/components/training/programme-form';
import { createProgrammeAction } from '@/lib/training/actions';

export default function NewProgrammePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        backHref="/training"
        backLabel="Training"
        miniLabel="New"
        title="New training programme"
        description="Define a reusable programme. You'll add sessions and enrol learners after this."
      />
      <Card>
        <CardContent className="pt-6">
          <ProgrammeForm action={createProgrammeAction} cancelHref="/training" submitLabel="Create programme" />
        </CardContent>
      </Card>
    </div>
  );
}
