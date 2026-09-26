import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const settings = readFileSync(
  new URL('../components/pwa/PushNotificationSettings.tsx', import.meta.url),
  'utf8',
);
const registration = readFileSync(
  new URL('../components/pwa/ServiceWorkerRegistration.tsx', import.meta.url),
  'utf8',
);
const api = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');

test('notification permission is requested only by the explicit enable action', () => {
  const enableStart = settings.indexOf('const enable = async () =>');
  const disableStart = settings.indexOf('const disable = async () =>');
  assert.ok(enableStart >= 0 && disableStart > enableStart);
  assert.equal(settings.slice(0, enableStart).includes('Notification.requestPermission()'), false);
  assert.equal(settings.slice(enableStart, disableStart).includes('Notification.requestPermission()'), true);
});

test('permission, unsupported, offline and API error states are represented', () => {
  for (const marker of [
    "permission === 'denied'",
    '!supported',
    '!online',
    'statusQuery.isError',
    "window.addEventListener('offline'",
    "window.removeEventListener('offline'",
  ]) assert.ok(settings.includes(marker), `missing state/cleanup: ${marker}`);
});

test('subscribe and unsubscribe send only subscription material, never identity', () => {
  assert.ok(api.includes("api.post<PushSubscriptionStatus>('/notifications/push/subscribe', subscription)"));
  assert.ok(api.includes("api.delete<PushSubscriptionStatus>('/notifications/push/unsubscribe', { data: { endpoint } })"));
  const pushBlock = api.slice(api.indexOf('export const notificationsApi'), api.indexOf('export const notificationsApi') + 1800);
  assert.equal(/user_id|school_id/.test(pushBlock), false);
});

test('registration has update handling and removes every installed listener', () => {
  for (const marker of [
    "navigator.serviceWorker.register('/sw.js'",
    "navigator.serviceWorker.addEventListener('controllerchange'",
    "navigator.serviceWorker.removeEventListener('controllerchange'",
    "navigator.serviceWorker.addEventListener('message'",
    "navigator.serviceWorker.removeEventListener('message'",
    'window.clearInterval(updateTimer)',
  ]) assert.ok(registration.includes(marker), `missing registration lifecycle behavior: ${marker}`);
});

test('only the public VAPID variable is referenced by frontend runtime code', () => {
  assert.ok(settings.includes('NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY'));
  assert.equal(settings.includes('WEB_PUSH_VAPID_PRIVATE_KEY'), false);
  assert.equal(registration.includes('WEB_PUSH_VAPID_PRIVATE_KEY'), false);
  assert.equal(api.includes('WEB_PUSH_VAPID_PRIVATE_KEY'), false);
});
