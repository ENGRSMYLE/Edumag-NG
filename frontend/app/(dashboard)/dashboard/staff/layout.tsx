import type { ReactNode } from 'react';
import { StaffShell } from '@/components/layout/StaffShell';

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
