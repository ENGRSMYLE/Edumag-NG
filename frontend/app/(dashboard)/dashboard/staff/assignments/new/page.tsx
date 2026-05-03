'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  ArrowLeft,
  Upload,
  X,
  FileText,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';

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
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// File drop zone
// ---------------------------------------------------------------------------

interface FileDropProps {
  file: File | null;
  onDrop: (file: File) => void;
  onClear: () => void;
}

function FileDropZone({ file, onDrop, onClear }: FileDropProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'], 'application/msword': ['.doc', '.docx'] },
    maxFiles: 1,
    onDrop: (accepted) => { if (accepted[0]) onDrop(accepted[0]); },
  });

  if (file) {
    return (
      <div className={clsx(
        'flex items-center justify-between px-4 py-3 rounded-xl',
        'bg-[var(--color-surface)] border border-[var(--color-gold)]/40',
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-gold)]/12 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4.5 h-4.5 text-[var(--color-gold)]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{file.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 cursor-pointer transition-all duration-150"
          aria-label="Remove file"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={clsx(
        'flex flex-col items-center gap-2 px-6 py-8 rounded-xl border-2 border-dashed cursor-pointer',
        'transition-all duration-200',
        isDragActive
          ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5'
          : 'border-[var(--color-border)] hover:border-[var(--color-navy)]/30 hover:bg-[var(--color-surface)]',
      )}
    >
      <input {...getInputProps()} />
      <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
        <Upload className="w-4.5 h-4.5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {isDragActive ? 'Drop file here' : 'Drag & drop a file'}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          PDF or Word document · Max 10 MB
        </p>
      </div>
    </div>
  );
}

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
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { max_score: 100 },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      // TODO: call assignmentsApi.create(values) once backend is ready
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Assignment created successfully');
      router.push('/dashboard/staff/assignments');
    } catch {
      toast.error('Failed to create assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
            <Field label="Attachment (optional)">
              <FileDropZone
                file={file}
                onDrop={setFile}
                onClear={() => setFile(null)}
              />
            </Field>
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
