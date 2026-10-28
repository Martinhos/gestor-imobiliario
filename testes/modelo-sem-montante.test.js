// Num modelo que se guarda sozinho o montante é opcional: o rótulo vem sem
// asterisco e o campo diz «Opcional»; guardar vazio grava o modelo com
// montante 0, sem a distribuição da prestação e sem comparar a divisão por
// valores com um total que não há (as percentagens conferem-se na mesma).
// Guardar o modelo E registar o movimento, registar um movimento e criar um
// planeado continuam a pedir o montante. Alterar um modelo sem montante não o
// volta a sugerir, e usá-lo abre o movimento com o campo vazio e a validação
// de sempre.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

/* dois donos num imóvel com hipoteca e contrato, e um segundo imóvel só da Ana;
   um modelo com montante (a Luz) e uma despesa já registada */
function comTudo() {
  const app = carregarTudo();
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana' }), app.normPerson({ id: 'O2', name: 'Rui' })];
  app.db.properties = [
    app.normProp({ id: 'P1', name: 'T2 Lisboa', ownerIds: ['O1', 'O2'], loans: [{ id: 'L1', name: 'Aquisição', outstanding: 50000, years: 20, rate: 3, start: '2020-01-10' }] }),
    app.normProp({ id: 'P2', name: 'T1 Porto', ownerIds: ['O1'] }),
  ];
  app.db.contracts = [app.normContract({ id: 'C1', name: 'Arrendamento', propertyId: 'P1', rent: 800, start: '2024-01-01' })];
  app.db.transactions = [app.normTx({ id: 'T1', kind: 'expense', label: 'Condomínio', amount: 55, propertyId: 'P1', date: '2026-03-12' })];
  app.db.templates = [app.normTpl({ id: 'M1', name: 'Luz', tx: { kind: 'expense', label: 'Luz', amount: 30, propertyId: 'P1' } })];
  app.definirServicosDesligados([]);
  return app;
}

/* as janelas numa pilha, o toast e o campo em falta numa lista cada um */
function preparar(app) {
  const abertas = janelasFalsas(app, 'render', 'buildNav', 'save', 'refreshDetail');
  const toasts = [], falhas = [];
  app.toast = (m) => { toasts.push(m); };
  app.falhaCampo = (id, msg) => { falhas.push([id, msg]); };
  return { abertas, toasts, falhas };
}

/* escreve os campos do formulário no DOM falso, como se o utilizador os preenchesse */
function preencher(app, campos) {
  for (const [id, v] of Object.entries(campos)) app.document.getElementById(id).value = v;
}

/* o rótulo, o placeholder e o valor do montante no HTML do formulário */
function montante(b) {
  return {
    asterisco: /<label>Montante \(€\) <span class="req">\*<\/span><div class="mov-montante">/.test(b),
    semAsterisco: /<label>Montante \(€\)<div class="mov-montante">/.test(b),
    placeholder: (b.match(/<input id="t_amount"[^>]*placeholder="([^"]*)"/) || [])[1],
    valor: (b.match(/<input id="t_amount"[^>]*value="([^"]*)"/) || [])[1],
    dica: b.includes('Em branco, escreves o montante quando usares o modelo.'),
  };
}

const copia = (x) => JSON.parse(JSON.stringify(x));

describe('modelo com montante opcional', () => {
  test('no modelo novo o montante vem sem asterisco e diz «Opcional»; nos outros modos, obrigatório e com o exemplo', () => {
    const app = comTudo();
    const { abertas } = preparar(app);
    app.txModal({ kind: 'expense', modo: 'tpl' });
    const m = montante(abertas[0].b);
    assert.equal(m.semAsterisco, true, 'sem o asterisco no rótulo');
    assert.equal(m.asterisco, false);
    assert.equal(m.placeholder, 'Opcional');
    assert.equal(m.dica, true, 'diz o que acontece em branco');
    const outros = [
      { kind: 'expense', modo: 'tpl', alsoTx: true },
      { kind: 'expense', propId: 'P1' },
      { kind: 'expense', modo: 'rec', every: 'month' },
    ];
    outros.forEach((o, i) => {
      app.txModal(o);
      const x = montante(abertas[i + 1].b);
      assert.equal(x.asterisco, true, JSON.stringify(o) + ': com asterisco');
      assert.equal(x.placeholder, 'Ex: 80', JSON.stringify(o) + ': com o exemplo');
      assert.equal(x.dica, false, JSON.stringify(o) + ': sem a dica do modelo');
    });
  });

  test('guardar um modelo sem montante grava-o com montante 0 e não regista movimento nenhum', () => {
    const app = comTudo();
    const { toasts, falhas } = preparar(app);
    app.txModal({ kind: 'expense', modo: 'tpl' });
    preencher(app, { t_prop: 'P1', t_label: 'Água', t_amount: '', t_tplName: 'Água do T2' });
    app.txGuardar(null);
    assert.deepEqual(falhas, [], 'nenhum campo em falta');
    assert.deepEqual(toasts, ['Modelo adicionado.']);
    assert.equal(app.db.templates.length, 2);
    const novo = copia(app.db.templates[1]);
    assert.equal(novo.name, 'Água do T2');
    assert.equal(novo.tx.amount, 0, 'grava amount: 0');
    assert.equal(novo.tx.label, 'Água');
    assert.equal(novo.tx.propertyId, 'P1');
    assert.equal(app.db.transactions.length, 1, 'não regista movimento');
    /* e a descrição continua obrigatória */
    app.txModal({ kind: 'expense', modo: 'tpl' });
    preencher(app, { t_prop: 'P1', t_label: '', t_amount: '' });
    app.txGuardar(null);
    assert.deepEqual(falhas, [['t_label', 'Escreve uma descrição.']]);
    assert.equal(app.db.templates.length, 2);
  });

  test('guardar o modelo E registar, registar um movimento e criar um planeado pedem o montante', () => {
    const app = comTudo();
    const { falhas } = preparar(app);
    const modos = [
      { kind: 'expense', modo: 'tpl', alsoTx: true },
      { kind: 'expense', propId: 'P1' },
      { kind: 'expense', modo: 'rec', every: 'month' },
    ];
    for (const o of modos) {
      app.txModal(o);
      preencher(app, { t_prop: 'P1', t_label: 'Água', t_amount: '', t_date: '2026-04-01' });
      app.txGuardar(null);
    }
    assert.deepEqual(falhas, modos.map(() => ['t_amount', 'Indica um montante.']));
    assert.equal(app.db.templates.length, 1, 'nenhum modelo novo');
    assert.equal(app.db.transactions.length, 1, 'nenhum movimento novo');
    assert.equal((app.db.recurring || []).length, 0, 'nenhum planeado novo');
    /* com montante, guardar o modelo E registar faz as duas coisas, como antes */
    app.txModal({ kind: 'expense', modo: 'tpl', alsoTx: true });
    preencher(app, { t_prop: 'P1', t_label: 'Água', t_amount: '42', t_date: '2026-04-01' });
    app.txGuardar(null);
    assert.equal(app.db.templates.length, 2);
    assert.equal(app.db.templates[1].tx.amount, 42);
    assert.equal(app.db.transactions.length, 2);
    assert.equal(app.db.transactions[1].amount, 42);
  });

  test('um modelo de prestação sem montante grava-se sem distribuição; o que já tinha uma perde-a', () => {
    const app = comTudo();
    const { toasts, falhas } = preparar(app);
    app.txModal({ kind: 'loan', modo: 'tpl', propId: 'P1' });
    preencher(app, { t_prop: 'P1', t_loan: 'L1', t_label: 'Prestação', t_amount: '' });
    app.txGuardar(null);
    assert.deepEqual(falhas, []);
    assert.deepEqual(toasts, ['Modelo adicionado.'], 'e não «Juros e selo ultrapassam o montante»');
    const tx = copia(app.db.templates[1].tx);
    assert.equal(tx.amount, 0);
    assert.equal(tx.loanId, 'L1');
    for (const k of ['interest', 'stamp', 'principal', 'fee']) assert.ok(!tx[k], k + ' fica de fora: ' + tx[k]);
    /* um modelo de prestação com montante e distribuição, alterado para ficar sem montante */
    app.db.templates.push(app.normTpl({ id: 'M2', name: 'Prestação', tx: { kind: 'loan', label: 'Prestação', amount: 400, propertyId: 'P1', loanId: 'L1', interest: 90, stamp: 3.6, principal: 306.4 } }));
    app.editTpl('M2');
    preencher(app, { t_prop: 'P1', t_loan: 'L1', t_label: 'Prestação', t_amount: '' });
    app.txGuardar(null);
    const m2 = copia(app.db.templates.find((x) => x.id === 'M2').tx);
    assert.equal(m2.amount, 0);
    for (const k of ['interest', 'stamp', 'principal', 'fee']) assert.ok(!m2[k], k + ' sai com o montante: ' + m2[k]);
    assert.equal(toasts.at(-1), 'Modelo atualizado.');
    /* com montante, a prestação reparte-se como sempre */
    app.txModal({ kind: 'loan', modo: 'tpl', propId: 'P1' });
    preencher(app, { t_prop: 'P1', t_loan: 'L1', t_label: 'Prestação', t_amount: '400', t_int: '', t_cap: '' });
    app.txGuardar(null);
    const com = copia(app.db.templates.at(-1).tx);
    assert.equal(com.amount, 400);
    assert.ok(com.interest > 0 && com.principal > 0, 'juros e capital calculados');
    assert.ok(Math.abs(com.interest + com.stamp + com.principal - 400) < 0.011, 'somam o montante');
  });

  test('sem montante, a divisão por valores não se compara com o total; as percentagens conferem-se na mesma', () => {
    const app = comTudo();
    const { toasts } = preparar(app);
    const guardar = (campos) => {
      app.txModal({ kind: 'expense', modo: 'tpl', propId: 'P1' });
      /* o seletor do modo grava-o no tForm ao mudar (setSplitMode), antes de se escreverem as partes */
      app.tForm.split = { mode: campos.t_split, parts: {} };
      preencher(app, Object.assign({ t_prop: 'P1', t_label: 'Obras', t_amount: '', t_sp_O1: '', t_sp_O2: '' }, campos));
      app.txGuardar(null);
      return toasts.at(-1);
    };
    assert.equal(guardar({ t_split: 'amount', t_sp_O1: '30', t_sp_O2: '20' }), 'Modelo adicionado.', 'valores sem total');
    assert.deepEqual(copia(app.db.templates.at(-1).tx.split), { mode: 'amount', parts: { O1: 30, O2: 20 } });
    assert.equal(guardar({ t_split: 'adjust', t_sp_O1: '10', t_sp_O2: '0' }), 'Modelo adicionado.', 'ajustes sem total');
    assert.equal(guardar({ t_split: 'adjust', t_sp_O1: '-5', t_sp_O2: '0' }), 'Os ajustes não podem ser negativos: um ajuste é sempre um extra.');
    assert.equal(guardar({ t_split: 'percent', t_sp_O1: '60', t_sp_O2: '30' }), 'As percentagens têm de somar 100 (somam 90).');
    assert.match(guardar({ t_split: 'amount', t_sp_O1: '30', t_sp_O2: '20', t_amount: '100' }), /^Os valores da divisão têm de somar 100,00\s€\.$/, 'com montante, como sempre');
    assert.equal(app.db.templates.length, 3, 'só os dois primeiros se gravaram');
  });

  test('sem montante, a divisão por imóvel em valores também espera pelo total', () => {
    const app = comTudo();
    const { toasts } = preparar(app);
    const guardar = (campos) => {
      app.txModal({ kind: 'expense', modo: 'tpl' });
      preencher(app, Object.assign({ t_prop: '*', t_label: 'Seguro', t_amount: '', t_split: '', t_psplit: '', t_pp_P1: '', t_pp_P2: '' }, campos));
      app.txGuardar(null);
      return toasts.at(-1);
    };
    assert.equal(guardar({ t_psplit: 'amount', t_pp_P1: '70', t_pp_P2: '30' }), 'Modelo adicionado.');
    const tx = copia(app.db.templates.at(-1).tx);
    assert.equal(tx.todos, true);
    assert.equal(tx.amount, 0);
    assert.deepEqual(tx.psplit, { mode: 'amount', parts: { P1: 70, P2: 30 } });
    assert.equal(guardar({ t_psplit: 'percent', t_pp_P1: '70', t_pp_P2: '20' }), 'As percentagens por imóvel têm de somar 100 (somam 90).');
    assert.match(guardar({ t_psplit: 'amount', t_pp_P1: '70', t_pp_P2: '20', t_amount: '100' }), /^Os valores por imóvel têm de somar 100,00\s€\.$/, 'com montante, como sempre');
  });

  test('alterar um modelo sem montante abre o campo vazio e não volta a sugerir a renda', () => {
    const app = comTudo();
    const { abertas } = preparar(app);
    app.db.templates.push(app.normTpl({ id: 'M3', name: 'Renda', tx: { kind: 'income', label: 'Renda', amount: 0, propertyId: 'P1', contractId: 'C1' } }));
    app.editTpl('M3');
    const m = montante(abertas[0].b);
    assert.equal(m.valor, '', 'sem a renda do contrato');
    assert.equal(m.semAsterisco, true);
    assert.equal(m.placeholder, 'Opcional');
    assert.equal(app.tForm.amount, 0);
    /* um modelo novo com contrato continua a sugerir a renda, e o modelo com montante mostra o seu */
    app.txModal({ kind: 'income', modo: 'tpl', propId: 'P1', ctId: 'C1' });
    assert.equal(montante(abertas[1].b).valor, '800,00');
    app.editTpl('M1');
    assert.equal(montante(abertas[2].b).valor, '30,00');
  });

  test('usar um modelo sem montante abre o movimento com o campo vazio e a validação de sempre', () => {
    const app = comTudo();
    const { abertas, toasts, falhas } = preparar(app);
    app.db.templates.push(app.normTpl({ id: 'M4', name: 'Água', tx: { kind: 'expense', label: 'Água', amount: 0, propertyId: 'P1' } }));
    app.newFromTemplate('M4');
    const m = montante(abertas.at(-1).b);
    assert.equal(m.valor, '', 'o 0 não aparece no campo');
    assert.equal(m.asterisco, true, 'no movimento o montante é obrigatório');
    assert.equal(m.placeholder, 'Ex: 80');
    assert.equal(app.tForm.label, 'Água');
    preencher(app, { t_prop: 'P1', t_label: 'Água', t_amount: '', t_date: '2026-04-02' });
    app.txGuardar(null);
    assert.deepEqual(falhas, [['t_amount', 'Indica um montante.']]);
    assert.equal(app.db.transactions.length, 1);
    preencher(app, { t_amount: '37,5' });
    app.txGuardar(null);
    assert.equal(toasts.at(-1), 'Movimento adicionado.');
    assert.equal(app.db.transactions.length, 2);
    assert.equal(app.db.transactions[1].amount, 37.5);
    assert.equal(app.db.transactions[1].label, 'Água');
    /* aplicar o modelo a um movimento já aberto também deixa o campo vazio */
    app.txModal({ kind: 'expense', propId: 'P1' });
    app.repaintTx = () => {};
    app.applyTemplate(app.db.templates.find((x) => x.id === 'M4'));
    assert.equal(app.txMontanteNoCampo(app.tForm.amount), '');
  });
});
