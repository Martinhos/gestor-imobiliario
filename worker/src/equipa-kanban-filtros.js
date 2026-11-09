/* O kanban da equipa: os filtros, a ordenação, o cabeçalho da secção e o
   formulário de criar e editar um cartão (equipa-kanban.js junta-o ao resto).
   ---------------------------------------------------------------------
   Um pedaço do mesmo guião: as mesmas regras do topo do equipa-kanban.js
   (String.raw sem crases nem cifrão com chaveta; nada de on…= nem style= no
   HTML; nomes de topo kb…, só function e var). Corre como parte de um único
   script clássico, por isso as funções daqui e as dos outros pedaços veem-se
   umas às outras. */

export const GUIAO_KB_FILTROS = String.raw`/* ------------------------------- filtros -------------------------------- */

// Os filtros vazios.
// Devolve: {q, tipo, etiqueta, responsavel, prioridade, pai}, tudo ''.
function kbSemFiltros() { return { q: '', tipo: '', etiqueta: '', responsavel: '', prioridade: '', pai: '' }; }
// Os filtros guardados na sessão do browser (um browser que não deixa guardar dá os vazios).
// Devolve: os filtros.
function kbLerFiltros() {
  var f = kbSemFiltros();
  try {
    var g = JSON.parse(sessionStorage.getItem('kb_filtros') || '{}');
    Object.keys(f).forEach(function (k) { if (g && typeof g[k] === 'string') f[k] = g[k].slice(0, 200); });
  } catch (e) { /* sem armazenamento: começa sem filtros */ }
  return f;
}
// Guarda os filtros na sessão do browser (calado quando não deixa).
// Devolve: nada.
function kbGuardarFiltros() {
  try { sessionStorage.setItem('kb_filtros', JSON.stringify(kbFiltros)); } catch (e) { /* fica só em memória */ }
}
// Quantos filtros estão ligados (a pesquisa conta como um).
// Recebe: f — os filtros.
// Devolve: o número.
function kbQuantosFiltros(f) {
  return Object.keys(kbSemFiltros()).filter(function (k) { return !!f[k]; }).length;
}
/* Um cartão passa os filtros? A pesquisa vai ao servidor (procura também na
   descrição) e chega aqui como o conjunto das chaves que achou; o resto
   filtra-se aqui, para o quadro ter sempre as colunas inteiras e o arrasto
   saber o lugar certo entre os cartões escondidos.
   Recebe: c — o cartão; f — os filtros; q — a pesquisa (null ou {chaves});
   euId — o id de quem está (para o «Os meus»).
   Devolve: true quando passa. */
function kbPassa(c, f, q, euId) {
  if (f.q && q && !q.chaves[c.chave]) return false;
  if (f.tipo && c.tipo !== f.tipo) return false;
  if (f.etiqueta && (c.etiquetas || []).indexOf(f.etiqueta) < 0) return false;
  if (f.responsavel) {
    var quem = f.responsavel === 'eu' ? euId : f.responsavel;
    if (!c.responsavel || c.responsavel.id !== quem) return false;
  }
  if (f.prioridade && String(c.prioridade) !== String(f.prioridade)) return false;
  if (f.pai && !(c.pai && c.pai.chave === f.pai)) return false;
  return true;
}
// Os cartões de uma coluna que os filtros deixam ver.
// Recebe: id — o id da coluna.
// Devolve: a lista.
function kbVisiveis(id) {
  var euId = kbEu().id;
  return kbDaColuna(id).filter(function (c) { return kbPassa(c, kbFiltros, kbQ, euId); });
}

/* Pinta a secção inteira: o cabeçalho (com «Colunas» só para o master e o
   «Novo cartão»), a barra dos filtros, o segmentado das colunas (no
   telemóvel) e o quadro com o sítio do cartão aberto.
   Devolve: nada — redesenha o #conteudo. */
function kbPintar() {
  var botoes = (kbEu().master ? '<button type="button" class="btn"' + comAcao('kbColunas') + '>' + ic('kbColunas') + 'Colunas</button>' : '') +
    '<button type="button" class="btn primary"' + comAcao('kbNovo', ['']) + '>' + ic('mais') + 'Novo cartão</button>';
  el('conteudo').innerHTML = '<div class="kb-cab">' + cabecalho('Kanban', KB_SUB, botoes) + '</div>' +
    '<div class="kb-filtros" id="kbFiltros">' + kbFiltrosHtml() + '</div>' +
    '<div class="kb-seg" id="kbSeg" role="group" aria-label="Colunas"></div>' +
    '<div class="kb-vista" id="kbVista"><div class="kb-quadro" id="kbQuadro"></div>' +
    '<div class="kb-painel-sitio" id="kbPainel"></div></div>';
  var q = el('kbQuadro');
  if (q && q.addEventListener) {
    q.addEventListener('scroll', kbAoRolar, { passive: true });
    q.addEventListener('touchstart', kbLargarAlvo, { passive: true });
  }
  kbColunaVista = 0;
  kbPintarQuadro(); kbPintarChips();
}
/* --------------------------- filtros (pintar) --------------------------- */

/* A barra dos filtros: a pesquisa, o «Filtros» que abre os chips no
   telemóvel, os chips e o resumo do que se vê.
   Devolve: o HTML. */
function kbFiltrosHtml() {
  return '<label class="procura kb-procura">' + ic('procurar') + '<input id="kbQ" type="search" placeholder="Pesquisar…" autocomplete="off" ' +
    'aria-label="Pesquisar por chave, título ou descrição" value="' + esc(kbFiltros.q) + '"' + ligarA('enter', 'kbPesquisar') + '></label>' +
    '<button type="button" class="chip kb-filtros-botao" id="kbFiltrosBotao" aria-controls="kbChips"' + comAcao('kbFiltrosAlternar') + '></button>' +
    '<div class="chips kb-chips" id="kbChips"></div><p class="sub n kb-resumo" id="kbResumo" role="status"></p>';
}
/* Pinta os chips, o botão «Filtros» e o resumo — sem tocar no campo da
   pesquisa, que pode estar a ser escrito.
   Devolve: nada. */
function kbPintarChips() {
  var f = kbFiltros, n = kbQuantosFiltros(f), chips = el('kbChips'), botao = el('kbFiltrosBotao'), resumo = el('kbResumo');
  if (!chips || !kbEstado) return;
  var escolha = function (campo, rotulo, valor) {
    return '<button type="button" class="chip' + (valor ? ' on' : '') + '" aria-haspopup="dialog"' + comAcao('kbEscolher', [campo]) + '>' +
      rotulo + (valor ? ': <b>' + esc(valor) + '</b>' : '') + ic('baixo', 'i-sm') + '</button>';
  };
  var quem = f.responsavel && f.responsavel !== 'eu' ? kbNomePessoa(f.responsavel) : '';
  chips.className = 'chips kb-chips' + (kbFiltrosAbertos ? '' : ' kb-fechado');
  chips.innerHTML = chip('Os meus', f.responsavel === 'eu', comAcao('kbOsMeus')) +
    escolha('tipo', 'Tipo', f.tipo ? KB_NOMES_TIPOS[f.tipo] || f.tipo : '') +
    escolha('etiqueta', 'Etiqueta', f.etiqueta) +
    escolha('responsavel', 'Responsável', quem) +
    escolha('prioridade', 'Prioridade', f.prioridade ? KB_PRIORIDADES[f.prioridade] || f.prioridade : '') +
    escolha('pai', 'Épico', f.pai) +
    (n ? '<button type="button" class="btn sm ghost kb-limpar"' + comAcao('kbLimparFiltros') + '>' + ic('fechar', 'i-sm') + 'Limpar filtros</button>' : '');
  if (botao) {
    botao.setAttribute('aria-expanded', kbFiltrosAbertos ? 'true' : 'false');
    botao.className = 'chip kb-filtros-botao' + (n ? ' on' : '');
    botao.innerHTML = ic('kbFiltro', 'i-sm') + 'Filtros' + (n ? ' <span class="n">' + n + '</span><span class="so-leitor"> ligados</span>' : '');
  }
  if (resumo) {
    var total = kbEstado.cartoes.length, vis = 0;
    kbEstado.colunas.forEach(function (c) { vis += kbVisiveis(c.id).length; });
    resumo.textContent = n ? (vis ? vis + ' de ' + kbConta(total, 'cartão', 'cartões') + ' com estes filtros.' : 'Nada com estes filtros.') : kbConta(total, 'cartão', 'cartões') + '.';
  }
}
/* Muda um filtro e repinta (o quadro já tem tudo: não vai ao servidor).
   Recebe: campo — tipo, etiqueta, responsavel, prioridade ou pai; valor — '' tira o filtro.
   Devolve: nada. */
function kbFiltrar(campo, valor) {
  if (!Object.prototype.hasOwnProperty.call(KB_FILTROS, campo)) return;
  kbFiltros[campo] = String(valor || '');
  kbGuardarFiltros();
  var d = el('dialogo');
  if (d && d.open && kbJanelaAberta) d.close();
  kbPintarQuadro(); kbPintarChips();
}
/* Procura no servidor (chave, título ou descrição) e mostra só o que achou.
   Recebe: texto — o que procurar ('' tira a pesquisa).
   Devolve: nada. */
function kbPesquisar(texto) {
  texto = String(texto || '').trim().slice(0, 200);
  clearTimeout(kbQTempo);
  if (texto === kbFiltros.q && (!texto || kbQ)) return;
  kbFiltros.q = texto; kbGuardarFiltros();
  var vez = ++kbVezQ;
  if (!texto) { kbQ = null; kbPintarQuadro(); kbPintarChips(); return; }
  var r = el('kbResumo');
  if (r) r.textContent = 'À procura…';
  pedir('/api/equipa/kanban?q=' + encodeURIComponent(texto)).then(function (j) {
    if (vez !== kbVezQ || kbFiltros.q !== texto) return;
    kbQ = kbChavesDe(j, texto);
    kbPintarQuadro(); kbPintarChips();
  }).catch(function (e) {
    if (vez === kbVezQ) { avisar(e.message || 'Não deu para pesquisar.', 'erro'); kbPintarChips(); }
  });
}
/* Tira todos os filtros e a pesquisa.
   Devolve: nada. */
function kbLimparFiltros() {
  kbFiltros = kbSemFiltros(); kbQ = null; kbVezQ++;
  kbGuardarFiltros();
  var i = el('kbQ');
  if (i) i.value = '';
  kbPintarQuadro(); kbPintarChips();
}
/* A janela de escolha de um filtro: «Todos» e as opções, cada uma um botão;
   a escolhida marcada com o visto e o aria-pressed.
   Recebe: campo — tipo, etiqueta, responsavel, prioridade ou pai.
   Devolve: nada — abre a janela. */
function kbEscolher(campo) {
  if (!kbEstado || !Object.prototype.hasOwnProperty.call(KB_FILTROS, campo)) return;
  var ops = [];
  if (campo === 'tipo') ops = KB_TIPOS.map(function (t) { return [t, KB_NOMES_TIPOS[t]]; });
  else if (campo === 'etiqueta') ops = kbEstado.etiquetas.map(function (t) { return [t, t]; });
  else if (campo === 'responsavel') ops = [['eu', 'Os meus']].concat(kbEstado.pessoas.map(function (p) { return [p.id, p.nome]; }));
  else if (campo === 'prioridade') ops = [1, 2, 3, 4, 5].map(function (p) { return [String(p), KB_PRIORIDADES[p]]; });
  else if (campo === 'pai') {
    ops = kbEstado.cartoes.filter(function (c) { return c.tipo === 'epico'; }).map(function (c) { return [c.chave, c.chave + ' · ' + c.titulo]; });
  }
  var atual = kbFiltros[campo];
  var opcao = function (valor, rotulo) {
    var on = String(valor) === String(atual);
    return '<button type="button" class="btn lista kb-opcao" aria-pressed="' + (on ? 'true' : 'false') + '"' + comAcao('kbFiltrar', [campo, valor]) + '>' +
      '<span class="flex1">' + esc(rotulo) + '</span>' + (on ? ic('kbVisto', 'i-sm') : '') + '</button>';
  };
  var vazio = { etiqueta: 'Ainda não há etiquetas nos cartões.', pai: 'Ainda não há épicos no quadro.', responsavel: 'Ainda não há ninguém para escolher.' };
  kbJanela('Filtrar por ' + KB_FILTROS[campo], '<div class="kb-opcoes">' + opcao('', campo === 'prioridade' || campo === 'etiqueta' ? 'Todas' : 'Todos') +
    (ops.length ? ops.map(function (o) { return opcao(o[0], o[1]); }).join('') : '<p class="sub">' + (vazio[campo] || 'Nada para escolher.') + '</p>') + '</div>',
    { foco: '.kb-opcao[aria-pressed="true"]' });
}

/* ------------------------- criar e editar um cartão ------------------------ */

/* Um grupo de escolhas (o tipo, a coluna, a prioridade, o responsável):
   rádios dentro de chips, num fieldset com a legenda — nunca o seletor nativo.
   Recebe: id — o id do grupo (o erro vai em id + 'Erro'); rotulo; obrigatorio;
   opcoes — [[valor, rotulo HTML seguro]…]; valor — o escolhido.
   Devolve: o HTML. */
function kbGrupoHtml(id, rotulo, obrigatorio, opcoes, valor) {
  return '<fieldset class="kb-grupo campo-bloco" id="' + id + '" aria-describedby="' + id + 'Erro"><legend class="rot">' + rotulo +
    (obrigatorio ? ' <span class="req">*</span>' : '') + '</legend><div class="chips">' +
    opcoes.map(function (o) {
      return '<label class="chip"><input type="radio" class="so-leitor" name="' + id + '" value="' + esc(o[0]) + '"' +
        (String(o[0]) === String(valor) ? ' checked' : '') + '>' + o[1] + '</label>';
    }).join('') + '</div><p class="erro-txt" id="' + id + 'Erro"></p></fieldset>';
}
/* Um campo de texto da janela: o rótulo (com o * vermelho quando é
   obrigatório), a ajuda, o campo e o sítio do erro ao lado dele.
   Recebe: id; rotulo; obrigatorio; tipo — 'text', 'date' ou 'area'; valor;
   ph — o placeholder («Opcional» ou «Ex: …»; '' nas datas); max; ajuda (opcional).
   Devolve: o HTML. */
function kbCampoHtml(id, rotulo, obrigatorio, tipo, valor, ph, max, ajuda) {
  var comum = ' id="' + id + '" class="campo" aria-describedby="' + id + 'Erro' + (ajuda ? ' ' + id + 'Ajuda' : '') + '"' +
    (max ? ' maxlength="' + max + '"' : '') + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (obrigatorio ? ' aria-required="true"' : '');
  var entrada = tipo === 'area'
    ? '<textarea' + comum + '>' + esc(valor) + '</textarea>'
    : '<input' + comum + ' type="' + tipo + '" autocomplete="off" value="' + esc(valor) + '"' + ligarA('enter', 'kbConfirmar') + '>';
  return '<div class="campo-bloco"><label class="rot" for="' + id + '">' + rotulo + (obrigatorio ? ' <span class="req">*</span>' : '') + '</label>' +
    (ajuda ? '<p class="sub" id="' + id + 'Ajuda">' + ajuda + '</p>' : '') + entrada + '<p class="erro-txt" id="' + id + 'Erro"></p></div>';
}
// O valor do rádio escolhido de um grupo.
// Recebe: nome — o name dos rádios.
// Devolve: o valor, ou ''.
function kbEscolhido(nome) {
  var r = document.querySelector('input[name="' + nome + '"]:checked');
  return r ? r.value : '';
}
/* As etiquetas escritas num campo, como o servidor as quer: separadas por
   vírgulas, em minúsculas, os espaços de dentro a hífen, sem repetidas.
   Recebe: texto — o que se escreveu.
   Devolve: {lista, erro} — erro '' quando estão boas. */
function kbEtiquetasDe(texto) {
  var lista = [];
  String(texto || '').split(',').forEach(function (t) {
    t = t.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && lista.indexOf(t) < 0) lista.push(t);
  });
  var longa = lista.filter(function (t) { return t.length > 40; })[0];
  if (longa) return { lista: lista, erro: 'Cada etiqueta tem até 40 caracteres («' + longa.slice(0, 20) + '…» tem ' + longa.length + ').' };
  if (lista.length > 20) return { lista: lista, erro: 'Até 20 etiquetas por cartão (tens ' + lista.length + ').' };
  return { lista: lista, erro: '' };
}
/* O campo de que fala uma recusa do servidor, para o erro ir para o lado
   dele (o servidor responde só com a frase).
   Recebe: msg — a frase do erro.
   Devolve: o id do campo do formulário, ou ''. */
function kbCampoDoErro(msg) {
  var m = String(msg || '');
  if (/t[íi]tulo/i.test(m)) return 'kbF-titulo';
  if (/\btipo\b/i.test(m)) return 'kbF-tipo';
  if (/\bpai\b|épico|epico|antepassado|subtarefa/i.test(m)) return 'kbF-pai';
  if (/etiqueta/i.test(m)) return 'kbF-etiquetas';
  if (/prazo|data/i.test(m)) return 'kbF-prazo';
  if (/prioridade/i.test(m)) return 'kbF-prioridade';
  if (/respons|pessoa/i.test(m)) return 'kbF-responsavel';
  if (/coluna/i.test(m)) return 'kbF-coluna';
  if (/descri/i.test(m)) return 'kbF-descricao';
  return '';
}
/* O formulário de criar e de editar um cartão: Tipo* e Título*, e o resto
   opcional (descrição, coluna — só ao criar —, prioridade, etiquetas,
   responsável, pai e prazo). Os erros vão para o lado do campo.
   Recebe: modo — 'criar' ou 'editar'; c — o cartão a editar (com a
   descrição; null ao criar); pre (opcional) — ao criar, {coluna_id, pai, tipo}.
   Devolve: nada — abre a janela. */
function kbFormCartao(modo, c, pre) {
  if (!kbEstado) return;
  var p = pre || {}, ed = modo === 'editar' && c;
  var v = ed ? {
    tipo: c.tipo, titulo: c.titulo, descricao: c.descricao || '', prioridade: String(c.prioridade || 3), etiquetas: (c.etiquetas || []).join(', '),
    responsavel: c.responsavel ? c.responsavel.id : '', pai: c.pai ? c.pai.chave : '', prazo: c.prazo || '', coluna: c.coluna_id,
  } : {
    tipo: KB_NOMES_TIPOS[p.tipo] ? p.tipo : 'tarefa', titulo: '', descricao: '', prioridade: '3', etiquetas: '', responsavel: '',
    pai: p.pai || '', prazo: '', coluna: kbColuna(p.coluna_id) ? p.coluna_id : (kbColuna('a-fazer') ? 'a-fazer' : (kbEstado.colunas[0] || {}).id),
  };
  var tipos = KB_TIPOS.map(function (t) { return [t, ic('kb' + maiuscula(t), 'i-sm kb-t-' + t) + KB_NOMES_TIPOS[t]]; });
  var prios = [1, 2, 3, 4, 5].map(function (n) { return [String(n), ic('kbP' + n, 'i-sm kb-p' + n) + KB_PRIORIDADES[n]]; });
  var pessoas = [['', 'Ninguém']].concat(kbEstado.pessoas.map(function (x) { return [x.id, esc(x.nome)]; }));
  var corpo = kbGrupoHtml('kbF-tipo', 'Tipo', true, tipos, v.tipo) +
    kbCampoHtml('kbF-titulo', 'Título', true, 'text', v.titulo, 'Ex: Corrigir o aviso da renda em atraso', 200) +
    (ed && c.descricaoOculta ? '' : kbCampoHtml('kbF-descricao', 'Descrição', false, 'area', v.descricao, 'Opcional', 20000)) +
    (ed ? '' : kbGrupoHtml('kbF-coluna', 'Coluna', false, kbEstado.colunas.map(function (x) { return [x.id, esc(x.nome)]; }), v.coluna)) +
    kbGrupoHtml('kbF-prioridade', 'Prioridade', false, prios, v.prioridade) +
    kbCampoHtml('kbF-etiquetas', 'Etiquetas', false, 'text', v.etiquetas, 'Ex: qa, design', 900, 'Separadas por vírgulas.') +
    kbGrupoHtml('kbF-responsavel', 'Responsável', false, pessoas, v.responsavel) +
    kbCampoHtml('kbF-pai', 'Pai', false, 'text', v.pai, 'Ex: KAN-12', 20, 'O épico de uma história ou tarefa, ou a tarefa de uma subtarefa.') +
    kbCampoHtml('kbF-prazo', 'Prazo', false, 'date', v.prazo, '', 0);
  kbJanela(ed ? 'Editar ' + c.chave : 'Novo cartão', corpo, {
    botao: ed ? 'Guardar' : 'Adicionar',
    foco: '#kbF-titulo',
    aoConfirmar: function () { return kbGuardarCartao(ed ? c : null, v); },
  });
}
/* Lê e confere o formulário do cartão e manda-o ao servidor: ao criar, tudo;
   ao editar, só o que mudou.
   Recebe: c — o cartão a editar (null ao criar); v — os valores com que a janela abriu.
   Devolve: false com erros marcados, ou a promessa do pedido (rejeita com o campo em e.campo). */
function kbGuardarCartao(c, v) {
  var tipo = kbEscolhido('kbF-tipo'), titulo = valorDe('kbF-titulo'), descricao = el('kbF-descricao') ? String(el('kbF-descricao').value || '').trim() : '';
  var prioridade = kbEscolhido('kbF-prioridade') || '3', responsavel = kbEscolhido('kbF-responsavel');
  var et = kbEtiquetasDe(valorDe('kbF-etiquetas')), paiTxt = valorDe('kbF-pai'), pai = paiTxt ? kbChave(paiTxt) : '', prazo = valorDe('kbF-prazo');
  var erros = {
    'kbF-tipo': tipo ? '' : 'Escolhe o tipo.',
    'kbF-titulo': titulo ? '' : 'Escreve um título.',
    'kbF-etiquetas': et.erro,
    'kbF-pai': paiTxt && !pai ? 'Escreve a chave do pai, como KAN-12.'
      : pai && tipo === 'epico' ? 'Um épico não tem pai: deixa o campo vazio.'
      : !pai && tipo === 'subtarefa' ? 'Uma subtarefa precisa de um pai: escreve a chave da tarefa.'
      : pai && c && pai === c.chave ? 'Um cartão não pode ser pai de si mesmo.' : '',
    'kbF-prazo': prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo) ? 'Escolhe um dia, ou deixa vazio.' : '',
  };
  var bom = true;
  Object.keys(erros).forEach(function (k) { marcarErro(k, erros[k]); if (erros[k]) bom = false; });
  if (!bom) {
    var primeiro = document.querySelector('#dialogo [aria-invalid="true"]');
    if (primeiro) { var foco = primeiro.querySelector ? primeiro.querySelector('input') || primeiro : primeiro; if (foco.focus) foco.focus(); }
    return false;
  }
  var corpo = {};
  if (!c) {
    corpo = { tipo: tipo, titulo: titulo, descricao: descricao, coluna_id: kbEscolhido('kbF-coluna') || v.coluna, prioridade: Number(prioridade), etiquetas: et.lista };
    if (responsavel) corpo.responsavel_id = responsavel;
    if (pai) corpo.pai = pai;
    if (prazo) corpo.prazo = prazo;
  } else {
    if (tipo !== v.tipo) corpo.tipo = tipo;
    if (titulo !== v.titulo) corpo.titulo = titulo;
    if (el('kbF-descricao') && descricao !== String(v.descricao || '').trim()) corpo.descricao = descricao;
    if (prioridade !== v.prioridade) corpo.prioridade = Number(prioridade);
    if (et.lista.join(',') !== kbEtiquetasDe(v.etiquetas).lista.join(',')) corpo.etiquetas = et.lista;
    if (responsavel !== v.responsavel) corpo.responsavel_id = responsavel || null;
    if (pai !== v.pai) corpo.pai = pai || null;
    if (prazo !== v.prazo) corpo.prazo = prazo || null;
    if (!Object.keys(corpo).length) { kbFecharJanela(); avisar('Nada mudou.'); return false; }
  }
  var pedido = c
    ? pedir(kbRota(c.chave), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    : enviar('/api/equipa/kanban/cartoes', corpo);
  return pedido.then(function (j) {
    var nova = j && j.cartao ? j.cartao.chave : '';
    avisar(c ? 'Cartão ' + c.chave + ' guardado.' : 'Cartão ' + (nova || 'novo') + ' adicionado' +
      (j && j.cartao && kbTelemovel() ? ' em «' + kbNomeColuna(j.cartao.coluna_id) + '».' : '.'));
    kbRecarregar();
    if (kbAberto && (c || corpo.pai === kbAberto)) kbAbrir(kbAberto, false);
  }, function (e) {
    var x = new Error((e && e.message) || 'Não deu para guardar.');
    x.campo = kbCampoDoErro(x.message);
    throw x;
  });
}
/* O «Novo cartão» e o «Adicionar cartão» de uma coluna.
   Recebe: coluna — o id da coluna onde fica ('' para A fazer).
   Devolve: nada — abre o formulário. */
function kbNovo(coluna) { kbFormCartao('criar', null, { coluna_id: coluna || '' }); }
/* O ponto de encaixe do + da barra de baixo e do «Novo cartão» de fora: vai
   ao Kanban se não estiver lá e abre o formulário de criar.
   Devolve: nada. */
function novoCartao() {
  if (el('kbQuadro') && kbEstado) { kbNovo(''); return; }
  kbAoCarregar = function () { kbNovo(''); };
  if (!el('kbEspera')) ir('kanban', '');
}

/* ----------------- as ações dos filtros e do formulário ----------------- */

ACOES.kbNovo = function (d) { kbNovo(d.arg); };
ACOES.kbEscolher = function (d) { kbEscolher(d.arg); };
ACOES.kbFiltrar = function (d) { kbFiltrar(d.arg, d.arg2); };
ACOES.kbOsMeus = function () { kbFiltrar('responsavel', kbFiltros.responsavel === 'eu' ? '' : 'eu'); };
ACOES.kbLimparFiltros = function () { kbLimparFiltros(); };
ACOES.kbPesquisar = function (d, alvo) { kbPesquisar(alvo && alvo.value); };
ACOES.kbFiltrosAlternar = function () { kbFiltrosAbertos = !kbFiltrosAbertos; kbPintarChips(); kbMedirTopo(); };

// a pesquisa enquanto se escreve (só o campo #kbQ)
document.addEventListener('input', function (e) {
  var t = e.target;
  if (!t || t.id !== 'kbQ') return;
  clearTimeout(kbQTempo);
  kbQTempo = setTimeout(function () { kbPesquisar(t.value); }, 300);
});
`;

// os estilos deste pedaço (o CSS_KANBAN do equipa-kanban.js junta-os pela ordem certa)
export const CSS_KB_FILTROS = `/* ---- a barra dos filtros ---- */
.kb-filtros{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center}
.kb-procura{flex:1 1 260px;max-width:420px}
.kb-filtros-botao{display:none}
.kb-chips{flex:1 1 420px}
.kb-chips .chip b{font-weight:650}
.kb-chips .chip .i{margin-right:-4px}
.kb-resumo{flex:1 0 100%}


/* ---- os grupos de escolhas do formulário (rádios em chips) ---- */
.kb-grupo{border:0;margin:0;padding:0;min-width:0}
.kb-grupo legend{padding:0;margin-bottom:6px}
.kb-grupo .chip .i{width:16px;height:16px}

/* ---- o telemóvel: a pesquisa, o «Filtros» e os chips que abrem e fecham ---- */
@media(max-width:899px){
  .kb-procura{flex:1 1 160px;max-width:none}
  .kb-cab .cab .sub{display:none}
  .kb-cab .cab-acoes .btn.primary{display:none}
  .kb-filtros-botao{display:inline-flex}
  .kb-chips{flex:1 0 100%}
  .kb-chips.kb-fechado{display:none}
  .kb-resumo{display:none}
}
`;
