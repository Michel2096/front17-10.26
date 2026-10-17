/* Service Worker de LapiStock.
 *
 * Estrategias (Cache API):
 *  - Precache (install): app shell completo. En el build, el plugin de vite.config.ts
 *    reemplaza "__PRECACHE__" por la lista real de archivos de dist/ (JS/CSS con hash).
 *  - Navegación (HTML): red primero; sin red => index.html desde caché (SPA offline).
 *  - Recursos estáticos del mismo origen: caché primero; si no está, red y se guarda.
 *  - GET /api/*: red primero con copia en caché; sin red => última respuesta guardada.
 *  - POST/PUT/DELETE: nunca se cachean; la app los encola en IndexedDB si no hay red.
 */
const VERSION = '__VERSION__';
const CACHE_APP = `lapistock-app-${VERSION}`;
const CACHE_API = 'lapistock-api';
const PRECACHE = ['__PRECACHE__'];
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/logo.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  const recursos = [...new Set([...SHELL, ...PRECACHE.filter((r) => r !== '__PRECACHE__')])];
  event.waitUntil(
    caches
      .open(CACHE_APP)
      .then((cache) => cache.addAll(recursos))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c.startsWith('lapistock-app-') && c !== CACHE_APP).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(redPrimeroApi(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(navegacion(request));
  } else {
    event.respondWith(cachePrimero(request));
  }
});

async function redPrimeroApi(request) {
  const cache = await caches.open(CACHE_API);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const guardada = await cache.match(request);
    if (guardada) return guardada;
    return new Response(JSON.stringify({ error: 'Sin conexión y sin copia en caché' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function navegacion(request) {
  try {
    const res = await fetch(request);
    const cache = await caches.open(CACHE_APP);
    cache.put('/index.html', res.clone());
    return res;
  } catch {
    return (await caches.match('/index.html')) ?? (await caches.match('/')) ?? Response.error();
  }
}

async function cachePrimero(request) {
  const guardada = await caches.match(request);
  if (guardada) return guardada;
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(CACHE_APP)).put(request, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}
