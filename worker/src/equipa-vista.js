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

   Veste a linguagem da app (cobalto, cartões, selos retangulares, Geist e
   Bricolage), mas com a barra lateral GRAFITE e a marca em ardósia, com o
   selo «Equipa»: de propósito diferente do azul-noite da app, para nunca se
   confundir uma com a outra.

   As páginas vão com a CSP_ESTRITA, que não corre nada escrito dentro do
   HTML. Os estilos saem em /equipa/estilos.css e o guião em
   /equipa/guiao.js — este só para quem tem sessão de equipa, como quando ia
   dentro da página (paginas-recursos.js). Os dados da sessão vão num
   <script type="application/json">, que não corre: o guião lê-o. */

import { catsDe } from './lib/papeis.js';
import { CSP_ESTRITA } from './lib/http.js';
import { autorDaEquipa } from './rotas/qa.js';

const ESTADOS = { criado: 'Recebido', resolucao: 'Em resolução', concluido: 'Concluído' };
const CATS = {
  user: 'contado por alguém', client: 'erro na app', server: 'erro no servidor',
  infra: 'infraestrutura', seguranca: 'segurança',
};

// O livro da Documentação, desenhado como os ícones da app: traço de 1.8, pontas redondas.
const ICONE_DOCS = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h8M8 12h6"/></svg>';

/* Embrulha o corpo no documento HTML completo: <head>, tema claro e escuro,
   e os estilos da ferramenta inteira. Todas as páginas da equipa — a própria
   ferramenta, o ecrã de entrada — passam por aqui.
   Recebe: corpo — o HTML do miolo da página (string, vai dentro de <body>);
   titulo — o título da janela (string, aparece como "titulo · Rendorium Equipa");
   comQa (opcional) — true para juntar o CSS da pílula do QA (o back office do dev).
   Devolve: string com o documento HTML completo, pronta a ir numa Response. */
function pagina(corpo, titulo, comQa) {
  return `<!doctype html>
<html lang="pt-PT"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#161A23">
<meta name="robots" content="noindex,nofollow">
<title>${titulo} · Rendorium Equipa</title>
<link rel="stylesheet" href="/equipa/estilos.css">${comQa ? '\n<link rel="stylesheet" href="/equipa/qa.css">' : ''}
</head><body>${corpo}</body></html>`;
}

/* A marca da ferramenta: o quadrado em ardósia com os dois arcos, o nome e o
   selo «Equipa». Igual na barra lateral, no ecrã de entrada e nos docs.
   Devolve: o HTML da marca (string). */
function marcaDaEquipa() {
  return '<span class="mark" aria-hidden="true"></span><span class="eq-nome">Rendorium</span><span class="eq-selo">Equipa</span>';
}

/* Os estilos da ferramenta inteira, servidos à parte em /equipa/estilos.css
   (paginas-recursos.js). É público: o ecrã de entrada também o usa, e esse é
   de quem ainda não entrou. As páginas vão com a CSP_ESTRITA, que não aplica
   nem uma folha escrita dentro do próprio HTML (a etiqueta de estilo em
   linha) nem um atributo de estilo: tudo o que a página e o guião pintam
   vive nestas classes. Os tokens são os do contrato da app (claro no :root,
   escuro na preferência do sistema — a ferramenta não tem interruptor de
   tema); os da barra grafite são só daqui. */
export const CSS_EQUIPA = `/* As letras da app, servidas de /fonts/ (a CSP só deixa font-src 'self'):
   a Geist no texto, a Bricolage Grotesque nos títulos e nos números grandes.
   Variáveis, só o latino; o swap mostra logo o texto na letra do sistema. */
@font-face{font-family:'Geist';font-style:normal;font-weight:100 900;font-display:swap;
  src:url(/fonts/geist.woff2) format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Bricolage Grotesque';font-style:normal;font-weight:200 800;font-display:swap;
  src:url(/fonts/bricolage-grotesque.woff2) format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{color-scheme:light dark;
  --bg:#F2F3F6;--card:#FFFFFF;--field:#FFFFFF;--chip:#F6F7F9;--tint:#F6F7F9;--press:#E9ECF2;
  --ink:#121826;--muted:#4F586B;--faint:#687083;--line:#E2E5EB;--line2:#CDD2DB;
  --accent:#2952D9;--accent-ink:#FFFFFF;--accent-soft:#E9EEFC;--accent-text:#1D3FB0;--accent-press:#1D3FB0;
  --in:#16775A;--in-soft:#E2F3EB;--warn:#8F5600;--warn-soft:#FFF1D1;
  --danger:#B42318;--danger-soft:#FDE8E6;--danger-ink:#FFFFFF;--danger-press:#912018;
  --toast:#121826;--toast-ink:#FFFFFF;--shadow:0 16px 40px rgba(16,24,40,.16);--veu:rgba(9,14,28,.55);
  /* a ferramenta da equipa: grafite e ardósia, nunca o azul-noite da app */
  --eq:#161A23;--eq-texto:#C3C8D3;--eq-fraco:#8A92A3;--eq-branco:#FFFFFF;--eq-hover:rgba(255,255,255,.06);
  --eq-on:rgba(255,255,255,.1);--eq-caixa:rgba(255,255,255,.05);--eq-linha:#2A303D;--eq-selo:#2A303D;--eq-marca:#5B6478;
  --cnt:#FFB27A;--cnt-ink:#3A1A05;--cnt-erro:#FF8A80;--cnt-erro-ink:#3A0D0A;
  --letra:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif;
  --letra-titulo:'Bricolage Grotesque','Geist',system-ui,sans-serif;
  --letra-mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  --rapido:.12s;--medio:.2s;--volta:.8s;--curva:cubic-bezier(.22,1,.36,1);--curva-entra:cubic-bezier(0,0,.2,1)}
@media(prefers-color-scheme:dark){:root{
  --bg:#0B111E;--card:#141C2C;--field:#141C2C;--chip:#1A2335;--tint:#1A2335;--press:#253049;
  --ink:#E9EDF5;--muted:#AEB7C9;--faint:#8C96AB;--line:#253049;--line2:#33405C;
  --accent:#7C9BFF;--accent-ink:#0B111E;--accent-soft:#1E2A4D;--accent-text:#B5C6FF;--accent-press:#9DB3FF;
  --in:#4CC79A;--in-soft:#123327;--warn:#F2C25A;--warn-soft:#352A12;
  --danger:#FF8A80;--danger-soft:#3D1A1A;--danger-ink:#1A0605;--danger-press:#FFB1AA;
  --toast:#E9EDF5;--toast-ink:#121826;--shadow:0 24px 60px rgba(0,0,0,.6);--veu:rgba(2,5,12,.66)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--letra);font-size:15px;line-height:1.45;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
h1,h2,h3{font-family:var(--letra-titulo);font-weight:650;letter-spacing:-.015em;margin:0;line-height:1.2}
p{margin:0}
button,input,textarea{font:inherit;color:inherit}
a{color:var(--accent)}
a:hover{color:var(--accent-text)}
code{font-family:var(--letra-mono);font-size:.88em}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.n{font-variant-numeric:tabular-nums}
.sub{color:var(--muted);font-size:13px}
.sub code{white-space:nowrap}
.lbl{font-size:12px;font-weight:600;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}
.forte{font-weight:600}
.quebra{overflow-wrap:anywhere}
.flex1{flex:1}
.dir{text-align:right}
.so-leitor{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.i{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.i-sm{width:16px;height:16px}
.seta{color:var(--faint);margin-left:auto}

/* ---- a marca: o quadrado em ardósia com dois arcos brancos em cantos opostos ---- */
.mark{width:28px;height:28px;border-radius:8px;flex:none;
  background:radial-gradient(circle at 0 0,transparent 9px,var(--eq-branco) 9.5px,var(--eq-branco) 12px,transparent 12.5px),
    radial-gradient(circle at 100% 100%,transparent 9px,var(--eq-branco) 9.5px,var(--eq-branco) 12px,transparent 12.5px),var(--eq-marca)}
.eq-nome{font-family:var(--letra-titulo);font-weight:650;letter-spacing:-.015em;font-size:18px;color:var(--eq-branco)}
.eq-selo{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:12px;font-weight:600;
  background:var(--eq-selo);color:var(--eq-texto);white-space:nowrap}

/* ---- a moldura: barra lateral grafite e o miolo; a coluna da barra fica
   grafite até ao fundo, mesmo quando a página é mais alta do que a barra colada ---- */
.eq-app{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh;min-height:100dvh;
  background:linear-gradient(to right,var(--eq) 248px,transparent 248px)}
.eq-lado{position:sticky;top:0;height:100vh;height:100dvh;overflow-y:auto;background:var(--eq);color:var(--eq-texto);
  padding:20px 14px;display:flex;flex-direction:column;gap:4px}
.eq-marca{display:flex;align-items:center;gap:10px;padding:0 8px 18px;min-width:0}
.eq-itens{display:flex;flex-direction:column;gap:2px}
.eq-nav{display:contents}
.eq-sep{height:1px;background:var(--eq-linha);margin:8px 8px}
.nv{display:flex;align-items:center;gap:12px;width:100%;min-height:40px;padding:0 12px;border:0;border-radius:10px;
  background:transparent;color:var(--eq-texto);text-decoration:none;font-size:14.5px;font-weight:500;text-align:left;cursor:pointer;
  transition:background-color var(--rapido) var(--curva),color var(--rapido) var(--curva)}
.nv:hover{background:var(--eq-hover);color:var(--eq-branco)}
.nv[aria-current="page"]{background:var(--eq-on);color:var(--eq-branco)}
.nv:focus-visible{outline-color:var(--eq-branco);outline-offset:-2px}
.nb{margin-left:auto;min-width:22px;height:20px;padding:0 6px;border-radius:999px;background:var(--cnt);color:var(--cnt-ink);
  font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.nb.erro{background:var(--cnt-erro);color:var(--cnt-erro-ink)}
.eq-quem{margin-top:auto;padding:12px;border-radius:12px;background:var(--eq-caixa);display:flex;align-items:center;gap:10px}
.eq-quem-txt{flex:1;min-width:0}
.eq-quem-nome{color:var(--eq-branco);font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eq-quem-papel{color:var(--eq-texto);font-size:12.5px}
.eq-sair{flex:none;min-height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--eq-linha);background:transparent;
  color:var(--eq-branco);font-size:14px;font-weight:600;cursor:pointer}
.eq-sair:hover{background:var(--eq-hover)}
.eq-sair:focus-visible{outline-color:var(--eq-branco)}
.eq-main{min-width:0;padding:24px clamp(16px,3vw,36px) 48px}
.eq-miolo{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
/* no telemóvel a barra passa a faixa no topo: a marca e o Sair numa linha,
   os separadores numa fila que corre para o lado */
@media(max-width:899px){
  .eq-app{display:block;background:none}
  .eq-lado{position:relative;height:auto;overflow:visible;flex-direction:row;flex-wrap:wrap;align-items:center;gap:0 8px;
    padding:calc(10px + env(safe-area-inset-top)) 16px 0}
  .eq-marca{flex:1 1 auto;padding:0}
  .eq-quem{order:2;margin:0;padding:0;background:none}
  .eq-quem-txt{display:none}
  .eq-itens{order:3;flex:1 0 100%;flex-direction:row;overflow-x:auto;gap:4px;margin:0 -16px;padding:10px 16px;scrollbar-width:none}
  .eq-itens::-webkit-scrollbar{display:none}
  .eq-sep{display:none}
  .nv{width:auto;flex:none;gap:8px}
  .eq-main{padding:18px 16px 40px}
  .eq-miolo{gap:14px}
}

/* ---- cabeçalho de cada secção ---- */
.cab{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px}
.cab-txt{flex:1 1 300px;min-width:0}
.cab h1{font-size:32px}
.cab .sub{font-size:14px;margin-top:4px}
.cab-acoes{display:flex;flex-wrap:wrap;gap:8px}
@media(max-width:899px){.cab h1{font-size:22px}}

/* ---- cartões ---- */
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;min-width:0}
.card-pad{padding:18px;display:flex;flex-direction:column;gap:12px}
.card-cab{padding:16px 18px 12px;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:flex-end}
.card-cab-txt{flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:4px}
.card-pad>.card-cab-txt{flex:none}
.card-tit{font-size:16px}
.card-tit b{font-weight:inherit}
.card-tit-linha{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.card-pe{padding:0 18px 18px}
.card-nota{padding:10px 18px 14px;border-top:1px solid var(--line)}
.card-sub-tit{font-size:14px;padding:16px 18px 8px;border-top:1px solid var(--line)}
@media(max-width:899px){.card-pad{padding:14px}.card-cab{padding:14px 14px 10px}.card-pe{padding:0 14px 14px}}

/* ---- botões ---- */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;border-radius:12px;
  border:1px solid var(--line2);background:var(--card);color:var(--ink);font-weight:600;font-size:15px;line-height:1.2;
  text-decoration:none;white-space:nowrap;cursor:pointer;
  transition:background-color var(--rapido) var(--curva),border-color var(--rapido) var(--curva)}
.btn:hover{background:var(--tint);color:var(--ink)}
.btn:active{background:var(--press)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.btn.primary:hover{background:var(--accent-press);border-color:var(--accent-press);color:var(--accent-ink)}
.btn.danger{background:var(--danger);border-color:var(--danger);color:var(--danger-ink)}
.btn.danger:hover{background:var(--danger-press);border-color:var(--danger-press);color:var(--danger-ink)}
.btn.ghost{background:transparent;border-color:transparent}
.btn.ghost:hover{background:var(--chip)}
.btn.sm{min-height:36px;padding:0 12px;font-size:14px;border-radius:10px}
.btn.so-icone{width:44px;padding:0}
.btn.lista{justify-content:flex-start;width:100%;white-space:normal;text-align:left;padding:10px 16px;line-height:1.3}
.btn.texto-aviso{color:var(--warn)}
.btn.texto-perigo{color:var(--danger)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn:disabled:hover{background:var(--card)}
.largo{width:100%}

/* ---- chips: filtros e modos; ligado é cobalto suave ---- */
.chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.chip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line2);
  background:var(--card);color:var(--ink);font-size:14px;font-weight:500;white-space:nowrap;cursor:pointer;
  transition:background-color var(--rapido) var(--curva)}
.chip:hover{background:var(--tint)}
.chip.on,.chip:has(input:checked){background:var(--accent-soft);border-color:var(--accent);color:var(--accent-text)}
.chip:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}
.chip .n{opacity:.8}
span.chip{cursor:default}
summary.chip{list-style:none}
summary.chip::-webkit-details-marker{display:none}

/* ---- selos: retangulares, 22px ---- */
.badge{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:6px;font-size:12px;font-weight:600;
  white-space:nowrap;background:var(--chip);color:var(--muted);vertical-align:middle}
.badge.ac{background:var(--accent-soft);color:var(--accent-text)}
.badge.ok{background:var(--in-soft);color:var(--in)}
.badge.wa{background:var(--warn-soft);color:var(--warn)}
.badge.dg{background:var(--danger-soft);color:var(--danger)}

/* ---- campos ---- */
.campo{width:100%;min-height:46px;padding:0 14px;border-radius:12px;border:1px solid var(--line2);background:var(--field);color:var(--ink);font-size:15px}
textarea.campo{min-height:110px;padding:12px 14px;resize:vertical;line-height:1.45;display:block}
.campo::placeholder{color:var(--faint)}
.campo:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.campo[aria-invalid="true"]{border:2px solid var(--danger)}
.campo-bloco{display:flex;flex-direction:column;gap:6px;min-width:0}
.campo-sufixo{display:flex;align-items:center;gap:6px;padding-right:12px}
.campo-sufixo input{flex:1;min-width:0;border:0;outline:0;background:transparent;min-height:44px;font-size:15px}
.campo-sufixo:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.campo-sufixo:has(input[aria-invalid="true"]){border:2px solid var(--danger)}
.rot{font-size:14px;font-weight:600;color:var(--ink)}
.req{color:var(--danger)}
.erro-txt{font-size:13px;font-weight:600;color:var(--danger)}
.erro-txt:empty{display:none}
.procura{display:flex;align-items:center;gap:8px;min-height:46px;padding:0 14px;border-radius:12px;border:1px solid var(--line2);
  background:var(--field);color:var(--faint);min-width:0}
.procura:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.procura input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font-size:15px;min-height:44px;-webkit-appearance:none;appearance:none}
.procura input::placeholder{color:var(--faint)}

/* ---- linhas de lista: tocar abre ---- */
.linha{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:12px 18px;border:0;border-top:1px solid var(--line);
  background:transparent;color:inherit;font-size:14px;text-align:left}
.linha.tocavel{cursor:pointer;transition:background-color var(--rapido) var(--curva)}
.linha.tocavel:hover{background:var(--tint)}
.linha.tocavel:focus-visible{outline-offset:-2px}
.linha-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.avatar{width:56px;height:56px;border-radius:50%;background:var(--accent-soft);color:var(--accent-text);display:flex;align-items:center;
  justify-content:center;font-weight:700;font-size:20px;flex:none}
.avatar.sm{width:36px;height:36px;font-size:13px}
.vazio{border:1px dashed var(--line2);border-radius:14px;padding:18px;color:var(--muted);display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.vazio-tit{color:var(--ink);font-weight:600}
.espera{display:flex;align-items:center;gap:10px;padding:18px;color:var(--muted)}
.espera b{color:var(--ink);font-weight:600}
.roda{width:18px;height:18px;border-radius:50%;border:2.5px solid var(--line2);border-top-color:var(--accent);flex:none;
  animation:roda var(--volta) linear infinite}
@keyframes roda{to{transform:rotate(360deg)}}

/* ---- tabelas ---- */
.tb-rola{overflow-x:auto}
.tb{width:100%;border-collapse:collapse;font-size:14px}
.tb th{text-align:left;font-size:12px;font-weight:600;color:var(--muted);padding:10px 16px;border-bottom:1px solid var(--line);white-space:nowrap}
.tb td{padding:10px 16px;border-top:1px solid var(--line);vertical-align:middle}
.tb .r{text-align:right}
.tb .nw{white-space:nowrap}
.tb td.det{color:var(--muted);font-size:13px;min-width:200px;overflow-wrap:anywhere}
.acoes-td{display:flex;gap:6px;justify-content:flex-end}
.tb tr.tb-erro td{border-top:0;padding-top:0}
.acao{background:var(--chip);border-radius:6px;padding:2px 6px;font-size:12.5px;white-space:nowrap}
.ligacao{border:0;background:transparent;padding:0;color:var(--accent);font:inherit;cursor:pointer;text-decoration:underline;
  text-underline-offset:2px;overflow-wrap:anywhere;text-align:left}
.ligacao:hover{color:var(--accent-text)}
/* no telemóvel as tabelas compridas empilham: cada linha um bloco, cada célula com o rótulo da coluna */
@media(max-width:640px){
  .tb.empilha thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .tb.empilha tr{display:block;padding:10px 14px;border-top:1px solid var(--line)}
  .tb.empilha td{display:flex;flex-wrap:wrap;gap:4px 8px;justify-content:flex-end;align-items:baseline;padding:3px 0;border:0;text-align:right;min-width:0}
  .tb.empilha td::before{content:attr(data-rot);color:var(--muted);font-size:13px;text-align:left;flex:none;margin-right:auto}
  .tb.empilha td.det:empty{display:none}
  .card>.tb-rola:first-child .tb.empilha tbody tr:first-child{border-top:0}
  .tb.empilha td.acoes{justify-content:flex-end;padding-top:8px}
  .tb.empilha td.acoes::before{content:none}
  .tb.empilha td.det{min-width:0}
  .tb.empilha tr.tb-erro{border-top:0;padding-top:0}
}

/* ---- o aviso de baixo (o toast da app) ---- */
.eq-toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:10px;
  max-width:min(560px,calc(100vw - 32px));padding:10px 10px 10px 16px;border-radius:14px;background:var(--toast);color:var(--toast-ink);
  font-size:14px;font-weight:500;box-shadow:var(--shadow);opacity:0;visibility:hidden;transform:translate(-50%,12px);
  transition:opacity var(--medio) var(--curva),transform var(--medio) var(--curva),visibility 0s linear var(--medio)}
.eq-toast.on{opacity:1;visibility:visible;transform:translate(-50%,0);transition-delay:0s}
.eq-toast.erro{box-shadow:inset 4px 0 0 var(--danger),var(--shadow)}
.eq-toast-txt{flex:1;min-width:0;overflow-wrap:anywhere}
.eq-toast-x{flex:none;width:36px;height:36px;border:0;border-radius:10px;background:transparent;color:inherit;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center}
.eq-toast-x:focus-visible{outline-color:currentColor}

/* ---- a janela de confirmação (as ações com motivo) ---- */
dialog.janela{border:0;padding:0;background:transparent;color:var(--ink);width:480px;max-width:calc(100vw - 32px);
  max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px)}
dialog.janela::backdrop{background:var(--veu)}
.janela-corpo{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:var(--shadow);
  display:flex;flex-direction:column;gap:14px}
.janela-corpo h2{font-size:18px}
.janela-txt{color:var(--muted);font-size:14px}
.janela-txt b{color:var(--ink)}
.janela-botoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding-top:4px}

/* ---- o ecrã de entrada ---- */
.entrada{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 16px}
.entrada-cartao{width:100%;max-width:440px;overflow:hidden}
.entrada-topo{display:flex;align-items:center;gap:10px;padding:16px 20px;background:var(--eq)}
.entrada-corpo{padding:22px 20px 20px;display:flex;flex-direction:column;gap:14px}
.entrada-corpo h1{font-size:22px}
.entrada-corpo form{display:flex;flex-direction:column;gap:10px}
.entrada-passos{margin:0;padding-left:20px;color:var(--muted);font-size:14px;display:flex;flex-direction:column;gap:4px}
.entrada-quem{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:15px}

/* ---- pedidos e erros: a lista e, ao lado, o pedido aberto ---- */
.pd{display:flex;gap:16px;align-items:flex-start}
.pd-lista{flex:0 1 400px;overflow:hidden}
.pd-lista-topo{display:flex;flex-direction:column;gap:10px;padding:14px}
.pd-vazio{padding:0 14px 14px}
.rq{display:flex;flex-direction:column;gap:4px;width:100%;padding:12px 14px;border:0;border-top:1px solid var(--line);background:transparent;
  color:inherit;text-align:left;cursor:pointer;transition:background-color var(--rapido) var(--curva)}
.rq:hover{background:var(--tint)}
.rq[aria-current="true"]{background:var(--accent-soft)}
.rq:focus-visible{outline-offset:-2px}
.rq-topo{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.rq-quando{margin-left:auto}
.rq-tit{font-weight:600}
.pd-det{flex:1 1 0;min-width:0;overflow:hidden;container-type:inline-size}
/* no computador o pedido aberto fica à vista enquanto se corre a lista */
@media(min-width:1200px){.pd-det{position:sticky;top:24px;max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);overflow:auto}}
.pd-det-vazio{padding:18px}
.pd-det-cab{padding:18px 20px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;border-bottom:1px solid var(--line)}
.pd-det-tit{flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:6px}
.pd-det-tit h2{font-size:20px;overflow-wrap:anywhere}
.pd-voltar{display:none;flex:1 0 100%;justify-content:flex-start;margin:-6px 0 0 -10px}
.pd-voltar.sempre{display:inline-flex}
.pd-det-corpo{display:flex;flex-wrap:wrap}
.pd-fio{flex:999 1 400px;min-width:0;padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.pd-lado{flex:1 1 240px;min-width:0;padding:18px 20px;border-left:1px solid var(--line);background:var(--chip);display:flex;flex-direction:column;gap:8px}
.pd-lado .btn{align-self:flex-start;margin-top:4px}
.pd-nome{font-weight:600}
.pd-lbl-sep{padding-top:10px}
.lado-linha{display:block;width:100%;border:0;background:transparent;padding:6px 0;color:var(--ink);text-align:left;font-size:13.5px;cursor:pointer}
.lado-linha:hover .lado-tit{text-decoration:underline}
.pd-contexto{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;overflow-wrap:anywhere}
.pd-cat{display:flex;flex-direction:column;gap:8px}
/* a decisão sobre um pedido de uma pessoa (aceitar ou recusar), e a resposta proposta */
.pd-decisao{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid var(--line);border-radius:12px}
.pd-decisao p{flex:1 1 260px;display:flex;flex-direction:column;gap:2px}
.pd-decisao-tit{font-weight:600}
.pd-decisao-botoes{display:flex;gap:8px}
/* a resolução proposta de um ticket de segurança decidido: quem, quando e, por baixo, o texto */
.pd-resolucao{flex-direction:column;align-items:stretch;gap:8px}
.pd-resolucao p{flex:0 0 auto}
.pd-proposta{padding:10px 12px;border-radius:10px;background:var(--accent-soft);color:var(--accent-text)}
@container (max-width:660px){.pd-lado{border-left:0;border-top:1px solid var(--line)}}
/* o fio: o que a pessoa escreveu, as respostas e as notas internas */
.ms{display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:12px;background:var(--chip)}
.ms.equipa{background:var(--accent-soft)}
.ms.nota{background:var(--warn-soft);color:var(--warn)}
.ms-quem{font-size:13px;font-weight:600;color:var(--muted)}
.ms.nota .ms-quem{color:var(--warn)}
.ms-texto{white-space:pre-wrap;overflow-wrap:anywhere}
.ms-texto.mono{font-family:var(--letra-mono);font-size:12.5px;line-height:1.5;max-height:340px;overflow:auto}
/* a caixa de responder; o modo (Responder ou Nota interna) é um par de rádios */
.pd-resp{margin-top:4px;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:14px;border:1px solid var(--line2)}
.pd-resp-modos{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pd-resp-modos .menu{margin-left:auto}
.pd-resp-pe{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}
.pd-resp-pe>.sub{flex:1 0 100%}
.pd-resp .so-nota{display:none}
.pd-resp:has(#modoNota:checked) .so-nota{display:inline-flex}
.pd-resp:has(#modoNota:checked) .so-resposta{display:none}
.pd-resp:has(#modoNota:checked) textarea.campo{background:var(--warn-soft)}
.menu{position:relative}
.menu-lista{position:absolute;z-index:5;top:calc(100% + 6px);right:0;min-width:240px;max-width:min(360px,80vw);max-height:280px;overflow:auto;
  background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:6px}
.menu-op{display:block;width:100%;min-height:40px;padding:8px 12px;border:0;border-radius:8px;background:transparent;color:var(--ink);
  text-align:left;font-size:14px;cursor:pointer}
.menu-op:hover{background:var(--tint)}
/* abaixo dos 1200px não cabem os dois: a lista ou o pedido, com o Voltar */
@media(max-width:1199px){
  .pd{flex-direction:column;align-items:stretch}
  .pd-lista,.pd-det{flex:none;max-width:none}
  .pd.com-det .pd-lista,.pd-det-vazio{display:none}
  .pd-voltar{display:inline-flex}
}
@media(max-width:899px){
  .pd-det-cab,.pd-fio,.pd-lado{padding:14px}
  .pd-resp{padding:12px}
  .pd-resp-pe .btn{flex:1 1 auto}
  .pd-resp-pe .sub{flex:1 0 100%}
}

/* ---- pessoas: a procura e a ficha ---- */
.pp-busca{padding:14px;display:flex;flex-wrap:wrap;gap:10px}
.pp-busca .procura{flex:1 1 260px}
.pp-conta{padding:12px 18px}
.fi-busca{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.fi-busca .procura{flex:1 1 280px;max-width:520px}
.fi-busca .sub{flex:1 1 260px}
.fi-cab{padding:20px;display:flex;flex-wrap:wrap;gap:16px;align-items:center}
.fi-cab-txt{flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:4px}
.fi-nome{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.fi-nome h1{font-size:26px;overflow-wrap:anywhere}
.fi-cab .sub{font-size:14px;overflow-wrap:anywhere}
.fi-cab-acoes{display:flex;flex-wrap:wrap;gap:8px}
.fi-grelha{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
.fi-main{flex:999 1 520px;min-width:0;display:flex;flex-direction:column;gap:16px}
.fi-lado{flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:16px}
.kvs{padding:4px 20px 10px}
.kv{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:14px}
.kv:first-child{border-top:0}
.kv>span:first-child{flex:0 0 170px;color:var(--muted)}
.kv>span:last-child{flex:1;min-width:0;overflow-wrap:anywhere;display:flex;flex-direction:column;gap:2px}
@media(max-width:899px){.fi-cab{padding:14px}.fi-nome h1{font-size:22px}.kvs{padding:2px 14px 8px}.linha{padding:12px 14px}}
@media(max-width:520px){.kv{flex-direction:column;gap:2px}.kv>span:first-child{flex:none}}
/* o interruptor de cada serviço: 46×28, cobalto ligado */
.sv-grelha{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));border-top:1px solid var(--line);margin-bottom:-1px}
.sv{display:flex;align-items:center;gap:12px;min-height:60px;padding:12px 18px;border-bottom:1px solid var(--line);cursor:pointer}
.sv-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.sv-nome{font-weight:600}
.sv.off .sv-nome{color:var(--muted)}
.aviso-txt{color:var(--warn);font-weight:600}
/* a pergunta antes de desligar um serviço (equipa-guiao.js:mostrarAvisoDesligar): a faixa âmbar do canvas */
.sv-aviso{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:4px 18px 18px;padding:12px 14px;border-radius:12px;background:var(--warn-soft);color:var(--warn);font-size:14px}
.sv-aviso p{flex:1 1 280px;margin:0}
.sv-aviso-acoes{display:flex;gap:8px}
.sv-aviso .sv-aviso-sim{background:var(--warn);border-color:var(--warn);color:var(--card)}
.sw{position:relative;flex:none;width:46px;height:28px;border-radius:999px;border:0;padding:0;background:var(--line2);cursor:pointer;
  transition:background-color var(--medio) var(--curva)}
.sw::before{content:'';position:absolute;inset:-8px}
.sw::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--eq-branco);
  box-shadow:0 1px 2px rgba(16,24,40,.24);transition:transform var(--medio) var(--curva)}
.sw[aria-checked="true"]{background:var(--accent)}
.sw[aria-checked="true"]::after{transform:translateX(18px)}
.sw:disabled{opacity:.45;cursor:not-allowed}
.acoes-cartao .btn.lista{min-height:44px}
.rs-pessoa .linha{min-height:0;padding:8px 0;border-top:0;font-size:13.5px}

/* ---- operação ---- */
.hb-fila,.st-fila{display:flex;flex-wrap:wrap;gap:12px}
.hb{flex:1 1 240px;display:flex;flex-direction:column;gap:6px;padding:16px;border-radius:14px;border:1px solid var(--line);background:var(--card)}
.hb.wa{border-color:color-mix(in srgb,var(--warn) 45%,var(--line));background:color-mix(in srgb,var(--warn-soft) 60%,var(--card))}
.hb.wa .sub{color:var(--warn)}
.hb.dg{border-color:color-mix(in srgb,var(--danger) 45%,var(--line));background:color-mix(in srgb,var(--danger-soft) 60%,var(--card))}
.hb.dg .sub{color:var(--danger)}
.hb-topo{display:flex;align-items:center;gap:8px}
.hb-nome{font-weight:600;flex:1;min-width:0}
.seccao-tit{font-size:20px}
.op-consumo{display:flex;flex-direction:column;gap:12px}
.st{flex:1 1 150px;display:flex;flex-direction:column;gap:2px;padding:14px 16px;border-radius:14px;background:var(--card);border:1px solid var(--line);min-width:0}
.st-valor{font-family:var(--letra-titulo);font-size:30px;font-weight:650;letter-spacing:-.015em;line-height:1.15;overflow-wrap:anywhere}
.st-valor small{font-family:var(--letra);font-size:15px;font-weight:500;color:var(--muted);letter-spacing:0}
.st .sub.wa{color:var(--warn);font-weight:600}
.st .sub.dg{color:var(--danger);font-weight:600}
.op-duas{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
.op-tectos{flex:999 1 460px;overflow:hidden}
.op-pesadas{flex:1 1 300px}
.lm{display:flex;flex-direction:column;gap:6px;padding:12px 18px;border-top:1px solid var(--line)}
.lm-topo{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.lm-nome{flex:1 1 180px;min-width:0}
.lm-pct{min-width:44px;text-align:right;color:var(--muted);font-size:13px}
.lm-pct.wa{color:var(--warn);font-weight:600}
.lm-pct.dg{color:var(--danger);font-weight:700}
.barra{display:block;width:100%;height:8px;border:0;border-radius:4px;background:var(--chip);overflow:hidden;-webkit-appearance:none;appearance:none;color:var(--accent)}
.barra::-webkit-progress-bar{background:var(--chip);border-radius:4px}
.barra::-webkit-progress-value{background:var(--accent);border-radius:4px}
.barra::-moz-progress-bar{background:var(--accent);border-radius:4px}
.barra.wa::-webkit-progress-value{background:var(--warn)}
.barra.wa::-moz-progress-bar{background:var(--warn)}
.barra.dg::-webkit-progress-value{background:var(--danger)}
.barra.dg::-moz-progress-bar{background:var(--danger)}
.ps{display:flex;gap:10px;align-items:baseline;font-size:14px;padding:8px 0;border-top:1px solid var(--line)}
.ps:first-of-type{border-top:0}
.ps code{flex:1;min-width:0;color:var(--muted);font-size:12.5px;overflow-wrap:anywhere}
.op-resumo{margin:0 18px 16px;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.op-resumo-cab{padding:12px 16px;display:flex;flex-direction:column;gap:2px;background:var(--chip)}
.op-teste-botoes{padding-top:2px}
/* as contas de teste na lista das sessões (equipa-guiao.js:contaDeTesteHtml):
   uma secção que abre e fecha por conta, fechada à partida; a seta vira
   quando abre */
.st-contas{border-top:1px solid var(--line)}
.st-contas+.card-pe{border-top:1px solid var(--line);padding-top:16px}
.st-conta+.st-conta{border-top:1px solid var(--line)}
.st-conta>summary{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;min-height:48px;padding:13px 18px;cursor:pointer;list-style:none}
.st-conta>summary::-webkit-details-marker{display:none}
.st-conta>summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
@media(hover:hover){.st-conta>summary:hover{background:var(--tint)}}
.st-seta{display:inline-flex;align-self:center;color:var(--muted);transform:rotate(-90deg)}
.st-conta[open]>summary .st-seta{transform:none}
.st-corpo{padding:0 0 8px}
.st-acoes{padding:0 18px 10px}
@media(max-width:899px){.st-conta>summary{padding:13px 14px}.st-acoes{padding:0 14px 10px}}
.end-form{padding:14px 18px 18px;border-top:1px solid var(--line);background:var(--chip);display:flex;flex-direction:column;gap:10px}
.end-campos{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
.end-campos .campo-bloco{flex:1 1 200px}
.end-campos .end-motivo{flex:2 1 240px}
.end-campos .btn{margin-top:26px}
@media(max-width:899px){.st-valor{font-size:21px}.op-resumo{margin:0 14px 14px}.end-form{padding:14px}.end-campos .btn{margin-top:0;width:100%}}

/* ---- rasto ---- */
.rs-filtro{padding:14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.rs-filtro .procura{flex:1 1 260px;max-width:420px}
/* o voltar da linha do tempo é filho do miolo (uma coluna): sem isto estica e centra */
.rs-volta{align-self:flex-start}
/* o rasto das pessoas (equipa-guiao.js:verRastoPessoas, verRastoResumo,
   verRastoPessoa): as abas, a barra dos filtros, o pseudónimo em monoespaçado,
   os selos dos sinais com contorno e letra na cor (lêem-se quando o browser
   escurece o fundo à força) e a linha de cada sinal marcada no contorno */
.rs-abas{gap:8px}
.rs-barra{padding:14px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
.rs-pid{font-family:var(--letra-mono);font-weight:600;letter-spacing:.02em;white-space:nowrap}
.cab h1 .rs-pid{font-size:.8em}
.rs-pessoa-id{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end}
.rs-sinais{display:inline-flex;flex-wrap:wrap;gap:4px;justify-content:flex-end}
.badge.rs-s{border:1px solid currentColor}
.badge.rs-s b{font-weight:700}
.rs-tb td{vertical-align:top}
.rs-alvo-bloco{display:flex;flex-direction:column;gap:2px;min-width:0}
/* o que se fez, em palavras (rastoFezHtml): o rótulo do botão a forte, e o
   descritor que o dicionário não conhece cru e discreto, em monoespaçado */
.rs-rotulo{font-weight:600}
.rs-cru{font-family:var(--letra-mono);font-size:12px;color:var(--muted);overflow-wrap:anywhere}
/* o topo de cada sessão: as páginas visitadas e os registos que mudou */
.rs-sessao-resumo{display:flex;flex-direction:column;gap:4px;padding:12px 18px 0;font-size:13.5px}
.rs-sessao-resumo p{margin:0}
.rs-tb td.rs-n{font-weight:700}
.rs-tb td.rs-n.wa{color:var(--warn)}
.rs-tb td.rs-n.dg{color:var(--danger)}
.rs-ev tr.rs-sinal td:first-child{box-shadow:inset 3px 0 0 var(--warn)}
.rs-ev tr.rs-sinal.dg td:first-child{box-shadow:inset 3px 0 0 var(--danger)}
.rs-ev tr.rs-sinal td{color:var(--warn);font-weight:600}
.rs-ev tr.rs-sinal.dg td{color:var(--danger)}
.rs-ev tr.rs-passa td{padding:8px 16px;color:var(--accent-text);font-weight:600;font-size:13px;border-top:1px dashed var(--accent)}
.rs-ev tr.rs-passa .i{vertical-align:-3px;margin-right:6px}
.rs-sessoes{display:flex;flex-direction:column;gap:10px}
.rs-sessao{overflow:hidden}
.rs-sessao>summary{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;min-height:48px;padding:12px 18px;cursor:pointer;list-style:none}
.rs-sessao>summary::-webkit-details-marker{display:none}
.rs-sessao>summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.rs-sessao[open]>summary{border-bottom:1px solid var(--line)}
.rs-sessao[open]>summary .st-seta{transform:none}
.rs-sessao-selos{display:inline-flex;flex-wrap:wrap;gap:4px;margin-left:auto}
.rs-passa-entre{display:flex;align-items:center;gap:8px;padding:2px 18px;color:var(--accent-text);font-size:13px;font-weight:600}
.rs-passa-entre .i{transform:rotate(-90deg)}
.rs-no-pedido{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.rs-no-pedido:empty,.rs-na-ficha:empty{display:none}
.rs-na-ficha .btn .rs-pid{font-size:13px}
.rs-legenda>summary{display:flex;align-items:center;gap:10px;min-height:48px;padding:12px 18px;cursor:pointer;list-style:none}
.rs-legenda>summary::-webkit-details-marker{display:none}
.rs-legenda>summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.rs-legenda[open]>summary .st-seta{transform:none}
.rs-legenda dl{margin:0;padding:0 18px 16px;display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:baseline}
.rs-legenda dd{margin:0}
abbr[title]{text-decoration:none}
@media(hover:hover) and (pointer:fine){.rs-sessao>summary:hover,.rs-legenda>summary:hover{background:var(--tint)}}
@media(max-width:899px){.rs-sessao>summary,.rs-legenda>summary{padding:12px 14px}.rs-legenda dl{padding:0 14px 14px}.rs-passa-entre{padding:2px 14px}.rs-sessao-resumo{padding:12px 14px 0}}
@media(max-width:640px){
  .rs-ev tr.rs-sinal{box-shadow:inset 3px 0 0 var(--warn)}
  .rs-ev tr.rs-sinal.dg{box-shadow:inset 3px 0 0 var(--danger)}
  .rs-ev tr.rs-sinal td:first-child{box-shadow:none}
  .tb.empilha tr.rs-passa td{display:block;text-align:left;padding:4px 0}
  .tb.empilha tr.rs-passa td::before{content:none}
  .rs-legenda dl{grid-template-columns:1fr}
  .rs-sessao-selos{margin-left:0}
}

/* o dedo precisa de 44px; e quem pediu menos movimento não vê a roda a correr */
@media(pointer:coarse){.btn.sm,.chip,.nv,.eq-sair,.menu-op,.ligacao{min-height:44px}.eq-toast-x{width:44px;height:44px}.lado-linha{padding:10px 0}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition-duration:0s!important}.roda{animation-duration:2.4s}}
`;

/* O ecrã de entrada, para quem ainda não está dentro: o cartão com a faixa
   grafite da marca, um título e o que fazer a seguir.
   Recebe: titulo — o título do cartão (texto, já seguro); corpo — o HTML do
   que vem por baixo (string, com as interpolações já escapadas).
   Devolve: o HTML do miolo da página (string). */
function cartaoDeEntrada(titulo, corpo) {
  return `<main class="entrada"><div class="card entrada-cartao">
    <div class="entrada-topo">${marcaDaEquipa()}</div>
    <div class="entrada-corpo"><h1>${titulo}</h1>${corpo}</div>
  </div></main>`;
}

/* A pílula do QA no back office do dev: os dados dela (o ambiente e quem
   está, com o id de autor dos tickets — rotas/qa.js:autorDaEquipa) e o
   /equipa/qa.js, depois do guião (equipa-qa.js).
   Recebe: eu — a sessão de equipa; ambiente — o env.ENV_NAME ('' ou nada em produção).
   Devolve: o HTML (texto, vazio sem ambiente). */
function htmlDoQa(eu, ambiente) {
  if (!ambiente) return '';
  const dados = { ambiente: String(ambiente), id: autorDaEquipa(eu), nome: eu.nome || '' };
  return `\n<script type="application/json" id="dados-qa">${paraScript(dados)}</script>
<script src="/equipa/qa.js"></script>`;
}

// Quem não tem sessão não vê a ferramenta, nem sabe o que lá está.
// Recebe: eu — a sessão de equipa (objeto com nome, discordId e papeis/papel),
// ou nada quando não há sessão válida; opcoes (opcional) — {qa: o
// env.ENV_NAME do dev, '' em produção}: com ele a página leva a pílula do QA
// (equipa-qa.js), o seu CSS e os dados dela.
// Devolve: Response HTML — a ferramenta inteira com sessão; sem ela, o ecrã
// que manda ir ao /entrar do Discord (401).
export function paginaEquipa(eu, opcoes) {
  if (!eu) {
    return new Response(pagina(cartaoDeEntrada('Ferramenta de equipa', `
      <p class="sub">Entra-se a partir do Discord. A ligação que o bot dá vale cinco minutos e uma só utilização.</p>
      <ol class="entrada-passos">
        <li>No servidor do Discord, corre <b>/entrar</b>.</li>
        <li>Abre a ligação que o bot te manda.</li>
        <li>Carrega em <b>Entrar</b>.</li>
      </ol>`), 'Entrar'), {
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

  // a barra lateral: a marca, os separadores (o guião pinta-os no #nav, só os
  // que os papéis abrem), a Documentação e quem está dentro, com o Sair
  const corpo = `<div class="eq-app">
  <nav class="eq-lado" aria-label="Equipa">
    <div class="eq-marca">${marcaDaEquipa()}</div>
    <div class="eq-itens">
      <div class="eq-nav" id="nav"></div>
      <div class="eq-sep" aria-hidden="true"></div>
      <a class="nv" href="/equipa/docs">${ICONE_DOCS}<span>Documentação</span></a>
    </div>
    <div class="eq-quem">
      <div class="eq-quem-txt"><p class="eq-quem-nome">${escapar(eu.nome)}</p><p class="eq-quem-papel">${escapar(papeis.join(' · ') || 'sem papel')}</p></div>
      <button type="button" class="eq-sair" data-acao="sair">Sair</button>
    </div>
  </nav>
  <main class="eq-main"><div class="eq-miolo" id="conteudo"><div class="espera" role="status"><span class="roda" aria-hidden="true"></span><span><b>À espera do servidor.</b></span></div></div></main>
  </div>
  <div class="eq-toast" id="aviso" role="status" aria-live="polite"></div>
  <dialog class="janela" id="dialogo" aria-labelledby="janelaTit"></dialog>
<script type="application/json" id="dados-equipa">${paraScript({ eu: dados, ESTADOS, CATS })}</script>
<script src="/equipa/guiao.js"></script>${htmlDoQa(eu, opcoes && opcoes.qa)}`;

  return new Response(pagina(corpo, 'Equipa', !!(opcoes && opcoes.qa)), {
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
    return new Response(pagina(cartaoDeEntrada('Não dá para entrar', `
      <p>${porque}</p>
      <p class="sub">Corre <b>/entrar</b> outra vez no Discord para teres outra.</p>`), 'Entrar'), { status: 410, headers: cabecalhos });
  }

  const quem = v.quem || {};
  const papeis = (quem.papeis && quem.papeis.length ? quem.papeis : [quem.papel]).filter(Boolean);
  return new Response(pagina(cartaoDeEntrada('Ferramenta de equipa', `
      <p class="entrada-quem">Entras como <b>${escapar(quem.nome || '')}</b>
        <span class="badge ac">${escapar(papeis.join(' · ') || 'sem papel')}</span></p>
      <form method="POST" action="/equipa/entrar">
        <input type="hidden" name="t" value="${escapar(token)}">
        ${depois === 'docs' ? '<input type="hidden" name="depois" value="docs">' : ''}
        <button class="btn primary largo" type="submit">Entrar</button>
      </form>
      <p class="sub">A ligação vale uma vez só e gasta-se ao carregares em Entrar.</p>`), 'Entrar'), { status: 200, headers: cabecalhos });
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
