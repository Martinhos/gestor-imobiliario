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
   ele qual for, por isso nenhuma ação precisa de saber para onde voltar. Os
   cartões e a vista (vColaboradores) estão em partilha.js. */
'use strict';

var LS_LIGACAO = 'gi_ligacao_url';   // o URL da ligação permanente: só se mostra na criação

/* ---------------- as permissões na interface ---------------- */

/* As linhas do modal do cargo: uma por entidade, com o interruptor «Ver» e,
   quando existe, o «Adicionar» (hipotecas e avaliação só se veem; a ficha do
   imóvel só se edita). A ordem é a do contrato; os rótulos e as dicas vêm de
   ROTULOS (web/app/acessos.js) quando ele existe — estes são os de recurso. */
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
var ROTULOS_LOCAL = {
  'tx.view': 'Ver movimentos', 'tx.add': 'Adicionar movimentos',
  'rec.view': 'Ver planeados', 'rec.add': 'Adicionar e confirmar planeados',
  'visit.view': 'Ver visitas', 'visit.add': 'Marcar visitas',
  'contract.view': 'Ver contratos', 'contract.add': 'Adicionar contratos',
  'tenant.view': 'Ver fichas de inquilinos', 'tenant.add': 'Adicionar inquilinos',
  'loan.view': 'Ver hipotecas',
  'file.view': 'Ver fotos e documentos', 'file.add': 'Adicionar fotos e documentos',
  'report.view': 'Ver valores e avaliação',
  'house.edit': 'Editar a ficha do imóvel',
};
// as implicações do contrato, iguais às do servidor (X.add ⇒ X.view vale
// sempre e não precisa de estar aqui) — a cópia de recurso quando IMPLICA
// (acessos.js) ainda não carregou ou tem outra forma
var IMPLICA_LOCAL = { 'house.edit': ['loan.view', 'file.view'], 'contract.add': ['rec.add'] };
// os três cargos prontos do contrato — a cópia de recurso de CARGOS_EXEMPLO
var CARGOS_LOCAL = [
  { nome: 'Gestor de visitas', perms: ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'],
    sub: 'Marca visitas e cria fichas de quem quer arrendar.' },
  { nome: 'Contabilista', perms: ['tx.view', 'tx.add', 'rec.view', 'rec.add', 'contract.view', 'loan.view', 'file.view', 'file.add', 'report.view'],
    sub: 'Regista movimentos e vê contratos, hipotecas e avaliação. Não mexe nas fichas.' },
  { nome: 'Ver tudo', perms: ['tx.view', 'rec.view', 'visit.view', 'contract.view', 'tenant.view', 'loan.view', 'file.view', 'report.view'],
    sub: 'Vê tudo sobre o imóvel, sem alterar nada.' },
];

// O rótulo de uma permissão para a interface: o de ROTULOS quando existe, senão o local.
// Recebe: perm — a chave da permissão (ex.: 'tx.add').
// Devolve: o rótulo (texto); a própria chave se ninguém a conhecer.
function rotuloDe(perm) {
  try {
    var r = typeof ROTULOS !== 'undefined' && ROTULOS && ROTULOS[perm];
    if (r && typeof r === 'string') return r;
    if (r && r.rotulo) return r.rotulo;
  } catch (e) {}
  return ROTULOS_LOCAL[perm] || perm;
}

// As permissões que uma permissão arrasta consigo (só o passo direto: quem
// quer o fecho chama permsFechadas).
// Recebe: perm — a chave da permissão.
// Devolve: array de chaves implicadas (vazio quando não implica nenhuma).
function implicadas(perm) {
  var out = [];
  var m = /^(\w+)\.add$/.exec(perm);
  if (m) out.push(m[1] + '.view');
  var tab = IMPLICA_LOCAL;
  try { if (typeof IMPLICA !== 'undefined' && IMPLICA && Array.isArray(IMPLICA[perm])) tab = IMPLICA; } catch (e) {}
  (tab[perm] || []).forEach(function (p) { if (out.indexOf(p) < 0) out.push(p); });
  return out;
}

// O fecho de uma lista de permissões: junta tudo o que as implicações trazem
// (contract.add ⇒ rec.add ⇒ rec.view), sem repetidos.
// Recebe: perms — array de chaves (aguenta null e objetos {chave: true}).
// Devolve: array de chaves, já fechado.
function permsFechadas(perms) {
  var lista = Array.isArray(perms) ? perms.slice()
    : (perms && typeof perms === 'object') ? Object.keys(perms).filter(function (k) { return perms[k]; }) : [];
  for (var i = 0; i < lista.length; i++) {
    implicadas(lista[i]).forEach(function (p) { if (lista.indexOf(p) < 0) lista.push(p); });
  }
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
// CARGOS_EXEMPLO (acessos.js) quando existem, aceitando as chaves em inglês.
// Devolve: array de {nome, perms, sub}.
function cargosExemplo() {
  var lista = null;
  try { if (typeof CARGOS_EXEMPLO !== 'undefined' && Array.isArray(CARGOS_EXEMPLO) && CARGOS_EXEMPLO.length) lista = CARGOS_EXEMPLO; } catch (e) {}
  if (!lista) return CARGOS_LOCAL;
  return lista.map(function (c) {
    return { nome: c.nome || c.name || '', perms: permsFechadas(c.perms), sub: c.sub || c.desc || c.descricao || c.hint || '' };
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

// Uma caixa de verificação de permissão, com a chave no data-perm.
// Recebe: perm — a chave; rotulo — o texto ao lado; on — se começa marcada.
// Devolve: o HTML do <label class="check">.
function caixaPerm(perm, rotulo, on) {
  return '<label class="check" style="gap:6px;font-size:13px"><input type="checkbox" data-perm="' + perm + '" id="cg_' + perm.replace('.', '_') + '"' +
    (on ? ' checked' : '') + ' data-toca="rascunho" onchange="CW.cargoImplica()"><span>' + esc(rotulo) + '</span></label>';
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
    '<div><div class="flabel">Começar por um cargo pronto</div><div class="list" style="gap:8px">' +
    cargosExemplo().map(function (c, i) {
      return '<button type="button" class="card tap" style="padding:11px 13px;text-align:left" data-toca="rascunho" onclick="CW.cargoExemplo(' + i + ')">' +
        '<div class="row-between" style="align-items:center;gap:10px"><span style="min-width:0"><b style="display:block">' + esc(c.nome) + '</b>' +
        '<span class="small">' + esc(c.sub) + '</span></span><span class="badge" style="flex:0 0 auto">Usar este</span></div></button>';
    }).join('') + '</div></div>';
  var linhas = ENTIDADES.map(function (e) {
    return '<div class="stat" style="align-items:center"><span>' + esc(e.nome) + '</span>' +
      '<span style="display:flex;gap:14px;flex:0 0 auto">' +
      (e.ver ? caixaPerm(e.ver, 'Ver', tem.indexOf(e.ver) > -1) : '') +
      (e.add ? caixaPerm(e.add, e.addRotulo || 'Adicionar', tem.indexOf(e.add) > -1) : '') + '</span></div>';
  }).join('');
  var body = '<div class="form">' + exemplos +
    '<label>Nome do cargo<input id="cg_nome" maxlength="40" value="' + esc(r ? r.name : '') + '" placeholder="Gestor, contabilista, agente…" autocomplete="off"></label>' +
    '<div><div class="flabel">O que pode fazer</div>' + linhas +
    '<div class="hint" style="margin-top:8px">«Adicionar» inclui ver, e editar ou apagar só o que o próprio criar. ' +
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
   envia PUT /api/roles/:id (cria ou atualiza; um id novo nasce aqui).
   Devolve: nada — fecha o modal, avisa e sincroniza quando o servidor aceitar. */
CW.guardarCargo = function () {
  var nome = (val('cg_nome') || '').trim();
  if (!nome) return falhaCampo('cg_nome', 'Dá um nome ao cargo.');
  var perms = [].slice.call(document.querySelectorAll('input[data-perm]'))
    .filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.perm; });
  if (!perms.length) return toast('Marca pelo menos uma permissão.');
  var id = CW._cargoId || (typeof uid === 'function' ? uid() : 'r' + Date.now());
  api('PUT', '/api/roles/' + encodeURIComponent(id), { name: nome, perms: permsFechadas(perms) })
    .then(function () { closeModal(); toast('Cargo guardado.'); return pullNow(true); })
    .then(function () { render(); })
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
   grupo…». É só um atalho: a lista guardada é a dos imóveis marcados agora —
   os que se juntarem ao grupo depois não entram.
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

// O modal que mostra uma ligação acabada de criar, com «Copiar ligação» e
// «Partilhar…» (só quando o aparelho sabe partilhar).
// Recebe: titulo — o título do modal; url — a ligação; hint — a nota por baixo.
// Devolve: nada — abre o modal.
function ligacaoModal(titulo, url, hint) {
  var podePartilhar = !!(navigator.share);
  openModal(titulo,
    '<div class="form"><input id="cw_lig_url" readonly value="' + esc(url) + '" data-toca="nada" onclick="this.select()" style="font-family:monospace;font-size:12.5px">' +
    '<div class="hint">' + hint + '</div></div>',
    '<button class="btn" data-toca="camada" onclick="closeModal()">Fechar</button>' +
    (podePartilhar ? '<button class="btn" data-toca="nada" onclick="CW.partilharLigacao(\'' + jsq(url) + '\')">Partilhar…</button>' : '') +
    '<button class="btn primary" data-toca="nada" onclick="CW.copiar(\'' + jsq(url) + '\')">Copiar ligação</button>');
}

/* Cria uma ligação de convite com o cargo e os imóveis marcados no cartão
   «Convidar colaborador» (POST /api/collab-invites) e mostra-a para copiar.
   Vale 7 dias e uma só utilização; o token só existe nesta resposta.
   Devolve: nada — abre o modal da ligação e sincroniza. */
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
      toast('Ligação de convite criada — copia-a e envia.');
      ligacaoModal('Ligação de convite', r.url || '',
        'Vale 7 dias e uma só utilização. Quem a abrir entra (ou cria conta) e fica com o cargo <b>' + esc(nomeDoCargo(roleId)) +
        '</b> em ' + esc(nomesDeCasas(houseIds)) + '.');
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

/* Modal para mudar o cargo ou os imóveis de um colaborador
   (PUT /api/collaborators/:id {roleId, houseIds}). A lista de imóveis é a
   guardada — um instantâneo — por isso o atalho do grupo não entra aqui.
   Recebe: id — o id da linha de colaboração.
   Devolve: nada — abre o modal e deixa a gravação em onSave. */
CW.mudarColaborador = function (id) {
  var c = colaboradorDoEstado(id);
  if (!c) return toast('Esse colaborador já não está na lista.');
  var cargos = cargosDoDono().map(function (r) { return { v: r.id, label: r.name }; });
  var tem = (c.houses || []).map(function (h) { return h.id; });
  var body = '<div class="form">' +
    '<div class="hint"><b>' + esc(c.name || '') + '</b> — escolhe o cargo e os imóveis onde colabora.</div>' +
    '<label>Cargo' + sel('cw_col_cargo', c.roleId, cargos) + '</label>' +
    '<div><div class="flabel">Imóveis</div><div class="list" style="gap:7px">' +
    imoveisMeus().map(function (p) {
      return '<label class="check"><input type="checkbox" id="cw_col_h_' + p.id + '"' + (tem.indexOf(p.id) > -1 ? ' checked' : '') + '>' +
        '<span style="min-width:0"><b>' + esc(p.name || 'Sem nome') + '</b>' + (p.address ? ' <span class="small">' + esc(p.address) + '</span>' : '') + '</span></label>';
    }).join('') + '</div></div></div>';
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
// na criação e na rotação — é daqui que o «Copiar ligação» o lê.
// Recebe: url — a ligação (vazio apaga a guardada).
// Devolve: nada — escreve no localStorage.
function guardarLigacao(url) {
  try { if (url) localStorage.setItem(LS_LIGACAO, url); else localStorage.removeItem(LS_LIGACAO); } catch (e) {}
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

// Copia a ligação permanente guardada neste aparelho. Se não houver (foi
// criada noutro aparelho), diz como a obter — o servidor não a volta a mostrar.
// Devolve: nada — copia e avisa.
CW.ligacaoCopiar = function () {
  var url = '';
  try { url = localStorage.getItem(LS_LIGACAO) || ''; } catch (e) {}
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
        '<div class="form"><div class="hint" style="font-size:14px"><b>' + esc(r.roleName || prev.roleName || 'Colaborador') + '</b> em ' +
        esc(nomesDeCasas(r.houses || prev.houses || [])) + '.</div>' +
        (pode.length ? '<div class="hint">Podes: ' + esc(pode.join(', ')) + '.</div>' : '') +
        (saltadas.length ? '<div class="hint">Já eras comproprietário de ' + esc(saltadas.join(', ')) + ' — aí fica tudo como estava.</div>' : '') +
        '<div class="hint">Os cartões desses imóveis levam o selo «de ' + esc(r.ownerName || prev.ownerName || '') + ' · ' + esc(r.roleName || prev.roleName || '') +
        '». Podes sair quando quiseres no menu, em Pessoas → Colaboradores.</div></div>',
        '<button class="btn primary" data-toca="ecra" onclick="closeAllModals();go(\'properties\')">Ver os imóveis</button>');
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

// Os pedidos de partilha recebidos, para o sino: «<Nome> quer partilhar <imóvel> contigo».
// Devolve: array de {id, fromName, houseName} (vazio sem estado).
function pedidosRecebidos() {
  var sr = (CW.state && CW.state.shareRequests) || {};
  return sr.incoming || [];
}

/* Os pedidos entram no sino da vista geral. O sino vive em
   web/app/notificacoes.js; se essa camada já souber dos pedidos (tem
   notifPedidos, ou fala em shareRequests), não se duplica nada — senão
   embrulha-se aqui o crachá e o modal. */
(function () {
  if (typeof notifConta !== 'function' || typeof notifModal !== 'function') return;
  if (typeof notifPedidos === 'function' || /shareRequests|notifPedidos/.test(String(notifModal) + String(notifConta))) return;
  var _notifConta = notifConta;
  notifConta = function () { return _notifConta() + pedidosRecebidos().length; };
  var _notifModal = notifModal;
  notifModal = function () {
    _notifModal();
    var lista = pedidosRecebidos();
    if (!lista.length) return;
    var top = modalTop();
    var corpo = top && top.el.querySelector('.body .list');
    if (!corpo) return;
    var vazio = corpo.querySelector('.empty');
    if (vazio) vazio.remove();
    var w = document.createElement('div');
    w.innerHTML = '<div class="navh">Pedidos de partilha</div>' + lista.map(function (p) {
      return '<div class="card cw-pedido" style="padding:10px 13px"><b style="display:block">' + esc(p.fromName || '') + ' quer partilhar ' + esc(p.houseName || 'um imóvel') + ' contigo</b>' +
        '<span class="small">Se aceitares, passas a comproprietário desse imóvel.</span>' +
        '<div class="toolbar" style="margin-top:8px"><button class="btn sm primary" data-toca="dados" onclick="closeModal();CW.pedidoAceitar(\'' + jsq(p.id) + '\')">Aceitar</button>' +
        '<button class="btn sm danger" data-toca="dados" onclick="closeModal();CW.pedidoRecusar(\'' + jsq(p.id) + '\')">Recusar</button></div></div>';
    }).join('');
    var ref = corpo.firstChild;   // no topo, pela ordem em que foram escritos
    while (w.firstChild) corpo.insertBefore(w.firstChild, ref);
  };
})();
