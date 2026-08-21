import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  miniLabel?: React.ReactNode;
  title: React.ReactNode;
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
      {/* Responsive header layout:
          - Narrow viewports: stack title above actions so the title gets
            the full page width (no fighting five action buttons for
            space). Actions wrap onto multiple rows if there are many.
          - Wide viewports (md+): side-by-side, title left, actions right. */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          {miniLabel && (
            // overflow-wrap:anywhere lets a long ref token fold at any
            // character IF it truly won't fit, but only as a last resort —
            // whitespace + hyphens still take priority. break-all was
            // aggressively splitting every character; this is the humane
            // version.
            <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5 [overflow-wrap:anywhere]">
              {miniLabel}
            </div>
          )}
          {/* Header sizing:
              - Modest base font (18px) that fits comfortably in narrow
                sidebars before we ever start breaking words.
              - overflow-wrap:normal + hyphens:manual = only break at
                natural whitespace, never mid-word. If the title genuinely
                doesn't fit, it overflows rather than being sliced
                character-by-character (which is worse). */}
          <h1 className="text-[18px] sm:text-[22px] md:text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-tight [overflow-wrap:normal] [hyphens:manual]">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-ach-navy/60 mt-1.5 max-w-2xl">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
