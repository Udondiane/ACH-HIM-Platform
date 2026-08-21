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

/**
 * Page header — used on every top-of-page block in the app.
 *
 * Layout is DELIBERATELY always stacked (title row above actions row),
 * never side-by-side. Previously we tried responsive `md:flex-row` to
 * put actions to the right of the title on wider viewports. That was
 * fragile because Tailwind breakpoints watch the VIEWPORT, not the
 * component's container — so any page that renders the header inside
 * a narrow column (side panel, dashboard tile, split view) would
 * squeeze the title into ~120px while Tailwind still thought there
 * was room for actions alongside. Result: titles wrapping
 * character-by-character because the browser's only remaining break
 * point was the letters themselves.
 *
 * Vertical stacking removes that whole class of bug in one line. The
 * title always gets 100% of the container width. Actions sit on the
 * next row and wrap onto multiple lines if there are many. This is
 * the "small extra vertical space" cost for "never breaks visually"
 * — the trade is worth it every time.
 */
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
    <div className={cn('flex flex-col gap-3 mb-8 min-w-0', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[12px] text-ach-navy/60 hover:text-ach-navy transition-colors w-fit"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {backLabel ?? 'Back'}
        </Link>
      )}
      <div className="min-w-0">
        {miniLabel && (
          <div className="text-[10.5px] uppercase tracking-[1.2px] text-ach-navy/60 mb-1.5 [overflow-wrap:anywhere]">
            {miniLabel}
          </div>
        )}
        <h1 className="text-[22px] sm:text-[26px] font-medium tracking-[-0.5px] text-ach-navy leading-tight [overflow-wrap:break-word] [hyphens:manual]">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-ach-navy/60 mt-1.5 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {actions}
        </div>
      )}
    </div>
  );
}
