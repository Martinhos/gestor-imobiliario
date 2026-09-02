// Worker: validação de entrada, palavras-passe, anexos e a assinatura do bot.
// São as funções que decidem o que entra na base de dados e quem é quem.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import {
  badId, cleanData, weakPassword, tooBig, json, err, TERMS_VERSION, CATEGORIAS,
} from '../worker/src/lib/http.js';
import { hashPassword, verifyPassword, newUserId, sessionCookie, readSessionToken } from '../worker/src/auth.js';
import { isFileId, fileIdsIn } from '../worker/src/files.js';
import { verifySignature, ticketButtons } from '../worker/src/discord.js';

const pedido = (headers = {}) => new Request('https://x.pt/api/state', { headers });

describe('identificadores', () => {
  test('aceita o que a app gera', () => {
    assert.equal(badId('550e8400-e29b-41d4-a716-446655440000'), false);
    assert.equal(badId('A7KQ2MPX'), false);
    assert.equal(badId('tx'), false);
    assert.equal(badId('casa_1-2'), false);
  });

  test('recusa o que pode escapar para o HTML', () => {
    assert.equal(badId('"><img src=x onerror=alert(1)>'), true);
    assert.equal(badId("' OR 1=1"), true);
    assert.equal(badId('<script>'), true);
    assert.equal(badId('a b'), true);
  });

  test('recusa vazios e demasiado longos', () => {
    assert.equal(badId(''), true);
    assert.equal(badId(null), true);
    assert.equal(badId(undefined), true);
    assert.equal(badId('x'.repeat(65)), true);
    assert.equal(badId('x'.repeat(64)), false);
  });
});

describe('corpo de um registo', () => {
  test('um objeto simples passa', () => {
    assert.deepEqual(cleanData({ name: 'Casa' }), { name: 'Casa' });
  });

  test('nulos, arrays e valores soltos não passam', () => {
    assert.equal(cleanData(null), null);
    assert.equal(cleanData([1, 2]), null);
    assert.equal(cleanData('texto'), null);
    assert.equal(cleanData(42), null);
  });

  test('tentativas de poluir o protótipo são limpas', () => {
    const sujo = JSON.parse('{"name":"x","__proto__":{"admin":true}}');
    const limpo = cleanData(sujo);
    assert.equal(Object.prototype.hasOwnProperty.call(limpo, '__proto__'), false);
    assert.equal({}.admin, undefined, 'o protótipo global ficou intacto');
  });

  test('o id da linha manda sobre o que vem no corpo', () => {
    assert.equal(cleanData({ id: 'mentira', name: 'x' }, 'verdade').id, 'verdade');
  });

  test('registos gigantes são recusados', () => {
    assert.equal(tooBig({ x: 'a'.repeat(100) }), false);
    assert.equal(tooBig({ x: 'a'.repeat(300 * 1024) }), true);
  });
});

describe('palavras-passe', () => {
  test('exige comprimento e variedade', () => {
    assert.equal(weakPassword('Forte#2026'), false);
    assert.equal(weakPassword('curto1!A'), false);       // 8 caracteres, tem tudo
    assert.equal(weakPassword('curta1!'), true);         // 7 caracteres
    assert.equal(weakPassword('semmaiuscula1!'), true);
    assert.equal(weakPassword('SEMMINUSCULA1!'), true);
    assert.equal(weakPassword('SemNumeros!!'), true);
    assert.equal(weakPassword('SemSimbolo123'), true);
  });

  test('o resumo confirma a palavra certa e recusa a errada', async () => {
    const { hash, salt } = await hashPassword('Forte#2026');
    assert.ok(hash.length > 20, 'guarda um resumo, não a palavra');
    assert.ok(!hash.includes('Forte'), 'a palavra não aparece no resumo');
    assert.equal(await verifyPassword('Forte#2026', salt, hash), true);
    assert.equal(await verifyPassword('Forte#2027', salt, hash), false);
    assert.equal(await verifyPassword('', salt, hash), false);
  });

  test('a mesma palavra com sal diferente dá resumos diferentes', async () => {
    const a = await hashPassword('Forte#2026');
    const b = await hashPassword('Forte#2026');
    assert.notEqual(a.salt, b.salt);
    assert.notEqual(a.hash, b.hash);
  });
});

describe('identificadores de utilizador', () => {
  test('têm oito caracteres do alfabeto sem ambiguidades', () => {
    for (let i = 0; i < 50; i++) {
      const id = newUserId();
      assert.match(id, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/, id);
    }
  });

  test('não se repetem em cinquenta tentativas', () => {
    const vistos = new Set();
    for (let i = 0; i < 50; i++) vistos.add(newUserId());
    assert.equal(vistos.size, 50);
  });
});

describe('cookie de sessão', () => {
  test('leva as marcas de segurança', () => {
    const c = sessionCookie('a'.repeat(64));
    assert.match(c, /HttpOnly/);
    assert.match(c, /Secure/);
    assert.match(c, /SameSite=Lax/);
  });

  test('a saída apaga o cookie', () => {
    assert.match(sessionCookie('', true), /Max-Age=0/);
  });

  test('só aceita tokens com o formato certo', () => {
    const bom = 'a'.repeat(64);
    assert.equal(readSessionToken(pedido({ Authorization: 'Bearer ' + bom })), bom);
    assert.equal(readSessionToken(pedido({ Authorization: 'Bearer xpto' })), null);
    assert.equal(readSessionToken(pedido({ Authorization: 'Bearer ' + 'x'.repeat(2000) })), null);
    assert.equal(readSessionToken(pedido()), null);
  });

  test('lê o cookie quando não há cabeçalho', () => {
    const bom = 'b'.repeat(64);
    assert.equal(readSessionToken(pedido({ Cookie: 'gi_session=' + bom })), bom);
    assert.equal(readSessionToken(pedido({ Cookie: 'gi_session=curto' })), null);
  });
});

describe('anexos', () => {
  test('os identificadores seguem a mesma regra', () => {
    assert.equal(isFileId('550e8400-e29b-41d4-a716-446655440000'), true);
    assert.equal(isFileId('../../etc/passwd'), false);
    assert.equal(isFileId(''), false);
  });

  test('encontra os anexos que um registo refere', () => {
    const ids = fileIdsIn({
      files: [{ id: 'a1' }],
      photos: [{ id: 'f1' }, { id: 'f2' }],
      loans: [{ files: [{ id: 'l1' }] }],
    });
    assert.deepEqual(ids.sort(), ['a1', 'f1', 'f2', 'l1']);
  });

  test('ignora o que não é anexo válido', () => {
    assert.deepEqual(fileIdsIn({ photos: [{ id: '<script>' }, {}, null] }), []);
    assert.deepEqual(fileIdsIn(null), []);
    assert.deepEqual(fileIdsIn({}), []);
  });
});

describe('respostas', () => {
  test('json leva o tipo de conteúdo certo', async () => {
    const r = json({ ok: true });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('Content-Type'), /application\/json/);
    assert.deepEqual(await r.json(), { ok: true });
  });

  test('erros levam a mensagem e o estado', async () => {
    const r = err(403, 'Sem acesso.');
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: 'Sem acesso.' });
  });
});

describe('bot do Discord', () => {
  const par = generateKeyPairSync('ed25519');
  const chavePublica = par.publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex');
  const env = { DISCORD_PUBLIC_KEY: chavePublica };
  const assinar = (ts, corpo) => sign(null, Buffer.from(ts + corpo), par.privateKey).toString('hex');

  // o timestamp agora tem prazo: os testes assinam com a hora atual
  const agora = () => String(Math.floor(Date.now() / 1000));

  test('aceita um pedido assinado pelo Discord', async () => {
    const ts = agora(), corpo = JSON.stringify({ type: 1 });
    assert.equal(await verifySignature(env, assinar(ts, corpo), ts, corpo), true);
  });

  test('recusa um pedido assinado ha muito — fecha o replay', async () => {
    // um pedido genuino capturado e reenviado dias depois nao vale
    const ts = String(Math.floor(Date.now() / 1000) - 7200), corpo = JSON.stringify({ type: 1 });
    assert.equal(await verifySignature(env, assinar(ts, corpo), ts, corpo), false);
  });

  test('recusa assinaturas forjadas', async () => {
    const ts = agora(), corpo = JSON.stringify({ type: 1 });
    assert.equal(await verifySignature(env, '00'.repeat(64), ts, corpo), false);
  });

  test('recusa um corpo trocado depois de assinado', async () => {
    const ts = agora();
    const assinatura = assinar(ts, JSON.stringify({ type: 1 }));
    assert.equal(await verifySignature(env, assinatura, ts, JSON.stringify({ type: 2 })), false);
  });

  test('recusa quando falta a assinatura ou a chave', async () => {
    assert.equal(await verifySignature(env, null, '1', '{}'), false);
    assert.equal(await verifySignature({}, '00', '1', '{}'), false);
  });

  test('os botões de um pedido levam o id', () => {
    const b = ticketButtons('abc-123');
    assert.equal(b[0].components.length, 2);
    assert.equal(b[0].components[0].custom_id, 'tk:res:abc-123');
    assert.equal(b[0].components[1].custom_id, 'tk:fim:abc-123');
  });
});

describe('constantes do serviço', () => {
  test('as categorias são as cinco previstas', () => {
    assert.deepEqual(CATEGORIAS, ['user', 'client', 'server', 'infra', 'seguranca']);
  });

  test('a versão dos termos tem forma de data', () => {
    assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  });
});
