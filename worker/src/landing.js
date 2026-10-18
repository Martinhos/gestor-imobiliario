/* A página de entrada do rendorium.com.
   -------------------------------------
   Servida pelo worker quando o pedido chega pelo domínio raiz (ou www) — a app
   vive em app.rendorium.com e não se mistura. Escrita à mão, sem dependências,
   na mesma linguagem da app — o cobalto, o azul-noite, a Geist no corpo e a
   Bricolage Grotesque nos títulos —: quem clica em «Abrir a app» não pode
   sentir que mudou de produto.

   A página MOSTRA o produto, e já não com capturas: o telemóvel e o
   computador são maquetes desenhadas em HTML e CSS, com o mosaico da marca
   por trás. Uma captura envelhecia a cada mudança da app, pesava o dobro por
   vir nos dois temas e era a única coisa que a página descarregava além do
   texto; a maquete segue os tokens, muda de tema com quem lê e não pesa
   nada. Os números da maquete são de um portefólio inventado (RECEITA_MES,
   DESPESA_MES, PRESTACAO_MES) e fecham entre si: a receita e as despesas são
   a soma das barras, e o cashflow é o que sobra delas e das prestações. Cada
   maquete é um role="img" com a descrição do que mostra.

   As letras são as da app, auto-alojadas em web/fonts/ e servidas em /fonts/
   em qualquer domínio (a CSP só deixa font-src 'self'): nada do Google
   Fonts. A imagem de partilha (og:image) continua a ser um ficheiro, porque
   quem a mostra é a rede social, não esta página.

   Não tem JavaScript nenhum. As animações — a entrada do hero, as revelações
   ao scroll, a risca do cabeçalho — são CSS puro: as guiadas pelo scroll
   vivem atrás de @supports (animation-timeline), e um motor que não as saiba
   correr mostra a página feita, sem esconder nada. Com os recuos de menos
   movimento, menos transparência e mais contraste.

   O Rendorium é um projeto pessoal, sem planos nem pagamentos, e a página
   di-lo por palavras — é a pergunta que qualquer pessoa faz a seguir a «o que
   é isto?». */

import { CSP_ESTRITA } from './lib/http.js';

const APP = 'https://app.rendorium.com';
const IMG = '/img/landing';

/* O portefólio inventado das maquetes: dez meses de rendas e de despesas, e
   uma prestação fixa. Os indicadores saem daqui por soma, e as barras também
   (alturasDasBarras), para o número e o desenho nunca se contradizerem. */
const RECEITA_MES = [3115, 3115, 3255, 3115, 3115, 3115, 3115, 3115, 2425, 2425];
const DESPESA_MES = [420, 380, 610, 350, 1180, 410, 395, 870, 1012, 685];
const PRESTACAO_MES = 1106.4;
const RECEITA = RECEITA_MES.reduce((a, b) => a + b, 0);
const DESPESAS = DESPESA_MES.reduce((a, b) => a + b, 0);
const PRESTACOES = Math.round(PRESTACAO_MES * RECEITA_MES.length);
const CASHFLOW = RECEITA - DESPESAS - PRESTACOES;
// a escala das barras: um mês com esta receita encheria os 90 px
const TECTO = 3300;

/* Um valor em euros como a app o escreve (web/app/formato.js:money): os
   milhares com espaço fino, a vírgula decimal, o € no fim e o sinal de menos
   tipográfico. Fica repetido e não importado porque o formato.js é um script
   do browser, não um módulo do worker.
   Recebe: v — o valor em euros (número); dec2 — verdadeiro para mostrar duas
   casas decimais, falso para arredondar ao euro inteiro.
   Devolve: o texto, ex.: «29 910 €» ou «−412,30 €». */
function eurosDaMontra(v, dec2) {
  const a = Math.abs(v);
  const [inteiro, decimal] = (dec2 ? a.toFixed(2) : String(Math.round(a))).split('.');
  return (v < 0 ? '−' : '') + inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') +
    (decimal ? ',' + decimal : '') + ' €';
}

/* As alturas das barras das duas maquetes, em regras de CSS: a página vai com
   a CSP_ESTRITA, que não aplica um atributo de estilo, e por isso cada barra
   recebe a sua altura por :nth-child. A escala é a mesma nas duas (90 px
   para o TECTO).
   Devolve: o texto das regras, uma por barra. */
function alturasDasBarras() {
  const px = (v) => Math.round((v / TECTO) * 90);
  return RECEITA_MES.map((v, i) => `.barras-tel span:nth-child(${i + 1}){height:${px(v)}px}
.barras-pc .mes:nth-child(${i + 1}) .r{height:${px(v)}px}
.barras-pc .mes:nth-child(${i + 1}) .d{height:${px(DESPESA_MES[i])}px}`).join('\n');
}

/* Um ícone de traço da casa (o desenho de icones.js:ic: grelha de 24, traço
   1.8, pontas redondas, a cor do texto), decorativo.
   Recebe: d — o caminho SVG; classe (opcional) — classes a somar à .i.
   Devolve: o HTML do <svg>, escondido dos leitores de ecrã. */
function icone(d, classe) {
  return `<svg class="i${classe ? ' ' + classe : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

/* Os quatro indicadores do ano das maquetes, com os números do portefólio
   inventado; o cashflow vai no cartão azul-noite, como na Visão geral.
   Devolve: o HTML dos quatro cartões. */
function indicadores() {
  return [['Receita', RECEITA], ['Despesas', DESPESAS], ['Prestações', PRESTACOES]]
    .map(([rotulo, v]) => `<div class="m-kpi"><p class="m-sub">${rotulo}</p><p class="tit">${eurosDaMontra(v)}</p></div>`)
    .join('') +
    `<div class="m-kpi noite"><p>Cashflow</p><p class="tit">${eurosDaMontra(CASHFLOW)}</p></div>`;
}

// o que a app faz, com o tom do quadrado do ícone (as cores suaves do contrato)
const CAPACIDADES = [
  { titulo: 'Rendas sem esforço', tom: 'in', d: 'M17 2l3 3-3 3M3 11V9a4 4 0 0 1 4-4h13M7 22l-3-3 3-3M21 13v2a4 4 0 0 1-4 4H4',
    texto: 'O contrato gera o movimento planeado. Todos os meses basta confirmar, e a renda fica registada com a data, o valor e o inquilino certos.' },
  { titulo: 'Contratos e inquilinos', tom: 'ac', d: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6',
    texto: 'Fichas, prazos, caução e o contrato em PDF já preenchido com os teus dados e os do inquilino, pronto a rever.' },
  { titulo: 'Contas entre proprietários', tom: 'out', d: 'M16 3l4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12',
    texto: 'Quotas por imóvel, quem pagou o quê e quanto falta acertar entre vocês.' },
  { titulo: 'Créditos à habitação', tom: 'loan', d: 'M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3l9 5H3z',
    texto: 'Capital, juros e imposto do selo separados em cada prestação, as amortizações e o plano até ao fim.' },
  { titulo: 'O Anexo F, linha a linha', tom: 'warn', d: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    texto: 'O quadro 4.1 por ano e por dono, e os prazos da AT lembrados a tempo: Modelo 2, recibos, 15 de fevereiro, IRS. A app resume, não declara.' },
  { titulo: 'Visitas e prazos', tom: 'ac', d: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
    texto: 'Quem vem ver que imóvel e quando, e um aviso antes de um contrato acabar.' },
];

// o que fica do lado de quem usa a app
const DADOS = [
  'Cópia de segurança num toque e exportação em CSV.',
  'A conta apaga-se dentro da app, sem pedir a ninguém.',
  'Funciona sem rede e sincroniza quando ela voltar, em vários aparelhos.',
  'Partilhas o que quiseres: um comproprietário vê as contas do imóvel; um contabilista vê os movimentos e mais nada.',
];

// os traços dos dois ícones que não são de capacidade: o aviso e o visto
const AVISO = 'M12 8v5M12 16.5v.5M10.3 3.8L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z';
const VISTO = 'M5 12.5l4.5 4.5L19 7';

/* Constrói a página inteira e devolve-a como Response com uma hora de cache —
   a página muda quando se publica, não por pedido. Os estilos não vão dentro
   dela: estão no CSS_LANDING, servido em /paginas/landing.css, e a página
   vai com a CSP_ESTRITA.

   Fora do domínio raiz isto é uma pré-visualização (dev.rendorium.com/montra,
   ou o servidor local): leva `noindex` e não declara canonical nem og. Duas
   cópias da mesma página indexadas são uma a competir com a outra, e um og que
   aponta para produção a partir de um sítio que não é produção mente a quem
   partilhar a ligação.
   Recebe: op — {raiz: true} quando isto está mesmo a ser servido em
   rendorium.com; qualquer outra coisa vale pré-visualização.
   Devolve: uma Response HTML com a página completa e uma hora de cache. */
export function paginaLanding(op) {
  const raiz = !!(op && op.raiz);
  const cabecaRaiz = raiz ? `<meta property="og:type" content="website">
<meta property="og:title" content="Rendorium — o teu portefólio de arrendamento, arrumado">
<meta property="og:description" content="Imóveis, contratos, rendas, créditos e o IRS num só sítio. Grátis, sem planos e sem meio de pagamento.">
<meta property="og:url" content="https://rendorium.com">
<meta property="og:image" content="https://rendorium.com${IMG}/partilha.webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pt_PT">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://rendorium.com">`
    : '<meta name="robots" content="noindex,nofollow">';
  const html = `<!doctype html>
<html lang="pt-PT"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F2F3F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B111E" media="(prefers-color-scheme: dark)">
<title>Rendorium — o teu portefólio de arrendamento, arrumado</title>
<meta name="description" content="Imóveis, contratos, rendas, créditos e IRS num só sítio. Grátis, sem planos. Um projeto pessoal para senhorios portugueses.">
${cabecaRaiz}
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/paginas/landing.css">
</head><body>
<div class="faixa-topo">
  <header>
    <span class="marca"><span class="mark" aria-hidden="true"></span><span class="tit">Rendorium</span></span>
    <a class="btn fantasma pequeno entrar" href="${APP}">Entrar</a>
    <a class="btn primary pequeno" href="${APP}/?criar=1">Criar conta</a>
  </header>
</div>
<main>

  <section class="wrap hero">
    <div class="hero-texto">
      <h1>O teu portefólio de arrendamento, arrumado.</h1>
      <p class="sub">Imóveis, contratos, rendas, créditos e o IRS num só sítio — para quem
      hoje gere tudo em Excel, papel e memória.</p>
      <div class="cta">
        <a class="btn primary" href="${APP}/?criar=1">Criar conta grátis</a>
        <a class="btn" href="${APP}">Já tenho conta</a>
      </div>
      <p class="gratis">Grátis, sem planos e sem meio de pagamento. No browser, no telemóvel
      ou instalada como app.</p>
    </div>
    <div class="hero-visual">
      <div class="tile" aria-hidden="true"></div>
      <div class="telemovel" role="img" aria-label="A Visão geral da Rendorium num telemóvel: receita, despesas, prestações e cashflow do ano, e o que pede atenção.">
        <div class="ecra">
          <p class="tit ecra-titulo">Visão geral</p>
          <div class="m-cartao m-atencao"><span class="m-icone">${icone(AVISO)}</span><span><strong>3 por confirmar</strong><br><span class="m-sub">1 em atraso</span></span></div>
          <div class="m-kpis n">${indicadores()}</div>
          <div class="m-cartao barras-tel">${RECEITA_MES.map(() => '<span></span>').join('')}</div>
          <div class="tile m-capa"></div>
          <p class="m-imovel">T3 Bonfim <span class="m-sub">· 3/4 quartos</span></p>
        </div>
      </div>
    </div>
  </section>

  <section class="faz">
    <div class="wrap">
      <h2>O que faz</h2>
      <div class="grelha">
        ${CAPACIDADES.map((c) => `<div class="cartao"><span class="ic ${c.tom}">${icone(c.d)}</span><h3>${c.titulo}</h3><p>${c.texto}</p></div>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="wrap par-pc">
    <div class="pc-texto">
      <h2>No computador, a mesma app — sem instalar nada.</h2>
      <p class="sub">Receita, despesas, prestações e cashflow do ano, por mês e por imóvel.</p>
    </div>
    <div class="computador" role="img" aria-label="A Rendorium no computador: a barra lateral azul-noite e a Visão geral, com os quatro indicadores do ano e as receitas e despesas mês a mês.">
      <div class="pc-barra">
        <div class="pc-marca"><span class="mark"></span><span>Rendorium</span></div>
        <span class="pc-item"></span><span class="pc-traco"></span><span class="pc-traco"></span><span class="pc-traco"></span><span class="pc-traco"></span>
      </div>
      <div class="pc-corpo">
        <p class="tit pc-titulo">Visão geral</p>
        <div class="m-kpis quatro n">${indicadores()}</div>
        <div class="m-cartao barras-pc">${RECEITA_MES.map(() => '<span class="mes"><span class="r"></span><span class="d"></span></span>').join('')}</div>
      </div>
    </div>
  </section>

  <section class="banda-noite">
    <div class="wrap par">
      <div class="par-texto">
        <h2>Contas entre donos, sem folhas de cálculo.</h2>
        <p>Cada movimento sabe quem pagou e por quem se divide. A app diz quem paga a quem e
        liquida tudo de uma vez. Despesas divididas por valor ou em partes iguais; dívidas a
        terceiros à parte.</p>
      </div>
      <div class="acerto n" role="img" aria-label="Um exemplo das contas entre dois donos: a Maria tem ${eurosDaMontra(412.3, true)} a receber e o Pedro ${eurosDaMontra(412.3, true)} a pagar, e a app propõe que o Pedro pague à Maria.">
        <div class="saldos">
          <div class="saldo mais"><p>Maria</p><p class="valor">+${eurosDaMontra(412.3, true)}</p></div>
          <div class="saldo menos"><p>Pedro</p><p class="valor">${eurosDaMontra(-412.3, true)}</p></div>
        </div>
        <div class="proposta"><p>Pedro paga ${eurosDaMontra(412.3, true)} a Maria</p><span class="botao-maquete">Acertar contas</span></div>
      </div>
    </div>
  </section>

  <section class="wrap dados">
    <div class="dados-lista">
      <h2>Os dados são teus</h2>
      <ul class="lista">
        ${DADOS.map((t) => `<li>${icone(VISTO, 'ok')}<span>${t}</span></li>`).join('\n        ')}
      </ul>
    </div>
    <div class="projeto">
      <h2>Um projeto pessoal</h2>
      <p class="sub">Nasceu para gerir o portefólio do autor. É grátis, sem planos e sem limite de
      imóveis. As mudanças ficam registadas na app, em Novidades; as importantes são avisadas
      com antecedência, sem perda de dados.</p>
    </div>
  </section>

  <section class="wrap fecho-seccao">
    <div class="fecho">
      <div class="tile fecho-mosaico" aria-hidden="true"></div>
      <div class="fecho-texto">
        <h2>Começa pelo primeiro imóvel</h2>
        <p>Leva dois minutos, e a partir daí é só confirmar as rendas.</p>
      </div>
      <a class="btn" href="${APP}/?criar=1">Criar conta grátis</a>
    </div>
  </section>

</main>
<footer class="wrap rodape">
  <span class="rodape-marca"><span class="mark" aria-hidden="true"></span><span>© ${new Date().getFullYear()} Rendorium</span></span>
  <a href="/termos">Termos e Condições</a>
  <a href="/privacidade">Política de Privacidade</a>
  <a href="${APP}">Abrir a app</a>
</footer>
</body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // a página muda quando se publica, não por pedido — mas a
      // pré-visualização existe precisamente para ver alterações, e uma hora
      // de cache fazia-a mentir durante uma hora
      'Cache-Control': raiz ? 'public, max-age=3600' : 'no-store',
      'Content-Security-Policy': CSP_ESTRITA,
    },
  });
}

/* Os estilos da página, servidos à parte em /paginas/landing.css
   (paginas-recursos.js): a página vai com a CSP_ESTRITA, que não aplica uma
   folha escrita dentro do próprio HTML (a etiqueta de estilo em linha). */
export const CSS_LANDING = `/* As letras da app, auto-alojadas (a CSP só deixa font-src 'self'). As
   mesmas declarações vivem no CSS_LEGAL (legal-vista.js) e no CSS_TESTE
   (teste.js), e um teste confere que as três não divergem. Variáveis: a Geist
   de 100 a 900, a Bricolage Grotesque de 200 a 800, com o eixo ótico, que o
   browser acerta sozinho pelo tamanho. O unicode-range é o latino: o que
   cair fora dele vem da letra seguinte da pilha, sem descarregar nada. */
@font-face{font-family:'Geist';src:url(/fonts/geist.woff2) format('woff2');font-weight:100 900;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Bricolage Grotesque';src:url(/fonts/bricolage-grotesque.woff2) format('woff2');font-weight:200 800;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}

/* os tokens da app (o contrato do redesign), com os mesmos nomes: quem
   clica em «Abrir a app» não pode sentir que mudou de produto */
:root{color-scheme:light dark;
  --bg:#F2F3F6;--card:#FFFFFF;--tint:#F6F7F9;--press:#E9ECF2;
  --ink:#121826;--muted:#4F586B;--line:#E2E5EB;--line2:#CDD2DB;
  --accent:#2952D9;--accent-ink:#FFFFFF;--accent-soft:#E9EEFC;--accent-text:#1D3FB0;--accent-press:#1D3FB0;
  --in:#16775A;--in-soft:#E2F3EB;--out:#BD420C;--out-soft:#FCEADF;--loan:#6845C2;--loan-soft:#EFEAFB;
  --warn:#8F5600;--warn-soft:#FFF1D1;--danger:#B42318;--danger-soft:#FDE8E6;
  --side:#0E1830;--side-ink:#FFFFFF;--side-text:#C2CBE0;--side-on:rgba(255,255,255,.12);--side-line:#22305A;
  --blur:rgba(242,243,246,.94);
  /* só da montra. A marca é cobalto nos dois temas (é a marca, não um
     estado); a moldura do telemóvel é quase preta nos dois; os traços da
     barra lateral da maquete, o tracejado e os saldos do bloco azul-noite e
     o bloco final são os valores da prancheta Landing. */
  --marca:#2952D9;--marca-arco:#FFFFFF;
  --moldura:#0B0F1A;--moldura-anel:transparent;
  --sombra-maquete:0 30px 60px rgba(14,24,48,.28);--sombra-janela:0 24px 48px rgba(14,24,48,.14);
  --mosaico-fundo:#DCE4FB;--mosaico-traco:#3A5FD6;
  --side-traco:#2A3A63;--side-tracejado:#2C3A5E;
  --saldo-mais:#8FE3C0;--saldo-mais-fundo:rgba(76,199,154,.14);
  --saldo-menos:#FFB27A;--saldo-menos-fundo:rgba(255,154,98,.14);
  --fecho-fundo:#2952D9;--fecho-tinta:#FFFFFF;--fecho-sub:#DCE4FB;
  --fecho-botao:#FFFFFF;--fecho-botao-tinta:#1D3FB0;--fecho-botao-hover:#E9EEFC;--fecho-mosaico:rgba(255,255,255,.35);
  /* movimento: os tokens da app (--rapido, --curva, --curva-entra), para
     quem clica em «Abrir a app» não sentir que mudou de produto também no
     tempo. O --entrada é só daqui: uma montra pode demorar mais do que uma
     app a responder, e .65s é o degrau de quem chega pela primeira vez. */
  --rapido:.12s;--entrada:.65s;
  --curva:cubic-bezier(.22,1,.36,1);--curva-entra:cubic-bezier(0,0,.2,1)}
/* o tema escuro de quem lê, com os tokens escuros do contrato. No escuro o
   bloco final passa a cobalto suave (um bloco #7C9BFF daquele tamanho
   encandeava) e a moldura do telemóvel ganha um anel, senão sumia no fundo. */
@media(prefers-color-scheme:dark){:root{
  --bg:#0B111E;--card:#141C2C;--tint:#1A2335;--press:#253049;
  --ink:#E9EDF5;--muted:#AEB7C9;--line:#253049;--line2:#33405C;
  --accent:#7C9BFF;--accent-ink:#0B111E;--accent-soft:#1E2A4D;--accent-text:#B5C6FF;--accent-press:#9DB3FF;
  --in:#4CC79A;--in-soft:#123327;--out:#FF9A62;--out-soft:#3A2216;--loan:#B49BFF;--loan-soft:#2A2247;
  --warn:#F2C25A;--warn-soft:#352A12;--danger:#FF8A80;--danger-soft:#3D1A1A;
  --side:#070C17;--side-text:#9AA6C0;--side-line:#1A2440;
  --blur:rgba(11,17,30,.92);
  --moldura-anel:#33405C;
  --sombra-maquete:0 30px 60px rgba(0,0,0,.55);--sombra-janela:0 24px 60px rgba(0,0,0,.6);
  --mosaico-fundo:#1E2A4D;--mosaico-traco:#3A5FD6;
  --fecho-fundo:#1E2A4D;--fecho-tinta:#E9EDF5;--fecho-sub:#AEB7C9;
  --fecho-botao:#7C9BFF;--fecho-botao-tinta:#0B111E;--fecho-botao-hover:#9DB3FF;--fecho-mosaico:rgba(124,155,255,.28)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;
  padding:0 env(safe-area-inset-right) 0 env(safe-area-inset-left)}
/* os títulos e os valores grandes na Bricolage, como na app */
h1,h2,h3,.tit{font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-weight:650;
  letter-spacing:-.02em;margin:0}
h1,h2{text-wrap:balance}
p{margin:0;text-wrap:pretty}
a{color:var(--accent)}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}
.n{font-variant-numeric:tabular-nums}
.wrap{max-width:1160px;margin:0 auto;padding-left:clamp(16px,4vw,40px);padding-right:clamp(16px,4vw,40px)}
.i{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}

/* a marca: o quadrado cobalto com dois arcos brancos em cantos opostos, em
   CSS e não em imagem. Os arcos vão em percentagem do raio do gradiente, para
   o mesmo desenho servir aos 34, 24 e 22 px. */
.mark{display:block;flex:none;width:34px;height:34px;border-radius:9px;
  background:radial-gradient(circle at 0 0,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),
    radial-gradient(circle at 100% 100%,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),var(--marca)}
/* o mosaico das capas sem fotografia: arcos e pontos, pintados pelos dois
   tokens, que cada uso pode trocar no próprio elemento */
.tile{background-color:var(--mosaico-fundo);
  background-image:radial-gradient(circle at 0 0,transparent 12px,var(--mosaico-traco) 12.5px,var(--mosaico-traco) 15px,transparent 15.5px),
    radial-gradient(circle at 100% 100%,transparent 12px,var(--mosaico-traco) 12.5px,var(--mosaico-traco) 15px,transparent 15.5px),
    radial-gradient(circle at 50% 50%,var(--mosaico-traco) 2.5px,transparent 3px);
  background-size:28px 28px}

/* acompanha o scroll, como o cabeçalho da app: a página é comprida, e a
   marca e a porta de entrada não podem ficar lá em cima. O vidro é o --blur,
   saturado para as cores de baixo atravessarem vivas; a risca só aparece
   quando há conteúdo por baixo dela para separar — é o scroll que a acende,
   mais abaixo, onde o motor souber animar pelo scroll. */
.faixa-topo{position:sticky;top:0;z-index:20;background:var(--blur);
  -webkit-backdrop-filter:blur(12px) saturate(140%);
  backdrop-filter:blur(12px) saturate(140%);border-bottom:1px solid var(--line)}
/* as mesmas medidas do .wrap, para a marca ficar na prumada do texto */
header{display:flex;align-items:center;gap:8px;max-width:1160px;margin:0 auto;min-height:72px;
  padding:0 clamp(16px,4vw,40px)}
.marca{display:flex;align-items:center;gap:10px;margin-right:auto;color:var(--ink)}
.marca .tit{font-size:22px}

/* os botões da montra são os da app em ponto grande (50 px, raio 14), como
   na prancheta; os do cabeçalho ficam nos 44 da app */
a.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:50px;padding:0 22px;border-radius:14px;border:1px solid var(--line2);
  background:var(--card);color:var(--ink);text-decoration:none;font-weight:600;font-size:16px;white-space:nowrap;
  transition:transform var(--rapido) var(--curva),background-color var(--rapido) var(--curva),
    border-color var(--rapido) var(--curva),color var(--rapido) var(--curva)}
a.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
a.btn.fantasma{background:transparent;border-color:transparent}
a.btn.pequeno{min-height:44px;padding:0 16px;font-size:15px;border-radius:12px}
/* a régua da app: .97 nos botões, e a reação vive no premido, não no largar */
a.btn:active{transform:scale(.97)}
a.btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:14px}

/* ---------------------------------------------------------------- hero */
.hero{display:flex;flex-wrap:wrap;align-items:center;gap:48px;padding-top:48px;padding-bottom:72px}
.hero-texto{flex:1 1 440px;min-width:0;display:flex;flex-direction:column;gap:22px}
/* quanto maior a letra, mais apertado o leading: um título de 68px com o
   espaçamento do corpo lê-se desconjuntado */
.hero h1{font-size:clamp(40px,6vw,68px);line-height:1.02}
.hero .sub{font-size:20px;line-height:1.45;max-width:560px;color:var(--muted)}
.cta{display:flex;flex-wrap:wrap;gap:12px}
.gratis{font-size:15px;color:var(--muted)}
.hero-visual{flex:1 1 380px;min-width:0;display:flex;justify-content:center;position:relative;min-height:520px}
/* o mosaico fica preso ao telemóvel como na prancheta (49 px à esquerda dele,
   89 à direita): quando o hero passa a uma coluna, numa largura de tablet,
   não se estica numa faixa de lado a lado */
.hero-visual > .tile{position:absolute;border-radius:32px;
  inset:40px max(0px,calc(50% - 240px)) 40px max(40px,calc(50% - 200px))}

/* -------------------------------------------- as maquetes (role="img") */
.telemovel{position:relative;width:300px;max-width:100%;border-radius:40px;background:var(--moldura);padding:12px;
  box-shadow:0 0 0 1px var(--moldura-anel),var(--sombra-maquete)}
.ecra{border-radius:30px;background:var(--bg);padding:18px 14px;display:flex;flex-direction:column;gap:10px;min-height:560px}
.ecra-titulo{font-size:18px}
.m-cartao{background:var(--card);border:1px solid var(--line);border-radius:14px}
.m-atencao{display:flex;align-items:center;gap:10px;padding:10px 12px;font-size:12.5px;line-height:1.35}
.m-icone{width:28px;height:28px;border-radius:8px;background:var(--danger-soft);color:var(--danger);
  display:flex;align-items:center;justify-content:center;flex:none}
.m-icone .i{width:16px;height:16px}
.m-sub{color:var(--muted)}
.m-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.m-kpis.quatro{grid-template-columns:repeat(4,minmax(0,1fr))}
.m-kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;min-width:0}
.m-kpi p:first-child{font-size:11px}
.m-kpi .tit{font-size:15px;white-space:nowrap}
/* o contorno da divisória da barra: no escuro o azul-noite quase se
   confundia com o fundo do ecrã */
.m-kpi.noite{background:var(--side);border-color:var(--side-line)}
.m-kpi.noite p:first-child{color:var(--side-text)}
.m-kpi.noite .tit{color:var(--side-ink)}
.barras-tel{display:flex;align-items:flex-end;gap:4px;height:120px;padding:12px}
.barras-tel span{flex:1;border-radius:3px 3px 0 0;background:var(--in)}
.m-capa{height:90px;border-radius:14px}
.m-imovel{font-size:12.5px;font-weight:600}
.m-imovel .m-sub{font-weight:400}

.computador{flex:1.4 1 520px;min-width:0;display:flex;min-height:340px;border-radius:20px;overflow:hidden;
  border:1px solid var(--line);background:var(--bg);box-shadow:var(--sombra-janela)}
.pc-barra{width:150px;flex:none;background:var(--side);padding:16px 12px;display:flex;flex-direction:column;gap:8px}
.pc-marca{display:flex;align-items:center;gap:8px;color:var(--side-ink);font-size:13px;font-weight:600;margin-bottom:4px}
.pc-marca .mark{width:22px;height:22px;border-radius:6px}
.pc-item{height:26px;border-radius:7px;background:var(--side-on)}
.pc-traco{height:10px;border-radius:4px;background:var(--side-traco)}
.pc-traco:nth-child(3){width:70%}
.pc-traco:nth-child(4){width:60%}
.pc-traco:nth-child(5){width:75%}
.pc-traco:nth-child(6){width:55%}
.pc-corpo{flex:1;min-width:0;padding:18px;display:flex;flex-direction:column;gap:12px}
.pc-titulo{font-size:18px}
.computador .m-kpi{border-radius:10px}
.computador .m-kpi .tit{font-size:14px}
.barras-pc{flex:1;display:flex;align-items:flex-end;gap:6px;min-height:150px;padding:12px;border-radius:12px}
.barras-pc .mes{flex:1;display:flex;flex-direction:column;gap:2px}
.barras-pc .r{border-radius:3px;background:var(--in)}
.barras-pc .d{border-radius:3px;background:var(--out)}
${alturasDasBarras()}

/* ------------------------------------------------------------- secções */
.faz{background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line);
  padding:clamp(56px,8vw,80px) 0}
.faz .wrap{display:flex;flex-direction:column;gap:36px}
.faz h2{font-size:clamp(30px,4vw,44px)}
.grelha{display:grid;gap:16px;grid-template-columns:1fr}
@media(min-width:620px){.grelha{grid-template-columns:1fr 1fr}}
@media(min-width:940px){.grelha{grid-template-columns:1fr 1fr 1fr}}
.cartao{display:flex;flex-direction:column;gap:10px;padding:24px;border-radius:20px;
  background:var(--card);border:1px solid var(--line)}
.cartao h3{font-size:21px;line-height:1.2}
.cartao p{color:var(--muted)}
.ic{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center}
.ic.in{background:var(--in-soft);color:var(--in)}
.ic.ac{background:var(--accent-soft);color:var(--accent-text)}
.ic.out{background:var(--out-soft);color:var(--out)}
.ic.loan{background:var(--loan-soft);color:var(--loan)}
.ic.warn{background:var(--warn-soft);color:var(--warn)}

.par-pc{display:flex;flex-wrap:wrap;align-items:center;gap:48px;
  padding-top:clamp(56px,8vw,88px);padding-bottom:clamp(56px,8vw,88px)}
.pc-texto{flex:1 1 360px;min-width:0;display:flex;flex-direction:column;gap:16px}
.pc-texto h2,.par-texto h2{font-size:clamp(28px,3.6vw,40px);line-height:1.1}
.pc-texto .sub{font-size:18px;color:var(--muted)}

/* o bloco azul-noite das contas entre donos: a cor da barra lateral da app */
.banda-noite{background:var(--side);color:var(--side-ink);border-top:1px solid var(--side-line);
  border-bottom:1px solid var(--side-line);padding:clamp(56px,8vw,88px) 0}
.par{display:flex;flex-wrap:wrap;gap:48px;align-items:center}
.par-texto{flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:16px}
.par-texto p{font-size:18px;color:var(--side-text)}
.acerto{flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:10px}
.saldos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.saldo{padding:16px;border-radius:14px}
.saldo p:first-child{font-weight:600}
.saldo .valor{font-weight:700;font-size:20px;white-space:nowrap}
.saldo.mais{background:var(--saldo-mais-fundo)}
.saldo.mais .valor{color:var(--saldo-mais)}
.saldo.menos{background:var(--saldo-menos-fundo)}
.saldo.menos .valor{color:var(--saldo-menos)}
.proposta{padding:16px;border-radius:14px;border:1px dashed var(--side-tracejado);
  display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.proposta p{flex:1 1 160px}
/* desenho de um botão dentro da maquete: não é tocável, por isso não é um
   <button> nem tem cursor de mão */
.botao-maquete{display:inline-flex;align-items:center;min-height:40px;padding:0 18px;border-radius:12px;
  background:var(--side-ink);color:var(--side);font-weight:600;white-space:nowrap}

.dados{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:48px;
  padding-top:clamp(56px,8vw,88px);padding-bottom:clamp(56px,8vw,88px)}
.dados h2{font-size:clamp(26px,3.2vw,34px)}
.dados-lista{display:flex;flex-direction:column;gap:18px}
.lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px}
.lista li{display:flex;gap:12px;align-items:flex-start}
.lista .i{margin-top:1px}
.i.ok{color:var(--in)}
.projeto{align-self:start;display:flex;flex-direction:column;gap:18px;padding:28px;border-radius:24px;
  background:var(--card);border:1px solid var(--line)}
.projeto .sub{font-size:17px;color:var(--muted)}

.fecho-seccao{padding-bottom:clamp(56px,8vw,88px)}
.fecho{position:relative;overflow:hidden;border-radius:28px;background:var(--fecho-fundo);color:var(--fecho-tinta);
  padding:clamp(32px,6vw,64px);display:flex;flex-wrap:wrap;align-items:center;gap:24px}
.fecho-mosaico{position:absolute;right:-40px;top:-40px;width:320px;height:320px;border-radius:40px;
  --mosaico-fundo:transparent;--mosaico-traco:var(--fecho-mosaico)}
.fecho-texto{flex:1 1 420px;min-width:0;position:relative;display:flex;flex-direction:column;gap:10px}
.fecho h2{font-size:clamp(30px,4vw,46px);line-height:1.08}
.fecho p{font-size:18px;color:var(--fecho-sub)}
.fecho a.btn{background:var(--fecho-botao);border-color:var(--fecho-botao);color:var(--fecho-botao-tinta)}
.fecho a.btn:focus-visible{outline-color:var(--fecho-tinta)}

.rodape{display:flex;flex-wrap:wrap;align-items:center;gap:4px 20px;padding-top:20px;padding-bottom:40px;
  border-top:1px solid var(--line);font-size:15px}
.rodape-marca{display:flex;align-items:center;gap:8px;margin-right:auto;color:var(--muted)}
.rodape .mark{width:24px;height:24px;border-radius:6px}
.rodape a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none}
.rodape a:hover{color:var(--accent-text);text-decoration:underline}

/* o hover só existe onde há rato: num ecrã de dedo, o toque deixava o botão
   aceso até alguém tocar noutro sítio. Só cor — nada levanta nem sombreia. */
@media(hover:hover) and (pointer:fine){
  a.btn:hover{background:var(--tint)}
  a.btn.primary:hover{background:var(--accent-press);border-color:var(--accent-press)}
  a.btn.fantasma:hover{background:var(--press);border-color:var(--press)}
  .fecho a.btn:hover{background:var(--fecho-botao-hover);border-color:var(--fecho-botao-hover)}
}

/* ----------------------------------------------------------- telemóvel */
@media(max-width:619px){
  .pc-barra{width:52px;padding:14px 10px}
  .pc-marca span:last-child{display:none}
  .computador .m-kpis.quatro{grid-template-columns:1fr 1fr}
  /* no telemóvel o título ocupa a largura toda e o mosaico passava-lhe por
     baixo das letras: desce para o canto vazio ao lado do botão */
  .fecho-mosaico{width:160px;height:160px;top:auto;right:-56px;bottom:-56px}
  .rodape-marca{flex-basis:100%}
}
@media(max-width:480px){
  header{min-height:64px;gap:6px}
  .marca{gap:8px}
  .marca .mark{width:30px;height:30px;border-radius:8px}
  .marca .tit{font-size:19px}
  a.btn.pequeno{padding:0 14px}
  .hero{padding-top:32px;padding-bottom:56px}
  .hero .sub{font-size:18px}
}
/* num ecrã muito estreito não cabem dois botões ao lado da marca: o
   «Já tenho conta» do hero faz as vezes do «Entrar» */
@media(max-width:359px){a.btn.entrar{display:none}}

/* ======================= MOVIMENTO =======================
   Uma entrada só, para a página inteira: subir e desvanecer. É transform e
   opacity de ponta a ponta — nada aqui pede layout — e o estado BASE é
   sempre o visível: quem não corre animações (motor antigo, impressão)
   vê a página feita. */
@keyframes sobe{from{opacity:0;transform:translateY(16px)}}

/* A entrada do hero, ao chegar: escalonada a 70ms, como a Apple escalona o
   que chega junto — tudo ao mesmo tempo é um bloco, um a um é uma chegada.
   O backwards é o que segura os atrasados invisíveis até à vez deles. */
.hero h1{animation:sobe var(--entrada) var(--curva-entra) backwards}
.hero .sub{animation:sobe var(--entrada) var(--curva-entra) .07s backwards}
.hero .cta{animation:sobe var(--entrada) var(--curva-entra) .14s backwards}
.hero .gratis{animation:sobe var(--entrada) var(--curva-entra) .21s backwards}
.hero .telemovel{animation:sobe var(--entrada) var(--curva-entra) .1s backwards}
.hero-visual > .tile{animation:sobe var(--entrada) var(--curva-entra) .04s backwards}

/* O resto da página revela-se ao scroll, SEM JavaScript: a linha do tempo é
   o próprio scroll (animation-timeline), o dedo é quem conduz — dá para
   parar, voltar atrás e retomar, que é a interrupção de graça. Atrás de
   @supports de propósito: fora dele o estado base fica como sempre esteve,
   visível, e um motor sem view() não esconde conteúdo a ninguém. */
@supports (animation-timeline: view()){
  .grelha .cartao,.pc-texto,.computador,.par-texto,.acerto,.lista li,.projeto,.fecho{
    animation:sobe linear both;animation-timeline:view();
    animation-range:entry 8% entry 42%}
  /* as colunas da grelha entram por degraus, senão a fila chega em bloco —
     e os degraus seguem as colunas que existem (.grelha, acima): o padrão
     de três aplicado a duas punha o cartão da direita a entrar antes do da
     esquerda, e numa coluna só atrasava o 3.º e o 6.º sem razão nenhuma */
  @media(min-width:620px) and (max-width:939px){
    .grelha .cartao:nth-child(2n){animation-range:entry 14% entry 48%}
  }
  @media(min-width:940px){
    .grelha .cartao:nth-child(3n+2){animation-range:entry 14% entry 48%}
    .grelha .cartao:nth-child(3n){animation-range:entry 20% entry 54%}
  }
}
/* a risca do cabeçalho acende-se nos primeiros 24px de scroll: no topo não
   há nada por baixo dela para separar */
@supports (animation-timeline: scroll()){
  .faixa-topo{border-bottom-color:transparent;
    animation:risca linear both;animation-timeline:scroll();animation-range:0 24px}
  @keyframes risca{to{border-bottom-color:var(--line)}}
}

/* quem pediu menos movimento recebe menos, não zero: as entradas e as
   revelações ficam, mas em opacidade pura — o @keyframes redefinido aqui
   dentro tira o translateY a todas de uma vez — e nada se desloca nem muda
   de tamanho: o encolher do premido sai (e qualquer transform num hover que
   venha a existir), as cores ficam. A risca do cabeçalho é cor guiada pelo
   scroll, não movimento, e continua a acender-se. */
@media(prefers-reduced-motion:reduce){
  @keyframes sobe{from{opacity:0}}
  a.btn:hover,a.btn:active{transform:none}
}
/* quem pediu menos transparência recebe o cabeçalho sólido */
@media(prefers-reduced-transparency:reduce){
  .faixa-topo{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}}
/* e quem pediu mais contraste recebe contornos e texto secundário que se veem */
@media(prefers-contrast:more){:root{--line:#8A93A5;--line2:#6B7385;--muted:#384152}}
@media(prefers-contrast:more) and (prefers-color-scheme:dark){:root{--line:#56627D;--line2:#6E7A96;--muted:#C9D0DD}}
`;
