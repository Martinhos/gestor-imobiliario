/* O correio do Rendorium, pelo Resend.
   ------------------------------------
   Três remetentes, três papéis:

   no-reply@rendorium.com   o que a máquina diz sozinha (reset de password,
                            avisos) — com Reply-To para o support, porque
                            as pessoas respondem na mesma e alguém tem de ler
   support@rendorium.com    respostas a pedidos de ajuda
   general@rendorium.com    o resto (contacto, anúncios)

   Sem RESEND_API_KEY definido, tudo isto é um no-op que diz que não enviou
   — a app funciona na mesma, como sempre foi a regra com o Discord. Fora
   de produção o assunto leva o prefixo do ambiente, para um teste nunca
   se confundir com um email a sério. */

const DOMINIO = 'rendorium.com';
// Quanto se espera pelo Resend. Um envio pendurado segurava quem esperasse
// por ele — o pedido de repor a palavra-passe, ou o fim de um waitUntil —
// até a plataforma o matar; passado isto, desiste e diz porquê.
const PRAZO_CORREIO_MS = 5000;
export const REMETENTES = {
  maquina: { de: 'Rendorium <no-reply@' + DOMINIO + '>', responderA: 'support@' + DOMINIO },
  suporte: { de: 'Rendorium <support@' + DOMINIO + '>', responderA: 'support@' + DOMINIO },
  geral: { de: 'Rendorium <general@' + DOMINIO + '>', responderA: 'general@' + DOMINIO },
};

/* ------------------------------ o molde ---------------------------------- */

/* Um email não é uma página: não há CSP, mas há o Gmail, o Outlook e o Apple
   Mail, cada um com a sua ideia de CSS. Daí as regras do molde:
   - estilos em linha. O <style> do cabeçalho só ACRESCENTA o escuro e o
     telemóvel a quem os souber ler; sem ele, o email fica claro e inteiro;
   - tabelas para a estrutura, com 560 px de largura no máximo (o Outlook do
     Windows não conhece max-width: leva uma tabela de 560 só para ele);
   - nada de fora: nem imagens, nem letras do Google. A pilha das letras põe
     a Geist à frente e cai no sistema onde ela não estiver instalada;
   - a marca é uma tabela cobalto com dois arcos de contorno (o
     radial-gradient da app não chega ao correio); o Outlook do Windows, que
     não desenha cantos redondos, fica com o quadrado cobalto liso.
   As cores são as do contrato do redesign (os tokens de web/estilos.css),
   escritas por extenso porque um email não lê variáveis de CSS. */
const COR = {
  fundo: '#F2F3F6',        // --bg
  cartao: '#FFFFFF',       // --card
  tinta: '#121826',        // --ink
  secundario: '#4F586B',   // --muted
  terciario: '#687083',    // --faint: o rodapé
  contorno: '#E2E5EB',     // --line
  cobalto: '#2952D9',      // --accent: a marca e o botão
  sobreCobalto: '#FFFFFF', // --accent-ink
  suave: '#E9EEFC',        // --accent-soft: o fundo do assunto citado
  suaveTinta: '#1D3FB0',   // --accent-text
};
// Os mesmos papéis no escuro (os tokens de :root.dark), para os clientes que
// respeitam o prefers-color-scheme (o Apple Mail, o Outlook do Mac).
const COR_ESCURO = {
  fundo: '#0B111E', cartao: '#141C2C', tinta: '#E9EDF5', secundario: '#AEB7C9',
  terciario: '#8C96AB', contorno: '#253049', cobalto: '#7C9BFF', sobreCobalto: '#0B111E',
  suave: '#1E2A4D', suaveTinta: '#B5C6FF',
};
const LETRA = "'Geist',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const LETRA_TITULO = "'Bricolage Grotesque'," + LETRA;
// O aviso do fim por omissão: quem tem conta e não pediu nada.
const RODAPE_CONTA = 'Recebeste este email porque tens uma conta no Rendorium. Se não foste tu, ignora — nada acontece sem o teu clique.';
// O aviso do fim dos emails de pedidos: o no-reply e o support respondem ambos para o suporte.
const RODAPE_PEDIDO = 'Se responderes a este email, a resposta também chega ao suporte.';
// Quanto da resposta da equipa vai no email (o resto lê-se na app).
const RESPOSTA_MAX = 1500;

/* Os <style> do cabeçalho: o telemóvel (margens mais curtas) e o escuro.
   Tudo com !important, porque tem de vencer os estilos em linha — e tudo
   opcional: o Gmail na web ignora o escuro e fica com o claro, que é o
   desenho de base. Dois blocos e não um, porque o Gmail deita fora um
   <style> inteiro quando tropeça numa regra que não conhece: assim o do
   escuro (:root, prefers-color-scheme) não leva o do telemóvel consigo.
   As classes rd-* são só ganchos para isto. */
const ESTILO = '<style>' +
  '@media (max-width:480px){' +
  '.rd-moldura{padding:16px!important}' +
  '.rd-corpo{padding:22px 20px 20px!important}' +
  '.rd-rodape{padding:14px 20px 18px!important}}' +
  '</style><style>' +
  ':root{color-scheme:light dark;supported-color-schemes:light dark}' +
  '@media (prefers-color-scheme:dark){' +
  '.rd-fundo{background:' + COR_ESCURO.fundo + '!important}' +
  '.rd-cartao{background:' + COR_ESCURO.cartao + '!important;border-color:' + COR_ESCURO.contorno + '!important}' +
  '.rd-tinta{color:' + COR_ESCURO.tinta + '!important}' +
  '.rd-sec{color:' + COR_ESCURO.secundario + '!important}' +
  '.rd-rodape{color:' + COR_ESCURO.terciario + '!important;border-color:' + COR_ESCURO.contorno + '!important}' +
  '.rd-rodape a{color:' + COR_ESCURO.cobalto + '!important}' +
  '.rd-caixa{border-color:' + COR_ESCURO.contorno + '!important}' +
  '.rd-cit{background:' + COR_ESCURO.suave + '!important;color:' + COR_ESCURO.suaveTinta + '!important}' +
  '.rd-botao{background:' + COR_ESCURO.cobalto + '!important}' +
  '.rd-botao a{color:' + COR_ESCURO.sobreCobalto + '!important}}' +
  '</style>';

/* Escapa o que vai para dentro do HTML de um email: o assunto que a pessoa
   escreveu, a resposta da equipa, uma ligação num href. HTML de email não é
   sítio para surpresas, venha o texto de quem vier.
   Recebe: t — o texto (null e undefined dão '').
   Devolve: o texto com & < > " ' trocados pelas entidades. */
export function escaparHtml(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* O endereço da app para o botão dos emails de pedidos: o mesmo critério do
   bot (discord.js) — fora de produção há ENV_NAME, e a app é a do dev.
   Recebe: env — o ambiente do worker.
   Devolve: 'https://app.rendorium.com', ou 'https://dev.rendorium.com' fora de produção. */
export function enderecoDaApp(env) {
  return 'https://' + (env && env.ENV_NAME ? 'dev.' : 'app.') + DOMINIO;
}

/* A versão em texto simples: as mesmas partes do HTML, pela mesma ordem,
   separadas por uma linha em branco (as vazias saem).
   Recebe: partes — array de textos (ou falsos, que se saltam).
   Devolve: o corpo em texto simples. */
function textoDoEmail(partes) {
  return partes.filter(Boolean).join('\n\n');
}

/* Um parágrafo do corpo. O 'sub' é a nota pequena em cinzento (o «se o botão
   não abrir», a referência do pedido); o 'num' alinha os algarismos.
   Recebe: html — o conteúdo, já em HTML (escapado por quem chama); tipo
   (opcional) — 'sub', 'num' ou 'sub num'.
   Devolve: o <p> com os estilos em linha. */
function paragrafo(html, tipo) {
  const sub = /\bsub\b/.test(tipo || '');
  const num = /\bnum\b/.test(tipo || '') ? 'font-variant-numeric:tabular-nums;' : '';
  return '<p class="' + (sub ? 'rd-sec' : 'rd-tinta') + '" style="margin:0;font-family:' + LETRA + ';' +
    (sub ? 'font-size:13px;line-height:1.5;color:' + COR.secundario
      : 'font-size:15px;line-height:1.5;color:' + COR.tinta) +
    ';' + num + 'overflow-wrap:anywhere;word-break:break-word">' + html + '</p>';
}

/* O assunto do pedido citado num bloco suave cobalto (o .qt da prancheta).
   Recebe: html — o assunto, já escapado.
   Devolve: a tabela do bloco. */
function citacao(html) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0">' +
    '<tr><td class="rd-cit" bgcolor="' + COR.suave + '" style="padding:14px 16px;border-radius:12px;background:' + COR.suave +
    ';color:' + COR.suaveTinta + ';font-family:' + LETRA + ';font-size:14.5px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word">' +
    html + '</td></tr></table>';
}

/* A resposta da equipa numa caixa com contorno, para se distinguir do que o
   email diz à volta dela.
   Recebe: html — a resposta, já escapada e com as quebras em <br>.
   Devolve: a tabela da caixa. */
function caixa(html) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0">' +
    '<tr><td class="rd-caixa rd-tinta" style="padding:16px;border:1px solid ' + COR.contorno + ';border-radius:12px;color:' + COR.tinta +
    ';font-family:' + LETRA + ';font-size:15px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word">' +
    html + '</td></tr></table>';
}

/* O botão: cobalto, texto branco, 48 px de altura (14 + 20 + 14), raio 12.
   O Outlook do Windows não dá padding a um <a>: o mso-padding-alt dá-o à
   célula, e o botão fica com a mesma altura lá também.
   Recebe: href — o endereço (é escapado aqui); rotulo — o texto do botão.
   Devolve: a tabela do botão. */
function botao(href, rotulo) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0">' +
    '<tr><td class="rd-botao" bgcolor="' + COR.cobalto + '" style="border-radius:12px;background:' + COR.cobalto + ';mso-padding-alt:14px 22px">' +
    '<a href="' + escaparHtml(href) + '" target="_blank" style="display:inline-block;padding:14px 22px;border-radius:12px;font-family:' + LETRA +
    ';font-size:15px;line-height:20px;font-weight:600;color:' + COR.sobreCobalto + ';text-decoration:none">' +
    escaparHtml(rotulo) + '</a></td></tr></table>';
}

/* A marca: o quadrado cobalto de 28 px, raio 8, com dois arcos brancos em
   cantos opostos. Na app é um radial-gradient; aqui é uma tabela 2×2 de
   células de 14 px, e cada arco é um quarto de círculo feito de contorno (3
   px, raio 12, centrado no canto). Os arcos vão dentro de um comentário
   condicional: o Outlook do Windows, que os desenharia como esquadros, não
   os vê. É decorativa: aria-hidden.
   Devolve: a tabela da marca. */
function marca() {
  const celula = 'width:14px;height:14px;padding:0;font-size:0;line-height:0';
  const arco = (lados, canto, margem) => '<!--[if !mso]><!--><div style="width:9px;height:9px;margin:' + margem + ';' +
    lados.map((l) => 'border-' + l + ':3px solid ' + COR.sobreCobalto).join(';') +
    ';border-' + canto + '-radius:12px;font-size:0;line-height:0"></div><!--<![endif]-->';
  return '<table role="presentation" aria-hidden="true" width="28" height="28" cellpadding="0" cellspacing="0" border="0" bgcolor="' + COR.cobalto +
    '" style="width:28px;height:28px;background:' + COR.cobalto + ';border-radius:8px;border-collapse:separate;border-spacing:0;table-layout:fixed">' +
    '<tr><td width="14" height="14" valign="top" style="' + celula + '">' + arco(['right', 'bottom'], 'bottom-right', '0') + '</td>' +
    '<td width="14" height="14" style="' + celula + '"></td></tr>' +
    '<tr><td width="14" height="14" style="' + celula + '"></td>' +
    '<td width="14" height="14" valign="top" style="' + celula + '">' + arco(['left', 'top'], 'top-left', '2px 0 0 2px') + '</td></tr></table>';
}

/* O molde de todos os emails, vestido como a prancheta D-Emails: fundo
   cinzento-claro, um cartão branco de 560 px no máximo com a marca, o
   título, os blocos do corpo (16 px entre eles) e, por baixo de um filete, o
   rodapé pequeno. A versão em texto escreve-a quem chama (textoDoEmail).
   Recebe: opcoes — { assunto: o assunto do email (vai para o <title>);
   titulo: o título dentro do cartão; blocos: array de HTML (parágrafos,
   citação, caixa, botão; os falsos saltam-se); rodape (opcional): o texto
   pequeno do fim, por omissão o aviso de quem tem conta; rodapeHtml
   (opcional): o mesmo rodapé já em HTML (escapado por quem chama), para
   quando leva uma ligação — ganha ao rodape }.
   Devolve: o HTML completo do email, como texto. */
export function molde({ assunto, titulo, blocos, rodape, rodapeHtml }) {
  const linhas = (blocos || []).filter(Boolean)
    .map((b) => '<tr><td style="padding:16px 0 0">' + b + '</td></tr>').join('');
  return '<!doctype html><html lang="pt-PT"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="x-apple-disable-message-reformatting">' +
    '<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">' +
    '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">' +
    '<title>' + escaparHtml(assunto || titulo) + '</title>' + ESTILO + '</head>' +
    '<body class="rd-fundo" style="margin:0;padding:0;background:' + COR.fundo + ';-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">' +
    '<table role="presentation" class="rd-fundo" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + COR.fundo + '" style="background:' + COR.fundo + '">' +
    '<tr><td class="rd-moldura" align="center" style="padding:32px 16px">' +
    '<!--[if mso]><table role="presentation" align="center" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->' +
    '<table role="presentation" class="rd-cartao" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + COR.cartao +
    '" style="width:100%;max-width:560px;margin:0 auto;background:' + COR.cartao + ';border:1px solid ' + COR.contorno +
    ';border-radius:16px;border-collapse:separate;border-spacing:0">' +
    '<tr><td class="rd-corpo" style="padding:28px 28px 24px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
    '<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>' +
    '<td width="28" valign="middle">' + marca() + '</td>' +
    '<td class="rd-tinta" valign="middle" style="padding:0 0 0 10px;font-family:' + LETRA_TITULO + ';font-size:18px;line-height:28px;font-weight:700;letter-spacing:-0.015em;color:' + COR.tinta + '">Rendorium</td>' +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:16px 0 0"><h1 class="rd-tinta" style="margin:0;font-family:' + LETRA_TITULO +
    ';font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.015em;color:' + COR.tinta + '">' + escaparHtml(titulo) + '</h1></td></tr>' +
    linhas + '</table></td></tr>' +
    '<tr><td class="rd-rodape" style="padding:16px 28px 22px;border-top:1px solid ' + COR.contorno + ';font-family:' + LETRA +
    ';font-size:12.5px;line-height:1.5;color:' + COR.terciario + '">' + (rodapeHtml || escaparHtml(rodape || RODAPE_CONTA)) + '</td></tr>' +
    '</table>' +
    '<!--[if mso]></td></tr></table><![endif]-->' +
    '</td></tr></table></body></html>';
}

// Qualquer endereço no domínio da casa — rendorium.com ou um subdomínio.
// Serve o registo (ninguém cria contas com o nosso nome) e o correio que
// entra (o test@ só aceita o que a própria casa envia).
// Recebe: email — o endereço a examinar (o que não parecer um email dá falso).
// Devolve: verdadeiro se o domínio for rendorium.com ou um subdomínio dele.
export function dominioDaCasa(email) {
  const d = String(email || '').toLowerCase().split('@')[1] || '';
  return d === DOMINIO || d.endsWith('.' + DOMINIO);
}

/* Envia um email pelo Resend. Devolve sempre { enviado, motivo } e nunca
   lança: sem RESEND_API_KEY é um no-op, e um erro de rede ou do Resend vem
   como motivo — quem chama decide se isso trava alguma coisa. `remetente` é
   uma chave de REMETENTES ('maquina' por omissão); `html` e `texto` são as
   duas versões do corpo, e manda-se as que existirem.
   Recebe: env — o ambiente do worker (RESEND_API_KEY, ENV_NAME e, para o
   desvio das contas de teste, DB e SESSIONS); para — o endereço de destino;
   assunto — o assunto (cortado a 200 caracteres); html (opcional) — o corpo
   em HTML; texto (opcional) — o corpo em texto simples; remetente (opcional)
   — chave de REMETENTES ('maquina' por omissão).
   Devolve: promessa de { enviado, motivo } — o motivo só vem quando não foi. */
export async function enviarEmail(env, { para, assunto, html, texto, remetente }) {
  if (!env.RESEND_API_KEY) return { enviado: false, motivo: 'sem RESEND_API_KEY' };
  /* O correio de uma conta de teste não vai para o endereço dela (não
     existe, só daria bounces): vai para o email do DEV que a criou — o que
     ele registou pela ligação do /test — ou, sem registo, para a caixa da
     casa (test@). A conta original fica no assunto, para se saber de que
     sessão veio. */
  if (/@teste\.rendorium\.com$/i.test(String(para || ''))) {
    const contaDeTeste = String(para).toLowerCase();
    assunto = String(assunto || '') + ' · ' + contaDeTeste.split('@')[0];
    para = 'test@' + DOMINIO;
    try {
      const u = env.DB && await env.DB.prepare('SELECT test_owner FROM users WHERE email = ?')
        .bind(contaDeTeste).first();
      const proprio = u && u.test_owner && env.SESSIONS &&
        await env.SESSIONS.get('teste:email:' + u.test_owner);
      if (proprio) para = proprio;
    } catch (e) { /* sem pista do dono, fica a caixa da casa */ }
  }
  if (!para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(para))) {
    return { enviado: false, motivo: 'destinatário inválido' };
  }
  const quem = REMETENTES[remetente || 'maquina'] || REMETENTES.maquina;
  const prefixo = env.ENV_NAME ? '[' + env.ENV_NAME + '] ' : '';
  const corta = typeof AbortController === 'function' ? new AbortController() : null;
  const prazo = corta ? setTimeout(() => { try { corta.abort(); } catch (e) {} }, PRAZO_CORREIO_MS) : null;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: quem.de,
        to: [String(para)],
        reply_to: quem.responderA,
        subject: prefixo + String(assunto).slice(0, 200),
        html: html || undefined,
        text: texto || undefined,
      }),
      signal: corta ? corta.signal : undefined,
    });
    if (!r.ok) {
      const corpo = await r.text().catch(() => '');
      return { enviado: false, motivo: 'resend ' + r.status + ': ' + corpo.slice(0, 200) };
    }
    return { enviado: true };
  } catch (e) {
    if (corta && corta.signal.aborted) {
      return { enviado: false, motivo: 'o Resend não respondeu dentro do prazo (' + PRAZO_CORREIO_MS / 1000 + ' s)' };
    }
    return { enviado: false, motivo: String((e && e.message) || e) };
  } finally {
    if (prazo) clearTimeout(prazo);
  }
}

/* -------------------- os emails concretos que a app manda ---------------- */

/* O número de um pedido: os primeiros 8 caracteres do id, em maiúsculas.
   É o mesmo prefixo que o /pedido do Discord e a procura do back office
   aceitam — quem cita o número do email encontra o pedido em todo o lado.
   Recebe: id — o id do pedido (o UUID inteiro; os hífenes não contam).
   Devolve: o número curto, tipo "#1A2B3C4D". */
export function numeroPedido(id) {
  return '#' + String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}

/* A confirmação de que um pedido de ajuda ficou registado, com o número que
   a pessoa pode citar em qualquer canal: o assunto dela citado, o número, e
   o botão para a app (onde o pedido se acompanha).
   Recebe: env — o ambiente do worker (dá o endereço da app); id — o id do
   pedido (dá o número); assunto — o assunto que a pessoa escreveu.
   Devolve: { assunto, html, texto } — o email pronto a enviar. */
export function cartaPedidoRecebido(env, id, assunto) {
  const num = numeroPedido(id);
  const pedido = String(assunto || '').trim();
  const app = enderecoDaApp(env);
  const titulo = 'Recebemos o teu pedido';
  const registado = 'Ficou registado com o número ' + num + '. Vamos responder-te por email.';
  const naApp = 'Podes acompanhar e responder na app, em Definições › Ajuda e sugestões.';
  return {
    assunto: titulo + ' ' + num,
    texto: textoDoEmail([titulo, pedido && '«' + pedido + '»', registado, naApp, 'Abrir a app: ' + app, RODAPE_PEDIDO]),
    html: molde({
      assunto: titulo + ' ' + num,
      titulo,
      blocos: [
        pedido && citacao(escaparHtml(pedido)),
        paragrafo('Ficou registado com o número <strong>' + escaparHtml(num) + '</strong>. Vamos responder-te por email.', 'num'),
        paragrafo(escaparHtml(naApp)),
        botao(app, 'Abrir a app'),
      ],
      rodape: RODAPE_PEDIDO,
    }),
  };
}

// A confirmação automática de que um pedido de ajuda ficou registado (a
// cartaPedidoRecebido), enviada do no-reply. Devolve o resultado do enviarEmail.
// Recebe: env — o ambiente do worker; para — o email da pessoa; id — o id do
// pedido (dá o número); assunto — o assunto que a pessoa escreveu.
// Devolve: promessa de { enviado, motivo } — o que o enviarEmail disser.
export async function emailPedidoRecebido(env, para, id, assunto) {
  const c = cartaPedidoRecebido(env, id, assunto);
  return enviarEmail(env, { para, remetente: 'maquina', assunto: c.assunto, html: c.html, texto: c.texto });
}

/* O email de repor a palavra-passe: entrega a `ligacao` já pronta, no botão e
   escrita por extenso para quem tiver de a copiar. O «vale 1 hora e serve uma
   vez» é garantido por quem a criou — aqui só se escreve o envelope.
   Recebe: ligacao — o URL de reposição, completo e já assinado.
   Devolve: { assunto, html, texto } — o email pronto a enviar. */
export function cartaReporPassword(ligacao) {
  const titulo = 'Repor a tua palavra-passe';
  const pedido = 'Alguém pediu para repor a palavra-passe desta conta. A ligação vale 1 hora e serve uma vez.';
  const ignora = 'Se não pediste isto, ignora.';
  const url = String(ligacao || '');
  return {
    assunto: titulo,
    texto: textoDoEmail([titulo, pedido, 'Definir palavra-passe nova:\n' + url, ignora, RODAPE_CONTA]),
    html: molde({
      assunto: titulo,
      titulo,
      blocos: [
        paragrafo(escaparHtml(pedido)),
        botao(url, 'Definir palavra-passe nova'),
        paragrafo('Se o botão não abrir, copia esta ligação:<br><span class="rd-tinta" style="color:' + COR.tinta +
          ';word-break:break-all">' + escaparHtml(url) + '</span>', 'sub'),
        paragrafo(escaparHtml(ignora)),
      ],
      rodape: RODAPE_CONTA,
    }),
  };
}

// O email de repor a palavra-passe (a cartaReporPassword), enviado do no-reply.
// Recebe: env — o ambiente do worker; para — o email da conta; ligacao — o
// URL de reposição, completo e já assinado.
// Devolve: promessa de { enviado, motivo } — o que o enviarEmail disser.
export async function emailReporPassword(env, para, ligacao) {
  const c = cartaReporPassword(ligacao);
  return enviarEmail(env, { para, remetente: 'maquina', assunto: c.assunto, html: c.html, texto: c.texto });
}

/* O email «Confirma o teu email», no molde do repor: o botão com a ligação,
   a ligação por extenso por baixo para quem a tiver de copiar, a validade
   (7 dias, a mesma janela em que a conta funciona sem confirmar) e o rodapé
   da conta. O «vale 7 dias e serve uma vez» é garantido por quem a criou
   (rotas/auth.js:pedirConfirmacao) — aqui só se escreve o envelope.
   Recebe: ligacao — o URL de confirmação, completo (…/?confirmar=<token>).
   Devolve: { assunto, html, texto } — o email pronto a enviar. */
export function cartaConfirmarEmail(ligacao) {
  const titulo = 'Confirma o teu email';
  const pedido = 'Criaste uma conta no Rendorium com este email. Confirma que é teu para continuares a usar a app ' +
    'e a receber os avisos por email.';
  const validade = 'A ligação vale 7 dias e serve uma vez. Passados os 7 dias, a app pede-te para confirmar antes de continuar.';
  const url = String(ligacao || '');
  return {
    assunto: titulo,
    texto: textoDoEmail([titulo, pedido, 'Confirmar o email:\n' + url, validade, RODAPE_CONTA]),
    html: molde({
      assunto: titulo,
      titulo,
      blocos: [
        paragrafo(escaparHtml(pedido)),
        botao(url, 'Confirmar o email'),
        paragrafo('Se o botão não abrir, copia esta ligação:<br><span class="rd-tinta" style="color:' + COR.tinta +
          ';word-break:break-all">' + escaparHtml(url) + '</span>', 'sub'),
        paragrafo(escaparHtml(validade)),
      ],
      rodape: RODAPE_CONTA,
    }),
  };
}

// O email «Confirma o teu email» (a cartaConfirmarEmail), enviado do no-reply.
// Uma conta de teste recebe-o no email do dev que a criou (enviarEmail).
// Recebe: env — o ambiente do worker; para — o email da conta; ligacao — o
// URL de confirmação, completo.
// Devolve: promessa de { enviado, motivo } — o que o enviarEmail disser.
export async function emailConfirmarEmail(env, para, ligacao) {
  const c = cartaConfirmarEmail(ligacao);
  return enviarEmail(env, { para, remetente: 'maquina', assunto: c.assunto, html: c.html, texto: c.texto });
}

/* A resposta da equipa a um pedido: o número e o assunto por cima, a
   resposta numa caixa, e o botão para a app. A resposta vai cortada a
   RESPOSTA_MAX caracteres nas DUAS versões (com reticências quando corta: o
   resto lê-se na app) e, no HTML, escapada — é texto da equipa, mas HTML de
   email não é sítio para surpresas.
   Recebe: env — o ambiente do worker (dá o endereço da app); assunto — o
   assunto do pedido original (cortado a 120 no assunto do email); resposta —
   o texto da equipa; id (opcional) — o id do pedido, para levar o número.
   Devolve: { assunto, html, texto } — o email pronto a enviar. */
export function cartaRespostaPedido(env, assunto, resposta, id) {
  const num = id ? numeroPedido(id) : '';
  const pedido = String(assunto || '').trim();
  const app = enderecoDaApp(env);
  const inteira = String(resposta || '').replace(/\r\n?/g, '\n');
  const corpo = inteira.length > RESPOSTA_MAX ? inteira.slice(0, RESPOSTA_MAX).trimEnd() + '…' : inteira;
  const referencia = [num, pedido].filter(Boolean).join(' · ');
  const titulo = 'Respondemos ao teu pedido';
  const naApp = 'Podes ver o histórico e responder na app, em Definições › Ajuda e sugestões.';
  const oAssunto = titulo + (num ? ' ' + num + ' ' : ': ') + String(assunto || '').slice(0, 120);
  return {
    assunto: oAssunto,
    texto: textoDoEmail([titulo, referencia, corpo, naApp, 'Ver na app: ' + app, RODAPE_PEDIDO]),
    html: molde({
      assunto: oAssunto,
      titulo,
      blocos: [
        referencia && paragrafo(escaparHtml(referencia), 'sub num'),
        corpo && caixa(escaparHtml(corpo).replace(/\n/g, '<br>')),
        paragrafo(escaparHtml(naApp)),
        botao(app, 'Ver na app'),
      ],
      rodape: RODAPE_PEDIDO,
    }),
  };
}

// A resposta da equipa a um pedido (a cartaRespostaPedido), enviada do
// support@ para a pessoa poder responder na mesma conversa.
// Recebe: env — o ambiente do worker; para — o email da pessoa; assunto — o
// assunto do pedido original; resposta — o texto da equipa; id (opcional) —
// o id do pedido, para levar o número.
// Devolve: promessa de { enviado, motivo } — o que o enviarEmail disser.
export async function emailRespostaPedido(env, para, assunto, resposta, id) {
  const c = cartaRespostaPedido(env, assunto, resposta, id);
  return enviarEmail(env, { para, remetente: 'suporte', assunto: c.assunto, html: c.html, texto: c.texto });
}

/* --------------------- os avisos dos planeados em atraso ------------------ */

// O espaço fino dos milhares e do «€», o mesmo da app (web/app/formato.js:SP).
const ESPACO_FINO = ' ';
// O que cada sentido do dinheiro diz ao lado do montante.
const SENTIDO = { in: 'a receber', out: 'a pagar' };

/* Uma data AAAA-MM-DD como a app a escreve (web/app/formato.js:dPT).
   Recebe: iso — a data (só os 10 primeiros caracteres contam).
   Devolve: 'dd/mm/aaaa', ou '' quando não é uma data. */
export function dataDoAviso(iso) {
  const t = String(iso || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + t.slice(0, 4) : '';
}

/* Um montante em euros como a app o escreve com duas casas
   (web/app/formato.js:money): milhares com espaço fino, vírgula decimal, o
   «€» no fim, e o menos tipográfico nos negativos.
   Recebe: v — o valor (número ou texto; o que não for número conta 0).
   Devolve: o texto, ex.: «1 250,50 €». */
export function montanteDoAviso(v) {
  const n = Number(v) || 0;
  const [inteira, decimal] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '−' : '') + inteira.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACO_FINO) + ',' + decimal + ESPACO_FINO + '€';
}

/* O sentido de um atraso dito ao lado do montante.
   Recebe: fluxo — 'in', 'out' ou outro (uma transferência não tem sentido).
   Devolve: 'a receber', 'a pagar' ou ''. */
function sentidoDoAviso(fluxo) {
  return Object.prototype.hasOwnProperty.call(SENTIDO, fluxo) ? SENTIDO[fluxo] : '';
}

/* Os atrasos de uma secção agrupados por casa, pela ordem em que chegam
   (quem chama já os ordenou). Agrupa pelo id da casa quando o há — duas
   casas com o mesmo nome não se juntam —, senão pelo nome.
   Recebe: lista — [{ casa, casaId (opcional), descricao, data, montante,
   fluxo }], com casa já o nome a mostrar.
   Devolve: [{ casa, itens: [...] }]. */
function porCasa(lista) {
  const grupos = [];
  const onde = new Map();
  for (const a of lista || []) {
    const nome = String(a.casa || '');
    const chave = a.casaId != null ? 'id:' + a.casaId : 'nome:' + nome;
    if (!onde.has(chave)) { onde.set(chave, { casa: nome, itens: [] }); grupos.push(onde.get(chave)); }
    onde.get(chave).itens.push(a);
  }
  return grupos;
}

/* Uma linha de atraso em texto: a descrição, a data e o montante com o sentido.
   Recebe: a — o atraso ({ descricao, data, montante, fluxo }).
   Devolve: a linha, ex.: «- Renda · previsto para 01/10/2026 · 750,00 € a receber». */
function linhaDoAviso(a) {
  const sentido = sentidoDoAviso(a.fluxo);
  return '- ' + String(a.descricao || '') + ' · previsto para ' + dataDoAviso(a.data) + ' · ' +
    montanteDoAviso(a.montante) + (sentido ? ' ' + sentido : '');
}

/* Uma casa da lista dos atrasos, em HTML: o nome por cima e uma linha por
   atraso — a descrição e a data à esquerda, o montante e o sentido à direita
   —, numa caixa com contorno como a da resposta da equipa.
   Recebe: grupo — { casa, itens } (o de porCasa).
   Devolve: a tabela da casa. */
function casaDoAviso(grupo) {
  const sec = 'font-family:' + LETRA + ';font-size:13px;line-height:1.5;color:' + COR.secundario;
  const linhas = grupo.itens.map((a, i) => {
    const filete = i ? 'border-top:1px solid ' + COR.contorno + ';' : '';
    const sentido = sentidoDoAviso(a.fluxo);
    return '<tr><td class="rd-caixa rd-tinta" valign="top" style="' + filete + 'padding:10px 16px;font-family:' + LETRA +
      ';font-size:15px;line-height:1.4;color:' + COR.tinta + ';overflow-wrap:anywhere;word-break:break-word">' +
      escaparHtml(a.descricao) + '<br><span class="rd-sec" style="' + sec + '">Previsto para ' + escaparHtml(dataDoAviso(a.data)) + '</span></td>' +
      '<td class="rd-caixa rd-tinta" valign="top" align="right" style="' + filete + 'padding:10px 16px 10px 0;font-family:' + LETRA +
      ';font-size:15px;line-height:1.4;font-weight:600;color:' + COR.tinta + ';white-space:nowrap;font-variant-numeric:tabular-nums">' +
      escaparHtml(montanteDoAviso(a.montante)) +
      (sentido ? '<br><span class="rd-sec" style="' + sec + ';font-weight:400">' + escaparHtml(sentido) + '</span>' : '') + '</td></tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="rd-caixa" style="border-collapse:separate;border-spacing:0;border:1px solid ' +
    COR.contorno + ';border-radius:12px">' +
    '<tr><td colspan="2" class="rd-sec" style="padding:12px 16px 2px;' + sec + ';font-weight:600;overflow-wrap:anywhere;word-break:break-word">' +
    escaparHtml(grupo.casa) + '</td></tr>' + linhas + '</table>';
}

/* O resumo diário dos movimentos planeados em atraso: os novos (os que nunca
   foram num email a esta pessoa) e, quando os há, os que continuam em atraso,
   cada secção agrupada por casa, com a descrição, a data em que devia ter
   acontecido e o montante; o botão «Abrir os Planeados» e, no rodapé, a
   ligação para desligar os avisos nas Definições. Os títulos das secções
   concordam com o número («Novo em atraso» / «Novos em atraso»).
   Recebe: env — o ambiente do worker (dá o endereço da app); novos e
   continuam — arrays de { casa (o nome a mostrar), casaId (opcional: agrupa
   por ele), descricao, data
   (AAAA-MM-DD), montante (número), fluxo ('in', 'out' ou outro) }, já
   ordenados.
   Devolve: { assunto, html, texto } — o email pronto a enviar. */
export function cartaAtrasos(env, novos, continuam) {
  const lnovos = novos || [];
  const lcont = continuam || [];
  const n = lnovos.length + lcont.length;
  const assunto = n === 1 ? 'Tens um movimento em atraso' : 'Tens ' + n + ' movimentos em atraso';
  const app = enderecoDaApp(env);
  const planeados = app + '/?planeados';
  const avisos = app + '/?avisos';
  const intro = n === 1
    ? 'Este movimento planeado passou a data e ainda não está confirmado na app.'
    : 'Estes movimentos planeados passaram a data e ainda não estão confirmados na app.';
  const seccoes = [
    { titulo: lnovos.length === 1 ? 'Novo em atraso' : 'Novos em atraso', grupos: porCasa(lnovos) },
    { titulo: lcont.length === 1 ? 'Continua em atraso' : 'Continuam em atraso', grupos: porCasa(lcont) },
  ].filter((s) => s.grupos.length);
  const pergunta = 'Não queres estes avisos?';
  const desliga = 'Desliga-os nas Definições';
  const tituloDe = (s) => '<strong class="rd-tinta" style="font-family:' + LETRA_TITULO + ';font-size:16px;color:' + COR.tinta + '">' +
    escaparHtml(s.titulo) + '</strong>';
  return {
    assunto,
    texto: textoDoEmail([
      assunto,
      intro,
      ...seccoes.map((s) => [s.titulo, ...s.grupos.map((g) => g.casa + '\n' + g.itens.map(linhaDoAviso).join('\n'))].join('\n\n')),
      'Abrir os Planeados: ' + planeados,
      pergunta + ' ' + desliga + ': ' + avisos,
    ]),
    html: molde({
      assunto,
      titulo: assunto,
      blocos: [
        paragrafo(escaparHtml(intro)),
        ...seccoes.flatMap((s) => [paragrafo(tituloDe(s)), ...s.grupos.map(casaDoAviso)]),
        botao(planeados, 'Abrir os Planeados'),
      ],
      rodapeHtml: escaparHtml(pergunta) + ' <a href="' + escaparHtml(avisos) + '" target="_blank" style="color:' + COR.cobalto +
        ';text-decoration:underline">' + escaparHtml(desliga) + '</a>.',
    }),
  };
}

// O resumo dos planeados em atraso (a cartaAtrasos), enviado do no-reply.
// Recebe: env — o ambiente do worker; para — o email da pessoa; novos e
// continuam — os atrasos, como a cartaAtrasos os recebe.
// Devolve: promessa de { enviado, motivo } — o que o enviarEmail disser.
export async function emailAtrasos(env, para, novos, continuam) {
  const c = cartaAtrasos(env, novos, continuam);
  return enviarEmail(env, { para, remetente: 'maquina', assunto: c.assunto, html: c.html, texto: c.texto });
}
