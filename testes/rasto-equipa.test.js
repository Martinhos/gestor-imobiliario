// O rasto das pessoas no back office (worker/src/equipa-guiao.js): o
// separador Rasto abre ao master e ao admin, com a vista Pessoas (a lista dos
// pseudónimos com os sinais, a linha do tempo por sessão, o resumo por ecrã) e
// a vista Equipa, a auditoria, só do master; o suporte não tem o separador,
// mas no detalhe de um pedido tem «Ver o rasto» de quem o escreveu. Corre o
// guião servido pelo /equipa/guiao.js numa página de faz-de-conta, com as
// rotas /api/equipa/rasto/... a responder como o contrato as descreve, e
// confere os estados (a carregar, vazio com o porquê, erro, 403 em palavras)
// e as regras da casa: nada de alert, confirm, prompt, select, style= nem
// on…= no que se pinta, e o :hover novo só onde há rato.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { paginaEquipa, CSS_EQUIPA } from '../worker/src/equipa-vista.js';
import { recursoDePagina } from '../worker/src/paginas-recursos.js';
import { GUIAO } from '../worker/src/equipa-guiao.js';

const MASTER = { nome: 'Mestre', discordId: 'm1', papel: 'master', papeis: ['master'] };
const ADMIN = { nome: 'Ana', discordId: 'a1', papel: 'admin', papeis: ['admin'] };
const SUPORTE = { nome: 'Sofia', discordId: 's1', papel: 'suporte', papeis: ['suporte'] };
const DEV = { nome: 'Dina', discordId: 'd1', papel: 'dev', papeis: ['dev'] };

const assentar = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
// um instante na hora local, para as horas que a página escreve baterem certo
const t = (d, h, m, s) => new Date(2026, 9, d, h, m, s).getTime();

/* Corre o guião numa página de faz-de-conta: um document com getElementById
   (que cria o elemento à primeira), os dados da sessão da página verdadeira,
   e um fetch que responde por rota.
   Recebe: eu — a sessão de equipa; responder — (rota, opções) → {status, corpo}
   ou só o corpo (200), ou nada ({}).
   Devolve: {ctx, els, rotas, conteudo()}. */
async function correr(eu, responder) {
  const html = await new Response(paginaEquipa(eu).body).text();
  const guiao = await (await recursoDePagina('/equipa/guiao.js', 'GET', async () => true)).text();
  const dados = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(html)[1];
  const els = { 'dados-equipa': { id: 'dados-equipa', textContent: dados } };
  const rotas = [];
  const proibidos = [];
  const ctx = vm.createContext({
    document: {
      title: '',
      getElementById: (id) => els[id] || (els[id] = { id, innerHTML: '', value: '', showModal() {}, close() {}, querySelector: () => null }),
      addEventListener() {},
    },
    location: { reload() {} },
    fetch: async (rota, o) => {
      rotas.push(String(rota));
      const r = (responder && responder(String(rota), o)) || {};
      const comEstado = r && typeof r.status === 'number' && 'corpo' in r;
      return new Response(JSON.stringify(comEstado ? r.corpo : r), { status: comEstado ? r.status : 200 });
    },
    alert: (m) => proibidos.push('alert ' + m),
    confirm: (m) => { proibidos.push('confirm ' + m); return true; },
    prompt: (m) => { proibidos.push('prompt ' + m); return ''; },
    setTimeout, console,
  });
  vm.runInContext(guiao, ctx);
  await assentar();
  return { ctx, els, rotas, proibidos, conteudo: () => els.conteudo.innerHTML, nav: () => els.nav.innerHTML };
}

// As ações declaradas num pedaço de HTML, com os data-* desfeitos das entidades (o dataset do browser).
const desfaz = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function acoes(html) {
  return [...html.matchAll(/<[a-z]+\s[^>]*\bdata-acao="[^"]*"[^>]*>/g)].map((m) => {
    const dataset = {};
    for (const a of m[0].matchAll(/\sdata-([a-z0-9]+)="([^"]*)"/g)) dataset[a[1]] = desfaz(a[2]);
    return dataset;
  });
}
// A primeira ação com este nome (e, se vier, este primeiro argumento).
function acao(html, nome, arg) {
  return acoes(html).find((d) => d.acao === nome && (arg === undefined || d.arg === String(arg)));
}
// Carrega no botão da ação: chama a entrada da tabela ACOES com o dataset, como o ouvinte do clique.
async function carregar(g, d) {
  assert.ok(d, 'o botão existe');
  g.ctx.ACOES[d.acao](d, { value: '' });
  await assentar();
}
// O que se pinta não leva estilos nem manipuladores em atributos (a CSP_ESTRITA não os corria).
function semEmLinha(html, onde) {
  assert.doesNotMatch(html, /\sstyle=/, onde + ': sem style=');
  assert.doesNotMatch(html, /\son[a-z]+=/, onde + ': sem on…=');
  assert.doesNotMatch(html, /<select/, onde + ': sem <select>');
}

const SEM_SINAIS = { 'em-vao': 0, repetido: 0, 'vai-e-volta': 0, desistencia: 0, 'erro-campo': 0 };
const PESSOAS = [
  { pid: 'P-ABC234', conta: true, teste: false, ultimo: Date.now() - 5 * 60000, sessoes: 3, eventos: 41, origens: ['montra', 'app'],
    sinais: { ...SEM_SINAIS, 'em-vao': 2 } },
  { pid: 'P-ZZZ999', conta: true, teste: true, ultimo: Date.now() - 2 * 3600000, sessoes: 1, eventos: 12, origens: ['app'],
    sinais: { ...SEM_SINAIS, repetido: 4, 'vai-e-volta': 1, desistencia: 2, 'erro-campo': 3 } },
  { pid: 'P-MNT777', conta: false, teste: false, ultimo: Date.now() - 3 * 86400000, sessoes: 1, eventos: 4, origens: ['montra'], sinais: SEM_SINAIS },
];
// um evento da app no telemóvel do Martinho (384×785), com o que se troca
const evApp = (at, o) => ({ at, origem: 'app', tipo: 'toque', ecra: 'properties', janela: null, alvo: null, x: null, y: null,
  vw: 384, vh: 785, sinal: null, ...o });
const PESSOA = {
  pid: 'P-ABC234', userId: 'U1', teste: false,
  sessoes: [
    { sessao: 's-novaaaaaa', inicio: t(28, 14, 2, 5), fim: t(28, 14, 9, 55), origens: ['app'], eventos: [
      evApp(t(28, 14, 2, 5), { tipo: 'ecra', ecra: 'dashboard' }),
      evApp(t(28, 14, 2, 30), { ecra: 'dashboard', alvo: 'click:go', x: 120, y: 960 }),
      evApp(t(28, 14, 2, 31), { tipo: 'ecra' }),
      evApp(t(28, 14, 3, 17), { alvo: 'div.card', x: 512, y: 300, sinal: 'em-vao' }),
      evApp(t(28, 14, 4, 0), { alvo: 'click:propModal', x: 870, y: 930 }),
      evApp(t(28, 14, 4, 1), { tipo: 'janela-abre', janela: 'propModal' }),
      evApp(t(28, 14, 9, 40), { tipo: 'erro-campo', janela: 'propModal', alvo: 'input#p_name', sinal: 'erro-campo' }),
      evApp(t(28, 14, 9, 50), { tipo: 'ecra', ecra: 'settings/tema' }),
      evApp(t(28, 14, 9, 55), { tipo: 'dados', ecra: null, alvo: 'dados:house+1,contract~2,tx+36', vw: null, vh: null }),
    ] },
    { sessao: 's-velhaaaaa', inicio: t(28, 13, 50, 0), fim: t(28, 13, 51, 30), origens: ['montra'], eventos: [
      { at: t(28, 13, 50, 0), origem: 'montra', tipo: 'pagina', ecra: '/', janela: null, alvo: null, sinal: null },
      { at: t(28, 13, 50, 40), origem: 'montra', tipo: 'secao', ecra: '#contratos', janela: null, alvo: null, sinal: null },
      { at: t(28, 13, 51, 0), origem: 'montra', tipo: 'toque', ecra: '/', janela: null, alvo: 'p.m-sub', x: 300, y: 450, vw: 384, vh: 785, sinal: 'em-vao' },
      { at: t(28, 13, 51, 30), origem: 'montra', tipo: 'toque', ecra: '/', janela: null, alvo: 'a:app.rendorium.com/?criar', x: 400, y: 900, vw: 384, vh: 785, sinal: null },
    ] },
  ],
};

/* ------------------------------ quem vê o quê ------------------------------ */

describe('quem vê o rasto', () => {
  test('o master tem o separador, entra nas Pessoas e passa à Equipa pelas abas', async () => {
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoas') ? { pessoas: PESSOAS } : rota.startsWith('/api/equipa/auditoria') ? { registos: [] } : {}));
    assert.match(g.nav(), /data-acao="ir" data-arg="rasto"/, 'o separador Rasto está na barra');
    g.ctx.ir('rasto'); await assentar();
    assert.ok(g.rotas.includes('/api/equipa/rasto/pessoas?dias=30'), 'as Pessoas, com os 30 dias por omissão');
    const html = g.conteudo();
    assert.ok(acao(html, 'mudarVistaRasto', 'pessoas') && acao(html, 'mudarVistaRasto', 'equipa'), 'as duas abas');
    assert.match(html, /aria-pressed="true" data-acao="mudarVistaRasto" data-arg="pessoas"/, 'com as Pessoas ligadas');
    await carregar(g, acao(html, 'mudarVistaRasto', 'equipa'));
    assert.ok(g.rotas.some((r) => r === '/api/equipa/auditoria'), 'a Equipa é a auditoria de sempre');
    assert.match(g.conteudo(), /Quem da equipa fez o quê/);
    assert.match(g.conteudo(), /aria-pressed="true" data-acao="mudarVistaRasto" data-arg="equipa"/);
    // o separador volta à vista que estava aberta, e um alvo da ficha vai à Equipa
    g.ctx.ir('rasto'); await assentar();
    assert.equal(g.rotas.filter((r) => r === '/api/equipa/auditoria').length, 2);
    g.ctx.ir('rasto', 'U1'); await assentar();
    assert.ok(g.rotas.includes('/api/equipa/auditoria?alvo=U1'));
    assert.deepEqual(g.proibidos, []);
  });

  test('o admin tem o separador e só as Pessoas: sem abas, e um alvo não o leva à auditoria', async () => {
    const g = await correr(ADMIN, (rota) => (rota.startsWith('/api/equipa/rasto/pessoas') ? { pessoas: PESSOAS } : {}));
    assert.match(g.nav(), /data-arg="rasto"/);
    g.ctx.ir('rasto'); await assentar();
    assert.ok(g.rotas.includes('/api/equipa/rasto/pessoas?dias=30'));
    assert.equal(acao(g.conteudo(), 'mudarVistaRasto'), undefined, 'sem a aba Equipa');
    assert.match(g.conteudo(), /P-ABC234/);
    g.ctx.ir('rasto', 'U1'); await assentar();
    assert.ok(!g.rotas.some((r) => r.startsWith('/api/equipa/auditoria')), 'nunca pede a auditoria');
  });

  test('o suporte não tem o separador; no pedido, «Ver o rasto» abre a linha do tempo de quem escreveu, sem lista nem ficha', async () => {
    const g = await correr(SUPORTE, (rota) => {
      if (rota === '/api/equipa/pedidos/T1') {
        return { pedido: { id: 'T1', subject: 'Não consigo', body: 'b', category: 'user', status: 'criado', created_at: 1 }, msgs: [],
          quem: { id: 'U1', nome: 'Rita', email: 'r@x.pt', casas: 1, registos: 2, aceitouTermos: true }, outros: [] };
      }
      if (rota === '/api/equipa/modelos') return { modelos: [] };
      if (rota === '/api/equipa/rasto/ticket/T1') return { pid: 'P-ABC234' };
      if (rota === '/api/equipa/rasto/pessoa/P-ABC234') return PESSOA;
      return { pedidos: [] };
    });
    assert.doesNotMatch(g.nav(), /data-arg="rasto"/, 'sem o separador Rasto');
    g.ctx.verPedido('T1'); await assentar();
    assert.ok(g.rotas.includes('/api/equipa/rasto/ticket/T1'), 'pergunta o pseudónimo de quem escreveu');
    const botao = acao(g.els.pedidoRasto.innerHTML, 'verRastoPessoa');
    assert.deepEqual({ ...botao }, { acao: 'verRastoPessoa', arg: 'P-ABC234', arg2: 'pedido', arg3: 'T1' });
    assert.match(g.els.pedidoRasto.innerHTML, />Ver o rasto</);
    await carregar(g, botao);
    const html = g.conteudo();
    assert.ok(g.rotas.includes('/api/equipa/rasto/pessoa/P-ABC234'));
    assert.match(html, /<span class="rs-pid">P-ABC234<\/span>/);
    assert.ok(acao(html, 'verPedido', 'T1'), 'volta ao pedido');
    assert.match(html, /Voltar ao pedido/);
    assert.equal(acao(html, 'verPessoa'), undefined, 'sem a ida à ficha');
    assert.equal(acao(html, 'ir', 'rasto'), undefined, 'sem a ida à lista');
    assert.ok(!g.rotas.some((r) => r.startsWith('/api/equipa/rasto/pessoas')), 'nunca pede a lista');
    assert.doesNotMatch(g.nav(), /data-arg="rasto"/, 'e a barra continua sem o Rasto');
  });

  test('sem pid (não aceitou) o pedido não mostra nada; o dev nem pergunta', async () => {
    const pedido = (rota) => (rota === '/api/equipa/pedidos/T2'
      ? { pedido: { id: 'T2', subject: 's', body: 'b', category: 'client', status: 'criado', created_at: 1 }, msgs: [],
          quem: { id: 'U2', nome: 'P', email: 'p@x.pt', casas: 0, registos: 0, aceitouTermos: true }, outros: [] }
      : rota === '/api/equipa/rasto/ticket/T2' ? { pid: null } : rota === '/api/equipa/modelos' ? { modelos: [] } : { pedidos: [] });
    const a = await correr(ADMIN, pedido);
    a.ctx.verPedido('T2'); await assentar();
    assert.ok(a.rotas.includes('/api/equipa/rasto/ticket/T2'));
    assert.equal(a.els.pedidoRasto.innerHTML, '', 'sem pid, sem botão');
    const d = await correr(DEV, pedido);
    d.ctx.verPedido('T2'); await assentar();
    assert.ok(!d.rotas.some((r) => r.includes('/rasto/')), 'o dev não pede o rasto');
    assert.doesNotMatch(d.conteudo(), /pedidoRasto/);
  });

  test('na ficha, o master e o admin têm «Ver o rasto da pessoa» ao lado do «Ver no rasto»; o suporte não pergunta', async () => {
    const ficha = (master) => (rota) => {
      if (rota === '/api/equipa/pessoas/U1') return { quem: { id: 'U1', nome: 'Rita', email: 'r@x.pt', casas: 0, registos: 0, pedidos: 0, errosApanhados: 0 }, pedidos: [], master };
      if (rota === '/api/equipa/rasto/conta/U1') return { pid: 'P-ABC234' };
      if (rota === '/api/equipa/rasto/pessoa/P-ABC234') return PESSOA;
      return {};
    };
    const m = await correr(MASTER, ficha(true));
    m.ctx.verPessoa('U1'); await assentar();
    assert.ok(m.rotas.includes('/api/equipa/rasto/conta/U1'));
    assert.match(m.conteudo(), /Ver no rasto/, 'o da auditoria fica');
    const b = acao(m.els.fichaRasto.innerHTML, 'verRastoPessoa');
    assert.deepEqual({ ...b }, { acao: 'verRastoPessoa', arg: 'P-ABC234', arg2: 'conta', arg3: 'U1' });
    await carregar(m, b);
    assert.ok(acao(m.conteudo(), 'verPessoa', 'U1'), 'o master tem a ida à ficha');
    assert.match(m.conteudo(), /Voltar à ficha/);
    const s = await correr(SUPORTE, ficha(false));
    s.ctx.verPessoa('U1'); await assentar();
    assert.ok(!s.rotas.some((r) => r.includes('/rasto/')), 'o suporte não pergunta pelo rasto da conta');
  });
});

/* ------------------------------- as vistas ------------------------------- */

describe('a vista Pessoas', () => {
  test('a lista: pid em monoespaçado, última atividade, sessões, eventos, origens, sinais com nomes e contagens, contas de teste marcadas', async () => {
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoas') ? { pessoas: PESSOAS } : {}));
    g.ctx.verRastoPessoas(30); await assentar();
    const html = g.conteudo();
    semEmLinha(html, 'a lista');
    assert.match(html, /<table class="tb empilha rs-tb">/, 'a tabela empilha no telemóvel');
    for (const rot of ['Pessoa', 'Última atividade', 'Sessões', 'Eventos', 'Origens', 'Sinais']) assert.match(html, new RegExp('data-rot="' + rot + '"'));
    assert.match(html, /class="ligacao rs-pid" data-acao="verRastoPessoa" data-arg="P-ABC234">P-ABC234</);
    assert.match(html, /há 5 min/);
    assert.match(html, /Toques em vão <b class="n">2<\/b>/);
    for (const nome of ['Toques repetidos', 'Vai-e-volta', 'Desistências', 'Erros ao guardar']) assert.match(html, new RegExp(nome + ' <b'));
    assert.match(html, /<span class="badge rs-s dg">Erros ao guardar <b class="n">3<\/b>/, 'o erro ao guardar em vermelho');
    assert.match(html, /Conta de teste/);
    assert.match(html, /Sem conta/, 'o visitante só da montra');
    assert.match(html, /<span class="badge ac">App<\/span>/);
    assert.match(html, /<span class="badge">Montra<\/span>/);
    assert.match(html, /3 pessoas/);
    assert.match(html, /2 pessoas com sinais de se terem perdido/);
    assert.match(html, /O que quer dizer cada sinal/, 'com a legenda');
    // os filtros: 7, 30 e 90 dias, por pessoa ou por ecrã
    for (const n of [7, 30, 90]) assert.ok(acao(html, 'verRastoPessoas', n), n + ' dias');
    assert.ok(acao(html, 'verRastoResumo', 30), 'por ecrã');
    await carregar(g, acao(html, 'verRastoPessoas', 7));
    assert.ok(g.rotas.includes('/api/equipa/rasto/pessoas?dias=7'));
  });

  test('a ordem: as mais recentes como vêm, ou as com mais sinais primeiro', async () => {
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoas') ? { pessoas: PESSOAS } : {}));
    g.ctx.verRastoPessoas(); await assentar();
    const ordem = () => [...g.conteudo().matchAll(/data-acao="verRastoPessoa" data-arg="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ordem(), ['P-ABC234', 'P-ZZZ999', 'P-MNT777']);
    const n = g.rotas.length;
    await carregar(g, acao(g.conteudo(), 'ordenarRasto', 'sinais'));
    assert.deepEqual(ordem(), ['P-ZZZ999', 'P-ABC234', 'P-MNT777']);
    assert.equal(g.rotas.length, n, 'mudar a ordem não volta à rede');
    assert.match(g.conteudo(), /aria-pressed="true" data-acao="ordenarRasto" data-arg="sinais"/);
  });

  test('a pessoa: uma secção por sessão, a mais recente primeiro e aberta, com início, duração, origens e contagem', async () => {
    const g = await correr(MASTER, (rota) => (rota === '/api/equipa/rasto/pessoa/P-ABC234' ? PESSOA : {}));
    g.ctx.verRastoPessoa('P-ABC234'); await assentar();
    const html = g.conteudo();
    semEmLinha(html, 'a pessoa');
    const sessoes = html.split('<details class="card rs-sessao"').slice(1);
    assert.equal(sessoes.length, 2);
    assert.match(sessoes[0], /^ open>/, 'a mais recente abre já aberta');
    assert.doesNotMatch(sessoes[1], /^ open>/, 'as outras fechadas');
    assert.match(sessoes[0], /28\/10\/2026 14:02/);
    assert.match(sessoes[0], /8 min · 9 eventos/);
    assert.match(sessoes[0], /2 sinais/);
    assert.match(sessoes[1], /28\/10\/2026 13:50/);
    assert.match(sessoes[1], /2 min · 4 eventos/);
    // cada evento: hora com segundos, origem, o que fez em palavras, onde e o sinal
    for (const rot of ['Hora', 'Origem', 'O que fez', 'Onde', 'Sinal']) assert.match(sessoes[0], new RegExp('<th>' + rot + '</th>'), rot);
    assert.doesNotMatch(sessoes[0], /<th>(?:Tipo|Ecrã|Janela|Alvo)<\/th>/, 'sem as colunas cruas de antes');
    assert.match(sessoes[0], /data-rot="Hora">14:02:05</);
    assert.match(sessoes[0], /data-rot="Hora">14:03:17</);
    assert.match(sessoes[0], /Abriu o ecrã Visão geral/);
    assert.match(sessoes[0], /Abriu o ecrã Definições › Tema/);
    assert.match(sessoes[0], /Abriu a janela de «Adicionar ou editar imóvel»/);
    assert.match(sessoes[0], /Um campo deu erro ao guardar<\/span><code class="rs-cru">input#p_name<\/code>/, 'o campo, cru e discreto');
    assert.match(sessoes[0], /data-rot="Onde">Imóveis › janela de «Adicionar ou editar imóvel»</);
    assert.match(sessoes[0], /<tr class="rs-sinal wa">[\s\S]*?<span class="badge rs-s wa">Toque em vão<\/span>/, 'o toque em vão destacado');
    assert.match(sessoes[0], /<tr class="rs-sinal dg">[\s\S]*?Erro ao guardar/, 'o erro ao guardar destacado a vermelho');
    // a passagem da montra para a app, entre as sessões
    assert.match(html, /Passou da montra para a app, 11 min depois\./);
    assert.match(html, /Com conta/);
    assert.ok(acao(html, 'verPessoa', 'U1'), 'o master vai à ficha');
    assert.ok(acao(html, 'ir', 'rasto'), 'e volta às pessoas');
  });

  /* Os dois tickets de QA do Martinho (1895e0a9 e 03f1d309): num botão, o
     nome dele como a app o escreve e sem posição; fora de botões, o nome do
     sítio e a posição; as páginas visitadas no topo de cada sessão; e os
     registos que mudaram numa frase. */
  test('um toque num botão diz o nome dele, sem posição', async () => {
    const g = await correr(MASTER, (rota) => (rota === '/api/equipa/rasto/pessoa/P-ABC234' ? PESSOA : {}));
    g.ctx.verRastoPessoa('P-ABC234'); await assentar();
    const linha = (hora) => (new RegExp('<tr[^>]*><td class="n nw" data-rot="Hora">' + hora + '</td>[\\s\\S]*?</tr>').exec(g.conteudo()) || [''])[0];
    const botao = linha('14:04:00');
    assert.match(botao, /Tocou em <span class="rs-rotulo">«Adicionar ou editar imóvel»<\/span>/, 'o nome do botão');
    assert.doesNotMatch(botao, /% da esquerda|% do cimo|click:|propModal/, 'sem posição nem o descritor cru');
    assert.match(linha('14:02:30'), /Tocou em <span class="rs-rotulo">«Ir para um separador»<\/span>/);
    assert.doesNotMatch(linha('14:02:30'), /% da esquerda/);
    const ligacao = linha('13:51:30');
    assert.match(ligacao, /Tocou em <span class="rs-rotulo">«Criar conta»<\/span>/, 'uma ligação pelo destino');
    assert.doesNotMatch(ligacao, /% da esquerda|app\.rendorium\.com/);
  });

  test('um toque fora de botões diz o sítio em palavras e onde caiu', async () => {
    const g = await correr(MASTER, (rota) => (rota === '/api/equipa/rasto/pessoa/P-ABC234' ? PESSOA : {}));
    g.ctx.verRastoPessoa('P-ABC234'); await assentar();
    const html = g.conteudo();
    assert.match(html, /<span>Tocou num cartão<\/span><span class="sub n">a 51% da esquerda e 30% do cimo · janela 384×785<\/span>/);
    assert.match(html, /<span>Tocou num texto da maquete<\/span><span class="sub n">a 30% da esquerda e 45% do cimo/, 'também na montra');
    assert.doesNotMatch(html, /<code class="rs-cru">div\.card<\/code>/, 'um sítio que se conhece não leva o descritor');
  });

  test('um descritor que nenhum dicionário conhece aparece cru e discreto', async () => {
    const uma = { pid: 'P-CRU222', userId: null, teste: false, sessoes: [{ sessao: 's-cru', inicio: t(27, 9, 0, 0), fim: t(27, 9, 0, 9), origens: ['app'], eventos: [
      evApp(t(27, 9, 0, 0), { tipo: 'ecra', ecra: 'novidade' }),
      evApp(t(27, 9, 0, 3), { ecra: 'novidade', alvo: 'click:acaoQueAindaNaoExiste', x: 10, y: 10 }),
      evApp(t(27, 9, 0, 6), { ecra: 'novidade', alvo: 'div.coisa-nova', x: 200, y: 700, sinal: 'em-vao' }),
      evApp(t(27, 9, 0, 9), { ecra: 'novidade', janela: 'janelaNova', tipo: 'janela-abre' }),
    ] }] };
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoa/') ? uma : {}));
    g.ctx.verRastoPessoa('P-CRU222'); await assentar();
    const html = g.conteudo();
    semEmLinha(html, 'o cru');
    assert.match(html, /Abriu o ecrã <code class="rs-cru">novidade<\/code>/);
    assert.match(html, /<span>Tocou num botão<\/span><code class="rs-cru">acaoQueAindaNaoExiste<\/code>/, 'o botão sem rótulo, sem posição');
    assert.doesNotMatch(html, /a 1% da esquerda/);
    assert.match(html, /<span>Tocou em <code class="rs-cru">div\.coisa-nova<\/code><\/span><span class="sub n">a 20% da esquerda e 70% do cimo/);
    assert.match(html, /Abriu a janela <code class="rs-cru">janelaNova<\/code>/);
  });

  test('cada sessão abre com as páginas visitadas, por ordem e sem repetir seguidas, e os dados numa frase', async () => {
    const g = await correr(MASTER, (rota) => (rota === '/api/equipa/rasto/pessoa/P-ABC234' ? PESSOA : {}));
    g.ctx.verRastoPessoa('P-ABC234'); await assentar();
    const sessoes = g.conteudo().split('<details class="card rs-sessao"').slice(1);
    assert.match(sessoes[0], /<summary>[\s\S]*?<\/summary><div class="rs-sessao-resumo"><p><span class="forte">Páginas visitadas:<\/span> Visão geral › Imóveis › Definições › Tema<\/p>/,
      'logo por baixo do cabeçalho da sessão');
    assert.match(sessoes[0], /<span class="forte">Dados:<\/span> Adicionou 1 imóvel e 36 movimentos; editou 2 contratos<\/p>/);
    assert.match(sessoes[1], /Páginas visitadas:<\/span> Início da montra<\/p>/, 'a secção vista não é uma página, e o mesmo ecrã não se repete');
    assert.match(sessoes[1], /Viu a secção «Contratos»/);
    assert.doesNotMatch(sessoes[1], /Dados:/, 'sem registos, sem a linha');
  });

  test('um evento de dados lê-se como uma frase, com os plurais certos, e nunca com «(s)»', async () => {
    const dados = (at, alvo) => evApp(at, { tipo: 'dados', ecra: null, alvo });
    const uma = { pid: 'P-DAD222', userId: 'U9', teste: false, sessoes: [{ sessao: 's-dad', inicio: t(27, 9, 0, 0), fim: t(27, 9, 0, 3), origens: ['app'], eventos: [
      dados(t(27, 9, 0, 0), 'dados:house+1'),
      dados(t(27, 9, 0, 1), 'dados:tx-36,visit+1,visit+2'),
      dados(t(27, 9, 0, 2), 'dados:contract~2,tenant~1,group-1,profile~1,settings~1'),
      dados(t(27, 9, 0, 3), 'dados:rec+2,tpl+1,nada+4,tx*9'),
    ] }] };
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoa/') ? uma : {}));
    g.ctx.verRastoPessoa('P-DAD222'); await assentar();
    const html = g.conteudo();
    assert.match(html, /data-rot="O que fez"><span class="rs-alvo-bloco"><span class="rs-rotulo">Adicionou 1 imóvel<\/span>/);
    assert.match(html, /<span class="rs-rotulo">Adicionou 3 visitas; removeu 36 movimentos<\/span>/, 'as contagens do mesmo tipo somam-se');
    assert.match(html, /<span class="rs-rotulo">Editou 2 contratos, 1 inquilino, o perfil e as definições; removeu 1 grupo<\/span>/);
    assert.match(html, /<span class="rs-rotulo">Adicionou 2 planeados e 1 modelo<\/span>/, 'um tipo ou uma operação desconhecidos deitam-se fora');
    assert.match(html, /Dados:<\/span> Adicionou 1 imóvel, 2 planeados, 1 modelo e 3 visitas; editou 2 contratos, 1 inquilino, o perfil e as definições; removeu 36 movimentos e 1 grupo<\/p>/,
      'e a sessão soma-os todos');
    assert.doesNotMatch(html, /\(s\)/);
  });

  test('a passagem da montra para a app dentro de uma sessão também se lê', async () => {
    const uma = { pid: 'P-UNA222', userId: null, teste: true, sessoes: [{ sessao: 's-x', inicio: t(27, 9, 0, 0), fim: t(27, 9, 1, 0), origens: ['montra', 'app'], eventos: [
      { at: t(27, 9, 1, 0), origem: 'app', tipo: 'ecra', ecra: 'inicio', sinal: null },
      { at: t(27, 9, 0, 0), origem: 'montra', tipo: 'pagina', ecra: '/', sinal: null },
    ] }] };
    const g = await correr(ADMIN, (rota) => (rota.startsWith('/api/equipa/rasto/pessoa/') ? uma : {}));
    g.ctx.verRastoPessoa('P-UNA222'); await assentar();
    const html = g.conteudo();
    assert.match(html, /<tr class="rs-passa"><td colspan="5">[\s\S]*?Passou da montra para a app<\/td><\/tr>/);
    assert.ok(html.indexOf('09:01:00') < html.indexOf('09:00:00'), 'o evento mais recente em cima, como as sessões');
    assert.match(html, /Só montra, sem conta/);
    assert.match(html, /Conta de teste/);
    assert.equal(acao(html, 'verPessoa'), undefined, 'sem conta não há ficha');
  });

  test('dentro da sessão, do mais recente para o mais antigo, com cada passagem entre os seus dois eventos e as páginas pela ordem do tempo', async () => {
    const uma = { pid: 'P-VEM222', userId: 'U9', teste: false, sessoes: [{ sessao: 's-v', inicio: t(27, 9, 0, 0), fim: t(27, 9, 2, 0), origens: ['montra', 'app'], eventos: [
      { at: t(27, 9, 1, 0), origem: 'app', tipo: 'ecra', ecra: 'properties', sinal: null },
      { at: t(27, 9, 2, 0), origem: 'montra', tipo: 'pagina', ecra: '/precos', sinal: null },
      { at: t(27, 9, 0, 0), origem: 'montra', tipo: 'pagina', ecra: '/', sinal: null },
    ] }] };
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoa/') ? uma : {}));
    g.ctx.verRastoPessoa('P-VEM222'); await assentar();
    const corpo = /<tbody>([\s\S]*?)<\/tbody>/.exec(g.conteudo().split('rs-ev')[1])[1];
    const leitura = [...corpo.matchAll(/(\d\d:\d\d:\d\d)|Passou (da \w+ para a \w+)/g)].map((m) => m[1] || m[2]);
    assert.deepEqual(leitura, ['09:02:00', 'da app para a montra', '09:01:00', 'da montra para a app', '09:00:00'],
      'cada passagem fica entre os dois eventos onde a origem mudou e diz o sentido do tempo');
    assert.match(g.conteudo(), /Páginas visitadas:<\/span> Início da montra › Imóveis › <code class="rs-cru">\/precos<\/code><\/p>/,
      'as páginas visitadas são um caminho: pela ordem em que aconteceram, ao contrário da tabela');
  });

  test('o admin não tem a ida à ficha (não abre as Pessoas da equipa)', async () => {
    const g = await correr(ADMIN, (rota) => (rota.startsWith('/api/equipa/rasto/pessoa/') ? PESSOA : {}));
    g.ctx.verRastoPessoa('P-ABC234'); await assentar();
    assert.equal(acao(g.conteudo(), 'verPessoa'), undefined);
  });

  test('o resumo por ecrã: ecrã, alvo, um número por sinal, total e pessoas, do total maior para o menor', async () => {
    const linhas = [
      { ecra: '/', alvo: 'p.m-sub', sinais: { ...SEM_SINAIS, 'em-vao': 2 }, total: 2, pessoas: 2 },
      { ecra: 'properties', alvo: 'click:imvGaleria', sinais: { ...SEM_SINAIS, repetido: 5, 'vai-e-volta': 4 }, total: 9, pessoas: 3 },
      { ecra: 'settings/novo', alvo: 'div.coisa', sinais: { ...SEM_SINAIS, 'em-vao': 1 }, total: 1, pessoas: 1 },
    ];
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/resumo') ? { linhas } : {}));
    g.ctx.verRastoResumo(90); await assentar();
    assert.ok(g.rotas.includes('/api/equipa/rasto/resumo?dias=90'));
    const html = g.conteudo();
    semEmLinha(html, 'o resumo');
    assert.match(html, /Onde as pessoas se perdem/);
    assert.ok(html.indexOf('«Ver as fotografias»') > -1 && html.indexOf('«Ver as fotografias»') < html.indexOf('Num texto da maquete'), 'o total maior primeiro');
    assert.match(html, /data-rot="Ecrã">Imóveis<\/td><td data-rot="Alvo">«Ver as fotografias»<\/td>/, 'o ecrã e o botão em palavras');
    assert.match(html, /data-rot="Ecrã">Início da montra<\/td><td data-rot="Alvo">Num texto da maquete<\/td>/, 'e o sítio');
    assert.match(html, /data-rot="Ecrã"><code class="rs-cru">settings\/novo<\/code><\/td><td data-rot="Alvo"><code class="rs-cru">div\.coisa<\/code>/, 'o que não se conhece, cru');
    assert.doesNotMatch(html, /click:imvGaleria/);
    for (const rot of ['Ecrã', 'Alvo', 'Toques em vão', 'Toques repetidos', 'Vai-e-volta', 'Desistências', 'Erros ao guardar', 'Total', 'Pessoas']) {
      assert.match(html, new RegExp('data-rot="' + rot + '"'), rot);
    }
    assert.match(html, /class="r n rs-n wa" data-rot="Toques repetidos">5</);
    assert.match(html, /class="r n forte" data-rot="Total">9</);
    assert.match(html, /aria-pressed="true" data-acao="verRastoResumo" data-arg="90"/);
    // e o separador lembra-se de que se estava no resumo
    g.ctx.ir('rasto'); await assentar();
    assert.equal(g.rotas.filter((r) => r.startsWith('/api/equipa/rasto/resumo')).length, 2);
  });
});

/* -------------------------------- os estados -------------------------------- */

describe('os estados do rasto', () => {
  test('a carregar: o topo fica, o miolo espera', async () => {
    let soltar;
    const g = await correr(MASTER, () => ({}));
    g.ctx.fetch = (rota) => { g.rotas.push(rota); return new Promise((r) => { soltar = () => r(new Response('{"pessoas":[]}')); }); };
    g.ctx.verRastoPessoas(30);
    assert.match(g.conteudo(), /<h1>Rasto<\/h1>/);
    assert.match(g.conteudo(), /À espera do servidor/);
    soltar(); await assentar();
  });

  test('vazio: ninguém aceitou ainda (nem nos 90 dias), ou nada neste período (com a ida aos 90 dias)', async () => {
    const nada = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoas') ? { pessoas: [] } : {}));
    nada.ctx.verRastoPessoas(30); await assentar();
    assert.ok(nada.rotas.includes('/api/equipa/rasto/pessoas?dias=90'), 'pergunta pelos 90 dias para saber porquê');
    assert.match(nada.conteudo(), /Ainda não há rasto de ninguém\./);
    assert.match(nada.conteudo(), /Ninguém aceitou o rasto ainda/);
    const antigo = await correr(MASTER, (rota) => (rota === '/api/equipa/rasto/pessoas?dias=90' ? { pessoas: PESSOAS } : rota.startsWith('/api/equipa/rasto/pessoas') ? { pessoas: [] } : {}));
    antigo.ctx.verRastoPessoas(7); await assentar();
    assert.match(antigo.conteudo(), /Ninguém nos últimos 7 dias\./);
    assert.match(antigo.conteudo(), /3 pessoas nos últimos 90 dias/);
    assert.ok(acao(antigo.conteudo(), 'verRastoPessoas', 90), 'com o botão para os 90 dias');
    const resumo = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/resumo') ? { linhas: [] } : {}));
    resumo.ctx.verRastoResumo(30); await assentar();
    assert.match(resumo.conteudo(), /Nenhum sinal nos últimos 30 dias\./);
    const semEventos = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoa/') ? { pid: 'P-VAZ222', userId: null, teste: false, sessoes: [] } : {}));
    semEventos.ctx.verRastoPessoa('P-VAZ222'); await assentar();
    assert.match(semEventos.conteudo(), /Ainda sem eventos\./);
  });

  test('erro: o falha da casa, com o Tentar outra vez da mesma vista', async () => {
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/') ? { status: 500, corpo: { error: 'A base não respondeu.' } } : {}));
    g.ctx.verRastoPessoas(90); await assentar();
    assert.match(g.conteudo(), /Não deu para carregar\./);
    assert.match(g.conteudo(), /A base não respondeu\./);
    const outra = acao(g.conteudo(), 'verRastoPessoas', 90);
    assert.ok(outra, 'tentar outra vez volta aos mesmos 90 dias');
    g.ctx.verRastoPessoa('P-ABC234', 'pedido', 'T1'); await assentar();
    assert.deepEqual({ ...acao(g.conteudo(), 'verRastoPessoa') }, { acao: 'verRastoPessoa', arg: 'P-ABC234', arg2: 'pedido', arg3: 'T1' });
  });

  test('403 dito em palavras, e 404 diz que a pessoa já não tem rasto', async () => {
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoa/P-NAO')
      ? { status: 404, corpo: { error: 'não existe' } } : { status: 403, corpo: { error: 'Forbidden' } }));
    g.ctx.verRastoPessoas(30); await assentar();
    assert.match(g.conteudo(), /Este rasto não abre ao teu papel\./);
    assert.match(g.conteudo(), /o suporte vê o de quem escreveu um pedido/);
    assert.doesNotMatch(g.conteudo(), /Tentar outra vez/, 'tentar outra vez não muda o papel');
    g.ctx.verRastoPessoa('P-NAO123', 'pedido', 'T9'); await assentar();
    assert.match(g.conteudo(), /Esta pessoa já não tem rasto\./);
    assert.ok(acao(g.conteudo(), 'verPedido', 'T9'), 'com o voltar ao pedido');
  });

  test('um pid hostil fica texto: nem corre nem parte o HTML', async () => {
    const mau = 'P-"><img src=x>';
    const g = await correr(MASTER, (rota) => (rota.startsWith('/api/equipa/rasto/pessoas') ? { pessoas: [{ ...PESSOAS[0], pid: mau }] } : {}));
    g.ctx.verRastoPessoas(30); await assentar();
    assert.doesNotMatch(g.conteudo(), /<img/);
    assert.equal(acao(g.conteudo(), 'verRastoPessoa').arg, mau, 'e chega à ação tal e qual');
    assert.deepEqual(g.proibidos, []);
  });
});

/* ------------------------------ as regras da casa ------------------------------ */

describe('as regras da casa no rasto', () => {
  test('o código do guião não usa alert, confirm, prompt nem <select>, e as ações novas estão na tabela', () => {
    const codigo = GUIAO.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(codigo, /\balert\(|\bconfirm\(|\bprompt\(|<select/);
    assert.doesNotMatch(codigo, /\sstyle=|\son(?:click|keydown|change|input)=/);
    for (const n of ['mudarVistaRasto', 'verRastoPessoas', 'verRastoResumo', 'ordenarRasto', 'verRastoPessoa']) {
      assert.match(GUIAO, new RegExp('\\n  ' + n + ': function'), n + ' na tabela ACOES');
    }
  });

  test('o CSS do rasto: :hover só onde há rato, o sinal no contorno e na letra, e o toque com 48px', () => {
    const i = CSS_EQUIPA.indexOf('/* o rasto das pessoas');
    const f = CSS_EQUIPA.indexOf('/* o dedo precisa de 44px');
    assert.ok(i > -1 && f > i, 'o bloco do rasto existe');
    const bloco = CSS_EQUIPA.slice(i, f);
    for (const l of bloco.split('\n').filter((x) => x.includes(':hover'))) {
      assert.ok(l.startsWith('@media(hover:hover) and (pointer:fine)'), 'hover fora do portão: ' + l);
    }
    assert.match(bloco, /\.badge\.rs-s\{border:1px solid currentColor\}/, 'o selo do sinal com contorno');
    assert.match(bloco, /\.rs-ev tr\.rs-sinal td\{color:var\(--warn\)/, 'a linha do sinal na cor da frente');
    assert.match(bloco, /\.rs-ev tr\.rs-sinal td:first-child\{box-shadow:inset 3px 0 0 var\(--warn\)\}/, 'e marcada no contorno');
    assert.match(bloco, /\.rs-sessao>summary\{[^}]*min-height:48px/, 'as sessões tocam-se com o dedo');
    assert.doesNotMatch(bloco, /#[0-9a-f]{3,8}\b/i, 'cores só por tokens');
  });
});
