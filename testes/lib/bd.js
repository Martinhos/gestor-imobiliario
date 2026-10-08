// Uma D1 de teste que é SQLite a sério, com as migrações aplicadas.
//
// Os fakes por instrução serviram enquanto as consultas eram meia dúzia;
// com o back office deixaram de servir — cada um só sabia o SQL que
// conhecia, e um JOIN novo passava sem ninguém o ter corrido. Isto corre o
// SQL verdadeiro contra o esquema verdadeiro: uma coluna mal escrita ou uma
// migração em falta rebenta no teste, não em produção.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// A interface é a da D1: prepare().bind().first()/all()/run(), com o
// `meta.changes` de que o código depende para saber se mexeu em algo.
export function baseDeTeste() {
  const db = new DatabaseSync(':memory:');
  const pasta = new URL('../../migrations/', import.meta.url);
  readdirSync(pasta)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .forEach((f) => db.exec(readFileSync(new URL(f, pasta), 'utf8')));

  return {
    _db: db,   // para os testes espreitarem por dentro quando precisarem
    // como a D1: tudo ou nada
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    prepare(sql) {
      /* A D1 aceita parâmetros numerados (?1) e repetidos; o node:sqlite
         não. Traduz-se aqui — o SQL do worker corre tal e qual está. */
      const ordem = [];
      const sqlPos = sql.replace(/\?(\d+)/g, (m, n) => { ordem.push(Number(n) - 1); return '?'; });
      let args = [];
      const vai = () => (ordem.length ? ordem.map((i) => args[i]) : args);
      const q = {
        bind(...a) { args = a.map((v) => (v === undefined ? null : v)); return q; },
        async first() {
          const linha = db.prepare(sqlPos).get(...vai());
          return linha === undefined ? null : linha;
        },
        async all() { return { results: db.prepare(sqlPos).all(...vai()) }; },
        async run() {
          const r = db.prepare(sqlPos).run(...vai());
          return { meta: { changes: Number(r.changes) } };
        },
      };
      return q;
    },
  };
}

// KV de faz-de-conta, o mesmo de sempre.
export function kvFalso() {
  const m = new Map();
  return {
    m,
    async put(k, v) { m.set(k, v); },
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async delete(k) { m.delete(k); },
  };
}

// R2 de faz-de-conta: guarda os bytes tal como chegam, incluindo de um
// fluxo — é o que a salvaguarda escreve.
export function r2Falso() {
  const m = new Map();
  return {
    m,
    async put(k, corpo) {
      const buf = corpo && typeof corpo.getReader === 'function'
        ? new Uint8Array(await new Response(corpo).arrayBuffer())
        : new Uint8Array(corpo);
      m.set(k, buf);
    },
    async head(k) { const b = m.get(k); return b ? { size: b.length } : null; },
    async get(k) {
      const b = m.get(k);
      return b ? { size: b.length, body: new Response(b).body } : null;
    },
    // como o R2 verdadeiro: uma chave ou uma lista delas (até 1000)
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach((x) => m.delete(x)); },
    async list(o) {
      const prefixo = (o && o.prefix) || '';
      return {
        objects: [...m.keys()].filter((k) => k.startsWith(prefixo))
          .map((k) => ({ key: k, size: m.get(k).length, uploaded: new Date() })),
        truncated: false,
      };
    },
  };
}
