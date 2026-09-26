'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Loader2, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { parentsApi, studentsApi } from '@/lib/api';
import type { ParentListItem, CreateParentRequest } from '@/types/parent';
import type { StudentListItem } from '@/types/student';

const PERMISSIONS = [
  ['can_receive_messages', 'Receive school messages'],
  ['can_view_attendance', 'View attendance'],
  ['can_view_results', 'View results'],
  ['can_view_assignments', 'View assignments'],
  ['can_view_finance', 'View finance'],
  ['can_pick_up', 'Authorized pickup'],
] as const;

const inputCx = clsx(
  'input-base w-full px-3 py-2.5 text-sm rounded-lg',
  'bg-[var(--color-surface)] border border-[var(--color-border)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]',
  'transition-all duration-150',
);

function Frame({ title, description, icon: Icon, onClose, busy = false, children }: { title: string; description?: string; icon: typeof UserRound; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', key); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = ''; };
  }, [busy, onClose]);
  if (!mounted) return null;
  return createPortal(<div className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-5" onMouseDown={event => { if (event.currentTarget === event.target && !busy) onClose(); }}>
    <div className="absolute inset-0 bg-[var(--color-navy)]/60 backdrop-blur-sm" />
    <div role="dialog" aria-modal="true" aria-labelledby="parent-modal-title" className="relative z-10 max-h-[94dvh] w-full max-w-3xl overflow-hidden rounded-[1.25rem] bg-black/[0.03] p-1.5 ring-1 ring-black/5 animate-fade-in-up">
      <div className="flex max-h-[calc(94dvh-12px)] flex-col overflow-hidden rounded-[calc(1.25rem-0.375rem)] bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-navy)]/10"><Icon className="h-[18px] w-[18px] text-[var(--color-navy)]" strokeWidth={1.5} /></div>
          <div className="min-w-0 flex-1"><h2 id="parent-modal-title" className="font-display text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>{description && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p>}</div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] disabled:opacity-40" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  </div>, document.body);
}

function studentFromDetail(student: Awaited<ReturnType<typeof studentsApi.get>>['data']): StudentListItem {
  return { id: student.id, admission_number: student.admission_number, full_name: student.full_name ?? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' '), first_name: student.first_name, last_name: student.last_name, middle_name: student.middle_name, gender: student.gender, photo_url: student.photo_url, class_id: student.class_id, class_name: student.class_name, is_active: student.is_active, admission_date: student.admission_date };
}

function StudentCard({ student, selected, onSelect }: { student: StudentListItem; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className={clsx('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all', selected ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/8 ring-2 ring-[var(--color-gold)]/15' : 'border-[var(--color-border)] bg-white hover:border-[var(--color-navy)]/30 hover:bg-[var(--color-surface)]')}>
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)]/10 text-sm font-bold text-[var(--color-navy)]">{student.first_name?.[0] ?? student.full_name[0]}{student.last_name?.[0] ?? ''}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{student.full_name}</p><p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]"><span className="font-mono">{student.admission_number}</span><span className="px-1.5">·</span>{student.class_name ?? 'Class not assigned'}<span className="px-1.5">·</span><span className="capitalize">{student.gender}</span></p></div>
    <div className={clsx('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border', selected ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-[var(--color-navy)]' : 'border-[var(--color-border)]')} >{selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}</div>
  </button>;
}

export function InviteParentModal({ onClose, initialStudentId = '' }: { onClose: () => void; initialStudentId?: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState(''); const [debouncedSearch, setDebouncedSearch] = useState(''); const [selectedStudent, setSelectedStudent] = useState<StudentListItem | null>(null);
  const [form, setForm] = useState<CreateParentRequest>({ student_id: initialStudentId, name: '', email: '', phone: '', relationship_type: 'guardian', address: '', occupation: '', is_primary: false, is_emergency_contact: false, can_receive_messages: true, can_view_attendance: true, can_view_results: true, can_view_assignments: true, can_view_finance: false, can_pick_up: false });
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const initialStudent = useQuery({ queryKey: ['student', initialStudentId, 'invite-context'], queryFn: () => studentsApi.get(initialStudentId).then(r => r.data), enabled: Boolean(initialStudentId), staleTime: 60_000 });
  useEffect(() => { if (initialStudent.data && !selectedStudent) setSelectedStudent(studentFromDetail(initialStudent.data)); }, [initialStudent.data, selectedStudent]);
  const students = useQuery({ queryKey: ['students', 'guardian-picker', debouncedSearch], queryFn: () => studentsApi.list({ page: 1, per_page: 20, search: debouncedSearch, is_active: true }).then(r => r.data), enabled: debouncedSearch.length >= 2, staleTime: 30_000 });
  const chooseStudent = (student: StudentListItem) => { setSelectedStudent(student); setForm(current => ({ ...current, student_id: student.id })); };
  const mutation = useMutation({ mutationFn: () => parentsApi.create({ ...form, student_id: selectedStudent!.id }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['parents'] }); qc.invalidateQueries({ queryKey: ['student', selectedStudent!.id, 'guardians'] }); toast.success(`Invitation created for ${selectedStudent!.full_name}'s guardian`); onClose(); }, onError: (error: unknown) => { const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail; toast.error(typeof detail === 'string' ? detail : 'Could not create parent invitation'); } });
  const set = <K extends keyof CreateParentRequest>(key: K, value: CreateParentRequest[K]) => setForm(current => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!selectedStudent) { toast.error('Find and select the student first'); return; } mutation.mutate(); };

  return <Frame title="Invite parent or guardian" description="Link a verified guardian to the correct student and configure their access." icon={UserRound} onClose={onClose} busy={mutation.isPending}>
    <form onSubmit={submit} className="flex flex-col">
      <section className="border-b border-[var(--color-border)] px-5 py-5 sm:px-6"><div className="mb-3 flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-navy)] text-[10px] font-bold text-white">1</span><h3 className="text-sm font-semibold">Find and select student</h3></div>
        {selectedStudent ? <div><StudentCard student={selectedStudent} selected onSelect={() => undefined} />{!initialStudentId && <button type="button" onClick={() => { setSelectedStudent(null); set('student_id', ''); setSearch(''); }} className="mt-2 text-xs font-semibold text-[var(--color-navy)] hover:underline">Choose a different student</button>}</div> : <>
          <div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" /><input autoFocus value={search} onChange={event => setSearch(event.target.value)} className={clsx(inputCx, 'pl-10')} placeholder="Search by full name or admission number" aria-label="Find student" /></div>
          <div className="mt-3 min-h-16">{search.trim().length < 2 ? <p className="rounded-lg bg-[var(--color-surface)] px-3 py-3 text-xs text-[var(--color-text-muted)]">Enter at least two characters. You can use a first name, surname, full name, or admission number.</p> : students.isLoading || students.isFetching ? <div className="flex items-center justify-center gap-2 py-5 text-sm text-[var(--color-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Searching students…</div> : students.isError ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Student search failed. <button type="button" onClick={() => students.refetch()} className="font-semibold underline">Try again</button></div> : students.data?.items.length ? <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">{students.data.items.map(student => <StudentCard key={student.id} student={student} selected={false} onSelect={() => chooseStudent(student)} />)}</div> : <div className="rounded-lg border border-dashed border-[var(--color-border)] p-5 text-center"><p className="text-sm font-medium">No matching students</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">Check the spelling or try the admission number.</p></div>}</div>
        </>}
      </section>

      <section className={clsx('border-b border-[var(--color-border)] px-5 py-5 transition-opacity sm:px-6', !selectedStudent && 'pointer-events-none opacity-45')}><div className="mb-4 flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-navy)] text-[10px] font-bold text-white">2</span><h3 className="text-sm font-semibold">Guardian information</h3></div><div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium">Full name<input required className={clsx(inputCx, 'mt-1.5')} value={form.name} onChange={event => set('name', event.target.value)} placeholder="Parent or guardian name" /></label>
        <label className="text-xs font-medium">Relationship<select className={clsx(inputCx, 'mt-1.5')} value={form.relationship_type} onChange={event => set('relationship_type', event.target.value as CreateParentRequest['relationship_type'])}><option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option><option value="other">Other</option></select></label>
        <label className="text-xs font-medium">Email address<input required type="email" className={clsx(inputCx, 'mt-1.5')} value={form.email} onChange={event => set('email', event.target.value)} placeholder="parent@example.com" /></label>
        <label className="text-xs font-medium">Phone number <span className="font-normal text-[var(--color-text-muted)]">(optional)</span><input className={clsx(inputCx, 'mt-1.5')} value={form.phone} onChange={event => set('phone', event.target.value)} placeholder="0801 234 5678" /></label>
        <label className="text-xs font-medium sm:col-span-2">Home address <span className="font-normal text-[var(--color-text-muted)]">(optional)</span><input className={clsx(inputCx, 'mt-1.5')} value={form.address ?? ''} onChange={event => set('address', event.target.value)} /></label>
      </div></section>

      <section className={clsx('px-5 py-5 transition-opacity sm:px-6', !selectedStudent && 'pointer-events-none opacity-45')}><div className="mb-4 flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-navy)] text-[10px] font-bold text-white">3</span><h3 className="text-sm font-semibold">Relationship and access</h3></div><div className="grid gap-2.5 sm:grid-cols-2">{PERMISSIONS.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border)] p-3 text-sm hover:bg-[var(--color-surface)]"><input type="checkbox" className="h-4 w-4 accent-[var(--color-navy)]" checked={Boolean(form[key])} onChange={event => set(key, event.target.checked)} />{label}</label>)}<label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border)] p-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--color-navy)]" checked={form.is_primary} onChange={event => set('is_primary', event.target.checked)} />Primary guardian</label><label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border)] p-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--color-navy)]" checked={form.is_emergency_contact} onChange={event => set('is_emergency_contact', event.target.checked)} />Emergency contact</label></div></section>

      <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--color-border)] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">{selectedStudent ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" />Invitation will be linked to <strong className="text-[var(--color-text-primary)]">{selectedStudent.full_name}</strong></> : <><ShieldCheck className="h-4 w-4" />Select a student before continuing</>}</div><div className="flex gap-2"><button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium">Cancel</button><button type="submit" disabled={!selectedStudent || mutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-gold)] px-4 py-2 text-sm font-semibold text-[var(--color-navy)] transition-all hover:bg-[var(--color-gold-light)] disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{mutation.isPending ? 'Creating invitation…' : 'Create invitation'}</button></div></footer>
    </form>
  </Frame>;
}

export function ParentDetailsModal({ parent, onClose }: { parent: ParentListItem; onClose: () => void }) {
  const qc = useQueryClient();
  const action = useMutation({ mutationFn: (kind: 'resend' | 'enable' | 'disable') => kind === 'resend' ? parentsApi.resendInvite(parent.guardian_id) : kind === 'enable' ? parentsApi.enable(parent.guardian_id) : parentsApi.disable(parent.guardian_id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['parents'] }); toast.success('Parent account updated'); }, onError: () => toast.error('Account update failed') });
  return <Frame title={parent.name} description="Parent account and linked-child access" icon={UserRound} onClose={onClose} busy={action.isPending}><div className="space-y-5 p-5 sm:p-6"><div className="grid gap-3 rounded-xl bg-[var(--color-surface)] p-4 text-sm sm:grid-cols-2"><p><span className="text-[var(--color-text-muted)]">Email</span><br />{parent.email}</p><p><span className="text-[var(--color-text-muted)]">Phone</span><br />{parent.phone || 'Not provided'}</p><p><span className="text-[var(--color-text-muted)]">Account</span><br /><span className="capitalize">{parent.activation_status}</span></p><p><span className="text-[var(--color-text-muted)]">Invitation</span><br /><span className="capitalize">{parent.invitation_status}</span></p></div><section><h3 className="text-sm font-semibold">Linked children</h3><div className="mt-2 space-y-2">{parent.relationships.length ? parent.relationships.map(relationship => <div key={relationship.relationship_id} className="rounded-xl border border-[var(--color-border)] p-3 text-sm"><div className="flex justify-between"><strong>{relationship.guardian_name || 'Student relationship'}</strong><span className="capitalize text-[var(--color-text-muted)]">{relationship.relationship_type}</span></div><p className="mt-1 text-xs text-[var(--color-text-muted)]">{[relationship.can_view_attendance && 'Attendance', relationship.can_view_results && 'Results', relationship.can_view_assignments && 'Assignments', relationship.can_view_finance && 'Finance', relationship.can_receive_messages && 'Messages'].filter(Boolean).join(' · ') || 'No data permissions'}</p></div>) : <p className="text-sm text-[var(--color-text-muted)]">No active children.</p>}</div></section><div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">{parent.invitation_status !== 'accepted' && <button onClick={() => action.mutate('resend')} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">Resend invitation</button>}{parent.membership_active ? <button onClick={() => action.mutate('disable')} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Disable account</button> : <button onClick={() => action.mutate('enable')} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Enable account</button>}</div></div></Frame>;
}
