// Recalcula las columnas derivadas de una fila de «Datos» con las mismas reglas que la app
// (preguntas respondidas, módulos completos, IMC, FINDRISK, Framingham, minutos de ayuno).
// Uso: node previo/recalcular.js entrada.json salida.json
// Entrada: lista de filas {columna: valor}. Salida: la misma lista con las columnas recalculadas.
const fs = require('fs');
const R = require('../app/js/registro.js');
const I = require('../app/js/cuestionario.js');

const cols = I.columnas();
const MULTIPLE = {};
cols.forEach(function (c) { if (c.tipo === 'multiple') MULTIPLE[c.id] = true; });
const META = {}; I.META.forEach(function (m) { META[m.id] = true; });
const BIO = {}; I.BIO.forEach(function (b) { BIO[b.id] = true; });
const CALC = {}; I.CALCULADOS.forEach(function (c) { CALC[c.id] = true; });

function vacio(v) { return v === undefined || v === null || v === ''; }
function siNo(v) { return v === 'Sí' ? true : v === 'No' ? false : undefined; }

function aRegistro(f) {
  const socio = {}, bio = {};
  cols.forEach(function (c) {
    const v = f[c.id];
    if (vacio(v) || META[c.id] || CALC[c.id] || c.id === 'b_imc') return;
    if (BIO[c.id]) { bio[c.id] = v; return; }
    socio[c.id] = MULTIPLE[c.id] ? String(v).split(';').map(function (s) { return s.trim(); }).filter(Boolean) : v;
  });
  return {
    id: f.id, participante_id: f.participante_id, codigo: f.codigo, orden: f.orden, edad: f.edad, cp: f.cp,
    fecha: f.fecha, hora_inicio: f.hora_inicio, hora_fin: f.hora_fin, equipo: f.equipo, dispositivo: f.dispositivo,
    encuestador: f.encuestador, puesto: f.puesto, consentimiento: siNo(f.consentimiento), comparte_app: siNo(f.comparte_app),
    estado: f.estado, version_instrumento: f.version_instrumento, modificado: f.modificado, socio: socio, bio: bio
  };
}

const filas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const salida = filas.map(function (f) { return R.aplanar(aRegistro(f)).fila; });
fs.writeFileSync(process.argv[3], JSON.stringify(salida, null, 1));
