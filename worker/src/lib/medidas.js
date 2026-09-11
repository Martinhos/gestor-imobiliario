/* O que o worker mede sobre si próprio, e o batimento que dá para fora.

   Duas coisas que o resumo diário e o Discord não respondem: «esta
   assinatura de erro está a piorar desde a versão X?» e «que rota é que
   demora, ou falha, mais?». Vão para o Workers Analytics Engine — que guarda
   três meses e se consulta por SQL — como pontos pequenos e sem dados de
   pessoas: rota genérica, método, estado, duração; categoria e assinatura de
   um relato. Nunca um id de utilizador, nunca um token, nunca um nome.

   E o batimento: o alarme da casa é a ausência de linhas no op_log, mas quem
   deteta a ausência é o próprio cron. Se os triggers pararem, se a conta for
   suspensa, se um deploy publicar um worker que rebenta ao arrancar, ninguém
   é avisado — o mecanismo de aviso vive dentro da coisa que morreu. Um GET a
   um URL opaco, de fora, é a única peça que não pode ser feita de dentro. */

// A rota sem o que a torna única: ids, tokens e números viram marcadores.
// É o que se guarda — nunca o caminho tal e qual, que leva segredos.
// Recebe: caminho — o pathname do pedido.
// Devolve: o mesmo caminho com /:token, /:id e /:n no lugar dos valores.
export function rotaGenerica(caminho) {
  return String(caminho || '')
    .replace(/\/[0-9a-f]{32,}(?=\/|$)/gi, '/:token')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
    .slice(0, 96);
}

// Um ponto por pedido à API: método, rota genérica, estado e quanto demorou.
// Sem a ligação (fora de produção, ou em testes) não faz nada.
// Recebe: env — o ambiente (usa env.MEDIDAS); metodo — GET/POST/…; caminho —
// o pathname; estado — o código HTTP; ms — a duração em milissegundos.
// Devolve: nada — o ponto segue em fundo; um falhanço a escrever é engolido.
export function medirPedido(env, metodo, caminho, estado, ms) {
  const m = env && env.MEDIDAS;
  if (!m || typeof m.writeDataPoint !== 'function') return;
  const rota = rotaGenerica(caminho);
  try {
    m.writeDataPoint({
      blobs: ['pedido', String(metodo || ''), rota, String(estado || 0)],
      doubles: [Number(ms) || 0],
      indexes: [rota],
    });
  } catch (e) { /* medir nunca pode partir o pedido */ }
}

// Um ponto por relato de erro: a categoria e a assinatura, que já vem
// mascarada. É o que responde a «isto está a piorar?» sem abrir o Discord.
// Recebe: env — o ambiente (usa env.MEDIDAS); categoria — uma das
// CATEGORIAS; assinatura — o fingerprint do relato (categoria:mensagem).
// Devolve: nada — o ponto segue em fundo.
export function medirRelato(env, categoria, assinatura) {
  const m = env && env.MEDIDAS;
  if (!m || typeof m.writeDataPoint !== 'function') return;
  const chave = String(assinatura || '').slice(0, 96);
  try {
    m.writeDataPoint({
      blobs: ['relato', String(categoria || ''), String(assinatura || '').slice(0, 200)],
      doubles: [1],
      indexes: [chave],
    });
  } catch (e) { /* idem */ }
}

// O batimento para fora: um GET ao URL do heartbeat, se estiver configurado.
// Chama-se só depois de o trabalho ter corrido bem — um batimento que bate
// com o trabalho por fazer é o alarme a mentir.
// Recebe: url — o URL do heartbeat (um segredo), ou nada.
// Devolve: Promise com true se o serviço aceitou; false sem URL, sem rede,
// ou com resposta má (nunca rejeita).
export async function pulsar(url) {
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'GET' });
    return !!(r && r.ok);
  } catch (e) {
    return false;
  }
}
