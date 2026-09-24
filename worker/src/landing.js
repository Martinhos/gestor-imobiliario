/* A página de entrada do rendorium.com.
   -------------------------------------
   Servida pelo worker quando o pedido chega pelo domínio raiz (ou www) — a app
   vive em app.rendorium.com e não se mistura. Escrita à mão, sem dependências,
   com a mesma cara e a mesma paleta da app: quem clica em «Abrir a app» não
   pode sentir que mudou de produto.

   A página MOSTRA o produto. A versão anterior descrevia em seis cartões uma
   app cujo argumento é «arrumado», sem nunca mostrar a arrumação — e escondia
   quatro desses seis cartões num carrossel que quase ninguém desliza. As
   imagens são capturas a sério, feitas por scripts/capturas.js a partir da app
   com dados de exemplo, e vêm nos dois temas: o <picture> escolhe pelo tema de
   quem está a ler, e só descarrega a que serve.

   Não tem JavaScript nenhum. O carrossel era a única razão para ter, e uma
   grelha mostra as seis coisas de uma vez. As animações — a entrada do hero,
   as revelações ao scroll, a risca do cabeçalho — são CSS puro: as guiadas
   pelo scroll vivem atrás de @supports (animation-timeline), e um motor que
   não as saiba correr mostra a página feita, sem esconder nada.

   O desenho segue a linguagem da Apple, traduzida para a web: a letra do
   sistema com tracking negativo no display, vidro saturado no cabeçalho,
   reação no premido, e os recuos de menos movimento, menos transparência e
   mais contraste.

   O Rendorium é um projeto pessoal, sem planos nem pagamentos, e a página
   di-lo por palavras — é a pergunta que qualquer pessoa faz a seguir a «o que
   é isto?». */

import { CSP_ESTRITA } from './lib/http.js';

const APP = 'https://app.rendorium.com';
const IMG = '/img/landing';

/* Uma imagem que segue o tema de quem lê: a clara por omissão, a escura por
   media query. O width/height vão escritos para o espaço ficar guardado antes
   de a imagem chegar — senão o texto salta quando ela aterra.
   Recebe: nome — o nome base do ficheiro; alt — a descrição para quem não a
   vê; w e h — as medidas em pixéis de CSS; classe — a classe do <img>;
   preguica — verdadeiro para a carregar só quando estiver perto do ecrã.
   Devolve: o HTML do <picture>. */
function figura(nome, alt, w, h, classe, preguica) {
  return `<picture>
      <source srcset="${IMG}/${nome}-dark.webp" media="(prefers-color-scheme: dark)">
      <img src="${IMG}/${nome}-light.webp" width="${w}" height="${h}" class="${classe}"
        alt="${alt}"${preguica ? ' loading="lazy" decoding="async"' : ''}>
    </picture>`;
}

const CAPACIDADES = [
  ['Rendas sem esforço',
    'O contrato gera o movimento planeado. Todos os meses, um toque em «Confirmar» e a renda fica registada — com a data, o valor e o inquilino certos.'],
  ['Contratos e inquilinos',
    'Fichas, prazos, caução e um contrato em PDF pronto a rever, já com os teus dados e os do inquilino lá dentro.'],
  ['Contas entre proprietários',
    'Casa herdada a meias? Quotas por imóvel, quem pagou o quê, e quanto falta acertar entre vocês — sem folhas de cálculo à parte.'],
  ['Créditos à habitação',
    'Prestações com capital, juros e imposto do selo separados, amortizações, e o plano de pagamentos até ao fim.'],
  ['O Anexo F, linha a linha',
    'O quadro 4.1 por ano e por dono, com o que falta apontado; os prazos da AT — Modelo 2, recibos, 15 de fevereiro, IRS — lembrados a tempo; cada contrato declarado ou não, à tua escolha. Entregar às Finanças é contigo: a app resume, não declara.'],
  ['Visitas e prazos',
    'Quem vem ver que imóvel, e quando. E um aviso antes de um contrato acabar, em vez de o descobrires tarde.'],
];

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
<meta property="og:description" content="Imóveis, contratos, rendas, créditos e o IRS num só sítio. Grátis, sem planos e sem cartão.">
<meta property="og:url" content="https://rendorium.com">
<meta property="og:image" content="https://rendorium.com${IMG}/partilha.webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pt_PT">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://rendorium.com">`
    : '<meta name="robots" content="noindex,nofollow">';
  const html = `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Rendorium — o teu portefólio de arrendamento, arrumado</title>
<meta name="description" content="Imóveis, contratos, rendas, créditos e IRS num só sítio. Grátis, sem planos. Um projeto pessoal para senhorios portugueses.">
${cabecaRaiz}
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/paginas/landing.css">
</head><body>
<div class="faixa-topo">
  <header>
    <span class="logo">R</span><span class="marca">Rendorium</span>
    <span class="spacer"></span>
    <a class="btn" href="${APP}">Abrir a app</a>
  </header>
</div>
<div class="wrap">

  <div class="hero">
    <div>
      <h1>O teu portefólio de arrendamento, arrumado.</h1>
      <p class="sub">Imóveis, contratos, rendas, créditos e o IRS num só sítio — para quem
      hoje gere tudo em Excel, papel e memória.</p>
      <div class="cta">
        <a class="btn primary" href="${APP}/?criar=1">Criar conta</a>
        <a class="btn" href="${APP}">Já tenho conta</a>
      </div>
      <div class="faixa"><b>Grátis, sem planos e sem cartão.</b> Funciona no browser,
      no telemóvel e como app instalada.</div>
    </div>
    <div class="telemovel">
      ${figura('visao-geral', 'A visão geral do Rendorium no telemóvel: receita, despesas, prestações e cashflow do ano, e o gráfico de entradas e saídas mês a mês.', 390, 800, 'ecra')}
    </div>
  </div>

  <section>
    <h2>O que faz</h2>
    <p class="lead">Seis coisas que um senhorio faz todos os meses, e que a app faz por ti
    ou contigo.</p>
    <div class="grelha">
      ${CAPACIDADES.map(([t, d]) => `<div class="cartao"><b>${t}</b><p>${d}</p></div>`).join('\n      ')}
    </div>
  </section>

  <hr class="risca">

  <section>
    <h2>No computador, o portefólio inteiro à vista</h2>
    <p class="lead">A mesma app, sem instalar nada: receita, despesas, prestações e cashflow
    do ano, mês a mês e por imóvel.</p>
    <div class="janela">
      ${figura('computador', 'O Rendorium num computador: a barra lateral com imóveis, contratos, movimentos e créditos, quatro indicadores do ano e dois gráficos — entradas e saídas mês a mês, e o cashflow acumulado.', 1180, 760, 'ecra', true)}
    </div>
  </section>

  <hr class="risca">

  <section>
    <div class="par trocado">
      <div class="janela">
        ${figura('movimentos', 'O ecrã de movimentos: receitas, despesas, prestações e saldo, e o cartão das contas entre proprietários a dizer quem paga a quem.', 390, 800, 'ecra', true)}
      </div>
      <div class="texto">
        <h2>As contas entre quem é dono</h2>
        <p>Cada movimento sabe quem o pagou e por quem se divide. A app faz a conta ao longo
        do ano e diz quem paga a quem — e liquida tudo num botão.</p>
        <p>Quotas por imóvel, despesas divididas por valor ou por partes iguais, e dívidas a
        terceiros à parte, sem entrarem nas contas entre vocês.</p>
      </div>
    </div>
  </section>

  <hr class="risca">

  <section>
    <h2>Os dados são teus</h2>
    <ul class="lista">
      <li><b>Cópia de segurança num toque</b>, e exportação em CSV quando quiseres — os
      números saem daqui para onde precisares deles.</li>
      <li><b>A conta apaga-se dentro da app</b>, sem pedir a ninguém e sem esperar por
      resposta.</li>
      <li><b>Funciona sem rede.</b> O que registas offline sobe assim que a ligação voltar,
      e podes trabalhar em vários aparelhos.</li>
      <li><b>Partilhas só o que quiseres.</b> Um comproprietário vê as contas do imóvel; um
      contabilista vê os movimentos e mais nada.</li>
    </ul>
  </section>

  <hr class="risca">

  <section>
    <div class="nota">
      <h2>Um projeto pessoal</h2>
      <p>O Rendorium nasceu para gerir o meu próprio portefólio e está aberto a quem lhe
      quiser dar uso. É grátis: não há planos, não há limites de imóveis e não há cartão
      para pôr.</p>
      <p>Está em evolução constante — o que muda em cada versão fica escrito dentro da app,
      em Novidades. Se alguma coisa importante mudar, é avisada com antecedência e ninguém
      perde o que registou.</p>
    </div>
  </section>

  <div class="fecho">
    <h2>Começa pelo primeiro imóvel</h2>
    <p>Leva dois minutos, e a partir daí é só confirmar as rendas.</p>
    <div class="cta"><a class="btn primary" href="${APP}/?criar=1">Criar conta</a></div>
  </div>

  <footer>
    <span>© ${new Date().getFullYear()} Rendorium</span>
    <a href="/termos">Termos e Condições</a>
    <a href="/privacidade">Política de Privacidade</a>
    <a href="${APP}">Abrir a app</a>
  </footer>
</div>
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
export const CSS_LANDING = `:root{color-scheme:light dark;
  --bg:#f7f8fa;--card:#fff;--ink:#17221d;--muted:#5a635e;--line:#e7ebe8;
  --accent:#244c3b;--accent-ink:#fff;--accent-press:#1c3d2f;--tint:#eef4f0;--blur:rgba(247,248,250,.94);
  --sombra:0 1px 2px rgba(16,32,24,.04),0 12px 32px -12px rgba(16,32,24,.16);
  /* movimento: os tokens da app (web/index.html, o :root), para quem clica em
     «Abrir a app» não sentir que mudou de produto também no tempo. O --entrada
     é só daqui: uma montra pode demorar mais do que uma app a responder, e
     .65s é o degrau de quem chega pela primeira vez. */
  --rapido:.12s;--entrada:.65s;
  --curva:cubic-bezier(.22,1,.36,1);--curva-entra:cubic-bezier(0,0,.2,1)}
@media(prefers-color-scheme:dark){:root{
  --bg:#12141b;--card:#1b1e28;--ink:#eef0f6;--muted:#9aa3b8;--line:#2b3040;
  --accent:#5ee0a8;--accent-ink:#0b1410;--accent-press:#7ceabb;--tint:#18211c;--blur:rgba(18,20,27,.92);
  --sombra:0 1px 2px rgba(0,0,0,.3),0 16px 40px -14px rgba(0,0,0,.55)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  /* a letra do sistema de quem lê: SF no iPhone e no Mac, Segoe no Windows.
     A Inter saiu — nunca foi carregada como webfont, só aparecia a quem a
     tivesse instalada, e a letra da plataforma já traz o desenho ótico e o
     espaçamento afinados por tamanho. A app fez a mesma mudança. */
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  font-size:17px;line-height:1.6;-webkit-text-size-adjust:100%}
img{max-width:100%;height:auto;display:block}
.wrap{max-width:1080px;margin:0 auto;padding:0 22px}
.prosa{max-width:62ch}

/* acompanha o scroll, como o cabeçalho da app (index.html:header.top): a
   página tem mais de quatro mil pixéis, e a marca e a porta de entrada não
   podem ficar lá em cima. O vidro é o mesmo --blur, saturado como os
   materiais da Apple para as cores de baixo atravessarem vivas; a risca só
   aparece quando há conteúdo por baixo dela para separar — é o scroll que a
   acende, mais abaixo, onde o motor souber animar pelo scroll. */
.faixa-topo{position:sticky;top:0;z-index:20;background:var(--blur);
  -webkit-backdrop-filter:blur(12px) saturate(140%);
  backdrop-filter:blur(12px) saturate(140%);border-bottom:1px solid var(--line)}
/* as mesmas medidas do .wrap, para a marca ficar na prumada do texto */
header{display:flex;align-items:center;gap:11px;max-width:1080px;margin:0 auto;padding:14px 22px}
.logo{width:36px;height:36px;border-radius:11px;background:var(--accent);color:var(--accent-ink);
  display:grid;place-items:center;font-weight:800;font-size:18px;flex:0 0 auto}
.marca{font-weight:750;font-size:17px;letter-spacing:-.01em}
.spacer{flex:1}

a.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;
  border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);
  text-decoration:none;font-weight:650;font-size:15px;min-height:46px;
  transition:transform var(--rapido) var(--curva),
    background-color var(--rapido) var(--curva),border-color var(--rapido) var(--curva)}
/* a sombra do hover vive num ::after já pintado que só muda de opacidade:
   box-shadow repinta a cada frame da transição, opacity anima no compositor */
a.btn::after{content:"";position:absolute;inset:-1px;border-radius:12px;
  box-shadow:var(--sombra);opacity:0;transition:opacity var(--rapido) var(--curva)}
/* o hover só existe onde há rato: num ecrã de dedo, o toque deixava o botão
   «levantado» até alguém tocar noutro sítio */
@media(hover:hover) and (pointer:fine){
  a.btn:hover{transform:translateY(-1px)}
  a.btn:hover::after{opacity:1}
  a.btn.primary:hover{background:var(--accent-press);border-color:var(--accent-press)}
}
/* a régua da app: .97 nos botões, e a reação vive no premido, não no largar */
a.btn:active{transform:scale(.97)}
a.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
a.btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px}

/* ---------------------------------------------------------------- hero */
.hero{display:grid;gap:40px;padding:34px 0 20px;align-items:center}
@media(min-width:900px){.hero{grid-template-columns:1fr 390px;gap:56px;padding:56px 0 34px}}
/* tipografia display à Apple: quanto maior a letra, mais apertados o
   tracking e o leading — um título de 58px com o espaçamento do corpo
   lê-se desconjuntado */
.hero h1{font-size:clamp(34px,5.8vw,58px);line-height:1.04;letter-spacing:-.03em;
  margin:0 0 16px;text-wrap:balance}
.hero .sub{font-size:clamp(17px,2vw,21px);color:var(--muted);margin:0 0 28px;max-width:52ch}
.cta{display:flex;gap:10px;flex-wrap:wrap}
.faixa{font-size:14px;color:var(--muted);margin-top:16px}
.faixa b{color:var(--ink);font-weight:650}
/* a moldura do telemóvel: o recorte é o que faz uma captura parecer um ecrã e
   não um retângulo colado ao meio do texto */
.telemovel{border:1px solid var(--line);border-radius:22px;overflow:hidden;
  box-shadow:var(--sombra);background:var(--card);margin:0 auto;max-width:390px}
.janela{border:1px solid var(--line);border-radius:16px;overflow:hidden;
  box-shadow:var(--sombra);background:var(--card)}

/* ------------------------------------------------------------- secções */
section{padding:56px 0}
section > h2{font-size:clamp(26px,3.4vw,36px);line-height:1.12;letter-spacing:-.024em;
  margin:0 0 12px;text-wrap:balance}
section > .lead{font-size:17.5px;color:var(--muted);margin:0 0 30px;max-width:58ch}
.risca{border:0;border-top:1px solid var(--line);margin:0}

.grelha{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:620px){.grelha{grid-template-columns:1fr 1fr}}
@media(min-width:940px){.grelha{grid-template-columns:1fr 1fr 1fr}}
.cartao{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:21px 22px}
.cartao b{display:block;font-size:16px;margin-bottom:7px;letter-spacing:-.01em}
.cartao p{margin:0;font-size:15px;color:var(--muted);line-height:1.55}

/* duas colunas com uma imagem de um lado e o texto do outro */
.par{display:grid;gap:32px;align-items:center}
@media(min-width:860px){.par{grid-template-columns:1fr 390px;gap:52px}
  .par.trocado{grid-template-columns:390px 1fr}
  .par.trocado .texto{order:2}}
.par h2{font-size:clamp(23px,3vw,31px);line-height:1.14;letter-spacing:-.022em;margin:0 0 12px}
.par p{color:var(--muted);margin:0 0 10px;font-size:16.5px}

.lista{list-style:none;padding:0;margin:0;display:grid;gap:11px}
.lista li{position:relative;padding-left:26px;color:var(--muted);font-size:16.5px}
.lista li::before{content:"";position:absolute;left:2px;top:.62em;width:9px;height:9px;
  border-radius:50%;background:var(--accent)}
.lista b{color:var(--ink);font-weight:650}

.nota{background:var(--tint);border:1px solid var(--line);border-radius:16px;padding:24px 26px}
.nota h2{margin-top:0}
.nota p:last-child{margin-bottom:0}
.nota p{color:var(--muted);margin:0 0 12px}

.fecho{text-align:center;padding:64px 0 8px}
.fecho h2{margin-bottom:10px}
.fecho p{color:var(--muted);margin:0 0 24px}
.fecho .cta{justify-content:center}

footer{margin-top:48px;padding:24px 0 44px;border-top:1px solid var(--line);
  font-size:14px;color:var(--muted);display:flex;gap:18px;flex-wrap:wrap;align-items:center}
footer a{color:var(--muted)}
footer a:hover{color:var(--ink)}

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
.hero .faixa{animation:sobe var(--entrada) var(--curva-entra) .21s backwards}
.hero .telemovel{animation:sobe var(--entrada) var(--curva-entra) .1s backwards}

/* O resto da página revela-se ao scroll, SEM JavaScript: a linha do tempo é
   o próprio scroll (animation-timeline), o dedo é quem conduz — dá para
   parar, voltar atrás e retomar, que é a interrupção de graça. Atrás de
   @supports de propósito: fora dele o estado base fica como sempre esteve,
   visível, e um motor sem view() não esconde conteúdo a ninguém. */
@supports (animation-timeline: view()){
  .grelha .cartao,.janela,.par .texto,.lista li,.nota,.fecho{
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
   de tamanho: o levantar do hover e o encolher do premido saem, as cores e
   a sombra ficam. A risca do cabeçalho é cor guiada pelo scroll, não
   movimento, e continua a acender-se. */
@media(prefers-reduced-motion:reduce){
  @keyframes sobe{from{opacity:0}}
  a.btn:hover,a.btn:active{transform:none}
}
/* quem pediu menos transparência recebe o cabeçalho sólido */
@media(prefers-reduced-transparency:reduce){
  .faixa-topo{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}}
/* e quem pediu mais contraste recebe contornos que se veem */
@media(prefers-contrast:more){:root{--line:#9aa39d}}
@media(prefers-contrast:more) and (prefers-color-scheme:dark){:root{--line:#525a70}}
`;
