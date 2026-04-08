/**
 * Service Worker registration + Background Sync integration.
 * (TDR-0010, Platform Invariant P6)
 *
 * Browser/PWA only — NOT for Cloudflare Workers runtime.
 * The actual sw.js lives at public/sw.js (not a TS module).
 */

/**
 * Register the WebWaka service worker and subscribe to background sync.
 * Call once on app startup (e.g. in main.ts).
 */
export function registerSyncServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js').then(async (registration) => {
    if ('sync' in registration) {
      await (registration as { sync: { register(tag: string): Promise<void> } }).sync.register('webwaka-sync');
    }
  }).catch((err: unknown) => {
    console.warn('[offline-sync] Service Worker registration failed:', err);
  });
}

/*
 * public/sw.js content (not TypeScript — place manually in public/ folder):
 *
 * self.addEventListener('sync', (event) => {
 *   if (event.tag === 'webwaka-sync') {
 *     event.waitUntil(syncEngine.processPendingQueue());
 *   }
 * });
 */
