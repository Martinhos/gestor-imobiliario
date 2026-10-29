// O rasto na montra: a pergunta, o script e a Política de Privacidade.
//
// A montra pergunta uma vez, numa faixa em HTML puro (um formulário para o
// /consentimento, com «Recusar» e «Aceitar» do mesmo peso), e só a quem ainda
// não respondeu. Quem recusou não recebe script nenhum; quem aceitou recebe o
// /paginas/rasto-montra.js, que manda onde se toca e o que se abre, nunca o
// texto da página. A página varia com essa resposta e por isso não pode ser
// servida de uma cache a quem respondeu outra coisa. E a Privacidade diz tudo
// isto, com a versão dos documentos a subir junta nos dois lados.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { paginaLanding, CSS_LANDING, GUIAO_RASTO_MONTRA } from '../worker/src/landing.js';
import { CAMINHOS_DOS_RECURSOS, recursoDePagina } from '../worker/src/paginas-recursos.js';
import { TERMS_VERSION } from '../worker/src/lib/http.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ler = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8');

/* A página de uma resposta, já em texto.
   Recebe: escolha — 'sim', 'nao', null ou outro valor; raiz (opcional) —
   falso para a pré-visualização.
   Devolve: promessa do HTML. */
const pagina = (escolha, raiz = true) => paginaLanding({ raiz, escolha }).text();

// as etiquetas de abertura de um HTML, como o browser as lê
const etiquetas = (html) => html.match(/<[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>/g) || [];
// a faixa da pergunta, ou null
const faixa = (html) => (/<aside class="wrap escolha"[\s\S]*?<\/aside>/.exec(html) || [null])[0];

const TIPOS = ['toque', 'ecra', 'janela-abre', 'janela-fecha', 'guardar', 'erro-campo', 'erro', 'pagina', 'secao'];
const CAMPOS = ['t', 'tipo', 'ecra', 'janela', 'alvo', 'x', 'y', 'vw', 'vh', 'sinal'];

/* Corre o script do rasto num browser de mentira: um documento com duas
   secções, um sendBeacon que guarda o que recebe, um IntersectionObserver que
   o teste dispara à mão e um setInterval que só regista.
   Recebe: op (opcional) — {semIO: true} para um motor sem IntersectionObserver.
   Devolve: as peças para o teste mexer e ver. */
function correrGuiao(op = {}) {
  const ouvintes = { doc: {}, win: {} };
  const enviados = [];
  const intervalos = [];
  const observados = [];
  const largados = [];
  let aoVer = null;
  let opcoesIO = null;
  /* Um elemento de mentira.
     Recebe: tag; o (opcional) — {id, pai, attrs, interativo, texto}.
     Devolve: o elemento. */
  const el = (tag, o = {}) => ({
    nodeType: 1, tagName: tag.toUpperCase(), id: o.id || '', parentNode: o.pai || null,
    textContent: o.texto || '', interativo: !!o.interativo, attrs: o.attrs || {},
    getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; },
    matches() { return this.interativo; },
  });
  const secoes = [el('section', { id: 'inicio' }), el('section', { id: 'ligado' })];
  const documento = {
    visibilityState: 'visible',
    documentElement: { clientWidth: 390, clientHeight: 844 },
    addEventListener(t, f) { (ouvintes.doc[t] = ouvintes.doc[t] || []).push(f); },
    querySelectorAll(sel) { return sel === 'main section[id]' ? secoes : []; },
  };
  // o IntersectionObserver de mentira, que o teste dispara com ver()
  class Observador {
    constructor(cb, opcoes) { aoVer = cb; opcoesIO = opcoes; }
    observe(e) { observados.push(e); }
    unobserve(e) { largados.push(e); }
  }
  const janela = {
    navigator: { sendBeacon(url, corpo) { enviados.push({ url, corpo: String(corpo), lote: JSON.parse(corpo) }); return true; } },
    innerWidth: 390, innerHeight: 844, location: { pathname: '/', hostname: 'rendorium.com' }, crypto: webcrypto,
    IntersectionObserver: op.semIO ? undefined : Observador,
    addEventListener(t, f) { (ouvintes.win[t] = ouvintes.win[t] || []).push(f); },
    setInterval(f, ms) { intervalos.push({ f, ms }); },
  };
  new Function('window', 'document', GUIAO_RASTO_MONTRA)(janela, documento);
  const corre = (lista, ev) => (lista || []).forEach((f) => f(ev));
  return {
    el, secoes, enviados, intervalos, observados, largados, ouvintes,
    opcoesIO: () => opcoesIO,
    ver: (alvos) => aoVer(alvos.map((target) => ({ target, isIntersecting: true }))),
    tocar: (target, x, y, detail = 1) => corre(ouvintes.doc.click, { target, clientX: x, clientY: y, detail }),
    esconder: () => { documento.visibilityState = 'hidden'; corre(ouvintes.doc.visibilitychange); },
    sair: () => corre(ouvintes.win.pagehide),
    eventos: () => enviados.flatMap((e) => e.lote.eventos),
  };
}

describe('a pergunta do rasto na montra', () => {
  test('a faixa só aparece a quem ainda não respondeu, com dois botões para o /consentimento', async () => {
    const html = await pagina(null);
    const f = faixa(html);
    assert.ok(f, 'a faixa existe sem resposta');
    assert.match(f, /<form class="escolha-caixa" method="post" action="\/consentimento">/, 'um formulário sem JavaScript');
    assert.match(f, /<input type="hidden" name="volta" value="\/">/, 'que volta à página');
    const botoes = etiquetas(f).filter((t) => t.startsWith('<button'));
    assert.deepEqual(botoes, [
      '<button class="escolha-botao" type="submit" name="escolha" value="nao">',
      '<button class="escolha-botao" type="submit" name="escolha" value="sim">',
    ], 'recusar e aceitar com o mesmo peso: a mesma classe, o mesmo tipo');
    assert.match(f, />Recusar<\/button>[\s\S]*>Aceitar<\/button>/, 'com os textos da app');
    assert.match(f, /Nunca o que escreves/, 'diz o que nunca se regista');
    assert.match(f, /90 dias/, 'e quanto tempo fica');
    assert.match(f, /<a href="\/privacidade#rasto-de-utilizacao">/, 'e leva à Privacidade');
    assert.ok(!/style=|\son[a-z]+=/.test(f), 'nada que a CSP_ESTRITA recuse');
    for (const e of ['sim', 'nao']) assert.equal(faixa(await pagina(e)), null, 'sem faixa com ' + e);
    assert.ok(faixa(await pagina('talvez')), 'um valor que não é resposta vale como nenhuma');
    assert.match(faixa(await pagina(null, false)), /name="volta" value="\/montra"/, 'a pré-visualização volta ao /montra');
  });

  /* Sem JS, nada pode ficar fixo por cima da dobra: no telemóvel tapava o
     hero e a ação principal. A faixa vai no fluxo, a seguir ao hero. */
  test('a faixa vai no fluxo, a seguir ao hero, e não tapa nada', async () => {
    const html = await pagina(null);
    const hero = html.indexOf('id="inicio"');
    const aqui = html.indexOf('<aside class="wrap escolha"');
    assert.ok(hero > 0 && aqui > hero, 'depois do hero');
    assert.ok(aqui < html.indexOf('id="ligado"'), 'e antes do resto');
    const regras = CSS_LANDING.match(/\.escolha[\w-]*(?::[\w-]+)?\{[^}]*\}/g) || [];
    assert.ok(regras.length >= 4, 'as regras da faixa existem');
    regras.forEach((r) => assert.ok(!/position:(?:fixed|sticky)|opacity:0/.test(r), 'nada fixo nem escondido: ' + r));
    assert.match(CSS_LANDING, /\.escolha-botao\{[^}]*min-height:44px/, 'botões de 44 px, o alvo do dedo');
    assert.match(CSS_LANDING, /\.escolha-texto a\{[^}]*min-height:44px/, 'e a ligação também');
    const semPortao = CSS_LANDING.replace(/@media\(hover:hover\) and \(pointer:fine\)\{[\s\S]*?\n\}/g, '');
    assert.ok(!/\.escolha-botao:hover|\.rodape a:hover/.test(semPortao), 'o :hover dos botões e do rodapé só com rato');
    assert.match(CSS_LANDING, /@media\(hover:hover\) and \(pointer:fine\)\{[^@]*\.escolha-botao:hover\{/, 'e lá dentro');
    assert.match(CSS_LANDING, /\.escolha-botao:active\{transform:scale\(\.97\)\}/, 'o premido da app');
  });

  /* Quem já respondeu tem de poder mudar: sem conta, a montra é o único
     sítio onde o fazer. Uma linha no rodapé, com um botão só. */
  test('depois de responder, o rodapé deixa mudar a resposta', async () => {
    const rodape = (h) => /<footer[\s\S]*<\/footer>/.exec(h)[0];
    const sim = rodape(await pagina('sim'));
    assert.match(sim, /action="\/consentimento"[\s\S]*value="nao">Recusar<\/button>/, 'quem aceitou pode recusar');
    const nao = rodape(await pagina('nao'));
    assert.match(nao, /action="\/consentimento"[\s\S]*value="sim">Aceitar<\/button>/, 'quem recusou pode aceitar');
    assert.ok(!/consentimento/.test(rodape(await pagina(null))), 'sem resposta, é a faixa que pergunta');
  });
});

describe('o script do rasto na montra', () => {
  test('só vai na página de quem aceitou, e é servido pelo worker', async () => {
    for (const e of [null, 'nao', 'talvez']) {
      assert.ok(!/<script/i.test(await pagina(e)), 'nenhum script com ' + e);
    }
    const scripts = etiquetas(await pagina('sim')).filter((t) => /^<script\b/i.test(t));
    assert.deepEqual(scripts, ['<script src="/paginas/rasto-montra.js" defer>'], 'com sim, o do rasto e mais nenhum');
    assert.ok(CAMINHOS_DOS_RECURSOS.includes('/paginas/rasto-montra.js'), 'um recurso das páginas');
    const r = await recursoDePagina('/paginas/rasto-montra.js', 'GET', async () => false);
    assert.equal(r.status, 200, 'sem sessão nenhuma: é de uma página pública');
    assert.equal(r.headers.get('Content-Type'), 'text/javascript; charset=utf-8');
    assert.equal(await r.text(), GUIAO_RASTO_MONTRA);
  });

  test('não ouve o scroll, não lê o texto da página e não deixa nomes globais', () => {
    const js = GUIAO_RASTO_MONTRA;
    assert.doesNotThrow(() => new Function(js), 'compila');
    assert.ok(!/addEventListener\(\s*['"]scroll/.test(js), 'nada de addEventListener(scroll)');
    assert.ok(!/textContent|innerText|innerHTML|outerHTML|\.value\b|selection/i.test(js), 'nunca lê o que a página diz nem o que se escreve');
    assert.ok(!/\son[a-z]+\s*=|\sstyle\s*=/i.test(js), 'nem escreve nada que a CSP recuse');
    assert.match(js, /^\(function \(\) \{\n  'use strict';/, 'um IIFE estrito');
    assert.match(js, /\}\)\(\);\n$/, 'fechado sobre si');
    assert.ok(!/\b(?:let|const|class)\s|=>/.test(js), 'ES5 simples');
    assert.deepEqual([...new Set(js.match(/'\/[a-z-]*'/g))].sort(), ["'/'", "'/rasto'"], 'só fala com o /rasto');
  });

  test('ao carregar conta a página, vigia as secções e envia a cada 15 s', () => {
    const g = correrGuiao();
    assert.deepEqual(g.intervalos.map((i) => i.ms), [15000], 'um envio a cada 15 s');
    assert.deepEqual(g.observados.map((s) => s.id), ['inicio', 'ligado'], 'cada secção com id');
    assert.ok(g.opcoesIO() && /-25%/.test(g.opcoesIO().rootMargin), 'conta quando entra mesmo à vista');
    assert.ok(g.ouvintes.win.pagehide && g.ouvintes.doc.visibilitychange, 'envia ao sair e ao esconder');
    assert.ok(!g.ouvintes.win.scroll && !g.ouvintes.doc.scroll, 'sem ouvir o scroll');
    g.ver([g.secoes[0]]);
    g.ver([g.secoes[0], g.secoes[1]]);
    g.sair();
    const ev = g.eventos();
    assert.deepEqual(ev.map((e) => [e.tipo, e.ecra]), [['pagina', '/'], ['secao', '#inicio'], ['secao', '#ligado']],
      'a página, e cada secção uma vez');
    assert.deepEqual(g.largados.map((s) => s.id), ['inicio', 'inicio', 'ligado'], 'e deixa de a vigiar');
  });

  test('um toque leva o descritor e a posição, nunca o texto', () => {
    const g = correrGuiao();
    const mapa = g.el('div', { id: 'mapa' });
    const morto = g.el('p', { attrs: { class: 'm-sub outra' }, texto: 'Segredo do inquilino', pai: mapa });
    const ligacao = g.el('a', { interativo: true, attrs: { href: 'https://app.rendorium.com/?criar=1#registo', class: 'btn primary' } });
    const dentro = g.el('span', { pai: ligacao, texto: 'Criar conta grátis' });
    const acao = g.el('button', { interativo: true, attrs: { 'data-click': 'abrirCasa' }, texto: 'Abrir' });
    const registo = g.el('li', { id: 'linha-4821', texto: 'Ana Ribeiro' });
    g.tocar(morto, 195, 422);
    g.tocar(dentro, 100, 300);
    g.tocar(acao, 300, 600);
    g.tocar(registo, 10, 10);
    g.tocar(acao, 0, 0, 0);
    g.sair();
    const toques = g.eventos().filter((e) => e.tipo === 'toque');
    assert.deepEqual(toques.map((e) => [e.alvo, e.sinal]), [
      ['p.m-sub', 'em-vao'], ['a:app.rendorium.com/?criar', null], ['click:abrirCasa', null], ['li#linha', 'em-vao'], ['click:abrirCasa', null],
    ], 'o que é, sem o que diz; a ligação sem valores; o id de um registo cortado');
    assert.deepEqual([toques[0].x, toques[0].y, toques[0].vw, toques[0].vh, toques[0].ecra], [500, 500, 390, 844, '/'],
      'a posição em permilagem da janela');
    assert.deepEqual([toques[4].x, toques[4].y], [null, null], 'um clique de teclado não tem posição');
    const tudo = g.enviados.map((e) => e.corpo).join('');
    for (const t of ['Segredo', 'inquilino', 'Criar conta', 'Abrir', 'Ana', '4821', 'criar=1', 'registo']) {
      assert.ok(!tudo.includes(t), '«' + t + '» não sai da página');
    }
  });

  /* O destino de uma ligação diz para onde vai sem levar nenhum valor: o host
     só quando é de fora, o caminho e as chaves da pesquisa. */
  test('uma ligação leva o host de fora, o caminho e as chaves da pesquisa, nunca os valores', () => {
    const casos = [
      ['https://app.rendorium.com/?criar=1#registo', 'a:app.rendorium.com/?criar'],
      ['https://app.rendorium.com', 'a:app.rendorium.com/'],
      ['/privacidade', 'a:/privacidade'],
      ['/privacidade#rasto-de-utilizacao', 'a:/privacidade'],
      ['https://rendorium.com/termos?ver=2&doc=7&ver=3', 'a:/termos?ver&doc'],
      ['//Rendorium.com:443/x?segredo', 'a:/x?segredo'],
      ['https://joao:pw@exemplo.pt/conta?token=abc123&id=99', 'a:exemplo.pt/conta?token&id'],
      ['mailto:general@rendorium.com?subject=Ola', 'a:mailto:'],
      ['tel:+351912345678', 'a:tel:'],
      ['#imoveis', 'a:/'],
      ['?pagina=3', 'a:/?pagina'],
    ];
    for (const [href, esperado] of casos) {
      const g = correrGuiao();
      g.tocar(g.el('a', { interativo: true, attrs: { href } }), 10, 10);
      g.sair();
      const toque = g.eventos().find((e) => e.tipo === 'toque');
      assert.equal(toque.alvo, esperado, href);
      for (const valor of ['=', 'abc123', '99', 'joao', 'pw', 'general', '351', 'Ola', 'registo', 'rasto-de']) {
        assert.ok(!toque.alvo.includes(valor), href + ': «' + valor + '» não sai');
      }
    }
  });

  test('o terceiro toque no mesmo sítio em menos de um segundo é repetido', () => {
    const g = correrGuiao();
    const botao = g.el('button', { interativo: true, attrs: { class: 'escolha-botao' } });
    const agora = Date.now;
    let relogio = 1e12;
    Date.now = () => relogio;
    try {
      g.tocar(botao, 100, 100);
      relogio += 300; g.tocar(botao, 110, 105);
      relogio += 300; g.tocar(botao, 120, 110);
      relogio += 300; g.tocar(botao, 125, 112);
      relogio += 300; g.tocar(botao, 300, 300);   // longe: a série acaba
      relogio += 300; g.tocar(botao, 300, 300);
      relogio += 1500; g.tocar(botao, 300, 300);  // tarde: também
    } finally {
      Date.now = agora;
    }
    g.sair();
    assert.deepEqual(g.eventos().filter((e) => e.tipo === 'toque').map((e) => e.sinal),
      [null, null, 'repetido', 'repetido', null, null, null]);
  });

  test('envia em lotes de até 50, com a sessão e só os campos do contrato', () => {
    const g = correrGuiao();
    const sitio = g.el('div', { attrs: { class: 'fecho' } });
    for (let i = 0; i < 120; i++) g.tocar(sitio, i * 3, 10);
    g.esconder();
    assert.deepEqual(g.enviados.map((e) => e.lote.eventos.length), [50, 50, 21], 'a página e os 120 toques, em lotes');
    g.enviados.forEach((e) => {
      assert.equal(e.url, '/rasto');
      assert.deepEqual(Object.keys(e.lote), ['sessao', 'eventos']);
      assert.match(e.lote.sessao, /^s-[a-z0-9]{10}$/);
      e.lote.eventos.forEach((ev) => {
        assert.deepEqual(Object.keys(ev), CAMPOS, 'os campos do contrato, por esta ordem');
        assert.ok(TIPOS.includes(ev.tipo), ev.tipo);
        assert.ok(ev.alvo === null || ev.alvo.length <= 80);
        assert.ok(ev.ecra.length <= 40);
      });
    });
    assert.equal(new Set(g.enviados.map((e) => e.lote.sessao)).size, 1, 'uma sessão por carregamento');
    g.sair();
    assert.equal(g.enviados.length, 3, 'com a fila vazia não se envia nada');
    g.intervalos[0].f();
    assert.equal(g.enviados.length, 3, 'nem a cada 15 s');
  });

  test('um motor sem IntersectionObserver conta a página e os toques à mesma', () => {
    const g = correrGuiao({ semIO: true });
    g.tocar(g.el('main'), 1, 1);
    g.sair();
    assert.deepEqual(g.eventos().map((e) => e.tipo), ['pagina', 'toque']);
  });
});

describe('a cache de uma página que varia com o cookie', () => {
  test('nenhuma resposta vai para uma cache partilhada, e o browser revalida a sua', () => {
    for (const e of [null, 'nao', 'sim']) {
      const r = paginaLanding({ raiz: true, escolha: e });
      const cc = r.headers.get('Cache-Control');
      assert.ok(/\bprivate\b/.test(cc) && /\bno-cache\b/.test(cc), e + ': ' + cc);
      assert.ok(!/public|max-age=[1-9]/.test(cc), e + ': nada partilhado nem fresco sem perguntar');
      assert.equal(r.headers.get('Vary'), 'Cookie', e + ': varia com o cookie');
    }
    assert.equal(paginaLanding({ escolha: 'sim' }).headers.get('Cache-Control'), 'no-store', 'a pré-visualização nem isso');
  });
});

describe('a Política de Privacidade do rasto', () => {
  const legal = ler('web/legal.js');
  const janela = {};
  new Function('window', legal)(janela);
  const L = janela.LEGAL;
  const texto = L.privacidade.replace(/<[^>]+>/g, '');

  test('diz o que se recolhe, para quê, com que base, quem vê, quanto tempo e como retirar', () => {
    assert.match(L.privacidade, /<h3 class="lg-h" id="rasto-de-utilizacao">12\. Rasto de utilização/, 'uma secção própria, para onde a faixa aponta');
    for (const t of ['onde tocas', 'o que abres', 'o tamanho da janela', 'Nunca registamos o que escreves',
      'dados da tua conta', 'difícil de usar', 'consentimento', 'identificador', 'sem nome', '90 dias',
      'back office', 'Definições', 'Recusar', 'Apagar a conta apaga o rasto']) {
      assert.ok(texto.includes(t), 'diz «' + t + '»');
    }
  });

  test('recusar apaga logo, a resposta mais recente vale, as cópias não o levam, e ninguém é avaliado', () => {
    assert.match(texto, /Recusar depois de aceitar deixa de registar e apaga logo o que já se registou deste aparelho e, se tiveres sessão iniciada, da tua conta/);
    assert.match(texto, /Vale a resposta mais recente[^.]*para a conta e para o aparelho/);
    assert.ok(!/só (?:muda|vale para) (?:este|o) aparelho|para este aparelho; na app/.test(texto), 'a recusa na montra já não fica só no aparelho');
    assert.match(texto, /As cópias de segurança diárias não levam o rasto/);
    assert.match(texto, /não é usado para decisões automáticas nem para te avaliar: serve só para perceber onde a interface confunde/);
    assert.ok(!/definição de perfis/.test(texto), 'a afirmação antiga saiu');
  });

  test('os cookies novos estão listados, e a promessa contrária saiu', () => {
    assert.ok(!/Não usamos cookies de análise/.test(texto), 'a frase antiga saiu');
    assert.match(texto, /rd_escolha[^.]*180 dias/, 'o rd_escolha, 180 dias');
    assert.match(texto, /rd_vis[^.]*só existe se aceitares[^.]*180 dias/, 'o rd_vis, só com sim, 180 dias');
  });

  test('os pontos seguem a ordem, sem números repetidos', () => {
    const n = [...L.privacidade.matchAll(/<h3[^>]*>(\d+)\./g)].map((m) => Number(m[1]));
    assert.deepEqual(n, n.map((_, i) => i + 1));
  });

  test('a versão dos documentos subiu junta nos dois lados', () => {
    assert.equal(L.version, '2026-10-29');
    assert.equal(TERMS_VERSION, L.version, 'a que o servidor compara');
    assert.match(texto, /Em vigor desde 29\/10\/2026/);
  });
});
