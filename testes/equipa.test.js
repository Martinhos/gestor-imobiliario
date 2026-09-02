// Sessões de quem trabalha no serviço. É a parte onde um engano dá acesso a
// dados de outras pessoas, por isso os testes olham sobretudo para os
// limites: o que não se pode, e o que não se pode ver.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { criarBilhete, cookieDaEquipa, getEquipa, COOKIE, rotasEquipa } from '../worker/src/equipa.js';
import { CATS_DO_PAPEL, PERMISSOES } from '../worker/src/discord.js';

const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// KV de faz-de-conta, com o mínimo que o código usa
function kvFalso() {
  const m = new Map();
  return {
    m,
    async put(k, v) { m.set(k, v); },
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async delete(k) { m.delete(k); },
  };
}
const env = () => ({ SESSIONS: kvFalso() });
const pedido = (url, cookie) => new Request('https://x.pt' + url, {
  headers: cookie ? { Cookie: cookie } : {},
});

describe('o bilhete de entrada', () => {
  test('é longo e imprevisível', async () => {
    const e = env();
    const a = await criarBilhete(e, { discordId: '1', nome: 'A', papel: 'suporte' });
    const b = await criarBilhete(e, { discordId: '1', nome: 'A', papel: 'suporte' });
    assert.match(a.token, /^[a-f0-9]{64}$/);
    assert.notEqual(a.token, b.token);
  });

  test('vale poucos minutos', async () => {
    const e = await criarBilhete(env(), { discordId: '1', nome: 'A', papel: 'suporte' });
    assert.ok(e.expiraEm <= 600, 'não mais de dez minutos');
  });

  test('guarda quem o pediu', async () => {
    const e = env();
    const b = await criarBilhete(e, { discordId: '42', nome: 'Ana', papel: 'dev' });
    const g = JSON.parse(await e.SESSIONS.get('bilhete:' + b.token));
    assert.equal(g.discordId, '42');
    assert.equal(g.papel, 'dev');
  });
});

describe('trocar o bilhete por uma sessão', () => {
  const trocar = (e, t) => rotasEquipa({
    env: e, request: pedido('/equipa/entrar?t=' + t), method: 'GET',
    path: '/equipa/entrar', url: new URL('https://x.pt/equipa/entrar?t=' + t),
  });

  test('o bilhete certo dá sessão e leva à ferramenta', async () => {
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'Ana', papel: 'suporte' });
    const r = await trocar(e, b.token);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('Location'), '/equipa');
    assert.match(r.headers.get('Set-Cookie'), new RegExp('^' + COOKIE + '=[a-f0-9]{64}'));
  });

  test('serve uma vez só', async () => {
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'Ana', papel: 'suporte' });
    await trocar(e, b.token);
    const r = await trocar(e, b.token);
    assert.equal(r.status, 410, 'a segunda vez não entra');
  });

  test('um bilhete inventado não entra', async () => {
    assert.equal((await trocar(env(), 'a'.repeat(64))).status, 410);
    assert.equal((await trocar(env(), 'nao-e-hexadecimal')).status, 400);
  });

  test('o token não fica no endereço nem segue para lado nenhum', async () => {
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'Ana', papel: 'suporte' });
    const r = await trocar(e, b.token);
    assert.doesNotMatch(r.headers.get('Location'), /t=/, 'sai do endereço');
    assert.equal(r.headers.get('Referrer-Policy'), 'no-referrer');
  });
});

describe('a sessão de equipa', () => {
  async function comSessao(papel) {
    const e = env();
    const b = await criarBilhete(e, { discordId: '7', nome: 'Ana', papel });
    const r = await rotasEquipa({
      env: e, request: pedido('/equipa/entrar?t=' + b.token), method: 'GET',
      path: '/equipa/entrar', url: new URL('https://x.pt/equipa/entrar?t=' + b.token),
    });
    return { e, cookie: r.headers.get('Set-Cookie').split(';')[0] };
  }

  test('lê-se do cookie próprio', async () => {
    const { e, cookie } = await comSessao('suporte');
    const eu = await getEquipa(e, pedido('/api/equipa/eu', cookie));
    assert.equal(eu.nome, 'Ana');
    assert.equal(eu.papel, 'suporte');
  });

  test('sem cookie não há sessão', async () => {
    const { e } = await comSessao('suporte');
    assert.equal(await getEquipa(e, pedido('/api/equipa/eu')), null);
  });

  test('uma sessão de cliente não serve de sessão de equipa', async () => {
    const { e } = await comSessao('suporte');
    // o cookie das pessoas que usam a app chama-se outra coisa
    const eu = await getEquipa(e, pedido('/api/equipa/eu', 'gi_session=' + 'a'.repeat(64)));
    assert.equal(eu, null);
  });

  test('sair mata a sessão', async () => {
    const { e, cookie } = await comSessao('suporte');
    await rotasEquipa({
      env: e, request: pedido('/api/equipa/sair', cookie), method: 'POST',
      path: '/api/equipa/sair', url: new URL('https://x.pt/api/equipa/sair'),
    });
    assert.equal(await getEquipa(e, pedido('/api/equipa/eu', cookie)), null);
  });

  test('o cookie leva as marcas de segurança', () => {
    const c = cookieDaEquipa('a'.repeat(64));
    assert.match(c, /HttpOnly/);
    assert.match(c, /Secure/);
    assert.match(c, /SameSite=Lax/);
  });
});

describe('o que cada papel vê na ferramenta', () => {
  test('o suporte só vê o que as pessoas contaram', () => {
    assert.deepEqual(CATS_DO_PAPEL.suporte, ['user']);
  });

  test('quem programa não vê os pedidos de suporte', () => {
    assert.equal(CATS_DO_PAPEL.dev.includes('user'), false);
  });

  test('entrar na ferramenta é dos papéis todos', () => {
    assert.deepEqual([...PERMISSOES.entrar].sort(), ['dev', 'suporte']);
  });
});

describe('o que a ferramenta não faz', () => {
  const api = ler('worker/src/equipa-api.js');

  test('não devolve dados de imóveis, contratos nem movimentos', () => {
    // quem faz suporte precisa de saber com quem fala, não de ver as contas
    ['FROM records', 'FROM contracts', 'FROM transactions'].forEach((t) => {
      assert.doesNotMatch(api, new RegExp('SELECT[^;]*' + t + '[^;]*data'), t);
    });
    assert.doesNotMatch(api, /r\.data|records\.data/, 'nunca lê o conteúdo dos registos');
  });

  test('filtra sempre pelas categorias do papel', () => {
    assert.match(api, /category IN \(/, 'a lista filtra');
    assert.match(api, /cats\.indexOf\(t\.category\) < 0/, 'e o detalhe também');
  });

  test('deixa registo de quem respondeu', () => {
    assert.match(api, /eu\.papel \+ ' ' \+ eu\.nome/);
  });
});

describe('a página da ferramenta', () => {
  const vista = ler('worker/src/equipa-vista.js');

  test('diz aos motores de busca para a ignorarem', () => {
    assert.match(vista, /noindex,nofollow/);
  });

  test('sem sessão responde 401 e não mostra nada', () => {
    assert.match(vista, /status: 401/);
    assert.match(vista, /Entra-se a partir do Discord/);
  });

  test('escapa o que vem de fora', () => {
    assert.match(vista, /escapar\(eu\.nome\)/);
    assert.match(vista, /var esc = function/, 'e do lado do browser também');
  });
});
