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

async function chave(env) {
  return crypto.subtle.importKey('raw',
    new TextEncoder().encode('teste:' + (env.DISCORD_BOT_TOKEN || 'sem-chave')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function assinarTeste(env, exp, dados, manter, quem) {
  const sig = await crypto.subtle.sign('HMAC', await chave(env),
    new TextEncoder().encode(exp + ':' + dados + ':' + (manter || '0') + ':' + (quem || '')));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* A ligação completa, para o bot e para o back office. `base` é o worker de
   destino: o de dev aponta a si próprio; o de produção aponta ao dev. */
/* `manter` cria uma conta EXTRA sem apagar as existentes — é o que permite
   testar partilhas e ligações entre duas contas de teste ao mesmo tempo. */
export async function ligacaoTeste(env, base, comExemplo, manter, quem) {
  const exp = String(now() + VALIDADE_MIN * 60000);
  const dados = comExemplo ? '1' : '0';
  const m = manter ? '1' : '0';
  const q = String(quem || '').replace(/[^\w.-]/g, '').slice(0, 32);
  const sig = await assinarTeste(env, exp, dados, m, q);
  return base + '/t/entrar?exp=' + exp + '&dados=' + dados + '&m=' + m + '&q=' + q + '&sig=' + sig;
}

/* A conta de teste em si: email no subdomínio, palavra-passe impossível,
   termos aceites, e o dono (o dev que a pediu) gravado para o seletor. */
async function criarContaDeTeste(env, quem) {
  const id = newUserId();
  const lixo = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const email = 'teste-' + id.toLowerCase() + DOMINIO_TESTE;
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at, test_owner)
     VALUES (?, ?, 'Conta de teste', ?, ?, ?, ?, ?, ?)`
  ).bind(id, email, lixo(), lixo(), now(), TERMS_VERSION, now(), quem || null).run();
  return { id, email };
}

// Quem abre esta rota é uma pessoa num browser: os erros são uma página
// que se lê, não um JSON que se decifra.
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

export async function rotaTeste(c) {
  const { env, url } = c;
  // produção nunca cria contas de teste — nem com assinatura boa
  if (!env.ENV_NAME) return pagina(404, 'Não há ambiente de teste aqui', 'Isto é produção. O /test do Discord dá ligações para o ambiente de desenvolvimento.');

  const exp = url.searchParams.get('exp') || '';
  const dados = url.searchParams.get('dados') === '1' ? '1' : '0';
  const manter = url.searchParams.get('m') === '1' ? '1' : '0';
  const quem = String(url.searchParams.get('q') || '').replace(/[^\w.-]/g, '').slice(0, 32);
  const sig = url.searchParams.get('sig') || '';
  if (!/^\d{10,16}$/.test(exp) || !/^[a-f0-9]{64}$/.test(sig)) {
    return pagina(400, 'Ligação inválida', 'Falta-lhe um pedaço. Pede uma nova com /test no Discord.');
  }
  if (Number(exp) < now()) {
    return pagina(410, 'Esta ligação expirou', 'Valem ' + VALIDADE_MIN + ' minutos. Corre /test outra vez e usa a nova.');
  }
  const esperada = await assinarTeste(env, exp, dados, manter, quem);
  /* transição: a produção ainda assina à moda antiga (só exp:dados). Uma
     ligação antiga só vale como "lavar sem dono" — a mesma chave, os mesmos
     campos. Tirar este ramo quando a produção souber assinar o resto. */
  const antiga = manter === '0' && !quem
    ? await crypto.subtle.sign('HMAC', await chave(env), new TextEncoder().encode(exp + ':' + dados))
        .then((b2) => [...new Uint8Array(b2)].map((x) => x.toString(16).padStart(2, '0')).join(''))
    : null;
  if (sig !== esperada && sig !== antiga) {
    return pagina(403, 'Assinatura errada', 'Esta ligação não foi emitida por nós. Pede uma nova com /test.');
  }

  /* cada visita começa lavada: as contas de teste anteriores vão-se, com
     tudo o que arrastam (casas, registos, ligações) — é o purge a sério.
     Com `manter`, salta-se a lavagem: a conta nova junta-se às que há,
     para testes que precisam de duas ao mesmo tempo. */
  /* a lavagem é por dono: cada dev lava as SUAS contas (e as órfãs de
     ligações antigas) — as dos outros ficam de pé */
  let velhas = [];
  if (manter !== '1') {
    velhas = (await env.DB.prepare(
      "SELECT id FROM users WHERE email LIKE '%' || ? AND deleted_at IS NULL AND (test_owner IS NULL OR test_owner = ?)"
    ).bind(DOMINIO_TESTE, quem).all()).results || [];
    for (const v of velhas) {
      try { await purgeAccount(env, v.id); } catch (e) { /* uma teimosa não trava a nova */ }
    }
  }

  // a conta nova: sem palavra-passe conhecida — entra-se só por aqui
  const { id } = await criarContaDeTeste(env, quem);

  const token = await createSession(env, id, 0);
  await auditar(env, { discordId: 'sistema', nome: '/test', papeis: ['bot'] },
    'teste.sessao', id, (manter === '1' ? 'conta extra (as outras ficam)' : 'conta lavada · apagadas ' + velhas.length + ' anteriores') +
    (dados === '1' ? ' · com dados de exemplo' : ''));

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/?entrar=' + token + (dados === '1' ? '&exemplo=1' : ''),
      'Set-Cookie': sessionCookie(token),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

/* -------- o seletor de contas do ambiente de dev ------------------------
   Três rotas com sessão, só fora de produção e só para contas de teste COM
   dono: listar as contas do mesmo dev, trocar para uma delas, e criar uma
   extra. A afinidade é o test_owner — cada dev vê e toca só nas suas. */
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
