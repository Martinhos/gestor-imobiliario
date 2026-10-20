// A nuvem do cabeçalho diz em que estado está a ligação ao servidor: laranja
// com um relógio enquanto tenta ligar (desde a abertura e em cada nova
// tentativa depois de uma falha), verde quando o servidor responde, vermelha
// com uma cruz quando não responde, cobalto com o que está por enviar. Prova
// o selo (cloud/entrada.js:setSyncBadge), os ícones (icones.js), quando cada
// estado se põe (cloud/nucleo.js: tentarLigar, ligou, caiuALigacao, pullNow,
// pushNow, syncCycle, startSync, encerrarSessao), o arranque e as cores.
//
// A app carrega-se inteira (carregarTudo) com o fetch trocado por um espião
// que responde o que cada teste manda, como em correcao-nuvem.test.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarTudo } from './arnes.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// metade da árvore é CRLF: lê-se já normalizado
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8').replace(/\r\n/g, '\n');

/* Uma resposta de fetch a partir de {status, json, headers}, com o 304 sem
   corpo como o browser o entrega.
   Recebe: r — {status, json, headers}.
   Devolve: o objeto que o fetch resolveria. */
function resposta(r) {
  const cab = r.headers || {};
  const semCorpo = r.status === 304;
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    headers: { get: (k) => (k.toLowerCase() in cab ? cab[k.toLowerCase()] : null) },
    json: () => (semCorpo ? Promise.reject(new SyntaxError('sem corpo')) : Promise.resolve(r.json === undefined ? {} : r.json)),
    text: () => Promise.resolve(semCorpo ? '' : JSON.stringify(r.json === undefined ? {} : r.json)),
  };
}

/* O estado de GET /api/state de uma conta com uma casa (H1).
   Devolve: o estado (objeto novo). */
function ESTADO() {
  return {
    me: { id: 'EU', email: 'eu@x.pt', name: 'Eu' },
    servicos: { desligados: [] },
    profiles: [{ userId: 'EU', name: 'Eu', data: { id: 'EU', name: 'Eu' } }],
    people: [{ id: 'EU', name: 'Eu', kind: 'owner' }],
    proposals: [],
    houses: [{ id: 'H1', ownerId: 'EU', ownerName: 'Eu', mine: true, participants: ['EU'], collaborators: [], updatedAt: 1,
      data: { id: 'H1', name: 'T2 Lisboa', rooms: [] } }],
    records: [],
    userRecords: [{ kind: 'settings', id: 'main', updatedAt: 1, data: {} }],
    roles: [], collaborators: [], invites: [], shareLink: null,
    shareRequests: { incoming: [], outgoing: [] }, connections: [],
  };
}

// O servidor de pé: o estado com ETag, um 304 a quem mandar o mesmo selo, e o sync aceita tudo.
const servidorDePe = (m, url, body, p) => {
  if (url === '/api/state') {
    if (p.headers['If-None-Match'] === '"e1"') return { status: 304, headers: { etag: '"e1"' } };
    return { status: 200, json: ESTADO(), headers: { etag: '"e1"' } };
  }
  if (url === '/api/sync') return { status: 200, json: { results: ((body || {}).ops || []).map(() => ({ ok: true })) } };
  return { status: 200, json: {} };
};
// Sem rede: o fetch rejeita, como o browser offline.
const semRede = () => new TypeError('Failed to fetch');

/* A app com a nuvem por cima e os espiões: o fetch responde o que
   esp.responde disser (por omissão, o servidor de pé), os selos e os toasts
   guardam-se, o render não pinta, o ciclo de 30 s não se arma, e há sessão.
   Devolve: {app, esp}. */
function montar() {
  const app = carregarTudo();
  const esp = { pedidos: [], selos: [], toasts: [], responde: null };
  app.fetch = (url, opts) => {
    opts = opts || {};
    const body = opts.body ? JSON.parse(opts.body) : null;
    const pedido = { method: opts.method || 'GET', url, body, headers: Object.assign({}, opts.headers || {}) };
    esp.pedidos.push(pedido);
    const r = (esp.responde || servidorDePe)(pedido.method, url, body, pedido);
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(resposta(r));
  };
  app.toast = (m) => { esp.toasts.push(String(m)); };
  app.setSyncBadge = (s, n) => { esp.selos.push(n ? s + ':' + n : s); };
  app.render = () => {};
  app.buildNav = () => {};
  app.subirPendentes = () => {};
  app.scheduleReminders = () => {};
  app.setInterval = () => 0;
  app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt' };
  return { app, esp };
}

const assenta = async () => { for (let i = 0; i < 25; i++) await new Promise((r) => setImmediate(r)); };
const leituras = (esp) => esp.pedidos.filter((p) => p.url === '/api/state');

/* A ligação de pé e em dia: aplica o estado, desarma o push que o
   applyState agenda e envia já o que ficou por enviar (o perfil, as
   definições), para cada teste partir de nada pendente e sem selos.
   Recebe: app, esp.
   Devolve: Promise que acaba com tudo enviado. */
async function ligada(app, esp) {
  app.applyState(ESTADO(), '"e1"');
  app.clearTimeout(app.pushTimer);
  await app.pushNow();
  esp.selos.length = 0;
}

/* Um #hdrSync de mentira que guarda o que o setSyncBadge lhe escreve:
   classes, atributos e o HTML. A app passa a achá-lo pelo id.
   Recebe: app.
   Devolve: o elemento. */
function seloNoEcra(app) {
  const atr = {};
  const el = {
    className: '', innerHTML: '', title: '', atr,
    setAttribute(k, v) { atr[k] = String(v); },
    getAttribute(k) { return k in atr ? atr[k] : null; },
    removeAttribute(k) { delete atr[k]; },
    classList: { add(c) { if (!(' ' + el.className + ' ').includes(' ' + c + ' ')) el.className += ' ' + c; } },
  };
  const antes = app.document.getElementById;
  app.document.getElementById = (id) => (id === 'hdrSync' ? el : antes(id));
  return el;
}

// O setSyncBadge verdadeiro, com o #hdrSync de mentira (e sem espião por cima).
function comSelo() {
  const app = carregarTudo();
  const el = seloNoEcra(app);
  return { app, el };
}

describe('o selo (cloud/entrada.js:setSyncBadge)', () => {
  test('«A ligar»: laranja (.liga), a nuvem com o relógio, a frase no aria-label e no title, e anuncia-se', () => {
    const { app, el } = comSelo();
    app.setSyncBadge('liga');
    assert.equal(el.className, 'sync liga');
    assert.equal(el.title, 'A ligar ao servidor…');
    assert.equal(el.atr['aria-label'], 'A ligar ao servidor…');
    assert.equal(el.atr['aria-live'], 'polite');
    assert.ok(el.innerHTML.includes(app.ic('nuvemLiga', 18)), 'o ícone é a nuvem com o relógio');
    assert.match(el.innerHTML, /<span>A ligar ao servidor…<\/span>/);
  });

  test('«Sem ligação»: vermelho (.fora), a nuvem com a cruz; «Guardado» verde e recolhe; «por enviar» cobalto com a conta', () => {
    const { app, el } = comSelo();
    app.setSyncBadge('off');
    assert.equal(el.className, 'sync fora');
    assert.equal(el.title, 'Sem ligação ao servidor — sincroniza mais tarde');
    assert.ok(el.innerHTML.includes(app.ic('nuvemFora', 18)), 'o ícone é a nuvem com a cruz');
    assert.match(el.innerHTML, /<span>Sem ligação ao servidor<\/span>$/, 'à vista, a frase curta: a inteira comia o título no computador estreito');
    app.setSyncBadge('pend', 3);
    assert.equal(el.className, 'sync pend');
    assert.equal(el.title, '3 alterações por enviar');
    assert.ok(el.innerHTML.includes(app.ic('nuvemSobe', 18)));
    let recolhe = null;
    app.setTimeout = (f, ms) => { recolhe = { f, ms }; return 1; };
    app.setSyncBadge('ok');
    assert.equal(el.className, 'sync ok');
    assert.equal(el.title, 'Guardado');
    assert.ok(recolhe && recolhe.ms === 2000, 'o recibo recolhe ao fim de dois segundos');
    recolhe.f();
    assert.equal(el.className, 'sync ok recibo');
  });

  test('só o «Guardado» recolhe: o «A ligar», o «por enviar» e o «Sem ligação» ficam', () => {
    const { app } = comSelo();
    const tempos = [];
    app.setTimeout = (f, ms) => { tempos.push(ms); return 1; };
    app.setSyncBadge('liga');
    app.setSyncBadge('pend', 2);
    app.setSyncBadge('off');
    assert.deepEqual(tempos, []);
  });

  test('uma nova tentativa depois de uma falha fica com a faixa (.tenta) e não se anuncia; a falha repetida também não', () => {
    const { app, el } = comSelo();
    app.setSyncBadge('ok');
    app.setSyncBadge('off');
    assert.equal(el.atr['aria-live'], 'polite', 'a primeira falha diz-se');
    app.setSyncBadge('liga');
    assert.equal(el.className, 'sync liga tenta', 'a tentativa herda a faixa do «Sem ligação»');
    assert.equal(el.atr['aria-live'], 'off', 'a roda das tentativas não se anuncia');
    app.setSyncBadge('off');
    assert.equal(el.className, 'sync fora');
    assert.equal(el.atr['aria-live'], 'off', 'a mesma falha outra vez também não');
    app.setSyncBadge('liga');
    app.setSyncBadge('ok');
    assert.equal(el.className, 'sync ok');
    assert.equal(el.atr['aria-live'], 'polite', 'ligar outra vez diz-se');
  });

  test('o «A ligar» da abertura é só o ícone no telemóvel (sem .tenta); o mesmo selo duas vezes não se refaz', () => {
    const { app, el } = comSelo();
    app.setSyncBadge('liga');
    assert.equal(el.className, 'sync liga');
    el.innerHTML = 'marca';
    app.setSyncBadge('liga');
    assert.equal(el.innerHTML, 'marca', 'a abertura e o startSync dizem ambos «A ligar»: não se repinta nem se anuncia outra vez');
  });

  test('sem estado, o selo esvazia (e some pelo :empty)', () => {
    const { app, el } = comSelo();
    app.setSyncBadge('off');
    app.setSyncBadge('');
    assert.equal(el.innerHTML, '');
    assert.equal(el.className, '');
    assert.equal(el.getAttribute('aria-label'), null);
    assert.equal(el.title === '' || el.title === undefined || el.getAttribute('title') === null, true);
  });
});

describe('os ícones (icones.js)', () => {
  test('a nuvem com o relógio e a nuvem com a cruz existem, no mesmo traço, e são diferentes das outras', () => {
    const { app } = comSelo();
    const liga = app.ic('nuvemLiga', 18), fora = app.ic('nuvemFora', 18);
    assert.match(liga, /<circle cx="12" cy="16" r="4"\/>/, 'o mostrador do relógio');
    assert.match(liga, /stroke-width="1\.8"/);
    assert.match(fora, /M10 11l4 4M14 11l-4 4/, 'a cruz dentro da nuvem');
    assert.doesNotMatch(fora, /M4 4l16 16/, 'já não é o risco de lado a lado');
    const todos = ['nuvemLiga', 'nuvemOk', 'nuvemSobe', 'nuvemFora'].map((n) => app.ic(n, 18));
    assert.equal(new Set(todos).size, 4);
  });
});

describe('quando se põe cada estado (cloud/nucleo.js)', () => {
  test('a abertura: «A ligar» antes do primeiro /api/state, e «Guardado» quando ele responde', async () => {
    const { app, esp } = montar();
    app.startSync();
    assert.deepEqual(esp.selos, ['liga'], 'antes de o pedido acabar, só o «A ligar»');
    await assenta();
    app.clearTimeout(app.pushTimer);
    assert.equal(esp.selos[esp.selos.length - 1], 'ok');
  });

  test('a abertura sem rede: «A ligar» e depois «Sem ligação»', async () => {
    const { app, esp } = montar();
    esp.responde = semRede;
    app.startSync();
    await assenta();
    assert.deepEqual(esp.selos, ['liga', 'off']);
    assert.equal(app.semLigacao, true);
  });

  test('cada nova leitura depois de uma falha passa por «A ligar»: falha outra vez, «Sem ligação»; responde, «Guardado»', async () => {
    const { app, esp } = montar();
    await ligada(app, esp);
    esp.responde = semRede;
    await app.pullNow(true);
    assert.deepEqual(esp.selos.slice(-1), ['off']);
    esp.selos.length = 0;
    await app.pullNow(true);
    assert.deepEqual(esp.selos, ['liga', 'off'], 'a tentativa sem rede');
    esp.selos.length = 0;
    esp.responde = null;
    await app.pullNow(true);
    app.clearTimeout(app.pushTimer);
    assert.deepEqual(esp.selos, ['liga', 'ok'], 'a rede voltou: o 304 ao mesmo selo também conta como ligação');
    assert.equal(app.semLigacao, false);
  });

  test('com a ligação de pé, a leitura de fundo não pisca o «A ligar»', async () => {
    const { app, esp } = montar();
    await ligada(app, esp);
    await app.pullNow(true);   // a primeira leitura depois de enviar é inteira (o selo antigo já não vale)
    app.clearTimeout(app.pushTimer);
    assert.deepEqual(esp.selos, ['ok'], 'o estado aplicado é um recibo, sem passar por «A ligar»');
    esp.selos.length = 0;
    await app.pullNow(true);
    assert.equal(leituras(esp)[leituras(esp).length - 1].headers['If-None-Match'], '"e1"');
    assert.deepEqual(esp.selos, [], 'um 304 com a ligação de pé não diz nada');
  });

  test('um envio depois de uma falha é uma tentativa: «A ligar» em vez de «por enviar», e acaba em «Guardado» ou «Sem ligação»', async () => {
    const { app, esp } = montar();
    await ligada(app, esp);
    app.db.transactions.push(app.normTx({ id: 'T9', propertyId: 'H1', label: 'x', amount: 1, kind: 'expense', date: '2026-02-01' }));
    await app.pushNow();
    assert.deepEqual(esp.selos.slice(-2), ['pend:1', 'ok'], 'ligada: o «por enviar» e o recibo');
    app.db.transactions.push(app.normTx({ id: 'T8', propertyId: 'H1', label: 'y', amount: 2, kind: 'expense', date: '2026-02-02' }));
    esp.responde = semRede;
    await app.pushNow();
    assert.equal(esp.selos[esp.selos.length - 1], 'off');
    esp.selos.length = 0;
    await app.pushNow();
    assert.deepEqual(esp.selos, ['liga', 'off'], 'a tentativa sem rede');
    esp.selos.length = 0;
    esp.responde = null;
    await app.pushNow();
    assert.deepEqual(esp.selos, ['liga', 'ok']);
  });

  test('um 429 não é falta de ligação: depois dele o envio seguinte diz «por enviar», não «A ligar»', async () => {
    const { app, esp } = montar();
    await ligada(app, esp);
    app.db.transactions.push(app.normTx({ id: 'T9', propertyId: 'H1', label: 'x', amount: 1, kind: 'expense', date: '2026-02-01' }));
    esp.responde = () => ({ status: 429, json: { error: 'Demasiadas gravações seguidas.' } });
    await app.pushNow();
    assert.equal(esp.selos[esp.selos.length - 1], 'pend:1');
    esp.selos.length = 0;
    esp.responde = null;
    await app.pushNow();
    assert.deepEqual(esp.selos, ['pend:1', 'ok']);
  });

  test('sem ligação, o ciclo de 30 s tenta outra vez sem esperar pelo intervalo de leitura — salvo se o envio já tentou', async () => {
    const { app, esp } = montar();
    await ligada(app, esp);
    app.lastPull = app.Date.now();   // acabou de ler: com a ligação de pé, o ciclo não voltava a ler
    esp.responde = semRede;
    await app.pullNow(true);
    const antes = leituras(esp).length;
    app.syncCycle();
    await assenta();
    assert.equal(leituras(esp).length, antes + 1, 'a nova tentativa saiu');
    // com algo por enviar, a tentativa é o envio, e a leitura não vai atrás dele no mesmo ciclo
    app.db.transactions.push(app.normTx({ id: 'T9', propertyId: 'H1', label: 'x', amount: 1, kind: 'expense', date: '2026-02-01' }));
    const n = leituras(esp).length;
    esp.selos.length = 0;
    app.syncCycle();
    await assenta();
    assert.equal(leituras(esp).length, n, 'uma tentativa por ciclo');
    assert.deepEqual(esp.selos, ['liga', 'off']);
  });

  test('terminar a sessão esvazia o selo, e a entrada seguinte volta a começar «A ligar»', async () => {
    const { app, esp } = montar();
    await ligada(app, esp);
    app.showAuth = () => {};
    app.encerrarSessao();
    assert.equal(esp.selos[esp.selos.length - 1], '', 'sem sessão a nuvem não diz nada');
    assert.equal(app.porLigar, true);
    // uma falha que chega depois de sair não pinta o selo
    esp.selos.length = 0;
    app.caiuALigacao();
    assert.deepEqual(esp.selos, []);
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt' };
    app.startSync();
    assert.equal(esp.selos[0], 'liga');
  });
});

describe('o arranque e as cores', () => {
  test('o arranque com sessão põe «A ligar» antes de pedir o estado, e deixa o «Sem ligação» à leitura', () => {
    const ent = le('web/cloud/entrada.js');
    const arranque = ent.slice(ent.indexOf('if (CW.user) {\n  // sessão em cache'));
    const liga = arranque.indexOf("setSyncBadge('liga')"), pede = arranque.indexOf('pedirEstado(false)');
    assert.ok(liga > -1 && pede > -1 && liga < pede, 'o «A ligar» vem antes do pedido');
    assert.doesNotMatch(arranque.slice(0, arranque.indexOf('} else {\n  showAuth')), /setSyncBadge\('off'\)/,
      'o /api/me a falhar não decide o selo: decide-o a leitura do estado');
  });

  test('o laranja é o --out, o vermelho o --danger; no telemóvel a tentativa fica com a faixa', () => {
    const css = le('web/estilos.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(css, /\.sync\.liga\{background:var\(--out-soft\);color:var\(--out\)\}/);
    assert.match(css, /\.sync\.fora\{background:var\(--danger-soft\);color:var\(--danger\)\}/);
    assert.match(css, /\.sync\.ok\{background:var\(--in-soft\);color:var\(--in\)\}/, 'verde como antes');
    assert.match(css, /\.sync\.pend\{background:var\(--accent-soft\);color:var\(--accent-text\)\}/, 'cobalto como antes');
    assert.match(css, /header\.top:has\(>\.sync\.tenta\)\{padding-bottom:40px\}|header\.top:has\(>\.sync\.tenta\)[,{]/);
    assert.match(css, /header\.top \.sync\.tenta span\{background:var\(--out-soft\);color:var\(--out\)\}/);
    assert.doesNotMatch(css, /header\.top \.sync\.liga span\{[^}]*display:flex/, 'o «A ligar» da abertura é só o ícone');
  });
});
