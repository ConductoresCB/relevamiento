/*
 * graficos.js — Gráficos en SVG hechos a mano (sin bibliotecas externas).
 * Cada función recibe los datos y una paleta concreta `t` (la de pantalla o la de exportación)
 * y devuelve { svg, alto }. Las marcas llevan data-tip para el globo de ayuda.
 */
(function (raiz) {
  'use strict';

  var ANCHO = 680;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v, dec) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return Number(v).toLocaleString('es-AR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }
  function pct(v) { return num(v, v > 0 && v < 1 ? 1 : 0) + ' %'; }

  /* Ancho aproximado de un texto (sin medir en el DOM, para que funcione al exportar). */
  function anchoTexto(s, tam) { return String(s).length * tam * 0.53; }

  /* Corta un rótulo en hasta `lineas` renglones de `max` caracteres. */
  function partir(s, max, lineas) {
    var palabras = String(s).split(/\s+/), out = [], act = '';
    palabras.forEach(function (p) {
      if ((act + ' ' + p).trim().length > max && act) { out.push(act); act = p; } else act = (act + ' ' + p).trim();
    });
    if (act) out.push(act);
    if (out.length > lineas) { out = out.slice(0, lineas); out[lineas - 1] = out[lineas - 1].replace(/\s*\S*$/, '') + '…'; }
    return out;
  }

  /* Barra con el extremo de datos redondeado (4 px) y la base recta. */
  function barraH(x, y, w, h, color, tip) {
    if (w <= 0) return '';
    var r = Math.min(4, w / 2, h / 2);
    var d = 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) + 'H' + x + 'Z';
    return '<path class="marca" d="' + d + '" fill="' + color + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '/>';
  }
  function barraV(x, y, w, h, color, tip) {
    if (h <= 0) return '';
    var r = Math.min(4, w / 2, h / 2), base = y + h;
    var d = 'M' + x + ',' + base + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) +
      'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + base + 'Z';
    return '<path class="marca" d="' + d + '" fill="' + color + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '/>';
  }
  function texto(x, y, s, t, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-family="' + t.fuente + '" font-size="' + (o.tam || 12) + '"' +
      (o.peso ? ' font-weight="' + o.peso + '"' : '') + ' fill="' + (o.color || t.tinta) + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + (o.extra || '') + '>' + esc(s) + '</text>';
  }
  function envolver(alto, cuerpo, t, titulo, W) {
    W = W || ANCHO;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + alto + '" width="' + W + '" height="' + alto +
      '" role="img" aria-label="' + esc(titulo || 'Gráfico') + '" style="max-width:100%;height:auto;display:block">' + cuerpo + '</svg>';
  }

  /* Leyenda en una o más filas. items: [{etiqueta, color}] */
  function leyenda(items, t, y0, W) {
    W = W || ANCHO;
    var x = 0, y = y0, out = '';
    items.forEach(function (it) {
      var w = 12 + 6 + anchoTexto(it.etiqueta, 12) + 18;
      if (x + w > W && x > 0) { x = 0; y += 20; }
      out += '<rect x="' + x + '" y="' + (y - 9) + '" width="12" height="12" rx="3" fill="' + it.color + '"/>' +
        texto(x + 18, y + 1, it.etiqueta, t, { color: t.tinta2 });
      x += w;
    });
    return { svg: out, alto: y - y0 + 22 };
  }

  /* ---------- Barras horizontales (una serie) ---------- */
  function barrasH(items, t, o) {
    o = o || {};
    var W = o.ancho || ANCHO, maxLen = Math.max.apply(null, items.map(function (i) { return String(i.etiqueta).length; }).concat([4]));
    var colTxt = Math.min(250, W * 0.4, Math.max(80, Math.min(maxLen, 34) * 6.6)), corte = Math.max(12, Math.floor(colTxt / 6.6));
    var x0 = colTxt + 12, xMax = W - 92, h = 18, y = 6, cuerpo = '';
    var tope = Math.max.apply(null, items.map(function (i) { return o.valor === 'n' ? i.n : i.pct; }).concat([1e-9]));
    items.forEach(function (it) {
      var lineas = partir(it.etiqueta, corte, 2), alto = lineas.length > 1 ? 40 : 30;
      var cy = y + alto / 2;
      lineas.forEach(function (l, k) {
        cuerpo += texto(colTxt, cy + 4 + (k - (lineas.length - 1) / 2) * 15, l, t, { anchor: 'end', color: t.tinta });
      });
      var v = o.valor === 'n' ? it.n : it.pct, w = (xMax - x0) * v / tope;
      var tip = it.etiqueta + ': ' + num(it.n) + (o.valor === 'n' ? '' : ' (' + pct(it.pct) + ')');
      cuerpo += '<rect x="' + x0 + '" y="' + (cy - h / 2 - 4) + '" width="' + (W - x0) + '" height="' + (h + 8) + '" fill="transparent" data-tip="' + esc(tip) + '"/>';
      cuerpo += barraH(x0, cy - h / 2, Math.max(w, it.n ? 2 : 0), h, it.color || t.acento, tip);
      var etq = o.valor === 'n' ? num(it.n) : num(it.n) + ' · ' + pct(it.pct);
      cuerpo += texto(x0 + w + 8, cy + 4, etq, t, { color: it.n ? t.tinta : t.tenue, tam: 12, extra: ' font-variant-numeric="tabular-nums"' });
      y += alto;
    });
    cuerpo = '<line x1="' + x0 + '" y1="2" x2="' + x0 + '" y2="' + (y + 2) + '" stroke="' + t.eje + '" stroke-width="1"/>' + cuerpo;
    return { svg: envolver(y + 8, cuerpo, t, o.titulo, W), alto: y + 8 };
  }

  /* ---------- Barras apiladas al 100 % (una fila por categoría) ---------- */
  function apiladas100(filas, series, t, o) {
    o = o || {};
    var W = o.ancho || ANCHO;
    var ley = leyenda(series.map(function (s) { return { etiqueta: s.etiqueta, color: s.color }; }), t, 12, W);
    var maxLen = Math.max.apply(null, filas.map(function (f) { return String(f.etiqueta).length; }).concat([4]));
    var colTxt = Math.min(230, W * 0.36, Math.max(80, Math.min(maxLen, 32) * 6.6)), corte = Math.max(12, Math.floor(colTxt / 6.6));
    var x0 = colTxt + 12, xMax = W - 58, h = 22, y = ley.alto + 6, cuerpo = ley.svg;
    filas.forEach(function (f) {
      var lineas = partir(f.etiqueta, corte, 2), alto = lineas.length > 1 ? 42 : 34, cy = y + alto / 2;
      lineas.forEach(function (l, k) { cuerpo += texto(colTxt, cy + 4 + (k - (lineas.length - 1) / 2) * 15, l, t, { anchor: 'end' }); });
      var total = f.partes.reduce(function (a, p) { return a + p.n; }, 0), x = x0, ancho = xMax - x0;
      f.partes.forEach(function (p, i) {
        if (!p.n) return;
        var w = ancho * p.n / (f.base || total) - 2;
        if (w < 0.5) w = 0.5;
        var tip = f.etiqueta + ' · ' + series[i].etiqueta + ': ' + num(p.n) + ' de ' + num(f.base || total) + ' (' + pct(p.pct) + ')';
        cuerpo += '<rect class="marca" x="' + x + '" y="' + (cy - h / 2) + '" width="' + w + '" height="' + h + '" fill="' + series[i].color + '" data-tip="' + esc(tip) + '"/>';
        var lbl = pct(p.pct);
        if (w >= anchoTexto(lbl, 11) + 10) {
          cuerpo += texto(x + w / 2, cy + 4, lbl, t, { anchor: 'middle', tam: 11, color: series[i].textoSobre || t.tinta, extra: ' pointer-events="none"' });
        }
        x += w + 2;
      });
      cuerpo += texto(W - 2, cy + 4, 'n = ' + num(f.base || total), t, { anchor: 'end', tam: 11, color: t.tinta2 });
      y += alto;
    });
    return { svg: envolver(y + 8, cuerpo, t, o.titulo, W), alto: y + 8 };
  }

  /* ---------- Barras agrupadas (categorías × grupos), en % dentro de cada grupo ---------- */
  function agrupadasH(cats, grupos, t, o) {
    o = o || {};
    var W = o.ancho || ANCHO;
    var ley = leyenda(grupos.map(function (g) { return { etiqueta: g.etiqueta + ' (n = ' + num(g.n) + ')', color: g.color }; }), t, 12, W);
    var maxLen = Math.max.apply(null, cats.map(function (c) { return String(c.etiqueta).length; }).concat([4]));
    var colTxt = Math.min(240, W * 0.38, Math.max(80, Math.min(maxLen, 34) * 6.6)), corte = Math.max(12, Math.floor(colTxt / 6.6));
    var x0 = colTxt + 12, xMax = W - 52, hb = 11, y = ley.alto + 4, cuerpo = ley.svg;
    var tope = 0;
    cats.forEach(function (c) { c.valores.forEach(function (v) { if (v.pct > tope) tope = v.pct; }); });
    tope = tope || 1;
    cats.forEach(function (c) {
      var bloque = grupos.length * (hb + 2) + 14, cy = y + bloque / 2;
      var lineas = partir(c.etiqueta, corte, 2);
      lineas.forEach(function (l, k) { cuerpo += texto(colTxt, cy + 4 + (k - (lineas.length - 1) / 2) * 15, l, t, { anchor: 'end' }); });
      var yb = y + 7;
      c.valores.forEach(function (v, i) {
        var w = (xMax - x0) * v.pct / tope;
        var tip = c.etiqueta + ' · ' + grupos[i].etiqueta + ': ' + num(v.n) + ' (' + pct(v.pct) + ')';
        cuerpo += barraH(x0, yb, Math.max(w, v.n ? 2 : 0), hb, grupos[i].color, tip);
        cuerpo += texto(x0 + w + 6, yb + hb - 1, pct(v.pct), t, { tam: 10.5, color: t.tinta2 });
        yb += hb + 2;
      });
      y += bloque;
    });
    cuerpo += '<line x1="' + x0 + '" y1="' + (ley.alto) + '" x2="' + x0 + '" y2="' + y + '" stroke="' + t.eje + '"/>';
    return { svg: envolver(y + 8, cuerpo, t, o.titulo, W), alto: y + 8 };
  }

  /* ---------- Columnas (fechas o histograma) ---------- */
  function columnas(items, t, o) {
    o = o || {};
    var W = o.ancho || ANCHO, x0 = 44, x1 = W - 8, y0 = 14, alto = 230, yBase = y0 + alto - 40;
    var maxV = Math.max.apply(null, items.map(function (i) { return i.n; }).concat([1]));
    var eje = raiz.Estadistica.ejeLindo(0, maxV, 4), cuerpo = '';
    if (eje.paso % 1) { // los conteos van de a números enteros
      var paso = Math.max(1, Math.ceil(eje.paso)), tope = Math.ceil(maxV / paso) * paso;
      eje = { min: 0, max: tope, paso: paso, marcas: [] };
      for (var q = 0; q <= tope; q += paso) eje.marcas.push(q);
    }
    if (eje.paso < 1) { // los conteos van de a uno
      eje = { min: 0, max: Math.max(1, Math.ceil(maxV)), paso: 1, marcas: [] };
      for (var k = 0; k <= eje.max; k++) eje.marcas.push(k);
    }
    eje.marcas.forEach(function (m) {
      var y = yBase - (yBase - y0) * m / eje.max;
      cuerpo += '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="' + (m === 0 ? t.eje : t.grilla) + '" stroke-width="1"/>';
      cuerpo += texto(x0 - 6, y + 4, num(m), t, { anchor: 'end', tam: 11, color: t.tenue });
    });
    var n = items.length, banda = (x1 - x0) / Math.max(1, n), w = o.pegadas ? banda - 2 : Math.min(28, banda * 0.62);
    var cada = Math.ceil(n / Math.floor((x1 - x0) / 54));
    items.forEach(function (it, i) {
      var h = (yBase - y0) * it.n / eje.max, x = x0 + banda * i + (banda - w) / 2;
      var tip = it.tip || (it.etiqueta + ': ' + num(it.n));
      cuerpo += '<rect x="' + (x0 + banda * i) + '" y="' + y0 + '" width="' + banda + '" height="' + (yBase - y0) + '" fill="transparent" data-tip="' + esc(tip) + '"/>';
      cuerpo += barraV(x, yBase - h, w, h, t.acento, tip);
      if (i % cada === 0) cuerpo += texto(x0 + banda * i + banda / 2, yBase + 16, it.etiqueta, t, { anchor: 'middle', tam: 11, color: t.tinta2 });
    });
    if (o.ejeX) cuerpo += texto((x0 + x1) / 2, yBase + 34, o.ejeX, t, { anchor: 'middle', tam: 11, color: t.tenue });
    return { svg: envolver(yBase + 40, cuerpo, t, o.titulo, W), alto: yBase + 40 };
  }

  /* ---------- Dispersión ---------- */
  function dispersion(puntos, t, o) {
    o = o || {};
    var E = raiz.Estadistica;
    var W = o.ancho || ANCHO, x0 = 52, x1 = W - 12, y0 = 12, y1 = Math.min(300, Math.max(200, W * 0.5));
    var xs = puntos.map(function (p) { return p.x; }), ys = puntos.map(function (p) { return p.y; });
    var ex = E.ejeLindo(Math.min.apply(null, xs), Math.max.apply(null, xs), 6), ey = E.ejeLindo(Math.min.apply(null, ys), Math.max.apply(null, ys), 5);
    function X(v) { return x0 + (x1 - x0) * (v - ex.min) / (ex.max - ex.min); }
    function Y(v) { return y1 - (y1 - y0) * (v - ey.min) / (ey.max - ey.min); }
    var cuerpo = '';
    ey.marcas.forEach(function (m) {
      cuerpo += '<line x1="' + x0 + '" y1="' + Y(m) + '" x2="' + x1 + '" y2="' + Y(m) + '" stroke="' + t.grilla + '"/>' + texto(x0 - 6, Y(m) + 4, num(m, ey.paso < 1 ? 1 : 0), t, { anchor: 'end', tam: 11, color: t.tenue });
    });
    ex.marcas.forEach(function (m) {
      cuerpo += '<line x1="' + X(m) + '" y1="' + y0 + '" x2="' + X(m) + '" y2="' + y1 + '" stroke="' + t.grilla + '"/>' + texto(X(m), y1 + 16, num(m, ex.paso < 1 ? 1 : 0), t, { anchor: 'middle', tam: 11, color: t.tenue });
    });
    cuerpo += '<line x1="' + x0 + '" y1="' + y1 + '" x2="' + x1 + '" y2="' + y1 + '" stroke="' + t.eje + '"/>';
    if (o.recta) {
      var a = o.recta.ordenada, b = o.recta.pendiente;
      var xa = ex.min, xb = ex.max, ya = a + b * xa, yb = a + b * xb;
      cuerpo += '<line x1="' + X(xa) + '" y1="' + Y(ya) + '" x2="' + X(xb) + '" y2="' + Y(yb) + '" stroke="' + t.tinta2 + '" stroke-width="1.5" stroke-opacity="0.7" clip-path="url(#recorte)"/>';
    }
    puntos.forEach(function (p) {
      cuerpo += '<circle class="marca" cx="' + X(p.x) + '" cy="' + Y(p.y) + '" r="5" fill="' + (p.color || t.acento) + '" stroke="' + t.superficie + '" stroke-width="2" data-tip="' + esc(p.tip) + '"/>';
    });
    cuerpo = '<defs><clipPath id="recorte"><rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '"/></clipPath></defs>' + cuerpo;
    cuerpo += texto((x0 + x1) / 2, y1 + 36, o.ejeX || '', t, { anchor: 'middle', tam: 12, color: t.tinta2 });
    cuerpo += texto(14, (y0 + y1) / 2, o.ejeY || '', t, { anchor: 'middle', tam: 12, color: t.tinta2, extra: ' transform="rotate(-90 14 ' + ((y0 + y1) / 2) + ')"' });
    var alto = y1 + 46, ley = '';
    if (o.grupos && o.grupos.length > 1) {
      var l = leyenda(o.grupos, t, alto + 6, W); ley = l.svg; alto += l.alto + 4;
    }
    return { svg: envolver(alto, cuerpo + ley, t, o.titulo, W), alto: alto };
  }

  /* ---------- Promedios por grupo (barra = media, línea fina = ±1 DE) ---------- */
  function medias(items, t, o) {
    o = o || {};
    var maxLen = Math.max.apply(null, items.map(function (i) { return String(i.etiqueta).length; }).concat([4]));
    var W = o.ancho || ANCHO, colTxt = Math.min(240, W * 0.38, Math.max(80, Math.min(maxLen, 34) * 6.6)), corte = Math.max(12, Math.floor(colTxt / 6.6)), x0 = colTxt + 12, xMax = W - 120, y = 6, cuerpo = '';
    var tope = Math.max.apply(null, items.map(function (i) { return (i.media || 0) + (i.de || 0); }).concat([1e-9]));
    var eje = raiz.Estadistica.ejeLindo(0, tope, 4);
    function X(v) { return x0 + (xMax - x0) * v / eje.max; }
    items.forEach(function (it) {
      var lineas = partir(it.etiqueta, corte, 2), alto = lineas.length > 1 ? 40 : 30, cy = y + alto / 2;
      lineas.forEach(function (l, k) { cuerpo += texto(colTxt, cy + 4 + (k - (lineas.length - 1) / 2) * 15, l, t, { anchor: 'end' }); });
      if (it.n) {
        var tip = it.etiqueta + ': media ' + num(it.media, 1) + (it.de !== null ? ' (DE ' + num(it.de, 1) + ')' : '') + ', n = ' + num(it.n);
        cuerpo += barraH(x0, cy - 9, X(it.media) - x0, 18, it.color || t.acento, tip);
        if (it.de) cuerpo += '<line x1="' + X(Math.max(0, it.media - it.de)) + '" y1="' + cy + '" x2="' + X(it.media + it.de) + '" y2="' + cy + '" stroke="' + t.tinta + '" stroke-width="1.5"/>';
        cuerpo += texto(Math.max(X(it.media), X(it.media + (it.de || 0))) + 8, cy + 4, num(it.media, 1) + '  (n = ' + num(it.n) + ')', t, { tam: 12 });
      } else cuerpo += texto(x0 + 6, cy + 4, 'sin datos', t, { tam: 12, color: t.tenue });
      y += alto;
    });
    cuerpo += '<line x1="' + x0 + '" y1="2" x2="' + x0 + '" y2="' + y + '" stroke="' + t.eje + '"/>';
    return { svg: envolver(y + 8, cuerpo, t, o.titulo, W), alto: y + 8 };
  }

  /* ---------- Exportación ---------- */
  /* Arma un SVG autónomo con título, subtítulo y pie (fuente y filtros), con la paleta clara. */
  function componer(g, t, opciones) {
    opciones = opciones || {};
    var margen = 28, cab = 0, partes = '';
    var tit = partir(g.titulo || '', 70, 3);
    tit.forEach(function (l, i) { partes += texto(margen, 34 + i * 24, l, t, { tam: 19, peso: 700 }); });
    cab = 34 + (tit.length - 1) * 24;
    var sub = partir(g.subtitulo || '', 100, 3);
    sub.forEach(function (l, i) { partes += texto(margen, cab + 24 + i * 17, l, t, { tam: 13, color: t.tinta2 }); });
    cab += 24 + (sub.length - 1) * 17 + 18;
    var interior = g.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    var y = cab + g.alto + 14, pie = '';
    partir(g.pie || '', 120, 4).forEach(function (l, i) { pie += texto(margen, y + 14 + i * 15, l, t, { tam: 11, color: t.tenue }); });
    var altoTotal = y + 14 + partir(g.pie || '', 120, 4).length * 15 + 12;
    var anchoTotal = ANCHO + margen * 2;
    return { alto: altoTotal, ancho: anchoTotal, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + anchoTotal + '" height="' + altoTotal + '" viewBox="0 0 ' + anchoTotal + ' ' + altoTotal + '">' +
      '<rect width="100%" height="100%" fill="' + t.superficie + '"/>' + partes +
      '<g transform="translate(' + margen + ',' + cab + ')">' + interior + '</g>' + pie + '</svg>' };
  }

  /* SVG → PNG (Blob) a doble resolución. */
  function aPng(svg, ancho, alto) {
    return new Promise(function (ok, mal) {
      var img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = ancho * 2; c.height = alto * 2;
        var ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.drawImage(img, 0, 0, ancho, alto);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : mal(new Error('No se pudo generar la imagen')); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo dibujar el gráfico')); };
      img.src = url;
    });
  }

  var api = { ANCHO: ANCHO, esc: esc, num: num, pct: pct, partir: partir, barrasH: barrasH, apiladas100: apiladas100,
    agrupadasH: agrupadasH, columnas: columnas, dispersion: dispersion, medias: medias, componer: componer, aPng: aPng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Graficos = api;
})(typeof window !== 'undefined' ? window : this);
