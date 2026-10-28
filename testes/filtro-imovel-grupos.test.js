// O filtro «Imóvel» das listas dos Contratos, dos Planeados e dos Créditos
// tem as opções dos Movimentos: «Todos os imóveis», os imóveis um a um, uma
// linha e os grupos de imóveis (componentes.js:imoveisEGruposOpts, valor
// 'g:ID', rótulo «Grupo · Nome»). Só entram os grupos com coisas nessa lista:
// um grupo sem contratos não aparece nos Contratos. Escolher um grupo filtra
// pelos imóveis dele — as linhas, as contagens do estado e o rodapé dos
// imóveis sem contrato em vigor.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, igual } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));
const ANO = new Date().getFullYear();

/* Quatro imóveis de arrendamento: o T1 com um contrato, uma hipoteca e um
   planeado; o T2 com um contrato, uma hipoteca e um modelo; o T3 e o T4 sem
   nada. Os grupos: Centro (T1, T2, T4), Norte (T3, sem nada), Planos (T3, com
   um planeado do próprio grupo) e Sul (T2); e um grupo de contratos, que é
   outro filtro e não entra no do imóvel.
   Recebe: a — o proxy da app.
   Devolve: nada — enche o db. */
function semear(a) {
  const db = limpar(a);
  for (const k of Object.keys(a.listF)) delete a.listF[k];
  a.credSel = ''; a.credPagas = false;
  db.owners.push(a.normPerson({ id: 'o1', name: 'Ana Dona' }));
  db.tenants.push(a.normPerson({ id: 't1', name: 'Rui Inquilino' }), a.normPerson({ id: 't2', name: 'Sofia Lopes' }));
  const casa = (id, name, loans) => a.normProp({ id, name, use: 'investimento', rentalMode: 'inteiro', ownerIds: ['o1'], value: 100000, loans: loans || [] });
  db.properties.push(
    casa('p1', 'T1 Baixa', [a.normLoan({ id: 'l1', name: 'Aquisição', bank: 'Banco Azul', outstanding: 50000, years: 20, type: 'fixa', rate: 3, start: '2020-01-10' })]),
    casa('p2', 'T2 Graça', [a.normLoan({ id: 'l2', name: 'Obras', bank: 'Banco Verde', outstanding: 20000, years: 10, type: 'fixa', rate: 4, start: '2021-01-10' })]),
    casa('p3', 'T3 Foz'),
    casa('p4', 'T4 Lapa'));
  db.contracts.push(a.normContract({ id: 'c1', name: 'Baixa', propertyId: 'p1', tenantIds: ['t1'], rent: 800, start: (ANO - 1) + '-01-01', active: true }));
  db.contracts.push(a.normContract({ id: 'c2', name: 'Graça', propertyId: 'p2', tenantIds: ['t2'], rent: 700, start: (ANO - 1) + '-01-01', active: true }));
  db.recurring.push(a.normRec({ id: 'r1', name: 'Condomínio', every: 'month', next: '2999-01-05', tx: { kind: 'expense', label: 'Condomínio', amount: 50, propertyId: 'p1' } }));
  db.recurring.push(a.normRec({ id: 'r2', name: 'Seguro', every: 'month', next: '2999-01-06', tx: { kind: 'expense', label: 'Seguro', amount: 20, propertyId: null, groupId: 'G3' } }));
  db.templates.push(a.normTpl({ id: 'm1', name: 'Luz', tx: { kind: 'expense', label: 'Luz', amount: 40, propertyId: 'p2' } }));
  db.groups.push(
    a.normGroup({ id: 'G1', name: 'Centro', kind: 'prop', ids: ['p1', 'p2', 'p4'] }),
    a.normGroup({ id: 'G2', name: 'Norte', kind: 'prop', ids: ['p3'] }),
    a.normGroup({ id: 'G3', name: 'Planos', kind: 'prop', ids: ['p3'] }),
    a.normGroup({ id: 'G5', name: 'Sul', kind: 'prop', ids: ['p2'] }),
    a.normGroup({ id: 'GC', name: 'Contratos antigos', kind: 'contract', ids: ['c1'] }));
}

/* As escolhas do menu de um chip, pela ordem: os rótulos e '—' na linha.
   Recebe: h — o HTML da vista; id — o id do sel() (ex.: 'lfc_lcts_p').
   Devolve: array de textos. */
function escolhas(h, id) {
  const i = h.indexOf('id="pop_' + id + '"');
  assert.ok(i > -1, 'o menu ' + id + ' existe');
  const pop = h.slice(i, h.indexOf('</div></div>', i));
  return [...pop.matchAll(/<div class="sdiv"|<span>([^<]*)<\/span>/g)].map((m) => (m[1] == null ? '—' : m[1]));
}

describe('o helper das opções', () => {
  beforeEach(() => semear(app));

  test('os imóveis dados, a linha e só os grupos com um deles; o grupo escolhido fica', () => {
    const ps = [app.prop('p1')];
    const o = app.imoveisEGruposOpts(ps);
    igual(o.map((x) => x.div ? '—' : x.v + '=' + x.label),
      ['=Todos os imóveis', 'p1=T1 Baixa', '—', 'g:G1=Grupo · Centro']);
    const com = app.imoveisEGruposOpts(ps, 'g:G2').filter((x) => !x.div).map((x) => x.v);
    igual(com, ['', 'p1', 'g:G1', 'g:G2'], 'o escolhido não some do menu');
    igual(app.imoveisEGruposOpts([]).map((x) => x.v), [''], 'sem grupos com imóveis dados, sem a linha');
    const porRegra = app.imoveisEGruposOpts(ps, '', (g) => g.id === 'G3').filter((x) => !x.div).map((x) => x.v);
    igual(porRegra, ['', 'p1', 'g:G3'], 'a regra própria da lista decide os grupos');
  });
});

describe('os Contratos', () => {
  beforeEach(() => semear(app));

  test('o «Imóvel» tem os imóveis com contratos, a linha e os grupos com contratos; o grupo de contratos fica no seu campo', () => {
    const h = app.vContracts();
    assert.deepEqual(escolhas(h, 'lfc_lcts_p'), ['Todos os imóveis', 'T1 Baixa', 'T2 Graça', '—', 'Grupo · Centro', 'Grupo · Sul']);
    assert.match(h, /<span>Contratos antigos<\/span>/, 'o grupo de contratos continua no painel');
  });

  test('escolher um grupo filtra pelos imóveis dele: as linhas, as contagens e o chip', () => {
    app.lf('lcts').p = 'g:G5';
    let h = app.vContracts();
    assert.deepEqual([...h.matchAll(/data-lp="ct:(\w+)"/g)].map((m) => m[1]), ['c2']);
    assert.match(h, /<span>Todos os estados · 1<\/span>/);
    assert.match(h, /<span id="lab_lfc_lcts_p">Grupo · Sul<\/span>/);
    app.lf('lcts').p = 'g:G1';
    h = app.vContracts();
    assert.deepEqual([...h.matchAll(/data-lp="ct:(\w+)"/g)].map((m) => m[1]), ['c1', 'c2']);
  });

  test('com «Em vigor», o rodapé diz só os imóveis do grupo sem contrato em vigor', () => {
    app.lf('lcts').st = 'on';
    let h = app.vContracts();
    assert.match(h, /class="small ct-sem-vigor">T3 Foz e T4 Lapa não têm contrato em vigor/);
    app.lf('lcts').p = 'g:G1';
    h = app.vContracts();
    assert.match(h, /class="small ct-sem-vigor">T4 Lapa não tem contrato em vigor/);
    assert.doesNotMatch(h, /T3 Foz/);
  });
});

describe('os Planeados', () => {
  beforeEach(() => semear(app));

  test('o «Imóvel» tem todos os imóveis, a linha e os grupos com planeados ou modelos', () => {
    const h = app.vRecurring();
    assert.deepEqual(escolhas(h, 'lfc_lrec_p'),
      ['Todos os imóveis', 'T1 Baixa', 'T2 Graça', 'T3 Foz', 'T4 Lapa', '—', 'Grupo · Centro', 'Grupo · Planos', 'Grupo · Sul']);
  });

  test('escolher um grupo filtra os planeados e os modelos pelos imóveis dele, e pelos do próprio grupo', () => {
    const recs = (h) => [...h.matchAll(/data-lp="rec:(\w+)"/g)].map((m) => m[1]);
    const tpls = (h) => [...h.matchAll(/data-lp="tpl:(\w+)"/g)].map((m) => m[1]);
    app.lf('lrec').p = 'g:G1';
    let h = app.vRecurring();
    assert.deepEqual(recs(h), ['r1']);
    assert.deepEqual(tpls(h), ['m1']);
    assert.match(h, /<span>Todos os estados · 1<\/span>/, 'as contagens do estado seguem o grupo');
    app.lf('lrec').p = 'g:G3';
    h = app.vRecurring();
    assert.deepEqual(recs(h), ['r2']);
    assert.deepEqual(tpls(h), []);
    app.lf('lrec').p = 'g:G5';
    h = app.vRecurring();
    assert.deepEqual(recs(h), []);
    assert.deepEqual(tpls(h), ['m1']);
  });
});

describe('os Créditos', () => {
  beforeEach(() => semear(app));

  test('o «Imóvel» tem os imóveis com hipotecas, a linha e os grupos com hipotecas', () => {
    const h = app.vCredits();
    assert.deepEqual(escolhas(h, 'lfc_lcred_p'), ['Todos os imóveis', 'T1 Baixa', 'T2 Graça', '—', 'Grupo · Centro', 'Grupo · Sul']);
  });

  test('escolher um grupo filtra as hipotecas pelos imóveis dele, e as contagens também', () => {
    app.lf('lcred').p = 'g:G5';
    let h = app.vCredits();
    assert.match(h, /mort:p2:l2/);
    assert.doesNotMatch(h, /mort:p1:l1/);
    assert.match(h, /<span>Ativas · 1<\/span>/);
    assert.match(h, /<span id="lab_lfc_lcred_p">Grupo · Sul<\/span>/);
    app.lf('lcred').p = 'g:G1';
    h = app.vCredits();
    assert.match(h, /mort:p1:l1/);
    assert.match(h, /mort:p2:l2/);
  });
});

describe('apagar um grupo escolhido', () => {
  beforeEach(() => semear(app));

  test('as três listas voltam a todos os imóveis, em vez de ficarem num filtro que já não existe', () => {
    for (const k of ['lcts', 'lrec', 'lcred']) app.lf(k).p = 'g:G5';
    app.lf('lcts').st = 'on';
    app.gruposApagarLocal(['G5']);
    for (const k of ['lcts', 'lrec', 'lcred']) assert.equal(app.lf(k).p, '', k);
    assert.equal(app.lf('lcts').st, 'on', 'os outros filtros ficam');
  });

  test('apagar outro grupo não mexe no escolhido', () => {
    app.lf('lcts').p = 'g:G5';
    app.gruposApagarLocal(['G1']);
    assert.equal(app.lf('lcts').p, 'g:G5');
  });
});
