// EmotiCare AI / MANAS Web Push Service Worker
// Strictly follows non-clinical neutral notification guidelines.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      data = { body: event.data.text() };
    }
  }

  // Strictly neutral titles and bodies to protect user privacy on lock screens
  const title = data.title || 'Daily Check-in';
  const body = data.body || 'Time for your check-in.';
  const url = (data.data && data.data.url) || '/?chat=open';

  const options = {
    body: body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'manas-checkin',
    renotify: true,
    data: {
      url: url,
      timestamp: Date.now()
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
