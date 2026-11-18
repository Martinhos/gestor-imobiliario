// A importação do Splitwise perante a Declaração (KAN-128, folha 2.3.8 do plano
// das correções, com os contratos rev. 5 a rev. 7): a app lança o custo total de
// cada linha e a Declaração reparte-o pela quota do imóvel — sem o campo da
// quota-parte, com a linha da quota e o pedido das quotas na ficha quando o
// imóvel tem um dono só (D122); a categoria e a subcategoria certas, também pela
// descrição e em português (D123); os acertos noutras línguas e pela forma da
// linha (D124); os custos negativos à parte (D125); a deduplicação só contra a
// base de antes e por multiplicidade, com o cabeçalho sem acentos (D126); a
// chave de cada linha, as apagadas de propósito, o «Só desde» e os anos já
// entregues a âmbar (D127); o «Anular» só dos meus lotes, com o que sai de cada
// ano (D128); as linhas noutra moeda fora, com o valor em euros a escrever
// (D129). Cada defeito tem aqui pelo menos um assert, que falhava antes.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

/* O que a app diz e abre durante um teste: os toasts, a última janela e a
   última confirmação (com a função de a aceitar).
   Devolve: {toasts, janela, confirmar, erros}. */
function semEcra() {
  const dito = { toasts: [], janela: null, confirmar: null, erros: [] };
  app.save = () => {};
  app.render = () => {};
  app.closeModal = () => {};
  app.closeAllModals = () => {};
  app.toast = (m) => { dito.toasts.push(m); };
  app.openModal = (titulo, corpo, pe) => { dito.janela = { titulo, corpo, pe }; };
  app.confirmModal = (t, txt, cb) => { dito.confirmar = { t, txt, cb }; };
  app.falhaCampo = (id, msg) => { dito.erros.push({ id, msg }); };
  return dito;
}

/* Uma casa a 50/50 de duas contas (Ana e Bruno), arrendada desde 2025 (1 000 €
   por mês), e um imóvel só da Ana. */
function base() {
  limpar(app);
  const db = app.db;
  db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
  db.properties.push(app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 },
    comproprietariosFora: [], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }));
  db.properties.push(app.normProp({ id: 'v2', name: 'T1 Graça', ownerIds: ['ana'] }));
  db.contracts.push(app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2025-01-01', active: true,
    fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }));
  for (const ano of [2025, 2026]) for (let i = 1; i <= 12; i++) {
    db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', propertyId: 'v1', date: `${ano}-${String(i).padStart(2, '0')}-05` }));
  }
}

/* O CSV como o Splitwise o exporta: Date, Description, Category, Cost,
   Currency e uma coluna por pessoa; no fim, o «Total balance» sem data.
   Recebe: linhas — as linhas do meio; cab (opcional) — o cabeçalho.
   Devolve: o texto. */
function csv(linhas, cab = 'Date,Description,Category,Cost,Currency,Ana,Bruno') {
  return [cab, '', ...linhas, '', ' ,Total balance, , ,EUR,0.00,0.00'].join('\n');
}
/* Lê o CSV como o swParse (sem abrir a janela) e escolhe o imóvel e o «Só
   desde» como a janela os deixa.
   Recebe: texto; prop (opcional) — o imóvel; desde (opcional) — o «Só desde»
   (por omissão o da janela, swDesdeOmissao).
   Devolve: nada. */
function ler(texto, { prop = 'v1', desde } = {}) {
  const t = texto.trim();
  const rows = app.parseCsv(t, app.splitDelim(t.split('\n')[0]));
  app.swHead = rows[0].map((h) => String(h).trim());
  app.swRows = rows.slice(1);
  app.swEuros = {};
  app.window._swCols = app.swColunas();
  app.document.getElementById('sw_prop').value = prop;
  app.document.getElementById('sw_desde').value = desde === undefined ? app.swDesdeOmissao(prop) : desde;
}
/* Importa como o botão «Importar».
   Devolve: o que a app disse. */
function importar(texto, opcoes) {
  const dito = semEcra();
  ler(texto, opcoes);
  app.swDo();
  return dito;
}
const doSplitwise = () => app.db.transactions.filter((t) => t.src === 'splitwise');
/* Os gastos do resumo de um ano para um titular, só os que não são zero. */
const gastos = (ano, eu) => {
  const r = app.resumoFiscal(ano, eu), g = {};
  for (const k of Object.keys(r.totais.gastos)) if (r.totais.gastos[k]) g[k] = r.totais.gastos[k];
  return g;
};

beforeEach(() => base());

describe('D122 — o custo total, e a quota na Declaração', () => {
  test('lança o custo total, sem quota gravada, e cada um deduz a sua metade', () => {
    app.db.settings.quota = 50;
    importar(csv(['2026-03-10,Condomínio 1.º trimestre,Condomínio,1000.00,EUR,500.00,-500.00']));
    assert.deepEqual(doSplitwise().map((t) => t.amount), [1000]);
    assert.equal(app.db.settings.quota, 50, 'a quota guardada não se usa nem se muda');
    assert.equal(gastos(2026, 'ana').condominio, 500);
    assert.equal(gastos(2026, 'bruno').condominio, 500);
  });

  test('a janela não tem o campo da quota-parte: diz a quota do imóvel', () => {
    const dito = semEcra();
    app.CW = { user: { id: 'ana' } };
    ler(csv(['2026-03-10,Condomínio,Condomínio,1000.00,EUR,500.00,-500.00']));
    app.swMapModal();
    assert.doesNotMatch(dito.janela.corpo, /sw_quota|quota-parte \(%\)|põe 50/);
    assert.match(dito.janela.corpo, /A app lança o custo total de cada despesa, como o Splitwise o exporta\. Na tua Declaração conta a tua quota deste imóvel, 50 %\./);
    assert.doesNotMatch(dito.janela.corpo, /Escrever as quotas/, 'a casa já tem as quotas');
  });

  test('um dono só na app e um grupo de duas pessoas: escrever as quotas na ficha', () => {
    semEcra();
    const h = app.swQuotaHtml('v2', 2);
    assert.match(h, /O grupo do Splitwise tem 2 pessoas, e na app este imóvel só tem um dono\. Se a casa é partilhada, escreve na ficha do imóvel as quotas dos outros donos/);
    assert.match(h, /data-click="swEscreverQuotas\(\)">Escrever as quotas</);
    assert.doesNotMatch(app.swQuotaHtml('v2', 1), /Escrever as quotas/, 'um grupo de uma pessoa');
    app.db.properties[1].comproprietariosFora = [{ id: 'f1', nome: 'Carla', quota: 50 }];
    assert.doesNotMatch(app.swQuotaHtml('v2', 2), /Escrever as quotas/, 'com os comproprietários sem conta escritos');
    let aberto = null;
    app.propModal = (id) => { aberto = id; };
    app.document.getElementById('sw_prop').value = 'v2';
    app.swEscreverQuotas();
    assert.equal(aberto, 'v2');
  });

  test('o outro dono importa o mesmo ficheiro: as despesas já lá estão (pelo custo total)', () => {
    importar(csv(['2026-03-10,Condomínio 1.º trimestre,Condomínio,1000.00,EUR,500.00,-500.00']));
    const dito = importar(csv(['2026-03-10,Condomínio 1.º trimestre,Condomínio,1000.00,EUR,500.00,-500.00']), { desde: '' });
    assert.deepEqual(doSplitwise().map((t) => t.amount), [1000]);
    assert.deepEqual(dito.toasts, ['Nada para importar.']);
  });
});

describe('D123 — a categoria e a subcategoria certas', () => {
  test('o mapCat, em inglês e em português, também pela descrição', () => {
    const casos = [
      ['Taxes', 'IMI 2025 (1.ª prestação)', 'Impostos', 'IMI'],
      ['Taxes', 'AIMI 2026', 'Impostos', 'AIMI'],
      ['Impostos', 'Adicional ao IMI', 'Impostos', 'AIMI'],
      ['Mortgage', 'Prestação do crédito agosto', 'Crédito à habitação', 'Prestação mensal'],
      ['Hipoteca', '', 'Crédito à habitação', 'Prestação mensal'],
      ['Gas/fuel', 'Gasóleo ida às obras', 'Outros', ''],
      ['Heat/gas', '', 'Água, luz e gás', 'Gás'],
      ['Aquecimento/gás', '', 'Água, luz e gás', 'Gás'],
      ['Eletricidade', '', 'Água, luz e gás', 'Eletricidade'],
      ['Manutenção', 'Canalizador', 'Manutenção e reparações', ''],
      ['Móveis', '', 'Mobiliário e equipamento', 'Mobiliário'],
      ['Eletrodomésticos', '', 'Mobiliário e equipamento', 'Eletrodomésticos'],
      ['Electronics', '', 'Mobiliário e equipamento', 'Eletrodomésticos'],
      ['General', 'Sofá da sala', 'Mobiliário e equipamento', 'Mobiliário'],
      ['General', 'Prestação do crédito', 'Crédito à habitação', 'Prestação mensal'],
      ['General', 'Jantar', 'Outros', ''],
      ['Condomínio', 'Quota', 'Condomínio', ''],
    ];
    for (const [cat, desc, c, s] of casos) assert.deepEqual([...app.mapCat(cat, desc)], [c, s], cat + ' / ' + desc);
  });

  test('o IMI importado chega ao campo do IMI, o AIMI ao quadro 9, e a prestação e o gasóleo não se deduzem', () => {
    app.db.contracts[0].start = '2026-07-01';
    importar(csv([
      '2026-05-20,IMI 2025 (1.ª prestação),Taxes,600.00,EUR,300.00,-300.00',
      '2026-09-15,AIMI 2026,Taxes,400.00,EUR,200.00,-200.00',
      '2026-08-10,Prestação do crédito agosto,Mortgage,900.00,EUR,450.00,-450.00',
      '2026-08-20,Gasóleo ida às obras,Gas/fuel,80.00,EUR,40.00,-40.00',
    ]), { desde: '' });
    assert.deepEqual([...doSplitwise().map((t) => app.irsColunaDe(t).col)], ['imi', 'nao', 'nao', 'confirmar']);
    const r = app.resumoFiscal(2026, 'ana');
    assert.equal(r.totais.gastos.imi, 300);
    assert.equal(r.totais.gastos.taxas || 0, 0);
    assert.equal(r.totais.gastos.outros || 0, 0);
    const aimi = r.aimi && r.aimi.total;
    app.db.transactions = app.db.transactions.filter((t) => t.src !== 'splitwise');
    app.db.transactions.push(app.normTx({ kind: 'expense', category: 'Impostos', sub: 'AIMI', label: 'AIMI 2026', amount: 400, date: '2026-09-15', propertyId: 'v1' }));
    assert.ok(aimi > 0, 'o AIMI chega ao quadro 9');
    assert.equal(aimi, app.resumoFiscal(2026, 'ana').aimi.total, 'como o lançado à mão');
  });

  test('numa conta com os Impostos renomeados, o IMI vai à categoria dela', () => {
    semEcra();
    app.renameCat('cats', 'Impostos', 'Taxas e impostos');
    assert.deepEqual([...app.swNaConta(app.mapCat('Taxes', 'IMI'))], ['Taxas e impostos', 'IMI']);
    assert.deepEqual([...app.swNaConta(['Condomínio', ''])], ['Condomínio', '']);
  });

  test('a pré-visualização mostra a categoria e a coluna de cada linha, e quantas ficam a confirmar', () => {
    semEcra();
    ler(csv(['2026-05-20,IMI 2026,Taxes,600.00,EUR,300.00,-300.00', '2026-05-21,Jantar,General,80.00,EUR,40.00,-40.00']), { desde: '' });
    const h = app.swPrevHtml(app.swPrepare({ pid: 'v1' }));
    assert.match(h, /<th>Categoria<\/th><th>Coluna no Anexo F<\/th>/);
    assert.match(h, />Impostos › IMI<\/td><td class="u-ta-left u-ws-normal">IMI<\/td>/);
    assert.match(h, />Outros<\/td><td class="u-ta-left u-ws-normal amber">A confirmar<\/td>/);
    assert.match(h, /1 fica «a confirmar»: só conta na Declaração quando escolheres a coluna na ficha da despesa\./);
  });
});

describe('D124 — os acertos entre as pessoas do grupo', () => {
  test('«Pagamento» e «Payment» ficam fora, e a pré-visualização conta-os', () => {
    const dito = importar(csv([
      '2026-03-10,Condomínio 1.º trimestre,Condomínio,1000.00,EUR,1000.00,-1000.00',
      '2026-04-02,Bruno pagou a Ana,Pagamento,1000.00,EUR,-1000.00,1000.00',
      '2026-04-03,Bruno paid Ana,Payment,500.00,EUR,-500.00,500.00',
    ]), { desde: '' });
    assert.deepEqual(doSplitwise().map((t) => t.label), ['Condomínio 1.º trimestre']);
    assert.deepEqual(dito.toasts, ['1 despesa importada.']);
    assert.deepEqual(gastos(2026, 'ana'), { condominio: 500 });
  });

  test('pela forma da linha: duas pessoas com o custo, simétricos, e «X pagou a Y»', () => {
    semEcra();
    ler(csv(['2026-04-02,Bruno pagou a Ana,Geral,300.00,EUR,-300.00,300.00', '2026-04-05,Obra paga pela Ana,General,300.00,EUR,300.00,-300.00']), { desde: '' });
    const p = app.swPrepare({ pid: 'v1' });
    assert.deepEqual([...p.linhas.map((l) => l.tipo)], ['acerto', 'despesa']);
    assert.match(app.swPrevHtml(p), /1 acerto entre as pessoas do grupo \(uma paga à outra o que lhe deve\): não é despesa da casa\./);
  });
});

describe('D125 — um custo negativo é um reembolso', () => {
  test('fica de fora, à parte, e nunca soma como despesa', () => {
    semEcra();
    ler(csv(['2026-05-10,Reparação da canalização,Maintenance,800.00,EUR,800.00,-800.00',
      '2026-06-15,Reembolso do seguro (canalização),Maintenance,-300.00,EUR,-300.00,300.00']), { desde: '' });
    assert.match(app.swPrevHtml(app.swPrepare({ pid: 'v1' })), /1 reembolso \(custo negativo\): Reembolso do seguro \(canalização\)/);
    app.swDo();
    assert.deepEqual(doSplitwise().map((t) => t.amount), [800]);
    assert.deepEqual(gastos(2026, 'ana'), { conservacao: 400 });
  });
});

describe('D126 — a deduplicação e o cabeçalho em português', () => {
  test('duas despesas iguais no mesmo ficheiro entram as duas', () => {
    importar(csv(['2026-01-05,Condomínio,Condomínio,60.00,EUR,60.00,-60.00', '2026-01-05,Condomínio,Condomínio,60.00,EUR,60.00,-60.00']), { desde: '' });
    assert.deepEqual(doSplitwise().map((t) => t.amount), [60, 60]);
    assert.equal(gastos(2026, 'ana').condominio, 60);
  });

  test('por multiplicidade: duas no ficheiro e uma na base, entra uma', () => {
    importar(csv(['2026-01-05,Condomínio,Condomínio,60.00,EUR,60.00,-60.00']), { desde: '' });
    const dito = importar(csv(['2026-01-05,Condomínio,Condomínio,60.00,EUR,60.00,-60.00', '2026-01-05,Condomínio,Condomínio,60.00,EUR,60.00,-60.00']), { desde: '' });
    assert.equal(doSplitwise().length, 2);
    assert.deepEqual(dito.toasts, ['1 despesa importada · 1 repetida ignorada.']);
  });

  test('com o cabeçalho em português, a descrição encontra-se e as despesas diferentes não se fundem', () => {
    const cab = 'Data,Descrição,Categoria,Custo,Moeda,Ana,Bruno';
    semEcra();
    app.swHead = cab.split(',');
    const c = app.swColunas();
    assert.deepEqual([c.data, c.desc, c.custo, c.cat, c.moeda, ...c.pessoas], [0, 1, 3, 2, 4, 5, 6]);
    assert.equal(app.findCol('description', 'descrição', 'descricao'), 1);
    importar(csv(['2026-05-10,Canalizador,Manutenção,80.00,EUR,80.00,-80.00', '2026-05-10,Eletricista,Manutenção,80.00,EUR,80.00,-80.00'], cab), { desde: '' });
    assert.deepEqual(doSplitwise().map((t) => t.label + ' ' + t.category), ['Canalizador Manutenção e reparações', 'Eletricista Manutenção e reparações']);
    assert.deepEqual(gastos(2026, 'ana'), { conservacao: 80 });
  });
});

describe('D127 — a chave de cada linha, as apagadas, o «Só desde» e os anos entregues', () => {
  const grupo = ['2025-02-10,Condomínio 2025,Condomínio,1200.00,EUR,1200.00,-1200.00',
    '2025-06-10,Prestação do crédito,Mortgage,900.00,EUR,900.00,-900.00',
    '2025-09-10,Sofá da sala,General,700.00,EUR,700.00,-700.00'];

  test('cada despesa importada guarda a chave da linha (data, descrição, custo total, categoria)', () => {
    importar(csv([grupo[0]]), { desde: '' });
    assert.equal(doSplitwise()[0].swKey, app.normSwKey('2025-02-10|Condomínio 2025|1200.00|Condomínio'));
  });

  test('reimportar o grupo não repõe o que se corrigiu nem o que se apagou de propósito', () => {
    importar(csv(grupo), { desde: '' });
    const apagadas = doSplitwise().filter((t) => /Prestação|Sofá/.test(t.label));
    app.db.transactions = app.db.transactions.filter((t) => !apagadas.includes(t));
    app.swIgnorar(apagadas);
    doSplitwise().find((t) => t.label === 'Condomínio 2025').label = 'Condomínio 2025 (quotas)';
    const antes = gastos(2025, 'ana');
    const dito = importar(csv([...grupo, '2026-02-10,Condomínio 2026,Condomínio,1200.00,EUR,1200.00,-1200.00']), { desde: '' });
    assert.deepEqual(dito.toasts, ['1 despesa importada · 1 repetida ignorada.']);
    assert.deepEqual(gastos(2025, 'ana'), antes);
    app.swDesignorar(apagadas.slice(0, 1));
    assert.equal(app.db.settings.swIgnoradas.length, 1, 'o Anular de quem apagou devolve a linha');
  });

  test('o «Só desde» por omissão é o da última importação para o imóvel', () => {
    assert.equal(app.swDesdeOmissao('v1'), '');
    importar(csv(grupo), { desde: '' });
    assert.equal(app.swDesdeOmissao('v1'), '2026-11-17', 'o dia em que se importou');
    const lote = (d) => doSplitwise().forEach((t) => { t.batch = 'b' + new Date(d + 'T12:00:00').getTime(); });
    lote('2025-08-01');
    assert.equal(app.swDesdeOmissao('v1'), '2025-09-11', 'o dia a seguir à mais recente, quando é mais tarde');
    lote('2026-02-01');
    assert.equal(app.swDesdeOmissao('v1'), '2026-02-01');
    assert.equal(app.swDesdeOmissao('v2'), '');
    const dito = importar(csv([...grupo, '2026-02-10,Condomínio 2026,Condomínio,1200.00,EUR,1200.00,-1200.00']));
    assert.deepEqual(dito.toasts, ['1 despesa importada.']);
  });

  test('a pré-visualização diz quantas caem em cada ano, a âmbar nos anos cujo prazo acabou', () => {
    semEcra();
    ler(csv([grupo[0], '2026-02-10,Condomínio 2026,Condomínio,1200.00,EUR,1200.00,-1200.00']), { desde: '' });
    const h = app.swPrevHtml(app.swPrepare({ pid: 'v1' }));
    assert.match(h, /<p class="small amber">2025: 1 despesa, 1\s?200,00\s?€ — o prazo da declaração de 2025 já acabou: se já a entregaste, importar muda os gastos dela\.<\/p>/);
    assert.match(h, /<p class="small">2026: 1 despesa, 1\s?200,00\s?€<\/p>/);
    ler(csv([grupo[0]]), { desde: '2026-01-01' });
    assert.match(app.swPrevHtml(app.swPrepare({ pid: 'v1', desde: '2026-01-01' })), /1 despesa de antes do «Só desde»\./);
  });
});

describe('D128 — anular só a minha importação, e dizer o que sai de cada ano', () => {
  test('a confirmação diz quanto sai de cada ano, a âmbar no ano entregue', () => {
    importar(csv(['2025-02-10,Condomínio 2025,Condomínio,1200.00,EUR,1200.00,-1200.00', '2026-02-10,Condomínio 2026,Condomínio,1200.00,EUR,1200.00,-1200.00']), { desde: '' });
    const dito = semEcra();
    app.undoImport();
    assert.match(dito.confirmar.txt, /Apagar as 2 despesas da tua última importação/);
    assert.match(dito.confirmar.txt, /<p class="small amber">2025: 1 despesa, 1\s?200,00\s?€ — o prazo da declaração de 2025 já acabou: se já a entregaste, anular muda os gastos dela\.<\/p>/);
    dito.confirmar.cb();
    assert.equal(doSplitwise().length, 0);
  });

  test('numa casa partilhada, o lote do outro dono não se anula daqui', () => {
    semEcra();
    app.CW = { user: { id: 'ana' } };
    const tx = (label, batch, quem) => Object.assign(app.normTx({ kind: 'expense', category: 'Condomínio', label, amount: 100, date: '2026-03-10', propertyId: 'v1', batch, src: 'splitwise' }), { _createdBy: quem, _author: quem });
    app.db.transactions.push(tx('Condomínio (Ana)', 'b1760000000000', 'ana'), tx('Canalizador (Bruno)', 'b1770000000000', 'bruno'));
    assert.deepEqual(JSON.parse(JSON.stringify(app.ultimaImportacao())), { n: 1, data: app.dataDoInstante('1760000000000') });
    const dito = semEcra();
    app.undoImport();
    dito.confirmar.cb();
    assert.deepEqual(doSplitwise().map((t) => t.label), ['Canalizador (Bruno)']);
    assert.equal(app.ultimaImportacao(), null, 'já não há importações minhas');
  });
});

describe('D129 — a moeda de cada linha', () => {
  const linha = '2026-05-10,Reparação (orçamento em GBP),Maintenance,1000.00,GBP,1000.00,-1000.00';

  test('noutra moeda fica fora, listada, com o campo do valor em euros', () => {
    const dito = importar(csv([linha]), { desde: '' });
    assert.deepEqual(dito.toasts, ['Nada para importar.']);
    assert.match(app.swPrevHtml(app.swPrepare({ pid: 'v1' })), /1 despesa noutra moeda:<\/b> escreve o valor em euros \(o do extrato\) para a importar; em branco, fica de fora\.[\s\S]*1000,00 GBP — em euros<input id="sw_eur_0" type="text" inputmode="decimal" value="" placeholder="Opcional"/);
  });

  test('com o valor em euros escrito, entra com ele, e a moeda fica nas notas', () => {
    semEcra();
    ler(csv([linha]), { desde: '' });
    app.document.getElementById('sw_eur_0').value = '1170,00';
    app.swDo();
    assert.deepEqual(doSplitwise().map((t) => [t.amount, t.notes]), [[1170, 'No Splitwise: 1000,00 GBP.']]);
    assert.equal(gastos(2026, 'ana').conservacao, 585);
  });

  test('um valor em euros que não é um número maior que zero pára, com o erro junto ao campo', () => {
    const dito = semEcra();
    ler(csv([linha]), { desde: '' });
    app.document.getElementById('sw_eur_0').value = 'abc';
    app.swDo();
    assert.deepEqual(dito.erros.map((e) => e.id), ['sw_eur_0']);
    assert.equal(doSplitwise().length, 0);
  });
});

test('o exemplo de categoria de receitas e o mapa não falam de alojamento local', () => {
  assert.doesNotMatch(String(app.swCatDoTexto) + String(app.mapCat), /alojamento|airbnb|\bal\b/i);
});

describe('apagar uma linha importada fica entre as apagadas de propósito, e o Anular tira-a (D127)', () => {
  test('o delTx guarda a chave em settings.swIgnoradas, e o Anular repõe o movimento e tira a chave', () => {
    limpar(app);
    const avisos = [];
    app.save = () => {}; app.render = () => {}; app.closeAllModals = () => {};
    app.toast = (m, o) => { avisos.push({ m, o }); };
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
    const chave = '2025-02-10|Condomínio 2025|1200.00|Condomínio';
    app.db.transactions = [app.normTx({ id: 'SW1', kind: 'expense', label: 'Condomínio 2025', amount: 1200, propertyId: 'P1', date: '2025-02-10', swKey: chave })];
    app.delTx('SW1');
    assert.equal(app.db.transactions.length, 0);
    assert.deepEqual([...app.db.settings.swIgnoradas], [app.normSwKey(chave)], 'reimportar o grupo não a repõe');
    const anular = avisos.pop();
    assert.equal(anular.m, 'Movimento apagado.');
    anular.o.fn();
    assert.equal(app.db.transactions.length, 1, 'o Anular repõe o movimento');
    assert.deepEqual([...app.db.settings.swIgnoradas], [], 'e a linha deixa de estar entre as apagadas');
  });
});

describe('D122 e D126 — uma despesa reposta pela Declaração não volta a entrar ao reimportar', () => {
  test('a chave da reposição (sem a categoria do CSV) conta como a mesma linha', () => {
    // uma despesa antiga, reposta pelo «Repor o total» da Declaração: o total e a chave sem a categoria
    const t = app.normTx({ kind: 'expense', src: 'splitwise', label: 'Condomínio', amount: 60, propertyId: 'v1', date: '2026-01-05', category: 'Condomínio', sub: '' });
    t.swKey = app.fiscoAvChaveSplitwise(t, 60);
    app.db.transactions.push(t);
    importar(csv(['2026-01-05,Condomínio,Condomínio,60.00,EUR,60.00,-60.00']), { desde: '' });
    assert.equal(doSplitwise().length, 1, 'não duplica a despesa reposta');
  });
});
