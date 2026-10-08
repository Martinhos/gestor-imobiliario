// O + a meio da barra de baixo: o que cada pessoa pode adicionar
// (acessos.js:acoesDeAdicionar), a ação natural de cada ecrã
// (acessos.js:acaoDoSeparador), a barra com o botão a meio e a folha que ele
// abre (navegacao.js:buildTabbar, navegacao.js:abrirAdicionar), o CSS que
// esconde o FAB no telemóvel, e o design que o cita. A sessão simula-se com
// window.CW, como em colaborador-acoes.test.js.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarApp, limpar, repor, elementos, igual } from './arnes.js';

const app = carregarApp();
afterEach(() => app.definirServicosDesligados([]));
afterEach(() => repor(app));

const GESTOR = ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'];
const CONTAB = ['tx.view', 'tx.add', 'rec.view', 'rec.add', 'contract.view', 'loan.view', 'file.view', 'file.add', 'report.view'];
const NOVE = ['movimento', 'imovel', 'contrato', 'inquilino', 'proprietario', 'visita', 'planeado', 'modelo', 'hipoteca'];
const TB = ['dashboard', 'transactions', 'properties', 'calendar'];

// três imóveis do Rui; os cargos dizem-se por casa (null é «sou dono»)
function casas(a, cargos) {
  limpar(a);
  a.db.properties = ['P1', 'P2', 'P3'].map((id, i) =>
    Object.assign(a.normProp({ id, name: 'T' + (i + 1) + ' Rui', ownerIds: ['rui'] }), { _sharedFrom: 'Rui', _ownerUserId: 'rui', _cargo: 'Cargo ' + id }));
  a.db.owners = [a.normPerson({ id: 'eu', name: 'Eu' }), Object.assign(a.normPerson({ id: 'rui', name: 'Rui' }), { _userId: 'rui' })];
  const cs = {};
  ['P1', 'P2', 'P3'].forEach((id, i) => {
    const c = cargos[i];
    cs[id] = c === null ? { dono: true, criador: true } : { dono: false, nome: 'Cargo ' + id, perms: c };
  });
  a.window.CW = Object.assign(a.window.CW || {}, { user: { id: 'eu' }, cargos: cs, pessoas: {} });
}
const ids = (xs) => JSON.parse(JSON.stringify(xs.map((x) => x.id)));
// a ordem dos filhos da barra, pelo nome da tag (o DOM do arnês guarda o HTML como texto)
const tags = (html) => (html.match(/<(a|button)\b/g) || []).map((s) => s.slice(1));
const destinos = (html) => (html.match(/goBarra\('(\w+)'\)/g) || []).map((s) => s.slice(9, -2));
const BOTAO = /<button type="button" class="tabmais" data-toca="camada" data-click="abrirAdicionar\(\)" aria-label="Adicionar"/;

describe('acoesDeAdicionar', () => {
  test('o dono tem as nove, pela ordem, cada uma para uma camada e com a ação da lista respetiva', () => {
    casas(app, [null, null, null]);
    const a = app.acoesDeAdicionar();
    igual(ids(a), NOVE);
    igual(JSON.parse(JSON.stringify(a.map((x) => x.label))),
      ['Movimento', 'Imóvel', 'Contrato', 'Inquilino', 'Proprietário', 'Visita', 'Movimento recorrente', 'Modelo', 'Hipoteca']);
    igual(JSON.parse(JSON.stringify(a.map((x) => x.act))),
      ['newTxPick()', 'propModal()', 'ctModal()', "personModal('tenant')", "personModal('owner')", 'visitModal()', 'newRec()', 'newTpl()', 'newMort()']);
    assert.ok(a.every((x) => x.toca === 'camada' && x.icon), 'todas abrem uma camada e têm ícone');
  });

  test('sem sessão é o dono; sem imóveis ficam de fora o contrato, a visita e a hipoteca — como os FABs', () => {
    limpar(app);
    delete app.window.CW;
    app.db.properties = [app.normProp({ id: 'P1', name: 'T1', ownerIds: [] })];
    igual(ids(app.acoesDeAdicionar()), NOVE);
    app.db.properties = [];
    igual(ids(app.acoesDeAdicionar()), ['movimento', 'imovel', 'inquilino', 'proprietario', 'planeado', 'modelo']);
  });

  test('o gestor de visitas tem o inquilino e a visita (pela ordem fixa); o contabilista o movimento e os planeados', () => {
    casas(app, [GESTOR, GESTOR, GESTOR]);
    igual(ids(app.acoesDeAdicionar()), ['inquilino', 'visita']);
    casas(app, [CONTAB, CONTAB, CONTAB]);
    igual(ids(app.acoesDeAdicionar()), ['movimento', 'planeado', 'modelo']);
    // um dono que também colabora é dono: tem tudo
    casas(app, [null, GESTOR, CONTAB]);
    igual(ids(app.acoesDeAdicionar()), NOVE);
  });

  test('um cargo que só vê não tem nenhuma', () => {
    casas(app, [['visit.view'], ['tx.view', 'report.view'], ['loan.view']]);
    igual(app.acoesDeAdicionar(), []);
  });

  test('um serviço desligado leva as suas ações, e o fecho também (sem Movimentos não há Planeados)', () => {
    casas(app, [null, null, null]);
    app.definirServicosDesligados(['visits', 'credits']);
    igual(ids(app.acoesDeAdicionar()), ['movimento', 'imovel', 'contrato', 'inquilino', 'proprietario', 'planeado', 'modelo']);
    app.definirServicosDesligados(['transactions']);
    igual(ids(app.acoesDeAdicionar()), ['imovel', 'contrato', 'inquilino', 'proprietario', 'visita', 'hipoteca']);
    app.definirServicosDesligados(['owners', 'tenants']);
    igual(ids(app.acoesDeAdicionar()), ['movimento', 'imovel', 'visita', 'planeado', 'modelo', 'hipoteca'], 'sem inquilinos não há contratos');
  });
});

describe('acaoDoSeparador', () => {
  test('cada ecrã tem a sua ação natural; os que não têm ficam vazios', () => {
    const esperado = { dashboard: 'movimento', transactions: 'movimento', properties: 'imovel', contracts: 'contrato', tenants: 'inquilino',
      owners: 'proprietario', visits: 'visita', calendar: 'visita', recurring: 'planeado', credits: 'hipoteca',
      settings: '', projections: '', reports: '', fisco: '', colaboradores: '' };
    Object.keys(esperado).forEach((t) => assert.equal(app.acaoDoSeparador(t), esperado[t], t));
    assert.equal(app.acaoDoSeparador(''), '');
    assert.equal(app.acaoDoSeparador('xyz'), '');
    // cada ação natural é uma das ações da folha
    Object.values(esperado).filter(Boolean).forEach((id) => assert.ok(NOVE.includes(id), id));
  });
});

describe('buildTabbar', () => {
  test('o dono: cinco lugares com o + a meio, «Adicionar» no nome, a classe mais na barra e os quatro destinos de sempre', () => {
    const fixos = elementos(app);
    casas(app, [null, CONTAB, GESTOR]);
    app.buildNav();
    const html = fixos.tabbar.innerHTML;
    igual(tags(html), ['a', 'a', 'button', 'a', 'a']);
    assert.match(html, BOTAO);
    assert.match(html, /class="tabmais"[^>]*title="Adicionar"[^>]*><svg/, 'o + é um desenho, com nome');
    igual(destinos(html), TB, 'os destinos são os de sempre');
    assert.match(fixos.tabbar.className, /^tabbar mais d4$/);
    igual(app._barraAgora, TB, 'o botão não entra na fita');
  });

  test('o gestor de visitas: Visitas no lugar dos Movimentos, e o + a meio na mesma', () => {
    const fixos = elementos(app);
    casas(app, [GESTOR, GESTOR, GESTOR]);
    app.buildNav();
    const html = fixos.tabbar.innerHTML;
    igual(destinos(html), ['dashboard', 'visits', 'properties', 'calendar']);
    igual(tags(html), ['a', 'a', 'button', 'a', 'a']);
    assert.match(html, />Visitas</);
    assert.doesNotMatch(html, /Movimentos/);
    assert.match(fixos.tabbar.className, /\bmais\b/);
  });

  test('um cargo que só vê: sem botão, quatro lugares e sem a classe', () => {
    const fixos = elementos(app);
    casas(app, [['visit.view'], ['visit.view'], ['visit.view']]);
    app.buildNav();
    const html = fixos.tabbar.innerHTML;
    igual(tags(html), ['a', 'a', 'a', 'a']);
    assert.doesNotMatch(html, /tabmais|abrirAdicionar/);
    assert.equal(fixos.tabbar.className, 'tabbar');
  });

  test('com menos destinos o + continua a meio: três dão a posição 2, dois dão a 1, e a barra diz quantos são', () => {
    const fixos = elementos(app);
    // só a ficha (house.edit → hipoteca): nem movimentos nem substitutos, e a barra fica com três
    casas(app, [['house.edit'], ['house.edit'], ['house.edit']]);
    app.buildNav();
    igual(destinos(fixos.tabbar.innerHTML), ['dashboard', 'properties', 'calendar']);
    igual(tags(fixos.tabbar.innerHTML), ['a', 'a', 'button', 'a']);
    assert.equal(fixos.tabbar.className, 'tabbar mais d3');
    app.definirServicosDesligados(['calendar']);
    app.buildNav();
    igual(tags(fixos.tabbar.innerHTML), ['a', 'button', 'a']);
    assert.equal(fixos.tabbar.className, 'tabbar mais d2');
  });

  test('goBarra continua a calcular o lado só pelos destinos, com o + no meio deles', () => {
    casas(app, [null, null, null]);
    app.buildNav();
    const lados = [];
    app.go = () => { lados.push(app._ladoSep); };
    app.tab = 'transactions';
    app.goBarra('properties');
    app.goBarra('dashboard');
    app.goBarra('transactions');
    app.goBarra('settings');
    igual(lados, [1, -1, 0, 0], 'direita, esquerda, o mesmo, fora da barra');
    igual(app._barraAgora, TB);
  });
});

describe('abrirAdicionar', () => {
  test('com uma só ação corre-a logo, sem folha', () => {
    casas(app, [['visit.add'], ['visit.add'], ['visit.add']]);
    igual(ids(app.acoesDeAdicionar()), ['visita'], 'controlo: uma só');
    let folha = 0; const corridas = [];
    app.pickModal = () => { folha++; };
    app.correrAcao = (t) => { corridas.push(t); };
    app.abrirAdicionar();
    igual(corridas, ['visitModal()']);
    assert.equal(folha, 0, 'uma folha com uma opção é um toque a mais');
  });

  test('sem nada para adicionar não faz nada', () => {
    casas(app, [['visit.view'], ['visit.view'], ['visit.view']]);
    let folha = 0; let corridas = 0;
    app.pickModal = () => { folha++; };
    app.correrAcao = () => { corridas++; };
    app.abrirAdicionar();
    assert.equal(folha + corridas, 0);
  });

  test('com várias abre a folha com a ação do ecrã em primeiro e marcada «neste ecrã», com ícones; escolher fecha e corre', () => {
    casas(app, [null, null, null]);
    let aberta = null;
    app.pickModal = (title, options, onPick) => { aberta = { title, options, onPick }; };
    const corridas = []; let fechos = 0;
    app.correrAcao = (t) => { corridas.push(t); };
    app.closeModal = () => { fechos++; };
    app.tab = 'properties';
    app.abrirAdicionar();
    assert.equal(aberta.title, 'O que queres adicionar?');
    igual(aberta.options.map((o) => o.v), ['imovel', 'movimento', 'contrato', 'inquilino', 'proprietario', 'visita', 'planeado', 'modelo', 'hipoteca'], 'a do ecrã sobe; o resto fica pela ordem');
    assert.equal(aberta.options[0].sub, 'neste ecrã');
    assert.ok(aberta.options.slice(1).every((o) => o.sub === ''), 'só a do ecrã leva a marca');
    assert.ok(aberta.options.every((o) => o.icon && o.label), 'ícone e rótulo em todas');
    aberta.onPick(aberta.options[5]);
    assert.equal(fechos, 1, 'fecha a folha');
    igual(corridas, ['visitModal()'], 'e corre a ação escolhida pela gramática');
    // o calendário é das visitas; um ecrã sem ação natural fica pela ordem de sempre e sem marca
    app.tab = 'calendar';
    app.abrirAdicionar();
    assert.equal(aberta.options[0].v, 'visita');
    app.tab = 'settings';
    app.abrirAdicionar();
    igual(aberta.options.map((o) => o.v), NOVE);
    assert.ok(aberta.options.every((o) => o.sub === ''));
  });
});

describe('a folha de estilos e o design', () => {
  const css = readFileSync(new URL('../web/estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const md = readFileSync(new URL('../docs/design.md', import.meta.url), 'utf8');
  // o corpo de uma media query, do início dela até ao fecho na margem
  const fatia = (t, i) => { const fim = t.indexOf('\n}', i); return t.slice(i, fim > -1 ? fim : i + 4000); };

  test('a barra com o + tem a coluna dele a auto, e com menos destinos o + fica no centro do ecrã na mesma', () => {
    assert.match(css, /\.tabbar\.mais\{grid-template-columns:1fr 1fr auto 1fr 1fr\}/);
    // três destinos: [a,a,+,a] — o terceiro toma a metade direita e centra-se nela com a largura dos outros
    assert.match(css, /\.tabbar\.mais\.d3\{grid-template-columns:1fr 1fr auto 2fr\}/);
    assert.match(css, /\.tabbar\.mais\.d3 a:last-child\{width:50%;justify-self:center\}/);
    // dois: [a,+,a]; um: [a,+] com a terceira coluna vazia, para o + não ir para a ponta
    assert.match(css, /\.tabbar\.mais\.d2,\.tabbar\.mais\.d1\{grid-template-columns:1fr auto 1fr\}/);
    assert.match(css, /\.tabbar\.mais\.d0\{grid-template-columns:auto;justify-content:center\}/);
  });

  /* A primeira versão era um círculo a subir 12px acima da borda da barra e
     no telemóvel saía cortado. Agora é uma tecla em relevo, retangular, mais
     alta do que os destinos mas inteira dentro da barra: sem margem negativa,
     centrada na linha. */
  test('o + é uma tecla em relevo: retangular de cantos arredondados, sólida, mais alta do que os destinos e dentro da barra; carregar afunda-a', () => {
    const m = /\.tabmais\{([^}]*)\}/.exec(css);
    assert.ok(m, 'a regra existe');
    const r = m[1];
    assert.match(r, /width:64px/); assert.match(r, /height:50px/);
    assert.match(r, /border-radius:14px/, 'cantos ligeiramente arredondados, não um círculo');
    assert.match(r, /background:var\(--accent\)/, 'cor sólida, a da marca');
    assert.match(r, /color:var\(--accent-ink\)/);
    assert.doesNotMatch(r, /margin-top:-/, 'não sai da barra: sem a margem negativa que a fazia subir');
    assert.match(r, /margin:-1px 0/, 'os 2px a mais entram no padding da barra: a linha da grelha fica nos 48 e os destinos não esticam');
    assert.match(r, /align-self:center/, 'centrada na linha dos destinos');
    assert.match(r, /box-shadow:0 3px 0 var\(--accent-relevo\),/, 'a aresta de 3px por baixo é o relevo');
    assert.match(r, /inset 0 1px 0 rgba\(255,255,255,\.22\)/, 'o fio de luz no topo');
    assert.ok(/min-height:48px/.test(/\.tabbar a\{([^}]*)\}/.exec(css)[1]), 'controlo: os destinos têm 48px');
    assert.match(r, /transition:transform var\(--rapido\) var\(--curva\),box-shadow var\(--rapido\) var\(--curva\)/);
    assert.match(css, /\.tabmais:active\{transform:translateY\(3px\);box-shadow:0 0 0 var\(--accent-relevo\),/, 'carregar afunda a tecla e a aresta some');
    assert.match(css, /\.tabmais:focus-visible\{outline:2px solid var\(--accent\);outline-offset:2px\}/, 'o teclado vê onde está');
    assert.doesNotMatch(css, /\.tabmais:hover/, 'sem hover: no telemóvel não há');
    assert.match(css, /@media\(max-width:340px\)\{\.tabmais\{width:56px\}\}/, 'nos ecrãs estreitos encolhe para os rótulos caberem');
    // a aresta existe nos dois temas e é mais escura do que a face nos dois
    const tokens = [...css.matchAll(/--accent:(#[0-9a-f]{6});[^\n]*--accent-relevo:(#[0-9a-f]{6})/g)].map((x) => [x[1], x[2]]);
    assert.equal(tokens.length, 2, 'claro e escuro');
    const luz = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    tokens.forEach(([face, aresta]) => assert.ok(luz(aresta) < luz(face), 'a aresta ' + aresta + ' é mais escura do que a face ' + face));
  });

  test('até 900px o FAB, o leque e o fabpad somem; acima ficam como estavam', () => {
    const i = css.indexOf('@media(max-width:900px){\n  .tabbar{display:grid}');
    assert.ok(i > -1, 'a media query da barra existe');
    const bloco = fatia(css, i);
    assert.match(bloco, /body \.fab,body \.fabmenu,body \.fabmenu\.on,body \.fabpad\{display:none\}/);
    assert.doesNotMatch(bloco, /body \.fab\{bottom/, 'já não há um FAB a posicionar por cima da barra');
    assert.match(bloco, /\.wrap\{padding-bottom:calc\(96px/, 'o conteúdo não fica debaixo da barra');
    assert.match(css, /\n\.fab\{position:fixed;[^}]*display:flex/, 'no ecrã largo o FAB fica');
    assert.match(css, /\n\.fabpad\{height:84px\}/);
    // a regra do telemóvel vem ANTES da de base, por isso leva o body à frente
    assert.ok(i < css.indexOf('\n.fab{position:fixed'), 'controlo: a ordem que obriga ao body');
  });

  test('docs/design.md cita o + e a folha, e o FAB passa a ser só do ecrã largo', () => {
    assert.ok(md.includes('estilos.css:.tabmais'));
    assert.ok(md.includes('navegacao.js:abrirAdicionar'));
    assert.ok(md.includes('acessos.js:acoesDeAdicionar'));
    const fita = md.split(/\r?\n## /).find((s) => s.startsWith('A fita da barra de baixo'));
    assert.ok(fita && /estilos\.css:\.tabmais/.test(fita) && /navegacao\.js:abrirAdicionar/.test(fita), 'na secção da barra');
    // o markdown embrulha a 76 colunas: lê-se numa linha só
    assert.match(md.replace(/\s+/g, ' '), /FAB[^.]*ecrã largo/, 'o FAB é do ecrã largo');
  });
});
