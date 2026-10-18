"""
Planilla previa depurada: una fila por persona, con el registro anterior a la app
(lista oficial 2026_CAMIONEROS + transcripciones) cruzado con el listado de audios.

Entradas (confidenciales: previo/fuentes/ no se sube a GitHub ni se comparte):
  previo/fuentes/Tablero_previo_entrevistas_v1.xlsx   planilla del 09/10 (mañana): Datos, Contactos,
                                                       Evidencia, Salud y temas y notas de la extracción
  previo/fuentes/Entrevistas.docx                      transcripciones (se controla qué bloques están)
Salida:
  previo/Tablero_previo_entrevistas.xlsx

Qué hace:
  1. Unifica las entrevistas que eran la misma persona de la lista oficial (UNIFICAR).
  2. Quita los extras que no eran personas nuevas (QUITAR) y corrige fechas imposibles (CORREGIR_FECHA).
  3. Recalcula las columnas derivadas con las reglas de la app (previo/recalcular.js) y conserva
     los riesgos ya registrados cuando faltan datos crudos para recalcularlos.
  4. Agrega el estado de audio y transcripción de cada persona (AUDIO) y la conciliación
     con el listado de audios (LISTADO), más la lista de pendientes para el equipo.

Uso:  python3 previo/generar_previo.py
"""
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile

import openpyxl
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, os.path.join(RAIZ, 'planilla'))
import generar_planilla as GP  # noqa: E402

V1 = os.path.join(AQUI, 'fuentes', 'Tablero_previo_entrevistas_v1.xlsx')
DOCX = os.path.join(AQUI, 'fuentes', 'Entrevistas.docx')
SALIDA = os.path.join(AQUI, 'Tablero_previo_entrevistas.xlsx')
HOY = '09/10/2026'

COLS = GP.COLS
TEXTO = {c['id']: c['texto'] for c in COLS}
TIPO = {c['id']: c.get('tipo') for c in COLS}
LETRA = dict(GP.LETRA)
LETRA['imc_mayor25'] = get_column_letter(len(COLS) + 1)
META = {'id', 'participante_id', 'codigo', 'orden', 'edad', 'cp', 'fecha', 'hora_inicio', 'hora_fin', 'equipo',
        'dispositivo', 'encuestador', 'puesto', 'consentimiento', 'comparte_app', 'socio_respondidas', 'socio_completo',
        'bio_completo', 'gluc_realizada', 'estado', 'version_instrumento', 'modificado'}
CALCULADAS = {'b_imc', 'g_ayuno_min', 'fr_aplica', 'fr_puntos', 'fr_categoria', 'fr_probabilidad', 'fh_aplica',
              'fh_puntos', 'fh_riesgo', 'fh_categoria', 'imc_mayor25'}
TEXTO_LIBRE = {c['id'] for c in COLS if c.get('tipo') == 'texto' or c['id'].endswith(('_otro', '_cuales', '_detalle'))
               or c['id'] in ('p32_cuales_med', 'g_que_ingirio')}

# ---------------------------------------------------------------------------
# Decisiones de depuración (09/10/2026, tarde). Cada una dice en qué se apoya.
# ---------------------------------------------------------------------------
UNIFICAR = {
    # extra: (destino, motivo)
    'P1-0101': ('P1-0017', 'La entrevista «Hector» (chofer de colectivo) es Hector Salinas: 70 años (código 017-70; «soy de la clase 55»), '
                           'la entrevistadora le pregunta si nació en Palpalá (procedencia de la lista), menciona a Valeria (encuestadora '
                           'de la lista) y el fin de semana de carnaval, que coincide con la fecha de la lista (sábado 14/02/2026). '
                           'Coinciden además 30 años de chofer, hipertensión, coqueo y té de laurel.'),
    'P1-0102': ('P1-0004', 'La entrevista «Santiago» (San Pedro) es la persona de orden 4: dice 71 años (código 004-71-4500), vive en '
                           'San Pedro, es delgado (IMC < 25 en la lista) y no tiene diagnósticos (lista: diabetes NO, hipertensión NO). '
                           '«Pito» (orden 0) tiene 67 años según su código.'),
}
QUITAR = {
    'P1-0104': '«Sin nombre» de San Pedro en el listado de audios: no es una persona nueva. Según Fabiola, el audio sin nombre '
               'es el de David López (P1-0014); si no lo fuera, el candidato es «Pito» (P1-0000), que tiene entrevista en la lista.',
}
CORREGIR_FECHA = {
    'P1-0022': ('2026-03-30', 'Fecha corregida: la lista dice 30/09/2026, posterior a la transcripción (08/04/2026). Se tomó 30/03/2026, '
                              'la jornada de AXION con Elbio y Ovelar (también paraguayos). Confirmar.'),
}

# Nombre para mostrar cuando la lista no tiene nombre o difiere del audio.
NOMBRE_VISIBLE = {
    'P1-0002': 'Don Godoy (sin nombre en la lista)', 'P1-0004': 'Santiago (sin nombre en la lista)',
    'P1-0005': 'Lidia R. (sin nombre en la lista)', 'P1-0010': 'Roberto («Marcelo» en el audio)',
    'P1-0025': 'Daniel Martinez («Derlis M» en el audio)', 'P1-0103': 'Empleado de Lidia R. (sin nombre)',
    'P1-0105': 'Javier Martinez (solo en el listado de audios)',
}

# Audio, transcripción, nombre en el audio, cómo se identificó, detalle.
# Audio: Sí / A confirmar / No. Transcripción: Completa / Parcial / Pendiente / —
AUDIO = {
    'P1-0000': ('A confirmar', '—', '', 'Lista oficial',
                'La lista marca entrevista «SI» (30/08/2025, Omar), pero ningún audio lleva ese nombre. Podría ser el «Sin nombre» de San Pedro del listado.'),
    'P1-0001': ('Sí', 'Completa', 'Sebastian', 'Lista oficial', '40 años, de Mar del Plata, 20 años de chofer (confirmado por Fabiola).'),
    'P1-0002': ('Sí', 'Parcial', 'Don Godoy', 'Por evidencia: 64 años, FINDRISK alto y entrevistadora Lidia',
                'Solo está transcripto el cierre (devolución de resultados); faltan las preguntas.'),
    'P1-0003': ('No', '—', '', 'Lista oficial', ''),
    'P1-0004': ('Sí', 'Completa', 'Santiago («Santiago Luis»)', 'Unificado por evidencia (antes P1-0102)', UNIFICAR['P1-0102'][1]),
    'P1-0005': ('Sí', 'Completa', 'Lidiana / «Roja Lidia»', 'Por evidencia: mujer, dueña de camiones, docente, San Pedro',
                'Entrevista conjunta con su empleado (P1-0103).'),
    'P1-0006': ('No', '—', '', 'Lista oficial', ''),
    'P1-0007': ('No', '—', '', 'Lista oficial', ''),
    'P1-0008': ('Sí', 'Completa', 'Jorge', 'Lista oficial', 'Audio compartido con Lautaro («Jorge y Lautaro» en el listado).'),
    'P1-0009': ('Sí', 'Pendiente', 'Lautaro', 'Lista oficial y listado de audios',
                'Está en el audio de Jorge («le hago a él y después te hago a vos»), pero su parte no está transcripta.'),
    'P1-0010': ('Sí', 'Completa', 'Marcelo', 'Por evidencia: Monterrico, 46 años, Paso de Jama', 'En la lista figura como Roberto.'),
    'P1-0011': ('No', '—', '', 'Lista oficial', ''),
    'P1-0012': ('Sí', 'Completa', 'Javier J / Javier Jiménez', 'Lista oficial',
                'En Entrevistas.docx está dos veces (idénticas) y en el listado figura dos veces.'),
    'P1-0013': ('Sí', 'Completa', 'Roman', 'Lista oficial', ''),
    'P1-0014': ('Sí', 'Pendiente', '(audio sin nombre)', 'Confirmado por Fabiola (09/10): 53 años, CP 4400 (Salta)',
                'Falta transcribir.'),
    'P1-0015': ('A confirmar', '—', '', 'Lista oficial', 'En rojo en el listado de audios; no está en la lista de grabaciones.'),
    'P1-0016': ('A confirmar', '—', '', 'Lista oficial', 'En rojo en el listado de audios; no está en la lista de grabaciones.'),
    'P1-0017': ('Sí', 'Completa', 'Héctor (chofer de colectivo)', 'Unificado por evidencia (antes P1-0101)', UNIFICAR['P1-0101'][1]),
    'P1-0018': ('Sí', 'Pendiente', 'José, chofer de camión (San Pedro)', 'Confirmado por Fabiola (09/10): 54 años, entrevistado en AXION',
                'Falta transcribir.'),
    'P1-0019': ('A confirmar', '—', '', 'Lista oficial',
                'En rojo en el listado («Andres (Paraguay)»); no está en la lista de grabaciones. No confundir con Andrés Burgos (P1-0029).'),
    'P1-0020': ('Sí', 'Pendiente', 'Elbio Dominguez-Garcia', 'Lista oficial',
                'La transcripción no está en Entrevistas.docx: en su lugar, la de Gualberto aparece dos veces.'),
    'P1-0021': ('Sí', 'Completa', 'Adrian Ovelar', 'Lista oficial', ''),
    'P1-0022': ('Sí', 'Completa', 'Gualberto Colman', 'Lista oficial', 'En Entrevistas.docx está dos veces (idénticas).'),
    'P1-0023': ('Sí', 'Completa', 'Gustavo Ayala', 'Lista oficial', ''),
    'P1-0024': ('No', '—', '', 'Lista oficial', ''),
    'P1-0025': ('Sí', 'Completa', 'Derlis M / Derlis Martinez', 'Por evidencia: paraguayo, AXION 31/03/2026, 26 años (código 27)',
                'En la lista figura como Daniel Martinez.'),
    'P1-0026': ('Sí', 'Completa', 'Cristian J', 'Lista oficial', ''),
    'P1-0027': ('Sí', 'Completa', 'Esteban S', 'Lista oficial', ''),
    'P1-0028': ('Sí', 'Completa', 'Cristian D', 'Lista oficial', ''),
    'P1-0029': ('Sí', 'Completa', 'Andres Burgos', 'Lista oficial', ''),
    'P1-0030': ('No', '—', '', 'Lista oficial', ''),
    'P1-0031': ('Sí', 'Completa', 'Emiliano (Chile)', 'Lista oficial', ''),
    'P1-0032': ('Sí', 'Completa', 'Cesar Gallo', 'Lista oficial', ''),
    'P1-0033': ('Sí', 'Completa', 'Peterson (Brasil)', 'Lista oficial', 'Entrevista en portugués.'),
    'P1-0034': ('Sí', 'Completa', 'Facundo', 'Lista oficial', ''),
    'P1-0035': ('No', '—', '', 'Lista oficial', ''),
    'P1-0036': ('No', '—', '', 'Lista oficial', ''),
    'P1-0103': ('Sí', 'Completa', 'Empleado de Lidia', 'Responde en el audio de Lidia R.',
                'No figura en la lista oficial: si se lo incorpora, asignarle N° de orden.'),
    'P1-0105': ('A confirmar', '—', 'Javier Martinez', 'Solo en el listado de audios',
                'Sin datos. Tiene el mismo número entre paréntesis (5) que Derlis Martinez: ¿es otro audio o el mismo?'),
}

# Comienzo del bloque de cada transcripción en Entrevistas.docx (para contar cuántas veces está).
ENCABEZADO = {
    'P1-0001': 'Entrevista Sebastian', 'P1-0002': '12 sep. 19.57 Don Godoy', 'P1-0004': 'Entrevista Santiago',
    'P1-0005': 'Entrevista Lidia R y su empleado', 'P1-0008': 'Entrevista Jorge-Completa', 'P1-0010': 'Entrevista 2 Marcelo',
    'P1-0012': 'Entrevistado Javier', 'P1-0013': 'Entrevista Roman-Axion', 'P1-0017': 'Hector',
    'P1-0021': 'Camionero Adrian', 'P1-0022': 'Gualberto colman-Axion (Paraguay)', 'P1-0023': 'Ubicación: Estación de servicio AXION',
    'P1-0025': 'Entrevista Derlis M', 'P1-0026': 'Cristian J - Argentino', 'P1-0027': 'Entrevista a: Esteban S',
    'P1-0028': 'Entrevista Cristian D-Axion', 'P1-0029': 'Andres', 'P1-0031': 'Emiliano- Chile', 'P1-0032': 'Cesar galló',
    'P1-0033': 'Peterson-Camionero Brasil', 'P1-0034': 'Facundo- Camionero', 'P1-0103': 'Entrevista Lidia R y su empleado',
}

# Listado de entrevistas (PDF «Listado de Entrevistas actualizado»): punto, nombre, N° entre paréntesis, rojo, IDs, situación, observación.
LISTADO = [
    ('San Pedro', 'Godoy', 7, False, ['P1-0002'], 'Correcto', 'Transcripción parcial: solo el cierre.'),
    ('San Pedro', 'Sebastian', 11, False, ['P1-0001'], 'Correcto', 'Fecha a confirmar (ver Pendientes).'),
    ('San Pedro', 'Roja Lidia', 6, False, ['P1-0005', 'P1-0103'], 'Correcto', 'Un audio, dos personas: Lidia y su empleado.'),
    ('San Pedro', 'Sin nombre', None, False, [], 'A confirmar',
     'Según Fabiola, el audio sin nombre es el de David López (P1-0014). Si fuera otro, el candidato es «Pito» (P1-0000).'),
    ('San Pedro', 'Santiago', None, False, ['P1-0004'], 'Unificado', 'Es la persona de orden 4 (antes P1-0102).'),
    ('AXION', 'Roman', 16, False, ['P1-0013'], 'Correcto', ''),
    ('AXION', 'Gustavo Ayala (Paraguay)', 7, False, ['P1-0023'], 'Correcto', ''),
    ('AXION', 'Hector (Chofer de Colectivo)', 6, False, ['P1-0017'], 'Unificado', 'Es Hector Salinas (antes P1-0101).'),
    ('AXION', 'Andres (Paraguay)', None, True, ['P1-0019'], 'A confirmar', '¿Hay audio? No está en la lista de grabaciones.'),
    ('AXION', 'Adrian Ovelar (Paraguay)', 10, False, ['P1-0021'], 'Correcto', ''),
    ('AXION', 'Elbio Dominguez-Garcia', 8, False, ['P1-0020'], 'Sin transcribir',
     'No está en Entrevistas.docx (Gualberto aparece dos veces en su lugar).'),
    ('AXION', 'Gualberto Colman (Paraguay)', 11, False, ['P1-0022'], 'Correcto', 'Duplicada en Entrevistas.docx.'),
    ('AXION', 'Derlis Martinez (Paraguay)', 5, False, ['P1-0025'], 'Correcto', 'En la lista oficial: Daniel Martinez.'),
    ('AXION', 'Cristian Diaz', 7, False, ['P1-0028'], 'Correcto', ''),
    ('AXION', 'Esteban Soria', 6, False, ['P1-0027'], 'Correcto', ''),
    ('AXION', 'Javier Martinez', 5, False, ['P1-0105'], 'A confirmar',
     'No está en la lista oficial ni transcripto. Mismo número (5) que Derlis Martinez.'),
    ('AXION', 'Cristian Jerez', 6, False, ['P1-0026'], 'Correcto', ''),
    ('AXION', 'Javier Gimenez', None, True, ['P1-0012'], 'Correcto', 'Duplicada en Entrevistas.docx.'),
    ('AXION', 'David Lopez', None, False, ['P1-0014'], 'Sin transcribir', 'Audio sin nombre (confirmado por Fabiola).'),
    ('AXION', 'Adrian Marsical', None, True, ['P1-0015'], 'A confirmar', '¿Hay audio? No está en la lista de grabaciones.'),
    ('AXION', 'Martin Villarubia', None, True, ['P1-0016'], 'A confirmar', '¿Hay audio? No está en la lista de grabaciones.'),
    ('AXION', 'Hector Salinas', None, True, ['P1-0017'], 'Repetido', 'Misma persona que «Hector (Chofer de Colectivo)».'),
    ('AXION', 'Josè Valdes', None, True, ['P1-0018'], 'Sin transcribir', '«José, chofer de camión, San Pedro» (confirmado por Fabiola).'),
    ('AXION', 'Javier Gimenez (PAraguay)', None, True, ['P1-0012'], 'Repetido', 'Misma persona que «Javier Gimenez».'),
    ('Paso de Jama', 'Jorge y Lautaro', 16, False, ['P1-0008', 'P1-0009'], 'Correcto',
     'Un audio, dos personas: solo está transcripta la parte de Jorge.'),
    ('Paso de Jama', 'Marcelo', 8, False, ['P1-0010'], 'Correcto', 'En la lista oficial: Roberto.'),
    ('Paso de Jama', 'Facundo', 8, False, ['P1-0034'], 'Correcto', ''),
    ('Paso de Jama', 'Emiliano (Chile)', 10, False, ['P1-0031'], 'Correcto', ''),
    ('Paso de Jama', 'César Gallo', 14, False, ['P1-0032'], 'Correcto', ''),
    ('Paso de Jama', 'Peterson (Brasil)', None, False, ['P1-0033'], 'Correcto', ''),
    ('Paso de Jama', 'Andres Burgos', 6, False, ['P1-0029'], 'Correcto', ''),
]

# Observaciones de la hoja Participantes que reemplazan a las de la versión anterior.
OBS = {
    'P1-0001': 'Fecha a confirmar: la lista dice 12/09/2025 (la jornada de San Pedro, igual que el audio de Godoy, «12 sep»); '
               'el archivo dice 12.08.25 y también se mencionaron el 10/08 y el 29/09.',
    'P1-0002': 'Framingham en la encuesta biológica: «14 MODERADO» (no queda claro si el número es puntaje o %).',
    'P1-0004': 'FINDRISK registrado «00 BAJO»: no es posible con 71 años (la edad sola suma 4 puntos); revisar el papel. '
               'Framingham «01 BAJO» (no queda claro si es puntaje o %). La columna EDAD de la lista dice 65; el código y el audio, 71.',
    'P1-0005': 'Edad: el código dice 53 y la encuesta biológica 30 (se usó 53). Encuesta biológica: «MUJER / SIN ENCUESTA BIOLÓGICA».',
    'P1-0009': 'Edad: el código dice 24 y la columna EDAD de la lista 44 (se usó 24).',
    'P1-0010': 'En la lista figura como Roberto; en el audio se presenta como Marcelo (Monterrico, 46 años).',
    'P1-0013': 'Fecha de la lista: 20/03/2025, anterior a la primera entrevista (30/08/2025). ¿Es 20/03/2026? Confirmar.',
    'P1-0014': 'Educación: primaria incompleta (no es una opción del cuestionario actual). La columna EDAD de la lista dice 51; '
               'el código y Fabiola, 53.',
    'P1-0017': 'Chofer de colectivo, jubilado (en la encuesta: relación laboral «Otro: Jubilado»). La columna EDAD de la lista '
               'dice 65; el código y el audio, 70.',
    'P1-0022': CORREGIR_FECHA['P1-0022'][1],
    'P1-0025': 'En la lista figura como Daniel Martinez; en el audio, «Derlis M» (26 años; el código dice 27).',
    'P1-0103': 'No figura en la lista oficial; responde en la entrevista de Lidia R. (su empleadora).',
    'P1-0105': 'Sin datos: solo figura en el listado de audios.',
}

CAMBIOS = [
    'Héctor (chofer de colectivo), que era el extra P1-0101, se unificó con Hector Salinas (P1-0017).',
    'Santiago, que era el extra P1-0102, se unificó con la persona de orden 4 (P1-0004).',
    'Se quitó el extra P1-0104 («Sin nombre»): era un audio, no una persona nueva.',
    'Fecha de Gualberto (P1-0022) corregida de 30/09/2026 a 30/03/2026 (a confirmar).',
    'Nuevas columnas en Participantes: Nombre en el audio, Audio, Transcripción y Cómo se identificó.',
    'Nueva hoja «Entrevistas grabadas»: cada renglón del listado de audios con su ID y su situación.',
    'Datos: 38 filas (antes 40). Al unificar se completaron los vacíos con la transcripción; donde las fuentes difieren '
    'quedó la encuesta y la diferencia figura en «Próxima entrevista».',
]

# Pendientes para confirmar con el equipo: tema, IDs, qué encontramos, qué hay que hacer.
PENDIENTES = [
    ('Transcripción de Elbio', 'P1-0020',
     'No está en Entrevistas.docx. La de Gualberto aparece dos veces idéntica: probablemente se pegó dos veces en lugar de la de Elbio.',
     'Pasar la transcripción de Elbio.'),
    ('Audios sin transcribir', 'P1-0014, P1-0018, P1-0009',
     'David López (audio sin nombre), José Valdez y la parte de Lautaro en el audio de Jorge.',
     'Transcribir; con eso se completa lo que falta de cada uno.'),
    ('Godoy incompleto', 'P1-0002', 'Del audio de Godoy solo está transcripto el cierre (la devolución de resultados).',
     'Transcribir el resto del audio.'),
    ('«Sin nombre» de San Pedro', 'P1-0014 / P1-0000',
     'Fabiola indicó que el audio sin nombre es el de David López, pero el listado pone «Sin nombre» en San Pedro y a «David Lopez» en AXION.',
     'Confirmar si es el mismo audio. Si no, ¿es «Pito» (orden 0), que en la lista figura con entrevista?'),
    ('Javier Martinez', 'P1-0105',
     'Está en el listado de audios con (5), igual que Derlis Martinez; no está en la lista oficial ni transcripto.',
     '¿Es otra persona o el mismo audio de Derlis? Si es el mismo, se elimina.'),
    ('¿Tienen audio?', 'P1-0015, P1-0016, P1-0019',
     'Adrián Mariscal, Martín Villarubia y Andrés (Paraguay) están en rojo en el listado y no en la lista de grabaciones.',
     'Confirmar si hay audio. ¿Qué significa el rojo y qué cuentan los números entre paréntesis?'),
    ('Unificaciones', 'P1-0017, P1-0004', 'Héctor = Hector Salinas y Santiago = orden 4, por la evidencia de la hoja Participantes.',
     'Confirmar. Si alguna no corresponde, se separa de nuevo.'),
    ('Vínculos por evidencia', 'P1-0002, P1-0005, P1-0010, P1-0025',
     'Godoy = orden 2, Lidia = orden 5, Marcelo = Roberto (orden 10), Derlis = Daniel Martinez (orden 25).',
     'Confirmar con quienes hicieron esas entrevistas.'),
    ('Fechas', 'P1-0022, P1-0013, P1-0001, P1-0012',
     'Gualberto: 30/09/2026 en la lista (corregida a 30/03/2026). Román: 20/03/2025, antes del inicio. Sebastián: lista 12/09/2025, '
     'archivo 12.08.25, también se dijo 10/08 y 29/09. Javier: lista 26/09/2025, transcripción 27/09/2025.',
     'Confirmar las fechas reales. Las fechas del encabezado de TurboScribe son de la transcripción, no de la entrevista.'),
    ('Columna EDAD de la lista oficial', 'P1-0004, P1-0009, P1-0014, P1-0017',
     'Difiere del código en 4 personas. En las 3 que se pueden verificar (Santiago 71, David López 53, Héctor 70) el código es el correcto.',
     'Corregir la columna EDAD. Lautaro: código 24, lista 44.'),
    ('Edad de Lidia', 'P1-0005', 'El código dice 53 y la encuesta biológica 30.', 'Confirmar.'),
    ('FINDRISK de orden 4', 'P1-0004', '«00 BAJO» no es posible con 71 años: la edad sola suma 4 puntos.',
     'Revisar la planilla en papel.'),
    ('FINDRISK en personas con diabetes', 'P1-0008, P1-0022',
     'Tienen diabetes diagnosticada y FINDRISK cargado; FINDRISK estima el riesgo de llegar a tener diabetes.',
     'Decidir si se informa o se deja vacío.'),
    ('Consentimiento', 'Varios', 'Solo 12 de las 37 personas de la lista tienen consentimiento «SI».',
     'Confirmar si los demás firmaron en papel.'),
    ('Empleado de Lidia', 'P1-0103', 'Responde en el audio de Lidia, pero no está en la lista oficial.',
     'Decidir si se lo incorpora con N° de orden.'),
    ('Columna ENTREVISTA de la lista oficial', '—',
     'Marca «SI» solo en 7 personas, pero hay audio de 26.', 'Actualizarla con la hoja «Entrevistas grabadas».'),
]

# Control de completitud (las 39 preguntas y los datos biológicos que usan FINDRISK, Framingham y glucometría)
PRINCIPALES_SOCIO = [c['id'] for c in COLS if c['seccion'] not in ('Identificación', 'Biológica', 'Calculados')
                     and 'Especificar' not in c['texto'] and '(si responde' not in c['texto'] and c['id'] != 'p32_cuales_med']
BIO_CONTROL = ['b_sexo', 'b_peso_kg', 'b_altura_m', 'b_perimetro_cm', 'b_pas_mmhg', 'b_dbt_dx', 'b_hta_dx', 'b_med_antihta',
               'b_glucosa_previa', 'b_antec_fam_dbt', 'b_act_fisica', 'b_fyv_diario', 'b_fuma', 'g_resultado_mgdl']
CONTROL = ['edad'] + PRINCIPALES_SOCIO + BIO_CONTROL


def corto(cid):
    """Rótulo corto: 'p12_frec_jujuy' → 'P12 Jujuy'."""
    if cid == 'edad':
        return 'Edad'
    if cid.startswith('p'):
        extra = {'p06_idiomas_entiende': 'entiende', 'p07_idiomas_habla': 'habla', 'p12_frec_corredor': 'corredor',
                 'p12_frec_jujuy': 'Jujuy', 'p01_nac_pais': 'nacimiento'}.get(cid, '')
        return f'P{cid[1:3]}' + (f' {extra}' if extra else '')
    return {'b_sexo': 'Sexo', 'b_peso_kg': 'Peso', 'b_altura_m': 'Altura', 'b_perimetro_cm': 'Perímetro',
            'b_pas_mmhg': 'PAS', 'b_dbt_dx': 'Dx DBT', 'b_hta_dx': 'Dx HTA', 'b_med_antihta': 'Med. HTA',
            'b_glucosa_previa': 'Glucosa alta previa', 'b_antec_fam_dbt': 'Antec. fam. DBT', 'b_act_fisica': 'Act. física 30 min',
            'b_fyv_diario': 'Fruta/verdura diaria', 'b_fuma': 'Fuma', 'g_resultado_mgdl': 'Glucemia'}.get(cid, cid)


def rotulo(cid):
    return corto(cid) if cid in CONTROL else (f'P{cid[1:3]}' if cid.startswith('p') else corto(cid))


def vacio(v):
    return v is None or v == ''


def texto_valor(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v)


def fecha_txt(iso):
    return '' if not iso else datetime.date.fromisoformat(iso).strftime('%d/%m/%Y')


# ---------------------------------------------------------------------------
# Lectura de la versión anterior
# ---------------------------------------------------------------------------
def leer_v1():
    wb = openpyxl.load_workbook(V1)
    d = wb['Datos']
    hdr = [c.value for c in d[1]]
    filas = []
    for r in d.iter_rows(min_row=2, values_only=True):
        if not r[1]:
            continue
        f = {}
        for h, v in zip(hdr, r):
            if v is None:
                v = ''
            if isinstance(v, datetime.datetime):
                v = v.date().isoformat()
            f[h] = v
        filas.append(f)
    con = wb['Contactos']
    hc = [c.value for c in con[1]]
    contactos = {r[1]: dict(zip(hc, r)) for r in con.iter_rows(min_row=2, values_only=True) if r[1]}
    evidencia = [list(r) for r in wb['Evidencia'].iter_rows(min_row=2, values_only=True) if r[0]]
    salud = [list(r) for r in wb['Salud y temas'].iter_rows(min_row=2, values_only=True) if r[0]]
    proxima = {r[0]: {'confirmar': r[5] or '', 'notas': r[6] or ''}
               for r in wb['Próxima entrevista'].iter_rows(min_row=5, values_only=True) if r[0]}
    par = {}
    for r in wb['Participantes'].iter_rows(min_row=5, max_row=60, values_only=True):
        if not r[0] or not str(r[0]).startswith('P1-'):
            continue
        par[r[0]] = {'orden': r[1], 'codigo': r[2] or '', 'nombre': r[3] or '', 'punto': r[4] or '', 'fecha': r[5] or '',
                     'encuestador': r[6] or '', 'procedencia': r[7] or '', 'bio': r[8] or 'No', 'socio': r[9] or 'No',
                     'entrevista_lista': r[10] or '', 'consentimiento': r[11] or '', 'obs': r[19] or ''}
    return filas, contactos, evidencia, salud, proxima, par


def separar_confirmar(texto):
    """'P01, P02, Distinto entre fuentes → A | B' → (['P01', 'P02'], ['A', 'B'])."""
    if not texto:
        return [], []
    partes = texto.split('Distinto entre fuentes → ')
    simples = [x.strip() for x in partes[0].split(',') if x.strip()]
    difs = [x.strip() for x in partes[1].split(' | ')] if len(partes) > 1 else []
    return simples, difs


# ---------------------------------------------------------------------------
# Depuración
# ---------------------------------------------------------------------------
def unir(oficial, extra):
    """Completa los vacíos de la fila oficial con la transcripción; devuelve (fila, usados, diferencias)."""
    f = dict(oficial)
    usados, difs = set(), []
    for k, vb in extra.items():
        if k in META or k in CALCULADAS or vacio(vb):
            continue
        va = oficial.get(k, '')
        if vacio(va):
            f[k] = vb
            usados.add(k)
            continue
        if texto_valor(va) == texto_valor(vb) or k in TEXTO_LIBRE:
            continue
        if TIPO.get(k) == 'multiple' or ';' in str(va):
            a = {x.strip() for x in str(va).split(';')}
            b = {x.strip() for x in str(vb).split(';')}
            if b <= a:
                continue
        difs.append(f'{rotulo(k)}: la encuesta dice «{texto_valor(va)}», la transcripción «{texto_valor(vb)}»')
    return f, usados, difs


def recalcular(filas):
    with tempfile.TemporaryDirectory() as tmp:
        ent, sal = os.path.join(tmp, 'e.json'), os.path.join(tmp, 's.json')
        json.dump(filas, open(ent, 'w', encoding='utf-8'), ensure_ascii=False)
        subprocess.run(['node', os.path.join(AQUI, 'recalcular.js'), ent, sal], check=True)
        nuevas = json.load(open(sal, encoding='utf-8'))
    salida = []
    for vieja, nueva in zip(filas, nuevas):
        f = dict(nueva)
        for k in CALCULADAS:
            # Riesgos registrados en la lista: se conservan si no hay datos crudos para recalcularlos.
            if vacio(f.get(k, '')) and not vacio(vieja.get(k, '')):
                f[k] = vieja[k]
        f['imc_mayor25'] = vieja.get('imc_mayor25', '')
        salida.append(f)
    return salida


def depurar():
    filas, contactos, evidencia, salud, proxima, par = leer_v1()
    por_id = {f['participante_id']: f for f in filas}
    difs_nuevas = {}
    usados_por = {}
    for extra, (destino, _) in UNIFICAR.items():
        fila, usados, difs = unir(por_id[destino], por_id[extra])
        fila['modificado'] = '2026-10-09T20:00:00.000Z'
        por_id[destino] = fila
        difs_nuevas[destino] = difs
        usados_por[extra] = (destino, usados)
        del por_id[extra]
    for pid in QUITAR:
        por_id.pop(pid, None)
    for pid, (iso, _) in CORREGIR_FECHA.items():
        por_id[pid]['fecha'] = iso
        if pid in contactos:
            contactos[pid]['fecha'] = iso
    orden = sorted(por_id)
    filas = recalcular([por_id[p] for p in orden])

    # Evidencia: las citas de la transcripción unificada pasan al ID de la lista solo si ese dato se usó.
    ev = []
    for fila in evidencia:
        pid, var = fila[0], fila[2]
        if pid in QUITAR:
            continue
        if pid in usados_por:
            destino, usados = usados_por[pid]
            if var not in usados:
                continue
            fila = [destino, nombre_visible(destino, par)] + fila[2:]
        else:
            fila = [pid, nombre_visible(pid, par)] + fila[2:]
        ev.append(fila)
    rango = {p: i for i, p in enumerate(orden + list(UNIFICAR) + list(QUITAR))}
    ev.sort(key=lambda x: (rango.get(x[0], 999)))

    sal = []
    for fila in salud:
        pid = fila[0]
        if pid in QUITAR:
            continue
        pid = UNIFICAR.get(pid, (pid,))[0]
        sal.append([pid, nombre_visible(pid, par)] + fila[2:])
    sal.sort(key=lambda x: rango.get(x[0], 999))

    # Próxima entrevista: lo que hay que confirmar y las notas de la extracción
    conf, notas = {}, {}
    for pid in orden + ['P1-0105']:
        simples, difs = separar_confirmar(proxima.get(pid, {}).get('confirmar', ''))
        nota = proxima.get(pid, {}).get('notas', '')
        for extra, (destino, motivo) in UNIFICAR.items():
            if destino != pid:
                continue
            s2, _ = separar_confirmar(proxima.get(extra, {}).get('confirmar', ''))
            usados = usados_por[extra][1]
            simples += [x for x in s2 if x not in simples and any(rotulo(u) == x for u in usados)]
            difs += difs_nuevas[pid]
            nota_extra = proxima.get(extra, {}).get('notas', '')
            nota_extra = nota_extra[nota_extra.find('Transcripción:'):] if 'Transcripción:' in nota_extra else nota_extra
            nota = ' '.join(x for x in [nota, f'Unificado con la entrevista de la transcripción (antes {extra}). {nota_extra}'] if x)
        if pid in ('P1-0004', 'P1-0014', 'P1-0017'):
            difs = [d for d in difs if not d.startswith('Edad:')]
        if pid in CORREGIR_FECHA:
            difs = [d for d in difs if not d.startswith('Fecha:')] + [CORREGIR_FECHA[pid][1]]
        for viejo in ('Transcripción «Don Godoy»: vinculada por edad (64), FINDRISK alto y entrevistadora Lidia. ',
                      'Transcripción «Lidia R»: vinculada por ser mujer, dueña de camiones, terciario (docente) y 14 años en el transporte. '):
            nota = nota.replace(viejo, '')
        difs = [re.sub(r'«(\d+)\.0»', r'«\1»', d) for d in difs]
        if pid == 'P1-0105':
            nota = AUDIO[pid][4]
        conf[pid] = ', '.join(simples) + (('' if not simples else ', ') + 'Distinto entre fuentes → ' + ' | '.join(difs) if difs else '')
        notas[pid] = nota.strip()
    return filas, contactos, ev, sal, conf, notas, par, orden


def nombre_visible(pid, par):
    if pid in NOMBRE_VISIBLE:
        return NOMBRE_VISIBLE[pid]
    n = par.get(pid, {}).get('nombre', '')
    return n or '(sin nombre)'


def nombre_lista(pid, par):
    if pid in ('P1-0103', 'P1-0105'):
        return '— (no está en la lista)'
    n = par.get(pid, {}).get('nombre', '')
    return '(sin nombre)' if not n or n.startswith('(sin nombre') else n


def contar_bloques():
    """Cuántas veces aparece cada transcripción en Entrevistas.docx (si el archivo está)."""
    if not os.path.exists(DOCX):
        return {}
    import unicodedata
    from docx import Document
    pars = [unicodedata.normalize('NFC', p.text.strip()) for p in Document(DOCX).paragraphs]
    veces = {}
    for pid, enc in ENCABEZADO.items():
        enc = unicodedata.normalize('NFC', enc)
        if enc == 'Hector':
            n = sum(1 for t in pars if t == 'Hector')
        elif enc == 'Andres':
            n = sum(1 for t in pars if t == 'Andres')
        elif enc == 'Gualberto colman-Axion (Paraguay)':
            n = sum(1 for t in pars if t == enc) // 2  # el título se repite dos veces en cada bloque
        else:
            n = sum(1 for t in pars if t.startswith(enc))
        veces[pid] = n
    return veces


# ---------------------------------------------------------------------------
# Planilla
# ---------------------------------------------------------------------------
def construir():
    filas, contactos, ev, sal, conf, notas, par, orden = depurar()
    participantes = orden + ['P1-0105']
    veces = contar_bloques()
    con_datos = {f['participante_id'] for f in filas}
    n_lista = sum(1 for p in orden if p <= 'P1-0036')
    n_fuera = len(orden) - n_lista

    filas_gp = []
    for f in filas:
        g = dict(f)
        g['fecha'] = f['fecha'] or ''
        filas_gp.append(g)
    wb = GP.construir(filas_gp, aviso=f'Registro previo: {n_lista} conductores de la lista oficial (planilla 2026_CAMIONEROS) '
                                      f'y {n_fuera} entrevistado fuera de la lista (el empleado de Lidia R.). Encuestas, resultados de '
                                      'riesgo y entrevistas unidos por persona; cada tabla cuenta solo a quienes tienen el dato.')
    # GP no carga fechas vacías ni la columna imc_mayor25
    dat = wb['Datos']
    col = len(COLS) + 1
    c = dat.cell(row=1, column=col, value='imc_mayor25')
    c.font = GP.f_enc; c.fill = GP.relleno_enc
    c.comment = Comment('IMC mayor a 25 según la lista oficial (Sí/No), para quienes no tienen peso y altura.', 'Instrumento')
    dat.column_dimensions[get_column_letter(col)].width = 14
    for r, f in enumerate(filas, start=2):
        if f.get('imc_mayor25'):
            dat.cell(row=r, column=col, value=f['imc_mayor25']).font = GP.f_base
    dic = wb['Diccionario']
    rd = len(COLS) + 2
    dic.insert_rows(rd)
    for i, v in enumerate(['imc_mayor25', 'IMC mayor a 25 (registrado en la lista oficial)', 'Calculados', 'Sí; No', ''], start=1):
        dic.cell(row=rd, column=i, value=v).font = GP.f_base

    con = wb['Contactos']
    hc = [c.value for c in con[1]]
    for r, pid in enumerate(orden, start=2):
        fila = contactos.get(pid, {'id': 'previo-' + pid, 'participante_id': pid})
        for i, h in enumerate(hc, start=1):
            v = fila.get(h)
            if v not in (None, ''):
                con.cell(row=r, column=i, value=v).font = GP.f_base

    f_base, f_neg, f_enc, f_sub, f_tit = GP.f_base, GP.f_neg, GP.f_enc, GP.f_sub, GP.f_titulo
    relleno_enc = GP.relleno_enc
    borde = Border(bottom=Side(style='thin', color='D9D4C7'))
    verde = PatternFill('solid', fgColor='DCEBDD')
    rojo = PatternFill('solid', fgColor='F6DCD3')
    amarillo = PatternFill('solid', fgColor='FFF2C2')
    gris = PatternFill('solid', fgColor='EEEEEE')
    negrita = Font(name=GP.F, size=10, bold=True)
    datos_por_pid = {f['participante_id']: f for f in filas}
    pid_rng = f'Datos!${LETRA["participante_id"]}$2:${LETRA["participante_id"]}${GP.ULTIMA}'

    def encabezar(hoja, fila, textos, alto=None):
        for i, t in enumerate(textos, start=1):
            c = hoja.cell(row=fila, column=i, value=t)
            c.font = f_enc; c.fill = relleno_enc
            c.alignment = Alignment(wrap_text=True, vertical='center')
        if alto:
            hoja.row_dimensions[fila].height = alto

    # ---------------- Participantes ----------------
    pa = wb.create_sheet('Participantes', 1)
    pa.sheet_properties.tabColor = '9A3412'
    pa['A1'] = 'Participantes · lista oficial, audios y transcripciones'; pa['A1'].font = f_tit
    pa['A2'] = ('Hoja privada: tiene nombres. Una fila por persona. El ID (P1- y el N° de orden) es el identificador interno '
                'del registro previo. Las columnas de avance se actualizan solas con lo que llegue a «Datos».')
    pa['A2'].font = f_sub
    enc = ['ID participante', 'N° orden', 'Código', 'Nombre (lista oficial)', 'Nombre en el audio', 'Punto', 'Fecha',
           'Encuestador/es', 'Procedencia', 'Biológica', 'Socio', 'Audio', 'Transcripción', 'Consentimiento',
           'Cómo se identificó', 'Preguntas y mediciones con dato', f'de {len(CONTROL)}', '% completo', 'Visitas cargadas',
           'FINDRISK', 'Framingham', 'Detalle del audio', 'Observaciones']
    fe = 4
    encabezar(pa, fe, enc, 44)
    for r, pid in enumerate(participantes, start=fe + 1):
        p = par.get(pid, {})
        audio, transc, nom_audio, vinculo, detalle = AUDIO[pid]
        f = datos_por_pid.get(pid, {})
        fecha = fecha_txt(f.get('fecha')) if f.get('fecha') else (p.get('fecha') or '')
        fila_comp = r - 1
        vals = [pid, p.get('orden', ''), p.get('codigo', ''), nombre_lista(pid, par), nom_audio, p.get('punto', '') or f.get('puesto', ''),
                fecha, p.get('encuestador', ''), p.get('procedencia', ''), p.get('bio', 'No') or 'No', p.get('socio', 'No') or 'No',
                audio, transc, p.get('consentimiento', '') or 'No', vinculo,
                f'=Completitud!D{fila_comp}', len(CONTROL), f'=P{r}/Q{r}',
                f'=COUNTIF({pid_rng},A{r})',
                f'=IFERROR(INDEX(Datos!${LETRA["fr_categoria"]}$2:${LETRA["fr_categoria"]}${GP.ULTIMA},MATCH(A{r},{pid_rng},0))&"","")',
                f'=IFERROR(INDEX(Datos!${LETRA["fh_categoria"]}$2:${LETRA["fh_categoria"]}${GP.ULTIMA},MATCH(A{r},{pid_rng},0))&"","")',
                detalle, OBS.get(pid, p.get('obs', ''))]
        if pid == 'P1-0105':
            vals[5] = 'AXION'
        for i, v in enumerate(vals, start=1):
            c = pa.cell(row=r, column=i, value=v)
            c.font = f_base; c.border = borde
            c.alignment = Alignment(vertical='top', wrap_text=i in (4, 5, 9, 15, 22, 23))
        pa.cell(row=r, column=1).font = negrita
        pa.cell(row=r, column=18).number_format = '0%'
        if pid not in con_datos:
            for i in range(1, len(enc) + 1):
                pa.cell(row=r, column=i).fill = gris
    fin = fe + len(participantes)
    rng = lambda L: f'{L}{fe + 1}:{L}{fin}'  # noqa: E731
    pa.conditional_formatting.add(rng('R'), CellIsRule(operator='lessThan', formula=['0.34'], fill=rojo))
    pa.conditional_formatting.add(rng('R'), CellIsRule(operator='greaterThanOrEqual', formula=['0.67'], fill=verde))
    pa.conditional_formatting.add(rng('L'), CellIsRule(operator='equal', formula=['"Sí"'], fill=verde))
    pa.conditional_formatting.add(rng('L'), CellIsRule(operator='equal', formula=['"A confirmar"'], fill=amarillo))
    pa.conditional_formatting.add(rng('M'), CellIsRule(operator='equal', formula=['"Pendiente"'], fill=rojo))
    pa.conditional_formatting.add(rng('M'), CellIsRule(operator='equal', formula=['"Parcial"'], fill=amarillo))
    anchos = (12, 7, 14, 20, 22, 12, 11, 18, 22, 9, 8, 11, 12, 11, 30, 11, 5, 9, 8, 13, 12, 46, 52)
    for i, w in enumerate(anchos, start=1):
        pa.column_dimensions[get_column_letter(i)].width = w
    pa.freeze_panes = f'B{fe + 1}'
    pa.auto_filter.ref = f'A{fe}:{get_column_letter(len(enc))}{fin}'

    rr = fin + 2
    pa.cell(row=rr, column=1, value='Resumen por punto (personas con datos)').font = GP.f_bloque
    rr += 1
    res_enc = ['Punto', 'Personas', 'Con audio', 'Con transcripción', 'Audio sin transcribir', 'Audio a confirmar',
               'Con encuesta socio', 'Con biológica', 'Con consentimiento', 'Promedio % completo']
    encabezar(pa, rr, res_enc, 32)
    rr += 1
    ini_res = rr
    F, S, L, M, K, J, N, R = (rng(x) for x in 'FSLMKJNR')
    for punto in ('San Pedro', 'AXION', 'Paso de Jama'):
        vals = [punto, f'=COUNTIFS({F},A{rr},{S},">0")', f'=COUNTIFS({F},A{rr},{L},"Sí")',
                f'=COUNTIFS({F},A{rr},{M},"Completa")+COUNTIFS({F},A{rr},{M},"Parcial")',
                f'=COUNTIFS({F},A{rr},{M},"Pendiente")', f'=COUNTIFS({F},A{rr},{L},"A confirmar")',
                f'=COUNTIFS({F},A{rr},{K},"Sí")', f'=COUNTIFS({F},A{rr},{J},"Sí")', f'=COUNTIFS({F},A{rr},{N},"Sí")',
                f'=IFERROR(AVERAGEIFS({R},{F},A{rr},{S},">0"),"")']
        for i, v in enumerate(vals, start=1):
            c = pa.cell(row=rr, column=i, value=v); c.font = f_base; c.border = borde
        pa.cell(row=rr, column=10).number_format = '0%'
        rr += 1
    pa.cell(row=rr, column=1, value='Total').font = negrita
    for i in range(2, 10):
        Lt = get_column_letter(i)
        c = pa.cell(row=rr, column=i, value=f'=SUM({Lt}{ini_res}:{Lt}{rr - 1})'); c.font = negrita; c.fill = GP.relleno_total
    c = pa.cell(row=rr, column=10, value=f'=IFERROR(AVERAGEIFS({R},{S},">0"),"")'); c.font = negrita; c.number_format = '0%'
    c.fill = GP.relleno_total
    pa.cell(row=rr, column=1).fill = GP.relleno_total
    fila_total = rr
    rr += 2
    nota = pa.cell(row=rr, column=1, value=(
        'Personas = filas con datos en «Datos». Con transcripción incluye la parcial de Godoy y la del empleado de Lidia (dentro de la de Lidia). '
        'En gris, quien figura solo en el listado de audios y todavía no tiene datos.'))
    nota.font = f_sub

    # ---------------- Entrevistas grabadas ----------------
    eg = wb.create_sheet('Entrevistas grabadas', 2)
    eg.sheet_properties.tabColor = '7A4E9A'
    eg['A1'] = 'Entrevistas grabadas · listado de audios cruzado con la lista oficial'; eg['A1'].font = f_tit
    eg['A2'] = ('Cada renglón del «Listado de Entrevistas actualizado» (PDF), en el mismo orden, con el ID de la persona. '
                f'Corte: {HOY}. Los números entre paréntesis y el rojo se copian tal cual: el listado no dice qué significan.')
    eg['A2'].font = f_sub
    resumen = [
        ('Renglones del listado', f'=COUNTA(B11:B{10 + len(LISTADO)})'),
        ('Personas distintas con audio', f'=Participantes!C{fila_total}'),
        ('   con transcripción', f'=Participantes!D{fila_total}'),
        ('   sin transcribir', f'=Participantes!E{fila_total}'),
        ('A confirmar si hay audio', f'=COUNTIF(Participantes!{L},"A confirmar")'),
    ]
    for i, (t, v) in enumerate(resumen, start=4):
        eg.cell(row=i, column=1, value=t).font = f_base if t.startswith('   ') else negrita
        c = eg.cell(row=i, column=3, value=v); c.font = negrita; c.alignment = Alignment(horizontal='left')
    enc = ['Punto', 'Nombre en el listado', 'N° entre paréntesis', 'En rojo', 'ID', 'Nombre en la lista oficial', 'Audio',
           'Transcripción', 'Veces en Entrevistas.docx', 'Situación', 'Observación']
    encabezar(eg, 10, enc, 44)
    for r, (punto, nombre, n, rojo_, ids, situacion, obs) in enumerate(LISTADO, start=11):
        vals = [punto, nombre, n, 'Sí' if rojo_ else '', ', '.join(ids) or '—',
                ' / '.join(nombre_lista(i, par) for i in ids) or '—',
                ' / '.join(AUDIO[i][0] for i in ids) or 'Sí',
                ' / '.join(AUDIO[i][1] for i in ids) or '—',
                ' / '.join(str(veces.get(i, 0)) for i in ids if i in ENCABEZADO) or ('0' if ids else '—'),
                situacion, obs]
        for i, v in enumerate(vals, start=1):
            c = eg.cell(row=r, column=i, value=v); c.font = f_base; c.border = borde
            c.alignment = Alignment(vertical='top', wrap_text=i in (2, 6, 11))
        if rojo_:
            eg.cell(row=r, column=2).font = Font(name=GP.F, size=10, color='B42318', bold=True)
    fin_eg = 10 + len(LISTADO)
    for sit, relleno in (('A confirmar', amarillo), ('Sin transcribir', rojo), ('Repetido', gris), ('Unificado', verde)):
        eg.conditional_formatting.add(f'J11:J{fin_eg}', CellIsRule(operator='equal', formula=[f'"{sit}"'], fill=relleno))
    for i, w in enumerate((12, 26, 10, 7, 18, 26, 12, 13, 11, 14, 60), start=1):
        eg.column_dimensions[get_column_letter(i)].width = w
    eg.freeze_panes = 'C11'
    eg.auto_filter.ref = f'A10:K{fin_eg}'

    # ---------------- Pendientes ----------------
    pe = wb.create_sheet('Pendientes', 3)
    pe.sheet_properties.tabColor = 'B42318'
    pe['A1'] = 'Pendientes para confirmar con el equipo'; pe['A1'].font = f_tit
    pe['A2'] = f'Corte: {HOY}. Cuando se resuelva cada punto, se corrige en el script y se vuelve a generar la planilla.'
    pe['A2'].font = f_sub
    pe['A4'] = 'Cambios respecto de la versión anterior (09/10, mañana)'; pe['A4'].font = GP.f_bloque
    r = 5
    for t in CAMBIOS:
        c = pe.cell(row=r, column=1, value='• ' + t); c.font = f_base
        pe.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
        c.alignment = Alignment(wrap_text=True, vertical='top')
        pe.row_dimensions[r].height = 28 if len(t) > 120 else 16
        r += 1
    r += 1
    pe.cell(row=r, column=1, value='Para confirmar').font = GP.f_bloque
    r += 1
    encabezar(pe, r, ['N°', 'Tema', 'ID', 'Qué encontramos', 'Qué hay que hacer', 'Estado'], 20)
    ini_p = r + 1
    for n, (tema, ids, hallazgo, accion) in enumerate(PENDIENTES, start=1):
        r += 1
        for i, v in enumerate([n, tema, ids, hallazgo, accion, 'Pendiente'], start=1):
            c = pe.cell(row=r, column=i, value=v); c.font = f_base; c.border = borde
            c.alignment = Alignment(wrap_text=True, vertical='top')
        pe.cell(row=r, column=2).font = negrita
    pe.conditional_formatting.add(f'F{ini_p}:F{r}', CellIsRule(operator='equal', formula=['"Pendiente"'], fill=amarillo))
    pe.conditional_formatting.add(f'F{ini_p}:F{r}', CellIsRule(operator='equal', formula=['"Resuelto"'], fill=verde))
    for i, w in enumerate((5, 24, 18, 60, 46, 11), start=1):
        pe.column_dimensions[get_column_letter(i)].width = w

    # ---------------- Completitud (dinámica) ----------------
    com = wb.create_sheet('Completitud', 4)
    com.sheet_properties.tabColor = '1F6F4A'
    com['A1'] = 'Qué falta de cada participante'; com['A1'].font = f_tit
    com['A2'] = ('✓ = ya hay dato en «Datos» para ese ID (de cualquier visita). Vacío = preguntar o medir en la próxima entrevista. '
                 'Se actualiza solo cuando sincronizan las entrevistas nuevas con el mismo ID.')
    com['A2'].font = f_sub
    for i, t in enumerate(['ID', 'Punto', 'Nombre', 'Con dato'], start=1):
        c = com.cell(row=3, column=i, value=t); c.font = f_enc; c.fill = relleno_enc
    for j, cid in enumerate(CONTROL, start=5):
        c = com.cell(row=3, column=j, value=corto(cid)); c.font = f_enc; c.fill = relleno_enc
        c.alignment = Alignment(text_rotation=90, horizontal='center', vertical='bottom')
        c.comment = Comment(TEXTO[cid], 'Instrumento')
        com.column_dimensions[get_column_letter(j)].width = 3.6
    com.row_dimensions[3].height = 120
    primera, ultima = get_column_letter(5), get_column_letter(4 + len(CONTROL))
    for r, pid in enumerate(participantes, start=4):
        com.cell(row=r, column=1, value=pid).font = negrita
        com.cell(row=r, column=2, value=par.get(pid, {}).get('punto', '') or 'AXION').font = f_base
        com.cell(row=r, column=3, value=nombre_visible(pid, par)).font = f_base
        com.cell(row=r, column=4, value=f'=COUNTIF({primera}{r}:{ultima}{r},"✓")').font = f_neg
        for j, cid in enumerate(CONTROL, start=5):
            Lc = LETRA[cid]
            c = com.cell(row=r, column=j, value=f'=IF(COUNTIFS({pid_rng},$A{r},Datos!${Lc}$2:${Lc}${GP.ULTIMA},"<>")>0,"✓","")')
            c.font = Font(name=GP.F, size=9, color='1F6F4A', bold=True); c.alignment = Alignment(horizontal='center')
    fin_c = 3 + len(participantes)
    com.conditional_formatting.add(f'{primera}4:{ultima}{fin_c}', FormulaRule(formula=[f'{primera}4="✓"'], fill=verde))
    com.conditional_formatting.add(f'{primera}4:{ultima}{fin_c}', FormulaRule(formula=[f'{primera}4=""'], fill=rojo))
    tr = fin_c + 1
    com.cell(row=tr, column=3, value='Participantes con dato').font = f_neg
    for j in range(5, 5 + len(CONTROL)):
        Lc = get_column_letter(j)
        c = com.cell(row=tr, column=j, value=f'=COUNTIF({Lc}4:{Lc}{fin_c},"✓")')
        c.font = Font(name=GP.F, size=8, bold=True); c.alignment = Alignment(horizontal='center')
    for colu, w in zip('ABCD', (10, 12, 28, 8)):
        com.column_dimensions[colu].width = w
    com.freeze_panes = 'E4'

    # ---------------- Próxima entrevista ----------------
    gu = wb.create_sheet('Próxima entrevista', 5)
    gu.sheet_properties.tabColor = 'E8A317'
    gu['A1'] = 'Guía para la próxima entrevista de cada participante'; gu['A1'].font = f_tit
    gu['A2'] = (f'Foto al {HOY} a partir de la planilla 2026_CAMIONEROS, las transcripciones y el listado de audios. «A confirmar» = '
                'el dato se interpretó (respuesta libre llevada a una opción, o deducida de la charla) o difiere entre fuentes: '
                'conviene volver a preguntarlo. La hoja Completitud muestra el estado actualizado.')
    gu['A2'].font = f_sub
    encabezar(gu, 4, ['ID', 'Punto', 'Nombre', 'Audio / transcripción', 'Preguntas sin dato (sociodemográfica)',
                      'Mediciones y datos biológicos sin dato', 'A confirmar', 'Notas de la extracción'])
    for r, pid in enumerate(participantes, start=5):
        f = datos_por_pid.get(pid, {})
        falta_s = [corto(c) for c in ['edad'] + PRINCIPALES_SOCIO if vacio(f.get(c, ''))]
        falta_b = [corto(c) for c in BIO_CONTROL if vacio(f.get(c, ''))]
        audio, transc = AUDIO[pid][0], AUDIO[pid][1]
        at = f'Audio: {audio}' + (f' · Transcripción: {transc}' if transc != '—' else '')
        vals = [pid, par.get(pid, {}).get('punto', '') or 'AXION', nombre_visible(pid, par), at,
                'Todas' if not f else (', '.join(falta_s) or '—'), 'Todas' if not f else (', '.join(falta_b) or '—'),
                conf.get(pid, ''), notas.get(pid, '') or ('Sin datos todavía: entrevista completa con la app.' if not f else '')]
        for i, v in enumerate(vals, start=1):
            c = gu.cell(row=r, column=i, value=v); c.font = f_base; c.border = borde
            c.alignment = Alignment(wrap_text=True, vertical='top')
        gu.cell(row=r, column=1).font = negrita
        if not f:
            for i in range(1, 9):
                gu.cell(row=r, column=i).fill = amarillo
    for colu, w in zip('ABCDEFGH', (10, 12, 22, 20, 46, 40, 34, 70)):
        gu.column_dimensions[colu].width = w
    gu.freeze_panes = 'D5'

    # ---------------- Evidencia ----------------
    evh = wb.create_sheet('Evidencia')
    evh.sheet_properties.tabColor = '5B6470'
    encabezar(evh, 1, ['ID', 'Nombre', 'Variable', 'Pregunta', 'Valor cargado', 'Tipo', 'Fuente (planilla o cita de la transcripción)'])
    for r, fila in enumerate(ev, start=2):
        for i, v in enumerate(fila, start=1):
            c = evh.cell(row=r, column=i, value=v); c.font = f_base
            c.alignment = Alignment(wrap_text=i in (4, 7), vertical='top')
        if fila[5] in ('inferido', 'interpretado'):
            evh.cell(row=r, column=6).fill = amarillo
    for colu, w in zip('ABCDEFG', (10, 24, 20, 40, 22, 11, 70)):
        evh.column_dimensions[colu].width = w
    evh.freeze_panes = 'A2'
    evh.auto_filter.ref = f'A1:G{len(ev) + 1}'

    # ---------------- Salud y temas ----------------
    cu = wb.create_sheet('Salud y temas')
    cu.sheet_properties.tabColor = '5B6470'
    encabezar(cu, 1, ['ID', 'Nombre', 'Resultados mencionados', 'Otros datos de salud', 'Temas centrales de la charla'])
    for r, fila in enumerate(sal, start=2):
        for i, v in enumerate(fila, start=1):
            c = cu.cell(row=r, column=i, value=v); c.font = f_base; c.alignment = Alignment(wrap_text=True, vertical='top')
    for colu, w in zip('ABCDE', (10, 24, 45, 60, 60)):
        cu.column_dimensions[colu].width = w
    cu.freeze_panes = 'C2'

    # Tablero: la primera fila de «Avance por equipo» pasa a «P» (registro previo)
    tab = wb['Tablero']
    for row in tab.iter_rows(min_col=2, max_col=2):
        c = row[0]
        if c.value == 'A' and tab.cell(row=c.row - 1, column=2).value == 'Equipo':
            c.value = 'P'
            c.comment = Comment('P = registro previo a la app (lista oficial y transcripciones).', 'Instrumento')
            break

    ins = wb['Instrucciones']
    textos = [
        ('Planilla previa · registro anterior a la app (depurada)', f_tit),
        (f'Corte: {HOY}. Una fila por persona en «Datos» (equipo P, ID = P1- + N° de orden de la lista oficial; P1-0103 = empleado de Lidia).', f_base),
        ('Participantes (privada, tiene nombres): lista completa con audio, transcripción, cómo se identificó a cada persona y avance.', f_base),
        ('Entrevistas grabadas: el listado de audios renglón por renglón, con el ID asignado. Pendientes: lo que falta confirmar con el equipo.', f_base),
        ('Completitud y Próxima entrevista: qué falta preguntar o medir a cada uno. Evidencia: la fuente de cada dato.', f_base),
        ('Para Google: en la hoja Datos de la planilla del proyecto, borrar con Supr las filas P1- anteriores y pegar A2:DC39 de esta hoja '
         '(Ctrl+Mayús+V, solo valores). Las hojas con nombres quedan solo en el Drive privado.', f_base),
        ('', None), ('', None)]
    ins.insert_rows(1, len(textos))
    for i, (t, fnt) in enumerate(textos, start=1):
        c = ins.cell(row=i, column=2, value=t)
        if fnt:
            c.font = fnt
        c.alignment = Alignment(wrap_text=True, vertical='top')
    wb.active = wb.sheetnames.index('Participantes')
    return wb, participantes, filas, ev, veces


if __name__ == '__main__':
    wb, participantes, filas, ev, veces = construir()
    wb.save(SALIDA)
    con_audio = sum(1 for p in participantes if AUDIO[p][0] == 'Sí')
    transc = sum(1 for p in participantes if AUDIO[p][1] in ('Completa', 'Parcial'))
    print('→', SALIDA)
    print(f'  {len(participantes)} en Participantes, {len(filas)} con datos, {len(ev)} datos con fuente')
    print(f'  {con_audio} con audio, {transc} con transcripción, '
          f'{sum(1 for p in participantes if AUDIO[p][1] == "Pendiente")} sin transcribir, '
          f'{sum(1 for p in participantes if AUDIO[p][0] == "A confirmar")} audio a confirmar')
    if veces:
        print('  bloques en Entrevistas.docx:', {k: v for k, v in veces.items() if v != 1} or 'todos una vez')
