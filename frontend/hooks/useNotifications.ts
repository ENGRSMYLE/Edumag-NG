import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
export function useNotificationUnreadCount() { return useQuery({ queryKey: ['notifications', 'unread-count'], queryFn: () => notificationsApi.unreadCount().then(r => r.data), refetchInterval: 30_000 }); }
export function useMarkNotificationRead() { const client = useQueryClient(); return useMutation({ mutationFn: (id: string) => notificationsApi.markRead(id), onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }) }); }
