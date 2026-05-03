import { clsx } from 'clsx';
import { formatNaira } from '@/lib/formatters';

interface CurrencyDisplayProps {
  kobo: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  muted?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl font-semibold',
  xl: 'text-3xl font-bold font-display tracking-tight',
};

export function CurrencyDisplay({
  kobo,
  size = 'md',
  muted = false,
  className,
}: CurrencyDisplayProps) {
  return (
    <span
      className={clsx(
        'tabular-nums font-mono',
        sizeMap[size],
        muted
          ? 'text-[var(--color-text-muted)]'
          : 'text-[var(--color-text-primary)]',
        className,
      )}
    >
      {formatNaira(kobo)}
    </span>
  );
}
