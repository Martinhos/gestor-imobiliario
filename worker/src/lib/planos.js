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

const CHAVE = 'config:demo';
let _cache = { t: 0, v: true };

/* Uma leitura de KV por pedido chegava; com a cache nem isso — 60 segundos
   de atraso a aplicar o interruptor não fazem diferença a ninguém. Sem KV
   ou sem valor guardado, é demo: nunca se tranca clientes por um outage. */
export async function modoDemo(env) {
  if (Date.now() - _cache.t < 60000) return _cache.v;
  let v = true;
  try {
    const raw = await env.SESSIONS.get(CHAVE);
    if (raw != null) v = raw === '1';
  } catch (e) { /* KV em baixo: fica demo */ }
  _cache = { t: Date.now(), v };
  return v;
}

export async function definirDemo(env, ligado) {
  await env.SESSIONS.put(CHAVE, ligado ? '1' : '0');
  _cache = { t: Date.now(), v: !!ligado };
}

// exposto para os testes poderem limpar a cache entre casos
export function esquecerCache() { _cache = { t: 0, v: true }; }

/* O veredicto sobre criar mais um. `tipo`: 'imovel' | 'contract' | 'rec'.
   Devolve null quando pode, ou a frase que explica porquê não. */
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
