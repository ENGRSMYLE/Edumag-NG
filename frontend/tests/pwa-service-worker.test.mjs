import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function loadWorker({ windows = [] } = {}) {
  const listeners = new Map();
  const shown = [];
  const opened = [];
  const context = {
    URL,
    Set,
    console,
    self: {
      location: { origin: 'https://school.example' },
      addEventListener(type, handler) { listeners.set(type, handler); },
      registration: {
        showNotification(title, options) {
          shown.push({ title, options });
          return Promise.resolve();
        },
      },
      clients: {
        claim: async () => {},
        matchAll: async () => windows,
        openWindow: async (url) => { opened.push(url); return { url }; },
      },
      skipWaiting: async () => {},
    },
  };
  vm.runInNewContext(source, context, { filename: 'sw.js' });
  return { listeners, shown, opened };
}

async function dispatch(handler, event) {
  let pending;
  handler({ ...event, waitUntil(value) { pending = value; } });
  await pending;
}

test('malformed push data uses privacy-safe fallback content', async () => {
  const worker = loadWorker();
  await dispatch(worker.listeners.get('push'), {
    data: { json() { throw new Error('invalid JSON'); } },
  });
  assert.equal(worker.shown[0].title, 'EduMag NG');
  assert.equal(worker.shown[0].options.body, 'You have a new school notification.');
  assert.equal(worker.shown[0].options.data.path, '/dashboard');
});

test('external and protocol-relative notification URLs are rejected', async () => {
  for (const url of ['https://evil.example/phish', '//evil.example/phish', '/not-allowed']) {
    const worker = loadWorker();
    await dispatch(worker.listeners.get('push'), {
      data: { json: () => ({ title: 'Alert', body: 'Open', url }) },
    });
    assert.equal(worker.shown[0].options.data.path, '/dashboard');
  }
});

test('notification click reuses a same-origin window and navigates safely', async () => {
  const navigated = [];
  let focused = false;
  const windowClient = {
    url: 'https://school.example/dashboard',
    async navigate(url) { navigated.push(url); },
    async focus() { focused = true; },
  };
  const worker = loadWorker({ windows: [windowClient] });
  let closed = false;
  await dispatch(worker.listeners.get('notificationclick'), {
    notification: {
      data: { path: 'https://evil.example/steal' },
      close() { closed = true; },
    },
  });
  assert.equal(closed, true);
  assert.deepEqual(navigated, ['https://school.example/dashboard']);
  assert.equal(focused, true);
  assert.deepEqual(worker.opened, []);
});

test('an allowed internal destination opens when no app window exists', async () => {
  const worker = loadWorker();
  await dispatch(worker.listeners.get('notificationclick'), {
    notification: {
      data: { path: '/dashboard/parent/results' },
      close() {},
    },
  });
  assert.deepEqual(worker.opened, ['https://school.example/dashboard/parent/results']);
});

test('service worker never installs a fetch cache handler', () => {
  const worker = loadWorker();
  assert.equal(worker.listeners.has('fetch'), false);
  assert.equal(/caches\s*\./.test(source), false);
});
