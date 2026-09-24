// Correções da base do cliente e da casca da PWA: web/index.html, web/sw.js,
// web/legal.js e os módulos da base em web/app/. Cada teste diz a regra; o
// achado da avaliação de 2026-09-14 que a encontrou por cumprir vai num
// comentário por cima dele.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { carregarApp, carregarTudo, igual, elementos } from './arnes.js';

const ler = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const assenta = () => new Promise((r) => setImmediate(r));
/* os módulos da base: o que esta folha tem por seus */
const BASE = ['dados', 'anexos', 'formato', 'espera', 'registos', 'tipos', 'irs', 'saldos', 'ambito', 'icones', 'tema', 'lista', 'continuidade', 'graficos', 'componentes', 'metricas',
  'navegacao', 'servicos', 'acessos', 'vistas', 'definicoes', 'copias', 'arranque'].map((n) => 'web/app/' + n + '.js');
/* a forma dos ids que o servidor aceita (worker/src/lib/http.js:badId) */
const FORMA_ID = /^[A-Za-z0-9_-]{1,64}$/;
/* dois ids que ninguém gera: um que fecha a string de um onclick, outro que fecha o atributo */
const MAU = "x');alert(1);('";
const MAU2 = 'a" onmouseover="alert(2)';

/* Um object URL de faz-de-conta, que se lembra dos que estão vivos. */
function urlsDeFazDeConta(app) {
  const vivos = new Set(), revogados = [], blobs = [];
  let n = 0;
  app.__ctx.URL = {
    createObjectURL: (b) => { blobs.push(b); const u = 'blob:' + (++n); vivos.add(u); return u; },
    revokeObjectURL: (u) => { vivos.delete(u); revogados.push(u); },
  };
  return { vivos, revogados, blobs };
}

/* Corre o código de cada atributo on…="…" do HTML, como o browser o leria
   depois de descodificar as entidades, num âmbito onde todos os nomes existem
   e só registam as chamadas. Uma injeção aparece como uma chamada a mais (o
   alert) ou como um erro de sintaxe, que rebenta aqui. */
function correrHandlers(html) {
  const decod = (s) => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const chamadas = [];
  const coisa = (nome) => new Proxy(function () {}, {
    apply: (alvo, isto, args) => { chamadas.push({ nome, args }); return coisa(nome + '()'); },
    get: (alvo, p) => (typeof p === 'symbol' ? undefined : coisa(nome + '.' + p)),
  });
  const ambito = new Proxy({}, { has: () => true, get: (a, k) => (typeof k === 'symbol' ? undefined : coisa(k)) });
  /* os dois mundos: o on…= de antes da migração da CSP e o data-<evento> que
     o tomou (web/app/eventos.js). Aceitar os dois é mais forte do que aceitar
     só um — o que corre é o mesmo código, do mesmo atributo. */
  for (const m of html.matchAll(/\s(?:on[a-z]+|data-(?:click|change|input|keydown|pointerdown))="([^"]*)"/g)) {
    new Function('ambito', 'with(ambito){' + decod(m[1]) + '\n}')(ambito);
  }
  return chamadas;
}

/* Uma cópia de segurança de uma versão antiga: a renda vivia no imóvel e nos
   inquilinos, as categorias tinham outros nomes, os movimentos apontavam para
   o inquilino e não para o contrato, e as liquidações eram uma lista à parte. */
function copiaAntiga() {
  return {
    v: 8,
    properties: [
      { id: 'P1', name: 'T2 Arroios', status: 'arrendado', monthlyRent: 700, rentIncrease: 2 },
      { id: 'P2', name: 'Casa da praia', status: 'proprio' },
    ],
    owners: [{ id: 'O1', name: 'Ana Dona' }, { id: 'O2', name: 'Rui Dono' }],
    tenants: [{ id: 'T1', name: 'Joana Antiga', propertyId: 'P1', rent: 650, deposit: 1300, start: '2019-02-01' }],
    transactions: [
      { id: 'X1', kind: 'income', label: 'Renda de março', amount: 650, date: '2019-03-01', propertyId: 'P1', tenantId: 'T1' },
      { id: 'X2', kind: 'expense', label: 'IMI', amount: 300, date: '2019-04-28', propertyId: 'P1', category: 'IMI' },
      { id: 'X3', kind: 'debt', label: 'Prestação', amount: 400, date: '2019-03-10', propertyId: 'P1' },
    ],
    settlements: [{ id: 'S1', date: '2019-05-01', propertyId: 'P1', fromId: 'O1', toId: 'O2', amount: 50 }],
    visits: [{ id: 'V1', propertyId: 'P1', nomes: 'Casal Silva' }],
    settings: { tags: 'Urgente' },
  };
}

describe('as cópias de segurança', () => {
  // achado A.1-1
  test('repor uma cópia passa pelo caminho do arranque: uma cópia antiga abre com contratos, categorias e acertos migrados', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    app.confirmModal = (titulo, texto, sim) => sim();
    app.toast = () => {};
    app.bkLoad(JSON.stringify(copiaAntiga()));
    const db = app.db;
    assert.equal(db.contracts.length, 1, 'a inquilina com renda passa a contrato');
    const c = db.contracts[0];
    assert.equal(c.propertyId, 'P1');
    igual(c.tenantIds, ['T1']);
    assert.equal(c.rent, 650);
    assert.equal(c.increase, 2);
    const tx = (id) => db.transactions.find((t) => t.id === id);
    assert.equal(tx('X1').contractId, c.id, 'a renda antiga fica presa ao contrato (tenantId → contractId)');
    assert.equal(tx('X2').category, 'Impostos', 'a categoria antiga passa pelo CATMAP');
    assert.equal(tx('X2').sub, 'IMI');
    assert.equal(tx('X3').kind, 'loan', 'debt é o nome antigo de loan');
    assert.ok(db.transactions.some((t) => t.kind === 'settle' && t.id === 'S1'), 'a liquidação vira acerto');
    igual(db.settlements, []);
    assert.equal(db.properties.find((p) => p.id === 'P1').use, 'investimento', 'o use sai do status');
    assert.equal(db.properties.find((p) => p.id === 'P2').use, 'proprio');
    assert.equal(db.visits[0].estado, 'agendada', 'as visitas passam pelo normVisit');
    assert.ok(Array.isArray(db.settings.tags), 'as etiquetas são uma lista');
    // e a app abre-a: a lista dos contratos mostra o contrato com a inquilina
    app.tab = 'contracts';
    app.render();
    assert.match(fixos.view.innerHTML, /Joana Antiga/);
  });

  // achado A.1-1
  test('só há um caminho de normalização: o load() e o bkLoad chamam o mesmo normalizarBase', () => {
    const corpo = (src, ini) => src.slice(src.indexOf(ini), src.indexOf('\n}', src.indexOf(ini)));
    const bk = corpo(ler('web/app/copias.js'), 'function bkLoad(');
    assert.match(bk, /normalizarBase\(/);
    assert.doesNotMatch(bk, /norm(Prop|Person|Contract|Tx|Tpl|Rec|Group|Visit)\b|fillCats|migrateSettlements/,
      'sem migrações à mão ao lado das do arranque');
    assert.match(corpo(ler('web/app/dados.js'), 'function load('), /normalizarBase\(/);
  });

  // achado A.1-1
  test('uma cópia com lixo nas listas abre na mesma: o que não é registo cai', () => {
    const app = carregarApp();
    const d = app.normalizarBase({ properties: [null, 'x', { id: 'P' }], owners: {}, transactions: [null, { id: 'T' }], visits: 7 });
    igual(d.properties.map((p) => p.id), ['P']);
    igual(d.owners, []);
    igual(d.transactions.map((t) => t.id), ['T']);
    igual(d.visits, []);
  });
});

/* Corre os dois <script> em linha do index.html (a armadilha de erros e a
   rede de segurança do arranque) num browser de faz-de-conta, e devolve o
   que eles fizeram, por ordem. */
function arranqueDeFazDeConta({ online = true } = {}) {
  const html = ler('web/index.html');
  const blocos = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const ouvintes = [], feito = [], relogios = [];
  const sessao = new Map();
  const janela = {
    navigator: {
      onLine: online, userAgent: 'teste',
      serviceWorker: { getRegistrations: () => Promise.resolve([{ unregister: () => { feito.push('larga o worker'); return Promise.resolve(true); } }]) },
    },
    caches: { keys: () => Promise.resolve(['gi-shell-v38']), delete: (k) => { feito.push('apaga ' + k); return Promise.resolve(true); } },
    sessionStorage: { getItem: (k) => (sessao.has(k) ? sessao.get(k) : null), setItem: (k, v) => sessao.set(k, String(v)) },
    location: { reload: () => feito.push('recarrega') },
    document: { readyState: 'loading' },
    fetch: (url, o) => { feito.push({ url, o, corpo: JSON.parse(o.body) }); return Promise.resolve({ ok: true }); },
    setTimeout: (f, ms) => { relogios.push({ f, ms }); return relogios.length; },
    addEventListener: (tipo, fn, captura) => ouvintes.push({ tipo, fn, captura: !!captura }),
  };
  janela.window = janela;
  const ctx = vm.createContext(janela);
  blocos.forEach((b) => vm.runInContext(b, ctx));
  const disparar = (e, captura) => ouvintes.filter((o) => o.tipo === 'error' && o.captura === captura).forEach((o) => o.fn(e));
  const envios = () => feito.filter((x) => typeof x === 'object');
  return { janela, feito, relogios, sessao, disparar, envios };
}

describe('a rede de segurança do arranque', () => {
  // achado A.1-2
  test('a cura leva o erro que a fez disparar ao servidor antes de recarregar, com keepalive, e uma vez só', async () => {
    const a = arranqueDeFazDeConta();
    a.disparar({ message: 'Uncaught ReferenceError: LS_SESSAO is not defined', filename: 'https://app/app/auxiliares.js',
      lineno: 104, error: { stack: 'ReferenceError: LS_SESSAO is not defined\n    at haSessao' }, target: a.janela }, false);
    await assenta(); await assenta();
    const iRecarga = a.feito.indexOf('recarrega');
    assert.ok(iRecarga > -1, 'a cura recarregou');
    const envios = a.envios();
    assert.ok(envios.length > 0, 'e mandou o relato');
    assert.ok(a.feito.indexOf(envios[0]) < iRecarga, 'o relato sai antes da recarga');
    for (const x of envios) {
      assert.equal(x.url, '/api/reports');
      assert.equal(x.o.method, 'POST');
      assert.equal(x.o.keepalive, true, 'keepalive: o pedido sobrevive à recarga');
    }
    const tudo = envios.map((x) => x.corpo.message + '\n' + x.corpo.detail).join('\n');
    assert.match(tudo, /LS_SESSAO is not defined/, 'com o erro');
    assert.match(tudo, /curad/i, 'e a dizer que a app se curou');
    // o temporizador de três segundos da armadilha já não o manda outra vez
    a.relogios.filter((r) => r.ms === 3000).forEach((r) => r.f());
    assert.equal(a.envios().length, envios.length, 'nada em duplicado');
    assert.ok(!a.sessao.has('gi_arranque_curado_porque'), 'e não fica um motivo guardado que ninguém lê');
  });

  // achado A.1-2
  test('um script que não chega a carregar também chega ao servidor, com o endereço dele', async () => {
    const a = arranqueDeFazDeConta();
    a.disparar({ target: { tagName: 'SCRIPT', src: 'https://app/app/vistas.js' } }, true);
    await assenta(); await assenta();
    const envios = a.envios();
    assert.equal(envios.length, 1);
    assert.ok(a.feito.indexOf(envios[0]) < a.feito.indexOf('recarrega'), 'antes da recarga');
    assert.equal(envios[0].o.keepalive, true);
    assert.match(envios[0].corpo.message + envios[0].corpo.detail, /app\/vistas\.js/);
  });

  // achado A.1-2
  test('sem rede não se cura, e o erro fica para a armadilha mandar quando puder', async () => {
    const a = arranqueDeFazDeConta({ online: false });
    a.disparar({ message: 'x is not defined', target: a.janela }, false);
    await assenta();
    assert.equal(a.feito.length, 0, 'nem recarga nem envio');
    a.relogios.filter((r) => r.ms === 3000).forEach((r) => r.f());
    assert.equal(a.envios().length, 1, 'a armadilha manda-o ao fim dos três segundos, como sempre');
  });
});

describe('o registo por nomes', () => {
  // achado A.1-3
  test('com a app inteira carregada, cada nome que um serviço regista resolve para uma função', () => {
    const app = carregarTudo();
    const R = app.REGISTO;
    const nomes = [];
    for (const k of ['vistas', 'depois', 'cracha']) for (const [t, r] of Object.entries(R[k])) nomes.push([k + '.' + t, r.nome]);
    for (const k of ['lp', 'lpExtras']) {
      for (const [p, l] of Object.entries(R[k])) l.forEach((r) => nomes.push([k + '.' + p + ' (' + r.servico + ')', r.nome]));
    }
    for (const [t, a] of Object.entries(R.analise)) {
      for (const c of ['n', 'limpar', 'alternar', 'aberto', 'fechar']) if (a[c]) nomes.push(['analise.' + t + '.' + c, a[c]]);
    }
    for (const [id, m] of Object.entries(R.manifestos)) if (m.aoMudar) nomes.push(['aoMudar.' + id, m.aoMudar]);
    assert.ok(nomes.length > 40, 'o registo está cheio: ' + nomes.length + ' nomes');
    const partidos = nomes.filter(([, n]) => typeof app.funcaoDeTopo(n) !== 'function');
    assert.deepEqual(partidos, [], 'nomes que não resolvem (uma função passada a const/let?)');
  });

  // achado A.1-3
  test('uma função de topo em const não chega ao registo — é por isso que o teste de cima tem de existir', () => {
    const app = carregarApp();
    vm.runInContext("const vConstDeTeste=()=>'x';function vFuncaoDeTeste(){return 'x'}", app.__ctx);
    assert.equal(app.funcaoDeTopo('vConstDeTeste'), null);
    assert.equal(typeof app.funcaoDeTopo('vFuncaoDeTeste'), 'function');
  });

  // achado A.1-3
  test('uma vista registada que não resolve, com o serviço ligado, diz que não carregou e relata-o uma vez — não finge que está desligada', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    const relatos = [];
    app.__ctx.reportErr = (m) => relatos.push(String(m));   // a nuvem traz o seu (cloud/ajuda.js)
    app.registarServico({ id: 'calendar', vistas: { calendar: 'vCalendarioQueNaoExiste' } });
    app.tab = 'calendar';
    app.render();
    app.render();
    const html = fixos.view.innerHTML;
    assert.doesNotMatch(html, /está desligado nesta conta/);
    assert.match(html, /não carregou/);
    assert.equal(relatos.length, 1, 'relatado uma vez, e não a cada pintura');
    assert.match(relatos[0], /vCalendarioQueNaoExiste/);
    // e o desligado continua a ser o desligado
    app.definirServicosDesligados(['calendar']);
    app.render();
    assert.match(fixos.view.innerHTML, /Calendário está desligado nesta conta/);
  });
});

describe('os ids que entram de fora', () => {
  // achado A.1-4
  test('um id fora da forma do servidor não passa a normalização, e as referências seguem a mesma troca', () => {
    const app = carregarApp();
    const p = app.normProp({ id: MAU, ownerIds: [MAU2], ownerShares: { [MAU2]: 100 }, rooms: [{ id: MAU, name: 'Q1' }],
      photos: [{ id: MAU2 }], loans: [{ id: MAU, files: [{ id: MAU }] }] });
    for (const v of [p.id, p.ownerIds[0], ...Object.keys(p.ownerShares), p.rooms[0].id, p.photos[0].id, p.loans[0].id, p.loans[0].files[0].id]) {
      assert.match(v, FORMA_ID);
    }
    assert.equal(p.ownerShares[p.ownerIds[0]], 100, 'a quota continua presa ao dono');
    const t = app.normTx({ id: MAU2, propertyId: MAU, contractId: MAU, loanId: MAU, paidBy: MAU2, toId: MAU2, groupId: MAU,
      split: { mode: 'pct', parts: { [MAU2]: 100 } } });
    for (const v of [t.id, t.propertyId, t.contractId, t.loanId, t.paidBy, t.toId, ...Object.keys(t.split.parts)]) assert.match(v, FORMA_ID);
    assert.equal(t.propertyId, p.id, 'o movimento continua preso ao imóvel');
    assert.equal(t.paidBy, p.ownerIds[0], 'e a quem pagou');
    const g = app.normTx({ groupId: MAU, psplit: { mode: 'pct', parts: { [MAU]: 1 } } });
    assert.match(g.groupId, FORMA_ID);
    assert.deepEqual(Object.keys(g.psplit.parts), [p.id]);
    const c = app.normContract({ id: MAU, propertyId: MAU, roomId: MAU, tenantIds: [MAU2], photoIds: [MAU], ownerContactId: MAU2,
      tenantContactId: MAU2, files: [{ id: MAU }], inventory: [{ id: MAU }], keys: [{ id: MAU }], fisco: { renovacoes: [{ id: MAU }] } });
    for (const v of [c.id, c.propertyId, c.roomId, c.tenantIds[0], c.photoIds[0], c.ownerContactId, c.tenantContactId, c.files[0].id,
      c.inventory[0].id, c.keys[0].id, c.fisco.renovacoes[0].id]) assert.match(v, FORMA_ID);
    assert.equal(c.roomId, p.rooms[0].id);
    const v = app.normVisit({ id: MAU, propertyId: MAU, roomId: MAU });
    assert.equal(v.propertyId, p.id);
    const per = app.normPerson({ id: MAU2, houseId: MAU, files: [{ id: MAU }] });
    assert.equal(per.id, p.ownerIds[0]);
    assert.equal(per.houseId, p.id);
    igual(app.normGroup({ id: MAU, ids: [MAU2] }).ids, [p.ownerIds[0]]);
    assert.equal(app.normRec({ id: MAU, tx: { propertyId: MAU } }).tx.propertyId, p.id);
    assert.equal(app.normTpl({ id: MAU, tx: { propertyId: MAU } }).tx.propertyId, p.id);
    const s = app.normSettle({ id: MAU, propertyId: MAU, fromId: MAU2, toId: MAU2 });
    for (const x of [s.id, s.propertyId, s.fromId, s.toId]) assert.match(x, FORMA_ID);
  });

  // achado A.1-4
  test('os ids que já têm a forma ficam como estão — os do uid(), os do servidor e os antigos', () => {
    const app = carregarApp();
    for (const id of [app.uid(), 'P1', 'ABCD2345', 'id1726000000000abc123', 'a_b-c']) {
      assert.equal(app.normTx({ id, propertyId: id }).propertyId, id);
      assert.equal(app.normTx({ id }).id, id);
    }
    assert.equal(app.normTx({ propertyId: null }).propertyId, null, 'o vazio fica vazio');
    assert.equal(app.normContract({ roomId: '' }).roomId, '');
  });

  // achado A.1-4
  test('uma cópia colada com ids maliciosos abre sem que eles cheguem à base nem ao ecrã', () => {
    const app = carregarApp();
    const fixos = elementos(app);
    app.confirmModal = (t, x, sim) => sim();
    app.toast = () => {};
    const copia = {
      properties: [{ id: MAU, name: 'Casa', ownerIds: ['O1'], use: 'investimento' }],
      owners: [{ id: 'O1', name: 'Ana' }], tenants: [{ id: MAU2, name: 'Rui' }],
      contracts: [{ id: MAU2, propertyId: MAU, tenantIds: [MAU2], rent: 500, start: '2026-01-01' }],
      transactions: [{ id: MAU, kind: 'income', label: 'Renda', amount: 500, date: '2026-02-01', propertyId: MAU, contractId: MAU2, paidBy: 'O1' }],
    };
    app.bkLoad(JSON.stringify(copia));
    assert.ok(!JSON.stringify(app.db).includes('alert('), 'nenhum id malicioso ficou na base');
    assert.equal(app.db.contracts[0].propertyId, app.db.properties[0].id, 'e as ligações ficaram');
    for (const t of ['dashboard', 'properties', 'contracts', 'tenants', 'transactions']) {
      app.tab = t;
      app.render();
      assert.ok(!fixos.view.innerHTML.includes('alert('), t);
    }
  });

  // achado A.1-4
  test('um id interpolado num onclick dos componentes da base vai por jsq: mesmo um que fuja à normalização chega inteiro à função', () => {
    const app = carregarApp();
    const html = app.fileBlock('Fotos', [{ id: MAU, name: 'a' }, { id: MAU2, name: 'b' }], 'in_' + MAU, 'pickFotos', 'delFoto', { photos: true, move: true, arg: MAU })
      + app.fileBlock('Ficheiros', [{ id: MAU2, name: 'c', size: 10 }], 'in2', 'pickFic', 'delFic', {})
      + app.kebab('tx:' + MAU)
      + app.sel('s_' + MAU, '', [{ v: 'a', label: 'A' }], 'onX', 'vista')
      + app.fold('f_' + MAU, 'T', 'corpo')
      + app.menu('m_' + MAU, []);
    const chamadas = correrHandlers(html);
    assert.ok(!chamadas.some((c) => c.nome === 'alert'), 'nada corre além do que o botão chama');
    const com = (nome, i, v) => chamadas.some((c) => c.nome === nome && c.args[i] === v);
    assert.ok(com('openMeta', 0, MAU) && com('openMeta', 0, MAU2));
    assert.ok(com('delFileConfirm', 1, MAU) && com('delFileConfirm', 1, MAU2));
    assert.ok(com('livePhotoName', 0, MAU2));
    /* o onPick deixou de ser o nome interpolado no atributo e passa como TEXTO
       ao escolherFicheirosDoBloco, que o resolve pelo funcaoDaApp: prende-se o
       nome e o argumento extra, que antes só se via depois de resolvido */
    assert.ok(com('escolherFicheirosDoBloco', 1, 'pickFotos'), 'o nome da função que recebe os ficheiros');
    assert.ok(com('escolherFicheirosDoBloco', 2, MAU), 'o argumento extra do onPick também');
    assert.ok(com('lpMenu', 0, 'tx:' + MAU));
    assert.ok(com('selOpen', 1, 's_' + MAU));
    assert.ok(com('toggleFold', 0, 'f_' + MAU));
    assert.ok(com('menuOpen', 1, 'm_' + MAU));
    // o «document» não é um nome da app: abrir o seletor passou a uma função com nome, e o id continua a ser o 1.º argumento
    assert.ok(com('abrirSeletorFicheiros', 0, 'in_' + MAU));
  });

  // achado A.1-4
  test('os ids dos registos nos onclick das janelas e das páginas da base também vão por jsq', async () => {
    const app = carregarApp();
    let corpo = '';
    app.openModal = (t, body, foot, menuHtml) => { corpo += body + (foot || '') + (menuHtml || ''); return {}; };
    app.db.owners.push(app.normPerson({ id: 'O1', name: 'Ana' }), app.normPerson({ id: 'O2', name: 'Rui' }));
    app.db.properties.push(app.normProp({ id: 'P1', name: 'Casa', ownerIds: ['O1', 'O2'] }));
    app.db.transactions.push(Object.assign(app.normTx({ kind: 'expense', label: 'Obra', amount: 100, date: '2026-01-02', propertyId: 'P1', paidBy: 'O1' }), { id: MAU }));
    app.balancesDetail('P1');
    app.db.groups.push(Object.assign(app.normGroup({ kind: 'prop', name: 'G' }), { id: MAU }));
    app.groupModal('prop', MAU);
    corpo += app.vGroups();
    app.idbGet = () => Promise.resolve(new Blob(['x'], { type: 'image/png' }));
    urlsDeFazDeConta(app);
    app.openFileMeta({ id: MAU, name: 'f.png', type: 'image/png', size: 3 });
    await assenta();
    const chamadas = correrHandlers(corpo);
    assert.ok(!chamadas.some((c) => c.nome === 'alert'));
    const com = (nome, i, v) => chamadas.some((c) => c.nome === nome && c.args[i] === v);
    assert.ok(com('txView', 0, MAU), 'o movimento do «Como se chega aos saldos»');
    assert.ok(com('groupModal', 1, MAU), 'o grupo da página dos grupos');
    assert.ok(com('delGroup', 0, MAU), 'o apagar do menu do grupo');
    assert.ok(com('downloadMeta', 0, MAU), 'o guardar da imagem aberta');
  });

  // achado A.1-4
  test('na base, o que vai entre plicas dentro de um on…="…" ou de um act passa por jsq', () => {
    const falhas = [];
    for (const f of BASE) {
      ler(f).split('\n').forEach((l, i) => {
        const em = l.search(/\s(?:on[a-z]+|data-(?:click|change|input|keydown|pointerdown))="|act:`/);
        if (em < 0) return;
        for (const m of l.slice(em).matchAll(/'\$\{(?!jsq\()/g)) falhas.push(f + ':' + (i + 1) + ' ' + l.slice(em + m.index, em + m.index + 30));
      });
    }
    assert.deepEqual(falhas, []);
  });
});

describe('o que morreu sai', () => {
  // achado A.1-6
  test('do editor rico só fica o que ainda se usa: a limpeza do HTML antigo e a caixa de texto simples', () => {
    const app = carregarApp();
    for (const n of ['richTouch', 'richHost', 'toggleInline', 'richCmd', 'richState', 'richLast', 'RICH_INLINE', 'ZW']) {
      assert.equal(app[n], undefined, n + ' saiu');
    }
    for (const n of ['sanitizeRich', 'rich', 'richToText', 'richVal', 'richEditor']) assert.equal(typeof app[n], 'function', n + ' fica');
    const aux = ler('web/app/formato.js');
    assert.doesNotMatch(aux, /selectionchange/, 'sem o ouvinte no documento');
    assert.match(aux, /\\u200B/, 'o sanitizeRich continua a tirar o marcador invisível das notas antigas');
    // o CSS da app saiu do <style> do index.html para o estilos.css: nenhum dos dois o traz de volta
    const html = ler('web/index.html');
    const css = ler('web/estilos.css');
    assert.match(html, /<link rel="stylesheet" href="estilos\.css">/, 'a folha da app é o estilos.css');
    for (const [f, src] of [['web/index.html', html], ['web/estilos.css', css]]) {
      assert.doesNotMatch(src, /\.rich-(editor|tools|content)/, 'nem o CSS dele (' + f + ')');
      assert.doesNotMatch(src, /editores de texto ricos/, f);
    }
    assert.match(css, /\.rich\{/, 'o .rich, que mostra as notas antigas, fica');
  });

  // achado A.1-13a
  test('graficos.js não guarda funções que ninguém chama: o hit saiu', () => {
    const app = carregarApp();
    assert.equal(app.hit, undefined);
    assert.doesNotMatch(ler('web/app/graficos.js'), /const hit=/);
  });
});

describe('o CSV dos movimentos', () => {
  // achado A.1-7
  test('uma célula de texto que começa por = + - @ tabulação ou retorno sai com uma plica à frente; os números ficam números', () => {
    const app = carregarApp();
    let csv = '';
    app.download = (n, m, c) => { csv = c; };
    app.toast = () => {};
    const tx = (o) => app.db.transactions.push(app.normTx(Object.assign({ kind: 'expense', date: '2026-01-01' }, o)));
    tx({ label: '=HYPERLINK("http://mau","clica")', amount: 10, notes: '+351 912', creditor: '@SOMA(A1)', category: '-2+3' });
    tx({ label: '\tcomeça com tabulação', amount: -50, notes: '\rretorno' });
    tx({ label: 'Normal', amount: 20 });
    app.downloadCsv();
    const linhas = csv.split('\n').map((l) => l.replace(/^"|"$/g, '').split('";"').map((x) => x.split('""').join('"')));
    const col = (n) => linhas[0].indexOf(n);
    const [a, b, c] = linhas.slice(1);
    assert.equal(a[col('descricao')], "'=HYPERLINK(\"http://mau\",\"clica\")");
    assert.equal(a[col('comentarios')], "'+351 912");
    assert.equal(a[col('credor')], "'@SOMA(A1)");
    assert.equal(a[col('categoria')], "'-2+3");
    assert.equal(b[col('descricao')], "'\tcomeça com tabulação");
    assert.equal(b[col('comentarios')], "'\rretorno");
    assert.equal(b[col('valor')], '-50', 'um valor negativo é um número, não uma fórmula');
    assert.equal(c[col('descricao')], 'Normal');
  });

  // achado A.2-13
  test('um CSV descarregado leva a marca de ordem de bytes, para o Excel o ler em UTF-8; um JSON não', async () => {
    const app = carregarApp();
    const u = urlsDeFazDeConta(app);
    app.download('a.csv', 'text/csv;charset=utf-8', '"Condomínio"');
    app.download('a.json', 'application/json', '{}');
    const bytes = async (b) => [...new Uint8Array(await b.arrayBuffer())];
    const csv = await bytes(u.blobs[0]);
    assert.deepEqual(csv.slice(0, 3), [0xEF, 0xBB, 0xBF]);
    assert.equal(Buffer.from(csv.slice(3)).toString('utf8'), '"Condomínio"', 'e o resto tal e qual');
    assert.equal((await bytes(u.blobs[1]))[0], 0x7B, 'o JSON começa na chaveta');
    assert.equal(u.blobs[0].type, 'text/csv;charset=utf-8');
  });
});

describe('o menu de escolha (sel)', () => {
  // achado A.1-8
  test('o sel() diz ao leitor de ecrã que é uma lista de escolha, qual está escolhida e se está aberta', () => {
    const app = carregarApp();
    const h = app.sel('cat', 'b', [{ v: 'a', label: 'A' }, { div: true }, { v: 'b', label: 'B' }], 'onCat', 'vista');
    const botao = h.match(/<button[^>]*class="selbtn"[^>]*>/)[0];
    assert.match(botao, /aria-haspopup="listbox"/);
    assert.match(botao, /aria-expanded="false"/);
    assert.match(botao, /aria-controls="pop_cat"/);
    assert.match(botao, /id="selb_cat"/);
    assert.match(h, /<div class="selpop" id="pop_cat" role="listbox"/);
    const opcoes = h.match(/<button[^>]*class="selopt[^"]*"[^>]*>/g);
    assert.equal(opcoes.length, 2);
    opcoes.forEach((o) => assert.match(o, /role="option"/));
    assert.match(opcoes[0], /aria-selected="false"/);
    assert.match(opcoes[1], /aria-selected="true"/);
  });

  // achado A.1-8
  test('as setas, Home e End andam pelas opções sem sair das pontas', () => {
    const f = carregarApp().selIndiceSeguinte;
    assert.equal(f(-1, 4, 'ArrowDown'), 0);
    assert.equal(f(0, 4, 'ArrowDown'), 1);
    assert.equal(f(3, 4, 'ArrowDown'), 3);
    assert.equal(f(-1, 4, 'ArrowUp'), 3);
    assert.equal(f(2, 4, 'ArrowUp'), 1);
    assert.equal(f(0, 4, 'ArrowUp'), 0);
    assert.equal(f(2, 4, 'Home'), 0);
    assert.equal(f(1, 4, 'End'), 3);
    assert.equal(f(1, 4, 'x'), 1);
    assert.equal(f(-1, 0, 'ArrowDown'), -1, 'sem opções não há onde ir');
  });

  /* Um sel() de faz-de-conta, com o botão, a lista e três opções. */
  function selFalso(app) {
    const focos = [];
    const el = (nome, extra) => {
      const cls = new Set(), at = {};
      return Object.assign({
        nome, attrs: at,
        classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle() {} },
        setAttribute: (k, v) => { at[k] = String(v); }, getAttribute: (k) => (k in at ? at[k] : null),
        focus: () => focos.push(nome), style: {},
      }, extra || {});
    };
    const opts = [0, 1, 2].map((i) => el('opção ' + i, {}));
    opts.forEach((o, i) => { o.setAttribute('data-i', String(i)); o.setAttribute('aria-selected', String(i === 1)); });
    const pop = el('lista', { id: 'pop_cat', querySelectorAll: () => opts, parentNode: { querySelector: () => null }, contains: () => false });
    const btn = el('botão', { id: 'selb_cat' });
    const caixa = { querySelector: (s) => (s === '.selpop' ? pop : s === '.selbtn' ? btn : null) };
    [btn, ...opts].forEach((x) => { x.closest = (s) => (s === '.sel' ? caixa : null); });
    const doc = app.document;
    doc.getElementById = (id) => ({ pop_cat: pop, selb_cat: btn, cat: el('input'), lab_cat: el('rótulo') }[id] || null);
    doc.querySelectorAll = (s) => (/\.selpop\.on/.test(s) ? [pop].filter((p) => p.classList.contains('on')) : []);
    app.__ctx.__sel.cat = { options: [{ v: 'a', label: 'A' }, { v: 'b', label: 'B' }, { v: 'c', label: 'C' }], onchange: '' };
    const tecla = (key, target) => { let travou = false; const r = app.selTecla({ key, target, preventDefault: () => { travou = true; } }); return { r, travou }; };
    return { pop, btn, opts, focos, tecla };
  }

  // achado A.1-8
  test('a teclado: a seta no botão abre na opção escolhida, as setas andam, o Escape fecha e devolve o foco; o aria-expanded acompanha', () => {
    const app = carregarApp();
    const s = selFalso(app);
    let t = s.tecla('ArrowDown', s.btn);
    assert.ok(t.r && t.travou, 'tratada, e sem deixar a página rolar');
    assert.ok(s.pop.classList.contains('on'), 'abriu');
    assert.equal(s.btn.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(s.focos, ['opção 1'], 'o foco vai para a opção escolhida');
    s.tecla('ArrowDown', s.opts[1]);
    s.tecla('ArrowDown', s.opts[2]);
    s.tecla('Home', s.opts[2]);
    s.tecla('End', s.opts[0]);
    assert.deepEqual(s.focos, ['opção 1', 'opção 2', 'opção 2', 'opção 0', 'opção 2']);
    t = s.tecla('Escape', s.opts[2]);
    assert.ok(t.r, 'o Escape é do menu, e não da janela por baixo');
    assert.ok(!s.pop.classList.contains('on'), 'fechou');
    assert.equal(s.btn.getAttribute('aria-expanded'), 'false');
    assert.equal(s.focos[s.focos.length - 1], 'botão', 'e o foco volta ao botão');
    assert.equal(s.tecla('Escape', s.btn).r, false, 'fechado, o Escape segue para quem o quiser (a janela)');
    assert.equal(s.tecla('a', s.btn).r, false);
  });

  // achado A.1-8
  test('escolher uma opção marca-a como escolhida e fecha a lista com o aria-expanded a acompanhar', () => {
    const app = carregarApp();
    const s = selFalso(app);
    app.selOpen(null, 'cat');
    assert.equal(s.btn.getAttribute('aria-expanded'), 'true');
    app.selPick(null, 'cat', 2);
    assert.equal(s.btn.getAttribute('aria-expanded'), 'false');
    igual(s.opts.map((o) => o.getAttribute('aria-selected')), ['false', 'false', 'true']);
    app.selOpen(null, 'cat');
    app.closePops();
    assert.equal(s.btn.getAttribute('aria-expanded'), 'false', 'fechar por fora também');
  });
});

describe('higiene da base', () => {
  // achado A.1-9a
  test('abrir a gaveta fecha os filtros pelo caminho da mudança de separador, e sem criar globais', () => {
    const app = carregarApp();
    let pinturas = 0;
    app.render = () => { pinturas++; };
    app.tab = 'properties';
    app.lf('lprops')._open = true;
    app.lf('lcts')._open = true;
    app.closeFilterPanels();
    assert.equal(app.lf('lprops')._open, false);
    assert.equal(app.lf('lcts')._open, false, 'fecha todos, como o fecharFiltros');
    assert.equal(pinturas, 1, 'e repinta, porque o deste separador estava aberto');
    assert.ok(!Object.prototype.hasOwnProperty.call(app.__ctx, 'lfDraft'), 'o rascunho que já não existe não nasce como global');
    app.closeFilterPanels();
    assert.equal(pinturas, 1, 'nada aberto, nada a repintar');
    app.tab = 'reports';
    app.anaOpen.reports = true;
    app.closeFilterPanels();
    assert.equal(app.anaOpen.reports, undefined, 'o painel de análise também');
    assert.equal(pinturas, 2);
    for (const f of BASE) assert.doesNotMatch(ler(f), /\blfDraft\b/, f);
  });

  // achado A.1-10
  test('o cartão Sobre das Definições diz a versão do avisos.js, e não um número escrito à mão', () => {
    const app = carregarApp();
    assert.match(app.vSettings(), /<span>Versão<\/span><b>—<\/b>/, 'sem o avisos.js carregado, um traço');
    vm.runInContext('var VERSAO=38', app.__ctx);
    assert.match(app.vSettings(), /<span>Versão<\/span><b>38<\/b>/);
    assert.doesNotMatch(ler('web/app/definicoes.js'), /<span>Versão<\/span><b>\d+<\/b>/);
  });

  // achado A.1-11a
  test('o comentário do dPT está por cima do dPT, e o do esperaDoServidor é só dele', () => {
    const L = (ler('web/app/formato.js') + '\n' + ler('web/app/espera.js')).split('\n');
    const bloco = (i) => { let j = i - 1; while (j > 0 && !L[j].includes('/*')) j--; return L[i - 1].trim().endsWith('*/') ? L.slice(j, i).join('\n') : ''; };
    const d = bloco(L.findIndex((l) => l.startsWith('const dPT=')));
    assert.match(d, /Uma data como se escreve em Portugal/);
    assert.match(d, /Recebe: iso/);
    assert.match(d, /Devolve:/);
    assert.doesNotMatch(bloco(L.findIndex((l) => l.startsWith('function esperaDoServidor('))), /2028-03-15|dd\/mm\/aaaa/);
  });

  // achado A.1-12
  test('os comentários dizem quem lê o legal.js sem a app e o que o sw.js faz sem o avisos.js', () => {
    const legal = ler('web/legal.js'), sw = ler('web/sw.js');
    assert.doesNotMatch(sw, /importScripts\([^)]*legal/, 'o service worker só importa o avisos.js');
    assert.match(ler('worker/src/legal-vista.js'), /legal\.js/, 'quem o lê sem a app é a página /termos do worker');
    assert.doesNotMatch(legal, /lido pelo service worker/);
    assert.match(legal, /legal-vista\.js/);
    const linha = sw.split('\n').find((l) => l.includes("importScripts('/avisos.js')"));
    assert.doesNotMatch(linha, /cache genérica/);
    assert.match(linha, /não guarda nada/);
  });

  // achado A.1-14
  test('o nome debaixo do ícone no iPhone é o da app, o mesmo do manifesto', () => {
    const m = ler('web/index.html').match(/<meta name="apple-mobile-web-app-title" content="([^"]*)">/);
    const man = JSON.parse(ler('web/manifest.webmanifest'));
    assert.equal(m[1], 'Rendorium');
    assert.equal(m[1], man.short_name);
  });

  // achado A.2-19b
  test('uma contribuição de outro serviço que rebenta no menu de toque longo fica na consola, com o nome, e não parte o menu', () => {
    const app = carregarApp();
    const erros = [];
    app.__ctx.console = Object.assign({}, console, { error: (...a) => erros.push(a.map(String).join(' ')) });
    vm.runInContext("function lpExtraQueRebenta(){throw new Error('rebentei')}", app.__ctx);
    app.registarServico({ id: 'calendar', lpExtras: { prop: 'lpExtraQueRebenta' } });
    assert.ok(Array.isArray(JSON.parse(JSON.stringify(app.lpExtrasDe('prop', ['prop', 'x'])))), 'o menu sai na mesma');
    assert.equal(erros.length, 1);
    assert.match(erros[0], /lpExtraQueRebenta/);
    assert.match(erros[0], /rebentei/);
  });
});

describe('anexos e object URLs', () => {
  // achado A.1-15
  test('descarregar um anexo ou um ficheiro não deixa object URLs para trás: o anterior revoga-se ao criar o seguinte', async () => {
    const app = carregarApp();
    const u = urlsDeFazDeConta(app);
    app.toast = () => {};
    app.idbGet = () => Promise.resolve(new Blob(['x']));
    app.downloadMeta('a'); await assenta();
    app.downloadMeta('b'); await assenta();
    app.download('c.json', 'application/json', '{}');
    assert.equal(u.vivos.size, 1, 'só o da última descarga');
  });

  // achado A.1-15
  test('a imagem aberta de um anexo revoga o URL dela quando a janela fecha', async () => {
    const app = carregarApp();
    const u = urlsDeFazDeConta(app);
    let camada = null;
    app.openModal = () => (camada = {});
    app.idbGet = () => Promise.resolve(new Blob(['x'], { type: 'image/png' }));
    app.openFileMeta({ id: 'f1', name: 'a.png', type: 'image/png', size: 1 });
    await assenta();
    assert.equal(u.vivos.size, 1);
    assert.equal(typeof camada.aoFechar, 'function');
    camada.aoFechar();
    assert.equal(u.vivos.size, 0);
  });

  // achado A.1-15
  test('fechar uma janela corre o aoFechar dela; fechar a última esquece os anexos pendentes', () => {
    const app = carregarApp();
    let fechou = 0;
    const falsa = () => ({ el: app.document.createElement('div') });
    app.pendingFiles.x = 1;
    app.modalStack.push(Object.assign(falsa(), { aoFechar: () => fechou++ }), falsa());
    app.closeModal();
    assert.equal(fechou, 0);
    assert.equal(app.pendingFiles.x, 1, 'ainda há uma janela aberta: o formulário pode estar lá');
    app.closeModal();
    assert.equal(fechou, 1);
    assert.equal(app.pendingFiles.x, undefined, 'sem janelas não há formulário nenhum a guardar pendentes');
  });

  // achado A.1-15
  test('as miniaturas em memória têm teto: a menos usada sai e o URL dela é revogado', async () => {
    const app = carregarApp();
    const u = urlsDeFazDeConta(app);
    const max = app.MINIATURAS_MAX;
    assert.ok(max >= 20 && max <= 500, 'um teto a sério: ' + max);
    for (let i = 0; i <= max; i++) app.guardarMiniatura('f' + i, 'blob:m' + i);
    assert.equal(Object.keys(app.thumbCache).length, max);
    assert.equal(app.thumbCache.f0, undefined);
    assert.deepEqual(u.revogados, ['blob:m0']);
    assert.equal(await app.thumbSrc('f1'), 'blob:m1', 'a que está guardada serve-se daqui');
    app.guardarMiniatura('nova', 'blob:n');
    assert.ok(app.thumbCache.f1, 'a que acabou de ser usada fica');
    assert.equal(app.thumbCache.f2, undefined, 'sai a seguinte mais antiga');
    assert.equal(app.guardarMiniatura('nova', 'blob:n2'), 'blob:n', 'duas chegadas para a mesma foto: fica a primeira');
    assert.ok(u.revogados.includes('blob:n2'), 'e a que chegou a mais é revogada');
    assert.equal(app.thumbCache.nova, 'blob:n');
  });
});
