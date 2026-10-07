/*
 * calculos.js — IMC, FINDRISK, Framingham con IMC y horas de ayuno.
 * Tablas tomadas del modelo de encuesta del proyecto (Encuesta biológica).
 * Se usa en el navegador (window.Calculos) y en Node para las pruebas (module.exports).
 */
(function (raiz) {
  'use strict';

  function numero(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function redondear(v, decimales) {
    var f = Math.pow(10, decimales);
    return Math.round(v * f) / f;
  }

  /* ---------- IMC ---------- */
  function imc(pesoKg, alturaM) {
    var p = numero(pesoKg), a = numero(alturaM);
    if (!p || !a) return null;
    return redondear(p / (a * a), 1);
  }

  /* ---------- FINDRISK ---------- */
  var FR_CATEGORIAS = [
    { hasta: 6, categoria: 'Bajo', probabilidad: '1 %' },
    { hasta: 11, categoria: 'Ligeramente elevado', probabilidad: '4 %' },
    { hasta: 14, categoria: 'Moderado', probabilidad: '17 %' },
    { hasta: 20, categoria: 'Alto', probabilidad: '33 %' },
    { hasta: 26, categoria: 'Muy alto', probabilidad: '50 %' }
  ];

  function categoriaFindrisk(puntos) {
    for (var i = 0; i < FR_CATEGORIAS.length; i++) {
      if (puntos <= FR_CATEGORIAS[i].hasta) return FR_CATEGORIAS[i];
    }
    return FR_CATEGORIAS[FR_CATEGORIAS.length - 1];
  }

  /*
   * d: { edad, sexo ('Mujer'|'Varón'|'Otro'), dbt ('Sí'|'No'), imc, perimetro,
   *      actividad ('Sí'|'No'), fyv ('Sí'|'No'), medicacion ('Sí'|'No'),
   *      glucosaPrevia ('Sí'|'No'), antecedentes ('No'|'Sí, parientes lejanos'|'Sí, primer grado') }
   */
  function findrisk(d) {
    var r = { aplica: null, motivo: '', puntos: 0, detalle: {}, faltan: [], completo: false,
              categoria: '', probabilidad: '' };
    if (d.dbt === 'Sí') { r.aplica = false; r.motivo = 'Diagnóstico previo de diabetes'; return r; }
    if (d.sexo === 'Otro') { r.aplica = false; r.motivo = 'Sexo «otro»: no se estima'; return r; }
    if (d.dbt !== 'No' || (d.sexo !== 'Mujer' && d.sexo !== 'Varón')) {
      r.motivo = 'Falta diagnóstico de diabetes o sexo';
    } else {
      r.aplica = true;
    }

    var edad = numero(d.edad), vImc = numero(d.imc), per = numero(d.perimetro);

    function sumar(clave, etiqueta, valor) {
      if (valor === null || valor === undefined) { r.faltan.push(etiqueta); return; }
      r.detalle[clave] = valor; r.puntos += valor;
    }

    sumar('edad', 'Edad', edad === null ? null : edad < 45 ? 0 : edad <= 54 ? 2 : edad <= 64 ? 3 : 4);
    // Literal del modelo: menos de 25 = 0; 25 a 30 = 1; más de 30 = 3
    sumar('imc', 'IMC', vImc === null ? null : vImc < 25 ? 0 : vImc <= 30 ? 1 : 3);
    var pPer = null;
    if (per !== null && d.sexo === 'Mujer') pPer = per < 80 ? 0 : per <= 88 ? 3 : 4;
    if (per !== null && d.sexo === 'Varón') pPer = per < 94 ? 0 : per <= 102 ? 3 : 4;
    sumar('perimetro', 'Perímetro abdominal', pPer);
    sumar('actividad', 'Actividad física', d.actividad === 'Sí' ? 0 : d.actividad === 'No' ? 2 : null);
    sumar('fyv', 'Frutas y verduras', d.fyv === 'Sí' ? 0 : d.fyv === 'No' ? 1 : null);
    sumar('medicacion', 'Medicación antihipertensiva', d.medicacion === 'Sí' ? 2 : d.medicacion === 'No' ? 0 : null);
    sumar('glucosa', 'Glucosa elevada previa', d.glucosaPrevia === 'Sí' ? 5 : d.glucosaPrevia === 'No' ? 0 : null);
    var ant = null;
    if (d.antecedentes === 'No') ant = 0;
    else if (d.antecedentes === 'Sí, parientes lejanos') ant = 3;
    else if (d.antecedentes === 'Sí, primer grado') ant = 5;
    sumar('antecedentes', 'Antecedentes familiares', ant);

    r.completo = r.aplica === true && r.faltan.length === 0;
    if (r.completo) {
      var c = categoriaFindrisk(r.puntos);
      r.categoria = c.categoria; r.probabilidad = c.probabilidad;
    }
    return r;
  }

  /* ---------- Framingham con IMC (tablas del protocolo) ---------- */
  var FH = {
    edad: { 'Varón': [-9, -4, 0, 3, 6, 8, 10, 11, 12, 13], 'Mujer': [-7, -3, 0, 3, 6, 8, 10, 12, 14, 16] },
    imc: {
      'Varón': { bajo: [0, 0, 0, 0, 0], medio: [1, 1, 1, 1, 0], alto: [3, 2, 2, 2, 1] },
      'Mujer': { bajo: [0, 1, 2, 2, 1], medio: [2, 3, 3, 3, 2], alto: [4, 5, 6, 5, 4] }
    },
    pas: {
      'Varón': { sin: [0, 0, 1, 1, 2], con: [0, 1, 2, 2, 3] },
      'Mujer': { sin: [0, 1, 2, 3, 4], con: [0, 3, 4, 5, 6] }
    },
    tabaco: { 'Varón': [8, 5, 3, 1, 1], 'Mujer': [9, 7, 4, 2, 1] },
    diabetes: { 'Varón': 3, 'Mujer': 4 },
    riesgo: {
      'Varón': { min: 0, max: 17, tabla: ['1', '1', '1', '1', '1', '2', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '25'] },
      'Mujer': { min: 9, max: 25, tabla: ['1', '1', '1', '1', '2', '2', '3', '4', '5', '6', '8', '11', '14', '17', '22', '27'] }
    }
  };

  function bandaEdad10(e) { // 20-34, 35-39, 40-44 ... 75-79
    if (e < 20 || e > 79) return -1;
    if (e < 35) return 0;
    return Math.min(9, Math.floor((e - 35) / 5) + 1);
  }
  function bandaEdad5(e) { // 20-39, 40-49, 50-59, 60-69, 70-79
    if (e < 20 || e > 79) return -1;
    return e < 40 ? 0 : e < 50 ? 1 : e < 60 ? 2 : e < 70 ? 3 : 4;
  }
  function bandaPas(p) { return p < 120 ? 0 : p < 130 ? 1 : p < 140 ? 2 : p < 160 ? 3 : 4; }

  function riesgoFramingham(sexo, puntos) {
    var t = FH.riesgo[sexo];
    if (puntos < t.min) return '<1';
    if (puntos >= t.max) return '≥30';
    return t.tabla[puntos - t.min];
  }

  function categoriaFramingham(riesgo) {
    var n = riesgo === '<1' ? 0.5 : riesgo === '≥30' ? 30 : Number(riesgo);
    if (n < 10) return 'Bajo';
    if (n < 20) return 'Moderado';
    return 'Alto';
  }

  /* d: { edad, sexo, imc, pas, medicacion ('Sí'|'No'), fuma ('Sí'|'No'), dbt ('Sí'|'No') } */
  function framingham(d) {
    var r = { aplica: null, motivo: '', puntos: 0, detalle: {}, faltan: [], completo: false,
              riesgo: '', categoria: '' };
    var edad = numero(d.edad), vImc = numero(d.imc), pas = numero(d.pas);
    var sexo = d.sexo;
    if (sexo === 'Otro') { r.aplica = false; r.motivo = 'Sexo «otro»: las tablas son por sexo'; return r; }
    if (edad !== null && (edad < 20 || edad > 79)) { r.aplica = false; r.motivo = 'Edad fuera de 20–79 años'; return r; }
    if (sexo !== 'Mujer' && sexo !== 'Varón') { r.motivo = 'Falta sexo'; r.faltan.push('Sexo'); return r; }
    r.aplica = true;

    function sumar(clave, etiqueta, valor) {
      if (valor === null || valor === undefined) { r.faltan.push(etiqueta); return; }
      r.detalle[clave] = valor; r.puntos += valor;
    }

    sumar('edad', 'Edad', edad === null ? null : FH.edad[sexo][bandaEdad10(edad)]);
    var b5 = edad === null ? -1 : bandaEdad5(edad);
    var pImc = null;
    if (vImc !== null && b5 >= 0) {
      var fila = vImc < 25 ? 'bajo' : vImc < 30 ? 'medio' : 'alto';
      pImc = FH.imc[sexo][fila][b5];
    }
    sumar('imc', 'IMC', pImc);
    var pPas = null;
    if (pas !== null && (d.medicacion === 'Sí' || d.medicacion === 'No')) {
      pPas = FH.pas[sexo][d.medicacion === 'Sí' ? 'con' : 'sin'][bandaPas(pas)];
    }
    sumar('pas', 'Presión sistólica y tratamiento', pPas);
    var pTab = null;
    if (d.fuma === 'No') pTab = 0;
    else if (d.fuma === 'Sí' && b5 >= 0) pTab = FH.tabaco[sexo][b5];
    sumar('tabaco', 'Tabaquismo', pTab);
    sumar('diabetes', 'Diabetes', d.dbt === 'Sí' ? FH.diabetes[sexo] : d.dbt === 'No' ? 0 : null);

    r.completo = r.faltan.length === 0;
    if (r.completo) {
      r.riesgo = riesgoFramingham(sexo, r.puntos);
      r.categoria = categoriaFramingham(r.riesgo);
    }
    return r;
  }

  /* ---------- Ayuno ---------- */
  function minutosEntre(horaIngesta, horaMedicion) {
    var re = /^(\d{1,2}):(\d{2})$/;
    var a = re.exec(horaIngesta || ''), b = re.exec(horaMedicion || '');
    if (!a || !b) return null;
    var m1 = Number(a[1]) * 60 + Number(a[2]);
    var m2 = Number(b[1]) * 60 + Number(b[2]);
    var dif = m2 - m1;
    if (dif < 0) dif += 24 * 60; // la ingesta fue el día anterior
    return dif;
  }

  function formatoAyuno(min) {
    if (min === null || min === undefined) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' h ' + (m < 10 ? '0' : '') + m + ' min';
  }

  var api = {
    numero: numero, imc: imc, findrisk: findrisk, framingham: framingham,
    categoriaFindrisk: categoriaFindrisk, riesgoFramingham: riesgoFramingham,
    categoriaFramingham: categoriaFramingham, minutosEntre: minutosEntre, formatoAyuno: formatoAyuno,
    FR_CATEGORIAS: FR_CATEGORIAS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Calculos = api;
})(typeof window !== 'undefined' ? window : this);
