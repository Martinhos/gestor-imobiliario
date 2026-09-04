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

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// os comentários são prosa: quebras duplas separam parágrafos, simples juntam
const prosa = (t) => esc(t).split(/\n{2,}/)
  .filter(Boolean)
  .map((p) => '<p>' + p.replace(/\n/g, ' ') + '</p>').join('');

export function paginaDocs() {
  let nFn = 0;

  const capitulos = (DOCS.capitulos || []).map((c) => {
    const itens = c.itens.map((x) => {
      const fns = (x.funcoes || []).map((f) => {
        nFn++;
        return `<div class="fn" id="fn_${nFn}">
          <code class="ass">${esc(f.assinatura || f.nome)}</code>
          <div class="doc">${f.doc ? prosa(f.doc) : '<p class="semdoc">Sem comentário — lê a implementação antes de usar.</p>'}</div>
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

  const comandos = (DOCS.comandos || []).map((c) =>
    `<tr><td><code>/${esc(c.nome)}</code></td><td>${esc(c.descricao)}</td><td class="quem">${esc(c.quem)}</td></tr>`
  ).join('');

  const gaveta = `<a data-cap="cmd" href="#cmd">Comandos do Discord</a>` +
    (DOCS.capitulos || []).map((c) => `<a data-cap="cap_${esc(c.id)}" href="#${esc(c.id)}">${esc(c.titulo)}</a>`).join('');

  const html = `<!doctype html><html lang="pt"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>Docs · Rendorium</title>
<style>
:root{color-scheme:light dark;--bg:#f7f8fa;--card:#fff;--ink:#17221d;--muted:#5a635e;--line:#e7ebe8;--accent:#244c3b;--accent-ink:#fff;--chip:#f2f4f3;--marca:#fff4c2}
@media(prefers-color-scheme:dark){:root{--bg:#12141b;--card:#1b1e28;--ink:#eef0f6;--muted:#9aa3b8;--line:#2b3040;--accent:#5ee0a8;--accent-ink:#0b1410;--chip:#272b38;--marca:#4a3f14}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14.5px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.app{display:grid;grid-template-columns:264px 1fr;min-height:100vh}
aside{border-right:1px solid var(--line);padding:16px 12px;position:sticky;top:0;height:100vh;overflow:auto;background:var(--card)}
aside h1{font-size:15px;margin:2px 6px 12px;letter-spacing:-.01em}
#q{width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit;font-size:13px;margin-bottom:10px}
nav a{display:block;padding:7px 10px;border-radius:9px;color:var(--muted);text-decoration:none;font-size:13px;margin-bottom:1px}
nav a.on{background:var(--accent);color:var(--accent-ink);font-weight:650}
nav a:hover:not(.on){background:var(--chip);color:var(--ink)}
main{padding:26px 30px 60px;min-width:0;max-width:860px}
h2{font-size:19px;letter-spacing:-.01em;margin:0 0 14px}
.cap,.painel{display:none}.cap.on,.painel.on{display:block}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:13.5px}
td{padding:8px 12px;border-top:1px solid var(--line);vertical-align:top}
tr:first-child td{border-top:0}
td.quem{color:var(--muted);white-space:nowrap;font-size:12px}
code{background:var(--chip);border-radius:5px;padding:1px 6px;font-size:.92em;font-family:ui-monospace,Consolas,monospace;overflow-wrap:anywhere}
.fich{background:var(--card);border:1px solid var(--line);border-radius:11px;margin-bottom:8px}
.fich summary{padding:10px 14px;cursor:pointer;font-size:13px;color:var(--muted)}
.fich summary code{color:var(--ink)}
.corpo{padding:2px 16px 12px;font-size:14px}
.corpo>p{margin:0 0 10px;color:var(--muted)}
.fn{border-top:1px solid var(--line);padding:11px 0}
.fn .ass{display:inline-block;background:var(--chip);padding:4px 9px;border-radius:7px;font-size:12.5px;margin-bottom:6px}
.fn .doc p{margin:0 0 8px}
.fn.marca{background:var(--marca);border-radius:8px;padding:11px 10px;margin:0 -10px}
.semdoc{color:var(--muted);font-style:italic}
.res{display:block;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:7px;cursor:pointer;font-size:13.5px}
.res .onde{color:var(--muted);font-size:11.5px;margin-bottom:3px}
.res:hover{border-color:var(--accent)}
.burger{display:none}
@media(max-width:860px){
  .app{grid-template-columns:1fr}
  aside{position:fixed;z-index:5;width:min(300px,84vw);transform:translateX(-102%);transition:transform .2s;box-shadow:6px 0 30px rgba(0,0,0,.2)}
  aside.aberta{transform:none}
  .burger{display:inline-flex;position:fixed;top:12px;right:12px;z-index:6;width:42px;height:42px;border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:18px;align-items:center;justify-content:center;cursor:pointer}
  main{padding:20px 16px 60px}
}
</style></head><body>
<button class="burger" onclick="document.querySelector('aside').classList.toggle('aberta')" aria-label="Navegação">☰</button>
<div class="app">
<aside>
  <h1>Como isto funciona</h1>
  <input id="q" type="search" placeholder="Pesquisar em tudo…" autocomplete="off">
  <nav id="nav">${gaveta}</nav>
</aside>
<main>
  <section class="painel" id="resultados"><h2>Resultados</h2><div id="lista"></div></section>
  <section class="cap" id="cmd"><h2>Comandos do Discord</h2><table>${comandos}</table></section>
  ${capitulos}
</main>
</div>
<script>
(function () {
  var nav = document.getElementById('nav');
  var q = document.getElementById('q');
  var caps = [].slice.call(document.querySelectorAll('.cap'));
  var res = document.getElementById('resultados'), lista = document.getElementById('lista');

  function ativa(id) {
    res.classList.remove('on');
    caps.forEach(function (c) { c.classList.toggle('on', c.id === id); });
    [].forEach.call(nav.children, function (a) { a.classList.toggle('on', a.dataset.cap === id); });
    document.querySelector('aside').classList.remove('aberta');
    var m = document.querySelector('main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0);
  }
  nav.onclick = function (e) {
    var a = e.target.closest('a'); if (!a) return;
    e.preventDefault(); q.value = ''; ativa(a.dataset.cap);
  };

  /* o índice da pesquisa constrói-se do próprio DOM: cada função e cada
     ficheiro, com o capítulo a que pertencem — pesquisar é filtrar isto */
  var indice = [];
  caps.forEach(function (c) {
    if (c.id === 'cmd') {
      [].forEach.call(c.querySelectorAll('tr'), function (tr) {
        indice.push({ el: tr, cap: c.id, capNome: 'Comandos', rotulo: tr.cells[0].textContent, texto: tr.textContent.toLowerCase() });
      });
      return;
    }
    var capNome = c.querySelector('h2').textContent;
    [].forEach.call(c.querySelectorAll('.fich'), function (d) {
      indice.push({ el: d, cap: c.id, capNome: capNome, rotulo: d.dataset.nome, texto: d.textContent.toLowerCase() });
      [].forEach.call(d.querySelectorAll('.fn'), function (f) {
        indice.push({ el: f, cap: c.id, capNome: capNome, rotulo: f.querySelector('.ass').textContent, fich: d, texto: f.textContent.toLowerCase() });
      });
    });
  });

  q.oninput = function () {
    var termo = q.value.trim().toLowerCase();
    if (termo.length < 2) { if (res.classList.contains('on')) ativa('cmd'); return; }
    caps.forEach(function (c) { c.classList.remove('on'); });
    [].forEach.call(nav.children, function (a) { a.classList.remove('on'); });
    var vistos = 0;
    lista.innerHTML = '';
    for (var i = 0; i < indice.length && vistos < 60; i++) {
      if (indice[i].texto.indexOf(termo) < 0) continue;
      vistos++;
      var e = indice[i];
      var b = document.createElement('div');
      b.className = 'res';
      b.innerHTML = '<div class="onde">' + e.capNome + '</div><code>' + e.rotulo.replace(/</g, '&lt;') + '</code>';
      b.onclick = (function (e2) {
        return function () {
          q.value = ''; ativa(e2.cap);
          if (e2.fich) e2.fich.open = true;
          if (e2.el.tagName === 'DETAILS') e2.el.open = true;
          e2.el.scrollIntoView({ block: 'center' });
          e2.el.classList.add('marca');
          setTimeout(function () { e2.el.classList.remove('marca'); }, 1800);
        };
      })(e);
      lista.appendChild(b);
    }
    if (!vistos) lista.innerHTML = '<p style="color:var(--muted)">Nada com «' + termo.replace(/</g, '&lt;') + '».</p>';
    res.classList.add('on');
  };

  ativa('cmd');
})();
</script>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
