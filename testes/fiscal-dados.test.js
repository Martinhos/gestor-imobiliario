// O modelo fiscal: os campos que o Anexo F e o Modelo 2 pedem, tal como a app
// os guarda e normaliza, e os auxiliares que dizem em que coluna cai um gasto,
// o que é renda, o estado de um contrato perante a AT, se um NIF bate certo e
// quando acaba «o mês seguinte». Tudo sem browser: é lógica pura sobre o db.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp();
beforeEach(() => limpar(app));
afterEach(() => repor(app));

describe('o imóvel guarda o que a AT pergunta', () => {
  test('omissões vazias, e o que vem torto é normalizado', () => {
    const p = app.normProp({});
    assert.equal(p.distrito, '');
    assert.equal(p.freguesiaCodigo, '');
    assert.equal(p.tipoPredio, '');
    assert.equal(p.tipologia, '');
    assert.equal(p.vpt, 0);
    assert.equal(p.purchaseDate, '');
    const q = app.normProp({ freguesiaCodigo: '11 06-23x9', tipoPredio: 'x', tipologia: 'grande', vpt: -5, purchaseDate: 'ontem', distrito: 'Lisboa' });
    assert.equal(q.freguesiaCodigo, '110623', 'só dígitos, no máximo seis');
    assert.equal(q.tipoPredio, '', 'só U ou R');
    assert.equal(q.tipologia, '');
    assert.equal(q.vpt, 0, 'nunca negativo');
    assert.equal(q.purchaseDate, '');
    assert.equal(q.distrito, 'Lisboa');
    const r = app.normProp({ tipoPredio: 'R', tipologia: 'T2', vpt: '85000', purchaseDate: '2019-04-20' });
    assert.equal(r.tipoPredio, 'R');
    assert.equal(r.tipologia, 'T2');
    assert.equal(r.vpt, 85000);
    assert.equal(r.purchaseDate, '2019-04-20');
  });
});

describe('a pessoa guarda o país e a retenção', () => {
  test('omissões, e o retem é sempre booleano', () => {
    const t = app.normPerson({});
    assert.equal(t.pais, '');
    assert.equal(t.retem, false);
    assert.equal(app.normPerson({ retem: 'sim', pais: 'Espanha' }).retem, true);
    assert.equal(app.normPerson({ retem: 'sim', pais: 'Espanha' }).pais, 'Espanha');
  });
});

describe('o bloco fiscal do contrato', () => {
  test('um contrato antigo ganha o bloco vazio: por indicar', () => {
    const c = app.normContract({ id: 'C', rent: 500 });
    igual(c.fisco, { estado: '', numero: '', finalidade: '', celebracao: '', renovavel: null, renovacoes: [], cessacaoMotivo: '' });
    assert.ok(app.ctFiscoPorIndicar(c));
    assert.ok(!app.ctDeclarado(c));
    assert.ok(!app.ctNaoDeclarado(c));
  });

  test('os três estados são os únicos que entram; o resto normaliza', () => {
    assert.equal(app.normFisco({ estado: 'talvez' }).estado, '');
    assert.equal(app.normFisco({ estado: 'naoDeclarado' }).estado, 'naoDeclarado');
    const f = app.normFisco({ estado: 'declarado', numero: ' 1234567 ', finalidade: 'hp', celebracao: '2025-08-25',
      renovavel: true, renovacoes: [{ inicio: '2026-09-01', fim: '2027-08-31' }], cessacaoMotivo: 'Acordo' });
    assert.equal(f.numero, '1234567', 'sem espaços à volta');
    assert.equal(f.finalidade, 'hp');
    assert.equal(f.renovavel, true);
    assert.ok(f.renovacoes[0].id, 'cada renovação ganha id');
    assert.equal(f.renovacoes[0].fim, '2027-08-31');
    assert.equal(app.normFisco({ finalidade: 'comercio' }).finalidade, '');
    assert.equal(app.normFisco({ celebracao: '25/08/2025' }).celebracao, '', 'só ISO');
    assert.equal(app.normFisco({ renovavel: 'sim' }).renovavel, null, 'só true, false ou não se sabe');
    assert.equal(app.normFisco({ renovacoes: 'não é lista' }).renovacoes.length, 0);
  });

  test('fiscoDe devolve o próprio bloco quando existe, e um vazio quando não', () => {
    const c = app.normContract({ fisco: { estado: 'declarado' } });
    assert.equal(app.fiscoDe(c), c.fisco);
    assert.equal(app.fiscoDe(null).estado, '');
    assert.equal(app.fiscoDe({}).estado, '');
    assert.ok(app.ctDeclarado(c));
    assert.ok(app.ctNaoDeclarado(app.normContract({ fisco: { estado: 'naoDeclarado' } })));
  });

  test('a natureza do rendimento sai da finalidade', () => {
    assert.equal(app.naturezaIrs(app.normContract({ fisco: { finalidade: 'nh' } })), '06');
    assert.equal(app.naturezaIrs(app.normContract({ fisco: { finalidade: 'hp' } })), '07');
    assert.equal(app.naturezaIrs(app.normContract({})), '07', 'sem finalidade assume-se habitação');
  });
});

describe('o movimento guarda retenção, mês, recibo e coluna', () => {
  test('omissões e normalização', () => {
    const t = app.normTx({});
    assert.equal(t.retencao, 0);
    assert.equal(t.periodo, '');
    assert.equal(t.recibo, false);
    assert.equal(t.irsCol, '');
    const u = app.normTx({ retencao: '-3', periodo: '2026/09', recibo: 1, irsCol: 'inventada' });
    assert.equal(u.retencao, 0);
    assert.equal(u.periodo, '', 'só AAAA-MM');
    assert.equal(u.recibo, true);
    assert.equal(u.irsCol, '', 'só ids de IRS_COLUNAS');
    const v = app.normTx({ retencao: 250, periodo: '2026-09', irsCol: 'obras24' });
    assert.equal(v.retencao, 250);
    assert.equal(v.periodo, '2026-09');
    assert.equal(v.irsCol, 'obras24');
  });

  test('um modelo repete a retenção e a coluna, mas não o mês nem o recibo', () => {
    assert.ok(app.TX_TPL_KEYS.includes('retencao'));
    assert.ok(app.TX_TPL_KEYS.includes('irsCol'));
    assert.ok(!app.TX_TPL_KEYS.includes('periodo'));
    assert.ok(!app.TX_TPL_KEYS.includes('recibo'));
    const s = app.txSnapshot(app.normTx({ kind: 'income', retencao: 100, periodo: '2026-01', recibo: true, irsCol: '' }));
    assert.equal(s.retencao, 100);
    assert.equal(s.periodo, undefined);
    assert.equal(s.recibo, undefined);
  });

  test('a renda bruta é o que entrou mais o que foi retido', () => {
    assert.equal(app.rendaBruta(app.normTx({ kind: 'income', amount: 800, retencao: 200 })), 1000);
    assert.equal(app.rendaBruta(app.normTx({ kind: 'income', amount: 800 })), 800);
  });
});

describe('o mapa categoria → coluna do Anexo F', () => {
  test('a base nova traz o mapa de origem, e uma base antiga ganha-o sem perder o que mudou', () => {
    const origem = JSON.parse(JSON.stringify(app.IRS_MAPA0));   // atravessa o contexto isolado
    igual(app.blank.settings.irsMapa, origem);
    const st = { cats: { X: [] }, catsIn: { Y: [] }, irsMapa: { 'Condomínio': 'nao', 'Minha': 'imi' } };
    app.fillCats(st);
    assert.equal(st.irsMapa['Condomínio'], 'nao', 'a escolha da pessoa fica');
    assert.equal(st.irsMapa['Minha'], 'imi');
    assert.equal(st.irsMapa['Impostos / IMI'], 'imi', 'as regras de origem que faltavam entram');
    const st2 = { cats: {}, catsIn: {} };
    app.fillCats(st2);
    igual(st2.irsMapa, origem);
  });

  test('a lei manda no mapa de origem: juros, mobiliário e AIMI não entram; IMI e selo têm coluna própria', () => {
    const m = app.IRS_MAPA0;
    assert.equal(m['Impostos / IMI'], 'imi');
    assert.equal(m['Impostos / Imposto do selo'], 'selo');
    assert.equal(m['Impostos / AIMI'], 'nao');
    assert.equal(m['Mobiliário e equipamento'], 'nao');
    assert.equal(m['Custos bancários'], 'nao');
    assert.equal(m['Seguros / Vida (crédito)'], 'nao');
    assert.equal(m['Condomínio'], 'condominio');
    assert.equal(m['Manutenção e reparações'], 'conservacao');
    assert.equal(m['Obras e benfeitorias / Cozinha'], 'nao', 'beneficiação não é conservação');
    Object.values(m).forEach((col) => assert.ok(app.IRS_COLUNAS.some((c) => c[0] === col), col + ' é uma coluna que existe'));
  });

  test('a coluna de um movimento: tipo, exclusão, escolha própria, subcategoria, categoria, omissão', () => {
    const d = app.irsColunaDe;
    igual(d(app.normTx({ kind: 'loan', amount: 500 })), { col: 'nao', origem: 'tipo' });
    igual(d(app.normTx({ kind: 'income', category: 'Rendas' })), { col: 'nao', origem: 'tipo' });
    igual(d(app.normTx({ kind: 'expense', category: 'Impostos', sub: 'IMI' })), { col: 'imi', origem: 'sub' });
    igual(d(app.normTx({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal' })), { col: 'condominio', origem: 'categoria' });
    igual(d(app.normTx({ kind: 'expense', category: 'Mobiliário e equipamento' })), { col: 'nao', origem: 'categoria' });
    igual(d(app.normTx({ kind: 'expense', category: 'Categoria da Ana' })), { col: 'outros', origem: 'omissao' });
    igual(d(app.normTx({ kind: 'expense', category: '' })), { col: 'outros', origem: 'omissao' });
    igual(d(app.normTx({ kind: 'expense', category: 'Mobiliário e equipamento', irsCol: 'obras24' })), { col: 'obras24', origem: 'movimento' });
    app.db.settings.exclude[app.excKey('cats', 'Condomínio')] = true;
    igual(d(app.normTx({ kind: 'expense', category: 'Condomínio' })), { col: 'nao', origem: 'excluido' }, 'fora dos totais é fora do IRS');
    app.db.settings.irsMapa['Categoria da Ana'] = 'taxas';
    igual(d(app.normTx({ kind: 'expense', category: 'Categoria da Ana' })), { col: 'taxas', origem: 'categoria' }, 'o mapa das definições manda');
  });

  test('o rótulo da coluna', () => {
    assert.equal(app.irsColunaNome('imi'), 'IMI');
    assert.equal(app.irsColunaNome('obras24'), 'Obras antes do arrendamento (24 meses)');
    assert.equal(app.irsColunaNome('x'), '');
  });
});

describe('o que é renda', () => {
  test('rendas sim; caução, empréstimos, reembolsos e despesas não', () => {
    assert.ok(app.ehRenda(app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 500 })));
    assert.ok(app.ehRenda(app.normTx({ kind: 'income', contractId: 'C1', amount: 500 })), 'sem categoria mas presa a um contrato');
    assert.ok(!app.ehRenda(app.normTx({ kind: 'income', amount: 500 })), 'sem categoria e sem contrato não se sabe o que é');
    assert.ok(!app.ehRenda(app.normTx({ kind: 'income', category: 'Rendas', sub: 'Caução', amount: 500 })), 'a caução devolve-se');
    assert.ok(!app.ehRenda(app.normTx({ kind: 'income', category: 'Empréstimos recebidos', contractId: 'C1' })));
    assert.ok(!app.ehRenda(app.normTx({ kind: 'income', category: 'Reembolsos', sub: 'Inquilino' })));
    assert.ok(!app.ehRenda(app.normTx({ kind: 'expense', category: 'Rendas' })));
    assert.ok(!app.ehRenda(null));
  });
});

describe('o NIF', () => {
  test('vazio não se julga; válido, inválido e mal formado', () => {
    assert.equal(app.nifValido(''), null);
    assert.equal(app.nifValido(null), null);
    assert.equal(app.nifValido('123456789'), true, 'o exemplo clássico bate certo');
    assert.equal(app.nifValido(' 123 456 789 '), true, 'espaços não contam');
    assert.equal(app.nifValido('123456780'), false, 'dígito de controlo errado');
    assert.equal(app.nifValido('023456789'), false, 'nenhum NIF começa por 0 ou 4');
    assert.equal(app.nifValido('12345678'), false, 'faltam dígitos');
    assert.equal(app.nifValido('210000007'), true);
    assert.equal(app.nifValido(123456789), true, 'aceita número');
  });
});

describe('o fim do mês seguinte', () => {
  test('meses normais, fim de ano e fevereiro bissexto', () => {
    assert.equal(app.fimDoMesSeguinte('2026-01-15'), '2026-02-28');
    assert.equal(app.fimDoMesSeguinte('2027-01-31'), '2027-02-28');
    assert.equal(app.fimDoMesSeguinte('2028-01-10'), '2028-02-29');
    assert.equal(app.fimDoMesSeguinte('2026-12-05'), '2027-01-31');
    assert.equal(app.fimDoMesSeguinte('2026-09-01'), '2026-10-31');
    assert.equal(app.fimDoMesSeguinte(''), '');
    assert.equal(app.fimDoMesSeguinte('sem data'), '');
  });
});
