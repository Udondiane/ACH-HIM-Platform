import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { NewPackForm } from '@/components/evidence-pack/new-pack-form';

export default function NewEvidencePackPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        miniLabel="Reports · Evidence Pack"
        title="New evidence pack"
        description="The pack is created with all 14 sections empty. You can edit each section, request AI drafting, then finalise and export."
      />
      <Card>
        <CardContent className="pt-6">
          <NewPackForm />
        </CardContent>
      </Card>
    </div>
  );
}
