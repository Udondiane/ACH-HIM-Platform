import { signOutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PARTNER_TYPE_LABELS } from '@/lib/partners/schema';

interface Props {
  partner: { id: string; name: string; type: string; types?: string[] } | null;
  userEmail: string | null;
}

export function PartnerTopbar({ partner, userEmail }: Props) {
  const types = partner?.types ?? (partner?.type ? [partner.type] : []);
  return (
    <header className="h-14 border-b-[0.5px] border-ach-border bg-white px-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {types.map(t => (
          <Badge key={t} variant={t as any}>
            {PARTNER_TYPE_LABELS[t as keyof typeof PARTNER_TYPE_LABELS] ?? t}
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {userEmail && <span className="text-[12px] text-ach-navy/60">{userEmail}</span>}
        <form action={signOutAction}>
          <Button variant="ghost" size="sm" type="submit">Sign out</Button>
        </form>
      </div>
    </header>
  );
}
