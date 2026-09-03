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

export async function assinarTeste(env, exp, dados, manter) {
  const sig = await crypto.subtle.sign('HMAC', await chave(env),
    new TextEncoder().encode(exp + ':' + dados + ':' + (manter || '0')));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* A ligação completa, para o bot e para o back office. `base` é o worker de
   destino: o de dev aponta a si próprio; o de produção aponta ao dev. */
/* `manter` cria uma conta EXTRA sem apagar as existentes — é o que permite
   testar partilhas e ligações entre duas contas de teste ao mesmo tempo. */
export async function ligacaoTeste(env, base, comExemplo, manter) {
  const exp = String(now() + VALIDADE_MIN * 60000);
  const dados = comExemplo ? '1' : '0';
  const m = manter ? '1' : '0';
  const sig = await assinarTeste(env, exp, dados, m);
  return base + '/t/entrar?exp=' + exp + '&dados=' + dados + '&m=' + m + '&sig=' + sig;
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
  const sig = url.searchParams.get('sig') || '';
  if (!/^\d{10,16}$/.test(exp) || !/^[a-f0-9]{64}$/.test(sig)) {
    return pagina(400, 'Ligação inválida', 'Falta-lhe um pedaço. Pede uma nova com /test no Discord.');
  }
  if (Number(exp) < now()) {
    return pagina(410, 'Esta ligação expirou', 'Valem ' + VALIDADE_MIN + ' minutos. Corre /test outra vez e usa a nova.');
  }
  const esperada = await assinarTeste(env, exp, dados, manter);
  if (sig !== esperada) return pagina(403, 'Assinatura errada', 'Esta ligação não foi emitida por nós. Pede uma nova com /test.');

  /* cada visita começa lavada: as contas de teste anteriores vão-se, com
     tudo o que arrastam (casas, registos, ligações) — é o purge a sério.
     Com `manter`, salta-se a lavagem: a conta nova junta-se às que há,
     para testes que precisam de duas ao mesmo tempo. */
  let velhas = [];
  if (manter !== '1') {
    velhas = (await env.DB.prepare(
      "SELECT id FROM users WHERE email LIKE '%' || ? AND deleted_at IS NULL"
    ).bind(DOMINIO_TESTE).all()).results || [];
    for (const v of velhas) {
      try { await purgeAccount(env, v.id); } catch (e) { /* uma teimosa não trava a nova */ }
    }
  }

  // a conta nova: sem palavra-passe conhecida (hash aleatório) — entra-se
  // só por esta ligação, nunca pelo formulário
  const id = newUserId();
  const lixo = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at, terms_version, terms_at)
     VALUES (?, ?, 'Conta de teste', ?, ?, ?, ?, ?)`
  ).bind(id, 'teste-' + id.toLowerCase() + DOMINIO_TESTE, lixo(), lixo(), now(), TERMS_VERSION, now()).run();

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
