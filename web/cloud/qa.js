/* ===== TICKETS DE QA ===== */
/* A pílula «Lab» do ambiente de desenvolvimento (chamou-se «QA» e depois
   «Tickets»; desde 2026-11-26, KAN-167, é o Lab, com o frasco: já não serve
   só para os tickets). Arrasta-se para a borda que estorvar menos e abre o
   menu: a secção «Tickets» («Novo ticket» e «Ver tickets»), os «Modelos de
   dados» (cloud/modelos.js:mdlAbrir) e as idas à montra, à app e ao back
   office. Os tickets de QA
   vão para a D1 do ambiente (worker/src/rotas/qa.js) com o contexto do ecrã,
   cada um com o seu cartão no kanban da equipa, e o Claude trata-os pelo
   kanban (scripts/kanban.mjs). Em produção nada disto existe: nem a pílula
   (CW.ambiente === 'producao') nem as rotas (404 sem ENV_NAME). */
'use strict';

/* Um ticket está sempre numa coluna do kanban da equipa (as mesmas colunas,
   a decisão do Martinho, 2026-11-10): o status guarda o id da coluna onde
   está o cartão dele (migrations/0029_qa_no_kanban.sql), e mover o cartão no
   kanban move o ticket, e vice-versa. As fixas: A fazer ('a-fazer', onde
   nasce e para onde volta ao reabrir), Auto Tests ('auto-tests', quando o
   Claude pega nele), Human Tests ('human-tests', resolvido e à espera de
   quem testa), Staging ('staging', vai no próximo promove), Adiado
   ('adiado', resolvido, fica no dev) e Produção ('concluido', para onde o
   promove leva os de Staging) — as três de fim (migrations/0032_staging_adiado.sql);
   e as que o master criar (Para depois, ou outras, com id uuid). O GET
   /api/qa traz as colunas pela ordem do quadro, e a lista mostra uma secção
   por coluna. Resolvido é estar em Human Tests ou numa coluna de fim: aí o
   resolved_at está posto, e o ticket reabre-se. Em Human Tests quem testa
   decide (Recusar, Adiar a produção, Enviar para produção) em vez de mover,
   e em Adiado envia-o para produção. Qualquer ticket leva comentários, que
   são os do cartão dele no kanban; comentar devolve-o a A fazer, para quem
   programa responder (a nota do resolver é a resposta).

   A lista é uma vista do kanban (pedido do Martinho, 2026-11-12, KAN-115) e,
   desde 2026-11-24, de todos os tickets (KAN-155: «Não é só para QA, é para
   todos os tickets. Devo poder ver todos os tickets que não estão
   concluídos»): todos os cartões que não estão em Produção, de todos os
   tipos, venham de onde vierem; o número da pílula conta-os a todos. Os que
   vieram de um ticket de QA trazem a captura e o contexto (ticket: true, com
   o id do ticket); os outros têm a chave do cartão (KAN-N) como id, as
   mesmas ações escritas no cartão, e sem «Remover» (remover um cartão é do
   master, no kanban). Os dos pedidos das pessoas (pedido: true) vêm só com
   a chave e o título — o servidor nem manda o texto — e abrem só para ler.

   O desenho (a opção C que o Martinho escolheu, 2026-10-28): a pega de pontos,
   o ícone (o frasco do Lab), «Lab» e o número por concluir, num roxo (--loan) que não se confunde
   com o cobalto das ações da app. A pega fica do lado da borda onde a pílula
   encostou (o data-lado que o qaPor escreve; a troca é da folha), e só muda
   ao largar, nunca a meio do arrasto. Na primeira vez, ao lado, a
   etiqueta «Arrasta para mudar de sítio», até ao primeiro arrasto.

   Arrasta-se com o rato, o dedo e a caneta (pointer events; o touch-action da
   pílula entrega o gesto à app). Até o ponteiro andar QA_LIMIAR é um toque, e
   o clique abre o menu; daí em diante é um arrasto, segue o ponteiro, e o
   clique que o browser dá a seguir engole-se (qaEngoleClique). Ao largar,
   cola à borda esquerda ou direita mais perto, à altura do largar, presa às
   margens (qaEncaixe), e lembra-se neste aparelho como lado + fração da
   altura útil — sobrevive a rodar o telemóvel e a encolher a janela, que
   reencaixam. As setas fazem o mesmo sem rato.

   A altura útil acaba acima da barra de baixo do telemóvel (e da barra da
   seleção): a pílula nunca a tapa. À esquerda, no computador, começa a seguir
   à barra lateral. Fica por cima do conteúdo e por baixo do véu da gaveta, da
   barra lateral, das janelas e dos portões (estilos.css, o bloco «tickets de
   QA»). */

/* ---------------------------------------------------------------- estado */

// onde a pílula fica neste aparelho: {lado: 'esq'|'dir', y: fração da altura útil, 0 a 1}
var QA_LS_POSICAO = 'gi_qa_posicao';
// a pílula já foi arrastada (ou mudada pelas setas) neste aparelho: a etiqueta não volta
var QA_LS_ARRASTOU = 'gi_qa_arrastou';
// px que o ponteiro anda antes de o gesto passar a arrasto (os 10px de decidir do aviso e da folha)
var QA_LIMIAR = 10;
// px entre a pílula e a borda do sítio onde ela pode estar
var QA_MARGEM = 12;
// onde nasce: à direita, a 80% da altura útil — acima da barra de baixo e longe do aviso
var QA_POSICAO_INICIAL = { lado: 'dir', y: 0.8 };
// quanto anda uma seta na vertical (fração da altura útil)
var QA_PASSO_TECLA = 0.05;
// a distância (px) a partir da qual o encaixe atravessa o ecrã: --lento em vez de --medio
var QA_LONGE = 320;
// quanto tempo (ms) o clique a seguir a um arrasto se engole (o do aviso e da folha)
var QA_ENGOLE_MS = 350;
// o maior lado da captura de ecrã depois de encolhida (px)
var QA_IMAGEM_LADO = 1600;
// o teto do servidor para a captura (bytes): o PUT recusa acima disto
var QA_IMAGEM_MAX = 3 * 1024 * 1024;
// Os anexos (KAN-165): o teto de cada ficheiro (o do kanban, rotas/kanban.js:MAX_ANEXO),
// quantos vão de uma vez (rotas/qa.js:TETO_ANEXOS_ENVIO) e o que o seletor
// oferece — os tipos que o servidor aceita (lib/imagens.js:TIPOS_DOS_ANEXOS,
// lidos lá dos bytes), mais o GIF e o HEIC, que se encolhem para WebP aqui
var QA_ANEXO_MAX = 10 * 1024 * 1024;
var QA_ANEXOS_ENVIO = 10;
var QA_ANEXOS_ACEITA = 'image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.pdf,.docx,.xlsx,.pptx,.txt,.log,.csv';
// as extensões de um documento que o servidor aceita, e o nome curto de cada tipo para a linha do anexo
var QA_EXT_DOCUMENTO = /\.(pdf|docx|xlsx|pptx|txt|log|csv)$/i;
var QA_NOMES_DOS_FICHEIROS = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel', pptx: 'PowerPoint', txt: 'Texto', log: 'Texto', csv: 'CSV', png: 'PNG', jpg: 'JPEG', jpeg: 'JPEG', webp: 'WebP' };
var QA_SEQ_ANEXO = 0;         // o contador das chaves locais dos ficheiros escolhidos (qaJuntarAnexos)
// quantas entradas do rasto vão com o ticket, e com quantos caracteres cada uma
var QA_RASTO_MAX = 10;
var QA_RASTO_LETRAS = 120;
// as gravidades do «Novo ticket», pela ordem do segmentado (o servidor faz delas a prioridade do cartão: lib/kanban.js:prioridadeDaGravidade)
var QA_GRAVIDADES = [
  { v: 'bloqueia', rotulo: 'Bloqueia', cor: 'red' },
  { v: 'incomoda', rotulo: 'Incomoda', cor: 'amber' },
  { v: 'detalhe', rotulo: 'Detalhe', cor: 'grey' },
];
// as prioridades dos cartões do kanban (lib/kanban.js:NOMES_DAS_PRIORIDADES), de 1 (Mais alta) a 5 (Mais baixa); a Média é a de omissão
var QA_PRIORIDADES = [
  { p: 1, rotulo: 'Mais alta' }, { p: 2, rotulo: 'Alta' }, { p: 3, rotulo: 'Média' }, { p: 4, rotulo: 'Baixa' }, { p: 5, rotulo: 'Mais baixa' },
];
var QA_PRIORIDADE_OMISSAO = 3;
// as colunas do kanban que a pílula conhece pelo nome (worker/src/lib/kanban.js: QA_NOVO, QA_EM_CURSO, QA_RESOLVIDO)
var QA_COL_NOVO = 'a-fazer';
var QA_COL_EM_CURSO = 'auto-tests';
var QA_COL_RESOLVIDO = 'human-tests';
// as duas saídas de quem aceita um ticket em Human Tests (qaRodapeTicket, KAN-157): «Enviar para produção»
// (Staging: vai no próximo promove) e «Adiar a produção» (Adiado: resolvido, fica no dev; lib/kanban.js: KAN_STAGING, KAN_ADIADO)
var QA_COL_STAGING = 'staging';
var QA_COL_ADIADO = 'adiado';
// Produção (lib/kanban.js:KAN_PRODUCAO, o id de sempre): a pílula não mostra o que lá está, e quem leva para lá é o promove
var QA_COL_PRODUCAO = 'concluido';
// as colunas quando o servidor não as manda (um servidor de antes da 0029), pela ordem do quadro
var QA_COLUNAS_OMISSAO = [
  { id: 'a-fazer', nome: 'A fazer', fim: false },
  { id: 'auto-tests', nome: 'Auto Tests', fim: false },
  { id: 'human-tests', nome: 'Human Tests', fim: false },
  { id: 'staging', nome: 'Staging', fim: true },
  { id: 'adiado', nome: 'Adiado', fim: true },
  { id: 'concluido', nome: 'Produção', fim: true },
  { id: 'para-depois', nome: 'Para depois', fim: false },
];
// o nome de cada tipo de cartão do kanban (lib/kanban.js:NOMES_DOS_TIPOS), para o título da janela e a linha
var QA_NOMES_DOS_TIPOS = { epico: 'Épico', historia: 'História', tarefa: 'Tarefa', subtarefa: 'Subtarefa', erro: 'Erro' };
// a forma de um id de coluna (lib/kanban.js:ID_DE_COLUNA): os slugs das fixas e os uuid das que o master cria
var QA_ID_COLUNA = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
// as secções da lista que se tocaram neste aparelho: {chave: true (aberta) ou false (recolhida)}
var QA_LS_DOBRAS = 'gi_qa_dobras';
// as secções dos grupos de prioridade de A fazer ('p-1' a 'p-5'); as das colunas têm o id da coluna como chave
var QA_DOBRAS_GRUPOS = QA_PRIORIDADES.map(function (x) { return 'p-' + x.p; });
// as colunas que nascem recolhidas enquanto ninguém lhes tocou: o que fica para depois
var QA_DOBRAS_FECHADAS = ['para-depois'];

var qaPil = null;            // o elemento da pílula (#qaPilula); null fora do dev ou sem sessão
var qaSonda = null;          // a sonda das margens seguras (#qaSonda)
var qaXY = null;             // onde a pílula está agora, {x, y} em px (o canto de cima à esquerda)
var qaArr = null;            // o arrasto em curso
var qaAnim = null;           // a animação do encaixe em curso
var qaEngoleAte = 0;         // até quando (Date.now) se engole o clique a seguir a um arrasto
var qaArrastouAqui = false;  // o mesmo que QA_LS_ARRASTOU, para quando o armazenamento está vedado
var qaPonteiro = '';         // o ponteiro do último toque na pílula: 'touch', 'mouse', 'pen' ou 'teclado'
var qaContextoGuardado = null;   // o ecrã no momento em que se abriu o menu
var qaLista = { tickets: null, falhou: false, aPedir: null, colunas: null };   // tickets: null quer dizer «ainda não se sabe»; colunas: as do kanban (null: as de omissão)
var qaAbertos = null;        // quantos tickets por concluir (todos os da lista: os que não estão em Produção); null enquanto não se sabe
var qaRascunho = null;       // o ticket a ser escrito: {gravidade, imagem, url, id, aEnviar, contexto, camada, anexos, imagemSubiu}
var qaCamadaLista = null;    // a camada da janela «Tickets», enquanto aberta
var qaCamadaTicket = null;   // a camada da janela de um ticket, enquanto aberta
var qaOcupado = {};          // id → 1: um pedido de remover, reabrir ou mover esse ticket a caminho
var qaTamanhoPedido = 0;     // o requestAnimationFrame do reencaixe ao mudar de tamanho
var qaDobrasAqui = {};       // o mesmo que QA_LS_DOBRAS, para quando o armazenamento está vedado

/* ------------------------------------------------------ existir ou não */

/* A pílula existe aqui? Só fora de produção — o CW.ambiente chega do
   servidor depois do arranque (cloud/guia.js) e até lá vale 'producao' — e
   com sessão, porque as rotas a pedem.
   Devolve: true ou false. */
function qaDeveExistir() {
  return !!(window.CW && CW.ambiente && CW.ambiente !== 'producao' && CW.user);
}

/* Põe a pílula no ecrã ou tira-a, conforme o qaDeveExistir. Corre a cada
   render (o embrulho no fim do ficheiro): é o render que chega quando o
   ambiente é conhecido, quando se entra e quando se sai. Com a pílula já no
   ecrã, volta a encaixá-la (a barra da seleção pode ter aparecido) — menos a
   meio de um arrasto ou de um encaixe.
   Devolve: true se a pílula ficou no ecrã. */
function qaSincronizar() {
  if (!qaDeveExistir()) { qaRemoverPilula(); return false; }
  if (!qaPil) { qaCriarPilula(); qaCarregar(); }
  else if (!qaArr && !qaAnim) qaReencaixar();
  return true;
}

/* Cria a pílula e a sonda das margens seguras, pendura-as no body, liga o
   arrasto e as setas, e põe a pílula no sítio guardado.
   Devolve: nada. */
function qaCriarPilula() {
  var s = document.createElement('div');
  s.id = 'qaSonda'; s.className = 'qa-sonda';
  s.setAttribute('aria-hidden', 'true');
  document.body.appendChild(s);
  qaSonda = s;
  var p = document.createElement('div');
  p.id = 'qaPilula'; p.className = 'qa-pilula entra';
  p.innerHTML = qaHtmlPilula(qaAbertos, qaEtiquetaVisivel());
  document.body.appendChild(p);
  qaPil = p;
  p.addEventListener('pointerdown', qaPousar);
  var b = qaBotao();
  if (b && typeof b.addEventListener === 'function') b.addEventListener('keydown', qaTecla);
  qaReencaixar();
}

/* Tira a pílula e a sonda do ecrã (saiu-se da sessão, ou o ambiente é o de
   produção) e larga um arrasto ou um encaixe a meio.
   Devolve: nada. */
function qaRemoverPilula() {
  if (qaArr) qaArrastoLargar();
  qaPararAnim();
  try { if (qaPil) qaPil.remove(); } catch (e) {}
  try { if (qaSonda) qaSonda.remove(); } catch (e) {}
  qaPil = null; qaSonda = null; qaXY = null;
}

/* O botão da pílula (o que se toca e se arrasta).
   Devolve: o elemento, ou null sem pílula. */
function qaBotao() {
  return qaPil && typeof qaPil.querySelector === 'function' ? qaPil.querySelector('.qa-botao') : null;
}

/* ------------------------------------------------------------ o desenho */

/* O HTML de dentro da pílula: o botão (pega, o frasco, «Lab», número), o menu
   da casa (.menupop, aberto pelo menuOpen — o closePops, o Escape e o
   aria-expanded são os de todos os menus ⋯), a frase para o leitor de ecrã,
   e a etiqueta da primeira vez. O data-menu="acoes" diz ao percurso que é um
   menu de ações com nome próprio, e não a porta das opções de um registo
   (testes/ui/invariantes.js, «a porta das opções é sempre a mesma»).
   Recebe: n — quantos tickets por concluir (null se ainda não se sabe);
   comEtiqueta — true para mostrar «Arrasta para mudar de sítio».
   Devolve: o HTML (texto). */
function qaHtmlPilula(n, comEtiqueta) {
  return '<span class="menuwrap qa-envolve" data-menu="acoes">' +
      '<button type="button" class="qa-botao" data-toca="camada" data-click="menuOpen(event,\'qa\');qaMenuAbriu(event)" ' +
        'aria-expanded="false" aria-label="' + esc(qaRotuloDoBotao(n)) + '" aria-describedby="qaDica">' +
        '<span class="qa-pega" aria-hidden="true">' + ic('grip', 16) + '</span>' +
        '<span class="qa-ic" aria-hidden="true">' + ic('frasco', 16) + '</span>' +
        '<span class="qa-nome" aria-hidden="true">Lab</span>' +
        '<span class="qa-n" aria-hidden="true"' + (n > 0 ? '' : ' hidden') + '>' + qaNumeroCurto(n) + '</span>' +
      '</button>' +
      '<div class="menupop qa-menu" id="menu_qa">' + qaHtmlMenu(n) + '</div>' +
    '</span>' +
    '<span class="qa-so-leitor" id="qaDica">Arrasta, ou usa as setas, para mudar o botão de sítio.</span>' +
    (comEtiqueta ? '<span class="qa-etiqueta" aria-hidden="true">Arrasta para mudar de sítio</span>' : '');
}

/* global QA_EQUIPA -- definido pela camada do back office (worker/src/equipa-qa.js:CABECA_DA_EQUIPA); só se lê depois de o qaLugar dizer 'equipa' */

/* As opções do menu da pílula, conforme o sítio (qaLugar). Começa sempre
   pela secção «Tickets» (o título e «Novo ticket», «Ver tickets») e pelos
   «Modelos de dados» (cloud/modelos.js:mdlAbrir; KAN-167), separados das idas
   por um traço:
   - na app: «Novo ticket», «Ver tickets», «Ver a montra» e «Back office»;
   - nas páginas públicas (a montra e o guia): «Novo ticket», «Ver tickets»,
     «Voltar à app» e «Back office»;
   - no back office: «Novo ticket» e «Ver tickets» e, quando a sessão de
     teste de quem lá está abre a app (QA_EQUIPA.app, que o worker calcula
     com a porta do dev), também «Ver a montra» e «Voltar à app» — sem
     «Back office», que é onde já se está.
   A montra fora da raiz é o /montra (worker/src/index.js), e no dev só abre
   com a sessão de uma conta de teste: a APK de dev não tem barra de
   endereços, e as ligações do /test abrem nela, não no browser — sem estas
   opções não havia como andar entre a app, a montra e o back office no
   telemóvel. No back office, quem entrou pela sessão de teste
   (equipa.js:entrarPelaSessaoDeTeste) tem o cookie dela e passa a porta do
   dev; quem entrou pelo /entrar do Discord, sem ela, levaria o 404 da
   porta, e então o menu fica só com os tickets e os modelos.
   Recebe: n — quantos tickets por concluir (null se ainda não se sabe).
   Devolve: o HTML (texto). */
function qaHtmlMenu(n) {
  var lugar = qaLugar();
  var daEquipaComApp = lugar === 'equipa' && !!QA_EQUIPA && QA_EQUIPA.app === true;
  var idas = (lugar === 'app' || daEquipaComApp ? '<button type="button" class="qa-menu-montra" data-toca="camada" data-click="closePops();qaVerMontra()">' + ic('door', 17) + ' Ver a montra</button>' : '') +
    (lugar === 'paginas' || daEquipaComApp ? '<button type="button" class="qa-menu-app" data-toca="camada" data-click="closePops();qaVoltarApp()">' + ic('home', 17) + ' Voltar à app</button>' : '') +
    (lugar === 'equipa' ? '' : '<button type="button" class="qa-menu-equipa" data-toca="camada" data-click="closePops();qaBackOffice()">' + ic('users', 17) + ' Back office</button>');
  return '<p class="qa-menu-titulo" aria-hidden="true">Tickets</p>' +
    '<button type="button" data-toca="camada" data-click="closePops();qaNovoTicket()">' + ic('plus', 17) + ' Novo ticket</button>' +
    '<button type="button" class="qa-menu-ver" data-toca="camada" data-click="closePops();qaVerTickets()">' + ic('lista', 17) + ' ' + esc(qaRotuloVer(n)) + '</button>' +
    '<div class="sdiv" aria-hidden="true"></div>' +
    '<button type="button" class="qa-menu-modelos" data-toca="camada" data-click="closePops();mdlAbrir()">' + ic('frasco', 17) + ' Modelos de dados</button>' +
    (idas ? '<div class="sdiv" aria-hidden="true"></div>' + idas : '');
}

/* Onde está a pílula. A camada do worker (worker/src/equipa-qa.js) define,
   no mesmo âmbito que este ficheiro, o QA_PAGINAS nas páginas públicas e o
   QA_EQUIPA no back office; na app não existe nenhum dos dois.
   Devolve: 'paginas', 'equipa' ou 'app'. */
function qaLugar() {
  if (typeof QA_PAGINAS !== 'undefined') return 'paginas';
  if (typeof QA_EQUIPA !== 'undefined') return 'equipa';
  return 'app';
}

/* A pílula está no back office?
   Devolve: true ou false. */
function qaNaEquipa() {
  return qaLugar() === 'equipa';
}

/* Vai para a montra (e daí para os guias) neste separador — na APK de dev,
   no mesmo WebView, que leva o cookie da sessão de teste. O «voltar» do
   telemóvel ou do browser regressa à app.
   Devolve: nada. */
function qaVerMontra() {
  location.href = '/montra';
}

/* Das páginas públicas, volta à app (o / do dev), neste separador.
   Devolve: nada. */
function qaVoltarApp() {
  location.href = '/';
}

/* Vai para o back office (/equipa), neste separador. Lá a sessão é a da
   equipa, pelo Discord: sem ela, o /equipa diz como se entra.
   Devolve: nada. */
function qaBackOffice() {
  location.href = '/equipa';
}

/* O número da pílula, curto: 99+ a partir de cem.
   Recebe: n — quantos tickets por concluir.
   Devolve: o texto ('' sem número). */
function qaNumeroCurto(n) {
  if (!(n > 0)) return '';
  return n > 99 ? '99+' : String(n);
}

/* O nome do botão para o leitor de ecrã, com o número dito por extenso.
   Recebe: n — quantos tickets por concluir (null se ainda não se sabe).
   Devolve: o texto. */
function qaRotuloDoBotao(n) {
  if (n == null) return 'Lab';
  if (n === 0) return 'Lab, nenhum ticket por concluir';
  return 'Lab, ' + n + (n === 1 ? ' ticket' : ' tickets') + ' por concluir';
}

/* O rótulo da segunda opção do menu: «Ver tickets (N)», com N os por concluir.
   Recebe: n — quantos tickets por concluir (null se ainda não se sabe).
   Devolve: o texto. */
function qaRotuloVer(n) {
  return n == null ? 'Ver tickets' : 'Ver tickets (' + n + ')';
}

/* Escreve o número por concluir na pílula e no menu, sem a refazer (o menu
   pode estar aberto). A largura muda com o número, e à direita isso muda o
   x: reencaixa.
   Devolve: nada. */
function qaPintarNumero() {
  if (!qaPil || typeof qaPil.querySelector !== 'function') return;
  var n = qaAbertos, num = qaPil.querySelector('.qa-n'), b = qaBotao(), ver = qaPil.querySelector('.qa-menu-ver');
  if (num) {
    num.textContent = qaNumeroCurto(n);
    if (n > 0) num.removeAttribute('hidden'); else num.setAttribute('hidden', '');
  }
  if (b) b.setAttribute('aria-label', qaRotuloDoBotao(n));
  if (ver) ver.innerHTML = ic('lista', 17) + ' ' + esc(qaRotuloVer(n));
  if (!qaArr && !qaAnim) qaReencaixar();
}

/* ------------------------------------------------- a etiqueta da 1.ª vez */

/* A etiqueta «Arrasta para mudar de sítio» ainda aparece? Até ao primeiro
   arrasto neste aparelho (localStorage); com o armazenamento vedado, até ao
   primeiro arrasto desta sessão.
   Devolve: true ou false. */
function qaEtiquetaVisivel() {
  if (qaArrastouAqui) return false;
  try { return localStorage.getItem(QA_LS_ARRASTOU) !== '1'; } catch (e) { return true; }
}

/* A pílula foi mudada de sítio pela primeira vez: a etiqueta desvanece
   (estilos.css, .qa-etiqueta.sai) e sai do documento, e não volta.
   Devolve: nada. */
function qaMarcarArrastado() {
  if (!qaEtiquetaVisivel()) return;
  qaArrastouAqui = true;
  try { localStorage.setItem(QA_LS_ARRASTOU, '1'); } catch (e) {}
  var et = qaPil && typeof qaPil.querySelector === 'function' ? qaPil.querySelector('.qa-etiqueta') : null;
  if (!et) return;
  if (semMovimento()) { try { et.remove(); } catch (e) {} return; }
  et.classList.add('sai');
  setTimeout(function () { try { et.remove(); } catch (e) {} }, msDoToken('--medio', 200) + 120);
}

/* --------------------------------------------------- a posição e o encaixe */

/* Onde a pílula pode estar, medido agora: a área segura (a sonda, que usa as
   --inset-* do :root) menos QA_MARGEM; à esquerda, a seguir à barra lateral
   quando ela é uma coluna (no computador); em baixo, acima da barra de baixo
   do telemóvel e da barra das ações da seleção, quando estão à vista.
   Devolve: {esq, dir, topo, fundo, pw, ph} em px — os limites e a largura e
   altura da pílula. */
function qaLimites() {
  var W = (document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 0;
  var H = window.innerHeight || 0;
  var seg = { left: 0, top: 0, right: W, bottom: H };
  if (qaSonda && typeof qaSonda.getBoundingClientRect === 'function') {
    var rs = qaSonda.getBoundingClientRect();
    if (rs && rs.width > 0 && rs.height > 0) seg = rs;
  }
  var cx = { esq: seg.left + QA_MARGEM, dir: seg.right - QA_MARGEM, topo: seg.top + QA_MARGEM, fundo: seg.bottom - QA_MARGEM };
  // nas páginas públicas um <aside> é um cartão do texto, não a barra lateral
  var aside = qaLugar() === 'paginas' ? null : document.querySelector('aside');
  if (aside && typeof aside.getBoundingClientRect === 'function') {
    var ra = aside.getBoundingClientRect(), fixo = false;
    try { fixo = getComputedStyle(aside).position === 'fixed'; } catch (e) {}
    if (!fixo && ra && ra.width > 0 && ra.right > 0 && ra.right < W / 2) cx.esq = Math.max(cx.esq, ra.right + QA_MARGEM);
  }
  [document.getElementById('tabbar'), document.querySelector('.sel-fundo')].forEach(function (barra) {
    if (!barra || typeof barra.getBoundingClientRect !== 'function') return;
    var r = barra.getBoundingClientRect();
    if (r && r.height > 0 && r.width > 0 && r.top < H && r.top > H / 2) cx.fundo = Math.min(cx.fundo, r.top - QA_MARGEM);
  });
  // com uma janela à frente (que não seja do QA), a pílula sobe acima dela e
  // fica acima do rodapé, para nunca tapar os botões que se pedem
  var janelas = document.querySelectorAll('.modal.open');
  var frente = janelas.length ? janelas[janelas.length - 1] : null;
  var pe = frente && !frente.classList.contains('qa-janela') ? frente.querySelector('.foot') : null;
  if (pe && typeof pe.getBoundingClientRect === 'function') {
    var rp = pe.getBoundingClientRect();
    if (rp && rp.height > 0 && rp.width > 0 && rp.top > H / 3) cx.fundo = Math.min(cx.fundo, rp.top - QA_MARGEM);
  }
  cx.pw = (qaPil && qaPil.offsetWidth) || 96;
  cx.ph = (qaPil && qaPil.offsetHeight) || 44;
  return cx;
}

/* O encaixe de um largar: a borda mais perto do centro da pílula, à altura
   onde ela ficou, presa entre o topo e o fundo. Geometria pura.
   Recebe: ponto — {x, y}, o canto de cima à esquerda da pílula ao largar;
   cx — os limites (qaLimites: {esq, dir, topo, fundo, pw, ph}).
   Devolve: {lado: 'esq'|'dir', fracao (0 a 1, da altura útil), x, y} — o
   sítio onde a pílula fica. */
function qaEncaixe(ponto, cx) {
  var centro = ponto.x + cx.pw / 2;
  var lado = centro < (cx.esq + cx.dir) / 2 ? 'esq' : 'dir';
  var yMax = Math.max(cx.topo, cx.fundo - cx.ph), faixa = yMax - cx.topo;
  var y = Math.min(Math.max(ponto.y, cx.topo), yMax);
  var fracao = faixa > 0 ? Math.round(((y - cx.topo) / faixa) * 10000) / 10000 : 0;
  return { lado: lado, fracao: fracao, x: lado === 'esq' ? cx.esq : cx.dir - cx.pw, y: y };
}

/* O sítio, em px, de uma posição guardada, nos limites de agora: é o que faz
   a posição sobreviver a rodar o ecrã e a encolher a janela.
   Recebe: pos — {lado, y (fração)}; cx — os limites (qaLimites).
   Devolve: {x, y} em px. */
function qaPosicaoDe(pos, cx) {
  var yMax = Math.max(cx.topo, cx.fundo - cx.ph);
  var f = Math.min(Math.max(Number(pos.y) || 0, 0), 1);
  return { x: pos.lado === 'esq' ? cx.esq : Math.max(cx.esq, cx.dir - cx.pw), y: cx.topo + (yMax - cx.topo) * f };
}

/* A posição guardada neste aparelho, validada; sem nenhuma (ou estragada), a
   inicial.
   Devolve: {lado, y}. */
function qaLerPosicao() {
  var p = null;
  try { p = JSON.parse(localStorage.getItem(QA_LS_POSICAO) || 'null'); } catch (e) { p = null; }
  if (!p || (p.lado !== 'esq' && p.lado !== 'dir') || typeof p.y !== 'number' || !isFinite(p.y)) {
    return { lado: QA_POSICAO_INICIAL.lado, y: QA_POSICAO_INICIAL.y };
  }
  return { lado: p.lado, y: Math.min(Math.max(p.y, 0), 1) };
}

/* Guarda a posição neste aparelho (sem armazenamento, fica só nesta sessão:
   a pílula está onde está).
   Recebe: pos — {lado, y}.
   Devolve: nada. */
function qaGuardarPosicao(pos) {
  try { localStorage.setItem(QA_LS_POSICAO, JSON.stringify({ lado: pos.lado, y: pos.y })); } catch (e) {}
}

/* Põe a pílula num sítio, sem animar: o transform do elemento (a CSP não
   deixa style= no HTML; o JavaScript escreve o transform direto).
   Recebe: xy — {x, y} em px; lado (opcional) — 'esq' ou 'dir', para a
   etiqueta e o menu abrirem para dentro do ecrã e a pega ficar virada para
   a borda (estilos.css, bloco «tickets de QA»). O arrasto não o passa: o
   lado só muda ao largar (qaArrastoFim), as setas e o reencaixe.
   Devolve: nada. */
function qaPor(xy, lado) {
  if (!qaPil) return;
  qaXY = { x: Math.round(xy.x), y: Math.round(xy.y) };
  qaPil.style.transform = qaTransform(qaXY);
  if (lado) qaPil.setAttribute('data-lado', lado);
}

/* O texto do transform de um sítio.
   Recebe: xy — {x, y} em px.
   Devolve: o texto 'translate3d(…)'. */
function qaTransform(xy) {
  return 'translate3d(' + Math.round(xy.x) + 'px,' + Math.round(xy.y) + 'px,0)';
}

/* Põe a pílula na posição guardada, nos limites de agora, sem animar (a
   criação, o render, mudar de tamanho, o número que muda a largura, as
   setas).
   Devolve: nada. */
function qaReencaixar() {
  if (!qaPil) return;
  var pos = qaLerPosicao();
  qaPor(qaPosicaoDe(pos, qaLimites()), pos.lado);
}

/* Onde a pílula está a ser desenhada agora, contando com a animação do
   encaixe que a estiver a levar (o transform calculado).
   Devolve: {x, y} em px. */
function qaOndeEsta() {
  var xy = qaXY || { x: 0, y: 0 };
  try {
    var t = getComputedStyle(qaPil).transform || '';
    var m3 = /matrix3d\(([^)]*)\)/.exec(t), m2 = /matrix\(([^)]*)\)/.exec(t);
    if (m3) { var a = m3[1].split(','); return { x: parseFloat(a[12]) || 0, y: parseFloat(a[13]) || 0 }; }
    if (m2) { var b = m2[1].split(','); return { x: parseFloat(b[4]) || 0, y: parseFloat(b[5]) || 0 }; }
  } catch (e) {}
  return xy;
}

/* Para a animação do encaixe onde ela estiver.
   Devolve: nada. */
function qaPararAnim() {
  var an = qaAnim;
  qaAnim = null;
  try { if (an) an.cancel(); } catch (e) {}
}

/* O encaixe ao largar: a pílula fica já no sítio final (o transform do
   elemento), e uma animação leva-a de onde o ponteiro a deixou até lá —
   pela API de animações, porque o ponto de partida só se sabe no fim do
   gesto, e pode ser apanhada a meio (qaPousar). Só o transform; o --medio na
   --curva-entra, que é a curva de quem atravessa distância, e o --lento
   quando atravessa o ecrã (mais de QA_LONGE). Sem movimento, fica logo lá.
   A pega troca de lado no primeiro fotograma deste deslizar, sem movimento
   próprio: o olho segue a pílula a andar, e uma segunda animação dentro
   dela só competiria com a do encaixe.
   Recebe: de — {x, y} onde a pílula está; para — {x, y} onde fica; lado — 'esq' ou 'dir'.
   Devolve: nada. */
function qaDeslizar(de, para, lado) {
  qaPararAnim();
  qaPor(para, lado);
  if (!qaPil || typeof qaPil.animate !== 'function' || semMovimento()) return;
  var dist = Math.sqrt(Math.pow(para.x - de.x, 2) + Math.pow(para.y - de.y, 2));
  if (dist < 1) return;
  var longe = dist > QA_LONGE, dur = longe ? msDoToken('--lento', 340) : msDoToken('--medio', 200);
  var an = qaPil.animate([{ transform: qaTransform(de) }, { transform: qaTransform(para) }],
    { duration: dur, easing: tokenTexto('--curva-entra', 'cubic-bezier(0,0,.2,1)') });
  qaAnim = an;
  var fim = function () { if (qaAnim === an) qaAnim = null; };
  an.onfinish = fim;
  // a rede de sempre: num separador escondido o onfinish não chega
  setTimeout(fim, dur + 120);
}

/* ------------------------------------------------------------- o arrasto */

/* O ponteiro pousou na pílula: fica-se à escuta do arrasto. Pegar nela a
   meio do encaixe apanha-a onde está, sem salto. Os botões do menu (dentro
   da pílula) não arrastam.
   Recebe: e — o PointerEvent do pointerdown (ouvido na pílula).
   Devolve: nada — liga os ouvintes do documento. */
function qaPousar(e) {
  if (!qaPil || qaArr || !e || e.button > 0 || e.isPrimary === false) return;
  var alvo = e.target;
  if (alvo && typeof alvo.closest === 'function' && !alvo.closest('.qa-botao')) return;
  qaPonteiro = e.pointerType || '';
  var xy = qaXY || { x: 0, y: 0 };
  if (qaAnim) { xy = qaOndeEsta(); qaPararAnim(); qaPor(xy); }
  qaArr = { id: e.pointerId, tipo: e.pointerType || '', x0: e.clientX, y0: e.clientY, ox: xy.x, oy: xy.y, ativo: false, cx: null };
  document.addEventListener('pointermove', qaArrastoMove);
  document.addEventListener('pointerup', qaArrastoFim);
  document.addEventListener('pointercancel', qaArrastoFim);
}

/* O ponteiro andou: passado o QA_LIMIAR, o gesto é um arrasto — a pílula
   segue o ponteiro (só o transform, sem transição), presa ao ecrã, o menu
   fecha-se e a etiqueta da primeira vez sai.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada. */
function qaArrastoMove(e) {
  var a = qaArr;
  if (!a || !e || e.pointerId !== a.id) return;
  var dx = e.clientX - a.x0, dy = e.clientY - a.y0;
  if (!a.ativo) {
    if (Math.sqrt(dx * dx + dy * dy) < QA_LIMIAR) return;
    a.ativo = true;
    a.cx = qaLimites();
    a.W = (document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 0;
    a.H = window.innerHeight || 0;
    try { qaPil.setPointerCapture(a.id); } catch (x) {}
    qaPil.classList.add('arrastar');
    if (typeof closePops === 'function') closePops();
    qaMarcarArrastado();
  }
  var x = Math.min(Math.max(a.ox + dx, 0), Math.max(0, a.W - a.cx.pw));
  var y = Math.min(Math.max(a.oy + dy, 0), Math.max(0, a.H - a.cx.ph));
  qaPor({ x: x, y: y });
}

/* Tira os ouvintes do documento e esquece o arrasto.
   Devolve: nada. */
function qaArrastoLargar() {
  document.removeEventListener('pointermove', qaArrastoMove);
  document.removeEventListener('pointerup', qaArrastoFim);
  document.removeEventListener('pointercancel', qaArrastoFim);
  qaArr = null;
}

/* O ponteiro saiu. Um toque (abaixo do limiar) não faz nada aqui: o clique
   que vem a seguir abre o menu. Um arrasto encaixa na borda mais perto e
   guarda a posição — também num pointercancel, para a pílula nunca ficar a
   flutuar no meio —, e o clique que o browser dá a seguir engole-se. Com o
   dedo ou a caneta, o foco que o toque deu à pílula larga-se, como no resto
   da app (eventos.js:largarFocoDoToque, que corre no clique engolido).
   Recebe: e — o PointerEvent do pointerup ou do pointercancel.
   Devolve: nada. */
function qaArrastoFim(e) {
  var a = qaArr;
  if (!a || (e && e.pointerId !== a.id)) return;
  qaArrastoLargar();
  if (!a.ativo || !qaPil) return;
  qaEngoleAte = Date.now() + QA_ENGOLE_MS;
  qaPil.classList.remove('arrastar');
  // o dedo não deixa foco (eventos.js:largarFocoDoToque): o clique que o largava foi engolido
  if (a.tipo !== 'mouse') { try { var f = document.activeElement; if (f && qaPil.contains(f)) f.blur(); } catch (x) {} }
  var cx = qaLimites(), de = qaXY || { x: a.ox, y: a.oy };
  var fim = qaEncaixe(de, cx);
  qaGuardarPosicao({ lado: fim.lado, y: fim.fracao });
  qaDeslizar(de, fim, fim.lado);
}

/* O clique que o browser dá a seguir a um arrasto da pílula não é um toque:
   não abre o menu nem carrega no que estiver por baixo. Ouvido no documento,
   na captura (corre antes da ação do botão).
   Recebe: e — o evento click.
   Devolve: true se o clique foi engolido. */
function qaEngoleClique(e) {
  if (!qaEngoleAte) return false;
  var engole = Date.now() < qaEngoleAte;
  qaEngoleAte = 0;
  if (engole && e) {
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  return engole;
}

/* As setas mudam a pílula de sítio sem rato: esquerda e direita trocam de
   borda, cima e baixo andam QA_PASSO_TECLA da altura útil. Sem animação —
   é uma ação de teclado. O Enter e o Espaço são do próprio botão (abrem o
   menu).
   Recebe: e — o evento keydown no botão da pílula.
   Devolve: true se a tecla era uma seta e mexeu na pílula. */
function qaTecla(e) {
  var k = e && e.key, pos = qaLerPosicao(), novo = null;
  if (k === 'ArrowLeft') novo = { lado: 'esq', y: pos.y };
  else if (k === 'ArrowRight') novo = { lado: 'dir', y: pos.y };
  else if (k === 'ArrowUp') novo = { lado: pos.lado, y: Math.max(0, pos.y - QA_PASSO_TECLA) };
  else if (k === 'ArrowDown') novo = { lado: pos.lado, y: Math.min(1, pos.y + QA_PASSO_TECLA) };
  if (!novo) return false;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  novo.y = Math.round(novo.y * 10000) / 10000;
  qaPonteiro = 'teclado';
  if (typeof closePops === 'function') closePops();
  qaGuardarPosicao(novo);
  qaMarcarArrastado();
  qaPararAnim();
  qaReencaixar();
  return true;
}

/* A janela mudou de tamanho (rodar o telemóvel, encolher o browser, o
   teclado do sistema): a pílula volta à posição guardada nos limites novos,
   uma vez por fotograma.
   Devolve: nada. */
function qaAoMudarTamanho() {
  if (!qaPil || qaTamanhoPedido) return;
  var faz = function () { qaTamanhoPedido = 0; if (qaPil && !qaArr) { qaPararAnim(); qaReencaixar(); } };
  qaTamanhoPedido = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(faz) : setTimeout(faz, 16);
}

/* --------------------------------------------------------------- o menu */

/* Depois do menuOpen: se o menu ficou aberto, guarda o ecrã de agora (o que
   vai com um ticket novo), marca para o CSS quando o menu se virou para cima
   (a origem da entrada), e pede o número por concluir.
   Recebe: e — o evento do clique (detail 0 quando veio do teclado).
   Devolve: nada. */
function qaMenuAbriu(e) {
  var m = document.getElementById('menu_qa');
  if (!m || !m.classList || !m.classList.contains('on')) return;
  if (e && e.detail === 0) qaPonteiro = 'teclado';
  qaContextoGuardado = qaContexto();
  try { if (m.style && m.style.bottom) m.setAttribute('data-cima', ''); else m.removeAttribute('data-cima'); } catch (x) {}
  qaCarregar();
}

/* ------------------------------------------------------------- o contexto */

/* O que vai junto com um ticket: o ecrã (separador, página das Definições,
   a ficha ou a janela de cima, o endereço), a versão, o ambiente, o tamanho
   do ecrã, o tema, o browser, o ponteiro, o rasto do que se fez antes e a
   hora. O que não se sabe fica de fora — nada se inventa. A ficha só se
   sabe quando a ficha aberta diz como se edita (o «Editar» dela chama uma
   função com o id: {tipo: o nome dessa função, id}).
   Devolve: o objeto do contexto (o do contrato C1). */
function qaContexto() {
  var c = {}, ecra = {};
  try { if (typeof tab !== 'undefined' && tab) ecra.tab = String(tab); } catch (e) {}
  try { if (typeof setPage !== 'undefined' && setPage) ecra.pagina = String(setPage); } catch (e) {}
  var L = typeof modalTop === 'function' ? modalTop() : null;
  ecra.ficha = L ? qaFichaDe(L) : null;
  ecra.modal = L && L.title ? String(L.title).slice(0, 140) : null;
  try { if (location.hash && location.hash !== '#') ecra.hash = String(location.hash).slice(0, 200); } catch (e) {}
  c.ecra = ecra;
  if (typeof VERSAO !== 'undefined' && VERSAO) c.versao = VERSAO;
  if (window.CW && CW.ambiente) c.ambiente = String(CW.ambiente);
  var w = window.innerWidth, h = window.innerHeight;
  if (w > 0 && h > 0) c.janela = { w: w, h: h, dpr: window.devicePixelRatio || 1 };
  try {
    if (typeof db !== 'undefined' && db && db.settings) {
      c.tema = { escolhido: db.settings.theme || 'auto', escuro: typeof isDark === 'function' ? !!isDark() : document.documentElement.classList.contains('dark') };
      /* o Samsung Internet escurece à força a página que se mostra clara
         (definicoes.js:notaDoSamsung): não se vê daqui, diz-se que pode */
      if (typeof eSamsungInternet === 'function' && eSamsungInternet() && !c.tema.escuro) c.tema.forcado = 'possivel';
    }
  } catch (e) {}
  try { if (navigator.userAgent) c.agente = String(navigator.userAgent).slice(0, 300); } catch (e) {}
  if (qaPonteiro) c.ponteiro = qaPonteiro;
  var rasto = window.CW && Array.isArray(CW._rasto) ? CW._rasto : [];
  if (rasto.length) c.rasto = rasto.slice(-QA_RASTO_MAX).map(function (s) { return String(s).slice(0, QA_RASTO_LETRAS); });
  c.quando = new Date().toISOString();
  return c;
}

/* A ficha que uma janela é, quando se sabe: o «Editar» de uma ficha
   (componentes.js:abrirFicha) chama uma função com o id do registo, e é daí
   que vem o par. Sem isso, null.
   Recebe: L — a camada da janela.
   Devolve: {tipo, id} ou null. */
function qaFichaDe(L) {
  var act = L && L.ficha && L.ficha.editar && L.ficha.editar.act;
  var m = typeof act === 'string' ? /^(\w+)\('([^']*)'\)$/.exec(act.trim()) : null;
  return m ? { tipo: m[1], id: m[2] } : null;
}

/* O contexto escrito para pessoas (a janela «Novo ticket», em «O que vai
   junto», e a de um ticket, em «Contexto»). Lê o que vier com cuidado: o
   contexto de um ticket foi escrito por outro aparelho, e pode trazer
   qualquer coisa.
   Recebe: c — o objeto do contexto (ou o que vier no lugar dele).
   Devolve: o HTML (texto). */
function qaHtmlContexto(c) {
  if (!c || typeof c !== 'object') return '<p class="hint">Este ticket não traz contexto.</p>';
  var e = c.ecra && typeof c.ecra === 'object' ? c.ecra : {}, linhas = [];
  var junta = function (rotulo, v) {
    if (v === undefined || v === null || v === '' || typeof v === 'object') return;
    linhas.push('<div class="stat"><span>' + esc(rotulo) + '</span><b>' + esc(String(v)) + '</b></div>');
  };
  junta('Separador', qaNomeDoSeparador(e.tab));
  junta('Página', e.pagina);
  if (e.ficha && typeof e.ficha === 'object') junta('Ficha', [e.ficha.tipo, e.ficha.id].filter(function (x) { return typeof x === 'string' && x; }).join(' · '));
  junta('Janela aberta', e.modal);
  junta('Endereço', e.hash);
  junta('Versão', c.versao);
  junta('Ambiente', c.ambiente);
  var j = c.janela;
  if (j && typeof j === 'object' && Number(j.w) > 0 && Number(j.h) > 0) junta('Ecrã', Number(j.w) + ' × ' + Number(j.h) + (Number(j.dpr) > 0 ? ' a ' + Number(j.dpr) + 'x' : ''));
  if (c.tema && typeof c.tema === 'object') junta('Tema', qaTemaLegivel(c.tema));
  junta('Ponteiro', qaPonteiroLegivel(c.ponteiro));
  junta('Browser', c.agente);
  var q = typeof c.quando === 'string' ? Date.parse(c.quando) : NaN;
  if (isFinite(q)) junta('Quando', qaQuando(q));
  var rasto = Array.isArray(c.rasto) ? c.rasto.filter(function (r) { return typeof r === 'string' && r; }) : [];
  return '<div class="form qa-ctx">' + linhas.join('') +
    (rasto.length ? '<div><div class="flabel">Últimos passos</div><ol class="qa-rasto">' +
      rasto.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ol></div>' : '') +
    (linhas.length || rasto.length ? '' : '<p class="hint">Este ticket não traz contexto.</p>') + '</div>';
}

/* O nome de um separador, como a barra o escreve (navegacao.js:TABS).
   Recebe: id — o id do separador (pode não ser texto).
   Devolve: o nome, o id se não for um separador conhecido, ou '' sem id. */
function qaNomeDoSeparador(id) {
  if (typeof id !== 'string' || !id) return '';
  var t = typeof TABS !== 'undefined' ? TABS.filter(function (x) { return x.id === id; })[0] : null;
  return t ? t.label : id;
}

/* O tema de um contexto, numa frase.
   Recebe: t — {escolhido, escuro, forcado}.
   Devolve: o texto. */
function qaTemaLegivel(t) {
  var esc0 = { light: 'Claro', dark: 'Escuro', auto: 'Automático' }[t.escolhido] || '';
  var ve = t.escuro === true ? 'a mostrar escuro' : t.escuro === false ? 'a mostrar claro' : '';
  var txt = [esc0, ve].filter(Boolean).join(', ');
  if (t.forcado) txt += (txt ? '; ' : '') + 'o Samsung Internet pode estar a escurecer a página';
  return txt;
}

/* O ponteiro de um contexto, em português.
   Recebe: p — 'touch', 'mouse', 'pen', 'teclado' ou outra coisa.
   Devolve: o texto ('' sem ponteiro). */
function qaPonteiroLegivel(p) {
  if (typeof p !== 'string' || !p) return '';
  return { touch: 'Dedo', mouse: 'Rato', pen: 'Caneta', teclado: 'Teclado' }[p] || p;
}

/* Uma hora da base (ms), como se lê em Portugal: «28/10/2026 às 14:03», na
   hora local.
   Recebe: ms — o instante em milissegundos.
   Devolve: o texto ('' se não for um instante). */
function qaQuando(ms) {
  var n = Number(ms);
  if (!isFinite(n) || n <= 0) return '';
  var d = new Date(n), p2 = function (x) { return String(x).padStart(2, '0'); };
  return dPT(d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())) + ' às ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}

/* ----------------------------------------------------------- novo ticket */

/* Abre a janela «Novo ticket de QA» (folha de baixo no telemóvel): a
   descrição obrigatória, a gravidade opcional, a captura de ecrã (escolher,
   ou colar com Ctrl+V em qualquer sítio da janela), os anexos (KAN-165:
   imagens e documentos, até dez) e o que vai junto, já à vista. O contexto é o do ecrã de quando se abriu o menu — com a janela já
   aberta, seria o da própria janela.
   Devolve: nada — abre a janela. */
function qaNovoTicket() {
  var ctx = qaContextoGuardado || qaContexto();
  var r = { gravidade: '', imagem: null, url: '', id: '', aEnviar: false, contexto: ctx, camada: null, anexos: [], imagemSubiu: false };
  qaRascunho = r;
  var L = openModal('Novo ticket de QA', qaHtmlNovo(ctx),
    '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>' +
    '<button type="button" class="btn primary" id="qa_enviar" data-toca="dados" data-click="qaEnviar()">Enviar ticket</button>');
  r.camada = L || null;
  if (!L) return;
  qaMarcarJanela(L);
  L.aoFechar = function () {
    if (r.url) { try { URL.revokeObjectURL(r.url); } catch (e) {} r.url = ''; }
    qaLargarEscolhidos(r.anexos);
    if (qaRascunho === r) qaRascunho = null;
  };
  if (L.el && typeof L.el.addEventListener === 'function') L.el.addEventListener('paste', qaColar);
}

/* O corpo da janela «Novo ticket de QA».
   Recebe: ctx — o contexto que vai junto.
   Devolve: o HTML (texto). */
function qaHtmlNovo(ctx) {
  var opcao = function (v, rotulo) {
    return '<button type="button" role="radio" aria-checked="' + (v === '' ? 'true' : 'false') + '" data-g="' + v + '" data-toca="rascunho" data-click="qaGravidade(\'' + v + '\')">' + rotulo + '</button>';
  };
  return '<div class="form qa-form">' +
    '<div class="qa-campo"><label>Descrição <span class="req">*</span>' +
      '<textarea id="qa_desc" class="u-minh-130px" maxlength="4000" data-input="qaDescEscrita(this)" ' +
      'placeholder="Ex: Na lista dos contratos, tocar no filtro do imóvel fecha a janela em vez de a abrir."></textarea></label>' +
      '<span class="small qa-conta" id="qa_desc_n" aria-hidden="true">0 / 4000</span>' +
      '<div class="hint">O que fizeste, o que esperavas e o que aconteceu.</div></div>' +
    '<div><div class="flabel" id="qa_grav_rot">Gravidade</div>' +
      '<div class="segm qa-gravidade" role="radiogroup" aria-labelledby="qa_grav_rot">' + opcao('', 'Nenhuma') +
        QA_GRAVIDADES.map(function (g) { return opcao(g.v, g.rotulo); }).join('') + '</div></div>' +
    '<div class="qa-captura"><div class="flabel">Captura de ecrã</div>' +
      '<div id="qa_img">' + qaHtmlImagem('') + '</div>' +
      '<p class="erro-campo" id="qa_img_erro" role="alert"></p>' +
      '<input type="file" id="qa_img_in" accept="image/png,image/jpeg,image/webp,image/gif" class="u-d-none" data-change="qaEscolheuImagem(this)">' +
      '<input type="hidden" id="qa_img_tem" value=""></div>' +
    qaHtmlCaixaAnexos('novo') +
    fold('qaJunto', 'O que vai junto', '<p class="hint">Vai com o ticket, para quem o for resolver saber onde estavas. Quem o escreveu fica guardado com ele.</p>' + qaHtmlContexto(ctx), { icon: 'info' }) +
    '<div id="qa_e" class="small u-c-v-danger" role="alert"></div>' +
    '</div>';
}

/* A caixa da captura: sem imagem, o botão de escolher e a dica de colar;
   com ela, a pré-visualização e «Remover»; a preparar, a roda.
   Recebe: url — o object URL da imagem ('' sem imagem; 'a-preparar' enquanto encolhe).
   Devolve: o HTML (texto). */
function qaHtmlImagem(url) {
  if (url === 'a-preparar') return '<div class="qa-preparar"><span class="roda" aria-hidden="true"></span><span>A preparar a imagem…</span></div>';
  if (url) {
    return '<div class="qa-previa"><img src="' + esc(url) + '" alt="A captura de ecrã que vai com o ticket">' +
      '<button type="button" class="btn sm" data-toca="rascunho" data-click="qaRemoverImagem()">' + ic('trash', 14) + ' Remover</button></div>';
  }
  return '<button type="button" class="btn sm" data-toca="rascunho" data-click="abrirSeletorFicheiros(\'qa_img_in\')">' + ic('photo', 14) + ' Escolher imagem</button>' +
    '<p class="hint qa-colar">Ou cola-a aqui com Ctrl+V. Antes de subir, fica mais leve.</p>';
}

/* O contador de caracteres da descrição.
   Recebe: el — a caixa de texto (o this da ação).
   Devolve: nada. */
function qaDescEscrita(el) {
  var n = document.getElementById('qa_desc_n');
  if (n && el) n.textContent = String(el.value || '').length + ' / 4000';
}

/* Escolhe a gravidade no segmentado (vazio quer dizer nenhuma).
   Recebe: v — '', 'bloqueia', 'incomoda' ou 'detalhe'.
   Devolve: nada — marca a escolha (aria-checked) na janela. */
function qaGravidade(v) {
  if (!qaRascunho) return;
  var ok = v === '' || QA_GRAVIDADES.some(function (g) { return g.v === v; });
  if (!ok) return;
  qaRascunho.gravidade = v;
  var corpo = typeof modalBodyEl === 'function' ? modalBodyEl() : null;
  if (!corpo || typeof corpo.querySelectorAll !== 'function') return;
  [].slice.call(corpo.querySelectorAll('.qa-gravidade [role="radio"]')).forEach(function (b) {
    b.setAttribute('aria-checked', b.getAttribute('data-g') === v ? 'true' : 'false');
  });
}

/* A imagem escolhida no seletor de ficheiros.
   Recebe: input — o <input type="file"> (o this da ação).
   Devolve: nada. */
function qaEscolheuImagem(input) {
  var f = input && input.files && input.files[0];
  try { input.value = ''; } catch (e) {}
  if (f) qaReceberImagem(f);
}

/* Colar (Ctrl+V) na janela «Novo ticket»: se o que se cola traz uma imagem,
   é a captura — ou, com a captura já posta, mais um anexo (qaJuntarAnexos);
   texto cola-se na caixa como sempre.
   Recebe: e — o ClipboardEvent do paste (ouvido na janela).
   Devolve: true se tinha uma imagem. */
function qaColar(e) {
  var dados = e && e.clipboardData;
  if (!dados || !qaRascunho) return false;
  var f = qaImagemColada(dados);
  if (!f) return false;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  if (qaRascunho.imagem) qaJuntarAnexos('novo', [f]);
  else qaReceberImagem(f);
  return true;
}

/* A imagem que vem num colar (Ctrl+V), nos ficheiros ou nos itens.
   Recebe: dados — o clipboardData.
   Devolve: o File, ou null sem imagem. */
function qaImagemColada(dados) {
  var f = null;
  [].slice.call(dados.files || []).some(function (x) { if (x && /^image\//.test(x.type)) { f = x; return true; } return false; });
  if (!f) {
    [].slice.call(dados.items || []).some(function (it) {
      if (it && it.kind === 'file' && /^image\//.test(it.type)) { f = it.getAsFile(); return !!f; }
      return false;
    });
  }
  return f || null;
}

/* Uma imagem chegou (escolhida ou colada): encolhe-a (qaEncolherImagem) e
   mostra-a; se não der, diz porquê junto da caixa.
   Recebe: f — o File ou Blob.
   Devolve: Promise que acaba quando a imagem está pronta (ou recusada). */
function qaReceberImagem(f) {
  var r = qaRascunho;
  if (!r || !f) return Promise.resolve(false);
  qaErroImagem('');
  if (!/^image\//.test(f.type || '')) { qaErroImagem('Isso não é uma imagem. Escolhe um PNG, um JPEG ou um WebP.'); return Promise.resolve(false); }
  qaPintarImagem('a-preparar');
  return qaEncolherImagem(f).then(function (blob) {
    if (qaRascunho !== r) return false;
    qaPorImagem(blob);
    return true;
  }, function (err) {
    if (qaRascunho !== r) return false;
    qaPintarImagem(r.url);
    qaErroImagem((err && err.message) || 'Não deu para ler esta imagem.');
    return false;
  });
}

/* Encolhe uma imagem para subir: o lado maior até QA_IMAGEM_LADO, em WebP
   (JPEG onde o browser não escreve WebP), e abaixo do teto do servidor.
   Nunca amplia. Sem o createImageBitmap, ou com uma imagem que ele não lê,
   sobe a original se for de um tipo aceite e couber.
   Recebe: f — o File ou Blob da imagem; teto (opcional) — os bytes que
   cabem (QA_IMAGEM_MAX na captura, QA_ANEXO_MAX num anexo).
   Devolve: Promise com o Blob pronto; rejeita com um Error de mensagem
   para a pessoa. */
function qaEncolherImagem(f, teto) {
  var max = teto || QA_IMAGEM_MAX;
  var original = function () {
    if (/^image\/(png|jpeg|webp)$/.test(f.type || '') && f.size <= max) return f;
    throw new Error(f.size > max ? 'A imagem é grande de mais. Escolhe uma até ' + Math.round(max / 1048576) + ' MB.' : 'Esta imagem não se deixa ler. Experimenta um PNG, um JPEG ou um WebP.');
  };
  if (typeof createImageBitmap !== 'function') return Promise.resolve().then(original);
  return createImageBitmap(f).then(function (bm) {
    var k = Math.min(1, QA_IMAGEM_LADO / Math.max(bm.width || 1, bm.height || 1));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bm.width * k)); c.height = Math.max(1, Math.round(bm.height * k));
    var g = typeof c.getContext === 'function' ? c.getContext('2d') : null;
    if (!g || typeof c.toBlob !== 'function') { try { bm.close(); } catch (e) {} return original(); }
    g.drawImage(bm, 0, 0, c.width, c.height);
    try { bm.close(); } catch (e) {}
    var cabe = function (b, tipo) { return !!b && b.size > 0 && b.size <= max && (!tipo || b.type === tipo); };
    return qaCanvasBlob(c, 'image/webp', 0.85).then(function (b) {
      if (cabe(b, 'image/webp')) return b;
      return qaCanvasBlob(c, 'image/jpeg', 0.82).then(function (j) {
        if (cabe(j)) return j;
        return qaCanvasBlob(c, 'image/jpeg', 0.6).then(function (j2) { return cabe(j2) ? j2 : original(); });
      });
    });
  }, function () { return original(); });
}

/* O toBlob de um canvas, numa promessa.
   Recebe: c — o canvas; tipo — o tipo pedido; q — a qualidade.
   Devolve: Promise com o Blob (ou null se o browser não deu nenhum). */
function qaCanvasBlob(c, tipo, q) {
  return new Promise(function (ok) { try { c.toBlob(function (b) { ok(b || null); }, tipo, q); } catch (e) { ok(null); } });
}

/* A captura passa a ser esta: pré-visualiza, marca a janela como mexida (o
   fecho por abandono pergunta) e liberta a anterior.
   Recebe: blob — a imagem já encolhida.
   Devolve: nada. */
function qaPorImagem(blob) {
  var r = qaRascunho;
  if (!r) return;
  if (r.url) { try { URL.revokeObjectURL(r.url); } catch (e) {} }
  r.imagem = blob;
  r.url = '';
  try { r.url = URL.createObjectURL(blob); } catch (e) {}
  qaPintarImagem(r.url || '');
  var tem = document.getElementById('qa_img_tem');
  if (tem) tem.value = '1';
  if (r.camada) r.camada.tocado = true;
}

/* Remove a captura do ticket que se está a escrever.
   Devolve: nada. */
function qaRemoverImagem() {
  var r = qaRascunho;
  if (!r) return;
  if (r.url) { try { URL.revokeObjectURL(r.url); } catch (e) {} }
  r.imagem = null; r.url = '';
  qaPintarImagem('');
  qaErroImagem('');
  var tem = document.getElementById('qa_img_tem');
  if (tem) tem.value = '';
}

/* Repinta a caixa da captura (#qa_img).
   Recebe: url — o que o qaHtmlImagem recebe.
   Devolve: nada. */
function qaPintarImagem(url) {
  var caixa = document.getElementById('qa_img');
  if (caixa) caixa.innerHTML = qaHtmlImagem(url);
}

/* Escreve (ou apaga) o erro da captura, por baixo da caixa.
   Recebe: msg — a frase ('' apaga).
   Devolve: nada. */
function qaErroImagem(msg) {
  var p = document.getElementById('qa_img_erro');
  if (p) p.textContent = msg || '';
}

/* O botão de enviar diz o que está a acontecer: «A enviar…» (desligado)
   durante o pedido; depois de o ticket já estar guardado e só a imagem ter
   falhado, «Enviar a imagem»; e só os anexos, «Enviar os anexos».
   Recebe: ocupado — true durante o envio.
   Devolve: nada. */
function qaBotaoEnviar(ocupado) {
  var b = document.getElementById('qa_enviar'), r = qaRascunho;
  if (!b) return;
  b.disabled = !!ocupado;
  if (ocupado) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
  b.textContent = ocupado ? 'A enviar…' : (r && r.id ? (r.imagem && !r.imagemSubiu ? 'Enviar a imagem' : 'Enviar os anexos') : 'Enviar ticket');
}

/* Envia o ticket: a descrição (obrigatória: componentes.js:falhaCampo), a
   gravidade e o contexto num POST, depois a captura num PUT e, a seguir, os
   anexos, um a um (qaSubirEscolhidos). Se o ticket ficou guardado e só a
   imagem ou algum anexo falhou, a janela fica aberta, a dizê-lo, e «Enviar
   a imagem» (ou «Enviar os anexos») tenta outra vez só o que falta (nunca
   um ticket repetido, nem um anexo que já subiu). Com uma imagem ainda a
   preparar, espera-se por ela. Com tudo certo fecha e avisa, e o número
   por concluir atualiza-se.
   Devolve: Promise com true se o ticket ficou enviado por inteiro. */
function qaEnviar() {
  var r = qaRascunho;
  if (!r || r.aEnviar) return Promise.resolve(false);
  var erro = document.getElementById('qa_e');
  if (erro) erro.textContent = '';
  var texto = String(val('qa_desc') || '').trim();
  if (!r.id && !texto) { falhaCampo('qa_desc', 'Escreve o que viste.'); return Promise.resolve(false); }
  if (qaAPreparar(r.anexos)) { qaErroAnexos('novo', 'Espera que as imagens fiquem prontas.'); return Promise.resolve(false); }
  r.aEnviar = true;
  qaBotaoEnviar(true);
  var criar = r.id ? Promise.resolve({ id: r.id }) :
    api('POST', '/api/qa', { body: texto, severity: r.gravidade || null, context: r.contexto });
  return criar.then(function (res) {
    if (!res || !res.id) throw new Error('O servidor não devolveu o ticket.');
    r.id = res.id;
    var desc = document.getElementById('qa_desc');
    if (desc) desc.readOnly = true;
    if (!r.imagem || r.imagemSubiu) return true;
    return qaSubirImagem(r.id, r.imagem).then(function () { r.imagemSubiu = true; return true; }, function (e) { e.daImagem = true; throw e; });
  }).then(function () {
    return qaSubirEscolhidos(r.id, r.anexos, null, 'novo');
  }).then(function (falha) {
    if (falha) { var e = new Error(falha); e.dosAnexos = true; throw e; }
    r.aEnviar = false;
    var aberta = r.camada && typeof modalStack !== 'undefined' && modalStack.indexOf(r.camada) > -1;
    if (aberta && modalTop() === r.camada) closeModal();
    if (qaRascunho === r) qaRascunho = null;
    var n = r.anexos.length;
    toast('Ticket enviado' + (r.imagem ? ', com a captura' : '') + (n ? (r.imagem ? ' e ' : ', com ') + (n === 1 ? 'um anexo' : n + ' anexos') : '') + '.');
    qaCarregar();
    return true;
  }).catch(function (e) {
    r.aEnviar = false;
    qaBotaoEnviar(false);
    var msg = (e && e.message) || 'Não deu para enviar.';
    if (e && e.daImagem) {
      msg = 'O ticket ficou guardado, mas a captura não subiu: ' + msg + ' Toca em «Enviar a imagem» para tentar outra vez.';
      qaCarregar();
    } else if (e && e.dosAnexos) {
      msg = 'O ticket ficou guardado, mas ' + msg + ' Toca em «Enviar os anexos» para tentar outra vez.';
      qaCarregar();
    }
    var el = document.getElementById('qa_e');
    if (el) el.textContent = msg;
    else toast(msg);
    return false;
  });
}

/* Sobe a captura de um ticket (PUT /api/qa/:id/imagem), com os bytes no
   corpo e o tipo no Content-Type, como os anexos (cloud/anexos.js:subirAnexo).
   Recebe: id — o id do ticket; blob — a imagem.
   Devolve: Promise que resolve em true; rejeita com um Error com a frase do
   servidor (ou «Sem ligação ao servidor.»). */
function qaSubirImagem(id, blob) {
  var h = typeof cabecalhosDaSessao === 'function' ? cabecalhosDaSessao() : {};
  h['Content-Type'] = blob.type || 'application/octet-stream';
  var caminho = '/api/qa/' + encodeURIComponent(id) + '/imagem';
  return fetch(caminho, { method: 'PUT', headers: h, body: blob, credentials: 'same-origin' })
    .then(function (resp) {
      if (typeof rastoPoe === 'function') rastoPoe('PUT /api/qa/…/imagem → ' + resp.status);
      if (resp.ok) return true;
      return Promise.resolve(typeof resp.json === 'function' ? resp.json() : {}).catch(function () { return {}; }).then(function (j) {
        var e = new Error((j && j.error) || ('Erro ' + resp.status + '.'));
        e.status = resp.status;
        throw e;
      });
    }, function () {
      if (typeof rastoPoe === 'function') rastoPoe('PUT /api/qa/…/imagem → sem rede');
      throw new Error('Sem ligação ao servidor.');
    });
}

/* ----------------------------------------------------------- os anexos */

/* Os anexos (KAN-165: «Devo poder anexar imagens ou documentos aos tickets
   no pill. Responder a tickets com imagens ou ficheiros.»): no «Novo
   ticket» (onde: 'novo', em qaRascunho.anexos) e na resposta de um ticket
   aberto (onde: 'com', em qaCamadaTicket.qaEscolhidos) escolhem-se até dez
   ficheiros — imagens, encolhidas aqui como a captura (qaEncolherImagem), e
   PDF, Word, Excel, PowerPoint, texto e CSV até 10 MB —, que sobem um a um
   para o cartão do ticket no kanban (PUT /api/qa/:id/anexos; o servidor lê
   o tipo dos bytes, rotas/kanban.js:ficheiroDoPedido). Cada escolhido é
   {chave, ficheiro (o Blob a subir), nome, tamanho, imagem (bool), url (a
   miniatura, object URL), estado ('a-preparar', 'pronto', 'subiu' ou
   'falhou'), erro}. */

/* A lista dos escolhidos de um sítio.
   Recebe: onde — 'novo' ou 'com'.
   Devolve: a lista (vazia quando o sítio não está aberto). */
function qaEscolhidosDe(onde) {
  if (onde === 'novo') return qaRascunho ? qaRascunho.anexos : [];
  var L = qaCamadaTicket;
  if (!L) return [];
  if (!Array.isArray(L.qaEscolhidos)) L.qaEscolhidos = [];
  return L.qaEscolhidos;
}

/* A caixa dos anexos de um sítio, nasce com a janela: o rótulo (no «Novo
   ticket»), os escolhidos (qaHtmlEscolhidos), o erro e o seletor escondido.
   Recebe: onde — 'novo' ou 'com'.
   Devolve: o HTML (texto). */
function qaHtmlCaixaAnexos(onde) {
  var p = onde === 'novo' ? 'qa_anx' : 'qa_com_anx';
  return '<div class="qa-anexar' + (onde === 'novo' ? '' : ' qa-anexar-com') + '">' +
    (onde === 'novo' ? '<div class="flabel" id="qa_anx_rot">Anexos</div>' : '') +
    '<div id="' + p + '">' + qaHtmlEscolhidos(onde) + '</div>' +
    '<p class="erro-campo" id="' + p + '_erro" role="alert"></p>' +
    '<input type="file" id="' + p + '_in" multiple accept="' + QA_ANEXOS_ACEITA + '" class="u-d-none" data-change="qaEscolheuAnexos(this,\'' + onde + '\')">' +
    '</div>';
}

/* Os escolhidos de um sítio, cada um com a miniatura (uma imagem) ou o
   ícone do ficheiro, o nome, o tipo e o tamanho (ou «A preparar…», ou o
   erro), e «Remover»; no «Novo ticket», por baixo, «Anexar ficheiros» e o
   que se aceita (na resposta, o «Anexar» vive ao lado do «Comentar»).
   Recebe: onde — 'novo' ou 'com'.
   Devolve: o HTML (texto). */
function qaHtmlEscolhidos(onde) {
  var lista = qaEscolhidosDe(onde), seletor = onde === 'novo' ? 'qa_anx_in' : 'qa_com_anx_in';
  var itens = lista.length ? '<ul class="qa-escolhidos" aria-label="Ficheiros a anexar">' + lista.map(function (a) {
    var meta = a.estado === 'a-preparar' ? 'A preparar…' : a.estado === 'falhou' ? (a.erro || 'Não subiu.') : a.estado === 'subiu' ? 'Anexado' : qaMetaDoAnexo(a.nome, a.tamanho);
    return '<li class="qa-escolhido' + (a.estado === 'falhou' ? ' falhou' : '') + '">' +
      (a.imagem && a.url ? '<img class="qa-escolhido-mini" src="' + esc(a.url) + '" alt="">' : '<span class="qa-escolhido-ic" aria-hidden="true">' + (a.estado === 'a-preparar' ? '<span class="roda"></span>' : ic(a.imagem ? 'photo' : 'contract', 18)) + '</span>') +
      '<span class="qa-escolhido-txt"><span class="qa-escolhido-nome">' + esc(a.nome) + '</span><span class="small">' + esc(meta) + '</span></span>' +
      (a.estado === 'subiu' ? '' : '<button type="button" class="qa-escolhido-x" data-toca="rascunho" data-click="qaRemoverEscolhido(\'' + onde + '\',\'' + jsq(a.chave) + '\')" aria-label="Remover ' + esc(a.nome) + '">' + ic('x', 16) + '</button>') +
      '</li>';
  }).join('') + '</ul>' : '';
  if (onde !== 'novo') return itens;
  return itens + '<button type="button" class="btn sm" data-toca="rascunho" data-click="abrirSeletorFicheiros(\'' + seletor + '\')"' +
    (lista.length >= QA_ANEXOS_ENVIO ? ' disabled' : '') + '>' + ic('clip', 14) + ' Anexar ficheiros</button>' +
    '<p class="hint">Imagens, PDF, Word, Excel, PowerPoint, texto ou CSV, até 10 MB cada e ' + QA_ANEXOS_ENVIO + ' de uma vez.</p>';
}

/* O tipo e o tamanho de um anexo, numa linha curta: «PDF · 120 KB».
   Recebe: nome — o nome do ficheiro; tamanho — em bytes.
   Devolve: o texto. */
function qaMetaDoAnexo(nome, tamanho) {
  var m = /\.([A-Za-z0-9]{1,5})$/.exec(String(nome || ''));
  var tipo = m && QA_NOMES_DOS_FICHEIROS[m[1].toLowerCase()] ? QA_NOMES_DOS_FICHEIROS[m[1].toLowerCase()] : 'Ficheiro';
  return tipo + ' · ' + qaTamanhoLegivel(tamanho);
}

/* Um tamanho em bytes para ler: KB abaixo de 1 MB (pelo menos 1), MB com uma casa.
   Recebe: n — os bytes.
   Devolve: o texto («120 KB», «2,4 MB»). */
function qaTamanhoLegivel(n) {
  n = Number(n) || 0;
  if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
  return (Math.round(n / 104857.6) / 10).toString().replace('.', ',') + ' MB';
}

/* O nome de uma imagem depois de encolhida: a extensão passa a ser a do
   tipo novo (foto.heic que saiu em WebP fica foto.webp).
   Recebe: nome — o nome original; tipo — o tipo do Blob.
   Devolve: o nome. */
function qaNomeComTipo(nome, tipo) {
  var ext = tipo === 'image/webp' ? 'webp' : tipo === 'image/jpeg' ? 'jpg' : tipo === 'image/png' ? 'png' : '';
  var base = String(nome || 'imagem').replace(/\.[A-Za-z0-9]{1,5}$/, '') || 'imagem';
  return ext ? base + '.' + ext : String(nome || 'imagem');
}

/* Ficheiros escolhidos no seletor.
   Recebe: input — o <input type="file" multiple> (o this da ação); onde — 'novo' ou 'com'.
   Devolve: nada. */
function qaEscolheuAnexos(input, onde) {
  var fs = input && input.files ? [].slice.call(input.files) : [];
  try { input.value = ''; } catch (e) {}
  if (fs.length) qaJuntarAnexos(onde, fs);
}

/* Junta ficheiros aos escolhidos de um sítio: as imagens encolhem-se (até
   o lado maior ter QA_IMAGEM_LADO, abaixo de QA_ANEXO_MAX), os documentos
   vão como estão. Recusa logo, junto da caixa, o que passa das dez de uma
   vez, o que não é de um tipo aceite (pela extensão; o servidor confirma
   pelos bytes) e um documento acima de 10 MB.
   Recebe: onde — 'novo' ou 'com'; fs — os File (ou Blob com nome).
   Devolve: Promise que acaba quando as imagens estão prontas. */
function qaJuntarAnexos(onde, fs) {
  var lista = qaEscolhidosDe(onde), dono = onde === 'novo' ? qaRascunho : qaCamadaTicket;
  if (!dono) return Promise.resolve(false);
  var recusas = [], esperas = [];
  qaErroAnexos(onde, '');
  (fs || []).forEach(function (f) {
    if (!f) return;
    var nome = String(f.name || 'imagem');
    var imagem = /^image\//.test(f.type || '') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(nome);
    if (lista.filter(function (a) { return a.estado !== 'subiu'; }).length >= QA_ANEXOS_ENVIO) { recusas.push('Vão até ' + QA_ANEXOS_ENVIO + ' ficheiros de cada vez.'); return; }
    if (!imagem && !QA_EXT_DOCUMENTO.test(nome)) { recusas.push('«' + nome + '» não entra: aceitam-se imagens, PDF, Word, Excel, PowerPoint, texto e CSV.'); return; }
    if (!imagem && f.size > QA_ANEXO_MAX) { recusas.push('«' + nome + '» é grande de mais (máx. 10 MB).'); return; }
    var a = { chave: 'a' + (++QA_SEQ_ANEXO), ficheiro: imagem ? null : f, nome: nome, tamanho: f.size || 0, imagem: imagem, url: '', estado: imagem ? 'a-preparar' : 'pronto', erro: '' };
    lista.push(a);
    if (!imagem) return;
    esperas.push(qaEncolherImagem(f, QA_ANEXO_MAX).then(function (blob) {
      if (lista.indexOf(a) < 0) return;
      a.ficheiro = blob; a.tamanho = blob.size; a.nome = qaNomeComTipo(nome, blob.type); a.estado = 'pronto';
      try { a.url = URL.createObjectURL(blob); } catch (e) { a.url = ''; }
      qaPintarEscolhidos(onde);
    }, function (err) {
      var i = lista.indexOf(a);
      if (i > -1) lista.splice(i, 1);
      qaPintarEscolhidos(onde);
      qaErroAnexos(onde, '«' + nome + '»: ' + ((err && err.message) || 'não deu para ler esta imagem.'));
    }));
  });
  if (onde === 'novo' && dono.camada && lista.length) dono.camada.tocado = true;
  qaPintarEscolhidos(onde);
  if (recusas.length) qaErroAnexos(onde, recusas.filter(function (x, i) { return recusas.indexOf(x) === i; }).join(' '));
  return Promise.all(esperas).then(function () { return true; });
}

/* Tira um escolhido (ainda por subir) de um sítio, e larga a miniatura dele.
   Recebe: onde — 'novo' ou 'com'; chave — a do escolhido.
   Devolve: nada. */
function qaRemoverEscolhido(onde, chave) {
  var lista = qaEscolhidosDe(onde);
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].chave !== chave) continue;
    qaLargarEscolhidos(lista.splice(i, 1));
    break;
  }
  qaErroAnexos(onde, '');
  qaPintarEscolhidos(onde);
  if (onde === 'com') qaBotaoComentar(false);
}

/* Liberta as miniaturas de uns escolhidos (os object URL).
   Recebe: lista — os escolhidos.
   Devolve: nada. */
function qaLargarEscolhidos(lista) {
  (lista || []).forEach(function (a) { if (a && a.url) { try { URL.revokeObjectURL(a.url); } catch (e) {} a.url = ''; } });
}

/* Há uma imagem ainda a encolher?
   Recebe: lista — os escolhidos.
   Devolve: true ou false. */
function qaAPreparar(lista) {
  return (lista || []).some(function (a) { return a.estado === 'a-preparar'; });
}

/* Repinta os escolhidos de um sítio, se a caixa estiver no ecrã.
   Recebe: onde — 'novo' ou 'com'.
   Devolve: nada. */
function qaPintarEscolhidos(onde) {
  var caixa = document.getElementById(onde === 'novo' ? 'qa_anx' : 'qa_com_anx');
  if (caixa) caixa.innerHTML = qaSemEtiquetas(qaHtmlEscolhidos(onde));
}

/* Escreve (ou apaga) o erro dos anexos de um sítio, por baixo da caixa.
   Recebe: onde — 'novo' ou 'com'; msg — a frase ('' apaga).
   Devolve: nada. */
function qaErroAnexos(onde, msg) {
  var p = document.getElementById(onde === 'novo' ? 'qa_anx_erro' : 'qa_com_anx_erro');
  if (p) p.textContent = msg || '';
}

/* Sobe os escolhidos que ainda não subiram, um de cada vez, para o cartão
   do item (qaSubirAnexo), com o id do comentário numa resposta. Cada um
   fica 'subiu' ou 'falhou' (com a frase do servidor), e a caixa repinta-se.
   Recebe: id — o id do item; lista — os escolhidos; comentarioId — o do
   comentário (ou null); onde — 'novo' ou 'com' (para repintar).
   Devolve: Promise com '' quando subiram todos, ou a frase do que falhou. */
function qaSubirEscolhidos(id, lista, comentarioId, onde) {
  var porSubir = (lista || []).filter(function (a) { return a.estado !== 'subiu' && a.ficheiro; });
  var falhas = [];
  return porSubir.reduce(function (p, a) {
    return p.then(function () {
      return qaSubirAnexo(id, a, comentarioId).then(function () { a.estado = 'subiu'; a.erro = ''; }, function (e) {
        a.estado = 'falhou'; a.erro = (e && e.message) || 'Não subiu.';
        falhas.push(a);
      }).then(function () { qaPintarEscolhidos(onde); });
    });
  }, Promise.resolve()).then(function () {
    if (!falhas.length) return '';
    return (falhas.length === 1 ? 'o anexo «' + falhas[0].nome + '» não subiu: ' : falhas.length + ' anexos não subiram: ') + falhas[0].erro;
  });
}

/* Sobe um anexo para o cartão do item (PUT /api/qa/:id/anexos), com os
   bytes no corpo, o nome no X-Nome e, numa resposta, o comentário no
   X-Comentario, como a captura (qaSubirImagem).
   Recebe: id — o id do item; a — o escolhido; comentarioId — o do comentário (ou null).
   Devolve: Promise com o anexo que o servidor devolveu; rejeita com um Error
   com a frase do servidor (ou «Sem ligação ao servidor.»). */
function qaSubirAnexo(id, a, comentarioId) {
  var h = typeof cabecalhosDaSessao === 'function' ? cabecalhosDaSessao() : {};
  h['Content-Type'] = (a.ficheiro && a.ficheiro.type) || 'application/octet-stream';
  h['X-Nome'] = encodeURIComponent(a.nome);
  if (comentarioId) h['X-Comentario'] = String(comentarioId);
  return fetch('/api/qa/' + encodeURIComponent(id) + '/anexos', { method: 'PUT', headers: h, body: a.ficheiro, credentials: 'same-origin' })
    .then(function (resp) {
      if (typeof rastoPoe === 'function') rastoPoe('PUT /api/qa/…/anexos → ' + resp.status);
      return Promise.resolve(typeof resp.json === 'function' ? resp.json() : {}).catch(function () { return {}; }).then(function (j) {
        if (resp.ok) return (j && j.anexo) || {};
        var e = new Error((j && j.error) || ('Erro ' + resp.status + '.'));
        e.status = resp.status;
        throw e;
      });
    }, function () {
      if (typeof rastoPoe === 'function') rastoPoe('PUT /api/qa/…/anexos → sem rede');
      throw new Error('Sem ligação ao servidor.');
    });
}

/* Os anexos que já estão num item ou num comentário, na janela do ticket:
   as imagens numa grelha de miniaturas (que se pedem à parte, com a sessão:
   qaCarregarMiniaturas) que abrem em grande (qaVerAnexo); os documentos
   numa linha com o ícone, o nome, o tipo e o tamanho, que descarrega
   (qaAbrirAnexo).
   Recebe: lista — os anexos (rotas/qa.js:anexoDaPilula); rotulo — o nome da lista para o leitor de ecrã.
   Devolve: o HTML (texto, '' sem anexos). */
function qaHtmlAnexos(lista, rotulo) {
  var as = (Array.isArray(lista) ? lista : []).filter(function (a) { return a && typeof a.id === 'string'; });
  if (!as.length) return '';
  var imgs = as.filter(function (a) { return a.imagem; }), docs = as.filter(function (a) { return !a.imagem; });
  return '<div class="qa-anexos" role="group" aria-label="' + esc(rotulo || 'Anexos') + '">' +
    (imgs.length ? '<ul class="qa-anexos-imgs">' + imgs.map(function (a) {
      return '<li><button type="button" class="qa-anexo-img" data-toca="camada" data-click="qaVerAnexo(\'' + jsq(a.id) + '\')" aria-label="Ver a imagem ' + esc(a.nome) + '">' +
        '<span class="qa-anexo-mini a-carregar" data-anx="' + esc(a.id) + '"></span></button></li>';
    }).join('') + '</ul>' : '') +
    (docs.length ? '<ul class="qa-anexos-docs">' + docs.map(function (a) {
      return '<li><button type="button" class="qa-anexo-doc" data-toca="vista" data-click="qaAbrirAnexo(\'' + jsq(a.id) + '\')">' +
        '<span class="qa-anexo-ic" aria-hidden="true">' + ic('contract', 18) + '</span>' +
        '<span class="qa-anexo-txt"><span class="qa-anexo-nome">' + esc(a.nome) + '</span><span class="small">' + esc(qaMetaDoAnexo(a.nome, a.tamanho)) + '</span></span>' +
        '<span class="qa-so-leitor">Descarregar</span></button></li>';
    }).join('') + '</ul>' : '') +
    '</div>';
}

/* Um anexo da janela de um ticket, pelo id: nos do cartão ou nos dos comentários.
   Recebe: L — a camada do ticket; id — o id do anexo.
   Devolve: o anexo, ou null. */
function qaAnexoDaJanela(L, id) {
  var todos = (Array.isArray(L && L.qaAnexos) ? L.qaAnexos : []).slice();
  (Array.isArray(L && L.qaComs) ? L.qaComs : []).forEach(function (c) { if (c && Array.isArray(c.anexos)) todos = todos.concat(c.anexos); });
  return todos.filter(function (a) { return a && a.id === id; })[0] || null;
}

/* Pede os bytes de um anexo do ticket aberto (GET /api/qa/:id/anexos/:anexo),
   com a sessão, uma vez por anexo e por janela (o pedido fica em L.qaPedidosAnx).
   Recebe: L — a camada do ticket; id — o id do anexo.
   Devolve: Promise com o Blob; rejeita quando não veio. */
function qaBytesDoAnexo(L, id) {
  if (!L.qaPedidosAnx) L.qaPedidosAnx = {};
  if (L.qaPedidosAnx[id]) return L.qaPedidosAnx[id];
  var h = typeof cabecalhosDaSessao === 'function' ? cabecalhosDaSessao() : {};
  var p = fetch('/api/qa/' + encodeURIComponent(L.qaId) + '/anexos/' + encodeURIComponent(id), { headers: h, credentials: 'same-origin' })
    .then(function (resp) {
      if (!resp.ok) throw new Error('Erro ' + resp.status);
      return resp.blob();
    });
  L.qaPedidosAnx[id] = p;
  p.catch(function () { if (L.qaPedidosAnx) delete L.qaPedidosAnx[id]; });
  return p;
}

/* O object URL de uma imagem anexa do ticket aberto (feito uma vez e
   guardado em L.qaUrlsAnx, que o fecho liberta).
   Recebe: L — a camada; id — o id do anexo.
   Devolve: Promise com o URL. */
function qaUrlDoAnexo(L, id) {
  if (!L.qaUrlsAnx) L.qaUrlsAnx = {};
  if (L.qaUrlsAnx[id]) return Promise.resolve(L.qaUrlsAnx[id]);
  return qaBytesDoAnexo(L, id).then(function (blob) {
    if (!L.qaUrlsAnx[id]) L.qaUrlsAnx[id] = URL.createObjectURL(blob);
    return L.qaUrlsAnx[id];
  });
}

/* Põe as miniaturas nas imagens anexas da janela que ainda não as têm,
   pedindo as que faltam; a que falha diz-o, discreta, na própria caixa.
   Recebe: L — a camada do ticket.
   Devolve: Promise que acaba quando todas chegaram (ou falharam). */
function qaCarregarMiniaturas(L) {
  if (!L || !L.el || typeof L.el.querySelectorAll !== 'function') return Promise.resolve();
  var caixas = [].slice.call(L.el.querySelectorAll('[data-anx]'));
  return Promise.all(caixas.map(function (cx) {
    if (cx.querySelector && cx.querySelector('img')) return null;
    var id = cx.getAttribute('data-anx'), a = qaAnexoDaJanela(L, id);
    return qaUrlDoAnexo(L, id).then(function (url) {
      cx.classList.remove('a-carregar');
      cx.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(a ? a.nome : 'Imagem anexa') + '">';
    }, function () {
      cx.classList.remove('a-carregar'); cx.classList.add('falhou');
      cx.innerHTML = '<span class="small">Não carregou</span>';
    });
  }));
}

/* Abre uma imagem anexa em grande, numa janela por cima do ticket, com
   «Descarregar» e «Fechar».
   Recebe: id — o id do anexo.
   Devolve: Promise que acaba quando a janela abre (ou o aviso diz que não deu). */
function qaVerAnexo(id) {
  var L = qaCamadaTicket, a = L ? qaAnexoDaJanela(L, id) : null;
  if (!L || !a) return Promise.resolve(false);
  return qaUrlDoAnexo(L, id).then(function (url) {
    var J = openModal(a.nome || 'Imagem anexa', '<div class="qa-anexo-grande"><img src="' + esc(url) + '" alt="' + esc(a.nome || 'Imagem anexa') + '"></div>',
      '<button type="button" class="btn" data-toca="vista" data-click="qaAbrirAnexo(\'' + jsq(id) + '\')">' + ic('down', 16) + ' Descarregar</button>' +
      '<button type="button" class="btn primary" data-toca="camada" data-click="closeModal()">Fechar</button>');
    qaMarcarJanela(J);
    return true;
  }, function () {
    toast('Não deu para abrir a imagem.');
    return false;
  });
}

/* Descarrega um anexo do ticket aberto, com o nome dele: pelo
   descarregarBlob da app quando existe (app/anexos.js), ou por um <a
   download> temporário (no back office e nas páginas públicas).
   Recebe: id — o id do anexo.
   Devolve: Promise com true quando a descarga partiu. */
function qaAbrirAnexo(id) {
  var L = qaCamadaTicket, a = L ? qaAnexoDaJanela(L, id) : null;
  if (!L || !a) return Promise.resolve(false);
  return qaBytesDoAnexo(L, id).then(function (blob) {
    if (typeof descarregarBlob === 'function') descarregarBlob(blob, a.nome || 'anexo');
    else {
      var url = URL.createObjectURL(blob), el = document.createElement('a');
      el.href = url; el.download = a.nome || 'anexo';
      document.body.appendChild(el); el.click(); el.remove();
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
    }
    toast('A descarregar «' + (a.nome || 'anexo') + '».');
    return true;
  }, function () {
    toast('Não deu para descarregar o anexo.');
    return false;
  });
}

/* ------------------------------------------------------------- a lista */

/* Vai buscar os tickets e as colunas do kanban (GET /api/qa), um pedido de
   cada vez, e com eles o número por concluir; repinta a pílula, a lista e o
   ticket aberto. Corre ao aparecer a pílula, ao abrir o menu, ao abrir a
   lista, depois de criar, remover, repor, reabrir e mover, e ao voltar à
   app — nunca em ciclo. A falha não é uma lista vazia: diz-se, com «Tentar
   de novo».
   Devolve: Promise que acaba quando a resposta chega (ou falha). */
function qaCarregar() {
  if (qaLista.aPedir) return qaLista.aPedir;
  var p = Promise.resolve().then(function () { return api('GET', '/api/qa'); }).then(function (r) {
    qaLista.aPedir = null;
    qaLista.falhou = false;
    qaLista.tickets = (r && Array.isArray(r.tickets) ? r.tickets : []).filter(function (t) { return t && typeof t === 'object' && t.id; });
    qaLista.colunas = qaColunasDe(r && r.colunas);
    qaAbertos = qaSeccoes(qaLista.tickets).abertos.length;
    qaPintarNumero();
    qaPintarLista();
    return true;
  }, function () {
    qaLista.aPedir = null;
    qaLista.falhou = true;
    qaPintarLista();
    return false;
  });
  qaLista.aPedir = p;
  return p;
}

/* «Tentar de novo» depois de uma falha a carregar os tickets.
   Devolve: nada. */
function qaCarregarDeNovo() {
  qaLista.falhou = false;
  qaPintarLista();
  qaCarregar();
}

/* A prioridade do cartão de um item, de 1 (Mais alta) a 5 (Mais baixa); uma
   que não venha, ou que não seja uma delas, é a Média, como no kanban.
   Recebe: t — o item da lista.
   Devolve: o número (1 a 5). */
function qaPrioridade(t) {
  var p = Number(t && t.prioridade);
  return p >= 1 && p <= 5 && Math.floor(p) === p ? p : QA_PRIORIDADE_OMISSAO;
}

/* O nome de uma prioridade, como o kanban o escreve.
   Recebe: p — o número (1 a 5).
   Devolve: o texto. */
function qaNomeDaPrioridade(p) {
  return QA_PRIORIDADES[p - 1] ? QA_PRIORIDADES[p - 1].rotulo : QA_PRIORIDADES[QA_PRIORIDADE_OMISSAO - 1].rotulo;
}

/* As colunas do kanban que vieram do servidor, validadas: só as que têm um
   id com a forma de um id de coluna (QA_ID_COLUNA), sem repetidas, com o nome
   (o id, se vier sem nome) e o fim como true ou false. Sem nenhuma que se
   aproveite (um servidor de antes da 0029, ou uma resposta estragada), as de
   omissão.
   Recebe: cs — o que veio em r.colunas (pode não ser uma lista).
   Devolve: a lista [{id, nome, fim}] (nova). */
function qaColunasDe(cs) {
  var vistas = {}, r = [];
  (Array.isArray(cs) ? cs : []).forEach(function (c) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !QA_ID_COLUNA.test(c.id) || vistas[c.id]) return;
    vistas[c.id] = true;
    var nome = typeof c.nome === 'string' && c.nome.trim() ? c.nome.trim() : c.id;
    r.push({ id: c.id, nome: nome, fim: c.fim === true || c.fim === 1 });
  });
  return r.length ? r : QA_COLUNAS_OMISSAO.map(function (c) { return { id: c.id, nome: c.nome, fim: c.fim }; });
}

/* As colunas do kanban de agora: as da última resposta do servidor, ou as de
   omissão enquanto não houve nenhuma.
   Devolve: a lista [{id, nome, fim}]. */
function qaColunas() {
  return Array.isArray(qaLista.colunas) && qaLista.colunas.length ? qaLista.colunas : QA_COLUNAS_OMISSAO;
}

/* Uma coluna do kanban pelo id.
   Recebe: id — o id da coluna (o status de um ticket).
   Devolve: {id, nome, fim}, ou null se não é uma coluna que se conheça. */
function qaColuna(id) {
  return qaColunas().filter(function (c) { return c.id === id; })[0] || null;
}

/* O nome de uma coluna, como o kanban o escreve; de uma coluna que não se
   conhece, o próprio id (nada se perde nem se inventa).
   Recebe: id — o id da coluna.
   Devolve: o texto. */
function qaNomeDaColuna(id) {
  var c = qaColuna(id);
  return c ? c.nome : String(id == null ? '' : id);
}

/* Um ticket nesta coluna está resolvido? Em Human Tests (resolvido, à
   espera de quem testa) e nas colunas de fim, onde o servidor põe o
   resolved_at e de onde o ticket se reabre.
   Recebe: id — o id da coluna.
   Devolve: true ou false. */
function qaColunaResolvida(id) {
  if (id === QA_COL_RESOLVIDO) return true;
  var c = qaColuna(id);
  return !!(c && c.fim);
}

/* Um ticket nesta coluna está por concluir (conta no número da pílula)? Em
   todas menos Produção (KAN-155: «todos os tickets que não estão
   concluídos»), que o servidor nem manda: o número é o tamanho da lista.
   Recebe: id — o id da coluna.
   Devolve: true ou false. */
function qaColunaPorConcluir(id) {
  return id !== QA_COL_PRODUCAO;
}

/* Os tickets arrumados pelas colunas do kanban, uma secção por coluna pela
   ordem do quadro (qaColunas), e no fim uma por cada status que não é uma
   coluna conhecida (com o próprio id como nome: o ticket nunca se perde).
   Dentro de cada uma, a ordem do servidor: nas por resolver pela
   prioridade do cartão (Mais alta a Mais baixa) e em cada prioridade do
   mais recente para o mais antigo; nas resolvidas (qaColunaResolvida) do
   resolvido há menos tempo para o resolvido há mais.
   Recebe: ts — os itens da API (os cartões do kanban fora de Produção).
   Devolve: {seccoes: [{id, nome, fim, conhecida, ts}], abertos} (arrays
   novos; abertos são os por concluir — os de todas as colunas menos
   Produção, pela ordem das secções). */
function qaSeccoes(ts) {
  var lista = Array.isArray(ts) ? ts : [];
  var porPrioridade = function (a, b) {
    return qaPrioridade(a) - qaPrioridade(b) ||
      (Number(b.created_at) || 0) - (Number(a.created_at) || 0);
  };
  var porResolucao = function (a, b) {
    return (Number(b.resolved_at || b.updated_at) || 0) - (Number(a.resolved_at || a.updated_at) || 0);
  };
  var seccoes = qaColunas().map(function (c) { return { id: c.id, nome: c.nome, fim: !!c.fim, conhecida: true, ts: [] }; });
  var porId = {};
  seccoes.forEach(function (s) { porId[s.id] = s; });
  lista.forEach(function (t) {
    var id = String(t.status == null ? '' : t.status);
    if (!Object.prototype.hasOwnProperty.call(porId, id)) {
      porId[id] = { id: id, nome: id || 'Sem coluna', fim: false, conhecida: false, ts: [] };
      seccoes.push(porId[id]);
    }
    porId[id].ts.push(t);
  });
  seccoes.forEach(function (s) { s.ts = qaFilhosAoPai(s.ts.sort(qaColunaResolvida(s.id) ? porResolucao : porPrioridade)); });
  var abertos = [];
  seccoes.forEach(function (s) { if (qaColunaPorConcluir(s.id)) abertos = abertos.concat(s.ts); });
  return { seccoes: seccoes, abertos: abertos };
}

/* Os subtickets de uma secção logo a seguir ao pai, pelo X (KAN-162), quando
   o pai está na mesma secção; os outros ficam onde a ordem os pôs.
   Recebe: ts — os itens da secção, já arrumados.
   Devolve: a lista nova. */
function qaFilhosAoPai(ts) {
  var naSeccao = {};
  ts.forEach(function (t) { if (t.cartao) naSeccao[t.cartao] = true; });
  var dePai = function (t) { return qaESubticket(t) && naSeccao[t.pai.cartao]; };
  var out = [];
  ts.forEach(function (t) {
    if (dePai(t)) return;
    out.push(t);
    ts.filter(function (f) { return dePai(f) && f.pai.cartao === t.cartao; })
      .sort(function (a, b) { return Number(a.sub) - Number(b.sub); })
      .forEach(function (f) { out.push(f); });
  });
  return out;
}

/* Abre a janela «Tickets»: logo com o que já se sabe (ou a espera), e
   pede outra vez ao servidor.
   Devolve: nada. */
function qaVerTickets() {
  var L = openModal('Tickets', qaHtmlLista(),
    '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>' +
    '<button type="button" class="btn primary" data-toca="camada" data-click="qaNovoTicket()">' + ic('plus', 16) + ' Novo ticket</button>');
  qaCamadaLista = L || null;
  qaMarcarJanela(L);
  if (L) L.aoFechar = function () { if (qaCamadaLista === L) qaCamadaLista = null; };
  qaCarregar();
}

/* O corpo da lista: a espera, a falha com «Tentar de novo», o vazio, ou uma
   secção por coluna do kanban, pela ordem do quadro (qaSeccoes), com o nome
   da coluna e quantos tem, cada uma uma secção que abre e fecha
   (qaHtmlDobra; por nascença a Para depois recolhida). A fazer
   está sempre à vista, mesmo vazia, e em grupos por prioridade; as outras
   só quando têm tickets. Com tickets já mostrados e uma atualização
   falhada, diz que é o que havia.
   Devolve: o HTML (texto). */
function qaHtmlLista() {
  var ts = qaLista.tickets;
  var deNovo = '<button type="button" class="btn sm" data-toca="dados" data-click="qaCarregarDeNovo()">Tentar de novo</button>';
  if (ts === null) {
    return qaLista.falhou
      ? '<div class="empty"><b>Não deu para carregar os tickets.</b>Pode ser a ligação. Tenta de novo daqui a pouco.<div>' + deNovo + '</div></div>'
      : '<div class="espera"><span class="roda" aria-hidden="true"></span><span><b>À espera do servidor.</b> Os tickets aparecem assim que chegarem.</span></div>';
  }
  var aviso = qaLista.falhou ? '<div class="qa-desatual"><span>Não deu para atualizar: isto é o que havia.</span>' + deNovo + '</div>' : '';
  if (!ts.length) {
    return aviso + '<div class="empty"><b>Não há tickets por concluir.</b>Quando vires alguma coisa que não está bem, toca em Lab e depois em Novo ticket.</div>';
  }
  return '<div class="qa-lista">' + aviso + qaSeccoes(ts).seccoes.map(function (s) {
    var novos = s.id === QA_COL_NOVO;
    if (!novos && !s.ts.length) return '';
    var corpo = novos
      ? (s.ts.length ? qaHtmlGrupos(s.ts) : '<p class="hint">Nenhum ticket novo.</p>')
      : '<div class="qa-linhas">' + s.ts.map(qaHtmlLinha).join('') + '</div>';
    return qaHtmlDobra(s.id, 'h3', '<span class="qa-dobra-nome">' + esc(s.nome) + '</span><span class="qa-sec-n">' + s.ts.length + '</span>', corpo);
  }).join('') + '</div>';
}

/* Os de A fazer em grupos pela prioridade do cartão (Mais alta a Mais
   baixa, os nomes do kanban), cada um com o título e quantos tem, e cada um
   uma secção que abre e fecha (qaHtmlDobra, com a chave 'p-N'; os itens já
   vêm arrumados por qaSeccoes).
   Recebe: novos — os itens de A fazer, pela ordem de qaSeccoes.
   Devolve: o HTML (texto). */
function qaHtmlGrupos(novos) {
  var grupos = [];
  novos.forEach(function (t) {
    var p = qaPrioridade(t);
    if (!grupos.length || grupos[grupos.length - 1].p !== p) grupos.push({ p: p, ts: [] });
    grupos[grupos.length - 1].ts.push(t);
  });
  return grupos.map(function (g) {
    return qaHtmlDobra('p-' + g.p, 'h4',
      '<span class="qa-dobra-nome">' + qaNomeDaPrioridade(g.p) + '</span><span class="qa-grupo-n">' + g.ts.length + '</span>',
      '<div class="qa-linhas">' + g.ts.map(qaHtmlLinha).join('') + '</div>');
  }).join('');
}

/* Uma secção da lista que abre e fecha, como as da gaveta
   (navegacao.js:gavetaHtml): o título com um botão da largura toda — o nome,
   quantos tem e a seta —, com aria-expanded e aria-controls para o corpo; o
   corpo fica sempre no HTML e é a folha que o recolhe (estilos.css, bloco
   «tickets de QA»: .qa-dobra.fechada). Nasce como está guardado neste
   aparelho (qaDobraAberta).
   Recebe: chave — o id de uma coluna (as secções) ou uma de
   QA_DOBRAS_GRUPOS (os grupos de prioridade); nivel — 'h3' (as colunas) ou
   'h4' (os grupos de prioridade); cabeca — o HTML do nome e do número;
   corpo — o HTML de dentro.
   Devolve: o HTML (texto). */
function qaHtmlDobra(chave, nivel, cabeca, corpo) {
  var aberta = qaDobraAberta(chave), corpoId = esc('qaDobra-' + chave);
  return '<div class="qa-dobra' + (aberta ? '' : ' fechada') + '" id="' + esc('qaSec-' + chave) + '">' +
    '<' + nivel + ' class="' + (nivel === 'h3' ? 'qa-sec' : 'qa-grupo') + '">' +
      '<button type="button" class="qa-dobra-cab" id="' + esc('qaCab-' + chave) + '" data-toca="nada" data-click="qaDobrar(\'' + jsq(chave) + '\')" ' +
        'aria-expanded="' + (aberta ? 'true' : 'false') + '" aria-controls="' + corpoId + '">' +
        cabeca + '<span class="qa-dobra-seta" aria-hidden="true">' + ic('chevD', 16) + '</span></button>' +
    '</' + nivel + '>' +
    '<div class="qa-dobra-corpo" id="' + corpoId + '"><div class="qa-dobra-itens"><div class="qa-dobra-dentro">' + corpo + '</div></div></div>' +
  '</div>';
}

/* As secções que se tocaram neste aparelho, só com as chaves que têm a
   forma de uma (o id de uma coluna, ou um grupo de prioridade, que tem a
   mesma forma) e os valores que são true ou false; com o armazenamento
   vedado, as desta sessão (qaDobrasAqui); estragado, nenhuma. As chaves de
   antes ficam, sem efeito: as de antes das colunas ('novos',
   'em-resolucao', 'resolvidos') e as dos grupos de gravidade ('g-bloqueia'…),
   que já não há.
   Devolve: {chave: true (aberta) ou false (recolhida)} (um objeto novo). */
function qaLerDobras() {
  var bruto = null, d = null, limpo = {};
  try { bruto = localStorage.getItem(QA_LS_DOBRAS); } catch (e) { d = qaDobrasAqui; }
  if (!d) { try { d = JSON.parse(bruto || '{}'); } catch (e) { d = null; } }
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    Object.keys(d).forEach(function (k) { if (QA_ID_COLUNA.test(k) && typeof d[k] === 'boolean') limpo[k] = d[k]; });
  }
  return limpo;
}

/* As chaves das secções que a lista mostra agora (as mesmas de
   qaHtmlLista): A fazer, as colunas com tickets, os status dos tickets que
   não são colunas conhecidas, e os grupos de prioridade de A fazer.
   Devolve: a lista das chaves. */
function qaChavesDasDobras() {
  return qaSeccoes(qaLista.tickets || []).seccoes
    .filter(function (s) { return s.id === QA_COL_NOVO || s.ts.length; })
    .map(function (s) { return s.id; }).concat(QA_DOBRAS_GRUPOS);
}

/* A secção está aberta? A escolha guardada neste aparelho; sem nenhuma, a
   de nascença: as de QA_DOBRAS_FECHADAS recolhidas (o que fica para
   depois), o resto aberto — também Staging e Adiado, que são de fim mas
   ainda não estão concluídos (Produção não vem na lista).
   Recebe: chave — o id de uma coluna ou uma de QA_DOBRAS_GRUPOS.
   Devolve: true (aberta) ou false (recolhida). */
function qaDobraAberta(chave) {
  var d = qaLerDobras();
  if (Object.prototype.hasOwnProperty.call(d, chave)) return d[chave];
  return QA_DOBRAS_FECHADAS.indexOf(chave) < 0;
}

/* Abre ou recolhe uma secção da lista. É da família «nada», como a gaveta
   (navegacao.js:gavetaAlternar): troca a classe da secção e o aria-expanded
   do botão no nó vivo, sem repintar — a transição da altura só corre num nó
   vivo, e o foco fica no botão. Guarda neste aparelho (com o armazenamento
   vedado, só nesta sessão), e a lista que o servidor repintar nasce igual.
   Recebe: chave — o id de uma coluna ou uma de QA_DOBRAS_GRUPOS.
   Devolve: true se ficou aberta, false se ficou recolhida, null para uma chave que não existe. */
function qaDobrar(chave) {
  if (typeof chave !== 'string' || !QA_ID_COLUNA.test(chave) || qaChavesDasDobras().indexOf(chave) < 0) return null;
  var aberta = !qaDobraAberta(chave), d = qaLerDobras();
  d[chave] = aberta;
  qaDobrasAqui = d;
  try { localStorage.setItem(QA_LS_DOBRAS, JSON.stringify(d)); } catch (e) {}
  var sec = document.getElementById('qaSec-' + chave), cab = document.getElementById('qaCab-' + chave);
  if (sec && sec.classList) sec.classList.toggle('fechada', !aberta);
  if (cab) cab.setAttribute('aria-expanded', aberta ? 'true' : 'false');
  return aberta;
}

/* Uma linha da lista: o selo da prioridade (nenhum na Média), o tipo do
   cartão quando não é um Erro (qaNomeDoTipo), a chave do cartão no seu
   selo, os sinais de que traz captura e anexos, quem e quando, e o título do cartão (o começo da
   descrição, sem título). A de um pedido de uma pessoa tem só o tipo, a
   chave e o título (KAN-155): nem prioridade, nem quem, nem quando. Tocar
   abre o item.
   Recebe: t — o item (um cartão do kanban).
   Devolve: o HTML (texto). */
function qaHtmlLinha(t) {
  var tipo = qaNomeDoTipo(t), pedido = qaEPedido(t);
  return '<button type="button" class="qa-linha' + (qaESubticket(t) ? ' qa-linha-sub' : '') + '" data-toca="camada" data-click="qaAbrirTicket(\'' + jsq(t.id) + '\')">' +
    '<span class="qa-linha-cab">' + (pedido ? '' : qaSelo(qaPrioridade(t))) +
      (tipo ? '<span class="small qa-tipo">' + esc(tipo) + '</span>' : '') +
      (typeof t.cartao === 'string' && t.cartao ? '<span class="num qa-cartao">' + esc(t.cartao) + '</span>' : '') +
      (t.imagem ? '<span class="qa-tem-img">' + ic('photo', 15) + '<span class="qa-so-leitor">Com captura</span></span>' : '') +
      (Number(t.anexos) > 0 ? '<span class="qa-tem-img">' + ic('clip', 15) + '<span class="qa-so-leitor">' + (Number(t.anexos) === 1 ? 'Com um anexo' : 'Com ' + Number(t.anexos) + ' anexos') + '</span></span>' : '') +
      (pedido ? '' : '<span class="small qa-quem">' + esc(qaAutor(t, false)) + ' · ' + esc(qaQuando(t.created_at)) + '</span>') +
    '</span>' +
    '<span class="qa-linha-txt">' + esc(qaResumo(t.titulo || t.body)) + '</span>' +
  '</button>';
}

/* O nome do tipo de um cartão, para a linha e para a janela: «Pedido» num
   pedido de uma pessoa, «Subticket» num subticket (KAN-N-X), o do kanban
   (QA_NOMES_DOS_TIPOS) nos outros tipos,
   e nada num Erro (o que a pílula sempre mostrou) nem num item sem tipo (um
   servidor de antes dos tipos).
   Recebe: t — o item.
   Devolve: o texto ('' sem nada a dizer). */
function qaNomeDoTipo(t) {
  if (qaEPedido(t)) return 'Pedido';
  if (qaESubticket(t)) return 'Subticket';
  var tipo = t && typeof t.tipo === 'string' ? t.tipo : '';
  return tipo && tipo !== 'erro' && QA_NOMES_DOS_TIPOS[tipo] ? QA_NOMES_DOS_TIPOS[tipo] : '';
}

/* O item é o cartão de um pedido de uma pessoa? O servidor diz (pedido:
   true) e manda-o só com a chave e o título: abre-se só para ler.
   Recebe: t — o item.
   Devolve: true ou false. */
function qaEPedido(t) {
  return !!t && t.pedido === true;
}

/* O selo da prioridade de um cartão, como o do quadro do kanban
   (equipa-kanban.js:kbPrioridadeHtml): o ícone e a palavra na cor dela, na
   letra e no contorno (sem fundo, que o escurecimento forçado do Samsung
   apaga); a Média, a de omissão, não tem selo.
   Recebe: p — a prioridade (1 a 5; outra coisa conta como Média).
   Devolve: o HTML (texto, '' na Média). */
function qaSelo(p) {
  p = Number(p);
  if (!(p >= 1 && p <= 5) || p === QA_PRIORIDADE_OMISSAO) return '';
  return '<span class="qa-prio qa-p' + p + '">' + ic('prio' + p, 14) +
    '<span class="qa-so-leitor">Prioridade: </span>' + qaNomeDaPrioridade(p) + '</span>';
}

/* Marca uma janela como do QA. A pílula sobe acima das janelas abertas, para
   se poder escrever um ticket sobre a que está à frente, mas volta para baixo
   enquanto uma janela do próprio QA está aberta, para não tapar o formulário
   (estilos.css, bloco «tickets de QA»: .qa-janela).
   Recebe: L — a camada que o openModal devolveu (pode faltar).
   Devolve: nada. */
function qaMarcarJanela(L) {
  if (L && L.el && L.el.classList) L.el.classList.add('qa-janela');
}

/* Quem escreveu o ticket: o nome (ou o email), e «(eu)» quando fui eu; com
   o email, para a janela do ticket. Um ticket de uma conta de teste é da
   conta do Discord que pediu a ligação do /test (autor.discord): o nome dela
   no Discord, ou o id quando a ligação não trouxe o nome — mesmo depois de o
   /test limpar apagar a conta de teste. Uma conta normal que já se apagou (a
   linha de users anonimizada, ou que já nem existe depois de uma limpeza do
   dev) fica «Conta apagada»: o ticket sobrevive à conta.
   Recebe: t — o ticket; comEmail — true para juntar o email (ou o id do Discord).
   Devolve: o texto. */
function qaAutor(t, comEmail) {
  var a = t && t.autor && typeof t.autor === 'object' ? t.autor : {};
  var eu = !!(window.CW && CW.user && a.id && a.id === CW.user.id);
  var d = a.discord && typeof a.discord === 'object' && a.discord.id ? a.discord : null;
  if (d) {
    var dn = d.nome ? String(d.nome) + ' (Discord)' : 'Discord ' + String(d.id);
    if (eu) dn += ' (eu)';
    if (comEmail && d.nome) dn += ' · ' + String(d.id);
    return dn;
  }
  var apagada = !a.nome && !a.email || a.nome === '[deleted]' || /^apagado-/.test(String(a.email || ''));
  if (apagada) return 'Conta apagada';
  var nome = String(a.nome || a.email);
  if (eu) nome += ' (eu)';
  if (comEmail && a.nome && a.email) nome += ' · ' + String(a.email);
  return nome;
}

/* Os passos de um «O que testar» (KAN-159): a cópia, letra a letra, de
   worker/src/lib/kanban.js:passosDoTexto (a pílula não importa módulos; o
   testes/kanban-subtickets.test.js obriga as duas a serem iguais). Parte o
   texto em blocos pelas linhas em branco e, em cada um, os passos «1. … 2. …»
   numerados de seguida a partir do 1; um bloco com menos de dois fica como está.
   Recebe: texto — o texto (qualquer valor).
   Devolve: null sem passos em nenhum bloco; ou os blocos, cada um {texto} ou
   {antes, passos: [texto, …]}. */
function qaPassosDoTexto(texto) {
  var t = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n');
  var algum = false;
  var blocos = t.split(/\n[ \t]*\n/).map(function (b) {
    var re = /(^|\s)(\d{1,2})[.)](?=\s)/g, marcas = [], m, n = 1;
    while ((m = re.exec(b))) {
      if (Number(m[2]) !== n) continue;
      marcas.push({ i: m.index + m[1].length, fim: re.lastIndex });
      n++;
    }
    if (marcas.length < 2) return { texto: b.trim() };
    var passos = marcas.map(function (x, j) { return b.slice(x.fim, j + 1 < marcas.length ? marcas[j + 1].i : b.length).replace(/\s+/g, ' ').trim(); });
    if (passos.some(function (p) { return !p; })) return { texto: b.trim() };
    algum = true;
    return { antes: b.slice(0, marcas[0].i).trim(), passos: passos };
  }).filter(function (x) { return x.passos || x.texto; });
  return algum ? blocos : null;
}

/* Um texto da janela de um item (a descrição, a resolução, um comentário)
   em HTML: como sempre, num parágrafo com as mudanças de linha, quando não
   tem passos; com passos (qaPassosDoTexto), um parágrafo por bloco e os
   passos numa lista numerada (.qa-passos), o começo do bloco («O que
   testar:») por cima dela.
   Recebe: texto — o texto; cls — a classe dos parágrafos ('qa-ver-txt',
   'qa-com-txt', ou '' na resolução).
   Devolve: o HTML (texto). */
function qaHtmlTexto(texto, cls) {
  var p = function (t) { return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(t) + '</p>'; };
  var blocos = qaPassosDoTexto(texto);
  if (!blocos) return p(String(texto == null ? '' : texto));
  return '<div class="qa-texto">' + blocos.map(function (b) {
    if (!b.passos) return p(b.texto);
    return (b.antes ? p(b.antes) : '') + '<ol class="qa-passos">' + b.passos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
  }).join('') + '</div>';
}

/* O começo do texto de um ticket, numa linha.
   Recebe: s — o texto.
   Devolve: até 180 caracteres, com reticências se cortou. */
function qaResumo(s) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > 180 ? t.slice(0, 179) + '…' : t;
}

/* Repinta a lista, se estiver aberta (também por baixo de um ticket aberto),
   e o ticket aberto, com o que chegou do servidor. O foco que ficou num nó
   que saiu volta à janela de cima.
   Devolve: nada. */
function qaPintarLista() {
  var pilha = typeof modalStack !== 'undefined' ? modalStack : [];
  var L = qaCamadaLista;
  if (L && pilha.indexOf(L) > -1 && L.el && typeof L.el.querySelector === 'function') {
    var corpo = L.el.querySelector('.body');
    if (corpo) {
      var html = qaHtmlLista();
      corpo.innerHTML = typeof semEtiquetasQueCorrem === 'function' ? semEtiquetasQueCorrem(html) : html;
    }
  }
  var T = qaCamadaTicket;
  if (T && pilha.indexOf(T) > -1 && qaLista.tickets) {
    var t = qaLista.tickets.filter(function (x) { return x.id === T.qaId; })[0];
    if (t && (t.status !== T.qaStatus || t.updated_at !== T.qaAtualizado)) qaRepintarTicket(T, t);
  }
  try {
    var ativo = document.activeElement, top = typeof modalTop === 'function' ? modalTop() : null;
    if (top && (!ativo || ativo === document.body) && typeof focarModal === 'function') focarModal(top.el);
  } catch (e) {}
}

/* ------------------------------------------------------------- um ticket */

/* Abre um item para ler, por cima da lista: o título e a descrição do
   cartão, a captura (carregada com a sessão), a resolução, os comentários
   (pedidos à parte: qaCarregarComentarios, com os anexos do cartão e os de
   cada comentário) com o campo para comentar e anexar, e o contexto (os dois últimos e a captura só num ticket de QA); em baixo
   «Remover» (só num ticket de QA) e, em Human Tests e em Adiado, as
   decisões; nas outras colunas «Mover» e «Reabrir» (nas de fim) ou
   «Fechar». O cartão de um pedido de uma pessoa abre só para ler: a chave,
   a coluna e o título, sem comentários (qaHtmlTicket, qaRodapeTicket).
   Recebe: id — o id do item (o do ticket, ou a chave KAN-N de um cartão sem ticket).
   Devolve: nada — abre a janela. */
function qaAbrirTicket(id) {
  var t = (qaLista.tickets || []).filter(function (x) { return x.id === id; })[0];
  if (!t) { toast('Este ticket já não existe.'); qaCarregar(); return; }
  var L = openModal(qaTituloDaJanela(t), qaHtmlTicket(t), qaRodapeTicket(t));
  if (!L) return;
  qaMarcarJanela(L);
  qaCamadaTicket = L;
  L.qaId = id; L.qaStatus = t.status; L.qaAtualizado = t.updated_at; L.qaUrl = '';
  L.qaComs = null; L.qaProvisorio = null; L.qaAnexos = null; L.qaEscolhidos = []; L.qaPendente = null;
  L.qaUrlsAnx = {}; L.qaPedidosAnx = {};
  L.aoFechar = function () {
    if (L.qaUrl) { try { URL.revokeObjectURL(L.qaUrl); } catch (e) {} L.qaUrl = ''; }
    Object.keys(L.qaUrlsAnx || {}).forEach(function (k) { try { URL.revokeObjectURL(L.qaUrlsAnx[k]); } catch (e) {} });
    L.qaUrlsAnx = {};
    qaLargarEscolhidos(L.qaEscolhidos);
    if (qaCamadaTicket === L) qaCamadaTicket = null;
  };
  if (!qaEPedido(t) && L.el && typeof L.el.addEventListener === 'function') L.el.addEventListener('paste', qaColarNaResposta);
  if (t.imagem) qaCarregarImagem(L, id);
  if (!qaEPedido(t)) qaCarregarComentarios(L);
}

/* O título da janela de um item: «Ticket de QA» quando veio de um ticket, e
   o tipo e a chave num cartão sem ticket («Erro KAN-N», «Tarefa KAN-N»,
   «Pedido KAN-N»: qaNomeDoTipo).
   Recebe: t — o item.
   Devolve: o texto. */
function qaTituloDaJanela(t) {
  return qaTemTicket(t) ? 'Ticket de QA' : (qaNomeDoTipo(t) || 'Erro') + ' ' + String(t.cartao || t.id || '');
}

/* O item veio de um ticket de QA (tem captura, contexto e remove-se na
   pílula)? Um servidor de antes da vista do kanban não manda o ticket:
   todos eram tickets.
   Recebe: t — o item.
   Devolve: true ou false. */
function qaTemTicket(t) {
  return !!t && t.ticket !== false;
}

/* A palavra para o item nos avisos: «Ticket» num ticket de QA, «Cartão» num
   Erro sem ticket.
   Recebe: id — o id do item.
   Devolve: o texto. */
function qaPalavra(id) {
  var t = (qaLista.tickets || []).filter(function (x) { return x.id === id; })[0];
  return t && !qaTemTicket(t) ? 'Cartão' : 'Ticket';
}

/* O corpo da janela de um item: o de cima (qaHtmlTopo), os anexos do item
   (.qa-anx-item, pintados quando a conversa chega: qaPintarComentarios), os
   comentários (qaHtmlComentarios, à espera até chegarem), o campo para
   comentar e anexar (qaHtmlComentar) e, num ticket de QA, o contexto dobrado. O de cima e os
   comentários repintam-se sozinhos quando o item muda (qaRepintarTicket); o
   campo fica, com o que lá estiver escrito.
   O de um pedido de uma pessoa é só o de cima, para ler.
   Recebe: t — o item.
   Devolve: o HTML (texto). */
function qaHtmlTicket(t) {
  if (qaEPedido(t)) return '<div class="form qa-ver"><div class="qa-ver-topo">' + qaHtmlTopo(t) + '</div></div>';
  return '<div class="form qa-ver">' +
    '<div class="qa-ver-topo">' + qaHtmlTopo(t) + '</div>' +
    '<div class="qa-anx-item"></div>' +
    '<section class="qa-coms" aria-labelledby="qa_coms_tit"><h3 class="qa-coms-tit" id="qa_coms_tit">Comentários</h3>' +
      '<div class="qa-coms-lista">' + qaHtmlComentarios(null, t) + '</div></section>' +
    qaHtmlComentar() +
    (qaTemTicket(t) ? fold('qaCtx', 'Contexto', qaHtmlContexto(t.context), { icon: 'info' }) : '') +
    '</div>';
}

/* O de cima da janela de um item: no cabeçalho, a coluna onde está, a
   prioridade do cartão (qaSelo; nenhuma na Média) e a chave do cartão no
   kanban (KAN-N) no seu selo realçado (KAN-163: «O número do ticket está
   num pill realçado. Gosto assim.»); num subticket, por baixo, a linha de
   quem é (qaHtmlDoPai); quem e quando (o autor do ticket, ou quem criou o
   cartão), o título e a descrição do cartão, a caixa da captura e a
   resolução (ou a «Resolução anterior» de um reaberto). O de um pedido de
   uma pessoa: a coluna, a chave e o título, e a frase de onde se lê o resto.
   Recebe: t — o item.
   Devolve: o HTML (texto). */
function qaHtmlTopo(t) {
  var resolvido = qaColunaResolvida(t.status);
  var cartao = typeof t.cartao === 'string' && t.cartao ? '<span class="num qa-cartao" title="O cartão no kanban da equipa">' + esc(t.cartao) + '</span>' : '';
  var titulo = typeof t.titulo === 'string' && t.titulo.trim() ? '<p class="qa-ver-tit">' + esc(t.titulo) + '</p>' : '';
  if (qaEPedido(t)) {
    return '<div class="qa-ver-cab">' + qaSeloEstado(t.status) + cartao + '</div>' + titulo +
      '<p class="hint">O texto deste pedido é de quem o escreveu na Ajuda: lê-se no back office, nos Pedidos.</p>';
  }
  var texto = String(t.body || '').trim();
  return '<div class="qa-ver-cab">' + qaSeloEstado(t.status) + qaSelo(qaPrioridade(t)) + cartao + '</div>' +
    qaHtmlDoPai(t) +
    '<p class="small qa-quem">' + esc(qaAutor(t, true)) + ' · ' + esc(qaQuando(t.created_at)) + '</p>' +
    titulo + (texto ? qaHtmlTexto(texto, 'qa-ver-txt') : (titulo ? '' : '<p class="hint">Sem descrição.</p>')) +
    (t.imagem ? '<div class="qa-ver-img a-carregar" aria-busy="true"><span class="qa-so-leitor">A carregar a captura</span></div>' : '') +
    (t.resolution ? '<div class="qa-resolucao' + (resolvido ? '' : ' anterior') + '"><b>' + (resolvido ? 'Resolução' : 'Resolução anterior') + '</b>' +
      qaHtmlTexto(t.resolution, '') + (resolvido && t.resolved_at ? '<span class="small">' + esc(qaQuando(t.resolved_at)) + '</span>' : '') + '</div>' : '') +
    qaHtmlSubtickets(t);
}

/* Num subticket (KAN-N-X, KAN-162), de quem é, numa linha discreta debaixo
   do cabeçalho (KAN-163: «Os subtickets têm um retângulo grande a dizer que
   são subtickets de algum outro. Não gosto.»): «Subticket do», o selo do
   pai (o mesmo da chave, que se toca para abrir o pai; o alvo do dedo
   cresce para fora dele) e o título do pai, numa linha só, cortado.
   Recebe: t — o item.
   Devolve: o HTML (texto, '' num cartão que não é subticket). */
function qaHtmlDoPai(t) {
  if (!qaESubticket(t)) return '';
  var tit = String(t.pai.titulo || '').trim();
  return '<p class="small qa-do-pai"><span class="qa-do-pai-de">Subticket do</span>' +
    '<button type="button" class="num qa-cartao qa-cartao-toca" data-toca="camada" data-click="qaAbrirTicket(\'' + jsq(qaIdDoCartao(t.pai.cartao)) + '\')"' +
    ' aria-label="Abrir o ' + esc(t.pai.cartao) + (tit ? ': ' + esc(tit) : '') + '">' + esc(t.pai.cartao) + '</button>' +
    (tit ? '<span class="qa-do-pai-tit" aria-hidden="true">' + esc(tit) + '</span>' : '') + '</p>';
}

/* Os subtickets de um pai (KAN-162): cada um com a chave, o título e a
   coluna onde está, a tocar para o abrir; por cima, o que isso quer dizer
   — cada um aceita-se ou comenta-se à parte, e o cartão segue-os.
   Recebe: t — o item.
   Devolve: o HTML (texto, '' sem subtickets). */
function qaHtmlSubtickets(t) {
  var subs = qaSubticketsDe(t);
  if (!subs.length) return '';
  var porDecidir = subs.filter(function (s) { return s.status === QA_COL_RESOLVIDO; }).length;
  return '<section class="qa-subs" aria-labelledby="qa_subs_tit"><h3 class="qa-coms-tit" id="qa_subs_tit">Subtickets</h3>' +
    '<p class="hint">' + (porDecidir ? 'Testa e decide cada um à parte; este cartão segue-os.' : 'Este cartão segue os subtickets.') + '</p>' +
    '<ul class="qa-subs-lista">' + subs.map(function (s) {
      return '<li><button type="button" class="qa-sub" data-toca="camada" data-click="qaAbrirTicket(\'' + jsq(qaIdDoCartao(s.cartao)) + '\')">' +
        '<span class="num qa-cartao">' + esc(s.cartao) + '</span><span class="qa-sub-tit">' + esc(s.titulo || '') + '</span>' + qaSeloEstado(s.status) + '</button></li>';
    }).join('') + '</ul></section>';
}

/* O item é um subticket (KAN-N-X, KAN-162)? O servidor diz-lhe o X e o pai.
   Recebe: t — o item.
   Devolve: true ou false. */
function qaESubticket(t) {
  return !!t && t.sub != null && !!t.pai && typeof t.pai.cartao === 'string';
}

/* Os subtickets de um pai, como o servidor os manda ([{cartao, titulo, status}]).
   Recebe: t — o item.
   Devolve: a lista (vazia sem subtickets). */
function qaSubticketsDe(t) {
  return t && Array.isArray(t.subtickets) ? t.subtickets.filter(function (s) { return s && typeof s.cartao === 'string'; }) : [];
}

/* O id de um item na lista pela chave do cartão: o do ticket quando o cartão
   tem um (os de QA), a própria chave nos outros.
   Recebe: chave — 'KAN-N' ou 'KAN-N-X'.
   Devolve: o id. */
function qaIdDoCartao(chave) {
  var t = (qaLista.tickets || []).filter(function (x) { return x.cartao === chave; })[0];
  return t ? t.id : chave;
}

/* --------------------------------------------------------- os comentários */

/* Os comentários de um ticket: os do cartão dele no kanban (a mesma
   conversa que se vê lá), do mais antigo para o mais recente — à espera
   enquanto não chegaram, a falha com «Tentar de novo», o vazio, ou a lista
   (quem, quando e o texto com as mudanças de linha; o que está a ir para o
   servidor diz «a enviar…»). Por baixo, o que comentar faz
   (qaColunaDepoisDoComentario): num ticket fora da fila (A fazer e Auto
   Tests), passa-o a A fazer; num cartão sem ticket, só em Human Tests (como
   no kanban).
   Recebe: L — a camada do item (null antes de abrir: à espera); t — o item.
   Devolve: o HTML (texto). */
function qaHtmlComentarios(L, t) {
  var coms = L ? L.qaComs : null, prov = L && L.qaProvisorio ? [L.qaProvisorio] : [];
  var depois = t ? qaColunaDepoisDoComentario(t) : QA_COL_NOVO;
  var dica = !t || t.status === QA_COL_EM_CURSO || (qaTemTicket(t) && t.status === QA_COL_NOVO)
    ? '<p class="hint qa-coms-dica">Quem programa responde aqui, ao resolver.</p>'
    : depois !== t.status
      ? '<p class="hint qa-coms-dica">Comentar passa o ' + (qaTemTicket(t) ? 'ticket' : 'cartão') + ' a A fazer, para quem programa responder.</p>'
      : '<p class="hint qa-coms-dica">O comentário fica no cartão do kanban.</p>';
  if (coms === 'falhou') {
    return '<div class="qa-coms-falhou"><span class="small">Não deu para carregar os comentários.</span>' +
      '<button type="button" class="btn sm" data-toca="vista" data-click="qaComentariosDeNovo()">Tentar de novo</button></div>' + qaHtmlListaComentarios(prov) + dica;
  }
  if (coms === null || coms === undefined) {
    return '<div class="espera qa-coms-espera"><span class="roda" aria-hidden="true"></span><span>A carregar os comentários…</span></div>' + qaHtmlListaComentarios(prov) + dica;
  }
  var todos = coms.concat(prov);
  if (!todos.length) return '<p class="hint qa-coms-vazio">Ainda não há comentários.</p>' + dica;
  return qaHtmlListaComentarios(todos) + dica;
}

/* A lista dos comentários, um por item, cada um com os anexos que vieram
   com ele (qaHtmlAnexos); o que vai a caminho diz os nomes dos ficheiros
   que leva.
   Recebe: cs — os comentários ({autor: {nome}, texto, created_at, meu, aEnviar, anexos?, aAnexar?}).
   Devolve: o HTML (texto, '' sem nenhum). */
function qaHtmlListaComentarios(cs) {
  if (!cs.length) return '';
  return '<ol class="qa-coms-itens">' + cs.map(function (c) {
    var a = c.autor && typeof c.autor === 'object' ? c.autor : {};
    var quem = String(a.nome || a.id || 'Alguém') + (c.meu ? ' (eu)' : '');
    var aAnexar = Array.isArray(c.aAnexar) && c.aAnexar.length ? '<p class="small qa-com-a-anexar">' + ic('clip', 14) + ' ' + esc(c.aAnexar.join(', ')) + '</p>' : '';
    return '<li class="qa-com' + (c.aEnviar ? ' a-enviar' : '') + '">' +
      '<p class="small qa-quem">' + esc(quem) + ' · ' + esc(c.aEnviar ? 'a enviar…' : qaQuando(c.created_at)) + '</p>' +
      qaHtmlTexto(c.texto, 'qa-com-txt') + qaHtmlAnexos(c.anexos, 'Anexos do comentário') + aAnexar + '</li>';
  }).join('') + '</ol>';
}

/* O campo para comentar: o comentário (obrigatório, a não ser que vá só
   com anexos; o erro aparece junto dele: qaComentar), os ficheiros a anexar
   (qaHtmlCaixaAnexos('com'), KAN-165) e, por baixo, «Anexar» e «Comentar».
   Nasce com a janela e não se repinta (os escolhidos repintam-se sozinhos).
   Devolve: o HTML (texto). */
function qaHtmlComentar() {
  return '<div class="qa-campo qa-comentar">' +
    '<label>Comentário <span class="req">*</span>' +
      '<textarea id="qa_com" maxlength="4000" rows="2" placeholder="Ex: Continua a acontecer no tema escuro."></textarea></label>' +
    qaHtmlCaixaAnexos('com') +
    '<div class="qa-comentar-acoes">' +
      '<button type="button" class="btn" id="qa_com_anexar" data-toca="rascunho" data-click="abrirSeletorFicheiros(\'qa_com_anx_in\')">' + ic('clip', 16) + ' Anexar</button>' +
      '<button type="button" class="btn" id="qa_com_btn" data-toca="dados" data-click="qaComentar()">Comentar</button>' +
    '</div>' +
    '</div>';
}

/* Colar (Ctrl+V) uma imagem na janela de um ticket: vai para os anexos da
   resposta (qaJuntarAnexos('com')); o texto cola-se como sempre.
   Recebe: e — o ClipboardEvent do paste (ouvido na janela).
   Devolve: true se tinha uma imagem. */
function qaColarNaResposta(e) {
  var dados = e && e.clipboardData;
  if (!dados || !qaCamadaTicket) return false;
  var f = qaImagemColada(dados);
  if (!f) return false;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  qaJuntarAnexos('com', [f]);
  return true;
}

/* Pede os comentários do ticket aberto (GET /api/qa/:id/comentarios, com
   os anexos de cada um e os do cartão) e pinta-os; falhando, diz que não deu, com «Tentar de novo». Só a janela de
   um ticket os pede: a lista não os traz.
   Recebe: L — a camada do ticket.
   Devolve: Promise com true se chegaram. */
function qaCarregarComentarios(L) {
  if (!L || !L.qaId) return Promise.resolve(false);
  var id = L.qaId;
  return Promise.resolve().then(function () { return api('GET', '/api/qa/' + encodeURIComponent(id) + '/comentarios'); }).then(function (r) {
    L.qaComs = (r && Array.isArray(r.comentarios) ? r.comentarios : []).filter(function (c) { return c && typeof c === 'object' && c.id; });
    L.qaAnexos = r && Array.isArray(r.anexos) ? r.anexos : [];
    qaPintarComentarios(L);
    return true;
  }, function () {
    L.qaComs = 'falhou';
    qaPintarComentarios(L);
    return false;
  });
}

/* «Tentar de novo» nos comentários do ticket aberto.
   Devolve: nada. */
function qaComentariosDeNovo() {
  var L = qaCamadaTicket;
  if (!L) return;
  L.qaComs = null;
  qaPintarComentarios(L);
  qaCarregarComentarios(L);
}

/* Repinta só os comentários da janela de um ticket, e os anexos do item,
   se ela ainda estiver aberta (o campo de comentar fica como está), e põe
   as miniaturas das imagens (qaCarregarMiniaturas).
   Recebe: L — a camada do ticket.
   Devolve: nada. */
function qaPintarComentarios(L) {
  if (!L || !L.el || typeof L.el.querySelector !== 'function') return;
  if (typeof modalStack !== 'undefined' && modalStack.indexOf(L) < 0) return;
  var caixa = L.el.querySelector('.qa-coms-lista');
  if (!caixa) return;
  var t = (qaLista.tickets || []).filter(function (x) { return x.id === L.qaId; })[0] || { status: L.qaStatus };
  caixa.innerHTML = qaSemEtiquetas(qaHtmlComentarios(L, t));
  var anx = L.el.querySelector('.qa-anx-item');
  if (anx) anx.innerHTML = qaSemEtiquetas(qaHtmlAnexos(L.qaAnexos, 'Anexos do ticket'));
  qaCarregarMiniaturas(L);
}

/* O HTML sem etiquetas que correm (a segunda tranca da casa, quando existe).
   Recebe: h — o HTML.
   Devolve: o HTML. */
function qaSemEtiquetas(h) {
  return typeof semEtiquetasQueCorrem === 'function' ? semEtiquetasQueCorrem(h) : h;
}

/* O botão «Comentar» ocupado (a enviar) ou livre; com uma resposta já
   guardada a que faltam anexos (L.qaPendente), «Enviar os anexos».
   Recebe: ocupado — true durante o envio.
   Devolve: nada. */
function qaBotaoComentar(ocupado) {
  var b = document.getElementById('qa_com_btn'), L = qaCamadaTicket;
  if (!b) return;
  b.disabled = !!ocupado;
  if (ocupado) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
  var pendente = !!(L && L.qaPendente && qaEscolhidosDe('com').some(function (a) { return a.estado !== 'subiu'; }));
  b.textContent = ocupado ? 'A enviar…' : pendente ? 'Enviar os anexos' : 'Comentar';
}

/* «Comentar» no ticket aberto (POST /api/qa/:id/comentarios {texto,
   anexos?}). O comentário é obrigatório, a não ser que leve anexos (o
   servidor escreve então «Anexei 2 ficheiros.»: rotas/qa.js:textoDoComentario;
   o erro junto ao campo, componentes.js:falhaCampo), e até 4000 caracteres;
   com uma imagem ainda a preparar, espera-se por ela. Otimista, como o
   mover (qaColunaNoEcra): o comentário aparece logo na lista, «a enviar…»,
   com os nomes dos ficheiros, o campo esvazia-se e o ticket passa a A
   fazer (fora da fila) na lista, no número da pílula e no selo; com a
   resposta, sobem os anexos, um a um, com o id do comentário
   (qaSubirEscolhidos), e a conversa pede-se outra vez. Falhando o
   comentário, tudo volta a como estava — o ticket à coluna de antes, o
   texto ao campo — e o erro diz porquê, junto ao campo. Falhando só algum
   anexo, o comentário fica, os que falharam ficam escolhidos com o erro, e
   o botão passa a «Enviar os anexos», que os tenta outra vez no mesmo
   comentário (qaEnviarPendentes). Um pedido de cada vez por ticket (qaOcupado).
   Devolve: Promise com true se o servidor guardou o comentário (e os anexos). */
function qaComentar() {
  var L = qaCamadaTicket;
  if (!L || !L.qaId) return Promise.resolve(false);
  var id = L.qaId, campo = document.getElementById('qa_com');
  if (qaOcupado[id]) return Promise.resolve(false);
  var escolhidos = qaEscolhidosDe('com');
  if (L.qaPendente && escolhidos.some(function (a) { return a.estado !== 'subiu'; })) return qaEnviarPendentes(L);
  var texto = String(campo ? campo.value : '').replace(/\r\n?/g, '\n').trim();
  if (qaAPreparar(escolhidos)) { qaErroAnexos('com', 'Espera que as imagens fiquem prontas.'); return Promise.resolve(false); }
  var vao = escolhidos.filter(function (a) { return a.estado !== 'subiu'; });
  if (!texto && !vao.length) { falhaCampo('qa_com', 'Escreve o comentário ou anexa um ficheiro.'); return Promise.resolve(false); }
  if (texto.length > 4000) { falhaCampo('qa_com', 'O comentário passa dos 4000 caracteres. Encurta-o.'); return Promise.resolve(false); }
  qaOcupado[id] = 1;
  var eu = window.CW && CW.user ? CW.user : {};
  var t = (qaLista.tickets || []).filter(function (x) { return x.id === id; })[0];
  var para = qaColunaDepoisDoComentario(t || { status: L.qaStatus });
  var fica = (t ? t.status : L.qaStatus) === para;
  var palavra = t && !qaTemTicket(t) ? 'O cartão' : 'O ticket';
  var n = vao.length;
  L.qaProvisorio = {
    id: 'a-enviar', autor: { id: eu.id || '', nome: eu.name || eu.email || 'Eu' }, created_at: Date.now(), meu: true, aEnviar: true,
    texto: texto || (n === 1 ? 'Anexei um ficheiro.' : 'Anexei ' + n + ' ficheiros.'), aAnexar: vao.map(function (a) { return a.nome; }),
  };
  if (campo) campo.value = '';
  qaErroAnexos('com', '');
  qaBotaoComentar(true);
  qaPintarComentarios(L);
  var repor = fica ? function () {} : qaColunaNoEcra(id, para);
  var corpo = n ? { texto: texto, anexos: n } : { texto: texto };
  return api('POST', '/api/qa/' + encodeURIComponent(id) + '/comentarios', corpo).then(function (r) {
    L.qaProvisorio = null;
    if (r && r.comentario && Array.isArray(L.qaComs)) L.qaComs = L.qaComs.concat([r.comentario]);
    if (Array.isArray(L.qaComs)) qaPintarComentarios(L);
    toast(fica ? 'Comentário enviado.' : 'Comentário enviado. ' + palavra + ' passou a ' + qaNomeDaColuna(para) + '.');
    qaCarregar();
    if (!n || !r || !r.comentario || !r.comentario.id) {
      delete qaOcupado[id];
      qaBotaoComentar(false);
      if (!Array.isArray(L.qaComs)) qaCarregarComentarios(L);
      return true;
    }
    L.qaPendente = r.comentario.id;
    return qaAnexarAoComentario(L, vao);
  }, function (e) {
    delete qaOcupado[id];
    L.qaProvisorio = null;
    repor();
    qaBotaoComentar(false);
    qaPintarComentarios(L);
    var c = document.getElementById('qa_com');
    if (c && texto && !String(c.value || '').trim()) c.value = texto;
    falhaCampo('qa_com', (e && e.message) || 'Não deu para enviar o comentário.');
    if (e && e.status === 404) qaCarregar();
    return false;
  });
}

/* Sobe os anexos de uma resposta já guardada (L.qaPendente: o id do
   comentário), um a um, e pede a conversa outra vez para os mostrar no
   comentário. Sobem só os que foram com ela (lista): um ficheiro escolhido
   entretanto fica na caixa, para a resposta seguinte. Os que subiram saem
   da caixa; falhando algum, ficam os que falharam, com o erro, e o botão
   diz «Enviar os anexos». Com a janela já fechada (ou outra aberta), não
   mexe no ecrã.
   Recebe: L — a camada do ticket (com qaOcupado[L.qaId] já posto); lista — os escolhidos que vão.
   Devolve: Promise com true se subiram todos. */
function qaAnexarAoComentario(L, lista) {
  var id = L.qaId;
  return qaSubirEscolhidos(id, lista, L.qaPendente, 'com').then(function (falha) {
    delete qaOcupado[id];
    var subiram = lista.filter(function (a) { return a.estado === 'subiu'; });
    qaLargarEscolhidos(subiram);
    L.qaEscolhidos = (L.qaEscolhidos || []).filter(function (a) { return subiram.indexOf(a) < 0; });
    if (!falha) L.qaPendente = null;
    if (qaCamadaTicket !== L) return !falha;
    qaPintarEscolhidos('com');
    if (falha) qaErroAnexos('com', 'O comentário ficou, mas ' + falha + ' Toca em «Enviar os anexos» para tentar outra vez.');
    qaBotaoComentar(false);
    qaCarregarComentarios(L);
    qaCarregar();
    return !falha;
  });
}

/* «Enviar os anexos»: os que faltaram de uma resposta já guardada, outra
   vez, no mesmo comentário (qaAnexarAoComentario).
   Recebe: L — a camada do ticket.
   Devolve: Promise com true se subiram todos. */
function qaEnviarPendentes(L) {
  var id = L.qaId;
  if (qaOcupado[id]) return Promise.resolve(false);
  if (qaAPreparar(L.qaEscolhidos)) { qaErroAnexos('com', 'Espera que as imagens fiquem prontas.'); return Promise.resolve(false); }
  qaOcupado[id] = 1;
  qaErroAnexos('com', '');
  qaBotaoComentar(true);
  return qaAnexarAoComentario(L, (L.qaEscolhidos || []).filter(function (a) { return a.estado !== 'subiu'; }));
}

/* Para onde vai um item quando se comenta nele, como o servidor faz (pedido
   do Martinho, 2026-11-15, KAN-140: para A fazer, não para Auto Tests): um
   ticket de QA vai a A fazer de qualquer coluna, menos se já está na fila
   (A fazer ou Auto Tests), onde fica (lib/kanban.js:colunaDoComentarioQa);
   um cartão sem ticket só sai de Human Tests, para A fazer — recusar é
   comentar o que está mal — e noutra coluna fica
   (lib/kanban.js:colunaDepoisDoComentario).
   Recebe: t — o item ({status, ticket}).
   Devolve: o id da coluna depois do comentário. */
function qaColunaDepoisDoComentario(t) {
  if (qaTemTicket(t)) return t.status === QA_COL_NOVO || t.status === QA_COL_EM_CURSO ? t.status : QA_COL_NOVO;
  return t.status === QA_COL_RESOLVIDO ? QA_COL_NOVO : t.status;
}

/* A cor do selo de uma coluna: Auto Tests no roxo do QA ('loan'), Human
   Tests e as de fim no verde ('in'), as outras no selo neutro ('grey'). A
   cor é a da frente e a do fundo: no escurecimento forçado do Samsung
   Internet, a da frente fica.
   Recebe: id — o id da coluna.
   Devolve: a classe do selo. */
function qaCorDaColuna(id) {
  if (id === QA_COL_EM_CURSO) return 'loan';
  if (qaColunaResolvida(id)) return 'in';
  return 'grey';
}

/* O selo do estado de um ticket: o nome da coluna do kanban onde está, na
   cor dela (qaCorDaColuna). Uma coluna que não se conhece diz o próprio id.
   Recebe: status — o do ticket (o id da coluna).
   Devolve: o HTML (texto). */
function qaSeloEstado(status) {
  return '<span class="badge ' + qaCorDaColuna(status) + '">' + esc(qaNomeDaColuna(status)) + '</span>';
}

/* O rodapé da janela de um item: «Remover» num ticket de QA (com Anular,
   por isso sem pergunta; leva o cartão com ele) — num cartão sem ticket não
   há, porque remover um cartão é do master, no kanban — e, a seguir:
   - em Human Tests, só as três decisões de quem testa (qaHtmlDecisoes), em
     vez do «Mover» (pedido do Martinho, 2026-11-11: «em vez do mover, não
     adicionalmente») — o ticket está à espera de um sim ou de um não; num
     pai com subtickets ainda em Human Tests (KAN-162), nenhuma: decide-se em
     cada subticket e o pai segue-os («Mover» e «Fechar», como nas outras);
   - nas outras colunas, «Mover» (as outras colunas do kanban, num menu de
     ações: qaHtmlMover) e, a acabar, «Enviar para produção» em Adiado (vai
     a Staging: qaEnviarProducao), «Reabrir» numa outra coluna de fim (volta
     a A fazer) ou «Fechar».
   O cartão de um pedido de uma pessoa só se lê: só «Fechar».
   Recebe: t — o ticket.
   Devolve: o HTML (texto). */
function qaRodapeTicket(t) {
  var id = jsq(t.id);
  var fechar = '<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>';
  if (qaEPedido(t)) return fechar;
  var remover = !qaTemTicket(t) ? '' : '<button type="button" class="btn qa-remover" data-toca="dados" data-risco="destroi" data-click="qaRemover(\'' + id + '\')">' + ic('trash', 16) + '<span class="qa-remover-txt"> Remover</span></button>';
  // um pai com subtickets por decidir decide-se em cada um (KAN-162): o cartão segue-os
  var decideNosFilhos = qaSubticketsDe(t).some(function (s) { return s.status === QA_COL_RESOLVIDO; });
  if (t.status === QA_COL_RESOLVIDO && !decideNosFilhos) return remover + qaHtmlDecisoes(t);
  if (t.status === QA_COL_RESOLVIDO) return remover + qaHtmlMover(t) + fechar;
  var fim = t.status === QA_COL_ADIADO
    ? '<button type="button" class="btn primary" data-toca="dados" data-click="qaEnviarProducao(\'' + id + '\')">Enviar para produção</button>'
    : qaColunaResolvida(t.status)
      ? '<button type="button" class="btn primary" data-toca="dados" data-click="qaReabrir(\'' + id + '\')">Reabrir</button>'
      : fechar;
  return remover + qaHtmlMover(t) + fim;
}

/* As decisões sobre um ticket em Human Tests, juntas no rodapé a seguir ao
   «Remover» (.qa-decisoes: na mesma linha quando cabem, numa linha só delas
   quando não, e partidas em duas quando nem assim): «Recusar» (volta a A
   fazer, pelo reabrir, que guarda a resolução como anterior: qaRecusar),
   «Adiar a produção» (para Adiado, resolvido mas a ficar no dev:
   qaAdiarProducao) e «Enviar para produção» (para Staging, vai no próximo
   promove: qaEnviarProducao), o primário, no fim (KAN-157).
   Recebe: t — o ticket.
   Devolve: o HTML (texto). */
function qaHtmlDecisoes(t) {
  var id = jsq(t.id);
  return '<div class="qa-decisoes">' +
    '<button type="button" class="btn" data-toca="dados" data-click="qaRecusar(\'' + id + '\')">Recusar</button>' +
    '<button type="button" class="btn" data-toca="dados" data-click="qaAdiarProducao(\'' + id + '\')">Adiar a produção</button>' +
    '<button type="button" class="btn primary" data-toca="dados" data-click="qaEnviarProducao(\'' + id + '\')">Enviar para produção</button>' +
    '</div>';
}

/* «Mover»: o botão e o menu de ações da casa (.menupop, aberto pelo
   menuOpen; o data-menu="acoes" diz ao percurso que é um menu com nome
   próprio, como o da pílula) com as outras colunas do kanban, pela ordem do
   quadro, menos Produção (quem leva para lá é o promove, e a pílula não a
   mostra). Cada uma passa o ticket para lá (qaMover). Sem outra coluna para
   onde ir, nada.
   Recebe: t — o ticket.
   Devolve: o HTML (texto, '' sem outras colunas). */
function qaHtmlMover(t) {
  var outras = qaColunas().filter(function (c) { return c.id !== t.status && c.id !== QA_COL_PRODUCAO; });
  if (!outras.length) return '';
  var id = jsq(t.id);
  return '<span class="menuwrap qa-mover" data-menu="acoes">' +
      '<button type="button" class="btn" data-toca="camada" data-click="menuOpen(event,\'qaMover\')" aria-expanded="false">' + ic('swap', 16) + ' Mover</button>' +
      '<div class="menupop" id="menu_qaMover">' + outras.map(function (c) {
        return '<button type="button" data-toca="dados" data-click="closePops();qaMover(\'' + id + '\',\'' + jsq(c.id) + '\')">' + ic('swap', 17) + ' ' + esc(c.nome) + '</button>';
      }).join('') + '</div>' +
    '</span>';
}

/* Repinta a janela de um ticket com o que mudou (reaberto, comentado, ou
   resolvido noutro sítio), sem voltar a pedir a captura que já cá está: o
   de cima, os comentários e o rodapé trocam-se, e o campo de comentar fica
   onde está — quem estava a escrever não perde o texto nem a composição do
   teclado (docs/armadilhas.md, «Um campo que sai do documento perde a
   composição do teclado»). Uma janela sem essas peças repinta-se inteira.
   Recebe: L — a camada; t — o ticket de agora.
   Devolve: nada. */
function qaRepintarTicket(L, t) {
  if (!L || !L.el) return;
  L.qaStatus = t.status; L.qaAtualizado = t.updated_at;
  var q = typeof L.el.querySelector === 'function' ? function (s) { return L.el.querySelector(s); } : function () { return null; };
  var topo = q('.qa-ver-topo'), lista = q('.qa-coms-lista'), pe = q('.foot');
  if (topo && lista && pe) {
    topo.innerHTML = qaSemEtiquetas(qaHtmlTopo(t));
    lista.innerHTML = qaSemEtiquetas(qaHtmlComentarios(L, t));
    pe.innerHTML = qaSemEtiquetas(qaRodapeTicket(t));
    qaCarregarMiniaturas(L);
  } else {
    fillModal(L.el, qaTituloDaJanela(t), qaHtmlTicket(t), qaRodapeTicket(t));
    qaPintarComentarios(L);
  }
  if (L.qaUrl) qaMostrarImagem(L, L.qaUrl);
  else if (t.imagem) qaCarregarImagem(L, t.id);
}

/* Vai buscar a captura de um ticket com a sessão (GET /api/qa/:id/imagem) e
   mostra-a; falhando, diz que não deu, com «Tentar de novo».
   Recebe: L — a camada do ticket; id — o id do ticket.
   Devolve: Promise que acaba quando a imagem chega (ou falha). */
function qaCarregarImagem(L, id) {
  var h = typeof cabecalhosDaSessao === 'function' ? cabecalhosDaSessao() : {};
  return fetch('/api/qa/' + encodeURIComponent(id) + '/imagem', { headers: h, credentials: 'same-origin' })
    .then(function (resp) {
      if (!resp.ok) throw new Error('Erro ' + resp.status);
      return resp.blob();
    })
    .then(function (blob) {
      if (typeof modalStack === 'undefined' || modalStack.indexOf(L) < 0) return false;
      if (L.qaUrl) { try { URL.revokeObjectURL(L.qaUrl); } catch (e) {} }
      L.qaUrl = URL.createObjectURL(blob);
      qaMostrarImagem(L, L.qaUrl);
      return true;
    })
    .catch(function () {
      var caixa = L.el && typeof L.el.querySelector === 'function' ? L.el.querySelector('.qa-ver-img') : null;
      if (!caixa) return false;
      caixa.classList.remove('a-carregar'); caixa.classList.add('falhou'); caixa.removeAttribute('aria-busy');
      caixa.innerHTML = '<span class="small">Não deu para carregar a captura.</span>' +
        '<button type="button" class="btn sm" data-toca="vista" data-click="qaImagemDeNovo()">Tentar de novo</button>';
      return false;
    });
}

/* Põe a captura já carregada na caixa da janela do ticket.
   Recebe: L — a camada; url — o object URL.
   Devolve: nada. */
function qaMostrarImagem(L, url) {
  var caixa = L.el && typeof L.el.querySelector === 'function' ? L.el.querySelector('.qa-ver-img') : null;
  if (!caixa) return;
  caixa.classList.remove('a-carregar'); caixa.classList.remove('falhou'); caixa.removeAttribute('aria-busy');
  caixa.innerHTML = '<img src="' + esc(url) + '" alt="A captura de ecrã do ticket">';
}

/* «Tentar de novo» na captura do ticket aberto.
   Devolve: nada. */
function qaImagemDeNovo() {
  var L = qaCamadaTicket;
  if (!L) return;
  var caixa = L.el.querySelector('.qa-ver-img');
  if (caixa) { caixa.classList.remove('falhou'); caixa.classList.add('a-carregar'); caixa.innerHTML = ''; }
  qaCarregarImagem(L, L.qaId);
}

/* Remove um ticket (DELETE: remoção branda) e oferece o Anular no aviso,
   seis segundos — o Anular repõe-no (qaRepor). Por isso não pergunta antes.
   Fecha a janela do ticket, se for ele que está aberto, e a lista atualiza-se.
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou removido. */
function qaRemover(id) {
  if (qaOcupado[id]) return Promise.resolve(false);
  qaOcupado[id] = 1;
  return api('DELETE', '/api/qa/' + encodeURIComponent(id)).then(function () {
    delete qaOcupado[id];
    var T = qaCamadaTicket;
    if (T && T.qaId === id && typeof modalTop === 'function' && modalTop() === T) closeModal();
    if (qaLista.tickets) {
      qaLista.tickets = qaLista.tickets.filter(function (x) { return x.id !== id; });
      qaAbertos = qaSeccoes(qaLista.tickets).abertos.length;
      qaPintarNumero();
      qaPintarLista();
    }
    toast('Ticket removido.', { rotulo: 'Anular', ms: 6000, fn: function () { qaRepor(id); } });
    qaCarregar();
    return true;
  }, function (e) {
    delete qaOcupado[id];
    toast((e && e.message) || 'Não deu para remover o ticket.');
    if (e && e.status === 404) qaCarregar();
    return false;
  });
}

/* O Anular de um remover: o ticket volta (POST /api/qa/:id/repor).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se voltou. */
function qaRepor(id) {
  return api('POST', '/api/qa/' + encodeURIComponent(id) + '/repor').then(function () {
    toast('Ticket reposto.');
    qaCarregar();
    return true;
  }, function (e) {
    toast((e && e.message) || 'Não deu para repor o ticket.');
    return false;
  });
}

/* Reabre um ticket resolvido (POST /api/qa/:id/reabrir): volta a A fazer,
   e a resolução fica, a dizer «Resolução anterior». Otimista, como o mover
   (qaPassarDeColuna).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou reaberto. */
function qaReabrir(id) {
  var p = qaPalavra(id);
  return qaPassarDeColuna(id, QA_COL_NOVO, '/reabrir', undefined, p + ' reaberto.', 'Não deu para reabrir o ' + p.toLowerCase() + '.');
}

/* «Enviar para produção» um ticket em Human Tests ou em Adiado: passa a
   Staging, e vai no próximo promove (POST /api/qa/:id/mover). Otimista
   (qaPassarDeColuna).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou em Staging. */
function qaEnviarProducao(id) {
  var p = qaPalavra(id);
  return qaPassarDeColuna(id, QA_COL_STAGING, '/mover', { coluna: QA_COL_STAGING },
    p + ' em ' + qaNomeDaColuna(QA_COL_STAGING) + ': vai no próximo promove.', 'Não deu para enviar o ' + p.toLowerCase() + ' para produção.');
}

/* «Adiar a produção» de um ticket em Human Tests: passa a Adiado —
   resolvido, fica no dev até alguém o enviar para produção (POST
   /api/qa/:id/mover). Otimista (qaPassarDeColuna).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou em Adiado. */
function qaAdiarProducao(id) {
  var p = qaPalavra(id);
  return qaPassarDeColuna(id, QA_COL_ADIADO, '/mover', { coluna: QA_COL_ADIADO },
    p + ' em ' + qaNomeDaColuna(QA_COL_ADIADO) + ': fica no dev.', 'Não deu para adiar a produção do ' + p.toLowerCase() + '.');
}

/* «Recusar» um ticket em Human Tests: volta a A fazer pelo reabrir (POST
   /api/qa/:id/reabrir), e a resolução fica como «Resolução anterior», para
   quem pegar nele de novo ver o que se tentou. Otimista (qaPassarDeColuna).
   Recebe: id — o id do ticket.
   Devolve: Promise com true se ficou recusado. */
function qaRecusar(id) {
  var p = qaPalavra(id);
  return qaPassarDeColuna(id, QA_COL_NOVO, '/reabrir', undefined, p + ' recusado.', 'Não deu para recusar o ' + p.toLowerCase() + '.');
}

/* «Mover» uma coluna do kanban (POST /api/qa/:id/mover {coluna}): o
   ticket e o cartão dele passam para lá. Otimista (qaPassarDeColuna).
   Recebe: id — o id do ticket; coluna — o id da coluna para onde vai.
   Devolve: Promise com true se ficou movido. */
function qaMover(id, coluna) {
  if (typeof coluna !== 'string' || !QA_ID_COLUNA.test(coluna)) return Promise.resolve(false);
  var p = qaPalavra(id);
  return qaPassarDeColuna(id, coluna, '/mover', { coluna: coluna },
    p + ' movido para ' + qaNomeDaColuna(coluna) + '.', 'Não deu para mover o ' + p.toLowerCase() + '.');
}

/* Passa um ticket para outra coluna, à maneira otimista: a lista, o número
   da pílula e o ticket aberto mudam logo (o resolved_at como o servidor o
   põe: posto ao chegar a uma coluna resolvida, null nas outras), o pedido
   segue, e no fim pede-se a lista outra vez. Falhando, o ticket volta a
   como estava e o aviso diz porquê (num 404, o ticket já não existe: pede-se
   a lista). Um pedido de cada vez por ticket (qaOcupado).
   Recebe: id — o id do ticket; coluna — o id da coluna; fim — o fim do
   caminho ('/reabrir' ou '/mover'); corpo — o corpo do POST (ou
   undefined); frase — o aviso de quando correu bem; falha — o aviso de
   quando falhou sem frase do servidor.
   Devolve: Promise com true se o servidor aceitou. */
function qaPassarDeColuna(id, coluna, fim, corpo, frase, falha) {
  if (qaOcupado[id]) return Promise.resolve(false);
  qaOcupado[id] = 1;
  var repor = qaColunaNoEcra(id, coluna);
  var caminho = '/api/qa/' + encodeURIComponent(id) + fim;
  var pedido = corpo === undefined ? api('POST', caminho) : api('POST', caminho, corpo);
  return pedido.then(function () {
    delete qaOcupado[id];
    toast(frase);
    qaCarregar();
    return true;
  }, function (e) {
    delete qaOcupado[id];
    repor();
    toast((e && e.message) || falha);
    if (e && e.status === 404) qaCarregar();
    return false;
  });
}

/* Passa já, no ecrã, um ticket para outra coluna — a lista, o número da
   pílula e o ticket aberto —, com o resolved_at como o servidor o põe
   (posto ao chegar a uma coluna resolvida, null nas outras), antes de o
   servidor responder (qaPassarDeColuna, qaComentar).
   Recebe: id — o id do ticket; coluna — o id da coluna.
   Devolve: a função que o põe como estava (nada faz sem o ticket na lista). */
function qaColunaNoEcra(id, coluna) {
  var t = (qaLista.tickets || []).filter(function (x) { return x.id === id; })[0];
  var repintar = function () {
    if (!qaLista.tickets) return;
    qaAbertos = qaSeccoes(qaLista.tickets).abertos.length;
    qaPintarNumero();
    qaPintarLista();
  };
  if (!t) return function () {};
  var antes = { status: t.status, resolved_at: t.resolved_at, updated_at: t.updated_at };
  t.status = coluna;
  t.resolved_at = qaColunaResolvida(coluna) ? (t.resolved_at || Date.now()) : null;
  t.updated_at = Date.now();
  repintar();
  return function () {
    t.status = antes.status; t.resolved_at = antes.resolved_at; t.updated_at = antes.updated_at;
    repintar();
  };
}

/* ---------------------------------------------------------- os embrulhos */

/* A pílula segue o render, pela reatribuição da casa (cloud/nucleo.js,
   cloud/apresentacao.js): é ele que chega quando o ambiente se sabe
   (cloud/guia.js), quando se entra e quando se sai. O render do vizinho que o
   carrossel dos separadores pinta às escondidas (vistas.js:pintarVistaAParte)
   não conta. */
var qaRenderDeAntes = render;
render = function () {
  var r = qaRenderDeAntes.apply(this, arguments);
  if (!(typeof _pintarAParte !== 'undefined' && _pintarAParte)) {
    try { qaSincronizar(); } catch (e) {}
  }
  return r;
};

/* Uma janela que abre ou fecha muda os limites da pílula (qaLimites: acima do
   rodapé da janela da frente). Reencaixa-se depois de quem a abriu a marcar
   como do QA (qaMarcarJanela) e outra vez quando a saída acaba.
   Devolve: nada. */
function qaJanelaMudou() {
  if (!qaPil) return;
  setTimeout(function () { try { qaReencaixar(); } catch (e) {} }, 0);
  setTimeout(function () { try { qaReencaixar(); } catch (e) {} }, msDoToken('--medio', 200) + 120);
}
var qaOpenModalDeAntes = openModal;
openModal = function () {
  var L = qaOpenModalDeAntes.apply(this, arguments);
  qaJanelaMudou();
  return L;
};
var qaCloseModalDeAntes = closeModal;
closeModal = function () {
  var r = qaCloseModalDeAntes.apply(this, arguments);
  qaJanelaMudou();
  return r;
};
var qaCloseAllModalsDeAntes = closeAllModals;
closeAllModals = function () {
  var r = qaCloseAllModalsDeAntes.apply(this, arguments);
  qaJanelaMudou();
  return r;
};

// o clique que vem a seguir a um arrasto da pílula engole-se na captura, antes da ação do botão
document.addEventListener('click', qaEngoleClique, true);
// rodar o telemóvel ou mudar a janela de tamanho reencaixa a pílula
window.addEventListener('resize', qaAoMudarTamanho);
window.addEventListener('orientationchange', qaAoMudarTamanho);
// voltar à app atualiza o número por concluir (sem sondar em ciclo)
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && qaPil) qaCarregar();
});
