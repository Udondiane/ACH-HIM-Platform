import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  miniLabel?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  miniLabel,
  title,
  description,
  backHref,
  backLabel,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 mb-8', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[12px] text-ach-navy/60 hover:text-ach-navy transition-colors w-fit"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {backLabel ?? 'Back'}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          {miniLabel && (
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5">
              {miniLabel}
            </div>
          )}
          <h1 className="text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-ach-navy/60 mt-1.5 max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
