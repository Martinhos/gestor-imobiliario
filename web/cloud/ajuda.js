/* Documentos legais, aceitacao dos termos e pedidos de ajuda. */
'use strict';

/* ---------------- pedidos de ajuda e sugestões ---------------- */

var TK_STATUS = {
  criado: { label: 'Recebido', cor: 'amber', nota: 'à espera de ser visto' },
  resolucao: { label: 'Em resolução', cor: '', nota: 'já estamos a tratar disto' },
  concluido: { label: 'Concluído', cor: 'grey', nota: '' },
};
CW.tickets = null;

// Vai buscar os pedidos do utilizador à API; quando chegam, repinta a página
// de Ajuda se ela estiver à vista. Se a rede falhar, fica uma lista vazia.
// Devolve: nada — enche CW.tickets e repinta a Ajuda quando a resposta chegar.
function loadTickets() {
  api('GET', '/api/tickets')
    .then(function (r) { CW.tickets = r.tickets || []; if (tab === 'settings' && setPage === 'ajuda') render(); })
    .catch(function () { CW.tickets = []; });
}

/* A página "Ajuda e sugestões": botões para reportar problema ou sugerir
   melhoria, os pedidos em curso e os concluídos (com estado e resposta da
   equipa), e a lista de tutoriais. À primeira passagem dispara o loadTickets
   e repinta quando os pedidos chegarem.
   Devolve: o HTML da página, como string. */
function vAjuda() {
  if (CW.tickets === null) { loadTickets(); }
  var t = CW.tickets || [];
  var abertos = t.filter(function (x) { return x.status !== 'concluido'; });
  var fechados = t.filter(function (x) { return x.status === 'concluido'; });

  var linha = function (x) {
    var st = TK_STATUS[x.status] || TK_STATUS.criado;
    var d = new Date(x.created_at);
    /* o dia LOCAL, e nao o de UTC: um pedido das 23h30 de Lisboa aparecia com
     o dia seguinte */
    var data = dPT(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    return '<div class="card" style="padding:12px 13px">' +
      '<div class="row-between" style="align-items:flex-start;gap:10px">' +
      '<div style="min-width:0"><b style="display:block">' + esc(x.subject) + '</b>' +
      '<span class="small">' + (x.kind === 'sugestao' ? 'Sugestão' : 'Problema') + ' · ' + data + '</span></div>' +
      '<span class="badge ' + st.cor + '" style="flex:0 0 auto">' + st.label + '</span></div>' +
      (st.nota ? '<div class="small" style="margin-top:6px">' + st.nota + '</div>' : '') +
      (x.reply ? '<div class="hint" style="margin-top:9px"><b>Resposta:</b> ' + esc(x.reply) + '</div>' : '') +
      '</div>';
  };

  return card('Contar um problema ou dar uma ideia',
    'Respondemos dentro da app, aqui mesmo',
    '<div class="hint">Se algo correu mal, diz o que estavas a fazer quando aconteceu — ajuda a perceber o problema.</div>' +
    '<div class="toolbar" style="margin-top:12px">' +
    '<button class="btn primary" onclick="CW.newTicket(\'problema\')">' + ic('info', 15) + ' Reportar problema</button>' +
    '<button class="btn" onclick="CW.newTicket(\'sugestao\')">' + ic('plus', 15) + ' Sugerir melhoria</button></div>') +
    (abertos.length
      ? '<div class="section-title">Em curso</div><div class="list" style="gap:9px">' + abertos.map(linha).join('') + '</div>'
      : (CW.tickets === null ? '' : '<div class="hint" style="margin-top:16px">Ainda não enviaste nenhum pedido.</div>')) +
    (fechados.length
      ? '<div class="section-title">Concluídos</div><div class="list" style="gap:9px">' + fechados.slice(0, 10).map(linha).join('') + '</div>'
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
    '<div class="list" style="gap:9px">' + ts.map(function (t) {
      return '<div class="card tap" style="padding:12px 13px" onclick="CW.guiaAbrir(\'' + t.id + '\')">' +
        '<div class="row-between" style="align-items:center;gap:10px">' +
        '<div style="min-width:0"><b style="display:block">' + esc(t.titulo) + '</b>' +
        '<span class="small">' + t.passos + ' passos' + (t.visto ? ' · já viste' : '') + '</span>' +
        '<span class="small" style="display:block;margin-top:3px">' + esc(t.resumo) + '</span></div>' +
        '<span style="flex:0 0 auto;color:var(--muted);transform:rotate(180deg)">' + ic('chev', 18) + '</span>' +
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
    '<textarea id="tk_b" style="min-height:130px" maxlength="4000" placeholder="' +
    (problema ? 'O que estavas a fazer, o que esperavas e o que aconteceu.' : 'O que gostavas de conseguir fazer, e porquê.') +
    '"></textarea></label>' +
    '<div class="hint">Enviamos com a página onde estás e a versão da app. Não enviamos os teus dados.</div>' +
    '<div id="tk_e" class="small" style="color:var(--danger)"></div></div>';
  openModal(problema ? 'Reportar problema' : 'Sugerir melhoria', body,
    '<button class="btn" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn primary" onclick="CW.sendTicket(\'' + kind + '\')">Enviar</button>');
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
    '<div class="toolbar" style="margin-top:14px">' +
    '<button class="btn" onclick="goSet(\'legal\')">' + ic('chev', 15) + ' Voltar</button></div>';
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
    '<div style="height:10px"></div>' +
    navRow('Política de Privacidade', 'Dados, direitos e subcontratação', 'lock', 'privacidade') +
    '<div style="height:16px"></div>' +
    card('Antes de confiares dados reais', 'O que convém saberes',
      '<div class="hint" style="font-size:14px;line-height:1.6">' +
      '<p style="margin:0 0 8px">A app evolui continuamente e é fornecida tal como está.</p>' +
      '<ul style="margin:0;padding-left:18px">' +
      '<li style="margin-bottom:5px"><b>Guarda as tuas próprias cópias</b> em Definições → Importar e cópias — nenhuma nuvem substitui uma cópia tua.</li>' +
      '<li style="margin-bottom:5px">Anexos e fotos ficam só neste aparelho — não sincronizam nem entram nas cópias.</li>' +
      '<li style="margin-bottom:5px">Os valores e projeções são estimativas, não aconselhamento fiscal ou jurídico.</li>' +
      '<li style="margin-bottom:5px">O contrato em PDF é um modelo genérico: revê-o antes de assinar.</li>' +
      '<li>Ao guardares dados de inquilinos, és tu o responsável por eles.</li>' +
      '</ul></div>') +
    '<div class="hint" style="text-align:center;margin-top:16px">Versão ' + L.version + '</div>';
}

/* O aviso completo de antes de haver Termos e Condições: garantias, cópias,
   dados de terceiros, segurança e responsabilidade, por extenso. Já nenhuma
   página o mostra — o caminho em vigor é o vLegal com os documentos legais.
   Devolve: o HTML do aviso completo, como string. */
function vLegalAntigo() {
  var p = function (t) { return '<p style="margin:0 0 10px">' + t + '</p>'; };
  return card('Aviso completo', 'Lê antes de usares com dados reais',
    '<div class="hint" style="font-size:14px;line-height:1.65">' +
    p('<b>Esta aplicação está em desenvolvimento contínuo.</b> É um projeto pessoal, ' +
      'disponibilizado tal como está, sem qualquer garantia de funcionamento, exatidão, disponibilidade ou ' +
      'conservação dos dados.') +
    p('Funcionalidades podem mudar, deixar de existir ou comportar-se de forma inesperada de um dia para o outro.') +
    '</div>') +
    '<div style="height:14px"></div>' +
    card('Os teus dados', 'Podes perdê-los',
      '<div class="hint" style="font-size:14px;line-height:1.65">' +
      p('Os dados são guardados numa base de dados na nuvem e no próprio dispositivo. ' +
        '<b>Nenhum sistema está livre de erro</b>: mantém as tuas cópias.') +
      p('<b>Faz cópias de segurança regulares</b> em Definições → Dados → Guardar cópia. A responsabilidade de ' +
        'manter uma cópia dos teus registos é tua.') +
      p('Fotografias e documentos anexados ficam apenas no dispositivo onde foram adicionados: não são ' +
        'sincronizados nem incluídos nas cópias de segurança em JSON.') +
      '</div>') +
    '<div style="height:14px"></div>' +
    card('Não é aconselhamento profissional', '',
      '<div class="hint" style="font-size:14px;line-height:1.65">' +
      p('Os valores, indicadores e projeções (yield, cap rate, LTV, planos de amortização, impostos, ' +
        'rentabilidades futuras) são <b>estimativas informativas</b>, calculadas a partir do que introduzes e de ' +
        'pressupostos simplificados. Não constituem aconselhamento fiscal, jurídico, contabilístico ou financeiro ' +
        'e não substituem um contabilista certificado, um advogado ou um intermediário de crédito.') +
      p('Confirma sempre os números junto das fontes oficiais (Autoridade Tributária, banco, condomínio) antes de ' +
        'tomares decisões ou submeteres declarações.') +
      '</div>') +
    '<div style="height:14px"></div>' +
    card('Contratos gerados em PDF', 'Rever antes de assinar',
      '<div class="hint" style="font-size:14px;line-height:1.65">' +
      p('O contrato de arrendamento gerado pela aplicação é um <b>modelo genérico, não validado por advogado</b> e ' +
        'que pode não refletir a legislação em vigor nem as particularidades da tua situação.') +
      p('Deve ser revisto por um profissional antes de ser assinado. A aplicação não assume qualquer ' +
        'responsabilidade pelo conteúdo, validade ou consequências dos documentos gerados.') +
      '</div>') +
    '<div style="height:14px"></div>' +
    card('Dados de terceiros e privacidade', 'Inquilinos, proprietários e fiadores',
      '<div class="hint" style="font-size:14px;line-height:1.65">' +
      p('Ao introduzires dados de outras pessoas (nome, contactos, NIF, cartão de cidadão, documentos), ' +
        '<b>és tu o responsável pelo tratamento desses dados</b> à luz do RGPD: deves ter fundamento legítimo para ' +
        'os guardar, informar os titulares e conservá-los apenas o tempo necessário.') +
      p('Introduz o mínimo indispensável e evita dados sensíveis. Ao partilhares uma casa com outro utilizador, ' +
        'dás-lhe acesso a tudo o que essa casa contém — incluindo contratos, movimentos e fichas de pessoas.') +
      '</div>') +
    '<div style="height:14px"></div>' +
    card('Segurança e disponibilidade', '',
      '<div class="hint" style="font-size:14px;line-height:1.65">' +
      p('As palavras-passe são guardadas cifradas e a ligação é encriptada, mas <b>nenhuma medida de segurança é ' +
        'infalível</b> e esta aplicação não foi sujeita a auditoria de segurança. Usa uma palavra-passe única e forte.') +
      p('O serviço pode ficar indisponível, ser interrompido ou terminar a qualquer momento, sem aviso e sem ' +
        'direito a indemnização.') +
      '</div>') +
    '<div style="height:14px"></div>' +
    card('Limitação de responsabilidade', '',
      '<div class="hint" style="font-size:14px;line-height:1.65">' +
      p('Na medida máxima permitida por lei, o autor não se responsabiliza por quaisquer danos diretos ou ' +
        'indiretos decorrentes do uso desta aplicação — incluindo perda de dados, prejuízos financeiros, ' +
        'decisões tomadas com base nos valores apresentados ou incumprimentos legais ou fiscais.') +
      p('Ao utilizares a aplicação, aceitas estas condições. Se não concordares, não a utilizes.') +
      '</div>') +
    '<div class="hint" style="text-align:center;margin-top:16px">Última atualização: ' + LEGAL_UPDATED + '.</div>';
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
    '<div style="max-width:720px;margin:0 auto">' +
    '<div style="position:sticky;top:0;background:var(--bg);padding:6px 0 12px;z-index:1;' +
    'display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line)">' +
    '<button class="btn" onclick="CW.closeDoc()">' + ic('chev', 15) + ' Voltar</button>' +
    '<b style="flex:1;min-width:0;font-size:15px">' + t + '</b></div>' +
    '<div class="lg" style="margin-top:16px">' + doc + '</div>' +
    '<div class="toolbar" style="margin:20px 0 0">' +
    '<button class="btn primary" onclick="CW.closeDoc()">Voltar</button></div></div>';
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
    '<div class="card" style="max-width:460px;width:100%;padding:24px;margin:auto">' +
    '<div style="display:flex;gap:12px;align-items:center">' +
    '<span class="avatar" style="background:var(--accent-soft);color:var(--accent)">' + ic('contract', 20) + '</span>' +
    '<div><div class="title" style="font-size:18px">Atualizámos os termos</div>' +
    '<div class="small">Precisamos da tua aceitação para continuar</div></div></div>' +
    '<div class="hint" style="font-size:14px;line-height:1.6;margin-top:14px">' +
    '<p style="margin:0 0 10px">Os <b>Termos e Condições</b> e a <b>Política de Privacidade</b> foram ' +
    '<b>atualizados</b> desde a versão que aceitaste. Vale a pena ler o que mudou — os planos e a fase ' +
    'experimental estão descritos lá.</p>' +
    '<p style="margin:0">Sem a tua aceitação não podemos continuar a guardar os teus dados. Se recusares, ' +
    '<b>a conta e tudo o que lá está serão apagados</b>.</p></div>' +
    '<div class="toolbar" style="margin-top:14px;flex-direction:column;gap:8px">' +
    '<button class="btn" style="width:100%;justify-content:center" onclick="CW.readDoc(event,\'termos\')">Ler os Termos e Condições</button>' +
    '<button class="btn" style="width:100%;justify-content:center" onclick="CW.readDoc(event,\'privacidade\')">Ler a Política de Privacidade</button>' +
    '<button class="btn primary" style="width:100%;justify-content:center" onclick="CW.acceptTerms()">Aceito</button>' +
    '<button class="btn danger" style="width:100%;justify-content:center" onclick="CW.refuseTerms()">Não aceito — apagar a conta</button>' +
    '</div><div id="cwt_err" class="small" style="color:var(--danger);margin-top:8px"></div></div>';
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
    '<div class="hint" style="color:var(--danger)"><b>A conta e todos os teus dados serão apagados.</b> ' +
    'Imóveis, contratos, movimentos, pessoas e ligações a outros utilizadores. Não há volta atrás.</div>' +
    '<div class="hint">Se quiseres ficar com os teus registos, cancela e exporta-os primeiro em ' +
    'Definições → Importar e cópias → Guardar cópia.</div>' +
    '<label>Escreve <b>APAGAR</b> para confirmar<input id="cw_ref_c" placeholder="APAGAR" autocomplete="off" style="text-transform:uppercase"></label>' +
    '<div id="cw_ref_e" class="small" style="color:var(--danger)"></div></div>';
  openModal('Recusar e apagar a conta', body,
    '<button class="btn" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn danger" onclick="CW.doRefuseTerms()">Apagar definitivamente</button>');
};

/* Consuma a recusa: a API apaga a conta no servidor (a palavra de confirmação
   é validada lá) e este aparelho fica limpo — dados locais, sessão e snapshots
   — a terminar no ecrã de entrada.
   Devolve: nada — apaga a conta e deixa a app no ecrã de entrada. */
CW.doRefuseTerms = function () {
  var e = document.getElementById('cw_ref_e');
  e.textContent = '';
  api('POST', '/api/me/terms', { accept: false, confirm: val('cw_ref_c') })
    .then(function () {
      CW.user = null;
      db = JSON.parse(JSON.stringify(blank));
      rawSet(KEY, JSON.stringify(db));
      ['gi_cloud_user', 'gi_cloud_owner', 'gi_page'].forEach(function (k) {
        try { localStorage.removeItem(k); } catch (x) {}
      });
      snap = {};
      closeAllModals();
      var g = document.getElementById('cwTerms');
      if (g) g.remove();
      buildNav(); render();
      CW.showAuthMode = 'login';
      showAuth('Conta apagada. Os termos não foram aceites.');
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
    '<div class="card" style="max-width:400px;width:100%;padding:24px;margin:auto">' +
    '<div style="display:flex;gap:12px;align-items:center">' +
    '<span class="avatar" style="background:var(--warn-soft);color:var(--warn)">' + ic('info', 20) + '</span>' +
    '<div><div class="title" style="font-size:18px">Antes de começares</div>' +
    '<div class="small">Aparece só desta vez</div></div></div>' +
    '<div class="hint" style="font-size:14.5px;line-height:1.6;margin-top:14px">' +
    '<b>Guarda cópias de vez em quando</b> — nenhuma nuvem substitui uma cópia tua. ' +
    'Os números que a app mostra são estimativas, não aconselhamento.' +
    '</div>' +
    '<div class="toolbar" style="margin-top:16px;flex-direction:column;gap:8px">' +
    '<button class="btn primary" style="width:100%;justify-content:center" onclick="CW.acceptLegal()">Começar</button>' +
    '<button class="btn" style="width:100%;justify-content:center" onclick="CW.acceptLegal(1)">Ver o aviso completo</button>' +
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

// Copia o id do utilizador para a área de transferência, para o dar a quem se
// quer conectar; o toast aparece na mesma quando o clipboard não existe.
// Devolve: nada — copia o id e mostra o toast.
CW.copyId = function () {
  var done = function () { toast('Id copiado: partilha-o com o outro utilizador.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(CW.user.id).then(done, done);
  else done();
};

// Envia um convite de conexão para o id escrito no campo; fica pendente até o
// outro utilizador aceitar do lado dele.
// Devolve: nada — envia o convite à API, sincroniza e repinta.
CW.addConn = function () {
  var id = (val('cw_peer') || '').trim().toUpperCase();
  if (!id) return toast('Escreve o id do outro utilizador.');
  api('POST', '/api/connections', { peerId: id })
    .then(function () { toast('Convite enviado — falta o outro utilizador aceitar.'); return pullNow(true); })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message); });
};

// Aceita o convite de conexão id e sincroniza logo, para o que o outro já partilhou aparecer.
// Recebe: id — o id da conexão (o convite), tal como vem da API.
// Devolve: nada — aceita na API, sincroniza e repinta.
CW.acceptConn = function (id) {
  api('POST', '/api/connections/' + id + '/accept')
    .then(function () { toast('Conexão aceite. Escolhe agora que casas queres partilhar.'); return pullNow(true); })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message); });
};

/* Remove uma conexão, ou retira um convite (isPending). Convites saem sem
   perguntar; conexões feitas pedem confirmação, porque ambos deixam de ver as
   casas partilhadas do outro — os dados de cada um não se apagam.
   Recebe: id — o id da conexão ou do convite; isPending — verdadeiro quando
   ainda é só um convite (remove sem confirmar).
   Devolve: nada — remove na API, sincroniza e repinta. */
CW.delConn = function (id, isPending) {
  var doDel = function () {
    api('DELETE', '/api/connections/' + id)
      .then(function () { toast(isPending ? 'Convite removido.' : 'Conexão removida.'); return pullNow(true); })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message); });
  };
  if (isPending) return doDel();
  confirmModal('Remover conexão', 'Deixam ambos de ver as casas partilhadas um do outro. Os dados de cada um não são apagados.', doDel);
};

/* Modal para escolher que casas se partilham com a conexão connId. Ao guardar
   envia a lista à API e, para cada casa partilhada pela primeira vez, abre de
   seguida a proposta de divisão de quotas, uma de cada vez (fila _shareQueue).
   Recebe: connId — o id da conexão cujas partilhas se editam.
   Devolve: nada — abre o modal; o guardar acontece no onSave. */
CW.sharesModal = function (connId) {
  var c = (CW.state.connections || []).find(function (x) { return x.id === connId; });
  if (!c) return;
  // só os imóveis que criei eu: nunca os de colaboração nem os que outro partilhou comigo
  var myHouses = (db.properties || []).filter(function (p) { return cwMinha(p); });
  var body = myHouses.length
    ? '<div class="form"><div class="hint">Casas que partilhas com ' + esc(c.peer.name || c.peer.id) + '. Ele passa a ver e editar tudo o que pertence a estas casas: contratos, movimentos e pessoas associadas.</div>' +
      '<div class="list" style="gap:8px">' + myHouses.map(function (p) {
        var on = (c.myShares || []).indexOf(p.id) > -1;
        return '<label class="card" style="padding:12px 13px;display:flex;gap:11px;align-items:center;cursor:pointer">' +
          '<input type="checkbox" id="cw_sh_' + p.id + '" ' + (on ? 'checked' : '') + ' style="width:18px;height:18px">' +
          '<span style="min-width:0"><b style="display:block">' + esc(p.name || 'Sem nome') + '</b>' +
          '<span class="small">' + esc(p.address || '') + '</span></span></label>';
      }).join('') + '</div></div>'
    : '<div class="hint">Ainda não tens casas para partilhar.</div>';
  openModal('Partilhar casas', body);
  onSave = function () {
    var before = (c.myShares || []).slice();
    var ids = myHouses.filter(function (p) {
      var e = document.getElementById('cw_sh_' + p.id);
      return e && e.checked;
    }).map(function (p) { return p.id; });
    api('PUT', '/api/connections/' + connId + '/shares', { houseIds: ids })
      .then(function () { closeModal(); toast('Partilha atualizada.'); return pullNow(true); })
      .then(function () {
        render();
        // casas partilhadas agora pela primeira vez: pede logo a divisão de quotas
        var added = ids.filter(function (id) { return before.indexOf(id) < 0; });
        if (added.length) {
          CW._shareQueue = added.slice(1);
          CW.proposeShares(added[0], true);
        }
      })
      .catch(function (e) { toast(e.message); });
  };
};

// Passa à casa seguinte na fila de propostas de quotas que o sharesModal deixou.
// Devolve: nada — abre a proposta seguinte, se a houver.
function nextShareProposal() {
  var nxt = (CW._shareQueue || []).shift();
  if (nxt) CW.proposeShares(nxt, true);
}

/* Modal de mudança de palavra-passe, com os requisitos a acenderem-se à
   medida que se escreve. Quem entra com Google deixa o campo da atual vazio.
   Devolve: nada — abre o modal e liga os requisitos ao campo. */
CW.passwordModal = function () {
  var body = '<div class="form">' +
    '<div class="hint">Ao mudar a palavra-passe, todos os outros aparelhos têm de iniciar sessão de novo. ' +
    'Este continua ligado.</div>' +
    '<label>Palavra-passe atual<input id="cw_pw_cur" type="password" autocomplete="current-password" ' +
    'placeholder="deixa vazio se entras com Google"></label>' +
    '<label>Nova palavra-passe<input id="cw_pw_new" type="password" autocomplete="new-password"></label>' +
    '<div id="cw_pw_req" class="small" style="margin:-4px 0 0;display:flex;flex-wrap:wrap;gap:3px 12px"></div>' +
    '<label>Confirmar nova palavra-passe<input id="cw_pw_new2" type="password" autocomplete="new-password"></label>' +
    '<div id="cw_pw_err" class="small" style="color:var(--danger)"></div></div>';
  openModal('Mudar palavra-passe', body,
    '<button class="btn" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn primary" onclick="CW.savePassword()">Guardar</button>');
  var reqs = [['8+ caracteres', function (p) { return p.length >= 8; }],
    ['maiúscula', function (p) { return /[A-Z]/.test(p); }],
    ['minúscula', function (p) { return /[a-z]/.test(p); }],
    ['número', function (p) { return /[0-9]/.test(p); }],
    ['símbolo', function (p) { return /[^A-Za-z0-9]/.test(p); }]];
  var box = document.getElementById('cw_pw_req'), inp = document.getElementById('cw_pw_new');
  var paint = function () {
    box.innerHTML = reqs.map(function (r) {
      var ok = r[1](inp.value);
      return '<span style="color:' + (ok ? 'var(--accent)' : 'var(--muted)') + ';font-weight:' + (ok ? 650 : 400) + '">' +
        (ok ? '✓ ' : '• ') + r[0] + '</span>';
    }).join('');
  };
  paint();
  inp.addEventListener('input', paint);
};

/* Valida a nova palavra-passe e envia a mudança à API; o servidor termina as
   sessões dos outros aparelhos e pode devolver um token novo para este, que
   fica guardado. Os erros aparecem dentro do próprio modal.
   Devolve: nada — envia a mudança à API e fecha o modal quando corre bem. */
CW.savePassword = function () {
  var e = document.getElementById('cw_pw_err');
  e.textContent = '';
  var next = val('cw_pw_new');
  var prob = passProblem(next);
  if (prob) { e.textContent = prob; return; }
  if (next !== val('cw_pw_new2')) { e.textContent = 'As palavras-passe não coincidem.'; return; }
  api('POST', '/api/me/password', { current: val('cw_pw_cur'), next: next })
    .then(function (r) {
      if (r.token) {
        CW.user.token = r.token;
        try { localStorage.setItem(LS_USER, JSON.stringify(CW.user)); } catch (x) {}
      }
      closeModal();
      toast('Palavra-passe alterada. Os outros aparelhos têm de entrar de novo.');
    })
    .catch(function (err) { e.textContent = err.message || 'Não foi possível mudar a palavra-passe.'; });
};

// Depois de confirmado, termina a sessão em todos os outros aparelhos; este
// continua ligado (guarda o token novo se o servidor o devolver).
// Devolve: nada — pede confirmação e chama a API.
CW.revokeSessions = function () {
  confirmModal('Terminar as outras sessões',
    'Todos os outros aparelhos onde tenhas a conta aberta passam a pedir início de sessão. Este continua ligado.',
    function () {
      api('DELETE', '/api/me/sessions')
        .then(function (r) {
          if (r.token) {
            CW.user.token = r.token;
            try { localStorage.setItem(LS_USER, JSON.stringify(CW.user)); } catch (x) {}
          }
          toast('Sessões terminadas nos outros aparelhos.');
        })
        .catch(function (err) { toast(err.message); });
    });
};

// Modal de confirmação para apagar a conta: diz quantos imóveis se perdem e
// exige escrever APAGAR e a palavra-passe (vazia para quem entra com Google).
// Devolve: nada — abre o modal de confirmação.
CW.deleteAccount = function () {
  var mine = (db.properties || []).filter(function (p) { return cwMinha(p); }).length;
  var body = '<div class="form">' +
    '<div class="hint" style="color:var(--danger)"><b>Isto não se pode desfazer.</b> Vais apagar ' + mine +
    ' imóvel' + (mine === 1 ? '' : 'is') + ', com os contratos, movimentos e pessoas que lhes pertencem, ' +
    'e todas as tuas ligações a outros utilizadores.</div>' +
    '<div class="hint">Se quiseres guardar os teus registos, cancela e faz primeiro uma cópia de segurança ' +
    'em Definições → Dados → Guardar cópia.</div>' +
    '<label>Escreve <b>APAGAR</b> para confirmar<input id="cw_del_c" placeholder="APAGAR" autocomplete="off" style="text-transform:uppercase"></label>' +
    '<label>Palavra-passe<input id="cw_del_p" type="password" placeholder="deixa vazio se entras com Google" autocomplete="current-password"></label>' +
    '<div id="cw_del_e" class="small" style="color:var(--danger)"></div></div>';
  openModal('Apagar a minha conta', body,
    '<button class="btn" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn danger" onclick="CW.doDeleteAccount()">Apagar definitivamente</button>');
};

/* Apaga a conta na API (confirmação e palavra-passe validadas lá) e limpa
   este aparelho — dados locais, sessão e snapshots — a acabar no ecrã de
   entrada. Numa conta de teste o servidor pode entregar logo a seguinte, e
   nesse caso a app recarrega já com ela em vez de cair no login.
   Devolve: nada — apaga a conta, limpa o aparelho e acaba no ecrã de
   entrada (ou recarrega com a conta seguinte). */
CW.doDeleteAccount = function () {
  var e = document.getElementById('cw_del_e');
  e.textContent = '';
  api('DELETE', '/api/me', { confirm: val('cw_del_c'), password: val('cw_del_p') })
    .then(function (r) {
      /* numa conta de teste, o servidor entrega logo a próxima (a irmã do
         mesmo dev, ou uma nova): troca-se em vez de cair no login */
      if (r && r.proxima && r.proxima.token) {
        try {
          localStorage.setItem(LS_USER, JSON.stringify({
            id: r.proxima.id, email: r.proxima.email, name: r.proxima.name, token: r.proxima.token,
          }));
        } catch (x) {}
        location.reload();
        return;
      }
      // limpa tudo o que ficou neste aparelho
      CW.user = null;
      db = JSON.parse(JSON.stringify(blank));
      rawSet(KEY, JSON.stringify(db));
      ['gi_cloud_user', 'gi_cloud_owner', 'gi_page'].forEach(function (k) {
        try { localStorage.removeItem(k); } catch (x) {}
      });
      try { localStorage.removeItem(snapKey()); } catch (x) {}
      snap = {};
      closeAllModals();
      buildNav(); render();
      CW.showAuthMode = 'login';
      showAuth('Conta apagada. Obrigado por teres experimentado.');
    })
    .catch(function (err) { e.textContent = err.message || 'Não foi possível apagar a conta.'; });
};

// Termina a sessão neste aparelho depois de confirmar: os dados ficam na
// conta e a app volta ao ecrã de entrada, com a navegação reposta.
// Devolve: nada — termina a sessão e volta ao ecrã de entrada.
CW.logout = function () {
  confirmModal('Terminar sessão', 'Os dados continuam guardados na tua conta e voltam quando iniciares sessão.', function () {
    api('POST', '/api/auth/logout').catch(function () {});
    CW.user = null;
    CW.tickets = null;
    try { localStorage.removeItem(LS_USER); localStorage.removeItem(LS_PAGE); } catch (e) {}
    // a próxima entrada começa na visão geral, não onde se saiu
    tab = 'dashboard'; setPage = '';
    buildNav(); render();
    showAuth();
  });
};
