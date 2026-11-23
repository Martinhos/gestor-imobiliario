// O contrato perante o IRS, da segunda auditoria: o «Terminar contrato» com o
// termo já passado (o contrato renovou-se: a folha pergunta, regista as
// renovações e grava a cessação no dia real), a devolução da caução no
// «Terminar» e na ficha, o inquilino empresa só pela identificação de quem lá
// mora, o motivo da cessação com a frase certa, apagar um contrato ou um
// inquilino com rendas por entregar, o prazo da cessação só dos anos que
// pesam, e a dica dos encargos a cargo do inquilino.
//
// O dia da app é fixo (2026-09-10).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';
import { conferir } from './lib/formularios.js';

const app = carregarApp({ hoje: '2026-09-10' });
afterEach(() => repor(app));

const copia = (x) => JSON.parse(JSON.stringify(x));

/* um imóvel de arrendamento de um dono, uma inquilina com NIF e um contrato
   declarado de habitação permanente
   Recebe: extra (opcional) — campos do contrato (o fisco junta-se ao de omissão).
   Devolve: o contrato guardado em db.contracts. */
function monta(extra) {
  limpar(app);
  const e = Object.assign({}, extra || {});
  const fisco = Object.assign({ estado: 'declarado', finalidade: 'hp', numero: '1234567' }, e.fisco || {});
  delete e.fisco;
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana', nif: '123456789' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', use: 'investimento', ownerIds: ['O1'],
    freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651', fraction: 'A' })];
  app.db.contracts = [app.normContract(Object.assign({ id: 'C1', name: 'Ana · T2', propertyId: 'P1', tenantIds: ['T1'], rent: 1000,
    start: '2024-03-01', end: '2029-02-28', fisco }, e))];
  app.db.transactions = [];
  app.db.recurring = [];
  app.foldState = {};
  return app.db.contracts[0];
}

/* um movimento na base
   Recebe: extra — os campos do movimento.
   Devolve: o movimento. */
function mov(extra) {
  const t = app.normTx(Object.assign({ propertyId: 'P1' }, extra));
  app.db.transactions.push(t);
  return t;
}
/* as rendas do contrato C1 nos meses dados de um ano, no dia 5, com o mês a que respeitam */
const rendas = (ano, valor, meses) => meses.forEach((m) => {
  const mm = String(m).padStart(2, '0');
  mov({ kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: valor, contractId: 'C1', date: `${ano}-${mm}-05`, periodo: `${ano}-${mm}`, recibo: true });
});

/* um DOM que só conhece os ids do mapa (o resto não está no ecrã)
   Recebe: valores — {id: valor}; true é uma caixa marcada.
   Devolve: nada — o repor devolve o getElementById do arnês. */
function domCom(valores) {
  app.document.getElementById = (id) => (id in valores
    ? { value: valores[id] === true ? 'on' : String(valores[id]), checked: valores[id] === true, hidden: false, textContent: '', innerHTML: '',
        classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, scrollIntoView() {}, getAttribute: () => '' }
    : null);
}

/* as janelas e o ecrã ficam de fora: guarda-se o que se abriu, o que se disse e
   os campos que falharam
   Devolve: {abertas: [{t, b, f}], avisos, erros, desfazer} */
function semEcra() {
  const o = { abertas: [], avisos: [], erros: [], desfazer: [] };
  app.openModal = (t, b, f) => { o.abertas.push({ t, b: String(b || ''), f: String(f || '') }); return {}; };
  app.closeModal = () => {};
  app.closeAllModals = () => {};
  app.render = () => {};
  app.buildNav = () => {};
  app.save = () => {};
  app.paintThumbs = () => {};
  app.toast = (m) => { o.avisos.push(String(m)); };
  app.falhaCampo = (id, m) => { o.erros.push(id + ': ' + m); };
  app.comDesfazer = (m, restaurar) => { o.avisos.push(String(m)); o.desfazer.push(restaurar); };
  app.confirmModal = (t, m) => { o.abertas.push({ t, b: String(m), f: '' }); };
  return o;
}
const ultima = (o) => o.abertas[o.abertas.length - 1];
/* o valor guardado no input escondido de um sel() ou num campo do HTML */
const valorDe = (html, id) => (new RegExp('id="' + id + '"[^>]*?value="([^"]*)"').exec(html) || [])[1];
const linha = (r, id) => r.linhas.find((l) => l.contratoId === id);

describe('N002 — terminar com o termo já passado: o contrato renovou-se', () => {
  test('a folha não propõe o termo antigo nem o motivo do fim do prazo: pergunta se continuou, com hoje no dia e a renovação proposta', () => {
    const o = semEcra();
    monta({ start: '2022-01-01', end: '2022-12-31' });
    app.endContract('C1');
    const f = ultima(o);
    assert.equal(f.t, 'Terminar contrato');
    assert.equal(valorDe(f.b, 'c_cesData'), '2026-09-10', 'hoje por omissão, não o termo de 2022');
    assert.match(f.b, /id="c_cesData" type="date" value="2026-09-10" min="2022-01-01" max="2026-09-10"/);
    assert.equal(valorDe(f.b, 'c_cesMot'), '', 'nenhum motivo escolhido');
    assert.match(f.b, /O prazo do contrato acabou a 31\/12\/2022\. Se continuou depois disso, renovou-se \(Código Civil, art\. 1096\.º\)/);
    assert.match(f.b, /Continuou depois de 31\/12\/2022\? <span class="req">\*<\/span><div class="sel" id="sel_c_cesRenov">/);
    assert.equal(valorDe(f.b, 'c_cesRenov'), '', 'a pergunta vem por responder');
    assert.equal(valorDe(f.b, 'c_cesRenFim'), '2023-12-31', 'sem redução, a proposta repete a duração do período que acabou');
    assert.doesNotMatch(f.b, /fica como está: é o prazo dele/);
    conferir('terminar com o termo passado', f.b, { obrigatorios: ['c_cesData', 'c_cesRenFim'] });
  });

  test('com «Sim», regista as renovações até ao dia real e grava a cessação nesse dia: o condomínio de março conta', () => {
    const o = semEcra();
    monta({ start: '2022-01-01', end: '2022-12-31' });
    rendas(2026, 1000, [1, 2, 3, 4, 5, 6, 7, 8]);
    mov({ kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', amount: 300, date: '2026-03-10' });
    app.endContract('C1');
    domCom({ c_cesRenov: '1', c_cesRenFim: '2023-12-31', c_cesData: '2026-08-31', c_cesMot: '02' });
    app.ctTerminarOk('C1');
    assert.deepEqual(o.erros, []);
    const c = app.contract('C1');
    igual(copia(c.fisco.cessacao), { data: '2026-08-31', motivo: '02' }, 'a cessação no dia em que acabou mesmo');
    assert.equal(c.active, false);
    igual(copia(c.fisco.renovacoes.map((r) => [r.inicio, r.fim])),
      [['2023-01-01', '2023-12-31'], ['2024-01-01', '2024-12-31'], ['2025-01-01', '2025-12-31'], ['2026-01-01', '2026-12-31']],
      'as renovações sucessivas, com a mesma duração, até à que tem o dia');
    assert.equal(c.end, '2026-12-31', 'o termo é o da última renovação');
    assert.match(o.avisos.pop(), /^Contrato terminado, com 4 renovações registadas\.$/);
    const l = linha(app.resumoFiscal(2026, 'O1'), 'C1');
    assert.equal(l.gastos.condominio, 300, 'o condomínio pago antes da saída real fica no período arrendado');
    assert.ok(!app.prazosDe('2026-09-10').some((p) => p.tipo === 'cessacao' && p.alvo === '2023-01-31'), 'sem o prazo da cessação de 2023');
    assert.ok(app.prazosDe('2026-09-10').some((p) => p.tipo === 'cessacao' && p.alvo === '2026-09-30'), 'o prazo da cessação é o do dia real');
    // o anular desfaz as renovações, o termo e a cessação
    o.desfazer.pop()();
    const x = app.contract('C1');
    assert.equal(x.active, true);
    assert.equal(x.end, '2022-12-31');
    assert.deepEqual(copia(x.fisco.renovacoes), []);
    igual(copia(x.fisco.cessacao), { data: '', motivo: '' });
  });

  test('a folha recusa sem resposta, com «Não» e um dia depois do termo, e com «Sim» sem o fim da renovação', () => {
    const o = semEcra();
    monta({ start: '2022-01-01', end: '2022-12-31' });
    domCom({ c_cesRenov: '', c_cesRenFim: '2023-12-31', c_cesData: '2026-08-31', c_cesMot: '02' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_cesRenov: Diz se o contrato continuou depois de 31\/12\/2022\.$/);
    domCom({ c_cesRenov: '0', c_cesRenFim: '', c_cesData: '2026-08-31', c_cesMot: '02' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_cesData: Acabou até 31\/12\/2022: se continuou depois, responde «Sim, renovou-se»\.$/);
    domCom({ c_cesRenov: '1', c_cesRenFim: '', c_cesData: '2026-08-31', c_cesMot: '02' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_cesRenFim: /);
    domCom({ c_cesRenov: '1', c_cesRenFim: '2023-12-31', c_cesData: '2022-10-31', c_cesMot: '02' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_cesData: Se continuou depois de 31\/12\/2022, acabou depois desse dia\.$/);
    assert.equal(app.contract('C1').active, true, 'nada se gravou');
    // com «Não», o termo antigo com o motivo que a pessoa escolhe
    domCom({ c_cesRenov: '0', c_cesRenFim: '', c_cesData: '2022-12-31', c_cesMot: '03' });
    app.ctTerminarOk('C1');
    const c = app.contract('C1');
    igual(copia(c.fisco.cessacao), { data: '2022-12-31', motivo: '03' });
    assert.equal(c.end, '2022-12-31');
    assert.deepEqual(copia(c.fisco.renovacoes), []);
  });

  test('num contrato com redução a duração da renovação não se supõe: em branco, e a renovação escrita leva as rendas de 2026 ao 4.2 e a cessação ao quadro 10 de 2026', () => {
    const o = semEcra();
    monta({ start: '2021-01-01', end: '2025-12-31', rent: 3000 });
    rendas(2026, 3000, [1, 2, 3]);
    app.endContract('C1');
    assert.equal(valorDe(ultima(o).b, 'c_cesRenFim'), '', 'sem proposta');
    assert.match(ultima(o).b, /Vê no contrato quanto dura cada renovação: é a duração que decide a taxa do IRS\./);
    domCom({ c_cesRenov: '1', c_cesRenFim: '2030-12-31', c_cesData: '2026-03-31', c_cesMot: '02' });
    app.ctTerminarOk('C1');
    assert.deepEqual(o.erros, []);
    const c = app.contract('C1');
    igual(copia(c.fisco.renovacoes.map((r) => [r.inicio, r.fim])), [['2026-01-01', '2030-12-31']]);
    igual(copia(c.fisco.cessacao), { data: '2026-03-31', motivo: '02' });
    const r26 = app.resumoFiscal(2026, 'O1'), r25 = app.resumoFiscal(2025, 'O1');
    assert.equal(linha(r26, 'C1').quadro, '4.2', 'as rendas de 2026 com a redução da renovação');
    assert.ok(linha(r26, 'C1').taxa < 25);
    assert.deepEqual(copia(r26.cessados.map((x) => [x.contratoId, x.data, x.motivo])), [['C1', '2026-03-31', '02']], 'o quadro 10 de 2026');
    assert.deepEqual(copia(r25.cessados), [], 'e não o de 2025');
  });

  test('do formulário (desligar «Contrato em vigor»), a mesma pergunta e as renovações vão com o contrato gravado', () => {
    const o = semEcra();
    monta({ start: '2022-01-01', end: '2022-12-31' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    app.cForm.active = false;
    app.ctGravarOuCessar();
    assert.equal(ultima(o).t, 'Terminar contrato');
    assert.match(ultima(o).b, /id="sel_c_cesRenov"/);
    assert.match(ultima(o).f, /ctTerminarOk\(''\)/);
    domCom({ c_cesRenov: '1', c_cesRenFim: '2023-12-31', c_cesData: '2024-05-31', c_cesMot: '02' });
    app.ctTerminarOk('');
    const c = app.contract('C1');
    igual(copia(c.fisco.cessacao), { data: '2024-05-31', motivo: '02' });
    assert.equal(c.end, '2024-12-31');
    assert.equal(c.fisco.renovacoes.length, 2);
  });

  test('num imóvel fora de Portugal pergunta na mesma, sem citar o Código Civil', () => {
    const o = semEcra();
    monta({ start: '2022-01-01', end: '2022-12-31' });
    app.db.properties[0].pais = 'Espanha';
    app.endContract('C1');
    assert.match(ultima(o).b, /Se continuou depois disso, renovou-se: a renovação regista-se no contrato/);
    assert.doesNotMatch(ultima(o).b, /Código Civil/);
  });

  test('com um dia já dito (o fim que recuou e acabou antes do prazo), não se pergunta pela renovação', () => {
    const o = semEcra();
    monta({ start: '2021-01-01', end: '2025-12-31' });
    app.cForm = app.normContract(copia(app.contract('C1')));
    app.ctTerminarFolha(app.cForm, true, '2025-08-31');
    assert.doesNotMatch(ultima(o).b, /c_cesRenov/);
    assert.equal(valorDe(ultima(o).b, 'c_cesData'), '2025-08-31');
  });

  test('as renovações seguintes repetem a duração da primeira, em meses ou em dias', () => {
    const c = monta({ start: '2022-03-01', end: '2023-02-28' });
    igual(copia(app.ctRenovacoesAte(c, '2024-02-29', '2025-06-30')), [{ inicio: '2023-03-01', fim: '2024-02-29' }, { inicio: '2024-03-01', fim: '2025-02-28' }, { inicio: '2025-03-01', fim: '2026-02-28' }]);
    igual(copia(app.ctRenovacoesAte(c, '2023-04-14', '2023-05-20')), [{ inicio: '2023-03-01', fim: '2023-04-14' }, { inicio: '2023-04-15', fim: '2023-05-29' }]);
    igual(copia(app.ctRenovacoesAte(c, '2023-01-01', '2023-05-20')), [], 'o fim antes do início da renovação');
  });
});

describe('N084 — a devolução da caução no «Terminar contrato» e na ficha (D15)', () => {
  test('com a caução escrita no contrato, a folha tem «Já devolvi a caução», com o dia e o valor (a caução inteira por omissão)', () => {
    const o = semEcra();
    monta({ deposit: 2000 });
    app.endContract('C1');
    const f = ultima(o);
    assert.match(f.b, /<b>Já devolvi a caução<\/b><span class="small">Caução de 2\s000,00\s€: a devolução é um gasto do ano em que a devolves\.<\/span><\/span><input type="checkbox" role="switch" class="ct-sw" id="c_cesDev"/);
    assert.match(f.b, /<div id="c_devBox" hidden>/);
    assert.equal(valorDe(f.b, 'c_devValor'), '2000');
    assert.equal(valorDe(f.b, 'c_devDia'), '2026-09-10');
    conferir('terminar com caução', f.b, { obrigatorios: ['c_cesData', 'c_devDia', 'c_devValor'] });
    monta({ deposit: 0 });
    app.endContract('C1');
    assert.doesNotMatch(ultima(o).b, /c_cesDev/, 'sem caução, sem a pergunta');
  });

  test('ligado, terminar regista a despesa da devolução ligada ao contrato (pode ser parte), e a Declaração do ano deduz-a; o anular tira-a', () => {
    const o = semEcra();
    monta({ deposit: 2000 });
    rendas(2026, 1000, [1, 2, 3, 4, 5, 6, 7, 8]);
    domCom({ c_cesData: '2026-08-31', c_cesMot: '02', c_cesDev: true, c_devDia: '2026-09-05', c_devValor: '1500' });
    app.ctTerminarOk('C1');
    assert.deepEqual(o.erros, []);
    const d = app.db.transactions.filter((t) => t.kind === 'expense');
    assert.equal(d.length, 1);
    assert.equal(app.txCatIrsId(d[0], true), 'devolucoes/caucao');
    assert.equal(d[0].contractId, 'C1');
    assert.equal(d[0].amount, 1500);
    assert.equal(d[0].date, '2026-09-05');
    assert.equal(d[0].paidBy, 'O1', 'o dono único pagou');
    assert.match(o.avisos.pop(), /^Contrato terminado, e a devolução da caução registada\.$/);
    const l = linha(app.resumoFiscal(2026, 'O1'), 'C1');
    assert.equal(l.gastos.outros, 1500, 'a devolução é gasto do ano em que se devolve, mesmo depois do dia em que acabou');
    o.desfazer.pop()();
    assert.equal(app.db.transactions.filter((t) => t.kind === 'expense').length, 0);
    assert.equal(app.contract('C1').active, true);
  });

  test('o valor nunca passa da caução nem fica a zero; o dia nunca depois de hoje', () => {
    const o = semEcra();
    monta({ deposit: 2000 });
    domCom({ c_cesData: '2026-08-31', c_cesMot: '02', c_cesDev: true, c_devDia: '2026-09-05', c_devValor: '2500' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_devValor: A caução do contrato é de 2\s000,00\s€/);
    domCom({ c_cesData: '2026-08-31', c_cesMot: '02', c_cesDev: true, c_devDia: '2026-09-05', c_devValor: '' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_devValor: Indica quanto devolveste\.$/);
    domCom({ c_cesData: '2026-08-31', c_cesMot: '02', c_cesDev: true, c_devDia: '2026-09-30', c_devValor: '2000' });
    app.ctTerminarOk('C1');
    assert.match(o.erros.pop(), /^c_devDia: /);
    assert.equal(app.contract('C1').active, true, 'nada se gravou');
    // desligado, a devolução não se regista
    domCom({ c_cesData: '2026-08-31', c_cesMot: '02', c_cesDev: false, c_devDia: '2026-09-05', c_devValor: '2000' });
    app.ctTerminarOk('C1');
    assert.equal(app.db.transactions.length, 0);
    assert.equal(app.contract('C1').active, false);
  });

  test('a ficha de um contrato terminado com caução e sem devolução pergunta «Devolveste a caução?»; registada, a pergunta sai', () => {
    const o = semEcra();
    monta({ deposit: 1800, active: false, fisco: { cessacao: { data: '2026-06-30', motivo: '02' } } });
    let h = app.ctFicha('C1');
    assert.match(h, /Devolveste a caução\? A devolução é um gasto do ano em que a devolves/);
    assert.match(h, /data-click="ctDevolucaoCaucao\('C1'\)">Registar a devolução<\/button>/);
    app.ctDevolucaoCaucao('C1');
    assert.equal(ultima(o).t, 'Devolução da caução');
    assert.match(ultima(o).f, /data-click="ctDevolucaoCaucaoOk\('C1'\)">Registar</);
    conferir('devolução da caução', ultima(o).b, { obrigatorios: ['c_devDia', 'c_devValor'] });
    domCom({ c_devDia: '2026-07-15', c_devValor: '1800' });
    app.ctDevolucaoCaucaoOk('C1');
    assert.equal(app.db.transactions.length, 1);
    assert.equal(app.txCatIrsId(app.db.transactions[0], true), 'devolucoes/caucao');
    assert.equal(o.avisos.pop(), 'Devolução da caução registada.');
    h = app.ctFicha('C1');
    assert.doesNotMatch(h, /Devolveste a caução/);
    // em vigor, a ficha não pergunta; nem num que acabou há anos (a devolução foi num ano já entregue)
    monta({ deposit: 1800 });
    assert.doesNotMatch(app.ctFicha('C1'), /Devolveste a caução/);
    monta({ deposit: 1800, start: '2018-01-01', end: '2020-12-31', active: false });
    assert.doesNotMatch(app.ctFicha('C1'), /Devolveste a caução/);
  });

  test('com a categoria das devoluções com outro nome, a despesa nasce nela (pelo id)', () => {
    semEcra();
    monta({ deposit: 1000, active: false, fisco: { cessacao: { data: '2026-06-30', motivo: '02' } } });
    const st = app.db.settings, velho = 'Devoluções ao inquilino', novo = 'Devolvido aos inquilinos';
    st.cats[novo] = st.cats[velho]; delete st.cats[velho];
    for (const k of Object.keys(st.catIds.cats)) if (k === velho || k.startsWith(velho + ' / ')) { st.catIds.cats[novo + k.slice(velho.length)] = st.catIds.cats[k]; delete st.catIds.cats[k]; }
    domCom({ c_devDia: '2026-07-15', c_devValor: '1000' });
    app.ctDevolucaoCaucaoOk('C1');
    const t = app.db.transactions[0];
    assert.equal(t.category, novo);
    assert.equal(t.sub, 'Devolução da caução');
    assert.equal(app.txCatIrsId(t, true), 'devolucoes/caucao');
  });
});

describe('N100 — o motivo da cessação: obrigatório num declarado, e o quadro 10 só quando lá vai (D14)', () => {
  test('sem redução, o motivo continua obrigatório mas a frase não diz que o quadro 10 o pede', () => {
    const o = semEcra();
    const c = monta({ start: '2026-01-01', end: '2026-12-31' });
    app.endContract('C1');
    const f = ultima(o);
    assert.match(f.b, /Motivo <span class="req">\*<\/span>/);
    assert.doesNotMatch(f.b, /quadro 10 do Anexo F e a comunicação da cessação à AT pedem-no/);
    assert.match(f.b, /Fica registado no contrato\. Só vai ao quadro 10 do Anexo F quando o contrato tem redução da taxa pela duração ou isenção, e este não tem nenhuma das duas em 2026\./);
    const e = copia(app.ctCessacaoErro(c, '2026-08-31', '', app.ctMotivoExigido(c)));
    assert.deepEqual(e, { id: 'c_cesMot', msg: 'Escolhe o motivo por que o contrato acabou.' });
  });

  test('com redução, a frase e o erro dizem o quadro 10', () => {
    const o = semEcra();
    const c = monta({ start: '2024-03-01', end: '2029-02-28' });
    app.endContract('C1');
    assert.match(ultima(o).b, /O quadro 10 do Anexo F e a comunicação da cessação à AT pedem-no\./);
    assert.deepEqual(copia(app.ctCessacaoErro(c, '2026-08-31', '', true)), { id: 'c_cesMot', msg: 'Escolhe o motivo: o quadro 10 do Anexo F pede-o.' });
  });

  test('num imóvel fora de Portugal, fica registado: o Anexo J não o pede', () => {
    const c = monta({ start: '2026-01-01', end: '2026-12-31' });
    app.db.properties[0].pais = 'Espanha';
    assert.match(app.ctMotivoDica(c, '2026-08-31'), /Anexo J, que não o pede/);
    assert.equal(app.ctMotivoVaiAoAnexo(c, '2026-08-31'), '');
  });
});

describe('N034 — o inquilino empresa: só a identificação de quem lá mora (D16)', () => {
  const comNif = (nif, fisco) => {
    const c = monta({ fisco: Object.assign({ finalidade: 'hp' }, fisco || {}) });
    app.db.tenants[0].nif = nif;
    app.db.tenants[0].name = 'Empresa Lda';
    return c;
  };

  test('a pergunta é só a identificação, sem a sublocação', () => {
    comNif('503504564');
    app.cForm = app.normContract(copia(app.contract('C1')));
    const f = app.fiscoSect();
    assert.match(f, /<label>O contrato identifica pelo nome quem lá mora\?<div class="sel" id="sel_c_femp">/);
    assert.doesNotMatch(f, /sublocação|sublocar/);
    assert.match(f, /a AT só trata a renda como de habitação se o contrato identifica pelo nome a pessoa que lá mora/);
  });

  test('a resposta vai a fisco.empresaMorador; um «Não» antigo da pergunta junta volta a «por confirmar»', () => {
    comNif('503504564', { empresaHabitacao: false });
    assert.match(app.ctFicha('C1'), /<span>Inquilino empresa<\/span><b><span class="badge amber">Por confirmar<\/span><\/b>/, 'o «Não» antigo pode ser «identifica mas não proíbe»');
    app.cForm = app.normContract(copia(app.contract('C1')));
    assert.match(app.fiscoSect(), /<input type="hidden" id="c_femp" value="">/);
    domCom({ c_rent: '1000', c_femp: '0' });
    app.collectCt();
    assert.equal(app.cForm.fisco.empresaMorador, false);
    assert.equal(app.cForm.fisco.empresaHabitacao, false);
    domCom({ c_rent: '1000', c_femp: '1' });
    app.collectCt();
    assert.equal(app.cForm.fisco.empresaMorador, true);
    // um «Sim» antigo conta como «identifica»; «Não sei» apaga-o
    comNif('503504564', { empresaHabitacao: true });
    app.cForm = app.normContract(copia(app.contract('C1')));
    assert.match(app.fiscoSect(), /<input type="hidden" id="c_femp" value="1">/);
    domCom({ c_rent: '1000', c_femp: '' });
    app.collectCt();
    assert.equal(app.cForm.fisco.empresaMorador, null);
    assert.equal(app.cForm.fisco.empresaHabitacao, null);
  });

  test('com «Não», a ficha diz que a Declaração o conta como não habitacional, e a linha vai assim', () => {
    comNif('503504564', { empresaMorador: false });
    const h = app.ctFicha('C1');
    assert.match(h, /<span>Inquilino empresa<\/span><b>não identifica quem lá mora: para a AT é não habitacional<\/b>/);
    assert.match(h, /A Declaração conta este contrato como não habitacional: natureza 06, 28 %, sem a redução pela duração\./);
    rendas(2026, 1000, [1, 2, 3]);
    const l = linha(app.resumoFiscal(2026, 'O1'), 'C1');
    assert.equal(l.natureza, '06');
    assert.equal(l.quadro, '4.1');
    assert.equal(l.taxa, 28);
    comNif('503504564', { empresaMorador: true });
    assert.match(app.ctFicha('C1'), /<b>identifica quem lá mora<\/b>/);
  });
});

describe('N036 — apagar um contrato ou um inquilino com rendas por entregar', () => {
  test('apagar um contrato em vigor com rendas de 2026 diz o valor e o que a Declaração perde, e propõe terminá-lo', () => {
    const o = semEcra();
    monta({ start: '2024-01-01', end: '2026-12-31', rent: 900 });
    rendas(2026, 900, [1, 2, 3, 4, 5, 6, 7, 8]);
    app.delContract('C1');
    const b = ultima(o).b;
    assert.equal(ultima(o).t, 'Apagar contrato');
    assert.match(b, /As rendas de 2026 deste contrato \(7\s200,00\s€\) ficam sem contrato, e a Declaração do IRS desse ano, ainda por entregar, perde a linha dele: a taxa e as datas\./);
    assert.match(b, /Se o contrato acabou, termina-o em vez de o apagar/);
    assert.match(b, /data-click="closeModal\(\);endContract\('C1'\)">Terminar contrato<\/button>/);
  });

  test('terminado, diz também a cessação, e não propõe terminar; não declarado, nada', () => {
    const o = semEcra();
    monta({ start: '2024-01-01', end: '2026-12-31', rent: 900, active: false, fisco: { cessacao: { data: '2026-08-31', motivo: '02' } } });
    rendas(2026, 900, [1, 2, 3, 4, 5, 6, 7, 8]);
    app.delContract('C1');
    assert.match(ultima(o).b, /perde a linha dele: a taxa, as datas e a cessação\. Já está terminado: assim, fica na Declaração com o dia em que acabou\./);
    assert.doesNotMatch(ultima(o).b, /endContract/);
    monta({ fisco: { estado: 'naoDeclarado' } });
    rendas(2026, 900, [1, 2]);
    app.delContract('C1');
    assert.equal(ultima(o).b, 'Apagar o contrato de Ana? Os movimentos ficam, mas deixam de estar ligados a ele.');
  });

  test('apagar o inquilino de um contrato com rendas por entregar diz que a linha fica sem ele, com o plural certo', () => {
    const o = semEcra();
    monta({ start: '2024-01-01', end: '2026-12-31', rent: 900 });
    rendas(2026, 900, [1, 2, 3, 4, 5, 6, 7, 8]);
    app.delPerson('tenant', 'T1');
    const b = ultima(o).b;
    assert.match(b, /^Apagar “Ana”\? Sai de 1 contrato, que se mantém\. /);
    assert.match(b, /A Declaração do IRS de 2026, ainda por entregar, tem rendas do contrato «Ana · T2» \(7\s200,00\s€\): sem esta ficha, a linha dele fica sem este inquilino, e o Anexo F pede o NIF dele\. Guarda-a até entregares essa declaração\./);
    assert.match(b, /data-click="closeModal\(\);endContract\('C1'\)">Terminar contrato<\/button>/);
    // sem rendas por entregar, só a frase de sempre
    monta();
    app.delPerson('tenant', 'T1');
    assert.equal(ultima(o).b, 'Apagar “Ana”? Sai de 1 contrato, que se mantém.');
  });
});

describe('N097 — o prazo da cessação só dos anos que ainda pesam', () => {
  test('um contrato terminado em 2021 sem o dia da cessação não acende o prazo; a ficha diz, sem alarme, que se comunica', () => {
    monta({ start: '2019-01-01', end: '2021-12-31', active: false });
    assert.deepEqual(copia(app.prazosDe('2026-09-10').filter((p) => p.tipo === 'cessacao')), []);
    assert.match(app.ctAtDaFicha(app.contract('C1')), /O contrato acabou a 31\/12\/2021: a cessação comunica-se à AT até ao fim do mês seguinte \(o Modelo 2 também serve\)\. Se nunca a comunicaste, ainda o deves fazer\./);
  });

  test('o mesmo limite com o dia da cessação; a do ano anterior continua', () => {
    monta({ start: '2019-01-01', end: '2024-12-31', active: false, fisco: { cessacao: { data: '2022-03-31', motivo: '02' } } });
    assert.deepEqual(copia(app.prazosDe('2026-09-10').filter((p) => p.tipo === 'cessacao')), []);
    monta({ start: '2019-01-01', end: '2025-12-31', active: false, fisco: { cessacao: { data: '2025-06-30', motivo: '02' } } });
    assert.deepEqual(copia(app.prazosDe('2026-09-10').filter((p) => p.tipo === 'cessacao').map((p) => p.alvo)), ['2025-07-31']);
    assert.doesNotMatch(app.ctAtDaFicha(app.contract('C1')), /Se nunca a comunicaste/);
  });
});

describe('N003 — a comunicação por confirmar responde-se na ficha: o dia antigo, outro dia, ou «Não comuniquei»', () => {
  /* um contrato com redução de 2025 e a marca da app antiga (comunicada todos os anos) a 10/03/2026, depois do prazo
     do período (15/02/2026): a migração deixa-a por confirmar */
  const comMarcaAntiga = () => monta({ start: '2025-03-01', end: '2030-02-28', fisco: { comunicacoes: { 2026: '2026-03-10' } } });

  test('a ficha pergunta se se comunicou até ao prazo, com o dia antigo como sugestão e os três botões', () => {
    const c = comMarcaAntiga();
    assert.deepEqual(copia(c.fisco.comunicacoesPorConfirmar), { 2025: '2026-03-10' }, 'a migração deixou-a por confirmar');
    const h = app.ctAtDaFicha(c);
    assert.match(h, /Comunicaste a duração do contrato no Portal das Finanças até 15\/02\/2026\? A app antiga marcou-a a 10\/03\/2026, mas essa marca não diz quando a comunicaste\./);
    assert.match(h, /data-click="ctResolverComunicacao\('C1',2025,1\)">Comuniquei a 10\/03\/2026<\/button>/);
    assert.match(h, /data-click="ctComunicadaPergunta\('C1',2025\)">Noutro dia<\/button>/);
    assert.match(h, /data-click="ctResolverComunicacao\('C1',2025,0\)">Não comuniquei<\/button>/);
    assert.doesNotMatch(h, /Marcar como comunicada/);
  });

  test('«Não comuniquei» tira a pergunta e o período fica por comunicar', () => {
    const o = semEcra();
    comMarcaAntiga();
    app.ctResolverComunicacao('C1', 2025, 0);
    const c = app.contract('C1');
    assert.equal(c.fisco.comunicacoesPorConfirmar, undefined);
    assert.deepEqual(copia(c.fisco.comunicacoes), {});
    assert.match(o.avisos.pop(), /^Fica por comunicar: no quadro 4\.2A a resposta é NÃO\./);
    const h = app.ctAtDaFicha(c);
    assert.match(h, /A duração do contrato está por comunicar no Portal das Finanças: o prazo era 15\/02\/2026\./);
    assert.match(h, />Marcar como comunicada</);
  });

  test('«Comuniquei a …» grava o dia antigo (depois do prazo, o 4.2A é NÃO); «Noutro dia» grava o dia escrito', () => {
    const o = semEcra();
    comMarcaAntiga();
    app.ctResolverComunicacao('C1', 2025, 1);
    let c = app.contract('C1');
    assert.deepEqual(copia(c.fisco.comunicacoes), { 2025: '2026-03-10' });
    assert.equal(c.fisco.comunicacoesPorConfirmar, undefined);
    assert.match(o.avisos.pop(), /^Comunicação marcada a 10\/03\/2026, depois do prazo: no quadro 4\.2A a resposta é NÃO\.$/);
    assert.match(app.ctAtDaFicha(c), /A duração do contrato foi comunicada no Portal das Finanças a 10\/03\/2026, depois do prazo \(15\/02\/2026\)/);
    comMarcaAntiga();
    domCom({ c_comdia: '2026-02-01' });
    app.ctMarcarComunicada('C1', 2025, 1);
    c = app.contract('C1');
    assert.deepEqual(copia(c.fisco.comunicacoes), { 2025: '2026-02-01' });
    assert.equal(c.fisco.comunicacoesPorConfirmar, undefined, 'com o dia escrito, a pergunta já está respondida');
  });
});

describe('N099 — a dica dos encargos a cargo do inquilino diz só o que acontece', () => {
  test('nomeia o IMI, o condomínio e o seguro da ficha, e não promete a água, a luz e o gás', () => {
    const h = app.ctEncargosCampos(monta());
    assert.match(h, /os planeados do IMI e do condomínio deste imóvel, e o do seguro da ficha do imóvel, ficam suspensos/);
    assert.match(h, /Os da água, da luz e do gás, e um seguro adicionado à mão, continuam a pedir-se/);
    assert.doesNotMatch(h, /o planeado desse encargo neste imóvel fica suspenso/);
  });
});
