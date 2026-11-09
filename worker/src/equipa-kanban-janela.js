/* O kanban da equipa: a janela (dialog#dialogo) onde se confirma, escolhe e
   edita, e a das colunas do quadro (equipa-kanban.js junta-o ao resto).
   ---------------------------------------------------------------------
   Um pedaço do mesmo guião: as mesmas regras do topo do equipa-kanban.js
   (String.raw sem crases nem cifrão com chaveta; nada de on…= nem style= no
   HTML; nada de alert, prompt, confirm nem do seletor nativo; nomes de topo
   kb…, só function e var). Corre como parte de um único script clássico. */

export const GUIAO_KB_JANELA = String.raw`/* -------------------------------- a janela ------------------------------- */

/* Uma janela do kanban no dialog#dialogo (a mesma do guião, com as mesmas
   regras): o título, o corpo e, com aoConfirmar, Cancelar e o botão da
   ação — que espera enquanto o servidor responde e, se ele recusar, deixa a
   janela aberta com o porquê; sem aoConfirmar é uma lista de escolhas, só
   com Fechar. Ao fechar, esvazia-se.
   Recebe: titulo — o título (texto); corpo — o HTML (seguro); opcoes
   (opcional) — {aoConfirmar: função que lê os campos e devolve false (fica,
   com os erros marcados) ou uma promessa; botao; perigo; texto (HTML
   seguro); foco: o seletor do que recebe o foco}.
   Devolve: nada — abre a janela. */
function kbJanela(titulo, corpo, opcoes) {
  var o = opcoes || {}, d = el('dialogo');
  if (!d) return;
  if (typeof formAberto !== 'undefined') formAberto = null;
  kbJanelaAberta = { aoConfirmar: o.aoConfirmar || null, botao: o.botao || 'Guardar', ocupado: false };
  d.innerHTML = '<div class="janela-corpo kb-janela"><h2 id="janelaTit">' + esc(titulo) + '</h2>' +
    (o.texto ? '<p class="janela-txt">' + o.texto + '</p>' : '') + corpo +
    '<p class="erro-txt" id="kbJanelaErro" role="alert"></p><div class="janela-botoes">' +
    (o.aoConfirmar
      ? '<button type="button" class="btn"' + comAcao('fecharDialogo') + '>Cancelar</button>' +
        '<button type="button" id="kbJanelaOk" class="btn ' + (o.perigo ? 'danger' : 'primary') + '"' + comAcao('kbConfirmar') + '>' + esc(kbJanelaAberta.botao) + '</button>'
      : '<button type="button" class="btn"' + comAcao('fecharDialogo') + '>Fechar</button>') + '</div></div>';
  d.returnValue = '';
  d.onclose = function () {
    if (d.open) return;
    kbJanelaAberta = null;
    d.innerHTML = '';
  };
  if (!d.open) d.showModal();
  var f = (o.foco && d.querySelector(o.foco)) || d.querySelector('input:not([type=radio]),textarea,input:checked') || d.querySelector('.kb-opcao');
  if (f && f.focus) f.focus();
}
/* Confirma a janela aberta: o aoConfirmar lê e confere os campos (false
   deixa-a aberta com os erros); com uma promessa, o botão espera e fecha no
   fim, ou mostra o erro do servidor ao lado do campo de que fala.
   Devolve: nada. */
function kbConfirmar() {
  var j = kbJanelaAberta;
  if (!j || j.ocupado || !j.aoConfirmar) return;
  var e0 = el('kbJanelaErro');
  if (e0) e0.textContent = '';
  var r = j.aoConfirmar();
  if (r === false) return;
  j.ocupado = true;
  kbJanelaOcupada(true);
  Promise.resolve(r).then(function () {
    if (kbJanelaAberta === j) el('dialogo').close();
  }, function (e) {
    if (kbJanelaAberta !== j) return;
    j.ocupado = false;
    kbJanelaOcupada(false);
    var msg = (e && e.message) || 'Não deu.', campo = e && e.campo;
    if (campo && el(campo + 'Erro')) marcarErro(campo, msg);
    else if (el('kbJanelaErro')) el('kbJanelaErro').textContent = msg;
  });
}
// O botão da janela enquanto o servidor responde: parado e a dizer que espera.
// Recebe: sim — true enquanto espera.
// Devolve: nada.
function kbJanelaOcupada(sim) {
  var b = el('kbJanelaOk');
  if (!b || !kbJanelaAberta) return;
  b.disabled = sim;
  b.textContent = sim ? 'À espera do servidor…' : kbJanelaAberta.botao;
}
// Fecha a janela, se uma ação dentro dela levar a outro sítio.
// Devolve: nada.
function kbFecharJanela() {
  var d = el('dialogo');
  if (d && d.open) d.close();
}

/* -------------------------------- colunas -------------------------------- */

/* «Colunas» (só o master): a lista das colunas com subir, descer, renomear,
   marcar de fim e remover, e o «Adicionar coluna». As fixas (as que a
   sincronização usa) renomeiam-se mas não se removem; uma com cartões
   também não — o servidor diz porquê, aqui na janela.
   Devolve: nada — abre a janela. */
function kbColunas() {
  if (!kbEstado || !kbEu().master) return;
  var cs = kbEstado.colunas, n = cs.length;
  var linhas = cs.map(function (c, i) {
    var total = kbDaColuna(c.id).length;
    return '<li class="kb-colm"><div class="kb-colm-txt"><span class="kb-colm-nome">' + esc(c.nome) + '</span>' +
      (c.fim ? badge('ok', 'De fim') : '') + (c.fixa ? badge('', 'Fixa') : '') + '<span class="sub n">' + kbConta(total, 'cartão', 'cartões') + '</span></div>' +
      '<div class="kb-colm-acoes">' +
      '<button type="button" class="btn sm ghost so-icone" aria-label="Subir ' + esc(c.nome) + '"' + (i === 0 ? ' disabled' : '') + comAcao('kbColunaOrdem', [c.id, -1]) + '>' + ic('voltar', 'i-sm kb-i-cima') + '</button>' +
      '<button type="button" class="btn sm ghost so-icone" aria-label="Descer ' + esc(c.nome) + '"' + (i === n - 1 ? ' disabled' : '') + comAcao('kbColunaOrdem', [c.id, 1]) + '>' + ic('voltar', 'i-sm kb-i-baixo') + '</button>' +
      '<button type="button" class="btn sm"' + comAcao('kbColunaRenomear', [c.id]) + '>Renomear</button>' +
      '<button type="button" class="btn sm"' + comAcao('kbColunaFim', [c.id]) + '>' + (c.fim ? 'Tirar de fim' : 'Marcar de fim') + '</button>' +
      (c.fixa ? '' : '<button type="button" class="btn sm ghost texto-perigo"' + comAcao('kbColunaRemover', [c.id]) + '>Remover</button>') + '</div></li>';
  }).join('');
  kbJanela('Colunas', '<p class="sub">As fixas são as que a sincronização usa: renomeiam-se, mas não se removem. O que chega a uma coluna de fim conta como feito.</p>' +
    '<ul class="kb-colms">' + linhas + '</ul><div><button type="button" class="btn sm"' + comAcao('kbColunaNova') + '>' + ic('mais', 'i-sm') + 'Adicionar coluna</button></div>');
}
/* Depois de mudar as colunas: relê o quadro, volta à lista das colunas e diz
   o que se fez. Quem fechou a janela entretanto não a vê abrir-se sozinha —
   só o renomear e o adicionar, que a fecharam ao confirmar, voltam à lista.
   Recebe: msg — a frase do aviso; reabrir (opcional) — true para voltar à lista mesmo com a janela fechada.
   Devolve: Promise. */
function kbDepoisDasColunas(msg, reabrir) {
  return kbRecarregar().then(function () {
    var d = el('dialogo');
    if (reabrir ? !(d && d.open) : (d && d.open && el('janelaTit') && el('janelaTit').textContent === 'Colunas')) kbColunas();
    avisar(msg);
  });
}
/* Um erro do servidor dito na janela das colunas (fica aberta).
   Recebe: e — o Error.
   Devolve: nada. */
function kbErroNasColunas(e) {
  var s = el('kbJanelaErro');
  if (s) s.textContent = (e && e.message) || 'Não deu.';
  else avisar((e && e.message) || 'Não deu.', 'erro');
}
/* Sobe ou desce uma coluna um lugar.
   Recebe: id; dir — -1 sobe, 1 desce.
   Devolve: nada. */
function kbColunaOrdem(id, dir) {
  var ids = kbEstado.colunas.map(function (c) { return c.id; }), i = ids.indexOf(id), j = i + Number(dir);
  if (i < 0 || j < 0 || j >= ids.length) return;
  ids[i] = ids[j]; ids[j] = id;
  enviar('/api/equipa/kanban/colunas/ordem', { ids: ids }).then(function () { return kbDepoisDasColunas('Ordem das colunas guardada.'); }).catch(kbErroNasColunas);
}
/* Marca ou tira uma coluna de fim.
   Recebe: id.
   Devolve: nada. */
function kbColunaFim(id) {
  var c = kbColuna(id);
  if (!c) return;
  pedir('/api/equipa/kanban/colunas/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fim: !c.fim }) })
    .then(function () { return kbDepoisDasColunas(c.fim ? '«' + c.nome + '» deixou de ser de fim.' : '«' + c.nome + '» passou a ser de fim.'); }).catch(kbErroNasColunas);
}
/* Remove uma coluna (o servidor recusa as fixas e as que têm cartões, e diz porquê).
   Recebe: id.
   Devolve: nada. */
function kbColunaRemover(id) {
  var c = kbColuna(id);
  pedir('/api/equipa/kanban/colunas/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function () { return kbDepoisDasColunas('Coluna «' + (c ? c.nome : id) + '» removida.'); }).catch(kbErroNasColunas);
}
/* Renomeia uma coluna.
   Recebe: id.
   Devolve: nada — abre a janela. */
function kbColunaRenomear(id) {
  var c = kbColuna(id);
  if (!c) return;
  kbJanela('Renomear «' + c.nome + '»', kbCampoHtml('kbF-coluna-nome', 'Nome', true, 'text', c.nome, 'Ex: Em revisão', 60), {
    foco: '#kbF-coluna-nome',
    aoConfirmar: function () {
      var nome = valorDe('kbF-coluna-nome');
      marcarErro('kbF-coluna-nome', nome ? '' : 'Escreve um nome.');
      if (!nome) return false;
      return pedir('/api/equipa/kanban/colunas/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome }) })
        .then(function () { setTimeout(function () { kbDepoisDasColunas('Coluna renomeada.', true); }, 0); });
    },
  });
}
/* Adiciona uma coluna (vai para o fim do quadro).
   Devolve: nada — abre a janela. */
function kbColunaNova() {
  kbJanela('Adicionar coluna', kbCampoHtml('kbF-coluna-nome', 'Nome', true, 'text', '', 'Ex: Em revisão', 60) +
    '<label class="kb-marcar"><input type="checkbox" id="kbF-coluna-fim"> Conta como feito (coluna de fim)</label>', {
    botao: 'Adicionar', foco: '#kbF-coluna-nome',
    aoConfirmar: function () {
      var nome = valorDe('kbF-coluna-nome'), fim = !!(el('kbF-coluna-fim') && el('kbF-coluna-fim').checked);
      marcarErro('kbF-coluna-nome', nome ? '' : 'Escreve um nome.');
      if (!nome) return false;
      return enviar('/api/equipa/kanban/colunas', { nome: nome, fim: fim })
        .then(function () { setTimeout(function () { kbDepoisDasColunas('Coluna «' + nome + '» adicionada.', true); }, 0); });
    },
  });
}

/* ------------------- as ações da janela e das colunas ------------------- */

/* Uma ação que pode vir de dentro da janela (o ⋯ de um cartão): fecha-a
   antes de seguir, a menos que a própria ação reabra a janela.
   Recebe: alvo — o elemento clicado.
   Devolve: nada. */
function kbSairDaJanela(alvo) {
  if (alvo && alvo.closest && alvo.closest('#dialogo')) kbFecharJanela();
}

ACOES.kbConfirmar = function () { kbConfirmar(); };
ACOES.kbColunas = function () { kbColunas(); };
ACOES.kbColunaNova = function () { kbColunaNova(); };
ACOES.kbColunaRenomear = function (d) { kbColunaRenomear(d.arg); };
ACOES.kbColunaOrdem = function (d) { kbColunaOrdem(d.arg, d.arg2); };
ACOES.kbColunaFim = function (d) { kbColunaFim(d.arg); };
ACOES.kbColunaRemover = function (d) { kbColunaRemover(d.arg); };
`;

// os estilos deste pedaço (o CSS_KANBAN do equipa-kanban.js junta-os pela ordem certa)
export const CSS_KB_JANELA = `/* ---- a janela (formulários, escolhas, colunas) ---- */
.kb-janela{max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain}
.kb-janela .lbl{margin-top:4px}
.kb-opcoes{display:flex;flex-direction:column;gap:6px}
.kb-opcao[aria-pressed="true"]{border-color:var(--accent);color:var(--accent-text);background:var(--accent-soft)}
.kb-opcao .i{color:var(--accent)}
.kb-colms{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px}
.kb-colm{display:flex;flex-direction:column;gap:8px;padding:10px 12px}
.kb-colm+.kb-colm{border-top:1px solid var(--line)}
.kb-colm-txt{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
.kb-colm-nome{font-weight:650}
.kb-colm-acoes{display:flex;flex-wrap:wrap;gap:6px}
.kb-i-cima{transform:rotate(90deg)}
.kb-i-baixo{transform:rotate(-90deg)}
.kb-marcar{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;cursor:pointer}
.kb-marcar input{width:20px;height:20px;accent-color:var(--accent)}
`;
