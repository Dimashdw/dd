/* ============================================================================
   data.js — ЕДИНСТВЕННЫЙ источник данных дашборда. Результат → window.DASH
   ----------------------------------------------------------------------------
   КАРТА СООТВЕТСТВИЯ КОЛОНОК ВЫГРУЗКИ Meta Ads → поля daily[] (для ПРОМТА-2):
     «День» / «Day»                         → daily[].date   (ISO или ДД.ММ.ГГГГ)
     «Сумма затрат» / «Amount spent»        → daily[].spend
     «Результаты»/«Лиды»/«Results»/«Leads»  → daily[].leads
     «Клики по ссылке» / «Link clicks»      → daily[].clicks
     «Показы» / «Impressions»               → daily[].impressions
   Разрез geo       — из выгрузки «Страна»/«Country»: сумма spend+leads по стране.
   Разрез creatives — из выгрузки «Название объявления»/«Ad name»: spend, leads,
                      дата запуска (первый день показа). Имена — РЕАЛЬНЫЕ из файла.
   ВАЖНО: рекламный кабинет НЕ знает выручку. income/revenue/customers/оплаты —
   ОТДЕЛЬНЫЙ слой (массив payments ниже, вручную или из CRM). При заполнении
   ad-части из файла income можно оставить заглушкой ($1-набор) — дашборд считает
   что может (расход, CPL, лиды, гео по расходу), а ROAS/когорты оживут с оплатами.
   Несколько месяцев = несколько выгрузок: склеиваются в один daily по датам.
   ЗАПОЛНЕНИЕ = замена массива daily и списков-разрезов. Структуру не трогать.
   ============================================================================ */
window.DASH = (function () {
  "use strict";

  /* ── защита от деления на ноль ───────────────────────────────────────── */
  function safeDiv(a, b) {
    if (!b || !isFinite(b) || b === 0) return 0;
    var r = a / b;
    return isFinite(r) ? r : 0;
  }

  /* ── метод наибольшего остатка: целые с суммой РОВНО total ────────────── */
  function allocate(total, weights) {
    total = Math.round(total || 0);
    var n = weights.length;
    var sumW = 0, i;
    for (i = 0; i < n; i++) sumW += (weights[i] > 0 ? weights[i] : 0);
    var out = new Array(n), rema = new Array(n), used = 0;
    if (sumW <= 0) {
      // веса вырождены → раскидываем поровну
      var base = Math.floor(total / n), rem = total - base * n;
      for (i = 0; i < n; i++) out[i] = base + (i < rem ? 1 : 0);
      return out;
    }
    for (i = 0; i < n; i++) {
      var raw = total * (weights[i] > 0 ? weights[i] : 0) / sumW;
      out[i] = Math.floor(raw);
      rema[i] = raw - out[i];
      used += out[i];
    }
    var left = total - used;
    var idx = rema.map(function (r, k) { return k; })
                  .sort(function (a, b) { return rema[b] - rema[a]; });
    for (i = 0; i < left; i++) out[idx[i % n]] += 1;
    return out;
  }

  /* ── кривая дозревания когорты cohortMat(d) ───────────────────────────── */
  var MAT_ANCHORS = [[0,0],[30,.30],[60,.50],[90,.66],[120,.80],[180,.90],[270,.97],[360,1.0]];
  function cohortMat(d) {
    if (!isFinite(d) || d <= 0) return 0;
    if (d >= 360) return 1;
    for (var i = 1; i < MAT_ANCHORS.length; i++) {
      var a = MAT_ANCHORS[i - 1], b = MAT_ANCHORS[i];
      if (d <= b[0]) {
        var t = safeDiv(d - a[0], b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return 1;
  }

  /* ── даты / период ────────────────────────────────────────────────────── */
  var MON = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  function pad(n){return n<10?"0"+n:""+n;}
  function dmy(dt){return pad(dt.getDate())+"."+pad(dt.getMonth()+1);}
  function iso(dt){return dt.getFullYear()+"-"+pad(dt.getMonth()+1)+"-"+pad(dt.getDate());}
  function ruShort(dt){return pad(dt.getDate())+" "+MON[dt.getMonth()]+" "+dt.getFullYear();}
  function monKey(dt){return dt.getFullYear()*12+dt.getMonth();}
  function monLabel(y,m){return MON[m]+" "+y;}

  var PERIOD_DAYS = 182;
  var END = new Date(2026, 5, 20);            // 20 июн 2026 (ученик поправит)
  var START = new Date(END.getTime() - (PERIOD_DAYS - 1) * 86400000);

  /* ── ЛЕСТНИЦА ПРОДУКТОВ (ученик меняет имена/цены) ────────────────────── */
  var products = [
    { code:"П1", name:"Миник",   sub:"трипваер",        price:10,  color:"var(--spend)" },
    { code:"П2", name:"База",    sub:"курс",            price:20,  color:"var(--ai)"    },
    { code:"П3", name:"ВИП",     sub:"сигналы/клуб",    price:50,  color:"var(--money)" },
    { code:"П4", name:"Наставн", sub:"наставничество",  price:900, color:"var(--warn)"  }
  ];

  var FX_RUB = 90;        // курс ₽/$ (плейсхолдер)
  var AOV = 1;            // средний чек на клиента (плейсхолдер; ученик заменит)
  var MARGIN = 1;         // маржа продукта (плейсхолдер; напр. 0.7)
  var LTV_K = 1.7;        // коэффициент LTV

  /* ── ЖУРНАЛ ОПЛАТ payments — ручной слой выручки (ТОЛЬКО ТЕСТ) ─────────
     Никаких реальных имён/сумм. Только «клиент-тест-N» / «@test_N».
     Это источник дохода: income, ROAS, когорты «по оплате» оживают отсюда. */
  var PAY_GEO = ["КЗ","РБ","УКР","Польша"];
  var payments = (function () {
    var rows = [], n = 12, i;
    // равномерно по периоду, детерминированно (без Math.random)
    for (i = 0; i < n; i++) {
      var prod = products[i % 4];
      var offDays = Math.round((PERIOD_DAYS - 10) * (i + 0.5) / n);   // дата оплаты
      var pdate = new Date(START.getTime() + offDays * 86400000);
      var subBack = 14 + (i % 5) * 7;                                  // дата захода раньше
      var sdate = new Date(pdate.getTime() - subBack * 86400000);
      var usd = prod.price;
      rows.push({
        date: iso(pdate),
        igNick: "клиент-тест-" + (i + 1),
        tgNick: "@test_" + (i + 1),
        subDate: iso(sdate),
        days: Math.round((pdate - sdate) / 86400000),
        geo: PAY_GEO[i % PAY_GEO.length],
        creative: "Крео-" + pad((i % 24) + 1),
        product: prod.code,
        rub: Math.round(usd * FX_RUB),
        usd: usd,
        debt: (i % 6 === 0 ? usd : 0)   // у части — висит долг
      });
    }
    return rows;
  })();
  var incomeIsPlaceholder = true;   // payments тестовые → доход на заглушках

  /* индекс дохода по дате (день без оплат = 0) */
  var incomeByDate = {};
  payments.forEach(function (p) { incomeByDate[p.date] = (incomeByDate[p.date] || 0) + p.usd; });

  /* ── daily: массив дней периода ──────────────────────────────────────── */
  var daily = [];
  for (var di = 0; di < PERIOD_DAYS; di++) {
    var dt = new Date(START.getTime() + di * 86400000);
    var isoD = iso(dt);
    daily.push({
      i: di,
      date: isoD,
      dmy: dmy(dt),
      label: ruShort(dt),
      month: monKey(dt),
      spend: 1,          // плейсхолдер «$1 в день» (заменит выгрузка)
      income: incomeByDate[isoD] || 0,   // доход из оплат, не из рекламы
      leads: 1,
      clicks: 1,
      impressions: 1
    });
  }

  /* ── тоталы ──────────────────────────────────────────────────────────── */
  var totalSpend = 0, totalLeads = 0, totalClicks = 0, totalImpr = 0;
  daily.forEach(function (d) {
    totalSpend += d.spend; totalLeads += d.leads;
    totalClicks += d.clicks; totalImpr += d.impressions;
  });
  var totalIncome = payments.reduce(function (s, p) { return s + p.usd; }, 0);
  var customers = Math.round(safeDiv(totalIncome, AOV));

  var totals = {
    spend: totalSpend, income: totalIncome, leads: totalLeads,
    clicks: totalClicks, impressions: totalImpr, customers: customers,
    profit: totalIncome - totalSpend
  };

  /* ── derived ─────────────────────────────────────────────────────────── */
  var derived = {
    ctr: safeDiv(totalClicks, totalImpr) * 100,
    cpm: safeDiv(totalSpend, totalImpr) * 1000,
    cpc: safeDiv(totalSpend, totalClicks),
    cpl: safeDiv(totalSpend, totalLeads),
    cac: safeDiv(totalSpend, customers),
    aov: AOV,
    ltv: AOV * LTV_K,
    ltvCac: safeDiv(AOV * LTV_K, safeDiv(totalSpend, customers)),
    roas: safeDiv(totalIncome, totalSpend),
    roi: safeDiv(totalIncome - totalSpend, totalSpend),
    profit: totalIncome - totalSpend,
    frequency: 1,
    reach: totalImpr,
    refundRate: 0,
    incomePerDay: safeDiv(totalIncome, daily.length),
    // ПРЕДЕЛЬНАЯ цена лида: средний доход с лида × маржа
    breakevenCpl: safeDiv(totalIncome, totalLeads) * MARGIN,
    margin: MARGIN
  };

  /* ── РАЗРЕЗЫ (через allocate → сходятся в тоталы до единицы) ───────────── */
  function buildSlice(names) {
    var w = names.map(function () { return 1; });   // равные веса (шаблон)
    var sp = allocate(totalSpend, w);
    var ld = allocate(totalLeads, w);
    var cu = allocate(customers, w);
    var rv = allocate(totalIncome, w);
    return names.map(function (nm, k) {
      var o = (typeof nm === "string") ? { name: nm } : nm;
      o.spend = sp[k]; o.leads = ld[k]; o.customers = cu[k]; o.revenue = rv[k];
      o.cpl = safeDiv(o.spend, o.leads);
      o.cac = safeDiv(o.spend, o.customers);
      o.aov = safeDiv(o.revenue, o.customers);
      o.roas = safeDiv(o.revenue, o.spend);
      return o;
    });
  }

  // geo: 7 регионов (страны ЕС — плейсхолдер; ученик заменит)
  var geo = buildSlice(["Германия","Польша","Франция","Испания","Италия","Нидерланды","Австрия"]);

  // segments: РОВНО 4 (плейсхолдер под инфобиз)
  var segments = buildSlice(["Новички","Трейдеры","Ищут доп. доход","Хотят пассивный доход"]);

  // creatives: РОВНО 24 (имена-заглушки + формат по кругу)
  var FORMATS = ["UGC","Reels","Карусель","Статика"];
  var creativeNames = [];
  for (var ci = 0; ci < 24; ci++) {
    var launch = new Date(START.getTime() + Math.round((PERIOD_DAYS - 20) * ci / 24) * 86400000);
    creativeNames.push({
      name: "Крео-" + pad(ci + 1),
      format: FORMATS[ci % 4],
      launch: iso(launch),
      launchLabel: ruShort(launch),
      ageDays: Math.round((END - launch) / 86400000)
    });
  }
  var creatives = buildSlice(creativeNames).map(function (c) {
    c.status = c.roas >= 1 ? "льём" : (c.spend > 0 ? "тест" : "пауза");
    return c;
  });

  // formats: сводка по форматам
  var formats = FORMATS.map(function (f) {
    var list = creatives.filter(function (c) { return c.format === f; });
    var sp = list.reduce(function (s, c) { return s + c.spend; }, 0);
    var rv = list.reduce(function (s, c) { return s + c.revenue; }, 0);
    return { name: f, count: list.length, spend: sp, revenue: rv, roas: safeDiv(rv, sp) };
  });

  /* ── monthly: группировка daily по месяцам ───────────────────────────── */
  var monthMap = {};
  var monthOrder = [];
  daily.forEach(function (d) {
    if (!monthMap[d.month]) {
      var y = Math.floor(d.month / 12), m = d.month % 12;
      monthMap[d.month] = { key: d.month, year: y, mon: m, label: monLabel(y, m),
                            spend: 0, income: 0, leads: 0 };
      monthOrder.push(d.month);
    }
    var mm = monthMap[d.month];
    mm.spend += d.spend; mm.income += d.income; mm.leads += d.leads;
  });
  monthOrder.sort(function (a, b) { return a - b; });
  var monthly = monthOrder.map(function (k) {
    var mm = monthMap[k];
    mm.roas = safeDiv(mm.income, mm.spend);
    return mm;
  });

  /* ── КОГОРТЫ (центральная механика) ──────────────────────────────────── */
  // возраст когорты: от 15-го числа её месяца до END (в днях)
  function cohortAge(y, m) {
    var anchor = new Date(y, m, 15);
    return Math.round((END - anchor) / 86400000);
  }
  var cohMonths = monthly.map(function (mm) {
    var age = cohortAge(mm.year, mm.mon);
    return { key: mm.key, label: mm.label, year: mm.year, mon: mm.mon,
             pdp: mm.leads, spend: mm.spend, income: mm.income,
             age: age, mat: cohortMat(age) };
  });

  // выручка «по подписке»: realized = allocate(totalIncome, pdp*mat)
  var subWeights = cohMonths.map(function (c) { return c.pdp * c.mat; });
  var realized = allocate(Math.round(totalIncome), subWeights);
  cohMonths.forEach(function (c, k) {
    c.realized = realized[k];
    c.eventual = (c.mat < 0.01) ? c.realized : safeDiv(c.realized, c.mat);
  });
  // выручка «по оплате» (касса): вес = доход месяца
  var payAlloc = allocate(Math.round(totalIncome), cohMonths.map(function (c) { return c.income; }));

  // веса разбивки месяца по 4 продуктам (перекос зрелостью)
  var baseShare = [4, 18, 46, 32];
  function prodWeights(mat) {
    return [
      baseShare[0] * (1 + 1.6 * (1 - mat)),
      baseShare[1] * (1 + 0.5 * (1 - mat)),
      baseShare[2] * (0.7 + 0.3 * mat),
      baseShare[3] * Math.pow(mat, 1.25)
    ];
  }
  function splitMonth(monthRevenue, mat, pdp) {
    var parts = allocate(monthRevenue, prodWeights(mat));
    return parts.map(function (usd, k) {
      var count = Math.round(safeDiv(usd, products[k].price));
      return { usd: usd, count: count, pct: safeDiv(count, pdp) * 100 };
    });
  }
  function buildCohorts(mode) {
    return cohMonths.map(function (c, k) {
      var total = (mode === "pay") ? payAlloc[k] : c.realized;
      var prods = splitMonth(total, c.mat, c.pdp);
      return {
        key: c.key, label: c.label, pdp: c.pdp, spend: c.spend,
        products: prods, total: total, roi: safeDiv(total, c.spend),
        age: c.age, mat: c.mat
      };
    });
  }
  var cohortsSub = buildCohorts("sub");
  var cohortsPay = buildCohorts("pay");

  // матрица: win[окно] = eventual*cohortMat(окно), если age >= окна, иначе null
  var matrixWindows = [30, 90, 180];
  var cohortMatrix = cohMonths.map(function (c) {
    var win = {};
    matrixWindows.forEach(function (w) {
      win[w] = (c.age >= w) ? c.eventual * cohortMat(w) : null;
    });
    return { key: c.key, label: c.label, spend: c.spend, age: c.age,
             eventual: c.eventual, win: win,
             roi: { 30: safeDiv(win[30], c.spend), 90: safeDiv(win[90], c.spend), 180: safeDiv(win[180], c.spend) } };
  });

  // productTotals: агрегат по продуктам (из «по подписке»)
  var productTotals = products.map(function (p, k) {
    var usd = 0, cnt = 0;
    cohortsSub.forEach(function (row) { usd += row.products[k].usd; cnt += row.products[k].count; });
    return { code: p.code, name: p.name, sub: p.sub, price: p.price, color: p.color,
             revenue: usd, count: cnt, avg: safeDiv(usd, cnt) };
  });
  var prodRevSum = productTotals.reduce(function (s, p) { return s + p.revenue; }, 0);
  productTotals.forEach(function (p) { p.share = safeDiv(p.revenue, prodRevSum) * 100; });

  // cohortKpi
  var totalOplaty = productTotals.reduce(function (s, p) { return s + p.count; }, 0);
  var eventualTotal = cohMonths.reduce(function (s, c) { return s + c.eventual; }, 0);
  var cohortKpi = {
    revenue: totalIncome,
    clients: customers,
    oplaty: totalOplaty,
    repeat: safeDiv(totalOplaty, customers),
    avgPerClient: safeDiv(totalIncome, customers),
    avgPerPayment: safeDiv(totalIncome, totalOplaty),
    blendedRoi: safeDiv(totalIncome, totalSpend),
    payback: { 90: cohortMat(90) * 100, 180: cohortMat(180) * 100, 360: cohortMat(360) * 100 },
    eventualTotal: eventualTotal,
    projRoas: safeDiv(eventualTotal, totalSpend)
  };

  var cohortWindows = [90, 180, 360];
  var cohortBench = { 90: 28, 180: 48, 360: 70 };

  // цикл сделки: ближайшее окно, где payback ≈ 100% бенча (в шаблоне ≈ 2 мес)
  var dealCycleMonths = 2;

  /* ── funnel: Клики → Лиды → Вебинар → Клиенты ────────────────────────── */
  var webinar = Math.round(totalLeads * 0.30);
  var funnel = {
    steps: [
      { name: "Клики",   value: totalClicks, cost: safeDiv(totalSpend, totalClicks) },
      { name: "Лиды",    value: totalLeads,  cost: safeDiv(totalSpend, totalLeads) },
      { name: "Вебинар", value: webinar,     cost: safeDiv(totalSpend, webinar) },
      { name: "Клиенты", value: customers,   cost: safeDiv(totalSpend, customers) }
    ],
    conv: {
      clickLead: safeDiv(totalLeads, totalClicks) * 100,
      leadWeb: safeDiv(webinar, totalLeads) * 100,
      webClient: safeDiv(customers, webinar) * 100,
      leadClient: safeDiv(customers, totalLeads) * 100
    }
  };

  /* ── meta ────────────────────────────────────────────────────────────── */
  var meta = {
    project: "Паша",
    period: { start: iso(START), end: iso(END), startLabel: ruShort(START), endLabel: ruShort(END) },
    months: monthly.length,
    currency: "$", cur: "$",
    source: "Meta Ads · выгрузка",
    attribution: "7d click / 1d view",
    incomeIsPlaceholder: incomeIsPlaceholder,
    fxRub: FX_RUB,
    dealCycleMonths: dealCycleMonths,
    aov: AOV, margin: MARGIN
  };

  return {
    util: { safeDiv: safeDiv, allocate: allocate, cohortMat: cohortMat },
    meta: meta,
    daily: daily,
    totals: totals,
    derived: derived,
    funnel: funnel,
    geo: geo,
    segments: segments,
    creatives: creatives,
    formats: formats,
    monthly: monthly,
    payments: payments,
    products: products,
    cohortsSub: cohortsSub,
    cohortsPay: cohortsPay,
    cohortMatrix: cohortMatrix,
    productTotals: productTotals,
    cohortKpi: cohortKpi,
    cohortWindows: cohortWindows,
    cohortBench: cohortBench,
    matrixWindows: matrixWindows,
    cohortMat: cohortMat
  };
})();
