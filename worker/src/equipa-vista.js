/* A página da ferramenta de equipa.
   ---------------------------------
   Servida pelo worker e não pelos ficheiros da app: quem faz suporte não
   carrega a aplicação de quem a usa, nem partilha código com ela. São duas
   coisas com públicos diferentes, e mantê-las separadas evita que um dia
   uma sessão de equipa consiga chamar alguma coisa da outra.

   É uma página escrita à mão, sem dependências. Cresceu de fila de pedidos
   para back office — pedidos, erros, pessoas, operação e rasto — mas o
   princípio mantém-se: uma ferramenta usada por meia dúzia de pessoas não
   justifica mais do que isto. Aqui ficam o HTML, os estilos (CSS_EQUIPA) e
   os dados da sessão; o JavaScript do browser vive no equipa-guiao.js (e
   está lá explicado porque vai num String.raw).

   As páginas vão com a CSP_ESTRITA, que não corre nada escrito dentro do
   HTML. Os estilos saem em /equipa/estilos.css e o guião em
   /equipa/guiao.js — este só para quem tem sessão de equipa, como quando ia
   dentro da página (paginas-recursos.js). Os dados da sessão vão num
   <script type="application/json">, que não corre: o guião lê-o. */

import { catsDe } from './lib/papeis.js';
import { CSP_ESTRITA } from './lib/http.js';

const ESTADOS = { criado: 'Recebido', resolucao: 'Em resolução', concluido: 'Concluído' };
const CATS = {
  user: 'contado por alguém', client: 'erro na app', server: 'erro no servidor',
  infra: 'infraestrutura', seguranca: 'segurança',
};

/* Embrulha o corpo no documento HTML completo: <head>, tema claro e escuro,
   e os estilos da ferramenta inteira. Todas as páginas da equipa — a própria
   ferramenta, o ecrã de entrada — passam por aqui.
   Recebe: corpo — o HTML do miolo da página (string, vai dentro de <body>);
   titulo — o título da janela (string, aparece como "titulo · equipa").
   Devolve: string com o documento HTML completo, pronta a ir numa Response. */
function pagina(corpo, titulo) {
  return `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex,nofollow">
<title>${titulo} · equipa</title>
<link rel="stylesheet" href="/equipa/estilos.css">
</head><body>${corpo}</body></html>`;
}

/* Os estilos da ferramenta inteira, servidos à parte em /equipa/estilos.css
   (paginas-recursos.js). É público: o ecrã de entrada também o usa, e esse é
   de quem ainda não entrou. As páginas vão com a CSP_ESTRITA, que não aplica
   nem uma folha escrita dentro do próprio HTML (a etiqueta de estilo em
   linha) nem um atributo de estilo; o que era style= passou às
   classes utilitárias do fim, que ficam por último de propósito — com a
   mesma especificidade, ganha a que vem depois, e um style= ganhava sempre. */
export const CSS_EQUIPA = `:root{color-scheme:light dark;
  --bg:#f7f8fa;--card:#fff;--ink:#17221d;--muted:#5a635e;--line:#e7ebe8;--line2:#cfd8d3;
  --accent:#244c3b;--accent-ink:#fff;--chip:#f2f4f3;--danger:#b94a48;--warn:#9a6400;--ok:#2f7d5b}
@media(prefers-color-scheme:dark){:root{
  --bg:#12141b;--card:#1b1e28;--ink:#eef0f6;--muted:#9aa3b8;--line:#2b3040;--line2:#3a4054;
  --accent:#5ee0a8;--accent-ink:#0b1410;--chip:#272b38;--danger:#ff8a80;--warn:#ffc35c;--ok:#5ee0a8}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.55 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  padding:0 0 60px}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);
  padding:calc(14px + env(safe-area-inset-top)) 18px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
header h1{margin:0;font-size:17px;letter-spacing:-.02em}
header .spacer{flex:1}
.wrap{max-width:900px;margin:0 auto;padding:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px;margin-bottom:11px}
.card.tap{cursor:pointer}.card.tap:hover{border-color:var(--line2)}
.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.small{font-size:13px;color:var(--muted)}
.badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;background:var(--chip);color:var(--muted)}
.badge.ok{background:color-mix(in srgb,var(--ok) 18%,transparent);color:var(--ok)}
.badge.dg{background:color-mix(in srgb,var(--danger) 18%,transparent);color:var(--danger)}
.badge.wa{background:color-mix(in srgb,var(--warn) 20%,transparent);color:var(--warn)}
input,textarea,select,button{font:inherit;color:inherit}
input,textarea,select{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
textarea{min-height:110px;resize:vertical}
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border:1px solid var(--line);
  border-radius:10px;background:var(--card);cursor:pointer;font-weight:600;font-size:14px;white-space:nowrap;width:auto}
.btn:hover{border-color:var(--line2)}
.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.btn.danger{color:var(--danger)}
.btn.mini{padding:5px 10px;font-size:12.5px}
.tabs{display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap}
.tabs .btn.on{background:var(--chip);border-color:var(--line2)}
.vazio{text-align:center;color:var(--muted);padding:40px 20px;border:1px dashed var(--line2);border-radius:14px}
pre{white-space:pre-wrap;word-break:break-word;background:var(--chip);padding:11px;border-radius:10px;
  font:12.5px/1.5 ui-monospace,Menlo,Consolas,monospace;margin:9px 0 0;max-height:280px;overflow:auto}
.grelha{display:grid;gap:11px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.stat{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}
.stat:last-child{border:0}
.stat b{text-align:right;word-break:break-word}
.msg{border-left:3px solid var(--accent);padding:8px 12px;margin:9px 0 0;background:var(--chip);border-radius:0 10px 10px 0}
.msg.nota{border-left-color:var(--warn)}
.msg .small{margin-bottom:3px}
.acoes{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;font-size:13.5px}
td,th{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12.5px}
.num{text-align:right;font-variant-numeric:tabular-nums}
.rolavel{overflow-x:auto}
dialog{border:0;padding:0;background:transparent;color:inherit;max-width:94vw}
dialog::backdrop{background:rgba(0,0,0,.45)}
header nav{margin:0;min-width:0;flex:1;justify-content:flex-end}
/* no telemóvel os separadores ganham a linha inteira, em vez de uma coluna */
@media(max-width:600px){header nav{flex-basis:100%;justify-content:flex-start}}

/* ---- as classes que eram style= (têm de ficar no fim da folha);
   primeiro as dos ecrãs de entrada, depois as do guião ---- */
.estreito{max-width:460px;padding-top:60px}
.h-entrada{margin:0 0 8px;font-size:19px}
.h-entrada-junto{margin:0 0 4px;font-size:19px}
.largo{width:100%;justify-content:center}
.m0{margin:0}
.m-0-0-10{margin:0 0 10px}
.m-0-0-14{margin:0 0 14px}
.m-12-0-0{margin:12px 0 0}
.min0{min-width:0}
.clicavel{cursor:pointer}
.voltar{margin-bottom:12px}
.grande{font-size:16px}
.procura{flex:1;min-width:210px}
.flex1{flex:1}
.sel-mini{width:auto;padding:5px 10px;font-size:12.5px}
.form-dialogo{margin:0;width:min(440px,90vw)}
.rotulo-campo{display:block;margin-top:10px}
.nowrap{white-space:nowrap}
.dir{text-align:right}
.mt6{margin-top:6px}
.mt8{margin-top:8px}
.m-2-0-6{margin:2px 0 6px}
.m-2-0-8{margin:2px 0 8px}
.m-4-0-8{margin:4px 0 8px}
.m-8-0-2{margin:8px 0 2px}
`;

// Quem não tem sessão não vê a ferramenta, nem sabe o que lá está.
// Recebe: eu — a sessão de equipa (objeto com nome, discordId e papeis/papel),
// ou nada quando não há sessão válida.
// Devolve: Response HTML — a ferramenta inteira com sessão; sem ela, o ecrã
// que manda ir ao /entrar do Discord (401).
export function paginaEquipa(eu) {
  if (!eu) {
    return new Response(pagina(`<div class="wrap estreito">
      <div class="card">
        <h1 class="h-entrada">Ferramenta de equipa</h1>
        <p class="small m0">Entra-se a partir do Discord. Corre <b>/entrar</b> no
        servidor e abre a ligação que o bot te dá — vale cinco minutos e uma só utilização.</p>
      </div></div>`, 'Entrar'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP_ESTRITA },
    });
  }

  const papeis = (eu.papeis && eu.papeis.length ? eu.papeis : [eu.papel]).filter(Boolean);
  const cats = catsDe(papeis);
  const dados = {
    nome: eu.nome,
    discordId: eu.discordId,
    papeis,
    cats,
    master: papeis.indexOf('master') > -1,
  };

  const corpo = `<header>
    <h1>Equipa</h1>
    <span class="badge">${escapar(papeis.join(' + '))}</span>
    <span class="small">${escapar(eu.nome)}</span>
    <nav class="tabs" id="nav"></nav>
    <button class="btn mini" data-acao="sair">Sair</button>
  </header>
  <div class="wrap"><div id="conteudo"><div class="vazio">A carregar…</div></div></div>
  <dialog id="dialogo"></dialog>
<script type="application/json" id="dados-equipa">${paraScript({ eu: dados, ESTADOS, CATS })}</script>
<script src="/equipa/guiao.js"></script>`;

  return new Response(pagina(corpo, 'Equipa'), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP_ESTRITA },
  });
}

/* A página que a ligação do Discord abre.

   Abrir não entra. Mostra quem é e põe um botão — e é o botão que gasta a
   ligação. É o que impede que uma pré-visualização, um leitor de links ou o
   browser a adiantar-se gastem a ligação antes da pessoa lá chegar.

   O endereço leva o token, por isso a página não pode deixar sair um
   referer nem ficar em cache.
   Recebe: token — o token da ligação (string, segue escondido no formulário);
   v — a verificação do token (objeto com estado — 'boa', 'nao-existe',
   'usada' ou 'expirou' — e quem, a pessoa que vai entrar); depois (opcional) —
   'docs' para seguir para a documentação depois de entrar.
   Devolve: Response HTML — o botão de entrar (200) ou o porquê de não dar (410). */
export function paginaEntrada(token, v, depois) {
  const cabecalhos = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': CSP_ESTRITA,
  };

  if (v.estado !== 'boa') {
    const porque = {
      'nao-existe': 'Esta ligação não existe.',
      usada: 'Esta ligação já foi usada. Cada uma serve uma vez só.',
      expirou: 'Esta ligação expirou. Valem cinco minutos.',
    }[v.estado] || 'Esta ligação não serve.';
    return new Response(pagina(`<div class="wrap estreito">
      <div class="card">
        <h1 class="h-entrada">Não dá para entrar</h1>
        <p class="small m-0-0-10">${porque}</p>
        <p class="small m0">Corre <b>/entrar</b> outra vez no Discord para teres outra.</p>
      </div></div>`, 'Entrar'), { status: 410, headers: cabecalhos });
  }

  const quem = v.quem || {};
  const papeis = (quem.papeis && quem.papeis.length ? quem.papeis : [quem.papel]).filter(Boolean);
  return new Response(pagina(`<div class="wrap estreito">
    <div class="card">
      <h1 class="h-entrada-junto">Ferramenta de equipa</h1>
      <p class="small m-0-0-14">
        Entras como <b>${escapar(quem.nome || '')}</b>
        <span class="badge">${escapar(papeis.join(' + ') || 'sem papel')}</span>
      </p>
      <form method="POST" action="/equipa/entrar">
        <input type="hidden" name="t" value="${escapar(token)}">
        ${depois === 'docs' ? '<input type="hidden" name="depois" value="docs">' : ''}
        <button class="btn primary largo" type="submit">Entrar</button>
      </form>
      <p class="small m-12-0-0">
        A ligação vale uma vez só e gasta-se ao carregares aqui.</p>
    </div></div>`, 'Entrar'), { status: 200, headers: cabecalhos });
}

// As duas quebras de linha (U+2028 e U+2029) que o JSON deixa passar dentro de
// uma string e o JavaScript antigo não; feitas por código para ninguém as colar sem as ver.
const QUEBRAS_JS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');

/* Um valor posto dentro de um <script> (hoje, o <script type="application/json">
   dos dados da sessão): o JSON dele, com o < trocado pelo escape. O
   JSON.stringify não escapa o <, e um </script> num nome — o global_name do
   Discord aceita-o — fechava o bloco e abria outro com o que viesse a
   seguir. O escape (barra, u, 003c) lê-se < no JSON.parse do guião, e o
   valor chega igual; as quebras U+2028 e U+2029 vão pelo mesmo caminho.
   Recebe: v — o valor (qualquer coisa que o JSON aceite).
   Devolve: o texto JSON, seguro dentro de um <script>. */
function paraScript(v) {
  return JSON.stringify(v).replace(/</g, '\\u003c')
    .replace(QUEBRAS_JS, (c) => '\\u' + c.charCodeAt(0).toString(16));
}

// escapa HTML para as interpolações destas páginas (do lado do cliente
// existe o gémeo, esc)
// Recebe: s — o valor a escapar (qualquer coisa; null e undefined viram '').
// Devolve: string com &, <, >, " e ' trocados pelas entidades HTML.
function escapar(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}
