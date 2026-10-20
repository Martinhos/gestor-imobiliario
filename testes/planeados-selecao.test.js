// A seleção de vários nos Planeados: ou planeados ou modelos (entrar com um
// tipo esquece o outro); Silenciar quando os marcados estão todos ativos,
// Reativar quando estão todos silenciados, nenhum dos dois misturados (com a
// razão dita); Apagar com as regras do delRec (os automáticos desligam o
// autoRec do contrato ou da hipoteca, os da ficha do imóvel levam o valor e as
// irmãs) e das permissões, e o Anular a repor tudo. O toque longo num
// planeado ou num modelo abre as opções com «Selecionar vários» no fim, e o
// botão do cabeçalho que entra na seleção é a caixa com o visto em todo o lado.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, carregarTudo, limpar, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
afterEach(() => { app.window.CW = undefined; });
const nuvem = carregarTudo();
afterEach(() => repor(nuvem));
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r/g, '');

const CONTAB = ['tx.view', 'tx.add', 'rec.view', 'rec.add', 'contract.view', 'loan.view', 'file.view', 'file.add', 'report.view'];
const GESTOR = ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'];

/* Um planeado com o tx e o resto à mão (o normRec, e depois o que ele não
   guarda, como o propRec dos da ficha do imóvel).
   Recebe: a — o proxy; o — os campos do planeado; tx — os do tx.
   Devolve: o planeado. */
function rec(a, o, tx) {
  const r = a.normRec(Object.assign({ next: '2000-01-01', every: 'month' }, o));
  Object.assign(r.tx, tx || {});
  return r;
}

/* Um imóvel meu com um contrato e uma hipoteca, e cinco planeados: dois à
   mão (um silenciado), a renda automática do contrato, a prestação
   automática da hipoteca e o IMI da ficha em duas prestações irmãs.
   Recebe: a — o proxy.
   Devolve: nada — enche o db. */
function semear(a) {
  const db = limpar(a);
  db.properties.push(Object.assign(a.normProp({ id: 'P1', name: 'T2 Lisboa', value: 200000 }), { imi: 300, loans: [{ id: 'L1', name: 'Banco', autoRec: true }] }));
  db.contracts.push(Object.assign(a.normContract({ id: 'C1', propertyId: 'P1', rent: 800, tenantIds: [] }), { autoRec: true }));
  db.recurring.push(
    rec(a, { id: 'R1', name: 'Luz' }, { kind: 'expense', propertyId: 'P1', amount: 40 }),
    rec(a, { id: 'R2', name: 'Água', muted: true }, { kind: 'expense', propertyId: 'P1', amount: 20 }),
    rec(a, { id: 'RC', name: 'Renda', auto: true }, { kind: 'income', propertyId: 'P1', contractId: 'C1', amount: 800 }),
    rec(a, { id: 'RL', name: 'Prestação', auto: true }, { kind: 'loan', propertyId: 'P1', loanId: 'L1', amount: 500 }),
    rec(a, { id: 'RI1', name: 'IMI 1', auto: true }, { kind: 'expense', propertyId: 'P1', propRec: 'imi', amount: 150 }),
    rec(a, { id: 'RI2', name: 'IMI 2', auto: true }, { kind: 'expense', propertyId: 'P1', propRec: 'imi', amount: 150 }),
  );
  db.templates.push(a.normTpl({ id: 'T1', name: 'Obras', tx: { kind: 'expense', amount: 100 } }), a.normTpl({ id: 'T2', name: 'Seguro', tx: { kind: 'expense', amount: 60 } }));
}

/* Uma sessão de colaborador: P1 meu, P2 onde sou contabilista, P3 onde só
   marco visitas — e um planeado alheio em cada um dos dois do Rui.
   Recebe: nada.
   Devolve: nada — enche o db e a sessão do app. */
function colaborador() {
  semear(app);
  app.db.properties.push(
    Object.assign(app.normProp({ id: 'P2', name: 'T2 Rui', ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui' }),
    Object.assign(app.normProp({ id: 'P3', name: 'T3 Rui', ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui' }),
  );
  const alheio = (id, pid) => Object.assign(rec(app, { id, name: 'Alheio ' + id }, { kind: 'expense', propertyId: pid, amount: 10 }), { _createdBy: 'rui', _atServidor: 5 });
  app.db.recurring.push(alheio('A2', 'P2'), alheio('A3', 'P3'));
  app.window.CW = { user: { id: 'eu' }, cargos: { P2: { dono: false, nome: 'Contabilista', perms: CONTAB }, P3: { dono: false, nome: 'Gestor de visitas', perms: GESTOR } }, pessoas: {} };
}

describe('as regras de vários planeados (planeados.js)', () => {
  beforeEach(() => semear(app));

  test('o silêncio da seleção: todos ativos silenciam, todos silenciados reativam, misturados nenhum', () => {
    assert.equal(app.recMudoDaSelecao(['R1', 'RC']), 'silenciar');
    assert.equal(app.recMudoDaSelecao(['R2']), 'reativar');
    assert.equal(app.recMudoDaSelecao(['R1', 'R2']), 'misto');
    assert.equal(app.recMudoDaSelecao([]), '');
    assert.equal(app.recMudoDaSelecao(['nao-existe']), '', 'um id que já não existe não conta');
  });

  test('silenciar vários muda cada um e o Anular devolve o silêncio de antes', () => {
    const r = app.recMudarVarios(['R1', 'RC'], true);
    assert.deepEqual(Array.from(r.feitos), ['R1', 'RC']);
    assert.equal(r.fora, 0);
    assert.ok(app.db.recurring.find((x) => x.id === 'R1').muted && app.db.recurring.find((x) => x.id === 'RC').muted);
    app.recMudoRepor(r.antes);
    assert.ok(!app.db.recurring.find((x) => x.id === 'R1').muted && !app.db.recurring.find((x) => x.id === 'RC').muted);
  });

  test('silenciar segue a regra de silenciar um só: um alheio onde sou contabilista silencia-se, onde só marco visitas fica de fora', () => {
    colaborador();
    const r = app.recMudarVarios(['A2', 'A3'], true);
    assert.deepEqual(Array.from(r.feitos), ['A2']);
    assert.equal(r.fora, 1);
    assert.match(r.recusa, /Não tens permissão/);
    assert.equal(app.db.recurring.find((x) => x.id === 'A3').muted, false, 'o recusado fica como estava');
  });

  test('apagar segue o delRec: o alheio não se apaga, o meu sim, e a confirmação diz quantos ficam de fora', () => {
    colaborador();
    const p = app.recPodeApagar(['R1', 'A2']);
    assert.deepEqual(Array.from(p.ok, (x) => x.id), ['R1']);
    assert.equal(p.fora, 1);
    assert.match(app.recApagarFrase(['R1', 'A2']), /^Deixa de se repetir; os movimentos já criados ficam\.<br>1 fica de fora: Só quem o adicionou pode apagar/);
    const r = app.recApagarVarios(['R1', 'A2']);
    assert.deepEqual(Array.from(r.feitos), ['R1']);
    assert.ok(!app.db.recurring.some((x) => x.id === 'R1'));
    assert.ok(app.db.recurring.some((x) => x.id === 'A2'), 'o alheio ficou');
  });

  test('a renda automática desliga o autoRec do contrato, a prestação o da hipoteca; o Anular volta a ligá-los', () => {
    const r = app.recApagarVarios(['RC', 'RL']);
    assert.deepEqual(Array.from(r.feitos), ['RC', 'RL']);
    assert.equal(app.db.contracts[0].autoRec, false);
    assert.equal(app.db.properties[0].loans[0].autoRec, false);
    r.desfaz.slice().reverse().forEach((d) => app.recRepor(d));
    assert.equal(app.db.contracts[0].autoRec, true);
    assert.equal(app.db.properties[0].loans[0].autoRec, true);
    assert.ok(['RC', 'RL'].every((id) => app.db.recurring.some((x) => x.id === id)), 'os dois voltaram');
  });

  test('o IMI da ficha leva o valor e a prestação irmã, mesmo marcadas as duas; o Anular repõe as duas e o valor', () => {
    const r = app.recApagarVarios(['RI1', 'RI2']);
    assert.deepEqual(Array.from(r.feitos), ['RI1', 'RI2']);
    assert.equal(r.desfaz.length, 1, 'a irmã saiu com a primeira');
    assert.equal(app.db.properties[0].imi, 0);
    assert.ok(!app.db.recurring.some((x) => x.tx.propRec === 'imi'));
    app.recRepor(r.desfaz[0]);
    assert.equal(app.db.properties[0].imi, 300);
    assert.equal(app.db.recurring.filter((x) => x.tx.propRec === 'imi').length, 2);
  });

  test('a confirmação de vários diz o que cada automático arrasta, no singular e no plural', () => {
    const f = app.recApagarFrase(['R1', 'RC', 'RL', 'RI1']);
    assert.match(f, /^Deixam de se repetir; os movimentos já criados ficam\./);
    assert.match(f, /1 é a renda de um contrato: volta a ligar-se guardando o contrato de novo\./);
    assert.match(f, /1 é a prestação de uma hipoteca: volta a ligar-se na hipoteca\./);
    assert.match(f, /1 vem da ficha do imóvel \(IMI, condomínio, seguro\): o valor sai também da ficha\./);
    assert.doesNotMatch(f, /de fora/);
  });

  test('o delRec de um só continua igual, agora pelo recTirar', () => {
    app.confirmModal = (t, txt, sim) => sim();
    app.closeAllModals = () => {}; app.render = () => {}; app.buildNav = () => {}; app.toast = () => {}; app.save = () => {};
    app.delRec('RC');
    assert.ok(!app.db.recurring.some((x) => x.id === 'RC'));
    assert.equal(app.db.contracts[0].autoRec, false);
  });

  test('apagar vários modelos devolve as cópias para o Anular', () => {
    const copia = app.tplApagarVarios(['T1']);
    assert.deepEqual(Array.from(copia, (x) => x.name), ['Obras']);
    assert.deepEqual(Array.from(app.db.templates, (x) => x.id), ['T2']);
  });
});

describe('o toque longo e a seleção nos Planeados (cloud/selecao-listas.js)', () => {
  let msgs, desfazer, perguntas;
  beforeEach(() => {
    semear(nuvem);
    nuvem.CW.selL = { tipo: null, ids: {} };
    msgs = []; desfazer = null; perguntas = [];
    nuvem.toast = (m) => { msgs.push(m); };
    nuvem.render = () => {}; nuvem.save = () => {}; nuvem.buildNav = () => {}; nuvem.closeAllModals = () => {};
    nuvem.comDesfazer = (m, restaurar) => { msgs.push(m); desfazer = restaurar; };
    nuvem.confirmModal = (t, txt, sim) => { perguntas.push({ t, txt }); sim(); };
    nuvem.tab = 'recurring';
  });
  afterEach(() => { nuvem.CW.selL = { tipo: null, ids: {} }; });

  test('o toque longo num planeado abre as opções com «Selecionar vários» no fim, que entra com ele marcado', () => {
    let titulo = '', opts = null;
    nuvem.lpShow = (t, o) => { titulo = t; opts = o; };
    nuvem.lpLongo('rec:R1');
    assert.equal(titulo, 'Luz');
    const ult = opts[opts.length - 1];
    assert.equal(ult.label, 'Selecionar vários');
    assert.equal(ult.icon, 'caixaVisto');
    assert.deepEqual(Array.from(opts, (o) => o.label).slice(0, -1), ['Confirmar', 'Silenciar', 'Editar', 'Apagar']);
    ult.act();
    assert.equal(nuvem.CW.selL.tipo, 'rec');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), ['R1']);
  });

  test('num modelo o mesmo; e fora da página dos Planeados a folha não oferece a seleção', () => {
    let opts = null;
    nuvem.lpShow = (t, o) => { opts = o; };
    nuvem.lpLongo('tpl:T1');
    assert.deepEqual(Array.from(opts, (o) => o.label), ['Usar modelo', 'Editar', 'Apagar', 'Selecionar vários']);
    nuvem.tab = 'calendar';
    nuvem.lpMenu('rec:R1');
    assert.ok(!opts.some((o) => o.label === 'Selecionar vários'), 'noutro ecrã não há seleção');
  });

  test('o que a nuvem acrescenta à folha depois de ela abrir («Recusar desta vez») fica antes do «Selecionar vários»', () => {
    const op = (t) => ({ querySelector: (s) => (s === 'b' ? { textContent: t } : null), t });
    const filhos = [op('Confirmar'), op('Selecionar vários'), op('Recusar desta vez')];
    const lista = { get children() { return filhos.slice(); }, get lastElementChild() { return filhos[filhos.length - 1]; },
      appendChild: (x) => { filhos.splice(filhos.indexOf(x), 1); filhos.push(x); } };
    nuvem.document.querySelectorAll = (s) => (s === '.modal.open' ? [{ querySelector: (q) => (q === '.body .list' ? lista : null) }] : []);
    nuvem.selLPortaNoFim();
    assert.deepEqual(filhos.map((x) => x.t), ['Confirmar', 'Recusar desta vez', 'Selecionar vários']);
    nuvem.selLPortaNoFim();
    assert.deepEqual(filhos.map((x) => x.t), ['Confirmar', 'Recusar desta vez', 'Selecionar vários'], 'já no fim, fica');
  });

  test('em seleção o toque longo marca como o toque; o outro tipo com marcas avisa e não as deita fora; sem marcas, a seleção passa a ele', () => {
    nuvem.CW.selLEntrar('rec', 'R1');
    nuvem.lpLongo('rec:RC');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids).sort(), ['R1', 'RC']);
    nuvem.lpLongo('rec:R1');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), ['RC'], 'desmarca');
    nuvem.CW.selLOutro('tpl', 'T1');
    assert.equal(nuvem.CW.selL.tipo, 'rec');
    assert.match(msgs.pop(), /^Seleciona planeados ou modelos, não os dois: desmarca os planeados para escolheres modelos\.$/);
    nuvem.CW.selLToggle('RC');
    nuvem.lpLongo('tpl:T1');
    assert.equal(nuvem.CW.selL.tipo, 'tpl', 'sem marcas, ou um ou outro: passa aos modelos');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), ['T1']);
  });

  test('o «Selecionar vários» do cabeçalho entra com os planeados, ou com os modelos quando não há planeados à vista', () => {
    nuvem.document.querySelector = (s) => (s === '#view [data-lp^="rec:"]' || s === '#view [data-lp^="tpl:"]' ? {} : null);
    assert.equal(nuvem.selLTipoDe('recurring'), 'rec');
    nuvem.hdrFiltToggle();
    assert.equal(nuvem.CW.selL.tipo, 'rec');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), []);
    nuvem.hdrFiltToggle();
    assert.equal(nuvem.CW.selL.tipo, null, 'dentro, sai');
    nuvem.document.querySelector = (s) => (s === '#view [data-lp^="tpl:"]' ? {} : null);
    assert.equal(nuvem.selLTipoDe('recurring'), 'tpl');
    assert.equal(nuvem.selLHaCartoes('recurring'), true);
    nuvem.document.querySelector = () => null;
    assert.equal(nuvem.selLHaCartoes('recurring'), false, 'sem cartões, o botão some');
    assert.deepEqual(Array.from(nuvem.selLTiposDe('recurring')), ['rec', 'tpl']);
    assert.equal(nuvem.selLTipoDe('visits'), null);
  });

  test('o botão do cabeçalho é a caixa com o visto nos Planeados, nos Imóveis e nos Movimentos, e no kebab', () => {
    const caixa = nuvem.ic('caixaVisto', 18);
    assert.notEqual(caixa, nuvem.ic('check', 18));
    const hb = nuvem.document.getElementById('hdrFilt');
    nuvem.document.querySelector = (s) => (s === '#view [data-lp^="rec:"]' ? {} : null);
    nuvem.selLCabecalho();
    assert.equal(hb.innerHTML, caixa);
    assert.equal(hb.title, 'Selecionar vários');
    assert.equal(hb.style.display, '');
    const fonte = readFileSync(new URL('../web/cloud/selecao.js', import.meta.url), 'utf8');
    assert.match(fonte, /if \(!CW\.selMode\) \{[\s\S]*?hb\.innerHTML = ic\('caixaVisto', 18\);/, 'os Movimentos também');
    const listas = readFileSync(new URL('../web/cloud/selecao-listas.js', import.meta.url), 'utf8');
    assert.match(listas, /u-c-v-accent u-fx-0-0-34px">' \+ ic\('caixaVisto', 18\)/, 'e o «Selecionar vários» do kebab');
    assert.doesNotMatch(listas, /ic\('check', 18\)/);
  });

  test('a barra dos planeados: Silenciar com todos ativos, Reativar com todos silenciados, misturados nenhum e a razão dita', () => {
    const mudo = nuvem.document.getElementById('selLMudo'), pq = nuvem.document.getElementById('selLPorque');
    nuvem.CW.selL = { tipo: 'rec', ids: { R1: 1, RC: 1 } };
    nuvem.selLPintar();
    assert.equal(mudo.hidden, false);
    assert.match(mudo.innerHTML, /Silenciar$/);
    assert.equal(pq.textContent, '');
    nuvem.CW.selL = { tipo: 'rec', ids: { R2: 1 } };
    nuvem.selLPintar();
    assert.equal(mudo.hidden, false);
    assert.match(mudo.innerHTML, /Reativar$/);
    nuvem.CW.selL = { tipo: 'rec', ids: { R1: 1, R2: 1 } };
    nuvem.selLPintar();
    assert.equal(mudo.hidden, true);
    assert.equal(pq.textContent, 'Ativos e silenciados: escolhe só uns para silenciar ou reativar.');
    nuvem.CW.selL = { tipo: 'rec', ids: {} };
    nuvem.selLPintar();
    assert.equal(mudo.hidden, true, 'sem nada marcado, nenhum');
    assert.equal(pq.textContent, '');
  });

  test('o HTML da barra: os planeados com o silêncio e o Cancelar com nome, os modelos sem silêncio, as outras listas como estavam', () => {
    const r = nuvem.selLBarraHtml('rec');
    assert.match(r, /class="btn sel-l-cancelar" aria-label="Cancelar a seleção"[^>]*data-click="CW\.selLSair\(\)"><svg[\s\S]*?<span class="sel-l-txt">Cancelar<\/span>/);
    assert.match(r, /<span id="selLPorque" class="small" aria-live="polite"><\/span>/);
    assert.match(r, /<button type="button" class="btn" id="selLMudo" hidden data-toca="dados" data-click="CW\.selLMudo\(\)"><\/button>/);
    assert.ok(r.indexOf('selLMudo') < r.indexOf('CW.selLApagar()'), 'o silêncio antes do Apagar');
    assert.doesNotMatch(nuvem.selLBarraHtml('tpl'), /selLMudo/);
    assert.match(nuvem.selLBarraHtml('tpl'), /CW\.selLApagar\(\)/);
    assert.match(nuvem.selLBarraHtml('prop'), /^<button type="button" class="btn" data-toca="modo" data-click="CW\.selLSair\(\)"><svg[\s\S]*? Cancelar<\/button><b id="selLConta" class="u-fx-1 u-ta-center"><\/b>/);
  });

  test('Silenciar os marcados grava, sai da seleção e o Anular reativa-os; misturados só avisa', () => {
    nuvem.CW.selL = { tipo: 'rec', ids: { R1: 1, R2: 1 } };
    nuvem.CW.selLMudo();
    assert.match(msgs.pop(), /^Há ativos e silenciados/);
    assert.equal(nuvem.db.recurring.find((x) => x.id === 'R1').muted, false, 'nada mudou');
    nuvem.CW.selL = { tipo: 'rec', ids: { R1: 1, RC: 1 } };
    nuvem.CW.selLMudo();
    assert.equal(nuvem.CW.selL.tipo, null, 'saiu da seleção');
    assert.equal(msgs.pop(), '2 planeados silenciados: ficam à espera de confirmação, sem avisos.');
    assert.ok(nuvem.db.recurring.filter((x) => x.id === 'R1' || x.id === 'RC').every((x) => x.muted));
    desfazer();
    assert.ok(nuvem.db.recurring.filter((x) => x.id === 'R1' || x.id === 'RC').every((x) => !x.muted));
    nuvem.CW.selL = { tipo: 'rec', ids: { R2: 1 } };
    nuvem.CW.selLMudo();
    assert.equal(msgs.pop(), '1 planeado reativado: volta a avisar.');
  });

  test('Apagar planeados pergunta com os números, apaga, e o Anular repõe tudo; os modelos à parte', () => {
    nuvem.CW.selL = { tipo: 'rec', ids: { R1: 1, RC: 1 } };
    nuvem.CW.selLApagar();
    assert.equal(perguntas[0].t, 'Apagar 2 planeados');
    assert.match(perguntas[0].txt, /é a renda de um contrato/);
    assert.ok(!nuvem.db.recurring.some((x) => x.id === 'R1' || x.id === 'RC'));
    assert.equal(nuvem.db.contracts[0].autoRec, false);
    assert.equal(msgs.pop(), '2 planeados apagados.');
    desfazer();
    assert.ok(['R1', 'RC'].every((id) => nuvem.db.recurring.some((x) => x.id === id)));
    assert.equal(nuvem.db.contracts[0].autoRec, true);
    nuvem.CW.selL = { tipo: 'tpl', ids: { T1: 1, T2: 1 } };
    nuvem.CW.selLApagar();
    assert.equal(perguntas[1].t, 'Apagar 2 modelos');
    assert.equal(perguntas[1].txt, 'Os movimentos criados a partir deles ficam.');
    assert.equal(nuvem.db.templates.length, 0);
    desfazer();
    assert.deepEqual(Array.from(nuvem.db.templates, (x) => x.id).sort(), ['T1', 'T2']);
  });

  test('em seleção, as caixas vão nos cartões do tipo, o outro tipo fica atenuado e cada cartão diz se está marcado', () => {
    const cartao = (lp) => {
      const atr = { 'data-lp': lp }, cls = new Set(), filhos = [];
      return { atr, cls, filhos, getAttribute: (k) => atr[k] || null, setAttribute: (k, v) => { atr[k] = String(v); },
        querySelector: (s) => (s === '.selbox' || s === '[data-selbox]' ? filhos[0] || null : null),
        insertBefore: (x) => { filhos.unshift(x); }, firstChild: null,
        classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, v) => (v ? cls.add(c) : cls.delete(c)) } };
    };
    const r1 = cartao('rec:R1'), rc = cartao('rec:RC'), t1 = cartao('tpl:T1');
    nuvem.document.querySelectorAll = (s) => (s === '#view [data-lp^="rec:"]' ? [r1, rc] : s === '#view [data-lp^="tpl:"]' ? [t1] : []);
    const corpo = [];
    nuvem.document.body.appendChild = (x) => { corpo.push(x); return x; };
    nuvem.CW.selLEntrar('rec', 'R1');
    nuvem.selLDecorar();
    assert.match(r1.filhos[0].className, /^selbox sel-entra$/, 'ao entrar, as caixas desvanecem');
    assert.equal(r1.atr['data-click'], "CW.selLToggle('R1')");
    assert.equal(r1.atr['aria-pressed'], 'true');
    assert.equal(rc.atr['aria-pressed'], 'false');
    assert.ok(r1.cls.has('sel-on-card'));
    assert.ok(t1.cls.has('sel-fora'));
    assert.equal(t1.atr['data-click'], "CW.selLOutro('tpl','T1')");
    assert.match(corpo[0].className, /^sel-fundo sel-l-plan$/);
    assert.match(corpo[0].innerHTML, /id="selLMudo"/);
    const rc2 = cartao('rec:RC');
    nuvem.document.querySelectorAll = (s) => (s === '#view [data-lp^="rec:"]' ? [rc2] : []);
    nuvem.selLDecorar();
    assert.equal(rc2.filhos[0].className, 'selbox', 'uma repintura sem mudar de modo não volta a animar');
  });

  test('a folha: as caixas do modelo cabem no chip, entram a desvanecer com os tokens, e a barra dos planeados cabe a 375px', () => {
    const sec = css.slice(css.indexOf('/* ===== ajustes-v40c: 1.3'), css.indexOf('/* ===== fim: ajustes-v40c 1.3 ===== */'));
    assert.ok(sec.length > 100, 'a secção da folha existe');
    assert.match(sec, /#view \[data-selbox\]\.sel-entra\{animation:veuEntra var\(--medio\) var\(--curva-entra\) backwards\}/);
    assert.match(sec, /\.plan-modelo>\[data-selbox\]\{padding:0;margin-right:8px\}/);
    assert.match(sec, /\.sel-fundo #selLMudo\[hidden\]\{display:none\}/, 'o .btn não esconde o [hidden] sozinho');
    assert.match(sec, /@media\(max-width:430px\)\{\s*\.sel-fundo\.sel-l-plan \.sel-l-cancelar\{width:44px;padding:0;flex:0 0 44px\}/);
    assert.doesNotMatch(sec, /#[0-9a-f]{3,6}\b|rgba?\(/i, 'cores só por tokens');
    assert.doesNotMatch(sec, /\d+m?s\b(?![^(]*\))/, 'tempos só por tokens');
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important/);
  });
});
