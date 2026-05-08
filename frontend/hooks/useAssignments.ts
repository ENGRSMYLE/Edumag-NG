import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '@/lib/api';
import type {
  AssignmentListParams,
  CreateAssignmentRequest,
  GradeSubmissionRequest,
} from '@/types/assignment';

export function useAssignments(params?: AssignmentListParams) {
  return useQuery({
    queryKey: ['assignments', params],
    queryFn: () => assignmentsApi.list(params).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAssignment(id: string | undefined) {
  return useQuery({
    queryKey: ['assignments', id],
    queryFn: () => assignmentsApi.get(id!).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
    enabled: !!id,
  });
}

export function useSubmissions(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ['assignments', assignmentId, 'submissions'],
    queryFn: () => assignmentsApi.submissions(assignmentId!).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
    enabled: !!assignmentId,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAssignmentRequest) => assignmentsApi.create(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useGradeSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      submissionId,
      data,
    }: {
      assignmentId: string;
      submissionId: string;
      data: GradeSubmissionRequest;
    }) => assignmentsApi.grade(assignmentId, submissionId, data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['assignments', variables.assignmentId, 'submissions'],
      });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}
