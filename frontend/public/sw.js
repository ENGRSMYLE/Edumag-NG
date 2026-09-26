/* EduMag PWA service worker. No fetch handler: private data stays network-only. */

const VERSION = 'edumag-pwa-v2';
const FALLBACK_PATH = '/dashboard';
const FALLBACK_TITLE = 'EduMag NG';
const FALLBACK_BODY = 'You have a new school notification.';
const ICON = '/icons/icon-192.png';
const BADGE = '/icons/icon-192.png';
const ALLOWED_DESTINATIONS = new Set([
  '/dashboard',
  '/dashboard/admin/communication',
  '/dashboard/parent',
  '/dashboard/parent/assignments',
  '/dashboard/parent/attendance',
  '/dashboard/parent/children',
  '/dashboard/parent/communication',
  '/dashboard/parent/finance',
  '/dashboard/parent/results',
  '/dashboard/staff/communication',
  '/dashboard/super-admin/announcements',
]);

function safeText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function safeDestination(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return FALLBACK_PATH;
  try {
    const parsed = new URL(value, self.location.origin);
    if (parsed.origin !== self.location.origin || !ALLOWED_DESTINATIONS.has(parsed.pathname)) return FALLBACK_PATH;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return FALLBACK_PATH;
  }
}

function safeTag(value) {
  if (typeof value !== 'string') return 'edumag-notification';
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
  return normalized ? `edumag-${normalized}` : 'edumag-notification';
}

function parsePushPayload(data) {
  if (!data) return {};
  try {
    const value = data.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

self.addEventListener('install', () => {});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event.data);
  event.waitUntil(self.registration.showNotification(
    safeText(payload.title, FALLBACK_TITLE, 100),
    {
      body: safeText(payload.body, FALLBACK_BODY, 240),
      icon: ICON,
      badge: BADGE,
      tag: safeTag(payload.event_type),
      data: { path: safeDestination(payload.url) },
    },
  ));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = new URL(safeDestination(event.notification.data?.path), self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(destination);
      return existing.focus();
    }
    return self.clients.openWindow(destination);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
    if (!applicationServerKey) return;
    try {
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({
          type: 'PUSH_SUBSCRIPTION_CHANGED',
          subscription: subscription.toJSON(),
          version: VERSION,
        });
      }
    } catch {
      // A renewal failure must not break other service-worker events.
    }
  })());
});
