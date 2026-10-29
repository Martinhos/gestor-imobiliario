/* O guião do back office (/equipa): o JavaScript que corre no browser de
   quem faz suporte, opera ou programa.
   ---------------------------------------------------------------------
   Vive aqui como texto, e o worker serve-o em /equipa/guiao.js — só a quem
   tem sessão de equipa (paginas-recursos.js). A página (equipa-vista.js)
   carrega-o depois dos dados da sessão (eu, ESTADOS, CATS), que a vista põe
   num <script type="application/json" id="dados-equipa"> e o guião lê.

   É um String.raw, e é isso que interessa: o que se escreve aqui é o que o
   browser recebe. Um \n numa mensagem é um \n e uma plica escapada é \' —
   como em qualquer ficheiro de JavaScript. Dentro de um template literal
   normal o servidor cozia o texto antes de o servir, e cada quebra e cada
   plica tinham de ir dobradas; um \n a menos virava uma quebra verdadeira a
   meio de uma string, e a página inteira ficava morta em «A carregar…» —
   custou uma tarde. Ficam duas regras, que o testes/equipa-guiao.test.js
   guarda: nem crases nem cifrão com chaveta cá dentro, que são as duas
   coisas que um String.raw ainda interpreta.

   A página vai com a CSP_ESTRITA: um manipulador ou um estilo escritos em
   atributos do HTML não correm. Os botões dizem o que fazem num data-acao (e os campos
   num data-enter, para o Enter, e num data-mudar, para o change), com os
   valores em data-arg, data-arg2 e data-arg3; três ouvintes no document
   leem-nos e chamam a função da tabela ACOES — só essas, e mais nenhuma. Um
   quarto ouvinte, o do input, não chama ações: só acerta os contadores de
   caracteres (data-contar) e tira o erro de um campo quando se volta a
   escrever. Um valor num atributo data-* é texto e nunca código: o esc()
   chega, porque o browser desfaz as entidades e entrega a string tal e
   qual. Os estilos são classes do CSS_EQUIPA (equipa-vista.js).

   Nada de alert(), prompt() nem <select>: o que pede valores ou um motivo
   abre a janela de confirmação (o <dialog id="dialogo">, pelo formulario),
   e o resultado de uma ação diz-se no aviso de baixo (avisar). Nem o
   confirm(): desligar um serviço pergunta numa faixa do cartão
   (mostrarAvisoDesligar). */

export const GUIAO = String.raw`var seccao = '', estado = 'abertos', modelos = null;
// a última lista de pedidos ou de erros que se pintou (o detalhe pinta-se ao lado dela)
var listaAtual = null;
// o pedido que está aberto: uma resposta atrasada (o rasto de quem escreveu) não cai noutro
var pedidoAberto = '';
// quantos estão por tratar, por tipo de lista, para os crachás da barra
var contagens = {};
// a última ficha pintada: as janelas das ações dizem o nome e o email dela
var fichaVista = null;
// a última procura de pessoas, para o Voltar da ficha e o separador a recuperarem
var ultimaProcura = '';
// a janela aberta: os campos e o que fazer ao confirmar
var formAberto = null;
// a vez do aviso de baixo: o temporizador de um aviso velho não apaga um novo
var avisoN = 0;

// os dados da sessão, que a página traz num <script type="application/json">
var DADOS = JSON.parse(document.getElementById('dados-equipa').textContent);
var eu = DADOS.eu, ESTADOS = DADOS.ESTADOS, CATS = DADOS.CATS;

var esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
};
/* Os atributos que ligam um elemento a uma ação da tabela ACOES: o nome no
   data-<tipo> e os valores em data-arg, data-arg2 e data-arg3, cada um pelo
   esc() — num atributo data-* o valor é texto, e chega à ação tal e qual.
   Recebe: tipo — 'acao' (clique), 'enter' (Enter num campo) ou 'mudar'
   (change); nome — o nome da ação em ACOES; args (opcional) — os valores
   (qualquer coisa; null e undefined valem '').
   Devolve: o texto dos atributos, com um espaço à frente, pronto a entrar numa etiqueta. */
var ligarA = function (tipo, nome, args) {
  return ' data-' + tipo + '="' + esc(nome) + '"' + (args || []).map(function (v, i) {
    return ' data-arg' + (i ? i + 1 : '') + '="' + esc(v) + '"';
  }).join('');
};
// O clique num elemento chama a ação nome com os valores args (ligarA com 'acao').
// Recebe: nome — o nome da ação em ACOES; args (opcional) — os valores.
// Devolve: o texto dos atributos.
var comAcao = function (nome, args) { return ligarA('acao', nome, args); };
var el = function (id) { return document.getElementById(id); };

/* ------------------------------ formatos ------------------------------- */

// dois algarismos: 7 → 07
var dois = function (n) { return (n < 10 ? '0' : '') + n; };
// o dia de um instante, à portuguesa e na hora de quem vê: 17/10/2026
var dia = function (t) {
  if (!t) return '—';
  var d = new Date(t);
  return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear();
};
// a hora de um instante: 16:58
var hora = function (t) { var d = new Date(t); return dois(d.getHours()) + ':' + dois(d.getMinutes()); };
// dia e hora: 17/10/2026 16:58
var data = function (t) { return t ? dia(t) + ' ' + hora(t) : '—'; };
// um dia AAAA-MM-DD (o das cópias) à portuguesa
var diaIso = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s); };
// quando foi, curto, como nas listas: "há 12 min", "há 2 h", "12/10"
var quando = function (t) {
  if (!t) return '—';
  var m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return 'há ' + m + ' min';
  if (m < 24 * 60) return 'há ' + Math.round(m / 60) + ' h';
  var d = new Date(t);
  return d.getFullYear() === new Date().getFullYear() ? dois(d.getDate()) + '/' + dois(d.getMonth() + 1) : dia(t);
};
var kb = function (n) {
  if (!(n > 0)) return '0 KB';
  if (n < 1048576) return Math.max(1, Math.round(n / 1024)) + ' KB';
  return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
};
// a idade de uma coisa, dita como se diz: "há 3 h", "há 2 dias"
var idade = function (t) {
  if (!t) return 'nunca';
  var m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return 'há ' + m + ' min';
  if (m < 48 * 60) return 'há ' + Math.round(m / 60) + ' h';
  return 'há ' + Math.round(m / 1440) + ' dias';
};
// quanto durou, em milissegundos: "840 ms", "41 s", "2 min"
var duracao = function (ms) {
  if (ms < 1000) return Math.round(ms) + ' ms';
  if (ms < 60000) return Math.round(ms / 1000) + ' s';
  return Math.round(ms / 60000) + ' min';
};
// o começo de um id, como se diz ao telefone: #1A2B3C4D
var curto = function (id) { return String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase(); };
// as iniciais de um nome ou de um email, para o avatar: "Maria Costa" → MC
var iniciais = function (t) {
  return String(t || '').trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2)
    .map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '?';
};
var maiuscula = function (t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); };
// um número à portuguesa (418 960), ou o texto tal e qual se não for número
var numero = function (v) { var x = Number(v); return isFinite(x) && String(v).trim() !== '' ? x.toLocaleString('pt-PT') : String(v == null ? '' : v); };
/* O texto do resumo do servidor sem os sinais que o Discord pinta: os emojis
   de semáforo, as crases e os asteriscos do markdown. */
var limpo = function (v) {
  return String(v == null ? '' : v).replace(/[☀-➿️]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g, '')
    .replace(/\x60|\*/g, '').replace(/\s{2,}/g, ' ').trim();
};

/* ------------------------- ícones e peças soltas ------------------------- */

// os ícones da ferramenta, em traço como os da app (o desenho de cada um)
var ICONES = {
  pedidos: '<path d="M4 5h16v11H8l-4 4z"/>',
  erros: '<path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  procurar: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4"/>',
  operacao: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  rasto: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2"/>',
  voltar: '<path d="M15 6l-6 6 6 6"/>',
  seta: '<path d="M9 6l6 6-6 6"/>',
  baixo: '<path d="M6 9l6 6 6-6"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  atualizar: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
};
// um ícone: o desenho de ICONES num <svg> que o leitor de ecrã salta
var ic = function (nome, classe) {
  return '<svg class="i' + (classe ? ' ' + classe : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONES[nome] || '') + '</svg>';
};
// um selo retangular: tom ('ac' cobalto, 'ok' verde, 'wa' âmbar, 'dg' vermelho, '' cinzento) e o texto já seguro
var badge = function (tom, html) { return '<span class="badge' + (tom ? ' ' + tom : '') + '">' + html + '</span>'; };
// um chip de filtro, ligado ou não, com a ação já escrita
var chip = function (html, ligado, acao) {
  return '<button type="button" class="chip' + (ligado ? ' on' : '') + '" aria-pressed="' + (ligado ? 'true' : 'false') + '"' + acao + '>' + html + '</button>';
};

/* fetch com as regras da casa: cookies de sessão, resposta lida como JSON,
   um 401 recarrega a página (a sessão morreu, volta-se ao ecrã de entrada)
   e qualquer outro falhanço vira Error com a mensagem do servidor e o
   estado HTTP em e.status (o rasto diz um 403 em palavras)
   Recebe: rota — o caminho da API (string, ex.: /api/equipa/pedidos);
   opcoes (opcional) — opções do fetch (método, cabeçalhos, corpo).
   Devolve: Promise com o JSON da resposta; rejeita com Error quando o pedido falha. */
function pedir(rota, opcoes) {
  return fetch(rota, Object.assign({ credentials: 'same-origin' }, opcoes || {}))
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { location.reload(); throw new Error('sessão terminada'); }
        if (!r.ok) { var e = new Error(j.error || ('Erro ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
}
// POST em JSON por cima de pedir; sem corpo vai um {} vazio
// Recebe: rota — o caminho da API (string); corpo (opcional) — o objeto a serializar em JSON.
// Devolve: Promise com o JSON da resposta, como pedir.
function enviar(rota, corpo) {
  return pedir(rota, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo || {}),
  });
}
// termina a sessão de equipa no servidor e recarrega — cai no ecrã de entrada
// Devolve: nada — recarrega a página.
function sair() {
  pedir('/api/equipa/sair', { method: 'POST' }).then(function () { location.reload(); });
}

/* O aviso de baixo (o toast da app): diz o resultado de uma ação ou o erro
   que o servidor deu, e some sozinho — 6 s, ou 9 s quando é um erro, que
   pede mais tempo para se ler. Tem um botão para o fechar antes.
   Recebe: texto — o que dizer (texto simples, escapa-se aqui); tipo
   (opcional) — 'erro' para o marcar como erro.
   Devolve: nada — mostra o aviso. */
function avisar(texto, tipo) {
  var a = el('aviso'), n = ++avisoN;
  if (!a) return;
  a.className = 'eq-toast on' + (tipo === 'erro' ? ' erro' : '');
  a.innerHTML = '<span class="eq-toast-txt">' + esc(texto) + '</span>' +
    '<button type="button" class="eq-toast-x" aria-label="Fechar o aviso"' + comAcao('fecharAviso') + '>' + ic('fechar', 'i-sm') + '</button>';
  setTimeout(function () { if (n === avisoN) esconderAviso(); }, tipo === 'erro' ? 9000 : 6000);
}
// esconde o aviso de baixo
// Devolve: nada — tira a classe que o mostra.
function esconderAviso() { var a = el('aviso'); if (a) a.className = 'eq-toast'; }

/* O estado vazio da casa: contorno tracejado, o que falta dito numa frase e,
   se houver, o botão da ação certa.
   Recebe: titulo — a primeira linha (HTML seguro); frase (opcional) — a
   explicação (HTML seguro); botao (opcional) — o HTML do botão.
   Devolve: string HTML com o estado vazio. */
function vazioHtml(titulo, frase, botao) {
  return '<div class="vazio"><p class="vazio-tit">' + titulo + '</p>' + (frase ? '<p>' + frase + '</p>' : '') + (botao || '') + '</div>';
}
// À espera do servidor: a roda e a frase (nada de contagens antes de a resposta chegar)
// Recebe: frase (opcional) — o que se está a pedir (HTML seguro).
// Devolve: string HTML com a espera.
function esperaHtml(frase) {
  return '<div class="espera" role="status"><span class="roda" aria-hidden="true"></span><span><b>À espera do servidor.</b>' +
    (frase ? ' ' + frase : '') + '</span></div>';
}
// substitui o conteúdo pela espera enquanto a rede responde
// Recebe: frase (opcional) — o que se está a pedir (HTML seguro).
// Devolve: nada — redesenha o conteúdo.
function aCarregar(frase) { el('conteudo').innerHTML = esperaHtml(frase); }
// mostra a mensagem do erro no lugar do conteúdo (o .catch das vistas), com o Tentar outra vez
// Recebe: e — o Error apanhado, com a mensagem a mostrar; acao e args
// (opcionais) — o que o Tentar outra vez corre (sem eles, volta a abrir a secção).
// Devolve: nada — substitui o conteúdo pela mensagem.
function falha(e, acao, args) {
  el('conteudo').innerHTML = vazioHtml('Não deu para carregar.', esc(e && e.message ? e.message : 'Erro sem mensagem.'),
    '<button type="button" class="btn sm"' + (typeof acao === 'string' ? comAcao(acao, args) : comAcao('ir', [seccao || 'pedidos'])) + '>Tentar outra vez</button>');
}
/* O cabeçalho de uma secção: o título da página, a frase que diz o que ali
   está e, à direita, os botões da secção. Acerta também o título da janela.
   Recebe: titulo — o título (texto seguro); sub (opcional) — a frase (HTML
   seguro); extra (opcional) — o HTML dos botões.
   Devolve: string HTML com o cabeçalho. */
function cabecalho(titulo, sub, extra) {
  document.title = titulo + ' · Rendorium Equipa';
  return '<header class="cab"><div class="cab-txt"><h1>' + titulo + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>' +
    (extra ? '<div class="cab-acoes">' + extra + '</div>' : '') + '</header>';
}

// o selo de estado de um pedido: cobalto recebido, âmbar em resolução, verde concluído
// Recebe: p — o pedido (objeto com status: criado, resolucao ou concluido).
// Devolve: string HTML com o selo, pronta a inserir.
function selo(p) {
  var c = p.status === 'concluido' ? 'ok' : p.status === 'resolucao' ? 'wa' : 'ac';
  return badge(c, esc(ESTADOS[p.status] || p.status));
}

/* ------------------------------- navegação ------------------------------ */

// quem abre o rasto das pessoas inteiro (a lista, o resumo, o rasto a partir da ficha): o master e o admin
var veRastoTodos = eu.master || (eu.papeis || []).indexOf('admin') > -1;
// quem pede o rasto de quem escreveu um pedido: os de cima e o suporte (o servidor confere o resto)
var veRastoDoPedido = veRastoTodos || (eu.papeis || []).indexOf('suporte') > -1;

var SECCOES = [
  { id: 'pedidos', nome: 'Pedidos', icone: 'pedidos', conta: 'pessoas', se: eu.cats.indexOf('user') > -1 },
  { id: 'erros', nome: 'Erros', icone: 'erros', conta: 'erros', se: eu.cats.some(function (c) { return c !== 'user'; }) },
  { id: 'pessoas', nome: 'Pessoas', icone: 'procurar', se: eu.cats.indexOf('user') > -1 },
  { id: 'operacao', nome: 'Operação', icone: 'operacao', se: eu.cats.indexOf('infra') > -1 },
  { id: 'rasto', nome: 'Rasto', icone: 'rasto', se: veRastoTodos },
];

// marca a secção ativa e repinta a barra lateral; guarda a secção atual em seccao
// Recebe: ativa — o id da secção a marcar (string: pedidos, erros, pessoas, operacao ou rasto).
// Devolve: nada — redesenha os separadores.
function nav(ativa) {
  seccao = ativa;
  pintarNav();
  mostrarSeparador();
}
/* No telemóvel os separadores são uma fila que corre para o lado: traz o
   ativo à vista mexendo só na fila, nunca na página. No computador a fila
   cabe toda, e não faz nada.
   Devolve: nada — acerta o scrollLeft da fila. */
function mostrarSeparador() {
  var n = el('nav'), fila = n && n.parentElement;
  var ativo = fila && n.querySelector ? n.querySelector('[aria-current="page"]') : null;
  if (!ativo || !(fila.scrollWidth > fila.clientWidth)) return;
  var x = ativo.offsetLeft - fila.offsetLeft;
  if (x < fila.scrollLeft || x + ativo.offsetWidth > fila.scrollLeft + fila.clientWidth) fila.scrollLeft = Math.max(0, x - 16);
}
/* Pinta os separadores da barra lateral — só os que os papéis deixam ver —,
   com o ativo marcado e o crachá de quantos estão por tratar nas listas.
   Devolve: nada — redesenha o #nav. */
function pintarNav() {
  el('nav').innerHTML = SECCOES.filter(function (s) { return s.se; }).map(function (s) {
    var n = s.conta ? contagens[s.conta] : 0;
    return '<button type="button" class="nv"' + (s.id === seccao ? ' aria-current="page"' : '') + comAcao('ir', [s.id]) + '>' +
      ic(s.icone) + '<span>' + s.nome + '</span>' +
      (n ? '<span class="nb n' + (s.conta === 'erros' ? ' erro' : '') + '">' + (n >= 100 ? '99+' : n) +
        '<span class="so-leitor"> por tratar</span></span>' : '') + '</button>';
  }).join('');
}
/* Muda de secção: marca o separador, volta ao cimo e abre a vista respetiva.
   Recebe: s — o id da secção de destino (string, um dos ids de SECCOES);
   alvo (opcional) — no rasto, o alvo da auditoria por que filtrar (abre a vista Equipa).
   Devolve: nada — abre a vista. */
function ir(s, alvo) {
  nav(s);
  if (typeof scrollTo === 'function') scrollTo(0, 0);
  if (s === 'pedidos') verLista('pessoas', 'abertos');
  else if (s === 'erros') verLista('erros', 'abertos');
  else if (s === 'pessoas') verPessoas();
  else if (s === 'operacao') verOperacao();
  else if (s === 'rasto') verRastoEntrada(alvo);
}
// conta os que estão por tratar numa lista que não está à vista, para o crachá da barra
// Recebe: tipo — 'pessoas' ou 'erros' (string).
// Devolve: nada — acerta a contagem e repinta a barra (um erro aqui fica calado).
function contar(tipo) {
  pedir('/api/equipa/pedidos?tipo=' + tipo + '&estado=abertos').then(function (d) {
    contagens[tipo] = (d.pedidos || []).length;
    pintarNav();
  }).catch(function () {});
}

/* ------------------------- pedidos e erros (lista) ----------------------- */

var LISTAS = {
  pessoas: {
    titulo: 'Pedidos de ajuda',
    sub: 'O que as pessoas escrevem na app. A resposta chega à app e por email.',
    vazio: 'Quando alguém escrever na app, o pedido aparece aqui.',
  },
  erros: {
    titulo: 'Erros',
    sub: 'O que a app e o servidor apanham, agrupado: o mesmo erro soma as vezes e as pessoas.',
    vazio: 'Quando a app ou o servidor apanharem um erro, aparece aqui.',
  },
};
// os tipos de pedido que a app manda, por extenso
var KINDS = { problema: 'Problema', sugestao: 'Sugestão' };
// as categorias técnicas, entre as quais um erro pode mudar (a de pessoas não se cruza)
var TECNICAS = ['client', 'server', 'infra', 'seguranca'];

/* A lista de pedidos (tipo 'pessoas') ou de erros (tipo 'erros'), filtrada
   no servidor: e é o estado ('abertos' ou '' para todos) e q o texto da
   procura, feita com Enter no campo. O filtro fica na variável estado para
   a procura não o perder; cada linha abre o pedido ao lado.
   Recebe: tipo — 'pessoas' ou 'erros' (string); e — o estado do filtro
   ('abertos' ou '' para todos); q (opcional) — o texto da procura.
   Devolve: nada — redesenha a vista com a lista. */
function verLista(tipo, e, q) {
  estado = e;
  q = String(q || '').trim();
  var url = '/api/equipa/pedidos?tipo=' + tipo + '&estado=' + encodeURIComponent(e) +
    (q ? '&q=' + encodeURIComponent(q) : '');
  // o título fica no sítio enquanto a lista vem: só o miolo espera
  el('conteudo').innerHTML = cabecalho(LISTAS[tipo].titulo, LISTAS[tipo].sub) + esperaHtml();
  pedir(url).then(function (d) {
    var pedidos = d.pedidos || [];
    if (e === 'abertos' && !q) { contagens[tipo] = pedidos.length; pintarNav(); }
    listaAtual = { tipo: tipo, e: e, q: q, pedidos: pedidos };
    pintarPedidos('', '');
  }).catch(falha);
}

/* Uma linha da lista: o estado, o tipo, quando, o assunto e quem escreveu.
   Recebe: p — o pedido (como vem da lista do servidor); ativo — true quando é o que está aberto ao lado.
   Devolve: string HTML com a linha (um botão que abre o pedido). */
function linhaPedido(p, ativo) {
  var tecnico = p.category !== 'user';
  var quem = p.pessoas > 1 ? p.pessoas + ' pessoas' : esc(p.nome || p.email || p.user_id || '');
  return '<button type="button" class="rq"' + (ativo ? ' aria-current="true"' : '') + comAcao('verPedido', [p.id]) + '>' +
    '<span class="rq-topo">' + selo(p) + badge('', esc(tecnico ? (CATS[p.category] || p.category) : (KINDS[p.kind] || p.kind || 'Pedido'))) +
    '<span class="sub n rq-quando">' + quando(p.updated_at || p.created_at) + '</span></span>' +
    '<span class="rq-tit">' + esc(p.subject) + '</span>' +
    '<span class="sub n">' + quem +
    (p.n > 1 ? ' · ' + esc(p.n) + ' vezes' : '') +
    (p.versao ? ' · versão ' + esc(p.versao) : '') +
    (tecnico || p.status === 'concluido' && !p.refused_at ? ''
      : p.refused_at ? ' · recusado' : p.proposta ? ' · resposta por enviar' : p.accepted_at ? ' · aceite' : ' · por decidir') +
    (p.assignee_nome ? ' · tomado por ' + esc(p.assignee_nome) : ' · #' + esc(curto(p.id))) + '</span></button>';
}

/* Pinta a vista dos pedidos a partir da listaAtual: o cabeçalho, a lista
   (com a procura e os filtros) e, ao lado, o pedido aberto — ou o convite a
   escolher um. Abaixo dos 1200px o CSS mostra um de cada vez.
   Recebe: detalhe — o HTML do pedido aberto ('' sem nenhum); ativo — o id do
   pedido aberto ('' sem nenhum), para marcar a linha.
   Devolve: nada — redesenha o conteúdo. */
function pintarPedidos(detalhe, ativo) {
  var l = listaAtual, cfg = LISTAS[l.tipo];
  var n = l.e === 'abertos' && !l.q ? l.pedidos.length : contagens[l.tipo];
  var topo = '<div class="pd-lista-topo">' +
    '<label class="procura">' + ic('procurar') + '<input id="q" type="search" placeholder="Pesquisar…" ' +
    'aria-label="Procurar por assunto, texto, nome ou email" value="' + esc(l.q) + '"' + ligarA('enter', 'procurarLista', [l.tipo]) + '></label>' +
    '<div class="chips">' +
    chip('Por tratar' + (n != null ? ' <span class="n">' + esc(n) + '</span>' : ''), l.e === 'abertos', comAcao('verLista', [l.tipo, 'abertos'])) +
    chip('Todos', l.e === '', comAcao('verLista', [l.tipo, ''])) + '</div></div>';
  var linhas = l.pedidos.length
    ? l.pedidos.map(function (p) { return linhaPedido(p, p.id === ativo); }).join('')
    : '<div class="pd-vazio">' + vazioHtml(
        l.q ? 'Nada para “' + esc(l.q) + '”.' : l.e === 'abertos' ? 'Nada por tratar.' : 'Ainda não há nada aqui.',
        l.q ? 'Experimenta outra palavra, ou procura em Todos.' : cfg.vazio) + '</div>';
  el('conteudo').innerHTML = cabecalho(cfg.titulo, cfg.sub) +
    '<div class="pd' + (detalhe ? ' com-det' : '') + '">' +
    '<section class="card pd-lista" aria-label="' + esc(cfg.titulo) + '">' + topo + '<div>' + linhas + '</div></section>' +
    (detalhe || '<section class="card pd-det pd-det-vazio">' +
      vazioHtml('Escolhe um pedido da lista.', 'Lês o que a pessoa escreveu, vês quem é e respondes daqui.') + '</section>') +
    '</div>';
}

/* --------------------------- um pedido (detalhe) ------------------------- */

/* O detalhe de um pedido: o texto e o contexto, a ficha de quem escreveu,
   o fio de respostas e notas internas, os outros pedidos da mesma pessoa
   e a caixa de responder com as respostas-tipo. Pinta-se ao lado da lista
   quando ela é do mesmo tipo; senão sozinho, com o Voltar. Os modelos
   carregam-se à primeira vez e ficam em cache na variável modelos.
   Recebe: id — o id do pedido (string, como vem das linhas da lista).
   Devolve: nada — redesenha a vista com o detalhe. */
function verPedido(id) {
  // no telemóvel o pedido toma o lugar da lista: começa-se a lê-lo do cimo
  if (typeof matchMedia === 'function' && matchMedia('(max-width: 1199px)').matches && typeof scrollTo === 'function') scrollTo(0, 0);
  if (listaAtual) pintarPedidos('<section class="card pd-det">' + esperaHtml() + '</section>', id);
  else aCarregar();
  pedidoAberto = id;
  var m = modelos == null ? pedir('/api/equipa/modelos').then(function (d) { modelos = d.modelos || []; }) : Promise.resolve();
  Promise.all([pedir('/api/equipa/pedidos/' + encodeURIComponent(id)), m]).then(function (rs) {
    var d = rs[0], p = d.pedido;
    var tipo = p.category === 'user' ? 'pessoas' : 'erros';
    nav(tipo === 'pessoas' ? 'pedidos' : 'erros');
    if (listaAtual && listaAtual.tipo === tipo) {
      // a linha da lista acompanha o que o pedido é agora (depois de responder, tomar, concluir)
      listaAtual.pedidos.forEach(function (x) {
        if (x.id === p.id) {
          x.status = p.status; x.assignee_nome = p.assignee_nome; x.updated_at = p.updated_at;
          x.accepted_at = p.accepted_at; x.refused_at = p.refused_at; x.proposta = p.draft_reply != null;
        }
      });
      pintarPedidos(detalhePedido(d, tipo, true), p.id);
    } else {
      document.title = (tipo === 'pessoas' ? 'Pedido' : 'Erro') + ' · Rendorium Equipa';
      el('conteudo').innerHTML = '<div class="pd com-det">' + detalhePedido(d, tipo, false) + '</div>';
    }
    // o «Ver o rasto» de quem escreveu chega à parte: o pedido já está no ecrã
    if (d.quem && !d.quem.desconhecido) rastoDoPedido(p.id);
  }).catch(falha);
}

/* O HTML do pedido aberto: o cabeçalho (estado, assunto, de onde veio e o
   Tomar para mim), o fio, a caixa de responder e, ao lado, quem escreveu.
   Recebe: d — a resposta do servidor ({pedido, msgs, quem, outros}); tipo —
   'pessoas' ou 'erros'; comLista — true quando a lista está ao lado (o
   Voltar só aparece no telemóvel).
   Devolve: string HTML com o cartão do pedido. */
function detalhePedido(d, tipo, comLista) {
  var p = d.pedido, q = d.quem, tecnico = p.category !== 'user';
  var meu = p.assignee === eu.discordId;
  var meta = ['#' + esc(curto(p.id)), esc(tecnico ? (CATS[p.category] || p.category) : (KINDS[p.kind] || p.kind || 'Pedido'))];
  if (p.versao) meta.push('versão ' + esc(p.versao));
  if (p.n > 1) meta.push(esc(p.n) + ' vezes');
  meta.push(data(p.created_at));
  if (p.assignee_nome) meta.push(meu ? 'tomado por ti' : 'tomado por ' + esc(p.assignee_nome));

  var cab = '<div class="pd-det-cab">' +
    '<button type="button" class="btn sm ghost pd-voltar' + (comLista ? '' : ' sempre') + '"' +
    comAcao('verLista', [tipo, comLista ? listaAtual.e : 'abertos']) + '>' + ic('voltar') +
    (tipo === 'pessoas' ? 'Voltar aos pedidos' : 'Voltar aos erros') + '</button>' +
    '<div class="pd-det-tit"><div class="rq-topo">' + selo(p) + '</div><h2>' + esc(p.subject) + '</h2>' +
    '<p class="sub n">' + meta.join(' · ') + '</p></div>' +
    '<button type="button" class="btn"' + comAcao('agir', [p.id, 'atribuir']) + '>' + (meu ? 'Largar' : 'Tomar para mim') + '</button></div>';

  var autor = q && !q.desconhecido ? esc(q.nome || q.email) : 'Conta que já não existe';
  var fio = '<div class="ms"><p class="ms-quem">' + autor + ' · ' + data(p.created_at) + '</p>' +
    '<p class="ms-texto' + (tecnico ? ' mono' : '') + '">' + esc(p.body) + '</p></div>' +
    (p.context ? '<p class="sub pd-contexto"><span class="lbl">Contexto</span><span>' + esc(p.context) + '</span></p>' : '');
  // resposta de antes do fio existir (ou escrita por um caminho antigo):
  // está na coluna reply e a pessoa vê-a — a equipa também tem de a ver
  if (!(d.msgs || []).some(function (x) { return x.tipo === 'resposta'; }) && p.reply) {
    fio += '<div class="ms equipa"><p class="ms-quem">Resposta enviada (registo antigo)</p><p class="ms-texto">' + esc(p.reply) + '</p></div>';
  }
  // o fio: respostas que a pessoa vê, notas que só a equipa vê
  fio += (d.msgs || []).map(function (x) {
    var nota = x.tipo === 'nota';
    return '<div class="ms ' + (nota ? 'nota' : 'equipa') + '"><p class="ms-quem">' + (nota ? 'Nota interna · ' : 'Resposta · ') +
      esc(x.nome || x.autor) + ' · ' + data(x.at) + '</p><p class="ms-texto">' + esc(x.texto) + '</p></div>';
  }).join('');

  // a categoria: só entre as técnicas (a de pessoas decide o que a pessoa vê, e não se cruza)
  var categoria = !tecnico ? '' : '<div class="pd-cat"><span class="lbl">Categoria</span><div class="chips">' +
    TECNICAS.map(function (c) {
      return c === p.category
        ? '<span class="chip on" aria-current="true">' + esc(CATS[c] || c) + '</span>'
        : chip(esc(CATS[c] || c), false, comAcao('mudarCategoria', [p.id, c]));
    }).join('') + '</div></div>';

  /* a decisão, só nos pedidos das pessoas: um pedido só se implementa
     depois de aceite (o Claude só pega nos aceites); recusar fecha-o com uma
     justificação. Decidido, fica quem decidiu e quando. */
  var decisao = '';
  if (!tecnico) {
    if (p.refused_at) decisao = '<p class="sub n pd-decidido">Recusado por ' + esc(p.refused_by_nome || p.refused_by || 'alguém da equipa') + ' · ' + data(p.refused_at) + '</p>';
    else if (p.accepted_at) {
      decisao = '<p class="sub n pd-decidido">Aceite para implementar por ' + esc(p.accepted_by_nome || p.accepted_by || 'alguém da equipa') + ' · ' + data(p.accepted_at) +
        (p.accepted_changes ? ', com alterações (na nota interna acima)' : '') + '</p>';
    }
    else if (p.status !== 'concluido') {
      decisao = '<div class="pd-decisao"><p><span class="pd-decisao-tit">Por decidir</span>' +
        '<span class="sub">Só os pedidos aceites seguem para implementar. Recusar conclui o pedido, com a justificação para a pessoa.</span></p>' +
        '<div class="pd-decisao-botoes"><button type="button" class="btn"' + comAcao('recusarPedido', [p.id]) + '>Recusar</button>' +
        '<button type="button" class="btn primary"' + comAcao('aceitarPedido', [p.id]) + '>Aceitar</button></div></div>';
    }
  }
  /* a resposta proposta pelo Claude depois de implementar: vem já na caixa,
     para quem lê a enviar como está ou a mudar antes; só a envia uma pessoa */
  var proposta = !tecnico && p.draft_reply != null && p.status !== 'concluido' ? String(p.draft_reply) : '';

  var resposta = '<div class="pd-resp">' +
    '<div class="pd-resp-modos" role="radiogroup" aria-label="O que escrever">' +
    '<label class="chip"><input type="radio" name="modo" id="modoResposta" class="so-leitor" checked>Responder</label>' +
    '<label class="chip"><input type="radio" name="modo" id="modoNota" class="so-leitor">Nota interna</label>' +
    '<div id="modelosSitio" class="menu">' + menuModelos() + '</div></div>' +
    (proposta ? '<p class="sub pd-proposta">Resposta proposta pelo Claude a ' + data(p.draft_at) +
      ', depois de implementar. Lê-a, muda o que for preciso e envia: a pessoa só a recebe quando a enviares.</p>' : '') +
    '<textarea id="resposta" class="campo" aria-label="Texto" maxlength="2000" data-contar="contaResposta" aria-describedby="respostaErro">' +
    esc(proposta) + '</textarea>' +
    '<p class="erro-txt" id="respostaErro"></p>' +
    '<div class="pd-resp-pe"><span class="sub n"><span id="contaResposta">' + proposta.length + '</span> / 2000 · ' +
    '<span class="so-resposta">' + (tecnico ? 'fica no pedido: não vai para ninguém' : 'a pessoa vê na app e recebe por email') + '</span>' +
    '<span class="so-nota">só a equipa vê</span></span>' +
    '<button type="button" class="btn so-resposta"' + comAcao('guardarModelo') + '>Guardar como modelo</button>' +
    '<button type="button" class="btn so-resposta"' + comAcao('agir', [p.id, 'responder']) + '>Responder</button>' +
    '<button type="button" class="btn primary so-resposta"' + comAcao('agir', [p.id, 'fechar']) + '>Responder e concluir</button>' +
    '<button type="button" class="btn primary so-nota"' + comAcao('agir', [p.id, 'nota']) + '>Guardar nota interna</button>' +
    '</div></div>' +
    (p.status === 'concluido' ? '<div><button type="button" class="btn sm"' + comAcao('agir', [p.id, 'reabrir']) + '>Reabrir o pedido</button></div>' : '');

  var lado = '';
  if (q && !q.desconhecido) {
    var marcas = (q.suspensa ? badge('dg', 'Conta suspensa') : '') + (q.apagada ? badge('dg', 'Conta apagada') : '') +
      (q.aceitouTermos ? '' : badge('wa', 'Não aceitou os termos'));
    lado = '<p class="lbl">Quem escreveu</p><p class="pd-nome">' + esc(q.nome || '—') + '</p>' +
      '<p class="sub quebra">' + esc(q.email) + ' · ' + esc(q.id) + '</p>' +
      '<p class="sub n">Entrou a ' + dia(q.desde) + ' · ' + esc(q.casas) + ' casas · ' + esc(q.registos) + ' registos</p>' +
      '<p class="sub n">' + esc(q.errosApanhados || 0) + ' erros apanhados · ' + (q.aceitouTermos ? 'termos aceites' : 'termos por aceitar') + '</p>' +
      (marcas ? '<p class="chips">' + marcas + '</p>' : '') +
      (eu.cats.indexOf('user') > -1 ? '<button type="button" class="btn sm"' + comAcao('verPessoa', [q.id]) + '>Abrir a ficha</button>' : '') +
      (veRastoDoPedido ? '<div id="pedidoRasto" class="rs-no-pedido"></div>' : '');
  } else if (q) {
    lado = '<p class="lbl">Quem escreveu</p><p class="sub">A conta já não existe (' + esc(q.id) + ').</p>';
  }
  if ((d.outros || []).length) {
    lado += '<p class="lbl pd-lbl-sep">Outros pedidos</p>' + d.outros.map(function (o) {
      return '<button type="button" class="lado-linha"' + comAcao('verPedido', [o.id]) + '><span class="sub">' +
        esc(ESTADOS[o.status] || o.status) + ' · </span><span class="lado-tit">' + esc(o.subject) + '</span></button>';
    }).join('');
  }

  return '<section class="card pd-det" aria-label="Pedido aberto">' + cab +
    '<div class="pd-det-corpo"><div class="pd-fio">' + fio + categoria + decisao + resposta + '</div>' +
    (lado ? '<aside class="pd-lado">' + lado + '</aside>' : '') + '</div></section>';
}

// o menu dos modelos (as respostas-tipo), ao lado dos modos; vazio sem modelos
// Devolve: string HTML com o menu, ou '' sem modelos.
function menuModelos() {
  if (!(modelos || []).length) return '';
  return '<details id="modelosMenu"><summary class="chip">Modelos ' + ic('baixo', 'i-sm') + '</summary><div class="menu-lista">' +
    modelos.map(function (x, i) {
      return '<button type="button" class="menu-op"' + comAcao('usarModelo', [i]) + '>' + esc(x.titulo) + '</button>';
    }).join('') + '</div></details>';
}

// o que o aviso diz quando uma ação sobre o pedido corre bem
var FEITO = { responder: 'Resposta enviada.', fechar: 'Respondido e concluído.', nota: 'Nota interna guardada.', reabrir: 'Pedido reaberto.' };

// executa uma ação sobre o pedido (responder, fechar, nota, atribuir,
// reabrir) com o texto da caixa; responder e nota exigem texto escrito
// Recebe: id — o id do pedido (string); acao — a ação (string: responder,
// fechar, nota, atribuir ou reabrir).
// Devolve: nada — executa no servidor e reabre o detalhe.
function agir(id, acao) {
  var caixa = el('resposta');
  var t = caixa ? String(caixa.value || '').trim() : '';
  if ((acao === 'responder' || acao === 'nota') && !t) {
    marcarErro('resposta', acao === 'nota' ? 'Escreve a nota primeiro.' : 'Escreve a resposta primeiro.');
    if (caixa && caixa.focus) caixa.focus();
    return;
  }
  enviar('/api/equipa/pedidos/' + encodeURIComponent(id) + '/' + acao, { texto: t })
    .then(function () { if (FEITO[acao]) avisar(FEITO[acao]); verPedido(id); })
    .catch(function (e) { avisar(e.message, 'erro'); });
}
/* Aceita um pedido de uma pessoa para implementar: a janela deixa escrever
   alterações ao pedido (opcional; só a equipa as vê, e são o que se
   implementa). O servidor regista quem, quando e as alterações.
   Recebe: id — o id do pedido (string).
   Devolve: nada — abre a janela; ao confirmar, executa e reabre o detalhe. */
function aceitarPedido(id) {
  formulario('Aceitar o pedido', [{
    nome: 'alteracoes', rotulo: 'Alterações ao pedido', tipo: 'area', obrigatorio: false, max: 2000,
    ajuda: 'Se queres que se implemente de outra forma, escreve aqui como. Só a equipa vê.',
  }], function (v) {
    return enviar('/api/equipa/pedidos/' + encodeURIComponent(id) + '/aceitar', { texto: v.alteracoes || '' })
      .then(function () { avisar(v.alteracoes ? 'Pedido aceite, com as tuas alterações.' : 'Pedido aceite para implementar.'); verPedido(id); });
  }, { texto: 'O pedido segue para implementar.', botao: 'Aceitar' });
}
/* Recusa um pedido de uma pessoa: a janela pede a justificação (obrigatória),
   que a pessoa recebe como resposta, e o pedido fica concluído.
   Recebe: id — o id do pedido (string).
   Devolve: nada — abre a janela; ao confirmar, executa e reabre o detalhe. */
function recusarPedido(id) {
  formulario('Recusar o pedido', [{
    nome: 'justificacao', rotulo: 'Porque é recusado', tipo: 'area', max: 2000,
    ajuda: 'A pessoa recebe esta justificação na app e por email.',
    exemplo: 'Ex: Por agora não vamos mudar isto, porque…',
  }], function (v) {
    return enviar('/api/equipa/pedidos/' + encodeURIComponent(id) + '/recusar', { texto: v.justificacao })
      .then(function () { avisar('Pedido recusado e concluído.'); verPedido(id); });
  }, { texto: 'O pedido fica concluído, e não segue para implementar.', botao: 'Recusar', perigo: true });
}
// muda a categoria de um erro para a do chip e reabre o detalhe
// Recebe: id — o id do pedido (string); categoria — a categoria nova (string, uma das TECNICAS).
// Devolve: nada — grava no servidor e reabre o detalhe.
function mudarCategoria(id, categoria) {
  enviar('/api/equipa/pedidos/' + encodeURIComponent(id) + '/categoria', { categoria: categoria })
    .then(function () { avisar('Passou a «' + (CATS[categoria] || categoria) + '».'); verPedido(id); })
    .catch(function (e) { avisar(e.message, 'erro'); });
}
// copia a resposta-tipo escolhida para a caixa, por cima do que lá estiver, e volta ao modo Responder
// Recebe: i — a posição do modelo na lista modelos (número ou texto com o número).
// Devolve: nada — preenche a caixa de resposta.
function usarModelo(i) {
  var m = (modelos || [])[Number(i)];
  if (!m) return;
  var caixa = el('resposta'), modo = el('modoResposta'), menu = el('modelosMenu');
  if (modo) modo.checked = true;
  if (menu) menu.open = false;
  if (caixa) { caixa.value = m.texto || ''; marcarErro('resposta', ''); contarCaracteres(caixa); }
}
/* Guarda o texto da caixa como resposta-tipo nova: o nome pede-se na janela,
   e a lista dos modelos vem fresca do servidor para o menu.
   Devolve: nada — abre a janela; ao confirmar, grava no servidor. */
function guardarModelo() {
  var t = el('resposta') ? String(el('resposta').value || '').trim() : '';
  if (!t) { marcarErro('resposta', 'Escreve primeiro o texto do modelo.'); return; }
  formulario('Guardar como modelo', [
    { nome: 'titulo', rotulo: 'Nome do modelo', exemplo: 'Ex: Renda duplicada', max: 80 },
  ], function (v) {
    return enviar('/api/equipa/modelos', { titulo: v.titulo, texto: t }).then(function () {
      avisar('Modelo guardado: ' + v.titulo + '.');
      return pedir('/api/equipa/modelos').then(function (d) {
        modelos = d.modelos || [];
        var sitio = el('modelosSitio');
        if (sitio) sitio.innerHTML = menuModelos();
      }, function () { modelos = null; });
    });
  }, { texto: 'Fica no menu dos modelos, para toda a equipa.', botao: 'Guardar modelo' });
}

/* ------------------------------- pessoas -------------------------------- */

/* A procura de contas por email, nome ou id. Só vai à rede com 3 ou mais
   caracteres — menos que isso era pedir meia base de dados. Cada resultado
   abre a ficha; o master tem ainda o botão de criar conta.
   Recebe: q (opcional) — o texto da procura (string; só procura com 3+ caracteres).
   Devolve: nada — redesenha a vista com os resultados. */
function verPessoas(q) {
  q = String(q || '').trim();
  ultimaProcura = q;
  var topo = cabecalho('Pessoas', 'Procurar por email, nome ou id. Só dados de conta: nunca o que está nas casas, valores ou inquilinos.',
    eu.master ? '<button type="button" class="btn"' + comAcao('criarConta') + '>' + ic('mais') + 'Criar conta</button>' : '') +
    '<div class="card pp-busca"><label class="procura">' + ic('procurar') + '<input id="q" type="search" placeholder="Pesquisar…" ' +
    'aria-label="Procurar por email, nome ou id" value="' + esc(q) + '"' + ligarA('enter', 'procurarPessoas') + '></label>' +
    '<button type="button" class="btn primary"' + comAcao('procurarPessoas') + '>Procurar</button></div>';
  if (q.length < 3) {
    el('conteudo').innerHTML = topo + vazioHtml('Procura uma conta.', 'Escreve pelo menos três caracteres do email ou do nome, ou o id inteiro.');
    return;
  }
  el('conteudo').innerHTML = topo + esperaHtml('A procurar «' + esc(q) + '».');
  pedir('/api/equipa/pessoas?q=' + encodeURIComponent(q)).then(function (d) {
    var pessoas = d.pessoas || [];
    el('conteudo').innerHTML = topo + (!pessoas.length
      ? vazioHtml('Ninguém com “' + esc(q) + '”.', 'Experimenta o email inteiro, ou o id.')
      : '<section class="card" aria-label="Resultados"><p class="sub n pp-conta">' + pessoas.length +
        (pessoas.length === 1 ? ' conta' : ' contas') + (pessoas.length >= 20 ? ' (as 20 mais recentes)' : '') + '</p>' +
        pessoas.map(linhaPessoa).join('') + '</section>');
  }).catch(falha);
}

// uma linha dos resultados: as iniciais, o nome, o email e o id, e o estado se não estiver ativa
// Recebe: u — a conta (como vem da procura: id, name, email, created_at, deleted_at, suspended_at).
// Devolve: string HTML com a linha (um botão que abre a ficha).
function linhaPessoa(u) {
  return '<button type="button" class="linha tocavel"' + comAcao('verPessoa', [u.id]) + '>' +
    '<span class="avatar sm" aria-hidden="true">' + esc(iniciais(u.name || u.email)) + '</span>' +
    '<span class="linha-txt"><span class="forte quebra">' + esc(u.name || u.email) + '</span>' +
    '<span class="sub n quebra">' + esc(u.email) + ' · ' + esc(u.id) + (u.created_at ? ' · desde ' + dia(u.created_at) : '') + '</span></span>' +
    (u.deleted_at ? badge('dg', 'Apagada') : u.suspended_at ? badge('dg', 'Suspensa') : '') + ic('seta', 'seta') + '</button>';
}

/* ------------------------- a janela de confirmação ------------------------- */

/* Um formulário na janela de confirmação (o <dialog id="dialogo">), para o
   que pede valores ou um motivo: vários campos de uma vez, os segredos num
   campo de palavra-passe (não os mostra a quem estiver ao lado do ecrã), o
   que vai acontecer dito antes, e Cancelar ao lado da ação — vermelha
   cheia quando destrói. Ao fechar (Cancelar, Esc, ou depois de feito) a
   janela esvazia-se: a palavra-passe não fica no DOM depois de usada.
   Recebe: titulo — o título da janela (texto); campos — lista de { nome,
   rotulo, tipo ('text', 'email', 'password' ou 'area'), obrigatorio (falso
   para opcional), exemplo (o placeholder «Ex: …»), ajuda, min, max, nota };
   aoConfirmar — função que recebe { nome: valor } e pode devolver uma
   promessa: enquanto corre, o botão espera; se rejeitar, o erro fica na
   janela, aberta; opcoes (opcional) — { texto (HTML seguro), botao, perigo }.
   Devolve: nada — abre a janela. */
function formulario(titulo, campos, aoConfirmar, opcoes) {
  var o = opcoes || {};
  var d = el('dialogo');
  formAberto = { campos: campos, aoConfirmar: aoConfirmar, botao: o.botao || 'Confirmar', ocupado: false };
  d.innerHTML = '<div class="janela-corpo">' +
    '<h2 id="janelaTit">' + esc(titulo) + '</h2>' +
    (o.texto ? '<p class="janela-txt">' + o.texto + '</p>' : '') +
    campos.map(campoHtml).join('') +
    '<p class="erro-txt" id="janelaErro" role="alert"></p>' +
    '<div class="janela-botoes"><button type="button" class="btn"' + comAcao('fecharDialogo') + '>Cancelar</button>' +
    '<button type="button" id="janelaOk" class="btn ' + (o.perigo ? 'danger' : 'primary') + '"' + comAcao('confirmarFormulario') + '>' +
    esc(formAberto.botao) + '</button></div></div>';
  d.returnValue = '';
  d.onclose = function () {
    // uma janela nova aberta entretanto não se apaga com o fecho da anterior
    if (d.open) return;
    formAberto = null;
    d.innerHTML = '';
  };
  if (!d.open) d.showModal();
  var primeiro = d.querySelector('input,textarea');
  if (primeiro && primeiro.focus) primeiro.focus();
}

/* Um campo da janela: o rótulo (com o * vermelho quando é obrigatório), a
   ajuda, o campo, o contador quando tem máximo à vista, e o sítio do erro.
   Recebe: c — o campo, como os do formulario.
   Devolve: string HTML com o bloco do campo. */
function campoHtml(c) {
  var id = 'campo-' + c.nome, obrigatorio = c.obrigatorio !== false;
  var ph = c.exemplo ? ' placeholder="' + esc(c.exemplo) + '"' : (!obrigatorio ? ' placeholder="Opcional"' : '');
  var comum = ' id="' + id + '" name="' + esc(c.nome) + '" class="campo" aria-describedby="' + id + 'Erro"' +
    (c.max ? ' maxlength="' + c.max + '"' : '');
  var entrada = c.tipo === 'area'
    ? '<textarea' + comum + ph + ' data-contar="' + id + 'Conta"></textarea>'
    : '<input' + comum + ' type="' + esc(c.tipo || 'text') + '"' + ph +
      (c.tipo === 'password' ? ' autocomplete="new-password"' : ' autocomplete="off"') + ligarA('enter', 'confirmarFormulario') + '>';
  return '<div class="campo-bloco"><label class="rot" for="' + id + '">' + esc(c.rotulo) + (obrigatorio ? ' <span class="req">*</span>' : '') + '</label>' +
    (c.ajuda ? '<p class="sub">' + esc(c.ajuda) + '</p>' : '') + entrada +
    (c.tipo === 'area' && c.max ? '<p class="sub n dir"><span id="' + id + 'Conta">0</span> / ' + c.max + (c.nota ? ' · ' + esc(c.nota) : '') + '</p>' : '') +
    '<p class="erro-txt" id="' + id + 'Erro"></p></div>';
}

/* Confirma a janela aberta: confere os campos (o obrigatório preenchido, o
   mínimo de caracteres) e diz o que falta debaixo de cada um; com tudo
   certo, corre o aoConfirmar e fecha quando ele acaba — se o servidor
   recusar, a janela fica aberta com o porquê.
   Devolve: nada — fecha a janela, ou marca os erros. */
function confirmarFormulario() {
  var f = formAberto;
  if (!f || f.ocupado) return;
  var valores = {}, bom = true;
  f.campos.forEach(function (c) {
    var i = el('campo-' + c.nome);
    var v = !i ? '' : c.tipo === 'password' ? String(i.value || '') : String(i.value || '').trim();
    var erro = '';
    if (c.obrigatorio !== false && !v) erro = 'Preenche o campo «' + c.rotulo + '».';
    else if (v && c.min && v.length < c.min) erro = 'Escreve pelo menos ' + c.min + ' caracteres.';
    marcarErro('campo-' + c.nome, erro);
    if (erro) bom = false;
    valores[c.nome] = v;
  });
  if (!bom) return;
  f.ocupado = true;
  pintarOcupado(true);
  Promise.resolve().then(function () { return f.aoConfirmar(valores); }).then(function () {
    if (formAberto === f) el('dialogo').close();
  }, function (e) {
    f.ocupado = false;
    pintarOcupado(false);
    var sitio = el('janelaErro');
    if (sitio) sitio.textContent = e && e.message ? e.message : 'Não deu.';
  });
}
// o botão da janela enquanto o servidor responde: parado e a dizer que espera
// Recebe: sim — true enquanto espera, false para voltar ao normal.
// Devolve: nada — muda o botão.
function pintarOcupado(sim) {
  var b = el('janelaOk');
  if (!b || !formAberto) return;
  b.disabled = sim;
  b.textContent = sim ? 'À espera do servidor…' : formAberto.botao;
}
/* Marca um campo com erro (o contorno vermelho e a frase por baixo, que diz
   o que fazer), ou tira a marca com o erro vazio. O sítio da frase é o
   elemento com o id do campo seguido de Erro.
   Recebe: id — o id do campo (string); erro — a frase ('' tira a marca).
   Devolve: nada — muda o campo e a frase. */
function marcarErro(id, erro) {
  var i = el(id), e = el(id + 'Erro');
  if (i && i.setAttribute) { if (erro) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); }
  if (e) e.textContent = erro;
}
// acerta o contador de caracteres de um campo (o id do contador vem no data-contar)
// Recebe: campo — o elemento do campo.
// Devolve: nada — escreve o número no contador.
function contarCaracteres(campo) {
  var alvo = campo.getAttribute ? el(campo.getAttribute('data-contar')) : null;
  if (alvo) alvo.textContent = String((campo.value || '').length);
}
// o valor de um campo da página, sem espaços à volta ('' sem o campo)
// Recebe: id — o id do campo (string).
// Devolve: o texto do campo.
function valorDe(id) { var i = el(id); return i ? String(i.value || '').trim() : ''; }

// o motivo: pede-o cada ação de conta e cada endereço, e fica no rasto
var CAMPO_MOTIVO = { nome: 'motivo', rotulo: 'Motivo', tipo: 'area', min: 5, max: 300, nota: 'mínimo 5 · fica no rasto' };

/* Criar uma conta à mão: para a equipa, para um teste com email verdadeiro,
   para quem pede ajuda a entrar. O servidor recusa emails repetidos. Os
   dados pedem-se na janela, e a palavra-passe num campo de palavra-passe —
   num prompt() ficava em claro no ecrã.
   Devolve: nada — abre a janela; ao confirmar, cria no servidor e abre a ficha. */
function criarConta() {
  formulario('Criar conta', [
    { nome: 'email', rotulo: 'Email da conta nova', tipo: 'email', exemplo: 'Ex: nome@exemplo.pt' },
    { nome: 'nome', rotulo: 'Nome', obrigatorio: false, ajuda: 'Vazio, fica a parte do email antes do @.', max: 120 },
    { nome: 'password', rotulo: 'Palavra-passe', tipo: 'password', ajuda: '8 ou mais caracteres, com maiúscula, minúscula, número e símbolo.' },
    CAMPO_MOTIVO,
  ], function (v) {
    return enviar('/api/equipa/pessoas', { email: v.email, nome: v.nome, password: v.password, motivo: v.motivo })
      .then(function (d) { avisar('Conta criada: ' + d.email + ' (' + d.id + ').'); verPessoa(d.id); });
  }, {
    texto: 'Para a equipa, para um teste com email verdadeiro, ou para quem pede ajuda a entrar. Os termos ficam por aceitar: a pessoa aceita-os ao entrar pela primeira vez.',
    botao: 'Criar conta',
  });
}

/* ------------------------------- a ficha -------------------------------- */

// como a pessoa entra, por extenso
var ENTRADAS = { 'password + google': 'Palavra-passe e Google', password: 'Palavra-passe', google: 'Google', nenhuma: 'Nenhuma' };

/* A ficha completa de uma conta: a conta, as ligações, os serviços (com os
   interruptores), os pedidos que fez e — só ao master — as ações e as
   últimas ações da equipa sobre ela. Os serviços e o rasto chegam à parte:
   a ficha já está no ecrã, e um erro neles fica no cartão deles.
   Recebe: id — o id da conta (string).
   Devolve: nada — redesenha a vista com a ficha. */
function verPessoa(id) {
  nav('pessoas');
  aCarregar('A abrir a ficha.');
  pedir('/api/equipa/pessoas/' + encodeURIComponent(id)).then(function (d) {
    var q = d.quem;
    fichaVista = q;
    document.title = (q.nome || q.email) + ' · Rendorium Equipa';
    var nomeVisto = q.nome || q.email;
    var estadoConta = q.apagada ? badge('dg', 'Apagada') : q.suspensa ? badge('dg', 'Suspensa') : badge('ok', 'Ativa');

    var topo = '<div class="fi-busca">' +
      '<button type="button" class="btn so-icone" aria-label="Voltar à procura"' + comAcao('verPessoas') + '>' + ic('voltar') + '</button>' +
      '<label class="procura">' + ic('procurar') + '<input id="q" type="search" placeholder="Pesquisar…" ' +
      'aria-label="Procurar outra conta por email, nome ou id" value="' + esc(ultimaProcura) + '"' + ligarA('enter', 'procurarPessoas') + '></label>' +
      '<span class="sub">Só dados de conta: nunca o que está nas casas, valores ou inquilinos.</span></div>';

    var cab = '<header class="card fi-cab"><span class="avatar" aria-hidden="true">' + esc(iniciais(nomeVisto)) + '</span>' +
      '<div class="fi-cab-txt"><div class="fi-nome"><h1>' + esc(nomeVisto) + '</h1>' + estadoConta + '</div>' +
      '<p class="sub n">' + esc(q.email) + ' · id ' + esc(q.id) + ' · entrou a ' + dia(q.desde) + '</p></div>' +
      '<div class="fi-cab-acoes">' +
      ((d.pedidos || []).length ? '<a class="btn" href="#pessoaPedidos">Pedidos <span class="n sub">' + esc(d.pedidos.length) + '</span></a>' : '') +
      (d.master ? '<button type="button" class="btn"' + comAcao('ir', ['rasto', q.id]) + '>Ver no rasto</button>' : '') +
      (veRastoTodos ? '<span id="fichaRasto" class="rs-na-ficha"></span>' : '') +
      '</div></header>';

    var limites = q.limites || [], propostas = q.propostas || [];
    var kv = function (rotulo, valor) { return '<div class="kv"><span>' + rotulo + '</span><span>' + valor + '</span></div>'; };
    var conta = '<section class="card" aria-labelledby="titConta"><div class="card-cab"><h2 id="titConta" class="card-tit">Conta</h2></div><div class="kvs">' +
      kv('Forma de entrar', esc(ENTRADAS[q.entrada] || q.entrada)) +
      kv('Última atividade', '<span class="n">' + idade(q.ultimaAtividade) + (q.versaoApp ? ' · versão ' + esc(q.versaoApp) : '') + '</span>') +
      kv('Casas e registos', '<span class="n">' + esc(q.casas) + ' casas · ' + esc(q.registos) + ' registos</span>') +
      kv('Pedidos e erros', '<span class="n">' + esc(q.pedidos) + ' pedidos · ' + esc(q.errosApanhados) + ' erros apanhados</span>') +
      kv('Termos', q.termos ? 'Versão ' + esc(q.termos) + ' aceite' : badge('wa', 'Por aceitar')) +
      kv('Propostas de quotas', !propostas.length ? 'Nenhuma por resolver'
        : '<span class="n">' + propostas.length + ' por resolver</span>' + propostas.map(function (p) {
            return '<span class="sub n">casa ' + esc(p.house_id) + ' · ' + dia(p.created_at) + '</span>';
          }).join('')) +
      kv('Travões ativos', !limites.length ? 'Nenhum'
        : '<span class="n">' + limites.length + '</span>' + limites.map(function (l) {
            return '<span class="sub n quebra">' + esc(l.k) + ' · ' + esc(l.n) + (Number(l.n) === 1 ? ' tentativa' : ' tentativas') + ' · até ' + hora(l.expires_at) + '</span>';
          }).join('')) +
      '</div></section>';

    var ligacoes = '<section class="card" aria-labelledby="titLigacoes"><div class="card-cab"><div class="card-cab-txt">' +
      '<h2 id="titLigacoes" class="card-tit">Ligações</h2><p class="sub">Quem partilha dados com esta conta. Só nomes e o estado.</p></div></div>' +
      ((q.ligacoes || []).length ? q.ligacoes.map(function (l) {
        return '<button type="button" class="linha tocavel"' + comAcao('verPessoa', [l.outro_id]) + '>' +
          '<span class="linha-txt"><span class="forte quebra">' + esc(l.outro_nome || l.outro_email) + '</span>' +
          '<span class="sub n">' + (l.sentido === 'enviada' ? 'esta conta convidou' : 'convidou esta conta') + ' · ' + esc(l.outro_id) + '</span></span>' +
          (l.status === 'accepted' ? badge('ok', esc(l.casas_partilhadas) + ' casas partilhadas') : badge('wa', 'Por responder')) +
          ic('seta', 'seta') + '</button>';
      }).join('') : '<div class="card-pe"><p class="sub">Esta conta não partilha nada com ninguém.</p></div>') + '</section>';

    var pedidos = (d.pedidos || []).length
      ? '<section class="card" id="pessoaPedidos" aria-labelledby="titPedidos"><div class="card-cab"><h2 id="titPedidos" class="card-tit">Pedidos</h2></div>' +
        d.pedidos.map(function (o) {
          return '<button type="button" class="linha tocavel"' + comAcao('verPedido', [o.id]) + '>' + selo(o) +
            '<span class="linha-txt"><span class="quebra">' + esc(o.subject) + '</span><span class="sub n">' + dia(o.created_at) + '</span></span>' +
            ic('seta', 'seta') + '</button>';
        }).join('') + '</section>'
      : '';

    var lado = '';
    if (d.master) {
      lado = (q.apagada
        ? '<section class="card card-pad"><h2 class="card-tit">Ações</h2><p class="sub">A conta foi apagada: já não há onde mexer.</p></section>'
        : cartaoAcoes(q)) + '<div id="pessoaRasto"></div>';
    }

    el('conteudo').innerHTML = topo + cab +
      '<div class="fi-grelha"><div class="fi-main">' + conta + ligacoes + '<div id="servicosCard"></div>' + pedidos + '</div>' +
      (lado ? '<aside class="fi-lado" aria-label="Ações sobre a conta">' + lado + '</aside>' : '') + '</div>';
    // os serviços chegam à parte: a ficha já está no ecrã, e um erro aqui fica no cartão
    verServicos(q.id);
    if (d.master) verRastoDaPessoa(q.id);
    if (veRastoTodos) rastoDaConta(q.id);
  }).catch(falha);
}

/* As ações sobre a conta, cada uma um botão que abre a janela com o motivo
   — é o que daqui a seis meses distingue "porque foi preciso" de "ninguém
   sabe". Suspender em âmbar e apagar em vermelho, para nunca se carregar
   por engano no que pesa.
   Recebe: q — a ficha da conta (objeto com id, entrada, suspensa e limites, entre o resto).
   Devolve: string HTML com o cartão de ações, pronta a inserir. */
function cartaoAcoes(q) {
  var b = function (acao, nome, classe, extra) {
    return '<button type="button" class="btn lista ' + (classe || '') + '"' + comAcao('acaoConta', [q.id, acao]) + '>' + nome + (extra || '') + '</button>';
  };
  var travoes = (q.limites || []).length;
  return '<section class="card card-pad acoes-cartao" aria-labelledby="titAcoes">' +
    '<div class="card-tit-linha"><h2 id="titAcoes" class="card-tit">Ações</h2>' + badge('ac', 'master') + '</div>' +
    '<p class="sub">Cada ação pede um motivo e fica no rasto com o teu nome.</p>' +
    b('sessoes', 'Terminar sessões em todos os aparelhos') +
    b('limpar-limites', 'Limpar travões de tentativas', '', travoes ? ' <span class="n sub">' + travoes + '</span>' : '') +
    b('email', 'Mudar email') +
    b('password', 'Definir palavra-passe nova') +
    (String(q.entrada || '').indexOf('google') > -1 ? b('desligar-google', 'Desligar o Google') : '') +
    (q.suspensa ? b('reativar', 'Reativar a conta') : b('suspender', 'Suspender', 'texto-aviso')) +
    b('apagar', 'Apagar de vez', 'texto-perigo') +
    '</section>';
}

// o nome da pessoa da ficha, a negrito, para as frases das janelas
var nomeDe = function (q) { return '<b>' + esc(q.nome || q.email || 'A pessoa') + '</b>'; };

/* O que cada ação de conta diz e pede na janela: o título, a frase do que
   vai acontecer (com o nome da pessoa), o botão (vermelho cheio quando
   pesa) e, quando a ação o pede, o campo do valor. */
var ACOES_CONTA = {
  sessoes: { titulo: 'Terminar sessões em todos os aparelhos', botao: 'Terminar sessões',
    texto: function (q) { return nomeDe(q) + ' tem de voltar a entrar em todos os aparelhos. Os dados ficam como estão.'; } },
  'limpar-limites': { titulo: 'Limpar travões de tentativas', botao: 'Limpar travões',
    texto: function (q) {
      var n = (q.limites || []).length;
      return 'Apaga os travões ativos desta conta' + (n ? ' (' + n + ')' : '') + ': ' + nomeDe(q) + ' pode voltar a tentar já, sem esperar que acabem.';
    } },
  email: { titulo: 'Mudar email', botao: 'Mudar email',
    campo: { nome: 'valor', rotulo: 'Email novo', tipo: 'email', exemplo: 'Ex: nome@exemplo.pt' },
    texto: function (q) { return 'Hoje é ' + (q.email ? '<b>' + esc(q.email) + '</b>' : 'outro') + '. A pessoa passa a entrar com o novo.'; } },
  password: { titulo: 'Definir palavra-passe nova', botao: 'Definir palavra-passe',
    campo: { nome: 'valor', rotulo: 'Palavra-passe nova', tipo: 'password', ajuda: '8 ou mais caracteres, com maiúscula, minúscula, número e símbolo.' },
    texto: function (q) { return 'Para quem ficou trancado fora sem acesso ao email. As sessões abertas de ' + nomeDe(q) + ' terminam todas.'; } },
  'desligar-google': { titulo: 'Desligar o Google', botao: 'Desligar o Google',
    texto: function (q) { return nomeDe(q) + ' deixa de entrar pelo Google e fica com a palavra-passe. Numa conta só com o Google, o servidor recusa: trancava a pessoa fora.'; } },
  suspender: { titulo: 'Suspender a conta', botao: 'Suspender', perigo: true,
    texto: function (q) { return nomeDe(q) + ' deixa de conseguir entrar e as sessões abertas terminam. Os dados ficam como estão; podes reativar quando quiseres.'; } },
  reativar: { titulo: 'Reativar a conta', botao: 'Reativar',
    texto: function (q) { return nomeDe(q) + ' volta a poder entrar. As sessões de antes da suspensão não voltam.'; } },
  apagar: { titulo: 'Apagar de vez', botao: 'Apagar de vez', perigo: true,
    campo: { nome: 'valor', rotulo: 'Email exato da conta', tipo: 'email' },
    texto: function (q) {
      return 'Apaga mesmo: casas, registos, partilhas, tudo. Não se desfaz. Para confirmar, escreve o email exato da conta' +
        (q.email ? ': <b>' + esc(q.email) + '</b>' : '') + '.';
    } },
};

/* Abre a janela de uma ação de master sobre a conta: o que vai acontecer,
   o valor quando a ação o pede (o email novo; a palavra-passe num campo de
   palavra-passe; apagar pede o email exato como confirmação) e o motivo —
   sem motivo não acontece nada.
   Recebe: id — o id da conta (string); acao — a ação (string: sessoes,
   limpar-limites, email, password, desligar-google, suspender,
   reativar ou apagar).
   Devolve: nada — abre a janela; ao confirmar, executa e recarrega a ficha. */
function acaoConta(id, acao) {
  var a = Object.prototype.hasOwnProperty.call(ACOES_CONTA, acao) ? ACOES_CONTA[acao] : null;
  if (!a) return;
  var q = fichaVista && fichaVista.id === id ? fichaVista : { id: id };
  formulario(a.titulo, (a.campo ? [a.campo] : []).concat([CAMPO_MOTIVO]), function (v) {
    return fazerAcaoConta(id, acao, a.campo ? v.valor : undefined, v.motivo);
  }, { texto: a.texto(q), botao: a.botao, perigo: a.perigo });
}

// Manda a ação de conta ao servidor; com a resposta, diz o resultado no aviso e recarrega a ficha.
// Recebe: id — o id da conta (string); acao — a ação (string); valor — o que a
// ação pede (email, palavra-passe, a confirmação de apagar; ou nada); motivo — o motivo, que fica no rasto.
// Devolve: a promessa do pedido (rejeita com o erro do servidor, que a janela mostra).
function fazerAcaoConta(id, acao, valor, motivo) {
  return enviar('/api/equipa/pessoas/' + encodeURIComponent(id) + '/acao', { acao: acao, valor: valor, motivo: motivo })
    .then(function (d) { avisar(maiuscula(d.resultado || 'feito') + '.'); verPessoa(id); });
}

/* As últimas ações da equipa sobre esta conta (só o master lê o rasto):
   as cinco mais recentes, sem as aberturas da ficha, que são leituras.
   Recebe: id — o id da conta (string).
   Devolve: nada — preenche o cartão pessoaRasto (um erro aqui fica calado). */
function verRastoDaPessoa(id) {
  pedir('/api/equipa/auditoria?alvo=' + encodeURIComponent(id)).then(function (d) {
    var regs = (d.registos || []).filter(function (r) { return r.acao !== 'pessoa.ver'; }).slice(0, 5);
    el('pessoaRasto').innerHTML = '<section class="card card-pad rs-pessoa" aria-labelledby="titRastoPessoa">' +
      '<h2 id="titRastoPessoa" class="lbl">Últimas ações da equipa</h2>' +
      (regs.length ? regs.map(function (r) {
        return '<p class="linha sub n">' + dia(r.at) + ' · ' + esc(r.nome || r.quem) + ' · ' + esc(r.acao) + (r.detalhe ? ' — ' + esc(r.detalhe) : '') + '</p>';
      }).join('') : '<p class="sub">Ninguém da equipa mexeu nesta conta.</p>') + '</section>';
  }).catch(function () {});
}

/* ------------------------- os serviços da conta ------------------------- */

// a última lista pintada, para a confirmação ao desligar saber quem cai junto
var servicosVistos = [];

/* O cartão «Serviços» da ficha: cada separador da app é um serviço que se
   pode desligar a esta conta. Vai buscar a lista ao servidor e pinta-a por
   pintarServicos; o resto da ficha já está no ecrã, por isso um erro aqui
   fica dentro do cartão em vez de deitar a ficha abaixo.
   Recebe: id — o id da conta (string).
   Devolve: nada — preenche o cartão servicosCard. */
function verServicos(id) {
  el('servicosCard').innerHTML = cartaoServicos('', esperaHtml('A pedir os serviços desta conta.'));
  pedir('/api/equipa/pessoas/' + encodeURIComponent(id) + '/servicos')
    .then(function (d) { pintarServicos(id, d.servicos); })
    .catch(function (e) {
      el('servicosCard').innerHTML = cartaoServicos('', '<div class="card-pe"><p class="erro-txt">' + esc(e.message) + '</p></div>');
    });
}

/* A moldura do cartão dos serviços: o título, a frase que diz o que desligar
   faz, a contagem dos ligados e o corpo.
   Recebe: contagem — o texto da contagem ('' sem ela); corpo — o HTML do corpo.
   Devolve: string HTML com o cartão. */
function cartaoServicos(contagem, corpo) {
  return '<section class="card" aria-labelledby="titServicos"><div class="card-cab"><div class="card-cab-txt">' +
    '<h2 id="titServicos" class="card-tit"><b>Serviços</b></h2>' +
    '<p class="sub">Desligar um serviço tira esse separador da app desta pessoa, e os que dependem dele vão junto. ' +
    'Nada é apagado: ao ligar outra vez fica tudo como estava.</p></div>' +
    (contagem ? '<span class="sub n">' + contagem + '</span>' : '') + '</div>' + corpo + '</section>';
}

/* Os serviços que dependem de um: os que o requerem, e os que requerem
   esses, pela ordem do catálogo — a mesma regra do fecho que o servidor
   aplica ao desligar, calculada aqui só para se mostrar antes de confirmar.
   Recebe: lista — os serviços (array de {id, nome, ligado, requer}); id — o serviço de que se parte.
   Devolve: array com os serviços dependentes (objetos da lista), sem o próprio. */
function dependentesDoServico(lista, id) {
  var fora = {};
  fora[id] = true;
  var mudou = true;
  while (mudou) {
    mudou = false;
    lista.forEach(function (s) {
      if (!fora[s.id] && s.requer.some(function (r) { return fora[r]; })) { fora[s.id] = true; mudou = true; }
    });
  }
  return lista.filter(function (s) { return fora[s.id] && s.id !== id; });
}

/* Pinta o cartão: um interruptor por serviço, com o nome, o que ele requer
   e os que dependem dele. Um serviço desligado cujo requerido também está
   desligado tem o interruptor parado — o servidor recusava, e é mais claro
   dizer logo o que ligar primeiro. A linha inteira é o rótulo do
   interruptor: tocar no nome também liga e desliga.
   Recebe: id — o id da conta (string); lista — os serviços (array de {id, nome, ligado, requer}).
   Devolve: nada — redesenha o cartão servicosCard. */
function pintarServicos(id, lista) {
  servicosVistos = lista;
  var porId = {};
  lista.forEach(function (s) { porId[s.id] = s; });
  var b = function (servico, ligar, idNome, parado) {
    return '<button type="button" class="sw" role="switch" id="sw-' + esc(servico) + '" aria-checked="' + (ligar ? 'false' : 'true') + '"' +
      ' aria-labelledby="' + esc(idNome) + '"' + (parado ? ' disabled' : comAcao('mudarServico', [id, servico, ligar ? 'ligar' : 'desligar'])) + '></button>';
  };
  var ligados = lista.filter(function (s) { return s.ligado; }).length;
  var linhas = lista.map(function (s) {
    var dep = dependentesDoServico(lista, s.id).map(function (x) { return x.nome; });
    var faltam = s.requer.filter(function (r) { return porId[r] && !porId[r].ligado; })
      .map(function (r) { return porId[r].nome; });
    var requer = s.requer.map(function (r) { return porId[r] ? porId[r].nome : r; });
    var idNome = 'svn-' + s.id;
    return '<label class="sv' + (s.ligado ? '' : ' off') + '" for="sw-' + esc(s.id) + '">' + b(s.id, !s.ligado, idNome, !s.ligado && faltam.length > 0) +
      '<span class="sv-txt"><span class="sv-nome" id="' + esc(idNome) + '">' + esc(s.nome) + '</span>' +
      (requer.length ? '<span class="sub">requer ' + esc(requer.join(', ')) + '</span>' : '') +
      (dep.length ? '<span class="sub">Dependem dele: ' + esc(dep.join(', ')) + '</span>' : '') +
      (!s.ligado && faltam.length ? '<span class="sub aviso-txt">liga primeiro ' + esc(faltam.join(', ')) + '</span>' : '') +
      '</span></label>';
  }).join('');
  el('servicosCard').innerHTML = cartaoServicos(ligados + ' de ' + lista.length + ' ligados', '<div class="sv-grelha">' + linhas + '</div>');
}

/* Liga ou desliga um serviço desta conta. Desligar pede confirmação NO
   CARTÃO (a faixa âmbar do canvas, B-Conta) e diz quais caem junto (os
   dependentes que ainda estão ligados); ligar não pede — não tira nada a
   ninguém. O servidor devolve a lista nova e o cartão repinta-se com ela; a
   recusa (ligar sem os requeridos) aparece no aviso tal como o servidor a diz.
   Recebe: id — o id da conta (string); servico — o id do serviço (string);
   ligado — true para ligar, false para desligar; confirmado — true quando
   vem do botão da faixa (já se viu o que cai).
   Devolve: nada — grava no servidor e repinta o cartão (ou mostra a faixa). */
function mudarServico(id, servico, ligado, confirmado) {
  var nome = servico, caem = [];
  servicosVistos.forEach(function (s) { if (s.id === servico) nome = s.nome; });
  if (!ligado) {
    caem = dependentesDoServico(servicosVistos, servico)
      .filter(function (s) { return s.ligado; }).map(function (s) { return s.nome; });
    if (!confirmado) { mostrarAvisoDesligar(id, servico, nome, caem); return; }
  }
  pedir('/api/equipa/pessoas/' + encodeURIComponent(id) + '/servicos/' + encodeURIComponent(servico), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ligado: ligado }),
  }).then(function (d) {
    pintarServicos(id, d.servicos);
    avisar((ligado ? 'Ligado: ' : 'Desligado: ') + nome + (caem.length ? ', e com ele ' + caem.join(', ') : '') + '.');
  }).catch(function (e) { avisar(e.message, 'erro'); });
}

/* A faixa âmbar que pergunta antes de desligar, dentro do cartão dos
   serviços (o canvas, B-Conta): o que se desliga, o que cai junto, que nada
   é apagado, e os dois botões. Uma só de cada vez; repintar o cartão
   tira-a. Substitui o confirm() do browser, que a casa não usa.
   Recebe: id — a conta; servico — o id do serviço; nome — o nome legível;
   caem — os nomes dos dependentes que ainda estão ligados.
   Devolve: nada — escreve a faixa no fim do cartão e põe o foco no Cancelar. */
function mostrarAvisoDesligar(id, servico, nome, caem) {
  var cartao = el('servicosCard') && el('servicosCard').querySelector('section');
  if (!cartao) return;
  var velho = el('svAviso');
  if (velho) velho.remove();
  var txt = caem.length
    ? 'Desligar <b>' + esc(nome) + '</b>? Desligam-se também, porque dependem dele: ' + esc(caem.join(', ')) + ' — e voltam a ligar-se um a um. '
    : 'Desligar <b>' + esc(nome) + '</b> a esta conta. ';
  cartao.insertAdjacentHTML('beforeend', '<div class="sv-aviso" id="svAviso" role="alert">' + ic('erros') +
    '<p>' + txt + 'O separador some da app da pessoa e os dados deste serviço deixam de sair do servidor. ' +
    'Nada é apagado — ao ligar outra vez, volta tudo como estava.</p>' +
    '<span class="sv-aviso-acoes"><button type="button" class="btn sm" id="svAvisoNao"' + comAcao('cancelarServico') + '>Cancelar</button>' +
    '<button type="button" class="btn sm sv-aviso-sim"' + comAcao('confirmarServico', [id, servico]) + '>' +
    (caem.length ? 'Desligar os ' + (caem.length + 1) : 'Desligar') + '</button></span></div>');
  var nao = el('svAvisoNao');
  if (nao) nao.focus();
}

/* ------------------------------- operação ------------------------------- */

// o que se espera de cada operação agendada; passado o dobro, é alarme
var CADENCIA = { copia: 26, vigia: 2, resumo: 26 };   // horas
var OPS = { copia: 'Cópia diária', vigia: 'Vigia dos limites', resumo: 'Resumo diário' };
// os números do consumo que vão em quadrados grandes, com o nome que se lê
var QUADROS = { 'Contas': 'Contas', 'Ativos (24h)': 'Ativos nas últimas 24 h', 'Casas · registos': 'Casas · registos', 'Pedidos abertos': 'Pedidos abertos', 'Erros (24h)': 'Erros nas 24 h' };

/* O painel de operação inteiro: a sessão de teste (fora de produção), as
   tarefas agendadas, o consumo com os tectos do plano gratuito, as cópias
   no R2 com o histórico e os endereços de email. Os endereços chegam à
   parte, por verEnderecos — o resto do painel não fica à espera do Cloudflare.
   Devolve: nada — redesenha a vista com o painel. */
function verOperacao() {
  aCarregar('A ler as tarefas, o consumo e as cópias.');
  pedir('/api/equipa/operacao').then(function (d) {
    var agora = Date.now();
    var cab = cabecalho('Operação', '<span class="n">' + (d.teste ? 'Ambiente ' + esc(d.teste) : 'Produção') + ' · atualizado às ' + hora(agora) + ' de ' + dia(agora) + '</span>',
      '<button type="button" class="btn"' + comAcao('ir', ['operacao']) + '>' + ic('atualizar') + 'Atualizar</button>');

    /* fora de produção: uma sessão de teste a um clique — a mesma ligação
       que o /test do Discord dá, com a mesma lavagem de contas */
    var teste = !d.teste ? '' :
      '<section class="card card-pad" aria-labelledby="titTeste"><div class="card-cab-txt"><h2 id="titTeste" class="card-tit">Sessão de teste</h2>' +
      '<p class="sub">As contas de teste ficam de um dia para o outro. Retomar volta à mais recente, com os dados intactos; Extra cria mais uma; Limpar apaga as tuas e começa do zero.</p></div>' +
      '<div class="chips op-teste-botoes"><button type="button" class="btn sm"' + comAcao('sessaoTeste', ['retomar']) + '>Retomar</button>' +
      '<button type="button" class="btn sm"' + comAcao('sessaoTeste', ['extra-dados']) + '>Extra com dados</button>' +
      '<button type="button" class="btn sm"' + comAcao('sessaoTeste', ['extra']) + '>Extra</button>' +
      '<button type="button" class="btn sm texto-perigo"' + comAcao('sessaoTeste', ['limpar']) + '>Limpar</button></div>' +
      '<div id="ligTeste"></div></section>' +
      /* e as sessões de teste abertas, de quem e onde, para as terminar ou
         apagar as contas (chegam à parte, por verSessoesTeste) */
      '<section class="card" aria-labelledby="titSessoesTeste"><div class="card-cab"><div class="card-cab-txt">' +
      '<h2 id="titSessoesTeste" class="card-tit">Sessões de teste abertas</h2>' +
      '<p class="sub">Cada browser onde uma ligação de teste foi aberta e ainda tem sessão, por quem a pediu no Discord e por conta. Terminar faz sair (a conta e os dados ficam); apagar leva a conta e os dados.</p></div></div>' +
      '<div id="sessoesTeste">' + esperaHtml('A ler as sessões.') + '</div></section>';

    var vistos = {};
    (d.crons || []).forEach(function (c) { vistos[c.op] = c; });
    var tarefas = '<section class="hb-fila" aria-label="Tarefas agendadas">' + Object.keys(OPS).map(function (op) {
      var c = vistos[op];
      var horas = c ? (agora - c.at) / 3600000 : Infinity;
      var tom = !c || !c.ok || horas > 2 * CADENCIA[op] ? 'dg' : horas > CADENCIA[op] ? 'wa' : 'ok';
      var texto = !c ? 'Nunca correu' : !c.ok ? 'Falhou' : horas > 2 * CADENCIA[op] ? 'Parada' : horas > CADENCIA[op] ? 'Atrasada' : 'Correu bem';
      return '<div class="hb ' + tom + '"><div class="hb-topo"><span class="hb-nome">' + OPS[op] + '</span>' + badge(tom, texto) + '</div>' +
        '<p class="sub n">' + (c ? 'Última ' + idade(c.at) : 'Ainda sem rasto') + ' · espera-se a cada ' + CADENCIA[op] + ' h</p></div>';
    }).join('') + '</section>';

    var quadros = [], tectos = [], pesadas = null;
    (d.consumo || []).forEach(function (f) {
      var nome = String(f.name || '');
      if (Object.prototype.hasOwnProperty.call(QUADROS, nome)) quadros.push(f);
      else if (/consultas mais pesadas/i.test(nome)) pesadas = f;
      else if (nome !== 'Cópias de segurança') tectos.push(f);   // essa já vai no cartão das cópias
    });
    var consumo = '<section class="op-consumo" aria-labelledby="titConsumo"><h2 id="titConsumo" class="seccao-tit">Consumo</h2>' +
      (quadros.length ? '<div class="st-fila">' + quadros.map(quadroDeConsumo).join('') + '</div>' : '') +
      (tectos.length || pesadas ? '<div class="op-duas">' +
        (tectos.length ? '<section class="card op-tectos" aria-labelledby="titTectos"><div class="card-cab"><div class="card-cab-txt">' +
          '<h2 id="titTectos" class="card-tit">Tectos do plano gratuito</h2><p class="sub">O resumo diário marca aos 70% e aos 90%; a vigia avisa aos 80%.</p></div></div>' +
          tectos.map(linhaDeTecto).join('') + '</section>' : '') +
        (pesadas ? '<section class="card card-pad op-pesadas" aria-labelledby="titPesadas"><h2 id="titPesadas" class="card-tit">Consultas mais pesadas · 24 h</h2>' +
          '<div>' + String(pesadas.value || '').split('\n').map(linhaDeConsulta).join('') + '</div></section>' : '') +
        '</div>' : '') + '</section>';

    el('conteudo').innerHTML = cab + teste + tarefas + consumo + cartaoCopias(d) + cartaoEnderecos();
    verEnderecos();
    if (d.teste) verSessoesTeste();
  }).catch(falha);
}

/* Um quadrado do consumo: o nome e o número grande. As contas trazem o
   máximo e a percentagem (âmbar a partir dos 70%, vermelho dos 90%); as
   casas trazem os registos por baixo.
   Recebe: f — o campo do consumo ({name, value}, como o resumo do servidor o dá).
   Devolve: string HTML com o quadrado. */
function quadroDeConsumo(f) {
  var v = limpo(f.value), nome = String(f.name || '');
  var grande = esc(numero(v)), baixo = '';
  var contas = /^(\d+)\s*\/\s*(\d+)\s*\((\d+)%\)/.exec(v);
  var casas = /^(\d+)\s*·\s*(\d+)$/.exec(v);
  if (contas) {
    var pct = Number(contas[3]), tom = pct >= 90 ? 'dg' : pct >= 70 ? 'wa' : '';
    grande = esc(numero(contas[1])) + ' <small>/ ' + esc(numero(contas[2])) + '</small>';
    baixo = '<span class="sub n ' + tom + '">' + pct + '%' + (pct >= 90 ? ' · passou dos 90%' : pct >= 70 ? ' · passou dos 70%' : '') + '</span>';
  } else if (casas) {
    grande = esc(numero(casas[1]));
    baixo = '<span class="sub n">' + esc(numero(casas[2])) + ' registos</span>';
  }
  return '<div class="st"><span class="sub">' + esc(QUADROS[nome] || nome) + '</span><b class="st-valor n">' + grande + '</b>' + baixo + '</div>';
}

/* Uma linha dos tectos: o nome, o gasto e o tecto, a percentagem e a barra
   (âmbar a partir dos 70%, vermelha dos 90%). Um tecto sem medida diz porquê.
   Recebe: f — o campo do consumo ({name, value}).
   Devolve: string HTML com a linha. */
function linhaDeTecto(f) {
  var v = limpo(f.value), m = /\((\d+)%\)/.exec(v), pct = m ? Number(m[1]) : null;
  var tom = pct == null ? '' : pct >= 90 ? 'dg' : pct >= 70 ? 'wa' : '';
  var medida = m ? v.slice(0, m.index).trim() : v;
  return '<div class="lm"><div class="lm-topo"><span class="lm-nome">' + esc(f.name) + '</span>' +
    '<span class="n' + (pct == null ? ' sub' : '') + '">' + esc(medida) + '</span>' +
    (pct != null ? '<span class="n lm-pct ' + tom + '">' + pct + '%</span>' : '') + '</div>' +
    (pct != null ? '<progress class="barra ' + tom + '" max="100" value="' + Math.min(pct, 100) + '" aria-label="' + esc(f.name) + '">' + pct + '%</progress>' : '') +
    '</div>';
}

/* Uma consulta pesada, como o resumo a escreve ("linhas · vezes× · SQL"):
   o SQL à esquerda, as linhas e as vezes à direita.
   Recebe: linha — uma linha do texto das consultas.
   Devolve: string HTML com a linha ('' para uma linha vazia). */
function linhaDeConsulta(linha) {
  var partes = limpo(linha).split(' · ');
  if (!partes[0] || partes[0] === '—') return '';
  if (partes.length < 3) return '<div class="ps"><code>' + esc(partes.join(' · ')) + '</code></div>';
  return '<div class="ps"><code>' + esc(partes.slice(2).join(' · ')) + '</code><span class="n">' + esc(partes[0]) + ' linhas · ' + esc(partes[1]) + '</span></div>';
}

/* O cartão das cópias de segurança: o estado do R2, a regra do que se
   guarda, o Fazer cópia agora, a tabela das cópias (Verificar só até 2 MB,
   que é o que cabe no worker; Descarregar só ao master, e o servidor
   recusa-o aos outros), o sítio da verificação e as últimas execuções.
   Recebe: d — a resposta do painel ({copias, estadoCopias, historico, master}).
   Devolve: string HTML com o cartão. */
function cartaoCopias(d) {
  var ec = d.estadoCopias || {};
  var copias = d.copias || [];
  var tabela = copias.length
    ? '<div class="tb-rola"><table class="tb empilha"><thead><tr><th>Dia</th><th>Guardada</th><th class="r">Tamanho</th>' +
      '<th><span class="so-leitor">Ações</span></th></tr></thead><tbody>' +
      copias.map(function (c) {
        var diaC = (String(c.key).match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || c.key;
        var grande = c.size > 2097152;
        return '<tr><td class="n nw" data-rot="Dia">' + esc(diaIso(diaC)) + '</td>' +
          '<td class="n nw sub" data-rot="Guardada">' + (c.uploaded ? data(Date.parse(c.uploaded)) : '—') + '</td>' +
          '<td class="r n nw" data-rot="Tamanho">' + kb(c.size) + '</td>' +
          '<td class="r nw acoes"><div class="acoes-td"><button type="button" class="btn sm"' +
          (grande ? ' disabled title="Só se verificam aqui cópias até 2 MB"' : comAcao('resumoCopia', [diaC])) + '>Verificar</button>' +
          // descarregar é sair com a base inteira: só o master (o servidor recusa-o aos outros)
          (d.master ? '<a class="btn sm" href="/api/equipa/operacao/copias/' + esc(encodeURIComponent(diaC)) + '/descarregar">Descarregar</a>' : '') +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>'
    : '<div class="card-pe">' + vazioHtml('Nenhuma cópia no R2.', 'A cópia diária aparece aqui depois de correr; podes fazer uma agora.') + '</div>';

  var historico = (d.historico || []).length
    ? '<h3 class="card-sub-tit">Últimas execuções</h3><div class="tb-rola"><table class="tb empilha"><thead><tr><th>Data</th><th>Tipo</th>' +
      '<th class="r">Linhas</th><th class="r">Tamanho</th><th class="r">Duração</th><th>Estado</th></tr></thead><tbody>' +
      d.historico.slice(0, 10).map(function (h) {
        var det = {}, cru = '';
        try { det = JSON.parse(h.detalhe || '{}') || {}; } catch (e) { cru = String(h.detalhe || ''); }
        var erro = det.erro || cru;
        return '<tr><td class="n nw" data-rot="Data">' + data(h.at) + '</td>' +
          '<td data-rot="Tipo">' + (det.manual ? 'Manual' : 'Automática') + (det.modo === 'memoria' ? ' ' + badge('wa', 'em memória') : '') + '</td>' +
          '<td class="r n" data-rot="Linhas">' + (h.ok && det.linhas != null ? esc(numero(det.linhas)) : '—') + '</td>' +
          '<td class="r n" data-rot="Tamanho">' + (h.ok && det.bytes ? kb(det.bytes) : '—') + '</td>' +
          '<td class="r n" data-rot="Duração">' + (det.ms != null ? duracao(det.ms) : '—') + '</td>' +
          '<td data-rot="Estado">' + (h.ok ? badge('ok', 'Feita') : badge('dg', 'Falhou')) + '</td></tr>' +
          (!h.ok && erro ? '<tr class="tb-erro"><td colspan="6" class="det">' + esc(erro) + '</td></tr>' : '');
      }).join('') + '</tbody></table></div>'
    : '';

  return '<section class="card" aria-labelledby="titCopias"><div class="card-cab"><div class="card-cab-txt">' +
    '<h2 id="titCopias" class="card-tit">Cópias de segurança</h2>' +
    (ec.texto ? '<p class="sub n' + (ec.erro || ec.vazio ? ' erro-txt' : '') + '">' + esc(limpo(ec.texto)) + '</p>' : '') +
    '<p class="sub">Ficam 14 diárias e a do dia 1 de cada mês durante 12 meses. Só se verificam aqui cópias até 2 MB; as maiores, em casa, com o <code>scripts/restaurar.js --resumo</code>.</p></div>' +
    '<button type="button" class="btn primary"' + comAcao('copiarAgora') + '>Fazer cópia agora</button></div>' +
    tabela + '<div id="resumoCopia"></div>' + historico +
    (d.master && copias.length ? '<p class="sub card-nota">Descarregar fica no rasto, com o tamanho.</p>' : '') + '</section>';
}

/* O cartão dos endereços @rendorium.com: a lista e o formulário chegam por
   verEnderecos, que fala com o Cloudflare.
   Devolve: string HTML com o cartão, à espera. */
function cartaoEnderecos() {
  return '<section class="card" aria-labelledby="titEnderecos"><div class="card-cab"><div class="card-cab-txt">' +
    '<h2 id="titEnderecos" class="card-tit">Endereços @rendorium.com</h2>' +
    '<p class="sub">São reencaminhamentos, não caixas: não têm palavra-passe. Enviar a partir de qualquer @rendorium.com já funciona pelo Resend.</p></div></div>' +
    '<div id="emailCard">' + esperaHtml('A pedir os endereços ao Cloudflare.') + '</div><div id="endForm"></div></section>';
}

/* Preenche o cartão dos endereços de email: cada um com o destino para onde
   reencaminha, mais os destinos ainda por verificar, e o formulário de
   criar (só o master). Sem CF_EMAIL_TOKEN no servidor, escreve a receita
   para o criar em vez de fingir que funciona.
   Recebe: soLista (opcional) — true para repintar só a lista, deixando o
   formulário com o que lá estiver escrito.
   Devolve: nada — preenche o cartão emailCard. */
function verEnderecos(soLista) {
  pedir('/api/equipa/email').then(function (d) {
    if (d.semChave) {
      el('emailCard').innerHTML = '<div class="card-pe"><p class="sub">Falta o token: cria no Cloudflare um API token com ' +
        '<b>Zone → Email Routing Rules → Edit</b>, <b>Zone → Zone → Read</b> (zona rendorium.com) e ' +
        '<b>Account → Email Routing Addresses → Edit</b>, guarda-o como segredo <code>CF_EMAIL_TOKEN</code> ' +
        'no GitHub e faz um deploy.</p></div>';
      el('endForm').innerHTML = '';
      return;
    }
    var linhas = (d.enderecos || []).map(function (e) {
      return '<tr><td class="forte quebra" data-rot="Endereço">' + esc(e.email) + '</td><td class="quebra" data-rot="Vai para">' + esc(e.destino || '—') + '</td>' +
        '<td data-rot="Estado">' + (e.ativo ? badge('ok', 'Ligado') : badge('dg', 'Desligado')) + '</td></tr>';
    }).join('');
    var pendentes = (d.destinos || []).filter(function (x) { return !x.verificado; });
    el('emailCard').innerHTML = (linhas
      ? '<div class="tb-rola"><table class="tb empilha"><thead><tr><th>Endereço</th><th>Vai para</th><th>Estado</th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      : '<div class="card-pe">' + vazioHtml('Nenhum endereço.', d.master ? 'Cria o primeiro aqui em baixo.' : '') + '</div>') +
      (pendentes.length ? '<p class="sub card-nota">Destinos à espera de verificação: ' +
        pendentes.map(function (x) { return esc(x.email); }).join(', ') + '</p>' : '');
    if (!soLista) el('endForm').innerHTML = d.master ? formEndereco() : '';
  }).catch(function (e) { el('emailCard').innerHTML = '<div class="card-pe"><p class="erro-txt">' + esc(e.message) + '</p></div>'; });
}

// o formulário de um endereço novo: o nome antes do @, o destino (vazio usa o verificado) e o motivo
// Devolve: string HTML com o formulário.
function formEndereco() {
  return '<div class="end-form"><p class="lbl">Endereço novo</p><div class="end-campos">' +
    '<div class="campo-bloco"><label class="rot" for="endNome">Nome <span class="req">*</span></label>' +
    '<span class="campo campo-sufixo"><input id="endNome" placeholder="Ex: faturas" autocomplete="off" maxlength="64" aria-describedby="endNomeErro"' +
    ligarA('enter', 'criarEndereco') + '><span class="sub">@rendorium.com</span></span><p class="erro-txt" id="endNomeErro"></p></div>' +
    '<div class="campo-bloco"><label class="rot" for="endDestino">Vai para</label>' +
    '<input id="endDestino" class="campo" type="email" placeholder="Opcional" autocomplete="off"' + ligarA('enter', 'criarEndereco') + '>' +
    '<p class="sub">Vazio, usa o destino já verificado.</p></div>' +
    '<div class="campo-bloco end-motivo"><label class="rot" for="endMotivo">Motivo <span class="req">*</span></label>' +
    '<input id="endMotivo" class="campo" placeholder="Ex: faturas dos fornecedores" maxlength="300" autocomplete="off" aria-describedby="endMotivoErro"' +
    ligarA('enter', 'criarEndereco') + '><p class="erro-txt" id="endMotivoErro"></p></div>' +
    '<button type="button" class="btn"' + comAcao('criarEndereco') + '>Criar endereço</button></div></div>';
}

// cria o endereço com o que está no formulário (o nome e o motivo, com 5+
// caracteres, são obrigatórios); mesmo em erro recarrega a lista — o servidor
// pode ter posto um destino novo à espera de verificação
// Devolve: nada — cria no servidor e recarrega a lista dos endereços.
function criarEndereco() {
  var nome = valorDe('endNome'), destino = valorDe('endDestino'), motivo = valorDe('endMotivo');
  marcarErro('endNome', nome ? '' : 'Escreve o nome do endereço, a parte antes do @.');
  marcarErro('endMotivo', motivo.length >= 5 ? '' : 'Escreve o motivo, com 5 caracteres ou mais: fica no rasto.');
  if (!nome || motivo.length < 5) return;
  enviar('/api/equipa/email', { endereco: nome, destino: destino, motivo: motivo })
    .then(function (d) { avisar('Criado: ' + d.email + ' → ' + d.destino + '.'); verEnderecos(); })
    .catch(function (e) { avisar(e.message, 'erro'); verEnderecos(true); });
}

/* Pede uma ligação de sessão de teste — a mesma que o /test do Discord dá.
   comDados semeia dados de exemplo, manter cria uma conta extra em vez de
   retomar a mais recente, limpar apaga as contas de teste de quem pede
   (depois de o confirmar na janela). A ligação vale 10 minutos e aparece no cartão.
   Recebe: comDados — booleano, semeia dados de exemplo; manter — booleano,
   cria uma conta extra; limpar — booleano, apaga as contas de teste.
   Devolve: nada — escreve a ligação no cartão ligTeste. */
function sessaoTeste(comDados, manter, limpar) {
  if (!limpar) { pedirSessaoTeste(comDados, manter, false); return; }
  formulario('Limpar as tuas contas de teste?', [], function () { return pedirSessaoTeste(false, false, true); },
    { texto: 'Apaga as <b>tuas</b> contas de teste e o que têm dentro. As dos outros ficam.', botao: 'Limpar', perigo: true });
}
// emite a ligação de teste no servidor e escreve-a no cartão; um erro vai para o aviso
// Recebe: comDados, manter, limpar — os três booleanos do sessaoTeste.
// Devolve: a promessa do pedido (resolve sempre: o erro já foi dito).
function pedirSessaoTeste(comDados, manter, limpar) {
  el('ligTeste').innerHTML = esperaHtml('A emitir a ligação.');
  return enviar('/api/equipa/operacao/teste', { dados: comDados, manter: manter, limpar: limpar }).then(function (d) {
    el('ligTeste').innerHTML = '<p class="sub">Vale 10 minutos: <a href="' + esc(d.ligacao) + '" target="_blank" rel="noopener">abrir a sessão de teste</a></p>';
  }).catch(function (e) { el('ligTeste').innerHTML = ''; avisar(e.message, 'erro'); });
}

// a última lista das sessões de teste (para as perguntas dizerem de quem)
var sessoesTesteUltimas = null;

/* Quem pediu as contas de teste, como se diz: o nome no Discord, o id quando
   a ligação não trouxe o nome, ou «Sem dono» nas contas de ligações antigas.
   Recebe: dono — {id, nome} da lista das sessões.
   Devolve: o texto (simples, por escapar). */
function nomeDoDono(dono) {
  if (!dono || !dono.id) return 'Sem dono';
  return dono.nome ? dono.nome + ' (Discord)' : 'Discord ' + dono.id;
}

/* Uma conta de teste na lista das sessões: uma secção que abre e fecha
   (fechada à partida), com a conta, quantas sessões tem e quando abriu a
   mais recente; aberta, «Terminar as sessões» e «Apagar a conta», e uma
   linha por sessão (quando abriu, quando expira, o browser, Terminar). Os
   botões vivem dentro, e não no summary: um botão dentro dele também abria
   e fechava a secção.
   Recebe: c — a conta ({id, email, sessoes}); aberta — se estava aberta
   antes de a lista se voltar a pintar.
   Devolve: o HTML (texto). */
function contaDeTesteHtml(c, aberta) {
  var n = c.sessoes.length;
  var conta = esc(String(c.email || '').replace('@teste.rendorium.com', ''));
  var resumo = n ? (n === 1 ? '1 sessão' : n + ' sessões') + (c.sessoes[0].criada ? ' · a mais recente ' + idade(c.sessoes[0].criada) : '') : 'Sem sessão aberta';
  var botoes = '<div class="chips st-acoes">' +
    (n ? '<button type="button" class="btn sm"' + comAcao('sessoesTeste', ['terminar', 'conta', c.id]) + '>' + (n === 1 ? 'Terminar a sessão' : 'Terminar as sessões') + '</button>' : '') +
    '<button type="button" class="btn sm texto-perigo"' + comAcao('sessoesTeste', ['apagar', 'conta', c.id]) + '>Apagar a conta</button></div>';
  var linhas = c.sessoes.map(function (s) {
    return '<tr><td class="n" data-rot="Abriu">' + (s.criada ? idade(s.criada) : '—') + '</td>' +
      '<td class="n" data-rot="Expira">' + (s.expira ? dia(s.expira) : '—') + '</td>' +
      '<td class="quebra" data-rot="Browser">' + esc(s.agente || '—') + '</td>' +
      '<td class="acoes" data-rot="Ações"><button type="button" class="btn sm"' + comAcao('sessoesTeste', ['terminar', 'sessao', s.id]) + '>Terminar</button></td></tr>';
  }).join('');
  return '<details class="st-conta" data-conta="' + esc(c.id) + '"' + (aberta ? ' open' : '') + '>' +
    '<summary><span class="st-seta" aria-hidden="true">' + ic('baixo', 'i-sm') + '</span>' +
      '<span class="forte quebra">' + conta + '</span><span class="sub n">' + resumo + '</span></summary>' +
    '<div class="st-corpo">' + botoes +
      (n ? '<div class="tb-rola"><table class="tb empilha"><thead><tr><th>Abriu</th><th>Expira</th><th>Browser</th><th><span class="so-leitor">Ações</span></th></tr></thead><tbody>' +
        linhas + '</tbody></table></div>' : '') +
    '</div></details>';
}

/* Lê as sessões de teste abertas e pinta-as no cartão da Operação: o total,
   os botões para todas, e um bloco por quem as pediu no Discord, com uma
   secção por conta (contaDeTesteHtml) — as que estavam abertas continuam
   abertas quando a lista se volta a pintar (depois de terminar ou apagar).
   Devolve: nada — escreve o cartão sessoesTeste (ou o erro nele). */
function verSessoesTeste() {
  pedir('/api/equipa/operacao/sessoes-teste').then(function (d) {
    sessoesTesteUltimas = d;
    var caixa = el('sessoesTeste');
    if (!caixa) return;
    var abertas = {};
    [].slice.call(caixa.querySelectorAll('details.st-conta[open]')).forEach(function (x) { abertas[x.getAttribute('data-conta')] = 1; });
    if (!d.contas) { caixa.innerHTML = '<div class="card-pe">' + vazioHtml('Não há contas de teste.', 'Uma ligação do /test cria a primeira.') + '</div>'; return; }
    var resumo = (d.sessoes === 1 ? '1 sessão aberta' : d.sessoes + ' sessões abertas') + ' em ' +
      (d.contas === 1 ? '1 conta de teste' : d.contas + ' contas de teste');
    var topo = '<div class="card-pe"><p class="sub n">' + resumo + '</p><div class="chips op-teste-botoes">' +
      '<button type="button" class="btn sm"' + comAcao('sessoesTeste', ['terminar', 'todas', '']) + '>Terminar todas</button>' +
      '<button type="button" class="btn sm texto-perigo"' + comAcao('sessoesTeste', ['apagar', 'todas', '']) + '>Apagar todas as contas</button></div></div>';
    var blocos = (d.donos || []).map(function (dono) {
      var n = dono.contas.reduce(function (s, c) { return s + c.sessoes.length; }, 0);
      var cabeca = '<div class="card-pe"><p class="forte">' + esc(nomeDoDono(dono)) + ' <span class="sub n">· ' +
        (n === 1 ? '1 sessão' : n + ' sessões') + ' em ' + (dono.contas.length === 1 ? '1 conta' : dono.contas.length + ' contas') + '</span></p>' +
        (dono.id ? '<div class="chips op-teste-botoes"><button type="button" class="btn sm"' + comAcao('sessoesTeste', ['terminar', 'dono', dono.id]) + '>Terminar as sessões</button>' +
          '<button type="button" class="btn sm texto-perigo"' + comAcao('sessoesTeste', ['apagar', 'dono', dono.id]) + '>Apagar as contas</button></div>' : '') + '</div>';
      return cabeca + '<div class="st-contas">' + dono.contas.map(function (c) { return contaDeTesteHtml(c, abertas[c.id]); }).join('') + '</div>';
    }).join('');
    caixa.innerHTML = topo + blocos;
  }).catch(function (e) {
    var caixa = el('sessoesTeste');
    if (caixa) caixa.innerHTML = '<div class="card-pe"><p class="sub">Não deu para ler as sessões: ' + esc(e.message) + '</p></div>';
  });
}

/* Termina sessões de teste ou apaga contas de teste. Terminar uma sessão faz
   logo; o resto (as de uma pessoa, todas, e qualquer apagar) pergunta antes,
   na janela, a dizer o que fica e o que se perde.
   Recebe: acao — 'terminar' ou 'apagar'; alvo — 'sessao', 'conta', 'dono'
   ou 'todas'; id — o da sessão, da conta ou do dono (vazio em 'todas').
   Devolve: nada — faz o pedido, avisa e volta a ler a lista. */
function sessoesTeste(acao, alvo, id) {
  var fazer = function () {
    return enviar('/api/equipa/operacao/sessoes-teste', { acao: acao, alvo: alvo, id: id }).then(function (r) {
      var n = r.n || 0;
      avisar(acao === 'apagar' ? (n === 1 ? 'Conta de teste apagada.' : n + ' contas de teste apagadas.')
        : alvo === 'sessao' ? 'Sessão terminada.' : 'Sessões terminadas em ' + (n === 1 ? '1 conta.' : n + ' contas.'), 'feito');
      verSessoesTeste();
    }).catch(function (e) { avisar(e.message, 'erro'); verSessoesTeste(); });
  };
  if (acao === 'terminar' && alvo === 'sessao') { fazer(); return; }
  var dono = null;
  ((sessoesTesteUltimas && sessoesTesteUltimas.donos) || []).forEach(function (x) { if (alvo === 'dono' && x.id === id) dono = x; });
  var quem = alvo === 'dono' ? '<b>' + esc(nomeDoDono(dono || { id: id })) + '</b>' : '';
  var titulo, texto, botao;
  if (acao === 'terminar') {
    titulo = alvo === 'todas' ? 'Terminar todas as sessões de teste?' : alvo === 'conta' ? 'Terminar as sessões desta conta?' : 'Terminar as sessões desta pessoa?';
    texto = (alvo === 'todas' ? 'Toda a gente sai das contas de teste.' : alvo === 'conta' ? 'Todos os browsers com esta conta de teste saem dela.'
      : 'Todas as sessões das contas de teste de ' + quem + ' terminam.') +
      ' As contas e os dados ficam, e o próximo /test retoma-as.';
    botao = 'Terminar';
  } else {
    titulo = alvo === 'todas' ? 'Apagar todas as contas de teste?' : alvo === 'dono' ? 'Apagar as contas de teste desta pessoa?' : 'Apagar esta conta de teste?';
    texto = (alvo === 'todas' ? 'Apaga <b>todas</b> as contas de teste do dev' : alvo === 'dono' ? 'Apaga as contas de teste de ' + quem : 'Apaga a conta de teste') +
      ' e o que têm dentro, e as sessões delas terminam. Não se desfaz.';
    botao = 'Apagar';
  }
  formulario(titulo, [], fazer, { texto: texto, botao: botao, perigo: acao === 'apagar' });
}

// abre a janela de fazer uma cópia manual da base para o R2; feita, diz as
// linhas e o tamanho no aviso e recarrega o painel
// Devolve: nada — abre a janela; ao confirmar, faz a cópia no servidor.
function copiarAgora() {
  formulario('Fazer uma cópia agora?', [], function () {
    return enviar('/api/equipa/operacao/copiar').then(function (d) {
      avisar('Cópia feita: ' + numero(d.copia.linhas) + ' linhas, ' + kb(d.copia.bytes) + '.');
      verOperacao();
    });
  }, { texto: 'Copia a base inteira para o R2 e fica no rasto. Uma cópia do mesmo dia substitui a anterior.', botao: 'Fazer cópia' });
}

/* A verificação de uma cópia: descomprime no servidor, conta por tabela, e
   compara com a base viva. Uma cópia truncada rebenta na descompressão; uma
   coxa aparece aqui com as contagens a divergir.
   Recebe: dia — o dia da cópia (string no formato AAAA-MM-DD).
   Devolve: nada — redesenha o cartão resumoCopia com as contagens. */
function resumoCopia(dia) {
  el('resumoCopia').innerHTML = '<div class="op-resumo">' + esperaHtml('A verificar a cópia de ' + esc(diaIso(dia)) + '.') + '</div>';
  pedir('/api/equipa/operacao/copias/' + encodeURIComponent(dia) + '/resumo').then(function (d) {
    var linhas = Object.keys(d.tabelas).sort().map(function (t) {
      var copia = d.tabelas[t], viva = d.vivas[t];
      var nota = viva == null ? badge('wa', 'já não existe')
        : viva === copia ? '' : (viva > copia ? '+' : '') + (viva - copia) + ' desde então';
      return '<tr><td data-rot="Tabela"><code>' + esc(t) + '</code></td><td class="r n" data-rot="Na cópia">' + esc(numero(copia)) + '</td>' +
        '<td class="r n" data-rot="Na base">' + (viva == null ? '—' : esc(numero(viva))) + '</td><td class="sub" data-rot="Diferença">' + nota + '</td></tr>';
    }).join('');
    el('resumoCopia').innerHTML = '<div class="op-resumo"><div class="op-resumo-cab"><h3 class="card-tit">Cópia de ' + esc(diaIso(dia)) + '</h3>' +
      '<p class="sub n">' + esc(numero(d.linhas)) + ' linhas · ' + kb(d.bytes) + ' comprimida · ' +
      (d.irreconheciveis ? badge('dg', esc(d.irreconheciveis) + ' linhas ilegíveis') : 'íntegra') + '</p></div>' +
      '<div class="tb-rola"><table class="tb empilha"><thead><tr><th>Tabela</th><th class="r">Na cópia</th><th class="r">Na base</th><th>Diferença</th></tr></thead><tbody>' +
      linhas + '</tbody></table></div></div>';
  }).catch(function (e) {
    el('resumoCopia').innerHTML = '<div class="op-resumo"><p class="espera erro-txt">' + esc(e.message) + '</p></div>';
  });
}

/* -------------------------------- rasto --------------------------------- */

/* A vista Equipa do Rasto, a auditoria (só o master): as últimas 200 ações
   da equipa, opcionalmente filtradas por alvo (o id exato: escreve-se no
   filtro, ou toca-se num alvo da tabela). Só leitura — o rasto escreve-se
   sempre e não se apaga nunca.
   Recebe: alvo (opcional) — o alvo por que filtrar (string, como aparece na coluna Sobre).
   Devolve: nada — redesenha a vista com a tabela. */
function verRasto(alvo) {
  alvo = String(alvo || '').trim();
  rastoVista = 'equipa';
  var vez = ++rastoVez;
  aCarregar('A ler o rasto.');
  pedir('/api/equipa/auditoria' + (alvo ? '?alvo=' + encodeURIComponent(alvo) : '')).then(function (d) {
    if (vez !== rastoVez || seccao !== 'rasto') return;
    var regs = d.registos || [];
    var filtro = '<div class="card rs-filtro"><label class="procura">' + ic('procurar') +
      '<input id="qRasto" type="search" placeholder="Ex: K4P9ZT2M" aria-label="Filtrar pelo alvo: o id exato de uma conta, de um pedido ou um endereço" value="' +
      esc(alvo) + '"' + ligarA('enter', 'procurarRasto') + '></label>' +
      (alvo ? chip('Sobre ' + esc(alvo) + ' ' + ic('fechar', 'i-sm'), true, comAcao('ir', ['rasto']))
        : '<span class="sub">Escreve o id exato e carrega em Enter.</span>') + '</div>';
    var tabela = regs.length
      ? '<section class="card" aria-label="Ações da equipa"><div class="tb-rola"><table class="tb empilha"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Sobre</th><th>Detalhe</th></tr></thead><tbody>' +
        regs.map(function (r) {
          return '<tr><td class="n nw" data-rot="Quando">' + data(r.at) + '</td>' +
            '<td data-rot="Quem"><span class="forte">' + esc(r.nome || r.quem) + '</span> <span class="sub">' + esc(r.papel) + '</span></td>' +
            '<td data-rot="Ação"><code class="acao">' + esc(r.acao) + '</code></td>' +
            '<td data-rot="Sobre">' + (r.alvo ? '<button type="button" class="ligacao"' + comAcao('ir', ['rasto', r.alvo]) + '>' + esc(r.alvo) + '</button>' : '—') + '</td>' +
            '<td class="det" data-rot="Detalhe">' + esc(r.detalhe || '') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>'
      : vazioHtml(alvo ? 'Nada no rasto sobre “' + esc(alvo) + '”.' : 'Ainda não há rasto nenhum.',
          alvo ? 'O alvo tem de ser o id exato.' : 'Cada ação da equipa escreve aqui uma linha.');
    el('conteudo').innerHTML = cabecalho('Rasto', 'Quem da equipa fez o quê: as últimas 200 ações. Escreve-se sempre e não se apaga nunca.') +
      rastoAbasHtml('equipa') + filtro + tabela;
  }).catch(function (e) { if (vez === rastoVez) falhaRasto(e, 'ir', ['rasto', alvo]); });
}

/* --------------------------- o rasto das pessoas -------------------------- */

// a vista do Rasto que está aberta ('pessoas' ou 'equipa'), o período em dias,
// a forma das Pessoas ('lista' ou 'ecras') e a ordem da lista ('recentes' ou 'sinais')
var rastoVista = 'pessoas', rastoDias = 30, rastoModo = 'lista', rastoOrdem = 'recentes';
// a última lista de pessoas que chegou, para mudar a ordem sem voltar à rede
var rastoPessoasVistas = null;
// a vez do último pedido do rasto: a resposta de um pedido velho não pinta por cima de um novo
var rastoVez = 0;

/* Os cinco sinais do contrato, pela ordem em que se mostram: o id que vem do
   servidor, o nome no plural (as contagens), no singular (um evento) e o tom
   do selo (âmbar quando a pessoa se perde; vermelho quando o guardar deu erro). */
var SINAIS_RASTO = [
  { id: 'em-vao', nomes: 'Toques em vão', nome: 'Toque em vão', tom: 'wa', curto: 'Em vão',
    diz: 'o toque caiu num sítio onde não há nada para carregar.' },
  { id: 'repetido', nomes: 'Toques repetidos', nome: 'Toque repetido', tom: 'wa', curto: 'Repetidos',
    diz: 'três ou mais toques seguidos no mesmo sítio, em menos de um segundo cada.' },
  { id: 'vai-e-volta', nomes: 'Vai-e-volta', nome: 'Vai-e-volta', tom: 'wa', curto: 'Vai-e-volta',
    diz: 'abriu uma janela ou um ecrã e saiu em menos de 4 s, sem tocar em nada útil lá dentro.' },
  { id: 'desistencia', nomes: 'Desistências', nome: 'Desistência', tom: 'wa', curto: 'Desistências',
    diz: 'escreveu num formulário e fechou-o sem guardar.' },
  { id: 'erro-campo', nomes: 'Erros ao guardar', nome: 'Erro ao guardar', tom: 'dg', curto: 'Erros',
    diz: 'carregou em guardar e um campo deu erro.' },
];
// os tipos de evento por extenso
var TIPOS_RASTO = {
  toque: 'Toque', ecra: 'Ecrã', 'janela-abre': 'Abriu a janela', 'janela-fecha': 'Fechou a janela', guardar: 'Guardou',
  'erro-campo': 'Erro num campo', erro: 'Erro', pagina: 'Página', secao: 'Secção',
};
// as origens por extenso
var ORIGENS_RASTO = { app: 'App', montra: 'Montra' };

/* O sinal de um id, ou null quando o id não é um dos cinco.
   Recebe: id — o id do sinal (string, como vem do servidor).
   Devolve: a entrada de SINAIS_RASTO, ou null. */
function sinalRasto(id) {
  for (var i = 0; i < SINAIS_RASTO.length; i++) if (SINAIS_RASTO[i].id === id) return SINAIS_RASTO[i];
  return null;
}
/* Quantos sinais há numa contagem por sinal.
   Recebe: sinais — {id: n} (pode faltar).
   Devolve: o total (número). */
function somaSinaisRasto(sinais) {
  return SINAIS_RASTO.reduce(function (s, x) { return s + (Number((sinais || {})[x.id]) || 0); }, 0);
}
/* Os selos dos sinais com a contagem, só os que aconteceram; o contorno e a
   letra levam a cor, para se lerem também quando o browser escurece o fundo.
   Recebe: sinais — {id: n}; vazio (opcional) — o HTML quando não há nenhum.
   Devolve: string HTML com os selos. */
function rastoSinaisHtml(sinais, vazio) {
  var selos = SINAIS_RASTO.filter(function (x) { return Number((sinais || {})[x.id]) > 0; }).map(function (x) {
    return '<span class="badge rs-s ' + x.tom + '">' + x.nomes + ' <b class="n">' + esc(numero(sinais[x.id])) + '</b></span>';
  });
  return selos.length ? '<span class="rs-sinais">' + selos.join('') + '</span>' : (vazio == null ? '<span class="sub">Nenhum</span>' : vazio);
}
/* As origens como selos: a app em cobalto, a montra em cinzento.
   Recebe: origens — lista de 'app' e 'montra'.
   Devolve: string HTML com os selos. */
function rastoOrigensHtml(origens) {
  return (origens || []).filter(Boolean).map(function (o) { return badge(o === 'app' ? 'ac' : '', esc(ORIGENS_RASTO[o] || o)); }).join(' ');
}
// um número com a palavra no singular ou no plural: 1 sessão, 3 sessões
// Recebe: n — o número; um — a palavra para 1; varios — a palavra para os outros.
// Devolve: o texto («1 sessão», «3 sessões»).
function contadoRasto(n, um, varios) { n = Number(n) || 0; return (n === 1 ? '1 ' + um : numero(n) + ' ' + varios); }
// a hora de um instante com os segundos: 16:58:07
// Recebe: t — o instante (ms).
// Devolve: o texto da hora.
function horaRasto(t) { var d = new Date(t); return hora(t) + ':' + dois(d.getSeconds()); }
// quanto durou uma sessão, como se diz: «menos de 1 s», «41 s», «12 min», «1 h 05 min»
// Recebe: ms — a duração em milissegundos.
// Devolve: o texto.
function duracaoRasto(ms) {
  ms = Math.max(0, Number(ms) || 0);
  if (ms < 1000) return 'menos de 1 s';
  if (ms < 3600000) return duracao(ms);
  var m = Math.round(ms / 60000);
  return Math.floor(m / 60) + ' h ' + dois(m % 60) + ' min';
}
// o período em dias, só os três que o servidor aceita (30 à falta de outro)
// Recebe: dias — o que veio (número ou texto).
// Devolve: 7, 30 ou 90.
function diasRasto(dias) { var n = Number(dias); return n === 7 || n === 90 ? n : 30; }

/* A porta do separador Rasto: com um alvo (o «Ver no rasto» da ficha, um
   alvo da tabela da auditoria) vai à vista Equipa filtrada, que é só do
   master; sem alvo, volta à vista que estava aberta — as Pessoas, à primeira.
   Recebe: alvo (opcional) — o alvo da auditoria.
   Devolve: nada — abre a vista. */
function verRastoEntrada(alvo) {
  if (eu.master && (alvo || rastoVista === 'equipa')) { verRasto(alvo); return; }
  if (rastoModo === 'ecras') verRastoResumo(rastoDias);
  else verRastoPessoas(rastoDias);
}
/* Troca de vista no Rasto (as abas do master).
   Recebe: v — 'pessoas' ou 'equipa'.
   Devolve: nada — abre a vista. */
function mudarVistaRasto(v) {
  rastoVista = v === 'equipa' && eu.master ? 'equipa' : 'pessoas';
  if (typeof scrollTo === 'function') scrollTo(0, 0);
  verRastoEntrada();
}
/* As abas do Rasto: Pessoas e Equipa. Só o master tem as duas; ao admin a
   vista Equipa não abre, e com uma só não há abas.
   Recebe: ativa — 'pessoas' ou 'equipa'.
   Devolve: string HTML com as abas ('' a quem só tem uma vista). */
function rastoAbasHtml(ativa) {
  if (!eu.master) return '';
  return '<div class="chips rs-abas" role="group" aria-label="Que rasto ver">' +
    chip('Pessoas', ativa === 'pessoas', comAcao('mudarVistaRasto', ['pessoas'])) +
    chip('Equipa', ativa === 'equipa', comAcao('mudarVistaRasto', ['equipa'])) + '</div>';
}
/* O cabeçalho da vista Pessoas, as abas e a barra dos filtros: por pessoa ou
   por ecrã, e o período (7, 30 ou 90 dias).
   Recebe: modo — 'lista' ou 'ecras'; dias — 7, 30 ou 90.
   Devolve: string HTML do topo. */
function rastoTopoHtml(modo, dias) {
  var periodo = [7, 30, 90].map(function (n) {
    return chip(n + ' dias', dias === n, comAcao(modo === 'ecras' ? 'verRastoResumo' : 'verRastoPessoas', [n]));
  }).join('');
  return cabecalho('Rasto', 'Cada toque na app e na montra, debaixo de um pseudónimo, para ver onde as pessoas se perdem. ' +
      'Só de quem aceitou; fica 90 dias.') + rastoAbasHtml('pessoas') +
    '<div class="card rs-barra">' +
    '<div class="chips" role="group" aria-label="Como ver">' +
    chip('Por pessoa', modo === 'lista', comAcao('verRastoPessoas', [dias])) +
    chip('Por ecrã', modo === 'ecras', comAcao('verRastoResumo', [dias])) + '</div>' +
    '<div class="chips" role="group" aria-label="Período">' + periodo + '</div></div>';
}
/* O que quer dizer cada sinal, numa secção que abre e fecha, por baixo das tabelas.
   Devolve: string HTML da legenda. */
function rastoLegendaHtml() {
  return '<details class="card rs-legenda"><summary><span class="st-seta" aria-hidden="true">' + ic('baixo', 'i-sm') + '</span>' +
    '<span class="forte">O que quer dizer cada sinal</span></summary><dl>' +
    SINAIS_RASTO.map(function (x) { return '<dt>' + badge('rs-s ' + x.tom, x.nomes) + '</dt><dd class="sub">' + maiuscula(x.diz) + '</dd>'; }).join('') +
    '</dl></details>';
}
/* O que mostrar quando o rasto falha: um 403 diz-se em palavras (o papel não
   abre este rasto), um 404 diz que a pessoa já não tem rasto, e o resto vai ao
   falha da casa com o Tentar outra vez certo.
   Recebe: e — o Error (com e.status); acao, args — o que o Tentar outra vez corre;
   volta (opcional) — o HTML do botão de voltar, para o 404.
   Devolve: nada — escreve no conteúdo. */
function falhaRasto(e, acao, args, volta) {
  if (e && e.status === 403) {
    el('conteudo').innerHTML = cabecalho('Rasto') + vazioHtml('Este rasto não abre ao teu papel.',
      'O rasto das pessoas é do master e do admin; o suporte vê o de quem escreveu um pedido, a partir desse pedido. ' +
      'A auditoria da equipa é só do master.', volta || '');
    return;
  }
  if (e && e.status === 404) {
    el('conteudo').innerHTML = cabecalho('Rasto') + vazioHtml('Esta pessoa já não tem rasto.',
      'O pseudónimo não existe: a conta foi apagada, ou os eventos passaram dos 90 dias.', volta || '');
    return;
  }
  falha(e, acao, args);
}

/* A vista Pessoas do Rasto, por pessoa: a lista dos pseudónimos do período,
   cada um com a última atividade, as sessões, os eventos, as origens e os
   sinais. Vazia, diz porquê — ninguém aceitou ainda, ou nada neste período —,
   e para o saber pergunta pelos 90 dias.
   Recebe: dias (opcional) — 7, 30 ou 90 (30 à falta de outro).
   Devolve: nada — redesenha o conteúdo. */
function verRastoPessoas(dias) {
  dias = diasRasto(dias);
  rastoDias = dias; rastoModo = 'lista'; rastoVista = 'pessoas';
  nav('rasto');
  var vez = ++rastoVez;
  var topo = rastoTopoHtml('lista', dias);
  el('conteudo').innerHTML = topo + esperaHtml('A ler o rasto das pessoas.');
  pedir('/api/equipa/rasto/pessoas?dias=' + dias).then(function (d) {
    var pessoas = d.pessoas || [];
    if (pessoas.length || dias === 90) return { pessoas: pessoas, noventa: pessoas.length };
    // vazio num período curto: os 90 dias dizem se ninguém aceitou ainda ou se foi só este período
    return pedir('/api/equipa/rasto/pessoas?dias=90').then(function (d90) { return { pessoas: pessoas, noventa: (d90.pessoas || []).length }; },
      function () { return { pessoas: pessoas, noventa: null }; });
  }).then(function (r) {
    if (vez !== rastoVez || seccao !== 'rasto') return;
    rastoPessoasVistas = r.pessoas;
    if (!r.pessoas.length) {
      var noventa = '<button type="button" class="btn sm"' + comAcao('verRastoPessoas', [90]) + '>Ver os 90 dias</button>';
      el('conteudo').innerHTML = topo + (r.noventa
        ? vazioHtml('Ninguém nos últimos ' + dias + ' dias.', 'Há rasto mais antigo: ' + contadoRasto(r.noventa, 'pessoa', 'pessoas') + ' nos últimos 90 dias.', noventa)
        : r.noventa === null
          ? vazioHtml('Ninguém nos últimos ' + dias + ' dias.', 'Ou ninguém aceitou o rasto ainda, ou não houve atividade neste período.', noventa)
          : vazioHtml('Ainda não há rasto de ninguém.', 'Ninguém aceitou o rasto ainda, na montra ou na app: quando alguém aceitar e tocar em alguma coisa, aparece aqui.' +
              ' Os eventos ficam 90 dias, e em produção as contas de teste ficam de fora.'));
      return;
    }
    el('conteudo').innerHTML = topo + rastoPessoasHtml(r.pessoas, rastoOrdem) + rastoLegendaHtml();
  }).catch(function (e) { if (vez === rastoVez) falhaRasto(e, 'verRastoPessoas', [dias]); });
}
/* Muda a ordem da lista das pessoas sem voltar à rede.
   Recebe: ordem — 'recentes' ou 'sinais'.
   Devolve: nada — repinta a lista. */
function ordenarRasto(ordem) {
  rastoOrdem = ordem === 'sinais' ? 'sinais' : 'recentes';
  if (!rastoPessoasVistas || !rastoPessoasVistas.length || seccao !== 'rasto' || rastoModo !== 'lista') return;
  el('conteudo').innerHTML = rastoTopoHtml('lista', rastoDias) + rastoPessoasHtml(rastoPessoasVistas, rastoOrdem) + rastoLegendaHtml();
}
/* O cartão da lista das pessoas: quantas são e quantas tiveram sinais, a
   ordem (as mais recentes, como vêm do servidor, ou as com mais sinais
   primeiro) e a tabela, uma linha por pseudónimo — o pid abre a linha do tempo.
   Recebe: pessoas — a lista do servidor; ordem — 'recentes' ou 'sinais'.
   Devolve: string HTML do cartão. */
function rastoPessoasHtml(pessoas, ordem) {
  var lista = pessoas.slice();
  if (ordem === 'sinais') {
    lista.sort(function (a, b) { return somaSinaisRasto(b.sinais) - somaSinaisRasto(a.sinais) || (b.ultimo || 0) - (a.ultimo || 0); });
  }
  var comSinais = pessoas.filter(function (p) { return somaSinaisRasto(p.sinais) > 0; }).length;
  var linhas = lista.map(function (p) {
    return '<tr><td data-rot="Pessoa"><span class="rs-pessoa-id">' +
      '<button type="button" class="ligacao rs-pid"' + comAcao('verRastoPessoa', [p.pid]) + '>' + esc(p.pid) + '</button>' +
      (p.teste ? badge('wa', 'Conta de teste') : '') + (p.conta ? '' : badge('', 'Sem conta')) + '</span></td>' +
      '<td class="n nw" data-rot="Última atividade">' + quando(p.ultimo) + '</td>' +
      '<td class="r n" data-rot="Sessões">' + esc(numero(p.sessoes || 0)) + '</td>' +
      '<td class="r n" data-rot="Eventos">' + esc(numero(p.eventos || 0)) + '</td>' +
      '<td class="nw" data-rot="Origens">' + (rastoOrigensHtml(p.origens) || '—') + '</td>' +
      '<td data-rot="Sinais">' + rastoSinaisHtml(p.sinais) + '</td></tr>';
  }).join('');
  return '<section class="card" id="rastoLista" aria-label="Pessoas com rasto"><div class="card-cab"><div class="card-cab-txt">' +
    '<h2 class="card-tit">' + contadoRasto(pessoas.length, 'pessoa', 'pessoas') + '</h2>' +
    '<p class="sub n">' + (comSinais ? contadoRasto(comSinais, 'pessoa com sinais de se ter perdido', 'pessoas com sinais de se terem perdido')
      : 'Ninguém com sinais de se ter perdido') + (pessoas.length >= 200 ? ' · as 200 mais recentes' : '') + '</p></div>' +
    '<div class="chips" role="group" aria-label="Ordem">' +
    chip('Mais recentes', ordem !== 'sinais', comAcao('ordenarRasto', ['recentes'])) +
    chip('Mais sinais', ordem === 'sinais', comAcao('ordenarRasto', ['sinais'])) + '</div></div>' +
    '<div class="tb-rola"><table class="tb empilha rs-tb"><thead><tr><th>Pessoa</th><th>Última atividade</th><th class="r">Sessões</th>' +
    '<th class="r">Eventos</th><th>Origens</th><th>Sinais</th></tr></thead><tbody>' + linhas + '</tbody></table></div></section>';
}

/* A vista Pessoas do Rasto, por ecrã: o resumo de onde a interface confunde
   mais gente — cada ecrã e alvo com sinais, um número por sinal, o total e
   quantas pessoas, do total maior para o menor.
   Recebe: dias (opcional) — 7, 30 ou 90 (30 à falta de outro).
   Devolve: nada — redesenha o conteúdo. */
function verRastoResumo(dias) {
  dias = diasRasto(dias);
  rastoDias = dias; rastoModo = 'ecras'; rastoVista = 'pessoas';
  nav('rasto');
  var vez = ++rastoVez;
  var topo = rastoTopoHtml('ecras', dias);
  el('conteudo').innerHTML = topo + esperaHtml('A juntar os sinais por ecrã.');
  pedir('/api/equipa/rasto/resumo?dias=' + dias).then(function (d) {
    if (vez !== rastoVez || seccao !== 'rasto') return;
    var linhas = (d.linhas || []).slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); });
    el('conteudo').innerHTML = topo + (linhas.length ? rastoResumoHtml(linhas) + rastoLegendaHtml()
      : vazioHtml('Nenhum sinal nos últimos ' + dias + ' dias.', 'Quando alguém se perder — um toque em vão, um vai-e-volta, uma desistência —, o ecrã e o alvo aparecem aqui.' +
          (dias < 90 ? ' Experimenta um período maior.' : ' Só entra quem aceitou o rasto.'),
          dias < 90 ? '<button type="button" class="btn sm"' + comAcao('verRastoResumo', [90]) + '>Ver os 90 dias</button>' : ''));
  }).catch(function (e) { if (vez === rastoVez) falhaRasto(e, 'verRastoResumo', [dias]); });
}
/* A tabela do resumo por ecrã: ecrã, alvo, um número por sinal, o total e as pessoas.
   Recebe: linhas — as do servidor, já ordenadas pelo total.
   Devolve: string HTML do cartão. */
function rastoResumoHtml(linhas) {
  var corpo = linhas.map(function (l) {
    var s = l.sinais || {};
    return '<tr><td data-rot="Ecrã">' + (l.ecra ? '<code class="rs-alvo">' + esc(l.ecra) + '</code>' : '—') + '</td>' +
      '<td data-rot="Alvo">' + (l.alvo ? '<code class="rs-alvo">' + esc(l.alvo) + '</code>' : '—') + '</td>' +
      SINAIS_RASTO.map(function (x) {
        var n = Number(s[x.id]) || 0;
        return '<td class="r n' + (n ? ' rs-n ' + x.tom : ' sub') + '" data-rot="' + x.nomes + '">' + (n ? esc(numero(n)) : '—') + '</td>';
      }).join('') +
      '<td class="r n forte" data-rot="Total">' + esc(numero(l.total || 0)) + '</td>' +
      '<td class="r n" data-rot="Pessoas">' + esc(numero(l.pessoas || 0)) + '</td></tr>';
  }).join('');
  return '<section class="card" aria-label="Sinais por ecrã"><div class="card-cab"><div class="card-cab-txt">' +
    '<h2 class="card-tit">Onde as pessoas se perdem</h2>' +
    '<p class="sub">Cada ecrã e o sítio onde se tocou, do que juntou mais sinais para o que juntou menos' +
    (linhas.length >= 100 ? ' (os 100 primeiros)' : '') + '.</p></div></div>' +
    '<div class="tb-rola"><table class="tb empilha rs-tb"><thead><tr><th>Ecrã</th><th>Alvo</th>' +
    SINAIS_RASTO.map(function (x) { return '<th class="r"><abbr title="' + x.nomes + '">' + x.curto + '</abbr></th>'; }).join('') +
    '<th class="r">Total</th><th class="r">Pessoas</th></tr></thead><tbody>' + corpo + '</tbody></table></div></section>';
}

/* A linha do tempo de uma pessoa: o pseudónimo, as contagens, e uma secção
   por sessão (a mais recente primeiro, e aberta; as outras fechadas), com
   cada evento pela ordem em que aconteceu. Quem chega de um pedido (o
   suporte também) volta ao pedido e não tem a lista nem a ida à ficha; quem
   chega da ficha volta à ficha.
   Recebe: pid — o pseudónimo (string); voltaTipo (opcional) — 'pedido' ou
   'conta'; voltaId (opcional) — o id do pedido ou da conta de onde se veio.
   Devolve: nada — redesenha o conteúdo. */
function verRastoPessoa(pid, voltaTipo, voltaId) {
  voltaTipo = voltaTipo === 'pedido' || voltaTipo === 'conta' ? voltaTipo : '';
  if (voltaTipo !== 'pedido') nav('rasto');
  if (typeof scrollTo === 'function') scrollTo(0, 0);
  var volta = voltaTipo === 'pedido'
    ? '<button type="button" class="btn sm ghost rs-volta"' + comAcao('verPedido', [voltaId]) + '>' + ic('voltar') + 'Voltar ao pedido</button>'
    : voltaTipo === 'conta'
      ? '<button type="button" class="btn sm ghost rs-volta"' + comAcao('verPessoa', [voltaId]) + '>' + ic('voltar') + 'Voltar à ficha</button>'
      : '<button type="button" class="btn sm ghost rs-volta"' + comAcao('ir', ['rasto']) + '>' + ic('voltar') + 'Voltar às pessoas</button>';
  var vez = ++rastoVez, secAberta = seccao;
  el('conteudo').innerHTML = volta + esperaHtml('A ler o rasto de ' + esc(pid) + '.');
  pedir('/api/equipa/rasto/pessoa/' + encodeURIComponent(pid)).then(function (d) {
    if (vez !== rastoVez || seccao !== secAberta) return;
    el('conteudo').innerHTML = volta + rastoPessoaHtml(d, voltaTipo);
  }).catch(function (e) { if (vez === rastoVez) falhaRasto(e, 'verRastoPessoa', [pid, voltaTipo, voltaId], volta); });
}
/* O HTML da linha do tempo de uma pessoa: o cabeçalho (o pid, se tem conta,
   se é de teste, a ida à ficha a quem abre as Pessoas), as contagens dos
   sinais e as sessões, com a passagem da montra para a app entre elas dita
   numa linha.
   Recebe: d — a resposta do servidor ({pid, userId, teste, sessoes}); voltaTipo —
   de onde se veio ('pedido' tira a ida à ficha).
   Devolve: string HTML. */
function rastoPessoaHtml(d, voltaTipo) {
  var sessoes = (d.sessoes || []).filter(function (s) { return s && (s.eventos || []).length; })
    .sort(function (a, b) { return inicioRasto(b) - inicioRasto(a); });
  var todos = [], contas = {};
  sessoes.forEach(function (s) { todos = todos.concat(s.eventos); });
  todos.forEach(function (ev) { if (sinalRasto(ev.sinal)) contas[ev.sinal] = (contas[ev.sinal] || 0) + 1; });
  var ficha = d.userId && veRastoTodos && voltaTipo !== 'pedido' && eu.cats.indexOf('user') > -1
    ? '<button type="button" class="btn"' + comAcao('verPessoa', [d.userId]) + '>Abrir a ficha</button>' : '';
  var marcas = (d.userId ? badge('ok', 'Com conta') : badge('', 'Só montra, sem conta')) + (d.teste ? badge('wa', 'Conta de teste') : '');
  var cab = cabecalho('<span class="rs-pid">' + esc(d.pid) + '</span>',
    '<span class="n">' + contadoRasto(sessoes.length, 'sessão', 'sessões') + ' · ' + contadoRasto(todos.length, 'evento', 'eventos') +
    (sessoes.length ? ' · de ' + data(inicioRasto(sessoes[sessoes.length - 1])) + ' a ' + data(fimRasto(sessoes[0])) : '') + '</span>', ficha);
  document.title = d.pid + ' · Rendorium Equipa';
  var resumo = '<div class="card rs-barra"><span class="chips">' + marcas + '</span>' +
    rastoSinaisHtml(contas, '<span class="sub">Nenhum sinal de se ter perdido.</span>') + '</div>';
  if (!sessoes.length) {
    return cab + resumo + vazioHtml('Ainda sem eventos.', 'O pseudónimo existe, mas não há toques guardados: ou não tocou em nada desde que aceitou, ou passaram os 90 dias.');
  }
  var html = sessoes.map(function (s, i) {
    var entre = '';
    var antes = sessoes[i + 1];
    if (antes) {
      var de = ultimaOrigemRasto(antes), para = (s.eventos[0] || {}).origem;
      if (de && para && de !== para) {
        entre = '<p class="rs-passa-entre">' + ic('seta', 'i-sm') + '<span>Passou ' + passagemRasto(de, para) + ', ' +
          duracaoRasto(inicioRasto(s) - fimRasto(antes)) + ' depois.</span></p>';
      }
    }
    return rastoSessaoHtml(s, i === 0) + entre;
  }).join('');
  return cab + resumo + '<div class="rs-sessoes">' + html + '</div>' + rastoLegendaHtml();
}
// quando a sessão começou: o do servidor, ou o primeiro evento
// Recebe: s — a sessão. Devolve: o instante (ms).
function inicioRasto(s) { return s.inicio || Math.min.apply(null, s.eventos.map(function (e) { return e.at || 0; })); }
// quando a sessão acabou: o do servidor, ou o último evento
// Recebe: s — a sessão. Devolve: o instante (ms).
function fimRasto(s) { return s.fim || Math.max.apply(null, s.eventos.map(function (e) { return e.at || 0; })); }
// a origem do último evento de uma sessão
// Recebe: s — a sessão. Devolve: 'app', 'montra' ou ''.
function ultimaOrigemRasto(s) {
  var evs = eventosRasto(s);
  return evs.length ? evs[evs.length - 1].origem || '' : '';
}
// os eventos de uma sessão pela ordem em que aconteceram
// Recebe: s — a sessão. Devolve: uma cópia ordenada dos eventos.
function eventosRasto(s) { return (s.eventos || []).slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); }); }
// a passagem de uma origem para outra, dita: «da montra para a app»
// Recebe: de, para — 'app' ou 'montra'. Devolve: o texto.
function passagemRasto(de, para) {
  var nome = function (o) { return o === 'app' ? 'a app' : o === 'montra' ? 'a montra' : 'o sítio «' + esc(o) + '»'; };
  return (de === 'app' || de === 'montra' ? 'd' + nome(de) : 'de ' + nome(de)) + ' para ' + nome(para);
}
/* Uma sessão da linha do tempo: uma secção que abre e fecha, com o início,
   a duração, as origens, quantos eventos e quantos sinais; aberta, a tabela
   dos eventos, com a linha de cada sinal marcada no contorno e na letra, e a
   passagem de uma origem para a outra dita numa linha.
   Recebe: s — a sessão ({sessao, inicio, fim, origens, eventos}); aberta — se abre já aberta.
   Devolve: string HTML. */
function rastoSessaoHtml(s, aberta) {
  var evs = eventosRasto(s);
  var origens = s.origens && s.origens.length ? s.origens : evs.reduce(function (l, e) { if (e.origem && l.indexOf(e.origem) < 0) l.push(e.origem); return l; }, []);
  var nSinais = evs.filter(function (e) { return sinalRasto(e.sinal); }).length;
  var linhas = '', anterior = '';
  evs.forEach(function (e) {
    if (anterior && e.origem && e.origem !== anterior) {
      linhas += '<tr class="rs-passa"><td colspan="7">' + ic('seta', 'i-sm') + 'Passou ' + passagemRasto(anterior, e.origem) + '</td></tr>';
    }
    if (e.origem) anterior = e.origem;
    var sn = sinalRasto(e.sinal);
    var posicao = e.x != null && e.y != null
      ? '<span class="sub n">a ' + Math.round(e.x / 10) + '% da esquerda e ' + Math.round(e.y / 10) + '% do cimo' +
        (e.vw && e.vh ? ' · janela ' + esc(e.vw) + '×' + esc(e.vh) : '') + '</span>' : '';
    linhas += '<tr' + (sn ? ' class="rs-sinal ' + sn.tom + '"' : '') + '>' +
      '<td class="n nw" data-rot="Hora">' + horaRasto(e.at) + '</td>' +
      '<td data-rot="Origem">' + rastoOrigensHtml([e.origem]) + '</td>' +
      '<td class="nw" data-rot="Tipo">' + esc(TIPOS_RASTO[e.tipo] || e.tipo || '—') + '</td>' +
      '<td data-rot="Ecrã">' + (e.ecra ? '<code class="rs-alvo">' + esc(e.ecra) + '</code>' : '—') + '</td>' +
      '<td data-rot="Janela">' + (e.janela ? '<code class="rs-alvo">' + esc(e.janela) + '</code>' : '—') + '</td>' +
      '<td data-rot="Alvo"><span class="rs-alvo-bloco">' + (e.alvo ? '<code class="rs-alvo">' + esc(e.alvo) + '</code>' : '—') + posicao + '</span></td>' +
      '<td data-rot="Sinal">' + (sn ? '<span class="badge rs-s ' + sn.tom + '">' + sn.nome + '</span>' : '<span class="sub">—</span>') + '</td></tr>';
  });
  return '<details class="card rs-sessao"' + (aberta ? ' open' : '') + '>' +
    '<summary><span class="st-seta" aria-hidden="true">' + ic('baixo', 'i-sm') + '</span>' +
    '<span class="forte n">' + data(inicioRasto(s)) + '</span>' +
    '<span class="sub n">' + duracaoRasto(fimRasto(s) - inicioRasto(s)) + ' · ' + contadoRasto(evs.length, 'evento', 'eventos') + '</span>' +
    '<span class="rs-sessao-selos">' + rastoOrigensHtml(origens) +
    (nSinais ? '<span class="badge rs-s wa">' + contadoRasto(nSinais, 'sinal', 'sinais') + '</span>' : '') + '</span></summary>' +
    '<div class="tb-rola"><table class="tb empilha rs-tb rs-ev"><thead><tr><th>Hora</th><th>Origem</th><th>Tipo</th><th>Ecrã</th><th>Janela</th>' +
    '<th>Alvo</th><th>Sinal</th></tr></thead><tbody>' + linhas + '</tbody></table></div></details>';
}

/* O «Ver o rasto» no detalhe de um pedido: pergunta ao servidor o pseudónimo
   de quem o escreveu (só o dá a quem pode ver o pedido) e, se houver, põe o
   botão que abre a linha do tempo dessa pessoa, a voltar ao pedido. Sem pid
   (não aceitou o rasto) não aparece nada; um erro fica calado.
   Recebe: id — o id do pedido (string).
   Devolve: nada — preenche o pedidoRasto. */
function rastoDoPedido(id) {
  if (!veRastoDoPedido) return;
  pedir('/api/equipa/rasto/ticket/' + encodeURIComponent(id)).then(function (d) {
    var sitio = el('pedidoRasto');
    if (!sitio || pedidoAberto !== id || !d || !d.pid) return;
    sitio.innerHTML = '<button type="button" class="btn sm"' + comAcao('verRastoPessoa', [d.pid, 'pedido', id]) + '>Ver o rasto</button>' +
      '<span class="sub n rs-pid">' + esc(d.pid) + '</span>';
  }).catch(function () {});
}
/* O rasto da pessoa na ficha (master e admin): o pseudónimo da conta e o
   botão que abre a linha do tempo dela, ao lado do «Ver no rasto» da
   auditoria. Sem pid (não aceitou o rasto) não aparece nada; um erro fica calado.
   Recebe: id — o id da conta (string).
   Devolve: nada — preenche o fichaRasto. */
function rastoDaConta(id) {
  pedir('/api/equipa/rasto/conta/' + encodeURIComponent(id)).then(function (d) {
    var sitio = el('fichaRasto');
    if (!sitio || !fichaVista || fichaVista.id !== id || !d || !d.pid) return;
    sitio.innerHTML = '<button type="button" class="btn"' + comAcao('verRastoPessoa', [d.pid, 'conta', id]) + '>' +
      'Ver o rasto da pessoa <span class="sub n rs-pid">' + esc(d.pid) + '</span></button>';
  }).catch(function () {});
}

/* -------------------------------- as ações ------------------------------- */

// os quatro botões da sessão de teste: [comDados, manter, limpar] do sessaoTeste
var MODOS_TESTE = {
  retomar: [false, false, false], 'extra-dados': [true, true, false],
  extra: [false, true, false], limpar: [false, false, true],
};

/* O que cada data-acao (clique), data-enter (Enter num campo) e data-mudar
   (change) faz. Cada entrada recebe o dataset do elemento (arg, arg2, arg3,
   em texto, tal e qual como a vista os escreveu com o ligarA) e o próprio
   elemento, e chama a função da página. Um nome que não esteja aqui não se
   procura em mais lado nenhum. */
var ACOES = {
  sair: function () { sair(); },
  ir: function (d) { ir(d.arg, d.arg2); },
  verLista: function (d) { verLista(d.arg, d.arg2); },
  procurarLista: function (d, alvo) { verLista(d.arg, estado, alvo.value); },
  verPedido: function (d) { verPedido(d.arg); },
  agir: function (d) { agir(d.arg, d.arg2); },
  mudarCategoria: function (d) { mudarCategoria(d.arg, d.arg2); },
  aceitarPedido: function (d) { aceitarPedido(d.arg); },
  recusarPedido: function (d) { recusarPedido(d.arg); },
  usarModelo: function (d) { usarModelo(d.arg); },
  guardarModelo: function () { guardarModelo(); },
  verPessoas: function () { verPessoas(ultimaProcura); },
  procurarPessoas: function () { verPessoas(el('q').value); },
  criarConta: function () { criarConta(); },
  verPessoa: function (d) { verPessoa(d.arg); },
  acaoConta: function (d) { acaoConta(d.arg, d.arg2); },
  mudarServico: function (d) { mudarServico(d.arg, d.arg2, d.arg3 === 'ligar'); },
  confirmarServico: function (d) { mudarServico(d.arg, d.arg2, false, true); },
  cancelarServico: function () { var a = el('svAviso'); if (a) a.remove(); },
  copiarAgora: function () { copiarAgora(); },
  resumoCopia: function (d) { resumoCopia(d.arg); },
  sessaoTeste: function (d) {
    var m = Object.prototype.hasOwnProperty.call(MODOS_TESTE, d.arg) ? MODOS_TESTE[d.arg] : null;
    if (m) sessaoTeste(m[0], m[1], m[2]);
  },
  sessoesTeste: function (d) { sessoesTeste(d.arg, d.arg2, d.arg3); },
  criarEndereco: function () { criarEndereco(); },
  procurarRasto: function (d, alvo) { ir('rasto', String(alvo.value || '').trim()); },
  mudarVistaRasto: function (d) { mudarVistaRasto(d.arg); },
  verRastoPessoas: function (d) { verRastoPessoas(d.arg); },
  verRastoResumo: function (d) { verRastoResumo(d.arg); },
  ordenarRasto: function (d) { ordenarRasto(d.arg); },
  verRastoPessoa: function (d) { verRastoPessoa(d.arg, d.arg2, d.arg3); },
  confirmarFormulario: function () { confirmarFormulario(); },
  fecharDialogo: function () { el('dialogo').close(); },
  fecharAviso: function () { esconderAviso(); },
};

/* Corre a ação do elemento mais próximo do alvo do evento que tenha o
   atributo data-<tipo> — o clique num filho de um botão é o clique no
   botão, como era com o onclick. Um nome fora da tabela ACOES rebenta com
   um erro claro, que chega ao window.onerror como chegava o de um onclick.
   Recebe: evento — o evento do browser; tipo — 'acao', 'enter' ou 'mudar'.
   Devolve: nada — corre a ação, se houver. */
function despachar(evento, tipo) {
  var alvo = evento.target && evento.target.closest ? evento.target.closest('[data-' + tipo + ']') : null;
  if (!alvo) return;
  var nome = alvo.getAttribute('data-' + tipo);
  if (!Object.prototype.hasOwnProperty.call(ACOES, nome)) throw new Error('ação desconhecida: ' + nome);
  if (tipo === 'enter' && evento.preventDefault) evento.preventDefault();
  ACOES[nome](alvo.dataset, alvo, evento);
}

document.addEventListener('click', function (e) { despachar(e, 'acao'); });
document.addEventListener('keydown', function (e) { if (e.key === 'Enter') despachar(e, 'enter'); });
document.addEventListener('change', function (e) { despachar(e, 'mudar'); });
// o quarto ouvinte não chama ações: acerta os contadores e tira o erro de um campo a que se volta a escrever
document.addEventListener('input', function (e) {
  var t = e.target;
  if (!t || !t.getAttribute) return;
  if (t.getAttribute('data-contar')) contarCaracteres(t);
  if (t.getAttribute('aria-invalid') === 'true') marcarErro(t.id, '');
});

/* ------------------------------- arranque ------------------------------- */
var primeira = SECCOES.filter(function (s) { return s.se; })[0];
if (primeira) ir(primeira.id);
else el('conteudo').innerHTML = vazioHtml('O teu papel não abre nenhuma secção daqui.', 'Pede a quem gere os acessos no Discord.');
// os crachás das listas que não estão à vista
SECCOES.forEach(function (s) { if (s.se && s.conta && s.id !== seccao) contar(s.conta); });`;
