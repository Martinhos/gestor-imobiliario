// O contrato e os prazos da ronda 2 da auditoria ao IRS: o direito real de
// habitação duradoura no formulário, com a dica e a ficha do quadro 4.3, e
// sem aviso nenhum nos contratos sem termo (D120); o arrendamento de um
// prédio rústico a uma entidade de gestão florestal, com o quadro 6C (D119);
// as rendas tributadas na categoria B, à parte do «não declarado», que
// guardam o Modelo 2 mas não os recibos de renda (D134); o imóvel fora de Portugal, com o
// imposto pago lá e sem os prazos da AT (D133); a dica sem isenção que aponta
// para a ficha do imóvel nos reabilitados (D118); e os encargos a cargo do
// inquilino (o Q13).
//
// O dia da app é fixo (2026-11-17); os prazos leem o `hoje` que se lhes passa.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));

/* um imóvel, um dono, uma inquilina e um contrato declarado de habitação
   permanente
   Recebe: a — a app; extra (opcional) — campos do contrato (o fisco junta-se
   ao de omissão); imovel (opcional) — campos do imóvel.
   Devolve: o contrato guardado em db.contracts. */
function monta(a, extra, imovel) {
  limpar(a);
  const e = Object.assign({}, extra || {});
  const fisco = Object.assign({ estado: 'declarado', finalidade: 'hp', numero: '1234567' }, e.fisco || {});
  delete e.fisco;
  a.db.owners = [a.normPerson({ id: 'O1', name: 'Rui' })];
  a.db.tenants = [a.normPerson({ id: 'T1', name: 'Ana' })];
  a.db.properties = [a.normProp(Object.assign({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] }, imovel || {}))];
  a.db.contracts = [a.normContract(Object.assign({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'], rent: 1000,
    start: '2024-03-01', end: '2029-02-28', fisco }, e))];
  a.db.transactions = [];
  a.db.recurring = [];
  a.db.settings.prazosVistos = {};
  a.foldState = {};
  return a.db.contracts[0];
}

/* o formulário aberto sobre o contrato C1 (uma cópia, como o ctModal faz)
   Recebe: a — a app.
   Devolve: o HTML do bloco fiscal. */
function form(a) {
  a.cForm = a.normContract(copia(a.contract('C1')));
  return a.fiscoSect();
}

/* um DOM que só conhece os ids do mapa (o resto não está no ecrã)
   Recebe: a — a app; valores — {id: valor}; true e false são caixas.
   Devolve: o mapa dos elementos falsos. */
function domCom(a, valores) {
  const els = {};
  a.document.getElementById = (id) => {
    if (!(id in valores)) return null;
    if (!els[id]) els[id] = { value: typeof valores[id] === 'boolean' ? 'on' : String(valores[id]), checked: valores[id] === true, hidden: false, textContent: '', innerHTML: '',
      placeholder: '', classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, scrollIntoView() {}, getAttribute: () => '' };
    return els[id];
  };
  return els;
}

/* uma receita do contrato C1 (uma renda, por omissão, sem recibo)
   Recebe: a — a app; id; date; extra (opcional) — campos do movimento.
   Devolve: nada. */
function receita(a, id, date, extra) {
  a.db.transactions.push(a.normTx(Object.assign({ id, kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000, date,
    propertyId: 'P1', contractId: 'C1', recibo: false }, extra || {})));
}

/* os prazos de um tipo, copiados para fora do contexto da app */
const doTipo = (h, tipo) => copia(app.prazosDe(h).filter((p) => p.tipo === tipo));
/* o texto de um HTML, sem as marcas */
const texto = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('o direito real de habitação duradoura (D120)', () => {
  test('a finalidade DHD está no formulário, com a dica do quadro 4.3', () => {
    monta(app, { start: '2022-05-01', end: '', deposit: 30000, fisco: { finalidade: 'dhd' } });
    const h = form(app);
    assert.ok(app.__sel.c_ffin.options.some((o) => o.v === 'dhd' && o.label === 'Direito real de habitação duradoura'), 'a escolha tem o DHD');
    assert.match(h, /<div class="hint ct-colado" id="c_ffinHint">O direito real de habitação duradoura \(DL 1\/2020\) vai ao quadro 4\.3 do Anexo F, e não ao 4\.1: a prestação mensal paga 5 %\. A data da escritura é o início do contrato, e o valor da caução é a caução do contrato\.<\/div>/);
    domCom(app, { c_rent: '600', c_ffin: 'dhd' });
    app.collectCt();
    assert.equal(app.cForm.fisco.finalidade, 'dhd');
  });

  test('a ficha «Perante a AT» de um DHD diz o quadro 4.3, e não o 4.1', () => {
    const c = monta(app, { start: '2022-05-01', end: '', deposit: 30000, fisco: { finalidade: 'dhd' } });
    const t = texto(app.ctAtDaFicha(c));
    assert.match(t, /Finalidade Direito real de habitação duradoura/);
    assert.match(t, /Anexo F quadro 4\.3 · habitação duradoura \(DHD\)/);
    assert.doesNotMatch(t, /quadro 4\.1/);
  });

  test('um contrato de habitação sem termo não ganha aviso nenhum do DHD', () => {
    const c = monta(app, { start: '2022-05-01', end: '' });
    const h = form(app);
    assert.match(h, /<div class="hint ct-colado" id="c_ffinHint" hidden><\/div>/, 'a dica da finalidade fica escondida e vazia');
    assert.doesNotMatch(texto(app.ctAtDaFicha(c)), /habitação duradoura|DHD|4\.3/);
    assert.doesNotMatch(texto(h), /DHD|4\.3/, 'o DHD só como uma das finalidades da escolha');
  });

  test('o liveNet mostra a dica do 4.3 quando se escolhe o DHD, e esconde-a nas outras', () => {
    monta(app, { start: '2022-05-01', end: '' });
    form(app);
    let els = domCom(app, { c_rent: '600', c_ffin: 'dhd', c_ffinHint: '' });
    app.liveNet();
    assert.equal(els.c_ffinHint.hidden, false);
    assert.match(els.c_ffinHint.textContent, /quadro 4\.3/);
    els = domCom(app, { c_rent: '600', c_ffin: 'hp', c_ffinHint: '' });
    app.liveNet();
    assert.equal(els.c_ffinHint.hidden, true);
  });

  test('prazos: a caução do DHD não pede recibo nem conta como renda; a prestação mensal pede', () => {
    monta(app, { start: '2026-09-01', end: '', deposit: 30000, fisco: { finalidade: 'dhd' } });
    receita(app, 'R1', '2026-09-01', { sub: 'Caução', amount: 30000 });
    receita(app, 'R2', '2026-10-01', { amount: 600 });
    const r = doTipo('2026-11-17', 'recibos');
    assert.deepEqual(r.map((p) => p.chave), ['recibos:R2:2026-10-01'], 'só a prestação de outubro');
    monta(app, { start: '2025-09-01', end: '', deposit: 30000, fisco: { finalidade: 'dhd' } });
    receita(app, 'R1', '2025-09-01', { sub: 'Caução', amount: 30000, recibo: true });
    assert.deepEqual(doTipo('2026-04-01', 'irs'), [], 'um ano só com a caução do DHD não tem rendas a declarar');
  });

  test('o «Terminar» de um DHD grava o motivo com os códigos do quadro 4.3, e o acordo das partes regulariza', () => {
    monta(app, { start: '2022-05-01', end: '', deposit: 30000, fisco: { finalidade: 'dhd' } });
    const ecra = { abertas: [], erros: [] };
    app.openModal = (t, b, f) => { ecra.abertas.push({ t, b: String(b || ''), f: String(f || '') }); return {}; };
    app.closeModal = () => {};
    app.closeAllModals = () => {};
    app.render = () => {};
    app.buildNav = () => {};
    app.save = () => {};
    app.toast = () => {};
    app.comDesfazer = () => {};
    app.falhaCampo = (id, m) => { ecra.erros.push(id + ': ' + m); };
    const ms = copia(app.ctMotivosCessacao(app.contract('C1'), 2026));
    assert.deepEqual(ms.map((m) => m.v), ['01', '02', '03', '04', '05', '06'], 'os motivos do quadro 4.3, e não os do quadro 10');
    assert.equal(ms[0].label, 'Por acordo das partes');
    assert.equal(ms[0].regulariza, true);
    app.endContract('C1');
    const folha = ecra.abertas.pop();
    assert.match(folha.b, /O quadro 4\.3 do Anexo F e a comunicação da cessação à AT pedem-no\./);
    assert.match(folha.b, /Morte do morador/);
    assert.match(app.ctCessacaoAviso(app.contract('C1'), '2026-10-31', '01'), /^Por acordo das partes, a cessação do DHD tira a taxa reduzida desde o início \(CIRS art\. 72\.º n\.º 20\)/);
    assert.equal(app.ctCessacaoAviso(app.contract('C1'), '2026-10-31', '02'), 'Vai ao quadro 4.3 do Anexo F dos rendimentos de 2026, com a data e o motivo.');
    assert.deepEqual(copia(app.ctCessacaoErro(app.contract('C1'), '2026-10-31', '', true)), { id: 'c_cesMot', msg: 'Escolhe o motivo: o quadro 4.3 do Anexo F pede-o.' });
    assert.equal(app.ctTerminar('C1', '2026-10-31', '03'), '');
    assert.deepEqual(copia(app.contract('C1').fisco.cessacao), { data: '2026-10-31', motivo: '03' });
    assert.match(texto(app.ctAtDaFicha(app.contract('C1'))), /Cessação 31\/10\/2026 · Renúncia do morador/);
    // um contrato de arrendamento continua com os do quadro 10
    monta(app);
    assert.ok(copia(app.ctMotivosCessacao(app.contract('C1'), 2026)).some((m) => /por motivo do senhorio/.test(m.label)));
  });

  test('prazos: o Modelo 2 de um DHD por indicar diz o n.º do quadro 4.3, sem o selo de uma renda', () => {
    monta(app, { start: '2026-10-20', end: '', fisco: { estado: '', finalidade: 'dhd' } });
    const m = doTipo('2026-11-17', 'modelo2');
    assert.equal(m.length, 1);
    assert.match(m[0].sub, /É esse registo que dá o n\.º do contrato que o quadro 4\.3 do Anexo F pede\./);
    assert.doesNotMatch(m[0].sub, /10 % de uma renda/);
  });
});

describe('o prédio rústico arrendado a uma entidade de gestão florestal (D119)', () => {
  test('num rústico, o interruptor da EGF/UGF com o quadro 6C; num urbano, não', () => {
    monta(app, { start: '2019-03-01', end: '2031-02-28', fisco: { finalidade: 'nh', celebracao: '2019-02-20' } }, { tipoPredio: 'R' });
    const h = form(app);
    assert.match(h, /<b>Arrendado a entidade de gestão florestal reconhecida \(EGF\/UGF\)<\/b><\/span><input type="checkbox" role="switch" class="ct-sw" id="c_fegf" data-change="liveNet\(\)">/);
    assert.match(h, /<div class="hint ct-colado" id="c_fegfHint">Prédio rústico florestal arrendado até 31 de dezembro de 2020 a uma entidade ou unidade de gestão florestal reconhecida: as rendas contam 50 %, durante 12 anos a contar do ano do contrato\. Declara-se no quadro 6C do Anexo F, que aponta para a linha do contrato no quadro 4\.1\.<\/div>/);
    domCom(app, { c_rent: '300', c_fegf: true });
    app.collectCt();
    assert.equal(app.cForm.fisco.egf, true);
    assert.equal(copia(app.irsBeneficios(app.cForm, 2026)).map((b) => b.quadro).join(), '6C', 'o motor dá o 6C');
    monta(app, {}, { tipoPredio: 'U' });
    assert.doesNotMatch(form(app), /c_fegf/);
  });

  test('marcado num contrato de 2022, a dica e a ficha dizem porque o 6C não conta', () => {
    const c = monta(app, { start: '2022-03-01', end: '2034-02-28', fisco: { finalidade: 'nh', celebracao: '2022-02-20', egf: true } }, { tipoPredio: 'R' });
    form(app);
    assert.match(app.ctEgfDica(app.cForm), /Atenção: em 2026 não conta — só vale para os arrendamentos celebrados até 31 de dezembro de 2020\./);
    const t = texto(app.ctAtDaFicha(c));
    assert.match(t, /Gestão florestal arrendado a uma EGF ou UGF/);
    assert.match(t, /o quadro 6C não conta em 2026: só vale para os arrendamentos celebrados até 31 de dezembro de 2020\./);
    const c2 = monta(app, { start: '2019-03-01', end: '2031-02-28', fisco: { finalidade: 'nh', celebracao: '2019-02-20', egf: true } }, { tipoPredio: 'R' });
    assert.match(texto(app.ctAtDaFicha(c2)), /as rendas contam 50 %, e o quadro 6C do Anexo F aponta para a linha do contrato\./);
  });
});

describe('as rendas tributadas na categoria B (D134)', () => {
  test('o interruptor no bloco fiscal grava fisco.categoriaB sem mexer no estado', () => {
    monta(app);
    const h = form(app);
    // a pergunta da atividade aberta, dentro da particularidade fiscal (N015, D7)
    assert.match(h, /<b>Tens atividade aberta com estas rendas na categoria B\?<\/b><\/span><input type="checkbox" role="switch" class="ct-sw" id="c_fcatb" data-change="liveNet\(\)">/);
    assert.match(h, /<div class="hint ct-colado" id="c_fcatbHint">Só com atividade aberta: se optaste por tributar estas rendas na categoria B \(CIRS art\. 4\.º n\.º 1 n\), na declaração de início ou de alterações de atividade\), ou se o imóvel está afeto à tua atividade empresarial ou profissional \(art\. 3\.º n\.º 2 a\)\)\./);
    domCom(app, { c_rent: '800', c_fpart: true, c_fcatb: true });
    app.collectCt();
    assert.equal(app.cForm.fisco.categoriaB, true);
    assert.equal(app.cForm.fisco.estado, 'declarado');
  });

  test('a ficha diz o Anexo B ou C, sem o quadro do Anexo F nem a taxa estimada', () => {
    const c = monta(app, { start: '2024-03-01', end: '2034-02-28', fisco: { categoriaB: true } });
    const t = texto(app.ctAtDaFicha(c));
    assert.match(t, /Categoria B fora do Anexo F · Anexo B ou C/);
    // o Modelo 2 fica; os recibos de renda não se emitem: o documento é a fatura (N029)
    assert.match(t, /declaram-se no Anexo B ou C, com a tua atividade, e não no Anexo F\. O contrato continua com o Modelo 2; os recibos de renda eletrónicos não se emitem \(Portaria 98-A\/2015, art\. 5\.º n\.º 1\)/);
    assert.doesNotMatch(t, /quadro 4\.[12]|15 de fevereiro/);
    assert.match(texto(app.ctValoresDaFicha(c)), /Imposto — categoria B · sem estimativa/);
  });

  test('prazos: sem recibos de renda nem comunicação de fevereiro, e a entrega diz o Anexo B (ou C)', () => {
    monta(app, { start: '2025-03-01', end: '2035-02-28', fisco: { categoriaB: true } });
    receita(app, 'R1', '2025-03-01', { recibo: true });
    receita(app, 'R2', '2026-10-01');
    assert.equal(doTipo('2026-01-20', 'fev15').length, 0, 'sem taxa autónoma não há redução a comunicar');
    // a Portaria 98-A/2015, art. 5.º n.º 1, só pede o recibo de renda a quem não optou pela categoria B (N029)
    assert.equal(doTipo('2026-11-17', 'recibos').length, 0, 'o recibo de renda não se pede: o documento é a fatura');
    const i = doTipo('2026-04-01', 'irs');
    assert.equal(i.length, 1);
    assert.equal(i[0].titulo, 'Entregar o IRS — Anexo B (ou C) de 2025');
    assert.match(i[0].sub, /As rendas da categoria B vão ao Anexo B ou C, com a tua atividade\./);
  });
});

describe('o imóvel fora de Portugal (D133)', () => {
  const paris = { name: 'T2 Paris', pais: 'França', paisCodigo: '250' };

  test('o bloco fiscal pede o imposto pago lá por ano, sem nada do Modelo 2 nem da taxa especial', () => {
    monta(app, { start: '2024-01-01', end: '2033-12-31', rent: 1500 }, paris);
    const h = form(app);
    assert.match(h, /Imóvel fora de Portugal: as rendas não vão ao Anexo F, nem há Modelo 2, recibos eletrónicos ou comunicações à AT\. Declaram-se no Anexo J/);
    assert.match(h, /<label>Pelas rendas de 2025 \(€\)<input id="c_fie_2025" type="text" inputmode="decimal" class="num" value="" placeholder="Opcional" autocomplete="off"><\/label>/);
    for (const id of ['c_fnum', 'c_fisen', 'c_ffin', 'c_fcatb', 'c_fn23']) assert.doesNotMatch(h, new RegExp('id="' + id + '"'), id);
    domCom(app, { c_rent: '1500', c_fie_2024: '', c_fie_2025: '1200,50', c_fie_2026: '' });
    app.collectCt();
    assert.deepEqual(copia(app.cForm.fisco.impostoEstrangeiro), { 2025: 1200.5 });
    domCom(app, { c_rent: '1500', c_fie_2025: '' });
    app.collectCt();
    assert.deepEqual(copia(app.cForm.fisco.impostoEstrangeiro), {}, 'em branco apaga o ano');
    domCom(app, { c_rent: '1500', c_fie_2025: '-3' });
    assert.deepEqual(copia(app.ctFiscoErro(app.cForm)), { id: 'c_fie_2025', msg: 'O imposto pago não pode ser negativo.' });
  });

  test('a ficha diz o país, o Anexo J e o imposto pago lá; os valores e a líquida sem estimativa', () => {
    const c = monta(app, { start: '2024-01-01', end: '2033-12-31', rent: 1500, fisco: { impostoEstrangeiro: { 2025: 900 } } }, paris);
    const t = texto(app.ctAtDaFicha(c));
    assert.match(t, /País do imóvel França/);
    assert.match(t, /Imposto pago lá 2025: 900,00/);
    assert.match(t, /Declara-se no Anexo J/);
    assert.doesNotMatch(t, /Anexo F quadro|N\.º do contrato|Falta o n\.º|15 de fevereiro/);
    assert.match(texto(app.ctValoresDaFicha(c)), /Imposto — Anexo J · sem estimativa/);
    app.cForm = app.normContract(copia(c));
    domCom(app, { c_rent: '1500', c_tax: '' });
    assert.match(app.netBox(), /Num imóvel fora de Portugal a app não estima o imposto/);
    assert.match(app.ctBody(), /Em branco: <b id="c_taxVazio">sem estimativa<\/b>/);
  });

  test('por indicar, a dica fala do Anexo J e não do Modelo 2', () => {
    monta(app, { start: '2026-10-01', end: '', fisco: { estado: '' } }, paris);
    const h = form(app);
    // a pergunta no rótulo do grupo, e as respostas que lhe respondem (N061)
    assert.match(h, /<span class="flabel" id="c_fiscoRot">Vais declarar estas rendas no IRS\?<\/span>/);
    assert.match(h, /Fora de Portugal não há Modelo 2: as rendas vão ao Anexo J/);
    assert.doesNotMatch(h, /Comunicaste este contrato às Finanças|Já o comunicaste às Finanças/);
  });

  test('os prazos do Código Civil não se avisam: a lei é a do país do imóvel (Roma I), e a ficha e o formulário dizem-no', () => {
    const frase = 'Os prazos do contrato seguem a lei do país do imóvel (Regulamento Roma I, art. 4.º), salvo se o contrato escolheu outra.';
    const c = monta(app, { start: '2024-01-01', end: '2026-12-31', rent: 1500, increase: 2 }, paris);
    for (const tipo of ['oposicao', 'fim', 'aumento']) assert.deepEqual(doTipo('2026-11-17', tipo), [], tipo);
    assert.ok(app.ctTopoDaFicha(c, app.prop('P1'), []).includes('<p class="small ct-op">' + frase + '</p>'));
    assert.equal(app.ctFraseDoPrazo(c), frase);
    // o mesmo contrato em Portugal avisa a oposição e o fim
    monta(app, { start: '2024-01-01', end: '2026-12-31', rent: 1500, increase: 2 });
    assert.equal(doTipo('2026-11-17', 'fim').length, 1);
    assert.doesNotMatch(app.ctFraseDoPrazo(app.contract('C1')), /Roma I/);
  });

  test('prazos: sem Modelo 2, recibos nem comunicação de fevereiro; a entrega diz o Anexo J', () => {
    monta(app, { start: '2026-10-01', end: '', fisco: { estado: '' } }, paris);
    assert.deepEqual(doTipo('2026-11-17', 'modelo2'), [], 'sem Modelo 2');
    monta(app, { start: '2024-01-01', end: '2033-12-31', rent: 1500 }, paris);
    receita(app, 'R1', '2025-06-01', { amount: 1500, recibo: true });
    receita(app, 'R2', '2026-10-01', { amount: 1500 });
    assert.deepEqual(doTipo('2026-11-17', 'recibos'), [], 'sem recibo de renda eletrónico');
    assert.deepEqual(doTipo('2025-01-20', 'fev15'), [], 'sem comunicação de fevereiro');
    const i = doTipo('2026-04-01', 'irs');
    assert.equal(i.length, 1);
    assert.equal(i[0].titulo, 'Entregar o IRS — Anexo J de 2025');
    assert.match(i[0].sub, /As rendas dos imóveis fora de Portugal vão ao Anexo J, com o imposto pago lá\./);
    // com rendas daqui também: os dois anexos
    app.db.properties.push(app.normProp({ id: 'P2', name: 'T1 Porto', use: 'investimento', ownerIds: ['O1'] }));
    receita(app, 'R3', '2025-07-01', { propertyId: 'P2', contractId: null, recibo: true });
    assert.equal(doTipo('2026-04-01', 'irs')[0].titulo, 'Entregar o IRS — Anexos F e J de 2025');
  });
});

describe('a dica sem isenção e os reabilitados (D118)', () => {
  test('um imóvel reabilitado não é isenção: marca-se na ficha do imóvel (quadro 6A)', () => {
    assert.match(app.ctIsencaoTexto(''), / Um imóvel reabilitado não é isenção: marca-se na ficha do imóvel \(quadro 6A\)\.$/);
  });
});

describe('os encargos a cargo do inquilino (Q13)', () => {
  test('um interruptor por encargo do imóvel de ENCARGOS_DO_INQUILINO, os consumos numa escolha, com a dica da suspensão do planeado', () => {
    monta(app, { encargosInquilino: ['imi'] });
    app.cForm = app.normContract(copia(app.contract('C1')));
    const h = app.ctBody();
    assert.match(h, /<div class="flabel" id="c_encRot">Encargos a cargo do inquilino<\/div>/);
    // os consumos já não são um interruptor: uma escolha só com «A renda inclui os consumos» (N126)
    for (const e of app.ENCARGOS_DO_INQUILINO.filter((x) => x.id !== 'consumos')) {
      assert.match(h, new RegExp('<b>' + e.nome + '</b></span><input type="checkbox" role="switch" class="ct-sw" id="c_enc_' + e.id + '"' + (e.id === 'imi' ? ' checked' : '') + '>'), e.id);
    }
    assert.match(h, /<label>Água, luz e gás<div class="sel" id="sel_c_fconsumos">/);
    assert.match(h, /Enquanto o contrato estiver em vigor, os planeados do IMI e do condomínio deste imóvel, e o do seguro da ficha do imóvel, ficam suspensos: não se pedem nem se confirmam\./);
  });

  test('o collectCt grava os marcados pela ordem da constante, e a ficha mostra-os', () => {
    monta(app);
    form(app);
    domCom(app, { c_rent: '1000', c_enc_condominio: true, c_enc_imi: false, c_enc_seguro: true, c_enc_consumos: false });
    app.collectCt();
    assert.deepEqual(copia(app.cForm.encargosInquilino), ['condominio', 'seguro']);
    domCom(app, { c_rent: '1000' });
    app.collectCt();
    assert.deepEqual(copia(app.cForm.encargosInquilino), ['condominio', 'seguro'], 'sem os campos no ecrã, fica o que estava');
    assert.match(texto(app.ctValoresDaFicha(app.cForm)), /Encargos do inquilino Condomínio, Seguro/);
  });
});
