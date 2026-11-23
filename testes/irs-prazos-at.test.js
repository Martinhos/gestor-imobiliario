// Os prazos da AT e os da lei do arrendamento, pela lei e não pela conta
// antiga: a comunicação da duração faz-se uma vez por período (o contrato e
// cada renovação), até 15 de fevereiro do ano seguinte ao início, haja ou não
// rendas; a cessação comunica-se só quando o contrato acabou mesmo, pelo dia
// em que acabou, e nos contratos com redução também a data e o motivo em
// fevereiro; a oposição à renovação conta a antecedência pela duração do
// período (240, 120, 60 dias ou um terço) e a primeira renovação só deixa de
// valer três anos depois da celebração; o recibo emite-se quando se recebe; a
// atualização legal da renda não se comunica; um contrato de antes de abril
// de 2015 não tem Modelo 2; o envio ao IHRU marca-se com o dia; os recibos
// pedem-se pelo papel da receita (a caução, o reembolso do inquilino e as outras
// receitas prediais sim, a indemnização e o reembolso do condomínio sem contrato
// não); e a dispensa dos
// recibos e o Modelo 44 de cada ano são os da situação desse ano.
//
// O dia da app é fixo (2026-11-13); os prazos leem o `hoje` que se lhes passa.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor, elementos } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-13' });
afterEach(() => repor(app));

/* um imóvel, um dono, um inquilino e um contrato declarado de habitação permanente
   Recebe: extra (opcional) — campos do contrato (o fisco por inteiro, se vier).
   Devolve: o contrato guardado. */
function monta(extra) {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Arroios', ownerIds: ['O1'] })];
  app.db.contracts = [app.normContract(Object.assign({ id: 'C1', name: 'Arroios', propertyId: 'P1', tenantIds: ['T1'], rent: 900,
    start: '2025-03-01', end: '', active: true, fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } }, extra || {}))];
  app.db.transactions = [];
  app.db.settings.prazosVistos = {};
  return app.db.contracts[0];
}

/* uma receita do contrato C1 (uma renda, por omissão)
   Recebe: id; date; extra (opcional) — campos do movimento.
   Devolve: nada. */
function receita(id, date, extra) {
  app.db.transactions.push(app.normTx(Object.assign({ id, kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 900, date,
    propertyId: 'P1', contractId: 'C1', recibo: true }, extra || {})));
}

/* os prazos de um tipo, copiados para fora do contexto da app (os arrays de lá não são
   deepEqual aos de cá) */
const doTipo = (h, tipo) => JSON.parse(JSON.stringify(app.prazosDe(h).filter((p) => p.tipo === tipo)));

describe('a comunicação da duração, uma vez por período (D01)', () => {
  test('um contrato comunicado no primeiro ano não volta a pedir a comunicação no ano seguinte', () => {
    monta({ start: '2024-03-01', end: '2029-02-28', fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', comunicacoes: { 2024: '2025-02-10' } } });
    for (let m = 1; m <= 12; m++) receita('R' + m, '2025-' + String(m).padStart(2, '0') + '-05');
    assert.deepEqual(doTipo('2026-01-20', 'fev15'), [], 'a comunicação de 2025 vale para o período inteiro');
    assert.deepEqual(doTipo('2027-01-20', 'fev15'), [], 'e em todos os anos dele');
  });

  test('a renovação pede a sua comunicação, até 15/02 do ano seguinte ao início dela, haja ou não rendas', () => {
    monta({ start: '2024-03-01', end: '2029-02-28', fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', comunicacoes: { 2024: '2025-02-10' },
      renovacoes: [{ inicio: '2029-03-01', fim: '2034-02-28' }] } });
    assert.equal(app.db.contracts[0].end, '2034-02-28', 'controlo: a renovação leva o termo');
    const f = doTipo('2030-01-20', 'fev15');
    assert.equal(f.length, 1);
    assert.equal(f[0].alvo, '2030-02-15');
    assert.match(f[0].titulo, /renovação/);
    assert.match(f[0].sub, /01\/03\/2029/, 'diz que período se comunica');
    assert.equal(f[0].chave, 'fev15:C1:2030-02-15', 'a chave leva o contrato e a data-alvo');
  });

  test('o contrato de dezembro com a primeira renda em janeiro avisa a tempo, e não um ano depois', () => {
    monta({ start: '2025-12-01', end: '2035-11-30', rent: 2500 });
    for (let m = 1; m <= 11; m++) receita('R' + m, '2026-' + String(m).padStart(2, '0') + '-02', { amount: 2500 });
    const f = doTipo('2026-01-10', 'fev15');
    assert.equal(f.length, 1, 'a 2026-01-10 já avisa');
    assert.equal(f[0].alvo, '2026-02-15', 'o 15 de fevereiro do ano seguinte ao início (Portaria 110/2019)');
    assert.equal(f[0].dias, 36);
    const tarde = doTipo('2026-03-01', 'fev15')[0];
    assert.ok(tarde, 'passado o dia fica, até se marcar');
    assert.match(tarde.sub, /Este contrato começou a 01\/12\/2025: o prazo para o comunicar no Portal das Finanças era 15\/02\/2026\. Se já o comunicaste, marca a comunicação com o dia em que a fizeste; se não, comunica-o quanto antes\./);
    assert.deepEqual(doTipo('2027-01-10', 'fev15').map((p) => p.alvo), ['2026-02-15'], 'não nasce outro em 2027: o de 2026 continua por marcar');
    app.db.contracts[0].fisco.comunicacoes = { 2025: '2026-02-10' };
    assert.deepEqual(doTipo('2027-01-10', 'fev15'), [], 'marcado, não há nada em 2027');
  });

  test('o texto diz que se comunica uma vez, e não que se perde a redução', () => {
    monta({ start: '2025-12-01', end: '2035-11-30' });
    const f = doTipo('2026-01-10', 'fev15')[0];
    assert.doesNotMatch(f.sub, /perde-se a redução/);
    assert.match(f.sub, /comunica-se uma vez, até 15\/02 do ano seguinte ao início do contrato ou de cada renovação/);
    assert.match(f.sub, /até 15\/02\/2026/);
    assert.match(f.titulo, /^Comunicar a duração do contrato à AT — Arroios$/);
  });

  test('um período que já não pesa em nenhuma declaração por entregar não avisa', () => {
    monta({ start: '2019-03-01', end: '2024-02-29', fisco: { estado: 'declarado', numero: '111', finalidade: 'hp',
      renovacoes: [{ inicio: '2024-03-01', fim: '2029-02-28' }] } });
    const alvos = doTipo('2026-11-13', 'fev15').map((p) => p.alvo);
    assert.deepEqual(alvos, ['2025-02-15'], 'só o da renovação de 2024, que ainda vive em 2025');
  });

  test('marcar como comunicada grava pela chave do período, com a marca nova, e o aviso cala-se', () => {
    monta({ start: '2025-03-01', end: '2035-02-28' });
    const f = doTipo('2026-01-10', 'fev15')[0];
    assert.equal(f.acao, "pzComunicadaPergunta('C1','2025')");
    assert.equal(f.acaoTexto, 'Marcar como comunicada');
    let corpo = '', pe = '', desfazer = null;
    app.openModal = (t, c, p) => { corpo = c; pe = p; };
    app.closeModal = () => {};
    app.render = () => {};
    app.save = () => {};
    app.comDesfazer = (m, fn) => { desfazer = fn; };
    app.pzComunicadaPergunta('C1', '2025');
    assert.match(corpo, /id="pz_comdia" type="date" max="2026-11-13" value=""/, 'o prazo passou: o dia não se propõe');
    assert.match(corpo, /Comunicada a <span class="req">\*<\/span>/);
    assert.match(pe, /data-click="pzMarcarComunicada\('C1','2025'\)"/);
    elementos(app).pz_comdia.value = '2026-02-10';
    app.pzMarcarComunicada('C1', '2025');
    const fx = app.db.contracts[0].fisco;
    assert.equal(fx.comunicacoes['2025'], '2026-02-10');
    assert.equal(fx.comunicacoesV, 2);
    assert.deepEqual(doTipo('2026-01-10', 'fev15'), []);
    desfazer();
    assert.equal(app.db.contracts[0].fisco.comunicacoes['2025'], undefined, '«Anular» tira a marca');
  });

  test('a janela recusa um dia depois de hoje e um dia vazio', () => {
    monta({ start: '2025-03-01', end: '2035-02-28' });
    const erros = [];
    app.openModal = () => {};
    app.falhaCampo = (id, msg) => { erros.push([id, msg]); };
    app.save = () => {};
    elementos(app).pz_comdia.value = '';
    app.pzMarcarComunicada('C1', '2025');
    elementos(app).pz_comdia.value = '2026-12-01';
    app.pzMarcarComunicada('C1', '2025');
    assert.deepEqual(erros.map((e) => e[0]), ['pz_comdia', 'pz_comdia']);
    assert.deepEqual({ ...app.db.contracts[0].fisco.comunicacoes }, {}, 'nada se grava');
  });
});

describe('a cessação, só de quem acabou mesmo (D02, D44, D09)', () => {
  test('terminado antes do termo, com o dia da cessação: o fim do mês seguinte a esse dia', () => {
    monta({ start: '2025-03-01', end: '2030-02-28', active: false, fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', cessacao: { data: '2026-10-31', motivo: '02' } } });
    const c = doTipo('2026-11-13', 'cessacao');
    assert.equal(c.length, 1);
    assert.equal(c[0].alvo, '2026-11-30');
    assert.match(c[0].sub, /acabou a 31\/10\/2026/);
    assert.equal(app.db.contracts[0].end, '2030-02-28', 'o termo não muda');
  });

  test('sem termo, desligado com o dia: também', () => {
    monta({ start: '2025-03-01', end: '', active: false, fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', cessacao: { data: '2026-10-15', motivo: '02' } } });
    assert.deepEqual(doTipo('2026-11-13', 'cessacao').map((p) => p.alvo), ['2026-11-30']);
  });

  test('um contrato ativo com o termo passado renovou-se: só o aviso do fim, sem a cessação', () => {
    monta({ start: '2021-10-01', end: '2026-09-30' });
    for (const d of ['2026-08-05', '2026-09-05', '2026-10-05', '2026-11-05']) receita(d, d);
    assert.deepEqual(doTipo('2026-11-13', 'cessacao'), []);
    assert.equal(doTipo('2026-11-13', 'fim').length, 1, 'o fim fica, e pede para registar a renovação ou terminar');
  });

  test('num contrato com redução que acabou, o 15 de fevereiro seguinte pede a data e o motivo da cessação', () => {
    monta({ start: '2021-07-01', end: '2026-06-30', active: false, fisco: { estado: 'declarado', numero: '114', finalidade: 'hp', celebracao: '2021-06-20',
      comunicacoes: { 2021: '2022-02-10' }, cessacao: { data: '2026-06-30', motivo: '03' } } });
    for (let m = 1; m <= 6; m++) receita('R' + m, '2026-0' + m + '-05');
    const f = doTipo('2027-01-10', 'fev15');
    assert.equal(f.length, 1);
    assert.equal(f[0].alvo, '2027-02-15');
    assert.match(f[0].titulo, /^Comunicar a cessação do contrato à AT \(Portaria 110\/2019\) — Arroios$/);
    assert.match(f[0].sub, /comunica a data e o motivo da cessação/);
    assert.match(f[0].sub, /30\/06\/2026/);
    assert.doesNotMatch(f[0].sub, /a duração e as renovações/);
    assert.equal(f[0].chave, 'fev15:C1:2027-02-15:cessacao');
    const ces = doTipo('2026-07-10', 'cessacao')[0];
    assert.equal(ces.alvo, '2026-07-31', 'e o Modelo 2 da cessação, no fim do mês seguinte');
    assert.match(ces.sub, /até 15\/02\/2027/, 'que lembra a de fevereiro');
  });

  test('sem redução, a cessação não pede a comunicação de fevereiro', () => {
    monta({ start: '2025-03-01', end: '', active: false, fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', cessacao: { data: '2026-06-30', motivo: '02' } } });
    assert.deepEqual(doTipo('2027-01-10', 'fev15'), []);
    assert.doesNotMatch(doTipo('2026-07-10', 'cessacao')[0].sub, /15\/02/);
  });
});

describe('a oposição à renovação pela duração do período (D45)', () => {
  const op = (start, end, h, fisco) => {
    monta({ start, end, fisco: Object.assign({ estado: 'declarado', numero: '1', finalidade: 'hp' }, fisco || {}) });
    return doTipo(h, 'oposicao')[0];
  };

  test('seis anos ou mais: 240 dias', () => {
    const o = op('2017-06-01', '2027-05-31', '2026-09-01');
    assert.equal(o.alvo, '2026-10-03');
    assert.match(o.sub, /até 03\/10\/2026 \(240 dias\)/);
  });

  test('de seis meses a um ano: 60 dias; abaixo de seis meses: um terço do prazo', () => {
    assert.equal(op('2026-04-01', '2026-12-31', '2026-08-20').alvo, '2026-11-01');
    const t = op('2026-08-01', '2026-11-30', '2026-08-15');
    assert.equal(t.alvo, '2026-10-20', '122 dias, um terço arredondado para cima: 41');
    assert.match(t.sub, /um terço do prazo/);
  });

  test('a primeira renovação só deixa de valer três anos depois da celebração', () => {
    const o = op('2026-03-01', '2027-02-28', '2026-09-01');
    assert.equal(o.alvo, '2026-10-31', 'um ano: 120 dias');
    assert.match(o.sub, /primeira renovação/);
    assert.match(o.sub, /01\/03\/2029/, 'o contrato continua até três anos depois da celebração');
    assert.doesNotMatch(op('2023-03-01', '2026-02-28', '2025-09-15').sub, /primeira renovação/, 'com três anos, a oposição vale no termo');
    assert.doesNotMatch(op('2026-03-01', '2027-02-28', '2026-09-01', { finalidade: 'nh' }).sub, /primeira renovação/, 'o não habitacional tem regras próprias');
  });

  test('numa renovação conta a duração dela, e já não é a primeira', () => {
    const o = op('2020-03-01', '2021-02-28', '2026-06-01', { renovacoes: [{ inicio: '2021-03-01', fim: '2027-02-28' }] });
    assert.equal(app.db.contracts[0].end, '2027-02-28');
    assert.equal(o.alvo, '2026-07-03', 'seis anos de renovação: 240 dias');
    assert.doesNotMatch(o.sub, /primeira renovação/);
    assert.deepEqual({ ...app.pzOposicao(app.db.contracts[0]) }, { alvo: '2026-07-03', dias: 240, terco: false, efeitos: '' });
    assert.equal(app.pzOposicao({ end: '' }), null);
  });
});

describe('o IHRU do RSAA marca-se com o dia (D46)', () => {
  const rsaa = () => monta({ start: '2026-10-01', end: '2029-09-30', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp', isencao: 'rsaa', celebracao: '2026-09-20' } });

  test('o aviso tem «Marcar como enviado», que grava a data e o cala', () => {
    rsaa();
    const p = doTipo('2026-12-10', 'rsaa')[0];
    assert.equal(p.acao, "pzIhruPergunta('C1')");
    assert.equal(p.acaoTexto, 'Marcar como enviado');
    let corpo = '';
    app.openModal = (t, c) => { corpo = c; };
    app.closeModal = () => {};
    app.render = () => {};
    app.save = () => {};
    app.comDesfazer = () => {};
    app.pzIhruPergunta('C1');
    assert.match(corpo, /id="pz_ihru" type="date" max="2026-11-13" value="2026-11-13"/, 'antes do prazo propõe hoje');
    elementos(app).pz_ihru.value = '2026-11-10';
    app.pzMarcarIhru('C1');
    assert.equal(app.db.contracts[0].fisco.ihru, '2026-11-10');
    assert.deepEqual(doTipo('2026-12-10', 'rsaa'), []);
  });

  test('passado o dia, fica para se marcar o dia em que foi', () => {
    rsaa();
    const p = doTipo('2027-01-20', 'rsaa')[0];
    assert.ok(p, 'continua');
    assert.match(p.sub, /O prazo era 15\/01\/2027/);
    assert.match(p.sub, /marca o dia em que o enviaste/);
  });

  test('sem quem possa alterar o contrato, não há botão', () => {
    rsaa();
    app.podeEditar = () => false;
    const p = doTipo('2026-12-10', 'rsaa')[0];
    assert.ok(p && !p.acao);
  });
});

describe('o recibo nasce no dia em que se recebe (D82)', () => {
  test('o alvo é o dia do recebimento, sem «até»', () => {
    monta();
    receita('R1', '2026-10-08', { recibo: false });
    const r = doTipo('2026-10-09', 'recibos')[0];
    assert.equal(r.alvo, '2026-10-08');
    assert.match(r.sub, /recebida a 08\/10\/2026/);
    assert.match(r.sub, /emite o recibo/);
    assert.doesNotMatch(r.sub, /\baté\b/);
    receita('R2', '2026-10-20', { recibo: false });
    assert.equal(doTipo('2026-10-09', 'recibos').length, 1, 'uma renda com data à frente ainda não foi recebida');
  });
});

describe('o aumento anual (D83)', () => {
  test('a atualização legal não se comunica; o aumento combinado comunica-se e paga selo', () => {
    monta({ start: '2025-12-20', increase: 2.24 });
    const a = doTipo('2026-11-13', 'aumento')[0];
    assert.doesNotMatch(a.sub, /comunica a nova renda à AT \(Modelo 2\)/);
    assert.match(a.sub, /atualização pelo coeficiente legal não se comunica à AT/);
    assert.match(a.sub, /aumento combinado com o inquilino comunica-se pelo Modelo 2 até ao fim do mês seguinte/);
    assert.match(a.sub, /imposto do selo/);
  });
});

describe('o contrato de antes de abril de 2015 (D85)', () => {
  test('sem Modelo 2 nem selo: um aviso sem data a pedir o registo dos elementos mínimos e o n.º', () => {
    monta({ start: '2012-05-01', fisco: { estado: '' } });
    const h = '2026-11-13';
    assert.deepEqual(doTipo(h, 'modelo2'), []);
    const e = doTipo(h, 'elementos');
    assert.equal(e.length, 1);
    assert.equal(e[0].semData, true);
    assert.equal(e[0].chave, 'elementos:C1');
    assert.match(e[0].sub, /elementos mínimos/);
    assert.doesNotMatch(e[0].sub, /selo/);
    assert.equal(app.pzQuando(e[0]), 'Sem prazo');
    assert.equal(app.pzSelo(e[0]), 'grey');
    assert.deepEqual({ ...app.pzPartes(e[0]) }, { titulo: 'Registar o contrato no Portal das Finanças', onde: 'Arroios' });
    assert.ok(!app.prazosDe(h).slice(0, -1).some((p) => p.semData), 'e fica para o fim da lista');
  });

  test('um contrato de 1 de abril de 2015 já tem Modelo 2', () => {
    monta({ start: '2015-04-01', fisco: { estado: '' } });
    assert.equal(doTipo('2015-04-20', 'modelo2').length, 1);
    assert.deepEqual(doTipo('2015-04-20', 'elementos'), []);
  });
});

describe('os recibos pelo papel da receita (D03, D20, D21)', () => {
  const h = '2026-09-12';
  test('a caução pede recibo, como a AT a trata (renda do ano em que se recebe)', () => {
    monta();
    receita('R1', '2026-08-05', { sub: 'Caução', amount: 1800, recibo: false });
    const r = doTipo(h, 'recibos');
    assert.equal(r.length, 1);
    assert.match(r[0].sub, /Caução recebida a 05\/08\/2026/);
  });

  test('o reembolso do inquilino pede recibo; o do condomínio também, com contrato', () => {
    monta();
    receita('R1', '2026-08-05', { category: 'Reembolsos', sub: 'Inquilino', amount: 40, recibo: false });
    receita('R2', '2026-08-06', { category: 'Reembolsos', sub: 'Condomínio', amount: 50, recibo: false });
    assert.deepEqual(doTipo(h, 'recibos').map((p) => p.chave.split(':')[1]).sort(), ['R1', 'R2']);
  });

  test('o reembolso do condomínio sem contrato abate ao gasto: nem recibo nem aviso a pedir o contrato (Q7)', () => {
    monta();
    receita('R1', '2026-08-05', { category: 'Reembolsos', sub: 'Condomínio', amount: 50, recibo: false, contractId: null });
    assert.equal(app.prazosDe(h).length, 0);
  });

  /* N077: as outras receitas prediais (natureza 02: a cedência de uso, a publicidade, as partes comuns) pedem recibo,
     como a renda (CIRS art. 115.º n.º 5 a)); a indemnização (alínea g) do art. 8.º n.º 2) continua sem ele */
  test('a indemnização não tem recibo de renda; as outras receitas prediais têm', () => {
    monta();
    receita('R1', '2026-08-05', { sub: 'Indemnização', amount: 3000, recibo: false });
    receita('R2', '2026-08-06', { sub: 'Outras receitas prediais', amount: 100, recibo: false });
    const r = doTipo(h, 'recibos');
    assert.deepEqual(r.map((p) => p.chave.split(':')[1]), ['R2']);
    assert.match(r[0].sub, /a cedência de uso \(de parte do prédio, para publicidade, das partes comuns\) também pede recibo eletrónico, ou entra no Modelo 44/);
  });

  test('o Anexo F de um ano só com a caução avisa na mesma', () => {
    monta();
    receita('R1', '2025-08-05', { sub: 'Caução', amount: 1800 });
    assert.equal(doTipo('2026-04-01', 'irs').length, 1);
  });
});

describe('a situação de cada ano (D91)', () => {
  test('o Modelo 44 do ano anterior e os recibos do ano corrente seguem a situação de cada um', () => {
    monta();
    receita('R1', '2025-12-01');
    receita('R2', '2026-01-15', { recibo: false });
    app.db.settings.irs = { dispensaRecibos: false, porAno: { 2025: { dispensaRecibos: true }, 2026: { dispensaRecibos: false } } };
    assert.equal(doTipo('2026-02-01', 'modelo44').length, 1, 'dispensado em 2025: o Modelo 44 de 2025');
    assert.equal(doTipo('2026-02-01', 'recibos').length, 1, 'não dispensado em 2026: o recibo de janeiro');
    app.db.settings.irs = { dispensaRecibos: true, porAno: { 2025: { dispensaRecibos: false }, 2026: { dispensaRecibos: true } } };
    assert.deepEqual(doTipo('2026-02-01', 'modelo44'), [], 'não dispensado em 2025, por mais que o campo de topo diga');
    assert.deepEqual(doTipo('2026-02-01', 'recibos'), [], 'dispensado em 2026');
  });
});

describe('o cartão e os lembretes', () => {
  test('a ação do prazo vai ao cartão, ao lado do ✕', () => {
    monta({ start: '2026-10-01', end: '2029-09-30', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp', isencao: 'rsaa', celebracao: '2026-09-20' } });
    app.prazosAtivos = () => app.prazosDe('2026-12-10');
    const h = app.prazosCard();
    assert.match(h, /<button type="button" class="btn sm vg-feito" data-toca="camada" aria-label="Marcar como enviado: Enviar o contrato ao IHRU \(RSAA\)" data-click="pzIhruPergunta\('C1'\)">Marcar como enviado<\/button>/);
    assert.doesNotMatch(h, /\sstyle=|\son[a-z]+=/);
  });

  test('no «Pede atenção», a ação vai por baixo do prazo e o aviso sem data diz «Sem prazo»', () => {
    monta({ start: '2026-10-01', end: '2029-09-30', fisco: { estado: 'declarado', numero: '1', finalidade: 'hp', isencao: 'rsaa', celebracao: '2026-09-20' } });
    app.db.contracts.push(app.normContract({ id: 'C2', name: 'Baixa', propertyId: 'P1', tenantIds: ['T1'], rent: 350, start: '2012-05-01', active: true }));
    app.prazosAtivos = () => app.prazosDe('2026-12-10');
    let corpo = '';
    app.openModal = (t, c) => { corpo = c; };
    app.notifModal('prazos');
    assert.match(corpo, /<div class="atencao-linha"><div class="atencao-txt"><p class="title">Enviar o contrato ao IHRU \(RSAA\) — Arroios<\/p>/, 'a linha com ação não é um botão');
    assert.match(corpo, /<button type="button" class="btn sm primary" data-toca="camada" aria-label="Marcar como enviado: Enviar o contrato ao IHRU \(RSAA\) — Arroios" data-click="closeModal\(\);pzIhruPergunta\('C1'\)">Marcar como enviado<\/button><button type="button" class="btn sm" data-toca="camada" data-click="closeModal\(\);ctView\('C1'\)">Ver<\/button>/);
    assert.match(corpo, /Registar o contrato no Portal das Finanças — Baixa[^]*?<span class="badge grey">Sem prazo<\/span>/);
    assert.doesNotMatch(corpo, /<button[^>]*>(?:(?!<\/button>)[^])*<button/, 'nenhum botão dentro de outro');
    assert.doesNotMatch(corpo, /\sstyle=|\son[a-z]+=/);
  });

  test('um aviso sem data não marca lembrete', () => {
    monta({ start: '2012-05-01', fisco: { estado: '' } });
    app.prazosAtivos = () => app.prazosDe('2026-11-13');
    assert.ok(!app.prazosLembretes().some((l) => /elementos/.test(l.id)));
  });
});
