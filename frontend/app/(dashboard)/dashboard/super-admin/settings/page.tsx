'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Upload,
  Save,
  Plus,
  Check,
  Loader2,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { settingsApi } from '@/lib/api';
import type { SchoolSettings, GradeScale, AcademicTerm } from '@/types/dashboard';

// ── Shared input style ────────────────────────────────────────────────────────

const inputCx = (hasError = false) =>
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

const labelCx = 'text-xs font-medium text-[var(--color-text-primary)] block mb-1.5';

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'grading' | 'terms' | 'report' | 'system';

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile',  label: 'School Profile' },
  { key: 'grading',  label: 'Grading System' },
  { key: 'terms',    label: 'Academic Terms' },
  { key: 'report',   label: 'Report Format' },
  { key: 'system',   label: 'System' },
];

// ── School Profile tab ────────────────────────────────────────────────────────

const profileSchema = z.object({
  name:        z.string().min(2, 'At least 2 characters'),
  school_type: z.enum(['primary', 'secondary', 'both']),
  address:     z.string().optional(),
  phone:       z.string().optional(),
  email:       z.string().email('Invalid email').optional().or(z.literal('')),
  motto:       z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

function ProfileTab({ settings }: { settings: SchoolSettings | undefined }) {
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings?.logo_url ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name:        settings?.name ?? '',
      school_type: settings?.school_type ?? 'secondary',
      address:     settings?.address ?? '',
      phone:       settings?.phone ?? '',
      email:       settings?.email ?? '',
      motto:       settings?.motto ?? '',
    },
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (data: ProfileForm) => {
      if (logoFile) {
        setUploadingLogo(true);
        try {
          const { data: logoData } = await settingsApi.uploadLogo(logoFile);
          await settingsApi.updateSchool({ ...data, logo_url: logoData.url });
        } finally {
          setUploadingLogo(false);
        }
      } else {
        await settingsApi.updateSchool(data);
      }
    },
    onSuccess: () => {
      toast.success('School profile updated');
      queryClient.invalidateQueries({ queryKey: ['settings', 'school'] });
    },
    onError: () => toast.error('Failed to save changes'),
  });

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg'] },
    maxFiles: 1,
    maxSize: 2 * 1024 * 1024,
  });

  return (
    <form onSubmit={handleSubmit((d) => save(d))} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Logo upload */}
        <div className="md:col-span-2">
          <label className={labelCx}>School Logo</label>
          <div className="flex items-start gap-4">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="School logo"
                className="w-16 h-16 rounded-xl object-contain border border-[var(--color-border)] bg-[var(--color-surface)] p-1 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center flex-shrink-0">
                <Upload className="w-5 h-5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
              </div>
            )}
            <div
              {...getRootProps()}
              className={clsx(
                'flex-1 border-2 border-dashed rounded-xl px-4 py-5 text-center cursor-pointer',
                'transition-all duration-200',
                isDragActive
                  ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                  : 'border-[var(--color-border)] hover:border-[var(--color-gold)]/50 hover:bg-[var(--color-surface)]',
              )}
            >
              <input {...getInputProps()} />
              <Upload className="w-5 h-5 text-[var(--color-text-muted)] mx-auto mb-1.5" strokeWidth={1.5} />
              <p className="text-sm text-[var(--color-text-muted)]">
                {isDragActive ? 'Drop image here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]/70 mt-0.5">PNG, JPG, SVG up to 2MB</p>
            </div>
          </div>
        </div>

        {/* School name */}
        <div>
          <label className={labelCx}>School Name</label>
          <input {...register('name')} className={inputCx(!!errors.name)} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        {/* School type */}
        <div>
          <label className={labelCx}>School Type</label>
          <select {...register('school_type')} className={clsx(inputCx(), 'cursor-pointer appearance-none')}>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="both">Primary & Secondary</option>
          </select>
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label className={labelCx}>Address</label>
          <input {...register('address')} placeholder="123 Education Road, Lagos" className={inputCx()} />
        </div>

        {/* Phone */}
        <div>
          <label className={labelCx}>Phone</label>
          <input {...register('phone')} placeholder="+234 801 234 5678" className={inputCx()} />
        </div>

        {/* Email */}
        <div>
          <label className={labelCx}>Email</label>
          <input {...register('email')} type="email" placeholder="info@school.edu.ng" className={inputCx(!!errors.email)} />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>

        {/* Motto */}
        <div className="md:col-span-2">
          <label className={labelCx}>Motto</label>
          <input {...register('motto')} placeholder="Excellence in Education" className={inputCx()} />
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
        <button
          type="submit"
          disabled={isPending || uploadingLogo || !isDirty && !logoFile}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
            'bg-[var(--color-navy)] text-white',
            'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
            'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          {(isPending || uploadingLogo) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
          Save Changes
        </button>
      </div>
    </form>
  );
}

// ── Grading System tab ────────────────────────────────────────────────────────

function GradingTab() {
  const queryClient = useQueryClient();

  const { data: grades, isLoading } = useQuery({
    queryKey: ['settings', 'grade-scales'],
    queryFn: () => settingsApi.gradeScales().then((r) => r.data),
    staleTime: 120_000,
  });

  const [localGrades, setLocalGrades] = useState<GradeScale[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (grades && !initialized) {
    setLocalGrades(grades);
    setInitialized(true);
  }

  const { mutate: saveGrades, isPending } = useMutation({
    mutationFn: () => settingsApi.updateGradeScales(localGrades),
    onSuccess: () => {
      toast.success('Grading system updated');
      queryClient.invalidateQueries({ queryKey: ['settings', 'grade-scales'] });
    },
    onError: () => toast.error('Failed to save grades'),
  });

  const update = (id: string, field: keyof GradeScale, value: string | number) => {
    setLocalGrades((g) =>
      g.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const displayGrades = localGrades.length > 0 ? localGrades : (grades ?? []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        Define grade boundaries used on report cards. Changes apply to all future assessments.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-navy)]">
                {['Grade', 'Min Score', 'Max Score', 'Remark'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white/80 tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {displayGrades.map((row, idx) => (
                <tr
                  key={row.id}
                  className={idx % 2 === 0 ? 'bg-[var(--color-cream)]' : 'bg-white'}
                >
                  <td className="px-4 py-2">
                    <input
                      value={row.grade}
                      onChange={(e) => update(row.id, 'grade', e.target.value)}
                      className="w-16 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-white focus:outline-none focus:border-[var(--color-gold)] font-mono font-bold"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={row.min_score}
                      onChange={(e) => update(row.id, 'min_score', Number(e.target.value))}
                      className="w-20 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-white focus:outline-none focus:border-[var(--color-gold)] font-mono tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={row.max_score}
                      onChange={(e) => update(row.id, 'max_score', Number(e.target.value))}
                      className="w-20 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-white focus:outline-none focus:border-[var(--color-gold)] font-mono tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={row.remark}
                      onChange={(e) => update(row.id, 'remark', e.target.value)}
                      className="w-full px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-white focus:outline-none focus:border-[var(--color-gold)]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
        <button
          onClick={() => saveGrades()}
          disabled={isPending || displayGrades.length === 0}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
            'bg-[var(--color-navy)] text-white',
            'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
            'transition-all duration-200',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
          Save Grades
        </button>
      </div>
    </div>
  );
}

// ── Academic Terms tab ────────────────────────────────────────────────────────

const TERM_LABELS = { first: '1st Term', second: '2nd Term', third: '3rd Term' };

function TermsTab() {
  const queryClient = useQueryClient();

  const { data: terms, isLoading } = useQuery({
    queryKey: ['settings', 'terms'],
    queryFn: () => settingsApi.terms().then((r) => r.data),
    staleTime: 60_000,
  });

  const [showForm, setShowForm] = useState(false);
  const [newTerm, setNewTerm] = useState({
    session: '',
    term: 'first' as 'first' | 'second' | 'third',
    start_date: '',
    end_date: '',
  });

  const { mutate: setCurrent, isPending: isSettingCurrent } = useMutation({
    mutationFn: (id: string) => settingsApi.setCurrentTerm(id),
    onSuccess: () => {
      toast.success('Current term updated');
      queryClient.invalidateQueries({ queryKey: ['settings', 'terms'] });
    },
    onError: () => toast.error('Failed to update term'),
  });

  const { mutate: createTerm, isPending: isCreating } = useMutation({
    mutationFn: () => settingsApi.createTerm(newTerm),
    onSuccess: () => {
      toast.success('Term created');
      setShowForm(false);
      setNewTerm({ session: '', term: 'first', start_date: '', end_date: '' });
      queryClient.invalidateQueries({ queryKey: ['settings', 'terms'] });
    },
    onError: () => toast.error('Failed to create term'),
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(terms ?? []).map((term) => (
            <div
              key={term.id}
              className={clsx(
                'flex items-center gap-4 px-4 py-3.5 rounded-xl border',
                'transition-all duration-200',
                term.is_current
                  ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                  : 'border-[var(--color-border)] bg-white hover:bg-[var(--color-surface)]',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {term.session}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {TERM_LABELS[term.term]}
                  </span>
                  {term.is_current && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-gold)] text-[var(--color-navy)]">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono tabular-nums">
                  {term.start_date} → {term.end_date}
                </p>
              </div>
              {!term.is_current && (
                <button
                  onClick={() => setCurrent(term.id)}
                  disabled={isSettingCurrent}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer',
                    'bg-[var(--color-surface)] border border-[var(--color-border)]',
                    'hover:bg-[var(--color-navy)] hover:text-white hover:border-[var(--color-navy)]',
                    'transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <Check className="w-3 h-3" strokeWidth={2} />
                  Set as Current
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="rounded-xl border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">New Academic Term</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCx}>Session (e.g. 2024/2025)</label>
              <input
                value={newTerm.session}
                onChange={(e) => setNewTerm((t) => ({ ...t, session: e.target.value }))}
                placeholder="2024/2025"
                className={inputCx()}
              />
            </div>
            <div>
              <label className={labelCx}>Term</label>
              <select
                value={newTerm.term}
                onChange={(e) => setNewTerm((t) => ({ ...t, term: e.target.value as 'first' | 'second' | 'third' }))}
                className={clsx(inputCx(), 'cursor-pointer appearance-none')}
              >
                <option value="first">1st Term</option>
                <option value="second">2nd Term</option>
                <option value="third">3rd Term</option>
              </select>
            </div>
            <div>
              <label className={labelCx}>Start Date</label>
              <input
                type="date"
                value={newTerm.start_date}
                onChange={(e) => setNewTerm((t) => ({ ...t, start_date: e.target.value }))}
                className={inputCx()}
              />
            </div>
            <div>
              <label className={labelCx}>End Date</label>
              <input
                type="date"
                value={newTerm.end_date}
                onChange={(e) => setNewTerm((t) => ({ ...t, end_date: e.target.value }))}
                className={inputCx()}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => createTerm()}
              disabled={isCreating || !newTerm.session || !newTerm.start_date || !newTerm.end_date}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white',
                'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                'transition-all duration-200',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Term
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className={clsx(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer',
            'border border-dashed border-[var(--color-border)]',
            'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-navy)]',
            'hover:bg-[var(--color-surface)] transition-all duration-200',
          )}
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          Add Term
        </button>
      )}
    </div>
  );
}

// ── Report Format tab ─────────────────────────────────────────────────────────

function ReportFormatTab({ settings }: { settings: SchoolSettings | undefined }) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      report_header:        settings?.report_header ?? settings?.name ?? '',
      motto:                settings?.motto ?? '',
      report_logo_position: settings?.report_logo_position ?? 'center',
    },
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data: Partial<SchoolSettings>) => settingsApi.updateSchool(data),
    onSuccess: () => {
      toast.success('Report format saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'school'] });
    },
    onError: () => toast.error('Failed to save'),
  });

  return (
    <form onSubmit={handleSubmit((d) => save(d))} className="space-y-5">
      <div>
        <label className={labelCx}>Report Card Header Text</label>
        <input
          {...register('report_header')}
          placeholder="Excellence Secondary School, Lagos"
          className={inputCx()}
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Appears at the top of every student report card.
        </p>
      </div>

      <div>
        <label className={labelCx}>School Motto</label>
        <input
          {...register('motto')}
          placeholder="Excellence in Education"
          className={inputCx()}
        />
      </div>

      <div>
        <label className={labelCx}>Logo Position on Report</label>
        <div className="flex items-center gap-3 mt-1">
          {(['left', 'center', 'right'] as const).map((pos) => (
            <label
              key={pos}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer',
                'text-sm font-medium transition-all duration-150',
              )}
            >
              <input
                type="radio"
                value={pos}
                {...register('report_logo_position')}
                className="accent-[var(--color-navy)]"
              />
              {pos.charAt(0).toUpperCase() + pos.slice(1)}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
        <button
          type="submit"
          disabled={isPending || !isDirty}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
            'bg-[var(--color-navy)] text-white',
            'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
            'transition-all duration-200',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
          Save Format
        </button>
      </div>
    </form>
  );
}

// ── System tab ────────────────────────────────────────────────────────────────

function SystemTab() {
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Data export */}
      <div className="rounded-xl border border-[var(--color-border)] p-5">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Data Export</h4>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Download a full export of all school data including students, results, and payment records.
        </p>
        <button
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
            'bg-[var(--color-surface)] border border-[var(--color-border)]',
            'text-[var(--color-text-primary)]',
            'hover:bg-[var(--color-border)] active:scale-[0.98]',
            'transition-all duration-200',
          )}
        >
          <Download className="w-4 h-4" strokeWidth={1.5} />
          Export School Data
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800 mb-1">Danger Zone</h4>
            <p className="text-sm text-red-700/80 mb-4">
              Deactivating this school will immediately revoke access for all users. This action cannot be undone.
            </p>
            <button
              onClick={() => setDeactivateOpen(true)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-red-600 text-white',
                'hover:bg-red-700 active:scale-[0.98]',
                'transition-all duration-200',
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
              Deactivate School
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={() => {
          toast.error('School deactivation requires contacting support.');
          setDeactivateOpen(false);
        }}
        title="Deactivate this school?"
        description="All users will lose access immediately. Student records, results, and payment history will be preserved but inaccessible. Contact support to reverse this."
        confirmLabel="Deactivate School"
        variant="danger"
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'school'],
    queryFn: () => settingsApi.school().then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Configure your school's profile, grading, and system preferences"
      />

      <div className="card-shell">
        <div className="card-core">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-[var(--color-border)] overflow-x-auto px-5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  'px-4 py-3.5 text-sm font-medium whitespace-nowrap cursor-pointer',
                  'border-b-2 -mb-px transition-colors duration-150',
                  activeTab === tab.key
                    ? 'border-[var(--color-gold)] text-[var(--color-text-primary)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {isLoading && activeTab === 'profile' ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="skeleton h-3 w-24 rounded" />
                    <div className="skeleton h-9 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {activeTab === 'profile'  && <ProfileTab settings={settings} />}
                {activeTab === 'grading'  && <GradingTab />}
                {activeTab === 'terms'    && <TermsTab />}
                {activeTab === 'report'   && <ReportFormatTab settings={settings} />}
                {activeTab === 'system'   && <SystemTab />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
