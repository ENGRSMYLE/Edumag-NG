import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('skeleton', className)} aria-hidden="true" />;
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={clsx('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx('h-4', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={clsx('bg-black/[0.03] ring-1 ring-black/5 p-1.5 rounded-[1.25rem]', className)}
      aria-hidden="true"
    >
      <div className="bg-white rounded-[calc(1.25rem-0.375rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] p-5">
        <div className="flex items-start gap-3 mb-4">
          <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  columns?: number;
  rows?: number;
  className?: string;
}

export function SkeletonTable({
  columns = 4,
  rows = 5,
  className,
}: SkeletonTableProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-[var(--color-border)] overflow-hidden',
        className,
      )}
      aria-hidden="true"
    >
      <div className="bg-[var(--color-navy)] px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex-1 h-3 rounded bg-white/10" />
        ))}
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'px-4 py-3 flex gap-4',
              i % 2 === 0 ? 'bg-[var(--color-cream)]' : 'bg-white',
            )}
          >
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton
                key={j}
                className={clsx('h-4 flex-1', j === columns - 1 ? 'max-w-[80px]' : '')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
