self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};

  const notificationOptions = {
    body: data.body || 'Kuch naya hua Sthamly pe!',
    icon: '/icon-192.png',      // ← FIXED: pehle icon-192x192.png tha, file exist nahi karti thi
    badge: '/icon-192.png',      // ← FIXED: badge-72x72.png bhi exist nahi karti, isliye same icon use kiya
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