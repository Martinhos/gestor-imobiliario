// Os avisos da Declaração que a vaga 1 do IRS acrescenta (KAN-126, folha
// 2.1.9): o ano sem regras (D50), o contrato sem início (D43), sem finalidade
// (D16), com mais do que uma fração (D69), com rendas depois do termo sem
// renovação (D15), a taxa escrita que não é a da lei (D17), as rendas sem
// contrato (D34), as retenções que não batem com a renda (D23), o inquilino
// que devia reter e o ano sem retenção (D58), os meses repetidos (D88), as
// rendas antecipadas por lançar (D56) e as despesas «a confirmar» (D06, D07,
// D24–D27, D60, D61). Cada aviso com o nível e o toque. O resumo que os avisos
// leem monta-se à mão (fiscoAvisos recebe-o inteiro): os campos novos dele são
// de outra folha da mesma vaga (fisco-resumo.js, 2.1.7); as rendas de cada
// contrato leem-se da base.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, igual } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));
afterEach(() => {
  repor(app);
  delete app.IRS_ANOS[2025].retencao;
  delete app.IRS_ANOS[2026].retencao;
  app.definirServicosDesligados([]);
});

const ANO = 2026;
/* as regras da retenção na versão do ano (o bloco que o condutor junta ao
   irs-2025.js e ao irs-2026.js): 25 %, 10 % nas rendas moderadas desde o dia
   da alínea f), e nada abaixo de 25 € desde julho de 2025 */
const RETENCAO = { taxa: 25, moderada: 10, moderadaDesde: '2026-06-01', minimo: 25, minimoDesde: '2025-07-01' };
const comRetencao = () => { app.IRS_ANOS[2026].retencao = Object.assign({}, RETENCAO); };

beforeEach(() => {
  limpar(app);
  app.fiscoAno = '';
  app.db.owners.push(app.normPerson({ id: 'o1', name: 'Eu' }));
  app.db.properties.push(app.normProp({ id: 'p1', name: 'T2 Arroios', ownerIds: ['o1'], freguesiaCodigo: '110658', tipoPredio: 'U', matrix: '1234' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Ana', nif: '123456789' }),
    app.normPerson({ id: 'emp', name: 'Empresa, Lda.', nif: '500000000' }));
});

/* um contrato na base
   Recebe: extra — o que muda (id, rent, start, end, fisco…).
   Devolve: o contrato normalizado. */
const ct = (extra) => {
  const c = app.normContract(Object.assign({ id: 'C1', name: 'Loja', propertyId: 'p1', tenantIds: ['t1'], rent: 1000,
    start: '2024-01-01', end: '2028-12-31', active: true, fisco: { estado: 'declarado', numero: '123', finalidade: 'nh' } }, extra));
  app.db.contracts.push(c);
  return c;
};
/* uma renda do contrato
   Recebe: id; contractId; date; amount; extra (retencao, periodo…).
   Devolve: nada. */
const renda = (id, contractId, date, amount, extra) => app.db.transactions.push(app.normTx(Object.assign(
  { id, kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount, date, propertyId: 'p1', contractId, recibo: true }, extra)));
/* uma linha do resumo, com a forma da 1.4 do plano, feita a partir do contrato
   Recebe: c — o contrato; extra — os campos que mudam.
   Devolve: a linha. */
const linha = (c, extra) => Object.assign({ contratoId: c.id, propertyId: c.propertyId, nome: c.name, imovel: 'T2 Arroios',
  atNumero: '123', inicio: c.start, estado: 'declarado', freguesiaCodigo: '110658', tipoPredio: 'U', artigo: '1234', fracao: '',
  quota: 1, natureza: '06', naturezaAssumida: false, titular: 'A', titularId: '', quadro: '4.1', taxaReduzida: false, taxa: 28,
  taxaEscrita: null, motivoTaxa: 'nh', isencao: null,
  inquilinos: c.tenantIds.map((id) => { const t = app.tenant(id); return { id, nome: t.name, nif: t.nif, pais: '' }; }),
  rendas: 12000, retencoes: 0, gastos: { selo: 10 }, faltas: [], recibosPorEmitir: 0 }, extra);
/* o resumo à mão
   Recebe: linhas; extra — o que muda (ano, semContrato, aConfirmar…).
   Devolve: o resumo. */
const resumo = (linhas, extra) => Object.assign({ ano: ANO, titulares: [], linhas, fora: [], semContrato: [], aConfirmar: [],
  obrasSoltas: 0, foraDoPeriodo: 0, semSessao: false }, extra);
/* os avisos cujo texto casa
   Recebe: r — o resumo; re — a expressão.
   Devolve: os avisos (cópia simples). */
const avisos = (r, re) => JSON.parse(JSON.stringify(app.fiscoAvisos(r))).filter((a) => re.test(a.texto));
const mes = (m) => String(m).padStart(2, '0');

describe('o ano e o contrato (D50, D43, D16, D69, D17, D34)', () => {
  test('D50: um ano antes da primeira versão é vermelho e diz para não usar os números; o ano futuro fica âmbar', () => {
    const a = avisos(resumo([], { ano: 2023 }), /regras de 2023/);
    igual(a, [{ texto: 'A app não tem as regras de 2023: as taxas, os quadros e os códigos desse ano podem ser outros. Não uses estes números para a declaração desse ano.',
      abrir: '', toca: '', nivel: 'falta' }]);
    assert.equal(app.fiscoAvisos(resumo([], { ano: 2023 }))[0].nivel, 'falta', 'à cabeça');
    const f = avisos(resumo([], { ano: 2027 }), /regras de 2027/);
    assert.equal(f.length, 1);
    assert.equal(f[0].nivel, 'aviso');
    assert.match(f[0].texto, /^Ainda não há versão das regras de 2027\. Usam-se as de 2026, a mais recente/);
    assert.equal(avisos(resumo([], { ano: 2025 }), /regras de/).length, 0, 'um ano com versão própria não diz nada');
  });

  test('D43: um contrato sem data de início é uma falta, com o toque no contrato; vários vão para a lista', () => {
    const c = ct({ start: '' }), d = ct({ id: 'C2', name: 'Garagem', start: '' });
    const a = avisos(resumo([linha(c, { inicio: '' })]), /data de início/);
    igual(a, [{ texto: 'Contrato Loja: sem a data de início, que o Anexo F pede — sem ela, os gastos do ano ficam de fora',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'falta' }]);
    const b = avisos(resumo([linha(c, { inicio: '' }), linha(d, { inicio: '', faltas: ['data de início do contrato'] })]), /data de início/);
    assert.equal(b.length, 1);
    assert.match(b[0].texto, /^2 contratos sem a data de início/);
    assert.equal(b[0].abrir, "go('contracts')"); assert.equal(b[0].toca, 'ecra');
  });

  test('D16: a finalidade por indicar é uma falta em todas as linhas, e não só nas com redução', () => {
    const c = ct({ fisco: { estado: 'declarado', numero: '1' } });
    const a = avisos(resumo([linha(c, { naturezaAssumida: true, natureza: '07', taxaReduzida: false })]), /finalidade/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'falta');
    assert.equal(a[0].texto, 'Contrato Loja: sem finalidade, a app assume habitação (natureza 07). Diz se é habitação permanente, não permanente ou não habitacional — a natureza, a taxa e a redução pela duração dependem dela');
    assert.equal(a[0].abrir, "ctView('C1')");
    // pela falta do resumo, também
    const b = avisos(resumo([linha(c, { faltas: ['finalidade do contrato (a natureza 06 ou 07 e a taxa dependem dela)'] })]), /finalidade/);
    assert.equal(b.length, 1);
    assert.equal(avisos(resumo([linha(c)]), /finalidade/).length, 0, 'com a finalidade, nada');
  });

  test('D69: mais do que uma fração no mesmo campo é uma falta do imóvel; o «R/C» não', () => {
    const c = ct();
    const a = avisos(resumo([linha(c, { fracao: 'C e AB', faltas: ['fração: mais do que uma no mesmo campo (C e AB) — no Anexo F cada fração vai numa linha, com a renda que lhe cabe'] })]), /fração/);
    igual(a, [{ texto: 'Imóvel T2 Arroios: o campo da fração tem mais do que uma («C e AB»). No Anexo F cada fração vai numa linha, com a parte da renda que lhe cabe; a app faz uma linha por contrato, por isso divide-a por fração ao preencher',
      abrir: "propView('p1')", toca: 'camada', nivel: 'falta' }]);
    assert.equal(avisos(resumo([linha(c, { fracao: 'R/C Esq' })]), /fração/).length, 0);
  });

  test('D17: a taxa escrita que não é a da lei do ano dá um aviso; igual, isenta ou sem escrita, nada', () => {
    const c = ct({ taxRate: 25, fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } });
    const a = avisos(resumo([linha(c, { taxa: 10, taxaEscrita: 25, motivoTaxa: 'moderada' })]), /escrit/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Contrato Loja: tem 25 % escrito no contrato, mas pelas regras de 2026 a taxa é 10 % \(\w[^)]*\)\. A Declaração usa a da lei; a escrita fica só para a renda líquida$/);
    assert.equal(a[0].nivel, 'aviso'); assert.equal(a[0].abrir, "ctView('C1')");
    assert.equal(avisos(resumo([linha(c, { taxa: 25, taxaEscrita: 25 })]), /escrit/).length, 0, 'igual à lei');
    assert.equal(avisos(resumo([linha(c, { taxa: 10, taxaEscrita: null })]), /escrit/).length, 0, 'sem escrita');
    assert.equal(avisos(resumo([linha(c, { taxa: 0, taxaEscrita: null, isencao: { id: 'paa' } })]), /escrit/).length, 0, 'isento');
    // um resumo antigo (taxaEscrita true e a taxa escrita na linha): a da lei sai do motor
    const b = avisos(resumo([linha(c, { taxa: 25, taxaEscrita: true })]), /escrit/);
    assert.equal(b.length, 1);
    assert.match(b[0].texto, /tem 25 % escrito no contrato, mas pelas regras de 2026 a taxa é 10 %/);
  });

  test('D34: as rendas sem contrato são uma falta, com o valor, e declaram-se na mesma', () => {
    ct();
    const dois = avisos(resumo([], { semContrato: [{ propertyId: 'p1', imovel: 'T2 Arroios', rendas: 1500, n: 2, ids: ['x1', 'x2'] }] }), /sem contrato/);
    igual(dois, [{ texto: '2 rendas de 2026 sem contrato ligado (' + app.euroS(1500) + ') não estão em nenhuma linha do quadro, mas declaram-se na mesma: liga-as ao contrato',
      abrir: "goMovimentos('2026','p1','rendas','income','')", toca: 'ecra', nivel: 'falta' }]); // N134: as rendas do imóvel, e não a lista inteira
    const uma = avisos(resumo([], { semContrato: [{ propertyId: 'p1', imovel: 'T2 Arroios', rendas: 750.5, n: 1, ids: ['x1'] }] }), /sem contrato/);
    assert.equal(uma[0].texto, '1 renda de 2026 sem contrato ligado (' + app.euroS(750.5) + ') não está em nenhuma linha do quadro, mas declara-se na mesma: liga-a ao contrato');
    assert.equal(uma[0].abrir, "txView('x1')"); assert.equal(uma[0].toca, 'camada');
  });
});

describe('as rendas de cada contrato (D15, D23, D58, D88, D56)', () => {
  test('D15: rendas depois do termo sem renovação registada são uma falta, com o toque no contrato', () => {
    const c = ct({ start: '2021-01-01', end: '2025-12-31', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } });
    // a de dezembro de 2025 paga em janeiro, com o mês dito: não é depois do termo
    renda('dez', 'C1', '2026-01-04', 1000, { periodo: '2025-12' });
    for (let m = 1; m <= 11; m++) renda('r' + m, 'C1', `2026-${mes(m)}-08`, 1000);
    const a = avisos(resumo([linha(c)]), /termo/);
    igual(a, [{ texto: 'Contrato Loja: 11 rendas de 2026 depois do termo (31/12/2025) — renovou-se? Usa o «Renovar…» do contrato, ou corrige as datas. Até lá, essas rendas vão sem a redução do período que acabou',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'falta' }]);
    // com a renovação registada, nada
    c.fisco.renovacoes = [{ inicio: '2026-01-01', fim: '2028-12-31' }];
    assert.equal(avisos(resumo([linha(c)]), /termo/).length, 0);
    // uma renovação que só começa em março deixa janeiro e fevereiro depois do termo
    c.fisco.renovacoes = [{ inicio: '2026-03-01', fim: '2029-02-28' }];
    assert.match(avisos(resumo([linha(c)]), /termo/)[0].texto, /^Contrato Loja: 2 rendas de 2026 depois do termo \(31\/12\/2025\)/);
    // um contrato terminado também não: as rendas depois do fim não são de uma renovação
    c.fisco.renovacoes = []; c.active = false;
    assert.equal(avisos(resumo([linha(c)]), /termo/).length, 0);
  });

  test('D15, de ponta a ponta: o resumo do ano dá o aviso', () => {
    ct({ start: '2021-01-01', end: '2025-12-31', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } });
    renda('r1', 'C1', '2026-02-08', 1000);
    const r = app.resumoFiscal(ANO, '');
    assert.ok(r.avisos.some((x) => /^Contrato Loja: 1 renda de 2026 depois do termo \(31\/12\/2025\)/.test(x.texto) && x.nivel === 'falta'));
  });

  test('D23: o que entrou mais o retido acima da renda é um aviso «confirma no recibo», renda a renda', () => {
    const c = ct();
    for (let m = 1; m <= 3; m++) renda('r' + m, 'C1', `2026-${mes(m)}-05`, 1000, { retencao: 250 });
    renda('r4', 'C1', '2026-04-05', 750, { retencao: 250 });
    const a = avisos(resumo([linha(c), linha(c, { titularId: 'b' })]), /passa a renda/);
    assert.equal(a.length, 1, 'um contrato conta uma vez, mesmo com uma linha por titular');
    assert.equal(a[0].texto, 'Contrato Loja: nas rendas de janeiro, fevereiro e março de 2026, o que entrou mais o retido passa a renda do contrato (' + app.euroS(1000)
      + '). Confirma no recibo: a renda ilíquida é a do recibo, e o que entrou é ela menos o retido. Se a renda subiu, atualiza-a no contrato');
    assert.equal(a[0].nivel, 'aviso'); assert.equal(a[0].abrir, "goMovimentos('2026','p1','rendas','income','C1')"); assert.equal(a[0].toca, 'ecra'); // N134
    assert.doesNotMatch(a[0].texto, /regist/, 'nunca «regista»');
    // uma só: o toque abre-a
    app.db.transactions = app.db.transactions.filter((t) => t.id === 'r1' || t.id === 'r4');
    const b = avisos(resumo([linha(c)]), /passa a renda/);
    assert.match(b[0].texto, /na renda de janeiro de 2026,/);
    assert.equal(b[0].abrir, "txView('r1')"); assert.equal(b[0].toca, 'camada');
  });

  test('D23: o retido maior do que o que entrou é um aviso', () => {
    const c = ct();
    renda('r1', 'C1', '2026-06-05', 250, { retencao: 750 });
    const a = avisos(resumo([linha(c)]), /maior do que o que entrou/);
    igual(a, [{ texto: 'Contrato Loja: na renda de junho de 2026, o retido é maior do que o que entrou. Confirma no recibo o que entrou e o que o inquilino reteve',
      abrir: "txView('r1')", toca: 'camada', nivel: 'aviso' }]);
  });

  test('D23: sem falso alarme — a renda de dezembro paga em janeiro, a atualização a meio do ano, os pagamentos parciais', () => {
    const c = ct();
    // dezembro de 2025 pago a 8 de janeiro (com o mês dito) e janeiro a 30
    renda('dez', 'C1', '2026-01-08', 750, { retencao: 250, periodo: '2025-12' });
    renda('jan', 'C1', '2026-01-30', 750, { retencao: 250, periodo: '2026-01' });
    // a renda subiu em julho para 1 050 €, e o contrato já a tem
    for (let m = 2; m <= 6; m++) renda('a' + m, 'C1', `2026-${mes(m)}-05`, 750, { retencao: 250 });
    c.rent = 1050;
    for (let m = 7; m <= 10; m++) renda('b' + m, 'C1', `2026-${mes(m)}-05`, 787.5, { retencao: 262.5 });
    // novembro em dois pagamentos que somam a renda
    renda('n1', 'C1', '2026-11-05', 393.75, { retencao: 131.25 });
    renda('n2', 'C1', '2026-11-20', 393.75, { retencao: 131.25 });
    comRetencao();
    const todos = JSON.parse(JSON.stringify(app.fiscoAvisos(resumo([linha(c)]))));
    assert.deepEqual(todos.filter((a) => /Contrato Loja/.test(a.texto)).map((a) => a.texto), [], 'nenhum aviso das rendas');
    // sem o mês dito, a de dezembro conta em janeiro: é o aviso dos meses (D88), não o das retenções
    app.db.transactions.find((t) => t.id === 'dez').periodo = '';
    const r = resumo([linha(c)]);
    assert.equal(avisos(r, /passa a renda|retido é/).length, 0);
    assert.equal(avisos(r, /quadro 8/).length, 1);
  });

  test('D23: o retido que não é a taxa da retenção, só com as regras da versão', () => {
    const c = ct();
    renda('r1', 'C1', '2026-03-05', 850, { retencao: 150 });
    assert.equal(avisos(resumo([linha(c)]), /retido é/).length, 0, 'sem o bloco da retenção na versão, a app não confere a taxa');
    comRetencao();
    igual(avisos(resumo([linha(c)]), /retido é/), [{ texto: 'Contrato Loja: na renda de março de 2026, o retido é 15 % da renda, e não 25 %. Confirma no recibo o que o inquilino reteve',
      abrir: "txView('r1')", toca: 'camada', nivel: 'aviso' }]);
  });

  test('D23: numa renda moderada de habitação, os 25 % antes da alínea f) não são erro; depois, sim', () => {
    const c = ct({ rent: 900, fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } });
    comRetencao();
    renda('fev', 'C1', '2026-02-05', 675, { retencao: 225 });   // 25 % antes de 1 de junho
    renda('jul', 'C1', '2026-07-05', 675, { retencao: 225 });   // 25 % depois
    renda('ago', 'C1', '2026-08-05', 810, { retencao: 90 });    // 10 % depois
    const a = avisos(resumo([linha(c, { taxa: 10, natureza: '07' })]), /retido é/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato Loja: na renda de julho de 2026, o retido é 25 % da renda, e não 10 %. Confirma no recibo o que o inquilino reteve');
    assert.equal(a[0].abrir, "txView('jul')");
  });

  test('D23: abaixo do mínimo da retenção (25 €, DL 49/2025) não se confere', () => {
    const c = ct({ rent: 80 });
    comRetencao();
    renda('r1', 'C1', '2026-03-05', 70, { retencao: 10 });
    assert.equal(avisos(resumo([linha(c)]), /retido é/).length, 0);
  });

  test('D58: inquilino com NIF de empresa e o ano sem retenção — «confirma no recibo», com o toque no inquilino', () => {
    const c = ct({ tenantIds: ['emp'] });
    for (let m = 1; m <= 6; m++) renda('r' + m, 'C1', `2026-${mes(m)}-05`, 1000);
    const a = avisos(resumo([linha(c)]), /não têm retenção/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato Loja: o inquilino Empresa, Lda. tem NIF de empresa ou de outra entidade, e as rendas de 2026 não têm retenção. Confirma no recibo se reteve: uma empresa com contabilidade organizada retém IRS na fonte, e o retido soma-se à renda ilíquida e vai às Retenções na fonte. Se pediste a dispensa, o recibo diz «Sem retenção»');
    assert.equal(a[0].nivel, 'aviso'); assert.equal(a[0].abrir, "personView('tenant','emp')"); assert.equal(a[0].toca, 'camada');
    assert.doesNotMatch(a[0].texto, /regist/);
    // com as regras da versão, as taxas: numa loja só os 25 %
    comRetencao();
    assert.match(avisos(resumo([linha(c)]), /não têm retenção/)[0].texto, /contabilidade organizada retém 25 %, e o retido/);
    // numa habitação, também os 10 % das rendas moderadas
    c.fisco.finalidade = 'hp';
    assert.match(avisos(resumo([linha(c)]), /não têm retenção/)[0].texto, new RegExp('retém 25 % \\(10 % nas rendas de habitação até ' + app.euro(2300) + '\\)'));
  });

  test('D58: cala-se com o «confirmei: não retém», com uma renda retida e abaixo do mínimo; a caixa «Retém IRS» acende-o num particular', () => {
    const c = ct({ tenantIds: ['emp'] });
    for (let m = 1; m <= 3; m++) renda('r' + m, 'C1', `2026-${mes(m)}-05`, 1000);
    app.tenant('emp').retemVisto = true;
    assert.equal(avisos(resumo([linha(c)]), /não têm retenção/).length, 0, 'retemVisto');
    app.tenant('emp').retemVisto = false;
    app.db.transactions.find((t) => t.id === 'r2').retencao = 250;
    app.db.transactions.find((t) => t.id === 'r2').amount = 750;
    assert.equal(avisos(resumo([linha(c)]), /não têm retenção/).length, 0, 'uma renda com retenção');
    // abaixo do mínimo, o inquilino não retém (com as regras da versão)
    app.db.transactions = [];
    c.rent = 80;
    for (let m = 1; m <= 3; m++) renda('p' + m, 'C1', `2026-${mes(m)}-05`, 80);
    comRetencao();
    assert.equal(avisos(resumo([linha(c)]), /não têm retenção/).length, 0, 'retenção abaixo de 25 €');
    // um particular sem a caixa não dá aviso; com ela, sim
    const d = ct({ id: 'C2', name: 'Casa', tenantIds: ['t1'] });
    for (let m = 1; m <= 3; m++) renda('q' + m, 'C2', `2026-${mes(m)}-05`, 1000);
    assert.equal(avisos(resumo([linha(d)]), /não têm retenção/).length, 0);
    app.tenant('t1').retem = true;
    const a = avisos(resumo([linha(d)]), /não têm retenção/);
    assert.match(a[0].texto, /^Contrato Casa: na ficha, o inquilino Ana retém IRS, e as rendas de 2026 não têm retenção\. Confirma no recibo se reteve/);
    assert.equal(a[0].abrir, "personView('tenant','t1')");
  });

  test('D88: duas rendas no mesmo mês, ou uma a dobrar com o mês de antes vazio, são um aviso; os parciais que somam a renda não', () => {
    const c = ct();
    renda('dez', 'C1', '2026-01-08', 1000);          // a de dezembro de 2025, sem o mês dito
    renda('jan', 'C1', '2026-01-30', 1000);
    const a = avisos(resumo([linha(c)]), /quadro 8/);
    // N013, N134: diz que os meses e o limite das rendas moderadas se contam pelo mês de cada renda, e o toque abre as do contrato
    igual(a, [{ texto: 'Contrato Loja: janeiro de 2026 com 2 rendas (' + app.euroS(2000) + ') — confirma a que mês respeita cada renda: os meses e o limite das rendas moderadas contam-se por ele. Uma renda de um ano anterior vai ao quadro 8',
      abrir: "goMovimentos('2026','p1','rendas','income','C1')", toca: 'ecra', nivel: 'aviso' }]);
    // fevereiro sem renda e março a dobrar
    app.db.transactions = [];
    renda('jan', 'C1', '2026-01-05', 1000);
    renda('mar', 'C1', '2026-03-05', 2000);
    assert.equal(avisos(resumo([linha(c)]), /quadro 8/)[0].texto,
      'Contrato Loja: fevereiro de 2026 sem renda e março de 2026 com ' + app.euroS(2000) + ' — é um pagamento de vários meses num movimento? Parte-o num movimento por mês, com o mês a que respeita cada um: os meses e o limite das rendas moderadas contam-se assim. Uma renda de um ano anterior vai ao quadro 8');
    // abril em dois pagamentos que somam a renda: nada
    app.db.transactions = [];
    renda('a1', 'C1', '2026-04-05', 600); renda('a2', 'C1', '2026-04-25', 400);
    assert.equal(avisos(resumo([linha(c)]), /quadro 8/).length, 0);
    // a caução e uma indemnização no mesmo mês não são rendas a dobrar
    renda('cau', 'C1', '2026-04-05', 2000, { sub: 'Caução' });
    renda('ind', 'C1', '2026-04-06', 3000, { sub: 'Indemnização' });
    assert.equal(avisos(resumo([linha(c)]), /quadro 8/).length, 0);
  });

  test('D56: rendas antecipadas sem renda dos primeiros meses — no ano do início e no da assinatura', () => {
    const c = ct({ start: '2026-01-01', end: '2030-12-31', advance: 2,
      fisco: { estado: 'declarado', numero: '1', finalidade: 'hp', celebracao: '2025-12-15' } });
    for (let m = 3; m <= 11; m++) renda('r' + m, 'C1', `2026-${mes(m)}-05`, 1000);
    const a = avisos(resumo([linha(c)]), /antecipad/);
    igual(a, [{ texto: 'Contrato Loja: tem 2 rendas antecipadas e não há renda de janeiro e fevereiro de 2026. Se as recebeste à cabeça, adiciona-as com o dia em que entraram: declaram-se no ano em que as recebeste, com recibo',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'aviso' }]);
    // em 2025, o ano da assinatura, o contrato ainda não tem linha: o aviso aparece na mesma
    assert.equal(avisos(resumo([], { ano: 2025 }), /antecipad/).length, 1);
    // pagas na assinatura, sem o mês dito: contam, e não são meses repetidos
    renda('x1', 'C1', '2025-12-15', 1000); renda('x2', 'C1', '2025-12-15', 1000);
    assert.equal(avisos(resumo([linha(c)]), /antecipad/).length, 0);
    assert.equal(avisos(resumo([linha(c)], { ano: 2025 }), /quadro 8/).length, 0);
    // com o mês dito, também
    app.db.transactions = app.db.transactions.filter((t) => !/^x/.test(t.id));
    renda('y1', 'C1', '2025-12-15', 1000, { periodo: '2026-01' });
    const b = avisos(resumo([linha(c)]), /antecipad/);
    assert.match(b[0].texto, /não há renda de fevereiro de 2026\. Se a recebeste à cabeça, adiciona-a com o dia em que entrou: declara-se/);
    renda('y2', 'C1', '2025-12-15', 1000, { periodo: '2026-02' });
    assert.equal(avisos(resumo([linha(c)]), /antecipad/).length, 0);
    // um contrato ainda por assinar não pede nada
    app.db.transactions = [];
    c.start = '2027-03-01'; c.fisco.celebracao = '2027-02-20';
    assert.equal(avisos(resumo([], { ano: 2027 }), /antecipad/).length, 0);
  });
});

describe('as despesas a confirmar (D06, D07, D24–D27, D60, D61)', () => {
  const d = (txId, categoria, sub, nome, valor, origem) => ({ txId, nome, data: '2026-03-01', valor, propertyId: 'p1', imovel: 'T2 Arroios', categoria, sub, origem: origem || 'categoria' });

  test('uma por categoria, com o nome e o valor de cada despesa; a única abre-se', () => {
    ct();
    const r = resumo([], { aConfirmar: [d('s1', 'Seguros', '', 'Seguro do prédio', 250), d('s2', 'Seguros', 'Outro', 'Seguro do elevador', 120.5),
      d('q1', 'Condomínio', 'Quota extraordinária', 'Obras do telhado', 800, 'sub')] });
    const s = avisos(r, /^Seguros:/), q = avisos(r, /^Condomínio:/);
    igual(s, [{ texto: 'Seguros: 2 despesas de 2026 a confirmar (' + app.euroS(370.5) + ') não contam nos gastos — Seguro do prédio, ' + app.euroS(250) + '; Seguro do elevador, ' + app.euroS(120.5)
      + '. Escolhe na ficha de cada uma a coluna do Anexo F (ou Não dedutível), ou a regra da categoria em Definições → Categorias, etiquetas e IRS',
      abrir: "goMovimentos('2026','p1','Seguros','expense','')", toca: 'ecra', nivel: 'aviso' }]); // N134: os Seguros do imóvel
    assert.equal(q[0].texto, 'Condomínio: 1 despesa de 2026 a confirmar não conta nos gastos — Obras do telhado, ' + app.euroS(800)
      + '. Escolhe na ficha dela a coluna do Anexo F (ou Não dedutível), ou a regra da categoria em Definições → Categorias, etiquetas e IRS. Quota extraordinária: escolhe Conservação e manutenção no ano em que o condomínio paga a obra');
    assert.equal(q[0].abrir, "txView('q1')"); assert.equal(q[0].toca, 'camada');
    assert.ok(!app.fiscoAvisos(r).some((a) => /em Outros/.test(a.texto)), 'o texto antigo «… contam em Outros» saiu');
  });

  test('mais de cinco: as cinco primeiras e «e mais N»; sem regra diz-se «sem regra de dedução»', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7].map((i) => d('o' + i, 'Coisas várias', '', 'Coisa ' + i, 10 * i, 'omissao'));
    const a = avisos(resumo([], { aConfirmar: xs }), /^Coisas várias:/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Coisas várias: 7 despesas de 2026 sem regra de dedução \(/);
    assert.ok(a[0].texto.includes('Coisa 5, ' + app.euroS(50) + '; e mais 2, ' + app.euroS(130) + '.'), a[0].texto);
    assert.ok(!a[0].texto.includes('Coisa 6'));
  });

  test('um resumo sem a lista diz só o número, sem «contam em Outros»', () => {
    const a = avisos(resumo([], { aConfirmar: undefined, semRegra: 2 }), /sem regra/);
    igual(a, [{ texto: '2 despesas sem regra de dedução de 2026: escolhe a coluna do Anexo F nas Definições → Categorias, etiquetas e IRS',
      abrir: "go('settings');goSet('irs')", toca: 'ecra', nivel: 'aviso' }]);
  });
});

describe('os toques com os serviços desligados', () => {
  test('o aviso fica, sem o toque', () => {
    // de habitação permanente: num não habitacional não há redução, e as rendas depois do termo não dão aviso (N032)
    const c = ct({ start: '2021-01-01', end: '2025-12-31', tenantIds: ['emp'], fisco: { estado: 'declarado', numero: '123', finalidade: 'hp' } });
    renda('r1', 'C1', '2026-02-08', 1000);
    app.definirServicosDesligados(['contracts', 'transactions', 'tenants', 'properties']);
    const r = resumo([linha(c, { fracao: 'A, B', faltas: ['fração: mais do que uma'] })], {
      semContrato: [{ propertyId: 'p1', imovel: 'T2 Arroios', rendas: 10, n: 1, ids: ['x'] }],
      aConfirmar: [d0()] });
    const xs = JSON.parse(JSON.stringify(app.fiscoAvisos(r)));
    for (const re of [/termo/, /não têm retenção/, /fração/, /sem contrato/, /^Seguros/]) {
      const a = xs.find((x) => re.test(x.texto));
      assert.ok(a, 'há o aviso ' + re);
      assert.equal(a.abrir, '', re + ' sem toque');
    }
  });
  /* uma despesa a confirmar
     Devolve: a entrada de r.aConfirmar. */
  function d0() { return { txId: 's1', nome: 'Seguro', data: '2026-03-01', valor: 10, propertyId: 'p1', imovel: 'T2 Arroios', categoria: 'Seguros', sub: '', origem: 'categoria' }; }
});
