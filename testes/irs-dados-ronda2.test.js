// Os campos da ronda 2 do IRS no modelo de dados (KAN-128, folha 2.3.7): o que
// o imóvel, o contrato, o movimento e as definições passam a guardar para os
// quadros raros (6A, 6B, 6C, 4.3), o imóvel no estrangeiro (Anexo J), as rendas
// na categoria B, a renda paga só em parte, a reimportação do Splitwise, o
// código da freguesia com letras, os encargos que o contrato põe a cargo do
// inquilino e a subcategoria que segue a coluna da categoria. Cada campo com a
// forma certa e com lixo: um cliente antigo que o mande mal formado não
// rebenta. Lógica pura sobre o db.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
beforeEach(() => limpar(app));
afterEach(() => repor(app));

/* Um JSON que atravessa o contexto isolado (os objetos da vm têm outro protótipo). */
const copia = (o) => JSON.parse(JSON.stringify(o));

describe('D136 · o código da freguesia guarda as letras da AT', () => {
  test('em maiúsculas, só algarismos e letras, cortado a seis', () => {
    assert.equal(app.normProp({ freguesiaCodigo: '0302fe' }).freguesiaCodigo, '0302FE');
    assert.equal(app.normProp({ freguesiaCodigo: '0302FI' }).freguesiaCodigo, '0302FI');
    assert.equal(app.normProp({ freguesiaCodigo: '0308fa' }).freguesiaCodigo, '0308FA');
    assert.equal(app.normProp({ freguesiaCodigo: ' 03 02-fe ' }).freguesiaCodigo, '0302FE', 'espaços e traços saem');
    assert.equal(app.normProp({ freguesiaCodigo: '0302FEX9' }).freguesiaCodigo, '0302FE', 'no máximo seis');
    assert.equal(app.normProp({ freguesiaCodigo: '110623' }).freguesiaCodigo, '110623', 'os de algarismos ficam');
  });

  test('o que já veio cortado fica como está (a falta de formato pede-o de novo); lixo não rebenta', () => {
    assert.equal(app.normProp({ freguesiaCodigo: '0302' }).freguesiaCodigo, '0302');
    assert.equal(app.normProp({ freguesiaCodigo: 30214 }).freguesiaCodigo, '30214');
    assert.equal(app.normProp({ freguesiaCodigo: { a: 1 } }).freguesiaCodigo, '');
    assert.equal(app.normProp({ freguesiaCodigo: null }).freguesiaCodigo, '');
    assert.equal(app.normProp({ freguesiaCodigo: 'çãé-ºª' }).freguesiaCodigo, '', 'acentos e símbolos saem');
    const p = app.normProp({ freguesiaCodigo: '0302fe' });
    assert.equal(app.normProp(copia(p)).freguesiaCodigo, '0302FE', 'idempotente');
  });
});

describe('D117 · o imóvel reabilitado (quadro 6A)', () => {
  test('a omissão: não reabilitado', () => {
    igual(app.normProp({}).reabilitacao, { tipo: '', inicio: '', conclusao: '', certificado: false });
  });

  test('ARU ou NRAU, as datas da reabilitação e o certificado da câmara', () => {
    const r = app.normProp({ reabilitacao: { tipo: 'aru', inicio: '2017-03-01', conclusao: '2018-06-30', certificado: true } }).reabilitacao;
    igual(r, { tipo: 'aru', inicio: '2017-03-01', conclusao: '2018-06-30', certificado: true });
    assert.equal(app.normProp({ reabilitacao: { tipo: 'nrau' } }).reabilitacao.tipo, 'nrau');
  });

  test('lixo volta à omissão, campo a campo', () => {
    for (const lixo of ['sim', 1, true, [], null, ['aru']]) {
      igual(app.normProp({ reabilitacao: lixo }).reabilitacao, { tipo: '', inicio: '', conclusao: '', certificado: false }, JSON.stringify(lixo));
    }
    const r = app.normProp({ reabilitacao: { tipo: 'ARU ', inicio: '2018-02-30', conclusao: '30/06/2018', certificado: 'true', extra: 1 } }).reabilitacao;
    igual(r, { tipo: '', inicio: '', conclusao: '', certificado: false }, 'só os valores da lista, datas que existem e true');
  });
});

describe('D121 · a Loja com História (quadro 6B)', () => {
  test('true ou false; o resto é false', () => {
    assert.equal(app.normProp({}).lojaComHistoria, false);
    assert.equal(app.normProp({ lojaComHistoria: true }).lojaComHistoria, true);
    for (const lixo of ['sim', 1, 'true', {}, null]) assert.equal(app.normProp({ lojaComHistoria: lixo }).lojaComHistoria, false, JSON.stringify(lixo));
  });
});

describe('D133 · o imóvel no estrangeiro: o país e o código da tabela X', () => {
  test('Portugal é o vazio, nos dois campos', () => {
    const p = app.normProp({});
    assert.equal(p.pais, '');
    assert.equal(p.paisCodigo, '');
    const pt = app.normProp({ pais: ' portugal ', paisCodigo: '620' });
    assert.equal(pt.pais, '', 'escrever Portugal é Portugal');
    assert.equal(pt.paisCodigo, '', 'e sem país não há código');
  });

  test('o nome do país (aparado) e o código de três algarismos', () => {
    const p = app.normProp({ pais: '  França ', paisCodigo: '250' });
    assert.equal(p.pais, 'França');
    assert.equal(p.paisCodigo, '250');
    assert.equal(app.normProp({ pais: 'Brasil', paisCodigo: 76 }).paisCodigo, '076', 'um número ganha os zeros da frente');
    assert.equal(app.normProp({ pais: 'Brasil', paisCodigo: ' 076 ' }).paisCodigo, '076');
  });

  test('lixo não rebenta: o país sem controlo e com limite; o código fora do formato sai', () => {
    assert.equal(app.normProp({ pais: { nome: 'França' } }).pais, '');
    assert.equal(app.normProp({ pais: 42 }).pais, '');
    assert.equal(app.normProp({ pais: 'Fran\u0000ça' }).pais, 'Fran ça');
    assert.equal(app.normProp({ pais: 'x'.repeat(200) }).pais.length, 60);
    assert.equal(app.normProp({ pais: 'Brasil', paisCodigo: '76' }).paisCodigo, '076', 'a tabela escreve-o sem os zeros (N105)');
    assert.equal(app.normProp({ pais: 'Bélgica', paisCodigo: ' 56 ' }).paisCodigo, '056');
    for (const lixo of ['FR', '0', '000', '2500', 'abc', '7 6', 1000, -1, 2.5, true, {}, []]) {
      assert.equal(app.normProp({ pais: 'França', paisCodigo: lixo }).paisCodigo, '', JSON.stringify(lixo));
    }
  });

  test('o imposto pago no estrangeiro, por ano (c.fisco.impostoEstrangeiro)', () => {
    igual(app.normFisco({}).impostoEstrangeiro, {});
    const f = app.normFisco({ impostoEstrangeiro: { 2025: 1200.456, '2026': '300', 25: 5, 2027: -1, 2028: true, 2029: '', 2030: 0, ano: 3 } });
    igual(f.impostoEstrangeiro, { 2025: 1200.46, 2026: 300, 2030: 0 });
    for (const lixo of ['1200', 5, [], null, true]) igual(app.normFisco({ impostoEstrangeiro: lixo }).impostoEstrangeiro, {}, JSON.stringify(lixo));
  });
});

describe('D135 · o dia em que o código e o artigo se conferiram na caderneta', () => {
  test('uma data que existe, ou vazio', () => {
    assert.equal(app.normProp({}).matrizConfirmada, '');
    assert.equal(app.normProp({ matrizConfirmada: '2026-03-01' }).matrizConfirmada, '2026-03-01');
    for (const lixo of ['2026-02-30', '01/03/2026', 20260301, true, {}, null]) {
      assert.equal(app.normProp({ matrizConfirmada: lixo }).matrizConfirmada, '', JSON.stringify(lixo));
    }
  });
});

describe('D120 · o direito real de habitação duradoura (quadro 4.3)', () => {
  test('a finalidade aceita o DHD, com o nome; o resto continua a sair', () => {
    assert.equal(app.normFisco({ finalidade: 'dhd' }).finalidade, 'dhd');
    const dhd = app.FISCO_FINALIDADES_TODAS.find((x) => x[0] === 'dhd');
    assert.ok(dhd, 'o DHD está na lista completa');
    assert.match(dhd[1], /habitação duradoura/i);
    for (const [id] of app.FISCO_FINALIDADES) assert.ok(app.FISCO_FINALIDADES_TODAS.some((x) => x[0] === id), id);
    assert.equal(app.normFisco({ finalidade: 'DHD' }).finalidade, '');
    assert.equal(app.normContract({ fisco: { finalidade: 'dhd' } }).fisco.finalidade, 'dhd');
  });
});

describe('D119 e D134 · o rústico arrendado a uma EGF e as rendas na categoria B', () => {
  test('true ou false; o resto é false', () => {
    const f = app.normFisco({});
    assert.equal(f.egf, false);
    assert.equal(f.categoriaB, false);
    assert.equal(app.normFisco({ egf: true }).egf, true);
    assert.equal(app.normFisco({ categoriaB: true }).categoriaB, true);
    for (const lixo of ['sim', 1, 'true', {}, null]) {
      assert.equal(app.normFisco({ egf: lixo }).egf, false, JSON.stringify(lixo));
      assert.equal(app.normFisco({ categoriaB: lixo }).categoriaB, false, JSON.stringify(lixo));
    }
  });

  test('a categoria B não é «não declarado»: o estado fica', () => {
    const f = app.normFisco({ estado: 'declarado', categoriaB: true });
    assert.equal(f.estado, 'declarado');
    assert.equal(f.categoriaB, true);
  });
});

describe('D115 · a renda paga só em parte (t.parcial)', () => {
  test('só numa receita, e só true', () => {
    assert.equal(app.normTx({ kind: 'income', amount: 550 }).parcial, false);
    assert.equal(app.normTx({ kind: 'income', amount: 550, parcial: true }).parcial, true);
    assert.equal(app.normTx({ kind: 'expense', amount: 550, parcial: true }).parcial, false, 'uma despesa não é renda');
    for (const lixo of ['sim', 1, 'true', {}, null]) assert.equal(app.normTx({ kind: 'income', parcial: lixo }).parcial, false, JSON.stringify(lixo));
  });

  test('não passa para os modelos nem para os planeados (é de um pagamento)', () => {
    assert.ok(!app.TX_TPL_KEYS.includes('parcial'));
    const r = app.normRec({ tx: { kind: 'income', amount: 550, parcial: true } });
    assert.equal(r.tx.parcial, undefined);
  });
});

describe('D127 · a chave da linha importada do Splitwise e as linhas apagadas de propósito', () => {
  test('swKey: o texto tal como veio, sem caracteres de controlo e com limite', () => {
    assert.equal(app.normTx({ kind: 'expense' }).swKey, '');
    const k = '2025-03-01|Condomínio|1200.00|Household supplies';
    assert.equal(app.normTx({ kind: 'expense', swKey: k }).swKey, k);
    assert.equal(app.normTx({ kind: 'expense', swKey: ' a ' }).swKey, ' a ', 'não se apara: é a chave da linha');
    assert.equal(app.normTx({ kind: 'expense', swKey: 'a\u0000b\nc' }).swKey, 'a b c');
    assert.equal(app.normTx({ kind: 'expense', swKey: 'x'.repeat(900) }).swKey.length, 500);
    for (const lixo of [5, true, {}, [], null]) assert.equal(app.normTx({ kind: 'expense', swKey: lixo }).swKey, '', JSON.stringify(lixo));
    assert.equal(app.normSwKey('x'.repeat(900)), app.normTx({ swKey: 'x'.repeat(900) }).swKey, 'quem compara chaves usa o mesmo normSwKey');
  });

  test('a chave não muda quando a pessoa edita o movimento (só a importação a escreve)', () => {
    const t = app.normTx({ id: 'T1', kind: 'expense', amount: 1200, label: 'Condomínio', swKey: 'k1' });
    const editado = app.normTx(Object.assign(copia(t), { label: 'Condomínio 2025 (quotas)', amount: 600 }));
    assert.equal(editado.swKey, 'k1');
    assert.ok(!app.TX_TPL_KEYS.includes('swKey'), 'um modelo não leva a chave');
  });

  test('settings.swIgnoradas: uma lista de chaves, sem repetidas nem vazias; lixo é lista vazia', () => {
    const st = { cats: { X: [] }, catsIn: { Y: [] }, swIgnoradas: ['k1', 'k2', 'k1', '', 7, null, { a: 1 }, 'k\u00003'] };
    app.fillCats(st);
    igual(st.swIgnoradas, ['k1', 'k2', 'k 3']);
    for (const lixo of ['k1', 5, {}, null, undefined]) {
      const s = { cats: { X: [] }, catsIn: { Y: [] }, swIgnoradas: lixo };
      app.fillCats(s);
      igual(s.swIgnoradas, [], JSON.stringify(lixo));
    }
    assert.ok(Array.isArray(app.db.settings.swIgnoradas), 'a base de cada conta tem a lista');
  });
});

describe('Q13 · os encargos a cargo do inquilino (c.encargosInquilino)', () => {
  test('a lista dos encargos, com ids e nomes', () => {
    igual(app.ENCARGOS_DO_INQUILINO, [{ id: 'condominio', nome: 'Condomínio' }, { id: 'imi', nome: 'IMI' },
      { id: 'seguro', nome: 'Seguro' }, { id: 'consumos', nome: 'Água, luz e gás' }]);
  });

  test('vazio por omissão; só ids conhecidos, sem repetidos, pela ordem da lista', () => {
    igual(app.normContract({ id: 'C' }).encargosInquilino, []);
    igual(app.normContract({ id: 'C', encargosInquilino: ['imi', 'condominio'] }).encargosInquilino, ['condominio', 'imi']);
    igual(app.normContract({ id: 'C', encargosInquilino: ['imi', 'xpto', 'imi', 3, null, 'consumos', 'IMI'] }).encargosInquilino, ['imi', 'consumos']);
    const c = app.normContract({ id: 'C', encargosInquilino: ['seguro', 'condominio'] });
    igual(app.normContract(copia(c)).encargosInquilino, ['condominio', 'seguro'], 'idempotente');
  });

  test('lixo é lista vazia', () => {
    for (const lixo of ['condominio', 5, true, { condominio: true }, null]) {
      igual(app.normContract({ id: 'C', encargosInquilino: lixo }).encargosInquilino, [], JSON.stringify(lixo));
    }
  });
});

describe('«Como a categoria» numa subcategoria com regra de origem fica gravado (IRS_MAPA_HERDA)', () => {
  test('o fillCats guarda o «herda» numa subcategoria, e a regra de origem não volta', () => {
    const st = { cats: copia(app.CATS0), catsIn: copia(app.CATS_IN0), irsMapa: { 'Seguros / Multirriscos': app.IRS_MAPA_HERDA } };
    app.fillCats(st);
    assert.equal(st.irsMapa['Seguros / Multirriscos'], app.IRS_MAPA_HERDA);
    app.fillCats(st);
    assert.equal(st.irsMapa['Seguros / Multirriscos'], app.IRS_MAPA_HERDA, 'e na leitura seguinte');
    assert.ok(!app.IRS_MAPA_VALORES.some((c) => c[0] === app.IRS_MAPA_HERDA), 'não é uma coluna');
  });

  test('a despesa da subcategoria segue a coluna da categoria', () => {
    const s = app.db.settings;
    s.irsMapa['Seguros / Multirriscos'] = app.IRS_MAPA_HERDA;
    s.irsMapa['Seguros'] = 'outros';
    app.fillCats(s);
    igual(app.irsColunaDe(app.normTx({ kind: 'expense', category: 'Seguros', sub: 'Multirriscos', amount: 100 })), { col: 'outros', origem: 'categoria' });
  });

  test('numa categoria, ou numa subcategoria que não está na árvore, não serve: sai', () => {
    const st = { cats: { 'Seguros': ['Multirriscos'], 'Minha': [] }, catsIn: { Y: [] },
      irsMapa: { 'Seguros': app.IRS_MAPA_HERDA, 'Minha': app.IRS_MAPA_HERDA, 'Seguros / Inventada': app.IRS_MAPA_HERDA } };
    app.fillCats(st);
    assert.equal(st.irsMapa['Seguros'], app.IRS_MAPA0['Seguros'], 'a categoria volta à regra de origem');
    assert.equal(st.irsMapa['Minha'], undefined);
    assert.equal(st.irsMapa['Seguros / Inventada'], undefined);
  });
});
