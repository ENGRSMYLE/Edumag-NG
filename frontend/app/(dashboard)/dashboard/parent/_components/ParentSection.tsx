import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';

export function ParentSection({ title, description, empty, icon }: { title: string; description: string; empty: string; icon: LucideIcon }) {
  return <div><PageHeader title={title} description={description} /><div className="card-shell"><div className="card-core"><EmptyState icon={icon} title={empty} description="Information will appear here when it is available for an authorized child." /></div></div></div>;
}
