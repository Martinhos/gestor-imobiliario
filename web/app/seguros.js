/* ================= SEGUROS ================= */
/* Os seguros da carteira: multirriscos, vida associado ao crédito, recheio.
   O que interessa não é o registo em si — é saber quanto vai sair e quando,
   e um seguro raramente custa o mesmo dois anos seguidos. Daí o aumento
   anual por seguro: o prémio de cada pagamento cresce a cada aniversário,
   e a previsão mostra os próximos pagamentos já com isso dentro. */

const SEG_PERIODOS = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const SEG_TIPOS = ['multirriscos', 'vida', 'recheio', 'responsabilidade civil', 'outro'];

/* Os próximos pagamentos, datas e valores, a partir de `hoje`.
   Função pura de propósito: é a conta que interessa testar.
   s = { start:'AAAA-MM-DD', premium: valor de cada pagamento no 1.º ano,
         period: mensal|trimestral|semestral|anual, increase: % ao ano } */
function pagamentosSeguro(s, n, hoje) {
  const meses = SEG_PERIODOS[s.period] || 12;
  const inicio = new Date((s.start || todayISO()) + 'T00:00:00Z');
  if (isNaN(inicio)) return [];
  const desde = new Date((hoje || todayISO()) + 'T00:00:00Z');
  const taxa = Number(s.increase) || 0;
  const out = [];
  for (let k = 0; out.length < (n || 12) && k < 1200; k++) {
    const d = new Date(inicio);
    d.setUTCMonth(d.getUTCMonth() + k * meses);
    if (d < desde) continue;
    // o aumento entra a cada aniversário da apólice, não a cada pagamento
    const anos = Math.floor((k * meses) / 12);
    const valor = Math.round(Number(s.premium || 0) * Math.pow(1 + taxa / 100, anos) * 100) / 100;
    out.push({ date: d.toISOString().slice(0, 10), value: valor });
  }
  return out;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

// o custo dos próximos 12 meses, para o cartão dizer já quanto pesa
function custoAnualSeguro(s, hoje) {
  const h = hoje || todayISO();
  const fim = new Date(h + 'T00:00:00Z');
  fim.setUTCFullYear(fim.getUTCFullYear() + 1);
  return Math.round(pagamentosSeguro(s, 60, h)
    .filter((p) => p.date < fim.toISOString().slice(0, 10))
    .reduce((t, p) => t + p.value, 0) * 100) / 100;
}

/* ------------------------------- a lista ------------------------------- */

function vInsurance() {
  const list = db.insurances || [];
  const total = sum(list.map((s) => custoAnualSeguro(s)));
  const head = `<div class="grid">
    ${kpi('Seguros ativos', String(list.length), '', '')}
    ${kpi('Custo nos próximos 12 meses', euro2(total), 'neg', 'com os aumentos anuais previstos')}
  </div>`;
  if (!list.length) {
    return head + `<div class="empty"><b>Sem seguros</b>Regista o multirriscos, o de vida do crédito ou o do recheio, e vê quanto vai sair e quando.</div>` + fab([{ act: 'segModal()', label: 'Novo seguro' }]);
  }
  return head + `<div class="list" style="gap:10px">${list.map((s) => {
    const p = prop(s.propertyId);
    const prox = pagamentosSeguro(s, 1)[0];
    return `<div class="card tap" data-lp="seg:${esc(s.id)}" onclick="segModal('${jsq(s.id)}')">
      <div class="row-between"><div style="min-width:0">
        <div class="title">${esc(s.name || 'Seguro')}</div>
        <div class="small">${esc(s.kind || 'outro')}${p ? ' · ' + esc(p.name) : ''}${s.insurer ? ' · ' + esc(s.insurer) : ''}</div>
        ${prox ? `<div class="small" style="margin-top:3px">próximo: <b>${euro2(prox.value)}</b> a ${prox.date}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
        <span class="badge">${esc(s.period || 'anual')}</span>${kebab('seg:' + esc(s.id))}
      </div></div></div>`;
  }).join('')}</div>` + fab([{ act: 'segModal()', label: 'Novo seguro' }]);
}

/* ------------------------------ o modal -------------------------------- */

let segForm = null;
function segModal(id) {
  const s = (db.insurances || []).find((x) => x.id === id);
  segForm = s ? JSON.parse(JSON.stringify(s)) : {
    id: uid(), name: '', kind: 'multirriscos', propertyId: null, insurer: '', policy: '',
    premium: null, period: 'anual', start: todayISO(), increase: 3, notes: '',
  };
  segForm._nova = !s;
  openModal(s ? 'Editar seguro' : 'Novo seguro', segBody(),
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="segGuardar()">Guardar</button>`,
    s ? menu('segMenu', [{ label: 'Apagar seguro', icon: 'trash', danger: true, act: `delSeguro('${jsq(s.id)}')` }]) : '');
}

function segBody() {
  const t = segForm;
  const props = [{ v: '', label: '— sem imóvel —' }].concat(db.properties.map((p) => ({ v: p.id, label: p.name })));
  return `<div class="form">
    <label>Nome <span class="req">*</span><input id="sg_name" value="${esc(t.name)}" placeholder="Multirriscos T2 Lisboa" autocomplete="off"></label>
    <div class="row">
      <label>Tipo${sel('sg_kind', t.kind, SEG_TIPOS.map((k) => ({ v: k, label: k })), 'segColher')}</label>
      <label>Imóvel${sel('sg_prop', t.propertyId || '', props, 'segColher')}</label></div>
    <div class="row">
      <label>Seguradora<input id="sg_insurer" value="${esc(t.insurer)}" autocomplete="off"></label>
      <label>Apólice<input id="sg_policy" value="${esc(t.policy)}" autocomplete="off"></label></div>
    <div class="row">
      <label>Valor de cada pagamento (€) <span class="req">*</span><input id="sg_premium" type="text" inputmode="decimal" value="${t.premium != null ? dec(t.premium) : ''}" placeholder="120" oninput="segColher()"></label>
      <label>Periodicidade${sel('sg_period', t.period, Object.keys(SEG_PERIODOS).map((k) => ({ v: k, label: k })), 'segColher')}</label></div>
    <div class="row">
      <label>Primeiro pagamento<input id="sg_start" type="date" value="${t.start || ''}" onchange="segColher()"></label>
      <label>Aumento anual (%)<input id="sg_increase" type="text" inputmode="decimal" value="${t.increase != null ? dec(t.increase) : ''}" placeholder="3" oninput="segColher()"></label></div>
    <label>Notas<textarea id="sg_notes">${esc(t.notes || '')}</textarea></label>
    <div class="card" style="background:var(--tint);padding:12px" id="segPrev">${segPrevisao()}</div>
  </div>`;
}

/* a previsão ao vivo, dentro do próprio modal: mexes num campo, vês logo */
function segPrevisao() {
  const t = segForm;
  if (!(t.premium > 0)) return '<div class="small">Preenche o valor para veres a previsão dos pagamentos.</div>';
  const pags = pagamentosSeguro(t, 8);
  const total = custoAnualSeguro(t);
  return '<b style="font-size:13.5px">Próximos pagamentos</b>' +
    '<div class="small" style="margin:2px 0 7px">' + euro2(total) + ' nos próximos 12 meses' +
    (Number(t.increase) ? ' · o valor sobe ' + dec(t.increase) + '% a cada aniversário' : '') + '</div>' +
    pags.map((p, i) => {
      const sobe = i > 0 && p.value !== pags[i - 1].value;
      return '<div class="stat"><span>' + p.date + '</span><b>' + euro2(p.value) +
        (sobe ? ' <span class="badge wa">↑</span>' : '') + '</b></div>';
    }).join('');
}

function segColher() {
  const t = segForm;
  t.name = val('sg_name'); t.kind = val('sg_kind') || 'outro'; t.propertyId = val('sg_prop') || null;
  t.insurer = val('sg_insurer'); t.policy = val('sg_policy');
  t.premium = num(val('sg_premium')); t.period = val('sg_period') || 'anual';
  t.start = val('sg_start') || todayISO(); t.increase = num(val('sg_increase'));
  t.notes = val('sg_notes');
  const p = document.getElementById('segPrev');
  if (p) p.innerHTML = segPrevisao();
}

function segGuardar() {
  segColher();
  const t = segForm;
  if (!String(t.name || '').trim()) return falhaCampo('sg_name', 'Dá um nome ao seguro.');
  if (!(t.premium > 0)) return falhaCampo('sg_premium', 'Indica o valor de cada pagamento.');
  delete t._nova;
  db.insurances = db.insurances || [];
  const i = db.insurances.findIndex((x) => x.id === t.id);
  if (i < 0) db.insurances.push(t); else db.insurances[i] = t;
  save(); closeModal(); render(); toast('Seguro guardado.');
}

function delSeguro(id) {
  const s = (db.insurances || []).find((x) => x.id === id);
  if (!s) return;
  const copia = JSON.parse(JSON.stringify(s));
  db.insurances = db.insurances.filter((x) => x.id !== id);
  save(); closeAllModals(); render();
  comDesfazer('Seguro apagado.', () => { db.insurances.push(copia); });
}
