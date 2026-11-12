// O rascunho do cartão no aparelho (KAN-105): o formulário de criar e de
// editar um cartão do kanban (worker/src/equipa-kanban-filtros.js:kbFormCartao)
// guarda no localStorage, enquanto se escreve, o que ainda não foi ao
// servidor — um rascunho por cartão novo (cada «Novo cartão» com um id seu,
// e podem ser vários) e um por cartão editado. O quadro mostra-os
// (worker/src/equipa-kanban.js:kbRascunhoCartaoHtml): o cartão novo por
// enviar na coluna dele, no topo, com o selo «Por enviar» e a frase «Ainda
// não foi para o servidor.»; o cartão do servidor com alterações por enviar
// com o selo «Alterações por enviar», e no painel a linha com «Continuar a
// editar» e «Descartar». Tocar no cartão por enviar reabre o formulário com
// ele; o Adicionar ou o Guardar que o servidor aceitou apaga-o (e o cartão
// real toma-lhe o lugar), o que falha deixa-o no quadro; descartar tem o
// Anular; o 'novo' de antes migra; caduca aos 30 dias; sem armazenamento, o
// quadro e o formulário funcionam como antes. Corre o guião do kanban na
// caixa dos testes dele, com um dialog e campos de mentira.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CSS_KANBAN } from '../worker/src/equipa-kanban.js';
import { caixa } from './lib/kanban-caixa.js';

const DIA = 864e5;
const ESTADO = () => ({
  colunas: [{ id: 'a-fazer', nome: 'A fazer', fim: false }, { id: 'auto-tests', nome: 'Auto Tests', fim: false }, { id: 'feito', nome: 'Feito', fim: true }],
  cartoes: [{ chave: 'KAN-7', coluna_id: 'a-fazer', tipo: 'tarefa', titulo: 'Velho', etiquetas: ['qa'], prioridade: 3, responsavel: null, pai: null }],
  etiquetas: ['qa', 'design'],
  pessoas: [{ id: 'eu1', nome: 'Eu' }, { id: 'x', nome: 'Xavier' }],
  eu: { id: 'eu1', nome: 'Eu', master: true },
});
// o cartão que o Editar recebe do servidor (com a descrição)
const KAN7 = () => ({ chave: 'KAN-7', coluna_id: 'a-fazer', tipo: 'tarefa', titulo: 'Velho', descricao: 'Texto', etiquetas: ['qa'], prioridade: 3,
  responsavel: null, pai: null, prazo: null });

/* Um localStorage de mentira (ou um que recusa tudo, como um browser que não deixa guardar).
   Recebe: fechado (opcional) — true para rebentar em cada chamada.
   Devolve: o armazenamento, com .dados à vista. */
function armazenamento(fechado) {
  const dados = {};
  const nao = () => { throw new Error('bloqueado'); };
  return {
    dados,
    getItem: fechado ? nao : (k) => (k in dados ? dados[k] : null),
    setItem: fechado ? nao : (k, v) => { dados[k] = String(v); },
    removeItem: fechado ? nao : (k) => { delete dados[k]; },
  };
}

/* A caixa com o quadro, um dialog de mentira, um #kbQuadro e um #aviso de
   mentira, e os campos do formulário, que o teste preenche como a pessoa os
   escreveria (campos e rádios).
   Recebe: o (opcional) — {ls: o localStorage (null para não haver nenhum)}.
   Devolve: {ctx, d, q, aviso, campos, radios, pedidos, avisos}. */
function comFormulario(o = {}) {
  const ctx = caixa();
  const d = {
    open: false, innerHTML: '', returnValue: '', onclose: null, oncancel: null, style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    showModal() { d.open = true; }, close() { d.open = false; if (d.onclose) d.onclose(); },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  };
  const q = { innerHTML: '', scrollLeft: 0, querySelectorAll: () => [], querySelector: () => null, contains: () => false };
  const aviso = { className: '', innerHTML: '' };
  const campos = {}, radios = {}, pedidos = [], avisos = [];
  ctx.el = (id) => (id === 'dialogo' ? d : id === 'kbQuadro' ? q : id === 'aviso' ? aviso : id in campos ? campos[id] : null);
  ctx.document = {
    addEventListener() {}, getElementById: (id) => ctx.el(id),
    querySelector(sel) {
      const m = /^input\[name="([^"]+)"\]:checked$/.exec(sel);
      return m && radios[m[1]] != null ? { value: radios[m[1]] } : null;
    },
  };
  ctx.setTimeout = setTimeout;
  ctx.clearTimeout = clearTimeout;
  ctx.valorDe = (id) => (campos[id] ? String(campos[id].value || '').trim() : '');
  ctx.marcarErro = () => {};
  ctx.avisar = (m, t) => avisos.push([m, t || '']);
  ctx.kbRecarregar = () => Promise.resolve();
  ctx.kbTelemovel = () => false;
  ctx.enviar = (rota, corpo) => { pedidos.push(['POST', rota, corpo]); return ctx.resposta(); };
  ctx.pedir = (rota, op) => { pedidos.push([op && op.method, rota, op && op.body ? JSON.parse(op.body) : null]); return ctx.resposta(); };
  ctx.resposta = () => Promise.resolve({ cartao: { chave: 'KAN-50', coluna_id: 'a-fazer', tipo: 'tarefa', titulo: 'Do servidor', prioridade: 3, etiquetas: [] } });
  if (o.ls !== null) ctx.localStorage = o.ls || armazenamento();
  ctx.kbEstado = ESTADO();
  return { ctx, d, q, aviso, campos, radios, pedidos, avisos };
}
// os campos de texto do formulário, com os valores com que a janela os pinta (o value="…" do HTML)
function preencherDoHtml(f) {
  const valor = (id) => { const m = new RegExp('id="' + id + '"[^>]*value="([^"]*)"').exec(f.d.innerHTML); return m ? m[1] : ''; };
  const area = (id) => { const m = new RegExp('<textarea id="' + id + '"[^>]*>([^<]*)</textarea>').exec(f.d.innerHTML); return m ? m[1] : null; };
  f.campos['kbF-titulo'] = { value: valor('kbF-titulo') };
  f.campos['kbF-pai'] = { value: valor('kbF-pai') };
  f.campos['kbF-prazo'] = { value: valor('kbF-prazo') };
  const desc = area('kbF-descricao');
  if (desc != null) f.campos['kbF-descricao'] = { value: desc };
  for (const g of ['kbF-tipo', 'kbF-coluna', 'kbF-prioridade', 'kbF-responsavel']) {
    if (!f.d.innerHTML.includes('id="' + g + '"')) { delete f.campos[g]; delete f.radios[g]; continue; }
    f.campos[g] = { value: '' };
    const m = new RegExp('name="' + g + '" value="([^"]*)" checked').exec(f.d.innerHTML);
    f.radios[g] = m ? m[1] : null;
  }
}
/* Abre o formulário de um cartão novo e escreve nele (e guarda, como o ouvinte do input faria).
   Recebe: f; pre (opcional) — o pre do kbFormCartao; mexer — função que muda f.campos/f.radios.
   Devolve: o id do rascunho da janela. */
function escreverNovo(f, pre, mexer) {
  f.ctx.kbFormCartao('criar', null, pre || {});
  preencherDoHtml(f);
  mexer(f);
  f.ctx.kbRascunhoDoForm();
  return f.ctx.kbJanelaAberta.rascunho.qual;
}
// o que está guardado no aparelho para esta pessoa
const guardados = (f) => JSON.parse(f.ctx.localStorage.dados['kb_rascunhos:eu1'] || '{}');
// os ids dos rascunhos de cartões novos guardados
const novos = (f) => Object.keys(guardados(f)).filter((k) => /^novo-/.test(k));
const passa = () => new Promise((r) => setImmediate(r));

describe('as contas do rascunho', () => {
  const ctx = caixa();
  const base = { tipo: 'tarefa', titulo: '', descricao: '', coluna: 'a-fazer', prioridade: '3', etiquetas: [], responsavel: '', pai: '', prazo: '' };

  test('só guarda o que difere do que abriu; os espaços à volta do texto não contam; o que não está no formulário não conta', () => {
    assert.deepEqual({ ...ctx.kbRascunhoDiff(base, { ...base }) }, {});
    assert.deepEqual({ ...ctx.kbRascunhoDiff(base, { ...base, titulo: '  ' }) }, {}, 'só espaços é igual a vazio');
    const d = ctx.kbRascunhoDiff(base, { ...base, titulo: 'Novo ', etiquetas: ['qa'], prioridade: '1', coluna: undefined, descricao: undefined });
    assert.deepEqual(JSON.parse(JSON.stringify(d)), { titulo: 'Novo ', etiquetas: ['qa'], prioridade: '1' });
    assert.deepEqual({ ...ctx.kbRascunhoDiff({ ...base, etiquetas: ['a', 'b'] }, { ...base, etiquetas: ['a', 'b'] }) }, {});
  });

  test('aplicar põe por cima do que abriu só os campos que conhece, com os tipos certos', () => {
    const v = ctx.kbRascunhoAplicar(base, { titulo: 'T', etiquetas: ['qa', 7], tipo: 'inventado', prioridade: '9', lixo: 'x', pai: 'KAN-3' });
    assert.equal(v.titulo, 'T');
    assert.deepEqual([...v.etiquetas], ['qa', '7']);
    assert.equal(v.tipo, 'tarefa', 'um tipo que não existe fica o que era');
    assert.equal(v.prioridade, '3', 'uma prioridade fora de 1 a 5 fica a que era');
    assert.equal(v.pai, 'KAN-3');
    assert.equal('lixo' in v, false);
    assert.equal(base.titulo, '', 'o que abriu não muda');
  });

  test('a linha diz de quando é, e tem o «Descartar rascunho»', () => {
    const t = new Date(2026, 10, 11, 9, 5).getTime();
    assert.equal(ctx.kbRascunhoQuando(t, t + 60000), 'hoje às 09:05');
    assert.equal(ctx.kbRascunhoQuando(t, t + DIA), 'ontem às 09:05');
    assert.equal(ctx.kbRascunhoQuando(t, t + 5 * DIA), 'a 11/11 às 09:05');
    const h = ctx.kbRascunhoLinha({ t, campos: { titulo: 'x' } }, t);
    assert.match(h, /class="kb-rascunho"/);
    assert.match(h, /neste aparelho/);
    assert.match(h, /data-acao="kbRascunhoDescartar">Descartar rascunho<\/button>/);
  });

  test('cada cartão novo tem um id seu; o «novo» de antes e os novos contam como cartões novos, as chaves não', () => {
    const a = ctx.kbRascunhoNovoId(1000), b = ctx.kbRascunhoNovoId(1000);
    assert.match(a, /^novo-[a-z0-9]+-[a-z0-9]{1,4}$/);
    assert.notEqual(a, b, 'dois no mesmo milissegundo não se pisam');
    for (const k of [a, 'novo']) assert.equal(ctx.kbRascunhoENovo(k), true, k);
    for (const k of ['KAN-7', 'novos', 'novo-<b>', '', null]) assert.equal(ctx.kbRascunhoENovo(k), false, String(k));
  });
});

describe('guardar e ler no aparelho', () => {
  test('guarda por pessoa e por cartão (cada novo e cada um editado), lê de volta, e apaga', () => {
    const f = comFormulario(), T = Date.now();
    f.ctx.kbRascunhoGuardar('novo-a1', { titulo: 'A', coluna: 'a-fazer' }, T - 2000);
    f.ctx.kbRascunhoGuardar('novo-b2', { titulo: 'B', coluna: 'feito' }, T - 1500);
    f.ctx.kbRascunhoGuardar('KAN-7', { titulo: 'C' }, T - 1000);
    assert.deepEqual(Object.keys(guardados(f)).sort(), ['KAN-7', 'novo-a1', 'novo-b2']);
    assert.equal(f.ctx.kbRascunhoLer('novo-a1', T).campos.titulo, 'A');
    assert.equal(f.ctx.kbRascunhoLer('novo-a1', T).c, T - 2000, 'um cartão novo guarda quando nasceu');
    assert.equal(f.ctx.kbRascunhoLer('KAN-7', T).t, T - 1000);
    assert.equal(f.ctx.kbRascunhoLer('KAN-7', T).c, undefined, 'o de uma edição não precisa');
    f.ctx.kbRascunhoGuardar('novo-a1', { titulo: 'A2', coluna: 'a-fazer' }, T);
    assert.equal(f.ctx.kbRascunhoLer('novo-a1', T).c, T - 2000, 'mexer-lhe não muda quando nasceu');
    f.ctx.kbRascunhoApagar('novo-a1');
    f.ctx.kbRascunhoApagar('novo-b2');
    assert.deepEqual(Object.keys(guardados(f)), ['KAN-7']);
    f.ctx.kbRascunhoGuardar('KAN-7', {}, T);
    assert.equal(f.ctx.localStorage.dados['kb_rascunhos:eu1'], undefined, 'vazio não conta, e sem nenhum a chave sai');
  });

  test('caduca aos 30 dias: lido depois disso não volta, e sai do aparelho', () => {
    const f = comFormulario();
    f.ctx.kbRascunhoGuardar('novo-a1', { titulo: 'velho', coluna: 'a-fazer' }, 1000);
    f.ctx.kbRascunhoGuardar('KAN-7', { titulo: 'novo' }, 1000 + 20 * DIA);
    assert.equal(f.ctx.kbRascunhoLer('novo-a1', 1000 + 29 * DIA).campos.titulo, 'velho', 'aos 29 dias ainda está');
    assert.equal(f.ctx.kbRascunhoLer('novo-a1', 1000 + 31 * DIA), null);
    assert.deepEqual(Object.keys(guardados(f)), ['KAN-7'], 'o caducado saiu, o outro ficou');
  });

  test('o «novo» de antes (um só, sem id) migra para o formato novo, com a coluna; a do rascunho fica, se a tinha', () => {
    const f = comFormulario(), T = Date.now();
    f.ctx.localStorage.dados['kb_rascunhos:eu1'] = JSON.stringify({ novo: { campos: { titulo: 'De antes', prioridade: '1' }, t: T - 5000 }, 'KAN-7': { campos: { titulo: 'E' }, t: T } });
    const r = f.ctx.kbRascunhosParaQuadro(T);
    assert.equal(r.novos['a-fazer'].length, 1, 'aparece no quadro, em A fazer');
    const x = r.novos['a-fazer'][0];
    assert.match(x.qual, /^novo-/);
    assert.equal(x.campos.titulo, 'De antes');
    assert.equal(x.c, T - 5000, 'nasceu quando foi escrito');
    const g = guardados(f);
    assert.equal('novo' in g, false, 'a chave de antes sai do aparelho');
    assert.deepEqual(g[x.qual].campos, { titulo: 'De antes', prioridade: '1', coluna: 'a-fazer' });
    assert.ok(g['KAN-7'], 'o da edição fica como estava');
    // reaberto do quadro, é o mesmo rascunho
    f.ctx.kbRascunhoAbrir(x.qual);
    assert.match(f.d.innerHTML, /id="kbF-titulo"[^>]*value="De antes"/);
    assert.equal(f.ctx.kbJanelaAberta.rascunho.qual, x.qual);
    // um de antes com outra coluna mantém-na
    const h = comFormulario();
    h.ctx.localStorage.dados['kb_rascunhos:eu1'] = JSON.stringify({ novo: { campos: { titulo: 'X', coluna: 'feito' }, t: T } });
    assert.equal(h.ctx.kbRascunhosParaQuadro(T).novos.feito.length, 1);
  });

  test('sem armazenamento (recusado ou inexistente) não rebenta: não guarda nem lê, e o quadro não mostra nenhum', () => {
    for (const f of [comFormulario({ ls: armazenamento(true) }), comFormulario({ ls: null })]) {
      assert.doesNotThrow(() => f.ctx.kbRascunhoGuardar('novo-a1', { titulo: 'x', coluna: 'a-fazer' }));
      assert.equal(f.ctx.kbRascunhoLer('novo-a1'), null);
      assert.doesNotThrow(() => f.ctx.kbRascunhoApagar('novo-a1'));
      assert.doesNotThrow(() => f.ctx.kbFormCartao('criar', null, {}));
      assert.equal(f.d.open, true, 'o formulário abre como antes');
      assert.doesNotMatch(f.d.innerHTML, /kb-rascunho/);
      const r = f.ctx.kbRascunhosParaQuadro();
      assert.deepEqual([Object.keys(r.novos).length, Object.keys(r.edicoes).length], [0, 0]);
      assert.doesNotMatch(f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]), /kb-rasc/);
      assert.doesNotMatch(f.ctx.kbCartaoHtml(f.ctx.kbEstado.cartoes[0]), /por enviar/);
    }
  });

  test('o que se guardou com lixo (não é JSON, não é um objeto) conta como nada', () => {
    const f = comFormulario();
    f.ctx.localStorage.dados['kb_rascunhos:eu1'] = '{mau';
    assert.equal(f.ctx.kbRascunhoLer('novo-a1'), null);
    assert.deepEqual(Object.keys(f.ctx.kbRascunhosParaQuadro().novos), []);
    f.ctx.localStorage.dados['kb_rascunhos:eu1'] = JSON.stringify({ 'novo-a1': 'texto', velho: { campos: [] }, 'novo-b2': { campos: { titulo: 'x' }, t: Date.now(), p: 'lixo' } });
    assert.equal(f.ctx.kbRascunhoLer('novo-a1'), null);
    const b = f.ctx.kbRascunhoLer('novo-b2');
    assert.equal(b.p, undefined, 'um pai/tipo que não é um objeto sai');
    assert.equal(f.ctx.kbRascunhosParaQuadro().novos['a-fazer'].length, 1, 'sem coluna, fica em A fazer');
  });
});

describe('o formulário do cartão novo com o rascunho', () => {
  test('escrever guarda; fechar deixa-o no quadro; um «Novo cartão» a seguir começa vazio, com outro id', () => {
    const f = comFormulario();
    const id = escreverNovo(f, {}, (x) => { x.campos['kbF-titulo'].value = 'Corrigir o aviso'; x.radios['kbF-prioridade'] = '1'; });
    assert.match(id, /^novo-/);
    assert.deepEqual(guardados(f)[id].campos, { titulo: 'Corrigir o aviso', prioridade: '1', coluna: 'a-fazer' }, 'o que difere do vazio, e a coluna sempre');
    f.d.close();
    assert.ok(guardados(f)[id], 'fechar a janela não o apaga');
    assert.match(f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]), /data-rascunho="novo-[^"]+"[^]*Corrigir o aviso/, 'está no quadro');
    f.ctx.kbNovo('');
    assert.doesNotMatch(f.d.innerHTML, /kb-rascunho|value="Corrigir o aviso"/, 'o «Novo cartão» começa vazio');
    assert.notEqual(f.ctx.kbJanelaAberta.rascunho.qual, id, 'com um id novo');
    assert.match(f.d.innerHTML, /id="kbF-titulo"[^>]*value=""/);
  });

  test('tocar no cartão por enviar reabre o formulário com ele e o mesmo id, com a linha e o «Descartar rascunho»', () => {
    const f = comFormulario();
    const id = escreverNovo(f, { coluna_id: 'auto-tests' }, (x) => { x.campos['kbF-titulo'].value = 'Por acabar'; x.radios['kbF-prioridade'] = '2'; });
    f.d.close();
    f.ctx.ACOES.kbRascunhoAbrir({ arg: id });
    assert.equal(f.ctx.kbJanelaAberta.rascunho.qual, id);
    assert.match(f.d.innerHTML, /id="kbF-titulo"[^>]*value="Por acabar"/);
    assert.match(f.d.innerHTML, /name="kbF-prioridade" value="2" checked/);
    assert.match(f.d.innerHTML, /name="kbF-coluna" value="auto-tests" checked/, 'na coluna onde ficou');
    assert.match(f.d.innerHTML, /class="kb-rascunho"[\s\S]*Descartar rascunho/);
    assert.match(f.d.innerHTML, /id="kbJanelaOk"[^>]*>Adicionar</, 'com o Adicionar');
    // um que já não está no aparelho não abre nada, e o quadro repinta-se sem ele
    f.d.close();
    f.ctx.kbRascunhoApagar(id);
    f.ctx.kbRascunhoAbrir(id);
    assert.equal(f.d.open, false);
    assert.match(f.avisos.pop()[0], /já não está neste aparelho/);
  });

  test('vários cartões por enviar: cada um no quadro, na coluna dele, do mais recente para o mais antigo, antes dos do servidor', async () => {
    const f = comFormulario();
    const a = escreverNovo(f, {}, (x) => { x.campos['kbF-titulo'].value = 'Primeiro'; });
    f.d.close();
    await new Promise((r) => setTimeout(r, 5));
    const b = escreverNovo(f, {}, (x) => { x.campos['kbF-titulo'].value = 'Segundo'; });
    f.d.close();
    const c = escreverNovo(f, {}, (x) => { x.campos['kbF-titulo'].value = 'Noutra'; x.radios['kbF-coluna'] = 'feito'; });
    f.d.close();
    assert.equal(new Set([a, b, c]).size, 3);
    assert.equal(novos(f).length, 3);
    const h = f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]);
    const ordem = [...h.matchAll(/data-rascunho="([^"]+)"|data-chave="([^"]+)"/g)].map((m) => m[1] || m[2]);
    assert.deepEqual(ordem, [b, a, 'KAN-7'], 'os por enviar no topo, o mais recente primeiro, e depois os do servidor');
    assert.match(f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[2]), /Noutra/, 'o que mudou de coluna está na dele');
    assert.doesNotMatch(h, /Noutra/);
  });

  test('só mudar a coluna não faz um cartão por enviar; escrever e voltar ao vazio apaga-o', () => {
    const f = comFormulario();
    escreverNovo(f, {}, (x) => { x.radios['kbF-coluna'] = 'feito'; });
    assert.equal(novos(f).length, 0, 'sem nada escrito, não há rascunho');
    f.campos['kbF-titulo'].value = 'x';
    f.ctx.kbRascunhoDoForm();
    assert.equal(novos(f).length, 1);
    f.campos['kbF-titulo'].value = '';
    f.ctx.kbRascunhoDoForm();
    assert.equal(novos(f).length, 0);
  });

  test('a subtarefa: guarda o pai e o tipo do «Adicionar subtarefa» e reabre igual; apagar o título apaga-a', () => {
    const f = comFormulario();
    const id = escreverNovo(f, { pai: 'KAN-7', tipo: 'subtarefa', coluna_id: 'a-fazer' }, (x) => { x.campos['kbF-titulo'].value = 'Filha'; });
    const g = guardados(f)[id];
    assert.deepEqual(g.campos, { tipo: 'subtarefa', titulo: 'Filha', pai: 'KAN-7', coluna: 'a-fazer' });
    assert.deepEqual(g.p, { pai: 'KAN-7', tipo: 'subtarefa' });
    f.d.close();
    f.ctx.kbRascunhoAbrir(id);
    assert.match(f.d.innerHTML, /id="kbF-pai"[^>]*value="KAN-7"/);
    assert.match(f.d.innerHTML, /name="kbF-tipo" value="subtarefa" checked/);
    preencherDoHtml(f);
    f.campos['kbF-titulo'].value = '';
    f.ctx.kbRascunhoDoForm();
    assert.equal(guardados(f)[id], undefined, 'sem nada além do que o botão trouxe, não há rascunho');
  });

  test('o que se escreve pelo input e pelo change da janela vai para o rascunho (o ouvinte do documento)', () => {
    const f = comFormulario();
    const ouvintes = {};
    f.ctx.document.addEventListener = (t, fn) => { (ouvintes[t] = ouvintes[t] || []).push(fn); };
    f.ctx.kbRascunhoOuvir(f.ctx.document);
    f.ctx.kbFormCartao('criar', null, {});
    const id = f.ctx.kbJanelaAberta.rascunho.qual;
    preencherDoHtml(f);
    f.campos['kbF-titulo'].value = 'Pelo teclado';
    const dentro = { closest: (s) => (s === '#dialogo' ? f.d : null) };
    (ouvintes.input || []).forEach((fn) => fn({ target: dentro }));
    assert.equal(guardados(f)[id].campos.titulo, 'Pelo teclado');
    f.campos['kbF-titulo'].value = 'Fora';
    (ouvintes.change || []).forEach((fn) => fn({ target: { closest: () => null } }));
    assert.equal(guardados(f)[id].campos.titulo, 'Pelo teclado', 'o que não é da janela não conta');
  });

  test('um rascunho igual ao que abre não conta: reaberto assim, não mostra a linha e sai do aparelho', () => {
    const f = comFormulario();
    f.ctx.kbRascunhoGuardar('novo-a1', { titulo: '   ', coluna: 'a-fazer' });
    f.ctx.kbRascunhoAbrir('novo-a1');
    assert.doesNotMatch(f.d.innerHTML, /kb-rascunho/);
    assert.equal(guardados(f)['novo-a1'], undefined);
  });

  test('o quadro repinta-se: quando o rascunho nasce (um instante depois de se escrever), e logo quando é aceite pelo servidor', async () => {
    const f = comFormulario();
    escreverNovo(f, {}, (x) => { x.campos['kbF-titulo'].value = 'Ao vivo'; });
    assert.doesNotMatch(f.q.innerHTML, /Ao vivo/, 'não repinta a cada tecla');
    await new Promise((r) => setTimeout(r, 200));
    assert.match(f.q.innerHTML, /kb-rasc[^]*Ao vivo/, 'pouco depois, o quadro mostra-o');
    f.ctx.kbConfirmar();
    await passa();
    assert.doesNotMatch(f.q.innerHTML, /Ao vivo/, 'aceite, sai do quadro');
    assert.match(f.q.innerHTML, /data-chave="KAN-50"/, 'e o cartão real toma-lhe o lugar');
    const ordem = [...f.q.innerHTML.matchAll(/data-chave="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ordem.slice(0, 2), ['KAN-50', 'KAN-7'], 'no topo da coluna, onde o servidor o pôs');
  });

  test('o Adicionar que falha (sem rede, servidor recusa) deixa o cartão por enviar no quadro; o que dá apaga-o', async () => {
    const f = comFormulario();
    const id = escreverNovo(f, {}, (x) => { x.campos['kbF-titulo'].value = 'Vai falhar'; });
    f.ctx.resposta = () => Promise.reject(new Error('Sem ligação ao servidor.'));
    f.ctx.kbConfirmar();
    await passa();
    assert.equal(f.pedidos.length, 1, 'foi ao servidor');
    assert.equal(guardados(f)[id].campos.titulo, 'Vai falhar', 'a falha deixa o rascunho');
    assert.equal(f.d.open, true, 'e a janela aberta, com o erro');
    // um erro do servidor (com estado) diz o que ele disse; sem resposta, diz-se em português o que fica
    const erros = [];
    f.ctx.el = ((velho) => (id) => (id === 'kbJanelaErro' ? { set textContent(v) { erros.push(v); } } : velho(id)))(f.ctx.el);
    f.ctx.resposta = () => Promise.reject(new TypeError('Failed to fetch'));
    f.ctx.kbConfirmar();
    await passa();
    assert.equal(erros.pop(), 'Sem ligação ao servidor. O cartão fica no quadro, por enviar.');
    f.ctx.resposta = () => Promise.reject(Object.assign(new Error('Essa coluna não existe.'), { status: 400 }));
    f.ctx.kbConfirmar();
    await passa();
    assert.equal(guardados(f)[id].campos.titulo, 'Vai falhar', 'nenhuma falha apaga o rascunho');
    f.d.close();
    assert.match(f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]), /Vai falhar[^]*Ainda não foi para o servidor\./, 'fechada, está no quadro por enviar');
    f.ctx.kbRascunhoAbrir(id);
    preencherDoHtml(f);
    f.ctx.resposta = () => Promise.resolve({ cartao: { chave: 'KAN-50', coluna_id: 'a-fazer', tipo: 'tarefa', titulo: 'Vai falhar', prioridade: 3, etiquetas: [] } });
    f.ctx.kbConfirmar();
    await passa();
    assert.equal(f.pedidos.length, 4, 'três falhas e o que deu');
    assert.equal(f.pedidos[3][2].titulo, 'Vai falhar');
    assert.equal(f.pedidos[3][2].coluna_id, 'a-fazer');
    assert.equal(f.ctx.localStorage.dados['kb_rascunhos:eu1'], undefined, 'aceite, o rascunho sai');
    assert.equal(f.ctx.kbEstado.cartoes[0].chave, 'KAN-50');
  });

  test('«Descartar rascunho» no formulário de um cartão novo: sai do quadro na hora, a janela fecha, e o Anular repõe-no', () => {
    const f = comFormulario();
    const id = escreverNovo(f, {}, (x) => { x.campos['kbF-titulo'].value = 'Por enviar'; });
    f.d.close();
    f.ctx.kbRascunhoAbrir(id);
    f.ctx.ACOES.kbRascunhoDescartar({});
    assert.equal(guardados(f)[id], undefined);
    assert.equal(f.d.open, false, 'a janela fecha: o cartão deixou de existir');
    assert.match(f.q.innerHTML, /data-coluna="a-fazer"/, 'o quadro repintou-se já');
    assert.doesNotMatch(f.q.innerHTML, /Por enviar<\/button>|data-rascunho/);
    assert.match(f.aviso.innerHTML, /Rascunho descartado\.[^]*data-acao="kbRascunhoRepor" data-arg="novo-[^"]+">Anular/);
    f.ctx.ACOES.kbRascunhoRepor({ arg: id });
    assert.equal(guardados(f)[id].campos.titulo, 'Por enviar', 'o Anular repõe-no tal e qual');
    assert.match(f.q.innerHTML, new RegExp('data-rascunho="' + id + '"'));
    assert.deepEqual(f.avisos.pop(), ['Rascunho reposto.', '']);
  });

  test('o ⋯ do cartão por enviar: só «Descartar rascunho», a vermelho; descartar fecha-o e tira o cartão do quadro', () => {
    const f = comFormulario();
    const id = escreverNovo(f, {}, (x) => { x.campos['kbF-titulo'].value = '<b>Meu</b>'; });
    f.d.close();
    f.ctx.ACOES.kbRascunhoMenu({ arg: id });
    assert.match(f.d.innerHTML, /<h2 id="janelaTit">Rascunho · &lt;b&gt;Meu&lt;\/b&gt;<\/h2>/, 'o título escapado');
    const ops = [...f.d.innerHTML.matchAll(/data-acao="(kb\w+)" data-arg="([^"]*)"/g)].filter((m) => m[1] !== 'kbFecharJanela');
    assert.deepEqual(ops.map((m) => m[1]), ['kbRascunhoDescartarDe']);
    assert.match(f.d.innerHTML, /kb-opcao texto-perigo[^]*Descartar rascunho/);
    f.ctx.ACOES.kbRascunhoDescartarDe({ arg: id }, { closest: (s) => (s === '#dialogo' ? f.d : null) });
    assert.equal(f.d.open, false);
    assert.equal(guardados(f)[id], undefined);
    assert.doesNotMatch(f.q.innerHTML, /data-rascunho/);
  });
});

describe('o cartão por enviar no quadro', () => {
  test('na coluna dele, com o tipo, o selo «Por enviar», a prioridade, o título escapado e a frase; sem pega; o botão do título reabre-o', () => {
    const f = comFormulario();
    f.ctx.kbRascunhoGuardar('novo-a1', { titulo: 'Ver <img src=x onerror=alert(1)>', tipo: 'erro', prioridade: '1', etiquetas: ['qa'], coluna: 'a-fazer' });
    const h = f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]);
    const x = /<article class="kb-rasc" data-rascunho="novo-a1">[^]*?<\/article>/.exec(h)[0];
    assert.match(x, /kb-tipo kb-t-erro/);
    assert.match(x, /<span class="kb-rasc-selo"><svg class="i" data-ic="kbPorEnviar"><\/svg>Por enviar<\/span>/);
    assert.match(x, /kb-prio-selo kb-p1/);
    assert.match(x, /data-acao="kbRascunhoAbrir" data-arg="novo-a1"><span class="so-leitor">Rascunho por enviar: <\/span>Ver &lt;img src=x onerror=alert\(1\)&gt;<\/button>/);
    assert.doesNotMatch(x, /<img/);
    assert.match(x, /<span class="kb-etq">qa<\/span>/);
    assert.match(x, /<p class="kb-rasc-txt">Ainda não foi para o servidor\.<\/p>/);
    assert.doesNotMatch(x, /kb-pega|kbMoverPara|kb-cartao/, 'sem pega nem arrasto (não é um cartão do servidor)');
    assert.match(x, /class="kb-mais" aria-label="Ações do rascunho «Ver &lt;img[^"]*»" aria-haspopup="dialog" data-acao="kbRascunhoMenu" data-arg="novo-a1"/);
    f.ctx.kbRascunhoGuardar('novo-b2', { titulo: '  ', descricao: 'só a descrição', coluna: 'a-fazer' });
    assert.match(f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]), /data-rascunho="novo-b2"[^]*<span class="kb-rasc-sem">Sem título<\/span>/, 'sem título, diz-se');
  });

  test('não conta no número da coluna, os filtros não o escondem, e com ele a coluna vazia não é o «Adicionar cartão» grande', () => {
    const f = comFormulario();
    f.ctx.kbRascunhoGuardar('novo-a1', { titulo: 'Meu', coluna: 'auto-tests' });
    const h = f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[1]);
    assert.match(h, /<span class="kb-col-n n"><span class="so-leitor">, <\/span>0<span class="so-leitor"> cartões<\/span>/, 'o número é o dos cartões do quadro');
    assert.match(h, /data-rascunho="novo-a1"/);
    assert.doesNotMatch(h, /kb-col-vazio/, 'nem o vazio');
    assert.match(h, /kb-col-pe[^]*Adicionar cartão/, 'e o «Adicionar cartão» no pé');
    f.ctx.kbFiltros.tipo = 'erro';
    const a = f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]);
    assert.match(a, /0 de 1/, 'com filtros, o número é o do quadro');
    assert.match(a, /Nada com estes filtros\./);
    const b = f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[1]);
    assert.match(b, /data-rascunho="novo-a1"/, 'os filtros não escondem o que é teu e está por enviar');
    assert.doesNotMatch(b, /Nada com estes filtros/);
  });

  test('o de uma coluna que já não existe vai para A fazer (ou para a primeira)', () => {
    const f = comFormulario();
    f.ctx.kbRascunhoGuardar('novo-a1', { titulo: 'Perdido', coluna: 'removida' });
    assert.match(f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]), /Perdido/);
    f.ctx.kbEstado.colunas = f.ctx.kbEstado.colunas.filter((c) => c.id !== 'a-fazer');
    assert.match(f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]), /Perdido/, 'sem A fazer, na primeira');
    f.ctx.kbRascunhoAbrir('novo-a1');
    assert.match(f.d.innerHTML, /name="kbF-coluna" value="auto-tests" checked/, 'e o formulário abre nessa');
  });

  test('o CSS: o selo e a frase na cor da frente (letra e contorno), o contorno tracejado, tokens, o :hover atrás do portão', () => {
    const regra = (sel) => { const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}').exec(CSS_KANBAN); return m ? m[1] : ''; };
    assert.match(regra('.kb-rasc-selo'), /border:1px solid currentColor/);
    assert.match(regra('.kb-rasc-selo'), /color:var\(--accent-text\)/);
    assert.doesNotMatch(regra('.kb-rasc-selo'), /background/, 'sem fundo, que o escuro forçado apaga');
    assert.match(regra('.kb-rasc-txt'), /color:var\(--accent-text\)/);
    assert.match(regra('.kb-rasc'), /border:1px dashed var\(--accent\)/);
    for (const s of ['.kb-rasc', '.kb-rasc-selo', '.kb-rasc-txt', '.kb-rascunho']) assert.doesNotMatch(regra(s), /#[0-9a-f]{3,6}\b|rgb|hsl/i, s);
    assert.match(CSS_KANBAN, /@media\(hover:hover\) and \(pointer:fine\)\{\s*\.kb-rasc:hover\{/);
    assert.match(CSS_KANBAN, /\.kb-rasc:has\(\.kb-abrir:active\)\{background:var\(--press\)\}/, 'o premido no dedo');
  });
});

describe('as alterações por enviar de um cartão do servidor', () => {
  test('editar: um rascunho por cartão, só com o que mudou; reaberto, o Guardar manda ao servidor só o que difere do cartão', async () => {
    const f = comFormulario();
    f.ctx.kbFormCartao('editar', KAN7());
    assert.doesNotMatch(f.d.innerHTML, /kb-rascunho/);
    assert.doesNotMatch(f.d.innerHTML, /id="kbF-coluna"/, 'editar não tem a coluna');
    preencherDoHtml(f);
    f.campos['kbF-titulo'].value = 'Novo título';
    f.ctx.kbRascunhoDoForm();
    assert.deepEqual(guardados(f)['KAN-7'].campos, { titulo: 'Novo título' }, 'sem a coluna, que o formulário não tem');
    assert.equal(novos(f).length, 0, 'não é um cartão novo');
    f.d.close();
    f.ctx.kbFormCartao('editar', KAN7());
    assert.match(f.d.innerHTML, /id="kbF-titulo"[^>]*value="Novo título"/);
    assert.match(f.d.innerHTML, /kb-rascunho/);
    assert.match(f.d.innerHTML, /id="kbJanelaOk"[^>]*>Guardar</);
    preencherDoHtml(f);
    f.ctx.kbConfirmar();
    await passa();
    assert.deepEqual(f.pedidos[0].slice(0, 2), ['PATCH', '/api/equipa/kanban/cartoes/KAN-7']);
    assert.deepEqual(f.pedidos[0][2], { titulo: 'Novo título' }, 'só o título, contra o cartão do servidor');
    assert.equal(f.ctx.localStorage.dados['kb_rascunhos:eu1'], undefined, 'guardado, o rascunho sai');
  });

  test('editar com o cartão mudado no servidor entretanto: o rascunho só repõe o que a pessoa mudou', () => {
    const f = comFormulario();
    f.ctx.kbRascunhoGuardar('KAN-7', { titulo: 'O meu título' });
    f.ctx.kbFormCartao('editar', Object.assign(KAN7(), { descricao: 'Outra pessoa mudou isto' }));
    assert.match(f.d.innerHTML, /value="O meu título"/);
    assert.match(f.d.innerHTML, />Outra pessoa mudou isto<\/textarea>/);
  });

  test('no quadro, o cartão com alterações por enviar tem o selo «Alterações por enviar»; os outros não', () => {
    const f = comFormulario();
    assert.doesNotMatch(f.ctx.kbCartaoHtml(f.ctx.kbEstado.cartoes[0]), /kb-rasc-selo/);
    f.ctx.kbRascunhoGuardar('KAN-7', { titulo: 'Outro' });
    const h = f.ctx.kbCartaoHtml(f.ctx.kbEstado.cartoes[0]);
    assert.match(h, /<div class="kb-c-pe"><span class="kb-rasc-selo"><svg class="i" data-ic="kbPorEnviar"><\/svg>Alterações por enviar<\/span>/);
    assert.match(h, /class="kb-cartao"/, 'continua um cartão do quadro (com a pega e o arrasto)');
    assert.match(h, />Velho<\/button>/, 'com o título do servidor (o rascunho não é o cartão)');
    assert.match(f.ctx.kbColunaHtml(f.ctx.kbEstado.colunas[0]), /Alterações por enviar/);
  });

  test('o cartão aberto: a linha diz que há alterações por enviar, com «Continuar a editar» e «Descartar»; sem diferença, nada', () => {
    const f = comFormulario();
    assert.equal(f.ctx.kbPainelRascHtml(KAN7()), '');
    f.ctx.kbRascunhoGuardar('KAN-7', { descricao: 'Mais texto' });
    const h = f.ctx.kbPainelRascHtml(KAN7());
    assert.match(h, /<b>Alterações por enviar<\/b>, guardadas neste aparelho hoje às \d\d:\d\d: ainda não foram para o servidor\./);
    assert.match(h, /data-acao="kbRascunhoContinuar" data-arg="KAN-7">[^]*Continuar a editar<\/button>/);
    assert.match(h, /data-acao="kbRascunhoDescartarDe" data-arg="KAN-7">Descartar<\/button>/);
    assert.match(f.ctx.kbPainelHtml({ cartao: KAN7() }, false), /<div class="kb-p-rasc" id="kbPRasc"><div class="kb-rascunho">/, 'no painel, a seguir às ações');
    assert.equal(f.ctx.kbPainelRascHtml(Object.assign(KAN7(), { descricao: 'Mais texto' })), '', 'o servidor já tem o mesmo: nada por enviar');
    f.ctx.kbDetalhe = { cartao: KAN7() };
    f.ctx.ACOES.kbRascunhoContinuar({ arg: 'KAN-7' });
    assert.match(f.d.innerHTML, /Editar KAN-7[^]*kb-rascunho[^]*>Mais texto<\/textarea>/, '«Continuar a editar» abre o Editar com o rascunho');
  });

  test('«Descartar» na linha do painel: o selo sai do quadro na hora, com o Anular; no formulário de editar, volta ao do servidor', () => {
    const f = comFormulario();
    f.ctx.kbRascunhoGuardar('KAN-7', { titulo: 'Outro' });
    f.ctx.ACOES.kbRascunhoDescartarDe({ arg: 'KAN-7' }, { closest: () => null });
    assert.equal(guardados(f)['KAN-7'], undefined);
    assert.doesNotMatch(f.q.innerHTML, /Alterações por enviar/);
    assert.match(f.aviso.innerHTML, /data-acao="kbRascunhoRepor" data-arg="KAN-7">Anular/);
    f.ctx.kbRascunhoRepor('KAN-7');
    assert.match(f.q.innerHTML, /Alterações por enviar/, 'o Anular volta a pô-lo');
    // no formulário de editar: o Descartar deixa a janela, com o que o cartão tem
    f.ctx.kbFormCartao('editar', KAN7());
    f.ctx.ACOES.kbRascunhoDescartar({});
    assert.equal(f.d.open, true);
    assert.match(f.d.innerHTML, /id="kbF-titulo"[^>]*value="Velho"/);
    assert.doesNotMatch(f.d.innerHTML, /kb-rascunho/);
    assert.equal(guardados(f)['KAN-7'], undefined);
  });
});
