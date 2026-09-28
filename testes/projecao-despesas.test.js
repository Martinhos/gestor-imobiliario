// A projeção das despesas conta só as que se repetem todos os anos: a regra de
// origem por categoria e subcategoria (DESPESAS_REPETEM0), a etiqueta
// «Recorrente», os planeados e a escolha da pessoa (settings.repete). A vista
// geral e a avaliação continuam com as despesas todas. As Definições têm a
// subpágina para escolher, e renomear ou apagar categorias leva as escolhas.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, perto, repor } from './arnes.js';

// a app vive num dia fixo: o ano corrente anualiza-se pelos meses decorridos
const app = carregarApp({ hoje: '2026-09-06' });
afterEach(() => repor(app));
const ANO = Number(app.today().slice(0, 4));
const MES = Number(app.today().slice(5, 7));

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
const repete = (category, sub, extra) => app.despesaRepete(tx(Object.assign({ category, sub: sub || '' }, extra)));
/* troca o que grava e desenha: as funções das definições gravam, repintam e avisam */
const semEcra = () => { app.save = () => {}; app.render = () => {}; app.toast = () => {}; };

describe('a regra de origem', () => {
  test('obras, reparações e mobiliário ficam de fora; IMI, condomínio e seguros entram', () => {
    assert.equal(repete('Obras e benfeitorias', 'Pintura'), false);
    assert.equal(repete('Obras e benfeitorias'), false);
    assert.equal(repete('Manutenção e reparações', 'Pequenas reparações'), false);
    assert.equal(repete('Mobiliário e equipamento', 'Mobiliário'), false);
    assert.equal(repete('Impostos', 'IMI'), true);
    assert.equal(repete('Impostos', 'AIMI'), true);
    assert.equal(repete('Condomínio', 'Quota mensal'), true);
    assert.equal(repete('Seguros', 'Multirriscos'), true);
    assert.equal(repete('Água, luz e gás', 'Eletricidade'), true);
    assert.equal(repete('Gestão e mediação', 'Gestão do imóvel'), true);
    assert.equal(repete('Serviços profissionais', 'Contabilidade'), true);
    assert.equal(repete('Limpeza e jardim'), true);
    assert.equal(repete('Custos bancários', 'Comissões'), true);
  });

  test('a sub manda sobre a categoria: a Quota extraordinária fica de fora com o Condomínio dentro', () => {
    assert.equal(repete('Condomínio'), true);
    assert.equal(repete('Condomínio', 'Quota extraordinária'), false);
    assert.equal(repete('Impostos', 'Imposto do selo'), false);
    assert.equal(repete('Impostos', 'Mais-valias'), false);
    assert.equal(repete('Gestão e mediação', 'Comissão de arrendamento'), false);
    assert.equal(repete('Serviços profissionais', 'Advogado'), false);
    assert.equal(repete('Custos bancários', 'Avaliação do banco'), false);
  });

  test('o Crédito à habitação, as dívidas, «Outros» e as categorias criadas pela pessoa ficam de fora; sem categoria entra', () => {
    assert.equal(repete('Crédito à habitação', 'Prestação mensal'), false, 'as prestações vêm do plano da hipoteca');
    assert.equal(repete('Dívidas a terceiros', 'Juros'), false);
    assert.equal(repete('Outros'), false);
    app.db.settings.cats['Piscina'] = ['Manutenção'];
    assert.equal(repete('Piscina', 'Manutenção'), false, 'uma categoria nova não se repete por omissão');
    assert.equal(repete('constructor'), false, 'o nome não herda nada do protótipo');
    assert.equal(repete(''), true, 'sem categoria não há como saber: entra, como antes');
    assert.equal(app.despesaRepete(tx({ kind: 'income', category: 'Rendas' })), false, 'só despesas');
  });
});

describe('o que põe uma despesa dentro', () => {
  test('a etiqueta «Recorrente» põe dentro uma obra', () => {
    assert.equal(repete('Obras e benfeitorias', 'Pintura', { tags: ['Recorrente'] }), true);
    assert.equal(repete('Obras e benfeitorias', 'Pintura', { tags: ['Urgente'] }), false);
  });

  test('um planeado de despesa põe dentro a mesma categoria no mesmo imóvel, e não noutro', () => {
    app.db.recurring.push(app.normRec({ name: 'Jardineiro', every: 'month', next: ANO + '-10-01',
      tx: { kind: 'expense', amount: 80, category: 'Manutenção e reparações', sub: '', propertyId: 'casa' } }));
    assert.equal(repete('Manutenção e reparações', 'Pequenas reparações'), true, 'o planeado sem sub apanha a categoria toda');
    assert.equal(repete('Manutenção e reparações', 'Pequenas reparações', { propertyId: 'casa2' }), false, 'noutro imóvel não');
    assert.equal(repete('Manutenção e reparações', '', { propertyId: null, groupId: 'G' }), false, 'num grupo não');
    assert.equal(repete('Obras e benfeitorias', 'Pintura'), false, 'outra categoria não');
    // com sub, só essa sub
    app.db.recurring = [app.normRec({ name: 'Pintura anual', every: 'year', next: ANO + '-10-01',
      tx: { kind: 'expense', amount: 500, category: 'Obras e benfeitorias', sub: 'Pintura', groupId: 'G' } })];
    assert.equal(repete('Obras e benfeitorias', 'Pintura', { propertyId: null, groupId: 'G' }), true);
    assert.equal(repete('Obras e benfeitorias', 'Janelas', { propertyId: null, groupId: 'G' }), false);
    // um planeado de receita não conta
    app.db.recurring = [app.normRec({ name: 'Renda', tx: { kind: 'income', amount: 500, category: 'Obras e benfeitorias', propertyId: 'casa' } })];
    assert.equal(repete('Obras e benfeitorias', 'Pintura'), false);
  });

  test('a escolha da pessoa manda sobre a regra de origem, a da sub antes da da categoria', () => {
    const e = app.db.settings.repete;
    e['Obras e benfeitorias'] = true;
    assert.equal(repete('Obras e benfeitorias', 'Pintura'), true, 'a categoria inteira passa a entrar');
    e['Obras e benfeitorias/Pintura'] = false;
    assert.equal(repete('Obras e benfeitorias', 'Pintura'), false, 'a sub da pessoa manda sobre a categoria da pessoa');
    assert.equal(repete('Obras e benfeitorias', 'Janelas'), true);
    e['Condomínio'] = false;
    assert.equal(repete('Condomínio', 'Quota mensal'), false, 'a categoria da pessoa manda sobre a sub de origem');
    e['Condomínio/Quota extraordinária'] = true;
    assert.equal(repete('Condomínio', 'Quota extraordinária'), true);
    assert.equal(repete('Obras e benfeitorias', 'Pintura', { tags: ['Recorrente'] }), true, 'a etiqueta continua a mandar');
  });
});

describe('a base das despesas (opBase)', () => {
  test('só as que se repetem entram no op; as outras vão para o fora, por categoria e do maior para o menor', () => {
    mov({ amount: 400, category: 'Impostos', sub: 'IMI' });
    mov({ amount: 900, category: 'Condomínio', sub: 'Quota mensal' });
    mov({ amount: 100, category: 'Impostos', sub: 'AIMI' });
    mov({ amount: 3000, category: 'Obras e benfeitorias', sub: 'Cozinha' });
    mov({ amount: 200, category: 'Manutenção e reparações', sub: 'Pragas' });
    mov({ amount: 50, category: 'Condomínio', sub: 'Quota extraordinária' });
    const b = app.opBase(null);
    perto(b.op, 1400);
    perto(b.fora, 3250);
    assert.equal(b.year, ANO - 1);
    assert.equal(b.anualizado, false);
    igual(b.porCat.map((x) => x.label), ['Condomínio', 'Impostos']);
    perto(b.porCat[0].value, 900); perto(b.porCat[1].value, 500);
    igual(b.foraPorCat.map((x) => x.label), ['Obras e benfeitorias', 'Manutenção e reparações', 'Condomínio']);
    perto(b.foraPorCat[2].value, 50);
  });

  test('o ano-base salta um ano que só teve obras', () => {
    mov({ amount: 700, category: 'Seguros', sub: 'Multirriscos', date: (ANO - 2) + '-05-01' });
    mov({ amount: 5000, category: 'Obras e benfeitorias', sub: 'Remodelação', date: (ANO - 1) + '-05-01' });
    const b = app.opBase(null);
    assert.equal(b.year, ANO - 2);
    perto(b.op, 700);
    perto(b.fora, 0, 0.001, 'o fora é o do mesmo ano-base');
  });

  test('sem ano completo com despesas que se repetem, anualiza o corrente; o fora não se anualiza', () => {
    mov({ amount: 5000, category: 'Obras e benfeitorias', date: (ANO - 1) + '-05-01' });
    mov({ amount: 300, category: 'Seguros', date: ANO + '-02-01' });
    mov({ amount: 900, category: 'Obras e benfeitorias', date: ANO + '-03-01' });
    const b = app.opBase(null);
    assert.equal(b.year, ANO);
    assert.equal(b.anualizado, true);
    perto(b.op, 300 * 12 / MES, 1e-6);
    perto(b.porCat[0].value, 300 * 12 / MES, 1e-6);
    perto(b.fora, 900, 0.001, 'uma obra paga uma vez não se multiplica');
  });

  test('com filtro de proprietário e num grupo, o peso é o das métricas', () => {
    mov({ amount: 1000, category: 'Seguros', propertyId: null, groupId: 'G' });      // 500 por casa
    mov({ amount: 600, category: 'Obras e benfeitorias', propertyId: 'casa' });
    app.ownerFilter = 'bruno';                                                          // metade da casa
    const b = app.opBase(null);
    perto(b.op, 250);
    perto(b.fora, 300);
    app.ownerFilter = '';
    perto(app.opBase('casa2').op, 500);
    perto(app.opBase('casa2').fora, 0, 0.001);
  });

  test('o metrics().op continua a somar as despesas todas', () => {
    mov({ amount: 400, category: 'Impostos', sub: 'IMI' });
    mov({ amount: 3000, category: 'Obras e benfeitorias', sub: 'Cozinha' });
    perto(app.metrics(ANO - 1, null, { share: true }).op, 3400);
    perto(app.metrics(ANO - 1, 'casa', {}).op, 3400);
    perto(app.opBase(null).op, 400);
  });

  test('uma despesa fora dos totais (botão €) não entra em nenhum dos dois', () => {
    mov({ amount: 400, category: 'Impostos', sub: 'IMI' });
    mov({ amount: 100, category: 'Seguros' });
    app.db.settings.exclude[app.excKey('cats', 'Seguros')] = true;
    const b = app.opBase(null);
    perto(b.op, 400);
    perto(b.fora, 0, 0.001);
  });
});

describe('as Projeções', () => {
  beforeEach(() => {
    app.db.contracts.push(app.normContract({ propertyId: 'casa', rent: 1000, active: true, increase: 0 }));
    app.db.settings.inflation = 2;
  });

  test('o projRows projeta só as despesas que se repetem, com a inflação', () => {
    mov({ amount: 1200, category: 'Condomínio', sub: 'Quota mensal' });
    mov({ amount: 8000, category: 'Obras e benfeitorias', sub: 'Remodelação' });
    const r = app.projRows(null);
    perto(r.rows[0].exp, 1200);
    perto(r.rows[1].exp, 1200 * 1.02, 0.001);
    perto(r.base.fora, 8000);
    perto(r.rows[0].cf, 12000 - 1200 - r.rows[0].loan, 0.001);
  });

  test('o cabeçalho diz quanto entra, de que ano e o que ficou de fora, com a porta; a coluna é «Despesas recorrentes»', () => {
    mov({ amount: 1200, category: 'Condomínio', sub: 'Quota mensal' });
    mov({ amount: 400, category: 'Impostos', sub: 'IMI' });
    mov({ amount: 8000, category: 'Obras e benfeitorias', sub: 'Remodelação' });
    const h = app.vProjections();
    assert.match(h, /Despesas que se repetem: <b>[^<]+\/ano<\/b> — as de 2025 \(Condomínio e Impostos\); crescem com a inflação\./);
    assert.match(h, /Ficam de fora <b>[^<]+<\/b> que não se repetem todos os anos \(Obras e benfeitorias\)\./);
    assert.match(h, /go\('settings'\);goSet\('repete'\)/);
    assert.match(h, /<th>Despesas recorrentes<\/th>/);
    assert.doesNotMatch(h, /<th>Despesas<\/th>/);
  });

  test('sem nenhuma despesa que se repita, o cabeçalho di-lo', () => {
    // sem nenhuma que se repita, o ano-base é o corrente: o fora é o dele
    mov({ amount: 8000, category: 'Obras e benfeitorias', date: ANO + '-02-01' });
    const h = app.vProjections();
    assert.match(h, /Ainda não há despesas que se repetem todos os anos .*a projeção não conta despesas\./);
    assert.match(h, /Ficam de fora/);
    assert.equal(app.projRows(null).rows[0].exp, 0);
    assert.match(app.WHY.cashflowFim, /só entram as que se repetem todos os anos/);
  });
});

describe('as definições', () => {
  test('o fillCats cria o settings.repete, e troca o que não é um objeto', () => {
    const st = {};
    app.fillCats(st);
    igual(st.repete, {});
    const st2 = { repete: 'lixo' };
    app.fillCats(st2);
    igual(st2.repete, {});
    const st3 = { repete: { Obras: true } };
    app.fillCats(st3);
    igual(st3.repete, { Obras: true }, 'as escolhas guardadas ficam');
  });

  test('o renameCat leva as chaves de repete e de exclude (e não as de outra categoria com «/» no nome)', () => {
    semEcra();
    const s = app.db.settings;
    s.cats['Obras e benfeitorias/Casa'] = [];
    s.repete['Obras e benfeitorias'] = true;
    s.repete['Obras e benfeitorias/Pintura'] = false;
    s.repete['Obras e benfeitorias/Casa'] = true;
    s.exclude['cats:Obras e benfeitorias'] = true;
    s.exclude['cats:Obras e benfeitorias/Janelas'] = true;
    s.irsMapa['Obras e benfeitorias / Cozinha'] = 'conservacao';
    app.renameCat('cats', 'Obras e benfeitorias', 'Obras');
    igual(Object.keys(s.repete).sort(), ['Obras', 'Obras e benfeitorias/Casa', 'Obras/Pintura']);
    assert.equal(s.repete['Obras e benfeitorias/Casa'], true, 'a outra categoria fica com a escolha dela');
    assert.equal(s.exclude['cats:Obras'], true);
    assert.equal(s.exclude['cats:Obras/Janelas'], true);
    assert.equal(s.exclude['cats:Obras e benfeitorias'], undefined, 'o renameCat perdia a exclusão');
    assert.equal(s.irsMapa['Obras / Cozinha'], 'conservacao');
    assert.equal(repete('Obras', 'Pintura'), false);
    assert.equal(repete('Obras', 'Janelas'), true);
    // o nome de uma que já existe não se aceita: fundia as duas
    app.renameCat('cats', 'Obras', 'Seguros');
    assert.ok(s.cats['Obras'] && s.cats['Seguros'].includes('Multirriscos'));
    assert.equal(s.repete['Obras'], true);
  });

  test('o renameSub leva a chave de repete; o delSub e o delCat tiram-nas', () => {
    semEcra();
    app.promptModal = (t, l, v, cb) => cb('Quota anual');
    app.confirmModal = (t, x, sim) => sim();
    const s = app.db.settings;
    s.repete['Condomínio/Quota mensal'] = false;
    s.exclude['cats:Condomínio/Quota mensal'] = true;
    app.renameSub('cats', 'Condomínio', 'Quota mensal');
    igual(s.repete, { 'Condomínio/Quota anual': false });
    assert.equal(s.exclude['cats:Condomínio/Quota anual'], true);
    assert.ok(s.cats['Condomínio'].includes('Quota anual'));
    app.delSub('cats', 'Condomínio', 'Quota anual');
    igual(s.repete, {});
    assert.equal(s.exclude['cats:Condomínio/Quota anual'], undefined);
    s.repete['Seguros'] = false;
    s.repete['Seguros/Multirriscos'] = true;
    s.repete['Seguros e afins'] = true;
    app.delCat('cats', 'Seguros');
    igual(s.repete, { 'Seguros e afins': true }, 'só as da categoria apagada saem');
    // nas receitas não há repete: renomear lá não lhe toca
    s.repete['Rendas'] = true;
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    assert.equal(s.repete['Rendas'], true);
  });

  test('a subpágina «repete» tem porta na raiz e desenha as categorias com o interruptor', () => {
    semEcra();
    app.setPage = '';
    assert.match(app.vSettings(), /goSet\('repete'\)/);
    assert.match(app.vSettings(), /Despesas que se repetem/);
    mov({ amount: 400, category: 'Impostos', sub: 'IMI' });
    app.setPage = 'repete';
    const h = app.vSettings();
    assert.match(h, /goSet\(''\)/, 'o Voltar');
    for (const k of Object.keys(app.cats())) assert.ok(h.includes('toggleRepete(\'' + app.jsq(k) + '\')'), 'o interruptor de ' + k);
    assert.match(h, /toggleRepete\('Condomínio','Quota extraordinária'\)/, 'e o de cada subcategoria');
    assert.match(h, /resetRepete\(\)/);
    assert.match(h, /Repor a regra de origem/);
    assert.match(h, /400\s€ em 2025/, 'quanto pesou no ano-base');
    assert.doesNotMatch(h, /onclick=/);
    // com as Projeções desligadas, a porta sai
    app.setPage = '';
    app.definirServicosDesligados(['projections']);
    assert.doesNotMatch(app.vSettings(), /goSet\('repete'\)/);
    app.definirServicosDesligados([]);
  });

  test('o toggleRepete guarda só o que difere e, de volta ao de origem, apaga a escolha', () => {
    semEcra();
    app.confirmModal = (t, x, sim) => sim();
    const s = app.db.settings;
    app.toggleRepete('Condomínio');
    igual(s.repete, { 'Condomínio': false });
    assert.equal(repete('Condomínio', 'Quota mensal'), false);
    app.toggleRepete('Condomínio', 'Fundo de reserva');
    igual(s.repete, { 'Condomínio': false, 'Condomínio/Fundo de reserva': true });
    app.toggleRepete('Condomínio');
    igual(s.repete, {}, 'a categoria leva as subs e volta à regra de origem');
    assert.equal(repete('Condomínio', 'Quota extraordinária'), false, 'a Quota extraordinária fica de fora outra vez');
    app.toggleRepete('Obras e benfeitorias', 'Pintura');
    igual(s.repete, { 'Obras e benfeitorias/Pintura': true });
    app.toggleRepete('Obras e benfeitorias', 'Pintura');
    igual(s.repete, {});
    app.toggleRepete('Seguros');
    app.resetRepete();
    igual(s.repete, {}, 'Repor a regra de origem');
  });
});
