// O Lab numa sessão de testes seguida (os pedidos do Martinho de 2026-11-27):
// «Para depois» a partir de Human Tests e «Voltar a Human Tests», no servidor
// (só de Human Tests e só para Para depois, com o histórico e o rasto, o
// ticket de QA com o cartão, o pai de um subticket a ficar em Human Tests, e
// as recusas) e na pílula (os botões e o veioDe); os subtickets na lista com
// a linha de um ticket, agrupados pelo pai certo mesmo com o pai noutra
// secção (KAN-174); a janela de um ticket a passar ao que ficou no lugar
// depois de uma decisão, e as setas pela ordem da lista (KAN-168); tocar num
// modelo de dados é usá-lo (KAN-167-2); e a folha que não pega no gesto de
// uma pega (KAN-167-3).

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { ambiente, conta, pedir, resp } from './lib/api.js';
import { chamar, corpoDe, MASTER } from './lib/equipa.js';
import { carregarTudo, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { passosDeQuemTesta, IDAS_DE_QUEM_TESTA, KAN_PARA_DEPOIS, numeroDoSubticket } from '../worker/src/lib/kanban.js';

const app = carregarTudo();
afterEach(() => repor(app));
afterEach(() => {
  vm.runInContext('qaLista={tickets:null,falhou:false,aPedir:null,colunas:null};qaAbertos=null;qaCamadaLista=null;qaCamadaTicket=null;qaOcupado={};' +
    'qaDobrasAqui={};qaGesto=null;localStorage.clear();modalStack.length=0;CW.ambiente="producao";CW.user=null;', app.__ctx);
});

/* ------------------------------- armações ------------------------------- */

// as colunas do kanban como o GET /api/qa as manda
const COLUNAS = [
  { id: 'a-fazer', nome: 'A fazer', fim: false }, { id: 'auto-tests', nome: 'Auto Tests', fim: false },
  { id: 'human-tests', nome: 'Human Tests', fim: false }, { id: 'staging', nome: 'Staging', fim: true },
  { id: 'adiado', nome: 'Adiado', fim: true }, { id: 'concluido', nome: 'Produção', fim: true },
  { id: 'para-depois', nome: 'Para depois', fim: false },
];
// um cartão da pílula sem ticket de QA: a chave como id
const K = (id, o = {}) => Object.assign({ id, cartao: id, ticket: false, tipo: 'erro', titulo: 'Título ' + id, body: '', prioridade: 3, status: 'human-tests',
  resolution: null, resolved_at: 10, created_at: 1, updated_at: 1, imagem: false, anexos: 0, autor: { id: 'm1', nome: 'Mestre', email: '', discord: null } }, o);
// um subticket KAN-N-X do pai KAN-N
const S = (pai, x, o = {}) => K(pai + '-' + x, Object.assign({ tipo: 'subtarefa', sub: x, pai: { cartao: pai, titulo: 'O pai ' + pai } }, o));

/* A sessão de uma conta no ambiente de desenvolvimento. Devolve: nada. */
function noDev() {
  app.CW.ambiente = 'percurso';
  app.CW.user = { id: 'u1', name: 'Maria Costa', email: 'maria@rendorium.test' };
}

/* Uma API simulada que guarda os pedidos e responde pelo que o teste diz.
   Recebe: respostas — {'MÉTODO /caminho': valor}.
   Devolve: a lista dos pedidos ([método, caminho, dados]). */
function apiFalsa(respostas = {}) {
  const pedidos = [];
  app.api = (m, p, d) => {
    pedidos.push([m, p, d]);
    const chave = m + ' ' + p, geral = m + ' ' + p.replace(/\/api\/qa\/[^/]+/, '/api/qa/:id');
    const r = chave in respostas ? respostas[chave] : geral in respostas ? respostas[geral] : (m === 'GET' ? { tickets: [] } : { ok: true });
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(typeof r === 'function' ? r(d) : r);
  };
  return pedidos;
}

/* Um cartão na base, à mão.
   Recebe: db — a base SQLite; numero; coluna; extra — colunas a mais.
   Devolve: nada. */
function poeCartao(db, numero, coluna, extra = {}) {
  const l = Object.assign({ id: 'k' + numero, numero, titulo: 'Cartão ' + numero, coluna_id: coluna, posicao: numero, relator_id: 'claude', created_at: 1, updated_at: 1 }, extra);
  const cols = Object.keys(l);
  db.prepare('INSERT INTO kanban_cartoes (' + cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')').run(...cols.map((c) => l[c]));
}

/* A coluna de um cartão pelo id. Recebe: db; id. Devolve: o id da coluna. */
const colunaDe = (db, id) => (db.prepare('SELECT coluna_id FROM kanban_cartoes WHERE id = ?').get(id) || {}).coluna_id;
/* Um POST da pílula do back office. Recebe: env; caminho. Devolve: {status, …}. */
const posta = (env, caminho, corpo) => chamar(env, MASTER, 'POST', '/api/equipa/qa' + caminho, corpo).then(corpoDe);

/* ------------------------------- servidor ------------------------------- */

describe('Para depois e Voltar a Human Tests no servidor (KAN-171)', () => {
  test('de Human Tests para Para depois e de volta, com a linha no histórico e no rasto; de outra coluna, 409', async () => {
    const env = ambiente();
    const db = env.DB._db;
    poeCartao(db, 500, 'human-tests');
    poeCartao(db, 501, 'a-fazer');
    const r = await posta(env, '/KAN-500/para-depois');
    assert.equal(r.status, 200);
    assert.equal(r.coluna, 'para-depois');
    assert.equal(colunaDe(db, 'k500'), 'para-depois');
    const h = db.prepare("SELECT autor_id, antes, depois FROM kanban_historico WHERE cartao_id = 'k500' AND campo = 'coluna' ORDER BY id DESC").get();
    assert.deepEqual({ ...h }, { autor_id: 'm1', antes: 'human-tests', depois: 'para-depois' });
    const a = db.prepare("SELECT quem, papel, acao, alvo, detalhe FROM audit_log WHERE alvo = 'KAN-500' ORDER BY at DESC").get();
    assert.deepEqual({ ...a }, { quem: 'm1', papel: 'master', acao: 'kanban.mover', alvo: 'KAN-500', detalhe: 'human-tests → para-depois (pílula)' });
    // a lista diz de onde veio
    const l = await chamar(env, MASTER, 'GET', '/api/equipa/qa').then(corpoDe);
    const item = l.tickets.find((t) => t.cartao === 'KAN-500');
    assert.equal(item.status, 'para-depois');
    assert.equal(item.veioDe, 'human-tests');
    assert.equal(l.tickets.find((t) => t.cartao === 'KAN-501').veioDe, undefined, 'só em Para depois');
    // e volta
    assert.equal((await posta(env, '/KAN-500/voltar')).status, 200);
    assert.equal(colunaDe(db, 'k500'), 'human-tests');
    // de A fazer não vai, e Voltar de onde não veio de Human Tests também não
    const r2 = await posta(env, '/KAN-501/para-depois');
    assert.equal(r2.status, 409);
    assert.match(r2.error, /Só um ticket em Human Tests passa a Para depois/);
    assert.equal(colunaDe(db, 'k501'), 'a-fazer');
    assert.equal((await posta(env, '/KAN-501/mover', { coluna: 'para-depois' })).status, 200);
    const r3 = await posta(env, '/KAN-501/voltar');
    assert.equal(r3.status, 409);
    assert.match(r3.error, /não veio de Human Tests/);
    assert.equal((await posta(env, '/KAN-500/voltar')).status, 409, 'já está em Human Tests');
  });

  test('o caminho novo nunca leva a Staging, Adiado nem Produção: o destino é o da ida, diga o corpo o que disser', async () => {
    const env = ambiente();
    const db = env.DB._db;
    poeCartao(db, 510, 'human-tests');
    assert.equal((await posta(env, '/KAN-510/para-depois', { coluna: 'concluido' })).status, 200);
    assert.equal(colunaDe(db, 'k510'), 'para-depois');
    poeCartao(db, 511, 'staging');
    assert.equal((await posta(env, '/KAN-511/voltar', { coluna: 'staging' })).status, 409);
    assert.equal(colunaDe(db, 'k511'), 'staging');
    assert.deepEqual(Object.values(IDAS_DE_QUEM_TESTA).map((i) => i.para).sort(), ['human-tests', 'para-depois']);
    assert.deepEqual(passosDeQuemTesta('staging', { id: 'k1', chave: 'KAN-1' }, { id: 'x' }, 'utilizador', 1), [], 'uma ida que não existe não tem passos');
  });

  test('sem a coluna Para depois no quadro (o master removeu-a), 409 e nada muda', async () => {
    const env = ambiente();
    const db = env.DB._db;
    db.prepare('DELETE FROM kanban_colunas WHERE id = ?').run(KAN_PARA_DEPOIS);
    poeCartao(db, 520, 'human-tests');
    const r = await posta(env, '/KAN-520/para-depois');
    assert.equal(r.status, 409);
    assert.match(r.error, /já não tem a coluna Para depois/);
    assert.equal(colunaDe(db, 'k520'), 'human-tests');
  });

  test('um subticket em Para depois conta como por decidir: o pai fica em Human Tests, e segue quando o último é aceite', async () => {
    const env = ambiente();
    const db = env.DB._db;
    poeCartao(db, 530, 'human-tests', { titulo: 'O pai' });
    poeCartao(db, numeroDoSubticket(530, 1), 'human-tests', { id: 'k530-1', sub: 1, tipo: 'subtarefa', pai_id: 'k530' });
    poeCartao(db, numeroDoSubticket(530, 2), 'staging', { id: 'k530-2', sub: 2, tipo: 'subtarefa', pai_id: 'k530' });
    assert.equal((await posta(env, '/KAN-530-1/para-depois')).status, 200);
    assert.deepEqual([colunaDe(db, 'k530-1'), colunaDe(db, 'k530')], ['para-depois', 'human-tests']);
    assert.equal((await posta(env, '/KAN-530-1/voltar')).status, 200);
    assert.equal((await posta(env, '/KAN-530-1/mover', { coluna: 'staging' })).status, 200);
    assert.equal(colunaDe(db, 'k530'), 'staging', 'com os dois em Staging, o pai segue');
  });

  test('um ticket de QA vai com o cartão (pelo id do ticket e pela chave), numa conta da app com o papel «utilizador» no rasto', async () => {
    const env = ambiente();
    const db = env.DB._db;
    const quem = await conta(env, 'Rita');
    const t = await resp(pedir(env, quem, '/api/qa', 'POST', { body: 'O aviso não aparece.', severity: 'incomoda', context: {} }));
    assert.equal(t.status, 201);
    assert.equal((await resp(pedir(env, quem, '/api/qa/' + t.id + '/para-depois', 'POST'))).status, 409, 'em A fazer, não');
    assert.equal((await resp(pedir(env, quem, '/api/qa/' + t.id + '/mover', 'POST', { coluna: 'human-tests' }))).status, 200);
    assert.equal((await resp(pedir(env, quem, '/api/qa/' + t.id + '/para-depois', 'POST'))).status, 200);
    const q = db.prepare('SELECT status, resolved_at FROM qa_tickets WHERE id = ?').get(t.id);
    assert.equal(q.status, 'para-depois');
    assert.equal(q.resolved_at, null, 'Para depois não é uma coluna resolvida');
    const k = db.prepare("SELECT numero, coluna_id FROM kanban_cartoes WHERE origem_tipo = 'qa' AND origem_id = ?").get(t.id);
    assert.equal(k.coluna_id, 'para-depois');
    assert.equal(db.prepare("SELECT papel FROM audit_log WHERE acao = 'kanban.mover' ORDER BY at DESC").get().papel, 'utilizador');
    assert.equal((await resp(pedir(env, quem, '/api/qa/KAN-' + k.numero + '/voltar', 'POST'))).status, 200, 'pela chave do cartão vale o mesmo');
    assert.equal(db.prepare('SELECT status FROM qa_tickets WHERE id = ?').get(t.id).status, 'human-tests');
    assert.equal((await resp(pedir(env, null, '/api/qa/' + t.id + '/para-depois', 'POST'))).status, 401, 'sem sessão, não');
  });
});

/* ------------------------------- a pílula ------------------------------- */

describe('Para depois na pílula (KAN-171)', () => {
  test('em Human Tests há «Para depois»; em Para depois, vindo de lá, «Voltar a Human Tests»; o veioDe acompanha o otimista e o repor', async () => {
    const pedidos = apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: [K('KAN-7')] } });
    noDev();
    await app.qaCarregar();
    assert.match(app.qaRodapeTicket(K('KAN-7')), /data-click="qaParaDepois\('KAN-7'\)">Para depois</);
    assert.match(app.qaRodapeTicket(S('KAN-8', 1)), /qaParaDepois\('KAN-8-1'\)/, 'também num subticket');
    const pd = app.qaRodapeTicket(K('KAN-7', { status: 'para-depois', veioDe: 'human-tests' }));
    assert.match(pd, /Mover<\/button>[\s\S]*<button type="button" class="btn primary" data-toca="dados" data-click="qaVoltarATestes\('KAN-7'\)">Voltar a Human Tests<\/button>$/);
    assert.doesNotMatch(app.qaRodapeTicket(K('KAN-7', { status: 'para-depois', veioDe: 'a-fazer' })), /Voltar a Human Tests/, 'só se veio de Human Tests');
    assert.match(app.qaHtmlTicket(K('KAN-7', { status: 'para-depois', veioDe: 'human-tests', resolution: 'Feito' })), /<b>Resolução<\/b>/, 'a resolução continua a ser a de agora');
    assert.equal(await app.qaParaDepois('KAN-7'), true);
    assert.deepEqual(pedidos.filter((p) => p[0] === 'POST').map((p) => p.slice(0, 2)), [['POST', '/api/qa/KAN-7/para-depois']]);
    const t = app.qaLista.tickets[0];
    assert.equal(t.status, 'para-depois');
    assert.equal(t.veioDe, 'human-tests', 'o otimista sabe de onde veio');
    await app.qaLista.aPedir;
    // falhando, volta como estava (sem veioDe)
    apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: [K('KAN-9')] }, 'POST /api/qa/:id/para-depois': Object.assign(new Error('Só um ticket em Human Tests passa a Para depois.'), { status: 409 }) });
    await app.qaCarregar();
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    assert.equal(await app.qaParaDepois('KAN-9'), false);
    const t9 = app.qaLista.tickets.find((x) => x.id === 'KAN-9');
    assert.equal(t9.status, 'human-tests');
    assert.equal('veioDe' in t9, false);
    assert.deepEqual(Array.from(avisos), ['Só um ticket em Human Tests passa a Para depois.']);
    // sem a coluna no quadro, não há o botão
    app.qaLista.colunas = app.qaColunasDe(COLUNAS.filter((c) => c.id !== 'para-depois'));
    assert.doesNotMatch(app.qaRodapeTicket(K('KAN-7')), /Para depois/);
  });
});

describe('os subtickets na lista: a linha de um ticket, um grupo por pai (KAN-174)', () => {
  test('com os pais em A fazer, os subtickets de dois pais ficam em dois grupos em Human Tests, cada um com o nome do seu pai', async () => {
    const ts = [
      K('KAN-1', { status: 'a-fazer', titulo: 'Pai um', prioridade: 2, created_at: 5 }), K('KAN-2', { status: 'a-fazer', titulo: 'Pai dois', prioridade: 2, created_at: 4 }),
      S('KAN-1', 2, { resolved_at: 30 }), S('KAN-2', 1, { resolved_at: 29 }), S('KAN-1', 1, { resolved_at: 28 }), K('KAN-3', { resolved_at: 50 }),
    ];
    apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: ts } });
    noDev();
    await app.qaCarregar();
    const ht = app.qaSeccoes(app.qaLista.tickets).seccoes.find((s) => s.id === 'human-tests').ts;
    assert.deepEqual(Array.from(ht, (t) => t.cartao), ['KAN-3', 'KAN-1-1', 'KAN-1-2', 'KAN-2-1'], 'os do KAN-1 juntos no lugar do primeiro, pelo X; o do KAN-2 à parte');
    const blocos = app.qaBlocos(ht);
    assert.deepEqual(Array.from(blocos, (b) => [b.pai ? b.pai.cartao : null, Array.from(b.ts, (t) => t.cartao)]),
      [[null, ['KAN-3']], ['KAN-1', ['KAN-1-1', 'KAN-1-2']], ['KAN-2', ['KAN-2-1']]]);
    const h = app.qaHtmlLista();
    const sec = h.slice(h.indexOf('id="qaSec-human-tests"'));
    assert.match(sec, /<div class="qa-subgrupo" role="group" aria-label="Subtickets do KAN-1: O pai KAN-1"><p class="small qa-do-pai qa-subgrupo-de"><span class="qa-do-pai-de">Subtickets do<\/span><button type="button" class="num qa-cartao qa-cartao-toca" data-toca="camada" data-click="qaAbrirTicket\('KAN-1'\)"[^>]*>KAN-1<\/button><span class="qa-do-pai-tit" aria-hidden="true">O pai KAN-1<\/span><\/p><div class="qa-linhas"><button type="button" class="qa-linha" data-toca="camada" data-click="qaAbrirTicket\('KAN-1-1'\)">[\s\S]*?qaAbrirTicket\('KAN-1-2'\)/);
    assert.match(sec, /aria-label="Subticket do KAN-2: O pai KAN-2"[\s\S]*?qaAbrirTicket\('KAN-2-1'\)/);
    assert.doesNotMatch(h, /qa-linha-sub/, 'a linha de um subticket é a de um ticket');
    // um pai que não está na lista: o selo não abre nada
    apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: [S('KAN-40', 1)] } });
    await app.qaCarregar();
    assert.match(app.qaHtmlLista(), /Subticket do<\/span><span class="num qa-cartao">KAN-40<\/span>/);
  });

  test('em A fazer, um subticket de outra prioridade fica no grupo de prioridade do pai, e cada grupo tem o seu número', async () => {
    const ts = [K('KAN-5', { status: 'a-fazer', prioridade: 2, created_at: 9 }), S('KAN-5', 1, { status: 'a-fazer', prioridade: 4, created_at: 8 }), K('KAN-6', { status: 'a-fazer', prioridade: 4, created_at: 7 })];
    apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: ts } });
    noDev();
    await app.qaCarregar();
    const grupos = app.qaGruposDePrioridade(app.qaSeccoes(app.qaLista.tickets).seccoes[0].ts);
    assert.deepEqual(Array.from(grupos, (g) => [g.p, g.blocos.map((b) => b.ts.map((t) => t.cartao).join('+')).join(' | ')]), [[2, 'KAN-5 | KAN-5-1'], [4, 'KAN-6']]);
    const h = app.qaHtmlLista();
    assert.equal((h.match(/id="qaSec-p-2"/g) || []).length, 1);
    assert.equal((h.match(/id="qaSec-p-4"/g) || []).length, 1, 'um grupo por prioridade, sem repetir');
    assert.match(h, />Alta<\/span><span class="qa-grupo-n">2<\/span>/);
  });
});

describe('a janela de um ticket anda pela lista (KAN-168)', () => {
  const lista = () => [K('KAN-11', { resolved_at: 40 }), K('KAN-12', { resolved_at: 30 }), K('KAN-13', { resolved_at: 20 })];

  test('as setas: a posição, as pontas desligadas, e a ordem da lista à vista', async () => {
    apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: lista() }, 'GET /api/qa/:id/comentarios': { comentarios: [] } });
    const abertas = janelasFalsas(app, 'render', 'save');
    noDev();
    await app.qaCarregar();
    assert.deepEqual(Array.from(app.qaNavDaLista('KAN-12')), ['KAN-11', 'KAN-12', 'KAN-13']);
    app.qaAbrirTicket('KAN-11');
    const L = abertas[0];
    const nav = L.el.querySelector('.head > span').innerHTML;
    assert.match(nav, /<button type="button" class="qa-nav-seta" data-nav="-1" data-toca="vista" data-click="qaPassarTicket\(-1\)" aria-label="Ticket anterior" disabled>/, 'no primeiro, a anterior desligada');
    assert.match(nav, /<span class="qa-nav-pos" aria-live="polite">1 de 3<\/span>/);
    assert.match(nav, /aria-label="Ticket seguinte">/);
    assert.equal(app.qaPassarTicket(1), true);
    assert.equal(L.qaId, 'KAN-12');
    assert.equal(L.el.querySelector('.head h2').textContent, 'Erro KAN-12');
    assert.equal(app.qaPassarTicket(1), true);
    assert.equal(app.qaPassarTicket(1), false, 'na ponta não dá a volta');
    assert.equal(L.qaId, 'KAN-13');
    // uma secção recolhida sai da ordem; aberto de lá, a lista toda
    app.qaDobrar('human-tests');
    assert.deepEqual(Array.from(app.qaNavDaLista('KAN-12')), ['KAN-11', 'KAN-12', 'KAN-13'], 'o que abre não está à vista: a lista toda');
  });

  test('depois de Enviar para produção, de Adiar e de Para depois a janela passa ao que ficou no lugar; no último, ao anterior; sem nenhum, fecha', async () => {
    apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: lista() }, 'GET /api/qa/:id/comentarios': { comentarios: [] } });
    const abertas = janelasFalsas(app, 'render', 'save');
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    noDev();
    await app.qaCarregar();
    app.qaAbrirTicket('KAN-12');
    const L = abertas[0];
    assert.equal(await app.qaEnviarProducao('KAN-12'), true);
    assert.equal(L.qaId, 'KAN-13', 'o seguinte ocupou o lugar');
    assert.equal(avisos[avisos.length - 1], 'Cartão KAN-12 em Staging: vai no próximo promove.', 'o aviso diz qual saiu');
    assert.deepEqual(Array.from(L.qaNav), ['KAN-11', 'KAN-13']);
    assert.equal(await app.qaParaDepois('KAN-13'), true);
    assert.equal(L.qaId, 'KAN-11', 'era o último: passa ao anterior');
    assert.match(avisos[avisos.length - 1], /^Cartão KAN-13 em Para depois/);
    assert.equal(await app.qaAdiarProducao('KAN-11'), true);
    assert.equal(app.modalStack.indexOf(L), -1, 'sem nenhum, volta à lista');
  });

  test('comentar devolve a A fazer e passa ao seguinte; com uma resposta por enviar, a janela fica', async () => {
    apiFalsa({ 'GET /api/qa': { colunas: COLUNAS, tickets: lista() }, 'GET /api/qa/:id/comentarios': { comentarios: [] },
      'POST /api/qa/:id/comentarios': { ok: true, coluna: 'a-fazer', comentario: { id: 'c1', texto: 'Falha', autor: { nome: 'Maria' }, created_at: 1 } } });
    const abertas = janelasFalsas(app, 'render', 'save');
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    noDev();
    await app.qaCarregar();
    const campo = { value: '' };
    const doc = app.document, real = doc.getElementById;
    doc.getElementById = (id) => (id === 'qa_com' ? campo : real.call(doc, id));
    try {
      app.qaAbrirTicket('KAN-11');
      const L = abertas[0];
      const q = L.el.querySelector;
      L.el.querySelector = (s) => (s === '#qa_com' ? campo : q(s));
      campo.value = 'Ainda falha no escuro.';
      assert.equal(await app.qaComentar(), true);
      assert.equal(L.qaId, 'KAN-12', 'devolvido a A fazer, sai do sítio');
      assert.equal(avisos[avisos.length - 1], 'Comentário enviado. O cartão KAN-11 passou a A fazer.');
      // uma resposta por escrever: as setas não mudam, e a decisão também não
      campo.value = 'Rascunho';
      assert.equal(app.qaPassarTicket(1), false);
      assert.match(avisos[avisos.length - 1], /resposta por enviar/);
      assert.equal(await app.qaEnviarProducao('KAN-12'), true);
      assert.equal(L.qaId, 'KAN-12', 'com uma resposta por enviar, a janela fica no ticket');
    } finally { doc.getElementById = real; }
  });

  test('o deslize decide como as fotos: um quarto da largura, ou um sacudir; nas pontas resiste e nunca passa de meia largura', () => {
    assert.equal(app.qaDecideDeslize(-110, 400, 0), 1);
    assert.equal(app.qaDecideDeslize(110, 400, 0), -1);
    assert.equal(app.qaDecideDeslize(-60, 400, 0), 0);
    assert.equal(app.qaDecideDeslize(-60, 400, -0.8), 1, 'um sacudir');
    assert.equal(app.qaDecideDeslize(-60, 400, 0.8), 0, 'um sacudir para o outro lado não vira');
    const e = app.qaElastico(-300, 400);
    assert.ok(e < 0 && e > -200, 'resiste: ' + e);
    assert.ok(app.qaElastico(-100000, 400) > -200);
  });
});

/* ------------------------- os modelos e a folha ------------------------- */

describe('tocar num modelo é usá-lo, e a folha não pega no gesto da pega (KAN-167)', () => {
  test('a folha não arranca de um elemento com touch-action:none nem de um draggable; o cabeçalho continua a ser dela', () => {
    const no = (pai, ta, attrs = {}) => ({ parentElement: pai, getAttribute: (k) => attrs[k] ?? null, ta });
    const s = no(null, 'pinch-zoom'), cab = no(s, 'none'), corpo = no(s, 'auto');
    const linha = no(corpo, 'auto'), pega = no(linha, 'none'), icone = no(pega, 'auto'), texto = no(linha, 'auto'), h2 = no(cab, 'auto');
    const arrasta = no(corpo, 'auto', { draggable: 'true' });
    app.getComputedStyle = (e) => ({ touchAction: e.ta, getPropertyValue: () => '' });
    assert.equal(app.folhaTemArrastoProprio(pega, s, cab), true, 'a pega');
    assert.equal(app.folhaTemArrastoProprio(icone, s, cab), true, 'o ícone dentro da pega');
    assert.equal(app.folhaTemArrastoProprio(arrasta, s, cab), true, 'um draggable');
    assert.equal(app.folhaTemArrastoProprio(texto, s, cab), false, 'o texto da linha é da folha');
    assert.equal(app.folhaTemArrastoProprio(h2, s, cab), false, 'o cabeçalho (touch-action:none por ser da folha) continua a arrastar a folha');
  });

  test('a linha de um modelo é o botão de usar, com o ⋯ e a pega à parte', () => {
    noDev();
    vm.runInContext('mdlLista = { modelos: [{ id: "m1", tipo: "dados", origem: "pessoa", nome: "Casa cheia", ordem: 1, criadoEm: 1, resumo: { imoveis: 2 } }, ' +
      '{ id: "m2", tipo: "dados", origem: "pessoa", nome: "Vazia", ordem: 2, criadoEm: 2, resumo: {} }], falhou: false, aPedir: null };', app.__ctx);
    const h = app.mdlHtmlLista();
    assert.match(h, /<li class="mdl-linha mdl-toca" data-id="m1"><button type="button" class="mdl-pega"[^>]*>[\s\S]*?<\/button><button type="button" class="mdl-texto mdl-usar"[^>]*data-click="mdlUsar\('m1'\)">[\s\S]*?<\/button><span class="menuwrap">/);
    const botoes = h.match(/<button type="button" class="mdl-texto mdl-usar"[\s\S]*?<\/button>/g) || [];
    assert.equal(botoes.length, 2);
    assert.ok(botoes.every((b) => !/<(p|div)[ >]/.test(b)), 'só texto em linha dentro do botão (nada de <p> nem <div>)');
  });
});
