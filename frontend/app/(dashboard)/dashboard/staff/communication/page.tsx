'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Plus,
  Send,
  X,
  Info,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';

import { PageHeader } from '@/components/shared/PageHeader';
import { communicationApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { MessageResponse } from '@/types/communication';

// ---------------------------------------------------------------------------
// Unified message view type
// ---------------------------------------------------------------------------

interface DisplayMessage {
  id: string;
  subject: string;
  body: string;
  sent_at: string;
  is_read: boolean;
  other_party: string;
  direction: 'sent' | 'received';
}

function toDisplay(msg: MessageResponse, myId: string): DisplayMessage {
  const isReceived = msg.recipient_id === myId;
  return {
    id: msg.id,
    subject: msg.subject ?? '(no subject)',
    body: msg.body,
    sent_at: msg.created_at,
    is_read: msg.is_read,
    other_party: isReceived ? msg.sender_name : msg.recipient_name,
    direction: isReceived ? 'received' : 'sent',
  };
}

// ---------------------------------------------------------------------------
// New Message Modal
// ---------------------------------------------------------------------------

interface Recipient {
  id: string;
  name: string;
  role: string;
}

interface NewMessageModalProps {
  recipients: Recipient[];
  onClose: () => void;
}

function NewMessageModal({ recipients, onClose }: NewMessageModalProps) {
  const adminId = recipients[0]?.id ?? '';
  const [mounted, setMounted] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const { mutate: sendMessage, isPending: sending } = useMutation({
    mutationFn: () => communicationApi.sendMessage({ recipient_id: adminId, subject, body }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Message sent to admin');
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'sent'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to send message';
      toast.error(typeof msg === 'string' ? msg : 'Failed to send message');
    },
  });

  const handleSend = () => {
    if (!subject.trim()) { toast.error('Please enter a subject'); return; }
    if (!body.trim()) { toast.error('Please write your message'); return; }
    sendMessage();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 bg-black/5 ring-1 ring-black/8 p-1.5 rounded-[1.75rem] w-full max-w-lg shadow-2xl">
        <div className="bg-white rounded-[calc(1.75rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-navy)]/8 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[var(--color-navy)]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">New Message</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">To: {recipients[0]?.name ?? 'School Admin'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] cursor-pointer transition-all duration-150"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 ring-1 ring-blue-100">
              <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-xs text-blue-700">
                You can only send messages to the school admin. Your message will be reviewed and responded to as soon as possible.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-primary)]">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Request for class materials"
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
              <label className="text-sm font-medium text-[var(--color-text-primary)]">
                Message <span className="text-red-500">*</span>
              </label>
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
              <p className="text-[10px] text-[var(--color-text-muted)] text-right">
                {body.length}/2000
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'border border-[var(--color-border)] text-[var(--color-text-secondary)]',
                'hover:border-[var(--color-navy)]/30 hover:text-[var(--color-text-primary)]',
                'transition-all duration-150',
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
                'bg-[var(--color-navy)] text-white',
                'hover:bg-[var(--color-navy-mid)] active:scale-[0.98]',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'transition-all duration-200',
              )}
            >
              {sending ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
              {sending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Message row
// ---------------------------------------------------------------------------

function MessageRow({
  message,
  selected,
  onClick,
}: {
  message: DisplayMessage;
  selected: boolean;
  onClick: () => void;
}) {
  const isReceived = message.direction === 'received';
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full text-left px-4 py-3.5 flex flex-col gap-1 cursor-pointer',
        'border-b border-[var(--color-border)] last:border-b-0',
        'transition-colors duration-150',
        selected
          ? 'bg-[var(--color-navy)]/5 border-l-2 border-l-[var(--color-gold)]'
          : 'hover:bg-[var(--color-surface)]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={clsx(
            'text-xs font-medium',
            isReceived ? 'text-[var(--color-navy)]' : 'text-[var(--color-text-muted)]',
            !message.is_read && 'font-semibold text-[var(--color-text-primary)]',
          )}
        >
          {isReceived ? message.other_party : `To: ${message.other_party}`}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
          {new Date(message.sent_at).toLocaleDateString('en-NG', {
            day: 'numeric', month: 'short',
          })}
        </span>
      </div>
      <p
        className={clsx(
          'text-sm truncate',
          !message.is_read && message.direction === 'received'
            ? 'font-semibold text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-secondary)]',
        )}
      >
        {!message.is_read && message.direction === 'received' && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-navy)] mr-1.5 align-middle mb-0.5" />
        )}
        {message.subject}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] truncate">
        {message.body.slice(0, 80)}…
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StaffCommunicationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Get users this teacher is allowed to message (admins / super_admins)
  const { data: recipients = [] } = useQuery({
    queryKey: ['communication-recipients'],
    queryFn: () => communicationApi.getRecipients().then((r) => r.data),
    staleTime: 300_000,
  });

  const adminId = recipients[0]?.id ?? '';

  // Fetch inbox + sent
  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: () => communicationApi.getInbox({ per_page: 50 }).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: sentData, isLoading: sentLoading } = useQuery({
    queryKey: ['messages', 'sent'],
    queryFn: () => communicationApi.getSent({ per_page: 50 }).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => communicationApi.markRead(id).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  // Combine and sort
  const messages = useMemo<DisplayMessage[]>(() => {
    const myId = user?.id ?? '';
    const inbox = (inboxData?.items ?? []).map((m) => toDisplay(m, myId));
    const sent = (sentData?.items ?? []).map((m) => toDisplay(m, myId));
    const all = [...inbox, ...sent];
    all.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    return all;
  }, [inboxData, sentData, user?.id]);

  const isLoading = inboxLoading || sentLoading;
  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const unreadCount = messages.filter((m) => !m.is_read && m.direction === 'received').length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Messages"
        description="Communicate directly with the school admin"
        actions={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={!adminId}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-mid)]',
              'transition-colors duration-150 disabled:opacity-50',
            )}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Message
          </button>
        }
      />

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50 ring-1 ring-blue-100">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> You can only send messages to the school admin. Replies from the admin will appear in your inbox.
        </p>
      </div>

      <div className="card-shell">
        <div className="card-core">
          <div className="flex flex-col sm:flex-row min-h-[500px] sm:divide-x divide-[var(--color-border)]">
            {/* Left: message list — hidden on mobile when a message is selected */}
            <div className={clsx(
              'sm:w-full sm:max-w-xs flex-shrink-0 flex flex-col',
              selected && 'hidden sm:flex',
            )}>
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.08em]">
                  Inbox
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--color-navy)] text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="skeleton h-3 w-24 rounded" />
                      <div className="skeleton h-4 w-full rounded" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <MessageSquare className="w-8 h-8 text-[var(--color-text-muted)]" strokeWidth={1} />
                  <p className="text-sm text-[var(--color-text-muted)]">No messages yet</p>
                </div>
              ) : (
                <div className="overflow-y-auto flex-1">
                  {messages.map((msg) => (
                    <MessageRow
                      key={msg.id}
                      message={msg}
                      selected={msg.id === selectedId}
                      onClick={() => {
                        setSelectedId(msg.id);
                        if (!msg.is_read && msg.direction === 'received') markRead(msg.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right: thread view — full-width on mobile when selected */}
            <div className={clsx('flex-1 min-w-0 flex flex-col', !selected && 'hidden sm:flex')}>
              {selected ? (
                <>
                  <div className="px-4 sm:px-6 py-4 border-b border-[var(--color-border)]">
                    {/* Mobile back button */}
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-navy)] mb-2 sm:hidden cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                      Back to messages
                    </button>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {selected.subject}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {selected.direction === 'sent'
                        ? `Sent to ${selected.other_party} · ${new Date(selected.sent_at).toLocaleString('en-NG')}`
                        : `From ${selected.other_party} · ${new Date(selected.sent_at).toLocaleString('en-NG')}`}
                    </p>
                  </div>

                  <div className="flex-1 p-6">
                    <div
                      className={clsx(
                        'max-w-prose px-5 py-4 rounded-2xl text-sm leading-relaxed',
                        selected.direction === 'sent'
                          ? 'bg-[var(--color-navy)] text-white ml-auto'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-primary)]',
                      )}
                    >
                      {selected.body}
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-[var(--color-border)]">
                    <button
                      type="button"
                      onClick={() => setShowModal(true)}
                      className={clsx(
                        'flex items-center gap-1.5 text-sm font-medium cursor-pointer',
                        'text-[var(--color-navy)] hover:underline',
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                      Send a new message to admin
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">Select a message to read</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && adminId && (
        <NewMessageModal
          recipients={recipients}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
