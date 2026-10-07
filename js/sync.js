/*
 * sync.js — Envío a la planilla de Google (Apps Script), paquetes del día cifrados e
 * importación de paquetes en la computadora de la administradora.
 */
(function (raiz) {
  'use strict';

  var Reg = raiz.Registro || (typeof require !== 'undefined' ? require('./registro.js') : null);
  var subtle = (raiz.crypto && raiz.crypto.subtle) || (typeof require !== 'undefined' ? require('crypto').webcrypto.subtle : null);
  var getRandom = function (n) {
    var c = raiz.crypto || require('crypto').webcrypto;
    return c.getRandomValues(new Uint8Array(n));
  };

  /* ---------- Envío a Apps Script ---------- */
  // Se usa text/plain para que el navegador no haga una consulta previa (CORS) que Apps Script no responde.
  function postJSON(url, cuerpo, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var reloj = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 45000) : null;
    return fetch(url, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('El servidor respondió ' + r.status);
      return r.json();
    }).finally(function () { if (reloj) clearTimeout(reloj); });
  }

  function probarConexion(url, clave) {
    return postJSON(url, { accion: 'probar', token: clave }, 20000);
  }

  /* Envía en lotes; devuelve la lista de ids confirmados por la planilla. */
  function enviar(url, clave, registros, alAvanzar) {
    var lotes = [];
    for (var i = 0; i < registros.length; i += 25) lotes.push(registros.slice(i, i + 25));
    var confirmados = [];
    return lotes.reduce(function (cadena, lote, n) {
      return cadena.then(function () {
        var cuerpo = { accion: 'guardar', token: clave, registros: lote.map(Reg.aplanar) };
        return postJSON(url, cuerpo).then(function (resp) {
          if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Respuesta inválida de la planilla');
          confirmados = confirmados.concat(resp.recibidos || []);
          if (alAvanzar) alAvanzar(n + 1, lotes.length);
        });
      });
    }, Promise.resolve()).then(function () { return confirmados; });
  }

  /* ---------- Cifrado de paquetes (AES-GCM con clave derivada de la clave del equipo) ---------- */
  function aBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function deBase64(txt) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(txt, 'base64'));
    var s = atob(txt), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  function derivarClave(clave, sal) {
    var enc = new TextEncoder();
    return subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: 150000, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  function armarPaquete(registros, meta, clave) {
    var cuerpo = JSON.stringify(registros);
    var paquete = { tipo: 'paquete-relevamiento', version: 1, generado: new Date().toISOString(),
      equipo: meta.equipo, dispositivo: meta.dispositivo, cantidad: registros.length };
    if (!clave) { paquete.cifrado = false; paquete.datos = registros; return Promise.resolve(JSON.stringify(paquete)); }
    var sal = getRandom(16), iv = getRandom(12);
    return derivarClave(clave, sal).then(function (k) {
      return subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(cuerpo));
    }).then(function (cifrado) {
      paquete.cifrado = true; paquete.sal = aBase64(sal); paquete.iv = aBase64(iv);
      paquete.datos = aBase64(new Uint8Array(cifrado));
      return JSON.stringify(paquete);
    });
  }

  function abrirPaquete(texto, clave) {
    var p;
    try { p = JSON.parse(texto); } catch (e) { return Promise.reject(new Error('El archivo no es un paquete válido')); }
    if (!p || p.tipo !== 'paquete-relevamiento') return Promise.reject(new Error('El archivo no es un paquete de relevamiento'));
    if (!p.cifrado) return Promise.resolve({ meta: p, registros: p.datos || [] });
    if (!clave) return Promise.reject(new Error('El paquete está cifrado: cargá la clave del equipo en Ajustes'));
    return derivarClave(clave, deBase64(p.sal)).then(function (k) {
      return subtle.decrypt({ name: 'AES-GCM', iv: deBase64(p.iv) }, k, deBase64(p.datos));
    }).then(function (plano) {
      return { meta: p, registros: JSON.parse(new TextDecoder().decode(plano)) };
    }, function () { throw new Error('No se pudo abrir: la clave del equipo no coincide'); });
  }

  /* Une registros importados con los locales: gana la versión modificada más recientemente. */
  function unir(locales, entrantes) {
    var porId = {};
    locales.forEach(function (r) { porId[r.id] = r; });
    var nuevos = 0, actualizados = 0, iguales = 0, aGuardar = [];
    entrantes.forEach(function (r) {
      if (!r || !r.id) return;
      var actual = porId[r.id];
      var copia = Object.assign({}, r, { sincronizado: null, importado: new Date().toISOString() });
      if (!actual) { nuevos++; aGuardar.push(copia); porId[r.id] = copia; }
      else if ((r.modificado || '') > (actual.modificado || '')) { actualizados++; aGuardar.push(copia); porId[r.id] = copia; }
      else iguales++;
    });
    return { nuevos: nuevos, actualizados: actualizados, iguales: iguales, aGuardar: aGuardar };
  }

  /* ---------- Archivos ---------- */
  function descargar(nombre, contenido, tipo) {
    var blob = new Blob([contenido], { type: tipo });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* Comparte por WhatsApp, correo o Drive cuando el celular lo permite; si no, descarga. */
  function compartirODescargar(nombre, contenido, tipo, titulo) {
    try {
      var archivo = new File([contenido], nombre, { type: tipo });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        return navigator.share({ files: [archivo], title: titulo }).then(function () { return 'compartido'; }, function (e) {
          if (e && e.name === 'AbortError') throw e; // la persona cerró el menú de compartir
          descargar(nombre, contenido, tipo);        // si el celular no deja compartir, se descarga
          return 'descargado';
        });
      }
    } catch (e) { /* sigue con la descarga */ }
    descargar(nombre, contenido, tipo);
    return Promise.resolve('descargado');
  }

  var api = { probarConexion: probarConexion, enviar: enviar, armarPaquete: armarPaquete, abrirPaquete: abrirPaquete,
    unir: unir, descargar: descargar, compartirODescargar: compartirODescargar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Sync = api;
})(typeof window !== 'undefined' ? window : this);
