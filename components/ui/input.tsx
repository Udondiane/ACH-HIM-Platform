import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-[10px] border-[0.5px] border-ach-border bg-white px-3 py-2 text-[13px] text-ach-navy placeholder:text-ach-navy/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ach-navy/40 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
