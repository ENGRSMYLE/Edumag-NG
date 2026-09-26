'use client';

import { useEffect } from 'react';
import { notificationsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    let disposed = false;
    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);

    const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (disposed) return;

        // Apply an update that was already waiting when this page loaded. A
        // newly discovered update remains waiting until the next navigation,
        // avoiding an unexpected reload while a form is being edited.
        activateWaitingWorker(registration);
        registration.addEventListener('updatefound', () => {
          window.dispatchEvent(new CustomEvent('pwa-update-available'));
        });
      } catch (error) {
        console.error('Service worker registration failed', error);
      }
    };

    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return;
      void navigator.serviceWorker.getRegistration('/').then((registration) => registration?.update());
    };

    const handleControllerChange = () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const handleServiceWorkerMessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object') return;
      const message = event.data as {
        type?: unknown;
        subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
      };
      if (message.type !== 'PUSH_SUBSCRIPTION_CHANGED' || !useAuthStore.getState().isAuthenticated) return;
      const endpoint = message.subscription?.endpoint;
      const p256dh = message.subscription?.keys?.p256dh;
      const auth = message.subscription?.keys?.auth;
      if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') return;

      // Rotation is transparent only for an already-authenticated open client.
      // Identity and school still come exclusively from the backend session.
      void notificationsApi.subscribePush({
        endpoint,
        keys: { p256dh, auth },
        device_name: navigator.userAgent.slice(0, 255),
      }).catch((error: unknown) => console.error('Push subscription synchronization failed', error));
    };

    void register();
    const updateTimer = window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);
    document.addEventListener('visibilitychange', checkForUpdate);
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      disposed = true;
      window.clearInterval(updateTimer);
      document.removeEventListener('visibilitychange', checkForUpdate);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  return null;
}
