'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Loader2, LockKeyhole } from 'lucide-react';
import toast from 'react-hot-toast';

import { notificationsApi } from '@/lib/api';
import type { NotificationEventType, NotificationPreferenceUpdate } from '@/types/notification';

const LABELS: Record<NotificationEventType, { title: string; description: string }> = {
  parent_linked: { title: 'Account and child access', description: 'Important changes to your school account and linked children.' },
  message_received: { title: 'Messages', description: 'New private messages from your school.' },
  announcement_published: { title: 'Announcements', description: 'School-wide news and notices.' },
  student_absent: { title: 'Attendance', description: 'Alerts when an authorized child is marked absent.' },
  assignment_created: { title: 'Assignments', description: 'New assignments for an authorized child.' },
  result_published: { title: 'Academic results', description: 'New approved results available in the portal.' },
  fee_reminder: { title: 'Fee reminders', description: 'Finance reminders when you have finance access.' },
};

export function NotificationPreferences() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => notificationsApi.preferences().then(response => response.data),
    staleTime: 60_000,
  });
  const mutation = useMutation({
    mutationFn: ({ eventType, values }: { eventType: NotificationEventType; values: NotificationPreferenceUpdate }) =>
      notificationsApi.updatePreference(eventType, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
      toast.success('Notification preference updated');
    },
    onError: () => toast.error('Could not update notification preference'),
  });

  return <section className="card-shell overflow-hidden" aria-labelledby="preference-heading">
    <div className="card-core">
      <div className="flex items-start gap-3 border-b border-slate-100 p-5">
        <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Bell className="h-5 w-5" aria-hidden /></div>
        <div className="min-w-0"><h2 id="preference-heading" className="font-semibold text-slate-900">Notification categories</h2><p className="mt-1 text-sm leading-5 text-slate-500">Choose how each category reaches you. This does not remove your browser subscription.</p></div>
      </div>
      {query.isLoading ? <div className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading preferences…</div>
        : query.isError ? <div className="p-5"><p className="text-sm text-red-700">Preferences could not be loaded.</p><button type="button" onClick={() => query.refetch()} className="mt-3 min-h-11 rounded-lg border px-4 text-sm font-semibold">Try again</button></div>
        : <div className="divide-y divide-slate-100">
          {query.data?.items.map(item => {
            const label = LABELS[item.event_type];
            const pending = mutation.isPending && mutation.variables?.eventType === item.event_type;
            return <div key={item.event_type} className="p-5">
              <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">{label.title}</h3>{item.mandatory && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"><LockKeyhole className="h-3 w-3" />Required</span>}</div><p className="mt-1 text-sm text-slate-500">{label.description}</p></div>{pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Toggle label="In app" checked={item.in_app_enabled} disabled={item.mandatory || pending} onChange={value => mutation.mutate({ eventType: item.event_type, values: { in_app_enabled: value } })} />
                <Toggle label="Push" checked={item.push_enabled} disabled={item.mandatory || pending} onChange={value => mutation.mutate({ eventType: item.event_type, values: { push_enabled: value } })} />
              </div>
            </div>;
          })}
        </div>}
    </div>
  </section>;
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <label className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 text-sm ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'cursor-pointer bg-white text-slate-700'}`}><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-[var(--color-navy)]" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /></label>;
}
