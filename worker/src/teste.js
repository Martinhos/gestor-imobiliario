/* O ambiente de teste, a um /test de distância.
   ---------------------------------------------
   O comando /test no Discord responde com uma ligação temporária para o
   ambiente de dev. Abri-la faz três coisas, por esta ordem: apaga as contas
   de teste anteriores (cada visita começa lavada), cria uma conta de teste
   nova, e entra com ela — com ou sem dados de exemplo.

   A ligação é um bilhete ASSINADO, não um estado: HMAC sobre a validade e
   as opções, com a TESTE_CHAVE — o segredo que os dois ambientes partilham
   (docs/armadilhas.md, «Bots separados, chave partilhada»). Assim o worker
   de produção (que é quem responde ao Discord depois da promoção) consegue
   emitir ligações para o dev sem os dois falarem um com o outro.

   Nada disto existe em produção: sem ENV_NAME, a rota é um 404 e ponto —
   produção nunca cria contas de teste, venha a assinatura de onde vier.

   E no dev.rendorium.com a ligação é a única entrada: a porta do dev
   (portaDoDev, no fim deste ficheiro) dá um 404 seco a quem não traz a
   sessão de uma conta de teste. */

import { now, TERMS_VERSION, CSP_ESTRITA } from './lib/http.js';
import { purgeAccount } from './lib/acesso.js';
import { newUserId, createSession, destroySession, sessionCookie, tokensDoPedido, getSessionUser } from './auth.js';
import { auditar } from './lib/auditoria.js';
import { ligarAoEntrar } from './lib/rasto.js';
import { navegador } from './rotas/relatos.js';
import { nomeNoDiscord } from './lib/bot.js';

const DOMINIO_TESTE = '@teste.rendorium.com';
const VALIDADE_MIN = 10;

// Uma conta é de teste pelo domínio do email (DOMINIO_TESTE, o das contas que o /test cria).
// Recebe: email — o email da conta (texto; null e undefined contam como vazio).
// Devolve: true quando o email acaba nesse domínio.
export const eContaDeTeste = (email) => String(email || '').endsWith(DOMINIO_TESTE);

// O browser e o sistema de quem abre uma sessão de teste, curtos, para a lista do back office (sessoes-teste.js).
// Recebe: request — o pedido HTTP (pode faltar).
// Devolve: o resumo ('Chrome 128 · Android 14'), ou '' sem user-agent.
export const agenteDe = (request) => navegador(request && request.headers ? request.headers.get('user-agent') : '');

/* Termina as sessões que o browser trazia, quando recebe uma nova: a app
   guarda uma sessão só (o cookie e o token do aparelho), e a que a nova
   substitui ficava no KV os 30 dias da validade — cada ligação do /test,
   cada troca no seletor e cada conta extra deixava uma para trás, e o back
   office chegou a ter trinta numa conta. As de outros aparelhos ficam.
   Recebe: env — o ambiente do worker (KV SESSIONS); request — o pedido, de
   onde saem os tokens (auth.js:tokensDoPedido: o Bearer e o cookie);
   nova — o token da sessão acabada de criar, que fica.
   Devolve: promessa de quantas terminou. */
export async function largarSessoesDoBrowser(env, request, nova) {
  let n = 0;
  for (const t of request ? tokensDoPedido(request) : []) {
    if (t === nova) continue;
    try { await destroySession(env, t); n++; } catch (e) { /* uma que falhe não trava a entrada */ }
  }
  return n;
}

/* Quem abre uma ligação do /test sem ser uma pessoa: as pré-visualizações
   de ligações (o Discord, o Slack, o WhatsApp, o Telegram, as redes) e os
   motores de busca. Cada pedido destes criava uma sessão que nenhum browser
   guardava. */
const ROBOS_DE_LIGACOES = /discordbot|slackbot|slack-imgproxy|whatsapp|telegrambot|twitterbot|facebookexternalhit|linkedinbot|skypeuripreview|embedly|googlebot|bingbot|bot\/|crawler|spider/i;

/* O pedido é de um robô que segue ligações (ROBOS_DE_LIGACOES)?
   Recebe: request — o pedido HTTP (pode faltar).
   Devolve: true/false. */
export function eRoboDeLigacoes(request) {
  const ua = request && request.headers ? request.headers.get('user-agent') || '' : '';
  return ROBOS_DE_LIGACOES.test(ua);
}

/* O segredo das ligações de teste. Com os bots de dev e produção separados,
   o token do bot deixou de ser partilhado — a TESTE_CHAVE (a mesma nos dois
   ambientes) é o que deixa o /test de qualquer servidor assinar ligações
   que o worker de dev aceita. Sem ela, vale o token do bot, como dantes.
   Sem nenhum dos dois não há segredo, e não se assina nem se aceita nada:
   uma chave escrita no código é uma chave que qualquer pessoa conhece, e um
   HMAC com ela não prova nada — num dev com os segredos por pôr, qualquer um
   criava contas de teste e apagava as órfãs.
   Recebe: env — o ambiente do worker.
   Devolve: o segredo (texto), ou null quando não há nenhum. */
function segredoDoTeste(env) {
  return env.TESTE_CHAVE || env.DISCORD_BOT_TOKEN || null;
}

// O que se diz quando falta o segredo: no Discord, no back office e na rota.
export const SEM_CHAVE = 'O ambiente de teste não tem chave: falta a TESTE_CHAVE (ou o token do bot) neste worker. ' +
  'Adiciona o segredo e corre o deploy.';

// Se este worker tem com que assinar e verificar ligações de teste.
// Recebe: env — o ambiente do worker.
// Devolve: true quando há TESTE_CHAVE ou token do bot.
export function temChaveDeTeste(env) {
  return !!segredoDoTeste(env);
}

// A chave HMAC das ligações de teste, feita do segredo.
// Recebe: env — o ambiente do worker, de onde sai o segredo.
// Devolve: promessa de uma CryptoKey HMAC-SHA256, só para assinar; rejeita
// com SEM_CHAVE quando não há segredo.
async function chave(env) {
  const segredo = segredoDoTeste(env);
  if (!segredo) throw new Error(SEM_CHAVE);
  return crypto.subtle.importKey('raw', new TextEncoder().encode('teste:' + segredo),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

// A assinatura HMAC-SHA256, em hexadecimal, dos campos de uma ligação de
// teste — na ordem fixa em que o rotaTeste os volta a verificar. Os campos
// vazios também contam: mudar qualquer um muda a assinatura.
// Recebe: env — o ambiente do worker (dá a chave); exp — a validade, em
// milissegundos de época como texto; dados — '1' com dados de exemplo, '0'
// sem; manter (opcional) — '1' para conta extra; quem (opcional) — o id do
// dev dono; limpar (opcional) — '1' para lavar as contas do dono; email
// (opcional) — o email do dev para o correio das contas de teste; nome
// (opcional) — o nome do dev no Discord. O nome só entra na assinatura
// quando vem: uma ligação sem nome assina-se como antes dele existir, e as
// ligações de um worker ainda sem esta versão continuam a valer.
// Devolve: promessa da assinatura em hexadecimal (64 caracteres).
export async function assinarTeste(env, exp, dados, manter, quem, limpar, email, nome) {
  const sig = await crypto.subtle.sign('HMAC', await chave(env),
    new TextEncoder().encode(exp + ':' + dados + ':' + (manter || '0') + ':' + (quem || '') +
      ':' + (limpar || '0') + ':' + (email || '') + (nome ? ':' + nome : '')));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* O nome do dev no Discord como viaja na ligação: sem caracteres de
   controlo, aparado, até 64 caracteres. É só para mostrar (o autor de um
   ticket de QA): a afinidade das contas continua a ser o id (quem).
   Recebe: v — o nome (texto; null e undefined contam como vazio).
   Devolve: o nome limpo, ou '' quando não sobra nada. */
export function nomeDoDev(v) {
  return String(v || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 64);
}

/* A ligação completa, para o bot e para o back office. `base` é o worker de
   destino: o de dev aponta a si próprio; o de produção aponta ao dev.
   As contas de teste são PERSISTENTES: por omissão a ligação retoma a conta
   mais recente do dono (os dados ficam de um dia para o outro); `manter`
   cria uma EXTRA sem apagar as existentes — é o que permite testar
   partilhas e ligações entre duas contas de teste ao mesmo tempo; `limpar`
   é a única coisa que apaga. O `email` do dev vai assinado dentro da
   ligação — quem a abre grava-o no KV do ambiente de teste, e é para lá que
   segue o correio das contas dele.
   Recebe: env — o ambiente do worker; base — o URL do worker de destino, sem
   barra final; comExemplo — verdadeiro para a conta nascer com dados de
   exemplo; manter (opcional) — verdadeiro para uma conta extra; quem
   (opcional) — o id do dev dono; limpar (opcional) — verdadeiro para apagar
   as contas do dono; email (opcional) — o email do dev (ignorado se não
   parecer um email); nome (opcional) — o nome do dev no Discord, que fica
   como autor dos tickets de QA das contas dele (só vai com um dono).
   Devolve: promessa do URL de /t/entrar, assinado e válido 10 minutos;
   rejeita com SEM_CHAVE quando o worker não tem com que assinar. */
export async function ligacaoTeste(env, base, comExemplo, manter, quem, limpar, email, nome) {
  const exp = String(now() + VALIDADE_MIN * 60000);
  const dados = comExemplo ? '1' : '0';
  const m = manter ? '1' : '0';
  const l = limpar ? '1' : '0';
  const q = String(quem || '').replace(/[^\w.-]/g, '').slice(0, 32);
  let e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) e = '';
  const n = q ? nomeDoDev(nome) : '';
  const sig = await assinarTeste(env, exp, dados, m, q, l, e, n);
  return base + '/t/entrar?exp=' + exp + '&dados=' + dados + '&m=' + m + '&l=' + l + '&q=' + q +
    (e ? '&e=' + encodeURIComponent(e) : '') + (n ? '&n=' + encodeURIComponent(n) : '') + '&sig=' + sig;
}

// o correio das contas deste dev vai para aqui (gravado pela ligação)
// Recebe: quem — o dev que pediu a ligação (o identificador que ela traz assinado).
// Devolve: a chave no KV (SESSIONS) onde fica o email dele (texto).
export const chaveEmailDev = (quem) => 'teste:email:' + quem;

// o nome do dev no Discord (gravado pela ligação), para o autor dos tickets de QA
// Recebe: quem — o id de Discord do dev (o test_owner das contas dele).
// Devolve: a chave no KV (SESSIONS) onde fica o nome dele (texto).
export const chaveNomeDev = (quem) => 'teste:nome:' + quem;

// quanto tempo fica guardado um nome perguntado ao bot (o da ligação fica sem prazo)
const VALIDADE_NOME_BOT = 30 * 86400;

/* O nome de um dev no Discord: o que a ligação do /test gravou e, quando não
   gravou (as ligações do bot de produção antes de saberem pôr o nome), o que
   o bot responde, guardado no mesmo sítio por 30 dias para não perguntar a
   cada pedido. Uma ligação nova com o nome escreve por cima.
   Recebe: env — o ambiente do worker (KV em env.SESSIONS; DISCORD_BOT_TOKEN);
   quem — o id de Discord do dev.
   Devolve: promessa do nome (texto), ou '' quando não se sabe. */
export async function nomeDoDevNoDiscord(env, quem) {
  if (!quem) return '';
  let nome = '';
  try { nome = (await env.SESSIONS.get(chaveNomeDev(quem))) || ''; } catch (e) { nome = ''; }
  if (nome) return nome;
  nome = nomeDoDev(await nomeNoDiscord(env, quem));
  if (nome) {
    try { await env.SESSIONS.put(chaveNomeDev(quem), nome, { expirationTtl: VALIDADE_NOME_BOT }); } catch (e) {}
  }
  return nome;
}

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

// o frasco de ensaio do ícone das páginas do /t/entrar (traço da casa, grelha de 24)
const FRASCO = 'M9 3h6M10 3v6l-5.6 9.4A1.7 1.7 0 0 0 5.9 21h12.2a1.7 1.7 0 0 0 1.5-2.6L14 9V3M7.2 15h9.6';

/* Quem abre esta rota é uma pessoa num browser: os erros são uma página
   que se lê, não um JSON que se decifra. Veste-se como as outras páginas
   públicas do worker (landing.js, legal-vista.js): a marca, a Geist e a
   Bricolage, o fundo #F2F3F6 e um cartão branco, no tema de quem lê. O
   quadrado do ícone diz o peso do erro: cinzento quando a porta não existe
   (produção), âmbar quando é a ligação que está mal, vermelho quando é o
   ambiente que falha.
   Recebe: status — o código HTTP da resposta; titulo — o título, no
   separador e na página; texto — a explicação por baixo (HTML simples).
   O que ela pede ao servidor (o /paginas/teste.css, as duas letras e o
   /icon-192.png) está nas exceções da porta do dev (SEM_SESSAO): quem a vê
   ainda não tem sessão.
   Devolve: uma Response HTML completa, sem cache e fora dos motores de busca. */
function pagina(status, titulo, texto) {
  const tom = status >= 500 ? ' perigo' : status === 404 ? '' : ' aviso';
  return new Response('<!doctype html><html lang="pt-PT"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light dark">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>' + titulo + ' — Rendorium</title>' +
    '<link rel="icon" href="/icon-192.png">' +
    '<link rel="stylesheet" href="/paginas/teste.css">' +
    '</head><body><main class="caixa">' +
    '<div class="marca"><span class="mark" aria-hidden="true"></span><span class="nome">Rendorium</span>' +
    '<span class="selo">Entrada de teste</span></div>' +
    '<div class="icone' + tom + '"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + FRASCO + '"/></svg></div>' +
    '<h1>' + titulo + '</h1>' +
    '<p>' + texto + '</p></main></body></html>', {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': CSP_ESTRITA,
    },
  });
}

/* Os estilos das páginas de erro do /t/entrar, servidos à parte em
   /paginas/teste.css (paginas-recursos.js): a página vai com a CSP_ESTRITA,
   que não aplica estilos escritos dentro do HTML. As letras são as mesmas
   declarações do CSS_LANDING (landing.js) e do CSS_LEGAL (legal-vista.js), e
   um teste confere que as três não divergem; os tokens são os do contrato
   do redesign, com os escuros para quem lê no tema escuro. */
export const CSS_TESTE = `@font-face{font-family:'Geist';src:url(/fonts/geist.woff2) format('woff2');font-weight:100 900;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Bricolage Grotesque';src:url(/fonts/bricolage-grotesque.woff2) format('woff2');font-weight:200 800;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{color-scheme:light dark;
  --bg:#F2F3F6;--card:#FFFFFF;--chip:#F6F7F9;--ink:#121826;--muted:#4F586B;--line:#E2E5EB;
  --accent:#2952D9;--accent-soft:#E9EEFC;--accent-text:#1D3FB0;
  --warn:#8F5600;--warn-soft:#FFF1D1;--danger:#B42318;--danger-soft:#FDE8E6;
  --marca:#2952D9;--marca-arco:#FFFFFF}
@media(prefers-color-scheme:dark){:root{
  --bg:#0B111E;--card:#141C2C;--chip:#1A2335;--ink:#E9EDF5;--muted:#AEB7C9;--line:#253049;
  --accent:#7C9BFF;--accent-soft:#1E2A4D;--accent-text:#B5C6FF;
  --warn:#F2C25A;--warn-soft:#352A12;--danger:#FF8A80;--danger-soft:#3D1A1A}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px 16px;
  background:var(--bg);color:var(--ink);font-family:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
.caixa{width:100%;max-width:440px;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:24px}
.marca{display:flex;align-items:center;gap:10px;margin-bottom:24px}
.nome{font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-weight:650;font-size:19px;letter-spacing:-.02em}
.mark{display:block;flex:none;width:30px;height:30px;border-radius:8px;
  background:radial-gradient(circle at 0 0,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),
    radial-gradient(circle at 100% 100%,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),var(--marca)}
.selo{margin-left:auto;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;
  background:var(--accent-soft);color:var(--accent-text);font-size:12px;font-weight:600;white-space:nowrap}
.icone{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:var(--chip);color:var(--muted);margin-bottom:14px}
.icone.aviso{background:var(--warn-soft);color:var(--warn)}
.icone.perigo{background:var(--danger-soft);color:var(--danger)}
.icone svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
h1{font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-weight:650;font-size:20px;line-height:1.25;
  letter-spacing:-.015em;margin:0 0 8px;text-wrap:balance}
p{margin:0;color:var(--muted);font-size:15px}
a{color:var(--accent)}
`;

/* A rota /t/entrar: valida a validade e a assinatura e, conforme as opções
   da ligação, limpa as contas do dono, retoma a mais recente ou cria uma
   nova — e entra com ela (302 com cookie de sessão). Os erros são páginas
   legíveis, porque quem abre isto é uma pessoa num browser. Fora do
   ambiente de teste é sempre 404, venha a assinatura de onde vier.
   Recebe: c — o contexto do pedido, com env e url (as opções vêm todas da
   query string da ligação).
   Devolve: promessa de uma Response — o 302 com cookie de sessão quando tudo
   bate certo, ou uma página de erro (400/403/404/410, e 503 sem chave). */
export async function rotaTeste(c) {
  const { env, url } = c;
  // produção nunca cria contas de teste — nem com assinatura boa
  if (!env.ENV_NAME) return pagina(404, 'Não há ambiente de teste aqui', 'Isto é produção. O /test do Discord dá ligações para o ambiente de desenvolvimento.');
  // sem segredo, nenhuma assinatura prova nada: falha alto em vez de aceitar
  if (!temChaveDeTeste(env)) {
    return pagina(503, 'Ambiente de teste sem chave',
      'Falta a TESTE_CHAVE neste ambiente — sem ela ninguém consegue assinar uma ligação que valha. Adiciona o segredo e corre o deploy do dev.');
  }
  // a pré-visualização de uma ligação não entra, não cria nem limpa nada
  if (eRoboDeLigacoes(c.request)) {
    return pagina(200, 'Ligação de teste', 'Abre esta ligação num browser para entrares no ambiente de desenvolvimento.');
  }

  const exp = url.searchParams.get('exp') || '';
  const dados = url.searchParams.get('dados') === '1' ? '1' : '0';
  const manter = url.searchParams.get('m') === '1' ? '1' : '0';
  const limpar = url.searchParams.get('l') === '1' ? '1' : '0';
  const quem = String(url.searchParams.get('q') || '').replace(/[^\w.-]/g, '').slice(0, 32);
  const emailDev = String(url.searchParams.get('e') || '').trim().toLowerCase().slice(0, 254);
  const nomeDev = quem ? nomeDoDev(url.searchParams.get('n')) : '';
  const sig = url.searchParams.get('sig') || '';
  if (!/^\d{10,16}$/.test(exp) || !/^[a-f0-9]{64}$/.test(sig)) {
    return pagina(400, 'Ligação inválida', 'Falta-lhe um pedaço. Pede uma nova com /test no Discord.');
  }
  if (Number(exp) < now()) {
    return pagina(410, 'Esta ligação expirou', 'Valem ' + VALIDADE_MIN + ' minutos. Corre /test outra vez e usa a nova.');
  }
  const esperada = await assinarTeste(env, exp, dados, manter, quem, limpar, emailDev, nomeDev);
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
  // e o nome dele no Discord, que os tickets de QA das contas dele levam como autor
  if (quem && nomeDev) {
    try { await env.SESSIONS.put(chaveNomeDev(quem), nomeDev); } catch (e) {}
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

  const token = await createSession(env, conta.id, conta.sess_epoch || 0, agenteDe(c.request));
  await largarSessoesDoBrowser(env, c.request, token);
  // o aparelho que disse sim ao rasto liga-se a esta conta, como numa entrada (nunca lança)
  await ligarAoEntrar(env, c.request, conta.id);
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
   procuram; agente (opcional) — o browser de quem apagou (agenteDe), para a
   sessão nova levar o mesmo.
   Devolve: promessa de { id, email, name, token } — a conta seguinte, já com
   sessão criada. */
export async function proximaContaDeTeste(env, dono, agente) {
  let conta = await env.DB.prepare(
    "SELECT id, email, name, sess_epoch FROM users WHERE test_owner = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"
  ).bind(dono).first();
  if (!conta) {
    const nova = await criarContaDeTeste(env, dono);
    conta = { id: nova.id, email: nova.email, name: 'Conta de teste', sess_epoch: 0 };
  }
  const token = await createSession(env, conta.id, conta.sess_epoch || 0, agente || '');
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
    const token = await createSession(env, alvo.id, alvo.sess_epoch || 0, agenteDe(request));
    await largarSessoesDoBrowser(env, request, token);
    return json({ token, id: alvo.id, email: alvo.email, name: alvo.name }, 200, {
      'Set-Cookie': sessionCookie(token),
    });
  }

  if (path === '/api/teste/nova' && method === 'POST') {
    const conta = await criarContaDeTeste(env, dono);
    const token = await createSession(env, conta.id, 0, agenteDe(request));
    await largarSessoesDoBrowser(env, request, token);
    await auditar(env, { discordId: dono, nome: 'seletor de teste', papeis: ['dev'] },
      'teste.sessao', conta.id, 'conta extra pelo seletor');
    return json({ token, id: conta.id, email: conta.email, name: 'Conta de teste' }, 200, {
      'Set-Cookie': sessionCookie(token),
    });
  }
  return null;
}

/* -------- a porta do dev.rendorium.com ----------------------------------
   Decisão do Martinho (2026-10-28): o ambiente de desenvolvimento só se abre
   a quem entrou por uma ligação do /test no Discord — «assim sei que só quem
   está identificado tem acesso». Lá dentro, um pedido sem a sessão de uma
   conta de teste (eContaDeTeste, o email @teste.rendorium.com),
   venha a sessão do cookie ou do Bearer, recebe um 404 seco: sem marca, sem
   dizer que é o ambiente de testes, sem cache. Uma conta normal do dev conta
   como sem sessão — a entrada e o criar conta deixam de existir lá.

   Passam sem sessão só:
   · a própria ligação (GET /t/entrar), que é o que cria a sessão;
   · as interações do bot do Discord (POST /api/discord), que se provam pela
     assinatura Ed25519;
   · o back office (/equipa, /equipa/…, /api/equipa/…), com a entrada da
     equipa pelo Discord, como sempre;
   · o que as páginas de erro do /t/entrar pedem (o CSS, as duas letras e o
     ícone) — o back office pede o CSS dele debaixo de /equipa/;
   · o /versao.json, que o deploy lê para confirmar a publicação
     (scripts/entrega.js). Diz a versão e a data, e nada de quem é;
   · o /.well-known/assetlinks.json (assetLinksDoDev, abaixo), que o Android
     lê sem cookies para deixar a APK de dev abrir as ligações do /test. Diz o
     pacote e a impressão do certificado, que já são públicos no APK.

   Fecha-se só com ENV_NAME 'dev' E a PORTA_DEV a 'fechada' (as duas no
   [env.dev.vars] do wrangler.toml): a produção não tem ENV_NAME, o percurso
   corre com ENV_NAME 'percurso' e precisa de criar contas pela entrada, e os
   testes que montam o worker com ENV_NAME 'dev' (a identidade de dev) não
   trazem a variável. Uma PORTA_DEV posta por engano na produção não fecha
   nada — falta-lhe o ENV_NAME.

   Para fechar os ficheiros da app também, eles têm de passar pelo worker: o
   run_worker_first do [env.dev.assets] apanha todos os de web/ (um teste
   confere-o contra a pasta). Cada pedido custa então uma invocação do worker
   e, com sessão, uma leitura do KV e uma da D1 — a conferência fica lembrada
   uns segundos por isolado (LEMBRAR_MS), para um carregamento da app (perto
   de cem ficheiros) não pagar uma leitura por ficheiro. */

// o corpo do 404: curto e sem nada de quem responde
const CORPO_404 = 'Não encontrado';

// os caminhos exatos que passam sem sessão, e com que métodos
const SEM_SESSAO = {
  '/t/entrar': ['GET'],
  '/api/discord': ['POST'],
  '/versao.json': ['GET', 'HEAD'],
  '/paginas/teste.css': ['GET', 'HEAD'],
  '/fonts/geist.woff2': ['GET', 'HEAD'],
  '/fonts/bricolage-grotesque.woff2': ['GET', 'HEAD'],
  '/icon-192.png': ['GET', 'HEAD'],
  '/.well-known/assetlinks.json': ['GET', 'HEAD'],
};

/* Quanto tempo uma conferência de sessão fica lembrada, e quantas no máximo.
   Uma sessão terminada pode ainda abrir os ficheiros estáticos durante este
   tempo, no mesmo isolado; a API não, que confere a sessão por sua conta
   (api.js) e responde 401. */
const LEMBRAR_MS = 30000;
const LEMBRAR_MAX = 500;
const lembradas = new WeakMap();   // env → Map(tokens → {teste, ate})

/* O caminho passa sem sessão? É uma das exceções da porta (o back office por
   inteiro, ou um dos caminhos exatos de SEM_SESSAO com o método certo).
   Recebe: caminho — o pathname do pedido (já normalizado pelo URL);
   metodo — o método HTTP.
   Devolve: true/false. */
export function passaSemSessao(caminho, metodo) {
  if (caminho === '/equipa' || caminho.startsWith('/equipa/') || caminho.startsWith('/api/equipa/')) return true;
  const metodos = Object.prototype.hasOwnProperty.call(SEM_SESSAO, caminho) ? SEM_SESSAO[caminho] : null;
  return !!metodos && metodos.indexOf(metodo) > -1;
}

/* A regra inteira, sem rede nem base: o pedido passa a porta?
   Recebe: o — {caminho, metodo, envName (o ENV_NAME), porta (a PORTA_DEV),
   sessaoDeTeste (true quando o pedido traz a sessão de uma conta de teste)}.
   Devolve: true quando passa; false quando leva o 404. */
export function passaNaPorta(o) {
  if (o.envName !== 'dev' || o.porta !== 'fechada') return true;
  if (o.sessaoDeTeste) return true;
  return passaSemSessao(o.caminho, o.metodo);
}

/* O 404 seco da porta. Sem cache em lado nenhum: um 404 guardado pelo
   caminho servia-se depois a quem tem sessão.
   Devolve: a Response (ainda por vestir com o harden do index.js). */
export function naoEncontrado() {
  return new Response(CORPO_404, {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* O pedido traz a sessão de uma conta de teste? A mesma conta que a API
   encontraria (auth.js:getSessionUser: o Bearer e, se já não servir, o
   cookie), e é de teste pelo email. Lembrada LEMBRAR_MS por isolado; uma
   falha do KV ou da D1 conta como sem sessão — a porta fecha-se, não abre.
   Recebe: env — o ambiente do worker; request — o pedido.
   Devolve: promessa de true/false. */
export async function temSessaoDeTeste(env, request) {
  const tokens = tokensDoPedido(request);
  if (!tokens.length) return false;
  const chave = tokens.join(' ');
  let memoria = lembradas.get(env);
  if (!memoria) { memoria = new Map(); lembradas.set(env, memoria); }
  const agora = Date.now();
  const lembrada = memoria.get(chave);
  if (lembrada && lembrada.ate > agora) return lembrada.teste;
  let teste = false;
  try {
    const u = await getSessionUser(env, request);
    teste = !!u && eContaDeTeste(u.email);
  } catch (e) {
    console.error('porta do dev', e && e.message);
    return false;   // sem lembrar: a próxima volta a tentar
  }
  if (memoria.size >= LEMBRAR_MAX) memoria.clear();
  memoria.set(chave, { teste, ate: agora + LEMBRAR_MS });
  return teste;
}

/* A porta à entrada do fetch: null quando o pedido segue (fora do dev
   fechado, numa exceção, ou com sessão de teste), ou o 404 seco.
   Recebe: env — o ambiente do worker; request — o pedido; url — o URL dele.
   Devolve: promessa de null ou da Response do 404. */
export async function portaDoDev(env, request, url) {
  const o = { caminho: url.pathname, metodo: request.method, envName: env.ENV_NAME, porta: env.PORTA_DEV, sessaoDeTeste: false };
  if (passaNaPorta(o)) return null;
  o.sessaoDeTeste = await temSessaoDeTeste(env, request);
  return passaNaPorta(o) ? null : naoEncontrado();
}

/* -------- o assetlinks.json do dev --------------------------------------
   A APK de dev (pt.gestorimobiliario.app.dev) declara as ligações
   https://dev.rendorium.com/t/entrar com android:autoVerify: o Android 12+
   só as abre direto na app depois de ler, sem cookies, o
   /.well-known/assetlinks.json deste domínio e encontrar lá o pacote e a
   impressão SHA-256 do certificado que assina o APK. Quem a escreve é o
   deploy do dev (passo «Escrever o assetlinks do APK de dev», no
   deploy.yml), que a tira do APK acabado de compilar e a põe em
   web/assetlinks-dev.json — fora do git, e fora de uma pasta com ponto, que
   os assets podem não servir. Daqui sai esse ficheiro, no caminho que o
   Android pede.

   Só no dev (ENV_NAME 'dev'), e com a porta fechada ou aberta. Na produção
   o caminho segue para os assets como sempre; o /assetlinks-dev.json em si
   continua atrás da porta. Sem o ficheiro (antes do primeiro deploy, ou com
   o keytool a falhar) é o 404 seco, sem cache: o Android guarda o
   resultado da verificação, e um 404 guardado pelo caminho tapava o ficheiro
   quando ele chegasse. Com ele, cinco minutos: uma impressão nova (a chave
   de dev a substituir a de produção) chega depressa. */
const ASSETLINKS = '/.well-known/assetlinks.json';
const ASSETLINKS_DEV = '/assetlinks-dev.json';

/* A rota do /.well-known/assetlinks.json no dev, depois da porta (que o
   deixa passar sem sessão, SEM_SESSAO).
   Recebe: env — o ambiente do worker; request — o pedido; url — o URL dele.
   Devolve: promessa de null (não é este pedido: outro caminho, outro
   método ou fora do dev) ou da Response — 200 application/json com o corpo
   do ASSETS /assetlinks-dev.json, ou o 404 seco. */
export async function assetLinksDoDev(env, request, url) {
  if (env.ENV_NAME !== 'dev' || url.pathname !== ASSETLINKS) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  let r = null;
  try {
    // um pedido novo, sem os cabeçalhos condicionais: um 304 dos assets não serve ao Android
    r = await env.ASSETS.fetch(new Request(new URL(ASSETLINKS_DEV, url), { method: request.method }));
  } catch (e) {
    console.error('assetlinks do dev', e && e.message);
  }
  if (!r || r.status !== 200) return naoEncontrado();
  return new Response(request.method === 'HEAD' ? null : r.body, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
}
