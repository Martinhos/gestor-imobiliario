/* A página da ferramenta de equipa.
   ---------------------------------
   Servida pelo worker e não pelos ficheiros da app: quem faz suporte não
   carrega a aplicação de quem a usa, nem partilha código com ela. São duas
   coisas com públicos diferentes, e mantê-las separadas evita que um dia
   uma sessão de equipa consiga chamar alguma coisa da outra.

   É uma página pequena, escrita à mão, sem dependências. Se um dia crescer
   ao ponto de doer, muda-se — mas uma ferramenta usada por três pessoas não
   justifica mais do que isto. */

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
  padding:calc(14px + env(safe-area-inset-top)) 18px 14px;display:flex;align-items:center;gap:12px}
header h1{margin:0;font-size:17px;letter-spacing:-.02em;flex:1}
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
  border-radius:10px;background:var(--card);cursor:pointer;font-weight:600;font-size:14px;white-space:nowrap}
.btn:hover{border-color:var(--line2)}
.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.btn.danger{color:var(--danger)}
.tabs{display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap}
.tabs .btn.on{background:var(--chip);border-color:var(--line2)}
.vazio{text-align:center;color:var(--muted);padding:40px 20px;border:1px dashed var(--line2);border-radius:14px}
pre{white-space:pre-wrap;word-break:break-word;background:var(--chip);padding:11px;border-radius:10px;
  font:12.5px/1.5 ui-monospace,Menlo,Consolas,monospace;margin:9px 0 0;max-height:280px;overflow:auto}
.grelha{display:grid;gap:11px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.stat{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}
.stat:last-child{border:0}
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

  const corpo = `<header>
    <h1>Suporte</h1>
    <span class="badge">${escapar((eu.papeis && eu.papeis.length ? eu.papeis : [eu.papel]).filter(Boolean).join(' + '))}</span>
    <span class="small">${escapar(eu.nome)}</span>
    <button class="btn" onclick="sair()">Sair</button>
  </header>
  <div class="wrap">
    <div class="tabs">
      <button class="btn on" id="t-abertos" onclick="verLista('abertos')">Por tratar</button>
      <button class="btn" id="t-todos" onclick="verLista('')">Todos</button>
      <input id="q" placeholder="Procurar por assunto, texto, nome ou email…"
        style="flex:1;min-width:210px" onkeydown="if(event.key==='Enter')verLista(estado,this.value)">
    </div>
    <div id="conteudo"><div class="vazio">A carregar…</div></div>
  </div>
<script>
var estado = 'abertos', eu = ${JSON.stringify({ papel: eu.papel, nome: eu.nome })};
var ESTADOS = ${JSON.stringify(ESTADOS)}, CATS = ${JSON.stringify(CATS)};
var esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
};
var el = function (id) { return document.getElementById(id); };
var data = function (t) { return new Date(t).toISOString().slice(0, 16).replace('T', ' '); };

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

function sair() {
  pedir('/api/equipa/sair', { method: 'POST' }).then(function () { location.reload(); });
}

function selo(p) {
  var c = p.status === 'concluido' ? 'ok' : p.status === 'resolucao' ? 'wa' : '';
  return '<span class="badge ' + c + '">' + (ESTADOS[p.status] || p.status) + '</span>';
}

function verLista(e, q) {
  estado = e;
  el('t-abertos').className = 'btn' + (e === 'abertos' ? ' on' : '');
  el('t-todos').className = 'btn' + (e === '' ? ' on' : '');
  var url = '/api/equipa/pedidos?estado=' + encodeURIComponent(e) +
    (q ? '&q=' + encodeURIComponent(q) : '');
  el('conteudo').innerHTML = '<div class="vazio">A carregar…</div>';
  pedir(url).then(function (d) {
    if (!d.pedidos.length) {
      el('conteudo').innerHTML = '<div class="vazio">Nada aqui' + (q ? ' para “' + esc(q) + '”' : '') + '.</div>';
      return;
    }
    el('conteudo').innerHTML = d.pedidos.map(function (p) {
      var quem = p.nome || p.email || p.user_id;
      return '<div class="card tap" onclick="verPedido(\\'' + p.id + '\\')">' +
        '<div class="row"><div style="min-width:0">' +
        '<b>' + esc(p.subject) + '</b>' +
        '<div class="small">' + esc(quem) + ' · ' + (CATS[p.category] || p.category) +
        ' · ' + data(p.created_at) +
        (p.n > 1 ? ' · ×' + p.n : '') +
        (p.pessoas > 1 ? ' · ' + p.pessoas + ' pessoas' : '') +
        (p.versao ? ' · v' + p.versao : '') + '</div></div>' +
        selo(p) + '</div></div>';
    }).join('');
  }).catch(function (e) {
    el('conteudo').innerHTML = '<div class="vazio">' + esc(e.message) + '</div>';
  });
}

function verPedido(id) {
  el('conteudo').innerHTML = '<div class="vazio">A carregar…</div>';
  pedir('/api/equipa/pedidos/' + encodeURIComponent(id)).then(function (d) {
    var p = d.pedido, q = d.quem;
    var fichaHtml = '';
    if (q && !q.desconhecido) {
      fichaHtml = '<div class="card"><b>Quem escreveu</b>' +
        '<div class="stat"><span>Nome</span><b>' + esc(q.nome || '—') + '</b></div>' +
        '<div class="stat"><span>Email</span><b>' + esc(q.email) + '</b></div>' +
        '<div class="stat"><span>Plano</span><b>' + esc(q.plano) + '</b></div>' +
        '<div class="stat"><span>Na app desde</span><b>' + data(q.desde).slice(0, 10) + '</b></div>' +
        '<div class="stat"><span>Casas · registos</span><b>' + q.casas + ' · ' + q.registos + '</b></div>' +
        '<div class="stat"><span>Pedidos</span><b>' + q.pedidos + '</b></div>' +
        (q.errosApanhados ? '<div class="stat"><span>Erros que apanhou</span><b>' + q.errosApanhados + '</b></div>' : '') +
        (q.apagada ? '<div class="stat"><span></span><b class="badge dg">conta apagada</b></div>' : '') +
        (q.aceitouTermos ? '' : '<div class="stat"><span></span><b class="badge wa">não aceitou os termos</b></div>') +
        '</div>';
    } else if (q) {
      fichaHtml = '<div class="card"><b>Quem escreveu</b><div class="small">Conta já não existe (' + esc(q.id) + ').</div></div>';
    }
    var anteriores = (d.outros || []).length
      ? '<div class="card"><b>Outros pedidos desta pessoa</b>' + d.outros.map(function (o) {
          return '<div class="stat" style="cursor:pointer" onclick="verPedido(\\'' + o.id + '\\')">' +
            '<span>' + esc(o.subject) + '</span><b class="small">' + (ESTADOS[o.status] || o.status) + '</b></div>';
        }).join('') + '</div>'
      : '';
    el('conteudo').innerHTML =
      '<button class="btn" style="margin-bottom:12px" onclick="verLista(estado)">← Voltar</button>' +
      '<div class="card"><div class="row"><div style="min-width:0">' +
      '<b style="font-size:16px">' + esc(p.subject) + '</b>' +
      '<div class="small">' + (CATS[p.category] || p.category) + ' · ' + data(p.created_at) +
      (p.versao ? ' · versão ' + esc(p.versao) : '') + '</div></div>' + selo(p) + '</div>' +
      '<pre>' + esc(p.body) + '</pre>' +
      (p.context ? '<div class="small" style="margin-top:8px">' + esc(p.context) + '</div>' : '') +
      (p.reply ? '<div class="card" style="margin:11px 0 0"><b>Resposta enviada</b><div class="small">' + esc(p.reply) + '</div></div>' : '') +
      '</div>' + fichaHtml + anteriores +
      '<div class="card"><b>Responder</b>' +
      '<textarea id="resposta" placeholder="A pessoa vê isto na app, em Ajuda e sugestões."></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<button class="btn primary" onclick="agir(\\'' + p.id + '\\',\\'responder\\')">Responder</button>' +
      '<button class="btn" onclick="agir(\\'' + p.id + '\\',\\'fechar\\')">Responder e concluir</button>' +
      (p.status === 'concluido' ? '<button class="btn" onclick="agir(\\'' + p.id + '\\',\\'reabrir\\')">Reabrir</button>' : '') +
      '</div></div>';
  }).catch(function (e) {
    el('conteudo').innerHTML = '<div class="vazio">' + esc(e.message) + '</div>';
  });
}

function agir(id, acao) {
  var t = el('resposta') ? el('resposta').value.trim() : '';
  if (acao === 'responder' && !t) { alert('Escreve a resposta.'); return; }
  pedir('/api/equipa/pedidos/' + encodeURIComponent(id) + '/' + acao, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: t }),
  }).then(function () { verPedido(id); }).catch(function (e) { alert(e.message); });
}

verLista('abertos');
</script>`;

  return new Response(pagina(corpo, 'Suporte'), {
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
