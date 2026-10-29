// Sincronização em lote das alterações pendentes do cliente.
import { json, err, body } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { prepararEscritas, aplicarOps } from '../lib/escritas.js';
import { registarDados, sessaoDoPedido } from '../lib/rasto.js';

/* O máximo de operações por pedido — o pedaço com que o cliente as manda
   (web/cloud/nucleo.js:LOTE_SYNC). As consultas à D1 de um pedido não
   crescem com ele (lib/escritas.js:aplicarOps): as escritas vão num
   db.batch, que a D1 conta como uma consulta no teto de 50 por invocação do
   plano gratuito (https://developers.cloudflare.com/d1/platform/limits/). O
   que o segura é o corpo (MAX_BODY, 2 MB) e o tempo de um lote. */
export const MAX_OPS = 200;

/* Rota do POST /api/sync: aplica as operações pendentes do cliente (put/del
   de casas, registos e dados globais) de uma vez, por aplicarOps
   (lib/escritas.js) — a mesma das rotas REST de casas.js, que lá passa por
   aplicarOp(...) com uma operação só —, com os serviços desligados desta
   conta lidos uma vez por pedido (prepararEscritas), e as casas, o acesso a
   elas e as linhas lidas de uma vez. Uma falha não trava as outras: uma
   exceção numa operação é o 500 dessa operação.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   path, method e o utilizador em c.me).
   Devolve: a Response do POST /api/sync — JSON { results } com o resultado
   por operação, pela mesma ordem (a forma de aplicarOps, sem a exceção), ou
   o erro que couber; nada (undefined) noutros caminhos. */
export async function rotasSync(c) {
  const { env, request, path, method, me } = c;

  // Sincronização em lote: o cliente envia todas as alterações pendentes de
  // uma vez. Cada operação é validada individualmente; a resposta devolve o
  // resultado por operação, pela mesma ordem.
  if (path === '/api/sync' && method === 'POST') {
    const b = await body(request);
    const ops = Array.isArray(b && b.ops) ? b.ops : null;
    if (!ops) return err(400, 'Corpo inválido — envia { ops: [...] }.');
    if (ops.length > MAX_OPS) return err(400, 'Máximo de ' + MAX_OPS + ' operações por pedido.');
    // travão à quota diária de escritas da base: uma conta não pode gastá-la
    // sozinha (as rotas REST de casas.js gastam o mesmo contador)
    if (!(await rateLimit(env, 'w:' + me.id, 60, 900))) {
      return err(429, 'Demasiadas gravações seguidas. Espera um pouco — os dados não se perdem.');
    }
    let results;
    try {
      results = await aplicarOps(await prepararEscritas(env, me), ops);
    } catch (e) {
      // a leitura do pedido falhou (a D1 em baixo): cada operação é o seu 500
      console.error('sync failed', e);
      results = ops.map(() => ({ ok: false, status: 500 }));
    }
    // o que o pedido mudou, por tipo, vai para o rasto de quem o consentiu
    // (lib/rasto.js:registarDados lê a escolha e não grava sem «sim») — com
    // os resultados inteiros, antes de a resposta os despir, e sem a atrasar
    const contagens = contarOps(results);
    if (Object.keys(contagens).length) {
      const feito = registarDados(env, me.id, contagens, sessaoDoPedido(request));
      if (c.ctx && typeof c.ctx.waitUntil === 'function') c.ctx.waitUntil(feito); else await feito;
    }
    return json({ results: results.map(paraOCliente) });
  }
}

/* O resultado de uma operação como o cliente o lê: a forma de sempre
   ({ ok }, { ok, gone }, { ok: false, status, error?, servico? }). O que a
   operação fez (acao, scope, kind, igual) fica do lado do servidor, para
   contarOps; a exceção de um 500 regista-se aqui e não sai.
   Recebe: r — um resultado de aplicarOps.
   Devolve: um objeto novo, sem os campos de dentro. */
function paraOCliente(r) {
  if (!r || typeof r !== 'object') return r;
  if (r._erro) console.error('sync op failed', r._erro);
  const resto = Object.assign({}, r);
  ['_erro', 'acao', 'scope', 'kind', 'igual'].forEach((k) => { delete resto[k]; });
  return resto;
}

/* A contagem das operações de um /api/sync que passaram, por kind e por
   ação, num sítio só — para o rasto (a rota passa-a ao
   lib/rasto.js:registarDados). Conta
   só o que mudou de facto: um resultado ok com acao (lib/escritas.js:
   aplicarOps); um «igual» (a fusão deixou-o como estava), um «gone» e as
   recusas ficam de fora. A casa conta com o kind 'house'; um registo e um
   dado global da conta com o kind deles (um movimento de uma casa e um
   avulso são os dois 'tx').
   Recebe: resultados — a lista de resultados de aplicarOps (a da rota,
   antes de paraOCliente: a resposta já não traz a acao); valores que não
   são objetos ignoram-se.
   Devolve: { kind: { acao: n } }, ex. { house: { criado: 1 }, tx: { criado:
   36 } } — vazio quando nada passou. */
export function contarOps(resultados) {
  const out = {};
  (Array.isArray(resultados) ? resultados : []).forEach((r) => {
    if (!r || !r.ok || !r.acao || r.igual) return;
    const k = String(r.kind || r.scope || '?');
    out[k] = out[k] || {};
    out[k][r.acao] = (out[k][r.acao] || 0) + 1;
  });
  return out;
}
