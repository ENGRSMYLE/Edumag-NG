'use client';

import { useEffect } from 'react';

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

    void register();
    const updateTimer = window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);
    document.addEventListener('visibilitychange', checkForUpdate);
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      disposed = true;
      window.clearInterval(updateTimer);
      document.removeEventListener('visibilitychange', checkForUpdate);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
