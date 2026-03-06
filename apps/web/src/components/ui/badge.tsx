import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-indigo-500/15 text-indigo-300',
        secondary:   'bg-white/10 text-gray-300',
        destructive: 'bg-red-500/15 text-red-300',
        outline:     'border border-white/10 text-gray-300',
        success:     'bg-green-500/15 text-green-300',
        warning:     'bg-amber-500/15 text-amber-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
