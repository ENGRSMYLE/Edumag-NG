'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { User, GraduationCap, CalendarDays, MapPin, Droplets } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/shared/Badge';
import { studentsApi } from '@/lib/api';
import { formatDate, getInitials } from '@/lib/formatters';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">{label}</span>
      <span className="text-sm text-[var(--color-text-primary)]">
        {value || <span className="text-[var(--color-text-muted)]/50 italic">Not provided</span>}
      </span>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; children: React.ReactNode }) {
  return (
    <div className="card-shell">
      <div className="card-core p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-4 h-4 text-[var(--color-gold)]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] font-display">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StaffStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.get(id).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-10 w-64 rounded-lg bg-[var(--color-border)] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-shell">
              <div className="card-core p-5 h-40 animate-pulse bg-[var(--color-border)]/30" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-[var(--color-text-muted)]">Student not found.</p>
        <button onClick={() => router.back()} className="text-sm text-[var(--color-navy)] underline cursor-pointer">
          Go back
        </button>
      </div>
    );
  }

  const fullName = `${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''} ${student.last_name}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={fullName}
        description={`Admission No. ${student.admission_number}`}
        breadcrumbs={[
          { label: 'Students', href: '/dashboard/staff/students' },
          { label: fullName },
        ]}
      />

      <div className="card-shell">
        <div className="card-core p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-gold)]/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-[var(--color-gold)]">{getInitials(fullName)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] font-display">{fullName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-sm font-mono text-[var(--color-text-muted)]">{student.admission_number}</span>
                <Badge variant={student.is_active ? 'success' : 'danger'} dot>
                  {student.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)] capitalize">{student.gender}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Personal Information" icon={User}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="First Name" value={student.first_name} />
            <InfoRow label="Last Name" value={student.last_name} />
            <InfoRow label="Date of Birth" value={student.date_of_birth ? formatDate(student.date_of_birth) : null} />
            <InfoRow label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : null} />
            <InfoRow label="Religion" value={student.religion} />
            <InfoRow label="State of Origin" value={student.state_of_origin} />
          </div>
        </Section>

        <Section title="Academic Information" icon={GraduationCap}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Admission Number" value={student.admission_number} />
            <InfoRow label="Date Admitted" value={student.admission_date ? formatDate(student.admission_date) : null} />
            <InfoRow label="Current Class" value={(student as any).class_name ?? null} />
          </div>
        </Section>

        <Section title="Medical Information" icon={Droplets}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Blood Group" value={student.blood_group} />
            <InfoRow label="Genotype" value={student.genotype} />
          </div>
        </Section>

        <Section title="Contact" icon={MapPin}>
          <div className="grid grid-cols-1 gap-y-4">
            <InfoRow label="Home Address" value={student.address} />
          </div>
        </Section>
      </div>
    </div>
  );
}
