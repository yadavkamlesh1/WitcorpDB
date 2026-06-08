const STATIC_CACHE = "witcorp-static-v4";
const DYNAMIC_CACHE = "witcorp-dynamic-v4";
const STATIC_ASSETS = [
  "/WitcorpDB/",
  "/WitcorpDB/index.html",
  "/WitcorpDB/script.js",
  "/WitcorpDB/style.css",
];

// INSTALL
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH (Network First)
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();

        caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(event.request, clone);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
// ✅ SINGLE push handler — app close hone par bhi kaam karega
self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'Witcorp Hub', message: 'New update available' }; }

  const title = data.title || 'Witcorp Hub';
  const options = {
    body: data.message || data.body || 'New update available',
    icon: '/WitcorpDB/logo.png',
    badge: '/WitcorpDB/logo.png',
    tag: data.tag || 'witcorp-notif',
    renotify: true,
    data: { url: '/WitcorpDB/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/WitcorpDB/'));
});

// Background sync (future-ready)
self.addEventListener("sync", event => {
  if (event.tag === "sync-records") event.waitUntil(syncOfflineData());
});
async function syncOfflineData() { console.log("Syncing offline data..."); }
