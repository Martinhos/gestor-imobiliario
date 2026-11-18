// O motor do IRS e os quadros raros do Anexo F (KAN-128, vaga 3, folha 2.3.6):
// a taxa de 5 % dos imóveis reabilitados (quadro 6A, o antigo art. 71.º n.º 7
// do EBF, mantido pela informação vinculativa 28153 a quem já era dono a 6 de
// outubro de 2023) que fica no 4.1 e nunca vai ao 4.2; a frase das taxas que
// a diz; as rendas de um prédio rústico arrendado a uma entidade de gestão
// florestal contadas a 50 % (6C, enquanto a lei estiver em vigor); o direito
// real de habitação duradoura no quadro 4.3 a 5 % (art. 72.º n.º 5); as obras
// de uma Loja com História a 110 % (6B); as rendas do teste das rendas
// moderadas pelo papel de cada receita; os códigos da natureza guardados por
// ano; e o NIF de um particular. Os campos novos do imóvel e do contrato
// fazem-se aqui à mão, com a forma do contrato de interfaces (§1.7). Lógica
// pura sobre o db, sem browser.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
beforeEach(() => {
  limpar(app);
  app.db.owners.push(app.normPerson({ id: 'eu', name: 'Eu' }));
  app.db.tenants.push(app.normPerson({ id: 't1', name: 'Inquilino', nif: '123456789' }));
  app.db.tenants.push(app.normPerson({ id: 'pc', name: 'Empresa', nif: '500000000' }));
});
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));

/* Um imóvel na base, com os campos novos escritos à mão depois do normProp.
   Recebe: id; extra (opcional) — campos do normProp; novos (opcional) — campos da ronda 2.
   Devolve: o imóvel. */
function imovel(id, extra, novos) {
  const p = app.normProp(Object.assign({ id, name: id, ownerIds: ['eu'], freguesiaCodigo: '131210', tipoPredio: 'U', matrix: '9', purchaseDate: '2016-01-01' }, extra || {}));
  Object.assign(p, novos || {});
  app.db.properties.push(p);
  return p;
}
/* Um contrato declarado na base; os campos novos do bloco fiscal escrevem-se depois do normContract.
   Recebe: id, pid; extra — campos do contrato; fisco (opcional) — campos do bloco fiscal escritos à mão.
   Devolve: o contrato. */
function contrato(id, pid, extra, fisco) {
  const c = app.normContract(Object.assign({ id, name: id, propertyId: pid, tenantIds: ['t1'], active: true }, extra));
  Object.assign(c.fisco, fisco || {});
  app.db.contracts.push(c);
  return c;
}
/* Uma renda por mês do ano, ligada ao contrato. */
function rendas(cid, pid, ano, valor) {
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', amount: valor, contractId: cid, propertyId: pid, date: `${ano}-${mm}-05`, periodo: `${ano}-${mm}`, recibo: true }));
  }
}
const taxa = (c, ano) => { const t = copia(app.irsTaxa(c, ano)); return { taxa: t.taxa, motivo: t.motivo, reducao: t.reducao }; };
const ids = (c, ano) => copia(app.irsBeneficios(c, ano)).map((b) => b.id);
const REAB = { tipo: 'aru', inicio: '2018-03-01', conclusao: '2018-12-10', certificado: true };

describe('D117 · o imóvel reabilitado (6A): 5 % no 4.1, nunca no 4.2', () => {
  /* o cenário do verificador do código: o contrato sem termo (A) e o de 7 anos (B), no mesmo imóvel reabilitado */
  function cenario(reab, extraProp) {
    imovel('porto', extraProp, { reabilitacao: reab });
    const A = contrato('A', 'porto', { rent: 800, start: '2020-02-01', end: '' }, { estado: 'declarado', numero: '1', finalidade: 'hp', celebracao: '2020-01-20' });
    const B = contrato('B', 'porto', { rent: 800, start: '2024-01-01', end: '2030-12-31' }, { estado: 'declarado', numero: '2', finalidade: 'hp', celebracao: '2023-12-20', rendaAcimaDoLimite: false });
    for (const id of ['A', 'B']) { rendas(id, 'porto', 2025, 800); rendas(id, 'porto', 2026, 800); }
    return { A, B };
  }

  test('2025 e 2026: os dois contratos a 5 %, motivo reabilitação, sem redução — e a linha no 4.1 com o 6A', () => {
    const { A, B } = cenario(REAB);
    for (const ano of [2025, 2026]) {
      for (const c of [A, B]) {
        assert.deepEqual(taxa(c, ano), { taxa: 5, motivo: 'reabilitacao', reducao: null }, c.id + ' ' + ano);
        assert.deepEqual(ids(c, ano), ['reab71'], 'o 6A vale para a linha ' + c.id + ' ' + ano);
        assert.equal(copia(app.irsBeneficios(c, ano))[0].quadro, '6A');
      }
      const ls = app.resumoFiscal(ano, 'eu').linhas;
      for (const id of ['A', 'B']) {
        const l = ls.find((x) => x.contratoId === id);
        assert.equal(l.quadro, '4.1', 'nunca o 4.2: ' + id + ' ' + ano);
        assert.equal(l.taxa, 5, id + ' ' + ano);
        assert.equal(l.motivoTaxa, 'reabilitacao');
      }
      assert.equal(app.irsComunicado(B, ano), '', 'sem a comunicação de fevereiro');
      assert.equal(app.irsComunicacaoDoAno(B, ano), null);
      assert.equal(app.irsRegimeQuadro10(B, ano), '');
    }
    assert.equal(app.irsTaxaPorque(B, 2025), 'imóvel reabilitado');
  });

  test('sem as condições da PIV 28153 não há 5 %, e o motivo diz qual falta', () => {
    const casos = [
      [{ ...REAB, certificado: false }, {}, /certificado/],
      [{ ...REAB, tipo: '' }, {}, null],
      [{ ...REAB, inicio: '2007-06-01' }, {}, /2 de janeiro de 2008/],
      [{ ...REAB, inicio: '2023-11-01', conclusao: '2024-05-01' }, {}, /6 de outubro de 2023/],
      [{ ...REAB, inicio: '' }, {}, /início da reabilitação/],
      [{ ...REAB, conclusao: '' }, {}, /conclusão da reabilitação/],
      [REAB, { purchaseDate: '2024-01-01' }, /6 de outubro de 2023/],
      [REAB, { purchaseDate: '' }, /data de compra/],
    ];
    for (const [reab, extra, motivo] of casos) {
      limpar(app);
      app.db.owners.push(app.normPerson({ id: 'eu', name: 'Eu' }));
      const { B } = cenario(reab, extra);
      assert.equal(taxa(B, 2025).motivo, 'duracao', JSON.stringify([reab, extra]));
      assert.deepEqual(ids(B, 2025), []);
      const av = copia(app.irsBeneficiosAvaliados(B, 2025));
      if (motivo) {
        assert.equal(av.length, 1); assert.equal(av[0].aplica, false);
        assert.match(av[0].motivo, motivo, JSON.stringify([reab, extra]));
      } else assert.deepEqual(av, [], 'sem o tipo (ARU ou NRAU) o imóvel não está marcado');
    }
  });

  test('a reabilitação concluída depois do ano não conta nesse ano', () => {
    const { A } = cenario({ ...REAB, inicio: '2023-05-01', conclusao: '2026-02-01' });
    assert.equal(taxa(A, 2025).motivo, 'base');
    assert.match(copia(app.irsBeneficiosAvaliados(A, 2025))[0].motivo, /concluída/);
    assert.equal(taxa(A, 2026).motivo, 'reabilitacao');
  });

  test('a isenção vem antes, e um DHD vai ao 4.3 (o 6A só identifica linhas do 4.1)', () => {
    const { A } = cenario(REAB);
    A.fisco.isencao = 'pma';
    assert.equal(taxa(A, 2025).motivo, 'isento');
    assert.deepEqual(ids(A, 2025), []);
    A.fisco.isencao = ''; A.fisco.finalidade = 'dhd';
    assert.equal(taxa(A, 2025).motivo, 'dhd');
    assert.deepEqual(ids(A, 2025), []);
  });

  test('o não habitacional também desce aos 5 % (o n.º 7 não distinguia)', () => {
    const { A } = cenario(REAB);
    A.fisco.finalidade = 'nh';
    assert.deepEqual(taxa(A, 2026), { taxa: 5, motivo: 'reabilitacao', reducao: null });
  });

  test('a versão traz o benefício com as datas da PIV 28153 e o aviso da mudança de posição da AT', () => {
    for (const ano of [2025, 2026]) {
      const b = copia(app.irsAno(ano)).beneficios.find((x) => x.id === 'reab71');
      assert.equal(b.quadro, '6A'); assert.equal(b.taxa, 5);
      assert.equal(b.inicioDesde, '2008-01-02'); assert.equal(b.inicioAte, '2023-10-06'); assert.equal(b.donoEm, '2023-10-06');
      assert.deepEqual(b.campos, ['01', '02', '03', '04', '05']);
      assert.match(b.lei, /PIV 28153/);
      assert.match(b.aviso, /28153/); assert.match(b.aviso, /23119/);
    }
  });
});

describe('D118 · a frase das taxas diz os 5 % da reabilitação', () => {
  test('2025 e 2026', () => {
    for (const ano of [2025, 2026]) {
      const t = app.irsTaxasTexto(ano);
      assert.match(t, /reabilitados com certificado da câmara, se já eras dono a 6 de outubro de 2023, a taxa é 5 % \(quadro 6A\)/, String(ano));
      assert.match(t, /15 % com 5 anos, 10 % com 10 anos, 5 % com 20 anos ou mais/);
      const p = copia(app.irsAno(ano)).passos.find((x) => /6G/.test(x.titulo)).texto;
      assert.match(p, /6A/, 'o passo do englobamento');
    }
  });
});

describe('D119 · o rústico arrendado a uma EGF (6C): as rendas contam 50 %', () => {
  function cenario(celebracao, extraProp) {
    imovel('pinhal', Object.assign({ tipoPredio: 'R', matrix: '55' }, extraProp || {}));
    const E = contrato('E', 'pinhal', { tenantIds: ['pc'], rent: 300, start: celebracao, end: '2031-02-28' },
      { estado: 'declarado', numero: '3', finalidade: 'nh', celebracao, egf: true });
    return E;
  }

  test('celebrado em 2019: o fator 0,5 em 2025 e em 2026; a taxa continua a do não habitacional', () => {
    const E = cenario('2019-03-01');
    for (const ano of [2025, 2026]) {
      const b = copia(app.irsBeneficios(E, ano));
      assert.equal(b.length, 1, String(ano));
      assert.equal(b[0].id, 'egf'); assert.equal(b[0].quadro, '6C'); assert.equal(b[0].fator, 0.5);
      assert.deepEqual(b[0].campos, ['13', '14', '15', '16', '17']);
      assert.deepEqual(taxa(E, ano), { taxa: 28, motivo: 'nh', reducao: null });
    }
  });

  test('guardado à vigência: em 2027 só se o Orçamento o prorrogar (a versão de 2026 diz até 2026)', () => {
    const E = cenario('2019-03-01');
    assert.deepEqual(ids(E, 2027), []);
    assert.match(copia(app.irsBeneficiosAvaliados(E, 2027))[0].motivo, /2026/);
  });

  test('só os arrendamentos até 2020, durante 12 anos, e só num prédio rústico', () => {
    assert.deepEqual(ids(cenario('2021-01-10'), 2025), []);
    assert.match(copia(app.irsBeneficiosAvaliados(app.db.contracts[0], 2025))[0].motivo, /31 de dezembro de 2020/);
    limpar(app);
    const velho = cenario('2013-05-01');
    assert.deepEqual(ids(velho, 2025), [], '2013 a 2024: os 12 anos acabaram');
    assert.deepEqual(ids(velho, 2024), ['egf']);
    limpar(app);
    assert.deepEqual(ids(cenario('2019-03-01', { tipoPredio: 'U' }), 2025), []);
    limpar(app);
    const sem = cenario('2019-03-01'); sem.fisco.egf = false;
    assert.deepEqual(copia(app.irsBeneficiosAvaliados(sem, 2025)), [], 'sem a marca, nada');
  });

  test('a versão cita a lei e a prorrogação', () => {
    for (const ano of [2025, 2026]) {
      const b = copia(app.irsAno(ano)).beneficios.find((x) => x.id === 'egf');
      assert.equal(b.fator, 0.5); assert.equal(b.contratosAte, '2020-12-31'); assert.equal(b.anos, 12); assert.equal(b.vigenteAte, '2026-12-31');
      assert.match(b.lei, /59\.º-G/); assert.match(b.lei, /73-A\/2025/);
    }
  });
});

describe('D120 · o direito real de habitação duradoura: quadro 4.3 a 5 %', () => {
  test('a prestação mensal paga 5 % em 2025 e em 2026 (nunca a base nem a moderada), sem redução nem 4.2', () => {
    imovel('casa');
    const H = contrato('H', 'casa', { rent: 600, start: '2022-03-01', end: '' }, { estado: 'declarado', numero: '4', finalidade: 'dhd', celebracao: '2022-02-15' });
    rendas('H', 'casa', 2025, 600); rendas('H', 'casa', 2026, 600);
    for (const ano of [2025, 2026]) {
      assert.deepEqual(taxa(H, ano), { taxa: 5, motivo: 'dhd', reducao: null }, String(ano));
      const v = copia(app.irsAno(ano));
      assert.equal(v.quadros.dhd, '4.3');
      assert.equal(v.taxas.dhd, 5);
      assert.equal(app.naturezaIrs(H, ano), '01');
      assert.equal(v.naturezas.dhd, '01');
      assert.deepEqual(v.quadro43.naturezas, { prestacao: '01', caucao: '02', deducaoCaucao: '03' });
      assert.deepEqual(v.quadro43.reduzidas, ['01'], 'a redução do n.º 5 é só da prestação mensal');
      assert.deepEqual(v.quadro43.motivos.map((m) => m.codigo), ['01', '02', '03', '04', '05', '06']);
      assert.deepEqual(v.quadro43.motivos.filter((m) => m.regulariza).map((m) => m.codigo), ['01']);
      assert.equal(v.quadros.campos['4.3'], 4901);
    }
    assert.equal(app.irsReducao(H, 2025), null);
    assert.equal(app.irsTaxaPorque(H, 2025), 'habitação duradoura (DHD)');
  });

  test('um DHD não é isento por nenhum programa de arrendamento', () => {
    imovel('casa');
    const H = contrato('H', 'casa', { rent: 600, start: '2022-03-01', end: '' }, { estado: 'declarado', numero: '4', finalidade: 'dhd', isencao: 'pma' });
    assert.equal(taxa(H, 2025).motivo, 'dhd');
  });
});

describe('D121 · a Loja com História (6B): as obras dos 24 meses a 110 %', () => {
  test('marcada, num contrato não habitacional: o fator 1,1 das obras; num de habitação, não', () => {
    imovel('loja', {}, { lojaComHistoria: true });
    const L = contrato('L', 'loja', { tenantIds: ['pc'], rent: 1000, start: '2025-05-01', end: '2030-04-30' }, { estado: 'declarado', numero: '5', finalidade: 'nh', celebracao: '2025-04-20' });
    for (const ano of [2025, 2026]) {
      const b = copia(app.irsBeneficios(L, ano));
      assert.equal(b.length, 1); assert.equal(b[0].id, 'lojaHistoria'); assert.equal(b[0].quadro, '6B'); assert.equal(b[0].fatorObras24, 1.1);
      assert.deepEqual(b[0].campos, ['08', '09', '10', '11', '12']);
      assert.match(b[0].lei, /59\.º-I/); assert.match(b[0].lei, /42\/2017/);
      assert.deepEqual(taxa(L, ano), { taxa: 28, motivo: 'nh', reducao: null });
    }
    L.fisco.finalidade = 'hp';
    assert.deepEqual(ids(L, 2025), []);
    assert.match(copia(app.irsBeneficiosAvaliados(L, 2025))[0].motivo, /não habitacional/);
  });
});

describe('o alojamento local não é da app (decisão do Martinho, 2026-11-17)', () => {
  test('uma categoria da pessoa chamada «Alojamento local» é uma receita por classificar, como as outras', () => {
    app.db.settings.catsIn['Alojamento local'] = [];
    const t = (extra) => app.normTx(Object.assign({ kind: 'income', amount: 1200, date: '2026-07-15', propertyId: 'P1', category: 'Alojamento local' }, extra || {}));
    assert.deepEqual(copia(app.irsReceitaDe(t())), { papel: 'porClassificar', natureza: null });
    assert.deepEqual(copia(app.irsReceitaDe(t({ contractId: 'C1' }))), { papel: 'porClassificar', natureza: null });
    app.db.settings.exclude[app.excKey('catsIn', 'Alojamento local')] = true;
    assert.equal(app.irsReceitaDe(t()).papel, 'fora');
  });
});

describe('a renda do teste das rendas moderadas escolhe as rendas pelo papel (irsReceitaDe), como o resumo', () => {
  /* um contrato de habitação de 2026 com a renda de hoje acima do limite (2 400 €) e rendas de 2 000 € lançadas */
  function cenario() {
    imovel('casa');
    const c = contrato('M', 'casa', { rent: 2400, start: '2026-01-01', end: '' }, { estado: 'declarado', numero: '6', finalidade: 'hp' });
    for (let m = 1; m <= 6; m++) {
      const mm = String(m).padStart(2, '0');
      app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 2000, contractId: 'M', propertyId: 'casa', date: `2026-${mm}-05`, periodo: `2026-${mm}` }));
    }
    return c;
  }

  test('as rendas «Fora dos totais» contam: a média é a das rendas, não a renda de hoje', () => {
    const c = cenario();
    app.db.settings.exclude[app.excKey('catsIn', 'Rendas')] = true;
    assert.equal(app.irsRendaMensalDoTeste(c, 2026), 2000);
    assert.equal(taxa(c, 2026).motivo, 'moderada');
  });

  test('a indemnização (05), as outras receitas prediais (02) e a caução não entram no limite dos 2 300 €', () => {
    const c = cenario();
    const add = (sub, amount, mm) => app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', sub, amount, contractId: 'M', propertyId: 'casa', date: `2026-${mm}-20`, periodo: `2026-${mm}` }));
    add('Indemnização', 6000, '07');
    add('Outras receitas prediais', 600, '08');
    assert.equal(app.irsRendaMensalDoTeste(c, 2026), 2000, 'a indemnização e as outras receitas prediais ficam de fora');
    add('Caução', 4000, '01');
    assert.equal(app.irsReceitaDe(app.db.transactions[app.db.transactions.length - 1]).papel, 'caucao', 'é a caução');
    assert.equal(app.irsRendaMensalDoTeste(c, 2026), 2000, 'a caução de dois meses não sobe a média (decisão do Martinho, 2026-11-17)');
    assert.equal(taxa(c, 2026).motivo, 'moderada', 'e a taxa continua a das rendas moderadas');
  });
});

describe('os códigos da natureza guardam-se por ano, sem mudar o resultado', () => {
  test('naturezaIrs e irsNaturezasDoAno dão o mesmo que a versão de cada ano, em todas as finalidades', () => {
    imovel('casa');
    const c = contrato('N', 'casa', { rent: 500, start: '2024-01-01', end: '' }, {});
    for (let ano = 2020; ano <= 2031; ano++) {
      const n = copia(app.irsAno(ano)).naturezas;
      assert.deepEqual(copia(app.irsNaturezasDoAno(ano)), n, String(ano));
      for (const fin of ['', 'hp', 'hnp', 'nh', 'dhd']) {
        c.fisco.finalidade = fin;
        const esperado = fin === 'nh' ? n.naoHabitacional : fin === 'dhd' ? (n.dhd || n.habitacional) : n.habitacional;
        assert.equal(app.naturezaIrs(c, ano), esperado, ano + ' ' + fin);
      }
    }
  });

  test('uma versão registada depois apaga o que estava guardado', () => {
    const outra = carregarApp({ hoje: '2026-11-17' });
    limpar(outra);
    assert.equal(outra.irsNaturezasDoAno(2027).habitacional, '07');
    const v = JSON.parse(JSON.stringify(outra.irsAno(2026)));
    v.ano = 2027; v.naturezas = Object.assign({}, v.naturezas, { habitacional: '99' });
    outra.registarAnoIrs(v);
    assert.equal(outra.irsNaturezasDoAno(2027).habitacional, '99');
    assert.equal(outra.irsNaturezasDoAno(2026).habitacional, '07');
  });
});

describe('D116 · o NIF de um particular (1, 2 ou 3): um sinal para confirmar', () => {
  test('nifParticular', () => {
    for (const n of ['123456789', '234567890', '300000000', ' 123 456 789 ', 123456789]) assert.equal(app.nifParticular(n), true, String(n));
    for (const n of ['500000000', '450000001', '800000000', '900000000', '', null, '12345678', 'X23456789']) assert.equal(app.nifParticular(n), false, String(n));
  });
});
