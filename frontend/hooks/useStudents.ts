import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '@/lib/api';
import type { StudentListParams } from '@/types/academic';
import type { CreateStudentRequest } from '@/types/student';

export function useStudents(params?: StudentListParams) {
  return useQuery({
    queryKey: ['students', params],
    queryFn: () => studentsApi.list(params).then((r) => r.data),
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: ['students', id],
    queryFn: () => studentsApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStudentRequest) => studentsApi.create(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateStudentRequest> }) =>
      studentsApi.update(id, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useBulkUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => studentsApi.bulkUpload(rows).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useGenerateAdmissionNumber() {
  return useQuery({
    queryKey: ['admission-number'],
    queryFn: () => studentsApi.generateAdmissionNumber().then((r) => r.data),
    enabled: false,
  });
}
