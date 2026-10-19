/* Primeiros passos e tutoriais.
   -----------------------------
   Quem chega a uma app de gestão de imóveis com o ecrã vazio não sabe por
   onde começar, e a ordem importa: sem perfil os contratos saem sem os dados
   do senhorio, sem imóveis não há onde pendurar um contrato, e sem contrato
   as rendas não se geram sozinhas.

   Nada disto obriga a nada. É um cartão na vista geral com o que falta, e
   tutoriais para quem quiser ser levado pela mão. Fecha-se e não volta.

   O tutorial é um cartão a flutuar, não um modal: quem está a seguir os
   passos tem de conseguir mexer na app por baixo enquanto o lê. */

'use strict';

var LS_GUIA = 'gi_guia_feitos';       // tutoriais já vistos até ao fim
var LS_PASSOS = 'gi_passos_fora';     // o cartão de primeiros passos foi dispensado

/* Até o servidor responder vale 'producao': é o lado seguro, e é o que
   esconde os dados de exemplo onde eles não devem estar. A resposta chega
   depois da primeira pintura, e por isso repinta-se quando ela muda alguma
   coisa — sem sessão iniciada não há sincronização nenhuma a fazê-lo, e em
   dev o botão do exemplo nunca chegava a aparecer. O ambiente também decide
   os serviços que só existem fora de produção (servicos.js:
   servicoForaDoAmbiente): a barra refaz-se, e quem recarregou a página num
   deles volta a ele (o restorePage do arranque correu sem o saber). */
CW.ambiente = 'producao';
api('GET', '/api/auth/config')
  .then(function (c) {
    if (!c || !c.ambiente || c.ambiente === CW.ambiente) return;
    CW.ambiente = c.ambiente;
    try {
      if (!separadorLigado(tab)) { tab = primeiroSeparadorLigado(); setPage = ''; }
      buildNav(); render();
      if (tab === 'dashboard' && CW.user) restorePage();
    } catch (e) {}
  })
  .catch(function () {});

// os tutoriais já vistos até ao fim, lidos do localStorage ({id: 1});
// devolve {} quando não há nada ou o armazenamento está vedado
// Devolve: o mapa {id: 1} dos tutoriais vistos (objeto).
function feitos() {
  try { return JSON.parse(localStorage.getItem(LS_GUIA) || '{}'); } catch (e) { return {}; }
}
// regista no localStorage que este tutorial foi visto até ao fim
// Recebe: id — a chave do tutorial em TUTORIAIS ('perfil', 'imoveis', …).
// Devolve: nada — grava no localStorage.
function marcarFeito(id) {
  try { var f = feitos(); f[id] = 1; localStorage.setItem(LS_GUIA, JSON.stringify(f)); } catch (e) {}
}

/* ------------------------------------------------------- o cartão flutuante */

var guia = null;   // { id, passos, i }

// abre o tutorial pedido no primeiro passo; um id desconhecido não faz nada
// Recebe: id — a chave do tutorial em TUTORIAIS.
// Devolve: nada — desenha o cartão flutuante.
CW.guiaAbrir = function (id) {
  var t = TUTORIAIS[id];
  if (!t) return;
  guia = { id: id, passos: t.passos, i: 0 };
  guiaPintar();
};

// recua um passo no tutorial aberto (no primeiro passo não faz nada)
// Devolve: nada — redesenha o cartão.
CW.guiaAnterior = function () { if (guia && guia.i > 0) { guia.i--; guiaPintar(); } };

// avança um passo; no último ("Terminar") marca o tutorial como visto,
// fecha o cartão e repinta a app, para o cartão de passos refletir isso
// Devolve: nada — redesenha o cartão (ou, no último passo, fecha-o e repinta a app).
CW.guiaSeguinte = function () {
  if (!guia) return;
  if (guia.i < guia.passos.length - 1) { guia.i++; guiaPintar(); return; }
  marcarFeito(guia.id);
  CW.guiaFechar();
  render();
};

// fecha e remove o cartão do tutorial, sem o marcar como visto; a página e
// as janelas deixam de lhe guardar espaço (as classes do guiaAjustar saem)
// Devolve: nada — remove o cartão do DOM.
CW.guiaFechar = function () {
  guia = null;
  var el = document.getElementById('cwGuia');
  if (el) el.remove();
  var corpo = document.body;
  if (corpo && corpo.classList) { corpo.classList.remove('com-guia'); corpo.classList.remove('guia-sobre'); }
};

/* Com uma janela aberta, o cartão encosta ao topo, e a janela fica abaixo
   dele.

   Ficava por baixo da janela e desaparecia: entrava-se nas definições para
   preencher o perfil e o tutorial sumia, sem forma de continuar. Passou por
   cima — e para o topo, senão tapava os botões de guardar e cancelar, que
   estão em baixo. Lá em cima tapava o cabeçalho da janela: o título, o ✕ de
   fechar e o primeiro campo. Por isso, enquanto ele lá está, o body leva a
   classe 'guia-sobre' e a janela começa abaixo do cartão (no telemóvel e no
   tablet, onde ele ocupa a largura; estilos.css, secção 1.3.9).
   Sem janela, o cartão flutua por cima do fim da página: a classe 'com-guia'
   dá à página espaço em baixo para o último registo sair de trás dele, e o
   tutorial pede precisamente para se mexer na app por baixo.
   As duas reservas usam a altura do cartão, medida e não adivinhada (o texto
   de cada passo tem o seu tamanho), na variável --guia-alto do body. Mede-se
   o offsetHeight, que não conta a translação da entrada (guiaEntra).
   Devolve: nada — liga ou desliga as classes e escreve a altura. */
function guiaAjustar() {
  var el = document.getElementById('cwGuia');
  if (!el) return;
  var sobre = !!document.querySelector('.modal.open');
  el.classList.toggle('sobre-janela', sobre);
  var corpo = document.body;
  if (!corpo || !corpo.classList) return;
  corpo.classList.add('com-guia');
  corpo.classList.toggle('guia-sobre', sobre);
  var alto = Number(el.offsetHeight) || 0;
  if (alto > 0 && corpo.style && typeof corpo.style.setProperty === 'function') corpo.style.setProperty('--guia-alto', Math.ceil(alto) + 'px');
}

['openModal', 'closeAllModals', 'closeModal'].forEach(function (nome) {
  var antes = window[nome];
  if (typeof antes !== 'function') return;
  window[nome] = function () {
    var r = antes.apply(this, arguments);
    setTimeout(guiaAjustar, 0);
    return r;
  };
});

/* Desenha (ou redesenha) o cartão flutuante com o passo atual: cria o #cwGuia
   se ainda não existir, muda para o ecrã que o passo aponta (p.ir) e escreve
   o cartão do canvas (M-Tutorial): o azul-noite da barra lateral, por cima
   de tudo o que é claro, com «<tutorial> · passo N de M» e o ✕ à cabeça, o
   título do passo, o texto, uma fita com um traço por passo (os feitos e o
   atual acesos) e «Anterior» / «Seguinte» lado a lado — no último,
   «Terminar». No primeiro passo não há «Anterior», e o «Seguinte» fica com
   a largura toda. É uma região com nome (o leitor de ecrã diz «Tutorial:
   <nome>»), e a fita é só desenho: o número já está escrito. O texto do
   passo é HTML de confiança — vem de TUTORIAIS, escrito aqui —, por isso só
   o título passa pelo esc.
   Recebe: nada (lê o tutorial aberto, guia).
   Devolve: nada — escreve o cartão no DOM. */
function guiaPintar() {
  if (!guia) return;
  var p = guia.passos[guia.i], n = guia.passos.length, t = TUTORIAIS[guia.id] || { titulo: '' };
  /* Um passo leva ao ecrã certo, e mais nada. Abrir janelas por conta própria
     era desorientador — a janela aparecia entre um passo e o seguinte, sem
     ninguém a ter pedido, e tapava o próprio tutorial. Quem quiser preencher
     abre; quem não quiser continua a ler. */
  if (p.ir && tab !== p.ir) { go(p.ir); }

  var el = document.getElementById('cwGuia');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cwGuia';
    document.body.appendChild(el);
  }
  var fita = '';
  for (var k = 0; k < n; k++) fita += '<span' + (k <= guia.i ? ' class="on"' : '') + '></span>';
  el.innerHTML =
    '<section class="guia-cartao" role="region" aria-label="' + esc('Tutorial: ' + t.titulo) + '">' +
      '<div class="guia-cab">' +
        '<p class="guia-conta num">' + esc(t.titulo) + ' · passo ' + (guia.i + 1) + ' de ' + n + '</p>' +
        '<button type="button" class="guia-fechar" aria-label="Fechar o tutorial" data-toca="camada" data-click="CW.guiaFechar()">' + ic('x', 18) + '</button>' +
      '</div>' +
      '<h2 class="guia-tit">' + esc(p.titulo) + '</h2>' +
      '<p class="guia-txt">' + p.texto + '</p>' +
      '<div class="guia-fita" aria-hidden="true">' + fita + '</div>' +
      '<div class="guia-botoes">' +
        (guia.i > 0
          ? '<button type="button" class="btn guia-ant" data-toca="vista" data-click="CW.guiaAnterior()">Anterior</button>'
          : '') +
        '<button type="button" class="btn guia-seg" data-toca="vista" data-click="CW.guiaSeguinte()">' +
          (guia.i < n - 1 ? 'Seguinte' : 'Terminar') + '</button>' +
      '</div>' +
    '</section>';
  /* depois de escrito: a altura que as reservas usam é a deste passo */
  guiaAjustar();
}

/* ------------------------------------------------------------- os tutoriais */

/* Cada tutorial: o título, o resumo curto que a Ajuda mostra no mosaico dele
   (cloud/ajuda.js:tutoriaisNaAjuda — cabe em duas linhas de 156px) e os
   passos, cada um com o título, o texto (HTML de confiança) e, quando o
   passo é sobre um ecrã, o separador para onde leva (ir). */
var TUTORIAIS = {
  perfil: {
    titulo: 'Preencher o teu perfil',
    resumo: 'Os teus dados nos contratos',
    passos: [
      {
        titulo: 'Porquê começar por aqui',
        texto: 'Os teus dados — nome, NIF, morada, IBAN — entram nos contratos que a app gera. ' +
          'Preenchidos uma vez, não voltas a escrevê-los.',
        ir: 'settings',   // lançado da Ajuda, o tutorial leva-te logo ao sítio
      },
      {
        titulo: 'Onde se preenche',
        texto: 'Estás nas <b>Definições</b>. Toca em <b>O meu perfil</b>, no topo. ' +
          'Este cartão fica à vista enquanto preenches.',
        ir: 'settings',
      },
      {
        titulo: 'O que vale a pena preencher já',
        texto: 'O <b>nome</b> e o <b>NIF</b> chegam para começar. A morada e o IBAN só fazem falta ' +
          'quando gerares o primeiro contrato.',
      },
    ],
  },
  imoveis: {
    titulo: 'Adicionar o primeiro imóvel',
    resumo: 'A base de tudo o resto',
    passos: [
      {
        titulo: 'Um imóvel de cada vez',
        texto: 'Cada casa que tens é um imóvel. Basta o nome e a morada para começar — ' +
          'o resto acrescenta-se quando souberes.',
        ir: 'properties',
      },
      {
        titulo: 'Para render ou para viver?',
        texto: 'Ao criar o imóvel, escolhe <b>Arrendamento</b> se é para render, ou <b>Uso próprio</b> se vives lá. ' +
          'Só os de arrendamento pedem contratos e entram nas contas da rentabilidade.',
      },
      {
        titulo: 'Valor de mercado e de aquisição',
        texto: 'São o que dá as mais-valias e o retorno. Se ainda não souberes o de mercado, ' +
          'escreve o de aquisição nos dois e corriges depois.',
      },
      {
        titulo: 'Se tiveres crédito',
        texto: 'Dentro do imóvel podes registar a hipoteca. A partir daí a prestação aparece ' +
          'sozinha nos movimentos por confirmar, todos os meses.',
      },
    ],
  },
  contratos: {
    titulo: 'Registar um contrato',
    resumo: 'O contrato gera a renda',
    passos: [
      {
        titulo: 'O contrato liga o imóvel ao inquilino',
        texto: 'É dele que sai a renda: uma vez registado, a app passa a pedir-te a confirmação ' +
          'da renda todos os meses, na data certa.',
        ir: 'contracts',
      },
      {
        titulo: 'Casa inteira ou por quartos',
        texto: 'Se arrendas por quartos, cria um contrato por quarto. A app percebe quando a casa ' +
          'está só parcialmente ocupada.',
      },
      {
        titulo: 'Datas e renda',
        texto: 'O <b>início</b>, o <b>fim</b> e o <b>dia de pagamento</b> são o que a app usa para saber ' +
          'quando pedir. O fim pode ficar vazio se for por tempo indeterminado.',
      },
    ],
  },
  movimentos: {
    titulo: 'Registar movimentos',
    resumo: 'O que entra e o que sai',
    passos: [
      {
        titulo: 'O que entra e o que sai',
        texto: 'Rendas recebidas, despesas pagas, prestações do crédito. É daqui que saem todos ' +
          'os números da Visão geral.',
        ir: 'transactions',
      },
      {
        titulo: 'A maior parte aparece sozinha',
        texto: 'As rendas dos contratos e as prestações das hipotecas caem em <b>Planeados</b>, ' +
          'à espera de um toque em <i>Confirmar</i>. Só registas à mão o que é imprevisto.',
      },
      {
        titulo: 'Categorias',
        texto: 'Ajudam a perceber para onde vai o dinheiro. Podes deixar por preencher e arrumar ' +
          'depois: com um toque longo marcas vários movimentos e mudas a categoria de todos de uma vez.',
      },
    ],
  },
  visitas: {
    titulo: 'Marcar uma visita',
    resumo: 'Quem vem, onde e quando',
    passos: [
      {
        titulo: 'Onde se marca',
        texto: 'Estás nas <b>Visitas</b>. Toca no <b>+</b> (ou em <b>Marcar visita</b>, com a lista vazia). ' +
          'Quem colabora tem o mesmo botão na Visão geral e na ficha do imóvel.',
        ir: 'visits',
      },
      {
        titulo: 'O que se escreve',
        texto: 'Quem vem, a que imóvel e em que dia. O contacto e as horas são opcionais — servem para ' +
          'confirmar ou remarcar. O dono vê a visita assim que a guardas.',
      },
      {
        titulo: 'Depois da visita',
        texto: 'Marca-a como realizada ou como falta e escolhe o desfecho. Se a pessoa ficar com a casa, ' +
          'o menu da visita converte-a em ficha de inquilino — se o teu cargo deixar adicionar inquilinos.',
      },
    ],
  },
};

/* ------------------------------------------------- o que falta a esta conta */

// o registo de owner do utilizador com sessão, ou null — é lá que vive
// o NIF que diz se o perfil está preenchido
// Devolve: o registo de owner (objeto) ou null.
function euSou() {
  var id = CW.user && CW.user.id;
  return (db.owners || []).find(function (o) { return o.id === id; }) || null;
}

/* A lista de primeiros passos com o estado calculado da base local: perfil
   (há NIF?), imóveis, contratos e movimentos. O passo dos contratos salta
   quando não há imóveis para arrendar; quem é só colaborador salta os de
   dono (perfil, imóveis, contratos) e o dos movimentos se nenhum cargo lhos
   deixa adicionar, e tem o de marcar a primeira visita quando o cargo o
   deixa (feito quando há uma visita criada por si). Sem sessão o passo do
   perfil salta — não há perfil de ninguém para preencher — e os outros
   ficam: a jornada da vista geral (jornadaInicial) serve quem ainda não
   entrou. Cada passo traz o título, o porquê (o que se lê enquanto está por
   fazer), o que já se fez (feitoTxt, o que se lê riscado), a ação (act) do
   botão do passo atual com o rótulo dele (botao: o verbo do que abre, como
   no canvas — «Adicionar imóvel», e não um «Fazer agora» que não diz o
   quê), a família da ação (toca: 'camada' abre uma janela, 'ecra' muda de
   ecrã) e por onde se começa (fase), para a frase das boas-vindas.
   Recebe: nada (lê a base local, a sessão e os serviços ligados).
   Devolve: os passos aplicáveis (array de {id, titulo, porque, feitoTxt,
   feito, botao, mais, toca, act, fase}). */
function passos() {
  var eu = euSou();
  // só colaboradora (souSoColaborador, web/app/acessos.js): os passos de dono não lhe dizem respeito
  var colab = souSoColaborador();
  // uma visita é minha se o servidor a marcou como minha, ou se ainda não subiu (acessos.js:podeEditar)
  var visitaMinha = (db.visits || []).some(function (v) { return v._createdBy ? v._createdBy === meuId() : !v._atServidor; });
  var arrendar = (db.properties || []).filter(function (p) { return p.use === 'investimento' && !p._cargo; });
  var semContrato = arrendar.filter(function (p) {
    return !(db.contracts || []).some(function (c) { return c.propertyId === p.id; });
  });
  var podeMovimentos = !colab || casasComo('tx.add').length > 0;
  var nImoveis = (db.properties || []).length, nMovs = (db.transactions || []).length;
  return [
    {
      id: 'perfil',
      titulo: 'Preenche o teu perfil',
      porque: 'Os teus dados entram nos contratos que a app gera.',
      feitoTxt: eu && eu.name ? 'Nome e NIF preenchidos.' : 'NIF preenchido.',
      feito: !!(eu && eu.nif),
      salta: colab || !CW.user,
      botao: 'Preencher o perfil',
      toca: 'camada',
      act: 'CW.editProfile()',
      fase: 'pelo teu perfil',
    },
    {
      id: 'imoveis',
      titulo: 'Adiciona os teus imóveis',
      porque: 'É a base de tudo o resto: contratos, rendas, despesas e o IRS partem daqui.',
      feitoTxt: nImoveis === 1 ? '1 imóvel adicionado.' : nImoveis + ' imóveis adicionados.',
      feito: nImoveis > 0,
      // um passo de um serviço desligado nesta conta não se propõe: abriria um formulário que o servidor recusa
      salta: colab || !servicoLigado('properties'),
      botao: 'Adicionar imóvel',
      mais: true,
      toca: 'camada',
      act: 'propModal()',
      fase: 'pelos imóveis',
    },
    {
      id: 'contratos',
      titulo: 'Regista os contratos',
      porque: semContrato.length
        ? semContrato.length + (semContrato.length === 1 ? ' imóvel para arrendar ainda sem contrato.' : ' imóveis para arrendar ainda sem contrato.')
        : 'Para as rendas passarem a aparecer sozinhas.',
      feitoTxt: 'Os imóveis para arrendar já têm contrato.',
      feito: nImoveis > 0 && !semContrato.length,
      salta: colab || !arrendar.length || !servicoLigado('contracts'),   // só para uso próprio, só colaborador, ou sem os Contratos: não se aplica
      botao: 'Adicionar contrato',
      mais: true,
      toca: 'camada',
      act: 'ctModal()',
      fase: 'pelos contratos',
    },
    {
      id: 'visitas',
      titulo: 'Marca a primeira visita',
      porque: 'Quem vem, a que imóvel e quando — o dono vê-a logo.',
      feitoTxt: 'Já marcaste uma visita.',
      feito: visitaMinha,
      salta: !colab || !casasComo('visit.add').length || !servicoLigado('visits'),
      botao: 'Marcar visita',
      mais: true,
      toca: 'camada',
      act: 'visitModal()',
      fase: 'pela primeira visita',
    },
    {
      id: 'movimentos',
      titulo: 'Confirma os primeiros movimentos',
      porque: 'É daqui que saem os números da Visão geral.',
      feitoTxt: nMovs === 1 ? '1 movimento registado.' : nMovs + ' movimentos registados.',
      feito: nMovs > 0,
      salta: !podeMovimentos || !servicoLigado('transactions'),
      botao: 'Ir para os movimentos',
      toca: 'ecra',
      act: "go('transactions')",
      fase: 'pelos movimentos',
    },
  ].filter(function (p) { return !p.salta; });
}

// dispensa o cartão de primeiros passos de vez (fica no localStorage)
// e repinta já, para ele desaparecer
// Devolve: nada — grava no localStorage e redesenha a vista.
CW.passosFora = function () {
  try { localStorage.setItem(LS_PASSOS, '1'); } catch (e) {}
  render();
};

// o cartão de primeiros passos foi dispensado? (false se o localStorage falhar)
// Devolve: true se foi dispensado, false caso contrário (booleano).
function passosDispensados() {
  try { return localStorage.getItem(LS_PASSOS) === '1'; } catch (e) { return false; }
}

/* O passo atual e a lista, ou null quando não há cartão a mostrar
   (dispensado, ou tudo feito — o cartão não fica pendurado a dar os
   parabéns).
   Recebe: nada.
   Devolve: {ps, atual, nFeitos} ou null. */
function estadoDosPassos() {
  if (passosDispensados()) return null;
  var ps = passos(), atual = -1, nFeitos = 0;
  for (var k = 0; k < ps.length; k++) {
    if (ps[k].feito) nFeitos++;
    else if (atual < 0) atual = k;
  }
  return atual < 0 ? null : { ps: ps, atual: atual, nFeitos: nFeitos };
}

/* Uma linha da lista dos passos (o .st do canvas M-PrimeirosPassos): o
   círculo — o visto num verde suave nos feitos, o número cheio de cobalto
   no atual, o número em cinzento nos que faltam —, o título e a frase. O
   feito lê-se riscado, com o que já se fez; o atual tem a faixa cobalto
   suave, o título maior, o porquê, e os dois botões: a ação do passo e o
   tutorial dele («Como se faz · N passos», ou «Rever o tutorial» depois de
   visto até ao fim). Só o atual tem botões: a pessoa só tem de decidir uma
   coisa de cada vez.
   Recebe: q — o passo (de passos()); i — a posição dele; atual — o índice
   do passo atual; f — os tutoriais vistos (feitos()).
   Devolve: o HTML do <li> (texto). */
function linhaDoPasso(q, i, atual, f) {
  var agora = i === atual;
  var circulo = q.feito
    ? '<span class="jornada-n" role="img" aria-label="Feito">' + ic('check', 16) + '</span>'
    : '<span class="jornada-n">' + (i + 1) + '</span>';
  var corpo = '<b class="jornada-l">' + esc(q.titulo) + '</b>';
  if (q.feito) corpo += '<span class="small">' + esc(q.feitoTxt) + '</span>';
  else if (!agora) corpo += '<span class="small">' + esc(q.porque) + '</span>';
  else {
    var t = TUTORIAIS[q.id];
    corpo += '<span class="jornada-porque">' + esc(q.porque) + '</span>' +
      '<span class="jornada-acoes">' +
        '<button type="button" class="btn primary" data-toca="' + q.toca + '" data-click="' + q.act + '">' +
          (q.mais ? ic('plus', 18) : '') + esc(q.botao) + '</button>' +
        (t ? '<button type="button" class="btn" data-toca="ecra" data-click="CW.guiaAbrir(\'' + q.id + '\')">' +
          (f[q.id] ? 'Rever o tutorial' : 'Como se faz · ' + t.passos.length + ' passos') + '</button>' : '') +
      '</span>';
  }
  return '<li class="jornada-passo' + (q.feito ? ' feito' : agora ? ' atual' : '') + '"' + (agora ? ' aria-current="step"' : '') + '>' +
    circulo + '<span class="jornada-txt">' + corpo + '</span></li>';
}

/* As boas-vindas da conta nova (o topo do canvas M-PrimeirosPassos): o
   mosaico cobalto por cima, num cartão azul-noite, com o olá pelo primeiro
   nome da conta e a frase que diz de onde saem os números e por onde se
   começa — ou se continua, quando já há passos feitos.
   Recebe: e — o estado dos passos (estadoDosPassos).
   Devolve: o HTML da secção (texto). */
function boasVindas(e) {
  var nome = String((CW.user && CW.user.name) || '').trim().split(/\s+/)[0];
  var p = e.ps[e.atual];
  return '<section class="pp-boas" aria-label="Boas-vindas">' +
    '<div class="pp-boas-mosaico imv-mosaico imv-t0" aria-hidden="true"></div>' +
    '<div class="pp-boas-txt">' +
      '<h2>Olá' + (nome ? ', ' + esc(nome) : '') + '. Vamos adicionar as tuas casas à app.</h2>' +
      '<p>Os números da Visão geral saem dos movimentos. ' + (e.nFeitos ? 'Continua ' : 'Começa ') + esc(p.fase) + '; o resto vem a seguir.</p>' +
    '</div></section>';
}

/* O cartão de primeiros passos, como no canvas (M-PrimeirosPassos): o
   título com a conta do que está feito («1 de 4 feitos»), uma barra verde
   que a diz, e um passo por linha (linhaDoPasso) — o atual em destaque, com
   a ação e o tutorial. Por baixo, fora do cartão, «Dispensar os primeiros
   passos». Vai ao topo da vista geral e, enquanto não há movimentos, É a
   vista (jornadaInicial, que lhe junta as boas-vindas). Devolve '' quando
   foi dispensado ou já está tudo feito. Não exige sessão: sem ela os passos
   são os mesmos menos o do perfil (passos).
   A lista é uma <ol> e não um desenho: um leitor de ecrã lê «lista, 4
   itens», o passo atual leva aria-current="step", e o círculo de um passo
   feito anuncia-se «Feito» (role="img") — o número dos outros lê-se tal
   e qual, e o título a seguir. A barra é um progressbar com o mesmo número.
   Era uma fita horizontal, com um traço de círculo a círculo que passava
   por cima do círculo do passo atual; numa lista não há traço que cruzar,
   e o círculo do atual é cheio.
   Recebe: comBoasVindas (opcional) — verdadeiro para abrir com as
   boas-vindas (a jornada no lugar da vista).
   Devolve: o HTML do cartão (string); '' quando não há nada a mostrar. */
function cartaoPassos(comBoasVindas) {
  var e = estadoDosPassos();
  if (!e) return '';
  var f = feitos(), n = e.ps.length;
  var pc = Math.round(e.nFeitos * 1000 / n) / 10;
  return '<div class="pp-jornada' + (comBoasVindas ? ' pp-com-boas' : '') + '">' +
    (comBoasVindas ? boasVindas(e) : '') +
    '<section class="card pp-cartao" aria-labelledby="ppTitulo">' +
      '<div class="pp-cab">' +
        '<h2 id="ppTitulo">Primeiros passos</h2>' +
        '<span class="small num">' + e.nFeitos + ' de ' + n + ' feitos</span>' +
      '</div>' +
      '<div class="pp-barra" role="progressbar" aria-labelledby="ppTitulo" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + e.nFeitos + '" aria-valuetext="' + e.nFeitos + ' de ' + n + ' feitos">' +
        '<span data-largura="' + pc + '"></span></div>' +
      '<ol class="jornada" role="list">' +
        e.ps.map(function (q, i) { return linhaDoPasso(q, i, e.atual, f); }).join('') +
      '</ol>' +
    '</section>' +
    '<button type="button" class="btn ghost pp-fora" data-toca="vista" data-click="CW.passosFora()">Dispensar os primeiros passos</button>' +
    '</div>';
}

/* A jornada no lugar da vista geral. Enquanto não há movimentos, a vista
   geral eram quatro indicadores a 0 € e dois gráficos vazios por baixo do
   cartão dos passos — números que não dizem nada e ocupam o ecrã todo. Sem
   movimentos, a vista É o cartão dos passos com as boas-vindas por cima
   (painel-geral.js:vDashboard pergunta aqui), mais o portefólio quando há
   imóveis; os indicadores voltam com o primeiro movimento. Não substitui a
   vista a quem só colabora (o topo dele é o «O que podes fazer», e as
   contas não são dele), nem a quem dispensou o cartão, nem quando já não há
   passos por fazer — nesses casos devolve '' e a vista geral fica como
   sempre.
   Recebe: nada.
   Devolve: o HTML da jornada (string), ou '' quando ela não substitui a vista. */
function jornadaInicial() {
  if ((db.transactions || []).length || souSoColaborador()) return '';
  return cartaoPassos(true);
}

/* Todos os tutoriais, para quem os quiser rever. Vive aqui e não na ajuda
   porque é aqui que estão — a ajuda só os mostra.
   Recebe: nada.
   Devolve: um resumo por tutorial (array de {id, titulo, passos, resumo, visto}). */
CW.listaDeTutoriais = function () {
  var f = feitos();
  return Object.keys(TUTORIAIS).map(function (id) {
    var t = TUTORIAIS[id];
    return {
      id: id, titulo: t.titulo, passos: t.passos.length,
      resumo: t.resumo || t.passos[0].texto.replace(/<[^>]+>/g, '').slice(0, 90) + '…',
      visto: !!f[id],
    };
  });
};

/* --------------------------------------------------------------- ligações */

/* Os primeiros passos vão no topo da vista geral — menos a quem só colabora,
   onde o topo é do «O que podes fazer» (painel-geral.js:cartaoPodes) e os
   passos entram logo a seguir, onde o comentário dele marca o fim. Quando a
   vista já É a jornada (painel-geral.js:vDashboard, pela jornadaInicial), o
   HTML traz a marca <!--jornada--> e não se insere o cartão segunda vez. E
   enquanto a vista é o «À espera do servidor» (espera.js:esperaDoServidor)
   não se insere nada: os passos calculam-se da base local, e afirmar
   «imóveis por adicionar» a quem tem doze é o erro que a espera existe
   para não deixar acontecer. */
var _vDashboard_guia = vDashboard;
vDashboard = function () {
  var html = _vDashboard_guia();
  if (html.indexOf('<!--jornada-->') > -1 || esperaDoServidor()) return html;
  var passosHtml = cartaoPassos();
  if (!passosHtml) return html;
  /* os passos entram depois do «O que podes fazer» de quem colabora e, numa
     conta que tem pedidos por responder (partilha.js:pedidosDashCard), depois
     desses pedidos — um convite recebido é mais urgente do que o tutorial */
  var fim = '<!--fim-podes--></div>', i = html.indexOf(fim);
  if (i < 0) { fim = '<!--fim-pedidos-->'; i = html.indexOf(fim); }
  if (i < 0) return passosHtml + html;
  i += fim.length;
  return html.slice(0, i) + passosHtml + html.slice(i);
};

/* Em produção não se carregam dados de exemplo. Quem chega deve encontrar a
   app vazia e ser levado pelos primeiros passos — dados de brincar por cima
   dos verdadeiros são um estorvo, e apagá-los à mão é trabalho.

   Este é o fecho, e não a fechadura: o botão já nem chega a ser escrito
   (espera.js:podeExemplo). Chegou a ser apagado do DOM depois de cada
   render, e isso tinha um furo — a pesquisa das listas repinta pela via
   parcial (vistas.js:refrescarListasVivas), que não passa por aqui, e o botão
   voltava. Perguntar antes de escrever não tem furos; isto fica para o caso
   de o seed ser chamado por outro caminho. */
var _seed_guia = seed;
seed = function () {
  if (CW.ambiente === 'producao') return toast('Os dados de exemplo só existem no ambiente de desenvolvimento.');
  return _seed_guia.apply(this, arguments);
};

/* A folha do cartão flutuante (#cwGuia, .guia-cartao, o guiaEntra e a regra
   do ecrã largo) era feita aqui, num elemento de folha criado por JavaScript e
   pendurado na cabeça do documento. Isso é CSS em linha, que a CSP sem
   'unsafe-inline' recusa tal como recusa um atributo de estilo, por isso as
   regras passaram para o web/estilos.css, na secção «g12-novidades» das
   classes dos módulos — tal e qual, pela mesma ordem e com os mesmos
   comentários. */
