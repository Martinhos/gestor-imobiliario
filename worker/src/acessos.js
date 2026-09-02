/* Acessos dados ou retirados a uma pessoa em concreto.
   ---------------------------------------------------
   O papel continua a ser a regra: é dele que vem quase tudo, e é o que se
   gere no Discord com cargos. Isto é a exceção — dar a alguém um comando que
   o papel não dá, ou tirar-lhe um que dá, sem ter de inventar um cargo novo
   para uma pessoa só.

   As exceções vivem no KV e são lidas em cada interação. São poucas por
   natureza: se um dia forem muitas, isso quer dizer que falta um cargo, não
   que falta espaço aqui. */

const VAZIO = { mais: [], menos: [] };

const chave = (discordId) => 'acesso:' + discordId;

export async function lerAcessos(env, discordId) {
  if (!discordId || !env.SESSIONS) return VAZIO;
  try {
    const raw = await env.SESSIONS.get(chave(discordId));
    if (!raw) return VAZIO;
    const o = JSON.parse(raw);
    return {
      mais: Array.isArray(o.mais) ? o.mais : [],
      menos: Array.isArray(o.menos) ? o.menos : [],
    };
  } catch (e) {
    return VAZIO;   // sem exceções legíveis, vale o papel
  }
}

export async function guardarAcessos(env, discordId, acessos) {
  const limpo = {
    mais: [...new Set(acessos.mais || [])],
    menos: [...new Set(acessos.menos || [])],
  };
  // sem exceções nenhumas, apaga-se a entrada em vez de guardar um objeto vazio
  if (!limpo.mais.length && !limpo.menos.length) {
    await env.SESSIONS.delete(chave(discordId));
    return VAZIO;
  }
  await env.SESSIONS.put(chave(discordId), JSON.stringify(limpo));
  return limpo;
}

/* De onde vem o acesso a um comando, para se poder mostrar e não só decidir.

   'papel'    vem do cargo — é o que se marca como (predefinido)
   'dado'     acrescentado a esta pessoa
   'retirado' tirado a esta pessoa
   'nao'      nem o papel dá nem foi acrescentado */
export function origemDoAcesso(pap, comando, acessos, regras) {
  const { PERMISSOES, PODEM_TUDO, SO_MASTER } = regras;
  const a = acessos || VAZIO;

  /* O master nunca perde acesso por exceção. Um engano a retirar-lhe o
     próprio /access trancava-o fora da única ferramenta que o desfazia. */
  if (pap === 'master') return 'papel';
  if (!pap) return 'nao';

  if (SO_MASTER.indexOf(comando) > -1) return 'nao';   // não se dá por exceção
  if (a.menos.indexOf(comando) > -1) return 'retirado';

  const peloPapel = PODEM_TUDO.indexOf(pap) > -1 || (PERMISSOES[comando] || []).indexOf(pap) > -1;
  if (peloPapel) return 'papel';
  return a.mais.indexOf(comando) > -1 ? 'dado' : 'nao';
}
