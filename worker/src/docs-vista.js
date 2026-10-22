/* A documentação da casa, servida em /equipa/docs.
   -------------------------------------------------
   Não se escreve documentação aqui: ela vem do próprio código — o
   comentário de abertura de cada ficheiro e o comentário de cada função,
   extraídos no deploy pelo scripts/gerar-docs.js e organizados por
   FUNCIONALIDADE. A página é para um programador que chegue de novo:
   gaveta de navegação à esquerda, o interface de cada função (assinatura
   + documentação) no meio, e uma pesquisa que atravessa tudo.

   É da equipa: pede a mesma sessão que o resto do /equipa. */

import { DOCS } from './docs-gerados.js';
import { CSP_ESTRITA } from './lib/http.js';

// Escapa &, < e > para HTML; null e undefined viram ''.
// Recebe: s — o valor a escapar (qualquer coisa; é convertido a string).
// Devolve: a string com &, < e > trocados pelas entidades HTML.
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// os comentários são prosa: quebras duplas separam parágrafos, simples
// juntam — e as linhas do guia de interface (Recebe/Devolve) ganham relevo
// Recebe: t — o texto do comentário (string).
// Devolve: HTML em string — um <p> por parágrafo.
const prosa = (t) => esc(t).split(/\n{2,}/)
  .filter(Boolean)
  .map((p) => '<p>' + p.replace(/\n/g, ' ') + '</p>').join('');

/* Parte o comentário de uma função nas suas três peças: o sumário (a prosa
   que explica o que faz), o Recebe e o Devolve. As etiquetas procuram-se no
   princípio de uma linha ou de uma frase — a palavra «devolve» no meio de
   uma explicação não é uma etiqueta.
   Recebe: doc — o comentário extraído do código (texto, pode ser vazio).
   Devolve: {sumario, recebe, devolve} — três textos, vazios quando faltam. */
function partesDoComentario(doc) {
  const t = String(doc || '');
  const acha = (etiqueta) => {
    const linha = new RegExp('(?:^|\\n)\\s*' + etiqueta + ':', 'i').exec(t);
    if (linha) return linha.index + (linha[0][0] === '\n' ? 1 : 0);
    const frase = new RegExp('(?:^|[.;)] )' + etiqueta + ':', 'i').exec(t);
    return frase ? frase.index + (frase[0].length - etiqueta.length - 1) : -1;
  };
  const iR = acha('Recebe');
  const iD = acha('Devolve');
  const corte = [iR, iD].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  const sumario = (corte == null ? t : t.slice(0, corte)).trim();
  const pedaco = (ini, fim) => ini < 0 ? ''
    : t.slice(ini, fim >= 0 && fim > ini ? fim : undefined).replace(/^\s*\w+:\s*/i, '').trim();
  // as quebras de linha do código-fonte não são quebras de sentido nos
  // campos: um parâmetro partido em duas linhas é uma frase só
  const junta = (x) => x.split(/\s+/).join(' ').trim();
  return {
    sumario,
    recebe: junta(pedaco(iR, iD)),
    devolve: junta(pedaco(iD, iR > iD ? iR : -1)),
  };
}

/* Os parâmetros de um «Recebe», um por linha. O formato escrito é
   «nome — o que é; outro — o que é», mas nem sempre: o que não tiver traço
   fica como está, numa linha só.
   Recebe: texto — o corpo do Recebe, sem a etiqueta.
   Devolve: lista de {nome, descricao} — o nome vazio quando não há traço. */
function paramsDe(texto) {
  if (!texto) return [];
  return texto.split(/;\s+(?=[\w$[{.]+ *(?:\(opcional\) *)?—)/)
    .map((p) => p.trim().replace(/[.;]$/, ''))
    .filter(Boolean)
    .map((p) => {
      // o «(opcional)» faz parte do nome do parâmetro, não da descrição
      const m = /^([\w$[\]{}., ]+?)(\s*\((?:opcional|opcionais)\))?\s+—\s+([\s\S]+)$/.exec(p);
      if (!m) return { nome: '', descricao: p };
      return { nome: m[1].trim(), opcional: !!m[2], descricao: m[3].trim() };
    });
}

/* Monta a página inteira — gaveta, comandos, capítulos e pesquisa — a partir
   do DOCS gerado no deploy. Cada função aparece em quatro peças distintas:
   assinatura, sumário, Recebe e Devolve. O conteúdo vai todo na página — só
   o CSS_DOCS e o GUIAO_DOCS vêm à parte (/equipa/docs.css e /equipa/docs.js,
   por causa da CSP_ESTRITA) — e a pesquisa corre no browser sobre o DOM.
   Devolve: o HTML da página completa (texto). */
function montarPagina() {
  let nFn = 0;

  const capitulos = (DOCS.capitulos || []).map((c) => {
    const itens = c.itens.map((x) => {
      const fns = (x.funcoes || []).map((f) => {
        nFn++;
        const p = partesDoComentario(f.doc);
        const linhas = paramsDe(p.recebe).map((a) =>
          `<div class="param">${a.nome ? '<code>' + esc(a.nome) + '</code> ' : ''}` +
          `${a.opcional ? '<span class="opc">opcional</span> ' : ''}<span>${esc(a.descricao)}</span></div>`).join('');
        return `<div class="fn" id="fn_${nFn}">
          <div class="ass"><code>${esc(f.assinatura || f.nome)}</code></div>
          ${p.sumario ? '<div class="sum">' + prosa(p.sumario) + '</div>'
            : '<div class="sum"><p class="semdoc">Sem comentário — lê a implementação antes de usar.</p></div>'}
          ${p.recebe ? '<div class="io"><span class="rot">Recebe</span><div class="val">' + linhas + '</div></div>' : ''}
          ${p.devolve ? '<div class="io"><span class="rot">Devolve</span><div class="val">' + esc(p.devolve) + '</div></div>' : ''}
        </div>`;
      }).join('');
      const resumo = (x.texto || '').split('\n')[0].slice(0, 110);
      return `<details class="fich" data-nome="${esc(x.nome)}">
        <summary><code>${esc(x.nome)}</code>${resumo ? ' — ' + esc(resumo) : ''}</summary>
        <div class="corpo">${x.texto ? prosa(x.texto) : ''}${fns}</div>
      </details>`;
    }).join('');
    return `<section class="cap" id="cap_${esc(c.id)}"><h2>${esc(c.titulo)}</h2>${itens}</section>`;
  }).join('');

  const comandos = (DOCS.comandos || []).map((c) => {
    const opts = (c.opcoes || []).map((o) =>
      `<div class="opt"><code>${esc(o.nome)}</code> <span class="otipo">${esc(o.tipo)}${o.obrigatoria ? ' · obrigatória' : ''}</span>
       — ${esc(o.descricao)}${o.escolhas && o.escolhas.length ? ' <span class="otipo">(escolhas: ' + esc(o.escolhas.join(', ')) + ')</span>' : ''}</div>`
    ).join('');
    return `<div class="fich cmdcard">
      <div class="cmdtop"><code>/${esc(c.nome)}</code><span class="quem">${esc(c.quem)}</span></div>
      <p class="cdesc">${esc(c.descricao)}</p>
      ${opts ? '<div class="opts">' + opts + '</div>' : ''}
      <div class="oq">${prosa(c.oQueFaz || '')}</div>
    </div>`;
  }).join('');

  const gaveta = `<a data-cap="cmd" href="#cmd">Comandos do Discord</a>` +
    (DOCS.capitulos || []).map((c) => `<a data-cap="cap_${esc(c.id)}" href="#${esc(c.id)}">${esc(c.titulo)}</a>`).join('');

  // a marca da ferramenta da equipa, igual à do back office (equipa-vista.js)
  const marca = '<span class="mark" aria-hidden="true"></span><span class="eq-nome">Rendorium</span><span class="eq-selo">Equipa</span>';
  const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

  const html = `<!doctype html><html lang="pt-PT"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="theme-color" content="#161A23"><title>Documentação · Rendorium Equipa</title>
<link rel="stylesheet" href="/equipa/docs.css">
</head><body>
<header class="topo">
  <button class="burger" type="button" aria-label="Abrir os capítulos" aria-expanded="false" aria-controls="gaveta">${svg('M4 7h16M4 12h16M4 17h16')}</button>
  ${marca}
</header>
<div class="app">
<aside id="gaveta">
  <div class="marca">${marca}</div>
  <a class="voltar" href="/equipa">${svg('M15 6l-6 6 6 6')}<span>Voltar ao back office</span></a>
  <h1>Como isto funciona</h1>
  <label class="procura">${svg('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4')}<input id="q" type="search" placeholder="Pesquisar…" autocomplete="off" aria-label="Pesquisar na documentação"></label>
  <nav id="nav" aria-label="Capítulos">${gaveta}</nav>
</aside>
<main>
  <section class="painel" id="resultados"><h2>Resultados</h2><div id="lista"></div></section>
  <section class="cap" id="cmd"><h2>Comandos do Discord</h2>${comandos}</section>
  ${capitulos}
</main>
</div>
<script src="/equipa/docs.js"></script>
</body></html>`;

  return html;
}

/* A página pronta. É igual para toda a equipa e só muda com o DOCS, que só
   muda num deploy (e um deploy traz isolates novos) — mas montá-la custa 40
   a 90 ms de CPU, mil e tal funções e 1 MB de HTML, dez vezes o que o plano
   gratuito dá a um pedido. Monta-se na primeira vez que este isolate a
   serve e guarda-se; os pedidos seguintes só a entregam. */
let paginaPronta = null;

/* A documentação da casa, em /equipa/docs (a sessão de equipa já foi
   verificada pelo index.js).
   Devolve: uma Response HTML sem cache com a página completa. */
export function paginaDocs() {
  if (paginaPronta === null) paginaPronta = montarPagina();
  return new Response(paginaPronta, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': CSP_ESTRITA,
    },
  });
}

/* Os estilos da página, servidos à parte em /equipa/docs.css
   (paginas-recursos.js, só com sessão de equipa, como a página): a página
   vai com a CSP_ESTRITA, que não aplica uma folha escrita dentro do próprio
   HTML (a etiqueta de estilo em linha). Veste a mesma família do back
   office: os tokens da app, a Geist e a Bricolage de /fonts/, e a gaveta
   grafite com a marca em ardósia e o selo «Equipa». */
export const CSS_DOCS = `/* As letras da app, servidas de /fonts/ (a CSP só deixa font-src 'self'). */
@font-face{font-family:'Geist';font-style:normal;font-weight:100 900;font-display:swap;
  src:url(/fonts/geist.woff2) format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Bricolage Grotesque';font-style:normal;font-weight:200 800;font-display:swap;
  src:url(/fonts/bricolage-grotesque.woff2) format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{color-scheme:light dark;
  --bg:#F2F3F6;--card:#FFFFFF;--chip:#F6F7F9;--tint:#F6F7F9;--ink:#121826;--muted:#4F586B;--faint:#687083;
  --line:#E2E5EB;--line2:#CDD2DB;--accent:#2952D9;--accent-soft:#E9EEFC;--accent-text:#1D3FB0;
  --warn-soft:#FFF1D1;--shadow:0 16px 40px rgba(16,24,40,.16);
  /* a gaveta da equipa: grafite e ardósia, nunca o azul-noite da app */
  --eq:#161A23;--eq-texto:#C3C8D3;--eq-fraco:#8A92A3;--eq-branco:#FFFFFF;--eq-hover:rgba(255,255,255,.06);
  --eq-on:rgba(255,255,255,.1);--eq-campo:rgba(255,255,255,.06);--eq-linha:#2A303D;--eq-selo:#2A303D;--eq-marca:#5B6478;
  --letra:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif;
  --letra-titulo:'Bricolage Grotesque','Geist',system-ui,sans-serif;
  --letra-mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  --rapido:.12s;--medio:.2s;--curva:cubic-bezier(.22,1,.36,1);--curva-entra:cubic-bezier(0,0,.2,1)}
@media(prefers-color-scheme:dark){:root{
  --bg:#0B111E;--card:#141C2C;--chip:#1A2335;--tint:#1A2335;--ink:#E9EDF5;--muted:#AEB7C9;--faint:#8C96AB;
  --line:#253049;--line2:#33405C;--accent:#7C9BFF;--accent-soft:#1E2A4D;--accent-text:#B5C6FF;
  --warn-soft:#352A12;--shadow:0 24px 60px rgba(0,0,0,.6)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--letra);font-size:15px;line-height:1.55;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.i{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
/* a marca: o quadrado em ardósia com dois arcos brancos em cantos opostos */
.mark{width:28px;height:28px;border-radius:8px;flex:none;
  background:radial-gradient(circle at 0 0,transparent 9px,var(--eq-branco) 9.5px,var(--eq-branco) 12px,transparent 12.5px),
    radial-gradient(circle at 100% 100%,transparent 9px,var(--eq-branco) 9.5px,var(--eq-branco) 12px,transparent 12.5px),var(--eq-marca)}
.eq-nome{font-family:var(--letra-titulo);font-weight:650;letter-spacing:-.015em;font-size:18px;color:var(--eq-branco)}
.eq-selo{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:12px;font-weight:600;background:var(--eq-selo);color:var(--eq-texto)}
.app{display:grid;grid-template-columns:288px minmax(0,1fr);min-height:100vh;min-height:100dvh}
/* a gaveta: grafite, colada à esquerda, com a marca, o caminho de volta, a pesquisa e os capítulos */
aside{position:sticky;top:0;height:100vh;height:100dvh;overflow:auto;background:var(--eq);color:var(--eq-texto);
  padding:20px 14px;display:flex;flex-direction:column;gap:10px}
.marca{display:flex;align-items:center;gap:10px;padding:0 8px 8px}
.voltar{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 10px;border-radius:10px;color:var(--eq-texto);text-decoration:none;font-size:14px;font-weight:500}
.voltar:hover{background:var(--eq-hover);color:var(--eq-branco)}
aside h1{font-family:var(--letra-titulo);font-weight:650;letter-spacing:-.015em;font-size:16px;color:var(--eq-branco);margin:8px 10px 0}
.procura{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border-radius:12px;border:1px solid var(--eq-linha);
  background:var(--eq-campo);color:var(--eq-fraco)}
.procura:focus-within{border-color:var(--eq-texto)}
#q{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--eq-branco);font:inherit;font-size:14px;min-height:42px;-webkit-appearance:none;appearance:none}
#q::placeholder{color:var(--eq-fraco)}
nav{display:flex;flex-direction:column;gap:2px}
nav a{display:flex;align-items:center;min-height:38px;padding:6px 12px;border-radius:10px;color:var(--eq-texto);text-decoration:none;font-size:14px;font-weight:500;
  transition:background-color var(--rapido) var(--curva)}
nav a:hover:not(.on){background:var(--eq-hover);color:var(--eq-branco)}
nav a.on{background:var(--eq-on);color:var(--eq-branco);font-weight:600}
aside a:focus-visible{outline-color:var(--eq-branco);outline-offset:-2px}
.topo{display:none}
main{padding:28px clamp(16px,3vw,36px) 64px;min-width:0;max-width:920px}
h2{font-family:var(--letra-titulo);font-weight:650;font-size:32px;letter-spacing:-.015em;line-height:1.2;margin:0 0 18px}
.cap,.painel{display:none}.cap.on,.painel.on{display:block}
/* o guião escreve o capítulo no #hash, e o browser salta para ele ao acabar de ler a página:
   com a margem, o salto para no cimo em vez de cortar o título */
.cap,.painel{scroll-margin-top:28px}
code{background:var(--chip);border-radius:6px;padding:1px 6px;font-size:.88em;font-family:var(--letra-mono);overflow-wrap:anywhere}
/* os ficheiros e os comandos: cartões, como na app */
.fich{background:var(--card);border:1px solid var(--line);border-radius:16px;margin-bottom:10px}
.fich summary{padding:14px 18px;cursor:pointer;font-size:14px;color:var(--muted);border-radius:16px}
.fich summary:hover{background:var(--tint)}
.fich summary code{color:var(--ink);font-weight:600}
.corpo{padding:4px 18px 14px;font-size:14.5px}
.corpo>p{margin:0 0 10px;color:var(--muted)}
.cmdcard{padding:16px 18px}
.cmdtop{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cmdtop code{font-weight:600;color:var(--ink)}
.cmdtop .quem{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:var(--accent-soft);color:var(--accent-text);font-size:12px;font-weight:600;margin-left:auto}
.cdesc{margin:8px 0;font-size:14.5px}
.opts{border-left:2px solid var(--line2);padding-left:12px;margin:0 0 10px;display:grid;gap:6px}
.opt{font-size:14px;color:var(--muted)}
.otipo{font-size:12px;color:var(--muted);background:var(--chip);border-radius:6px;padding:1px 6px}
.oq{font-size:14px;color:var(--muted)}
.oq p{margin:0 0 8px}
/* cada função: a assinatura, o sumário, e o Recebe e o Devolve como campos etiquetados */
.fn{border-top:1px solid var(--line);padding:14px 0}
.fn .ass{margin-bottom:8px}
.fn .ass code{display:inline-block;background:var(--chip);padding:5px 10px;border-radius:8px;font-size:12.5px;font-weight:600;color:var(--ink)}
.fn .sum{margin-bottom:10px}
.fn .sum p{margin:0 0 7px}
/* Recebe e Devolve como campos etiquetados: a etiqueta à esquerda em ecrã
   largo, por cima no telemóvel — em ambos os casos, separada do sumário. */
.fn .io{display:grid;grid-template-columns:78px 1fr;gap:10px;align-items:baseline;padding:6px 0 6px 12px;border-left:2px solid var(--accent);margin-bottom:6px}
.fn .rot{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent-text)}
.fn .val{font-size:14px;color:var(--muted);min-width:0}
.fn .param{margin-bottom:4px}
.fn .param:last-child{margin-bottom:0}
.fn .param code{color:var(--ink);font-size:12.5px}
.fn .param .opc{font-size:11px;text-transform:uppercase;letter-spacing:.05em;background:var(--chip);border-radius:6px;padding:1px 5px;margin-right:3px}
@media(max-width:560px){.fn .io{grid-template-columns:1fr;gap:3px}}
.fn.marca{background:var(--warn-soft);border-radius:10px;padding:12px;margin:0 -12px}
.semdoc{color:var(--muted);font-style:italic}
/* os resultados da pesquisa */
.res{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin-bottom:8px;cursor:pointer;font-size:14px;
  transition:border-color var(--rapido) var(--curva)}
.res .onde{color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
.res:hover{border-color:var(--accent)}
/* a pesquisa sem resultados */
.nada{color:var(--muted)}
.burger{display:none}
/* no telemóvel a gaveta sai de lado, e no topo fica uma faixa grafite com o botão e a marca */
@media(max-width:860px){
  .app{display:block}
  .topo{display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:4;background:var(--eq);padding:calc(8px + env(safe-area-inset-top)) 16px 8px 8px}
  .burger{display:inline-flex;width:44px;height:44px;border-radius:12px;border:0;background:transparent;color:var(--eq-branco);align-items:center;justify-content:center;cursor:pointer}
  .burger:hover{background:var(--eq-hover)}
  .burger:focus-visible{outline-color:var(--eq-branco)}
  aside{position:fixed;left:0;z-index:5;width:min(320px,86vw);transform:translateX(-102%);box-shadow:8px 0 32px rgba(0,0,0,.3);
    transition:transform var(--medio) var(--curva-entra)}
  aside.aberta{transform:none}
  main{padding:20px 16px 64px}
  h2{font-size:22px}
  .cap,.painel{scroll-margin-top:84px}
}
@media(pointer:coarse){nav a,.voltar{min-height:44px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition-duration:0s!important}}
`;

/* O JavaScript da página, servido em /equipa/docs.js (só com sessão de
   equipa): a gaveta, os capítulos e a pesquisa, sobre o próprio DOM. Os
   eventos ligam-se com addEventListener — a CSP_ESTRITA não corre um on…=
   escrito no HTML. É um String.raw: o que aqui está é o que o browser recebe. */
export const GUIAO_DOCS = String.raw`(function () {
  var nav = document.getElementById('nav');
  var q = document.getElementById('q');
  var caps = [].slice.call(document.querySelectorAll('.cap'));
  var res = document.getElementById('resultados'), lista = document.getElementById('lista');

  // o botão da gaveta, no telemóvel; tocar no texto, com ela aberta, fecha-a
  var gaveta = document.querySelector('aside'), burger = document.querySelector('.burger');
  function abreGaveta(sim) {
    gaveta.classList.toggle('aberta', sim);
    burger.setAttribute('aria-expanded', sim ? 'true' : 'false');
  }
  burger.addEventListener('click', function () { abreGaveta(!gaveta.classList.contains('aberta')); });
  document.querySelector('main').addEventListener('click', function () { if (gaveta.classList.contains('aberta')) abreGaveta(false); });

  /* o capítulo ativo vive no #hash: um refresh (ou uma ligação partilhada)
     volta ao mesmo sítio. O fechaGaveta distingue navegação a sério de
     restauros silenciosos — limpar a pesquisa não pode fechar a gaveta
     debaixo dos dedos de quem está a escrever nela. */
  var capAtual = 'cmd';
  function ativa(id, fechaGaveta) {
    if (!document.getElementById(id)) id = document.getElementById('cap_' + id) ? 'cap_' + id : 'cmd';
    capAtual = id;
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    res.classList.remove('on');
    caps.forEach(function (c) { c.classList.toggle('on', c.id === id); });
    [].forEach.call(nav.children, function (a) {
      var esta = a.dataset.cap === id;
      a.classList.toggle('on', esta);
      if (esta) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    if (fechaGaveta !== false) {
      abreGaveta(false);
      var m = document.querySelector('main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0);
    }
  }
  nav.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    e.preventDefault(); q.value = ''; ativa(a.dataset.cap);
  });

  /* o índice da pesquisa constrói-se do próprio DOM: cada função e cada
     ficheiro, com o capítulo a que pertencem — pesquisar é filtrar isto */
  var indice = [];
  caps.forEach(function (c) {
    if (c.id === 'cmd') {
      [].forEach.call(c.querySelectorAll('.cmdcard'), function (d) {
        indice.push({ el: d, cap: c.id, capNome: 'Comandos', rotulo: d.querySelector('code').textContent, texto: d.textContent.toLowerCase() });
      });
      return;
    }
    var capNome = c.querySelector('h2').textContent;
    [].forEach.call(c.querySelectorAll('.fich'), function (d) {
      indice.push({ el: d, cap: c.id, capNome: capNome, rotulo: d.dataset.nome, texto: d.textContent.toLowerCase() });
      [].forEach.call(d.querySelectorAll('.fn'), function (f) {
        indice.push({ el: f, cap: c.id, capNome: capNome, rotulo: f.querySelector('.ass').textContent.trim(), fich: d, texto: f.textContent.toLowerCase() });
      });
    });
  });

  // abrir um resultado: vai ao capítulo, abre o ficheiro e marca o sítio
  function abrirResultado(e2) {
    q.value = ''; ativa(e2.cap);
    if (e2.fich) e2.fich.open = true;
    if (e2.el.tagName === 'DETAILS') e2.el.open = true;
    e2.el.scrollIntoView({ block: 'center' });
    e2.el.classList.add('marca');
    setTimeout(function () { e2.el.classList.remove('marca'); }, 1800);
  }

  q.addEventListener('input', function () {
    var termo = q.value.trim().toLowerCase();
    if (termo.length < 2) { if (res.classList.contains('on')) ativa(capAtual, false); return; }
    caps.forEach(function (c) { c.classList.remove('on'); });
    [].forEach.call(nav.children, function (a) { a.classList.remove('on'); a.removeAttribute('aria-current'); });
    var vistos = 0;
    lista.innerHTML = '';
    for (var i = 0; i < indice.length && vistos < 60; i++) {
      if (indice[i].texto.indexOf(termo) < 0) continue;
      vistos++;
      var e = indice[i];
      var b = document.createElement('div');
      b.className = 'res';
      b.innerHTML = '<div class="onde">' + e.capNome + '</div><code>' + e.rotulo.replace(/</g, '&lt;') + '</code>';
      b.addEventListener('click', abrirResultado.bind(null, e));
      lista.appendChild(b);
    }
    if (!vistos) lista.innerHTML = '<p class="nada">Nada com «' + termo.replace(/</g, '&lt;') + '».</p>';
    res.classList.add('on');
  });

  ativa((location.hash || '').slice(1) || 'cmd', false);
})();
`;
