/*
 * db.js — Almacenamiento local en el dispositivo (IndexedDB).
 * Los relevamientos quedan guardados aunque se cierre la app o se apague el celular.
 */
(function () {
  'use strict';
  var NOMBRE = 'relevamiento-corredor';
  var VERSION = 1;
  var promesa = null;

  function abrir() {
    if (promesa) return promesa;
    promesa = new Promise(function (ok, error) {
      var pedido = indexedDB.open(NOMBRE, VERSION);
      pedido.onupgradeneeded = function () {
        var db = pedido.result;
        if (!db.objectStoreNames.contains('registros')) {
          var s = db.createObjectStore('registros', { keyPath: 'id' });
          s.createIndex('fecha', 'fecha');
        }
        if (!db.objectStoreNames.contains('ajustes')) db.createObjectStore('ajustes');
      };
      pedido.onsuccess = function () { ok(pedido.result); };
      pedido.onerror = function () { error(pedido.error); };
    });
    return promesa;
  }

  function operar(almacen, modo, fn) {
    return abrir().then(function (db) {
      return new Promise(function (ok, error) {
        var t = db.transaction(almacen, modo);
        var pedido = fn(t.objectStore(almacen));
        t.oncomplete = function () { ok(pedido ? pedido.result : undefined); };
        t.onerror = function () { error(t.error); };
        t.onabort = function () { error(t.error); };
      });
    });
  }

  window.DB = {
    guardar: function (reg) { return operar('registros', 'readwrite', function (s) { return s.put(reg); }).then(function () { return reg; }); },
    guardarVarios: function (regs) {
      return operar('registros', 'readwrite', function (s) { regs.forEach(function (r) { s.put(r); }); return null; });
    },
    obtener: function (id) { return operar('registros', 'readonly', function (s) { return s.get(id); }); },
    todos: function () { return operar('registros', 'readonly', function (s) { return s.getAll(); }); },
    borrar: function (id) { return operar('registros', 'readwrite', function (s) { return s.delete(id); }); },
    borrarTodos: function () { return operar('registros', 'readwrite', function (s) { return s.clear(); }); },
    leerAjuste: function (clave) { return operar('ajustes', 'readonly', function (s) { return s.get(clave); }); },
    guardarAjuste: function (clave, valor) { return operar('ajustes', 'readwrite', function (s) { return s.put(valor, clave); }); }
  };
})();
