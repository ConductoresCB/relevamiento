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

  /* ---------- Cifrado de paquetes ----------
   * Formato 2 (app 1.4): AES-GCM de 256 bits (Web Crypto del navegador, sin criptografía propia) con una clave
   * derivada de la clave del equipo por PBKDF2-HMAC-SHA256 con 600 000 iteraciones (OWASP 2023), sal aleatoria
   * de 16 bytes e IV aleatorio de 12 bytes, nuevos en cada paquete. La cabecera visible (equipo, dispositivo,
   * cantidad, fecha) va como dato asociado: si alguien la modifica, el paquete no abre.
   * Formato 1 (hasta 1.3): 150 000 iteraciones y cabecera sin autenticar. Se sigue pudiendo abrir.
   */
  var ITERACIONES = 600000, ITERACIONES_V1 = 150000;

  function aBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function deBase64(txt) {
    if (typeof txt !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(txt)) throw new Error('base64 inválido');
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(txt, 'base64'));
    var s = atob(txt), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function utf8(t) { return new TextEncoder().encode(t); }

  function derivarClave(clave, sal, iteraciones) {
    return subtle.importKey('raw', utf8(clave), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: iteraciones, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  /* Cabecera que viaja sin cifrar pero autenticada (dato asociado de AES-GCM). */
  function cabecera(p) {
    return JSON.stringify({ tipo: p.tipo, version: p.version, generado: p.generado, equipo: p.equipo,
      dispositivo: p.dispositivo, cantidad: p.cantidad, iteraciones: p.iteraciones });
  }

  /* Sin clave no se genera ningún archivo: desde 1.4 no hay paquetes sin cifrar. */
  function armarPaquete(registros, meta, clave) {
    if (!clave) return Promise.reject(new Error('Falta la clave del equipo en Ajustes: sin clave no se genera el archivo'));
    var paquete = { tipo: 'paquete-relevamiento', version: 2, generado: new Date().toISOString(),
      equipo: meta.equipo, dispositivo: meta.dispositivo, cantidad: registros.length,
      iteraciones: (meta && meta.iteraciones) || ITERACIONES };
    var sal = getRandom(16), iv = getRandom(12);
    return derivarClave(clave, sal, paquete.iteraciones).then(function (k) {
      return subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: utf8(cabecera(paquete)) }, k, utf8(JSON.stringify(registros)));
    }).then(function (cifrado) {
      paquete.cifrado = true; paquete.sal = aBase64(sal); paquete.iv = aBase64(iv);
      paquete.datos = aBase64(new Uint8Array(cifrado));
      return JSON.stringify(paquete);
    });
  }

  function abrirPaquete(texto, clave) {
    var p;
    try { p = JSON.parse(texto); } catch (e) { return Promise.reject(new Error('El archivo está dañado o incompleto: no se puede leer')); }
    if (!p || p.tipo !== 'paquete-relevamiento') return Promise.reject(new Error('El archivo no es un paquete de relevamiento'));
    if (!p.cifrado) return Promise.reject(new Error('El paquete no está cifrado: por seguridad no se importa. Pedí que lo generen de nuevo con la clave del equipo cargada'));
    if (!clave) return Promise.reject(new Error('El paquete está cifrado: cargá la clave del equipo en Ajustes'));
    var v2 = Number(p.version) >= 2;
    var iter = v2 ? Number(p.iteraciones) : ITERACIONES_V1;
    if (!(iter >= 100000 && iter <= 5000000)) return Promise.reject(new Error('El archivo está dañado: cabecera inválida'));
    var sal, iv, datos;
    try { sal = deBase64(p.sal); iv = deBase64(p.iv); datos = deBase64(p.datos); }
    catch (e) { return Promise.reject(new Error('El archivo está dañado o incompleto')); }
    var params = { name: 'AES-GCM', iv: iv };
    if (v2) params.additionalData = utf8(cabecera(p));
    return derivarClave(clave, sal, iter).then(function (k) { return subtle.decrypt(params, k, datos); })
      .then(function (plano) {
        var registros = JSON.parse(new TextDecoder().decode(plano));
        if (!Array.isArray(registros)) throw new Error('El paquete no tiene una lista de relevamientos');
        if (typeof p.cantidad === 'number' && registros.length !== p.cantidad) {
          throw new Error('El paquete está incompleto: dice ' + p.cantidad + ' relevamientos y trae ' + registros.length);
        }
        return { meta: p, registros: registros };
      }, function () { throw new Error('No se pudo abrir: la clave del equipo no coincide, o el archivo fue modificado o está dañado'); });
  }

  /* Huella del archivo: los primeros 32 bits del SHA-256, en dos grupos (p. ej. 3F9A-21C7). Sirve para
     confirmar por mensaje que el archivo que llegó es el mismo que salió. La protección contra cambios la da
     AES-GCM; la huella es solo para comparar a simple vista. */
  function huella(texto) {
    return subtle.digest('SHA-256', utf8(texto)).then(function (h) {
      var b = new Uint8Array(h), s = '';
      for (var i = 0; i < 4; i++) s += ('0' + b[i].toString(16)).slice(-2);
      s = s.toUpperCase();
      return s.slice(0, 4) + '-' + s.slice(4);
    });
  }

  /* Un relevamiento importado tiene que tener un id simple y una fecha AAAA-MM-DD: así ningún archivo puede
     meter código en las pantallas ni romper las rutas de la app. */
  var ID_VALIDO = /^[A-Za-z0-9_-]{1,80}$/, FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
  function registroValido(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
    if (typeof r.id !== 'string' || !ID_VALIDO.test(r.id)) return false;
    if (r.fecha != null && r.fecha !== '' && !FECHA_VALIDA.test(String(r.fecha))) return false;
    if (r.socio != null && (typeof r.socio !== 'object' || Array.isArray(r.socio))) return false;
    if (r.bio != null && (typeof r.bio !== 'object' || Array.isArray(r.bio))) return false;
    if (r.contacto != null && (typeof r.contacto !== 'object' || Array.isArray(r.contacto))) return false;
    return true;
  }

  /* Une registros importados con los locales: gana la versión modificada más recientemente. */
  function unir(locales, entrantes) {
    var porId = {};
    locales.forEach(function (r) { porId[r.id] = r; });
    var nuevos = 0, actualizados = 0, iguales = 0, descartados = 0, aGuardar = [];
    entrantes.forEach(function (r) {
      if (!registroValido(r)) { descartados++; return; }
      var actual = porId[r.id];
      var copia = Object.assign({}, r, { sincronizado: null, importado: new Date().toISOString() });
      if (!actual) { nuevos++; aGuardar.push(copia); porId[r.id] = copia; }
      else if (String(r.modificado || '') > String(actual.modificado || '')) { actualizados++; aGuardar.push(copia); porId[r.id] = copia; }
      else iguales++;
    });
    return { nuevos: nuevos, actualizados: actualizados, iguales: iguales, descartados: descartados, aGuardar: aGuardar };
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
    huella: huella, registroValido: registroValido, unir: unir, descargar: descargar, compartirODescargar: compartirODescargar,
    ITERACIONES: ITERACIONES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Sync = api;
})(typeof window !== 'undefined' ? window : this);
