// As armações dos testes do servidor: uma conta com sessão, o pedido à API
// como o index.js o faz, e o que se escreve direto na base para montar um
// cenário — casas, registos, compropriedade, cargos, serviços desligados.
// Contra o SQL a sério (testes/lib/bd.js). Viviam copiadas, quase letra a
// letra, em cada ficheiro do servidor, e cada cópia divergia um pouco (um
// pedir aceitava cabeçalhos, outro não; uma conta tinha plano, outra
// palavra-passe): quando o INSERT INTO users ganhar uma coluna, é aqui.

import assert from 'node:assert/strict';
import { baseDeTeste, kvFalso, r2Falso } from './bd.js';
import { handleApi } from '../../worker/src/api.js';
import { createSession, hashPassword } from '../../worker/src/auth.js';
import { TERMS_VERSION } from '../../worker/src/lib/http.js';
import { guardarServico } from '../../worker/src/lib/servicos.js';

/* O ambiente do worker fora de produção (ENV_NAME): a D1, o KV das sessões e
   o R2 dos anexos, todos novos.
   Recebe: extra (opcional) — o que se junta ou troca (um segredo; ENV_NAME:
   undefined para fingir produção).
   Devolve: o env. */
export const ambiente = (extra) => Object.assign(
  { DB: baseDeTeste(), SESSIONS: kvFalso(), FILES: r2Falso(), ENV_NAME: 'teste' }, extra || {});

// um contador só para as contas com e sem sessão: os ids não se repetem
let seq = 0;

/* Uma conta da app com sessão, que aceitou os termos em vigor.
   Recebe: env; nome; opcoes (opcional) — {plano} ('free' por omissão) e
   {pass}: uma palavra-passe a sério, com o hash do worker (sem ela a conta
   não entra por palavra-passe).
   Devolve: {id, email, token, name}. */
export async function conta(env, nome, opcoes) {
  const o = opcoes || {};
  const id = 'U' + String(++seq).padStart(7, '0');
  const email = id.toLowerCase() + '@x.pt';
  const pw = o.pass ? await hashPassword(o.pass) : { hash: 'h', salt: 's' };
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at, plan)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(id, email, nome, pw.hash, pw.salt, Date.now() + seq, TERMS_VERSION, o.plano || 'free').run();
  return { id, email, token: await createSession(env, id, 0), name: nome };
}

/* Uma conta escrita direto na base, sem sessão — a pessoa que o back office
   vê na ficha.
   Recebe: env; extra (opcional) — {email, nome, pass, google}: pass '' é uma
   conta só com Google.
   Devolve: o id. */
export async function novaConta(env, extra) {
  const id = 'U' + String(++seq).padStart(7, '0');
  const o = Object.assign({ email: id.toLowerCase() + '@x.pt', nome: 'Pessoa', pass: 'h', google: null }, extra);
  await env.DB.prepare(
    'INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, google_sub) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, o.email, o.nome, o.pass, o.pass ? 's' : '', Date.now(), o.google).run();
  return id;
}

/* Chama a API como o index.js chama: o caminho, o método, a sessão (Bearer)
   e o corpo.
   Recebe: env; quem — a conta ({token}), ou null para sem sessão; path;
   method ('GET'); corpo (opcional) — um objeto vai em JSON, um texto vai tal
   e qual; headers (opcional).
   Devolve: a promessa da Response. */
export function pedir(env, quem, path, method = 'GET', corpo, headers = {}) {
  const h = Object.assign({}, headers);
  if (quem) h.Authorization = 'Bearer ' + quem.token;
  if (corpo !== undefined && typeof corpo !== 'string') h['Content-Type'] = 'application/json';
  const body = corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  return handleApi(new Request('https://app.x.pt' + path, { method, headers: h, body }), env, { waitUntil() {} });
}

/* O estado da resposta junto com o JSON dela.
   Recebe: p — a promessa de uma Response (a de pedir).
   Devolve: {status, ...o JSON}; só {status} se o corpo não for JSON. */
export async function resp(p) {
  const r = await p;
  let j = null;
  try { j = await r.json(); } catch (e) {}
  return Object.assign({ status: r.status }, j || {});
}

/* O GET /api/state de uma conta.
   Recebe: env; quem — a conta.
   Devolve: a promessa de {status, ...o estado}. */
export const estado = (env, quem) => resp(pedir(env, quem, '/api/state'));

/* O POST /api/sync de uma conta.
   Recebe: env; quem — a conta; ops — as operações.
   Devolve: a promessa dos resultados, um por operação. */
export const sync = async (env, quem, ops) => (await resp(pedir(env, quem, '/api/sync', 'POST', { ops }))).results;

/* Uma casa escrita direto na base; sem nome, chama-se pelo id.
   Recebe: env; dono — a conta; id; data (opcional) — o que se junta a
   {id, name, rooms}; deleted (0) — 1 para uma lápide.
   Devolve: a promessa do run. */
export const casa = (env, dono, id, data, deleted = 0) => env.DB.prepare(
  'INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?)'
).bind(id, dono.id, JSON.stringify(Object.assign({ id, name: id, rooms: [] }, data)), Date.now(), deleted).run();

/* Um registo de uma casa escrito direto na base, com autor e criador.
   Recebe: env; houseId; kind; id; data; autor — a conta.
   Devolve: a promessa do run. */
export const registo = (env, houseId, kind, id, data, autor) => env.DB.prepare(
  `INSERT INTO records (house_id, kind, id, data, updated_at, deleted, author, created_by)
   VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
).bind(houseId, kind, id, JSON.stringify(Object.assign({ id }, data)), Date.now(), autor.id, autor.id).run();

/* Um dado da conta (perfil, definições, um movimento avulso) escrito direto
   na base.
   Recebe: env; quem — a conta; kind; id; data.
   Devolve: a promessa do run. */
export const dadoGlobal = (env, quem, kind, id, data) => env.DB.prepare(
  'INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0)'
).bind(quem.id, kind, id, JSON.stringify(Object.assign({ id }, data)), Date.now()).run();

/* Compropriedade à moda de sempre: uma conexão aceite e uma partilha por casa.
   Recebe: env; dono e outro — as contas; houseIds — as casas partilhadas.
   Devolve: o id da conexão. */
export async function comproprietario(env, dono, outro, houseIds) {
  const cid = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO connections (id, requester_id, target_id, status, created_at) VALUES (?, ?, ?, 'accepted', ?)"
  ).bind(cid, dono.id, outro.id, Date.now()).run();
  for (const h of houseIds) {
    await env.DB.prepare('INSERT INTO shares (connection_id, owner_id, house_id) VALUES (?, ?, ?)').bind(cid, dono.id, h).run();
  }
  return cid;
}

/* Um cargo criado pela API, como o dono o cria.
   Recebe: env; dono; name; perms; id — o id do cargo.
   Devolve: o id; falha a asserção se a API recusar. */
export async function cargo(env, dono, name, perms, id) {
  const r = await resp(pedir(env, dono, '/api/roles/' + id, 'PUT', { name, perms }));
  assert.ok(r.status === 200 || r.status === 201, 'cargo criado: ' + JSON.stringify(r));
  return id;
}

/* Um convite de colaborador com um cargo, pela API.
   Recebe: env; dono; roleId; houseIds; label (opcional).
   Devolve: a resposta (com o token); falha a asserção se não for 201. */
export async function convidar(env, dono, roleId, houseIds, label) {
  const r = await resp(pedir(env, dono, '/api/collab-invites', 'POST', { roleId, houseIds, label }));
  assert.equal(r.status, 201, 'convite criado: ' + JSON.stringify(r));
  return r;
}

/* Aceitar um convite, como quem o recebeu.
   Recebe: env; quem — a conta; token — o do convite.
   Devolve: a promessa de {status, ...}. */
export const aceitar = (env, quem, token) => resp(pedir(env, quem, '/api/convite/' + token + '/aceitar', 'POST', {}));

/* Dar um cargo a alguém pelo caminho a sério: o dono convida, a pessoa aceita.
   Recebe: env; dono; quem; roleId; houseIds.
   Devolve: a resposta do aceitar; falha a asserção se não for 200. */
export async function darCargo(env, dono, quem, roleId, houseIds) {
  const inv = await convidar(env, dono, roleId, houseIds);
  const r = await aceitar(env, quem, inv.token);
  assert.equal(r.status, 200, 'aceite: ' + JSON.stringify(r));
  return r;
}

/* O rasto do back office, pela ordem em que se escreveu.
   Recebe: env.
   Devolve: as linhas do audit_log. */
export const auditoria = async (env) => (await env.DB.prepare('SELECT * FROM audit_log ORDER BY id').all()).results;

/* Desligar um serviço a uma conta, como o back office faz (o fecho aplica-se).
   Recebe: env; quem — a conta; id — o serviço.
   Devolve: a promessa do guardarServico. */
export const desligar = (env, quem, id) => guardarServico(env, quem.id, id, false, 'suporte');

/* Ligar tudo de novo: apaga as linhas — ausência é ligado.
   Recebe: env; quem — a conta.
   Devolve: a promessa do run. */
export const ligarTudo = (env, quem) => env.DB.prepare('DELETE FROM user_services WHERE user_id = ?').bind(quem.id).run();

/* As tabelas em que as rotas da app escrevem — menos rate_limits (o travão
   toca-lhe em qualquer pedido) e user_services (os testes mexem-lhe de
   propósito). */
export const TABELAS = [
  'houses', 'records', 'user_records', 'roles', 'collaborators', 'collaborator_houses', 'collab_invites',
  'share_links', 'share_requests', 'connections', 'shares', 'share_proposals', 'audit_log', 'files',
];

/* A fotografia dessas tabelas. Duas iguais provam que uma recusa não deixou
   rasto: nem linha nova, nem lápide, nem auditoria.
   Recebe: env.
   Devolve: {tabela: [linhas em JSON, ordenadas]}. */
export async function fotografia(env) {
  const out = {};
  for (const t of TABELAS) {
    out[t] = (await env.DB.prepare('SELECT * FROM ' + t).all()).results.map((r) => JSON.stringify(r)).sort();
  }
  return out;
}
