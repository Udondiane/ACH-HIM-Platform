import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] uppercase tracking-[1.2px] font-medium border-[0.5px]',
  {
    variants: {
      variant: {
        default: 'bg-ach-page text-ach-navy border-ach-border',
        // partner types
        capability_investor: 'bg-[#B5A4D8]/15 text-ach-navy border-[#B5A4D8]/30',
        workforce_partner:   'bg-[#E89968]/15 text-ach-navy border-[#E89968]/30',
        training_partner:    'bg-[#7DA8C9]/15 text-ach-navy border-[#7DA8C9]/30',
        // status
        active:    'bg-[#95B670]/15 text-ach-navy border-[#95B670]/30',
        prospect:  'bg-ach-page text-ach-navy/70 border-ach-border',
        paused:    'bg-[#E8C25E]/15 text-ach-navy border-[#E8C25E]/30',
        closed:    'bg-[#D67890]/15 text-ach-navy border-[#D67890]/30',
        // tier
        verified:      'bg-[#3C6B47]/12 text-[#3C6B47] border-[#3C6B47]/25',
        verified_plus: 'bg-[#3C6B47] text-ach-cream border-[#3C6B47]',
        none:          'bg-ach-page text-ach-navy/50 border-ach-border',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
