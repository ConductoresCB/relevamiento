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
    sinSincronizar: 'Sin sincronizar', nuevoRelevamiento: 'Nuevo relevamiento', buscar: 'Buscar por código, ID o celular',
    relevamientosHoy: 'Relevamientos de hoy', cerrarJornada: 'Cerrar jornada y sincronizar', nuevoParticipante: 'Nuevo participante',
    identificacion: 'Identificación', codigoIdentificacion: 'Código de identificación',
    participoAntes: '¿Participó en un relevamiento anterior?', datosContacto: 'Datos de contacto',
    consentimiento: 'Leyó y aceptó el consentimiento informado.', comparteApp: 'Acepta que sus resultados se vean en la app de camioneros.',
    continuarSocio: 'Continuar con sociodemográfica', irDirectoBio: 'Ir directo a la biológica', cejaSocio: 'Paso 2 · Sociodemográfica',
    irABio: 'Ir a biológica', cejaBio: 'Paso 3 · Biológica', verResultados: 'Ver resultados', cejaResultados: 'Paso 4 · Cierre',
    resultados: 'Resultados', guardarYVolver: 'Guardar y volver a la jornada', cierreJornada: 'Cierre de jornada',
    sincronizarAhora: 'Sincronizar ahora', compartirPaquete: 'Compartir paquete del día', descargarCsv: 'Descargar CSV para Excel',
    criterioDerivacion: 'Criterio de derivación: [a definir por el equipo]',
    responsable: 'la administradora', seccionAdministracion: 'Administración y respaldo', cejaImportar: 'Administración',
    encuestadoresEntrevista: 'Encuestador/es de esta entrevista',
    ayudaEncuestadores: 'Si son varios, escribí los nombres separados por «y».',
    buscarParticipante: 'Buscar al participante',
    ayudaBuscarParticipante: 'Alcanza con una parte: los últimos números del código (por ejemplo 44-4600), el número del ID (por ejemplo 3 o A1-0003) o los últimos 4 números del celular.',
    idParaEntregar: 'Anotáselo o pedile que le saque una foto: con este ID se lo encuentra rápido en la próxima visita.'
  }, CFG.textos || {});
  function mayuscula(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  var PROYECTO = Object.assign({ nombre: 'Relevamiento', lugar: 'Corredor Bioceánico · Jujuy' }, CFG.proyecto || {});
  var PASOS = CFG.pasos || ['Identificación', 'Socio', 'Biológica', 'Resultados'];
  var RANGOS = Object.assign({ edad: [18, 99], peso: [35, 250], altura: [1.2, 2.2], perimetro: [50, 200], pas: [70, 260], glucemia: [20, 600] }, CFG.rangos || {});
  var RECOMENDACION = Object.assign({ Bajo: 'Mantener hábitos saludables.', Moderado: 'Evaluar si necesita tratamiento preventivo.',
    Alto: 'Se recomiendan intervenciones médicas.' }, CFG.recomendacionFramingham || {});
  var VERSION_APP = CFG.versionApp || '1.1.0';

  var AJUSTES_BASE = Object.assign({ equipo: 'A', dispositivo: '1', ordenDesde: 1, ordenHasta: 199 }, CFG.ajustesIniciales || {},
    { encuestador: '', puesto: '', url: '', clave: '', contador: 0, ultimaSync: '', ultimoPaquete: '' });

  var estado = { ajustes: null, registros: [], actual: null, ruta: { vista: 'jornada' }, buscar: '', verTodos: false,
    instalar: null, sincronizando: false, mensajeSync: '', mensajeConexion: '', importacion: [],
    online: navigator.onLine, persistente: null, buscarPart: '' };

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
  function fechaCorta(iso) { if (!iso) return '—'; var p = iso.slice(0, 10).split('-'); return p[2] + '/' + p[1]; }
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
    if (grupo === 'reg' && (clave === 'orden' || clave === 'edad' || clave === 'cp')) {
      reg.codigo = R.codigo(reg.orden, reg.edad, reg.cp);
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
      var conId = ['participante', 'socio', 'bio', 'resultados'].indexOf(r.vista) >= 0;
      if (!conId) { estado.actual = null; render(true); return; }
      if (estado.actual && estado.actual.id === r.id) { render(true); return; }
      var enMemoria = estado.registros.find(function (x) { return x.id === r.id; });
      if (enMemoria) { estado.actual = enMemoria; render(true); return; }
      return DB.obtener(r.id).then(function (reg) {
        if (!reg) { ir('#/jornada'); return; }
        estado.actual = reg; render(true);
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
    if (v === 'participante') html = vParticipante();
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
      clase += opciones.length === 2 ? ' grilla-2' : opciones.length === 3 ? ' grilla-3' : opciones.length === 6 ? ' grilla-3' : ' en-linea';
    }
    return '<div class="' + clase + '">' + opciones.map(function (o) {
      return botonOpcion(ruta, o, sel.indexOf(o) >= 0, multiple, conMarca);
    }).join('') + '</div>';
  }

  function campoTexto(ruta, etiqueta, val, extra) {
    var id = ruta.replace('.', '-');
    extra = extra || {};
    var control = extra.area
      ? '<textarea class="entrada" id="' + id + '" data-campo="' + ruta + '" rows="3">' + esc(val) + '</textarea>'
      : '<input class="entrada' + (extra.mono ? ' mono' : '') + '" id="' + id + '" type="' + (extra.tipo || 'text') + '" data-campo="' + ruta + '" value="' + esc(val) + '"' +
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
    return '<div class="pildoras">' + p + '</div>';
  }

  function vJornada() {
    var aj = estado.ajustes, f = hoy();
    var deHoy = estado.registros.filter(function (r) { return r.fecha === f; });
    var pend = estado.registros.filter(function (r) { return r.consentimiento && R.pendiente(r); });
    var falta = !aj.encuestador || !aj.url;
    var html = '<main class="pantalla">' +
      '<div class="cabecera"><div style="display:flex;flex-direction:column;gap:2px"><span class="ceja">' + esc(PROYECTO.lugar) + '</span>' +
      '<h1 class="titulo grande">' + esc(T.jornada) + ' ' + fechaCorta(f) + '</h1></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      (estado.online ? '<span class="chip-red con">' + ico('senal', 18) + esc(T.conSenal) + '</span>' : '<span class="chip-red sin">' + ico('sinSenal', 18) + esc(T.sinSenal) + '</span>') +
      '<a class="icono-btn" href="#/ajustes" aria-label="Ajustes del dispositivo">' + ico('ajustes', 20) + '</a></div></div>' +
      '<div class="linea-dispositivo">' + ico('celu', 18) + '<span>Equipo ' + esc(aj.equipo) + ' · Dispositivo ' + esc(aj.dispositivo) +
      ' · códigos ' + R.pad(aj.ordenDesde, 3) + '–' + R.pad(aj.ordenHasta, 3) + (aj.puesto ? ' · ' + esc(aj.puesto) : '') + (aj.encuestador ? ' · ' + esc(aj.encuestador) : '') + '</span></div>';

    if (falta) {
      html += '<div class="tarjeta aviso"><p><b>Falta configurar este dispositivo.</b> Cargá encuestador/a, equipo y la dirección de la planilla para poder sincronizar.</p>' +
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
      '<input id="buscar" type="search" data-buscar="1" placeholder="' + esc(T.buscar) + '" value="' + esc(estado.buscar) + '" style="font-family:var(--f-texto);font-size:16px"></div></div>' +
      region('lista', listaRegistros()) +
      '<a class="btn azul-claro empujar-abajo" href="#/cierre">' + ico('nube', 22) + esc(T.cerrarJornada) + '</a></main>';
    return html;
  }

  REGIONES.lista = listaRegistros;
  function listaRegistros() {
    var f = hoy(), q = estado.buscar.trim();
    var lista = estado.registros.slice();
    if (q) {
      lista = lista.filter(function (r) { return coincideParticipante(r, q); });
    } else if (!estado.verTodos) {
      lista = lista.filter(function (r) { return r.fecha === f; });
    }
    lista.sort(function (a, b) { return (b.creado || '').localeCompare(a.creado || ''); });
    var titulo = q ? 'Resultados de la búsqueda' : estado.verTodos ? 'Todos los relevamientos' : T.relevamientosHoy;
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="ceja azul">' + titulo + '</span>' +
      (q ? '' : '<button type="button" class="btn chico" data-accion="ver-todos" style="border:0;background:none;color:var(--azul);padding:0 4px">' + (estado.verTodos ? 'Solo hoy' : 'Ver todos (' + estado.registros.length + ')') + '</button>') + '</div>';
    if (!lista.length) return html + '<div class="vacio">' + (q ? 'No hay coincidencias en este dispositivo.' : 'Todavía no hay relevamientos. Tocá «Nuevo relevamiento» para empezar.') + '</div>';
    return html + '<div class="lista">' + lista.slice(0, 60).map(function (r) {
      return '<a class="registro" href="#/participante/' + r.id + '" style="text-decoration:none;color:inherit">' +
        '<span class="arriba"><span class="cod">' + esc(r.codigo || 'Sin código') + '</span><span class="hora">' +
        (r.fecha === f ? esc(r.hora_inicio || '') : fechaCorta(r.fecha)) + (r.participante_id ? ' · ' + esc(r.participante_id) : '') + '</span></span>' +
        '<span class="abajo">' + pildoras(r) + estadoRegistro(r) + '</span></a>';
    }).join('') + '</div>';
  }

  /* ---------- Participante ---------- */
  function siguienteOrden() {
    var aj = estado.ajustes, d = Number(aj.ordenDesde) || 1, h = Number(aj.ordenHasta) || 999;
    var usados = estado.registros.filter(function (r) {
      return r.equipo === aj.equipo && String(r.dispositivo) === String(aj.dispositivo);
    }).map(function (r) { return Number(r.orden); }).filter(function (n) { return n >= d && n <= h; });
    return usados.length ? Math.min(h, Math.max.apply(null, usados) + 1) : d;
  }

  function erroresIdentificacion(r) {
    var e = [];
    var o = num(r.orden), ed = num(r.edad);
    if (o === null || o < 1 || o > 999 || o % 1) e.push('El número de orden debe ser de 1 a 999.');
    if (ed === null || ed < RANGOS.edad[0] || ed > RANGOS.edad[1] || ed % 1) e.push('La edad debe ser un número entero entre ' + RANGOS.edad[0] + ' y ' + RANGOS.edad[1] + '.');
    if (!/^\d{4}$/.test(String(r.cp || ''))) e.push('El código postal debe tener 4 dígitos.');
    if (r.codigo && estado.registros.some(function (x) { return x.id !== r.id && x.codigo === r.codigo; })) e.push('Ese código ya existe en este dispositivo.');
    if (!r.consentimiento) e.push('Falta registrar el consentimiento informado.');
    return e;
  }

  REGIONES.codigo = function () {
    var r = estado.actual; if (!r) return '';
    var dup = r.codigo && estado.registros.some(function (x) { return x.id !== r.id && x.codigo === r.codigo; });
    return '<div class="placa"><span class="valor">' + esc(r.codigo || '___-__-____') + '</span><span class="partes">orden · edad · código postal</span></div>' +
      (dup ? '<span class="error-linea">' + ico('alerta', 18) + 'Ese código ya existe en este dispositivo</span>'
        : r.codigo ? '<span class="ok-linea">' + ico('check', 18) + 'Código libre en este dispositivo</span>' : '<span class="ayuda">Completá orden, edad y código postal.</span>');
  };

  /* Búsqueda tolerante: partes del código (con o sin guiones), número del ID o últimos dígitos del celular. */
  function coincideParticipante(x, q) {
    var qn = q.toLowerCase().replace(/[^a-z0-9]/g, ''), qd = q.replace(/\D/g, '');
    if (!qn) return false;
    var id = (x.participante_id || '').toLowerCase(), idn = id.replace(/[^a-z0-9]/g, '');
    var numId = id ? id.split('-').pop().replace(/^0+/, '') : '';
    var codDig = (x.codigo || '').replace(/\D/g, '');
    var cel = ((x.contacto && x.contacto.celular) || '').replace(/\D/g, '');
    if (/[a-z]/.test(qn)) {                                              // con letra: A1-0003, a10003, A1-3, a1 3
      var partes = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      if (partes.length === 2 && id.split('-')[0] === partes[0] && partes[1].replace(/^0+/, '') === numId) return true;
      return idn.indexOf(qn) >= 0;
    }
    if (numId && qd.replace(/^0+/, '') === numId) return true;           // solo el número del ID: 3 o 0003
    if (qd.length >= 2 && codDig.indexOf(qd) >= 0) return true;          // partes del código: 4600, 44-4600
    if (qd.length >= 4 && cel.slice(-qd.length) === qd) return true;     // últimos números del celular
    return false;
  }

  REGIONES.buscarPart = function () {
    var r = estado.actual, q = estado.buscarPart.trim();
    if (!q) return '';
    var vistos = {}, res = [];
    estado.registros.slice().sort(function (a, b) { return (b.creado || '').localeCompare(a.creado || ''); }).forEach(function (x) {
      if (x.id === r.id || !x.participante_id || vistos[x.participante_id]) return;
      if (coincideParticipante(x, q)) { vistos[x.participante_id] = true; res.push(x); }
    });
    if (!res.length) return '<span class="ayuda">No aparece en este celular. Si tiene su ID de una visita anterior (por ejemplo en una foto), escribilo abajo.</span>';
    return '<div class="lista">' + res.slice(0, 8).map(function (x) {
      return '<button type="button" class="registro" data-accion="vincular" data-valor="' + esc(x.id) + '"><span class="arriba"><span class="cod">' + esc(x.participante_id) +
        '</span><span class="hora">' + fechaCorta(x.fecha) + '</span></span><span class="ayuda">Código ' + esc(x.codigo) + ' · ' + esc(x.edad || '') + ' años' +
        (x.encuestador ? ' · ' + esc(x.encuestador) : '') + (x.puesto ? ' · ' + esc(x.puesto) : '') + '</span><span class="ayuda" style="font-weight:700;color:var(--azul)">Tocá para vincular</span></button>';
    }).join('') + '</div>';
  };

  function vParticipante() {
    var r = estado.actual, aj = estado.ajustes;
    var nuevo = !r.codigo && !r.modificado;
    var html = '<main class="pantalla">' + barra('#/jornada', 'Paso 1 de 4', nuevo ? T.nuevoParticipante : T.identificacion) +
      pasosRelevamiento(r, 0) +
      '<section style="display:flex;flex-direction:column;gap:8px"><h2 class="seccion">' + esc(T.codigoIdentificacion) + '</h2>' +
      '<div class="grilla-campos tres">' +
      '<div class="campo"><label for="reg-orden">N° de orden</label><input class="entrada mono centro" id="reg-orden" inputmode="numeric" autocomplete="off" data-campo="reg.orden" data-refrescar="1" value="' + esc(r.orden) + '"></div>' +
      '<div class="campo"><label for="reg-edad">Edad</label><input class="entrada mono centro" id="reg-edad" inputmode="numeric" autocomplete="off" maxlength="2" data-campo="reg.edad" data-refrescar="1" value="' + esc(r.edad) + '"></div>' +
      '<div class="campo"><label for="reg-cp">Cód. postal</label><input class="entrada mono centro" id="reg-cp" inputmode="numeric" autocomplete="off" maxlength="4" data-campo="reg.cp" data-refrescar="1" value="' + esc(r.cp) + '"></div>' +
      '</div><span class="ayuda">El orden se sugiere solo: siguiente número libre del rango de este dispositivo (' + R.pad(aj.ordenDesde, 3) + '–' + R.pad(aj.ordenHasta, 3) + ').</span>' +
      region('codigo', REGIONES.codigo()) + '</section>';

    html += campoTexto('reg.encuestador', T.encuestadoresEntrevista, r.encuestador, { ayuda: T.ayudaEncuestadores, placeholder: 'Nombre y apellido' });

    html += '<fieldset class="pregunta"><legend>' + esc(T.participoAntes) + '</legend>' +
      grupoOpciones('reg.previo', ['Sí', 'No'], r.previo, false, 'grilla') + '</fieldset>';
    if (r.previo === 'Sí') {
      html += '<div class="campo"><label for="buscar-part">' + esc(T.buscarParticipante) + '</label>' +
        '<input class="entrada" id="buscar-part" type="search" data-buscar-part="1" value="' + esc(estado.buscarPart) + '" autocomplete="off" aria-describedby="buscar-part-ayuda">' +
        '<span class="ayuda" id="buscar-part-ayuda">' + esc(T.ayudaBuscarParticipante) + '</span></div>' +
        region('buscarPart', REGIONES.buscarPart()) +
        campoTexto('reg.participante_id', 'ID de participante', r.participante_id, { mono: true, placeholder: 'p. ej. A1-0007' });
    } else {
      html += '<div class="ayuda">ID de participante: <b>' + esc(r.participante_id || 'se asigna al continuar') + '</b></div>';
    }

    html += '<section style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">' +
      '<h2 class="seccion">' + esc(T.datosContacto) + '</h2><span class="ayuda">Se guardan aparte de las respuestas</span></div>' +
      campoTexto('contacto.correo', 'Correo electrónico', (r.contacto || {}).correo, { tipo: 'email', placeholder: 'nombre@correo.com', autocomplete: 'off' }) +
      campoTexto('contacto.celular', 'Celular', (r.contacto || {}).celular, { tipo: 'tel', placeholder: '+54 9 388 …', inputmode: 'tel' }) + '</section>';

    html += '<div class="casilla-linea"><input type="checkbox" id="consentimiento" data-campo="reg.consentimiento"' + (r.consentimiento ? ' checked' : '') + '>' +
      '<label for="consentimiento">' + esc(T.consentimiento) + '</label></div>' +
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
    return '<main class="pantalla">' + barra(anterior, T.cejaSocio, s.titulo) +
      '<div style="display:flex;flex-direction:column;gap:6px">' + region('progresoSocio', REGIONES.progresoSocio()) + '</div>' +
      s.preguntas.map(function (p) { return vPregunta(p, resp); }).join('') +
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
    if (estado.ruta.n === 2) {
      filas += '<div class="calc-fila"><span>Tabaco y diabetes</span><span class="pts">FH ' + pts(fh, 'tabaco') + ' · ' + pts(fh, 'diabetes') + '</span></div>';
    }
    var notas = [];
    if (fr.aplica === false) notas.push('FINDRISK no corresponde: ' + fr.motivo.toLowerCase() + '.');
    if (fh.aplica === false) notas.push('Framingham no corresponde: ' + fh.motivo.toLowerCase() + '.');
    return '<div class="calc"><span class="titulo-calc">' + ico('igual', 18) + 'Calculado automáticamente</span>' + filas +
      '<span class="nota">FR: FINDRISK · FH: Framingham con IMC' + (notas.length ? '. ' + esc(notas.join(' ')) : '') + '</span></div>';
  };

  REGIONES.pieBio = function () {
    var r = estado.actual, c = R.calcular(r), fr = c.findrisk, n = estado.ruta.n;
    var linea1, linea2;
    if (fr.aplica === false) { linea1 = 'FINDRISK no corresponde'; linea2 = fr.motivo; }
    else if (fr.completo) { linea1 = 'FINDRISK <b>' + fr.puntos + ' pts</b>'; linea2 = fr.categoria + ' · ' + fr.probabilidad; }
    else { linea1 = 'FINDRISK parcial <b>' + fr.puntos + ' pts</b>'; linea2 = 'Faltan ' + fr.faltan.length + ' ítems del test'; }
    var siguiente = n < 3 ? '#/bio/' + r.id + '/' + (n + 1) : '#/resultados/' + r.id;
    return '<div class="fila-pie"><div class="resumen-pie"><span>' + linea1 + '</span><span style="color:var(--tinta-2)">' + esc(linea2) + '</span></div>' +
      '<a class="btn primario" style="min-height:56px;font-size:17px;padding:0 22px;flex:none" href="' + siguiente + '">' + (n < 3 ? 'Siguiente' : esc(T.verResultados)) + ico('seguir', 22) + '</a></div>';
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
    var html = '<main class="pantalla">' + barra(volver, T.cejaBio, PASOS_BIO[n - 1], placaChica(r)) +
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
        campoNumero('bio.b_perimetro_cm', 'Perímetro abdominal', b.b_perimetro_cm, { unidad: 'cm', min: RANGOS.perimetro[0], max: RANGOS.perimetro[1], ayuda: 'Sin decimales' }) +
        campoNumero('bio.b_pas_mmhg', 'Presión sistólica', b.b_pas_mmhg, { unidad: 'mmHg', min: RANGOS.pas[0], max: RANGOS.pas[1], ayuda: 'Tres cifras' }) +
        '</div>' + region('calcBio', REGIONES.calcBio());
    } else if (n === 2) {
      html += preguntaBio('b_act_fisica', 'grilla') + preguntaBio('b_fyv_diario', 'grilla') + preguntaBio('b_hta_dx', 'grilla') +
        preguntaBio('b_med_antihta', 'grilla', '<span class="ayuda">Se usa en FINDRISK y en Framingham (no se vuelve a preguntar).</span>') +
        preguntaBio('b_glucosa_previa', 'grilla', '<span class="ayuda">Glucemia alta en algún momento: embarazo, estudios, etc.</span>') +
        preguntaBio('b_antec_fam_dbt', null, '<span class="ayuda">Primer grado: padres, hermanos.</span>') + preguntaBio('b_fuma', 'grilla') +
        region('calcBio', REGIONES.calcBio());
    } else {
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
    var html = '<main class="pantalla">' + barra('#/bio/' + r.id + '/3', T.cejaResultados, T.resultados, placaChica(r)) + pasosRelevamiento(r, 3);
    if (r.participante_id) {
      html += '<section class="tarjeta" style="border:2px solid var(--tinta);align-items:center;text-align:center">' +
        '<h2 class="seccion">ID del participante</h2><span style="font-family:var(--f-mono);font-size:40px;font-weight:500;letter-spacing:.04em">' + esc(r.participante_id) + '</span>' +
        '<span class="ayuda">' + esc(T.idParaEntregar) + '</span></section>';
    }

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
    var pend = estado.registros.filter(function (r) { return r.consentimiento && R.pendiente(r); });
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
          '<a class="btn chico peligro" href="#/participante/' + r.id + '">Revisar</a></div>';
      }).join('') + '</section>';

    var motivo = !aj.url ? 'Falta la dirección de la planilla en Ajustes.' : !estado.online ? 'El dispositivo no tiene señal en este momento.' : '';
    html += '<section class="tarjeta azul"><h2 class="seccion" style="color:var(--azul-osc)">Con señal</h2>' +
      '<p>' + (pend.length ? 'Se envían ' + pend.length + ' relevamientos nuevos o modificados.' : 'No hay relevamientos pendientes de envío.') +
      ' La copia queda en este dispositivo.</p>' + (motivo ? '<p class="ayuda">' + motivo + '</p>' : '') +
      '<button type="button" class="btn azul" data-accion="sincronizar"' + (motivo || estado.sincronizando || !pend.length ? ' disabled' : '') + '>' + ico('nube', 22) +
      (estado.sincronizando ? 'Sincronizando…' : esc(T.sincronizarAhora)) + '</button>' + region('estadoSync', REGIONES.estadoSync()) + '</section>';

    html += '<section class="tarjeta discontinua"><h2 class="seccion" style="color:var(--tinta-2)">Sin señal</h2>' +
      '<p>Generá un archivo ' + (aj.clave ? 'cifrado' : '<b>sin cifrar</b> (falta la clave del equipo)') + ' con lo relevado para mandar por WhatsApp, correo o Drive. ' + esc(mayuscula(T.responsable)) + ' lo importa y se descartan duplicados.</p>' +
      '<button type="button" class="btn" data-accion="paquete">' + ico('compartir', 22) + esc(T.compartirPaquete) + '</button>' +
      '<button type="button" class="btn chico" data-accion="csv">' + ico('bajar', 18) + esc(T.descargarCsv) + '</button></section>' +
      '<span class="ayuda empujar-abajo" style="text-align:center">' +
      (aj.ultimaSync ? 'Última sincronización: ' + fechaCorta(aj.ultimaSync) + ' ' + horaDe(aj.ultimaSync) : 'Este dispositivo todavía no sincronizó') +
      (aj.ultimoPaquete ? ' · último paquete: ' + fechaCorta(aj.ultimoPaquete) + ' ' + horaDe(aj.ultimoPaquete) : '') + '</span></main>';
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
      '<div class="grilla-campos">' + campo('ordenDesde', 'Orden desde', { inputmode: 'numeric' }) + campo('ordenHasta', 'Orden hasta', { inputmode: 'numeric' }) + '</div>' +
      '<span class="ayuda">Si cada integrante usa un solo celular, el N° de dispositivo queda en 1. Cambia solo si la misma persona carga desde un segundo aparato: ahí va 2 y otro rango de orden, para que no se repitan códigos ni IDs.</span>' +
      campo('encuestador', 'Encuestador/a habitual', { placeholder: 'Nombre o iniciales', ayuda: 'Aparece ya escrito en cada entrevista nueva; ahí se puede cambiar.' }) + campo('puesto', 'Puesto o lugar de relevamiento', { placeholder: 'p. ej. Susques, RN 52' }) + '</section>' +
      '<section class="tarjeta"><h2 class="seccion">Planilla de Google</h2>' +
      campoTexto('aj.url', 'Dirección de la aplicación web (Apps Script)', aj.url, { area: true }) +
      campoTexto('aj.clave', 'Clave del equipo', aj.clave, { tipo: 'password', ayuda: 'La misma en todos los dispositivos y en el script. Cifra los paquetes.' }) +
      '<button type="button" class="btn chico" data-accion="probar">' + ico('senal', 18) + 'Probar conexión</button>' + region('conexion', REGIONES.conexion()) + '</section>' +
      '<section class="tarjeta"><h2 class="seccion">' + esc(T.seccionAdministracion) + '</h2>' +
      '<a class="btn chico" href="#/importar">' + ico('subir', 18) + 'Importar paquetes de otros dispositivos</a>' +
      '<a class="btn chico" href="tablero/">' + ico('seguir', 18) + 'Abrir el tablero de análisis</a>' +
      '<button type="button" class="btn chico" data-accion="respaldo">' + ico('bajar', 18) + 'Respaldo completo de este dispositivo</button>' +
      '<button type="button" class="btn chico" data-accion="contactos">' + ico('bajar', 18) + 'Descargar contactos (CSV)</button>' +
      (estado.instalar ? '<button type="button" class="btn chico azul-claro" data-accion="instalar">Instalar la app</button>' : '') + '</section>' +
      '<section class="tarjeta" style="border-color:var(--error)"><h2 class="seccion" style="color:var(--error)">Zona de cuidado</h2>' +
      '<p>Borra todos los relevamientos de ESTE dispositivo (por ejemplo, después de la prueba). Los que ya se enviaron siguen en la planilla.</p>' +
      '<button type="button" class="btn chico peligro" data-accion="borrar-todo">Borrar todos los datos de este dispositivo</button></section>' +
      '<p class="ayuda">App ' + esc(VERSION_APP) + ' · instrumento ' + esc(I.CUESTIONARIO.version) + ' · ' + estado.registros.length + ' relevamientos guardados · almacenamiento ' +
      (estado.persistente === true ? 'protegido' : estado.persistente === false ? 'no protegido: hacé respaldos frecuentes' : 'sin verificar') + '</p></main>';
  }

  /* ---------- Importar ---------- */
  REGIONES.importacion = function () {
    if (!estado.importacion.length) return '';
    return '<div class="tarjeta resultados-importacion">' + estado.importacion.map(function (x) {
      return x.error ? '<span class="error-linea">' + ico('alerta', 16) + esc(x.nombre) + ': ' + esc(x.error) + '</span>'
        : '<span class="ok-linea" style="color:var(--tinta)">' + ico('check', 16) + esc(x.nombre) + ': ' + x.nuevos + ' nuevos, ' + x.actualizados + ' actualizados, ' + x.iguales + ' ya estaban</span>';
    }).join('') + '</div>';
  };

  function vImportar() {
    return '<main class="pantalla">' + barra('#/ajustes', T.cejaImportar, 'Importar paquetes') +
      '<p style="margin:0">Elegí los paquetes que mandaron los equipos (archivos .txt o .json). Se unen con lo que ya hay en esta computadora; si un relevamiento llega dos veces, queda la versión más reciente.</p>' +
      '<label class="btn primario" for="archivos-paquete" style="cursor:pointer">' + ico('subir', 22) + 'Elegir paquetes</label>' +
      '<input type="file" id="archivos-paquete" accept=".txt,.json,text/plain,application/json" multiple class="oculto-visual">' +
      region('importacion', REGIONES.importacion()) +
      '<a class="btn azul" href="#/cierre">' + ico('nube', 22) + 'Enviar todo a la planilla</a>' +
      '<button type="button" class="btn chico" data-accion="csv">' + ico('bajar', 18) + 'Descargar CSV consolidado</button></main>';
  }

  /* ---------- acciones ---------- */
  var ACCIONES = {
    'nuevo': function () {
      var aj = estado.ajustes;
      var r = { id: uuid(), participante_id: '', orden: String(siguienteOrden()), edad: '', cp: '', codigo: '', fecha: hoy(), hora_inicio: horaAhora(),
        equipo: aj.equipo, dispositivo: aj.dispositivo, encuestador: aj.encuestador, puesto: aj.puesto, consentimiento: false, comparte_app: false,
        contacto: {}, socio: {}, bio: {}, estado: 'borrador', creado: ahoraISO(), modificado: null, sincronizado: null,
        version_instrumento: I.CUESTIONARIO.version };
      estado.actual = r; estado.buscarPart = '';
      ir('#/participante/' + r.id);
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
      if (ruta === 'reg.previo') {
        if (nuevo !== 'Sí' && estado.actual.pid_origen === 'vinculado') { asignar('reg.participante_id', ''); asignar('reg.pid_origen', ''); }
      }
      if (ruta === 'bio.g_acepta' && nuevo === 'Sí' && !valor('bio.g_hora_medicion')) asignar('bio.g_hora_medicion', horaAhora());
      asignar(ruta, nuevo);
      render();
    },
    'vincular': function (b) {
      var origen = estado.registros.find(function (x) { return x.id === b.dataset.valor; });
      if (!origen) return;
      asignar('reg.participante_id', origen.participante_id);
      asignar('reg.pid_origen', 'vinculado');
      var k = estado.actual.contacto || {}, ko = origen.contacto || {};
      if (!k.celular && ko.celular) asignar('contacto.celular', ko.celular);
      if (!k.correo && ko.correo) asignar('contacto.correo', ko.correo);
      estado.buscarPart = '';
      toast('Vinculado a ' + origen.participante_id);
      render();
    },
    'continuar': function (b) {
      var r = estado.actual, errores = erroresIdentificacion(r);
      if (errores.length) { toast(errores[0]); return; }
      if (!r.participante_id) {
        var aj = estado.ajustes;
        aj.contador = (Number(aj.contador) || 0) + 1;
        guardarAjustes();
        asignar('reg.participante_id', String(aj.equipo).toUpperCase() + aj.dispositivo + '-' + R.pad(aj.contador, 4));
        asignar('reg.pid_origen', 'nuevo');
      }
      tocar();
      ir(b.dataset.valor === 'bio' ? '#/bio/' + r.id + '/1' : '#/socio/' + r.id + '/1');
    },
    'eliminar': function () {
      var r = estado.actual;
      var aviso = r.sincronizado ? ' Ya se envió a la planilla: allí hay que borrarlo a mano.' : '';
      if (!window.confirm('¿Eliminar el relevamiento ' + (r.codigo || '') + '? No se puede deshacer.' + aviso)) return;
      clearTimeout(reloj);
      DB.borrar(r.id).then(function () {
        estado.registros = estado.registros.filter(function (x) { return x.id !== r.id; });
        estado.actual = null; toast('Relevamiento eliminado'); ir('#/jornada');
      });
    },
    'finalizar': function () {
      var r = estado.actual;
      r.estado = 'finalizado'; r.hora_fin = horaAhora(); tocar();
      guardarActual().then(function () { toast('Relevamiento ' + (r.codigo || '') + ' guardado'); ir('#/jornada'); });
    },
    'sincronizar': function () {
      if (estado.sincronizando) return;
      var aj = estado.ajustes;
      var pend = estado.registros.filter(function (r) { return r.consentimiento && R.pendiente(r); });
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
          estado.mensajeSync = 'Listo: ' + hechos.length + ' relevamientos guardados en la planilla.';
          return DB.guardarVarios(hechos);
        })
        .catch(function (e) { estado.mensajeSync = 'No se pudo sincronizar (' + e.message + '). Los datos siguen guardados en el dispositivo.'; })
        .then(function () { estado.sincronizando = false; render(); });
    },
    'paquete': function () {
      var aj = estado.ajustes, f = hoy();
      var regs = estado.registros.filter(function (r) { return r.consentimiento && (r.fecha === f || R.pendiente(r)); });
      if (!regs.length) { toast('No hay relevamientos para empaquetar'); return; }
      var d = new Date(), nombre = 'paquete_' + aj.equipo + aj.dispositivo + '_' + f + '_' + dos(d.getHours()) + dos(d.getMinutes()) + '.txt';
      S.armarPaquete(regs, { equipo: aj.equipo, dispositivo: aj.dispositivo }, aj.clave)
        .then(function (txt) { return S.compartirODescargar(nombre, txt, 'text/plain', 'Paquete de relevamiento ' + aj.equipo + aj.dispositivo); })
        .then(function (modo) { aj.ultimoPaquete = ahoraISO(); guardarAjustes(); toast(modo === 'compartido' ? 'Paquete compartido' : 'Paquete descargado: ' + nombre); render(); })
        .catch(function (e) { if (e && e.name !== 'AbortError') toast('No se pudo generar el paquete: ' + e.message); });
    },
    'csv': function () {
      var regs = estado.registros.filter(function (r) { return r.consentimiento; });
      if (!regs.length) { toast('No hay datos para exportar'); return; }
      var cols = I.columnas().map(function (c) { return c.id; });
      var filas = regs.map(function (r) { return R.aplanar(r).fila; });
      S.descargar('datos_' + estado.ajustes.equipo + estado.ajustes.dispositivo + '_' + hoy() + '.csv', R.csv(filas, cols), 'text/csv;charset=utf-8');
    },
    'contactos': function () {
      var regs = estado.registros.filter(function (r) { return r.consentimiento; });
      var filas = regs.map(function (r) { return R.aplanar(r).contacto; });
      S.descargar('contactos_' + estado.ajustes.equipo + estado.ajustes.dispositivo + '_' + hoy() + '.csv', R.csv(filas, I.CONTACTO), 'text/csv;charset=utf-8');
    },
    'respaldo': function () {
      var aj = estado.ajustes;
      S.armarPaquete(estado.registros, { equipo: aj.equipo, dispositivo: aj.dispositivo }, aj.clave).then(function (txt) {
        S.descargar('respaldo_' + aj.equipo + aj.dispositivo + '_' + hoy() + '.txt', txt, 'text/plain');
      });
    },
    'probar': function () {
      var aj = estado.ajustes;
      if (!aj.url) { estado.mensajeConexion = 'Primero pegá la dirección de la aplicación web.'; refrescar(); return; }
      estado.mensajeConexion = 'Probando…'; refrescar();
      S.probarConexion(aj.url.trim(), aj.clave).then(function (r) {
        estado.mensajeConexion = r && r.ok ? 'Conexión correcta con la planilla «' + (r.planilla || '') + '».' : 'La planilla respondió: ' + ((r && r.error) || 'error');
      }).catch(function (e) { estado.mensajeConexion = 'Sin conexión con la planilla (' + e.message + ').'; })
        .then(refrescar);
    },
    'borrar-todo': function () {
      var aj = estado.ajustes;
      var pend = estado.registros.filter(function (r) { return r.consentimiento && R.pendiente(r); }).length;
      var aviso = pend ? 'ATENCIÓN: hay ' + pend + ' relevamientos SIN SINCRONIZAR que se van a perder.\n\n' : '';
      var escrito = window.prompt(aviso + 'Se van a borrar ' + estado.registros.length + ' relevamientos de este dispositivo. Para confirmar, escribí BORRAR');
      if (escrito === null) return;
      if (escrito.trim().toUpperCase() !== 'BORRAR') { toast('No se borró nada (no escribiste BORRAR)'); return; }
      var reiniciar = window.confirm('¿Eran solo datos de PRUEBA?\n\nAceptar: sí, la numeración de IDs de participante vuelve a empezar (A1-0001).\nCancelar: no, se mantiene la numeración para no repetir IDs.');
      DB.borrarTodos().then(function () {
        estado.registros = []; estado.actual = null;
        if (reiniciar) aj.contador = 0;
        aj.ultimaSync = ''; aj.ultimoPaquete = '';
        return guardarAjustes();
      }).then(function () { toast('Se borraron los datos de este dispositivo'); ir('#/jornada'); });
    },
    'instalar': function () {
      if (!estado.instalar) return;
      estado.instalar.prompt();
      estado.instalar.userChoice.then(function () { estado.instalar = null; render(); });
    }
  };

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
    if (el.dataset.buscarPart) { estado.buscarPart = el.value; refrescar(); return; }
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
    if (el.type === 'checkbox') { asignar(el.dataset.campo, el.checked); if (!estado.actual || estado.ruta.vista !== 'participante') render(); return; }
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
        return archivo.text().then(function (txt) { return S.abrirPaquete(txt, estado.ajustes.clave); })
          .then(function (paq) {
            var res = S.unir(estado.registros, paq.registros);
            return DB.guardarVarios(res.aGuardar).then(function () {
              res.aGuardar.forEach(function (r) {
                var i = estado.registros.findIndex(function (x) { return x.id === r.id; });
                if (i >= 0) estado.registros[i] = r; else estado.registros.push(r);
              });
              estado.importacion.push({ nombre: archivo.name, nuevos: res.nuevos, actualizados: res.actualizados, iguales: res.iguales });
            });
          })
          .catch(function (e) { estado.importacion.push({ nombre: archivo.name, error: e.message }); })
          .then(refrescar);
      });
    }, Promise.resolve());
  }

  /* ---------- inicio ---------- */
  function iniciar() {
    if (!window.indexedDB) { raizApp.innerHTML = '<main class="pantalla"><p>Este navegador no permite guardar datos. Usá Chrome actualizado.</p></main>'; return; }
    DB.leerAjuste('ajustes').then(function (aj) {
      estado.ajustes = Object.assign({}, AJUSTES_BASE, aj || {});
      return DB.todos();
    }).then(function (regs) {
      estado.registros = regs || [];
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
