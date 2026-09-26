'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { PushNotificationSettings } from '@/components/pwa/PushNotificationSettings';
import { parentPortalApi } from '@/lib/api';
import type { ParentProfile } from '@/types/parentPortal';

type Channel = ParentProfile['preferred_contact_channel'];

export default function ProfilePage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['parent', 'profile'], queryFn: () => parentPortalApi.profile().then(r => r.data) });
  const [form, setForm] = useState<{ address: string; occupation: string; preferred_contact_channel: Channel }>({ address: '', occupation: '', preferred_contact_channel: 'email' });
  useEffect(() => { if (query.data) setForm({ address: query.data.address ?? '', occupation: query.data.occupation ?? '', preferred_contact_channel: query.data.preferred_contact_channel }); }, [query.data]);
  const save = useMutation({ mutationFn: () => parentPortalApi.updateProfile(form), onSuccess: () => { qc.invalidateQueries({ queryKey: ['parent', 'profile'] }); toast.success('Profile updated'); }, onError: () => toast.error('Could not update profile') });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  if (query.isLoading) return <div className="card-shell max-w-2xl"><div className="card-core animate-pulse space-y-4 p-5"><div className="h-5 w-36 rounded bg-slate-200" /><div className="h-10 rounded bg-slate-100" /><div className="h-24 rounded bg-slate-100" /></div></div>;
  return <div><PageHeader title="My Profile" description="Manage your contact preferences. Contact the school to change your identity information." />
    {query.isError ? <div className="max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>Profile could not be loaded. The parent account may not be fully linked yet.</p><button type="button" onClick={() => query.refetch()} className="mt-3 font-semibold underline">Try again</button></div> : <form onSubmit={submit} className="card-shell max-w-2xl"><div className="card-core space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Name<input disabled value={query.data?.name ?? ''} className="input-base mt-1 w-full opacity-70" /></label><label className="text-xs font-semibold">Email<input disabled value={query.data?.email ?? ''} className="input-base mt-1 w-full opacity-70" /></label></div>
      <label className="block text-xs font-semibold">Address<textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-base mt-1 min-h-24 w-full" /></label>
      <label className="block text-xs font-semibold">Occupation<input value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))} className="input-base mt-1 w-full" /></label>
      <label className="block text-xs font-semibold">Preferred contact channel<select value={form.preferred_contact_channel} onChange={e => setForm(f => ({ ...f, preferred_contact_channel: e.target.value as Channel }))} className="input-base mt-1 w-full"><option value="in_app">In app</option><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></label>
      <button disabled={save.isPending} className="rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? 'Saving…' : 'Save changes'}</button>
    </div></form>}
    <div className="mt-6 max-w-2xl"><PushNotificationSettings /></div>
  </div>;
}
