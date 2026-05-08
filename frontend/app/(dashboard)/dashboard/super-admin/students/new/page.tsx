'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { studentsApi, classesApi } from '@/lib/api';
import type { CreateStudentRequest } from '@/types/student';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENOTYPES = ['AA', 'AS', 'SS', 'AC', 'SC'];
const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
];

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, required, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

const inputCls = clsx(
  'w-full text-sm rounded-lg px-3 py-2',
  'bg-[var(--color-surface)] border border-[var(--color-border)]',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]/50',
  'transition-all duration-150',
);

const selectCls = clsx(inputCls, 'cursor-pointer');

export default function NewStudentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((r) => r.data.items),
    staleTime: 120_000,
  });

  const [form, setForm] = useState<CreateStudentRequest>({
    admission_number: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    date_of_birth: '',
    gender: 'male',
    address: '',
    state_of_origin: '',
    religion: '',
    blood_group: '',
    genotype: '',
    class_id: '',
    admission_date: '',
  });

  useEffect(() => {
    setForm((f) => ({ ...f, admission_date: new Date().toISOString().split('T')[0] }));
  }, []);

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => {
      const payload: CreateStudentRequest = {
        ...form,
        middle_name: form.middle_name || undefined,
        address: form.address || undefined,
        state_of_origin: form.state_of_origin || undefined,
        religion: form.religion || undefined,
        blood_group: form.blood_group || undefined,
        genotype: form.genotype || undefined,
        class_id: form.class_id || undefined,
      };
      return studentsApi.create(payload);
    },
    onSuccess: (res) => {
      toast.success('Student added successfully');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      router.push(`/dashboard/super-admin/students/${res.data.id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to add student';
      toast.error(typeof msg === 'string' ? msg : 'Failed to add student');
    },
  });

  const set = (k: keyof CreateStudentRequest, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.admission_number || !form.first_name || !form.last_name || !form.date_of_birth || !form.admission_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    create();
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Add Student"
        description="Create a new student record"
        breadcrumbs={[
          { label: 'Students', href: '/dashboard/super-admin/students' },
          { label: 'Add Student' },
        ]}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Basic Info */}
        <div className="card-shell">
          <div className="card-core p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display mb-4">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="First Name" required>
                <input
                  className={inputCls}
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  placeholder="Enter first name"
                  required
                />
              </Field>
              <Field label="Middle Name">
                <input
                  className={inputCls}
                  value={form.middle_name}
                  onChange={(e) => set('middle_name', e.target.value)}
                  placeholder="Enter middle name (optional)"
                />
              </Field>
              <Field label="Last Name" required>
                <input
                  className={inputCls}
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  placeholder="Enter last name"
                  required
                />
              </Field>
              <Field label="Date of Birth" required>
                <input
                  type="date"
                  className={inputCls}
                  value={form.date_of_birth}
                  onChange={(e) => set('date_of_birth', e.target.value)}
                  required
                />
              </Field>
              <Field label="Gender" required>
                <select
                  className={selectCls}
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value as 'male' | 'female')}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
              <Field label="Religion">
                <input
                  className={inputCls}
                  value={form.religion}
                  onChange={(e) => set('religion', e.target.value)}
                  placeholder="e.g. Christianity, Islam"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Academic Info */}
        <div className="card-shell">
          <div className="card-core p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display mb-4">
              Academic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Admission Number" required hint="Must be unique across the school">
                <input
                  className={inputCls}
                  value={form.admission_number}
                  onChange={(e) => set('admission_number', e.target.value)}
                  placeholder="e.g. SCH/2024/001"
                  required
                />
              </Field>
              <Field label="Admission Date" required>
                <input
                  type="date"
                  className={inputCls}
                  value={form.admission_date}
                  onChange={(e) => set('admission_date', e.target.value)}
                  required
                />
              </Field>
              <Field label="Class">
                <select
                  className={selectCls}
                  value={form.class_id}
                  onChange={(e) => set('class_id', e.target.value)}
                >
                  <option value="">Select class (optional)</option>
                  {(classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* Medical & Origin */}
        <div className="card-shell">
          <div className="card-core p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display mb-4">
              Medical & Origin
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Blood Group">
                <select
                  className={selectCls}
                  value={form.blood_group}
                  onChange={(e) => set('blood_group', e.target.value)}
                >
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </Field>
              <Field label="Genotype">
                <select
                  className={selectCls}
                  value={form.genotype}
                  onChange={(e) => set('genotype', e.target.value)}
                >
                  <option value="">Select genotype</option>
                  {GENOTYPES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </Field>
              <Field label="State of Origin">
                <select
                  className={selectCls}
                  value={form.state_of_origin}
                  onChange={(e) => set('state_of_origin', e.target.value)}
                >
                  <option value="">Select state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Home Address" hint="Street, city or area">
                <input
                  className={inputCls}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="Enter home address"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-surface)] border border-[var(--color-border)]',
              'text-[var(--color-text-primary)]',
              'hover:bg-[var(--color-border)] transition-all duration-200',
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
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isPending ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : null}
            {isPending ? 'Saving…' : 'Add Student'}
          </button>
        </div>
      </form>
    </div>
  );
}
