// O rascunho do cartão no aparelho (KAN-105): o formulário de criar e de
// editar um cartão do kanban (worker/src/equipa-kanban-filtros.js:kbFormCartao)
// guarda no localStorage, enquanto se escreve, o que ainda não foi ao
// servidor — um rascunho para o cartão novo e um por cartão editado, só com o
// que difere do que a janela abriu. Abrir de novo volta com ele, com a linha
// que o diz e «Descartar rascunho»; o Adicionar ou o Guardar que o servidor
// aceitou apaga-o, o que falha deixa-o; caduca aos 30 dias; sem
// armazenamento, o formulário funciona como antes. Corre o guião do kanban na
// caixa dos testes dele, com um dialog e campos de mentira.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CSS_KANBAN } from '../worker/src/equipa-kanban.js';
import { caixa } from './lib/kanban-caixa.js';

const DIA = 864e5;
const ESTADO = () => ({
  colunas: [{ id: 'a-fazer', nome: 'A fazer', fim: false }, { id: 'feito', nome: 'Feito', fim: true }],
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

/* A caixa com o quadro, um dialog de mentira e os campos do formulário, que
   o teste preenche como a pessoa os escreveria (campos e rádios).
   Recebe: o (opcional) — {ls: o localStorage (null para não haver nenhum)}.
   Devolve: {ctx, d, campos, radios, pedidos, avisos}. */
function comFormulario(o = {}) {
  const ctx = caixa();
  const d = {
    open: false, innerHTML: '', returnValue: '', onclose: null, oncancel: null, style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    showModal() { d.open = true; }, close() { d.open = false; if (d.onclose) d.onclose(); },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  };
  const campos = {}, radios = {}, pedidos = [], avisos = [];
  ctx.el = (id) => (id === 'dialogo' ? d : id in campos ? campos[id] : null);
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
  ctx.resposta = () => Promise.resolve({ cartao: { chave: 'KAN-50', coluna_id: 'a-fazer' } });
  if (o.ls !== null) ctx.localStorage = o.ls || armazenamento();
  ctx.kbEstado = ESTADO();
  return { ctx, d, campos, radios, pedidos, avisos };
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
    if (!f.d.innerHTML.includes('id="' + g + '"')) continue;
    f.campos[g] = { value: '' };
    const m = new RegExp('name="' + g + '" value="([^"]*)" checked').exec(f.d.innerHTML);
    f.radios[g] = m ? m[1] : null;
  }
}
// o que está guardado no aparelho para esta pessoa
const guardados = (f) => JSON.parse(f.ctx.localStorage.dados['kb_rascunhos:eu1'] || '{}');

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
});

describe('guardar e ler no aparelho', () => {
  test('guarda por pessoa e por cartão (o novo e cada um editado), lê de volta, e apaga', () => {
    const f = comFormulario(), T = Date.now();
    f.ctx.kbRascunhoGuardar('novo', { titulo: 'A' }, T - 2000);
    f.ctx.kbRascunhoGuardar('KAN-7', { titulo: 'B' }, T - 1000);
    assert.deepEqual(Object.keys(guardados(f)).sort(), ['KAN-7', 'novo']);
    assert.equal(f.ctx.kbRascunhoLer('novo', T).campos.titulo, 'A');
    assert.equal(f.ctx.kbRascunhoLer('KAN-7', T).t, T - 1000);
    f.ctx.kbRascunhoApagar('novo');
    assert.deepEqual(Object.keys(guardados(f)), ['KAN-7']);
    f.ctx.kbRascunhoGuardar('KAN-7', {}, T);
    assert.equal(f.ctx.localStorage.dados['kb_rascunhos:eu1'], undefined, 'vazio não conta, e sem nenhum a chave sai');
  });

  test('caduca aos 30 dias: lido depois disso não volta, e sai do aparelho', () => {
    const f = comFormulario();
    f.ctx.kbRascunhoGuardar('novo', { titulo: 'velho' }, 1000);
    f.ctx.kbRascunhoGuardar('KAN-7', { titulo: 'novo' }, 1000 + 20 * DIA);
    assert.equal(f.ctx.kbRascunhoLer('novo', 1000 + 29 * DIA).campos.titulo, 'velho', 'aos 29 dias ainda está');
    assert.equal(f.ctx.kbRascunhoLer('novo', 1000 + 31 * DIA), null);
    assert.deepEqual(Object.keys(guardados(f)), ['KAN-7'], 'o caducado saiu, o outro ficou');
  });

  test('sem armazenamento (recusado ou inexistente) não rebenta: não guarda nem lê', () => {
    for (const f of [comFormulario({ ls: armazenamento(true) }), comFormulario({ ls: null })]) {
      assert.doesNotThrow(() => f.ctx.kbRascunhoGuardar('novo', { titulo: 'x' }));
      assert.equal(f.ctx.kbRascunhoLer('novo'), null);
      assert.doesNotThrow(() => f.ctx.kbRascunhoApagar('novo'));
      assert.doesNotThrow(() => f.ctx.kbFormCartao('criar', null, {}));
      assert.equal(f.d.open, true, 'o formulário abre como antes');
      assert.doesNotMatch(f.d.innerHTML, /kb-rascunho/);
    }
  });

  test('o que se guardou com lixo (não é JSON, não é um objeto) conta como nada', () => {
    const f = comFormulario();
    f.ctx.localStorage.dados['kb_rascunhos:eu1'] = '{mau';
    assert.equal(f.ctx.kbRascunhoLer('novo'), null);
    f.ctx.localStorage.dados['kb_rascunhos:eu1'] = JSON.stringify({ novo: 'texto', velho: { campos: [] } });
    assert.equal(f.ctx.kbRascunhoLer('novo'), null);
  });
});

describe('o formulário do cartão com o rascunho', () => {
  test('cartão novo: escrever guarda; fechar e abrir de novo volta com ele, com a linha e o «Descartar rascunho»', () => {
    const f = comFormulario();
    f.ctx.kbFormCartao('criar', null, {});
    assert.doesNotMatch(f.d.innerHTML, /kb-rascunho/, 'sem rascunho, sem linha');
    preencherDoHtml(f);
    f.campos['kbF-titulo'].value = 'Corrigir o aviso';
    f.radios['kbF-prioridade'] = '1';
    f.ctx.kbRascunhoDoForm();
    assert.deepEqual(guardados(f).novo.campos, { titulo: 'Corrigir o aviso', prioridade: '1' });
    f.d.close();
    assert.ok(guardados(f).novo, 'fechar a janela não o apaga');
    f.ctx.kbFormCartao('criar', null, {});
    assert.match(f.d.innerHTML, /id="kbF-titulo"[^>]*value="Corrigir o aviso"/);
    assert.match(f.d.innerHTML, /name="kbF-prioridade" value="1" checked/);
    assert.match(f.d.innerHTML, /class="kb-rascunho"[\s\S]*Descartar rascunho/);
  });

  test('o que se escreve pelo input e pelo change da janela vai para o rascunho (o ouvinte do documento)', () => {
    const f = comFormulario();
    const ouvintes = {};
    f.ctx.document.addEventListener = (t, fn) => { (ouvintes[t] = ouvintes[t] || []).push(fn); };
    f.ctx.kbRascunhoOuvir(f.ctx.document);
    f.ctx.kbFormCartao('criar', null, {});
    preencherDoHtml(f);
    f.campos['kbF-titulo'].value = 'Pelo teclado';
    const dentro = { closest: (s) => (s === '#dialogo' ? f.d : null) };
    (ouvintes.input || []).forEach((fn) => fn({ target: dentro }));
    assert.equal(guardados(f).novo.campos.titulo, 'Pelo teclado');
    f.campos['kbF-titulo'].value = 'Fora';
    (ouvintes.change || []).forEach((fn) => fn({ target: { closest: () => null } }));
    assert.equal(guardados(f).novo.campos.titulo, 'Pelo teclado', 'o que não é da janela não conta');
  });

  test('um rascunho igual ao que abriu não conta: escrever e voltar ao mesmo apaga-o, e abrir com ele igual não mostra a linha', () => {
    const f = comFormulario();
    f.ctx.kbFormCartao('criar', null, {});
    preencherDoHtml(f);
    f.campos['kbF-titulo'].value = 'x';
    f.ctx.kbRascunhoDoForm();
    assert.ok(guardados(f).novo);
    f.campos['kbF-titulo'].value = '';
    f.ctx.kbRascunhoDoForm();
    assert.equal(guardados(f).novo, undefined);
    // um guardado à mão igual ao que abre
    f.ctx.kbRascunhoGuardar('novo', { titulo: '   ', coluna: 'a-fazer' });
    f.ctx.kbFormCartao('criar', null, {});
    assert.doesNotMatch(f.d.innerHTML, /kb-rascunho/);
    assert.equal(guardados(f).novo, undefined, 'e sai do aparelho');
  });

  test('«Descartar rascunho» apaga-o e volta a abrir o formulário com o que era', () => {
    const f = comFormulario();
    f.ctx.kbRascunhoGuardar('novo', { titulo: 'Por enviar' });
    f.ctx.kbFormCartao('criar', null, {});
    assert.match(f.d.innerHTML, /value="Por enviar"/);
    f.ctx.ACOES.kbRascunhoDescartar({});
    assert.equal(guardados(f).novo, undefined);
    assert.equal(f.d.open, true, 'a janela fica, com o formulário');
    assert.doesNotMatch(f.d.innerHTML, /Por enviar|kb-rascunho/);
    assert.match(f.d.innerHTML, /id="kbF-titulo"[^>]*value=""/);
  });

  test('o Adicionar que o servidor aceitou apaga o rascunho; o que falha deixa-o', async () => {
    const f = comFormulario();
    f.ctx.kbFormCartao('criar', null, {});
    preencherDoHtml(f);
    f.campos['kbF-titulo'].value = 'Vai falhar';
    f.ctx.kbRascunhoDoForm();
    f.ctx.resposta = () => Promise.reject(new Error('O servidor não respondeu.'));
    f.ctx.kbConfirmar();
    await new Promise((r) => setImmediate(r));
    assert.equal(f.pedidos.length, 1, 'foi ao servidor');
    assert.equal(guardados(f).novo.campos.titulo, 'Vai falhar', 'a falha deixa o rascunho');
    assert.equal(f.d.open, true, 'e a janela aberta');
    f.ctx.resposta = () => Promise.resolve({ cartao: { chave: 'KAN-50', coluna_id: 'a-fazer' } });
    f.ctx.kbConfirmar();
    await new Promise((r) => setImmediate(r));
    assert.equal(f.pedidos.length, 2);
    assert.equal(f.pedidos[1][2].titulo, 'Vai falhar');
    assert.equal(f.ctx.localStorage.dados['kb_rascunhos:eu1'], undefined, 'aceite, o rascunho sai');
  });

  test('editar: um rascunho por cartão, só com o que mudou; reaberto, o Guardar manda ao servidor só o que difere do cartão', async () => {
    const f = comFormulario();
    f.ctx.kbFormCartao('editar', KAN7());
    assert.doesNotMatch(f.d.innerHTML, /kb-rascunho/);
    assert.doesNotMatch(f.d.innerHTML, /id="kbF-coluna"/, 'editar não tem a coluna');
    preencherDoHtml(f);
    f.campos['kbF-titulo'].value = 'Novo título';
    f.ctx.kbRascunhoDoForm();
    assert.deepEqual(guardados(f)['KAN-7'].campos, { titulo: 'Novo título' }, 'sem a coluna, que o formulário não tem');
    assert.equal(guardados(f).novo, undefined, 'o do cartão novo é outro');
    f.d.close();
    f.ctx.kbFormCartao('editar', KAN7());
    assert.match(f.d.innerHTML, /id="kbF-titulo"[^>]*value="Novo título"/);
    assert.match(f.d.innerHTML, /kb-rascunho/);
    preencherDoHtml(f);
    f.ctx.kbConfirmar();
    await new Promise((r) => setImmediate(r));
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

  test('o CSS da linha do rascunho: tokens, e a classe kb-', () => {
    const regra = /\.kb-rascunho\{[^}]*\}/.exec(CSS_KANBAN);
    assert.ok(regra, 'a linha tem estilo');
    assert.doesNotMatch(regra[0], /#[0-9a-f]{3,6}\b|rgb|hsl/i);
  });
});
