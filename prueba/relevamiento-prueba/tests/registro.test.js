// Pruebas del modelo de registro y de los paquetes: node tests/registro.test.js
const assert = require('assert');
const Reg = require('../app/js/registro.js');
const Inst = require('../app/js/cuestionario.js');
const Sync = require('../app/js/sync.js');
const { webcrypto } = require('crypto');

let ok = 0;
async function prueba(nombre, fn) { await fn(); ok++; console.log('✔', nombre); }

const ejemplo = {
  id: 'r-1', participante_id: 'A1-0010', orden: 10, edad: 44, cp: '4600', codigo: Reg.codigo(10, 44, '4600'),
  fecha: '2026-10-07', hora_inicio: '10:58', equipo: 'A', dispositivo: '1', encuestador: 'MB', puesto: 'Puesto 1',
  consentimiento: true, comparte_app: true, contacto: { correo: 'x@y.com', celular: '3880000000' },
  socio: { p01_nac_pais: 'Argentina', p01_nac_detalle: 'Jujuy', p06_idiomas_entiende: ['Español', 'Portugués'],
    p31_automedicacion: ['Ninguno'], p32_cuales_med: 'texto que no debe exportarse', p10_anios_chofer: '18' },
  bio: { b_dbt_dx: 'No', b_sexo: 'Varón', b_peso_kg: '86,4', b_altura_m: '1,72', b_perimetro_cm: '101', b_pas_mmhg: '138', b_pad_mmhg: '88',
    b_act_fisica: 'No', b_fyv_diario: 'No', b_hta_dx: 'No', b_med_antihta: 'No', b_glucosa_previa: 'No',
    b_antec_fam_dbt: 'Sí, primer grado', b_fuma: 'Sí', g_acepta: 'Sí', g_hora_ingesta: '08:15', g_hora_medicion: '11:20',
    g_resultado_mgdl: '112', g_que_ingirio: 'Mate y pan' },
  estado: 'finalizado', modificado: '2026-10-07T14:21:00.000Z'
};

(async () => {
  await prueba('Código de identificación con ceros', () => {
    assert.strictEqual(Reg.codigo(1, 58, 4600), '001-58-4600');
    assert.strictEqual(ejemplo.codigo, '010-44-4600');
  });

  await prueba('El instrumento tiene 39 preguntas en 7 secciones', () => {
    const n = Inst.CUESTIONARIO.secciones.reduce((a, s) => a + s.preguntas.length, 0);
    assert.strictEqual(n, 39);
    assert.strictEqual(Inst.CUESTIONARIO.secciones.length, 7);
    const ids = Inst.columnas().map(c => c.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'columnas repetidas');
  });

  await prueba('Salto: la 32 se oculta si responde «Ninguno» en la 31', () => {
    const a = Reg.avanceSocio(ejemplo);
    assert.strictEqual(a.total, 38);
  });

  await prueba('Aplanado con cálculos y sin datos de contacto', () => {
    const { fila, contacto } = Reg.aplanar(ejemplo);
    assert.strictEqual(fila.b_imc, 29.2);
    assert.strictEqual(fila.fr_puntos, 12);
    assert.strictEqual(fila.fr_categoria, 'Moderado');
    assert.strictEqual(fila.fh_puntos, 7);
    assert.strictEqual(fila.fh_riesgo, '3');
    assert.strictEqual(fila.g_ayuno_min, 185);
    assert.strictEqual(fila.b_peso_kg, 86.4);
    assert.strictEqual(fila.p10_anios_chofer, 18);
    assert.strictEqual(fila.p06_idiomas_entiende, 'Español; Portugués');
    assert.strictEqual(fila.p32_cuales_med, '');
    assert.strictEqual(fila.bio_completo, 'Sí');
    assert.ok(!('correo' in fila) && !('celular' in fila));
    assert.strictEqual(contacto.celular, '3880000000');
  });

  await prueba('CSV para Excel con «;» y coma decimal', () => {
    const { fila } = Reg.aplanar(ejemplo);
    const txt = Reg.csv([fila], ['codigo', 'b_imc', 'p06_idiomas_entiende']);
    assert.ok(txt.startsWith('﻿codigo;b_imc;p06_idiomas_entiende'));
    assert.ok(txt.includes('010-44-4600;29,2;Español; Portugués') === false, 'el texto con ; debe ir entre comillas');
    assert.ok(txt.includes('010-44-4600;29,2;"Español; Portugués"'));
  });

  await prueba('Diastólica (1.4): columna numérica después de la sistólica, sin cambiar FINDRISK ni Framingham', () => {
    const ids = Inst.columnas().map(c => c.id);
    assert.strictEqual(ids.indexOf('b_pad_mmhg'), ids.indexOf('b_pas_mmhg') + 1);
    const con = Reg.aplanar(ejemplo).fila;
    const sin = Reg.aplanar({ ...ejemplo, bio: { ...ejemplo.bio, b_pad_mmhg: undefined } }).fila;
    assert.strictEqual(con.b_pad_mmhg, 88);
    assert.strictEqual(sin.b_pad_mmhg, '');
    for (const k of ['fr_puntos', 'fr_categoria', 'fh_puntos', 'fh_riesgo', 'fh_categoria', 'b_imc']) assert.strictEqual(con[k], sin[k], k);
    // Para «Bio completo» se exige desde el instrumento v2; los relevamientos v1 no la tenían
    assert.strictEqual(con.bio_completo, 'Sí');
    assert.strictEqual(sin.bio_completo, 'No');
    assert.ok(Reg.avanceBio({ ...ejemplo, bio: { ...ejemplo.bio, b_pad_mmhg: '' } }).faltan.includes('b_pad_mmhg'));
    assert.strictEqual(Reg.aplanar({ ...ejemplo, version_instrumento: '2026-10-v1', bio: { ...ejemplo.bio, b_pad_mmhg: '' } }).fila.bio_completo, 'Sí');
  });

  await prueba('ID interno derivado del N° de orden (1.4)', () => {
    assert.strictEqual(Reg.idParticipante('j', '1', '811'), 'J1-0811');
    assert.strictEqual(Reg.idParticipante('A', 1, 7), 'A1-0007');
    assert.strictEqual(Reg.idParticipante('A', '1', ''), '');
    assert.strictEqual(Reg.idParticipante('', '1', '5'), '');
  });

  await prueba('Paquete cifrado (formato 2): ida y vuelta, clave incorrecta y 600 000 iteraciones', async () => {
    const txt = await Sync.armarPaquete([ejemplo], { equipo: 'A', dispositivo: '1' }, 'clave-del-equipo');
    assert.ok(!txt.includes('3880000000'), 'el celular no debe verse en claro');
    const p = JSON.parse(txt);
    assert.strictEqual(p.version, 2); assert.strictEqual(p.iteraciones, 600000); assert.strictEqual(p.cifrado, true);
    const abierto = await Sync.abrirPaquete(txt, 'clave-del-equipo');
    assert.strictEqual(abierto.registros[0].codigo, '010-44-4600');
    await assert.rejects(Sync.abrirPaquete(txt, 'otra'), /no coincide/);
  });

  await prueba('Paquete alterado, cortado o sin cifrar: no se abre', async () => {
    const txt = await Sync.armarPaquete([ejemplo, { ...ejemplo, id: 'r-2' }], { equipo: 'A', dispositivo: '1' }, 'k');
    const p = JSON.parse(txt);
    // cabecera modificada (cantidad o equipo): la detecta AES-GCM porque viaja como dato asociado
    await assert.rejects(Sync.abrirPaquete(JSON.stringify({ ...p, cantidad: 1 }), 'k'), /modificado/);
    await assert.rejects(Sync.abrirPaquete(JSON.stringify({ ...p, equipo: 'Z' }), 'k'), /modificado/);
    // un byte cambiado en los datos cifrados
    const b = Buffer.from(p.datos, 'base64'); b[10] ^= 1;
    await assert.rejects(Sync.abrirPaquete(JSON.stringify({ ...p, datos: b.toString('base64') }), 'k'), /modificado/);
    // archivo cortado a la mitad (por ejemplo, una descarga incompleta)
    await assert.rejects(Sync.abrirPaquete(txt.slice(0, Math.floor(txt.length / 2)), 'k'), /dañado o incompleto/);
    await assert.rejects(Sync.abrirPaquete(JSON.stringify({ ...p, datos: p.datos.slice(0, 40) }), 'k'), /modificado|dañado/);
    // sin cifrar: ya no se acepta, y sin clave no se genera
    await assert.rejects(Sync.abrirPaquete(JSON.stringify({ tipo: 'paquete-relevamiento', version: 1, cifrado: false, datos: [ejemplo] }), 'k'), /no está cifrado/);
    await assert.rejects(Sync.armarPaquete([ejemplo], { equipo: 'A', dispositivo: '1' }, ''), /Falta la clave/);
  });

  await prueba('Compatibilidad: abre paquetes del formato 1 (app 1.0 a 1.3)', async () => {
    const subtle = webcrypto.subtle, sal = webcrypto.getRandomValues(new Uint8Array(16)), iv = webcrypto.getRandomValues(new Uint8Array(12));
    const base = await subtle.importKey('raw', new TextEncoder().encode('k'), 'PBKDF2', false, ['deriveKey']);
    const k = await subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const c = await subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify([ejemplo])));
    const v1 = JSON.stringify({ tipo: 'paquete-relevamiento', version: 1, generado: '2026-10-07T20:00:00Z', equipo: 'A', dispositivo: '1', cantidad: 1,
      cifrado: true, sal: Buffer.from(sal).toString('base64'), iv: Buffer.from(iv).toString('base64'), datos: Buffer.from(c).toString('base64') });
    const r = await Sync.abrirPaquete(v1, 'k');
    assert.strictEqual(r.registros[0].id, 'r-1');
  });

  await prueba('Huella del archivo para confirmar la recepción', async () => {
    const h1 = await Sync.huella('{"a":1}'), h2 = await Sync.huella('{"a":1}'), h3 = await Sync.huella('{"a":2}');
    assert.match(h1, /^[0-9A-F]{4}-[0-9A-F]{4}$/);
    assert.strictEqual(h1, h2); assert.notStrictEqual(h1, h3);
  });

  await prueba('Unión de paquetes: gana la versión más reciente y se descartan registros con formato inválido', () => {
    const viejo = { ...ejemplo, modificado: '2026-10-07T10:00:00Z' };
    const r = Sync.unir([viejo], [ejemplo, { ...ejemplo, id: 'r-2' }, { ...ejemplo, id: '"><img src=x onerror=alert(1)>' },
      { ...ejemplo, id: 'r-3', fecha: '<b>07</b>' }, null, { ...ejemplo, id: 'r-4', bio: 'texto' }]);
    assert.strictEqual(r.nuevos, 1);
    assert.strictEqual(r.actualizados, 1);
    assert.strictEqual(r.descartados, 4);
    assert.strictEqual(r.aGuardar.length, 2);
  });

  console.log(`\n${ok} pruebas superadas · ${Inst.columnas().length} columnas en la hoja Datos`);
})().catch(e => { console.error('✘', e); process.exit(1); });
