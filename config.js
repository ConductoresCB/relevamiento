/*
 * ============================================================================
 *  config.js — LO QUE SE PUEDE CAMBIAR SIN PROGRAMAR
 * ============================================================================
 *  Reglas para editar este archivo sin romper nada:
 *   1. Cambiá solo el texto que está ENTRE COMILLAS simples: 'así'.
 *   2. No borres las comas del final de cada línea, ni las llaves { } ni los corchetes [ ].
 *   3. Si un texto lleva un apóstrofo, escribilo con barra: 'D\'Agostino'.
 *   4. Después de cualquier cambio, subí el número de versionApp (por ejemplo de
 *      '1.1.0' a '1.1.1'). Así los celulares descargan la versión nueva la próxima
 *      vez que abran la app con señal.
 *
 *  Las PREGUNTAS de la encuesta no están acá: están en cuestionario.js.
 *  Los COLORES están al principio de css/estilos.css (sección :root).
 *  El NOMBRE que aparece debajo del ícono está en manifest.webmanifest ("short_name").
 * ============================================================================
 */
(function (raiz) {
  'use strict';
  raiz.CONFIG = {

    // Versión de la app. Subila con cada cambio que publiques.
    versionApp: '1.5.3-prueba',

    // VERSIÓN DE PRUEBA: guarda sus datos y su copia sin señal APARTE de la app principal,
    // aunque las dos estén en el mismo celular. No cambiar estos nombres.
    almacen: 'relevamiento-corredor-prueba',
    prefijoCache: 'prueba-relevamiento',
    esPrueba: true,

    proyecto: {
      nombre: 'Relevamiento PRUEBA',                 // aparece en la pestaña del navegador
      lugar: 'Corredor Bioceánico · Jujuy'    // aparece arriba de "Jornada del…"
    },

    // Valores con los que arranca un celular nuevo (después se cambian en Ajustes).
    ajustesIniciales: { equipo: 'A', dispositivo: '1', ordenDesde: 1, ordenHasta: 199 },

    // Nombres de las etapas que se ven en las barras de progreso.
    pasos: ['Identificación', 'Socio', 'Biológica', 'Resultados'],
    pasosBio: ['Mediciones', 'Antecedentes y hábitos', 'Glucometría'],

    // Textos de botones, títulos y avisos de la interfaz.
    textos: {
      jornada: 'Jornada del',
      conSenal: 'Con señal',
      sinSenal: 'Sin señal',
      relevadosHoy: 'Relevados hoy',
      sinSincronizar: 'Sin sincronizar',
      nuevoRelevamiento: 'Nuevo relevamiento',
      buscar: 'Buscar por código o celular',
      relevamientosHoy: 'Relevamientos de hoy',
      cerrarJornada: 'Cerrar jornada y sincronizar',
      nuevoParticipante: 'Nuevo participante',
      identificacion: 'Identificación',
      codigoIdentificacion: 'Código de identificación',
      datosContacto: 'Contacto del camionero entrevistado',
      consentimiento: 'Leyó y aceptó el consentimiento informado.',
      comparteApp: 'Acepta que sus resultados se vean en la app de camioneros.',
      continuarSocio: 'Continuar con sociodemográfica',
      irDirectoBio: 'Ir directo a la biológica',
      cejaSocio: 'Paso 2 · Sociodemográfica',
      irABio: 'Ir a biológica',
      cejaBio: 'Paso 3 · Biológica',
      verResultados: 'Ver resultados',
      cejaResultados: 'Paso 4 · Cierre',
      resultados: 'Resultados',
      guardarYVolver: 'Guardar y volver a la jornada',
      cierreJornada: 'Cierre de jornada',
      sincronizarAhora: 'Sincronizar ahora',
      compartirPaquete: 'Compartir paquete del día',
      descargarCsv: 'Descargar CSV para Excel',
      criterioDerivacion: 'Criterio de derivación: [a definir por el equipo]',

      // Quién recibe los paquetes y administra la planilla (aparece en Cierre y en Ajustes).
      responsable: 'la administradora',
      seccionAdministracion: 'Administración y respaldo',
      cejaImportar: 'Administración',

      // Pantalla de identificación: quién hace esta entrevista (puede cambiar de una a otra).
      encuestadoresEntrevista: 'Encuestador/es de esta entrevista',
      ayudaEncuestadores: 'Si son varios, escribí los nombres separados por «y».',

      // Archivos sin cifrar (CSV): aviso que aparece en la pantalla de Administración.
      avisoSinCifrar: 'Estos archivos NO están cifrados: guardalos solo en la computadora de análisis. No los mandes por WhatsApp ni los subas a una carpeta compartida.'
    },

    // Consentimiento (pantalla «Antes de empezar»): resumen que se le lee al camionero.
    consentimientoResumen: [
      'Proyecto de la UNJu sobre riesgo cardiovascular en camioneros del corredor.',
      'Encuesta, medidas del cuerpo, presión y una punción en el dedo.',
      'Puede negarse o retirarse en cualquier momento, sin costo ni pago.',
      'Todo es confidencial.'
    ],
    // Texto completo del consentimiento aprobado (opcional). Si se completa, aparece «Ver el texto completo».
    consentimientoTexto: '',

    // Recomendación que se muestra según el riesgo de Framingham (texto del protocolo).
    recomendacionFramingham: {
      Bajo: 'Mantener hábitos saludables.',
      Moderado: 'Evaluar si necesita tratamiento preventivo.',
      Alto: 'Se recomiendan intervenciones médicas.'
    },

    // Rangos válidos: fuera de estos valores la app marca el campo en rojo (no impide guardar).
    rangos: {
      edad: [18, 99],
      peso: [35, 250],          // kg
      altura: [1.2, 2.2],       // m
      perimetro: [50, 200],     // cm
      pas: [70, 260],           // mmHg, sistólica
      pad: [40, 150],           // mmHg, diastólica
      glucemia: [20, 600]       // mg/dL
    }
  };
})(typeof window !== 'undefined' ? window : self);
