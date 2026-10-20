// A seleção dos Movimentos tem o aspeto das Casas (cloud/selecao-listas.js):
// a barra do fundo é a delas — × Cancelar, a contagem ao meio («2
// selecionados», «toca nos movimentos») e as ações —, posta no body como a
// delas, e guarda os botões dos Movimentos (Mudar categoria, Adicionar
// etiquetas com etiquetas definidas, Editar, Apagar N), parados sem nada
// marcado; a linha marcada leva o realce dos cartões (.sel-on-card); o botão
// do cabeçalho entra e sai, sem o «⋯» de antes. No telemóvel a barra tem duas
// linhas, com os rótulos curtos debaixo do ícone; no ecrã largo é a barra
// azul-noite. A tabela do ecrã largo continua com as caixas sempre à vista, a
// caixa de tudo no cabeçalho dela e o sair ao desmarcar a última.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarTudo, limpar, repor } from './arnes.js';

const app = carregarTudo({ hoje: '2026-09-06' });
afterEach(() => repor(app));

const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\r/g, '');

/* Um elemento do DOM falso com classes, atributos e ouvintes de verdade — o
   do arnês diz sempre que não tem a classe.
   Devolve: o elemento. */
function elemento() {
  const e = { attrs: {}, innerHTML: '', className: '', removido: false };
  const cs = () => e.className.split(/\s+/).filter(Boolean);
  e.classList = {
    contains: (c) => cs().includes(c),
    add: (c) => { if (!cs().includes(c)) e.className = cs().concat(c).join(' '); },
    remove: (c) => { e.className = cs().filter((x) => x !== c).join(' '); },
    toggle: (c, on) => { if (on === undefined ? !cs().includes(c) : on) e.classList.add(c); else e.classList.remove(c); },
  };
  e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
  e.getAttribute = (k) => (k in e.attrs ? e.attrs[k] : null);
  e.removeAttribute = (k) => { delete e.attrs[k]; };
  e.remove = () => { e.removido = true; };
  e.addEventListener = () => {};
  return e;
}

/* O body do documento falso guarda o que lhe põem, e o querySelector acha a
   barra que lá está (a última que não saiu).
   Devolve: {postas, barra(), body}. */
function corpoFalso() {
  const doc = app.document, postas = [];
  const body = elemento();
  body.appendChild = (x) => { postas.push(x); return x; };
  doc.body = body;
  doc.createElement = () => elemento();
  doc.querySelector = (s) => (s === '.sel-fundo' ? postas.filter((x) => !x.removido).pop() || null : null);
  return { postas, body, barra: () => doc.querySelector('.sel-fundo') };
}

beforeEach(() => {
  limpar(app);
  app.db.transactions.push(app.normTx({ id: 'A', kind: 'expense', label: 'Luz', amount: 50, date: '2026-03-12' }));
  app.db.transactions.push(app.normTx({ id: 'B', kind: 'income', label: 'Renda', amount: 500, date: '2026-03-02' }));
  app.tab = 'transactions';
  app.CW.selReset();
});

describe('a barra do fundo, a das Casas', () => {
  test('é um nó do body, com × Cancelar, a contagem ao meio e as ações dos Movimentos, todas paradas sem marcas', () => {
    app.db.settings.tags = ['Urgente'];
    const d = corpoFalso();
    app.CW.selEntrar('A');
    const f = d.barra();
    assert.ok(f, 'a barra está no body');
    assert.equal(f.className, 'sel-fundo mov-sel');
    assert.equal(f.getAttribute('role'), 'toolbar');
    assert.equal(f.getAttribute('aria-label'), 'Seleção');
    const h = f.innerHTML;
    const ordem = ['class="btn sel-fim"', 'class="sel-info"', 'class="sel-acoes"'].map((x) => h.indexOf(x));
    assert.ok(ordem.every((i, k) => i > -1 && (!k || i > ordem[k - 1])), 'Cancelar, a contagem e as ações, por esta ordem: ' + ordem);
    assert.match(h, /<button type="button" class="btn sel-fim" data-toca="modo" data-click="CW\.selSair\(\)"><svg[\s\S]*?<\/svg> Cancelar<\/button>/, '«× Cancelar», como nas Casas');
    assert.match(h, /<p class="sel-info"><b id="selFundoN">toca nos movimentos<\/b><span id="selFundoSoma" class="small"><\/span><\/p>/);
    const botoes = h.slice(h.indexOf('class="sel-acoes"')).match(/<button[^>]*>[\s\S]*?<\/button>/g);
    const rotulos = botoes.map((b) => b.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, ''));
    assert.deepEqual(rotulos, ['Categoria|Mudar categoria', 'Etiquetas|Adicionar etiquetas', 'Editar', 'Apagar']);
    assert.ok(botoes.every((b) => /data-precisa/.test(b)), 'os quatro param sem nada marcado');
    assert.match(botoes[0], /data-click="CW\.selEditar\('cat'\)"/);
    assert.match(botoes[1], /data-click="CW\.selEditar\('tags'\)"/);
    assert.match(botoes[2], /class="btn sel-acao sel-estreito"[^>]*data-click="CW\.selEditar\(\)"/);
    assert.match(botoes[3], /class="btn sel-acao danger"[^>]*data-toca="dados" data-risco="destroi" data-click="CW\.selApagar\(\)"[\s\S]*<span id="selFundoApagar">/);
  });

  test('fica de render para render, e só se refaz quando as etiquetas aparecem ou somem', () => {
    app.db.settings.tags = [];
    const d = corpoFalso();
    app.CW.selEntrar('A');
    const f = d.barra();
    assert.doesNotMatch(f.innerHTML, /Adicionar etiquetas/, 'sem etiquetas definidas não há o que acrescentar');
    app.render();
    app.CW.selToggle('B');
    assert.equal(d.barra(), f, 'o mesmo nó');
    assert.equal(d.postas.length, 1);
    app.db.settings.tags = ['Urgente'];
    app.render();
    assert.ok(f.removido, 'a de antes saiu');
    assert.notEqual(d.barra(), f);
    assert.match(d.barra().innerHTML, /Adicionar etiquetas/);
  });

  test('a contagem diz o que as Casas dizem, a soma vai com o sinal por baixo dela, e o «Apagar N» acompanha', () => {
    const doc = app.document, porId = doc.getElementById, el = {};
    const precisa = [elemento(), elemento()];
    doc.getElementById = (id) => (['selFundoN', 'selFundoSoma', 'selFundoApagar'].includes(id) ? (el[id] = el[id] || { textContent: '' }) : porId(id));
    doc.querySelectorAll = (s) => (s === '.sel-fundo [data-precisa]' ? precisa : []);
    try {
      app.CW.selEntrar('A');
      assert.equal(el.selFundoN.textContent, '1 selecionado');
      assert.equal(el.selFundoSoma.textContent, 'somam ' + app.euro2(-50));
      assert.equal(el.selFundoApagar.textContent, 'Apagar 1');
      assert.ok(precisa.every((b) => b.getAttribute('disabled') === null), 'com marcas, as ações andam');
      app.CW.selToggle('B');
      assert.equal(el.selFundoN.textContent, '2 selecionados');
      assert.equal(el.selFundoSoma.textContent, 'somam +' + app.euro2(450), 'a renda soma, a luz subtrai');
      assert.equal(el.selFundoApagar.textContent, 'Apagar 2');
      app.CW.selToggle('A'); app.CW.selToggle('B');
      assert.equal(el.selFundoN.textContent, 'toca nos movimentos', 'como o «toca nos cartões» das Casas');
      assert.equal(el.selFundoSoma.textContent, '', 'sem marcas não há soma (e a folha esconde-a)');
      assert.equal(el.selFundoApagar.textContent, 'Apagar');
      assert.ok(precisa.every((b) => b.getAttribute('disabled') === ''), 'sem marcas, as ações param');
      assert.equal(app.CW.selMode, true, 'no telemóvel a seleção fica, à espera do toque seguinte');
    } finally { doc.getElementById = porId; }
  });

  test('o Cancelar sai: a barra sai do body, o body perde o sel-on e as linhas voltam a abrir a ficha', () => {
    const d = corpoFalso();
    app.CW.selEntrar('A');
    assert.ok(d.body.classList.contains('sel-on'));
    assert.ok(d.body.classList.contains('sel-mov'), 'a classe que abre espaço às duas linhas da barra');
    const f = d.barra();
    app.CW.selSair();
    assert.ok(f.removido);
    assert.equal(d.barra(), null);
    assert.equal(d.body.classList.contains('sel-on'), false);
    assert.equal(d.body.classList.contains('sel-mov'), false);
    assert.match(app.txLinhaHtml(app.db.transactions[0], '2026-03'), /data-click="txView\('A'\)"/);
  });

  test('apagar pela barra confirma com o verbo dela, «Apagar N movimentos», e sai da seleção com o Anular', () => {
    let conf = null, aviso = null;
    app.confirmModal = (t, x, cb) => { conf = { t, x, cb }; };
    app.comDesfazer = (m) => { aviso = m; };
    app.save = () => {};
    const d = corpoFalso();
    app.CW.selEntrar('A');
    app.CW.selToggle('B');
    app.CW.selApagar();
    assert.equal(conf.t, 'Apagar 2 movimentos');
    assert.equal(conf.x, 'Somam +' + app.euro2(450) + '.');
    conf.cb();
    assert.equal(aviso, '2 movimentos apagados.');
    assert.equal(app.CW.selMode, false);
    assert.equal(d.barra(), null, 'a barra foi-se com a seleção');
  });
});

describe('as linhas e o cabeçalho', () => {
  test('a linha marcada tem o realce dos cartões das Casas (.sel-on-card), e o selPintar segue o estado', () => {
    app.CW.selEntrar('A');
    const [a, b] = app.db.transactions;
    assert.match(app.txLinhaHtml(a, '2026-03'), /class="linha txrow mov-linha sel-on-card"[^>]*aria-pressed="true"/);
    assert.doesNotMatch(app.txLinhaHtml(b, '2026-03'), /sel-on/);
    const linha = elemento(), caixaDela = elemento();
    linha.setAttribute('data-tx', 'B');
    linha.querySelector = (s) => (s === '.selbox' ? caixaDela : null);
    app.document.querySelectorAll = (s) => (s === '#view .txrow[data-tx]' ? [linha] : []);
    app.CW.selToggle('B');
    assert.ok(linha.classList.contains('sel-on-card'));
    assert.equal(linha.getAttribute('aria-pressed'), 'true');
    assert.match(caixaDela.innerHTML, /selck on/, 'a caixa cheia com o visto: a cor da frente, que o escurecimento forçado não apaga');
    app.CW.selToggle('B');
    assert.equal(linha.classList.contains('sel-on-card'), false);
    assert.match(css, /\.mov-linha\.sel-on-card\{background:var\(--accent-soft\);box-shadow:inset 1px 0 0 var\(--accent\),inset -1px 0 0 var\(--accent\),inset 0 -1px 0 var\(--accent\)\}/,
      'o fundo das linhas dos Contratos e o contorno dos cartões: o traço de cima é o do .sel-on-card, os outros três por dentro');
    assert.match(css, /\.mov-lista>\.mov-linha\.sel-on-card:first-child\{box-shadow:inset 0 0 0 1px var\(--accent\)\}/, 'a primeira linha do mês leva o anel inteiro');
    assert.doesNotMatch(css, /\.txrow\.sel-on\{|\.mov-linha\.sel-on\{/, 'o realce de antes saiu');
  });

  test('o botão do cabeçalho é o «Selecionar vários»: fora entra, dentro sai — e o «⋯» das ações saiu', () => {
    const hb = app.document.getElementById('hdrFilt');
    app.hdrFiltToggle();
    assert.equal(app.CW.selMode, true, 'fora da seleção entra');
    assert.equal(hb.innerHTML, app.ic('caixaVisto', 18), 'em seleção continua a ser o ☑ (a folha esconde-o)');
    assert.equal(hb.title, 'Selecionar vários');
    app.hdrFiltToggle();
    assert.equal(app.CW.selMode, false, 'dentro dela sai, como nas Casas');
    assert.equal(typeof app.CW.selAcoes, 'undefined', 'o menu que o «⋯» abria saiu');
    assert.match(css, /body\.sel-on #hdrFilt\.mov-hdr-sel\{display:none\}/, 'em seleção o botão esconde-se: a barra tem o Cancelar');
  });
});

describe('a tabela do ecrã largo', () => {
  test('fora da seleção a caixa existe (a folha só a mostra na tabela) e marcá-la entra; o mês não tem caixa; o kebab saiu', () => {
    const t = app.db.transactions[0];
    const html = app.txLinhaHtml(t, '2026-03');
    assert.match(html, /<span class="selbox fora" role="checkbox" aria-checked="false" aria-label="Selecionar «Luz»" data-toca="modo" data-click="CW\.selEntrar\('A',event\)">/);
    assert.doesNotMatch(html, /txkebab|txOpcoes|data-mes=/);
    assert.match(html, /data-click="txView\('A'\)"/, 'tocar na linha continua a abrir a ficha');
    assert.doesNotMatch(app.txMesHtml('2026-03'), /selbox/);
    assert.match(app.vTransactions(), /<span class="selbox mov-cab-caixa" data-sel-tudo role="checkbox"[^>]*data-toca="modo" data-click="CW\.selEntrarTodos\(event\)">/);
    assert.match(css, /\.mov-tabela \.txmes>\.mov-mes\{padding-left:72px\}/, 'o nome do mês fica na coluna da Data');
  });

  test('em seleção a caixa da linha é só desenho (a linha marca, com aria-pressed), e a de tudo marca tudo', () => {
    app.CW.selEntrar('A');
    const html = app.txLinhaHtml(app.db.transactions[0], '2026-03');
    assert.match(html, /<span class="selbox" aria-hidden="true">/);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /data-click="CW\.selToggle\('A',event\)"/);
    assert.match(app.vTransactions(), /data-sel-tudo role="checkbox"[^>]*data-toca="vista" data-click="CW\.selTodos\(event\)"/);
  });

  test('na tabela, desmarcar a última caixa termina a seleção; no telemóvel não', () => {
    app.CW.selEntrar('A');
    app.CW.selToggle('A');
    assert.equal(app.CW.selMode, true, 'no telemóvel fica');
    app.CW.selSair();
    app.matchMedia = (q) => ({ matches: /min-width:1100px/.test(q), addEventListener() {}, addListener() {} });
    app.CW.selEntrar('A');
    app.CW.selToggle('A');
    assert.equal(app.CW.selMode, false);
  });

  test('a edição em massa abre só a parte pedida pela barra', () => {
    app.db.settings.tags = ['Urgente', 'Dedutível'];
    const abertas = [];
    app.openModal = (t, b) => { abertas.push({ t, b }); };
    app.CW.selEntrar('A');
    app.CW.selEditar('cat');
    assert.equal(abertas[0].t, 'Mudar a categoria de 1 movimento');
    assert.match(abertas[0].b, /id="selCat"/);
    assert.doesNotMatch(abertas[0].b, /id="selTags"/);
    app.CW.selEditar('tags');
    assert.equal(abertas[1].t, 'Adicionar etiquetas a 1 movimento');
    assert.doesNotMatch(abertas[1].b, /id="selCat"/);
    assert.match(abertas[1].b, /<button type="button" class="chip" aria-pressed="false" data-tag="Urgente"/);
    app.CW.selEditar();
    assert.equal(abertas[2].t, 'Editar 1 movimento');
    assert.match(abertas[2].b, /id="selCat"[\s\S]*id="selTags"/);
  });
});

describe('a folha da barra', () => {
  test('no telemóvel duas linhas: o Cancelar e a contagem em cima, os botões em partes iguais em baixo, com o rótulo curto debaixo do ícone', () => {
    const tel = css.slice(css.indexOf('@media(max-width:900px){\n  .sel-fundo.mov-sel{'));
    const bloco = tel.slice(0, tel.indexOf('\n}'));
    assert.ok(bloco.length > 0, 'o bloco do telemóvel existe');
    assert.match(bloco, /\.sel-fundo\.mov-sel\{display:grid;grid-template-columns:1fr auto 1fr;/, 'a contagem ao meio da barra');
    assert.match(bloco, /\.sel-fundo\.mov-sel \.sel-acoes\{grid-column:1\/-1;display:grid;grid-auto-flow:column;grid-auto-columns:minmax\(0,1fr\)/);
    assert.match(bloco, /\.sel-fundo\.mov-sel \.sel-acao\{flex-direction:column;[^}]*min-height:54px/, 'o ícone por cima do rótulo, com mais de 44px de alvo');
    assert.match(bloco, /\.sel-fundo\.mov-sel \.sel-rot-longo\{display:none\}/);
    assert.match(css, /\.sel-fundo\.mov-sel #selFundoSoma:empty\{display:none\}/);
    assert.match(css, /body\.sel-mov \.wrap\{padding-bottom:calc\(140px \+ var\(--inset-bottom\)\)\}/, 'a última linha da lista para acima das duas linhas da barra');
    assert.match(css, /@media\(max-width:900px\)\{body\.sel-mov \.totop\{bottom:calc\(132px \+ var\(--inset-bottom\)\)\}\}/, 'e o «Topo» sobe para fora dela');
  });

  test('no ecrã largo a barra azul-noite: a soma na mesma linha e sem se cortar, os rótulos por extenso, sem o Editar, e o realce só com rato', () => {
    const largo = css.slice(css.indexOf('@media(min-width:901px){\n  .sel-fundo{'), css.indexOf('@media(min-width:901px) and (hover:hover){'));
    assert.ok(largo.length > 0, 'o bloco do ecrã largo vem antes do do rato');
    assert.doesNotMatch(largo, /:hover\{/, 'nenhum :hover fora do @media(hover:hover)');
    assert.match(largo, /\.sel-fundo\.mov-sel \.sel-info\{display:block;flex:1 0 auto;white-space:nowrap;text-align:center\}/, 'a soma não se corta: os botões descem');
    assert.match(largo, /\.sel-fundo\.mov-sel #selFundoSoma::before\{content:" · "\}/);
    assert.match(largo, /\.sel-fundo\.mov-sel \.sel-rot-curto,\.sel-fundo\.mov-sel \.sel-estreito\{display:none\}/);
    assert.match(css, /@media\(min-width:901px\) and \(hover:hover\)\{\s*\.sel-fundo \.btn:hover\{background:var\(--side-on\)\}/);
    assert.match(css, /\.sel-fundo \.btn\{[^}]*background:var\(--side-hover\)/, 'os véus da barra lateral');
  });
});
