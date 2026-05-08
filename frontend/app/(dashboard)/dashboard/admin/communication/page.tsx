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
  Send,
  Inbox,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/shared/Badge';
import { useAnnouncements, useInbox, useMarkRead } from '@/hooks/useCommunication';
import { formatRelativeTime } from '@/lib/formatters';
import { communicationApi } from '@/lib/api';
import type { Announcement, AnnouncementAudience, MessageResponse } from '@/types/communication';

type MainTab = 'announcements' | 'messages';
type MsgTab = 'inbox' | 'sent';

const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  all:     'Everyone',
  admin:   'Admins',
  teacher: 'Teachers',
};

const AUDIENCE_VARIANT: Record<AnnouncementAudience, 'info' | 'success' | 'neutral' | 'warning'> = {
  all:     'warning',
  admin:   'success',
  teacher: 'neutral',
};

// ---------------------------------------------------------------------------
// Announcement modal
// ---------------------------------------------------------------------------

const annSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  body: z.string().min(10, 'Message must be at least 10 characters'),
  target_audience: z.enum(['all', 'admin', 'teacher'] as const),
});

type AnnFormData = z.infer<typeof annSchema>;

const inputCls = (hasError?: boolean) => clsx(
  'w-full text-sm rounded-lg px-3 py-2',
  'bg-[var(--color-surface)] border',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
  'focus:outline-none focus:ring-2 transition-all duration-150',
  hasError
    ? 'border-red-400 focus:ring-red-200'
    : 'border-[var(--color-border)] focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]/50',
);

function NewAnnouncementModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AnnFormData>({
    resolver: zodResolver(annSchema),
    defaultValues: { target_audience: 'all' },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: AnnFormData) => communicationApi.createAnnouncement(data),
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isPending) onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [isOpen, isPending, onClose]);

  useEffect(() => { if (!isOpen) reset({ target_audience: 'all' }); }, [isOpen, reset]);

  if (!isOpen || !mounted) return null;

  return createPortal(
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
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">New Announcement</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Broadcast a message to your selected audience</p>
              </div>
              <button onClick={onClose} disabled={isPending} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-all duration-150 disabled:opacity-40">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit((d) => mutate(d))} className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">Title <span className="text-red-500">*</span></label>
                <input {...register('title')} className={inputCls(!!errors.title)} placeholder="End-of-term examinations notice" />
                {errors.title && <p className="text-[11px] text-red-500">{errors.title.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">Message <span className="text-red-500">*</span></label>
                <textarea {...register('body')} rows={5} className={clsx(inputCls(!!errors.body), 'resize-none')} placeholder="Write your announcement here…" />
                {errors.body && <p className="text-[11px] text-red-500">{errors.body.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-primary)]">Target Audience</label>
                <select {...register('target_audience')} className={clsx(inputCls(), 'cursor-pointer')}>
                  <option value="all">Everyone (Admin &amp; Teachers)</option>
                  <option value="admin">Admins only</option>
                  <option value="teacher">Teachers only</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                <button type="button" onClick={onClose} disabled={isPending} className={clsx('px-4 py-2 rounded-lg text-sm font-medium cursor-pointer text-[var(--color-text-primary)] bg-[var(--color-surface)] hover:bg-[var(--color-border)] active:scale-[0.98] transition-all duration-200 disabled:opacity-40')}>
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-mid)] active:scale-[0.98] transition-all duration-200 disabled:opacity-60')}>
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Post Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Compose message modal (admin → teacher)
// ---------------------------------------------------------------------------

interface ComposeModalProps {
  recipients: { id: string; name: string; role: string }[];
  prefillRecipientId?: string;
  onClose: () => void;
}

function ComposeModal({ recipients, prefillRecipientId, onClose }: ComposeModalProps) {
  const [mounted, setMounted] = useState(false);
  const [recipientId, setRecipientId] = useState(prefillRecipientId ?? recipients[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: () => communicationApi.sendMessage({ recipient_id: recipientId, subject, body }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Message sent');
      queryClient.invalidateQueries({ queryKey: ['messages', 'sent'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to send message';
      toast.error(typeof msg === 'string' ? msg : 'Failed to send message');
    },
  });

  const handleSend = () => {
    if (!recipientId) { toast.error('Please select a recipient'); return; }
    if (!subject.trim()) { toast.error('Please enter a subject'); return; }
    if (!body.trim()) { toast.error('Please write your message'); return; }
    sendMessage();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 bg-black/5 ring-1 ring-black/8 p-1.5 rounded-[1.75rem] w-full max-w-lg shadow-2xl">
        <div className="bg-white rounded-[calc(1.75rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-navy)]/8 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[var(--color-navy)]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">New Message</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">Send to a staff member</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] cursor-pointer transition-all duration-150" aria-label="Close">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">To <span className="text-red-500">*</span></label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className={clsx(
                  'w-full text-sm rounded-xl px-3 py-2.5 cursor-pointer',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]',
                  'transition-all duration-200',
                )}
              >
                {recipients.length === 0 && <option value="">No recipients available</option>}
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.role === 'super_admin' ? 'Super Admin' : r.role === 'admin' ? 'Admin' : 'Teacher'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">Subject <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Class schedule update"
                className={clsx(
                  'w-full text-sm rounded-xl px-3 py-2.5',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]',
                  'transition-all duration-200',
                )}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">Message <span className="text-red-500">*</span></label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Write your message here…"
                className={clsx(
                  'w-full text-sm rounded-xl px-3 py-2.5 resize-none',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]',
                  'transition-all duration-200',
                )}
              />
              <p className="text-[10px] text-[var(--color-text-muted)] text-right">{body.length}/2000</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={onClose} className={clsx('px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-navy)]/30 hover:text-[var(--color-text-primary)] transition-all duration-150')}>
              Cancel
            </button>
            <button type="button" onClick={handleSend} disabled={isPending || !recipientId} className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-mid)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200')}>
              {isPending ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {isPending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Announcement card
// ---------------------------------------------------------------------------

function AnnouncementCard({ item }: { item: Announcement }) {
  return (
    <div className="px-5 py-4 flex items-start gap-3.5">
      <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Megaphone className="w-4 h-4 text-[var(--color-gold)]" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{item.title}</p>
          <Badge variant={AUDIENCE_VARIANT[item.target_audience]}>{AUDIENCE_LABELS[item.target_audience]}</Badge>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">{item.body}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] text-[var(--color-text-muted)]">{item.sent_by_name}</span>
          <span className="text-[var(--color-border)]">·</span>
          <time className="text-[11px] text-[var(--color-text-muted)]">{formatRelativeTime(item.created_at)}</time>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message row (inbox)
// ---------------------------------------------------------------------------

function InboxMessageRow({
  msg,
  onMarkRead,
  onReply,
}: {
  msg: MessageResponse;
  onMarkRead: (id: string) => void;
  onReply: (senderId: string) => void;
}) {
  return (
    <div
      onClick={() => { if (!msg.is_read) onMarkRead(msg.id); }}
      className={clsx(
        'flex items-start gap-3.5 px-5 py-4 cursor-pointer group',
        'hover:bg-[var(--color-surface)] transition-colors duration-150',
        !msg.is_read && 'bg-[var(--color-navy)]/[0.02]',
      )}
    >
      <div className="w-8 h-8 rounded-full bg-[var(--color-navy)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Mail className="w-4 h-4 text-[var(--color-navy)]" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={clsx('text-sm truncate', !msg.is_read ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)]')}>
            {msg.sender_name}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <time className="text-[11px] text-[var(--color-text-muted)]">{formatRelativeTime(msg.created_at)}</time>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReply(msg.sender_id); }}
              className="sm:opacity-0 sm:group-hover:opacity-100 text-[10px] font-medium text-[var(--color-navy)] hover:underline transition-opacity duration-150 cursor-pointer"
            >
              Reply
            </button>
          </div>
        </div>
        {msg.subject && (
          <p className={clsx('text-xs truncate', !msg.is_read ? 'text-[var(--color-text-secondary)] font-medium' : 'text-[var(--color-text-muted)]')}>
            {msg.subject}
          </p>
        )}
        <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{msg.body}</p>
      </div>
      {!msg.is_read && <div className="w-2 h-2 rounded-full bg-[var(--color-navy)] mt-2 flex-shrink-0" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sent message row
// ---------------------------------------------------------------------------

function SentMessageRow({ msg }: { msg: MessageResponse }) {
  return (
    <div className="flex items-start gap-3.5 px-5 py-4">
      <div className="w-8 h-8 rounded-full bg-[var(--color-text-muted)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Send className="w-4 h-4 text-[var(--color-text-muted)]" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-sm text-[var(--color-text-primary)] truncate">
            To: <span className="font-medium">{msg.recipient_name}</span>
          </p>
          <time className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0">{formatRelativeTime(msg.created_at)}</time>
        </div>
        {msg.subject && (
          <p className="text-xs text-[var(--color-text-muted)] truncate">{msg.subject}</p>
        )}
        <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{msg.body}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminCommunicationPage() {
  const [tab, setTab] = useState<MainTab>('announcements');
  const [msgTab, setMsgTab] = useState<MsgTab>('inbox');
  const [annModalOpen, setAnnModalOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyToId, setReplyToId] = useState<string | undefined>(undefined);

  const { data: announcementsData, isLoading: announcementsLoading } = useAnnouncements({ per_page: 50 });
  const { data: inboxData, isLoading: inboxLoading } = useInbox({ per_page: 50 });
  const markRead = useMarkRead();

  const { data: sentData, isLoading: sentLoading } = useQuery({
    queryKey: ['messages', 'sent'],
    queryFn: () => communicationApi.getSent({ per_page: 50 }).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: recipients = [] } = useQuery({
    queryKey: ['communication-recipients'],
    queryFn: () => communicationApi.getRecipients().then((r) => r.data),
    staleTime: 300_000,
  });

  const announcements = announcementsData?.items ?? [];
  const inboxMessages = inboxData?.items ?? [];
  const sentMessages = sentData?.items ?? [];
  const unreadCount = inboxData?.unread_count ?? 0;

  const handleReply = (senderId: string) => {
    setReplyToId(senderId);
    setComposeOpen(true);
  };

  const handleComposeClose = () => {
    setComposeOpen(false);
    setReplyToId(undefined);
  };

  const tabCls = (active: boolean) => clsx(
    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 cursor-pointer',
    'transition-all duration-150',
    active
      ? 'border-[var(--color-navy)] text-[var(--color-navy)]'
      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
  );

  const msgSubTabCls = (active: boolean) => clsx(
    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150',
    active
      ? 'bg-[var(--color-navy)]/8 text-[var(--color-navy)]'
      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]',
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Communication"
        description="Manage announcements and messages"
        actions={
          tab === 'announcements' ? (
            <button
              onClick={() => setAnnModalOpen(true)}
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
          ) : (
            <button
              onClick={() => { setReplyToId(undefined); setComposeOpen(true); }}
              disabled={recipients.length === 0}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white',
                'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                'transition-all duration-200 disabled:opacity-50',
              )}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              New Message
            </button>
          )
        }
      />

      <div className="card-shell">
        <div className="card-core">
          {/* Main tabs */}
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
              {unreadCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Announcements tab */}
          {tab === 'announcements' && (
            <div>
              {announcementsLoading ? (
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
                    Post your first announcement to notify students, parents, and teachers.
                  </p>
                  <button
                    onClick={() => setAnnModalOpen(true)}
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

          {/* Messages tab */}
          {tab === 'messages' && (
            <div>
              {/* Inbox / Sent sub-tabs */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--color-border)]">
                <button onClick={() => setMsgTab('inbox')} className={msgSubTabCls(msgTab === 'inbox')}>
                  <Inbox className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Inbox
                  {unreadCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button onClick={() => setMsgTab('sent')} className={msgSubTabCls(msgTab === 'sent')}>
                  <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Sent
                </button>
              </div>

              {/* Inbox */}
              {msgTab === 'inbox' && (
                inboxLoading ? (
                  <div className="divide-y divide-[var(--color-border)]">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="px-5 py-4 flex items-start gap-3.5">
                        <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-3.5 w-1/2 rounded" />
                          <div className="skeleton h-3 w-2/3 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : inboxMessages.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-center px-5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-navy)]/5 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-[var(--color-navy)]/30" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">No messages yet</p>
                    <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
                      Messages from teachers will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--color-border)]">
                    {inboxMessages.map((msg) => (
                      <InboxMessageRow
                        key={msg.id}
                        msg={msg}
                        onMarkRead={(id) => markRead.mutate(id)}
                        onReply={handleReply}
                      />
                    ))}
                  </div>
                )
              )}

              {/* Sent */}
              {msgTab === 'sent' && (
                sentLoading ? (
                  <div className="divide-y divide-[var(--color-border)]">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="px-5 py-4 flex items-start gap-3.5">
                        <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-3.5 w-1/2 rounded" />
                          <div className="skeleton h-3 w-2/3 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : sentMessages.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-center px-5">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-navy)]/5 flex items-center justify-center">
                      <Send className="w-6 h-6 text-[var(--color-navy)]/30" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">No sent messages</p>
                    <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
                      Messages you send to teachers will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--color-border)]">
                    {sentMessages.map((msg) => (
                      <SentMessageRow key={msg.id} msg={msg} />
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <NewAnnouncementModal isOpen={annModalOpen} onClose={() => setAnnModalOpen(false)} />

      {composeOpen && (
        <ComposeModal
          recipients={recipients}
          prefillRecipientId={replyToId}
          onClose={handleComposeClose}
        />
      )}
    </div>
  );
}
