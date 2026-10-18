/* Kapali Carsi PWA: statik kabuk cevrimdisi calisir, fiyatlar her zaman agdan tazelenir. */
const CACHE = 'carsi-v3';
const STATIC = ['/', '/index.html', '/app.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Fiyat API'si: once ag, olmazsa son onbellek (bayat veri gostermek yok denecek kadar az tutulur)
  if (url.pathname === '/api/spot') {
    e.respondWith(
      fetch(e.request).then((r) => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE).then((ch) => ch.put(e.request, c)); }
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Diger hersey: HTML her zaman agdan (guncel kod), statikler onbellekten
  e.respondWith(
    (async () => {
      const isHtml = e.request.mode === 'navigate' ||
        (e.request.headers.get('accept') || '').includes('text/html');
      if (isHtml) {
        try {
          const r = await fetch(e.request);
          if (r.ok) {
            const c = r.clone();
            caches.open(CACHE).then((ch) => ch.put(e.request, c)).catch(() => {});
            return r;
          }
        } catch { /* asagida onbellegi dene */ }
        const hit = await caches.match(e.request);
        if (hit) return hit;
        return fetch(e.request);
      }
      const hit = await caches.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok && url.origin === self.location.origin) {
        const c = r.clone();
        caches.open(CACHE).then((ch) => ch.put(e.request, c)).catch(() => {});
      }
      return r;
    })()
  );
});
