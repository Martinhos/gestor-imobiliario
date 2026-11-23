// Os cartões da Declaração (fisco-quadros.js, fisco.js) das receitas, dos gastos e
// dos quadros 5 e 9 — vaga 3 do IRS, folha 2.3.4 (KAN-128): o que o resumo novo
// calcula tem de chegar ao ecrã com as palavras do impresso.
//   D03  a linha diz a caução recebida; o KPI deixa de dizer que as cauções ficam de fora
//   D21  a linha da indemnização (natureza 05) diz o que é
//   D51  a linha das outras receitas prediais (natureza 02) diz o que é
//   D52  o cartão do quadro 5 (sublocação), e um ano só com ele não é «Sem rendas»
//   D71  o quadro 9 por prédio: a identificação matricial, o campo e o VPT, com o total
//   D28  as obras dos 24 meses: a condição e as por confirmar, com o «Responder»
//   D08  os comproprietários sem conta na app, na nota do cartão
//   D29  as quotas que mudaram no ano, com as datas
//   D93  a quota usada com as casas que tem, e as escritas que não somam 100 %
//   D90  os nomes e os grupos das colunas do impresso
//   D59  sem NIF português: o NIF vazio e o país, sem «não bate certo»
//   D76  a coluna «Atualização da renda superior a 1,02?» nos contratos de antes de 2022
// E as taxas novas do motor (o imóvel reabilitado e a habitação duradoura) com o porquê.
// O resumo é o da folha 2.3.2; onde ajuda, testa-se com um resumo feito à mão com a
// forma do contrato (plano §1.4 «Vaga 3»).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

// um dia depois do ano dos cenários, na época da entrega de 2026
const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

const ANO = 2026;
const mm = (m) => String(m).padStart(2, '0');
const M12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/* os espaços finos dos números (o euro2 separa os milhares com eles) como espaços */
const sp = (s) => String(s).replace(/[\u00a0\u202f]/g, ' ');
/* o texto de um bocado de HTML, sem as etiquetas */
const texto = (html) => sp(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};
const imovel = (extra) => {
  const p = app.normProp(Object.assign({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }, extra || {}));
  app.db.properties.push(p);
  return p;
};
const contrato = (extra, fisco) => {
  const c = app.normContract(Object.assign({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000,
    start: '2026-01-01', active: true }, extra || {}, { fisco: Object.assign({ estado: 'declarado', numero: '1234567', finalidade: 'hp' }, fisco || {}) }));
  app.db.contracts.push(c);
  return c;
};
/* as rendas de um contrato nos meses dados (todos, sem a lista), no dia 5 */
const rendas = (valor, meses, extra) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1',
    date: `${ANO}-${mm(m)}-05`, recibo: true }, extra || {})));
const resumo = (eu) => app.resumoFiscal(ANO, eu === undefined ? 'ana' : eu);
const linhaDe = (r, id, papel) => r.linhas.find((l) => l.contratoId === (id || 'C1') && (l.papel || 'renda') === (papel || 'renda'));
/* um campo do fiscoCamposDe, por grupo e rótulo */
const campo = (cs, grupo, nome) => cs.find((c) => c.grupo === grupo && c.campo === nome);
/* o valor de um campo no HTML de um cartão (o que está no <dd>) */
function valorDe(h, nome) {
  const m = new RegExp('<dt>' + nome.replace(/[()?]/g, '\\$&') + '(?:<span class="small">[^<]*</span>)?</dt><dd>(.*?)</dd>').exec(h);
  return m ? m[1] : null;
}

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('D03 — a caução é renda do ano em que se recebe, e a página di-lo', () => {
  test('a linha diz a caução que as rendas levam', () => {
    imovel(); contrato({ deposit: 1600 });
    rendas(800);
    mov({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 1600, contractId: 'C1', date: '2026-01-02', recibo: true });
    const r = resumo(), l = linhaDe(r);
    assert.equal(l.caucao, 1600, 'controlo: o resumo conta a caução');
    const c = campo(app.fiscoCamposDe(r, l), '', 'Rendas (rendimento ilíquido)');
    assert.equal(c.valor, app.euro2(11200));
    assert.equal(c.sub, 'com ' + app.euro2(1600) + ' de caução');
    assert.match(sp(app.fiscoContratoHtml(r, l)), /<dt>Rendas \(rendimento ilíquido\)<span class="small">com 1 600,00 € de caução<\/span><\/dt>/);
  });

  test('os reembolsos do inquilino e as rendas devolvidas também se dizem; sem nada, nada', () => {
    imovel(); contrato();
    rendas(1000);
    const r = resumo(), l = Object.assign({}, linhaDe(r), { caucao: 0, reembolsos: 240, devolucoes: 1000 });
    assert.equal(campo(app.fiscoCamposDe(r, l), '', 'Rendas (rendimento ilíquido)').sub,
      'com ' + app.euro2(240) + ' de reembolsos do inquilino · menos ' + app.euro2(1000) + ' devolvidos');
    assert.equal(campo(app.fiscoCamposDe(r, linhaDe(r)), '', 'Rendas (rendimento ilíquido)').sub, '');
  });

  test('o KPI das rendas ilíquidas já não diz que as cauções ficam de fora', () => {
    imovel(); contrato();
    rendas(1000);
    const k = app.fiscoKpis(resumo());
    assert.doesNotMatch(k, /cauções e empréstimos recebidos ficam de fora/);
    assert.match(k, /com a caução, que é renda do ano em que a recebes/);
    assert.match(k, /os empréstimos recebidos ficam de fora/);
  });

  test('o cartão do quadro diz o que as rendas ilíquidas levam', () => {
    imovel(); contrato();
    rendas(1000);
    assert.match(texto(app.fiscoQuadroCard(resumo(), '4.1')), /com a caução, no ano em que a recebes, e os reembolsos que o inquilino te pagou, menos as rendas que devolveste/);
  });
});

describe('D21, D51 — as linhas 05 e 02 dizem o que são', () => {
  test('a indemnização: a natureza 05 com o texto da versão, e a nota de porque vai à parte', () => {
    imovel(); contrato();
    rendas(1000, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    mov({ kind: 'income', category: 'Rendas', sub: 'Indemnização', amount: 3000, contractId: 'C1', date: '2026-12-20' });
    const r = resumo(), l5 = linhaDe(r, 'C1', 'indemnizacao');
    assert.ok(l5 && l5.natureza === '05', 'controlo: o resumo faz a linha 05');
    const nat = campo(app.fiscoCamposDe(r, l5), '', 'Natureza');
    assert.equal(nat.valor, '05');
    assert.equal(nat.sub, app.irsAno(ANO).naturezasTexto['05'], 'o texto do impresso, da versão do ano');
    const h = app.fiscoContratoHtml(r, l5);
    assert.match(h, /<span class="small">indemnização \(natureza 05\) · T2 Arroios · taxa 25 % · base<\/span>/);
    assert.match(texto(h), /Indemnização que compensa rendas deste contrato .* vai numa linha à parte do mesmo contrato, com a natureza 05, à taxa base e sem recibo de renda/);
    // a linha das rendas não diz nada disso
    assert.doesNotMatch(app.fiscoContratoHtml(r, linhaDe(r)), /Indemnização que compensa/);
    // o resumo do quadro distingue as duas linhas do mesmo contrato
    const q = texto(app.fiscoQuadroCard(r, '4.1'));
    assert.match(q, /indemnização \(natureza 05\) · T2 Arroios/);
    assert.match(q, /vão numa linha à parte dele, com a natureza 05/);
  });

  test('as outras receitas prediais: a natureza 02 com o texto da versão', () => {
    imovel(); contrato();
    rendas(800);
    mov({ kind: 'income', category: 'Rendas', sub: 'Outras receitas prediais', amount: 1200, contractId: 'C1', date: '2026-06-01' });
    const r = resumo(), l2 = linhaDe(r, 'C1', 'outra');
    assert.ok(l2 && l2.natureza === '02', 'controlo: o resumo faz a linha 02');
    assert.equal(campo(app.fiscoCamposDe(r, l2), '', 'Natureza').sub, app.irsAno(ANO).naturezasTexto['02']);
    const h = app.fiscoContratoHtml(r, l2);
    assert.match(h, /outras receitas prediais \(natureza 02\)/);
    assert.match(texto(h), /a cedência de uso que não é arrendamento/);
  });
});

describe('D52 — o cartão do quadro 5 (sublocação)', () => {
  const sublocacao = () => {
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '123456789', rendaMensal: 600 } }); contrato({ rent: 900 });
    rendas(900);
  };

  test('os campos do impresso, o rendimento e o imposto', () => {
    sublocacao();
    const r = resumo();
    assert.equal(r.quadro5.length, 1, 'controlo: o resumo põe-no no quadro 5');
    const h = app.fiscoQuadro5Card(r);
    assert.match(h, /<h2 class="ana-tit">Quadro 5 · sublocação<\/h2>/);
    assert.equal(valorDe(h, 'Renda recebida (valor ilíquido)'), app.euro2(10800));
    assert.equal(valorDe(h, 'Renda paga ao senhorio'), app.euro2(7200));
    assert.equal(valorDe(h, 'NIF do senhorio'), '<span class="u-ws-nowrap">' + app.fmtNIF('123456789') + '</span>');
    assert.equal(valorDe(h, 'Natureza'), '02');
    assert.match(h, /<dt>Natureza<span class="small">Subarrendamento habitacional<\/span><\/dt>/);
    assert.equal(valorDe(h, 'N.º do contrato'), '1234567');
    assert.equal(valorDe(h, 'Data de início'), '01/01/2026');
    assert.equal(valorDe(h, 'NIF do subarrendatário'), '<span class="u-ws-nowrap">' + app.fmtNIF('123456789') + '</span>');
    assert.equal(valorDe(h, 'Renda recebida menos a paga'), app.euro2(3600));
    assert.equal(valorDe(h, 'Imposto estimado'), app.euro2(r.quadro5[0].imposto));
    assert.match(h, /data-click="ctView\('C1'\)"/, 'tocar abre o contrato');
    assert.match(texto(h), /sem outros gastos \(CIRS art\. 8\.º n\.º 2 c\) e art\. 41\.º n\.º 6\)/);
    assert.match(h, /<b>Total do quadro 5<\/b>/);
  });

  test('sem a renda paga nem o NIF do senhorio, as faltas; sem sublocação, nada', () => {
    imovel({ subarrendamento: { ativo: true, nifSenhorio: '', rendaMensal: 0 } }); contrato({ rent: 900 });
    rendas(900);
    const h = app.fiscoQuadro5Card(resumo());
    assert.equal(valorDe(h, 'Renda paga ao senhorio'), '<span class="badge red">falta na ficha do imóvel</span>');
    assert.equal(valorDe(h, 'NIF do senhorio'), '<span class="badge red">falta na ficha do imóvel</span>');
    assert.equal(app.fiscoQuadro5Card(Object.assign(resumo(), { quadro5: [] })), '');
  });

  test('um ano só com sublocação não é «Sem rendas»: a página mostra o quadro 5 e o KPI di-lo', () => {
    sublocacao();
    const html = sp(app.vFisco());
    assert.doesNotMatch(html, /Sem rendas em 2026/);
    assert.match(html, /Quadro 5 · sublocação/);
    assert.match(html, /mais 10 800 € recebidos no quadro 5 \(sublocação\)/);
  });
});

describe('D71 — o quadro 9 prédio a prédio', () => {
  test('cada prédio com a identificação matricial, o campo do quadro 4 e o VPT, e o total', () => {
    imovel({ vpt: 100000 }); contrato();
    app.db.properties.push(app.normProp({ id: 'v2', name: 'T1 Benfica', ownerIds: ['ana'], freguesiaCodigo: '110624', tipoPredio: 'U', matrix: '777', vpt: 80000 }));
    app.db.contracts.push(app.normContract({ id: 'C2', name: 'Benfica', propertyId: 'v2', tenantIds: ['t1'], rent: 700, start: '2026-01-01', active: true,
      fisco: { estado: 'declarado', numero: '7654321', finalidade: 'hp' } }));
    rendas(1000);
    rendas(700, null, { contractId: 'C2', propertyId: 'v2' });
    const r = resumo();
    r.aimi = { n: 1, total: 120, predios: [{ propertyId: 'v1', imovel: 'T2 Arroios', quadro: '4.1', vpt: 100000 }, { propertyId: 'v2', imovel: 'T1 Benfica', quadro: '4.1', vpt: 80000 }],
      vptArrendados: 180000, vptTotal: 180000, semVpt: [], abate: 60, parte: 60, demonstracao: null, excluidos: [] };
    const t = texto(app.fiscoAimiCard(r));
    // (as linhas do 4.1 vão pelo nome do imóvel: o T1 Benfica é a 4001)
    // e cada prédio tem o seu campo do quadro 9 (9001…, da versão do ano)
    assert.match(t, /T2 Arroios 9001 · 110623-U-4651-A · campo 4002 do quadro 4\.1 · valor patrimonial tributário 100 000,00 €/);
    assert.match(t, /T1 Benfica 9002 · 110624-U-777 · campo 4001 do quadro 4\.1 · valor patrimonial tributário 80 000,00 €/);
    assert.match(t, /Total do valor patrimonial dos prédios 180 000,00 €/);
    assert.equal(app.fiscoMatrizDe('nada'), '', 'sem imóvel, nada');
  });
});

describe('D28 — as obras dos 24 meses, com a condição', () => {
  const comObras = (fisco) => {
    imovel(); contrato({ start: '2026-06-01' }, fisco);
    rendas(1000, [6, 7, 8, 9, 10, 11, 12]);
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Pintura', amount: 1500, date: '2025-09-15' });
  };

  test('por responder: o cartão mostra-as à parte, que não contam, com o «Responder»', () => {
    comObras();
    const r = resumo();
    assert.equal(r.obrasPorConfirmar.length, 1, 'controlo: o resumo deixa-as por confirmar');
    const h = app.fiscoObrasCard(r);
    assert.notEqual(h, '', 'o cartão aparece só com as por confirmar');
    assert.match(h, /Por confirmar — não contam/);
    assert.match(texto(h), /Arroios T2 Arroios · gastos desde 15\/09\/2025 · por responder: ficam fora até confirmares/);
    assert.match(h, /<button type="button" class="btn sm u-mt-6px" data-toca="camada" data-click="ctIrParaPergunta\('C1','c_fobras'\)">Responder<\/button>/);
    assert.match(texto(h), /Só contam se, entretanto, o imóvel esteve só à espera de inquilino, sem uso teu, da família nem alojamento local \(CIRS art\. 41\.º n\.º 7\)/);
    assert.doesNotMatch(texto(h), /Total/, 'nada conta, não há total');
    // o aviso de «A tratar» que leva à mesma pergunta diz «Responder», e não «Abrir»
    assert.equal(app.fiscoRotuloDoAviso("ctIrParaPergunta('C1','c_fobras')"), 'Responder');
  });

  test('com «não», diz que ficam fora; com «sim», entram na linha, com a condição no valor', () => {
    comObras({ obrasSemOutroUso: false });
    assert.match(texto(app.fiscoObrasCard(resumo())), /respondeste que não: ficam fora/);
    app.db.contracts[0].fisco.obrasSemOutroUso = true;
    const r = resumo(), h = app.fiscoObrasCard(r);
    assert.doesNotMatch(h, /Por confirmar/);
    assert.match(texto(h), /Total 1 500,00 €/);
    const v = campo(app.fiscoCamposDe(r, linhaDe(r)), 'Com obras de conservação e manutenção', 'Valor');
    assert.equal(v.valor, app.euro2(1500));
    assert.equal(v.sub, 'o imóvel esteve só à espera de inquilino');
  });
});

describe('D08, D29, D93 — as quotas no cartão do contrato', () => {
  beforeEach(() => { app.db.owners.push(app.normPerson({ id: 'bruno', name: 'Bruno' })); });

  test('D08: os comproprietários sem conta, com a quota de cada um', () => {
    imovel({ comproprietariosFora: [{ id: 'f1', nome: 'João', quota: 50 }] }); contrato();
    rendas(1000);
    const r = resumo(), l = linhaDe(r);
    assert.equal(l.quota, 0.5, 'controlo: a quota já desconta o João');
    const h = app.fiscoContratoHtml(r, l);
    assert.match(h, /quota-parte 50 %/);
    assert.match(h, /<p class="fis-ctc-nota">Fora da app: João \(50 %\)\. A tua quota-parte \(50 %\) já os desconta\. Contam só os que têm direito às rendas: havendo usufruto, os usufrutuários, e não quem tem só a nua-propriedade\.<\/p>/);
    // por inteiro (sem saber quem és) não há quota a dizer
    assert.deepEqual(JSON.parse(JSON.stringify(app.fiscoQuotaNotas(resumo(''), linhaDe(resumo(''))))), []);
  });

  test('D93: a quota com as casas que tem, e as escritas que não somam 100 %', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 49.6 }, comproprietariosFora: [] }); contrato();
    rendas(2000);
    const r = resumo(), l = linhaDe(r), h = app.fiscoContratoHtml(r, l);
    assert.match(h, /quota-parte 50,2 %/, 'não se arredonda a 50 %');
    assert.match(texto(h), /As quotas escritas na ficha do imóvel somam 99,6 %: a app reparte-as na proporção, e a tua quota-parte fica 50,2 %\./);
    assert.match(texto(h), /se o resto é de quem não está na app, junta-o lá, nos comproprietários sem conta/);
    assert.equal(app.fiscoPctQuota(1 / 3), '33,33 %');
    assert.equal(app.fiscoPctQuota(0.5), '50 %');
  });

  test('quotas a somar 100 %: nada a dizer', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, comproprietariosFora: [] }); contrato();
    rendas(1000);
    const r = resumo();
    assert.deepEqual(JSON.parse(JSON.stringify(app.fiscoQuotaNotas(r, linhaDe(r)))), []);
  });

  test('D29: as quotas que mudaram no ano, com as datas', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 75, bruno: 25 }, comproprietariosFora: [],
      quotasHist: [{ ate: '2026-06-30', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, fora: [] }] });
    contrato();
    rendas(1000);
    const r = resumo(), l = linhaDe(r);
    assert.ok(Array.isArray(l.quotas) && l.quotas.length === 2, 'controlo: o resumo dá as quotas do ano');
    assert.match(texto(app.fiscoContratoHtml(r, l)), /As quotas mudaram em 2026: 50 % até 30\/06, 75 % desde 01\/07\. Cada renda e cada gasto contam pela quota do seu dia\./);
  });
});

describe('D90 — os nomes do impresso', () => {
  test('os gastos no grupo «Após início do arrendamento», com o nome de cada coluna', () => {
    imovel(); contrato();
    rendas(1000);
    const r = resumo(), cs = app.fiscoCamposDe(r, linhaDe(r)), N = app.irsAno(ANO).colunasNomes;
    const gastos = cs.filter((c) => c.grupo === N.apos.titulo).map((c) => c.campo);
    assert.deepEqual(JSON.parse(JSON.stringify(gastos)), JSON.parse(JSON.stringify(r.colunas.map((k) => N.apos[k]))));
    assert.ok(gastos.includes('Imposto municipal sobre imóveis') && gastos.includes('Taxas autárquicas') && gastos.includes('Outros'));
    assert.ok(!cs.some((c) => c.campo === 'IMI' || c.campo === 'Outros gastos'), 'os nomes curtos da app saíram');
    // o total do quadro também
    const tq = app.fiscoQuadroCard(r, '4.1');
    assert.match(tq, /<dt>Imposto municipal sobre imóveis<\/dt>/);
    assert.match(texto(tq), /no grupo «Após início do arrendamento»/);
  });

  test('as obras no grupo «Com obras de conservação e manutenção», com as três colunas do impresso', () => {
    imovel(); contrato();
    rendas(1000);
    const r = resumo(), l = Object.assign({}, linhaDe(r), { inicio: '2026-02-01', obras24: { valor: 900, inicioGastos: '2025-11-20' } });
    const g = app.fiscoCamposDe(r, l).filter((c) => c.grupo === 'Com obras de conservação e manutenção').map((c) => [c.campo, c.valor]);
    assert.deepEqual(JSON.parse(JSON.stringify(g)), [['Data de início do contrato de arrendamento (ano, mês)', '02/2026'],
      ['Data de início dos gastos (ano, mês)', '11/2025'], ['Valor', app.euro2(900)]]);
  });
});

describe('D59 — o inquilino sem NIF português', () => {
  test('um número estrangeiro e o país: o NIF vazio, o país com o código a escolher no Portal, e nenhum «não bate certo»', () => {
    app.db.tenants[0] = app.normPerson({ id: 't1', name: 'Lucía', nif: 'X1234567L', pais: 'Espanha' });
    imovel(); contrato();
    rendas(1000);
    const r = resumo(), l = linhaDe(r), cs = app.fiscoCamposDe(r, l);
    const nif = campo(cs, '', 'NIF do inquilino'), pais = campo(cs, '', 'País do inquilino');
    assert.equal(nif.valor, '');
    assert.equal(nif.falta, false);
    assert.equal(nif.sub, 'Lucía · sem NIF português');
    assert.equal(pais.valor, 'Espanha');
    assert.equal(pais.aviso, true);
    const h = app.fiscoContratoHtml(r, l);
    assert.doesNotMatch(h, /não bate certo/, 'nem no campo, nem nas faltas do cartão');
    assert.equal(valorDe(h, 'País do inquilino'), 'Espanha <span class="badge amber">no Portal, o código do país (tabela X)</span>');
    assert.doesNotMatch(app.fiscoQuadroCard(r, l.quadro), /não bate certo/, 'nem no resumo do quadro');
  });

  test('um NIF de nove algarismos errado continua «não bate certo»', () => {
    app.db.tenants[0] = app.normPerson({ id: 't1', name: 'Tiago', nif: '123456780', pais: 'Espanha' });
    imovel(); contrato();
    rendas(1000);
    const r = resumo(), c = campo(app.fiscoCamposDe(r, linhaDe(r)), '', 'NIF do inquilino');
    assert.equal(c.falta, true);
    assert.equal(c.nota, 'não bate certo');
  });
});

describe('D76 — a coluna «Atualização da renda superior a 1,02?»', () => {
  const NOME = () => app.fiscoNomesDoImpresso(resumo()).atualizacao;

  test('o nome é o do impresso, da versão do ano', () => {
    imovel(); contrato();
    rendas(1000);
    assert.equal(NOME(), 'Atualização da renda superior a 1,02?');
  });

  test('num contrato de 2020 por responder: o campo a âmbar, a pedir a resposta no contrato', () => {
    imovel(); contrato({ start: '2020-03-01' });
    rendas(600);
    const r = resumo(), l = linhaDe(r);
    assert.equal(l.atualizacao2023, '', 'controlo: por responder');
    const c = campo(app.fiscoCamposDe(r, l), '', NOME());
    assert.equal(c.valor, '');
    assert.equal(c.aviso, true);
    assert.equal(valorDe(app.fiscoContratoHtml(r, l), NOME()), '<span class="badge amber">por responder no contrato</span>');
  });

  test('respondida: Sim ou Não; num contrato de 2023, a coluna não aparece', () => {
    imovel(); contrato({ start: '2020-03-01' }, { atualizacao2023: 'sim' });
    rendas(600);
    let r = resumo();
    assert.equal(campo(app.fiscoCamposDe(r, linhaDe(r)), '', NOME()).valor, 'Sim');
    app.db.contracts[0].fisco.atualizacao2023 = 'nao';
    r = resumo();
    assert.equal(campo(app.fiscoCamposDe(r, linhaDe(r)), '', NOME()).valor, 'Não');
    app.db.contracts[0].start = '2023-02-01';
    r = resumo();
    assert.equal(campo(app.fiscoCamposDe(r, linhaDe(r)), '', NOME()), undefined);
  });
});

describe('as taxas novas do motor dizem o porquê', () => {
  test('o imóvel reabilitado (6A) e a habitação duradoura (DHD)', () => {
    imovel(); contrato();
    rendas(1000);
    const r = resumo(), l = linhaDe(r);
    assert.equal(app.fiscoTaxaTexto(r, Object.assign({}, l, { taxa: 5, motivoTaxa: 'reabilitacao', segmentos: null }), true), 'taxa 5 % · imóvel reabilitado');
    assert.equal(app.fiscoTaxaTexto(r, Object.assign({}, l, { taxa: 5, motivoTaxa: 'dhd', segmentos: null }), false), '5 % habitação duradoura (DHD)');
  });
});
