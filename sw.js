// Birdino Service Worker
// network-first fuer eigene Dateien; cache-first fuer die versionierten Firebase-SDK-Skripte.
var VERSION = '2026-07-19g';
var CACHE = 'birdino-' + VERSION;
var SDK = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    var own = c.addAll(['./', './index.html']).catch(function () {});
    var sdk = Promise.all(SDK.map(function (u) {
      return c.add(new Request(u, { mode: 'no-cors' })).catch(function () {});
    }));
    return Promise.all([own, sdk]);
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('birdino-') === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Firebase-SDK: cache-first (versioniert, aendert sich nie)
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) {
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        return res;
      });
    }));
    return;
  }
  // Alles andere Fremde unangetastet (Firebase-Daten, Supabase, APIs)
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (m) {
        return m || caches.match('./index.html');
      });
    })
  );
});
