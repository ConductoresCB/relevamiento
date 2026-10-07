/*
 * cuestionario.js — Definición del instrumento.
 * Para cambiar una pregunta u opción se edita SOLO este archivo.
 * Cada "id" es el nombre de la columna en la planilla: no lo cambien una vez que empezó el relevamiento.
 *
 * Tipos: 'unica' (una opción), 'multiple' (varias), 'lista' (desplegable), 'numero', 'texto', 'grupo'.
 * detalles: campo de texto que aparece al elegir una opción (p. ej. "Otro (especificar)").
 * exclusiva: opción de 'multiple' que desmarca las demás (p. ej. "Ninguna").
 * mostrarSi: { id, igual } o { id, incluye: [...] } para preguntas condicionales.
 */
(function (raiz) {
  'use strict';

  var SI_NO = ['Sí', 'No'];
  var FRECUENCIA = ['Diariamente', 'Una vez a la semana', '2 veces por semana', '3 veces por semana',
    'Quincenalmente', 'Una vez al mes', 'Otro'];
  var CANTIDAD = ['1', '2', '3', '4', '5', 'Más de 5'];

  var CUESTIONARIO = {
    version: '2026-10-v1',
    titulo: 'Encuesta sociodemográfica · Conductores de camiones del Corredor Bioceánico - Jujuy',
    secciones: [
      {
        id: 's1', titulo: 'Origen y educación', preguntas: [
          { n: 1, id: 'p01_nac_pais', texto: 'Lugar de nacimiento', tipo: 'unica',
            opciones: ['Argentina', 'Brasil', 'Chile', 'Paraguay', 'Otro país'],
            detalles: {
              'Argentina': { id: 'p01_nac_detalle', etiqueta: 'Provincia' },
              'Brasil': { id: 'p01_nac_detalle', etiqueta: 'Estado' },
              'Chile': { id: 'p01_nac_detalle', etiqueta: 'Región' },
              'Paraguay': { id: 'p01_nac_detalle', etiqueta: 'Departamento' },
              'Otro país': { id: 'p01_nac_detalle', etiqueta: '¿Qué país?' }
            } },
          { n: 2, id: 'p02_educacion', texto: 'Máximo nivel educativo alcanzado', tipo: 'unica',
            // En el modelo figuraba "Secundaria incompleta" dos veces: se corrigió la segunda a "completa".
            opciones: ['Primaria completa', 'Secundaria incompleta', 'Secundaria completa',
              'Terciario incompleto', 'Terciario completo', 'Universitario incompleto', 'Universitario completo'] }
        ]
      },
      {
        id: 's2', titulo: 'Hogar', preguntas: [
          { n: 3, id: 'p03_pareja', texto: '¿Está actualmente en pareja?', tipo: 'unica', opciones: SI_NO },
          { n: 4, id: 'p04_convive', texto: 'Cantidad de personas con que convive', tipo: 'unica', opciones: CANTIDAD, enLinea: true },
          { n: 5, id: 'p05_a_cargo', texto: 'Cantidad de personas que tiene a cargo', tipo: 'unica', opciones: CANTIDAD, enLinea: true }
        ]
      },
      {
        id: 's3', titulo: 'Idiomas y licencia', preguntas: [
          { n: 6, id: 'p06_idiomas_entiende', texto: '¿Qué idioma(s) entiende?', tipo: 'multiple',
            opciones: ['Español', 'Guaraní', 'Portugués', 'Inglés', 'Otro'],
            detalles: { 'Otro': { id: 'p06_otro', etiqueta: 'Especificar' } } },
          { n: 7, id: 'p07_idiomas_habla', texto: '¿Qué idioma(s) habla?', tipo: 'multiple',
            opciones: ['Español', 'Guaraní', 'Portugués', 'Inglés', 'Otro'],
            detalles: { 'Otro': { id: 'p07_otro', etiqueta: 'Especificar' } } },
          { n: 8, id: 'p08_licencia', texto: 'Categoría de licencia profesional que posee', tipo: 'multiple',
            opciones: ['Argentina', 'Brasil', 'Chile', 'Paraguay', 'Otro'],
            detalles: {
              'Argentina': { id: 'p08_lic_ar', etiqueta: 'Categoría (Argentina)' },
              'Brasil': { id: 'p08_lic_br', etiqueta: 'Categoría (Brasil)' },
              'Chile': { id: 'p08_lic_cl', etiqueta: 'Categoría (Chile)' },
              'Paraguay': { id: 'p08_lic_py', etiqueta: 'Categoría (Paraguay)' },
              'Otro': { id: 'p08_lic_otro', etiqueta: 'País y categoría' }
            } }
        ]
      },
      {
        id: 's4', titulo: 'Trabajo y recorrido', preguntas: [
          { n: 9, id: 'p09_rutas_jujuy', texto: '¿Cómo es el estado de las rutas que recorre en Jujuy?', tipo: 'unica',
            opciones: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo'] },
          { n: 10, id: 'p10_anios_chofer', texto: '¿Hace cuántos años trabaja como chofer de camión?', tipo: 'numero',
            unidad: 'años', min: 0, max: 70, decimales: 0 },
          { n: 11, id: 'p11_recorrido', texto: '¿Qué recorrido está realizando ahora?', tipo: 'unica',
            opciones: ['Viaje provincial (Jujuy)', 'Viaje interprovincial', 'Viaje internacional'] },
          { n: 12, id: 'p12_frecuencia', texto: '¿Con qué frecuencia realiza ese recorrido?', tipo: 'grupo', campos: [
            { id: 'p12_frec_corredor', etiqueta: 'Otros tramos del corredor + Jujuy', tipo: 'lista', opciones: FRECUENCIA,
              detalles: { 'Otro': { id: 'p12_frec_corredor_otro', etiqueta: 'Especificar' } } },
            { id: 'p12_frec_jujuy', etiqueta: 'Tramo Jujuy', tipo: 'lista', opciones: FRECUENCIA,
              detalles: { 'Otro': { id: 'p12_frec_jujuy_otro', etiqueta: 'Especificar' } } }
          ] },
          { n: 13, id: 'p13_relacion_laboral', texto: '¿Cuál es su relación laboral actual?', tipo: 'unica', enLinea: true,
            opciones: ['Empleado', 'Dueño del camión', 'Otro'],
            detalles: { 'Otro': { id: 'p13_otro', etiqueta: 'Especificar' } } },
          { n: 14, id: 'p14_conformidad', texto: '¿Cómo se siente con su situación laboral actual?', tipo: 'unica',
            opciones: ['Conforme', 'Parcialmente conforme', 'Disconforme'] },
          { n: 15, id: 'p15_riesgo_salud', texto: '¿Cree que su trabajo representa un riesgo para su salud?', tipo: 'unica', enLinea: true,
            opciones: ['Sí', 'No', 'Duda'] },
          { n: 16, id: 'p16_horas_sin_parar', texto: 'Por lo general, ¿cuántas horas conduce sin hacer paradas?', tipo: 'numero',
            unidad: 'horas', min: 0, max: 24, decimales: 1 },
          { n: 17, id: 'p17_paradas', texto: '¿Realiza paradas durante su recorrido?', tipo: 'unica', enLinea: true, opciones: SI_NO }
        ]
      },
      {
        id: 's5', titulo: 'Hábitos en ruta', preguntas: [
          { n: 18, id: 'p18_donde_come', texto: '¿Dónde suele comer durante los viajes?', tipo: 'multiple',
            opciones: ['Paradores', 'En el camión al costado de la ruta', 'Estaciones de servicio',
              'En casas de familiares o conocidos', 'Otro'],
            detalles: { 'Otro': { id: 'p18_otro', etiqueta: 'Especificar' } } },
          { n: 19, id: 'p19_horas_sueno', texto: '¿Cuántas horas duerme por día?', tipo: 'numero',
            unidad: 'horas', min: 0, max: 24, decimales: 1 },
          { n: 20, id: 'p20_frutas_verduras', texto: '¿Con qué frecuencia consume frutas y verduras mientras está en ruta?', tipo: 'unica',
            opciones: ['Todos los días', 'Varias veces por semana', 'Casi nunca', 'Nunca'] },
          { n: 21, id: 'p21_bebidas', texto: '¿Qué bebidas consume durante sus viajes?', tipo: 'multiple',
            opciones: ['Agua', 'Jugos artificiales', 'Jugos naturales', 'Gaseosas', 'Café', 'Té', 'Mate', 'Otro'],
            detalles: { 'Otro': { id: 'p21_otro', etiqueta: 'Especificar' } } },
          { n: 22, id: 'p22_sanitarios', texto: '¿Suele tener acceso a sanitarios en sus recorridos?', tipo: 'unica',
            opciones: ['Sí, siempre', 'A veces', 'Casi nunca', 'Nunca'] },
          { n: 23, id: 'p23_recreativas', texto: '¿Dedica tiempo al mes a actividades recreativas (cine, paseos, deporte, etc.)?', tipo: 'unica',
            opciones: ['Sí', 'Algunas veces', 'Rara vez', 'No'] }
        ]
      },
      {
        id: 's6', titulo: 'Economía y salud', preguntas: [
          { n: 24, id: 'p24_siniestro', texto: '¿Ha tenido algún siniestro vial en el último año?', tipo: 'unica', enLinea: true, opciones: SI_NO },
          { n: 25, id: 'p25_fin_de_mes', texto: 'Con lo que gana, ¿llega a fin de mes?', tipo: 'unica', enLinea: true,
            opciones: ['Sí', 'Parcialmente', 'No'] },
          { n: 26, id: 'p26_cobertura', texto: '¿Tiene cobertura médica?', tipo: 'multiple',
            opciones: ['Obra social', 'Prepaga', 'Seguro de salud', 'Ninguna'], exclusiva: 'Ninguna' },
          { n: 27, id: 'p27_control_medico', texto: '¿Dónde recurre para control médico?', tipo: 'unica',
            opciones: ['Sistema público', 'Sistema privado', 'Ninguno'] },
          { n: 28, id: 'p28_frec_consulta', texto: '¿Con qué frecuencia consulta al médico, aunque no presente síntomas?', tipo: 'unica',
            opciones: ['Una vez al mes', '2 veces al año', 'Una vez al año', 'Solo cuando me siento mal', 'Nunca'] },
          { n: 29, id: 'p29_atencion_dolencias', texto: '¿Dónde recurre para atención de dolencias, malestar o síntomas?', tipo: 'multiple',
            opciones: ['Sistema público', 'Sistema privado', 'Otros (medicina tradicional, alternativa, etc.)', 'Ninguno'],
            exclusiva: 'Ninguno' },
          { n: 30, id: 'p30_dolores', texto: '¿Tiene dolores frecuentes en alguna parte del cuerpo?', tipo: 'unica', enLinea: true,
            opciones: SI_NO, detalles: { 'Sí': { id: 'p30_cuales', etiqueta: '¿Qué dolores corporales presenta?' } } },
          { n: 31, id: 'p31_automedicacion', texto: 'Sin indicación médica, suele tomar:', tipo: 'multiple',
            opciones: ['Medicamentos', 'Hierbas', 'Ninguno'], exclusiva: 'Ninguno' },
          { n: 32, id: 'p32_cuales_med', texto: '¿Qué medicamentos o hierbas toma?', tipo: 'texto',
            mostrarSi: { id: 'p31_automedicacion', incluye: ['Medicamentos', 'Hierbas'] } },
          { n: 33, id: 'p33_diagnosticos', texto: 'Actualmente, ¿ha sido diagnosticado con alguna enfermedad?', tipo: 'multiple',
            opciones: ['No tengo diagnóstico de enfermedad', 'Musculoesqueléticos', 'Renal', 'Ocular', 'Digestivas',
              'Auditivo', 'Respiratorias', 'Obesidad', 'Osteoarticular', 'VIH/SIDA', 'Otros'],
            exclusiva: 'No tengo diagnóstico de enfermedad',
            detalles: { 'Otros': { id: 'p33_otro', etiqueta: 'Especificar' } } }
        ]
      },
      {
        id: 's7', titulo: 'Consumos y vínculos', preguntas: [
          { n: 34, id: 'p34_actividad_fisica', texto: '¿Con qué frecuencia realiza actividad física fuera del trabajo?', tipo: 'unica',
            opciones: ['Varias veces a la semana (4 o más)', '2 a 3 veces por semana', 'Una vez a la semana', 'Rara vez', 'Nunca'] },
          { n: 35, id: 'p35_energeticas', texto: '¿Consume bebidas energéticas durante sus viajes?', tipo: 'multiple',
            opciones: ['No', 'Café', 'Coca-Cola', 'Pepsi-Cola', 'Yerba mate', 'Energizantes (Speed, Monster, Red Bull, etc.)', 'Otro'],
            exclusiva: 'No', detalles: { 'Otro': { id: 'p35_otro', etiqueta: 'Especificar' } } },
          { n: 36, id: 'p36_coquea', texto: '¿Usted coquea?', tipo: 'unica', enLinea: true, opciones: SI_NO },
          { n: 37, id: 'p37_alcohol', texto: '¿Consume bebidas alcohólicas? (en horario NO laboral)', tipo: 'unica', enLinea: true, opciones: SI_NO },
          { n: 38, id: 'p38_comunicacion', texto: '¿Con qué frecuencia se comunica con colegas durante sus viajes?', tipo: 'unica', enLinea: true,
            opciones: ['Siempre', 'A veces', 'Nunca'] },
          { n: 39, id: 'p39_comparte_trayectos', texto: '¿Suele compartir trayectos con otros choferes?', tipo: 'unica', enLinea: true, opciones: SI_NO }
        ]
      }
    ]
  };

  /* Campos del módulo biológico (la pantalla está armada a mano en app.js). */
  var BIO = [
    { id: 'b_dbt_dx', texto: '¿Tiene diagnóstico de diabetes?', opciones: SI_NO },
    { id: 'b_sexo', texto: 'Sexo', opciones: ['Mujer', 'Varón', 'Otro'] },
    { id: 'b_peso_kg', texto: 'Peso (kg)' },
    { id: 'b_altura_m', texto: 'Altura (m)' },
    { id: 'b_imc', texto: 'IMC (calculado)' },
    { id: 'b_perimetro_cm', texto: 'Perímetro abdominal (cm)' },
    { id: 'b_pas_mmhg', texto: 'Presión arterial sistólica (mmHg)' },
    { id: 'b_act_fisica', texto: '¿Hace actividad física regularmente? (al menos 30 min por día)', opciones: SI_NO },
    { id: 'b_fyv_diario', texto: '¿Consume frutas o verduras todos los días?', opciones: SI_NO },
    { id: 'b_hta_dx', texto: '¿Tiene diagnóstico de hipertensión?', opciones: SI_NO },
    { id: 'b_med_antihta', texto: '¿Toma medicación antihipertensiva?', opciones: SI_NO },
    { id: 'b_glucosa_previa', texto: '¿Tuvo glucosa elevada en sangre alguna vez?', opciones: SI_NO },
    { id: 'b_antec_fam_dbt', texto: 'Antecedentes familiares de diabetes', opciones: ['No', 'Sí, parientes lejanos', 'Sí, primer grado'] },
    { id: 'b_fuma', texto: '¿Fuma tabaco?', opciones: SI_NO },
    { id: 'g_acepta', texto: '¿Acepta evaluarse el nivel de azúcar en sangre?', opciones: SI_NO },
    { id: 'g_hora_ingesta', texto: 'Hora de la última ingesta (líquido o sólido)' },
    { id: 'g_que_ingirio', texto: '¿Qué comió o bebió?' },
    { id: 'g_hora_medicion', texto: 'Hora de la medición' },
    { id: 'g_resultado_mgdl', texto: 'Resultado de glucometría periférica (mg/dL)' }
  ];

  var CALCULADOS = [
    { id: 'g_ayuno_min', texto: 'Minutos de ayuno (calculado)' },
    { id: 'fr_aplica', texto: 'FINDRISK: ¿corresponde aplicarlo?' },
    { id: 'fr_puntos', texto: 'FINDRISK: puntaje total' },
    { id: 'fr_categoria', texto: 'FINDRISK: nivel de riesgo' },
    { id: 'fr_probabilidad', texto: 'FINDRISK: probabilidad de diabetes a 10 años' },
    { id: 'fh_aplica', texto: 'Framingham: ¿corresponde aplicarlo?' },
    { id: 'fh_puntos', texto: 'Framingham: puntaje total' },
    { id: 'fh_riesgo', texto: 'Framingham: riesgo a 10 años (%)' },
    { id: 'fh_categoria', texto: 'Framingham: categoría de riesgo' }
  ];

  var META = [
    { id: 'id', texto: 'Identificador único del relevamiento (generado por la app)' },
    { id: 'participante_id', texto: 'ID estable del participante (vincula visitas)' },
    { id: 'codigo', texto: 'Código de identificación (orden-edad-código postal)' },
    { id: 'orden', texto: 'Número de orden' },
    { id: 'edad', texto: 'Edad (años cumplidos)' },
    { id: 'cp', texto: 'Código postal' },
    { id: 'fecha', texto: 'Fecha del relevamiento (AAAA-MM-DD)' },
    { id: 'hora_inicio', texto: 'Hora de inicio' },
    { id: 'hora_fin', texto: 'Hora de cierre' },
    { id: 'equipo', texto: 'Equipo' },
    { id: 'dispositivo', texto: 'Dispositivo' },
    { id: 'encuestador', texto: 'Encuestador/a' },
    { id: 'puesto', texto: 'Puesto o lugar de relevamiento' },
    { id: 'consentimiento', texto: 'Consentimiento informado' },
    { id: 'comparte_app', texto: 'Acepta compartir con la app de camioneros' },
    { id: 'socio_respondidas', texto: 'Preguntas sociodemográficas respondidas' },
    { id: 'socio_completo', texto: 'Módulo sociodemográfico completo' },
    { id: 'bio_completo', texto: 'Módulo biológico completo' },
    { id: 'gluc_realizada', texto: 'Glucometría realizada' },
    { id: 'estado', texto: 'Estado del relevamiento' },
    { id: 'version_instrumento', texto: 'Versión del instrumento' },
    { id: 'modificado', texto: 'Última modificación (fecha y hora)' }
  ];

  var CONTACTO = ['id', 'participante_id', 'codigo', 'correo', 'celular', 'consentimiento', 'comparte_app', 'fecha'];

  /* Lista ordenada de columnas de la hoja "Datos" con su descripción. */
  function columnas() {
    var cols = META.slice();
    CUESTIONARIO.secciones.forEach(function (s) {
      s.preguntas.forEach(function (p) {
        var lista = p.tipo === 'grupo' ? p.campos : [p];
        lista.forEach(function (c) {
          var texto = (p.tipo === 'grupo' ? p.n + '. ' + p.texto + ' — ' + c.etiqueta : p.n + '. ' + p.texto);
          cols.push({ id: c.id, texto: texto, opciones: c.opciones, tipo: c.tipo, seccion: s.titulo });
          var vistos = {};
          Object.keys(c.detalles || {}).forEach(function (op) {
            var d = c.detalles[op];
            if (vistos[d.id]) return;
            vistos[d.id] = true;
            cols.push({ id: d.id, texto: p.n + '. ' + d.etiqueta + ' (si responde «' + op + '»)', tipo: 'texto', seccion: s.titulo });
          });
        });
      });
    });
    BIO.forEach(function (b) { cols.push({ id: b.id, texto: b.texto, opciones: b.opciones, seccion: 'Biológica' }); });
    CALCULADOS.forEach(function (b) { cols.push({ id: b.id, texto: b.texto, seccion: 'Calculados' }); });
    return cols;
  }

  var api = { CUESTIONARIO: CUESTIONARIO, BIO: BIO, CALCULADOS: CALCULADOS, META: META,
    CONTACTO: CONTACTO, columnas: columnas };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Instrumento = api;
})(typeof window !== 'undefined' ? window : this);
