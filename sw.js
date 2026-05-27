self.addEventListener('install', event => {
  console.log("Service Worker Installed");
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log("Service Worker Activated");
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("Offline mode: No internet");
    })
  );
});
