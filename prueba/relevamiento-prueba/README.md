# Relevamiento · Corredor Bioceánico Jujuy · versión 1.4.0

**Empezá por acá**

| Si querés… | Abrí |
|---|---|
| Hacer la prueba completa paso a paso | La guía «Guía de prueba paso a paso · Relevamiento Corredor Bioceánico» (en Claude; exportable a PDF o Word) |
| Cambiar textos, nombres de botones o etapas | `app/js/config.js` (instrucciones adentro) |
| Cambiar preguntas u opciones | `app/js/cuestionario.js` y la receta en `docs/MANUAL_TECNICO.md` |
| Pedir un cambio a Claude o a quien programe | `docs/CONTEXTO_PARA_PEDIR_CAMBIOS.md` (adjuntalo junto con este zip) |
| Ver qué cambió en cada versión | `CAMBIOS.md` |
| Revisar la seguridad y el cuidado de los datos | `docs/REVISION_SEGURIDAD.md` |

Sistema gratuito para relevar la encuesta sociodemográfica y biológica de conductores de camiones con celulares Android, **sin señal**, y consolidar todo en una planilla con tablero automático.

```
Celular Android (app instalada, sin señal)
   │  guarda cada relevamiento en el propio equipo
   ├─ con señal ──► botón "Sincronizar" ──► Apps Script ──► Planilla de Google (Datos + Contactos + Tablero)
   └─ sin señal ──► "Compartir paquete" (archivo cifrado por WhatsApp/correo/Drive)
                       └─► PC de la administradora: la misma app importa los paquetes y sincroniza
Planilla de Google ──► se comparte como lector con el equipo · se descarga como Excel · la lee la app de camioneros
```

Costo: $0. Requiere una cuenta de Gmail del proyecto y una cuenta gratuita de GitHub (solo para publicar la app; ahí no se guardan datos).

## Contenido

| Carpeta | Qué es |
|---|---|
| `app/` | La app de campo (HTML, CSS y JavaScript sin dependencias). Se publica tal cual. |
| `app/js/config.js` | **Textos y nombres de la interfaz**, etapas, rangos válidos, recomendaciones y número de versión. |
| `app/js/cuestionario.js` | **El instrumento.** Preguntas, opciones y saltos. Es el único archivo a tocar para cambiar preguntas. |
| `app/js/calculos.js` | IMC, FINDRISK, Framingham con IMC y horas de ayuno (tablas del protocolo). |
| `app/tablero/` | **Tablero web de análisis** (se publica con la app; dirección terminada en `/tablero/`). Carga planillas, filtra, cruza y descarga gráficos. Abre con datos ficticios. |
| `apps-script/Codigo.gs` | Script que recibe los datos en la planilla de Google. Desde 1.3 deja que el tablero los lea; desde 1.4 se puede exigir una clave de lectura aparte. |
| `previo/` | Planilla previa armada con las entrevistas transcriptas y su generador. |
| `planilla/Base_Relevamiento_Tablero.xlsx` | Planilla base con hojas Datos, Contactos, Diccionario y Tablero (fórmulas y gráficos). |
| `planilla/Tablero_DEMO_datos_ficticios.xlsx` | La misma planilla con 126 relevamientos **ficticios** para ver el tablero funcionando. |
| `tests/` | Pruebas automáticas (cálculos, modelo de datos, script y recorrido completo en navegador). |
| `docs/` | Manual técnico con recetas de cambio y contexto para pedir modificaciones. |

## Puesta en marcha (una sola vez)

### 1. Planilla de Google y script

1. Subí `planilla/Base_Relevamiento_Tablero.xlsx` al Drive de la cuenta del proyecto, abrila con Hojas de cálculo de Google y guardala como Hoja de cálculo de Google (Archivo › Guardar como Hojas de cálculo de Google).
2. En esa planilla: **Extensiones › Apps Script**. Borrá el contenido, pegá `apps-script/Codigo.gs` y completá `const TOKEN = '...'` con una clave larga (la de los celulares). `const TOKEN_LECTURA` es opcional: vacía, el tablero lee con la misma clave; con una clave distinta, solo esa permite leer.
3. **Implementar › Nueva implementación**, tipo **Aplicación web**. *Ejecutar como:* Yo. *Quién tiene acceso:* Cualquier usuario. Autorizá los permisos que pide Google.
4. Copiá la URL que termina en `/exec`.
5. Contactos: proteger una hoja impide editarla, pero **no impide verla**. Para que el equipo no vea correos ni celulares, mandalos a una planilla privada aparte (`ID_PLANILLA_CONTACTOS`, receta en `docs/MANUAL_TECNICO.md`). Compartí la planilla principal solo con quien la necesite, como **Lector**.

> Si después modificás el script: Implementar › Administrar implementaciones › editar › Nueva versión. La URL no cambia.

### 2. Publicar la app (GitHub Pages, gratis)

1. Creá un repositorio público en GitHub (por ejemplo `relevamiento`).
2. Subí **el contenido de la carpeta `app/`** (que `index.html` quede en la raíz del repositorio).
3. Settings › Pages › *Deploy from a branch* › rama `main`, carpeta `/ (root)`.
4. En uno o dos minutos la app queda en `https://<usuario>.github.io/relevamiento/`.

El repositorio solo tiene código: la URL del script y la clave se cargan en cada celular, no en el código.

### 3. Instalar en cada celular Android

1. Con internet, abrí la dirección de la app en **Chrome**.
2. Menú ⋮ › **Instalar app** (o *Agregar a pantalla principal*). Queda un ícono como cualquier aplicación.
3. Abrila una vez con internet (guarda las tipografías y todo lo necesario para funcionar sin señal).
4. **Ajustes** (ícono arriba a la derecha): equipo, número de dispositivo, **rango de números de orden propio** (A1: 001–199, A2: 200–399, B1: 400–599…), encuestador/a, puesto, URL del script y clave del equipo. Tocá **Probar conexión**: tiene que decir «script 1.4».
5. El celular tiene que tener **bloqueo de pantalla** (PIN o patrón) y no compartirse con otras personas.

En tablets y en la PC de la administradora se usa la misma dirección (en PC, Chrome › Instalar).

## Uso diario

1. **Nuevo relevamiento** › código (orden sugerido + edad + CP) › contacto › consentimiento.
2. **Sociodemográfica**: 7 secciones, 39 preguntas; los saltos se aplican solos.
3. **Biológica**: mediciones (incluida la presión sistólica y la diastólica), antecedentes y glucometría. IMC, FINDRISK, Framingham y ayuno se calculan en el momento; la diastólica se registra y no entra en esos cálculos.
4. **Resultados** › *Guardar y volver*.
5. Al terminar el día: **Cerrar jornada** › *Sincronizar ahora* (con señal) o *Compartir paquete del día* (sin señal). Con el paquete, mandá la **huella** que muestra la app (p. ej. `3F9A-21C7`).
6. Administradora: en la PC, *Ajustes › Importar paquetes* › elegir los archivos recibidos › comparar la huella con la que mandó el encuestador › *Enviar todo a la planilla*.

No se entrevista dos veces a la misma persona: se pregunta antes de empezar y, si ya participó, no se inicia el relevamiento. En pantalla se usa el **código** (orden-edad-CP); el ID interno (`J1-0811`: equipo, dispositivo y N° de orden) no se muestra. Si se escapa un duplicado, el tablero avisa cuando el mismo código aparece en dos relevamientos.

### Sin Google (solo Excel)

En la PC de la administradora, después de importar los paquetes: *Descargar CSV consolidado*. En Excel: Datos › Obtener datos › Desde texto/CSV (UTF-8, delimitador punto y coma) y pegar las filas desde la celda A2 de la hoja **Datos** de la planilla base. El tablero se recalcula solo.

## Mantenimiento

- **Cambiar preguntas**: editar `app/js/cuestionario.js`. No cambiar el `id` de una pregunta ya usada (es el nombre de la columna). Después:
  `node planilla/exportar_columnas.js 120 && python3 planilla/generar_planilla.py` para regenerar la planilla, y subir `versionApp` en `app/js/config.js` para que los celulares descarguen la nueva versión (la próxima vez que abran la app con señal).
- **Cambiar textos de la interfaz**: `app/js/config.js`, sin tocar el resto del código. Más recetas en `docs/MANUAL_TECNICO.md`.
- **Borrar los datos de un celular** (por ejemplo, después de la práctica): Ajustes › Zona de cuidado › *Borrar los datos de este celular*. Pide escribir BORRAR, avisa cuántos no se enviaron y, si hay alguno, antes descarga un respaldo cifrado. La app nunca borra sola.
- **Práctica**: escribir «Prueba» en el puesto o lugar. Si esos relevamientos se sincronizan, en la planilla y en el tablero se reconocen y se filtran por ese puesto.
- **Pruebas**:
  `node tests/calculos.test.js`, `node tests/registro.test.js`, `node tests/apps_script.test.js`, `node tests/estadistica.test.js`, `python3 tests/recorrido_e2e.py` y `python3 tests/tablero_e2e.py` (requieren Playwright).

## Datos personales y seguridad

- Las respuestas de salud son **datos sensibles** (Ley 25.326). La app no deja avanzar sin registrar el consentimiento. El texto del consentimiento y el protocolo conviene que los revise un comité de ética en investigación antes de usar datos reales; la app no reemplaza esa revisión ni garantiza por sí sola el cumplimiento legal.
- Correo y celular viajan a la hoja **Contactos**, separados de las respuestas. La hoja Datos y el CSV consolidado no los incluyen.
- Los paquetes y respaldos van cifrados (AES-GCM, clave derivada con PBKDF2 de 600 000 iteraciones). Sin la clave del equipo no se generan ni se abren. Los CSV no están cifrados: solo en la computadora de análisis.
- En el celular, los datos quedan en el almacenamiento de la app (protegido por el cifrado del propio Android cuando el teléfono está bloqueado, no por la app): usar bloqueo de pantalla. **No borrar los datos de Chrome** antes de sincronizar.
- Dos claves en el script: la del equipo (enviar) y la de lectura (tablero). Si una se filtra, cambiarla en el script y donde se use.
- Detalle de riesgos, mejoras y pruebas: `docs/REVISION_SEGURIDAD.md`.

## Pendientes del instrumento (decisión del equipo)

- Pregunta 2: «Secundaria incompleta» estaba repetida; en la app quedó «Secundaria completa». No hay opción «Primaria incompleta / sin escolaridad».
- IMC exactamente 30: FINDRISK lo puntúa como «25 a 30» y Framingham como «30 o más», tal como dice el modelo.
- La tabla de Framingham combina puntajes de la versión ATP III con una tabla de IMC propia: verificar la fuente antes de publicar.
- Glucometría: falta definir el criterio de derivación (aparece como «[a definir por el equipo]»).
