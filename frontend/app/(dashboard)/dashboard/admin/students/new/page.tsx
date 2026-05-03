'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { RefreshCw, Loader2 } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { studentsApi, classesApi } from '@/lib/api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENOTYPES = ['AA', 'AS', 'SS', 'AC', 'SC'];
const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
];

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  middle_name: z.string().optional(),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female']),
  state_of_origin: z.string().optional(),
  religion: z.string().optional(),
  blood_group: z.string().optional(),
  genotype: z.string().optional(),
  address: z.string().optional(),
  admission_number: z.string().min(1, 'Admission number is required'),
  admission_date: z.string().min(1, 'Admission date is required'),
  class_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const inputCls = (hasError: boolean) => clsx(
  'w-full text-sm rounded-lg px-3 py-2',
  'bg-[var(--color-surface)] border',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
  'focus:outline-none focus:ring-2 transition-all duration-150',
  hasError
    ? 'border-red-400 focus:ring-red-200'
    : 'border-[var(--color-border)] focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]/50',
);

const selectCls = (hasError: boolean) => clsx(inputCls(hasError), 'cursor-pointer');

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p>}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

export default function AdminNewStudentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [generatingAdmNo, setGeneratingAdmNo] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((r) => r.data),
    staleTime: 120_000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gender: 'male' },
  });

  useEffect(() => {
    setValue('admission_date', new Date().toISOString().split('T')[0]);
  }, [setValue]);

  const { mutate: create, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      return studentsApi.create({
        ...data,
        middle_name: data.middle_name || undefined,
        address: data.address || undefined,
        state_of_origin: data.state_of_origin || undefined,
        religion: data.religion || undefined,
        blood_group: data.blood_group || undefined,
        genotype: data.genotype || undefined,
        class_id: data.class_id || undefined,
      });
    },
    onSuccess: (res) => {
      toast.success('Student added successfully');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      router.push(`/dashboard/admin/students/${res.data.id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to add student';
      toast.error(typeof msg === 'string' ? msg : 'Failed to add student');
    },
  });

  const handleGenerateAdmNo = async () => {
    setGeneratingAdmNo(true);
    try {
      const res = await studentsApi.generateAdmissionNumber();
      setValue('admission_number', res.data.admission_number, { shouldValidate: true });
    } catch {
      const year = new Date().getFullYear();
      const rand = String(Math.floor(Math.random() * 900) + 100);
      setValue('admission_number', `SCH/${year}/${rand}`, { shouldValidate: true });
    } finally {
      setGeneratingAdmNo(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Add Student"
        description="Create a new student record"
        breadcrumbs={[
          { label: 'Students', href: '/dashboard/admin/students' },
          { label: 'Add Student' },
        ]}
      />

      <form onSubmit={handleSubmit((data) => create(data))} className="flex flex-col gap-5">
        {/* Personal Info */}
        <div className="card-shell">
          <div className="card-core p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display mb-4">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="First Name" required error={errors.first_name?.message}>
                <input
                  {...register('first_name')}
                  className={inputCls(!!errors.first_name)}
                  placeholder="Chukwuemeka"
                />
              </Field>
              <Field label="Middle Name" error={errors.middle_name?.message}>
                <input
                  {...register('middle_name')}
                  className={inputCls(!!errors.middle_name)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Last Name" required error={errors.last_name?.message}>
                <input
                  {...register('last_name')}
                  className={inputCls(!!errors.last_name)}
                  placeholder="Okonkwo"
                />
              </Field>
              <Field label="Date of Birth" required error={errors.date_of_birth?.message}>
                <input
                  type="date"
                  {...register('date_of_birth')}
                  className={inputCls(!!errors.date_of_birth)}
                />
              </Field>
              <Field label="Gender" required error={errors.gender?.message}>
                <select {...register('gender')} className={selectCls(!!errors.gender)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
              <Field label="Religion" error={errors.religion?.message}>
                <input
                  {...register('religion')}
                  className={inputCls(!!errors.religion)}
                  placeholder="Christianity, Islam…"
                />
              </Field>
              <Field label="State of Origin" error={errors.state_of_origin?.message}>
                <select {...register('state_of_origin')} className={selectCls(!!errors.state_of_origin)}>
                  <option value="">Select state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Blood Group" error={errors.blood_group?.message}>
                <select {...register('blood_group')} className={selectCls(!!errors.blood_group)}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </Field>
              <Field label="Genotype" error={errors.genotype?.message}>
                <select {...register('genotype')} className={selectCls(!!errors.genotype)}>
                  <option value="">Select genotype</option>
                  {GENOTYPES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="card-shell">
          <div className="card-core p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display mb-4">
              Contact
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Home Address" error={errors.address?.message} hint="Street, city or area">
                <input
                  {...register('address')}
                  className={inputCls(!!errors.address)}
                  placeholder="14 Awolowo Road, Surulere, Lagos"
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
              <Field
                label="Admission Number"
                required
                error={errors.admission_number?.message}
                hint="Must be unique across the school"
              >
                <div className="flex gap-1.5">
                  <input
                    {...register('admission_number')}
                    className={clsx(inputCls(!!errors.admission_number), 'flex-1')}
                    placeholder="SCH/2025/001"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateAdmNo}
                    disabled={generatingAdmNo}
                    title="Auto-generate"
                    className={clsx(
                      'flex-shrink-0 p-2 rounded-lg border cursor-pointer',
                      'bg-[var(--color-surface)] border-[var(--color-border)]',
                      'text-[var(--color-text-muted)] hover:text-[var(--color-navy)] hover:border-[var(--color-navy)]/30',
                      'transition-all duration-150 disabled:opacity-50',
                    )}
                  >
                    <RefreshCw className={clsx('w-4 h-4', generatingAdmNo && 'animate-spin')} strokeWidth={1.5} />
                  </button>
                </div>
              </Field>
              <Field label="Admission Date" required error={errors.admission_date?.message}>
                <input
                  type="date"
                  {...register('admission_date')}
                  className={inputCls(!!errors.admission_date)}
                />
              </Field>
              <Field label="Class" error={errors.class_id?.message}>
                <select {...register('class_id')} className={selectCls(!!errors.class_id)}>
                  <option value="">Select class (optional)</option>
                  {(classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
              'text-[var(--color-text-primary)] hover:bg-[var(--color-border)]',
              'transition-all duration-200',
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
              'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? 'Saving…' : 'Add Student'}
          </button>
        </div>
      </form>
    </div>
  );
}
