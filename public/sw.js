// Minimal service worker: it makes the site installable and caches NOTHING.
// Reports, stories and account data are never stored on the device by the app shell.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})   // network handles everything
