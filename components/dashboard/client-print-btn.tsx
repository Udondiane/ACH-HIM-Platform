'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ClientPrintBtn({ label = 'Print / export' }: { label?: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
