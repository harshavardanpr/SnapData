'use strict';
var CACHE_NAME = 'snapdata-shell-v5';
var APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './pwa.js',
  './timetable.js',
  './teacher-tools.js',
  './file-library.js',
  './manifest.json',
  './icon.svg'
];
var SHELL_PATHS = new Set(APP_SHELL.map(function (path) { return new URL(path, self.registration.scope).pathname; }));

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL); })
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
  // Only app-shell assets are cached. Never cache API responses, query URLs,
  // uploaded images, or user-generated records.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(function () {
      return caches.match('./index.html');
    }));
    return;
  }
  if (!SHELL_PATHS.has(url.pathname) || url.search) return;
  event.respondWith(fetch(request).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      return cached || Promise.reject(new Error('This app asset is not available offline.'));
    });
  }));
});
