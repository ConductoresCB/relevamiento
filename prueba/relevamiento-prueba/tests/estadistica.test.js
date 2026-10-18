// Compara las funciones del tablero con valores de referencia calculados con SciPy 1.18.
// Uso: node tests/estadistica.test.js tests/ref_scipy.json
const E = require('../app/tablero/js/estadistica.js');
const ref = require(require('path').resolve(process.argv[2] || __dirname + '/ref_scipy.json'));
let ok = 0, mal = 0;
const cerca = (a, b, tol, que) => { if (Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))) ok++; else { mal++; console.log('FALLA', que, a, b); } };
ref.chi.forEach(([t, c, p, gl], i) => { const r = E.chiCuadrado(t); cerca(r.chi2, c, 1e-9, 'chi2 ' + i); cerca(r.p, p, 1e-6, 'p chi ' + i); cerca(r.gl, gl, 0, 'gl ' + i); });
ref.fisher.forEach(([t, p], i) => cerca(E.fisher2x2(t[0][0], t[0][1], t[1][0], t[1][1]), p, 1e-6, 'fisher ' + i));
ref.corr.forEach(([x, y, r, p, rho, ps], i) => {
  const a = E.pearson(x, y), b = E.spearman(x, y);
  cerca(a.r, r, 1e-9, 'r ' + i); cerca(a.p, p, 1e-6, 'p r ' + i); cerca(b.rho, rho, 1e-9, 'rho ' + i); cerca(b.p, ps, 1e-6, 'p rho ' + i);
});
const [xs, m, sd, q1, med, q3] = ref.desc; const s = E.resumen(xs);
cerca(s.media, m, 1e-12, 'media'); cerca(s.de, sd, 1e-12, 'de'); cerca(s.q1, q1, 1e-12, 'q1'); cerca(s.mediana, med, 1e-12, 'mediana'); cerca(s.q3, q3, 1e-12, 'q3');
console.log(`estadística: ${ok} comparaciones correctas, ${mal} fallas`);
process.exit(mal ? 1 : 0);
