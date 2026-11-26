// Os modelos de dados do Lab (KAN-167): no dev, quem testa troca os dados da
// conta de teste em que está pelos de um modelo — um cenário escrito em código
// (web/app/modelos-cenarios.js, que o cliente constrói com as datas de hoje)
// ou uma conta gravada antes («Guardar como modelo novo», com as datas tal
// como estavam) — e grava, renomeia, ordena e remove os seus. A vista é a
// web/cloud/modelos.js; a tabela, a qa_modelos (migrations/0035_modelos_de_dados.sql).
//
// Só fora de produção: sem env.ENV_NAME (ou com o 'producao'), todas as rotas
// respondem 404 antes de lerem o corpo. Os modelos são de cada pessoa
// (donoDaConta): a conta do Discord por trás da conta de teste, a pessoa da
// equipa no back office (rotasModelosDaEquipa). Substituir os dados
// (usarModelo) é o que apaga, e por isso tem três portas: só numa conta de
// teste (teste.js:eContaDeTeste), só com a confirmação escrita no pedido
// ({confirmar: 'substituir'}, que a janela da confirmação manda), e só de uma
// vez — o que sai e o que entra vão num lote da D1, que é uma transação: ou
// fica tudo, ou nada.
import { json, err, body, badId, now, cleanData, tooBig } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { preserveOwnership } from '../lib/acesso.js';
import { eContaDeTeste } from '../teste.js';

// Os modelos de uma pessoa, no máximo (os de base contam).
const TETO_MODELOS = 100;
// Os cenários de base que um GET semeia de uma vez, no máximo.
const TETO_BASE = 40;
// O nome de um modelo, aparado: de 1 a TETO_NOME caracteres.
const TETO_NOME = 80;
// As entidades de um modelo (casas, registos e dados globais), no máximo.
const TETO_ENTIDADES = 5000;
// Acima disto (em caracteres do JSON) os dados de um modelo gravado vão para o R2.
const TETO_NA_BASE = 256 * 1024;
// Quanto tempo um modelo removido espera pelo Anular antes de se apagar de vez.
const GUARDA_REMOVIDO = 24 * 3600 * 1000;
// Substituições dos dados por conta, por janela de 15 minutos.
const TETO_USAR = 20;
// Modelos gravados por pessoa, por janela de 15 minutos.
const TETO_GRAVAR = 20;
// A confirmação que o pedido de substituir tem de trazer (a janela manda-a).
export const CONFIRMAR = 'substituir';
// A forma do id de um cenário do código (web/app/modelos-cenarios.js).
const ID_CENARIO = /^[a-z0-9][a-z0-9-]{0,47}$/;
// Os kinds dos registos de uma casa (as chaves r: do cloud/nucleo.js:exportEntities).
const KINDS_DA_CASA = ['contract', 'tx', 'rec', 'visit', 'tenant'];
// Os kinds dos dados globais de uma conta (as chaves u:).
const KINDS_DA_CONTA = ['tx', 'rec', 'tpl', 'group', 'tenant', 'settings', 'profile'];

/* O ambiente é um em que os modelos existem: o dev (ou os testes), nunca a
   produção — sem ENV_NAME, ou com o 'producao' que um wrangler local de
   produção pode ter.
   Recebe: env — o ambiente do worker.
   Devolve: true ou false. */
export function ambienteDeTeste(env) {
  return !!(env && env.ENV_NAME) && env.ENV_NAME !== 'producao';
}

/* O dono dos modelos de uma conta da app: a pessoa do Discord que pediu o
   /test (users.test_owner, o que o teste.js:rotaTeste escreve a partir do
   dono assinado), para os modelos sobreviverem a trocar de conta de teste e
   ao /test limpar; sem ela (uma conta normal do dev, ou de teste sem dono),
   a própria conta.
   Recebe: env — o ambiente do worker (D1); me — o utilizador com sessão.
   Devolve: promessa do texto ('discord:<id>' ou 'conta:<id>'). */
export async function donoDaConta(env, me) {
  const r = await env.DB.prepare('SELECT test_owner FROM users WHERE id = ?').bind(me.id).first();
  const d = r && r.test_owner ? String(r.test_owner) : '';
  return /^\d{1,20}$/.test(d) ? 'discord:' + d : 'conta:' + me.id;
}

/* O dono dos modelos no back office: a pessoa da equipa, pelo Discord — a
   mesma chave das contas de teste que ela pede no /test.
   Recebe: eu — a sessão de equipa ({discordId, …}).
   Devolve: o texto 'discord:<id>'. */
export function donoDaEquipa(eu) {
  return 'discord:' + String(eu && eu.discordId);
}

/* Rotas dos modelos de dados da app (/api/modelos…), só fora de produção.
   GET /api/modelos?base=a,b lista os da pessoa (e semeia os de base que
   faltam); POST /api/modelos {nome} grava a conta como modelo novo; PUT
   /api/modelos/ordem {ids} guarda a ordem personalizada; PATCH
   /api/modelos/:id {nome} renomeia; DELETE /api/modelos/:id remove (brando,
   só os que não são de base); POST …/repor desfaz a remoção; POST …/usar
   {confirmar, entidades?} substitui os dados desta conta de teste pelos do
   modelo.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   ctx, url, method, seg e o utilizador em c.me).
   Devolve: a Response, ou nada (undefined) quando o caminho não é dos modelos. */
export async function rotasModelos(c) {
  if (c.seg[1] !== 'modelos') return;
  if (!ambienteDeTeste(c.env)) return err(404, 'Rota desconhecida.');
  const dono = await donoDaConta(c.env, c.me);
  return tratar(c, { dono, conta: c.me });
}

/* As mesmas rotas para o back office do dev (/api/equipa/modelos…), com a
   pessoa da equipa no lugar da conta: lista, renomeia, ordena e remove os
   modelos dela; gravar e usar pedem uma conta, e aqui não há (403).
   Recebe: c — o contexto do back office ({env, request, url, method, path,
   eu}, com eu a sessão de equipa).
   Devolve: a Response, ou nada (undefined) quando o caminho não é dos modelos. */
export async function rotasModelosDaEquipa(c) {
  const path = c.path;
  if (path !== '/api/equipa/modelos' && !path.startsWith('/api/equipa/modelos/')) return;
  if (!ambienteDeTeste(c.env)) return err(404, 'Rota desconhecida.');
  const seg = ['api', 'modelos'].concat(path.slice('/api/equipa/modelos'.length).split('/').filter(Boolean));
  return tratar(Object.assign({}, c, { seg }), { dono: donoDaEquipa(c.eu), conta: null });
}

/* O encaminhador das rotas dos modelos, comum à app e ao back office.
   Recebe: c — o contexto (env, request, url, method, seg); quem — {dono,
   conta: o utilizador da app, ou null no back office}.
   Devolve: promessa da Response. */
async function tratar(c, quem) {
  const { env, request, method, seg } = c;
  if (seg.length === 2) {
    if (method === 'GET') return listar(env, quem.dono, baseDoPedido(c.url));
    if (method === 'POST') return gravarConta(env, request, quem);
    return err(404, 'Rota desconhecida.');
  }
  if (seg.length === 3 && seg[2] === 'ordem' && method === 'PUT') return reordenar(env, request, quem.dono);
  const id = seg[2];
  if (badId(id) || seg.length > 4) return naoExiste();
  if (seg.length === 3 && method === 'PATCH') return renomear(env, request, quem.dono, id);
  if (seg.length === 3 && method === 'DELETE') return remover(env, quem.dono, id);
  if (seg[3] === 'repor' && method === 'POST') return repor(env, quem.dono, id);
  if (seg[3] === 'usar' && method === 'POST') return usarModelo(c, quem, id);
  return err(404, 'Rota desconhecida.');
}

/* A resposta ao modelo que não existe, que é de outra pessoa ou que foi
   removido — os três respondem igual.
   Recebe: nada.
   Devolve: a Response 404 «Modelo não encontrado.». */
function naoExiste() {
  return err(404, 'Modelo não encontrado.');
}

/* Os ids dos cenários de base que o cliente conhece (o ?base=a,b do GET):
   os que têm a forma de um id de cenário, sem repetidos, até TETO_BASE.
   Recebe: url — o URL do pedido (pode faltar).
   Devolve: a lista dos ids (vazia sem o parâmetro). */
export function baseDoPedido(url) {
  const v = url && url.searchParams ? url.searchParams.get('base') || '' : '';
  const out = [];
  v.split(',').map((s) => s.trim()).forEach((s) => {
    if (ID_CENARIO.test(s) && !out.includes(s) && out.length < TETO_BASE) out.push(s);
  });
  return out;
}

/* Um modelo vivo da pessoa, como está na base.
   Recebe: env — o ambiente do worker; dono — a chave da pessoa; id — o do modelo.
   Devolve: promessa da linha, ou null. */
async function umModelo(env, dono, id) {
  return env.DB.prepare('SELECT * FROM qa_modelos WHERE id = ? AND dono = ? AND removido_em IS NULL').bind(String(id), dono).first();
}

/* Um modelo como o cliente o lê: sem os dados (que só o usar lê) e com o
   resumo como objeto.
   Recebe: r — a linha de qa_modelos.
   Devolve: {id, tipo, cenario, nome, ordem, origem, ticket, criadoEm, resumo}. */
export function modeloParaFora(r) {
  let resumo = null;
  try { resumo = r.resumo ? JSON.parse(r.resumo) : null; } catch (e) { resumo = null; }
  return {
    id: r.id, tipo: r.tipo, cenario: r.cenario || null, nome: r.nome || null, ordem: Number(r.ordem) || 0,
    origem: r.origem, ticket: r.ticket || null, criadoEm: Number(r.criado_em) || 0, resumo,
  };
}

/* Apaga de vez os modelos desta pessoa removidos há mais de 24 h (e os dados
   deles no R2), de passagem pela lista. Uma falha não trava a lista.
   Recebe: env — o ambiente do worker (D1 e R2); dono — a chave da pessoa.
   Devolve: promessa de nada. */
async function limparRemovidos(env, dono) {
  try {
    const limite = now() - GUARDA_REMOVIDO;
    const velhos = (await env.DB.prepare('SELECT id, dados_r2 FROM qa_modelos WHERE dono = ? AND removido_em IS NOT NULL AND removido_em < ?')
      .bind(dono, limite).all()).results || [];
    if (!velhos.length) return;
    for (const v of velhos) {
      if (v.dados_r2 && env.FILES) { try { await env.FILES.delete(v.dados_r2); } catch (e) { /* fica órfão no R2, sem dano */ } }
    }
    await env.DB.prepare('DELETE FROM qa_modelos WHERE dono = ? AND removido_em IS NOT NULL AND removido_em < ?').bind(dono, limite).run();
  } catch (e) { console.error('modelos: limpar removidos', e && e.message); }
}

/* Semeia os modelos de base que esta pessoa ainda não tem: um por cenário
   conhecido do cliente, no fim da ordem, pela ordem da lista. Um cenário que
   ela já tem por um ticket (scripts/modelos.mjs) não nasce outra vez. O índice único
   (dono, cenario) dos de base faz um segundo GET não duplicar nada.
   Recebe: env — o ambiente do worker; dono — a chave da pessoa; base — os
   ids dos cenários (baseDoPedido).
   Devolve: promessa de nada. */
async function semearBase(env, dono, base) {
  if (!base.length) return;
  const tem = (await env.DB.prepare("SELECT cenario FROM qa_modelos WHERE dono = ? AND origem IN ('base', 'ticket') AND removido_em IS NULL").bind(dono).all()).results || [];
  const ja = new Set(tem.map((r) => r.cenario));
  const faltam = base.filter((b) => !ja.has(b));
  if (!faltam.length) return;
  const vivos = await env.DB.prepare('SELECT COUNT(*) AS n, MAX(ordem) AS m FROM qa_modelos WHERE dono = ? AND removido_em IS NULL').bind(dono).first();
  let ordem = vivos && vivos.n ? Number(vivos.m) + 1 : 0;
  const t = now();
  const stmts = faltam.map((cenario, i) => env.DB.prepare(
    `INSERT OR IGNORE INTO qa_modelos (id, dono, nome, ordem, tipo, cenario, origem, criado_em, atualizado_em)
     VALUES (?, ?, NULL, ?, 'cenario', ?, 'base', ?, ?)`
  ).bind(crypto.randomUUID(), dono, ordem++, cenario, t + i, t + i));
  await env.DB.batch(stmts);
}

/* GET /api/modelos: os modelos vivos da pessoa, pela ordem personalizada (e,
   no empate, do mais antigo), depois de semear os de base que faltam e de
   apagar os removidos há mais de 24 h.
   Recebe: env — o ambiente do worker; dono — a chave da pessoa; base — os
   ids dos cenários de base que o cliente conhece.
   Devolve: promessa da Response {modelos: [modeloParaFora…]}. */
async function listar(env, dono, base) {
  await limparRemovidos(env, dono);
  await semearBase(env, dono, base);
  const r = (await env.DB.prepare('SELECT * FROM qa_modelos WHERE dono = ? AND removido_em IS NULL ORDER BY ordem, criado_em, id')
    .bind(dono).all()).results || [];
  return json({ modelos: r.map(modeloParaFora) });
}

/* O nome aparado de um pedido: de 1 a TETO_NOME caracteres, sem as mudanças
   de linha (um nome é uma linha).
   Recebe: v — o que veio no corpo.
   Devolve: o texto, ou null quando não serve. */
export function nomeValido(v) {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t && t.length <= TETO_NOME ? t : null;
}

/* PATCH /api/modelos/:id {nome}: muda o nome de um modelo da pessoa (também
   de um de base: muda só o dela).
   Recebe: env; request; dono — a chave da pessoa; id — o do modelo.
   Devolve: promessa da Response {modelo} — 400 com o nome vazio ou comprido
   de mais, 404 sem o modelo. */
async function renomear(env, request, dono, id) {
  const b = await body(request);
  const nome = nomeValido(b && b.nome);
  if (!nome) return err(400, 'O nome tem de ter entre 1 e ' + TETO_NOME + ' caracteres.');
  const r = await umModelo(env, dono, id);
  if (!r) return naoExiste();
  await env.DB.prepare('UPDATE qa_modelos SET nome = ?, atualizado_em = ? WHERE id = ? AND dono = ?').bind(nome, now(), r.id, dono).run();
  return json({ modelo: modeloParaFora(Object.assign({}, r, { nome })) });
}

/* PUT /api/modelos/ordem {ids}: a ordem personalizada (o arrasto). Os ids
   que são da pessoa ficam com a posição deles na lista; os que não vierem
   seguem-nos, pela ordem que tinham; os de outra pessoa não se tocam.
   Recebe: env; request; dono — a chave da pessoa.
   Devolve: promessa da Response {modelos} — a lista nova; 400 sem uma lista
   de ids válida. */
async function reordenar(env, request, dono) {
  const b = await body(request);
  const ids = b && Array.isArray(b.ids) ? b.ids : null;
  if (!ids || ids.length > TETO_MODELOS || ids.some((x) => badId(x))) return err(400, 'Envia { ids: [...] } com os ids dos modelos, pela ordem nova.');
  const vivos = (await env.DB.prepare('SELECT id FROM qa_modelos WHERE dono = ? AND removido_em IS NULL ORDER BY ordem, criado_em, id').bind(dono).all()).results || [];
  const meus = new Set(vivos.map((r) => r.id));
  const primeiro = [];
  ids.map(String).forEach((x) => { if (meus.has(x) && !primeiro.includes(x)) primeiro.push(x); });
  const ordem = primeiro.concat(vivos.map((r) => r.id).filter((x) => !primeiro.includes(x)));
  const t = now();
  if (ordem.length) {
    await env.DB.batch(ordem.map((x, i) => env.DB.prepare('UPDATE qa_modelos SET ordem = ?, atualizado_em = ? WHERE id = ? AND dono = ?').bind(i, t, x, dono)));
  }
  return listar(env, dono, []);
}

/* DELETE /api/modelos/:id: remove um modelo da pessoa, brando (removido_em),
   para o Anular. Os de base não se removem: são o ponto de partida de toda a
   gente, e voltavam a nascer no GET seguinte.
   Recebe: env; dono — a chave da pessoa; id — o do modelo.
   Devolve: promessa da Response {ok: true}; 403 num de base; 404 sem ele. */
async function remover(env, dono, id) {
  const r = await umModelo(env, dono, id);
  if (!r) return naoExiste();
  if (r.origem === 'base') return err(403, 'Os modelos de base não se removem: só os que gravaste ou que foram criados para ti.');
  await env.DB.prepare('UPDATE qa_modelos SET removido_em = ? WHERE id = ? AND dono = ?').bind(now(), r.id, dono).run();
  return json({ ok: true });
}

/* POST /api/modelos/:id/repor: o Anular do remover, dentro das 24 h.
   Recebe: env; dono — a chave da pessoa; id — o do modelo.
   Devolve: promessa da Response {modelo}; 404 se não estava removido (ou
   já se apagou de vez). */
async function repor(env, dono, id) {
  const r = await env.DB.prepare('SELECT * FROM qa_modelos WHERE id = ? AND dono = ? AND removido_em IS NOT NULL AND removido_em >= ?')
    .bind(String(id), dono, now() - GUARDA_REMOVIDO).first();
  if (!r) return naoExiste();
  await env.DB.prepare('UPDATE qa_modelos SET removido_em = NULL WHERE id = ? AND dono = ?').bind(r.id, dono).run();
  return json({ modelo: modeloParaFora(r) });
}

/* ------------------------------------------------ as entidades de uma conta */

/* As entidades que uma conta tem de seu, na forma do /api/sync: as casas de
   que é dona (vivas), os registos delas (vivos) e os dados globais (vivos),
   menos o perfil — a identidade fica com a conta, não vai num modelo — e
   menos os kinds que a app já não escreve (o 'owner' do modelo antigo): só
   vai o que o usar aceita (conferirEntidades). As casas que outras contas
   partilham com ela não são dela e não vão.
   Recebe: env — o ambiente do worker (D1); uid — o id da conta.
   Devolve: promessa da lista [{scope, houseId?, kind?, id?, data}]. */
export async function entidadesDaConta(env, uid) {
  const [casas, registos, globais] = await Promise.all([
    env.DB.prepare('SELECT id, data FROM houses WHERE owner_id = ? AND deleted = 0 ORDER BY id').bind(uid).all(),
    env.DB.prepare(`SELECT house_id, kind, id, data FROM records WHERE deleted = 0
       AND house_id IN (SELECT id FROM houses WHERE owner_id = ? AND deleted = 0) ORDER BY house_id, kind, id`).bind(uid).all(),
    env.DB.prepare("SELECT kind, id, data FROM user_records WHERE user_id = ? AND deleted = 0 AND kind <> 'profile' ORDER BY kind, id").bind(uid).all(),
  ]);
  const ler = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
  const out = [];
  (casas.results || []).forEach((h) => { const d = ler(h.data); if (d) out.push({ scope: 'house', houseId: h.id, data: d }); });
  (registos.results || []).forEach((r) => { const d = ler(r.data); if (d && KINDS_DA_CASA.indexOf(r.kind) > -1) out.push({ scope: 'record', houseId: r.house_id, kind: r.kind, id: r.id, data: d }); });
  (globais.results || []).forEach((r) => { const d = ler(r.data); if (d && KINDS_DA_CONTA.indexOf(r.kind) > -1) out.push({ scope: 'user', kind: r.kind, id: r.id, data: d }); });
  return out;
}

/* As contagens de um modelo, para a lista dizer o que ele tem.
   Recebe: entidades — a lista na forma do /api/sync.
   Devolve: {imoveis, contratos, pessoas, movimentos, planeados}. */
export function resumoDe(entidades) {
  const n = { imoveis: 0, contratos: 0, pessoas: 0, movimentos: 0, planeados: 0 };
  (entidades || []).forEach((e) => {
    if (e.scope === 'house') n.imoveis++;
    else if (e.kind === 'contract') n.contratos++;
    else if (e.kind === 'tenant') n.pessoas++;
    else if (e.kind === 'tx') n.movimentos++;
    else if (e.kind === 'rec') n.planeados++;
  });
  return n;
}

/* Confere e normaliza as entidades de um modelo, como o /api/sync confere
   cada operação (lib/escritas.js:validarOp): o âmbito, os ids, o objeto (sem
   as chaves de trabalho, cleanData) e o tamanho (tooBig); os registos têm de
   ser de uma casa que vem no modelo; os kinds são os que a app escreve; uma
   chave repetida, ou mais de TETO_ENTIDADES, recusam o modelo inteiro.
   Recebe: lista — o que veio (do corpo do pedido, ou dos dados gravados).
   Devolve: {entidades} normalizadas (objetos novos), ou {erro} com a frase. */
export function conferirEntidades(lista) {
  if (!Array.isArray(lista)) return { erro: 'As entidades do modelo têm de vir numa lista.' };
  if (lista.length > TETO_ENTIDADES) return { erro: 'O modelo tem mais de ' + TETO_ENTIDADES + ' entidades.' };
  const casas = new Set(), vistas = new Set(), out = [];
  for (const e of lista) {
    if (e && e.scope === 'house' && !badId(e.houseId)) casas.add(String(e.houseId));
  }
  for (const e of lista) {
    if (!e || typeof e !== 'object') return { erro: 'Uma entidade do modelo não é um objeto.' };
    let o;
    if (e.scope === 'house') {
      if (badId(e.houseId)) return { erro: 'Uma casa do modelo tem um id inválido.' };
      o = { scope: 'house', houseId: String(e.houseId) };
    } else if (e.scope === 'record') {
      if (badId(e.houseId) || badId(e.id) || KINDS_DA_CASA.indexOf(e.kind) < 0) return { erro: 'Um registo do modelo tem um id ou um tipo inválido.' };
      if (!casas.has(String(e.houseId))) return { erro: 'Um registo do modelo é de uma casa que não vem nele.' };
      o = { scope: 'record', houseId: String(e.houseId), kind: e.kind, id: String(e.id) };
    } else if (e.scope === 'user') {
      if (badId(e.id) || KINDS_DA_CONTA.indexOf(e.kind) < 0) return { erro: 'Um dado da conta no modelo tem um id ou um tipo inválido.' };
      if ((e.kind === 'settings' || e.kind === 'profile') && e.id !== 'main') return { erro: 'As definições e o perfil têm o id main.' };
      o = { scope: 'user', kind: e.kind, id: String(e.id) };
    } else {
      return { erro: 'Uma entidade do modelo tem um âmbito desconhecido.' };
    }
    const chave = o.scope + ':' + (o.houseId || '') + ':' + (o.kind || '') + ':' + (o.id || '');
    if (vistas.has(chave)) return { erro: 'O modelo tem uma entidade repetida.' };
    vistas.add(chave);
    let data;
    try { data = JSON.parse(JSON.stringify(e.data)); } catch (x) { data = null; }
    data = cleanData(data, o.scope === 'house' ? o.houseId : o.id);
    if (!data) return { erro: 'Uma entidade do modelo não tem os dados num objeto.' };
    if (tooBig(data)) return { erro: 'Uma entidade do modelo é grande de mais.' };
    o.data = data;
    out.push(o);
  }
  return { entidades: out };
}

/* As entidades com ids novos para as casas (o id de uma casa é único em toda
   a base: o do modelo já pode ser de outra conta, ou desta antes de a
   substituir) e, num modelo gravado de outra conta, essa conta trocada pela
   de agora (os donos, o «pago por», as divisões referem-na). A troca é do id
   entre aspas, em todo o JSON de cada entidade — os ids são uuid ou ids
   curtos da app, que não aparecem por acaso dentro de outro texto.
   Recebe: entidades — as de conferirEntidades; contaAntes — o id da conta
   de onde o modelo foi gravado (ou null); contaAgora — o id da conta que o
   recebe; novoId (opcional) — a fábrica dos ids (crypto.randomUUID).
   Devolve: uma lista nova, com os ids trocados. */
export function remapear(entidades, contaAntes, contaAgora, novoId) {
  const fabrica = novoId || (() => crypto.randomUUID());
  const troca = new Map();
  entidades.forEach((e) => { if (e.scope === 'house' && !troca.has(e.houseId)) troca.set(e.houseId, fabrica()); });
  if (contaAntes && contaAgora && contaAntes !== contaAgora) troca.set(String(contaAntes), String(contaAgora));
  if (!troca.size) return entidades.map((e) => Object.assign({}, e));
  const re = new RegExp('"(' + [...troca.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|') + ')"', 'g');
  return entidades.map((e) => {
    const o = Object.assign({}, e);
    if (o.houseId && troca.has(o.houseId)) o.houseId = troca.get(o.houseId);
    o.data = JSON.parse(JSON.stringify(e.data).replace(re, (m, id) => '"' + troca.get(id) + '"'));
    if (o.scope === 'house') o.data.id = o.houseId;
    return o;
  });
}

/* As instruções que trocam os dados de uma conta pelos de um modelo, para um
   lote só da D1 (uma transação). Sai o que é dela: as casas de que é dona
   (vivas e apagadas) com os registos, as partilhas, as propostas de quotas,
   os colaboradores, os grupos, as saídas, as transferências e os anexos delas,
   os anexos soltos, e os dados globais menos o perfil (e menos as definições,
   quando o modelo não as traz). Entra o modelo: cada casa pelas regras de uma
   casa nova (acesso.js:preserveOwnership, com esta conta como dona), cada
   registo com esta conta como autora, e os dados globais; o perfil, quando
   vem, por cima do que a conta tem. As casas de outras contas partilhadas
   com ela ficam.
   Recebe: env — o ambiente do worker (D1); uid — o id da conta; entidades —
   as de remapear.
   Devolve: a lista das instruções preparadas. */
export function passosDeSubstituir(env, uid, entidades) {
  const H = 'SELECT id FROM houses WHERE owner_id = ?1';
  const t = now();
  const comDefinicoes = entidades.some((e) => e.scope === 'user' && e.kind === 'settings');
  const stmts = [
    env.DB.prepare(`DELETE FROM records WHERE house_id IN (${H})`).bind(uid),
    env.DB.prepare(`DELETE FROM shares WHERE house_id IN (${H})`).bind(uid),
    env.DB.prepare(`DELETE FROM share_proposals WHERE house_id IN (${H})`).bind(uid),
    env.DB.prepare(`DELETE FROM collaborator_houses WHERE house_id IN (${H})`).bind(uid),
    env.DB.prepare(`DELETE FROM shared_group_houses WHERE house_id IN (${H})`).bind(uid),
    env.DB.prepare(`DELETE FROM house_exits WHERE house_id IN (${H})`).bind(uid),
    env.DB.prepare(`DELETE FROM house_transfers WHERE house_id IN (${H})`).bind(uid),
    env.DB.prepare(`DELETE FROM files WHERE house_id IN (${H}) OR (owner_id = ?1 AND house_id IS NULL)`).bind(uid),
    env.DB.prepare('DELETE FROM houses WHERE owner_id = ?1').bind(uid),
    env.DB.prepare(`DELETE FROM user_records WHERE user_id = ?1 AND kind <> 'profile'${comDefinicoes ? '' : " AND kind <> 'settings'"}`).bind(uid),
  ];
  entidades.forEach((e) => {
    const texto = (d) => JSON.stringify(d);
    if (e.scope === 'house') {
      const dados = preserveOwnership('', Object.assign({}, e.data), uid);
      stmts.push(env.DB.prepare('INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)').bind(e.houseId, uid, texto(dados), t));
    } else if (e.scope === 'record') {
      stmts.push(env.DB.prepare(
        'INSERT INTO records (house_id, kind, id, data, updated_at, deleted, author, created_by) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
      ).bind(e.houseId, e.kind, e.id, texto(e.data), t, uid, uid));
    } else {
      stmts.push(env.DB.prepare(
        `INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT (user_id, kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`
      ).bind(uid, e.kind, e.id, texto(e.data), t));
    }
  });
  return stmts;
}

/* Os dados gravados de um modelo do tipo 'dados': da base, ou do R2 quando
   eram grandes.
   Recebe: env — o ambiente do worker (R2 em env.FILES); r — a linha de qa_modelos.
   Devolve: promessa de {conta, entidades}, ou null quando não se leem. */
async function dadosDoModelo(env, r) {
  let texto = r.dados;
  if (!texto && r.dados_r2 && env.FILES) {
    const o = await env.FILES.get(r.dados_r2);
    texto = o && o.body ? await new Response(o.body).text() : null;
  }
  try {
    const d = JSON.parse(texto || 'null');
    return d && Array.isArray(d.entidades) ? d : null;
  } catch (e) { return null; }
}

/* POST /api/modelos: grava os dados da conta como um modelo novo da pessoa
   (tipo 'dados'), com as datas tal como estão — os dados lidos da base
   (entidadesDaConta), por isso o cliente envia antes o que tiver por enviar.
   Os anexos (fotos, documentos) não vão: são ficheiros da conta.
   Recebe: env; request — o corpo traz {nome}; quem — {dono, conta}.
   Devolve: promessa da Response {modelo} (201); 403 sem conta (o back
   office); 400 com o nome que não serve; 409 com TETO_MODELOS; 429 com
   pressa de mais. */
async function gravarConta(env, request, quem) {
  if (!quem.conta) return err(403, 'No back office não há dados de uma conta para gravar: grava o modelo na app, na conta de teste.');
  const b = await body(request);
  const nome = nomeValido(b && b.nome);
  if (!nome) return err(400, 'O nome tem de ter entre 1 e ' + TETO_NOME + ' caracteres.');
  if (!(await rateLimit(env, 'mdl-gravar:' + quem.dono, TETO_GRAVAR, 900))) {
    return err(429, 'Gravaste muitos modelos seguidos. Espera um pouco.');
  }
  const vivos = await env.DB.prepare('SELECT COUNT(*) AS n, MAX(ordem) AS m FROM qa_modelos WHERE dono = ? AND removido_em IS NULL').bind(quem.dono).first();
  if (vivos && vivos.n >= TETO_MODELOS) return err(409, 'Já tens ' + TETO_MODELOS + ' modelos. Remove algum antes de gravar outro.');
  const entidades = await entidadesDaConta(env, quem.conta.id);
  const texto = JSON.stringify({ conta: quem.conta.id, entidades });
  const id = crypto.randomUUID(), t = now();
  let dados = texto, chave = null;
  if (texto.length > TETO_NA_BASE) {
    if (!env.FILES) return err(413, 'Esta conta tem dados de mais para um modelo.');
    chave = 'modelos/' + id;
    await env.FILES.put(chave, new TextEncoder().encode(texto), { httpMetadata: { contentType: 'application/json' } });
    dados = null;
  }
  const ordem = vivos && vivos.n ? Number(vivos.m) + 1 : 0;
  const resumo = resumoDe(entidades);
  await env.DB.prepare(
    `INSERT INTO qa_modelos (id, dono, nome, ordem, tipo, dados, dados_r2, resumo, origem, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, 'dados', ?, ?, ?, 'pessoa', ?, ?)`
  ).bind(id, quem.dono, nome, ordem, dados, chave, JSON.stringify(resumo), t, t).run();
  const r = await env.DB.prepare('SELECT * FROM qa_modelos WHERE id = ?').bind(id).first();
  return json({ modelo: modeloParaFora(r) }, 201);
}

/* POST /api/modelos/:id/usar {confirmar: 'substituir', entidades?}: troca os
   dados desta conta de teste pelos do modelo, numa transação só
   (passosDeSubstituir). Fica a mesma conta e a mesma sessão; o cliente lê o
   estado a seguir. Num modelo de cenário, as entidades vêm do cliente, que
   construiu o cenário com as datas de hoje (o código vive em
   web/app/modelos-cenarios.js); num modelo gravado, vêm da base. Em ambos,
   as casas ganham ids novos (remapear).
   As portas, por esta ordem: uma conta (403 no back office), uma conta de
   teste (403 numa conta normal, mesmo no dev), a confirmação (400 sem ela),
   o travão (429), o modelo da pessoa (404), e os dados que se conferem (400).
   Recebe: c — o contexto (env, request, ctx); quem — {dono, conta}; id — o do modelo.
   Devolve: promessa da Response {ok: true, resumo}. */
async function usarModelo(c, quem, id) {
  const { env, request } = c;
  if (!quem.conta) return err(403, 'No back office não há conta para carregar o modelo: usa-o na app, numa conta de teste.');
  if (!eContaDeTeste(quem.conta.email)) {
    return json({ error: 'Só se substituem os dados de uma conta de teste (as do /test). Esta conta é normal, e os dados dela ficam.', erro: 'so_contas_de_teste' }, 403);
  }
  const b = await body(request);
  if (!b || b.confirmar !== CONFIRMAR) return err(400, 'Falta a confirmação: substituir os dados apaga os que a conta tem.');
  if (!(await rateLimit(env, 'mdl-usar:' + quem.conta.id, TETO_USAR, 900))) {
    return err(429, 'Trocaste os dados muitas vezes seguidas. Espera um pouco.');
  }
  const r = await umModelo(env, quem.dono, id);
  if (!r) return naoExiste();
  let lista, contaAntes = null;
  if (r.tipo === 'cenario') {
    lista = b.entidades;
  } else {
    const d = await dadosDoModelo(env, r);
    if (!d) return err(410, 'Os dados deste modelo já não se leem. Remove-o e grava-o de novo.');
    lista = d.entidades;
    contaAntes = d.conta || null;
  }
  const v = conferirEntidades(lista);
  if (v.erro) return err(400, v.erro);
  const entidades = remapear(v.entidades, contaAntes, quem.conta.id);
  const uid = quem.conta.id;
  // os anexos que saem com as casas: o R2 limpa-se depois de o lote pegar
  const anexos = ((await env.DB.prepare(
    'SELECT id FROM files WHERE house_id IN (SELECT id FROM houses WHERE owner_id = ?1) OR (owner_id = ?1 AND house_id IS NULL)'
  ).bind(uid).all()).results || []).map((x) => x.id);
  await env.DB.batch(passosDeSubstituir(env, uid, entidades));
  if (anexos.length && env.FILES) {
    const apagar = (async () => {
      for (const a of anexos) {
        try { await env.FILES.delete(a); await env.FILES.delete('tn/' + a); } catch (e) { /* um órfão no R2 do dev, sem dano */ }
      }
    })();
    if (c.ctx && typeof c.ctx.waitUntil === 'function') c.ctx.waitUntil(apagar); else await apagar;
  }
  return json({ ok: true, resumo: resumoDe(entidades) });
}
