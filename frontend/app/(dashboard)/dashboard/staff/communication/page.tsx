'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  Send,
  X,
  Info,
  Clock,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';

import { PageHeader } from '@/components/shared/PageHeader';

// ---------------------------------------------------------------------------
// Types + mock data
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  subject: string;
  body: string;
  sent_at: string;
  is_read: boolean;
  sender_name: string;
  recipient_name: string;
  direction: 'sent' | 'received';
}

const MOCK_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    subject: 'Request for class projector',
    body: 'Good morning. I would like to request the use of the projector in Room 4 for my Math lesson on Friday, 2nd May at 9 AM. Please let me know if it is available.',
    sent_at: '2026-04-27T09:15:00',
    is_read: true,
    sender_name: 'You',
    recipient_name: 'Admin',
    direction: 'sent',
  },
  {
    id: 'msg-2',
    subject: 'Approved — Projector booking',
    body: 'Hello, your request for the projector in Room 4 on Friday has been approved. Please collect the remote from the office before your lesson.',
    sent_at: '2026-04-27T11:40:00',
    is_read: true,
    sender_name: 'Admin',
    recipient_name: 'You',
    direction: 'received',
  },
  {
    id: 'msg-3',
    subject: 'Student welfare concern — Obinna Dibia',
    body: 'I am writing to flag a welfare concern regarding Obinna Dibia in JSS 3A. He has been unusually withdrawn this week and missed two consecutive classes. Please advise on the appropriate steps.',
    sent_at: '2026-04-28T14:30:00',
    is_read: false,
    sender_name: 'You',
    recipient_name: 'Admin',
    direction: 'sent',
  },
];

// ---------------------------------------------------------------------------
// New Message Modal
// ---------------------------------------------------------------------------

interface NewMessageModalProps {
  onClose: () => void;
  onSend: (subject: string, body: string) => void;
}

function NewMessageModal({ onClose, onSend }: NewMessageModalProps) {
  const [mounted, setMounted] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSend = async () => {
    if (!subject.trim()) { toast.error('Please enter a subject'); return; }
    if (!body.trim()) { toast.error('Please write your message'); return; }
    setSending(true);
    await new Promise((r) => setTimeout(r, 600));
    onSend(subject.trim(), body.trim());
    setSending(false);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Double-bezel shell */}
      <div className="relative z-10 bg-black/5 ring-1 ring-black/8 p-1.5 rounded-[1.75rem] w-full max-w-lg shadow-2xl">
        <div className="bg-white rounded-[calc(1.75rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-navy)]/8 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[var(--color-navy)]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">New Message</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">To: School Admin</p>
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
            {/* Note */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 ring-1 ring-blue-100">
              <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-xs text-blue-700">
                You can only send messages to the school admin. Your message will be reviewed and responded to as soon as possible.
              </p>
            </div>

            {/* Subject */}
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

            {/* Body */}
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

          {/* Footer */}
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
  message: Message;
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
          {isReceived ? message.sender_name : `To: ${message.recipient_name}`}
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
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_MESSAGES[0]?.id ?? null);
  const [showModal, setShowModal] = useState(false);

  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const unreadCount = messages.filter((m) => !m.is_read && m.direction === 'received').length;

  const handleSend = (subject: string, body: string) => {
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      subject,
      body,
      sent_at: new Date().toISOString(),
      is_read: true,
      sender_name: 'You',
      recipient_name: 'Admin',
      direction: 'sent',
    };
    setMessages((prev) => [newMsg, ...prev]);
    setSelectedId(newMsg.id);
    setShowModal(false);
    toast.success('Message sent to admin');
  };

  const markRead = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => m.id === id ? { ...m, is_read: true } : m),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Messages"
        description="Communicate directly with the school admin"
        actions={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-mid)]',
              'transition-colors duration-150',
            )}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Message
          </button>
        }
      />

      {/* Info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-50 ring-1 ring-blue-100">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-sm text-blue-700">
          <strong>Note:</strong> You can only send messages to the school admin. Replies from the admin will appear in your inbox.
        </p>
      </div>

      {/* Split panel */}
      <div className="card-shell">
        <div className="card-core">
          <div className="flex min-h-[500px] divide-x divide-[var(--color-border)]">
            {/* Left: message list */}
            <div className="w-full max-w-xs flex-shrink-0 flex flex-col">
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

              {messages.length === 0 ? (
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
                        if (!msg.is_read) markRead(msg.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right: thread view */}
            <div className="flex-1 min-w-0 flex flex-col">
              {selected ? (
                <>
                  {/* Thread header */}
                  <div className="px-6 py-4 border-b border-[var(--color-border)]">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {selected.subject}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {selected.direction === 'sent'
                        ? `Sent to Admin · ${new Date(selected.sent_at).toLocaleString('en-NG')}`
                        : `From Admin · ${new Date(selected.sent_at).toLocaleString('en-NG')}`}
                    </p>
                  </div>

                  {/* Message body */}
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

                  {/* Quick reply hint */}
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

      {showModal && (
        <NewMessageModal
          onClose={() => setShowModal(false)}
          onSend={handleSend}
        />
      )}
    </div>
  );
}
