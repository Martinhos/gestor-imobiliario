// As listas dos Imóveis, dos Inquilinos, das Visitas e dos Contratos dividem-se
// pela origem de cada registo: os meus, os partilhados comigo e aqueles em que
// colaboro, por esta ordem, cada secção com o título e quantos tem — sempre,
// mesmo sendo a única («Os meus imóveis» a quem só tem casas suas). Uma secção
// vazia não aparece, e sem registos nenhuns fica o vazio de sempre, sem
// títulos. A secção única guarda os ids de sempre das listas vivas. As
// Visitas guardam as Próximas e as Passadas dentro de cada secção, um nível
// abaixo; os Contratos guardam os grupos por imóvel e a tabela do computador.
// O filtro «Origem» é um chip com quantos cabem em cada escolha, só existe com
// duas origens e, ligado, deixa só essa secção, com o título dela.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
const ANO = new Date().getFullYear();

/* Três imóveis, um de cada origem — o meu (P1), um que o Bruno partilha
   comigo (P2) e um da Carla onde tenho um cargo (P3) —, e em cada um um
   contrato, um inquilino e visitas; mais um inquilino sem casa nenhuma.
   Recebe: a — o proxy da app; so (opcional) — true para deixar só o P1 e o
   que é dele.
   Devolve: nada — enche o db e limpa os filtros. */
function semear(a, so) {
  const db = limpar(a);
  for (const k of Object.keys(a.listF)) delete a.listF[k];
  const hoje = a.pzHoje();
  db.properties.push(a.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', rentalMode: 'inteiro', value: 200000 }));
  db.tenants.push(a.normPerson({ id: 't1', name: 'Rui Meu' }), a.normPerson({ id: 't4', name: 'Zé Sem Casa' }));
  db.contracts.push(a.normContract({ id: 'c1', propertyId: 'P1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.visits.push(a.normVisit({ id: 'v1', nomes: 'Ana Futura', propertyId: 'P1', date: '2999-01-01', start: '10:00' }));
  db.visits.push(a.normVisit({ id: 'v1b', nomes: 'Bia Passada', propertyId: 'P1', date: '2001-01-01', start: '10:00' }));
  if (so) return;
  db.properties.push(Object.assign(a.normProp({ id: 'P2', name: 'Casa do Bruno', use: 'investimento', rentalMode: 'inteiro', value: 150000 }),
    { _ownerUserId: 'bruno', _sharedFrom: 'Bruno' }));
  db.properties.push(Object.assign(a.normProp({ id: 'P3', name: 'Casa da Carla', use: 'investimento', rentalMode: 'inteiro', value: 120000 }),
    { _ownerUserId: 'carla', _sharedFrom: 'Carla', _cargo: 'Gestor' }));
  db.tenants.push(a.normPerson({ id: 't2', name: 'Sara Partilhada', houseId: 'P2' }), a.normPerson({ id: 't3', name: 'Tó Colaborado' }));
  db.contracts.push(a.normContract({ id: 'c2', propertyId: 'P2', tenantIds: ['t2'], rent: 700, start: (ANO - 1) + '-01-01', active: true }));
  db.contracts.push(a.normContract({ id: 'c3', propertyId: 'P3', tenantIds: ['t3'], rent: 600, start: (ANO + 2) + '-01-01', active: true }));
  db.visits.push(a.normVisit({ id: 'v2', nomes: 'Carlos Partilhado', propertyId: 'P2', date: hoje, start: '23:59' }));
  db.visits.push(a.normVisit({ id: 'v3', nomes: 'Dina Colaborada', propertyId: 'P3', date: '2001-02-01', start: '09:00' }));
}

// as posições de três textos num HTML, pela ordem
const posicoes = (h, xs) => xs.map((x) => h.indexOf(x));
const crescente = (ps) => ps.every((p, i) => p > -1 && (i === 0 || p > ps[i - 1]));
// o título de uma secção, com quantos tem
const titulo = (lista, o, txt, n) => new RegExp('<section class="org-seccao" aria-labelledby="org_' + lista + '_' + o + '"><div class="org-cab"><h2 class="org-tit" id="org_' + lista + '_' + o + '">' + txt + '</h2><span class="small num org-n">' + n + '</span></div>');

describe('a origem de cada registo', () => {
  beforeEach(() => semear(app));

  test('um imóvel: meu sem dono de fora, partilhado com dono e sem cargo, em que colaboro com cargo; sem imóvel ou desconhecido, meu', () => {
    assert.equal(app.origemDaCasa('P1'), 'meu');
    assert.equal(app.origemDaCasa('P2'), 'partilhado');
    assert.equal(app.origemDaCasa('P3'), 'colaboro');
    assert.equal(app.origemDaCasa(''), 'meu');
    assert.equal(app.origemDaCasa(null), 'meu');
    assert.equal(app.origemDaCasa('NAO-HA'), 'meu');
    // um imóvel meu que partilho com outros continua meu: o servidor não lhe põe _ownerUserId
    app.db.properties[0]._colaboradores = [{ id: 'x', nome: 'Alguém' }];
    assert.equal(app.origemDaCasa('P1'), 'meu');
  });

  test('um inquilino segue a casa dele: a da ficha, ou a do primeiro contrato; sem casa, meu', () => {
    const t = (id) => app.db.tenants.find((x) => x.id === id);
    assert.equal(app.origemDoInquilino(t('t1')), 'meu', 'pelo contrato no P1');
    assert.equal(app.origemDoInquilino(t('t2')), 'partilhado', 'pelo houseId da ficha');
    assert.equal(app.origemDoInquilino(t('t3')), 'colaboro', 'pelo contrato no P3');
    assert.equal(app.origemDoInquilino(t('t4')), 'meu', 'sem casa nem contrato');
  });

  test('uma visita e um contrato seguem o imóvel deles (propertyId)', () => {
    const h = app.vVisits(), c = app.vContracts();
    const secao = (html, lista, o) => html.split('aria-labelledby="org_' + lista + '_').find((x) => x.startsWith(o + '"')) || '';
    assert.match(secao(h, 'visitas', 'meu'), /data-lp="vis:v1"/);
    assert.match(secao(h, 'visitas', 'partilhado'), /data-lp="vis:v2"/);
    assert.doesNotMatch(secao(h, 'visitas', 'partilhado'), /data-lp="vis:v3"/);
    assert.match(secao(h, 'visitas', 'colaboro'), /data-lp="vis:v3"/);
    assert.match(secao(c, 'contratos', 'meu'), /data-lp="ct:c1"/);
    assert.match(secao(c, 'contratos', 'partilhado'), /data-lp="ct:c2"/);
    assert.match(secao(c, 'contratos', 'colaboro'), /data-lp="ct:c3"/);
  });
});

describe('o ajudante das secções (vistas.js:listaPorOrigem)', () => {
  test('secções vazias não aparecem; com uma só, o título está lá e o pintor recebe tudo sem sufixo', () => {
    const chamadas = [];
    const pintar = (xs, suf, so) => { chamadas.push([xs.join(','), suf, so]); return '<i>' + xs.join(',') + '</i>'; };
    const T = { meu: 'Meus', partilhado: 'Deles', colaboro: 'Ajudo' };
    const so = app.listaPorOrigem('x', ['a', 'b'], () => 'colaboro', T, pintar);
    assert.equal(so, '<div class="org-seccoes">'
      + '<section class="org-seccao" aria-labelledby="org_x_colaboro"><div class="org-cab"><h2 class="org-tit" id="org_x_colaboro">Ajudo</h2><span class="small num org-n">2</span></div>'
      + '<i>a,b</i></section></div>', 'a secção única com o título e quantos tem, e o HTML do pintor por baixo');
    assert.deepEqual(JSON.parse(JSON.stringify(chamadas)), [['a,b', '', false]], 'sem sufixo (os ids de sempre), e com título');
    chamadas.length = 0;
    const duas = app.listaPorOrigem('x', ['a', 'b', 'c'], (x) => (x === 'b' ? 'meu' : 'colaboro'), T, pintar);
    assert.match(duas, /^<div class="org-seccoes">/);
    assert.doesNotMatch(duas, /Deles/, 'a secção vazia não aparece');
    assert.ok(crescente(posicoes(duas, ['>Meus<', '<i>b</i>', '>Ajudo<', '<i>a,c</i>'])), 'a ordem: os meus, depois em que colaboro');
    assert.deepEqual(JSON.parse(JSON.stringify(chamadas)), [['b', ':meu', false], ['a,c', ':colaboro', false]]);
    chamadas.length = 0;
    assert.equal(app.listaPorOrigem('x', [], () => 'meu', T, pintar), '<i></i>', 'sem nada, o pintor diz o que diz, sem título');
    assert.deepEqual(JSON.parse(JSON.stringify(chamadas)), [['', '', true]]);
  });

  test('uma origem que não se conhece conta nos meus, e o título é o deles', () => {
    const T = { meu: 'Meus', partilhado: 'Deles', colaboro: 'Ajudo' };
    const h = app.listaPorOrigem('x', ['a'], () => 'outra', T, (xs) => '<i>' + xs.join(',') + '</i>');
    assert.match(h, /<h2 class="org-tit" id="org_x_meu">Meus<\/h2><span class="small num org-n">1<\/span><\/div><i>a<\/i>/);
  });
});

describe('as quatro listas com as três origens', () => {
  beforeEach(() => semear(app));

  test('Imóveis: «Os meus imóveis», «Partilhados comigo», «Em que colaboro», pela ordem, com quantos tem cada uma e uma lista viva cada', () => {
    const h = app.vProperties();
    assert.match(h, titulo('imoveis', 'meu', 'Os meus imóveis', 1));
    assert.match(h, titulo('imoveis', 'partilhado', 'Partilhados comigo', 1));
    assert.match(h, titulo('imoveis', 'colaboro', 'Em que colaboro', 1));
    assert.ok(crescente(posicoes(h, ['id="org_imoveis_meu"', 'data-lp="prop:P1"', 'id="org_imoveis_partilhado"', 'data-lp="prop:P2"', 'id="org_imoveis_colaboro"', 'data-lp="prop:P3"'])));
    for (const o of ['meu', 'partilhado', 'colaboro']) assert.match(h, new RegExp('<div class="list imv-lista" data-listaviva="imoveis:' + o + '">'));
    assert.doesNotMatch(h, /data-listaviva="imoveis"/);
  });

  test('Inquilinos: o sem casa fica nos meus, ao lado do do meu imóvel', () => {
    const h = app.vTenants();
    assert.match(h, titulo('inquilinos', 'meu', 'Os meus inquilinos', 2));
    assert.match(h, titulo('inquilinos', 'partilhado', 'Partilhados comigo', 1));
    assert.match(h, titulo('inquilinos', 'colaboro', 'Em que colaboro', 1));
    assert.ok(crescente(posicoes(h, ['id="org_inquilinos_meu"', 'data-lp="per:tenant:t4"', 'id="org_inquilinos_partilhado"', 'data-lp="per:tenant:t2"', 'id="org_inquilinos_colaboro"', 'data-lp="per:tenant:t3"'])));
    assert.match(h, /<div class="list pes-lista" data-listaviva="inquilinos:partilhado">/);
  });

  test('Visitas: «As minhas visitas», «Partilhadas comigo», «Em que colaboro», cada uma com as Próximas e as Passadas dentro, um nível abaixo', () => {
    const h = app.vVisits();
    assert.match(h, titulo('visitas', 'meu', 'As minhas visitas', 2));
    assert.match(h, titulo('visitas', 'partilhado', 'Partilhadas comigo', 1));
    assert.match(h, titulo('visitas', 'colaboro', 'Em que colaboro', 1));
    assert.doesNotMatch(h, /<h2>Próximas<\/h2>/, 'dentro de uma secção o grupo não é um h2');
    const meu = h.slice(h.indexOf('org_visitas_meu'), h.indexOf('org_visitas_partilhado'));
    assert.match(meu, /<div class="vis-grupos"><section class="vis-grupo"><div class="vis-grupo-cab"><h3>Próximas<\/h3><span class="small num">1<\/span><\/div><div class="list vis-lista" data-listaviva="visitas:meu:Próximas">/);
    assert.match(meu, /<h3>Passadas<\/h3><span class="small num">1<\/span><\/div><div class="list vis-lista" data-listaviva="visitas:meu:Passadas">/);
    assert.ok(crescente(posicoes(meu, ['vis:v1"', 'vis:v1b"'])), 'as próximas antes das passadas');
    const colab = h.slice(h.indexOf('org_visitas_colaboro'));
    assert.doesNotMatch(colab, /Próximas/, 'um grupo vazio dentro da secção não aparece');
    assert.match(colab, /<h3>Passadas<\/h3>[\s\S]*vis:v3"/);
  });

  test('Contratos: três secções, cada uma com a tabela, o cabeçalho das colunas e os grupos por imóvel dentro', () => {
    const h = app.vContracts();
    assert.match(h, titulo('contratos', 'meu', 'Os meus contratos', 1));
    assert.match(h, titulo('contratos', 'partilhado', 'Partilhados comigo', 1));
    assert.match(h, titulo('contratos', 'colaboro', 'Em que colaboro', 1));
    assert.equal((h.match(/<div class="ct-tabela"><div class="ct-cab" aria-hidden="true">/g) || []).length, 3, 'uma tabela com o seu cabeçalho por secção');
    for (const [o, p] of [['meu', 'P1'], ['partilhado', 'P2'], ['colaboro', 'P3']]) {
      assert.match(h, new RegExp('<div class="list ct-lista" data-listaviva="contratos:' + o + '"><section data-chave="imovel:' + p + '" class="ct-grupo">'));
      assert.match(h, new RegExp('data-listaviva="cts:' + p + '"'));
    }
    assert.ok(crescente(posicoes(h, ['id="org_contratos_meu"', '>T2 Lisboa</h3>', 'id="org_contratos_partilhado"', '>Casa do Bruno</h3>', 'id="org_contratos_colaboro"', '>Casa da Carla</h3>'])));
    // dois imóveis meus ficam os dois na mesma secção, cada um com o seu grupo
    app.db.properties.push(app.normProp({ id: 'P4', name: 'T1 Porto', use: 'investimento', rentalMode: 'inteiro' }));
    app.db.contracts.push(app.normContract({ id: 'c4', propertyId: 'P4', tenantIds: [], rent: 500, start: (ANO - 1) + '-01-01', active: true }));
    const h2 = app.vContracts();
    assert.match(h2, titulo('contratos', 'meu', 'Os meus contratos', 2));
    const meu = h2.slice(h2.indexOf('org_contratos_meu'), h2.indexOf('org_contratos_partilhado'));
    assert.ok(crescente(posicoes(meu, ['data-chave="imovel:P1"', 'data-chave="imovel:P4"'])));
  });
});

describe('com uma só origem, a secção tem o título à mesma', () => {
  beforeEach(() => semear(app, true));

  test('as quatro têm o título «Os meus …» com quantos tem, e nenhum dos outros nem o campo «Origem»', () => {
    const vs = [['vProperties', 'imoveis', 'Os meus imóveis', 1], ['vTenants', 'inquilinos', 'Os meus inquilinos', 2],
      ['vVisits', 'visitas', 'As minhas visitas', 2], ['vContracts', 'contratos', 'Os meus contratos', 1]];
    for (const [v, lista, txt, n] of vs) {
      const h = app[v]();
      assert.match(h, titulo(lista, 'meu', txt, n), v + ': o título e a contagem');
      assert.equal((h.match(/<section class="org-seccao"/g) || []).length, 1, v + ': uma secção só');
      assert.doesNotMatch(h, /Partilhad[oa]s comigo|Em que colaboro/, v + ': sem as outras');
      assert.doesNotMatch(h, /Origem/, v + ': sem o campo');
    }
  });

  test('as listas vivas guardam os ids de sempre, dentro da secção, e as visitas descem os grupos a h3', () => {
    const vs = { vProperties: 'data-listaviva="imoveis"', vTenants: 'data-listaviva="inquilinos"', vVisits: 'data-listaviva="visitas:Próximas"', vContracts: 'data-listaviva="contratos"' };
    for (const [v, id] of Object.entries(vs)) {
      const h = app[v]();
      assert.ok(h.includes(id), v + ': ' + id);
      assert.ok(h.indexOf('class="org-cab"') < h.indexOf(id), v + ': a lista por baixo do título');
      assert.doesNotMatch(h, /data-listaviva="[a-z]+:(meu|partilhado|colaboro)/, v + ': sem sufixo');
    }
    const vis = app.vVisits();
    assert.match(vis, /<div class="vis-grupos"><section class="vis-grupo"><div class="vis-grupo-cab"><h3>Próximas<\/h3>/, 'debaixo do h2 da secção, o grupo é um h3');
    assert.doesNotMatch(vis, /<h2>Próximas<\/h2>|<h2>Passadas<\/h2>/);
    assert.match(app.vContracts(), /<div class="org-cab">[\s\S]*<div class="ct-tabela"><div class="ct-cab"[\s\S]*<div class="list ct-lista" data-listaviva="contratos">/);
  });

  test('só colaboro (todos os imóveis com cargo): uma origem só, com o título «Em que colaboro»', () => {
    Object.assign(app.db.properties[0], { _ownerUserId: 'carla', _cargo: 'Gestor' });
    const h = app.vProperties();
    assert.match(h, titulo('imoveis', 'colaboro', 'Em que colaboro', 1));
    assert.doesNotMatch(h, /Os meus imóveis|Origem/);
    assert.match(h, /data-listaviva="imoveis"/);
  });

  test('sem registos nenhuns, o vazio de sempre e nenhum título', () => {
    const db = limpar(app);
    for (const k of Object.keys(app.listF)) delete app.listF[k];
    assert.match(app.vProperties(), /Sem imóveis/);
    assert.match(app.vTenants(), /Sem inquilinos/);
    assert.match(app.vVisits(), /Ainda não há visitas/);
    assert.match(app.vContracts(), /Cria primeiro um imóvel/);
    for (const v of ['vProperties', 'vTenants', 'vVisits', 'vContracts']) assert.doesNotMatch(app[v](), /org-seccao|org-tit/, v + ': sem título');
    // um imóvel sem contratos: os Contratos dizem o seu vazio, sem título
    db.properties.push(app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', rentalMode: 'inteiro' }));
    assert.match(app.vContracts(), /Sem contratos/);
    assert.doesNotMatch(app.vContracts(), /org-seccao|org-tit/);
  });

  test('uma pesquisa que não acha nada dá «Nada neste filtro», sem título', () => {
    for (const [v, k] of [['vProperties', 'lprops'], ['vTenants', 'lten'], ['vVisits', 'lvis'], ['vContracts', 'lcts']]) {
      app.lf(k).q = 'nada-assim';
      const h = app[v]();
      assert.match(h, /Nada neste filtro/, v);
      assert.doesNotMatch(h, /org-seccao|org-tit/, v + ': sem título');
    }
  });
});

describe('a secção vazia não aparece', () => {
  beforeEach(() => semear(app));

  test('sem nada partilhado comigo, ficam «Os meus …» e «Em que colaboro», e nenhum «Partilhados comigo»', () => {
    app.db.properties = app.db.properties.filter((p) => p.id !== 'P2');
    app.db.tenants = app.db.tenants.filter((t) => t.id !== 't2');
    app.db.contracts = app.db.contracts.filter((c) => c.propertyId !== 'P2');
    app.db.visits = app.db.visits.filter((x) => x.propertyId !== 'P2');
    for (const [v, lista] of [['vProperties', 'imoveis'], ['vTenants', 'inquilinos'], ['vVisits', 'visitas'], ['vContracts', 'contratos']]) {
      const h = app[v]();
      assert.equal((h.match(/<section class="org-seccao"/g) || []).length, 2, v + ': duas secções');
      assert.ok(crescente(posicoes(h, ['id="org_' + lista + '_meu"', 'id="org_' + lista + '_colaboro"'])), v + ': os meus, depois em que colaboro');
      assert.doesNotMatch(h, /org_[a-z]+_partilhado|Partilhad[oa]s comigo<\/h2>/, v + ': sem a secção vazia');
    }
  });

  test('uma pesquisa que deixa uma origem só fica com o título dela, e a lista viva volta ao id de sempre', () => {
    app.lf('lprops').q = 'Bruno';
    const h = app.vProperties();
    assert.match(h, titulo('imoveis', 'partilhado', 'Partilhados comigo', 1));
    assert.doesNotMatch(h, /org_imoveis_(meu|colaboro)/);
    assert.match(h, /data-listaviva="imoveis"/);
  });
});

describe('o filtro «Origem»', () => {
  beforeEach(() => semear(app));

  test('é um chip rápido em cada lista, com quantos cabem em cada escolha (o «Todos» sem número)', () => {
    for (const [v, k, todos, meus, part] of [['vProperties', 'lprops', 'Todos', 'Os meus', 'Partilhados comigo'], ['vTenants', 'lten', 'Todos', 'Os meus', 'Partilhados comigo'],
      ['vVisits', 'lvis', 'Todas', 'As minhas', 'Partilhadas comigo'], ['vContracts', 'lcts', 'Todos', 'Os meus', 'Partilhados comigo']]) {
      const h = app[v]();
      assert.match(h, new RegExp('<span class="mov-chip"><div class="sel" id="sel_lfc_' + k + '_or">[\\s\\S]*?<span id="lab_lfc_' + k + '_or">Origem</span>'), v + ': o chip');
      const c = app._lfCampos[k].or;
      assert.equal(c.rapido, true);
      assert.deepEqual(JSON.parse(JSON.stringify(app.lfOpcoes(c).map((x) => x.label))),
        [todos, meus + ' · ' + (k === 'lten' || k === 'lvis' ? 2 : 1), part + ' · 1', 'Em que colaboro · 1'], v);
    }
  });

  test('as contagens são as dos outros filtros: com o estado «Vago», a origem conta só os vagos; com a origem, o estado conta só os dela', () => {
    app.lf('lprops').st = 'vago';
    app.vProperties();
    const or = app.lfOpcoes(app._lfCampos.lprops.or).map((x) => x.label);
    assert.deepEqual(JSON.parse(JSON.stringify(or)), ['Todos', 'Os meus · 0', 'Partilhados comigo · 0', 'Em que colaboro · 1'], 'só o P3 (contrato por começar) está vago');
    app.lf('lprops').st = '';
    app.lf('lprops').or = 'partilhado';
    app.vProperties();
    const st = app._lfCampos.lprops.st.opcoes.find((x) => x.v === 'arrendado');
    assert.equal(st.n, 1, 'arrendados: só o P2');
    assert.equal(app._lfCampos.lprops.st.opcoes[0].n, 1, 'todos os estados: só o P2');
  });

  test('ligado, fica só essa secção, com o título dela; conta no funil e o «Limpar» tira-o', () => {
    for (const [v, k, id, lista, txt] of [['vProperties', 'lprops', 'imoveis', 'imoveis', 'Partilhados comigo'], ['vTenants', 'lten', 'inquilinos', 'inquilinos', 'Partilhados comigo'],
      ['vVisits', 'lvis', 'visitas:Próximas', 'visitas', 'Partilhadas comigo'], ['vContracts', 'lcts', 'contratos', 'contratos', 'Partilhados comigo']]) {
      app.lf(k).or = 'partilhado';
      const h = app[v]();
      assert.match(h, titulo(lista, 'partilhado', txt, 1), v + ': a secção com o título');
      assert.equal((h.match(/<section class="org-seccao"/g) || []).length, 1, v + ': uma secção só');
      assert.ok(h.includes('data-listaviva="' + id + '"'), v + ': a lista de sempre');
      assert.doesNotMatch(h, /data-lp="(prop:P1|prop:P3|per:tenant:t1|per:tenant:t3|vis:v1|vis:v3|ct:c1|ct:c3)"/, v + ': nada das outras origens');
      assert.match(h, /data-lp="(prop:P2|per:tenant:t2|vis:v2|ct:c2)"/, v + ': o partilhado');
      assert.match(h, new RegExp('<span class="mov-chip on"><div class="sel" id="sel_lfc_' + k + '_or">[\\s\\S]*?<span id="lab_lfc_' + k + '_or">' + (k === 'lvis' ? 'Partilhadas comigo' : 'Partilhados comigo') + '</span>'), v + ': o chip ligado diz a escolha');
      assert.equal(app.lfCount(k), 1, v + ': um filtro no funil');
      assert.match(h, /class="chip limpar[^"]*"[^>]*data-click="lfClear\('/, v + ': o «Limpar»');
    }
    app.render = () => {};
    app.lfClear('lprops');
    assert.equal(app.lf('lprops').or, undefined, 'o «Limpar» tira a origem');
  });

  test('some quando a lista tem só uma origem, e um filtro guardado de antes deixa de cortar (e de contar)', () => {
    semear(app, true);
    app.lf('lprops').or = 'colaboro';
    const h = app.vProperties();
    assert.doesNotMatch(h, /Origem/);
    assert.match(h, /data-lp="prop:P1"/, 'não corta');
    assert.equal(app.lfCount('lprops'), 0, 'não conta no funil');
    // uma origem que a lista deixou de ter também sai
    semear(app);
    app.db.properties = app.db.properties.filter((p) => p.id !== 'P3');
    app.lf('lprops').or = 'colaboro';
    assert.match(app.vProperties(), /data-lp="prop:P1"/);
    assert.equal(app.lf('lprops').or, undefined);
  });

  test('o filtro que esvazia a lista dá «Nada neste filtro»', () => {
    app.lf('lcts').or = 'colaboro';
    app.lf('lcts').st = 'on';   // o c3 do P3 ainda não começou
    assert.match(app.vContracts(), /Nada neste filtro/);
    app.lf('lvis').or = 'partilhado';
    app.lf('lvis').q = 'Dina';
    assert.match(app.vVisits(), /Nada neste filtro/);
  });

  test('nos contratos, «sem contrato em vigor» por baixo da lista respeita a origem', () => {
    app.lf('lcts').st = 'on';
    assert.match(app.vContracts(), /Casa da Carla não tem contrato em vigor/);
    app.lf('lcts').or = 'partilhado';
    assert.doesNotMatch(app.vContracts(), /não tem contrato em vigor/, 'a Casa da Carla é de outra origem');
  });
});
