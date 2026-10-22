// Os inquilinos e as visitas selecionam-se como as Casas (cloud/selecao-listas.js):
// o toque longo entra na seleção com o tocado já marcado (o id lido pela forma
// de cada data-lp — «per:tenant:<id>», «vis:<id>» — e os proprietários de
// fora); o «Selecionar vários» do cabeçalho aparece nos dois separadores; as
// contagens têm o plural e o género certos; a caixa entra antes do avatar e
// antes do bloco da data. Nos inquilinos a barra apaga vários com as regras do
// delPerson (quem não posso apagar não se marca) e o Anular repõe as fichas e o
// lugar delas nos contratos, com os documentos só a sair quando o Anular
// expira. Nas visitas a barra marca como realizada ou falta (só agendadas, com
// a razão dita) e apaga, tudo com o Anular. A barra dos Planeados mostra a
// contagem no telemóvel, como as outras.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarTudo, limpar, repor } from './arnes.js';

const nuvem = carregarTudo();
afterEach(() => repor(nuvem));
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r/g, '');
const HOJE = new Date().toISOString().slice(0, 10);

/* Um imóvel meu (P1) e um onde só colaboro (P2, do Rui), três inquilinos —
   dois no mesmo contrato, um com um documento — e um alheio no imóvel do Rui;
   quatro visitas: duas agendadas, uma realizada, e uma alheia no P2.
   Recebe: a — o proxy.
   Devolve: nada — enche o db. */
function semear(a) {
  const db = limpar(a);
  db.properties.push(a.normProp({ id: 'P1', name: 'T2 Lisboa' }));
  db.properties.push(Object.assign(a.normProp({ id: 'P2', name: 'T3 Rui', ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui' }));
  db.tenants.push(
    Object.assign(a.normPerson({ id: 't1', name: 'Ana Rodrigues' }), { files: [{ id: 'f1', name: 'CC.pdf' }] }),
    a.normPerson({ id: 't2', name: 'Bruno Silva' }),
    a.normPerson({ id: 't3', name: 'Carla Matos' }),
    Object.assign(a.normPerson({ id: 'tr', name: 'Do Rui', houseId: 'P2' }), { _createdBy: 'rui', _atServidor: 3 }),
  );
  db.contracts.push(a.normContract({ id: 'C1', propertyId: 'P1', tenantIds: ['t1', 't2'], rent: 800, start: '2025-01-01' }));
  db.contracts.push(a.normContract({ id: 'C2', propertyId: 'P1', tenantIds: ['t3', 't1'], rent: 300, start: '2025-01-01' }));
  db.visits = [
    a.normVisit({ id: 'v1', nomes: 'Rita', propertyId: 'P1', date: HOJE, estado: 'agendada' }),
    a.normVisit({ id: 'v2', nomes: 'João', propertyId: 'P1', date: HOJE, estado: 'agendada' }),
    a.normVisit({ id: 'v3', nomes: 'Luís', propertyId: 'P1', date: '2020-05-01', estado: 'realizada' }),
    Object.assign(a.normVisit({ id: 'vr', nomes: 'Alheia', propertyId: 'P2', date: HOJE, estado: 'agendada' }), { _createdBy: 'rui', _atServidor: 3 }),
  ];
}

/* Um cartão falso, com o que o selLDecorar e o selLPintar lhe fazem.
   Recebe: lp — o data-lp.
   Devolve: o cartão, com atr, cls e filhos à vista. */
function cartao(lp) {
  const atr = { 'data-lp': lp }, cls = new Set(), filhos = [];
  return { atr, cls, filhos, getAttribute: (k) => (k in atr ? atr[k] : null), setAttribute: (k, v) => { atr[k] = String(v); },
    querySelector: (s) => (s === '.selbox' || s === '[data-selbox]' ? filhos[0] || null : null),
    insertBefore: (x) => { filhos.unshift(x); }, firstChild: null,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, v) => (v ? cls.add(c) : cls.delete(c)) } };
}

describe('a seleção dos Inquilinos e das Visitas', () => {
  let msgs, desfazer, expira, perguntas, folhas, cargos, user;
  beforeEach(() => {
    semear(nuvem);
    nuvem.CW.selL = { tipo: null, ids: {} };
    cargos = nuvem.CW.cargos; user = nuvem.CW.user;
    nuvem.CW.user = { id: 'eu' };
    nuvem.CW.cargos = { P2: { dono: false, nome: 'Gestor', perms: ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'] } };
    msgs = []; desfazer = null; expira = null; perguntas = []; folhas = 0;
    nuvem.toast = (m) => { msgs.push(m); };
    nuvem.render = () => {}; nuvem.save = () => {}; nuvem.buildNav = () => {}; nuvem.closeAllModals = () => {};
    nuvem.lpShow = () => { folhas++; };
    nuvem.comDesfazer = (m, restaurar, aoExpirar) => { msgs.push(m); desfazer = restaurar; expira = aoExpirar; };
    nuvem.confirmModal = (t, txt, sim) => { perguntas.push({ t, txt }); sim(); };
  });
  afterEach(() => { nuvem.CW.selL = { tipo: null, ids: {} }; nuvem.CW.cargos = cargos; nuvem.CW.user = user; });

  test('o data-lp lê-se pela forma de cada tipo: o id dos inquilinos é a 3.ª parte, os proprietários ficam de fora', () => {
    assert.deepEqual({ ...nuvem.selLDoLp('per:tenant:t1') }, { tipo: 'ten', id: 't1' });
    assert.deepEqual({ ...nuvem.selLDoLp('vis:v1') }, { tipo: 'vis', id: 'v1' });
    assert.deepEqual({ ...nuvem.selLDoLp('prop:P1') }, { tipo: 'prop', id: 'P1' }, 'os outros como estavam');
    assert.equal(nuvem.selLDoLp('per:owner:o1'), null);
    assert.equal(nuvem.selLDoLp('per:tenant:'), null, 'sem id não é cartão');
    assert.equal(nuvem.selLDoLp('tx:x1'), null, 'os movimentos são do outro motor');
    assert.equal(nuvem.selLIdDe(cartao('per:tenant:t2'), 'ten'), 't2');
    assert.equal(nuvem.selLIdDe(cartao('vis:v9'), 'vis'), 'v9');
  });

  test('o toque longo num inquilino entra na seleção com ele marcado, sem abrir a folha das opções', () => {
    nuvem.tab = 'tenants';
    nuvem.lpLongo('per:tenant:t1');
    assert.equal(folhas, 0);
    assert.equal(nuvem.CW.selL.tipo, 'ten');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), ['t1']);
    nuvem.lpLongo('per:tenant:t2');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids).sort(), ['t1', 't2'], 'em seleção, o toque longo marca');
    nuvem.lpLongo('per:tenant:t1');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), ['t2'], 'e desmarca');
  });

  test('num proprietário o toque longo continua sem fazer nada; nas visitas da Visão geral também', () => {
    nuvem.tab = 'owners';
    nuvem.lpLongo('per:owner:o1');
    assert.equal(nuvem.CW.selL.tipo, null);
    assert.equal(folhas, 0);
    nuvem.tab = 'dashboard';
    nuvem.lpLongo('vis:v1');
    assert.equal(nuvem.CW.selL.tipo, null, 'a seleção das visitas só existe no separador delas');
    nuvem.tab = 'visits';
    nuvem.lpLongo('vis:v1');
    assert.equal(nuvem.CW.selL.tipo, 'vis');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), ['v1']);
  });

  test('o «Selecionar vários» do cabeçalho existe nos Inquilinos e nas Visitas, e não nos Proprietários', () => {
    const hb = nuvem.document.getElementById('hdrFilt');
    const cls = new Set();
    hb.classList = { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle() {}, contains: (c) => cls.has(c) };
    for (const [t, lp] of [['tenants', 'per:tenant:'], ['visits', 'vis:']]) {
      cls.clear();
      nuvem.tab = t;
      nuvem.document.querySelector = (s) => (s === '#view [data-lp^="' + lp + '"]' ? {} : null);
      nuvem.selLCabecalho();
      assert.ok(cls.has('lst-hdr-sel'), t);
      assert.equal(hb.title, 'Selecionar vários');
      assert.equal(hb.style.display, '', t + ': com cartões à vista');
      nuvem.hdrFiltToggle();
      assert.equal(nuvem.CW.selL.tipo, t === 'tenants' ? 'ten' : 'vis', 'entra sem nada marcado');
      assert.deepEqual(Object.keys(nuvem.CW.selL.ids), []);
      nuvem.CW.selLSair();
    }
    nuvem.tab = 'owners';
    nuvem.document.querySelector = (s) => (s === '#view [data-lp^="per:owner:"]' ? {} : null);
    nuvem.selLCabecalho();
    assert.ok(!cls.has('lst-hdr-sel'), 'nos Proprietários o botão volta a ser de quem o pinta');
  });

  test('as contagens têm o plural e o género certos: «1 inquilino», «nenhuma visita», «2 selecionadas»', () => {
    const conta = nuvem.document.getElementById('selLCabConta'), barra = nuvem.document.getElementById('selLConta');
    nuvem.document.querySelectorAll = () => [];
    nuvem.CW.selL = { tipo: 'ten', ids: { t1: 1 } };
    nuvem.selLPintar();
    assert.equal(conta.textContent, '1 inquilino');
    assert.equal(barra.textContent, '1 selecionado');
    nuvem.CW.selL = { tipo: 'ten', ids: { t1: 1, t2: 1 } };
    nuvem.selLPintar();
    assert.equal(conta.textContent, '2 inquilinos');
    nuvem.CW.selL = { tipo: 'ten', ids: {} };
    nuvem.selLPintar();
    assert.equal(conta.textContent, 'nenhum inquilino');
    assert.equal(barra.textContent, 'toca nos inquilinos');
    nuvem.CW.selL = { tipo: 'vis', ids: {} };
    nuvem.selLPintar();
    assert.equal(conta.textContent, 'nenhuma visita');
    assert.equal(barra.textContent, 'toca nas visitas');
    nuvem.CW.selL = { tipo: 'vis', ids: { v1: 1, v2: 1 } };
    nuvem.selLPintar();
    assert.equal(conta.textContent, '2 visitas');
    assert.equal(barra.textContent, '2 selecionadas');
    assert.equal(nuvem.selLPalavras('vis').todos, 'todas as visitas');
    assert.equal(nuvem.selLPalavras('prop').toca, 'toca nos cartões', 'as Casas como estavam');
  });

  test('a caixa entra à cabeça da linha (antes do avatar, antes do bloco da data); quem não posso apagar fica atenuado, sem caixa, e o toque diz porquê', () => {
    nuvem.tab = 'tenants';
    const t1 = cartao('per:tenant:t1'), tr = cartao('per:tenant:tr');
    const corpo = [];
    nuvem.document.querySelectorAll = (s) => (s === '#view [data-lp^="per:tenant:"]' ? [t1, tr] : []);
    nuvem.document.body.appendChild = (x) => { corpo.push(x); return x; };
    nuvem.CW.selLEntrar('ten', 't1');
    nuvem.selLDecorar();
    assert.equal(t1.filhos.length, 1, 'a caixa à cabeça da linha (a .pes-linha não tem .row-between)');
    assert.match(t1.filhos[0].className, /^selbox sel-entra$/, 'ao entrar, desvanece');
    assert.equal(t1.atr['data-click'], "CW.selLToggle('t1')");
    assert.equal(t1.atr['aria-pressed'], 'true');
    assert.ok(t1.cls.has('sel-on-card'));
    assert.equal(tr.filhos.length, 0, 'o alheio não tem caixa');
    assert.ok(tr.cls.has('sel-fora'));
    assert.equal(tr.atr['aria-disabled'], 'true');
    assert.equal(tr.atr['aria-pressed'], undefined, 'nem diz marcado ou não');
    nuvem.CW.selLToggle('tr');
    assert.match(msgs.pop(), /Só quem o adicionou pode apagar/);
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), ['t1'], 'não se marcou');
    nuvem.CW.selLToggle('t1');
    nuvem.CW.selLTodos();
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), ['t1'], 'a caixa de tudo também o deixa de fora');
    nuvem.CW.selLTodos();
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), [], 'e com todos os que se marcam marcados, desmarca');
    assert.match(corpo[0].className, /^sel-fundo$/, 'a barra das Casas, numa linha');
    assert.match(corpo[0].innerHTML, /Cancelar<\/button><b id="selLConta" class="u-fx-1 u-ta-center"><\/b><button [^>]*data-sel-l-precisa[^>]*CW\.selLApagar\(\)/);
  });

  test('o toque longo num inquilino que não posso apagar entra na seleção sem o marcar, e diz porquê', () => {
    nuvem.tab = 'tenants';
    nuvem.lpLongo('per:tenant:tr');
    assert.equal(nuvem.CW.selL.tipo, 'ten');
    assert.deepEqual(Object.keys(nuvem.CW.selL.ids), []);
    assert.match(msgs.pop(), /Só quem o adicionou pode apagar/);
  });

  test('apagar vários inquilinos pergunta com os contratos, tira-os dos contratos, e o Anular repõe as fichas no lugar de cada uma', () => {
    nuvem.tab = 'tenants';
    nuvem.CW.selL = { tipo: 'ten', ids: { t1: 1, t2: 1 } };
    let apagados = [];
    nuvem.idbDel = (id) => { apagados.push(id); return Promise.resolve(); };
    nuvem.CW.selLApagar();
    assert.equal(perguntas[0].t, 'Apagar 2 inquilinos');
    assert.equal(perguntas[0].txt, 'Saem de 2 contratos, que se mantêm.');
    assert.deepEqual(Array.from(nuvem.db.tenants, (t) => t.id), ['t3', 'tr']);
    assert.deepEqual(Array.from(nuvem.db.contracts[0].tenantIds), []);
    assert.deepEqual(Array.from(nuvem.db.contracts[1].tenantIds), ['t3']);
    assert.equal(nuvem.CW.selL.tipo, null, 'saiu da seleção');
    assert.equal(msgs.pop(), '2 inquilinos apagados.');
    assert.deepEqual(apagados, [], 'os documentos ficam enquanto se pode anular');
    nuvem.db.contracts[1].tenantIds.push('t9');   // entretanto entrou outro
    desfazer();
    assert.deepEqual(Array.from(nuvem.db.tenants, (t) => t.id).sort(), ['t1', 't2', 't3', 'tr']);
    assert.deepEqual(Array.from(nuvem.db.contracts[0].tenantIds), ['t1', 't2']);
    assert.deepEqual(Array.from(nuvem.db.contracts[1].tenantIds), ['t3', 't1', 't9'], 'cada um no seu lugar, sem tirar o que entrou');
    expira();
    assert.deepEqual(apagados, ['f1'], 'sem anular, os documentos saem do IndexedDB');
  });

  test('apagar um só diz o nome; sem contratos diz que não há; o alheio marcado à força fica de fora; só alheios não pergunta', () => {
    nuvem.tab = 'tenants';
    nuvem.CW.selL = { tipo: 'ten', ids: { t3: 1 } };
    nuvem.db.contracts = [];
    nuvem.CW.selLApagar();
    assert.equal(perguntas[0].t, 'Apagar 1 inquilino');
    assert.equal(perguntas[0].txt, 'Apagar “Carla Matos”? Sem contratos ligados.');
    assert.equal(msgs.pop(), '1 inquilino apagado.');
    nuvem.CW.selL = { tipo: 'ten', ids: { t2: 1, tr: 1 } };
    nuvem.CW.selLApagar();
    assert.match(perguntas[1].txt, / 1 ficou de fora: sem permissão\.$/);
    assert.ok(nuvem.db.tenants.some((t) => t.id === 'tr'), 'o alheio ficou');
    nuvem.CW.selL = { tipo: 'ten', ids: { tr: 1 } };
    nuvem.CW.selLApagar();
    assert.equal(perguntas.length, 2, 'só com quem não posso apagar, não pergunta');
    assert.match(msgs.pop(), /Só quem o adicionou pode apagar/);
  });

  test('a barra das visitas: × Cancelar, a contagem com a razão, Realizada, Falta e Apagar, as ações numa segunda linha', () => {
    const r = nuvem.selLBarraHtml('vis');
    const ordem = ['CW.selLSair()', 'id="selLConta"', 'id="selLPorque"', 'sel-l-quebra', "CW.selLVisEstado('realizada')", "CW.selLVisEstado('faltou')", 'CW.selLApagar()'].map((x) => r.indexOf(x));
    assert.ok(ordem.every((x, i) => x > -1 && (i === 0 || x > ordem[i - 1])), 'pela ordem: ' + ordem.join(','));
    assert.match(r, /> Realizada<\/button>/);
    assert.match(r, /> Falta<\/button>/);
    assert.equal((r.match(/data-sel-l-precisa/g) || []).length, 3, 'as três ações desligam-se sem nada marcado');
  });

  test('Realizada e Falta só com todas agendadas e que posso alterar; senão desligadas, com a razão', () => {
    assert.deepEqual({ ...nuvem.selLVisPode(['v1', 'v2']) }, { pode: true, porque: '' });
    assert.deepEqual({ ...nuvem.selLVisPode([]) }, { pode: false, porque: '' }, 'sem nada marcado, calado');
    const passada = nuvem.selLVisPode(['v1', 'v3']);
    assert.equal(passada.pode, false);
    assert.equal(passada.porque, 'Só as agendadas se marcam como realizadas ou falta.');
    const botoes = { selLRealizada: { disabled: false }, selLFalta: { disabled: false }, selLPorque: { textContent: '' } };
    const getById = nuvem.document.getElementById;
    nuvem.document.getElementById = (id) => botoes[id] || getById(id);
    nuvem.CW.selL = { tipo: 'vis', ids: { v1: 1, v3: 1 } };
    nuvem.selLPintarVisitas();
    assert.ok(botoes.selLRealizada.disabled && botoes.selLFalta.disabled);
    assert.equal(botoes.selLPorque.textContent, 'Só as agendadas se marcam como realizadas ou falta.');
    nuvem.CW.selL = { tipo: 'vis', ids: { v1: 1 } };
    nuvem.selLPintarVisitas();
    assert.ok(!botoes.selLRealizada.disabled && !botoes.selLFalta.disabled);
    assert.equal(botoes.selLPorque.textContent, '');
  });

  test('marcar duas como realizadas grava, sai, e o Anular devolve o estado de cada uma; com uma que já passou só avisa', () => {
    nuvem.tab = 'visits';
    nuvem.db.visits[1].estado = 'agendada';
    nuvem.CW.selL = { tipo: 'vis', ids: { v1: 1, v2: 1 } };
    nuvem.CW.selLVisEstado('realizada');
    assert.equal(nuvem.CW.selL.tipo, null);
    assert.equal(msgs.pop(), '2 visitas marcadas como realizadas — preenche o desfecho quando souberes.');
    assert.ok(['v1', 'v2'].every((id) => nuvem.db.visits.find((v) => v.id === id).estado === 'realizada'));
    desfazer();
    assert.ok(['v1', 'v2'].every((id) => nuvem.db.visits.find((v) => v.id === id).estado === 'agendada'));
    nuvem.CW.selL = { tipo: 'vis', ids: { v1: 1 } };
    nuvem.CW.selLVisEstado('faltou');
    assert.equal(msgs.pop(), '1 visita marcada como falta.');
    assert.equal(nuvem.db.visits[0].estado, 'faltou');
    nuvem.CW.selL = { tipo: 'vis', ids: { v2: 1, v3: 1 } };
    nuvem.CW.selLVisEstado('realizada');
    assert.equal(msgs.pop(), 'Só as agendadas se marcam como realizadas ou falta.');
    assert.equal(nuvem.db.visits[1].estado, 'agendada', 'nada mudou');
    assert.equal(nuvem.CW.selL.tipo, 'vis', 'e continua em seleção');
  });

  test('apagar várias visitas pergunta, apaga, e o Anular repõe; a alheia não se marca', () => {
    nuvem.tab = 'visits';
    assert.match(nuvem.selLRecusa('vis', 'vr'), /Só quem o adicionou/);
    assert.equal(nuvem.selLRecusa('vis', 'v1'), '');
    nuvem.CW.selL = { tipo: 'vis', ids: { v1: 1, v3: 1 } };
    nuvem.CW.selLApagar();
    assert.equal(perguntas[0].t, 'Apagar 2 visitas');
    assert.equal(perguntas[0].txt, 'Saem da lista e da Agenda.');
    assert.deepEqual(Array.from(nuvem.db.visits, (v) => v.id), ['v2', 'vr']);
    assert.equal(msgs.pop(), '2 visitas apagadas.');
    desfazer();
    assert.deepEqual(Array.from(nuvem.db.visits, (v) => v.id).sort(), ['v1', 'v2', 'v3', 'vr']);
  });

  test('as ações da barra desligam-se sem nada marcado e voltam com uma marca', () => {
    const b = { disabled: false };
    nuvem.document.querySelectorAll = (s) => (s === '.sel-fundo [data-sel-l-precisa]' ? [b] : []);
    nuvem.CW.selL = { tipo: 'ten', ids: {} };
    nuvem.selLPintar();
    assert.equal(b.disabled, true);
    nuvem.CW.selL = { tipo: 'ten', ids: { t1: 1 } };
    nuvem.selLPintar();
    assert.equal(b.disabled, false);
  });

  test('as opções de um só continuam na folha do prefixo (o lpMenu): lpPessoa e lpVisita ficam registados', () => {
    assert.equal(nuvem.lpDe('per'), nuvem.lpPessoa);
    assert.equal(nuvem.lpDe('vis'), nuvem.lpVisita);
    assert.doesNotMatch(nuvem.lpLongo.toString(), /lpMenu|lpPessoa|lpVisita/, 'o toque longo já não as abre');
  });

  test('a folha: a barra de duas linhas, a caixa nas linhas, a coluna da grelha no computador, o marcado pela cor da frente, só tokens', () => {
    const sec = css.slice(css.indexOf('/* ===== ajustes-v40-5: 1.3'), css.indexOf('/* ===== fim: ajustes-v40-5 1.3 ===== */'));
    assert.ok(sec.length > 200, 'a secção da folha existe');
    assert.match(sec, /\.sel-fundo\.sel-l-duas\{flex-wrap:wrap;row-gap:0\}/);
    assert.match(sec, /@media\(min-width:901px\)\{[\s\S]*?\.sel-fundo\.sel-l-duas \.sel-l-quebra\{display:none\}/, 'no ecrã largo numa linha só');
    assert.match(sec, /#view \.pes-linha>\[data-selbox\],#view \.vis-linha>\[data-selbox\]\{padding:0;margin-right:0\}/, 'com o #view, para ganhar à margem de todas as caixas');
    assert.match(sec, /body\.lst-sel \.linha\.pes-linha\{grid-template-columns:22px 40px /);
    assert.match(sec, /\.vis-linha\.sel-on-card\{background:var\(--accent-soft\);box-shadow:inset 3px 0 0 var\(--accent\)\}/);
    assert.doesNotMatch(sec, /#[0-9a-f]{3,6}\b|rgba?\(/i, 'cores só por tokens');
    assert.doesNotMatch(sec, /\d+m?s\b(?![^(]*\))/, 'tempos só por tokens');
    assert.doesNotMatch(sec, /:hover/, 'sem hover novo');
  });
});
