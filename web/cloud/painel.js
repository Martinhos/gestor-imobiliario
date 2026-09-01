/* Visao geral: movimentos por tras dos indicadores, pendentes e ordem dos cartoes. */
'use strict';

/* =====================================================================
   Painel: movimentos por trás de cada indicador, pendentes nas vistas de
   imóveis e contratos, recusa de planeados e ordem dos cartões da visão
   geral (modo de edição por toque longo).
   ===================================================================== */

var KPI_KINDS = { income: ['income'], op: ['expense'], loan: ['loan'], cf: ['income', 'expense', 'loan'] };

// os indicadores em euros passam a dizer que movimentos os compõem
var _evoMoney = evoMoney;
evoMoney = function (field, pid, fmt) {
  var d = _evoMoney(field, pid, fmt);
  if (d && KPI_KINDS[field]) d.txq = { field: field, pid: pid || null, year: YEAR };
  return d;
};

// mesma regra do metrics(): ano, tipo, fora-dos-totais e peso do imóvel/quota
function kpiTxs(q) {
  var kinds = KPI_KINDS[q.field] || [];
  return (db.transactions || [])
    .filter(function (t) {
      if (String(t.date || '').indexOf(String(q.year)) !== 0) return false;
      if (kinds.indexOf(t.kind) < 0) return false;
      if ((t.kind === 'income' || t.kind === 'expense') && !countsInTotals(t)) return false;
      return txW(t, q.pid) !== 0;
    })
    .map(function (t) { return { t: t, v: t.amount * txShare(t, true) * txW(t, q.pid) }; })
    .sort(function (a, b) { return String(b.t.date).localeCompare(String(a.t.date)); });
}

var _kpiModal = kpiModal;
kpiModal = function (id) {
  if (CW.editMode) return;   // a arrastar cartões, não se abrem indicadores
  var k = KPI_REG[id];
  if (!k) return;
  _kpiModal(id);
  var top = modalTop();
  if (!top) return;
  var d;
  try { d = k.evo(); } catch (e) { d = null; }
  if (!d || !d.txq) return;

  var q = d.txq, rows = kpiTxs(q), show = rows.slice(0, 50);
  var total = rows.reduce(function (a, r) { return a + r.v; }, 0);
  var html = '<div><div class="flabel">Movimentos que somam este valor</div>' +
    (rows.length
      ? '<div class="list" style="gap:7px">' + show.map(function (r) {
          var t = r.t, col = t.kind === 'income' ? 'pos' : (t.kind === 'loan' ? 'amber' : 'neg');
          return '<div class="card tap" style="padding:10px 12px" onclick="CW.openTx(\'' + t.id + '\')">' +
            '<div class="row-between" style="align-items:center;gap:10px">' +
            '<div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(t.label) + '</b>' +
            '<span class="small">' + esc(t.date) + ' · ' + esc((KIND[t.kind] || {}).short || '') +
            (t.category ? ' · ' + esc(t.category) : '') +
            (t.propertyId ? ' · ' + esc(propName(t.propertyId)) : '') + '</span></div>' +
            '<b class="' + col + '" style="flex:0 0 auto">' + euro2(r.v) + '</b></div></div>';
        }).join('') + '</div>' +
        (rows.length > show.length
          ? '<div class="hint" style="margin-top:8px">A mostrar os ' + show.length + ' mais recentes de ' + rows.length + '. Vê todos em Movimentos.</div>'
          : '') +
        '<div class="stat" style="margin-top:8px"><span>Total</span><b>' + euro2(total) + '</b></div>'
      : '<div class="hint">Nenhum movimento registado em ' + q.year + '.</div>') +
    '</div>';

  var body = top.el.querySelector('.body');
  if (body) { var w = document.createElement('div'); w.innerHTML = html; body.appendChild(w.firstChild); }
  var foot = top.el.querySelector('.foot');
  if (foot) {
    foot.innerHTML =
      '<button class="btn" onclick="CW.backToDash(1)">' + ic('chev', 15) + ' Visão geral</button>' +
      '<button class="btn primary" onclick="CW.kpiToTx()">' + ic('swap', 15) + ' Ver nos movimentos</button>';
  }
  CW._kpiQ = { field: q.field, pid: q.pid, year: q.year, title: k.title };
};

CW.openTx = function (id) {
  if ((db.transactions || []).some(function (x) { return x.id === id; })) txModal(id);
};

// salta para os Movimentos já com os filtros do indicador aplicados
CW.kpiToTx = function () {
  var q = CW._kpiQ;
  if (!q) return;
  CW._fromKpi = {
    title: q.title, year: q.year,
    prev: { f: txFilter, p: txProp, c: txCat, s: txSub, pd: txPaid, np: txNoPayer, q: txSearch },
  };
  txFilter = q.field === 'income' ? 'income' : q.field === 'op' ? 'expense' : q.field === 'loan' ? 'loan' : '';
  txProp = q.pid || '';
  txCat = ''; txSub = ''; txPaid = ''; txNoPayer = true;
  txSearch = String(q.year) + '-';   // o ano vive na data de cada movimento
  closeAllModals();
  go('transactions');
};

CW.backToDash = function (fromModal) {
  var f = CW._fromKpi;
  if (f && f.prev) {
    txFilter = f.prev.f; txProp = f.prev.p; txCat = f.prev.c; txSub = f.prev.s;
    txPaid = f.prev.pd; txNoPayer = f.prev.np; txSearch = f.prev.q;
  }
  CW._fromKpi = null;
  if (fromModal) closeAllModals();
  go('dashboard');
};

// barra de regresso quando se chega aos Movimentos vindo de um indicador
var _vTransactions = vTransactions;
vTransactions = function () {
  var h = _vTransactions();
  var f = CW._fromKpi;
  if (!f) return h;
  return '<div class="card" style="margin-bottom:12px;padding:11px 13px;display:flex;align-items:center;gap:11px">' +
    '<span class="small" style="flex:1;min-width:0">Movimentos de <b>' + esc(f.title) + '</b> em ' + f.year + ', vindos da visão geral.</span>' +
    '<button class="btn sm" style="flex:0 0 auto" onclick="CW.backToDash()">' + ic('chev', 14) + ' Visão geral</button></div>' + h;
};

/* ---------------- recusar um movimento planeado ---------------- */

CW.rejectRec = function (id) {
  var r = (db.recurring || []).find(function (x) { return x.id === id; });
  if (!r) return;
  var once = r.every === 'once';
  confirmModal('Recusar movimento',
    'Salta “' + esc(r.name) + '” desta vez: não cria nenhum movimento' +
    (once ? ' e, como só acontecia uma vez, deixa de ser pedido.' : ' e passa à data seguinte. O plano continua ativo.'),
    function () {
      recAdvance(r);
      save(); buildNav(); render();
      toast(once ? 'Movimento recusado.' : 'Recusado — segue para a próxima data.');
    });
};

/* ---------- preencher por estimativa os períodos já passados ----------
   Quem regista um contrato ou uma hipoteca que já vem de trás não vai
   confirmar dezenas de meses um a um. Oferecemos criá-los de uma vez,
   deixando claro que são estimativas. */

// De onde vem a história: o início do contrato ou da hipoteca. A
// recorrência criada por eles arranca no mês corrente, por isso os meses
// anteriores não aparecem em lado nenhum.
function originOf(r) {
  var c = r.tx.contractId ? contract(r.tx.contractId) : null;
  if (c && c.start) return c.start;
  if (r.tx.loanId) {
    var found = '';
    (db.properties || []).forEach(function (p) {
      (p.loans || []).forEach(function (l) { if (l.id === r.tx.loanId && l.start) found = l.start; });
    });
    if (found) return found;
  }
  return r.next;
}

// já existe um movimento deste contrato/hipoteca nesse mês?
function already(r, d) {
  var mo = String(d).slice(0, 7);
  return (db.transactions || []).some(function (t) {
    if (String(t.date || '').indexOf(mo) !== 0) return false;
    if (r.tx.contractId) return t.contractId === r.tx.contractId;
    if (r.tx.loanId) return t.loanId === r.tx.loanId;
    return t.propertyId === r.tx.propertyId && t.label === r.tx.label;
  });
}

function missedDates(r) {
  if (!r || !r.next) return [];
  var t = today(), day = Number(String(r.next).slice(8, 10)) || 1;
  var origin = originOf(r), d;
  if (['month', 'quarter', 'year'].indexOf(r.every) > -1) {
    var o = new Date(origin + 'T00:00:00');
    d = dayInMonth(o.getFullYear(), o.getMonth(), day);
    if (d < origin) d = nextDate(d, r.every);
  } else {
    d = origin;
  }
  var out = [], guard = 0;
  while (d && d <= t && guard++ < 600) {
    if (!already(r, d)) out.push(d);
    if (r.every === 'once') break;
    d = nextDate(d, r.every);
    if (r.end && d > r.end) break;
  }
  return out;
}

var EVERY_WORD = { once: 'ocorrência', week: 'semana', month: 'mês', quarter: 'trimestre', year: 'ano' };

CW.fillMissed = function (id) {
  var r = (db.recurring || []).find(function (x) { return x.id === id; });
  if (!r) return;
  var dates = missedDates(r);
  if (!dates.length) return toast('Não há períodos por preencher.');
  var val0 = Number(r.tx.amount) || 0;
  var per = EVERY_WORD[r.every] || 'período';
  var isLoan = r.tx.kind === 'loan';
  var body = '<div class="form">' +
    '<div class="hint">Vais registar <b>' + dates.length + '</b> movimento' + (dates.length === 1 ? '' : 's') +
    ' de <b>' + esc(r.name) + '</b>, de <b>' + dates[0] + '</b> a <b>' + dates[dates.length - 1] + '</b>, ' +
    'todos com o valor atual de <b>' + euro2(val0) + '</b> por ' + per + '.</div>' +
    '<div class="hint" style="border-left:3px solid var(--warn);padding-left:10px">' +
    '<b>Isto é uma estimativa.</b> O valor de cada período pode não corresponder ao que foi realmente pago: ' +
    'não entra em conta com aumentos de renda, meses em falta, atrasos nem valores diferentes. ' +
    'Confere e corrige depois o que não bater certo.' +
    (isLoan ? ' Como são prestações, o capital em dívida da hipoteca desce com cada uma, tal como se as confirmasses uma a uma.' : '') +
    '</div>' +
    '<div class="hint">Ficam marcados com a etiqueta <b>Estimativa</b> — procura por “estimativa” nos Movimentos para os veres todos.</div>' +
    '<div class="stat" style="margin-top:6px"><span>Total a registar</span><b>' + euro2(val0 * dates.length) + '</b></div></div>';
  openModal('Preencher ' + dates.length + ' ' + (dates.length === 1 ? 'período' : 'períodos'), body,
    '<button class="btn" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn primary" onclick="CW.doFillMissed(\'' + id + '\')">Registar estimativa</button>');
};

CW.doFillMissed = function (id) {
  var r = (db.recurring || []).find(function (x) { return x.id === id; });
  if (!r) return closeModal();
  var dates = missedDates(r), n = 0;
  var tags = db.settings.tags || (db.settings.tags = []);
  if (tags.indexOf('Estimativa') < 0) tags.push('Estimativa');
  for (var i = 0; i < dates.length; i++) {
    var t = recTx(r, dates[i]);
    t.label = (t.label || r.name) + ' (estimativa)';
    t.tags = (t.tags || []).concat(['Estimativa']);
    if (t.kind === 'loan') applyLoan(t);
    db.transactions.push(t);
    n++;
  }
  // as ocorrências já vencidas ficam saldadas: empurra o plano para a frente
  var live = r, guard = 0;
  while (live && live.next && live.next <= today() && guard++ < 600) {
    recAdvance(live);
    live = (db.recurring || []).find(function (x) { return x.id === id; });
  }
  save(); buildNav(); render(); closeAllModals();
  toast(n + ' movimento' + (n === 1 ? '' : 's') + ' registado' + (n === 1 ? '' : 's') + ' por estimativa.');
};

// Depois de gravar um contrato ou uma hipoteca antiga, perguntar uma vez.
var LS_ASKED = 'gi_est_asked';
function asked() {
  try { return JSON.parse(localStorage.getItem(LS_ASKED) || '[]'); } catch (e) { return []; }
}
function markAsked(ids) {
  try { localStorage.setItem(LS_ASKED, JSON.stringify(asked().concat(ids).slice(-200))); } catch (e) {}
}

// Só se pergunta por planos acabados de criar: nada de abordar o
// utilizador por causa de recorrências que já lá estavam.
var knownRecs = null;
function refreshKnown() {
  knownRecs = {};
  (db.recurring || []).forEach(function (r) { knownRecs[r.id] = 1; });
}

function offerFill() {
  if (!CW.user) return;
  if (knownRecs === null) return refreshKnown();
  var seen = asked(), novos = (db.recurring || []).filter(function (r) { return !knownRecs[r.id]; });
  refreshKnown();
  if (modalStack.length) return;
  var cand = novos.filter(function (r) {
    return seen.indexOf(r.id) < 0 && missedDates(r).length >= 2;
  });
  if (!cand.length) return;
  markAsked(cand.map(function (r) { return r.id; }));
  CW.fillMissed(cand[0].id);
}

var REJECT_BTN = function (id) {
  return '<button class="btn sm danger" onclick="event.stopPropagation();CW.rejectRec(\'' + id + '\')">Recusar</button>';
};

// acrescenta "Recusar" a cada linha do cartão de pendentes
var _pendingCard = pendingCard;
pendingCard = function (all) {
  return _pendingCard(all).replace(/skipRec\('([^']+)'\)"[^>]*>[^<]*<\/button>/g, function (m, id) {
    var r = (db.recurring || []).find(function (x) { return x.id === id; });
    var n = r ? missedDates(r).length : 0;
    // com vários períodos em atraso, confirmar um a um não é opção
    var fill = n >= 2
      ? '<button class="btn sm" onclick="event.stopPropagation();CW.fillMissed(\'' + id + '\')">' +
        'Preencher ' + n + ' em falta</button>'
      : '';
    return m + REJECT_BTN(id) + fill;
  });
};

// ... e à lista de opções do toque longo numa recorrência
// acrescenta uma opção ao menu de toque longo que acabou de abrir
function menuOption(opts) {
  var top = modalTop();
  var list = top && top.el.querySelector('.body .list');
  if (!list) return;
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'card tap';
  b.style.cssText = 'padding:12px 14px;display:flex;align-items:center;gap:11px';
  b.innerHTML = '<span class="ic" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;' +
    'background:' + (opts.danger ? 'var(--danger-soft);color:var(--danger)' : 'var(--accent-soft);color:var(--accent)') +
    ';flex:0 0 34px">' + ic(opts.icon, 18) + '</span>' +
    '<span style="flex:1;min-width:0;text-align:left"><b style="display:block;font-size:14px">' + esc(opts.label) + '</b>' +
    (opts.sub ? '<span class="small">' + esc(opts.sub) + '</span>' : '') + '</span>';
  b.onclick = function () { closeAllModals(); opts.act(); };
  if (opts.first && list.firstChild) list.insertBefore(b, list.firstChild.nextSibling);
  else list.appendChild(b);
}

// salta para os Movimentos já filtrados por um imóvel
CW.txOfProp = function (pid) {
  txFilter = ''; txProp = pid; txCat = ''; txSub = ''; txPaid = ''; txNoPayer = true; txSearch = '';
  CW._fromKpi = null;
  go('transactions');
};

var _lpMenu = lpMenu;
lpMenu = function (v) {
  var s = String(v);
  if (s.indexOf('dash:') === 0) return CW.enterEdit(s.slice(5));
  _lpMenu(v);
  var a = s.split(':');
  if (a[0] === 'rec') {
    var r = (db.recurring || []).find(function (x) { return x.id === a[1]; });
    var n = r ? missedDates(r).length : 0;
    if (n >= 2) {
      menuOption({ icon: 'clock', label: 'Preencher ' + n + ' períodos em falta', first: true,
        sub: 'de uma vez, por estimativa', act: function () { CW.fillMissed(a[1]); } });
    }
    menuOption({ icon: 'x', danger: true, label: 'Recusar desta vez',
      sub: 'não cria o movimento e passa à data seguinte', act: function () { CW.rejectRec(a[1]); } });
  } else if (a[0] === 'prop') {
    menuOption({ icon: 'swap', label: 'Ver movimentos', sub: 'lista filtrada por este imóvel', first: true,
      act: function () { CW.txOfProp(a[1]); } });
  } else if (a[0] === 'ct') {
    var c = contract(a[1]);
    if (c && c.propertyId) {
      menuOption({ icon: 'swap', label: 'Ver movimentos', sub: 'lista filtrada pelo imóvel do contrato', first: true,
        act: function () { CW.txOfProp(c.propertyId); } });
    }
  }
};

/* ------- pendentes dentro de cada imóvel e de cada contrato ------- */

function pendBlock(list) {
  return '<div class="cw-pend" style="margin-top:11px;border-top:1px solid var(--line);padding-top:10px">' +
    '<div class="small" style="font-weight:650;margin-bottom:7px">' +
    list.length + ' movimento' + (list.length === 1 ? '' : 's') + ' por confirmar</div>' +
    list.map(function (r) {
      var late = recIsLate(r);
      return '<div class="card pend ' + (late ? 'late' : '') + '" style="padding:9px 11px;margin-bottom:6px">' +
        '<div class="row-between" style="align-items:center;gap:9px">' +
        '<div style="min-width:0"><b style="display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.name) + '</b>' +
        '<span class="small">' + r.next + (late ? ' · <b class="neg">em atraso</b>' : ' · por confirmar') + '</span></div>' +
        '<b style="flex:0 0 auto">' + (r.tx.amount ? euro2(r.tx.amount) : '') + '</b></div>' +
        '<div class="toolbar" style="margin:8px 0 0">' +
        '<button class="btn sm primary" onclick="event.stopPropagation();quickConfirmRec(\'' + r.id + '\')">' + ic('check', 13) + ' Confirmar</button>' +
        '<button class="btn sm" onclick="event.stopPropagation();skipRec(\'' + r.id + '\')">Silenciar</button>' +
        REJECT_BTN(r.id) + '</div></div>';
    }).join('') + '</div>';
}

function decoratePending() {
  if (tab !== 'properties' && tab !== 'contracts') return;
  var pend = recActive();
  if (!pend.length) return;
  var pref = tab === 'properties' ? 'prop:' : 'ct:';
  [].slice.call(document.querySelectorAll('[data-lp^="' + pref + '"]')).forEach(function (cardEl) {
    var id = cardEl.getAttribute('data-lp').slice(pref.length);
    var mine = pend.filter(function (r) {
      return tab === 'properties' ? r.tx.propertyId === id : r.tx.contractId === id;
    });
    if (!mine.length || cardEl.querySelector('.cw-pend')) return;
    var w = document.createElement('div');
    w.innerHTML = pendBlock(mine);
    cardEl.appendChild(w.firstChild);
  });
}

/* ---------- ordem dos cartões da visão geral (modo de edição) ---------- */

var DASH_TITLES = ['Entradas e saídas', 'Cashflow acumulado', 'Renda por contrato',
  'Cashflow por imóvel', 'Despesas sem imóvel', 'Contas entre proprietários'];

function dashKey(el) {
  var kl = el.querySelector('.kpi .label');
  if (kl) return 'kpi:' + kl.textContent.trim();
  if (el.id === 'donutCard' || el.querySelector('#donutCard')) return 'despesas';
  var titles = [].slice.call(el.querySelectorAll('.title')).map(function (x) { return x.textContent.trim(); });
  for (var i = 0; i < titles.length; i++) if (DASH_TITLES.indexOf(titles[i]) > -1) return 'card:' + titles[i];
  // o cartão do portefólio muda de título com o filtro: identifica-se pelas linhas de estatística
  if (el.querySelector('.stat')) return 'portefolio';
  return titles.length ? 'card:' + titles[0] : '';
}

var _vDashboard = vDashboard;
vDashboard = function () {
  var html = _vDashboard();
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  var kids = [].slice.call(tmp.children), first = -1;
  for (var i = 0; i < kids.length; i++) if (kids[i].classList.contains('grid')) { first = i; break; }
  if (first < 0) return html; // estado vazio: nada para ordenar

  var fixed = kids.slice(0, first).map(function (n) { return n.outerHTML; }).join('');
  var items = [], j = first, pending = '';
  var push = function (html, full) {
    var d = document.createElement('div');
    d.innerHTML = html;
    items.push({ h: pending + html, k: dashKey(d.firstElementChild || d) || 'bloco', full: !!full });
    pending = '';
  };
  while (j < kids.length) {
    var n = kids[j];
    // um título de secção viaja com o bloco que anuncia
    if (n.classList.contains('section-title')) { pending = n.outerHTML; j++; continue; }
    if (n.classList.contains('cols')) {
      // cada cartão de um par é independente: move-se sozinho
      [].slice.call(n.children).forEach(function (c) { push(c.outerHTML); });
    } else {
      push(n.outerHTML, n.classList.contains('grid'));   // a fila de indicadores ocupa a largura toda
    }
    j++;
  }
  var seen = {};
  items.forEach(function (it) {
    if (seen[it.k]) it.k += '#' + (++seen[it.k]); else seen[it.k] = 1;
  });
  var order = (db.settings || {}).dashOrder || [];
  items.forEach(function (it, ix) {
    var at = order.indexOf(it.k);
    it._r = at < 0 ? 1000 + ix : at;   // cartões novos ficam no fim, pela ordem de origem
  });
  items.sort(function (a, b) { return a._r - b._r; });

  return fixed + '<div class="cw-dash">' + items.map(function (it) {
    return '<div class="cw-blk' + (it.full ? ' cw-full' : '') + '" data-k="' + esc(it.k) + '" data-lp="dash:' + esc(it.k) + '">' +
      it.h + '<span class="cw-h">' + ic('grip', 15) + '</span></div>';
  }).join('') + '</div>';
};

function blkByKey(k) {
  return [].slice.call(document.querySelectorAll('.cw-blk')).filter(function (x) {
    return x.getAttribute('data-k') === k;
  })[0];
}

function saveDashOrder() {
  var keys = [].slice.call(document.querySelectorAll('#view .cw-blk')).map(function (x) { return x.getAttribute('data-k'); });
  if (!keys.length) return;
  db.settings.dashOrder = keys;
  save();
}

CW.resetDashOrder = function () {
  delete db.settings.dashOrder;
  save(); render();
  toast('Ordem reposta.');
};

function editBar() {
  var v = view();
  if (!v || document.getElementById('cwEditBar')) return;
  var el = document.createElement('div');
  el.id = 'cwEditBar';
  el.className = 'card';
  el.style.cssText = 'margin-bottom:12px;padding:11px 13px;display:flex;align-items:center;gap:11px;flex-wrap:wrap';
  el.innerHTML = '<span class="small" style="flex:1;min-width:140px">Arrasta os cartões para mudar a ordem.</span>' +
    '<button class="btn sm" onclick="CW.resetDashOrder()">Repor ordem</button>' +
    '<button class="btn sm primary" onclick="CW.exitEdit()">' + ic('check', 14) + ' Concluir</button>';
  var grid = v.querySelector('.cw-dash');
  v.insertBefore(el, grid || v.firstChild);
}

function patchHdr() {
  var hb = document.getElementById('hdrFilt');
  if (!hb) return;
  if (CW.editMode && tab === 'dashboard') {
    hb.style.display = '';
    hb.innerHTML = ic('check', 16) + ' Concluir';
    hb.classList.add('primary');
    hb.title = 'Terminar a edição dos cartões';
  } else {
    hb.title = 'Filtros e parâmetros';
  }
}

CW.enterEdit = function (key) {
  if (tab !== 'dashboard' || CW.editMode) return;
  CW.editMode = true;
  var v = view();
  if (v) v.classList.add('cw-edit');
  editBar(); patchHdr();
  // se o dedo ainda está em cima do cartão, o arrasto começa já
  if (key && pointerDown) {
    var el = blkByKey(key);
    if (el) startDrag(el, lastY);
  }
};

CW.exitEdit = function (silent) {
  if (!CW.editMode) return;
  endDrag();
  CW.editMode = false;
  var v = view();
  if (v) v.classList.remove('cw-edit');
  var b = document.getElementById('cwEditBar');
  if (b) b.remove();
  render();   // devolve o botão de filtros ao cabeçalho
  if (!silent) toast('Ordem guardada.');
};

// o botão do cabeçalho fecha o modo de edição em vez de abrir os filtros
var _hdrFiltToggle = hdrFiltToggle;
hdrFiltToggle = function () {
  if (CW.editMode && tab === 'dashboard') return CW.exitEdit();
  _hdrFiltToggle();
};

var drag = null, lastY = 0, lastX = 0, pointerDown = false;

function startDrag(el, clientY, clientX) {
  if (!el || drag) return;
  drag = { el: el, cont: el.parentNode, startY: clientY, startX: clientX == null ? lastX : clientX };
  el.classList.add('cw-drag');
  document.body.style.userSelect = 'none';
}

function blocks() {
  return [].slice.call(drag.cont.children).filter(function (x) { return x.classList.contains('cw-blk'); });
}

// troca só quando o centro do cartão segurado entra no espaço do outro
// (ou seja, quando está maioritariamente já na nova posição)
function shuffle(target, e) {
  var vr = drag.el.getBoundingClientRect();
  var after = !!(drag.el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (after) drag.cont.insertBefore(drag.el, target.nextElementSibling);
  else drag.cont.insertBefore(drag.el, target);
  drag.el.style.transform = '';
  var nr = drag.el.getBoundingClientRect();
  var offY = vr.top - nr.top, offX = vr.left - nr.left;
  drag.el.style.transform = 'translate(' + offX + 'px,' + offY + 'px)';
  drag.startY = e.clientY - offY;   // o cartão continua colado ao dedo
  drag.startX = e.clientX - offX;
}

document.addEventListener('pointermove', function (e) {
  lastY = e.clientY; lastX = e.clientX;
  if (!drag) return;
  e.preventDefault();
  drag.el.style.transform = 'translate(' + (e.clientX - drag.startX) + 'px,' + (e.clientY - drag.startY) + 'px)';
  var r = drag.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  var list = blocks();
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    if (s === drag.el) continue;
    var sr = s.getBoundingClientRect();
    if (cx >= sr.left && cx <= sr.right && cy >= sr.top && cy <= sr.bottom) return shuffle(s, e);
  }
}, { passive: false, capture: true });

// já em modo de edição, o arrasto começa ao primeiro toque (sem esperar)
document.addEventListener('pointerdown', function (e) {
  lastY = e.clientY; lastX = e.clientX;
  pointerDown = true;
  if (!CW.editMode || tab !== 'dashboard') return;
  var blk = e.target && e.target.closest ? e.target.closest('.cw-blk') : null;
  if (blk) startDrag(blk, e.clientY, e.clientX);
}, true);

function endDrag() {
  if (!drag) return;
  drag.el.classList.remove('cw-drag');
  drag.el.style.transform = '';
  drag = null;
  document.body.style.userSelect = '';
  saveDashOrder();
}
['pointerup', 'pointercancel'].forEach(function (t) {
  document.addEventListener(t, function () { pointerDown = false; endDrag(); }, true);
});

var css = document.createElement('style');
css.textContent =
  // cada cartão é um item independente da grelha (duas colunas em ecrã largo)
  '.cw-dash{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px;margin-top:14px;align-items:start}' +
  '.cw-dash>.cw-full{grid-column:1/-1}' +
  '.cw-blk{position:relative;min-width:0}' +
  '.cw-blk .cw-h{display:none}' +
  '#view.cw-edit .cw-blk{border:1.5px dashed var(--line2);border-radius:18px;padding:9px;' +
    'background:var(--tint);touch-action:none;cursor:grab}' +
  '#view.cw-edit .cw-blk>*{pointer-events:none}' +
  '#view.cw-edit .cw-blk .cw-h{display:grid;place-items:center;position:absolute;top:6px;right:8px;width:26px;height:26px;' +
    'border-radius:9px;background:var(--chip);color:var(--muted)}' +
  '#view.cw-edit .cw-blk.cw-drag{cursor:grabbing;box-shadow:var(--shadow);border-color:var(--accent);' +
    'position:relative;z-index:70;opacity:.97}';
document.head.appendChild(css);
