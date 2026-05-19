import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className
      )}
    >
      {icon && <div className="text-ach-navy/30 mb-4">{icon}</div>}
      <h3 className="text-[15px] font-medium text-ach-navy">{title}</h3>
      {description && (
        <p className="text-[13px] text-ach-navy/60 mt-1 max-w-md">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
