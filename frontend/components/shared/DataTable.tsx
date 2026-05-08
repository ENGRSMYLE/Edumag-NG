'use client';

import { useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  className?: string;
  /** Hide this column below the sm breakpoint (640px) */
  mobileHide?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
}

interface DataTableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  rowKey: keyof T;
  isLoading?: boolean;
  totalCount?: number;
  page?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (query: string) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: ReactNode;
}

const SKELETON_ROWS = 5;

export function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  isLoading = false,
  totalCount = 0,
  page = 1,
  perPage = 20,
  onPageChange,
  onSearch,
  onSort,
  searchPlaceholder = 'Search…',
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or filters.',
  actions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSearch?.(value), 300);
    },
    [onSearch],
  );

  const handleSort = (key: string) => {
    const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDir(newDir);
    onSort?.(key, newDir);
  };

  const totalPages = Math.ceil(totalCount / perPage);
  const showPagination = totalPages > 1 && !!onPageChange;

  // Show only prev/next + current page on mobile; full window on sm+
  const pageWindow = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  })();

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar — stacks vertically on mobile */}
      {(onSearch || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          {onSearch && (
            <div className="relative w-full sm:flex-1 sm:max-w-xs">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className={clsx(
                  'w-full pl-9 pr-3 py-2.5 sm:py-2 text-sm rounded-lg',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]',
                  'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                )}
              />
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-2 sm:ml-auto flex-wrap">{actions}</div>
          )}
        </div>
      )}

      {/* Table shell — scrolls horizontally on small screens */}
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-navy)]">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    onClick={() => col.sortable && handleSort(String(col.key))}
                    className={clsx(
                      'px-4 py-3 text-left text-xs font-semibold text-white/80 tracking-wide select-none whitespace-nowrap',
                      col.sortable &&
                        'cursor-pointer hover:text-white transition-colors duration-150',
                      col.mobileHide && 'hidden sm:table-cell',
                      col.className,
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.header}
                      {col.sortable && (
                        <span className="flex-shrink-0">
                          {sortKey === String(col.key) ? (
                            sortDir === 'asc' ? (
                              <ChevronUp
                                className="w-3.5 h-3.5 text-[var(--color-gold)]"
                                strokeWidth={2}
                              />
                            ) : (
                              <ChevronDown
                                className="w-3.5 h-3.5 text-[var(--color-gold)]"
                                strokeWidth={2}
                              />
                            )
                          ) : (
                            <ChevronsUpDown
                              className="w-3.5 h-3.5 text-white/40"
                              strokeWidth={1.5}
                            />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border)]">
              {isLoading ? (
                Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-[var(--color-cream)]' : 'bg-white'}>
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={clsx('px-4 py-3', col.mobileHide && 'hidden sm:table-cell')}
                      >
                        <div className="skeleton h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {emptyTitle}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {emptyDescription}
                    </p>
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr
                    key={String(row[rowKey])}
                    className={clsx(
                      'transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
                      'hover:bg-[var(--color-surface)]',
                      idx % 2 === 0 ? 'bg-[var(--color-cream)]' : 'bg-white',
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={clsx(
                          'px-4 py-3 text-[var(--color-text-primary)]',
                          col.mobileHide && 'hidden sm:table-cell',
                          col.className,
                        )}
                      >
                        {col.render
                          ? col.render(row[col.key as keyof T], row)
                          : String(row[col.key as keyof T] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 text-sm text-[var(--color-text-muted)]">
          <span className="text-center sm:text-left">
            Showing{' '}
            <span className="font-medium text-[var(--color-text-primary)]">
              {Math.min((page - 1) * perPage + 1, totalCount)}
            </span>
            –
            <span className="font-medium text-[var(--color-text-primary)]">
              {Math.min(page * perPage, totalCount)}
            </span>{' '}
            of{' '}
            <span className="font-medium text-[var(--color-text-primary)]">{totalCount}</span>
          </span>

          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className={clsx(
                'p-1.5 rounded-lg transition-all duration-150',
                page <= 1
                  ? 'text-[var(--color-text-muted)] cursor-not-allowed opacity-40'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] active:scale-95 cursor-pointer',
              )}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {/* On mobile show only current/adjacent; on sm+ show full window */}
            {pageWindow.map((num) => (
              <button
                key={num}
                onClick={() => onPageChange(num)}
                className={clsx(
                  'w-8 h-8 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer',
                  Math.abs(num - page) > 1 && 'hidden sm:flex sm:items-center sm:justify-center',
                  num === page
                    ? 'bg-[var(--color-navy)] text-white'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] active:scale-95',
                )}
              >
                {num}
              </button>
            ))}

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className={clsx(
                'p-1.5 rounded-lg transition-all duration-150',
                page >= totalPages
                  ? 'text-[var(--color-text-muted)] cursor-not-allowed opacity-40'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] active:scale-95 cursor-pointer',
              )}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
