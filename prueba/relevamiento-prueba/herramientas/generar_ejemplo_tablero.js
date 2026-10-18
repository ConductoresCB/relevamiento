// Genera DATOS FICTICIOS para mostrar el tablero sin usar datos reales.
// Arma dos planillas: una «previa» (entrevistas con datos parciales, equipo H) y una «actual»
// (relevamientos con la app, algunos a participantes de la previa para completar su biológica).
// Uso: node herramientas/generar_ejemplo_tablero.js  →  app/tablero/js/ejemplo.js
const fs = require('fs');
const path = require('path');
const Inst = require('../app/js/cuestionario.js');
const Reg = require('../app/js/registro.js');

let s = 20261008;
const azar = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const uno = (lista, pesos) => {
  if (!pesos) return lista[Math.floor(azar() * lista.length)];
  const t = pesos.reduce((a, b) => a + b, 0); let r = azar() * t;
  for (let i = 0; i < lista.length; i++) { r -= pesos[i]; if (r <= 0) return lista[i]; }
  return lista[lista.length - 1];
};
const varios = (lista, max) => { const k = 1 + Math.floor(azar() * max); return [...new Set(Array.from({ length: k }, () => uno(lista)))]; };
const entre = (a, b, dec = 0) => Number((a + azar() * (b - a)).toFixed(dec));
const PUNTOS = ['San Pedro', 'AXION', 'Paso de Jama'];

function persona(pais) {
  const edad = Math.round(entre(22, 67));
  const sexo = uno(['Varón', 'Mujer'], [94, 6]);
  // hábitos que después se asocian con el riesgo (para que los cruces muestren algo)
  const sedentario = azar() < 0.65;
  const horas = entre(2, 10, 1);
  const altura = sexo === 'Mujer' ? entre(1.5, 1.72, 2) : entre(1.6, 1.88, 2);
  const imc = entre(21, 30, 1) + (sedentario ? entre(0, 6, 1) : 0) + (horas > 6 ? 1.5 : 0);
  return { edad, sexo, sedentario, horas, altura, peso: Number((imc * altura * altura).toFixed(1)), pais };
}

function socioCompleto(p) {
  return {
    p01_nac_pais: p.pais, p02_educacion: uno(Inst.CUESTIONARIO.secciones[0].preguntas[1].opciones, [15, 25, 30, 8, 10, 7, 5]),
    p03_pareja: uno(['Sí', 'No'], [7, 3]), p04_convive: uno(['1', '2', '3', '4', '5', 'Más de 5']), p05_a_cargo: uno(['1', '2', '3', '4', '5', 'Más de 5']),
    p06_idiomas_entiende: p.pais === 'Brasil' ? ['Portugués', 'Español'] : p.pais === 'Paraguay' ? ['Español', 'Guaraní'] : varios(['Español', 'Portugués'], 2),
    p07_idiomas_habla: p.pais === 'Brasil' ? ['Portugués'] : p.pais === 'Paraguay' ? ['Español', 'Guaraní'] : ['Español'],
    p08_licencia: [p.pais === 'Otro país' ? 'Otro' : p.pais], p09_rutas_jujuy: uno(['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo'], [5, 25, 40, 20, 10]),
    p10_anios_chofer: Math.max(1, Math.round(entre(1, p.edad - 20))),
    p11_recorrido: uno(['Viaje provincial (Jujuy)', 'Viaje interprovincial', 'Viaje internacional'], [2, 4, 5]),
    p12_frec_corredor: uno(['Una vez a la semana', '2 veces por semana', 'Quincenalmente', 'Una vez al mes']),
    p12_frec_jujuy: uno(['Diariamente', 'Una vez a la semana', '2 veces por semana', '3 veces por semana']),
    p13_relacion_laboral: uno(['Empleado', 'Dueño del camión', 'Otro'], [6, 3, 1]), p14_conformidad: uno(['Conforme', 'Parcialmente conforme', 'Disconforme']),
    p15_riesgo_salud: uno(['Sí', 'No', 'Duda'], [6, 2, 2]), p16_horas_sin_parar: p.horas, p17_paradas: uno(['Sí', 'No'], [9, 1]),
    p18_donde_come: varios(['Paradores', 'En el camión al costado de la ruta', 'Estaciones de servicio'], 2), p19_horas_sueno: entre(4, 8, 1),
    p20_frutas_verduras: p.sedentario ? uno(['Todos los días', 'Varias veces por semana', 'Casi nunca', 'Nunca'], [1, 3, 5, 2]) : uno(['Todos los días', 'Varias veces por semana', 'Casi nunca', 'Nunca'], [4, 4, 2, 1]),
    p21_bebidas: varios(['Agua', 'Gaseosas', 'Café', 'Mate', 'Jugos artificiales'], 3), p22_sanitarios: uno(['Sí, siempre', 'A veces', 'Casi nunca', 'Nunca']),
    p23_recreativas: uno(['Sí', 'Algunas veces', 'Rara vez', 'No']), p24_siniestro: uno(['Sí', 'No'], [1, 6]), p25_fin_de_mes: uno(['Sí', 'Parcialmente', 'No']),
    p26_cobertura: uno([['Obra social'], ['Obra social', 'Prepaga'], ['Ninguna'], ['Seguro de salud']], [6, 1, 2, 1]),
    p27_control_medico: uno(['Sistema público', 'Sistema privado', 'Ninguno']), p28_frec_consulta: uno(['Una vez al año', 'Solo cuando me siento mal', '2 veces al año', 'Nunca']),
    p29_atencion_dolencias: uno([['Sistema público'], ['Sistema privado'], ['Sistema público', 'Otros (medicina tradicional, alternativa, etc.)']]),
    p30_dolores: uno(['Sí', 'No'], [6, 4]), p31_automedicacion: uno([['Ninguno'], ['Medicamentos'], ['Medicamentos', 'Hierbas']]),
    p33_diagnosticos: uno([['No tengo diagnóstico de enfermedad'], ['Musculoesqueléticos'], ['Obesidad'], ['Musculoesqueléticos', 'Digestivas']]),
    p34_actividad_fisica: p.sedentario ? uno(['Rara vez', 'Nunca', 'Una vez a la semana']) : uno(['2 a 3 veces por semana', 'Varias veces a la semana (4 o más)', 'Una vez a la semana']),
    p35_energeticas: uno([['No'], ['Café'], ['Café', 'Coca-Cola'], ['Energizantes (Speed, Monster, Red Bull, etc.)'], ['Yerba mate']]),
    p36_coquea: uno(['Sí', 'No'], [6, 4]), p37_alcohol: uno(['Sí', 'No'], [5, 5]), p38_comunicacion: uno(['Siempre', 'A veces', 'Nunca']),
    p39_comparte_trayectos: uno(['Sí', 'No'])
  };
}

function bioCompleta(p) {
  const bio = {
    b_dbt_dx: uno(['Sí', 'No'], [1, 11]), b_sexo: p.sexo, b_peso_kg: String(p.peso), b_altura_m: String(p.altura),
    b_perimetro_cm: String(Math.round(70 + (p.peso / (p.altura * p.altura)) * 1.05 + entre(-4, 6))),
    b_pas_mmhg: String(Math.round(entre(108, 150) + (p.edad > 50 ? 10 : 0) + (p.horas > 6 ? 6 : 0))),
    b_act_fisica: p.sedentario ? 'No' : 'Sí', b_fyv_diario: uno(['Sí', 'No'], [4, 6]), b_hta_dx: uno(['Sí', 'No'], [2, 8]),
    b_med_antihta: uno(['Sí', 'No'], [2, 8]), b_glucosa_previa: uno(['Sí', 'No'], [2, 8]),
    b_antec_fam_dbt: uno(['No', 'Sí, parientes lejanos', 'Sí, primer grado'], [6, 2, 2]), b_fuma: uno(['Sí', 'No'], [4, 6]), g_acepta: uno(['Sí', 'No'], [8, 2])
  };
  // Diastólica ficticia derivada de la sistólica (sin otra llamada al azar, para no cambiar el resto de los datos de ejemplo)
  bio.b_pad_mmhg = String(Math.round(Number(bio.b_pas_mmhg) * 0.62 + 2));
  if (bio.g_acepta === 'Sí') Object.assign(bio, { g_hora_ingesta: '07:' + (10 + Math.round(entre(0, 40))), g_hora_medicion: '1' + Math.round(entre(0, 5)) + ':30', g_resultado_mgdl: String(Math.round(entre(78, 175) + (p.sedentario ? 12 : 0))), g_que_ingirio: 'Mate' });
  return bio;
}

function registro(o) {
  return Object.assign({ consentimiento: true, comparte_app: azar() < 0.7, contacto: {}, estado: 'finalizado', dispositivo: '1', version_instrumento: Inst.CUESTIONARIO.version }, o);
}
const compacto = f => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== null && v !== undefined));

// Planilla previa: 30 participantes, entrevistas semiestructuradas → solo parte de las preguntas
const previa = [], personasPrevia = [];
const mesesPrevia = ['2026-03-31', '2026-04-08', '2026-05-05', '2026-05-18', '2026-06-22', '2026-07-02', '2026-07-29'];
for (let i = 0; i < 30; i++) {
  const p = persona(uno(['Argentina', 'Paraguay', 'Chile', 'Brasil'], [55, 30, 9, 6]));
  personasPrevia.push(p);
  const completo = socioCompleto(p), socio = {};
  Object.keys(completo).forEach(k => { if (azar() < 0.5) socio[k] = completo[k]; });
  const bio = { b_sexo: p.sexo };
  if (azar() < 0.2) { bio.b_peso_kg = String(p.peso); bio.b_altura_m = String(p.altura); }
  if (azar() < 0.2) bio.b_pas_mmhg = String(Math.round(entre(115, 160)));
  if (azar() < 0.3) bio.b_fuma = uno(['Sí', 'No'], [4, 6]);
  const pid = 'P1-' + String(i + 1).padStart(4, '0');
  previa.push(Reg.aplanar(registro({ id: 'previo-' + pid, participante_id: pid, edad: azar() < 0.85 ? p.edad : '', fecha: uno(mesesPrevia), equipo: 'P',
    encuestador: 'Equipo de entrevistas', puesto: PUNTOS[i % 3], socio, bio, version_instrumento: 'entrevista previa (transcripción)', modificado: '2026-10-08T00:00:00.000Z' })).fila);
}

// Planilla actual: 100 relevamientos nuevos con la app + 18 visitas de control a participantes de la previa
const actual = [];
const dias = ['2026-10-14', '2026-10-15', '2026-10-21', '2026-10-22', '2026-10-28', '2026-10-29', '2026-11-04', '2026-11-05', '2026-11-11'];
const equipos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H2', 'I', 'J'].filter(e => e !== 'H2');
for (let i = 0; i < 100; i++) {
  const p = persona(uno(['Argentina', 'Chile', 'Brasil', 'Paraguay', 'Otro país'], [58, 18, 12, 11, 1]));
  const equipo = uno(equipos), orden = 1 + i, fecha = uno(dias);
  actual.push(Reg.aplanar(registro({ id: 'demo-' + (i + 1), participante_id: equipo + '1-' + String(i + 1).padStart(4, '0'), orden, edad: p.edad, cp: uno(['4600', '4612', '4400', '4500', '4630']),
    codigo: Reg.codigo(orden, p.edad, '4600'), fecha, equipo, encuestador: 'Encuestador ' + equipo, puesto: uno(PUNTOS, [3, 4, 3]),
    socio: socioCompleto(p), bio: bioCompleta(p), estado: azar() < 0.96 ? 'finalizado' : 'borrador', modificado: fecha + 'T15:00:00.000Z' })).fila);
}
for (let k = 0; k < 18; k++) {
  const i = k * 1 + (k > 8 ? 3 : 0), p = personasPrevia[i], pid = 'P1-' + String(i + 1).padStart(4, '0'), fecha = uno(dias);
  actual.push(Reg.aplanar(registro({ id: 'control-' + pid, participante_id: pid, edad: p.edad, cp: '4600', orden: 150 + k, codigo: Reg.codigo(150 + k, p.edad, '4600'),
    fecha, equipo: uno(equipos), encuestador: 'Encuestador de control', puesto: PUNTOS[i % 3], socio: {}, bio: bioCompleta(p), modificado: fecha + 'T16:00:00.000Z' })).fila);
}

const salida = path.join(__dirname, '..', 'app', 'tablero', 'js', 'ejemplo.js');
fs.writeFileSync(salida, '/* DATOS FICTICIOS generados por herramientas/generar_ejemplo_tablero.js. No son participantes reales. */\n' +
  'window.EJEMPLO_TABLERO = ' + JSON.stringify({ previa: previa.map(compacto), actual: actual.map(compacto) }) + ';\n');
console.log(`previa ${previa.length} filas, actual ${actual.length} filas → ${salida}`);
