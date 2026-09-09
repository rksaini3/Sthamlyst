// Add this to your EXISTING public/sw.js (importScripts se load hoti hai)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};

  const notificationOptions = {
    body: data.body || 'Kuch naya hua Sthamly pe!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'sthamly-notification',
    requireInteraction: data.requireInteraction || false,
    data: { url: data.url || '/', userId: data.userId },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Sthamly', notificationOptions)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].navigate(event.notification.data.url);
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});