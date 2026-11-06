// Uma hipoteca cria-se como os registos dos outros separadores: pela ação do
// ecrã — a «Hipoteca» à cabeça do + da barra de baixo, «neste ecrã», e o
// «Nova hipoteca» do cabeçalho do computador —, e não por um botão dentro da
// página. Com hipotecas na lista, nem o título «Ativas» nem o «Liquidadas»
// têm o botão ao lado; o vazio «Sem hipotecas» continua com o seu, só a quem
// pode editar a ficha de algum imóvel. E a apresentação dos Créditos ensina
// o caminho que fica: no telemóvel o +, no computador o cabeçalho, e a
// escolha do imóvel que os dois abrem.
// A app inteira, nuvem incluída (carregarTudo), com a sessão em CW.user.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar, repor } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
// os serviços desligados vivem no aparelho, e os filtros da lista ficam de teste para teste
afterEach(() => { app.definirServicosDesligados([]); app.CW.cargos = {}; semFiltros(); });

/* Os filtros da lista das hipotecas a zero (a pesquisa, o estado, o imóvel),
   sem pintar nada.
   Devolve: nada. */
function semFiltros() {
  const s = app.lf('lcred');
  for (const k of Object.keys(s)) delete s[k];
}

/* A app limpa, com sessão e o primeiro estado, sem cargos (sou dono do que
   houver) e um imóvel meu, com as hipotecas pedidas.
   Recebe: loans (opcional) — as hipotecas do imóvel ([{id, outstanding}]).
   Devolve: nada. */
function montar(loans = []) {
  limpar(app);
  app.definirServicosDesligados([]);
  app.CW.user = { id: 'EU', name: 'Maria Costa', email: 'eu@exemplo.pt' };
  app.CW._pulled = 1;
  app.CW.cargos = {};
  semFiltros();
  app.db.properties.push(app.normProp({ id: 'P1', name: 'T2 Lisboa',
    loans: loans.map((l) => app.normLoan({ id: l.id, name: 'Aquisição', outstanding: l.outstanding, years: 30, rate: 3 })) }));
}

/* Só colaboro num imóvel de outra conta, com estas permissões e as hipotecas pedidas.
   Recebe: perms — as permissões do cargo; loans (opcional) — as hipotecas do imóvel.
   Devolve: nada. */
function soColaboro(perms, loans = []) {
  montar();
  app.db.properties = [Object.assign(app.normProp({ id: 'P2', name: 'T1 Foz', ownerIds: ['OUTRO'],
    loans: loans.map((l) => app.normLoan({ id: l.id, name: 'Aquisição', outstanding: l.outstanding, years: 30, rate: 3 })) }),
  { _sharedFrom: 'Rita Lopes', _ownerUserId: 'OUTRO', _cargo: 'Contabilista' })];
  app.CW.cargos = { P2: { dono: false, perms, nome: 'Contabilista' } };
  assert.ok(app.souSoColaborador());
}

/* Faz de conta que o ecrã é o do computador (a partir dos 901 px).
   Devolve: nada. */
function noComputador() {
  app.matchMedia = (q) => ({ matches: /min-width:\s*901px/.test(q), addEventListener() {}, addListener() {} });
}

// a imagem da hipoteca nova na apresentação dos Créditos (ou undefined, quando não se mostra)
const imagemDaNova = () => app.aprImagensDe('credits').find((im) => im.titulo === 'Cada hipoteca vive num imóvel');
// o texto que se lê numa maquete, sem as marcas
const lido = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('a página dos Créditos', () => {
  test('com uma hipoteca ativa e um imóvel que posso editar, o «Ativas» fica sem o «Nova hipoteca»: criar é o + e o cabeçalho', () => {
    montar([{ id: 'L1', outstanding: 150000 }]);
    assert.equal(app.casasComo('house.edit').length, 1, 'posso criar uma hipoteca');
    const html = app.vCredits();
    assert.match(html, /<div class="plan-cab cred-cab"><h2>Ativas<\/h2><\/div>/, 'o título da coluna, sozinho');
    assert.ok(!html.includes('newMort()'), 'nenhum botão de criar uma hipoteca dentro da página');
    assert.doesNotMatch(html, /Nova hipoteca|plan-novo/);
    // o caminho que fica: a ação do ecrã, no + e no cabeçalho do computador
    const a = app.acaoNaturalDoEcra('credits');
    assert.equal(a && a.id, 'hipoteca');
    assert.equal(a.act, 'newMort()');
    assert.equal(app.ROTULO_ACAO.hipoteca, 'Nova hipoteca');
    assert.ok(app.acoesDeAdicionar().some((x) => x.id === 'hipoteca'), 'o «Criar» do + oferece a hipoteca');
  });

  test('só com liquidadas, o título «Liquidadas» também fica sem o botão', () => {
    montar([{ id: 'L1', outstanding: 0 }]);
    const html = app.vCredits();
    assert.match(html, /<div class="plan-cab cred-cab"><h2>Liquidadas<\/h2><\/div>/);
    assert.ok(!html.includes('newMort()'));
  });

  test('sem hipotecas, o vazio continua com o «Nova hipoteca»', () => {
    montar();
    const html = app.vCredits();
    assert.match(html, /Sem hipotecas/);
    assert.ok(html.includes('data-toca="camada" data-click="newMort()">Nova hipoteca</button>'), 'o botão do vazio');
    assert.equal((html.match(/newMort\(\)/g) || []).length, 1, 'e só esse');
  });

  test('quem só colabora sem «Editar a ficha» não tem o botão no vazio nem a hipoteca no +; com ela, tem os dois', () => {
    soColaboro(['loan.view', 'report.view', 'tx.view']);
    assert.match(app.vCredits(), /Sem hipotecas/);
    assert.ok(!app.vCredits().includes('newMort()'), 'o vazio sem botão');
    assert.equal(app.acaoNaturalDoEcra('credits'), null, 'nem a ação do ecrã');
    soColaboro(['loan.view', 'report.view', 'tx.view'], [{ id: 'L2', outstanding: 50000 }]);
    assert.ok(!app.vCredits().includes('newMort()'), 'com uma hipoteca do dono à vista, também nada');
    soColaboro(['loan.view', 'house.edit'], [{ id: 'L2', outstanding: 50000 }]);
    assert.ok(!app.vCredits().includes('newMort()'), 'a página continua sem o botão');
    assert.equal(app.acaoNaturalDoEcra('credits').id, 'hipoteca', 'e a ação do ecrã está lá');
  });
});

describe('a apresentação dos Créditos', () => {
  test('no telemóvel: o «Criar» do + com a «Hipoteca» à cabeça, «neste ecrã», e a escolha do imóvel à frente', () => {
    montar([{ id: 'L1', outstanding: 150000 }]);
    const im = imagemDaNova();
    assert.ok(im, 'a imagem está lá a quem pode criar');
    const v = lido(im.html);
    assert.doesNotMatch(v, /Ativas/, 'sem o título «Ativas» com o botão que saiu');
    assert.match(im.html, /<span class="apr-c-criar-aqui apr-alvo">[\s\S]*?<b>Hipoteca<\/b><span class="apr-c-neste">neste ecrã<\/span>/);
    assert.match(im.html, /<div class="apr-par"><div class="apr-atras"><div class="apr-m-folha apr-c-criar">/, 'o «Criar» atrás, numa folha');
    assert.match(im.html, /<div class="apr-frente"><div class="apr-m-folha apr-flutua"><div class="apr-m-folha-cab"><b>Hipoteca de que imóvel\?<\/b>/, 'a escolha à frente');
    assert.match(im.texto, /^No <b>\+<\/b> da barra de baixo, <b>Hipoteca<\/b> vem à cabeça e pergunta primeiro o imóvel/);
    assert.doesNotMatch(im.texto, /Nova hipoteca/, 'o botão do cabeçalho é do computador');
  });

  test('no computador: o «Nova hipoteca» do cabeçalho, sem o «Selecionar vários», e por baixo a escolha do imóvel', () => {
    montar([{ id: 'L1', outstanding: 150000 }]);
    noComputador();
    const im = imagemDaNova();
    assert.match(im.html, /apr-c-cabeca-larga/);
    assert.match(lido(im.html), /Créditos .*Nova hipoteca .*Hipoteca de que imóvel\?/);
    assert.doesNotMatch(im.html, /apr-c-cabeca-ic/, 'os Créditos não têm o «Selecionar vários»');
    assert.doesNotMatch(im.html, /neste ecrã|Ativas/);
    assert.match(im.texto, /^<b>Nova hipoteca<\/b>, no cabeçalho, pergunta primeiro o imóvel/);
  });

  test('sem imóvel nenhum, nem o + nem o cabeçalho têm a hipoteca: o texto manda criar primeiro o imóvel', () => {
    montar();
    app.db.properties = [];
    assert.equal(app.acaoNaturalDoEcra('credits'), null, 'a ação do ecrã ainda não existe');
    const tel = imagemDaNova();
    assert.ok(tel, 'quem é dono vê a imagem');
    assert.match(tel.texto, /^Uma hipoteca fica na ficha de um imóvel: cria primeiro o imóvel, em <b>Casas → Imóveis<\/b>, e a <b>Hipoteca<\/b> passa a estar no <b>\+<\/b>\.$/);
    noComputador();
    assert.match(imagemDaNova().texto, /e o <b>Nova hipoteca<\/b> passa a estar no cabeçalho\.$/);
  });

  test('a prestação lembrada só com os Planeados ligados; quem não pode editar imóvel nenhum não vê a imagem', () => {
    montar();
    assert.match(imagemDaNova().texto, /lembrada nos <b>Planeados<\/b>/);
    app.definirServicosDesligados(['recurring']);
    assert.doesNotMatch(imagemDaNova().texto, /Planeados/);
    soColaboro(['loan.view', 'report.view']);
    assert.equal(imagemDaNova(), undefined);
  });
});
