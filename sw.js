// ============================================================
//  RedCW — Service Worker (PWA) con soporte subcarpeta
// ============================================================
const CACHE_NAME = "redcw-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/manifest.json",
  "/redcw/index.html",
  "/redcw/css/app.css",
  "/redcw/js/config.js",
  "/redcw/js/supabase.js",
  "/redcw/js/app.js",
  "/redcw/js/pages.js",
  "/redcw/js/auth.js",
  "/redcw/icons/icon-192.png",
  "/redcw/icons/icon-512.png",
  "/tools/index.html",
  "/tools/tools/calculadora.html",
  "/tools/tools/contrasenas.html",
  "/tools/tools/convertidor.html",
  "/tools/tools/cronometro.html",
  "/tools/tools/elementos.html",
  "/tools/tools/estadistica.html",
  "/tools/tools/fisica.html",
  "/tools/tools/funciones",
  "/tools/tools/morse.html",
  "/tools/tools/notas.html",
  "/tools/tools/pomodoro.html",
  "/tools/tools/tablas.html",
  "/digitals/index.html",
  "/digitals/digital/conexion.html",
  "/digitals/digital/ip.html",
  "/digitals/digital/set.html",
];

// ── Install ─────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Filtrar URLs externas para el addAll inicial si es necesario
      return cache.addAll(ASSETS_TO_CACHE.filter(u => !u.startsWith("http")));
    })
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch (Network first, fallback to cache) ─────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("supabase.co")) return;
  
  event.respondWith(
    fetch(event.request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    })
    .catch(() => caches.match(event.request))
  );
});

// ── Push notifications ───────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "RedCW", {
      body: data.body || "Nueva notificación",
      icon: "/redcw/icons/icon-192.png",
      badge: "/redcw/icons/icon-192.png",
    })
  );
});
