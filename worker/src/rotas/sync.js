// Sincronização em lote das alterações pendentes do cliente.
import { json, err, body } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { prepararEscritas, aplicarOp } from '../lib/escritas.js';

/* Rota do POST /api/sync: aplica as operações pendentes do cliente (put/del
   de casas, registos e dados globais) uma a uma, cada uma validada e escrita
   por aplicarOp (lib/escritas.js) — a mesma função das rotas REST de
   casas.js —, com os serviços desligados desta conta e o acesso a cada casa
   lidos uma vez por pedido (prepararEscritas). Uma falha não trava as
   seguintes: uma exceção numa operação é o 500 dessa operação.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   path, method e o utilizador em c.me).
   Devolve: a Response do POST /api/sync — JSON { results } com o resultado
   por operação, pela mesma ordem, ou o erro que couber; nada (undefined)
   noutros caminhos. */
export async function rotasSync(c) {
  const { env, request, path, method, me } = c;

  // Sincronização em lote: o cliente envia todas as alterações pendentes de
  // uma vez. Cada operação é validada individualmente; a resposta devolve o
  // resultado por operação, pela mesma ordem.
  if (path === '/api/sync' && method === 'POST') {
    const b = await body(request);
    const ops = Array.isArray(b && b.ops) ? b.ops : null;
    if (!ops) return err(400, 'Corpo inválido — envia { ops: [...] }.');
    if (ops.length > 200) return err(400, 'Máximo de 200 operações por pedido.');
    // travão à quota diária de escritas da base: uma conta não pode gastá-la
    // sozinha (as rotas REST de casas.js gastam o mesmo contador)
    if (!(await rateLimit(env, 'w:' + me.id, 60, 900))) {
      return err(429, 'Demasiadas gravações seguidas. Espera um pouco — os dados não se perdem.');
    }
    const escritas = await prepararEscritas(env, me);
    const results = [];
    for (const op of ops) {
      try {
        results.push(await aplicarOp(escritas, op));
      } catch (e) {
        console.error('sync op failed', e);
        results.push({ ok: false, status: 500 });
      }
    }
    return json({ results });
  }
}
