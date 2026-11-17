// O papel de cada movimento e de cada pessoa no IRS (KAN-126, folha 2.1.12 do
// plano das correções, com o contrato rev. 5): a coluna do Anexo F de uma
// despesa (irsColunaDe — o AIMI fixo, a omissão a confirmar), o papel de cada
// receita (irsReceitaDe, a tabela da §1.5 linha a linha), a devolução de uma
// renda (irsDevolucaoDeRenda), o NIF (o 45 dos não residentes, a pessoa
// coletiva) e a situação de quem declara em cada ano (irsSituacao). As
// categorias leem-se pelo identificador fixo (dados.js:catIrsId): mudar o nome
// não muda o papel. Cada defeito da folha tem aqui pelo menos um assert, que
// falhava antes. Lógica pura sobre o db, sem browser.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
beforeEach(() => limpar(app));
afterEach(() => repor(app));

/* Um contrato de habitação (C1) e um não habitacional (C2) no mesmo imóvel.
   Devolve: nada — escreve em app.db. */
function contratos() {
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2', ownerIds: ['O1'] })];
  app.db.contracts = [
    app.normContract({ id: 'C1', propertyId: 'P1', rent: 800, start: '2025-01-01', end: '2030-12-31', fisco: { finalidade: 'hp' } }),
    app.normContract({ id: 'C2', propertyId: 'P1', rent: 1500, start: '2025-01-01', end: '2030-12-31', fisco: { finalidade: 'nh' } }),
  ];
}

/* Uma receita de 2026 no imóvel P1.
   Recebe: category, sub — a categoria e a subcategoria; extra (opcional) — outros campos.
   Devolve: o movimento normalizado. */
const receita = (category, sub, extra) =>
  app.normTx(Object.assign({ kind: 'income', amount: 100, date: '2026-03-01', propertyId: 'P1', category, sub }, extra || {}));
/* Uma despesa de 2026 no imóvel P1.
   Recebe: category, sub; extra (opcional).
   Devolve: o movimento normalizado. */
const despesa = (category, sub, extra) =>
  app.normTx(Object.assign({ kind: 'expense', amount: 100, date: '2026-03-01', propertyId: 'P1', category, sub }, extra || {}));
/* o papel de uma receita, como objeto simples (atravessa o contexto isolado) */
const papel = (t) => JSON.parse(JSON.stringify(app.irsReceitaDe(t)));
const col = (t) => JSON.parse(JSON.stringify(app.irsColunaDe(t)));
/* exclui dos totais uma categoria (ou a subcategoria) de uma árvore */
const excluir = (tk, cat, sub) => { app.db.settings.exclude[app.excKey(tk, cat, sub)] = true; };

describe('irsReceitaDe · a tabela da §1.5, linha a linha', () => {
  beforeEach(() => contratos());

  test('Rendas › Renda mensal, Renda em atraso, sem subcategoria ou uma da pessoa: renda, com a natureza da linha', () => {
    app.db.settings.catsIn['Rendas'].push('Renda da garagem');
    for (const sub of ['Renda mensal', 'Renda em atraso', '', 'Renda da garagem']) {
      igual(papel(receita('Rendas', sub, { contractId: 'C1' })), { papel: 'renda', natureza: '07' }, 'habitação: ' + sub);
      igual(papel(receita('Rendas', sub, { contractId: 'C2' })), { papel: 'renda', natureza: '06' }, 'não habitacional: ' + sub);
    }
    igual(papel(receita('Rendas', 'Renda mensal')), { papel: 'renda', natureza: null }, 'sem contrato não há linha: vai às rendas sem contrato');
  });

  test('D03 · Rendas › Caução: caucao, renda do ano em que se recebe, com a natureza da linha (mesmo sendo passivo nos totais)', () => {
    const t = receita('Rendas', 'Caução', { contractId: 'C1' });
    assert.equal(app.countsInTotals(t), false, 'nos totais continua passivo (isPassivo não muda)');
    assert.equal(app.ehRenda(t), false, 'e o ehRenda, fora da Declaração, também não muda');
    igual(papel(t), { papel: 'caucao', natureza: '07' });
    igual(papel(receita('Rendas', 'Caução', { contractId: 'C2' })), { papel: 'caucao', natureza: '06' });
  });

  test('D21 · Rendas › Indemnização: indemnizacao, natureza 05 da versão do ano', () => {
    igual(papel(receita('Rendas', 'Indemnização', { contractId: 'C1' })), { papel: 'indemnizacao', natureza: '05' });
    igual(papel(receita('Rendas', 'Indemnização', { contractId: 'C1', date: '2025-06-01' })), { papel: 'indemnizacao', natureza: '05' });
  });

  test('D51 · Rendas › Outras receitas prediais: outra, natureza 02', () => {
    igual(papel(receita('Rendas', 'Outras receitas prediais', { contractId: 'C1' })), { papel: 'outra', natureza: '02' });
    igual(papel(receita('Rendas', 'Outras receitas prediais')), { papel: 'outra', natureza: '02' }, 'sem contrato também');
  });

  test('D20 · Reembolsos › Inquilino, e › Condomínio com contrato: renda (art. 8.º n.º 2 a)), com a natureza da linha', () => {
    igual(papel(receita('Reembolsos', 'Inquilino', { contractId: 'C1' })), { papel: 'renda', natureza: '07' });
    igual(papel(receita('Reembolsos', 'Inquilino')), { papel: 'renda', natureza: null }, 'sem contrato: renda sem contrato');
    igual(papel(receita('Reembolsos', 'Condomínio', { contractId: 'C2' })), { papel: 'renda', natureza: '06' });
  });

  test('D20 + Q7 · Reembolsos › Condomínio sem contrato e › Seguro: reembolsoGasto (abate ao gasto), sem pedir o contrato', () => {
    igual(papel(receita('Reembolsos', 'Condomínio')), { papel: 'reembolsoGasto', natureza: null });
    igual(papel(receita('Reembolsos', 'Seguro')), { papel: 'reembolsoGasto', natureza: null });
    igual(papel(receita('Reembolsos', 'Seguro', { contractId: 'C1' })), { papel: 'reembolsoGasto', natureza: null }, 'o seguro, mesmo ligado ao contrato');
  });

  test('D20 · Reembolsos › Estado e Empréstimos recebidos: fora (o Estado não é tratado como os outros reembolsos)', () => {
    igual(papel(receita('Reembolsos', 'Estado')), { papel: 'fora', natureza: null });
    igual(papel(receita('Reembolsos', 'Estado', { contractId: 'C1' })), { papel: 'fora', natureza: null });
    igual(papel(receita('Empréstimos recebidos', 'Família')), { papel: 'fora', natureza: null });
    igual(papel(receita('Empréstimos recebidos', 'Outro', { contractId: 'C1' })), { papel: 'fora', natureza: null });
  });

  test('sem categoria: renda com contrato (como hoje), por classificar sem ele', () => {
    igual(papel(receita('', '', { contractId: 'C1' })), { papel: 'renda', natureza: '07' });
    igual(papel(receita('', '')), { papel: 'porClassificar', natureza: null });
  });

  test('D05/D51 · Outras receitas, Subsídios e apoios e as categorias da pessoa: por classificar, com ou sem contrato', () => {
    app.db.settings.catsIn['Publicidade'] = ['Painel'];
    for (const [c, s] of [['Outras receitas', ''], ['Subsídios e apoios', ''], ['Publicidade', 'Painel']]) {
      igual(papel(receita(c, s)), { papel: 'porClassificar', natureza: null }, c);
      igual(papel(receita(c, s, { contractId: 'C1' })), { papel: 'porClassificar', natureza: null }, c + ' com contrato');
    }
    // dentro dos Reembolsos, sem subcategoria ou uma da pessoa: também
    app.db.settings.catsIn['Reembolsos'].push('Vizinho');
    igual(papel(receita('Reembolsos', '')), { papel: 'porClassificar', natureza: null });
    igual(papel(receita('Reembolsos', 'Vizinho', { contractId: 'C1' })), { papel: 'porClassificar', natureza: null });
  });

  test('uma despesa, uma prestação ou nada não são receitas', () => {
    igual(papel(despesa('Rendas', '')), { papel: '', natureza: null });
    igual(papel(app.normTx({ kind: 'loan', amount: 500 })), { papel: '', natureza: null });
    igual(papel(null), { papel: '', natureza: null });
  });
});

describe('irsReceitaDe · as categorias pelo identificador, e o «Fora dos totais» só dentro das Rendas', () => {
  beforeEach(() => contratos());

  test('D19 · renomear «Rendas» e «Caução»: o id segue o nome, e o papel não muda', () => {
    const st = app.db.settings;
    st.catsIn = { 'Arrendamento': ['Renda mensal', 'Depósito', 'Caução', 'Indemnização'], 'Reembolsos': ['Inquilino'] };
    st.catIds.catsIn = { 'Arrendamento': 'rendas', 'Arrendamento / Renda mensal': 'rendas/renda-mensal',
      'Arrendamento / Depósito': 'rendas/caucao', 'Arrendamento / Indemnização': 'rendas/indemnizacao',
      'Reembolsos': 'reembolsos', 'Reembolsos / Inquilino': 'reembolsos/inquilino' };
    igual(papel(receita('Arrendamento', 'Renda mensal', { contractId: 'C1' })), { papel: 'renda', natureza: '07' });
    igual(papel(receita('Arrendamento', 'Depósito', { contractId: 'C1' })), { papel: 'caucao', natureza: '07' }, 'a caução com outro nome');
    // uma subcategoria nova da pessoa que se chama «Caução» não é a caução: o id ficou com a «Depósito»
    igual(papel(receita('Arrendamento', 'Caução', { contractId: 'C1' })), { papel: 'renda', natureza: '07' });
    igual(papel(receita('Arrendamento', 'Indemnização', { contractId: 'C1' })), { papel: 'indemnizacao', natureza: '05' });
    // e o nome antigo, sem id, já não é das Rendas
    st.catsIn['Rendas'] = ['Renda mensal'];
    igual(papel(receita('Rendas', 'Renda mensal', { contractId: 'C1' })), { papel: 'porClassificar', natureza: null });
  });

  test('D19 · uma categoria renomeada antes da migração fica sem id: por classificar, não se adivinha', () => {
    const st = app.db.settings;
    st.catsIn['Arrendamento'] = ['Renda mensal'];
    delete st.catsIn['Rendas'];
    st.catIds.catsIn = Object.fromEntries(Object.entries(app.db.settings.catIds.catsIn).filter(([k]) => !k.startsWith('Rendas')));
    igual(papel(receita('Arrendamento', 'Renda mensal', { contractId: 'C1' })), { papel: 'porClassificar', natureza: null });
  });

  test('D19 · o «Fora dos totais» dentro das Rendas não tira nada do Anexo F', () => {
    excluir('catsIn', 'Rendas', 'Renda em atraso');
    const t = receita('Rendas', 'Renda em atraso', { contractId: 'C1' });
    assert.equal(app.countsInTotals(t), false);
    igual(papel(t), { papel: 'renda', natureza: '07' });
    excluir('catsIn', 'Rendas');
    igual(papel(receita('Rendas', 'Renda mensal', { contractId: 'C1' })), { papel: 'renda', natureza: '07' }, 'nem a categoria inteira');
    igual(papel(receita('Rendas', 'Indemnização', { contractId: 'C1' })), { papel: 'indemnizacao', natureza: '05' });
  });

  test('fora das Rendas o countsInTotals vale: fora dos totais é fora; uma «Caução» noutra categoria é passivo', () => {
    excluir('catsIn', 'Outras receitas');
    igual(papel(receita('Outras receitas', '', { contractId: 'C1' })), { papel: 'fora', natureza: null });
    excluir('catsIn', 'Reembolsos', 'Inquilino');
    igual(papel(receita('Reembolsos', 'Inquilino', { contractId: 'C1' })), { papel: 'fora', natureza: null });
    app.db.settings.catsIn['Garagem'] = ['Caução'];
    igual(papel(receita('Garagem', 'Caução', { contractId: 'C1' })), { papel: 'fora', natureza: null }, 'o isPassivo pelo nome, fora das Rendas');
  });
});

describe('irsColunaDe · o AIMI fixo, a omissão a confirmar e as colunas da §1.5', () => {
  test('D66 · um AIMI com a coluna escolhida à mão, ou com o mapa mudado, é sempre «não dedutível» (origem lei)', () => {
    igual(col(despesa('Impostos', 'AIMI', { irsCol: 'outros' })), { col: 'nao', origem: 'lei' });
    app.db.settings.irsMapa['Impostos / AIMI'] = 'outros';
    igual(col(despesa('Impostos', 'AIMI')), { col: 'nao', origem: 'lei' });
    excluir('cats', 'Impostos', 'AIMI');
    igual(col(despesa('Impostos', 'AIMI')), { col: 'nao', origem: 'lei' });
  });

  test('D66 · só o AIMI: no mobiliário e nos eletrodomésticos a escolha do movimento manda', () => {
    igual(col(despesa('Mobiliário e equipamento', 'Mobiliário', { irsCol: 'conservacao' })), { col: 'conservacao', origem: 'movimento' });
    igual(col(despesa('Manutenção e reparações', 'Eletrodomésticos', { irsCol: 'conservacao' })), { col: 'conservacao', origem: 'movimento' });
  });

  test('D66 · o AIMI pelo id: renomeado continua fixo; um «AIMI» da pessoa noutra categoria não', () => {
    const st = app.db.settings;
    st.cats['Taxas e impostos'] = ['Adicional ao IMI'];
    st.catIds.cats['Taxas e impostos'] = 'impostos';
    st.catIds.cats['Taxas e impostos / Adicional ao IMI'] = 'impostos/aimi';
    delete st.catIds.cats['Impostos / AIMI'];
    igual(col(despesa('Taxas e impostos', 'Adicional ao IMI', { irsCol: 'outros' })), { col: 'nao', origem: 'lei' });
    st.cats['Casa'] = ['AIMI'];
    igual(col(despesa('Casa', 'AIMI', { irsCol: 'outros' })), { col: 'outros', origem: 'movimento' });
  });

  test('D61 · sem regra fica a confirmar (não conta), e a categoria «Outros» também', () => {
    igual(col(despesa('Viagens', '')), { col: 'confirmar', origem: 'omissao' });
    igual(col(despesa('', '')), { col: 'confirmar', origem: 'omissao' });
    igual(col(despesa('Outros', '')), { col: 'confirmar', origem: 'categoria' });
    // um valor do mapa que não é coluna nenhuma (um mapa por normalizar) não decide nada
    app.db.settings.irsMapa['Viagens'] = 'lixo';
    igual(col(despesa('Viagens', '')), { col: 'confirmar', origem: 'omissao' });
    igual(col(despesa('constructor', '')), { col: 'confirmar', origem: 'omissao' }, 'um nome que um objeto herda');
    // o irsCol de um movimento continua a ser só uma coluna do Anexo F
    igual(col(despesa('Outros', '', { irsCol: 'confirmar' })), { col: 'confirmar', origem: 'categoria' });
  });

  test('D06, D07, D24–D27, D60 · as colunas da tabela da §1.5, pela subcategoria ou pela categoria', () => {
    const casos = [
      ['Impostos', '', 'confirmar', 'categoria'], ['Impostos', 'Outro imposto', 'confirmar', 'sub'],
      ['Impostos', 'IMT', 'nao', 'sub'], ['Impostos', 'Imposto do selo da compra', 'nao', 'sub'],
      ['Impostos', 'Taxas municipais', 'taxas', 'sub'], ['Impostos', 'IMI', 'imi', 'sub'], ['Impostos', 'Imposto do selo', 'selo', 'sub'],
      ['Condomínio', 'Fundo de reserva', 'nao', 'sub'], ['Condomínio', 'Quota extraordinária', 'confirmar', 'sub'],
      ['Condomínio', 'Quota mensal', 'condominio', 'categoria'],
      ['Seguros', '', 'confirmar', 'categoria'], ['Seguros', 'Multirriscos', 'nao', 'sub'],
      ['Seguros', 'Responsabilidade civil', 'nao', 'sub'], ['Seguros', 'Renda garantida', 'outros', 'sub'],
      ['Manutenção e reparações', 'Eletrodomésticos', 'nao', 'sub'], ['Manutenção e reparações', 'Caldeira / AVAC', 'confirmar', 'sub'],
      ['Água, luz e gás', 'Água', 'confirmar', 'categoria'],
      ['Serviços profissionais', 'Contabilidade', 'confirmar', 'categoria'], ['Serviços profissionais', 'Advogado', 'confirmar', 'categoria'],
      ['Serviços profissionais', 'Certificado energético', 'outros', 'sub'], ['Serviços profissionais', 'Notário e registos', 'nao', 'sub'],
      ['Serviços profissionais', 'Avaliação', 'nao', 'sub'],
      ['Devoluções ao inquilino', '', 'confirmar', 'categoria'], ['Devoluções ao inquilino', 'Devolução da caução', 'outros', 'sub'],
      ['Devoluções ao inquilino', 'Devolução de renda', 'nao', 'sub'],
    ];
    for (const [c, s, esperada, origem] of casos) igual(col(despesa(c, s)), { col: esperada, origem }, c + ' › ' + s);
  });

  test('D19 · o «Fora dos totais» não tira do Anexo F o IMI, o selo nem as Devoluções; nas outras tira', () => {
    excluir('cats', 'Impostos');
    igual(col(despesa('Impostos', 'IMI')), { col: 'imi', origem: 'sub' });
    igual(col(despesa('Impostos', 'Imposto do selo')), { col: 'selo', origem: 'sub' });
    igual(col(despesa('Impostos', 'Taxas municipais')), { col: 'nao', origem: 'excluido' });
    excluir('cats', 'Devoluções ao inquilino');
    igual(col(despesa('Devoluções ao inquilino', 'Devolução da caução')), { col: 'outros', origem: 'sub' });
    excluir('cats', 'Condomínio');
    igual(col(despesa('Condomínio', 'Quota mensal')), { col: 'nao', origem: 'excluido' });
  });

  test('o rótulo da coluna «a confirmar»', () => {
    assert.equal(app.irsColunaNome('confirmar'), 'A confirmar');
    assert.equal(app.irsColunaNome(app.irsColunaDe(despesa('Outros', '')).col), 'A confirmar');
    assert.equal(app.irsColunaNome('nao'), 'Não dedutível');
  });
});

describe('irsDevolucaoDeRenda · D53', () => {
  test('só a despesa «Devoluções ao inquilino › Devolução de renda», pelo id, mesmo fora dos totais', () => {
    assert.equal(app.irsDevolucaoDeRenda(despesa('Devoluções ao inquilino', 'Devolução de renda')), true);
    assert.equal(app.irsDevolucaoDeRenda(despesa('Devoluções ao inquilino', 'Devolução da caução')), false);
    assert.equal(app.irsDevolucaoDeRenda(despesa('Devoluções ao inquilino', '')), false);
    assert.equal(app.irsDevolucaoDeRenda(receita('Devoluções ao inquilino', 'Devolução de renda')), false, 'uma receita não');
    assert.equal(app.irsDevolucaoDeRenda(null), false);
    excluir('cats', 'Devoluções ao inquilino');
    assert.equal(app.irsDevolucaoDeRenda(despesa('Devoluções ao inquilino', 'Devolução de renda')), true);
    // renomeada, o id segue-a
    const st = app.db.settings;
    st.cats['Devoluções ao inquilino'] = ['Renda devolvida'];
    st.catIds.cats['Devoluções ao inquilino / Renda devolvida'] = 'devolucoes/renda';
    delete st.catIds.cats['Devoluções ao inquilino / Devolução de renda'];
    assert.equal(app.irsDevolucaoDeRenda(despesa('Devoluções ao inquilino', 'Renda devolvida')), true);
    assert.equal(app.irsDevolucaoDeRenda(despesa('Devoluções ao inquilino', 'Devolução de renda')), false);
  });
});

describe('o NIF · D59 (o 45) e D47/D58 (a pessoa coletiva)', () => {
  test('D59 · o 45 dos não residentes passa com o dígito de controlo; o resto do 4 não', () => {
    assert.equal(app.nifValido('450000001'), true);
    assert.equal(app.nifValido('450000002'), false, 'o dígito de controlo continua a contar');
    assert.equal(app.nifValido('400000008'), false, 'o 40 não existe');
    assert.equal(app.nifValido('460000004'), false);
  });

  test('D47/D58 · pessoa coletiva pelo primeiro dígito: 5, 6, 7 e 9; nunca 1, 2, 3, 45 nem 8', () => {
    for (const n of ['500000000', '600000079', '700000000', '710000000', '900000000', '980000000', ' 500 000 000 ', 500000000]) {
      assert.equal(app.nifColetivo(n), true, String(n));
    }
    for (const n of ['123456789', '210000007', '300000000', '450000001', '800000000', '', null, '50000000', 'X1234567L']) {
      assert.equal(app.nifColetivo(n), false, String(n));
    }
  });
});

describe('irsSituacao · a situação de cada ano (D30, D71, D91)', () => {
  beforeEach(() => {
    app.db.owners = ['ana', 'bruno', 'carla', 'rui'].map((id) => app.normPerson({ id, name: id }));
  });
  /* a situação como objeto simples */
  const sit = (ano, eu) => JSON.parse(JSON.stringify(app.irsSituacao(ano, eu)));

  test('sem nada guardado: separada, eu A, sem cônjuge', () => {
    igual(sit(2026, 'ana'), { conjunta: false, conjugeId: '', minhaLetra: 'A', letraConjuge: '', dispensaRecibos: false,
      aimi: { total: null, valorTributavel: null }, deAno: '' });
    delete app.db.settings.irs;
    assert.equal(sit(2026, 'ana').conjunta, false, 'um settings sem o bloco irs não rebenta');
  });

  test('D30 · nos campos antigos, o cônjuge é o único outro marcado B quando eu sou A', () => {
    app.db.settings.irs = { conjunta: true, titulares: { bruno: 'B' }, dispensaRecibos: true };
    igual(sit(2026, 'ana'), { conjunta: true, conjugeId: 'bruno', minhaLetra: 'A', letraConjuge: 'B', dispensaRecibos: true,
      aimi: { total: null, valorTributavel: null }, deAno: '' });
  });

  test('D30 · quem se marcou B: o cônjuge não se adivinha', () => {
    app.db.settings.irs = { conjunta: true, titulares: { ana: 'B' } };
    const s = sit(2026, 'ana');
    assert.equal(s.minhaLetra, 'B');
    assert.equal(s.conjugeId, '', 'o Bruno (A por omissão) não passa a cônjuge às escondidas');
    assert.equal(s.letraConjuge, '');
    app.db.settings.irs = { conjunta: true, titulares: { ana: 'B', bruno: 'B' } };
    assert.equal(sit(2026, 'ana').conjugeId, '', 'nem com outro também marcado B');
  });

  test('D30 · dois outros marcados B, ou sem saber quem sou: sem cônjuge', () => {
    app.db.settings.irs = { conjunta: true, titulares: { bruno: 'B', carla: 'B' } };
    assert.equal(sit(2026, 'ana').conjugeId, '');
    app.db.settings.irs = { conjunta: true, titulares: { bruno: 'B' } };
    assert.equal(sit(2026, '').conjugeId, '');
    assert.equal(sit(2026).conjugeId, '');
  });

  test('D30 · por ano, o cônjuge escolhido leva a outra letra, seja qual for a minha', () => {
    app.db.settings.irs = { porAno: { 2026: { conjunta: true, conjugeId: 'rui', minhaLetra: 'B' } } };
    app.fillCats(app.db.settings);
    const s = sit(2026, 'ana');
    assert.equal(s.conjugeId, 'rui');
    assert.equal(s.minhaLetra, 'B');
    assert.equal(s.letraConjuge, 'A', 'eu sou B no Rosto; o Rui é A e entra na mesma');
    app.db.settings.irs = { porAno: { 2026: { conjunta: true, conjugeId: 'ana' } } };
    assert.equal(sit(2026, 'ana').conjugeId, '', 'eu não sou o meu cônjuge');
  });

  test('D91 · cada ano tem a sua: ligar a conjunta em 2026 não refaz 2025; um ano sem entrada herda o anterior mais perto', () => {
    app.db.settings.irs = { conjunta: true, titulares: { rui: 'B' },
      porAno: { 2025: { conjunta: false }, 2026: { conjunta: true, conjugeId: 'rui', dispensaRecibos: true } } };
    app.fillCats(app.db.settings);
    const s25 = sit(2025, 'ana'), s26 = sit(2026, 'ana'), s28 = sit(2028, 'ana'), s24 = sit(2024, 'ana');
    assert.equal(s25.conjunta, false);
    assert.equal(s25.conjugeId, '');
    assert.equal(s25.deAno, '2025');
    assert.equal(s26.conjunta, true);
    assert.equal(s26.conjugeId, 'rui');
    assert.equal(s26.dispensaRecibos, true);
    assert.equal(s28.deAno, '2026', '2028 herda de 2026');
    assert.equal(s28.conjugeId, 'rui');
    // antes da primeira entrada, os campos de topo antigos
    assert.equal(s24.deAno, '');
    assert.equal(s24.conjunta, true);
    assert.equal(s24.conjugeId, 'rui');
  });

  test('D71 · os números da demonstração do AIMI são do próprio ano e nunca se herdam', () => {
    app.db.settings.irs = { porAno: { 2026: { conjunta: false, aimi: { total: 700, valorTributavel: '900000' } } } };
    app.fillCats(app.db.settings);
    igual(sit(2026, 'ana').aimi, { total: 700, valorTributavel: 900000 });
    igual(sit(2027, 'ana').aimi, { total: null, valorTributavel: null }, 'a liquidação de 2026 não é a de 2027');
    assert.equal(sit(2027, 'ana').deAno, '2026', 'o resto da situação herda-se');
  });
});
