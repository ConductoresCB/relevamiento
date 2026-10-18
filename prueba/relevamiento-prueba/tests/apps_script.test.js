// Prueba de apps-script/Codigo.gs con una planilla simulada: node tests/apps_script.test.js
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const Reg = require('../app/js/registro.js');

function hojaSimulada(nombre, encabezados) {
  const celdas = encabezados ? [encabezados.slice()] : [];
  const rango = (f, c, nf, nc) => ({
    getValues: () => Array.from({ length: nf }, (_, i) => Array.from({ length: nc }, (_, j) => ((celdas[f - 1 + i] || [])[c - 1 + j]) ?? '')),
    setValues: (v) => { v.forEach((fila, i) => fila.forEach((x, j) => { celdas[f - 1 + i] = celdas[f - 1 + i] || []; celdas[f - 1 + i][c - 1 + j] = x; })); return rango(f, c, nf, nc); },
    setFontWeight: function () { return this; }
  });
  return {
    nombre, celdas,
    getLastRow: () => celdas.length,
    getLastColumn: () => celdas.reduce((m, f) => Math.max(m, f.length), 0),
    getRange: rango, setFrozenRows: () => {}
  };
}

const hojas = {};
const libro = {
  getName: () => 'Base de prueba',
  getSheetByName: (n) => hojas[n] || null,
  insertSheet: (n) => (hojas[n] = hojaSimulada(n))
};
const contexto = {
  SpreadsheetApp: { getActiveSpreadsheet: () => libro, flush: () => {} },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  ContentService: { createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  Session: { getScriptTimeZone: () => 'America/Argentina/Jujuy' },
  Utilities: { formatDate: (d, zona, fmt) => fmt === 'HH:mm' ? d.toISOString().slice(11, 16) : d.toISOString().slice(0, 10) }
};
const fuente = fs.readFileSync(path.join(__dirname, '../apps-script/Codigo.gs'), 'utf8');
assert.ok(fuente.includes("const TOKEN_LECTURA = '';"), 'el script se entrega sin clave de lectura aparte');
// Para la prueba se carga una clave de lectura distinta de la de escritura
vm.createContext(contexto);
vm.runInContext(fuente.replace("const TOKEN_LECTURA = '';", "const TOKEN_LECTURA = 'lectura-prueba';"), contexto);
const llamar = (cuerpo) => JSON.parse(contexto.doPost({ postData: { contents: JSON.stringify(cuerpo) } }).texto);

// La hoja Datos ya tiene los encabezados de la plantilla
const cols = JSON.parse(fs.readFileSync(path.join(__dirname, '../planilla/columnas.json'), 'utf8')).columnas.map(c => c.id);
hojas.Datos = hojaSimulada('Datos', cols);

const ej = require('./ejemplo_registro.json');
const TOKEN = 'CAMBIAR-por-una-clave-larga';

assert.strictEqual(llamar({ accion: 'probar', token: 'mala' }).ok, false);
assert.strictEqual(llamar({ accion: 'probar', token: TOKEN }).planilla, 'Base de prueba');
assert.strictEqual(llamar({ accion: 'probar', token: TOKEN }).version, '1.4');
// Con la clave de lectura no se puede escribir
assert.strictEqual(llamar({ accion: 'guardar', token: 'lectura-prueba', registros: [Reg.aplanar(ej)] }).ok, false);
assert.strictEqual(hojas.Datos.getLastRow(), 1);

let r = llamar({ accion: 'guardar', token: TOKEN, registros: [Reg.aplanar(ej), Reg.aplanar({ ...ej, id: 'otro', codigo: '011-52-4400' })] });
assert.deepStrictEqual(r.recibidos, [ej.id, 'otro']);
assert.strictEqual(hojas.Datos.getLastRow(), 3);

// Reenvío del mismo relevamiento modificado: se actualiza, no se duplica
r = llamar({ accion: 'guardar', token: TOKEN, registros: [Reg.aplanar({ ...ej, bio: { ...ej.bio, b_pas_mmhg: '150' } })] });
assert.strictEqual(hojas.Datos.getLastRow(), 3);
const iPas = cols.indexOf('b_pas_mmhg');
assert.strictEqual(hojas.Datos.celdas[1][iPas], 150);
assert.strictEqual(hojas.Datos.celdas[1][cols.indexOf('codigo')], '010-44-4600');
assert.strictEqual(hojas.Datos.celdas[0].indexOf('celular'), -1, 'el celular no va a Datos');

// Una versión MÁS VIEJA del mismo relevamiento (p. ej. un paquete importado tarde) no pisa la más nueva
r = llamar({ accion: 'guardar', token: TOKEN, registros: [Reg.aplanar({ ...ej, modificado: '2026-10-07T09:00:00.000Z', bio: { ...ej.bio, b_pas_mmhg: '99' } })] });
assert.deepStrictEqual(r.recibidos, [ej.id]);
assert.deepStrictEqual(r.omitidos, [ej.id]);
assert.strictEqual(hojas.Datos.celdas[1][iPas], 150, 'la fila conserva la versión más nueva');

// Contactos se crea sola, separada
assert.strictEqual(hojas.Contactos.celdas[0].join(','), 'id,participante_id,codigo,correo,celular,consentimiento,comparte_app,fecha');
assert.strictEqual(hojas.Contactos.getLastRow(), 3);

// Columna nueva (si el cuestionario crece) se agrega al final sin romper las existentes
r = llamar({ accion: 'guardar', token: TOKEN, registros: [{ fila: { ...Reg.aplanar(ej).fila, p40_nueva: 'x' }, contacto: { id: ej.id } }] });
assert.strictEqual(hojas.Datos.celdas[0][cols.length], 'p40_nueva');
assert.strictEqual(hojas.Datos.getLastRow(), 3);

// Lectura para el tablero: solo con la clave de lectura (1.4); devuelve Datos como objetos, sin contactos, con fechas como texto
assert.strictEqual(llamar({ accion: 'leer', token: 'mala' }).ok, false);
r = llamar({ accion: 'leer', token: TOKEN });
assert.strictEqual(r.ok, false, 'la clave de los celulares no lee la planilla');
assert.match(r.error, /clave de lectura/);
hojas.Datos.celdas[2][cols.indexOf('fecha')] = new Date('2026-10-07T12:00:00Z');
r = llamar({ accion: 'leer', token: 'lectura-prueba' });
assert.strictEqual(r.ok, true);
assert.strictEqual(r.filas.length, 2);
assert.strictEqual(r.filas[0].id, ej.id);
assert.strictEqual(r.filas[0].b_pas_mmhg, 138); // el último envío volvió a 138
 assert.strictEqual(r.filas[0].p40_nueva, 'x');
assert.strictEqual(r.filas[1].fecha, '2026-10-07');
assert.ok(!('celular' in r.filas[0]) && !('correo' in r.filas[0]), 'la lectura no incluye contactos');
assert.ok(!Object.values(r.filas[0]).includes(''), 'no se envían celdas vacías');

// Registro de operaciones: fecha, operación y cantidades, sin datos personales
const reg = hojas.Registro.celdas;
assert.strictEqual(reg[0].join('|'), 'Fecha y hora|Operación|Detalle|Equipo y dispositivo');
assert.ok(reg.some(f => f[1] === 'guardar' && /1 sin cambios/.test(f[2])));
assert.ok(reg.some(f => f[1] === 'leer'));
assert.ok(!JSON.stringify(reg).includes('3884000012') && !JSON.stringify(reg).includes('010-44-4600'), 'el registro no guarda datos personales');

// Con TOKEN_LECTURA vacía (como se entrega) o igual a TOKEN, se lee con la clave del equipo (como en 1.3)
for (const valor of ["''", "'CAMBIAR-por-una-clave-larga'"]) {
  const ctx2 = { ...contexto }; vm.createContext(ctx2);
  vm.runInContext(fuente.replace("const TOKEN_LECTURA = '';", 'const TOKEN_LECTURA = ' + valor + ';'), ctx2);
  const r2 = JSON.parse(ctx2.doPost({ postData: { contents: JSON.stringify({ accion: 'leer', token: TOKEN }) } }).texto);
  assert.strictEqual(r2.ok, true); assert.strictEqual(r2.filas.length, 2);
  const r3 = JSON.parse(ctx2.doPost({ postData: { contents: JSON.stringify({ accion: 'leer', token: 'mala' }) } }).texto);
  assert.strictEqual(r3.ok, false);
}

console.log('✔ Apps Script 1.4: claves de escritura y lectura, alta, actualización sin duplicar, no pisa versiones más nuevas, contactos separados, columnas nuevas, lectura para el tablero y registro de operaciones');
