/* Documentos legais, aceitacao dos termos e pedidos de ajuda. */
'use strict';

/* ---------------- pedidos de ajuda e sugestões ---------------- */

var TK_STATUS = {
  criado: { label: 'Recebido', cor: 'amber', nota: 'à espera de ser visto' },
  resolucao: { label: 'Em resolução', cor: '', nota: 'já estamos a tratar disto' },
  concluido: { label: 'Concluído', cor: 'grey', nota: '' },
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

/* A página "Ajuda e sugestões": botões para reportar problema ou sugerir
   melhoria, os pedidos em curso e os concluídos (com estado e resposta da
   equipa), e a lista de tutoriais. À primeira passagem dispara o loadTickets
   e repinta quando os pedidos chegarem; enquanto não chegam não afirma nada,
   e se não deu para os carregar diz isso, com um botão para tentar de novo.
   Devolve: o HTML da página, como string. */
function vAjuda() {
  if (CW.tickets === null && !CW._ticketsFalhou) { loadTickets(); }
  var t = CW.tickets || [];
  var semSaber = CW.tickets === null
    ? (CW._ticketsFalhou
      ? '<div class="hint u-mt-16px">Não deu para carregar os teus pedidos — tenta de novo.</div>' +
        '<div class="toolbar u-mt-8px"><button class="btn" data-toca="dados" data-click="CW.ticketsDeNovo()">Tentar de novo</button></div>'
      : '')
    : '<div class="hint u-mt-16px">Ainda não enviaste nenhum pedido.</div>';
  var abertos = t.filter(function (x) { return x.status !== 'concluido'; });
  var fechados = t.filter(function (x) { return x.status === 'concluido'; });

  var linha = function (x) {
    var st = TK_STATUS[x.status] || TK_STATUS.criado;
    var d = new Date(x.created_at);
    /* o dia LOCAL, e nao o de UTC: um pedido das 23h30 de Lisboa aparecia com
     o dia seguinte */
    var data = dPT(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    return '<div class="card u-p-12px-13px">' +
      '<div class="row-between u-ai-flex-start u-g-10px">' +
      '<div class="u-minw-0"><b class="u-d-block">' + esc(x.subject) + '</b>' +
      '<span class="small">' + (x.kind === 'sugestao' ? 'Sugestão' : 'Problema') + ' · ' + data + '</span></div>' +
      '<span class="badge ' + st.cor + ' u-fx-0-0-auto">' + st.label + '</span></div>' +
      (st.nota ? '<div class="small u-mt-6px">' + st.nota + '</div>' : '') +
      (x.reply ? '<div class="hint u-mt-9px"><b>Resposta:</b> ' + esc(x.reply) + '</div>' : '') +
      '</div>';
  };

  return card('Contar um problema ou dar uma ideia',
    'Respondemos dentro da app, aqui mesmo',
    '<div class="hint">Se algo correu mal, diz o que estavas a fazer quando aconteceu — ajuda a perceber o problema.</div>' +
    '<div class="toolbar u-mt-12px">' +
    '<button class="btn primary" data-click="CW.newTicket(\'problema\')">' + ic('info', 15) + ' Reportar problema</button>' +
    '<button class="btn" data-click="CW.newTicket(\'sugestao\')">' + ic('plus', 15) + ' Sugerir melhoria</button></div>') +
    (abertos.length
      ? '<div class="section-title">Em curso</div><div class="list u-g-9px">' + abertos.map(linha).join('') + '</div>'
      : semSaber) +
    (fechados.length
      ? '<div class="section-title">Concluídos</div><div class="list u-g-9px">' + fechados.slice(0, 10).map(linha).join('') + '</div>'
      : '') +
    tutoriaisNaAjuda();
}

/* Os tutoriais listados um a um: quem precisa de um não devia ter de esperar
   que a app lho ofereça na vista geral, nem de dispensar o cartão dos
   primeiros passos para nunca mais lá chegar.
   Devolve: o HTML da secção "Como se faz", como string — vazia se não houver
   tutoriais. */
function tutoriaisNaAjuda() {
  if (typeof CW.listaDeTutoriais !== 'function') return '';
  var ts = CW.listaDeTutoriais();
  if (!ts.length) return '';
  return '<div class="section-title">Como se faz</div>' +
    '<div class="list u-g-9px">' + ts.map(function (t) {
      return '<div class="card tap u-p-12px-13px" data-click="CW.guiaAbrir(\'' + t.id + '\')">' +
        '<div class="row-between u-ai-center u-g-10px">' +
        '<div class="u-minw-0"><b class="u-d-block">' + esc(t.titulo) + '</b>' +
        '<span class="small">' + t.passos + ' passos' + (t.visto ? ' · já viste' : '') + '</span>' +
        '<span class="small u-d-block u-mt-3px">' + esc(t.resumo) + '</span></div>' +
        '<span class="u-fx-0-0-auto u-c-v-muted u-tf-rotate-180deg">' + ic('chev', 18) + '</span>' +
        '</div></div>';
    }).join('') + '</div>';
}

// Abre o modal de novo pedido; kind ('problema' ou 'sugestao') só muda os textos.
// Recebe: kind — 'problema' ou 'sugestao', o tipo de pedido.
// Devolve: nada — abre o modal.
CW.newTicket = function (kind) {
  var problema = kind === 'problema';
  var body = '<div class="form">' +
    '<label>Assunto<input id="tk_s" maxlength="140" placeholder="' +
    (problema ? 'Ex.: o gráfico não aparece' : 'Ex.: poder marcar rendas em atraso') + '" autocomplete="off"></label>' +
    '<label>' + (problema ? 'O que aconteceu' : 'A tua ideia') +
    '<textarea id="tk_b" class="u-minh-130px" maxlength="4000" placeholder="' +
    (problema ? 'O que estavas a fazer, o que esperavas e o que aconteceu.' : 'O que gostavas de conseguir fazer, e porquê.') +
    '"></textarea></label>' +
    '<div class="hint">Enviamos com a página onde estás e a versão da app. Não enviamos os teus dados.</div>' +
    '<div id="tk_e" class="small u-c-v-danger"></div></div>';
  openModal(problema ? 'Reportar problema' : 'Sugerir melhoria', body,
    '<button class="btn" data-click="closeModal()">Cancelar</button>' +
    '<button class="btn primary" data-click="CW.sendTicket(\'' + kind + '\')">Enviar</button>');
};

/* Valida e envia o pedido escrito no modal, juntando a versão e o user agent
   (os dados do utilizador não vão). Com sucesso fecha o modal e recarrega a
   lista; o erro fica escrito dentro do próprio modal.
   Recebe: kind — 'problema' ou 'sugestao', o tipo que segue para a API.
   Devolve: nada — envia o pedido e fecha o modal quando corre bem. */
CW.sendTicket = function (kind) {
  var e = document.getElementById('tk_e');
  e.textContent = '';
  var subject = val('tk_s').trim(), text = val('tk_b').trim();
  if (!subject || !text) { e.textContent = 'Escreve o assunto e a descrição.'; return; }
  var ctx = 'v' + L.version + ' · ' + (navigator.userAgent || '').slice(0, 120);
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
      '<li class="u-mb-5px">Anexos e fotos ficam só neste aparelho — não sincronizam nem entram nas cópias.</li>' +
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

/* Ecrã bloqueante para quem aceitou uma versão antiga dos termos: deixa ler
   os documentos e só sai dali aceitando — ou recusando, o que apaga a conta
   depois de mais uma confirmação. Se já estiver aberto, não duplica.
   Devolve: nada — monta o ecrã #cwTerms e trava o scroll. */
function showTermsGate() {
  if (document.getElementById('cwTerms')) return;
  var el = document.createElement('div');
  el.id = 'cwTerms';
  el.style.cssText = 'position:fixed;inset:0;z-index:196;background:var(--bg);overflow:auto;' +
    'display:flex;justify-content:center;padding:22px';
  el.innerHTML =
    '<div class="card u-maxw-460px u-w-100pc u-p-24px u-m-auto">' +
    '<div class="u-d-flex u-g-12px u-ai-center">' +
    '<span class="avatar u-bg-v-accent-soft u-c-v-accent">' + ic('contract', 20) + '</span>' +
    '<div><div class="title u-fs-18px">Atualizámos os termos</div>' +
    '<div class="small">Precisamos da tua aceitação para continuar</div></div></div>' +
    '<div class="hint u-fs-14px u-lh-1p6 u-mt-14px">' +
    '<p class="u-m-0-0-10px">Os <b>Termos e Condições</b> e a <b>Política de Privacidade</b> foram ' +
    '<b>atualizados</b> desde a versão que aceitaste. Vale a pena ler o que mudou.</p>' +
    '<p class="u-m-0">Sem a tua aceitação não podemos continuar a guardar os teus dados. Se recusares, ' +
    '<b>a conta e tudo o que lá está serão apagados</b>.</p></div>' +
    '<div class="toolbar u-mt-14px u-fxd-column u-g-8px">' +
    '<button class="btn u-w-100pc u-jc-center" data-click="CW.readDoc(event,\'termos\')">Ler os Termos e Condições</button>' +
    '<button class="btn u-w-100pc u-jc-center" data-click="CW.readDoc(event,\'privacidade\')">Ler a Política de Privacidade</button>' +
    '<button class="btn primary u-w-100pc u-jc-center" data-click="CW.acceptTerms()">Aceito</button>' +
    '<button class="btn danger u-w-100pc u-jc-center" data-click="CW.refuseTerms()">Não aceito — apagar a conta</button>' +
    '</div><div id="cwt_err" class="small u-c-v-danger u-mt-8px"></div></div>';
  document.body.appendChild(el);
  lockScroll(true);
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
// que lá está, sugere exportar primeiro e exige escrever APAGAR.
// Devolve: nada — abre o modal de confirmação.
CW.refuseTerms = function () {
  var body = '<div class="form">' +
    '<div class="hint u-c-v-danger"><b>A conta e todos os teus dados serão apagados.</b> ' +
    'Imóveis, contratos, movimentos, pessoas e ligações a outros utilizadores. Não há volta atrás.</div>' +
    '<div class="hint">Se quiseres ficar com os teus registos, cancela e exporta-os primeiro em ' +
    'Definições → Importar e cópias → Guardar cópia.</div>' +
    '<label>Escreve <b>APAGAR</b> para confirmar<input id="cw_ref_c" placeholder="APAGAR" autocomplete="off" class="u-tt-uppercase"></label>' +
    '<div id="cw_ref_e" class="small u-c-v-danger"></div></div>';
  openModal('Recusar e apagar a conta', body,
    '<button class="btn" data-click="closeModal()">Cancelar</button>' +
    '<button class="btn danger" data-click="CW.doRefuseTerms()">Apagar definitivamente</button>');
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
// entre utilizadores vivem em cloud/partilha.js, com a página «Conta e partilha».
