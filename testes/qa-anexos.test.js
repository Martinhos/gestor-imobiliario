// Os anexos da pílula «Tickets» (KAN-165: «Devo poder anexar imagens ou
// documentos aos tickets no pill. Responder a tickets com imagens ou
// ficheiros.»), contra o SQL a sério (testes/lib/bd.js) com as migrações até
// à 0034. O servidor: em produção (sem ENV_NAME) as rotas não existem; um
// ficheiro entra no cartão do ticket no kanban pela porta do kanban (os tipos
// lidos dos bytes e nunca do Content-Type nem do nome: PNG, PDF entram; HTML,
// SVG e executáveis ficam à porta com 415; vazio 400; acima de 10 MB 413) e
// sai com a caixa de areia, nosniff, sem cache e, num documento, em
// attachment; um anexo de outro cartão não se lê; o comentário só com
// anexos diz quantos; o anexo de uma resposta fica ligado ao comentário (e
// só a um comentário vivo, deste cartão e de quem anexa); a conversa traz os
// anexos de cada comentário e os do cartão; o teto de 50 por cartão; um
// cartão sem ticket e o back office pelas mesmas rotas; o cartão de um
// pedido nunca. O cliente (web/cloud/qa.js): o HTML dos escolhidos e dos
// anexos (miniaturas, documentos com o tipo e o tamanho, sem style= nem
// on…=, com o nome escapado), o que se recusa logo no seletor, o envio do
// ticket com os anexos (e só os que faltam outra vez) e a resposta só com
// anexos.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { ambiente, conta, pedir, resp } from './lib/api.js';
import { chamar, MASTER } from './lib/equipa.js';
import { handleApi } from '../worker/src/api.js';
import { CSP_ANEXO } from '../worker/src/lib/http.js';
import { textoDoComentario, TETO_ANEXOS_CARTAO } from '../worker/src/rotas/qa.js';
import { carregarTudo, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';

const txt = (s) => new TextEncoder().encode(s);
// uma imagem PNG de 1×1, a mesma dos outros testes do QA
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));
// um PDF mínimo: o que conta é a assinatura do começo
const PDF = txt('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const HTML = txt('<!doctype html><html><body><script>fetch("/api/qa")</script></body></html>');
const SVG = txt('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00]);

/* Sobe um ficheiro como a pílula sobe: PUT com os bytes, o Content-Type dado, o nome em X-Nome e, numa resposta, o X-Comentario.
   Recebe: env; quem — a conta; id — o item (ticket ou KAN-N); bytes; o — {tipo, nome, comentario, tamanhoDito}.
   Devolve: a promessa de {status, ...o JSON}. */
function anexar(env, quem, id, bytes, o = {}) {
  const h = { Authorization: 'Bearer ' + quem.token, 'Content-Type': o.tipo || 'application/octet-stream', 'Content-Length': String(o.tamanhoDito || bytes.byteLength) };
  if (o.nome) h['X-Nome'] = encodeURIComponent(o.nome);
  if (o.comentario) h['X-Comentario'] = o.comentario;
  return resp(handleApi(new Request('https://app.x.pt/api/qa/' + id + '/anexos', { method: 'PUT', headers: h, body: bytes }), env, { waitUntil() {} }));
}

/* Um ticket novo de quem, e o id dele.
   Recebe: env; quem; texto. Devolve: a promessa do id. */
async function ticket(env, quem, texto = 'O botão não responde') {
  const r = await resp(pedir(env, quem, '/api/qa', 'POST', { body: texto, severity: 'incomoda' }));
  assert.equal(r.status, 201);
  return r.id;
}

/* ------------------------------------------------------------- servidor */

describe('os anexos da pílula no servidor (KAN-165)', () => {
  test('em produção (sem ENV_NAME) as rotas dos anexos não existem', async () => {
    const env = ambiente({ ENV_NAME: undefined });
    const a = await conta(env, 'Ana');
    for (const [m, c] of [['PUT', '/api/qa/x1/anexos'], ['GET', '/api/qa/x1/anexos/y1'], ['PUT', '/api/qa/KAN-3/anexos']]) {
      assert.equal((await pedir(env, a, c, m, m === 'PUT' ? 'x' : undefined)).status, 404, m + ' ' + c);
    }
  });

  test('uma imagem e um PDF entram no cartão do ticket, com o tipo lido dos bytes (o Content-Type e o nome não contam)', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = await ticket(env, a);
    const img = await anexar(env, a, id, PNG, { tipo: 'image/png', nome: 'ecrã do recibo.png' });
    assert.equal(img.status, 201);
    assert.deepEqual([img.anexo.nome, img.anexo.tipo, img.anexo.imagem, img.anexo.comentario_id, img.anexo.tamanho], ['ecrã do recibo.png', 'image/png', true, null, PNG.byteLength]);
    assert.ok(!('url' in img.anexo), 'sem o endereço do back office');
    // o PDF a dizer-se imagem, com um nome sem extensão: entra como PDF e ganha a extensão
    const pdf = await anexar(env, a, id, PDF, { tipo: 'image/png', nome: 'fatura' });
    assert.equal(pdf.status, 201);
    assert.deepEqual([pdf.anexo.tipo, pdf.anexo.nome, pdf.anexo.imagem], ['application/pdf', 'fatura.pdf', false]);
    const linhas = (await env.DB.prepare("SELECT a.chave, a.cartao_id, k.origem_id FROM kanban_anexos a JOIN kanban_cartoes k ON k.id = a.cartao_id ORDER BY a.created_at, a.rowid").all()).results;
    assert.equal(linhas.length, 2);
    assert.ok(linhas.every((l) => l.origem_id === id && l.chave === 'kanban/' + l.cartao_id + '/' + (l.chave.split('/')[2])), 'no cartão do ticket, no R2 do kanban');
    const hist = (await env.DB.prepare("SELECT depois FROM kanban_historico WHERE campo = 'anexo' ORDER BY id").all()).results.map((h) => h.depois);
    assert.deepEqual(hist, ['ecrã do recibo.png', 'fatura.pdf'], 'a linha «anexo» no histórico do cartão');
    const item = (await resp(pedir(env, a, '/api/qa'))).tickets.find((t) => t.id === id);
    assert.equal(item.anexos, 2, 'a lista diz quantos');
  });

  test('HTML, SVG e executáveis ficam à porta (415) mesmo a dizerem-se PDF; vazio 400; acima de 10 MB 413', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = await ticket(env, a);
    for (const [bytes, nome] of [[HTML, 'nota.pdf'], [SVG, 'logo.png'], [EXE, 'programa.pdf']]) {
      const r = await anexar(env, a, id, bytes, { tipo: 'application/pdf', nome });
      assert.equal(r.status, 415, nome);
      assert.match(r.error, /aceitam-se imagens \(PNG, JPEG, WebP\), PDF/);
    }
    assert.equal((await anexar(env, a, id, new Uint8Array(0), { nome: 'vazio.pdf' })).status, 400);
    assert.equal((await anexar(env, a, id, PDF, { nome: 'grande.pdf', tamanhoDito: 10 * 1024 * 1024 + 1 })).status, 413, 'pelo tamanho dito');
    const grande = new Uint8Array(10 * 1024 * 1024 + 1);
    grande.set(PDF);
    assert.equal((await anexar(env, a, id, grande, { nome: 'grande.pdf', tamanhoDito: 100 })).status, 413, 'pelos bytes lidos, mesmo a mentir no tamanho');
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM kanban_anexos').first()).n, 0, 'nada entrou');
  });

  test('servir: os mesmos bytes, sem cache, na caixa de areia e com nosniff; o documento em attachment; o de outro cartão não', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana'), b = await conta(env, 'Bruno');
    const id = await ticket(env, a), outro = await ticket(env, b, 'Outro');
    const img = (await anexar(env, a, id, PNG, { tipo: 'image/png', nome: 'a.png' })).anexo;
    const pdf = (await anexar(env, a, id, PDF, { nome: 'b.pdf' })).anexo;
    const g = await pedir(env, b, '/api/qa/' + id + '/anexos/' + img.id);
    assert.equal(g.status, 200, 'qualquer conta do dev lê, como os tickets');
    assert.deepEqual(new Uint8Array(await g.arrayBuffer()), PNG);
    assert.equal(g.headers.get('Content-Type'), 'image/png');
    assert.equal(g.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(g.headers.get('Content-Security-Policy'), CSP_ANEXO);
    assert.equal(g.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(g.headers.get('Content-Disposition'), null, 'a imagem abre no sítio');
    const d = await pedir(env, a, '/api/qa/' + id + '/anexos/' + pdf.id);
    assert.equal(d.headers.get('Content-Type'), 'application/pdf');
    assert.match(d.headers.get('Content-Disposition'), /^attachment; filename="b\.pdf"/);
    assert.equal((await pedir(env, a, '/api/qa/' + outro + '/anexos/' + img.id)).status, 404, 'pelo ticket errado');
    assert.equal((await pedir(env, a, '/api/qa/' + id + '/anexos/nao-existe')).status, 404);
    assert.equal((await pedir(env, a, '/api/qa/' + id + '/outra/coisa')).status, 404, 'só os anexos têm cinco pedaços');
  });

  test('responder só com anexos: o comentário diz quantos; os anexos ficam nele e a conversa trá-los, à parte dos do ticket', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = await ticket(env, a);
    await anexar(env, a, id, PDF, { nome: 'do-ticket.pdf' });
    assert.equal((await resp(pedir(env, a, '/api/qa/' + id + '/comentarios', 'POST', { texto: '  ' }))).status, 400, 'sem texto e sem anexos');
    assert.equal((await resp(pedir(env, a, '/api/qa/' + id + '/comentarios', 'POST', { texto: '', anexos: 11 }))).status, 400, 'mais do que dez não conta');
    const c = await resp(pedir(env, a, '/api/qa/' + id + '/comentarios', 'POST', { texto: '', anexos: 2 }));
    assert.equal(c.status, 201);
    assert.equal(c.comentario.texto, 'Anexei 2 ficheiros.');
    const um = await resp(pedir(env, a, '/api/qa/' + id + '/comentarios', 'POST', { texto: 'Olha isto', anexos: 1 }));
    assert.equal(um.comentario.texto, 'Olha isto', 'com texto, o texto');
    const r1 = await anexar(env, a, id, PNG, { tipo: 'image/png', nome: 'ecra.png', comentario: c.comentario.id });
    const r2 = await anexar(env, a, id, PDF, { nome: 'fatura.pdf', comentario: c.comentario.id });
    assert.deepEqual([r1.status, r1.anexo.comentario_id, r2.anexo.comentario_id], [201, c.comentario.id, c.comentario.id]);
    const conv = await resp(pedir(env, a, '/api/qa/' + id + '/comentarios'));
    assert.deepEqual(conv.anexos.map((x) => x.nome), ['do-ticket.pdf'], 'os do ticket à parte');
    const lido = conv.comentarios.find((x) => x.id === c.comentario.id);
    assert.deepEqual(lido.anexos.map((x) => [x.nome, x.imagem]), [['ecra.png', true], ['fatura.pdf', false]]);
    assert.deepEqual(conv.comentarios.find((x) => x.id === um.comentario.id).anexos, []);
    // o comentário removido no kanban leva os anexos da vista da pílula
    await env.DB.prepare('UPDATE kanban_comentarios SET removed_at = 1 WHERE id = ?').bind(c.comentario.id).run();
    const depois = await resp(pedir(env, a, '/api/qa/' + id + '/comentarios'));
    assert.deepEqual(depois.anexos.map((x) => x.nome), ['do-ticket.pdf']);
  });

  test('o X-Comentario: só um comentário vivo deste cartão, e de quem anexa', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana'), b = await conta(env, 'Bruno');
    const id = await ticket(env, a), outro = await ticket(env, a, 'Outro');
    const c = (await resp(pedir(env, a, '/api/qa/' + id + '/comentarios', 'POST', { texto: 'Meu' }))).comentario;
    const doOutro = (await resp(pedir(env, a, '/api/qa/' + outro + '/comentarios', 'POST', { texto: 'Noutro' }))).comentario;
    assert.equal((await anexar(env, b, id, PNG, { tipo: 'image/png', comentario: c.id })).status, 403, 'o comentário de outra pessoa');
    assert.equal((await anexar(env, a, id, PNG, { tipo: 'image/png', comentario: doOutro.id })).status, 404, 'o comentário de outro ticket');
    assert.equal((await anexar(env, a, id, PNG, { tipo: 'image/png', comentario: 'x y' })).status, 404, 'um id que nem tem forma');
    await env.DB.prepare('UPDATE kanban_comentarios SET removed_at = 1 WHERE id = ?').bind(c.id).run();
    assert.equal((await anexar(env, a, id, PNG, { tipo: 'image/png', comentario: c.id })).status, 404, 'removido');
  });

  test('o teto: 50 anexos por cartão (409), e o cartão removido no kanban não recebe (409)', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const id = await ticket(env, a);
    const k = await env.DB.prepare("SELECT id FROM kanban_cartoes WHERE origem_tipo = 'qa' AND origem_id = ?").bind(id).first();
    for (let i = 0; i < TETO_ANEXOS_CARTAO; i++) {
      await env.DB.prepare("INSERT INTO kanban_anexos (id, cartao_id, chave, nome, tipo, tamanho, autor_id, created_at) VALUES (?, ?, 'x', 'n.pdf', 'application/pdf', 1, 'a', 1)").bind('z' + i, k.id).run();
    }
    const r = await anexar(env, a, id, PDF, { nome: 'mais.pdf' });
    assert.equal(r.status, 409);
    assert.match(r.error, /já tem 50 anexos/);
    const id2 = await ticket(env, a, 'Dois');
    await env.DB.prepare("UPDATE kanban_cartoes SET removed_at = 1 WHERE origem_tipo = 'qa' AND origem_id = ?").bind(id2).run();
    assert.equal((await anexar(env, a, id2, PDF, { nome: 'x.pdf' })).status, 409, 'sem cartão vivo os anexos não têm onde ficar');
  });

  test('um cartão sem ticket anexa pela chave; o de um pedido nunca (404)', async () => {
    const env = ambiente();
    const a = await conta(env, 'Ana');
    const criado = await (await chamar(env, MASTER, 'POST', '/api/equipa/kanban/cartoes', { tipo: 'erro', titulo: 'Um erro sem ticket' })).json();
    const chave = criado.cartao.chave;
    const r = await anexar(env, a, chave, PDF, { nome: 'log.pdf' });
    assert.equal(r.status, 201);
    assert.equal((await pedir(env, a, '/api/qa/' + chave + '/anexos/' + r.anexo.id)).status, 200);
    const conv = await resp(pedir(env, a, '/api/qa/' + chave + '/comentarios'));
    assert.deepEqual(conv.anexos.map((x) => x.nome), ['log.pdf']);
    const pedido = await (await chamar(env, MASTER, 'POST', '/api/equipa/kanban/cartoes', { tipo: 'tarefa', titulo: 'Um pedido', etiquetas: ['suporte'] })).json();
    assert.equal((await anexar(env, a, pedido.cartao.chave, PDF, { nome: 'x.pdf' })).status, 404);
  });

  test('textoDoComentario: aparado, só com anexos diz quantos, e as recusas', () => {
    assert.deepEqual(textoDoComentario({ texto: ' a\r\nb ' }), { texto: 'a\nb' });
    assert.deepEqual(textoDoComentario({ texto: '', anexos: 1 }), { texto: 'Anexei um ficheiro.' });
    assert.deepEqual(textoDoComentario({ anexos: 3 }), { texto: 'Anexei 3 ficheiros.' });
    assert.equal(textoDoComentario({ texto: '', anexos: 0 }).recusa.status, 400);
    assert.equal(textoDoComentario({ texto: '', anexos: '2' }).recusa.status, 400, 'só um inteiro');
    assert.equal(textoDoComentario({ texto: 'x'.repeat(4001) }).recusa.status, 400);
    assert.equal(textoDoComentario(null).recusa.status, 400);
  });
});

/* --------------------------------------------------------------- cliente */

const app = carregarTudo();
afterEach(() => repor(app));
afterEach(() => vm.runInContext('qaRascunho=null;qaCamadaTicket=null;qaOcupado={};modalStack.length=0;CW.ambiente="producao";CW.user=null;', app.__ctx));

describe('os anexos da pílula no cliente (KAN-165)', () => {
  test('o HTML dos anexos: miniaturas para as imagens, documentos com o tipo e o tamanho, sem style= nem on…=, com o nome escapado', () => {
    const h = app.qaHtmlAnexos([
      { id: 'a1', nome: 'ecra<b>.png', tipo: 'image/png', tamanho: 2048, imagem: true },
      { id: 'a2', nome: 'fatura".pdf', tipo: 'application/pdf', tamanho: 2.5 * 1024 * 1024, imagem: false },
      { id: 'a3', nome: 'contas.xlsx', tipo: 'x', tamanho: 10, imagem: false },
    ], 'Anexos do ticket');
    assert.match(h, /<div class="qa-anexos" role="group" aria-label="Anexos do ticket">/);
    assert.match(h, /<button type="button" class="qa-anexo-img" data-toca="camada" data-click="qaVerAnexo\('a1'\)" aria-label="Ver a imagem ecra&lt;b&gt;\.png"><span class="qa-anexo-mini a-carregar" data-anx="a1"><\/span><\/button>/);
    assert.match(h, /data-click="qaAbrirAnexo\('a2'\)"[\s\S]*fatura&quot;\.pdf<\/span><span class="small">PDF · 2,5 MB<\/span>/);
    assert.match(h, /contas\.xlsx<\/span><span class="small">Excel · 1 KB<\/span>/);
    assert.doesNotMatch(h, /style=|\son[a-z]+=/i);
    assert.equal(app.qaHtmlAnexos([], 'x'), '');
    assert.equal(app.qaHtmlAnexos(undefined, 'x'), '');
  });

  test('o «Novo ticket» tem a caixa dos anexos, e o campo de comentar o «Anexar» ao lado do «Comentar»', () => {
    app.CW.ambiente = 'percurso';
    const novo = app.qaHtmlNovo({ ecra: {} });
    assert.match(novo, /<div class="flabel" id="qa_anx_rot">Anexos<\/div>[\s\S]*Anexar ficheiros<\/button><p class="hint">Imagens, PDF, Word, Excel, PowerPoint, texto ou CSV, até 10 MB cada e 10 de uma vez\.<\/p>/);
    assert.match(novo, /<input type="file" id="qa_anx_in" multiple accept="[^"]*\.pdf,\.docx,\.xlsx,\.pptx,\.txt,\.log,\.csv" class="u-d-none" data-change="qaEscolheuAnexos\(this,'novo'\)">/);
    const com = app.qaHtmlComentar();
    assert.match(com, /<div class="qa-comentar-acoes"><button type="button" class="btn" id="qa_com_anexar"[^>]*>[\s\S]*Anexar<\/button><button type="button" class="btn" id="qa_com_btn"/);
    assert.doesNotMatch(novo + com, /style=|\son[a-z]+=/i);
  });

  test('o tamanho e o tipo legíveis, e o nome de uma imagem encolhida', () => {
    assert.equal(app.qaTamanhoLegivel(10), '1 KB');
    assert.equal(app.qaTamanhoLegivel(120 * 1024), '120 KB');
    assert.equal(app.qaTamanhoLegivel(1.25 * 1024 * 1024), '1,3 MB');
    assert.equal(app.qaMetaDoAnexo('a.DOCX', 2048), 'Word · 2 KB');
    assert.equal(app.qaMetaDoAnexo('sem-extensao', 2048), 'Ficheiro · 2 KB');
    assert.equal(app.qaNomeComTipo('foto.HEIC', 'image/webp'), 'foto.webp');
    assert.equal(app.qaNomeComTipo('ecra', 'image/jpeg'), 'ecra.jpg');
  });

  test('o seletor recusa logo o que não entra (tipo, tamanho, mais de dez) e junta os documentos', async () => {
    app.CW.ambiente = 'percurso';
    vm.runInContext('qaRascunho={anexos:[],camada:null};', app.__ctx);
    const doc = (nome, size) => ({ name: nome, type: '', size });
    await app.qaJuntarAnexos('novo', [doc('a.pdf', 100), doc('b.exe', 100), doc('c.pdf', 11 * 1024 * 1024), doc('d.csv', 5)]);
    const lista = vm.runInContext('qaRascunho.anexos', app.__ctx);
    assert.deepEqual(Array.from(lista, (a) => [a.nome, a.estado, a.imagem]), [['a.pdf', 'pronto', false], ['d.csv', 'pronto', false]]);
    const muitos = [];
    for (let i = 0; i < 12; i++) muitos.push(doc('m' + i + '.txt', 1));
    await app.qaJuntarAnexos('novo', muitos);
    assert.equal(vm.runInContext('qaRascunho.anexos.length', app.__ctx), 10, 'até dez de uma vez');
    app.qaRemoverEscolhido('novo', lista[0].chave);
    assert.equal(vm.runInContext('qaRascunho.anexos.length', app.__ctx), 9);
  });

  test('enviar um ticket com anexos: o POST, e depois um PUT por anexo; se um falha, «Enviar os anexos» sobe só esse', async () => {
    const pedidos = apiFalsa({ 'POST /api/qa': { ok: true, id: 'T1' } });
    const envios = [];
    let falha = 'b.pdf';
    app.fetch = (url, o) => {
      envios.push([url, o.headers['X-Nome'], o.headers['X-Comentario']]);
      const nome = decodeURIComponent(o.headers['X-Nome'] || '');
      return Promise.resolve(nome === falha
        ? { ok: false, status: 415, json: () => Promise.resolve({ error: 'Esse ficheiro não entra.' }) }
        : { ok: true, status: 201, json: () => Promise.resolve({ anexo: { id: 'x' } }) });
    };
    const avisos = [];
    app.toast = (m) => avisos.push(m);
    janelasFalsas(app, 'render', 'save');
    noDev();
    app.qaNovoTicket();
    app.document.getElementById('qa_desc').value = 'Com anexos';
    await app.qaJuntarAnexos('novo', [ficheiro('a.pdf', 'application/pdf'), ficheiro('b.pdf', 'application/pdf')]);
    assert.equal(await app.qaEnviar(), false);
    assert.equal(pedidos.filter((p) => p[0] === 'POST').length, 1);
    assert.deepEqual(envios.map((e) => [e[0], e[1]]), [['/api/qa/T1/anexos', 'a.pdf'], ['/api/qa/T1/anexos', 'b.pdf']]);
    assert.ok(envios.every((e) => e[2] === undefined), 'os do ticket sem comentário');
    assert.match(app.document.getElementById('qa_e').textContent, /^O ticket ficou guardado, mas o anexo «b\.pdf» não subiu: Esse ficheiro não entra\. Toca em «Enviar os anexos»/);
    assert.equal(app.document.getElementById('qa_enviar').textContent, 'Enviar os anexos');
    falha = '';
    assert.equal(await app.qaEnviar(), true);
    assert.equal(pedidos.filter((p) => p[0] === 'POST').length, 1, 'nunca um ticket repetido');
    assert.deepEqual(envios.slice(2).map((e) => e[1]), ['b.pdf'], 'só o que faltava');
    assert.equal(avisos[avisos.length - 1], 'Ticket enviado, com 2 anexos.');
  });

  test('responder só com um anexo: o POST diz quantos, o comentário provisório diz «Anexei um ficheiro.», e o PUT leva o X-Comentario', async () => {
    const pedidos = apiFalsa({
      'GET /api/qa': { colunas: [], tickets: [{ id: 'C1', cartao: 'KAN-9', ticket: true, status: 'a-fazer', titulo: 'x', body: 'x', created_at: 1, updated_at: 1, autor: { id: 'u2', nome: 'Rui' } }] },
      'GET /api/qa/:id/comentarios': { comentarios: [], anexos: [] },
      'POST /api/qa/:id/comentarios': (d) => {
        noPedido = { lista: app.qaCamadaTicket.el.querySelector('.qa-coms-lista').innerHTML };
        return { ok: true, coluna: 'a-fazer', comentario: { id: 'srv1', autor: { id: 'u1', nome: 'Maria Costa' }, texto: d.texto || 'Anexei um ficheiro.', created_at: 9, meu: true } };
      },
    });
    let noPedido = null, falhar = true;
    const envios = [];
    app.fetch = (url, o) => {
      envios.push([url, o.headers['X-Comentario']]);
      return Promise.resolve(falhar
        ? { ok: false, status: 500, json: () => Promise.resolve({ error: 'Erro 500.' }) }
        : { ok: true, status: 201, json: () => Promise.resolve({ anexo: { id: 'z' } }) });
    };
    app.toast = () => {};
    janelasFalsas(app, 'render', 'save');
    noDev();
    await app.qaCarregar();
    app.qaAbrirTicket('C1');
    await new Promise((r) => setTimeout(r, 0));
    await app.qaJuntarAnexos('com', [ficheiro('log.txt', 'text/plain')]);
    assert.equal(await app.qaComentar(), false, 'o comentário ficou, mas o anexo falhou');
    assert.deepEqual(pedidos.find((p) => p[0] === 'POST').slice(1), ['/api/qa/C1/comentarios', { texto: '', anexos: 1 }]);
    assert.match(noPedido.lista, /<p class="qa-com-txt">Anexei um ficheiro\.<\/p><p class="small qa-com-a-anexar">[\s\S]*log\.txt<\/p>/, 'o provisório diz o que leva');
    assert.deepEqual(envios, [['/api/qa/C1/anexos', 'srv1']]);
    assert.equal(app.document.getElementById('qa_com_btn').textContent, 'Enviar os anexos');
    assert.match(app.document.getElementById('qa_com_anx_erro').textContent, /^O comentário ficou, mas o anexo «log\.txt» não subiu: Erro 500\./);
    falhar = false;
    assert.equal(await app.qaComentar(), true, '«Enviar os anexos» sobe só o anexo, no mesmo comentário');
    assert.equal(pedidos.filter((p) => p[0] === 'POST').length, 1, 'sem um comentário repetido');
    assert.deepEqual(envios[1], ['/api/qa/C1/anexos', 'srv1']);
    assert.equal(app.document.getElementById('qa_com_btn').textContent, 'Comentar');
    assert.equal(vm.runInContext('qaCamadaTicket.qaEscolhidos.length', app.__ctx), 0, 'a caixa esvaziou-se');
  });
});

/* A sessão de uma conta no ambiente de desenvolvimento. Devolve: nada. */
function noDev() {
  app.CW.ambiente = 'percurso';
  app.CW.user = { id: 'u1', name: 'Maria Costa', email: 'maria@rendorium.test' };
}

/* Uma API simulada: guarda cada pedido e responde pelo que o teste disser.
   Recebe: respostas — {'MÉTODO /caminho': valor ou função(dados)} (o caminho
   sem o id também serve, com «:id»).
   Devolve: a lista dos pedidos feitos ([método, caminho, dados]). */
function apiFalsa(respostas = {}) {
  const pedidos = [];
  app.api = (m, p, d) => {
    pedidos.push([m, p, d === undefined ? undefined : JSON.parse(JSON.stringify(d))]);
    const chave = m + ' ' + p, geral = m + ' ' + p.replace(/\/api\/qa\/[^/]+/, '/api/qa/:id');
    const r = chave in respostas ? respostas[chave] : geral in respostas ? respostas[geral] : (m === 'GET' ? { tickets: [] } : { ok: true });
    return Promise.resolve(typeof r === 'function' ? r(d) : r);
  };
  return pedidos;
}

/* Um ficheiro escolhido no seletor (um Blob com nome).
   Recebe: nome; tipo. Devolve: o Blob. */
function ficheiro(nome, tipo) {
  return Object.assign(new Blob(['conteúdo de ' + nome], { type: tipo }), { name: nome });
}
