/* ================= ÍCONES =================
   Os ícones da app, desenhados à mão no mesmo traço (stroke 1.7, currentColor,
   20px por omissão): ic(nome, lado) devolve o SVG inline. Um ícone novo entra
   aqui, e não como emoji nem como carácter de texto. */
// ícone SVG inline pelo nome n, com s px de lado (20 por omissão);
// o traço herda a cor do texto onde for colado (currentColor).
// Recebe: n — o nome do ícone (ex.: 'home', 'trash'); s (opcional) — o lado em px (20 por omissão).
// Devolve: o SVG inline (string HTML); um SVG sem traços se o nome não existir.
function ic(n,s){s=s||20;const I={
  shield:'<path d="M12 3l7 2.6v5.2c0 4.6-3 8.4-7 10.2-4-1.8-7-5.6-7-10.2V5.6z"/><path d="M9 11.5l2 2 4-4"/>',
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-5h5v5"/>',
  building:'<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M15 10h3a2 2 0 0 1 2 2v9"/><path d="M8 7h3M8 11h3M8 15h3"/><path d="M2 21h20"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  crown:'<path d="M3 18h18"/><path d="M4 8l4 3 4-6 4 6 4-3-2 7H6z"/>',
  contract:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 16h4"/>',
  swap:'<path d="M7 4v13M4 14l3 3 3-3"/><path d="M17 20V7M14 10l3-3 3 3"/>',
  trend:'<path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
  down:'<path d="M12 3v13M7 12l5 5 5-5"/><path d="M4 21h16"/>',
  file:'<path d="M9 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9"/><path d="M3 12h10M9 8l4 4-4 4"/>',
  bank:'<path d="M3 10 12 4l9 6"/><path d="M5 10v9M10 10v9M14 10v9M19 10v9"/><path d="M3 21h18"/>',
  door:'<path d="M4 21V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v17"/><path d="M2 21h20"/><circle cx="13.5" cy="12.5" r="1"/>',
  photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/>',
  box:'<path d="M3 8 12 4l9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v8"/>',
  tag:'<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  up:'<path d="M12 20V6M6 12l6-6 6 6"/>',dn:'<path d="M12 4v14M6 12l6 6 6-6"/>',
  trash:'<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',key:'<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4M15 12v3"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  wave:'<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  split:'<path d="M4 6h5l3 6 3-6h5"/><path d="M4 18h5l3-6"/>',
  cloud:'<path d="M6 18a4 4 0 0 1 .6-8A6 6 0 0 1 18 9.5 3.5 3.5 0 0 1 17.5 18z"/><path d="M12 12v6M9.5 15.5 12 18l2.5-2.5"/>',
  clip:'<path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3l8-8"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  filter:'<path d="M22 4H2l8 9.2V19l4 2.4v-8.2z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  moon:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cal:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  bell:'<path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
  grip:'<circle cx="9" cy="5.5" r="1.3"/><circle cx="15" cy="5.5" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18.5" r="1.3"/><circle cx="15" cy="18.5" r="1.3"/>',
  auto:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  chev:'<path d="M15 6l-6 6 6 6"/>',chevD:'<path d="M6 9l6 6 6-6"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',
  pen:'<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  dots:'<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>'
}[n]||'';
return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+I+'</svg>'}
