# Manual técnico y recetas de cambio

Para quien mantiene el sistema. La guía de prueba paso a paso está en el documento «Guía de prueba paso a paso · Relevamiento Corredor Bioceánico» (en Claude), y su copia en PDF va en esta misma carpeta si la exportaste.

## Herramientas

- **Para editar archivos**: cualquier editor de texto. Recomendado: [Visual Studio Code](https://code.visualstudio.com/) (gratis). Evitá Word o el Bloc de notas con formato. Guardá siempre en **UTF-8**.
- **Para correr las pruebas** (opcional pero recomendado): [Node.js](https://nodejs.org/) LTS. Para la prueba en navegador: Python 3 con `pip install playwright` y `playwright install chromium`.
- **Para publicar**: el navegador (GitHub web) alcanza.

## Cómo fluye un relevamiento

1. **Nuevo relevamiento**: se crea en memoria y se guarda en IndexedDB recién al primer dato. Así no quedan borradores vacíos.
2. **Cada cambio** se guarda solo, a los 0,25 s, también al cerrar o minimizar la app.
3. **Continuar**: si no tiene ID de participante, se asigna `<EQUIPO><DISPOSITIVO>-<N° de orden>` (p. ej. `J1-0811`; `R.idParticipante`). Si después se corrige el orden, el ID se corrige solo. El N° de orden no puede repetirse en el mismo dispositivo. Los relevamientos hechos con la 1.3 conservan su ID (`A1-0001`…).
4. **Guardar y volver** (Resultados): `estado = finalizado`, se registra la hora de fin.
5. **Sincronizar**: se envían, en lotes de 25, los registros con consentimiento cuya fecha `modificado` es posterior a la de `sincronizado`. La planilla devuelve los `id` recibidos y solo esos se marcan como enviados. Un registro marcado así tiene **copia confirmada** en la planilla.
6. **Paquete del día** (formato 2, desde 1.4): un JSON `{tipo:'paquete-relevamiento', version:2, generado, equipo, dispositivo, cantidad, iteraciones, cifrado:true, sal, iv, datos}` guardado como `.txt` (Android solo deja compartir algunos tipos de archivo). Lleva los registros completos, contacto incluido, cifrados con AES-GCM de 256 bits; la clave se deriva de la clave del equipo con PBKDF2-HMAC-SHA256 y 600 000 iteraciones, con sal (16 bytes) e IV (12 bytes) aleatorios nuevos en cada paquete. La cabecera visible va como dato asociado (AAD): si se cambia, el paquete no abre. **Sin clave no se genera.** La app muestra la **huella** del archivo (primeros 32 bits del SHA-256, p. ej. `3F9A-21C7`) para comparar a simple vista que llegó el mismo archivo. El paquete no cuenta como copia confirmada: no habilita a borrar nada.
7. **Importar** (PC de la administradora): abre paquetes del formato 2 y del 1 (150 000 iteraciones, sin AAD); rechaza los que no están cifrados, los alterados y los incompletos. Descarta registros con `id` o `fecha` de formato inválido (protege las pantallas de código insertado). Une por `id`; si un registro está repetido, queda la versión con `modificado` más reciente. Los importados quedan pendientes de envío para que la PC los suba. Muestra la huella de cada archivo.
8. **Registro de operaciones**: el dispositivo anota inicio, fin, envíos, paquetes, respaldos, importaciones y borrados en `ajustes › bitacora` (últimas 300), sin respuestas, contactos ni claves. Se ve en Ajustes.

## Protocolo con la planilla

- **Pedido**: `POST` con cuerpo `text/plain`, que contiene un JSON:
  - para probar la conexión: `{accion:'probar', token}` → `{ok, planilla, version:'1.4', permiso}`
  - para guardar (clave del equipo, `TOKEN`): `{accion:'guardar', token, registros:[{fila:{…}, contacto:{…}}]}`
  - para leer la hoja Datos (clave de lectura, `TOKEN_LECTURA`; solo el tablero): `{accion:'leer', token}`
- **Respuesta**: `{ok:true, recibidos:[ids], omitidos:[ids]}` o `{ok:false, error}`.
- **En la planilla**:
  - El script ubica las columnas por el nombre de la fila 1 y agrega al final las que falten (así llegó `b_pad_mmhg` en la 1.4).
  - Si un `id` ya existe, actualiza esa fila; si no, agrega una fila nueva. Si la fila tiene un `modificado` posterior al que llega, no la pisa (queda en `omitidos`, que igual se confirman porque la planilla ya tiene una copia igual o más nueva).
  - Usa un bloqueo (`LockService`) para que dos envíos simultáneos no se pisen.
  - Anota cada envío y cada lectura en la hoja **Registro** (fecha, operación, cantidades y equipo-dispositivo).
  - `TOKEN_LECTURA` vacía o igual a `TOKEN`: se lee con la clave del equipo (como en 1.3). Con una clave distinta: solo esa lee.

## Recetas

### Cambiar un texto de la interfaz

1. Abrí `app/js/config.js`, buscá el texto (Ctrl+F) y cambiá lo que está entre comillas.
2. Subí `versionApp` (p. ej. `'1.2.0'` → `'1.2.1'`).
3. Subí `config.js` a GitHub (ver «Publicar una actualización»).

Ejemplos de lo que está ahí:
- el nombre del lugar arriba de la jornada;
- los botones;
- los nombres de las etapas;
- el texto del consentimiento;
- el criterio de derivación;
- quién recibe los paquetes (`responsable: 'la administradora'`) y los títulos de esa sección;
- el rótulo y la ayuda de «Encuestador/es de esta entrevista» y de la búsqueda del participante;
- las recomendaciones de Framingham;
- los rangos válidos de edad, peso, altura, perímetro, presión y glucemia.

### Cambiar el texto de una pregunta o de una opción

En `app/js/cuestionario.js`, buscá la pregunta por su número (`n: 9`) y cambiá `texto` o el texto de la opción.

- **Cambiar el texto de una opción con datos ya cargados** hace que los datos viejos y los nuevos queden con palabras distintas, y el tablero cuenta por palabra exacta. Si solo corregís una falta de ortografía antes de salir a campo, no hay problema.
- **No cambies el `id`.**

Después: subí `versionApp` y publicá. Si la opción aparece en el tablero, regenerá la planilla (receta «Regenerar la planilla») o corregí a mano el texto en la hoja Tablero.

### Agregar una opción

Agregala a la lista `opciones` de la pregunta. Para que tenga un campo «especificar», agregala también en `detalles` con un `id` nuevo, p. ej. `p09_otro`.

### Agregar una pregunta

1. Agregá un objeto a la sección que corresponda:
   ```js
   { n: 40, id: 'p40_ejemplo', texto: '¿…?', tipo: 'unica', opciones: ['Sí', 'No'], enLinea: true },
   ```
2. Tipos posibles:
   - `unica`: una opción;
   - `multiple`: varias, con `exclusiva: 'Ninguna'` si corresponde;
   - `lista`: desplegable;
   - `numero`: con `unidad`, `min`, `max` y `decimales`;
   - `texto`: respuesta libre.
3. Para mostrarla solo según otra respuesta: `mostrarSi: { id: 'p30_dolores', igual: 'Sí' }` o `mostrarSi: { id: 'p31_automedicacion', incluye: ['Medicamentos'] }`.
4. En la planilla de Google en uso no hay que hacer nada: el script agrega la columna nueva al final.
5. Para que aparezca en el tablero: regenerá la planilla o agregá la tabla a mano (receta «Agregar un gráfico al tablero»).
6. Corré las pruebas. `tests/registro.test.js` verifica que sean 39 preguntas: actualizá ese número.

### Cambiar colores

En `app/css/estilos.css`, sección `:root`:
- `--tinta`: el negro de botones y textos;
- `--azul`: enlaces y sincronización;
- `--ambar`: lo destacado;
- `--r1` a `--r5`: la escala de riesgo.

Mantené el contraste alto, porque la app se usa al sol.

### Cambiar el nombre o el ícono de la app instalada

- **Nombre**: en `app/manifest.webmanifest`, `name` y `short_name`; también el `<title>` de `app/index.html`.
- **Ícono**: reemplazá `app/icons/icono-192.png` e `icono-512.png` con imágenes PNG cuadradas de esos tamaños, y `icono-maskable-512.png` con el dibujo dentro del 80 % central.

Los celulares que ya tienen la app instalada pueden tardar en mostrar el cambio de nombre o de ícono.

### Publicar una actualización

1. En GitHub, en el repositorio de la app: entrá a la carpeta del archivo (p. ej. `js`), elegí **Add file › Upload files**, arrastrá el archivo nuevo (reemplaza al anterior) y tocá **Commit changes**.
2. Esperá 1 o 2 minutos.
3. En los celulares: abrir la app con señal, cerrarla y volver a abrirla. Aparece el aviso «Se descargó una versión nueva». En Ajustes, al pie, se ve el número de versión.

### Actualizar el script de Google

Pegá el código nuevo en Extensiones › Apps Script › Guardar. Después: **Implementar › Administrar implementaciones** › lápiz › Versión: **Nueva versión** › Implementar. La URL `/exec` no cambia.

### Regenerar la planilla (después de cambiar columnas)

```
node planilla/exportar_columnas.js 120
python3 planilla/generar_planilla.py
```

Esto genera una planilla nueva y vacía.

- Si ya tienen una planilla de Google en uso, **no la reemplaces**. Copiá desde la planilla nueva solo la hoja Tablero (clic derecho en la pestaña › Copiar a…), o agregá a mano las tablas que falten.
- La hoja Datos de la planilla en uso se actualiza sola.

### Agregar un gráfico al tablero

- **En la planilla de Google**: armá una tabla con `CONTAR.SI(Datos!X2:X3000;"opción")` y usá Insertar › Gráfico. Para ubicar la columna, buscá el nombre de la variable en la hoja Diccionario.
- **En el generador**: agregá una línea `bloque('Título', 'id_de_la_pregunta', [opciones])` en `planilla/generar_planilla.py` y regenerá la planilla.

### Guardar los contactos en una planilla privada aparte

Sirve para que el equipo vea el tablero sin ver correos ni celulares.

1. Creá una planilla de Google nueva y vacía (solo vos con acceso).
2. Copiá su identificador: la parte larga de la dirección, entre `/d/` y `/edit`.
3. En el script, pegalo en `const ID_PLANILLA_CONTACTOS = '';`.
4. Guardá y volvé a implementar con **Nueva versión**. Google va a pedir autorización otra vez.

Los contactos nuevos van a la hoja «Contactos» de esa planilla. Los anteriores podés moverlos a mano.

### Cambiar la clave del equipo o la de lectura

Conviene usar claves largas y al azar (por ejemplo, cinco palabras sin relación entre sí) y no escribirlas en guías que circulen por chat. Cambialas al empezar cada campaña y cuando alguien deja el equipo.

1. Cambiá `TOKEN` (equipo) o `TOKEN_LECTURA` (tablero) en el script y volvé a implementar (receta «Actualizar el script de Google»).
2. Si cambiaste la del equipo: cargala en Ajustes de cada celular y de la PC. Si cambiaste la de lectura: en el tablero (Fuentes › Clave de lectura).

Los paquetes cifrados con la clave vieja se abren solo con la clave vieja: importalos antes del cambio (o guardá la clave vieja en un lugar seguro).

### Confirmar que un paquete llegó entero

1. El encuestador genera el paquete y manda el archivo **y** la huella que muestra la app (p. ej. `3F9A-21C7`).
2. La administradora lo importa: la app muestra la huella del archivo recibido. Si coinciden, responde «recibido J1 3F9A-21C7».
3. Si la huella no coincide o el paquete no abre («modificado o dañado»), se pide que lo vuelvan a mandar. El encuestador no borra nada: lo que no está en la planilla sigue en su celular.

### Agregar un dispositivo o un equipo

El ID de participante se arma con la letra, el N° de dispositivo y el N° de orden (`A1-0007`, `J1-0811`). Con un celular por integrante, el dispositivo queda siempre en 1 y la letra ya distingue a cada persona. El número cambia solo cuando la misma persona carga desde un segundo aparato: ahí va 2 y un rango de orden distinto, porque cada aparato lleva su propio contador.

En Ajustes del aparato nuevo: la letra, el N° de dispositivo y un rango de números de orden que nadie use. Llevá una tabla de rangos (la vigente está en la guía del equipo):

| Letra | Dispositivo | Rango |
|---|---|---|
| A | 1 | 001–090 |
| B | 1 | 091–180 |
| A | 2 (segundo aparato de A) | 901–950, por ejemplo, tomado de la reserva Z |
| … | … | … |

En el tablero, escribí la letra del equipo en una de las celdas amarillas de «Avance por equipo».

### Tablero web

- **Dónde está**: carpeta `app/tablero/`. Se publica igual que la app: en GitHub, dentro del repositorio, una carpeta `tablero` con `index.html`, `css/`, `js/` y `lib/`. Dirección: la de la app + `tablero/`.
- **Qué lee**: archivos .xlsx (toma la hoja «Datos») o .csv (el de la app, con punto y coma). Se leen en el navegador; no se suben a ningún lado.
- **Leer directo de Google**: requiere el script 1.3 (acción `leer`). Actualizá `Codigo.gs` (receta «Actualizar el script de Google»). Devuelve solo la hoja Datos, nunca Contactos.
- **Cambiar el nombre corto de una variable** (títulos de los gráficos): `app/tablero/js/datos.js`, objeto `NOMBRES`.
- **Agregar un cruce sugerido**: `app/tablero/js/tablero.js`, lista `SUGERENCIAS` (`[filas, columnas, rótulo]`).
- **Agregar una variable derivada** (p. ej. otra agrupación): en `datos.js`, agregala a `DERIVADAS` y calculala en `derivar()`.
- **Datos de ejemplo**: `node herramientas/generar_ejemplo_tablero.js` (son ficticios).
- **Versión para mostrar en Claude**: `python3 herramientas/construir_tablero_artifact.py salida.html` arma una sola página con los datos ficticios.
- **Estadística**: chi cuadrado de independencia (con aviso si más del 20 % de las celdas tiene esperada < 5), Fisher exacta para tablas 2 × 2, Pearson y Spearman con su p. Las funciones están verificadas contra SciPy (`tests/estadistica.test.js`).

## Datos y respaldo

- **Respaldo del celular**: Ajustes › Respaldo cifrado (requiere la clave del equipo). Se importa en cualquier PC con la misma clave.
- **Respaldo de la planilla**: Archivo › Descargar › Microsoft Excel. Además, Google guarda el historial de versiones. El Excel descargado no está cifrado: guardalo solo en la computadora de análisis (idealmente en una carpeta cifrada: BitLocker, FileVault, VeraCrypt o un .7z con contraseña, todos gratuitos).
- **CSV**: solo en Administración (Importar), con aviso de que no están cifrados. El cierre de jornada del celular ya no los ofrece.
- **Borrado**: Ajustes › Zona de cuidado.
  - *Borrar los datos de este celular*: un solo botón. Pide escribir BORRAR y avisa cuántos relevamientos no se enviaron; si hay alguno, antes descarga automáticamente un respaldo cifrado. La app nunca borra sola después de sincronizar.
  - *Eliminar este relevamiento* (en Identificación): avisa si no tiene copia en la planilla.

## Pruebas automáticas

| Prueba | Qué verifica |
|---|---|
| `node tests/calculos.test.js` | IMC, FINDRISK, Framingham y ayuno con casos conocidos |
| `node tests/registro.test.js` | 39 preguntas, saltos, conversión a fila, CSV, diastólica sin efecto en los puntajes, ID derivado del orden, paquetes cifrados (formato 2 y compatibilidad con el 1), paquetes alterados, cortados o sin cifrar, huella, unión y descarte de registros inválidos |
| `node tests/apps_script.test.js` | El script con una planilla simulada: claves de escritura y lectura, no pisar versiones más nuevas, hoja Registro sin datos personales |
| `node tests/estadistica.test.js` | Estadística del tablero contra valores de SciPy |
| `python3 tests/tablero_e2e.py` | El tablero en un navegador: vistas, filtros, carga de .xlsx y .csv, lectura de Google simulada, informe, descargas, celular y tema oscuro |
| `python3 tests/recorrido_e2e.py` | Un relevamiento completo en un navegador del tamaño de un celular (con diastólica y control de orden repetido), sincronización simulada, paquete con huella, uso sin señal, importación (y rechazo de un paquete alterado), registro de operaciones, borrado seguro y apertura con doble clic |
