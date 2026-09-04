/* Os endereços @rendorium.com, geridos do back office.
   ----------------------------------------------------
   Não há caixas de correio: um endereço é uma REGRA de reencaminhamento no
   Email Routing do Cloudflare — o que chega a nome@rendorium.com segue para
   um destino verificado (o Gmail de quem gere). Por isso um endereço não
   tem palavra-passe: não há onde entrar. Enviar é outra história, e já
   está resolvida — o Resend assina o domínio inteiro, e qualquer
   from@rendorium.com serve sem se criar nada aqui.

   Fala-se com a API do Cloudflare com um token próprio (CF_EMAIL_TOKEN,
   com Email Routing de zona em edição e Zone em leitura). Sem token, a
   secção explica o que falta em vez de fingir que funciona. */

const DOMINIO = 'rendorium.com';

/* Uma chamada à API do Cloudflare, autenticada com o CF_EMAIL_TOKEN. Devolve
   o corpo já como objeto quando o Cloudflare diz success; tudo o resto —
   HTTP falhado, resposta que não é JSON, success a false — vira um Error
   com a mensagem deles (ou o código HTTP, quando nem mensagem há).
   Recebe: env — as variáveis de ambiente (usa o CF_EMAIL_TOKEN); caminho — o
   caminho da API a seguir a /client/v4 (ex.: '/zones?name=…'); metodo
   (opcional) — o verbo HTTP, GET por omissão; corpo (opcional) — objeto a
   enviar como JSON.
   Devolve: promessa do corpo da resposta já como objeto, com success a true. */
async function cf(env, caminho, metodo, corpo) {
  const r = await fetch('https://api.cloudflare.com/client/v4' + caminho, {
    method: metodo || 'GET',
    headers: {
      Authorization: 'Bearer ' + env.CF_EMAIL_TOKEN,
      'Content-Type': 'application/json',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const d = await r.json().catch(() => null);
  if (!d || !d.success) {
    const m = d && d.errors && d.errors[0] && d.errors[0].message;
    throw new Error('Cloudflare: ' + (m || 'HTTP ' + r.status));
  }
  return d;
}

/* A zona e a conta descobrem-se pelo nome e ficam 1h no KV: com o token
   chega, sem ids para configurar à mão.
   Recebe: env — as variáveis de ambiente (o KV em SESSIONS e o CF_EMAIL_TOKEN).
   Devolve: promessa de { id, conta } — os ids da zona e da conta no Cloudflare. */
async function zona(env) {
  const c = await env.SESSIONS.get('cf:zona:' + DOMINIO);
  if (c) return JSON.parse(c);
  const d = await cf(env, '/zones?name=' + DOMINIO);
  if (!d.result || !d.result.length) {
    throw new Error('A zona ' + DOMINIO + ' não está visível a este token — falta-lhe Zone:Read?');
  }
  const z = { id: d.result[0].id, conta: d.result[0].account.id };
  await env.SESSIONS.put('cf:zona:' + DOMINIO, JSON.stringify(z), { expirationTtl: 3600 });
  return z;
}

// aceita "faturas" ou "faturas@rendorium.com"; devolve o endereço completo
// ou null se o nome não presta
// Recebe: nome — o nome pedido, com ou sem o @rendorium.com.
// Devolve: string 'nome@rendorium.com' em minúsculas, ou null quando o nome não presta.
export function endereco(nome) {
  let n = String(nome || '').trim().toLowerCase();
  /* só o sufixo exato sai; um domínio com gralha ('@rendorium.com.pt',
     '@rendorium.como') é recusado, nunca "consertado" em silêncio para
     um nome que ninguém pediu */
  if (n.includes('@')) {
    if (!n.endsWith('@' + DOMINIO)) return null;
    n = n.slice(0, -('@' + DOMINIO).length);
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(n) || n.includes('..')) return null;
  return n + '@' + DOMINIO;
}

/* O estado do Email Routing num só objeto: os endereços @rendorium.com (as
   regras com matcher literal no "to" — email, destino e se está ativa) e os
   destinos da conta, cada um com a marca de verificado. Duas chamadas ao
   Cloudflare em paralelo, sem cache: é sempre o estado real.
   Recebe: env — as variáveis de ambiente (o CF_EMAIL_TOKEN e o KV da zona).
   Devolve: promessa de { enderecos, destinos } — cada endereço como
   { email, destino, ativo } e cada destino como { email, verificado }. */
export async function listarEnderecos(env) {
  const z = await zona(env);
  const [regras, destinos] = await Promise.all([
    cf(env, '/zones/' + z.id + '/email/routing/rules?per_page=50'),
    cf(env, '/accounts/' + z.conta + '/email/routing/addresses?per_page=50'),
  ]);
  const enderecos = (regras.result || [])
    .filter((r) => (r.matchers || []).some((m) => m.type === 'literal' && m.field === 'to'))
    .map((r) => ({
      email: String(r.matchers.find((m) => m.type === 'literal').value || '').toLowerCase(),
      destino: (((r.actions || []).find((a) => a.type === 'forward') || {}).value || []).join(', '),
      ativo: !!r.enabled,
    }));
  return {
    enderecos,
    destinos: (destinos.result || []).map((d) => ({ email: String(d.email || '').toLowerCase(), verificado: !!d.verified })),
  };
}

/* Criar um endereço: recusa colisões (a regra que já existe diz para onde
   manda), e só reencaminha para destinos verificados — um destino novo
   recebe o email de verificação do Cloudflare e o endereço cria-se à
   segunda, depois do clique.
   Recebe: env — as variáveis de ambiente; nome — o nome do endereço, com ou
   sem o @rendorium.com; destino (opcional) — o email para onde reencaminhar,
   por omissão o primeiro destino verificado.
   Devolve: promessa de { email, destino } do endereço criado; qualquer recusa
   sai como Error com a explicação. */
export async function criarEndereco(env, nome, destino) {
  const email = endereco(nome);
  if (!email) throw new Error('Nome inválido: letras e números, pontos ou hífens no meio (ex.: faturas).');
  const z = await zona(env);
  const atuais = await listarEnderecos(env);
  const jaExiste = atuais.enderecos.find((e) => e.email === email);
  if (jaExiste) {
    throw new Error('Já existe ' + email + ' — reencaminha para ' + (jaExiste.destino || 'lado nenhum') + '.');
  }

  const verificados = atuais.destinos.filter((d) => d.verificado);
  let para = String(destino || '').trim().toLowerCase();
  if (!para) {
    if (!verificados.length) {
      throw new Error('Não há nenhum destino verificado no Email Routing — verifica primeiro o teu email de destino no Cloudflare.');
    }
    para = verificados[0].email;
  } else if (!verificados.some((d) => d.email === para)) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) throw new Error('Esse destino não parece um email.');
    const pendente = atuais.destinos.find((d) => d.email === para);
    if (!pendente) await cf(env, '/accounts/' + z.conta + '/email/routing/addresses', 'POST', { email: para });
    throw new Error('O destino ' + para + ' ainda não está verificado — o Cloudflare enviou-lhe agora o email de verificação. Abre-o e cria o endereço outra vez.');
  }

  await cf(env, '/zones/' + z.id + '/email/routing/rules', 'POST', {
    name: 'equipa: ' + email,
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: email }],
    actions: [{ type: 'forward', value: [para] }],
  });
  return { email, destino: para };
}
