'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

import { PageHeader } from '@/components/shared/PageHeader';
import { classesApi, studentsApi } from '@/lib/api';
import type { CreateStudentRequest, Student, UpdateStudentRequest } from '@/types/student';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENOTYPES = ['AA', 'AS', 'SS', 'AC', 'SC'];
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara',
];

type FormState = Required<Omit<CreateStudentRequest, 'photo_url'>> & { photo_url: string };

const emptyForm: FormState = {
  admission_number: '', first_name: '', last_name: '', middle_name: '',
  date_of_birth: '', gender: 'male', address: '', state_of_origin: '', religion: '',
  blood_group: '', genotype: '', class_id: '', photo_url: '', admission_date: '',
};

const inputCls = clsx(
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm',
  'text-[var(--color-text-primary)] focus:border-[var(--color-gold)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30',
);

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
      <span>{label}{required && <span className="ml-0.5 text-red-500">*</span>}</span>
      {children}
    </label>
  );
}

function errorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  if (response?.status === 404) return 'Student not found or is not available in this school.';
  if (response?.status === 403) return 'You do not have permission to edit this student.';
  if (Array.isArray(response?.data?.detail)) {
    return response.data.detail.map((item) => {
      const issue = item as { msg?: string; loc?: Array<string | number> };
      const field = issue.loc?.at(-1);
      return `${field ? `${String(field).replaceAll('_', ' ')}: ` : ''}${issue.msg ?? 'Invalid value'}`;
    }).join('; ');
  }
  return typeof response?.data?.detail === 'string' ? response.data.detail : 'Failed to update student. Please try again.';
}

export function StudentEditForm({ dashboardRole }: { dashboardRole: 'admin' | 'super-admin' }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const basePath = `/dashboard/${dashboardRole}/students`;
  const [form, setForm] = useState<FormState>(emptyForm);

  const studentQuery = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.get(id).then((response) => response.data),
    retry: false,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((response) => response.data.items),
    staleTime: 120_000,
  });

  useEffect(() => {
    const student = studentQuery.data;
    if (!student) return;
    setForm({
      admission_number: student.admission_number,
      first_name: student.first_name,
      last_name: student.last_name,
      middle_name: student.middle_name ?? '',
      date_of_birth: student.date_of_birth,
      gender: student.gender,
      address: student.address ?? '',
      state_of_origin: student.state_of_origin ?? '',
      religion: student.religion ?? '',
      blood_group: student.blood_group ?? '',
      genotype: student.genotype ?? '',
      class_id: student.class_id ?? '',
      photo_url: student.photo_url ?? '',
      admission_date: student.admission_date,
    });
  }, [studentQuery.data]);

  const update = useMutation({
    mutationFn: (payload: UpdateStudentRequest) => studentsApi.update(id, payload),
    onSuccess: (response) => {
      queryClient.setQueryData<Student>(['student', id], response.data);
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student updated successfully');
      router.push(`${basePath}/${id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const set = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.admission_number.trim() || !form.date_of_birth || !form.admission_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    update.mutate({
      ...form,
      first_name: form.first_name.trim(), last_name: form.last_name.trim(), admission_number: form.admission_number.trim(),
      middle_name: form.middle_name.trim() || null, address: form.address.trim() || null,
      state_of_origin: form.state_of_origin || null, religion: form.religion.trim() || null,
      blood_group: form.blood_group || null, genotype: form.genotype || null,
      class_id: form.class_id || null, photo_url: form.photo_url || null,
    });
  };

  if (studentQuery.isLoading) return <div className="card-shell"><div className="card-core h-64 animate-pulse" /></div>;
  if (studentQuery.isError || !studentQuery.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm text-red-600">{errorMessage(studentQuery.error)}</p>
        <button onClick={() => router.push(basePath)} className="text-sm text-[var(--color-navy)] underline">Back to students</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Edit Student" description={`Update ${studentQuery.data.full_name ?? `${studentQuery.data.first_name} ${studentQuery.data.last_name}`}`} breadcrumbs={[{ label: 'Students', href: basePath }, { label: studentQuery.data.full_name ?? studentQuery.data.first_name, href: `${basePath}/${id}` }, { label: 'Edit' }]} />
      <form onSubmit={submit} className="flex flex-col gap-5">
        <FormSection title="Personal Information">
          <Field label="First Name" required><input className={inputCls} value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required /></Field>
          <Field label="Middle Name"><input className={inputCls} value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} /></Field>
          <Field label="Last Name" required><input className={inputCls} value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required /></Field>
          <Field label="Date of Birth" required><input type="date" className={inputCls} value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} required /></Field>
          <Field label="Gender" required><select className={inputCls} value={form.gender} onChange={(e) => set('gender', e.target.value)}><option value="male">Male</option><option value="female">Female</option></select></Field>
          <Field label="Religion"><input className={inputCls} value={form.religion} onChange={(e) => set('religion', e.target.value)} /></Field>
        </FormSection>
        <FormSection title="Academic Information">
          <Field label="Admission Number" required><input className={inputCls} value={form.admission_number} onChange={(e) => set('admission_number', e.target.value)} required /></Field>
          <Field label="Admission Date" required><input type="date" className={inputCls} value={form.admission_date} onChange={(e) => set('admission_date', e.target.value)} required /></Field>
          <Field label="Class"><select className={inputCls} value={form.class_id} onChange={(e) => set('class_id', e.target.value)}><option value="">No class assigned</option>{(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        </FormSection>
        <FormSection title="Medical, Origin & Contact">
          <Field label="Blood Group"><select className={inputCls} value={form.blood_group} onChange={(e) => set('blood_group', e.target.value)}><option value="">Not provided</option>{BLOOD_GROUPS.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Genotype"><select className={inputCls} value={form.genotype} onChange={(e) => set('genotype', e.target.value)}><option value="">Not provided</option>{GENOTYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="State of Origin"><select className={inputCls} value={form.state_of_origin} onChange={(e) => set('state_of_origin', e.target.value)}><option value="">Not provided</option>{NIGERIAN_STATES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Home Address"><input className={inputCls} value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
        </FormSection>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push(`${basePath}/${id}`)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium">Cancel</button>
          <button type="submit" disabled={update.isPending} className="rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{update.isPending ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card-shell"><div className="card-core p-5"><h2 className="mb-4 font-display text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div></div></div>;
}
