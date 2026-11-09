// A janela do kanban (worker/src/equipa-kanban-janela.js): a moldura da folha
// da app (cabeçalho, corpo que rola e pé fixo com os botões), a classe que o
// kbJanela põe no dialog#dialogo e tira ao fechar, o gesto da folha de baixo
// (por onde se agarra, o data-gesto que a folha respeita, a resistência, o véu
// e o limiar de fechar) e a ordem das colunas depois de um arrasto. Corre o
// guião numa caixa com o mínimo do browser (testes/lib/kanban-caixa.js) e um
// dialog de mentira; o gesto a sério, no browser, prova-se à parte.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CSS_KB_JANELA } from '../worker/src/equipa-kanban-janela.js';
import { caixa } from './lib/kanban-caixa.js';

/* Um elemento de mentira, com o que o código da janela lhe pede.
   Recebe: o — {tag, cls (classes), attrs, scrollTop}.
   Devolve: o elemento. */
function elemento(o) {
  const e = {
    tagName: String(o.tag || 'div').toUpperCase(), classes: new Set(o.cls || []), attrs: Object.assign({}, o.attrs || {}),
    scrollTop: o.scrollTop || 0, scrollWidth: 100, clientWidth: 100, parentElement: null, filhos: [],
    meter(f) { f.parentElement = e; e.filhos.push(f); return f; },
    contains(x) { for (let p = x; p; p = p.parentElement) if (p === e) return true; return false; },
    // os seletores que a janela usa: tag, .classe, [atributo] e o [contenteditable] sem ser «false»
    matches(sel) {
      return sel.split(',').some((s) => {
        s = s.trim();
        if (s.startsWith('.')) return e.classes.has(s.slice(1));
        if (s === '[data-gesto]') return 'data-gesto' in e.attrs;
        if (s.startsWith('[contenteditable]')) return 'contenteditable' in e.attrs && e.attrs.contenteditable !== 'false';
        if (/^\[/.test(s)) return false;
        return e.tagName === s.toUpperCase();
      });
    },
    closest(sel) { for (let p = e; p; p = p.parentElement) if (p.matches(sel)) return p; return null; },
    querySelector(sel) {
      for (const f of e.filhos) { if (f.matches(sel)) return f; const r = f.querySelector(sel); if (r) return r; }
      return null;
    },
  };
  return e;
}

/* O dialog#dialogo de mentira: abre, fecha (e chama o onclose, como o
   browser numa tarefa a seguir), e guarda as classes e o HTML.
   Devolve: o dialog. */
function dialogo() {
  const cls = new Set();
  const d = {
    open: false, innerHTML: '', returnValue: '', onclose: null, oncancel: null, ouvintes: {},
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, s) => (s ? cls.add(c) : cls.delete(c)) },
    style: { transform: '', props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; } },
    showModal() { d.open = true; },
    close() { d.open = false; if (d.onclose) d.onclose(); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(t, f) { d.ouvintes[t] = f; },
    removeEventListener(t) { delete d.ouvintes[t]; },
    classes: cls,
  };
  return d;
}

/* A caixa do guião com o dialog de mentira e os temporizadores do Node.
   Devolve: {ctx, d}. */
function comDialogo() {
  const ctx = caixa(), d = dialogo();
  ctx.el = (id) => (id === 'dialogo' ? d : null);
  ctx.setTimeout = setTimeout;
  ctx.clearTimeout = clearTimeout;
  ctx.avisos = [];
  ctx.avisar = (m, t) => ctx.avisos.push([m, t || '']);
  return { ctx, d };
}

describe('a moldura da janela', () => {
  const ctx = caixa();

  test('um formulário: o cabeçalho com o título, o corpo com o texto e os campos, e o pé com o erro, o Cancelar e a ação', () => {
    const h = ctx.kbJanelaHtml('Novo <cartão>', '<input id="x">', { aoConfirmar() {}, botao: 'Adicionar', texto: 'Diz <b>isto</b>.' });
    const cab = h.indexOf('class="kb-j-cab"'), corpo = h.indexOf('class="kb-j-corpo"'), pe = h.indexOf('class="kb-j-pe"');
    assert.ok(cab > -1 && corpo > cab && pe > corpo, 'cabeçalho, corpo e pé, por esta ordem');
    assert.match(h.slice(cab, corpo), /<h2 id="janelaTit">Novo &lt;cartão&gt;<\/h2>/, 'o título no cabeçalho, escapado');
    assert.match(h.slice(corpo, pe), /<p class="janela-txt">Diz <b>isto<\/b>\.<\/p><input id="x">/, 'o texto e o corpo no corpo que rola');
    const doPe = h.slice(pe);
    assert.match(doPe, /id="kbJanelaErro" role="alert"/, 'o erro geral no pé, à vista mesmo com o corpo rolado');
    assert.match(doPe, /data-acao="kbFecharJanela">Cancelar<\/button><button type="button" id="kbJanelaOk" class="btn primary" data-acao="kbConfirmar">Adicionar<\/button>/);
    assert.match(ctx.kbJanelaHtml('X', '', { aoConfirmar() {}, perigo: true }), /class="btn danger"/, 'a ação que destrói é vermelha');
  });

  test('uma lista: só o Fechar no pé; com voltar, o Voltar com a ação dele; com extra, a ação da lista ao lado', () => {
    const lista = ctx.kbJanelaHtml('Mover', '<div class="kb-opcoes"></div>', {});
    assert.equal((lista.match(/<button/g) || []).length, 1);
    assert.match(lista, /<div class="kb-j-botoes"><button type="button" class="btn" data-acao="kbFecharJanela">Fechar<\/button><\/div>/);
    const volta = ctx.kbJanelaHtml('A fazer', '', { voltar: ['kbColunas', 'a-fazer'] });
    assert.match(volta, /data-acao="kbColunas" data-arg="a-fazer">Voltar<\/button>/);
    assert.doesNotMatch(volta, />Fechar</);
    const extra = ctx.kbJanelaHtml('Colunas', '', { extra: { texto: 'Adicionar coluna', acao: 'kbColunaNova', icone: 'mais' } });
    assert.match(extra, />Fechar<\/button><button type="button" class="btn primary" data-acao="kbColunaNova"><svg class="i" data-ic="mais"><\/svg>Adicionar coluna<\/button>/);
  });
});

describe('a classe do dialog', () => {
  test('o kbJanela põe a kb-dlg e abre; fechar esvazia, tira-a e larga o ouvinte do toque', () => {
    const { ctx, d } = comDialogo();
    ctx.kbJanela('Título', '<p>Corpo</p>');
    assert.equal(d.open, true);
    assert.ok(d.classes.has('kb-dlg'));
    assert.match(d.innerHTML, /kb-janela/);
    assert.equal(typeof d.ouvintes.touchmove, 'function', 'ouve o toque (para a folha travar o scroll)');
    assert.ok(ctx.kbJanelaAberta, 'controlo: a janela está aberta');
    d.close();
    assert.equal(d.classes.has('kb-dlg'), false);
    assert.equal(d.innerHTML, '');
    assert.equal(ctx.kbJanelaAberta, null);
    assert.equal(d.ouvintes.touchmove, undefined);
    assert.equal(d.onclose, null);
  });

  test('a saída: a kb-sai, e só passado o --medio o dialog fecha; uma janela aberta a meio pára-a e troca no sítio', async () => {
    const { ctx, d } = comDialogo();
    ctx.kbJanela('Um', '');
    ctx.kbFecharJanela();
    assert.ok(d.classes.has('kb-sai') && d.open, 'a sair, ainda aberta');
    assert.equal(ctx.kbJanelaViva(), false, 'a sair já não conta como viva');
    ctx.kbJanela('Dois', '');
    assert.ok(!d.classes.has('kb-sai') && d.classes.has('kb-trocou') && d.open, 'a nova toma o lugar dela, sem voltar a entrar');
    await new Promise((r) => setTimeout(r, 260));
    assert.equal(d.open, true, 'o fecho da anterior não fecha a nova');
    ctx.kbFecharJanela();
    await new Promise((r) => setTimeout(r, 260));
    assert.equal(d.open, false, 'passado o --medio, fecha');
    assert.equal(d.classes.size, 0, 'e larga todas as classes');
  });

  test('fechada há instantes (o close ainda não chegou), a janela nova não herda a saída da anterior', () => {
    const { ctx, d } = comDialogo();
    ctx.kbJanela('Um', '');
    d.classList.add('kb-sai');
    d.style.transform = 'translateY(200px)';
    d.open = false; // o close() do browser: o open cai já, o evento close vem depois
    ctx.kbJanela('Dois', '');
    assert.ok(d.open && d.classes.has('kb-dlg') && !d.classes.has('kb-sai'));
    assert.equal(d.style.transform, '');
  });
});

describe('o gesto da folha', () => {
  const ctx = caixa();
  // a folha: o dialog, o cabeçalho, o corpo (com um campo, uma pega com data-gesto e um texto) e o pé
  const montar = (rolado) => {
    const d = elemento({ tag: 'dialog' });
    const cab = d.meter(elemento({ cls: ['kb-j-cab'] })), h2 = cab.meter(elemento({ tag: 'h2' }));
    const corpo = d.meter(elemento({ cls: ['kb-j-corpo'], scrollTop: rolado ? 40 : 0 }));
    const texto = corpo.meter(elemento({ tag: 'p' })), campo = corpo.meter(elemento({ tag: 'input' }));
    const linha = corpo.meter(elemento({ tag: 'li' })), pega = linha.meter(elemento({ tag: 'span', attrs: { 'data-gesto': '' } }));
    const icone = pega.meter(elemento({ tag: 'svg' })), editavel = corpo.meter(elemento({ attrs: { contenteditable: 'true' } }));
    const pe = d.meter(elemento({ cls: ['kb-j-pe'] })), botao = pe.meter(elemento({ tag: 'button' }));
    return { d, cab, h2, corpo, texto, campo, pega, icone, editavel, botao };
  };

  test('agarra-se pelo cabeçalho, ou pelo corpo no topo do scroll; nunca de um campo, do data-gesto, do pé ou do corpo rolado', () => {
    const f = montar(false);
    assert.equal(ctx.kbFolhaZona(f.h2, f.d), 'cab');
    assert.equal(ctx.kbFolhaZona(f.cab, f.d), 'cab');
    assert.equal(ctx.kbFolhaZona(f.texto, f.d), 'corpo');
    assert.equal(ctx.kbFolhaZona(f.campo, f.d), '', 'um campo não arranca');
    assert.equal(ctx.kbFolhaZona(f.pega, f.d), '', 'quem tem data-gesto não arranca');
    assert.equal(ctx.kbFolhaZona(f.icone, f.d), '', 'nem o que está dentro dele');
    assert.equal(ctx.kbFolhaZona(f.editavel, f.d), '');
    assert.equal(ctx.kbFolhaZona(f.botao, f.d), '', 'o pé não é por onde se agarra');
    const r = montar(true);
    assert.equal(ctx.kbFolhaZona(r.texto, r.d), '', 'com o corpo rolado, o gesto é do scroll');
    assert.equal(ctx.kbFolhaZona(r.h2, r.d), 'cab', 'mas o cabeçalho continua a agarrar');
  });

  test('para cima resiste e nunca passa de metade dos 48px; o véu aclara à proporção', () => {
    assert.equal(ctx.kbFolhaElastico(0), 0);
    const a = ctx.kbFolhaElastico(-20), b = ctx.kbFolhaElastico(-200), c = ctx.kbFolhaElastico(-5000);
    assert.ok(a < 0 && b < a && c < b, 'anda cada vez mais, para cima');
    assert.ok(Math.abs(a) < 20 && Math.abs(c) < 24, 'mas menos do que o dedo, e nunca 24px');
    assert.ok(Math.abs(b) - Math.abs(a) < 200 - 20, 'cada vez menos por cada px');
    assert.equal(ctx.kbFolhaVeu(0, 400), 1);
    assert.equal(ctx.kbFolhaVeu(200, 400), 0.5);
    assert.equal(ctx.kbFolhaVeu(600, 400), 0);
    assert.equal(ctx.kbFolhaVeu(-10, 400), 1, 'puxada para cima, o véu fica inteiro');
  });

  test('largar fecha passada metade da altura (no máximo 160px) ou com um sacudir recente para baixo', () => {
    const f = (dy, h, vy, ha) => ctx.kbFolhaFechaAoLargar({ dy, h, vy: vy || 0, ta: 1000 }, 1000 + (ha || 0));
    assert.equal(f(150, 400), false);
    assert.equal(f(170, 400), true, 'numa folha de 400, o teto: 160');
    assert.equal(f(90, 200), false);
    assert.equal(f(110, 200), true, 'numa de 200, metade: 100');
    assert.equal(f(30, 400, 0.6, 40), true, 'um sacudir para baixo fecha');
    assert.equal(f(30, 400, 0.6, 150), false, 'uma velocidade de há mais de 100ms já não conta');
    assert.equal(f(-10, 400, 0.9, 10), false, 'para cima nunca fecha');
    assert.equal(f(30, 400, 0.2, 10), false, 'devagar e perto: volta ao sítio');
  });
});

describe('as colunas a arrastar', () => {
  const ctx = caixa();
  // cinco linhas de 53px coladas
  const tops = [0, 53, 106, 159, 212], h = 53, meios = tops.map((t) => t + h / 2);
  const alvo = (i0, desl) => ctx.kbColmAlvo(meios, i0, tops[i0] + desl, tops[i0] + desl + h);

  test('a ordem nova tira a coluna de onde estava e mete-a onde caiu, sem mexer na lista antiga', () => {
    const ids = ['a', 'b', 'c', 'd'];
    assert.deepEqual(Array.from(ctx.kbColmOrdem(ids, 3, 1)), ['a', 'd', 'b', 'c']);
    assert.deepEqual(Array.from(ctx.kbColmOrdem(ids, 0, 3)), ['b', 'c', 'd', 'a']);
    assert.deepEqual(Array.from(ctx.kbColmOrdem(ids, 2, 2)), ids);
    assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
  });

  test('onde cai: sem andar fica; passado meio vizinho troca com ele; e a primeira e a última trocam-se presas à lista', () => {
    for (let i = 0; i < 5; i++) assert.equal(alvo(i, 0), i, 'parada, a ' + i + ' fica');
    assert.equal(alvo(4, -20), 4, '20px para cima ainda não passou o meio da de cima');
    assert.equal(alvo(4, -30), 3, '30px já passou');
    assert.equal(alvo(4, -212), 0, 'no topo da lista é a primeira');
    assert.equal(alvo(0, 30), 1);
    assert.equal(alvo(0, 212), 4, 'presa no fundo da lista, é a última');
    assert.equal(alvo(2, 0.5 * h + 1), 3);
  });

  test('as do caminho afastam-se a altura dela para o lado de onde ela veio; o sítio mexe-se com isso', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map((i) => ctx.kbColmDesvio(i, 1, 3, h)), [0, 0, -h, -h, 0]);
    assert.deepEqual([0, 1, 2, 3, 4].map((i) => ctx.kbColmDesvio(i, 3, 1, h)), [0, h, h, 0, 0]);
    assert.deepEqual([0, 1, 2, 3, 4].map((i) => ctx.kbColmDesvio(i, 2, 2, h)), [0, 0, 0, 0, 0]);
  });

  test('gravar a ordem é à frente do servidor: o quadro muda já e, se ele recusar, volta e a janela diz porquê', async () => {
    const { ctx: c, d } = comDialogo();
    const cols = ['a-fazer', 'auto-tests', 'nova'].map((id) => ({ id, nome: id, fim: false, fixa: id !== 'nova' }));
    c.kbEstado = { colunas: cols.slice(), cartoes: [], etiquetas: [], pessoas: [], eu: { id: 'eu1', nome: 'Eu', master: true } };
    let pedido = null, recusar;
    c.enviar = (rota, corpo) => { pedido = [rota, corpo]; return new Promise((ok, nao) => { recusar = nao; }); };
    c.kbColunas();
    assert.match(d.innerHTML, /class="kb-colm-pega" data-gesto aria-hidden="true"/, 'a pega leva data-gesto: a folha não arranca dela');
    const espera = c.kbColunasGravar(['nova', 'a-fazer', 'auto-tests'], 'nova');
    assert.deepEqual(Array.from(c.kbEstado.colunas, (x) => x.id), ['nova', 'a-fazer', 'auto-tests'], 'o quadro muda já');
    assert.deepEqual(pedido[0], '/api/equipa/kanban/colunas/ordem');
    assert.deepEqual(Array.from(pedido[1].ids), ['nova', 'a-fazer', 'auto-tests']);
    recusar(new Error('A ordem tem de ter as colunas todas.'));
    await espera;
    assert.deepEqual(Array.from(c.kbEstado.colunas, (x) => x.id), ['a-fazer', 'auto-tests', 'nova'], 'recusada, volta ao que era');
    assert.deepEqual(c.avisos, [['A ordem tem de ter as colunas todas.', 'erro']], 'sem o sítio do erro (o dialog é de mentira), diz no aviso');
    // e uma lista que não é a mesma (uma coluna a mais ou a menos) nem chega a ir
    pedido = null;
    await c.kbColunasGravar(['nova', 'a-fazer'], 'nova');
    assert.equal(pedido, null);
  });
});

describe('o CSS da janela', () => {
  const css = CSS_KB_JANELA.replace(/\/\*[\s\S]*?\*\//g, '');
  test('o dialog do kanban não rola e reparte-se: só o corpo rola; o pé leva os botões de 48px', () => {
    assert.match(css, /dialog\.janela\.kb-dlg\{[^}]*overflow:hidden/);
    assert.match(css, /dialog\.janela\.kb-dlg\[open\]\{display:flex;flex-direction:column\}/);
    assert.match(css, /\.kb-j-corpo\{[^}]*position:relative[^}]*min-height:0[^}]*overflow-y:auto/);
    assert.match(css, /\.kb-j-botoes \.btn\{[^}]*min-height:48px/);
  });
  test('abaixo dos 520px é a folha de baixo, com a barra de 36×4 e a área segura no pé; sobe e desce', () => {
    const tel = css.slice(css.indexOf('@media(max-width:520px){'));
    assert.match(tel, /dialog\.janela\.kb-dlg\{top:auto;bottom:0;[^}]*border-radius:20px 20px 0 0/);
    assert.match(tel, /\.kb-j-cab::before\{content:"";display:block;width:36px;height:4px/);
    assert.match(tel, /\.kb-j-pe\{[^}]*env\(safe-area-inset-bottom\)/);
    assert.match(css, /animation-name:kbFolhaSobe/);
    assert.match(css, /animation-name:kbFolhaDesce/);
  });
  test('com menos movimento só desvanece, e as colunas não deslizam', () => {
    const blocos = css.split('@media(prefers-reduced-motion:reduce){').slice(1).join('');
    assert.match(blocos, /animation-name:kbVeuEntra/);
    assert.match(blocos, /animation-name:kbVeuSai/);
    assert.match(blocos, /\.kb-colms-a-arrastar \.kb-colm:not\(\.kb-colm-agarrada\)[^{]*\{transition:none\}/);
  });
});
