import type { ReactNode } from 'react';
import { ParentShell } from '@/components/layout/ParentShell';

export default function ParentLayout({ children }: { children: ReactNode }) {
  return <ParentShell>{children}</ParentShell>;
}
