'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}: ConfirmDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);
  useBodyScrollLock(isOpen);

  if (!isOpen || !mounted) return null;

  const isDanger = variant === 'danger';
  const Icon = isDanger ? AlertTriangle : AlertCircle;

  const dialog = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-modal flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === backdropRef.current && !isLoading) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--color-navy)]/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-md animate-fade-in-up"
        style={{ '--delay': '0ms' } as unknown as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        {/* Double-bezel outer shell */}
        <div className="bg-black/[0.03] ring-1 ring-black/5 p-1.5 rounded-[1.25rem]">
          {/* Inner core */}
          <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-white rounded-[calc(1.25rem-0.375rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] p-5 sm:p-6">
            {/* Close button */}
            <button
              onClick={onClose}
              disabled={isLoading}
              className={clsx(
                'absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-lg sm:top-4 sm:right-4',
                'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]',
                'transition-all duration-150',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {/* Icon + Title */}
            <div className="flex items-start gap-4">
              <div
                className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  isDanger ? 'bg-red-50' : 'bg-amber-50',
                )}
              >
                <Icon
                  className={clsx(
                    'w-5 h-5',
                    isDanger ? 'text-red-600' : 'text-amber-600',
                  )}
                  strokeWidth={1.5}
                />
              </div>

              <div className="flex-1 pr-8">
                <h3
                  id="confirm-dialog-title"
                  className="text-sm font-semibold text-[var(--color-text-primary)] font-display"
                >
                  {title}
                </h3>
                <p
                  id="confirm-dialog-desc"
                  className="mt-1.5 text-sm text-[var(--color-text-muted)] leading-relaxed"
                >
                  {description}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
              <button
                onClick={onClose}
                disabled={isLoading}
                className={clsx(
                  'min-h-11 px-4 py-2 rounded-lg text-sm font-medium',
                  'text-[var(--color-text-primary)] bg-[var(--color-surface)]',
                  'hover:bg-[var(--color-border)] active:scale-[0.98]',
                  'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {cancelLabel}
              </button>

              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={clsx(
                  'min-h-11 justify-center px-4 py-2 rounded-lg text-sm font-medium',
                  'flex items-center gap-2',
                  isDanger
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-500 text-white hover:bg-amber-600',
                  'active:scale-[0.98]',
                  'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
