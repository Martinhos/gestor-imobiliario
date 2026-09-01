// Cópias da base para o R2: o que se guarda, o que se apaga, e se o que sai
// da cópia é mesmo o que estava na base.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  aPodar, chaveDoDia, diaDaChave, dia, kb, copiar, listar, estado,
  tabelasDaBase, PREFIXO, TIME_TRAVEL_DIAS,
} from '../worker/src/salvaguarda.js';
import { CATEGORIAS } from '../worker/src/lib/http.js';

const DIA = 86400000;
const HOJE = Date.parse('2026-09-01T09:00:00Z');

// ---------------------------------------------------------------- retenção

describe('que cópias se guardam', () => {
  const chave = (d) => PREFIXO + d + '.ndjson.gz';

  test('as dos últimos catorze dias ficam todas', () => {
    const recentes = [0, 1, 7, 13].map((n) => chave(dia(HOJE - n * DIA)));
    assert.deepEqual(aPodar(recentes, HOJE), []);
  });

  test('passados catorze dias, só sobrevive a do dia 1', () => {
    const fora = aPodar([chave('2026-07-15'), chave('2026-07-01')], HOJE);
    assert.deepEqual(fora, [chave('2026-07-15')]);
  });

  test('as do dia 1 caem ao fim de um ano', () => {
    assert.deepEqual(aPodar([chave('2024-01-01')], HOJE), [chave('2024-01-01')]);
  });

  test('o que não tem forma de cópia nunca se apaga', () => {
    const outros = [PREFIXO + 'leia-me.txt', 'anexos/foto.jpg', PREFIXO + 'lixo.ndjson.gz'];
    assert.deepEqual(aPodar(outros, HOJE), []);
  });

  test('uma data impossível também não se apaga', () => {
    assert.deepEqual(aPodar([chave('2026-13-45')], HOJE), []);
  });

  test('a chave do dia e a leitura da chave são inversas', () => {
    assert.equal(chaveDoDia(HOJE), PREFIXO + '2026-09-01.ndjson.gz');
    assert.equal(diaDaChave(chaveDoDia(HOJE)), '2026-09-01');
    assert.equal(diaDaChave('outra-coisa'), null);
  });
});

describe('tamanhos', () => {
  test('mostra KB e MB', () => {
    assert.equal(kb(2048), '2 KB');
    assert.equal(kb(1572864), '1,5 MB');
    assert.equal(kb(0), '0 KB');
    assert.equal(kb(10), '1 KB');
  });
});

// ------------------------------------------------- base e balde de faz-de-conta

function baseFalsa(tabelas) {
  return {
    prepare(sql) {
      const args = [];
      const self = {
        bind: (...a) => { args.push(...a); return self; },
        async all() {
          if (/sqlite_master/.test(sql)) {
            return { results: Object.keys(tabelas).sort().map((name) => ({ name })) };
          }
          const t = /FROM "([^"]+)"/.exec(sql)[1];
          const [limite, salto] = args;
          return { results: (tabelas[t] || []).slice(salto, salto + limite) };
        },
        async first() { return (await self.all()).results[0] || null; },
      };
      return self;
    },
  };
}

function baldeFalso() {
  const objetos = new Map();
  return {
    objetos,
    async put(key, value, opts) {
      const buf = value instanceof ArrayBuffer
        ? Buffer.from(value)
        : Buffer.from(await new Response(value).arrayBuffer());
      objetos.set(key, { key, size: buf.length, uploaded: new Date(), buf, opts });
    },
    async head(key) { return objetos.get(key) || null; },
    async delete(key) { objetos.delete(key); },
    async list({ prefix, cursor }) {
      const todos = [...objetos.values()].filter((o) => o.key.startsWith(prefix || ''));
      return { objects: todos, truncated: false, cursor: null };
    },
  };
}

// Lê a cópia como quem a vai restaurar.
async function ler(balde, chave) {
  const o = balde.objetos.get(chave);
  const texto = Buffer.from(
    await new Response(
      new Blob([o.buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).arrayBuffer()
  ).toString('utf8');
  const linhas = texto.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { cabecalho: linhas[0], registos: linhas.slice(1) };
}

const CONTEUDO = {
  users: [{ id: 'u1', email: 'a@b.pt' }, { id: 'u2', email: 'c@d.pt' }],
  houses: [{ id: 'h1', owner_id: 'u1', name: 'T2' }],
  records: [],
  rate_limits: [{ k: 'rp:u1', n: 3 }],
};

// -------------------------------------------------------------------- a cópia

describe('fazer a cópia', () => {
  test('descobre as tabelas e deixa de fora as efémeras', async () => {
    const t = await tabelasDaBase({ DB: baseFalsa(CONTEUDO) });
    assert.deepEqual(t, ['houses', 'records', 'users'], 'rate_limits fica de fora');
  });

  test('a cópia leva todos os registos de todas as tabelas', async () => {
    const FILES = baldeFalso();
    const r = await copiar({ DB: baseFalsa(CONTEUDO), FILES });
    assert.equal(r.linhas, 3);
    assert.equal(r.tabelas, 3);
    assert.ok(r.bytes > 0);

    const { cabecalho, registos } = await ler(FILES, r.chave);
    assert.equal(cabecalho._, 'gestor-imobiliario');
    assert.deepEqual(cabecalho.tabelas, ['houses', 'records', 'users']);
    assert.equal(registos.length, 3);
    assert.deepEqual(
      registos.filter((x) => x.t === 'users').map((x) => x.r.id).sort(),
      ['u1', 'u2']
    );
    assert.equal(registos.filter((x) => x.t === 'rate_limits').length, 0);
  });

  test('uma tabela maior do que uma página sai inteira', async () => {
    const muitos = Array.from({ length: 1201 }, (_, i) => ({ id: 'r' + i }));
    const FILES = baldeFalso();
    const r = await copiar({ DB: baseFalsa({ records: muitos }), FILES });
    assert.equal(r.linhas, 1201, 'nenhuma página se perde');
    const { registos } = await ler(FILES, r.chave);
    assert.equal(new Set(registos.map((x) => x.r.id)).size, 1201, 'nem se repete');
  });

  test('cada linha é um registo isolado, para o restauro ser um ciclo', async () => {
    const FILES = baldeFalso();
    const r = await copiar({ DB: baseFalsa(CONTEUDO), FILES });
    const { registos } = await ler(FILES, r.chave);
    registos.forEach((x) => {
      assert.ok(x.t && x.r, 'tem tabela e registo');
      assert.equal(typeof x.r, 'object');
    });
  });

  test('vai comprimida, e a compressão vale a pena', async () => {
    const muitos = Array.from({ length: 500 }, (_, i) => ({ id: 'r' + i, nota: 'texto repetido '.repeat(10) }));
    const FILES = baldeFalso();
    const r = await copiar({ DB: baseFalsa({ records: muitos }), FILES });
    const o = FILES.objetos.get(r.chave);
    assert.equal(o.opts.httpMetadata.contentEncoding, 'gzip');
    assert.ok(r.bytes < 40000, 'gzip encolheu mesmo (' + r.bytes + ' bytes)');
  });

  test('sem balde ligado, diz porquê em vez de rebentar', async () => {
    const r = await copiar({ DB: baseFalsa(CONTEUDO) });
    assert.match(r.erro, /R2/);
  });

  test('a cópia do dia poda as que já não são precisas', async () => {
    const FILES = baldeFalso();
    for (const d of ['2026-08-31', '2026-07-15', '2026-07-01', '2024-01-01']) {
      await FILES.put(PREFIXO + d + '.ndjson.gz', new Uint8Array([1]).buffer, {});
    }
    await copiar({ DB: baseFalsa(CONTEUDO), FILES });
    const ficaram = (await listar({ FILES })).map((o) => diaDaChave(o.key));
    assert.ok(ficaram.includes('2026-08-31'), 'a de ontem fica');
    assert.ok(ficaram.includes('2026-07-01'), 'a do dia 1 fica');
    assert.ok(!ficaram.includes('2026-07-15'), 'a do meio do mês sai');
    assert.ok(!ficaram.includes('2024-01-01'), 'a de há dois anos sai');
  });

  test('a lista vem da mais recente para a mais antiga', async () => {
    const FILES = baldeFalso();
    for (const d of ['2026-08-30', '2026-09-01', '2026-08-31']) {
      await FILES.put(PREFIXO + d + '.ndjson.gz', new Uint8Array([1]).buffer, {});
    }
    const l = await listar({ FILES });
    assert.deepEqual(l.map((o) => diaDaChave(o.key)), ['2026-09-01', '2026-08-31', '2026-08-30']);
  });
});

describe('o que o resumo diário diz das cópias', () => {
  test('sem cópia nenhuma, avisa a vermelho', async () => {
    const e = await estado({ FILES: baldeFalso() });
    assert.equal(e.vazio, true);
    assert.match(e.texto, /🔴/);
  });

  test('com a cópia de hoje, fica verde e diz o Time Travel', async () => {
    const FILES = baldeFalso();
    await copiar({ DB: baseFalsa(CONTEUDO), FILES });
    const e = await estado({ FILES });
    assert.match(e.texto, /🟢/);
    assert.match(e.texto, new RegExp('Time Travel ' + TIME_TRAVEL_DIAS + ' dias'));
    assert.equal(e.idade, 0);
  });

  test('uma cópia velha demais fica a vermelho', async () => {
    const FILES = baldeFalso();
    await FILES.put(PREFIXO + dia(Date.now() - 9 * DIA) + '.ndjson.gz', new Uint8Array([1]).buffer, {});
    const e = await estado({ FILES });
    assert.match(e.texto, /🔴/);
    assert.ok(e.idade >= 8);
  });

  test('um balde que rebenta não rebenta o resumo', async () => {
    const e = await estado({ FILES: { async list() { throw new Error('R2 em baixo'); } } });
    assert.match(e.texto, /🔴/);
    assert.match(e.erro, /R2 em baixo/);
  });

  test('o plano gratuito dá sete dias de Time Travel', () => {
    assert.equal(TIME_TRAVEL_DIAS, 7);
  });
});

// -------------------------------------------------- guardas sobre o código

// Estes dois leem o código-fonte. São a rede que faltava: os dois erros que
// esta tarefa corrigiu — a categoria 'servidor', que não existe, e as
// consultas à tabela `reports`, que ninguém escreve desde a migração 0008 —
// eram invisíveis a qualquer teste de comportamento, porque o resultado era
// silêncio em vez de exceção.

const fonte = (p) => readFileSync(new URL('../worker/src/' + p, import.meta.url), 'utf8');
const modulos = () => [
  ...readdirSync(new URL('../worker/src', import.meta.url)).filter((f) => f.endsWith('.js')),
  ...readdirSync(new URL('../worker/src/lib', import.meta.url)).map((f) => 'lib/' + f),
  ...readdirSync(new URL('../worker/src/rotas', import.meta.url)).map((f) => 'rotas/' + f),
];

describe('vigilância dos erros', () => {
  test('todos os relatos usam uma categoria que existe', () => {
    const usadas = [];
    modulos().forEach((m) => {
      const re = /recordReport\(\s*env\s*,\s*ctx\s*,\s*'([^']+)'/g;
      let x;
      while ((x = re.exec(fonte(m)))) usadas.push([m, x[1]]);
    });
    assert.ok(usadas.length >= 3, 'há relatos a ser criados');
    usadas.forEach(([m, cat]) => {
      assert.ok(CATEGORIAS.includes(cat), m + ' usa a categoria "' + cat + '", que não existe');
    });
  });

  test('ninguém consulta a tabela de erros abandonada', () => {
    modulos().forEach((m) => {
      assert.doesNotMatch(
        fonte(m), /FROM reports\b/,
        m + ' lê `reports`, mas os erros vivem em `tickets` desde a migração 0008'
      );
    });
  });

  test('os relatos de erro chegam sem sessão iniciada', () => {
    const api = fonte('api.js');
    assert.match(api, /rotasRelatos/, 'a rota pública está ligada');
    // a comparação é com a chamada, não com o import lá no topo
    assert.ok(
      api.indexOf('rotasRelatos(c)') < api.indexOf('getSessionUser(env, request)'),
      'e corre antes da verificação de sessão'
    );
  });
});
