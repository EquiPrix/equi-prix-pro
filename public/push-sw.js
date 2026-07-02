// push-sw.js
// Loaded into the generated service worker via workbox.importScripts in
// vite.config.js. Handles incoming Web Push events and notification clicks.
// Kept separate from vite-plugin-pwa's generated SW code so it survives
// rebuilds untouched.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'EquiPrix', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'EquiPrix';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/icon-192x192.png',
    data: { url: payload.url || '/play' },
    tag: payload.tag || 'equiprix-notification',
    renotify: !!payload.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/play';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});