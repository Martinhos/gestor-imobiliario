/* Os planos, com dentes.
   ---------------------
   O campo users.plan existia e nada o lia na hora de decidir. Aqui vive a
   regra: o que cada plano deixa CRIAR. Nunca o que deixa ver — os termos
   prometem que nada do que existe é apagado ou fica inacessível, e o código
   tem de cumprir a promessa.

   O interruptor do modo de demonstração suspende os limites todos. Vive no
   KV e só o master lhe toca, pelo back office. Enquanto estiver ligado, a
   app comporta-se como sempre se comportou; desligá-lo é o momento em que
   os planos passam a valer. */

export const LIMITES = {
  free: { imoveis: 3, contratos: false, planeados: false },
  plus: { imoveis: 10, contratos: true, planeados: true },
  pro: { imoveis: Infinity, contratos: true, planeados: true },
};

const CHAVE = 'config:demo_fim';
let _cache = { t: 0, fim: null };

/* Desligar o demo não desliga nada no momento: marca a DATA em que os
   limites entram em vigor, 30 dias à frente por omissão. Até lá, tudo se
   comporta como sempre — mas a app passa a avisar toda a gente do que aí
   vem, e é esse aviso que os termos prometem. Voltar a ligar apaga a data.

   Uma leitura de KV por pedido chegava; com a cache nem isso. Sem KV ou sem
   data marcada, é demo: nunca se tranca clientes por um outage.

   Recebe: env — as variáveis de ambiente (o KV em SESSIONS).
   Devolve: promessa da data de fim em milissegundos de época, ou de null
   quando não há data marcada — e é demo. */
export async function fimDemo(env) {
  if (Date.now() - _cache.t < 60000) return _cache.fim;
  let fim = null;
  try {
    const raw = await env.SESSIONS.get(CHAVE);
    if (raw != null && isFinite(Number(raw))) fim = Number(raw);
  } catch (e) { /* KV em baixo: fica demo */ }
  _cache = { t: Date.now(), fim };
  return fim;
}

// Ainda estamos em demonstração? true enquanto não houver data de fim
// marcada, ou enquanto ela não chegar. É isto que suspende os limites.
// Recebe: env — as variáveis de ambiente (o KV em SESSIONS).
// Devolve: promessa de booleano — true enquanto for demonstração.
export async function modoDemo(env) {
  const fim = await fimDemo(env);
  return fim == null || Date.now() < fim;
}

/* Liga ou desliga o modo de demonstração. Ligar apaga a data marcada;
   desligar marca o fim para daqui a `dias` (30 por omissão) — só nessa data
   é que os limites passam a valer. Escreve no KV, atualiza a cache, e
   devolve a data marcada (ou null quando fica ligado).

   Recebe: env — as variáveis de ambiente (o KV em SESSIONS); ligado —
   booleano, true religa o demo; dias (opcional) — daqui a quantos dias acaba,
   30 por omissão.
   Devolve: promessa da data marcada em milissegundos de época, ou de null
   quando ficou ligado. */
export async function definirDemo(env, ligado, dias) {
  if (ligado) {
    await env.SESSIONS.delete(CHAVE);
    _cache = { t: Date.now(), fim: null };
    return null;
  }
  const fim = Date.now() + Math.max(0, Number(dias == null ? 30 : dias)) * 86400000;
  await env.SESSIONS.put(CHAVE, String(fim));
  _cache = { t: Date.now(), fim };
  return fim;
}

// exposto para os testes poderem limpar a cache entre casos
// Devolve: nada — só esvazia a cache.
export function esquecerCache() { _cache = { t: 0, fim: null }; }

/* O veredicto sobre criar mais um. `tipo`: 'imovel' | 'contract' | 'rec'.
   Devolve null quando pode, ou a frase que explica porquê não.
   Recebe: plan — o plano da conta ('free', 'plus' ou 'pro'; desconhecido vale
   free); tipo — 'imovel' | 'contract' | 'rec'; imoveisAtuais — quantos
   imóveis a conta já tem (número; só interessa aos imóveis).
   Devolve: null quando pode criar, ou a string com o porquê de não. */
export function podeCriar(plan, tipo, imoveisAtuais) {
  const l = LIMITES[plan] || LIMITES.free;
  if (tipo === 'imovel') {
    if (imoveisAtuais >= l.imoveis) {
      return 'O plano ' + (plan || 'free') + ' vai até ' + l.imoveis +
        ' imóveis. O que criaste fica neste aparelho até mudares de plano.';
    }
    return null;
  }
  if (tipo === 'contract' && !l.contratos) {
    return 'Os contratos fazem parte do plano Plus. O que escreveste fica neste aparelho.';
  }
  if (tipo === 'rec' && !l.planeados) {
    return 'Os movimentos planeados fazem parte do plano Plus. O que criaste fica neste aparelho.';
  }
  return null;
}
