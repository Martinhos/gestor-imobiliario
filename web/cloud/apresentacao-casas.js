/* ===== APRESENTAÇÃO DAS CASAS ===== */
/* As apresentações dos separadores das Casas: Imóveis, Grupos, Contratos,
   Inquilinos, Proprietários, Colaboradores e Visitas. Cada uma regista-se
   em cloud/apresentacao.js:registarApresentacao ao carregar.

   Cada uma diz o que o separador é e como está arrumado — o que se vê na
   lista, o que um toque abre, o ⋮ da ficha, o segurar que seleciona vários
   (onde o há: cloud/selecao-listas.js:TABS_SEL), o + da barra de baixo ou o
   botão do cabeçalho (acessos.js:acaoNaturalDoEcra), os filtros e a
   pesquisa — e deixa uma dica. Cada frase confere-se no ficheiro do
   separador, que o comentário de cada imagem diz.

   As imagens desenham-se com o kit da apresentação (cloud/apresentacao.js:
   aprCena, aprTela e as peças) e com o portefólio inventado dele
   (APR_EXEMPLO), mais o que as Casas lhe juntam (aprCExemplo). As peças que
   o kit não tem — a ficha com o ⋮ e o rodapé, a seleção, a folha «Criar»,
   o cabeçalho do computador, as linhas das pessoas e das visitas, o mês da
   Agenda — vivem aqui, com o prefixo aprC, e o CSS delas no bloco da folha
   1.3 do estilos.css (.apr-c-…).

   Duas coisas mudam com quem vê e onde, lidas quando a janela abre:
   - quem só colabora (aprSoColabora) não vê as imagens de criar o que o
     cargo não deixa (aprPodeCriar, a regra do «Criar»), e a ficha diz o que
     o cargo abre em vez do «Editar»;
   - no computador (aprCLargo) não há barra de baixo: o + dá lugar ao botão
     do cabeçalho (navegacao.js:pintarAcaoDoCabecalho) e ao «Criar» da barra
     lateral, e a imagem e o texto de criar dizem esses. */

'use strict';

/* ------------------------------------------------ o portefólio, e o resto */

/* O que as Casas juntam ao portefólio inventado (APR_EXEMPLO), e que fecha
   com ele: o T1 Cedofeita está vago desde setembro — o contrato da Carolina
   Mendes (690 €) acabou a 31 de agosto, e o do Rui Ferreira (720 €) começa
   no dia 1 do mês que vem; a Inês Costa deixa o Quarto 3 do T3 Bonfim daqui
   a 25 dias, e as visitas são a esse quarto; o Paulo Antunes é uma ficha sem
   contrato. Ao todo, 8 inquilinos e 7 contratos (5 em vigor, 1 por começar,
   1 terminado). Os grupos (o partilhado é o da Helena Moreira, dona de
   metade do T3 Bonfim), quem colabora e o telefone da Marta Sousa. Os dias
   das visitas contam-se a partir de hoje (aprDia), para não envelhecerem. */
var aprCExemplo = {
  terminado: { inquilino: 'Carolina Mendes', imovel: 'cedofeita', renda: 690 },
  porComecar: { inquilino: 'Rui Ferreira', imovel: 'cedofeita', renda: 720 },
  semContrato: { inquilino: 'Paulo Antunes' },
  nInquilinos: 8,
  nContratos: { todos: 7, vigor: 5, comecar: 1, terminados: 1 },
  // dia — a contar de hoje; o estado e o desfecho com os nomes de visitas.js:VESTADO e VDESFECHO
  visitas: [
    { nomes: 'Sofia Almeida', dia: 0, inicio: '18:30', fim: '19:00', estado: 'agendada' },
    { nomes: 'Beatriz Nunes', dia: 3, inicio: '10:00', estado: 'agendada' },
    { nomes: 'Leonor Vieira', dia: -4, inicio: '17:30', estado: 'realizada', desfecho: 'interessado', contacto: '916 204 381' },
    { nomes: 'Miguel Santos', dia: -6, inicio: '19:00', estado: 'faltou' },
  ],
  grupos: [
    { nome: 'Porto centro', imoveis: ['paranhos', 'campanha', 'cedofeita'] },
    { nome: 'Bonfim a meias', imoveis: ['bonfim'], partilhado: true },
  ],
  quemColabora: { nome: 'Rita Gomes', cargo: 'Gestor de visitas', imoveis: ['bonfim', 'cedofeita'] },
  // quem só colabora vê-se do outro lado: colabora nos imóveis de outra pessoa
  colaborasCom: { dono: 'Duarte Pinto', cargo: 'Gestor de visitas', casa: 'T1 Foz', morada: 'Rua da Senhora da Luz, Porto', tom: 't3' },
  telefone: '+351 913 274 650',
};

// os meses como a lista das visitas os escreve por baixo do dia (visitas.js:visBlocoData)
var aprCMeses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/* No computador não há barra de baixo: a partir dos 901 px o + dá lugar ao
   botão do cabeçalho e ao «Criar» da barra lateral (estilos.css, o
   @media(max-width:900px) da .tabbar). Lido quando a janela abre.
   Devolve: true no computador. */
function aprCLargo() {
  try { return typeof matchMedia === 'function' && !!matchMedia('(min-width: 901px)').matches; } catch (e) { return false; }
}

/* Há imóveis onde esta conta pode isto? A condição do + para os contratos e
   as visitas (acessos.js:ACOES_DE_ADICIONAR): sem imóvel nenhum, o «Criar»
   não os oferece.
   Recebe: perm — a permissão ('contract.add', 'visit.add').
   Devolve: true/false. */
function aprCComCasas(perm) {
  return casasComo(perm).length > 0;
}

/* O subtítulo de um separador, o que o cabeçalho do computador escreve por
   baixo do título (navegacao.js:TABS).
   Recebe: id — o id do separador.
   Devolve: o texto ('' sem ele). */
function aprCSub(id) {
  var t = (typeof TABS !== 'undefined' ? TABS : []).filter(function (x) { return x.id === id; })[0];
  return t ? t.sub : '';
}

/* O id desta conta, como a partilha entre contas o mostra para o dar a
   outro utilizador (cloud/partilha.js:comproprietariosCorpo) — ou um
   inventado, fora de uma conta com id.
   Devolve: o texto. */
function aprCMeuId() {
  var id = String((window.CW && CW.user && CW.user.id) || '');
  return /^[A-Z0-9]{6,10}$/.test(id) ? id : 'K3M8Q2TA';
}

/* O último 31 de agosto que já passou: o fim do contrato da Carolina
   Mendes (o T1 Cedofeita está vago desde setembro).
   Devolve: a data em AAAA-MM-DD. */
function aprCFimDeAgosto() {
  var hoje = today(), y = Number(hoje.slice(0, 4));
  return hoje > y + '-08-31' ? y + '-08-31' : (y - 1) + '-08-31';
}

/* A última vez que um dia do mês passou, hoje incluído: a data da renda
   mais recente de um contrato.
   Recebe: dia — o dia do mês (1 a 28).
   Devolve: a data em AAAA-MM-DD. */
function aprCUltimo(dia) {
  var hoje = today(), y = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7)) - 1;
  var d = dayInMonth(y, m, dia);
  return d <= hoje ? d : dayInMonth(m === 0 ? y - 1 : y, (m + 11) % 12, dia);
}

/* Quantos dias vão de uma data a outra.
   Recebe: de, ate — as datas em AAAA-MM-DD.
   Devolve: os dias (negativo quando ate vem antes). */
function aprCDias(de, ate) {
  return Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 864e5);
}

/* Uma data dd/mm/aaaa (as do APR_EXEMPLO) em AAAA-MM-DD.
   Recebe: t — o texto.
   Devolve: a data em ISO. */
function aprCIso(t) {
  var p = String(t || '').split('/');
  return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : '';
}

/* O dia de uma data por extenso, como a ficha da visita e o painel do dia
   da Agenda o escrevem («Terça-feira»).
   Recebe: iso — a data em AAAA-MM-DD.
   Devolve: o texto, com a primeira letra grande ('' se o browser não souber). */
function aprCDiaDaSemana(iso) {
  var d = '';
  try { d = new Date(iso + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long' }); } catch (e) { d = ''; }
  return d ? d.charAt(0).toUpperCase() + d.slice(1) : '';
}

/* ------------------------------------------------------ as peças das Casas */

/* Um chip dos filtros de uma lista (vistas.js:lfChip): desligado diz o nome
   do campo; ligado, o que está escolhido, com o × que o limpa.
   Recebe: nome — o texto; o (opcional) — {on: ligado, alvo: em destaque}.
   Devolve: o HTML. */
function aprCChip(nome, o) {
  o = o || {};
  return '<span class="apr-m-chip apr-c-chip' + (o.on ? ' on' : '') + (o.alvo ? ' apr-alvo' : '') + '">' + esc(nome) + (o.on ? ic('x', 9) : '') + '</span>';
}

/* A fila dos chips por baixo da pesquisa.
   Recebe: chips — o HTML de cada um (array).
   Devolve: o HTML. */
function aprCChips(chips) {
  return '<div class="apr-m-chips apr-c-chips">' + (chips || []).join('') + '</div>';
}

/* O menu aberto de um chip (o sel() da casa): uma escolha por linha, com
   quantos lhe cabem (vistas.js:lfOpcoes), e a de agora com o visto.
   Recebe: opcoes — [[rótulo, escolhida]].
   Devolve: o HTML. */
function aprCMenu(opcoes) {
  return '<div class="apr-c-menu apr-flutua">' + (opcoes || []).map(function (x) {
    return '<span class="apr-c-menu-op' + (x[1] ? ' on' : '') + '">' + (x[1] ? ic('check', 10) : '<i></i>') + esc(x[0]) + '</span>';
  }).join('') + '</div>';
}

/* O segundo segmentado das Pessoas (navegacao.js:abasDaArea): Inquilinos,
   Proprietários e Colaboradores, com quantos há de cada; o de agora com o
   traço por baixo e a tinta forte.
   Recebe: atual — o rótulo do de agora.
   Devolve: o HTML. */
function aprCAbasPessoas(atual) {
  var n = { 'Inquilinos': aprCExemplo.nInquilinos, 'Proprietários': APR_EXEMPLO.proprietarios.length, 'Colaboradores': 1 };
  return '<div class="apr-c-pessoas">' + APR_ABAS_PESSOAS.map(function (x) {
    return '<span' + (x === atual ? ' class="on"' : '') + '>' + esc(x) + '<i>' + esc(n[x]) + '</i></span>';
  }).join('') + '</div>';
}

/* A caixa de marcar da seleção (cloud/selecao.js:caixa): vazia, marcada
   (cheia, com o visto) ou a meio (a do «marcar tudo» do cabeçalho).
   Recebe: estado — '' (vazia), 'on' ou 'meio'.
   Devolve: o HTML. */
function aprCCaixa(estado) {
  var on = estado === 'on';
  return '<span class="apr-c-caixa' + (on ? ' on' : estado === 'meio' ? ' meio' : '') + '">' + (on ? ic('check', 10) : '') + '</span>';
}

/* O Apagar vermelho da barra da seleção.
   Devolve: o HTML. */
function aprCApagar() {
  return '<span class="apr-m-botao pequeno apr-c-perigo">' + ic('trash', 12) + 'Apagar</span>';
}

/* O ecrã do telemóvel em seleção de vários (cloud/selecao-listas.js:
   selLCabNovo e selLBarraHtml): no lugar do título, a caixa de tudo e a
   contagem; por baixo as abas e a lista; e, no lugar da barra de baixo, a
   da seleção — Cancelar, quantos estão marcados e as ações (com mais do que
   o Apagar, numa segunda linha).
   Recebe: o — {cabeca (a contagem do cabeçalho: «2 imóveis»), abas, aba,
   corpo (HTML), conta (a da barra: «2 selecionados»), acoes (o HTML de
   cada botão, array)}.
   Devolve: o HTML. */
function aprCTelaSel(o) {
  var acoes = o.acoes || [], duas = acoes.length > 1;
  return '<div class="apr-tela apr-c-tela-sel' + (duas ? ' duas' : '') + '">' +
    '<div class="apr-m-cab apr-c-selcab"><span class="apr-m-cab-menu">' + ic('menu', 14) + '</span>' + aprCCaixa('meio') +
      '<span class="apr-c-selcab-txt"><b>' + esc(o.cabeca) + '</b><span class="apr-m-sub">toca para marcar tudo</span></span></div>' +
    (o.abas ? aprAbas(o.abas, o.aba) : '') +
    '<div class="apr-tela-corpo">' + (o.corpo || '') + '</div>' +
    '<div class="apr-c-selbarra"><span>' + aprBotao('Cancelar', { pequeno: true, icone: 'x' }) + '<b>' + esc(o.conta) + '</b>' + (duas ? '' : acoes.join('')) + '</span>' +
      (duas ? '<span class="apr-c-selbarra-baixo">' + acoes.join('') + '</span>' : '') + '</div>' +
  '</div>';
}

/* Um cartão de imóvel numa seleção: a caixa à cabeça do nome e, marcado, o
   contorno (cloud/selecao-listas.js:selLDecorar).
   Recebe: id — o id do imóvel no APR_EXEMPLO; on — se está marcado.
   Devolve: o HTML. */
function aprCImovelMarcavel(id, on) {
  return '<div class="apr-c-marca' + (on ? ' on' : '') + '">' + aprCCaixa(on ? 'on' : '') + aprCartaoImovel(APR_EXEMPLO.imovel(id)) + '</div>';
}

/* A ficha de um registo em miniatura (componentes.js:abrirFicha): o título,
   o ⋮ das opções e o ✕; o corpo; e o rodapé, com o Fechar e o botão da
   direita (o Editar, só a quem pode).
   Recebe: titulo — o texto; corpo — o HTML; o (opcional) — {rodape: [o da
   esquerda, o da direita] (por omissão Fechar e Editar; o da direita vazio
   fica só o da esquerda), menu: false para não ter o ⋮, alvoRodape: o da
   direita em destaque}.
   Devolve: o HTML. */
function aprCFicha(titulo, corpo, o) {
  o = o || {};
  var rod = o.rodape || ['Fechar', 'Editar'];
  return '<div class="apr-m-folha apr-c-ficha apr-flutua">' +
    '<div class="apr-m-folha-cab"><b>' + esc(titulo) + '</b><span class="apr-c-ficha-ic">' + (o.menu === false ? '' : ic('dots', 12)) + ic('x', 12) + '</span></div>' +
    '<div class="apr-m-folha-corpo">' + (corpo || '') + '</div>' +
    '<div class="apr-c-rodape">' + aprBotao(rod[0], { pequeno: true }) + (rod[1] ? aprBotao(rod[1], { pequeno: true, primario: true, alvo: !!o.alvoRodape }) : '') + '</div>' +
  '</div>';
}

/* Um chip das ações rápidas de uma ficha (imovel.js:imvAcoesRapidas,
   pessoas.js:pesFichaInquilino), com o ícone; o «Movimentos» aceso.
   Recebe: rotulo — o texto; icone — o nome no icones.js:ic; aceso (opcional).
   Devolve: o HTML. */
function aprCChipAcao(rotulo, icone, aceso) {
  return '<span class="apr-m-chip apr-c-chip-acao' + (aceso ? ' aceso' : '') + '">' + ic(icone, 10) + esc(rotulo) + '</span>';
}

/* A fila das ações rápidas de uma ficha: rola de lado, e o que não cabe sai
   pela direita.
   Recebe: chips — o HTML de cada um (array).
   Devolve: o HTML. */
function aprCAcoes(chips) {
  return '<span class="apr-c-acoes">' + (chips || []).join('') + '</span>';
}

/* A capa da ficha de um imóvel sem fotografia: o mosaico dele, ao largo,
   com quantas fotos há (imovel.js:imvCapaDaFicha) — sem fotos à vista, só
   o mosaico.
   Recebe: tom — o tom do imóvel ('t0' a 't3'); n — quantas fotos (0 sem nenhuma).
   Devolve: o HTML. */
function aprCCapaLarga(tom, n) {
  var t = /^t[0-3]$/.test(tom || '') ? tom : 't0';
  return '<span class="apr-c-fcapa"><i class="imv-mosaico imv-' + t + '"></i>' +
    (n > 0 ? '<span class="apr-c-nfotos">' + ic('photo', 10) + esc(n + (n === 1 ? ' foto' : ' fotos')) + '</span>' : '') + '</span>';
}

/* Uma fila de números de uma ficha, cada um com o rótulo por cima e, se o
   tiver, uma nota por baixo (imovel.js:imvNumerosDaFicha,
   contrato.js:ctValoresDaFicha).
   Recebe: cels — [[rótulo, valor, nota]].
   Devolve: o HTML. */
function aprCNumeros(cels) {
  return '<span class="apr-c-nums">' + (cels || []).map(function (c) {
    return '<span><span class="apr-m-sub">' + esc(c[0]) + '</span><b>' + esc(c[1]) + '</b>' + (c[2] ? '<span class="apr-m-sub">' + esc(c[2]) + '</span>' : '') + '</span>';
  }).join('') + '</span>';
}

/* Uma linha rótulo / valor de uma ficha (contrato.js:ctKv, pessoas.js:pesKv,
   visitas.js:visKv); um contacto que liga ou escreve com a cor das ligações.
   Recebe: rotulo, valor — os textos; liga (opcional) — verdade num contacto.
   Devolve: o HTML. */
function aprCKv(rotulo, valor, liga) {
  return '<span class="apr-c-kv"><span>' + esc(rotulo) + '</span><b' + (liga ? ' class="liga"' : '') + '>' + esc(valor) + '</b></span>';
}

/* Um cartão com um título e o corpo — os cartões das fichas.
   Recebe: titulo — o texto; html — o corpo; o (opcional) — {nota: texto à
   direita do título, flutua, alvo}.
   Devolve: o HTML. */
function aprCCartaoTit(titulo, html, o) {
  o = o || {};
  return aprCartao('<span class="apr-m-cartao-cab"><b>' + esc(titulo) + '</b>' + (o.nota ? '<span class="apr-m-sub">' + esc(o.nota) + '</span>' : '') + '</span>' + (html || ''),
    { flutua: o.flutua, alvo: o.alvo });
}

/* A folha «Criar» do + da barra de baixo (navegacao.js:abrirAdicionar), no
   ecrã do telemóvel: a ação deste ecrã à cabeça, marcada «neste ecrã» (e
   em destaque), os tipos de movimento e os outros registos.
   Recebe: rotulo, icone — a ação deste ecrã; outros — [[ícone, rótulo]] dos
   outros registos a mostrar.
   Devolve: o HTML. */
function aprCCriar(rotulo, icone, outros) {
  var tipo = function (i, tom, r) { return '<span class="apr-c-criar-tipo">' + aprIcone(i, { tom: tom }) + '<b>' + esc(r) + '</b></span>'; };
  return '<div class="apr-tela apr-c-criar">' +
    '<div class="apr-m-folha-cab"><b>Criar</b>' + ic('x', 12) + '</div>' +
    '<div class="apr-tela-corpo">' +
      '<span class="apr-c-criar-aqui apr-alvo">' + ic(icone, 13) + '<span><b>' + esc(rotulo) + '</b><span class="apr-c-neste">neste ecrã</span></span></span>' +
      '<span class="apr-m-rot apr-m-maiusc">Novo movimento</span>' +
      '<span class="apr-c-criar-tipos">' + tipo('up', 'in', 'Receita') + tipo('dn', 'out', 'Despesa') + tipo('bank', 'loan', 'Pagamento de crédito') + '</span>' +
      '<span class="apr-m-rot apr-m-maiusc">Outros registos</span>' +
      '<span class="apr-c-criar-outros">' + (outros || []).map(function (x) { return '<span>' + ic(x[0], 12) + '<b>' + esc(x[1]) + '</b></span>'; }).join('') + '</span>' +
    '</div></div>';
}

/* O cabeçalho do computador (index.html:header.top): o título e o
   subtítulo do separador e, à direita, o «Selecionar vários» e a ação
   principal (navegacao.js:pintarAcaoDoCabecalho), em destaque.
   Recebe: titulo, sub — os textos; acao — o rótulo da ação; o (opcional) —
   {semSelecao: verdade num separador sem seleção de vários}.
   Devolve: o HTML. */
function aprCCabecaLarga(titulo, sub, acao, o) {
  return '<div class="apr-m-cartao apr-c-cabeca-larga apr-flutua"><span class="apr-c-cabeca-tit"><b>' + esc(titulo) + '</b><span class="apr-m-sub">' + esc(sub) + '</span></span>' +
    (o && o.semSelecao ? '' : '<span class="apr-c-cabeca-ic">' + ic('caixaVisto', 13) + '</span>') +
    aprBotao(acao, { primario: true, pequeno: true, icone: 'plus', alvo: true }) + '</div>';
}

/* A imagem de criar um registo, conforme o ecrã: no telemóvel a folha
   «Criar» do +, com este registo à cabeça; no computador o botão do
   cabeçalho e, por baixo, o formulário que ele abre.
   Recebe: o — {rotulo, icone, outros (os da aprCCriar), id (o separador,
   para o subtítulo), titulo, acao, folha (o HTML do formulário), tom}.
   Devolve: o HTML da imagem. */
function aprCNovo(o) {
  if (!aprCLargo()) return aprCena(aprCCriar(o.rotulo, o.icone, o.outros), { tom: o.tom, arranjo: 'tela' });
  return aprCena(aprColuna([aprCCabecaLarga(o.titulo, aprCSub(o.id), o.acao), '<span class="apr-m-desce">' + ic('down', 13) + '</span>', o.folha]),
    { tom: o.tom, arranjo: 'coluna' });
}

/* Uma linha de pessoa (lista-pessoas.js:personCard): o avatar com as
   iniciais (apagado num inquilino sem contrato que conte), o nome, o que
   diz dela, os selos e, à direita, a renda; numa seleção, a caixa à cabeça
   e, marcada, o fundo suave com o filete.
   Recebe: o — {nome, sub, selos: [[texto, tom]], valor (já escrito),
   apagado, caixa (undefined sem seleção; true/false marcada ou não), alvo}.
   Devolve: o HTML. */
function aprCLinhaPessoa(o) {
  var selos = (o.selos || []).map(function (s) { return aprSelo(s[0], s[1]); }).join('');
  return '<div class="apr-m-linha com-lado' + (o.caixa === true ? ' apr-c-marcada' : '') + (o.alvo ? ' apr-alvo' : '') + '">' +
    (o.caixa === undefined ? '' : aprCCaixa(o.caixa ? 'on' : '')) +
    '<span class="apr-m-avatar' + (o.apagado ? ' apr-c-apagado' : '') + '">' + esc(initials(o.nome)) + '</span>' +
    '<span class="apr-m-linha-txt"><b>' + esc(o.nome) + '</b>' + (o.sub ? '<span class="apr-m-sub">' + esc(o.sub) + '</span>' : '') +
      (selos ? '<span class="apr-m-selos">' + selos + '</span>' : '') + '</span>' +
    (o.valor ? '<b class="apr-m-valor">' + esc(o.valor) + '</b>' : '') + '</div>';
}

// as cores e os nomes dos estados e dos desfechos das visitas (visitas.js:VESTADO, VIS_COR, VDESFECHO, VIS_COR_DESF)
var aprCVisEstado = { agendada: ['Agendada', ''], realizada: ['Realizada', 'in'], faltou: ['Faltou', 'amber'], cancelada: ['Cancelada', 'grey'] };
var aprCVisDesfecho = { interessado: ['Interessado', 'in'], pensar: ['A pensar', ''], 'sem-interesse': ['Sem interesse', 'grey'] };

/* Os selos de uma visita: o estado e, numa realizada, o desfecho
   (visitas.js:visSelos).
   Recebe: v — uma visita do aprCExemplo.
   Devolve: o HTML. */
function aprCSelosVisita(v) {
  var e = aprCVisEstado[v.estado], r = v.estado === 'realizada' && aprCVisDesfecho[v.desfecho];
  return (e ? aprSelo(e[0], e[1]) : '') + (r ? aprSelo(r[0], r[1]) : '');
}

/* Uma linha de visita (visitas.js:visCard): o bloco do dia — o número em
   grande e, por baixo, «hoje», «amanhã», «ontem» ou o mês, hoje a cheio —,
   quem vem, a hora, o imóvel e o «daqui a N dias» dentro da semana, e os
   selos: à direita nas que vêm, por baixo nas que passaram. Numa seleção, a
   caixa à cabeça.
   Recebe: v — uma visita do aprCExemplo; caixa (opcional) — true/false
   numa seleção.
   Devolve: o HTML. */
function aprCLinhaVisita(v, caixa) {
  var iso = aprDia(v.dia), d = v.dia, passou = d < 0;
  var rot = d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d === -1 ? 'ontem' : aprCMeses[Number(iso.slice(5, 7)) - 1];
  var rel = Math.abs(d) >= 2 && Math.abs(d) <= 7 ? (d > 0 ? 'daqui a ' + d + ' dias' : 'há ' + (-d) + ' dias') : '';
  var sub = [v.inicio + (v.fim ? ' – ' + v.fim : ''), 'T3 Bonfim · Quarto 3', rel].filter(Boolean).join(' · ');
  var selos = aprCSelosVisita(v);
  return '<div class="apr-m-linha com-lado apr-c-visita' + (caixa === true ? ' apr-c-marcada' : '') + '">' +
    (caixa === undefined ? '' : aprCCaixa(caixa ? 'on' : '')) +
    '<span class="apr-c-dia' + (d === 0 ? ' hoje' : '') + '"><b>' + Number(iso.slice(8, 10)) + '</b><span>' + esc(rot) + '</span></span>' +
    '<span class="apr-m-linha-txt"><b>' + esc(v.nomes) + '</b><span class="apr-m-sub">' + esc(sub) + '</span>' +
      (passou ? '<span class="apr-m-selos">' + selos + '</span>' : '') + '</span>' +
    (passou ? '' : '<span class="apr-m-selos apr-c-selos-dir">' + selos + '</span>') + '</div>';
}

/* O cabeçalho de um grupo de visitas (Próximas, Passadas) com quantas são.
   Recebe: titulo — o texto; n — quantas.
   Devolve: o HTML. */
function aprCSubSecao(titulo, n) {
  return '<span class="apr-c-subsecao"><b>' + esc(titulo) + '</b><span>' + esc(n) + '</span></span>';
}

/* O cabeçalho de um imóvel na lista dos contratos
   (lista-contratos.js:ctGruposDaLista): o nome, o que ele é e a renda do mês.
   Recebe: nome, desc — os textos; renda — euros por mês.
   Devolve: o HTML. */
function aprCGrupoContrato(nome, desc, renda) {
  return '<span class="apr-c-ctgrupo"><b>' + esc(nome) + '</b><span class="apr-m-sub">' + esc(desc) + '</span><span class="apr-c-ctrenda">' + esc(aprDinheiro(renda)) + '/mês</span></span>';
}

/* Uma linha da lista dos contratos (lista-contratos.js:ctLinha): quem, a
   parte e até quando, os selos, e a renda com a líquida por baixo — com a
   taxa de 10 % das rendas moderadas, a que a app estima para estas rendas
   (irs-2026.js, rendaModerada).
   Recebe: o — {quem, parte, periodo, renda, selos: [[texto, tom]], alvo}.
   Devolve: o HTML. */
function aprCLinhaContrato(o) {
  return aprLinha({ titulo: o.quem, sub: o.parte + ' · ' + o.periodo, selos: o.selos, valor: aprDinheiro(o.renda), alvo: o.alvo,
    botao: '<span class="apr-m-sub">líquida ' + esc(aprDinheiro(o.renda * 0.9)) + '</span>' });
}

/* O bloco dos por confirmar que a nuvem pendura por baixo de um contrato
   (cloud/painel.js:pendBlock): a renda em atraso, com o Confirmar em
   destaque e o Rever.
   Recebe: titulo, sub, valor — os textos da linha.
   Devolve: o HTML. */
function aprCPorConfirmar(titulo, sub, valor) {
  return '<span class="apr-c-pend"><b class="apr-c-pend-tit">1 movimento por confirmar</b>' +
    '<span class="apr-c-pend-linha"><span class="apr-m-linha-txt"><b>' + esc(titulo) + '</b><span class="apr-m-sub">' + esc(sub) + '</span></span>' +
      '<span class="apr-m-linha-dir"><b class="apr-m-valor pos">' + esc(valor) + '</b>' + aprSelo('Em atraso', 'red') + '</span></span>' +
    '<span class="apr-c-botoes">' + aprBotao('Confirmar', { primario: true, pequeno: true, icone: 'check', alvo: true }) + aprBotao('Rever', { pequeno: true }) + '</span></span>';
}

/* O prazo de um contrato no topo da ficha (contrato.js:ctTopoDaFicha): o
   início, o que falta e o fim por cima da barra do tempo que já passou.
   Recebe: de, ate — o início e o fim, em AAAA-MM-DD.
   Devolve: o HTML. */
function aprCPrazo(de, ate) {
  var hoje = today(), tot = Math.max(1, aprCDias(de, ate)), feito = Math.min(tot, Math.max(0, aprCDias(de, hoje))), falta = aprCDias(hoje, ate);
  var meio = falta < 0 ? 'terminou' : falta === 0 ? 'acaba hoje' : falta === 1 ? 'falta 1 dia' : 'faltam ' + falta + ' dias';
  return '<span class="apr-c-prazo"><span>' + esc(dPT(de)) + '</span><span class="apr-m-sub">' + esc(meio) + '</span><span>' + esc(dPT(ate)) + '</span></span>' +
    aprProgresso(feito / tot * 100, { tom: 'in' });
}

/* Os nomes dos imóveis de um grupo do aprCExemplo.
   Recebe: g — o grupo.
   Devolve: os nomes (array). */
function aprCNomesDoGrupo(g) {
  return g.imoveis.map(function (id) { return APR_EXEMPLO.imovel(id).nome; });
}

/* Esta conta pode partilhar grupos (definicoes.js:podePartilharGrupos — a
   nuvem dos grupos, sessão e o serviço Colaboradores)?
   Devolve: true/false. */
function aprCPartilhaGrupos() {
  return typeof podePartilharGrupos === 'function' && !!podePartilharGrupos();
}

/* O cartão de um grupo, como no separador: o privado com o nome, «Privado»,
   os imóveis e o «Partilhar» (definicoes.js:cartaoDoGrupo); o partilhado
   com «Partilhado · teu», os imóveis e as pessoas
   (cloud/grupos.js:cartaoDoGrupoPartilhado).
   Recebe: g — um grupo do aprCExemplo; o (opcional) — {alvo, corpo: o HTML
   por baixo do resumo (no lugar do «Partilhar»)}.
   Devolve: o HTML. */
function aprCCartaoGrupo(g, o) {
  o = o || {};
  var nomes = aprCNomesDoGrupo(g).join(' · ');
  var cab = '<span class="apr-m-cartao-cab apr-c-grupo-cab"><b>' + esc(g.nome) + '</b>' + (g.partilhado ? aprSelo('Partilhado · teu') : aprSelo('Privado', 'grey')) + '</span>';
  var resumo = '<span class="apr-m-sub">' + esc(g.partilhado ? nomes + ' · 2 pessoas' : nomes) + '</span>';
  var baixo = o.corpo != null ? o.corpo : g.partilhado ? '' : '<span class="apr-c-botoes">' + aprBotao('Partilhar', { pequeno: true, icone: 'users' }) + '</span>';
  return aprCartao(cab + resumo + baixo, { alvo: o.alvo, flutua: o.flutua, classe: 'apr-c-grupo' });
}

/* Os membros de um grupo em etiquetas com o ×, e o «+ Adicionar»
   (componentes.js:tagField, na janela do grupo).
   Recebe: nomes — os rótulos (array).
   Devolve: o HTML. */
function aprCEtiquetas(nomes) {
  return '<span class="apr-c-etiquetas">' + (nomes || []).map(function (n) { return '<span>' + esc(n) + ic('x', 9) + '</span>'; }).join('') +
    '<span class="apr-c-etiqueta-mais">+ Adicionar</span></span>';
}

/* A tabela das permissões de um cargo (cloud/colaboradores.js:
   tabelaDePermissoes): uma linha por coisa, com o Ver e o Adicionar — o
   visto quando o cargo a tem, o traço quando não.
   Recebe: linhas — [[nome, ver, adicionar]] (true/false).
   Devolve: o HTML. */
function aprCPermissoes(linhas) {
  var cel = function (v) { return v ? '<span class="sim">' + ic('check', 11) + '</span>' : '<span class="nao"><i></i></span>'; };
  return '<span class="apr-c-perms"><span class="apr-c-perm apr-c-perm-tit"><span>O quê</span><span>Ver</span><span>Adicionar</span></span>' +
    (linhas || []).map(function (l) { return '<span class="apr-c-perm"><span>' + esc(l[0]) + '</span>' + cel(l[1]) + cel(l[2]) + '</span>'; }).join('') + '</span>';
}

/* O resumo de um cargo pronto, como a app o escreve
   (cloud/colaboradores.js:resumoPerms), a partir dos CARGOS_EXEMPLO.
   Recebe: nome — o nome do cargo pronto; omissao — o texto sem a nuvem.
   Devolve: o texto. */
function aprCResumoDoCargo(nome, omissao) {
  var c = CARGOS_EXEMPLO.filter(function (x) { return x.nome === nome; })[0];
  return c && typeof resumoPerms === 'function' ? resumoPerms(c.perms) : omissao;
}

/* Uma escolha de cargo no convite (cloud/colaboradores.js:corpoDoConvite):
   o círculo, cheio na escolhida, o nome e o resumo do que abre.
   Recebe: nome, sub — os textos; on — se é a escolhida.
   Devolve: o HTML. */
function aprCOpcao(nome, sub, on) {
  return '<span class="apr-c-opcao' + (on ? ' on' : '') + '"><span class="apr-c-radio"></span><span class="apr-m-linha-txt"><b>' + esc(nome) + '</b><span class="apr-m-sub">' + esc(sub) + '</span></span></span>';
}

/* Um imóvel numa lista de caixas (o convite: cloud/colaboradores.js:caixaDeCasa).
   Recebe: im — um imóvel do APR_EXEMPLO; on — se está marcado.
   Devolve: o HTML. */
function aprCCasaMarcavel(im, on) {
  return '<span class="apr-c-casa">' + aprCCaixa(on ? 'on' : '') + '<b>' + esc(im.nome) + '</b></span>';
}

/* O cartão de quem colabora nos imóveis de outra pessoa
   (cloud/colaboradores.js:colaboroCartao): «Colaboras com», o cargo, o que
   ele deixa fazer (acessos.js:fraseCurtaPodes) e o «Deixar de colaborar».
   Recebe: o (opcional) — {dono, cargo, casa, alvo}; por omissão os do aprCExemplo.
   Devolve: o HTML. */
function aprCColaborasCom(o) {
  var c = Object.assign({}, aprCExemplo.colaborasCom, o || {});
  return aprCartao('<span class="apr-m-ficha apr-c-colab-cab">' + aprAvatar(c.dono) + '<span><span class="apr-m-sub">Colaboras com</span><b>' + esc(c.dono) + '</b></span>' + aprSelo(c.cargo) + '</span>' +
    '<span class="apr-c-frase">Podes marcar visitas e adicionar inquilinos em <b>' + esc(c.casa) + '</b>.</span>' +
    '<span class="apr-c-botoes">' + aprBotao('Deixar de colaborar', { pequeno: true, alvo: !!c.alvo }) + '</span>', { flutua: true });
}

/* O mês da Agenda em miniatura (calendario.js:vCalendar): os dias da
   semana a começar à segunda, o de hoje a cheio e um ponto nos dias com
   alguma coisa — as visitas (hoje e daqui a 3 dias) e os planeados do
   portefólio (as rendas dos dias 1, 5 e 8 e a prestação do dia 15).
   Devolve: o HTML. */
function aprCMes() {
  var hoje = today(), y = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7)) - 1, dHoje = Number(hoje.slice(8, 10));
  var ultimo = Number(dayInMonth(y, m, 31).slice(8, 10)), antes = (new Date(y, m, 1).getDay() + 6) % 7;
  var visitas = aprCExemplo.visitas.filter(function (v) { return v.dia >= 0 && aprDia(v.dia).slice(0, 7) === hoje.slice(0, 7); })
    .map(function (v) { return Number(aprDia(v.dia).slice(8, 10)); });
  var cel = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(function (x) { return '<span class="apr-c-mes-sem">' + x + '</span>'; });
  for (var k = 0; k < antes; k++) cel.push('<span></span>');
  for (var d = 1; d <= ultimo; d++) {
    var ponto = visitas.indexOf(d) > -1 || [1, 5, 8, 15].indexOf(d) > -1;
    cel.push('<span class="' + (d === dHoje ? 'hoje' : '') + (ponto ? ' ponto' : '') + '">' + d + '</span>');
  }
  var mes = new Date(y, m, 1).toLocaleDateString('pt-PT', { month: 'long' });
  return '<span class="apr-m-cartao-cab"><b>' + esc(mes.charAt(0).toUpperCase() + mes.slice(1) + ' de ' + y) + '</b><span class="apr-c-mes-setas">' + ic('chev', 11) + ic('chevR', 11) + '</span></span>' +
    '<span class="apr-c-mes">' + cel.join('') + '</span>';
}

/* --------------------------------------------------------------- Imóveis */

/* A lista dos Imóveis (lista-imoveis.js:vProperties): a pesquisa com o
   funil, o chip do estado e os cartões por origem, cada um com a capa, o
   estado, a renda, a yield e a dívida, e os selos do que pede atenção
   (lista-imoveis.js:imvCartao) — a renda do Tomás Matos em atraso no T3
   Bonfim, que é por quartos.
   Devolve: o HTML da imagem. */
function aprCImoveisLista() {
  var ex = APR_EXEMPLO;
  return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Imóveis',
    corpo: aprPesquisa() + aprCChips([aprCChip('Estado')]) + aprSecao('Os meus imóveis', ex.imoveis.length) +
      aprCartaoImovel(ex.imovel('bonfim'), { selos: [['1 renda em atraso', 'red'], ['Por quartos', 'grey']] }) +
      aprCartaoImovel(ex.imovel('paranhos')) }), { tom: 't0', arranjo: 'tela' });
}

/* A ficha de um imóvel (imovel.js:propView, imovel.js:propFicha): a capa
   com as fotos, a morada e os selos, as ações rápidas com o «Movimentos»
   aceso e os números; no rodapé o Editar. A quem só colabora, a
   nota de quem é o imóvel e do cargo (imovel.js:imvNotaDeColaborador), as
   ações do cargo e só o Fechar (o Editar é do «Editar a ficha»).
   Devolve: o HTML da imagem. */
function aprCImoveisFicha() {
  var ex = APR_EXEMPLO, p = ex.imovel('paranhos'), ct = ex.contrato('c4'), c = aprCExemplo.colaborasCom;
  if (aprSoColabora()) {
    // o Gestor de visitas não vê as fotos: a capa fica no mosaico, sem quantas são
    return aprCena(aprCFicha(c.casa, aprCCapaLarga(c.tom, 0) + '<span class="apr-m-sub">' + esc(c.morada) + '</span>' +
      '<span class="apr-c-nota"><span>Imóvel de <b>' + esc(c.dono) + '</b>. Colaboras como <b>' + esc(c.cargo) + '</b> — a ficha é só de leitura.</span>' +
        '<span class="apr-m-sub">Neste imóvel podes: marcar visitas e adicionar inquilinos.</span></span>' +
      aprCAcoes([aprCChipAcao('Marcar visita', 'door'), aprCChipAcao('Adicionar inquilino', 'users')]), { rodape: ['Fechar'], menu: false }), { tom: 't3' });
  }
  var corpo = aprCCapaLarga(p.tom, 3) + '<span class="apr-m-sub">' + esc(p.morada) + '</span>' +
    '<span class="apr-m-selos">' + aprSelo('Arrendado', 'in') + aprSelo('Arrendamento · imóvel inteiro', 'grey') + '</span>' +
    aprCAcoes([aprCChipAcao('Movimentos · 26', 'lista', true), aprCChipAcao('Novo contrato', 'plus'), aprCChipAcao('Registar despesa', 'dn')]) +
    aprCNumeros([['Renda em vigor', aprDinheiro(ct.renda) + '/mês'], ['Yield', pct(ct.renda * 12 / p.valor, 1)]]);
  return aprCena(aprCFicha(p.nome, corpo), { tom: 't2' });
}

/* O texto da ficha, conforme quem a vê.
   Devolve: o HTML do texto. */
function aprCImoveisFichaTexto() {
  if (aprSoColabora()) return 'Na ficha está o que o cargo deixa ver, com a nota de quem é o imóvel e do que podes fazer nele, e os botões dessas ações.';
  return 'Na ficha estão os números, os contratos ou os quartos, as hipotecas e as despesas fixas, e <b>Movimentos</b> leva aos do imóvel. <b>Editar</b> fica no rodapé, e <b>Apagar imóvel</b>, no <b>⋮</b>.';
}

/* Os Imóveis em seleção (cloud/selecao-listas.js, o tipo 'prop'): o
   cabeçalho com a caixa de tudo e a contagem, dois cartões marcados, e a
   barra com o Cancelar e o Apagar.
   Devolve: o HTML da imagem. */
function aprCImoveisSelecao() {
  return aprCena(aprCTelaSel({ cabeca: '2 imóveis', abas: APR_ABAS_CASAS, aba: 'Imóveis', conta: '2 selecionados', acoes: [aprCApagar()],
    corpo: aprCImovelMarcavel('paranhos', true) + aprCImovelMarcavel('campanha', true) + aprCImovelMarcavel('bonfim', false) }),
    { tom: 't3', arranjo: 'tela' });
}

/* O texto da seleção: apagar os meus arrasta os contratos e os movimentos e
   tem o Anular (cloud/selecao-listas.js:selLApagarImoveis); num imóvel onde
   só colaboro, apagar é deixar de colaborar (imovel.js:imvFraseSaida).
   Devolve: o HTML do texto. */
function aprCImoveisSelecaoTexto() {
  var base = 'Segura um cartão, ou toca em <b>Selecionar vários</b>, no cabeçalho, para marcares vários de uma vez. ';
  if (aprSoColabora()) return base + 'Num imóvel onde colaboras, apagar é deixar de colaborar: ele sai da tua lista, e o que registaste fica com o dono.';
  return base + 'Ao apagar, a confirmação diz o que vai junto, os contratos e os movimentos, e o <b>Anular</b> repõe tudo.';
}

/* Adicionar um imóvel: o «Imóvel» à cabeça do «Criar» no telemóvel, o
   «Novo imóvel» do cabeçalho no computador (com os campos do
   imovel.js:propBody e os exemplos deles).
   Devolve: o HTML da imagem. */
function aprCImoveisNovo() {
  return aprCNovo({ rotulo: 'Imóvel', icone: 'building', outros: [['contract', 'Contrato'], ['users', 'Inquilino'], ['door', 'Visita'], ['repetir', 'Movimento recorrente']], tom: 't1',
    id: 'properties', titulo: 'Imóveis', acao: 'Novo imóvel',
    folha: aprFolha('Novo imóvel', aprCampo('Nome', '', { obrigatorio: true, vazio: 'Ex: T2 Lisboa' }) + aprCampo('Morada', ''), { flutua: true }) });
}

/* O texto de adicionar um imóvel, conforme o ecrã, com a dica da pesquisa
   (lista-imoveis.js:vProperties procura também nos contratos de cada um).
   Devolve: o HTML do texto. */
function aprCImoveisNovoTexto() {
  return (aprCLargo() ? '<b>Novo imóvel</b>, no cabeçalho, abre o formulário, e o <b>Criar</b>, na barra lateral, tem o resto.'
    : 'O <b>+</b> da barra de baixo abre o <b>Criar</b>, com <b>Imóvel</b> à cabeça.') +
    ' Dica: a pesquisa também encontra um imóvel pelo nome de quem lá mora.';
}

registarApresentacao('properties', {
  nome: 'Imóveis',
  imagens: [
    { titulo: 'Cada imóvel, um cartão',
      texto: 'Em <b>Casas → Imóveis</b>, cada cartão mostra a capa, o estado, a renda, a yield e a dívida, e os selos do que pede atenção. Por cima, a pesquisa e o funil dos filtros.',
      maquete: aprCImoveisLista },
    { titulo: 'A ficha do imóvel', texto: aprCImoveisFichaTexto, maquete: aprCImoveisFicha },
    { titulo: 'Segura para escolher vários', texto: aprCImoveisSelecaoTexto, maquete: aprCImoveisSelecao },
    { titulo: 'Adicionar um imóvel', texto: aprCImoveisNovoTexto, maquete: aprCImoveisNovo,
      quando: function () { return aprPodeCriar('properties'); } },
  ],
});

/* ---------------------------------------------------------------- Grupos */

/* O separador dos Grupos (definicoes.js:vGrupos): o que os grupos são, o
   segmentado dos tipos com quantos há de cada, e os cartões — o privado com
   o «Partilhar» e, a quem pode partilhar, o partilhado.
   Devolve: o HTML da imagem. */
function aprCGruposLista() {
  var gs = aprCExemplo.grupos, parte = aprCPartilhaGrupos(), n = parte ? 2 : 1;
  return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Grupos',
    corpo: '<p class="apr-m-sub apr-c-intro">Servem de filtro em toda a app. Um movimento lançado num grupo de imóveis divide-se por eles.</p>' +
      aprSegmentado(['Imóveis ' + n, 'Proprietários 0', 'Contratos 0'], 'Imóveis ' + n) + aprCCartaoGrupo(gs[0]) + (parte ? aprCCartaoGrupo(gs[1]) : '') }),
    { tom: 't0', arranjo: 'tela' });
}

/* Tocar num grupo abre-o (definicoes.js:groupModal): o nome e os membros,
   os dois obrigatórios, na janela com o Guardar.
   Devolve: o HTML da imagem. */
function aprCGruposAbrir() {
  var g = aprCExemplo.grupos[0];
  return aprCena(aprPar(aprCCartaoGrupo(g, { alvo: true }),
    aprCFicha('Editar grupo', aprCampo('Nome do grupo', g.nome, { obrigatorio: true }) +
      '<span class="apr-m-rot">Imóveis no grupo<span class="apr-m-req">*</span></span>' + aprCEtiquetas(aprCNomesDoGrupo(g)), { rodape: ['Cancelar', 'Guardar'] })),
    { tom: 't2', arranjo: 'par' });
}

/* O texto de abrir um grupo, com o segurar e o criar — no + do telemóvel,
   já do tipo à vista (acessos.js:acaoNaturalDoEcra), ou no botão do
   cabeçalho do computador, que diz o tipo.
   Devolve: o HTML do texto. */
function aprCGruposAbrirTexto() {
  var k = typeof GKIND !== 'undefined' && typeof grpTipo !== 'undefined' && GKIND[grpTipo] ? GKIND[grpTipo].label.toLowerCase() : 'imóveis';
  return 'Tocar num grupo abre-o, para mudares o nome e os membros; segurar marca vários, para os apagares de uma vez. ' +
    (aprCLargo() ? 'Um grupo novo nasce em <b>Novo grupo de ' + esc(k) + '</b>, no cabeçalho.' : 'Um grupo novo nasce no <b>+</b>, já do tipo à vista.');
}

/* Um grupo partilhado, como o dono o vê (cloud/grupos.js:
   cartaoDoGrupoPartilhado): o pedido de quem quer entrar, com o Aceitar e o
   Recusar, e a ligação de convite com o Copiar, o Rodar e o Desativar.
   Devolve: o HTML da imagem. */
function aprCGruposPartilhar() {
  var corpo = '<span class="apr-c-parte apr-c-pedido"><b>Duarte Pinto quer entrar</b><span class="apr-m-sub">Se aceitares, passa a comproprietário dos imóveis do grupo.</span>' +
      '<span class="apr-c-botoes">' + aprBotao('Aceitar', { primario: true, pequeno: true, alvo: true }) + aprBotao('Recusar', { pequeno: true }) + '</span></span>' +
    '<span class="apr-c-parte"><span class="apr-m-rot apr-m-maiusc">Ligação de convite</span><span class="apr-m-sub">expira a ' + esc(aprData(aprDia(5))) + ' · usada 1 vez</span>' +
      '<span class="apr-c-botoes">' + aprBotao('Copiar', { pequeno: true }) + aprBotao('Rodar', { pequeno: true }) + '<span class="apr-m-botao pequeno apr-c-perigo-txt">Desativar</span></span></span>';
  return aprCena(aprColuna([aprCCartaoGrupo(aprCExemplo.grupos[1], { corpo: corpo, flutua: true })]), { tom: 't1', arranjo: 'coluna' });
}

/* A dica: um grupo de imóveis no filtro do imóvel dos Movimentos
   (componentes.js:gOpts, «Grupo · …»), com o chip ligado e os movimentos dos
   imóveis dele.
   Devolve: o HTML da imagem. */
function aprCGruposFiltro() {
  var ex = APR_EXEMPLO, g = aprCExemplo.grupos[0], m = ex.contrato('c4'), t = ex.contrato('c5'), c = ex.imovel('cedofeita');
  var linha = function (titulo, sub, v) { return aprLinha({ titulo: titulo, sub: sub, valor: aprDinheiro(v), tom: v < 0 ? 'neg' : 'pos' }); };
  return aprCena(aprColuna([aprAbas(APR_ABAS_DINHEIRO, 'Movimentos'),
    aprCChips([aprCChip('Período'), aprCChip('Grupo · ' + g.nome, { on: true, alvo: true })]),
    aprCartao(linha('Renda ' + m.inquilino, ex.imovel('paranhos').nome + ' · ' + aprData(aprCUltimo(m.dia)), m.renda) +
      linha('Renda ' + t.inquilino, ex.imovel('campanha').nome + ' · ' + aprData(aprCUltimo(t.dia)), t.renda) +
      linha('Condomínio', c.nome + ' · ' + aprData(aprCUltimo(1)), -c.condominio), { flutua: true })]),
    { tom: 't3', arranjo: 'coluna' });
}

registarApresentacao('groups', {
  nome: 'Grupos',
  imagens: [
    { titulo: 'Imóveis em conjunto',
      texto: 'Em <b>Casas → Grupos</b> juntas imóveis, proprietários ou contratos, e o tipo escolhe-se por cima. Um grupo serve de filtro em toda a app, e uma despesa lançada num grupo de imóveis divide-se por eles.',
      maquete: aprCGruposLista },
    { titulo: 'Um toque abre o grupo', texto: aprCGruposAbrirTexto, maquete: aprCGruposAbrir },
    { titulo: 'Partilhar um grupo',
      texto: 'Um grupo de imóveis partilha-se por uma ligação de convite: quem a abre pede para entrar, e só entra quando aceitares. Quem entra fica com a compropriedade de todos os imóveis do grupo, e partilhar é para sempre.',
      maquete: aprCGruposPartilhar, quando: aprCPartilhaGrupos },
    { titulo: 'Dica: um grupo no filtro',
      texto: 'No filtro do imóvel, nos <b>Movimentos</b> e na <b>Visão geral</b>, cada grupo de imóveis aparece como «Grupo&nbsp;·&nbsp;Porto centro» e mostra os imóveis dele todos de uma vez.',
      maquete: aprCGruposFiltro, quando: function () { return servicoLigado('transactions'); } },
  ],
});

/* ------------------------------------------------------------- Contratos */

/* A lista dos Contratos (lista-contratos.js:vContracts): por imóvel, com o
   que ele é e a renda do mês; o contrato da Inês Costa com o prazo do fim a
   âmbar, e o do Tomás Matos com o bloco dos por confirmar por baixo
   (cloud/painel.js:decoratePending) e o Confirmar em destaque.
   Devolve: o HTML da imagem. */
function aprCContratosLista() {
  var ex = APR_EXEMPLO, b = ex.imovel('bonfim'), ines = ex.contrato('c3'), tomas = ex.contrato('c2'), fim = aprDia(ines.terminaEm);
  return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Contratos',
    corpo: aprCGrupoContrato(b.nome, 'por quartos · 3/4', ex.rendaDe('bonfim')) +
      aprCartao(aprCLinhaContrato({ quem: tomas.inquilino, parte: tomas.parte, periodo: 'até ' + tomas.ate, renda: tomas.renda }) +
        // o bloco dos por confirmar é dos Planeados: sem eles, não se pendura
        (servicoLigado('recurring') ? aprCPorConfirmar('Renda ' + tomas.inquilino + ' · ' + tomas.parte, b.nome + ' · ' + aprData(aprCUltimo(tomas.dia)), aprDinheiro(tomas.renda)) : '') +
        aprCLinhaContrato({ quem: ines.inquilino, parte: ines.parte, periodo: 'até ' + dPT(fim), renda: ines.renda, selos: [['Termina a ' + aprData(fim), 'amber']] })) }),
    { tom: 't2', arranjo: 'tela' });
}

/* O texto da lista dos contratos: a renda por confirmar só com os Planeados.
   Devolve: o HTML do texto. */
function aprCContratosListaTexto() {
  return 'Em <b>Casas → Contratos</b>, cada imóvel junta os seus contratos, com a renda do mês. Os selos avisam dos prazos' +
    (servicoLigado('recurring') ? ', e uma renda por confirmar fica logo por baixo, com o <b>Confirmar</b>.' : '.');
}

/* Os três estados (registos.js:ctEstado): o chip do estado aberto, com
   quantos há em cada um (lista-contratos.js:ctCampoEstado), e um contrato
   de cada, com o selo da cor dele (lista-contratos.js:ctSeloDoEstado).
   Devolve: o HTML da imagem. */
function aprCContratosEstados() {
  var ex = APR_EXEMPLO, m = ex.contrato('c4'), t = aprCExemplo.terminado, r = aprCExemplo.porComecar, c = ex.imovel('cedofeita'), n = aprCExemplo.nContratos;
  var linha = function (quem, sub, selo) { return aprLinha({ titulo: quem, sub: sub, botao: aprSelo(selo[0], selo[1]) }); };
  return aprCena(aprColuna([
    aprCChips([aprCChip('Estado', { alvo: true }), aprCChip('Imóvel')]),
    aprCMenu([['Todos os estados · ' + n.todos, true], ['Em vigor · ' + n.vigor], ['Por começar · ' + n.comecar], ['Terminados · ' + n.terminados]]),
    aprCartao(linha(m.inquilino, ex.imovel('paranhos').nome + ' · até ' + m.ate, ['Em vigor', 'in']) +
      linha(r.inquilino, c.nome + ' · começa a ' + dPT(aprProximoDia(1)), ['Por começar', '']) +
      linha(t.inquilino, c.nome + ' · terminou a ' + dPT(aprCFimDeAgosto()), ['Terminado', 'grey']), { flutua: true }),
  ]), { tom: 't1', arranjo: 'coluna' });
}

/* A ficha de um contrato (contrato.js:ctView, contrato.js:ctFicha): o
   estado, o imóvel, o prazo com a barra, a renda, o imposto e a líquida, e
   o dia do pagamento; o Editar a quem pode alterar.
   Devolve: o HTML da imagem. */
function aprCContratosFicha() {
  var ex = APR_EXEMPLO, m = ex.contrato('c4'), p = ex.imovel('paranhos');
  var corpo = '<span class="apr-m-selos">' + aprSelo('Em vigor', 'in') + '</span><b class="apr-c-onde">' + esc(p.nome) + '</b>' +
    aprCPrazo(aprCIso(m.desde), aprCIso(m.ate)) +
    aprCNumeros([['Renda', aprDinheiro(m.renda)], ['Imposto', '10%', 'renda moderada'], ['Líquida', aprDinheiro(m.renda * 0.9)]]) +
    aprCKv('Pagamento', 'no dia ' + m.dia);
  return aprCena(aprCFicha(m.inquilino, corpo, { rodape: ['Fechar', aprPodeCriar('contracts', 'contract.add') ? 'Editar' : ''] }), { tom: 't0' });
}

/* O texto da ficha, conforme quem a vê: o Editar e o resto do ⋮ (renovar,
   terminar, o PDF) a quem pode alterar; o PDF, que está sempre lá, a quem
   não pode.
   Devolve: o HTML do texto. */
function aprCContratosFichaTexto() {
  return 'Na ficha está quanto falta do prazo, a renda e o que fica líquido, os inquilinos e como está perante a AT. ' +
    (aprPodeCriar('contracts', 'contract.add') ? '<b>Editar</b> fica no rodapé; renovar, terminar e o contrato em PDF, no <b>⋮</b>.' : 'O contrato em PDF está no <b>⋮</b>.');
}

/* Um contrato novo: o «Contrato» à cabeça do «Criar» no telemóvel, o «Novo
   contrato» do cabeçalho no computador (com os campos do
   contrato.js:ctBody).
   Devolve: o HTML da imagem. */
function aprCContratosNovo() {
  var r = aprCExemplo.porComecar, c = APR_EXEMPLO.imovel(r.imovel);
  return aprCNovo({ rotulo: 'Contrato', icone: 'contract', outros: [['building', 'Imóvel'], ['users', 'Inquilino'], ['door', 'Visita'], ['repetir', 'Movimento recorrente']], tom: 't3',
    id: 'contracts', titulo: 'Contratos', acao: 'Novo contrato',
    folha: aprFolha('Novo contrato', aprCampo('Imóvel', c.nome, { obrigatorio: true }) +
      '<span class="apr-m-grelha apr-c-grelha-par">' + aprCampo('Renda mensal (€)', dec(r.renda.toFixed(2)), { obrigatorio: true }) + aprCampo('Início', dPT(aprProximoDia(1))) + '</span>', { flutua: true }) });
}

/* O texto de um contrato novo, conforme o ecrã e se já há imóveis onde o
   criar (sem nenhum, o «Criar» não o oferece: acessos.js:ACOES_DE_ADICIONAR),
   com a seleção — apagar deixa os movimentos, só sem a ligação
   (lista-contratos.js:ctRodapeDaLista).
   Devolve: o HTML do texto. */
function aprCContratosNovoTexto() {
  if (!aprCComCasas('contract.add')) {
    return 'Um contrato liga um imóvel aos inquilinos: cria primeiro o imóvel, em <b>Casas → Imóveis</b>, e o ' +
      (aprCLargo() ? '<b>Novo contrato</b> passa a estar no cabeçalho.' : '<b>Contrato</b> passa a estar no <b>+</b>.');
  }
  return (aprCLargo() ? '<b>Novo contrato</b>, no cabeçalho, abre o formulário' : 'No <b>+</b> da barra de baixo, <b>Contrato</b> vem à cabeça') +
    (servicoLigado('recurring') ? '; ao guardares, a renda de cada mês fica planeada.' : '.') +
    ' Para apagar vários, segura um: os movimentos ficam, só perdem a ligação ao contrato.';
}

registarApresentacao('contracts', {
  nome: 'Contratos',
  imagens: [
    { titulo: 'Os contratos, por imóvel', texto: aprCContratosListaTexto, maquete: aprCContratosLista },
    { titulo: 'Os três estados de um contrato',
      texto: 'Um contrato está em vigor, por começar ou terminado, e o chip <b>Estado</b> filtra cada um, com quantos há. Com <b>Em vigor</b>, a lista diz também que imóveis estão sem contrato.',
      maquete: aprCContratosEstados },
    { titulo: 'A ficha do contrato', texto: aprCContratosFichaTexto, maquete: aprCContratosFicha },
    { titulo: 'Um contrato novo', texto: aprCContratosNovoTexto, maquete: aprCContratosNovo,
      quando: function () { return aprPodeCriar('contracts', 'contract.add'); } },
  ],
});

/* ------------------------------------------------------------ Inquilinos */

/* A lista dos Inquilinos (lista-pessoas.js:vTenants): o segmentado das
   Pessoas, a pesquisa com o funil e o chip do contrato, e uma linha por
   pessoa (lista-pessoas.js:personCard) — onde mora, a renda, a renda em
   atraso, o contrato por começar.
   Devolve: o HTML da imagem. */
function aprCInquilinosLista() {
  var r = aprCExemplo.porComecar;
  return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Pessoas',
    corpo: aprCAbasPessoas('Inquilinos') + aprPesquisa() + aprCChips([aprCChip('Contrato')]) + aprSecao('Os meus inquilinos', aprCExemplo.nInquilinos) +
      aprCartao(aprCLinhaPessoa({ nome: 'Tomás Matos', sub: 'T3 Bonfim · Quarto 2', selos: [['Renda em atraso', 'red']], valor: money(350) }) +
        aprCLinhaPessoa({ nome: r.inquilino, sub: 'Vai morar em ' + APR_EXEMPLO.imovel(r.imovel).nome + ' a partir de ' + dPT(aprProximoDia(1)), selos: [['Por começar']] }) +
        aprCLinhaPessoa({ nome: 'Marta Sousa', sub: 'Mora em T2 Paranhos', valor: money(950) })) }),
    { tom: 't2', arranjo: 'tela' });
}

/* A ficha de um inquilino (pessoas.js:pesFichaInquilino): o avatar com o
   selo do contrato, o «Ver contrato» e o «Novo contrato», onde mora e os
   contactos, que tocam; o Editar a quem pode.
   Devolve: o HTML da imagem. */
function aprCInquilinosFicha() {
  var ex = APR_EXEMPLO, s = ex.inquilino('sousa'), ct = ex.contrato('c4'), pode = aprPodeCriar('tenants', 'tenant.add');
  var corpo = '<span class="apr-m-ficha">' + aprAvatar(s.nome) + '<span><span class="apr-m-sub">Inquilino</span>' + aprSelo('Com contrato em vigor', 'in') + '</span></span>' +
    aprCAcoes([aprCChipAcao('Ver contrato', 'contract'), aprCChipAcao('Novo contrato', 'plus')]) +
    aprCartao(aprLinha({ titulo: 'Mora em ' + ex.imovel('paranhos').nome, sub: 'desde ' + ct.desde, valor: aprDinheiro(ct.renda) + '/mês', seta: true }) +
      aprCKv('Telemóvel', aprCExemplo.telefone, true) + aprCKv('Email', s.email, true));
  return aprCena(aprCFicha(s.nome, corpo, { rodape: ['Fechar', pode ? 'Editar' : ''] }), { tom: 't1' });
}

/* Os Inquilinos em seleção (cloud/selecao-listas.js, o tipo 'ten'): a caixa
   à cabeça de cada linha, duas fichas marcadas — a de quem já saiu e a de
   quem nunca teve contrato — e a barra com o Apagar.
   Devolve: o HTML da imagem. */
function aprCInquilinosSelecao() {
  var t = aprCExemplo.terminado;
  return aprCena(aprCTelaSel({ cabeca: '2 inquilinos', abas: APR_ABAS_CASAS, aba: 'Pessoas', conta: '2 selecionados', acoes: [aprCApagar()],
    corpo: aprCAbasPessoas('Inquilinos') +
      aprCartao(aprCLinhaPessoa({ nome: t.inquilino, sub: 'Morou em ' + APR_EXEMPLO.imovel(t.imovel).nome + ' até ' + dPT(aprCFimDeAgosto()), apagado: true, caixa: true }) +
        aprCLinhaPessoa({ nome: 'Ana Ribeiro', sub: 'T3 Bonfim · Quarto 1', valor: money(350), caixa: false }) +
        aprCLinhaPessoa({ nome: aprCExemplo.semContrato.inquilino, sub: 'Sem contrato', apagado: true, caixa: true }) +
        aprCLinhaPessoa({ nome: 'Marta Sousa', sub: 'Mora em T2 Paranhos', valor: money(950), caixa: false })) }),
    { tom: 't0', arranjo: 'tela' });
}

/* O texto da seleção e de um inquilino novo, conforme o ecrã: só o nome é
   obrigatório (pessoas.js:personModal).
   Devolve: o HTML do texto. */
function aprCInquilinosSelecaoTexto() {
  return 'Segura uma linha para marcares vários inquilinos e os apagares de uma vez. Um inquilino novo começa ' +
    (aprCLargo() ? 'em <b>Novo inquilino</b>, no cabeçalho' : 'no <b>+</b> da barra de baixo') + ', e só o nome é obrigatório.';
}

registarApresentacao('tenants', {
  nome: 'Inquilinos',
  imagens: [
    { titulo: 'Uma linha por pessoa',
      texto: 'Em <b>Casas → Pessoas → Inquilinos</b>, cada linha diz onde a pessoa mora, a renda e o que pede atenção, como uma renda em atraso. O chip <b>Contrato</b> separa quem tem contrato de quem vai ter ou não tem.',
      maquete: aprCInquilinosLista },
    { titulo: 'A ficha da pessoa',
      texto: 'Na ficha estão a casa, os contactos, que tocam para ligar ou escrever, a identificação e os documentos. A ficha guarda só a pessoa: a renda e as datas ficam no contrato.',
      maquete: aprCInquilinosFicha },
    { titulo: 'Vários de uma vez, ou um novo', texto: aprCInquilinosSelecaoTexto, maquete: aprCInquilinosSelecao,
      quando: function () { return aprPodeCriar('tenants', 'tenant.add'); } },
  ],
});

/* --------------------------------------------------------- Proprietários */

/* A lista dos Proprietários (lista-pessoas.js:vOwners): o segmentado das
   Pessoas, a pesquisa e o chip dos imóveis, a conta com quem partilho — as
   casas em comum e a renda que lhe cabe (pessoas.js:pesRendaDoDono) — e,
   por baixo, o começo da partilha entre contas.
   Devolve: o HTML da imagem. */
function aprCDonosLista() {
  var h = APR_EXEMPLO.proprietarios[0], b = APR_EXEMPLO.imovel('bonfim');
  return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Pessoas',
    corpo: aprCAbasPessoas('Proprietários') + aprPesquisa() + aprCChips([aprCChip('Imóveis')]) +
      aprCartao(aprCLinhaPessoa({ nome: h.nome, sub: b.nome, valor: money(APR_EXEMPLO.rendaDe('bonfim') * h.quota / 100) })) +
      '<b class="apr-c-titulo">Partilhar com outras contas</b><span class="apr-m-sub apr-c-intro">Partilhar uma casa dá acesso a tudo o que ela tem: contratos, movimentos e pessoas.</span>' }),
    { tom: 't3', arranjo: 'tela' });
}

/* Ligar-se a outra conta (cloud/partilha.js:comproprietariosCorpo): o id
   desta conta com o Copiar em destaque, o campo do id do outro com o
   Ligar, e a ligação de partilha.
   Devolve: o HTML da imagem. */
function aprCDonosLigar() {
  return aprCena(aprColuna([
    aprCartao('<span class="apr-c-meuid"><span><span class="apr-m-sub">O teu id</span><b>' + esc(aprCMeuId()) + '</b></span>' + aprBotao('Copiar', { pequeno: true, alvo: true }) + '</span>' +
      '<span class="apr-c-ligar">' + aprCampo('O id do outro utilizador', '', { obrigatorio: true, vazio: 'Ex: A7KQ2MPX' }) + aprBotao('Ligar', { primario: true, pequeno: true }) + '</span>' +
      '<span class="apr-m-sub">Depois de aceite, cada um escolhe que casas partilha.</span>', { flutua: true }),
    aprCartao('<span class="apr-m-cartao-cab"><b>A minha ligação de partilha</b>' + aprSelo('Sem ligação', 'grey') + '</span>' +
      '<span class="apr-c-botoes">' + aprBotao('Criar ligação', { primario: true, pequeno: true, icone: 'key' }) + '</span>'),
  ]), { tom: 't0', arranjo: 'coluna' });
}

/* A ficha de outro proprietário com conta (pessoas.js:pesFichaDono): o
   selo da conta, as contas entre proprietários, os imóveis com a quota e a
   renda que lhe cabe; no rodapé, «Editar casas partilhadas»
   (pessoas.js:casasPartilhadasDaFicha), e o ⋮ do «Remover ligação» — os dois
   da partilha entre contas, do serviço Colaboradores.
   Devolve: o HTML da imagem. */
function aprCDonosFicha() {
  var h = APR_EXEMPLO.proprietarios[0], b = APR_EXEMPLO.imovel('bonfim'), parte = APR_EXEMPLO.rendaDe('bonfim') * h.quota / 100;
  var partilha = servicoLigado('colaboradores');
  var corpo = '<span class="apr-m-ficha">' + aprAvatar(h.nome) + '<span><span class="apr-m-sub">Proprietário</span>' + aprSelo('Tem conta Rendorium') + '</span></span>' +
    aprCartao('<span class="apr-c-contas"><b>Contas entre proprietários</b><b class="apr-m-valor pos">Em dia</b></span>') +
    aprCCartaoTit('Imóveis e quota-parte', aprLinha({ titulo: b.nome, valor: h.quota + '%', seta: true }) + aprCKv('Renda que lhe cabe', aprDinheiro(parte) + '/mês'), { nota: '1' });
  return aprCena(aprCFicha(h.nome, corpo, { rodape: ['Fechar', partilha ? 'Editar casas partilhadas' : ''], menu: partilha, alvoRodape: partilha }), { tom: 't2' });
}

/* O texto da ficha: com a partilha entre contas, o que o rodapé e o ⋮ fazem.
   Devolve: o HTML do texto. */
function aprCDonosFichaTexto() {
  var base = 'Na ficha estão as casas em comum, com as quotas, e as contas entre proprietários.';
  return servicoLigado('colaboradores')
    ? base + ' Em <b>Editar casas partilhadas</b>, no rodapé, adicionas e removes casas e propões as quotas; no <b>⋮</b>, <b>Remover ligação</b>.'
    : base;
}

registarApresentacao('owners', {
  nome: 'Proprietários',
  imagens: [
    { titulo: 'As contas com quem partilhas',
      texto: 'Em <b>Casas → Pessoas → Proprietários</b> estão as contas Rendorium com quem partilhas casas: as casas em comum e a parte da renda de cada uma. Não se criam à mão: a lista enche-se quando te ligas a outra conta.',
      maquete: aprCDonosLista },
    { titulo: 'Ligar-te a outra conta',
      texto: 'Por baixo da lista, em <b>Partilhar com outras contas</b>, dás o teu id (o <b>Copiar</b> copia-o) e escreves o do outro utilizador. Depois de aceite, cada um escolhe que casas partilha.',
      maquete: aprCDonosLigar, quando: function () { return !!(window.CW && CW.user) && servicoLigado('colaboradores'); } },
    { titulo: 'A ficha de cada conta', texto: aprCDonosFichaTexto, maquete: aprCDonosFicha },
  ],
});

/* --------------------------------------------------------- Colaboradores */

/* O começo do separador dos Colaboradores (cloud/colaboradores.js:
   paginaDosColaboradores): a quem tem imóveis, o que um colaborador é, o
   «Convidar colaborador» e «Quem colabora», com o cargo, o Mudar e o
   Remover; a quem só colabora, os imóveis onde colabora
   (cloud/colaboradores.js:colaboroCartao), que lhe vêm primeiro.
   Devolve: o HTML da imagem. */
function aprCColabQuem() {
  var cab = aprCAbasPessoas('Colaboradores');
  if (aprSoColabora()) {
    return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Pessoas',
      corpo: cab + '<b class="apr-c-titulo">Onde colaboras</b>' + aprCColaborasCom({ alvo: true }) }), { tom: 't1', arranjo: 'tela' });
  }
  var q = aprCExemplo.quemColabora, nomes = q.imoveis.map(function (id) { return APR_EXEMPLO.imovel(id).nome; }).join(' · ');
  return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Pessoas',
    corpo: cab + '<p class="apr-m-sub apr-c-intro">Quem te ajuda a gerir, sem ser dono: vê e faz só o que o cargo deixa, nos imóveis que escolheres.</p>' +
      '<span class="apr-c-largo">' + aprBotao('Convidar colaborador', { primario: true, icone: 'pessoaMais' }) + '</span>' +
      aprCCartaoTit('Quem colabora', aprLinha({ avatar: q.nome, titulo: q.nome, sub: nomes, botao: aprSelo(q.cargo) }) +
        '<span class="apr-c-botoes">' + aprBotao('Mudar', { pequeno: true }) + aprBotao('Remover', { pequeno: true }) + '</span>') }),
    { tom: 't1', arranjo: 'tela' });
}

/* O título da primeira imagem, conforme quem a vê.
   Devolve: o texto. */
function aprCColabQuemTitulo() { return aprSoColabora() ? 'Onde colaboras' : 'Quem te ajuda a gerir'; }

/* O texto da primeira imagem: o que um colaborador é, ou, a quem só
   colabora, o que o cartão dele diz e o «Deixar de colaborar».
   Devolve: o HTML do texto. */
function aprCColabQuemTexto() {
  if (aprSoColabora()) return 'Em <b>Casas → Pessoas → Colaboradores</b> vês com quem colaboras, o cargo e o que ele te deixa fazer. <b>Deixar de colaborar</b> sai desses imóveis, e o que registaste fica com o dono.';
  return 'Em <b>Casas → Pessoas → Colaboradores</b> estão as pessoas que te ajudam a gerir sem serem donas: veem e fazem só o que o cargo deixa, nos imóveis que escolheres, sem quota-parte.';
}

/* Os cargos (cloud/colaboradores.js:cargosTabelaCard): um cargo com quantas
   pessoas o têm, o resumo e a tabela das permissões; a quem só colabora, os
   imóveis onde colabora na lista dos Imóveis, na secção deles, com o selo
   de quem é e do cargo e o que ele deixa fazer (lista-imoveis.js:imvCartao).
   Devolve: o HTML da imagem. */
function aprCColabCargos() {
  var c = aprCExemplo.colaborasCom;
  if (aprSoColabora()) {
    var p = APR_EXEMPLO.imovel('cedofeita');
    return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Imóveis',
      corpo: aprPesquisa() + aprSecao('Em que colaboro', 1) +
        aprCartao('<span class="apr-c-colab-imv">' + aprCapa(p.tom) + '<span class="apr-m-linha-txt"><b>' + esc(c.casa) + '</b><span class="apr-m-sub">Rua da Senhora da Luz, Porto</span>' +
          '<span class="apr-m-selos">' + aprSelo('de ' + c.dono + ' · ' + c.cargo, 'grey') + '</span><span class="apr-m-sub">Podes marcar visitas e adicionar inquilinos</span></span></span>', { alvo: true }) }),
      { tom: 't0', arranjo: 'tela' });
  }
  return aprCena(aprColuna([aprCartao('<span class="apr-m-cartao-cab"><b>Cargos</b>' + aprBotao('Novo cargo', { pequeno: true, icone: 'plus' }) + '</span>' +
    '<span class="apr-c-cargo"><span class="apr-m-linha-txt"><b>' + esc(aprCExemplo.quemColabora.cargo) + '</b><span class="apr-m-sub">1 pessoa · ' +
      esc(aprCResumoDoCargo('Gestor de visitas', 'Adiciona visitas, inquilinos')) + '</span></span>' + aprBotao('Editar', { pequeno: true }) + '</span>' +
    aprCPermissoes([['Movimentos', false, false], ['Visitas', true, true], ['Contratos', false, false], ['Inquilinos', true, true]]), { flutua: true })]),
    { tom: 't0', arranjo: 'coluna' });
}

/* O título da segunda imagem, conforme quem a vê.
   Devolve: o texto. */
function aprCColabCargosTitulo() { return aprSoColabora() ? 'Os imóveis onde colaboras' : 'O cargo diz o que se pode'; }

/* O texto da segunda imagem: o cargo e os três prontos (acessos.js:
   CARGOS_EXEMPLO, no «Novo cargo»: cloud/colaboradores.js:CW.cargoModal),
   ou, a quem só colabora, onde estão os imóveis.
   Devolve: o HTML do texto. */
function aprCColabCargosTexto() {
  if (aprSoColabora()) return 'Estão em <b>Casas → Imóveis</b>, na secção <b>Em que colaboro</b>, e cada cartão e cada ficha dizem o que o cargo te deixa fazer.';
  return 'Um cargo diz o que a pessoa vê e o que pode adicionar, coisa a coisa. Num cargo novo há três prontos para começar: Gestor de visitas, Contabilista e Ver tudo.';
}

/* Convidar (cloud/colaboradores.js:CW.conviteModal, corpoDoConvite): o
   cargo, os imóveis marcados, e o «Criar ligação de convite» no rodapé.
   Devolve: o HTML da imagem. */
function aprCColabConvidar() {
  var ex = APR_EXEMPLO;
  var corpo = '<span class="apr-m-rot">Cargo<span class="apr-m-req">*</span></span>' +
    aprCOpcao('Gestor de visitas', aprCResumoDoCargo('Gestor de visitas', 'Adiciona visitas, inquilinos'), true) +
    '<span class="apr-m-rot">Imóveis<span class="apr-m-req">*</span></span>' +
    '<span class="apr-c-casas">' + aprCCasaMarcavel(ex.imovel('bonfim'), true) + aprCCasaMarcavel(ex.imovel('cedofeita'), true) + aprCCasaMarcavel(ex.imovel('paranhos'), false) + '</span>';
  return aprCena(aprCFicha('Convidar colaborador', corpo, { rodape: ['Cancelar', 'Criar ligação de convite'], menu: false, alvoRodape: true }), { tom: 't2' });
}

/* Onde és tu a colaborar, a quem também tem imóveis seus: o cartão de
   «Onde colaboras», no fim da página (cloud/colaboradores.js:colaboroCartao).
   Devolve: o HTML da imagem. */
function aprCColabOnde() {
  return aprCena(aprColuna(['<b class="apr-c-titulo">Onde colaboras</b>', aprCColaborasCom({ alvo: true }),
    '<span class="apr-m-sub apr-c-intro">Não tens quota-parte nestes imóveis nem entras nas contas entre proprietários.</span>']), { tom: 't3', arranjo: 'coluna' });
}

/* Esta conta colabora nalgum imóvel de outra pessoa (os imóveis com cargo)?
   Devolve: true/false. */
function aprCColaboro() {
  return typeof db !== 'undefined' && !!db && (db.properties || []).some(function (p) { return !!p._cargo; });
}

registarApresentacao('colaboradores', {
  nome: 'Colaboradores',
  imagens: [
    { titulo: aprCColabQuemTitulo, texto: aprCColabQuemTexto, maquete: aprCColabQuem },
    { titulo: aprCColabCargosTitulo, texto: aprCColabCargosTexto, maquete: aprCColabCargos },
    { titulo: 'Convidar com uma ligação',
      texto: '<b>Convidar colaborador</b> cria uma ligação de uso único, que vale 7 dias: escolhes o cargo e os imóveis, e envias. As que esperam ficam em <b>Convites por usar</b>, onde as revogas.',
      maquete: aprCColabConvidar, quando: function () { return !aprSoColabora(); } },
    { titulo: 'Onde és tu a colaborar',
      texto: 'Os imóveis onde és tu quem colabora ficam em <b>Onde colaboras</b>, no fim da página, com o cargo e o que ele deixa fazer. <b>Deixar de colaborar</b> sai deles, e o que registaste fica com o dono.',
      maquete: aprCColabOnde, quando: function () { return !aprSoColabora() && aprCColaboro(); } },
  ],
});

/* --------------------------------------------------------------- Visitas */

/* A lista das Visitas (visitas.js:vVisits): a pesquisa com o funil, os
   chips do imóvel, do estado e do desfecho, e as Próximas e as Passadas,
   cada visita com o bloco do dia e os selos (visitas.js:visCard).
   Devolve: o HTML da imagem. */
function aprCVisitasLista() {
  var vs = aprCExemplo.visitas;
  return aprCena(aprTela({ titulo: 'Casas', abas: APR_ABAS_CASAS, aba: 'Visitas',
    corpo: aprPesquisa() + aprCChips([aprCChip('Imóvel'), aprCChip('Estado'), aprCChip('Desfecho')]) + aprSecao('As minhas visitas', vs.length) +
      aprCSubSecao('Próximas', 2) + aprCartao(aprCLinhaVisita(vs[0]) + aprCLinhaVisita(vs[1])) +
      aprCSubSecao('Passadas', 2) + aprCartao(aprCLinhaVisita(vs[2]) + aprCLinhaVisita(vs[3])) }),
    { tom: 't1', arranjo: 'tela' });
}

/* Quem pode converter uma visita em inquilino (o critério do
   visitas.js:visFicha: os Inquilinos ligados e «Adicionar inquilinos»).
   Devolve: true/false. */
function aprCConverte() { return aprPodeCriar('tenants', 'tenant.add'); }

/* A ficha de uma visita (visitas.js:visFicha): quando, por extenso, os
   selos do estado e do desfecho, o convite a converter em inquilino (a quem
   pode), o imóvel e o contacto, que liga; o Editar a quem pode alterar.
   Devolve: o HTML da imagem. */
function aprCVisitasFicha() {
  var v = aprCExemplo.visitas[2], iso = aprDia(v.dia), conv = aprCConverte();
  var quando = [aprCDiaDaSemana(iso), dPT(iso)].filter(Boolean).join(', ') + ' · ' + v.inicio + ' · há ' + (-v.dia) + ' dias';
  var corpo = '<span class="apr-c-quando">' + esc(quando) + '</span><span class="apr-m-selos">' + aprCSelosVisita(v) + '</span>' +
    (conv ? '<span class="apr-c-converte"><b>Há interesse em arrendar.</b>' +
      aprBotao('Converter em inquilino', { primario: true, pequeno: true, icone: 'pessoaMais', alvo: true }) + '</span>' : '') +
    aprCartao(aprCKv('Imóvel', 'T3 Bonfim') + aprCKv('Contacto', v.contacto, true)) +
    (conv ? '' : aprCCartaoTit('Comentários', '<span class="apr-c-frase">Quer entrar no início do mês.</span>'));
  return aprCena(aprCFicha(v.nomes, corpo, { rodape: ['Fechar', aprPodeCriar('visits', 'visit.add') ? 'Editar' : ''] }), { tom: 't3' });
}

/* O texto da ficha, com o converter a quem pode.
   Devolve: o HTML do texto. */
function aprCVisitasFichaTexto() {
  return aprCConverte()
    ? 'Na ficha estão o dia por extenso, o contacto, que liga ou escreve, e os comentários. Numa visita com interesse, <b>Converter em inquilino</b> cria a ficha da pessoa, e o contrato já a encontra.'
    : 'Na ficha estão o dia por extenso, o imóvel, o contacto, que liga ou escreve, e os comentários.';
}

/* As Visitas em seleção (cloud/selecao-listas.js, o tipo 'vis'): as duas
   que vêm marcadas, e a barra com o Realizada, o Falta e o Apagar
   (cloud/selecao-listas.js:selLBarraHtml).
   Devolve: o HTML da imagem. */
function aprCVisitasSelecao() {
  var vs = aprCExemplo.visitas;
  return aprCena(aprCTelaSel({ cabeca: '2 visitas', abas: APR_ABAS_CASAS, aba: 'Visitas', conta: '2 selecionadas',
    acoes: [aprBotao('Realizada', { pequeno: true, icone: 'check' }), aprBotao('Falta', { pequeno: true, icone: 'x' }), aprCApagar()],
    corpo: aprSecao('As minhas visitas', vs.length) + aprCSubSecao('Próximas', 2) + aprCartao(aprCLinhaVisita(vs[0], true) + aprCLinhaVisita(vs[1], true)) +
      aprCSubSecao('Passadas', 2) + aprCartao(aprCLinhaVisita(vs[2], false)) }), { tom: 't0', arranjo: 'tela' });
}

/* O texto da seleção e de uma visita nova, conforme o ecrã e se já há
   imóveis onde a marcar (sem nenhum, o «Criar» não a oferece). O
   formulário pede quem vem, o imóvel e o dia (visitas.js:visitModal).
   Devolve: o HTML do texto. */
function aprCVisitasSelecaoTexto() {
  var base = 'Segura uma visita para marcares várias como realizadas ou como falta, ou para as apagares. ';
  if (!aprCComCasas('visit.add')) return base + 'As visitas são a um imóvel: com o primeiro, em <b>Casas → Imóveis</b>, a <b>Visita</b> passa a estar no <b>' + (aprCLargo() ? 'Criar' : '+') + '</b>.';
  return base + 'Uma nova marca-se ' + (aprCLargo() ? 'em <b>Marcar visita</b>, no cabeçalho' : 'no <b>+</b> da barra de baixo') + ': quem vem, o imóvel e o dia.';
}

/* O título do painel do dia da Agenda (calendario.js:calTituloDia): «Hoje,
   terça-feira 27/10».
   Devolve: o texto. */
function aprCHoje() {
  var hoje = today(), dia = '';
  try { dia = new Date(hoje + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long' }); } catch (e) { dia = ''; }
  return 'Hoje, ' + (dia ? dia + ' ' : '') + aprData(hoje);
}

/* A dica: as visitas na Agenda (calendario.js:vCalendar) — o mês com os
   dias que têm alguma coisa, e o painel do dia com a visita de hoje, que
   abre a mesma ficha (calendario.js:calDiaPanel).
   Devolve: o HTML da imagem. */
function aprCVisitasAgenda() {
  var v = aprCExemplo.visitas[0];
  return aprCena(aprColuna([aprCartao(aprCMes(), { classe: 'apr-c-mes-cartao' }),
    aprCartao('<span class="apr-m-cartao-cab"><b>' + esc(aprCHoje()) + '</b></span><span class="apr-m-rot apr-m-maiusc">Visitas</span>' +
      '<span class="apr-m-linha com-lado apr-alvo apr-c-ev"><span class="apr-c-ev-hora"><b>' + esc(v.inicio) + '</b><span class="apr-m-sub">' + esc(v.fim) + '</span></span>' +
        '<span class="apr-m-linha-txt"><b>' + esc(v.nomes) + '</b><span class="apr-m-sub">T3 Bonfim</span></span>' + aprSelo('Agendada') + '</span>', { flutua: true })]),
    { tom: 't2', arranjo: 'coluna' });
}

/* O texto da dica da Agenda: os planeados só com o serviço deles.
   Devolve: o HTML do texto. */
function aprCVisitasAgendaTexto() {
  return 'Em <b>Agenda → Calendário</b>, cada visita aparece no dia dela' + (servicoLigado('recurring') ? ', ao lado dos planeados,' : '') +
    ' e tocar nela abre a mesma ficha.';
}

registarApresentacao('visits', {
  nome: 'Visitas',
  imagens: [
    { titulo: 'Quem vem ver as casas',
      texto: 'Em <b>Casas → Visitas</b> ficam as próximas e as que já passaram, com o dia, quem vem e o imóvel. Os selos dizem o estado e o desfecho, e os chips filtram por eles e pelo imóvel.',
      maquete: aprCVisitasLista },
    { titulo: 'A ficha da visita', texto: aprCVisitasFichaTexto, maquete: aprCVisitasFicha },
    { titulo: 'Várias de uma vez', texto: aprCVisitasSelecaoTexto, maquete: aprCVisitasSelecao,
      quando: function () { return aprPodeCriar('visits', 'visit.add'); } },
    { titulo: 'Dica: as visitas na Agenda', texto: aprCVisitasAgendaTexto, maquete: aprCVisitasAgenda,
      quando: function () { return servicoLigado('calendar'); } },
  ],
});
