/* Offline support: the app opens without internet. Records are saved by the page itself. */
var VERSION = 'qet-v10';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== 'qet-state'; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;            // never touch the Google Sheet calls
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error()); });
      return hit || net;                         // open instantly from the saved copy, refresh it in the background
    });
  }));
});

/* Optional background nudge (only some installed Android apps allow it) */
self.addEventListener('periodicsync', function (e) {
  if (e.tag !== 'qet-daily') return;
  e.waitUntil(caches.open('qet-state').then(function (c) { return c.match('state.json'); }).then(function (r) { return r ? r.json() : null; }).then(function (st) {
    if (!st || !st.on) return;
    var d = new Date(), hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    var today = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    if (hm >= st.time && st.saved !== today) return self.registration.showNotification('Quail Egg Tracker', { body: "Don't forget to save today's records.", icon: 'icon-192.png', tag: 'qet-daily' });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (cs) { return cs.length ? cs[0].focus() : self.clients.openWindow('./'); }));
});
