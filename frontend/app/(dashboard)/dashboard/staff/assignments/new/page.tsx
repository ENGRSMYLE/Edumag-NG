'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  ArrowLeft,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { FileUpload } from '@/components/shared/FileUpload';
import { assignmentsApi } from '@/lib/api';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SUBJECTS = [
  'Mathematics',
  'English Language',
  'Basic Science',
  'Social Studies',
  'Civic Education',
  'Christian Religious Studies',
  'Islamic Religious Studies',
  'Computer Studies',
  'Agricultural Science',
  'Physical Education',
];

const schema = z.object({
  title:       z.string().min(3, 'Title must be at least 3 characters'),
  subject:     z.string().min(1, 'Please select a subject'),
  description: z.string().optional(),
  due_date:    z.string().min(1, 'Please set a due date'),
  max_score:   z
    .number({ invalid_type_error: 'Enter a valid score' })
    .min(1, 'Min score is 1')
    .max(100, 'Max score is 100'),
  file_url:    z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

function Field({ label, error, children, required }: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--color-text-primary)]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls = clsx(
  'w-full text-sm rounded-xl px-3 py-2.5',
  'bg-[var(--color-surface)] border border-[var(--color-border)]',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]',
  'transition-all duration-200',
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewAssignmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { max_score: 100 },
  });

  const { mutate: createAssignment, isPending: isSubmitting } = useMutation({
    mutationFn: (data: Parameters<typeof assignmentsApi.create>[0]) =>
      assignmentsApi.create(data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Assignment created successfully');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      router.push('/dashboard/staff/assignments');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to create assignment';
      toast.error(typeof msg === 'string' ? msg : 'Failed to create assignment');
    },
  });

  const onSubmit = (values: FormValues) => {
    createAssignment({
      title: values.title,
      subject: values.subject,
      description: values.description,
      due_date: values.due_date,
      max_score: values.max_score,
      file_url: values.file_url || undefined,
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title="New Assignment"
        description="Create an assignment for your class"
      />

      {/* Back link */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer w-fit transition-colors duration-150"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
        Back to Assignments
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Card */}
        <div className="card-shell">
          <div className="card-core p-6 flex flex-col gap-5">
            {/* Header row */}
            <div className="flex items-center gap-3 pb-2 border-b border-[var(--color-border)]">
              <div className="w-9 h-9 rounded-lg bg-[var(--color-navy)]/8 flex items-center justify-center">
                <ClipboardList className="w-4.5 h-4.5 text-[var(--color-navy)]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Assignment Details</p>
                <p className="text-xs text-[var(--color-text-muted)]">Fill in all required fields</p>
              </div>
            </div>

            {/* Title */}
            <Field label="Title" required error={errors.title?.message}>
              <input
                {...register('title')}
                type="text"
                placeholder="e.g. Quadratic Equations Practice"
                className={clsx(inputCls, errors.title && 'border-red-400 focus:ring-red-400/30')}
              />
            </Field>

            {/* Subject + Max Score */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Subject" required error={errors.subject?.message}>
                <select
                  {...register('subject')}
                  className={clsx(
                    inputCls, 'cursor-pointer',
                    errors.subject && 'border-red-400',
                  )}
                >
                  <option value="">Select subject…</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>

              <Field label="Max Score" required error={errors.max_score?.message}>
                <input
                  {...register('max_score', { valueAsNumber: true })}
                  type="number"
                  min={1}
                  max={100}
                  placeholder="100"
                  className={clsx(inputCls, errors.max_score && 'border-red-400')}
                />
              </Field>
            </div>

            {/* Due date */}
            <Field label="Due Date" required error={errors.due_date?.message}>
              <input
                {...register('due_date')}
                type="date"
                min={today}
                className={clsx(inputCls, errors.due_date && 'border-red-400')}
              />
            </Field>

            {/* Description */}
            <Field label="Description" error={errors.description?.message}>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Describe the task, references, or any instructions for students…"
                className={clsx(inputCls, 'resize-none')}
              />
            </Field>

            {/* File upload */}
            <FileUpload
              folder="assignments"
              accept=".pdf,.doc,.docx"
              maxSize={10 * 1024 * 1024}
              label="Attachment (optional)"
              currentUrl={watch('file_url')}
              onUpload={(url) => setValue('file_url', url)}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className={clsx(
              'px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer',
              'border border-[var(--color-border)] text-[var(--color-text-secondary)]',
              'hover:border-[var(--color-navy)]/30 hover:text-[var(--color-text-primary)]',
              'transition-all duration-150',
            )}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-navy)] text-white',
              'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'transition-all duration-200',
            )}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <ClipboardList className="w-4 h-4" strokeWidth={1.5} />
            )}
            {isSubmitting ? 'Creating…' : 'Create Assignment'}
          </button>
        </div>
      </form>
    </div>
  );
}
