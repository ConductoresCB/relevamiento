/*
 * sw.js — Permite usar la app sin señal. Guarda en el dispositivo los archivos de la app
 * y las tipografías la primera vez que se abre con conexión.
 * La versión se toma de js/config.js (versionApp): al publicar cambios, subí ese número
 * y los celulares descargan la versión nueva la próxima vez que abran la app con señal.
 *
 * IMPORTANTE: el navegador solo revisa si hay un service worker nuevo comparando el TEXTO
 * de este archivo con el que ya tiene guardado. Por eso la línea de abajo (build:) tiene
 * que llevar el mismo número que versionApp en config.js: si este archivo queda igual
 * letra por letra, el navegador no se entera de que hay una versión nueva y sigue usando
 * la app vieja aunque config.js y los demás archivos ya se hayan actualizado.
 */
// build: 1.5.3-prueba
importScripts('js/config.js');
var PREFIJO = (self.CONFIG && self.CONFIG.prefijoCache) || 'relevamiento';
var VERSION = PREFIJO + '-' + ((self.CONFIG && self.CONFIG.versionApp) || '1');
var ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilos.css', 'js/config.js',
  'js/calculos.js', 'js/cuestionario.js', 'js/registro.js', 'js/sync.js', 'js/db.js', 'js/grabacion.js', 'js/app.js',
  'icons/icono-192.png', 'icons/icono-512.png', 'icons/icono-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // cache: 'reload' evita usar copias viejas guardadas por el navegador
    return c.addAll(ARCHIVOS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (claves) {
    // Solo borra copias viejas de ESTA app (la principal y la de prueba comparten el sitio)
    return Promise.all(claves.filter(function (k) { return k !== VERSION && k.indexOf(PREFIJO + '-') === 0; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // los envíos a la planilla van siempre por la red
  var url = new URL(req.url);

  // Tipografías de Google: se guardan la primera vez y después se usan sin red
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(PREFIJO + '-fuentes').then(function (c) {
      return c.match(req).then(function (guardada) {
        var red = fetch(req).then(function (resp) { if (resp.ok || resp.type === 'opaque') c.put(req, resp.clone()); return resp; })
          .catch(function () { return guardada; });
        return guardada || red;
      });
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Archivos de la app: primero el guardado (funciona sin señal); se actualiza en segundo plano
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (guardada) {
      var red = fetch(req).then(function (resp) { if (resp.ok) c.put(req, resp.clone()); return resp; })
        .catch(function () { return guardada || (req.mode === 'navigate' ? c.match('index.html') : undefined); });
      return guardada || red;
    });
  }));
});
