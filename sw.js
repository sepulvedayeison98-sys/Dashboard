// Service worker — habilita PWA y maneja Web Push para notificaciones en background.
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  // Network-first puro: siempre va a la red. Si falla, no hay caché (datos en vivo).
  return;
});

// Recibe push del servidor y muestra notificación aunque la app esté cerrada
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch(_) {}
  const title = data.title || '🏗️ Nuevo turno';
  const options = {
    body: data.body || '',
    icon: './icon-montacargas.svg',
    badge: './icon-montacargas.svg',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: './montacargas.html' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación abre/enfoca la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('montacargas') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('./montacargas.html');
    })
  );
});
