/* Documentos legais, aceitacao dos termos e pedidos de ajuda. */
'use strict';

/* ---------------- pedidos de ajuda e sugestões ---------------- */

/* O selo de cada estado de um pedido, nas cores do canvas (M-Ajuda): o que
   chegou e ninguém viu é cobalto (como o «por confirmar»), o que está a ser
   tratado é âmbar, e o concluído é verde. */
var TK_STATUS = {
  criado: { label: 'Recebido', cor: '' },
  resolucao: { label: 'Em resolução', cor: 'amber' },
  concluido: { label: 'Concluído', cor: 'in' },
};
CW.tickets = null;          // null: ainda não sabemos; [] : não há pedidos
CW._ticketsFalhou = false;  // a última leitura falhou — diz-se, e só se tenta de novo a pedido

// Vai buscar os pedidos do utilizador à API, um pedido de cada vez; quando a
// resposta chega (ou falha), repinta a página de Ajuda se ela estiver à
// vista. A falha NÃO é uma lista vazia: «ainda não enviaste nenhum pedido»
// dito a quem tem pedidos em curso parece perda de dados (docs/design.md,
// «A app não afirma nem decide antes de saber»).
// Devolve: nada — enche CW.tickets (ou marca a falha) e repinta a Ajuda.
function loadTickets() {
  if (CW._ticketsAPedir) return;
  CW._ticketsAPedir = true;
  var repinta = function () { if (tab === 'settings' && setPage === 'ajuda') render(); };
  api('GET', '/api/tickets')
    .then(function (r) { CW._ticketsAPedir = false; CW._ticketsFalhou = false; CW.tickets = r.tickets || []; repinta(); })
    .catch(function () { CW._ticketsAPedir = false; CW._ticketsFalhou = true; repinta(); });
}

// «Tentar de novo» depois de uma falha a carregar os pedidos.
// Devolve: nada — volta a pedir e repinta.
CW.ticketsDeNovo = function () {
  CW._ticketsFalhou = false;
  loadTickets();
  render();
};

/* Um pedido ao suporte como linha do cartão «Os teus pedidos» (o canvas
   M-Ajuda): o selo do estado e «Problema · 12/10/2026» numa linha, o
   assunto por baixo, e a resposta da equipa, quando há, numa caixa à parte.
   Recebe: x — o pedido, como vem da API ({subject, kind, status, created_at, reply}).
   Devolve: o HTML da linha (texto). */
function linhaDoPedidoAjuda(x) {
  var st = TK_STATUS[x.status] || TK_STATUS.criado;
  var d = new Date(x.created_at);
  /* o dia LOCAL, e nao o de UTC: um pedido das 23h30 de Lisboa aparecia com
   o dia seguinte */
  var data = dPT(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  return '<div class="aj-pedido">' +
    '<div class="aj-pedido-cab"><span class="badge' + (st.cor ? ' ' + st.cor : '') + '">' + st.label + '</span>' +
      '<span class="small num">' + (x.kind === 'sugestao' ? 'Sugestão' : 'Problema') + ' · ' + data + '</span></div>' +
    '<p class="aj-pedido-tit">' + esc(x.subject) + '</p>' +
    (x.reply ? '<div class="aj-resposta"><b>Equipa Rendorium:</b> ' + esc(x.reply) + '</div>' : '') +
    '</div>';
}

/* O cabeçalho de uma secção da Ajuda: o título e, à direita, uma nota ou
   uma ação.
   Recebe: titulo — o texto do título; direita (opcional) — o HTML do lado direito.
   Devolve: o HTML do cabeçalho (texto). */
function cabecaDaAjuda(titulo, direita) {
  return '<div class="aj-cab"><h2>' + titulo + '</h2>' + (direita || '') + '</div>';
}

/* A página «Ajuda e sugestões», pela ordem do canvas (M-Ajuda): «Como se
   faz» (os tutoriais, num carrossel), as perguntas frequentes em destaque
   com a porta para todas, «Os teus pedidos» com «Novo pedido» e a resposta
   da equipa, e, no fim, as novidades, os termos, a privacidade e a versão.
   À primeira passagem dispara o loadTickets e repinta quando os pedidos
   chegarem; enquanto não chegam não afirma nada, e se não deu para os
   carregar diz isso, com um botão para tentar de novo.
   Recebe: nada.
   Devolve: o HTML da página, como string. */
function vAjuda() {
  if (CW.tickets === null && !CW._ticketsFalhou) { loadTickets(); }
  var t = CW.tickets || [];
  var pedidos = CW.tickets === null
    ? (CW._ticketsFalhou
      ? '<div class="card aj-cartao"><div class="aj-pedido"><p class="small">Não deu para carregar os teus pedidos — tenta de novo.</p>' +
        '<div><button class="btn sm" data-toca="dados" data-click="CW.ticketsDeNovo()">Tentar de novo</button></div></div></div>'
      : '<div class="espera aj-espera"><span class="roda" aria-hidden="true"></span><span><b>À espera do servidor.</b> Os teus pedidos aparecem assim que chegarem.</span></div>')
    : t.length
      /* os em curso primeiro, depois os concluídos (os dez mais recentes) */
      ? '<div class="card aj-cartao">' + t.filter(function (x) { return x.status !== 'concluido'; })
          .concat(t.filter(function (x) { return x.status === 'concluido'; }).slice(0, 10))
          .map(linhaDoPedidoAjuda).join('') + '</div>'
      : '<div class="empty aj-vazio"><b>Ainda não enviaste nenhum pedido.</b>Se algo correu mal, ou te falta alguma coisa, conta-nos — respondemos aqui e por email.</div>';
  var destaque = typeof PERGUNTAS_FREQUENTES !== 'undefined' ? PERGUNTAS_FREQUENTES.filter(function (q) { return q.destaque; }) : [];
  var perguntas = destaque.length
    ? cabecaDaAjuda('Perguntas frequentes') +
      '<div class="card aj-perguntas">' + destaque.map(perguntaHtml).join('') +
        '<button type="button" class="aj-fq aj-todas" data-toca="ecra" data-click="goSet(\'faq\')"><span>Ver as ' + PERGUNTAS_FREQUENTES.length + ' perguntas</span>' + ic('chevR', 18) + '</button>' +
      '</div>'
    : '';
  return '<div class="aj-pagina">' +
    tutoriaisNaAjuda() +
    apresentacoesNaAjuda() +
    perguntas +
    cabecaDaAjuda('Os teus pedidos', '<button type="button" class="btn sm primary" data-toca="camada" data-click="CW.newTicket(\'problema\')">' + ic('plus', 16) + 'Novo pedido</button>') +
    pedidos +
    '<p class="small aj-rodape">' +
      '<a href="#" data-toca="ecra" data-click="event.preventDefault();goSet(\'novidades\')">Novidades</a> · ' +
      '<a href="#" data-toca="camada" data-click="CW.readDoc(event,\'termos\')">Termos</a> · ' +
      '<a href="#" data-toca="camada" data-click="CW.readDoc(event,\'privacidade\')">Privacidade</a>' +
      (typeof VERSAO !== 'undefined' ? ' · <span class="num">versão ' + VERSAO + '</span>' : '') + '</p>' +
    '</div>';
}

/* «Como se faz»: os tutoriais, um mosaico cada, num carrossel que se
   desliza de lado (o canvas M-Ajuda) — quantos passos tem, o título, e o
   selo «Visto» ou o resumo. Quem precisa de um não devia ter de esperar que
   a app lho ofereça na vista geral, nem de dispensar o cartão dos primeiros
   passos para nunca mais lá chegar. No cabeçalho, quantos já viu.
   Recebe: nada.
   Devolve: o HTML da secção "Como se faz", como string — vazia se não houver
   tutoriais. */
function tutoriaisNaAjuda() {
  if (typeof CW.listaDeTutoriais !== 'function') return '';
  var ts = CW.listaDeTutoriais();
  if (!ts.length) return '';
  var vistos = ts.filter(function (t) { return t.visto; }).length;
  return cabecaDaAjuda('Como se faz', '<span class="small num">' + vistos + ' de ' + ts.length + ' vistos</span>') +
    '<div class="aj-tutoriais">' + ts.map(function (t) {
      return '<button type="button" class="aj-tu" data-toca="ecra" data-click="CW.guiaAbrir(\'' + t.id + '\')">' +
        '<span class="small num">' + t.passos + ' passos</span>' +
        '<b>' + esc(t.titulo) + '</b>' +
        (t.visto ? '<span class="badge in">Visto</span>' : '<span class="small">' + esc(t.resumo) + '</span>') +
        '</button>';
    }).join('') + '</div>';
}

/* «Apresentações», ao lado de «Como se faz»: as boas-vindas e a apresentação
   de cada separador que esta conta vê (apresentacao.js:aprDaConta), pela
   ordem da navegação, no mesmo carrossel de mosaicos — quantas imagens tem,
   o nome e o selo «Vista» ou o resumo. Abrir uma daqui é rever: a janela é a
   mesma, e o estado só muda se se chegar à última imagem (apresentacao.js:aprRever).
   No cabeçalho, quantas já viu; por baixo dos mosaicos, enquanto houver
   alguma por ver, «Marcar todas como vistas» (apresentacao.js:aprMarcarTodasVistas).
   Recebe: nada.
   Devolve: o HTML da secção, como string — vazia sem apresentações. */
function apresentacoesNaAjuda() {
  if (typeof aprDaConta !== 'function' || typeof APRESENTACOES === 'undefined') return '';
  var ids = aprDaConta();
  if (!ids.length) return '';
  var tabs = typeof TABS !== 'undefined' ? TABS : [];
  var vistas = ids.filter(function (id) { return aprVista(id); }).length;
  return cabecaDaAjuda('Apresentações', '<span class="small num">' + vistas + ' de ' + ids.length + (ids.length === 1 ? ' vista' : ' vistas') + '</span>') +
    '<div class="aj-tutoriais aj-apresentacoes">' + ids.map(function (id) {
      var def = APRESENTACOES[id], n = aprImagensVisiveis(id).length;
      var t = tabs.filter(function (x) { return x.id === id; })[0];
      var resumo = def.resumo || (t && t.sub) || '';
      return '<button type="button" class="aj-tu" data-toca="camada" data-click="aprRever(\'' + jsq(id) + '\')">' +
        '<span class="small num">' + n + (n === 1 ? ' imagem' : ' imagens') + '</span>' +
        '<b>' + esc(aprTexto(def.nome)) + '</b>' +
        (aprVista(id) ? '<span class="badge in">Vista</span>' : '<span class="small">' + esc(resumo) + '</span>') +
        '</button>';
    }).join('') + '</div>' +
    (vistas < ids.length && typeof aprMarcarTodasVistas === 'function'
      ? '<div class="aj-apr-pe"><button type="button" class="btn sm" data-toca="dados" data-click="aprMarcarTodasVistas()">Marcar todas como vistas</button></div>' : '');
}

/* Os textos do pedido que mudam com o tipo: o exemplo do assunto, o rótulo e
   o exemplo da caixa, e a nota por baixo dela. Os exemplos vêm sem o «Ex: »,
   que se escreve à frente de cada placeholder (a regra dos formulários).
   Recebe: kind — 'problema' ou 'sugestao'.
   Devolve: {assunto, rotulo, exemplo, nota} (texto). */
function textosDoPedido(kind) {
  return kind === 'sugestao'
    ? { assunto: 'Poder marcar rendas em atraso', rotulo: 'A tua ideia',
        exemplo: 'Marcar uma renda como em atraso, para a ver na Visão geral até a receber.',
        nota: 'O que gostavas de conseguir fazer, e porquê.' }
    : { assunto: 'O gráfico das rendas não aparece', rotulo: 'O que aconteceu',
        exemplo: 'Abri as Projeções no telemóvel e o gráfico ficou em branco. Esperava ver as rendas dos próximos anos.',
        nota: 'O que estavas a fazer, o que esperavas e o que aconteceu.' };
}

/* Abre a janela «Novo pedido» (o canvas M-NovoPedido): o tipo num
   segmentado (Problema / Sugestão, que troca os textos sem apagar o que já
   se escreveu), o assunto e a descrição com o contador de caracteres, e a
   nota do que vai junto com o pedido. Os dois campos são obrigatórios (o
   sendTicket recusa-os vazios); os placeholders são exemplos, e o que era
   instrução passou para a nota debaixo da caixa.
   Recebe: kind — 'problema' ou 'sugestao', o tipo com que abre.
   Devolve: nada — abre o modal. */
CW.newTicket = function (kind) {
  kind = kind === 'sugestao' ? 'sugestao' : 'problema';
  CW._tkTipo = kind;
  var tx = textosDoPedido(kind);
  var opcao = function (k, rotulo) {
    return '<button type="button" role="radio" aria-checked="' + (k === kind) + '" data-tk="' + k + '" data-toca="rascunho" data-click="CW.ticketTipo(\'' + k + '\')">' + rotulo + '</button>';
  };
  var body = '<div class="form tk-form">' +
    '<div class="segm tk-tipo" role="radiogroup" aria-label="Tipo de pedido">' + opcao('problema', 'Problema') + opcao('sugestao', 'Sugestão') + '</div>' +
    '<div class="tk-campo"><label>Assunto <span class="req">*</span><input id="tk_s" maxlength="140" placeholder="Ex: ' + tx.assunto + '" autocomplete="off"></label>' +
      '<span class="small num tk-conta" id="tk_s_n" aria-hidden="true">0 / 140</span></div>' +
    '<div class="tk-campo"><label><span class="rotulo-txt" id="tk_b_rot">' + tx.rotulo + '</span> <span class="req">*</span><textarea id="tk_b" class="u-minh-130px" maxlength="4000" ' +
      'placeholder="Ex: ' + tx.exemplo + '"></textarea></label>' +
      '<div class="hint u-m-n4px-0-0" id="tk_nota">' + tx.nota + '</div>' +
      '<span class="small num tk-conta" id="tk_b_n" aria-hidden="true">0 / 4000</span></div>' +
    '<div class="tk-junto">' + ic('info', 18) + '<p>Com o pedido vai a versão da app e o browser que usas. Os teus dados não vão. A resposta chega aqui e por email.</p></div>' +
    '<div id="tk_e" class="small u-c-v-danger" role="alert"></div></div>';
  openModal('Novo pedido', body,
    '<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>' +
    '<button class="btn primary" data-toca="dados" data-click="CW.sendTicket()">Enviar</button>');
  ['tk_s', 'tk_b'].forEach(function (id) {
    var campo = document.getElementById(id), conta = document.getElementById(id + '_n');
    if (!campo || !conta || !campo.addEventListener) return;
    campo.addEventListener('input', function () { conta.textContent = String(campo.value || '').length + ' / ' + (id === 'tk_s' ? 140 : 4000); });
  });
};

/* Troca o tipo do pedido aberto (o segmentado da janela): muda o rótulo,
   os exemplos e a nota no sítio, sem tocar no que já está escrito.
   Recebe: kind — 'problema' ou 'sugestao'.
   Devolve: nada — mexe nos textos da janela aberta. */
CW.ticketTipo = function (kind) {
  CW._tkTipo = kind === 'sugestao' ? 'sugestao' : 'problema';
  var tx = textosDoPedido(CW._tkTipo);
  var s = document.getElementById('tk_s'), b = document.getElementById('tk_b');
  var rot = document.getElementById('tk_b_rot'), nota = document.getElementById('tk_nota');
  if (s) s.placeholder = 'Ex: ' + tx.assunto;
  if (b) b.placeholder = 'Ex: ' + tx.exemplo;
  if (rot) rot.textContent = tx.rotulo;
  if (nota) nota.textContent = tx.nota;
  var corpo = modalBodyEl();
  if (corpo) [].slice.call(corpo.querySelectorAll('.tk-tipo [role="radio"]')).forEach(function (o) {
    o.setAttribute('aria-checked', o.getAttribute('data-tk') === CW._tkTipo ? 'true' : 'false');
  });
};

/* Valida e envia o pedido escrito no modal, juntando a versão da app e o
   browser (os dados do utilizador não vão). Um campo vazio diz-se junto
   dele (componentes.js:falhaCampo); com sucesso fecha o modal e recarrega a
   lista; o erro do servidor fica escrito dentro do próprio modal.
   Recebe: kind (opcional) — 'problema' ou 'sugestao', o tipo que segue para
   a API; sem ele, o que está escolhido na janela.
   Devolve: nada — envia o pedido e fecha o modal quando corre bem. */
CW.sendTicket = function (kind) {
  kind = kind || CW._tkTipo || 'problema';
  var e = document.getElementById('tk_e');
  e.textContent = '';
  var subject = val('tk_s').trim(), text = val('tk_b').trim();
  if (!subject) return falhaCampo('tk_s', 'Escreve o assunto.');
  if (!text) return falhaCampo('tk_b', kind === 'sugestao' ? 'Conta a tua ideia.' : 'Conta o que aconteceu.');
  var ctx = 'v' + (typeof VERSAO !== 'undefined' ? VERSAO : '?') + ' · ' + (navigator.userAgent || '').slice(0, 120);
  api('POST', '/api/tickets', { kind: kind, subject: subject, body: text, context: ctx })
    .then(function () {
      closeModal();
      CW.tickets = null;
      loadTickets();
      toast('Enviado. Podes acompanhar aqui em Ajuda e sugestões.');
    })
    .catch(function (err) { e.textContent = err.message || 'Não foi possível enviar.'; });
};

// Erros na app chegam a quem programa sem o utilizador ter de os contar.
// Sem sessão também: um erro no ecrã de entrada é o que mais custa deixar
// passar, porque quem fica preso lá não tem como o contar de outra maneira.
var errCount = 0;
var errVistos = {};
// Envia um relato de erro para a API: mensagem, detalhe (stack), versão, ecrã
// e user agent. No máximo 8 por sessão e cada mensagem conta uma vez; falhas
// no envio são silenciosas — não há para onde reportar o próprio relato.
// Recebe: msg — a mensagem do erro (qualquer valor; é convertido em texto);
// detail — o detalhe (stack e afins, também vira texto; pode vir vazio).
// Devolve: nada — envia o relato à API, ou desiste em silêncio.
function reportErr(msg, detail) {
  if (errCount >= 8) return;
  // o mesmo erro em ciclo conta uma vez: um requestAnimationFrame partido
  // dispara centenas de vezes por segundo
  var chave = String(msg).slice(0, 120);
  if (errVistos[chave]) return;
  errVistos[chave] = 1;
  errCount++;
  /* A versão vai sempre. Desde que a app se atualiza sozinha, um relato de
     quem ainda está numa versão antiga parece um defeito da versão em vigor
     — e faz perder tempo a procurar o que já foi corrigido. */
  api('POST', '/api/reports', {
    message: String(msg).slice(0, 500),
    detail: String(detail || '').slice(0, 1500),
    versao: typeof VERSAO !== 'undefined' ? VERSAO : null,
    ecra: ondeEstava(),
    agente: String(navigator.userAgent || '').slice(0, 180),
  }).catch(function () {});
}
// em que ecrã estava a pessoa: ajuda a reproduzir, e `tab` pode ainda não
// existir se o erro for cedo
// Devolve: o nome do ecrã atual, como string — 'arranque' se `tab` ainda não existir.
function ondeEstava() {
  try { return String(tab); } catch (e) { return 'arranque'; }
}
/* O detalhe de um erro, com tudo o que o browser der: tipo e mensagem,
   as primeiras linhas da stack, ficheiro:linha:coluna, e — quando ele
   esconde tudo (script de outra origem, valor lançado que não é Error,
   Safari sem stack) — diz isso, em vez de deixar «: · ecrã» sem nada.
   Fecha com o ecrã, o URL, a rede, e o rasto do que a pessoa fazia.
   Recebe: erro — o Error (ou a razão de uma promessa: pode ser qualquer
   valor); ev (opcional) — o ErrorEvent, para o ficheiro/linha/coluna.
   Devolve: texto de várias linhas, pronto para o relato. */
function detalheDoErro(erro, ev) {
  var linhas = [];
  if (erro && typeof erro === 'object' && (erro.name || erro.message || erro.stack)) {
    linhas.push((erro.name || 'Error') + ': ' + (erro.message || '(sem mensagem)') +
      (erro.status ? ' · HTTP ' + erro.status : ''));
    var msg = String(erro.message || '');
    var st = String(erro.stack || '').split('\n')
      .filter(function (l) { return l.trim() && !(msg && l.indexOf(msg) > -1); })
      .slice(0, 6).join('\n');
    if (st) linhas.push(st);
  } else if (erro !== undefined && erro !== null) {
    var s;
    try { s = typeof erro === 'string' ? erro : JSON.stringify(erro); } catch (x) { s = String(erro); }
    linhas.push('valor lançado (não é Error): ' + String(s).slice(0, 300));
  }
  if (ev && (ev.filename || ev.lineno)) {
    linhas.push((ev.filename || '?') + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0));
  }
  if (!linhas.length) {
    linhas.push('o browser não deu ficheiro, linha nem stack — costuma ser um script de ' +
      'outra origem (extensão, SDK de terceiros) ou um erro do próprio browser');
  }
  var onde = 'ecrã ' + ondeEstava();
  try {
    onde += ' · ' + String(location.pathname + location.hash).slice(0, 80) +
      (navigator.onLine === false ? ' · sem rede' : '') +
      (document.visibilityState === 'hidden' ? ' · página escondida' : '');
  } catch (x2) {}
  linhas.push(onde);
  if (CW._rasto && CW._rasto.length) linhas.push('rasto: ' + CW._rasto.join(' | '));
  return linhas.join('\n');
}
window.addEventListener('error', function (e) {
  reportErr(e.message || (e.error && e.error.message) || 'Erro sem mensagem', detalheDoErro(e.error, e));
});
window.addEventListener('unhandledrejection', function (e) {
  var r = e.reason;
  reportErr('Promessa rejeitada: ' + ((r && r.message) || (typeof r === 'string' ? r : 'sem mensagem')),
    detalheDoErro(r));
});
// cada mudança de ecrã entra no rasto que vai nos relatos
var _goRasto = go;
go = function (id) { rastoPoe('→ ' + id); return _goRasto.apply(this, arguments); };

// leva o que a armadilha do index.html apanhou antes de este ficheiro existir
(function () {
  var fila = window.__erros, jaLevados = window.__errosLevados;
  // a partir daqui os relatos são deste ficheiro: o temporizador da armadilha
  // não pode voltar a enviar o que já foi relatado (dava ×2 no Discord)
  window.__errosLevados = 1;
  if (!fila || !fila.length || jaLevados) return;
  fila.splice(0).forEach(function (r) { reportErr(r.message, r.detail); });
})();

// Embrulha um documento legal (Termos ou Privacidade) num cartão de leitura
// com botão para voltar à página legal das Definições.
// Recebe: html — o corpo do documento, já em HTML.
// Devolve: o HTML do cartão com o documento e o botão de voltar, como string.
function vDoc(html) {
  return '<div class="card"><div class="lg">' + html + '</div></div>' +
    '<div class="toolbar u-mt-14px">' +
    '<button class="btn" data-click="goSet(\'legal\')">' + ic('chev', 15) + ' Voltar</button></div>';
}

/* A data sai dos próprios documentos (legal.js:VERSION), e não escrita à mão
   ao lado deles: estavam desencontradas — aqui dizia 2 de setembro e os
   documentos diziam 4. E lê-se como as outras datas da app, em dd/mm/aaaa. */
var LEGAL_UPDATED = dPT(L.version) || L.version;

// O aviso prático não repete os documentos: os Termos e a Política dizem-no
// com valor legal, aqui fica só o essencial.
// Devolve: o HTML da página legal das Definições, como string.
function vLegal() {
  return navRow('Termos e Condições', 'Em vigor desde ' + LEGAL_UPDATED, 'contract', 'termos') +
    '<div class="u-h-10px"></div>' +
    navRow('Política de Privacidade', 'Dados, direitos e subcontratação', 'lock', 'privacidade') +
    '<div class="u-h-16px"></div>' +
    card('Antes de confiares dados reais', 'O que convém saberes',
      '<div class="hint u-fs-14px u-lh-1p6">' +
      '<p class="u-m-0-0-8px">A app evolui continuamente e é fornecida tal como está.</p>' +
      '<ul class="u-m-0 u-pl-18px">' +
      '<li class="u-mb-5px"><b>Guarda as tuas próprias cópias</b> em Definições → Importar e cópias — nenhuma nuvem substitui uma cópia tua.</li>' +
      '<li class="u-mb-5px">Anexos e fotos sincronizam com a sessão iniciada, mas não entram nas cópias de segurança.</li>' +
      '<li class="u-mb-5px">Os valores e projeções são estimativas, não aconselhamento fiscal ou jurídico.</li>' +
      '<li class="u-mb-5px">O contrato em PDF é um modelo genérico: revê-o antes de assinar.</li>' +
      '<li>Ao guardares dados de inquilinos, és tu o responsável por eles.</li>' +
      '</ul></div>') +
    '<div class="hint u-ta-center u-mt-16px">Versão ' + L.version + '</div>';
}

/* Ecrã de entrada: sempre que a app abre (depois da sessão iniciada),
   mostra-se o aviso e nada mais, até o utilizador continuar. */

// trava a página por baixo enquanto um ecrã de entrada estiver aberto
// Recebe: on — true trava o scroll; false destrava, mas só se já não houver
// nenhum ecrã ou modal aberto por cima.
// Devolve: nada — mexe nas classes e no estilo do documento.
function lockScroll(on) {
  try {
    var h = document.documentElement;
    if (on) {
      if (h.classList.contains('noscroll')) return;
      CW._lockY = window.scrollY || 0;
      h.classList.add('noscroll');
      document.body.style.top = -CW._lockY + 'px';
    } else {
      if (!h.classList.contains('noscroll')) return;
      if (modalStack.length || document.body.classList.contains('open')) return;
      if (document.getElementById('cwLegal')) return;
      if (document.getElementById('cwTerms')) return;
      if (document.getElementById('cwDoc')) return;
      if (authEl && authEl.style.display !== 'none') return;
      h.classList.remove('noscroll');
      document.body.style.top = '';
      window.scrollTo(0, CW._lockY || 0);
    }
  } catch (e) {}
}

/* Contas anteriores aos termos: pedir aceitação antes de deixar usar a app.
   Quem recusar tem a conta apagada, depois de avisado e de confirmar. */

// Os ecrãs de entrada (sessão, aviso, termos) vivem acima dos modais, por
// isso o documento tem de abrir numa camada própria, por cima de tudo.
// Recebe: e — o evento do clique, para o preventDefault (tolera null);
// page — 'termos' ou 'privacidade', o documento a abrir.
// Devolve: nada — monta a camada #cwDoc por cima de tudo e trava o scroll.
CW.readDoc = function (e, page) {
  if (e && e.preventDefault) e.preventDefault();
  var doc = page === 'termos' ? L.termos : L.privacidade;
  var t = page === 'termos' ? 'Termos e Condições' : 'Política de Privacidade';
  var old = document.getElementById('cwDoc');
  if (old) old.remove();
  var el = document.createElement('div');
  el.id = 'cwDoc';
  el.style.cssText = 'position:fixed;inset:0;z-index:210;background:var(--bg);overflow:auto;' +
    'padding:calc(var(--inset-top,0px) + 16px) 16px calc(var(--inset-bottom,0px) + 24px)';
  el.innerHTML =
    '<div class="u-maxw-720px u-m-0-auto">' +
    '<div class="u-pos-sticky u-t-0 u-bg-v-bg u-p-6px-0-12px u-z-1 ' +
    'u-d-flex u-ai-center u-g-12px u-bb-1px-solid-v-line">' +
    '<button class="btn" data-click="CW.closeDoc()">' + ic('chev', 15) + ' Voltar</button>' +
    '<b class="u-fx-1 u-minw-0 u-fs-15px">' + t + '</b></div>' +
    '<div class="lg u-mt-16px">' + doc + '</div>' +
    '<div class="toolbar u-m-20px-0-0">' +
    '<button class="btn primary" data-click="CW.closeDoc()">Voltar</button></div></div>';
  document.body.appendChild(el);
  lockScroll(true);
};

// Fecha a camada do documento aberta pelo CW.readDoc e devolve o scroll à página.
// Devolve: nada — remove a camada #cwDoc e destrava o scroll.
CW.closeDoc = function () {
  var el = document.getElementById('cwDoc');
  if (el) el.remove();
  lockScroll(false);
};

/* Ecrã bloqueante para quem aceitou uma versão antiga dos termos (o canvas
   M-Termos): o ícone do documento, o título, a frase com a data da versão
   nova, os dois documentos para ler (cada um abre por cima, CW.readDoc), o
   essencial do aviso prático, e só sai dali aceitando — ou recusando, o que
   apaga a conta depois de mais uma confirmação, essa sim com o botão
   vermelho (CW.refuseTerms). Se já estiver aberto, não duplica.
   Recebe: nada.
   Devolve: nada — monta o ecrã #cwTerms e trava o scroll. */
function showTermsGate() {
  if (document.getElementById('cwTerms')) return;
  var el = document.createElement('div');
  el.id = 'cwTerms';
  el.style.cssText = 'position:fixed;inset:0;z-index:196;background:var(--bg);overflow:auto;' +
    'display:flex;justify-content:center;padding:calc(28px + var(--inset-top,0px)) 20px calc(24px + var(--inset-bottom,0px))';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'tgTit');
  var doc = function (page, titulo, sub) {
    return '<button type="button" class="tg-doc" data-toca="camada" data-click="CW.readDoc(event,\'' + page + '\')">' +
      '<span class="tg-doc-txt"><b>' + titulo + '</b><span class="small">' + sub + '</span></span>' +
      '<span class="seta">' + ic('chevR', 20) + '</span></button>';
  };
  el.innerHTML =
    '<div class="tg-caixa">' +
    '<span class="tg-ic" aria-hidden="true">' + ic('contract', 28) + '</span>' +
    '<div class="tg-cab"><h1 id="tgTit" tabindex="-1">Os termos foram atualizados</h1>' +
    '<p class="num">A versão de ' + esc(LEGAL_UPDATED) + ' dos Termos e da Política de Privacidade substitui a que aceitaste. ' +
    'Para continuar a usar a app, aceita a versão nova.</p></div>' +
    '<div class="card tg-docs">' +
      doc('termos', 'Termos e Condições', 'O acordo entre ti e quem opera o serviço') +
      doc('privacidade', 'Política de Privacidade', 'Que dados tratamos, porquê e por quanto tempo') +
    '</div>' +
    '<div class="tg-aviso"><p class="tg-aviso-tit">Antes de confiares dados reais</p><ul>' +
      '<li>Guarda cópias tuas em Definições → Importar e cópias.</li>' +
      '<li>Os valores e as projeções são estimativas, não aconselhamento.</li>' +
      '<li>O contrato em PDF é uma minuta genérica.</li>' +
      '<li>Quem guarda dados de inquilinos é responsável por eles.</li></ul></div>' +
    '<div class="tg-botoes">' +
    '<button type="button" class="btn primary" data-toca="dados" data-click="CW.acceptTerms()">Aceitar e continuar</button>' +
    '<button type="button" class="btn ghost tg-recusa" data-toca="camada" data-click="CW.refuseTerms()">Recusar e apagar a conta</button>' +
    '</div><p id="cwt_err" class="small u-c-v-danger" role="alert"></p></div>';
  document.body.appendChild(el);
  lockScroll(true);
  // o foco entra no ecrã, para o teclado e o leitor de ecrã não ficarem na app por trás
  try { document.getElementById('tgTit').focus({ preventScroll: true }); } catch (e) {}
}

// Regista a aceitação dos termos na API e fecha o ecrã bloqueante; se o
// registo falhar, o erro aparece no próprio ecrã e ele fica aberto.
// Devolve: nada — regista na API e fecha o ecrã quando corre bem.
CW.acceptTerms = function () {
  api('POST', '/api/me/terms', { accept: true })
    .then(function () {
      CW.termsOk = true;
      var el = document.getElementById('cwTerms');
      if (el) el.remove();
      lockScroll(false);
      toast('Obrigado. Bom trabalho.');
    })
    .catch(function (e) {
      var x = document.getElementById('cwt_err');
      if (x) x.textContent = e.message || 'Não foi possível registar a aceitação.';
    });
};

// Modal de confirmação da recusa dos termos: avisa que apaga a conta e tudo o
// que lá está, sugere exportar primeiro e exige escrever APAGAR. Aberto por
// cima do ecrã dos termos (z 196), que tapava um modal normal (z 70): a
// janela ganha a classe que a põe acima dele (.modal.sobre-portao).
// Recebe: nada.
// Devolve: nada — abre o modal de confirmação.
CW.refuseTerms = function () {
  var body = '<div class="form">' +
    '<div class="hint u-c-v-danger"><b>A conta e todos os teus dados serão apagados.</b> ' +
    'Imóveis, contratos, movimentos, pessoas e ligações a outros utilizadores. Não há volta atrás.</div>' +
    '<div class="hint">Se quiseres ficar com os teus registos, cancela e exporta-os primeiro em ' +
    'Definições → Importar e cópias → Guardar cópia.</div>' +
    '<label><span class="rotulo-txt">Escreve <b>APAGAR</b> para confirmar</span> <span class="req">*</span><input id="cw_ref_c" placeholder="APAGAR" autocomplete="off" class="u-tt-uppercase"></label>' +
    '<div id="cw_ref_e" class="small u-c-v-danger"></div></div>';
  var L = openModal('Recusar e apagar a conta', body,
    '<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>' +
    '<button class="btn danger" data-toca="dados" data-risco="destroi" data-click="CW.doRefuseTerms()">Apagar definitivamente</button>');
  if (L && L.el && L.el.classList && document.getElementById('cwTerms')) L.el.classList.add('sobre-portao');
};

/* Consuma a recusa: a API apaga a conta no servidor (a palavra de confirmação
   é validada lá) e este aparelho fica limpo — dados locais, sessão e retrato,
   pelo ritual de saída (nucleo.js:encerrarSessao) — a terminar no ecrã de
   entrada.
   Devolve: nada — apaga a conta e deixa a app no ecrã de entrada. */
CW.doRefuseTerms = function () {
  var e = document.getElementById('cw_ref_e');
  e.textContent = '';
  api('POST', '/api/me/terms', { accept: false, confirm: val('cw_ref_c') })
    .then(function () {
      var g = document.getElementById('cwTerms');
      if (g) g.remove();
      encerrarSessao({ apagarDados: true, mensagem: 'Conta apagada. Os termos não foram aceites.' });
    })
    .catch(function (err) { e.textContent = err.message || 'Não foi possível apagar a conta.'; });
};

/* O aviso prático aparece uma vez por aparelho, curto, com o detalhe a um
   toque de distância. (A chave no localStorage mantém o nome antigo para
   não reaparecer a quem já o dispensou.) */
var LS_GATE = 'gi_demo_visto';

// Abre o aviso prático por cima da app, logo depois de haver sessão — uma vez
// por aparelho e por versão dos documentos. Fica até se carregar num botão.
// Devolve: nada — monta o ecrã #cwLegal e trava o scroll (ou não faz nada,
// se já foi visto nesta versão ou não houver sessão).
function showLegalGate() {
  if (!CW.user || CW._legalShown) return;
  var visto = null;
  try { visto = localStorage.getItem(LS_GATE); } catch (e) {}
  if (visto === L.version) return;
  CW._legalShown = true;
  var el = document.createElement('div');
  el.id = 'cwLegal';
  el.style.cssText = 'position:fixed;inset:0;z-index:195;background:var(--bg);overflow:auto;' +
    'display:flex;justify-content:center;padding:22px';
  el.innerHTML =
    '<div class="card u-maxw-400px u-w-100pc u-p-24px u-m-auto">' +
    '<div class="u-d-flex u-g-12px u-ai-center">' +
    '<span class="avatar u-bg-v-warn-soft u-c-v-warn">' + ic('info', 20) + '</span>' +
    '<div><div class="title u-fs-18px">Antes de começares</div>' +
    '<div class="small">Aparece só desta vez</div></div></div>' +
    '<div class="hint u-fs-14p5px u-lh-1p6 u-mt-14px">' +
    '<b>Guarda cópias de vez em quando</b> — nenhuma nuvem substitui uma cópia tua. ' +
    'Os números que a app mostra são estimativas, não aconselhamento.' +
    '</div>' +
    '<div class="toolbar u-mt-16px u-fxd-column u-g-8px">' +
    '<button class="btn primary u-w-100pc u-jc-center" data-click="CW.acceptLegal()">Começar</button>' +
    '<button class="btn u-w-100pc u-jc-center" data-click="CW.acceptLegal(1)">Ver o aviso completo</button>' +
    '</div></div>';
  document.body.appendChild(el);
  lockScroll(true);
}

// Fecha o aviso prático e marca-o como visto nesta versão; com `full`, segue
// para a página legal das Definições, onde está o detalhe todo.
// Recebe: full (opcional) — qualquer valor verdadeiro abre a página legal das Definições.
// Devolve: nada — fecha o aviso e grava a versão vista no localStorage.
CW.acceptLegal = function (full) {
  var el = document.getElementById('cwLegal');
  if (el) el.remove();
  try { localStorage.setItem(LS_GATE, L.version); } catch (e) {}
  lockScroll(false);
  if (full) { go('settings'); goSet('legal'); }
};

// As ações da conta (sair, palavra-passe, sessões, apagar) e das ligações
// entre utilizadores vivem em cloud/partilha.js, com a página «Segurança» e a
// partilha entre contas por baixo dos Proprietários.
