// Os avisos de «A tratar antes de entregar» das correções da auditoria ao IRS
// de raiz (fisco-avisos.js:fiscoAvisos), ronda 1 (KAN-147 a KAN-149): a
// regularização do n.º 20 com os anos de que a app não tem rendas (N031); as
// rendas depois do termo, só falta quando o período que acabou tinha redução,
// com o termo do período (N032); as rendas de meses depois do dia em que o
// contrato acabou (N033); o fim escrito que conta como o prazo, e o termo no
// próprio dia de uma cessação «antes do prazo» (N098); a redução já caída nos
// avisos da comunicação e do 4.2C (N101); a comunicação da app antiga por
// confirmar, que pergunta o dia em vez de afirmar NÃO (N003); as despesas que a
// AT não aceita e deixaram de contar (N117); os donos fora da app por confirmar
// numa casa de duas contas (N135); as quotas que não somam 100 % (N136); a
// proposta de quotas pendente (N138); o dono que saiu no ano (N021); as quotas
// sem data (N035); a conjunta com o cônjuge sem conta (N020); e a renda e o IMI
// que contam pela quota de outro dia (N069). Os resumos são os do resumoFiscal,
// com dados na base, ou montados à mão com a forma combinada com o resumo.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

// na época da entrega das rendas de 2026
const app = carregarApp({ hoje: '2027-05-10' });
afterEach(() => repor(app));

/* uma cópia simples, com os espaços finos dos euros (U+202F) e os rígidos
   passados a espaços normais, para os textos se escreverem à mão */
const json = (x) => JSON.parse(JSON.stringify(x).replace(/[  ]/g, ' '));
const mm = (m) => String(m).padStart(2, '0');
const M12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/* um movimento na base (no imóvel v1, por omissão)
   Recebe: extra — os campos.
   Devolve: o movimento normalizado. */
const mov = (extra) => {
  const t = app.normTx(Object.assign({ propertyId: 'v1', date: '2026-03-05' }, extra));
  app.db.transactions.push(t);
  return t;
};
/* o imóvel v1, da Ana, com os dados matriciais e os donos fora da app
   confirmados, salvo se o teste disser outra coisa
   Recebe: extra — o que muda.
   Devolve: o imóvel normalizado. */
const imovel = (extra) => {
  const p = app.normProp(Object.assign({ id: 'v1', name: 'T2 Arroios', ownerIds: ['ana'], comproprietariosFora: [],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' }, extra || {}));
  app.db.properties.push(p);
  return p;
};
/* o contrato C1 no imóvel v1, declarado, de habitação permanente
   Recebe: extra — o que muda; fisco — o que muda no bloco fiscal.
   Devolve: o contrato normalizado. */
const contrato = (extra, fisco) => {
  const c = app.normContract(Object.assign({ id: 'C1', name: 'C1', propertyId: 'v1', tenantIds: ['t1'], rent: 1000,
    start: '2026-01-01', active: true }, extra || {}, { fisco: Object.assign({ estado: 'declarado', numero: '1234567', finalidade: 'hp',
    celebracao: '2025-12-15' }, fisco || {}) }));
  app.db.contracts.push(c);
  return c;
};
/* as rendas do C1 nos meses dados (todos, sem a lista), no dia 5, com recibo
   Recebe: valor; meses (opcional); ano (opcional, 2026); extra (opcional). */
const rendas = (valor, meses, ano, extra) => (meses || M12).forEach((m) =>
  mov(Object.assign({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1',
    date: `${ano || 2026}-${mm(m)}-05`, recibo: true }, extra || {})));
/* os avisos do resumo de um ano (2026 por omissão) que casam com a expressão
   Recebe: re — a expressão; ano (opcional).
   Devolve: os avisos (cópias simples). */
const avisos = (re, ano) => json(app.resumoFiscal(ano || 2026, 'ana').avisos).filter((a) => re.test(a.texto));
/* um resumo à mão, com a forma do resumo */
const resumoMao = (extra) => Object.assign({ ano: 2026, titularId: 'ana', titulares: ['ana'], linhas: [], fora: [], semContrato: [],
  aConfirmar: [], obrasSoltas: 0, foraDoPeriodo: 0, semSessao: false, contratosSemRendas: [] }, extra);
/* uma linha do resumo à mão (a das rendas do C1) */
const linhaMao = (extra) => Object.assign({ contratoId: 'C1', propertyId: 'v1', nome: 'C1', imovel: 'T2 Arroios', atNumero: '1234567',
  inicio: '2026-01-01', estado: 'declarado', freguesiaCodigo: '110623', tipoPredio: 'U', artigo: '4651', fracao: 'A', quota: 1,
  natureza: '07', naturezaAssumida: false, titular: 'A', titularId: 'ana', quadro: '4.1', taxa: 25, taxaEscrita: null, isencao: null,
  celebracao: '2025-12-15', acimaDoLimite: null, comunicacao: null, inquilinos: [{ id: 't1', nome: 'Tiago', nif: '123456789', pais: '' }],
  papel: 'renda', rendas: 12000, retencoes: 0, gastos: { selo: 100 }, faltas: [], recibosPorEmitir: 0, mesesEmVigor: 12, mesesComRenda: 12,
  quotas: null, beneficios: [], dhd: null, freguesiaUniao: null, matrizConfirmada: '' }, extra);
const avisosMao = (r, re) => json(app.fiscoAvisos(r)).filter((a) => re.test(a.texto));

beforeEach(() => {
  limpar(app);
  app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {};
  app.db.owners.push(app.normPerson({ id: 'ana', name: 'Ana' }), app.normPerson({ id: 'bruno', name: 'Bruno' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' }));
});

describe('o fim dos contratos (N031, N032, N033, N098, N101)', () => {
  test('N031: a regularização do n.º 20 diz os anos do período de que a app não tem rendas', () => {
    imovel(); contrato({ rent: 3000, start: '2020-01-01', end: '2029-12-31', active: false },
      { celebracao: '2019-12-15', cessacao: { data: '2026-06-30', motivo: '01' } });
    for (const ano of [2022, 2023, 2024, 2025]) rendas(3000, M12, ano);
    rendas(3000, [1, 2, 3, 4, 5, 6]);
    const a = avisos(/motivo do senhorio/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'falta');
    assert.match(a[0].texto, /Faltam os anos 2020 e 2021, de que a app não tem rendas: a diferença deles também se regulariza\. Regista no contrato as rendas em falta para a app a estimar/);
    assert.doesNotMatch(a[0].texto, /de de /);
    // a forma do resumo (anosEmFalta, anosSemRegras) manda quando vem
    const r = resumoMao({ regularizacoes: [{ contratoId: 'C1', nome: 'C1', anos: [{ ano: 2024, diferenca: 3240 }, { ano: 2025, diferenca: 3240 }], total: 6480,
      anosEmFalta: [2018, 2019, 2020, 2021, 2022, 2023], anosSemRegras: [2024] }] });
    const b = avisosMao(r, /motivo do senhorio/);
    assert.match(b[0].texto, /Faltam os anos de 2018 a 2023, de que a app não tem rendas/);
    assert.match(b[0].texto, /A estimativa de 2024 usa as regras de 2025: a app não tem as desses anos$/);
  });

  test('N032: um contrato sem redução que se renova sozinho tem só uma nota, com o termo do contrato', () => {
    imovel(); contrato({ start: '2022-01-01', end: '2022-12-31' }, { celebracao: '2021-12-15' });
    rendas(1000);
    const a = avisos(/depois do termo/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'info', 'sem redução a perder: não é falta');
    assert.match(a[0].texto, /^Contrato C1: 12 rendas de 2026 depois do termo \(31\/12\/2022\), sem renovação registada\. /);
    assert.match(a[0].texto, /o período que acabou não tinha a redução pela duração\. Só uma renovação de 5 anos ou mais a pode ter/);
    assert.doesNotMatch(a[0].texto, /sem a redução do período que acabou/);
    // num não habitacional não há redução nenhuma: nada
    app.db.contracts[0].fisco.finalidade = 'nh';
    assert.equal(avisos(/depois do termo/).length, 0);
  });

  test('N032: com redução no período que acabou continua falta, com o termo do período', () => {
    imovel(); contrato({ start: '2021-01-01', end: '2025-12-31' }, { celebracao: '2020-12-15' });
    rendas(1000);
    const a = avisos(/depois do termo/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'falta');
    assert.match(a[0].texto, /^Contrato C1: 12 rendas de 2026 depois do termo \(31\/12\/2025\) — renovou-se\? /);
    assert.match(a[0].texto, /essas rendas vão sem a redução do período que acabou$/);
  });

  test('N033: as rendas de meses depois do dia em que o contrato acabou têm aviso; a do próprio mês e a em atraso com o mês certo não', () => {
    imovel(); contrato({ start: '2025-01-01', end: '2027-12-31', active: false }, { celebracao: '2024-12-15', cessacao: { data: '2026-06-30', motivo: '02' } });
    rendas(1000, [1, 2, 3, 4, 5, 6, 7, 8]);
    // a de junho paga em setembro, com o mês dito: é do contrato
    mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, contractId: 'C1', date: '2026-09-02', periodo: '2026-06', recibo: true });
    app.db.transactions = app.db.transactions.filter((t) => !(t.date === '2026-06-05'));
    const a = avisos(/depois do dia em que o contrato acabou/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato C1: 2 rendas (2 000 €), de julho e agosto de 2026, respeitam a meses depois do dia em que o contrato acabou (30/06/2026). '
      + 'Confirma o dia da cessação, ou o mês a que cada renda respeita; se são de um contrato novo, liga-as a ele, e se o inquilino ficou sem contrato, '
      + 'são uma indemnização (Rendas › Indemnização, natureza 05). Até lá, contam nas rendas deste');
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].abrir, "ctView('C1')");
    // a forma do resumo: uma entrada por renda
    const r = resumoMao({ rendasDepoisDoFim: [{ txId: 'x1', contratoId: 'C1', nome: 'C1', fim: '2026-06-30', mes: '2026-08', data: '2026-08-05', valor: 1000 }] });
    assert.match(avisosMao(r, /depois do dia/)[0].texto, /^Contrato C1: a renda de agosto de 2026 \(1 000 €\) respeita a um mês depois do dia em que o contrato acabou \(30\/06\/2026\)\. Confirma o dia da cessação, ou o mês a que a renda respeita; se é de um contrato novo, liga-a a ele/);
  });

  test('N098: o terminado sem o dia diz que o fim escrito conta como o prazo; depois do dia, um «antes do prazo» no próprio termo é falta', () => {
    imovel(); contrato({ start: '2021-06-01', end: '2025-09-30', active: false, rent: 1000 }, { celebracao: '2021-05-20' });
    rendas(1000, [1, 2, 3, 4, 5, 6, 7, 8, 9], 2025);
    const a = avisos(/terminado sem o dia em que acabou/, 2025);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /\. O fim escrito conta como o prazo do contrato: se o prazo combinado era outro, corrige-o — é ele que decide a taxa reduzida$/);
    // seguindo o aviso à letra (o dia e o motivo 02), o termo continua a ser o dia da saída
    const c = app.db.contracts[0];
    c.fisco.cessacao = { data: '2025-09-30', motivo: '02' };
    const b = avisos(/antes do prazo/, 2025);
    assert.equal(b.length, 1);
    assert.equal(b[0].texto, 'Contrato C1: acabou a 30/09/2025 antes do prazo (o motivo 02 do quadro 10), mas o fim escrito no contrato é esse mesmo dia. '
      + 'Se acabou no fim do prazo, o motivo é o 03; se acabou antes, o fim do contrato é o prazo combinado, e não o dia em que acabou: corrige-o — é ele que decide a taxa reduzida e o quadro 10');
    assert.equal(b[0].nivel, 'falta');
    assert.equal(b[0].abrir, "ctView('C1')");
    // com o prazo reposto, nada; e um não habitacional não tem taxa reduzida a perder
    c.end = '2026-05-31';
    assert.equal(avisos(/antes do prazo \(o motivo/, 2025).length, 0, 'prazo reposto');
    c.end = '2025-09-30'; c.fisco.finalidade = 'nh';
    assert.equal(avisos(/antes do prazo \(o motivo/, 2025).length, 0, 'não habitacional');
  });

  test('N101: com a redução já caída, a comunicação não fala de a perder e o 4.2C não diz que a app a conta', () => {
    imovel(); contrato({ rent: 3000, start: '2024-01-01', end: '2033-12-31', active: false },
      { celebracao: '2024-01-01', cessacao: { data: '2026-06-30', motivo: '01' } });
    rendas(3000, M12, 2025);
    rendas(3000, [1, 2, 3, 4, 5, 6]);
    const tudo = json(app.resumoFiscal(2026, 'ana').avisos);
    assert.equal(tudo.filter((x) => /pode não aplicar a redução pela duração/.test(x.texto)).length, 0);
    assert.equal(tudo.filter((x) => /Até lá, a app conta a redução/.test(x.texto)).length, 0);
    const com = tudo.filter((x) => /marcada como comunicada/.test(x.texto));
    assert.equal(com.length, 1);
    assert.match(com[0].texto, /a resposta é NÃO\. A redução pela duração já caiu \(CIRS art\. 72\.º n\.º 20\): não há redução a perder$/);
    assert.equal(com[0].nivel, 'aviso');
    // a marca da linha manda (l.reducaoCaida)
    const x = { periodoInicio: '2024-01-01', chave: '2024', prazo: '2025-02-15', data: '', foraDePrazo: false };
    const l = linhaMao({ quadro: '4.2', taxa: 25, celebracao: '2024-01-01', inicio: '2024-01-01', comunicacao: x, reducaoCaida: false });
    assert.equal(avisosMao(resumoMao({ linhas: [l] }), /pode não aplicar a redução/).length, 1, 'sem a marca, a frase fica');
    assert.equal(avisosMao(resumoMao({ linhas: [Object.assign({}, l, { reducaoCaida: true })] }), /pode não aplicar a redução/).length, 0);
  });
});

describe('a comunicação da app antiga por confirmar (N003)', () => {
  test('a data antiga depois do prazo do período pergunta o dia, sem afirmar NÃO', () => {
    imovel(); contrato({ start: '2021-06-01', end: '2026-05-31' }, { celebracao: '2021-05-20', comunicacoes: { 2025: '2026-02-10' } });
    rendas(1000, M12, 2025);
    const a = json(app.resumoFiscal(2025, 'ana').avisos).filter((x) => /comunica/.test(x.texto));
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Contrato C1: comunicaste a duração do contrato no Portal das Finanças até 15/02/2022? Em que dia? A app antiga pedia esta comunicação todos os anos e marcaste-a a 10/02/2026, '
      + 'mas essa marca não diz quando comunicaste a duração do contrato. Marca no contrato o dia em que o fizeste: o quadro 4.2A do Anexo F pergunta se foi até 15/02/2022; '
      + 'se não a comunicaste a tempo, a resposta é NÃO');
    assert.doesNotMatch(a[0].texto, /depois do prazo|foi comunicada a/);
    // a forma do resumo (porConfirmar e dataAntiga do irsComunicacaoDoAno)
    const x = { periodoInicio: '2021-06-01', chave: '2021', prazo: '2022-02-15', data: '', foraDePrazo: false, porConfirmar: true, dataAntiga: '2026-02-10' };
    const b = avisosMao(resumoMao({ ano: 2025, linhas: [linhaMao({ quadro: '4.2', comunicacao: x })] }), /comunica/);
    assert.match(b[0].texto, /^Contrato C1: comunicaste a duração do contrato no Portal das Finanças até 15\/02\/2022\? Em que dia\? /);
    assert.equal(b[0].nivel, 'falta');
  });
});

describe('as despesas que a AT não aceita (N117)', () => {
  test('o multirriscos, o fundo de reserva, a reparação de eletrodomésticos, o notário e a avaliação dizem-se a cinzento, com o total', () => {
    imovel(); contrato({ start: '2025-01-01', end: '2029-12-31' }, { celebracao: '2024-12-15' });
    rendas(800, M12, 2025);
    mov({ kind: 'expense', category: 'Seguros', sub: 'Multirriscos', label: 'Seguro multirriscos', amount: 180, date: '2025-03-10' });
    mov({ kind: 'expense', category: 'Condomínio', sub: 'Fundo de reserva', label: 'Fundo de reserva', amount: 120, date: '2025-04-10' });
    mov({ kind: 'expense', category: 'Manutenção e reparações', sub: 'Eletrodomésticos', label: 'Reparação da máquina', amount: 90, date: '2025-05-10' });
    mov({ kind: 'expense', category: 'Serviços profissionais', sub: 'Notário e registos', label: 'Registo predial', amount: 70, date: '2025-06-01' });
    mov({ kind: 'expense', category: 'Serviços profissionais', sub: 'Avaliação', label: 'Avaliação', amount: 40, date: '2025-06-02' });
    // uma escolhida à mão na própria despesa manda, e não entra
    mov({ kind: 'expense', category: 'Seguros', sub: 'Multirriscos', label: 'Incêndio', amount: 50, date: '2025-06-10', irsCol: 'conservacao' });
    const a = avisos(/não contam nos gastos/, 2025);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'info');
    assert.match(a[0].texto, /^5 despesas de 2025 \(500 €\) não contam nos gastos: Seguro multirriscos, 180 €; Fundo de reserva, 120 €; Reparação da máquina, 90 €; Registo predial, 70 €; Avaliação, 40 €\. A AT não as aceita: /);
    assert.match(a[0].texto, /o notário e os registos são da compra ou da venda do imóvel, e não das rendas; a avaliação do imóvel não é um gasto de obter as rendas\./);
    assert.match(a[0].texto, /Se copiaste daqui gastos de 2025 antes desta versão, confere-os — até aí a app contava-as$/);
    assert.equal(avisos(/não contam nos gastos/, 2026).length, 0, 'noutro ano sem elas, nada');
  });
});

describe('as quotas dos comproprietários (N135, N136, N138, N021, N035)', () => {
  test('N135: duas contas e os donos de fora por confirmar: âmbar, conta só para os donos da app', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, comproprietariosFora: null }); contrato();
    rendas(1000);
    const a = avisos(/só para os donos da app/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Imóvel T2 Arroios: conta só para os donos da app \(a tua quota: 50 %\), e não está confirmado que não há outros donos\. /);
    assert.match(a[0].texto, /se a casa é só vossa, escolhe «Não, mais ninguém»$/);
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].abrir, "imvAbrirQuotas('v1')");
    app.db.properties[0].comproprietariosFora = [];
    assert.equal(avisos(/só para os donos da app/).length, 0, '«Não, mais ninguém»');
  });

  test('N136: quotas antigas que não somam 100 %: âmbar, com a quota-parte que a proporção dá', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 60, bruno: 30 } }); contrato();
    rendas(1000);
    const a = avisos(/não somam|somam \d/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Imóvel T2 Arroios: as quotas escritas na ficha somam 90 %, e não 100 %: a app reparte-as na proporção, e a tua quota-parte fica 66,67 %. '
      + 'Se a parte das rendas que cabe a cada um é outra, corrige-as na ficha; se o resto é de quem não está na app, junta-o em «Há outros donos fora da app?»');
    assert.equal(a[0].nivel, 'aviso');
    app.db.properties[0].ownerShares = { ana: 60, bruno: 40 };
    assert.equal(avisos(/somam \d/).length, 0, 'a somar 100');
  });

  test('N138: uma proposta de quotas à espera de confirmação: âmbar, com a quota que a Declaração conta', () => {
    imovel({ ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 } }); contrato();
    rendas(1000);
    app.CW = { state: { proposals: [{ houseId: 'v1', proposedBy: 'ana', proposedByName: 'Ana', shares: { ana: 70, bruno: 30 }, approvals: ['ana'], desde: '2026-01-01' }] } };
    const a = avisos(/divisão de quotas à espera/);
    assert.deepEqual(a, [{ texto: 'Imóvel T2 Arroios: há uma nova divisão de quotas à espera de confirmação (proposta por ti, desde 01/01/2026; falta a confirmação de Bruno). '
      + 'Até todos confirmarem, a Declaração conta a divisão em vigor — a tua quota: 50 %', abrir: "propView('v1')", toca: 'camada', nivel: 'aviso' }]);
    app.CW.state.proposals[0] = { houseId: 'v1', proposedBy: 'bruno', proposedByName: 'Bruno', shares: { ana: 30, bruno: 70 }, approvals: ['bruno'], desde: 'sempre' };
    assert.match(avisos(/divisão de quotas à espera/)[0].texto, /\(proposta por Bruno, desde sempre; falta a tua confirmação\)/);
    app.CW.state.proposals = [];
    assert.equal(avisos(/divisão de quotas à espera/).length, 0);
  });

  test('N021: um dono que saiu no ano: âmbar a quem fica, com o dia e a quota que passou a contar', () => {
    imovel({ ownerIds: ['ana'], ownerShares: { ana: 100 },
      quotasHist: [{ ate: '2026-07-09', ownerIds: ['ana', 'bruno'], ownerShares: { ana: 50, bruno: 50 }, fora: [] }] });
    contrato(); rendas(1000);
    const a = avisos(/saiu do imóvel/);
    assert.equal(a.length, 1);
    // D6: quem sai da app sai da casa — o aviso só diz que saiu e que a quota passou aos que ficaram
    assert.equal(a[0].texto, 'Imóvel T2 Arroios: Bruno saiu do imóvel a 10/07/2026, e a quota que tinha passou para os donos que ficaram a partir desse dia — a tua passou de 50 % a 100 %');
    assert.doesNotMatch(a[0].texto, /continua a ser dono|só saiu da app/);
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].abrir, "propView('v1')");
    assert.equal(avisos(/saiu do imóvel/, 2027).length, 0, 'só no ano da saída');
    // a conta apagada: sem ficha nem nome guardado
    app.db.owners = app.db.owners.filter((o) => o.id !== 'bruno');
    assert.match(avisos(/saiu do imóvel/)[0].texto, /^Imóvel T2 Arroios: Um comproprietário saiu do imóvel a 10\/07\/2026/);
    // uma entrada (o recém-chegado só no período seguinte) não é uma saída
    app.db.properties[0].ownerIds = ['ana', 'bruno']; app.db.properties[0].ownerShares = { ana: 50, bruno: 50 };
    app.db.properties[0].quotasHist = [{ ate: '2026-03-31', ownerIds: ['ana'], ownerShares: { ana: 100 }, fora: [] }];
    assert.equal(avisos(/saiu do imóvel|saíram do imóvel/).length, 0);
  });

  test('N035: uma casa sem histórico com movimentos de quem já não é dono pergunta se as quotas foram as mesmas o ano todo', () => {
    imovel();
    const r = resumoMao({ quotasSemHistorico: [{ propertyId: 'v1', imovel: 'T2 Arroios', autores: [{ id: 'bruno', nome: 'Bruno' }] }] });
    const a = avisosMao(r, /foram estas o ano todo/);
    assert.equal(a.length, 1);
    assert.equal(a[0].texto, 'Imóvel T2 Arroios: as quotas deste imóvel foram estas o ano todo? Há movimentos de 2026 registados por Bruno, que já não é dono, e a app não sabe quando as quotas mudaram: '
      + 'conta as de hoje (a tua: 100 %) o ano inteiro. Se mudaram a meio do ano, regista a mudança com o dia em que começou — cada renda e cada gasto contam pela quota do seu dia (CIRS art. 19.º)');
    assert.equal(a[0].abrir, "imvAbrirQuotas('v1')");
    assert.equal(avisosMao(resumoMao({ quotasSemHistorico: [] }), /foram estas o ano todo/).length, 0);
  });
});

describe('a conjunta com o cônjuge sem conta (N020) e a quota de outro dia (N069)', () => {
  test('N020: sem ninguém para escolher não manda escolher; com os bens comuns do casal, só se diz', () => {
    app.db.owners = app.db.owners.filter((o) => o.id === 'ana');
    const r = resumoMao({ semConjuge: true });
    const a = avisosMao(r, /^Tributação conjunta/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'falta');
    assert.doesNotMatch(a[0].texto, /Escolhe-o em/);
    assert.match(a[0].texto, /Os imóveis do teu cônjuge que não estão na app inserem-se à mão no Portal das Finanças/);
    assert.match(a[0].texto, /«Os bens são comuns do casal» ligado em «A tua situação em 2026»/);
    imovel({ comproprietariosFora: [{ id: 'f1', nome: 'Rui', quota: 25 }, { id: 'f2', nome: 'Rita', quota: 25 }] });
    const b = avisosMao(resumoMao({ semConjuge: true, titulares: ['ana', 'conjuge~ana'], conjugeFora: { id: 'conjuge~ana', nome: 'Bruno', letra: 'B' },
      bensComuns: { imoveis: [], porDecidir: [{ propertyId: 'v1', imovel: 'T2 Arroios', nomes: ['Rui', 'Rita'] }], soMeus: [] } }), /conjunta|cônjuge/);
    assert.equal(b[0].texto, 'Tributação conjunta com os bens comuns do casal: a parte de Bruno nos imóveis em comum vai às linhas do titular B. Os imóveis só de Bruno, que não estão na app, inserem-se à mão no Portal das Finanças');
    assert.equal(b[0].nivel, 'info');
    assert.match(b[1].texto, /^Imóvel T2 Arroios: tem mais do que um dono fora da app \(Rui e Rita\), e a app não sabe qual é o teu cônjuge — a parte do teu cônjuge não entra\. Junta-a à mão no Portal, numa linha do titular B/);
    assert.equal(b[1].nivel, 'aviso');
    // quem conta como o cônjuge em cada imóvel; com nomes diferentes, âmbar
    const c = avisosMao(resumoMao({ semConjuge: true, titulares: ['ana', 'conjuge~ana'], conjugeFora: { id: 'conjuge~ana', nome: '', letra: 'B' },
      bensComuns: { imoveis: [{ propertyId: 'v1', imovel: 'T2 Arroios', nome: 'Bruno', quota: 50 }, { propertyId: 'v2', imovel: 'T3 Lumiar', nome: 'Rui', quota: 50 }], porDecidir: [], soMeus: [] } }), /^Tributação conjunta/);
    assert.equal(c[0].texto, 'Tributação conjunta com os bens comuns do casal: conta como o teu cônjuge, nas linhas do titular B, Bruno (T2 Arroios) e Rui (T3 Lumiar). '
      + 'Se algum não é o teu cônjuge (uma casa herdada com um irmão), desliga «Os bens são comuns do casal» em «A tua situação em 2026» e junta à mão no Portal a parte do teu cônjuge. '
      + 'Os imóveis só do teu cônjuge, que não estão na app, inserem-se à mão no Portal das Finanças');
    assert.equal(c[0].nivel, 'aviso');
  });

  test('N069: a renda de um mês antes de as quotas mudarem e o IMI do ano anterior nomeiam-se', () => {
    imovel();
    const r = resumoMao({
      rendasDeOutraQuota: [{ txId: 'x1', contratoId: 'C1', nome: 'C1', propertyId: 'v1', imovel: 'T2 Arroios', mes: '2026-03', data: '2026-08-05', valor: 1000,
        desde: '2026-07-01', quotaMes: 1, quotaDia: 0.5 }],
      imiDeOutraQuota: [{ txId: 'i1', nome: 'IMI', propertyId: 'v1', imovel: 'T2 Arroios', data: '2026-11-30', valor: 400, quotaAno: 1, quotaDia: 0.5 }] });
    const a = avisosMao(r, /quotas mudarem|31\/12\/2025/);
    assert.equal(a.length, 2);
    assert.equal(a[0].texto, 'Contrato C1: a renda de março de 2026 (1 000 €), paga a 05/08/2026, respeita a um mês antes de as quotas mudarem (a 01/07/2026): a Declaração conta-a pela quota desse mês '
      + '(a tua: 100 %, e não 50 %) — a de quem era dono quando se venceu (Código Civil, art. 213.º n.º 2). Confirma de quem é');
    assert.equal(a[0].abrir, "txView('x1')");
    assert.match(a[1].texto, /^IMI de 400 € \(T2 Arroios\) pago a 30\/11\/2026: conta pela quota a 31\/12\/2025 \(a tua: 100 %, e não 50 %\) — o IMI é de quem era dono a 31 de dezembro/);
    assert.equal(a[1].nivel, 'aviso');
  });

  test('o motivo da cessação em falta diz-se uma vez por contrato, mesmo com uma entrada por titular', () => {
    contrato({ start: '2024-01-01', end: '2033-12-31', active: false }, { cessacao: { data: '2026-04-30', motivo: '' } });
    const x = { contratoId: 'C1', nome: 'C1', data: '2026-04-30', motivo: '' };
    assert.equal(avisosMao(resumoMao({ cessados: [Object.assign({ titular: 'A' }, x), Object.assign({ titular: 'B' }, x)] }), /sem o motivo da cessação/).length, 1);
  });
});
