// O motor do IRS e as versões depois da ronda 2 das correções da auditoria de
// raiz (KAN-151, V5): a renovação que atravessa a mudança de regime a 13 %
// (D1, OC 20268/2024), o regime do contrato pela data de celebração (N086), o
// teste dos 2 300 € das rendas moderadas pelos meses decorridos e pelo que se
// recebeu (D2, N013), os quartos da mesma fração (N054), a taxa das regras do
// ano da Declaração para o período de uma renda de outro ano (N014), o prazo
// mínimo do RSAA (N088), os 5 % do 6A só depois da conclusão (N091), as
// isenções com a data de baixo (N150, N156), o mínimo da retenção (N148), os
// contratos sem estimativa fora da Declaração (N052), as Projeções com a renda
// projetada (N121) e a taxa do quadro 5 na ficha de um subarrendado (N053).
//
// Duas apps: uma a viver a 1 de fevereiro de 2027 (o ano de 2026 já todo
// decorrido, como na entrega), outra a 23 de novembro de 2026 (as Projeções).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, igual, perto } from './arnes.js';

const app = carregarApp({ hoje: '2027-02-01' });
const hoje = carregarApp({ hoje: '2026-11-23' });
afterEach(() => repor(app));
afterEach(() => repor(hoje));

const copia = (x) => JSON.parse(JSON.stringify(x));

beforeEach(() => {
  for (const a of [app, hoje]) {
    limpar(a);
    a.db.owners.push(a.normPerson({ id: 'eu', name: 'Eu' }));
    a.db.tenants.push(a.normPerson({ id: 't1', name: 'Ana', nif: '123456789' }), a.normPerson({ id: 'emp', name: 'Empresa, Lda.', nif: '500000000' }));
    a.db.properties.push(a.normProp({ id: 'P1', name: 'T2', ownerIds: ['eu'], freguesiaCodigo: '110658', tipoPredio: 'U', matrix: '1', purchaseDate: '2010-01-01' }));
  }
});

/* Um contrato na base: o bloco fiscal passa pelo normContract e os campos de
   `fisco` escrevem-se por cima depois, tal e qual.
   Recebe: extra — campos do contrato; fisco (opcional) — campos do bloco
   fiscal; a (opcional) — a app.
   Devolve: o contrato (fica em db.contracts). */
function ct(extra, fisco, a) {
  const x = a || app;
  const c = x.normContract(Object.assign({ id: 'C1', name: 'T2', propertyId: 'P1', tenantIds: ['t1'], rent: 1000, active: true,
    fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } }, extra || {}));
  Object.assign(c.fisco, fisco || {});
  x.db.contracts.push(c);
  return c;
}
const renov = (pares) => pares.map(([inicio, fim], i) => ({ id: 'R' + i, inicio, fim }));
/* Uma renda de um contrato em db.transactions.
   Recebe: cid; date; valor; extra (opcional) — periodo, retencao…; a (opcional) — a app.
   Devolve: nada. */
function renda(cid, date, valor, extra, a) {
  const x = a || app;
  x.db.transactions.push(x.normTx(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, date,
    propertyId: (x.contract(cid) || {}).propertyId || 'P1', contractId: cid }, extra || {})));
}
const mm = (n) => String(n).padStart(2, '0');

describe('N028 · D1: a renovação que atravessa a mudança de regime paga 13 % (OC 20268/2024, ponto 8)', () => {
  test('o exemplo do ofício: 5 anos de 2019 renovado em 2024 por 5 → 23 % e 13 %; renovado outra vez → 11 %', () => {
    const c = ct({ start: '2019-02-01', end: '2034-01-31', rent: 1200 }, { renovacoes: renov([['2024-02-01', '2029-01-31'], ['2029-02-01', '2034-01-31']]) });
    igual(copia(app.irsCadeia(c, 2025)).map((p) => [p.taxa, p.abInitio]), [[23, false], [13, true], [11, false]]);
    const t = copia(app.irsTaxa(c, 2025));
    assert.equal(t.taxa, 13); assert.equal(t.motivo, 'duracao');
    perto(14400 * t.taxa / 100, 1872, 0.001, 'o imposto do cenário: 14 400 € a 13 %');
  });

  test('a renovação a meio do ano: 23 % até maio e 13 % desde junho', () => {
    const c = ct({ start: '2020-06-01', end: '2030-05-31', rent: 2500 }, { renovacoes: renov([['2025-06-01', '2030-05-31']]) });
    igual(copia(app.irsSegmentosDoAno(c, 2025)).map((s) => [s.de, s.taxa]), [['2025-01-01', 23], ['2025-06-01', 13]]);
  });

  test('vinda de um período sem redução (26 % de um contrato de 3 anos), o ofício não decide: fica nos 15 %', () => {
    const c = ct({ start: '2021-01-01', end: '2028-12-31', rent: 2500 }, { renovacoes: renov([['2024-01-01', '2028-12-31']]) });
    const k = copia(app.irsCadeia(c, 2025));
    assert.equal(k[0].taxa, 26); assert.equal(k[1].taxa, 15); assert.equal(k[1].abInitio, false);
  });

  test('a taxa escrita de 13 % deixa de diferir da lei', () => {
    const c = ct({ start: '2019-02-01', end: '2029-01-31', rent: 2500, taxRate: 13 }, { renovacoes: renov([['2024-02-01', '2029-01-31']]) });
    assert.equal(app.irsRate(c, 2026), 13);
  });
});

describe('N086 · o regime do contrato escolhe-se pela data de celebração', () => {
  test('celebrado a 20/09/2023 e começado a 1/11/2023: regime de 2019 (23 %); celebrado a 7/10/2023: 15 %', () => {
    const c = ct({ start: '2023-11-01', end: '2028-10-31', rent: 2500 }, { celebracao: '2023-09-20' });
    assert.equal(app.irsCadeia(c, 2025)[0].taxa, 23);
    assert.equal(app.irsTaxa(c, 2025).taxa, 23);
    c.fisco.celebracao = '2023-10-07';
    assert.equal(app.irsTaxa(c, 2025).taxa, 15);
    c.fisco.celebracao = '';
    assert.equal(app.irsTaxa(c, 2025).taxa, 15, 'sem a celebração, o início');
  });

  test('celebrado em dezembro de 2018 e começado em 2019 (10 anos): sem redução, no 4.1', () => {
    const c = ct({ start: '2019-01-01', end: '2028-12-31', rent: 2500 }, { celebracao: '2018-12-10' });
    assert.equal(app.irsReducao(c, 2025), null);
    assert.equal(app.irsTaxa(c, 2025).taxa, 25);
  });

  test('nas renovações conta o dia em que cada uma começa', () => {
    const c = ct({ start: '2023-11-01', end: '2033-10-31', rent: 2500 }, { celebracao: '2023-09-20', renovacoes: renov([['2028-11-01', '2033-10-31']]) });
    igual(copia(app.irsCadeia(c, 2029)).map((p) => [p.taxa, p.abInitio]), [[23, false], [13, true]]);
  });
});

describe('N013 · D2: os 2 300 € testam-se com o que entrou a dividir pelos meses decorridos', () => {
  const contrato = (rent, extra) => ct(Object.assign({ start: '2025-01-01', end: '2027-12-31', rent }, extra || {}));

  test('janeiro e fevereiro num movimento: 26 400 € ÷ 12 = 2 200 € → 10 %', () => {
    const c = contrato(2200);
    renda('C1', '2026-02-05', 4400);
    for (let m = 3; m <= 12; m++) renda('C1', '2026-' + mm(m) + '-05', 2200);
    assert.equal(app.irsRendaMensalDoTeste(c, 2026), 2200);
    const t = copia(app.irsTaxa(c, 2026));
    assert.equal(t.taxa, 10); assert.equal(t.motivo, 'moderada');
    const x = copia(app.irsTesteModerada(c, 2026));
    assert.equal(x.meses, 12); assert.equal(x.recebido, 26400); assert.equal(x.difere, false);
    igual(x.variosMeses, [{ mes: '2026-02', valor: 4400, n: 1 }], 'o pagamento de dois meses, para o aviso não mandar registar «as outras»');
  });

  test('800 € pagos ao trimestre: 9 600 € ÷ 12 = 800 € → 10 %', () => {
    const c = contrato(800);
    for (const m of [1, 4, 7, 10]) renda('C1', '2026-' + mm(m) + '-05', 2400);
    assert.equal(app.irsRendaMensalDoTeste(c, 2026), 800);
    assert.equal(app.irsTaxa(c, 2026).taxa, 10);
    assert.equal(copia(app.irsTesteModerada(c, 2026)).variosMeses.length, 4);
  });

  test('2 500 € no contrato e doze pagamentos de 2 000 €: 10 % pelo que entrou, e o teste diz que difere', () => {
    const c = contrato(2500);
    for (let m = 1; m <= 12; m++) renda('C1', '2026-' + mm(m) + '-05', 2000);
    const x = copia(app.irsTesteModerada(c, 2026));
    assert.equal(x.renda, 2000); assert.equal(x.cabe, true); assert.equal(x.cabeContrato, false); assert.equal(x.difere, true);
    assert.equal(app.irsTaxa(c, 2026).motivo, 'moderada');
  });

  test('1 500 € a começar em outubro com 4 500 € na assinatura: 7 500 € ÷ 3 = 2 500 € → base, e difere', () => {
    const c = ct({ start: '2026-10-01', end: '2028-09-30', rent: 1500 });
    renda('C1', '2026-10-01', 4500); renda('C1', '2026-11-05', 1500); renda('C1', '2026-12-05', 1500);
    const x = copia(app.irsTesteModerada(c, 2026));
    assert.equal(x.meses, 3); assert.equal(x.renda, 2500); assert.equal(x.difere, true);
    assert.equal(app.irsTaxa(c, 2026).taxa, 25);
  });

  test('sem meses no ano (acabou antes, ou ainda não começou) nem rendas: a renda do contrato, sem dividir por zero', () => {
    const acabou = ct({ id: 'C2', start: '2024-01-01', end: '2025-12-31', rent: 1000, active: false }, { cessacao: { data: '2025-12-31', motivo: '03' } });
    assert.equal(app.irsRendaMensalDoTeste(acabou, 2026), 1000);
    const futuro = ct({ id: 'C3', start: '2028-01-01', end: '2030-12-31', rent: 1100 });
    assert.equal(app.irsRendaMensalDoTeste(futuro, 2026), 1100);
    assert.equal(app.irsTesteModerada(ct({ id: 'C4', start: '2024-01-01', end: '', rent: 900 }, { finalidade: 'nh' }), 2026), null, 'o não habitacional não tem teste');
    assert.equal(app.irsTesteModerada(acabou, 2025), null, '2025 não tem rendas moderadas');
  });
});

describe('N054 · D2 c): quartos da mesma fração que juntos passam o limite', () => {
  test('quatro quartos de 700 € (2 800 € pela fração): cada um a 10 %, e a marca para o aviso', () => {
    app.prop('P1').rentalMode = 'quartos';
    const cs = [1, 2, 3, 4].map((k) => ct({ id: 'Q' + k, start: '2025-09-01', end: '2027-08-31', rent: 700 }));
    cs.forEach((c) => { for (let m = 1; m <= 12; m++) renda(c.id, '2026-' + mm(m) + '-05', 700); });
    cs.forEach((c) => assert.equal(app.irsTaxa(c, 2026).taxa, 10, c.id));
    const f = copia(app.irsModeradaPorFracao('P1', 2026));
    assert.equal(f.soma, 2800); assert.equal(f.mes, '2026-01'); assert.equal(f.limite, 2300);
    igual(f.contratos.map((x) => x.id).sort(), ['Q1', 'Q2', 'Q3', 'Q4']);
  });

  test('três quartos de 700 € (2 100 €) e contratos em meses diferentes: nada', () => {
    [1, 2, 3].forEach((k) => ct({ id: 'Q' + k, start: '2025-09-01', end: '2027-08-31', rent: 700 }));
    assert.equal(app.irsModeradaPorFracao('P1', 2026), null);
    limpar(app);
    app.db.properties.push(app.normProp({ id: 'P1', name: 'T2', ownerIds: ['eu'] }));
    ct({ id: 'A', start: '2026-01-01', end: '2026-06-30', rent: 2000, active: false }, { cessacao: { data: '2026-06-30', motivo: '03' } });
    ct({ id: 'B', start: '2026-07-01', end: '2028-06-30', rent: 2000 });
    assert.equal(app.irsModeradaPorFracao('P1', 2026), null, 'um a seguir ao outro não é ao mesmo tempo');
  });
});

describe('N014 · a taxa das regras do ano da Declaração para o período de uma renda de outro ano', () => {
  test('as rendas de 2025 recebidas em 2026 de um contrato que acabou: as regras de 2026 (10 %) no período delas', () => {
    const c = ct({ start: '2024-01-01', end: '2025-12-31', rent: 1000, active: false }, { cessacao: { data: '2025-12-31', motivo: '03' } });
    const t = { date: '2026-01-15', periodo: '2025-12' };
    const s = app.irsTaxaDaRenda(c, t);
    assert.equal(s.periodo, 0);
    const x = copia(app.irsTaxaDoPeriodo(c, 2026, s.periodo));
    assert.equal(x.taxa, 10); assert.equal(x.motivo, 'moderada');
  });

  test('a renda de janeiro de 2026 recebida em dezembro de 2025: as regras de 2025 nunca dão «moderada»', () => {
    const c = ct({ start: '2026-01-01', end: '2028-12-31', rent: 1000 });
    const s = app.irsTaxaDaRenda(c, { date: '2025-12-15', periodo: '2026-01' });
    const x = copia(app.irsTaxaDoPeriodo(c, 2025, s.periodo));
    assert.notEqual(x.motivo, 'moderada'); assert.equal(x.taxa, 25);
  });
});

describe('N088 · o RSAA confere o prazo mínimo do contrato', () => {
  const rsaa = (extra, fisco) => ct(Object.assign({ start: '2026-10-01', rent: 900 }, extra), Object.assign({ isencao: 'rsaa', celebracao: '2026-10-01', ihru: '2026-11-02' }, fisco || {}));

  test('habitação permanente de um ano: a isenção não conta, e o motivo diz os três anos', () => {
    const c = rsaa({ end: '2027-09-30' });
    assert.equal(app.irsIsencao(c, 2026), null);
    assert.match(app.irsIsencaoMotivo(c, 2026), /pelo menos 3 anos na habitação permanente, e este tem 12 meses/);
    assert.equal(app.irsTaxa(c, 2026).taxa, 10, 'paga como as outras (moderada)');
  });

  test('três anos, sem termo, ou três meses na residência temporária: conta', () => {
    assert.equal(app.irsIsencao(rsaa({ end: '2029-09-30' }), 2026).id, 'rsaa');
    assert.equal(app.irsIsencao(rsaa({ id: 'C2', end: '' }), 2026).id, 'rsaa', 'sem termo não chumba');
    assert.equal(app.irsIsencao(rsaa({ id: 'C3', end: '2026-12-31' }, { finalidade: 'hnp' }), 2026).id, 'rsaa');
    const curto = rsaa({ id: 'C4', end: '2026-11-30' }, { finalidade: 'hnp' });
    assert.equal(app.irsIsencao(curto, 2026), null);
    assert.match(app.irsIsencaoMotivo(curto, 2026), /pelo menos 3 meses na residência temporária/);
  });
});

describe('N091 · o 6A só dá os 5 % nas rendas dos meses depois da conclusão', () => {
  const reab = (conclusao) => {
    app.prop('P1').reabilitacao = { tipo: 'aru', inicio: '2023-09-01', conclusao, certificado: true };
    return ct({ start: '2022-01-01', end: '2027-12-31', rent: 1000 });
  };

  test('concluída a 15/07/2026: até julho a taxa do contrato, desde agosto 5 %; uma linha só', () => {
    const c = reab('2026-07-15');
    igual(copia(app.irsSegmentosDoAno(c, 2026)).map((s) => [s.de, s.ate, s.taxa, s.motivo]),
      [['2026-01-01', '2026-07-31', 10, 'moderada'], ['2026-08-01', '2026-12-31', 5, 'reabilitacao']]);
    const b = copia(app.irsBeneficiosAvaliados(c, 2026)).find((x) => x.beneficio.quadro === '6A');
    assert.equal(b.aplica, true); assert.equal(b.conclusao, '2026-07-15'); assert.equal(b.desde, '2026-08-01');
    igual(copia(app.irsSegmentosDoAno(c, 2027)).map((s) => s.taxa), [5], 'no ano seguinte, o ano inteiro');
    assert.equal(copia(app.irsBeneficiosAvaliados(c, 2027)).find((x) => x.beneficio.quadro === '6A').desde, undefined);
  });

  test('concluída a 20/12/2026: nada a 5 % em 2026, e o motivo diz quando começa', () => {
    const c = reab('2026-12-20');
    assert.ok(!app.irsSegmentosDoAno(c, 2026).some((s) => s.motivo === 'reabilitacao'));
    const b = copia(app.irsBeneficiosAvaliados(c, 2026)).find((x) => x.beneficio.quadro === '6A');
    assert.equal(b.aplica, false); assert.match(b.motivo, /começam nas rendas de janeiro de 2027/);
    assert.equal(app.irsTaxaDaRenda(c, { date: '2026-03-05' }).taxa, 10);
  });

  test('concluída a 1 de um mês: os 5 % desde esse mês', () => {
    assert.equal(app.irsInicioDaReabilitacao('2026-07-01'), '2026-07-01');
    assert.equal(app.irsInicioDaReabilitacao('2026-12-02'), '2027-01-01');
    assert.equal(app.irsInicioDaReabilitacao('x'), '');
  });
});

describe('N150 · N156 · as isenções com a data a partir da qual existem', () => {
  test('PAA num contrato de 2018: não conta', () => {
    const c = ct({ start: '2018-03-01', end: '2028-02-29' }, { isencao: 'paa' });
    assert.equal(app.irsIsencao(c, 2025), null);
    assert.match(app.irsIsencaoMotivo(c, 2026), /desde 01\/07\/2019/);
    assert.equal(app.irsIsencao(ct({ id: 'C2', start: '2019-09-01', end: '2029-08-31' }, { isencao: 'paa' }), 2025).id, 'paa');
  });

  test('ex-alojamento local celebrado em 2021 ou 2022 com «Sim»: não conta; em 2023, conta', () => {
    for (const cel of ['2021-06-01', '2022-09-01']) {
      const c = ct({ id: 'AL' + cel, start: cel, end: '2031-12-31' }, { isencao: 'al', alRegistado2022: true, celebracao: cel });
      assert.equal(app.irsIsencao(c, 2026), null, cel);
    }
    assert.equal(app.irsIsencao(ct({ id: 'OK', start: '2023-05-01', end: '2033-04-30' }, { isencao: 'al', alRegistado2022: true }), 2026).id, 'al');
    assert.match(app.irsAno(2026).isencoes.find((x) => x.id === 'al').texto, /registado e afeto a esse fim a 31 de dezembro de 2022/);
  });

  test('renda antiga: com a celebração escrita depois de 1990 não conta; com só o início depois, conta e avisa', () => {
    const cel = ct({ start: '1995-01-01', end: '' }, { isencao: 'prerau', nrau3536: true, celebracao: '1995-01-01' });
    assert.equal(app.irsIsencao(cel, 2026), null);
    assert.match(app.irsIsencaoMotivo(cel, 2026), /até 31\/12\/1990/);
    const herdado = ct({ id: 'H', start: '1995-01-01', end: '' }, { isencao: 'prerau', nrau3536: true });
    assert.equal(app.irsIsencao(herdado, 2026).id, 'prerau');
    assert.match(app.irsIsencaoAviso(herdado, 2026), /escreve a data de celebração/);
    const antigo = ct({ id: 'V', start: '1995-01-01', end: '' }, { isencao: 'prerau', nrau3536: true, celebracao: '1985-03-01' });
    assert.equal(app.irsIsencao(antigo, 2026).id, 'prerau'); assert.equal(app.irsIsencaoAviso(antigo, 2026), '');
  });
});

describe('N148 · o mínimo da retenção (25 € por retenção) nas versões', () => {
  test('2025 desde 1 de julho, 2026 o ano inteiro; os 10 % desde a entrada em vigor do DL 97/2026', () => {
    const r25 = copia(app.irsAno(2025).retencao), r26 = copia(app.irsAno(2026).retencao);
    assert.equal(r25.minimo, 25); assert.equal(r25.minimoDesde, '2025-07-01');
    assert.equal(r26.minimo, 25); assert.equal(r26.minimoDesde, ''); assert.equal(r26.moderadaDesde, '2026-05-25');
  });

  test('uma garagem de 80 € arrendada a uma empresa sem retenção: dispensada (20 € < 25 €)', () => {
    const c = ct({ start: '2025-01-01', end: '2027-12-31', rent: 80, tenantIds: ['emp'] }, { finalidade: 'nh' });
    for (let m = 1; m <= 12; m++) renda('C1', '2026-' + mm(m) + '-05', 80);
    assert.equal(app.fiscoAvAnaliseDasRendas(c, 2026).dispensada, true);
  });
});

describe('N052 · os contratos sem estimativa ficam sem imposto fora da Declaração', () => {
  test('imóvel em Espanha: «—» e «Anexo J · sem estimativa» na lista e na Avaliação; com taxa escrita, a escrita', () => {
    app.db.properties.push(app.normProp({ id: 'ES', name: 'Madrid', ownerIds: ['eu'], pais: 'Espanha' }));
    const c = ct({ propertyId: 'ES', start: '2025-01-01', end: '2027-12-31', rent: 1500 });
    igual(copia(app.irsTaxaParaMostrar(c)), { taxa: null, escrita: false, semEstimativa: 'fora', porque: 'Anexo J · sem estimativa' });
    assert.equal(app.irsLiquidaParaMostrar(c), null);
    const html = app.ctLinha(c, app.prop('ES'), app.ctContextoDaLista());
    assert.match(html, /<div class="ct-c-imp"><span>—<\/span><span class="small">Anexo J · sem estimativa<\/span>/);
    assert.match(html, /<div class="ct-c-liq">—<\/div>/);
    assert.doesNotMatch(html, /renda moderada/);
    assert.match(app.avaImpostoDoContrato(c), /— <span class="small">sem estimativa<\/span><\/td><td><b>—<\/b>/);
    c.taxRate = 19;
    assert.equal(app.irsTaxaParaMostrar(c).taxa, 19);
    perto(app.irsLiquidaParaMostrar(c), 1215);
  });

  test('a Visão geral não soma o contrato sem estimativa à renda líquida e diz que ficou de fora', () => {
    app.db.properties.push(app.normProp({ id: 'ES', name: 'Madrid', ownerIds: ['eu'], pais: 'Espanha' }));
    const c = ct({ propertyId: 'ES', start: '2025-01-01', end: '2027-12-31', rent: 1500 });
    app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', amount: 1500, date: '2026-10-05', propertyId: 'ES', contractId: c.id }));
    const html = app.vDashboard();
    assert.match(html, /fica de fora um contrato sem estimativa do imposto/);
  });

  test('categoria B: nunca os 28 %, também num contrato «Por indicar» e num imóvel lá fora (a marca ganha ao país)', () => {
    const c = ct({ start: '2025-01-01', end: '2027-12-31', rent: 2000 }, { finalidade: 'nh', categoriaB: true });
    assert.equal(app.irsSemEstimativa(c), 'catB');
    assert.equal(app.irsTaxaParaMostrar(c).taxa, null);
    c.fisco.estado = '';
    assert.equal(app.irsSemEstimativa(c), 'catB');
    c.fisco.estado = 'naoDeclarado';
    assert.equal(app.irsSemEstimativa(c), '', 'num «Não declarado» a marca não conta');
    app.db.properties.push(app.normProp({ id: 'ES', name: 'Madrid', ownerIds: ['eu'], pais: 'Espanha' }));
    const fora = ct({ id: 'C2', propertyId: 'ES', start: '2025-01-01', end: '2027-12-31', rent: 2000 }, { categoriaB: true });
    assert.equal(app.irsSemEstimativa(fora), 'catB');
  });

  test('a renda líquida da Avaliação e do texto conta só os com estimativa, e diz quantos ficaram de fora', () => {
    app.db.properties.push(app.normProp({ id: 'ES', name: 'Madrid', ownerIds: ['eu'], pais: 'Espanha' }));
    ct({ id: 'PT', start: '2025-01-01', end: '', rent: 1000 });
    ct({ id: 'ESC', propertyId: 'ES', start: '2025-01-01', end: '', rent: 1500 });
    perto(app.netRentOf(app.prop('ES')), 0);
    perto(app.netRentOf(app.prop('P1')), 900);
    assert.match(app.reportText(), /líquida de impostos \(estim\.\) 900\s€\/mês \(fica de fora um contrato sem estimativa do imposto\)/);
  });
});

describe('N121 · as Projeções testam o limite com a renda projetada de cada ano', () => {
  test('2 250 € com 3 % ao ano: 10 % em 2026, a taxa base em 2027 (2 317,50 €)', () => {
    hoje.db.settings.years = 4; hoje.db.settings.inflation = 0;
    ct({ start: '2026-01-01', end: '', rent: 2250, increase: 3 }, {}, hoje);
    const r = hoje.projRows(null);
    perto(r.rows[0].irs / r.rows[0].rent, 0.10, 1e-9);
    perto(r.rows[1].irs / r.rows[1].rent, 0.25, 1e-9);
    assert.match(hoje.projDespesasTxt(r.base), /testam-se com a renda projetada de cada ano: o limite é o de hoje/);
  });

  test('um contrato sem estimativa não tem IRS projetado, e o cabeçalho conta-o', () => {
    hoje.db.properties.push(hoje.normProp({ id: 'ES', name: 'Madrid', ownerIds: ['eu'], pais: 'Espanha' }));
    ct({ id: 'ESC', propertyId: 'ES', start: '2025-01-01', end: '', rent: 1500, increase: 0 }, {}, hoje);
    const r = hoje.projRows(null);
    assert.equal(r.rows[0].irs, 0); assert.equal(r.base.semEst, 1);
    assert.match(hoje.projDespesasTxt(r.base), /Um contrato fica sem IRS estimado/);
  });
});

describe('N053 · a ficha de um subarrendado tem a taxa do quadro 5, sobre a diferença', () => {
  test('subarrenda a 1 000 € o que arrenda a 600 €: 10 % em 2026 sobre 400 €; 25 % em 2025, sem a duração', () => {
    Object.assign(app.prop('P1'), { subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 } });
    const c = ct({ start: '2024-01-01', end: '2030-12-31', rent: 1000 });
    const t = copia(app.irsTaxa(c, 2026));
    assert.equal(t.taxa, 10); assert.equal(t.motivo, 'moderada'); assert.equal(t.sublocacao, true); assert.equal(t.porConfirmar, true); assert.equal(t.reducao, null);
    assert.equal(app.irsTaxaPorque(c, 2026), 'sublocação, renda moderada');
    igual(copia(app.irsSublocacaoMensal(c)), { renda: 1000, paga: 600, diferenca: 400 });
    perto(app.netRent(c, 2026), 960);
    igual(copia(app.irsTaxaDoSubarrendamento(c, 2025)), { taxa: 25, motivo: 'base', porConfirmar: false, reducao: null, sublocacao: true });
    assert.equal(app.irsTaxa(c, 2025).taxa, 25, 'sem os 23 % da duração (o quadro 5 não tem onde a pôr)');
  });

  test('sem o subarrendamento ligado, nada muda', () => {
    const c = ct({ start: '2024-01-01', end: '2030-12-31', rent: 1000 });
    assert.equal(app.irsTaxaDoSubarrendamento(c, 2026), null);
    assert.equal(app.irsSublocacaoMensal(c), null);
    perto(app.netRent(c, 2026), 900);
  });
});
