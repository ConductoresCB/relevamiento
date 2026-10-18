# Revisión de seguridad y cuidado de los datos · versión 1.4.0

Revisión hecha sobre el código de la versión 1.3.1 (app de campo, `Codigo.gs` 1.3 y tablero), con KoboToolbox y ODK como referencia. Los cambios de bajo costo ya están en la 1.4.0. Lo demás queda propuesto, ordenado por impacto y costo. Esta revisión **no certifica el cumplimiento de ninguna norma**: marca los aspectos técnicos y organizativos que el equipo tiene que revisar con la institución.

Restricciones: trabajo sin conexión; herramientas gratuitas; sin servidor propio; una complejidad que el equipo pueda sostener; sin cambios en preguntas, puntajes ni reglas de cálculo.

---

## 1. Arquitectura actual

```
Celular Android (PWA en Chrome)                      PC de la administradora (la misma app)
  IndexedDB: relevamientos completos, en claro          IndexedDB: lo importado, en claro
  Ajustes: URL del script y clave del equipo            │
  │                                                     │
  ├─ con señal: POST HTTPS (lotes de 25) ──► Apps Script ──► Planilla de Google
  │                                          (clave del equipo)   Datos (respuestas)
  │                                                               Contactos (correo, celular)
  │                                                               Registro (operaciones, 1.4)
  └─ sin señal: paquete .txt cifrado ──► WhatsApp / Drive ──► Importar ──► POST al script
                                                                 │
Tablero web (navegador de la PC) ◄── .xlsx descargado o acción «leer» (clave de lectura, 1.4)
```

| Dónde | Qué hay | ¿Lo cifra la app? | De qué depende la protección |
|---|---|---|---|
| Celular (IndexedDB de Chrome) | Todo, con contactos | No | Cifrado propio de Android y bloqueo de pantalla |
| Paquete del día y respaldo (.txt) | Todo, con contactos | **Sí**: AES-GCM 256 | Que la clave del equipo sea fuerte y no circule |
| WhatsApp o Drive | Paquetes | Sí (es el mismo archivo) | Además, el canal y quién tiene acceso |
| PC de la administradora (IndexedDB) | Todo lo importado | No | Cuenta de usuario propia y cifrado de disco |
| Planilla de Google: Datos | Respuestas sin contactos | No | Permisos de la cuenta de Google |
| Planilla de Google: Contactos | Correo y celular | No | Permisos; proteger la hoja **no la oculta** a los lectores |
| CSV descargados | Respuestas o contactos | No | Que queden solo en la PC de análisis |
| Tablero | Datos, en la memoria del navegador | No | Se borran al cerrar la pestaña |
| Registro (hoja y dispositivo) | Fecha, operación y cantidades | No hace falta | No guarda datos personales ni claves |

## 2. Riesgos encontrados en la 1.3.1

| N° | Riesgo | Gravedad | Estado en la 1.4.0 |
|---|---|---|---|
| R1 | **Una sola clave para todo.** La clave del equipo servía para escribir en la planilla, para leer la hoja Datos completa (acción `leer`) y para descifrar todos los paquetes. Está en cada celular, en la PC y en la guía del equipo. Además, es una frase predecible (palabras del proyecto, año y provincia). Un paquete se puede atacar fuera de línea sin límite de intentos: las iteraciones de PBKDF2 encarecen cada intento, pero no compensan una clave adivinable. | Alta | Mitigado: clave de lectura aparte y 600 000 iteraciones. **Falta cambiar la clave por una al azar** (P1). |
| R2 | **Archivos sin cifrar fuera del celular.** Si faltaba la clave, el paquete y el respaldo salían sin cifrar, con contactos y datos de salud, y se compartían por WhatsApp. El cierre de jornada ofrecía a cada encuestador un CSV sin cifrar, que queda en la carpeta Descargas, accesible a otras apps. | Alta | Resuelto: sin clave no se genera nada; el CSV y los contactos quedan solo en Administración, con aviso. |
| R3 | **Código insertado al importar.** Se aceptaban paquetes sin cifrar de cualquier origen, y el `id` y la `fecha` de cada registro iban sin escapar en enlaces y listas. Un archivo armado a propósito podía ejecutar código en la PC de la administradora y leer los datos y la clave guardada. | Alta | Resuelto: se rechazan los paquetes sin cifrar, se validan y escapan `id` y `fecha`, y hay política de contenido (CSP). |
| R4 | **Borrado sin copia validada.** «Borrar todo» eliminaba relevamientos no enviados con solo escribir BORRAR. Un paquete compartido no garantiza que la administradora lo haya recibido entero. | Media | Resuelto: la app nunca borra sola; el único botón de borrado avisa cuántos no se enviaron y, si hay alguno, antes descarga un respaldo cifrado. |
| R5 | **Pérdida de cambios en la planilla.** El script pisaba la fila con cualquier versión que llegara, aunque fuera más vieja; por ejemplo, un paquete importado tarde. | Media | Resuelto: no se pisa una versión más nueva. |
| R6 | **Contactos a la vista.** Con la configuración por defecto, Contactos está en la misma planilla, y quien la abre como lector la ve aunque la hoja esté protegida. | Media | A verificar en la planilla en uso (P2). |
| R7 | **Datos en claro en el celular y en la PC.** Una PWA no puede cifrar su almacenamiento sin pedir una clave en cada uso. La protección depende del cifrado de Android y del bloqueo de pantalla. La vista de apps recientes muestra la última pantalla. | Media | Limitación conocida: medidas organizativas (P3). |
| R8 | **Sin trazabilidad.** No quedaba registro de envíos, paquetes, importaciones ni borrados. | Media | Resuelto: registro en el dispositivo y hoja Registro, sin datos personales. |
| R9 | **Cabecera sin autenticar.** Equipo, dispositivo y cantidad del paquete se podían cambiar sin que se notara, y el mensaje de error no distinguía una clave incorrecta de un archivo dañado. | Baja | Resuelto: la cabecera va como dato asociado de AES-GCM y se verifica la cantidad. |
| R10 | **Corrector ortográfico.** Con la «revisión ortográfica mejorada» de Chrome activada, el texto que se escribe se envía a Google. | Baja | Resuelto: campos con `spellcheck="false"`. |
| R11 | **Cadena de publicación.** Quien pueda escribir en el repositorio de GitHub puede cambiar la app, y los celulares se actualizan solos. Todas las páginas de la cuenta comparten origen (`conductorescb.github.io`): otra página publicada en esa misma cuenta podría leer lo que la app guarda en el navegador. | Media | A verificar (P4). |
| R12 | Las tipografías se piden a Google: se expone la dirección IP, no los datos. | Baja | Propuesto (P6). |
| R13 | En iPhone, Safari puede borrar los datos de un sitio que no se agregó a la pantalla de inicio después de unos días sin uso. | Baja | Usar Android. En iPhone, agregar siempre la app a la pantalla de inicio. |
| R14 | Un CSV abierto en Excel puede interpretar como fórmula un texto libre que empiece con `=`. | Baja | Propuesto (P7). |
| R15 | El script es público («Cualquier usuario») y no limita los intentos de clave. | Baja con clave larga | Depende de P1. |

## 3. Matriz de evaluación

### Funcionalidades adecuadas

- **Cifrado estándar y autenticado.** Los paquetes usan AES-GCM de 256 bits mediante Web Crypto del navegador, sin criptografía propia. GCM es cifrado autenticado (NIST SP 800-38D): detecta cualquier cambio. Cada paquete lleva sal e IV nuevos, generados con `crypto.getRandomValues`, y por lo tanto una clave derivada distinta; no se reutiliza un IV con la misma clave.
- **Transporte.** El envío va por HTTPS y la clave viaja en el cuerpo del pedido, no en la dirección, así que no queda en historiales.
- **Separación de contactos.** Correo y celular se guardan aparte de las respuestas, y la lectura del tablero no los incluye.
- **Confirmación por identificador.** Solo se marca como enviado lo que la planilla confirma. El alta es idempotente por `id`, sin duplicados, y un bloqueo evita escrituras simultáneas.
- **Trabajo sin conexión.** Se guarda cada 0,25 s, también al cerrar o minimizar la app, y se pide almacenamiento persistente.
- **Consentimiento.** Sin consentimiento no se puede avanzar, no se envía y no se empaqueta.
- **Seudonimización.** El código y el ID no contienen nombres.
- **Procesamiento local.** El tablero procesa en el navegador y no sube archivos.
- **Sin rastros técnicos.** No hay registros técnicos con datos ni notificaciones, y el service worker guarda solo los archivos de la app.

### Aspectos que necesitan verificación (datos que faltan)

- **Planilla.** ¿Es una cuenta institucional (UNJu) o un Gmail? ¿Quiénes tienen acceso y con qué permiso? ¿Está configurado `ID_PLANILLA_CONTACTOS`? ¿La cuenta tiene verificación en dos pasos?
- **Celulares.**
  - ¿Son personales o del proyecto?
  - ¿Qué versión de Android tienen? Desde Android 10, los equipos nuevos usan cifrado por archivo.
  - ¿Tienen bloqueo de pantalla? ¿La depuración USB está desactivada? ¿Se comparten?
- **PC de análisis.** ¿Cuenta de usuario propia? ¿Disco cifrado (BitLocker, FileVault o LUKS)?
- **GitHub.** ¿Quiénes tienen permiso de escritura? ¿Tienen verificación en dos pasos? ¿Hay otras páginas publicadas en la cuenta?
- **WhatsApp.** ¿Los paquetes van a un chat individual o a un grupo? ¿Las copias de seguridad de WhatsApp tienen activado el cifrado de extremo a extremo?
- **Retención.** ¿Cuánto tiempo se guardan los contactos? ¿Cuándo se liberan los celulares?
- **Consentimiento.** ¿El texto informa que los datos se guardan en Google Drive y que pueden circular cifrados por WhatsApp?

### Mejoras prioritarias

Las del cuadro de la sección 4.

## 4. Cambios concretos, por impacto y costo

### Hechos en la 1.4.0

| N° | Cambio | Qué resuelve | Archivos | Cómo se comprueba |
|---|---|---|---|---|
| H1 | Sin clave no se generan paquetes ni respaldos; no hay más archivos sin cifrar para compartir | R2 | `sync.js`, `app.js` | `registro.test.js` («sin clave no se genera»); en la app, sin clave el botón queda desactivado |
| H2 | Importación segura: rechaza paquetes sin cifrar, alterados o incompletos; descarta registros con `id` o `fecha` inválidos; escapa los valores en pantalla; política de contenido (CSP) en la app y el tablero | R3, R9 | `sync.js`, `app.js`, `index.html`, `tablero/index.html` | `registro.test.js` (alterado, cortado, sin cifrar, registros con código insertado); `recorrido_e2e.py` (paquete alterado rechazado; sin errores de CSP) |
| H3 | Clave de lectura aparte y opcional (`TOKEN_LECTURA`) para el tablero. Vacía, se lee con la clave del equipo (decisión de la administración durante las pruebas); con una clave distinta, la clave de los celulares ya no lee la planilla | R1 | `Codigo.gs`, `tablero.js` | `apps_script.test.js`: la lectura con la clave del equipo se rechaza; con `TOKEN_LECTURA` vacía o igual a `TOKEN`, la lectura queda desactivada |
| H4 | Paquete formato 2: PBKDF2-HMAC-SHA256 con 600 000 iteraciones (valor de OWASP) y cabecera autenticada; los paquetes del formato 1 se siguen abriendo | R1, R9 | `sync.js` | `registro.test.js` (formato 2, compatibilidad, cabecera alterada) |
| H5 | Un solo botón de borrado («Borrar los datos de este celular»): pide BORRAR, avisa lo no enviado y, si hay algo, antes descarga un respaldo cifrado; eliminar un relevamiento sin copia avisa que se pierde. Se eligió un botón único por simplicidad para el equipo | R4 | `app.js` | `recorrido_e2e.py` (con uno sin enviar, avisa y descarga el respaldo antes de borrar) |
| H6 | Huella del archivo (SHA-256, 8 caracteres) para confirmar que la administradora recibió el mismo archivo | Integridad y recepción | `sync.js`, `app.js` | `recorrido_e2e.py`: la huella del encuestador coincide con la de la importación |
| H7 | El script no pisa una versión más nueva con una más vieja | R5 | `Codigo.gs` | `apps_script.test.js` |
| H8 | Registro de operaciones: en el dispositivo (iniciar, finalizar, enviar, paquete, respaldo, importar, rechazar, borrar) y en la hoja Registro (envíos y lecturas), sin respuestas, contactos ni claves | R8 | `app.js`, `Codigo.gs` | `apps_script.test.js` y `recorrido_e2e.py` verifican que no aparezcan celulares ni códigos |
| H9 | CSV y contactos solo en Administración, con aviso de que no están cifrados | R2 | `app.js`, `config.js` | `recorrido_e2e.py`: el cierre ya no ofrece el CSV |
| H10 | Campos sin corrector ortográfico | R10 | `app.js` | Inspección del HTML |
| H11 | N° de orden único en el dispositivo y aviso en el tablero de códigos repetidos | Duplicados | `app.js`, `datos.js`, `tablero.js` | `recorrido_e2e.py`, `tablero_e2e.py` |

### Propuestos (no implementados)

| N° | Cambio | Impacto | Costo | Qué resuelve | Dónde | Cómo se comprueba |
|---|---|---|---|---|---|---|
| P1 | **Cambiar la clave del equipo** por una al azar (por ejemplo, cinco palabras sin relación), crear la clave de lectura, entregarlas en persona y no escribirlas en la guía. Cambiarlas en cada campaña y cuando alguien deja el equipo | Alto | Bajo (organizativo) | R1, R15 | `Codigo.gs` (constantes), Ajustes de cada celular, tablero | «Probar conexión» dice «script 1.4»; el tablero no lee con la clave del equipo |
| P2 | **Contactos en una planilla privada** (`ID_PLANILLA_CONTACTOS`) y revisión de con quién está compartida la planilla | Alto | Bajo | R6 | `Codigo.gs` | Con una cuenta lectora no se ven correos ni celulares |
| P3 | **Reglas para los dispositivos**: bloqueo de pantalla, Android 10 o posterior, depuración USB desactivada, celular no compartido, Chrome actualizado, sincronizar antes de borrar; en la PC, disco cifrado | Alto | Bajo (organizativo) | R7 | Guía del encuestador | Lista de control antes de salir al campo |
| P4 | **GitHub**: verificación en dos pasos, pocas personas con escritura y ninguna otra página publicada en la cuenta del proyecto | Medio | Bajo | R11 | Configuración de GitHub | Revisión de miembros y de la configuración de Pages |
| P5 | **Paquetes con clave pública** (sección 5) | Medio | Medio | R1, en la parte de los paquetes | `sync.js`, Ajustes, `config.js`, pruebas | Un celular no puede abrir un paquete; la PC con la clave privada sí |
| P6 | Tipografías dentro de la app (licencia OFL), sin pedirlas a Google; CSP más estricta | Bajo | Bajo | R12 | `index.html`, `estilos.css`, `sw.js` | La app funciona sin pedir nada a Google |
| P7 | CSV protegido contra fórmulas: anteponer `'` a los textos que empiezan con `=`, `+`, `-` o `@` | Bajo | Bajo | R14 | `registro.js` (`csv`), `datos.js` (`aCsv`) | Prueba unitaria |
| P8 | Descargar el registro de operaciones e incluirlo en el respaldo | Bajo | Bajo | Trazabilidad | `app.js` | Prueba de punta a punta |

## 5. Gestión de claves: compartida o pública y privada

**Cómo lo hacen KoboToolbox y ODK.** El formulario lleva una clave pública RSA (los manuales sugieren 2048 bits). Al finalizar cada envío, el dispositivo genera una clave simétrica aleatoria de 256 bits, cifra los datos y cifra esa clave con la pública. Solo quien tiene la clave privada descifra, y lo hace en su computadora; el servidor guarda datos que no puede leer.

Limitaciones que reconocen los propios manuales:

- Los borradores sin finalizar no se cifran, y Collect no puede garantizar que se borren todas las copias sin cifrar.
- No se puede ver ni editar el contenido en el servidor.
- En ODK Central, si se pierde la frase de la clave «no hay forma de recuperarla» ni de descifrar los datos.
- El cifrado no impide envíos falsos ni el reemplazo completo de un envío.

| | A. Clave compartida reforzada (como quedó en la 1.4) | B. Clave pública en los celulares, privada en la administración |
|---|---|---|
| Qué cifra | Paquetes y respaldos, con la clave del equipo | Paquetes y respaldos: clave AES aleatoria por paquete, envuelta con la pública (RSA-OAEP o ECDH, disponibles en Web Crypto, sin bibliotecas) |
| Un celular perdido o la guía filtrada | Permite abrir cualquier paquete que se consiga | No permite abrir paquetes: la pública solo cifra |
| Pérdida de la clave | Poco probable: la conoce el equipo | **Punto único de falla**: sin la privada, los paquetes no se abren. Lo que ya está en la planilla no se pierde. Hacen falta dos copias custodiadas (administración y dirección del proyecto) |
| Recuperación | Cualquier PC con la clave | Solo la PC con la clave privada (archivo protegido con una frase) |
| Revocar a una persona | Hay que cambiar la clave en todos los celulares; los paquetes viejos siguen abiertos para quien la tenía | La persona nunca tuvo con qué descifrar: no hace falta revocar nada. Para rotar el par, se publica la pública nueva con la app |
| Complejidad | Baja | Media: generar el par, guardar la privada, importarla en la PC |
| Qué no resuelve ninguna | Los datos en claro en el celular mientras se releva, y la planilla de Google, que recibe los datos en claro (cifrarlos ahí impediría el tablero, igual que en Kobo con cifrado) | Ídem |

**Recomendación.** Para la próxima campaña alcanza con la opción A, siempre que se haga P1: clave al azar, entregada en persona y fuera de la guía. Con la clave de lectura aparte, el riesgo mayor de la clave compartida ya no es leer la planilla sino abrir paquetes, que son el camino secundario (el principal es enviar con señal).

Conviene pasar a la opción B si:

- se suman encuestadores temporales o el equipo crece;
- los paquetes pasan a ser el camino habitual;
- un comité de ética lo pide.

Es una decisión del equipo, por la custodia de la clave privada.

## 6. Flujo de transferencia, respaldo y borrado

1. **Durante la entrevista**, todo queda en el celular. Quien inicia una entrevista la termina en el mismo celular.
2. **Con señal**: *Sincronizar*. La planilla confirma cada `id`, y el relevamiento queda con **copia confirmada**.
3. **Sin señal**: *Compartir paquete del día* (cifrado). El encuestador manda el archivo **y la huella** por un chat individual con la administradora, o lo deja en una carpeta de Drive institucional restringida.
4. **La administradora** importa el paquete, compara la huella, responde «recibido J1 3F9A-21C7» y toca *Enviar todo a la planilla*. Si el paquete no abre o la huella no coincide, pide que lo reenvíen.
5. **El encuestador**, cuando tiene señal, sincroniza igual. El script no duplica ni pisa versiones más nuevas, y recién ahí su copia queda confirmada.
6. **Borrar el celular** (después de la práctica o al cierre del trabajo de campo): *Borrar los datos de este celular*. Antes, sincronizar; si queda algo sin enviar, la app avisa y descarga un respaldo cifrado. Durante la práctica, escribir «Prueba» en el puesto para reconocer esos relevamientos en la planilla.
7. **Paquetes recibidos**: después de importarlos y enviarlos, se pueden borrar de WhatsApp y de Descargas. Para guardar un respaldo, conviene una carpeta cifrada.
8. **Si se pierde un celular**:
   - lo sincronizado está en la planilla;
   - lo empaquetado, en la PC de la administradora;
   - lo demás se pierde.

   Por eso se sincroniza o se empaqueta todos los días. Si el celular no tenía bloqueo, hay que cambiar la clave del equipo.
9. **Duplicados**:
   - por `id`, la planilla los actualiza y la importación los une;
   - por N° de orden, el dispositivo los bloquea;
   - por código, el tablero los marca para revisar.

**Sobre el borrado**: borrar en IndexedDB no garantiza que se borre físicamente del almacenamiento del teléfono. En Android con cifrado por archivo, lo borrado no se puede leer sin desbloquear el equipo. Antes de dar de baja un celular, se hace un restablecimiento de fábrica.

## 7. Módulo de análisis

1. **Fuente consolidada**: la planilla de Google (hoja Datos), en una cuenta institucional con acceso restringido.
2. **Entorno autorizado**: la PC de análisis. El tablero lee la hoja Datos (con la clave de lectura) o el .xlsx descargado, procesa todo en memoria y no sube nada. La política de contenido solo le permite conectarse al script de Google.
3. **Validación**:
   - unión por `id`;
   - consolidación por `participante_id`;
   - aviso de códigos repetidos;
   - recálculo de IMC, FINDRISK y Framingham con las mismas funciones de la app, que deja ver diferencias con lo registrado.
4. **Conjunto analítico**: el CSV filtrado del tablero, sin contactos, que se analiza con herramientas gratuitas (R, Python, JASP, Jamovi o PSPP) en la misma PC, en una carpeta cifrada.
5. **Difusión**: solo resultados agregados, sin códigos. Conviene evitar cruces con muy pocas personas (por ejemplo, menos de 5) que permitan reconocer a alguien. Los resultados de salud reales no se difunden sin consentimiento y sin la revisión de un comité de ética.
6. **Qué no hacer**:
   - subir CSV o planillas descargadas a carpetas compartidas;
   - mandarlos por WhatsApp;
   - cargar datos identificables en servicios en línea sin acuerdo con la institución, incluidos los asistentes de inteligencia artificial.

## 8. Pruebas de seguridad y recuperación

| Caso | Cómo | Resultado esperado | ¿Automática? |
|---|---|---|---|
| Cifrado y descifrado | Paquete de ida y vuelta | Abre con la clave correcta y no con otra | Sí (`registro.test.js`) |
| Archivo alterado | Cambiar la cantidad, el equipo o un byte de los datos | «el archivo fue modificado o está dañado» | Sí (`registro.test.js`, `recorrido_e2e.py`) |
| Archivo incompleto | Cortar el archivo a la mitad | «dañado o incompleto» | Sí |
| Paquete sin cifrar | Importar un paquete con `cifrado:false` | Se rechaza | Sí |
| Compatibilidad | Paquete de la 1.3 | Abre | Sí |
| Registros maliciosos | `id` con código HTML, fecha inválida | Se descartan y se informa cuántos | Sí |
| Pérdida de conectividad | Abrir la app sin señal | Funciona | Sí (`recorrido_e2e.py`) |
| Envío interrumpido | Modo avión durante *Sincronizar* | Mensaje de error; los relevamientos siguen pendientes y se reenvían | Manual |
| Cierre inesperado | Cerrar la app a mitad de una sección y reabrirla | Están las respuestas hasta el último cambio | Manual |
| Pérdida de un dispositivo (simulacro) | Celular de prueba con 3 relevamientos: 2 sincronizados y 1 en paquete; borrar los datos de Chrome | Los 3 aparecen en la planilla o en la PC | Manual |
| Recuperación desde respaldo | Respaldo cifrado e importación en otra PC | Misma cantidad y misma huella | Manual (la importación está automatizada) |
| Duplicados | El mismo paquete dos veces; una versión vieja después de una nueva; el mismo N° de orden; el mismo código en dos relevamientos | «ya estaban»; no se pisa; se bloquea; aviso en el tablero | Sí |
| Pérdida de clave | Paquete con una clave desconocida | No abre; lo enviado a la planilla no se afecta | Sí; además, procedimiento para guardar la clave vieja |
| Borrado seguro | Borrar con relevamientos pendientes | Avisa cuántos no se enviaron y descarga un respaldo cifrado antes de borrar | Sí |
| Lectura no autorizada | El tablero con la clave de los celulares | Se rechaza | Sí (`apps_script.test.js`) |
| Registro sin datos personales | Revisar la bitácora y la hoja Registro | Sin celulares ni códigos | Sí |
| Política de contenido | App y tablero completos | Sin errores de consola | Sí |

## 9. Aspectos organizativos y legales para revisar con la institución

- **Ley 25.326 de Protección de los Datos Personales.** Los datos de salud son datos sensibles. Hay que revisar:
  - el consentimiento;
  - las medidas de seguridad y confidencialidad;
  - la inscripción de la base ante la autoridad de aplicación, si corresponde;
  - el almacenamiento en servicios de Google, que puede implicar una transferencia internacional.
- **Investigación en salud.** Hay que presentar el protocolo y el consentimiento ante un comité de ética en investigación. La Guía para Investigaciones con Seres Humanos (Resolución 1480/2011 del Ministerio de Salud de la Nación) y la normativa provincial que corresponda orientan esa presentación. Hoy no hay protocolo presentado.
- **Responsables, plazos y bajas.** Hay que definir:
  - quién custodia las claves;
  - quién tiene acceso a la planilla y a los contactos;
  - cuánto tiempo se conservan los contactos;
  - cómo se dan de baja los accesos cuando alguien deja el equipo.

## 10. Fuentes

- [NIST SP 800-38D: Galois/Counter Mode (GCM) and GMAC](https://csrc.nist.gov/pubs/sp/800/38/d/final)
- [OWASP Password Storage Cheat Sheet (PBKDF2-HMAC-SHA256: 600 000 iteraciones)](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [ODK: Encrypted Forms](https://docs.getodk.org/encrypted-forms/)
- [ODK: Encrypted Forms in Central](https://docs.getodk.org/central-encryption/)
- [KoboToolbox: Encrypting Forms](https://support.kobotoolbox.org/encrypting_forms.html)
- [Android: Encryption / File-based encryption](https://source.android.com/docs/security/encryption)
- [Resolución 1480/2011 del Ministerio de Salud de la Nación (Guía para Investigaciones con Seres Humanos)](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1480-2011-187206/actualizacion)
