const STATIC_CACHE = "witcorp-static-v3";
const DYNAMIC_CACHE = "witcorp-dynamic-v3";

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

// FETCH
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(networkRes => {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, networkRes.clone());
            return networkRes;
          });
        })
        .catch(() => {
          if (event.request.destination === "document") return caches.match("/index.html");
        });
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
    icon: '/default-avatar.png',
    badge: '/default-avatar.png',
    tag: data.tag || 'witcorp-notif',
    renotify: true,
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});

// Background sync (future-ready)
self.addEventListener("sync", event => {
  if (event.tag === "sync-records") event.waitUntil(syncOfflineData());
});
async function syncOfflineData() { console.log("Syncing offline data..."); }
