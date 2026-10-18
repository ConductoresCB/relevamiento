# Versión de prueba 1.5 · consentimiento, grabación y entrevista integrada

Esta versión es para que los investigadores la prueben y la validen antes de pasarla a todo el equipo. Se publica en una **carpeta aparte** y **no reemplaza** la app que ya usan (1.4.2).

## 1. Publicarla (GitHub)

1. Entrá al repositorio `relevamiento` › **Add file › Upload files**.
2. Arrastrá la carpeta **`prueba`** entera, tal como viene en este zip. GitHub crea la carpeta con todo adentro.
3. Tocá **Commit changes** y esperá uno o dos minutos.
4. La dirección de la versión de prueba es: **https://conductorescb.github.io/relevamiento/prueba/**

No toques nada fuera de la carpeta `prueba`: la app principal sigue igual.

## 2. Instalarla en el celular de quien la prueba

1. Abrí la dirección de prueba en **Chrome**, con señal.
2. Menú ⋮ › **Instalar app**. Queda un ícono aparte, **«Relev. PRUEBA»**. En la pantalla de inicio de la app dice **«Versión de prueba»**.
3. En **Ajustes**, cargá lo mismo que en la app principal: equipo, dispositivo, rango de orden, encuestador, dirección del script y clave. Tocá **Probar conexión**.
4. La primera vez que se graba, Chrome pide permiso para el micrófono: hay que tocar **Permitir**.

**Los datos de la versión de prueba quedan separados de la app principal**, aunque las dos estén en el mismo celular: relevamientos, audios y ajustes son independientes.

## 3. Planilla

- Sincroniza con el mismo script de siempre. Las columnas nuevas se agregan solas **al final** de la hoja Datos:
  - `consent_puncion`, `consent_grabacion` y `consent_firma`: el consentimiento detallado;
  - `audio_archivos` y `audio_minutos`: los audios grabados;
  - `ent_marcas`: el minuto en que empieza cada parte de la grabación;
  - `ent_personal`, `ent_familia`, …, `ent_bioceanico`: cuántas preguntas de cada eje de la entrevista se trataron (por ejemplo 3/4).
- **Para no mezclar las pruebas con los datos reales**, en el campo «Puesto o lugar» escriban **«Prueba»**. Después se filtran y se borran de la planilla por ese puesto. Las filas de prueba también se reconocen por la versión del instrumento, `2026-10-v3-prueba`.
- Los audios **no** van a la planilla: quedan en el celular hasta pasarlos a la computadora.

## 4. Qué cambia en el recorrido

1. **Consentimiento** (antes de la identificación): tres preguntas grandes de Sí/No (participar, punción y grabación) y la casilla «Firmó en papel». Si acepta la grabación, el botón dice **Iniciar grabación y continuar**.
2. **Barra negra «Grabando · 00:00»** arriba de cada pantalla, con el botón Pausa. La app anota sola en qué minuto empieza cada parte.
3. **«Para profundizar»**: al final de cada sección de la encuesta hay un recuadro azul. Se toca para abrirlo, se tildan las preguntas de la guía de entrevista que salieron en la charla y se cierra. Solo están las preguntas de la guía que **no** están en la encuesta.
4. **Antes de terminar** (después de la biológica): las preguntas del corredor bioceánico y la lista de lo que quedó sin tocar. Desde ahí se toca **Detener grabación y ver resultados**.
5. **Resultados**: muestra «Audio guardado» con el nombre del archivo, por ejemplo `817-50-4512_2026-10-17.webm`.
6. **Cierre de jornada › Audios del día**:
   - **Pasar a la computadora**: se comparte o se descarga en la carpeta Descargas del celular, y desde ahí se copia por cable.
   - **Confirmar** que quedaron copiados.
   - **Liberar espacio**: borra solo los ya copiados.
   - **Volver a la jornada**.

## 5. Para que la grabación funcione bien

- **Mientras se graba, no bloquear la pantalla ni cambiar de app.** La app pide que la pantalla no se apague, pero Android puede cortar la grabación si se bloquea. Si se corta, aparece una barra roja **«La grabación se cortó · Seguir grabando»**: se toca y sigue en un archivo nuevo (`…_parte2`).
- Si la app se cierra de golpe, lo grabado hasta ese momento **no se pierde**: al volver a abrirla, la app arma el archivo y lo asocia a su relevamiento.
- Una hora de audio ocupa unos **15 MB**.
- Los archivos son **.webm**. Se escuchan con **VLC** (gratuito) o arrastrándolos a **Chrome**. Algunos reproductores de Windows no los abren. En esos programas la duración puede no aparecer: es normal en este formato.
- Los audios no van en el paquete del día ni en el respaldo cifrado, porque son demasiado grandes para WhatsApp. Se pasan desde «Audios del día».

## 6. Qué conviene que validen los investigadores

- [ ] ¿El orden es el de una entrevista real: consentimiento, identificación, encuesta, biológica, antes de terminar y resultados?
- [ ] ¿Las preguntas de «Para profundizar» de cada sección son las correctas y están en la sección donde suelen salir?
- [ ] ¿Se entiende el recuadro que se abre y se cierra? ¿Los botones tienen buen tamaño?
- [ ] Grabar una entrevista completa de prueba (40 a 60 minutos) en el celular de campo: ¿se cortó? ¿Se escucha bien?
- [ ] Pasar los audios a la computadora y escucharlos.
- [ ] ¿Falta algo del consentimiento? Por ejemplo, el perfil lipídico que menciona el texto y que la app no mide.
- [ ] El texto completo del consentimiento aprobado se puede cargar en `js/config.js` (`consentimientoTexto`) para que aparezca «Ver el texto completo».

## 7. Cosas a tener en cuenta

- Cuando se actualice la app principal, puede borrarse la copia sin señal de la versión de prueba. Se recupera abriéndola una vez con señal. Los datos no se pierden.
- La versión de prueba no tiene tablero propio. En Ajustes, «Abrir el tablero de análisis» abre el tablero de la app principal.
- Cuando esté validada, se pasa a la app principal como versión 1.5 y se borra la carpeta `prueba` de GitHub.
