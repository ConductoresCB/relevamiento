/**
 * Receptor de relevamientos — Corredor Bioceánico Jujuy · versión 1.4
 *
 * Va dentro de la planilla de Google (Extensiones > Apps Script).
 * Recibe los relevamientos que envía la app y los guarda en dos hojas:
 *   - "Datos": una fila por relevamiento (sin correo ni celular).
 *   - "Contactos": correo y celular, separados de las respuestas.
 * Si un relevamiento llega dos veces (mismo id), se actualiza su fila: no se duplica.
 * 1.3: el tablero web puede LEER la hoja "Datos" (nunca "Contactos").
 * 1.4: - clave de LECTURA opcional para el tablero (vacía = se lee con la clave del equipo, como en 1.3);
 *      - una versión más vieja de un relevamiento no pisa a una más nueva que ya esté en la planilla;
 *      - cada operación queda anotada en la hoja "Registro" (fecha, operación y cantidades; sin datos personales).
 */
const VERSION_SCRIPT = '1.4';

// Clave de ESCRITURA: la misma que se carga en Ajustes de cada celular y de la PC. Sirve para enviar relevamientos.
const TOKEN = 'CAMBIAR-por-una-clave-larga';

// Clave de LECTURA: para el tablero (leer la hoja Datos).
//  - Vacía (así viene): el tablero lee con la misma clave del equipo, como en la versión 1.3.
//  - Con una clave distinta: el tablero lee SOLO con esa clave; la del equipo ya no sirve para leer.
//    Usala cuando quieras que solo vos (o quien elijas) vea el tablero directo desde la planilla.
const TOKEN_LECTURA = '';

const HOJA_DATOS = 'Datos';
const HOJA_CONTACTOS = 'Contactos';
const HOJA_REGISTRO = 'Registro';

// OPCIONAL (privacidad): para que el equipo vea el tablero sin ver correos ni celulares,
// creá otra planilla de Google privada, copiá acá su identificador (la parte larga de su
// dirección, entre /d/ y /edit) y volvé a implementar. Vacío = los contactos van a la hoja
// "Contactos" de esta misma planilla.
const ID_PLANILLA_CONTACTOS = '';

function doPost(e) {
  try {
    const cuerpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const token = String(cuerpo.token || '');
    const lecturaAparte = TOKEN_LECTURA !== '' && TOKEN_LECTURA !== TOKEN;
    const escribe = token !== '' && token === TOKEN;
    const lee = lecturaAparte ? token === TOKEN_LECTURA : escribe;
    if (!escribe && !lee) {
      console.warn('Pedido rechazado por clave incorrecta: ' + String(cuerpo.accion || '').slice(0, 20));
      return responder({ ok: false, error: 'Clave del equipo incorrecta' });
    }
    const libro = SpreadsheetApp.getActiveSpreadsheet();

    if (cuerpo.accion === 'probar') {
      return responder({ ok: true, planilla: libro.getName(), version: VERSION_SCRIPT, permiso: escribe ? 'escritura' : 'lectura' });
    }

    if (cuerpo.accion === 'leer') {
      if (!lee) {
        return responder({ ok: false, error: 'Para leer hace falta la clave de lectura (no la de los celulares)' });
      }
      const filas = leerDatos(libro);
      anotar(libro, 'leer', filas.length + ' filas de Datos', '');
      return responder({ ok: true, filas: filas });
    }

    if (cuerpo.accion !== 'guardar' || !Array.isArray(cuerpo.registros)) {
      return responder({ ok: false, error: 'Pedido no reconocido' });
    }
    if (!escribe) return responder({ ok: false, error: 'Para enviar relevamientos hace falta la clave del equipo' });

    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // evita que dos celulares escriban a la vez
    try {
      const filas = cuerpo.registros.map(function (r) { return r && r.fila; }).filter(function (f) { return f && f.id; });
      const res = guardarPorId(hoja(libro, HOJA_DATOS), filas);
      // Si en la planilla había una versión más nueva, tampoco se pisan sus contactos.
      const contactos = cuerpo.registros.map(function (r) { return r && r.contacto; })
        .filter(function (c) { return c && c.id && res.omitidos.indexOf(c.id) < 0; });
      const libroContactos = ID_PLANILLA_CONTACTOS ? SpreadsheetApp.openById(ID_PLANILLA_CONTACTOS) : libro;
      guardarPorId(hoja(libroContactos, HOJA_CONTACTOS), contactos);
      const origen = {};
      filas.forEach(function (f) { origen[String(f.equipo || '') + String(f.dispositivo || '')] = true; });
      anotar(libro, 'guardar', res.nuevas + ' nuevas, ' + res.actualizadas + ' actualizadas, ' + res.omitidos.length +
        ' sin cambios (la planilla tenía una versión más nueva)', Object.keys(origen).join(' '));
      SpreadsheetApp.flush();
      // Se confirman todos: los omitidos ya tienen en la planilla una copia igual o más nueva.
      return responder({ ok: true, recibidos: filas.map(function (f) { return f.id; }), omitidos: res.omitidos, version: VERSION_SCRIPT });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return responder({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return responder({ ok: true, mensaje: 'Receptor de relevamientos activo. La app envía los datos por POST.' });
}

/**
 * Inserta o actualiza filas según la columna "id"; agrega columnas nuevas al final si hacen falta.
 * No pisa una fila cuya columna "modificado" sea posterior a la del relevamiento que llega.
 */
function guardarPorId(sh, objetos) {
  const res = { nuevas: 0, actualizadas: 0, omitidos: [] };
  if (!objetos.length) return res;
  let encabezados = leerEncabezados(sh);
  if (!encabezados.length) {
    encabezados = Object.keys(objetos[0]);
    sh.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const faltantes = [];
  objetos.forEach(function (o) {
    Object.keys(o).forEach(function (k) {
      if (encabezados.indexOf(k) < 0 && faltantes.indexOf(k) < 0) faltantes.push(k);
    });
  });
  if (faltantes.length) {
    sh.getRange(1, encabezados.length + 1, 1, faltantes.length).setValues([faltantes]).setFontWeight('bold');
    encabezados = encabezados.concat(faltantes);
  }

  const colId = encabezados.indexOf('id');
  const colMod = encabezados.indexOf('modificado');
  const ultima = sh.getLastRow();
  const filaPorId = {}, modificadoEn = {};
  if (ultima > 1) {
    const ids = sh.getRange(2, colId + 1, ultima - 1, 1).getValues();
    const mods = colMod >= 0 ? sh.getRange(2, colMod + 1, ultima - 1, 1).getValues() : null;
    ids.forEach(function (v, i) {
      if (!v[0]) return;
      filaPorId[v[0]] = i + 2;
      if (mods) modificadoEn[i + 2] = mods[i][0];
    });
  }

  const nuevas = [], posNueva = {};
  objetos.forEach(function (o) {
    const valores = encabezados.map(function (k) { return o[k] === undefined || o[k] === null ? '' : o[k]; });
    const existente = filaPorId[o.id];
    if (existente) {
      if (masNuevo(modificadoEn[existente], o.modificado)) { res.omitidos.push(o.id); return; }
      sh.getRange(existente, 1, 1, valores.length).setValues([valores]);
      res.actualizadas++;
    } else if (posNueva.hasOwnProperty(o.id)) {
      nuevas[posNueva[o.id]] = valores; // el mismo id dos veces en un envío: queda el último
    } else {
      posNueva[o.id] = nuevas.length;
      nuevas.push(valores);
    }
  });
  if (nuevas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, encabezados.length).setValues(nuevas);
    res.nuevas = nuevas.length;
  }
  return res;
}

/** true si la fecha guardada es posterior a la que llega. Solo compara textos con formato ISO (2026-10-11T14:21…);
 *  si alguno no lo tiene (por ejemplo, si la planilla lo convirtió en fecha), se actualiza como antes. */
function masNuevo(guardado, entrante) {
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  return typeof guardado === 'string' && typeof entrante === 'string' && ISO.test(guardado) && ISO.test(entrante) && guardado > entrante;
}

/** Devuelve la hoja Datos como lista de objetos (solo respuestas; los contactos no se envían). */
function leerDatos(libro) {
  const sh = libro.getSheetByName(HOJA_DATOS);
  if (!sh || sh.getLastRow() < 2) return [];
  const enc = leerEncabezados(sh);
  const zona = Session.getScriptTimeZone();
  return sh.getRange(2, 1, sh.getLastRow() - 1, enc.length).getValues()
    .filter(function (f) { return f.some(function (v) { return v !== '' && v !== null; }); })
    .map(function (f) {
      const o = {};
      enc.forEach(function (k, i) {
        let v = f[i];
        if (v === '' || v === null) return;
        if (Object.prototype.toString.call(v) === '[object Date]') v = Utilities.formatDate(v, zona, v.getFullYear() < 1901 ? 'HH:mm' : 'yyyy-MM-dd');
        o[k] = v;
      });
      return o;
    });
}

/** Anota una operación en la hoja Registro: fecha y hora, operación, detalle y origen. Nunca datos personales ni claves. */
function anotar(libro, operacion, detalle, origen) {
  try {
    const sh = hoja(libro, HOJA_REGISTRO);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, 4).setValues([['Fecha y hora', 'Operación', 'Detalle', 'Equipo y dispositivo']]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setValues([[new Date(), operacion, detalle, origen || '']]);
  } catch (e) {
    console.warn('No se pudo anotar en Registro: ' + e);
  }
}

function leerEncabezados(sh) {
  if (sh.getLastColumn() === 0 || sh.getLastRow() === 0) return [];
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (v) { return String(v).trim(); })
    .filter(function (v) { return v !== ''; });
}

function hoja(libro, nombre) {
  return libro.getSheetByName(nombre) || libro.insertSheet(nombre);
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
