// O que o IRS pergunta a um contrato e a um movimento, no formulário e na
// ficha: o estado do contrato perante a AT (por indicar, declarado, não
// declarado — o terceiro é uma escolha, sem aviso), os campos do declarado, e
// numa renda o mês, a retenção na fonte e o recibo eletrónico; numa despesa a
// coluna do Anexo F.
//
// O DOM do arnês devolve um elemento vazio novo a cada getElementById, e por
// isso o collectCt/collectTx nunca leriam nada. Onde interessa ler, troca-se
// o getElementById por um mapa de valores (domCom), e repõe-se no fim.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual } from './arnes.js';

const app = carregarApp();
const ANO = new Date().getFullYear();

/* um imóvel de arrendamento, um dono, uma inquilina e um contrato em vigor
   Recebe: fisco (opcional) — o bloco fiscal do contrato; extra (opcional) — outros campos do contrato.
   Devolve: o contrato guardado em db.contracts. */
function monta(fisco, extra) {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'] })];
  app.db.contracts = [app.normContract(Object.assign({ id: 'C1', propertyId: 'P1', tenantIds: ['T1'], rent: 800, start: (ANO - 1) + '-01-01', fisco: fisco || null }, extra || {}))];
  app.foldState = {};
  return app.db.contracts[0];
}

/* um DOM que só conhece os ids do mapa: val() e chk() leem daqui, e o resto
   dos campos não existe (getElementById devolve null, como no browser quando
   o campo não está no ecrã). true no mapa é uma checkbox marcada.
   Recebe: valores — {id: valor}.
   Devolve: uma função que repõe o getElementById original. */
function domCom(valores) {
  const doc = app.document, original = doc.getElementById;
  doc.getElementById = (id) => (id in valores
    ? { value: valores[id] === true ? 'on' : String(valores[id]), checked: valores[id] === true,
        classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, scrollIntoView() {} }
    : null);
  return () => { doc.getElementById = original; };
}

// o HTML só da dobra «Fisco» do formulário do contrato
const dobraFisco = (html) => {
  const a = html.indexOf('id="fold_fisco"'), b = html.indexOf('id="fold_contacts"');
  assert.ok(a > -1 && b > a, 'a dobra Fisco existe e vem antes dos Contactos');
  return html.slice(a, b);
};

describe('o formulário do contrato: a secção Fisco', () => {
  beforeEach(() => { monta(); });

  test('oferece os três estados como escolha, e por indicar explica para que serve marcar', () => {
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 800 });
    const html = app.ctBody();
    const dobra = dobraFisco(html);
    for (const v of ['', 'declarado', 'naoDeclarado']) assert.match(dobra, new RegExp("setFiscoEstado\\('" + v + "'\\)"), 'o botão «' + v + '»');
    assert.match(dobra, /Por indicar/);
    assert.match(dobra, /Declarado à AT/);
    assert.match(dobra, /Não declarado/);
    assert.match(dobra, /class="seg c3"/, 'o controlo segmentado da casa');
    assert.match(dobra, /Comunicaste este contrato às Finanças \(Modelo 2\)\?/);
    assert.doesNotMatch(dobra, /id="c_fnum"/, 'sem estado, nenhum campo do declarado');
    assert.match(dobra, /class="fsum">por indicar</, 'o resumo da dobra');
    // a dobra vem logo a seguir a «Prazo, caução e pagamento»
    assert.ok(html.indexOf('id="fold_terms"') < html.indexOf('id="fold_fisco"'));
  });

  test('declarado: pede o número da AT, a finalidade, a celebração, se renova e as renovações', () => {
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 800,
      fisco: { estado: 'declarado', numero: '1234567', finalidade: 'hnp', renovacoes: [{ id: 'R1', inicio: '2025-01-01', fim: '2025-12-31' }] } });
    const dobra = dobraFisco(app.ctBody());
    for (const id of ['c_fnum', 'c_ffin', 'c_fcel', 'c_fren']) assert.match(dobra, new RegExp('id="' + id + '"'), id);
    assert.match(dobra, /id="c_fnum"[^>]*inputmode="numeric"[^>]*value="1234567"/);
    assert.match(dobra, /Vem no comprovativo do Modelo 2/);
    for (const [, rotulo] of app.FISCO_FINALIDADES) assert.match(dobra, new RegExp(rotulo), 'a finalidade «' + rotulo + '»');
    assert.match(dobra, /id="c_ffin" value="hnp"/, 'a finalidade guardada vem escolhida');
    assert.match(dobra, /Não sei/);
    assert.match(dobra, /id="c_rini_R1"[^>]*value="2025-01-01"/);
    assert.match(dobra, /id="c_rfim_R1"[^>]*value="2025-12-31"/);
    assert.match(dobra, /delRenov\('R1'\)/);
    assert.match(dobra, /addRenov\(\)/);
    assert.match(dobra, /Adicionar renovação/);
    assert.match(dobra, /quadro 4\.2A/);
    assert.match(dobra, /class="fsum">Declarado · n\.º 1234567</);
    assert.doesNotMatch(dobra, /id="c_fces"/, 'sem fim nem inatividade não há cessação');
  });

  test('o motivo da cessação só quando o contrato tem fim ou está inativo', () => {
    const base = { propertyId: 'P1', tenantIds: ['T1'], rent: 800, fisco: { estado: 'declarado' } };
    app.cForm = app.normContract(Object.assign({ end: (ANO + 1) + '-06-30' }, base));
    assert.match(dobraFisco(app.ctBody()), /id="c_fces"/);
    app.cForm = app.normContract(Object.assign({ active: false }, base));
    assert.match(dobraFisco(app.ctBody()), /id="c_fces"/);
    app.cForm = app.normContract(Object.assign({}, base, { fisco: { estado: 'naoDeclarado' }, end: (ANO + 1) + '-06-30' }));
    assert.doesNotMatch(dobraFisco(app.ctBody()), /id="c_fces"/, 'só no declarado');
  });

  test('não declarado: nenhum campo, uma frase neutra, sem cor de aviso', () => {
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 800, fisco: { estado: 'naoDeclarado', numero: '999' } });
    const dobra = dobraFisco(app.ctBody());
    assert.doesNotMatch(dobra, /id="c_fnum"/);
    assert.doesNotMatch(dobra, /id="c_ffin"|id="c_fcel"|id="c_fren"|id="c_fces"/);
    assert.match(dobra, /fica fora do resumo do Anexo F e dos prazos da AT\. Podes mudar isto quando quiseres\./);
    assert.doesNotMatch(dobra, /class="[^"]*\b(danger|neg|amber|warn|late)\b/, 'sem cor de perigo nem de aviso');
    assert.doesNotMatch(dobra, /ilegal|obrigat|coima|multa|risco/i, 'sem ameaça');
    assert.match(dobra, /class="fsum">Não declarado</);
  });

  test('a dica da taxa reduzida: só no declarado, e só em habitação permanente', () => {
    const longo = { propertyId: 'P1', tenantIds: ['T1'], rent: 800, start: ANO + '-01-01', end: (ANO + 6) + '-12-31' };
    assert.ok(app.irsRate(longo) < 25, 'sete anos dão taxa reduzida');
    app.cForm = app.normContract(Object.assign({ fisco: { estado: 'declarado' } }, longo));
    assert.match(dobraFisco(app.ctBody()), /Taxa reduzida pela duração[^<]*15 de fevereiro/);
    app.cForm = app.normContract(Object.assign({ fisco: { estado: 'declarado', finalidade: 'hp' } }, longo));
    assert.match(dobraFisco(app.ctBody()), /Taxa reduzida pela duração/);
    app.cForm = app.normContract(Object.assign({ fisco: { estado: 'declarado', finalidade: 'nh' } }, longo));
    assert.doesNotMatch(dobraFisco(app.ctBody()), /Taxa reduzida/, 'não habitacional não tem taxa reduzida');
    app.cForm = app.normContract(Object.assign({ fisco: { estado: '' } }, longo));
    assert.doesNotMatch(dobraFisco(app.ctBody()), /Taxa reduzida/, 'por indicar não a tem');
    app.cForm = app.normContract(Object.assign({ fisco: { estado: 'declarado' } }, longo, { end: (ANO + 1) + '-12-31' }));
    assert.doesNotMatch(dobraFisco(app.ctBody()), /Taxa reduzida/, 'um contrato curto não a tem');
  });
});

describe('setFiscoEstado, addRenov, delRenov e collectCt', () => {
  let repor = null;
  beforeEach(() => { monta(); });
  afterEach(() => { if (repor) repor(); repor = null; });

  test('setFiscoEstado muda o estado e guarda os ids das renovações', () => {
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 800,
      fisco: { estado: 'declarado', renovacoes: [{ id: 'R1', inicio: '2025-01-01', fim: '2025-12-31' }] } });
    app.setFiscoEstado('naoDeclarado');
    assert.equal(app.cForm.fisco.estado, 'naoDeclarado');
    assert.equal(app.cForm.fisco.renovacoes.length, 1);
    assert.equal(app.cForm.fisco.renovacoes[0].id, 'R1', 'o normFisco não inventa ids novos');
    app.setFiscoEstado('declarado');
    assert.equal(app.cForm.fisco.estado, 'declarado');
    app.setFiscoEstado('');
    assert.equal(app.cForm.fisco.estado, '');
    app.setFiscoEstado('inventado');
    assert.equal(app.cForm.fisco.estado, '', 'um estado fora de FISCO_ESTADOS cai em por indicar');
  });

  test('addRenov acrescenta uma linha com id, o formulário mostra-a, delRenov tira-a', () => {
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 800, fisco: { estado: 'declarado' } });
    app.addRenov();
    assert.equal(app.cForm.fisco.renovacoes.length, 1);
    const id = app.cForm.fisco.renovacoes[0].id;
    assert.ok(id, 'com id, para os campos se encontrarem no repaint');
    const dobra = dobraFisco(app.ctBody());
    assert.match(dobra, new RegExp('id="c_rini_' + id + '"'));
    assert.match(dobra, new RegExp('id="c_rfim_' + id + '"'));
    app.addRenov();
    assert.equal(app.cForm.fisco.renovacoes.length, 2);
    app.delRenov(id);
    assert.equal(app.cForm.fisco.renovacoes.length, 1);
    assert.notEqual(app.cForm.fisco.renovacoes[0].id, id);
  });

  test('collectCt lê os campos do declarado e grava no formato do normFisco', () => {
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 800,
      fisco: { estado: 'declarado', renovacoes: [{ id: 'R1' }] } });
    repor = domCom({ c_fnum: ' 1234567 ', c_ffin: 'hp', c_fcel: '2024-03-01', c_fren: '1',
      c_rini_R1: '2025-03-01', c_rfim_R1: '2026-02-28', c_fces: 'fim do prazo', c_rent: '800', c_active: true });
    app.collectCt();
    const f = app.cForm.fisco;
    assert.equal(f.estado, 'declarado', 'o estado não vem de um campo: só dos botões');
    assert.equal(f.numero, '1234567', 'aparado');
    assert.equal(f.finalidade, 'hp');
    assert.equal(f.celebracao, '2024-03-01');
    assert.equal(f.renovavel, true);
    igual(f.renovacoes, [{ id: 'R1', inicio: '2025-03-01', fim: '2026-02-28' }]);
    assert.equal(f.cessacaoMotivo, 'fim do prazo');
    assert.equal(app.cForm.rent, 800, 'o resto do formulário continua a ser lido');
  });

  test('collectCt: «Não» é false, «Não sei» é null, e o que não é válido cai', () => {
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 800, fisco: { estado: 'declarado', renovavel: true, finalidade: 'hp' } });
    repor = domCom({ c_fren: '0', c_ffin: 'inventada', c_fcel: 'ontem', c_rent: '800' });
    app.collectCt();
    assert.equal(app.cForm.fisco.renovavel, false);
    assert.equal(app.cForm.fisco.finalidade, '', 'uma finalidade fora de FISCO_FINALIDADES não se guarda');
    assert.equal(app.cForm.fisco.celebracao, '', 'só datas ISO');
    repor(); repor = domCom({ c_fren: '', c_rent: '800' });
    app.collectCt();
    assert.equal(app.cForm.fisco.renovavel, null);
  });

  test('collectCt sem os campos no ecrã (contrato não declarado) não toca no bloco', () => {
    app.cForm = app.normContract({ propertyId: 'P1', tenantIds: ['T1'], rent: 800,
      fisco: { estado: 'naoDeclarado', numero: '1234567', finalidade: 'hp', renovavel: true } });
    repor = domCom({ c_rent: '800' });
    app.collectCt();
    igual(app.cForm.fisco, { estado: 'naoDeclarado', numero: '1234567', finalidade: 'hp', celebracao: '', renovavel: true, renovacoes: [], cessacaoMotivo: '' });
  });
});

describe('a ficha do contrato diz o estado fiscal', () => {
  test('por indicar', () => {
    monta();
    assert.match(app.ctFicha('C1'), /<span>Declaração<\/span><b>Por indicar<\/b>/);
  });

  test('declarado, com o número e a finalidade quando existem', () => {
    monta({ estado: 'declarado', numero: '1234567', finalidade: 'hp' });
    assert.match(app.ctFicha('C1'), /<b>Declarado à AT · n\.º 1234567 · habitação permanente<\/b>/);
    monta({ estado: 'declarado', numero: '1234567' });
    assert.match(app.ctFicha('C1'), /<b>Declarado à AT · n\.º 1234567<\/b>/);
    monta({ estado: 'declarado', finalidade: 'nh' });
    assert.match(app.ctFicha('C1'), /<b>Declarado à AT · sem n\.º · não habitacional<\/b>/);
    monta({ estado: 'declarado', numero: '<b>' });
    assert.match(app.ctFicha('C1'), /n\.º &lt;b&gt;/, 'o número é escapado');
  });

  test('não declarado: uma linha como as outras, sem cor nem nota', () => {
    monta({ estado: 'naoDeclarado' });
    const h = app.ctFicha('C1');
    assert.match(h, /<div class="stat"><span>Declaração<\/span><b>Não declarado<\/b><\/div>/);
    assert.doesNotMatch(h, /fora da declaração|ilegal|coima|risco/i);
  });

  test('a nota da taxa reduzida: no declarado de habitação com duração, e só aí', () => {
    const longo = { start: ANO + '-01-01', end: (ANO + 6) + '-12-31' };
    monta({ estado: 'declarado' }, longo);
    const h = app.ctFicha('C1');
    assert.match(h, /taxa reduzida de 15 %/);
    assert.match(h, /quadro 4\.2 do Anexo F/);
    assert.match(h, /15 de fevereiro/);
    monta({ estado: 'declarado', finalidade: 'nh' }, longo);
    assert.doesNotMatch(app.ctFicha('C1'), /taxa reduzida/);
    monta({ estado: 'naoDeclarado' }, longo);
    assert.doesNotMatch(app.ctFicha('C1'), /taxa reduzida/);
    monta({ estado: '' }, longo);
    assert.doesNotMatch(app.ctFicha('C1'), /taxa reduzida/);
    monta({ estado: 'declarado' });
    assert.doesNotMatch(app.ctFicha('C1'), /taxa reduzida/, 'sem fim, a taxa é 25 %');
  });
});

describe('o formulário do movimento', () => {
  let repor = null;
  beforeEach(() => { monta(); });
  afterEach(() => { if (repor) repor(); repor = null; });

  test('uma renda pede o mês e a retenção; o recibo só com contrato declarado', () => {
    app.tForm = app.normTx({ kind: 'income', propertyId: 'P1', contractId: 'C1', date: ANO + '-09-05', periodo: ANO + '-09', retencao: 12.5 });
    let html = app.txBody();
    assert.match(html, new RegExp('id="t_periodo" type="month" value="' + ANO + '-09"'));
    assert.match(html, /id="t_retencao"[^>]*inputmode="decimal"[^>]*value="12,5"/);
    assert.match(html, /a renda bruta é o montante mais isto/);
    assert.doesNotMatch(html, /id="t_recibo"/, 'por indicar: sem recibo');
    // e vem logo a seguir ao contrato
    assert.ok(html.indexOf('id="t_ct"') < html.indexOf('id="t_periodo"'));
    assert.ok(html.indexOf('id="t_periodo"') < html.indexOf('id="fold_cat"'));
    app.db.contracts[0].fisco.estado = 'declarado';
    app.tForm.recibo = true;
    html = app.txBody();
    assert.match(html, /<input type="checkbox" id="t_recibo" checked> Recibo de renda eletrónico emitido/);
    assert.match(html, /marcar aqui cala o aviso/);
    app.db.contracts[0].fisco.estado = 'naoDeclarado';
    assert.doesNotMatch(app.txBody(), /id="t_recibo"/, 'não declarado: sem recibo');
  });

  test('num modelo ou numa recorrência fica só a retenção: o mês e o recibo são de cada renda', () => {
    app.db.contracts[0].fisco.estado = 'declarado';
    for (const marca of ['_tplNew', '_tplId', '_recNew', '_recId']) {
      app.tForm = app.normTx({ kind: 'income', propertyId: 'P1', contractId: 'C1' });
      app.tForm[marca] = marca.endsWith('Id') ? 'X' : true;
      const html = app.txBody();
      assert.match(html, /id="t_retencao"/, marca + ': a retenção repete-se');
      assert.doesNotMatch(html, /id="t_periodo"|id="t_recibo"/, marca + ': sem campos que não gravam');
    }
  });

  test('uma receita sem contrato nem categoria Rendas não tem os campos; com a categoria tem', () => {
    app.tForm = app.normTx({ kind: 'income', propertyId: 'P1' });
    assert.doesNotMatch(app.txBody(), /id="t_periodo"|id="t_retencao"/);
    app.tForm = app.normTx({ kind: 'income', propertyId: 'P1', category: 'Rendas' });
    assert.match(app.txBody(), /id="t_periodo"/);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'P1', contractId: 'C1' });
    assert.doesNotMatch(app.txBody(), /id="t_periodo"|id="t_retencao"/, 'uma despesa não é uma renda');
  });

  test('uma despesa escolhe a coluna do Anexo F, com a regra da categoria à cabeça', () => {
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'P1', category: 'Impostos', sub: 'IMI' });
    let html = app.txBody();
    assert.match(html, /id="t_irscol"/);
    assert.match(html, /Pela categoria: IMI/);
    for (const [, rotulo] of app.IRS_COLUNAS) assert.ok(html.includes(app.esc(rotulo)), 'a coluna «' + rotulo + '»');
    assert.match(html, /Só o que pagaste para obter a renda entra/);
    // a primeira opção segue a categoria e a subcategoria
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'P1', category: 'Impostos' });
    assert.match(app.txBody(), /Pela categoria: Taxas autárquicas/);
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'P1', category: 'Manutenção e reparações', sub: 'Pragas' });
    assert.match(app.txBody(), /Pela categoria: Conservação e manutenção/);
    // com uma coluna escolhida à mão, a primeira opção continua a dizer a regra — e a escolha fica marcada
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'P1', category: 'Impostos', sub: 'IMI', irsCol: 'obras24' });
    html = app.txBody();
    assert.match(html, /Pela categoria: IMI/);
    assert.match(html, /id="t_irscol" value="obras24"/);
    // uma receita não tem coluna
    app.tForm = app.normTx({ kind: 'income', propertyId: 'P1', contractId: 'C1' });
    assert.doesNotMatch(app.txBody(), /id="t_irscol"/);
  });

  test('prefill sugere o mês da renda a partir da data, só num movimento novo com contrato', () => {
    const novo = (extra) => { app.tForm = app.normTx(Object.assign({ kind: 'income', propertyId: 'P1', contractId: 'C1', date: ANO + '-09-05' }, extra || {})); app.tForm._edit = false; app.prefill(); return app.tForm; };
    assert.equal(novo().periodo, ANO + '-09');
    assert.equal(novo({ periodo: ANO + '-08' }).periodo, ANO + '-08', 'um mês já escrito fica');
    assert.equal(novo({ contractId: null }).periodo, '', 'sem contrato não se adivinha');
    assert.equal(novo({ kind: 'expense' }).periodo, '');
    app.tForm = app.normTx({ kind: 'income', propertyId: 'P1', contractId: 'C1', date: ANO + '-09-05' });
    app.tForm._edit = true; app.prefill();
    assert.equal(app.tForm.periodo, '', 'a editar, um mês vazio é uma decisão de quem gravou');
  });

  test('collectTx lê o mês, a retenção, o recibo e a coluna, no formato do normTx', () => {
    app.db.contracts[0].fisco.estado = 'declarado';
    app.tForm = app.normTx({ kind: 'income', propertyId: 'P1', contractId: 'C1' });
    repor = domCom({ t_label: 'Renda', t_amount: '800', t_date: ANO + '-09-05', t_periodo: ANO + '-08', t_retencao: '200,5', t_recibo: true });
    app.collectTx();
    assert.equal(app.tForm.periodo, ANO + '-08');
    assert.equal(app.tForm.retencao, 200.5);
    assert.equal(app.tForm.recibo, true);
    assert.equal(app.tForm.irsCol, '', 'sem o campo no ecrã, não se toca');
    repor(); repor = domCom({ t_label: 'Renda', t_amount: '800', t_periodo: '8/' + ANO, t_retencao: '-5', t_recibo: false });
    app.collectTx();
    assert.equal(app.tForm.periodo, ANO + '-08', 'MM/AAAA, onde o browser dá o mês como texto');
    assert.equal(app.tForm.retencao, 0, 'nunca negativa');
    assert.equal(app.tForm.recibo, false);
    repor(); repor = domCom({ t_label: 'Renda', t_amount: '800', t_periodo: 'lixo' });
    app.collectTx();
    assert.equal(app.tForm.periodo, '', 'o que não é um mês fica vazio');
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'P1', category: 'Impostos' });
    repor(); repor = domCom({ t_label: 'IMI', t_amount: '300', t_irscol: 'imi' });
    app.collectTx();
    assert.equal(app.tForm.irsCol, 'imi');
    assert.equal(app.normTx(app.tForm).irsCol, 'imi', 'o que se grava sobrevive ao normTx');
  });

  test('onIrsCol guarda a coluna escolhida; vazio é pela categoria', () => {
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'P1', category: 'Impostos' });
    repor = domCom({ t_label: 'IMI', t_amount: '300', t_irscol: 'selo' });
    app.onIrsCol();
    assert.equal(app.tForm.irsCol, 'selo');
    repor(); repor = domCom({ t_label: 'IMI', t_amount: '300', t_irscol: '' });
    app.onIrsCol();
    assert.equal(app.tForm.irsCol, '');
  });

  test('mudar a subcategoria numa despesa repinta, para a regra da coluna acompanhar', () => {
    let pintado = 0;
    const original = app.repaintTx;
    app.repaintTx = () => { pintado++; };
    try {
      app.tForm = app.normTx({ kind: 'expense', propertyId: 'P1', category: 'Impostos' });
      repor = domCom({ t_label: 'IMI', t_amount: '300', t_sub: 'IMI' });
      app.onSubChange();
      assert.equal(app.tForm.sub, 'IMI');
      assert.equal(pintado, 1);
      app.tForm = app.normTx({ kind: 'income', propertyId: 'P1', category: 'Rendas' });
      repor(); repor = domCom({ t_label: 'Renda', t_amount: '800', t_sub: 'Renda mensal' });
      app.onSubChange();
      assert.equal(pintado, 1, 'numa receita nada depende da subcategoria');
    } finally { app.repaintTx = original; }
  });
});

describe('a ficha do movimento', () => {
  const renda = (extra) => {
    app.db.transactions = [app.normTx(Object.assign({ id: 'T1', kind: 'income', label: 'Renda', amount: 800, propertyId: 'P1', contractId: 'C1', date: ANO + '-09-05' }, extra || {}))];
    return app.txFicha('T1');
  };

  test('uma renda com retenção mostra o retido, a renda bruta e o mês', () => {
    monta({ estado: 'declarado' });
    const h = renda({ retencao: 250, periodo: ANO + '-08' });
    assert.match(h, new RegExp('<span>Retido na fonte</span><b>' + app.euro2(250).replace(/\s/g, '\\s') + '</b>'));
    assert.match(h, new RegExp('<span>Renda bruta</span><b>' + app.euro2(1050).replace(/\s/g, '\\s') + '</b>'));
    assert.match(h, new RegExp('<span>Mês da renda</span><b>ago ' + ANO + '</b>'));
    assert.match(h, /<span>Recibo eletrónico<\/span><b>Por emitir<\/b>/);
    assert.match(renda({ recibo: true }), /<span>Recibo eletrónico<\/span><b>Emitido<\/b>/);
  });

  test('sem retenção nem contrato declarado, nada disso aparece', () => {
    monta();
    const h = renda({ periodo: ANO + '-09' });
    assert.doesNotMatch(h, /Retido na fonte|Renda bruta/);
    assert.doesNotMatch(h, /Recibo eletrónico/, 'por indicar: a AT não espera recibo');
    assert.match(h, /Mês da renda/);
    monta({ estado: 'naoDeclarado' });
    assert.doesNotMatch(renda({ periodo: ANO + '-09', recibo: true }), /Recibo eletrónico/);
    monta({ estado: 'declarado' });
    assert.doesNotMatch(renda({ periodo: ANO + '-09', category: 'Rendas', sub: 'Caução' }), /Mês da renda|Recibo eletrónico/, 'uma caução não é renda');
    assert.doesNotMatch(renda({ kind: 'expense', category: 'Impostos', retencao: 250 }), /Retido na fonte/);
  });

  test('uma despesa diz a coluna do Anexo F e de onde veio a decisão', () => {
    monta();
    const despesa = (extra) => {
      app.db.transactions = [app.normTx(Object.assign({ id: 'D1', kind: 'expense', label: 'Gasto', amount: 100, propertyId: 'P1', date: ANO + '-03-01' }, extra || {}))];
      return app.txFicha('D1');
    };
    const linha = (h) => { const m = /<span>Anexo F<\/span><b>([^<]*)(?:<span class="small"[^>]*>([^<]*)<\/span>)?<\/b>/.exec(h); assert.ok(m, 'a linha Anexo F'); return [m[1].trim(), m[2] || '']; };
    igual(linha(despesa({ category: 'Impostos', sub: 'IMI' })), ['IMI', 'pela subcategoria']);
    igual(linha(despesa({ category: 'Impostos' })), ['Taxas autárquicas', 'pela categoria']);
    igual(linha(despesa({ category: 'Impostos', sub: 'IMI', irsCol: 'obras24' })), ['Obras antes do arrendamento (24 meses)', 'escolhida neste movimento']);
    igual(linha(despesa({ category: 'Categoria inventada' })), ['Outros gastos', 'sem regra, cai em Outros']);
    app.db.settings.exclude = { 'cats:Fora': true };
    igual(linha(despesa({ category: 'Fora' })), ['Não dedutível', 'não conta: categoria fora dos totais']);
    assert.doesNotMatch(renda(), /Anexo F/, 'uma renda não tem coluna');
  });
});
