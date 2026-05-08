import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationApi } from '@/lib/api';
import type { CreateAnnouncementRequest, SendMessageRequest } from '@/types/communication';

export function useAnnouncements(params?: { page?: number; per_page?: number; target_audience?: string }) {
  return useQuery({
    queryKey: ['announcements', params],
    queryFn: () => communicationApi.listAnnouncements(params).then((r) => r.data),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAnnouncementRequest) =>
      communicationApi.createAnnouncement(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useInbox(params?: { page?: number; per_page?: number; is_read?: boolean }) {
  return useQuery({
    queryKey: ['inbox', params],
    queryFn: () => communicationApi.getInbox(params).then((r) => r.data),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['unread-count'],
    queryFn: () => communicationApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 30000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SendMessageRequest) =>
      communicationApi.sendMessage(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      communicationApi.markRead(messageId).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}
