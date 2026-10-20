/* ================= ÍCONES =================
   Os ícones da app, desenhados à mão no mesmo traço (stroke 1.8, currentColor,
   20px por omissão, pontas e juntas redondas): ic(nome, lado) devolve o SVG
   inline. Um ícone novo entra aqui, e não como emoji nem como carácter de
   texto. Os da navegação, do estado e do sino são os do canvas de 2026-10
   (home, building, contract, users, door, lista, repetir, bank, bars, trend,
   recibo, cal, gear, ajuda, bell, menu, carteira, nuvem*). */
// ícone SVG inline pelo nome n, com s px de lado (20 por omissão);
// o traço herda a cor do texto onde for colado (currentColor).
// Recebe: n — o nome do ícone (ex.: 'home', 'trash'); s (opcional) — o lado em px (20 por omissão).
// Devolve: o SVG inline (string HTML); um SVG sem traços se o nome não existir.
function ic(n,s){s=s||20;const I={
  shield:'<path d="M12 3l7 2.6v5.2c0 4.6-3 8.4-7 10.2-4-1.8-7-5.6-7-10.2V5.6z"/><path d="M9 11.5l2 2 4-4"/>',
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  /* a casa das Casas (os imóveis): o telhado e a porta */
  building:'<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  pessoaMais:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M19 8v6M22 11h-6"/>',
  crown:'<path d="M3 18h18"/><path d="M4 8l4 3 4-6 4 6 4-3-2 7H6z"/>',
  contract:'<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6"/>',
  /* os Movimentos (uma lista), os Planeados (o que se repete) e o Dinheiro (a carteira) */
  lista:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  repetir:'<path d="M17 2l3 3-3 3"/><path d="M3 11V9a4 4 0 0 1 4-4h13"/><path d="M7 22l-3-3 3-3"/><path d="M21 13v2a4 4 0 0 1-4 4H4"/>',
  carteira:'<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><path d="M16 14.5h.01"/>',
  swap:'<path d="M7 4v13M4 14l3 3 3-3"/><path d="M17 20V7M14 10l3-3 3 3"/>',
  trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  down:'<path d="M12 3v13M7 12l5 5 5-5"/><path d="M4 21h16"/>',
  file:'<path d="M9 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9"/><path d="M3 12h10M9 8l4 4-4 4"/>',
  bank:'<path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/><path d="M12 3l9 5H3z"/>',
  door:'<path d="M5 21V4h11v17"/><path d="M16 7h3v14"/><path d="M3 21h18"/><path d="M12.5 12.5h.01"/>',
  photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/>',
  box:'<path d="M3 8 12 4l9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v8"/>',
  layers:'<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 13l10 5 10-5"/>',
  /* a Avaliação (três barras sobre a linha do chão) e a Declaração (um
     recibo de bordo picotado com o €): tinham o «file», que parece uma
     seta a entrar, e o mesmo escudo dos Colaboradores */
  bars:'<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  recibo:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  tag:'<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  up:'<path d="M12 20V6M6 12l6-6 6 6"/>',dn:'<path d="M12 4v14M6 12l6 6 6-6"/>',
  trash:'<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',key:'<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4M15 12v3"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  wave:'<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  split:'<path d="M4 6h5l3 6 3-6h5"/><path d="M4 18h5l3-6"/>',
  cloud:'<path d="M6 18a4 4 0 0 1 .6-8A6 6 0 0 1 18 9.5 3.5 3.5 0 0 1 17.5 18z"/><path d="M12 12v6M9.5 15.5 12 18l2.5-2.5"/>',
  /* o estado da sincronização: a ligar, guardado, por enviar, sem ligação.
     No «a ligar» o relógio senta-se na base da nuvem, que abre para ele: um
     relógio inteiro lá dentro, no traço de 1.8 e a 18px, era uma mancha */
  nuvemLiga:'<path d="M8.5 18H7a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8h-2.5"/><circle cx="12" cy="16" r="4"/><path d="M12 14v2l1.3 1"/>',
  nuvemOk:'<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/><path d="M9.5 13.5l2 2 3.5-3.5"/>',
  nuvemSobe:'<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/><path d="M12 16v-5M9.5 13.5 12 11l2.5 2.5"/>',
  nuvemFora:'<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/><path d="M10 11l4 4M14 11l-4 4"/>',
  clip:'<path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3l8-8"/>',
  /* as Definições: três réguas com cursores */
  gear:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4"/>',
  ajuda:'<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h10"/>',
  aviso:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  filter:'<path d="M22 4H2l8 9.2V19l4 2.4v-8.2z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  moon:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
  clock:'<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/><path d="M12 7v5l3 2"/>',
  cal:'<path d="M4 6h16v15H4z"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  bell:'<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  grip:'<circle cx="9" cy="5.5" r="1.3"/><circle cx="15" cy="5.5" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18.5" r="1.3"/><circle cx="15" cy="18.5" r="1.3"/>',
  auto:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  chev:'<path d="M15 6l-6 6 6 6"/>',chevD:'<path d="M6 9l6 6 6-6"/>',chevR:'<path d="M9 6l6 6-6 6"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  /* «Selecionar vários»: uma caixa com o visto dentro, como a das linhas — o
     visto sozinho lia-se como «concluir» */
  caixaVisto:'<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 12.5 3 3 5-6"/>',
  /* as opções de uma análise (horizonte, aumento, inflação; o yield exigido):
     a roda dentada, que não é o gear das Definições (três réguas) */
  roda:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  /* partilhar (a Avaliação: o relatório e o CSV dos movimentos): os três
     pontos ligados, o sinal de partilha do Android — a seta a sair da caixa
     lia-se como «carregar», ao lado do «down» das descargas */
  partilhar:'<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 13.3 7.4 4.4M15.7 6.3l-7.4 4.4"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  pen:'<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  dots:'<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>'
}[n]||'';
return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+I+'</svg>'}
