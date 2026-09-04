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

CW.ambiente = 'producao';
api('GET', '/api/auth/config')
  .then(function (c) { if (c && c.ambiente) CW.ambiente = c.ambiente; })
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

// fecha e remove o cartão do tutorial, sem o marcar como visto
// Devolve: nada — remove o cartão do DOM.
CW.guiaFechar = function () {
  guia = null;
  var el = document.getElementById('cwGuia');
  if (el) el.remove();
};

/* Com uma janela aberta, o cartão encosta ao topo.

   Ficava por baixo da janela e desaparecia: entrava-se nas definições para
   preencher o perfil e o tutorial sumia, sem forma de continuar. Agora passa
   por cima — e muda para o topo, senão tapava os botões de guardar e
   cancelar, que estão em baixo.
   Devolve: nada — liga ou desliga a classe 'sobre-janela' no cartão. */
function guiaAjustar() {
  var el = document.getElementById('cwGuia');
  if (!el) return;
  el.classList.toggle('sobre-janela', !!document.querySelector('.modal.open'));
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
   título, texto e botões. O texto do passo é HTML de confiança — vem de
   TUTORIAIS, escrito aqui —, por isso só o título passa pelo esc.
   Devolve: nada — escreve o cartão no DOM. */
function guiaPintar() {
  if (!guia) return;
  var p = guia.passos[guia.i], n = guia.passos.length;
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
  guiaAjustar();
  el.innerHTML =
    '<div class="card guia-cartao">' +
      '<div class="row-between" style="align-items:flex-start;gap:10px">' +
        '<div style="min-width:0">' +
          '<div class="small" style="color:var(--accent);font-weight:600">Passo ' + (guia.i + 1) + ' de ' + n + '</div>' +
          '<div class="title" style="margin-top:2px">' + esc(p.titulo) + '</div>' +
        '</div>' +
        '<button type="button" class="iconbtn" aria-label="Fechar" onclick="CW.guiaFechar()">' + ic('x', 18) + '</button>' +
      '</div>' +
      '<div class="hint" style="margin-top:9px">' + p.texto + '</div>' +
      '<div class="toolbar" style="margin-top:13px">' +
        (guia.i > 0
          ? '<button class="btn sm" onclick="CW.guiaAnterior()">' + ic('chev', 14) + ' Anterior</button>'
          : '') +
        '<button class="btn sm primary" onclick="CW.guiaSeguinte()">' +
          (guia.i < n - 1 ? 'Seguinte' : 'Terminar') + '</button>' +
        '<button class="btn sm" style="margin-left:auto" onclick="CW.guiaFechar()">Fechar</button>' +
      '</div>' +
    '</div>';
}

/* ------------------------------------------------------------- os tutoriais */

var TUTORIAIS = {
  perfil: {
    titulo: 'Preencher o teu perfil',
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
    passos: [
      {
        titulo: 'Um imóvel de cada vez',
        texto: 'Cada casa que tens é um imóvel. Basta o nome e a morada para começar — ' +
          'o resto acrescenta-se quando souberes.',
        ir: 'properties',
      },
      {
        titulo: 'Para arrendar ou para viver',
        texto: 'Se escolheres <b>investimento</b>, a app passa a calcular rentabilidade e a pedir contratos. ' +
          'Se for <b>uso próprio</b>, fica de fora dessas contas.',
      },
      {
        titulo: 'Valor de mercado e de aquisição',
        texto: 'São o que dá as mais-valias e o retorno. Se ainda não souberes o de mercado, ' +
          'põe o de aquisição nos dois e corriges depois.',
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
    passos: [
      {
        titulo: 'O que entra e o que sai',
        texto: 'Rendas recebidas, despesas pagas, prestações do crédito. É daqui que saem todos ' +
          'os números da vista geral.',
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
   quando não há imóveis para arrendar. Cada passo traz o porquê e a ação
   (act) que o botão "Fazer agora" dispara.
   Devolve: os passos aplicáveis (array de {id, titulo, porque, feito, act}). */
function passos() {
  var eu = euSou();
  var arrendar = (db.properties || []).filter(function (p) { return p.use === 'investimento'; });
  var semContrato = arrendar.filter(function (p) {
    return !(db.contracts || []).some(function (c) { return c.propertyId === p.id; });
  });
  return [
    {
      id: 'perfil',
      titulo: 'Preenche o teu perfil',
      porque: 'Os teus dados entram nos contratos que a app gera.',
      feito: !!(eu && eu.nif),
      act: 'CW.editProfile()',
    },
    {
      id: 'imoveis',
      titulo: 'Adiciona os teus imóveis',
      porque: 'É a base de tudo o resto.',
      feito: (db.properties || []).length > 0,
      act: 'propModal()',
    },
    {
      id: 'contratos',
      titulo: 'Regista os contratos',
      porque: semContrato.length
        ? semContrato.length + (semContrato.length === 1 ? ' imóvel para arrendar ainda sem contrato.' : ' imóveis para arrendar ainda sem contrato.')
        : 'Para as rendas passarem a aparecer sozinhas.',
      feito: (db.properties || []).length > 0 && !semContrato.length,
      salta: !arrendar.length,   // só para uso próprio: este passo não se aplica
      act: 'ctModal()',
    },
    {
      id: 'movimentos',
      titulo: 'Confirma os primeiros movimentos',
      porque: 'É daqui que saem os números da vista geral.',
      feito: (db.transactions || []).length > 0,
      act: "go('transactions')",
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

/* O HTML do cartão de primeiros passos que a vista geral mostra no topo —
   ou '' quando foi dispensado, não há sessão, ou já está tudo feito (o
   cartão não fica pendurado a dar os parabéns). Cada passo por fazer tem
   o "Fazer agora" e o botão do tutorial respetivo.
   Devolve: o HTML do cartão (string); '' quando não há nada a mostrar. */
function cartaoPassos() {
  if (passosDispensados() || !CW.user) return '';
  var ps = passos();
  var faltam = ps.filter(function (p) { return !p.feito; });
  if (!faltam.length) return '';
  var f = feitos();

  return '<div class="card" style="margin-bottom:14px">' +
    '<div class="row-between" style="align-items:flex-start">' +
      '<div><div class="title">Primeiros passos</div>' +
      '<div class="small">' + (ps.length - faltam.length) + ' de ' + ps.length + ' feitos · ' +
      'sugestões, não obrigações</div></div>' +
      '<button type="button" class="iconbtn" aria-label="Dispensar" onclick="CW.passosFora()">' + ic('x', 18) + '</button>' +
    '</div>' +
    '<div class="list" style="gap:8px;margin-top:12px">' +
    ps.map(function (p) {
      return '<div class="card" style="padding:11px 13px;' + (p.feito ? 'opacity:.55' : '') + '">' +
        '<div class="row-between" style="align-items:center;gap:10px">' +
          '<span style="display:flex;align-items:center;gap:10px;min-width:0">' +
            '<span class="selck' + (p.feito ? ' on' : '') + '" style="flex:0 0 auto">' +
              (p.feito ? ic('check', 13) : '') + '</span>' +
            '<span style="min-width:0"><b>' + esc(p.titulo) + '</b>' +
            '<span class="small" style="display:block">' + esc(p.porque) + '</span></span>' +
          '</span>' +
        '</div>' +
        (p.feito ? '' :
          '<div class="toolbar" style="margin:9px 0 0">' +
            '<button class="btn sm primary" onclick="' + p.act + '">Fazer agora</button>' +
            '<button class="btn sm" onclick="CW.guiaAbrir(\'' + p.id + '\')">' +
              (f[p.id] ? 'Rever o tutorial' : 'Como se faz') + '</button>' +
          '</div>') +
        '</div>';
    }).join('') +
    '</div></div>';
}

/* Todos os tutoriais, para quem os quiser rever. Vive aqui e não na ajuda
   porque é aqui que estão — a ajuda só os mostra.
   Devolve: um resumo por tutorial (array de {id, titulo, passos, resumo, visto}). */
CW.listaDeTutoriais = function () {
  var f = feitos();
  return Object.keys(TUTORIAIS).map(function (id) {
    var t = TUTORIAIS[id];
    return {
      id: id, titulo: t.titulo, passos: t.passos.length,
      resumo: t.passos[0].texto.replace(/<[^>]+>/g, '').slice(0, 90) + '…',
      visto: !!f[id],
    };
  });
};

/* --------------------------------------------------------------- ligações */

var _vDashboard_guia = vDashboard;
vDashboard = function () {
  return cartaoPassos() + _vDashboard_guia();
};

/* Em produção não se carregam dados de exemplo. Quem chega deve encontrar a
   app vazia e ser levado pelos primeiros passos — dados de brincar por cima
   dos verdadeiros são um estorvo, e apagá-los à mão é trabalho. */
var _seed_guia = seed;
seed = function () {
  if (CW.ambiente === 'producao') return toast('Os dados de exemplo só existem no ambiente de desenvolvimento.');
  return _seed_guia.apply(this, arguments);
};

// e o botão desaparece, em vez de estar lá para dizer que não
var _render_guia = render;
render = function () {
  var r = _render_guia.apply(this, arguments);
  if (CW.ambiente === 'producao') {
    [].slice.call(document.querySelectorAll('#view [onclick="seed()"]')).forEach(function (b) {
      var barra = b.parentNode;
      b.remove();
      if (barra && barra.classList.contains('toolbar') && !barra.children.length) barra.remove();
    });
  }
  return r;
};

var css = document.createElement('style');
css.textContent =
  /* flutua, não é modal: quem segue os passos tem de poder mexer na app por
     baixo enquanto lê. Acima do botão flutuante, abaixo dos modais. */
  /* Acima do botão flutuante e não por cima dele: o tutorial manda carregar
     nesse botão, e estava a tapá-lo. */
  '#cwGuia{position:fixed;left:12px;right:12px;bottom:calc(88px + var(--inset-bottom));z-index:59;' +
    'pointer-events:none;display:flex;justify-content:center}' +
  '#cwGuia .guia-cartao{pointer-events:auto;width:100%;max-width:420px;padding:14px 16px;' +
    'box-shadow:var(--shadow);border-color:var(--accent)}' +
  // por cima de uma janela aberta (60) e encostado ao topo, longe dos botões
  '#cwGuia.sobre-janela{z-index:61;bottom:auto;top:calc(12px + var(--inset-top))}' +
  '@media(min-width:900px){#cwGuia{left:auto;right:22px;max-width:420px;bottom:calc(22px + var(--inset-bottom))}' +
    '#cwGuia.sobre-janela{top:calc(16px + var(--inset-top))}}';
document.head.appendChild(css);
