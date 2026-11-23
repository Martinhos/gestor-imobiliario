// A página da Declaração: os textos e o aviso (auditoria ao IRS, vaga 1,
// folha 2.1.10 — web/app/fisco.js).
//
// O que aqui se guarda, defeito a defeito:
// - D04: o vazio «Sem rendas em AAAA» nomeia os contratos em vigor no ano sem
//   nenhuma renda registada (um contrato sem rendas não tem linha, e a página
//   ficava só com «Sem rendas»).
// - D12: sem avisos, «A tratar antes de entregar» não diz que não falta nada:
//   «Não encontrámos nada em falta nos dados que registaste».
// - D70: a nota fixa das letras que a app não escreve (F, D1/AF1/DG1).
// - D72, D98: o KPI do imposto é o totais.imposto do resumo (titular a
//   titular, nunca negativo) e o prejuízo diz-se de cada titular.
// - D86: a estimativa é às taxas nacionais; os Açores têm-nas 30 % mais baixas
//   (sem a Madeira, que não se confirmou).
// - D95: para o IRS conta a quota no imóvel, não quem pagou nem a divisão.
// - D96: o Anexo F é de quem é dono, não de quem recebe as rendas.
// - D97: o prejuízo reporta-se com a condição dos 36 meses, titular a titular.
// - D99: o imposto depois do AIMI numa linha do KPI, sem mudar o número; o
//   limite do abate dito como leitura da app.
// - O aviso aprovado (irs.js:IRS_AVISO) num cartão discreto no fim da página,
//   perto do CSV e do PDF.
// - A Declaração requer os Contratos (D57): a janela da partilha leva sempre o
//   CSV e o PDF, e o vazio sem imóveis não pergunta pelos Imóveis.
//
// Os testes do KPI usam um resumo feito à mão com a forma do contrato (§1.4 do
// plano: totais.porTitular, l.prejuizo), que a folha 2.1.7 produz na mesma
// vaga; os da página correm o resumoFiscal de verdade.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

// a app vive na primavera a seguir ao ano do resumo (2025)
const app = carregarApp({ hoje: '2026-03-15' });
const ANO = 2025;
// o repor não liga os serviços que um teste desligou
afterEach(() => app.definirServicosDesligados([]));
afterEach(() => repor(app));

const AVISO = 'A app resume; quem declara és tu, no Portal das Finanças. Confirma cada valor antes de entregar: o imposto aqui é uma estimativa.';

/* O que se lê de um pedaço de HTML: sem etiquetas, com as entidades do esc de
   volta e os espaços juntos (como o testes/irs-termos-aviso.test.js).
   Recebe: html — o HTML (string).
   Devolve: o texto (string). */
function textoDe(html) {
  return String(html).replace(/<\/?(?:b|strong|i|em|span|a|abbr|small)\b[^>]*>/gi, '').replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/* Um movimento do ano, já normalizado, na base.
   Recebe: extra — os campos do movimento.
   Devolve: o movimento. */
const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: ANO + '-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};

/* As doze rendas de um contrato no ano.
   Recebe: contractId — o contrato; valor — a renda; propertyId (opcional) — o imóvel.
   Devolve: nada. */
const rendas = (contractId, valor, propertyId) => {
  for (let i = 1; i <= 12; i++) {
    mov({ kind: 'income', category: 'Rendas', amount: valor, contractId, propertyId: propertyId || 'v1', recibo: true,
      date: `${ANO}-${String(i).padStart(2, '0')}-05` });
  }
};

beforeEach(() => {
  limpar(app);
  app.fiscoAno = String(ANO);
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
  app.db.properties.push(app.normProp({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651' }));
  app.db.contracts.push(app.normContract({ id: 'C1', name: 'Arroios', propertyId: 'v1', tenantIds: ['t1'], rent: 1000, start: '2024-01-01', active: true,
    fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hp' } }));
  app.toast = () => {};
});

/* O cartão de um KPI na página, pelo rótulo: o valor, as linhas de rodapé
   (a do AIMI e a do fim) e a explicação que abre ao toque.
   Recebe: html — a página ou a grelha; rotulo — o rótulo do cartão.
   Devolve: {valor, pes:[HTML], expl} — o HTML de cada um. */
function kpiDe(html, rotulo) {
  const i = html.indexOf('<div class="label">' + rotulo + '</div>');
  assert.ok(i > -1, 'há o cartão ' + rotulo);
  const fim = html.indexOf('<div class="card kpi', i);
  const h = html.slice(i, fim > -1 ? fim : undefined);
  return {
    valor: (/<div class="value [^"]*">(.*?)<\/div>/.exec(h) || [])[1],
    pes: [...h.matchAll(/<div class="foot">(.*?)<\/div>/g)].map((m) => m[1]),
    expl: (/<div class="expl">([\s\S]*?)<\/div>/.exec(h) || [])[1] || '',
  };
}

/* Um resumo feito à mão com a forma do contrato (§1.4): o que os KPIs leem.
   Recebe: totais — o que muda nos totais; extra — o que muda no resumo.
   Devolve: o resumo (objeto). */
function resumoFeito(totais, extra) {
  const cols = ['conservacao', 'condominio', 'imi', 'selo', 'taxas', 'outros'];
  const gastos = {}; cols.forEach((k) => { gastos[k] = 0; });
  return Object.assign({
    ano: ANO, versao: app.irsAno(ANO), colunas: cols, titularId: 'ana', titulares: ['ana'], porInteiro: false, variosTitulares: false,
    linhas: [{ contratoId: 'C1', titularId: 'ana', titular: 'A' }], aimi: null,
    totais: Object.assign({ rendas: 12000, retencoes: 0, gastos, obras24: 0, liquido: 12000, imposto: 3000, prejuizo: 0, anosAnteriores: 0,
      isentos: { n: 0, rendas: 0, liquido: 0 } }, totais),
  }, extra);
}

describe('D04: o vazio «Sem rendas» nomeia os contratos em vigor sem rendas', () => {
  test('um contrato em vigor no ano sem nenhuma renda: a página nomeia-o e diz o que fazer', () => {
    const t = textoDe(app.vFisco());
    assert.match(t, /Sem rendas em 2025/);
    assert.ok(t.includes('O contrato Arroios, em vigor em 2025, não tem nenhuma renda registada neste ano.'), t);
    assert.match(t, /Se recebeste rendas dele, regista-as ligadas ao contrato; as que não recebeste não se declaram\./);
  });

  test('vários: no plural, pelo nome; nem os não declarados, nem os acabados antes do ano, nem os de outro dono', () => {
    app.db.owners.push(app.normPerson({ id: 'bruno', name: 'Bruno' }));
    app.CW = { user: { id: 'ana' } };
    app.db.properties.push(app.normProp({ id: 'v9', name: 'Casa do Bruno', ownerIds: ['bruno'] }));
    app.db.contracts.push(
      app.normContract({ id: 'C2', name: 'Benfica', propertyId: 'v1', tenantIds: ['t1'], rent: 600, start: '2025-06-01', active: true, fisco: { estado: 'declarado' } }),
      app.normContract({ id: 'C3', name: 'Fora', propertyId: 'v1', tenantIds: ['t1'], rent: 500, start: '2024-01-01', active: true, fisco: { estado: 'naoDeclarado' } }),
      app.normContract({ id: 'C4', name: 'Acabado', propertyId: 'v1', tenantIds: ['t1'], rent: 500, start: '2022-01-01', end: '2024-12-31', active: false, fisco: { estado: 'declarado' } }),
      app.normContract({ id: 'C5', name: 'Do Bruno', propertyId: 'v9', tenantIds: ['t1'], rent: 500, start: '2024-01-01', active: true, fisco: { estado: 'declarado' } }),
      // terminado sem data de fim: não diz quando acabou, e não se adivinha
      app.normContract({ id: 'C6', name: 'Sem fim', propertyId: 'v1', tenantIds: ['t1'], rent: 500, start: '2020-01-01', active: false, fisco: { estado: 'declarado' } }),
    );
    const r = app.resumoFiscal(ANO);
    assert.deepEqual(JSON.parse(JSON.stringify(app.fiscoContratosSemRendas(r))), [{ contratoId: 'C1', nome: 'Arroios' }, { contratoId: 'C2', nome: 'Benfica' }]);
    const t = textoDe(app.vFisco());
    assert.ok(t.includes('Os contratos Arroios e Benfica, em vigor em 2025, não têm nenhuma renda registada neste ano.'), t);
    assert.match(t, /Se recebeste rendas deles, regista-as ligadas a cada contrato/);
    assert.doesNotMatch(t, /Fora|Acabado|Do Bruno|Sem fim/);
  });

  test('um ano que ainda não começou não tem contratos em vigor a nomear', () => {
    app.fiscoAno = '2027';
    const t = textoDe(app.vFisco());
    assert.match(t, /Sem rendas em 2027/);
    assert.doesNotMatch(t, /em vigor em 2027/);
  });

  test('com os contratos que o resumo já traz (vaga 2), usa esses; com mais de cinco, «e N outros»', () => {
    const r = resumoFeito({}, { contratosSemRendas: [{ contratoId: 'C1' }, { contratoId: 'X', nome: 'Outro' }] });
    assert.deepEqual(JSON.parse(JSON.stringify(app.fiscoContratosSemRendas(r))), [{ contratoId: 'C1', nome: 'Arroios' }, { contratoId: 'X', nome: 'Outro' }]);
    const sete = 'ABCDEFG'.split('').map((n) => ({ contratoId: n, nome: n }));
    assert.ok(app.fiscoFraseSemRendas(sete, 2025).startsWith('Os contratos A, B, C, D, E e 2 outros, em vigor em 2025, não têm'));
    assert.equal(app.fiscoFraseSemRendas([], 2025), '');
  });

  test('com rendas no ano, a página é a dos quadros, sem a frase do vazio', () => {
    rendas('C1', 1000);
    assert.doesNotMatch(textoDe(app.vFisco()), /não tem nenhuma renda registada/);
  });
});

describe('D12: sem avisos, não se diz que não falta nada', () => {
  test('«Não encontrámos nada em falta nos dados que registaste», e nunca «não falta nada»', () => {
    const h = app.fiscoObrigacoesCard({ ano: ANO, avisos: [] });
    const t = textoDe(h);
    assert.ok(t.includes('Não encontrámos nada em falta nos dados que registaste.'), t);
    assert.match(t, /todas as rendas que recebeste em 2025 estão registadas/);
    assert.doesNotMatch(t, /não falta nada|Nada em falta em/);
    assert.match(t, /Nada encontrado em falta em 2025/);
  });

  test('com avisos, a contagem e a lista, sem a frase do vazio', () => {
    const h = app.fiscoObrigacoesCard({ ano: ANO, avisos: [{ texto: 'Falta X.', nivel: 'falta' }] });
    assert.match(h, /1 ponto de 2025/);
    assert.doesNotMatch(h, /Não encontrámos/);
  });
});

describe('D70: as letras que a app não escreve', () => {
  /* N063 (D8): a F do óbito só com a conjunta; as D1, AF1 e DG1 dos dependentes também em
     separado, numa nota à parte — no cartão aberto (fecha numa linha com «Mudar») */
  test('«A tua situação fiscal» diz as D1, AF1 e DG1 também sem a conjunta; a F só com ela', () => {
    rendas('C1', 1000);
    assert.equal(app.fiscoIrsDefs().conjunta, false);
    let t = textoDe(app.fiscoSituacaoCard(app.resumoFiscal(ANO), true));
    assert.match(t, /D1, AF1 ou DG1/);
    assert.match(t, /essa letra muda-se no Portal das Finanças/);
    assert.doesNotMatch(t, /letra F/, 'sem a conjunta, sem a F');
    app.db.settings.irs = app.normIrsDefs({ porAno: { [ANO]: { conjunta: true } } });
    t = textoDe(app.fiscoSituacaoCard(app.resumoFiscal(ANO), true));
    assert.match(t, /levam a letra F/);
  });
});

describe('D72, D98, D97: o imposto e o prejuízo, titular a titular', () => {
  test('o KPI do imposto é o totais.imposto do resumo (o mesmo cálculo dos quadros)', () => {
    rendas('C1', 1000);
    mov({ kind: 'expense', category: 'Impostos', sub: 'IMI', amount: 300, date: ANO + '-04-10' });
    const r = app.resumoFiscal(ANO);
    assert.ok(r.totais.imposto > 0, 'controlo: há imposto');
    assert.equal(kpiDe(app.vFisco(), 'Imposto estimado').valor, app.euro(r.totais.imposto));
  });

  test('conjunta com prejuízo do B: o imposto só do A, e o prejuízo do B no rodapé do líquido', () => {
    const r = resumoFeito({ liquido: 5300, imposto: 2925, prejuizo: 6400,
      porTitular: { ana: { liquido: 11700, imposto: 2925, prejuizo: 0 }, bruno: { liquido: -6400, imposto: 0, prejuizo: 6400 } } },
    { titulares: ['ana', 'bruno'], variosTitulares: true,
      linhas: [{ contratoId: 'C1', titularId: 'ana', titular: 'A' }, { contratoId: 'L', titularId: 'bruno', titular: 'B' }] });
    const h = app.fiscoKpis(r);
    assert.equal(kpiDe(h, 'Imposto estimado').valor, app.euro(2925));
    const liq = kpiDe(h, 'Rendimento líquido');
    assert.equal(liq.valor, app.euro(5300));
    assert.deepEqual(liq.pes, ['prejuízo a reportar do titular B: ' + app.euro(6400)]);
    assert.match(liq.expl, /Cada titular tem o seu resultado: o prejuízo de um não abate às rendas do outro/);
    assert.match(liq.expl, /36 meses/);
  });

  test('dois titulares com prejuízo: os dois no rodapé, pela letra', () => {
    const r = resumoFeito({ liquido: -900, imposto: 0, prejuizo: 900,
      porTitular: { bruno: { liquido: -400, imposto: 0, prejuizo: 400 }, ana: { liquido: -500, imposto: 0, prejuizo: 500 } } },
    { titulares: ['ana', 'bruno'], variosTitulares: true,
      linhas: [{ contratoId: 'C1', titularId: 'ana', titular: 'A' }, { contratoId: 'L', titularId: 'bruno', titular: 'B' }] });
    assert.deepEqual(kpiDe(app.fiscoKpis(r), 'Rendimento líquido').pes, ['prejuízos a reportar: A ' + app.euro(500) + ' · B ' + app.euro(400)]);
  });

  test('um titular com prejuízo: «prejuízo a reportar», e a condição do n.º 8 em vez de «se o imóvel voltar a dar rendas»', () => {
    const r = resumoFeito({ liquido: -500, imposto: 0, prejuizo: 500, porTitular: { ana: { liquido: -500, imposto: 0, prejuizo: 500 } } });
    const liq = kpiDe(app.fiscoKpis(r), 'Rendimento líquido');
    assert.deepEqual(liq.pes, ['prejuízo a reportar']);
    assert.match(liq.expl, /^As rendas não chegaram para os gastos\./);
    assert.match(liq.expl, /desde que os imóveis desses gastos deem rendas durante pelo menos 36 meses, seguidos ou não, nos cinco anos seguintes \(CIRS art\. 55\.º\)/);
    assert.match(liq.expl, /É de cada titular e só abate às rendas dele/);
    assert.doesNotMatch(liq.expl, /voltar a dar rendas/);
  });

  test('um resumo sem o porTitular (antes da 2.1.7) continua a ler o totais.prejuizo', () => {
    const r = resumoFeito({ liquido: -500, imposto: 0, prejuizo: 500 });
    assert.deepEqual(kpiDe(app.fiscoKpis(r), 'Rendimento líquido').pes, ['prejuízo a reportar']);
  });

  test('o imposto nunca é negativo no KPI, nem com um total negativo vindo do resumo', () => {
    const v = kpiDe(app.fiscoKpis(resumoFeito({ imposto: -1792 })), 'Imposto estimado').valor;
    assert.equal(v, app.euro(0));
    assert.doesNotMatch(v, /[−-]/);
  });

  test('a explicação do imposto: a taxa da lei do ano, titular a titular, nunca negativo', () => {
    const e = kpiDe(app.fiscoKpis(resumoFeito({})), 'Imposto estimado').expl;
    assert.match(e, /à taxa que a lei de 2025 dá ao contrato, somado titular a titular/);
    assert.match(e, /nunca às de outro titular, e o imposto nunca é negativo/);
    assert.doesNotMatch(e, /a escrita no contrato/);
  });
});

describe('D86: a estimativa e os Açores', () => {
  /* N120: as taxas do continente, e os Açores também à vista no cartão */
  test('a explicação do imposto diz as taxas do continente e os Açores, sem a Madeira', () => {
    const k = kpiDe(app.fiscoKpis(resumoFeito({})), 'Imposto estimado'), e = k.expl;
    assert.match(e, /com as taxas do continente: a quem reside nos Açores a AT aplica-as 30 % mais baixas, pela residência/);
    assert.ok(k.pes.includes('taxas do continente; nos Açores a AT aplica menos 30 %'));
    assert.doesNotMatch(e, /Madeira/);
  });
});

describe('D95: para o IRS conta a quota', () => {
  test('a explicação dos gastos diz que conta a quota no imóvel, e não quem pagou nem a divisão', () => {
    const e = kpiDe(app.fiscoKpis(resumoFeito({})), 'Gastos dedutíveis').expl;
    assert.match(e, /Para o IRS conta a quota de cada um no imóvel, e não quem pagou nem a divisão escolhida no movimento \(CIRS art\. 19\.º\)\./);
  });
});

describe('D96: o Anexo F é de quem é dono', () => {
  test('quem só colabora lê que o Anexo F é do dono, e não de quem recebe as rendas', () => {
    rendas('C1', 1000);
    app.db.owners.push(app.normPerson({ id: 'bruno', name: 'Bruno' }));
    app.CW = { user: { id: 'carla' } };
    assert.equal(app.resumoFiscal(ANO).imoveis, 0, 'controlo: nenhum imóvel com quota da Carla');
    const t = textoDe(app.vFisco());
    assert.match(t, /Nenhum imóvel teu/);
    assert.match(t, /O Anexo F é de quem tem direito às rendas, pela sua quota-parte \(CIRS art\. 19\.º\): o dono ou, havendo usufruto, o usufrutuário/);
    assert.match(t, /Quem só recebe as rendas por conta do dono não as declara\./);
    assert.doesNotMatch(t, /de quem recebe as rendas/);
  });
});

/* a linha das taxas do continente, à vista no imposto (N120) */
const AC = 'taxas do continente; nos Açores a AT aplica menos 30 %';

describe('D99: o imposto depois do AIMI', () => {
  const aimi = (abate) => ({ total: 1000, n: 1, predios: [], vptArrendados: 0, vptTotal: 0, semVpt: abate == null ? ['T2 Arroios'] : [], parte: abate, abate });

  test('uma linha «depois do AIMI» sem mudar o número principal, e a falta já com o abate', () => {
    const h = app.fiscoKpis(resumoFeito({ imposto: 3000, retencoes: 500 }, { aimi: aimi(800) }));
    const k = kpiDe(h, 'Imposto estimado');
    assert.equal(k.valor, app.euro(3000), 'o número principal fica');
    assert.deepEqual(k.pes, ['depois do AIMI: ~' + app.euro(2200) + ' (estimativa)', 'já retido ' + app.euro(500) + ' · falta ' + app.euro(1700), AC]);
    assert.match(k.expl, /O AIMI pago abate ao imposto \(quadro 9\)/);
    assert.match(k.expl, /É a leitura da app; a lei fala da coleta à taxa de 28 %, e a conta certa é a da AT\./);
    assert.match(k.expl, /A falta a pagar já conta com este abate\./);
  });

  test('sem o VPT de um prédio, a linha diz que falta; sem AIMI, nada', () => {
    const k = kpiDe(app.fiscoKpis(resumoFeito({}, { aimi: aimi(null) })), 'Imposto estimado');
    assert.deepEqual(k.pes, ['abate do AIMI por estimar: falta um VPT', 'sem englobamento', AC]);
    const s = kpiDe(app.fiscoKpis(resumoFeito({})), 'Imposto estimado');
    assert.deepEqual(s.pes, ['sem englobamento', AC]);
    assert.doesNotMatch(s.expl, /AIMI/);
  });
});

describe('o aviso de responsabilidade, no fim, perto do CSV e do PDF', () => {
  test('a página escreve o IRS_AVISO à letra, uma vez, num cartão no fim com o botão da partilha', () => {
    rendas('C1', 1000);
    const html = app.vFisco();
    assert.equal(app.IRS_AVISO, AVISO);
    assert.ok(textoDe(html).includes(AVISO), 'à letra');
    assert.equal(textoDe(html).split(AVISO).length, 2, 'uma vez');
    const i = html.indexOf('<section class="card fis-aviso">');
    assert.ok(i > html.indexOf('fiscoPilha'), 'depois dos cartões dos quadros');
    const card = html.slice(i, html.indexOf('</section>', i));
    assert.match(card, /<p class="hint">A app resume; quem declara és tu/);
    assert.match(card, /data-click="fiscoPartilha\(\)" aria-haspopup="dialog">.*<span>Exportar CSV ou PDF<\/span><\/button>/);
    assert.doesNotMatch(card, /style=|onclick=/, 'sem estilos nem eventos no HTML (CSP)');
  });
});

describe('a Declaração requer os Contratos (D57): o que perguntava por eles saiu', () => {
  test('a janela da partilha leva sempre o CSV e o PDF', () => {
    let visto = null;
    app.pickModal = (titulo, opcoes) => { visto = opcoes; };
    app.fiscoPartilha();
    assert.deepEqual(JSON.parse(JSON.stringify(visto.map((o) => o.v))), ['csv', 'pdf']);
    assert.doesNotMatch(String(app.fiscoPartilha), /servicoLigado/);
    // a razão: sem os Contratos, a Declaração cai com eles
    app.definirServicosDesligados(['contracts']);
    assert.equal(app.servicoLigado('fisco'), false);
  });

  test('o vazio sem imóveis leva sempre a «Adicionar imóvel» (os Imóveis vêm com os Contratos)', () => {
    app.db.properties.length = 0;
    app.db.contracts.length = 0;
    const h = app.vFisco();
    assert.match(h, /<b>Sem imóveis<\/b>/);
    assert.match(h, /data-click="go\('properties'\)">Adicionar imóvel</);
    assert.doesNotMatch(String(app.vFisco), /servicoLigado|vazioServicoDesligado/);
  });
});
