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

   A cara é a da página de entrada (landing.js), na linguagem nova da app: o
   cabeçalho de vidro com a marca, a Geist no corpo e a Bricolage Grotesque
   nos títulos, auto-alojadas em /fonts/, o cobalto nas ligações, o fundo
   #F2F3F6 e o documento num cartão branco — e o tema escuro de quem lê. O
   texto usa as medidas de leitura que a app lhe dá — o mesmo documento não
   pode ler-se de duas maneiras conforme a porta por onde se entra. */

import { CSP_ESTRITA } from './lib/http.js';

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

   Fora do domínio raiz é uma pré-visualização: leva `noindex`, não declara
   canonical, e o «início» aponta para /montra — ali a raiz é a app.
   Recebe: qual — 'termos' ou 'privacidade'; op — {raiz: true} quando está a
   ser servido em rendorium.com.
   Devolve: uma Response HTML, ou undefined se o nome não for de nenhum deles. */
export function paginaLegal(qual, op) {
  const d = DOCS[qual];
  if (!d) return undefined;
  const raiz = !!(op && op.raiz);
  const inicio = raiz ? '/' : '/montra';
  const cabecaRaiz = raiz
    ? `<meta name="robots" content="index,follow">
<link rel="canonical" href="https://rendorium.com/${qual}">`
    : '<meta name="robots" content="noindex,nofollow">';
  const html = `<!doctype html>
<html lang="pt-PT"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F2F3F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B111E" media="(prefers-color-scheme: dark)">
<title>${d.titulo} — Rendorium</title>
<meta name="description" content="${d.sub}. Rendorium, gestão de arrendamento para senhorios portugueses.">
${cabecaRaiz}
<link rel="icon" href="/icon-192.png">
<link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/paginas/legal.css">
</head><body>
<div class="faixa-topo">
  <header>
    <a class="marca" href="${inicio}"><span class="mark" aria-hidden="true"></span><span>Rendorium</span></a>
    <a class="btn" href="${APP}">Abrir a app</a>
  </header>
</div>
<main class="wrap">
  <h1>${d.titulo}</h1>
  <p class="sub">${d.sub}</p>

  <div class="lg documento" id="doc" data-campo="${d.campo}"></div>
  <noscript>
    <div class="aviso">Este documento é escrito pelo browser a partir do mesmo ficheiro que a
    aplicação usa, para não haver duas versões do mesmo contrato. Sem JavaScript não dá para o
    mostrar aqui — podes lê-lo dentro da app, em <b>Definições → Aviso legal</b>, ou pedir-nos
    uma cópia por email.</div>
  </noscript>
</main>
<footer class="wrap">
  <span class="rodape-marca"><span class="mark" aria-hidden="true"></span><span>© ${new Date().getFullYear()} Rendorium</span></span>
  <a href="${inicio}">Início</a>
  <a href="${d.outro[0]}">${d.outro[1]}</a>
  <a href="${APP}">Abrir a app</a>
</footer>
<script src="/legal.js"></script>
<script src="/paginas/documento.js"></script>
</body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CSP_ESTRITA,
      // a página muda quando se publica, não por pedido — mas a
      // pré-visualização existe precisamente para ver alterações, e uma hora
      // de cache fazia-a mentir durante uma hora
      'Cache-Control': raiz ? 'public, max-age=3600' : 'no-store',
    },
  });
}

/* Os estilos das duas páginas, servidos à parte em /paginas/legal.css
   (paginas-recursos.js): a página vai com a CSP_ESTRITA, que não aplica uma
   folha escrita dentro do próprio HTML (a etiqueta de estilo em linha). */
export const CSS_LEGAL = `/* As letras da app, auto-alojadas (a CSP só deixa font-src 'self'): as
   mesmas declarações do CSS_LANDING (landing.js) e do CSS_TESTE (teste.js),
   e um teste confere que as três não divergem. */
@font-face{font-family:'Geist';src:url(/fonts/geist.woff2) format('woff2');font-weight:100 900;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Bricolage Grotesque';src:url(/fonts/bricolage-grotesque.woff2) format('woff2');font-weight:200 800;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}

/* os tokens da app (o contrato do redesign) que estas páginas usam; a marca
   é cobalto nos dois temas, porque é a marca e não um estado */
:root{color-scheme:light dark;
  --bg:#F2F3F6;--card:#FFFFFF;--tint:#F6F7F9;--ink:#121826;--muted:#4F586B;--line:#E2E5EB;--line2:#CDD2DB;
  --accent:#2952D9;--accent-text:#1D3FB0;--blur:rgba(242,243,246,.94);
  --marca:#2952D9;--marca-arco:#FFFFFF}
@media(prefers-color-scheme:dark){:root{
  --bg:#0B111E;--card:#141C2C;--tint:#1A2335;--ink:#E9EDF5;--muted:#AEB7C9;--line:#253049;--line2:#33405C;
  --accent:#7C9BFF;--accent-text:#B5C6FF;--blur:rgba(11,17,30,.92)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;
  padding:0 env(safe-area-inset-right) 0 env(safe-area-inset-left)}
a{color:var(--accent)}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}
.wrap{max-width:820px;margin:0 auto;padding-left:clamp(16px,4vw,32px);padding-right:clamp(16px,4vw,32px)}
/* acompanha o scroll, como na montra e como o cabeçalho da app: um documento
   legal é comprido, e a saída não pode ficar no princípio */
.faixa-topo{position:sticky;top:0;z-index:20;background:var(--blur);
  -webkit-backdrop-filter:blur(12px) saturate(140%);backdrop-filter:blur(12px) saturate(140%);
  border-bottom:1px solid var(--line)}
header{display:flex;align-items:center;gap:10px;max-width:820px;margin:0 auto;min-height:64px;
  padding:0 clamp(16px,4vw,32px)}
.marca{display:flex;align-items:center;gap:10px;min-height:44px;margin-right:auto;color:var(--ink);text-decoration:none;
  font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-weight:650;font-size:20px;letter-spacing:-.02em}
/* a marca da app: o quadrado cobalto com dois arcos brancos, em CSS (os arcos
   em percentagem do raio, para servir aos 30 e aos 22 px) */
.mark{display:block;flex:none;width:30px;height:30px;border-radius:8px;
  background:radial-gradient(circle at 0 0,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),
    radial-gradient(circle at 100% 100%,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),var(--marca)}
a.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:12px;
  border:1px solid var(--line2);background:var(--card);color:var(--ink);text-decoration:none;
  font-weight:600;font-size:15px;white-space:nowrap}
a.btn:focus-visible{border-radius:12px}
@media(hover:hover) and (pointer:fine){a.btn:hover{background:var(--tint)}}
h1{font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-weight:650;letter-spacing:-.02em;
  font-size:clamp(28px,4.4vw,40px);line-height:1.1;margin:40px 0 8px;text-wrap:balance}
.sub{color:var(--muted);margin:0 0 24px;font-size:17px}
/* o documento num cartão branco, com as medidas de leitura que a app lhe dá */
.documento{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:clamp(20px,4vw,40px)}
.documento:empty{display:none}
.lg{line-height:1.68;font-size:15.5px;color:var(--ink)}
.lg > *{max-width:70ch}
.lg p{margin:0 0 12px}
.lg ul{margin:0 0 14px;padding-left:20px}
.lg li{margin:0 0 7px}
.lg b{font-weight:600}
.lg .lg-h{font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-size:19px;font-weight:650;
  line-height:1.25;letter-spacing:-.015em;margin:32px 0 10px}
.lg a{color:var(--accent)}
.aviso{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;
  color:var(--muted);font-size:15px}
.aviso b{color:var(--ink);font-weight:600}
footer{display:flex;flex-wrap:wrap;align-items:center;gap:4px 20px;margin-top:40px;padding-top:20px;padding-bottom:44px;
  border-top:1px solid var(--line);font-size:15px}
.rodape-marca{display:flex;align-items:center;gap:8px;margin-right:auto;color:var(--muted)}
footer .mark{width:22px;height:22px;border-radius:6px}
footer a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none}
footer a:hover{color:var(--accent-text);text-decoration:underline}
@media(max-width:619px){.rodape-marca{flex-basis:100%}}
/* quem pediu menos transparência recebe o cabeçalho sólido, e quem pediu
   mais contraste recebe contornos e texto secundário que se veem */
@media(prefers-reduced-transparency:reduce){
  .faixa-topo{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}}
@media(prefers-contrast:more){:root{--line:#8A93A5;--line2:#6B7385;--muted:#384152}}
@media(prefers-contrast:more) and (prefers-color-scheme:dark){:root{--line:#56627D;--line2:#6E7A96;--muted:#C9D0DD}}
`;

/* O JavaScript das duas páginas, servido em /paginas/documento.js: escreve
   no #doc o documento que o /legal.js (o mesmo ficheiro da app, carregado
   antes) traz. Qual dos dois vai no data-campo do #doc — só estes dois
   nomes, e nunca uma propriedade qualquer do window.LEGAL. A data não se
   escreve aqui: o próprio documento abre com «Em vigor desde». */
export const GUIAO_LEGAL = String.raw`(function () {
  var L = window.LEGAL;
  var doc = document.getElementById('doc');
  if (!L || !doc) return;
  var campo = doc.getAttribute('data-campo');
  if (campo !== 'termos' && campo !== 'privacidade') return;
  doc.innerHTML = L[campo] || '';
})();
`;
