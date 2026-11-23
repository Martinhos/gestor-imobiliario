// A página da Declaração e os cartões, depois da segunda auditoria ao IRS:
//   N001  o cartão do quadro 10 está na pilha da página, depois do quadro 9
//   N040  um ano só com o quadro 10 (ou só com a regularização do n.º 20) mostra a página com
//         o cartão e a barra de partilha, e não «Sem rendas»
//   N008  o quadro 10 com a identificação matricial, o titular e o NIF ou o país do inquilino,
//         pela ordem do impresso, uma entrada por titular em conjunta
//   N009  o ano de início do benefício que a app não sabe ao certo diz «a confirmar» e porquê
//   N101  a linha com a redução caída pelo n.º 20 diz «a redução caiu (n.º 20): confirma o quadro»
//   N137  o Anexo F é de quem tem direito às rendas: havendo usufruto, os usufrutuários
//   N020  em conjunta sem cônjuge com conta, a escolha «Os bens são comuns do casal» (D5)
// Os campos novos do resumo (as entradas de r.cessados por titular com a matriz e os
// inquilinos, anoInicioConfirmar e anoInicioPorque, l.reducaoCaida, r.bensComuns,
// r.conjugeFora, l.conjugeFora) testam-se também com um resumo feito à mão com essa forma.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-20' });
afterEach(() => repor(app));

/* o texto de um bocado de HTML, sem as etiquetas */
const texto = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/* uma cópia JSON (os objetos vêm do contexto da app) */
const j = (x) => JSON.parse(JSON.stringify(x));

/* um movimento normalizado, já na base
   Recebe: extra — os campos do movimento.
   Devolve: o movimento. */
const mov = (extra) => {
  const t = app.normTx(Object.assign({ kind: 'income', category: 'Rendas', propertyId: 'v1', recibo: true }, extra));
  app.db.transactions.push(t);
  return t;
};
/* as rendas mensais de um contrato num ano, de um mês a outro
   Recebe: id — o contrato; ano; valor; de, ate — os meses (1 a 12). */
const rendas = (id, ano, valor, de = 1, ate = 12) => {
  for (let m = de; m <= ate; m++) mov({ amount: valor, contractId: id, date: ano + '-' + String(m).padStart(2, '0') + '-05' });
};
/* um contrato com redução, já na base
   Recebe: o — os campos que mudam. */
const contrato = (o) => app.db.contracts.push(app.normContract(Object.assign({ name: 'Lumiar', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, active: true }, o)));

/* o HTML de um cartão da página (fisCartao), pelo título
   Recebe: html — a página; titulo — o começo do título.
   Devolve: o HTML do cartão, até ao cartão seguinte. */
function cartao(html, titulo) {
  const i = html.indexOf('<h2 class="ana-tit">' + titulo);
  assert.ok(i > -1, 'há o cartão ' + titulo);
  const ini = html.lastIndexOf('<section', i);
  const fim = html.indexOf('<section', i);
  return html.slice(ini, fim > -1 ? fim : undefined);
}
/* o valor de um campo num cartão
   Recebe: h — o HTML; campo — o rótulo.
   Devolve: o HTML do <dd>, ou null. */
function valorDe(h, campo) {
  const m = new RegExp('<dt>' + campo.replace(/[().]/g, '\\$&') + '(?:<span class="small">[^<]*</span>)?</dt><dd>(.*?)</dd>').exec(h);
  return m ? m[1] : null;
}

beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }), app.normPerson({ id: 't2', name: 'Vera', pais: 'Espanha' }));
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Lumiar', ownerIds: ['ana'], freguesiaCodigo: '110621', tipoPredio: 'U', matrix: '7000', fraction: 'C' }));
  app.fiscoAno = '2026';
});

describe('N001 · o quadro 10 na página', () => {
  test('um contrato do 4.2 que acabou no ano (motivo 02): a página tem o cartão, depois do 4.2 e antes do aviso', () => {
    contrato({ id: 'L1', start: '2024-01-01', end: '2033-12-31', active: false,
      fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp', comunicacoes: { 2024: '2025-02-10' }, comunicacoesV: 2, cessacao: { data: '2026-06-30', motivo: '02' } } });
    rendas('L1', 2025, 1000); rendas('L1', 2026, 1000, 1, 6);
    const r = app.resumoFiscal(2026);
    assert.equal(r.cessados.length > 0, true, 'controlo: o resumo tem o cessado');
    const html = app.vFisco();
    const t = texto(html);
    assert.match(t, /Quadro 10 · contratos que acabaram/);
    assert.ok(t.includes('Regime fiscal ' + r.cessados[0].regime), 'o regime');
    assert.match(t, /N\.º do contrato 1010101/);
    assert.match(t, /Data da cessação 30\/06\/2026/);
    assert.match(t, /Motivo 02/);
    const i42 = html.indexOf('Quadro 4.2 · com redução'), i10 = html.indexOf('Quadro 10 · contratos que acabaram'), iAviso = html.indexOf('fis-aviso');
    assert.ok(i42 > -1 && i10 > i42 && iAviso > i10, 'pela ordem do impresso, dentro da pilha');
  });

  test('o cartão vem depois do quadro 9 (o AIMI) e antes do Anexo J', () => {
    const fonte = app.vFisco.toString();
    const a = fonte.indexOf('fiscoAimiCard(r)'), q = fonte.indexOf('fiscoQuadro10Card(r)'), jj = fonte.indexOf('fiscoAnexoJCard(r)');
    assert.ok(a > -1 && q > a && jj > q, '8, 9, 10');
  });
});

describe('N040 · um ano só com o quadro 10', () => {
  test('acabou antes da primeira renda do ano: a página mostra o quadro 10 e a barra, e não «Sem rendas»', () => {
    contrato({ id: 'L1', start: '2021-01-11', end: '2026-01-10', active: false,
      fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp', cessacao: { data: '2026-01-10', motivo: '03' } } });
    rendas('L1', 2025, 1000);
    const r = app.resumoFiscal(2026);
    assert.equal(r.linhas.length, 0, 'controlo: sem linhas em 2026');
    assert.equal(r.cessados.length > 0, true, 'controlo: com o cessado');
    const html = app.vFisco(), t = texto(html);
    assert.doesNotMatch(t, /Sem rendas em 2026/);
    assert.match(t, /Quadro 10 · contratos que acabaram/);
    assert.match(t, /Em 2026 não tens rendas nos quadros 4, mas o quadro 10 é do ano em que o contrato acabou: vai na declaração de 2026 na mesma\./);
    assert.match(html, /data-click="fiscoPartilha\(\)"/, 'a barra de partilha, para o PDF e o CSV');
  });

  test('só com a regularização do n.º 20 (motivo 01, sem rendas no ano): a página diz a regularização', () => {
    contrato({ id: 'L1', start: '2022-01-01', end: '2026-12-31', active: false,
      fisco: { estado: 'declarado', numero: '2020202', finalidade: 'hp', comunicacoes: { 2022: '2023-02-10' }, comunicacoesV: 2, cessacao: { data: '2026-01-03', motivo: '01' } } });
    rendas('L1', 2024, 1000); rendas('L1', 2025, 1000);
    const r = app.resumoFiscal(2026);
    assert.equal(r.linhas.length, 0, 'controlo: sem linhas em 2026');
    assert.equal(app.fiscoRegularizacao(r), 480, 'controlo: a regularização de 2024 e 2025');
    const html = app.vFisco(), t = texto(html);
    assert.doesNotMatch(t, /Sem rendas em 2026/);
    assert.match(t, /com a regularização do quadro 10/);
    assert.match(t, /Acabou antes do prazo por motivo do senhorio/);
    assert.ok(t.includes('estimativa sem juros: ' + texto(app.euro2(480))), 'a diferença no cartão do quadro 10');
  });

  test('a guarda conta também um resumo só com a regularização (feito à mão)', () => {
    const r = app.resumoFiscal(2026);
    assert.equal(r.linhas.length + (r.cessados || []).length, 0, 'controlo: nada no ano');
    const antes = app.resumoFiscal;
    app.resumoFiscal = () => Object.assign({}, r, { regularizacoes: [{ contratoId: 'X', nome: 'X', anos: [{ ano: 2025, diferenca: 100 }], total: 100 }],
      totais: Object.assign({}, r.totais, { regularizacao: 100 }) });
    try {
      const t = texto(app.vFisco());
      assert.doesNotMatch(t, /Sem rendas em 2026/);
      assert.match(t, /com a regularização do quadro 10/);
    } finally { app.resumoFiscal = antes; }
  });
});

describe('N008 · o quadro 10 com a matriz, o titular e o inquilino', () => {
  /* um resumo de 2026 com cessados feitos à mão
     Recebe: cs — as entradas de r.cessados; extra — o que mais muda no resumo. */
  const comCessados = (cs, extra) => Object.assign(app.resumoFiscal(2026), { cessados: cs }, extra || {});
  const base = { contratoId: 'L1', nome: 'Lumiar', imovel: 'T2 Lumiar', regime: '03', numero: '1010101', anoInicioBeneficio: 2024,
    anoInicioConfirmar: false, anoInicioPorque: '', data: '2026-06-30', motivo: '02', propertyId: 'v1' };

  test('as colunas do impresso, por esta ordem, da entrada do resumo', () => {
    const x = Object.assign({}, base, { titularId: 'ana', titular: 'A', quota: 1, freguesiaCodigo: '110621', tipoPredio: 'U', artigo: '7000', fracao: 'C',
      inquilinos: [{ id: 't1', nome: 'Tiago', nif: '123456789', pais: '' }] });
    const cs = app.fiscoCamposQuadro10(comCessados([x]), x);
    assert.deepEqual(j(cs.map((c) => c.campo)), ['Regime fiscal', 'N.º do contrato', 'Ano de início do benefício', 'Data da cessação', 'Motivo',
      'Freguesia (código)', 'Tipo', 'Artigo', 'Fração ou secção', 'Titular', 'NIF do inquilino']);
    const h = app.fiscoQuadro10Card(comCessados([x]));
    assert.equal(valorDe(h, 'Freguesia (código)'), '110621');
    assert.equal(valorDe(h, 'Tipo'), 'U');
    assert.equal(valorDe(h, 'Artigo'), '7000');
    assert.equal(valorDe(h, 'Fração ou secção'), 'C');
    assert.equal(valorDe(h, 'Titular'), 'A');
    assert.ok(valorDe(h, 'NIF do inquilino').includes(app.fmtNIF('123456789')), 'o NIF do inquilino');
    assert.ok(cs.every((c) => !/[<>]/.test(c.valor)), 'texto simples, para o PDF');
  });

  test('em conjunta, uma entrada por titular: o titular no cabeçalho e no campo; o país de quem não tem NIF', () => {
    const m = { freguesiaCodigo: '110621', tipoPredio: 'U', artigo: '7000', fracao: 'C', inquilinos: [{ id: 't2', nome: 'Vera', nif: '', pais: 'Espanha' }] };
    const a = Object.assign({}, base, m, { titularId: 'ana', titular: 'A', quota: 0.5 }), b = Object.assign({}, base, m, { titularId: 'rui', titular: 'B', quota: 0.5 });
    const h = app.fiscoQuadro10Card(comCessados([a, b], { variosTitulares: true }));
    const t = texto(h);
    assert.match(t, /Titular A/);
    assert.match(t, /Titular B/);
    assert.match(t, /T2 Lumiar · titular A/);
    assert.match(t, /T2 Lumiar · titular B/);
    assert.match(t, /1 contrato em 2026/, 'o contrato conta uma vez');
    assert.match(t, /País do inquilino Vera Espanha/);
    assert.match(t, /um contrato dos dois vai numa linha por titular/);
  });

  test('em conjunta, a regularização de um contrato dos dois diz-se uma vez, no cartão do primeiro titular', () => {
    const m = { motivo: '01', freguesiaCodigo: '110621', tipoPredio: 'U', artigo: '7000', fracao: 'C', inquilinos: [] };
    const a = Object.assign({}, base, m, { titularId: 'ana', titular: 'A' }), b = Object.assign({}, base, m, { titularId: 'rui', titular: 'B' });
    const regs = [{ contratoId: 'L1', nome: 'Lumiar', anos: [{ ano: 2025, diferenca: 300 }], total: 300 }];
    const t = texto(app.fiscoQuadro10Card(comCessados([a, b], { variosTitulares: true, regularizacoes: regs })));
    assert.equal(t.split('estimativa sem juros, dos dois titulares: ' + texto(app.euro2(300))).length - 1, 1, 'o valor uma vez só');
    assert.match(t, /a estimativa, dos dois titulares, está no cartão do titular A\./);
  });

  test('uma entrada sem a matriz (um resumo antigo) lê-a da linha do 4.x do mesmo contrato, ou da ficha; sem nenhuma, a falta', () => {
    contrato({ id: 'L1', start: '2024-01-01', end: '2033-12-31', active: false,
      fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp', cessacao: { data: '2026-06-30', motivo: '02' } } });
    rendas('L1', 2026, 1000, 1, 6);
    const r = app.resumoFiscal(2026);
    const velha = { contratoId: 'L1', nome: 'Lumiar', imovel: 'T2 Lumiar', regime: '03', numero: '1010101', anoInicioBeneficio: 2024, data: '2026-06-30', motivo: '02' };
    const h = app.fiscoQuadro10Card(Object.assign({}, r, { cessados: [velha] }));
    assert.equal(valorDe(h, 'Freguesia (código)'), '110621', 'da linha do 4.2');
    assert.equal(valorDe(h, 'Artigo'), '7000');
    assert.ok(valorDe(h, 'NIF do inquilino').includes(app.fmtNIF('123456789')));
    const semLinha = app.fiscoQuadro10Card(Object.assign({}, r, { linhas: [], cessados: [velha] }));
    assert.equal(valorDe(semLinha, 'Freguesia (código)'), '110621', 'sem linha no ano: da ficha do imóvel');
    assert.ok(valorDe(semLinha, 'NIF do inquilino').includes(app.fmtNIF('123456789')), 'e o inquilino do contrato');
    app.db.properties.push(app.normProp({ id: 'v9', name: 'Sem matriz', ownerIds: ['ana'] }));
    contrato({ id: 'L9', propertyId: 'v9', tenantIds: [], start: '2024-01-01', end: '2033-12-31', active: false, fisco: { estado: 'declarado', finalidade: 'hp' } });
    const sem = app.fiscoQuadro10Card(Object.assign({}, r, { linhas: [], cessados: [Object.assign({}, velha, { contratoId: 'L9' })] }));
    assert.match(valorDe(sem, 'Freguesia (código)'), /badge red/, 'sem linha nem matriz na ficha: em falta');
    assert.match(valorDe(sem, 'NIF do inquilino'), /badge red/);
  });

  test('de ponta a ponta: o cartão da página tem a matriz e o NIF', () => {
    contrato({ id: 'L1', start: '2024-01-01', end: '2033-12-31', active: false,
      fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp', cessacao: { data: '2026-06-30', motivo: '02' } } });
    rendas('L1', 2026, 1000, 1, 6);
    const h = cartao(app.vFisco(), 'Quadro 10');
    assert.equal(valorDe(h, 'Freguesia (código)'), '110621');
    assert.equal(valorDe(h, 'Tipo'), 'U');
    assert.equal(valorDe(h, 'Titular'), 'A');
    assert.ok(valorDe(h, 'NIF do inquilino').includes(app.fmtNIF('123456789')));
  });
});

describe('N009 · o ano de início do benefício a confirmar', () => {
  const x0 = { contratoId: 'L1', nome: 'Lumiar', imovel: 'T2 Lumiar', regime: '02', numero: '1010101', data: '2026-05-31', motivo: '03',
    titularId: 'ana', titular: 'A', freguesiaCodigo: '110621', tipoPredio: 'U', artigo: '7000', fracao: 'C', inquilinos: [] };
  const card = (x) => app.fiscoQuadro10Card(Object.assign(app.resumoFiscal(2026), { cessados: [x] }));

  test('marcado pelo resumo: o valor com o selo âmbar «a confirmar», e o porquê na nota', () => {
    const h = card(Object.assign({}, x0, { anoInicioBeneficio: 2021, anoInicioConfirmar: true,
      anoInicioPorque: 'o contrato começou em 2021 e a app só tem rendas dele desde 2025: confirma o ano da primeira declaração com a redução' }));
    assert.equal(valorDe(h, 'Ano de início do benefício'), '2021 <span class="badge amber">a confirmar</span>');
    assert.match(h, /<p class="fis-ctc-nota">O contrato começou em 2021 e a app só tem rendas dele desde 2025: confirma o ano da primeira declaração com a redução\.<\/p>/);
  });

  test('certo: sem selo nem nota', () => {
    const h = card(Object.assign({}, x0, { anoInicioBeneficio: 2021, anoInicioConfirmar: false, anoInicioPorque: '' }));
    assert.equal(valorDe(h, 'Ano de início do benefício'), '2021');
    assert.doesNotMatch(h, /a confirmar/);
  });

  test('um resumo sem a marca (o de antes): o contrato começou antes do ano dado, e fica a confirmar', () => {
    contrato({ id: 'L1', start: '2021-06-01', end: '2026-05-31', active: false, fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp' } });
    const h = card(Object.assign({}, x0, { anoInicioBeneficio: 2025 }));
    assert.equal(valorDe(h, 'Ano de início do benefício'), '2025 <span class="badge amber">a confirmar</span>');
    assert.match(texto(h), /O contrato começou em 2021 e a app só tem rendas dele desde 2025\./);
    const certo = card(Object.assign({}, x0, { anoInicioBeneficio: 2021 }));
    assert.doesNotMatch(certo, /a confirmar/, 'o ano do início do contrato não é dúvida');
  });

  test('de ponta a ponta: um contrato de 2021 com rendas na app só desde 2025 não sai como certo', () => {
    contrato({ id: 'L1', start: '2021-06-01', end: '2026-05-31', active: false,
      fisco: { estado: 'declarado', numero: '1010101', finalidade: 'hp', cessacao: { data: '2026-05-31', motivo: '03' } } });
    rendas('L1', 2025, 1000); rendas('L1', 2026, 1000, 1, 5);
    const h = cartao(app.vFisco(), 'Quadro 10');
    const v = valorDe(h, 'Ano de início do benefício');
    assert.ok(v === '2021' || /badge amber">a confirmar/.test(v), 'ou o ano certo, ou a confirmar: ' + v);
    assert.notEqual(v, '2025', 'nunca 2025 dado como certo');
  });
});

describe('N101 · a redução caída pelo n.º 20', () => {
  test('motivo do senhorio aos 30 meses (sem escalão): a linha do 4.2 diz «a redução caiu (n.º 20): confirma o quadro»', () => {
    contrato({ id: 'L1', rent: 3000, start: '2024-01-01', end: '2033-12-31', active: false,
      fisco: { estado: 'declarado', numero: '3030303', finalidade: 'hp', comunicacoes: { 2024: '2025-02-10' }, comunicacoesV: 2, cessacao: { data: '2026-06-30', motivo: '01' } } });
    rendas('L1', 2025, 3000); rendas('L1', 2026, 3000, 1, 6);
    const r = app.resumoFiscal(2026), l = r.linhas.find((x) => x.contratoId === 'L1');
    assert.equal(l.quadro, r.versao.quadros.comReducao, 'controlo: a linha fica no 4.2 (D14)');
    assert.equal(app.fiscoReducaoCaida(r, l), true);
    const h = cartao(app.vFisco(), 'Quadro 4.2');
    assert.match(texto(h), /a redução caiu \(n\.º 20\): confirma o quadro/, 'na linha do resumo do quadro');
    assert.match(h, /<p class="fis-ctc-nota">A redução caiu \(n\.º 20\): confirma o quadro\./, 'e no cartão do contrato, com o porquê');
    assert.match(texto(h), /pergunta-lhe pelo e-balcão antes de entregar/);
    const q10 = texto(cartao(app.vFisco(), 'Quadro 10'));
    assert.match(q10, /a taxa passa a ser a base \(25 %\): a duração que o contrato durou não chega a nenhum escalão/, 'o quadro 10 não chama «da duração» à taxa base');
  });

  test('a marca do resumo manda; sem ela e sem troços regularizados, nada', () => {
    const r = app.resumoFiscal(2026);
    const l = { contratoId: 'X', quadro: r.versao.quadros.comReducao, motivoTaxa: 'base', segmentos: [{ rendas: 100, reducao: true, regulariza: true, taxa: 25, taxaAntes: 10 }] };
    assert.equal(app.fiscoReducaoCaida(r, Object.assign({}, l, { reducaoCaida: false })), false, 'false do resumo');
    assert.equal(app.fiscoReducaoCaida(r, Object.assign({}, l, { reducaoCaida: true })), true);
    assert.equal(app.fiscoReducaoCaida(r, l), true, 'sem a marca, pelos troços');
    assert.equal(app.fiscoReducaoCaida(r, Object.assign({}, l, { motivoTaxa: 'duracao' })), false, 'com uma taxa da duração decorrida, a redução não caiu toda');
    assert.equal(app.fiscoReducaoCaida(r, Object.assign({}, l, { segmentos: [{ rendas: 100, reducao: true, taxa: 15 }] })), false, 'sem regularização');
  });
});

describe('N003 · a comunicação por confirmar na página, como no PDF e no CSV', () => {
  test('a marca antiga de um contrato de 2021 diz «a confirmar na ficha do contrato», e não «o prazo acabou — NÃO»', () => {
    app.fiscoAno = '2025';
    contrato({ id: 'C2', rent: 700, start: '2021-06-01', end: '2026-05-31',
      fisco: { estado: 'declarado', numero: '555', finalidade: 'hp', celebracao: '2021-05-20', rendaAcimaDoLimite: false, comunicacoes: { 2025: '2026-02-10' } } });
    rendas('C2', 2025, 700);
    const l = app.resumoFiscal(2025).linhas.find((x) => x.contratoId === 'C2');
    assert.equal(app.fiscoComunicacaoDe(l).estado, 'confirmar');
    const h = cartao(app.vFisco(), 'Quadro 4.2');
    assert.match(texto(valorDe(h, 'Comunicação')), /^a confirmar na ficha do contrato — a marca de 10\/02\/2026 vem da app antiga/);
    assert.match(texto(h), /1 contrato com a comunicação a confirmar: a marca vem da app antiga/);
    assert.doesNotMatch(texto(h), /o prazo acabou a 15\/02\/2022 — no 4\.2A é NÃO/);
  });
});

describe('os avisos das quotas', () => {
  test('um aviso que abre as quotas de um imóvel tem o botão «Indicar as quotas»', () => {
    assert.equal(app.fiscoRotuloDoAviso("imvAbrirQuotas('v1')"), 'Indicar as quotas');
    assert.equal(app.fiscoRotuloDoAviso("propView('v1')"), 'Abrir imóvel');
  });
});

describe('N137 · o usufruto', () => {
  test('quem só colabora lê que o Anexo F é de quem tem direito às rendas, e que havendo usufruto é o usufrutuário', () => {
    contrato({ id: 'C1', start: '2024-01-01', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } });
    rendas('C1', 2026, 1000, 1, 3);
    app.db.owners.push(app.normPerson({ id: 'bruno', name: 'Bruno' }));
    app.CW = { user: { id: 'carla' } };
    assert.equal(app.resumoFiscal(2026).imoveis, 0, 'controlo: nenhum imóvel da Carla');
    const t = texto(app.vFisco());
    assert.match(t, /Nenhum imóvel teu/);
    assert.match(t, /usufruto, o usufrutuário/);
    assert.match(t, /não quem tem só a nua-propriedade/);
  });

  test('o cartão do contrato: contam só os donos de fora que têm direito às rendas, e nada de copiar da escritura', () => {
    app.db.properties[0] = app.normProp(Object.assign({}, app.db.properties[0], { comproprietariosFora: [{ id: 'f1', nome: 'Filho', quota: 50 }] }));
    contrato({ id: 'C1', start: '2024-01-01', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } });
    rendas('C1', 2026, 1000, 1, 3);
    const r = app.resumoFiscal(2026, 'ana'), l = r.linhas[0];
    const notas = j(app.fiscoQuotaNotas(r, l)).join(' ');
    assert.match(notas, /havendo usufruto, os usufrutuários, e não quem tem só a nua-propriedade/);
    assert.doesNotMatch(app.fiscoQuotaNotas.toString(), /Se a escritura diz outra coisa/);
  });
});

describe('N020 · os bens comuns do casal (D5)', () => {
  /* o cartão da situação de 2026, com o resumo de agora e o que muda */
  const situacao = (extra) => app.fiscoSituacaoCard(Object.assign(app.resumoFiscal(2026, 'ana'), extra || {}));

  test('conjunta sem ninguém para escolher: a escolha «Os bens são comuns do casal», e não o «só entra quando for proprietário»', () => {
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true } } });
    const h = situacao(), t = texto(h);
    assert.match(t, /Os bens são comuns do casal/);
    assert.ok(h.includes('id="fiscoBensComuns" aria-checked="false" aria-label="Os bens são comuns do casal" data-toca="dados" data-click="fiscoSetSituacao(2026,\'bensComuns\',true)"'));
    assert.doesNotMatch(t, /só entra quando ele for proprietário/);
    assert.match(t, /Os imóveis só dele inserem-se à mão no Portal das Finanças/);
    assert.doesNotMatch(h, /style=|onclick=/);
  });

  test('com um cônjuge com conta escolhido, a escolha não aparece', () => {
    app.db.owners.push(app.normPerson({ id: 'rui', name: 'Rui' }));
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true, conjugeId: 'rui' } } });
    assert.doesNotMatch(situacao(), /fiscoBensComuns/);
  });

  test('grava em porAno[ano].bensComuns, e a primeira escrita de outro campo herda-a', () => {
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true } } });
    assert.equal(app.fiscoSetSituacao(2026, 'bensComuns', true), true);
    assert.equal(app.db.settings.irs.porAno[2026].bensComuns, true);
    assert.match(situacao(), /id="fiscoBensComuns" aria-checked="true"/);
    app.fiscoSetSituacao(2027, 'dispensaRecibos', true);
    assert.equal(app.db.settings.irs.porAno[2027].bensComuns, true, '2027 nasce com a de 2026');
    assert.equal(app.fiscoSetSituacao(2026, 'bensComuns', 'sim'), true);
    assert.equal(app.db.settings.irs.porAno[2026].bensComuns, false, 'só true liga');
  });

  test('o que o resumo fez: o imóvel com a linha do cônjuge, o que tem vários donos de fora e o que está todo em meu nome', () => {
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true, bensComuns: true } } });
    const t = texto(situacao({ conjugeFora: { id: 'conjuge~ana', nome: 'Bruno', letra: 'B' },
      bensComuns: { imoveis: [{ propertyId: 'v1', imovel: 'T2 Lumiar', nome: 'Bruno', quota: 0.5 }], porDecidir: [{ propertyId: 'v2', imovel: 'T1 Benfica', nomes: ['Bruno', 'Carla'] }],
        soMeus: [{ propertyId: 'v3', imovel: 'T0 Graça' }] } }));
    assert.match(t, /A parte do teu cônjuge vai numa linha do titular B: T2 Lumiar \(Bruno, 50 %\)\./);
    assert.match(t, /Em T1 Benfica há mais do que um dono fora da app, e a app não sabe qual é o teu cônjuge/);
    assert.match(t, /T0 Graça está todo em teu nome na app: a linha fica inteira no titular A\./);
  });

  test('de ponta a ponta: a Ana e o Bruno (dono fora da app, 50 %), em conjunta com os bens comuns — a linha do B e o que a página diz', () => {
    app.db.properties[0] = app.normProp(Object.assign({}, app.db.properties[0], { comproprietariosFora: [{ id: 'f1', nome: 'Bruno', quota: 50 }] }));
    contrato({ id: 'C1', start: '2024-01-01', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } });
    rendas('C1', 2026, 1000);
    app.CW = { user: { id: 'ana' } };
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: true } } });
    assert.deepEqual(j(app.resumoFiscal(2026).linhas.map((l) => l.titular + ' ' + l.rendas)), ['A 6000'], 'sem a escolha: só a metade da Ana');
    app.fiscoSetSituacao(2026, 'bensComuns', true);
    const r = app.resumoFiscal(2026);
    assert.deepEqual(j(r.linhas.map((l) => l.titular + ' ' + l.rendas)), ['A 6000', 'B 6000'], 'controlo: a linha do cônjuge');
    const t = texto(app.vFisco());
    assert.match(t, /Em tributação conjunta entra também a parte do teu cônjuge nos bens comuns do casal, nas linhas do titular B\./);
    assert.match(t, /Linha do teu cônjuge \(titular B\), que não tem conta na app: os bens são comuns do casal, e a parte de Bruno, o dono fora da app deste imóvel \(50 %\) vai aqui/);
    assert.match(t, /A tua quota-parte \(50 %\) já os desconta, e a parte do teu cônjuge vai numa linha do titular B \(os bens são comuns do casal\)\./);
    assert.doesNotMatch(app.fiscoQuemDeclara(r), /—/, 'o cônjuge sem conta tem nome');
  });

  test('quem declara, o painel e a nota da linha do cônjuge sem conta', () => {
    const r = Object.assign(app.resumoFiscal(2026, 'ana'), { titulares: ['ana', 'conjuge~ana'], conjugeFora: { id: 'conjuge~ana', nome: 'Bruno', letra: 'B' } });
    assert.equal(app.fiscoQuemDeclara(r), 'Ana (A) e Bruno (B)');
    assert.equal(app.fiscoQuemDeclara(Object.assign({}, r, { conjugeFora: { id: 'conjuge~ana', nome: '', letra: 'B' } })), 'Ana (A) e o cônjuge (B)');
    const l = { propertyId: 'v1', titular: 'B', titularId: 'conjuge~ana', conjugeFora: true, quota: 0.5 };
    const notas = j(app.fiscoQuotaNotas(Object.assign({}, r, { bensComuns: { imoveis: [{ propertyId: 'v1', imovel: 'T2 Lumiar', nome: 'Bruno', quota: 0.5 }], porDecidir: [], soMeus: [] } }), l));
    assert.match(notas.join(' '), /Linha do teu cônjuge \(titular B\), que não tem conta na app: os bens são comuns do casal, e a parte de Bruno, o dono fora da app deste imóvel \(50 %\) vai aqui/);
  });
});
