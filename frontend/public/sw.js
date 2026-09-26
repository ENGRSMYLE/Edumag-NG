/* EduMag PWA shell.
 *
 * This service worker intentionally has no fetch handler. Dashboard pages,
 * authentication calls, and student data retain their existing network-only
 * behavior and are never placed in a service-worker cache.
 */

const VERSION = 'edumag-pwa-v1';

self.addEventListener('install', () => {
  // Do not take over an open dashboard immediately. The registration client
  // activates a waiting update on the user's next page load.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  // Push delivery is introduced in a later phase. Keeping the listener here
  // makes unsupported payloads a safe no-op during the PWA foundation phase.
  if (event.data) void VERSION;
});
