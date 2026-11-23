// O modelo de dados da vaga 1 do IRS (KAN-126, folha 2.1.1 do plano das
// correções, com o §5.1 do contrato rev. 5): os campos novos do contrato, do
// imóvel, do movimento, da pessoa e das definições, e as três migrações — as
// comunicações por período, o mapa das colunas do Anexo F e as categorias (com o
// identificador fixo das que o IRS lê). Cada defeito da folha tem aqui pelo
// menos um assert, que falhava antes desta folha. Lógica pura sobre o db, sem
// browser.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
beforeEach(() => limpar(app));
afterEach(() => repor(app));

/* Um JSON que atravessa o contexto isolado (os objetos da vm têm outro protótipo). */
const copia = (o) => JSON.parse(JSON.stringify(o));

describe('D01 · as comunicações da duração passam a ser por período (comunicacoesV=2)', () => {
  test('uma chave antiga (ano dos rendimentos) passa ao ano do início do período, e uma segunda passagem não muda nada', () => {
    const c = app.normContract({ id: 'C', start: '2024-03-01', end: '2034-02-28', fisco: { comunicacoes: { 2024: '2025-02-10' } } });
    igual(c.fisco.comunicacoes, { 2024: '2025-02-10' });
    assert.equal(c.fisco.comunicacoesV, 2);
    const outra = app.normContract(copia(c));
    igual(outra.fisco.comunicacoes, { 2024: '2025-02-10' }, 'idempotente');
    assert.equal(outra.fisco.comunicacoesV, 2);
    // depois do prazo do período (15/02/2025), a marca antiga não diz quando se comunicou: fica por confirmar (N003)
    const tarde = app.normContract({ id: 'C', start: '2024-03-01', end: '2034-02-28', fisco: { comunicacoes: { 2025: '2026-02-10' } } });
    igual(tarde.fisco.comunicacoes, {});
    igual(tarde.fisco.comunicacoesPorConfirmar, { 2024: '2026-02-10' });
    igual(app.normContract(copia(tarde)).fisco.comunicacoesPorConfirmar, { 2024: '2026-02-10' }, 'idempotente');
  });

  test('duas do mesmo período ficam com a data mais antiga; uma renovação é outro período; uma de antes do início cai', () => {
    const c = app.normContract({ id: 'C', start: '2024-03-01', end: '2029-02-28',
      fisco: { renovacoes: [{ id: 'R', inicio: '2026-03-01', fim: '2029-02-28' }],
        comunicacoes: { 2023: '2023-05-01', 2024: '2025-02-10', 2025: '2026-02-03', 2026: '2027-02-01', 2027: '2028-02-01' } } });
    igual(c.fisco.comunicacoes, { 2024: '2025-02-10', 2026: '2027-02-01' });
  });

  test('uma chave já no sentido novo (o ano do início de um período) fica onde está', () => {
    const c = app.normContract({ id: 'C', start: '2024-03-01', end: '2029-02-28',
      fisco: { renovacoes: [{ id: 'R', inicio: '2026-03-01', fim: '2029-02-28' }], comunicacoes: { 2024: '2025-02-10', 2026: '2027-02-01' } } });
    igual(c.fisco.comunicacoes, { 2024: '2025-02-10', 2026: '2027-02-01' });
  });

  test('sem início não se adivinha (fica por migrar); sem chaves a marca entra já', () => {
    const c = app.normContract({ id: 'C', fisco: { comunicacoes: { 2025: '2026-02-10' } } });
    igual(c.fisco.comunicacoes, { 2025: '2026-02-10' });
    assert.equal(c.fisco.comunicacoesV, 0);
    assert.equal(app.normContract({ id: 'C' }).fisco.comunicacoesV, 2);
  });

  test('com a marca a 2, nada se migra (a chave nova é do ano do início)', () => {
    const c = app.normContract({ id: 'C', start: '2024-03-01', end: '2034-02-28', fisco: { comunicacoesV: 2, comunicacoes: { 2025: '2026-02-10' } } });
    igual(c.fisco.comunicacoes, { 2025: '2026-02-10' });
    assert.equal(app.normFisco({ comunicacoesV: '2' }).comunicacoesV, 0, 'a marca é o número 2, nada mais');
  });
});

describe('D02, D09, D10, D14, D39 · a cessação guarda-se à parte do termo', () => {
  test('cessacao = {data, motivo}: a data que existe e o código do quadro 10; o termo não muda', () => {
    const c = app.normContract({ id: 'C', start: '2024-03-01', end: '2029-02-28', active: false,
      fisco: { cessacao: { data: '2026-06-30', motivo: '01' } } });
    igual(c.fisco.cessacao, { data: '2026-06-30', motivo: '01' });
    assert.equal(c.end, '2029-02-28', 'o c.end é o termo estipulado, nunca a data da cessação');
    igual(app.normFisco({}).cessacao, { data: '', motivo: '' });
    igual(app.normFisco({ cessacao: { data: '2026-02-30', motivo: '13' } }).cessacao, { data: '', motivo: '' });
    igual(app.normFisco({ cessacao: 'ontem' }).cessacao, { data: '', motivo: '' });
    igual(app.normFisco({ cessacao: { data: '2026-06-30', motivo: 1 } }).cessacao, { data: '2026-06-30', motivo: '' }, 'o código é texto com dois algarismos');
    assert.equal(app.normFisco({ cessacaoMotivo: 'Acordo' }).cessacaoMotivo, 'Acordo', 'o texto antigo fica, como nota');
  });
});

describe('D42 · uma renovação escrita só no bloco leva o termo com ela', () => {
  test('c.end 2025-12-31 com a renovação 2026-01-01 a 2030-12-31 passa a 2030-12-31', () => {
    const c = app.normContract({ id: 'C', start: '2021-01-01', end: '2025-12-31',
      fisco: { renovacoes: [{ id: 'R', inicio: '2026-01-01', fim: '2030-12-31' }] } });
    assert.equal(c.end, '2030-12-31');
  });
  test('uma renovação que acaba antes do termo, uma com lixo e um contrato sem termo não mexem no fim', () => {
    assert.equal(app.normContract({ start: '2021-01-01', end: '2030-12-31', fisco: { renovacoes: [{ inicio: '2026-01-01', fim: '2028-12-31' }] } }).end, '2030-12-31');
    assert.equal(app.normContract({ start: '2021-01-01', end: '2025-12-31', fisco: { renovacoes: [{ inicio: '2026-01-01', fim: '2030-02-30' }] } }).end, '2025-12-31');
    assert.equal(app.normContract({ start: '2021-01-01', end: '', fisco: { renovacoes: [{ inicio: '2026-01-01', fim: '2030-12-31' }] } }).end, '');
    assert.equal(app.normContract({ start: '2021-01-01', end: '2025-12-31', fisco: { renovacoes: [{ inicio: '', fim: '2030-12-31' }] } }).end, '2025-12-31',
      'sem início o motor não conta a renovação: o termo não pode alongar o período inicial');
    assert.equal(app.normContract({ start: '2021-01-01', end: '2025-12-31', fisco: { renovacoes: [{ inicio: '2031-01-01', fim: '2030-12-31' }] } }).end, '2025-12-31');
  });
});

describe('os campos novos do bloco fiscal (D18, D26, D28, D46, D47, D48, D76)', () => {
  test('as isenções 6H (prerau) e 6F (al) entram, com as condições; o resto volta à omissão', () => {
    assert.equal(app.normFisco({ isencao: 'prerau' }).isencao, 'prerau');
    assert.equal(app.normFisco({ isencao: 'al' }).isencao, 'al');
    assert.equal(app.normFisco({ isencao: 'pre-rau' }).isencao, '');
    const f = app.normFisco({ nrau3536: true, alRegistado2022: false });
    assert.equal(f.nrau3536, true);
    assert.equal(f.alRegistado2022, false);
    assert.equal(app.normFisco({ nrau3536: 'sim' }).nrau3536, null);
  });
  test('o envio ao IHRU é uma data que existe (D46)', () => {
    assert.equal(app.normFisco({ ihru: '2026-01-10' }).ihru, '2026-01-10');
    assert.equal(app.normFisco({ ihru: true }).ihru, '');
    assert.equal(app.normFisco({ ihru: '2026-13-01' }).ihru, '');
  });
  test('inquilino empresa (D47), consumos (D26), obras dos 24 meses (D28): sim, não ou por responder', () => {
    const f = app.normFisco({ empresaHabitacao: false, consumosIncluidos: true, obrasSemOutroUso: true });
    assert.equal(f.empresaHabitacao, false);
    assert.equal(f.consumosIncluidos, true);
    assert.equal(f.obrasSemOutroUso, true);
    const g = app.normFisco({ empresaHabitacao: 1, consumosIncluidos: 'sim', obrasSemOutroUso: 0 });
    assert.equal(g.empresaHabitacao, null);
    assert.equal(g.consumosIncluidos, false, 'os consumos são sim ou não (omissão não)');
    assert.equal(g.obrasSemOutroUso, null);
  });
  test('os extras mensais são euros ≥ 0, ao cêntimo (D48)', () => {
    assert.equal(app.normFisco({ extrasMensais: '45.555' }).extrasMensais, 45.56);
    assert.equal(app.normFisco({ extrasMensais: -10 }).extrasMensais, 0);
    assert.equal(app.normFisco({ extrasMensais: 'muito' }).extrasMensais, 0);
    assert.equal(app.normFisco({ extrasMensais: true }).extrasMensais, 0);
  });
  test('a atualização de 2023 é sim, não ou por responder (D76)', () => {
    assert.equal(app.normFisco({ atualizacao2023: 'sim' }).atualizacao2023, 'sim');
    assert.equal(app.normFisco({ atualizacao2023: 'nao' }).atualizacao2023, 'nao');
    assert.equal(app.normFisco({ atualizacao2023: true }).atualizacao2023, '');
  });
});

describe('o imóvel: comproprietários fora da app, quotas com data, venda, subarrendamento, afetação', () => {
  test('D08 · null é por confirmar, [] é confirmado, e os de fora com nome e quota', () => {
    assert.equal(app.normProp({}).comproprietariosFora, null);
    igual(app.normProp({ comproprietariosFora: [] }).comproprietariosFora, []);
    igual(app.normProp({ comproprietariosFora: [{ id: 'f1', nome: ' Rita ', quota: '25.004' }, { nome: 'sem quota' }, { nome: 'x', quota: 0 },
      { nome: '  ', quota: 5 }, { nome: 7, quota: 5 }, 'lixo'] }).comproprietariosFora,
      [{ id: 'f1', nome: 'Rita', quota: 25 }], 'nome e quota (ao centésimo), como o servidor (acesso.js:validarFora)');
    assert.equal(app.normProp({ comproprietariosFora: [{ nome: 'A', quota: 60 }, { nome: 'B', quota: 40 }] }).comproprietariosFora, null, 'a soma tem de ficar abaixo de 100');
    assert.equal(app.normProp({ comproprietariosFora: 'ninguém' }).comproprietariosFora, null);
    const semId = app.normProp({ comproprietariosFora: [{ nome: 'Rui', quota: 10 }] }).comproprietariosFora;
    assert.equal(semId[0].id, app.normProp({ comproprietariosFora: [{ nome: 'Rui', quota: 10 }] }).comproprietariosFora[0].id, 'o id derivado é sempre o mesmo');
    assert.match(semId[0].id, /^[A-Za-z0-9_-]+$/);
    igual(app.normProp({ comproprietariosFora: [{ id: 'f', nome: 'A', quota: 10 }, { id: 'f', nome: 'B', quota: 20 }] }).comproprietariosFora,
      [{ id: 'f', nome: 'A', quota: 10 }], 'um id só uma vez');
  });
  test('D29 · o histórico das quotas: datas válidas, por ordem, uma por dia, quotas só dos donos da entrada', () => {
    const p = app.normProp({ quotasHist: [
      { ate: '2026-06-30', ownerIds: ['a', 'b'], ownerShares: { a: 50, b: 50, c: 10 }, fora: [{ id: 'f', nome: 'F', quota: 20 }] },
      { ate: '2025-12-31', ownerIds: ['a'], ownerShares: { a: 100 } },
      { ate: '2025-12-31', ownerIds: ['b'], ownerShares: { b: 100 } },
      { ate: 'ontem', ownerIds: ['a'] }, null] });
    igual(p.quotasHist, [
      { ate: '2025-12-31', ownerIds: ['a'], ownerShares: { a: 100 }, fora: null },
      { ate: '2026-06-30', ownerIds: ['a', 'b'], ownerShares: { a: 50, b: 50 }, fora: [{ id: 'f', nome: 'F', quota: 20 }] }]);
    igual(app.normProp({ quotasHist: 'x' }).quotasHist, []);
  });
  test('D33 · vendido é uma data, e imovelVendido diz se já foi até um dia', () => {
    assert.equal(app.normProp({ vendido: '2026-05-10' }).vendido, '2026-05-10');
    assert.equal(app.normProp({ vendido: true }).vendido, '');
    assert.equal(app.imovelVendido({ vendido: '2026-05-10' }, '2026-05-10'), true);
    assert.equal(app.imovelVendido({ vendido: '2026-05-10' }, '2026-05-09'), false);
    assert.equal(app.imovelVendido({ vendido: '2026-05-10' }), true, 'por omissão, hoje (2026-11-17)');
    assert.equal(app.imovelVendido({ vendido: '2027-01-01' }), false);
    assert.equal(app.imovelVendido({ vendido: '' }), false);
    assert.equal(app.imovelVendido(null), false);
  });
  test('D52 · o subarrendamento, D71 · a afetação', () => {
    igual(app.normProp({}).subarrendamento, { ativo: false, nifSenhorio: '', rendaMensal: 0, parte: '', rendaParte: 0 });
    igual(app.normProp({ subarrendamento: { ativo: true, nifSenhorio: ' 123 456 789 0', rendaMensal: '650.5', parte: 'parte', rendaParte: '300.456' } }).subarrendamento,
      { ativo: true, nifSenhorio: '123456789', rendaMensal: 650.5, parte: 'parte', rendaParte: 300.46 });
    igual(app.normProp({ subarrendamento: { ativo: 'sim', rendaMensal: -1, parte: 'metade', rendaParte: true } }).subarrendamento,
      { ativo: false, nifSenhorio: '', rendaMensal: 0, parte: '', rendaParte: 0 });
    assert.equal(app.normProp({ afetacao: 'comercio' }).afetacao, 'comercio');
    assert.equal(app.normProp({ afetacao: 'loja' }).afetacao, '');
  });
});

describe('o movimento e a pessoa (D32, D58)', () => {
  test('D32 · notaPropria só numa despesa, e repete-se num modelo', () => {
    assert.equal(app.normTx({ kind: 'expense', notaPropria: true }).notaPropria, true);
    assert.equal(app.normTx({ kind: 'expense', notaPropria: 'sim' }).notaPropria, false);
    assert.equal(app.normTx({ kind: 'income', notaPropria: true }).notaPropria, false);
    assert.equal(app.normTx({}).notaPropria, false);
    assert.ok(app.TX_TPL_KEYS.includes('notaPropria'));
    assert.equal(app.txSnapshot(app.normTx({ kind: 'expense', notaPropria: true })).notaPropria, true);
  });
  test('D58 · retemVisto é booleano', () => {
    assert.equal(app.normPerson({}).retemVisto, false);
    assert.equal(app.normPerson({ retemVisto: true }).retemVisto, true);
    assert.equal(app.normPerson({ retemVisto: 'sim' }).retemVisto, false);
  });
});

describe('D30, D71, D91 · a situação fiscal de cada ano', () => {
  test('porAno: só anos de quatro dígitos e objetos; o cônjuge separado da letra; os números do AIMI', () => {
    const irs = app.normIrsDefs({ conjunta: true, porAno: {
      2025: { conjunta: true, conjugeId: 'ana', minhaLetra: 'B', dispensaRecibos: true, aimi: { total: '312.456', valorTributavel: 650000 }, outro: 1 },
      2026: { conjunta: 'sim', conjugeId: "x'); alert(1", minhaLetra: 'C', aimi: { total: -1, valorTributavel: true } },
      ano: { conjunta: true }, 2024: 'lixo' } });
    igual(irs.porAno[2025], { conjunta: true, conjugeId: 'ana', minhaLetra: 'B', dispensaRecibos: true, bensComuns: false, aimi: { total: 312.46, valorTributavel: 650000 }, outro: 1 });
    assert.equal(irs.porAno[2026].conjunta, false);
    assert.match(irs.porAno[2026].conjugeId, /^id_[0-9a-f]{16}$/, 'um id seguro');
    assert.equal(irs.porAno[2026].minhaLetra, 'A');
    igual(irs.porAno[2026].aimi, { total: null, valorTributavel: null });
    igual(Object.keys(irs.porAno).sort(), ['2025', '2026']);
    assert.equal(irs.conjunta, true, 'o topo fica: vale para os anos sem entrada');
    igual(app.normIrsDefs({}).porAno, {});
    igual(app.blank.settings.irs.porAno, {});
  });
});

describe('D06, D07, D24–D27, D53, D60, D61 · o mapa das colunas (irsMapaV=2, e a 3 das obras)', () => {
  test('o mapa de origem segue a tabela 1.5', () => {
    const m = app.IRS_MAPA0;
    const esperado = {
      'Impostos': 'confirmar', 'Impostos / Outro imposto': 'confirmar', 'Impostos / IMT': 'nao', 'Impostos / Imposto do selo da compra': 'nao',
      'Impostos / Taxas municipais': 'taxas', 'Condomínio / Fundo de reserva': 'nao', 'Condomínio / Quota extraordinária': 'confirmar',
      'Seguros': 'confirmar', 'Seguros / Multirriscos': 'nao', 'Seguros / Responsabilidade civil': 'nao', 'Seguros / Renda garantida': 'outros',
      'Manutenção e reparações / Eletrodomésticos': 'nao', 'Manutenção e reparações / Caldeira / AVAC': 'confirmar',
      'Água, luz e gás': 'confirmar', 'Serviços profissionais': 'confirmar', 'Serviços profissionais / Certificado energético': 'outros',
      'Serviços profissionais / Notário e registos': 'nao', 'Serviços profissionais / Avaliação': 'nao', 'Outros': 'confirmar',
      'Devoluções ao inquilino': 'confirmar', 'Devoluções ao inquilino / Devolução da caução': 'outros',
      'Devoluções ao inquilino / Devolução de renda': 'nao', 'Impostos / AIMI': 'nao' };
    for (const k of Object.keys(esperado)) assert.equal(m[k], esperado[k], k);
    assert.ok(app.IRS_MAPA_VALORES.some((c) => c[0] === 'confirmar'));
    assert.ok(!app.IRS_COLUNAS.some((c) => c[0] === 'confirmar'), 'o confirmar é só do mapa');
    assert.equal(app.normTx({ kind: 'expense', irsCol: 'confirmar' }).irsCol, 'confirmar', 'o irsCol aceita-o: é o que apagar uma subcategoria deixa escrito (N043)');
    assert.equal(app.normTx({ kind: 'expense', irsCol: 'lixo' }).irsCol, '');
  });

  test('a migração: só as chaves com o valor antigo de origem, uma vez, e nunca contra uma escolha feita depois', () => {
    const st = { cats: { Seguros: [] }, catsIn: { Rendas: [] },
      irsMapa: { 'Seguros': 'outros', 'Outros': 'outros', 'Água, luz e gás': 'conservacao', 'Impostos': 'taxas', 'Serviços profissionais': 'nao' } };
    app.fillCats(st);
    assert.equal(st.irsMapa['Seguros'], 'confirmar');
    assert.equal(st.irsMapa['Outros'], 'confirmar');
    assert.equal(st.irsMapa['Impostos'], 'confirmar');
    assert.equal(st.irsMapa['Água, luz e gás'], 'conservacao', 'a escolha da pessoa fica');
    assert.equal(st.irsMapa['Serviços profissionais'], 'nao');
    assert.equal(st.irsMapa['Seguros / Multirriscos'], 'nao', 'as chaves novas entram');
    assert.equal(st.irsMapaV, 3);
    // escolhida depois da marca, fica — também em cada leitura seguinte
    st.irsMapa['Seguros'] = 'outros';
    app.fillCats(st);
    app.fillCats(st);
    assert.equal(st.irsMapa['Seguros'], 'outros');
    // uma base gravada já com a marca e o «outros» escolhido
    const st3 = { cats: { X: [] }, catsIn: { Y: [] }, irsMapaV: 2, irsMapa: { 'Seguros': 'outros' } };
    app.fillCats(st3);
    assert.equal(st3.irsMapa['Seguros'], 'outros');
  });

  test('com Seguros em Conservação gravado antes, fica; e uma coluna que não existe sai', () => {
    const st = { cats: { X: [] }, catsIn: { Y: [] }, irsMapa: { 'Seguros': 'conservacao', 'Minha': 'inventada', 'Outra': 'confirmar' } };
    app.fillCats(st);
    assert.equal(st.irsMapa['Seguros'], 'conservacao');
    assert.equal(st.irsMapa['Minha'], undefined);
    assert.equal(st.irsMapa['Outra'], 'confirmar');
  });

  test('uma marca maior (de uma versão futura) fica, e não se migra por baixo dela', () => {
    const st = { cats: { X: [] }, catsIn: { Y: [] }, irsMapaV: 4, catsV: 3, irsMapa: { 'Seguros': 'outros', 'Obras e benfeitorias': 'conservacao' } };
    app.fillCats(st);
    assert.equal(st.irsMapaV, 4);
    assert.equal(st.catsV, 3);
    assert.equal(st.irsMapa['Seguros'], 'outros');
    assert.equal(st.irsMapa['Obras e benfeitorias'], 'conservacao');
  });
});

describe('D03, D21, D51, D53 · as categorias de origem novas (catsV=2)', () => {
  test('as árvores de origem trazem as subcategorias e a categoria novas', () => {
    for (const s of ['IMT', 'Imposto do selo da compra', 'Taxas municipais']) assert.ok(app.CATS0['Impostos'].includes(s), s);
    igual(app.CATS0['Devoluções ao inquilino'], ['Devolução da caução', 'Devolução de renda']);
    for (const s of ['Indemnização', 'Outras receitas prediais']) assert.ok(app.CATS_IN0['Rendas'].includes(s), s);
  });

  test('entram uma vez nas árvores que existem; quem as remover depois não as vê voltar', () => {
    const st = { cats: { 'Impostos': ['IMI', 'AIMI', 'Imposto do selo'], 'Água, luz e gás': ['Água'] }, catsIn: { 'Rendas': ['Renda mensal', 'Caução'] } };
    app.fillCats(st);
    igual(st.cats['Impostos'], ['IMI', 'AIMI', 'Imposto do selo', 'IMT', 'Imposto do selo da compra', 'Taxas municipais']);
    igual(st.cats['Devoluções ao inquilino'], ['Devolução da caução', 'Devolução de renda']);
    igual(st.catsIn['Rendas'], ['Renda mensal', 'Caução', 'Indemnização', 'Outras receitas prediais']);
    assert.equal(st.catsV, 2);
    st.cats['Impostos'] = st.cats['Impostos'].filter((s) => s !== 'IMT');
    delete st.cats['Devoluções ao inquilino'];
    app.fillCats(st);
    assert.ok(!st.cats['Impostos'].includes('IMT'));
    assert.equal(st.cats['Devoluções ao inquilino'], undefined);
  });

  test('uma categoria de origem renomeada antes não ressuscita, e as subcategorias novas não vão para outra', () => {
    const st = { cats: { 'Taxas e impostos': ['IMI'] }, catsIn: { 'Arrendamentos': ['Renda mensal'] } };
    app.fillCats(st);
    assert.equal(st.cats['Impostos'], undefined);
    assert.equal(st.catsIn['Rendas'], undefined);
    igual(st.catsIn['Arrendamentos'], ['Renda mensal']);
  });

  test('a árvore do blank nunca é mexida pela migração (cópias novas)', () => {
    const antes = JSON.stringify(app.blank.settings.cats);
    const st = Object.assign({}, app.blank.settings, { catsIn: { Rendas: [] } });
    st.cats = app.blank.settings.cats;
    app.fillCats(st);
    assert.equal(JSON.stringify(app.blank.settings.cats), antes);
  });
});

describe('D19 · as categorias que o IRS lê têm um identificador fixo (rev. 5 §5.1)', () => {
  test('CATS_DO_IRS é a lista dos ids, e cada um tem o nome de origem numa árvore que existe', () => {
    assert.equal(app.CATS_DO_IRS.length, 18);
    assert.ok(app.CATS_DO_IRS.every((id) => /^[a-z]+(\/[a-z-]+)?$/.test(id)));
    const origem = Object.assign({}, app.CATS_IRS_ORIGEM.cats, app.CATS_IRS_ORIGEM.catsIn);
    igual(Object.values(origem).sort(), copia(app.CATS_DO_IRS).sort());
    const ids = app.blank.settings.catIds;
    assert.equal(ids.catsIn['Rendas'], 'rendas');
    assert.equal(ids.catsIn['Rendas / Caução'], 'rendas/caucao');
    assert.equal(ids.catsIn['Reembolsos / Condomínio'], 'reembolsos/condominio');
    assert.equal(ids.cats['Impostos / AIMI'], 'impostos/aimi');
    assert.equal(ids.cats['Devoluções ao inquilino / Devolução de renda'], 'devolucoes/renda');
    assert.equal(Object.keys(ids.cats).length + Object.keys(ids.catsIn).length, 18, 'o blank nasce com todos');
  });

  test('a migração dá o id a quem ainda tem o nome de origem; a renomeada antes fica sem id', () => {
    const st = { cats: { 'Impostos': ['IMI'], 'Outros': [] }, catsIn: { 'Arrendamentos': ['Renda mensal', 'Caução'], 'Reembolsos': ['Inquilino'] } };
    app.fillCats(st);
    assert.equal(st.catIds.catsIn['Arrendamentos'], undefined, 'não se adivinha');
    assert.equal(st.catIds.catsIn['Arrendamentos / Caução'], undefined);
    assert.equal(st.catIds.catsIn['Reembolsos'], 'reembolsos');
    assert.equal(st.catIds.catsIn['Reembolsos / Inquilino'], 'reembolsos/inquilino');
    assert.equal(st.catIds.cats['Impostos / IMI'], 'impostos/imi');
    assert.equal(st.catIds.cats['Impostos / IMT'], undefined, 'o IMT não é do IRS por id');
    assert.equal(st.catIds.cats['Devoluções ao inquilino / Devolução da caução'], 'devolucoes/caucao', 'as categorias novas também levam id');
    // depois da marca, criar uma «Rendas» nova não lhe dá o id (só a migração dá, uma vez)
    st.catsIn['Rendas'] = ['Renda mensal'];
    app.fillCats(st);
    assert.equal(st.catIds.catsIn['Rendas'], undefined);
  });

  test('o id segue o nome (a chave muda com ele), e o fillCats limpa o que não serve', () => {
    const st = { catsV: 2, cats: { 'Impostos': ['IMI'] }, catsIn: { 'Arrendamentos': ['Mensal'] },
      catIds: { catsIn: { 'Arrendamentos': 'rendas', 'Arrendamentos / Mensal': 'rendas/renda-mensal', 'Fantasma': 'rendas', 'Arrendamentos ': 'reembolsos' },
        cats: { 'Impostos': 'rendas', 'Impostos / IMI': 'impostos', 'Outra': 'impostos/imi' } } };
    app.fillCats(st);
    igual(st.catIds.catsIn, { 'Arrendamentos': 'rendas', 'Arrendamentos / Mensal': 'rendas/renda-mensal' });
    igual(st.catIds.cats, {}, 'um id de receita nas despesas, um de categoria numa subcategoria e uma chave fora da árvore caem');
  });

  test('cada id numa chave só: ganha a do nome de origem', () => {
    const st = { catsV: 2, cats: { X: [] }, catsIn: { 'Rendas': [], 'Minhas rendas': [] },
      catIds: { catsIn: { 'Minhas rendas': 'rendas', 'Rendas': 'rendas' } } };
    app.fillCats(st);
    igual(st.catIds.catsIn, { 'Rendas': 'rendas' });
  });

  test('catIrsId lê o id pela árvore, a categoria e a subcategoria; nunca lança', () => {
    const s = app.db.settings;
    assert.equal(app.catIrsId('catsIn', 'Rendas'), 'rendas');
    assert.equal(app.catIrsId('catsIn', 'Rendas', 'Caução'), 'rendas/caucao');
    assert.equal(app.catIrsId('income', ' Rendas ', 'Caução'), 'rendas/caucao', 'aceita o kind e apara');
    assert.equal(app.catIrsId('catsIn', 'Rendas', ''), 'rendas');
    assert.equal(app.catIrsId('cats', 'Impostos', 'AIMI'), 'impostos/aimi');
    assert.equal(app.catIrsId('expense', 'Impostos', 'IMT'), '');
    assert.equal(app.catIrsId('cats', 'Rendas'), '', 'a árvore conta');
    assert.equal(app.catIrsId('catsIn', 'Rendas', 'Inventada'), '', 'uma subcategoria que não está na árvore');
    // renomear: o id vai com a chave (o que o definicoes.js fará na vaga 2)
    s.catsIn['Arrendamentos'] = s.catsIn['Rendas']; delete s.catsIn['Rendas'];
    s.catIds.catsIn['Arrendamentos'] = 'rendas'; delete s.catIds.catsIn['Rendas'];
    assert.equal(app.catIrsId('catsIn', 'Arrendamentos'), 'rendas');
    assert.equal(app.catIrsId('catsIn', 'Rendas'), '', 'o nome antigo deixa de ser renda');
    assert.equal(app.catIrsId('xpto', 'Rendas'), '');
    assert.equal(app.catIrsId('catsIn', null, null), '');
    s.catIds = 'lixo';
    assert.equal(app.catIrsId('catsIn', 'Arrendamentos'), '');
    app.db = null;
    assert.equal(app.catIrsId('catsIn', 'Rendas'), '', 'sem db, vazio');
  });
});

describe('as migrações por onde passam: o load() e a leitura da nuvem', () => {
  /* Uma base gravada por uma versão de antes da vaga 1. */
  const BASE_ANTIGA = () => ({ v: 13,
    properties: [{ id: 'P1', name: 'T2', ownerIds: ['o1'], ownerShares: { o1: 100 } }],
    contracts: [{ id: 'C1', propertyId: 'P1', start: '2024-03-01', end: '2034-02-28', rent: 800,
      fisco: { estado: 'declarado', comunicacoes: { 2025: '2026-02-10' } } }],
    transactions: [], owners: [{ id: 'o1', name: 'Ana' }],
    settings: { cats: { 'Impostos': ['IMI', 'AIMI'], 'Seguros': ['Multirriscos'], 'Outros': [] },
      catsIn: { 'Rendas': ['Renda mensal', 'Caução'] },
      irsMapa: { 'Seguros': 'outros', 'Outros': 'outros', 'Impostos': 'taxas' },
      irs: { conjunta: false, titulares: {}, dispensaRecibos: false, outrosRendimentos: {} } } });

  test('o load() de uma base antiga migra tudo de uma vez', () => {
    const outra = carregarApp({ hoje: '2026-11-17', antes: (j) => j.localStorage.setItem('gi_v13', JSON.stringify(BASE_ANTIGA())) });
    const db = outra.db;
    // a marca de 2025 cai depois do prazo do período de 2024 (15/02/2025): por confirmar (N003)
    igual(db.contracts[0].fisco.comunicacoes, {});
    igual(db.contracts[0].fisco.comunicacoesPorConfirmar, { 2024: '2026-02-10' });
    assert.equal(db.contracts[0].fisco.comunicacoesV, 2);
    assert.equal(db.settings.irsMapa['Seguros'], 'confirmar');
    assert.equal(db.settings.irsMapa['Outros'], 'confirmar');
    assert.equal(db.settings.irsMapaV, 3);
    assert.equal(db.settings.catsV, 2);
    assert.ok(db.settings.cats['Impostos'].includes('IMT'));
    assert.ok(db.settings.catsIn['Rendas'].includes('Indemnização'));
    assert.equal(db.settings.catIds.catsIn['Rendas / Caução'], 'rendas/caucao');
    igual(db.settings.irs.porAno, {});
    assert.equal(outra.catIrsId('catsIn', 'Rendas', 'Indemnização'), 'rendas/indemnizacao');
  });

  test('normalizarBase: as marcas não vêm do blank (uma conta antiga migra)', () => {
    assert.equal(app.blank.settings.irsMapaV, undefined);
    assert.equal(app.blank.settings.catsV, undefined);
    const d = app.normalizarBase(BASE_ANTIGA());
    assert.equal(d.settings.irsMapa['Seguros'], 'confirmar');
    assert.ok(d.settings.cats['Impostos'].includes('IMT'));
  });

  test('a leitura da nuvem junta o blank por baixo das definições do servidor, e mesmo assim a conta antiga migra', () => {
    // o que nucleo.js:normalizarDaChave e nucleo.js:rebuildDb fazem às definições que o servidor manda
    const servidor = BASE_ANTIGA().settings;
    const s = Object.assign({}, app.blank.settings, servidor);
    app.fillCats(s);
    assert.equal(s.irsMapa['Seguros'], 'confirmar');
    assert.equal(s.irsMapa['Impostos'], 'confirmar');
    assert.ok(s.cats['Impostos'].includes('Taxas municipais'));
    assert.ok(s.catsIn['Rendas'].includes('Outras receitas prediais'));
    assert.equal(s.catIds.catsIn['Rendas / Indemnização'], 'rendas/indemnizacao');
    // e duas leituras dão o mesmo (dois aparelhos migram igual)
    const s2 = Object.assign({}, app.blank.settings, BASE_ANTIGA().settings);
    app.fillCats(s2);
    igual(s2, copia(s));
  });

  test('uma base nova (o blank) passa pela migração sem mudar nada além das marcas', () => {
    const s = copia(app.blank.settings);
    app.fillCats(s);
    igual(s.cats, copia(app.CATS0));
    igual(s.catsIn, copia(app.CATS_IN0));
    igual(s.irsMapa, copia(app.IRS_MAPA0));
    igual(s.catIds, copia(app.blank.settings.catIds));
    assert.equal(s.irsMapaV, 3);
    assert.equal(s.catsV, 2);
  });
});
