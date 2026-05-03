import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const variantMap: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  danger:  'bg-red-50 text-red-700 ring-1 ring-red-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  info:    'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  neutral: 'bg-[var(--color-surface)] text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]',
};

const dotMap: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  danger:  'bg-red-500',
  warning: 'bg-amber-500',
  info:    'bg-blue-500',
  neutral: 'bg-[var(--color-text-muted)]',
};

export function Badge({
  variant = 'neutral',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantMap[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotMap[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
