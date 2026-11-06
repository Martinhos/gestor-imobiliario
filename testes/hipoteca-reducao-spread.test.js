// A «Redução de spread» de uma hipoteca: um spread mais baixo durante os
// primeiros meses do crédito, que a pessoa adiciona como produto facultativo
// (com quanto baixa e durante quantos meses) e liga ou desliga como os
// outros. Os meses contam-se pelo relógio da taxa (credito.js:rateAt — o mês
// do crédito das prestações registadas, o mesmo da fase fixa da mista):
// enquanto dura, o spread desce; acabada, a prestação volta a subir. Na mista
// baixa só o spread, nunca a taxa fixa; na fixa não faz nada; sem os meses
// não conta, e o Guardar pede-os junto ao campo.
// Aqui: o modelo (dados.js:normProduto), as contas (rateAt, amort, loanCalc,
// a taxa por extenso), o formulário (imovel.js:loanProdLinha, a frase da
// taxa em vigor, o collectProp, mudar de tipo, adicionar), o Guardar sem
// meses, a caixa da simulação, a ficha, o planeado da prestação e o aviso
// dos prazos.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { PRODUTOS } from '../worker/src/lib/fine.js';

const HOJE = '2026-09-06';
const app = carregarApp({ hoje: HOJE });

let repintou, gravou, avisos;

/* Uma variável de 3 % + 1 %, 150 000 € a 30 anos, que começou a 10 de
   setembro de 2026 (sem prestações registadas: o mês do crédito é o 0). */
const hip = (extra = {}) => app.normLoan(Object.assign({ id: 'a', name: 'Aquisição', outstanding: 150000, capitalInicio: 150000, years: 30,
  type: 'variavel', index: '6m', euribor: 3, spread: 1, rate: 2, fixedYears: 5, start: '2026-09-10', stampTax: false }, extra));
/* A redução de 0,5 pontos nos primeiros 12 meses, ligada. */
const reducao = (extra = {}) => Object.assign({ id: 'pr', tipo: 'reducao_spread', spread: 0.5, tan: null, meses: 12, ativo: true }, extra);
const seguro = (extra = {}) => Object.assign({ id: 'pv', tipo: 'seguro_vida', spread: 0.25, tan: 0.2, ativo: true }, extra);

/* A casa p1 com a hipoteca, na base e no formulário (uma cópia, como o
   propModal a faz).
   Devolve: a hipoteca do formulário. */
function casa(extra = {}) {
  const p = app.normProp({ id: 'p1', name: 'Casa', loans: [hip(extra)] });
  app.db.properties.push(p);
  app.pForm = app.normProp(JSON.parse(JSON.stringify(p)));
  return app.findLoan(app.pForm, 'a');
}
const L = () => app.findLoan(app.pForm, 'a');
const Lbase = () => app.findLoan(app.prop('p1'), 'a');
/* n prestações registadas na hipoteca a (de 2025, para nenhuma cair no mês de hoje). */
const registadas = (n) => {
  for (let i = 0; i < n; i++) {
    app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'a', propertyId: 'p1', payType: 'prestacao', amount: 600, principal: 0, interest: 0,
      date: '2025-' + String((i % 12) + 1).padStart(2, '0') + '-10' }));
  }
};

beforeEach(() => {
  limpar(app);
  repintou = 0; gravou = 0; avisos = [];
  app.render = () => {};
  app.buildNav = () => {};
  app.toast = (m) => { avisos.push(m); };
  app.save = () => { gravou++; };
  app.repaintProp = () => { repintou++; };
  app.pode = () => true;
});
afterEach(() => repor(app));

describe('o modelo', () => {
  test('a «Redução de spread» está na lista, antes do «Outro produto»; o resto é a lista do servidor, pela mesma ordem', () => {
    const ids = app.PRODUTOS_HIPOTECA.map((p) => p.id);
    igual(ids.slice(-2), ['reducao_spread', 'outro']);
    igual(app.produtoNome('reducao_spread'), 'Redução de spread');
    igual(ids.filter((id) => id !== 'reducao_spread'), PRODUTOS.map((p) => p.id), 'a FINE não a oferece ao modelo');
    igual(app.PRODUTOS_HIPOTECA.filter((p) => p.id !== 'reducao_spread').map((p) => p.nome), PRODUTOS.map((p) => p.nome));
  });
  test('os meses normalizam: um inteiro de 1 a 600, só na redução de spread; nos outros tipos, null', () => {
    const l = app.normLoan({ produtos: [
      reducao(), reducao({ id: 'r2', meses: '12' }), reducao({ id: 'r3', meses: 0 }), reducao({ id: 'r4', meses: 12.5 }),
      reducao({ id: 'r5', meses: 600 }), reducao({ id: 'r6', meses: 601 }), reducao({ id: 'r7', meses: undefined }),
      seguro({ meses: 12 }),
    ] });
    igual(l.produtos.map((p) => [p.id, p.tipo, p.meses]), [
      ['pr', 'reducao_spread', 12], ['r2', 'reducao_spread', null], ['r3', 'reducao_spread', null], ['r4', 'reducao_spread', null],
      ['r5', 'reducao_spread', 600], ['r6', 'reducao_spread', null], ['r7', 'reducao_spread', null], ['pv', 'seguro_vida', null],
    ]);
    igual(Object.keys(app.normProduto({})).sort(), ['ativo', 'id', 'meses', 'spread', 'tan', 'tipo']);
    igual([app.produtoMeses(1), app.produtoMeses(-3), app.produtoMeses(NaN), app.produtoMeses(null)], [1, null, null, null]);
  });
});

describe('as contas', () => {
  test('na variável de 3 % + 1 %: ligada, os meses 0 a 11 a 3,5 % e o 12 a 4 %; a prestação sobe no mês 12', () => {
    const l = hip({ produtos: [reducao()] });
    for (let m = 0; m < 12; m++) igual(app.rateAt(l, m), 3.5, 'mês ' + m);
    igual(app.rateAt(l, 12), 4);
    igual(app.rateAt(l, 200), 4);
    const a = app.amort(l);
    igual([a.rows[0].rate, a.rows[11].rate, a.rows[12].rate], [3.5, 3.5, 4]);
    assert.ok(a.rows[12].pay > a.rows[11].pay + 1, 'a prestação volta a subir: ' + a.rows[11].pay + ' → ' + a.rows[12].pay);
    igual(a.rows[11].pay, a.rows[0].pay, 'durante a redução, a mesma');
    const sem = app.amort(hip());
    assert.ok(a.rows[0].pay < sem.rows[0].pay, 'a de agora desce');
    igual(app.spreadEmVigor(l), 0.5, 'o spread deste mês');
    igual(app.spreadEmVigor(l, 12), 1);
  });
  test('desligada, ou sem meses, 4 % sempre', () => {
    for (const p of [reducao({ ativo: false }), reducao({ meses: null }), reducao({ meses: 0 })]) {
      const l = hip({ produtos: [p] });
      igual([app.rateAt(l, 0), app.rateAt(l, 11), app.rateAt(l, 12)], [4, 4, 4], JSON.stringify(p));
      igual(app.spreadEmVigor(l), 1);
      igual(app.produtosQueBaixam(l).length, 0);
    }
  });
  test('na mista, a fase fixa não muda: a redução não baixa a taxa fixa (nem pela regra do spread)', () => {
    const l = hip({ type: 'mista', produtos: [reducao()] });
    igual(app.taxaFixaEmVigor(l), 2, 'a regra «sem redução na taxa fixa baixa-a como o spread» não se lhe aplica');
    for (const m of [0, 11, 12, 59]) igual(app.rateAt(l, m), 2, 'mês ' + m);
    igual(app.rateAt(l, 60), 4, 'com 12 meses, acabou antes da fase variável');
    igual(app.produtosQueBaixam(l).length, 0, 'não baixa nada');
    igual(app.amort(l).rows[0].pay, app.amort(hip({ type: 'mista' })).rows[0].pay, 'a prestação de agora é a mesma');
    const longa = hip({ type: 'mista', produtos: [reducao({ meses: 72 })] });
    igual([app.rateAt(longa, 59), app.rateAt(longa, 60), app.rateAt(longa, 71), app.rateAt(longa, 72)], [2, 3.5, 3.5, 4]);
    igual(app.spreadEmVigor(longa), 0.5, 'o spread de quando a fase variável começa');
    const a = app.amort(longa);
    assert.ok(a.rows[72].pay > a.rows[71].pay, 'e a prestação sobe no fim da redução');
  });
  test('na fixa não faz nada', () => {
    const l = hip({ type: 'fixa', rate: 3.2, produtos: [reducao()] });
    igual([app.rateAt(l, 0), app.rateAt(l, 12)], [3.2, 3.2]);
    igual(app.taxaFixaEmVigor(l), 3.2);
    igual(app.produtosQueBaixam(l).length, 0);
    igual(app.mudancasDaPrestacao(l), []);
  });
  test('o relógio são as prestações registadas: com 11, ainda 3,5 %; com 12, 4 %', () => {
    casa({ produtos: [reducao()] });
    registadas(11);
    igual(app.loanCalc(Lbase()).rate, 3.5);
    igual(app.spreadEmVigor(Lbase()), 0.5);
    igual(app.rateLabel(Lbase()), 'Euribor 6m 3% + 0,5% = 3,5% com um produto');
    registadas(1);
    igual(app.loanCalc(Lbase()).rate, 4);
    igual(app.spreadEmVigor(Lbase()), 1);
    igual(app.rateLabel(Lbase()), 'Euribor 6m 3% + 1% = 4%', 'acabada, já não conta');
  });
  test('as mudanças da prestação por vir, e o dia em que a redução acaba (o relógio da fase fixa)', () => {
    igual(app.mudancasDaPrestacao(hip({ produtos: [reducao()] })), [{ m: 12, tipo: 'reducao' }]);
    igual(app.mudancasDaPrestacao(hip({ type: 'mista', produtos: [reducao()] })), [{ m: 60, tipo: 'fixa' }]);
    igual(app.mudancasDaPrestacao(hip({ type: 'mista', produtos: [reducao({ meses: 72 })] })), [{ m: 60, tipo: 'fixa' }, { m: 72, tipo: 'reducao' }]);
    casa({ produtos: [reducao()] });
    igual(app.fimDaReducaoMes(Lbase()), 12);
    igual(app.fimDaReducao(Lbase(), app.db.transactions, HOJE, ''), '2027-09-10', 'a de setembro de 2026 é o mês 0');
    igual(app.fimDaReducao(Lbase(), app.db.transactions, HOJE, '2026-10-10'), '2027-10-10', 'com a próxima por confirmar em outubro');
    registadas(12);
    igual(app.fimDaReducao(Lbase(), app.db.transactions, HOJE, ''), '', 'já acabou');
  });
});

describe('o formulário', () => {
  test('a linha da redução: o spread e «Durante (meses)» obrigatório, numérico, «Ex: 12»; sem a TAN, mesmo na mista', () => {
    let h = app.loanSect(casa({ produtos: [reducao()] }), 0);
    assert.match(h, /<label>Baixa o spread em \(%\)<input id="l_pspr_pr" type="text" inputmode="decimal" value="0,5"/);
    assert.match(h, /<label>Durante \(meses\) <span class="req">\*<\/span><input id="l_pmes_pr" type="text" inputmode="numeric" value="12" placeholder="Ex: 12" autocomplete="off" data-input="liveLoan\('a'\)"><\/label>/);
    assert.match(h, /id="lab_l_ptipo_pr">Redução de spread</);
    assert.ok(!/ style=| on[a-z]+=/i.test(h), 'sem style= nem on…= (a CSP)');
    limpar(app);
    h = app.loanSect(casa({ type: 'mista', produtos: [reducao(), seguro()] }), 0);
    assert.ok(!/l_ptan_pr/.test(h), 'a redução de spread não baixa a taxa fixa');
    assert.match(h, /l_ptan_pv/, 'os outros produtos continuam com as duas');
    assert.match(h, /A redução de spread não segue esta regra: baixa só o spread, e só nos meses dela, contados desde o início\./);
    assert.ok(!/l_pmes_pv/.test(h), 'os meses são só da redução');
  });
  test('na fixa o tipo não se oferece; a que já lá estava fica explicada, sem campos', () => {
    app.loanSect(casa({ type: 'fixa', produtos: [seguro()] }), 0);
    igual(app.window.__sel.l_ptipo_pv.options.map((o) => o.v).includes('reducao_spread'), false);
    limpar(app);
    app.loanSect(casa({ type: 'variavel', produtos: [seguro()] }), 0);
    igual(app.window.__sel.l_ptipo_pv.options.map((o) => o.v).includes('reducao_spread'), true, 'na variável oferece-se');
    limpar(app);
    const h = app.loanSect(casa({ type: 'fixa', produtos: [reducao()] }), 0);
    assert.match(h, /Na taxa fixa não há spread: esta redução não conta\. Remove-a, ou escolhe outro tipo de taxa\./);
    assert.ok(!/l_pmes_pr|l_pspr_pr|l_ptan_pr/.test(h));
    igual(app.window.__sel.l_ptipo_pr.options.map((o) => o.v).includes('reducao_spread'), true, 'a escolhida continua na lista');
  });
  test('a frase da taxa em vigor diz até quando dura a redução, ou que já acabou', () => {
    casa({ produtos: [reducao()] });
    igual(app.loanProdFraseVigor(Lbase()), 'Com os produtos ligados, o spread fica em 0,5 %. A redução de spread acaba em setembro de 2027: a partir daí o spread passa a 1 %, e a prestação sobe.');
    registadas(12);
    igual(app.loanProdFraseVigor(Lbase()), 'Com os produtos ligados, o spread fica em 1 %. A redução de spread já acabou.');
    limpar(app);
    casa({ type: 'mista', produtos: [reducao()] });
    igual(app.loanProdFraseVigor(Lbase()), 'Com os produtos ligados, a taxa fixa fica em 2 % e o spread em 1 %. A redução de spread acaba antes do fim da taxa fixa: não muda a prestação.');
    limpar(app);
    casa({ produtos: [reducao({ meses: null })] });
    igual(app.loanProdFraseVigor(Lbase()), 'Com os produtos ligados, o spread fica em 1 %. A redução de spread só conta com os meses que dura.');
    limpar(app);
    casa({ produtos: [reducao({ ativo: false })] });
    igual(app.loanProdFraseVigor(Lbase()), 'Sem produtos ligados, o spread fica em 1 %.');
  });
  test('o collectProp lê os meses (só algarismos, na gama), e mudar de tipo larga-os', () => {
    casa({ produtos: [reducao(), reducao({ id: 'r2' }), reducao({ id: 'r3' }), reducao({ id: 'r4' })] });
    const el = (id) => app.document.getElementById(id);
    for (const [id, tipo] of [['pr', 'reducao_spread'], ['r2', 'reducao_spread'], ['r3', 'reducao_spread'], ['r4', 'seguro_vida']]) el('l_ptipo_' + id).value = tipo;
    el('l_pmes_pr').value = ' 18 ';
    el('l_pmes_r2').value = 'doze';
    el('l_pmes_r3').value = '0';
    el('l_pmes_r4').value = '12';
    app.collectProp();
    igual(L().produtos.map((p) => [p.id, p.tipo, p.meses]), [['pr', 'reducao_spread', 18], ['r2', 'reducao_spread', null], ['r3', 'reducao_spread', null], ['r4', 'seguro_vida', null]]);
    igual(gravou, 0);
  });
  test('mudar o tipo de ou para a redução repinta a linha (os campos mudam); entre os outros, só refaz as contas', () => {
    casa({ produtos: [seguro()] });
    let refez = 0;
    app.liveLoanAll = () => { refez++; };
    /* o sel() escolheu v: o collectProp (o DOM falso não o tem) lê-o para o formulário */
    const tipo = (v) => { app.collectProp = () => { L().produtos[0].tipo = v; }; app.loanProdTipoMudou(); };
    tipo('ordenado');
    igual([repintou, refez], [0, 1], 'de seguro para ordenado: os mesmos campos');
    tipo('reducao_spread');
    igual([repintou, refez], [1, 1], 'para a redução: aparecem os meses');
    tipo('seguro_vida');
    igual([repintou, refez], [2, 1], 'e de volta');
  });
  test('o «Adicionar produto» nunca escolhe a redução sozinho', () => {
    casa();
    app.collectProp = () => {};
    for (let i = 0; i < 9; i++) app.loanProdAdicionar('a');
    assert.ok(!L().produtos.some((p) => p.tipo === 'reducao_spread'));
    igual(L().produtos.slice(-2).map((p) => p.tipo), ['outro', 'outro']);
  });
  test('o Guardar sem os meses dá o erro junto ao campo e não grava (na hipoteca e no imóvel); com eles, grava', () => {
    janelasFalsas(app, 'paintThumbs', 'refreshDetail');
    const erros = [];
    app.falhaCampo = (id, msg) => { erros.push([id, msg]); };
    app.perguntarPrestacoesEmFalta = () => {};
    app.collectProp = () => {};
    casa({ produtos: [reducao({ meses: null })] });
    app.mortOpen('a', false);
    app.onSave();
    igual(erros, [['l_pmes_pr', 'Diz durante quantos meses baixa o spread.']]);
    igual(gravou, 0);
    igual(Lbase().produtos[0].meses, null);
    app.propModal('p1');
    app.findLoan(app.pForm, 'a').produtos[0].meses = null;
    app.onSave();
    igual(erros.length, 2);
    igual(erros[1][0], 'l_pmes_pr');
    igual(gravou, 0);
    app.findLoan(app.pForm, 'a').produtos[0].meses = 12;
    app.onSave();
    igual(erros.length, 2);
    igual(gravou, 1);
    igual(Lbase().produtos[0].meses, 12);
    /* na fixa a redução não conta e não tem o campo: não se pede */
    limpar(app);
    casa({ type: 'fixa', produtos: [reducao({ meses: null })] });
    app.mortOpen('a', false);
    app.onSave();
    igual(erros.length, 2);
  });
  test('a caixa da simulação diz «Prestação a partir de set 2027», mais alta', () => {
    const l = casa({ produtos: [reducao()] });
    const h = app.loanBox(l);
    const m = h.match(/Prestação a partir de set 2027<\/span><b>([^<]+)<\/b>/);
    assert.ok(m, h);
    const a = app.amort(l);
    igual(m[1], app.euro2(a.rows[12].pay + a.rows[12].st));
    assert.match(h, /Euribor 6m 3% \+ 0,5% = 3,5% com um produto/);
    limpar(app);
    assert.ok(!/Prestação a partir/.test(app.loanBox(casa({ produtos: [reducao({ ativo: false })] }))), 'desligada, nada');
    limpar(app);
    const mista = app.loanBox(casa({ type: 'mista', produtos: [reducao({ meses: 72 })] }));
    igual((mista.match(/Prestação a partir de /g) || []).length, 2, 'na mista longa, o fim da fase fixa e o da redução');
    assert.match(mista, /Prestação a partir de set 2031[\s\S]*Prestação a partir de set 2032/);
  });
});

describe('a ficha, o planeado e os prazos', () => {
  test('a ficha nomeia a redução com a duração e diz a prestação de depois', () => {
    casa({ produtos: [reducao(), seguro({ ativo: false })] });
    const h = app.mortFicha('p1', 'a');
    assert.match(h, /Produtos ligados[\s\S]*Redução de spread nos primeiros 12 meses/);
    const a = app.amort(Lbase());
    assert.match(h, new RegExp('Depois da redução de spread[\\s\\S]*' + app.euro2(a.rows[12].pay).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    igual(app.credProdutosFrase(Lbase()), 'Com Redução de spread nos primeiros 12 meses: spread de 0,5 %.');
    igual(app.credProdutoNome(reducao({ meses: 1 })), 'Redução de spread no primeiro mês');
    igual(app.credDepois(Lbase()), a.rows[12].pay + a.rows[12].st, 'o cartão diz a de depois');
    assert.match(app.credDetalhe({ p: app.prop('p1'), l: Lbase() }), /A partir de set 2027<\/p><p class="cred-v">[^<]+<\/p><p class="small">Euribor 6m 3% \+ 1% = 4%/);
    registadas(12);
    assert.ok(!/Depois da redução de spread|Produtos ligados/.test(app.mortFicha('p1', 'a')), 'acabada, a ficha já não fala dela');
  });
  test('o planeado da prestação segue o relógio: sobe quando se regista a 12.ª', () => {
    casa({ produtos: [reducao()] });
    app.syncAllLoanRecs();
    const rec = () => app.db.recurring.find((r) => r.auto && r.tx.loanId === 'a');
    const antes = rec().tx.amount;
    igual(antes, Math.round(app.loanCalc(Lbase()).total * 100) / 100);
    registadas(12);
    app.syncLoanRec(app.prop('p1'), Lbase());
    assert.ok(rec().tx.amount > antes + 1, 'sobe: ' + antes + ' → ' + rec().tx.amount);
    igual(app.loanCalc(Lbase()).rate, 4, 'já sem a redução');
    igual(rec().tx.amount, Math.round(app.loanCalc(Lbase()).total * 100) / 100);
    /* a mesma hipoteca, com a redução ainda a correr: o planeado é mais alto do que essa */
    const aindaCom = JSON.parse(JSON.stringify(Lbase()));
    aindaCom.produtos[0].meses = 600;
    assert.ok(rec().tx.amount > Math.round(app.loanCalc(aindaCom).total * 100) / 100 + 1, 'sobe por a redução acabar, e não só por faltarem menos meses');
  });
  test('os prazos avisam do fim da redução, 60 dias antes, pelo mesmo relógio', () => {
    casa({ produtos: [reducao()] });
    registadas(11);
    const p = app.prazosDe(HOJE).find((x) => x.tipo === 'spread');
    assert.ok(p, 'há aviso');
    igual(p.alvo, '2026-10-10');
    igual(p.titulo, 'Fim da redução do spread — Aquisição (Casa)');
    igual(p.sub, 'A 10/10/2026 acaba a redução de spread: o spread passa de 0,5% para 1%, e a prestação sobe.');
    igual(p.chave, 'spread:a:2026-10-10');
    limpar(app);
    casa({ produtos: [reducao()] });
    assert.ok(!app.prazosDe(HOJE).some((x) => x.tipo === 'spread'), 'a um ano, ainda não');
    limpar(app);
    casa({ type: 'mista', produtos: [reducao()] });
    registadas(11);
    assert.ok(!app.prazosDe(HOJE).some((x) => x.tipo === 'spread'), 'na mista, a que acaba na fase fixa não muda nada');
  });
});
