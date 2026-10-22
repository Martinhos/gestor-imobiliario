// Os grupos selecionam-se como as outras listas das Casas (cloud/selecao-listas.js,
// o tipo 'grp'): cada cartão — o privado (definicoes.js:cartaoDoGrupo) e o
// partilhado (cloud/grupos.js:cartaoDoGrupoPartilhado) — abre com um toque e
// tem o data-lp «grp:<id>»; o «Editar» e o «Abrir o grupo» saíram, e os botões
// que ficam lá dentro não sobem ao cartão e ficam inertes em seleção. O toque
// longo entra na seleção com o tocado marcado, o toque marca e desmarca, só se
// marcam grupos do tipo à vista e trocar o tipo sai da seleção. A barra tem só
// o Apagar: os privados apagam-se como o delGroup, com a frase do impacto e o
// Anular; os partilhados meus apagam-se no servidor, dos dos outros saio, sem
// perguntar outra vez; com os dois, a frase diz os dois e que os partilhados
// não se desfazem; um erro do servidor não trava os outros. O cabeçalho do
// separador perdeu os botões de criar, e o vazio guarda o seu.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarTudo, repor } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r/g, '');
const espera = () => new Promise((r) => setTimeout(r, 5));

/* O estado do servidor: a Minha (H1) e a Terceira (H3) são minhas, a Do Rui
   (H2) é dele; o G1 do Rui, o G2 «Família» meu (com um pedido para entrar), o
   privado GP com a Terceira e a Do Rui, o GR só com a Do Rui, e um grupo de
   proprietários GO; e um pedido meu para entrar no G7 do Tó. */
const ESTADO = () => ({
  me: { id: 'EU' },
  houses: [
    { id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU', 'RUI'], updatedAt: 1, data: { id: 'H1', name: 'Minha' } },
    { id: 'H2', ownerId: 'RUI', ownerName: 'Rui', mine: false, participants: ['RUI', 'EU'], updatedAt: 1, data: { id: 'H2', name: 'Do Rui' } },
    { id: 'H3', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], updatedAt: 1, data: { id: 'H3', name: 'Terceira' } },
  ],
  records: [],
  userRecords: [
    { kind: 'group', id: 'GP', updatedAt: 1, data: { id: 'GP', kind: 'prop', name: 'Privado', ids: ['H3', 'H2'] } },
    { kind: 'group', id: 'GR', updatedAt: 1, data: { id: 'GR', kind: 'prop', name: 'Só do Rui', ids: ['H2'] } },
    { kind: 'group', id: 'GO', updatedAt: 1, data: { id: 'GO', kind: 'owner', name: 'Família de donos', ids: ['EU'] } },
  ],
  profiles: [{ userId: 'RUI', name: 'Rui', data: null }],
  connections: [], roles: [], collaborators: [], invites: [], people: [],
  shareLink: null, shareRequests: { incoming: [], outgoing: [] },
  sharedGroupRequests: {
    incoming: [{ groupId: 'G2', groupName: 'Família', userId: 'ZE', name: 'Zé', createdAt: 1767225600000 }],
    outgoing: [{ groupId: 'G7', groupName: 'Casas de Faro', ownerName: 'Tó', createdAt: 1767225600000 }],
  },
  sharedGroups: [
    { id: 'G1', name: 'Casas do Porto', ownerId: 'RUI', ownerName: 'Rui', mine: false,
      members: [{ id: 'RUI', name: 'Rui' }, { id: 'EU', name: 'Eu' }],
      houses: [{ id: 'H2', name: 'Do Rui', ownerId: 'RUI' }, { id: 'H1', name: 'Minha', ownerId: 'EU' }], link: null, pedidos: [] },
    { id: 'G2', name: 'Família', ownerId: 'EU', ownerName: 'Eu', mine: true,
      members: [{ id: 'EU', name: 'Eu' }], houses: [{ id: 'H3', name: 'Terceira', ownerId: 'EU' }],
      link: { ativo: true, expiresAt: 4102444800000, uses: 1 }, pedidos: [] },
  ],
});

/* A app com o estado, a sessão e os espiões: esp.api as chamadas (esp.falha
   faz rejeitar as de um caminho), esp.toasts, esp.confirmados (aceites na
   hora), esp.desfazer o Anular do último apagar e esp.renders.
   Devolve: esp. */
function montar() {
  const esp = { api: [], toasts: [], confirmados: [], desfazer: null, renders: 0, falha: null };
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt' };
  const st = ESTADO();
  app.db = app.rebuildDb(st);
  app.CW.state = st;
  app.CW.selL = { tipo: null, ids: {} };
  app.grpTipo = 'prop';
  app.tab = 'groups';
  app.txProp = '';
  app.api = (method, p) => {
    esp.api.push(method + ' ' + p);
    return esp.falha && p.indexOf(esp.falha) > -1 ? Promise.reject(new Error('O servidor recusou')) : Promise.resolve({});
  };
  app.toast = (m) => { esp.toasts.push(m); };
  app.confirmModal = (t, txt, sim) => { esp.confirmados.push({ t, txt }); sim(); };
  app.comDesfazer = (m, restaurar) => { esp.toasts.push(m); esp.desfazer = restaurar; };
  app.render = () => { esp.renders++; };
  app.save = () => {}; app.buildNav = () => {}; app.closeAllModals = () => {};
  app.pullNow = () => Promise.resolve();
  return esp;
}

/* Um cartão falso, com o que o selLDecorar e o selLPintar lhe fazem: a
   .grp-cab onde entra a caixa e um botão de dentro com data-sel-inerte.
   Recebe: lp — o data-lp.
   Devolve: o cartão, com atr, cab (os filhos dela) e o botão de dentro à vista. */
function cartao(lp) {
  const atr = { 'data-lp': lp }, cls = new Set();
  const cab = { filhos: [], insertBefore(x) { this.filhos.unshift(x); }, firstChild: null };
  const dentro = { atr: {}, setAttribute(k, v) { this.atr[k] = String(v); } };
  return { atr, cls, cab, dentro, getAttribute: (k) => (k in atr ? atr[k] : null), setAttribute: (k, v) => { atr[k] = String(v); },
    querySelector: (s) => (s === '.grp-cab' ? cab : s === '.selbox' || s === '[data-selbox]' ? cab.filhos[0] || null : null),
    querySelectorAll: (s) => (s === '[data-sel-inerte]' ? [dentro] : []),
    insertBefore() { throw new Error('a caixa vai para a .grp-cab, não para o cartão'); }, firstChild: null,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, v) => (v ? cls.add(c) : cls.delete(c)) } };
}

describe('os cartões dos grupos', () => {
  beforeEach(() => { montar(); });

  test('o cartão privado tem o data-lp e abre a edição ao toque; sem «Editar», e o «Partilhar» não sobe ao cartão', () => {
    const h = app.cartaoDoGrupo(app.grp('GP'));
    assert.match(h, /^<section class="card grp-cartao" data-lp="grp:GP" data-toca="camada" data-click="groupModal\('prop','GP'\)">/);
    assert.ok(!h.includes('Editar'), 'o «Editar» saiu');
    assert.match(h, /<div class="grp-acoes" data-sel-inerte><button type="button" class="btn sm" data-toca="camada" data-click="event\.stopPropagation\(\);CW\.grupoPartilhar\('GP'\)">/);
    const o = app.cartaoDoGrupo(app.grp('GO'));
    assert.match(o, /data-lp="grp:GO" data-toca="camada" data-click="groupModal\('owner','GO'\)"/, 'os de proprietários também');
    assert.ok(!o.includes('grp-acoes'), 'sem botões, sem a linha deles');
  });

  test('o cartão partilhado abre a janela do grupo ao toque; sem «Abrir o grupo», e os botões da ligação e dos pedidos não sobem ao cartão', () => {
    const meu = app.cartaoDoGrupoPartilhado(app.grp('G2'));
    assert.match(meu, /^<section class="card grp-cartao grp-partilhado" data-lp="grp:G2" data-toca="camada" data-click="CW\.grupoModal\('G2'\)">/);
    assert.ok(!meu.includes('Abrir o grupo'));
    for (const a of ['grupoLigacaoCopiar', 'grupoLigacaoRodar', 'grupoLigacaoDesativar', 'grupoAceitarPedido', 'grupoRecusarPedido']) {
      assert.match(meu, new RegExp('data-click="event\\.stopPropagation\\(\\);CW\\.' + a + '\\('), a);
    }
    assert.equal((meu.match(/class="grp-acoes" data-sel-inerte/g) || []).length, 2, 'a linha do pedido e a da ligação');
    const dele = app.cartaoDoGrupoPartilhado(app.grp('G1'));
    assert.match(dele, /data-lp="grp:G1" data-toca="camada" data-click="CW\.grupoModal\('G1'\)"/);
    assert.ok(!dele.includes('Abrir o grupo'));
    // os pedidos que fiz para entrar não são grupos: sem data-lp, não se marcam
    assert.ok(!app.pedidosQueFizHtml().includes('data-lp'));
  });

  test('o cabeçalho do separador é só o segmentado, e o vazio de cada tipo guarda o seu botão', () => {
    const h = app.vGrupos();
    assert.match(h, /<div class="def-cab grp-cab-tipos"><div class="segm def-abas" role="group" aria-label="Tipo de grupo">[\s\S]*?<\/div><\/div>/);
    assert.ok(!/Novo grupo partilhado|Novo grupo de imóveis|CW\.grupoNovo\(\)|def-cab-acoes/.test(h));
    app.grpTipo = 'contract';
    const v = app.vGrupos();
    assert.match(v, /<div class="empty"><b>Ainda não há grupos de contratos<\/b>[\s\S]*?data-click="groupModal\('contract'\)">[\s\S]*?Novo grupo de contratos/);
    assert.equal((v.match(/Novo grupo de contratos/g) || []).length, 1);
  });
});

describe('selecionar grupos', () => {
  let esp;
  beforeEach(() => { esp = montar(); });

  test('o data-lp «grp:<id>» é do tipo \'grp\', que vive no separador Grupos e conta «grupo» e «grupos»', () => {
    assert.deepEqual({ ...app.selLDoLp('grp:GP') }, { tipo: 'grp', id: 'GP' });
    assert.equal(app.selLDoLp('grp:'), null);
    assert.equal(app.TABS_SEL.grp, 'groups');
    const p = app.selLPalavras('grp');
    assert.deepEqual([p.um, p.varios, p.nenhum, p.sel], ['grupo', 'grupos', 'nenhum grupo', 'selecionado']);
  });

  test('o toque longo num grupo entra na seleção com ele marcado; noutro separador não faz nada', () => {
    app.lpLongo('grp:GP');
    assert.equal(app.CW.selL.tipo, 'grp');
    assert.deepEqual(Object.keys(app.CW.selL.ids), ['GP']);
    app.CW.selLSair();
    app.tab = 'properties';
    app.lpLongo('grp:GP');
    assert.equal(app.CW.selL.tipo, null);
  });

  test('em seleção o toque marca e desmarca, privados e partilhados juntos, e o toque longo também', () => {
    app.lpLongo('grp:GP');
    app.CW.selLTocar('grp', 'G1');
    app.lpLongo('grp:G2');
    assert.deepEqual(Object.keys(app.CW.selL.ids).sort(), ['G1', 'G2', 'GP']);
    app.CW.selLToggle('GP');
    app.lpLongo('grp:G1');
    assert.deepEqual(Object.keys(app.CW.selL.ids), ['G2']);
  });

  test('só se marcam grupos do tipo à vista', () => {
    assert.equal(app.selLRecusa('grp', 'GP'), '');
    assert.match(app.selLRecusa('grp', 'GO'), /de outro tipo/);
    app.lpLongo('grp:GO');
    assert.deepEqual(Object.keys(app.CW.selL.ids), [], 'entra sem o marcar');
    assert.match(esp.toasts.at(-1), /de outro tipo/);
    app.grpTipo = 'owner';
    app.CW.selLToggle('GO');
    assert.deepEqual(Object.keys(app.CW.selL.ids), ['GO'], 'com os de proprietários à vista, marca');
  });

  test('trocar o tipo à vista sai da seleção; fora dela, só repinta', () => {
    app.lpLongo('grp:GP');
    app.grupoTipoEscolher('owner');
    assert.equal(app.CW.selL.tipo, null);
    assert.deepEqual(Object.keys(app.CW.selL.ids), []);
    assert.equal(app.grpTipo, 'owner');
    const antes = esp.renders;
    app.grupoTipoEscolher('contract');
    assert.equal(esp.renders, antes + 1);
    assert.equal(app.grpTipo, 'contract');
  });

  test('em seleção a caixa entra no canto do cartão (a .grp-cab), o toque passa a marcar e os botões de dentro ficam inertes; a barra é × Cancelar, a contagem e Apagar', () => {
    const c = cartao('grp:GP'), d = cartao('grp:G1');
    app.document.querySelectorAll = (s) => (s === '#view [data-lp^="grp:"]' ? [c, d] : []);
    app.CW.selL = { tipo: 'grp', ids: { GP: 1 } };
    app.selLDecorar();
    assert.equal(c.cab.filhos.length, 1, 'a caixa');
    assert.equal(c.atr['data-click'], "CW.selLToggle('GP')");
    assert.equal(c.atr['aria-pressed'], 'true');
    assert.equal(d.atr['aria-pressed'], 'false');
    assert.ok(c.cls.has('sel-on-card') && !d.cls.has('sel-on-card'));
    assert.equal(c.dentro.atr.inert, '', 'o Partilhar fica fora do toque e do teclado');
    const b = app.selLBarraHtml('grp');
    assert.match(b, /CW\.selLSair\(\)">[\s\S]*? Cancelar<\/button><b id="selLConta" class="u-fx-1 u-ta-center"><\/b><button type="button" class="btn danger"[^>]*data-click="CW\.selLApagar\(\)">[\s\S]*? Apagar<\/button>$/);
  });
});

describe('apagar os grupos marcados', () => {
  let esp;
  beforeEach(() => {
    esp = montar();
    // um movimento antigo do GP, ainda por partir, e um partido pelos imóveis dele
    app.db.transactions.push(Object.assign(app.normTx({ kind: 'expense', label: 'Antigo', amount: 100, date: '2026-01-02' }), { id: 'T1', groupId: 'GP', propertyId: null, psplit: { H3: 50, H2: 50 } }));
    for (const [id, h] of [['T2', 'H3'], ['T3', 'H2']]) {
      app.db.transactions.push(Object.assign(app.normTx({ kind: 'expense', label: 'Partido', amount: 50, date: '2026-01-03', propertyId: h }), { id, lote: { id: 'L1', n: 2, total: -100, alvo: 'g:GP', modo: 'igual' } }));
    }
  });

  test('os privados: uma confirmação com o impacto, apagam-se como o delGroup, o filtro limpa-se e o Anular repõe tudo', () => {
    app.txProp = 'g:GP';
    app.CW.selL = { tipo: 'grp', ids: { GP: 1, GR: 1 } };
    app.CW.selLApagar();
    assert.equal(esp.confirmados.length, 1);
    const q = esp.confirmados[0];
    assert.equal(q.t, 'Apagar 2 grupos');
    assert.match(q.txt, /^Os 2 grupos saem da lista; os imóveis ficam como estão\./);
    assert.match(q.txt, /O movimento já registado nestes grupos fica em cada imóvel, como está\./);
    assert.match(q.txt, /Um movimento antigo, ainda por dividir pelos imóveis, fica sem grupo: passa a «Sem imóvel» e conta só nos totais\./);
    assert.ok(!/desfaz/.test(q.txt), 'só privados: há Anular, não se avisa');
    assert.deepEqual(esp.api, [], 'nada vai ao servidor');
    assert.ok(!app.db.groups.some((g) => g.id === 'GP' || g.id === 'GR'));
    const t1 = app.db.transactions.find((t) => t.id === 'T1');
    assert.equal(t1.groupId, null);
    assert.equal(app.txProp, '', 'o filtro que apontava para ele limpa-se');
    assert.equal(app.CW.selL.tipo, null, 'sai da seleção');
    return espera().then(() => {
      assert.equal(esp.toasts.at(-1), '2 grupos apagados.');
      esp.desfazer();
      assert.deepEqual(app.db.groups.filter((g) => g.id === 'GP' || g.id === 'GR').map((g) => g.id).sort(), ['GP', 'GR']);
      assert.equal(app.db.transactions.find((t) => t.id === 'T1').groupId, 'GP', 'o movimento antigo volta ao grupo');
      assert.deepEqual({ ...app.db.transactions.find((t) => t.id === 'T1').psplit }, { H3: 50, H2: 50 });
    });
  });

  test('um partilhado meu apaga-se no servidor, sem a confirmação dele outra vez, e sai da base', async () => {
    app.CW.selL = { tipo: 'grp', ids: { G2: 1 } };
    app.CW.selLApagar();
    await espera();
    assert.equal(esp.confirmados.length, 1, 'uma confirmação só');
    assert.equal(esp.confirmados[0].t, 'Apagar 1 grupo');
    assert.match(esp.confirmados[0].txt, /O partilhado teu «Família» desaparece para todos os membros/);
    assert.match(esp.confirmados[0].txt, /Não se desfaz\.$/);
    assert.deepEqual(esp.api, ['DELETE /api/shared-groups/G2']);
    assert.ok(!app.db.groups.some((g) => g.id === 'G2'));
    assert.equal(esp.toasts.at(-1), '1 grupo apagado.');
    assert.equal(esp.desfazer, null, 'sem Anular');
  });

  test('num partilhado de outra pessoa, sai dele', async () => {
    app.CW.selL = { tipo: 'grp', ids: { G1: 1 } };
    app.CW.selLApagar();
    await espera();
    assert.equal(esp.confirmados[0].t, 'Sair de 1 grupo');
    assert.match(esp.confirmados[0].txt, /^Sais de «Casas do Porto», de Rui: deixas de ver os imóveis dele, e os que lá adicionaste são removidos\./);
    assert.deepEqual(esp.api, ['DELETE /api/shared-groups/G1/members/EU']);
    assert.ok(!app.db.groups.some((g) => g.id === 'G1'));
    assert.equal(esp.toasts.at(-1), 'Saíste de 1 grupo.');
  });

  test('misto: a frase diz as duas coisas e que os partilhados não se desfazem; um erro do servidor não trava os outros e diz-se; o Anular só repõe o privado', async () => {
    esp.falha = '/G1/';
    app.CW.selL = { tipo: 'grp', ids: { GP: 1, G2: 1, G1: 1 } };
    app.CW.selLApagar();
    await espera();
    const q = esp.confirmados[0];
    assert.equal(esp.confirmados.length, 1);
    assert.equal(q.t, 'Apagar 2 grupos e sair de 1');
    assert.match(q.txt, /O grupo privado «Privado» sai da lista/);
    assert.match(q.txt, /O partilhado teu «Família» desaparece/);
    assert.match(q.txt, /Sais de «Casas do Porto»/);
    assert.match(q.txt, /O Anular só repõe o privado: os partilhados não se desfazem\.$/);
    assert.deepEqual(esp.api.slice().sort(), ['DELETE /api/shared-groups/G1/members/EU', 'DELETE /api/shared-groups/G2']);
    assert.ok(!app.db.groups.some((g) => g.id === 'GP' || g.id === 'G2'), 'o privado e o meu saíram');
    assert.ok(app.db.groups.some((g) => g.id === 'G1'), 'o que falhou fica');
    assert.equal(esp.toasts.at(-1), '2 grupos apagados. «Casas do Porto» ficou como estava: O servidor recusou.');
    esp.desfazer();
    assert.ok(app.db.groups.some((g) => g.id === 'GP'), 'o Anular repõe o privado');
    assert.ok(!app.db.groups.some((g) => g.id === 'G2'), 'e não o partilhado');
  });
});

describe('os estilos', () => {
  test('o cartão marcado distingue-se pela frente (o contorno e o nome), o realce só com rato, e os botões inertes veem-se apagados', () => {
    const bloco = css.slice(css.indexOf('/* === grupos selecionáveis (folha 1.1) === */'), css.indexOf('/* === fim: grupos selecionáveis (folha 1.1) === */'));
    assert.match(bloco, /#view \.grp-cartao\.sel-on-card\{box-shadow:0 0 0 2px var\(--accent\)\}/);
    assert.match(bloco, /#view \.grp-cartao\.sel-on-card h3\{color:var\(--accent-text\)\}/);
    assert.match(bloco, /@media\(hover:hover\) and \(pointer:fine\)\{#view \.grp-cartao\[data-click\]:hover\{/);
    assert.match(bloco, /#view \.grp-cartao \[inert\]\{opacity:\.45\}/);
    assert.ok(!/#[0-9a-f]{3,6}\b|rgb\(/i.test(bloco), 'só tokens');
  });
});
