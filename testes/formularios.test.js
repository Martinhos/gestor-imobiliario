// Os formulários dizem o que é opcional, as datas vazias dizem o que esperam
// no iPhone, e cada lista vazia tem o botão verde da sua ação. O que se prova:
// em cada formulário, todo o campo de texto que o guardar aceita vazio diz
// «Opcional» (ou o rótulo diz «(opcional)» quando o placeholder é um exemplo
// que vale a pena manter) e nenhum obrigatório o diz; a marca das datas
// vazias põe-se e tira-se; a regra do «dd/mm/aaaa» vive só no WebKit do
// iPhone; e os vazios têm o botão com a condição do FAB — nunca o de um
// filtro que não deixou nada.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { carregarApp, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');

const app = carregarApp();
afterEach(() => repor(app));

/* ------------------------------------------------------------ os campos */

/* Os campos de texto de um formulário, lidos do HTML: id, tipo, placeholder
   e o rótulo (o texto do <label> que embrulha o campo, sem o asterisco dos
   obrigatórios). Ficam de fora o que não é texto — as caixas, os ficheiros,
   as datas, as horas, os meses, os inputs escondidos dos sel() e a pesquisa.
   Recebe: html — o corpo do formulário.
   Devolve: [{id, type, placeholder, rotulo}]. */
function campos(html) {
  const out = [];
  const re = /<(input|textarea)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[2];
    const attr = (n) => { const x = new RegExp('\\b' + n + '="([^"]*)"').exec(attrs); return x ? x[1] : ''; };
    const type = attr('type') || 'text';
    if (m[1] === 'input' && !['text', 'email', 'tel'].includes(type)) continue;
    const antes = html.slice(0, m.index);
    const abre = antes.lastIndexOf('<label'), fecha = antes.lastIndexOf('</label>');
    let rotulo = '';
    if (abre > fecha) rotulo = antes.slice(antes.indexOf('>', abre) + 1).replace(/<[^>]+>/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    out.push({ id: attr('id'), type, placeholder: attr('placeholder'), rotulo });
  }
  return out;
}

/* Confere um formulário contra a sua validação: cada obrigatório sem marca
   de opcional; cada campo com exemplo mantém o exemplo e tem o rótulo
   marcado; todos os outros dizem «Opcional» no placeholder.
   Recebe: nome — para as mensagens; html — o corpo; o — {obrigatorios: ids,
   exemplos: {id: placeholder esperado, ou true para «qualquer, menos
   Opcional»}, deixados: prefixos de ids que não se julgam (linhas sem rótulo)}.
   Devolve: os campos lidos, para quem quiser olhar mais. */
function conferir(nome, html, o) {
  const cs = campos(html);
  const exemplos = o.exemplos || {}, deixados = o.deixados || [];
  assert.ok(cs.length, nome + ': há campos de texto');
  for (const id of o.obrigatorios) assert.ok(cs.some((c) => c.id === id), nome + ': o obrigatório ' + id + ' está no formulário');
  for (const id of Object.keys(exemplos)) assert.ok(cs.some((c) => c.id === id), nome + ': o campo com exemplo ' + id + ' está no formulário');
  for (const c of cs) {
    const opc = /\(opcional\)|, opcional\)/.test(c.rotulo);
    if (o.obrigatorios.includes(c.id)) {
      assert.notEqual(c.placeholder, 'Opcional', nome + ': ' + c.id + ' é obrigatório e diz «Opcional»');
      assert.ok(!opc, nome + ': ' + c.id + ' é obrigatório e o rótulo diz «opcional»');
      continue;
    }
    if (deixados.some((p) => c.id.startsWith(p))) continue;
    if (c.id in exemplos) {
      if (exemplos[c.id] === true) assert.ok(c.placeholder && c.placeholder !== 'Opcional', nome + ': ' + c.id + ' mantém um exemplo');
      else assert.equal(c.placeholder, exemplos[c.id], nome + ': ' + c.id + ' mantém o exemplo');
      assert.ok(opc, nome + ': ' + c.id + ' tem exemplo e o rótulo «' + c.rotulo + '» não diz «(opcional)»');
      continue;
    }
    assert.equal(c.placeholder, 'Opcional', nome + ': ' + c.id + ' («' + c.rotulo + '») é opcional e o placeholder é «' + c.placeholder + '»');
  }
  return cs;
}

// uma base com um imóvel de arrendamento meu, um inquilino e um proprietário
function base() {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' })];
  app.db.tenants = [app.normPerson({ id: 'I1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] })];
  return janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
}

describe('«Opcional» nos formulários', () => {
  test('imóvel: só o nome é obrigatório; os dados registais com formato guardam o exemplo', () => {
    const abertas = base();
    app.propModal();
    const cs = conferir('imóvel', abertas[0].b, {
      obrigatorios: ['p_name'],
      exemplos: { p_freguesiaCodigo: '110623', p_fraction: 'A', p_floor: '2.º', p_registry: '15937', p_postalCode: '3130-000',
        p_matrix: '4651', p_licence: 'Alvará n.º 26/2013', p_energyCert: 'SCE395442330', p_energyClass: 'D' },
      deixados: ['p_share_', 'p_room_', 'fn_'],
    });
    for (const id of ['p_addr', 'p_value', 'p_purchase', 'p_vpt', 'p_imi', 'p_condominio', 'p_seguro', 'p_listing', 'p_notes', 'p_street', 'p_locality']) {
      assert.equal(cs.find((c) => c.id === id).placeholder, 'Opcional', id);
    }
    assert.match(abertas[0].b, /Nome <span class="req">\*<\/span><input id="p_name"[^>]*placeholder="T2 Lisboa"/, 'o nome mantém o asterisco e o exemplo');
  });

  test('hipoteca: o capital é obrigatório; taxas, prazo, banco e finalidade dizem «Opcional» — nas três formas de taxa', () => {
    for (const tipo of ['fixa', 'mista', 'variavel']) {
      const abertas = base();
      const l = app.normLoan({ id: 'L' + tipo, type: tipo, outstanding: 100000, rate: 0, euribor: 0, spread: 0, amortFeeFix: null, amortFeeVar: null, years: '', fixedYears: '' });
      app.db.properties[0].loans = [l];
      app.mortModal('P1', l.id);
      const cs = conferir('hipoteca ' + tipo, abertas[0].b, { obrigatorios: ['l_out_' + l.id], deixados: ['fn_'] });
      const ids = cs.map((c) => c.id);
      assert.ok(ids.includes('l_rate_' + l.id) || tipo === 'variavel', tipo + ': tem o campo da taxa');
      if (tipo === 'mista') assert.ok(ids.includes('l_fy_' + l.id) && ids.includes('l_ffix_' + l.id) && ids.includes('l_fvar_' + l.id));
      if (tipo === 'variavel') assert.ok(ids.includes('l_eur_' + l.id) && ids.includes('l_spr_' + l.id));
      assert.equal(cs.find((c) => c.id === 'l_out_' + l.id).placeholder, '150000', 'o capital fica como estava');
      repor(app);
    }
  });

  test('contrato: só a renda é obrigatória; nome, imposto e aumento mostram o que vale em branco; IBAN e contactos guardam o formato', () => {
    const abertas = base();
    app.ctModal();
    const cs = conferir('contrato', abertas[0].b, {
      obrigatorios: ['c_rent'],
      exemplos: { c_name: true, c_tax: true, c_inc: true, c_iban: 'PT50 0000 0000 0000 0000 0000 0',
        c_omail: 'nome@exemplo.pt', c_ophone: '+351 912 000 000', c_tmail: 'nome@exemplo.pt', c_tphone: '+351 912 000 000' },
      deixados: ['invn_', 'invq_', 'keyn_', 'keyq_', 'fn_'],
    });
    for (const id of ['c_day', 'c_dayTo', 'c_dep', 'c_adv', 'c_notes']) assert.equal(cs.find((c) => c.id === id).placeholder, 'Opcional', id);
    assert.match(cs.find((c) => c.id === 'c_tax').rotulo, /\(%, opcional\)/, 'a unidade e o opcional no mesmo parêntesis');
    assert.match(abertas[0].b, /Renda mensal \(€\) <span class="req">\*<\/span>/);
    // a secção da declaração, num contrato declarado que já acabou
    app.cForm.fisco.estado = 'declarado'; app.cForm.end = '2030-01-01';
    conferir('contrato · declaração', app.fiscoSect(), {
      obrigatorios: [],
      exemplos: { c_fnum: '1234567', c_fces: 'Ex.: fim do prazo, acordo, denúncia' },
    });
  });

  test('movimento: descrição e montante são obrigatórios; o credor de uma dívida guarda os exemplos; a retenção diz «Opcional»', () => {
    const abertas = base();
    app.txModal({ kind: 'expense' });
    const cs = conferir('despesa', abertas[0].b, { obrigatorios: ['t_label', 't_amount'], deixados: ['t_sp_', 't_pp_', 't_int', 't_cap'] });
    assert.equal(cs.find((c) => c.id === 't_notes').placeholder, 'Opcional');
    assert.match(abertas[0].b, /Descrição <span class="req">\*<\/span>/);
    assert.match(abertas[0].b, /Montante \(€\) <span class="req">\*<\/span>/);
    app.txModal({ kind: 'owed' });
    conferir('dívida recebida', abertas[1].b, { obrigatorios: ['t_label', 't_amount'], exemplos: { t_creditor: 'Pai, amigo, empreiteiro…' }, deixados: ['t_sp_', 't_pp_'] });
    // uma renda com contrato traz a secção do IRS
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 500, tenantIds: ['I1'], start: '2020-01-01' })];
    app.txModal({ kind: 'income', propId: 'P1', ctId: 'C1' });
    const renda = conferir('renda', abertas[2].b, { obrigatorios: ['t_label', 't_amount'], deixados: ['t_sp_', 't_pp_'] });
    assert.equal(renda.find((c) => c.id === 't_retencao').placeholder, 'Opcional');
  });

  test('planeado: o mesmo formulário, com as datas da repetição e sem «Opcional» nelas', () => {
    const abertas = base();
    app.txModal({ kind: 'expense', modo: 'rec', every: 'month' });
    conferir('planeado', abertas[0].b, { obrigatorios: ['t_label', 't_amount'], deixados: ['t_sp_', 't_pp_'] });
    assert.match(abertas[0].b, /id="t_until" type="date"/);
    assert.match(abertas[0].b, /Até \(deixa de se repetir; opcional\)<input id="t_recEnd" type="date"/, 'a data de fim diz-se opcional no rótulo, não no placeholder');
    assert.doesNotMatch(abertas[0].b, /type="date"[^>]*placeholder=/, 'nenhuma data leva placeholder: o browser ignora-o');
  });

  test('modelo: o nome do modelo é opcional e mantém o exemplo', () => {
    const abertas = base();
    app.txModal({ kind: 'expense', modo: 'tpl' });
    conferir('modelo', abertas[0].b, { obrigatorios: ['t_label', 't_amount'], exemplos: { t_tplName: 'Ex.: Renda mensal T2' }, deixados: ['t_sp_', 't_pp_'] });
  });

  test('inquilino: só o nome é obrigatório, e ganhou o asterisco; CC, país, morada e notas guardam o exemplo', () => {
    const abertas = base();
    app.personModal('tenant');
    const cs = conferir('inquilino', abertas[0].b, {
      obrigatorios: ['pe_name'],
      exemplos: { pe_cc: '00000000 0 ZZ0', pe_pais: 'Só se não tem NIF português', pe_addr: 'Rua, número, código postal, localidade', pe_notes: 'Fiador, referências, observações…' },
      deixados: ['fn_'],
    });
    for (const id of ['pe_phone', 'pe_mail', 'pe_nif', 'pe_nat']) assert.equal(cs.find((c) => c.id === id).placeholder, 'Opcional', id);
    assert.match(abertas[0].b, /Nome completo <span class="req">\*<\/span><input id="pe_name"/);
  });

  test('proprietário: a mesma ficha sem documentos nem notas', () => {
    const abertas = base();
    app.personModal('owner');
    const cs = conferir('proprietário', abertas[0].b, {
      obrigatorios: ['pe_name'],
      exemplos: { pe_cc: '00000000 0 ZZ0', pe_pais: 'Só se não tem NIF português', pe_addr: 'Rua, número, código postal, localidade' },
    });
    assert.ok(!cs.some((c) => c.id === 'pe_notes'), 'sem notas');
  });

  test('visita: quem vem e a data são obrigatórios; o contacto e os comentários dizem-se opcionais no rótulo', () => {
    const abertas = base();
    app.visitModal();
    conferir('visita', abertas[0].b, {
      obrigatorios: ['vi_nomes'],
      exemplos: { vi_contacto: 'Telemóvel ou email', vi_notas: 'Primeiras impressões, perguntas que fizeram, o que ficou combinado…' },
    });
    assert.match(abertas[0].b, /Quem vem <span class="req">\*<\/span>/);
    assert.match(abertas[0].b, /Data <span class="req">\*<\/span><input id="vi_date" type="date"/);
  });
});

/* A camada da nuvem por cima da app, como em colaboradores-cloud.test.js:
   o cargo e o perfil vivem lá. */
function comNuvem() {
  const a = carregarApp();
  a.document.documentElement.style.removeProperty = () => {};
  const ctx = a.__ctx;
  for (const nome of ['nucleo', 'utilizadores', 'partilha', 'colaboradores']) {
    vm.runInContext(le('web/cloud/' + nome + '.js'), ctx, { filename: 'cloud/' + nome + '.js' });
  }
  a.api = () => Promise.resolve({});
  a.toast = () => {}; a.pullNow = () => Promise.resolve(); a.render = () => {}; a.buildNav = () => {};
  a.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
  return a;
}

describe('os formulários da nuvem', () => {
  test('cargo: o nome é obrigatório (com asterisco) e não há campo de texto opcional', () => {
    const a = comNuvem();
    const abertas = janelasFalsas(a);
    a.CW.cargoModal();
    const cs = conferir('cargo', abertas[0].b, { obrigatorios: ['cg_nome'] });
    assert.equal(cs.length, 1, 'só o nome é de texto: o resto são caixas');
    assert.match(abertas[0].b, /Nome do cargo <span class="req">\*<\/span><input id="cg_nome"/);
  });

  test('perfil: o telemóvel ganha o indicativo e o formato, e o «opcional» sobe para o rótulo', () => {
    const a = comNuvem();
    const lab = { firstChild: { nodeType: 3, nodeValue: 'Telemóvel' }, insertBefore() {} };
    const inp = { value: '+351 912 345 678', placeholder: 'Opcional', style: {}, parentNode: lab };
    a.document.getElementById = (id) => (id === 'pe_phone' ? inp : id === 'cw_cc' ? null : a.document.createElement('div'));
    a.injectPhoneCountry();
    assert.equal(lab.firstChild.nodeValue, 'Telemóvel (opcional)');
    assert.equal(inp.placeholder, '912 345 678');
    assert.equal(inp.value, '912 345 678', 'o indicativo saiu para o seletor');
    // segunda passagem não duplica o «(opcional)»
    a.document.getElementById = (id) => (id === 'pe_phone' ? inp : id === 'cw_cc' ? null : a.document.createElement('div'));
    a.injectPhoneCountry();
    assert.equal(lab.firstChild.nodeValue, 'Telemóvel (opcional)');
  });
});

/* ------------------------------------------------------- as datas vazias */

// um campo de data falso, com os atributos observáveis
function campoData(valor) {
  const a = {};
  return { tagName: 'INPUT', type: 'date', value: valor, atributos: a,
    setAttribute(k, v) { a[k] = v; }, removeAttribute(k) { delete a[k]; }, hasAttribute(k) { return k in a; } };
}

describe('dd/mm/aaaa nas datas vazias', () => {
  test('marcarDatasVazias põe data-vazio num campo de data vazio e tira-o quando tem valor', () => {
    const vazio = campoData(''), cheio = campoData('2026-09-28');
    const raiz = { querySelectorAll: (s) => (s === 'input[type=date]' ? [vazio, cheio] : []) };
    app.marcarDatasVazias(raiz);
    assert.ok(vazio.hasAttribute('data-vazio'), 'o vazio leva a marca');
    assert.ok(!cheio.hasAttribute('data-vazio'), 'o cheio não');
    // o próprio campo, como o ouvinte lho entrega
    vazio.value = '2026-01-01'; app.marcarDatasVazias(vazio);
    assert.ok(!vazio.hasAttribute('data-vazio'), 'escolhida a data, a marca sai');
    vazio.value = ''; app.marcarDatasVazias(vazio);
    assert.ok(vazio.hasAttribute('data-vazio'), 'apagada, volta');
    const texto = Object.assign(campoData(''), { type: 'text' });
    app.marcarDatasVazias(texto);
    assert.ok(!texto.hasAttribute('data-vazio'), 'um campo de texto não é marcado');
    /* as janelas falsas dos testes devolvem campos sem atributos a qualquer
       seletor com «input»: o que não é um campo de data a sério fica em paz */
    const semAtributos = { querySelectorAll: () => [{ tagName: 'INPUT', type: 'text', value: 'a' }, { type: 'date', value: '' }] };
    assert.doesNotThrow(() => { app.marcarDatasVazias(null); app.marcarDatasVazias({}); app.marcarDatasVazias(semAtributos); });
  });

  test('o ouvinte de captura de input e change (o das ações, um por tipo) mantém a marca em dia num campo de data, e ignora o resto', () => {
    // as capturas do window, como o eventos.test.js as apanha: um ouvinte por tipo, e só esses
    const capturas = {};
    const a = carregarApp({ antes: (ctx) => { ctx.addEventListener = (tipo, fn, captura) => { (capturas[tipo] = capturas[tipo] || []).push({ fn, captura }); }; } });
    for (const t of ['click', 'change', 'input', 'keydown', 'pointerdown']) {
      assert.deepEqual((capturas[t] || []).map((o) => o.captura), [true], 'um só ouvinte de captura para o ' + t + ' — as datas não acrescentam outro');
    }
    const evento = (target) => ({ target, composedPath: () => [] });
    const c = campoData('');
    capturas.input[0].fn(evento(c));
    assert.ok(c.hasAttribute('data-vazio'), 'a escrever num campo de data vazio, a marca fica');
    c.value = '2026-01-01';
    capturas.change[0].fn(evento(c));
    assert.ok(!c.hasAttribute('data-vazio'), 'escolhida a data, sai');
    c.value = '';
    capturas.input[0].fn(evento(c));
    assert.ok(c.hasAttribute('data-vazio'), 'apagada, volta');
    const texto = Object.assign(campoData(''), { type: 'text' });
    capturas.input[0].fn(evento(texto));
    assert.ok(!texto.hasAttribute('data-vazio'), 'um campo de texto não é marcado');
    assert.doesNotThrow(() => { capturas.input[0].fn(evento({ tagName: 'DIV' })); capturas.change[0].fn({}); a.datasVaziasDoEvento(null); });
    // o click não olha para as datas
    const outro = campoData('');
    capturas.click[0].fn(evento(outro));
    assert.ok(!outro.hasAttribute('data-vazio'));
  });

  test('o corpo de uma janela é marcado ao entrar no DOM (fillModal), e o ecrã depois do render', () => {
    let marcado = [];
    app.marcarDatasVazias = (r) => { marcado.push(r); };
    const body = { innerHTML: '', querySelectorAll: () => [] };
    const el = { querySelector: (s) => (s === '.body' ? body : { innerHTML: '', textContent: '' }) };
    app.fillModal(el, 'Título', '<input type="date">');
    assert.equal(marcado[0], body);
    limpar(app);
    marcado = [];
    app.tab = 'properties';
    app.render();
    assert.ok(marcado.includes(app.view()), 'o render marca o #view');
  });

  test('a regra do «dd/mm/aaaa» vive só dentro de @supports (-webkit-touch-callout:none), na cor --muted', () => {
    const css = le('web/estilos.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const m = /@supports \(-webkit-touch-callout:none\)\{([^]*?)\n\}/.exec(css);
    assert.ok(m, 'o bloco do WebKit do iPhone existe');
    assert.match(m[1], /input\[type=date\]\[data-vazio\]::before\{[^}]*content:'dd\/mm\/aaaa'/, 'a regra está lá dentro, presa à marca');
    assert.match(m[1], /color:var\(--muted\)/);
    assert.match(m[1], /pointer-events:none/, 'o texto não rouba o toque ao campo');
    assert.ok(!css.replace(m[0], '').includes('dd/mm/aaaa'), 'e em mais lado nenhum');
  });
});

/* ------------------------------------------------------------- os vazios */

// o botão de saída de um vazio (vistas.js:saida) com esta ação
const botao = (act) => 'class="btn primary" data-toca="camada" data-click="' + act + '"';

// um só colaborador que só vê movimentos, sem imóvel nenhum seu
function soVe() {
  limpar(app);
  app.db.properties = [Object.assign(app.normProp({ id: 'P1', name: 'T2 Rui', ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui', _cargo: 'Ver' })];
  app.db.owners = [Object.assign(app.normPerson({ id: 'rui', name: 'Rui' }), { _userId: 'rui' })];
  app.window.CW = { user: { id: 'eu' }, cargos: { P1: { dono: false, nome: 'Ver', perms: ['tx.view', 'contract.view', 'rec.view', 'loan.view', 'tenant.view'] } }, pessoas: {} };
  assert.equal(app.souSoColaborador(), true);
}

describe('um botão em cada vazio', () => {
  test('Imóveis: «Adicionar imóvel» abre a ficha; com filtro ativo é «Nada neste filtro» sem botão de adicionar', () => {
    limpar(app);
    assert.match(app.vProperties(), /Sem imóveis/);
    assert.ok(app.vProperties().includes(botao('propModal()')));
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
    app.lf('lprops').q = 'zzz';
    const html = app.vProperties();
    assert.match(html, /Nada neste filtro/);
    assert.ok(!html.includes(botao('propModal()')));
  });

  test('Movimentos: «Registar movimento» pergunta o tipo; um filtro sem resultados não convida a adicionar', () => {
    limpar(app);
    assert.match(app.vTransactions(), /Sem movimentos/);
    assert.ok(app.vTransactions().includes(botao('newTxPick()')));
    app.db.transactions = [app.normTx({ id: 'T1', kind: 'expense', label: 'Luz', amount: 10, date: '2026-01-01' })];
    app.txFilter = 'income';
    const html = app.vTransactions();
    assert.match(html, /Nada neste filtro/);
    assert.ok(!html.includes(botao('newTxPick()')));
  });

  test('Inquilinos e Proprietários: cada vazio abre a ficha da sua pessoa; o filtro não', () => {
    limpar(app);
    assert.ok(app.vTenants().includes(botao("personModal('tenant')")));
    assert.ok(app.vOwners().includes(botao("personModal('owner')")));
    app.db.tenants = [app.normPerson({ id: 'I1', name: 'Ana' })];
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Eu' })];
    app.lf('lten').q = 'zzz'; app.lf('lown').q = 'zzz';
    assert.match(app.vTenants(), /Nada neste filtro/);
    assert.ok(!app.vTenants().includes(botao("personModal('tenant')")));
    assert.match(app.vOwners(), /Nada neste filtro/);
    assert.ok(!app.vOwners().includes(botao("personModal('owner')")));
  });

  test('Planeados e Modelos: dois vazios, dois botões; com filtro, dois «Nada neste filtro» sem botão', () => {
    limpar(app);
    const html = app.vRecurring();
    assert.match(html, /Sem movimentos recorrentes/);
    assert.match(html, /Sem modelos/);
    assert.ok(html.includes(botao('newRec()')));
    assert.ok(html.includes(botao('newTpl()')));
    app.lf('lrec').q = 'zzz';
    const f = app.vRecurring();
    assert.equal((f.match(/Nada neste filtro/g) || []).length, 2);
    assert.ok(!f.includes(botao('newRec()')) && !f.includes(botao('newTpl()')));
  });

  test('Hipotecas: com imóveis «Nova hipoteca»; sem imóveis fica o caminho para os imóveis; o filtro não convida', () => {
    limpar(app);
    const semImoveis = app.vCredits();
    assert.match(semImoveis, /Sem hipotecas/);
    assert.ok(!semImoveis.includes('newMort()'));
    assert.ok(semImoveis.includes("data-toca=\"ecra\" data-click=\"go('properties')\""));
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
    assert.ok(app.vCredits().includes(botao('newMort()')));
    app.db.properties[0].loans = [app.normLoan({ id: 'L1', name: 'Aquisição', outstanding: 100000, rate: 3 })];
    app.lf('lcred').q = 'zzz';
    const f = app.vCredits();
    assert.match(f, /Nada neste filtro/);
    assert.ok(!f.includes(botao('newMort()')));
  });

  test('Contratos: com imóveis «Novo contrato»; sem imóveis fica «Adicionar imóvel»; o filtro não convida', () => {
    limpar(app);
    assert.ok(app.vContracts().includes("data-toca=\"ecra\" data-click=\"go('properties')\""));
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento' })];
    assert.match(app.vContracts(), /Sem contratos/);
    assert.ok(app.vContracts().includes(botao('ctModal()')));
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 500, tenantIds: [] })];
    app.lf('lcts').q = 'zzz';
    const f = app.vContracts();
    assert.match(f, /Nada neste filtro/);
    assert.ok(!f.includes(botao('ctModal()')));
  });

  test('quem só vê não tem botão nenhum: a condição é a do FAB de cada lista', () => {
    soVe();
    assert.ok(!app.vTransactions().includes(botao('newTxPick()')), 'movimentos');
    assert.ok(!app.vTenants().includes(botao("personModal('tenant')")), 'inquilinos');
    const rec = app.vRecurring();
    assert.ok(!rec.includes(botao('newRec()')) && !rec.includes(botao('newTpl()')), 'planeados e modelos');
    assert.ok(!app.vCredits().includes(botao('newMort()')), 'hipotecas');
    assert.ok(!app.vContracts().includes(botao('ctModal()')), 'contratos');
    // e nenhum FAB, que é a mesma condição
    for (const v of ['vTransactions', 'vTenants', 'vRecurring', 'vCredits', 'vContracts']) assert.doesNotMatch(app[v](), /class="fab"/, v);
    // com «Adicionar movimentos» no imóvel de colaboração, o botão dos movimentos volta
    app.window.CW.cargos.P1.perms = ['tx.add'];
    assert.ok(app.vTransactions().includes(botao('newTxPick()')));
  });
});
