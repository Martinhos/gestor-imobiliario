// As despesas automáticas: o IMI, o condomínio e o seguro vivem na ficha do
// imóvel e criam planeados sozinhos (o IMI nas prestações da lei, o condomínio
// mensal no dia 1, o seguro anual no mês escolhido), pelo molde das rendas e
// das prestações; a projeção conta os planeados de despesa e o IRS de cada
// contrato, e diz o que ficou de fora por ter sido pago de uma vez. A página
// «Despesas que se repetem» e a regra por categorias saíram. A vista geral e a
// avaliação continuam com as despesas todas.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, perto, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

// a app vive num dia fixo: as datas dos planeados contam-se a partir dele
const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
afterEach(() => { app.window.CW = undefined; app.definirServicosDesligados([]); });
const ANO = Number(app.today().slice(0, 4));

let casa;
beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  casa = app.normProp({ id: 'casa', name: 'Casa', value: 200000, ownerIds: ['ana', 'bruno'] });
  app.db.properties.push(casa, app.normProp({ id: 'casa2', name: 'Casa 2', value: 100000, ownerIds: ['ana'] }));
  app.db.groups.push(app.normGroup({ id: 'G', name: 'Grupo', kind: 'prop', ids: ['casa', 'casa2'] }));
});
const tx = (extra) => app.normTx(Object.assign({ kind: 'expense', amount: 100, date: (ANO - 1) + '-03-15', propertyId: 'casa' }, extra));
const mov = (extra) => { const t = tx(extra); app.db.transactions.push(t); return t; };
const rec = (extra) => { const r = app.normRec(Object.assign({ name: 'Planeado', every: 'month', next: ANO + '-10-01' }, extra)); app.db.recurring.push(r); return r; };
const despesa = (amount, extra) => rec({ tx: Object.assign({ kind: 'expense', amount, category: 'Seguros', sub: 'Multirriscos', propertyId: 'casa' }, extra || {}) });
const imis = (p) => app.propRecsOf(p || casa, 'imi');
/* troca o que grava e desenha: as ações gravam, repintam e avisam */
const semEcra = () => { app.save = () => {}; app.render = () => {}; app.buildNav = () => {}; app.toast = () => {}; app.closeAllModals = () => {}; };
/* os campos do formulário, como se a pessoa os tivesse escrito (o documento
   falso guarda um elemento por id) */
function comCampos(valores) {
  const doc = app.document, original = doc.getElementById;
  doc.getElementById = (id) => { const el = original(id); if (id in valores) el.value = valores[id]; return el; };
  return () => { doc.getElementById = original; };
}

describe('o IMI nas prestações da lei', () => {
  test('até 100 € é uma prestação só, no último dia de maio — do ano que vem, porque maio já passou', () => {
    casa.imi = 100;
    app.syncPropRecs(casa);
    const r = imis();
    assert.equal(r.length, 1);
    assert.equal(r[0].next, (ANO + 1) + '-05-31');
    assert.equal(r[0].every, 'year');
    perto(r[0].tx.amount, 100);
    assert.equal(r[0].name, 'IMI · Casa', 'com uma só não se numera');
    assert.equal(r[0].auto, true);
    assert.equal(r[0].tx.propRec, 'imi');
    assert.equal(r[0].tx.propRecN, 1);
    assert.equal(r[0].tx.kind, 'expense');
    assert.equal(r[0].tx.propertyId, 'casa');
    assert.equal(r[0].tx.category, 'Impostos');
    assert.equal(r[0].tx.sub, 'IMI');
  });

  test('de 100 a 500 € são duas: maio e novembro', () => {
    casa.imi = 400;
    app.syncPropRecs(casa);
    const r = imis();
    igual(r.map((x) => [x.tx.propRecN, x.next, x.tx.amount, x.name]), [
      [1, (ANO + 1) + '-05-31', 200, 'IMI · Casa (1.ª de 2)'],
      [2, ANO + '-11-30', 200, 'IMI · Casa (2.ª de 2)'],
    ]);
    assert.equal(r[1].tx.label, r[1].name);
  });

  test('acima de 500 € são três: maio, agosto e novembro, e os cêntimos que sobram ficam na primeira', () => {
    casa.imi = 1000;
    app.syncPropRecs(casa);
    igual(imis().map((x) => [x.next, x.tx.amount]), [[(ANO + 1) + '-05-31', 333.34], [(ANO + 1) + '-08-31', 333.33], [ANO + '-11-30', 333.33]]);
    perto(imis().reduce((s, x) => s + x.tx.amount, 0), 1000, 1e-9, 'a soma é o IMI inteiro');
    casa.imi = 100.01;
    app.syncPropRecs(casa);
    igual(imis().map((x) => x.tx.amount), [50, 50.01]);
    igual(app.imiPrestacoes(500).map((x) => x.mes), [5, 11], '500 ainda são duas');
    igual(app.imiPrestacoes(500.01).map((x) => x.mes), [5, 8, 11]);
    igual(app.imiPrestacoes(0), []);
  });

  test('mudar o valor mantém o next que a pessoa acertou; mudar o número de prestações refaz', () => {
    casa.imi = 400;
    app.syncPropRecs(casa);
    const antes = imis().map((x) => x.id);
    imis()[0].next = (ANO + 1) + '-05-10';   // paga mais cedo
    imis()[0].tx.paidBy = 'ana';
    casa.imi = 450;
    app.syncPropRecs(casa);
    igual(imis().map((x) => x.id), antes, 'os mesmos planeados');
    assert.equal(imis()[0].next, (ANO + 1) + '-05-10', 'o next acertado fica');
    assert.equal(imis()[0].tx.paidBy, 'ana', 'e o que é da pessoa também');
    igual(imis().map((x) => x.tx.amount), [225, 225], 'só o valor muda');
    casa.name = 'Casa Nova';
    app.syncPropRecs(casa);
    assert.equal(imis()[0].name, 'IMI · Casa Nova (1.ª de 2)', 'o nome acompanha o imóvel');
    imis()[1].name = 'IMI de novembro';
    app.syncPropRecs(casa);
    assert.equal(imis()[1].name, 'IMI de novembro', 'um nome mudado à mão fica');
    casa.imi = 900;
    app.syncPropRecs(casa);
    assert.equal(imis().length, 3, 'passou a três prestações');
    assert.ok(imis().every((x) => antes.indexOf(x.id) < 0), 'refeitas do zero');
    igual(imis().map((x) => x.next), [(ANO + 1) + '-05-31', (ANO + 1) + '-08-31', ANO + '-11-30']);
    casa.imi = 80;
    app.syncPropRecs(casa);
    assert.equal(imis().length, 1);
  });

  test('o valor a zero apaga as prestações, e o sync não as faz renascer', () => {
    casa.imi = 400;
    app.syncPropRecs(casa);
    assert.equal(imis().length, 2);
    casa.imi = 0;
    app.syncPropRecs(casa);
    assert.equal(imis().length, 0);
    app.syncAllPropRecs();
    assert.equal(app.db.recurring.length, 0);
  });
});

describe('o condomínio e o seguro', () => {
  test('o condomínio é mensal, no dia 1 do mês seguinte, Condomínio / Quota mensal', () => {
    casa.condominio = 55;
    app.syncPropRecs(casa);
    const r = app.propRecsOf(casa, 'condominio');
    assert.equal(r.length, 1);
    assert.equal(r[0].every, 'month');
    assert.equal(r[0].next, ANO + '-10-01');
    perto(r[0].tx.amount, 55);
    assert.equal(r[0].name, 'Condomínio · Casa');
    assert.equal(r[0].tx.category, 'Condomínio');
    assert.equal(r[0].tx.sub, 'Quota mensal');
    r[0].next = ANO + '-10-05';
    casa.condominio = 60;
    app.syncPropRecs(casa);
    assert.equal(app.propRecsOf(casa, 'condominio')[0].next, ANO + '-10-05', 'o next acertado fica');
    perto(app.propRecsOf(casa, 'condominio')[0].tx.amount, 60);
    casa.condominio = 0;
    app.syncPropRecs(casa);
    assert.equal(app.propRecsOf(casa, 'condominio').length, 0);
  });

  test('o seguro é anual no mês escolhido; sem mês, no corrente; mudar o mês move o planeado', () => {
    casa.seguro = 96;
    app.syncPropRecs(casa);
    let r = app.propRecsOf(casa, 'seguro');
    assert.equal(r.length, 1);
    assert.equal(r[0].every, 'year');
    assert.equal(r[0].next, ANO + '-09-30', 'sem mês, o fim do mês corrente');
    assert.equal(r[0].name, 'Seguro · Casa');
    assert.equal(r[0].tx.category, 'Seguros');
    assert.equal(r[0].tx.sub, 'Multirriscos');
    casa.seguroMes = 3;
    app.syncPropRecs(casa);
    r = app.propRecsOf(casa, 'seguro');
    assert.equal(r[0].next, (ANO + 1) + '-03-31', 'março já passou: o do ano que vem');
    casa.seguroMes = 12;
    app.syncPropRecs(casa);
    assert.equal(app.propRecsOf(casa, 'seguro')[0].next, ANO + '-12-31');
    app.propRecsOf(casa, 'seguro')[0].next = ANO + '-12-15';
    casa.seguro = 120;
    app.syncPropRecs(casa);
    assert.equal(app.propRecsOf(casa, 'seguro')[0].next, ANO + '-12-15', 'no mesmo mês, o next acertado fica');
    assert.equal(app.propRecsOf(casa, 'seguro').length, 1);
    casa.seguro = 0;
    app.syncPropRecs(casa);
    assert.equal(app.propRecsOf(casa, 'seguro').length, 0);
  });

  test('os três juntos são cinco planeados, todos do imóvel; a categoria segue a árvore', () => {
    casa.imi = 1000; casa.condominio = 55; casa.seguro = 96;
    app.syncPropRecs(casa);
    assert.equal(app.propRecsOf(casa).length, 5);
    assert.ok(app.propRecsOf(casa).every((x) => x.auto && x.tx.propertyId === 'casa' && x.tx.kind === 'expense'));
    app.syncPropRecs(casa);
    assert.equal(app.db.recurring.length, 5, 'sincronizar outra vez não duplica');
    // sem a categoria na árvore, o planeado nasce sem ela (como a renda com as Rendas)
    delete app.db.settings.cats['Seguros'];
    casa.seguro = 0; app.syncPropRecs(casa); casa.seguro = 96; app.syncPropRecs(casa);
    assert.equal(app.propRecsOf(casa, 'seguro')[0].tx.category, '');
  });
});

describe('quem os mantém e quem os apaga', () => {
  test('o syncAllContractRecs não apaga os do imóvel; o syncAllLoanRecs também não', () => {
    casa.imi = 400; casa.condominio = 55;
    app.syncAllPropRecs();
    assert.equal(app.db.recurring.length, 3);
    app.syncAllContractRecs();
    app.syncAllLoanRecs();
    assert.equal(app.db.recurring.length, 3, 'não são órfãos de contrato nenhum');
    // um automático sem origem nenhuma continua a sair
    rec({ auto: true, name: 'Fantasma', tx: { kind: 'income', amount: 1 } });
    app.syncAllContractRecs();
    assert.equal(app.db.recurring.length, 3);
    assert.ok(app.db.recurring.every((x) => x.tx.propRec));
  });

  test('apagar o imóvel apaga-os', () => {
    semEcra();
    app.confirmModal = (t, x, sim) => sim();
    app.comDesfazer = () => {};
    casa.imi = 400; casa.condominio = 55; casa.seguro = 96;
    app.db.properties[1].seguro = 50;
    app.syncAllPropRecs();
    assert.equal(app.db.recurring.length, 5);
    app.delProp('casa');
    app.syncAllPropRecs();
    igual(app.db.recurring.map((x) => [x.tx.propertyId, x.tx.propRec]), [['casa2', 'seguro']], 'só os do imóvel apagado saem');
  });

  test('apagar o planeado tira o valor da ficha — e as prestações irmãs do IMI —, e a confirmação di-lo', () => {
    semEcra();
    let frase = '';
    app.confirmModal = (t, x, sim) => { frase = x; sim(); };
    casa.imi = 400; casa.condominio = 55; casa.seguro = 96;
    app.syncPropRecs(casa);
    app.delRec(imis()[0].id);
    assert.match(frase, /o IMI da ficha do imóvel Casa/);
    assert.match(frase, /tira também o valor da ficha \(e as outras prestações\)/);
    assert.equal(casa.imi, 0);
    assert.equal(imis().length, 0, 'as duas prestações saem');
    assert.equal(app.propRecsOf(casa).length, 2, 'o condomínio e o seguro ficam');
    app.syncAllPropRecs();
    assert.equal(imis().length, 0, 'e o sync não o faz renascer');
    app.delRec(app.propRecsOf(casa, 'seguro')[0].id);
    assert.match(frase, /o seguro da ficha do imóvel Casa/);
    assert.equal(casa.seguro, 0);
    app.delRec(app.propRecsOf(casa, 'condominio')[0].id);
    assert.equal(casa.condominio, 0);
    assert.equal(app.db.recurring.length, 0);
  });

  test('guardar o imóvel pelo formulário cria-os; com os Planeados desligados não lhes toca; num imóvel de outro dono não se criam', () => {
    janelasFalsas(app, 'paintThumbs', 'render', 'buildNav', 'save');
    app.toast = () => {};
    app.loanStartsAntes = () => ({});
    app.perguntarPrestacoesEmFalta = () => {};
    app.collectProp = () => { app.pForm.imi = 400; app.pForm.condominio = 55; };
    app.propModal('casa');
    app.onSave();
    assert.equal(app.prop('casa').imi, 400);
    assert.equal(app.propRecsOf(app.prop('casa')).length, 3);
    // desligado: nada dos planeados
    let tocou = 0;
    app.syncPropRecs = () => { tocou++; };
    app.definirServicosDesligados(['recurring']);
    app.propModal('casa');
    app.onSave();
    assert.equal(tocou, 0);
    app.definirServicosDesligados([]);
    // um imóvel onde só colaboro: os planeados são do dono, vêm com a casa
    const rui = Object.assign(app.normProp({ id: 'P2', name: 'T2 Rui', ownerIds: ['ana'], imi: 300 }), { _sharedFrom: 'Rui', _ownerUserId: 'rui' });
    app.db.properties.push(rui);
    app.window.CW = { user: { id: 'eu' }, cargos: { P2: { dono: false, nome: 'Contabilista', perms: ['tx.view', 'rec.view', 'rec.add'] } }, pessoas: {} };
    app.syncAllPropRecs();
    assert.equal(app.propRecsOf(rui).length, 0);
  });

  test('a ficha do planeado diz de onde vem, a lista marca-o «do imóvel» e o vazio promete-o', () => {
    casa.imi = 80;
    app.syncPropRecs(casa);
    const f = app.recFicha(imis()[0].id);
    assert.match(f, /IMI do imóvel Casa/);
    assert.match(f, /apagar este planeado tira-o de lá/);
    assert.match(app.vRecurring(), /do imóvel/);
    assert.match(app.recOrigensFrase(), /o IMI, o condomínio e o seguro da ficha de cada imóvel criam um sem tu fazeres nada/);
    app.definirServicosDesligados(['properties']);
    assert.doesNotMatch(app.recOrigensFrase(), /IMI/);
  });
});

describe('a ficha e o formulário do imóvel', () => {
  test('o normProp normaliza os campos: cêntimos, nada negativo, o mês entre 0 e 12', () => {
    const p = app.normProp({ imi: '400.005', condominio: -5, seguro: 96.129, seguroMes: '8' });
    assert.equal(p.imi, 400.01);
    assert.equal(p.condominio, 0);
    assert.equal(p.seguro, 96.13);
    assert.equal(p.seguroMes, 8);
    igual([app.normProp({}).imi, app.normProp({}).condominio, app.normProp({}).seguro, app.normProp({}).seguroMes], [0, 0, 0, 0]);
    assert.equal(app.normProp({ seguroMes: 13 }).seguroMes, 12);
    assert.equal(app.normProp({ seguroMes: 'x' }).seguroMes, 0);
  });

  test('o formulário tem o bloco «Despesas fixas do imóvel» com a lei do IMI; sem os Planeados não o tem', () => {
    app.pForm = app.normProp({ id: 'p1', name: 'T2', imi: 400, seguroMes: 8 });
    const html = app.propBody();
    for (const id of ['p_imi', 'p_condominio', 'p_seguro', 'p_seguroMes']) assert.ok(html.includes('id="' + id + '"'), 'tem o campo ' + id);
    assert.match(html, /Despesas fixas do imóvel/);
    assert.match(html, /até 100 € numa só, em maio; de 100 a 500 € em maio e novembro; acima de 500 € em maio, agosto e novembro/);
    assert.match(html, /dia 1 de cada mês/);
    assert.match(html, /IMI 400,00\s€\/ano/, 'o resumo da dobra');
    assert.doesNotMatch(html, /onclick=/);
    app.definirServicosDesligados(['recurring']);
    assert.doesNotMatch(app.propBody(), /p_imi|Despesas fixas/);
  });

  test('o collectProp lê os campos de volta', () => {
    app.pForm = app.normProp({ id: 'p1', name: 'T2' });
    const repor1 = comCampos({ p_name: 'T2', p_imi: '400', p_condominio: '55,5', p_seguro: '96', p_seguroMes: '8' });
    try { app.collectProp(); } finally { repor1(); }
    igual([app.pForm.imi, app.pForm.condominio, app.pForm.seguro, app.pForm.seguroMes], [400, 55.5, 96, 8]);
    const repor2 = comCampos({ p_name: 'T2', p_imi: '', p_condominio: '-3', p_seguro: 'abc', p_seguroMes: '0' });
    try { app.collectProp(); } finally { repor2(); }
    igual([app.pForm.imi, app.pForm.condominio, app.pForm.seguro, app.pForm.seguroMes], [0, 0, 0, 0]);
  });

  test('a ficha mostra as despesas fixas ao dono e a quem vê planeados, e a mais ninguém', () => {
    casa.imi = 400; casa.condominio = 55; casa.seguro = 96; casa.seguroMes = 8;
    const f = app.propFicha('casa');
    assert.match(f, /Despesas fixas/);
    assert.match(f, /IMI 400,00\s€\/ano · Condomínio 55,00\s€\/mês · Seguro 96,00\s€\/ano em agosto/);
    assert.doesNotMatch(app.propFicha('casa2'), /Despesas fixas/, 'sem valores não há linha');
    const rui = Object.assign(app.normProp({ id: 'P2', name: 'T2 Rui', ownerIds: ['ana'], imi: 300 }), { _sharedFrom: 'Rui', _ownerUserId: 'rui' });
    app.db.properties.push(rui);
    const sessao = (perms) => { app.window.CW = { user: { id: 'eu' }, cargos: { P2: { dono: false, nome: 'Cargo', perms } }, pessoas: {} }; };
    sessao(['visit.view', 'visit.add']);
    assert.doesNotMatch(app.propFicha('P2'), /Despesas fixas/);
    sessao(['tx.view', 'rec.view']);
    assert.match(app.propFicha('P2'), /Despesas fixas/);
    assert.match(app.propFicha('P2'), /IMI 300,00/);
  });
});

describe('as despesas previstas (despesasPrevistas)', () => {
  test('leva cada planeado ao ano — semana ×52, mês ×12, trimestre ×4, ano ×1, uma vez ×0 — e ignora os terminados', () => {
    despesa(10, {}); app.db.recurring[0].every = 'week';
    despesa(100);                                        // mês
    despesa(300, {}); app.db.recurring[2].every = 'quarter';
    despesa(1000, {}); app.db.recurring[3].every = 'year';
    despesa(5000, {}); app.db.recurring[4].every = 'once';
    let b = app.despesasPrevistas(null);
    perto(b.op, 520 + 1200 + 1200 + 1000);
    assert.equal(b.n, 4, 'o «uma só vez» não entra');
    // com fim passado; a terminar na próxima confirmação (recTermina)
    despesa(100, {}); app.db.recurring[5].end = ANO + '-03-01';
    despesa(100, {}); Object.assign(app.db.recurring[6], { every: 'year', next: ANO + '-12-31', end: (ANO + 1) + '-06-30' });
    despesa(100, {}); app.db.recurring[7].end = (ANO + 5) + '-12-31';
    b = app.despesasPrevistas(null);
    perto(b.op, 3920 + 1200);
    assert.equal(b.n, 5);
    // uma receita planeada e uma prestação não são despesas
    rec({ tx: { kind: 'income', amount: 900, propertyId: 'casa' } });
    rec({ tx: { kind: 'loan', amount: 500, propertyId: 'casa' } });
    perto(app.despesasPrevistas(null).op, 5120);
  });

  test('por categoria, do maior para o menor; sem categoria vale «Sem categoria»; fora dos totais não entra', () => {
    despesa(100);                                                           // Seguros 1200
    despesa(400, { category: 'Impostos', sub: 'IMI' }); app.db.recurring[1].every = 'year';
    despesa(200, { category: '', sub: '' });                               // 2400
    const b = app.despesasPrevistas(null);
    igual(b.porCat, [{ label: 'Sem categoria', value: 2400 }, { label: 'Seguros', value: 1200 }, { label: 'Impostos', value: 400 }]);
    app.db.settings.exclude[app.excKey('cats', 'Seguros')] = true;
    perto(app.despesasPrevistas(null).op, 2800);
    assert.equal(app.despesasPrevistas(null).n, 2);
  });

  test('com filtro de proprietário e num grupo, o peso é o das métricas (txWeight)', () => {
    despesa(1000, { propertyId: null, groupId: 'G' }); app.db.recurring[0].every = 'year';   // 500 por casa
    despesa(50);                                                                                // casa, 600/ano
    app.ownerFilter = 'bruno';                                                                  // metade da casa
    perto(app.despesasPrevistas(null).op, 250 + 300);
    app.ownerFilter = '';
    perto(app.despesasPrevistas('casa2').op, 500);
    perto(app.despesasPrevistas('casa').op, 1100);
    perto(app.despesasPrevistas('g:G').op, 1600);
    assert.equal(app.despesasPrevistas('casa2').n, 1);
  });

  test('os planeados da ficha do imóvel entram como os outros: IMI 400 + condomínio 660 + seguro 96 = 1156 em 4', () => {
    casa.imi = 400; casa.condominio = 55; casa.seguro = 96;
    app.syncPropRecs(casa);
    const b = app.despesasPrevistas(null);
    perto(b.op, 1156);
    assert.equal(b.n, 4);
    igual(b.porCat.map((x) => x.label), ['Condomínio', 'Impostos', 'Seguros']);
  });
});

describe('as despesas de uma vez (despesasDeUmaVez) e o despesaRepete', () => {
  test('conta as obras do último ano completo, e não o IMI que tem planeado; o metrics().op continua com todas', () => {
    casa.imi = 400; casa.condominio = 55;
    app.syncPropRecs(casa);
    mov({ amount: 400, category: 'Impostos', sub: 'IMI' });
    for (let m = 1; m <= 12; m++) mov({ amount: 55, category: 'Condomínio', sub: 'Quota mensal', date: (ANO - 1) + '-' + String(m).padStart(2, '0') + '-01' });
    mov({ amount: 5000, category: 'Obras e benfeitorias', sub: 'Cozinha' });
    mov({ amount: 300, category: 'Manutenção e reparações', sub: 'Pequenas reparações' });
    mov({ amount: 900, category: 'Obras e benfeitorias', date: ANO + '-03-01' });      // o corrente não é completo
    const u = app.despesasDeUmaVez(null);
    perto(u.fora, 5300);
    assert.equal(u.ano, ANO - 1);
    igual(u.foraPorCat, [{ label: 'Obras e benfeitorias', value: 5000 }, { label: 'Manutenção e reparações', value: 300 }]);
    perto(app.metrics(ANO - 1, null, { share: true }).op, 6360, 0.01, 'a vista geral conta as despesas todas');
    perto(app.metrics(ANO - 1, 'casa', {}).op, 6360);
  });

  test('o último ano completo é o último com despesas; sem nenhum, não há de fora', () => {
    mov({ amount: 700, category: 'Seguros', date: (ANO - 3) + '-05-01' });
    mov({ kind: 'income', amount: 12000, date: (ANO - 1) + '-06-01' });
    let u = app.despesasDeUmaVez(null);
    assert.equal(u.ano, ANO - 3, 'um ano só com receitas não conta');
    perto(u.fora, 700);
    app.db.transactions = [];
    mov({ amount: 900, category: 'Obras e benfeitorias', date: ANO + '-03-01' });
    u = app.despesasDeUmaVez(null);
    assert.equal(u.ano, 0);
    perto(u.fora, 0, 1e-9);
    igual(u.foraPorCat, []);
  });

  test('a etiqueta «Recorrente» e um planeado da mesma categoria no mesmo imóvel reconhecem a despesa; nada mais', () => {
    const repete = (extra) => app.despesaRepete(tx(extra));
    assert.equal(repete({ category: 'Obras e benfeitorias', tags: ['Recorrente'] }), true);
    assert.equal(repete({ category: 'Impostos', sub: 'IMI' }), false, 'sem planeado, a categoria não decide nada');
    assert.equal(repete({ category: '' }), false, 'sem categoria já não entra por omissão');
    despesa(80, { category: 'Manutenção e reparações', sub: '' });
    assert.equal(repete({ category: 'Manutenção e reparações', sub: 'Pragas' }), true, 'o planeado sem sub apanha a categoria toda');
    assert.equal(repete({ category: 'Manutenção e reparações', propertyId: 'casa2' }), false, 'noutro imóvel não');
    assert.equal(repete({ category: 'Manutenção e reparações', propertyId: null, groupId: 'G' }), false, 'num grupo não');
    app.db.recurring = [];
    despesa(500, { category: 'Obras e benfeitorias', sub: 'Pintura', propertyId: null, groupId: 'G' });
    assert.equal(repete({ category: 'Obras e benfeitorias', sub: 'Pintura', propertyId: null, groupId: 'G' }), true);
    assert.equal(repete({ category: 'Obras e benfeitorias', sub: 'Janelas', propertyId: null, groupId: 'G' }), false, 'com sub, só essa sub');
    app.db.recurring = [rec({ tx: { kind: 'income', amount: 500, category: 'Obras e benfeitorias', propertyId: 'casa' } })];
    assert.equal(repete({ category: 'Obras e benfeitorias' }), false, 'um planeado de receita não conta');
    assert.equal(app.despesaRepete(tx({ kind: 'income', category: 'Rendas', tags: ['Recorrente'] })), false, 'só despesas');
    // com filtro de proprietário, o peso é o das métricas
    app.db.recurring = [];
    mov({ amount: 600, category: 'Obras e benfeitorias' });
    app.ownerFilter = 'bruno';
    perto(app.despesasDeUmaVez(null).fora, 300);
  });
});

describe('as Projeções', () => {
  beforeEach(() => {
    app.db.contracts.push(app.normContract({ propertyId: 'casa', rent: 1000, active: true, increase: 0 }));
    app.db.settings.inflation = 2;
  });

  test('o projRows tem o IRS à taxa de cada contrato, as despesas dos planeados com a inflação, e o cashflow desconta os dois', () => {
    despesa(100);
    mov({ amount: 8000, category: 'Obras e benfeitorias', sub: 'Remodelação' });
    const r = app.projRows(null);
    perto(r.rows[0].rent, 12000);
    perto(r.rows[0].irs, 3000, 1e-9, '25 % sem fim');
    perto(r.rows[0].exp, 1200);
    perto(r.rows[1].exp, 1200 * 1.02, 0.001);
    perto(r.rows[1].irs, 3000, 1e-9, 'sem aumento, o IRS não muda');
    perto(r.rows[0].cf, 12000 - 3000 - 1200 - r.rows[0].loan, 0.001);
    igual(Object.keys(r.base).sort(), ['fora', 'foraAno', 'foraPorCat', 'n', 'op', 'porCat']);
    perto(r.base.op, 1200); assert.equal(r.base.n, 1);
    perto(r.base.fora, 8000); assert.equal(r.base.foraAno, ANO - 1);
    // a taxa escrita no contrato manda, e um contrato longo paga menos
    app.db.contracts[0].taxRate = 28;
    perto(app.projRows(null).rows[0].irs, 3360, 1e-9);
    app.db.contracts.push(app.normContract({ propertyId: 'casa2', rent: 500, active: true, increase: 0, start: ANO + '-01-01', end: (ANO + 10) + '-12-31' }));
    const g = app.projRows(null);
    perto(g.rows[0].irs, 3360 + 6000 * app.taxRateOf(app.db.contracts[1]) / 100, 1e-6);
    assert.equal(app.taxRateOf(app.db.contracts[1]), 10);
    // o IRS anda com as rendas e com a quota-parte
    app.db.contracts = [app.normContract({ propertyId: 'casa', rent: 1000, active: true, increase: 10 })];
    perto(app.projRows(null).rows[1].irs, 12000 * 1.1 * 0.25, 1e-6);
    app.ownerFilter = 'bruno';
    perto(app.projRows(null).rows[0].irs, 1500, 1e-6);
  });

  test('a página diz «Despesas previstas», o IRS com o prazo, o que ficou de fora, e a tabela tem a coluna IRS', () => {
    casa.imi = 400; casa.condominio = 55; casa.seguro = 96;
    app.syncPropRecs(casa);
    mov({ amount: 8000, category: 'Obras e benfeitorias', sub: 'Remodelação' });
    mov({ amount: 400, category: 'Impostos', sub: 'IMI' });
    const h = app.vProjections();
    assert.match(h, /Despesas previstas: <b>1\s156\s€\/ano<\/b> — 4 planeados de despesa \(Condomínio, Impostos e Seguros\): o IMI, o condomínio e o seguro da ficha de cada imóvel e os que marcaste nos Planeados; crescem com a inflação\./);
    assert.match(h, /IRS sobre as rendas à taxa de cada contrato, contado no ano das rendas — a declaração entrega-se de abril a junho e paga-se até 31 de agosto do ano seguinte\./);
    assert.match(h, new RegExp('Em ' + (ANO - 1) + ' gastaste ainda <b>8\\s000\\s€</b> em despesas de uma vez \\(Obras e benfeitorias\\), que não se projetam\\.'));
    assert.match(h, /data-click="go\('recurring'\)">Ver planeados/);
    assert.doesNotMatch(h, /goSet\('repete'\)|Escolher as que se repetem|Despesas recorrentes/);
    assert.match(h, /<th>Rendas<\/th><th>IRS<\/th><th>Despesas<\/th><th>Prestações<\/th><th>Cashflow<\/th>/);
    assert.match(h, /com IRS, despesas e prestações/);
    assert.match(h, /1 planeado de despesa|4 planeados/);
    assert.doesNotMatch(h, /onclick=/);
    assert.match(app.WHY.cashflowFim, /menos o IRS sobre elas/);
    assert.match(app.WHY.cashflowFim, /pague no ano seguinte/);
  });

  /* Chegou a dizer «Ainda não há despesas previstas…» com um botão para os
     imóveis: um aviso solto no topo, e o Martinho pediu que saísse. Sem
     planeados, as contas fazem-se com zero e não se fala de despesas previstas. */
  test('sem nenhum planeado, as contas fazem-se com zero e as despesas previstas não se mencionam', () => {
    mov({ amount: 8000, category: 'Obras e benfeitorias' });
    let h = app.vProjections();
    assert.doesNotMatch(h, /Ainda não há despesas previstas|Despesas previstas|despesas previstas em/);
    assert.doesNotMatch(h, /Ver imóveis|Ver planeados/);
    assert.equal(app.projRows(null).rows[0].exp, 0);
    assert.match(h, /<div class="hint u-mt-12px">IRS sobre as rendas/, 'o IRS continua, à cabeça');
    assert.match(h, /Em 2025 gastaste <b>/, 'o que se gastou de uma vez continua, sem o «ainda»');
    despesa(100);
    assert.match(app.vProjections(), /Em 2025 gastaste ainda/);
    app.definirServicosDesligados(['recurring']);
    h = app.vProjections();
    assert.match(h, /Despesas previstas/);
    assert.doesNotMatch(h, /Ver imóveis|Ver planeados/);
  });
});

describe('o que saiu', () => {
  test('DESPESAS_REPETEM0, opBase, a regra por categorias, vRepete, toggleRepete, resetRepete e a entrada «repete» já não existem', () => {
    for (const n of ['DESPESAS_REPETEM0', 'opBase', 'despesasDoAno', 'porValor', 'repeteChave', 'repeteRegra', 'repeteOrigem', 'vRepete', 'toggleRepete', 'resetRepete']) {
      assert.equal(typeof app[n], 'undefined', n + ' saiu');
    }
    assert.equal(app.SUBPAGE.repete, undefined);
    app.setPage = '';
    const raiz = app.vSettings();
    assert.doesNotMatch(raiz, /Despesas que se repetem|goSet\('repete'\)/);
    assert.match(raiz, /goSet\('irs'\)/, 'as outras entradas ficam');
    app.setPage = 'repete';
    assert.equal(app.vSettings(), raiz, 'uma subpágina que não existe cai na raiz');
  });

  test('o fillCats já não cria «repete», e tira-o de uma base que o traga; a migração de exclude e irsMapa fica', () => {
    const st = {};
    app.fillCats(st);
    assert.equal(st.repete, undefined);
    igual(st.exclude, {});
    const st2 = { repete: { Obras: true }, exclude: { 'cats:Obras': true } };
    app.fillCats(st2);
    assert.equal(st2.repete, undefined);
    assert.equal(st2.exclude['cats:Obras'], true);
    assert.equal(app.blank.settings.repete, undefined);
    // renomear e apagar categorias continua a levar o exclude e o irsMapa, e a recusar nomes repetidos
    semEcra();
    app.confirmModal = (t, x, sim) => sim();
    const s = app.db.settings;
    s.exclude['cats:Obras e benfeitorias'] = true;
    s.exclude['cats:Obras e benfeitorias/Janelas'] = true;
    s.irsMapa['Obras e benfeitorias / Cozinha'] = 'conservacao';
    app.renameCat('cats', 'Obras e benfeitorias', 'Obras');
    assert.equal(s.exclude['cats:Obras'], true);
    assert.equal(s.exclude['cats:Obras/Janelas'], true);
    assert.equal(s.exclude['cats:Obras e benfeitorias'], undefined);
    assert.equal(s.irsMapa['Obras / Cozinha'], 'conservacao');
    let dito = ''; app.toast = (m) => { dito = m; };
    app.renameCat('cats', 'Obras', 'Seguros');
    assert.ok(s.cats['Obras'] && s.cats['Seguros'].includes('Multirriscos'));
    assert.equal(dito, 'Já há uma categoria com esse nome.');
    app.delCat('cats', 'Obras');
    assert.equal(s.exclude['cats:Obras'], undefined);
    assert.equal(s.irsMapa['Obras / Cozinha'], undefined);
  });
});
