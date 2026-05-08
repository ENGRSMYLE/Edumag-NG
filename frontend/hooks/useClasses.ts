import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesApi } from '@/lib/api';

export function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.list().then((r) => r.data),
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      level: string;
      arm?: string;
      teacher_id?: string;
      capacity?: number;
      academic_session: string;
      term: string;
    }) => classesApi.create(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}

export function useAssignTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, teacher_id }: { id: string; teacher_id: string }) =>
      classesApi.update(id, { teacher_id }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}
