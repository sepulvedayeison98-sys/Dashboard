// Service worker mínimo — habilita la instalación de la PWA.
// NO cachea los Excel ni la API (para que los datos siempre lleguen frescos del repo).
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  // Network-first puro: siempre va a la red. Si falla, no hay caché (datos en vivo).
  // Esto evita servir inventario/pedidos viejos.
  return;
});
