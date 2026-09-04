/* O ambiente de teste, a um /test de distância.
   ---------------------------------------------
   O comando /test no Discord responde com uma ligação temporária para o
   ambiente de dev. Abri-la faz três coisas, por esta ordem: apaga as contas
   de teste anteriores (cada visita começa lavada), cria uma conta de teste
   nova, e entra com ela — com ou sem dados de exemplo.

   A ligação é um bilhete ASSINADO, não um estado: HMAC sobre a validade e
   as opções, com uma chave derivada do token do bot do Discord — o único
   segredo que os dois ambientes já partilham. Assim o worker de produção
   (que é quem responde ao Discord depois da promoção) consegue emitir
   ligações para o dev sem os dois falarem um com o outro.

   Nada disto existe em produção: sem ENV_NAME, a rota é um 404 e ponto —
   produção nunca cria contas de teste, venha a assinatura de onde vier. */

import { now, TERMS_VERSION } from './lib/http.js';
import { purgeAccount } from './lib/acesso.js';
import { newUserId, createSession, sessionCookie } from './auth.js';
import { auditar } from './lib/auditoria.js';

const DOMINIO_TESTE = '@teste.rendorium.com';
const VALIDADE_MIN = 10;

export const eContaDeTeste = (email) => String(email || '').endsWith(DOMINIO_TESTE);

/* A chave das ligações de teste. Com os bots de dev e produção separados,
   o token do bot deixou de ser partilhado — a TESTE_CHAVE (a mesma nos dois
   ambientes) é o que deixa o /test de qualquer servidor assinar ligações
   que o worker de dev aceita. Sem ela, vale o token do bot, como dantes.
   Recebe: env — o ambiente do worker, de onde sai a TESTE_CHAVE (ou, na
   falta dela, o token do bot).
   Devolve: promessa de uma CryptoKey HMAC-SHA256, só para assinar. */
async function chave(env) {
  return crypto.subtle.importKey('raw',
    new TextEncoder().encode('teste:' + (env.TESTE_CHAVE || env.DISCORD_BOT_TOKEN || 'sem-chave')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

// A assinatura HMAC-SHA256, em hexadecimal, dos campos de uma ligação de
// teste — na ordem fixa em que o rotaTeste os volta a verificar. Os campos
// vazios também contam: mudar qualquer um muda a assinatura.
// Recebe: env — o ambiente do worker (dá a chave); exp — a validade, em
// milissegundos de época como texto; dados — '1' com dados de exemplo, '0'
// sem; manter (opcional) — '1' para conta extra; quem (opcional) — o id do
// dev dono; limpar (opcional) — '1' para lavar as contas do dono; email
// (opcional) — o email do dev para o correio das contas de teste.
// Devolve: promessa da assinatura em hexadecimal (64 caracteres).
export async function assinarTeste(env, exp, dados, manter, quem, limpar, email) {
  const sig = await crypto.subtle.sign('HMAC', await chave(env),
    new TextEncoder().encode(exp + ':' + dados + ':' + (manter || '0') + ':' + (quem || '') +
      ':' + (limpar || '0') + ':' + (email || '')));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* A ligação completa, para o bot e para o back office. `base` é o worker de
   destino: o de dev aponta a si próprio; o de produção aponta ao dev. */
/* `manter` cria uma conta EXTRA sem apagar as existentes — é o que permite
   testar partilhas e ligações entre duas contas de teste ao mesmo tempo. */
/* As contas de teste são PERSISTENTES: por omissão a ligação retoma a conta
   mais recente do dono (os dados ficam de um dia para o outro); `manter`
   cria uma extra; `limpar` é a única coisa que apaga. O `email` do dev vai
   assinado dentro da ligação — quem a abre grava-o no KV do ambiente de
   teste, e é para lá que segue o correio das contas dele.
   Recebe: env — o ambiente do worker; base — o URL do worker de destino, sem
   barra final; comExemplo — verdadeiro para a conta nascer com dados de
   exemplo; manter (opcional) — verdadeiro para uma conta extra; quem
   (opcional) — o id do dev dono; limpar (opcional) — verdadeiro para apagar
   as contas do dono; email (opcional) — o email do dev (ignorado se não
   parecer um email).
   Devolve: promessa do URL de /t/entrar, assinado e válido 10 minutos. */
export async function ligacaoTeste(env, base, comExemplo, manter, quem, limpar, email) {
  const exp = String(now() + VALIDADE_MIN * 60000);
  const dados = comExemplo ? '1' : '0';
  const m = manter ? '1' : '0';
  const l = limpar ? '1' : '0';
  const q = String(quem || '').replace(/[^\w.-]/g, '').slice(0, 32);
  let e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) e = '';
  const sig = await assinarTeste(env, exp, dados, m, q, l, e);
  return base + '/t/entrar?exp=' + exp + '&dados=' + dados + '&m=' + m + '&l=' + l + '&q=' + q +
    (e ? '&e=' + encodeURIComponent(e) : '') + '&sig=' + sig;
}

// o correio das contas deste dev vai para aqui (gravado pela ligação)
export const chaveEmailDev = (quem) => 'teste:email:' + quem;

/* A conta de teste em si: email no subdomínio, palavra-passe impossível,
   termos aceites, e o dono (o dev que a pediu) gravado para o seletor.
   Recebe: env — o ambiente do worker (a base D1); quem (opcional) — o id do
   dev dono, para o seletor (fica null quando falta).
   Devolve: promessa de { id, email } da conta acabada de criar. */
async function criarContaDeTeste(env, quem) {
  const id = newUserId();
  const email = 'teste-' + id.toLowerCase() + DOMINIO_TESTE;
  // sem palavra-passe de todo (como as contas so-Google): o formulario de
  // entrada nunca lhe serve, e o "apagar conta" nao exige o que nao existe
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at, test_owner)
     VALUES (?, ?, 'Conta de teste', '', '', ?, ?, ?, ?)`
  ).bind(id, email, now(), TERMS_VERSION, now(), quem || null).run();
  return { id, email };
}

// Quem abre esta rota é uma pessoa num browser: os erros são uma página
// que se lê, não um JSON que se decifra.
// Recebe: status — o código HTTP da resposta; titulo — o título, no
// separador e na página; texto — a explicação por baixo (HTML simples).
// Devolve: uma Response HTML completa, sem cache.
function pagina(status, titulo, texto) {
  return new Response('<!doctype html><html lang="pt"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + titulo + '</title>' +
    '<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#12141b;color:#eef0f6;' +
    'font:16px/1.6 system-ui,sans-serif"><div style="max-width:420px;padding:28px;text-align:center">' +
    '<div style="font-size:38px;margin-bottom:10px">🧪</div>' +
    '<h1 style="font-size:19px;margin:0 0 8px">' + titulo + '</h1>' +
    '<p style="margin:0;color:#9aa3b8;font-size:14.5px">' + texto + '</p></div></body></html>', {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* A rota /t/entrar: valida a validade e a assinatura e, conforme as opções
   da ligação, limpa as contas do dono, retoma a mais recente ou cria uma
   nova — e entra com ela (302 com cookie de sessão). Os erros são páginas
   legíveis, porque quem abre isto é uma pessoa num browser. Fora do
   ambiente de teste é sempre 404, venha a assinatura de onde vier.
   Recebe: c — o contexto do pedido, com env e url (as opções vêm todas da
   query string da ligação).
   Devolve: promessa de uma Response — o 302 com cookie de sessão quando tudo
   bate certo, ou uma página de erro (400/403/404/410). */
export async function rotaTeste(c) {
  const { env, url } = c;
  // produção nunca cria contas de teste — nem com assinatura boa
  if (!env.ENV_NAME) return pagina(404, 'Não há ambiente de teste aqui', 'Isto é produção. O /test do Discord dá ligações para o ambiente de desenvolvimento.');

  const exp = url.searchParams.get('exp') || '';
  const dados = url.searchParams.get('dados') === '1' ? '1' : '0';
  const manter = url.searchParams.get('m') === '1' ? '1' : '0';
  const limpar = url.searchParams.get('l') === '1' ? '1' : '0';
  const quem = String(url.searchParams.get('q') || '').replace(/[^\w.-]/g, '').slice(0, 32);
  const emailDev = String(url.searchParams.get('e') || '').trim().toLowerCase().slice(0, 254);
  const sig = url.searchParams.get('sig') || '';
  if (!/^\d{10,16}$/.test(exp) || !/^[a-f0-9]{64}$/.test(sig)) {
    return pagina(400, 'Ligação inválida', 'Falta-lhe um pedaço. Pede uma nova com /test no Discord.');
  }
  if (Number(exp) < now()) {
    return pagina(410, 'Esta ligação expirou', 'Valem ' + VALIDADE_MIN + ' minutos. Corre /test outra vez e usa a nova.');
  }
  const esperada = await assinarTeste(env, exp, dados, manter, quem, limpar, emailDev);
  /* transição: a produção ainda assina à moda antiga (só exp:dados). Uma
     ligação antiga só vale como "retomar sem dono" — a mesma chave, os
     mesmos campos. Tirar este ramo quando a produção souber assinar o resto. */
  const antiga = manter === '0' && limpar === '0' && !quem && !emailDev
    ? await crypto.subtle.sign('HMAC', await chave(env), new TextEncoder().encode(exp + ':' + dados))
        .then((b2) => [...new Uint8Array(b2)].map((x) => x.toString(16).padStart(2, '0')).join(''))
    : null;
  if (sig !== esperada && sig !== antiga) {
    return pagina(403, 'Assinatura errada', 'Esta ligação não foi emitida por nós. Pede uma nova com /test.');
  }

  // o email do dev, se veio, fica no KV DESTE ambiente: o /test corre na
  // produção, mas o correio das contas de teste decide-se aqui
  if (quem && emailDev) {
    try { await env.SESSIONS.put(chaveEmailDev(quem), emailDev); } catch (e) {}
  }

  /* limpar é a única coisa que apaga — e é por dono: cada dev limpa as SUAS
     contas (e as órfãs de ligações antigas); as dos outros ficam de pé */
  let velhas = [];
  if (limpar === '1') {
    velhas = (await env.DB.prepare(
      "SELECT id FROM users WHERE email LIKE '%' || ? AND deleted_at IS NULL AND (test_owner IS NULL OR test_owner = ?)"
    ).bind(DOMINIO_TESTE, quem).all()).results || [];
    for (const v of velhas) {
      try { await purgeAccount(env, v.id); } catch (e) { /* uma teimosa não trava a nova */ }
    }
  }

  /* por omissão RETOMA-SE: a conta mais recente do dono, com os dados
     intactos de um dia para o outro. Cria-se de novo quando não há nenhuma,
     quando se limpou, ou quando se pediu uma extra (manter). */
  let conta = null, retomada = false;
  if (manter !== '1' && limpar !== '1') {
    const dona = await env.DB.prepare(
      "SELECT id, sess_epoch FROM users WHERE email LIKE '%' || ? AND deleted_at IS NULL AND " +
      (quem ? 'test_owner = ?' : 'test_owner IS NULL') + ' ORDER BY created_at DESC LIMIT 1'
    ).bind(...(quem ? [DOMINIO_TESTE, quem] : [DOMINIO_TESTE])).first();
    if (dona) { conta = dona; retomada = true; }
    else if (quem) {
      /* adoção: as contas de antes do dono existir são órfãs — em vez de se
         criar outra ao lado, a mais recente passa a ser deste dev, com os
         dados que lá estão. É o que faz o seletor aparecer a quem vinha
         das ligações antigas. */
      const orfa = await env.DB.prepare(
        "SELECT id, sess_epoch FROM users WHERE email LIKE '%' || ? AND deleted_at IS NULL AND test_owner IS NULL ORDER BY created_at DESC LIMIT 1"
      ).bind(DOMINIO_TESTE).first();
      if (orfa) {
        await env.DB.prepare('UPDATE users SET test_owner = ? WHERE id = ?').bind(quem, orfa.id).run();
        conta = orfa;
        retomada = true;
      }
    }
  }
  if (!conta) conta = Object.assign({ sess_epoch: 0 }, await criarContaDeTeste(env, quem));

  const token = await createSession(env, conta.id, conta.sess_epoch || 0);
  await auditar(env, { discordId: quem || 'sistema', nome: '/test', papeis: ['bot'] },
    'teste.sessao', conta.id,
    retomada ? 'conta retomada, dados intactos'
      : (limpar === '1' ? 'conta lavada · apagadas ' + velhas.length + ' anteriores'
        : manter === '1' ? 'conta extra (as outras ficam)' : 'primeira conta deste dono') +
        (dados === '1' ? ' · com dados de exemplo' : ''));

  const comExemplo = !retomada && dados === '1';
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/?entrar=' + token + (comExemplo ? '&exemplo=1' : ''),
      'Set-Cookie': sessionCookie(token),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

/* Depois de se apagar uma conta de teste, a sessão seguinte: a irmã mais
   recente do mesmo dono — ou, se não sobrar nenhuma, uma acabada de criar.
   Quem testa o "apagar conta" não pode aterrar no ecrã de login de um
   ambiente onde nem sequer há formulário que lhe valha.
   Recebe: env — o ambiente do worker; dono — o id do dev cujas contas se
   procuram.
   Devolve: promessa de { id, email, name, token } — a conta seguinte, já com
   sessão criada. */
export async function proximaContaDeTeste(env, dono) {
  let conta = await env.DB.prepare(
    "SELECT id, email, name, sess_epoch FROM users WHERE test_owner = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"
  ).bind(dono).first();
  if (!conta) {
    const nova = await criarContaDeTeste(env, dono);
    conta = { id: nova.id, email: nova.email, name: 'Conta de teste', sess_epoch: 0 };
  }
  const token = await createSession(env, conta.id, conta.sess_epoch || 0);
  return { id: conta.id, email: conta.email, name: conta.name || 'Conta de teste', token };
}

/* -------- o seletor de contas do ambiente de dev ------------------------
   Três rotas com sessão, só fora de produção e só para contas de teste COM
   dono: listar as contas do mesmo dev, trocar para uma delas, e criar uma
   extra. A afinidade é o test_owner — cada dev vê e toca só nas suas.
   Recebe: c — o contexto do pedido, com env, request, path, method, me e os
   ajudantes json/err/body.
   Devolve: promessa de uma Response JSON (ou de erro) nas rotas /api/teste/*,
   ou de null quando o caminho não é destas rotas. */
export async function rotasContasDeTeste(c) {
  const { env, request, path, method, me, json, err, body } = c;
  if (!path.startsWith('/api/teste/')) return null;
  if (!env.ENV_NAME) return err(404, 'Não há ambiente de teste aqui.');
  if (!eContaDeTeste(me.email)) return err(403, 'Só para contas de teste.');
  const eu = await env.DB.prepare('SELECT test_owner FROM users WHERE id = ?').bind(me.id).first();
  const dono = eu && eu.test_owner;
  if (!dono) return err(403, 'Esta conta de teste não tem dono registado — pede uma ligação nova com /test.');

  if (path === '/api/teste/contas' && method === 'GET') {
    const rows = (await env.DB.prepare(
      'SELECT id, email FROM users WHERE test_owner = ? AND deleted_at IS NULL ORDER BY created_at'
    ).bind(dono).all()).results;
    return json({ contas: rows.map((r) => ({ id: r.id, email: r.email, atual: r.id === me.id })) });
  }

  if (path === '/api/teste/trocar' && method === 'POST') {
    const b = await body(request);
    const alvo = await env.DB.prepare(
      'SELECT id, email, name, sess_epoch FROM users WHERE id = ? AND test_owner = ? AND deleted_at IS NULL'
    ).bind(String((b && b.para) || ''), dono).first();
    if (!alvo) return err(404, 'Essa conta não é tua ou já não existe.');
    const token = await createSession(env, alvo.id, alvo.sess_epoch || 0);
    return json({ token, id: alvo.id, email: alvo.email, name: alvo.name }, 200, {
      'Set-Cookie': sessionCookie(token),
    });
  }

  if (path === '/api/teste/nova' && method === 'POST') {
    const conta = await criarContaDeTeste(env, dono);
    const token = await createSession(env, conta.id, 0);
    await auditar(env, { discordId: dono, nome: 'seletor de teste', papeis: ['dev'] },
      'teste.sessao', conta.id, 'conta extra pelo seletor');
    return json({ token, id: conta.id, email: conta.email, name: 'Conta de teste' }, 200, {
      'Set-Cookie': sessionCookie(token),
    });
  }
  return null;
}
