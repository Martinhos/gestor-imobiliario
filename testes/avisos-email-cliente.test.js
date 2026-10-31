// Os avisos por email dos planeados em atraso do lado da app
// (web/cloud/avisos-email.js): a linha «Avisos por email» das Definições, só
// com sessão, um interruptor (role=switch, aria-checked) com o estado em
// palavras e na cor da frente; a escolha lê-se (GET /api/conta/avisos) e
// grava-se (POST com {email}), com um aviso a dizer o que ficou, e uma falha
// não muda nada e diz-o; e as ligações do email, /?avisos e /?planeados, que
// abrem a raiz das Definições com a linha em foco e os Planeados (ou a Visão
// geral, com o serviço desligado), tiram a chave do endereço e, sem sessão,
// esperam pela entrada. A app inteira, nuvem incluída, com a API simulada.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { carregarTudo, repor, elementos } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
// o estado do avisos-email.js e da sessão volta ao do arranque (não passa pelo proxy)
afterEach(() => zerar());

const SEM_EM_LINHA = /\sstyle=|\son[a-z]+\s*=/i;
const LIGADO = 'Ligado: um email no dia em que um planeado fica em atraso';
const DESLIGADO = 'Desligado: não te mandamos estes avisos';

/* Devolve o avisos-email.js ao estado de quando carregou, sem sessão, nas
   Definições fechadas e com os serviços todos ligados.
   Devolve: nada. */
function zerar() {
  vm.runInContext('aveEmail=undefined;aveEmailDe="";aveAPedir=false;aveFalhouLer=false;aveAMudar=false;aveDestino="";' +
    'CW.user=null;tab="dashboard";setPage="";definirServicosDesligados([]);', app.__ctx);
}

/* Uma conta com sessão (e o ecrã de entrada fechado).
   Recebe: id (opcional) — o id da conta.
   Devolve: nada. */
function comSessao(id = 'u1') {
  app.CW.user = { id, name: 'Maria Costa', email: 'maria@rendorium.test' };
  app.authEl = null;
}

/* Uma API simulada: guarda cada pedido e responde pelo que o teste disser.
   Recebe: respostas — {'MÉTODO /caminho': valor, função(dados) ou Error}.
   Devolve: a lista dos pedidos ([método, caminho, dados]). */
function apiFalsa(respostas = {}) {
  const pedidos = [];
  app.api = (m, p, d) => {
    pedidos.push([m, p, d === undefined ? undefined : JSON.parse(JSON.stringify(d))]);
    const r = respostas[m + ' ' + p];
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(typeof r === 'function' ? r(d) : (r === undefined ? {} : r));
  };
  return pedidos;
}

/* Os avisos (toast) que a app mostra.
   Devolve: o array dos textos. */
function avisos() {
  const lista = [];
  app.toast = (m) => lista.push(m);
  return lista;
}

/* Um sessionStorage de brincar, posto no contexto.
   Devolve: o objeto com os valores guardados. */
function sessao() {
  const guardado = {};
  app.sessionStorage = {
    getItem: (k) => (k in guardado ? guardado[k] : null),
    setItem: (k, v) => { guardado[k] = String(v); },
    removeItem: (k) => { delete guardado[k]; },
  };
  return guardado;
}

/* O endereço com esta pesquisa, e o replaceState a apontar o que fica.
   Recebe: search — o location.search.
   Devolve: o array dos endereços passados ao replaceState. */
function endereco(search) {
  const trocas = [];
  app.location.search = search;
  app.location.hash = '';
  app.history.replaceState = (_, __, url) => { trocas.push(url); };
  return trocas;
}

/* A linha das Definições, a ver se recebe o foco e se rola até ela.
   Devolve: {foco, rolou} — contadores. */
function linhaEspiada() {
  const conta = { foco: 0, rolou: 0 };
  const b = app.document.getElementById('aveDefinicoes');
  b.focus = () => { conta.foco++; };
  b.scrollIntoView = () => { conta.rolou++; };
  return conta;
}

/* Espera que as microtarefas e as promessas da app corram.
   Devolve: Promise. */
const assentar = () => new Promise((r) => setImmediate(r));

describe('a linha das Definições', () => {
  test('só aparece com sessão, na secção Conta, a seguir à Segurança', () => {
    assert.doesNotMatch(app.raizDasDefinicoes(), /id="aveDefinicoes"/, 'sem sessão, não aparece');
    comSessao();
    vm.runInContext('aveEmail=true;aveEmailDe="u1"', app.__ctx);
    const raiz = app.raizDasDefinicoes();
    assert.match(raiz, /id="aveDefinicoes"/);
    const conta = raiz.slice(raiz.indexOf('<h2 class="def-sec-tit">Conta</h2>'), raiz.indexOf('</section>'));
    assert.ok(conta.indexOf('>Segurança<') > -1 && conta.indexOf('>Segurança<') < conta.indexOf('id="aveDefinicoes"'), 'na Conta, depois da Segurança');
  });

  test('é um interruptor com o estado em palavras, e ligado na cor da frente', () => {
    comSessao();
    vm.runInContext('aveEmail=true;aveEmailDe="u1"', app.__ctx);
    let h = app.aveLinhaDasDefinicoes();
    assert.match(h, /^<button type="button" class="linha def-linha ave-def" id="aveDefinicoes" role="switch" aria-checked="true"/);
    assert.match(h, /data-toca="dados" data-click="aveMudarNasDefinicoes\(\)"/);
    assert.match(h, /<b class="u-d-block">Avisos por email<\/b>/);
    assert.match(h, new RegExp('<span class="small ave-def-ligado">' + LIGADO + '</span>'), 'ligado: as palavras e a cor da frente');
    assert.match(h, /<span class="interruptor" aria-hidden="true"><\/span>/);
    assert.doesNotMatch(h, /aria-busy|disabled/);
    assert.ok(!SEM_EM_LINHA.test(h), 'sem style= nem on…=');
    vm.runInContext('aveEmail=false', app.__ctx);
    h = app.aveLinhaDasDefinicoes();
    assert.match(h, /aria-checked="false"/);
    assert.match(h, new RegExp('<span class="small">' + DESLIGADO + '</span>'));
    assert.ok(!SEM_EM_LINHA.test(h));
  });

  test('a escolha de outra conta não conta: por saber, diz que está a ler', () => {
    comSessao('u2');
    vm.runInContext('aveEmail=true;aveEmailDe="u1";aveAPedir=true', app.__ctx);
    const h = app.aveLinhaDasDefinicoes();
    assert.match(h, /aria-checked="false"/);
    assert.match(h, /A ler a tua escolha…/);
    assert.match(h, /aria-busy="true" aria-disabled="true"/, 'ocupada, mas não disabled: o foco fica nela');
    assert.doesNotMatch(h, /\sdisabled/);
  });

  test('com o serviço dos Planeados desligado, não aparece', () => {
    comSessao();
    vm.runInContext('aveEmail=true;aveEmailDe="u1";definirServicosDesligados(["recurring"])', app.__ctx);
    assert.doesNotMatch(app.raizDasDefinicoes(), /id="aveDefinicoes"/);
  });
});

describe('ler a escolha', () => {
  test('pinta-se a raiz das Definições com sessão: pede-a uma vez e mostra-a', async () => {
    comSessao();
    const pedidos = apiFalsa({ 'GET /api/conta/avisos': { email: false } });
    app.tab = 'settings'; app.setPage = '';
    app.render();
    app.render();
    assert.deepEqual(pedidos.map((p) => p[0] + ' ' + p[1]), ['GET /api/conta/avisos'], 'um pedido só, mesmo com dois render');
    assert.match(app.aveLinhaDasDefinicoes(), /A ler a tua escolha…/);
    await assentar();
    assert.equal(app.aveEmail, false);
    assert.match(elementos(app).view.innerHTML, new RegExp(DESLIGADO), 'repintou com a escolha');
    app.render();
    assert.equal(pedidos.length, 1, 'sabida, não se pede outra vez');
  });

  test('sem sessão, ou fora da raiz das Definições, não pede', () => {
    const pedidos = apiFalsa({ 'GET /api/conta/avisos': { email: true } });
    app.tab = 'settings'; app.setPage = '';
    app.render();
    comSessao();
    app.tab = 'settings'; app.setPage = 'tema';
    app.render();
    app.tab = 'transactions'; app.setPage = '';
    app.render();
    assert.equal(pedidos.length, 0);
  });

  test('uma falha de rede no GET diz-se, não se repete sozinha, e o toque pede outra vez', async () => {
    comSessao();
    let falha = true;
    const pedidos = apiFalsa({ 'GET /api/conta/avisos': () => (falha ? Promise.reject(new Error('sem rede')) : { email: true }) });
    app.tab = 'settings'; app.setPage = '';
    app.render();
    await assentar();
    const h = app.aveLinhaDasDefinicoes();
    assert.match(h, /class="small ave-def-falhou">Não deu para ler a tua escolha. Toca para tentar outra vez</);
    assert.match(h, /aria-checked="false"/);
    assert.doesNotMatch(h, /aria-busy/);
    app.render();
    await assentar();
    assert.equal(pedidos.length, 1, 'a falha não se repete em cada render');
    falha = false;
    const toques = avisos();
    assert.equal(await app.aveMudarNasDefinicoes(), null, 'o toque só lê: não grava');
    assert.equal(pedidos.length, 2);
    assert.equal(pedidos.filter((p) => p[0] === 'POST').length, 0);
    assert.equal(app.aveEmail, true);
    assert.deepEqual(toques, []);
    assert.match(app.aveLinhaDasDefinicoes(), new RegExp(LIGADO));
  });

  test('uma resposta sem email booleano conta como falha', async () => {
    comSessao();
    apiFalsa({ 'GET /api/conta/avisos': { email: 'sim' } });
    app.aveLer();
    await assentar();
    assert.equal(app.aveSabido(), null);
    assert.equal(app.aveFalhouLer, true);
  });

  test('a conta que muda esquece a escolha da de antes e pede a dela', async () => {
    comSessao('u1');
    const pedidos = apiFalsa({ 'GET /api/conta/avisos': { email: true } });
    app.tab = 'settings'; app.setPage = '';
    app.render();
    await assentar();
    assert.equal(app.aveSabido(), true);
    comSessao('u2');
    apiFalsa({ 'GET /api/conta/avisos': { email: false } });
    app.render();
    await assentar();
    assert.equal(app.aveEmailDe, 'u2');
    assert.equal(app.aveSabido(), false);
    assert.equal(pedidos.length, 1);
  });
});

describe('mudar a escolha', () => {
  test('tocar grava a contrária com {email} e diz o que ficou num aviso', async () => {
    comSessao();
    const pedidos = apiFalsa({ 'POST /api/conta/avisos': (d) => ({ email: d.email }) });
    const toques = avisos();
    vm.runInContext('aveEmail=true;aveEmailDe="u1"', app.__ctx);
    assert.equal(await app.aveMudarNasDefinicoes(), true);
    assert.equal(app.aveEmail, false);
    assert.equal(await app.aveMudarNasDefinicoes(), true);
    assert.equal(app.aveEmail, true);
    assert.deepEqual(pedidos, [['POST', '/api/conta/avisos', { email: false }], ['POST', '/api/conta/avisos', { email: true }]]);
    assert.deepEqual(toques, ['Avisos desligados. Deixamos de te mandar emails dos planeados em atraso.',
      'Avisos ligados. Mandamos-te um email no dia em que um planeado ficar em atraso.']);
  });

  test('vale o que o servidor devolve', async () => {
    comSessao();
    apiFalsa({ 'POST /api/conta/avisos': { email: true } });
    const toques = avisos();
    vm.runInContext('aveEmail=true;aveEmailDe="u1"', app.__ctx);
    await app.aveMudarNasDefinicoes();
    assert.equal(app.aveEmail, true);
    assert.match(toques[0], /^Avisos ligados/);
  });

  test('uma falha de rede no POST não muda o estado e diz-o', async () => {
    comSessao();
    const pedidos = apiFalsa({ 'POST /api/conta/avisos': new Error('sem rede') });
    const toques = avisos();
    vm.runInContext('aveEmail=false;aveEmailDe="u1"', app.__ctx);
    assert.equal(await app.aveMudarNasDefinicoes(), false);
    assert.equal(pedidos.length, 1);
    assert.equal(app.aveEmail, false, 'fica como estava');
    assert.equal(app.aveAMudar, false);
    assert.deepEqual(toques, ['Não deu para mudar os avisos. Tenta outra vez.']);
    assert.match(app.aveLinhaDasDefinicoes(), /aria-checked="false"/);
  });

  test('um segundo toque a meio da gravação não faz nada', async () => {
    comSessao();
    let soltar;
    const pedidos = apiFalsa({ 'POST /api/conta/avisos': (d) => new Promise((r) => { soltar = () => r({ email: d.email }); }) });
    const toques = avisos();
    vm.runInContext('aveEmail=true;aveEmailDe="u1"', app.__ctx);
    const primeiro = app.aveMudarNasDefinicoes();
    assert.match(app.aveLinhaDasDefinicoes(), /aria-busy="true" aria-disabled="true"/, 'ocupada enquanto grava');
    assert.equal(app.aveMudarNasDefinicoes(), null);
    assert.equal(app.aveMudarNasDefinicoes(), null);
    soltar();
    assert.equal(await primeiro, true);
    assert.equal(pedidos.length, 1);
    assert.equal(app.aveEmail, false);
    assert.equal(toques.length, 1);
  });

  test('a repintura devolve o foco à linha', async () => {
    comSessao();
    apiFalsa({ 'POST /api/conta/avisos': (d) => ({ email: d.email }) });
    avisos();
    app.tab = 'settings'; app.setPage = '';
    vm.runInContext('aveEmail=true;aveEmailDe="u1"', app.__ctx);
    const conta = linhaEspiada();
    await app.aveMudarNasDefinicoes();
    assert.ok(conta.foco >= 1);
    assert.match(elementos(app).view.innerHTML, new RegExp(DESLIGADO));
  });

  test('sem sessão, o toque não grava', () => {
    const pedidos = apiFalsa({});
    assert.equal(app.aveMudarNasDefinicoes(), null);
    assert.equal(pedidos.length, 0);
  });
});

describe('as ligações do email', () => {
  test('lê o destino entre outros parâmetros, com ou sem valor', () => {
    const d = (s) => JSON.parse(JSON.stringify(app.aveDestinoDoEndereco(s)));
    assert.deepEqual(d('?avisos'), { destino: 'avisos', resto: '' });
    assert.deepEqual(d('?planeados=1'), { destino: 'planeados', resto: '' });
    assert.deepEqual(d('?utm_source=email&avisos&x=2'), { destino: 'avisos', resto: 'utm_source=email&x=2' });
    assert.deepEqual(d('?avisosx=1&criar=1'), { destino: '', resto: 'avisosx=1&criar=1' });
    assert.deepEqual(d(''), { destino: '', resto: '' });
    assert.deepEqual(d(undefined), { destino: '', resto: '' });
  });

  test('/?avisos com sessão abre a raiz das Definições com a linha à vista e em foco, e a chave sai do endereço', () => {
    comSessao();
    sessao();
    apiFalsa({ 'GET /api/conta/avisos': { email: true } });
    const trocas = endereco('?avisos&utm_source=email');
    app.location.hash = '#x';
    assert.equal(app.aveApanharDoEndereco(), 'avisos');
    assert.deepEqual(trocas, ['/?utm_source=email#x'], 'os outros parâmetros ficam');
    app.tab = 'settings'; app.setPage = 'tema';
    const conta = linhaEspiada();
    assert.equal(app.aveTentarDestino(), 'avisos');
    assert.equal(app.tab, 'settings');
    assert.equal(app.setPage, '', 'a raiz, e não a subpágina');
    assert.match(elementos(app).view.innerHTML, /id="aveDefinicoes"/);
    assert.equal(conta.rolou, 1);
    assert.equal(conta.foco, 1);
    assert.equal(app.aveTentarDestino(), '', 'cumpre-se uma vez');
  });

  test('/?avisos: os renders que vêm a seguir (o estado, a escolha lida) devolvem o foco à linha, e só durante a janela e na raiz', () => {
    comSessao();
    sessao();
    apiFalsa({ 'GET /api/conta/avisos': { email: true } });
    endereco('?avisos');
    app.aveApanharDoEndereco();
    const conta = linhaEspiada();
    app.aveTentarDestino();
    const depoisDoDestino = conta.foco;
    app.render();
    assert.ok(conta.foco > depoisDoDestino, 'um render a seguir devolve o foco (no browser refazia o botão e o foco caía)');
    // passada a janela, deixa de segurar
    app.aveFocoAte = 1;
    const antes = conta.foco;
    app.render();
    assert.equal(conta.foco, antes, 'fora da janela, o render não mexe no foco');
    assert.equal(app.aveFocoAte, 0);
    // fora da raiz também larga
    app.aveTentarDestino();
    app.aveFocoAte = Date.now() + 5000;
    app.setPage = 'tema';
    app.render();
    assert.equal(app.aveFocoAte, 0, 'numa subpágina deixa de segurar');
    app.setPage = '';
  });

  test('só a chave sai: sem mais nada, o endereço fica sem pesquisa', () => {
    sessao();
    const trocas = endereco('?planeados');
    app.aveApanharDoEndereco();
    assert.deepEqual(trocas, ['/']);
    const outras = endereco('?criar=1');
    assert.equal(app.aveApanharDoEndereco(), '');
    assert.deepEqual(outras, [], 'sem destino, o endereço não se mexe');
  });

  test('/?planeados com sessão abre os Planeados', () => {
    comSessao();
    sessao();
    endereco('?planeados');
    app.aveApanharDoEndereco();
    assert.equal(app.aveTentarDestino(), 'planeados');
    assert.equal(app.tab, 'recurring');
  });

  test('/?planeados com o serviço desligado abre a Visão geral e diz porquê', () => {
    comSessao();
    sessao();
    const toques = avisos();
    vm.runInContext('definirServicosDesligados(["recurring"])', app.__ctx);
    app.tab = 'properties';
    endereco('?planeados');
    app.aveApanharDoEndereco();
    assert.equal(app.aveTentarDestino(), 'planeados');
    assert.equal(app.tab, 'dashboard');
    assert.deepEqual(toques, ['O serviço Planeados está desligado nesta conta.']);
  });

  test('sem sessão, o destino espera pela entrada e cumpre-se depois de entrar', () => {
    const guardado = sessao();
    const trocas = endereco('?avisos');
    app.aveApanharDoEndereco();
    assert.deepEqual(trocas, ['/'], 'a chave sai já do endereço');
    assert.equal(app.aveTentarDestino(), '');
    assert.equal(app.tab, 'dashboard');
    assert.equal(guardado.gi_ave_destino, 'avisos', 'espera nesta sessão do browser');
    // um recarregar perde a memória da página, e o sessionStorage guarda-o
    vm.runInContext('aveDestino=""', app.__ctx);
    assert.equal(app.aveDestinoGuardado(), 'avisos');
    // entrar: o finishLogin de antes põe a sessão e leva à Visão geral
    app.aveFinishLoginDeAntes = (u) => { app.CW.user = { id: u.id }; app.authEl = null; app.tab = 'dashboard'; };
    apiFalsa({ 'GET /api/conta/avisos': { email: true } });
    app.finishLogin({ id: 'u1', name: 'Maria', email: 'maria@rendorium.test' });
    assert.equal(app.tab, 'settings');
    assert.equal(app.setPage, '');
    assert.equal(guardado.gi_ave_destino, undefined, 'cumprido, esquece-se');
  });

  test('com o ecrã de entrada aberto, espera', () => {
    comSessao();
    sessao();
    app.authEl = { style: { display: 'flex' } };
    endereco('?planeados');
    app.aveApanharDoEndereco();
    assert.equal(app.aveTentarDestino(), '');
    app.authEl = { style: { display: 'none' } };
    assert.equal(app.aveTentarDestino(), 'planeados');
  });

  test('sem sessionStorage, o destino espera na memória da página', () => {
    app.sessionStorage = undefined;
    endereco('?avisos');
    assert.equal(app.aveApanharDoEndereco(), 'avisos');
    assert.equal(app.aveDestinoGuardado(), 'avisos');
    comSessao();
    apiFalsa({ 'GET /api/conta/avisos': { email: true } });
    assert.equal(app.aveTentarDestino(), 'avisos');
    assert.equal(app.aveDestinoGuardado(), '');
  });
});
