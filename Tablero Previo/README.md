# Voces del Corredor Bioceánico

Tablero web para cuantificar las entrevistas en profundidad a camioneros del Corredor Bioceánico (tramo Jujuy). Proyecto Salud de Camioneros, UNJu.

La app es un único archivo (`index.html`). No tiene servidor ni base de datos: lee una planilla `.xlsx` desde el navegador, en la computadora o en el celular.

## Qué muestra

| Pestaña | Contenido |
|---|---|
| Resumen | Problemas más mencionados (% de entrevistados) y cobertura por eje |
| Perfil | País, punto, recorrido, relación laboral, edad, años de chofer, educación, cobertura, ingresos |
| Salud | FINDRISK, Framingham, IMC, hipertensión, diabetes, presión, glucemia, hábitos |
| Temas | Temas por eje y mapa entrevistado × tema |
| Cruces | Tabla dinámica de temas según cualquier variable del perfil o de salud; prueba exacta de Fisher cuando hay dos grupos |
| Citas | Explorador de citas filtrable por eje, tema, tipo, entrevistado o texto |
| Estrategias | Por problema: cuántos lo mencionan, grupo más afectado, problemas asociados, propuestas de esas mismas personas |
| App en ruta | Necesidades del chofer en ruta (pide / señala carencia / menciona), matriz de priorización, módulo de la app que las cubre, trazabilidad necesidad → requisito, cruces por grupo, opinión sobre una app y lugares mencionados |

## Publicar en GitHub Pages

1. Crear un repositorio (puede ser público: **el código no contiene datos**).
2. Subir `index.html` y este `README.md`.
3. En el repositorio: *Settings › Pages › Build and deployment › Deploy from a branch*, rama `main`, carpeta `/ (root)`.
4. GitHub da una dirección del tipo `https://<usuario>.github.io/<repositorio>/`. Esa dirección se abre desde cualquier navegador, también en el celular.

**No subir la planilla al repositorio.** Contiene información de salud de los participantes.

## Cargar los datos

**Opción 1 · Archivo:** botón «Cargar planilla» (o arrastrar el archivo). En el celular abre el selector de archivos, incluido Google Drive.

**Opción 2 · Enlace de Google Sheets:**

1. Abrir la planilla en Google Sheets.
2. *Archivo › Compartir › Publicar en la web*, elegir «Documento completo» y formato **Microsoft Excel (.xlsx)**.
3. Copiar el enlace y pegarlo en el campo «Enlace .xlsx publicado» de la app. La app lo recuerda en ese navegador.

Un enlace común de Drive («cualquiera con el enlace») no funciona, porque Google no permite que otra página lo lea. Tiene que ser el enlace de «Publicar en la web». Ese enlace es accesible para quien lo conozca: usarlo solo si el comité de ética lo permite. Si no, usar la opción 1.

## Estructura de la planilla

Tres hojas, con estos nombres y encabezados:

- **Participantes**: una fila por persona. Columna `ID` y `Entrevista codificada` (Sí / No), más las variables del perfil y de salud (`Punto de encuentro`, `País de nacimiento`, `Tipo de recorrido`, `Grupo de edad`, `Relación laboral`, `FINDRISK`, etc.).
- **Codificacion**: una fila por mención. `ID`, `Segmento`, `Eje`, `Tema`, `Tipo`, `Negada`, `Término detectado`, `Cita`, `Pregunta previa`, `Validado`.
- **Libro_de_codigos**: `Eje`, `Tema`, `Tipo`, `Definición`, `Patrón de búsqueda`.

`Tipo` toma uno de cuatro valores: `Problema o desafío`, `Recurso o fortaleza`, `Propuesta`, `Contexto`.

Hojas opcionales para la pestaña «App en ruta»:

- **Necesidades**: `ID`, `Segmento`, `Necesidad`, `Tipo` (`Pedido o propuesta`, `Carencia señalada`, `Mención`), `Módulo de la app`, `Requisito`, `Término detectado`, `Lugares mencionados`, `Cita`, `Pregunta previa`, `Validado`.
- **Necesidades_libro**: `Necesidad`, `Situación`, `Módulo de la app`, `Requisito`, `Patrón de búsqueda`.
- **Opinion_app**: `ID`, `Segmento`, `Postura` (`Favorable`, `Escéptica`, `Sin postura clara`), `Cita`, `Pregunta previa`, `Validado`.

## Validar la codificación

La codificación inicial es automática (palabras clave sobre las intervenciones del entrevistado). Al revisar cada cita, completar `Validado` con `Sí` o `No`. Con la casilla «Solo citas validadas», la app cuenta únicamente las confirmadas.

Para agregar un tema nuevo: sumarlo en `Libro_de_codigos` y cargar sus filas en `Codificacion` con el mismo nombre de tema.

## Limitaciones

- Los porcentajes cuentan personas que **mencionan** un tema, no personas que lo padecen.
- No a todos se les hicieron las mismas preguntas.
- Con n ≈ 27, las comparaciones son exploratorias; las p de Fisher no están corregidas por comparaciones múltiples.
