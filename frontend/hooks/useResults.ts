import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resultsApi } from '@/lib/api';

export function useClassResults(
  classId: string | undefined,
  params: { academic_session: string; term: string; subject?: string },
) {
  return useQuery({
    queryKey: ['results', 'class', classId, params],
    queryFn: () => resultsApi.classResults(classId!, params).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!classId && !!params.academic_session && !!params.term,
  });
}

export function useClassReportCards(
  classId: string | undefined,
  params: { academic_session: string; term: string },
) {
  return useQuery({
    queryKey: ['results', 'report-cards', classId, params],
    queryFn: () => resultsApi.classReportCards(classId!, params).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!classId && !!params.academic_session && !!params.term,
  });
}

export function useStudentResult(
  studentId: string | undefined,
  params: { academic_session: string; term: string },
) {
  return useQuery({
    queryKey: ['results', 'student', studentId, params],
    queryFn: () => resultsApi.studentResult(studentId!, params).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!studentId && !!params.academic_session && !!params.term,
  });
}

export function useEnterScores() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof resultsApi.enterScores>[0]) =>
      resultsApi.enterScores(data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['results', 'class', variables.class_id] });
      queryClient.invalidateQueries({ queryKey: ['results', 'report-cards', variables.class_id] });
    },
  });
}

export function useApproveResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { class_id: string; academic_session: string; term: string }) =>
      resultsApi.approve(data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['results', 'class', variables.class_id] });
      queryClient.invalidateQueries({ queryKey: ['results', 'report-cards', variables.class_id] });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resultId, comment }: { resultId: string; comment: string }) =>
      resultsApi.addComment(resultId, { teacher_comment: comment }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

export function useReportCard(
  studentId: string | undefined,
  params: { academic_session: string; term: string },
) {
  return useStudentResult(studentId, params);
}
