# Decisiones del equipo y cambios pendientes

Prioridades: **simplicidad y seguridad**. No se publica una versión nueva hasta cerrar la semana de pruebas de uso del equipo.

## Decisiones (10/10/2026)

- No se entrevista dos veces al mismo camionero (política del grupo).
- Quien inicia una entrevista la termina, con el mismo celular y con la batería llena.
- La app no consulta la planilla: guarda en el celular y envía a la planilla. Las búsquedas son siempre locales. La consulta entre encuestadores se hace en el tablero (PC, con la clave del equipo).

## Hecho en la versión 1.4.0 (11/10/2026)

1. ✔ El **código largo** (orden-edad-CP, p. ej. 811-44-4600) es lo que se ve: placa de cada pantalla, buscador y listas. El ID interno no se muestra.
2. ✔ Sin «¿Participó antes?» ni búsqueda para vincular. Los duplicados que se escapen se marcan en el tablero (Fuentes: «códigos que aparecen en más de un relevamiento»).
3. ✔ Sin la tarjeta del ID ni el pedido de foto en Resultados (el código queda en la placa de arriba).
4. ✔ El ID interno se deriva del N° de orden (`J1-0811`, como la previa `P1-0014`). El N° de orden no puede repetirse en el dispositivo.
5. ✔ Preguntas 4 y 5 con «Ninguna»; pregunta 8 por el país de la licencia, sin categoría (pedidos del equipo).
6. ✔ Presión arterial diastólica en la biológica (pedido del equipo). No cambia ningún cálculo.
7. ✔ Mejoras de seguridad de bajo costo (ver `docs/REVISION_SEGURIDAD.md`).

## Para decidir con el equipo

- **Claves**: seguir con la clave compartida (reforzada y con una clave de lectura aparte, como quedó en la 1.4) o pasar los paquetes a clave pública y privada, como KoboToolbox y ODK. Comparación en `docs/REVISION_SEGURIDAD.md`, sección 5.
- ¿La diastólica debe contar para «Bio completo»? En la 1.4 cuenta (igual que la sistólica). Se cambia en `BIO_OBLIGATORIOS` (`app/js/registro.js`).
- ¿Agregar al tablero una variable derivada «diastólica de 90 mmHg o más», como la de sistólica ≥ 140? Es una regla de análisis: requiere la autorización del equipo.
- La previa tiene diastólicas en algunas transcripciones (120/80, 145/81, 160/90). Si el equipo lo autoriza, se cargan; regenerar la previa corre `imc_mayor25` de la columna DC a la DD.

## Descartado por ahora

- Continuar en otro celular una entrevista empezada por un compañero.
- Que la app busque participantes en la planilla del equipo (requiere señal y expone más datos en cada celular).
