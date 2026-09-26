'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { parentsApi, studentsApi } from '@/lib/api';
import type { ParentListItem, CreateParentRequest } from '@/types/parent';

const PERMISSIONS = [
  ['can_receive_messages', 'Receive school messages'],
  ['can_view_attendance', 'View attendance'],
  ['can_view_results', 'View results'],
  ['can_view_assignments', 'View assignments'],
  ['can_view_finance', 'View finance'],
  ['can_pick_up', 'Authorized pickup'],
] as const;

function Frame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={e => e.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><h2 className="font-display text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
      {children}
    </div>
  </div>;
}

export function InviteParentModal({ onClose, initialStudentId = '' }: { onClose: () => void; initialStudentId?: string }) {
  const qc = useQueryClient();
  const [studentSearch, setStudentSearch] = useState('');
  const students = useQuery({ queryKey: ['students', 'guardian-picker', studentSearch], queryFn: () => studentsApi.list({ page: 1, per_page: 30, search: studentSearch || undefined }).then(r => r.data) });
  const [form, setForm] = useState<CreateParentRequest>({ student_id: initialStudentId, name: '', email: '', phone: '', relationship_type: 'guardian', is_primary: false, is_emergency_contact: false, can_receive_messages: true, can_view_attendance: true, can_view_results: true, can_view_assignments: true, can_view_finance: false, can_pick_up: false });
  const mutation = useMutation({ mutationFn: () => parentsApi.create(form), onSuccess: () => { qc.invalidateQueries({ queryKey: ['parents'] }); toast.success('Parent invitation created'); onClose(); }, onError: () => toast.error('Could not create parent invitation') });
  const set = <K extends keyof CreateParentRequest>(key: K, value: CreateParentRequest[K]) => setForm(f => ({ ...f, [key]: value }));
  const submit = (e: FormEvent) => { e.preventDefault(); if (!form.student_id) return toast.error('Select a student'); mutation.mutate(); };
  return <Frame title="Invite parent or guardian" onClose={onClose}><form onSubmit={submit} className="space-y-5 p-5">
    <div><label className="text-xs font-semibold">Find student</label><input className="input-base mt-1 w-full" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Search student name or admission number" /><select required className="input-base mt-2 w-full" value={form.student_id} onChange={e => set('student_id', e.target.value)}><option value="">Select student</option>{students.data?.items.map(s => <option key={s.id} value={s.id}>{s.full_name} — {s.admission_number}</option>)}</select></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Full name<input required className="input-base mt-1 w-full" value={form.name} onChange={e => set('name', e.target.value)} /></label><label className="text-xs font-semibold">Relationship<select className="input-base mt-1 w-full" value={form.relationship_type} onChange={e => set('relationship_type', e.target.value as CreateParentRequest['relationship_type'])}><option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option><option value="other">Other</option></select></label><label className="text-xs font-semibold">Email<input required type="email" className="input-base mt-1 w-full" value={form.email} onChange={e => set('email', e.target.value)} /></label><label className="text-xs font-semibold">Phone<input className="input-base mt-1 w-full" value={form.phone} onChange={e => set('phone', e.target.value)} /></label><label className="text-xs font-semibold sm:col-span-2">Address<input className="input-base mt-1 w-full" value={form.address ?? ''} onChange={e => set('address', e.target.value)} /></label></div>
    <fieldset><legend className="text-sm font-semibold">Access for this child</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{PERMISSIONS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form[key])} onChange={e => set(key, e.target.checked)} />{label}</label>)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)} />Primary guardian</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_emergency_contact} onChange={e => set('is_emergency_contact', e.target.checked)} />Emergency contact</label></div></fieldset>
    <div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={mutation.isPending} className="rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? 'Sending…' : 'Create and send invitation'}</button></div>
  </form></Frame>;
}

export function ParentDetailsModal({ parent, onClose }: { parent: ParentListItem; onClose: () => void }) {
  const qc = useQueryClient();
  const action = useMutation({ mutationFn: (kind: 'resend' | 'enable' | 'disable') => kind === 'resend' ? parentsApi.resendInvite(parent.guardian_id) : kind === 'enable' ? parentsApi.enable(parent.guardian_id) : parentsApi.disable(parent.guardian_id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['parents'] }); toast.success('Parent account updated'); }, onError: () => toast.error('Account update failed') });
  return <Frame title={parent.name} onClose={onClose}><div className="space-y-5 p-5"><div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Email</span><br />{parent.email}</p><p><span className="text-slate-500">Phone</span><br />{parent.phone || 'Not provided'}</p><p><span className="text-slate-500">Account</span><br /><span className="capitalize">{parent.activation_status}</span></p><p><span className="text-slate-500">Invitation</span><br /><span className="capitalize">{parent.invitation_status}</span></p></div><section><h3 className="text-sm font-semibold">Linked children</h3><div className="mt-2 space-y-2">{parent.relationships.length ? parent.relationships.map(r => <div key={r.relationship_id} className="rounded-xl border p-3 text-sm"><div className="flex justify-between"><strong>{r.guardian_name || 'Student relationship'}</strong><span className="capitalize text-slate-500">{r.relationship_type}</span></div><p className="mt-1 text-xs text-slate-500">{[r.can_view_attendance && 'Attendance', r.can_view_results && 'Results', r.can_view_assignments && 'Assignments', r.can_view_finance && 'Finance', r.can_receive_messages && 'Messages'].filter(Boolean).join(' · ') || 'No data permissions'}</p></div>) : <p className="text-sm text-slate-500">No active children.</p>}</div></section><div className="flex flex-wrap gap-2 border-t pt-4">{parent.invitation_status !== 'accepted' && <button onClick={() => action.mutate('resend')} className="rounded-lg border px-3 py-2 text-sm">Resend invitation</button>}{parent.membership_active ? <button onClick={() => action.mutate('disable')} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Disable account</button> : <button onClick={() => action.mutate('enable')} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Enable account</button>}</div></div></Frame>;
}
