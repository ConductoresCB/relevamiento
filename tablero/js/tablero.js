/*
 * tablero.js — Interfaz del tablero de análisis.
 * Vistas: Resumen, Explorar, Cruces, Relaciones, Participantes, Informe y Fuentes.
 * Todos los datos se procesan en este navegador: los archivos no se suben a ningún servidor.
 */
(function () {
  'use strict';

  var D = window.Datos, E = window.Estadistica, G = window.Graficos;
  var esc = G.esc, num = G.num, pct = G.pct;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ------------------------------------------------------------ Paletas */
  var CLARO = {
    fuente: 'Arial, Helvetica, sans-serif', superficie: '#FFFFFF', tinta: '#1C1E21', tinta2: '#4A4E54', tenue: '#676C73',
    grilla: '#E6E1D5', eje: '#C9C2B2', acento: '#1A588F',
    cat: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
    riesgo: ['#e6a675', '#c38555', '#a36737', '#844b17', '#673000'],
    ord: ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']
  };
  function paletaPantalla() {
    var cs = getComputedStyle(document.documentElement);
    function v(n) { return cs.getPropertyValue(n).trim(); }
    function lista(n) { return v(n).split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
    return {
      fuente: "'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif", superficie: v('--superficie'), tinta: v('--tinta'),
      tinta2: v('--tinta-2'), tenue: v('--tenue'), grilla: v('--grilla'), eje: v('--eje'), acento: v('--g-acento'),
      cat: [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { return v('--g-cat-' + i); }), riesgo: lista('--g-riesgo'), ord: lista('--g-ord')
    };
  }
  /* Colores de las categorías de una variable, según su tipo (riesgo, ordinal o nominal). */
  function coloresDe(v, cats, t) {
    if (v && v.riesgo) {
      var r = t.riesgo, total = v.opciones.length;
      return cats.map(function (c) {
        var i = v.opciones.indexOf(c);
        if (i < 0) return t.tenue;
        return total === 3 ? r[[0, 2, 4][i]] : r[Math.min(4, i)];
      });
    }
    if (v && v.ordinal && cats.length <= 10 && cats.indexOf('Otras') < 0) {
      var o = t.ord, n = cats.length;
      return cats.map(function (c, i) { return o[n === 1 ? 4 : Math.round(i * (o.length - 1) / (n - 1))]; });
    }
    return cats.map(function (c, i) { return c === 'Otras' ? t.tenue : t.cat[i % 8]; });
  }
  function textoSobre(hex) { // tinta o blanco según la luminancia del relleno
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
    var n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    function l(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var L = 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
    return L > 0.36 ? '#1C1E21' : '#FFFFFF';
  }

  /* ------------------------------------------------------------- Estado */
  var guardado = leerPreferencias();
  var estado = {
    fuentes: [], unidad: guardado.unidad || 'participantes', vista: guardado.vista || 'resumen',
    filtros: { cat: {}, edad: [null, null], fecha: ['', ''] }, extraFiltros: [],
    explorar: { v: 'p01_nac_pais', por: '' },
    cruce: { f: 'p34_actividad_fisica', c: 'fr_categoria', mostrar: 'fila', num: 'b_imc' },
    relacion: { x: 'p16_horas_sin_parar', y: 'b_imc', color: '', recta: true },
    participantes: { orden: 'completo', asc: true, buscar: '' },
    informe: [], conexion: { url: guardado.url || '', clave: guardado.clave || '', recordar: !!guardado.clave }
  };
  var cache = { base: [], participantes: [], filtradas: [], duplicados: 0 };
  var graficos = {};
  var anchoActual = null; // ancho en píxeles del gráfico que se está dibujando (null = ancho de exportación)
  function dibujarEn(g, t, ancho) { anchoActual = ancho || null; try { return g.dibujar(t); } finally { anchoActual = null; } }
  function dibujarLienzos() {
    var t = paletaPantalla();
    $$('.lienzo[data-dibujo]').forEach(function (el) {
      var g = graficos[el.dataset.dibujo]; if (!g) return;
      var w = Math.max(300, Math.floor(el.clientWidth));
      if (el._ancho === w && el._tema === t.tinta) return;
      el._ancho = w; el._tema = t.tinta;
      el.innerHTML = dibujarEn(g, t, w).svg;
    });
  }
  var FILTROS_FIJOS = ['origen', 'puesto', 'equipo', 'b_sexo', 'p01_nac_pais'];

  function leerPreferencias() {
    try { return JSON.parse(localStorage.getItem('tablero-relevamiento') || '{}'); } catch (e) { return {}; }
  }
  function guardarPreferencias() {
    try {
      localStorage.setItem('tablero-relevamiento', JSON.stringify({ unidad: estado.unidad, vista: estado.vista, url: estado.conexion.url,
        clave: estado.conexion.recordar ? estado.conexion.clave : '' }));
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  function hayEjemplo() { return estado.fuentes.some(function (f) { return f.ejemplo; }); }
  function fuentesActivas() { return estado.fuentes.filter(function (f) { return f.activa !== false; }); }
  function nombreUnidad(n) { var p = estado.unidad === 'participantes'; return n === 1 ? (p ? 'participante' : 'relevamiento') : (p ? 'participantes' : 'relevamientos'); }

  /* --------------------------------------------------------- Datos */
  function recalcularTodo() {
    var u = D.unir(estado.fuentes);
    cache.base = u.filas; cache.duplicados = u.duplicados;
    cache.participantes = D.consolidar(u.filas);
    aplicar();
  }
  function conjunto() { return estado.unidad === 'participantes' ? cache.participantes : cache.base; }
  function aplicar() {
    cache.filtradas = D.filtrar(conjunto(), estado.filtros);
    render();
  }

  function agregarFuente(nombre, etiqueta, filasCrudas, extra) {
    var filas = filasCrudas.map(D.normalizarFila);
    if (!D.esDelRelevamiento(filas)) throw new Error('«' + nombre + '» no parece una planilla del relevamiento: no encontré columnas como id, edad o p01_nac_pais.');
    if (!extra || !extra.ejemplo) {
      var habia = hayEjemplo();
      estado.fuentes = estado.fuentes.filter(function (f) { return !f.ejemplo; });
      if (habia) aviso('Se quitaron los datos de ejemplo para trabajar solo con tus planillas.');
    }
    var id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    estado.fuentes.push(Object.assign({ id: id, nombre: nombre, etiqueta: etiqueta, filas: filas, activa: true }, extra || {}));
    recalcularTodo();
  }

  function etiquetaSugerida(nombre, filas) {
    var previa = filas.length && filas.every(function (r) { return r.equipo === 'P' || /previa/i.test(r.version_instrumento || ''); });
    if (previa) return 'Previa';
    var n = estado.fuentes.filter(function (f) { return !f.ejemplo; }).length;
    return n ? 'Planilla ' + (n + 1) : 'Actual';
  }

  function cargarArchivos(lista) {
    var archivos = Array.prototype.slice.call(lista || []);
    if (!archivos.length) return;
    archivos.reduce(function (cadena, archivo) {
      return cadena.then(function () {
        var nombre = archivo.name, ext = nombre.split('.').pop().toLowerCase();
        if (ext === 'xlsx') {
          return archivo.arrayBuffer().then(function (buf) { return D.leerXlsx(buf, window.JSZip); }).then(function (r) {
            var filas = r.filas.map(D.normalizarFila);
            agregarFuente(nombre, etiquetaSugerida(nombre, filas), r.filas, { hoja: r.hoja });
            aviso('«' + nombre + '»: ' + filasTxt(r.filas.length) + ' de la hoja «' + r.hoja + '».');
          });
        }
        if (ext === 'csv' || ext === 'txt') {
          return archivo.text().then(function (txt) {
            var filas = D.leerCsv(txt);
            agregarFuente(nombre, etiquetaSugerida(nombre, filas.map(D.normalizarFila)), filas, { hoja: 'CSV' });
            aviso('«' + nombre + '»: ' + filasTxt(filas.length) + '.');
          });
        }
        if (ext === 'xls') throw new Error('«' + nombre + '» está en el formato viejo de Excel (.xls). Guardalo como .xlsx y volvé a cargarlo.');
        throw new Error('«' + nombre + '» no es .xlsx ni .csv.');
      }).catch(function (e) { aviso(e.message || String(e), true); });
    }, Promise.resolve());
  }

  function cargarEjemplo() {
    var ej = window.EJEMPLO_TABLERO;
    if (!ej) return;
    estado.fuentes = estado.fuentes.filter(function (f) { return !f.ejemplo; });
    agregarFuente('Planilla previa de ejemplo', 'Previa (ficticia)', ej.previa, { ejemplo: true, hoja: 'Datos' });
    agregarFuente('Planilla actual de ejemplo', 'Actual (ficticia)', ej.actual, { ejemplo: true, hoja: 'Datos' });
  }

  /* Lee la hoja Datos de la planilla de Google (requiere el script 1.3 o posterior). */
  function leerGoogle() {
    var c = estado.conexion;
    if (!c.url || !c.clave) { aviso('Completá la dirección de la planilla y la clave del equipo.', true); return; }
    aviso('Leyendo la planilla…');
    fetch(c.url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ accion: 'leer', token: c.clave }) })
      .then(function (r) { if (!r.ok) throw new Error('La planilla respondió ' + r.status); return r.json(); })
      .then(function (resp) {
        if (!resp || !resp.ok) {
          var msg = (resp && resp.error) || 'Respuesta inválida';
          if (/no reconocido/i.test(msg)) msg = 'El script de la planilla todavía no permite leer: hay que actualizarlo a la versión 1.3 (ver manual técnico).';
          throw new Error(msg);
        }
        estado.fuentes = estado.fuentes.filter(function (f) { return !f.google; });
        agregarFuente('Planilla de Google', 'Planilla de Google', resp.filas || [], { google: true, hoja: 'Datos', leida: new Date().toISOString() });
        guardarPreferencias();
        aviso('Planilla de Google: ' + filasTxt((resp.filas || []).length) + '.');
      })
      .catch(function (e) { aviso('No se pudo leer la planilla: ' + (e.message || e), true); });
  }

  /* -------------------------------------------------------- Descargas */
  function guardarArchivo(nombre, datos, tipo) {
    var blob = datos instanceof Blob ? datos : new Blob([datos], { type: tipo || 'text/plain;charset=utf-8' });
    var cl = window.claude;
    if (cl && typeof cl.use === 'function') {
      return cl.use('downloads').then(function (d) {
        if (!d) { aviso('Las descargas no están disponibles en esta vista. Abrí el tablero desde su dirección de GitHub.', true); return; }
        return d.save({ filename: nombre, data: blob }).then(function () { aviso('Listo: ' + nombre); }, function (e) {
          if (e && e.code === 'declined') return;
          aviso('No se pudo descargar: ' + ((e && e.message) || 'error'), true);
        });
      });
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return Promise.resolve();
  }
  function nombreArchivo(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 60).toLowerCase() || 'grafico';
  }

  /* ------------------------------------------------------- Textos de apoyo */
  function descripcionFiltros() {
    var partes = [];
    Object.keys(estado.filtros.cat).forEach(function (k) {
      var sel = estado.filtros.cat[k]; if (!sel || !sel.length) return;
      var v = D.variable(k); partes.push((v ? v.nombre : k) + ': ' + sel.join(', '));
    });
    var e = estado.filtros.edad;
    if (e[0] !== null || e[1] !== null) partes.push('Edad: ' + (e[0] !== null ? e[0] : '…') + ' a ' + (e[1] !== null ? e[1] : '…'));
    var f = estado.filtros.fecha;
    if (f[0] || f[1]) partes.push('Fecha: ' + (f[0] ? fechaCorta(f[0]) : '…') + ' a ' + (f[1] ? fechaCorta(f[1]) : '…'));
    return partes.join(' · ');
  }
  function filasTxt(n) { return num(n) + (n === 1 ? ' fila' : ' filas'); }
  function minus(s) { return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function fechaCorta(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function hoyTexto() { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }

  function pieExportacion() {
    var fuentes = fuentesActivas().map(function (f) { return f.etiqueta; }).join(', ');
    var filtros = descripcionFiltros();
    return (hayEjemplo() ? 'DATOS FICTICIOS DE EJEMPLO. ' : '') + 'Fuente: ' + (fuentes || 'sin datos') + '. Unidad: ' +
      (estado.unidad === 'participantes' ? 'participantes (visitas unidas por ID)' : 'relevamientos') + '. ' +
      (filtros ? 'Filtros: ' + filtros + '. ' : '') + 'Relevamiento Corredor Bioceánico (Jujuy), ' + hoyTexto() + '.';
  }

  function textoFrecuencias(f, v) {
    if (!f.respondieron) return 'No hay datos de esta pregunta con los filtros actuales.';
    var top = f.categorias.slice().sort(function (a, b) { return b.n - a.n; })[0];
    var s = 'De <strong>' + num(f.respondieron) + '</strong> ' + nombreUnidad(f.respondieron) + ' con dato, la respuesta más frecuente es <strong>«' + esc(top.valor) + '»</strong> (' + num(top.n) + '; ' + pct(top.pct) + ').';
    var empatadas = f.categorias.filter(function (c) { return c.n === top.n && c.valor !== top.valor; });
    if (empatadas.length) s += ' Empata con «' + empatadas.map(function (c) { return esc(c.valor); }).join('», «') + '».';
    if (f.multiple) s += ' Cada persona pudo marcar más de una opción: los porcentajes son sobre quienes respondieron y pueden sumar más de 100 %.';
    if (f.sinDato) s += ' ' + num(f.sinDato) + ' ' + nombreUnidad(f.sinDato) + ' no tienen dato.';
    if (f.respondieron < 30) s += ' Con menos de 30 casos, los porcentajes cambian mucho con cada caso: conviene leerlos junto con las cantidades.';
    return s;
  }
  function textoNumerico(r, unidadMedida) {
    if (!r.n) return 'No hay datos numéricos con los filtros actuales.';
    var u = unidadMedida ? ' ' + unidadMedida : '';
    return 'n = <strong>' + num(r.n) + '</strong>. Media <strong>' + num(r.media, 1) + u + '</strong>' + (r.de !== null ? ' (DE ' + num(r.de, 1) + ')' : '') +
      '; mediana ' + num(r.mediana, 1) + ' (RIC ' + num(r.q1, 1) + ' a ' + num(r.q3, 1) + '); mínimo ' + num(r.min, 1) + ', máximo ' + num(r.max, 1) + '.';
  }
  function textoP(p) { return p < 0.001 ? 'p < 0,001' : 'p = ' + num(p, 3); }

  function textoPrueba(x) {
    if (!x.simple) return '<div class="prueba">Hay una pregunta de opción múltiple: cada persona puede estar en varias filas o columnas, así que no corresponde la prueba de chi cuadrado.</div>';
    var filasCon = x.totFila.filter(function (n) { return n > 0; }).length, colsCon = x.totCol.filter(function (n) { return n > 0; }).length;
    if (filasCon < 2 || colsCon < 2) return '<div class="prueba">Hace falta al menos dos categorías con casos en cada pregunta para comparar.</div>';
    var t = x.tabla.filter(function (f, i) { return x.totFila[i] > 0; }).map(function (f) { return f.filter(function (c, j) { return x.totCol[j] > 0; }); });
    var chi = E.chiCuadrado(t), html = '';
    if (t.length === 2 && t[0].length === 2) {
      var pf = E.fisher2x2(t[0][0], t[0][1], t[1][0], t[1][1]);
      html = 'Prueba exacta de Fisher (tabla 2 × 2): <strong>' + textoP(pf) + '</strong>. Chi cuadrado de referencia: χ²(1) = ' + num(chi.chi2, 2) + '.';
    } else {
      html = 'Chi cuadrado de independencia: <strong>χ²(' + chi.gl + ') = ' + num(chi.chi2, 2) + '; ' + textoP(chi.p) + '</strong>; V de Cramér = ' + num(chi.vCramer, 2) + '.';
    }
    var cuidado = chi.propBajas > 0.2 || x.N < 30;
    if (chi.propBajas > 0.2) html += ' El ' + pct(chi.propBajas * 100) + ' de las celdas tiene frecuencia esperada menor que 5, así que el valor p no es confiable: conviene agrupar categorías' + (t.length === 2 && t[0].length === 2 ? '' : ' o usar una prueba exacta') + '.';
    else if (x.N < 30) html += ' Con menos de 30 casos, tomalo como exploratorio.';
    html += ' Una asociación no indica causa: puede haber otros factores (edad, sexo, tipo de recorrido).';
    return '<div class="prueba' + (cuidado ? ' cuidado' : '') + '">' + html + '</div>';
  }

  function textoCruce(x, vf, vc) {
    if (!x.N) return 'No hay casos con ambas preguntas respondidas.';
    // categoría de columna a comparar: la de mayor riesgo / la última en orden, o la más frecuente
    var j;
    if (vc.riesgo || vc.ordinal) { j = x.columnas.length - 1; while (j > 0 && !x.totCol[j]) j--; }
    else { j = x.totCol.indexOf(Math.max.apply(null, x.totCol)); }
    var filas = x.filas.map(function (f, i) { return { f: f, n: x.totFila[i], p: x.totFila[i] ? x.tabla[i][j] / x.totFila[i] * 100 : null }; })
      .filter(function (r) { return r.n >= 5; });
    var s = 'Con <strong>' + num(x.N) + '</strong> ' + nombreUnidad(x.N) + ' que respondieron ambas preguntas.';
    if (filas.length >= 2) {
      filas.sort(function (a, b) { return b.p - a.p; });
      var hi = filas[0], lo = filas[filas.length - 1];
      s += ' La proporción en <strong>«' + esc(x.columnas[j]) + '»</strong> va de ' + pct(lo.p) + ' entre «' + esc(lo.f) + '» (n = ' + num(lo.n) + ') a <strong>' + pct(hi.p) + ' entre «' + esc(hi.f) + '»</strong> (n = ' + num(hi.n) + ').';
    } else s += ' Hay pocas categorías con 5 casos o más para comparar proporciones.';
    if (x.otras.length) s += ' «Otras» agrupa: ' + x.otras.map(esc).join(', ') + '.';
    return s;
  }

  /* ------------------------------------------------------ Gráficos (registro) */
  /* g = {id, titulo, subtitulo, dibujar(t) → {svg, alto}, tabla: {cabecera, filas}, lectura, vacio, csv} */
  function tarjeta(g, clase) {
    graficos[g.id] = g;
    var cuerpo = g.vacio ? '<div class="vacio">' + g.vacio + '</div>' : '<div class="lienzo" data-dibujo="' + g.id + '"></div>';
    var tabla = g.tabla ? '<div class="desplazable tabla-g" hidden>' + tablaHtml(g.tabla) + '</div>' : '';
    return '<article class="tarjeta grafico ' + (clase || '') + '" id="g-' + g.id + '">' +
      '<header><h3>' + esc(g.titulo) + '</h3>' + (g.subtitulo ? '<p class="sub">' + esc(g.subtitulo) + '</p>' : '') + '</header>' +
      cuerpo + (g.lectura ? '<p class="lectura">' + g.lectura + '</p>' : '') + (g.extra || '') + tabla +
      (g.vacio ? '' : '<footer class="acciones no-imprimir">' +
        (g.tabla ? '<button type="button" class="btn chico fantasma" data-accion="tabla" data-g="' + g.id + '">Ver tabla</button>' : '') +
        '<button type="button" class="btn chico fantasma" data-accion="png" data-g="' + g.id + '">Imagen PNG</button>' +
        '<button type="button" class="btn chico fantasma" data-accion="svg" data-g="' + g.id + '">SVG</button>' +
        (g.tabla ? '<button type="button" class="btn chico fantasma" data-accion="csv" data-g="' + g.id + '">Tabla CSV</button>' : '') +
        '<button type="button" class="btn chico fantasma" data-accion="informe" data-g="' + g.id + '">Agregar al informe</button></footer>') +
      '</article>';
  }
  function tablaHtml(t) {
    return '<table class="datos"><thead><tr>' + t.cabecera.map(function (c, i) { return '<th' + (i ? ' class="n"' : '') + '>' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + t.filas.map(function (f) {
        return '<tr' + (f.total ? ' class="total"' : '') + '>' + (f.celdas || f).map(function (c, i) { return '<td' + (i ? ' class="n"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function tablaCsv(t) {
    function c(v) { v = String(v === undefined || v === null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return '﻿' + [t.cabecera].concat(t.filas.map(function (f) { return f.celdas || f; })).map(function (f) { return f.map(c).join(';'); }).join('\r\n');
  }
  function exportable(g) {
    var d = g.dibujar(CLARO);
    return G.componer({ titulo: g.titulo, subtitulo: g.subtitulo, svg: d.svg, alto: d.alto, pie: (g.notaPie ? g.notaPie + ' ' : '') + pieExportacion() }, CLARO);
  }

  /* Gráfico de frecuencias de una variable categórica */
  function graficoFrecuencias(id, v, filas, opciones) {
    opciones = opciones || {};
    var f = D.frecuencias(filas, v);
    var cats = f.categorias;
    var titulo = opciones.titulo || v.nombre;
    var g = { id: id, titulo: titulo, subtitulo: (opciones.sub ? opciones.sub + ' · ' : '') + 'n = ' + num(f.respondieron) + ' ' + nombreUnidad(f.respondieron) + (f.sinDato ? ' · sin dato: ' + num(f.sinDato) : ''),
      lectura: opciones.lectura === false ? '' : textoFrecuencias(f, v), notaPie: opciones.notaPie,
      tabla: { cabecera: [opciones.encabezado || 'Respuesta', 'Cantidad', '% sobre quienes respondieron'],
        filas: cats.map(function (c) { return [c.valor, num(c.n), num(c.pct, 1)]; }).concat([{ total: true, celdas: ['Respondieron', num(f.respondieron), ''] }]) } };
    if (!f.respondieron) g.vacio = opciones.vacio || 'Sin datos con los filtros actuales.';
    g.dibujar = function (t) {
      var col = coloresDe(v, cats.map(function (c) { return c.valor; }), t);
      var unico = !(v.riesgo || v.ordinal);
      return G.barrasH(cats.map(function (c, i) { return { etiqueta: c.valor, n: c.n, pct: c.pct, color: unico ? t.acento : col[i] }; }), t, { ancho: anchoActual, titulo: titulo });
    };
    return g;
  }

  /* ------------------------------------------------------------ Vistas */
  var VISTAS = {
    resumen: { titulo: 'Resumen', bajada: 'Cuántos hay, qué riesgos aparecen y qué datos faltan.' },
    explorar: { titulo: 'Explorar una pregunta', bajada: 'Elegí una pregunta para ver su distribución y, si querés, compararla entre grupos.' },
    cruces: { titulo: 'Cruces', bajada: 'Tabla dinámica entre dos preguntas: por ejemplo, un hábito de la sociodemográfica contra un riesgo de la biológica.' },
    relaciones: { titulo: 'Relaciones numéricas', bajada: 'Dos medidas numéricas a la vez, con su correlación.' },
    participantes: { titulo: 'Participantes', bajada: 'Cada participante con sus visitas unidas por ID y lo que todavía falta completar.' },
    informe: { titulo: 'Informe', bajada: 'Los gráficos que agregaste, con su lectura y tus notas, listos para descargar.' },
    fuentes: { titulo: 'Fuentes de datos', bajada: 'Cargá la planilla previa, la planilla actual o el CSV de la app. Los datos no salen de esta computadora.' }
  };

  function render() {
    graficos = {};
    $$('.nav button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.vista === estado.vista ? 'page' : 'false'); });
    var v = VISTAS[estado.vista];
    $('#titulo-vista').textContent = v.titulo;
    $('#bajada-vista').textContent = v.bajada;
    $('#pildora-datos').innerHTML = !estado.fuentes.length ? '' : hayEjemplo() ? '<span class="pildora ejemplo">Datos ficticios de ejemplo</span>' :
      '<span class="pildora real">' + num(cache.base.length) + ' relevamientos cargados</span>';
    renderFiltros();
    renderFuentesMini();
    var html = '';
    if (!estado.fuentes.length && estado.vista !== 'fuentes') html = vSinDatos();
    else html = ({ resumen: vResumen, explorar: vExplorar, cruces: vCruces, relaciones: vRelaciones, participantes: vParticipantes, informe: vInforme, fuentes: vFuentes })[estado.vista]();
    $('#vista').innerHTML = html;
    dibujarLienzos();
  }

  function vSinDatos() {
    return '<div class="tarjeta"><h3>Todavía no hay datos cargados</h3><p class="lectura">Andá a <strong>Fuentes</strong> para cargar la planilla previa, la planilla actual (descargada de Google como Excel) o el CSV de la app, o mirá los datos ficticios de ejemplo.</p>' +
      '<div class="form-fila"><button type="button" class="btn" data-ir="fuentes">Ir a Fuentes</button><button type="button" class="btn sec" data-accion="ejemplo">Ver datos de ejemplo</button></div></div>';
  }

  /* ---------- Resumen ---------- */
  function vResumen() {
    var F = cache.filtradas, html = '';
    var participantes = estado.unidad === 'participantes' ? F : D.consolidar(F);
    var relev = estado.unidad === 'participantes' ? F.reduce(function (a, r) { return a + (r.visitas || 1); }, 0) : F.length;
    var dos = participantes.filter(function (r) { return r.visitas > 1; }).length;
    var conFr = F.filter(function (r) { return r.fr_categoria; }).length, conFh = F.filter(function (r) { return r.fh_categoria; }).length;
    var conGl = F.filter(function (r) { return typeof r.g_resultado_mgdl === 'number'; }).length;
    function kpi(rot, val, det) { return '<div class="kpi"><span class="rotulo">' + rot + '</span><span class="valor">' + val + '</span><span class="detalle">' + det + '</span></div>'; }
    html += '<div class="kpis">' +
      kpi('Participantes', num(participantes.length), dos ? num(dos) + ' con más de una visita' : 'una visita cada uno') +
      kpi('Relevamientos', num(relev), fuentesActivas().length + (fuentesActivas().length === 1 ? ' planilla' : ' planillas')) +
      kpi('Con FINDRISK', num(conFr), F.length ? pct(conFr / F.length * 100) + ' de ' + num(F.length) + ' ' + nombreUnidad(F.length) : '') +
      kpi('Con Framingham', num(conFh), F.length ? pct(conFh / F.length * 100) + ' de ' + num(F.length) : '') +
      kpi('Con glucemia', num(conGl), F.length ? pct(conGl / F.length * 100) + ' de ' + num(F.length) : '') + '</div>';

    html += '<div class="rejilla">';
    var vfr = D.variable('fr_categoria'), vfh = D.variable('fh_categoria');
    var faltaFr = faltantes(F, '_fr');
    html += tarjeta(graficoFrecuencias('fr', vfr, F, { titulo: 'Riesgo de diabetes a 10 años (FINDRISK)', encabezado: 'Categoría',
      vacio: 'Ningún ' + nombreUnidad(1) + ' tiene todos los datos para FINDRISK. ' + faltaFr,
      notaPie: 'FINDRISK excluye a quienes tienen diagnóstico de diabetes.' }));
    html += tarjeta(graficoFrecuencias('fh', vfh, F, { titulo: 'Riesgo cardiovascular a 10 años (Framingham con IMC)', encabezado: 'Categoría',
      vacio: 'Ningún ' + nombreUnidad(1) + ' tiene todos los datos para Framingham. ' + faltantes(F, '_fh'), notaPie: 'Framingham con IMC: tablas del protocolo; edades de 20 a 79 años.' }));
    var conImc = F.filter(function (r) { return typeof r.b_imc === 'number'; }).length;
    var con25 = F.filter(function (r) { return r.imc_mayor25; }).length;
    html += conImc >= 0.8 * con25 ? tarjeta(graficoFrecuencias('imc', D.variable('imc_cat'), F, { titulo: 'Índice de masa corporal (OMS)', encabezado: 'Categoría' }))
      : tarjeta(graficoFrecuencias('imc', D.variable('imc_mayor25'), F, { titulo: 'IMC de 25 o más', encabezado: 'IMC ≥ 25',
        sub: 'Sin peso y altura medidos: se usa el dato registrado (mayor o menor que 25)', vacio: 'No hay IMC con los filtros actuales.' }));
    html += tarjeta(graficoFrecuencias('punto', D.variable('puesto'), F, { titulo: 'Punto de relevamiento', lectura: false }));
    html += tarjeta(graficoFrecuencias('pais', D.variable('p01_nac_pais'), F, { titulo: 'Lugar de nacimiento' }));
    html += tarjeta(graficoMeses());
    html += tarjeta(graficoFaltantes(F), 'ancha');
    html += '</div>';
    return html;
  }

  /* Qué dato frena el cálculo de FINDRISK o Framingham con más frecuencia */
  function faltantes(F, clave) {
    var cuenta = {};
    F.forEach(function (r) { var c = r[clave]; if (c && c.aplica !== false) (c.faltan || []).forEach(function (x) { cuenta[x] = (cuenta[x] || 0) + 1; }); });
    var lista = Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a]; }).slice(0, 4);
    if (!lista.length) return '';
    return 'Lo que más falta: ' + lista.map(function (k) { return k.toLowerCase() + ' (' + num(cuenta[k]) + ')'; }).join(', ') + '.';
  }

  function graficoMeses() {
    var filas = D.filtrar(cache.base, estado.filtros), cuenta = {};
    filas.forEach(function (r) { if (r.fecha) { var m = r.fecha.slice(0, 7); cuenta[m] = (cuenta[m] || 0) + 1; } });
    var meses = Object.keys(cuenta).sort();
    var NOM = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    // completa los meses intermedios sin relevamientos
    if (meses.length > 1) {
      var lista = [], a = meses[0], b = meses[meses.length - 1], y = Number(a.slice(0, 4)), m = Number(a.slice(5, 7));
      while (y < Number(b.slice(0, 4)) || (y === Number(b.slice(0, 4)) && m <= Number(b.slice(5, 7)))) {
        lista.push(y + '-' + ('0' + m).slice(-2)); m++; if (m > 12) { m = 1; y++; }
        if (lista.length > 60) break;
      }
      meses = lista;
    }
    var items = meses.map(function (k) { return { etiqueta: NOM[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4), n: cuenta[k] || 0, tip: NOM[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4) + ': ' + num(cuenta[k] || 0) + ' relevamientos' }; });
    var sinFecha = filas.length - filas.filter(function (r) { return r.fecha; }).length;
    var g = { id: 'meses', titulo: 'Relevamientos por mes', subtitulo: num(filas.length) + ' relevamientos (visitas, no participantes)' + (sinFecha ? ' · sin fecha: ' + num(sinFecha) : ''),
      tabla: { cabecera: ['Mes', 'Relevamientos'], filas: items.map(function (i) { return [i.etiqueta, num(i.n)]; }) },
      dibujar: function (t) { return G.columnas(items, t, { ancho: anchoActual, titulo: 'Relevamientos por mes' }); } };
    if (!items.length) g.vacio = 'No hay fechas cargadas.';
    return g;
  }

  /* Preguntas y mediciones con menos datos (para planificar las próximas entrevistas) */
  function graficoFaltantes(F) {
    var vars = D.diccionario().filter(function (v) {
      return (/^p\d\d_/.test(v.id) && !/_otro$|_detalle$|_cuales|_lic_|_frec_.*_otro/.test(v.id) && v.tipo !== 'texto') ||
        ['b_sexo', 'b_peso_kg', 'b_altura_m', 'b_perimetro_cm', 'b_pas_mmhg', 'b_dbt_dx', 'b_hta_dx', 'b_med_antihta', 'b_glucosa_previa',
          'b_antec_fam_dbt', 'b_act_fisica', 'b_fyv_diario', 'b_fuma', 'g_resultado_mgdl', 'edad'].indexOf(v.id) >= 0;
    });
    var lista = vars.map(function (v) {
      var n = F.filter(function (r) { return D.tieneDato(r, v); }).length;
      return { v: v, n: n, pct: F.length ? n / F.length * 100 : 0 };
    }).sort(function (a, b) { return a.pct - b.pct; });
    var peores = lista.slice(0, 12);
    var g = { id: 'faltan', titulo: 'Preguntas y mediciones con menos datos', subtitulo: '% de ' + num(F.length) + ' ' + nombreUnidad(F.length) + ' con dato · las 12 más incompletas de ' + lista.length,
      lectura: 'Sirve para planificar la próxima visita: lo que está abajo de todo es lo que más hay que preguntar o medir. La lista completa está en «Ver tabla».',
      tabla: { cabecera: ['Pregunta o medición', 'Con dato', '% con dato'], filas: lista.map(function (x) { return [x.v.etiqueta, num(x.n), num(x.pct, 1)]; }) },
      dibujar: function (t) { return G.barrasH(peores.map(function (x) { return { etiqueta: x.v.etiqueta, n: x.n, pct: x.pct, color: t.acento }; }), t, { ancho: anchoActual, titulo: 'Preguntas con menos datos' }); } };
    if (!F.length) g.vacio = 'Sin datos.';
    return g;
  }

  /* ---------- Explorar ---------- */
  function opcionesVariables(tipos, actual, conVacia) {
    var dic = D.diccionario(), html = conVacia ? '<option value="">' + esc(conVacia) + '</option>' : '';
    D.SECCIONES_ORDEN.forEach(function (s) {
      var vs = dic.filter(function (v) { return v.seccion === s && tipos.indexOf(v.tipo) >= 0; });
      if (!vs.length) return;
      html += '<optgroup label="' + esc(s) + '">' + vs.map(function (v) {
        return '<option value="' + v.id + '"' + (v.id === actual ? ' selected' : '') + '>' + esc(v.etiqueta) + '</option>';
      }).join('') + '</optgroup>';
    });
    return html;
  }

  function vExplorar() {
    var ex = estado.explorar, v = D.variable(ex.v) || D.variable('p01_nac_pais'), por = ex.por ? D.variable(ex.por) : null, F = cache.filtradas;
    var html = '<div class="tarjeta"><div class="controles">' +
      '<label class="campo"><span>Pregunta o medición</span><select class="entrada" data-campo="explorar.v">' + opcionesVariables(['categorica', 'multiple', 'numerica'], v.id) + '</select></label>' +
      '<label class="campo"><span>Comparar entre grupos de</span><select class="entrada" data-campo="explorar.por">' + opcionesVariables(['categorica', 'multiple'], ex.por, 'Sin comparar (todos juntos)') + '</select></label>' +
      '</div><p class="sub">' + esc(v.texto) + '</p></div>';
    var g;
    if (v.tipo === 'numerica') g = por ? graficoMediasPor(v, por, F) : graficoHistograma(v, F);
    else g = por ? graficoComparado(v, por, F) : graficoFrecuencias('exp', v, F);
    html += tarjeta(g);
    return html;
  }

  function unidadDe(v) {
    return { b_peso_kg: 'kg', b_altura_m: 'm', b_imc: 'kg/m²', b_perimetro_cm: 'cm', b_pas_mmhg: 'mmHg', g_resultado_mgdl: 'mg/dL',
      edad: 'años', p10_anios_chofer: 'años', p16_horas_sin_parar: 'h', p19_horas_sueno: 'h', g_ayuno_min: 'min' }[v.id] || '';
  }

  function graficoHistograma(v, F) {
    var xs = D.numeros(F, v), r = E.resumen(xs), cajas = E.histograma(xs), u = unidadDe(v);
    var dec = cajas.length && cajas[0].hasta - cajas[0].desde < 1 ? 1 : 0;
    var items = cajas.map(function (c) { return { etiqueta: num(c.desde, dec), n: c.n, tip: num(c.desde, dec) + ' a menos de ' + num(c.hasta, dec) + (u ? ' ' + u : '') + ': ' + num(c.n) }; });
    var g = { id: 'exp', titulo: v.nombre, subtitulo: 'n = ' + num(r.n) + ' ' + nombreUnidad(r.n) + (F.length - r.n ? ' · sin dato: ' + num(F.length - r.n) : ''),
      lectura: textoNumerico(r, u),
      tabla: { cabecera: ['Intervalo', 'Cantidad'], filas: cajas.map(function (c) { return [num(c.desde, dec) + ' a < ' + num(c.hasta, dec), num(c.n)]; }) },
      dibujar: function (t) { return G.columnas(items, t, { ancho: anchoActual, pegadas: true, ejeX: v.nombre + (u ? ' (' + u + ')' : ''), titulo: v.nombre }); } };
    if (!r.n) g.vacio = 'Sin datos con los filtros actuales.';
    return g;
  }

  function graficoMediasPor(v, por, F) {
    var grupos = D.gruposDe(F, por, 8), u = unidadDe(v);
    var items = grupos.lista.map(function (gr) {
      var xs = F.filter(function (r) {
        var vals = D.valores(r, por);
        return gr === 'Otras' ? vals.some(function (x) { return grupos.otras.indexOf(x) >= 0; }) : vals.indexOf(gr) >= 0;
      }).map(function (r) { return r[v.id]; }).filter(function (x) { return typeof x === 'number'; });
      var s = E.resumen(xs);
      return { etiqueta: gr, n: s.n, media: s.media, de: s.de, mediana: s.mediana };
    });
    var g = { id: 'exp', titulo: v.nombre + ' según ' + minus(por.nombre), subtitulo: 'Media por grupo; la línea fina marca ± 1 desvío estándar',
      lectura: items.filter(function (i) { return i.n; }).length >= 2 ? 'Compará las medias junto con la cantidad de casos de cada grupo: con pocos casos la media cambia mucho.' : 'Hay menos de dos grupos con datos.',
      tabla: { cabecera: ['Grupo', 'n', 'Media', 'DE', 'Mediana'], filas: items.map(function (i) { return [i.etiqueta, num(i.n), num(i.media, 1), num(i.de, 1), num(i.mediana, 1)]; }) },
      dibujar: function (t) { return G.medias(items, t, { ancho: anchoActual, titulo: v.nombre }); } };
    if (!items.some(function (i) { return i.n; })) g.vacio = 'Sin datos con los filtros actuales.';
    return g;
  }

  function graficoComparado(v, por, F) {
    var x = D.cruce(F, v, por, { maxColumnas: 5, ocultarVacias: true });
    var cats = x.filas.map(function (f, i) {
      return { etiqueta: f, valores: x.columnas.map(function (c, j) { return { n: x.tabla[i][j], pct: x.totCol[j] ? x.tabla[i][j] / x.totCol[j] * 100 : 0 }; }) };
    });
    var titulo = v.nombre + ' según ' + minus(por.nombre);
    var g = { id: 'exp', titulo: titulo, subtitulo: '% dentro de cada grupo · n = ' + num(x.N) + ' con ambas respuestas',
      lectura: textoCruceGrupos(x), extra: textoPrueba(x),
      tabla: { cabecera: ['Respuesta'].concat(x.columnas.map(function (c, j) { return c + ' (n = ' + x.totCol[j] + ')'; })),
        filas: cats.map(function (c) { return [c.etiqueta].concat(c.valores.map(function (v2) { return num(v2.n) + ' (' + num(v2.pct, 1) + ' %)'; })); }) },
      dibujar: function (t) {
        var col = coloresDe(por, x.columnas, t);
        return G.agrupadasH(cats, x.columnas.map(function (c, j) { return { etiqueta: c, n: x.totCol[j], color: col[j] }; }), t, { ancho: anchoActual, titulo: titulo });
      } };
    if (!x.N) g.vacio = 'No hay casos con ambas preguntas respondidas.';
    return g;
  }
  function textoCruceGrupos(x) {
    if (!x.N) return '';
    var chicos = x.columnas.filter(function (c, j) { return x.totCol[j] < 10; });
    return 'Cada color es un grupo; los porcentajes se calculan dentro de cada grupo para poder compararlos aunque tengan distinto tamaño.' +
      (chicos.length ? ' Grupos con menos de 10 casos: ' + chicos.map(esc).join(', ') + '.' : '') + (x.otras.length ? ' «Otras» agrupa: ' + x.otras.map(esc).join(', ') + '.' : '');
  }

  /* ---------- Cruces ---------- */
  var SUGERENCIAS = [
    ['p34_actividad_fisica', 'fr_categoria', 'Actividad física × FINDRISK'],
    ['p20_frutas_verduras', 'fr_categoria', 'Frutas y verduras × FINDRISK'],
    ['horas_sin_parar_cat', 'imc_cat', 'Horas sin parar × IMC'],
    ['p13_relacion_laboral', 'fh_categoria', 'Relación laboral × Framingham'],
    ['sueno_cat', 'pas_140', 'Horas de sueño × presión ≥ 140'],
    ['p36_coquea', 'pas_140', 'Coqueo × presión ≥ 140'],
    ['p01_nac_pais', 'imc_cat', 'Lugar de nacimiento × IMC'],
    ['puesto', 'fr_categoria', 'Punto × FINDRISK'],
    ['grupo_edad', 'fh_categoria', 'Edad × Framingham']
  ];

  function vCruces() {
    var c = estado.cruce, vf = D.variable(c.f), vc = D.variable(c.c), F = cache.filtradas;
    var html = '<div class="tarjeta"><div class="controles">' +
      '<label class="campo"><span>Filas</span><select class="entrada" data-campo="cruce.f">' + opcionesVariables(['categorica', 'multiple'], c.f) + '</select></label>' +
      '<label class="campo"><span>Columnas</span><select class="entrada" data-campo="cruce.c">' + opcionesVariables(['categorica', 'multiple'], c.c) + '</select></label>' +
      '<label class="campo" style="flex-basis:200px"><span>Mostrar</span><select class="entrada" data-campo="cruce.mostrar">' +
      [['fila', '% por fila'], ['columna', '% por columna'], ['n', 'Cantidad'], ['media', 'Promedio de una medida']].map(function (o) {
        return '<option value="' + o[0] + '"' + (c.mostrar === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      (c.mostrar === 'media' ? '<label class="campo"><span>Medida</span><select class="entrada" data-campo="cruce.num">' + opcionesVariables(['numerica'], c.num) + '</select></label>' : '') +
      '<button type="button" class="btn sec chico" data-accion="invertir">Invertir filas y columnas</button></div>' +
      '<div><p class="sub" style="margin-bottom:6px">Cruces sugeridos entre la sociodemográfica y la biológica</p><div class="chips">' +
      SUGERENCIAS.map(function (s) { return '<button type="button" class="chip" data-accion="sugerencia" data-f="' + s[0] + '" data-c="' + s[1] + '">' + esc(s[2]) + '</button>'; }).join('') +
      '</div></div></div>';
    var x = D.cruce(F, vf, vc, { maxColumnas: 8, ocultarVacias: true, numerica: c.mostrar === 'media' ? D.variable(c.num) : null });
    var titulo = vf.nombre + ' × ' + vc.nombre;
    var filasG = x.filas.map(function (f, i) {
      return { etiqueta: f, base: x.totFila[i], partes: x.columnas.map(function (cc, j) { return { n: x.tabla[i][j], pct: x.totFila[i] ? x.tabla[i][j] / x.totFila[i] * 100 : 0 }; }) };
    }).filter(function (f) { return f.base > 0; });
    var g = { id: 'cruce', titulo: titulo, subtitulo: '% por fila · n = ' + num(x.N) + ' ' + nombreUnidad(x.N) + ' con ambas respuestas' + (x.sinDato ? ' · sin alguno de los dos datos: ' + num(x.sinDato) : ''),
      lectura: textoCruce(x, vf, vc), extra: textoPrueba(x),
      tabla: tablaCruce(x, 'fila'),
      dibujar: function (t) {
        var col = coloresDe(vc, x.columnas, t);
        return G.apiladas100(filasG, x.columnas.map(function (cc, j) { return { etiqueta: cc, color: col[j], textoSobre: textoSobre(col[j]) }; }), t, { ancho: anchoActual, titulo: titulo });
      } };
    if (!x.N) g.vacio = 'No hay casos con ambas preguntas respondidas con los filtros actuales.';
    html += tarjeta(g);
    if (x.N) html += '<article class="tarjeta"><header><h3>Tabla dinámica</h3><p class="sub">' + ({ fila: 'Porcentaje de cada fila', columna: 'Porcentaje de cada columna', n: 'Cantidad de casos', media: 'Promedio de ' + esc(D.variable(c.num).nombre) + ' (n entre paréntesis)' })[c.mostrar] + '</p></header>' +
      '<div class="desplazable">' + tablaCalor(x, c.mostrar) + '</div></article>';
    return html;
  }

  function tablaCruce(x, modo) {
    return { cabecera: [''].concat(x.columnas).concat(['Total']), filas: x.filas.map(function (f, i) {
      return [f].concat(x.columnas.map(function (c, j) {
        var n = x.tabla[i][j];
        return modo === 'n' ? num(n) : num(n) + ' (' + num(x.totFila[i] ? n / x.totFila[i] * 100 : 0, 1) + ' %)';
      })).concat([num(x.totFila[i])]);
    }).concat([{ total: true, celdas: ['Total'].concat(x.totCol.map(function (n) { return num(n); })).concat([num(x.N)]) }]) };
  }

  function tablaCalor(x, modo) {
    var vals = [], celdas = x.filas.map(function (f, i) {
      return x.columnas.map(function (c, j) {
        var n = x.tabla[i][j], v, txt;
        if (modo === 'fila') { v = x.totFila[i] ? n / x.totFila[i] * 100 : null; txt = v === null ? '—' : num(v, 1) + ' %'; }
        else if (modo === 'columna') { v = x.totCol[j] ? n / x.totCol[j] * 100 : null; txt = v === null ? '—' : num(v, 1) + ' %'; }
        else if (modo === 'media') { var s = E.resumen(x.medias[i][j]); v = s.n ? s.media : null; txt = s.n ? num(s.media, 1) + ' <span style="color:var(--tenue)">(' + s.n + ')</span>' : '—'; }
        else { v = n; txt = num(n); }
        if (v !== null) vals.push(v);
        return { v: v, txt: txt };
      });
    });
    var max = Math.max.apply(null, vals.concat([1e-9])), min = modo === 'media' ? Math.min.apply(null, vals.concat([max])) : 0;
    var html = '<table class="datos"><thead><tr><th></th>' + x.columnas.map(function (c) { return '<th class="n">' + esc(c) + '</th>'; }).join('') + '<th class="n">Total</th></tr></thead><tbody>';
    x.filas.forEach(function (f, i) {
      if (!x.totFila[i]) return;
      html += '<tr><th scope="row" style="position:static">' + esc(f) + '</th>' + celdas[i].map(function (c) {
        var a = c.v === null ? 0 : (c.v - min) / ((max - min) || 1);
        return '<td class="n celda-calor" style="background:color-mix(in srgb, var(--g-acento) ' + Math.round(a * 42) + '%, transparent)">' + c.txt + '</td>';
      }).join('') + '<td class="n">' + num(x.totFila[i]) + '</td></tr>';
    });
    html += '<tr class="total"><td>Total</td>' + x.totCol.map(function (n) { return '<td class="n">' + num(n) + '</td>'; }).join('') + '<td class="n">' + num(x.N) + '</td></tr></tbody></table>';
    return html;
  }

  /* ---------- Relaciones ---------- */
  var SUGERENCIAS_REL = [['p16_horas_sin_parar', 'b_imc', 'Horas sin parar × IMC'], ['edad', 'b_pas_mmhg', 'Edad × presión sistólica'],
    ['b_imc', 'b_perimetro_cm', 'IMC × perímetro abdominal'], ['b_imc', 'g_resultado_mgdl', 'IMC × glucemia'], ['p19_horas_sueno', 'b_pas_mmhg', 'Horas de sueño × presión'],
    ['p10_anios_chofer', 'fr_puntos', 'Años como chofer × puntaje FINDRISK']];

  function vRelaciones() {
    var r = estado.relacion, vx = D.variable(r.x), vy = D.variable(r.y), vcol = r.color ? D.variable(r.color) : null, F = cache.filtradas;
    var html = '<div class="tarjeta"><div class="controles">' +
      '<label class="campo"><span>Eje horizontal</span><select class="entrada" data-campo="relacion.x">' + opcionesVariables(['numerica'], r.x) + '</select></label>' +
      '<label class="campo"><span>Eje vertical</span><select class="entrada" data-campo="relacion.y">' + opcionesVariables(['numerica'], r.y) + '</select></label>' +
      '<label class="campo"><span>Color por (hasta 3 grupos)</span><select class="entrada" data-campo="relacion.color">' + opcionesVariables(['categorica'], r.color, 'Un solo color') + '</select></label>' +
      '<label class="casilla"><input type="checkbox" data-campo="relacion.recta"' + (r.recta ? ' checked' : '') + '> Recta de tendencia</label></div>' +
      '<div class="chips">' + SUGERENCIAS_REL.map(function (s) { return '<button type="button" class="chip" data-accion="sug-rel" data-x="' + s[0] + '" data-y="' + s[1] + '">' + esc(s[2]) + '</button>'; }).join('') + '</div></div>';
    var pares = F.filter(function (row) { return typeof row[vx.id] === 'number' && typeof row[vy.id] === 'number'; });
    var grupos = vcol ? D.gruposDe(pares, vcol, 3) : null;
    var pe = E.pearson(pares.map(function (p) { return p[vx.id]; }), pares.map(function (p) { return p[vy.id]; }));
    var sp = E.spearman(pares.map(function (p) { return p[vx.id]; }), pares.map(function (p) { return p[vy.id]; }));
    var ux = unidadDe(vx), uy = unidadDe(vy);
    var titulo = vy.nombre + ' según ' + minus(vx.nombre);
    var lectura = pares.length < 3 ? 'Hacen falta al menos 3 casos con las dos medidas.' :
      'Con <strong>' + num(pares.length) + '</strong> ' + nombreUnidad(pares.length) + ' con ambas medidas: r de Pearson = <strong>' + num(pe ? pe.r : NaN, 2) + '</strong> (' + (pe ? textoP(pe.p) : '—') + '); ρ de Spearman = ' + num(sp ? sp.rho : NaN, 2) + ' (' + (sp ? textoP(sp.p) : '—') + '). ' +
      (pe ? (Math.abs(pe.r) < 0.1 ? 'Prácticamente no hay relación lineal.' : 'La relación es ' + (pe.r > 0 ? 'positiva' : 'negativa') + ' y ' + (Math.abs(pe.r) < 0.3 ? 'débil' : Math.abs(pe.r) < 0.5 ? 'moderada' : 'fuerte') + '. ') : '') +
      ' Una correlación no indica causa.' + (pares.length < 30 ? ' Con menos de 30 casos, un solo valor extremo puede cambiar mucho el resultado.' : '');
    var g = { id: 'rel', titulo: titulo, subtitulo: 'Cada punto es un ' + nombreUnidad(1) + ' · n = ' + num(pares.length), lectura: lectura,
      tabla: { cabecera: ['ID', vx.nombre, vy.nombre].concat(vcol ? [vcol.nombre] : []), filas: pares.map(function (p) { return [p.participante_id || p.id, num(p[vx.id], 1), num(p[vy.id], 1)].concat(vcol ? [p[vcol.id] || ''] : []); }) },
      dibujar: function (t) {
        var col = grupos ? coloresDe(vcol, grupos.lista, t) : null;
        var pts = pares.map(function (p) {
          var gr = null;
          if (grupos) { var v0 = (D.valores(p, vcol)[0]) || ''; gr = grupos.lista.indexOf(v0) >= 0 ? v0 : (v0 ? 'Otras' : ''); }
          return { x: p[vx.id], y: p[vy.id], color: gr && col ? col[grupos.lista.indexOf(gr)] : (grupos ? t.tenue : t.acento),
            tip: (p.participante_id || '') + ' · ' + vx.nombre + ': ' + num(p[vx.id], 1) + ' · ' + vy.nombre + ': ' + num(p[vy.id], 1) + (gr ? ' · ' + gr : '') };
        });
        return G.dispersion(pts, t, { ancho: anchoActual, ejeX: vx.nombre + (ux ? ' (' + ux + ')' : ''), ejeY: vy.nombre + (uy ? ' (' + uy + ')' : ''), recta: r.recta && pe ? pe : null,
          grupos: grupos ? grupos.lista.map(function (gname, i) { return { etiqueta: gname, color: col[i] }; }) : null, titulo: titulo });
      } };
    if (pares.length < 3) g.vacio = 'Hacen falta al menos 3 ' + nombreUnidad(3) + ' con las dos medidas. Ahora hay ' + num(pares.length) + '.';
    html += tarjeta(g);
    return html;
  }

  /* ---------- Participantes ---------- */
  var CONTROL = null;
  function variablesControl() {
    if (CONTROL) return CONTROL;
    CONTROL = D.diccionario().filter(function (v) {
      return (/^p\d\d_/.test(v.id) && !/_otro$|_detalle$|_cuales|_lic_/.test(v.id) && v.tipo !== 'texto') ||
        ['edad', 'b_sexo', 'b_peso_kg', 'b_altura_m', 'b_perimetro_cm', 'b_pas_mmhg', 'b_dbt_dx', 'b_hta_dx', 'b_med_antihta', 'b_glucosa_previa',
          'b_antec_fam_dbt', 'b_act_fisica', 'b_fyv_diario', 'b_fuma', 'g_resultado_mgdl'].indexOf(v.id) >= 0;
    });
    return CONTROL;
  }

  function vParticipantes() {
    var P = D.filtrar(cache.participantes, estado.filtros), ctl = variablesControl(), op = estado.participantes;
    var filas = P.map(function (r) {
      var con = ctl.filter(function (v) { return D.tieneDato(r, v); }).length;
      var faltaBio = ['b_peso_kg', 'b_altura_m', 'b_perimetro_cm', 'b_pas_mmhg', 'g_resultado_mgdl'].filter(function (k) { return typeof r[k] !== 'number'; }).length;
      return { r: r, completo: con / ctl.length * 100, con: con, faltaBio: faltaBio };
    });
    if (op.buscar) filas = filas.filter(function (f) { return String(f.r.participante_id).toLowerCase().indexOf(op.buscar.toLowerCase()) >= 0; });
    var clave = { completo: function (f) { return f.completo; }, id: function (f) { return f.r.participante_id; }, visitas: function (f) { return f.r.visitas; },
      fecha: function (f) { return f.r.fecha || ''; }, punto: function (f) { return f.r.puesto || ''; }, fr: function (f) { return f.r.fr_puntos === undefined ? -1 : f.r.fr_puntos; } }[op.orden] || function (f) { return f.completo; };
    filas.sort(function (a, b) { var x = clave(a), y = clave(b); return (x < y ? -1 : x > y ? 1 : 0) * (op.asc ? 1 : -1); });
    var promedio = filas.length ? filas.reduce(function (a, f) { return a + f.completo; }, 0) / filas.length : 0;
    var sinBio = filas.filter(function (f) { return f.faltaBio === 5; }).length;
    function th(id, t) { return '<th' + (id === 'id' || id === 'punto' ? '' : ' class="n"') + '><button type="button" data-accion="ordenar" data-orden="' + id + '">' + t + (op.orden === id ? (op.asc ? ' ↑' : ' ↓') : '') + '</button></th>'; }
    var html = '<div class="kpis">' +
      '<div class="kpi"><span class="rotulo">Participantes</span><span class="valor">' + num(filas.length) + '</span><span class="detalle">con los filtros actuales</span></div>' +
      '<div class="kpi"><span class="rotulo">Completitud promedio</span><span class="valor">' + pct(promedio) + '</span><span class="detalle">de ' + ctl.length + ' preguntas y mediciones</span></div>' +
      '<div class="kpi"><span class="rotulo">Sin ninguna medición</span><span class="valor">' + num(sinBio) + '</span><span class="detalle">sin peso, altura, perímetro, presión ni glucemia</span></div></div>';
    html += '<div class="tarjeta"><div class="form-fila"><label class="campo" style="max-width:260px"><span>Buscar por ID</span><input class="entrada" data-campo="participantes.buscar" value="' + esc(op.buscar) + '" placeholder="p. ej. P1-0014"></label>' +
      '<button type="button" class="btn sec chico" data-accion="csv-participantes">Descargar esta tabla (CSV)</button></div>' +
      '<p class="sub">Los riesgos se calculan con los datos de todas las visitas de cada persona. El nombre no aparece acá: está solo en la hoja privada «Participantes» de la planilla previa.</p>' +
      '<div class="desplazable"><table class="datos"><thead><tr>' + th('id', 'ID') + th('punto', 'Punto') + th('visitas', 'Visitas') + th('fecha', 'Última visita') +
      '<th class="n">Edad</th>' + th('completo', '% datos') + '<th class="n">IMC</th>' + th('fr', 'FINDRISK') + '<th>Framingham</th><th class="n">Glucemia</th><th>Origen</th></tr></thead><tbody>' +
      filas.map(function (f) {
        var r = f.r;
        return '<tr><td class="mono">' + esc(r.participante_id) + '</td><td>' + esc(r.puesto || '') + '</td><td class="n">' + num(r.visitas) + '</td><td class="n">' + esc(fechaCorta(r.fecha)) +
          '</td><td class="n">' + (typeof r.edad === 'number' ? num(r.edad) : '—') + '</td><td class="n"><span class="barra-mini" style="width:' + Math.round(f.completo * 0.5) + 'px"></span>' + num(f.completo) + ' %</td>' +
          '<td class="n">' + (typeof r.b_imc === 'number' ? num(r.b_imc, 1) : '—') + '</td><td class="n">' + (r.fr_categoria ? esc(r.fr_categoria) + (r.fr_puntos !== undefined ? ' (' + r.fr_puntos + ')' : '') : '—') +
          '</td><td>' + (r.fh_categoria ? esc(r.fh_categoria) + (r.fh_riesgo ? ' (' + esc(r.fh_riesgo) + ' %)' : '') : '—') + '</td><td class="n">' + (typeof r.g_resultado_mgdl === 'number' ? num(r.g_resultado_mgdl) : '—') +
          '</td><td>' + esc(String(r.origen || '').replace(/; /g, ' + ')) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    // completitud por sección
    var secciones = {};
    ctl.forEach(function (v) { (secciones[v.seccion] = secciones[v.seccion] || []).push(v); });
    var items = Object.keys(secciones).map(function (s) {
      var vs = secciones[s], tot = vs.length * P.length, con = 0;
      P.forEach(function (r) { vs.forEach(function (v) { if (D.tieneDato(r, v)) con++; }); });
      return { etiqueta: s === 'Relevamiento' ? 'Edad' : s, n: con, pct: tot ? con / tot * 100 : 0 };
    });
    html += tarjeta({ id: 'secciones', titulo: 'Avance del instrumento por sección', subtitulo: '% de preguntas respondidas · ' + num(P.length) + ' participantes',
      lectura: 'Muestra qué partes de la encuesta están más incompletas en el conjunto de participantes.',
      tabla: { cabecera: ['Sección', 'Respuestas con dato', '% del total posible'], filas: items.map(function (i) { return [i.etiqueta, num(i.n), num(i.pct, 1)]; }) },
      dibujar: function (t) { return G.barrasH(items.map(function (i) { return { etiqueta: i.etiqueta, n: i.n, pct: i.pct, color: t.acento }; }), t, { ancho: anchoActual, titulo: 'Avance por sección' }); },
      vacio: P.length ? '' : 'Sin participantes con los filtros actuales.' });
    graficos._participantes = filas;
    return html;
  }

  /* ---------- Informe ---------- */
  function vInforme() {
    var items = estado.informe;
    var html = '<div class="tarjeta no-imprimir"><div class="form-fila">' +
      '<button type="button" class="btn" data-accion="descargar-informe"' + (items.length ? '' : ' disabled') + '>Descargar informe (HTML)</button>' +
      (window.claude ? '' : '<button type="button" class="btn sec" data-accion="imprimir"' + (items.length ? '' : ' disabled') + '>Imprimir o guardar como PDF</button>') +
      (items.length ? '<button type="button" class="btn fantasma" data-accion="vaciar-informe">Vaciar el informe</button>' : '') + '</div>' +
      '<p class="sub">El informe guarda cada gráfico tal como estaba al agregarlo (con sus filtros). Las notas que escribas se incluyen debajo de cada uno.</p></div>';
    if (!items.length) return html + '<div class="vacio">Todavía no agregaste gráficos. En cualquier gráfico, tocá «Agregar al informe».</div>';
    html += '<div class="tarjeta"><h3>Fuente y alcance</h3><p class="lectura">' + esc(pieExportacion()) + '</p></div>';
    items.forEach(function (it, i) {
      html += '<article class="tarjeta item-informe"><div class="imagen">' + it.svg + '</div>' + (it.lectura ? '<p class="lectura">' + it.lectura + '</p>' : '') +
        '<label class="campo" style="max-width:none"><span>Nota (opcional)</span><textarea class="entrada" rows="2" data-nota="' + i + '">' + esc(it.nota || '') + '</textarea></label>' +
        '<div class="acciones no-imprimir"><button type="button" class="btn chico fantasma" data-accion="subir" data-i="' + i + '"' + (i ? '' : ' disabled') + '>Subir</button>' +
        '<button type="button" class="btn chico fantasma" data-accion="bajar" data-i="' + i + '"' + (i < items.length - 1 ? '' : ' disabled') + '>Bajar</button>' +
        '<button type="button" class="btn chico fantasma" data-accion="quitar" data-i="' + i + '">Quitar</button></div></article>';
    });
    return html;
  }

  function informeHtml() {
    var cuerpo = estado.informe.map(function (it) {
      return '<section><div class="img">' + it.svg + '</div>' + (it.lectura ? '<p>' + it.lectura + '</p>' : '') + (it.nota ? '<p class="nota">' + esc(it.nota) + '</p>' : '') + '</section>';
    }).join('');
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe · Relevamiento Corredor Bioceánico</title>' +
      '<style>body{font-family:Arial,Helvetica,sans-serif;color:#1C1E21;max-width:860px;margin:32px auto;padding:0 20px;line-height:1.45}h1{font-size:26px;margin:0 0 4px}' +
      '.alcance{color:#4A4E54;font-size:14px;border-bottom:1px solid #DCD6C8;padding-bottom:14px}section{margin:28px 0;break-inside:avoid}.img svg{width:100%;height:auto}' +
      'p{font-size:14px;color:#4A4E54}.nota{color:#1C1E21;border-left:3px solid #1A588F;padding-left:10px}</style></head><body>' +
      '<h1>Relevamiento Corredor Bioceánico · Jujuy</h1><p class="alcance">' + esc(pieExportacion()) + '</p>' + cuerpo + '</body></html>';
  }

  /* ---------- Fuentes ---------- */
  function vFuentes() {
    var c = estado.conexion, html = '<div class="rejilla">';
    html += '<div class="tarjeta"><h3>Cargar planillas</h3><div class="zona-carga" id="zona-carga"><strong>Arrastrá acá los archivos</strong><span class="sub">o</span>' +
      '<label class="btn"><input type="file" id="archivo" accept=".xlsx,.csv,.txt" multiple hidden>Elegir archivos</label>' +
      '<span class="sub">Excel (.xlsx) con la hoja «Datos» o CSV de la app. Podés cargar varios: se unen y no se duplican.</span></div>' +
      '<p class="nota-privacidad">Los archivos se leen en este navegador y no se suben a ningún servidor. Al cerrar la pestaña, se borran de acá.</p>' +
      '<p class="sub"><strong>Planilla de Google:</strong> Archivo › Descargar › Microsoft Excel (.xlsx) y cargala acá. <strong>Planilla previa:</strong> el archivo Tablero_previo_entrevistas.xlsx.</p></div>';
    if (window.claude) html += '<div class="tarjeta"><h3>Leer directo de la planilla de Google</h3><p class="lectura">Esta opción funciona en el tablero publicado en GitHub (la misma dirección de la app, terminada en <span class="mono">/tablero/</span>). Acá podés cargar la planilla descargada como Excel.</p></div>';
    else html += '<div class="tarjeta"><h3>Leer directo de la planilla de Google</h3><p class="sub">Necesita el script de la planilla en la versión 1.3 o posterior. Usa la misma dirección y clave que la app.</p>' +
      '<label class="campo" style="max-width:none"><span>Dirección de la aplicación web (Apps Script)</span><input class="entrada" data-campo="conexion.url" value="' + esc(c.url) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' +
      '<label class="campo" style="max-width:none"><span>Clave del equipo</span><input class="entrada" type="password" data-campo="conexion.clave" value="' + esc(c.clave) + '"></label>' +
      '<label class="casilla"><input type="checkbox" data-campo="conexion.recordar"' + (c.recordar ? ' checked' : '') + '> Recordar la clave en esta computadora</label>' +
      '<div class="form-fila"><button type="button" class="btn" data-accion="leer-google">Leer la planilla</button></div></div>';
    html += '</div>';
    html += '<div class="tarjeta"><h3>Planillas cargadas</h3>';
    if (!estado.fuentes.length) html += '<div class="vacio">No hay planillas cargadas.</div>';
    else {
      html += '<div class="desplazable"><table class="datos"><thead><tr><th>Usar</th><th>Archivo</th><th>Nombre en los gráficos</th><th class="n">Filas</th><th>Hoja</th><th></th></tr></thead><tbody>' +
        estado.fuentes.map(function (f, i) {
          return '<tr><td><input type="checkbox" data-activa="' + i + '"' + (f.activa !== false ? ' checked' : '') + ' aria-label="Usar ' + esc(f.nombre) + '"></td><td>' + esc(f.nombre) + (f.ejemplo ? ' <span class="pildora ejemplo">ficticio</span>' : '') +
            '</td><td><input class="entrada" style="min-height:32px;padding:4px 8px" data-etiqueta="' + i + '" value="' + esc(f.etiqueta) + '" aria-label="Nombre de la planilla"></td><td class="n">' + num(f.filas.length) +
            '</td><td>' + esc(f.hoja || '') + '</td><td><button type="button" class="btn chico fantasma" data-accion="quitar-fuente" data-i="' + i + '">Quitar</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      html += '<p class="sub">Unidas: ' + num(cache.base.length) + ' relevamientos de ' + num(cache.participantes.length) + ' participantes.' +
        (cache.duplicados ? ' Se descartaron ' + num(cache.duplicados) + ' filas repetidas (mismo id): quedó la versión modificada más recientemente.' : '') + '</p>';
    }
    html += '<div class="form-fila">' + (hayEjemplo() ? '<button type="button" class="btn sec" data-accion="quitar-ejemplo">Quitar los datos de ejemplo</button>' : '<button type="button" class="btn sec" data-accion="ejemplo">Cargar datos de ejemplo (ficticios)</button>') +
      (estado.fuentes.length ? '<button type="button" class="btn sec" data-accion="csv-filtrado">Descargar datos filtrados (CSV)</button>' : '') + '</div></div>';
    html += '<div class="tarjeta"><h3>Cómo se unen las planillas</h3><ul class="lectura">' +
      '<li>Cada relevamiento tiene un <strong>id</strong> único: si aparece en dos planillas, cuenta una sola vez.</li>' +
      '<li>Las visitas de una misma persona se unen por su <strong>ID de participante</strong> (por ejemplo P1-0014): en la vista por participantes, cada dato toma el valor más reciente que no esté vacío.</li>' +
      '<li>FINDRISK, Framingham e IMC se recalculan con las mismas fórmulas de la app, usando los datos unidos.</li>' +
      '<li>Variables agregadas para analizar: grupo de edad, IMC según OMS, presión ≥ 140, años como chofer, horas sin parar y horas de sueño agrupadas.</li></ul></div>';
    return html;
  }

  /* -------------------------------------------------------------- Filtros */
  function renderFiltros() {
    var cont = $('#filtros');
    if (!estado.fuentes.length) { cont.innerHTML = ''; return; }
    var set = conjunto(), html = '<div class="segmentado" role="group" aria-label="Unidad de análisis">' +
      '<button type="button" data-unidad="participantes" aria-pressed="' + (estado.unidad === 'participantes') + '">Participantes</button>' +
      '<button type="button" data-unidad="relevamientos" aria-pressed="' + (estado.unidad === 'relevamientos') + '">Relevamientos</button></div>';
    FILTROS_FIJOS.concat(estado.extraFiltros).forEach(function (id) { html += filtroCategorico(id, set); });
    var e = estado.filtros.edad, f = estado.filtros.fecha;
    var edadActiva = e[0] !== null || e[1] !== null, fechaActiva = !!(f[0] || f[1]);
    html += '<details class="filtro' + (edadActiva ? ' activo' : '') + '" data-filtro="edad"><summary>Edad' + (edadActiva ? ' <span class="cuenta">' + (e[0] !== null ? e[0] : '') + '–' + (e[1] !== null ? e[1] : '') + '</span>' : '') + '</summary><div class="menu">' +
      '<div class="rango"><input type="number" inputmode="numeric" placeholder="desde" data-rango="edad.0" value="' + (e[0] !== null ? e[0] : '') + '" aria-label="Edad desde"><span>a</span><input type="number" inputmode="numeric" placeholder="hasta" data-rango="edad.1" value="' + (e[1] !== null ? e[1] : '') + '" aria-label="Edad hasta"></div>' +
      '<div class="pie-menu"><button type="button" class="btn chico fantasma" data-accion="limpiar-rango" data-rango="edad">Limpiar</button><button type="button" class="btn chico" data-accion="cerrar-menu">Listo</button></div></div></details>';
    html += '<details class="filtro' + (fechaActiva ? ' activo' : '') + '" data-filtro="fecha"><summary>Período' + (fechaActiva ? ' <span class="cuenta">sí</span>' : '') + '</summary><div class="menu">' +
      '<div class="rango"><input type="date" data-rango="fecha.0" value="' + f[0] + '" aria-label="Desde"><input type="date" data-rango="fecha.1" value="' + f[1] + '" aria-label="Hasta"></div>' +
      '<div class="pie-menu"><button type="button" class="btn chico fantasma" data-accion="limpiar-rango" data-rango="fecha">Limpiar</button><button type="button" class="btn chico" data-accion="cerrar-menu">Listo</button></div></div></details>';
    html += '<details class="filtro" data-filtro="mas"><summary>Más filtros</summary><div class="menu"><label class="campo" style="max-width:none"><span>Filtrar también por</span><select class="entrada" data-accion-cambio="agregar-filtro">' +
      opcionesVariables(['categorica', 'multiple'], '', 'Elegí una pregunta…') + '</select></label></div></details>';
    var desc = descripcionFiltros();
    html += '<div class="resumen-filtros">' + num(cache.filtradas.length) + ' de ' + num(set.length) + ' ' + nombreUnidad(set.length) +
      (desc ? ' · ' + esc(desc) + ' <button type="button" class="btn chico fantasma" data-accion="limpiar-filtros">Quitar filtros</button>' : '') + '</div>';
    var abierto = (cont.querySelector('details[open]') || {}).dataset;
    cont.innerHTML = html;
    if (abierto && abierto.filtro) { var d = cont.querySelector('details[data-filtro="' + abierto.filtro + '"]'); if (d) d.open = true; }
  }

  function filtroCategorico(id, set) {
    var v = D.variable(id); if (!v) return '';
    var f = D.frecuencias(set, v), sel = estado.filtros.cat[id] || [];
    var cats = f.categorias.filter(function (c) { return c.n > 0; });
    if (f.sinDato) cats.push({ valor: D.SIN_DATO, n: f.sinDato });
    if (!cats.length) return '';
    var nombre = { origen: 'Planilla', puesto: 'Punto', equipo: 'Equipo', b_sexo: 'Sexo', p01_nac_pais: 'País de nacimiento' }[id] || v.nombre;
    return '<details class="filtro' + (sel.length ? ' activo' : '') + '" data-filtro="' + id + '"><summary>' + esc(nombre) + (sel.length ? ' <span class="cuenta">' + sel.length + '</span>' : '') + '</summary><div class="menu">' +
      cats.map(function (c) { return '<label><input type="checkbox" data-filtro-cat="' + id + '" value="' + esc(c.valor) + '"' + (sel.indexOf(c.valor) >= 0 ? ' checked' : '') + '><span>' + esc(c.valor) + '</span><span class="n">' + num(c.n) + '</span></label>'; }).join('') +
      '<div class="pie-menu"><button type="button" class="btn chico fantasma" data-accion="limpiar-cat" data-id="' + id + '">Limpiar</button>' +
      (FILTROS_FIJOS.indexOf(id) < 0 ? '<button type="button" class="btn chico fantasma" data-accion="quitar-filtro" data-id="' + id + '">Quitar filtro</button>' : '') +
      '<button type="button" class="btn chico" data-accion="cerrar-menu">Listo</button></div></div></details>';
  }

  function renderFuentesMini() {
    var cont = $('#fuentes-mini');
    if (!estado.fuentes.length) { cont.innerHTML = '<span>Sin datos cargados</span>'; return; }
    cont.innerHTML = '<span class="ceja">Planillas</span>' + estado.fuentes.map(function (f) {
      return '<div class="fila"><span title="' + esc(f.nombre) + '">' + (f.activa === false ? '<s>' : '') + esc(f.etiqueta) + (f.activa === false ? '</s>' : '') + '</span><span class="num">' + num(f.filas.length) + '</span></div>';
    }).join('');
  }

  /* -------------------------------------------------------------- Eventos */
  function asignar(ruta, valor) {
    var p = ruta.split('.'), obj = estado[p[0]];
    obj[p[1]] = valor;
  }

  document.addEventListener('click', function (e) {
    var ir = e.target.closest('[data-ir]');
    if (ir) { estado.vista = ir.dataset.ir; guardarPreferencias(); render(); window.scrollTo(0, 0); return; }
    var nav = e.target.closest('.nav button');
    if (nav) { estado.vista = nav.dataset.vista; guardarPreferencias(); render(); window.scrollTo(0, 0); return; }
    var un = e.target.closest('[data-unidad]');
    if (un) { estado.unidad = un.dataset.unidad; guardarPreferencias(); aplicar(); return; }
    // cerrar menús de filtro al tocar afuera
    $$('details.filtro[open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
    var b = e.target.closest('[data-accion]');
    if (!b || b.tagName === 'SELECT') return;
    var acc = b.dataset.accion, g = b.dataset.g ? graficos[b.dataset.g] : null;
    if (acc === 'tabla') { var tg = b.closest('.tarjeta').querySelector('.tabla-g'); tg.hidden = !tg.hidden; b.textContent = tg.hidden ? 'Ver tabla' : 'Ocultar tabla'; }
    else if (acc === 'png' && g) { var ex = exportable(g); G.aPng(ex.svg, ex.ancho, ex.alto).then(function (blob) { return guardarArchivo(nombreArchivo(g.titulo) + '.png', blob); }).catch(function (er) { aviso(er.message, true); }); }
    else if (acc === 'svg' && g) { guardarArchivo(nombreArchivo(g.titulo) + '.svg', exportable(g).svg, 'image/svg+xml'); }
    else if (acc === 'csv' && g) { guardarArchivo(nombreArchivo(g.titulo) + '.csv', tablaCsv(g.tabla), 'text/csv;charset=utf-8'); }
    else if (acc === 'informe' && g) {
      estado.informe.push({ svg: exportable(g).svg, lectura: (g.lectura || '') + (g.extra ? ' ' + g.extra.replace(/<div[^>]*>|<\/div>/g, '') : ''), nota: '', titulo: g.titulo });
      aviso('Agregado al informe (' + estado.informe.length + ').');
    }
    else if (acc === 'ejemplo') { cargarEjemplo(); aviso('Datos ficticios de ejemplo cargados.'); }
    else if (acc === 'quitar-ejemplo') { estado.fuentes = estado.fuentes.filter(function (f) { return !f.ejemplo; }); recalcularTodo(); }
    else if (acc === 'quitar-fuente') { estado.fuentes.splice(Number(b.dataset.i), 1); recalcularTodo(); }
    else if (acc === 'leer-google') leerGoogle();
    else if (acc === 'csv-filtrado') guardarArchivo('datos_filtrados_' + estado.unidad + '.csv', D.aCsv(cache.filtradas), 'text/csv;charset=utf-8');
    else if (acc === 'csv-participantes') {
      var fp = graficos._participantes || [];
      guardarArchivo('participantes.csv', tablaCsv({ cabecera: ['ID', 'Punto', 'Visitas', 'Última visita', 'Edad', '% datos', 'IMC', 'FINDRISK', 'Framingham', 'Glucemia', 'Origen'],
        filas: fp.map(function (f) { var r = f.r; return [r.participante_id, r.puesto || '', r.visitas, r.fecha || '', r.edad === undefined ? '' : r.edad, Math.round(f.completo), r.b_imc === undefined ? '' : num(r.b_imc, 1), r.fr_categoria || '', r.fh_categoria || '', r.g_resultado_mgdl === undefined ? '' : r.g_resultado_mgdl, String(r.origen || '').replace(/; /g, ' + ')]; }) }), 'text/csv;charset=utf-8');
    }
    else if (acc === 'ordenar') { var o = b.dataset.orden; if (estado.participantes.orden === o) estado.participantes.asc = !estado.participantes.asc; else { estado.participantes.orden = o; estado.participantes.asc = true; } render(); }
    else if (acc === 'sugerencia') { estado.cruce.f = b.dataset.f; estado.cruce.c = b.dataset.c; render(); }
    else if (acc === 'sug-rel') { estado.relacion.x = b.dataset.x; estado.relacion.y = b.dataset.y; render(); }
    else if (acc === 'invertir') { var tmp = estado.cruce.f; estado.cruce.f = estado.cruce.c; estado.cruce.c = tmp; render(); }
    else if (acc === 'limpiar-cat') { delete estado.filtros.cat[b.dataset.id]; aplicar(); }
    else if (acc === 'quitar-filtro') { delete estado.filtros.cat[b.dataset.id]; estado.extraFiltros = estado.extraFiltros.filter(function (x) { return x !== b.dataset.id; }); aplicar(); }
    else if (acc === 'limpiar-rango') { if (b.dataset.rango === 'edad') estado.filtros.edad = [null, null]; else estado.filtros.fecha = ['', '']; aplicar(); }
    else if (acc === 'limpiar-filtros') { estado.filtros = { cat: {}, edad: [null, null], fecha: ['', ''] }; aplicar(); }
    else if (acc === 'cerrar-menu') { var dm = b.closest('details'); if (dm) dm.open = false; }
    else if (acc === 'descargar-informe') guardarArchivo('informe_relevamiento.html', informeHtml(), 'text/html;charset=utf-8');
    else if (acc === 'imprimir') window.print();
    else if (acc === 'vaciar-informe') { estado.informe = []; render(); }
    else if (acc === 'subir' || acc === 'bajar') {
      var i = Number(b.dataset.i), j = acc === 'subir' ? i - 1 : i + 1, it = estado.informe.splice(i, 1)[0];
      estado.informe.splice(j, 0, it); render();
    }
    else if (acc === 'quitar') { estado.informe.splice(Number(b.dataset.i), 1); render(); }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.filtroCat) {
      var id = t.dataset.filtroCat, sel = estado.filtros.cat[id] || [];
      if (t.checked) { if (sel.indexOf(t.value) < 0) sel.push(t.value); } else sel = sel.filter(function (x) { return x !== t.value; });
      estado.filtros.cat[id] = sel; aplicar(); return;
    }
    if (t.dataset.rango) {
      var p = t.dataset.rango.split('.');
      if (p[0] === 'edad') estado.filtros.edad[Number(p[1])] = t.value === '' ? null : Number(t.value);
      else estado.filtros.fecha[Number(p[1])] = t.value;
      aplicar(); return;
    }
    if (t.dataset.accionCambio === 'agregar-filtro') {
      if (t.value && estado.extraFiltros.indexOf(t.value) < 0 && FILTROS_FIJOS.indexOf(t.value) < 0) estado.extraFiltros.push(t.value);
      render(); var d = $('details[data-filtro="' + t.value + '"]'); if (d) d.open = true; return;
    }
    if (t.dataset.activa) { estado.fuentes[Number(t.dataset.activa)].activa = t.checked; recalcularTodo(); return; }
    if (t.dataset.etiqueta) { estado.fuentes[Number(t.dataset.etiqueta)].etiqueta = t.value.trim() || 'Planilla'; recalcularTodo(); return; }
    if (t.id === 'archivo') { cargarArchivos(t.files); t.value = ''; return; }
    if (t.dataset.campo) {
      var ruta = t.dataset.campo, valor = t.type === 'checkbox' ? t.checked : t.value;
      asignar(ruta, valor);
      if (ruta.indexOf('conexion') === 0) { guardarPreferencias(); return; }
      if (ruta === 'participantes.buscar') return;
      render();
    }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.nota) { estado.informe[Number(t.dataset.nota)].nota = t.value; return; }
    if (t.dataset.campo === 'participantes.buscar') {
      estado.participantes.buscar = t.value;
      clearTimeout(t._reloj); t._reloj = setTimeout(function () { render(); var b = $('[data-campo="participantes.buscar"]'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 250);
    }
  });

  // Arrastrar y soltar archivos
  document.addEventListener('dragover', function (e) { var z = e.target.closest && e.target.closest('#zona-carga'); if (z) { e.preventDefault(); z.classList.add('encima'); } });
  document.addEventListener('dragleave', function (e) { var z = e.target.closest && e.target.closest('#zona-carga'); if (z) z.classList.remove('encima'); });
  document.addEventListener('drop', function (e) {
    var z = e.target.closest && e.target.closest('#zona-carga');
    if (z) { e.preventDefault(); z.classList.remove('encima'); cargarArchivos(e.dataTransfer.files); }
  });

  // Globo de ayuda sobre las marcas
  var globo = $('#globo');
  document.addEventListener('pointermove', function (e) {
    var m = e.target.closest && e.target.closest('[data-tip]');
    if (!m || !m.closest('.lienzo')) { globo.hidden = true; return; }
    globo.textContent = m.getAttribute('data-tip');
    globo.hidden = false;
    var x = e.clientX + 14, y = e.clientY + 14, w = globo.offsetWidth, h = globo.offsetHeight;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 10;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 10;
    globo.style.left = x + 'px'; globo.style.top = y + 'px';
  });

  // Al cambiar el tamaño de la ventana, los gráficos se redibujan a su ancho real
  var relojAncho;
  window.addEventListener('resize', function () { clearTimeout(relojAncho); relojAncho = setTimeout(dibujarLienzos, 150); });

  // Cambio de tema: se vuelven a dibujar los gráficos con la paleta nueva
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { render(); }); } catch (e) { /* navegador viejo */ }
  new MutationObserver(function () { render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  var relojAviso;
  function aviso(msg, error) {
    var a = $('#aviso');
    a.textContent = msg; a.hidden = false;
    a.style.background = error ? 'var(--alerta)' : '';
    clearTimeout(relojAviso); relojAviso = setTimeout(function () { a.hidden = true; }, error ? 7000 : 3200);
  }

  /* --------------------------------------------------------------- Inicio */
  if (!VISTAS[estado.vista]) estado.vista = 'resumen';
  cargarEjemplo();
  if (!estado.fuentes.length) render();
  window.Tablero = { estado: estado, cache: cache, cargarArchivos: cargarArchivos, render: render };
})();
