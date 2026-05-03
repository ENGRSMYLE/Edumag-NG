'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Megaphone,
  MessageSquare,
  Plus,
  X,
  Loader2,
  Mail,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/shared/Badge';
import { announcementsApi } from '@/lib/api';
import { formatRelativeTime, formatDate } from '@/lib/formatters';
import type { Announcement, AnnouncementAudience } from '@/types/communication';

type Tab = 'announcements' | 'messages';

const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  all:      'Everyone',
  students: 'Students',
  parents:  'Parents',
  staff:    'Staff',
};

const AUDIENCE_VARIANT: Record<AnnouncementAudience, 'info' | 'success' | 'neutral' | 'warning'> = {
  all:      'warning',
  students: 'info',
  parents:  'success',
  staff:    'neutral',
};

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  body: z.string().min(10, 'Message must be at least 10 characters'),
  audience: z.enum(['all', 'students', 'parents', 'staff'] as const),
});

type FormData = z.infer<typeof schema>;

const inputCls = (hasError?: boolean) => clsx(
  'w-full text-sm rounded-lg px-3 py-2',
  'bg-[var(--color-surface)] border',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
  'focus:outline-none focus:ring-2 transition-all duration-150',
  hasError
    ? 'border-red-400 focus:ring-red-200'
    : 'border-[var(--color-border)] focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]/50',
);

interface NewAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function NewAnnouncementModal({ isOpen, onClose }: NewAnnouncementModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { audience: 'all' },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => announcementsApi.create(data),
    onSuccess: () => {
      toast.success('Announcement posted');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      reset();
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to post announcement';
      toast.error(typeof msg === 'string' ? msg : 'Failed to post announcement');
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, isPending, onClose]);

  useEffect(() => {
    if (!isOpen) reset({ audience: 'all' });
  }, [isOpen, reset]);

  if (!isOpen || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={(e) => { if (e.currentTarget === e.target && !isPending) onClose(); }}
    >
      <div className="absolute inset-0 bg-[var(--color-navy)]/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg animate-fade-in-up" role="dialog" aria-modal="true">
        <div className="bg-black/[0.03] ring-1 ring-black/5 p-1.5 rounded-[1.25rem]">
          <div className="bg-white rounded-[calc(1.25rem-0.375rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-[18px] h-[18px] text-[var(--color-gold)]" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">
                  New Announcement
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Broadcast a message to your selected audience
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isPending}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-all duration-150 disabled:opacity-40"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit((d) => mutate(d))} className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">
                  Title <span className="text-red-500">*</span>
                </label>
                <input {...register('title')} className={inputCls(!!errors.title)} placeholder="End-of-term examinations notice" />
                {errors.title && <p className="text-[11px] text-red-500">{errors.title.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('body')}
                  rows={5}
                  className={clsx(inputCls(!!errors.body), 'resize-none')}
                  placeholder="Write your announcement here…"
                />
                {errors.body && <p className="text-[11px] text-red-500">{errors.body.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">Target Audience</label>
                <select {...register('audience')} className={clsx(inputCls(), 'cursor-pointer')}>
                  <option value="all">Everyone (Students, Parents & Staff)</option>
                  <option value="students">Students only</option>
                  <option value="parents">Parents only</option>
                  <option value="staff">Staff only</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                    'text-[var(--color-text-primary)] bg-[var(--color-surface)]',
                    'hover:bg-[var(--color-border)] active:scale-[0.98]',
                    'transition-all duration-200 disabled:opacity-40',
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
                    'transition-all duration-200 disabled:opacity-60',
                  )}
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Post Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function AnnouncementCard({ item }: { item: Announcement }) {
  return (
    <div className="px-5 py-4 flex items-start gap-3.5">
      <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Megaphone className="w-4 h-4 text-[var(--color-gold)]" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {item.title}
          </p>
          <Badge variant={AUDIENCE_VARIANT[item.audience]}>
            {AUDIENCE_LABELS[item.audience]}
          </Badge>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
          {item.body}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] text-[var(--color-text-muted)]">{item.created_by}</span>
          <span className="text-[var(--color-border)]">·</span>
          <time className="text-[11px] text-[var(--color-text-muted)]">
            {formatRelativeTime(item.created_at)}
          </time>
        </div>
      </div>
    </div>
  );
}

const MOCK_MESSAGES = [
  { id: '1', sender_name: 'Mrs. Ngozi Adeyemi', subject: 'JSS2A Student Concerns', preview: 'I wanted to discuss Emeka\'s recent performance…', sent_at: new Date(Date.now() - 3600_000).toISOString(), is_read: false },
  { id: '2', sender_name: 'Mr. Taiwo Okafor', subject: 'Attendance Query', preview: 'Could you please confirm the attendance record…', sent_at: new Date(Date.now() - 86400_000).toISOString(), is_read: true },
  { id: '3', sender_name: 'Mrs. Fatima Bello', subject: 'Parent-Teacher Meeting', preview: 'I would like to schedule a meeting to discuss…', sent_at: new Date(Date.now() - 172800_000).toISOString(), is_read: true },
];

export default function AdminCommunicationPage() {
  const [tab, setTab] = useState<Tab>('announcements');
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.list({ per_page: 50 }).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const announcements = (data?.items ?? []) as Announcement[];

  const tabCls = (active: boolean) => clsx(
    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 cursor-pointer',
    'transition-all duration-150',
    active
      ? 'border-[var(--color-navy)] text-[var(--color-navy)]'
      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Communication"
        description="Manage announcements and messages"
        actions={
          tab === 'announcements' ? (
            <button
              onClick={() => setModalOpen(true)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white',
                'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                'transition-all duration-200',
              )}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              New Announcement
            </button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="card-shell">
        <div className="card-core">
          <div className="flex border-b border-[var(--color-border)] px-1">
            <button onClick={() => setTab('announcements')} className={tabCls(tab === 'announcements')}>
              <Megaphone className="w-4 h-4" strokeWidth={1.5} />
              Announcements
              {announcements.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-navy)]/10 text-[var(--color-navy)]">
                  {announcements.length}
                </span>
              )}
            </button>
            <button onClick={() => setTab('messages')} className={tabCls(tab === 'messages')}>
              <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
              Messages
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">
                1
              </span>
            </button>
          </div>

          {tab === 'announcements' && (
            <div>
              {isLoading ? (
                <div className="divide-y divide-[var(--color-border)]">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-5 py-4 flex items-start gap-3.5">
                      <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3.5 w-3/4 rounded" />
                        <div className="skeleton h-3 w-full rounded" />
                        <div className="skeleton h-3 w-1/3 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : announcements.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3 text-center px-5">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--color-gold)]/10 flex items-center justify-center">
                    <Megaphone className="w-6 h-6 text-[var(--color-gold)]/40" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">No announcements yet</p>
                  <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
                    Post your first announcement to notify students, parents, and staff.
                  </p>
                  <button
                    onClick={() => setModalOpen(true)}
                    className={clsx(
                      'mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
                      'bg-[var(--color-navy)] text-white',
                      'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                      'transition-all duration-200',
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Post First Announcement
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {announcements.map((item) => (
                    <AnnouncementCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'messages' && (
            <div className="divide-y divide-[var(--color-border)]">
              {MOCK_MESSAGES.map((msg) => (
                <div
                  key={msg.id}
                  className={clsx(
                    'flex items-start gap-3.5 px-5 py-4 cursor-pointer',
                    'hover:bg-[var(--color-surface)] transition-colors duration-150',
                    !msg.is_read && 'bg-[var(--color-navy)]/[0.02]',
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--color-navy)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail className="w-4 h-4 text-[var(--color-navy)]" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className={clsx('text-sm truncate', msg.is_read ? 'text-[var(--color-text-primary)]' : 'font-semibold text-[var(--color-text-primary)]')}>
                        {msg.sender_name}
                      </p>
                      <time className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0">
                        {formatRelativeTime(msg.sent_at)}
                      </time>
                    </div>
                    <p className={clsx('text-xs truncate', msg.is_read ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)] font-medium')}>
                      {msg.subject}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                      {msg.preview}
                    </p>
                  </div>
                  {!msg.is_read && (
                    <div className="w-2 h-2 rounded-full bg-[var(--color-navy)] mt-2 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <NewAnnouncementModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
