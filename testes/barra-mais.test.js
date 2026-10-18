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
const TB = ['dashboard', 'casas', 'dinheiro', 'calendar'];

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
const BOTAO = /<button type="button" class="tabmais" data-toca="camada" data-click="abrirAdicionar\(\)" aria-label="Criar"/;

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
  test('o dono: cinco lugares com o + a meio, «Criar» no nome, a classe mais na barra e os quatro destinos (Início, Casas, Dinheiro, Agenda)', () => {
    const fixos = elementos(app);
    casas(app, [null, CONTAB, GESTOR]);
    app.buildNav();
    const html = fixos.tabbar.innerHTML;
    igual(tags(html), ['a', 'a', 'button', 'a', 'a']);
    assert.match(html, BOTAO);
    assert.match(html, /class="tabmais"[^>]*title="Criar"[^>]*><svg/, 'o + é um desenho, com nome');
    igual(destinos(html), TB, 'os destinos são as duas portas e as duas áreas');
    igual((html.match(/<span>([^<]+)<\/span>/g) || []).map((x) => x.slice(6, -7)), ['Início', 'Casas', 'Dinheiro', 'Agenda']);
    assert.match(fixos.tabbar.className, /^tabbar mais d4$/);
    igual(app._barraAgora, TB, 'o botão não entra na fita');
  });

  test('a área acende com qualquer dos seus separadores: Casas nos Contratos e nas Pessoas, Dinheiro nos Planeados', () => {
    const fixos = elementos(app);
    casas(app, [null, null, null]);
    for (const [t, area] of [['contracts', 'casas'], ['owners', 'casas'], ['visits', 'casas'], ['recurring', 'dinheiro'], ['credits', 'dinheiro'], ['dashboard', 'dashboard'], ['calendar', 'calendar']]) {
      app.tab = t;
      app.buildNav();
      const on = /<a class="on"[^>]*goBarra\('(\w+)'\)/.exec(fixos.tabbar.innerHTML);
      assert.equal(on && on[1], area, t + ' acende ' + area);
    }
    app.tab = 'reports';
    app.buildNav();
    assert.doesNotMatch(fixos.tabbar.innerHTML, /<a class="on"/, 'a Avaliação não é de nenhuma área: nada aceso');
  });

  test('o gestor de visitas: Casas fica (visitas e inquilinos), Dinheiro some, e o + a meio na mesma', () => {
    const fixos = elementos(app);
    casas(app, [GESTOR, GESTOR, GESTOR]);
    app.buildNav();
    const html = fixos.tabbar.innerHTML;
    const d = destinos(html);
    assert.ok(d.includes('casas') && !d.includes('dinheiro'), d.join(','));
    assert.equal(tags(html).indexOf('button'), Math.ceil(d.length / 2), 'o + a meio dos destinos');
    assert.match(fixos.tabbar.className, new RegExp('^tabbar mais d' + d.length + '$'));
  });

  test('um cargo que só vê: sem botão e sem a classe', () => {
    const fixos = elementos(app);
    casas(app, [['visit.view'], ['visit.view'], ['visit.view']]);
    app.buildNav();
    const html = fixos.tabbar.innerHTML;
    assert.ok(tags(html).every((t) => t === 'a'), 'só destinos');
    assert.doesNotMatch(html, /tabmais|abrirAdicionar/);
    assert.equal(fixos.tabbar.className, 'tabbar');
  });

  test('com menos destinos o + continua a meio, e a barra diz quantos são', () => {
    const fixos = elementos(app);
    casas(app, [['house.edit'], ['house.edit'], ['house.edit']]);
    app.buildNav();
    const n = destinos(fixos.tabbar.innerHTML).length;
    assert.equal(tags(fixos.tabbar.innerHTML).indexOf('button'), Math.ceil(n / 2));
    assert.equal(fixos.tabbar.className, 'tabbar mais d' + n);
    app.definirServicosDesligados(['calendar']);
    app.buildNav();
    assert.equal(destinos(fixos.tabbar.innerHTML).length, n - 1, 'a Agenda desligada sai');
    assert.equal(fixos.tabbar.className, 'tabbar mais d' + (n - 1));
  });

  test('goBarra calcula o lado pela área onde se está, e vai ao separador certo da área', () => {
    casas(app, [null, null, null]);
    app.buildNav();
    const lados = [], idas = [];
    app.go = (id) => { lados.push(app._ladoSep); idas.push(id); };
    app.tab = 'recurring';
    app.goBarra('casas');
    app.goBarra('dashboard');
    app.goBarra('dinheiro');
    app.goBarra('settings');
    igual(lados, [-1, -1, 0, 0], 'esquerda, esquerda, a mesma área, fora da barra');
    assert.equal(idas[0], 'properties', 'Casas abre nos Imóveis quando ainda não se esteve lá');
    igual(app._barraAgora, TB);
  });

  test('destinoDe: «pessoas» fica onde está ou abre os inquilinos; uma área abre a primeira porta à vista', () => {
    casas(app, [null, null, null]);
    app.tab = 'dashboard';
    assert.equal(app.destinoDe('casas', []), 'properties');
    assert.equal(app.destinoDe('dinheiro', []), 'transactions');
    assert.equal(app.destinoDe('pessoas', []), 'tenants');
    app.tab = 'owners';
    assert.equal(app.destinoDe('pessoas', []), 'owners', 'já nos proprietários: fica');
    app.tab = 'dashboard';
    assert.equal(app.destinoDe('pessoas', ['tenants']), 'owners', 'sem inquilinos: os proprietários');
    assert.equal(app.destinoDe('casas', ['properties', 'contracts']), 'tenants', 'a primeira porta à vista');
  });
});

describe('abrirAdicionar', () => {
  test('com uma só ação corre-a logo, sem folha', () => {
    casas(app, [['visit.add'], ['visit.add'], ['visit.add']]);
    igual(ids(app.acoesDeAdicionar()), ['visita'], 'controlo: uma só');
    let folha = 0; const corridas = [];
    app.openModal = () => { folha++; };
    app.correrAcao = (t) => { corridas.push(t); };
    app.abrirAdicionar();
    igual(corridas, ['visitModal()']);
    assert.equal(folha, 0, 'uma folha com uma opção é um toque a mais');
  });

  test('sem nada para adicionar não faz nada', () => {
    casas(app, [['visit.view'], ['visit.view'], ['visit.view']]);
    let folha = 0; let corridas = 0;
    app.openModal = () => { folha++; };
    app.correrAcao = () => { corridas++; };
    app.abrirAdicionar();
    assert.equal(folha + corridas, 0);
  });

  test('com várias abre «Criar»: os cinco tipos de movimento, os outros registos com a ação do ecrã em primeiro e marcada, e escolher fecha e corre', () => {
    casas(app, [null, null, null]);
    let aberta = null;
    app.openModal = (title, body, foot) => { aberta = { title, body, foot }; };
    const corridas = []; let fechos = 0;
    app.correrAcao = (t) => { corridas.push(t); };
    app.closeModal = () => { fechos++; };
    app.tab = 'properties';
    app.abrirAdicionar();
    assert.equal(aberta.title, 'Criar');
    assert.equal(aberta.foot, app.SEM_RODAPE, 'fecha-se no X: sem rodapé');
    assert.equal((aberta.body.match(/class="criar-tipo"/g) || []).length, 5, 'receita, despesa, crédito, dívida, transferência');
    assert.match(aberta.body, /Novo movimento[\s\S]*Outros registos/);
    const outros = [...aberta.body.matchAll(/class="criar-outro"[^>]*data-click="criarEscolha\((\d+)\)"><svg[\s\S]*?<\/svg><span>([^<]+)/g)].map((m) => [Number(m[1]), m[2]]);
    igual(outros.map((o) => o[1]), ['Imóvel', 'Contrato', 'Inquilino', 'Proprietário', 'Visita', 'Movimento recorrente', 'Modelo', 'Hipoteca'], 'a do ecrã sobe; o resto pela ordem; o movimento está nos tipos');
    assert.equal((aberta.body.match(/neste ecrã/g) || []).length, 1, 'só a do ecrã leva a marca');
    app.criarEscolha(outros[4][0]);
    assert.equal(fechos, 1, 'fecha a folha');
    igual(corridas, ['visitModal()'], 'e corre a ação escolhida pela gramática');
    app.criarEscolha(1);
    assert.equal(corridas[1], "criarMovimento('expense')", 'o segundo tipo é a despesa');
    app.tab = 'calendar';
    app.abrirAdicionar();
    assert.match(aberta.body, /<span>Visita<small>neste ecrã<\/small>/, 'o calendário é das visitas');
    app.tab = 'settings';
    app.abrirAdicionar();
    assert.doesNotMatch(aberta.body, /neste ecrã/);
  });

  test('a ação do ecrã vem primeiro: nos Contratos, «Contrato · neste ecrã» está por cima dos tipos de movimento, e não se repete em baixo', () => {
    casas(app, [null, null, null]);
    let aberta = null;
    app.openModal = (title, body) => { aberta = { title, body }; };
    app.tab = 'contracts';
    app.abrirAdicionar();
    const i = aberta.body.indexOf('neste ecrã'), j = aberta.body.indexOf('Novo movimento');
    assert.ok(i > -1 && j > -1 && i < j, 'a linha do ecrã antes do bloco «Novo movimento»');
    assert.equal((aberta.body.match(/<span>Contrato(<small>|<\/span>)/g) || []).length, 1, 'o Contrato aparece uma vez só');
    assert.match(aberta.body, /criarEscolha\(0\)[^>]*><span class="ic in">/, 'as posições 0…4 continuam a ser os cinco tipos');
    app.tab = 'transactions';
    app.abrirAdicionar();
    assert.doesNotMatch(aberta.body, /neste ecrã/, 'nos Movimentos a ação do ecrã são os próprios tipos');
  });

  test('o Criar aberto do menu do telemóvel fecha primeiro a gaveta', () => {
    casas(app, [null, null, null]);
    app.openModal = () => {};
    let fechos = 0;
    app.closeDrawer = () => { fechos++; };
    app.tab = 'dashboard';
    app.abrirAdicionar();
    assert.equal(fechos, 1, 'fechada a folha, não se volta ao menu aberto');
  });
});

describe('o aviso e a barra de baixo', () => {
  test('sem janela aberta, o aviso sobe para cima da barra de baixo à vista, e não a tapa; escondida, fica no fundo', () => {
    const els = elementos(app);
    const H = app.window.innerHeight, antes = els.tabbar.getBoundingClientRect;
    els.tabbar.getBoundingClientRect = () => ({ top: H - 76, bottom: H, height: 76, left: 0, right: 390, width: 390 });
    try {
      app.avisoAcimaDoRodape();
      assert.equal(els.toast.style['--acima'], '76px', 'os 22px de sempre, contados do topo da barra');
      els.tabbar.getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0 });
      app.avisoAcimaDoRodape();
      assert.equal(els.toast.style['--acima'], '0px', 'barra escondida (computador, gaveta, seleção): no fundo');
    } finally {
      els.tabbar.getBoundingClientRect = antes;
    }
  });
});

describe('criarMovimento: um tipo escolhido na folha «Criar»', () => {
  function stubs() {
    const vistos = { filtros: [], form: [] };
    app.newTxFromFilters = (k) => { vistos.filtros.push(k); };
    app.txModal = (o) => { vistos.form.push(JSON.parse(JSON.stringify(o))); };
    return vistos;
  }
  test('nos Movimentos nasce com os filtros da lista; fora deles abre limpo, sem os filtros que lá ficaram', () => {
    casas(app, [null, null, null]);
    const v = stubs();
    app.tab = 'transactions';
    app.criarMovimento('expense');
    igual(v.filtros, ['expense']);
    app.tab = 'properties';
    app.dashProp = 'P2';
    app.criarMovimento('expense');
    igual(v.form, [{ kind: 'expense', propId: null }], 'o imóvel em foco da Visão geral não passa para outros ecrãs');
    assert.equal(v.filtros.length, 1, 'fora dos Movimentos não lê os filtros (newTxFromFilters)');
  });
  test('na Visão geral leva o imóvel em foco, mas não um grupo', () => {
    casas(app, [null, null, null]);
    const v = stubs();
    app.tab = 'dashboard';
    app.dashProp = 'P1';
    app.criarMovimento('income');
    app.dashProp = 'g:x';
    app.criarMovimento('owed');
    igual(v.form, [{ kind: 'income', propId: 'P1' }, { kind: 'owed', propId: null }]);
    app.dashProp = '';
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
     no telemóvel saía cortado; a segunda, uma tecla em relevo de 64×50. A de
     2026-10 é o quadrado do canvas: 52px, raio 16, cobalto liso — e continua
     INTEIRO dentro da barra, que é a regra que ficou de tudo isto. */
  test('o + é um quadrado cobalto de 52px com raio 16, liso, dentro da barra; carregar encolhe-o', () => {
    const m = /\.tabmais\{([^}]*)\}/.exec(css);
    assert.ok(m, 'a regra existe');
    const r = m[1];
    assert.match(r, /width:52px/); assert.match(r, /height:52px/);
    assert.match(r, /border-radius:16px/, 'cantos arredondados, não um círculo');
    assert.match(r, /background:var\(--accent\)/, 'cor sólida, a da ação');
    assert.match(r, /color:var\(--accent-ink\)/);
    assert.doesNotMatch(r, /margin(-top)?:-/, 'não sai da barra: sem margem negativa');
    assert.match(r, /align-self:center/, 'centrado na linha dos destinos');
    assert.doesNotMatch(r, /--accent-relevo/, 'sem a aresta da tecla em relevo');
    assert.ok(/min-height:52px/.test(/\.tabbar a\{([^}]*)\}/.exec(css)[1]), 'controlo: os destinos têm 52px, e o + não é mais alto do que eles');
    assert.match(r, /transition:transform var\(--rapido\) var\(--curva\),box-shadow var\(--rapido\) var\(--curva\)/);
    assert.match(css, /\.tabmais:active\{transform:scale\(\.94\)/, 'carregar encolhe-o');
    assert.match(css, /\.tabmais:focus-visible\{outline:2px solid var\(--accent\);outline-offset:2px\}/, 'o teclado vê onde está');
    assert.doesNotMatch(css, /\.tabmais:hover/, 'sem hover: no telemóvel não há');
    assert.match(css, /@media\(max-width:340px\)\{\.tabmais\{width:48px;height:48px;margin:0 2px\}\}/, 'nos ecrãs estreitos encolhe para os rótulos caberem');
  });

  test('o FAB saiu: cria-se no «Criar» da barra lateral, na ação do cabeçalho e no + da barra de baixo', () => {
    assert.match(css, /\nbody \.fab,body \.fabmenu,body \.fabpad\{display:none\}/, 'em todos os ecrãs');
    const i = css.indexOf('@media(max-width:900px){\n  .tabbar{display:grid}');
    assert.ok(i > -1, 'a media query da barra existe');
    const bloco = fatia(css, i);
    assert.doesNotMatch(bloco, /body \.fab\{bottom/, 'já não há um FAB a posicionar por cima da barra');
    assert.match(bloco, /\.wrap\{padding-bottom:calc\(96px/, 'o conteúdo não fica debaixo da barra');
    assert.match(css, /\.nav-criar\{/, 'o «Criar» da barra lateral');
    assert.match(css, /#hdrAcao:empty\{display:none\}/, 'a ação do cabeçalho, escondida quando não há');
  });

  test('docs/design.md cita o + e a folha, e diz que o FAB saiu de todos os ecrãs', () => {
    assert.ok(md.includes('estilos.css:.tabmais'));
    assert.ok(md.includes('navegacao.js:abrirAdicionar'));
    assert.ok(md.includes('acessos.js:acoesDeAdicionar'));
    const fita = md.split(/\r?\n## /).find((s) => s.startsWith('A fita da barra de baixo'));
    assert.ok(fita && /estilos\.css:\.tabmais/.test(fita) && /navegacao\.js:abrirAdicionar/.test(fita), 'na secção da barra');
    // o markdown embrulha a 76 colunas: lê-se numa linha só
    assert.match(md.replace(/\s+/g, ' '), /O FAB saiu de todos os ecrãs/, 'o FAB saiu: cria-se no + e no «Criar»');
  });
});
