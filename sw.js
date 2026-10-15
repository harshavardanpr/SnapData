'use strict';
var CACHE_NAME = 'snapdata-shell-v1';
var APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './pwa.js',
  './timetable.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf('snapdata-shell-') === 0 && key !== CACHE_NAME;
      }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || (request.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('Offline asset unavailable')));
      });
    })
  );
});
