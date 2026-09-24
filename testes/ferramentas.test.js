// Ferramentas de quem opera: a ficha de quem escreveu, o contexto dos erros
// e a vigia dos limites. É o que separa "está partido" de saber o que fazer.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { errorEmbed, LIMIAR_AVISO, watchLimits } from '../worker/src/notify.js';
import { recordReport } from '../worker/src/lib/relatos.js';

const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* --------------------------------------------------- o aviso de um erro */

const base = { id: 'abc12345', kind: 'client', message: 'Falhou', detail: 'onde', created_at: Date.now() };
const campo = (e, nome) => (e.fields.find((c) => c.name === nome) || {}).value;

describe('o aviso de um erro', () => {
  test('um erro de uma pessoa é amarelo', () => {
    const e = errorEmbed({ ...base, n: 1, pessoas: 1 });
    assert.match(e.title, /⚠️/);
    assert.equal(e.color, 0xd6a34a);
  });

  test('a partir de duas pessoas é vermelho e di-lo no título', () => {
    const e = errorEmbed({ ...base, n: 5, pessoas: 4 });
    assert.match(e.title, /🔴/);
    assert.match(e.title, /4 pessoas/);
    assert.equal(e.color, 0xb94a48);
  });

  test('leva a versão da app, que é o que separa o velho do novo', () => {
    assert.equal(campo(errorEmbed({ ...base, n: 1, versao: 25 }), 'Versão da app'), '25');
  });

  test('leva o browser e o sistema quando os há', () => {
    const e = errorEmbed({ ...base, n: 1, contexto: 'ecrã dashboard · Samsung Internet · Android 14' });
    assert.match(campo(e, 'Onde'), /Samsung Internet/);
  });

  test('sem esses dados não inventa campos vazios', () => {
    const e = errorEmbed({ ...base, n: 1 });
    assert.equal(campo(e, 'Versão da app'), undefined);
    assert.equal(campo(e, 'Pessoas'), undefined);
  });
});

/* ------------------------------------------ contar pessoas, não ocorrências */

function baseFalsa(estado) {
  const tabelas = estado || { tickets: [], ticket_users: [], users: [{ id: 'u1', created_at: 0 }] };
  return {
    tabelas,
    prepare(sql) {
      const args = [];
      const self = {
        bind: (...a) => { args.push(...a); return self; },
        async first() {
          if (/FROM tickets WHERE fingerprint/.test(sql)) {
            return tabelas.tickets.find((t) => t.fingerprint === args[0]) || null;
          }
          if (/COUNT\(\*\) AS n FROM ticket_users/.test(sql)) {
            return { n: tabelas.ticket_users.filter((x) => x.fingerprint === args[0]).length };
          }
          if (/FROM users/.test(sql)) return tabelas.users[0] || null;
          return null;
        },
        async run() {
          if (/INSERT OR IGNORE INTO ticket_users/.test(sql)) {
            const [fp, uid, t] = args;
            const ja = tabelas.ticket_users.some((x) => x.fingerprint === fp && x.user_id === uid);
            if (!ja) tabelas.ticket_users.push({ fingerprint: fp, user_id: uid, first_at: t });
            return { meta: { changes: ja ? 0 : 1 } };
          }
          if (/INSERT INTO tickets/.test(sql)) {
            // o kind e o status são literais no SQL, não parâmetros: saltar um
            // deles aqui desalinhava tudo o que vinha a seguir
            const [id, user_id, subject, body, category, fingerprint, versao, context, created_at] = args;
            tabelas.tickets.push({
              id, user_id, subject, body, category, fingerprint, versao, context,
              status: 'criado', n: 1, created_at, updated_at: created_at,
            });
            return { meta: { changes: 1 } };
          }
          if (/UPDATE tickets SET n = n \+ 1/.test(sql)) {
            const t = tabelas.tickets.find((x) => x.id === args[args.length - 1]);
            if (t) { t.n++; t.status = args[0]; t.updated_at = args[1]; if (args[2] != null) t.versao = args[2]; }
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
        async all() { return { results: [] }; },
      };
      return self;
    },
  };
}


describe('contar pessoas e não ocorrências', () => {
  test('o mesmo erro da mesma pessoa conta uma pessoa', async () => {
    const DB = baseFalsa();
    for (let i = 0; i < 5; i++) await recordReport({ DB }, null, 'client', 'Rebentou', 'x', 'u1');
    assert.equal(DB.tabelas.tickets.length, 1, 'um pedido só');
    assert.equal(DB.tabelas.tickets[0].n, 5, 'cinco ocorrências');
    assert.equal(DB.tabelas.ticket_users.length, 1, 'uma pessoa');
  });

  test('o mesmo erro de pessoas diferentes conta cada uma', async () => {
    const DB = baseFalsa();
    for (const u of ['u1', 'u2', 'u3', 'u2']) {
      await recordReport({ DB }, null, 'client', 'Rebentou', 'x', u);
    }
    assert.equal(DB.tabelas.ticket_users.length, 3, 'três pessoas distintas');
    assert.equal(DB.tabelas.tickets[0].n, 4, 'quatro ocorrências');
  });

  test('a versão fica guardada com o erro', async () => {
    const DB = baseFalsa();
    await recordReport({ DB }, null, 'client', 'Rebentou', 'x', 'u1', { versao: 25, contexto: 'ecrã imoveis' });
    assert.equal(DB.tabelas.tickets[0].versao, '25');
    assert.equal(DB.tabelas.tickets[0].context, 'ecrã imoveis');
  });

  test('um relato sem sessão não rebenta nem inventa pessoas', async () => {
    const DB = baseFalsa();
    await recordReport({ DB }, null, 'client', 'Sem sessão', 'x', null);
    assert.equal(DB.tabelas.tickets.length, 1);
    assert.equal(DB.tabelas.ticket_users.length, 0);
  });
});

/* ------------------------------------------------- a vigia dos limites */

describe('a vigia dos limites', () => {
  test('avisa a 80%, que é antes de doer', () => {
    assert.equal(LIMIAR_AVISO, 0.8);
  });

  test('sem canal configurado não faz nada', async () => {
    const r = await watchLimits({}, null);
    assert.equal(r.avisados, 0);
    assert.match(r.motivo, /administração/);
  });

  test('sem dados de consumo também não', async () => {
    const r = await watchLimits({ DISCORD_ADMIN_CHANNEL: 'c1' }, null);
    assert.equal(r.avisados, 0);
    assert.match(r.motivo, /consumo/);
  });
});

/* ----------------------------------------------- guardas sobre o código */

describe('as peças estão ligadas', () => {
  test('há dois horários: o diário e o de hora a hora', () => {
    const w = ler('wrangler.toml');
    assert.match(w, /crons = \["0 9 \* \* \*", "0 \* \* \* \*"\]/);
  });

  test('o cron separa o trabalho leve do pesado', () => {
    const i = ler('worker/src/index.js');
    assert.match(i, /watchLimits/, 'a vigia é chamada');
    assert.match(i, /event\.cron/, 'e distingue-se pelo horário');
  });

  test('o /erros ordena pelo número de pessoas', () => {
    const d = ler('worker/src/discord.js');
    assert.match(d, /ORDER BY pessoas DESC/);
  });

  test('o /pedido mostra quem escreveu', () => {
    const d = ler('worker/src/discord.js');
    assert.match(d, /fichaDe/);
    assert.match(d, /campoDaFicha/);
  });

  test('o cliente envia a versão com cada erro', () => {
    const a = ler('web/cloud/ajuda.js');
    assert.match(a, /versao: typeof VERSAO/);
    const h = ler('web/index.html');
    assert.match(h, /versao: typeof VERSAO/, 'a armadilha do arranque também');
  });

  /* A linha automática de invocação dos Workers Logs grava o URL em bruto —
     e as ligações que se entregam às pessoas levam o segredo no endereço
     (/?convite=…, /?ligar=…). O código mascara tokens em tudo o que escreve;
     esta linha passava por fora e deixava-os em claro três dias. */
  test('os logs não guardam a linha por pedido, nos dois ambientes', () => {
    const w = ler('wrangler.toml');
    const prod = w.slice(w.indexOf('[observability]'), w.indexOf('[env.dev'));
    assert.match(prod, /\[observability\.logs\]\s*\ninvocation_logs = false/, 'produção');
    const dev = w.slice(w.indexOf('[env.dev.observability]'));
    assert.match(dev, /\[env\.dev\.observability\.logs\]\s*\ninvocation_logs = false/,
      'e dev — a observabilidade não é herdável, e sem isto o dev continuava a guardar os tokens');
  });

  /* Desligar sem substituir trocava uma fuga por cegueira: o worker tem cinco
     console.* e todos em ramos de erro. Cada relato passa a deixar um registo
     estruturado, já mascarado, pesquisável por campo nos Workers Logs. */
  test('cada relato deixa um registo estruturado e mascarado nos logs', async () => {
    const vistos = [];
    const antes = console.error;
    console.error = (x) => vistos.push(x);
    try {
      const env = { DB: { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }), first: async () => null }) } };
      await recordReport(env, { waitUntil() {} }, 'server', 'falhou /api/convite/' + 'a'.repeat(64), 'detalhe', null,
        { versao: 33, contexto: 'GET /?ligar=' + 'b'.repeat(64) });
    } finally { console.error = antes; }
    const reg = vistos.find((x) => x && typeof x === 'object' && x.relato);
    assert.ok(reg, 'há um registo, e é um objeto — não uma string');
    assert.equal(reg.relato, 'server');
    assert.ok(!/a{64}/.test(reg.msg) && /convite\/…/.test(reg.msg), 'a mensagem vai mascarada');
    assert.ok(!/b{64}/.test(reg.contexto) && /ligar=…/.test(reg.contexto), 'e o contexto também');
    assert.equal(reg.versao, '33');
  });

  test('a migração do contexto existe e cria o que é usado', () => {
    const m = ler('migrations/0009_contexto_dos_erros.sql');
    assert.match(m, /CREATE TABLE IF NOT EXISTS ticket_users/);
    assert.match(m, /ALTER TABLE tickets ADD COLUMN versao/);
  });
});
