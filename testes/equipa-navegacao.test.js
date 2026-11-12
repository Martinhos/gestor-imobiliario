// A navegação do back office (/equipa) é a da app: a barra lateral com o
// Kanban ao cimo (só no dev) e os grupos «Atendimento» e «Plataforma», que se
// recolhem e se lembram no aparelho; abaixo dos 900px a gaveta, aberta pelo ☰,
// e a barra de baixo com os destinos de cada papel (no dev com o + «Novo
// cartão» a meio); o endereço #secção/resto, que recarregar e as ligações
// seguem; o arranque no DOMContentLoaded, para o /equipa/kanban.js (que
// carrega depois do guião) já ter registado o verKanban; e os :hover do
// CSS_EQUIPA só onde há rato. Corre o guião servido pelo /equipa/guiao.js numa
// página de faz-de-conta com o que a navegação toca (classes, atributos,
// foco, inert, localStorage, history, getComputedStyle).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { paginaEquipa, CSS_EQUIPA } from '../worker/src/equipa-vista.js';
import { CSS_QA_EQUIPA } from '../worker/src/equipa-qa.js';
import { GUIAO } from '../worker/src/equipa-guiao.js';
import { recursoDePagina } from '../worker/src/paginas-recursos.js';
import { MASTER, SUPORTE, DEV, ADMIN } from './lib/equipa.js';

const assentar = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };

/* Um elemento de faz-de-conta: o HTML, a classe, os atributos, o classList,
   o inert e o foco (que fica registado em quem pede).
   Recebe: id — o id; foco — o objeto onde se escreve quem tem o foco.
   Devolve: o elemento. */
function elemento(id, foco) {
  const classes = new Set(), attrs = {};
  return {
    id, innerHTML: '', className: '', value: '', inert: false,
    classList: {
      add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
      toggle: (c, f) => { const on = f === undefined ? !classes.has(c) : !!f; if (on) classes.add(c); else classes.delete(c); return on; },
    },
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
    focus() { foco.em = id; }, showModal() {}, close() {}, querySelector: () => null,
  };
}

/* Corre o guião numa página de faz-de-conta.
   Recebe: eu — a sessão de equipa; o (opcional) — {qa: o ENV_NAME (com ele há
   kanban), hash: o endereço inicial, telemovel: true para a barra ser gaveta
   (position fixed), guardado: o texto do eq_nav_fechadas, armazenamentoFechado,
   aCarregar: true para o documento estar ainda a ler-se, contagens: {pessoas, erros}}.
   Devolve: {ctx, els, ouvintes, janela, foco, rotas, guardado, enderecos, nav(), barra(), fogo(tipo, ev)}. */
async function correr(eu, o = {}) {
  const html = await new Response(paginaEquipa(eu, o.qa ? { qa: o.qa } : undefined).body).text();
  const guiao = await (await recursoDePagina('/equipa/guiao.js', 'GET', async () => true)).text();
  const dados = /<script type="application\/json" id="dados-equipa">([\s\S]*?)<\/script>/.exec(html)[1];
  const foco = { em: '' };
  const els = { 'dados-equipa': { id: 'dados-equipa', textContent: dados } };
  const pega = (id) => els[id] || (els[id] = elemento(id, foco));
  const ouvintes = {}, janela = {}, rotas = [], enderecos = [];
  const guardado = { eq_nav_fechadas: o.guardado };
  const n = Object.assign({ pessoas: 2, erros: 3 }, o.contagens || {});
  const location = { hash: o.hash || '', reload() {} };
  const ctx = vm.createContext({
    document: {
      title: '', readyState: o.aCarregar ? 'loading' : 'complete',
      body: pega('body'), documentElement: pega('html'),
      getElementById: pega,
      addEventListener(t, f) { (ouvintes[t] = ouvintes[t] || []).push(f); },
      querySelector(sel) {
        const m = /^#nav \[aria-controls="([^"]+)"\]$/.exec(sel);
        if (m) {
          if (!pega('nav').innerHTML.includes('aria-controls="' + m[1] + '"')) return null;
          const tit = pega('tit-' + m[1]);
          tit.parentNode = pega('sec-' + m[1]);
          return tit;
        }
        if (sel === '#nav .nv, #nav .eq-sec-tit') return { focus() { foco.em = 'primeiro-da-gaveta'; } };
        return null;
      },
    },
    location,
    history: { state: null, replaceState(s, t, url) { location.hash = url; enderecos.push(url); } },
    localStorage: {
      getItem(k) { if (o.armazenamentoFechado) throw new Error('fechado'); return guardado[k] == null ? null : guardado[k]; },
      setItem(k, v) { if (o.armazenamentoFechado) throw new Error('fechado'); guardado[k] = String(v); },
    },
    getComputedStyle: (e) => ({ position: o.telemovel && e && e.id === 'gaveta' ? 'fixed' : 'sticky' }),
    matchMedia: () => ({ matches: false, addEventListener(t, f) { janela.largura = f; } }),
    addEventListener(t, f) { janela[t] = f; },
    fetch: async (rota) => {
      rotas.push(String(rota));
      const r = /^\/api\/equipa\/pedidos\?tipo=(pessoas|erros)&estado=abertos$/.exec(String(rota));
      const corpo = r ? { pedidos: Array.from({ length: n[r[1]] }, (x, i) => ({ id: r[1] + i, subject: 's', category: r[1] === 'pessoas' ? 'user' : 'server', status: 'criado', created_at: 1 })) } : {};
      return new Response(JSON.stringify(corpo), { status: 200 });
    },
    setTimeout, console,
  });
  vm.runInContext(guiao, ctx);
  await assentar();
  return {
    ctx, els, ouvintes, janela, foco, rotas, guardado, enderecos, location,
    nav: () => pega('nav').innerHTML,
    barra: () => pega('tabbar').innerHTML,
    fogo: (t, ev) => (ouvintes[t] || []).forEach((f) => f(ev || {})),
  };
}

// os destinos da barra lateral, pela ordem
const itensDaNav = (h) => [...h.matchAll(/<button type="button" class="nv"(?: aria-current="page")? data-acao="ir" data-arg="([a-z]+)"/g)].map((m) => m[1]);
// os grupos que recolhem, pela ordem
const gruposDaNav = (h) => [...h.matchAll(/aria-controls="eq-sec-([a-z]+)"/g)].map((m) => m[1]);
// a barra de baixo, pela ordem: os destinos e o + no sítio dele
const daBarra = (h) => [...h.matchAll(/class="eq-dest"(?: aria-current="page")? data-acao="ir" data-arg="([a-z]+)"|class="eq-mais"/g)].map((m) => m[1] || '+');
// o destino aceso
const aceso = (h) => (/class="(?:nv|eq-dest)" aria-current="page" data-acao="ir" data-arg="([a-z]+)"/.exec(h) || [])[1];

describe('as secções por papel', () => {
  const ESPERADO = [
    [MASTER, ['pedidos', 'pessoas', 'erros', 'operacao', 'rasto'], ['atendimento', 'plataforma']],
    [SUPORTE, ['pedidos', 'pessoas'], ['atendimento']],
    [DEV, ['erros'], ['plataforma']],
    [ADMIN, ['erros', 'operacao', 'rasto'], ['plataforma']],
  ];
  for (const [eu, itens, grupos] of ESPERADO) {
    test(eu.papel + ': só o que os papéis abrem, e um grupo vazio sai com o título', async () => {
      const prod = await correr(eu);
      assert.deepEqual(itensDaNav(prod.nav()), itens, 'na produção, sem Kanban');
      assert.deepEqual(gruposDaNav(prod.nav()), grupos);
      for (const g of ['atendimento', 'plataforma']) {
        if (!grupos.includes(g)) assert.doesNotMatch(prod.nav(), new RegExp(g === 'atendimento' ? 'Atendimento' : 'Plataforma'), 'sem o título de ' + g);
      }
      assert.equal(aceso(prod.nav()), itens[0], 'abre a primeira que os papéis abrem');
      const dev = await correr(eu, { qa: 'percurso' });
      assert.deepEqual(itensDaNav(dev.nav()), ['kanban', ...itens], 'no dev, o Kanban ao cimo, sem título');
      assert.match(dev.nav(), /^<button type="button" class="nv" aria-current="page" data-acao="ir" data-arg="kanban">/, 'o Kanban é o primeiro, fora dos grupos');
      assert.equal(aceso(dev.nav()), 'kanban');
    });
  }

  test('o nome do destino é o primeiro <span> do botão (é o que a pílula do QA põe no ticket)', async () => {
    const g = await correr(MASTER);
    assert.match(g.nav(), /aria-current="page" data-acao="ir" data-arg="pedidos"><svg[^>]*>[\s\S]*?<\/svg><span>Pedidos<\/span>/);
  });
});

describe('os grupos que recolhem', () => {
  test('o título é um botão com aria-expanded e aria-controls para o contentor dos itens', async () => {
    const g = await correr(MASTER);
    assert.match(g.nav(), /<div class="eq-sec"><button type="button" class="eq-sec-tit" aria-expanded="true" aria-controls="eq-sec-atendimento" data-acao="alternarSeccao" data-arg="atendimento"><span class="eq-sec-txt">Atendimento<\/span>/);
    assert.match(g.nav(), /<div class="eq-sec-corpo" id="eq-sec-atendimento"><div class="eq-sec-itens">/);
  });

  test('recolher muda o nó vivo e guarda no aparelho, sem repintar nem navegar', async () => {
    const g = await correr(MASTER);
    const antes = g.nav(), rotas = g.rotas.length;
    g.ctx.ACOES.alternarSeccao({ arg: 'atendimento' });
    assert.equal(g.guardado.eq_nav_fechadas, '["atendimento"]', 'fica no aparelho');
    assert.equal(g.els['tit-eq-sec-atendimento'].getAttribute('aria-expanded'), 'false');
    assert.ok(g.els['sec-eq-sec-atendimento'].classList.contains('fechada'), 'a classe no grupo vivo');
    assert.equal(g.nav(), antes, 'não repinta');
    assert.equal(g.rotas.length, rotas, 'nem pede nada');
    assert.equal(g.ctx.seccao, 'pedidos', 'nem navega');
    assert.match(g.els.nav.htmlPintado, /<div class="eq-sec fechada"><button type="button" class="eq-sec-tit" aria-expanded="false" aria-controls="eq-sec-atendimento"/, 'o HTML guardado acompanha');
    g.ctx.ACOES.alternarSeccao({ arg: 'atendimento' });
    assert.equal(g.guardado.eq_nav_fechadas, '[]', 'abrir tira-o');
    g.ctx.ACOES.alternarSeccao({ arg: 'nada' });
    assert.equal(g.guardado.eq_nav_fechadas, '[]', 'um grupo que não existe não se guarda');
  });

  test('o recolhido lembra-se ao recarregar, com a soma dos crachás no título', async () => {
    const g = await correr(MASTER, { guardado: '["plataforma"]', contagens: { erros: 3 } });
    assert.match(g.nav(), /<div class="eq-sec fechada"><button type="button" class="eq-sec-tit" aria-expanded="false" aria-controls="eq-sec-plataforma"/);
    assert.match(g.nav(), /aria-controls="eq-sec-plataforma"[^>]*><span class="eq-sec-txt">Plataforma<\/span><span class="nb n erro">3<span class="so-leitor"> por tratar<\/span><\/span>/,
      'a soma dos erros por tratar, a vermelho');
    assert.match(g.nav(), /<div class="eq-sec"><button type="button" class="eq-sec-tit" aria-expanded="true" aria-controls="eq-sec-atendimento"[^>]*><span class="eq-sec-txt">Atendimento<\/span><span class="nb n">2/,
      'os pedidos somados no Atendimento, quentes');
    assert.match(CSS_EQUIPA, /\.eq-sec-tit \.nb\{display:none;/, 'aberto, o crachá do título não se vê');
    assert.match(CSS_EQUIPA, /\.eq-sec\.fechada>\.eq-sec-tit \.nb\{display:inline-flex\}/, 'recolhido, vê-se');
  });

  test('chegar a uma secção abre o grupo dela; recolher à mão onde se está vale até sair', async () => {
    const g = await correr(MASTER, { guardado: '["plataforma"]' });
    g.ctx.ir('erros'); await assentar();
    assert.equal(g.guardado.eq_nav_fechadas, '[]');
    assert.match(g.nav(), /<div class="eq-sec"><button[^>]*aria-controls="eq-sec-plataforma"/);
    g.ctx.ACOES.alternarSeccao({ arg: 'plataforma' });
    // um crachá que muda repinta a barra (o HTML mudou): o grupo continua recolhido
    g.ctx.contagens.pessoas = 9;
    g.ctx.contar('erros'); await assentar();
    assert.match(g.nav(), /<span class="nb n">9/, 'repintou');
    assert.match(g.nav(), /<div class="eq-sec fechada"><button[^>]*aria-controls="eq-sec-plataforma"/, 'repintar na mesma secção não o reabre');
    g.ctx.ir('pedidos'); await assentar();
    g.ctx.ir('rasto'); await assentar();
    assert.match(g.nav(), /<div class="eq-sec"><button[^>]*aria-controls="eq-sec-plataforma"/, 'sair e voltar abre-o');
  });

  test('com o armazenamento fechado está tudo aberto, e recolher não rebenta', async () => {
    const g = await correr(MASTER, { armazenamentoFechado: true });
    assert.doesNotMatch(g.nav(), /eq-sec fechada/);
    assert.doesNotThrow(() => g.ctx.ACOES.alternarSeccao({ arg: 'plataforma' }));
    assert.equal(g.els['tit-eq-sec-plataforma'].getAttribute('aria-expanded'), 'false', 'fica em memória');
  });

  test('o CSS: a altura por grid-template-rows, o visibility a tirar os itens do Tab, a seta que roda, 44px no dedo', () => {
    assert.match(CSS_EQUIPA, /\.eq-sec-corpo\{display:grid;grid-template-rows:1fr;transition:grid-template-rows var\(--medio\) var\(--curva\)\}/);
    assert.match(CSS_EQUIPA, /\.eq-sec\.fechada>\.eq-sec-corpo\{grid-template-rows:0fr\}/);
    assert.match(CSS_EQUIPA, /\.eq-sec\.fechada \.eq-sec-itens\{visibility:hidden;transition:visibility 0s linear var\(--medio\)\}/);
    assert.match(CSS_EQUIPA, /\.eq-sec\.fechada>\.eq-sec-tit \.eq-sec-seta\{transform:rotate\(-90deg\)\}/);
    assert.match(CSS_EQUIPA, /@media\(pointer:coarse\)\{[^}]*\.eq-sec-tit[^}]*\{min-height:44px\}/);
  });
});

describe('a barra de baixo', () => {
  const ESPERADO = [
    [MASTER, ['kanban', 'pedidos', '+', 'erros', 'pessoas'], ['pedidos', 'erros', 'pessoas', 'operacao']],
    [SUPORTE, ['kanban', 'pedidos', '+', 'pessoas'], ['pedidos', 'pessoas']],
    [DEV, ['kanban', '+', 'erros'], ['erros']],
    [ADMIN, ['kanban', 'erros', '+', 'operacao', 'rasto'], ['erros', 'operacao', 'rasto']],
  ];
  for (const [eu, noDev, naProducao] of ESPERADO) {
    test(eu.papel + ': no dev com o + a meio, na produção sem ele; o que o papel não abre dá o lugar ao seguinte', async () => {
      const dev = await correr(eu, { qa: 'percurso' });
      assert.deepEqual(daBarra(dev.barra()), noDev);
      const d = noDev.filter((x) => x !== '+').length;
      assert.equal(dev.els.tabbar.className, 'eq-barra d' + d + ' mais');
      const prod = await correr(eu);
      assert.deepEqual(daBarra(prod.barra()), naProducao);
      assert.equal(prod.els.tabbar.className, 'eq-barra d' + naProducao.length);
      assert.doesNotMatch(prod.barra(), /eq-mais|Novo cartão/, 'sem kanban, sem +');
    });
  }

  test('o + diz «Novo cartão» e chama o novoCartao do kanban.js, se existir', async () => {
    const g = await correr(MASTER, { qa: 'percurso' });
    assert.match(g.barra(), /<button type="button" class="eq-mais" aria-label="Novo cartão" data-acao="maisDaBarra">/);
    g.ctx.ACOES.maisDaBarra({});
    assert.equal(g.ctx.seccao, 'kanban', 'sem o novoCartao, vai ao Kanban');
    let chamado = 0;
    g.ctx.novoCartao = () => { chamado++; };
    g.ctx.ACOES.maisDaBarra({});
    assert.equal(chamado, 1);
    const p = await correr(MASTER);
    p.ctx.novoCartao = () => { chamado++; };
    p.ctx.ACOES.maisDaBarra({});
    assert.equal(chamado, 1, 'na produção não faz nada');
  });

  test('o aceso segue a secção, e os crachás de Pedidos e Erros vão também na barra', async () => {
    const g = await correr(MASTER, { contagens: { pessoas: 4, erros: 120 } });
    assert.equal(aceso(g.barra()), 'pedidos');
    assert.match(g.barra(), /data-arg="pedidos">[\s\S]*?<span class="nb n">4<span class="so-leitor"> por tratar<\/span><\/span><\/button>/);
    assert.match(g.barra(), /data-arg="erros">[\s\S]*?<span class="nb n erro">99\+/);
    g.ctx.ir('pessoas'); await assentar();
    assert.equal(aceso(g.barra()), 'pessoas');
  });

  test('o CSS: 76px mais a área segura, só abaixo dos 900px, escondida com a gaveta, e nada por baixo dela', () => {
    assert.match(CSS_EQUIPA, /:root\{[^}]*--eq-barra:0px/, 'acima dos 900px a barra não ocupa nada');
    const tel = CSS_EQUIPA.slice(CSS_EQUIPA.indexOf('@media(max-width:899px){\n  :root{--eq-barra'));
    assert.match(tel, /^@media\(max-width:899px\)\{\n {2}:root\{--eq-barra:calc\(76px \+ env\(safe-area-inset-bottom\)\)\}/);
    assert.match(tel, /\.eq-barra\{display:grid\}/);
    assert.match(tel, /body\.eq-gaveta \.eq-barra\{display:none\}/);
    assert.match(tel, /\.eq-main\{padding:18px 16px calc\(40px \+ var\(--eq-barra\)\)\}/, 'o miolo acaba acima da barra');
    assert.match(CSS_EQUIPA, /padding:9px calc\(8px \+ env\(safe-area-inset-right\)\) calc\(14px \+ env\(safe-area-inset-bottom\)\)/, '9 em cima, 14 em baixo');
    assert.match(CSS_EQUIPA, /\.eq-dest\{[^}]*min-height:52px/, 'destinos de 52');
    assert.match(CSS_EQUIPA, /\.eq-dest\[aria-current="page"\],\.eq-dest:active\{color:var\(--accent\)\}/, 'o aceso só muda a cor da frente');
    assert.match(CSS_EQUIPA, /@media\(max-width:899px\)\{\.eq-toast\{bottom:calc\(var\(--eq-barra\) \+ 12px\)\}\}/, 'o aviso acima da barra');
    assert.match(CSS_QA_EQUIPA, /\.qa-aviso\{bottom:max\(calc\(22px \+ var\(--inset-bottom\)\),calc\(var\(--eq-barra,0px\) \+ 12px\)\)\}/, 'e o aviso do QA também');
  });
});

describe('a gaveta do telemóvel', () => {
  test('o ☰ abre-a: o foco entra, o de trás fica inerte e preso; o Escape fecha e devolve o foco ao ☰', async () => {
    const g = await correr(MASTER, { telemovel: true });
    g.ctx.ACOES.abrirGaveta({});
    assert.ok(g.els.body.classList.contains('eq-gaveta'));
    assert.ok(g.els.html.classList.contains('eq-trava'), 'a página de trás não rola');
    assert.equal(g.els.burger.getAttribute('aria-expanded'), 'true');
    assert.equal(g.foco.em, 'primeiro-da-gaveta');
    for (const id of ['topo', 'principal', 'tabbar']) assert.equal(g.els[id].inert, true, id + ' fora do Tab');
    g.fogo('keydown', { key: 'Enter', target: null });
    assert.ok(g.els.body.classList.contains('eq-gaveta'), 'o Enter não a fecha');
    g.fogo('keydown', { key: 'Escape' });
    assert.ok(!g.els.body.classList.contains('eq-gaveta'));
    assert.ok(!g.els.html.classList.contains('eq-trava'));
    assert.equal(g.els.burger.getAttribute('aria-expanded'), 'false');
    assert.equal(g.foco.em, 'burger', 'o foco volta ao ☰');
    for (const id of ['topo', 'principal', 'tabbar']) assert.equal(g.els[id].inert, false);
  });

  test('o véu e o fecho fecham-na; escolher um destino fecha-a e vai lá', async () => {
    const g = await correr(MASTER, { telemovel: true });
    g.ctx.ACOES.abrirGaveta({});
    g.ctx.ACOES.fecharGaveta({});
    assert.ok(!g.els.body.classList.contains('eq-gaveta'));
    g.ctx.ACOES.abrirGaveta({});
    g.ctx.ACOES.ir({ arg: 'erros' }); await assentar();
    assert.ok(!g.els.body.classList.contains('eq-gaveta'));
    assert.equal(g.ctx.seccao, 'erros');
  });

  test('acima dos 900px não há gaveta para abrir, e passar os 900px com ela aberta fecha-a', async () => {
    const g = await correr(MASTER);
    g.ctx.ACOES.abrirGaveta({});
    assert.ok(!g.els.body.classList.contains('eq-gaveta'), 'a barra é uma coluna: o ☰ não prende a página');
    const t = await correr(MASTER, { telemovel: true });
    t.ctx.ACOES.abrirGaveta({});
    t.janela.largura({ matches: true });
    assert.ok(!t.els.body.classList.contains('eq-gaveta'));
    assert.ok(!t.els.html.classList.contains('eq-trava'));
  });

  test('o CSS: 328px por cima de um véu, a entrar da esquerda, fora do Tab quando fechada', () => {
    const tel = CSS_EQUIPA.slice(CSS_EQUIPA.indexOf('@media(max-width:899px){\n  :root{--eq-barra'));
    assert.match(tel, /\.eq-lado\{position:fixed;[^}]*width:min\(328px,88vw\);[^}]*transform:translateX\(-100%\);visibility:hidden;/);
    assert.match(tel, /body\.eq-gaveta \.eq-lado\{transform:none;visibility:visible;/);
    assert.match(tel, /\.eq-veu\{display:block;position:fixed;inset:0;z-index:61;background:var\(--veu\)/);
    assert.match(tel, /html\.eq-trava\{overflow:hidden\}/);
    assert.match(tel, /\.eq-burger,\.eq-fecha\{display:inline-flex\}/);
    assert.match(CSS_EQUIPA, /\.eq-burger,\.eq-fecha\{[^}]*width:44px;height:44px/, 'o ☰ e o fecho com 44px');
    assert.doesNotMatch(CSS_EQUIPA, /eq-itens|overflow-x:auto;gap:4px;margin:0 -16px/, 'saiu a fila de separadores que rolava de lado');
    assert.doesNotMatch(GUIAO, /mostrarSeparador/);
  });
});

describe('o endereço', () => {
  test('ir acerta o endereço sem criar entradas; recarregar volta ao sítio', async () => {
    const g = await correr(MASTER);
    assert.equal(g.location.hash, '#pedidos', 'a primeira secção fica no endereço');
    g.ctx.ir('rasto', 'U1'); await assentar();
    assert.equal(g.location.hash, '#rasto/U1', 'o rasto com o alvo');
    g.ctx.ir('erros'); await assentar();
    assert.equal(g.location.hash, '#erros');
    const r = await correr(MASTER, { hash: '#erros' });
    assert.equal(r.ctx.seccao, 'erros');
    const p = await correr(MASTER, { hash: '#pessoas/U%201' });
    assert.equal(p.ctx.seccao, 'pessoas');
    assert.ok(p.rotas.includes('/api/equipa/pessoas/U%201'), 'a ficha do endereço');
  });

  test('uma secção que o papel não abre cai na primeira que abre, e o kanban sem DADOS.kanban também', async () => {
    const s = await correr(SUPORTE, { hash: '#operacao' });
    assert.equal(s.ctx.seccao, 'pedidos');
    assert.equal(s.location.hash, '#pedidos');
    const k = await correr(MASTER, { hash: '#kanban/KAN-77' });
    assert.equal(k.ctx.seccao, 'pedidos', 'na produção não há kanban');
    assert.equal(k.location.hash, '#pedidos');
  });

  test('o hashchange abre o que o endereço diz; o que o guião escreveu não reabre nada', async () => {
    const g = await correr(MASTER);
    g.location.hash = '#pessoas';
    g.janela.hashchange(); await assentar();
    assert.equal(g.ctx.seccao, 'pessoas');
    const antes = g.rotas.length;
    g.ctx.marcarEndereco('pessoas', 'U9');
    g.janela.hashchange(); await assentar();
    assert.equal(g.rotas.length, antes, 'nada se pediu');
    assert.equal(g.location.hash, '#pessoas/U9');
  });

  test('um pedido aberto fica no endereço, e voltar à lista tira-o', async () => {
    const g = await correr(MASTER);
    g.ctx.verPedido('pessoas0'); await assentar();
    // o detalhe vem vazio da rota de faz-de-conta: o que conta é o endereço não rebentar
    g.ctx.verLista('pessoas', 'abertos'); await assentar();
    assert.equal(g.location.hash, '#pedidos');
    const r = await correr(MASTER, { hash: '#pedidos/pessoas1' });
    assert.ok(r.rotas.indexOf('/api/equipa/pedidos?tipo=pessoas&estado=abertos') < r.rotas.indexOf('/api/equipa/pedidos/pessoas1'),
      'a lista primeiro, e o pedido do endereço por cima dela');
  });
});

describe('o encaixe do kanban', () => {
  test('a página só leva o kanban.css, o kanban.js e kanban: true com o ENV_NAME, pela ordem do contrato', async () => {
    const dev = await new Response(paginaEquipa(MASTER, { qa: 'percurso' }).body).text();
    assert.match(dev, /<link rel="stylesheet" href="\/equipa\/estilos\.css">\n<link rel="stylesheet" href="\/equipa\/kanban\.css">\n<link rel="stylesheet" href="\/equipa\/qa\.css">/);
    const i = (s) => dev.indexOf(s);
    assert.ok(i('<script src="/equipa/guiao.js"></script>') < i('<script src="/equipa/kanban.js"></script>'), 'o kanban.js depois do guião');
    assert.ok(i('<script src="/equipa/kanban.js"></script>') < i('<script src="/equipa/qa.js"></script>'), 'e antes do qa.js');
    assert.equal(JSON.parse(/id="dados-equipa">([\s\S]*?)<\/script>/.exec(dev)[1]).kanban, true);
    for (const opcoes of [undefined, {}, { qa: '' }]) {
      const prod = await new Response(paginaEquipa(MASTER, opcoes).body).text();
      assert.doesNotMatch(prod, /kanban\.(css|js)/, 'na produção nada do kanban');
      assert.equal(JSON.parse(/id="dados-equipa">([\s\S]*?)<\/script>/.exec(prod)[1]).kanban, false);
    }
  });

  test('o guião chama o verKanban e o novoCartao sempre com typeof, e só com DADOS.kanban', () => {
    assert.match(GUIAO, /if \(typeof verKanban === 'function'\) \{ verKanban\(resto \|\| ''\); return; \}/);
    assert.match(GUIAO, /if \(!DADOS\.kanban\) return;\n {4}if \(typeof novoCartao === 'function'\) novoCartao\(\);/);
    assert.match(GUIAO, /\{ id: 'kanban', nome: 'Kanban', icone: 'kanban', se: !!DADOS\.kanban \}/, 'a secção kanban, à cabeça de SECCOES');
    assert.ok(GUIAO.indexOf("{ id: 'kanban'") < GUIAO.indexOf("{ id: 'pedidos'"));
    assert.match(GUIAO, /\n {2}kanban: '<rect [^']*\/><rect [^']*\/><rect [^']*\/>'/, 'o ícone: três colunas');
    assert.match(GUIAO, /\nfunction marcarEndereco\(seccao, resto\) \{/, 'o marcarEndereco é uma function (fica em window)');
  });

  test('o arranque espera pelo DOMContentLoaded: o verKanban do kanban.js, que carrega depois, já abre a primeira secção', async () => {
    const g = await correr(MASTER, { qa: 'percurso', aCarregar: true, hash: '#kanban/KAN-77' });
    assert.equal(g.nav(), '', 'antes do evento não se pintou nada');
    assert.equal((g.ouvintes.DOMContentLoaded || []).length, 1);
    const abertos = [];
    // o que o /equipa/kanban.js faz ao correr: define o verKanban como function de topo
    vm.runInContext('function verKanban(resto) { abertosDoKanban.push(resto); }', Object.assign(g.ctx, { abertosDoKanban: abertos }));
    g.fogo('DOMContentLoaded'); await assentar();
    assert.deepEqual(abertos.slice(), ['KAN-77'], 'o cartão do endereço');
    assert.equal(aceso(g.nav()), 'kanban');
    assert.equal(g.location.hash, '#kanban/KAN-77');
  });

  test('sem o kanban.js, o Kanban diz que o quadro não carregou, com o Recarregar', async () => {
    const g = await correr(DEV, { qa: 'percurso' });
    assert.equal(g.ctx.seccao, 'kanban');
    assert.match(g.els.conteudo.innerHTML, /O quadro não carregou\.[\s\S]*data-acao="recarregar"/);
  });
});

/* O CSS sem os blocos @media(hover:hover) and (pointer:fine), com as chavetas contadas.
   Recebe: css — o texto.
   Devolve: o texto sem esses blocos. */
function semBlocosDoRato(css) {
  const abre = '@media(hover:hover) and (pointer:fine){';
  let s = css, i;
  while ((i = s.indexOf(abre)) > -1) {
    let fundo = 1, j = i + abre.length;
    for (; j < s.length && fundo > 0; j++) fundo += s[j] === '{' ? 1 : s[j] === '}' ? -1 : 0;
    s = s.slice(0, i) + s.slice(j);
  }
  return s;
}

describe('o :hover só onde há rato', () => {
  test('nenhum :hover do CSS_EQUIPA nem do CSS_QA_EQUIPA fica fora do @media(hover:hover) and (pointer:fine)', () => {
    assert.ok(semBlocosDoRato(CSS_EQUIPA).length < CSS_EQUIPA.length, 'controlo: há blocos do rato');
    assert.doesNotMatch(semBlocosDoRato(CSS_EQUIPA).replace(/\/\*[\s\S]*?\*\//g, ''), /:hover/, 'CSS_EQUIPA');
    assert.doesNotMatch(semBlocosDoRato(CSS_QA_EQUIPA).replace(/\/\*[\s\S]*?\*\//g, ''), /:hover/, 'CSS_QA_EQUIPA');
  });

  test('o que se pinta na navegação não leva style= nem on…=', async () => {
    const g = await correr(MASTER, { qa: 'percurso' });
    for (const h of [g.nav(), g.barra()]) {
      assert.doesNotMatch(h, /\sstyle=/);
      assert.doesNotMatch(h, /\son[a-z]+=/);
    }
  });
});
