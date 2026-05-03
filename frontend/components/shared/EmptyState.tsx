import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-navy)] flex items-center justify-center mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
        <Icon className="w-7 h-7 text-white" strokeWidth={1.5} />
      </div>

      <p className="text-sm font-semibold text-[var(--color-text-primary)] font-display">
        {title}
      </p>

      {description && (
        <p className="mt-1.5 text-sm text-[var(--color-text-muted)] max-w-[300px] leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className={clsx(
            'mt-5 px-5 py-2 rounded-lg text-sm font-medium',
            'bg-[var(--color-gold)] text-[var(--color-navy)]',
            'hover:bg-[var(--color-gold-light)] active:scale-[0.98]',
            'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
