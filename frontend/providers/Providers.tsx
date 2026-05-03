'use client';

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';

import { ReactQueryProvider } from './ReactQueryProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
        <Toaster
          position="bottom-right"
          gutter={8}
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '14px',
              fontWeight: '500',
              background: 'var(--color-white)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              boxShadow:
                '0 4px 12px 0 rgba(10, 22, 40, 0.10), 0 2px 4px -2px rgba(10, 22, 40, 0.06)',
              padding: '12px 16px',
            },
            success: {
              iconTheme: {
                primary: '#16A34A',
                secondary: '#FAFAF7',
              },
            },
            error: {
              iconTheme: {
                primary: '#DC2626',
                secondary: '#FAFAF7',
              },
            },
          }}
        />
      </ThemeProvider>
    </ReactQueryProvider>
  );
}
