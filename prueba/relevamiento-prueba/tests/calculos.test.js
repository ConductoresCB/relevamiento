// Pruebas de los cálculos: node tests/calculos.test.js
const assert = require('assert');
const C = require('../app/js/calculos.js');

let ok = 0;
function prueba(nombre, fn) { fn(); ok++; console.log('✔', nombre); }

prueba('IMC con coma o punto decimal', () => {
  assert.strictEqual(C.imc('86,4', '1,72'), 29.2);
  assert.strictEqual(C.imc(92, 1.72), 31.1);
  assert.strictEqual(C.imc('', 1.72), null);
});

prueba('FINDRISK ejemplo 010-44-4600 = 12, Moderado', () => {
  const r = C.findrisk({ edad: 44, sexo: 'Varón', dbt: 'No', imc: 29.2, perimetro: 101,
    actividad: 'No', fyv: 'No', medicacion: 'No', glucosaPrevia: 'No', antecedentes: 'Sí, primer grado' });
  assert.strictEqual(r.puntos, 12);
  assert.strictEqual(r.categoria, 'Moderado');
  assert.strictEqual(r.probabilidad, '17 %');
  assert.ok(r.completo);
});

prueba('FINDRISK P-0042 = 18, Alto', () => {
  const r = C.findrisk({ edad: 58, sexo: 'Varón', dbt: 'No', imc: 31.1, perimetro: 108,
    actividad: 'No', fyv: 'No', medicacion: 'No', glucosaPrevia: 'Sí', antecedentes: 'No' });
  assert.strictEqual(r.puntos, 18);
  assert.strictEqual(r.categoria, 'Alto');
});

prueba('FINDRISK no aplica con diabetes o sexo otro', () => {
  assert.strictEqual(C.findrisk({ dbt: 'Sí', sexo: 'Varón' }).aplica, false);
  assert.strictEqual(C.findrisk({ dbt: 'No', sexo: 'Otro' }).aplica, false);
});

prueba('FINDRISK parcial informa ítems faltantes', () => {
  const r = C.findrisk({ edad: 44, sexo: 'Varón', dbt: 'No', imc: 29.2, perimetro: 101 });
  assert.strictEqual(r.puntos, 4);
  assert.strictEqual(r.faltan.length, 5);
  assert.ok(!r.completo);
});

prueba('FINDRISK perímetro de mujer y cortes de edad', () => {
  const base = { sexo: 'Mujer', dbt: 'No', imc: 24, actividad: 'Sí', fyv: 'Sí', medicacion: 'No', glucosaPrevia: 'No', antecedentes: 'No' };
  assert.strictEqual(C.findrisk({ ...base, edad: 45, perimetro: 79 }).puntos, 2);
  assert.strictEqual(C.findrisk({ ...base, edad: 65, perimetro: 89 }).puntos, 8);
});

prueba('Framingham ejemplo 010-44-4600 = 7 pts, 3 %, Bajo', () => {
  const r = C.framingham({ edad: 44, sexo: 'Varón', imc: 29.2, pas: 138, medicacion: 'No', fuma: 'Sí', dbt: 'No' });
  assert.strictEqual(r.puntos, 7);
  assert.strictEqual(r.riesgo, '3');
  assert.strictEqual(r.categoria, 'Bajo');
});

prueba('Framingham P-0042 = 11 pts, 8 %', () => {
  const r = C.framingham({ edad: 58, sexo: 'Varón', imc: 31.1, pas: 152, medicacion: 'No', fuma: 'No', dbt: 'No' });
  assert.strictEqual(r.puntos, 11);
  assert.strictEqual(r.riesgo, '8');
});

prueba('Framingham mujer con tratamiento, tabaco y diabetes', () => {
  // 62 años: edad 10; IMC 31 (60-69) 5; PAS 150 con tto 5; fuma (60-69) 2; DBT 4 => 26 => ≥30, Alto
  const r = C.framingham({ edad: 62, sexo: 'Mujer', imc: 31, pas: 150, medicacion: 'Sí', fuma: 'Sí', dbt: 'Sí' });
  assert.strictEqual(r.puntos, 26);
  assert.strictEqual(r.riesgo, '≥30');
  assert.strictEqual(r.categoria, 'Alto');
});

prueba('Framingham bordes de tabla', () => {
  assert.strictEqual(C.riesgoFramingham('Varón', -3), '<1');
  assert.strictEqual(C.riesgoFramingham('Varón', 12), '10');
  assert.strictEqual(C.categoriaFramingham('10'), 'Moderado');
  assert.strictEqual(C.riesgoFramingham('Mujer', 8), '<1');
  assert.strictEqual(C.riesgoFramingham('Mujer', 20), '11');
  assert.strictEqual(C.riesgoFramingham('Mujer', 25), '≥30');
  assert.strictEqual(C.categoriaFramingham('22'), 'Alto');
  assert.strictEqual(C.framingham({ edad: 82, sexo: 'Varón' }).aplica, false);
});

prueba('Ayuno, incluido cruce de medianoche', () => {
  assert.strictEqual(C.minutosEntre('08:15', '11:20'), 185);
  assert.strictEqual(C.formatoAyuno(185), '3 h 05 min');
  assert.strictEqual(C.minutosEntre('22:30', '06:00'), 450);
  assert.strictEqual(C.minutosEntre('', '06:00'), null);
});

console.log(`\n${ok} pruebas superadas`);
