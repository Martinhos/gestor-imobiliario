/* Colaboradores com cargos, convites de uso unico e a ligacao de partilha.
   ----------------------------------------------------------------------
   As ações do separador Colaboradores, da página Conta e partilha (só a
   ligação de partilha e os pedidos) e da aterragem das ligações: cargos
   (PUT/DELETE /api/roles/:id), convites (POST/GET/DELETE /api/collab-invites
   e POST /api/convite/:token/aceitar), colaboradores (PUT/DELETE
   /api/collaborators/:id), a ligação permanente (POST/DELETE /api/share-link
   e POST /api/ligar/:token/pedir) e os pedidos de partilha
   (POST /api/share-requests/:id/accept|reject, DELETE /api/share-requests/:id).

   A decisão pura — quem pode o quê em cada imóvel — vive em
   web/app/acessos.js (pode, souDono, temPerm, ROTULOS, CARGOS_EXEMPLO), para
   o arnês a testar sem esta camada. Aqui só se fala com o servidor e se
   desenham os modais; o servidor decide, o cliente esconde. Depois de cada
   ação: pullNow(true) e render() — render() repinta o separador aberto, seja
   ele qual for, por isso nenhuma ação precisa de saber para onde voltar. A
   página do separador (paginaDosColaboradores, o canvas de 2026-10:
   D-Colaboradores) e as janelas do convite (M-Convidar, M-ConviteCriado)
   vivem aqui, no fim; os cartões antigos (vColaboradores, convidarCard,
   cargosCard, colaboradoresCard) continuam em partilha.js. */
'use strict';

/* O URL da ligação permanente só se mostra na criação, e fica guardado no
   aparelho por conta (nucleo.js:chaveDaLigacao) — a chave sem dono das
   versões anteriores deixava quem entrasse a seguir copiar a ligação de quem
   saiu, e não se sabe de quem era: esquece-se.
   Devolve: nada — apaga a chave antiga do localStorage. */
function largarLigacaoSemDono() {
  try { localStorage.removeItem(LS_LIGACAO); } catch (e) {}
}
largarLigacaoSemDono();

/* ---------------- as permissões na interface ---------------- */

/* As linhas do modal do cargo: uma por entidade, com o interruptor «Ver» e,
   quando existe, o «Adicionar» (hipotecas e avaliação só se veem; a ficha do
   imóvel só se edita). A ordem é a do contrato; os rótulos vêm de ROTULOS
   (web/app/acessos.js). */
var ENTIDADES = [
  { nome: 'Movimentos', ver: 'tx.view', add: 'tx.add' },
  { nome: 'Planeados', ver: 'rec.view', add: 'rec.add' },
  { nome: 'Visitas', ver: 'visit.view', add: 'visit.add' },
  { nome: 'Contratos', ver: 'contract.view', add: 'contract.add' },
  { nome: 'Inquilinos', ver: 'tenant.view', add: 'tenant.add' },
  { nome: 'Hipotecas', ver: 'loan.view' },
  { nome: 'Fotos e documentos', ver: 'file.view', add: 'file.add' },
  { nome: 'Valores e avaliação', ver: 'report.view' },
  { nome: 'Ficha do imóvel', add: 'house.edit', addRotulo: 'Editar' },
];
// O rótulo de uma permissão para a interface, de ROTULOS (web/app/acessos.js).
// Recebe: perm — a chave da permissão (ex.: 'tx.add').
// Devolve: o rótulo (texto); a própria chave se ninguém a conhecer.
function rotuloDe(perm) {
  var r = ROTULOS[perm];
  return (r && r.rotulo) || perm;
}

// O fecho de uma lista de permissões (contract.add ⇒ rec.add ⇒ rec.view), em
// array e pela ordem de PERMS: o fechoPerms de web/app/acessos.js, que é a
// regra do servidor — sem segunda cópia dela aqui.
// Recebe: perms — array de chaves (aguenta null, Sets e objetos {chave: true}).
// Devolve: array de chaves, já fechado.
function permsFechadas(perms) {
  var fecho = fechoPerms(perms || []);
  var lista = PERMS.filter(function (p) { return fecho.has(p); });
  fecho.forEach(function (p) { if (lista.indexOf(p) < 0) lista.push(p); });
  return lista;
}

// Um resumo legível de um cargo, para a lista: «Vê movimentos, contratos ·
// Adiciona visitas · Edita a ficha do imóvel».
// Recebe: perms — as chaves do cargo (array ou objeto).
// Devolve: o texto do resumo; «Sem permissões» quando não há nenhuma.
function resumoPerms(perms) {
  var tem = permsFechadas(perms);
  var ve = [], adiciona = [], edita = false;
  ENTIDADES.forEach(function (e) {
    var nome = e.nome.toLowerCase();
    if (e.add === 'house.edit') { if (tem.indexOf('house.edit') > -1) edita = true; return; }
    if (e.add && tem.indexOf(e.add) > -1) adiciona.push(nome);
    else if (e.ver && tem.indexOf(e.ver) > -1) ve.push(nome);
  });
  var partes = [];
  if (ve.length) partes.push('Vê ' + ve.join(', '));
  if (adiciona.length) partes.push('Adiciona ' + adiciona.join(', '));
  if (edita) partes.push('Edita a ficha do imóvel');
  return partes.length ? partes.join(' · ') : 'Sem permissões';
}

// Os cargos de exemplo, na forma que o modal usa ({nome, perms, sub}): os de
// CARGOS_EXEMPLO (web/app/acessos.js), com as permissões já fechadas.
// Devolve: array de {nome, perms, sub}.
function cargosExemplo() {
  return CARGOS_EXEMPLO.map(function (c) {
    return { nome: c.nome, perms: permsFechadas(c.perms), sub: c.sub || '' };
  });
}

// Os cargos deste utilizador, tal como o estado os traz.
// Devolve: array de {id, name, perms, n} (vazio sem estado).
function cargosDoDono() {
  return (CW.state && Array.isArray(CW.state.roles)) ? CW.state.roles : [];
}

// O nome de um cargo pelo id, para os textos.
// Recebe: id — o id do cargo.
// Devolve: o nome (texto), ou '' se não existir.
function nomeDoCargo(id) {
  var r = cargosDoDono().find(function (x) { return x.id === id; });
  return r ? r.name : '';
}

// Os imóveis que criei eu (os únicos onde gero colaboradores e convites).
// Devolve: array de imóveis de db.properties.
function imoveisMeus() {
  return (db.properties || []).filter(function (p) { return cwMinha(p); });
}

// Os nomes dos imóveis numa lista, em texto corrido.
// Recebe: casas — array de {name} ou de ids de db.properties.
// Devolve: os nomes separados por vírgulas («Sem nome» quando falta).
function nomesDeCasas(casas) {
  return (casas || []).map(function (c) {
    if (typeof c === 'string') { var p = (db.properties || []).find(function (x) { return x.id === c; }); return (p && p.name) || 'Sem nome'; }
    return (c && c.name) || 'Sem nome';
  }).join(', ');
}

/* ---------------- cargos ---------------- */

// Uma caixa de verificação de permissão, com a chave no data-perm. O rótulo
// é a área de toque (colab-perm-caixa: 44px de altura no dedo, com folga dos
// lados), para Ver, Adicionar e Editar não se trocarem.
// Recebe: perm — a chave; rotulo — o texto ao lado; on — se começa marcada.
// Devolve: o HTML do <label class="check">.
function caixaPerm(perm, rotulo, on) {
  return '<label class="check colab-perm-caixa"><input type="checkbox" data-perm="' + perm + '" id="cg_' + perm.replace('.', '_') + '"' +
    (on ? ' checked' : '') + ' data-toca="rascunho" data-change="CW.cargoImplica()"><span>' + esc(rotulo) + '</span></label>';
}

/* Abre o modal de criar ou editar um cargo: o nome e uma linha por entidade
   com os interruptores Ver/Adicionar; as implicações ligam-se sozinhas
   (cargoImplica). Num cargo novo, os três exemplos «Usar este» no topo.
   Recebe: id (opcional) — o id do cargo a editar; sem id cria um novo.
   Devolve: nada — abre o modal e deixa a gravação em onSave. */
CW.cargoModal = function (id) {
  var r = id ? cargosDoDono().find(function (x) { return x.id === id; }) : null;
  var tem = r ? permsFechadas(r.perms) : [];
  var exemplos = r ? '' :
    '<div><div class="flabel">Começar por um cargo pronto</div><div class="list u-g-8px">' +
    cargosExemplo().map(function (c, i) {
      return '<button type="button" class="card tap u-p-11px-13px u-ta-left" data-toca="rascunho" data-click="CW.cargoExemplo(' + i + ')">' +
        '<div class="row-between u-ai-center u-g-10px"><span class="u-minw-0"><b class="u-d-block">' + esc(c.nome) + '</b>' +
        '<span class="small">' + esc(c.sub) + '</span></span><span class="badge u-fx-0-0-auto">Usar este</span></div></button>';
    }).join('') + '</div></div>';
  var linhas = ENTIDADES.map(function (e) {
    return '<div class="stat u-ai-center colab-perm-linha"><span>' + esc(e.nome) + '</span>' +
      '<span class="colab-perm-caixas">' +
      (e.ver ? caixaPerm(e.ver, 'Ver', tem.indexOf(e.ver) > -1) : '') +
      (e.add ? caixaPerm(e.add, e.addRotulo || 'Adicionar', tem.indexOf(e.add) > -1) : '') + '</span></div>';
  }).join('');
  var body = '<div class="form">' + exemplos +
    '<label>Nome do cargo <span class="req">*</span><input id="cg_nome" maxlength="40" value="' + esc(r ? r.name : '') + '" placeholder="Ex: Gestor de visitas" autocomplete="off"></label>' +
    '<div><div class="flabel">O que pode fazer <span class="req">*</span></div>' + linhas +
    '<div class="hint u-mt-8px">«Adicionar» inclui ver, e editar ou apagar só o que o próprio criar. ' +
    'Editar a ficha do imóvel traz as hipotecas e os documentos; adicionar contratos traz os planeados. ' +
    'Um colaborador nunca tem quota-parte nem entra nas contas entre proprietários.</div></div></div>';
  var m = r ? menu('cargo', [{ label: 'Apagar cargo', icon: 'trash', danger: true, toca: 'dados', risco: 'destroi', act: "CW.apagarCargo('" + jsq(id) + "')" }]) : '';
  openModal(r ? 'Editar cargo' : 'Novo cargo', body, null, m);
  CW._cargoId = r ? id : null;
  CW.cargoImplica();
  onSave = function () { CW.guardarCargo(); };
};

/* Liga sozinhas as permissões implicadas pelas marcadas à mão (Adicionar traz
   Ver; a ficha do imóvel traz hipotecas e documentos; contratos trazem
   planeados) e tranca-as, com a razão no título. Desmarcar a de origem
   solta-as outra vez.
   Devolve: nada — mexe nas caixas do modal aberto. */
CW.cargoImplica = function () {
  var caixas = [].slice.call(document.querySelectorAll('input[data-perm]'));
  // primeiro soltam-se as que só estavam marcadas por arrasto
  caixas.forEach(function (c) { if (c.dataset.auto === '1') { c.checked = false; c.disabled = false; c.dataset.auto = ''; c.title = ''; } });
  var manuais = caixas.filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.perm; });
  var fecho = permsFechadas(manuais);
  caixas.forEach(function (c) {
    var p = c.dataset.perm;
    if (manuais.indexOf(p) > -1 || fecho.indexOf(p) < 0) return;
    var origem = manuais.filter(function (mp) { return permsFechadas([mp]).indexOf(p) > -1; })[0];
    c.checked = true; c.disabled = true; c.dataset.auto = '1';
    c.title = 'vem com ' + rotuloDe(origem || '').toLowerCase();
  });
};

// Preenche o modal com um dos cargos de exemplo (nome e permissões), para editar depois.
// Recebe: i — o índice em cargosExemplo().
// Devolve: nada — escreve no formulário aberto.
CW.cargoExemplo = function (i) {
  var c = cargosExemplo()[i];
  if (!c) return;
  var nome = document.getElementById('cg_nome');
  if (nome && !nome.value.trim()) nome.value = c.nome;
  [].slice.call(document.querySelectorAll('input[data-perm]')).forEach(function (cx) {
    cx.disabled = false; cx.dataset.auto = ''; cx.title = '';
    cx.checked = c.perms.indexOf(cx.dataset.perm) > -1;
  });
  CW.cargoImplica();
};

/* Grava o cargo do modal aberto: exige nome e pelo menos uma permissão, e
   envia PUT /api/roles/:id (cria ou atualiza; um id novo nasce aqui). Se a
   janela do convite está por baixo (o «Criar outro cargo»), repinta-se com o
   cargo novo.
   Recebe: nada (lê o formulário aberto).
   Devolve: nada — fecha o modal, avisa e sincroniza quando o servidor aceitar. */
CW.guardarCargo = function () {
  var nome = (val('cg_nome') || '').trim();
  if (!nome) return falhaCampo('cg_nome', 'Dá um nome ao cargo.');
  var perms = [].slice.call(document.querySelectorAll('input[data-perm]'))
    .filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.perm; });
  if (!perms.length) return toast('Marca pelo menos uma permissão.');
  var novo = !CW._cargoId, id = CW._cargoId || (typeof uid === 'function' ? uid() : 'r' + Date.now());
  api('PUT', '/api/roles/' + encodeURIComponent(id), { name: nome, perms: permsFechadas(perms) })
    .then(function () { closeModal(); toast('Cargo guardado.'); return pullNow(true); })
    .then(function () { render(); repintarConvite(novo ? id : ''); })
    .catch(function (e) { toast(e.message); });
};

/* Apaga um cargo depois de confirmar. O servidor recusa (409) um cargo que
   ainda esteja atribuído — a mensagem dele diz a quantas pessoas — e o
   cliente mostra-a tal e qual.
   Recebe: id — o id do cargo.
   Devolve: nada — pede confirmação; só depois chama a API. */
CW.apagarCargo = function (id) {
  var nome = nomeDoCargo(id) || 'este cargo';
  confirmModal('Apagar cargo', 'O cargo <b>' + esc(nome) + '</b> desaparece da lista. Não há como desfazer.', function () {
    api('DELETE', '/api/roles/' + encodeURIComponent(id))
      .then(function () { closeAllModals(); toast('Cargo apagado.'); return pullNow(true); })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message, { ms: 6000 }); });
  });
};

/* ---------------- convites (uso único) ---------------- */

// Os imóveis marcados nas caixas cw_inv_h_<id> (ou no prefixo dado).
// Recebe: prefixo (opcional) — o prefixo dos ids das caixas ('cw_inv_h_' por omissão).
// Devolve: array de ids de imóveis marcados.
function casasMarcadas(prefixo) {
  var pre = prefixo || 'cw_inv_h_';
  return imoveisMeus().filter(function (p) {
    var e = document.getElementById(pre + p.id);
    return e && e.checked;
  }).map(function (p) { return p.id; });
}

/* Marca, no convite, os imóveis de um grupo escolhido em «Escolher pelo
   grupo…» — o seletor do cartão antigo (partilha.js:convidarCard); a janela
   do convite usa os chips (CW.conviteGrupo). É só um atalho: a lista
   guardada é a dos imóveis marcados agora — os que se juntarem ao grupo
   depois não entram.
   Recebe: nada (lê o seletor cw_inv_grupo).
   Devolve: nada — marca as caixas e repõe o seletor. */
window.cwInvGrupo = function () {
  var v = val('cw_inv_grupo') || '';
  if (v.indexOf('g:') !== 0) return;
  var g = (db.groups || []).find(function (x) { return x.id === v.slice(2); });
  if (!g) return;
  (g.ids || []).forEach(function (pid) {
    var e = document.getElementById('cw_inv_h_' + pid);
    if (e) e.checked = true;
  });
  var inp = document.getElementById('cw_inv_grupo');
  if (inp) inp.value = '';
  var lab = document.getElementById('lab_cw_inv_grupo');
  if (lab) lab.textContent = 'Escolher pelo grupo…';
};

/* Marca todo o texto de um campo. Era o this.select() escrito no on…= do
   campo da ligação, e o select() não está na lista dos métodos que uma ação
   chama no this (web/app/eventos.js).
   Recebe: campo — o campo de texto (o this da ação).
   Devolve: nada — deixa o texto do campo selecionado. */
function selecionarCampo(campo) {
  campo.select();
}

// O corpo da janela de uma ligação: o campo só de leitura com a ligação e a nota.
// Recebe: url — a ligação; hint — a nota por baixo (HTML).
// Devolve: o HTML do corpo (texto).
function ligacaoCorpo(url, hint) {
  return '<div class="form"><input id="cw_lig_url" class="u-ff-monospace u-fs-12p5px" readonly value="' + esc(url) + '" data-toca="nada" data-click="selecionarCampo(this)">' +
    '<div class="hint">' + hint + '</div></div>';
}

// O rodapé da janela de uma ligação: «Fechar», «Partilhar…» (só quando o
// aparelho sabe partilhar) e «Copiar ligação».
// Recebe: url — a ligação.
// Devolve: o HTML do rodapé (texto).
function ligacaoRodape(url) {
  return '<button class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>' +
    (navigator.share ? '<button class="btn" data-toca="nada" data-click="CW.partilharLigacao(\'' + jsq(url) + '\')">Partilhar…</button>' : '') +
    '<button class="btn primary" data-toca="nada" data-click="CW.copiar(\'' + jsq(url) + '\')">Copiar ligação</button>';
}

// O modal que mostra uma ligação acabada de criar, com «Copiar ligação» e
// «Partilhar…» (só quando o aparelho sabe partilhar).
// Recebe: titulo — o título do modal; url — a ligação; hint — a nota por baixo.
// Devolve: nada — abre o modal.
function ligacaoModal(titulo, url, hint) {
  openModal(titulo, ligacaoCorpo(url, hint), ligacaoRodape(url));
}

/* Cria uma ligação de convite com o cargo e os imóveis marcados na janela
   «Convidar colaborador» (POST /api/collab-invites): fecha a janela do
   convite e abre «Convite pronto» (corpoDoConvitePronto), com a ligação para
   copiar ou partilhar e quando expira. Vale 7 dias e uma só utilização; o
   token só existe nesta resposta.
   Recebe: nada (lê o formulário aberto).
   Devolve: nada — abre a janela da ligação e sincroniza. */
CW.criarConvite = function () {
  var roleId = val('cw_inv_cargo') || '';
  if (!roleId) return toast('Escolhe um cargo.');
  var houseIds = casasMarcadas();
  if (!houseIds.length) return toast('Marca pelo menos um imóvel.');
  var label = (val('cw_inv_label') || '').trim();
  var corpo = { roleId: roleId, houseIds: houseIds };
  if (label) corpo.label = label;
  api('POST', '/api/collab-invites', corpo)
    .then(function (r) {
      r = r || {};
      var cargo = nomeDoCargo(roleId) || 'Colaborador';
      toast('Ligação de convite criada — copia-a e envia.');
      // a janela do convite sai: a ligação abre no lugar dela, e não por cima
      if (CW._conviteJanela && typeof modalTop === 'function' && modalTop() === CW._conviteJanela) closeModal();
      CW._conviteJanela = null;
      openModal('Convite pronto', corpoDoConvitePronto(r.url || '', cargo, houseIds, r.expiresAt),
        '<button class="btn" data-toca="camada" data-click="closeModal()">Feito</button>');
      return pullNow(true);
    })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message, { ms: 6000 }); });
};

// Revoga um convite por usar (DELETE /api/collab-invites/:id): a ligação deixa de abrir.
// Recebe: id — o id do convite, como o estado o traz.
// Devolve: nada — pede confirmação, chama a API e sincroniza.
CW.revogarConvite = function (id) {
  confirmModal('Revogar convite', 'A ligação deixa de funcionar. Quem ainda não a abriu já não entra por ela.', function () {
    api('DELETE', '/api/collab-invites/' + encodeURIComponent(id))
      .then(function () { toast('Convite revogado.'); return pullNow(true); })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message); });
  });
};

// Copia um texto (uma ligação) para a área de transferência; o toast aparece
// na mesma quando o clipboard não existe, como no copyId.
// Recebe: texto — o que copiar.
// Devolve: nada — copia e avisa.
CW.copiar = function (texto) {
  var done = function () { toast('Ligação copiada.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(String(texto)).then(done, done);
  else done();
};

// Abre a folha de partilha do aparelho com a ligação (navigator.share); sem
// ela, copia.
// Recebe: url — a ligação a enviar.
// Devolve: nada — a folha de partilha trata do resto.
CW.partilharLigacao = function (url) {
  if (!navigator.share) return CW.copiar(url);
  navigator.share({ title: 'Rendorium', text: 'Uma ligação para colaborares comigo no Rendorium.', url: url })
    .catch(function () {});
};

/* ---------------- colaboradores (do dono) ---------------- */

// A linha de um colaborador no estado, pelo id.
// Recebe: id — o id da linha de colaboração.
// Devolve: o objeto {id, userId, name, roleId, roleName, houses} ou null.
function colaboradorDoEstado(id) {
  return ((CW.state && CW.state.collaborators) || []).find(function (c) { return c.id === id; }) || null;
}

/* Um imóvel na lista de caixas das janelas do convite e do «Mudar» (o canvas,
   M-Convidar): uma linha de 52px, com divisória, num cartão (.colab-casas) —
   a caixa, o nome e, por baixo, a morada. Eram caixas soltas de 22px, coladas
   umas às outras.
   Recebe: p — o imóvel; prefixo — o prefixo do id da caixa ('cw_inv_h_' ou
   'cw_col_h_', que casasMarcadas lê); marcada — se começa marcada.
   Devolve: o HTML do <label> (texto). */
function caixaDeCasa(p, prefixo, marcada) {
  return '<label class="check colab-casa"><input type="checkbox" id="' + prefixo + esc(p.id) + '"' + (marcada ? ' checked' : '') + '>' +
    '<span class="colab-txt"><b>' + esc(p.name || 'Sem nome') + '</b>' + (p.address ? '<span class="small">' + esc(p.address) + '</span>' : '') + '</span></label>';
}

/* Modal para mudar o cargo ou os imóveis de um colaborador
   (PUT /api/collaborators/:id {roleId, houseIds}). A lista de imóveis é a
   guardada — um instantâneo — por isso o atalho do grupo não entra aqui. Os
   imóveis vêm na lista do convite (caixaDeCasa).
   Recebe: id — o id da linha de colaboração.
   Devolve: nada — abre o modal e deixa a gravação em onSave. */
CW.mudarColaborador = function (id) {
  var c = colaboradorDoEstado(id);
  if (!c) return toast('Esse colaborador já não está na lista.');
  var cargos = cargosDoDono().map(function (r) { return { v: r.id, label: r.name }; });
  var tem = (c.houses || []).map(function (h) { return h.id; });
  var body = '<div class="form">' +
    '<div class="hint"><b>' + esc(c.name || '') + '</b> — escolhe o cargo e os imóveis onde colabora.</div>' +
    '<label>Cargo <span class="req">*</span>' + sel('cw_col_cargo', c.roleId, cargos, '', 'rascunho') + '</label>' +
    '<div><div class="flabel">Imóveis <span class="req">*</span></div><div class="colab-casas">' +
    imoveisMeus().map(function (p) { return caixaDeCasa(p, 'cw_col_h_', tem.indexOf(p.id) > -1); }).join('') + '</div></div></div>';
  openModal('Mudar cargo ou imóveis', body);
  onSave = function () {
    var roleId = val('cw_col_cargo') || c.roleId;
    var houseIds = casasMarcadas('cw_col_h_');
    if (!houseIds.length) return toast('Marca pelo menos um imóvel — ou remove o colaborador.');
    api('PUT', '/api/collaborators/' + encodeURIComponent(id), { roleId: roleId, houseIds: houseIds })
      .then(function () { closeModal(); toast('Colaborador atualizado.'); return pullNow(true); })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message); });
  };
};

// Remove um colaborador (DELETE /api/collaborators/:id) depois de confirmar:
// deixa de ver os imóveis; o que registou fica.
// Recebe: id — o id da linha de colaboração.
// Devolve: nada — pede confirmação, chama a API e sincroniza.
CW.removerColaborador = function (id) {
  var c = colaboradorDoEstado(id);
  var quem = c ? esc(c.name || 'Este colaborador') : 'Este colaborador';
  var onde = c && c.houses && c.houses.length ? esc(nomesDeCasas(c.houses)) : 'estes imóveis';
  confirmModal('Remover colaborador', '<b>' + quem + '</b> deixa de ver ' + onde + '. Os registos que criou ficam.', function () {
    api('DELETE', '/api/collaborators/' + encodeURIComponent(id))
      .then(function () { toast('Colaborador removido — deixa de ver estes imóveis.'); return pullNow(true); })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message); });
  });
};

/* Sair de um imóvel (ou de vários) onde sou colaborador: é a mesma linha de
   colaboração (DELETE /api/collaborators/:id, que o próprio pode chamar). O
   que registei fica com o dono.
   Recebe: collabId — o id da linha de colaboração (p._collabId do imóvel).
   Devolve: nada — pede confirmação, chama a API e sincroniza. */
CW.sairDeImovel = function (collabId) {
  var casas = (db.properties || []).filter(function (p) { return p._collabId === collabId; });
  var nomes = casas.length ? nomesDeCasas(casas) : 'este imóvel';
  var titulo = casas.length > 1 ? 'Sair de ' + casas.length + ' imóveis' : 'Sair de ' + (casas[0] ? (casas[0].name || 'Sem nome') : 'imóvel');
  confirmModal(titulo, 'Deixas de ver <b>' + esc(nomes) + '</b>. O que registaste fica com o dono.', function () {
    api('DELETE', '/api/collaborators/' + encodeURIComponent(collabId))
      .then(function () { toast('Saíste de ' + nomes + '.'); return pullNow(true); })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message); });
  });
};

/* ---------------- a ligação de partilha (permanente) ---------------- */

// Guarda no aparelho o URL da ligação permanente, que o servidor só devolve
// na criação e na rotação — é daqui que o «Copiar ligação» o lê. Na chave
// desta conta (chaveDaLigacao), que o ritual de saída apaga.
// Recebe: url — a ligação (vazio apaga a guardada).
// Devolve: nada — escreve no localStorage.
function guardarLigacao(url) {
  try { if (url) localStorage.setItem(chaveDaLigacao(), url); else localStorage.removeItem(chaveDaLigacao()); } catch (e) {}
}

// O que a criação e a rotação têm em comum: POST /api/share-link, guardar o
// URL, mostrá-lo e sincronizar.
// Recebe: msg — o toast a mostrar quando o servidor responder.
// Devolve: nada — abre o modal da ligação e sincroniza.
function ligacaoNova(msg) {
  api('POST', '/api/share-link')
    .then(function (r) {
      guardarLigacao(r.url || '');
      toast(msg);
      ligacaoModal('A minha ligação de partilha', r.url || '',
        'Quem a abrir escolhe que imóveis partilha contigo; tu aceitas ou recusas cada pedido. Não tem prazo — podes rodá-la ou desativá-la quando quiseres.');
      return pullNow(true);
    })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message, { ms: 6000 }); });
}

// Cria a ligação de partilha permanente (uma por utilizador).
// Devolve: nada — mostra a ligação e sincroniza.
CW.ligacaoCriar = function () { ligacaoNova('Ligação de partilha criada — copia-a e envia.'); };

// Roda a ligação: a antiga deixa de funcionar e nasce outra. Quem já pediu
// continua à espera da resposta.
// Devolve: nada — pede confirmação; depois mostra a ligação nova e sincroniza.
CW.ligacaoRodar = function () {
  confirmModal('Rodar a ligação', 'A ligação antiga deixa de funcionar e nasce uma nova. Quem já pediu continua à espera da tua resposta.', function () {
    ligacaoNova('Ligação nova — a antiga já não funciona.');
  });
};

// Desativa a ligação (DELETE /api/share-link) depois de confirmar.
// Devolve: nada — chama a API, esquece o URL guardado e sincroniza.
CW.ligacaoDesativar = function () {
  confirmModal('Desativar a ligação', 'Quem a tiver deixa de conseguir pedir-te partilhas por ela. Podes criar outra quando quiseres.', function () {
    api('DELETE', '/api/share-link')
      .then(function () {
        guardarLigacao('');
        toast('Ligação de partilha desativada — quem já pediu continua à espera da tua resposta.', { ms: 6000 });
        return pullNow(true);
      })
      .then(function () { render(); })
      .catch(function (e) { toast(e.message); });
  });
};

// Copia a ligação permanente desta conta guardada neste aparelho. Se não
// houver (foi criada noutro aparelho, ou antes de sair), diz como a obter —
// o servidor não a volta a mostrar.
// Devolve: nada — copia e avisa.
CW.ligacaoCopiar = function () {
  var url = '';
  try { url = localStorage.getItem(chaveDaLigacao()) || ''; } catch (e) {}
  if (!url) return toast('A ligação só se mostra quando é criada. Roda-a para teres uma nova neste aparelho.', { ms: 6000 });
  CW.copiar(url);
};

/* ---------------- pedidos de partilha ---------------- */

// Um pedido recebido ou enviado, pelo id, para os textos.
// Recebe: id — o id do pedido.
// Devolve: o pedido ({id, fromName|toName, houseName}) ou null.
function pedidoDoEstado(id) {
  var sr = (CW.state && CW.state.shareRequests) || {};
  return (sr.incoming || []).concat(sr.outgoing || []).find(function (x) { return x.id === id; }) || null;
}

// Aceita um pedido de partilha (POST /api/share-requests/:id/accept): passo a
// comproprietário do imóvel de quem pediu.
// Recebe: id — o id do pedido.
// Devolve: nada — chama a API, avisa e sincroniza.
CW.pedidoAceitar = function (id) {
  var p = pedidoDoEstado(id);
  api('POST', '/api/share-requests/' + encodeURIComponent(id) + '/accept')
    .then(function () {
      toast('Partilha aceite: passas a comproprietário de ' + ((p && p.houseName) || 'imóvel') +
        (p && p.fromName ? ', de ' + p.fromName : '') + '.', { ms: 5000 });
      return pullNow(true);
    })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message); });
};

// Recusa um pedido de partilha (POST /api/share-requests/:id/reject).
// Recebe: id — o id do pedido.
// Devolve: nada — chama a API, avisa e sincroniza.
CW.pedidoRecusar = function (id) {
  api('POST', '/api/share-requests/' + encodeURIComponent(id) + '/reject')
    .then(function () { toast('Pedido recusado.'); return pullNow(true); })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message); });
};

// Cancela um pedido que eu enviei e ainda não foi respondido (DELETE /api/share-requests/:id).
// Recebe: id — o id do pedido.
// Devolve: nada — chama a API, avisa e sincroniza.
CW.pedidoCancelar = function (id) {
  api('DELETE', '/api/share-requests/' + encodeURIComponent(id))
    .then(function () { toast('Pedido cancelado.'); return pullNow(true); })
    .then(function () { render(); })
    .catch(function (e) { toast(e.message); });
};

/* ---------------- aterragem: aceitar um convite, pedir uma partilha ---------------- */

/* Aceita um convite (POST /api/convite/:token/aceitar) — só aqui se gasta a
   ligação. Com sucesso, sincroniza e mostra «Agora és colaborador de…» com
   «Ver os imóveis». Um erro definitivo (ligação usada, expirada, minha)
   esquece o token guardado, para não voltar a perguntar.
   Recebe: token — o token da ligação de convite (64 hex).
   Devolve: nada — o desfecho aparece num modal ou num toast. */
CW.aceitarConvite = function (token) {
  // chega-se aqui por uma ligação, não por um botão que se esconde: com o
  // serviço desligado nesta conta, diz-se e não se gasta a ligação
  if (!servicoLigado('colaboradores')) return toast(hintServicoDesligado('colaboradores'), { ms: 6000 });
  var prev = CW._convitePrev || {};
  api('POST', '/api/convite/' + encodeURIComponent(token) + '/aceitar')
    .then(function (r) {
      try { sessionStorage.removeItem('gi_convite'); } catch (e) {}
      CW._convitePrev = null;
      closeAllModals();
      return pullNow(true).then(function () { return r; });
    })
    .then(function (r) {
      var perms = permsFechadas(prev.perms || []);
      var pode = perms.map(rotuloDe).map(function (t) { return t.charAt(0).toLowerCase() + t.slice(1); });
      var saltadas = (r.saltadas || []).map(function (s) { return s.name || s; });
      openModal('Agora és colaborador de ' + (r.ownerName || prev.ownerName || ''),
        '<div class="form"><div class="hint u-fs-14px"><b>' + esc(r.roleName || prev.roleName || 'Colaborador') + '</b> em ' +
        esc(nomesDeCasas(r.houses || prev.houses || [])) + '.</div>' +
        (pode.length ? '<div class="hint">Podes: ' + esc(pode.join(', ')) + '.</div>' : '') +
        (saltadas.length ? '<div class="hint">Já eras comproprietário de ' + esc(saltadas.join(', ')) + ' — aí fica tudo como estava.</div>' : '') +
        '<div class="hint">Os cartões desses imóveis levam o selo «de ' + esc(r.ownerName || prev.ownerName || '') + ' · ' + esc(r.roleName || prev.roleName || '') +
        '». Podes sair quando quiseres em Pessoas → Colaboradores.</div></div>',
        '<button class="btn primary" data-toca="ecra" data-click="closeAllModals();go(\'properties\')">Ver os imóveis</button>');
    })
    .catch(function (e) {
      if (e && (e.status === 404 || e.status === 400 || e.status === 410)) {
        // definitivo (usada, expirada, minha): esquece-se o token e fecha-se
        // o modal «Convite de …» — com ele aberto, cada toque em «Aceitar»
        // repetia o pedido e o toast
        try { sessionStorage.removeItem('gi_convite'); } catch (x) {}
        CW._convitePrev = null;
        closeAllModals();
      }
      toast(e.message || 'Não deu para aceitar o convite.', { ms: 6000 });
    });
};

/* Pede a quem tem a ligação de partilha que passe a comproprietário dos meus
   imóveis escolhidos (POST /api/ligar/:token/pedir {houseIds}). Fica
   pendente até ele aceitar cada pedido.
   Recebe: token — o token da ligação (64 hex); houseIds — os ids dos meus imóveis.
   Devolve: nada — avisa por toast e sincroniza. */
CW.pedirPartilha = function (token, houseIds) {
  if (!servicoLigado('colaboradores')) return toast(hintServicoDesligado('colaboradores'), { ms: 6000 });
  var dono = (CW._ligarPrev && CW._ligarPrev.ownerName) || 'o dono da ligação';
  if (!houseIds || !houseIds.length) return toast('Marca pelo menos um imóvel.');
  api('POST', '/api/ligar/' + encodeURIComponent(token) + '/pedir', { houseIds: houseIds })
    .then(function (r) {
      try { sessionStorage.removeItem('gi_ligar'); } catch (e) {}
      CW._ligarPrev = null;
      closeAllModals();
      if (!r.pedidos && (r.saltadas || []).length) toast(dono + ' já é comproprietário desses imóveis.', { ms: 5000 });
      else toast('Pedido enviado — ' + dono + ' tem de aceitar.', { ms: 5000 });
      return pullNow(true);
    })
    .then(function () { render(); })
    .catch(function (e) {
      if (e && (e.status === 404 || e.status === 400)) {
        try { sessionStorage.removeItem('gi_ligar'); } catch (x) {}
      }
      toast(e.message || 'Não deu para enviar o pedido.', { ms: 6000 });
    });
};

/* ---------------- o sino: pedidos de partilha recebidos ---------------- */

// Os pedidos de partilha recebidos: «<Nome> quer partilhar <imóvel> contigo».
// O sino conta-os e mostra-os por conta própria (web/app/notificacoes.js:
// notifPedidos, que carrega sempre antes); o embrulho que aqui os juntava ao
// sino, para quando ele ainda não sabia dos pedidos, saiu.
// Devolve: array de {id, fromName, houseName} (vazio sem estado, ou com o
// serviço Colaboradores desligado nesta conta — não se conta o que não há).
function pedidosRecebidos() {
  if (!servicoLigado('colaboradores')) return [];
  var sr = (CW.state && CW.state.shareRequests) || {};
  return sr.incoming || [];
}

/* ---------------- o que o cargo deixa fazer ---------------- */

/* «Imóveis onde colaboras» (partilha.js:colaboroCard) diz o dono e o nome do
   cargo, e o nome não diz o que o cargo abre. Aqui acrescenta-se a cada linha
   a frase de acessos.js:fraseCurtaPodes. As linhas vêm pela ordem de
   db.properties com _cargo, cada uma a abrir com o seu cartão, e o bloco do
   texto fecha no primeiro «</span></span>» dela; uma linha com outra forma
   fica como estava.
   Devolve: o HTML do cartão (texto), ou '' sem imóveis de colaboração. */
var _colaboroCard_podes = colaboroCard;
colaboroCard = function () {
  var html = _colaboroCard_podes();
  if (!html) return html;
  var casas = (db.properties || []).filter(function (p) { return p._cargo; });
  var linha = '<div class="card u-p-11px-13px';
  var partes = html.split(linha);
  for (var i = 1; i < partes.length && i <= casas.length; i++) {
    var frase = fraseCurtaPodes(casas[i - 1].id);
    if (frase) partes[i] = partes[i].replace('</span></span>', '</span><span class="small u-d-block u-mt-3px">' + esc(frase) + '</span></span>');
  }
  return partes.join(linha);
};

/* ---------------- a página dos Colaboradores ---------------- */

/* O selo do tempo que um convite ainda vale, em dias de calendário (no fuso
   deste aparelho, como a data «expira a dd/mm/aaaa» ao lado): «Expira hoje»
   no dia em que acaba, «Expira amanhã» na véspera — os dois a vermelho — e
   «N dias» a âmbar. Contava fatias de 24 h a partir de agora: um convite que
   acabava hoje às 23:59 dizia «Expira amanhã», e «Expira hoje» nunca
   aparecia. Um convite que já passou diz «Expirou». O Math.round acerta os
   dias de 23 e de 25 horas da mudança da hora.
   Recebe: ms — o fim do convite (instante); agora (opcional) — o instante de
   referência (por omissão, Date.now()).
   Devolve: o HTML do selo (texto), ou '' sem data. */
function seloDoConvite(ms, agora) {
  var n = Number(ms);
  if (!(n > 0)) return '';
  var ja = agora == null ? Date.now() : Number(agora);
  if (n <= ja) return '<span class="badge red">Expirou</span>';
  var inicio = function (t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  var dias = Math.round((inicio(n) - inicio(ja)) / 86400000);
  if (dias <= 1) return '<span class="badge red">' + (dias <= 0 ? 'Expira hoje' : 'Expira amanhã') + '</span>';
  return '<span class="badge amber">' + dias + ' dias</span>';
}

/* O cartão «Quem colabora» (o canvas, D-Colaboradores): uma linha por
   colaborador — as iniciais, o nome, os imóveis onde colabora, o cargo num
   selo, «Mudar» e «Remover». Só quem criou o imóvel gere colaboradores: nos
   imóveis que outros partilharam comigo fica a nota. Sem imóvel nenhum (nem
   meu nem partilhado comigo) não há cartão: o vazio dele mandava convidar, e
   sem imóveis não há convite que se possa criar.
   Recebe: nada.
   Devolve: o HTML do cartão (texto), ou '' sem imóveis. */
function quemColaboraCard() {
  if (!servicoLigado('colaboradores')) return '';
  var partilhados = (db.properties || []).filter(function (p) { return p._sharedFrom && !p._cargo; });
  if (!imoveisMeus().length && !partilhados.length) return '';
  var cs = (CW.state && CW.state.collaborators) || [];
  var linhas = cs.map(function (c) {
    var nome = c.name || c.userId || '';
    return '<div class="colab-linha">' +
      '<span class="avatar">' + esc(initials(nome)) + '</span>' +
      '<span class="colab-txt"><b class="u-d-block">' + esc(nome) + '</b><span class="small">' + esc(nomesDeCasas(c.houses || [])) + '</span></span>' +
      '<span class="badge">' + esc(c.roleName || 'Colaborador') + '</span>' +
      '<span class="colab-acoes"><button type="button" class="btn sm" data-toca="camada" data-click="CW.mudarColaborador(\'' + jsq(c.id) + '\')">Mudar</button>' +
      '<button type="button" class="btn sm ghost" data-toca="dados" data-risco="destroi" data-click="CW.removerColaborador(\'' + jsq(c.id) + '\')">Remover</button></span></div>';
  }).join('');
  return '<section class="card colab-cartao"><div class="def-bloco-cab"><h3>Quem colabora</h3></div>' +
    (linhas || '<p class="small colab-vazio">Ainda ninguém colabora contigo. Convida alguém com uma ligação de uso único.</p>') +
    (partilhados.length ? '<p class="small colab-nota">Nos imóveis que outros partilharam contigo, só quem criou o imóvel gere colaboradores.</p>' : '') +
    '</section>';
}

/* O cartão «Convites por usar»: cada ligação ainda por abrir, com o cargo, a
   nota que lhe deste, os imóveis, quando expira e quantos dias faltam, e
   «Revogar». Sem convites, nada.
   Recebe: nada.
   Devolve: o HTML do cartão (texto), ou ''. */
function convitesCard() {
  var inv = (CW.state && CW.state.invites) || [];
  if (!inv.length) return '';
  return '<section class="card colab-cartao"><div class="def-bloco-cab"><h3>Convites por usar</h3><span class="small">cada ligação serve uma vez e vale 7 dias</span></div>' +
    inv.map(function (i) {
      var data = dataDoInstante(i.expiresAt);
      return '<div class="colab-linha colab-convite">' +
        '<span class="colab-txt"><b class="u-d-block">' + esc(i.roleName || 'Cargo') + (i.label ? ' · «' + esc(i.label) + '»' : '') + '</b>' +
        '<span class="small">' + esc(nomesDeCasas(i.houses || [])) + (data ? ' · expira a ' + data : '') + '</span></span>' +
        seloDoConvite(i.expiresAt) +
        '<span class="colab-acoes"><button type="button" class="btn sm" data-toca="dados" data-click="CW.revogarConvite(\'' + jsq(i.id) + '\')">Revogar</button></span></div>';
    }).join('') + '</section>';
}

/* Os cargos abertos no cartão «Cargos», por id: a tabela das permissões de
   cada um abre e fecha no sítio (CW.cargoPermissoes). O primeiro abre sozinho. */
var _cargosAbertos = {};

/* A tabela das permissões de um cargo (o canvas, D-Colaboradores): uma linha
   por coisa (ENTIDADES), com «Ver» e «Adicionar» — o visto verde quando o
   cargo a tem (com as implicações), o traço quando não, e vazio onde não se
   aplica (as hipotecas e a avaliação só se veem; a ficha do imóvel só se
   edita). Cada célula diz ao leitor de ecrã o que é.
   Recebe: r — o cargo ({id, name, perms}); i — a posição na lista (para o
   id); aberta — false para nascer escondida.
   Devolve: o HTML (texto). */
function tabelaDePermissoes(r, i, aberta) {
  var tem = permsFechadas(r.perms);
  var celula = function (perm, rot) {
    if (!perm) return '<span role="cell" class="colab-na" aria-label="' + rot + ': não se aplica"></span>';
    return tem.indexOf(perm) > -1
      ? '<span role="cell" class="colab-sim" aria-label="' + rot + ': sim">' + ic('check', 18) + '</span>'
      : '<span role="cell" class="colab-nao" aria-label="' + rot + ': não"><span class="colab-traco"></span></span>';
  };
  return '<div class="colab-perms" id="cgperm_' + i + '" role="table" aria-label="Permissões do cargo ' + esc(r.name) + '"' + (aberta === false ? ' hidden' : '') + '>' +
    '<div class="colab-perm colab-perm-tit" role="row"><span role="columnheader">O quê</span><span role="columnheader">Ver</span><span role="columnheader">Adicionar</span></div>' +
    ENTIDADES.map(function (e) {
      return '<div class="colab-perm" role="row"><span role="cell">' + esc(e.nome) + '</span>' +
        celula(e.ver, 'Ver') + celula(e.add, e.addRotulo || 'Adicionar') + '</div>';
    }).join('') + '</div>';
}

/* Abre ou fecha a tabela das permissões de um cargo, no sítio — nada a
   gravar, nada a repintar — e lembra-se, para a próxima pintura.
   Recebe: botao — o botão (o this da ação), com data-id do cargo.
   Devolve: nada — mexe no DOM. */
CW.cargoPermissoes = function (botao) {
  var id = botao.dataset.id, on = botao.getAttribute('aria-expanded') !== 'true';
  _cargosAbertos[id] = on;
  botao.setAttribute('aria-expanded', String(on));
  var t = document.getElementById(botao.getAttribute('aria-controls'));
  if (t) t.hidden = !on;
};

/* O cartão «Cargos»: cada cargo com quantas pessoas o têm (e quantos convites
   por usar o levam), «Editar», o resumo do que abre e a tabela das
   permissões, que abre e fecha (a do primeiro aberta); «Novo cargo» em cima.
   Com dois cargos ou mais, os outros vão num bloco à parte
   (.colab-cargos-resto): num cartão largo (o canvas, D-Colaboradores) o
   primeiro fica à esquerda e os outros à direita, com a divisória ao meio
   (estilos.css:.colab-cargos-dois); estreito, ficam uns por baixo dos
   outros. Sem cargos, a dica de por onde começar. O apagar vive na janela do
   cargo.
   Recebe: nada.
   Devolve: o HTML do cartão (texto). */
function cargosTabelaCard() {
  if (!servicoLigado('colaboradores')) return '';
  var roles = cargosDoDono(), inv = (CW.state && CW.state.invites) || [];
  var cada = roles.map(function (r, i) {
    var n = Number(r.n) || 0;
    var conv = inv.filter(function (x) { return x.roleId ? x.roleId === r.id : x.roleName === r.name; }).length;
    var aberto = _cargosAbertos[r.id] === undefined ? i === 0 : !!_cargosAbertos[r.id];
    return '<div class="colab-cargo">' +
      '<div class="colab-cargo-cab"><span class="colab-txt"><b class="u-d-block">' + esc(r.name) + '</b>' +
      '<span class="small">' + n + (n === 1 ? ' pessoa' : ' pessoas') + (conv ? ' · ' + conv + (conv === 1 ? ' convite' : ' convites') : '') + '</span></span>' +
      '<button type="button" class="btn sm" data-toca="camada" data-click="CW.cargoModal(\'' + jsq(r.id) + '\')">Editar</button></div>' +
      '<p class="small">' + esc(resumoPerms(r.perms)) + '</p>' +
      '<button type="button" class="colab-abre" data-id="' + esc(r.id) + '" aria-expanded="' + aberto + '" aria-controls="cgperm_' + i + '" data-toca="nada" data-click="CW.cargoPermissoes(this)">' + ic('chevR', 16) + ' Permissões</button>' +
      tabelaDePermissoes(r, i, aberto) + '</div>';
  });
  var corpo = !cada.length
    ? '<p class="small">Cria um cargo para dizeres o que um colaborador pode ver e adicionar — ou começa por um dos três prontos: Gestor de visitas, Contabilista, Ver tudo.</p>'
    : cada.length === 1 ? cada[0]
      : '<div class="colab-cargos-dois">' + cada[0] + '<div class="colab-cargos-resto">' + cada.slice(1).join('') + '</div></div>';
  return '<section class="card colab-cartao colab-cargos-cartao"><div class="def-bloco-cab"><h3>Cargos</h3>' +
    '<button type="button" class="btn sm" data-toca="camada" data-click="CW.cargoModal()">' + ic('plus', 16) + ' Novo cargo</button></div>' + corpo + '</section>';
}

/* Os imóveis onde sou eu o colaborador, como a app de um colaborador os
   mostra (o canvas, M-Colaborador): um cartão por pessoa e cargo — «Colaboras
   com <dono>», o cargo num selo, o que o cargo deixa fazer e em que imóveis
   (acessos.js:fraseCurtaPodes) e, quando o cargo não vê as finanças, que
   elas ficam com o dono — e «Deixar de colaborar», por linha de colaboração
   (CW.sairDeImovel, que confirma). Vazio quando não colaboro em nenhum.
   Recebe: nada.
   Devolve: o HTML (texto), ou ''. */
function colaboroCartao() {
  if (!servicoLigado('colaboradores')) return '';
  var casas = (db.properties || []).filter(function (p) { return p._cargo; });
  if (!casas.length) return '';
  var grupos = [], porChave = {};
  casas.forEach(function (p) {
    var k = (p._sharedFrom || '') + '|' + p._cargo + '|' + (p._collabId || '');
    if (!porChave[k]) { porChave[k] = { dono: p._sharedFrom || '', cargo: p._cargo, collabId: p._collabId || '', casas: [] }; grupos.push(porChave[k]); }
    porChave[k].casas.push(p);
  });
  return '<h2 class="def-sec-tit">Onde colaboras</h2>' + grupos.map(function (g) {
    var nomes = listaE(g.casas.map(function (p) { return '<b>' + esc(p.name || 'Sem nome') + '</b>'; }));
    var frase = fraseCurtaPodes(g.casas[0].id);
    var texto = !frase ? 'Em ' + nomes + '.' : /^Só podes consultar$/.test(frase) ? 'Só podes consultar ' + nomes + '.' : esc(frase) + ' em ' + nomes + '.';
    var semFinancas = !g.casas.some(function (p) { return pode(p.id, 'tx.view'); });
    return '<section class="card colab-com">' +
      '<div class="colab-com-cab"><span class="avatar colab-com-av">' + esc(initials(g.dono || '?')) + '</span>' +
      '<span class="colab-txt"><span class="small">Colaboras com</span><b class="u-d-block">' + esc(g.dono || 'outra pessoa') + '</b></span>' +
      '<span class="badge">' + esc(g.cargo) + '</span></div>' +
      '<p>' + texto + '</p>' +
      (semFinancas ? '<p class="colab-aviso">' + ic('info', 18) + '<span>As finanças destes imóveis ficam com o dono.</span></p>' : '') +
      (g.collabId ? '<div class="def-botoes"><button type="button" class="btn sm ghost" data-toca="dados" data-risco="destroi" data-click="CW.sairDeImovel(\'' + jsq(g.collabId) + '\')">Deixar de colaborar</button></div>' : '') +
      '</section>';
  }).join('') +
  '<p class="hint def-nota">Não tens quota-parte nestes imóveis nem entras nas contas entre proprietários. Ao sair, o que registaste fica com o dono.</p>';
}

/* A página dos Colaboradores (o separador colaboradores, o terceiro das
   Pessoas — o canvas, D-Colaboradores): o que é um colaborador e
   «Convidar colaborador» (CW.conviteModal); depois «Quem colabora», os
   «Convites por usar», os «Cargos» com a tabela das permissões, e os
   imóveis onde sou eu o colaborador (para quem só colabora, estes vêm
   primeiro). Sem cargos, sem convites e sem colaboradores, o vazio convida a
   criar o primeiro cargo — é ele que diz o que a pessoa pode fazer. «Ainda
   não falámos com o servidor» não é «não tens nada»: antes do primeiro estado
   fica a espera, e só os imóveis onde colaboro (que vêm do aparelho). Com o
   serviço desligado, o ecrã que diz o nome e quem o liga.
   Recebe: nada.
   Devolve: o HTML (texto) da página; os separadores da área por cima põe-nos o render (navegacao.js:abasDaArea). */
function paginaDosColaboradores() {
  if (!servicoLigado('colaboradores')) return servicoDesligadoHtml('colaboradores');
  if (!CW.user) {
    return '<div class="empty"><b>Sem sessão iniciada</b>Convidar quem ajuda a gerir precisa de conta: é ela que guarda os cargos e os convites.' +
      '<div><button type="button" class="btn primary" data-toca="camada" data-click="CW.showAuth()">Iniciar sessão</button></div></div>';
  }
  var intro = '<p class="def-intro">Quem te ajuda a gerir, sem ser dono: vê e faz só o que o cargo deixa, nos imóveis que escolheres — sem quota-parte e sem entrar nas contas entre proprietários.</p>';
  var colab = colaboroCartao();
  if (!CW._pulled) {
    return intro + '<div class="espera" role="status"><span class="roda" aria-hidden="true"></span><p class="u-m-0"><b>À espera do servidor.</b> ' +
      'Os cargos, os convites e quem colabora chegam quando a app sincronizar.</p></div>' + colab;
  }
  var roles = cargosDoDono();
  var temGente = (((CW.state && CW.state.collaborators) || []).length + ((CW.state && CW.state.invites) || []).length) > 0;
  if (!roles.length && !temGente) {
    var vazio = '<div class="empty"><b>Ainda não tens colaboradores</b>Começa pelo cargo: é ele que diz o que a pessoa vê e o que pode adicionar. Depois convida-a com uma ligação de uso único.' +
      '<div><button type="button" class="btn primary" data-toca="camada" data-click="CW.cargoModal()">' + ic('plus', 18) + ' Novo cargo</button></div></div>';
    return intro + (souSoColaborador() ? colab + vazio : vazio + colab);
  }
  var cab = '<div class="def-cab">' + intro + '<span class="def-cab-acoes"><button type="button" class="btn primary" data-toca="camada" data-click="CW.conviteModal()">' +
    ic('pessoaMais', 18) + ' Convidar colaborador</button></span></div>';
  var corpo = quemColaboraCard() + convitesCard() + cargosTabelaCard();
  return cab + (souSoColaborador() ? colab + corpo : corpo + colab);
}

/* ---------------- convidar (o canvas: M-Convidar e M-ConviteCriado) ---------------- */

/* Escolhe o cargo na janela do convite: a opção tocada fica marcada (as outras
   não) e o id vai para o campo escondido que o CW.criarConvite lê.
   Recebe: botao — a opção (o this da ação), com data-id do cargo.
   Devolve: nada — mexe no formulário aberto. */
CW.conviteCargo = function (botao) {
  var id = botao.dataset.id || '';
  var campo = document.getElementById('cw_inv_cargo');
  if (campo) campo.value = id;
  [].slice.call(document.querySelectorAll('.colab-cargo-op')).forEach(function (b) {
    var on = b.dataset.id === id;
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('on', on);
  });
};

/* «Escolher pelo grupo»: marca, no convite, os imóveis de um grupo. É só um
   atalho: a lista guardada é a dos imóveis marcados agora — os que se
   juntarem ao grupo depois não entram (a nota di-lo).
   Recebe: gid — o id do grupo.
   Devolve: nada — marca as caixas. */
CW.conviteGrupo = function (gid) {
  var g = (db.groups || []).find(function (x) { return x.id === gid; });
  if (!g) return;
  (g.ids || []).forEach(function (pid) {
    var e = document.getElementById('cw_inv_h_' + pid);
    if (e) e.checked = true;
  });
};

/* O corpo da janela «Convidar colaborador»: o cargo (um por opção, com o
   resumo do que abre, e «Criar outro cargo»), os imóveis meus numa lista de
   caixas num cartão (caixaDeCasa), com os grupos de imóveis em chips para os
   marcar de uma vez, a nota para mim
   e o que a ligação é. O que já estava escolhido (form) volta — a janela
   repinta-se quando se cria um cargo por cima dela.
   Recebe: form — {roleId, casas (ids marcados), label}.
   Devolve: o HTML (texto). */
function corpoDoConvite(form) {
  var roles = cargosDoDono(), meus = imoveisMeus();
  var roleId = roles.some(function (r) { return r.id === form.roleId; }) ? form.roleId : (roles[0] ? roles[0].id : '');
  var grupos = (db.groups || []).filter(function (g) { return g.kind === 'prop' && (g.ids || []).some(function (pid) { return meus.some(function (p) { return p.id === pid; }); }); });
  return '<div class="form colab-convidar">' +
    '<p class="hint u-fs-14px">Quem ajuda a gerir sem ser dono. Vê e faz só o que o cargo deixa, nos imóveis que escolheres.</p>' +
    '<div class="colab-cargos" role="radiogroup" aria-labelledby="cw_inv_cl"><p class="flabel" id="cw_inv_cl">Cargo <span class="req">*</span></p>' +
    '<input type="hidden" id="cw_inv_cargo" value="' + esc(roleId) + '">' +
    roles.map(function (r) {
      var on = r.id === roleId;
      return '<button type="button" role="radio" aria-checked="' + on + '" class="colab-cargo-op' + (on ? ' on' : '') + '" data-id="' + esc(r.id) + '" data-toca="rascunho" data-click="CW.conviteCargo(this)">' +
        '<span class="colab-radio" aria-hidden="true"></span><span class="colab-txt"><b class="u-d-block">' + esc(r.name) + '</b><span class="small">' + esc(resumoPerms(r.perms)) + '</span></span></button>';
    }).join('') +
    '<button type="button" class="btn ghost sm" data-toca="camada" data-click="CW.cargoModal()">' + ic('plus', 16) + ' Criar outro cargo</button></div>' +
    '<div><p class="flabel">Imóveis <span class="req">*</span></p>' +
    (grupos.length ? '<div class="colab-grupos"><span class="small">Escolher pelo grupo:</span>' + grupos.map(function (g) {
      return '<button type="button" class="chip" data-toca="rascunho" data-click="CW.conviteGrupo(\'' + jsq(g.id) + '\')">' + esc(g.name) + '</button>';
    }).join('') + '</div>' : '') +
    '<div class="colab-casas">' + meus.map(function (p) { return caixaDeCasa(p, 'cw_inv_h_', (form.casas || []).indexOf(p.id) > -1); }).join('') + '</div>' +
    (grupos.length ? '<p class="hint u-mt-6px">A lista fica fixa: imóveis que juntes depois ao grupo não entram sozinhos.</p>' : '') + '</div>' +
    '<label>Nota para ti (opcional)<input id="cw_inv_label" maxlength="60" value="' + esc(form.label || '') + '" placeholder="Ex: Para a Ana, contabilidade" autocomplete="off"></label>' +
    '<p class="hint">Vale 7 dias e uma só utilização. Quem a abrir entra (ou cria conta) e fica com o cargo nesses imóveis — sem quota-parte.</p></div>';
}

/* «Convidar colaborador»: a janela do convite (corpoDoConvite), com «Criar
   ligação de convite» no rodapé (CW.criarConvite). Sem cargos, diz que o
   primeiro passo é o cargo e leva lá; sem imóveis meus, que não há para onde
   convidar — e, com os Imóveis ligados, leva a criar o primeiro.
   Recebe: nada.
   Devolve: nada — abre a janela. */
CW.conviteModal = function () {
  if (!cargosDoDono().length) {
    openModal('Convidar colaborador', '<div class="form"><p class="hint u-fs-14px">Primeiro, um cargo: é ele que diz o que a pessoa vê e o que pode adicionar. Depois voltas aqui e convidas.</p></div>',
      '<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="camada" data-click="closeModal();CW.cargoModal()">' + ic('plus', 16) + ' Novo cargo</button>');
    return;
  }
  if (!imoveisMeus().length) {
    var ligado = servicoLigado('properties');
    openModal('Convidar colaborador', '<div class="form"><p class="hint u-fs-14px">Ainda não tens imóveis teus para partilhar — um colaborador entra nos imóveis que criaste. Cria um primeiro.</p>' +
      (ligado ? '' : vazioServicoDesligado('properties')) + '</div>',
      '<button class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>' +
      (ligado ? '<button class="btn primary" data-toca="camada" data-click="closeModal();propModal()">Adicionar imóvel</button>' : ''));
    return;
  }
  var L = openModal('Convidar colaborador', corpoDoConvite({}),
    '<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>' +
    '<button class="btn primary" data-toca="dados" data-click="CW.criarConvite()">Criar ligação de convite</button>');
  CW._conviteJanela = L || null;
};

/* Repinta a janela do convite, se está aberta, guardando o que já estava
   escolhido — chamado depois de se gravar um cargo por cima dela, para o
   cargo aparecer como ficou (e um cargo acabado de criar ficar escolhido).
   Recebe: escolher (opcional) — o id do cargo a deixar escolhido.
   Devolve: nada — mexe no DOM da janela. */
function repintarConvite(escolher) {
  var L = CW._conviteJanela;
  if (!L || typeof modalStack === 'undefined' || modalStack.indexOf(L) < 0 || !L.el) return;
  var b = L.el.querySelector('.body');
  if (!b) return;
  var form = { roleId: escolher || val('cw_inv_cargo'), casas: casasMarcadas(), label: val('cw_inv_label') };
  b.innerHTML = corpoDoConvite(form);
}

/* O corpo da janela «Convite pronto» (o canvas, M-ConviteCriado): o cargo e
   os imóveis, a ligação (só de leitura, toca-se para a selecionar), «Copiar»
   e «Partilhar» (só quando o aparelho sabe partilhar), quando expira, e o
   aviso de que a ligação só se vê agora — o servidor guarda só o resumo dela.
   Recebe: url — a ligação; cargo — o nome do cargo; casas — os ids dos
   imóveis; expira — o fim (instante).
   Devolve: o HTML (texto). */
function corpoDoConvitePronto(url, cargo, casas, expira) {
  var nomes = listaE((casas || []).map(function (id) { return nomesDeCasas([id]); }));
  var data = dataDoInstante(expira);
  return '<div class="colab-pronto">' +
    '<span class="colab-pronto-ic" aria-hidden="true">' + ic('check', 30) + '</span>' +
    '<p class="small colab-pronto-sub">' + esc(cargo) + (nomes ? ' · ' + esc(nomes) : '') + '</p>' +
    '<div class="colab-pronto-lig"><p class="lbl">Ligação de convite</p>' +
    '<input id="cw_lig_url" class="colab-url" readonly value="' + esc(url) + '" aria-label="Ligação de convite" data-toca="nada" data-click="selecionarCampo(this)">' +
    '<div class="def-botoes"><button type="button" class="btn primary" data-toca="nada" data-click="CW.copiar(\'' + jsq(url) + '\')">Copiar ligação</button>' +
    (navigator.share ? '<button type="button" class="btn" data-toca="nada" data-click="CW.partilharLigacao(\'' + jsq(url) + '\')">Partilhar…</button>' : '') + '</div>' +
    '<p class="small">Serve uma vez' + (data ? ' · expira a ' + data : '') + '</p></div>' +
    '<p class="colab-aviso">' + ic('aviso', 18) + '<span>Esta ligação só se vê agora. Se a perderes, revoga o convite e cria outro.</span></p></div>';
}
/* Quantas pessoas colaboram nos meus imóveis, para o terceiro segmento das
   Pessoas (navegacao.js:contagemDePessoas): cada pessoa uma vez, mesmo que
   tenha dois cargos em imóveis diferentes — o servidor dá uma linha por
   cargo. Os colaboradores vivem no servidor: sem sessão, sem o separador à
   vista (haColaboradores), ou antes do primeiro estado, não se sabe, e não
   se inventa um zero. Os convites por usar não contam:
   ainda não são ninguém. A porta saiu das Definições a 2026-10-20 (a linha
   «Colaboradores e cargos»): os Colaboradores são das Pessoas.
   Recebe: nada.
   Devolve: o número de pessoas, ou null quando ainda não se sabe. */
function contarColaboradores() {
  if (!CW.user || !CW._pulled || !haColaboradores()) return null;
  var vistos = {}, pessoas = 0;
  ((CW.state && CW.state.collaborators) || []).forEach(function (c) { var k = c.userId || c.id; if (!vistos[k]) { vistos[k] = 1; pessoas++; } });
  return pessoas;
}
/* O subtítulo do ecrã dos Colaboradores, no cabeçalho do computador
   (navegacao.js:subtituloDoEcra): quantas pessoas colaboram e quantos
   convites esperam — o que era o resumo da linha das Definições, que saiu.
   Antes do primeiro estado não se contam pessoas: diz-se o que é.
   Recebe: nada.
   Devolve: o resumo (texto). */
function resumoDosColaboradores() {
  var st = CW.state || {};
  if (!CW._pulled) return 'Quem ajuda a gerir, e com que cargo';
  var pessoas = contarColaboradores() || 0;
  var conv = (st.invites || []).length, onde = (db.properties || []).filter(function (p) { return p._cargo; }).length;
  var partes = [];
  if (pessoas) partes.push(pessoas + (pessoas === 1 ? ' pessoa' : ' pessoas'));
  if (conv) partes.push(conv + (conv === 1 ? ' convite por usar' : ' convites por usar'));
  if (!partes.length && onde) partes.push('Colaboras em ' + onde + (onde === 1 ? ' imóvel' : ' imóveis'));
  return partes.length ? partes.join(' · ') : 'Quem ajuda a gerir, e com que cargo';
}
/* O separador dos Colaboradores está à vista: com sessão e com o serviço
   ligado (acessos.js:separadoresEscondidos). Sem ele não há o que contar.
   Recebe: nada.
   Devolve: true se o separador aparece. */
function haColaboradores() {
  return !(typeof separadoresEscondidos === 'function' && separadoresEscondidos().indexOf('colaboradores') > -1);
}
