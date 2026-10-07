/*
 * registro.js — Reglas del relevamiento: visibilidad, avance de módulos, cálculos y
 * conversión a filas de la planilla. Sin dependencias de pantalla (se prueba en Node).
 */
(function (raiz) {
  'use strict';

  var Calc = raiz.Calculos || (typeof require !== 'undefined' ? require('./calculos.js') : null);
  var Inst = raiz.Instrumento || (typeof require !== 'undefined' ? require('./cuestionario.js') : null);

  function pad(n, largo) {
    var s = String(n == null ? '' : n).replace(/\D/g, '');
    while (s.length < largo) s = '0' + s;
    return s;
  }

  function codigo(orden, edad, cp) {
    if (orden === '' || orden == null || edad === '' || edad == null || !cp) return '';
    return pad(orden, 3) + '-' + pad(edad, 2) + '-' + pad(cp, 4);
  }

  function vacio(v) {
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  }

  function esVisible(p, resp) {
    if (!p.mostrarSi) return true;
    var v = resp[p.mostrarSi.id];
    if (p.mostrarSi.igual !== undefined) return v === p.mostrarSi.igual;
    if (p.mostrarSi.incluye) {
      var lista = Array.isArray(v) ? v : (v ? [v] : []);
      return p.mostrarSi.incluye.some(function (x) { return lista.indexOf(x) >= 0; });
    }
    return true;
  }

  function respondida(p, resp) {
    if (p.tipo === 'grupo') return p.campos.every(function (c) { return !vacio(resp[c.id]); });
    return !vacio(resp[p.id]);
  }

  function preguntasVisibles(resp) {
    var lista = [];
    Inst.CUESTIONARIO.secciones.forEach(function (s) {
      s.preguntas.forEach(function (p) { if (esVisible(p, resp)) lista.push(p); });
    });
    return lista;
  }

  function avanceSocio(reg) {
    var resp = reg.socio || {};
    var vis = preguntasVisibles(resp);
    var hechas = vis.filter(function (p) { return respondida(p, resp); }).length;
    return { respondidas: hechas, total: vis.length, completo: hechas === vis.length, iniciado: hechas > 0 };
  }

  function avanceSeccion(reg, indice) {
    var resp = reg.socio || {};
    var s = Inst.CUESTIONARIO.secciones[indice];
    var vis = s.preguntas.filter(function (p) { return esVisible(p, resp); });
    var hechas = vis.filter(function (p) { return respondida(p, resp); }).length;
    return { respondidas: hechas, total: vis.length };
  }

  var BIO_OBLIGATORIOS = ['b_dbt_dx', 'b_sexo', 'b_peso_kg', 'b_altura_m', 'b_perimetro_cm', 'b_pas_mmhg',
    'b_act_fisica', 'b_fyv_diario', 'b_hta_dx', 'b_med_antihta', 'b_glucosa_previa', 'b_antec_fam_dbt', 'b_fuma', 'g_acepta'];

  function avanceBio(reg) {
    var b = reg.bio || {};
    var faltan = BIO_OBLIGATORIOS.filter(function (k) { return vacio(b[k]); });
    if (b.g_acepta === 'Sí' && vacio(b.g_resultado_mgdl)) faltan.push('g_resultado_mgdl');
    var iniciado = Object.keys(b).some(function (k) { return !vacio(b[k]); });
    return { completo: faltan.length === 0, iniciado: iniciado, faltan: faltan,
      glucemia: b.g_acepta === 'Sí' && !vacio(b.g_resultado_mgdl), glucemiaRechazada: b.g_acepta === 'No' };
  }

  function calcular(reg) {
    var b = reg.bio || {};
    var imc = Calc.imc(b.b_peso_kg, b.b_altura_m);
    var fr = Calc.findrisk({ edad: reg.edad, sexo: b.b_sexo, dbt: b.b_dbt_dx, imc: imc, perimetro: b.b_perimetro_cm,
      actividad: b.b_act_fisica, fyv: b.b_fyv_diario, medicacion: b.b_med_antihta,
      glucosaPrevia: b.b_glucosa_previa, antecedentes: b.b_antec_fam_dbt });
    var fh = Calc.framingham({ edad: reg.edad, sexo: b.b_sexo, imc: imc, pas: b.b_pas_mmhg,
      medicacion: b.b_med_antihta, fuma: b.b_fuma, dbt: b.b_dbt_dx });
    var ayuno = b.g_acepta === 'Sí' ? Calc.minutosEntre(b.g_hora_ingesta, b.g_hora_medicion) : null;
    return { imc: imc, findrisk: fr, framingham: fh, ayunoMin: ayuno };
  }

  function pendiente(reg) {
    return !reg.sincronizado || (reg.modificado && reg.modificado > reg.sincronizado);
  }

  function siNo(v) { return v === true ? 'Sí' : v === false ? 'No' : ''; }

  var NUMERICOS = { orden: 1, edad: 1, p10_anios_chofer: 1, p16_horas_sin_parar: 1, p19_horas_sueno: 1,
    b_peso_kg: 1, b_altura_m: 1, b_imc: 1, b_perimetro_cm: 1, b_pas_mmhg: 1, g_resultado_mgdl: 1,
    g_ayuno_min: 1, fr_puntos: 1, fh_puntos: 1, socio_respondidas: 1 };

  function valorCelda(id, v) {
    if (vacio(v)) return '';
    if (Array.isArray(v)) return v.join('; ');
    if (NUMERICOS[id]) { var n = Calc.numero(v); return n === null ? String(v) : n; }
    return v;
  }

  /* Devuelve { fila: {columna: valor}, contacto: {...} } con el orden de columnas del instrumento. */
  function aplanar(reg) {
    var resp = reg.socio || {}, b = reg.bio || {};
    var c = calcular(reg), as = avanceSocio(reg), ab = avanceBio(reg);
    var base = {
      id: reg.id, participante_id: reg.participante_id || '', codigo: reg.codigo || '',
      orden: reg.orden, edad: reg.edad, cp: reg.cp, fecha: reg.fecha, hora_inicio: reg.hora_inicio || '',
      hora_fin: reg.hora_fin || '', equipo: reg.equipo, dispositivo: reg.dispositivo,
      encuestador: reg.encuestador || '', puesto: reg.puesto || '',
      consentimiento: siNo(reg.consentimiento), comparte_app: siNo(reg.comparte_app),
      socio_respondidas: as.respondidas, socio_completo: siNo(as.completo), bio_completo: siNo(ab.completo),
      gluc_realizada: siNo(ab.glucemia), estado: reg.estado || 'borrador',
      version_instrumento: reg.version_instrumento || Inst.CUESTIONARIO.version, modificado: reg.modificado || ''
    };
    var fila = {};
    var visibles = {};
    preguntasVisibles(resp).forEach(function (p) { visibles[p.id] = true; });
    Inst.columnas().forEach(function (col) {
      var id = col.id, v;
      if (base.hasOwnProperty(id)) v = base[id];
      else if (id === 'b_imc') v = c.imc;
      else if (id === 'g_ayuno_min') v = c.ayunoMin;
      else if (id === 'fr_aplica') v = c.findrisk.aplica === null ? '' : siNo(c.findrisk.aplica);
      else if (id === 'fr_puntos') v = c.findrisk.completo ? c.findrisk.puntos : '';
      else if (id === 'fr_categoria') v = c.findrisk.completo ? c.findrisk.categoria : '';
      else if (id === 'fr_probabilidad') v = c.findrisk.completo ? c.findrisk.probabilidad : '';
      else if (id === 'fh_aplica') v = c.framingham.aplica === null ? '' : siNo(c.framingham.aplica);
      else if (id === 'fh_puntos') v = c.framingham.completo ? c.framingham.puntos : '';
      else if (id === 'fh_riesgo') v = c.framingham.completo ? c.framingham.riesgo : '';
      else if (id === 'fh_categoria') v = c.framingham.completo ? c.framingham.categoria : '';
      else if (id.charAt(0) === 'b' || id.charAt(0) === 'g') v = b[id];
      else v = resp[id];
      // Preguntas ocultas por un salto no se exportan
      if (esPreguntaPrincipal(id) && !visibles[id]) v = '';
      fila[id] = valorCelda(id, v);
    });
    var k = reg.contacto || {};
    var contacto = { id: reg.id, participante_id: reg.participante_id || '', codigo: reg.codigo || '',
      correo: k.correo || '', celular: k.celular || '', consentimiento: siNo(reg.consentimiento),
      comparte_app: siNo(reg.comparte_app), fecha: reg.fecha };
    return { fila: fila, contacto: contacto };
  }

  var principales = null;
  function esPreguntaPrincipal(id) {
    if (!principales) {
      principales = {};
      Inst.CUESTIONARIO.secciones.forEach(function (s) {
        s.preguntas.forEach(function (p) { if (p.tipo !== 'grupo') principales[p.id] = true; });
      });
    }
    return !!principales[id];
  }

  /* CSV para Excel en español (Argentina): separador «;», coma decimal y BOM UTF-8. */
  function csv(filas, columnas) {
    function celda(v) {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return String(v).replace('.', ',');
      var s = String(v);
      if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var lineas = [columnas.join(';')];
    filas.forEach(function (f) { lineas.push(columnas.map(function (c) { return celda(f[c]); }).join(';')); });
    return '﻿' + lineas.join('\r\n');
  }

  var api = { pad: pad, codigo: codigo, vacio: vacio, esVisible: esVisible, respondida: respondida,
    avanceSocio: avanceSocio, avanceSeccion: avanceSeccion, avanceBio: avanceBio, calcular: calcular,
    pendiente: pendiente, aplanar: aplanar, csv: csv, BIO_OBLIGATORIOS: BIO_OBLIGATORIOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Registro = api;
})(typeof window !== 'undefined' ? window : this);
