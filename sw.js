// Sube este número cada vez que cambies archivos de la app,
// así el navegador sabe que debe reemplazar la caché vieja.
const CACHE_NAME = 'ecostan-store-v2';

const ARCHIVOS_PARA_CACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/estilos.css',
  '/app.js',
  '/manifest.json'
];

/* ==========================================
   INSTALACIÓN: precarga los archivos propios
========================================== */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Si un archivo falla al cachear, no tumba la instalación
      // completa de los demás (antes cache.addAll fallaba todo o nada).
      return Promise.all(
        ARCHIVOS_PARA_CACHE.map((url) =>
          cache.add(url).catch((err) => console.warn('No se pudo cachear', url, err))
        )
      );
    }).then(() => self.skipWaiting()) // activa esta versión nueva de inmediato
  );
});

/* ==========================================
   ACTIVACIÓN: borra cachés viejas y toma el control
========================================== */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    ).then(() => self.clients.claim()) // controla las pestañas ya abiertas, sin esperar a que las cierren
  );
});

/* ==========================================
   FETCH: solo cachea GET de tu propio dominio.
   Todo lo demás (Supabase, Leaflet, CDNs, POST, etc.)
   pasa derecho a la red, sin que el service worker lo toque.
========================================== */
self.addEventListener('fetch', (e) => {
  const { request } = e;

  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  e.respondWith(
    caches.match(request).then((response) => response || fetch(request))
  );
});