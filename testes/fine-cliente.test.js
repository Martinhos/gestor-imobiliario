// A FINE na hipoteca, do lado da app: o botão «Ler a partir da FINE ou do
// contrato» só aparece com sessão, fora de produção e a quem pode editar a
// casa; o PDF fica anexado à hipoteca mesmo quando a leitura falha; o que o
// servidor leu entra no formulário (nunca na base) com o tipo de taxa, o
// prazo em anos e a marca de cada campo; a lista do que faltou; a prestação
// calculada contra a da FINE; os erros junto ao botão; e o que vem de fora
// nunca entra como HTML.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-09-06' });

/* O que cada teste observa: os pedidos ao fetch, os avisos, as gravações e
   as repinturas. */
let pedidos, avisos, gravou, repintou, resposta;

/* Um PDF escolhido no input (o File só precisa de nome, tipo e tamanho). */
const pdf = (extra = {}) => Object.assign({ name: 'fine.pdf', type: 'application/pdf', size: 120000 }, extra);
const input = (f) => ({ files: [f], value: 'C:\\fakepath\\fine.pdf' });
/* A resposta do fetch falso: {status, corpo} ou um erro de rede. */
const responde = (status, corpo) => { resposta = { status, corpo }; };
const semRede = () => { resposta = 'rede'; };
const espera = () => new Promise((r) => setImmediate(r));

/* A casa p1 com a hipoteca a (fixa, 100 000 €, 30 anos, 3%), na base e no
   formulário — o formulário é uma cópia, como o propModal a faz. */
function casa(loanExtra = {}) {
  const l = app.normLoan(Object.assign({ id: 'a', name: 'Aquisição', bank: '', outstanding: 100000, capitalInicio: 100000, years: 30, type: 'fixa', rate: 3, stampTax: true }, loanExtra));
  const p = app.normProp({ id: 'p1', name: 'Casa', loans: [l] });
  app.db.properties.push(p);
  app.pForm = app.normProp(JSON.parse(JSON.stringify(p)));
  return app.findLoan(app.pForm, 'a');
}
const L = () => app.findLoan(app.pForm, 'a');
const naBase = () => app.findLoan(app.prop('p1'), 'a');
/* Lê o PDF com a resposta dada e espera que tudo assente (o anexo incluído). */
async function ler(f = pdf()) {
  await app.fineFicheiro(input(f), 'a');
  await espera();
}

beforeEach(() => {
  limpar(app);
  pedidos = []; avisos = []; gravou = 0; repintou = 0; resposta = null;
  app.render = () => {};
  app.toast = (m) => { avisos.push(m); };
  app.save = () => { gravou++; };
  app.collectProp = () => {};   // o DOM falso devolve '' em tudo: o formulário já está em pForm
  app.repaintProp = () => { repintou++; };
  app.takeFiles = (inp) => { inp.value = ''; return Promise.resolve([{ id: 'f1', name: 'fine.pdf', type: 'application/pdf', size: 120000, added: '2026-09-06', v: 1 }]); };
  app.pode = () => true;
  app.CW = { ambiente: 'dev', user: { token: 'tok123' } };
  app.fetch = (url, opts) => {
    pedidos.push({ url, opts });
    if (resposta === 'rede') return Promise.reject(new TypeError('Failed to fetch'));
    const r = resposta || { status: 503, corpo: {} };
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: () => Promise.resolve(r.corpo) });
  };
});
afterEach(() => repor(app));

describe('o botão', () => {
  test('aparece com sessão, fora de produção, a quem edita — com o texto e a dica', () => {
    const l = casa();
    const h = app.fineSect(l);
    assert.match(h, /Ler a partir da FINE ou do contrato/);
    assert.match(h, /A app preenche os campos por ti, e tu confirmas antes de guardar\. Se preferires, preenche à mão aqui em baixo\./);
    assert.match(h, /accept="application\/pdf"/);
    assert.match(h, /data-change="fineFicheiro\(this,'a'\)"/);
    assert.ok(!/ style=| on[a-z]+=/i.test(h), 'sem style= nem on…= (a CSP)');
  });
  test('em produção não aparece', () => {
    const l = casa();
    app.CW.ambiente = 'producao';
    igual(app.fineSect(l), '');
  });
  test('sem sessão não aparece', () => {
    const l = casa();
    app.CW = { ambiente: 'dev', user: null };
    igual(app.fineSect(l), '');
  });
  test('numa casa onde não edito não aparece; numa casa nova, sim', () => {
    const l = casa();
    app.pode = (id, perm) => !(id === 'p1' && perm === 'house.edit');
    igual(app.fineSect(l), '');
    app.pForm = app.normProp({ id: 'nova', name: 'Nova', loans: [app.normLoan({ id: 'a' })] });
    assert.match(app.fineSect(L()), /fine_btn_a/, 'a casa ainda não existe: quem a cria edita-a');
  });
  test('fica no topo do formulário da hipoteca, antes de qualquer campo', () => {
    const l = casa();
    const h = app.loanSect(l, 0);
    const b = h.indexOf('fine_btn_a');
    assert.ok(b > 0, 'o botão está no loanSect');
    for (const id of ['l_name_a', 'l_bank_a', 'l_out_a', 'l_years_a', 'l_rate_a']) assert.ok(b < h.indexOf(id), 'antes de ' + id);
  });
});

describe('ler o PDF', () => {
  test('envia os bytes à rota com a sessão, e o PDF fica anexado', async () => {
    casa();
    responde(200, { campos: { bank: 'Caixa Geral de Depósitos', outstanding: 150000 }, ignorados: [] });
    const f = pdf();
    await ler(f);
    igual(pedidos.length, 1);
    const { url, opts } = pedidos[0];
    igual(url, '/api/creditos/fine');
    igual(opts.method, 'POST');
    assert.equal(opts.body, f, 'o corpo é o próprio ficheiro');
    igual(opts.headers['Content-Type'], 'application/pdf');
    igual(opts.headers.Authorization, 'Bearer tok123');
    igual(opts.credentials, 'same-origin');
    igual(L().files.map((x) => x.id), ['f1']);
  });

  test('ler o mesmo PDF outra vez não o anexa outra vez', async () => {
    casa();
    responde(200, { campos: { outstanding: 150000 }, ignorados: [] });
    const apagados = [];
    app.idbDel = (id) => { apagados.push(id); return Promise.resolve(); };
    await ler(pdf());
    app.takeFiles = (inp) => { inp.value = ''; return Promise.resolve([{ id: 'f2', name: 'fine.pdf', type: 'application/pdf', size: 120000, added: '2026-09-06', v: 1 }]); };
    await ler(pdf());
    igual(L().files.map((x) => x.id), ['f1']);
    igual(apagados, ['f2']);
  });
  test('os campos da fixa entram no formulário, com o prazo em anos e as marcas', async () => {
    casa();
    responde(200, { campos: { bank: 'Caixa Geral de Depósitos', outstanding: 150000, prazoMeses: 360, type: 'fixa', rate: 3.5, amortFeeFix: 0.5 }, ignorados: [] });
    await ler();
    const l = L();
    igual(l.bank, 'Caixa Geral de Depósitos');
    igual(l.capitalInicio, 150000);
    igual(l.outstanding, 150000, 'o capital em dívida deriva do do início');
    igual(l.years, 30);
    igual(l.rate, 3.5);
    igual(l.amortFeeFix, 0.5);
    assert.ok(repintou > 0, 'repinta o formulário');
    for (const k of ['bank', 'outstanding', 'prazoMeses', 'type', 'rate', 'amortFeeFix']) igual(app.fineMarca(l, k), ' class="fine-lido"', 'marca ' + k);
    igual(app.fineMarca(l, 'spread'), '', 'o que não se leu não se marca');
    const h = app.loanSect(l, 0);
    assert.match(h, /<label class="fine-lido">Banco<input id="l_bank_a"/);
    assert.match(h, /<label class="fine-lido">Capital em dívida/);
    assert.match(h, /<div class="fine-lido"><div class="flabel">Tipo de taxa/);
    assert.match(h, /Lido do documento — confirma antes de guardar\./);
    assert.match(h, /Preenchi 6 campos — estão com o contorno azul\./);
    assert.match(h, /Não consegui ler: a prestação\./);
    assert.ok(avisos.includes('Preenchi 6 campos.'), avisos.join(' | '));
  });
  test('o tipo muda como no setLType e só entram os campos desse tipo', async () => {
    casa();
    responde(200, { campos: { type: 'variavel', index: '12m', euribor: 2.1, spread: 0.9, rate: 4, amortFeeVar: 0.5, outstanding: 120000, prazoMeses: 300 }, ignorados: [] });
    await ler();
    const l = L();
    igual(l.type, 'variavel');
    igual([l.index, l.euribor, l.spread, l.amortFeeVar], ['12m', 2.1, 0.9, 0.5]);
    igual(l.rate, 3, 'a taxa fixa não entra numa variável');
    igual(l.years, 25);
    const h = app.loanSect(l, 0);
    assert.match(h, /<label class="fine-lido">Spread/);
    assert.match(h, /<label class="fine-lido">Indexante<div class="sel"/);
    assert.match(h, /class="opt on"[^>]*data-click="setLType\('a','variavel'\)"/);
  });
  test('na mista, os anos fixos e a taxa fixa', async () => {
    casa();
    responde(200, { campos: { type: 'mista', fixedYears: 5, rate: 2.9, index: '6m', euribor: 2.2, spread: 1, outstanding: 200000, prazoMeses: 480 }, ignorados: [] });
    await ler();
    const l = L();
    igual([l.type, l.fixedYears, l.rate, l.index, l.euribor, l.spread, l.years], ['mista', 5, 2.9, '6m', 2.2, 1, 40]);
    assert.match(app.loanSect(l, 0), /<label class="fine-lido">Anos com taxa fixa/);
  });
  test('um prazo que não dá anos inteiros arredonda e di-lo', async () => {
    casa();
    responde(200, { campos: { outstanding: 150000, prazoMeses: 342 }, ignorados: [] });
    await ler();
    igual(L().years, 29);
    assert.match(app.fineMiolo(L()), /A FINE diz 342 meses: ficou 29 anos, arredondado ao ano\./);
  });
  test('o que faltou diz-se com os nomes em português, e a contagem no singular', async () => {
    casa();
    responde(200, { campos: { outstanding: 150000, spread: 99 }, ignorados: ['spread', '<b>x</b>'] });
    await ler();
    const h = app.fineMiolo(L());
    assert.match(h, /Preenchi 1 campo — está com o contorno azul\./);
    assert.match(h, /Não consegui ler: o banco, o prazo, o tipo de taxa, a taxa, a comissão de amortização da taxa fixa e a prestação\./);
    assert.ok(!/&lt;b&gt;|<b>x/.test(h), 'um nome desconhecido do ignorados não se mostra');
    assert.match(h, /O documento traz valores que não fazem sentido num crédito \(o spread\)\. Pode não ser de confiança: confirma cada campo com o original antes de guardar\./);
  });
  test('valores recusados pelo servidor avisam que o documento pode não ser de confiança', async () => {
    casa();
    responde(200, { campos: { bank: 'Caixa Geral de Depósitos', type: 'variavel', index: '3m', euribor: 0, spread: 0, prestacao: 758.89 }, ignorados: ['outstanding', 'prazoMeses'] });
    await ler();
    const h = app.fineMiolo(L());
    assert.match(h, /class="fine-aviso fine-estranho" role="alert">O documento traz valores que não fazem sentido num crédito \(o capital e o prazo\)/);
  });
  test('sem nada recusado, não há aviso de documento estranho', async () => {
    casa();
    responde(200, { campos: { outstanding: 150000 }, ignorados: [] });
    await ler();
    assert.ok(!/fine-estranho/.test(app.fineMiolo(L())));
  });
  test('valores fora das gamas do contrato não entram, nem campos desconhecidos', () => {
    const c = app.fineLimpar({ bank: '  BPI ', outstanding: 10, prazoMeses: 361.5, type: 'hack', rate: 25, fixedYears: 0, index: '1m', euribor: -2, spread: 11, amortFeeFix: 3, amortFeeVar: 0.6, prestacao: 0, eval: 'x' });
    igual(c, { bank: 'BPI' });
    igual(app.fineLimpar(null), {});
    igual(app.fineLimpar({ bank: 'x'.repeat(81) }), {});
  });
});

describe('as marcas', () => {
  test('saem quando a pessoa muda o campo, e não voltam', async () => {
    casa();
    responde(200, { campos: { bank: 'BPI', outstanding: 150000, rate: 3.2 }, ignorados: [] });
    await ler();
    const l = L();
    l.bank = 'Novo Banco';
    app.fineRefrescar(l);
    igual(app.fineMarca(l, 'bank'), '');
    l.bank = 'BPI';
    igual(app.fineMarca(l, 'bank'), '', 'a marca diz «veio do documento»: um valor escrito à mão já não veio');
    igual(app.fineMarca(l, 'rate'), ' class="fine-lido"', 'as outras ficam');
    l.capitalInicio = 140000;
    igual(app.fineMarca(l, 'outstanding'), '');
  });
  test('as linhas ficam até se guardar ou fechar: um formulário novo começa sem nada', async () => {
    casa();
    responde(200, { campos: { bank: 'BPI', outstanding: 150000 }, ignorados: [] });
    await ler();
    assert.match(app.fineMiolo(L()), /Lido do documento/);
    app.pForm = app.normProp(JSON.parse(JSON.stringify(app.prop('p1'))));
    assert.ok(!/Lido do documento/.test(app.fineMiolo(L())));
    igual(app.fineMarca(L(), 'bank'), '');
  });
});

describe('a verificação cruzada da prestação', () => {
  /* A prestação que a app calcula para 150 000 € a 30 anos, a 3,5%. */
  const calculada = () => app.loanCalc(app.normLoan({ outstanding: 150000, capitalInicio: 150000, years: 30, type: 'fixa', rate: 3.5, stampTax: true }));
  const campos = (prestacao) => ({ campos: { outstanding: 150000, prazoMeses: 360, type: 'fixa', rate: 3.5, prestacao }, ignorados: [] });
  test('dentro da tolerância não há aviso — com ou sem o selo', async () => {
    const c = calculada();
    for (const p of [c.total, Math.round(c.total * 1.019 * 100) / 100, Math.round(c.base * 100) / 100]) {
      limpar(app); casa();
      responde(200, campos(p));
      await ler();
      assert.ok(!/não bate com a do documento/.test(app.fineMiolo(L())), 'sem aviso com ' + p);
    }
  });
  test('acima da tolerância avisa, com os dois valores escritos como a app os escreve', async () => {
    casa();
    const c = calculada(), p = Math.round(c.total * 1.06 * 100) / 100;
    responde(200, campos(p));
    await ler();
    const h = app.fineMiolo(L());
    assert.ok(h.includes(`A prestação calculada (${app.euro2(c.total)}) não bate com a do documento (${app.euro2(p)}) — confirma a taxa, o prazo e o capital.`), h);
  });
  test('o chão de 5 €: numa prestação pequena, 4 € de diferença não avisam', () => {
    const l = app.normLoan({ outstanding: 5000, capitalInicio: 5000, years: 5, type: 'fixa', rate: 3, stampTax: false });
    const c = app.loanCalc(l);
    igual(app.fineConferir(l, c.total + 4), null);
    assert.ok(app.fineConferir(l, c.total + 6), '6 € já avisam');
  });
  test('um spread a 0 na variável dispara o aviso', async () => {
    casa();
    const certa = app.loanCalc(app.normLoan({ outstanding: 150000, years: 30, type: 'variavel', index: '6m', euribor: 2.2, spread: 1, stampTax: true })).total;
    responde(200, { campos: { outstanding: 150000, prazoMeses: 360, type: 'variavel', index: '6m', euribor: 2.2, spread: 0, prestacao: Math.round(certa * 100) / 100 }, ignorados: [] });
    await ler();
    assert.match(app.fineMiolo(L()), /não bate com a do documento/);
  });
  test('corrigir o campo faz o aviso sair', async () => {
    casa();
    const c = calculada();
    responde(200, { campos: { outstanding: 150000, prazoMeses: 360, type: 'fixa', rate: 4.5, prestacao: Math.round(c.total * 100) / 100 }, ignorados: [] });
    await ler();
    assert.match(app.fineMiolo(L()), /não bate/);
    const caixa = app.document.getElementById('fine_av_a');
    caixa.innerHTML = 'o que estava';
    app.fineRefrescar(L());
    igual(caixa.innerHTML, 'o que estava', 'sem mudança no aviso, a caixa não se troca');
    L().rate = 3.5;
    app.fineRefrescar(L());
    igual(caixa.innerHTML, '', 'ao escrever, só a caixa do aviso se troca');
    assert.ok(!/não bate/.test(app.fineMiolo(L())));
  });
  test('sem prestação lida, ou sem capital, não há conta a fazer', () => {
    const l = app.normLoan({ outstanding: 0, years: 30, rate: 3 });
    igual(app.fineConferir(l, 500), null);
    igual(app.fineConferir(app.normLoan({ outstanding: 100000, years: 30, rate: 3 }), 0), null);
  });
});

describe('os erros', () => {
  const FRASES = {
    413: 'O PDF é grande demais para ler (máx. 5 MB).',
    415: 'Escolhe um PDF.',
    422: 'Este PDF não tem texto (parece uma digitalização). Preenche à mão.',
    429: 'Já leste 5 documentos hoje. Amanhã há mais — até lá, preenche à mão.',
    503: 'Não deu para ler o documento agora. Tenta daqui a pouco, ou preenche à mão.',
  };
  for (const [st, frase] of Object.entries(FRASES)) {
    test(`${st}: a frase do servidor junto ao botão, nada muda, e o PDF fica anexado`, async () => {
      casa();
      responde(Number(st), { error: frase });
      await ler();
      const h = app.fineMiolo(L());
      assert.ok(h.includes(`<p class="erro-campo fine-erro" id="fine_erro_a" role="alert">${app.esc(frase)}</p>`), h);
      assert.ok(h.indexOf('fine_btn_a') < h.indexOf('fine_erro_a'), 'por baixo do botão');
      igual(L().capitalInicio, 100000);
      igual(L().files.map((x) => x.id), ['f1']);
      igual(app.fineMarca(L(), 'outstanding'), '');
    });
  }
  test('sem rede, uma frase da app', async () => {
    casa();
    semRede();
    await ler();
    assert.match(app.fineMiolo(L()), /Sem ligação ao servidor\. Tenta daqui a pouco, ou preenche à mão\./);
  });
  test('um 200 sem campos é uma falha, e um erro sem frase também', async () => {
    casa();
    responde(200, { ok: true });
    await ler();
    assert.match(app.fineMiolo(L()), /Não deu para ler o documento agora/);
    responde(500, 'não é JSON');
    await ler();
    assert.match(app.fineMiolo(L()), /Não deu para ler o documento agora/);
  });
  test('um PDF grande demais ou que não é PDF nem sai do aparelho, mas fica anexado', async () => {
    casa();
    await ler(pdf({ size: 6 * 1024 * 1024 }));
    igual(pedidos.length, 0);
    assert.match(app.fineMiolo(L()), /O PDF é grande demais para ler \(máx\. 5 MB\)\./);
    igual(L().files.length, 1);
    await ler(pdf({ name: 'foto.jpg', type: 'image/jpeg' }));
    igual(pedidos.length, 0);
    assert.match(app.fineMiolo(L()), /Escolhe um PDF\./);
  });
  test('o erro sai quando se tenta outra vez', async () => {
    casa();
    responde(429, { error: FRASES[429] });
    await ler();
    responde(200, { campos: { outstanding: 150000 }, ignorados: [] });
    await ler();
    assert.ok(!/fine-erro/.test(app.fineMiolo(L())));
  });
  test('durante a leitura o botão fica ocupado', async () => {
    casa();
    let solta;
    app.fetch = () => new Promise((r) => { solta = r; });
    const p = app.fineFicheiro(input(pdf()), 'a');
    const h = app.fineMiolo(L());
    assert.match(h, /disabled aria-busy="true"/);
    assert.match(h, /A ler o documento…/);
    solta({ ok: true, status: 200, json: () => Promise.resolve({ campos: { outstanding: 150000 } }) });
    await p;
    assert.ok(!/aria-busy/.test(app.fineMiolo(L())));
  });
});

describe('o que vem do servidor nunca entra como HTML', () => {
  test('a frase do erro e o banco vão escapados', async () => {
    casa();
    responde(422, { error: '<img src=x onerror=alert(1)>' });
    await ler();
    const h = app.fineMiolo(L());
    assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!h.includes('<img'));
    responde(200, { campos: { bank: '"><script>alert(1)</script>', outstanding: 150000 }, ignorados: [] });
    await ler();
    const s = app.loanSect(L(), 0);
    assert.ok(!s.includes('<script>'), 'o banco entra pelo value, escapado');
    assert.ok(s.includes('value="&quot;&gt;&lt;script&gt;'));
  });
});

describe('nada se grava sem o Guardar', () => {
  test('a leitura mexe no formulário e a base fica como estava', async () => {
    casa();
    responde(200, { campos: { bank: 'BPI', outstanding: 150000, prazoMeses: 360, type: 'fixa', rate: 3.5 }, ignorados: [] });
    await ler();
    igual(gravou, 0, 'não chamou o save');
    igual(naBase().bank, '');
    igual(naBase().capitalInicio, 100000);
    igual(naBase().files.length, 0, 'o anexo também só fica no formulário');
    igual(L().bank, 'BPI');
  });
  test('um formulário fechado ou trocado a meio da leitura perde a resposta', async () => {
    casa();
    let solta;
    app.fetch = () => new Promise((r) => { solta = r; });
    const p = app.fineFicheiro(input(pdf()), 'a');
    const outro = app.normProp(JSON.parse(JSON.stringify(app.prop('p1'))));
    app.pForm = outro;
    solta({ ok: true, status: 200, json: () => Promise.resolve({ campos: { bank: 'BPI', outstanding: 150000 } }) });
    await p; await espera();
    igual(app.findLoan(outro, 'a').bank, '');
    igual(app.findLoan(outro, 'a').files.length, 0);
    igual(gravou, 0);
  });
});
