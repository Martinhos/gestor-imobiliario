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

/* O molde de todos os emails: simples, com a cara da app, e sempre com a
   versão em texto — há caixas de correio que só mostram isso.
   Recebe: titulo — o título dentro do cartão; corpoHtml — o corpo, já em
   HTML; rodape (opcional) — o texto pequeno do fim (por omissão, o aviso de
   quem tem conta).
   Devolve: o HTML completo do email, como texto. */
export function molde(titulo, corpoHtml, rodape) {
  return `<!doctype html><html lang="pt"><body style="margin:0;padding:0;background:#f4f6f4">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a231e">
    <div style="font-weight:800;font-size:17px;margin-bottom:18px">
      <span style="display:inline-block;width:26px;height:26px;border-radius:8px;background:#244c3b;color:#fff;text-align:center;line-height:26px;margin-right:8px">R</span>Rendorium</div>
    <div style="background:#fff;border:1px solid #e3e9e4;border-radius:14px;padding:22px 24px">
      <h1 style="font-size:18px;margin:0 0 12px">${titulo}</h1>
      <div style="font-size:14.5px;line-height:1.65">${corpoHtml}</div>
    </div>
    <div style="font-size:12px;color:#5c6862;margin-top:14px;line-height:1.6">${rodape ||
      'Recebeste este email porque tens uma conta no Rendorium. Se não foste tu, ignora — nada acontece sem o teu clique.'}</div>
  </div></body></html>`;
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

// A confirmação automática de que um pedido de ajuda ficou registado, com o
// número que a pessoa pode citar em qualquer canal. Devolve o resultado do enviarEmail.
// Recebe: env — o ambiente do worker; para — o email da pessoa; id — o id do
// pedido (dá o número); assunto — o assunto que a pessoa escreveu.
// Devolve: promessa de { enviado, motivo } — o que o enviarEmail disser.
export async function emailPedidoRecebido(env, para, id, assunto) {
  const num = numeroPedido(id);
  return enviarEmail(env, {
    para,
    remetente: 'maquina',
    assunto: 'Recebemos o teu pedido ' + num,
    texto: 'O teu pedido «' + assunto + '» chegou e tem o número ' + num + '.\n\n' +
      'Vamos responder-te por email; também podes acompanhar e responder na app, ' +
      'em Definições → Ajuda e sugestões.',
    html: molde('Recebemos o teu pedido ' + num,
      `<p style="margin:0 0 10px;color:#5c6862">${String(assunto || '').replace(/</g, '&lt;')}</p>
       <p style="margin:0 0 14px">Chegou e ficou registado com o número <b>${num}</b>.
       Vamos responder-te por email.</p>
       <p style="margin:0">Podes acompanhar e responder na app, em
       <b>Definições → Ajuda e sugestões</b>.</p>`,
      'Recebeste este email porque escreveste um pedido de ajuda no Rendorium. Responder a este email também funciona — cai na nossa caixa de suporte.'),
  });
}

// O email de reset de palavra-passe: entrega a `ligacao` já pronta. O "vale
// 1 hora, uma vez" é garantido por quem a criou — aqui só se escreve o envelope.
// Recebe: env — o ambiente do worker; para — o email da conta; ligacao — o
// URL de reposição, completo e já assinado.
// Devolve: promessa de { enviado, motivo } — o que o enviarEmail disser.
export async function emailReporPassword(env, para, ligacao) {
  return enviarEmail(env, {
    para,
    remetente: 'maquina',
    assunto: 'Repor a tua palavra-passe',
    texto: 'Para definires uma palavra-passe nova, abre esta ligação (vale 1 hora, uma só vez):\n\n' +
      ligacao + '\n\nSe não pediste isto, ignora este email — nada muda sem o teu clique.',
    html: molde('Repor a tua palavra-passe',
      `<p style="margin:0 0 14px">Pediste para repor a palavra-passe da tua conta. A ligação vale
       <b>1 hora</b> e serve <b>uma vez</b>:</p>
       <p style="margin:0 0 14px"><a href="${ligacao}" style="display:inline-block;background:#244c3b;color:#fff;
       text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Definir palavra-passe nova</a></p>
       <p style="margin:0;color:#5c6862;font-size:13px">Se o botão não abrir, copia a ligação:<br>${ligacao}</p>`),
  });
}

/* A resposta da equipa a um pedido, enviada do support@ para a pessoa poder
   responder na mesma conversa. A `resposta` vai cortada a 1500 caracteres e
   escapada — é texto da equipa, mas HTML de email não é sítio para surpresas.
   Recebe: env — o ambiente do worker; para — o email da pessoa; assunto — o
   assunto do pedido original (cortado a 120 no assunto do email); resposta —
   o texto da equipa; id (opcional) — o id do pedido, para levar o número.
   Devolve: promessa de { enviado, motivo } — o que o enviarEmail disser. */
export async function emailRespostaPedido(env, para, assunto, resposta, id) {
  const num = id ? numeroPedido(id) + ' ' : '';
  const seguro = String(resposta || '').slice(0, 1500)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return enviarEmail(env, {
    para,
    remetente: 'suporte',
    assunto: 'Respondemos ao teu pedido ' + (num || ': ') + String(assunto || '').slice(0, 120),
    texto: 'Respondemos ao teu pedido ' + num + '«' + assunto + '»:\n\n' + resposta +
      '\n\nPodes ver e responder na app, em Definições → Ajuda e sugestões.',
    html: molde('Respondemos ao teu pedido ' + num,
      `<p style="margin:0 0 10px;color:#5c6862">${String(assunto || '').replace(/</g, '&lt;')}</p>
       <div style="background:#f0f5f1;border-radius:10px;padding:14px 16px;margin:0 0 14px">${seguro}</div>
       <p style="margin:0">Podes ver o histórico e responder na app, em
       <b>Definições → Ajuda e sugestões</b>.</p>`,
      'Recebeste este email porque escreveste um pedido de ajuda no Rendorium. Responder a este email também funciona — cai na nossa caixa de suporte.'),
  });
}
