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

  /* Kruskal-Wallis (1.7.2): compara una medida numérica entre 2 o más grupos sin suponer distribución normal.
     H con corrección por empates; p con la aproximación chi cuadrado de k − 1 grados de libertad (la misma que SciPy).
     grupos: [[x…], …]. Los grupos vacíos no cuentan. Devuelve null si hay menos de 2 grupos con datos. */
  function kruskalWallis(grupos) {
    var gs = grupos.map(limpios).filter(function (g) { return g.length; });
    if (gs.length < 2) return null;
    var todos = [], de = [];
    gs.forEach(function (g, i) { g.forEach(function (x) { todos.push(x); de.push(i); }); });
    var N = todos.length; if (N < 3) return null;
    var r = rangos(todos), R = gs.map(function () { return 0; });
    r.forEach(function (rk, k) { R[de[k]] += rk; });
    var H = 12 / (N * (N + 1)) * R.reduce(function (a, Ri, i) { return a + Ri * Ri / gs[i].length; }, 0) - 3 * (N + 1);
    // corrección por empates: 1 − Σ(t³ − t) / (N³ − N)
    var cuenta = {}; todos.forEach(function (x) { cuenta[x] = (cuenta[x] || 0) + 1; });
    var T = Object.keys(cuenta).reduce(function (a, k) { var t = cuenta[k]; return a + t * t * t - t; }, 0);
    var C = 1 - T / (N * N * N - N);
    if (C <= 0) return { H: 0, gl: gs.length - 1, p: 1, N: N }; // todos los valores iguales
    H /= C;
    var gl = gs.length - 1;
    return { H: H, gl: gl, p: gammaQ(gl / 2, H / 2), N: N };
  }


  /* =====================================================================
   * 1.9.0 · Pruebas para muestras independientes, paramétricas y no paramétricas.
   * Validadas contra SciPy (ver tests). Todas ignoran valores vacíos o no numéricos.
   * ===================================================================== */

  /* Normal estándar: probabilidad de la cola superior P(Z > z), con la gamma incompleta. */
  function colaNormal(z) {
    if (!isFinite(z)) return z > 0 ? 0 : 1;
    var q = 0.5 * gammaQ(0.5, z * z / 2);
    return z >= 0 ? q : 1 - q;
  }

  /* Cuantil de la normal estándar (algoritmo AS 241 de Wichura, precisión ~1e-16). */
  function cuantilNormal(p) {
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    var q = p - 0.5, r, x;
    if (Math.abs(q) <= 0.425) {
      r = 0.180625 - q * q;
      return q * (((((((2509.0809287301226727 * r + 33430.575583588128105) * r + 67265.770927008700853) * r + 45921.953931549871457) * r +
        13731.693765509461125) * r + 1971.5909503065514427) * r + 133.14166789178437745) * r + 3.387132872796366608) /
        (((((((5226.495278852545925 * r + 28729.085735721942674) * r + 39307.89580009271061) * r + 21213.794301586595867) * r +
        5394.1960214247511077) * r + 687.1870074920579083) * r + 42.313330701600911252) * r + 1);
    }
    r = q < 0 ? p : 1 - p;
    r = Math.sqrt(-Math.log(r));
    if (r <= 5) {
      r -= 1.6;
      x = (((((((7.7454501427834140764e-4 * r + 0.0227238449892691845833) * r + 0.24178072517745061177) * r + 1.27045825245236838258) * r +
        3.64784832476320460504) * r + 5.7694972214606914055) * r + 4.6303378461565452959) * r + 1.42343711074968357734) /
        (((((((1.05075007164441684324e-9 * r + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r + 0.14810397642748007459) * r +
        0.68976733498510000455) * r + 1.6763848301838038494) * r + 2.05319162663775882187) * r + 1);
    } else {
      r -= 5;
      x = (((((((2.01033439929228813265e-7 * r + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r + 0.026532189526576123093) * r +
        0.29656057182850489123) * r + 1.7848265399172913358) * r + 5.4637849111641143699) * r + 6.6579046435011037772) /
        (((((((2.04426310338993978564e-15 * r + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r + 7.868691311456132591e-4) * r +
        0.0148753612908506148525) * r + 0.13692988092273580531) * r + 0.59983220655588793769) * r + 1);
    }
    return q < 0 ? -x : x;
  }

  /* p de una F de Snedecor (cola superior). */
  function pF(F, gl1, gl2) { if (!(F > 0)) return 1; return betaI(gl2 / 2, gl1 / 2, gl2 / (gl2 + gl1 * F)); }

  function polinomio(c, x) { var r = 0; for (var i = c.length - 1; i >= 0; i--) r = r * x + c[i]; return r; }

  /* Shapiro-Wilk (algoritmo AS R94 de Royston, 1995; el mismo que usan R y SciPy). Válido para 3 ≤ n ≤ 5000.
     Hipótesis nula: los datos vienen de una distribución normal. p < 0,05 → se rechaza la normalidad. */
  function shapiroWilk(xs) {
    var x = limpios(xs).slice().sort(function (a, b) { return a - b; }), n = x.length;
    if (n < 3 || n > 5000) return null;
    if (x[n - 1] - x[0] < 1e-12) return null; // todos iguales: no se puede evaluar
    var nn2 = Math.floor(n / 2), a = [], i;
    if (n === 3) a[1] = Math.SQRT1_2;
    else {
      var an25 = n + 0.25, m = [], summ2 = 0;
      for (i = 1; i <= nn2; i++) { m[i] = cuantilNormal((i - 0.375) / an25); summ2 += m[i] * m[i]; }
      summ2 *= 2;
      var ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(n);
      var a1 = polinomio([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rsn) - m[1] / ssumm2, i1, fac;
      if (n > 5) {
        var a2 = -m[2] / ssumm2 + polinomio([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn);
        fac = Math.sqrt((summ2 - 2 * m[1] * m[1] - 2 * m[2] * m[2]) / (1 - 2 * a1 * a1 - 2 * a2 * a2));
        a[2] = a2; i1 = 3;
      } else {
        fac = Math.sqrt((summ2 - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1)); i1 = 2;
      }
      a[1] = a1;
      for (i = i1; i <= nn2; i++) a[i] = -m[i] / fac;
    }
    // W = (Σ a_i (x_(n+1−i) − x_(i)))² / Σ (x − media)²
    var mx = media(x), ss = 0, num = 0;
    x.forEach(function (v) { ss += (v - mx) * (v - mx); });
    for (i = 1; i <= nn2; i++) num += a[i] * (x[n - i] - x[i - 1]);
    var W = Math.min(1, num * num / ss), p;
    if (n === 3) {
      p = Math.max(0, 1.90985931710274 * (Math.asin(Math.sqrt(W)) - 1.04719755119660));
      return { W: W, p: Math.min(1, p), n: n };
    }
    var w1 = Math.log(1 - W), mu, sd;
    if (n <= 11) {
      var gamma = polinomio([-2.273, 0.459], n);
      if (w1 >= gamma) return { W: W, p: 1e-99, n: n };
      w1 = -Math.log(gamma - w1);
      mu = polinomio([0.544, -0.39978, 0.025054, -6.714e-4], n);
      sd = Math.exp(polinomio([1.3822, -0.77857, 0.062767, -0.0020322], n));
    } else {
      var ln = Math.log(n);
      mu = polinomio([-1.5861, -0.31082, -0.083751, 0.0038915], ln);
      sd = Math.exp(polinomio([-0.4803, -0.082676, 0.0030302], ln));
    }
    return { W: W, p: colaNormal((w1 - mu) / sd), n: n };
  }

  /* t de Welch (dos grupos independientes, no supone varianzas iguales). Paramétrica. */
  function tWelch(xa, xb) {
    xa = limpios(xa); xb = limpios(xb);
    var n1 = xa.length, n2 = xb.length; if (n1 < 2 || n2 < 2) return null;
    var v1 = Math.pow(desvio(xa), 2) / n1, v2 = Math.pow(desvio(xb), 2) / n2;
    if (!(v1 + v2 > 0)) return null;
    var t = (media(xa) - media(xb)) / Math.sqrt(v1 + v2);
    var gl = (v1 + v2) * (v1 + v2) / (v1 * v1 / (n1 - 1) + v2 * v2 / (n2 - 1));
    return { t: t, gl: gl, p: pT(t, gl) };
  }

  /* U de Mann-Whitney (dos grupos independientes). No paramétrica.
     Aproximación normal con corrección por empates y por continuidad (SciPy, method='asymptotic'). */
  function mannWhitney(xa, xb) {
    xa = limpios(xa); xb = limpios(xb);
    var n1 = xa.length, n2 = xb.length, N = n1 + n2; if (!n1 || !n2) return null;
    var r = rangos(xa.concat(xb)), R1 = 0;
    for (var i = 0; i < n1; i++) R1 += r[i];
    var U1 = R1 - n1 * (n1 + 1) / 2, U2 = n1 * n2 - U1, mu = n1 * n2 / 2;
    var cuenta = {}; xa.concat(xb).forEach(function (x) { cuenta[x] = (cuenta[x] || 0) + 1; });
    var T = Object.keys(cuenta).reduce(function (s, k) { var t = cuenta[k]; return s + t * t * t - t; }, 0);
    var sd = Math.sqrt(n1 * n2 / 12 * ((N + 1) - T / (N * (N - 1))));
    if (!(sd > 0)) return { U: U1, z: 0, p: 1 };
    var z = (Math.max(U1, U2) - mu - 0.5) / sd;
    return { U: U1, z: z, p: Math.min(1, 2 * colaNormal(z)) };
  }

  /* ANOVA de Welch (2 o más grupos independientes, no supone varianzas iguales). Paramétrica.
     Con 2 grupos coincide con la t de Welch (F = t²). */
  function anovaWelch(grupos) {
    var gs = grupos.map(limpios).filter(function (g) { return g.length; });
    var k = gs.length; if (k < 2) return null;
    if (gs.some(function (g) { return g.length < 2 || !(desvio(g) > 0); })) return null;
    var w = gs.map(function (g) { return g.length / Math.pow(desvio(g), 2); }), m = gs.map(media);
    var W = w.reduce(function (a, b) { return a + b; }, 0);
    var mw = w.reduce(function (a, wi, i) { return a + wi * m[i]; }, 0) / W;
    var A = w.reduce(function (a, wi, i) { return a + wi * (m[i] - mw) * (m[i] - mw); }, 0) / (k - 1);
    var tmp = w.reduce(function (a, wi, i) { return a + Math.pow(1 - wi / W, 2) / (gs[i].length - 1); }, 0);
    var B = 1 + 2 * (k - 2) / (k * k - 1) * tmp;
    var F = A / B, gl1 = k - 1, gl2 = (k * k - 1) / (3 * tmp);
    return { F: F, gl1: gl1, gl2: gl2, p: pF(F, gl1, gl2) };
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
    chiCuadrado: chiCuadrado, fisher2x2: fisher2x2, kruskalWallis: kruskalWallis, pearson: pearson, spearman: spearman, rangos: rangos,
    ejeLindo: ejeLindo, histograma: histograma,
    colaNormal: colaNormal, cuantilNormal: cuantilNormal, pF: pF, shapiroWilk: shapiroWilk, tWelch: tWelch, mannWhitney: mannWhitney, anovaWelch: anovaWelch };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Estadistica = api;
})(typeof window !== 'undefined' ? window : this);
