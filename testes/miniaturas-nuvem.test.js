// As miniaturas de 220px chegam à nuvem, e o outro aparelho já não descarrega
// os originais para pintar as caixas das fotos:
// - a miniatura sobe com a foto (depois do original), para a chave do R2
//   derivada do id, sem linha em files e sem gastar o travão 'up:';
// - o GET dela segue as regras do original (dono, comproprietário, cargo com
//   file.view), e só a escreve quem pode apagar a foto;
// - noutro aparelho o thumbSrc pede a miniatura ao servidor e não o original;
//   sem ela lá, cai no original e sobe a que fez, uma vez;
// - sai com a foto: o DELETE, a varredura das casas apagadas;
// - uma foto que acaba de subir depois de a casa ser gravada fica presa a ela
//   (o comproprietário vê-a), e o subirPendentes não volta a subir o que já
//   subiu nesta sessão, e volta a tentar a miniatura que não chegou;
// - o arranque não deita fora as miniaturas guardadas.
// O cliente corre inteiro (carregarTudo) com o fetch ligado ao servidor a
// sério, contra a D1 de teste (testes/lib/bd.js): dois contextos são dois
// aparelhos, cada um com o seu IndexedDB.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { carregarTudo } from './arnes.js';
import { ambiente, conta, pedir, resp, casa, registo, comproprietario, cargo, darCargo } from './lib/api.js';
import { handleApi } from '../worker/src/api.js';
import { varrerAnexos, chaveDaMiniatura } from '../worker/src/files.js';
import { CSP_ANEXO } from '../worker/src/lib/http.js';
import { purgeAccount } from '../worker/src/lib/acesso.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const espera = (ms = 0) => new Promise((r) => setTimeout(r, ms));
/* Espera que uma condição se cumpra (os uploads correm em fundo). */
async function ate(cond, msg, ms = 3000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await cond()) return; await espera(5); }
  assert.fail('não aconteceu: ' + msg);
}

const JPEG = (n, marca = 7) => new Uint8Array(n).fill(marca);
const ORIGINAL = 2_000_000;   // uma foto de câmara (2 MB)
const MINI = 9_000;           // a miniatura de 220px

/* Um anexo carregado pela API, como o cliente o carrega.
   Recebe: env; quem; id; bytes; tipo; casaId (opcional). */
const carregar = (env, quem, id, bytes = JPEG(ORIGINAL), tipo = 'image/jpeg', casaId) =>
  handleApi(new Request('https://app.x.pt/api/files/' + id + (casaId ? '?casa=' + casaId : ''), {
    method: 'PUT', body: bytes,
    headers: { Authorization: 'Bearer ' + quem.token, 'X-Ficheiro-Tipo': tipo, 'X-Ficheiro-Nome': 'IMG.jpg' },
  }), env, { waitUntil() {} });
/* A miniatura subida pela API. */
const subirMini = (env, quem, id, bytes = JPEG(MINI, 3), tipo = 'image/jpeg') =>
  handleApi(new Request('https://app.x.pt/api/files/' + id + '/miniatura', {
    method: 'PUT', body: bytes, headers: { Authorization: 'Bearer ' + quem.token, 'X-Ficheiro-Tipo': tipo },
  }), env, { waitUntil() {} });
const verMini = (env, quem, id) => pedir(env, quem, '/api/files/' + id + '/miniatura');
const linhas = async (env) => (await env.DB.prepare('SELECT * FROM files ORDER BY id').all()).results;
/* Um anexo preso a uma casa, escrito direto na base (como depois de gravar). */
async function anexoNaCasa(env, id, dono, houseId, kind = 'house.photos') {
  await env.FILES.put(id, JPEG(ORIGINAL));
  await env.DB.prepare(
    `INSERT INTO files (id, owner_id, house_id, name, type, size, created_at, record_kind, record_id)
     VALUES (?, ?, ?, 'IMG.jpg', 'image/jpeg', ?, ?, ?, ?)`
  ).bind(id, dono.id, houseId, ORIGINAL, Date.now(), kind, houseId).run();
}

/* Um aparelho: a app inteira com a nuvem, com sessão nesta conta, o
   IndexedDB num Map e o fetch ligado ao servidor de teste. Conta os pedidos e
   os bytes que descem. `segurar(pedido)` devolve uma promessa para atrasar um
   pedido (o upload que acaba depois da gravação).
   Recebe: env; quem — a conta.
   Devolve: {app, idb, pedidos, segurar}. */
function aparelho(env, quem) {
  const app = carregarTudo();
  const idb = new Map();
  const ap = { app, idb, pedidos: [], segurar: null };
  app._idbPut = (id, b) => { idb.set(id, b); return Promise.resolve(); };
  app._idbGet = (id) => Promise.resolve(idb.get(id));
  app._idbDel = (id) => { idb.delete(id); return Promise.resolve(); };
  app.makeThumb = () => Promise.resolve(new Blob([JPEG(MINI, 3)], { type: 'image/jpeg' }));
  app.toast = () => {};
  app.CW.user = { id: quem.id, token: quem.token, name: quem.name };
  app.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const p = { method, url, status: 0, bytes: 0 };
    ap.pedidos.push(p);
    if (ap.segurar) await ap.segurar(p);
    const r = await handleApi(new Request('https://app.x.pt' + url, { method, headers: opts.headers, body: opts.body }), env, { waitUntil() {} });
    const buf = await r.arrayBuffer();
    p.status = r.status; p.bytes = buf.byteLength;
    return new Response(buf.byteLength ? buf : null, { status: r.status, headers: r.headers });
  };
  return ap;
}
const desceram = (ap) => ap.pedidos.filter((p) => p.method === 'GET').reduce((a, p) => a + p.bytes, 0);

/* ----------------------------------------------------------- no servidor */

describe('a miniatura no servidor', () => {
  test('vê-a quem vê a foto, e só esse: dono, comproprietário, cargo com file.view', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono'), P = await conta(env, 'Parceiro'), C = await conta(env, 'Colab'), X = await conta(env, 'Estranho');
    await casa(env, D, 'H1');
    await comproprietario(env, D, P, ['H1']);
    await anexoNaCasa(env, 'F1', D, 'H1');
    assert.equal((await subirMini(env, D, 'F1')).status, 200);
    const r = await verMini(env, D, 'F1');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Content-Type'), 'image/jpeg');
    assert.equal(r.headers.get('Content-Security-Policy'), CSP_ANEXO, 'em caixa de areia, como o original');
    assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal((await r.arrayBuffer()).byteLength, MINI);
    assert.equal((await verMini(env, P, 'F1')).status, 200, 'o comproprietário');
    assert.equal((await verMini(env, X, 'F1')).status, 404, 'quem não vê a foto não vê a miniatura');
    const soVisitas = await cargo(env, D, 'Visitas', ['visit.view', 'visit.add'], 'R_V');
    await darCargo(env, D, C, soVisitas, ['H1']);
    assert.equal((await verMini(env, C, 'F1')).status, 404, 'cargo sem file.view');
    const comFotos = await cargo(env, D, 'Fotos', ['file.view'], 'R_F');
    await darCargo(env, D, C, comFotos, ['H1']);
    assert.equal((await verMini(env, C, 'F1')).status, 200, 'cargo com file.view');
    // sem miniatura no servidor: 404, e o cliente cai no original
    await anexoNaCasa(env, 'F2', D, 'H1');
    assert.equal((await verMini(env, D, 'F2')).status, 404);
  });

  test('escreve-a quem pode apagar a foto: o colaborador só nas que ele carregou', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono'), P = await conta(env, 'Parceiro'), C = await conta(env, 'Colab');
    await casa(env, D, 'H1');
    await comproprietario(env, D, P, ['H1']);
    await anexoNaCasa(env, 'F1', D, 'H1');
    const fotos = await cargo(env, D, 'Fotos', ['file.view', 'file.add'], 'R_F');
    await darCargo(env, D, C, fotos, ['H1']);
    assert.equal((await subirMini(env, C, 'F1', JPEG(MINI, 9))).status, 403, 'não troca a cara de uma foto do dono');
    assert.equal(env.FILES.m.has(chaveDaMiniatura('F1')), false);
    assert.equal((await subirMini(env, P, 'F1')).status, 200, 'o comproprietário pode');
    assert.equal((await carregar(env, C, 'FC', JPEG(500), 'image/jpeg', 'H1')).status, 200);
    assert.equal((await subirMini(env, C, 'FC')).status, 200, 'a dele, sim');
  });

  test('não cria linha em files, não conta para o teto e não gasta o travão dos uploads (up:)', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    assert.equal((await carregar(env, D, 'F1')).status, 200);
    const antes = await linhas(env);
    // a hora de uploads esgotada: uma foto nova já não sobe…
    await env.DB.prepare('UPDATE rate_limits SET n = 60 WHERE k = ?').bind('up:' + D.id).run();
    assert.equal((await carregar(env, D, 'F_NOVA')).status, 429);
    // …mas a miniatura da que já subiu sobe, sem mexer no contador
    assert.equal((await subirMini(env, D, 'F1')).status, 200);
    assert.deepEqual(await linhas(env), antes, 'nenhuma linha nova nem mudada em files');
    const up = await env.DB.prepare('SELECT n FROM rate_limits WHERE k = ?').bind('up:' + D.id).first();
    assert.equal(up.n, 60);
    const tn = await env.DB.prepare('SELECT n FROM rate_limits WHERE k = ?').bind('tn:' + D.id).first();
    assert.equal(tn.n, 1, 'tem o travão dela');
    assert.equal(env.FILES.m.get(chaveDaMiniatura('F1')).length, MINI, 'no R2, na chave derivada');
  });

  test('os limites: só imagens pequenas, só de uma foto que existe', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    assert.equal((await subirMini(env, D, 'NADA')).status, 404, 'sem original no servidor');
    assert.equal(env.FILES.m.has(chaveDaMiniatura('NADA')), false);
    await carregar(env, D, 'F1');
    assert.equal((await subirMini(env, D, 'F1', JPEG(MINI), 'text/html')).status, 415);
    assert.equal((await subirMini(env, D, 'F1', JPEG(300 * 1024))).status, 413);
    assert.equal((await subirMini(env, D, 'F1', new Uint8Array(0))).status, 400);
    await carregar(env, D, 'PDF', JPEG(900), 'application/pdf');
    assert.equal((await subirMini(env, D, 'PDF')).status, 400, 'um PDF não tem miniatura');
    assert.equal([...env.FILES.m.keys()].filter((k) => k.startsWith('tn/')).length, 0);
  });

  test('sai com a foto: o DELETE e a varredura de uma casa apagada levam-na', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    await casa(env, D, 'HV');
    await casa(env, D, 'HA', {}, 1);
    await anexoNaCasa(env, 'F1', D, 'HV');
    await anexoNaCasa(env, 'FV', D, 'HV');
    await anexoNaCasa(env, 'FA', D, 'HA');
    for (const id of ['F1', 'FV', 'FA']) assert.equal((await subirMini(env, D, id)).status, 200);
    assert.equal((await resp(pedir(env, D, '/api/files/F1', 'DELETE'))).status, 200);
    assert.equal(env.FILES.m.has('F1'), false);
    assert.equal(env.FILES.m.has(chaveDaMiniatura('F1')), false, 'a miniatura saiu com a foto');
    await varrerAnexos(env, Date.now() + 31 * 86400000);
    assert.equal(env.FILES.m.has('FA'), false);
    assert.equal(env.FILES.m.has(chaveDaMiniatura('FA')), false, 'a da casa apagada saiu na varredura');
    assert.ok(env.FILES.m.has(chaveDaMiniatura('FV')), 'a da casa viva fica');
  });

  test('um anexo que sobe depois do registo fica preso a ele: o prender e o PUT com a casa', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono'), P = await conta(env, 'Parceiro'), X = await conta(env, 'Outro');
    await casa(env, D, 'H1', { photos: [{ id: 'F1', name: 'Sala' }] });
    await registo(env, 'H1', 'contract', 'c1', { name: 'Contrato', files: [{ id: 'F2' }] }, D);
    await comproprietario(env, D, P, ['H1']);
    // a casa foi gravada antes de os uploads acabarem: eles chegam soltos
    await carregar(env, D, 'F1');
    await carregar(env, D, 'F2', JPEG(800), 'application/pdf');
    assert.equal((await pedir(env, P, '/api/files/F1')).status, 404, 'solto: o comproprietário não o vê');
    assert.equal((await pedir(env, X, '/api/files/F1/prender?casa=H1', 'POST')).status, 404, 'só quem o carregou o prende');
    const r = await resp(pedir(env, D, '/api/files/F1/prender?casa=H1', 'POST', undefined, { 'X-Ficheiro-Nome': encodeURIComponent('Sala de estar') }));
    assert.equal(r.status, 200);
    assert.equal(r.preso, true);
    const f1 = await env.DB.prepare("SELECT * FROM files WHERE id = 'F1'").first();
    assert.deepEqual([f1.house_id, f1.record_kind, f1.record_id, f1.name], ['H1', 'house.photos', 'H1', 'Sala de estar']);
    assert.equal((await pedir(env, P, '/api/files/F1')).status, 200, 'o comproprietário vê-a');
    // o PUT com ?casa= faz o mesmo (o subirPendentes, depois de gravar)
    await carregar(env, D, 'F2', JPEG(800), 'application/pdf', 'H1');
    const f2 = await env.DB.prepare("SELECT * FROM files WHERE id = 'F2'").first();
    assert.deepEqual([f2.house_id, f2.record_kind, f2.record_id], ['H1', 'contract', 'c1']);
    // nada o refere ainda: não se prende (a gravação, quando vier, prende-o)
    await carregar(env, D, 'F3');
    assert.equal((await resp(pedir(env, D, '/api/files/F3/prender?casa=H1', 'POST'))).preso, false);
  });
});

/* ------------------------------------------------- no cliente, dois aparelhos */

describe('a miniatura entre aparelhos', () => {
  test('sobe com a foto: o original primeiro, a miniatura a seguir, sem linha nova em files', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const A = aparelho(env, D);
    const ms = await A.app.takeFiles({ files: [new File([JPEG(ORIGINAL)], 'IMG_0001.jpg', { type: 'image/jpeg' })], value: 'x' });
    const id = ms[0].id;
    await ate(() => A.pedidos.some((p) => p.url === '/api/files/' + id + '/miniatura' && p.status === 200), 'a miniatura subiu');
    const ordem = A.pedidos.filter((p) => p.method === 'PUT').map((p) => p.url);
    assert.deepEqual(ordem, ['/api/files/' + id, '/api/files/' + id + '/miniatura'], 'o original primeiro');
    assert.equal(env.FILES.m.get(chaveDaMiniatura(id)).length, MINI);
    const ls = await linhas(env);
    assert.equal(ls.length, 1, 'uma linha: a da foto');
    assert.equal(ls[0].name, 'IMG_0001.jpg', 'o upload leva o nome do ficheiro');
  });

  test('noutro aparelho o thumbSrc pede a miniatura e não o original', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const A = aparelho(env, D);
    const ms = await A.app.takeFiles({ files: [1, 2, 3].map((i) => new File([JPEG(ORIGINAL, i)], 'IMG_' + i + '.jpg', { type: 'image/jpeg' })), value: 'x' });
    await ate(() => ms.every((m) => env.FILES.m.has(chaveDaMiniatura(m.id))), 'as três miniaturas no servidor');
    const B = aparelho(env, D);
    const urls = await Promise.all(ms.map((m) => B.app.thumbSrc(m.id)));
    assert.ok(urls.every((u) => /^blob:/.test(u)), 'as três caixas têm imagem');
    assert.deepEqual(B.pedidos.map((p) => p.method + ' ' + p.url).sort(), Array.from(ms, (m) => 'GET /api/files/' + m.id + '/miniatura').sort(), 'só as miniaturas');
    assert.equal(desceram(B), 3 * MINI, 'nenhum original desceu');
    assert.ok(ms.every((m) => B.idb.has('tn_' + m.id)), 'guardadas no aparelho');
    await espera(20);
    assert.equal(B.pedidos.filter((p) => p.method === 'PUT').length, 0, 'e não voltam a subir');
  });

  test('sem miniatura no servidor cai no original, e sobe a que fez — uma vez', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    await carregar(env, D, 'VELHA');   // uma foto de antes: só o original
    const B = aparelho(env, D);
    assert.match(await B.app.thumbSrc('VELHA'), /^blob:/);
    await ate(() => B.pedidos.some((p) => p.method === 'PUT' && p.status === 200), 'a miniatura que fez subiu');
    assert.deepEqual(B.pedidos.map((p) => p.method + ' ' + p.url + ' ' + p.status), [
      'GET /api/files/VELHA/miniatura 404', 'GET /api/files/VELHA 200', 'PUT /api/files/VELHA/miniatura 200',
    ]);
    // de novo nesta sessão (sem a memória das caixas): vem do aparelho, sem pedidos
    for (const k of Object.keys(B.app.thumbCache)) delete B.app.thumbCache[k];
    await B.app.thumbSrc('VELHA');
    assert.equal(B.pedidos.length, 3);
    // e o aparelho seguinte já não descarrega o original
    const C = aparelho(env, D);
    await C.app.thumbSrc('VELHA');
    assert.deepEqual(C.pedidos.map((p) => p.method + ' ' + p.url), ['GET /api/files/VELHA/miniatura']);
    assert.equal(desceram(C), MINI);
  });

  test('a foto acabada de subir depois de a casa ser gravada fica presa a ela: o comproprietário vê-a', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono'), P = await conta(env, 'Parceiro');
    await casa(env, D, 'H1');
    await comproprietario(env, D, P, ['H1']);
    const A = aparelho(env, D);
    A.app.db.properties = [A.app.normProp({ id: 'H1', name: 'H1' })];
    let solta;
    const segura = new Promise((r) => { solta = r; });
    A.segurar = (p) => (p.method === 'PUT' && /^\/api\/files\/[^/]+$/.test(p.url) ? segura : null);
    const [m] = await A.app.takeFiles({ files: [new File([JPEG(ORIGINAL)], 'IMG_9.jpg', { type: 'image/jpeg' })], value: 'x' });
    // o upload ainda a caminho; a casa grava-se e chega ao servidor primeiro
    m.name = 'Cozinha';
    A.app.db.properties[0].photos = [m];
    await env.DB.prepare('UPDATE houses SET data = ? WHERE id = ?').bind(JSON.stringify({ id: 'H1', name: 'H1', photos: [{ id: m.id, name: 'Cozinha' }] }), 'H1').run();
    solta();
    await ate(() => A.pedidos.some((p) => p.url === '/api/files/' + m.id + '/prender?casa=H1' && p.status === 200), 'prendeu');
    const f = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(m.id).first();
    assert.deepEqual([f.house_id, f.record_kind, f.name], ['H1', 'house.photos', 'Cozinha']);
    assert.equal((await pedir(env, P, '/api/files/' + m.id)).status, 200, 'o comproprietário vê a foto');
    await ate(() => A.pedidos.some((p) => p.url === '/api/files/' + m.id + '/miniatura'), 'e a miniatura subiu');
    assert.equal((await verMini(env, P, m.id)).status, 200, 'e a miniatura');
  });

  test('o subirPendentes não volta a subir o que já subiu nesta sessão, e chega ao vigésimo primeiro', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const A = aparelho(env, D);
    const files = Array.from({ length: 25 }, (_, i) => ({ id: 'D' + String(i).padStart(2, '0'), name: 'doc' + i + '.pdf', type: 'application/pdf', size: 10 }));
    files.forEach((f) => A.idb.set(f.id, new Blob([JPEG(10)], { type: 'application/pdf' })));
    A.app.db.owners = [{ id: D.id, name: 'Dono', files }];
    const puts = () => A.pedidos.filter((p) => p.method === 'PUT').length;
    A.app.subirPendentes();
    await ate(() => puts() === 20 && A.pedidos.every((p) => p.status), 'os primeiros vinte');
    A.app.subirPendentes();
    await ate(() => puts() === 25 && A.pedidos.every((p) => p.status), 'os cinco que faltavam');
    A.app.subirPendentes();
    await espera(30);
    assert.equal(puts(), 25, 'nada mais sobe');
  });

  test('uma miniatura que não chegou (sem rede) volta a tentar depois da sincronização seguinte', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const A = aparelho(env, D);
    let cortes = 1;
    A.segurar = (p) => (/\/miniatura$/.test(p.url) && p.method === 'PUT' && cortes-- > 0 ? Promise.reject(new TypeError('sem rede')) : null);
    const [m] = await A.app.takeFiles({ files: [new File([JPEG(ORIGINAL)], 'IMG_1.jpg', { type: 'image/jpeg' })], value: 'x' });
    await ate(() => cortes <= 0, 'a primeira tentativa caiu');
    await espera(20);
    assert.equal(env.FILES.m.has(chaveDaMiniatura(m.id)), false, 'não chegou');
    A.app.subirPendentes();
    await ate(() => env.FILES.m.has(chaveDaMiniatura(m.id)), 'chegou à segunda');
    const antes = A.pedidos.length;
    A.app.subirPendentes();
    await espera(30);
    assert.equal(A.pedidos.length, antes, 'e não sobe mais nada');
  });

  test('o arranque guarda as miniaturas dos anexos que ficam, e deita fora as dos que saíram', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dono');
    const A = aparelho(env, D);
    A.app.db.properties = [A.app.normProp({ id: 'H1', name: 'H1', photos: [{ id: 'F1', name: 'a', type: 'image/jpeg' }] })];
    const chaves = ['F1', 'tn_F1', 'F2', 'tn_F2'];
    const saiu = [];
    const loja = { getAllKeys() { const r = { result: chaves }; setTimeout(() => r.onsuccess(), 0); return r; }, delete(k) { saiu.push(k); } };
    A.app.idb = () => Promise.resolve({ transaction: () => { const t = { objectStore: () => loja }; setTimeout(() => t.oncomplete && t.oncomplete(), 0); return t; } });
    A.app.CW._esperaFim = 1;   // o servidor já falou: a arrumação corre
    A.app.cleanFiles();
    await ate(() => saiu.length === 2, 'arrumou');
    assert.deepEqual(saiu.sort(), ['F2', 'tn_F2']);
  });
});

test('apagar a conta leva as miniaturas das fotos dela', async () => {
  const env = ambiente();
  const A = await conta(env, 'Ana');
  await env.FILES.put('F1', new Uint8Array([1]));
  await env.FILES.put('tn/F1', new Uint8Array([2]));
  await env.DB.prepare("INSERT INTO files (id, owner_id, name, type, size, created_at) VALUES ('F1', ?, 'f', 'image/jpeg', 1, 1)").bind(A.id).run();
  await purgeAccount(env, A.id);
  assert.equal(env.FILES.m.has('F1'), false);
  assert.equal(env.FILES.m.has('tn/F1'), false);
});
