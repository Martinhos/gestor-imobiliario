// A nuvem saiu do cabeçalho (2026-10-29, decisão do Martinho): no lugar dela
// fica o «?» da Ajuda (index.html:#hdrAjuda), e do estado da sincronização só
// se vê a faixa sem ligação — vermelha, por cima do conteúdo e sem o empurrar,
// com o «N alterações por enviar» lá dentro. Prova o HTML do cabeçalho, a
// faixa que o setSyncBadge escreve em cada estado (cloud/entrada.js), a
// contagem (alteracoesPorEnviar) e o CSS da faixa e do brilho do «?».

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarTudo } from './arnes.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// metade da árvore é CRLF: lê-se já normalizado
const le = (p) => fs.readFileSync(path.join(AQUI, '..', p), 'utf8').replace(/\r\n/g, '\n');
const html = le('web/index.html');
// o CSS sem os comentários
const css = le('web/estilos.css').replace(/\/\*[\s\S]*?\*\//g, '');

/* As regras do CSS como [seletor, corpo], as de topo e as de dentro de um
   @media (o seletor fica sem o @media).
   Recebe: texto — o CSS sem comentários.
   Devolve: a lista de [seletor, corpo]. */
function regras(texto) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(texto))) out.push([m[1].trim().replace(/^@media[^{]*\{/, '').trim(), m[2]]);
  return out;
}
const todas = regras(css);
// os corpos das regras cujo seletor é exatamente s (de topo ou dentro de um @media)
const corpos = (s) => todas.filter(([sel]) => sel.split(',').map((x) => x.trim()).includes(s)).map((r) => r[1]);

/* Um #hdrSync de mentira que guarda o que o setSyncBadge lhe escreve:
   classes, atributos e o HTML; o firstElementChild é a faixa (quando há
   HTML), com as classes que lhe acrescentam. A app passa a achá-lo pelo id.
   Recebe: app.
   Devolve: o elemento. */
function faixaNoEcra(app) {
  const atr = {};
  const filho = { classes: [], classList: { add(c) { filho.classes.push(c); } } };
  const el = {
    className: '', innerHTML: '', title: '', atr, filho,
    get firstElementChild() { return el.innerHTML ? filho : null; },
    setAttribute(k, v) { atr[k] = String(v); },
    getAttribute(k) { return k in atr ? atr[k] : null; },
    removeAttribute(k) { delete atr[k]; },
  };
  const antes = app.document.getElementById;
  app.document.getElementById = (id) => (id === 'hdrSync' ? el : antes(id));
  return el;
}

/* A app com o setSyncBadge verdadeiro, o #hdrSync de mentira, a contagem da
   nuvem trocada pelo número dado e os temporizadores guardados (o da saída
   corre-se à mão).
   Recebe: porEnviar — o que a contagem (pendentesLocais) devolve.
   Devolve: {app, el, tempos} — tempos: [{f, ms}]. */
function comFaixa(porEnviar = 0) {
  const app = carregarTudo();
  const el = faixaNoEcra(app);
  app.pendentesLocais = () => ({ n: porEnviar, puts: {}, dels: {} });
  const tempos = [];
  app.setTimeout = (f, ms) => { tempos.push({ f, ms }); return tempos.length; };
  app.clearTimeout = () => {};
  return { app, el, tempos };
}

// o texto à vista da faixa, sem as etiquetas
const texto = (el) => el.innerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('o cabeçalho (index.html)', () => {
  const cab = html.slice(html.indexOf('<header class="top">'), html.indexOf('</header>'));

  test('o #hdrSync sai do header.top e vive logo a seguir a ele, vazio, como role=status', () => {
    assert.doesNotMatch(cab, /id="hdrSync"/, 'a nuvem já não está no cabeçalho');
    const depois = html.slice(html.indexOf('</header>'));
    const m = /<(\w+) id="hdrSync"([^>]*)><\/\1>/.exec(depois);
    assert.ok(m, 'o #hdrSync nasce vazio a seguir ao cabeçalho');
    assert.match(m[2], /role="status"/);
    assert.match(m[2], /aria-live="polite"/);
    assert.ok(depois.indexOf('id="hdrSync"') < depois.indexOf('id="view"'), 'antes do conteúdo, dentro do main');
    assert.ok(depois.indexOf('id="hdrSync"') < depois.indexOf('</main>'));
  });

  test('o #hdrAjuda no sítio da nuvem: dentro do cabeçalho, antes do sino, vazio, com o contrato', () => {
    const m = /<button ([^>]*id="hdrAjuda"[^>]*)><\/button>/.exec(cab);
    assert.ok(m, 'o «?» nasce vazio no cabeçalho (o :empty esconde-o)');
    assert.ok(cab.indexOf('id="hdrAjuda"') < cab.indexOf('id="hdrBell"'), 'antes do sino');
    assert.ok(cab.indexOf('id="pageTitle"') < cab.indexOf('id="hdrAjuda"'), 'depois do título');
    const a = m[1];
    assert.match(a, /type="button"/);
    assert.match(a, /class="btn filtbtn u-fx-0-0-auto ajuda-hdr"/);
    assert.match(a, /data-toca="ecra"/);
    assert.match(a, /data-click="abrirAjuda\(\)"/);
    assert.match(a, /aria-label="Ajuda"/);
    assert.match(a, /title="Ajuda"/);
    assert.doesNotMatch(a, /\sstyle=|\son[a-z]+=/, 'CSP: nem style= nem on…=');
  });
});

describe('a faixa (cloud/entrada.js:setSyncBadge)', () => {
  test('com a ligação de pé não se vê nada: «ok», «pend» e o «liga» da abertura deixam a faixa vazia', () => {
    const { app, el, tempos } = comFaixa(5);
    app.setSyncBadge('liga');
    assert.equal(el.innerHTML, '', 'o «A ligar» da abertura');
    app.setSyncBadge('ok');
    assert.equal(el.innerHTML, '', 'o «Guardado»');
    app.setSyncBadge('pend', 3);
    assert.equal(el.innerHTML, '', 'o «por enviar» com ligação');
    assert.equal(el.className, '');
    assert.equal(el.atr['aria-live'], 'polite');
    assert.deepEqual(tempos, [], 'nem recibos a recolher');
  });

  test('«off» escreve «Sem ligação ao servidor.», com «N alterações por enviar.» quando as há', () => {
    const { app, el } = comFaixa(3);
    app.setSyncBadge('off');
    assert.equal(el.className, 'fora');
    assert.equal(texto(el), 'Sem ligação ao servidor. 3 alterações por enviar.');
    assert.match(el.innerHTML, /^<div class="faixa-sync entra">/, 'a primeira entrada desliza');
    assert.ok(el.innerHTML.includes(app.ic('nuvemFora', 18)), 'a nuvem com a cruz');
    assert.equal(el.atr['aria-live'], 'polite', 'a falha diz-se');
    assert.equal(el.getAttribute('aria-label'), null, 'o leitor lê o texto da faixa');
  });

  test('uma alteração diz-se no singular; nenhuma, não se diz', () => {
    const um = comFaixa(1);
    um.app.setSyncBadge('off');
    assert.equal(texto(um.el), 'Sem ligação ao servidor. 1 alteração por enviar.');
    const zero = comFaixa(0);
    zero.app.setSyncBadge('off');
    assert.equal(texto(zero.el), 'Sem ligação ao servidor.');
    assert.doesNotMatch(zero.el.innerHTML, /por enviar/);
  });

  test('o n dado ganha à contagem; sem n, conta a nuvem (pendentesLocais); sem a nuvem, zero', () => {
    const a = comFaixa(7);
    a.app.setSyncBadge('off', 2);
    assert.match(texto(a.el), /2 alterações por enviar\.$/);
    const b = comFaixa(7);
    b.app.setSyncBadge('off');
    assert.match(texto(b.el), /7 alterações por enviar\.$/);
    const c = comFaixa(0);
    c.app.pendentesLocais = () => { throw new Error('sem estado'); };
    c.app.setSyncBadge('off');
    assert.equal(texto(c.el), 'Sem ligação ao servidor.');
  });

  test('a contagem conta o que difere do retrato do servidor (alteracoesPorEnviar, com o pendentesLocais verdadeiro)', () => {
    const app = carregarTudo();
    app.CW.user = { id: 'EU', name: 'Eu', email: 'eu@x.pt' };
    const antes = app.alteracoesPorEnviar();
    app.db.transactions.push(app.normTx({ id: 'TZ', label: 'x', amount: 1, kind: 'expense', date: '2026-02-01' }));
    assert.equal(app.alteracoesPorEnviar(), antes + 1, 'um movimento novo é mais uma por enviar');
  });

  test('a tentativa vinda de «off» fica com a faixa, laranja, «A tentar ligar ao servidor…», calada', () => {
    const { app, el } = comFaixa(2);
    app.setSyncBadge('off');
    app.setSyncBadge('liga');
    assert.equal(el.className, 'tenta');
    assert.equal(texto(el), 'A tentar ligar ao servidor… 2 alterações por enviar.', 'com a contagem da falha');
    assert.match(el.innerHTML, /^<div class="faixa-sync tenta">/, 'sem .entra: troca no sítio');
    assert.ok(el.innerHTML.includes(app.ic('nuvemLiga', 18)), 'a nuvem com o relógio');
    assert.equal(el.atr['aria-live'], 'off', 'a roda das tentativas não se anuncia');
    app.setSyncBadge('off');
    assert.equal(el.className, 'fora');
    assert.match(el.innerHTML, /^<div class="faixa-sync">/);
    assert.equal(el.atr['aria-live'], 'off', 'a mesma falha outra vez também não');
  });

  test('uma contagem nova depois da tentativa diz-se; a mesma faixa duas vezes não se refaz', () => {
    const { app, el } = comFaixa(2);
    app.setSyncBadge('off');
    app.setSyncBadge('liga');
    app.pendentesLocais = () => ({ n: 4 });
    app.setSyncBadge('off');
    assert.match(texto(el), /4 alterações por enviar\.$/);
    assert.equal(el.atr['aria-live'], 'polite', 'quatro em vez de duas é notícia');
    el.innerHTML = 'marca';
    app.setSyncBadge('off');
    assert.equal(el.innerHTML, 'marca', 'nem se repinta nem se anuncia outra vez');
  });

  test('a ligação volta: a faixa sai a desvanecer (.sai) e esvazia-se 200 ms depois', () => {
    const { app, el, tempos } = comFaixa(1);
    app.setSyncBadge('off');
    app.setSyncBadge('liga');
    app.setSyncBadge('ok');
    assert.deepEqual(el.filho.classes, ['sai']);
    assert.equal(el.className, '', 'já não é uma faixa à vista: um «liga» a seguir não é tentativa');
    assert.equal(el.atr['aria-live'], 'off', 'a saída não se anuncia');
    assert.equal(tempos.length, 1);
    assert.equal(tempos[0].ms, 200);
    tempos[0].f();
    assert.equal(el.innerHTML, '');
    assert.equal(el.atr['aria-live'], 'polite', 'e a próxima falha volta a dizer-se');
    app.setSyncBadge('off');
    assert.match(el.innerHTML, /^<div class="faixa-sync entra">/, 'a faixa seguinte volta a entrar');
  });

  test('sem estado (a sessão acabou), esvazia já', () => {
    const { app, el, tempos } = comFaixa(1);
    app.setSyncBadge('off');
    app.setSyncBadge('');
    assert.equal(el.innerHTML, '');
    assert.equal(el.className, '');
    assert.deepEqual(tempos, []);
  });
});

describe('o CSS da faixa e do «?» (estilos.css)', () => {
  test('a faixa é fixa (não empurra nada), por cima do conteúdo, e o #hdrSync vazio esconde-se', () => {
    const f = corpos('.faixa-sync');
    assert.ok(f.length, 'há regras da .faixa-sync');
    assert.ok(f.some((c) => /(^|;)position:fixed(;|$)/.test(c)), 'position:fixed');
    assert.ok(!f.some((c) => /(^|;)top:/.test(c)), 'sem top: fica na posição estática, por baixo do cabeçalho');
    assert.ok(f.some((c) => /z-index:\d+/.test(c)));
    assert.ok(corpos('#hdrSync:empty').some((c) => /display:none/.test(c)));
    assert.ok(corpos('#hdrSync').some((c) => /height:0/.test(c)), 'a caixa no fluxo não ocupa altura');
  });

  test('as cores da faixa são tokens: o vermelho cheio, o laranja na tentativa, e a borda na mesma cor', () => {
    const base = corpos('.faixa-sync').join(';');
    assert.match(base, /background:var\(--danger\)/);
    assert.match(base, /color:var\(--danger-ink\)/);
    assert.match(base, /border:1px solid var\(--danger\)/, 'a cor da frente diz o estado (Samsung forçado)');
    const tenta = corpos('.faixa-sync.tenta').join(';');
    assert.match(tenta, /background:var\(--out\)/);
    assert.match(tenta, /border-color:var\(--out\)/);
    todas.filter(([s]) => /faixa-sync|#hdrSync|#hdrAjuda/.test(s)).forEach(([s, c]) => {
      assert.doesNotMatch(c, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'só tokens em ' + s);
    });
  });

  test('no telemóvel a faixa fica a 16px de cada lado', () => {
    const tel = css.slice(css.search(/@media\(max-width:900px\)\{\.faixa-sync\{/));
    assert.match(tel, /^@media\(max-width:900px\)\{\.faixa-sync\{left:calc\(16px \+ var\(--inset-left\)\);right:calc\(16px \+ var\(--inset-right\)\)\}\}/);
  });

  test('a entrada e a saída da faixa: transform e opacidade, com os tokens de movimento', () => {
    assert.match(css, /@keyframes faixaEntra\{from\{opacity:0;transform:translateY\(-8px\)\}\}/);
    assert.match(css, /@keyframes faixaSai\{to\{opacity:0;transform:translateY\(-8px\)\}\}/);
    assert.ok(corpos('.faixa-sync.entra').some((c) => /animation:faixaEntra var\(--medio\) var\(--curva\)/.test(c)));
    assert.ok(corpos('.faixa-sync.sai').some((c) => /animation:faixaSai var\(--rapido\) var\(--curva\) both/.test(c)));
  });

  test('o brilho do «?» pulsa um número finito de vezes e, sem movimento, fica o anel parado', () => {
    const pulso = corpos('#hdrAjuda.brilha::before').join(';');
    const m = /animation:ajudaChama var\(--chama\) var\(--curva\) (\d+)/.exec(pulso);
    assert.ok(m, 'o pulso: ' + pulso);
    assert.equal(Number(m[1]), 3, 'três vezes');
    todas.filter(([s]) => /brilha/.test(s)).forEach(([s, c]) => assert.doesNotMatch(c, /infinite/, 'sem ciclo infinito em ' + s));
    assert.match(css, /--chama:[\d.]+m?s;/, 'a duração é um token');
    assert.match(css, /@keyframes ajudaChama\{from\{opacity:[\d.]+;transform:scale\(1\)\}to\{opacity:0;transform:scale\([\d.]+\)\}\}/);
    assert.ok(corpos('#hdrAjuda.brilha::after').some((c) => /border:2px solid var\(--accent\)/.test(c)), 'o anel parado');
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{#hdrAjuda\.brilha::before\{animation:none;display:none\}\}/);
    assert.ok(!/@media\(prefers-reduced-motion:reduce\)\{[^}]*#hdrAjuda\.brilha::after/.test(css), 'o anel parado fica');
  });

  test('o «?» tem o tamanho do sino (44 no telemóvel), esconde-se vazio, e aceso tem a cor da frente', () => {
    assert.ok(corpos('header.top #hdrAjuda').some((c) => /width:44px/.test(c) && /min-width:44px/.test(c)), '44px no telemóvel, como o sino');
    assert.ok(corpos('header.top #hdrBell').some((c) => /width:44px/.test(c)), 'o mesmo tamanho do sino');
    assert.ok(corpos('#raiz#raiz #hdrAjuda:empty').some((c) => /display:none/.test(c)));
    const aceso = corpos('header.top #hdrAjuda.on').join(';') + ';' + corpos('header.top #hdrAjuda[aria-current="page"]').join(';');
    assert.match(aceso, /color:var\(--accent-text\)/);
    assert.match(aceso, /border-color:var\(--accent\)/);
  });

  test('a nuvem saiu de vez: nenhuma regra do .sync, nem a do cabeçalho a crescer', () => {
    assert.doesNotMatch(css, /\.sync[.{ ]/);
    assert.doesNotMatch(css, /header\.top:has\(/);
  });
});
