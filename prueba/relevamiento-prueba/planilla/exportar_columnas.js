// Exporta la lista de columnas (desde cuestionario.js) y, opcionalmente, datos FICTICIOS de prueba.
// Uso: node planilla/exportar_columnas.js [cantidad_de_registros_ficticios]
const fs = require('fs');
const path = require('path');
const Inst = require('../app/js/cuestionario.js');
const Reg = require('../app/js/registro.js');

const salida = path.join(__dirname, 'columnas.json');
const columnas = Inst.columnas().map(c => ({ id: c.id, texto: c.texto, seccion: c.seccion || 'Identificación', opciones: c.opciones || null, tipo: c.tipo || '' }));
const ejemplo = Reg.aplanar(require('../tests/ejemplo_registro.json')).fila;
fs.writeFileSync(salida, JSON.stringify({ columnas, contacto: Inst.CONTACTO, ejemplo }, null, 1));
console.log(columnas.length + ' columnas →', salida);

const n = Number(process.argv[2] || 0);
if (!n) process.exit(0);

// Generador pseudoaleatorio con semilla fija (resultados reproducibles)
let s = 20261007;
const azar = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const uno = (lista, pesos) => {
  if (!pesos) return lista[Math.floor(azar() * lista.length)];
  const t = pesos.reduce((a, b) => a + b, 0); let r = azar() * t;
  for (let i = 0; i < lista.length; i++) { r -= pesos[i]; if (r <= 0) return lista[i]; }
  return lista[lista.length - 1];
};
const varios = (lista, max) => { const k = 1 + Math.floor(azar() * max); return [...new Set(Array.from({ length: k }, () => uno(lista)))]; };
const entre = (a, b, dec = 0) => Number((a + azar() * (b - a)).toFixed(dec));

const registros = [];
const dias = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-06', '2026-10-07'];
for (let i = 0; i < n; i++) {
  const equipo = uno(['A', 'B', 'C'], [4, 3, 3]);
  const edad = Math.round(entre(23, 68));
  const orden = { A: 1, B: 200, C: 400 }[equipo] + i;
  const cp = uno(['4600', '4612', '4400', '4500', '4630']);
  const sexo = uno(['Varón', 'Mujer', 'Otro'], [92, 7, 1]);
  const altura = sexo === 'Mujer' ? entre(1.5, 1.72, 2) : entre(1.6, 1.88, 2);
  const imcObj = entre(21, 36, 1);
  const peso = Number((imcObj * altura * altura).toFixed(1));
  const socio = {
    p01_nac_pais: uno(['Argentina', 'Chile', 'Brasil', 'Paraguay', 'Otro país'], [60, 19, 12, 8, 1]),
    p02_educacion: uno(Inst.CUESTIONARIO.secciones[0].preguntas[1].opciones, [15, 25, 30, 8, 10, 7, 5]),
    p03_pareja: uno(['Sí', 'No'], [7, 3]), p04_convive: uno(['1', '2', '3', '4', '5', 'Más de 5']), p05_a_cargo: uno(['1', '2', '3', '4', '5', 'Más de 5']),
    p06_idiomas_entiende: varios(['Español', 'Portugués', 'Guaraní', 'Inglés'], 2), p07_idiomas_habla: ['Español'],
    p08_licencia: ['Argentina'],
    p09_rutas_jujuy: uno(['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo'], [5, 25, 40, 20, 10]),
    p10_anios_chofer: Math.max(1, Math.round(entre(1, edad - 20))),
    p11_recorrido: uno(['Viaje provincial (Jujuy)', 'Viaje interprovincial', 'Viaje internacional'], [2, 4, 4]),
    p12_frec_corredor: uno(['Una vez a la semana', '2 veces por semana', 'Quincenalmente', 'Una vez al mes']),
    p12_frec_jujuy: uno(['Diariamente', 'Una vez a la semana', '2 veces por semana', '3 veces por semana']),
    p13_relacion_laboral: uno(['Empleado', 'Dueño del camión', 'Otro'], [6, 3, 1]),
    p14_conformidad: uno(['Conforme', 'Parcialmente conforme', 'Disconforme']),
    p15_riesgo_salud: uno(['Sí', 'No', 'Duda'], [6, 2, 2]), p16_horas_sin_parar: entre(2, 9, 1), p17_paradas: uno(['Sí', 'No'], [9, 1]),
    p18_donde_come: varios(['Paradores', 'En el camión al costado de la ruta', 'Estaciones de servicio'], 2), p19_horas_sueno: entre(4, 8, 1),
    p20_frutas_verduras: uno(['Todos los días', 'Varias veces por semana', 'Casi nunca', 'Nunca']),
    p21_bebidas: varios(['Agua', 'Gaseosas', 'Café', 'Mate', 'Jugos artificiales'], 3),
    p22_sanitarios: uno(['Sí, siempre', 'A veces', 'Casi nunca', 'Nunca']), p23_recreativas: uno(['Sí', 'Algunas veces', 'Rara vez', 'No']),
    p24_siniestro: uno(['Sí', 'No'], [1, 6]), p25_fin_de_mes: uno(['Sí', 'Parcialmente', 'No']),
    p26_cobertura: uno([['Obra social'], ['Obra social', 'Prepaga'], ['Ninguna'], ['Seguro de salud']], [6, 1, 2, 1]),
    p27_control_medico: uno(['Sistema público', 'Sistema privado', 'Ninguno']), p28_frec_consulta: uno(['Una vez al año', 'Solo cuando me siento mal', '2 veces al año', 'Nunca']),
    p29_atencion_dolencias: uno([['Sistema público'], ['Sistema privado'], ['Sistema público', 'Otros (medicina tradicional, alternativa, etc.)']]),
    p30_dolores: uno(['Sí', 'No'], [6, 4]), p31_automedicacion: uno([['Ninguno'], ['Medicamentos'], ['Medicamentos', 'Hierbas']]),
    p33_diagnosticos: uno([['No tengo diagnóstico de enfermedad'], ['Musculoesqueléticos'], ['Obesidad'], ['Musculoesqueléticos', 'Digestivas']]),
    p34_actividad_fisica: uno(['Rara vez', 'Nunca', 'Una vez a la semana', '2 a 3 veces por semana']),
    p35_energeticas: uno([['No'], ['Café'], ['Café', 'Coca-Cola'], ['Energizantes (Speed, Monster, Red Bull, etc.)'], ['Yerba mate']]),
    p36_coquea: uno(['Sí', 'No'], [6, 4]), p37_alcohol: uno(['Sí', 'No'], [5, 5]), p38_comunicacion: uno(['Siempre', 'A veces', 'Nunca']),
    p39_comparte_trayectos: uno(['Sí', 'No'])
  };
  if (socio.p30_dolores === 'Sí') socio.p30_cuales = uno(['Lumbar', 'Cervical', 'Rodillas']);
  if (socio.p31_automedicacion[0] !== 'Ninguno') socio.p32_cuales_med = 'Ibuprofeno';
  const hacerBio = azar() < 0.9;
  const bio = hacerBio ? {
    b_dbt_dx: uno(['Sí', 'No'], [1, 11]), b_sexo: sexo, b_peso_kg: String(peso), b_altura_m: String(altura),
    b_perimetro_cm: String(Math.round(entre(78, 118))), b_pas_mmhg: String(Math.round(entre(108, 172))),
    b_act_fisica: uno(['Sí', 'No'], [3, 7]), b_fyv_diario: uno(['Sí', 'No'], [4, 6]), b_hta_dx: uno(['Sí', 'No'], [2, 8]),
    b_med_antihta: uno(['Sí', 'No'], [2, 8]), b_glucosa_previa: uno(['Sí', 'No'], [2, 8]),
    b_antec_fam_dbt: uno(['No', 'Sí, parientes lejanos', 'Sí, primer grado'], [6, 2, 2]), b_fuma: uno(['Sí', 'No'], [4, 6]),
    g_acepta: uno(['Sí', 'No'], [8, 2])
  } : {};
  if (bio.b_pas_mmhg) bio.b_pad_mmhg = String(Math.round(Number(bio.b_pas_mmhg) * 0.62 + 2)); // ficticia, sin otra llamada al azar
  if (bio.g_acepta === 'Sí') Object.assign(bio, { g_hora_ingesta: '07:' + String(10 + Math.round(entre(0, 40))), g_hora_medicion: '1' + Math.round(entre(0, 5)) + ':30', g_resultado_mgdl: String(Math.round(entre(78, 190))), g_que_ingirio: 'Mate' });
  const fecha = uno(dias);
  registros.push({
    id: 'demo-' + (i + 1), participante_id: equipo + '1-' + String(i + 1).padStart(4, '0'), orden, edad, cp, codigo: Reg.codigo(orden, edad, cp),
    fecha, hora_inicio: '1' + Math.round(entre(0, 7)) + ':0' + Math.round(entre(0, 9)), equipo, dispositivo: '1', encuestador: 'Encuestador ' + equipo, puesto: 'Puesto ' + uno(['1', '2']),
    consentimiento: true, comparte_app: azar() < 0.7, contacto: {}, socio, bio, estado: azar() < 0.95 ? 'finalizado' : 'borrador',
    modificado: fecha + 'T15:00:00.000Z', version_instrumento: Inst.CUESTIONARIO.version
  });
}
// 6 participantes con una segunda visita (mismo ID)
for (let k = 0; k < 6; k++) {
  const base = registros[k * 7];
  registros.push({ ...JSON.parse(JSON.stringify(base)), id: base.id + '-control', orden: base.orden + 300, codigo: Reg.codigo(base.orden + 300, base.edad, base.cp), fecha: '2026-10-07', socio: {} });
}
const filas = registros.map(r => Reg.aplanar(r).fila);
fs.writeFileSync(path.join(__dirname, 'demo_filas.json'), JSON.stringify(filas));
console.log(filas.length + ' filas ficticias → planilla/demo_filas.json');
