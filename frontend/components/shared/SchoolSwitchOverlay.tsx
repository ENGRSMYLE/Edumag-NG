'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getInitials } from '@/lib/formatters';

export interface SchoolSwitchOverlayProps {
  isVisible: boolean;
  schoolName: string;
  schoolLogo?: string;
}

const STATUS_MESSAGES = [
  { text: 'Securing your session...',      until: 800  },
  { text: 'Loading school data...',        until: 1800 },
  { text: 'Preparing your dashboard...',   until: 2800 },
  { text: 'Almost ready...',               until: 3800 },
] as const;

function StatusText({ startMs }: { startMs: number }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STATUS_MESSAGES.forEach((msg, i) => {
      if (i === 0) return;
      const at = msg.until - 200 - (Date.now() - startMs);
      if (at <= 0) return;
      timers.push(
        setTimeout(() => {
          setVisible(false);
          setTimeout(() => {
            setIndex(i);
            setVisible(true);
          }, 200);
        }, at),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [startMs]);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={index}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: visible ? 1 : 0, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="text-[13px] text-[var(--color-text-secondary)] text-center mt-3 h-5 leading-5"
      >
        {STATUS_MESSAGES[index].text}
      </motion.p>
    </AnimatePresence>
  );
}

export function SchoolSwitchOverlay({
  isVisible,
  schoolName,
  schoolLogo,
}: SchoolSwitchOverlayProps) {
  const [startMs] = useState(() => Date.now());

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[var(--color-navy)]" />

          {/* Radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(245,166,35,0.09) 0%, transparent 70%)',
            }}
          />

          {/* Card */}
          <motion.div
            className="relative z-10 bg-white rounded-3xl px-12 py-10 flex flex-col items-center"
            style={{ minWidth: 360, boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(245,166,35,0.08)' }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Logo / Avatar */}
            <motion.div
              className="mb-5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.4 }}
            >
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt={schoolName}
                  className="w-[72px] h-[72px] rounded-full object-contain border-[3px] border-[var(--color-gold)]"
                />
              ) : (
                <div className="w-[72px] h-[72px] rounded-full bg-[var(--color-navy)] border-[3px] border-[var(--color-gold)] flex items-center justify-center">
                  <span className="text-[22px] font-bold text-[var(--color-gold)] leading-none">
                    {getInitials(schoolName)}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Label */}
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)] mb-2">
              Switching to
            </p>

            {/* School name */}
            <motion.p
              className="font-display text-[22px] font-bold text-[var(--color-text-primary)] text-center leading-snug max-w-[260px] mb-7"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
            >
              {schoolName}
            </motion.p>

            {/* Progress bar track */}
            <div className="w-full h-[6px] bg-[var(--color-border)] rounded-full overflow-hidden">
              <div className="ss2-bar h-full rounded-full" />
            </div>

            {/* Status text */}
            <StatusText startMs={startMs} />
          </motion.div>

          {/* Inline keyframes */}
          <style>{`
            @keyframes ss2Fill {
              from { width: 0% }
              to   { width: 100% }
            }
            @keyframes ss2Shimmer {
              0%   { background-position: 200% center }
              100% { background-position: -200% center }
            }
            .ss2-bar {
              background: linear-gradient(90deg, #F5A623, #FBD07C, #F5A623);
              background-size: 200% auto;
              animation:
                ss2Fill    3s cubic-bezier(0.4, 0, 0.2, 1) 0.7s forwards,
                ss2Shimmer 1.5s linear 0.7s infinite;
              width: 0%;
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
