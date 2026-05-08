import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';
import type {
  MarkAttendanceRequest,
  AttendanceReportParams,
} from '@/types/attendance';

export function useSchoolAttendanceSummary(params?: AttendanceReportParams) {
  return useQuery({
    queryKey: ['attendance', 'school', params],
    queryFn: () => attendanceApi.school(params).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!params?.date,
  });
}

export function useAttendanceCheck(classId: string | undefined, date?: string) {
  return useQuery({
    queryKey: ['attendance', 'check', classId, date],
    queryFn: () => attendanceApi.check(classId!, date ? { date } : undefined).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!classId,
  });
}

export function useClassAttendance(
  classId: string | undefined,
  params?: { date?: string; start_date?: string; end_date?: string },
) {
  return useQuery({
    queryKey: ['attendance', 'class', classId, params],
    queryFn: () => attendanceApi.classRecords(classId!, params).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!classId,
  });
}

export function useClassSummary(
  classId: string | undefined,
  params?: { start_date?: string; end_date?: string },
) {
  return useQuery({
    queryKey: ['attendance', 'class-summary', classId, params],
    queryFn: () => attendanceApi.classSummary(classId!, params).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    enabled: !!classId,
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MarkAttendanceRequest) => attendanceApi.mark(data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'check', variables.class_id] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'class', variables.class_id] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'school'] });
    },
  });
}
