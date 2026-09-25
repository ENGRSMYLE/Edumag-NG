'use client';

import { DashboardHeader } from './DashboardHeader';

export function ParentHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  return <DashboardHeader onMenuClick={onMenuClick} />;
}
