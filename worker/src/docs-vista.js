/* A documentação da casa, servida em /equipa/docs.
   -------------------------------------------------
   Não se escreve documentação aqui: ela vem do próprio código — o
   comentário de abertura de cada ficheiro, extraído no deploy pelo
   scripts/gerar-docs.js. Se um ficheiro muda e o cabeçalho muda com ele,
   a página muda no deploy seguinte, sem ninguém se lembrar de nada.

   É da equipa: pede a mesma sessão que o resto do /equipa. */

import { DOCS } from './docs-gerados.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// os cabeçalhos são prosa com parágrafos: quebras duplas separam, simples juntam
const prosa = (t) => esc(t).split(/\n{2,}/)
  .map((p) => '<p>' + p.replace(/\n/g, ' ') + '</p>').join('');

export function paginaDocs() {
  const comandos = (DOCS.comandos || []).map((c) =>
    `<tr><td><code>/${esc(c.nome)}</code></td><td>${esc(c.descricao)}</td><td class="quem">${esc(c.quem)}</td></tr>`
  ).join('');

  const indice = (DOCS.capitulos || []).map((c, i) =>
    `<a href="#c${i}">${esc(c.titulo)}</a>`).join('');

  const capitulos = (DOCS.capitulos || []).map((c, i) =>
    `<h2 id="c${i}">${esc(c.titulo)}</h2><p class="nota">${esc(c.nota)}</p>` +
    c.itens.map((x) =>
      `<details><summary><code>${esc(x.nome)}</code> — ${esc(x.texto.split('\n')[0]).slice(0, 110)}</summary>
       <div class="corpo">${prosa(x.texto)}</div></details>`).join('')
  ).join('');

  const html = `<!doctype html><html lang="pt"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>Docs · Rendorium</title>
<style>
:root{color-scheme:light dark;--bg:#f7f8fa;--card:#fff;--ink:#17221d;--muted:#5a635e;--line:#e7ebe8;--accent:#244c3b;--chip:#f2f4f3}
@media(prefers-color-scheme:dark){:root{--bg:#12141b;--card:#1b1e28;--ink:#eef0f6;--muted:#9aa3b8;--line:#2b3040;--accent:#5ee0a8;--chip:#272b38}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:30px 20px 60px}
h1{font-size:24px;letter-spacing:-.02em;margin:0 0 4px}
.sub{color:var(--muted);font-size:13.5px;margin:0 0 20px}
.indice{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.indice a{font-size:12.5px;color:var(--ink);background:var(--chip);border-radius:99px;padding:5px 11px;text-decoration:none}
h2{font-size:17px;margin:30px 0 2px;letter-spacing:-.01em}
.nota{color:var(--muted);font-size:13px;margin:0 0 10px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:13.5px}
td{padding:8px 12px;border-top:1px solid var(--line);vertical-align:top}
tr:first-child td{border-top:0}
td.quem{color:var(--muted);white-space:nowrap;font-size:12px}
code{background:var(--chip);border-radius:5px;padding:1px 6px;font-size:.92em;font-family:ui-monospace,Consolas,monospace}
details{background:var(--card);border:1px solid var(--line);border-radius:11px;margin-bottom:7px}
summary{padding:10px 14px;cursor:pointer;font-size:13.5px;color:var(--muted)}
summary code{color:var(--ink)}
.corpo{padding:2px 16px 12px;font-size:14px}
.corpo p{margin:0 0 10px}
</style></head><body><div class="wrap">
<h1>Como isto funciona por dentro</h1>
<p class="sub">Gerado do próprio código a cada deploy (versão ${esc(DOCS.geradoEm)}) —
cada entrada é o comentário de abertura do ficheiro. Se está errado aqui, está errado lá.</p>
<div class="indice"><a href="#cmd">Comandos do Discord</a>${indice}</div>
<h2 id="cmd">Comandos do Discord</h2>
<p class="nota">Quem pode o quê vem das PERMISSOES do worker — o /access afina exceções por pessoa.</p>
<table>${comandos}</table>
${capitulos}
</div></body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
