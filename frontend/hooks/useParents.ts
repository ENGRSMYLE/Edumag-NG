import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parentsApi } from '@/lib/api';
import type { ParentListParams, CreateParentRequest } from '@/types/parent';

export function useParents(params?: ParentListParams) {
  return useQuery({
    queryKey: ['parents', params],
    queryFn: () => parentsApi.list(params).then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateParentRequest) => parentsApi.create(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
    },
  });
}

export function useUpdateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateParentRequest> }) =>
      parentsApi.update(id, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
    },
  });
}
