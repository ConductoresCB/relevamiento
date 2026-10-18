/*
 * grabacion.js — Grabación de audio de la entrevista (versión de prueba 1.5).
 * Graba con el micrófono del celular (MediaRecorder). Cada 5 segundos guarda un trozo en el celular
 * (IndexedDB): si la app se cierra de golpe, al volver a abrirla se arma el archivo con lo grabado.
 * Al detener, une los trozos en un archivo con el código de la encuesta y la fecha (p. ej. 817-50-4512_2026-10-17.webm).
 * El audio no viaja a la planilla: se pasa a la computadora del equipo desde «Audios del día».
 */
(function () {
  'use strict';

  var G = { estado: 'inactivo', regId: null, nombreBase: '', tramo: null, n: 0, rec: null, stream: null, mime: '',
    inicio: 0, acumulado: 0, wake: null, alCambiar: null };

  function soportado() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }
  function tipoAudio() {
    var tipos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (var i = 0; i < tipos.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(tipos[i])) return tipos[i];
    return '';
  }
  function extension(mime) { return /mp4/.test(mime) ? 'm4a' : 'webm'; }
  function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }
  function avisar() { if (G.alCambiar) G.alCambiar(G.estado); }

  function segundos() {
    return G.acumulado + (G.estado === 'grabando' ? (Date.now() - G.inicio) / 1000 : 0);
  }
  function reloj(seg) {
    seg = Math.floor(seg || 0);
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    return (h ? h + ':' + pad(m, 2) : pad(m, 2)) + ':' + pad(s, 2);
  }

  function mantenerPantalla() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock.request('screen').then(function (w) { G.wake = w; }).catch(function () {});
  }
  function soltarPantalla() { if (G.wake) { G.wake.release().catch(function () {}); G.wake = null; } }

  function empezarTramo() {
    G.tramo = G.regId + '_' + Date.now();
    G.n = 0;
    var opciones = { audioBitsPerSecond: 32000 };
    if (G.mime) opciones.mimeType = G.mime;
    G.rec = new MediaRecorder(G.stream, opciones);
    G.mime = G.rec.mimeType || G.mime || 'audio/webm';
    var tramo = G.tramo, regId = G.regId, base = G.nombreBase, mime = G.mime;
    G.rec.ondataavailable = function (e) {
      if (!e.data || !e.data.size) return;
      DB.guardarParte({ clave: tramo + '_' + pad(G.n++, 5), tramo: tramo, regId: regId, nombreBase: base, mime: mime, blob: e.data, t: Date.now() })
        .catch(function () {});
    };
    G.rec.start(5000);
    G.inicio = Date.now();
    G.estado = 'grabando';
    mantenerPantalla();
  }

  /* Empieza a grabar la entrevista del relevamiento regId. */
  function iniciar(regId, nombreBase) {
    if (!soportado()) return Promise.reject(new Error('Este celular no permite grabar desde la app'));
    var antes = G.regId && G.regId !== regId && G.estado !== 'inactivo' ? detener() : Promise.resolve(null);
    return antes.then(function () {
      if (G.regId === regId && G.estado !== 'inactivo') return null;
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    }).then(function (stream) {
      if (!stream) return;
      G.stream = stream; G.regId = regId; G.nombreBase = nombreBase; G.mime = tipoAudio(); G.acumulado = 0;
      empezarTramo();
      avisar();
    });
  }

  function pausar() {
    if (G.estado !== 'grabando' || !G.rec) return;
    try { G.rec.pause(); } catch (e) { /* algunos celulares no pausan */ }
    G.acumulado += (Date.now() - G.inicio) / 1000;
    G.estado = 'pausado';
    avisar();
  }
  function reanudar() {
    if (G.estado === 'pausado' && G.rec && G.rec.state === 'paused') {
      G.rec.resume(); G.inicio = Date.now(); G.estado = 'grabando'; mantenerPantalla(); avisar(); return Promise.resolve();
    }
    if (G.estado === 'cortado' || (G.estado === 'pausado' && (!G.rec || G.rec.state === 'inactive'))) {
      // La grabación anterior se cortó: se cierra ese archivo y se empieza otro (…_parte2)
      var regId = G.regId, base = G.nombreBase, acum = G.acumulado;
      return cerrarTramo(G.nombreParaCorte ? G.nombreParaCorte(regId) : base).then(function () {
        return navigator.mediaDevices.getUserMedia({ audio: true });
      }).then(function (stream) {
        G.stream = stream; G.regId = regId; G.nombreBase = base; G.acumulado = acum;
        empezarTramo(); avisar();
      });
    }
    return Promise.resolve();
  }

  function cerrarTramo(base) {
    var tramo = G.tramo, dur = segundos();
    return new Promise(function (ok) {
      var r = G.rec;
      var fin = function () {
        if (G.stream) G.stream.getTracks().forEach(function (t) { t.stop(); });
        G.stream = null; G.rec = null; soltarPantalla();
        // pequeña espera para que el último trozo termine de guardarse
        setTimeout(function () { armar(tramo, dur, base).then(ok, function () { ok(null); }); }, 300);
      };
      if (r && r.state !== 'inactive') { r.onstop = fin; try { r.stop(); } catch (e) { fin(); } }
      else fin();
    });
  }

  /* Detiene y guarda el archivo con el nombre indicado (código_fecha). Devuelve {nombre, segundos, bytes} o null. */
  function detener(base) {
    if (G.estado === 'inactivo') return Promise.resolve(null);
    var dur = segundos();
    return cerrarTramo(base || G.nombreBase).then(function (audio) {
      G.estado = 'inactivo'; G.regId = null; G.tramo = null; G.acumulado = 0;
      avisar();
      if (audio) audio.segundosTotales = dur;
      return audio;
    });
  }

  /* Une los trozos guardados de un tramo en un archivo de audio. */
  function armar(tramo, segundosEstimados, base) {
    return Promise.all([DB.partes(), DB.audios()]).then(function (r) {
      var partes = r[0].filter(function (p) { return p.tramo === tramo; }).sort(function (a, b) { return a.clave < b.clave ? -1 : 1; });
      if (!partes.length) return null;
      var p0 = partes[0], usados = {};
      r[1].forEach(function (a) { usados[a.nombre] = true; });
      var b = base || p0.nombreBase, ext = extension(p0.mime), nombre = b + '.' + ext, k = 2;
      while (usados[nombre]) nombre = b + '_parte' + (k++) + '.' + ext;
      var blob = new Blob(partes.map(function (p) { return p.blob; }), { type: p0.mime });
      var seg = segundosEstimados || Math.round((partes[partes.length - 1].t - p0.t) / 1000 + 5);
      var audio = { nombre: nombre, regId: p0.regId, blob: blob, bytes: blob.size, segundos: Math.round(seg), mime: p0.mime,
        creado: new Date(p0.t).toISOString(), copiado: false };
      return DB.guardarAudio(audio).then(function () {
        return DB.borrarPartes(partes.map(function (p) { return p.clave; }));
      }).then(function () { return { nombre: nombre, regId: p0.regId, segundos: audio.segundos, bytes: audio.bytes }; });
    });
  }

  /* Al abrir la app: si quedaron trozos de una grabación interrumpida (app cerrada de golpe), arma sus archivos. */
  function recuperar(nombrePara) {
    return DB.partes().then(function (partes) {
      var tramos = {};
      partes.forEach(function (p) { if (p.tramo !== G.tramo) tramos[p.tramo] = p.regId; });
      return Object.keys(tramos).reduce(function (c, t) {
        var base = nombrePara ? nombrePara(tramos[t]) : null;
        return c.then(function (lista) { return armar(t, null, base).then(function (a) { if (a) lista.push(a); return lista; }); });
      }, Promise.resolve([]));
    });
  }

  // Si al volver a la app la grabación se cortó (Android la frena al bloquear la pantalla), se avisa.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || G.estado === 'inactivo') return;
    if (G.rec && G.rec.state === 'inactive' && G.estado === 'grabando') { G.estado = 'cortado'; avisar(); }
    else if (G.estado === 'grabando') mantenerPantalla();
  });

  window.Grabacion = {
    soportado: soportado, iniciar: iniciar, pausar: pausar, reanudar: reanudar, detener: detener, recuperar: recuperar,
    segundos: segundos, reloj: reloj,
    estado: function () { return G.estado; }, regId: function () { return G.regId; },
    alCambiar: function (fn) { G.alCambiar = fn; },
    nombrePara: function (fn) { G.nombreParaCorte = fn; }
  };
})();
