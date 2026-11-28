// O contrato e as rendas planeadas como o Martinho os testa (2026-11-27):
// o «Escrever outra taxa» com a forma de botão e o imposto aberto no lugar
// dele, sem a dica por cima do campo (KAN-169); a isenção que as datas abrem
// dita por baixo da particularidade fiscal, também no contrato de 1985
// (KAN-126-10); a comunicação da duração à cabeça do «Perante a AT»
// (KAN-127-18); o encargo a cargo do inquilino a suspender o planeado — fora
// da lista e do «Por confirmar», e de volta ao desligar (KAN-129-3); e o resto
// de uma renda paga em parte em dívida, com o valor dele, ao lado das outras
// em falta (KAN-129-4).
//
// O dia da app é fixo (2026-11-27).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-27' });
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));
/* Os espaços duros dos euros (euro2) como espaços, para os comparar com o texto. */
const N = (s) => String(s).replace(/[\u00a0\u202f]/g, ' ');

/* Um imóvel de um dono, uma inquilina e um contrato declarado de habitação
   permanente de 800 €.
   Recebe: extra (opcional) — campos do contrato (o fisco junta-se ao de
   omissão); imovel (opcional) — campos do imóvel.
   Devolve: o contrato guardado em db.contracts. */
function monta(extra, imovel) {
  limpar(app);
  const e = Object.assign({}, extra || {});
  const fisco = Object.assign({ estado: 'declarado', finalidade: 'hp', numero: '1234567' }, e.fisco || {});
  delete e.fisco;
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana', nif: '123456789' })];
  app.db.properties = [app.normProp(Object.assign({ id: 'P1', name: 'T2 Olivais', use: 'investimento', ownerIds: ['O1'],
    freguesiaCodigo: '110659', tipoPredio: 'U', matrix: '4651', fraction: 'A', purchaseDate: '2019-05-06' }, imovel || {}))];
  app.db.contracts = [app.normContract(Object.assign({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'], rent: 800, payDay: 1,
    start: '2026-02-01', fisco }, e))];
  app.db.transactions = [];
  app.db.recurring = [];
  app.foldState = {};
  app._ctAbertas = {};
  return app.db.contracts[0];
}
/* O formulário aberto sobre o contrato C1 (uma cópia, como o ctModal faz). */
const abre = () => { app.cForm = app.normContract(copia(app.contract('C1'))); };
/* Uma renda do contrato C1 num mês.
   Recebe: mes — 'AAAA-MM'; valor; parcial (opcional). */
const renda = (mes, valor, parcial) => app.db.transactions.push(app.normTx({ kind: 'income', label: 'Renda', amount: valor, date: mes + '-01',
  propertyId: 'P1', contractId: 'C1', category: 'Rendas', sub: 'Renda mensal', periodo: mes, parcial: !!parcial }));

describe('KAN-169 · «Escrever outra taxa»', () => {
  test('é um botão com contorno (não o fantasma) por baixo da renda líquida, e o imposto abre no lugar dele', () => {
    monta();
    abre();
    const h = app.ctBody();
    const net = h.indexOf('id="netBox"'), botao = h.indexOf('id="c_taxOutraBox"'), caixa = h.indexOf('id="c_taxBox"');
    assert.ok(net > -1 && net < botao && botao < caixa, 'a renda líquida, o botão e o campo, por esta ordem');
    assert.match(h, /<button type="button" class="btn sm ct-abre" data-toca="rascunho" data-click="ctTaxaOutra\(\)">Escrever outra taxa<\/button>/);
    assert.doesNotMatch(h, /class="btn sm ghost"[^>]*ctTaxaOutra/, 'o fantasma lia-se como texto solto');
  });

  test('o campo e a dica vão dentro de um .form (a margem negativa da dica conta com o espaço da grelha)', () => {
    monta();
    abre();
    const h = app.ctBody();
    assert.match(h, /<div id="c_taxBox" hidden><div class="form">\s*<label>Imposto sobre a renda \(%, opcional\)<input id="c_tax"/);
    assert.match(h, /<div class="hint ct-colado" id="c_taxDica">/);
  });

  test('«Outro encargo» tem a mesma forma', () => {
    monta({}, { condominio: 50 });
    abre();
    assert.match(app.ctBody(), /class="btn sm ct-abre" data-toca="rascunho" data-click="ctEncargosOutros\(\)">Outro encargo</);
  });
});

describe('KAN-126-10 · a isenção que as datas abrem', () => {
  test('no contrato de 1985 (renda antiga) a frase por baixo da particularidade fiscal diz a do 6H, e a lista oferece-a', () => {
    monta({ start: '1985-06-01', rent: 215, fisco: { celebracao: '1985-05-15', atualizacao2023: 'nao' } });
    abre();
    assert.equal(app.ctParticularidadeCaso(app.cForm), 'Pelas datas, este contrato pode ter a isenção do quadro 6H, renda antiga (anterior ao RAU). Escolhe-a em «Isenção de IRS», se se aplicar.');
    const h = app.fiscoSect();
    assert.match(h, /<div class="hint ct-colado ct-caso" id="c_fpartCaso">Pelas datas, este contrato pode ter a isenção do quadro 6H/);
    const ops = app.ctIsencoesOferecidas(app.cForm).map((o) => o.v);
    assert.ok(ops.includes('prerau') && !ops.includes('al'), ops.join(','));
  });

  test('no de 2024 (ex-alojamento local) diz a do 6F; no de 2025, nada', () => {
    monta({ start: '2024-03-01', fisco: { celebracao: '2024-02-20' } });
    abre();
    assert.match(app.ctParticularidadeCaso(app.cForm), /isenção do quadro 6F, ex-alojamento local\./);
    monta({ start: '2025-04-01', fisco: { celebracao: '2025-03-20' } });
    abre();
    assert.equal(app.ctParticularidadeCaso(app.cForm), '');
    assert.match(app.fiscoSect(), /id="c_fpartCaso" hidden>/);
  });

  test('com uma isenção já escolhida, a frase cala-se', () => {
    monta({ start: '1985-06-01', fisco: { celebracao: '1985-05-15', isencao: 'prerau', nrau3536: true } });
    abre();
    assert.equal(app.ctParticularidadeCaso(app.cForm), '');
  });

  test('escolhida a do 6H com o «Sim» da pergunta, o motor leva-a ao quadro 6H', () => {
    const c = monta({ start: '1985-06-01', fisco: { celebracao: '1985-05-15', isencao: 'prerau', nrau3536: true } });
    const x = app.irsTaxa(c, 2026);
    assert.equal(x.motivo, 'isento');
    assert.equal(x.isencao.quadro, '6H');
  });
});

describe('KAN-127-18 · a comunicação da duração à vista', () => {
  test('à cabeça do «Perante a AT», por marcar, com o botão; marcada, «feita»', () => {
    const c = monta({ start: '2026-02-01', end: '2031-01-31', fisco: { celebracao: '2026-01-22', rendaAcimaDoLimite: false } });
    let h = app.ctAtDaFicha(c);
    const corpo = h.indexOf('class="ct-sec-corpo"'), bloco = h.indexOf('class="ct-com"'), num = h.indexOf('N.º do contrato');
    assert.ok(corpo > -1 && bloco > corpo && bloco < num, 'o bloco vem antes do n.º do contrato');
    assert.match(h, /<p class="ct-com-tit">Comunicação da duração às Finanças · <span>por marcar<\/span><\/p>/);
    assert.match(h, /data-click="ctComunicadaPergunta\('C1',2026\)">Marcar como comunicada<\/button>/);
    assert.match(h, /A duração do contrato está por comunicar no Portal das Finanças: até 15\/02\/2027\./, 'a frase de sempre continua');
    c.fisco.comunicacoes = { 2026: '2026-03-02' };
    c.fisco.comunicacoesV = 2;
    h = app.ctAtDaFicha(c);
    assert.match(h, /class="ct-com ct-com-feita"[^>]*><p class="ct-com-tit">Comunicação da duração às Finanças · <span>feita<\/span>/);
  });

  test('sem redução pela duração, não há bloco', () => {
    const c = monta({ start: '2026-02-01', end: '2027-01-31' });
    assert.doesNotMatch(app.ctAtDaFicha(c), /ct-com/);
  });
});

describe('KAN-129-3 · o encargo do inquilino suspende o planeado', () => {
  /* o contrato C1 em vigor e um planeado do condomínio feito à mão, com a quota deste mês por confirmar */
  function comCondominio() {
    const c = monta({ start: '2025-04-01' });
    app.db.recurring = [app.normRec({ id: 'R1', name: 'Condomínio · T2 Olivais', every: 'month', next: '2026-11-01',
      tx: { kind: 'expense', label: 'Quota do condomínio', amount: 45, propertyId: 'P1', category: 'Condomínio', sub: 'Quota mensal' } })];
    return c;
  }
  const r1 = () => app.db.recurring.find((r) => r.id === 'R1');
  const titulos = (h) => [...h.matchAll(/data-lp="rec:(\w+)"/g)].map((m) => m[1]);

  test('marcado o condomínio, o planeado sai do «Por confirmar» e da lista, e fica em «Suspensos»', () => {
    const c = comCondominio();
    assert.ok(app.recPending().some((r) => r.id === 'R1'), 'antes, por confirmar');
    c.encargosInquilino = ['condominio'];
    app.syncContractRec(c);
    assert.equal(r1().next, '2026-12-01', 'a quota de novembro passou à frente');
    assert.equal(r1().saltadoDesde, '2026-11-01', 'e o primeiro dia saltado fica guardado');
    assert.ok(app.recSuspenso(r1()), 'suspenso');
    assert.ok(!app.recPending().some((r) => r.id === 'R1'));
    const h = app.vRecurring();
    const susp = h.indexOf('id="planSuspensos"');
    assert.ok(susp > -1, 'há a secção dos suspensos');
    assert.ok(!titulos(h.slice(0, susp)).includes('R1'), 'fora da lista');
    assert.ok(titulos(h.slice(susp)).includes('R1'), 'nos suspensos');
    assert.match(h.slice(susp), /A cargo do inquilino \(Ana · T2\) enquanto o contrato estiver em vigor/);
    assert.match(h.slice(susp), /<span class="badge grey">Suspenso<\/span>/);
  });

  test('desligado o encargo, volta à lista e ao «Por confirmar», com a quota deste mês', () => {
    const c = comCondominio();
    c.encargosInquilino = ['condominio'];
    app.syncContractRec(c);
    c.encargosInquilino = [];
    app.syncContractRec(c);
    assert.equal(r1().next, '2026-11-01', 'a quota de novembro volta');
    assert.equal(r1().saltadoDesde, undefined);
    assert.ok(app.recPending().some((r) => r.id === 'R1'));
    const h = app.vRecurring();
    assert.ok(!h.includes('id="planSuspensos"'));
    assert.ok(titulos(h).includes('R1'));
  });

  test('um mês já registado à mão não volta a pedir-se', () => {
    const c = comCondominio();
    c.encargosInquilino = ['condominio'];
    app.syncContractRec(c);
    app.db.transactions.push(app.normTx({ kind: 'expense', label: 'Quota do condomínio', amount: 45, date: '2026-11-03', propertyId: 'P1', category: 'Condomínio', sub: 'Quota mensal' }));
    c.encargosInquilino = [];
    app.syncContractRec(c);
    assert.equal(r1().next, '2026-12-01');
  });

  test('o «Em dia» não conta os suspensos', () => {
    const c = comCondominio();
    c.encargosInquilino = ['condominio'];
    app.syncContractRec(c);
    app.lf('lrec').st = 'ok';
    assert.ok(!titulos(app.vRecurring()).includes('R1'));
    app.lf('lrec').st = '';
  });
});

describe('KAN-129-4 · o resto da renda paga em parte, em dívida', () => {
  /* rendas de fevereiro a agosto inteiras, setembro paga com 500 €, outubro e novembro por pagar */
  function comParcial() {
    const c = monta();
    for (let m = 2; m <= 8; m++) renda('2026-' + String(m).padStart(2, '0'), 800);
    renda('2026-09', 500, true);
    app.syncAllContractRecs();
    return c;
  }

  test('o planeado fica na renda de setembro, e a linha por confirmar diz o resto em dívida (300 €, não 800 €)', () => {
    const c = comParcial(), r = app.ctRecOf(c);
    assert.equal(r.next, '2026-09-01');
    const d = app.recEmDivida(r);
    assert.deepEqual(JSON.parse(JSON.stringify(d)), { amount: 300, retencao: 0, renda: 800, pago: 500, mes: '2026-09' });
    const l = N(app.pendLinha(r));
    assert.match(l, /Em dívida: 300,00 € da renda de setembro \(pagos 500,00 € de 800,00 €\)/);
    assert.match(l, /<div class="plan-valor">[^]*300,00[^]*<\/div>/);
    assert.doesNotMatch(l.slice(l.indexOf('plan-valor')), /800,00/);
    assert.equal(app.pendTotal([r]), 300);
    assert.equal(app.recMontanteAPedir(r), 300);
  });

  test('as rendas por receber, cada uma com o seu valor, e o resto com «em dívida»', () => {
    const c = comParcial();
    const xs = JSON.parse(JSON.stringify(app.ctRendasEmDivida(c)));
    assert.deepEqual(xs, [
      { mes: '2026-09', valor: 300, divida: true, nome: 'setembro' },
      { mes: '2026-10', valor: 800, divida: false, nome: 'outubro' },
      { mes: '2026-11', valor: 800, divida: false, nome: 'novembro' }]);
    const h = N(app.ctValoresDaFicha(c));
    assert.match(h, /<span>Rendas por receber<\/span><b><span class="ct-dividas"><span>setembro · 300,00 € em dívida<\/span><span>outubro · 800,00 €<\/span><span>novembro · 800,00 €<\/span><\/span><\/b>/);
  });

  test('a renda completada sai das por receber', () => {
    const c = comParcial();
    renda('2026-09', 300);
    assert.deepEqual(copia(app.ctRendasEmDivida(c).map((x) => x.mes)), ['2026-10', '2026-11']);
  });

  test('sem pagamentos em parte, uma só em falta não enche a ficha', () => {
    const c = monta();
    for (let m = 2; m <= 10; m++) renda('2026-' + String(m).padStart(2, '0'), 800);
    app.syncAllContractRecs();
    assert.equal(app.ctRendasEmDivida(c).length, 1);
    assert.doesNotMatch(app.ctValoresDaFicha(c), /Rendas por receber/);
  });
});
