'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Plus, BookOpen, Users, Pencil, X, Loader2 } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/shared/Badge';
import { classesApi, usersApi } from '@/lib/api';
import type { ClassListItem } from '@/types/academic';

const schema = z.object({
  name: z.string().min(1, 'Class name is required'),
  level: z.string().min(1, 'Level is required'),
  arm: z.string().optional(),
  teacher_id: z.string().optional(),
  capacity: z.coerce.number().int().min(1).max(200).optional(),
});

type FormData = z.infer<typeof schema>;

const inputCls = (hasError?: boolean) => clsx(
  'w-full text-sm rounded-lg px-3 py-2',
  'bg-[var(--color-surface)] border',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
  'focus:outline-none focus:ring-2 transition-all duration-150',
  hasError
    ? 'border-red-400 focus:ring-red-200'
    : 'border-[var(--color-border)] focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]/50',
);

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  editClass?: ClassListItem | null;
}

function CreateClassModal({ isOpen, onClose, editClass }: CreateClassModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const queryClient = useQueryClient();

  const { data: staff } = useQuery({
    queryKey: ['users', { role: 'teacher' }],
    queryFn: () => usersApi.list({ role: 'teacher', per_page: 100 }).then((r) => r.data),
    staleTime: 120_000,
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editClass
      ? { name: editClass.name, level: editClass.level }
      : {},
  });

  useEffect(() => {
    if (!isOpen) reset();
    else if (editClass) {
      reset({ name: editClass.name, level: editClass.level });
    } else {
      reset({});
    }
  }, [isOpen, editClass, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        arm: data.arm || undefined,
        teacher_id: data.teacher_id || undefined,
        capacity: data.capacity || undefined,
      };
      return editClass
        ? classesApi.update(editClass.id, payload)
        : classesApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editClass ? 'Class updated' : 'Class created');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Operation failed';
      toast.error(typeof msg === 'string' ? msg : 'Operation failed');
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

  if (!isOpen || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={(e) => { if (e.currentTarget === e.target && !isPending) onClose(); }}
    >
      <div className="absolute inset-0 bg-[var(--color-navy)]/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md animate-fade-in-up" role="dialog" aria-modal="true">
        <div className="bg-black/[0.03] ring-1 ring-black/5 p-1.5 rounded-[1.25rem]">
          <div className="bg-white rounded-[calc(1.25rem-0.375rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-navy)]/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-[18px] h-[18px] text-[var(--color-navy)]" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">
                  {editClass ? 'Edit Class' : 'Create Class'}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {editClass ? 'Update class details' : 'Add a new class to the school'}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isPending}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-all duration-150 disabled:opacity-40"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit((d) => mutate(d))} className="px-6 py-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-primary)]">
                    Class Name <span className="text-red-500">*</span>
                  </label>
                  <input {...register('name')} className={inputCls(!!errors.name)} placeholder="JSS 1" />
                  {errors.name && <p className="text-[11px] text-red-500">{errors.name.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-primary)]">
                    Level <span className="text-red-500">*</span>
                  </label>
                  <input {...register('level')} className={inputCls(!!errors.level)} placeholder="JSS1" />
                  {errors.level && <p className="text-[11px] text-red-500">{errors.level.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-primary)]">Arm / Stream</label>
                  <input {...register('arm')} className={inputCls()} placeholder="A, Gold, Blue…" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--color-text-primary)]">Capacity</label>
                  <input {...register('capacity')} type="number" min={1} max={200} className={inputCls(!!errors.capacity)} placeholder="40" />
                  {errors.capacity && <p className="text-[11px] text-red-500">{errors.capacity.message}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">Assign Class Teacher</label>
                <select {...register('teacher_id')} className={clsx(inputCls(), 'cursor-pointer')}>
                  <option value="">Select teacher (optional)</option>
                  {((staff as any)?.items ?? []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                    'text-[var(--color-text-primary)] bg-[var(--color-surface)]',
                    'hover:bg-[var(--color-border)] active:scale-[0.98]',
                    'transition-all duration-200 disabled:opacity-40',
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                    'bg-[var(--color-navy)] text-white',
                    'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                    'transition-all duration-200 disabled:opacity-60',
                  )}
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editClass ? 'Update Class' : 'Create Class'}
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

export default function AdminClassesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassListItem | null>(null);

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });

  const openCreate = () => { setEditClass(null); setModalOpen(true); };
  const openEdit = (cls: ClassListItem) => { setEditClass(cls); setModalOpen(true); };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Classes"
        description="Manage school classes and assign teachers"
        actions={
          <button
            onClick={openCreate}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-navy)] text-white',
              'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
              'transition-all duration-200',
            )}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Create Class
          </button>
        }
      />

      <div className="card-shell">
        <div className="card-core">
          {isLoading ? (
            <div className="divide-y divide-[var(--color-border)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="skeleton w-8 h-8 rounded-lg" />
                    <div className="space-y-1.5">
                      <div className="skeleton h-3.5 w-24 rounded" />
                      <div className="skeleton h-3 w-16 rounded" />
                    </div>
                  </div>
                  <div className="skeleton h-7 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : !classes || classes.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center px-5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-navy)]/8 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[var(--color-navy)]/40" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">No classes yet</p>
              <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
                Create your first class to start organizing students and teachers.
              </p>
              <button
                onClick={openCreate}
                className={clsx(
                  'mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
                  'bg-[var(--color-navy)] text-white',
                  'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                  'transition-all duration-200',
                )}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                Create First Class
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-navy)]/8 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-[var(--color-navy)]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {cls.name}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-[var(--color-text-muted)]">{cls.level}</span>
                        {cls.teacher_name ? (
                          <span className="text-xs text-[var(--color-text-muted)]">{cls.teacher_name}</span>
                        ) : (
                          <Badge variant="neutral">Unassigned</Badge>
                        )}
                        {cls.student_count !== undefined && (
                          <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <Users className="w-3 h-3" strokeWidth={1.5} />
                            {cls.student_count} students
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(cls)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer',
                      'text-[var(--color-navy)] bg-[var(--color-navy)]/8 hover:bg-[var(--color-navy)]/12',
                      'transition-colors duration-150',
                    )}
                  >
                    <Pencil className="w-3 h-3" strokeWidth={1.5} />
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateClassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editClass={editClass}
      />
    </div>
  );
}
