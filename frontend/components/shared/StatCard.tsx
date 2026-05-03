'use client';

import type { CSSProperties } from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;
  changeLabel?: string;
  variant?: 'default' | 'gold' | 'success' | 'danger' | 'info';
  delay?: number;
  className?: string;
}

const variantMap = {
  default: {
    border: 'border-l-[var(--color-navy)]',
    iconBg: 'bg-[var(--color-navy)]/10',
    iconColor: 'text-[var(--color-navy)]',
  },
  gold: {
    border: 'border-l-[var(--color-gold)]',
    iconBg: 'bg-[var(--color-gold)]/10',
    iconColor: 'text-[var(--color-gold)]',
  },
  success: {
    border: 'border-l-emerald-500',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
  },
  danger: {
    border: 'border-l-red-500',
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-600',
  },
  info: {
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600',
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  variant = 'default',
  delay = 0,
  className,
}: StatCardProps) {
  const styles = variantMap[variant];
  const hasChange = change !== undefined;
  const isPositive = hasChange && change > 0;
  const isNegative = hasChange && change < 0;

  const ChangeIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const changeColor = isPositive
    ? 'text-emerald-600'
    : isNegative
    ? 'text-red-500'
    : 'text-[var(--color-text-muted)]';

  return (
    <div
      className={clsx('animate-fade-in-up-stagger', className)}
      style={{ '--delay': `${delay * 80}ms` } as unknown as CSSProperties}
    >
      {/* Double-bezel outer shell */}
      <div className="bg-black/[0.03] ring-1 ring-black/5 p-1.5 rounded-[1.25rem] h-full">
        {/* Inner core */}
        <div
          className={clsx(
            'bg-white rounded-[calc(1.25rem-0.375rem)] h-full',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
            'border-l-4 pl-4 pr-5 py-4',
            styles.border,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide truncate">
                {title}
              </p>
              <p className="mt-1.5 text-2xl font-bold text-[var(--color-text-primary)] font-display tracking-tight leading-none">
                {value}
              </p>
              {hasChange && (
                <div className={clsx('flex items-center gap-1 mt-2', changeColor)}>
                  <ChangeIcon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-xs font-medium">
                    {Math.abs(change)}%
                    {changeLabel && (
                      <span className="text-[var(--color-text-muted)] font-normal ml-1">
                        {changeLabel}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div
              className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                styles.iconBg,
              )}
            >
              <Icon className={clsx('w-5 h-5', styles.iconColor)} strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
