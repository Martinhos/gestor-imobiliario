// Sessões de quem trabalha no serviço. É a parte onde um engano dá acesso a
// dados de outras pessoas, por isso os testes olham sobretudo para os
// limites: o que não se pode, e o que não se pode ver.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import {
  criarBilhete, verBilhete, cookieDaEquipa, getEquipa, COOKIE, rotasEquipa,
} from '../worker/src/equipa.js';
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

/* Base de faz-de-conta para a tabela das ligações.

   Só sabe as instruções que o código faz, e é de propósito: uma instrução
   nova que ela não conheça rebenta o teste em vez de devolver nada em
   silêncio e deixar passar um erro. O SQL a sério é exercido contra a base
   verdadeira, com as migrações aplicadas. */
function dbFalso() {
  const linhas = new Map();
  const CONHECIDAS = [
    ['INSERT INTO team_links', (a) => {
      linhas.set(a[0], { token: a[0], payload: a[1], created_at: a[2], expires_at: a[3], used_at: null });
      return { meta: { changes: 1 } };
    }],
    ['DELETE FROM team_links WHERE expires_at <', (a) => {
      let n = 0;
      [...linhas.values()].forEach((l) => { if (l.expires_at < a[0]) { linhas.delete(l.token); n++; } });
      return { meta: { changes: n } };
    }],
    ['UPDATE team_links SET used_at', (a) => {
      const l = linhas.get(a[1]);
      if (!l || l.used_at !== null || l.expires_at < a[2]) return { meta: { changes: 0 } };
      l.used_at = a[0];
      return { meta: { changes: 1 } };
    }],
    ['SELECT * FROM team_links', (a) => linhas.get(a[0]) || null],
    ['SELECT payload FROM team_links', (a) => {
      const l = linhas.get(a[0]);
      return l ? { payload: l.payload } : null;
    }],
  ];

  return {
    linhas,
    prepare(sql) {
      const achada = CONHECIDAS.find(([p]) => sql.indexOf(p) === 0);
      if (!achada) throw new Error('a base de faz-de-conta não conhece: ' + sql);
      let args = [];
      const q = {
        bind(...a) { args = a; return q; },
        async run() { const r = achada[1](args); return r.meta ? r : { meta: { changes: 0 } }; },
        async first() { const r = achada[1](args); return r && r.meta ? null : r; },
      };
      return q;
    },
  };
}

const env = () => ({ SESSIONS: kvFalso(), DB: dbFalso() });
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
    const v = await verBilhete(e, b.token);
    assert.equal(v.estado, 'boa');
    assert.equal(v.quem.discordId, '42');
    assert.equal(v.quem.papel, 'dev');
  });

  test('vive na base, não no KV', async () => {
    /* É onde tem de estar: o bilhete escreve-se no ponto de presença que
       atende o Discord e lê-se no de quem clica. O KV leva algum tempo a
       concordar consigo próprio entre regiões, e nesse intervalo uma
       ligação acabada de criar não existe para quem a abre. */
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'A', papel: 'suporte' });
    assert.equal(e.SESSIONS.m.size, 0, 'nada no KV');
    assert.ok(e.DB.linhas.has(b.token), 'e está na base');
  });

  test('ver não é usar', async () => {
    // senão uma pré-visualização gastava a ligação antes da pessoa
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'A', papel: 'suporte' });
    await verBilhete(e, b.token);
    await verBilhete(e, b.token);
    assert.equal((await verBilhete(e, b.token)).estado, 'boa');
  });

  test('distingue não existir de já ter sido usada', async () => {
    const e = env();
    assert.equal((await verBilhete(e, 'a'.repeat(64))).estado, 'nao-existe');
  });
});

describe('trocar o bilhete por uma sessão', () => {
  // abrir a ligação: mostra a página, não entra
  const abrir = (e, t) => rotasEquipa({
    env: e, request: pedido('/equipa/entrar?t=' + t), method: 'GET',
    path: '/equipa/entrar', url: new URL('https://x.pt/equipa/entrar?t=' + t),
  });

  // carregar no botão: é isto que entra
  const trocar = (e, t) => {
    const f = new FormData();
    f.set('t', t);
    return rotasEquipa({
      env: e,
      request: new Request('https://x.pt/equipa/entrar', { method: 'POST', body: f }),
      method: 'POST', path: '/equipa/entrar', url: new URL('https://x.pt/equipa/entrar'),
    });
  };

  test('o botão dá sessão e leva à ferramenta', async () => {
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'Ana', papel: 'suporte' });
    const r = await trocar(e, b.token);
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('Location'), '/equipa');
    assert.match(r.headers.get('Set-Cookie'), new RegExp('^' + COOKIE + '=[a-f0-9]{64}'));
  });

  test('abrir a ligação não a gasta', async () => {
    /* Era isto que estava errado: abrir era entrar, e quem abre primeiro
       não é a pessoa — é o desdobrador de links, o cliente a preparar a
       pré-visualização, ou o browser a adiantar-se. */
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'Ana', papel: 'suporte' });

    const p = await abrir(e, b.token);
    assert.equal(p.status, 200, 'mostra a página');
    assert.equal(p.headers.get('Set-Cookie'), null, 'e não dá sessão nenhuma');

    await abrir(e, b.token);
    await abrir(e, b.token);
    assert.equal((await trocar(e, b.token)).status, 303, 'a pessoa ainda entra');
  });

  test('a página de entrada não tem o token à solta nem deixa sair referer', async () => {
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'Ana', papel: 'suporte' });
    const p = await abrir(e, b.token);
    const html = await p.text();
    assert.match(html, /method="POST"/i, 'entra-se por POST');
    assert.match(html, new RegExp('name="t" value="' + b.token + '"'), 'o token vai no formulário');
    assert.equal(p.headers.get('Referrer-Policy'), 'no-referrer');
    assert.equal(p.headers.get('Cache-Control'), 'no-store');
  });

  test('serve uma vez só', async () => {
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'Ana', papel: 'suporte' });
    await trocar(e, b.token);
    const r = await trocar(e, b.token);
    assert.equal(r.status, 410, 'a segunda vez não entra');
  });

  test('duas pessoas ao mesmo tempo: só uma entra', async () => {
    /* Com ler-e-depois-apagar, dois pedidos simultâneos liam ambos a mesma
       ligação por usar e entravam os dois. */
    const e = env();
    const b = await criarBilhete(e, { discordId: '1', nome: 'Ana', papel: 'suporte' });
    const rs = await Promise.all([trocar(e, b.token), trocar(e, b.token), trocar(e, b.token)]);
    assert.equal(rs.filter((r) => r.status === 303).length, 1);
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
    const f = new FormData();
    f.set('t', b.token);
    const r = await rotasEquipa({
      env: e,
      request: new Request('https://x.pt/equipa/entrar', { method: 'POST', body: f }),
      method: 'POST', path: '/equipa/entrar', url: new URL('https://x.pt/equipa/entrar'),
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
    assert.deepEqual([...PERMISSOES.entrar].sort(), ['admin', 'dev', 'suporte']);
  });
});

describe('os cabeçalhos de segurança do index.js', () => {
  /* A página de entrada pede 'no-referrer' porque tem o token no endereço,
     e o harden() do index.js corre por cima de tudo o que sai. Isto ficou a
     valer um teste porque já aconteceu: o harden apagava o pedido da página
     e ficava a política geral, que deixa sair a origem. Os testes das rotas
     não apanhavam, porque chamam rotasEquipa() sem passar pelo harden. */
  const index = ler('worker/src/index.js');

  test('deixam uma resposta apertar, e só apertar', () => {
    assert.match(index, /PODE_APERTAR/, 'há uma lista do que se pode apertar');
    assert.match(index, /'Referrer-Policy':\s*\['no-referrer'\]/,
      'e o no-referrer da página de entrada está lá');
  });

  test('o que não estiver na lista continua a ser imposto', () => {
    // um `set` cego voltaria a apagar o no-referrer; um `if (!has)` cego
    // deixaria uma rota afrouxar qualquer cabeçalho
    assert.doesNotMatch(index, /forEach\(\(k\) => out\.headers\.set/, 'já não é um set cego');
    assert.match(index, /out\.headers\.set\(k, SECURITY_HEADERS\[k\]\)/, 'mas continua a impor');
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
