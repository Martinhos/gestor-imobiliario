/* A página da ferramenta de equipa.
   ---------------------------------
   Servida pelo worker e não pelos ficheiros da app: quem faz suporte não
   carrega a aplicação de quem a usa, nem partilha código com ela. São duas
   coisas com públicos diferentes, e mantê-las separadas evita que um dia
   uma sessão de equipa consiga chamar alguma coisa da outra.

   É uma página escrita à mão, sem dependências. Cresceu de fila de pedidos
   para back office — pedidos, erros, pessoas, operação e rasto — mas o
   princípio mantém-se: uma ferramenta usada por meia dúzia de pessoas não
   justifica mais do que isto. */

import { catsDe } from './discord.js';

const ESTADOS = { criado: 'Recebido', resolucao: 'Em resolução', concluido: 'Concluído' };
const CATS = {
  user: 'contado por alguém', client: 'erro na app', server: 'erro no servidor',
  infra: 'infraestrutura', seguranca: 'segurança',
};

function pagina(corpo, titulo) {
  return `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex,nofollow">
<title>${titulo} · equipa</title>
<style>
:root{color-scheme:light dark;
  --bg:#f7f8fa;--card:#fff;--ink:#17221d;--muted:#5a635e;--line:#e7ebe8;--line2:#cfd8d3;
  --accent:#244c3b;--accent-ink:#fff;--chip:#f2f4f3;--danger:#b94a48;--warn:#9a6400;--ok:#2f7d5b}
@media(prefers-color-scheme:dark){:root{
  --bg:#12141b;--card:#1b1e28;--ink:#eef0f6;--muted:#9aa3b8;--line:#2b3040;--line2:#3a4054;
  --accent:#5ee0a8;--accent-ink:#0b1410;--chip:#272b38;--danger:#ff8a80;--warn:#ffc35c;--ok:#5ee0a8}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.55 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  padding:0 0 60px}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);
  padding:calc(14px + env(safe-area-inset-top)) 18px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
header h1{margin:0;font-size:17px;letter-spacing:-.02em}
header .spacer{flex:1}
.wrap{max-width:900px;margin:0 auto;padding:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px;margin-bottom:11px}
.card.tap{cursor:pointer}.card.tap:hover{border-color:var(--line2)}
.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.small{font-size:13px;color:var(--muted)}
.badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;background:var(--chip);color:var(--muted)}
.badge.ok{background:color-mix(in srgb,var(--ok) 18%,transparent);color:var(--ok)}
.badge.dg{background:color-mix(in srgb,var(--danger) 18%,transparent);color:var(--danger)}
.badge.wa{background:color-mix(in srgb,var(--warn) 20%,transparent);color:var(--warn)}
input,textarea,select,button{font:inherit;color:inherit}
input,textarea,select{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
textarea{min-height:110px;resize:vertical}
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border:1px solid var(--line);
  border-radius:10px;background:var(--card);cursor:pointer;font-weight:600;font-size:14px;white-space:nowrap;width:auto}
.btn:hover{border-color:var(--line2)}
.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.btn.danger{color:var(--danger)}
.btn.mini{padding:5px 10px;font-size:12.5px}
.tabs{display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap}
.tabs .btn.on{background:var(--chip);border-color:var(--line2)}
.vazio{text-align:center;color:var(--muted);padding:40px 20px;border:1px dashed var(--line2);border-radius:14px}
pre{white-space:pre-wrap;word-break:break-word;background:var(--chip);padding:11px;border-radius:10px;
  font:12.5px/1.5 ui-monospace,Menlo,Consolas,monospace;margin:9px 0 0;max-height:280px;overflow:auto}
.grelha{display:grid;gap:11px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.stat{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}
.stat:last-child{border:0}
.stat b{text-align:right;word-break:break-word}
.msg{border-left:3px solid var(--accent);padding:8px 12px;margin:9px 0 0;background:var(--chip);border-radius:0 10px 10px 0}
.msg.nota{border-left-color:var(--warn)}
.msg .small{margin-bottom:3px}
.acoes{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;font-size:13.5px}
td,th{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12.5px}
.num{text-align:right;font-variant-numeric:tabular-nums}
.rolavel{overflow-x:auto}
header nav{margin:0;min-width:0;flex:1;justify-content:flex-end}
/* no telemóvel os separadores ganham a linha inteira, em vez de uma coluna */
@media(max-width:600px){header nav{flex-basis:100%;justify-content:flex-start}}
</style></head><body>${corpo}</body></html>`;
}

// Quem não tem sessão não vê a ferramenta, nem sabe o que lá está.
export function paginaEquipa(eu) {
  if (!eu) {
    return new Response(pagina(`<div class="wrap" style="max-width:460px;padding-top:60px">
      <div class="card">
        <h1 style="margin:0 0 8px;font-size:19px">Ferramenta de equipa</h1>
        <p class="small" style="margin:0">Entra-se a partir do Discord. Corre <b>/entrar</b> no
        servidor e abre a ligação que o bot te dá — vale cinco minutos e uma só utilização.</p>
      </div></div>`, 'Entrar'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const papeis = (eu.papeis && eu.papeis.length ? eu.papeis : [eu.papel]).filter(Boolean);
  const cats = catsDe(papeis);
  const dados = {
    nome: eu.nome,
    discordId: eu.discordId,
    papeis,
    cats,
    master: papeis.indexOf('master') > -1,
  };

  const corpo = `<header>
    <h1>Equipa</h1>
    <span class="badge">${escapar(papeis.join(' + '))}</span>
    <span class="small">${escapar(eu.nome)}</span>
    <nav class="tabs" id="nav"></nav>
    <button class="btn mini" onclick="sair()">Sair</button>
  </header>
  <div class="wrap"><div id="conteudo"><div class="vazio">A carregar…</div></div></div>
<script>
var eu = ${JSON.stringify(dados)};
var ESTADOS = ${JSON.stringify(ESTADOS)}, CATS = ${JSON.stringify(CATS)};
var seccao = '', estado = 'abertos', modelos = null;

var esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
};
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
function enviar(rota, corpo) {
  return pedir(rota, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo || {}),
  });
}
function sair() {
  pedir('/api/equipa/sair', { method: 'POST' }).then(function () { location.reload(); });
}
function falha(e) { el('conteudo').innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; }
function aCarregar() { el('conteudo').innerHTML = '<div class="vazio">A carregar…</div>'; }

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

function nav(ativa) {
  seccao = ativa;
  el('nav').innerHTML = SECCOES.filter(function (s) { return s.se; }).map(function (s) {
    return '<button class="btn mini' + (s.id === ativa ? ' on' : '') + '" onclick="ir(\\'' + s.id + '\\')">' + s.nome + '</button>';
  }).join('');
}
function ir(s) {
  nav(s);
  if (s === 'pedidos') verLista('pessoas', 'abertos');
  else if (s === 'erros') verLista('erros', 'abertos');
  else if (s === 'pessoas') verPessoas();
  else if (s === 'operacao') verOperacao();
  else if (s === 'rasto') verRasto();
}

/* ------------------------- pedidos e erros (lista) ----------------------- */

function verLista(tipo, e, q) {
  estado = e;
  var url = '/api/equipa/pedidos?tipo=' + tipo + '&estado=' + encodeURIComponent(e) +
    (q ? '&q=' + encodeURIComponent(q) : '');
  aCarregar();
  pedir(url).then(function (d) {
    var topo = '<div class="tabs">' +
      '<button class="btn' + (e === 'abertos' ? ' on' : '') + '" onclick="verLista(\\'' + tipo + '\\',\\'abertos\\')">Por tratar</button>' +
      '<button class="btn' + (e === '' ? ' on' : '') + '" onclick="verLista(\\'' + tipo + '\\',\\'\\')">Todos</button>' +
      '<input id="q" placeholder="Procurar por assunto, texto, nome ou email…" value="' + esc(q || '') + '"' +
      ' style="flex:1;min-width:210px" onkeydown="if(event.key===\\'Enter\\')verLista(\\'' + tipo + '\\',estado,this.value)">' +
      '</div>';
    if (!d.pedidos.length) {
      el('conteudo').innerHTML = topo + '<div class="vazio">Nada aqui' + (q ? ' para “' + esc(q) + '”' : '') + '.</div>';
      return;
    }
    el('conteudo').innerHTML = topo + d.pedidos.map(function (p) {
      var quem = p.nome || p.email || p.user_id;
      return '<div class="card tap" onclick="verPedido(\\'' + p.id + '\\')">' +
        '<div class="row"><div style="min-width:0">' +
        '<b>' + esc(p.subject) + '</b>' +
        '<div class="small">' + esc(quem) + ' · ' + (CATS[p.category] || p.category) +
        ' · ' + data(p.created_at) +
        (p.n > 1 ? ' · ×' + p.n : '') +
        (p.pessoas > 1 ? ' · ' + p.pessoas + ' pessoas' : '') +
        (p.versao ? ' · v' + p.versao : '') +
        (p.assignee_nome ? ' · com ' + esc(p.assignee_nome) : '') + '</div></div>' +
        selo(p) + '</div></div>';
    }).join('');
  }).catch(falha);
}

/* --------------------------- um pedido (detalhe) ------------------------- */

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
        '<div class="stat"><span>Plano</span><b>' + esc(q.plano) + '</b></div>' +
        '<div class="stat"><span>Na app desde</span><b>' + data(q.desde).slice(0, 10) + '</b></div>' +
        '<div class="stat"><span>Casas · registos</span><b>' + q.casas + ' · ' + q.registos + '</b></div>' +
        (q.errosApanhados ? '<div class="stat"><span>Erros que apanhou</span><b>' + q.errosApanhados + '</b></div>' : '') +
        (q.suspensa ? '<div class="stat"><span></span><b class="badge dg">conta suspensa</b></div>' : '') +
        (q.apagada ? '<div class="stat"><span></span><b class="badge dg">conta apagada</b></div>' : '') +
        (q.aceitouTermos ? '' : '<div class="stat"><span></span><b class="badge wa">não aceitou os termos</b></div>') +
        (eu.cats.indexOf('user') > -1
          ? '<div class="acoes"><button class="btn mini" onclick="verPessoa(\\'' + esc(q.id) + '\\')">Abrir a ficha completa</button></div>'
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

    var anteriores = (d.outros || []).length
      ? '<div class="card"><b>Outros pedidos desta pessoa</b>' + d.outros.map(function (o) {
          return '<div class="stat" style="cursor:pointer" onclick="verPedido(\\'' + o.id + '\\')">' +
            '<span>' + esc(o.subject) + '</span><b class="small">' + (ESTADOS[o.status] || o.status) + '</b></div>';
        }).join('') + '</div>'
      : '';

    var opcoesModelo = (modelos || []).map(function (x, i) {
      return '<option value="' + i + '">' + esc(x.titulo) + '</option>';
    }).join('');

    var meu = p.assignee === eu.discordId;
    var voltar = p.category === 'user' ? 'pedidos' : 'erros';

    el('conteudo').innerHTML =
      '<button class="btn" style="margin-bottom:12px" onclick="ir(\\'' + voltar + '\\')">← Voltar</button>' +
      '<div class="card"><div class="row"><div style="min-width:0">' +
      '<b style="font-size:16px">' + esc(p.subject) + '</b>' +
      '<div class="small">' + (CATS[p.category] || p.category) + ' · ' + data(p.created_at) +
      (p.n > 1 ? ' · ×' + p.n : '') +
      (p.versao ? ' · versão ' + esc(p.versao) : '') +
      (p.assignee_nome ? ' · com ' + esc(p.assignee_nome) : '') + '</div></div>' + selo(p) + '</div>' +
      '<pre>' + esc(p.body) + '</pre>' +
      (p.context ? '<div class="small" style="margin-top:8px">' + esc(p.context) + '</div>' : '') +
      fio +
      '<div class="acoes">' +
      '<button class="btn mini" onclick="agir(\\'' + p.id + '\\',\\'atribuir\\')">' + (meu ? 'Largar isto' : 'Tratar disto eu') + '</button>' +
      '<select id="catNova" style="width:auto;padding:5px 10px;font-size:12.5px">' +
      Object.keys(CATS).map(function (c) {
        return '<option value="' + c + '"' + (c === p.category ? ' selected' : '') + '>' + CATS[c] + '</option>';
      }).join('') + '</select>' +
      '<button class="btn mini" onclick="mudarCategoria(\\'' + p.id + '\\')">Mudar categoria</button>' +
      '</div></div>' +
      fichaHtml + anteriores +
      '<div class="card"><b>Responder</b>' +
      (opcoesModelo
        ? '<div class="acoes" style="margin:8px 0 2px"><select id="modelo" style="flex:1" onchange="usarModelo()">' +
          '<option value="">— resposta-tipo —</option>' + opcoesModelo + '</select>' +
          '<button class="btn mini" onclick="guardarModelo()">Guardar como modelo</button></div>'
        : '<div class="acoes" style="margin:8px 0 2px"><button class="btn mini" onclick="guardarModelo()">Guardar como modelo</button></div>') +
      '<textarea id="resposta" placeholder="A pessoa vê isto na app, em Ajuda e sugestões."></textarea>' +
      '<div class="acoes">' +
      '<button class="btn primary" onclick="agir(\\'' + p.id + '\\',\\'responder\\')">Responder</button>' +
      '<button class="btn" onclick="agir(\\'' + p.id + '\\',\\'fechar\\')">Responder e concluir</button>' +
      '<button class="btn" onclick="agir(\\'' + p.id + '\\',\\'nota\\')">Guardar como nota interna</button>' +
      (p.status === 'concluido' ? '<button class="btn" onclick="agir(\\'' + p.id + '\\',\\'reabrir\\')">Reabrir</button>' : '') +
      '</div></div>';
  }).catch(falha);
}

function agir(id, acao) {
  var t = el('resposta') ? el('resposta').value.trim() : '';
  if ((acao === 'responder' || acao === 'nota') && !t) { alert('Escreve o texto primeiro.'); return; }
  enviar('/api/equipa/pedidos/' + encodeURIComponent(id) + '/' + acao, { texto: t })
    .then(function () { verPedido(id); }).catch(function (e) { alert(e.message); });
}
function mudarCategoria(id) {
  enviar('/api/equipa/pedidos/' + encodeURIComponent(id) + '/categoria', { categoria: el('catNova').value })
    .then(function () { verPedido(id); }).catch(function (e) { alert(e.message); });
}
function usarModelo() {
  var i = el('modelo').value;
  if (i === '') return;
  el('resposta').value = (modelos[Number(i)] || {}).texto || '';
}
function guardarModelo() {
  var t = el('resposta').value.trim();
  if (!t) { alert('Escreve primeiro o texto do modelo.'); return; }
  var titulo = prompt('Nome do modelo (aparece na lista):');
  if (!titulo) return;
  enviar('/api/equipa/modelos', { titulo: titulo, texto: t })
    .then(function () { modelos = null; alert('Guardado.'); }).catch(function (e) { alert(e.message); });
}

/* ------------------------------- pessoas -------------------------------- */

function verPessoas(q) {
  var topo = '<div class="tabs">' +
    '<input id="q" placeholder="Procurar por email, nome ou id…" value="' + esc(q || '') + '"' +
    ' style="flex:1;min-width:210px" onkeydown="if(event.key===\\'Enter\\')verPessoas(this.value)">' +
    '<button class="btn" onclick="verPessoas(el(\\'q\\').value)">Procurar</button></div>';
  if (!q || q.length < 3) {
    el('conteudo').innerHTML = topo + '<div class="vazio">Procura por email, nome ou id (3+ caracteres).</div>';
    return;
  }
  aCarregar();
  pedir('/api/equipa/pessoas?q=' + encodeURIComponent(q)).then(function (d) {
    el('conteudo').innerHTML = topo + (!d.pessoas.length
      ? '<div class="vazio">Ninguém com “' + esc(q) + '”.</div>'
      : d.pessoas.map(function (u) {
          return '<div class="card tap" onclick="verPessoa(\\'' + esc(u.id) + '\\')"><div class="row">' +
            '<div style="min-width:0"><b>' + esc(u.name || u.email) + '</b>' +
            '<div class="small">' + esc(u.email) + ' · ' + esc(u.id) + ' · ' + esc(u.plan) + '</div></div>' +
            (u.deleted_at ? '<span class="badge dg">apagada</span>'
              : u.suspended_at ? '<span class="badge dg">suspensa</span>' : '') +
            '</div></div>';
        }).join(''));
  }).catch(falha);
}

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
          return '<div class="stat" style="cursor:pointer" onclick="verPedido(\\'' + o.id + '\\')">' +
            '<span>' + esc(o.subject) + '</span><b class="small">' + (ESTADOS[o.status] || o.status) + '</b></div>';
        }).join('') + '</div>'
      : '';

    el('conteudo').innerHTML =
      '<button class="btn" style="margin-bottom:12px" onclick="verPessoas()">← Voltar</button>' +
      '<div class="card"><div class="row"><div style="min-width:0">' +
      '<b style="font-size:16px">' + esc(q.nome || q.email) + '</b>' +
      '<div class="small">' + esc(q.email) + ' · ' + esc(q.id) + '</div></div>' +
      (q.suspensa ? '<span class="badge dg">suspensa</span>' : q.apagada ? '<span class="badge dg">apagada</span>' : '<span class="badge ok">ativa</span>') +
      '</div>' +
      '<div class="stat"><span>Plano</span><b>' + esc(q.plano) + '</b></div>' +
      '<div class="stat"><span>Entra com</span><b>' + esc(q.entrada) + '</b></div>' +
      '<div class="stat"><span>Na app desde</span><b>' + data(q.desde).slice(0, 10) + '</b></div>' +
      '<div class="stat"><span>Última atividade</span><b>' + idade(q.ultimaAtividade) + '</b></div>' +
      (q.versaoApp ? '<div class="stat"><span>Versão da app</span><b>' + esc(q.versaoApp) + '</b></div>' : '') +
      '<div class="stat"><span>Casas · registos</span><b>' + q.casas + ' · ' + q.registos + '</b></div>' +
      '<div class="stat"><span>Pedidos · erros apanhados</span><b>' + q.pedidos + ' · ' + q.errosApanhados + '</b></div>' +
      '<div class="stat"><span>Termos</span><b>' + (q.termos ? esc(q.termos) : '<span class="badge wa">por aceitar</span>') + '</b></div>' +
      '</div>' +
      (d.master ? cartaoAcoes(q) : '') +
      ligacoes + propostas + limites + pedidos;
  }).catch(falha);
}

/* As ações sobre a conta. Cada uma pede o motivo — é o que daqui a seis
   meses distingue "porque foi preciso" de "ninguém sabe". */
function cartaoAcoes(q) {
  var b = function (acao, nome, classe) {
    return '<button class="btn mini ' + (classe || '') + '" onclick="acaoConta(\\'' + esc(q.id) + '\\',\\'' + acao + '\\')">' + nome + '</button>';
  };
  return '<div class="card"><b>Ações</b><div class="small" style="margin:2px 0 6px">' +
    'Tudo isto fica no rasto, com o motivo.</div><div class="acoes">' +
    b('sessoes', 'Terminar sessões') +
    b('limpar-limites', 'Limpar limites') +
    b('plano', 'Mudar plano') +
    b('email', 'Mudar email') +
    (q.entrada.indexOf('google') > -1 ? b('desligar-google', 'Desligar Google') : '') +
    (q.suspensa ? b('reativar', 'Reativar', 'primary') : b('suspender', 'Suspender', 'danger')) +
    '</div></div>';
}

function acaoConta(id, acao) {
  var valor;
  if (acao === 'plano') {
    valor = prompt('Novo plano (free, plus ou pro):');
    if (!valor) return;
  } else if (acao === 'email') {
    valor = prompt('Novo email desta conta:');
    if (!valor) return;
  }
  var motivo = prompt('Motivo (fica no rasto):');
  if (!motivo) return;
  if (acao === 'suspender' && !confirm('Suspender a conta? A pessoa deixa de conseguir entrar até ser reativada.')) return;
  enviar('/api/equipa/pessoas/' + encodeURIComponent(id) + '/acao', { acao: acao, valor: valor, motivo: motivo })
    .then(function (d) { alert(d.resultado); verPessoa(id); })
    .catch(function (e) { alert(e.message); });
}

/* ------------------------------- operação ------------------------------- */

// o que se espera de cada operação agendada; passado o dobro, é alarme
var CADENCIA = { copia: 26, vigia: 2, resumo: 26 };   // horas
var OPS = { copia: 'Cópia diária', vigia: 'Vigia dos limites', resumo: 'Resumo diário' };

function verOperacao() {
  aCarregar();
  pedir('/api/equipa/operacao').then(function (d) {
    var consumo = '<div class="card"><b>Consumo</b>' + (d.consumo || []).map(function (f) {
      return '<div class="stat"><span>' + esc(f.name) + '</span><b>' + esc(f.value) + '</b></div>';
    }).join('') + '</div>';

    var vistos = {};
    (d.crons || []).forEach(function (c) { vistos[c.op] = c; });
    var batimento = '<div class="card"><b>Batimento</b><div class="small" style="margin:2px 0 6px">' +
      'Cada operação agendada deixa rasto ao correr. O alarme é a ausência.</div>' +
      Object.keys(OPS).map(function (op) {
        var c = vistos[op];
        var horas = c ? (Date.now() - c.at) / 3600000 : Infinity;
        var classe = !c ? 'dg' : horas > CADENCIA[op] ? 'dg' : c.ok ? 'ok' : 'wa';
        var texto = !c ? 'nunca correu' : idade(c.at) + (c.ok ? '' : ' · falhou');
        return '<div class="stat"><span>' + OPS[op] + '</span><b><span class="badge ' + classe + '">' + texto + '</span></b></div>';
      }).join('') + '</div>';

    var copias = '<div class="card"><div class="row"><b>Cópias no R2</b>' +
      '<button class="btn mini" onclick="copiarAgora()">Copiar agora</button></div>' +
      '<div class="small" style="margin:4px 0 8px">' + esc((d.estadoCopias || {}).texto || '') + '</div>' +
      ((d.copias || []).length ? '<div class="rolavel"><table><tr><th>Dia</th><th class="num">Tamanho</th><th></th></tr>' +
        d.copias.map(function (c) {
          var dia = (c.key.match(/(\\d{4}-\\d{2}-\\d{2})/) || [])[1] || c.key;
          return '<tr><td>' + esc(dia) + '</td><td class="num">' + kb(c.size) + '</td>' +
            '<td style="text-align:right;white-space:nowrap">' +
            '<button class="btn mini" onclick="resumoCopia(\\'' + dia + '\\')">Verificar</button> ' +
            '<a class="btn mini" href="/api/equipa/operacao/copias/' + dia + '/descarregar">Descarregar</a></td></tr>';
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

    el('conteudo').innerHTML = batimento + copias + '<div id="resumoCopia"></div>' + historico + consumo;
  }).catch(falha);
}

function copiarAgora() {
  if (!confirm('Fazer uma cópia da base agora?')) return;
  enviar('/api/equipa/operacao/copiar').then(function (d) {
    alert('Feita: ' + d.copia.linhas + ' linhas, ' + kb(d.copia.bytes) + '.');
    verOperacao();
  }).catch(function (e) { alert(e.message); });
}

/* A verificação de uma cópia: descomprime no servidor, conta por tabela, e
   compara com a base viva. Uma cópia truncada rebenta na descompressão; uma
   coxa aparece aqui com as contagens a divergir. */
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
      '<div class="small" style="margin:2px 0 8px">' + d.linhas + ' linhas · ' + kb(d.bytes) + ' comprimida' +
      (d.irreconheciveis ? ' · <span class="badge dg">' + d.irreconheciveis + ' linhas ilegíveis</span>' : ' · íntegra') + '</div>' +
      '<div class="rolavel"><table><tr><th>Tabela</th><th class="num">Na cópia</th><th class="num">Na base</th><th></th></tr>' +
      linhas + '</table></div></div>';
  }).catch(function (e) {
    el('resumoCopia').innerHTML = '<div class="card"><div class="small">' + esc(e.message) + '</div></div>';
  });
}

/* -------------------------------- rasto --------------------------------- */

function verRasto(alvo) {
  aCarregar();
  pedir('/api/equipa/auditoria' + (alvo ? '?alvo=' + encodeURIComponent(alvo) : '')).then(function (d) {
    el('conteudo').innerHTML = '<div class="card"><b>Quem fez o quê</b>' +
      '<div class="small" style="margin:2px 0 8px">As últimas 200 ações. Escreve-se sempre, não se apaga nunca.</div>' +
      ((d.registos || []).length ? '<div class="rolavel"><table><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Sobre</th><th>Detalhe</th></tr>' +
        d.registos.map(function (r) {
          return '<tr><td style="white-space:nowrap">' + data(r.at) + '</td>' +
            '<td>' + esc(r.nome || r.quem) + ' <span class="small">' + esc(r.papel) + '</span></td>' +
            '<td>' + esc(r.acao) + '</td><td>' + esc(r.alvo || '—') + '</td>' +
            '<td class="small">' + esc(r.detalhe || '') + '</td></tr>';
        }).join('') + '</table></div>' : '<div class="vazio">Ainda não há rasto nenhum.</div>') + '</div>';
  }).catch(falha);
}

/* ------------------------------- arranque ------------------------------- */
ir(SECCOES.filter(function (s) { return s.se; })[0].id);
</script>`;

  return new Response(pagina(corpo, 'Equipa'), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* A página que a ligação do Discord abre.

   Abrir não entra. Mostra quem é e põe um botão — e é o botão que gasta a
   ligação. É o que impede que uma pré-visualização, um leitor de links ou o
   browser a adiantar-se gastem a ligação antes da pessoa lá chegar.

   O endereço leva o token, por isso a página não pode deixar sair um
   referer nem ficar em cache. */
export function paginaEntrada(token, v) {
  const cabecalhos = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  };

  if (v.estado !== 'boa') {
    const porque = {
      'nao-existe': 'Esta ligação não existe.',
      usada: 'Esta ligação já foi usada. Cada uma serve uma vez só.',
      expirou: 'Esta ligação expirou. Valem cinco minutos.',
    }[v.estado] || 'Esta ligação não serve.';
    return new Response(pagina(`<div class="wrap" style="max-width:460px;padding-top:60px">
      <div class="card">
        <h1 style="margin:0 0 8px;font-size:19px">Não dá para entrar</h1>
        <p class="small" style="margin:0 0 10px">${porque}</p>
        <p class="small" style="margin:0">Corre <b>/entrar</b> outra vez no Discord para teres outra.</p>
      </div></div>`, 'Entrar'), { status: 410, headers: cabecalhos });
  }

  const quem = v.quem || {};
  const papeis = (quem.papeis && quem.papeis.length ? quem.papeis : [quem.papel]).filter(Boolean);
  return new Response(pagina(`<div class="wrap" style="max-width:460px;padding-top:60px">
    <div class="card">
      <h1 style="margin:0 0 4px;font-size:19px">Ferramenta de equipa</h1>
      <p class="small" style="margin:0 0 14px">
        Entras como <b>${escapar(quem.nome || '')}</b>
        <span class="badge">${escapar(papeis.join(' + ') || 'sem papel')}</span>
      </p>
      <form method="POST" action="/equipa/entrar">
        <input type="hidden" name="t" value="${escapar(token)}">
        <button class="btn primary" type="submit" style="width:100%;justify-content:center">Entrar</button>
      </form>
      <p class="small" style="margin:12px 0 0">
        A ligação vale uma vez só e gasta-se ao carregares aqui.</p>
    </div></div>`, 'Entrar'), { status: 200, headers: cabecalhos });
}

function escapar(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}
