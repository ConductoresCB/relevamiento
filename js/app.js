/*
 * app.js — Pantallas y navegación de la app de campo.
 * Rutas: #/jornada · #/participante/<id> · #/socio/<id>/<1-7> · #/bio/<id>/<1-3>
 *        #/resultados/<id> · #/cierre · #/ajustes · #/importar
 */
(function () {
  'use strict';

  var I = window.Instrumento, R = window.Registro, C = window.Calculos, S = window.Sync;
  var SECC = I.CUESTIONARIO.secciones;
  var raizApp = document.getElementById('app');

  /* Textos y parámetros editables: vienen de config.js (si falta algo, se usan estos valores). */
  var CFG = window.CONFIG || {};
  var T = Object.assign({
    jornada: 'Jornada del', conSenal: 'Con señal', sinSenal: 'Sin señal', relevadosHoy: 'Relevados hoy',
    sinSincronizar: 'Sin sincronizar', nuevoRelevamiento: 'Nuevo relevamiento', buscar: 'Buscar por código o celular',
    relevamientosHoy: 'Relevamientos de hoy', cerrarJornada: 'Cerrar jornada y sincronizar', nuevoParticipante: 'Nuevo participante',
    identificacion: 'Identificación', codigoIdentificacion: 'Código de identificación', datosContacto: 'Datos de contacto',
    consentimiento: 'Leyó y aceptó el consentimiento informado.', comparteApp: 'Acepta que sus resultados se vean en la app de camioneros.',
    continuarSocio: 'Continuar con sociodemográfica', irDirectoBio: 'Ir directo a la biológica', cejaSocio: 'Paso 2 · Sociodemográfica',
    irABio: 'Ir a biológica', cejaBio: 'Paso 3 · Biológica', verResultados: 'Ver resultados', cejaResultados: 'Paso 4 · Cierre',
    resultados: 'Resultados', guardarYVolver: 'Guardar y volver a la jornada', cierreJornada: 'Cierre de jornada',
    sincronizarAhora: 'Sincronizar ahora', compartirPaquete: 'Compartir paquete del día', descargarCsv: 'Descargar CSV para Excel',
    criterioDerivacion: 'Criterio de derivación: [a definir por el equipo]',
    responsable: 'la administradora', seccionAdministracion: 'Administración y respaldo', cejaImportar: 'Administración',
    encuestadoresEntrevista: 'Encuestador/es de esta entrevista',
    ayudaEncuestadores: 'Si son varios, escribí los nombres separados por «y».',
    avisoSinCifrar: 'Estos archivos NO están cifrados: guardalos solo en la computadora de análisis. No los mandes por WhatsApp ni los subas a una carpeta compartida.'
  }, CFG.textos || {});
  function mayuscula(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  var PROYECTO = Object.assign({ nombre: 'Relevamiento', lugar: 'Corredor Bioceánico · Jujuy' }, CFG.proyecto || {});
  var PASOS = CFG.pasos || ['Identificación', 'Socio', 'Biológica', 'Resultados'];
  var RANGOS = Object.assign({ edad: [18, 99], peso: [35, 250], altura: [1.2, 2.2], perimetro: [50, 200], pas: [70, 260], pad: [40, 150], glucemia: [20, 600] }, CFG.rangos || {});
  var RECOMENDACION = Object.assign({ Bajo: 'Mantener hábitos saludables.', Moderado: 'Evaluar si necesita tratamiento preventivo.',
    Alto: 'Se recomiendan intervenciones médicas.' }, CFG.recomendacionFramingham || {});
  var VERSION_APP = CFG.versionApp || '1.1.0';

  var AJUSTES_BASE = Object.assign({ equipo: 'A', dispositivo: '1', ordenDesde: 1, ordenHasta: 199 }, CFG.ajustesIniciales || {},
    { encuestador: '', puesto: '', url: '', clave: '', ultimaSync: '', ultimoPaquete: '', ultimaHuella: '' });

  var estado = { ajustes: null, registros: [], actual: null, ruta: { vista: 'jornada' }, buscar: '', verTodos: false,
    instalar: null, sincronizando: false, mensajeSync: '', mensajeConexion: '', importacion: [],
    online: navigator.onLine, persistente: null, bitacora: [], audios: [], profAbierto: {}, pendAbierto: {}, tildadoFinal: {} };
  var Gr = window.Grabacion;
  var ENT = I.ENTREVISTA || [];
  var esPrueba = !!CFG.esPrueba;

  /* Definiciones indexadas por id (para detalles y opciones exclusivas) */
  var DEF = {};
  SECC.forEach(function (s) {
    s.preguntas.forEach(function (p) {
      if (p.tipo === 'grupo') p.campos.forEach(function (c) { DEF[c.id] = c; });
      else DEF[p.id] = p;
    });
  });
  var BIO = {};
  I.BIO.forEach(function (b) { BIO[b.id] = b; });

  /* ---------- utilidades ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function horaAhora() { var d = new Date(); return dos(d.getHours()) + ':' + dos(d.getMinutes()); }
  function ahoraISO() { return new Date().toISOString(); }
  function fechaCorta(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return esc(p[2] + '/' + p[1]); }
  function horaDe(iso) { if (!iso) return ''; var d = new Date(iso); return dos(d.getHours()) + ':' + dos(d.getMinutes()); }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function num(v) { return C.numero(v); }
  function fmt(v, dec) { return v == null ? '—' : String(dec != null ? v.toFixed(dec) : v).replace('.', ','); }

  var ICONOS = {
    volver: '<path d="M15 18l-6-6 6-6"/>', seguir: '<path d="M9 18l6-6-6-6"/>', mas: '<path d="M12 5v14M5 12h14"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sinSenal: '<path d="M12 20h.01"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.7"/><path d="M19 12.9a10 10 0 0 0-2-1.5"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M22 8.8a15 15 0 0 0-11.3-3.8"/><path d="M2 2l20 20"/>',
    senal: '<path d="M12 20h.01"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 14 0"/><path d="M2 8.8a15 15 0 0 1 20 0"/>',
    check: '<path d="M20 6L9 17l-5-5"/>', alerta: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    nube: '<path d="M12 13v8M8 17l4-4 4 4"/><path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/>',
    bajar: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', subir: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    celu: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', igual: '<path d="M5 9h14M5 15h14"/>',
    ajustes: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    compartir: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'
  };
  function ico(nombre, tam) {
    var t = tam ? ' style="width:' + tam + 'px;height:' + tam + 'px"' : '';
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"' + t + '>' + ICONOS[nombre] + '</svg>';
  }

  function toast(texto) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  /* ---------- almacenamiento ---------- */
  var reloj = null;
  function tocar() {
    if (!estado.actual) return;
    estado.actual.modificado = ahoraISO();
    clearTimeout(reloj);
    reloj = setTimeout(guardarActual, 250);
  }
  function guardarActual() {
    clearTimeout(reloj);
    var r = estado.actual;
    if (!r || !r.modificado) return Promise.resolve();
    return DB.guardar(r).then(function () {
      var i = estado.registros.findIndex(function (x) { return x.id === r.id; });
      if (i >= 0) estado.registros[i] = r; else estado.registros.push(r);
    });
  }
  var relojAj = null;
  function guardarAjustes() {
    clearTimeout(relojAj);
    return new Promise(function (ok) {
      relojAj = setTimeout(function () { DB.guardarAjuste('ajustes', estado.ajustes).then(ok); }, 200);
    });
  }

  /* ---------- registro de operaciones ----------
     Guarda en el dispositivo qué se hizo y cuándo (iniciar, finalizar, enviar, paquetes, importar, borrar),
     sin respuestas, contactos ni claves: solo el ID interno, cantidades, nombres de archivo y huellas. */
  var MAX_BITACORA = 300;
  function anotar(evento, detalle) {
    estado.bitacora.push({ t: ahoraISO(), ev: evento, det: detalle || '' });
    if (estado.bitacora.length > MAX_BITACORA) estado.bitacora = estado.bitacora.slice(-MAX_BITACORA);
    return DB.guardarAjuste('bitacora', estado.bitacora).catch(function () {});
  }
  function pendientes() { return estado.registros.filter(function (r) { return r.consentimiento && R.pendiente(r); }); }

  function asignar(ruta, valor) {
    var partes = ruta.split('.'), grupo = partes[0], clave = partes[1], obj;
    if (grupo === 'aj') { estado.ajustes[clave] = valor; guardarAjustes(); return; }
    var reg = estado.actual;
    if (!reg) return;
    if (grupo === 'reg') obj = reg;
    else { reg[grupo] = reg[grupo] || {}; obj = reg[grupo]; }
    var vacio = valor === '' || valor === null || valor === undefined || (Array.isArray(valor) && valor.length === 0);
    if (typeof valor === 'boolean') obj[clave] = valor;
    else if (vacio) delete obj[clave];
    else obj[clave] = valor;
    if (grupo === 'consent' && clave === 'participa') reg.consentimiento = valor === 'Sí';
    if (grupo === 'reg' && (clave === 'orden' || clave === 'edad' || clave === 'cp')) {
      reg.codigo = R.codigo(reg.orden, reg.edad, reg.cp);
      // El ID interno sale del N° de orden: si se corrige el orden, se corrige el ID.
      if (clave === 'orden' && reg.pid_origen === 'orden') reg.participante_id = R.idParticipante(reg.equipo, reg.dispositivo, reg.orden);
    }
    tocar();
  }
  function valor(ruta) {
    var p = ruta.split('.');
    if (p[0] === 'aj') return estado.ajustes[p[1]];
    var r = estado.actual || {};
    var o = p[0] === 'reg' ? r : (r[p[0]] || {});
    return o[p[1]];
  }

  /* ---------- navegación ---------- */
  function ruta() {
    var p = location.hash.replace(/^#\/?/, '').split('/');
    return { vista: p[0] || 'jornada', id: p[1], n: p[2] ? Number(p[2]) : 1 };
  }
  function ir(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  function alCambiarRuta() {
    var r = ruta();
    return guardarActual().then(function () {
      estado.ruta = r;
      var conId = ['consentimiento', 'participante', 'socio', 'bio', 'final', 'resultados'].indexOf(r.vista) >= 0;
      if (!conId) { estado.actual = null; render(true); return; }
      if (estado.actual && estado.actual.id === r.id) { marcarParte(); render(true); return; }
      var enMemoria = estado.registros.find(function (x) { return x.id === r.id; });
      if (enMemoria) { estado.actual = enMemoria; marcarParte(); render(true); return; }
      return DB.obtener(r.id).then(function (reg) {
        if (!reg) { ir('#/jornada'); return; }
        estado.actual = reg; marcarParte(); render(true);
      });
    });
  }

  /* ---------- render ---------- */
  function claveFoco() {
    var a = document.activeElement;
    if (!a || !raizApp.contains(a)) return null;
    if (a.id) return '#' + CSS.escape(a.id);
    if (a.dataset.accion) {
      var sel = '[data-accion="' + a.dataset.accion + '"]';
      if (a.dataset.campo) sel += '[data-campo="' + a.dataset.campo + '"]';
      if (a.dataset.valor) sel += '[data-valor="' + CSS.escape(a.dataset.valor) + '"]';
      return sel;
    }
    return null;
  }

  function render(nuevaPantalla) {
    var foco = nuevaPantalla ? null : claveFoco();
    var v = estado.ruta.vista, html;
    if (v === 'consentimiento') html = vConsentimiento();
    else if (v === 'final') html = vFinal();
    else if (v === 'audios') html = vAudios();
    else if (v === 'participante') html = vParticipante();
    else if (v === 'socio') html = vSocio();
    else if (v === 'bio') html = vBio();
    else if (v === 'resultados') html = vResultados();
    else if (v === 'cierre') html = vCierre();
    else if (v === 'ajustes') html = vAjustes();
    else if (v === 'importar') html = vImportar();
    else html = vJornada();
    raizApp.innerHTML = html;
    document.title = (document.querySelector('h1') ? document.querySelector('h1').textContent + ' · ' : '') + PROYECTO.nombre;
    if (nuevaPantalla) { window.scrollTo(0, 0); var h = raizApp.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    else if (foco) { var el = raizApp.querySelector(foco); if (el) el.focus({ preventScroll: true }); }
  }

  var REGIONES = {};
  function region(nombre, html) { return '<div data-region="' + nombre + '" style="display:contents">' + html + '</div>'; }
  function refrescar() {
    raizApp.querySelectorAll('[data-region]').forEach(function (el) {
      var fn = REGIONES[el.dataset.region];
      if (fn) el.innerHTML = fn();
    });
  }

  /* ---------- piezas comunes ---------- */
  function barra(volver, ceja, titulo, derecha) {
    return '<div class="barra">' +
      (volver ? '<a class="icono-btn" href="' + volver + '" aria-label="Volver">' + ico('volver', 22) + '</a>' : '') +
      '<div class="bloque-titulo"><span class="ceja">' + esc(ceja) + '</span><h1 class="titulo">' + esc(titulo) + '</h1></div>' +
      (derecha || '') + '</div>';
  }
  function placaChica(reg) { return reg && reg.codigo ? '<span class="placa-chica">' + esc(reg.codigo) + '</span>' : ''; }

  function pasosRelevamiento(reg, actual) {
    var as = R.avanceSocio(reg), ab = R.avanceBio(reg);
    var pasos = [
      { t: esc(PASOS[0]), h: '#/participante/' + reg.id, hecho: !!(reg.codigo && reg.consentimiento) },
      { t: esc(PASOS[1]), h: '#/socio/' + reg.id + '/1', hecho: as.completo },
      { t: esc(PASOS[2]), h: '#/bio/' + reg.id + '/1', hecho: ab.completo },
      { t: esc(PASOS[3]), h: '#/resultados/' + reg.id, hecho: reg.estado === 'finalizado' }
    ];
    return '<nav class="pasos" aria-label="Etapas" style="grid-template-columns:repeat(4,minmax(0,1fr))">' + pasos.map(function (p, i) {
      var cls = i === actual ? 'actual' : p.hecho ? 'hecho' : '';
      return '<a class="paso ' + cls + '" href="' + p.h + '" style="text-decoration:none"' + (i === actual ? ' aria-current="step"' : '') +
        '><span class="barrita"></span>' + p.t + '</a>';
    }).join('') + '</nav>';
  }

  function botonOpcion(ruta, val, seleccionado, multiple, conMarca) {
    var marca = '';
    if (conMarca) marca = multiple ? '<span class="marca cuadrada">' + '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none"><path d="M20 6L9 17l-5-5"/></svg></span>' : '<span class="marca"></span>';
    return '<button type="button" class="opcion" aria-pressed="' + (seleccionado ? 'true' : 'false') + '" data-accion="opcion" data-campo="' +
      ruta + '" data-valor="' + esc(val) + '"' + (multiple ? ' data-multiple="1"' : '') + '>' + marca + esc(val) + '</button>';
  }

  function grupoOpciones(ruta, opciones, actual, multiple, disposicion) {
    var sel = Array.isArray(actual) ? actual : (actual ? [actual] : []);
    var clase = 'opciones';
    var conMarca = true;
    if (disposicion === 'linea' || disposicion === 'grilla') {
      conMarca = false;
      // Botones grandes y del mismo ancho: «Ninguna…» ocupa toda la fila; opciones cortas en 3 columnas, largas en 2
      var primeraSola = /^Ninguna/.test(opciones[0]) && opciones.length > 3;
      var resto = primeraSola ? opciones.slice(1) : opciones;
      var largo = Math.max.apply(null, resto.map(function (o) { return String(o).length; }));
      var cols = resto.length === 2 || resto.length === 4 || largo > 10 ? 2 : 3;
      clase += ' grilla-' + cols + (primeraSola ? ' primera-sola' : '') + (!primeraSola && cols === 2 && resto.length % 2 ? ' ultima-sola' : '');
    }
    return '<div class="' + clase + '">' + opciones.map(function (o) {
      return botonOpcion(ruta, o, sel.indexOf(o) >= 0, multiple, conMarca);
    }).join('') + '</div>';
  }

  function campoTexto(ruta, etiqueta, val, extra) {
    var id = ruta.replace('.', '-');
    extra = extra || {};
    var control = extra.area
      ? '<textarea class="entrada" id="' + id + '" data-campo="' + ruta + '" rows="3" spellcheck="false">' + esc(val) + '</textarea>'
      : '<input class="entrada' + (extra.mono ? ' mono' : '') + '" id="' + id + '" type="' + (extra.tipo || 'text') + '" data-campo="' + ruta + '" value="' + esc(val) + '" spellcheck="false"' +
        (extra.placeholder ? ' placeholder="' + esc(extra.placeholder) + '"' : '') + (extra.autocomplete ? ' autocomplete="' + extra.autocomplete + '"' : ' autocomplete="off"') +
        (extra.inputmode ? ' inputmode="' + extra.inputmode + '"' : '') + (extra.refrescar ? ' data-refrescar="1"' : '') + '>';
    return '<div class="campo"><label for="' + id + '"' + (extra.ocultarRotulo ? ' class="oculto-visual"' : '') + '>' + esc(etiqueta) + '</label>' + control +
      (extra.ayuda ? '<span class="ayuda">' + esc(extra.ayuda) + '</span>' : '') + '</div>';
  }

  function mensajeRango(v, min, max) {
    var n = num(v);
    if (v === undefined || v === null || v === '') return '';
    if (n === null) return 'Ingresá un número';
    if ((min != null && n < min) || (max != null && n > max)) return 'Fuera de rango (' + fmt(min) + '–' + fmt(max) + ')';
    return '';
  }

  function campoNumero(ruta, etiqueta, val, cfg) {
    var id = ruta.replace('.', '-');
    var error = mensajeRango(val, cfg.min, cfg.max);
    var ayuda = error || cfg.ayuda || '';
    return '<div class="campo"><label for="' + id + '"' + (cfg.ocultarRotulo ? ' class="oculto-visual"' : '') + '>' + esc(etiqueta) + '</label>' +
      '<div class="con-unidad' + (error ? ' invalido' : '') + '"><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" data-campo="' + ruta +
      '" data-min="' + (cfg.min != null ? cfg.min : '') + '" data-max="' + (cfg.max != null ? cfg.max : '') + '" data-ayuda="' + esc(cfg.ayuda || '') +
      '" data-refrescar="1" value="' + esc(val) + '" aria-describedby="' + id + '-ayuda">' +
      (cfg.unidad ? '<span class="unidad">' + esc(cfg.unidad) + '</span>' : '') + '</div>' +
      '<span class="ayuda' + (error ? ' error' : '') + '" id="' + id + '-ayuda">' + esc(ayuda) + '</span></div>';
  }

  /* ---------- Jornada ---------- */
  function estadoRegistro(r) {
    if (r.estado !== 'finalizado') return '<span class="estado inc">' + ico('alerta', 16) + 'En curso</span>';
    if (!r.consentimiento) return '<span class="estado inc">' + ico('alerta', 16) + 'Sin consentimiento</span>';
    if (R.pendiente(r)) return '<span class="estado pend"><span class="punto-pendiente"></span>Por sincronizar</span>';
    return '<span class="estado sinc">' + ico('check', 16) + 'Sincronizado</span>';
  }
  function pildoras(r) {
    var as = R.avanceSocio(r), ab = R.avanceBio(r);
    var p = '<span class="pildora' + (as.completo ? ' hecha' : '') + '">Socio' + (as.iniciado && !as.completo ? ' ' + as.respondidas + '/' + as.total : '') + '</span>';
    p += '<span class="pildora' + (ab.completo ? ' hecha' : '') + '">Bio</span>';
    if (ab.glucemiaRechazada) p += '<span class="pildora rechazada">Sin glucemia</span>';
    else p += '<span class="pildora' + (ab.glucemia ? ' hecha' : '') + '">Glucemia</span>';
    if (r.audio && r.audio.archivos && r.audio.archivos.length) p += '<span class="pildora hecha">Audio</span>';
    return '<div class="pildoras">' + p + '</div>';
  }

  function vJornada() {
    var aj = estado.ajustes, f = hoy();
    var deHoy = estado.registros.filter(function (r) { return r.fecha === f; });
    var pend = pendientes();
    var falta = !aj.encuestador || !aj.url || !aj.clave;
    var html = '<main class="pantalla">' +
      '<div class="cabecera"><div style="display:flex;flex-direction:column;gap:2px"><span class="ceja">' + esc(PROYECTO.lugar) + '</span>' +
      '<h1 class="titulo grande">' + esc(T.jornada) + ' ' + fechaCorta(f) + '</h1>' + (esPrueba ? '<span class="etiqueta-prueba">Versión de prueba</span>' : '') + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      (estado.online ? '<span class="chip-red con">' + ico('senal', 18) + esc(T.conSenal) + '</span>' : '<span class="chip-red sin">' + ico('sinSenal', 18) + esc(T.sinSenal) + '</span>') +
      '<a class="icono-btn" href="#/ajustes" aria-label="Ajustes del dispositivo">' + ico('ajustes', 20) + '</a></div></div>' +
      '<div class="linea-dispositivo">' + ico('celu', 18) + '<span>Equipo ' + esc(aj.equipo) + ' · Dispositivo ' + esc(aj.dispositivo) +
      ' · códigos ' + R.pad(aj.ordenDesde, 3) + '–' + R.pad(aj.ordenHasta, 3) + (aj.puesto ? ' · ' + esc(aj.puesto) : '') + (aj.encuestador ? ' · ' + esc(aj.encuestador) : '') + '</span></div>' +
      (errorRango(aj) ? '<a class="error-linea" href="#/ajustes">' + ico('alerta', 18) + 'Revisá el rango de orden en Ajustes: ' + esc(errorRango(aj)) + '</a>' : '');

    if (falta) {
      html += '<div class="tarjeta aviso"><p><b>Falta configurar este dispositivo.</b> Cargá encuestador/a, equipo, la dirección de la planilla y la clave del equipo para poder enviar y generar paquetes.</p>' +
        '<a class="btn chico" href="#/ajustes">Ir a Ajustes</a></div>';
    }
    if (estado.instalar) {
      html += '<button type="button" class="btn azul-claro" data-accion="instalar">' + ico('bajar', 20) + 'Instalar la app en este dispositivo</button>';
    }

    html += '<div class="tarjeta"><div class="cifras">' +
      '<div class="cifra"><span class="rotulo">' + esc(T.relevadosHoy) + '</span><span class="numero">' + deHoy.length + '</span></div>' +
      '<div class="cifra"><span class="rotulo">' + esc(T.sinSincronizar) + '</span><span class="numero">' + pend.length + (pend.length ? '<span class="punto-pendiente"></span>' : '') + '</span></div>' +
      '<div class="ok-linea separador" style="grid-column:1/-1">' + ico('check', 18) + 'Guardado en este dispositivo' +
      (aj.ultimaSync ? ' · última sincronización ' + fechaCorta(aj.ultimaSync) + ' ' + horaDe(aj.ultimaSync) : '') + '</div></div></div>' +
      '<button type="button" class="btn primario" data-accion="nuevo">' + ico('mas', 22) + esc(T.nuevoRelevamiento) + '</button>' +
      '<div class="campo"><label for="buscar" class="oculto-visual">Buscar participante ya relevado</label>' +
      '<div class="con-unidad" style="border-color:var(--tinta)">' + ico('buscar', 20) +
      '<input id="buscar" type="search" data-buscar="1" spellcheck="false" autocomplete="off" placeholder="' + esc(T.buscar) + '" value="' + esc(estado.buscar) + '" style="font-family:var(--f-texto);font-size:16px"></div></div>' +
      region('lista', listaRegistros()) +
      '<a class="btn azul-claro empujar-abajo" href="#/cierre">' + ico('nube', 22) + esc(T.cerrarJornada) + '</a></main>';
    return html;
  }

  REGIONES.lista = listaRegistros;
  function listaRegistros() {
    var f = hoy(), q = estado.buscar.trim();
    var lista = estado.registros.slice();
    if (q) {
      lista = lista.filter(function (r) { return coincideRegistro(r, q); });
    } else if (!estado.verTodos) {
      lista = lista.filter(function (r) { return r.fecha === f; });
    }
    lista.sort(function (a, b) { return (b.creado || '').localeCompare(a.creado || ''); });
    var titulo = q ? 'Resultados de la búsqueda' : estado.verTodos ? 'Todos los relevamientos' : T.relevamientosHoy;
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="ceja azul">' + titulo + '</span>' +
      (q ? '' : '<button type="button" class="btn chico" data-accion="ver-todos" style="border:0;background:none;color:var(--azul);padding:0 4px">' + (estado.verTodos ? 'Solo hoy' : 'Ver todos (' + estado.registros.length + ')') + '</button>') + '</div>';
    if (!lista.length) return html + '<div class="vacio">' + (q ? 'No hay coincidencias en este dispositivo.' : 'Todavía no hay relevamientos. Tocá «Nuevo relevamiento» para empezar.') + '</div>';
    return html + '<div class="lista">' + lista.slice(0, 60).map(function (r) {
      return '<a class="registro" href="#/participante/' + esc(r.id) + '" style="text-decoration:none;color:inherit">' +
        '<span class="arriba"><span class="cod">' + esc(r.codigo || 'Sin código') + '</span><span class="hora">' +
        (r.fecha === f ? esc(r.hora_inicio || '') : fechaCorta(r.fecha)) + '</span></span>' +
        '<span class="abajo">' + pildoras(r) + estadoRegistro(r) + '</span></a>';
    }).join('') + '</div>';
  }

  /* ---------- Participante ---------- */
  /* El N° de orden es la primera parte del código (3 cifras): el rango de cada dispositivo tiene que caber en 1–999. */
  function errorRango(aj) {
    var d = num(aj.ordenDesde), h = num(aj.ordenHasta);
    if (d === null || h === null) return 'Completá «Orden desde» y «Orden hasta».';
    if (d < 1 || h > 999 || d % 1 || h % 1) return 'El N° de orden tiene 3 cifras: el rango tiene que estar entre 1 y 999 (por ejemplo, de 200 a 399).';
    if (d > h) return '«Orden desde» tiene que ser menor que «Orden hasta».';
    return '';
  }
  REGIONES.rango = function () {
    var e = errorRango(estado.ajustes);
    return e ? '<span class="error-linea">' + ico('alerta', 18) + esc(e) + '</span>' : '';
  };

  function siguienteOrden() {
    var aj = estado.ajustes;
    if (errorRango(aj)) return '';   // con el rango mal cargado no se sugiere nada: se escribe a mano o se corrige en Ajustes
    var d = Number(aj.ordenDesde), h = Number(aj.ordenHasta);
    var usados = estado.registros.filter(function (r) {
      return r.equipo === aj.equipo && String(r.dispositivo) === String(aj.dispositivo);
    }).map(function (r) { return Number(r.orden); }).filter(function (n) { return n >= d && n <= h; });
    return usados.length ? Math.min(h, Math.max.apply(null, usados) + 1) : d;
  }

  /* El N° de orden no se repite en un mismo dispositivo: de él salen el código y el ID interno. */
  function ordenRepetido(r) {
    var o = num(r.orden);
    if (o === null) return null;
    return estado.registros.find(function (x) {
      return x.id !== r.id && x.equipo === r.equipo && String(x.dispositivo) === String(r.dispositivo) && num(x.orden) === o;
    }) || null;
  }

  function erroresIdentificacion(r) {
    var e = [];
    var o = num(r.orden), ed = num(r.edad), rep = ordenRepetido(r);
    if (o === null) e.push('Falta el N° de orden.');
    else if (o < 1 || o > 999 || o % 1) e.push('El N° de orden tiene 3 cifras (de 1 a 999). Si el rango de Ajustes empieza en 1000 o más, corregilo ahí.');
    if (rep) e.push('El N° de orden ' + o + ' ya se usó en este dispositivo (código ' + (rep.codigo || 'sin completar') + ').');
    if (ed === null || ed < RANGOS.edad[0] || ed > RANGOS.edad[1] || ed % 1) e.push('La edad debe ser un número entero entre ' + RANGOS.edad[0] + ' y ' + RANGOS.edad[1] + '.');
    if (!/^\d{4}$/.test(String(r.cp || ''))) e.push('El código postal debe tener 4 dígitos.');
    if (r.codigo && estado.registros.some(function (x) { return x.id !== r.id && x.codigo === r.codigo; })) e.push('Ese código ya existe en este dispositivo.');
    if (!r.consentimiento) e.push('Falta registrar el consentimiento informado.');
    return e;
  }

  REGIONES.codigo = function () {
    var r = estado.actual; if (!r) return '';
    var rep = ordenRepetido(r), o = num(r.orden), fuera = o !== null && (o < 1 || o > 999 || o % 1);
    return '<div class="placa"><span class="valor">' + esc(r.codigo || '___-__-____') + '</span><span class="partes">orden · edad · código postal</span></div>' +
      (fuera ? '<span class="error-linea">' + ico('alerta', 18) + 'El N° de orden tiene 3 cifras: va de 1 a 999</span>'
        : rep ? '<span class="error-linea">' + ico('alerta', 18) + 'Ese N° de orden ya se usó en este dispositivo (código ' + esc(rep.codigo || 'sin completar') + ')</span>'
        : r.codigo ? '<span class="ok-linea">' + ico('check', 18) + 'Código libre en este dispositivo</span>' : '<span class="ayuda">Completá orden, edad y código postal.</span>');
  };

  /* Búsqueda en este dispositivo: partes del código (con o sin guiones) o últimos números del celular. */
  function coincideRegistro(x, q) {
    var qd = q.replace(/\D/g, '');
    if (qd.length < 2) return false;
    var codDig = (x.codigo || '').replace(/\D/g, '');
    var cel = ((x.contacto && x.contacto.celular) || '').replace(/\D/g, '');
    if (codDig.indexOf(qd) >= 0) return true;                            // partes del código: 4600, 44-4600, 811
    if (qd.length >= 4 && cel.slice(-qd.length) === qd) return true;     // últimos números del celular
    return false;
  }

  function vParticipante() {
    var r = estado.actual, aj = estado.ajustes;
    var nuevo = !r.codigo && !r.modificado;
    var html = '<main class="pantalla">' + region('grab', barraGrabacion()) + barra('#/consentimiento/' + esc(r.id), 'Paso 1 de 4', nuevo ? T.nuevoParticipante : T.identificacion) +
      pasosRelevamiento(r, 0) +
      '<section style="display:flex;flex-direction:column;gap:8px"><h2 class="seccion">' + esc(T.codigoIdentificacion) + '</h2>' +
      '<div class="grilla-campos tres">' +
      '<div class="campo"><label for="reg-orden">N° de orden</label><input class="entrada mono centro" id="reg-orden" inputmode="numeric" autocomplete="off" data-campo="reg.orden" data-refrescar="1" value="' + esc(r.orden) + '"></div>' +
      '<div class="campo"><label for="reg-edad">Edad</label><input class="entrada mono centro" id="reg-edad" inputmode="numeric" autocomplete="off" maxlength="2" data-campo="reg.edad" data-refrescar="1" value="' + esc(r.edad) + '"></div>' +
      '<div class="campo"><label for="reg-cp">Cód. postal</label><input class="entrada mono centro" id="reg-cp" inputmode="numeric" autocomplete="off" maxlength="4" data-campo="reg.cp" data-refrescar="1" value="' + esc(r.cp) + '"></div>' +
      '</div><span class="ayuda">El orden se sugiere solo: siguiente número libre del rango de este dispositivo (' + R.pad(aj.ordenDesde, 3) + '–' + R.pad(aj.ordenHasta, 3) + ').</span>' +
      region('codigo', REGIONES.codigo()) + '</section>';

    html += campoTexto('reg.encuestador', T.encuestadoresEntrevista, r.encuestador, { ayuda: T.ayudaEncuestadores, placeholder: 'Nombre y apellido' });


    html += '<section style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">' +
      '<h2 class="seccion">' + esc(T.datosContacto) + '</h2><span class="ayuda">Se guardan aparte de las respuestas</span></div>' +
      campoTexto('contacto.correo', 'Correo electrónico', (r.contacto || {}).correo, { tipo: 'email', placeholder: 'nombre@correo.com', autocomplete: 'off' }) +
      campoTexto('contacto.celular', 'Celular', (r.contacto || {}).celular, { tipo: 'tel', placeholder: '+54 9 388 …', inputmode: 'tel' }) + '</section>';

    var cs = r.consent || {};
    html += '<a class="tarjeta" href="#/consentimiento/' + esc(r.id) + '" style="text-decoration:none;color:inherit;gap:4px">' +
      '<span class="seccion">Consentimiento</span><span>' + (r.consentimiento ? 'Participa' : '<b style="color:var(--error)">Falta el consentimiento</b>') +
      ' · punción: ' + esc(cs.puncion || '—') + ' · grabación: ' + esc(cs.grabacion || '—') + '</span><span class="ayuda">Tocá para revisarlo</span></a>' +
      '<div class="casilla-linea"><input type="checkbox" id="comparte" data-campo="reg.comparte_app"' + (r.comparte_app ? ' checked' : '') + '>' +
      '<label for="comparte">' + esc(T.comparteApp) + '</label></div>';

    html += '<div class="empujar-abajo" style="display:flex;flex-direction:column;gap:10px">' +
      '<button type="button" class="btn primario" data-accion="continuar" data-valor="socio">' + esc(T.continuarSocio) + ico('seguir', 22) + '</button>' +
      '<button type="button" class="btn" data-accion="continuar" data-valor="bio">' + esc(T.irDirectoBio) + '</button>' +
      (r.modificado ? '<button type="button" class="btn chico peligro" data-accion="eliminar">Eliminar este relevamiento</button>' : '') +
      '</div></main>';
    return html;
  }

  /* ---------- Sociodemográfica ---------- */
  function vPregunta(p, resp) {
    if (!R.esVisible(p, resp)) return '';
    var leg = '<legend><span class="num-preg">' + p.n + '</span>' + esc(p.texto) + '</legend>';
    var cuerpo = '';
    if (p.tipo === 'unica' || p.tipo === 'multiple') {
      cuerpo = grupoOpciones('socio.' + p.id, p.opciones, resp[p.id], p.tipo === 'multiple', p.enLinea ? 'linea' : null) + vDetalles(p, resp);
    } else if (p.tipo === 'numero') {
      cuerpo = campoNumero('socio.' + p.id, p.texto, resp[p.id], { unidad: p.unidad, min: p.min, max: p.max, ocultarRotulo: true });
    } else if (p.tipo === 'texto') {
      cuerpo = campoTexto('socio.' + p.id, p.texto, resp[p.id], { area: true, ocultarRotulo: true });
    } else if (p.tipo === 'grupo') {
      cuerpo = p.campos.map(function (c) {
        var id = 'socio-' + c.id;
        return '<div class="fila-lista"><label for="' + id + '">' + esc(c.etiqueta) + '</label><select class="entrada" id="' + id + '" data-campo="socio.' + c.id + '">' +
          '<option value="">Elegir…</option>' + c.opciones.map(function (o) {
            return '<option' + (resp[c.id] === o ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') + '</select></div>' + vDetalles(c, resp);
      }).join('');
    }
    return '<fieldset class="pregunta">' + leg + cuerpo + '</fieldset>';
  }

  function vDetalles(p, resp) {
    if (!p.detalles) return '';
    var v = resp[p.id], sel = Array.isArray(v) ? v : (v ? [v] : []), hechos = {}, html = '';
    sel.forEach(function (op) {
      var d = p.detalles[op];
      if (!d || hechos[d.id]) return;
      hechos[d.id] = true;
      html += campoTexto('socio.' + d.id, d.etiqueta, resp[d.id], {});
    });
    return html;
  }

  REGIONES.progresoSocio = function () {
    var r = estado.actual, n = estado.ruta.n, a = R.avanceSocio(r);
    return '<div class="fila-progreso"><span><b>Sección ' + n + ' de ' + SECC.length + '</b><span style="color:var(--tinta-2)"> · ' + a.respondidas + ' de ' + a.total + ' respondidas</span></span>' + placaChica(r) + '</div>' +
      '<nav class="segmentos" aria-label="Secciones" style="grid-template-columns:repeat(' + SECC.length + ',minmax(0,1fr))">' + SECC.map(function (s, i) {
        var av = R.avanceSeccion(r, i), cls = i + 1 === n ? 'actual' : av.respondidas === av.total ? 'hecho' : '';
        return '<a class="segmento ' + cls + '" href="#/socio/' + r.id + '/' + (i + 1) + '" aria-label="Sección ' + (i + 1) + ': ' + esc(s.titulo) + '"' + (i + 1 === n ? ' aria-current="step"' : '') + '></a>';
      }).join('') + '</nav>';
  };

  function vSocio() {
    var r = estado.actual, n = Math.min(Math.max(estado.ruta.n || 1, 1), SECC.length), s = SECC[n - 1];
    estado.ruta.n = n;
    var resp = r.socio || {};
    var anterior = n === 1 ? '#/participante/' + r.id : '#/socio/' + r.id + '/' + (n - 1);
    var siguiente = n === SECC.length ? '#/bio/' + r.id + '/1' : '#/socio/' + r.id + '/' + (n + 1);
    return '<main class="pantalla">' + region('grab', barraGrabacion()) + barra(anterior, T.cejaSocio, s.titulo) +
      '<div style="display:flex;flex-direction:column;gap:6px">' + region('progresoSocio', REGIONES.progresoSocio()) + '</div>' +
      s.preguntas.map(function (p) { return vPregunta(p, resp); }).join('') +
      ENT.filter(function (e) { return e.seccion === n - 1; }).map(function (e) { return region('prof-' + e.id, cuadroProfundizar(e)); }).join('') +
      '<div class="pie-fijo empujar-abajo"><div class="fila-botones"><a class="btn" href="' + anterior + '">Anterior</a>' +
      '<a class="btn primario" style="min-height:52px;font-size:17px" href="' + siguiente + '">' + (n === SECC.length ? esc(T.irABio) : 'Siguiente') + ico('seguir', 22) + '</a></div></div></main>';
  }

  /* ---------- Biológica ---------- */
  var PASOS_BIO = CFG.pasosBio || ['Mediciones', 'Antecedentes y hábitos', 'Glucometría'];

  function preguntaBio(id, disposicion, nota) {
    var b = BIO[id], v = (estado.actual.bio || {})[id];
    return '<fieldset class="pregunta"><legend>' + esc(b.texto) + '</legend>' +
      grupoOpciones('bio.' + id, b.opciones, v, false, disposicion) + (nota || '') + '</fieldset>';
  }

  REGIONES.calcBio = function () {
    var r = estado.actual, b = r.bio || {}, c = R.calcular(r), fr = c.findrisk, fh = c.framingham;
    function pts(a, k) { return a.detalle[k] != null ? (a.detalle[k] >= 0 ? '+' : '') + a.detalle[k] : '·'; }
    var filas = '';
    filas += '<div class="calc-fila"><span>Edad <b>' + esc(r.edad || '—') + '</b> <span style="color:#2B4A66">(del código)</span></span><span class="pts">FR ' + pts(fr, 'edad') + ' · FH ' + pts(fh, 'edad') + '</span></div>';
    filas += '<div class="calc-fila"><span>IMC <b>' + fmt(c.imc) + '</b> kg/m²</span><span class="pts">FR ' + pts(fr, 'imc') + ' · FH ' + pts(fh, 'imc') + '</span></div>';
    var rango = b.b_sexo === 'Mujer' ? ' (mujer 80–88)' : b.b_sexo === 'Varón' ? ' (varón 94–102)' : '';
    filas += '<div class="calc-fila"><span>Perímetro <b>' + esc(b.b_perimetro_cm || '—') + '</b>' + rango + '</span><span class="pts">FR ' + pts(fr, 'perimetro') + '</span></div>';
    var trat = b.b_med_antihta === 'Sí' ? ', con tratamiento' : b.b_med_antihta === 'No' ? ', sin tratamiento' : '';
    filas += '<div class="calc-fila"><span>PAS <b>' + esc(b.b_pas_mmhg || '—') + '</b>' + trat + '</span><span class="pts">FH ' + pts(fh, 'pas') + '</span></div>';
    var pas = num(b.b_pas_mmhg), pad = num(b.b_pad_mmhg);
    filas += '<div class="calc-fila"><span>PAD <b>' + esc(b.b_pad_mmhg || '—') + '</b></span><span class="pts">no puntúa</span></div>';
    var avisoPA = pas !== null && pad !== null && pad >= pas
      ? '<span class="error-linea">' + ico('alerta', 18) + 'Revisá la presión: la diastólica es igual o mayor que la sistólica.</span>' : '';
    if (estado.ruta.n === 2) {
      filas += '<div class="calc-fila"><span>Tabaco y diabetes</span><span class="pts">FH ' + pts(fh, 'tabaco') + ' · ' + pts(fh, 'diabetes') + '</span></div>';
    }
    var notas = [];
    if (fr.aplica === false) notas.push('FINDRISK no corresponde: ' + fr.motivo.toLowerCase() + '.');
    if (fh.aplica === false) notas.push('Framingham no corresponde: ' + fh.motivo.toLowerCase() + '.');
    return avisoPA + '<div class="calc"><span class="titulo-calc">' + ico('igual', 18) + 'Calculado automáticamente</span>' + filas +
      '<span class="nota">FR: FINDRISK · FH: Framingham con IMC (usa la sistólica; la diastólica se registra y no entra en el cálculo)' + (notas.length ? '. ' + esc(notas.join(' ')) : '') + '</span></div>';
  };

  REGIONES.pieBio = function () {
    var r = estado.actual, c = R.calcular(r), fr = c.findrisk, n = estado.ruta.n;
    var linea1, linea2;
    if (fr.aplica === false) { linea1 = 'FINDRISK no corresponde'; linea2 = fr.motivo; }
    else if (fr.completo) { linea1 = 'FINDRISK <b>' + fr.puntos + ' pts</b>'; linea2 = fr.categoria + ' · ' + fr.probabilidad; }
    else { linea1 = 'FINDRISK parcial <b>' + fr.puntos + ' pts</b>'; linea2 = 'Faltan ' + fr.faltan.length + ' ítems del test'; }
    var siguiente = n < 3 ? '#/bio/' + r.id + '/' + (n + 1) : '#/final/' + r.id;
    return '<div class="fila-pie"><div class="resumen-pie"><span>' + linea1 + '</span><span style="color:var(--tinta-2)">' + esc(linea2) + '</span></div>' +
      '<a class="btn primario" style="min-height:56px;font-size:17px;padding:0 22px;flex:none" href="' + siguiente + '">' + (n < 3 ? 'Siguiente' : 'Antes de terminar') + ico('seguir', 22) + '</a></div>';
  };

  REGIONES.ayuno = function () {
    var b = estado.actual.bio || {};
    var m = C.minutosEntre(b.g_hora_ingesta, b.g_hora_medicion);
    return m == null ? '<span class="ayuda">Con las dos horas se calcula el ayuno.</span>' : '<span class="ok-linea">' + ico('igual', 18) + 'Ayuno de ' + C.formatoAyuno(m) + '</span>';
  };

  function vBio() {
    var r = estado.actual, n = Math.min(Math.max(estado.ruta.n || 1, 1), 3), b = r.bio || {};
    estado.ruta.n = n;
    var volver = n === 1 ? '#/socio/' + r.id + '/' + SECC.length : '#/bio/' + r.id + '/' + (n - 1);
    var html = '<main class="pantalla">' + region('grab', barraGrabacion()) + barra(volver, T.cejaBio, PASOS_BIO[n - 1], placaChica(r)) +
      '<nav class="pasos" aria-label="Partes del módulo biológico" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + PASOS_BIO.map(function (t, i) {
        return '<a class="paso ' + (i + 1 === n ? 'actual' : i + 1 < n ? 'hecho' : '') + '" href="#/bio/' + r.id + '/' + (i + 1) + '" style="text-decoration:none"><span class="barrita"></span>' + t + '</a>';
      }).join('') + '</nav>';

    if (n === 1) {
      var nota = b.b_dbt_dx === 'No' ? '<span class="ok-linea">' + ico('check', 16) + 'Se aplica el test FINDRISK</span>'
        : b.b_dbt_dx === 'Sí' ? '<span class="ayuda">Con diagnóstico de diabetes no se realiza FINDRISK.</span>' : '';
      html += preguntaBio('b_dbt_dx', 'grilla', nota) + preguntaBio('b_sexo', 'grilla') +
        '<div class="grilla-campos">' +
        campoNumero('bio.b_peso_kg', 'Peso', b.b_peso_kg, { unidad: 'kg', min: RANGOS.peso[0], max: RANGOS.peso[1], ayuda: 'Con un decimal' }) +
        campoNumero('bio.b_altura_m', 'Altura', b.b_altura_m, { unidad: 'm', min: RANGOS.altura[0], max: RANGOS.altura[1], ayuda: 'Válido ' + fmt(RANGOS.altura[0], 2) + '–' + fmt(RANGOS.altura[1], 2) }) +
        '</div>' +
        campoNumero('bio.b_perimetro_cm', 'Perímetro abdominal', b.b_perimetro_cm, { unidad: 'cm', min: RANGOS.perimetro[0], max: RANGOS.perimetro[1], ayuda: 'Sin decimales' }) +
        '<div class="grilla-campos">' +
        campoNumero('bio.b_pas_mmhg', 'Presión sistólica', b.b_pas_mmhg, { unidad: 'mmHg', min: RANGOS.pas[0], max: RANGOS.pas[1], ayuda: 'La «alta». Tres cifras' }) +
        campoNumero('bio.b_pad_mmhg', 'Presión diastólica', b.b_pad_mmhg, { unidad: 'mmHg', min: RANGOS.pad[0], max: RANGOS.pad[1], ayuda: 'La «baja». Dos o tres cifras' }) +
        '</div>' + region('calcBio', REGIONES.calcBio());
    } else if (n === 2) {
      html += preguntaBio('b_act_fisica', 'grilla') + preguntaBio('b_fyv_diario', 'grilla') + preguntaBio('b_hta_dx', 'grilla') +
        preguntaBio('b_med_antihta', 'grilla', '<span class="ayuda">Se usa en FINDRISK y en Framingham (no se vuelve a preguntar).</span>') +
        preguntaBio('b_glucosa_previa', 'grilla', '<span class="ayuda">Glucemia alta en algún momento: embarazo, estudios, etc.</span>') +
        preguntaBio('b_antec_fam_dbt', null, '<span class="ayuda">Primer grado: padres, hermanos.</span>') + preguntaBio('b_fuma', 'grilla') +
        region('calcBio', REGIONES.calcBio());
    } else {
      if ((r.consent || {}).puncion === 'No') html += '<p class="tarjeta aviso" style="margin:0">En el consentimiento <b>no aceptó la punción</b>: marcá «No».</p>';
      html += preguntaBio('g_acepta', 'grilla');
      if (b.g_acepta === 'Sí') {
        html += '<div class="grilla-campos">' +
          '<div class="campo"><label for="bio-g_hora_ingesta">Hora de la última ingesta</label><input class="entrada mono" type="time" id="bio-g_hora_ingesta" data-campo="bio.g_hora_ingesta" data-refrescar="1" value="' + esc(b.g_hora_ingesta) + '"></div>' +
          '<div class="campo"><label for="bio-g_hora_medicion">Hora de la medición</label><input class="entrada mono" type="time" id="bio-g_hora_medicion" data-campo="bio.g_hora_medicion" data-refrescar="1" value="' + esc(b.g_hora_medicion) + '"></div>' +
          '</div>' + region('ayuno', REGIONES.ayuno()) +
          campoTexto('bio.g_que_ingirio', '¿Qué comió o bebió?', b.g_que_ingirio, {}) +
          campoNumero('bio.g_resultado_mgdl', 'Resultado de glucometría periférica', b.g_resultado_mgdl, { unidad: 'mg/dL', min: RANGOS.glucemia[0], max: RANGOS.glucemia[1] }) +
          '<span class="etiqueta-aviso">' + esc(T.criterioDerivacion) + '</span>';
      } else if (b.g_acepta === 'No') {
        html += '<p class="ayuda" style="margin:0">Se registra que no aceptó la medición.</p>';
      }
    }
    html += '<div class="pie-fijo empujar-abajo">' + region('pieBio', REGIONES.pieBio()) + '</div></main>';
    return html;
  }

  /* ---------- Resultados ---------- */
  function escala(colores, rotulos, activo) {
    var col = 'grid-template-columns:repeat(' + colores.length + ',minmax(0,1fr))';
    return '<div class="escala" style="' + col + '">' + colores.map(function (c, i) {
      return '<span style="background:var(' + c + ')"' + (i === activo ? ' class="activo"' : '') + '></span>';
    }).join('') + '</div><div class="escala-rotulos" style="' + col + '">' + rotulos.map(function (t, i) {
      return '<span' + (i === activo ? ' class="activo"' : '') + '>' + t + '</span>';
    }).join('') + '</div>';
  }

  function vResultados() {
    var r = estado.actual, b = r.bio || {}, c = R.calcular(r), fr = c.findrisk, fh = c.framingham;
    var html = '<main class="pantalla">' + barra('#/final/' + r.id, T.cejaResultados, T.resultados, placaChica(r)) + pasosRelevamiento(r, 3);
    var au = r.audio || {};
    if (au.archivos && au.archivos.length) html += '<span class="ok-linea">' + ico('check', 18) + 'Audio guardado · ' + Math.max(1, Math.round((au.segundos || 0) / 60)) + ' min · ' + esc(au.archivos.join(', ')) + '</span>';

    html += '<section class="tarjeta"><h2 class="seccion">FINDRISK · riesgo de diabetes a 10 años</h2>';
    if (fr.aplica === false) html += '<p>No corresponde: ' + esc(fr.motivo) + '.</p>';
    else if (!fr.completo) html += '<p>Faltan datos: ' + esc(fr.faltan.join(', ')) + '.</p>';
    else {
      var iFr = ['Bajo', 'Ligeramente elevado', 'Moderado', 'Alto', 'Muy alto'].indexOf(fr.categoria);
      var d = fr.detalle;
      html += '<div class="resultado-cabeza"><span class="grande-num"><span class="n">' + fr.puntos + '</span><span class="u">puntos</span></span>' +
        '<span class="categoria"><span class="c">' + esc(fr.categoria) + '</span><span class="p">' + esc(fr.probabilidad) + ' de probabilidad</span></span></div>' +
        escala(['--r1', '--r2', '--r3', '--r4', '--r5'], ['0–6', '7–11', '12–14', '15–20', '21–26'], iFr) +
        '<p class="detalle-pts">Edad ' + d.edad + ' · IMC ' + d.imc + ' · Perímetro ' + d.perimetro + ' · Actividad física ' + d.actividad +
        ' · Frutas y verduras ' + d.fyv + ' · Antihipertensivos ' + d.medicacion + ' · Glucosa elevada ' + d.glucosa + ' · Antecedentes ' + d.antecedentes + '</p>';
    }
    html += '</section>';

    html += '<section class="tarjeta"><h2 class="seccion">Framingham con IMC · riesgo cardiovascular</h2>';
    if (fh.aplica === false) html += '<p>No corresponde: ' + esc(fh.motivo) + '.</p>';
    else if (!fh.completo) html += '<p>Faltan datos: ' + esc(fh.faltan.join(', ')) + '.</p>';
    else {
      var iFh = ['Bajo', 'Moderado', 'Alto'].indexOf(fh.categoria);
      var rec = RECOMENDACION[fh.categoria] || '';
      var e = fh.detalle;
      html += '<div class="resultado-cabeza"><span class="grande-num"><span class="n">' + fh.puntos + '</span><span class="u">puntos</span></span>' +
        '<span class="categoria"><span class="c">Riesgo ' + fh.categoria.toLowerCase() + '</span><span class="p">' + esc(fh.riesgo) + ' % a 10 años</span></span></div>' +
        escala(['--r1', '--r3', '--r5'], ['menos de 10 %', '10–19 %', '20 % o más'], iFh) +
        '<p class="detalle-pts">Edad ' + e.edad + ' · IMC ' + e.imc + ' · PAS ' + e.pas + ' · Tabaco ' + e.tabaco + ' · Diabetes ' + e.diabetes + '. Protocolo: ' + rec + '</p>';
    }
    html += '</section>';

    html += '<section class="tarjeta"><h2 class="seccion">Glucometría periférica</h2>';
    if (b.g_acepta === 'No') html += '<p>No aceptó la medición.</p>';
    else if (b.g_acepta !== 'Sí' || !b.g_resultado_mgdl) html += '<p>Sin medición registrada.</p>';
    else {
      html += '<div class="resultado-cabeza"><span class="grande-num"><span class="n" style="font-size:44px">' + esc(b.g_resultado_mgdl) + '</span><span class="u">mg/dL</span></span>' +
        '<span class="categoria"><span style="font-weight:700">' + (c.ayunoMin != null ? 'Ayuno de ' + C.formatoAyuno(c.ayunoMin) : 'Ayuno sin calcular') + '</span>' +
        '<span class="p" style="font-size:13px">' + (b.g_hora_ingesta ? 'Última ingesta ' + esc(b.g_hora_ingesta) : '') + (b.g_que_ingirio ? ' · ' + esc(b.g_que_ingirio) : '') + '</span></span></div>' +
        '<span class="etiqueta-aviso">' + esc(T.criterioDerivacion) + '</span>';
    }
    html += '</section>';

    html += '<div class="empujar-abajo" style="display:flex;flex-direction:column;gap:10px">' +
      '<button type="button" class="btn primario" data-accion="finalizar">' + ico('check', 22) + esc(T.guardarYVolver) + '</button></div></main>';
    return html;
  }

  /* ---------- Cierre de jornada ---------- */
  REGIONES.estadoSync = function () {
    return estado.mensajeSync ? '<p role="status" style="font-weight:700">' + esc(estado.mensajeSync) + '</p>' : '';
  };

  function vCierre() {
    var aj = estado.ajustes, f = hoy();
    var deHoy = estado.registros.filter(function (r) { return r.fecha === f; });
    var fin = deHoy.filter(function (r) { return r.estado === 'finalizado'; });
    var enCurso = deHoy.filter(function (r) { return r.estado !== 'finalizado'; });
    var pend = pendientes();
    var codigos = {}, dup = [];
    estado.registros.forEach(function (r) { if (!r.codigo) return; if (codigos[r.codigo]) dup.push(r.codigo); codigos[r.codigo] = true; });
    var sinConsent = estado.registros.filter(function (r) { return !r.consentimiento && r.modificado; }).length;

    var html = '<main class="pantalla">' + barra('#/jornada', 'Equipo ' + aj.equipo + ' · Dispositivo ' + aj.dispositivo, T.cierreJornada) +
      '<div class="cifras tres">' +
      '<div class="tarjeta" style="padding:10px 12px;gap:0"><span class="cifra"><span class="numero">' + deHoy.length + '</span><span class="rotulo">relevados hoy</span></span></div>' +
      '<div class="tarjeta" style="padding:10px 12px;gap:0"><span class="cifra"><span class="numero">' + fin.length + '</span><span class="rotulo">finalizados</span></span></div>' +
      '<div class="tarjeta" style="padding:10px 12px;gap:0"><span class="cifra"><span class="numero">' + enCurso.length + '</span><span class="rotulo">en curso</span></span></div></div>';

    html += '<section class="tarjeta"><h2 class="seccion">Revisión antes de enviar</h2>' +
      (dup.length ? '<span class="error-linea">' + ico('alerta', 18) + 'Códigos repetidos: ' + esc(dup.join(', ')) + '</span>'
        : '<span class="ok-linea" style="color:var(--tinta)">' + '<span style="color:var(--azul);display:inline-flex">' + ico('check', 18) + '</span>Sin códigos repetidos en el dispositivo</span>') +
      (sinConsent ? '<span class="error-linea">' + ico('alerta', 18) + sinConsent + ' sin consentimiento: no se envían</span>' : '') +
      enCurso.map(function (r) {
        return '<div style="display:flex;align-items:center;gap:8px;font-size:15px"><span style="color:var(--error);display:inline-flex">' + ico('alerta', 18) + '</span>' +
          '<span style="flex:1;min-width:0"><span style="font-family:var(--f-mono);font-size:14px">' + esc(r.codigo || 'Sin código') + '</span>: sin finalizar</span>' +
          '<a class="btn chico peligro" href="#/participante/' + esc(r.id) + '">Revisar</a></div>';
      }).join('') + '</section>';

    var motivo = !aj.url ? 'Falta la dirección de la planilla en Ajustes.' : !estado.online ? 'El dispositivo no tiene señal en este momento.' : '';
    html += '<section class="tarjeta azul"><h2 class="seccion" style="color:var(--azul-osc)">Con señal</h2>' +
      '<p>' + (pend.length ? 'Se envían ' + pend.length + ' relevamientos nuevos o modificados.' : 'No hay relevamientos pendientes de envío.') +
      ' La copia queda en este dispositivo.</p>' + (motivo ? '<p class="ayuda">' + motivo + '</p>' : '') +
      '<button type="button" class="btn azul" data-accion="sincronizar"' + (motivo || estado.sincronizando || !pend.length ? ' disabled' : '') + '>' + ico('nube', 22) +
      (estado.sincronizando ? 'Sincronizando…' : esc(T.sincronizarAhora)) + '</button>' + region('estadoSync', REGIONES.estadoSync()) + '</section>';

    html += '<section class="tarjeta discontinua"><h2 class="seccion" style="color:var(--tinta-2)">Sin señal</h2>' +
      (aj.clave
        ? '<p>Generá un archivo cifrado con lo relevado para mandar por WhatsApp, correo o Drive. ' + esc(mayuscula(T.responsable)) + ' lo importa y se descartan duplicados. ' +
          'Mandale también la <b>huella</b> que aparece al generarlo: si a ' + esc(T.responsable) + ' le da la misma, el archivo llegó entero.</p>'
        : '<p class="error-linea">' + ico('alerta', 18) + 'Falta la clave del equipo en Ajustes: sin clave no se genera el paquete.</p>') +
      '<button type="button" class="btn" data-accion="paquete"' + (aj.clave ? '' : ' disabled') + '>' + ico('compartir', 22) + esc(T.compartirPaquete) + '</button>' +
      (aj.ultimaHuella ? '<p class="ayuda" style="margin:0">Último paquete: ' + fechaCorta(aj.ultimoPaquete) + ' ' + horaDe(aj.ultimoPaquete) + ' · huella <b class="mono">' + esc(aj.ultimaHuella) + '</b></p>' : '') +
      '<p class="ayuda" style="margin:0">El paquete es una copia para transportar: no libera el celular. Lo que no se envió a la planilla queda guardado acá.</p></section>' +
      '<span class="ayuda empujar-abajo" style="text-align:center">' +
      (aj.ultimaSync ? 'Última sincronización: ' + fechaCorta(aj.ultimaSync) + ' ' + horaDe(aj.ultimaSync) : 'Este dispositivo todavía no sincronizó') + '</span>' +
      '<a class="btn primario" href="#/audios" style="justify-content:space-between"><span style="display:flex;align-items:center;gap:10px"><span class="punto-grabando"></span>Audios del día (' + estado.audios.length + ')</span>' + ico('seguir', 22) + '</a></main>';
    return html;
  }

  /* ---------- Ajustes ---------- */
  REGIONES.conexion = function () { return estado.mensajeConexion ? '<p role="status" style="margin:0;font-weight:700">' + esc(estado.mensajeConexion) + '</p>' : ''; };

  function vAjustes() {
    var aj = estado.ajustes;
    function campo(id, etiqueta, extra) { return campoTexto('aj.' + id, etiqueta, aj[id], extra || {}); }
    return '<main class="pantalla">' + barra('#/jornada', 'Este dispositivo', 'Ajustes') +
      '<section class="tarjeta"><h2 class="seccion">Equipo y dispositivo</h2>' +
      '<div class="grilla-campos">' + campo('equipo', 'Equipo', { placeholder: 'A' }) + campo('dispositivo', 'N° de dispositivo', { inputmode: 'numeric' }) + '</div>' +
      '<div class="grilla-campos">' + campo('ordenDesde', 'Orden desde', { inputmode: 'numeric', refrescar: true }) + campo('ordenHasta', 'Orden hasta', { inputmode: 'numeric', refrescar: true }) + '</div>' +
      region('rango', REGIONES.rango()) +
      '<span class="ayuda">Si cada integrante usa un solo celular, el N° de dispositivo queda en 1. Cambia solo si la misma persona carga desde un segundo aparato: ahí va 2 y otro rango de orden, para que no se repitan códigos ni IDs.</span>' +
      campo('encuestador', 'Encuestador/a habitual', { placeholder: 'Nombre o iniciales', ayuda: 'Aparece ya escrito en cada entrevista nueva; ahí se puede cambiar.' }) + campo('puesto', 'Puesto o lugar de relevamiento', { placeholder: 'p. ej. Susques, RN 52' }) + '</section>' +
      '<section class="tarjeta"><h2 class="seccion">Planilla de Google</h2>' +
      campoTexto('aj.url', 'Dirección de la aplicación web (Apps Script)', aj.url, { area: true }) +
      campoTexto('aj.clave', 'Clave del equipo', aj.clave, { tipo: 'password', ayuda: 'La misma en todos los dispositivos y en el script. Cifra los paquetes.' }) +
      '<button type="button" class="btn chico" data-accion="probar">' + ico('senal', 18) + 'Probar conexión</button>' + region('conexion', REGIONES.conexion()) + '</section>' +
      '<section class="tarjeta"><h2 class="seccion">' + esc(T.seccionAdministracion) + '</h2>' +
      '<a class="btn chico" href="#/importar">' + ico('subir', 18) + 'Importar paquetes de otros dispositivos</a>' +
      '<a class="btn chico" href="../tablero/">' + ico('seguir', 18) + 'Abrir el tablero de análisis</a>' +
      '<button type="button" class="btn chico" data-accion="respaldo"' + (aj.clave ? '' : ' disabled') + '>' + ico('bajar', 18) + 'Respaldo cifrado de este dispositivo</button>' +
      (estado.instalar ? '<button type="button" class="btn chico azul-claro" data-accion="instalar">Instalar la app</button>' : '') + '</section>' +
      vZonaCuidado() + vBitacora() +
      '<p class="ayuda">App ' + esc(VERSION_APP) + ' · instrumento ' + esc(I.CUESTIONARIO.version) + ' · ' + estado.registros.length + ' relevamientos guardados · almacenamiento ' +
      (estado.persistente === true ? 'protegido' : estado.persistente === false ? 'no protegido: hacé respaldos frecuentes' : 'sin verificar') + '</p></main>';
  }

  function vZonaCuidado() {
    var pend = pendientes().length;
    return '<section class="tarjeta" style="border-color:var(--error)"><h2 class="seccion" style="color:var(--error)">Zona de cuidado</h2>' +
      '<p>Borra todos los relevamientos de ESTE celular (por ejemplo, después de la práctica). Los que ya se enviaron siguen en la planilla.' +
      (pend ? ' <b>Hay ' + pend + ' sin enviar</b>: si los borrás, antes se descarga un respaldo cifrado.' : '') + '</p>' +
      '<button type="button" class="btn chico peligro" data-accion="borrar-todo"' + (estado.registros.length ? '' : ' disabled') + '>Borrar los datos de este celular</button></section>';
  }

  function vBitacora() {
    var ult = estado.bitacora.slice(-40).reverse();
    return '<details class="tarjeta"><summary class="seccion" style="cursor:pointer">Registro de operaciones de este dispositivo</summary>' +
      '<p class="ayuda" style="margin:0">Qué se hizo y cuándo. No guarda respuestas, contactos ni claves.</p>' +
      (ult.length ? '<div class="bitacora">' + ult.map(function (x) {
        return '<div style="font-size:14px"><span class="mono">' + fechaCorta(x.t) + ' ' + horaDe(x.t) + '</span> · <b>' + esc(x.ev) + '</b>' + (x.det ? ' · ' + esc(x.det) : '') + '</div>';
      }).join('') + '</div>' : '<p class="ayuda" style="margin:0">Todavía no hay operaciones registradas.</p>') + '</details>';
  }

  /* ---------- Importar ---------- */
  REGIONES.importacion = function () {
    if (!estado.importacion.length) return '';
    return '<div class="tarjeta resultados-importacion">' + estado.importacion.map(function (x) {
      return x.error ? '<span class="error-linea">' + ico('alerta', 16) + esc(x.nombre) + ': ' + esc(x.error) + '</span>'
        : '<span class="ok-linea" style="color:var(--tinta)">' + ico('check', 16) + esc(x.nombre) + ': ' + x.nuevos + ' nuevos, ' + x.actualizados + ' actualizados, ' + x.iguales + ' ya estaban' +
          (x.descartados ? ', ' + x.descartados + ' descartados por formato inválido' : '') + ' · huella ' + esc(x.huella) + '</span>';
    }).join('') + '</div>';
  };

  function vImportar() {
    return '<main class="pantalla">' + barra('#/ajustes', T.cejaImportar, 'Importar paquetes') +
      '<p style="margin:0">Elegí los paquetes que mandaron los equipos (archivos .txt o .json). Se unen con lo que ya hay en esta computadora; si un relevamiento llega dos veces, queda la versión más reciente.</p>' +
      '<label class="btn primario" for="archivos-paquete" style="cursor:pointer">' + ico('subir', 22) + 'Elegir paquetes</label>' +
      '<input type="file" id="archivos-paquete" accept=".txt,.json,text/plain,application/json" multiple class="oculto-visual">' +
      region('importacion', REGIONES.importacion()) +
      '<a class="btn azul" href="#/cierre">' + ico('nube', 22) + 'Enviar todo a la planilla</a>' +
      '<section class="tarjeta"><h2 class="seccion">Archivos para analizar (sin cifrar)</h2><p class="ayuda" style="margin:0">' + esc(T.avisoSinCifrar) + '</p>' +
      '<button type="button" class="btn chico" data-accion="csv">' + ico('bajar', 18) + 'Descargar CSV consolidado</button>' +
      '<button type="button" class="btn chico" data-accion="contactos">' + ico('bajar', 18) + 'Descargar contactos (CSV)</button></section></main>';
  }

  /* ---------- acciones ---------- */
  var ACCIONES = {
    'nuevo': function () {
      var aj = estado.ajustes;
      var r = { id: uuid(), participante_id: '', orden: String(siguienteOrden()), edad: '', cp: '', codigo: '', fecha: hoy(), hora_inicio: horaAhora(),
        equipo: aj.equipo, dispositivo: aj.dispositivo, encuestador: aj.encuestador, puesto: aj.puesto, consentimiento: false, comparte_app: false,
        contacto: {}, socio: {}, bio: {}, estado: 'borrador', creado: ahoraISO(), modificado: null, sincronizado: null,
        version_instrumento: I.CUESTIONARIO.version };
      estado.actual = r;
      ir('#/consentimiento/' + r.id);
    },
    'ver-todos': function () { estado.verTodos = !estado.verTodos; refrescar(); },
    'opcion': function (b) {
      var ruta = b.dataset.campo, val = b.dataset.valor, multiple = b.dataset.multiple === '1';
      var partes = ruta.split('.'), grupo = partes[0], id = partes[1];
      var def = DEF[id] || {}, antes = valor(ruta), nuevo;
      if (multiple) {
        var lista = Array.isArray(antes) ? antes.slice() : [];
        var i = lista.indexOf(val);
        if (i >= 0) lista.splice(i, 1);
        else if (def.exclusiva === val) lista = [val];
        else { lista = lista.filter(function (x) { return x !== def.exclusiva; }); lista.push(val); }
        nuevo = lista;
      } else {
        nuevo = antes === val ? '' : val;
      }
      if (def.detalles) {
        var sel = Array.isArray(nuevo) ? nuevo : (nuevo ? [nuevo] : []);
        var previos = Array.isArray(antes) ? antes : (antes ? [antes] : []);
        previos.forEach(function (op) { if (sel.indexOf(op) < 0 && def.detalles[op]) asignar(grupo + '.' + def.detalles[op].id, ''); });
      }
      if (ruta === 'bio.g_acepta' && nuevo === 'Sí' && !valor('bio.g_hora_medicion')) asignar('bio.g_hora_medicion', horaAhora());
      // País de nacimiento de habla hispana: se tilda solo «Español» en entiende/habla (no hace falta preguntarlo).
      // Solo agrega: si ya se desmarcó a mano, o el país es otro, no se toca.
      if (ruta === 'socio.p01_nac_pais' && ['Argentina', 'Chile', 'Paraguay'].indexOf(nuevo) >= 0) {
        ['p06_idiomas_entiende', 'p07_idiomas_habla'].forEach(function (campo) {
          var actuales = valor('socio.' + campo), lista = Array.isArray(actuales) ? actuales.slice() : [];
          if (lista.indexOf('Español') < 0) { lista.push('Español'); asignar('socio.' + campo, lista); }
        });
      }
      asignar(ruta, nuevo);
      render();
    },
    'consent-seguir': function () {
      var r = estado.actual, c = r.consent || {};
      if (c.participa !== 'Sí' || !c.puncion || !c.grabacion) return;
      asignar('reg.consentimiento', true);
      var nombre = nombreAudio(r);
      var graba = c.grabacion === 'Sí' && Gr.soportado() && !(Gr.regId() === r.id && Gr.estado() !== 'inactivo');
      (graba ? Gr.iniciar(r.id, nombre).then(function () { anotar('Grabación iniciada', ''); }, function (e) {
        toast('No se pudo empezar a grabar: ' + (e && e.message || 'sin permiso para el micrófono') + '. Usá la grabadora del celular.');
      }) : Promise.resolve()).then(function () { guardarActual(); ir('#/participante/' + r.id); });
    },
    'descartar': function () {
      var r = estado.actual;
      clearTimeout(reloj);
      (r && r.modificado ? DB.borrar(r.id) : Promise.resolve()).then(function () {
        estado.registros = estado.registros.filter(function (x) { return !r || x.id !== r.id; });
        estado.actual = null; ir('#/jornada');
      });
    },
    'rec-pausa': function () { Gr.pausar(); },
    'rec-reanudar': function () { Gr.reanudar().catch(function (e) { toast('No se pudo seguir grabando: ' + e.message); }); },
    'pend-abrir': function (b) {
      var id = b.dataset.valor; estado.pendAbierto[id] = !estado.pendAbierto[id];
      if (!estado.pendAbierto[id]) estado.tildadoFinal[id] = [];   // al cerrar, desaparecen las ya tildadas
      refrescar();
    },
    'pend-tilde': function (b) {
      var eje = b.dataset.campo, i = Number(b.dataset.valor), rec = estado.tildadoFinal[eje] = estado.tildadoFinal[eje] || [];
      if (rec.indexOf(i) < 0) rec.push(i);
      ACCIONES['prof-tilde'](b);
    },
    'prof-abrir': function (b) { var id = b.dataset.valor; estado.profAbierto[id] = !estado.profAbierto[id]; refrescar(); },
    'prof-tilde': function (b) {
      var r = estado.actual, eje = b.dataset.campo, i = Number(b.dataset.valor);
      r.entrevista = r.entrevista || {}; r.entrevista.tildadas = r.entrevista.tildadas || {};
      var l = (r.entrevista.tildadas[eje] || []).slice(), k = l.indexOf(i);
      if (k >= 0) l.splice(k, 1); else l.push(i);
      r.entrevista.tildadas[eje] = l.sort(function (a, c) { return a - c; });
      tocar(); refrescar();
    },
    'ir-resultados': function () {
      var r = estado.actual;
      (Gr.regId() === r.id && Gr.estado() !== 'inactivo' ? detenerGrabacion(r).then(function () { toast('Audio guardado'); }) : Promise.resolve())
        .then(function () { ir('#/resultados/' + r.id); });
    },
    'audios-pasar': function () {
      var lista = estado.audios.filter(function (a) { return !a.copiado; });
      if (!lista.length) return;
      var archivos = lista.map(function (a) { return new File([a.blob], a.nombre, { type: a.mime || 'audio/webm' }); });
      var compartir = navigator.canShare && navigator.canShare({ files: archivos })
        ? navigator.share({ files: archivos, title: 'Audios del relevamiento' }).then(function () { return true; }, function (e) { if (e && e.name === 'AbortError') return false; throw e; })
        : Promise.reject(new Error('sin compartir'));
      compartir.catch(function () {
        lista.forEach(function (a, i) { setTimeout(function () { S.descargar(a.nombre, a.blob, a.mime || 'audio/webm'); }, i * 400); });
        return true;
      }).then(function (hecho) {
        if (!hecho) return;
        setTimeout(function () {
          if (!window.confirm('¿Quedaron los ' + lista.length + ' audios copiados en la computadora del equipo?\n\nSi respondés que sí, se marcan como copiados (todavía no se borran).')) return;
          Promise.all(lista.map(function (a) { a.copiado = true; return DB.guardarAudio(a); })).then(function () {
            anotar('Audios copiados a la PC', lista.length + ' archivos');
            return cargarAudios();
          }).then(function () { render(); });
        }, 600);
      });
    },
    'audios-liberar': function () {
      var lista = estado.audios.filter(function (a) { return a.copiado; });
      if (!lista.length) return;
      if (!window.confirm('Se borran de este celular ' + lista.length + ' audios que ya están copiados en la computadora. ¿Seguir?')) return;
      Promise.all(lista.map(function (a) { return DB.borrarAudio(a.nombre); })).then(function () {
        anotar('Audios borrados del celular', lista.length + ' ya copiados');
        return cargarAudios();
      }).then(function () { toast('Espacio liberado'); render(); });
    },
    'continuar': function (b) {
      var r = estado.actual, errores = erroresIdentificacion(r);
      if (errores.length) { toast(errores[0]); return; }
      if (!r.participante_id) {
        // ID interno: equipo + dispositivo + N° de orden (p. ej. J1-0811). No se muestra: en pantalla va el código.
        asignar('reg.participante_id', R.idParticipante(r.equipo, r.dispositivo, r.orden));
        asignar('reg.pid_origen', 'orden');
        anotar('Relevamiento iniciado', r.participante_id);
      }
      tocar();
      ir(b.dataset.valor === 'bio' ? '#/bio/' + r.id + '/1' : '#/socio/' + r.id + '/1');
    },
    'eliminar': function () {
      var r = estado.actual;
      var aviso = r.sincronizado ? ' Ya se envió a la planilla: allí hay que borrarlo a mano.'
        : r.consentimiento ? ' ATENCIÓN: no tiene copia en la planilla, se pierde definitivamente.' : '';
      if (!window.confirm('¿Eliminar el relevamiento ' + (r.codigo || '') + '? No se puede deshacer.' + aviso)) return;
      clearTimeout(reloj);
      DB.borrar(r.id).then(function () {
        estado.registros = estado.registros.filter(function (x) { return x.id !== r.id; });
        anotar('Relevamiento eliminado', (r.participante_id || 'sin ID') + (r.sincronizado ? ' (estaba en la planilla)' : ' (sin copia en la planilla)'));
        estado.actual = null; toast('Relevamiento eliminado'); ir('#/jornada');
      });
    },
    'finalizar': function () {
      var r = estado.actual;
      r.estado = 'finalizado'; r.hora_fin = horaAhora(); tocar();
      (Gr.regId() === r.id ? detenerGrabacion(r) : Promise.resolve()).then(guardarActual).then(function () {
        anotar('Relevamiento finalizado', r.participante_id || '');
        toast('Relevamiento ' + (r.codigo || '') + ' guardado'); ir('#/jornada');
      });
    },
    'sincronizar': function () {
      if (estado.sincronizando) return;
      var aj = estado.ajustes;
      var pend = pendientes();
      if (!pend.length) { toast('No hay relevamientos pendientes'); return; }
      var marcas = {};
      pend.forEach(function (r) { marcas[r.id] = r.modificado; });
      estado.sincronizando = true; estado.mensajeSync = 'Enviando ' + pend.length + ' relevamientos…'; render();
      S.enviar(aj.url.trim(), aj.clave, pend, function (i, n) { estado.mensajeSync = 'Enviando lote ' + i + ' de ' + n + '…'; refrescar(); })
        .then(function (ids) {
          var ahora = ahoraISO(), hechos = [];
          estado.registros.forEach(function (r) {
            if (ids.indexOf(r.id) >= 0 && r.modificado === marcas[r.id]) { r.sincronizado = ahora; hechos.push(r); }
          });
          aj.ultimaSync = ahora; guardarAjustes();
          var faltan = pend.length - hechos.length;
          estado.mensajeSync = 'Listo: ' + hechos.length + ' relevamientos guardados en la planilla.' +
            (faltan ? ' ' + faltan + ' no se confirmaron: quedan pendientes para el próximo envío.' : '');
          anotar('Envío a la planilla', hechos.length + ' confirmados de ' + pend.length);
          return DB.guardarVarios(hechos);
        })
        .catch(function (e) {
          estado.mensajeSync = 'No se pudo sincronizar (' + e.message + '). Los datos siguen guardados en el dispositivo.';
          anotar('Envío fallido', String(e.message || '').slice(0, 80));
        })
        .then(function () { estado.sincronizando = false; render(); });
    },
    'paquete': function () {
      var aj = estado.ajustes, f = hoy();
      if (!aj.clave) { toast('Falta la clave del equipo en Ajustes: sin clave no se genera el paquete'); return; }
      var regs = estado.registros.filter(function (r) { return r.consentimiento && (r.fecha === f || R.pendiente(r)); });
      if (!regs.length) { toast('No hay relevamientos para empaquetar'); return; }
      var d = new Date(), nombre = 'paquete_' + aj.equipo + aj.dispositivo + '_' + f + '_' + dos(d.getHours()) + dos(d.getMinutes()) + '.txt';
      var texto = '', hu = '';
      S.armarPaquete(regs, { equipo: aj.equipo, dispositivo: aj.dispositivo }, aj.clave)
        .then(function (txt) { texto = txt; return S.huella(txt); })
        .then(function (h) { hu = h; return S.compartirODescargar(nombre, texto, 'text/plain', 'Paquete ' + aj.equipo + aj.dispositivo + ' · huella ' + h); })
        .then(function (modo) {
          aj.ultimoPaquete = ahoraISO(); aj.ultimaHuella = hu; guardarAjustes();
          anotar('Paquete generado', nombre + ' · ' + regs.length + ' relevamientos · huella ' + hu + ' · ' + modo);
          toast((modo === 'compartido' ? 'Paquete compartido' : 'Paquete descargado') + ' · huella ' + hu); render();
        })
        .catch(function (e) { if (e && e.name !== 'AbortError') toast('No se pudo generar el paquete: ' + e.message); });
    },
    'csv': function () {
      var regs = estado.registros.filter(function (r) { return r.consentimiento; });
      if (!regs.length) { toast('No hay datos para exportar'); return; }
      var cols = I.columnas().map(function (c) { return c.id; });
      var filas = regs.map(function (r) { return R.aplanar(r).fila; });
      S.descargar('datos_' + estado.ajustes.equipo + estado.ajustes.dispositivo + '_' + hoy() + '.csv', R.csv(filas, cols), 'text/csv;charset=utf-8');
      anotar('CSV descargado (sin cifrar)', regs.length + ' relevamientos');
    },
    'contactos': function () {
      var regs = estado.registros.filter(function (r) { return r.consentimiento; });
      if (!regs.length) { toast('No hay datos para exportar'); return; }
      var filas = regs.map(function (r) { return R.aplanar(r).contacto; });
      S.descargar('contactos_' + estado.ajustes.equipo + estado.ajustes.dispositivo + '_' + hoy() + '.csv', R.csv(filas, I.CONTACTO), 'text/csv;charset=utf-8');
      anotar('Contactos descargados (sin cifrar)', regs.length + ' filas');
    },
    'respaldo': function () {
      respaldoCifrado().then(function (h) { if (h) toast('Respaldo descargado · huella ' + h); })
        .catch(function (e) { toast('No se pudo generar el respaldo: ' + e.message); });
    },
    'probar': function () {
      var aj = estado.ajustes;
      if (!aj.url) { estado.mensajeConexion = 'Primero pegá la dirección de la aplicación web.'; refrescar(); return; }
      estado.mensajeConexion = 'Probando…'; refrescar();
      S.probarConexion(aj.url.trim(), aj.clave).then(function (r) {
        estado.mensajeConexion = r && r.ok ? 'Conexión correcta con la planilla «' + (r.planilla || '') + '»' +
          (r.version ? ' (script ' + r.version + ').' : '. El script es anterior a 1.4: conviene actualizarlo.') : 'La planilla respondió: ' + ((r && r.error) || 'error');
      }).catch(function (e) { estado.mensajeConexion = 'Sin conexión con la planilla (' + e.message + ').'; })
        .then(refrescar);
    },
    'borrar-todo': function () {
      var aj = estado.ajustes, total = estado.registros.length, pend = pendientes().length;
      if (!total) { toast('No hay relevamientos en este dispositivo'); return; }
      var palabra = 'BORRAR';
      var aviso = pend ? 'ATENCIÓN: ' + pend + ' relevamientos NO se enviaron a la planilla. Si son datos reales, cancelá y sincronizá primero.\n' +
        'Si seguís, antes se descarga un respaldo cifrado.\n\n' : '';
      var escrito = window.prompt(aviso + 'Se van a borrar ' + total + ' relevamientos de este dispositivo. Para confirmar, escribí ' + palabra);
      if (escrito === null) return;
      if (escrito.trim().toUpperCase() !== palabra) { toast('No se borró nada (no escribiste ' + palabra + ')'); return; }
      // Red de seguridad: si hay algo sin copia en la planilla, antes se descarga un respaldo cifrado.
      (pend && aj.clave ? respaldoCifrado() : Promise.resolve('')).then(function () {
        return DB.borrarTodos();
      }).then(function () {
        estado.registros = []; estado.actual = null;
        aj.ultimaSync = ''; aj.ultimoPaquete = ''; aj.ultimaHuella = '';
        anotar('Borrado total', total + ' relevamientos (' + pend + ' sin copia en la planilla)');
        return guardarAjustes();
      }).then(function () { toast('Se borraron los datos de este dispositivo'); ir('#/jornada'); })
        .catch(function (e) { toast('No se borró nada: ' + e.message); });
    },
    'instalar': function () {
      if (!estado.instalar) return;
      estado.instalar.prompt();
      estado.instalar.userChoice.then(function () { estado.instalar = null; render(); });
    }
  };

  /* ---------- Consentimiento, grabación y entrevista (versión de prueba 1.5) ---------- */
  function minSeg() { return Gr.reloj(Gr.segundos()); }

  function barraGrabacion() {
    var r = estado.actual;
    if (!r || Gr.regId() !== r.id) return '';
    var st = Gr.estado();
    if (st === 'cortado') {
      return '<div class="barra-grabacion cortada" role="alert"><span>La grabación se cortó</span>' +
        '<button type="button" class="btn chico" data-accion="rec-reanudar">Seguir grabando</button></div>';
    }
    return '<div class="barra-grabacion' + (st === 'pausado' ? ' pausada' : '') + '" role="status"><span class="punto-grabando"></span>' +
      '<span style="flex:1">' + (st === 'pausado' ? 'En pausa · ' : 'Grabando · ') + '<span class="mono" id="rec-tiempo">' + minSeg() + '</span></span>' +
      '<button type="button" class="btn chico" data-accion="' + (st === 'pausado' ? 'rec-reanudar' : 'rec-pausa') + '">' + (st === 'pausado' ? 'Seguir' : 'Pausa') + '</button></div>';
  }
  setInterval(function () { var el = document.getElementById('rec-tiempo'); if (el && Gr.estado() === 'grabando') el.textContent = minSeg(); }, 1000);
  Gr.alCambiar(function () { refrescar(); });

  /* Anota en qué minuto de la grabación empieza cada parte (para encontrarla al transcribir). */
  function nombreParte(rt) {
    if (rt.vista === 'participante') return 'Identificación';
    if (rt.vista === 'socio') return 'Socio ' + rt.n + ' ' + (SECC[rt.n - 1] ? SECC[rt.n - 1].titulo : '');
    if (rt.vista === 'bio') return 'Biológica ' + rt.n;
    if (rt.vista === 'final') return 'Antes de terminar';
    return '';
  }
  function marcarParte() {
    var r = estado.actual, rt = estado.ruta;
    if (!r || Gr.regId() !== r.id || Gr.estado() === 'inactivo') return;
    var parte = nombreParte(rt);
    if (!parte) return;
    r.entrevista = r.entrevista || {};
    var m = r.entrevista.marcas = r.entrevista.marcas || [];
    if (m.some(function (x) { return x.parte === parte; })) return;
    m.push({ parte: parte, t: minSeg() });
    tocar();
  }

  function cuadroProfundizar(e) {
    var r = estado.actual, t = ((r.entrevista || {}).tildadas || {})[e.id] || [], abierto = !!estado.profAbierto[e.id];
    var html = '<div class="profundizar"><button type="button" class="prof-cabeza" data-accion="prof-abrir" data-valor="' + e.id + '" aria-expanded="' + abierto + '">' +
      '<span class="prof-titulo">Para profundizar · ' + esc(e.titulo) + '</span><span class="prof-cuenta">' + t.length + ' de ' + e.preguntas.length +
      '<span class="prof-flecha" aria-hidden="true">' + (abierto ? '▲' : '▼') + '</span></span></button>';
    if (abierto) {
      html += e.preguntas.map(function (q, i) {
        var on = t.indexOf(i) >= 0;
        return '<button type="button" class="prof-fila" aria-pressed="' + on + '" data-accion="prof-tilde" data-campo="' + e.id + '" data-valor="' + i + '">' +
          '<span class="prof-caja" aria-hidden="true">' + (on ? '✓' : '') + '</span><span>' + esc(q) + '</span></button>';
      }).join('') + '<button type="button" class="btn chico" data-accion="prof-abrir" data-valor="' + e.id + '">Cerrar</button>';
    }
    return html + '</div>';
  }

  /* En «Antes de terminar»: por tema, solo las preguntas que todavía no se tildaron; se tildan ahí mismo. */
  function cuadroPendientes(e) {
    var r = estado.actual, t = ((r.entrevista || {}).tildadas || {})[e.id] || [];
    var faltan = e.preguntas.map(function (q, i) { return { q: q, i: i }; }).filter(function (x) { return t.indexOf(x.i) < 0; });
    var reciente = (estado.tildadoFinal || {})[e.id] || [];
    if (!faltan.length && !reciente.length) return '';
    var abierto = !!estado.pendAbierto[e.id];
    var html = '<div class="profundizar pendientes"><button type="button" class="prof-cabeza" data-accion="pend-abrir" data-valor="' + e.id + '" aria-expanded="' + abierto + '">' +
      '<span class="prof-titulo">' + esc(e.titulo) + '</span><span class="prof-cuenta">' + (faltan.length ? 'faltan ' + faltan.length : 'completo') +
      '<span class="prof-flecha" aria-hidden="true">' + (abierto ? '▲' : '▼') + '</span></span></button>';
    if (abierto) {
      // Las que se tildan acá quedan a la vista (tildadas) hasta cerrar el tema, por si hay que destildar
      var lista = e.preguntas.map(function (q, i) { return { q: q, i: i, on: t.indexOf(i) >= 0 }; })
        .filter(function (x) { return !x.on || reciente.indexOf(x.i) >= 0; });
      html += lista.map(function (x) {
        return '<button type="button" class="prof-fila" aria-pressed="' + x.on + '" data-accion="pend-tilde" data-campo="' + e.id + '" data-valor="' + x.i + '">' +
          '<span class="prof-caja" aria-hidden="true">' + (x.on ? '✓' : '') + '</span><span>' + esc(x.q) + '</span></button>';
      }).join('') + '<button type="button" class="btn chico" data-accion="pend-abrir" data-valor="' + e.id + '">Cerrar</button>';
    }
    return html + '</div>';
  }

  REGIONES.grab = barraGrabacion;
  ENT.forEach(function (e) { REGIONES['pend-' + e.id] = function () { return cuadroPendientes(e); }; });
  ENT.forEach(function (e) { REGIONES['prof-' + e.id] = function () { return cuadroProfundizar(e); }; });

  function vConsentimiento() {
    var r = estado.actual, c = r.consent || {};
    var puede = c.participa === 'Sí', graba = c.grabacion === 'Sí';
    var html = '<main class="pantalla">' + barra('#/jornada', 'Antes de empezar', 'Consentimiento') +
      '<section class="tarjeta"><h2 class="seccion">Para leerle al camionero</h2><ul class="lista-consentimiento">' +
      (CFG.consentimientoResumen || ['Proyecto de la UNJu sobre riesgo cardiovascular en camioneros del corredor.',
        'Encuesta, medidas del cuerpo, presión y una punción en el dedo.', 'Puede negarse o retirarse en cualquier momento, sin costo ni pago.',
        'Todo es confidencial.']).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      (CFG.consentimientoTexto ? '<details><summary>Ver el texto completo</summary><p style="white-space:pre-line">' + esc(CFG.consentimientoTexto) + '</p></details>' : '') + '</section>' +
      '<fieldset class="pregunta"><legend>¿Acepta participar (encuesta y mediciones)?</legend>' + grupoOpciones('consent.participa', ['Sí', 'No'], c.participa, false, 'grilla') + '</fieldset>';
    if (c.participa === 'No') {
      html += '<p class="tarjeta aviso" style="margin:0">Sin consentimiento no se hace el relevamiento.</p>' +
        '<div class="empujar-abajo" style="display:flex;flex-direction:column;gap:10px"><button type="button" class="btn" data-accion="descartar">Volver a la jornada</button></div></main>';
      return html;
    }
    html += '<fieldset class="pregunta"><legend>¿Acepta la punción en el dedo?</legend>' + grupoOpciones('consent.puncion', ['Sí', 'No'], c.puncion, false, 'grilla') + '</fieldset>' +
      '<fieldset class="pregunta"><legend>¿Acepta que se grabe la conversación?</legend>' + grupoOpciones('consent.grabacion', ['Sí', 'No'], c.grabacion, false, 'grilla') + '</fieldset>' +
      '<div class="casilla-linea grande"><input type="checkbox" id="firma" data-campo="consent.firma"' + (c.firma ? ' checked' : '') + '><label for="firma">Firmó en papel (firma o impresión dactiloscópica).</label></div>';
    var listo = puede && c.puncion && c.grabacion;
    var yaGraba = Gr.regId() === r.id && Gr.estado() !== 'inactivo';
    html += '<div class="empujar-abajo" style="display:flex;flex-direction:column;gap:8px">';
    if (graba && !yaGraba && !Gr.soportado()) html += '<p class="ayuda">Este celular no permite grabar desde la app: usá la grabadora del celular.</p>';
    html += '<button type="button" class="btn primario" data-accion="consent-seguir"' + (listo ? '' : ' disabled') + '>' +
      (graba && !yaGraba && Gr.soportado() ? '<span class="punto-grabando"></span>Iniciar grabación y continuar' : 'Continuar') + '</button>' +
      (listo ? '' : '<span class="ayuda" style="text-align:center">Respondé las tres preguntas para continuar.</span>') +
      (graba ? '<span class="ayuda" style="text-align:center">Mientras se graba, no bloquees la pantalla ni cambies de app.</span>' : '') + '</div></main>';
    return html;
  }

  function vFinal() {
    var r = estado.actual, t = (r.entrevista || {}).tildadas || {};
    var pend = ENT.map(function (e) {
      return { e: e, faltan: e.preguntas.length - (t[e.id] || []).length };
    }).filter(function (x) { return x.faltan > 0; });
    var graba = Gr.regId() === r.id && Gr.estado() !== 'inactivo';
    return '<main class="pantalla">' + region('grab', barraGrabacion()) + barra('#/bio/' + r.id + '/3', 'Después de la biológica', 'Antes de terminar', placaChica(r)) +
      (pend.length ? '<h2 class="seccion" style="margin:4px 0 0">Quedaron sin tocar (si da el tiempo)</h2>' +
        '<span class="ayuda" style="margin-top:-8px">Tocá un tema para ver solo las preguntas que faltan y tildalas acá mismo.</span>' +
        pend.map(function (x) { return region('pend-' + x.e.id, cuadroPendientes(x.e)); }).join('') : '') +
      '<div class="empujar-abajo" style="display:flex;flex-direction:column;gap:10px">' +
      '<button type="button" class="btn primario" data-accion="ir-resultados">' + (graba ? '<span class="punto-detener"></span>Detener grabación y ver resultados' : 'Ver resultados') + '</button></div></main>';
  }

  function tamano(b) { return b >= 1048576 ? (Math.round(b / 104857.6) / 10).toString().replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function vAudios() {
    var lista = estado.audios.slice().sort(function (a, b) { return (b.creado || '').localeCompare(a.creado || ''); });
    var sinCopiar = lista.filter(function (a) { return !a.copiado; }), copiados = lista.length - sinCopiar.length;
    var total = lista.reduce(function (s, a) { return s + (a.bytes || 0); }, 0);
    return '<main class="pantalla">' + barra('#/cierre', 'Cierre de jornada', 'Audios del día') +
      '<div class="tarjeta"><div class="cifras"><div class="cifra"><span class="rotulo">Grabaciones</span><span class="numero">' + lista.length + '</span></div>' +
      '<div class="cifra"><span class="rotulo">Ocupan</span><span class="numero" style="font-size:34px">' + tamano(total) + '</span></div></div></div>' +
      (lista.length ? '<div class="lista">' + lista.map(function (a) {
        return '<div class="registro"><span class="arriba"><span class="cod">' + esc(a.nombre.replace(/\.(webm|m4a)$/, '')) + '</span><span class="hora">' +
          Math.max(1, Math.round((a.segundos || 0) / 60)) + ' min · ' + tamano(a.bytes || 0) + '</span></span><span class="abajo">' +
          (a.copiado ? '<span class="estado sinc">' + ico('check', 16) + 'Copiado a la PC</span>' : '<span class="estado pend"><span class="punto-pendiente"></span>Solo en el celular</span>') +
          '</span></div>';
      }).join('') + '</div>' : '<div class="vacio">Todavía no hay grabaciones.</div>') +
      '<span class="ayuda">Cada audio lleva el código de su encuesta. Al tocar «Pasar» se abre para compartirlo (Drive, correo, WhatsApp) o se guarda en este dispositivo; desde ahí pasalo a la computadora del equipo y confirmá acá cuando ya esté copiado.</span>' +
      '<div class="empujar-abajo" style="display:flex;flex-direction:column;gap:10px">' +
      '<button type="button" class="btn primario" data-accion="audios-pasar"' + (sinCopiar.length ? '' : ' disabled') + '>' + ico('bajar', 22) + 'Pasar ' + sinCopiar.length + (sinCopiar.length === 1 ? ' audio' : ' audios') + '</button>' +
      '<button type="button" class="btn" data-accion="audios-liberar"' + (copiados ? '' : ' disabled') + '>Liberar espacio (borrar ' + copiados + (copiados === 1 ? ' ya copiado' : ' ya copiados') + ')</button>' +
      '<a class="btn azul-claro" href="#/jornada">Volver a la jornada</a></div></main>';
  }

  function cargarAudios() {
    return DB.audios().then(function (l) { estado.audios = (l || []).map(function (a) { return a; }); }).catch(function () { estado.audios = []; });
  }

  function nombreAudio(r) { return (r && r.codigo ? r.codigo : 'sin-codigo-' + String(r ? r.id : '').slice(0, 8)) + '_' + (r ? r.fecha : hoy()); }
  Gr.nombrePara(function (regId) { return nombreAudio(estado.registros.find(function (x) { return x.id === regId; }) || estado.actual); });
  function detenerGrabacion(r) {
    return Gr.detener(nombreAudio(r)).then(function (a) {
      if (!a) return;
      r.audio = r.audio || { archivos: [], segundos: 0 };
      if (r.audio.archivos.indexOf(a.nombre) < 0) r.audio.archivos.push(a.nombre);
      r.audio.segundos = (r.audio.segundos || 0) + (a.segundosTotales || a.segundos || 0);
      tocar();
      anotar('Grabación guardada', (r.participante_id || 'sin ID') + ' · ' + Math.max(1, Math.round((a.segundosTotales || a.segundos) / 60)) + ' min');
      return cargarAudios();
    });
  }

  /* Respaldo cifrado de todo lo que hay en el dispositivo. Devuelve la huella del archivo. */
  function respaldoCifrado() {
    var aj = estado.ajustes;
    if (!aj.clave) return Promise.reject(new Error('falta la clave del equipo en Ajustes'));
    if (!estado.registros.length) { toast('No hay relevamientos para respaldar'); return Promise.resolve(''); }
    var d = new Date(), nombre = 'respaldo_' + aj.equipo + aj.dispositivo + '_' + hoy() + '_' + dos(d.getHours()) + dos(d.getMinutes()) + '.txt', texto = '';
    return S.armarPaquete(estado.registros, { equipo: aj.equipo, dispositivo: aj.dispositivo }, aj.clave)
      .then(function (txt) { texto = txt; return S.huella(txt); })
      .then(function (h) {
        S.descargar(nombre, texto, 'text/plain');
        anotar('Respaldo cifrado', nombre + ' · ' + estado.registros.length + ' relevamientos · huella ' + h);
        return h;
      });
  }

  /* ---------- eventos ---------- */
  raizApp.addEventListener('click', function (e) {
    var b = e.target.closest('[data-accion]');
    if (!b || !raizApp.contains(b) || b.disabled) return;
    var fn = ACCIONES[b.dataset.accion];
    if (fn) { e.preventDefault(); fn(b, e); }
  });

  raizApp.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset.buscar) { estado.buscar = el.value; refrescar(); return; }
    if (!el.dataset.campo || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    var v = el.value;
    if (el.dataset.campo.indexOf('aj.') === 0 && (el.dataset.campo === 'aj.ordenDesde' || el.dataset.campo === 'aj.ordenHasta')) v = v.replace(/\D/g, '');
    if (el.dataset.campo === 'aj.url' || el.dataset.campo === 'aj.clave') v = v.trim(); // evita espacios pegados por error
    if (el.dataset.campo === 'reg.edad' || el.dataset.campo === 'reg.cp' || el.dataset.campo === 'reg.orden') {
      var limpio = v.replace(/\D/g, '');
      if (limpio !== v) { el.value = limpio; v = limpio; }
    }
    asignar(el.dataset.campo, v.trim() === '' ? '' : v);
    if (el.dataset.min !== undefined) {
      var err = mensajeRango(v, el.dataset.min === '' ? null : Number(el.dataset.min), el.dataset.max === '' ? null : Number(el.dataset.max));
      var caja = el.closest('.con-unidad'), ayuda = document.getElementById(el.id + '-ayuda');
      if (caja) caja.classList.toggle('invalido', !!err);
      if (ayuda) { ayuda.textContent = err || el.dataset.ayuda || ''; ayuda.classList.toggle('error', !!err); }
    }
    if (el.dataset.campo === 'bio.g_resultado_mgdl' && !valor('bio.g_hora_medicion')) {
      asignar('bio.g_hora_medicion', horaAhora());
      var hm = document.getElementById('bio-g_hora_medicion'); if (hm) hm.value = valor('bio.g_hora_medicion');
    }
    if (el.dataset.refrescar) refrescar();
  });

  raizApp.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'archivos-paquete') { importarArchivos(el.files); el.value = ''; return; }
    if (!el.dataset.campo) return;
    if (el.type === 'checkbox') { asignar(el.dataset.campo, el.checked); if (!estado.actual || ['participante', 'consentimiento'].indexOf(estado.ruta.vista) < 0) render(); return; }
    if (el.tagName === 'SELECT') {
      var ruta = el.dataset.campo, id = ruta.split('.')[1], def = DEF[id] || {}, antes = valor(ruta);
      if (def.detalles && antes && def.detalles[antes] && antes !== el.value) asignar('socio.' + def.detalles[antes].id, '');
      asignar(ruta, el.value);
      render();
    }
  });

  function importarArchivos(lista) {
    var archivos = Array.prototype.slice.call(lista || []);
    estado.importacion = [];
    archivos.reduce(function (cadena, archivo) {
      return cadena.then(function () {
        var hu = '';
        return archivo.text().then(function (txt) {
          return S.huella(txt).then(function (h) { hu = h; return S.abrirPaquete(txt, estado.ajustes.clave); });
        })
          .then(function (paq) {
            var res = S.unir(estado.registros, paq.registros);
            return DB.guardarVarios(res.aGuardar).then(function () {
              res.aGuardar.forEach(function (r) {
                var i = estado.registros.findIndex(function (x) { return x.id === r.id; });
                if (i >= 0) estado.registros[i] = r; else estado.registros.push(r);
              });
              estado.importacion.push({ nombre: archivo.name, nuevos: res.nuevos, actualizados: res.actualizados, iguales: res.iguales,
                descartados: res.descartados, huella: hu });
              anotar('Paquete importado', archivo.name.slice(0, 60) + ' · huella ' + hu + ' · ' + res.nuevos + ' nuevos, ' + res.actualizados +
                ' actualizados, ' + res.iguales + ' iguales' + (res.descartados ? ', ' + res.descartados + ' descartados' : ''));
            });
          })
          .catch(function (e) {
            estado.importacion.push({ nombre: archivo.name, error: e.message + (hu ? ' (huella ' + hu + ')' : '') });
            anotar('Paquete rechazado', archivo.name.slice(0, 60) + (hu ? ' · huella ' + hu : '') + ' · ' + String(e.message).slice(0, 80));
          })
          .then(refrescar);
      });
    }, Promise.resolve());
  }

  /* ---------- inicio ---------- */
  function iniciar() {
    if (!window.indexedDB) { raizApp.innerHTML = '<main class="pantalla"><p>Este navegador no permite guardar datos. Usá Chrome actualizado.</p></main>'; return; }
    DB.leerAjuste('ajustes').then(function (aj) {
      estado.ajustes = Object.assign({}, AJUSTES_BASE, aj || {});
      return DB.leerAjuste('bitacora');
    }).then(function (b) {
      estado.bitacora = Array.isArray(b) ? b : [];
      return DB.todos();
    }).then(function (regs) {
      estado.registros = regs || [];
      return Gr.recuperar(function (regId) { var x = estado.registros.find(function (y) { return y.id === regId; }); return x ? nombreAudio(x) : null; }).then(function (rec) {
        // Grabaciones interrumpidas (la app se cerró de golpe): se agregan a su relevamiento
        rec.forEach(function (a) {
          var r = estado.registros.find(function (x) { return x.id === a.regId; });
          if (!r) return;
          r.audio = r.audio || { archivos: [], segundos: 0 };
          if (r.audio.archivos.indexOf(a.nombre) < 0) { r.audio.archivos.push(a.nombre); r.audio.segundos = (r.audio.segundos || 0) + a.segundos; }
          r.modificado = ahoraISO(); DB.guardar(r);
          anotar('Grabación recuperada', r.participante_id || 'sin ID');
        });
      }).catch(function () {}).then(cargarAudios);
    }).then(function () {
      window.addEventListener('hashchange', alCambiarRuta);
      window.addEventListener('online', function () { estado.online = true; render(); });
      window.addEventListener('offline', function () { estado.online = false; render(); });
      window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); estado.instalar = e; render(); });
      window.addEventListener('pagehide', guardarActual);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') guardarActual(); });
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(function (p) { estado.persistente = p; }).catch(function () {});
      }
      if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        var habiaVersion = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (habiaVersion) toast('Se descargó una versión nueva de la app: cerrala y volvé a abrirla.');
        });
        navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(VERSION_APP)).catch(function () {});
      }
      return alCambiarRuta();
    }).catch(function (e) {
      raizApp.innerHTML = '<main class="pantalla"><p>No se pudo abrir el almacenamiento del dispositivo: ' + esc(e && e.message) + '</p></main>';
    });
  }
  iniciar();
})();
