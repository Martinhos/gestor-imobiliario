// Correções do servidor (API, dados e segurança) depois da avaliação de
// 2026-09-14. Cada teste diz a regra; o achado que o fez nascer vai num
// comentário por cima. Contra o SQL a sério (testes/lib/bd.js) e pelo
// handleApi — ou pelo index.js inteiro, quando o que se prova são os
// cabeçalhos que o harden() põe por cima.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash, generateKeyPairSync, sign as assinarNode } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { kvFalso } from './lib/bd.js';
import { ambiente, conta, pedir, resp, sync, casa, registo, comproprietario } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';
import worker from '../worker/src/index.js';
import { hashPassword, verifyPassword, getSessionUser } from '../worker/src/auth.js';
import { verifyIdToken } from '../worker/src/oauth.js';
import { purgeAccount, apagarCasa } from '../worker/src/lib/acesso.js';
import { recordReport } from '../worker/src/lib/relatos.js';
import { rateLimit } from '../worker/src/lib/limites.js';
import { rotaGenerica } from '../worker/src/lib/medidas.js';
import { guardarServico } from '../worker/src/lib/servicos.js';
import * as http from '../worker/src/lib/http.js';
import * as files from '../worker/src/files.js';
import * as auditoria from '../worker/src/lib/auditoria.js';

/* ------------------------------ armações ------------------------------- */
// as de todos os testes do servidor vêm de testes/lib/api.js — a conta com
// palavra-passe a sério é conta(env, nome, {pass}), e o R2 falso de
// testes/lib/bd.js apaga listas de chaves, como o verdadeiro; estas são deste ficheiro

const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const producao = (extra) => { const e = ambiente(extra); delete e.ENV_NAME; return e; };
const semEspera = { waitUntil() {} };

// o worker inteiro, como a Cloudflare o chama; espera pelo que ficou em fundo
async function peloWorker(env, pedido) {
  const fundo = [];
  const r = await worker.fetch(pedido, env, { waitUntil(p) { fundo.push(p); } });
  await Promise.all(fundo);
  return r;
}

// um anexo já carregado: a linha na D1 e o objeto no R2
async function anexo(env, id, dono, houseId, tipo = 'text/plain', kind = null) {
  await env.FILES.put(id, new Uint8Array([60, 104, 49, 62]));
  await env.DB.prepare(
    `INSERT INTO files (id, owner_id, house_id, name, type, size, created_at, record_kind, record_id)
     VALUES (?, ?, ?, 'f', ?, 4, ?, ?, ?)`
  ).bind(id, dono.id, houseId, tipo, Date.now(), kind, kind ? id : null).run();
}
const linhaDoAnexo = (env, id) => env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
const carregar = (env, quem, id, corpo, tipo, extra = {}) => pedir(env, quem, '/api/files/' + id, 'PUT', corpo,
  Object.assign({ 'X-Ficheiro-Tipo': tipo, 'X-Ficheiro-Nome': 'x', 'Content-Length': String(corpo.length) }, extra));
const buscar = (env, quem, id) => peloWorker(env, new Request('https://app.x.pt/api/files/' + id, {
  headers: { Authorization: 'Bearer ' + quem.token },
}));
const conta1 = async (env, sql, ...b) => (await env.DB.prepare(sql).bind(...b).first()).n;

/* ------------------------- A.4-1 · anexos inline ------------------------ */

describe('os anexos servem-se sem correr na origem da app', () => {
  // achado A.4-1
  test('um anexo com um tipo que corre no browser sai como descarga, em caixa de areia', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    for (const [id, tipo] of [['fh', 'text/html'], ['fs', 'image/svg+xml'], ['fx', 'application/xhtml+xml']]) {
      assert.equal((await resp(carregar(env, A, id, '<script>alert(1)</script>', tipo))).status, 200);
      const r = await buscar(env, A, id);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('Content-Type'), 'application/octet-stream', tipo + ' não sai com o tipo de quem carregou');
      assert.match(r.headers.get('Content-Disposition'), /^attachment;/, tipo + ' vai como descarga');
      assert.match(r.headers.get('Content-Security-Policy'), /(^|;\s*)sandbox(;|$)/, 'e o harden deixa a caixa de areia');
      assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
    }
  });

  test('uma imagem ou um PDF abrem no sítio, mas também em caixa de areia', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    for (const tipo of ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']) {
      const id = 'f' + tipo.replace(/\W/g, '');
      await resp(carregar(env, A, id, 'bytes', tipo));
      const r = await buscar(env, A, id);
      assert.equal(r.headers.get('Content-Type'), tipo);
      assert.match(r.headers.get('Content-Disposition'), /^inline;/);
      assert.match(r.headers.get('Content-Security-Policy'), /sandbox/);
    }
  });

  test('um anexo antigo gravado com text/html também sai como descarga', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await anexo(env, 'velho', A, null, 'text/html');
    const r = await buscar(env, A, 'velho');
    assert.equal(r.headers.get('Content-Type'), 'application/octet-stream');
    assert.match(r.headers.get('Content-Disposition'), /^attachment;/);
  });

  test('o PUT guarda um tipo MIME válido, sem parâmetros, ou o genérico', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await resp(carregar(env, A, 't1', 'x', 'Text/HTML; charset=utf-8'));
    assert.equal((await linhaDoAnexo(env, 't1')).type, 'text/html');
    await resp(carregar(env, A, 't2', 'x', '<script>'));
    assert.equal((await linhaDoAnexo(env, 't2')).type, 'application/octet-stream');
    await resp(carregar(env, A, 't3', 'x', ''));
    assert.equal((await linhaDoAnexo(env, 't3')).type, 'application/octet-stream');
  });

  test('o harden continua a impor a CSP geral a tudo o resto', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const r = await peloWorker(env, new Request('https://app.x.pt/api/me', { headers: { Authorization: 'Bearer ' + A.token } }));
    assert.match(r.headers.get('Content-Security-Policy'), /default-src 'self'/);
    assert.doesNotMatch(r.headers.get('Content-Security-Policy'), /sandbox/);
    assert.equal(http.CSP_ANEXO.includes('sandbox'), true);
    assert.match(ler('worker/src/index.js'), /'Content-Security-Policy':\s*\[CSP_ANEXO, CSP_ESTRITA\]/,
      'o PODE_APERTAR deixa passar só esses valores: o do anexo e o das páginas do worker');
  });
});

/* ---------------------- A.4-2 · anexos por apagar ---------------------- */

describe('apagar a conta apaga os anexos', () => {
  // achado A.4-2
  test('os anexos de quem apaga a conta saem da D1 e do R2', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const P = await conta(env, 'Pedro');
    await casa(env, A, 'HA');
    await comproprietario(env, A, P, ['HA']);
    await anexo(env, 'fa', A, 'HA');
    await anexo(env, 'solto', A, null);
    await anexo(env, 'dop', P, 'HA');   // carregado pelo comproprietário para a casa de A
    await purgeAccount(env, A.id);
    for (const id of ['fa', 'solto', 'dop']) {
      assert.equal(await linhaDoAnexo(env, id), null, id + ' saiu da D1');
      assert.equal(env.FILES.m.has(id), false, id + ' saiu do R2');
    }
  });

  test('o que a pessoa carregou para a casa de outro fica na casa, e passa a ser do dono dela', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const B = await conta(env, 'Bruno');
    await casa(env, B, 'HB');
    await comproprietario(env, B, A, ['HB']);
    await anexo(env, 'contrato', A, 'HB', 'application/pdf', 'contract');
    await purgeAccount(env, A.id);
    const f = await linhaDoAnexo(env, 'contrato');
    assert.ok(f, 'o documento da casa de B fica');
    assert.equal(f.owner_id, B.id, 'e passa para o dono da casa');
    assert.equal(env.FILES.m.has('contrato'), true);
    assert.equal((await buscar(env, B, 'contrato')).status, 200, 'B continua a abri-lo');
  });

  test('os anexos de uma casa apagada saem na varredura, passado o prazo de desfazer', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await casa(env, A, 'HA');
    await casa(env, A, 'HV');
    await anexo(env, 'fa', A, 'HA');
    await anexo(env, 'fv', A, 'HV');
    await apagarCasa(env, 'HA', A.id);
    const agora = Date.now();
    await files.varrerAnexos(env, agora);
    assert.ok(await linhaDoAnexo(env, 'fa'), 'logo a seguir fica: a app deixa desfazer');
    await files.varrerAnexos(env, agora + 31 * 86400000);
    assert.equal(await linhaDoAnexo(env, 'fa'), null, 'passado o prazo sai da D1');
    assert.equal(env.FILES.m.has('fa'), false, 'e do R2');
    assert.ok(await linhaDoAnexo(env, 'fv'), 'a casa viva não se toca');
    assert.match(ler('worker/src/index.js'), /varrerAnexos\(env/, 'o cron diário chama a varredura');
  });

  test('os anexos que ficaram de contas já apagadas saem na varredura, menos os de uma casa viva', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const B = await conta(env, 'Bruno');
    await casa(env, B, 'HB');
    await anexo(env, 'soltoVelho', A, null);
    await anexo(env, 'semCasa', A, 'CASA-QUE-JA-NAO-EXISTE');
    await anexo(env, 'naCasaViva', A, 'HB');
    // apagada antes desta correção: a lápide ficou, os anexos também
    await env.DB.prepare('UPDATE users SET deleted_at = 1 WHERE id = ?').bind(A.id).run();
    await anexo(env, 'deBruno', B, null);
    assert.equal(await files.varrerAnexos(env), 2);
    assert.equal(await linhaDoAnexo(env, 'soltoVelho'), null);
    assert.equal(await linhaDoAnexo(env, 'semCasa'), null);
    assert.equal(env.FILES.m.has('soltoVelho'), false);
    assert.ok(await linhaDoAnexo(env, 'naCasaViva'), 'o que está numa casa viva pertence à casa');
    assert.ok(await linhaDoAnexo(env, 'deBruno'), 'um anexo solto de uma conta viva fica');
  });
});

/* --------------------- A.4-3a · o selo do /api/state -------------------- */

describe('o /api/state tem selo: o mesmo estado dá 304', () => {
  const ver = (env, quem, etag) => pedir(env, quem, '/api/state', 'GET', undefined, etag ? { 'If-None-Match': etag } : {});

  // achado A.4-3a
  test('o ETag de volta, com o estado igual, dá 304 sem corpo', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dora');
    await casa(env, D, 'H1');
    const r1 = await ver(env, D);
    const etag = r1.headers.get('ETag');
    assert.match(etag || '', /^"[0-9a-f]{16,}"$/, 'um ETag forte');
    const r2 = await ver(env, D, etag);
    assert.equal(r2.status, 304);
    assert.equal(await r2.text(), '', 'sem corpo');
    assert.equal(r2.headers.get('ETag'), etag);
    const r3 = await ver(env, D, 'W/' + etag);
    assert.equal(r3.status, 304, 'o W/ que a Cloudflare põe ao comprimir não estraga o selo');
    assert.equal((await ver(env, D, '"outro"')).status, 200);
  });

  test('o selo muda com cada coisa que a resposta leva', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dora');
    const P = await conta(env, 'Paulo');
    const X = await conta(env, 'Xavier');
    const C = await conta(env, 'Carla');
    await casa(env, D, 'H1');
    await casa(env, D, 'H2');
    await comproprietario(env, D, P, ['H1']);
    await registo(env, 'H1', 'tx', 't1', { label: 'Renda', value: 500 }, D);
    await registo(env, 'H1', 'tx', 't2', { label: 'Água', value: 20 }, D);
    await resp(pedir(env, D, '/api/roles/r1', 'PUT', { name: 'Contabilista', perms: ['tx.view'] }));
    const inv = await resp(pedir(env, D, '/api/collab-invites', 'POST', { roleId: 'r1', houseIds: ['H1'] }));
    assert.equal((await resp(pedir(env, C, '/api/convite/' + inv.token + '/aceitar', 'POST', {}))).status, 200);

    // o selo de D e o de C, antes e depois de cada mudança
    let seloD = (await ver(env, D)).headers.get('ETag');
    let seloC = (await ver(env, C)).headers.get('ETag');
    const mudou = async (quem, selo, porque) => {
      const r = await ver(env, quem, selo);
      assert.equal(r.status, 200, porque + ': o selo antigo já não serve');
      const novo = r.headers.get('ETag');
      assert.notEqual(novo, selo, porque);
      assert.equal((await ver(env, quem, novo)).status, 304, porque + ': e o novo volta a dar 304');
      return novo;
    };
    const igual = async (quem, selo, porque) => assert.equal((await ver(env, quem, selo)).status, 304, porque);

    await igual(D, seloD, 'nada mudou');
    await sync(env, D, [{ op: 'del', scope: 'record', houseId: 'H1', kind: 'tx', id: 't2' }]);
    seloD = await mudou(D, seloD, 'registo apagado');
    seloC = await mudou(C, seloC, 'registo apagado, visto pelo colaborador');
    await comproprietario(env, D, X, ['H2']);
    seloD = await mudou(D, seloD, 'casa partilhada');
    await env.DB.prepare(
      `INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted) VALUES (?, 'profile', 'main', ?, ?, 0)`
    ).bind(P.id, JSON.stringify({ id: 'main', nif: '123456789' }), Date.now()).run();
    seloD = await mudou(D, seloD, 'perfil de um comproprietário');
    await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind('Paulo Novo', P.id).run();
    seloD = await mudou(D, seloD, 'nome de um comproprietário');
    await guardarServico(env, D.id, 'visits', false, 'teste');
    seloD = await mudou(D, seloD, 'serviço desligado');
    await resp(pedir(env, D, '/api/roles/r1', 'PUT', { name: 'Contabilista', perms: ['tx.view', 'tenant.view'] }));
    seloD = await mudou(D, seloD, 'cargo alterado, visto pelo dono');
    await mudou(C, seloC, 'cargo alterado, visto pelo colaborador');
    await igual(D, seloD, 'e sem mais nada, 304');
  });
});

/* --------------- A.4-4 · o token de reposição sai do KV ---------------- */

describe('a reposição da palavra-passe não depende do KV', () => {
  // o email de reposição, apanhado à saída para o Resend
  async function pedirReposicao(env, email) {
    let corpo = null;
    const antes = globalThis.fetch;
    globalThis.fetch = async (url, opts) => { corpo = JSON.parse(opts.body); return new Response('{}', { status: 200 }); };
    try {
      assert.equal((await resp(pedir(env, null, '/api/auth/repor', 'POST', { email }))).status, 200);
    } finally { globalThis.fetch = antes; }
    return corpo && /repor=([a-f0-9]{64})/.exec(corpo.text)[1];
  }
  const confirmar = (env, t, password) => resp(pedir(env, null, '/api/auth/repor/confirmar', 'POST', { t, password }));

  // achado A.4-4
  test('a ligação vale lida noutro ponto de presença, uma vez, e só se guarda o hash', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const A = await conta(env, 'Ana', { pass: 'Antiga#2026' });
    const t = await pedirReposicao(env, A.email);
    assert.ok(t, 'o email levou a ligação');
    assert.equal([...env.SESSIONS.m.keys()].filter((k) => k.startsWith('repor:')).length, 0, 'nada no KV');
    const linha = await env.DB.prepare('SELECT * FROM password_resets').first();
    assert.equal(linha.token_hash, createHash('sha256').update(t).digest('hex'), 'na base só o hash');
    assert.equal(linha.user_id, A.id);
    // o telemóvel abre a ligação noutro ponto de presença: outro KV, a mesma D1
    const noutro = Object.assign({}, env, { SESSIONS: kvFalso() });
    assert.deepEqual(await confirmar(noutro, t, 'Nova#20261'), { status: 200, ok: true });
    assert.equal((await confirmar(noutro, t, 'Outra#20261')).status, 410, 'uso único');
    const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(A.id).first();
    assert.equal(await verifyPassword('Nova#20261', u.pass_salt, u.pass_hash), true);
    assert.equal(u.sess_epoch, 1, 'as sessões antigas caem');
  });

  test('uma ligação expirada ou inventada dá o mesmo 410', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const A = await conta(env, 'Ana', { pass: 'Antiga#2026' });
    const t = await pedirReposicao(env, A.email);
    await env.DB.prepare('UPDATE password_resets SET expires_at = ?').bind(Date.now() - 1).run();
    assert.equal((await confirmar(env, t, 'Nova#20261')).status, 410);
    assert.equal((await confirmar(env, 'c'.repeat(64), 'Nova#20261')).status, 410);
  });
});

/* ------------- A.4-5 · uma escrita só, para o REST e o sync ------------ */

describe('as escritas de casas e registos vivem num sítio só', () => {
  // achado A.4-5
  test('o /api/sync e as rotas REST chamam a mesma função, e o SQL de escrita só está nela', () => {
    const esc = ler('worker/src/lib/escritas.js');
    for (const f of ['worker/src/rotas/sync.js', 'worker/src/rotas/casas.js']) {
      const s = ler(f);
      assert.match(s, /aplicarOp\(/, f + ' escreve pela aplicarOp');
      // (as quotas, que só casas.js tem, continuam a gravar a ficha: não são uma cópia do sync)
      assert.doesNotMatch(s, /INSERT INTO records|INSERT INTO houses|UPDATE houses SET data = \?, updated_at = \?, deleted|INSERT INTO user_records|UPDATE records SET deleted|UPDATE user_records SET deleted/,
        f + ' já não tem o SQL da escrita');
    }
    assert.match(esc, /INSERT INTO records/);
    assert.match(esc, /INSERT INTO user_records/);
  });

  test('uma escrita pelo REST gasta o mesmo travão de ritmo que o sync', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dora');
    await casa(env, D, 'H1');
    await env.DB.prepare('INSERT INTO rate_limits (k, n, expires_at) VALUES (?, 60, ?)').bind('w:' + D.id, Date.now() + 60000).run();
    assert.equal((await resp(pedir(env, D, '/api/houses/H1/records/tx/t1', 'PUT', { data: { label: 'x' } }))).status, 429);
    assert.equal((await resp(pedir(env, D, '/api/sync', 'POST', { ops: [] }))).status, 429);
  });

  test('o REST e o sync dão o mesmo veredicto e deixam a mesma linha', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dora');
    await casa(env, D, 'H1');
    await resp(pedir(env, D, '/api/houses/H1/records/tx/a', 'PUT', { data: { label: 'REST', _author: 'X' } }));
    await sync(env, D, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'b', data: { label: 'sync', _author: 'X' } }]);
    const a = await env.DB.prepare("SELECT * FROM records WHERE id = 'a'").first();
    const b = await env.DB.prepare("SELECT * FROM records WHERE id = 'b'").first();
    assert.deepEqual([a.author, a.created_by, a.deleted], [b.author, b.created_by, b.deleted]);
    assert.deepEqual(Object.keys(JSON.parse(a.data)).sort(), Object.keys(JSON.parse(b.data)).sort());
    assert.equal((await resp(pedir(env, D, '/api/houses/H1/records/tx/a', 'PUT', { data: [1] }))).status, 400);
    assert.deepEqual(await sync(env, D, [{ op: 'put', scope: 'record', houseId: 'H1', kind: 'tx', id: 'b', data: [1] }]), [{ ok: false, status: 400 }]);
  });
});

/* ------------------ A.4-6a · teto e travão nos anexos ------------------ */

describe('os anexos têm teto por conta e travão de ritmo', () => {
  // achado A.4-6a
  test('passado o teto da conta, o anexo é recusado e a resposta diz quanto falta', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    await env.DB.prepare(
      `INSERT INTO files (id, owner_id, house_id, name, type, size, created_at) VALUES ('grande', ?, NULL, 'g', 'application/pdf', ?, 1)`
    ).bind(A.id, files.TETO_POR_CONTA - 10).run();
    const r = await resp(carregar(env, A, 'mais', 'x'.repeat(20), 'text/plain'));
    assert.equal(r.status, 413);
    assert.match(r.error, /espaço/i);
    assert.equal(env.FILES.m.has('mais'), false);
    assert.equal((await resp(carregar(env, A, 'cabe', 'x'.repeat(5), 'text/plain'))).status, 200, 'o que cabe entra');
    // voltar a gravar o mesmo anexo não conta duas vezes
    assert.equal((await resp(carregar(env, A, 'cabe', 'x'.repeat(8), 'text/plain'))).status, 200);
  });

  test('carregar anexos novos tem travão de ritmo por conta; voltar a subir o mesmo não conta', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    assert.equal((await resp(carregar(env, A, 'ja', 'x', 'text/plain'))).status, 200);
    await env.DB.prepare('UPDATE rate_limits SET n = 1000 WHERE k = ?').bind('up:' + A.id).run();
    assert.equal((await resp(carregar(env, A, 'f1', 'x', 'text/plain'))).status, 429, 'um anexo novo espera');
    // o cliente volta a subir o que tem no aparelho depois de cada sincronização
    assert.equal((await resp(carregar(env, A, 'ja', 'xy', 'text/plain'))).status, 200, 'o que já existe volta a subir');
  });

  test('a linha na D1 nasce antes do objeto no R2: um INSERT que falha não deixa órfãos', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => { if (/INSERT INTO files/.test(sql)) throw new Error('D1 em baixo'); return prepare(sql); };
    await assert.rejects(carregar(env, A, 'orfao', 'x', 'text/plain'));
    env.DB.prepare = prepare;
    assert.equal(env.FILES.m.has('orfao'), false, 'nada no R2 sem linha na D1');
  });

  test('se o R2 falhar, a linha nova sai', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    env.FILES.put = async () => { throw new Error('R2 em baixo'); };
    await assert.rejects(carregar(env, A, 'semobj', 'x', 'text/plain'));
    assert.equal(await linhaDoAnexo(env, 'semobj'), null);
  });
});

/* ---------------- A.4-7a · o token da sessão fora do corpo -------------- */

describe('o token da sessão não vai no corpo das respostas', () => {
  const registar = (env, email, headers) => pedir(env, null, '/api/auth/register', 'POST',
    { email, password: 'Forte#2026', name: 'N', terms: http.TERMS_VERSION }, headers);
  const entrar = (env, email, headers) => pedir(env, null, '/api/auth/login', 'POST', { email, password: 'Forte#2026' }, headers);
  const pede = { 'X-Rendorium-Token': '1' };

  // achado A.4-7a
  test('em produção: registo, entrada, palavra-passe e sessões só põem o cookie', async () => {
    const env = producao();
    const r = await registar(env, 'ana@exemplo.pt', pede);
    const j = await r.json();
    assert.equal(r.status, 201);
    assert.ok(!('token' in j), 'o registo não devolve o token, nem a pedido');
    assert.match(r.headers.get('Set-Cookie'), /gi_session=[a-f0-9]{64}; .*HttpOnly/);
    const e = await entrar(env, 'ana@exemplo.pt', pede);
    assert.ok(!('token' in (await e.json())), 'a entrada também não');
    const cookie = /gi_session=([a-f0-9]{64})/.exec(e.headers.get('Set-Cookie'))[1];
    const comCookie = { Cookie: 'gi_session=' + cookie };
    const pw = await pedir(env, null, '/api/me/password', 'POST', { current: 'Forte#2026', next: 'Forte#2027' }, Object.assign({}, comCookie, pede));
    assert.equal(pw.status, 200);
    assert.ok(!('token' in (await pw.json())), 'mudar a palavra-passe também não');
    const cookie2 = /gi_session=([a-f0-9]{64})/.exec(pw.headers.get('Set-Cookie'))[1];
    const s = await pedir(env, null, '/api/me/sessions', 'DELETE', undefined, { Cookie: 'gi_session=' + cookie2 });
    assert.equal(s.status, 200);
    assert.ok(!('token' in (await s.json())), 'sair nos outros aparelhos também não');
    assert.match(s.headers.get('Set-Cookie'), /gi_session=[a-f0-9]{64}/);
  });

  test('fora de produção, e só a pedido (X-Rendorium-Token: 1), o token vem no corpo', async () => {
    const env = ambiente({ ENV_NAME: 'dev' });
    const semPedir = await (await registar(env, 'b@exemplo.pt')).json();
    assert.ok(!('token' in semPedir), 'sem o cabeçalho, não');
    const j = await (await entrar(env, 'b@exemplo.pt', pede)).json();
    assert.match(j.token, /^[a-f0-9]{64}$/);
    // e o Bearer continua a valer, para os clientes antigos e os fluxos de teste
    assert.equal((await resp(pedir(env, { token: j.token }, '/api/me'))).status, 200);
  });

  test('um aparelho da versão anterior (Bearer antigo) continua dentro pelo cookie, e sair fecha os dois', async () => {
    const env = producao();
    const A = await conta(env, 'Ana', { pass: 'Forte#2026' });
    // muda a palavra-passe: o Bearer que o cliente antigo guardou cai, e o corpo já não traz o novo
    const pw = await pedir(env, A, '/api/me/password', 'POST', { current: 'Forte#2026', next: 'Forte#2027' });
    assert.equal(pw.status, 200);
    const novo = /gi_session=([a-f0-9]{64})/.exec(pw.headers.get('Set-Cookie'))[1];
    const ambos = { Authorization: 'Bearer ' + A.token, Cookie: 'gi_session=' + novo };
    assert.equal((await pedir(env, null, '/api/me', 'GET', undefined, ambos)).status, 200, 'o cookie serve quando o Bearer já não');
    assert.equal((await pedir(env, null, '/api/auth/logout', 'POST', undefined, ambos)).status, 200);
    assert.equal(await env.SESSIONS.get('sess:' + novo), null, 'a sessão do cookie também fechou');
  });

  test('a entrada com Google segue a mesma regra', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'kg', alg: 'RS256', use: 'sig' });
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const agora = Math.floor(Date.now() / 1000);
    const cab = b64u({ alg: 'RS256', kid: 'kg', typ: 'JWT' });
    const corpo = b64u({ iss: 'https://accounts.google.com', aud: 'cid', exp: agora + 600, iat: agora, sub: 'g1', email: 'g@exemplo.pt', email_verified: true, name: 'G' });
    const idToken = cab + '.' + corpo + '.' + assinarNode('sha256', Buffer.from(cab + '.' + corpo), privateKey).toString('base64url');
    const antes = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    try {
      const env = producao({ GOOGLE_CLIENT_ID: 'cid' });
      const r = await pedir(env, null, '/api/auth/google', 'POST', { credential: idToken }, pede);
      assert.equal(r.status, 200);
      assert.ok(!('token' in (await r.json())));
      assert.match(r.headers.get('Set-Cookie'), /gi_session=[a-f0-9]{64}/);
    } finally { globalThis.fetch = antes; }
  });
});

/* -------------------- A.4-8 · as casas de uma conexão ------------------- */

describe('a lista de casas a partilhar numa conexão', () => {
  async function armar() {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const B = await conta(env, 'Bruno');
    const cid = await comproprietario(env, A, B, []);
    for (let i = 0; i < 30; i++) await casa(env, A, 'H' + i);
    return { env, A, B, cid };
  }
  const partilhar = (env, quem, cid, houseIds) => resp(pedir(env, quem, '/api/connections/' + cid + '/shares', 'PUT', { houseIds }));

  // achado A.4-8
  test('tem teto, ids válidos e sem repetidos — e a lista vazia continua a desfazer tudo', async () => {
    const { env, A, cid } = await armar();
    assert.equal((await partilhar(env, A, cid, Array.from({ length: 201 }, (_, i) => 'H' + i))).status, 400);
    assert.equal((await partilhar(env, A, cid, ['H1', '<x>'])).status, 400);
    assert.equal((await partilhar(env, A, cid, ['H1', 'H1', 'H2'])).status, 200);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shares WHERE connection_id = ?', cid), 2, 'sem repetidos');
    assert.equal((await partilhar(env, A, cid, ['H1', 'NAO'])).status, 403);
    assert.equal((await partilhar(env, A, cid, [])).status, 200);
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shares WHERE connection_id = ?', cid), 0);
  });

  test('confere as casas numa consulta, não numa por casa', async () => {
    const { env, A, cid } = await armar();
    const prepare = env.DB.prepare.bind(env.DB);
    let leituras = 0;
    env.DB.prepare = (sql) => { if (/FROM houses/.test(sql)) leituras++; return prepare(sql); };
    assert.equal((await partilhar(env, A, cid, Array.from({ length: 30 }, (_, i) => 'H' + i))).status, 200);
    env.DB.prepare = prepare;
    assert.ok(leituras <= 1, 'leu as casas ' + leituras + ' vezes');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM shares WHERE connection_id = ?', cid), 30);
  });
});

/* ------------------- A.4-9 · a limpeza dos contadores ------------------- */

describe('os contadores do travão não se acumulam', () => {
  // achado A.4-9
  test('as chaves expiradas saem na vigia de hora a hora, seja qual for o limite', async () => {
    const env = ambiente();
    await rateLimit(env, 'login:1.2.3.4', 10, 900);
    await rateLimit(env, 'auth:5.6.7.8', 5, 900);
    await rateLimit(env, 'w:viva', 60, 900);
    await env.DB.prepare("UPDATE rate_limits SET expires_at = 1 WHERE k <> 'w:viva'").run();
    const fundo = [];
    await worker.scheduled({ cron: '0 * * * *' }, env, { waitUntil(p) { fundo.push(p); } });
    await Promise.all(fundo);
    const ks = (await env.DB.prepare('SELECT k FROM rate_limits').all()).results.map((r) => r.k);
    assert.deepEqual(ks, ['w:viva']);
  });
});

/* ------------------- A.4-10 · o nome do ficheiro ------------------------ */

describe('o nome de um anexo', () => {
  // achado A.4-10
  test('um X-Ficheiro-Nome malformado não é um erro do servidor', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const r = await resp(carregar(env, A, 'nm', 'x', 'text/plain', { 'X-Ficheiro-Nome': '%E0%A4%A' }));
    assert.equal(r.status, 200);
    assert.equal((await linhaDoAnexo(env, 'nm')).name, '%E0%A4%A', 'fica o nome tal como veio');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM tickets'), 0, 'e nenhum relato');
  });
});

/* ---------------- A.4-11 · cada rota tira do contexto o que usa --------- */

describe('as rotas dizem de que dependem', () => {
  const PEDIDO = ['env', 'request', 'ctx', 'url', 'path', 'method', 'seg', 'me'];

  // achado A.4-11
  test('do contexto só se tira o que é do pedido, e só o que se usa', () => {
    for (const f of readdirSync(new URL('../worker/src/rotas', import.meta.url))) {
      const s = ler('worker/src/rotas/' + f);
      for (const m of s.matchAll(/const \{([^}]*)\} = c;/g)) {
        const nomes = m[1].split(',').map((x) => x.trim()).filter(Boolean);
        const resto = s.replace(m[0], '');
        for (const n of nomes) {
          assert.ok(PEDIDO.includes(n), f + ': «' + n + '» é biblioteca — importa-se de lib/');
          assert.ok(new RegExp('\\b' + n + '\\b').test(resto), f + ': «' + n + '» tirado do contexto e nunca usado');
        }
      }
    }
    assert.doesNotMatch(ler('worker/src/files.js'), /canAccessHouse/, 'o handleFiles já não recebe o que não usa');
    assert.doesNotMatch(ler('worker/src/rotas/anexos.js'), /canAccessHouse/);
  });
});

/* ------------------ A.4-12/13 · comentários e ternários ----------------- */

describe('o código diz o que faz', () => {
  const meus = ['index.js', 'api.js', 'auth.js', 'oauth.js', 'files.js', 'lib/acesso.js', 'lib/http.js',
    'lib/limites.js', 'lib/relatos.js', 'lib/medidas.js', 'lib/auditoria.js', 'lib/escritas.js']
    .concat(readdirSync(new URL('../worker/src/rotas', import.meta.url)).map((f) => 'rotas/' + f));

  // achado A.4-12
  test('nenhum ficheiro acaba num comentário sem código a seguir', () => {
    for (const f of meus) {
      const linhas = ler('worker/src/' + f).replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
      const ultima = linhas[linhas.length - 1];
      // a última linha com texto é código: um `//`, um `/*` ou um `*` ali é um comentário sem função
      assert.ok(!/^(\/\/|\/\*|\*)/.test(ultima), f + ' acaba num comentário órfão: ' + ultima);
    }
  });

  // achado A.4-13
  test('nenhum ternário devolve o mesmo valor nos dois ramos', () => {
    for (const f of meus) {
      const s = ler('worker/src/' + f);
      const m = /\?\s*([\w.]+)\s*:\s*([\w.]+)\s*[),;]/g;
      let x;
      while ((x = m.exec(s))) assert.notEqual(x[1], x[2], f + ': «' + x[0] + '» tem os dois ramos iguais');
    }
  });
});

/* --------------------- A.4-14 · só a Google entra ------------------------ */

describe('os fornecedores de entrada', () => {
  // achado A.4-14
  test('só a Google: um token de outro fornecedor é recusado sem ir à rede', async () => {
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const jwt = b64u({ alg: 'RS256', kid: 'k' }) + '.' + b64u({ iss: 'https://appleid.apple.com' }) + '.c2ln';
    let chamadas = 0;
    const antes = globalThis.fetch;
    globalThis.fetch = async () => { chamadas++; return new Response('{"keys":[]}'); };
    try {
      await assert.rejects(verifyIdToken('apple', jwt, 'aud'), /fornecedor/);
    } finally { globalThis.fetch = antes; }
    assert.equal(chamadas, 0, 'não foi buscar chaves da Apple');
    assert.doesNotMatch(ler('worker/src/oauth.js'), /appleid|da Apple/, 'nem as promete');
  });
});

/* ----------------------- A.4-15 · a rota genérica ------------------------ */

describe('a rota genérica esconde os ids pela posição', () => {
  // achado A.4-15
  test('o segmento a seguir a um recurso conhecido é sempre :id', () => {
    const casos = {
      '/api/collab-invites/abcdef012345': '/api/collab-invites/:id',
      '/api/files/id1726000000abc': '/api/files/:id',
      '/api/houses/casa-1/records/tx/t9': '/api/houses/:id/records/tx/:id',
      '/api/houses/casa-1/proposal/accept': '/api/houses/:id/proposal/accept',
      '/api/user-records/tx/r_17': '/api/user-records/tx/:id',
      '/api/connections/ABC/accept': '/api/connections/:id/accept',
      '/api/roles/cargo-contab': '/api/roles/:id',
      '/api/collaborators/xpto': '/api/collaborators/:id',
      '/api/share-requests/k1/accept': '/api/share-requests/:id/accept',
      '/api/convite/zzzz/aceitar': '/api/convite/:token/aceitar',
      '/api/ligar/zzzz/pedir': '/api/ligar/:token/pedir',
      '/api/convite/abcdef012345abcdef': '/api/convite/:token',
      '/api/state': '/api/state',
      '/api/houses': '/api/houses',
    };
    for (const [c, esperado] of Object.entries(casos)) assert.equal(rotaGenerica(c), esperado, c);
  });
});

/* ------------------ A.4-16 · o dono dos erros sem dono ------------------ */

describe('os erros sem utilizador', () => {
  // achado A.4-16
  test('ficam na conta do sistema, não na conta viva mais antiga', async () => {
    const env = ambiente();
    const A = await conta(env, 'A mais antiga');
    await recordReport(env, semEspera, 'server', 'Rebentou', 'stack');
    const t = await env.DB.prepare('SELECT user_id FROM tickets').first();
    assert.notEqual(t.user_id, A.id, 'a conta mais antiga não fica com erros que nunca viu');
    const s = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(t.user_id).first();
    assert.ok(s.deleted_at, 'a conta do sistema não conta como viva');
    assert.equal(s.name, 'Sem utilizador');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL'), 1);
  });

  test('sem contas nenhumas, o erro não se perde', async () => {
    const env = ambiente();
    await recordReport(env, semEspera, 'infra', 'Cópia falhou', 'x');
    assert.equal(await conta1(env, 'SELECT COUNT(*) AS n FROM tickets'), 1);
  });

  test('a migração 0016 devolve ao sistema os erros antigos pendurados na conta mais antiga', () => {
    const db = new DatabaseSync(':memory:');
    const pasta = new URL('../migrations/', import.meta.url);
    const todas = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
    todas.filter((f) => f < '0016').forEach((f) => db.exec(readFileSync(new URL(f, pasta), 'utf8')));
    db.exec(`INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES ('VELHA', 'v@x.pt', 'Velha', 'h', 's', 1);
      INSERT INTO tickets (id, user_id, kind, subject, body, status, category, fingerprint, created_at, updated_at) VALUES
        ('t1', 'VELHA', 'problema', 's', 'stack', 'criado', 'server', 'server:x', 1, 1),
        ('t2', 'VELHA', 'problema', 's', 'erro' || char(10) || char(10) || '(sem sessão iniciada)', 'criado', 'client', 'client:y', 1, 1),
        ('t3', 'VELHA', 'problema', 's', 'o meu erro', 'criado', 'client', 'client:z', 1, 1),
        ('t4', 'VELHA', 'problema', 's', 'ajuda', 'criado', 'user', NULL, 1, 1);`);
    db.exec(readFileSync(new URL(todas.find((f) => f.startsWith('0016')), pasta), 'utf8'));
    const dono = (id) => db.prepare('SELECT user_id FROM tickets WHERE id = ?').get(id).user_id;
    assert.equal(dono('t1'), 'SISTEMA', 'um erro do servidor nunca tem pessoa');
    assert.equal(dono('t2'), 'SISTEMA', 'um relato anónimo também não');
    assert.equal(dono('t3'), 'VELHA', 'um relato com sessão fica com quem o viu');
    assert.equal(dono('t4'), 'VELHA', 'um pedido contado fica com quem o contou');
  });
});

/* ------------------ A.4-17a · pimenta nas palavras-passe ---------------- */

describe('as palavras-passe', () => {
  const entrar = (env, email, password) => resp(pedir(env, null, '/api/auth/login', 'POST', { email, password }));
  const linha = (env, id) => env.DB.prepare('SELECT pass_hash, pass_salt, pass_v FROM users WHERE id = ?').bind(id).first();

  // achado A.4-17a
  test('com PASS_PEPPER, as novas vão com pimenta e as antigas refazem-se ao entrar', async () => {
    const env = ambiente({ PASS_PEPPER: 'segredo-do-worker' });
    const r = await resp(pedir(env, null, '/api/auth/register', 'POST', { email: 'p@exemplo.pt', password: 'Forte#2026', terms: http.TERMS_VERSION }));
    const nova = await linha(env, r.id);
    assert.equal(nova.pass_v, 2);
    assert.equal(await verifyPassword('Forte#2026', nova.pass_salt, nova.pass_hash), false, 'sem a pimenta, a cópia da base não serve');
    assert.equal(await verifyPassword('Forte#2026', nova.pass_salt, nova.pass_hash, 'segredo-do-worker'), true);
    assert.equal((await entrar(env, 'p@exemplo.pt', 'Forte#2026')).status, 200);

    const V = await conta(env, 'Velha', { pass: 'Antiga#2026' });   // hash de antes da pimenta
    assert.equal((await linha(env, V.id)).pass_v, 1);
    assert.equal((await entrar(env, V.email, 'Antiga#2026')).status, 200);
    const refeita = await linha(env, V.id);
    assert.equal(refeita.pass_v, 2, 'refez-se ao entrar');
    assert.equal(await verifyPassword('Antiga#2026', refeita.pass_salt, refeita.pass_hash, 'segredo-do-worker'), true);
    assert.equal((await entrar(env, V.email, 'Antiga#2026')).status, 200, 'e continua a entrar');
    assert.equal((await entrar(env, V.email, 'Errada#2026')).status, 401);
  });

  test('um hash sem pimenta com o pass_v a dizer que a tem (gravado por fora do palavraNova) continua a entrar e refaz-se', async () => {
    const env = ambiente({ PASS_PEPPER: 'p' });
    const r = await resp(pedir(env, null, '/api/auth/register', 'POST', { email: 'q@exemplo.pt', password: 'Forte#2026', terms: http.TERMS_VERSION }));
    const pw = await hashPassword('Trocada#2026');   // sem pimenta e sem mexer no pass_v, que fica 2 do registo
    await env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(pw.hash, pw.salt, r.id).run();
    assert.equal((await entrar(env, 'q@exemplo.pt', 'Trocada#2026')).status, 200);
    const l = await linha(env, r.id);
    assert.equal(await verifyPassword('Trocada#2026', l.pass_salt, l.pass_hash, 'p'), true, 'e fica refeita com pimenta');
  });

  test('sem PASS_PEPPER nada muda', async () => {
    const env = ambiente();
    const r = await resp(pedir(env, null, '/api/auth/register', 'POST', { email: 's@exemplo.pt', password: 'Forte#2026', terms: http.TERMS_VERSION }));
    const l = await linha(env, r.id);
    assert.equal(l.pass_v, 1);
    assert.equal(await verifyPassword('Forte#2026', l.pass_salt, l.pass_hash), true);
    assert.equal((await entrar(env, 's@exemplo.pt', 'Forte#2026')).status, 200);
  });

  test('um email que não existe gasta o mesmo que uma palavra-passe errada', async () => {
    const env = ambiente({ PASS_PEPPER: 'p' });
    await resp(pedir(env, null, '/api/auth/register', 'POST', { email: 'v2@exemplo.pt', password: 'Forte#2026', terms: http.TERMS_VERSION }));
    const V = await conta(env, 'Velha', { pass: 'Antiga#2026' });
    const subtle = globalThis.crypto.subtle;
    const orig = subtle.deriveBits;
    let n = 0;
    subtle.deriveBits = function (...a) { n++; return orig.apply(this, a); };
    const custo = async (email) => { n = 0; await entrar(env, email, 'Errada#2026'); return n; };
    try {
      const semConta = await custo('ninguem@exemplo.pt');
      assert.equal(await custo('v2@exemplo.pt'), semConta, 'conta com pimenta');
      assert.equal(await custo(V.email), semConta, 'conta antiga');
    } finally { delete subtle.deriveBits; }
  });

  test('as iterações são as que os Workers deixam, e o comentário diz porquê', () => {
    const s = ler('worker/src/auth.js');
    assert.match(s, /const PBKDF2_ITERATIONS = 100000;/);
    assert.match(s, /iteration counts above/, 'a mensagem do workerd está citada');
  });
});

/* ----------------------- A.4-18 · os índices ---------------------------- */

describe('as consultas quentes usam índice', () => {
  // o plano de cada consulta que passou pela base enquanto `f` corria
  async function planos(env, f, filtro) {
    const vistas = [];
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => { if (filtro.test(sql)) vistas.push(sql); return prepare(sql); };
    try { await f(); } finally { env.DB.prepare = prepare; }
    return vistas.map((sql) => {
      const pos = sql.replace(/\?\d+/g, '?');
      const n = (pos.match(/\?/g) || []).length;
      return env.DB._db.prepare('EXPLAIN QUERY PLAN ' + pos).all(...Array(n).fill('x')).map((l) => l.detail).join(' | ');
    });
  }

  // achado A.4-18
  test('contar quem tem um cargo não varre a tabela dos colaboradores', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dora');
    await resp(pedir(env, D, '/api/roles/r1', 'PUT', { name: 'Visitas', perms: ['visit.view'] }));
    const ps = await planos(env, async () => {
      await resp(pedir(env, D, '/api/roles'));
      await resp(pedir(env, D, '/api/roles/r1', 'DELETE'));
    }, /collaborators/);
    assert.ok(ps.length >= 2);
    ps.forEach((p) => assert.doesNotMatch(p, /SCAN (c|collaborators)\b(?! USING (COVERING )?INDEX idx_collab_role)/, p));
    ps.forEach((p) => assert.doesNotMatch(p, /sqlite_autoindex_collaborators/, p));
  });

  test('os pedidos de uma pessoa leem-se pelo índice dela', async () => {
    const env = ambiente();
    const A = await conta(env, 'Ana');
    const ps = await planos(env, () => resp(pedir(env, A, '/api/tickets')), /FROM tickets/);
    assert.equal(ps.length, 1);
    assert.match(ps[0], /idx_tickets_user_cat/);
  });
});

/* ---------------- A.4-19 · uma linha estragada não derruba -------------- */

describe('uma linha com JSON estragado', () => {
  // achado A.4-19
  test('sai da resposta do /api/state, fica relatada, e o resto chega', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dora');
    const P = await conta(env, 'Paulo');
    await casa(env, D, 'H1');
    await casa(env, D, 'H2');
    await comproprietario(env, D, P, ['H1']);
    await registo(env, 'H1', 'tx', 'bom', { label: 'Renda' }, D);
    await registo(env, 'H1', 'tx', 'mau', {}, D);
    await registo(env, 'H2', 'tx', 'daCasaMa', { label: 'x' }, D);
    await env.DB.prepare("UPDATE records SET data = '{estragado' WHERE id = 'mau'").run();
    await env.DB.prepare("UPDATE houses SET data = 'nao json' WHERE id = 'H2'").run();
    await env.DB.prepare(`INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted) VALUES (?, 'tpl', 'u1', '[', 1, 0)`).bind(D.id).run();
    await env.DB.prepare(`INSERT INTO share_proposals (house_id, proposed_by, shares, approvals, created_at) VALUES ('H1', ?, 'x', '[]', 1)`).bind(D.id).run();
    const fundo = [];
    const r = await handleApi(new Request('https://app.x.pt/api/state', { headers: { Authorization: 'Bearer ' + D.token } }), env, { waitUntil(p) { fundo.push(p); } });
    await Promise.all(fundo);
    assert.equal(r.status, 200);
    const st = await r.json();
    assert.deepEqual(st.houses.map((h) => h.id), ['H1'], 'a casa estragada sai');
    assert.deepEqual(st.records.map((x) => x.id), ['bom'], 'o registo estragado sai, e os da casa estragada também');
    assert.deepEqual(st.userRecords, []);
    assert.deepEqual(st.proposals, []);
    const t = await env.DB.prepare('SELECT * FROM tickets').first();
    assert.ok(t, 'quem programa fica a saber');
    assert.match(t.body, /records H1\/tx\/mau/);
    assert.match(t.body, /houses H2/);
  });

  test('uma sessão estragada no KV é uma sessão inválida, não um 500', async () => {
    const env = ambiente();
    const tok = 'd'.repeat(64);
    await env.SESSIONS.put('sess:' + tok, '{nao');
    assert.equal(await getSessionUser(env, new Request('https://x.pt/', { headers: { Authorization: 'Bearer ' + tok } })), null);
  });
});

/* ------------------- A.5-4b · o /api/discord no index ------------------- */

describe('a rota do bot no index.js', () => {
  // achado A.5-4b
  test('uma exceção vira 500 com relato, como nas outras rotas da API', async () => {
    const env = ambiente();
    const corpo = new ReadableStream({ start(c) { c.error(new Error('corpo cortado')); } });
    const r = await peloWorker(env, new Request('https://app.x.pt/api/discord', { method: 'POST', body: corpo, duplex: 'half' }));
    assert.equal(r.status, 500);
    const t = await env.DB.prepare('SELECT * FROM tickets').first();
    assert.ok(t, 'ficou um relato');
    assert.match(t.body, /POST \/api\/discord/);
  });
});

/* ------------------ A.5-17 · o cron diário por constante ----------------- */

describe('o cron diário', () => {
  // achado A.5-17
  test('reconhece-se por uma constante que o wrangler.toml tem, não por um prefixo', () => {
    assert.equal(typeof auditoria.CRON_DIARIO, 'string');
    const crons = /crons\s*=\s*\[([^\]]*)\]/.exec(ler('wrangler.toml'))[1];
    assert.ok(crons.split(',').map((s) => s.trim().replace(/"/g, '')).includes(auditoria.CRON_DIARIO),
      'o wrangler.toml agenda exatamente esse horário');
    const idx = ler('worker/src/index.js');
    assert.match(idx, /event\.cron === CRON_DIARIO/);
    assert.doesNotMatch(idx, /startsWith\('0 9 '\)/);
  });
});
