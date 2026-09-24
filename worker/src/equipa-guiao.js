/* O guião do back office (/equipa): o JavaScript que corre no browser de
   quem faz suporte, opera ou programa.
   ---------------------------------------------------------------------
   Vive aqui como texto, e o worker serve-o em /equipa/guiao.js — só a quem
   tem sessão de equipa (paginas-recursos.js). A página (equipa-vista.js)
   carrega-o depois dos dados da sessão (eu, ESTADOS, CATS), que a vista põe
   num <script type="application/json" id="dados-equipa"> e o guião lê.

   É um String.raw, e é isso que interessa: o que se escreve aqui é o que o
   browser recebe. Um \n numa mensagem é um \n e uma plica escapada é \' —
   como em qualquer ficheiro de JavaScript. Dentro de um template literal
   normal o servidor cozia o texto antes de o servir, e cada quebra e cada
   plica tinham de ir dobradas; um \n a menos virava uma quebra verdadeira a
   meio de uma string, e a página inteira ficava morta em «A carregar…» —
   custou uma tarde. Ficam duas regras, que o testes/equipa-guiao.test.js
   guarda: nem crases nem cifrão com chaveta cá dentro, que são as duas
   coisas que um String.raw ainda interpreta.

   A página vai com a CSP_ESTRITA: um manipulador ou um estilo escritos em
   atributos do HTML não correm. Os botões dizem o que fazem num data-acao (e os campos
   num data-enter, para o Enter, e num data-mudar, para o change), com os
   valores em data-arg, data-arg2 e data-arg3; três ouvintes no document
   leem-nos e chamam a função da tabela ACOES — só essas, e mais nenhuma. Um
   valor num atributo data-* é texto e nunca código: o esc() chega, porque o
   browser desfaz as entidades e entrega a string tal e qual. Os estilos são
   classes do CSS_EQUIPA (equipa-vista.js). */

export const GUIAO = String.raw`var seccao = '', estado = 'abertos', modelos = null;

// os dados da sessão, que a página traz num <script type="application/json">
var DADOS = JSON.parse(document.getElementById('dados-equipa').textContent);
var eu = DADOS.eu, ESTADOS = DADOS.ESTADOS, CATS = DADOS.CATS;

var esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
};
/* Os atributos que ligam um elemento a uma ação da tabela ACOES: o nome no
   data-<tipo> e os valores em data-arg, data-arg2 e data-arg3, cada um pelo
   esc() — num atributo data-* o valor é texto, e chega à ação tal e qual.
   Recebe: tipo — 'acao' (clique), 'enter' (Enter num campo) ou 'mudar'
   (change); nome — o nome da ação em ACOES; args (opcional) — os valores
   (qualquer coisa; null e undefined valem '').
   Devolve: o texto dos atributos, com um espaço à frente, pronto a entrar numa etiqueta. */
var ligarA = function (tipo, nome, args) {
  return ' data-' + tipo + '="' + esc(nome) + '"' + (args || []).map(function (v, i) {
    return ' data-arg' + (i ? i + 1 : '') + '="' + esc(v) + '"';
  }).join('');
};
// O clique num elemento chama a ação nome com os valores args (ligarA com 'acao').
// Recebe: nome — o nome da ação em ACOES; args (opcional) — os valores.
// Devolve: o texto dos atributos.
var comAcao = function (nome, args) { return ligarA('acao', nome, args); };
var el = function (id) { return document.getElementById(id); };
var data = function (t) { return t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '—'; };
var kb = function (n) {
  if (!(n > 0)) return '0 KB';
  if (n < 1048576) return Math.max(1, Math.round(n / 1024)) + ' KB';
  return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
};
// a idade de uma coisa, dita como se diz: "há 3 h", "há 2 dias"
var idade = function (t) {
  if (!t) return 'nunca';
  var m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return 'há ' + m + ' min';
  if (m < 48 * 60) return 'há ' + Math.round(m / 60) + ' h';
  return 'há ' + Math.round(m / 1440) + ' dias';
};

/* fetch com as regras da casa: cookies de sessão, resposta lida como JSON,
   um 401 recarrega a página (a sessão morreu, volta-se ao ecrã de entrada)
   e qualquer outro falhanço vira Error com a mensagem do servidor
   Recebe: rota — o caminho da API (string, ex.: /api/equipa/pedidos);
   opcoes (opcional) — opções do fetch (método, cabeçalhos, corpo).
   Devolve: Promise com o JSON da resposta; rejeita com Error quando o pedido falha. */
function pedir(rota, opcoes) {
  return fetch(rota, Object.assign({ credentials: 'same-origin' }, opcoes || {}))
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { location.reload(); throw new Error('sessão terminada'); }
        if (!r.ok) throw new Error(j.error || ('Erro ' + r.status));
        return j;
      });
    });
}
// POST em JSON por cima de pedir; sem corpo vai um {} vazio
// Recebe: rota — o caminho da API (string); corpo (opcional) — o objeto a serializar em JSON.
// Devolve: Promise com o JSON da resposta, como pedir.
function enviar(rota, corpo) {
  return pedir(rota, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo || {}),
  });
}
// termina a sessão de equipa no servidor e recarrega — cai no ecrã de entrada
// Devolve: nada — recarrega a página.
function sair() {
  pedir('/api/equipa/sair', { method: 'POST' }).then(function () { location.reload(); });
}
// mostra a mensagem do erro no lugar do conteúdo (o .catch das vistas)
// Recebe: e — o Error apanhado, com a mensagem a mostrar.
// Devolve: nada — substitui o conteúdo pela mensagem.
function falha(e) { el('conteudo').innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; }
// substitui o conteúdo pelo "A carregar…" enquanto a rede responde
// Devolve: nada — redesenha o conteúdo.
function aCarregar() { el('conteudo').innerHTML = '<div class="vazio">A carregar…</div>'; }

// o distintivo de estado de um pedido: verde concluído, âmbar em resolução
// Recebe: p — o pedido (objeto com status: criado, resolucao ou concluido).
// Devolve: string HTML com o distintivo, pronta a inserir.
function selo(p) {
  var c = p.status === 'concluido' ? 'ok' : p.status === 'resolucao' ? 'wa' : '';
  return '<span class="badge ' + c + '">' + (ESTADOS[p.status] || p.status) + '</span>';
}

/* ------------------------------- navegação ------------------------------ */

var SECCOES = [
  { id: 'pedidos', nome: 'Pedidos', se: eu.cats.indexOf('user') > -1 },
  { id: 'erros', nome: 'Erros', se: eu.cats.some(function (c) { return c !== 'user'; }) },
  { id: 'pessoas', nome: 'Pessoas', se: eu.cats.indexOf('user') > -1 },
  { id: 'operacao', nome: 'Operação', se: eu.cats.indexOf('infra') > -1 },
  { id: 'rasto', nome: 'Rasto', se: eu.master },
];

// pinta os separadores do cabeçalho — só os que os papéis deixam ver —
// e marca o ativo; guarda a secção atual em seccao
// Recebe: ativa — o id da secção a marcar (string: pedidos, erros, pessoas, operacao ou rasto).
// Devolve: nada — redesenha os separadores.
function nav(ativa) {
  seccao = ativa;
  el('nav').innerHTML = SECCOES.filter(function (s) { return s.se; }).map(function (s) {
    return '<button class="btn mini' + (s.id === ativa ? ' on' : '') + '"' + comAcao('ir', [s.id]) + '>' + s.nome + '</button>';
  }).join('');
}
// muda de secção: marca o separador e abre a vista respetiva
// Recebe: s — o id da secção de destino (string, um dos ids de SECCOES).
// Devolve: nada — abre a vista.
function ir(s) {
  nav(s);
  if (s === 'pedidos') verLista('pessoas', 'abertos');
  else if (s === 'erros') verLista('erros', 'abertos');
  else if (s === 'pessoas') verPessoas();
  else if (s === 'operacao') verOperacao();
  else if (s === 'rasto') verRasto();
}

/* ------------------------- pedidos e erros (lista) ----------------------- */

/* A lista de pedidos (tipo 'pessoas') ou de erros (tipo 'erros'), filtrada
   no servidor: e é o estado ('abertos' ou '' para todos) e q o texto da
   procura, feita com Enter no campo. O filtro fica na variável estado para
   a procura não o perder; cada cartão abre o detalhe.
   Recebe: tipo — 'pessoas' ou 'erros' (string); e — o estado do filtro
   ('abertos' ou '' para todos); q (opcional) — o texto da procura.
   Devolve: nada — redesenha a vista com a lista. */
function verLista(tipo, e, q) {
  estado = e;
  var url = '/api/equipa/pedidos?tipo=' + tipo + '&estado=' + encodeURIComponent(e) +
    (q ? '&q=' + encodeURIComponent(q) : '');
  aCarregar();
  pedir(url).then(function (d) {
    var topo = '<div class="tabs">' +
      '<button class="btn' + (e === 'abertos' ? ' on' : '') + '"' + comAcao('verLista', [tipo, 'abertos']) + '>Por tratar</button>' +
      '<button class="btn' + (e === '' ? ' on' : '') + '"' + comAcao('verLista', [tipo, '']) + '>Todos</button>' +
      '<input id="q" class="procura" placeholder="Procurar por assunto, texto, nome ou email…" value="' + esc(q || '') + '"' +
      ligarA('enter', 'procurarLista', [tipo]) + '>' +
      '</div>';
    if (!d.pedidos.length) {
      el('conteudo').innerHTML = topo + '<div class="vazio">Nada aqui' + (q ? ' para “' + esc(q) + '”' : '') + '.</div>';
      return;
    }
    el('conteudo').innerHTML = topo + d.pedidos.map(function (p) {
      var quem = p.nome || p.email || p.user_id;
      return '<div class="card tap"' + comAcao('verPedido', [p.id]) + '>' +
        '<div class="row"><div class="min0">' +
        '<b>' + esc(p.subject) + '</b>' +
        '<div class="small">' + esc(quem) + ' · ' + (CATS[p.category] || p.category) +
        ' · ' + data(p.created_at) +
        (p.n > 1 ? ' · ×' + p.n : '') +
        (p.pessoas > 1 ? ' · ' + p.pessoas + ' pessoas' : '') +
        (p.versao ? ' · v' + esc(p.versao) : '') +
        (p.assignee_nome ? ' · com ' + esc(p.assignee_nome) : '') + '</div></div>' +
        selo(p) + '</div></div>';
    }).join('');
  }).catch(falha);
}

/* --------------------------- um pedido (detalhe) ------------------------- */

/* O detalhe de um pedido: o texto e o contexto, a ficha de quem escreveu,
   o fio de respostas e notas internas, os outros pedidos da mesma pessoa
   e a caixa de responder com as respostas-tipo. Os modelos carregam-se à
   primeira vez e ficam em cache na variável modelos.
   Recebe: id — o id do pedido (string, como vem dos cartões da lista).
   Devolve: nada — redesenha a vista com o detalhe. */
function verPedido(id) {
  aCarregar();
  var m = modelos == null ? pedir('/api/equipa/modelos').then(function (d) { modelos = d.modelos; }) : Promise.resolve();
  Promise.all([pedir('/api/equipa/pedidos/' + encodeURIComponent(id)), m]).then(function (rs) {
    var d = rs[0], p = d.pedido, q = d.quem;

    var fichaHtml = '';
    if (q && !q.desconhecido) {
      fichaHtml = '<div class="card"><b>Quem escreveu</b>' +
        '<div class="stat"><span>Nome</span><b>' + esc(q.nome || '—') + '</b></div>' +
        '<div class="stat"><span>Email</span><b>' + esc(q.email) + '</b></div>' +
        '<div class="stat"><span>Na app desde</span><b>' + data(q.desde).slice(0, 10) + '</b></div>' +
        '<div class="stat"><span>Casas · registos</span><b>' + q.casas + ' · ' + q.registos + '</b></div>' +
        (q.errosApanhados ? '<div class="stat"><span>Erros que apanhou</span><b>' + q.errosApanhados + '</b></div>' : '') +
        (q.suspensa ? '<div class="stat"><span></span><b class="badge dg">conta suspensa</b></div>' : '') +
        (q.apagada ? '<div class="stat"><span></span><b class="badge dg">conta apagada</b></div>' : '') +
        (q.aceitouTermos ? '' : '<div class="stat"><span></span><b class="badge wa">não aceitou os termos</b></div>') +
        (eu.cats.indexOf('user') > -1
          ? '<div class="acoes"><button class="btn mini"' + comAcao('verPessoa', [q.id]) + '>Abrir a ficha completa</button></div>'
          : '') +
        '</div>';
    } else if (q) {
      fichaHtml = '<div class="card"><b>Quem escreveu</b><div class="small">Conta já não existe (' + esc(q.id) + ').</div></div>';
    }

    // o fio: respostas que a pessoa vê, notas que só a equipa vê
    var fio = (d.msgs || []).map(function (x) {
      return '<div class="msg' + (x.tipo === 'nota' ? ' nota' : '') + '">' +
        '<div class="small">' + (x.tipo === 'nota' ? 'nota interna · ' : '') +
        esc(x.nome || x.autor) + ' · ' + data(x.at) + '</div>' + esc(x.texto) + '</div>';
    }).join('');
    // resposta de antes do fio existir (ou escrita por um caminho antigo):
    // está na coluna reply e a pessoa vê-a — a equipa também tem de a ver
    if (!(d.msgs || []).some(function (x) { return x.tipo === 'resposta'; }) && p.reply) {
      fio = '<div class="msg"><div class="small">resposta enviada (registo antigo)</div>' +
        esc(p.reply) + '</div>' + fio;
    }

    var anteriores = (d.outros || []).length
      ? '<div class="card"><b>Outros pedidos desta pessoa</b>' + d.outros.map(function (o) {
          return '<div class="stat clicavel"' + comAcao('verPedido', [o.id]) + '>' +
            '<span>' + esc(o.subject) + '</span><b class="small">' + (ESTADOS[o.status] || o.status) + '</b></div>';
        }).join('') + '</div>'
      : '';

    var opcoesModelo = (modelos || []).map(function (x, i) {
      return '<option value="' + i + '">' + esc(x.titulo) + '</option>';
    }).join('');

    var meu = p.assignee === eu.discordId;
    var voltar = p.category === 'user' ? 'pedidos' : 'erros';

    el('conteudo').innerHTML =
      '<button class="btn voltar"' + comAcao('ir', [voltar]) + '>← Voltar</button>' +
      '<div class="card"><div class="row"><div class="min0">' +
      '<b class="grande">' + esc(p.subject) + '</b>' +
      '<div class="small">' + (CATS[p.category] || p.category) + ' · ' + data(p.created_at) +
      (p.n > 1 ? ' · ×' + p.n : '') +
      (p.versao ? ' · versão ' + esc(p.versao) : '') +
      (p.assignee_nome ? ' · com ' + esc(p.assignee_nome) : '') + '</div></div>' + selo(p) + '</div>' +
      '<pre>' + esc(p.body) + '</pre>' +
      (p.context ? '<div class="small mt8">' + esc(p.context) + '</div>' : '') +
      fio +
      '<div class="acoes">' +
      '<button class="btn mini"' + comAcao('agir', [p.id, 'atribuir']) + '>' + (meu ? 'Largar isto' : 'Tratar disto eu') + '</button>' +
      '<select id="catNova" class="sel-mini">' +
      Object.keys(CATS).map(function (c) {
        return '<option value="' + c + '"' + (c === p.category ? ' selected' : '') + '>' + CATS[c] + '</option>';
      }).join('') + '</select>' +
      '<button class="btn mini"' + comAcao('mudarCategoria', [p.id]) + '>Mudar categoria</button>' +
      '</div></div>' +
      fichaHtml + anteriores +
      '<div class="card"><b>Responder</b>' +
      (opcoesModelo
        ? '<div class="acoes m-8-0-2"><select id="modelo" class="flex1"' + ligarA('mudar', 'usarModelo') + '>' +
          '<option value="">— resposta-tipo —</option>' + opcoesModelo + '</select>' +
          '<button class="btn mini"' + comAcao('guardarModelo') + '>Guardar como modelo</button></div>'
        : '<div class="acoes m-8-0-2"><button class="btn mini"' + comAcao('guardarModelo') + '>Guardar como modelo</button></div>') +
      '<textarea id="resposta" placeholder="A pessoa vê isto na app, em Ajuda e sugestões."></textarea>' +
      '<div class="acoes">' +
      '<button class="btn primary"' + comAcao('agir', [p.id, 'responder']) + '>Responder</button>' +
      '<button class="btn"' + comAcao('agir', [p.id, 'fechar']) + '>Responder e concluir</button>' +
      '<button class="btn"' + comAcao('agir', [p.id, 'nota']) + '>Guardar como nota interna</button>' +
      (p.status === 'concluido' ? '<button class="btn"' + comAcao('agir', [p.id, 'reabrir']) + '>Reabrir</button>' : '') +
      '</div></div>';
  }).catch(falha);
}

// executa uma ação sobre o pedido (responder, fechar, nota, atribuir,
// reabrir) com o texto da caixa; responder e nota exigem texto escrito
// Recebe: id — o id do pedido (string); acao — a ação (string: responder,
// fechar, nota, atribuir ou reabrir).
// Devolve: nada — executa no servidor e reabre o detalhe.
function agir(id, acao) {
  var t = el('resposta') ? el('resposta').value.trim() : '';
  if ((acao === 'responder' || acao === 'nota') && !t) { alert('Escreve o texto primeiro.'); return; }
  enviar('/api/equipa/pedidos/' + encodeURIComponent(id) + '/' + acao, { texto: t })
    .then(function () { verPedido(id); }).catch(function (e) { alert(e.message); });
}
// muda a categoria do pedido para a escolhida no seletor e reabre o detalhe
// Recebe: id — o id do pedido (string).
// Devolve: nada — grava no servidor e reabre o detalhe.
function mudarCategoria(id) {
  enviar('/api/equipa/pedidos/' + encodeURIComponent(id) + '/categoria', { categoria: el('catNova').value })
    .then(function () { verPedido(id); }).catch(function (e) { alert(e.message); });
}
// copia a resposta-tipo escolhida para a caixa, por cima do que lá estiver
// Devolve: nada — preenche a caixa de resposta.
function usarModelo() {
  var i = el('modelo').value;
  if (i === '') return;
  el('resposta').value = (modelos[Number(i)] || {}).texto || '';
}
// guarda o texto da caixa como resposta-tipo nova (o nome vem de um prompt)
// e deita fora a cache, para a lista vir fresca no próximo pedido
// Devolve: nada — grava no servidor e esvazia a cache dos modelos.
function guardarModelo() {
  var t = el('resposta').value.trim();
  if (!t) { alert('Escreve primeiro o texto do modelo.'); return; }
  var titulo = prompt('Nome do modelo (aparece na lista):');
  if (!titulo) return;
  enviar('/api/equipa/modelos', { titulo: titulo, texto: t })
    .then(function () { modelos = null; alert('Guardado.'); }).catch(function (e) { alert(e.message); });
}

/* ------------------------------- pessoas -------------------------------- */

/* A procura de contas por email, nome ou id. Só vai à rede com 3 ou mais
   caracteres — menos que isso era pedir meia base de dados. Cada resultado
   abre a ficha; o master tem ainda o botão de criar conta.
   Recebe: q (opcional) — o texto da procura (string; só procura com 3+ caracteres).
   Devolve: nada — redesenha a vista com os resultados. */
function verPessoas(q) {
  var topo = '<div class="tabs">' +
    '<input id="q" class="procura" placeholder="Procurar por email, nome ou id…" value="' + esc(q || '') + '"' +
    ligarA('enter', 'procurarPessoas') + '>' +
    '<button class="btn"' + comAcao('procurarPessoas') + '>Procurar</button>' +
    (eu.master ? '<button class="btn mini"' + comAcao('criarConta') + '>Criar conta</button>' : '') + '</div>';
  if (!q || q.length < 3) {
    el('conteudo').innerHTML = topo + '<div class="vazio">Procura por email, nome ou id (3+ caracteres).</div>';
    return;
  }
  aCarregar();
  pedir('/api/equipa/pessoas?q=' + encodeURIComponent(q)).then(function (d) {
    el('conteudo').innerHTML = topo + (!d.pessoas.length
      ? '<div class="vazio">Ninguém com “' + esc(q) + '”.</div>'
      : d.pessoas.map(function (u) {
          return '<div class="card tap"' + comAcao('verPessoa', [u.id]) + '><div class="row">' +
            '<div class="min0"><b>' + esc(u.name || u.email) + '</b>' +
            '<div class="small">' + esc(u.email) + ' · ' + esc(u.id) + '</div></div>' +
            (u.deleted_at ? '<span class="badge dg">apagada</span>'
              : u.suspended_at ? '<span class="badge dg">suspensa</span>' : '') +
            '</div></div>';
        }).join(''));
  }).catch(falha);
}

/* Um formulário pequeno num <dialog>, para o que não cabe num prompt():
   vários campos de uma vez, e os segredos num campo de palavra-passe, que
   não os mostra a quem estiver ao lado do ecrã. Ao confirmar, lê os valores,
   esvazia o diálogo (a palavra-passe não fica no DOM depois de usada) e
   entrega-os; cancelar ou Esc não entregam nada.
   Recebe: titulo — o título do formulário (texto); campos — lista de
   { nome, rotulo, tipo } (o tipo do input, 'text' por omissão); aoConfirmar
   — função que recebe { nome: valor } com o que se escreveu.
   Devolve: nada — abre o diálogo. */
function formulario(titulo, campos, aoConfirmar) {
  var d = el('dialogo');
  d.innerHTML = '<form method="dialog" class="card form-dialogo">' +
    '<b>' + esc(titulo) + '</b>' +
    campos.map(function (c) {
      return '<label class="small rotulo-campo">' + esc(c.rotulo) +
        '<input name="' + esc(c.nome) + '" type="' + esc(c.tipo || 'text') + '"' +
        (c.tipo === 'password' ? ' autocomplete="new-password"' : ' autocomplete="off"') + '></label>';
    }).join('') +
    '<div class="acoes"><button class="btn primary" value="ok">Confirmar</button>' +
    '<button class="btn" value="cancelar" formnovalidate>Cancelar</button></div></form>';
  d.returnValue = '';
  d.onclose = function () {
    var confirmou = d.returnValue === 'ok';
    var valores = {};
    if (confirmou) {
      campos.forEach(function (c) {
        var i = d.querySelector('[name="' + c.nome + '"]');
        // a palavra-passe vai como foi escrita; o resto sem espaços à volta
        valores[c.nome] = !i ? '' : c.tipo === 'password' ? i.value : i.value.trim();
      });
    }
    d.onclose = null;
    d.innerHTML = '';
    if (confirmou) aoConfirmar(valores);
  };
  d.showModal();
}

/* Criar uma conta à mão: para a equipa, para um teste com email verdadeiro,
   para quem pede ajuda a entrar. O servidor recusa emails repetidos. Os
   dados pedem-se num formulário, e a palavra-passe num campo de
   palavra-passe — num prompt() ficava em claro no ecrã.
   Devolve: nada — abre o formulário; ao confirmar, cria no servidor e abre a ficha. */
function criarConta() {
  formulario('Criar conta', [
    { nome: 'email', rotulo: 'Email da conta nova', tipo: 'email' },
    { nome: 'nome', rotulo: 'Nome (vazio usa o email)' },
    { nome: 'password', rotulo: 'Palavra-passe (8+, com maiúscula, minúscula, número e símbolo)', tipo: 'password' },
    { nome: 'motivo', rotulo: 'Motivo (fica no rasto)' },
  ], function (v) {
    if (!v.email || !v.password || !v.motivo) { alert('Falta o email, a palavra-passe ou o motivo.'); return; }
    enviar('/api/equipa/pessoas', { email: v.email, nome: v.nome, password: v.password, motivo: v.motivo })
      .then(function (d) { alert('Criada: ' + d.email + ' (' + d.id + ')'); verPessoa(d.id); })
      .catch(function (e) { alert(e.message); });
  });
}

/* A ficha completa de uma conta: dados e atividade, ligações e partilhas,
   propostas de quotas pendentes, limites ativos e os pedidos que fez.
   O cartão de ações só aparece quando o servidor diz que quem vê é master.
   Recebe: id — o id da conta (string).
   Devolve: nada — redesenha a vista com a ficha. */
function verPessoa(id) {
  nav('pessoas');
  aCarregar();
  pedir('/api/equipa/pessoas/' + encodeURIComponent(id)).then(function (d) {
    var q = d.quem;
    var ligacoes = (q.ligacoes || []).length
      ? '<div class="card"><b>Ligações e partilhas</b>' + q.ligacoes.map(function (l) {
          return '<div class="stat"><span>' + esc(l.outro_nome || l.outro_email) +
            ' <span class="small">(' + esc(l.outro_id) + ' · ' + l.sentido + ')</span></span>' +
            '<b>' + (l.status === 'accepted' ? l.casas_partilhadas + ' casas' : 'pendente') + '</b></div>';
        }).join('') + '</div>'
      : '';
    var propostas = (q.propostas || []).length
      ? '<div class="card"><b>Propostas de quotas por resolver</b>' + q.propostas.map(function (p) {
          return '<div class="stat"><span>casa ' + esc(p.house_id) + '</span><b>' + data(p.created_at).slice(0, 10) + '</b></div>';
        }).join('') + '</div>'
      : '';
    var limites = (q.limites || []).length
      ? '<div class="card"><b>Limites ativos</b>' + q.limites.map(function (l) {
          return '<div class="stat"><span>' + esc(l.k) + '</span><b>' + l.n + ' · até ' + data(l.expires_at).slice(11) + '</b></div>';
        }).join('') + '</div>'
      : '';
    var pedidos = (d.pedidos || []).length
      ? '<div class="card"><b>Pedidos</b>' + d.pedidos.map(function (o) {
          return '<div class="stat clicavel"' + comAcao('verPedido', [o.id]) + '>' +
            '<span>' + esc(o.subject) + '</span><b class="small">' + (ESTADOS[o.status] || o.status) + '</b></div>';
        }).join('') + '</div>'
      : '';

    el('conteudo').innerHTML =
      '<button class="btn voltar"' + comAcao('verPessoas') + '>← Voltar</button>' +
      '<div class="card"><div class="row"><div class="min0">' +
      '<b class="grande">' + esc(q.nome || q.email) + '</b>' +
      '<div class="small">' + esc(q.email) + ' · ' + esc(q.id) + '</div></div>' +
      (q.suspensa ? '<span class="badge dg">suspensa</span>' : q.apagada ? '<span class="badge dg">apagada</span>' : '<span class="badge ok">ativa</span>') +
      '</div>' +
      '<div class="stat"><span>Entra com</span><b>' + esc(q.entrada) + '</b></div>' +
      '<div class="stat"><span>Na app desde</span><b>' + data(q.desde).slice(0, 10) + '</b></div>' +
      '<div class="stat"><span>Última atividade</span><b>' + idade(q.ultimaAtividade) + '</b></div>' +
      (q.versaoApp ? '<div class="stat"><span>Versão da app</span><b>' + esc(q.versaoApp) + '</b></div>' : '') +
      '<div class="stat"><span>Casas · registos</span><b>' + q.casas + ' · ' + q.registos + '</b></div>' +
      '<div class="stat"><span>Pedidos · erros apanhados</span><b>' + q.pedidos + ' · ' + q.errosApanhados + '</b></div>' +
      '<div class="stat"><span>Termos</span><b>' + (q.termos ? esc(q.termos) : '<span class="badge wa">por aceitar</span>') + '</b></div>' +
      '</div>' +
      (d.master ? cartaoAcoes(q) : '') +
      '<div id="servicosCard"></div>' +
      ligacoes + propostas + limites + pedidos;
    // os serviços chegam à parte: a ficha já está no ecrã, e um erro aqui fica no cartão
    verServicos(q.id);
  }).catch(falha);
}

/* As ações sobre a conta. Cada uma pede o motivo — é o que daqui a seis
   meses distingue "porque foi preciso" de "ninguém sabe".
   Recebe: q — a ficha da conta (objeto com id, entrada e suspensa, entre o resto).
   Devolve: string HTML com o cartão de ações, pronta a inserir. */
function cartaoAcoes(q) {
  var b = function (acao, nome, classe) {
    return '<button class="btn mini ' + (classe || '') + '"' + comAcao('acaoConta', [q.id, acao]) + '>' + nome + '</button>';
  };
  return '<div class="card"><b>Ações</b><div class="small m-2-0-6">' +
    'Tudo isto fica no rasto, com o motivo.</div><div class="acoes">' +
    b('sessoes', 'Terminar sessões') +
    b('limpar-limites', 'Limpar limites') +
    b('email', 'Mudar email') +
    b('password', 'Definir palavra-passe') +
    (q.entrada.indexOf('google') > -1 ? b('desligar-google', 'Desligar Google') : '') +
    (q.suspensa ? b('reativar', 'Reativar', 'primary') : b('suspender', 'Suspender', 'danger')) +
    b('apagar', 'Apagar de vez', 'danger') +
    '</div></div>';
}

/* Dispara uma ação de master sobre a conta. Umas pedem primeiro um valor
   (o email novo; apagar pede o email exato da conta como confirmação; a
   palavra-passe pede-se num formulário, com campo de palavra-passe, e não
   num prompt() em claro) e todas pedem o motivo — sem motivo não acontece
   nada.
   Recebe: id — o id da conta (string); acao — a ação (string: sessoes,
   limpar-limites, email, password, desligar-google, suspender,
   reativar ou apagar).
   Devolve: nada — executa no servidor e recarrega a ficha. */
function acaoConta(id, acao) {
  if (acao === 'password') {
    formulario('Palavra-passe nova', [
      { nome: 'valor', rotulo: 'Palavra-passe nova (8+, com maiúscula, minúscula, número e símbolo). As sessões abertas terminam todas.', tipo: 'password' },
      { nome: 'motivo', rotulo: 'Motivo (fica no rasto)' },
    ], function (v) {
      if (!v.valor || !v.motivo) { alert('Falta a palavra-passe ou o motivo.'); return; }
      fazerAcaoConta(id, acao, v.valor, v.motivo);
    });
    return;
  }
  var valor;
  if (acao === 'email') {
    valor = prompt('Novo email desta conta:');
    if (!valor) return;
  } else if (acao === 'apagar') {
    valor = prompt('Apagar APAGA MESMO: casas, registos, partilhas, tudo.\nPara confirmar, escreve o email exato da conta:');
    if (!valor) return;
  }
  var motivo = prompt('Motivo (fica no rasto):');
  if (!motivo) return;
  if (acao === 'suspender' && !confirm('Suspender a conta? A pessoa deixa de conseguir entrar até ser reativada.')) return;
  fazerAcaoConta(id, acao, valor, motivo);
}

// Manda a ação de conta ao servidor; com a resposta, diz o resultado e recarrega a ficha.
// Recebe: id — o id da conta (string); acao — a ação (string); valor — o que a
// ação pede (email, palavra-passe, a confirmação de apagar; ou nada); motivo — o motivo, que fica no rasto.
// Devolve: nada — executa no servidor e recarrega a ficha.
function fazerAcaoConta(id, acao, valor, motivo) {
  enviar('/api/equipa/pessoas/' + encodeURIComponent(id) + '/acao', { acao: acao, valor: valor, motivo: motivo })
    .then(function (d) { alert(d.resultado); verPessoa(id); })
    .catch(function (e) { alert(e.message); });
}

/* ------------------------- os serviços da conta ------------------------- */

// a última lista pintada, para a confirmação ao desligar saber quem cai junto
var servicosVistos = [];

/* O cartão «Serviços» da ficha: cada separador da app é um serviço que se
   pode desligar a esta conta. Vai buscar a lista ao servidor e pinta-a por
   pintarServicos; o resto da ficha já está no ecrã, por isso um erro aqui
   fica dentro do cartão em vez de deitar a ficha abaixo.
   Recebe: id — o id da conta (string).
   Devolve: nada — preenche o cartão servicosCard. */
function verServicos(id) {
  el('servicosCard').innerHTML = '<div class="card"><b>Serviços</b><div class="small">A carregar…</div></div>';
  pedir('/api/equipa/pessoas/' + encodeURIComponent(id) + '/servicos')
    .then(function (d) { pintarServicos(id, d.servicos); })
    .catch(function (e) {
      el('servicosCard').innerHTML = '<div class="card"><b>Serviços</b><div class="small">' + esc(e.message) + '</div></div>';
    });
}

/* Os serviços que dependem de um: os que o requerem, e os que requerem
   esses, pela ordem do catálogo — a mesma regra do fecho que o servidor
   aplica ao desligar, calculada aqui só para se mostrar antes de confirmar.
   Recebe: lista — os serviços (array de {id, nome, ligado, requer}); id — o serviço de que se parte.
   Devolve: array com os serviços dependentes (objetos da lista), sem o próprio. */
function dependentesDoServico(lista, id) {
  var fora = {};
  fora[id] = true;
  var mudou = true;
  while (mudou) {
    mudou = false;
    lista.forEach(function (s) {
      if (!fora[s.id] && s.requer.some(function (r) { return fora[r]; })) { fora[s.id] = true; mudou = true; }
    });
  }
  return lista.filter(function (s) { return fora[s.id] && s.id !== id; });
}

/* Pinta o cartão: uma linha por serviço com o nome, o estado, os que
   dependem dele e o botão de ligar ou desligar. Um serviço desligado cujo
   requerido também está desligado não tem botão — o servidor recusava, e
   é mais claro dizer logo o que ligar primeiro.
   Recebe: id — o id da conta (string); lista — os serviços (array de {id, nome, ligado, requer}).
   Devolve: nada — redesenha o cartão servicosCard. */
function pintarServicos(id, lista) {
  servicosVistos = lista;
  var porId = {};
  lista.forEach(function (s) { porId[s.id] = s; });
  var b = function (servico, ligar, nome, classe) {
    return '<button class="btn mini ' + (classe || '') + '"' + comAcao('mudarServico', [id, servico, ligar ? 'ligar' : 'desligar']) + '>' + nome + '</button>';
  };
  var linhas = lista.map(function (s) {
    var dep = dependentesDoServico(lista, s.id).map(function (x) { return x.nome; });
    var faltam = s.requer.filter(function (r) { return porId[r] && !porId[r].ligado; })
      .map(function (r) { return porId[r].nome; });
    var controlo = s.ligado
      ? '<span class="badge ok">ligado</span> ' + b(s.id, false, 'Desligar')
      : faltam.length
        ? '<span class="badge">desligado</span> <span class="small">liga primeiro ' + esc(faltam.join(', ')) + '</span>'
        : '<span class="badge">desligado</span> ' + b(s.id, true, 'Ligar', 'primary');
    return '<div class="stat"><span>' + esc(s.nome) +
      (dep.length ? '<div class="small">Dependem dele: ' + esc(dep.join(', ')) + '</div>' : '') +
      '</span><b class="nowrap">' + controlo + '</b></div>';
  }).join('');
  el('servicosCard').innerHTML = '<div class="card"><b>Serviços</b><div class="small m-2-0-8">' +
    'Cada separador da app é um serviço. Desligar um tira esse separador da app desta pessoa e os dados ' +
    'desse serviço deixam de sair do servidor — nada é apagado, e ao ligar outra vez volta tudo como estava. ' +
    'Os serviços que dependem de um desligado desligam-se com ele.</div>' + linhas + '</div>';
}

/* Liga ou desliga um serviço desta conta. Desligar pede confirmação e diz
   quais caem junto (os dependentes que ainda estão ligados); ligar não pede
   — não tira nada a ninguém. O servidor devolve a lista nova e o cartão
   repinta-se com ela; a recusa (ligar sem os requeridos) aparece tal como
   o servidor a diz.
   Recebe: id — o id da conta (string); servico — o id do serviço (string);
   ligado — true para ligar, false para desligar.
   Devolve: nada — grava no servidor e repinta o cartão. */
function mudarServico(id, servico, ligado) {
  var nome = servico;
  servicosVistos.forEach(function (s) { if (s.id === servico) nome = s.nome; });
  if (!ligado) {
    var caem = dependentesDoServico(servicosVistos, servico)
      .filter(function (s) { return s.ligado; }).map(function (s) { return s.nome; });
    var aviso = 'Desligar ' + nome + ' a esta conta?\n\n' +
      (caem.length ? 'Desligam-se também, porque dependem dele: ' + caem.join(', ') + '.\n\n' : '') +
      'O separador some da app da pessoa e os dados deste serviço deixam de sair do servidor. ' +
      'Nada é apagado — ao ligar outra vez, volta tudo como estava.';
    if (!confirm(aviso)) return;
  }
  pedir('/api/equipa/pessoas/' + encodeURIComponent(id) + '/servicos/' + encodeURIComponent(servico), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ligado: ligado }),
  }).then(function (d) { pintarServicos(id, d.servicos); })
    .catch(function (e) { alert(e.message); });
}

/* ------------------------------- operação ------------------------------- */

// o que se espera de cada operação agendada; passado o dobro, é alarme
var CADENCIA = { copia: 26, vigia: 2, resumo: 26 };   // horas
var OPS = { copia: 'Cópia diária', vigia: 'Vigia dos limites', resumo: 'Resumo diário' };

/* O painel de operação inteiro: sessão de teste (fora
   de produção), o batimento das operações agendadas, os endereços de email,
   as cópias no R2 com o histórico e o consumo. Os endereços chegam à parte,
   por verEnderecos — o resto do painel não fica à espera do Cloudflare.
   Devolve: nada — redesenha a vista com o painel. */
function verOperacao() {
  aCarregar();
  pedir('/api/equipa/operacao').then(function (d) {
    var consumo = '<div class="card"><b>Consumo</b>' + (d.consumo || []).map(function (f) {
      return '<div class="stat"><span>' + esc(f.name) + '</span><b>' + esc(f.value) + '</b></div>';
    }).join('') + '</div>';

    var vistos = {};
    (d.crons || []).forEach(function (c) { vistos[c.op] = c; });
    var batimento = '<div class="card"><b>Batimento</b><div class="small m-2-0-6">' +
      'Cada operação agendada deixa rasto ao correr. O alarme é a ausência.</div>' +
      Object.keys(OPS).map(function (op) {
        var c = vistos[op];
        var horas = c ? (Date.now() - c.at) / 3600000 : Infinity;
        var classe = !c ? 'dg' : horas > CADENCIA[op] ? 'dg' : c.ok ? 'ok' : 'wa';
        var texto = !c ? 'nunca correu' : idade(c.at) + (c.ok ? '' : ' · falhou');
        return '<div class="stat"><span>' + OPS[op] + '</span><b><span class="badge ' + classe + '">' + texto + '</span></b></div>';
      }).join('') + '</div>';

    var copias = '<div class="card"><div class="row"><b>Cópias no R2</b>' +
      '<button class="btn mini"' + comAcao('copiarAgora') + '>Copiar agora</button></div>' +
      '<div class="small m-4-0-8">' + esc((d.estadoCopias || {}).texto || '') + '</div>' +
      ((d.copias || []).length ? '<div class="rolavel"><table><tr><th>Dia</th><th class="num">Tamanho</th><th></th></tr>' +
        d.copias.map(function (c) {
          var dia = (c.key.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || c.key;
          return '<tr><td>' + esc(dia) + '</td><td class="num">' + kb(c.size) + '</td>' +
            '<td class="dir nowrap">' +
            '<button class="btn mini"' + comAcao('resumoCopia', [dia]) + '>Verificar</button>' +
            // descarregar é sair com a base inteira: só o master (o servidor recusa-o aos outros)
            (d.master ? ' <a class="btn mini" href="/api/equipa/operacao/copias/' + esc(encodeURIComponent(dia)) +
              '/descarregar">Descarregar</a>' : '') + '</td></tr>';
        }).join('') + '</table></div>' : '<div class="vazio">Nenhuma cópia.</div>') + '</div>';

    var historico = (d.historico || []).length
      ? '<div class="card"><b>Últimas cópias</b>' + d.historico.slice(0, 10).map(function (h) {
          var det = {};
          try { det = JSON.parse(h.detalhe || '{}'); } catch (e) {}
          return '<div class="stat"><span>' + data(h.at) + (det.manual ? ' · manual' : '') + '</span><b>' +
            (h.ok ? (det.linhas || '?') + ' linhas · ' + kb(det.bytes) + ' · ' + (det.ms || '?') + ' ms' +
              (det.modo === 'memoria' ? ' · <span class="badge wa">memória</span>' : '')
              : '<span class="badge dg">falhou</span>') + '</b></div>';
        }).join('') + '</div>'
      : '';

    /* fora de produção: uma sessão de teste a um clique — a mesma ligação
       que o /test do Discord dá, com a mesma lavagem de contas */
    var teste = !d.teste ? '' :
      '<div class="card"><div class="row"><div class="min0"><b>Sessão de teste</b>' +
      '<div class="small">As contas de teste ficam de um dia para o outro: Retomar volta à mais recente com os dados intactos; Extra cria mais uma; Limpar apaga as tuas e começa do zero.</div></div>' +
      '<span class="nowrap"><button class="btn mini"' + comAcao('sessaoTeste', ['retomar']) + '>Retomar</button> ' +
      '<button class="btn mini"' + comAcao('sessaoTeste', ['extra-dados']) + '>Extra c/ dados</button> ' +
      '<button class="btn mini"' + comAcao('sessaoTeste', ['extra']) + '>Extra</button> ' +
      '<button class="btn mini danger"' + comAcao('sessaoTeste', ['limpar']) + '>Limpar</button></span></div>' +
      '<div id="ligTeste"></div></div>';

    var enderecos = '<div class="card"><div class="row"><div class="min0"><b>Endereços @rendorium.com</b>' +
      '<div class="small">Reencaminham para um destino verificado — não são caixas com palavra-passe. ' +
      'Enviar a partir de qualquer @rendorium.com já funciona pelo Resend.</div></div>' +
      (d.master ? '<button class="btn mini"' + comAcao('criarEndereco') + '>Criar endereço</button>' : '') +
      '</div><div id="emailCard" class="small mt8">A carregar…</div></div>';

    el('conteudo').innerHTML = teste + batimento + enderecos + copias + '<div id="resumoCopia"></div>' + historico + consumo;
    verEnderecos();
  }).catch(falha);
}

/* Preenche o cartão dos endereços de email: cada um com o destino para onde
   reencaminha, mais os destinos ainda por verificar. Sem CF_EMAIL_TOKEN no
   servidor, escreve a receita para o criar em vez de fingir que funciona.
   Devolve: nada — preenche o cartão emailCard. */
function verEnderecos() {
  pedir('/api/equipa/email').then(function (d) {
    if (d.semChave) {
      el('emailCard').innerHTML = 'Falta o token: cria no Cloudflare um API token com ' +
        '<b>Zone → Email Routing Rules → Edit</b>, <b>Zone → Zone → Read</b> (zona rendorium.com) e ' +
        '<b>Account → Email Routing Addresses → Edit</b>, guarda-o como segredo <code>CF_EMAIL_TOKEN</code> ' +
        'no GitHub e faz um deploy.';
      return;
    }
    var linhas = (d.enderecos || []).map(function (e) {
      return '<div class="stat"><span>' + esc(e.email) + (e.ativo ? '' : ' <span class="badge dg">desligado</span>') +
        '</span><b>→ ' + esc(e.destino || '—') + '</b></div>';
    }).join('') || '<div class="vazio">Nenhum endereço.</div>';
    var pendentes = (d.destinos || []).filter(function (x) { return !x.verificado; });
    el('emailCard').innerHTML = linhas + (pendentes.length
      ? '<div class="small mt6">Destinos à espera de verificação: ' +
        pendentes.map(function (x) { return esc(x.email); }).join(', ') + '</div>' : '');
  }).catch(function (e) { el('emailCard').innerHTML = '<span class="badge dg">' + esc(e.message) + '</span>'; });
}

// pede por prompt o nome, o destino (vazio usa o já verificado) e o motivo,
// e cria o endereço; mesmo em erro recarrega a lista — o servidor pode ter
// posto um destino novo à espera de verificação
// Devolve: nada — cria no servidor e recarrega a lista dos endereços.
function criarEndereco() {
  var nome = prompt('Endereço novo (só a parte antes do @, ex.: faturas):');
  if (!nome) return;
  var destino = prompt('Destino (vazio usa o destino já verificado):') || '';
  var motivo = prompt('Motivo (fica no rasto):');
  if (!motivo) return;
  enviar('/api/equipa/email', { endereco: nome, destino: destino, motivo: motivo })
    .then(function (d) { alert('Criado: ' + d.email + ' → ' + d.destino); verEnderecos(); })
    .catch(function (e) { alert(e.message); verEnderecos(); });
}

/* Pede uma ligação de sessão de teste — a mesma que o /test do Discord dá.
   comDados semeia dados de exemplo, manter cria uma conta extra em vez de
   retomar a mais recente, limpar apaga as contas de teste de quem pede
   (com confirmação). A ligação vale 10 minutos e aparece no cartão.
   Recebe: comDados — booleano, semeia dados de exemplo; manter — booleano,
   cria uma conta extra; limpar — booleano, apaga as contas de teste.
   Devolve: nada — escreve a ligação no cartão ligTeste. */
function sessaoTeste(comDados, manter, limpar) {
  if (limpar && !confirm('Apagar as TUAS contas de teste e o que têm dentro? As dos outros devs ficam.')) return;
  el('ligTeste').innerHTML = '<div class="small mt8">A emitir…</div>';
  enviar('/api/equipa/operacao/teste', { dados: comDados, manter: manter, limpar: limpar }).then(function (d) {
    el('ligTeste').innerHTML = '<div class="small mt8">Vale 10 minutos: ' +
      '<a href="' + esc(d.ligacao) + '" target="_blank" rel="noopener">abrir a sessão de teste</a></div>';
  }).catch(function (e) { el('ligTeste').innerHTML = ''; alert(e.message); });
}

// dispara uma cópia manual da base para o R2, com confirmação; no fim
// diz as linhas e o tamanho, e recarrega o painel
// Devolve: nada — dispara a cópia no servidor e recarrega o painel.
function copiarAgora() {
  if (!confirm('Fazer uma cópia da base agora?')) return;
  enviar('/api/equipa/operacao/copiar').then(function (d) {
    alert('Feita: ' + d.copia.linhas + ' linhas, ' + kb(d.copia.bytes) + '.');
    verOperacao();
  }).catch(function (e) { alert(e.message); });
}

/* A verificação de uma cópia: descomprime no servidor, conta por tabela, e
   compara com a base viva. Uma cópia truncada rebenta na descompressão; uma
   coxa aparece aqui com as contagens a divergir.
   Recebe: dia — o dia da cópia (string no formato AAAA-MM-DD).
   Devolve: nada — redesenha o cartão resumoCopia com as contagens. */
function resumoCopia(dia) {
  el('resumoCopia').innerHTML = '<div class="card"><div class="small">A verificar ' + esc(dia) + '…</div></div>';
  pedir('/api/equipa/operacao/copias/' + encodeURIComponent(dia) + '/resumo').then(function (d) {
    var linhas = Object.keys(d.tabelas).sort().map(function (t) {
      var copia = d.tabelas[t], viva = d.vivas[t];
      var nota = viva == null ? '<span class="badge wa">já não existe</span>'
        : viva === copia ? '' : (viva > copia ? '+' : '') + (viva - copia) + ' desde então';
      return '<tr><td>' + esc(t) + '</td><td class="num">' + copia + '</td>' +
        '<td class="num">' + (viva == null ? '—' : viva) + '</td><td class="small">' + nota + '</td></tr>';
    }).join('');
    el('resumoCopia').innerHTML = '<div class="card"><b>Cópia de ' + esc(dia) + '</b>' +
      '<div class="small m-2-0-8">' + d.linhas + ' linhas · ' + kb(d.bytes) + ' comprimida' +
      (d.irreconheciveis ? ' · <span class="badge dg">' + d.irreconheciveis + ' linhas ilegíveis</span>' : ' · íntegra') + '</div>' +
      '<div class="rolavel"><table><tr><th>Tabela</th><th class="num">Na cópia</th><th class="num">Na base</th><th></th></tr>' +
      linhas + '</table></div></div>';
  }).catch(function (e) {
    el('resumoCopia').innerHTML = '<div class="card"><div class="small">' + esc(e.message) + '</div></div>';
  });
}

/* -------------------------------- rasto --------------------------------- */

// a auditoria: as últimas 200 ações da equipa, opcionalmente filtradas por
// alvo. Só leitura — o rasto escreve-se sempre e não se apaga nunca.
// Recebe: alvo (opcional) — o alvo por que filtrar (string, como aparece na coluna Sobre).
// Devolve: nada — redesenha a vista com a tabela.
function verRasto(alvo) {
  aCarregar();
  pedir('/api/equipa/auditoria' + (alvo ? '?alvo=' + encodeURIComponent(alvo) : '')).then(function (d) {
    el('conteudo').innerHTML = '<div class="card"><b>Quem fez o quê</b>' +
      '<div class="small m-2-0-8">As últimas 200 ações. Escreve-se sempre, não se apaga nunca.</div>' +
      ((d.registos || []).length ? '<div class="rolavel"><table><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Sobre</th><th>Detalhe</th></tr>' +
        d.registos.map(function (r) {
          return '<tr><td class="nowrap">' + data(r.at) + '</td>' +
            '<td>' + esc(r.nome || r.quem) + ' <span class="small">' + esc(r.papel) + '</span></td>' +
            '<td>' + esc(r.acao) + '</td><td>' + esc(r.alvo || '—') + '</td>' +
            '<td class="small">' + esc(r.detalhe || '') + '</td></tr>';
        }).join('') + '</table></div>' : '<div class="vazio">Ainda não há rasto nenhum.</div>') + '</div>';
  }).catch(falha);
}

/* -------------------------------- as ações ------------------------------- */

// os três botões da sessão de teste: [comDados, manter, limpar] do sessaoTeste
var MODOS_TESTE = {
  retomar: [false, false, false], 'extra-dados': [true, true, false],
  extra: [false, true, false], limpar: [false, false, true],
};

/* O que cada data-acao (clique), data-enter (Enter num campo) e data-mudar
   (change) faz. Cada entrada recebe o dataset do elemento (arg, arg2, arg3,
   em texto, tal e qual como a vista os escreveu com o ligarA) e o próprio
   elemento, e chama a função da página. Um nome que não esteja aqui não se
   procura em mais lado nenhum. */
var ACOES = {
  sair: function () { sair(); },
  ir: function (d) { ir(d.arg); },
  verLista: function (d) { verLista(d.arg, d.arg2); },
  procurarLista: function (d, alvo) { verLista(d.arg, estado, alvo.value); },
  verPedido: function (d) { verPedido(d.arg); },
  agir: function (d) { agir(d.arg, d.arg2); },
  mudarCategoria: function (d) { mudarCategoria(d.arg); },
  usarModelo: function () { usarModelo(); },
  guardarModelo: function () { guardarModelo(); },
  verPessoas: function () { verPessoas(); },
  procurarPessoas: function () { verPessoas(el('q').value); },
  criarConta: function () { criarConta(); },
  verPessoa: function (d) { verPessoa(d.arg); },
  acaoConta: function (d) { acaoConta(d.arg, d.arg2); },
  mudarServico: function (d) { mudarServico(d.arg, d.arg2, d.arg3 === 'ligar'); },
  copiarAgora: function () { copiarAgora(); },
  resumoCopia: function (d) { resumoCopia(d.arg); },
  sessaoTeste: function (d) {
    var m = Object.prototype.hasOwnProperty.call(MODOS_TESTE, d.arg) ? MODOS_TESTE[d.arg] : null;
    if (m) sessaoTeste(m[0], m[1], m[2]);
  },
  criarEndereco: function () { criarEndereco(); },
};

/* Corre a ação do elemento mais próximo do alvo do evento que tenha o
   atributo data-<tipo> — o clique num filho de um cartão é o clique no
   cartão, como era com o onclick. Um nome fora da tabela ACOES rebenta com
   um erro claro, que chega ao window.onerror como chegava o de um onclick.
   Recebe: evento — o evento do browser; tipo — 'acao', 'enter' ou 'mudar'.
   Devolve: nada — corre a ação, se houver. */
function despachar(evento, tipo) {
  var alvo = evento.target && evento.target.closest ? evento.target.closest('[data-' + tipo + ']') : null;
  if (!alvo) return;
  var nome = alvo.getAttribute('data-' + tipo);
  if (!Object.prototype.hasOwnProperty.call(ACOES, nome)) throw new Error('ação desconhecida: ' + nome);
  ACOES[nome](alvo.dataset, alvo, evento);
}

document.addEventListener('click', function (e) { despachar(e, 'acao'); });
document.addEventListener('keydown', function (e) { if (e.key === 'Enter') despachar(e, 'enter'); });
document.addEventListener('change', function (e) { despachar(e, 'mudar'); });

/* ------------------------------- arranque ------------------------------- */
ir(SECCOES.filter(function (s) { return s.se; })[0].id);`;
