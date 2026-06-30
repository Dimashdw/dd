/* ============================================================================
   charts.js — мини-SVG-либа без зависимостей. Результат → window.CH
   Все функции возвращают строку SVG; цвета берут из CSS-переменных.
   ============================================================================ */
window.CH = (function () {
  "use strict";

  function cssv(name) {
    try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888"; }
    catch (e) { return "#888"; }
  }
  var C = {
    get MONEY(){return cssv("--money");}, get SPEND(){return cssv("--spend");},
    get GHOST(){return cssv("--chart-ghost");}, get FAINT(){return cssv("--faint");},
    get WARN(){return cssv("--warn");}, get DANGER(){return cssv("--danger");},
    get TEXT(){return cssv("--text");}, get MUTED(){return cssv("--muted");},
    get AI(){return cssv("--ai");}, get SURF3(){return cssv("--surface-3");}
  };

  function safeDiv(a, b){ if(!b||!isFinite(b))return 0; var r=a/b; return isFinite(r)?r:0; }
  function uid(){ return "g" + Math.random().toString(36).slice(2, 9); }   // только для id градиентов

  /* ── форматтеры ──────────────────────────────────────────────────────── */
  function ru(n, d) {
    if (n == null || !isFinite(n)) return "—";
    d = d == null ? 0 : d;
    var s = Number(n).toFixed(d);
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts.join(",");
  }
  function compact(n) {
    if (n == null || !isFinite(n)) return "—";
    var a = Math.abs(n);
    if (a >= 1e6) return ru(n / 1e6, 1).replace(/,0$/, "") + "M";
    if (a >= 1e3) return ru(n / 1e3, 1).replace(/,0$/, "") + "k";
    return ru(n, 0);
  }
  var CUR = "$";                          // символ валюты (ui.js ставит из DASH.meta.cur)
  function setCur(s){ CUR = s || "$"; }
  // $ — префиксом, прочие валюты (₸/₽/€) — суффиксом, как принято локально
  function usd(n, d){ return CUR === "$" ? "$" + ru(n, d) : ru(n, d) + " " + CUR; }
  function usdC(n){ return CUR === "$" ? "$" + compact(n) : compact(n) + " " + CUR; }
  function pct(n, d){ if(n==null||!isFinite(n))return "—"; return ru(n, d==null?1:d) + "%"; }
  function x(n){ if(n==null||!isFinite(n))return "—"; return ru(n, 2) + "×"; }
  var fmt = { ru:ru, compact:compact, usd:usd, usdC:usdC, pct:pct, x:x, setCur:setCur };

  function svg(w, h, inner, extra) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" ' +
           'width="100%" height="' + h + '" ' + (extra || "") + '>' + inner + '</svg>';
  }

  /* ── sparkline ───────────────────────────────────────────────────────── */
  function sparkline(values, opts) {
    opts = opts || {};
    var w = opts.w || 120, h = opts.h || 34, pad = 2;
    var color = opts.color || C.MONEY;
    if (!values || !values.length) return svg(w, h, "");
    var mn = Math.min.apply(null, values), mx = Math.max.apply(null, values);
    var rng = (mx - mn) || 1;
    var n = values.length;
    var pts = values.map(function (v, i) {
      var px = pad + (w - 2 * pad) * safeDiv(i, n - 1);
      var py = h - pad - (h - 2 * pad) * safeDiv(v - mn, rng);
      return [px, py];
    });
    var id = uid();
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    var area = line + " L" + pts[n-1][0].toFixed(1) + " " + (h - pad) + " L" + pts[0][0].toFixed(1) + " " + (h - pad) + " Z";
    var inner =
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + color + '" stop-opacity=".22"/>' +
      '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>';
    return svg(w, h, inner, 'preserveAspectRatio="none"');
  }

  /* ── groupedBars: расход(серый призрак) + доход(зелёный) по месяцам ──── */
  function groupedBars(opts) {
    opts = opts || {};
    var data = opts.data || [];   // [{label, spend, income}]
    var w = opts.w || 640, h = opts.h || 200;
    var padB = 22, padT = 10, padX = 8;
    var n = data.length || 1;
    var mx = 0;
    data.forEach(function (d) { mx = Math.max(mx, d.spend, d.income); });
    mx = mx || 1;
    var groupW = (w - 2 * padX) / n;
    var barW = Math.min(groupW * 0.34, 26);
    var gap = 3;
    var inner = "", peak = -1, peakV = -1;
    data.forEach(function (d, i) {
      if (d.income > peakV) { peakV = d.income; peak = i; }
    });
    data.forEach(function (d, i) {
      var cx = padX + groupW * i + groupW / 2;
      var hS = (h - padB - padT) * safeDiv(d.spend, mx);
      var hI = (h - padB - padT) * safeDiv(d.income, mx);
      var x1 = cx - barW - gap / 2, x2 = cx + gap / 2;
      inner += rrect(x1, h - padB - hS, barW, hS, 3, C.GHOST);
      inner += rrect(x2, h - padB - hI, barW, hI, 3, i === peak ? C.MONEY : C.MONEY, i === peak ? 1 : .82);
      inner += '<text x="' + cx + '" y="' + (h - 7) + '" text-anchor="middle" font-size="10" fill="' + C.FAINT + '">' +
               esc(d.label) + '</text>';
    });
    return svg(w, h, inner);
  }

  /* ── bars: горизонтальные (гео) ──────────────────────────────────────── */
  function bars(opts) {
    opts = opts || {};
    var data = opts.data || [];   // [{label, value, sub}]
    var w = opts.w || 460;
    var rowH = opts.rowH || 30, labelW = opts.labelW || 96, valW = 64;
    var h = data.length * rowH + 6;
    var mx = 0; data.forEach(function (d) { mx = Math.max(mx, d.value); }); mx = mx || 1;
    var trackX = labelW + 6, trackW = w - trackX - valW;
    var inner = "";
    data.forEach(function (d, i) {
      var y = i * rowH + 4;
      var bw = trackW * safeDiv(d.value, mx);
      inner += '<text x="0" y="' + (y + rowH / 2 + 3) + '" font-size="12" fill="' + C.MUTED + '">' + esc(d.label) + '</text>';
      inner += rrect(trackX, y + 6, trackW, rowH - 14, 4, C.GHOST);
      inner += rrect(trackX, y + 6, bw, rowH - 14, 4, C.MONEY);
      inner += '<text x="' + w + '" y="' + (y + rowH / 2 + 3) + '" text-anchor="end" font-size="11.5" fill="' + C.TEXT + '">' +
               esc(d.sub != null ? d.sub : compact(d.value)) + '</text>';
    });
    return svg(w, h, inner);
  }

  /* ── dailyDual: доход столбики + расход линия ────────────────────────── */
  function dailyDual(opts) {
    opts = opts || {};
    var daily = opts.daily || [];
    var w = opts.w || 960, h = opts.h || 220;
    var padB = 22, padT = 10, padX = 4;
    var n = daily.length || 1;
    var mx = 0;
    daily.forEach(function (d) { mx = Math.max(mx, d.income, d.spend); });
    mx = mx || 1;
    var bw = Math.max(1, (w - 2 * padX) / n - 0.6);
    var inner = "";
    // доход — зелёные столбики
    daily.forEach(function (d, i) {
      var px = padX + (w - 2 * padX) * safeDiv(i, n);
      var bh = (h - padB - padT) * safeDiv(d.income, mx);
      if (bh > 0) inner += '<rect x="' + px.toFixed(1) + '" y="' + (h - padB - bh).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + C.MONEY + '" opacity=".85"/>';
    });
    // расход — серая линия
    var line = daily.map(function (d, i) {
      var px = padX + (w - 2 * padX) * safeDiv(i, n) + bw / 2;
      var py = h - padB - (h - padB - padT) * safeDiv(d.spend, mx);
      return (i ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1);
    }).join(" ");
    inner += '<path d="' + line + '" fill="none" stroke="' + C.SPEND + '" stroke-width="1.4" opacity=".9"/>';
    // метки месяцев снизу
    var seen = {};
    daily.forEach(function (d, i) {
      var mo = d.date.slice(0, 7);
      if (!seen[mo]) {
        seen[mo] = 1;
        var px = padX + (w - 2 * padX) * safeDiv(i, n);
        inner += '<text x="' + px.toFixed(1) + '" y="' + (h - 6) + '" font-size="10" fill="' + C.FAINT + '">' +
                 d.dmy + '</text>';
      }
    });
    return svg(w, h, inner);
  }

  /* ── funnel ──────────────────────────────────────────────────────────── */
  function funnel(opts) {
    opts = opts || {};
    var steps = opts.steps || [];
    var w = opts.w || 640, h = opts.h || 200, padT = 10, padB = 10;
    var n = steps.length || 1;
    var mx = 0; steps.forEach(function (s) { mx = Math.max(mx, s.value); }); mx = mx || 1;
    var colW = w / n;
    var inner = "";
    steps.forEach(function (s, i) {
      var bh = (h - padT - padB) * safeDiv(s.value, mx);
      bh = Math.max(bh, 2);
      var cx = colW * i + colW / 2;
      var bw = colW * 0.62;
      var col = i === n - 1 ? C.MONEY : C.SPEND;
      inner += rrect(cx - bw / 2, h - padB - bh, bw, bh, 5, col, i === n - 1 ? .9 : .55);
      inner += '<text x="' + cx + '" y="' + (h - padB - bh - 6) + '" text-anchor="middle" font-size="12" fill="' + C.TEXT + '">' +
               compact(s.value) + '</text>';
      inner += '<text x="' + cx + '" y="' + (h - 0) + '" text-anchor="middle" font-size="10.5" fill="' + C.FAINT + '">' +
               esc(s.name) + '</text>';
    });
    return svg(w, h + 12, inner);
  }

  /* ── gauge ───────────────────────────────────────────────────────────── */
  function gauge(opts) {
    opts = opts || {};
    var val = opts.value || 0, max = opts.max || 1;
    var w = 160, h = 92, cx = w / 2, cy = h - 6, r = 64;
    var frac = Math.max(0, Math.min(1, safeDiv(val, max)));
    function pt(a){ return [cx + r * Math.cos(Math.PI * (1 - a)), cy - r * Math.sin(Math.PI * (1 - a))]; }
    var a0 = pt(0), a1 = pt(frac), aE = pt(1);
    var col = opts.color || C.MONEY;
    var inner =
      '<path d="M' + a0[0].toFixed(1) + ' ' + a0[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 0 1 ' + aE[0].toFixed(1) + ' ' + aE[1].toFixed(1) + '" fill="none" stroke="' + C.GHOST + '" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M' + a0[0].toFixed(1) + ' ' + a0[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + (frac > .5 ? 1 : 0) + ' 1 ' + a1[0].toFixed(1) + ' ' + a1[1].toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round"/>' +
      '<text x="' + cx + '" y="' + (cy - 8) + '" text-anchor="middle" font-size="18" font-weight="650" fill="' + C.TEXT + '">' + (opts.label || ru(val, 1)) + '</text>';
    return svg(w, h, inner);
  }

  /* ── scatter (пузыри): монохром — зелёный=выше среднего, серый=ниже ──── */
  function scatter(opts) {
    opts = opts || {};
    var data = opts.data || [];   // [{x,y,r,label,good}]
    var w = opts.w || 640, h = opts.h || 280, pad = 34;
    var xs = data.map(function (d){return d.x;}), ys = data.map(function (d){return d.y;});
    var xmn = Math.min.apply(null, xs.concat([0])), xmx = Math.max.apply(null, xs.concat([1]));
    var ymn = Math.min.apply(null, ys.concat([0])), ymx = Math.max.apply(null, ys.concat([1]));
    var xr = (xmx - xmn) || 1, yr = (ymx - ymn) || 1;
    var rmx = 0; data.forEach(function (d){ rmx = Math.max(rmx, d.r || 0); }); rmx = rmx || 1;
    var inner = "";
    // оси
    inner += '<line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - 6) + '" y2="' + (h - pad) + '" stroke="' + C.GHOST + '" stroke-width="1"/>';
    inner += '<line x1="' + pad + '" y1="6" x2="' + pad + '" y2="' + (h - pad) + '" stroke="' + C.GHOST + '" stroke-width="1"/>';
    if (opts.xLabel) inner += '<text x="' + (w - 6) + '" y="' + (h - pad + 16) + '" text-anchor="end" font-size="10.5" fill="' + C.FAINT + '">' + esc(opts.xLabel) + '</text>';
    if (opts.yLabel) inner += '<text x="' + (pad - 4) + '" y="14" text-anchor="start" font-size="10.5" fill="' + C.FAINT + '">' + esc(opts.yLabel) + '</text>';
    data.forEach(function (d) {
      var px = pad + (w - pad - 12) * safeDiv(d.x - xmn, xr);
      var py = (h - pad) - (h - pad - 12) * safeDiv(d.y - ymn, yr);
      var rr = 4 + 14 * safeDiv(d.r, rmx);
      var col = d.good ? C.MONEY : C.SPEND;
      inner += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + rr.toFixed(1) + '" fill="' + col + '" fill-opacity=".28" stroke="' + col + '" stroke-width="1"/>';
    });
    return svg(w, h, inner);
  }

  /* ── progress ────────────────────────────────────────────────────────── */
  function progress(opts) {
    opts = opts || {};
    var frac = Math.max(0, Math.min(1, opts.value || 0));
    var w = opts.w || 200, h = 8;
    var col = opts.color || C.MONEY;
    return svg(w, h, rrect(0, 0, w, h, 4, C.GHOST) + rrect(0, 0, w * frac, h, 4, col));
  }

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function rrect(x, y, w, h, r, fill, op) {
    if (w <= 0 || h <= 0) return "";
    r = Math.min(r, w / 2, h / 2);
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) +
           '" height="' + h.toFixed(1) + '" rx="' + r.toFixed(1) + '" fill="' + fill + '"' +
           (op != null ? ' opacity="' + op + '"' : '') + '/>';
  }
  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) { return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" })[c]; });
  }

  return {
    fmt: fmt, C: C,
    sparkline: sparkline, groupedBars: groupedBars, bars: bars,
    dailyDual: dailyDual, funnel: funnel, gauge: gauge, scatter: scatter, progress: progress
  };
})();
