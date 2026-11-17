// O motor dos contratos e das taxas do IRS (web/app/irs.js), depois da
// auditoria (KAN-126, folha 2.1.2): o termo estipulado e o dia em que o
// contrato acabou mesmo (D02, D39), a taxa período a período pelo OC
// 20217/2020 nos dois regimes (D40, e a resposta Q1 do Martinho), a redução
// que só o é abaixo da taxa base (D11), o ano partido nos troços de cada taxa
// (D15, D41), a comunicação da duração uma vez por período (D01), o n.º 24
// como facto à parte da conta (D36), o limite das rendas moderadas com as
// rendas do ano (D48), as isenções com as condições da versão (D18, D46) e o
// regime do quadro 10 (D09, D10). Cada bloco diz o defeito que fecha; cada
// assert falhava antes da correção.
//
// O dia da app é fixo (2026-11-17); as condições do IHRU, que dependem do dia,
// têm uma app com o seu.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));

/* Um contrato de habitação permanente, declarado, com 2 500 €/mês (acima dos
   2 300 € das rendas moderadas, para a taxa da duração se ver). O bloco fiscal
   passa pelo normContract e os campos de `fisco` escrevem-se por cima depois,
   tal e qual: o teste não depende de como o normFisco os normaliza.
   Recebe: extra — campos do contrato; fisco (opcional) — campos do bloco fiscal;
   a (opcional) — a app (por omissão, a do ficheiro).
   Devolve: o contrato (não fica em db.contracts). */
function ct(extra, fisco, a) {
  const x = a || app;
  const c = x.normContract(Object.assign({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', rent: 2500, fisco: { estado: 'declarado', finalidade: 'hp' } }, extra || {}));
  Object.assign(c.fisco, fisco || {});
  return c;
}

/* As renovações registadas no bloco fiscal, a partir de pares de datas.
   Recebe: pares — [[inicio, fim], …].
   Devolve: a lista no formato do bloco. */
const renov = (pares) => pares.map(([inicio, fim], i) => ({ id: 'R' + i, inicio, fim }));

/* Uma renda do contrato C1 em db.transactions.
   Recebe: date — o dia; valor — o que entrou; extra (opcional) — periodo, retencao….
   Devolve: nada. */
function renda(date, valor, extra) {
  app.db.transactions.push(app.normTx(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, date,
    propertyId: 'P1', contractId: 'C1' }, extra || {})));
}

/* Os troços de um ano reduzidos ao que se compara.
   Recebe: c — o contrato; ano — o ano.
   Devolve: [[de, ate, periodo, taxa, motivo, semRenovacao, temReducao]]. */
const trocos = (c, ano) => copia(app.irsSegmentosDoAno(c, ano)).map((s) => [s.de, s.ate, s.periodo, s.taxa, s.motivo, s.semRenovacao, !!s.reducao]);

describe('D40 · as renovações do regime de 2019 pelo OC 20217/2020', () => {
  test('os quatro casos do cenário r1-taxas/s2-renovacoes-oc20217 dão 24, 23, 21 e 24 %', () => {
    const a = ct({ start: '2016-06-01', end: '2025-05-31' }, { renovacoes: renov([['2019-06-01', '2022-05-31'], ['2022-06-01', '2025-05-31']]) });
    assert.equal(app.irsReducao(a, 2025).taxa, 24, 'antes de 2019 por 3 anos, renovado duas vezes por 3: 28 → 26 → 24');
    const b = ct({ start: '2015-07-01', end: '2025-06-30' }, { renovacoes: renov([['2020-07-01', '2025-06-30']]) });
    assert.equal(app.irsReducao(b, 2025).taxa, 23, 'antes de 2019 por 5, renovado por 5: 28 − 5 = 23, e não 18');
    const c = ct({ start: '2019-03-01', end: '2028-02-29' }, { renovacoes: renov([['2023-03-01', '2028-02-29']]) });
    assert.equal(app.irsReducao(c, 2025).taxa, 21, '4 anos (26 %) renovado por 5: 26 − 5 = 21 (OC, ponto I)');
    const d = ct({ start: '2009-06-01', end: '2025-05-31' }, { renovacoes: renov([['2019-06-01', '2022-05-31'], ['2022-06-01', '2025-05-31']]) });
    assert.equal(app.irsReducao(d, 2025).taxa, 24, '10 anos antes de 2019, renovado por 3 e por 3: 26 → 24');
    assert.equal(app.irsTaxa(d, 2025).motivo, 'duracao');
  });

  test('o controlo: renovações do mesmo escalão continuam a descer 2 pontos', () => {
    const e = ct({ start: '2019-03-01', end: '2026-02-28' }, { renovacoes: renov([['2021-03-01', '2023-02-28'], ['2023-03-01', '2026-02-28']]) });
    assert.equal(app.irsReducao(e, 2025).taxa, 22);
  });
});

describe('Q1 · o regime de 2023 também segue o OC: cada renovação desce a partir da anterior', () => {
  test('5 anos (15 %) renovado por 5, por 5…: 13, 11, 9, 7, 5 e não desce mais (o limite dos 10 pontos)', () => {
    const pares = [];
    for (let k = 1; k <= 6; k++) pares.push([(2024 + 5 * k) + '-01-01', (2028 + 5 * k) + '-12-31']);
    const c = ct({ start: '2024-01-01', end: '2058-12-31' }, { renovacoes: renov(pares) });
    igual([2025, 2030, 2035, 2040, 2045, 2050, 2055].map((a) => app.irsReducao(c, a).taxa), [15, 13, 11, 9, 7, 5, 5]);
  });

  test('a descida parte da taxa do período anterior, seja qual for o escalão dele', () => {
    const c = ct({ start: '2024-01-01', end: '2038-12-31' }, { renovacoes: renov([['2034-01-01', '2038-12-31']]) });
    assert.equal(app.irsReducao(c, 2025).taxa, 10, 'dez anos');
    assert.equal(app.irsReducao(c, 2035).taxa, 8, 'renovado por 5: 10 − 2 (a leitura da Q1)');
  });

  test('a renovação que daria mais alta mantém a anterior (OC, ponto II)', () => {
    const c = ct({ start: '2024-01-01', end: '2053-12-31' }, { renovacoes: renov([['2044-01-01', '2053-12-31']]) });
    assert.equal(app.irsReducao(c, 2030).taxa, 5, 'vinte anos');
    assert.equal(app.irsReducao(c, 2045).taxa, 5, 'renovado por 10: os 10 % do escalão subiam a taxa — fica 5');
  });

  test('os casos que a Q1 não decide ficam na taxa do escalão da renovação (pendentes de decisão)', () => {
    const cruza = ct({ start: '2020-07-01', end: '2030-06-30' }, { renovacoes: renov([['2025-07-01', '2030-06-30']]) });
    assert.equal(app.irsReducao(cruza, 2026).taxa, 15, 'do regime de 2019 (23 %) para uma renovação de 5 anos no de 2023');
    const curto = ct({ start: '2024-01-01', end: '2031-12-31' }, { renovacoes: renov([['2027-01-01', '2031-12-31']]) });
    assert.equal(app.irsReducao(curto, 2025), null, 'três anos no regime de 2023: sem redução');
    assert.equal(app.irsReducao(curto, 2028).taxa, 15, 'renovado por 5 depois de um período sem redução');
  });
});

describe('D11 · uma «redução» que não baixa da taxa base não é redução', () => {
  test('3 anos do regime de 2019 (26 %): sem redução, sem 4.2 e sem comunicação', () => {
    const c = ct({ start: '2023-03-01', end: '2026-02-28' });
    assert.equal(app.irsReducao(c, 2025), null);
    const t = copia(app.irsTaxa(c, 2025));
    assert.equal(t.taxa, 25); assert.equal(t.motivo, 'base'); assert.equal(t.reducao, null);
    assert.equal(app.irsComunicacaoDoAno(c, 2025), null);
    igual(copia(app.irsPrazosDeComunicacao(c)), []);
  });

  test('os do regime de 2019 já abaixo de 25 % ficam até ao termo ou à renovação', () => {
    const dois = ct({ start: '2020-03-01', end: '2024-02-29' }, { renovacoes: renov([['2022-03-01', '2024-02-29']]) });
    assert.equal(app.irsReducao(dois, 2023).taxa, 24);
    const tres = ct({ start: '2019-03-01', end: '2025-02-28' }, { renovacoes: renov([['2021-03-01', '2023-02-28'], ['2023-03-01', '2025-02-28']]) });
    assert.equal(app.irsReducao(tres, 2024).taxa, 22);
    assert.equal(app.irsTaxa(tres, 2024).motivo, 'duracao');
  });
});

describe('D02, D39 · o termo estipulado e o dia em que o contrato acabou mesmo', () => {
  test('irsFimEfetivo: o c.end, ou o fim de uma renovação escrita para lá dele', () => {
    assert.equal(app.irsFimEfetivo(ct({ start: '2020-01-01', end: '2024-12-31' }, { renovacoes: renov([['2025-01-01', '2029-12-31']]) })), '2029-12-31');
    assert.equal(app.irsFimEfetivo(ct({ start: '2020-01-01', end: '2024-12-31' })), '2024-12-31');
    assert.equal(app.irsFimEfetivo(ct({ start: '2020-01-01', end: '' })), '', 'sem termo');
    assert.equal(app.irsFimEfetivo(null), '');
  });

  test('irsFimReal: a cessação manda; sem ela, o c.end de um terminado ou o termo de um em vigor', () => {
    const cessado = ct({ start: '2024-01-01', end: '2028-12-31', active: false }, { cessacao: { data: '2025-08-31', motivo: '02' } });
    assert.equal(app.irsFimReal(cessado), '2025-08-31');
    assert.equal(app.irsFimEfetivo(cessado), '2028-12-31', 'o termo não muda');
    assert.equal(app.irsFimReal(ct({ start: '2024-01-01', end: '2026-05-31', active: false })), '2026-05-31');
    assert.equal(app.irsFimReal(ct({ start: '2020-01-01', end: '2024-12-31' }, { renovacoes: renov([['2025-01-01', '2029-12-31']]) })), '2029-12-31');
    assert.equal(app.irsFimReal(null), '');
    igual(copia(app.irsCessacao(ct({}, { cessacao: { data: '31/08/2025', motivo: 'senhorio' } }))), { data: '', motivo: '' }, 'lixo fica vazio');
    igual(copia(app.irsCessacao(ct({}, { cessacao: null }))), { data: '', motivo: '' });
  });

  test('o inquilino que sai antes do termo não tira a redução (art. 72.º n.º 20): 15 % em 2024 e em 2025', () => {
    const c = ct({ start: '2024-01-01', end: '2028-12-31', active: false }, { cessacao: { data: '2025-08-31', motivo: '02' } });
    assert.equal(app.irsTaxa(c, 2024).taxa, 15);
    assert.equal(app.irsTaxa(c, 2025).taxa, 15);
    assert.equal(app.irsTaxa(c, 2025).motivo, 'duracao');
    igual(copia(app.irsPeriodos(c)), [{ inicio: '2024-01-01', fim: '2028-12-31' }]);
    igual(trocos(c, 2025), [['2025-01-01', '2025-08-31', 0, 15, 'duracao', false, true]], 'o ano acaba no dia da cessação');
    igual(trocos(c, 2026), [], 'depois da cessação não há troços');
  });
});

describe('D15 · rendas depois do termo sem renovação registada', () => {
  test('o ano inteiro depois do termo: um troço «sem renovação» à taxa base, e a redução não passa', () => {
    const c = ct({ start: '2021-01-01', end: '2025-12-31' });
    igual(trocos(c, 2026), [['2026-01-01', '2026-12-31', null, 25, 'semRenovacao', true, false]]);
    const t = copia(app.irsTaxa(c, 2026));
    assert.equal(t.taxa, 25); assert.equal(t.reducao, null); assert.equal(t.semRenovacao, true);
    assert.equal(app.irsReducao(c, 2026), null, 'não é a taxa do período que acabou (23 %)');
    assert.equal(app.irsReducao(c, 2025).taxa, 23, 'o período inicial continua com a dele');
  });

  test('o termo a meio do ano: o período até ao termo, e o resto sem renovação', () => {
    const c = ct({ start: '2021-07-01', end: '2026-06-30' });
    igual(trocos(c, 2026), [['2026-01-01', '2026-06-30', 0, 23, 'duracao', false, true], ['2026-07-01', '2026-12-31', null, 25, 'semRenovacao', true, false]]);
    assert.equal(app.irsTaxaNaData(c, '2026-09-01').motivo, 'semRenovacao');
    assert.equal(app.irsTaxaNaData(c, '2026-03-01').taxa, 23);
  });

  test('um contrato terminado acaba no fim; um sem termo nunca fica «sem renovação»', () => {
    const fim = ct({ start: '2021-07-01', end: '2026-06-30', active: false });
    igual(trocos(fim, 2026), [['2026-01-01', '2026-06-30', 0, 23, 'duracao', false, true]]);
    assert.equal(app.irsTaxa(fim, 2027).semRenovacao, undefined, 'terminado: não está à espera de renovação');
    const sem = ct({ start: '2021-07-01', end: '' });
    igual(trocos(sem, 2026), [['2026-01-01', '2026-12-31', 0, 25, 'base', false, false]]);
  });

  test('a renda moderada continua a valer depois do termo (é da renda, não da duração)', () => {
    const c = ct({ start: '2021-07-01', end: '2026-06-30', rent: 900 });
    igual(trocos(c, 2026).map((s) => [s[2], s[3], s[4], s[5]]), [[0, 10, 'moderada', false], [null, 10, 'moderada', true]]);
  });

  test('um contrato que ainda não começou conta pelo período inicial (as projeções)', () => {
    const c = ct({ start: '2027-03-01', end: '2032-02-29' });
    assert.equal(app.irsReducao(c, 2026).taxa, 15);
    igual(trocos(c, 2026), []);
  });
});

describe('D41 · uma renovação a meio do ano parte o ano em dois', () => {
  test('5 anos de 2020-07 (23 %) renovado a 2025-07 por 5: cada metade com a sua taxa', () => {
    const c = ct({ start: '2020-07-01', end: '2030-06-30' }, { renovacoes: renov([['2025-07-01', '2030-06-30']]) });
    igual(trocos(c, 2025), [['2025-01-01', '2025-06-30', 0, 23, 'duracao', false, true], ['2025-07-01', '2025-12-31', 1, 15, 'duracao', false, true]]);
    assert.equal(app.irsTaxaNaData(c, '2025-03-15').taxa, 23);
    assert.equal(app.irsTaxaNaData(c, '2025-09-01').taxa, 15);
    assert.equal(app.irsTaxaNaData(c, '2019-09-01'), null, 'antes do contrato');
    assert.equal(app.irsTaxaNaData(c, 'ontem'), null);
  });

  test('renovado por 3 (sem redução): os meses de antes guardam a redução e o 4.2A pergunta pela comunicação deles', () => {
    const c = ct({ start: '2020-04-01', end: '2028-03-31' }, { renovacoes: renov([['2025-04-01', '2028-03-31']]), comunicacoes: { 2020: '2021-02-10' } });
    igual(trocos(c, 2025), [['2025-01-01', '2025-03-31', 0, 23, 'duracao', false, true], ['2025-04-01', '2025-12-31', 1, 25, 'base', false, false]]);
    const com = copia(app.irsComunicacaoDoAno(c, 2025));
    assert.equal(com.chave, '2020'); assert.equal(com.data, '2021-02-10');
  });

  test('a renda vai ao último troço do mês a que respeita (o contrato que faz anos a meio do mês)', () => {
    const c = ct({ start: '2020-06-15', end: '2030-06-14' }, { renovacoes: renov([['2025-06-15', '2030-06-14']]) });
    assert.equal(app.irsTaxaDaRenda(c, { date: '2025-05-20' }).taxa, 23, 'a de maio é do período inicial');
    assert.equal(app.irsTaxaDaRenda(c, { date: '2025-07-02', periodo: '2025-06' }).taxa, 15, 'a de junho já é da renovação');
    const termo = ct({ start: '2020-06-15', end: '2025-06-14' });
    assert.equal(app.irsTaxaDaRenda(termo, { date: '2025-06-20' }).semRenovacao, true, 'a do mês do termo cai depois dele');
    assert.equal(app.irsTaxaDaRenda(termo, { date: '2019-06-20' }), null, 'antes do contrato');
    assert.equal(app.irsTaxaDaRenda(c, { date: 'x' }), null);
  });

  test('um buraco entre o termo e uma renovação registada mais tarde fica «sem renovação»', () => {
    const c = ct({ start: '2021-01-01', end: '2025-12-31' }, { renovacoes: renov([['2026-04-01', '2031-03-31']]) });
    igual(trocos(c, 2026).map((s) => [s[0], s[1], s[2]]), [['2026-01-01', '2026-03-31', null], ['2026-04-01', '2026-12-31', 1]]);
  });
});

describe('D01 · a comunicação da duração faz-se uma vez por período', () => {
  test('a do período conta em todos os anos dele', () => {
    const c = ct({ start: '2024-03-01', end: '2029-02-28' }, { comunicacoes: { 2024: '2025-02-10' } });
    assert.equal(app.irsComunicado(c, 2024), '2025-02-10');
    assert.equal(app.irsComunicado(c, 2025), '2025-02-10');
    assert.equal(app.irsComunicado(c, 2026), '2025-02-10');
    igual(copia(app.irsComunicacaoDoAno(c, 2025)), { periodoInicio: '2024-03-01', chave: '2024', prazo: '2025-02-15', data: '2025-02-10', foraDePrazo: false });
  });

  test('uma renovação pede a sua, até 15 de fevereiro do ano seguinte ao início dela', () => {
    const c = ct({ start: '2024-03-01', end: '2034-02-28' }, { renovacoes: renov([['2029-03-01', '2034-02-28']]), comunicacoes: { 2024: '2025-02-10' } });
    const x = copia(app.irsComunicacaoDoAno(c, 2029));
    assert.equal(x.periodoInicio, '2029-03-01'); assert.equal(x.chave, '2029');
    assert.equal(x.prazo, '2030-02-15'); assert.equal(x.data, '');
    assert.equal(app.irsComunicado(c, 2029), '', 'a do contrato inicial não serve a renovação');
    igual(copia(app.irsPrazosDeComunicacao(c)), [
      { periodoInicio: '2024-03-01', chave: '2024', prazo: '2025-02-15', data: '2025-02-10' },
      { periodoInicio: '2029-03-01', chave: '2029', prazo: '2030-02-15', data: '' }]);
  });

  test('feita depois do prazo diz-se', () => {
    const c = ct({ start: '2024-03-01', end: '2029-02-28' }, { comunicacoes: { 2024: '2025-03-10' } });
    assert.equal(app.irsComunicacaoDoAno(c, 2025).foraDePrazo, true);
  });

  test('sem redução, isento, não habitacional ou fora da vida do contrato: nada a comunicar', () => {
    assert.equal(app.irsComunicacaoDoAno(ct({ start: '2025-01-01', end: '2026-12-31' }), 2025), null, 'dois anos');
    assert.equal(app.irsComunicacaoDoAno(ct({ start: '2024-01-01', end: '2033-12-31' }, { isencao: 'pma' }), 2025), null);
    assert.equal(app.irsComunicacaoDoAno(ct({ start: '2024-01-01', end: '2033-12-31' }, { finalidade: 'nh' }), 2025), null);
    assert.equal(app.irsComunicacaoDoAno(ct({ start: '2027-01-01', end: '2031-12-31' }), 2026), null, 'ainda não começou');
    assert.equal(app.irsComunicacaoDoAno(null, 2025), null);
    assert.equal(app.irsComunicado(null, 2025), '');
  });
});

describe('D36 · o n.º 24 é um facto (elegivel24), à parte da descida da estimativa (bonus)', () => {
  const com = (anos) => ct({ start: '2024-06-01', end: (2024 + anos) + '-05-31', rent: 900 }, { celebracao: '2024-05-20', rendaAnterior: 1000 });

  test('vinte anos: a estimativa fica nos 5 %, mas o 4.2B mostra-se', () => {
    const r = copia(app.irsReducao(com(20), 2025));
    assert.equal(r.taxa, 5); assert.equal(r.bonus, false); assert.equal(r.elegivel24, true);
  });

  test('dez anos: as duas coisas', () => {
    const r = copia(app.irsReducao(com(10), 2025));
    assert.equal(r.taxa, 5); assert.equal(r.bonus, true); assert.equal(r.elegivel24, true);
  });

  test('uma renovação não é um contrato novo; menos de 5 % abaixo não chega', () => {
    const c = ct({ start: '2024-06-01', end: '2034-05-31', rent: 900 }, { celebracao: '2024-05-20', rendaAnterior: 1000, renovacoes: renov([['2029-06-01', '2034-05-31']]) });
    assert.equal(app.irsReducao(c, 2030).elegivel24, false);
    assert.equal(app.irsReducao(c, 2030).taxa, 13, 'a cadeia parte dos 15, sem o bónus');
    assert.equal(app.irsReducao(ct({ start: '2024-06-01', end: '2029-05-31', rent: 951 }, { rendaAnterior: 1000 }), 2025).elegivel24, false);
  });
});

describe('D48 · o limite das rendas moderadas testa-se com as rendas do ano', () => {
  beforeEach(() => { limpar(app); });
  const c = () => ct({ start: '2024-03-01', end: '2029-02-28', rent: 2307.6 });
  const meses = (n, valor, extra) => { for (let m = 1; m <= n; m++) renda('2026-' + String(m).padStart(2, '0') + '-08', valor, extra); };

  test('12 rendas de 2 250 € e o contrato já a 2 307,60 €: 10 % (e não 15 %)', () => {
    meses(12, 2250);
    assert.equal(app.irsRendaMensalDoTeste(c(), 2026), 2250);
    const t = copia(app.irsTaxa(c(), 2026));
    assert.equal(t.taxa, 10); assert.equal(t.motivo, 'moderada');
  });

  test('três meses em atraso por lançar não baixam a média', () => {
    meses(9, 2250);
    assert.equal(app.irsRendaMensalDoTeste(c(), 2026), 2250);
    assert.equal(app.irsTaxa(c(), 2026).taxa, 10);
  });

  test('a renda bruta conta (com a retenção) e cada renda vai ao mês a que respeita', () => {
    meses(11, 1800, { retencao: 450 });
    renda('2027-01-05', 2250, { periodo: '2026-12' });
    renda('2026-12-20', 9999, { periodo: '2027-01' });
    assert.equal(app.irsRendaMensalDoTeste(c(), 2026), 2250);
  });

  test('acima do limite em 2026 não há 10 %, mesmo com a renda de hoje mais baixa', () => {
    meses(12, 2400);
    const baixa = ct({ start: '2024-03-01', end: '2029-02-28', rent: 2200 });
    assert.equal(app.irsTaxa(baixa, 2026).taxa, 15);
  });

  test('os móveis e serviços pagos à parte somam; sem rendas no ano, a renda do contrato', () => {
    meses(12, 2250);
    const extras = ct({ start: '2024-03-01', end: '2029-02-28', rent: 2250 }, { extrasMensais: 100 });
    assert.equal(app.irsRendaMensalDoTeste(extras, 2026), 2350);
    assert.equal(app.irsTaxa(extras, 2026).taxa, 15);
    limpar(app);
    assert.equal(app.irsRendaMensalDoTeste(c(), 2026), 2307.6);
    assert.equal(app.irsTaxa(c(), 2026).taxa, 15);
  });

  test('o mês de uma renda: o período, ou o da data', () => {
    assert.equal(app.irsMesDaRenda({ date: '2026-09-03', periodo: '2026-08' }), '2026-08');
    assert.equal(app.irsMesDaRenda({ date: '2026-09-03', periodo: '' }), '2026-09');
    assert.equal(app.irsMesDaRenda({ date: '2026-09-03', periodo: 'agosto' }), '2026-09');
    assert.equal(app.irsMesDaRenda(null), '');
  });
});

describe('D18 · as isenções do 6H (anterior ao RAU) e do 6F (ex-alojamento local)', () => {
  test('renda antiga de 1987 sujeita ao NRAU: isenta, no 6H', () => {
    const c = ct({ start: '1987-05-01', end: '', rent: 180 }, { isencao: 'prerau', nrau3536: true });
    const t = copia(app.irsTaxa(c, 2025));
    assert.equal(t.taxa, 0); assert.equal(t.motivo, 'isento'); assert.equal(t.isencao.quadro, '6H');
    assert.equal(app.irsIsencaoMotivo(c, 2025), '');
  });

  test('sem confirmar os arts. 35.º/36.º do NRAU, a isenção não conta e diz-se porquê', () => {
    const c = ct({ start: '1987-05-01', end: '', rent: 180 }, { isencao: 'prerau', nrau3536: null });
    assert.equal(app.irsIsencao(c, 2025), null);
    assert.equal(app.irsTaxa(c, 2025).taxa, 25);
    assert.match(app.irsIsencaoMotivo(c, 2025), /NRAU/);
  });

  test('ex-alojamento local: isento até às rendas de 2029, só de contratos até 2024 e de habitação permanente', () => {
    const c = ct({ start: '2024-06-01', end: '2029-05-31', rent: 950 }, { celebracao: '2024-05-25', isencao: 'al', alRegistado2022: true });
    assert.equal(app.irsTaxa(c, 2025).taxa, 0);
    assert.equal(app.irsIsencao(c, 2025).quadro, '6F');
    assert.equal(app.irsIsencao(c, 2030), null);
    assert.match(app.irsIsencaoMotivo(c, 2030), /até 2029/);
    const tarde = ct({ start: '2025-02-01', end: '2030-01-31', rent: 950 }, { celebracao: '2025-01-10', isencao: 'al', alRegistado2022: true });
    assert.match(app.irsIsencaoMotivo(tarde, 2025), /até 31\/12\/2024/);
    const hnp = ct({ start: '2024-06-01', end: '2029-05-31', rent: 950 }, { celebracao: '2024-05-25', isencao: 'al', alRegistado2022: true, finalidade: 'hnp' });
    assert.match(app.irsIsencaoMotivo(hnp, 2025), /habitação permanente/);
    const semAl = ct({ start: '2024-06-01', end: '2029-05-31', rent: 950 }, { celebracao: '2024-05-25', isencao: 'al' });
    assert.match(app.irsIsencaoMotivo(semAl, 2025), /alojamento local/);
  });

  test('uma isenção que o ano não tem: não conta, e a frase di-lo', () => {
    const c = ct({ start: '2026-09-15', end: '2029-09-14' }, { isencao: 'rsaa' });
    assert.equal(app.irsIsencao(c, 2025), null);
    assert.match(app.irsIsencaoMotivo(c, 2025), /RSAA\) não existe nas regras de 2025/);
    assert.equal(app.irsIsencaoMotivo(ct({ start: '2024-01-01', end: '2033-12-31' }), 2025), '', 'sem isenção escolhida');
  });
});

describe('D46 · o RSAA pede o envio ao IHRU; o PAA só de contratos até ao fim do programa', () => {
  const antesDoPrazo = carregarApp({ hoje: '2027-01-10' });
  const depoisDoPrazo = carregarApp({ hoje: '2027-01-20' });
  afterEach(() => repor(antesDoPrazo));
  afterEach(() => repor(depoisDoPrazo));
  const rsaa = (a, fisco) => ct({ start: '2026-10-01', end: '2029-09-30', rent: 700 }, Object.assign({ celebracao: '2026-09-20', isencao: 'rsaa' }, fisco || {}), a);

  test('sem a data do envio, conta até 15 de janeiro do ano seguinte e deixa de contar depois', () => {
    assert.equal(antesDoPrazo.irsTaxa(rsaa(antesDoPrazo), 2026).motivo, 'isento');
    assert.equal(depoisDoPrazo.irsIsencao(rsaa(depoisDoPrazo), 2026), null);
    assert.equal(depoisDoPrazo.irsTaxa(rsaa(depoisDoPrazo), 2026).taxa, 10, 'cai nos 10 % das rendas moderadas');
    assert.equal(depoisDoPrazo.irsIsencaoMotivo(rsaa(depoisDoPrazo), 2026), 'sem a data do envio ao IHRU, a isenção não conta');
  });

  test('com a data do envio a tempo conta; tarde, não', () => {
    assert.equal(depoisDoPrazo.irsTaxa(rsaa(depoisDoPrazo, { ihru: '2027-01-12' }), 2026).motivo, 'isento');
    const tarde = rsaa(depoisDoPrazo, { ihru: '2027-01-16' });
    assert.equal(depoisDoPrazo.irsIsencao(tarde, 2026), null);
    assert.equal(depoisDoPrazo.irsIsencaoMotivo(tarde, 2026), 'o contrato foi ao IHRU depois de 15/01/2027: a isenção não conta');
  });

  test('o PAA celebrado depois de 31/8/2026 não é isento; antes, continua', () => {
    const tarde = ct({ start: '2026-11-01', end: '2031-10-31', rent: 650 }, { celebracao: '2026-10-20', isencao: 'paa' });
    assert.equal(app.irsIsencao(tarde, 2026), null);
    assert.match(app.irsIsencaoMotivo(tarde, 2026), /até 31\/08\/2026/);
    const antes = ct({ start: '2026-08-01', end: '2031-07-31', rent: 650 }, { celebracao: '2026-07-20', isencao: 'paa' });
    assert.equal(app.irsTaxa(antes, 2026).motivo, 'isento');
  });
});

describe('D09, D10 · o regime do quadro 10', () => {
  test('pelo número do art. 72.º do escalão do período em que acabou', () => {
    const cinco = ct({ start: '2024-01-01', end: '2028-12-31', active: false }, { cessacao: { data: '2025-08-31', motivo: '01' } });
    assert.equal(app.irsRegimeQuadro10(cinco, 2025), '02', '5 a 10 anos: n.º 3');
    const dez = ct({ start: '2024-01-01', end: '2033-12-31', active: false }, { cessacao: { data: '2026-06-30', motivo: '01' } });
    assert.equal(app.irsRegimeQuadro10(dez, 2026), '03', '10 a 20 anos: n.º 4');
    const dois = ct({ start: '2019-03-01', end: '2025-02-28', active: false }, { renovacoes: renov([['2021-03-01', '2023-02-28'], ['2023-03-01', '2025-02-28']]) });
    assert.equal(app.irsRegimeQuadro10(dois, 2025), '01', 'o regime de 2019 abaixo de 25 %: n.º 2');
  });

  test('a taxa da duração decorrida, para a regularização do n.º 20: só a do período em que acabou', () => {
    const curto = ct({ start: '2024-01-01', end: '2033-12-31', active: false }, { cessacao: { data: '2026-06-30', motivo: '01' } });
    igual(copia(app.irsTaxaDecorrida(curto)), { periodo: 0, desde: '2024-01-01', ate: '2026-06-30', meses: 30, taxa: 25, reducao: false });
    const seis = ct({ start: '2024-01-01', end: '2033-12-31', active: false }, { cessacao: { data: '2029-12-31', motivo: '01' } });
    assert.equal(app.irsTaxaDecorrida(seis).taxa, 15, 'seis anos de dez ainda são do escalão dos 5 a 10 anos');
    const ren = ct({ start: '2024-01-01', end: '2033-12-31', active: false }, { renovacoes: renov([['2029-01-01', '2033-12-31']]), cessacao: { data: '2030-12-31', motivo: '01' } });
    const r = copia(app.irsTaxaDecorrida(ren));
    assert.equal(r.periodo, 1); assert.equal(r.desde, '2029-01-01'); assert.equal(r.taxa, 25, 'dois anos da renovação: sem escalão');
    assert.equal(app.irsReducao(ren, 2026).taxa, 15, 'o período inicial, cumprido, não se toca');
    assert.equal(app.irsTaxaDecorrida(ct({ start: '2024-01-01', end: '2033-12-31' })), null, 'sem cessação');
  });

  test('pela isenção, sem os regimes do subarrendamento; sem benefício, nenhum', () => {
    assert.equal(app.irsRegimeQuadro10(ct({ start: '2022-01-01', end: '2026-06-30' }, { isencao: 'paa' }), 2025), '05');
    assert.equal(app.irsRegimeQuadro10(ct({ start: '2022-01-01', end: '2026-06-30' }, { isencao: 'pma' }), 2025), '07');
    assert.equal(app.irsRegimeQuadro10(ct({ start: '2023-03-01', end: '2026-02-28' }), 2025), '', 'sem redução');
    assert.equal(app.irsRegimeQuadro10(null, 2025), '');
  });
});

describe('a versão emprestada a outro ano', () => {
  test('passa todas as datas dos prazos e da entrega, e nenhuma das condições da lei', () => {
    const v = copia(app.irsAno(2026));
    try {
      app.registarAnoIrs(Object.assign({}, v, { ano: 2031, prazos: { comunicacaoDuracao: '2032-02-15', outraData: '2032-01-31', semData: 'x' },
        entrega: { de: '2032-04-01', ate: '2032-06-30' } }));
      const e = copia(app.irsAno(2033));
      igual(e.prazos, { comunicacaoDuracao: '2034-02-15', outraData: '2034-01-31', semData: 'x' });
      igual(e.entrega, { de: '2034-04-01', ate: '2034-06-30' });
      assert.equal(e.isencoes.find((x) => x.id === 'paa').celebradoAte, '2026-08-31', 'a data da lei não anda');
      assert.equal(e.exato, false);
      assert.equal(e.ias, null, 'o IAS é do ano da versão');
      assert.equal(e.revisto, '');
    } finally {
      delete app.IRS_ANOS[2031];
    }
    assert.equal(app.irsAno(2027).prazos.comunicacaoDuracao, '2028-02-15');
  });
});
