'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2 } from 'lucide-react';

interface Props {
  schoolName: string;
  logoUrl?: string | null;
}

export function SwitchSchoolOverlay({ schoolName, logoUrl }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="ss-overlay fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--color-navy)]/95 backdrop-blur-sm" />

      {/* Card */}
      <div className="ss-card relative z-10 flex flex-col items-center gap-5 w-72 bg-white/[0.05] border border-white/10 rounded-2xl px-8 py-8">

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-gold)]/15 border border-[var(--color-gold)]/25 flex items-center justify-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-9 h-9 object-contain rounded-lg" />
          ) : (
            <Building2 className="w-7 h-7 text-[var(--color-gold)]" strokeWidth={1.5} />
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-white/40 text-[10px] font-semibold tracking-[0.2em] uppercase">
            Switching to
          </p>
          <p className="text-white text-[17px] font-bold font-display leading-snug max-w-[200px]">
            {schoolName}
          </p>
        </div>

        {/* Indeterminate progress bar */}
        <div className="w-full h-[3px] bg-white/10 rounded-full overflow-hidden relative">
          <div className="ss-progress absolute inset-y-0 rounded-full bg-[var(--color-gold)]" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
