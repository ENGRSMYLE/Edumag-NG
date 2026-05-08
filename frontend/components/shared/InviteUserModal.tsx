'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { usersApi, classesApi } from '@/lib/api';
import type { InviteUserRequest } from '@/types/staff';

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email address'),
    role: z.enum(['admin', 'teacher'] as const),
    class_id: z.string().optional(),
  })
  .refine(
    (d) => d.role !== 'teacher' || (!!d.class_id && d.class_id.trim() !== ''),
    { message: 'Assign a class for teachers', path: ['class_id'] },
  );

type FormData = z.infer<typeof schema>;

const inputCx = (hasError: boolean) =>
  clsx(
    'w-full px-3 py-2.5 text-sm rounded-lg',
    'bg-[var(--color-surface)] border',
    'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
    'focus:outline-none focus:ring-2',
    'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
    hasError
      ? 'border-red-400 focus:ring-red-200'
      : 'border-[var(--color-border)] focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]',
  );

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultRole?: 'admin' | 'teacher';
}

export function InviteUserModal({
  isOpen,
  onClose,
  onSuccess,
  defaultRole = 'teacher',
}: InviteUserModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole },
  });

  const role = watch('role');

  const { data: classesData } = useQuery({
    queryKey: ['classes', { is_active: true }],
    queryFn: () => classesApi.list({ is_active: true, per_page: 100 }).then((r) => r.data),
    staleTime: 120_000,
    enabled: isOpen && role === 'teacher',
  });
  const classes = (classesData as any)?.items ?? [];

  const { mutate: invite, isPending } = useMutation({
    mutationFn: (data: InviteUserRequest) =>
      usersApi.invite(data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Invitation sent');
      reset();
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      toast.error(
        typeof detail === 'string' ? detail : 'Failed to send invitation',
      );
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, isPending, onClose]);

  useEffect(() => {
    if (!isOpen) reset();
    else reset({ role: defaultRole });
  }, [isOpen, reset, defaultRole]);

  const onSubmit = (data: FormData) => {
    const payload: InviteUserRequest = {
      name: data.name,
      email: data.email,
      role: data.role,
      ...(data.role === 'teacher' && data.class_id
        ? { class_id: data.class_id }
        : {}),
    };
    invite(payload);
  };

  if (!isOpen || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target && !isPending) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--color-navy)]/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg animate-fade-in-up"
        style={{ '--delay': '0ms' } as unknown as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
      >
        {/* Double-bezel outer shell */}
        <div className="bg-black/[0.03] ring-1 ring-black/5 p-1.5 rounded-[1.25rem]">
          {/* Inner core */}
          <div className="bg-white rounded-[calc(1.25rem-0.375rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-navy)]/10 flex items-center justify-center flex-shrink-0">
                <UserPlus
                  className="w-[18px] h-[18px] text-[var(--color-navy)]"
                  strokeWidth={1.5}
                />
              </div>
              <div className="flex-1">
                <h2
                  id="invite-modal-title"
                  className="text-sm font-semibold text-[var(--color-text-primary)] font-display"
                >
                  Invite Staff Member
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  They'll receive an email with an account setup link.
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isPending}
                className={clsx(
                  'p-1.5 rounded-lg',
                  'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]',
                  'transition-all duration-150',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
                aria-label="Close"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="px-6 py-5 flex flex-col gap-4"
            >
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">
                  Full Name
                </label>
                <input
                  {...register('name')}
                  placeholder="Adaeze Okonkwo"
                  className={inputCx(!!errors.name)}
                />
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">
                  Email Address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="adaeze@school.edu.ng"
                  className={inputCx(!!errors.email)}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Role */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">
                  Role
                </label>
                <select
                  {...register('role')}
                  className={clsx(inputCx(!!errors.role), 'appearance-none cursor-pointer')}
                >
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.role && (
                  <p className="text-xs text-red-500">{errors.role.message}</p>
                )}
              </div>

              {/* Class — teachers only */}
              {role === 'teacher' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-primary)]">
                    Assign Class
                    <span className="ml-1 text-[var(--color-text-muted)] font-normal">
                      (required)
                    </span>
                  </label>
                  <select
                    {...register('class_id')}
                    className={clsx(inputCx(!!errors.class_id), 'cursor-pointer')}
                  >
                    <option value="">Select a class…</option>
                    {classes.map((cls: any) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}{cls.arm ? ` (${cls.arm})` : ''} — {cls.academic_session}
                      </option>
                    ))}
                  </select>
                  {classes.length === 0 && (
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      No classes found. Create a class first.
                    </p>
                  )}
                  {errors.class_id && (
                    <p className="text-xs text-red-500">
                      {errors.class_id.message}
                    </p>
                  )}
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-2 pt-2 mt-1 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium',
                    'text-[var(--color-text-primary)] bg-[var(--color-surface)]',
                    'hover:bg-[var(--color-border)] active:scale-[0.98]',
                    'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isPending}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium',
                    'bg-[var(--color-navy)] text-white',
                    'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                    'flex items-center gap-2',
                    'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                  )}
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
