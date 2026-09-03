// Os endereços @rendorium.com: regras de reencaminhamento no Cloudflare,
// geridas do back office. O que se prova aqui é o contrato: colisões são
// recusadas com a informação de quem lá está, só se reencaminha para
// destinos verificados, e sem token nada finge que funciona.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { endereco, listarEnderecos, criarEndereco } from '../worker/src/lib/enderecos.js';
import { kvFalso } from './lib/bd.js';

const fetchReal = globalThis.fetch;
let pedidos = [];

// um Cloudflare de mentira: zona, regras e destinos configuráveis por teste
function armarCloudflare({ regras = [], destinos = [] } = {}) {
  pedidos = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    pedidos.push({ url: u, metodo: opts.method || 'GET', corpo: opts.body ? JSON.parse(opts.body) : null });
    const ok = (result) => new Response(JSON.stringify({ success: true, result }), { status: 200 });
    if (u.includes('/zones?name=')) return ok([{ id: 'Z1', account: { id: 'A1' } }]);
    if (u.includes('/email/routing/rules') && (!opts.method || opts.method === 'GET')) return ok(regras);
    if (u.includes('/email/routing/addresses') && (!opts.method || opts.method === 'GET')) return ok(destinos);
    if (opts.method === 'POST') return ok({ id: 'novo' });
    return new Response(JSON.stringify({ success: false, errors: [{ message: 'rota desconhecida ' + u }] }), { status: 404 });
  };
}
afterEach(() => { globalThis.fetch = fetchReal; });

const env = () => ({ CF_EMAIL_TOKEN: 'tok', SESSIONS: kvFalso() });

const regra = (email, destino, enabled = true) => ({
  enabled,
  matchers: [{ type: 'literal', field: 'to', value: email }],
  actions: [{ type: 'forward', value: [destino] }],
});

describe('o nome do endereço', () => {
  test('aceita simples, com ou sem domínio, e normaliza', () => {
    assert.equal(endereco('Faturas'), 'faturas@rendorium.com');
    assert.equal(endereco('ola@rendorium.com'), 'ola@rendorium.com');
    assert.equal(endereco('a.b-c_1'), 'a.b-c_1@rendorium.com');
  });
  test('recusa vazios, espaços, arrobas alheios e pontos seguidos', () => {
    assert.equal(endereco(''), null);
    assert.equal(endereco('com espaço'), null);
    assert.equal(endereco('gato@gmail.com'), null, 'um domínio alheio não vira nome');
    assert.equal(endereco('a..b'), null);
    assert.equal(endereco('faturas@rendorium.com.pt'), null, 'gralha no fim nunca vira outro nome');
    assert.equal(endereco('gato@rendorium.como'), null);
    assert.equal(endereco('.comeca-mal'), null);
  });
});

describe('listar', () => {
  test('junta regras literais e destinos; o catch-all fica de fora', async () => {
    armarCloudflare({
      regras: [
        regra('Support@rendorium.com', 'eu@gmail.com'),
        { enabled: true, matchers: [{ type: 'all' }], actions: [{ type: 'drop' }] },
      ],
      destinos: [{ email: 'EU@gmail.com', verified: '2026-01-01' }, { email: 'outro@x.pt', verified: null }],
    });
    const d = await listarEnderecos(env());
    assert.equal(d.enderecos.length, 1, 'o catch-all não é um endereço');
    assert.deepEqual(d.enderecos[0], { email: 'support@rendorium.com', destino: 'eu@gmail.com', ativo: true });
    assert.deepEqual(d.destinos, [
      { email: 'eu@gmail.com', verificado: true },
      { email: 'outro@x.pt', verificado: false },
    ]);
  });
});

describe('criar', () => {
  test('colisão é recusada e diz para onde o existente manda', async () => {
    armarCloudflare({ regras: [regra('faturas@rendorium.com', 'eu@gmail.com')], destinos: [{ email: 'eu@gmail.com', verified: 'x' }] });
    await assert.rejects(() => criarEndereco(env(), 'FATURAS'), /Já existe faturas@rendorium\.com.*eu@gmail\.com/);
    assert.equal(pedidos.filter((p) => p.metodo === 'POST').length, 0, 'nada foi criado');
  });

  test('sem destino dado usa o primeiro verificado', async () => {
    armarCloudflare({ destinos: [{ email: 'pend@x.pt', verified: null }, { email: 'eu@gmail.com', verified: 'x' }] });
    const r = await criarEndereco(env(), 'faturas');
    assert.deepEqual(r, { email: 'faturas@rendorium.com', destino: 'eu@gmail.com' });
    const post = pedidos.find((p) => p.metodo === 'POST');
    assert.match(post.url, /\/zones\/Z1\/email\/routing\/rules/);
    assert.deepEqual(post.corpo.matchers, [{ type: 'literal', field: 'to', value: 'faturas@rendorium.com' }]);
    assert.deepEqual(post.corpo.actions, [{ type: 'forward', value: ['eu@gmail.com'] }]);
  });

  test('destino desconhecido: pede a verificação ao Cloudflare e explica — a regra fica para depois', async () => {
    armarCloudflare({ destinos: [{ email: 'eu@gmail.com', verified: 'x' }] });
    await assert.rejects(() => criarEndereco(env(), 'faturas', 'novo@x.pt'), /não está verificado.*verificação/);
    const posts = pedidos.filter((p) => p.metodo === 'POST');
    assert.equal(posts.length, 1);
    assert.match(posts[0].url, /\/accounts\/A1\/email\/routing\/addresses/, 'criou o destino, não a regra');
    assert.deepEqual(posts[0].corpo, { email: 'novo@x.pt' });
  });

  test('destino pendente não é pedido segunda vez', async () => {
    armarCloudflare({ destinos: [{ email: 'novo@x.pt', verified: null }, { email: 'eu@gmail.com', verified: 'x' }] });
    await assert.rejects(() => criarEndereco(env(), 'faturas', 'novo@x.pt'), /não está verificado/);
    assert.equal(pedidos.filter((p) => p.metodo === 'POST').length, 0, 'a verificação já vai a caminho — não se repete');
  });

  test('sem nenhum destino verificado, diz o que falta', async () => {
    armarCloudflare({ destinos: [] });
    await assert.rejects(() => criarEndereco(env(), 'faturas'), /destino verificado/);
  });

  test('a zona fica em cache no KV — a segunda chamada não volta a perguntar', async () => {
    const e = env();
    armarCloudflare({ destinos: [{ email: 'eu@gmail.com', verified: 'x' }] });
    await listarEnderecos(e);
    const zonas1 = pedidos.filter((p) => p.url.includes('/zones?name=')).length;
    await listarEnderecos(e);
    const zonas2 = pedidos.filter((p) => p.url.includes('/zones?name=')).length;
    assert.equal(zonas1, 1);
    assert.equal(zonas2, 1, 'a cache poupou a viagem');
  });
});
