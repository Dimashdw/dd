/* ============================================================================
   ui.js — хелперы + рендер всех панелей + переключатель вкладок + заставка.
   Результат → window.UI
   ============================================================================ */
window.UI = (function () {
  "use strict";

  var BRAND = "kola.traf";                     // брендовый штамп автора гайда
  var D = window.DASH, CH = window.CH, F = CH.fmt, S = D.util.safeDiv;

  var TABS = [
    { id:"obzor",   name:"Обзор",    h1:"Аналитика платного трафика",
      intro:"Главная сводка за период: сколько потратил, сколько лидов и денег пришло, окупается реклама или нет." },
    { id:"voronka", name:"Воронка",  h1:"Воронка · путь клиента",
      intro:"Путь клиента по шагам — клик → лид → клиент: где и сколько людей отваливается и почём обходится каждый шаг." },
    { id:"geo",     name:"Гео",      h1:"География · окупаемость по странам",
      intro:"Окупаемость по странам: где реклама в плюс и надо лить, а где сливает бюджет и надо резать." },
    { id:"kogorty", name:"Когорты",  h1:"Когорты по месяцам · окупаемость",
      intro:"Окупаемость по месяцам привлечения. Видно, что реклама окупается не сразу, а дозревает деньгами за 1-3 месяца." },
    { id:"kreativy",name:"Креативы", h1:"Креативы · эффективность",
      intro:"Какие объявления приносят деньги, а какие жрут бюджет — по расходу, лидам и окупаемости." },
    { id:"oplaty",  name:"Оплаты",   h1:"Журнал оплат",
      intro:"Журнал всех оплат: кто, когда, с какого креатива и сколько заплатил. Отсюда дашборд берёт выручку для остальных вкладок." }
  ];

  /* ── мелкие хелперы ──────────────────────────────────────────────────── */
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c];}); }
  function el(id){ return document.getElementById(id); }
  function hexA(hex, a) {
    hex = hex.replace("#",""); if (hex.length===3) hex = hex.split("").map(function(c){return c+c;}).join("");
    var n = parseInt(hex,16); return "rgba("+(n>>16&255)+","+(n>>8&255)+","+(n&255)+","+a+")";
  }
  // цвет ROI-ячейки (фикс. rgba по спецификации)
  function roiColor(r) {
    if (r==null || !isFinite(r)) return "transparent";
    if (r>=1) return "rgba(61,220,151,"+Math.min(0.42, 0.10+(r-1)*0.13).toFixed(3)+")";
    return "rgba(255,107,107,"+Math.min(0.42, 0.12+(1-r)*0.34).toFixed(3)+")";
  }
  function toast(msg) {
    var t = el("toast"); if(!t){ t=document.createElement("div"); t.id="toast"; t.className="toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._tm); t._tm = setTimeout(function(){ t.classList.remove("show"); }, 1600);
  }

  /* ── metric: KPI-карточка ────────────────────────────────────────────── */
  function metric(o) {
    var foot = "";
    if (o.delta) {
      var cls = o.deltaDir==="up"?"up":o.deltaDir==="down"?"down":"flat";
      var ar = o.deltaDir==="up"?"↑":o.deltaDir==="down"?"↓":"·";
      foot += '<span class="delta '+cls+'">'+ar+' '+esc(o.delta)+'</span>';
    }
    var spark = o.spark ? '<div class="kpi-spark">'+o.spark+'</div>' : "";
    return '<div class="card kpi"><div class="kpi-label">'+esc(o.label)+'</div>'+
           '<div class="kpi-val">'+o.value+'</div>'+
           (foot?'<div class="kpi-foot">'+foot+'</div>':'')+spark+'</div>';
  }

  /* ── legend ──────────────────────────────────────────────────────────── */
  function legend(items) {
    return '<div class="legend">'+items.map(function(it){
      return '<span class="li"><span class="sq" style="background:'+it.color+'"></span>'+esc(it.label)+'</span>';
    }).join("")+'</div>';
  }

  /* ── sortable: сортировка таблицы по клику на заголовок ──────────────── */
  function parseNum(s) {
    if (s==null) return -Infinity;
    var t = String(s).replace(/[\s$%×]/g,"").replace(/−/g,"-").replace(/,/g,".").replace(/[^0-9.\-]/g,"");
    if (t===""||t==="-"||t===".") return -Infinity;
    var n = parseFloat(t); return isFinite(n)?n:-Infinity;
  }
  function sortable(table, defaultCol, defaultDir) {
    if (!table) return;
    var ths = table.querySelectorAll("thead th");
    ths.forEach(function(th, ci){
      if (th.classList.contains("no-sort")) return;
      th.classList.add("sortable");
      if (!th.querySelector(".arr")) { var sp=document.createElement("span"); sp.className="arr"; sp.textContent="↕"; th.appendChild(sp); }
      th.addEventListener("click", function(){ doSort(table, ci, th); });
    });
    if (defaultCol!=null) {
      var th = ths[defaultCol];
      if (th){ th._dir = defaultDir==="asc"?"asc":"desc"; doSort(table, defaultCol, th, true); }
    }
  }
  function doSort(table, ci, th, keep) {
    var tbody = table.tBodies[0]; if(!tbody) return;
    var rows = [].slice.call(tbody.rows).filter(function(r){ return !r.classList.contains("foot-row"); });
    var dir = keep ? th._dir : (th._dir==="asc"?"desc":"asc");
    th._dir = dir;
    rows.sort(function(a,b){
      var va = parseNum(a.cells[ci] && a.cells[ci].getAttribute("data-sort")!=null ? a.cells[ci].getAttribute("data-sort") : (a.cells[ci]?a.cells[ci].textContent:""));
      var vb = parseNum(b.cells[ci] && b.cells[ci].getAttribute("data-sort")!=null ? b.cells[ci].getAttribute("data-sort") : (b.cells[ci]?b.cells[ci].textContent:""));
      return dir==="asc" ? va-vb : vb-va;
    });
    rows.forEach(function(r){ tbody.appendChild(r); });
    table.querySelectorAll("thead th .arr").forEach(function(a){ a.textContent="↕"; });
    var arr = th.querySelector(".arr"); if (arr) arr.textContent = dir==="asc"?"↑":"↓";
  }

  /* ── шапка: бренд-дропдаун, тема, подзаголовок, пилюли, плашка ───────── */
  function injectProjectDropdown() {
    var brand = document.querySelector(".brand"); if(!brand) return;
    var projects = ["Паша","Дима","Аня","Олег"];
    brand.innerHTML = '<span class="heart">♥</span><span class="brand-name">Проект '+esc(D.meta.project)+'</span><span class="caret">▾</span>';
    var menu = null;
    brand.addEventListener("click", function(e){
      e.stopPropagation();
      if (menu){ menu.remove(); menu=null; return; }
      menu = document.createElement("div"); menu.className="brand-menu";
      menu.innerHTML = projects.map(function(p){ return '<button data-p="'+esc(p)+'">Проект '+esc(p)+'</button>'; }).join("")+
        '<div class="sep"></div><button data-p="__new">+ Новый проект</button>';
      brand.appendChild(menu);
      menu.addEventListener("click", function(ev){
        var b = ev.target.closest("button"); if(!b) return;
        ev.stopPropagation();
        var p = b.getAttribute("data-p");
        if (p==="__new"){ toast("Новый проект — заведи в data.js"); }
        else { brand.querySelector(".brand-name").textContent = "Проект "+p; D.meta.project = p; }
        menu.remove(); menu=null;
      });
    });
    document.addEventListener("click", function(){ if(menu){ menu.remove(); menu=null; } });
  }
  function injectThemeBtn() {
    var btn = el("themeBtn"); if(!btn) return;
    var dark = document.documentElement.getAttribute("data-theme")==="dark";
    btn.textContent = dark ? "☀" : "☾";
    btn.addEventListener("click", function(){
      var now = document.documentElement.getAttribute("data-theme")==="dark";
      try { localStorage.setItem("wowtheme", now ? "light" : "dark"); } catch(e){}
      location.reload();
    });
  }
  function buildHeader() {
    var m = D.meta;
    var sub = '<b>'+esc(m.period.startLabel)+' — '+esc(m.period.endLabel)+'</b> · '+m.months+' мес · лестница из 4 продуктов · '+esc(m.source);
    var st = el("subtitle"); if(st) st.innerHTML = sub;
    var dc = el("dealPill"); if(dc) dc.innerHTML = '<span class="dot"></span>цикл сделки '+m.dealCycleMonths+' мес';
    // плашка "доход на заглушках"
    var bn = el("banner");
    if (bn) {
      if (m.incomeIsPlaceholder) {
        bn.innerHTML = '<span class="pb-ico">⚠</span> Доход на заглушках — ROAS, прибыль и окупаемость пока недостоверны. Залей оплаты, чтобы ожили.';
        bn.style.display = "";
      } else { bn.style.display = "none"; }
    }
  }

  /* ────────────────────────────────────────────────────────────────────────
     ПАНЕЛИ
     ──────────────────────────────────────────────────────────────────────── */

  function weeks(field) {
    var out = [], cur = 0, c = 0;
    D.daily.forEach(function(d, i){
      cur += d[field]; c++;
      if (c===7 || i===D.daily.length-1){ out.push(cur); cur=0; c=0; }
    });
    return out;
  }
  function halfDelta(field) {
    var n = D.daily.length, h = Math.floor(n/2), a=0, b=0;
    D.daily.forEach(function(d,i){ if(i<h) a+=d[field]; else b+=d[field]; });
    var dir = b>a?"up":b<a?"down":"flat";
    var diff = S(Math.abs(b-a), a)*100;
    return { dir:dir, txt: (isFinite(diff)&&a>0 ? F.pct(diff,0) : "—")+" пол-я" };
  }

  /* 01 ОБЗОР */
  function renderObzor() {
    var t = D.totals, dv = D.derived, m = D.meta;
    var incSpark = CH.sparkline(weeks("income"), {color:CH.C.MONEY, w:120, h:30});
    var spSpark  = CH.sparkline(weeks("spend"),  {color:CH.C.SPEND, w:120, h:30});
    var dInc = halfDelta("income"), dSp = halfDelta("spend");
    var profitCls = t.profit>=0 ? "good" : "bad";
    var profitTxt = (t.profit>=0?"":"−")+F.usd(Math.abs(t.profit),0);

    var kpis = [
      metric({label:"Доход (касса)", value:F.usd(t.income,0), delta:dInc.txt, deltaDir:dInc.dir, spark:incSpark}),
      metric({label:"Расход", value:F.usd(t.spend,0), delta:dSp.txt, deltaDir:dSp.dir, spark:spSpark}),
      metric({label:"Прибыль", value:'<span class="'+profitCls+'">'+profitTxt+'</span>'}),
      metric({label:"ROAS", value:F.x(dv.roas)}),
      metric({label:"Лиды", value:F.ru(t.leads,0)}),
      metric({label:"Клиенты", value:F.ru(t.customers,0)})
    ].join("");

    // светофор предельной цены
    var beCard;
    if (m.incomeIsPlaceholder) {
      beCard = '<div class="card be-card"><div class="kpi-label">Предельная цена лида</div>'+
        '<div class="be-row"><span class="be-big">—</span><span class="be-fact">факт CPL '+F.usd(dv.cpl,2)+'</span></div>'+
        '<div class="be-note">залей оплаты, чтобы посчитать</div></div>';
    } else {
      var good = dv.cpl <= dv.breakevenCpl;
      var reserve = S(dv.cpl, dv.breakevenCpl)*100;
      beCard = '<div class="card be-card '+(good?"good":"bad")+'">'+
        '<div class="kpi-label">Предельная цена лида</div>'+
        '<div class="be-row"><span class="be-big">'+F.usd(dv.breakevenCpl,2)+'</span>'+
        '<span class="be-fact">факт CPL '+F.usd(dv.cpl,2)+' · '+(good?"запас":"перерасход")+' '+F.pct(good?100-reserve:reserve-100,0)+'</span></div>'+
        '<div class="be-note">выше этой цены лид убыточен</div></div>';
    }

    // дневной журнал
    var rowsHtml = D.daily.slice().reverse().map(function(d){
      var prof = d.income - d.spend, roas = S(d.income, d.spend);
      var pc = prof>=0?"good":"bad", pt = (prof>=0?"+":"−")+F.usd(Math.abs(prof),0);
      return '<tr><td class="l">'+esc(d.label)+'</td><td>'+F.usd(d.spend,0)+'</td><td>'+F.ru(d.leads,0)+
        '</td><td>'+F.usd(S(d.spend,d.leads),2)+'</td><td>'+F.usd(d.income,0)+
        '</td><td class="'+pc+'">'+pt+'</td><td class="'+(roas<1?"bad":"")+'">'+F.x(roas)+'</td></tr>';
    }).join("");
    var totProf = t.profit, tpc = totProf>=0?"good":"bad";
    var daylog =
      '<details class="daylog" open><summary>Журнал по дням — <b>'+D.daily.length+'</b> дней · расход <b>'+F.usd(t.spend,0)+
      '</b> · доход <b>'+F.usd(t.income,0)+'</b> · прибыль <b>'+(totProf>=0?"+":"−")+F.usd(Math.abs(totProf),0)+'</b></summary>'+
      '<div class="tbl-wrap scroll"><table><thead><tr><th class="l">Дата</th><th>Расход</th><th>Лиды</th>'+
      '<th>Цена лида</th><th>Доход</th><th>Прибыль</th><th>ROAS</th></tr></thead><tbody>'+rowsHtml+
      '</tbody><tfoot><tr class="foot-row"><td class="l">Итого</td><td>'+F.usd(t.spend,0)+'</td><td>'+F.ru(t.leads,0)+
      '</td><td>'+F.usd(dv.cpl,2)+'</td><td>'+F.usd(t.income,0)+'</td><td class="'+tpc+'">'+(totProf>=0?"+":"−")+F.usd(Math.abs(totProf),0)+
      '</td><td class="'+(dv.roas<1?"bad":"")+'">'+F.x(dv.roas)+'</td></tr></tfoot></table></div></details>';

    // столбики по месяцам
    var gb = CH.groupedBars({ data: D.monthly.map(function(mm){ return {label:mm.label.split(" ")[0], spend:mm.spend, income:mm.income}; }), h:200 });
    // доход по странам
    var geoSorted = D.geo.slice().sort(function(a,b){return b.revenue-a.revenue;});
    var geoBars = CH.bars({ data: geoSorted.map(function(g){ return {label:g.name, value:g.revenue, sub:F.usdC(g.revenue)}; }) });

    // hero
    var hero =
      '<div class="hero-stats">'+
      heroStat("Доход", F.usd(t.income,0))+heroStat("Расход", F.usd(t.spend,0))+
      heroStat("Прибыль", (totProf>=0?"+":"−")+F.usd(Math.abs(totProf),0))+
      heroStat("ROAS", F.x(dv.roas))+heroStat("Доход в день", F.usd(dv.incomePerDay,1))+'</div>'+
      '<div class="chart-box">'+CH.dailyDual({daily:D.daily, h:220})+'</div>'+
      legend([{color:CH.C.MONEY,label:"Доход"},{color:CH.C.SPEND,label:"Расход"}]);

    return panelHead("obzor")+
      '<div class="grid grid-6">'+kpis+'</div>'+
      '<div class="grid grid-3" style="margin-top:14px">'+beCard+
        '<div class="card"><div class="card-title">Расход / доход по месяцам</div><div class="chart-box">'+gb+'</div>'+
        legend([{color:CH.C.SPEND,label:"Расход"},{color:CH.C.MONEY,label:"Доход"}])+'</div>'+
        '<div class="card"><div class="card-title">Доход по странам</div><div class="chart-box">'+geoBars+'</div></div>'+
      '</div>'+
      '<div class="section-head"><h2>Расходы и доход по дням · весь период</h2></div>'+daylog+
      '<div class="card pad-lg" style="margin-top:14px"><div class="card-title">Динамика за весь период</div>'+hero+'</div>';
  }
  function heroStat(l,v){ return '<div class="hero-stat"><div class="hs-l">'+esc(l)+'</div><div class="hs-v">'+v+'</div></div>'; }

  /* 02 ВОРОНКА */
  function renderVoronka() {
    var fn = D.funnel, dv = D.derived, m = D.meta;
    var steps = fn.steps.map(function(s, i){
      var next = fn.steps[i+1];
      var conv = next ? S(next.value, s.value)*100 : null;
      return '<div class="fstep"><div class="fs-name">'+esc(s.name)+'</div><div class="fs-val">'+F.ru(s.value,0)+
        '</div><div class="fs-meta">цена шага '+F.usd(s.cost,2)+(conv!=null?' · → '+F.pct(conv,1):'')+'</div></div>';
    }).join("");

    var convCards = [
      ["Клик → Лид", F.pct(fn.conv.clickLead,1)],
      ["Лид → Вебинар", F.pct(fn.conv.leadWeb,1)],
      ["Вебинар → Клиент", F.pct(fn.conv.webClient,1)],
      ["Лид → Клиент", F.pct(fn.conv.leadClient,1)]
    ].map(function(c){ return '<div class="card kpi"><div class="kpi-label">'+c[0]+'</div><div class="kpi-val">'+c[1]+'</div></div>'; }).join("");

    var segRows = D.segments.map(function(s){
      return '<tr><td class="l">'+esc(s.name)+'</td><td>'+F.ru(s.leads,0)+'</td><td>'+F.ru(s.customers,0)+
        '</td><td>'+F.usd(s.revenue,0)+'</td><td style="background:'+roiColor(s.roas)+'">'+F.x(s.roas)+'</td></tr>';
    }).join("");

    var beVal = m.incomeIsPlaceholder ? "—" : F.usd(dv.breakevenCpl,2);
    var unit = [
      ["CAC", F.usd(dv.cac,2)],["AOV", F.usd(dv.aov,2)],["LTV", F.usd(dv.ltv,2)],
      ["LTV / CAC", F.x(dv.ltvCac)],["Окупаемость", F.pct(S(dv.ltv,dv.cac)*100,0)],
      ["Предельный CPL", beVal+'<div class="kpi-foot">потолок цены лида</div>']
    ].map(function(c){ return '<div class="card kpi"><div class="kpi-label">'+c[0]+'</div><div class="kpi-val">'+c[1]+'</div></div>'; }).join("");

    return panelHead("voronka")+
      '<div class="section-head"><h2>Ступени воронки</h2><span class="hint">клик → лид → вебинар → клиент</span></div>'+
      '<div class="funnel-steps">'+steps+'</div>'+
      '<div class="card" style="margin-top:14px"><div class="card-title">Воронка</div><div class="chart-box">'+CH.funnel({steps:fn.steps, h:200})+'</div></div>'+
      '<div class="section-head"><h2>Конверсии между шагами</h2></div><div class="grid grid-4">'+convCards+'</div>'+
      '<div class="section-head"><h2>Юнит-экономика</h2></div><div class="grid grid-6">'+unit+'</div>'+
      '<div class="section-head"><h2>Разрез по сегментам</h2></div>'+
      '<div class="tbl-wrap"><table id="tblSeg"><thead><tr><th class="l">Сегмент</th><th>Лиды</th><th>Клиенты</th><th>Выручка</th><th>ROI</th></tr></thead><tbody>'+segRows+'</tbody></table></div>';
  }

  /* 03 ГЕО */
  function renderGeo() {
    var rows = D.geo.map(function(g){
      var roi = g.roas;
      return '<tr><td class="l">'+esc(g.name)+'</td><td>'+F.ru(g.customers,0)+'</td><td>'+F.usd(g.spend,0)+
        '</td><td>'+F.usd(g.revenue,0)+'</td><td style="background:'+roiColor(roi)+'">'+F.x(roi)+'</td></tr>';
    }).join("");
    var ts=0,tc=0,trv=0,tcu=0; D.geo.forEach(function(g){ts+=g.spend;trv+=g.revenue;tcu+=g.customers;});
    var foot = '<tfoot><tr class="foot-row"><td class="l">Итого</td><td>'+F.ru(tcu,0)+'</td><td>'+F.usd(ts,0)+'</td><td>'+F.usd(trv,0)+
      '</td><td style="background:'+roiColor(S(trv,ts))+'">'+F.x(S(trv,ts))+'</td></tr></tfoot>';

    var bubbles = D.geo.map(function(g){
      return { x:g.cpl, y:g.roas, r:g.spend, label:g.name, good:g.roas>=1 };
    });
    var sc = CH.scatter({ data:bubbles, xLabel:"CPL →", yLabel:"ROAS ↑", h:280 });

    var segRows = D.segments.map(function(s){
      return '<tr><td class="l">'+esc(s.name)+'</td><td>'+F.ru(s.customers,0)+'</td><td>'+F.usd(s.spend,0)+
        '</td><td>'+F.usd(s.revenue,0)+'</td><td style="background:'+roiColor(s.roas)+'">'+F.x(s.roas)+'</td></tr>';
    }).join("");

    return panelHead("geo")+
      '<div class="section-head"><h2>Окупаемость по странам</h2></div>'+
      '<div class="tbl-wrap"><table id="tblGeo"><thead><tr><th class="l">Гео</th><th>Клиенты</th><th>Расход</th><th>Выручка</th><th>ROI</th></tr></thead><tbody>'+rows+'</tbody>'+foot+'</table></div>'+
      '<div class="card" style="margin-top:14px"><div class="card-title">CPL × ROAS (размер пузыря = расход)</div><div class="chart-box">'+sc+'</div></div>'+
      '<div class="section-head"><h2>Разрез по сегментам</h2></div>'+
      '<div class="tbl-wrap"><table id="tblGeoSeg"><thead><tr><th class="l">Сегмент</th><th>Клиенты</th><th>Расход</th><th>Выручка</th><th>ROI</th></tr></thead><tbody>'+segRows+'</tbody></table></div>';
  }

  /* 04 КОГОРТЫ */
  var cohState = { mode:"sub", period:"all", matMetric:"$", prodFilter:"all", geoFilter:"all", cols:{pdp:true,spend:true,pct:true,total:true,roi:true} };

  function cohRows() {
    var rows = (cohState.mode==="pay") ? D.cohortsPay : D.cohortsSub;
    rows = rows.slice();
    if (cohState.period==="3m") rows = rows.slice(-3);
    return rows.slice().reverse();   // новые сверху
  }
  function stackbar(prods, total) {
    if (!total) return "";
    return '<div class="stackbar">'+prods.map(function(p,k){
      var w = S(p.usd,total)*100;
      return w>0?'<span style="width:'+w.toFixed(2)+'%;background:'+D.products[k].color+'"></span>':"";
    }).join("")+'</div>';
  }
  function renderCohSummaryTable() {
    var rows = cohRows();
    var head = '<thead><tr><th class="l sticky-col no-sort">Месяц</th><th class="col-pdp">ПДП</th><th class="col-spend">Расход</th>';
    D.products.forEach(function(p,k){
      head += '<th class="col-pct pc pc'+(k+1)+'">'+p.code+' %</th><th class="col-pct pc pc'+(k+1)+'">'+p.code+' $</th>';
    });
    head += '<th class="col-total">Всего $</th><th class="col-roi">ROI</th></tr></thead>';
    var body = rows.map(function(r){
      var tds = '<td class="l sticky-col">'+esc(r.label)+'</td>'+
        '<td class="col-pdp">'+F.ru(r.pdp,0)+'</td><td class="col-spend">'+F.usd(r.spend,0)+'</td>';
      r.products.forEach(function(p,k){
        tds += '<td class="col-pct pc pc'+(k+1)+'">'+F.pct(p.pct,1)+'</td>'+
               '<td class="col-pct pc pc'+(k+1)+'">'+F.usd(p.usd,0)+'</td>';
      });
      tds += '<td class="col-total" data-sort="'+r.total+'">'+F.usd(r.total,0)+stackbar(r.products, r.total)+'</td>'+
             '<td class="col-roi" data-sort="'+r.roi+'" style="background:'+roiColor(r.roi)+'">'+F.x(r.roi)+'</td>';
      return '<tr>'+tds+'</tr>';
    }).join("");
    // итого
    var T={pdp:0,spend:0,total:0,prods:[0,0,0,0]};
    rows.forEach(function(r){ T.pdp+=r.pdp;T.spend+=r.spend;T.total+=r.total; r.products.forEach(function(p,k){T.prods[k]+=p.usd;}); });
    var foot = '<tfoot><tr class="foot-row"><td class="l sticky-col">Итого</td><td class="col-pdp">'+F.ru(T.pdp,0)+
      '</td><td class="col-spend">'+F.usd(T.spend,0)+'</td>';
    D.products.forEach(function(p,k){
      foot += '<td class="col-pct pc pc'+(k+1)+'">'+F.pct(S(T.prods[k],T.total)*100,1)+'</td><td class="col-pct pc pc'+(k+1)+'">'+F.usd(T.prods[k],0)+'</td>';
    });
    foot += '<td class="col-total">'+F.usd(T.total,0)+'</td><td class="col-roi" style="background:'+roiColor(S(T.total,T.spend))+'">'+F.x(S(T.total,T.spend))+'</td></tr></tfoot>';
    var html = '<table id="tblCoh">'+head+'<tbody>'+body+'</tbody>'+foot+'</table>';
    return html;
  }
  function applyColFilters() {
    var tbl = el("tblCoh"); if(!tbl) return;
    // Столбцы popup
    var map = {pdp:"col-pdp",spend:"col-spend",pct:"col-pct",total:"col-total",roi:"col-roi"};
    Object.keys(map).forEach(function(key){
      var show = cohState.cols[key];
      tbl.querySelectorAll("."+map[key]).forEach(function(c){ c.classList.toggle("col-hidden", !show); });
    });
    // product filter
    for (var k=1;k<=4;k++){
      var show = (cohState.prodFilter==="all" || cohState.prodFilter==="П"+k);
      tbl.querySelectorAll(".pc"+k).forEach(function(c){ c.classList.toggle("prod-hidden", !show); });
    }
  }
  function refreshCohTable() {
    var host = el("cohTableHost"); if(!host) return;
    host.innerHTML = '<div class="tbl-wrap">'+renderCohSummaryTable()+'</div>';
    sortable(el("tblCoh"));
    applyColFilters();
  }
  function renderMatrix() {
    var mw = D.matrixWindows, metric = cohState.matMetric;
    var rows = D.cohortMatrix.slice().reverse();
    // макс по столбцу для $-заливки
    var colMax = {}; mw.forEach(function(w){ var mx=0; rows.forEach(function(r){ if(r.win[w]!=null) mx=Math.max(mx,r.win[w]); }); colMax[w]=mx; });
    var head = '<thead><tr><th class="l sticky-col no-sort">Месяц</th>'+mw.map(function(w){return '<th>→'+w+' дн</th>';}).join("")+'<th>Расход</th></tr></thead>';
    var body = rows.map(function(r){
      var tds = '<td class="l sticky-col">'+esc(r.label)+'</td>';
      mw.forEach(function(w){
        var v = r.win[w];
        if (v==null){ tds += '<td class="muted-cell">—</td>'; return; }
        var ratio = S(v, r.spend), bg, txt;
        if (metric==="$"){ bg = colMax[w]>0?"rgba(61,220,151,"+Math.min(0.40,(v/colMax[w])*0.40).toFixed(3)+")":"transparent"; txt=F.usdC(v); }
        else if (metric==="%"){ bg = roiColor(ratio); txt=F.pct(ratio*100,0); }
        else { bg = roiColor(ratio); txt=F.x(ratio); }
        tds += '<td style="background:'+bg+'">'+txt+'</td>';
      });
      tds += '<td>'+F.usd(r.spend,0)+'</td>';
      return '<tr>'+tds+'</tr>';
    }).join("");
    return '<div class="tbl-wrap"><table>'+head+'<tbody>'+body+'</tbody></table></div>';
  }
  function refreshMatrix(){ var h=el("cohMatrixHost"); if(h) h.innerHTML = renderMatrix(); }

  function renderRazrezy() {
    // лестница продуктов
    var maxRev = Math.max.apply(null, D.productTotals.map(function(p){return p.revenue;}).concat([1]));
    var ladder = D.productTotals.map(function(p){
      return '<tr><td class="l"><span class="sq" style="display:inline-block;width:10px;height:10px;border-radius:3px;background:'+p.color+';margin-right:6px"></span>'+
        p.code+' '+esc(p.name)+'</td><td>'+F.usd(p.price,0)+'</td><td>'+F.ru(p.count,0)+
        '</td><td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:'+S(p.revenue,maxRev)*100+'%"></div></div>'+F.usd(p.revenue,0)+'</div></td>'+
        '<td>'+F.pct(p.share,1)+'</td><td>'+F.usd(p.avg,1)+'</td></tr>';
    }).join("");
    var Tr=0,Tc=0; D.productTotals.forEach(function(p){Tr+=p.revenue;Tc+=p.count;});
    var ladderFoot = '<tfoot><tr class="foot-row"><td class="l">Итого</td><td></td><td>'+F.ru(Tc,0)+'</td><td>'+F.usd(Tr,0)+'</td><td>100%</td><td>'+F.usd(S(Tr,Tc),1)+'</td></tr></tfoot>';

    var geoRows = D.geo.map(function(g){
      return '<tr data-geo="'+esc(g.name)+'"><td class="l">'+esc(g.name)+'</td><td>'+F.ru(g.customers,0)+'</td><td>'+F.usd(g.spend,0)+
        '</td><td>'+F.usd(g.revenue,0)+'</td><td style="background:'+roiColor(g.roas)+'">'+F.x(g.roas)+'</td></tr>';
    }).join("");
    var segRows = D.segments.map(function(s){
      return '<tr><td class="l">'+esc(s.name)+'</td><td>'+F.ru(s.leads,0)+'</td><td>'+F.ru(s.customers,0)+
        '</td><td>'+F.usd(s.revenue,0)+'</td><td style="background:'+roiColor(s.roas)+'">'+F.x(s.roas)+'</td></tr>';
    }).join("");
    var maxC = Math.max.apply(null, D.creatives.map(function(c){return c.revenue;}).concat([1]));
    var creRows = D.creatives.slice().sort(function(a,b){return b.spend-a.spend;}).slice(0,12).map(function(c){
      return '<tr><td class="l">'+esc(c.name)+' · '+esc(c.launchLabel)+'</td><td>'+F.usd(c.spend,0)+'</td><td>'+F.ru(c.customers,0)+
        '</td><td>'+F.usd(c.aov,1)+'</td><td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:'+S(c.revenue,maxC)*100+'%"></div></div>'+F.usd(c.revenue,0)+'</div></td>'+
        '<td style="background:'+roiColor(c.roas)+'">'+F.x(c.roas)+'</td></tr>';
    }).join("");

    return '<div class="section-head"><h2>Лестница продуктов</h2></div>'+
      '<div class="tbl-wrap"><table><thead><tr><th class="l">Продукт</th><th>Цена</th><th>Оплат</th><th>Выручка</th><th>Доля</th><th>Ср.чек</th></tr></thead><tbody>'+ladder+'</tbody>'+ladderFoot+'</table></div>'+
      '<div class="section-head"><h2>Разрез по гео</h2></div>'+
      '<div class="tbl-wrap"><table id="tblCohGeo"><thead><tr><th class="l">Гео</th><th>Клиенты</th><th>Расход</th><th>Выручка</th><th>ROI</th></tr></thead><tbody>'+geoRows+'</tbody></table></div>'+
      '<div class="section-head"><h2>Разрез по сегментам</h2></div>'+
      '<div class="tbl-wrap"><table id="tblCohSeg"><thead><tr><th class="l">Сегмент</th><th>Лиды</th><th>Клиенты</th><th>Выручка</th><th>ROI</th></tr></thead><tbody>'+segRows+'</tbody></table></div>'+
      '<div class="section-head"><h2>Топ креативов по расходу</h2></div>'+
      '<div class="tbl-wrap"><table id="tblCohCre"><thead><tr><th class="l">Креатив · запуск</th><th>Расход</th><th>Клиенты</th><th>Ср.чек</th><th>Выручка</th><th>ROI</th></tr></thead><tbody>'+creRows+'</tbody></table></div>';
  }

  function renderInsights() {
    var K = D.cohortKpi, ins = [];
    // 1 лучшая зрелая когорта по ROI
    var mature = D.cohortsSub.filter(function(r){ return r.mat>=0.8; });
    var best = mature.slice().sort(function(a,b){return b.roi-a.roi;})[0];
    ins.push({ic:"🏆",ti:"Лучшая зрелая когорта", tx: best? esc(best.label)+" — ROI "+F.x(best.roi)+" при расходе "+F.usd(best.spend,0)+"." : "Зрелых когорт пока нет."});
    // 2 свежие недозревшие
    var ahead = 0; D.cohortMatrix.forEach(function(r){ /* eventual */ });
    var aheadSum = D.cohortsSub.reduce(function(s,r,i){ var ev=D.cohortMatrix[i].eventual; return s+(ev-r.total); },0);
    ins.push({ic:"🌱",ti:"Свежие когорты дозревают", tx:"Впереди ещё ≈ "+F.usd(aheadSum,0)+" выручки от недозревших когорт (eventual − realized)."});
    // 3 продукт-лидер
    var lead = D.productTotals.slice().sort(function(a,b){return b.revenue-a.revenue;})[0];
    ins.push({ic:"💰",ti:"Продукт-лидер выручки", tx: lead? esc(lead.name)+" даёт "+F.pct(lead.share,0)+" выручки ("+F.usd(lead.revenue,0)+")." : "—"});
    // 4 наставничество
    var p4 = D.productTotals[3];
    ins.push({ic:"🎯",ti:"Наставничество", tx: esc(p4.name)+": всего "+F.ru(p4.count,0)+" оплат, но "+F.pct(p4.share,0)+" выручки — высокий чек тянет кассу."});
    // 5 окупаемость к 90 дню vs бенч
    var pb90 = K.payback[90], b90 = D.cohortBench[90];
    ins.push({ic:"📈",ti:"Окупаемость к 90 дню", tx:"Когорта набирает "+F.pct(pb90,0)+" LTV к 90 дню (бенч "+b90+"%) — "+(pb90>=b90?"в норме":"ниже бенча")+"."});
    // 6 blended / прогноз
    ins.push({ic:"🔮",ti:"Прогноз окупаемости", tx:"Blended ROI сейчас "+F.x(K.blendedRoi)+", прогноз на полный цикл — "+F.x(K.projRoas)+" (LTV когорт "+F.usd(K.eventualTotal,0)+")."});

    return '<div class="insights">'+ins.map(function(i){
      return '<div class="insight"><div class="ic">'+i.ic+'</div><div class="ti">'+esc(i.ti)+'</div><div class="tx">'+i.tx+'</div></div>';
    }).join("")+'</div>';
  }

  function renderKogorty() {
    var K = D.cohortKpi;
    var csum = '<div class="csum">'+
      csumCard("Выручка всего", F.usd(K.revenue,0))+
      csumCard("Клиентов", F.ru(K.clients,0), F.ru(K.oplaty,0)+" оплат · повтор "+F.x(K.repeat))+
      csumCard("Средний чек", F.usd(K.avgPerClient,1), "на оплату "+F.usd(K.avgPerPayment,1))+
      csumCard("Расходы всего", F.usd(D.totals.spend,0))+
      csumCard("Blended ROI", F.x(K.blendedRoi))+
      csumCard("Окупаемость", F.pct(K.payback[90],0)+" · "+F.pct(K.payback[180],0)+" · "+F.pct(K.payback[360],0), "90·180·360 дн · бенч 28/48/70%")+
      csumCard("Прогноз LTV когорт", F.usd(K.eventualTotal,0), "полный цикл → ROI "+F.x(K.projRoas))+
    '</div>';

    var toolbar =
      '<div class="toolbar">'+
        '<div class="subtabs" id="cohSubtabs">'+
          '<button data-st="svodka" class="on">Сводка</button><button data-st="matrica">Матрица</button>'+
          '<button data-st="razrezy">Разрезы</button><button data-st="insights">Инсайты</button></div>'+
        '<span class="spacer"></span>'+
        '<select id="cohProd"><option value="all">Все продукты</option>'+D.products.map(function(p){return '<option value="'+p.code+'">'+p.code+' '+esc(p.name)+'</option>';}).join("")+'</select>'+
        '<select id="cohGeo"><option value="all">Все гео</option>'+D.geo.map(function(g){return '<option value="'+esc(g.name)+'">'+esc(g.name)+'</option>';}).join("")+'</select>'+
        '<select id="cohPeriod"><option value="all">Весь период</option><option value="3m">Последние 3 мес</option></select>'+
        '<div class="colpop"><button class="btn" id="cohColsBtn">⚙ Столбцы</button></div>'+
        '<button class="btn" id="cohCsv">⬇ CSV</button><button class="btn" id="cohPng">⬚ PNG</button>'+
      '</div>';

    var ladderLegend = '<div class="ladder-legend">'+D.products.map(function(p){
      return '<span class="li"><span class="sq" style="background:'+p.color+'"></span><b>'+p.code+'</b> '+esc(p.name)+' · '+F.usd(p.price,0)+'</span>';
    }).join("")+'</div>';

    var svodka = '<div class="coh-sub" data-cs="svodka">'+ladderLegend+
      '<div style="margin:10px 0"><span class="seg-toggle" id="cohMode"><button data-m="sub" class="on">по подписке</button><button data-m="pay">по оплате</button></span></div>'+
      '<div id="cohTableHost"></div></div>';

    var matrica = '<div class="coh-sub" data-cs="matrica" hidden>'+
      '<div style="margin:10px 0"><span class="seg-toggle" id="cohMatMetric"><button data-mm="$" class="on">Выручка $</button><button data-mm="%">Окупаемость %</button><button data-mm="ROI">ROI ×</button></span></div>'+
      '<div id="cohMatrixHost"></div></div>';

    var razrezy = '<div class="coh-sub" data-cs="razrezy" hidden id="cohRazrezyHost"></div>';
    var insights = '<div class="coh-sub" data-cs="insights" hidden id="cohInsightsHost"></div>';

    return panelHead("kogorty")+csum+toolbar+svodka+matrica+razrezy+insights;
  }
  function csumCard(l,v,sub){ return '<div class="csum-card"><div class="csum-label">'+esc(l)+'</div><div class="csum-val">'+v+'</div>'+(sub?'<div class="csum-sub">'+esc(sub)+'</div>':'')+'</div>'; }

  /* 05 КРЕАТИВЫ */
  function renderKreativy() {
    var bubbles = D.creatives.map(function(c){ return {x:S(c.spend,c.leads), y:c.roas, r:c.spend, label:c.name, good:c.roas>=1}; });
    var sc = CH.scatter({ data:bubbles, xLabel:"CPL →", yLabel:"ROAS ↑", h:300 });
    var maxRev = Math.max.apply(null, D.creatives.map(function(c){return c.revenue;}).concat([1]));
    var rows = D.creatives.slice().sort(function(a,b){return b.spend-a.spend;}).map(function(c){
      return '<tr><td class="l">'+esc(c.name)+'</td><td class="l">'+esc(c.format)+'</td><td class="l">'+esc(c.launchLabel)+'</td>'+
        '<td>'+F.usd(c.spend,0)+'</td><td>'+F.ru(c.leads,0)+'</td><td>'+F.usd(c.cpl,2)+'</td>'+
        '<td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:'+S(c.revenue,maxRev)*100+'%"></div></div>'+F.usd(c.revenue,0)+'</div></td>'+
        '<td style="background:'+roiColor(c.roas)+'">'+F.x(c.roas)+'</td></tr>';
    }).join("");
    var fmtRows = D.formats.map(function(f){
      return '<tr><td class="l">'+esc(f.name)+'</td><td>'+F.ru(f.count,0)+'</td><td>'+F.usd(f.spend,0)+
        '</td><td>'+F.usd(f.revenue,0)+'</td><td style="background:'+roiColor(f.roas)+'">'+F.x(f.roas)+'</td></tr>';
    }).join("");

    return panelHead("kreativy")+
      '<div class="card"><div class="card-title">CTR/CPL × ROAS (размер = расход)</div><div class="chart-box">'+sc+'</div></div>'+
      '<div class="section-head"><h2>Лидерборд креативов</h2></div>'+
      '<div class="tbl-wrap scroll"><table id="tblCre"><thead><tr><th class="l">Креатив</th><th class="l">Формат</th><th class="l">Запуск</th><th>Расход</th><th>Лиды</th><th>CPL</th><th>Выручка</th><th>ROI</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<div class="section-head"><h2>Разрез по форматам</h2></div>'+
      '<div class="tbl-wrap"><table id="tblFmt"><thead><tr><th class="l">Формат</th><th>Кол-во</th><th>Расход</th><th>Выручка</th><th>ROAS</th></tr></thead><tbody>'+fmtRows+'</tbody></table></div>';
  }

  /* 06 ОПЛАТЫ */
  var prodByCode = {};
  function renderOplaty() {
    D.products.forEach(function(p){ prodByCode[p.code]=p; });
    var P = D.payments;
    var sum = P.reduce(function(s,p){return s+p.usd;},0);
    var debt = P.reduce(function(s,p){return s+p.debt;},0);
    var debtN = P.filter(function(p){return p.debt>0;}).length;
    var summary = '<div class="card" style="margin-bottom:14px"><div class="card-title">Сводка</div>'+
      '<div style="font-size:15px">Всего платежей: <b>'+P.length+'</b> · Сумма: <b>'+F.usd(sum,0)+'</b> · Должны: <b class="bad">'+F.usd(debt,0)+'</b> · '+debtN+' шт</div></div>';

    var toolbar = '<div class="toolbar">'+
      '<button class="btn" id="payAdd">+ оплата</button>'+
      '<select id="payProd"><option value="all">Все продукты</option>'+D.products.map(function(p){return '<option value="'+p.code+'">'+p.code+' '+esc(p.name)+'</option>';}).join("")+'</select>'+
      '<select id="payGeo"><option value="all">Все гео</option>'+uniq(P.map(function(p){return p.geo;})).map(function(g){return '<option value="'+esc(g)+'">'+esc(g)+'</option>';}).join("")+'</select>'+
      '<input id="paySearch" placeholder="поиск по нику" style="background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:6px 10px;font-size:12.5px">'+
      '<div class="colpop"><button class="btn" id="payColsBtn">⚙ Столбцы</button></div>'+
      '<button class="btn" id="payCsv">⬇ CSV</button></div>';

    var rows = P.slice().sort(function(a,b){return a.date<b.date?1:-1;}).map(function(p){
      var pr = prodByCode[p.product]||{name:p.product,color:"var(--spend)"};
      return '<tr data-prod="'+esc(p.product)+'" data-geo="'+esc(p.geo)+'" data-nick="'+esc((p.igNick+" "+p.tgNick).toLowerCase())+'">'+
        '<td class="l sticky-col">'+esc(p.date)+'</td><td class="l">'+esc(p.igNick)+'</td><td class="l">'+esc(p.tgNick)+'</td>'+
        '<td class="l">'+esc(p.subDate)+'</td><td>'+F.ru(p.days,0)+'</td><td class="l">'+esc(p.geo)+'</td><td class="l">'+esc(p.creative)+'</td>'+
        '<td class="l"><span class="sq" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+pr.color+';margin-right:5px"></span>'+esc(p.product)+'</td>'+
        '<td>'+F.ru(p.rub,0)+'</td><td>'+F.usd(p.usd,0)+'</td><td class="'+(p.debt>0?"bad":"")+'">'+F.usd(p.debt,0)+'</td></tr>';
    }).join("");
    var tr=0,tu=0,td=0; P.forEach(function(p){tr+=p.rub;tu+=p.usd;td+=p.debt;});
    var foot = '<tfoot><tr class="foot-row"><td class="l sticky-col">Итого</td><td class="l"></td><td class="l"></td><td class="l"></td><td></td><td class="l"></td><td class="l"></td><td class="l"></td><td>'+F.ru(tr,0)+'</td><td>'+F.usd(tu,0)+'</td><td class="bad">'+F.usd(td,0)+'</td></tr></tfoot>';

    var table = '<div class="tbl-wrap scroll"><table id="tblPay"><thead><tr>'+
      '<th class="l sticky-col">Дата оплаты</th><th class="l">Ник IG</th><th class="l">Ник TG</th><th class="l">Подписка</th><th>Дни</th>'+
      '<th class="l">Гео</th><th class="l">С какого креатива</th><th class="l">Тариф</th><th>₽</th><th>$</th><th>Долг</th></tr></thead><tbody>'+rows+'</tbody>'+foot+'</table></div>';

    var note = '<div class="tab-intro" style="margin-top:12px">Это тестовые строки-пример. Замени их своими оплатами (или подключи CRM) — тогда оживут доход, ROAS и когорты во всех вкладках. Никаких чужих/реальных данных в шаблон не вшито.</div>';

    return panelHead("oplaty")+summary+toolbar+table+note;
  }
  function uniq(a){ var o={},r=[]; a.forEach(function(x){if(!o[x]){o[x]=1;r.push(x);}}); return r; }

  function panelHead(id) {
    var t = TABS.filter(function(x){return x.id===id;})[0];
    return '<h1 style="font-size:21px;font-weight:650;margin:4px 0 2px;letter-spacing:-.01em">'+esc(t.h1)+'</h1>'+
           '<div class="tab-intro">'+esc(t.intro)+'</div>';
  }

  /* ── переключатель вкладок ───────────────────────────────────────────── */
  var RENDERERS = { obzor:renderObzor, voronka:renderVoronka, geo:renderGeo, kogorty:renderKogorty, kreativy:renderKreativy, oplaty:renderOplaty };
  var rendered = {};
  function showTab(id) {
    if (!RENDERERS[id]) id = "obzor";
    document.querySelectorAll(".tabs button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-tab")===id); });
    document.querySelectorAll(".panel").forEach(function(p){ p.hidden = p.getAttribute("data-panel")!==id; });
    if (!rendered[id]) {
      var host = document.querySelector('.panel[data-panel="'+id+'"]');
      host.innerHTML = RENDERERS[id]();
      rendered[id] = true;
      wireTab(id, host);
    }
    try { localStorage.setItem("wowtab", id); } catch(e){}
  }
  function injectTabs() {
    var nav = document.querySelector(".tabs"); if(!nav) return;
    nav.innerHTML = TABS.map(function(t){ return '<button data-tab="'+t.id+'">'+esc(t.name)+'</button>'; }).join("");
    nav.addEventListener("click", function(e){ var b=e.target.closest("button"); if(b) showTab(b.getAttribute("data-tab")); });
  }

  /* ── привязка интерактива конкретной вкладки после рендера ───────────── */
  function wireTab(id, host) {
    if (id==="voronka"){ sortable(el("tblSeg")); }
    if (id==="geo"){ sortable(el("tblGeo")); sortable(el("tblGeoSeg")); }
    if (id==="kreativy"){ sortable(el("tblCre")); sortable(el("tblFmt")); }
    if (id==="oplaty"){ wireOplaty(host); }
    if (id==="kogorty"){ wireKogorty(host); }
  }

  function wireKogorty(host) {
    refreshCohTable();
    // подтабы
    host.querySelector("#cohSubtabs").addEventListener("click", function(e){
      var b=e.target.closest("button"); if(!b) return;
      host.querySelectorAll("#cohSubtabs button").forEach(function(x){x.classList.toggle("on",x===b);});
      var st=b.getAttribute("data-st");
      host.querySelectorAll(".coh-sub").forEach(function(p){ p.hidden = p.getAttribute("data-cs")!==st; });
      if (st==="matrica") refreshMatrix();
      if (st==="razrezy" && !el("cohRazrezyHost").innerHTML){ el("cohRazrezyHost").innerHTML=renderRazrezy(); sortable(el("tblCohGeo")); sortable(el("tblCohSeg")); sortable(el("tblCohCre")); applyGeoFilter(); }
      if (st==="insights" && !el("cohInsightsHost").innerHTML){ el("cohInsightsHost").innerHTML=renderInsights(); }
    });
    // режим подписка/оплата
    host.querySelector("#cohMode").addEventListener("click", function(e){
      var b=e.target.closest("button"); if(!b) return;
      host.querySelectorAll("#cohMode button").forEach(function(x){x.classList.toggle("on",x===b);});
      cohState.mode=b.getAttribute("data-m"); refreshCohTable();
    });
    // метрика матрицы
    host.querySelector("#cohMatMetric").addEventListener("click", function(e){
      var b=e.target.closest("button"); if(!b) return;
      host.querySelectorAll("#cohMatMetric button").forEach(function(x){x.classList.toggle("on",x===b);});
      cohState.matMetric=b.getAttribute("data-mm"); refreshMatrix();
    });
    // фильтры
    el("cohProd").addEventListener("change", function(){ cohState.prodFilter=this.value; applyColFilters(); });
    el("cohGeo").addEventListener("change", function(){ cohState.geoFilter=this.value; applyGeoFilter(); });
    el("cohPeriod").addEventListener("change", function(){ cohState.period=this.value; refreshCohTable(); });
    // столбцы
    var colsBtn=el("cohColsBtn");
    colsBtn.addEventListener("click", function(e){
      e.stopPropagation();
      var ex=colsBtn.parentNode.querySelector(".colpop-menu"); if(ex){ex.remove();return;}
      var menu=document.createElement("div"); menu.className="colpop-menu";
      var items=[["pdp","Пдп"],["spend","Расход"],["pct","Проценты %"],["total","Всего $"],["roi","ROI"]];
      menu.innerHTML=items.map(function(it){return '<label><input type="checkbox" data-c="'+it[0]+'" '+(cohState.cols[it[0]]?"checked":"")+'> '+it[1]+'</label>';}).join("");
      colsBtn.parentNode.appendChild(menu);
      menu.addEventListener("click",function(ev){ev.stopPropagation();});
      menu.addEventListener("change",function(ev){ var c=ev.target.getAttribute("data-c"); cohState.cols[c]=ev.target.checked; applyColFilters(); });
      document.addEventListener("click",function cl(){ if(menu)menu.remove(); document.removeEventListener("click",cl); });
    });
    // CSV / PNG
    el("cohCsv").addEventListener("click", exportCohCsv);
    el("cohPng").addEventListener("click", function(){ toast("→ снимай скрин (PNG-экспорт — заглушка)"); });
  }
  function applyGeoFilter() {
    var tbl=el("tblCohGeo"); if(!tbl) return;
    tbl.querySelectorAll("tbody tr").forEach(function(r){
      var on = cohState.geoFilter==="all" || r.getAttribute("data-geo")===cohState.geoFilter;
      r.style.background = (on && cohState.geoFilter!=="all") ? "var(--accent-weak)" : "";
    });
  }
  function exportCohCsv() {
    var rows = cohRows();
    var head = ["Месяц","ПДП","Расход"];
    D.products.forEach(function(p){ head.push(p.code+"%"); head.push(p.code+"$"); });
    head.push("Всего$","ROI");
    var lines=[head.join(";")];
    rows.forEach(function(r){
      var c=[r.label, r.pdp, r.spend];
      r.products.forEach(function(p){ c.push(num(p.pct)); c.push(p.usd); });
      c.push(r.total, num(r.roi));
      lines.push(c.join(";"));
    });
    var blob = new Blob(["﻿"+lines.join("\r\n")], {type:"text/csv;charset=utf-8"});
    var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="cohorts_"+cohState.mode+".csv"; a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);},500);
  }
  function num(n){ return String(Math.round((n||0)*100)/100).replace(".",","); }

  function wireOplaty(host) {
    sortable(el("tblPay"));
    el("payAdd").addEventListener("click", function(){ toast("добавляется в data.js (массив payments)"); });
    function applyPay() {
      var pf=el("payProd").value, gf=el("payGeo").value, q=(el("paySearch").value||"").toLowerCase().trim();
      el("tblPay").querySelectorAll("tbody tr").forEach(function(r){
        var ok = (pf==="all"||r.getAttribute("data-prod")===pf) &&
                 (gf==="all"||r.getAttribute("data-geo")===gf) &&
                 (!q||r.getAttribute("data-nick").indexOf(q)>=0);
        r.style.display = ok?"":"none";
      });
    }
    el("payProd").addEventListener("change",applyPay);
    el("payGeo").addEventListener("change",applyPay);
    el("paySearch").addEventListener("input",applyPay);
    var colsBtn=el("payColsBtn");
    var COLS=[["Ник IG",1],["Ник TG",2],["Подписка",3],["Дни",4],["Гео",5],["Креатив",6],["₽",8],["Долг",10]];
    colsBtn.addEventListener("click", function(e){
      e.stopPropagation();
      var ex=colsBtn.parentNode.querySelector(".colpop-menu"); if(ex){ex.remove();return;}
      var menu=document.createElement("div"); menu.className="colpop-menu";
      menu.innerHTML=COLS.map(function(c){return '<label><input type="checkbox" data-ci="'+c[1]+'" checked> '+c[0]+'</label>';}).join("");
      colsBtn.parentNode.appendChild(menu);
      menu.addEventListener("click",function(ev){ev.stopPropagation();});
      menu.addEventListener("change",function(ev){
        var ci=+ev.target.getAttribute("data-ci"), show=ev.target.checked, tbl=el("tblPay");
        tbl.querySelectorAll("tr").forEach(function(r){ if(r.cells[ci]) r.cells[ci].style.display=show?"":"none"; });
      });
      document.addEventListener("click",function cl(){ if(menu)menu.remove(); document.removeEventListener("click",cl); });
    });
    el("payCsv").addEventListener("click", function(){
      var head=["Дата","НикIG","НикTG","Подписка","Дни","Гео","Креатив","Тариф","RUB","USD","Долг"];
      var lines=[head.join(";")];
      D.payments.forEach(function(p){ lines.push([p.date,p.igNick,p.tgNick,p.subDate,p.days,p.geo,p.creative,p.product,p.rub,p.usd,p.debt].join(";")); });
      var blob=new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
      var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="payments.csv"; a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);},500);
    });
  }

  /* ── ИНТРО-ЗАСТАВКА (эффект "щелчка Таноса") ─────────────────────────── */
  function splash() {
    try { if (localStorage.getItem("wow_splash_seen")) return; } catch(e){}
    var wrap = document.createElement("div"); wrap.id="splash";
    var canvas = document.createElement("canvas");
    var hint = document.createElement("div"); hint.className="hint"; hint.textContent="нажми, чтобы войти";
    wrap.appendChild(canvas); wrap.appendChild(hint); document.body.appendChild(wrap);
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio||1, 2);
    function cssvar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||"#fff"; }
    var W,H;
    function draw() {
      W = wrap.clientWidth; H = wrap.clientHeight;
      canvas.width=W*DPR; canvas.height=H*DPR; canvas.style.width=W+"px"; canvas.style.height=H+"px";
      ctx.setTransform(DPR,0,0,DPR,0,0);
      ctx.clearRect(0,0,W,H);
      var money = cssvar("--money") || "#3DDC97";
      var text = "#EDEDF0";
      var cx=W/2, cy=H/2;
      // сердечко
      ctx.fillStyle=money;
      drawHeart(ctx, cx, cy-78, 22);
      // подпись
      ctx.textAlign="center"; ctx.fillStyle=text;
      ctx.font="500 17px system-ui,-apple-system,Segoe UI,sans-serif";
      ctx.fillText("сделано с любовью от", cx, cy-18);
      ctx.fillStyle=money;
      ctx.font="700 46px system-ui,-apple-system,Segoe UI,sans-serif";
      ctx.fillText(BRAND, cx, cy+34);
    }
    function drawHeart(c,x,y,s){
      c.beginPath();
      c.moveTo(x, y+s*0.3);
      c.bezierCurveTo(x, y, x-s, y-s*0.1, x-s, y+s*0.35);
      c.bezierCurveTo(x-s, y+s*0.75, x, y+s*1.05, x, y+s*1.3);
      c.bezierCurveTo(x, y+s*1.05, x+s, y+s*0.75, x+s, y+s*0.35);
      c.bezierCurveTo(x+s, y-s*0.1, x, y, x, y+s*0.3);
      c.closePath(); c.fill();
    }
    draw();
    var disintegrating=false;
    function explode() {
      if (disintegrating) return; disintegrating=true;
      hint.style.display="none";
      var img;
      try { img = ctx.getImageData(0,0,canvas.width,canvas.height); } catch(e){ finish(); return; }
      var data=img.data, parts=[], step=4*DPR;
      var maxX=W;
      for (var y=0;y<canvas.height;y+=step){
        for (var x=0;x<canvas.width;x+=step){
          var idx=(y*canvas.width+x)*4;
          if (data[idx+3]>40){
            var sx=x/DPR, sy=y/DPR;
            parts.push({ x:sx, y:sy,
              r:data[idx], g:data[idx+1], b:data[idx+2],
              vx:0.4+Math.random()*1.6, vy:-0.4-Math.random()*0.8,
              alpha:1, delay:(sx/maxX)*28 });
          }
        }
      }
      var frame=0;
      function tick(){
        frame++;
        ctx.clearRect(0,0,W,H);
        var alive=0;
        for (var i=0;i<parts.length;i++){
          var p=parts[i];
          if (frame<p.delay){ // ещё не стартовал — рисуем на месте
            ctx.globalAlpha=1; ctx.fillStyle="rgb("+p.r+","+p.g+","+p.b+")";
            ctx.fillRect(p.x,p.y,2,2); alive++; continue;
          }
          p.x+=p.vx; p.y+=p.vy; p.vy+=0.04; p.alpha-=0.022;
          if (p.alpha>0){ alive++; ctx.globalAlpha=Math.max(0,p.alpha); ctx.fillStyle="rgb("+p.r+","+p.g+","+p.b+")"; ctx.fillRect(p.x,p.y,2,2); }
        }
        // плавно гасим тёмный фон
        var op=Math.max(0, 1 - frame/66);
        wrap.style.background="rgba(8,8,10,"+op+")";
        if (alive>0 && frame<200){ requestAnimationFrame(tick); } else { finish(); }
      }
      requestAnimationFrame(tick);
    }
    function finish(){
      try { localStorage.setItem("wow_splash_seen","1"); } catch(e){}
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
    wrap.addEventListener("click", explode);
    window.addEventListener("resize", function(){ if(!disintegrating) draw(); });
  }

  /* ── boot ────────────────────────────────────────────────────────────── */
  function boot() {
    splash();
    injectThemeBtn();
    injectProjectDropdown();
    injectTabs();
    buildHeader();
    var start = "obzor";
    try { var s=localStorage.getItem("wowtab"); if(s && RENDERERS[s]) start=s; } catch(e){}
    showTab(start);
  }

  return {
    boot: boot, metric: metric, sortable: sortable, legend: legend,
    injectThemeBtn: injectThemeBtn, injectProjectDropdown: injectProjectDropdown,
    injectTabs: injectTabs, hexA: hexA, roiColor: roiColor, showTab: showTab
  };
})();

document.addEventListener("DOMContentLoaded", function(){ window.UI.boot(); });
