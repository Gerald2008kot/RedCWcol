// RedCW — Service Worker (PWA)
const CACHE_NAME = "redcw-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/news.html",
  "/communities.html",
  "/my-forums.html",
  "/chats.html",
  "/profile.html",
  "/plans.html",
  "/forum.html",
  "/css/main.css",
  "/config.js",
  "/js/i18n.js",
  "/js/auth.js",
  "/js/cloudinary.js",
  "/js/posts.js",
  "/js/forums.js",
  "/js/chat.js",
  "/js/plans.js",
  "/js/admin.js",
  "/js/app.js",
  "/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Solo cachear GET
  if (e.request.method !== "GET") return;
  // No cachear Supabase ni Cloudinary (siempre red)
  if (e.request.url.includes("supabase.co") || e.request.url.includes("cloudinary.com")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
