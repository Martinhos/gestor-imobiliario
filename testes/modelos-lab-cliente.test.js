// A janela dos modelos de dados do Lab (web/cloud/modelos.js, KAN-167), na
// app inteira com a API simulada: o caminho das rotas (a app e o back
// office); as três ordens da lista (a personalizada, o nome à portuguesa, a
// criação dos mais recentes primeiro); a lista (o nome do cenário ou o dado,
// o selo da origem, «Remover» só nos que não são de base, «Usar» desligado
// numa conta normal, o texto escapado e sem style= nem on…=); um cenário
// construído num db à parte e exportado como a sincronização exporta, com o
// db da app intacto; a confirmação que diz o que se perde; substituir (envia o
// que está por enviar, manda a confirmação e as entidades, lê o estado, fecha
// as janelas) e a recusa escrita na janela; gravar com o nome obrigatório;
// remover com o Anular; e as setas da pega a mudar a ordem.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { carregarTudo, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const app = carregarTudo();
// o modelos.js entra aqui enquanto o arnês não o carrega com a nuvem
if (typeof app.mdlAbrir !== 'function') {
  vm.runInContext(readFileSync(new URL('../web/cloud/modelos.js', import.meta.url), 'utf8'), app.__ctx);
}
afterEach(() => repor(app));
afterEach(() => zerar());

/* Devolve o modelos.js e a sessão ao estado de quando carregaram.
   Devolve: nada. */
function zerar() {
  vm.runInContext('mdlLista={modelos:null,falhou:false,aPedir:null};mdlCamada=null;mdlOrdemAqui="";mdlArr=null;mdlOcupado=false;' +
    'localStorage.clear();modalStack.length=0;seloAplicado="";CW.ambiente="producao";CW.user=null;', app.__ctx);
}

/* Uma sessão no dev, numa conta de teste (ou normal).
   Recebe: deTeste — true para uma conta do /test.
   Devolve: nada. */
function noDev(deTeste = true) {
  app.CW.ambiente = 'dev';
  app.CW.user = { id: 'U1', name: 'Maria Costa', email: deTeste ? 'abc@teste.rendorium.com' : 'maria@exemplo.pt' };
}

/* Uma API simulada que guarda os pedidos e responde pelo mapa dado.
   Recebe: respostas — {'MÉTODO caminho': valor, Error ou função(dados)}.
   Devolve: a lista dos pedidos ([método, caminho, dados]). */
function apiFalsa(respostas = {}) {
  const pedidos = [];
  app.api = (m, p, d) => {
    pedidos.push([m, p, d === undefined ? undefined : JSON.parse(JSON.stringify(d))]);
    const chave = m + ' ' + p.replace(/\?.*$/, '');
    const r = chave in respostas ? respostas[chave] : (m === 'GET' ? { modelos: [] } : { ok: true });
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(typeof r === 'function' ? r(d) : r);
  };
  return pedidos;
}

// os modelos de uma pessoa, como o GET /api/modelos os dá
const MODELOS = [
  { id: 'm1', tipo: 'cenario', cenario: 'teste-lab', nome: null, ordem: 0, origem: 'base', ticket: null, criadoEm: 100, resumo: null },
  { id: 'm2', tipo: 'dados', cenario: null, nome: 'Árvore <b>', ordem: 1, origem: 'pessoa', ticket: null, criadoEm: 300, resumo: { imoveis: 2, contratos: 1, pessoas: 0, movimentos: 5, planeados: 0 } },
  { id: 'm3', tipo: 'cenario', cenario: 'teste-lab', nome: 'beta', ordem: 2, origem: 'ticket', ticket: 'KAN-127', criadoEm: 200, resumo: null },
];

/* O cenário de teste: um imóvel com um contrato e uma renda, a ficha da
   conta com o NIF preenchido, construído com as funções da app.
   Devolve: o cenário ({id, nome, descricao, construir}). */
function cenarioDeTeste() {
  return vm.runInContext(`({ id: 'teste-lab', nome: 'Teste do Lab', descricao: 'Um imóvel e um contrato.', construir: function () {
    var p = normProp({ name: 'T1 do modelo', use: 'investimento', ownerIds: [meuId()] });
    var c = normContract({ propertyId: p.id, rent: 600, payDay: 8, start: YEAR + '-01-01' });
    return { owners: [Object.assign({}, owner(meuId()) || { id: meuId() }, { nif: '210000007' })], properties: [p], tenants: [], contracts: [c],
      transactions: [normTx({ kind: 'income', label: 'Renda', amount: 600, date: YEAR + '-01-08', propertyId: p.id, contractId: c.id })],
      templates: [], recurring: [] };
  } })`, app.__ctx);
}

/* Põe os modelos na lista e a janela aberta, com a API simulada.
   Recebe: respostas (opcional) — as da apiFalsa.
   Devolve: {abertas, pedidos}. */
async function abrir(respostas) {
  const abertas = janelasFalsas(app, 'render', 'save', 'toast');
  const pedidos = apiFalsa(Object.assign({ 'GET /api/modelos': { modelos: JSON.parse(JSON.stringify(MODELOS)) } }, respostas || {}));
  const cen = cenarioDeTeste();
  app.mdlCenarios = () => [cen];
  app.mdlAbrir();
  await app.mdlCarregar();
  return { abertas, pedidos };
}

describe('o caminho e a ordem', () => {
  test('na app as rotas são /api/modelos; no back office, /api/equipa/modelos', () => {
    assert.equal(app.mdlCaminho('/api/modelos/x/usar'), '/api/modelos/x/usar');
    vm.runInContext('globalThis.QA_EQUIPA = { app: false };', app.__ctx);
    try {
      assert.equal(app.mdlCaminho('/api/modelos'), '/api/equipa/modelos');
      assert.equal(app.mdlCaminho('/api/modelos?base=a'), '/api/equipa/modelos?base=a');
      assert.equal(app.mdlCaminho('/api/modelos/x/usar'), '/api/equipa/modelos/x/usar');
      assert.equal(app.mdlComConta(), false);
    } finally { vm.runInContext('delete globalThis.QA_EQUIPA;', app.__ctx); }
  });

  test('a personalizada, o nome (à portuguesa) e a criação (os mais recentes primeiro)', () => {
    app.mdlCenarios = () => [cenarioDeTeste()];
    const ids = (o) => JSON.parse(JSON.stringify(app.mdlOrdenados(MODELOS, o).map((m) => m.id)));
    assert.deepEqual(ids('personalizada'), ['m1', 'm2', 'm3']);
    assert.deepEqual(ids('nome'), ['m2', 'm3', 'm1']);   // Árvore, beta, Teste do Lab
    assert.deepEqual(ids('criacao'), ['m2', 'm3', 'm1']);
    assert.equal(app.mdlOrdem(), 'personalizada');
    app.mdlOrdenar('nome');
    assert.equal(app.mdlOrdem(), 'nome');
    app.mdlOrdenar('nada');
    assert.equal(app.mdlOrdem(), 'nome');
  });
});

describe('a lista', () => {
  test('pede a lista com os cenários de base e escreve cada modelo', async () => {
    noDev();
    const { abertas, pedidos } = await abrir();
    assert.equal(abertas[0].t, 'Modelos de dados');
    assert.match(abertas[0].f, /Guardar como modelo novo/);
    assert.deepEqual(pedidos[0].slice(0, 2), ['GET', '/api/modelos?base=teste-lab']);
    const html = app.mdlHtmlLista();
    assert.match(html, /Teste do Lab/);
    assert.match(html, /Árvore &lt;b&gt;/);
    assert.doesNotMatch(html, /<b>'/);
    assert.match(html, /Do ticket KAN-127/);
    assert.match(html, /Gravado a [0-9/]+: 2 imóveis, 1 contrato e 5 movimentos\./);
    assert.match(html, /Arrasta pela pega/);
    assert.equal((html.match(/class="mdl-pega"/g) || []).length, 3);
    assert.equal((html.match(/mdlRemover\(/g) || []).length, 2, 'o de base não tem Remover');
    assert.equal((html.match(/data-risco="destroi"/g) || []).length, 2);
    assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/);
    assert.doesNotMatch(html, /mdl-usar"[^>]*disabled/);
    // KAN-167-2: tocar na linha usa o modelo — o texto é o botão, e já não há um «Usar» à parte
    assert.match(html, /<button type="button" class="mdl-texto mdl-usar" data-toca="camada" aria-label="Usar o modelo Teste do Lab" aria-describedby="mdlDesc-m1" data-click="mdlUsar\('m1'\)"><span class="mdl-cima"><b class="mdl-nome">Teste do Lab<\/b>/);
    assert.doesNotMatch(html, />Usar</, 'sem o botão «Usar»');
    assert.match(html, /<span class="small mdl-desc" id="mdlDesc-m1">/);
    app.mdlOrdenar('nome');
    assert.doesNotMatch(app.mdlHtmlLista(), /mdl-pega/, 'sem pega fora da ordem personalizada');
  });

  test('numa conta normal tocar no modelo não o usa: a linha diz porquê, e a janela também', async () => {
    noDev(false);
    await abrir();
    assert.match(app.mdlHtmlJanela(), /Esta conta não é de teste/);
    assert.match(app.mdlHtmlLista(), /mdl-usar" data-toca="camada" aria-disabled="true"/);
    assert.doesNotMatch(app.mdlHtmlLista(), /mdl-usar"[^>]*\sdisabled/, 'aria-disabled, e não disabled: o toque chega e diz porquê');
    const toasts = [];
    app.toast = (t) => toasts.push(t);
    app.mdlUsar('m1');
    assert.deepEqual(toasts, ['Só se usa um modelo numa conta de teste.']);
  });

  test('nas páginas públicas só se organiza: sem «Usar» nem «Guardar», com o aviso', async () => {
    noDev();
    vm.runInContext('globalThis.QA_PAGINAS = { ambiente: "dev" };', app.__ctx);
    try {
      const { abertas } = await abrir();
      assert.equal(app.mdlComConta(), false);
      assert.doesNotMatch(abertas[0].f, /Guardar como modelo novo/);
      assert.doesNotMatch(app.mdlHtmlLista(), /mdl-usar/);
      assert.match(app.mdlHtmlJanela(), /Aqui organizas os teus modelos/);
      assert.match(app.mdlHtmlLista(), /Renomear/);
      assert.equal(app.mdlCaminho('/api/modelos'), '/api/modelos', 'as rotas da app, com o cookie');
    } finally { vm.runInContext('delete globalThis.QA_PAGINAS;', app.__ctx); }
  });

  test('um cenário que esta versão não tem diz que já não existe e não se usa', async () => {
    noDev();
    await abrir({ 'GET /api/modelos': { modelos: [{ id: 'mx', tipo: 'cenario', cenario: 'antigo', nome: null, ordem: 0, origem: 'base', criadoEm: 1 }] } });
    assert.match(app.mdlHtmlLista(), /já não existe nesta versão/);
    assert.match(app.mdlHtmlLista(), /disabled/);
  });
});

describe('um cenário, construído à parte', () => {
  test('exporta as entidades como a sincronização, e o db da app fica como estava', () => {
    noDev();
    limpar(app);
    app.db.owners = [app.normPerson({ name: 'Maria Costa' })];
    app.db.owners[0].id = 'U1';
    const antes = JSON.stringify(app.db);
    const es = JSON.parse(JSON.stringify(app.mdlEntidadesDoCenario(cenarioDeTeste())));
    assert.equal(JSON.stringify(app.db), antes);
    const casa = es.find((e) => e.scope === 'house');
    assert.equal(casa.data.name, 'T1 do modelo');
    const chaves = es.map((e) => e.scope + ':' + (e.kind || 'house')).sort();
    assert.ok(chaves.includes('record:contract'));
    assert.ok(chaves.includes('record:tx'));
    assert.ok(chaves.includes('record:rec'), 'o planeado da renda nasce do contrato, como no seed');
    assert.ok(chaves.includes('user:settings'));
    const perfil = es.find((e) => e.kind === 'profile');
    assert.equal(perfil.data.nif, '210000007');
    assert.equal(perfil.data.name, 'Maria Costa');
    assert.ok(es.filter((e) => e.scope === 'record').every((e) => e.houseId === casa.houseId));
  });
});

describe('substituir os dados', () => {
  test('a confirmação diz o modelo e o que se perde', async () => {
    noDev();
    limpar(app);
    const { abertas } = await abrir();
    app.db.properties = [app.normProp({ name: 'Minha' }), Object.assign(app.normProp({ name: 'Dele' }), { _sharedFrom: 'Outro' })];
    app.db.contracts = [app.normContract({ propertyId: app.db.properties[0].id, rent: 1 })];
    app.mdlUsar('m1');
    const j = abertas[abertas.length - 1];
    assert.equal(j.t, 'Substituir os dados?');
    assert.match(j.b, /Substituir os dados desta conta pelo modelo «Teste do Lab»\?/);
    assert.match(j.b, /Perdes o que esta conta tem: 1 imóvel e 1 contrato, com as fotos e os anexos\. Não se desfaz\./);
    assert.match(j.b, /1 imóvel partilhado por outras contas fica como está/);
    assert.match(j.f, /class="btn danger"[^>]*data-risco="destroi"[^>]*>Substituir os dados</);
    limpar(app);
    app.mdlUsar('m1');
    assert.match(abertas[abertas.length - 1].b, /ainda não tem dados: não se perde nada/);
  });

  test('envia o que está por enviar, manda a confirmação e as entidades, lê o estado e fecha', async () => {
    noDev();
    limpar(app);
    const { pedidos } = await abrir({ 'POST /api/modelos/m1/usar': { ok: true, resumo: {} } });
    const passos = [];
    app.pushNow = () => { passos.push('push'); return Promise.resolve(); };
    app.mdlPorEnviar = () => 0;
    app.pullNow = (f) => { passos.push('pull:' + f); vm.runInContext('seloAplicado = "selo-novo";', app.__ctx); return Promise.resolve(); };
    const toasts = [];
    app.toast = (t) => toasts.push(t);
    await app.mdlConfirmarUsar('m1');
    const usar = pedidos.find((p) => p[1] === '/api/modelos/m1/usar');
    assert.equal(usar[0], 'POST');
    assert.equal(usar[2].confirmar, 'substituir');
    assert.ok(usar[2].entidades.some((e) => e.scope === 'house'));
    assert.deepEqual(passos, ['push', 'pull:true']);
    assert.equal(app.modalStack.length, 0);
    assert.deepEqual(toasts, ['Os dados desta conta são agora os do modelo «Teste do Lab».']);
    // sem o estado lido (sem rede), o aviso diz que a app os mostra quando a ligação voltar
    app.pullNow = () => Promise.resolve();
    app.mdlAbrir();
    await app.mdlCarregar();
    await app.mdlConfirmarUsar('m1');
    assert.equal(toasts[1], 'Os dados foram trocados no servidor. A app mostra-os quando a ligação voltar.');
  });

  test('um modelo gravado não manda entidades; uma recusa fica escrita na janela e nada se lê', async () => {
    noDev();
    const erro = Object.assign(new Error('Só se substituem os dados de uma conta de teste.'), { status: 403 });
    const { pedidos } = await abrir({ 'POST /api/modelos/m2/usar': erro });
    app.pushNow = () => Promise.resolve();
    app.mdlPorEnviar = () => 0;
    let leu = false;
    app.pullNow = () => { leu = true; return Promise.resolve(); };
    const e = { textContent: '' }, b = { disabled: false, textContent: '' };
    const getById = app.document.getElementById;
    app.document.getElementById = (id) => (id === 'mdl_usar_e' ? e : id === 'mdl_usar_ok' ? b : getById(id));
    await app.mdlConfirmarUsar('m2');
    assert.deepEqual(pedidos.find((p) => p[1] === '/api/modelos/m2/usar')[2], { confirmar: 'substituir' });
    assert.equal(e.textContent, 'Só se substituem os dados de uma conta de teste.');
    assert.equal(b.disabled, false);
    assert.equal(leu, false);
  });

  test('com alterações por enviar que não sobem, não pede a troca', async () => {
    noDev();
    const { pedidos } = await abrir();
    app.pushNow = () => Promise.resolve();
    app.mdlPorEnviar = () => 2;
    await app.mdlConfirmarUsar('m1');
    assert.ok(!pedidos.some((p) => /usar$/.test(p[1])));
  });
});

describe('gravar, remover e a ordem', () => {
  test('gravar pede o nome, envia o pendente e junta o modelo novo à lista', async () => {
    noDev();
    const novo = { id: 'm9', tipo: 'dados', nome: 'Novo', ordem: 3, origem: 'pessoa', criadoEm: 400, resumo: {} };
    const { abertas, pedidos } = await abrir({ 'POST /api/modelos': { modelo: novo } });
    app.pushNow = () => Promise.resolve();
    app.mdlPorEnviar = () => 0;
    app.mdlGuardarNovo();
    assert.equal(abertas[abertas.length - 1].t, 'Guardar como modelo novo');
    assert.match(abertas[abertas.length - 1].b, /Nome <span class="req">\*<\/span>/);
    const campo = { value: '  ', getAttribute: () => 'gravar', focus() {} }, erro = { textContent: '' };
    const getById = app.document.getElementById;
    app.document.getElementById = (id) => (id === 'mdl_nome' ? campo : id === 'mdl_nome_e' ? erro : getById(id));
    await app.mdlGravar();
    assert.equal(erro.textContent, 'Escreve o nome do modelo.');
    assert.ok(!pedidos.some((p) => p[0] === 'POST'));
    campo.value = ' Novo ';
    await app.mdlGravar();
    assert.deepEqual(pedidos.find((p) => p[0] === 'POST'), ['POST', '/api/modelos', { nome: 'Novo' }]);
    assert.ok(app.mdlDe('m9'));
  });

  test('remover tira logo da lista e o Anular repõe', async () => {
    noDev();
    const { pedidos } = await abrir();
    let anular = null;
    app.toast = (t, op) => { if (op) anular = op.fn; };
    await app.mdlRemover('m2');
    assert.equal(app.mdlDe('m2'), null);
    assert.deepEqual(pedidos.find((p) => p[0] === 'DELETE').slice(0, 2), ['DELETE', '/api/modelos/m2']);
    anular();
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(pedidos.some((p) => p[0] === 'POST' && p[1] === '/api/modelos/m2/repor'));
    assert.ok(app.mdlDe('m2'));
  });

  test('a ordem nova guarda-se, e volta à de antes se o servidor recusar', async () => {
    noDev();
    const { pedidos } = await abrir({ 'PUT /api/modelos/ordem': new Error('Não deu.') });
    await app.mdlGuardarOrdem(['m3', 'm1', 'm2']);
    assert.deepEqual(pedidos.find((p) => p[0] === 'PUT')[2], { ids: ['m3', 'm1', 'm2'] });
    assert.deepEqual(JSON.parse(JSON.stringify(app.mdlOrdenados(app.mdlLista.modelos, 'personalizada').map((m) => m.id))), ['m1', 'm2', 'm3']);
  });
});
