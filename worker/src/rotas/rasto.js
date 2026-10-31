// O rasto das pessoas na API da app (com sessão): a recolha dos toques da
// app e a escolha do consentimento. A lógica partilhada com a montra e com o
// back office vive em lib/rasto.js.
import { json, err, body } from '../lib/http.js';
import {
  escolhaDaConta, aplicarEscolha, sincronizarEscolha, lerLote, pidDaConta, recolher, semConteudo,
} from '../lib/rasto.js';

/* As rotas /api/rasto*:
   · POST /api/rasto — um lote da app (sendBeacon). Só com a conta em sim;
     origem 'app', pid da conta (criado à primeira). 204 sempre, também
     quando recusa: o cliente nunca reage.
   · GET /api/rasto/escolha — { escolha }. A última escolha ganha: a do
     aparelho (o rd_escolha, com a hora) e a da conta comparam-se, e a mais
     recente passa para o outro lado (lib/rasto.js:sincronizarEscolha), com
     os cookies na resposta quando é o aparelho que muda.
   · POST /api/rasto/escolha { escolha } — guarda na conta e põe ou tira os
     cookies como o /consentimento; o não apaga logo o que se guardou.
   Recebe: c — o contexto do pedido montado pelo handleApi, já com `me`.
   Devolve: promessa da Response da rota, ou de null quando o caminho não é daqui. */
export async function rotasRasto(c) {
  const { env, request, url, path, method, me } = c;
  if (path === '/api/rasto' && method === 'POST') {
    try {
      const lote = await lerLote(request);
      if (lote && (await escolhaDaConta(env, me.id)).escolha === 'sim') {
        await recolher(env, lote, await pidDaConta(env, me.id, true), 'app');
      }
    } catch (e) {
      console.error('rasto: app', e && e.message);
    }
    return semConteudo();
  }

  if (path === '/api/rasto/escolha' && method === 'GET') {
    const { escolha, cookies } = await sincronizarEscolha(env, request, url.hostname, me.id);
    const r = json({ escolha });
    cookies.forEach((k) => r.headers.append('Set-Cookie', k));
    return r;
  }

  if (path === '/api/rasto/escolha' && method === 'POST') {
    const b = await body(request);
    const escolha = b && b.escolha;
    if (escolha !== 'sim' && escolha !== 'nao') return err(400, 'A escolha é «sim» ou «nao».');
    const cookies = await aplicarEscolha(env, request, url.hostname, escolha, me.id);
    const r = json({ escolha });
    cookies.forEach((k) => r.headers.append('Set-Cookie', k));
    return r;
  }

  return null;
}
