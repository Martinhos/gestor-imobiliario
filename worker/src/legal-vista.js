/* Os Termos e a Política de Privacidade, em público.
   -------------------------------------------------
   Viviam só dentro da app, em Definições → Aviso legal. Quem chega ao site e
   quer saber a quem está a entregar os dados dos seus inquilinos tinha de
   criar conta primeiro — e é precisamente antes de criar conta que a pergunta
   se faz.

   O texto NÃO é copiado para aqui. A página carrega o mesmo /legal.js que a
   app carrega e escreve o que ele traz: uma só fonte de verdade, e nunca duas
   versões do mesmo contrato a divergirem em silêncio. O preço é o documento
   ser escrito pelo browser; o <noscript> diz onde encontrá-lo à mesma.

   A cara é a da página de entrada, e o texto usa as mesmas medidas que a app
   lhe dá (cloud/partilha.js:lgCss) — o mesmo documento não pode ler-se de
   duas maneiras conforme a porta por onde se entra. */

const APP = 'https://app.rendorium.com';

const DOCS = {
  termos: {
    campo: 'termos',
    titulo: 'Termos e Condições',
    sub: 'O acordo entre ti e quem opera o serviço',
    outro: ['/privacidade', 'Política de Privacidade'],
  },
  privacidade: {
    campo: 'privacidade',
    titulo: 'Política de Privacidade',
    sub: 'Que dados tratamos, porquê e por quanto tempo',
    outro: ['/termos', 'Termos e Condições'],
  },
};

/* A página de um dos dois documentos.
   Recebe: qual — 'termos' ou 'privacidade'.
   Devolve: uma Response HTML, ou undefined se o nome não for de nenhum deles. */
export function paginaLegal(qual) {
  const d = DOCS[qual];
  if (!d) return undefined;
  const html = `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${d.titulo} — Rendorium</title>
<meta name="description" content="${d.sub}. Rendorium, gestão de arrendamento para senhorios portugueses.">
<meta name="robots" content="index,follow">
<link rel="icon" href="/icon-192.png">
<link rel="canonical" href="https://rendorium.com/${qual}">
<style>
:root{color-scheme:light dark;
  --bg:#f7f8fa;--card:#fff;--ink:#17221d;--muted:#5a635e;--line:#e7ebe8;
  --accent:#244c3b;--accent-ink:#fff}
@media(prefers-color-scheme:dark){:root{
  --bg:#12141b;--card:#1b1e28;--ink:#eef0f6;--muted:#9aa3b8;--line:#2b3040;
  --accent:#5ee0a8;--accent-ink:#0b1410}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  font-size:16px;line-height:1.6;-webkit-text-size-adjust:100%}
.wrap{max-width:760px;margin:0 auto;padding:0 22px}
header{display:flex;align-items:center;gap:11px;padding:18px 0;border-bottom:1px solid var(--line)}
.logo{width:34px;height:34px;border-radius:10px;background:var(--accent);color:var(--accent-ink);
  display:grid;place-items:center;font-weight:800;font-size:17px;flex:0 0 auto}
.marca{font-weight:750;font-size:16px;letter-spacing:-.01em}
.marca a{color:inherit;text-decoration:none}
.spacer{flex:1}
a.btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 16px;border-radius:11px;
  border:1px solid var(--line);background:var(--card);color:var(--ink);text-decoration:none;
  font-weight:650;font-size:14px;min-height:40px}
h1{font-size:clamp(26px,4vw,34px);line-height:1.15;letter-spacing:-.02em;margin:34px 0 6px}
.sub{color:var(--muted);margin:0 0 26px}
/* as mesmas medidas que a app dá a estes documentos (cloud/partilha.js) */
.lg{max-width:70ch;line-height:1.68;font-size:15.5px;color:var(--ink)}
.lg p{margin:0 0 12px}
.lg ul{margin:0 0 14px;padding-left:20px}
.lg li{margin:0 0 7px}
.lg .lg-h{font-size:17px;font-weight:650;margin:30px 0 10px;letter-spacing:-.01em}
.lg a{color:var(--ink)}
.aviso{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;
  color:var(--muted);font-size:15px}
footer{margin-top:44px;padding:22px 0 44px;border-top:1px solid var(--line);
  font-size:14px;color:var(--muted);display:flex;gap:18px;flex-wrap:wrap;align-items:center}
footer a{color:var(--muted)}
footer a:hover{color:var(--ink)}
</style></head><body>
<div class="wrap">
  <header>
    <span class="logo">R</span><span class="marca"><a href="/">Rendorium</a></span>
    <span class="spacer"></span>
    <a class="btn" href="${APP}">Abrir a app</a>
  </header>

  <h1>${d.titulo}</h1>
  <p class="sub">${d.sub}</p>

  <div class="lg" id="doc"></div>
  <noscript>
    <div class="aviso">Este documento é escrito pelo browser a partir do mesmo ficheiro que a
    aplicação usa, para não haver duas versões do mesmo contrato. Sem JavaScript não dá para o
    mostrar aqui — podes lê-lo dentro da app, em <b>Definições → Aviso legal</b>, ou pedir-nos
    uma cópia por email.</div>
  </noscript>

  <footer>
    <span>© ${new Date().getFullYear()} Rendorium</span>
    <a href="/">Início</a>
    <a href="${d.outro[0]}">${d.outro[1]}</a>
    <a href="${APP}">Abrir a app</a>
  </footer>
</div>
<script src="/legal.js"></script>
<script>
(function () {
  var L = window.LEGAL;
  if (!L) return;
  // a data não se escreve aqui: o próprio documento abre com «Em vigor desde»
  document.getElementById('doc').innerHTML = L.${d.campo} || '';
})();
</script>
</body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // como a landing: muda quando se publica, não por pedido
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
