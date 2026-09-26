'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentsApi } from '@/lib/api';
import { InviteParentModal } from './ParentManagementModal';
import type { GuardianRelationship } from '@/types/parent';

const FLAGS = [['can_receive_messages', 'Messages'], ['can_view_attendance', 'Attendance'], ['can_view_results', 'Results'], ['can_view_assignments', 'Assignments'], ['can_view_finance', 'Finance'], ['can_pick_up', 'Pickup']] as const;

export function StudentGuardianManager({ studentId }: { studentId: string }) {
  const qc = useQueryClient(); const [invite, setInvite] = useState(false);
  const query = useQuery({ queryKey: ['student', studentId, 'guardians'], queryFn: () => studentsApi.guardians(studentId).then(r => r.data) });
  const update = useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => studentsApi.updateGuardian(studentId, id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['student', studentId, 'guardians'] }); toast.success('Guardian permission updated'); }, onError: () => toast.error('Could not update guardian') });
  const remove = useMutation({ mutationFn: (id: string) => studentsApi.removeGuardian(studentId, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['student', studentId, 'guardians'] }); toast.success('Guardian unlinked'); }, onError: () => toast.error('Could not unlink guardian') });
  const toggle = (row: GuardianRelationship, key: string, value: boolean) => update.mutate({ id: row.relationship_id, data: { [key]: value } });
  return <div className="space-y-4"><div className="flex justify-end"><button onClick={() => setInvite(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add guardian</button></div>{query.isLoading ? <p>Loading guardians…</p> : query.isError ? <p className="text-red-600">Guardians could not be loaded.</p> : !query.data?.length ? <p className="rounded-xl border p-8 text-center text-sm text-slate-500">No guardians are linked to this student.</p> : query.data.map(row => <article key={row.relationship_id} className="rounded-xl border bg-white p-4"><div className="flex items-start justify-between"><div><h3 className="font-semibold">{row.guardian_name}</h3><p className="text-xs text-slate-500">{row.email} · {row.phone || 'No phone'} · <span className="capitalize">{row.relationship_type}</span></p></div><button onClick={() => confirm('Unlink this guardian from the student?') && remove.mutate(row.relationship_id)} className="text-red-600" aria-label="Unlink guardian"><Trash2 className="h-4 w-4" /></button></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{FLAGS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(row[key])} onChange={e => toggle(row, key, e.target.checked)} />{label}</label>)}<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={row.is_primary} onChange={e => toggle(row, 'is_primary', e.target.checked)} />Primary guardian</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(row.is_emergency_contact)} onChange={e => toggle(row, 'is_emergency_contact', e.target.checked)} />Emergency contact</label></div></article>)}{invite && <InviteParentModal initialStudentId={studentId} onClose={() => { setInvite(false); qc.invalidateQueries({ queryKey: ['student', studentId, 'guardians'] }); }} />}</div>;
}
