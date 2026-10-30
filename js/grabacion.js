/*
 * grabacion.js — Grabación de audio de la entrevista.
 *
 * 1.6: graba en WAV (16 kHz, 16 bits, mono). Es el formato más universal: abre en cualquier reproductor
 * del celular o de la computadora, muestra la duración, deja adelantar, saltar a un minuto y cambiar la
 * velocidad. Pesa unos 115 MB por hora (el WebM de la 1.5 pesaba menos, pero muchas apps no lo podían
 * adelantar ni mostraban cuánto duraba).
 *
 * Cómo funciona: el sonido del micrófono pasa por captura-worklet.js, acá se convierte a 16 kHz y cada
 * 5 segundos se guarda un trozo en el celular (IndexedDB). Si la app se cierra de golpe, al volver a
 * abrirla se arma el archivo con lo que ya estaba guardado. Al detener, se unen los trozos en un
 * archivo con el código de la encuesta y la fecha (p. ej. 817-50-4512_2026-10-29.wav).
 * Si el micrófono se corta (por ejemplo, Android lo frena al salir de la app) la barra roja ofrece
 * «Seguir grabando», que continúa en el MISMO archivo.
 * El audio no viaja a la planilla: se pasa a la computadora del equipo desde «Audios del día».
 */
(function () {
  'use strict';

  var TASA = 16000;            // muestras por segundo del archivo (suficiente para voz y para transcribir)
  var MIME = 'audio/wav';
  var CADA_MS = 5000;          // cada cuánto se guarda un trozo en el celular
  var AC = window.AudioContext || window.webkitAudioContext;

  var G = { estado: 'inactivo', regId: null, nombreBase: '', tramo: null, n: 0, tasa: TASA,
    stream: null, ctx: null, nodo: null, fuente: null, pend: [], pendLen: 0, muestras: 0,
    suma: 0, cnt: 0, pos: 0, limite: 1, ultimoDato: 0, timer: null, wake: null, alCambiar: null, nombreParaCorte: null };

  function soportado() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && AC);
  }
  function extension(mime) { return mime === MIME ? 'wav' : /mp4/.test(mime) ? 'm4a' : 'webm'; }
  function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }
  function avisar() { if (G.alCambiar) G.alCambiar(G.estado); }

  /* Segundos grabados: se cuentan por muestras, así coinciden exactamente con el archivo
     (no suman el tiempo en pausa ni el tiempo en que el celular frenó el micrófono). */
  function segundos() { return G.muestras / (G.tasa || TASA); }
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

  /* Encabezado WAV (44 bytes) para datos PCM de 16 bits mono. */
  function cabeceraWav(bytes, tasa) {
    var b = new ArrayBuffer(44), v = new DataView(b);
    function txt(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    txt(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); txt(8, 'WAVE');
    txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, tasa, true); v.setUint32(28, tasa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    txt(36, 'data'); v.setUint32(40, bytes, true);
    return b;
  }

  /* Pasa un bloque del micrófono (44,1 o 48 kHz, decimales) a 16 kHz en enteros de 16 bits.
     Promedia las muestras que caen en cada punto de salida (filtro simple que evita ruidos al bajar la tasa). */
  function convertir(entrada) {
    var paso = G.ctx.sampleRate / G.tasa, sal = new Int16Array(Math.ceil(entrada.length / paso) + 2), m = 0;
    for (var i = 0; i < entrada.length; i++) {
      G.suma += entrada[i]; G.cnt++; G.pos++;
      if (G.pos >= G.limite) {
        var x = G.suma / G.cnt;
        x = x < -1 ? -1 : x > 1 ? 1 : x;
        sal[m++] = x < 0 ? Math.round(x * 0x8000) : Math.round(x * 0x7FFF);
        G.suma = 0; G.cnt = 0; G.limite += paso;
      }
    }
    return sal.subarray(0, m);
  }

  function alRecibir(bloque) {
    G.ultimoDato = Date.now();
    if (G.estado !== 'grabando' || !G.ctx) return;
    var pcm = convertir(bloque);
    if (!pcm.length) return;
    G.pend.push(pcm); G.pendLen += pcm.length; G.muestras += pcm.length;
  }

  /* Guarda en el celular lo que está acumulado en memoria (un trozo). */
  function volcar() {
    if (!G.pendLen || !G.tramo) return Promise.resolve();
    var junto = new Int16Array(G.pendLen), o = 0;
    G.pend.forEach(function (p) { junto.set(p, o); o += p.length; });
    G.pend = []; G.pendLen = 0;
    var parte = { clave: G.tramo + '_' + pad(G.n++, 5), tramo: G.tramo, regId: G.regId, nombreBase: G.nombreBase,
      mime: MIME, tasa: G.tasa, blob: new Blob([junto.buffer], { type: 'application/octet-stream' }), t: Date.now() };
    return DB.guardarParte(parte).catch(function () {});
  }

  function conectar(stream) {
    G.stream = stream;
    G.ctx = new AC();
    G.tasa = Math.min(TASA, G.ctx.sampleRate);
    G.fuente = G.ctx.createMediaStreamSource(stream);
    stream.getAudioTracks().forEach(function (t) {
      t.onended = function () { if (G.estado === 'grabando' || G.estado === 'pausado') marcarCorte(); };
    });
    var listo;
    if (G.ctx.audioWorklet && window.AudioWorkletNode) {
      listo = G.ctx.audioWorklet.addModule('js/captura-worklet.js').then(function () {
        G.nodo = new AudioWorkletNode(G.ctx, 'captura-pcm', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        G.nodo.port.onmessage = function (e) { alRecibir(e.data); };
      });
    } else {
      listo = Promise.resolve().then(function () {     // celulares viejos sin AudioWorklet
        G.nodo = G.ctx.createScriptProcessor(4096, 1, 1);
        G.nodo.onaudioprocess = function (e) { alRecibir(new Float32Array(e.inputBuffer.getChannelData(0))); };
      });
    }
    return listo.then(function () {
      // La salida va en silencio (no se escucha nada por el parlante); la conexión hace que el audio fluya.
      G.fuente.connect(G.nodo); G.nodo.connect(G.ctx.destination);
      return G.ctx.state === 'suspended' ? G.ctx.resume() : null;
    });
  }

  function desconectar() {
    try { if (G.fuente) G.fuente.disconnect(); if (G.nodo) G.nodo.disconnect(); } catch (e) { /* ya estaba desconectado */ }
    if (G.nodo && G.nodo.port) G.nodo.port.onmessage = null;
    if (G.stream) G.stream.getTracks().forEach(function (t) { t.onended = null; try { t.stop(); } catch (e) { /* nada */ } });
    var c = G.ctx;
    G.ctx = null; G.nodo = null; G.fuente = null; G.stream = null;
    soltarPantalla();
    return c && c.state !== 'closed' ? c.close().catch(function () {}) : Promise.resolve();
  }

  function pedirMicrofono() {
    return navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
  }

  /* mismoTramo: true cuando se sigue después de un corte (continúa el mismo archivo). */
  function empezar(stream, mismoTramo) {
    return conectar(stream).then(function () {
      if (!mismoTramo) { G.tramo = G.regId + '_' + Date.now(); G.n = 0; }
      G.suma = 0; G.cnt = 0; G.pos = 0; G.limite = G.ctx.sampleRate / G.tasa;
      G.ultimoDato = Date.now(); G.estado = 'grabando';
      clearInterval(G.timer); G.timer = setInterval(vigilar, CADA_MS);
      mantenerPantalla(); avisar();
    });
  }

  /* Cada 5 s: guarda el trozo y revisa que el micrófono siga mandando sonido. */
  function vigilar() {
    volcar();
    if (G.estado !== 'grabando' || document.visibilityState !== 'visible' || !G.ctx) return;
    if (G.ctx.state === 'suspended') { G.ctx.resume().catch(function () {}); return; }
    var terminado = G.stream && G.stream.getAudioTracks().some(function (t) { return t.readyState === 'ended'; });
    if (terminado || Date.now() - G.ultimoDato > 15000) marcarCorte();
  }

  function marcarCorte() {
    if (G.estado === 'inactivo' || G.estado === 'cortado') return;
    volcar();
    clearInterval(G.timer); G.timer = null;
    desconectar();
    G.estado = 'cortado';
    avisar();
  }

  /* Empieza a grabar la entrevista del relevamiento regId (archivo nuevo). */
  function iniciar(regId, nombreBase) {
    if (!soportado()) return Promise.reject(new Error('Este celular no permite grabar desde la app'));
    var antes = G.regId && G.regId !== regId && G.estado !== 'inactivo' ? detener() : Promise.resolve(null);
    return antes.then(function () {
      if (G.regId === regId && G.estado !== 'inactivo') return null;
      return pedirMicrofono();
    }).then(function (stream) {
      if (!stream) return;
      G.regId = regId; G.nombreBase = nombreBase; G.muestras = 0; G.pend = []; G.pendLen = 0;
      return empezar(stream, false);
    });
  }

  function pausar() {
    if (G.estado !== 'grabando') return;
    volcar();
    G.estado = 'pausado';
    avisar();
  }

  function reanudar() {
    if (G.estado === 'pausado' && G.ctx) {
      G.estado = 'grabando'; G.ultimoDato = Date.now();
      if (G.ctx.state === 'suspended') G.ctx.resume().catch(function () {});
      mantenerPantalla(); avisar();
      return Promise.resolve();
    }
    if (G.estado === 'cortado' || (G.estado === 'pausado' && !G.ctx)) {
      // El micrófono se había cortado: se vuelve a pedir y se sigue en el mismo archivo
      return pedirMicrofono().then(function (stream) { return empezar(stream, true); });
    }
    return Promise.resolve();
  }

  /* Detiene y guarda el archivo con el nombre indicado (código_fecha). Devuelve {nombre, segundos, bytes} o null. */
  function detener(base) {
    if (G.estado === 'inactivo') return Promise.resolve(null);
    var tramo = G.tramo;
    clearInterval(G.timer); G.timer = null;
    return volcar().then(desconectar).then(function () {
      // pequeña espera para que el último trozo termine de guardarse
      return new Promise(function (ok) { setTimeout(ok, 200); });
    }).then(function () {
      return armar(tramo, base || G.nombreBase).catch(function () { return null; });
    }).then(function (audio) {
      G.estado = 'inactivo'; G.regId = null; G.tramo = null; G.muestras = 0;
      avisar();
      if (audio) audio.segundosTotales = audio.segundos;
      return audio;
    });
  }

  /* Une los trozos guardados de un tramo en un archivo de audio. */
  function armar(tramo, base) {
    return Promise.all([DB.partes(), DB.audios()]).then(function (r) {
      var partes = r[0].filter(function (p) { return p.tramo === tramo; }).sort(function (a, b) { return a.clave < b.clave ? -1 : 1; });
      if (!partes.length) return null;
      var p0 = partes[0], usados = {};
      r[1].forEach(function (a) { usados[a.nombre] = true; });
      var b = base || p0.nombreBase, ext = extension(p0.mime), nombre = b + '.' + ext, k = 2;
      while (usados[nombre]) nombre = b + '_parte' + (k++) + '.' + ext;
      var datos = partes.map(function (p) { return p.blob; }), blob, seg;
      if (p0.mime === MIME) {
        var bytes = datos.reduce(function (s, x) { return s + x.size; }, 0), tasa = p0.tasa || TASA;
        blob = new Blob([cabeceraWav(bytes, tasa)].concat(datos), { type: MIME });
        seg = bytes / (2 * tasa);
      } else {
        // Trozos de la versión 1.5 (WebM) que hayan quedado sin armar
        blob = new Blob(datos, { type: p0.mime });
        seg = (partes[partes.length - 1].t - p0.t) / 1000 + 5;
      }
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
        return c.then(function (lista) { return armar(t, base).then(function (a) { if (a) lista.push(a); return lista; }); });
      }, Promise.resolve([]));
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (G.estado === 'inactivo') return;
    if (document.visibilityState === 'hidden') { volcar(); return; }   // por si Android cierra la app mientras no se ve
    if (G.estado !== 'grabando') return;
    if (G.ctx && G.ctx.state === 'suspended') G.ctx.resume().catch(function () {});
    var terminado = G.stream && G.stream.getAudioTracks().some(function (t) { return t.readyState === 'ended'; });
    if (terminado || !G.ctx) marcarCorte(); else mantenerPantalla();
  });
  window.addEventListener('pagehide', function () { if (G.estado !== 'inactivo') volcar(); });

  window.Grabacion = {
    soportado: soportado, iniciar: iniciar, pausar: pausar, reanudar: reanudar, detener: detener, recuperar: recuperar,
    segundos: segundos, reloj: reloj, formato: 'WAV',
    estado: function () { return G.estado; }, regId: function () { return G.regId; },
    alCambiar: function (fn) { G.alCambiar = fn; },
    nombrePara: function (fn) { G.nombreParaCorte = fn; }
  };
})();
