# Contexto del proyecto para pedir cambios

**Para qué sirve este archivo.** Cuando quieras modificar algo (un texto, una pregunta, un gráfico, una corrección), abrí una conversación nueva con Claude, o escribile a quien programe, y adjuntá:

1. El **zip del proyecto tal como lo tienen hoy** (con los cambios que ya hayan hecho).
2. **Este archivo**.
3. Si el cambio es visual, una captura de pantalla de lo que querés cambiar.

Con eso no hace falta explicar todo de nuevo ni empezar de cero.

---

## Cómo redactar el pedido

Copiá y completá esta plantilla:

```
Adjunto el proyecto "Relevamiento Corredor Bioceánico" (versión que figura en app/js/config.js)
y el archivo CONTEXTO_PARA_PEDIR_CAMBIOS.md. Leelos antes de cambiar nada.

Quiero: [describí el cambio en una o dos oraciones]
Dónde se ve: [pantalla o hoja de la planilla]
Ejemplo: [cómo está hoy → cómo tiene que quedar]
¿Afecta datos ya relevados?: [sí / no / no sé]

Devolveme el proyecto completo actualizado, con versionApp aumentada, CAMBIOS.md al día
y las pruebas pasando. Decime qué archivos tengo que volver a subir a GitHub y si hay que
tocar la planilla o el script de Google.
```

Ejemplos de pedidos bien hechos:

- *"En la pregunta 9 agregar la opción 'No transita por Jujuy'. Pantalla: Sociodemográfica, sección 4."*
- *"Cambiar el texto del botón 'Nuevo relevamiento' por 'Nueva encuesta'."* (esto lo podés hacer vos en `config.js`).
- *"Agregar al tablero un gráfico de horas de sueño por rangos (menos de 5, 5 a 7, más de 7)."*
- *"Definimos el criterio de derivación: glucemia en ayunas de 126 mg/dL o más, o casual de 200 o más. Mostrarlo en Resultados."*

---

## Resumen del proyecto

- **Qué es**: un sistema para relevar una encuesta sociodemográfica (39 preguntas) y una encuesta biológica (mediciones, FINDRISK, Framingham con IMC y glucometría) a conductores de camiones del Corredor Bioceánico en Jujuy.
- **Quién lo usa**: equipos de investigación con celulares Android, en rutas con poca o ninguna señal.
- **Restricciones**: costo $0; sin servidor propio; una cuenta de Gmail del proyecto; computadoras comunes; los datos de salud son sensibles (Ley 25.326).
- **Solución**:
  - *App de campo*: página web instalable (PWA), en HTML/CSS/JS sin librerías, publicada en GitHub Pages. Funciona sin señal y guarda en el celular (IndexedDB).
  - *Envío*: con señal, un POST a un Apps Script dentro de una planilla de Google. Sin señal, un "paquete del día" cifrado (AES-GCM; clave derivada de la clave del equipo con PBKDF2) que se manda por WhatsApp o Drive con su huella y se importa en la PC de la administradora.
  - *Análisis*: una planilla con las hojas Datos, Contactos, Diccionario y Tablero (fórmulas y gráficos, sin macros) y un **tablero web** en `app/tablero/` que lee esas planillas en el navegador (sin servidor): filtros, cruces, gráficos SVG propios, informe descargable.
- **Integración futura**: una app de camioneros que lea las muestras de cada persona por su `participante_id`.
- **Diseño**: estética de señalética vial, alto contraste y botones grandes para usar al sol. El diseño original está en el lienzo de Claude «Relevamiento Corredor Bioceánico Jujuy».

## Mapa de archivos

| Archivo | Qué hace | ¿Se toca seguido? |
|---|---|---|
| `app/js/config.js` | Textos de la interfaz, nombres de etapas, rangos válidos, recomendaciones, versión de la app | **Sí**: cambios simples |
| `app/js/cuestionario.js` | Preguntas, opciones, saltos y columnas de la planilla | Sí: cambios del instrumento |
| `app/css/estilos.css` | Colores (sección `:root`) y estilos | A veces |
| `app/manifest.webmanifest` | Nombre e ícono de la app instalada | Rara vez |
| `app/js/calculos.js` | IMC, FINDRISK, Framingham y ayuno | Solo si cambian las tablas del protocolo |
| `app/js/registro.js` | Avance de cada módulo, saltos y conversión a fila de planilla y CSV | Rara vez |
| `app/js/app.js` | Pantallas y navegación | Cambios de interfaz más profundos |
| `app/js/sync.js` | Envío a la planilla, paquetes cifrados (formato 2), huella, validación e importación | Rara vez |
| `app/js/db.js` | Almacenamiento en el celular | Casi nunca |
| `app/sw.js` | Funcionamiento sin señal y actualización | Casi nunca |
| `apps-script/Codigo.gs` | Recibe los datos en la planilla de Google; claves de escritura y de lectura; hoja Registro | Rara vez |
| `planilla/generar_planilla.py` | Arma la planilla con el tablero (fórmulas y gráficos) | Al cambiar columnas o gráficos |
| `planilla/exportar_columnas.js` | Exporta la lista de columnas desde el cuestionario | Junto con el anterior |
| `app/tablero/js/tablero.js` | Vistas, filtros, textos de lectura y descargas del tablero web | Al cambiar el tablero |
| `app/tablero/js/datos.js` | Lectura de .xlsx/.csv, unión de planillas y visitas, variables derivadas, nombres cortos de las variables (`NOMBRES`) | Al agregar variables o cruces |
| `app/tablero/js/graficos.js` | Gráficos SVG (barras, apiladas, agrupadas, columnas, dispersión) y exportación PNG/SVG | Rara vez |
| `app/tablero/js/estadistica.js` | Descriptivos, chi cuadrado, Fisher, Pearson y Spearman (verificados contra SciPy) | Casi nunca |
| `app/tablero/css/tablero.css` | Colores y diseño del tablero (paletas de gráficos validadas) | A veces |
| `previo/generar_previo.py` | Planilla previa depurada: une la lista oficial, las transcripciones y el listado de audios (una fila por persona). Las decisiones están arriba del script (`UNIFICAR`, `AUDIO`, `LISTADO`, `PENDIENTES`). Las fuentes van en `previo/fuentes/` y son confidenciales | Si el equipo confirma un pendiente o llega una transcripción nueva |
| `tests/` | Pruebas automáticas | Se corren después de cada cambio |
| `docs/REVISION_SEGURIDAD.md` | Arquitectura, riesgos, matriz de evaluación, cambios hechos y propuestos, pruebas de seguridad | Antes de cambiar cifrado, envío o borrado |

## Modelo de datos

- **Relevamiento** (un registro por encuesta, guardado en el celular): `id` (UUID), `participante_id` (p. ej. `J1-0811`), `orden`, `edad`, `cp`, `codigo` (`010-44-4600`), `fecha`, horas, `equipo`, `dispositivo`, `encuestador`, `puesto`, `consentimiento`, `comparte_app`, `contacto{correo, celular}`, `socio{p01…p39}`, `bio{b_…, g_…}`, `estado` (`borrador` o `finalizado`), `creado`, `modificado`, `sincronizado`.
- **Planilla**:
  - *Hoja Datos*: una fila por relevamiento, 107 columnas en el orden de `cuestionario.js` (`columnas()`; desde 1.4 incluye `b_pad_mmhg`, que en una planilla ya en uso el script agrega al final). Las respuestas múltiples van separadas por `"; "`. Los cálculos se guardan en las columnas `fr_*`, `fh_*` y `g_ayuno_min`.
  - *Hoja Contactos*: correo y celular, separados de las respuestas (mejor en una planilla privada aparte: `ID_PLANILLA_CONTACTOS`).
  - *Hoja Registro* (script 1.4): fecha, operación y cantidades de cada envío o lectura, sin datos personales.
- **Código y ID** (1.4): no se entrevista dos veces a la misma persona. El encuestador ve y busca el *código* (orden-edad-CP). El *ID de participante* es interno: `R.idParticipante` lo arma con equipo, dispositivo y N° de orden (`J1-0811`, como la previa `P1-0014`) y no se muestra. El N° de orden no puede repetirse en un dispositivo. El buscador de la jornada (`coincideRegistro` en `app.js`) acepta partes del código o los últimos números del celular y busca solo en ese dispositivo. Los relevamientos de la 1.3 conservan su ID anterior.
- **Diastólica** (1.4): `b_pad_mmhg`, obligatoria para «Bio completo» desde el instrumento `2026-10-v2`; no entra en FINDRISK ni en Framingham.
- **Registro de operaciones** (1.4): en el dispositivo, `ajustes` › `bitacora` (últimas 300). Sin respuestas, contactos ni claves.
- **Encuestador/es**: `encuestador` se completa con el valor de Ajustes y se edita por entrevista en Identificación (varios nombres separados por «y»).
- **Administradora**: la persona que importa paquetes y administra la planilla. El nombre que ve el equipo está en `config.js` (`textos.responsable`).
- **Rangos de números de orden**: cada dispositivo tiene uno propio (A1: 001–199, etc.) para que no se repitan códigos.

## Reglas que no hay que romper

1. **No cambiar el `id` de una pregunta ya usada en campo**: es el nombre de la columna. Si cambia el sentido de una pregunta, crear un `id` nuevo.
2. **No reordenar ni insertar columnas en el medio de la hoja Datos** de la planilla en uso. El script agrega las columnas nuevas al final, solo.
3. **Subir `versionApp` en `config.js` con cada cambio publicado**: si no, los celulares siguen con la versión vieja.
4. **Mantener la app sin dependencias externas** (salvo las tipografías de Google), para que funcione sin señal.
5. **Correo y celular nunca van a la hoja Datos ni al CSV consolidado.**
6. **Ninguna clave va en el código** publicado en GitHub (que es público): la del equipo se carga en Ajustes y en `TOKEN`; la de lectura, solo en `TOKEN_LECTURA` y en el tablero de la administración.
7. **Los cálculos siguen las tablas del protocolo.** Si se cambian, actualizar también las pruebas de `tests/calculos.test.js`.
8. **Accesibilidad y uso al sol**: botones de 44 px o más, contraste alto, sin depender solo del color.
9. **Sin clave no se genera ningún archivo de datos para compartir**, la app **nunca borra sola**, y el único botón de borrado («Borrar los datos de este celular») avisa lo no enviado y, si hay algo, antes descarga un respaldo cifrado.
10. **No usar criptografía propia**: solo Web Crypto del navegador (AES-GCM, PBKDF2, SHA-256).
11. **No cambiar preguntas, puntajes ni reglas de cálculo sin autorización del equipo investigador.**

## Después de cada cambio (lista de control)

- [ ] `node tests/calculos.test.js`, `node tests/registro.test.js`, `node tests/apps_script.test.js` y `node tests/estadistica.test.js` pasan.
- [ ] `python3 tests/recorrido_e2e.py` y `python3 tests/tablero_e2e.py` pasan (requieren Python con Playwright).
- [ ] Si cambiaron columnas o gráficos: `node planilla/exportar_columnas.js 120` y luego `python3 planilla/generar_planilla.py`.
- [ ] `versionApp` aumentada en `app/js/config.js`.
- [ ] `CAMBIOS.md` con una línea nueva.
- [ ] Subir a GitHub los archivos de `app/` que cambiaron.
- [ ] Si cambió `Codigo.gs`: pegarlo en Apps Script y en Implementar › Administrar implementaciones › editar › Nueva versión (la URL no cambia).

## Decisiones tomadas

- PWA en lugar de app de Play Store: no hay costo ni revisión de tienda, funciona en Android y en PC, y se actualiza sola.
- Planilla de Google con Apps Script en lugar de un servidor: costo $0, el equipo ya tiene Gmail, el tablero se comparte como lector y se descarga como Excel.
- Pregunta 2: la segunda «Secundaria incompleta» del modelo se corrigió a «Secundaria completa».
- Saltos: se eliminaron los «pasar a pregunta 25 / 41» del papel; la app oculta la 32 si en la 31 se responde «Ninguno».
- La medicación antihipertensiva se pregunta una vez y se usa en FINDRISK y en Framingham.
- 1.4 (pedidos del equipo): preguntas 4 y 5 con «Ninguna» como primera opción; la 8 pregunta el país donde obtuvo la licencia profesional, sin categoría (columnas `p08_lic_ar`, `_br`, `_cl` y `_py` dadas de baja; queda `p08_lic_otro` para el país si elige «Otro»).
- 1.4: no hay segundas entrevistas ni búsqueda para vincular; quien inicia una entrevista la termina en el mismo celular; la app no consulta la planilla.
- IMC igual a 30: FINDRISK suma 1 punto («25 a 30») y Framingham usa la fila «30 o más», literal del modelo.

## Pendientes del instrumento

- Pregunta 2: no tiene opción «Primaria incompleta / sin escolaridad».
- Framingham: verificar la fuente de la tabla de IMC (los demás puntajes coinciden con ATP III).
- Glucometría: definir el criterio de derivación (`criterioDerivacion` en `config.js`).
- Texto del consentimiento informado y revisión del protocolo por un comité de ética en investigación (todavía no hay protocolo presentado).

Historial de versiones: ver `CAMBIOS.md`.
