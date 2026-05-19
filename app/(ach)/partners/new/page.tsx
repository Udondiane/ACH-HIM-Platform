import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { PartnerForm } from '@/components/partners/partner-form';
import { createPartnerAction } from '@/lib/partners/actions';

export default function NewPartnerPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        backHref="/partners"
        backLabel="Partners"
        miniLabel="Network"
        title="Add partner"
        description="Set up a new partner organisation. You can come back to edit any of these details later."
      />
      <Card>
        <CardContent className="pt-6">
          <PartnerForm action={createPartnerAction} cancelHref="/partners" submitLabel="Create partner" />
        </CardContent>
      </Card>
    </div>
  );
}
