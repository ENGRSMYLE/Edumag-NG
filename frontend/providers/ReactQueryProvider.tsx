'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => {
      let client: QueryClient;
      client = new QueryClient({
        mutationCache: new MutationCache({
          onSuccess: () => client.invalidateQueries({ queryKey: ['dashboard'] }),
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchIntervalInBackground: false,
          },
          mutations: {
            retry: 0,
          },
        },
      });

      // Poll only changing operational data. TanStack Query deduplicates
      // identical keys and stops these timers when their last observer unmounts.
      const fastKeys = ['dashboard', 'attendance', 'unread-count', 'inbox', 'messages'];
      const standardKeys = [
        'students', 'student', 'my-class-students', 'staff', 'users',
        'classes', 'parents', 'results', 'assignments', 'finance',
        'finance-summary', 'payments', 'debtors', 'announcements', 'audit-logs',
      ];
      fastKeys.forEach((key) => client.setQueryDefaults([key], { refetchInterval: 30_000 }));
      standardKeys.forEach((key) => client.setQueryDefaults([key], { refetchInterval: 60_000 }));

      return client;
    },
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
