/*
 * datos.js — Lectura de planillas, unión de fuentes, recálculo de riesgos, variables
 * derivadas, unión por participante, filtros y agregaciones del tablero.
 *
 * El diccionario de variables sale de ../js/cuestionario.js (el mismo de la app), así que
 * una pregunta nueva en la app aparece sola en el tablero. Los riesgos se recalculan con
 * ../js/calculos.js, igual que en la app.
 */
(function (raiz) {
  'use strict';

  var enNode = typeof module !== 'undefined' && module.exports;
  var Inst = raiz.Instrumento || (enNode ? require('../../js/cuestionario.js') : null);
  var Calc = raiz.Calculos || (enNode ? require('../../js/calculos.js') : null);

  /* ---------------------------------------------------------------- Diccionario */

  var NUMERICAS = ['edad', 'orden', 'p10_anios_chofer', 'p16_horas_sin_parar', 'p19_horas_sueno', 'b_peso_kg', 'b_altura_m',
    'b_imc', 'b_perimetro_cm', 'b_pas_mmhg', 'g_resultado_mgdl', 'g_ayuno_min', 'fr_puntos', 'fh_puntos', 'socio_respondidas', 'visitas'];

  // Variables cuyas opciones tienen un orden (se dibujan con una escala de un solo color)
  var ORDINALES = ['p02_educacion', 'p04_convive', 'p05_a_cargo', 'p09_rutas_jujuy', 'p12_frec_corredor', 'p12_frec_jujuy',
    'p14_conformidad', 'p20_frutas_verduras', 'p22_sanitarios', 'p23_recreativas', 'p25_fin_de_mes', 'p28_frec_consulta',
    'p34_actividad_fisica', 'p38_comunicacion', 'grupo_edad', 'imc_cat', 'antiguedad_cat', 'horas_sin_parar_cat', 'sueno_cat'];
  var RIESGO = ['fr_categoria', 'fh_categoria'];

  // Columnas de control que no se ofrecen para graficar
  var OCULTAS = ['id', 'codigo', 'orden', 'cp', 'hora_inicio', 'hora_fin', 'dispositivo', 'consentimiento', 'comparte_app',
    'modificado', 'version_instrumento', 'g_hora_ingesta', 'g_hora_medicion', 'g_que_ingirio', 'fr_aplica', 'fh_aplica',
    'fr_probabilidad', 'fh_riesgo', 'participante_id', 'socio_completo', 'bio_completo', 'gluc_realizada', 'g_acepta'];

  var META = {
    origen: { texto: 'Origen de los datos (planilla)', seccion: 'Relevamiento', tipo: 'multiple' },
    puesto: { texto: 'Punto o puesto de relevamiento', seccion: 'Relevamiento' },
    equipo: { texto: 'Equipo', seccion: 'Relevamiento' },
    encuestador: { texto: 'Encuestador/es', seccion: 'Relevamiento', tipo: 'multiple' },
    fecha: { texto: 'Fecha del relevamiento', seccion: 'Relevamiento', tipo: 'fecha' },
    estado: { texto: 'Estado del relevamiento', seccion: 'Relevamiento' },
    edad: { texto: 'Edad (años)', seccion: 'Relevamiento' },
    visitas: { texto: 'Cantidad de visitas del participante', seccion: 'Relevamiento' }
  };

  var DERIVADAS = [
    { id: 'grupo_edad', texto: 'Grupo de edad', opciones: ['18 a 29', '30 a 39', '40 a 49', '50 a 59', '60 o más'] },
    { id: 'imc_cat', texto: 'IMC según OMS', opciones: ['Bajo peso (<18,5)', 'Normal (18,5 a 24,9)', 'Sobrepeso (25 a 29,9)', 'Obesidad (30 o más)'] },
    { id: 'pas_140', texto: 'Presión sistólica de 140 mmHg o más', opciones: ['Sí', 'No'] },
    { id: 'antiguedad_cat', texto: 'Años como chofer (agrupado)', opciones: ['Menos de 5', '5 a 14', '15 a 24', '25 o más'] },
    { id: 'horas_sin_parar_cat', texto: 'Horas de conducción sin parar (agrupado)', opciones: ['Hasta 2 h', 'Más de 2 a 4 h', 'Más de 4 a 6 h', 'Más de 6 h'] },
    { id: 'sueno_cat', texto: 'Horas de sueño por día (agrupado)', opciones: ['Menos de 6 h', '6 a 7 h', '8 h o más'] }
  ];

  var SECCIONES_ORDEN = ['Relevamiento', 'Origen y educación', 'Hogar', 'Idiomas y licencia', 'Trabajo y recorrido', 'Hábitos en ruta',
    'Economía y salud', 'Consumos y vínculos', 'Biológica', 'Riesgo calculado', 'Variables derivadas'];

  // Nombres cortos para títulos y ejes (el texto completo de la pregunta queda en v.texto)
  var NOMBRES = {
    p01_nac_pais: 'Lugar de nacimiento', p02_educacion: 'Nivel educativo', p03_pareja: 'En pareja', p04_convive: 'Personas con que convive',
    p05_a_cargo: 'Personas a cargo', p06_idiomas_entiende: 'Idiomas que entiende', p07_idiomas_habla: 'Idiomas que habla',
    p08_licencia: 'País de la licencia profesional', p09_rutas_jujuy: 'Estado de las rutas en Jujuy', p10_anios_chofer: 'Años como chofer',
    p11_recorrido: 'Recorrido actual', p12_frec_corredor: 'Frecuencia en el corredor', p12_frec_jujuy: 'Frecuencia en el tramo Jujuy',
    p13_relacion_laboral: 'Relación laboral', p14_conformidad: 'Conformidad con su situación laboral', p15_riesgo_salud: 'Ve su trabajo como riesgo para la salud',
    p16_horas_sin_parar: 'Horas de conducción sin parar', p17_paradas: 'Hace paradas', p18_donde_come: 'Dónde come en los viajes',
    p19_horas_sueno: 'Horas de sueño por día', p20_frutas_verduras: 'Frutas y verduras en ruta', p21_bebidas: 'Bebidas en los viajes',
    p22_sanitarios: 'Acceso a sanitarios', p23_recreativas: 'Actividades recreativas', p24_siniestro: 'Siniestro vial en el último año',
    p25_fin_de_mes: 'Llega a fin de mes', p26_cobertura: 'Cobertura médica', p27_control_medico: 'Dónde hace el control médico',
    p28_frec_consulta: 'Frecuencia de consulta médica', p29_atencion_dolencias: 'Dónde atiende sus dolencias', p30_dolores: 'Dolores frecuentes',
    p31_automedicacion: 'Automedicación', p33_diagnosticos: 'Diagnósticos actuales', p34_actividad_fisica: 'Actividad física fuera del trabajo',
    p35_energeticas: 'Bebidas energéticas', p36_coquea: 'Coqueo', p37_alcohol: 'Alcohol fuera del horario laboral',
    p38_comunicacion: 'Comunicación con colegas', p39_comparte_trayectos: 'Comparte trayectos',
    b_dbt_dx: 'Diagnóstico de diabetes', b_sexo: 'Sexo', b_peso_kg: 'Peso', b_altura_m: 'Altura', b_imc: 'IMC', b_perimetro_cm: 'Perímetro abdominal',
    b_pas_mmhg: 'Presión sistólica', b_act_fisica: 'Actividad física 30 min por día', b_fyv_diario: 'Frutas o verduras todos los días',
    b_hta_dx: 'Diagnóstico de hipertensión', b_med_antihta: 'Medicación antihipertensiva', b_glucosa_previa: 'Glucosa elevada alguna vez',
    b_antec_fam_dbt: 'Antecedentes familiares de diabetes', b_fuma: 'Fuma tabaco', g_resultado_mgdl: 'Glucemia periférica', g_ayuno_min: 'Minutos de ayuno',
    fr_puntos: 'Puntaje FINDRISK', fr_categoria: 'Riesgo FINDRISK', fh_puntos: 'Puntaje Framingham', fh_categoria: 'Riesgo Framingham',
    edad: 'Edad', puesto: 'Punto de relevamiento', origen: 'Planilla de origen', equipo: 'Equipo', encuestador: 'Encuestador/es',
    fecha: 'Fecha', estado: 'Estado del relevamiento', visitas: 'Visitas por participante', pas_140: 'Presión sistólica ≥ 140 mmHg'
  };

  var DIC = null, POR_ID = {};

  function diccionario() {
    if (DIC) return DIC;
    var vars = [];
    function agregar(v) { if (POR_ID[v.id]) return; POR_ID[v.id] = v; vars.push(v); }
    Object.keys(META).forEach(function (id) {
      agregar({ id: id, texto: META[id].texto, seccion: META[id].seccion,
        tipo: META[id].tipo || (NUMERICAS.indexOf(id) >= 0 ? 'numerica' : 'categorica'), opciones: null });
    });
    Inst.columnas().forEach(function (c) {
      if (OCULTAS.indexOf(c.id) >= 0 || POR_ID[c.id]) return;
      var tipo = NUMERICAS.indexOf(c.id) >= 0 ? 'numerica' : c.tipo === 'multiple' ? 'multiple' : c.tipo === 'texto' ? 'texto' : 'categorica';
      var seccion = c.seccion === 'Calculados' ? 'Riesgo calculado' : (c.seccion || 'Relevamiento');
      var opciones = c.opciones ? c.opciones.slice() : null;
      if (c.id === 'fr_categoria') opciones = Calc.FR_CATEGORIAS.map(function (x) { return x.categoria; });
      if (c.id === 'fh_categoria') opciones = ['Bajo', 'Moderado', 'Alto'];
      var texto = c.texto;
      if (c.id === 'fr_categoria') texto = 'Riesgo de diabetes a 10 años (FINDRISK)';
      if (c.id === 'fh_categoria') texto = 'Riesgo cardiovascular a 10 años (Framingham con IMC)';
      if (c.id === 'fr_puntos') texto = 'Puntaje FINDRISK';
      if (c.id === 'fh_puntos') texto = 'Puntaje Framingham';
      if (c.id === 'b_imc') texto = 'IMC (kg/m²)';
      agregar({ id: c.id, texto: texto, seccion: seccion, tipo: tipo, opciones: opciones });
    });
    DERIVADAS.forEach(function (d) { agregar({ id: d.id, texto: d.texto, seccion: 'Variables derivadas', tipo: 'categorica', opciones: d.opciones }); });
    vars.forEach(function (v) {
      v.ordinal = ORDINALES.indexOf(v.id) >= 0;
      v.riesgo = RIESGO.indexOf(v.id) >= 0;
      v.corto = textoCorto(v);
      v.nombre = NOMBRES[v.id] || v.corto;
      var m = /^p(\d\d)_/.exec(v.id);
      v.etiqueta = (m ? 'P' + m[1] + ' · ' : '') + v.nombre;
    });
    DIC = vars;
    return vars;
  }

  function textoCorto(v) {
    var t = v.texto.replace(/^\d+\.\s*/, '');
    return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, '') + '…' : t;
  }

  function variable(id) { diccionario(); return POR_ID[id] || null; }

  /* --------------------------------------------------------------- Lectura */

  function decodificarXml(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(Number(d)); }).replace(/&amp;/g, '&');
  }
  function textoDe(xml) { // concatena todos los <t> (texto enriquecido incluido)
    var out = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g, m;
    while ((m = re.exec(xml))) out += m[1] ? decodificarXml(m[1]) : '';
    return out;
  }
  function columnaIndice(ref) {
    var letras = /^[A-Z]+/.exec(ref)[0], n = 0;
    for (var i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
    return n - 1;
  }

  /* Lee un .xlsx (ArrayBuffer) con JSZip. Devuelve {hojas, hoja, filas}. */
  function leerXlsx(buffer, JSZipLib) {
    var Z = JSZipLib || raiz.JSZip;
    return Z.loadAsync(buffer).then(function (zip) {
      function leer(ruta) { var f = zip.file(ruta); return f ? f.async('string') : Promise.resolve(''); }
      return Promise.all([leer('xl/workbook.xml'), leer('xl/_rels/workbook.xml.rels'), leer('xl/sharedStrings.xml')]).then(function (r) {
        var libro = r[0], rels = r[1], compartidas = [];
        if (!libro) throw new Error('El archivo no es una planilla de Excel válida.');
        var reSi = /<si>([\s\S]*?)<\/si>|<si\/>/g, m;
        while ((m = reSi.exec(r[2]))) compartidas.push(m[1] ? textoDe(m[1]) : '');
        var destinos = {};
        var reRel = /<Relationship\b[^>]*>/g;
        while ((m = reRel.exec(rels))) {
          var id = /Id="([^"]+)"/.exec(m[0]), tg = /Target="([^"]+)"/.exec(m[0]);
          if (id && tg) destinos[id[1]] = tg[1];
        }
        var hojas = [], reH = /<sheet\b[^>]*>/g;
        while ((m = reH.exec(libro))) {
          var nom = /name="([^"]*)"/.exec(m[0]), rid = /r:id="([^"]+)"/.exec(m[0]) || /\bid="([^"]+)"/.exec(m[0]);
          if (!nom || !rid) continue;
          var t = destinos[rid[1]] || '';
          t = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
          hojas.push({ nombre: decodificarXml(nom[1]), ruta: t });
        }
        var elegida = hojas.filter(function (h) { return h.nombre.trim().toLowerCase() === 'datos'; })[0] || hojas[0];
        if (!elegida) throw new Error('La planilla no tiene hojas.');
        return leer(elegida.ruta).then(function (xml) {
          return { hojas: hojas.map(function (h) { return h.nombre; }), hoja: elegida.nombre, filas: filasDeHoja(xml, compartidas) };
        });
      });
    });
  }

  function filasDeHoja(xml, compartidas) {
    var grilla = [], reFila = /<row\b[^>]*>([\s\S]*?)<\/row>/g, mf;
    while ((mf = reFila.exec(xml))) {
      var fila = [], reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, mc;
      while ((mc = reC.exec(mf[1]))) {
        var at = mc[1], cuerpo = mc[2] || '';
        var ref = /\br="([A-Z]+)\d+"/.exec(at), tipo = /\bt="([^"]+)"/.exec(at);
        var col = ref ? columnaIndice(ref[1]) : fila.length;
        var v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo), valor = '';
        tipo = tipo ? tipo[1] : 'n';
        if (tipo === 's') valor = v ? compartidas[Number(v[1])] : '';
        else if (tipo === 'inlineStr') valor = textoDe(cuerpo);
        else if (tipo === 'str' || tipo === 'e') valor = v ? decodificarXml(v[1]) : '';
        else if (tipo === 'b') valor = v ? (v[1] === '1' ? 'VERDADERO' : 'FALSO') : '';
        else valor = v ? Number(v[1]) : '';
        fila[col] = valor;
      }
      grilla.push(fila);
    }
    return grillaAObjetos(grilla);
  }

  function grillaAObjetos(grilla) {
    if (!grilla.length) return [];
    var enc = grilla[0].map(function (h) { return String(h === undefined ? '' : h).trim(); });
    var out = [];
    for (var i = 1; i < grilla.length; i++) {
      var f = grilla[i], o = {}, algo = false;
      for (var j = 0; j < enc.length; j++) {
        if (!enc[j]) continue;
        var v = f[j];
        if (v === undefined || v === null || v === '') continue;
        o[enc[j]] = v; algo = true;
      }
      if (algo) out.push(o);
    }
    return out;
  }

  /* CSV de la app (punto y coma, coma decimal) o de Google/Excel (coma). */
  function leerCsv(texto) {
    texto = texto.replace(/^﻿/, '');
    var primera = texto.split(/\r?\n/)[0] || '';
    var sep = (primera.split(';').length >= primera.split(',').length) ? ';' : ',';
    var filas = [], fila = [], campo = '', comillas = false;
    for (var i = 0; i < texto.length; i++) {
      var ch = texto[i];
      if (comillas) {
        if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
        else campo += ch;
      } else if (ch === '"') comillas = true;
      else if (ch === sep) { fila.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); filas.push(fila); fila = []; campo = '';
      } else campo += ch;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    return grillaAObjetos(filas);
  }

  /* ----------------------------------------------------------- Normalización */

  function fechaIso(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number') { // número de serie de Excel / Google
      var d = new Date(Math.round((v - 25569) * 86400000));
      return isNaN(d) ? '' : d.toISOString().slice(0, 10);
    }
    var s = String(v).trim(), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[0];
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
    if (m) { var a = m[3].length === 2 ? '20' + m[3] : m[3]; return a + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
    return '';
  }

  function normalizarFila(o) {
    var r = {};
    Object.keys(o).forEach(function (k) {
      var id = String(k).trim(), v = o[k];
      if (!id || v === null || v === undefined) return;
      if (typeof v === 'string') { v = v.trim(); if (v === '') return; }
      if (id === 'fecha') { v = fechaIso(v); if (!v) return; }
      else if (NUMERICAS.indexOf(id) >= 0) { var n = Calc.numero(v); if (n === null) return; v = n; }
      else if (typeof v === 'number') v = String(v); // p. ej. «3» en «personas con que convive»
      r[id] = v;
    });
    return r;
  }

  /* Reconoce si las filas son de este relevamiento (al menos 5 columnas conocidas). */
  function esDelRelevamiento(filas) {
    if (!filas.length) return false;
    var conocidas = 0, cols = Object.keys(filas[0]);
    diccionario();
    cols.forEach(function (c) { if (POR_ID[c] || c === 'id' || c === 'participante_id') conocidas++; });
    return conocidas >= 5;
  }

  /* ------------------------------------------------- Recálculo y derivadas */

  function recalcular(r) {
    var imc = Calc.imc(r.b_peso_kg, r.b_altura_m);
    if (imc !== null) r.b_imc = imc;
    var fr = Calc.findrisk({ edad: r.edad, sexo: r.b_sexo, dbt: r.b_dbt_dx, imc: r.b_imc, perimetro: r.b_perimetro_cm,
      actividad: r.b_act_fisica, fyv: r.b_fyv_diario, medicacion: r.b_med_antihta, glucosaPrevia: r.b_glucosa_previa,
      antecedentes: r.b_antec_fam_dbt });
    if (fr.completo) { r.fr_puntos = fr.puntos; r.fr_categoria = fr.categoria; r.fr_probabilidad = fr.probabilidad; }
    r._fr = fr;
    var fh = Calc.framingham({ edad: r.edad, sexo: r.b_sexo, imc: r.b_imc, pas: r.b_pas_mmhg, medicacion: r.b_med_antihta,
      fuma: r.b_fuma, dbt: r.b_dbt_dx });
    if (fh.completo) { r.fh_puntos = fh.puntos; r.fh_riesgo = fh.riesgo; r.fh_categoria = fh.categoria; }
    r._fh = fh;
    derivar(r);
    return r;
  }

  function derivar(r) {
    var e = r.edad;
    delete r.grupo_edad; delete r.imc_cat; delete r.pas_140; delete r.antiguedad_cat; delete r.horas_sin_parar_cat; delete r.sueno_cat;
    if (typeof e === 'number') r.grupo_edad = e < 30 ? '18 a 29' : e < 40 ? '30 a 39' : e < 50 ? '40 a 49' : e < 60 ? '50 a 59' : '60 o más';
    var i = r.b_imc;
    if (typeof i === 'number') r.imc_cat = i < 18.5 ? 'Bajo peso (<18,5)' : i < 25 ? 'Normal (18,5 a 24,9)' : i < 30 ? 'Sobrepeso (25 a 29,9)' : 'Obesidad (30 o más)';
    if (typeof r.b_pas_mmhg === 'number') r.pas_140 = r.b_pas_mmhg >= 140 ? 'Sí' : 'No';
    var a = r.p10_anios_chofer;
    if (typeof a === 'number') r.antiguedad_cat = a < 5 ? 'Menos de 5' : a < 15 ? '5 a 14' : a < 25 ? '15 a 24' : '25 o más';
    var h = r.p16_horas_sin_parar;
    if (typeof h === 'number') r.horas_sin_parar_cat = h <= 2 ? 'Hasta 2 h' : h <= 4 ? 'Más de 2 a 4 h' : h <= 6 ? 'Más de 4 a 6 h' : 'Más de 6 h';
    var s = r.p19_horas_sueno;
    if (typeof s === 'number') r.sueno_cat = s < 6 ? 'Menos de 6 h' : s < 8 ? '6 a 7 h' : '8 h o más';
  }

  /* ---------------------------------------------------------------- Unión */

  /* fuentes: [{id, nombre, etiqueta, filas, activa}] → filas únicas por id (gana la modificación más reciente). */
  function unir(fuentes) {
    var porId = {}, orden = [], duplicados = 0;
    fuentes.forEach(function (f) {
      if (f.activa === false) return;
      f.filas.forEach(function (fila, i) {
        var r = Object.assign({}, fila, { origen: String(f.etiqueta).replace(/;/g, ','), _fuente: f.id });
        var clave = r.id ? String(r.id) : f.id + '#' + i;
        r.id = clave;
        var previa = porId[clave];
        if (previa) {
          duplicados++;
          if (String(r.modificado || '') >= String(previa.modificado || '')) porId[clave] = r;
        } else { porId[clave] = r; orden.push(clave); }
      });
    });
    return { filas: orden.map(function (k) { return recalcular(porId[k]); }), duplicados: duplicados };
  }

  var POR_VISITA = ['id', 'codigo', 'orden', 'hora_inicio', 'hora_fin', 'modificado', 'estado', '_fuente', 'fecha', 'origen', 'encuestador'];

  /* Une las visitas de cada participante: para cada dato, el más reciente que no esté vacío. */
  function consolidar(filas) {
    var grupos = {}, orden = [];
    filas.forEach(function (r) {
      var k = r.participante_id || r.id;
      if (!grupos[k]) { grupos[k] = []; orden.push(k); }
      grupos[k].push(r);
    });
    return orden.map(function (k) {
      var vis = grupos[k].slice().sort(function (a, b) {
        return (String(a.fecha || '') + String(a.modificado || '')).localeCompare(String(b.fecha || '') + String(b.modificado || ''));
      });
      var c = {};
      vis.forEach(function (v) {
        Object.keys(v).forEach(function (campo) {
          if (campo.charAt(0) === '_' && campo !== '_fuente') return;
          if (v[campo] !== '' && v[campo] !== null && v[campo] !== undefined) c[campo] = v[campo];
        });
      });
      var origenes = [];
      vis.forEach(function (v) { if (origenes.indexOf(v.origen) < 0) origenes.push(v.origen); });
      var encs = [];
      vis.forEach(function (v) { if (v.encuestador && encs.indexOf(v.encuestador) < 0) encs.push(v.encuestador); });
      c.id = k; c.participante_id = k; c.visitas = vis.length; c.origen = origenes.join('; ');
      c.encuestador = encs.join('; ');
      var fechas = vis.map(function (v) { return v.fecha; }).filter(Boolean);
      c.fecha = fechas.length ? fechas[fechas.length - 1] : '';
      c.fecha_primera = fechas.length ? fechas[0] : '';
      // los riesgos se recalculan con los datos unidos (no se arrastran los de una visita)
      ['fr_puntos', 'fr_categoria', 'fr_probabilidad', 'fh_puntos', 'fh_riesgo', 'fh_categoria', 'b_imc'].forEach(function (x) { delete c[x]; });
      var ultImc = vis.map(function (v) { return v.b_imc; }).filter(function (x) { return typeof x === 'number'; });
      if (ultImc.length) c.b_imc = ultImc[ultImc.length - 1];
      return recalcular(c);
    });
  }

  /* --------------------------------------------------------------- Valores */

  function valores(r, v) {
    var x = r[v.id];
    if (x === undefined || x === null || x === '') return [];
    if (v.tipo === 'multiple') return String(x).split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    if (v.tipo === 'numerica') return typeof x === 'number' ? [x] : [];
    return [String(x)];
  }
  function tieneDato(r, v) { return valores(r, v).length > 0; }

  /* --------------------------------------------------------------- Filtros */

  var SIN_DATO = '(sin dato)';

  /* filtros: {cat: {varId: [valores]}, edad: [min,max], fecha: [desde,hasta]} */
  function filtrar(filas, filtros) {
    filtros = filtros || {};
    var cats = Object.keys(filtros.cat || {}).filter(function (k) { return filtros.cat[k] && filtros.cat[k].length; });
    return filas.filter(function (r) {
      for (var i = 0; i < cats.length; i++) {
        var v = variable(cats[i]) || { id: cats[i], tipo: 'categorica' }, sel = filtros.cat[cats[i]], vals = valores(r, v);
        if (!vals.length) { if (sel.indexOf(SIN_DATO) < 0) return false; continue; }
        if (!vals.some(function (x) { return sel.indexOf(x) >= 0; })) return false;
      }
      if (filtros.edad && (filtros.edad[0] !== null || filtros.edad[1] !== null)) {
        if (typeof r.edad !== 'number') return false;
        if (filtros.edad[0] !== null && r.edad < filtros.edad[0]) return false;
        if (filtros.edad[1] !== null && r.edad > filtros.edad[1]) return false;
      }
      if (filtros.fecha && (filtros.fecha[0] || filtros.fecha[1])) {
        if (!r.fecha) return false;
        if (filtros.fecha[0] && r.fecha < filtros.fecha[0]) return false;
        if (filtros.fecha[1] && r.fecha > filtros.fecha[1]) return false;
      }
      return true;
    });
  }

  /* ----------------------------------------------------------- Agregaciones */

  function ordenarCategorias(v, conteo) {
    var vistas = Object.keys(conteo);
    var base = v.opciones ? v.opciones.slice() : [];
    var extras = vistas.filter(function (x) { return base.indexOf(x) < 0; })
      .sort(function (a, b) { return conteo[b] - conteo[a] || a.localeCompare(b); });
    if (!base.length) return extras;
    // opciones sin casos se muestran si la lista es corta
    var lista = base.length <= 12 ? base : base.filter(function (x) { return conteo[x]; });
    return lista.concat(extras);
  }

  function frecuencias(filas, v) {
    var conteo = {}, resp = 0;
    filas.forEach(function (r) {
      var vals = valores(r, v);
      if (!vals.length) return;
      resp++;
      vals.forEach(function (x) { conteo[x] = (conteo[x] || 0) + 1; });
    });
    var cats = ordenarCategorias(v, conteo).map(function (c) {
      return { valor: c, n: conteo[c] || 0, pct: resp ? (conteo[c] || 0) / resp * 100 : 0 };
    });
    return { categorias: cats, respondieron: resp, sinDato: filas.length - resp, total: filas.length, multiple: v.tipo === 'multiple' };
  }

  function numeros(filas, v) {
    var out = [];
    filas.forEach(function (r) { var x = r[v.id]; if (typeof x === 'number' && isFinite(x)) out.push(x); });
    return out;
  }

  /* Agrupa las categorías de una variable de desagregación: hasta 'max', el resto en «Otras». */
  function gruposDe(filas, v, max) {
    var f = frecuencias(filas, v);
    var cats = f.categorias.filter(function (c) { return c.n > 0; });
    if (cats.length <= max) return { lista: cats.map(function (c) { return c.valor; }), otras: [] };
    var ordenadas = v.ordinal || v.riesgo ? cats : cats.slice().sort(function (a, b) { return b.n - a.n; });
    var lista = ordenadas.slice(0, max - 1).map(function (c) { return c.valor; });
    var otras = ordenadas.slice(max - 1).map(function (c) { return c.valor; });
    return { lista: lista.concat(['Otras']), otras: otras };
  }

  /* Tabla cruzada. Cada caso cuenta en todas las categorías que marcó (variables múltiples). */
  function cruce(filas, vf, vc, opciones) {
    opciones = opciones || {};
    var base = filas.filter(function (r) { return tieneDato(r, vf) && tieneDato(r, vc); });
    var gc = gruposDe(base, vc, opciones.maxColumnas || 8);
    var ff = frecuencias(base, vf).categorias.filter(function (c) { return c.n > 0 || !opciones.ocultarVacias; });
    var etF = ff.map(function (c) { return c.valor; });
    var etC = gc.lista;
    var t = etF.map(function () { return etC.map(function () { return 0; }); });
    var totFila = etF.map(function () { return 0; }), totCol = etC.map(function () { return 0; });
    var numero = opciones.numerica ? opciones.numerica : null, sumas = null;
    if (numero) sumas = etF.map(function () { return etC.map(function () { return []; }); });
    base.forEach(function (r) {
      var fs = valores(r, vf), cs = valores(r, vc).map(function (x) { return gc.otras.indexOf(x) >= 0 ? 'Otras' : x; });
      cs = cs.filter(function (x, i) { return cs.indexOf(x) === i; });
      fs.forEach(function (a) {
        var i = etF.indexOf(a); if (i < 0) return;
        cs.forEach(function (b) {
          var j = etC.indexOf(b); if (j < 0) return;
          t[i][j]++;
          if (numero && typeof r[numero.id] === 'number') sumas[i][j].push(r[numero.id]);
        });
      });
    });
    // totales por persona (no por marca) para que los porcentajes sean «sobre quienes respondieron»
    base.forEach(function (r) {
      var fs = valores(r, vf), cs = valores(r, vc).map(function (x) { return gc.otras.indexOf(x) >= 0 ? 'Otras' : x; });
      fs.forEach(function (a) { var i = etF.indexOf(a); if (i >= 0) totFila[i]++; });
      cs.filter(function (x, i) { return cs.indexOf(x) === i; }).forEach(function (b) { var j = etC.indexOf(b); if (j >= 0) totCol[j]++; });
    });
    var simple = vf.tipo !== 'multiple' && vc.tipo !== 'multiple';
    return { filas: etF, columnas: etC, tabla: t, totFila: totFila, totCol: totCol, N: base.length, simple: simple,
      medias: sumas, sinDato: filas.length - base.length, otras: gc.otras };
  }

  /* Fila de datos lista para CSV (sin columnas internas). */
  function aCsv(filas, columnas) {
    var cols = columnas || (function () {
      var set = {}, lista = [];
      filas.forEach(function (r) { Object.keys(r).forEach(function (k) { if (k.charAt(0) !== '_' && !set[k]) { set[k] = 1; lista.push(k); } }); });
      return lista;
    })();
    function celda(v) {
      if (v === undefined || v === null) return '';
      if (typeof v === 'number') return String(v).replace('.', ',');
      var s = String(v);
      return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    return '﻿' + [cols.join(';')].concat(filas.map(function (r) { return cols.map(function (c) { return celda(r[c]); }).join(';'); })).join('\r\n');
  }

  var api = {
    diccionario: diccionario, variable: variable, SECCIONES_ORDEN: SECCIONES_ORDEN, SIN_DATO: SIN_DATO,
    leerXlsx: leerXlsx, leerCsv: leerCsv, normalizarFila: normalizarFila, esDelRelevamiento: esDelRelevamiento, fechaIso: fechaIso,
    recalcular: recalcular, unir: unir, consolidar: consolidar, valores: valores, tieneDato: tieneDato,
    filtrar: filtrar, frecuencias: frecuencias, numeros: numeros, gruposDe: gruposDe, cruce: cruce, aCsv: aCsv
  };
  if (enNode) module.exports = api;
  else raiz.Datos = api;
})(typeof window !== 'undefined' ? window : this);
