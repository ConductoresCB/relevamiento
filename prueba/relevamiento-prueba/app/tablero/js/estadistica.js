/*
 * estadistica.js — Descriptivos y pruebas para el tablero (sin dependencias).
 * Se usa en el navegador (window.Estadistica) y en Node para las pruebas.
 * Las funciones especiales (gamma y beta incompletas) siguen los algoritmos clásicos
 * de Numerical Recipes; las pruebas comparan contra SciPy (tests/estadistica.test.js).
 */
(function (raiz) {
  'use strict';

  function limpios(xs) { return xs.filter(function (x) { return typeof x === 'number' && isFinite(x); }); }

  function media(xs) { xs = limpios(xs); if (!xs.length) return null; return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; }

  /* Desvío estándar muestral (n − 1). */
  function desvio(xs) {
    xs = limpios(xs); if (xs.length < 2) return null;
    var m = media(xs), s = 0;
    xs.forEach(function (x) { s += (x - m) * (x - m); });
    return Math.sqrt(s / (xs.length - 1));
  }

  /* Cuantil con interpolación lineal (tipo 7, el de Excel y R por defecto). */
  function cuantil(xs, p) {
    xs = limpios(xs).slice().sort(function (a, b) { return a - b; });
    if (!xs.length) return null;
    var h = (xs.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return xs[lo] + (h - lo) * (xs[hi] - xs[lo]);
  }

  function resumen(xs) {
    xs = limpios(xs);
    if (!xs.length) return { n: 0 };
    return { n: xs.length, media: media(xs), de: desvio(xs), mediana: cuantil(xs, 0.5), q1: cuantil(xs, 0.25),
      q3: cuantil(xs, 0.75), min: Math.min.apply(null, xs), max: Math.max.apply(null, xs) };
  }

  /* ---------- Funciones especiales ---------- */
  function gammaln(x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
      0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    var ser = 1.000000000190015;
    for (var j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  /* Gamma incompleta regularizada superior Q(a, x). */
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    if (x < a + 1) { // serie
      var ap = a, sum = 1 / a, del = sum;
      for (var n = 0; n < 500; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-15) break; }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
    }
    // fracción continua
    var b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (var i = 1; i < 500; i++) {
      var an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; var del2 = d * c; h *= del2;
      if (Math.abs(del2 - 1) < 1e-15) break;
    }
    return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
  }

  function betacf(a, b, x) {
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    d = 1 / d; var h = d;
    for (var m = 1; m <= 500; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; var del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
  }

  /* Beta incompleta regularizada I_x(a, b). */
  function betaI(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }

  /* p bilateral de una t de Student con gl grados de libertad. */
  function pT(t, gl) { return betaI(gl / 2, 0.5, gl / (gl + t * t)); }

  /* ---------- Chi cuadrado de independencia ---------- */
  function chiCuadrado(tabla) {
    var f = tabla.length, c = tabla[0] ? tabla[0].length : 0;
    var totF = tabla.map(function (r) { return r.reduce(function (a, b) { return a + b; }, 0); });
    var totC = []; for (var j = 0; j < c; j++) totC.push(tabla.reduce(function (a, r) { return a + r[j]; }, 0));
    var N = totF.reduce(function (a, b) { return a + b; }, 0);
    // Se descartan filas y columnas vacías
    var fi = totF.map(function (t, i) { return t > 0 ? i : -1; }).filter(function (i) { return i >= 0; });
    var cj = totC.map(function (t, j) { return t > 0 ? j : -1; }).filter(function (j) { return j >= 0; });
    if (fi.length < 2 || cj.length < 2 || !N) return null;
    var chi = 0, bajas = 0, celdas = 0, minEsp = Infinity;
    fi.forEach(function (i) {
      cj.forEach(function (j) {
        var e = totF[i] * totC[j] / N; celdas++;
        if (e < 5) bajas++;
        if (e < minEsp) minEsp = e;
        chi += (tabla[i][j] - e) * (tabla[i][j] - e) / e;
      });
    });
    var gl = (fi.length - 1) * (cj.length - 1);
    return { chi2: chi, gl: gl, p: gammaQ(gl / 2, chi / 2), N: N, celdasBajas: bajas, celdas: celdas,
      propBajas: bajas / celdas, minEsperada: minEsp, vCramer: Math.sqrt(chi / (N * (Math.min(fi.length, cj.length) - 1))) };
  }

  /* ---------- Prueba exacta de Fisher (2 × 2, bilateral) ---------- */
  function lnFact(n) { return gammaln(n + 1); }
  function fisher2x2(a, b, c, d) {
    var f1 = a + b, f2 = c + d, c1 = a + c, N = a + b + c + d;
    function prob(x) {
      return Math.exp(lnFact(f1) + lnFact(f2) + lnFact(c1) + lnFact(N - c1) - lnFact(N) -
        lnFact(x) - lnFact(f1 - x) - lnFact(c1 - x) - lnFact(f2 - c1 + x));
    }
    var obs = prob(a), p = 0;
    var lo = Math.max(0, c1 - f2), hi = Math.min(f1, c1);
    for (var x = lo; x <= hi; x++) { var px = prob(x); if (px <= obs * (1 + 1e-7)) p += px; }
    return Math.min(1, p);
  }

  /* ---------- Correlación ---------- */
  function pares(xs, ys) {
    var px = [], py = [];
    for (var i = 0; i < xs.length; i++) {
      if (typeof xs[i] === 'number' && isFinite(xs[i]) && typeof ys[i] === 'number' && isFinite(ys[i])) { px.push(xs[i]); py.push(ys[i]); }
    }
    return [px, py];
  }

  function pearson(xs, ys) {
    var p = pares(xs, ys); xs = p[0]; ys = p[1];
    var n = xs.length; if (n < 3) return null;
    var mx = media(xs), my = media(ys), sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
    if (!sxx || !syy) return null;
    var r = sxy / Math.sqrt(sxx * syy);
    r = Math.max(-1, Math.min(1, r));
    var gl = n - 2, t = Math.abs(r) === 1 ? Infinity : r * Math.sqrt(gl / (1 - r * r));
    return { r: r, n: n, p: isFinite(t) ? pT(t, gl) : 0, pendiente: sxy / sxx, ordenada: my - (sxy / sxx) * mx };
  }

  function rangos(xs) {
    var idx = xs.map(function (x, i) { return [x, i]; }).sort(function (a, b) { return a[0] - b[0]; });
    var r = new Array(xs.length), i = 0;
    while (i < idx.length) {
      var j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      var prom = (i + j) / 2 + 1;
      for (var k = i; k <= j; k++) r[idx[k][1]] = prom;
      i = j + 1;
    }
    return r;
  }

  /* Spearman: Pearson sobre rangos; p con la aproximación t (la misma que usa SciPy). */
  function spearman(xs, ys) {
    var p = pares(xs, ys); if (p[0].length < 3) return null;
    var res = pearson(rangos(p[0]), rangos(p[1]));
    return res && { rho: res.r, n: res.n, p: res.p };
  }

  /* Cortes "lindos" para ejes e histogramas. */
  function pasoLindo(rango, objetivo) {
    var bruto = rango / Math.max(1, objetivo), mag = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    var r = bruto / mag;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
  }
  function ejeLindo(min, max, objetivo) {
    if (min === max) { min = min - 1; max = max + 1; }
    var paso = pasoLindo(max - min, objetivo || 5);
    var a = Math.floor(min / paso) * paso, b = Math.ceil(max / paso) * paso, marcas = [];
    for (var v = a; v <= b + paso / 1e6; v += paso) marcas.push(Math.round(v / paso) * paso);
    return { min: a, max: b, paso: paso, marcas: marcas };
  }

  function histograma(xs, objetivo) {
    xs = limpios(xs); if (!xs.length) return [];
    var mn = Math.min.apply(null, xs), mx = Math.max.apply(null, xs);
    var paso = pasoLindo((mx - mn) || 1, objetivo || Math.min(10, Math.max(4, Math.ceil(Math.sqrt(xs.length)))));
    var a = Math.floor(mn / paso) * paso, cajas = [];
    for (var v = a; v <= mx; v += paso) cajas.push({ desde: v, hasta: v + paso, n: 0 });
    if (!cajas.length) cajas.push({ desde: a, hasta: a + paso, n: 0 });
    xs.forEach(function (x) {
      var k = Math.min(cajas.length - 1, Math.floor((x - a) / paso + 1e-9));
      cajas[k].n++;
    });
    return cajas;
  }

  var api = { media: media, desvio: desvio, cuantil: cuantil, resumen: resumen, gammaQ: gammaQ, betaI: betaI, pT: pT,
    chiCuadrado: chiCuadrado, fisher2x2: fisher2x2, pearson: pearson, spearman: spearman, rangos: rangos,
    ejeLindo: ejeLindo, histograma: histograma };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Estadistica = api;
})(typeof window !== 'undefined' ? window : this);
