import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-[var(--accent)]/15 text-[var(--accent)]',
        secondary:   'bg-white/10 text-gray-300',
        destructive: 'bg-red-500/15 text-red-300',
        outline:     'border border-[var(--border)] text-gray-300',
        success:     'bg-green-500/15 text-green-300',
        warning:     'bg-amber-500/15 text-amber-300',
        error:       'bg-red-500/15 text-red-300',
        muted:       'bg-white/5 text-[var(--muted)]',
        qualy:       'bg-[#3B82F6]/15 text-[#3B82F6]',
        envi:        'bg-[#22C55E]/15 text-[#22C55E]',
        saffy:       'bg-[#F59E0B]/15 text-[#F59E0B]',
        doki:        'bg-[#6366F1]/15 text-[#6366F1]',
        audie:       'bg-[#F43F5E]/15 text-[#F43F5E]',
        nexus:       'bg-[#8B5CF6]/15 text-[#8B5CF6]',
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
