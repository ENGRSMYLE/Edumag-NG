// Import into one process so the suite also runs in restricted CI/build
// environments where Node cannot spawn its default per-file test workers.
await import('./pwa-client-security.test.mjs');
await import('./pwa-service-worker.test.mjs');
