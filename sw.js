const CACHE_NAME = "witcorp-cache-v2";
const STATIC_CACHE = "witcorp-static-v2";
const DYNAMIC_CACHE = "witcorp-dynamic-v2";

// Core files (UI shell)
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/script.js",
  "/style.css",
  "/default-avatar.png"
];

// INSTALL
self.addEventListener("install", event => {
  console.log("SW Installed");

  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );

  self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", event => {
  console.log("SW Activated");

  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (
            key !== STATIC_CACHE &&
            key !== DYNAMIC_CACHE
          ) {
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// FETCH STRATEGY (SMART CACHE + NETWORK FALLBACK)
self.addEventListener("fetch", event => {
  const request = event.request;

  // Only GET requests
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(networkRes => {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, networkRes.clone());
            return networkRes;
          });
        })
        .catch(() => {
          // fallback for pages
          if (request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});

// BACKGROUND SYNC (future-ready hook)
self.addEventListener("sync", event => {
  if (event.tag === "sync-records") {
    event.waitUntil(syncOfflineData());
  }
});

// Example placeholder for offline sync logic
async function syncOfflineData() {
  console.log("Syncing offline data...");
  // Yahan IndexedDB / API sync logic aayega
}

// PUSH NOTIFICATION HANDLER (IMPORTANT)
self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "New Update", body: "You have a notification" };
  }

  self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/default-avatar.png",
    badge: "/default-avatar.png"
  });
});
// Push event — app band ho tab bhi ye fire hoga
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Witcorp Hub';
  const options = {
    body: data.message || 'New update available',
    icon: './logo.png',
    badge: './logo.png',
    tag: data.tag || 'witcorp-notif',
    renotify: true,
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — app open kare
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
