// Os avisos por email dos planeados em atraso (o ticket de QA 7f28f7bb), no
// servidor, contra o SQL a sério (testes/lib/bd.js) com a migração 0026 e o
// fetch do Resend falso: a regra do atraso (silenciado, janela aberta, o
// «hoje» em Lisboa, registos e casas apagados); quem recebe — o dono, o
// comproprietário por partilha e por grupo, o colaborador com «Ver
// planeados» (tudo), só com «Ver contratos» (só as rendas dos contratos) e
// sem nenhuma das duas (nada), a precedência de quem é participante e tem
// cargo, e os «Sem imóvel» só para o dono; quem fica de fora — os avisos
// desligados, o serviço dos Planeados desligado, a conta apagada e a conta de
// teste em produção; uma vez por atraso — o primeiro dia manda, o segundo sem
// novos não, um atraso novo manda com o antigo em «Continuam»; sem
// RESEND_API_KEY ou com o Resend a recusar nada se grava; a poda dos 400
// dias; a carta (o assunto no singular e no plural, as casas, a data, o
// montante, as duas ligações, o html e o texto); o op_log 'atrasos' e o cron
// de hora a hora (a partir das 9h em Lisboa; o diário já não), que não cai
// por causa disto; o número fixo de consultas (o mesmo com 1 casa e com 60),
// o teto dos 20 emails por execução e o «um por dia»; a rota GET/POST
// /api/conta/avisos; e o apagar da conta.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../worker/src/index.js';
import {
  ambiente, conta, pedir, resp, casa, registo, dadoGlobal, comproprietario, desligar,
} from './lib/api.js';
import { CRON_DIARIO } from '../worker/src/lib/auditoria.js';
import { purgeAccount } from '../worker/src/lib/acesso.js';
import {
  emAtraso, hojeEmLisboa, horaDosAvisos, atrasosPorPessoa, resumoDosAtrasos, SEM_IMOVEL, MAX_EMAILS_POR_EXECUCAO,
} from '../worker/src/lib/avisos-atraso.js';
import { cartaAtrasos, dataDoAviso, montanteDoAviso } from '../worker/src/lib/correio.js';

/* ------------------------------ armações ------------------------------- */

const DIA = 86400000;
// 29/10/2026 às 09:00 UTC (09:00 em Lisboa, já depois da mudança da hora)
const AGORA = Date.UTC(2026, 9, 29, 9, 0);
const HOJE = '2026-10-29';
const NBSP = ' ';

/* Uma data a n dias de HOJE.
   Recebe: n — os dias (negativo para trás).
   Devolve: 'AAAA-MM-DD'. */
const dia = (n) => new Date(Date.parse(HOJE + 'T00:00:00Z') + n * DIA).toISOString().slice(0, 10);

/* Um planeado como a app o grava.
   Recebe: extra (opcional) — o que se junta ou troca ({next, until, muted, tx…}).
   Devolve: o objeto do planeado. */
const plan = (extra) => Object.assign({ name: 'Planeado', every: 'monthly', next: dia(-3), until: '', muted: false,
  tx: { kind: 'expense', amount: 40, label: '', category: 'Condomínio' } }, extra || {});

/* O Resend de faz-de-conta: guarda cada email que lhe chega.
   Recebe: estado (opcional) — o código da resposta (200).
   Devolve: o array dos corpos enviados ({to, subject, html, text}). */
function resendFalso(estado = 200) {
  const enviados = [];
  globalThis.fetch = async (url, op) => {
    if (String(url).includes('api.resend.com')) {
      enviados.push(JSON.parse(op.body));
      return new Response(estado === 200 ? '{"id":"e1"}' : 'recusado', { status: estado });
    }
    return new Response('', { status: 404 });
  };
  return enviados;
}

/* Os emails que foram para uma conta.
   Recebe: enviados — o array do resendFalso; quem — a conta ({email}).
   Devolve: os corpos desses emails. */
const para = (enviados, quem) => enviados.filter((e) => e.to[0] === quem.email);

/* O resumo do dia, sem pausa entre emails.
   Recebe: env; agora (opcional) — ms (AGORA por omissão).
   Devolve: a promessa do resultado do resumoDosAtrasos. */
const correr = (env, agora) => resumoDosAtrasos(env, agora == null ? AGORA : agora, { pausa: 0 });

// Recebe: env; sql; ...args. Devolve: a promessa do primeiro valor da primeira linha.
const um = async (env, sql, ...args) => Object.values((await env.DB.prepare(sql).bind(...args).first()) || { n: 0 })[0];

let seq = 0;
/* Um colaborador escrito direto na base: um cargo do dono com estas
   permissões, a linha de colaborador e as casas.
   Recebe: env; dono; quem; perms — array; casas — ids; apagado (0) — 1 para um cargo apagado.
   Devolve: a promessa do id do cargo. */
async function colaborador(env, dono, quem, perms, casas, apagado = 0) {
  const n = ++seq;
  await env.DB.prepare('INSERT INTO roles (id, owner_id, name, perms, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, 1, 1, ?)')
    .bind('role' + n, dono.id, 'Cargo ' + n, JSON.stringify(perms), apagado).run();
  await env.DB.prepare('INSERT INTO collaborators (id, owner_id, user_id, role_id, created_at) VALUES (?, ?, ?, ?, 1)')
    .bind('col' + n, dono.id, quem.id, 'role' + n).run();
  for (const h of casas) {
    await env.DB.prepare('INSERT INTO collaborator_houses (collaborator_id, house_id) VALUES (?, ?)').bind('col' + n, h).run();
  }
  return 'role' + n;
}

/* Um grupo partilhado escrito direto na base.
   Recebe: env; dono; membros — contas (o dono entra também); casas — ids; apagado (0).
   Devolve: a promessa do id do grupo. */
async function grupo(env, dono, membros, casas, apagado = 0) {
  const id = 'g' + (++seq);
  await env.DB.prepare('INSERT INTO shared_groups (id, owner_id, name, created_at, updated_at, deleted) VALUES (?, ?, ?, 1, 1, ?)')
    .bind(id, dono.id, 'Grupo', apagado).run();
  for (const m of [dono, ...membros]) {
    await env.DB.prepare('INSERT INTO shared_group_members (group_id, user_id, joined_at) VALUES (?, ?, 1)').bind(id, m.id).run();
  }
  for (const h of casas) {
    await env.DB.prepare('INSERT INTO shared_group_houses (group_id, house_id, added_by, added_at) VALUES (?, ?, ?, 1)').bind(id, h, dono.id).run();
  }
  return id;
}

/* As linhas que cada pessoa vê, em forma de comparar.
   Recebe: mapa — o de atrasosPorPessoa; quem — a conta.
   Devolve: as chaves 'casa/rec/data', ordenadas. */
const doMapa = (mapa, quem) => [...((mapa.get(quem.id) || new Map()).values())]
  .map((a) => (a.casaId || '-') + '/' + a.recId + '/' + a.data).sort();

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

/* ------------------------------ a regra -------------------------------- */

describe('a regra do atraso', () => {
  test('em atraso é por confirmar, sem silêncio, e com a janela fechada antes de hoje', () => {
    assert.equal(emAtraso(plan({ next: dia(-1) }), HOJE), true, 'ontem, sem janela');
    assert.equal(emAtraso(plan({ next: HOJE }), HOJE), false, 'hoje ainda não é atraso');
    assert.equal(emAtraso(plan({ next: dia(2) }), HOJE), false, 'no futuro');
    assert.equal(emAtraso(plan({ next: dia(-5), until: dia(0) }), HOJE), false, 'a janela acaba hoje: ainda não');
    assert.equal(emAtraso(plan({ next: dia(-5), until: dia(3) }), HOJE), false, 'a janela aberta');
    assert.equal(emAtraso(plan({ next: dia(-5), until: dia(-1) }), HOJE), true, 'a janela fechou ontem');
    assert.equal(emAtraso(plan({ next: dia(-5), muted: true }), HOJE), false, 'silenciado');
    assert.equal(emAtraso(plan({ next: '' }), HOJE), false, 'sem next');
    assert.equal(emAtraso(plan({ next: 'ontem' }), HOJE), false, 'um next que não é data');
    assert.equal(emAtraso(null, HOJE), false);
  });

  test('o hoje é o de Lisboa: no verão, 23:30 UTC já é amanhã; no inverno, Lisboa é UTC', () => {
    assert.equal(hojeEmLisboa(Date.UTC(2026, 6, 14, 23, 30)), '2026-07-15');
    assert.equal(hojeEmLisboa(Date.UTC(2026, 6, 14, 22, 59)), '2026-07-14');
    assert.equal(hojeEmLisboa(Date.UTC(2026, 0, 14, 23, 30)), '2026-01-14');
    assert.equal(hojeEmLisboa(Date.UTC(2026, 9, 24, 23, 30)), '2026-10-25', 'a véspera da mudança da hora');
    assert.match(hojeEmLisboa(), /^\d{4}-\d{2}-\d{2}$/);
  });

  test('o resumo usa o hoje de Lisboa: um planeado de 14/07 está em atraso às 23:30 UTC desse dia', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1', { name: 'Casa Soure' });
    await registo(env, 'h1', 'rec', 'r1', plan({ next: '2026-07-14' }), D);
    const r = await correr(env, Date.UTC(2026, 6, 14, 22, 0));   // 23:00 em Lisboa, ainda 14
    assert.equal(r.enviados, 0, 'ainda é o próprio dia');
    const r2 = await correr(env, Date.UTC(2026, 6, 14, 23, 30)); // 00:30 de 15 em Lisboa
    assert.equal(r2.enviados, 1);
    assert.equal(para(enviados, D).length, 1);
  });

  test('silenciados, de janela aberta, apagados e de casas apagadas não contam', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1');
    await casa(env, D, 'hx', {}, 1);   // uma casa apagada
    await registo(env, 'h1', 'rec', 'atraso', plan({ next: dia(-3) }), D);
    await registo(env, 'h1', 'rec', 'mudo', plan({ next: dia(-3), muted: true }), D);
    await registo(env, 'h1', 'rec', 'janela', plan({ next: dia(-3), until: dia(2) }), D);
    await registo(env, 'h1', 'rec', 'futuro', plan({ next: dia(4) }), D);
    await registo(env, 'h1', 'rec', 'apagado', plan({ next: dia(-3) }), D);
    await env.DB.prepare("UPDATE records SET deleted = 1 WHERE id = 'apagado'").run();
    await registo(env, 'hx', 'rec', 'dacasaapagada', plan({ next: dia(-3) }), D);
    await registo(env, 'h1', 'tx', 'movimento', plan({ next: dia(-3) }), D);   // outro kind
    await env.DB.prepare("INSERT INTO records (house_id, kind, id, data, updated_at, deleted) VALUES ('h1', 'rec', 'torto', '{nao e json', 1, 0)").run();
    const m = await atrasosPorPessoa(env, HOJE);
    assert.deepEqual(doMapa(m, D), ['h1/atraso/' + dia(-3)], 'só o que está mesmo em atraso; um JSON torto não parte nada');
  });
});

/* ---------------------------- quem recebe ------------------------------ */

describe('quem recebe', () => {
  test('o dono, o comproprietário por partilha e por grupo; quem saiu, um grupo apagado e um estranho não', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    const P = await conta(env, 'Pela partilha');
    const G = await conta(env, 'Pelo grupo');
    const S = await conta(env, 'Saiu da casa');
    const X = await conta(env, 'Grupo apagado');
    const E = await conta(env, 'Estranho');
    await casa(env, D, 'h1', { name: 'Casa Soure' });
    await registo(env, 'h1', 'rec', 'r1', plan(), D);
    await comproprietario(env, D, P, ['h1']);
    await grupo(env, D, [G, S], ['h1']);
    await env.DB.prepare('INSERT INTO house_exits (house_id, user_id, created_at) VALUES (?, ?, 1)').bind('h1', S.id).run();
    await grupo(env, D, [X], ['h1'], 1);
    const m = await atrasosPorPessoa(env, HOJE);
    const linha = ['h1/r1/' + dia(-3)];
    assert.deepEqual(doMapa(m, D), linha, 'o dono');
    assert.deepEqual(doMapa(m, P), linha, 'por partilha');
    assert.deepEqual(doMapa(m, G), linha, 'por grupo');
    assert.deepEqual(doMapa(m, S), [], 'quem saiu da casa');
    assert.deepEqual(doMapa(m, X), [], 'o grupo apagado não dá a casa');
    assert.deepEqual(doMapa(m, E), [], 'um estranho');
  });

  test('quem vê a mesma casa por dois caminhos recebe cada atraso uma vez, num email só', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    const D = await conta(env, 'Dona');
    const P = await conta(env, 'Partilha e grupo');
    await casa(env, D, 'h1', { name: 'Casa Soure' });
    await registo(env, 'h1', 'rec', 'r1', plan({ tx: { kind: 'expense', amount: 40, label: 'Condomínio de outubro' } }), D);
    await comproprietario(env, D, P, ['h1']);
    await grupo(env, D, [P], ['h1']);
    await colaborador(env, D, P, ['rec.view'], ['h1']);
    await correr(env);
    const dele = para(enviados, P);
    assert.equal(dele.length, 1);
    assert.equal(dele[0].text.split('Condomínio de outubro').length - 1, 1, 'a linha uma vez');
    assert.equal(await um(env, 'SELECT COUNT(*) FROM avisos_atraso WHERE user_id = ?', P.id), 1);
  });

  test('colaboradores: «Ver planeados» vê tudo, só «Ver contratos» as rendas dos contratos, sem nenhuma nada', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    const Rv = await conta(env, 'Vê planeados');
    const Cv = await conta(env, 'Vê contratos');
    const N = await conta(env, 'Vê visitas');
    const Ap = await conta(env, 'Cargo apagado');
    const Ou = await conta(env, 'De outra casa');
    await casa(env, D, 'h1');
    await casa(env, D, 'h2');
    await registo(env, 'h1', 'rec', 'renda', plan({ tx: { kind: 'income', amount: 750, label: 'Renda', contractId: 'c1' } }), D);
    await registo(env, 'h1', 'rec', 'imi', plan({ tx: { kind: 'expense', amount: 300, label: 'IMI' } }), D);
    await colaborador(env, D, Rv, ['rec.view'], ['h1']);
    await colaborador(env, D, Cv, ['contract.view'], ['h1']);
    await colaborador(env, D, N, ['visit.view', 'tx.view'], ['h1']);
    await colaborador(env, D, Ap, ['rec.view'], ['h1'], 1);
    await colaborador(env, D, Ou, ['rec.view'], ['h2']);
    const m = await atrasosPorPessoa(env, HOJE);
    assert.deepEqual(doMapa(m, Rv), ['h1/imi/' + dia(-3), 'h1/renda/' + dia(-3)], 'tudo');
    assert.deepEqual(doMapa(m, Cv), ['h1/renda/' + dia(-3)], 'só a renda do contrato');
    assert.deepEqual(doMapa(m, N), [], 'nada');
    assert.deepEqual(doMapa(m, Ap), [], 'um cargo apagado não dá nada');
    assert.deepEqual(doMapa(m, Ou), [], 'o cargo é de outra casa');
  });

  test('contract.add arrasta rec.view (normalizarPerms): vê tudo', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    const C = await conta(env, 'Gere contratos');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'imi', plan(), D);
    await colaborador(env, D, C, ['contract.add'], ['h1']);
    assert.deepEqual(doMapa(await atrasosPorPessoa(env, HOJE), C), ['h1/imi/' + dia(-3)]);
  });

  test('um comproprietário com um cargo só de contratos é comproprietário: vê tudo (a precedência do acessoACasa)', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    const P = await conta(env, 'Comproprietária');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'imi', plan(), D);
    await comproprietario(env, D, P, ['h1']);
    await colaborador(env, D, P, ['contract.view'], ['h1']);
    assert.deepEqual(doMapa(await atrasosPorPessoa(env, HOJE), P), ['h1/imi/' + dia(-3)]);
  });

  test('um planeado «Sem imóvel» só vai para a conta dona dele', async () => {
    const env = ambiente();
    const D = await conta(env, 'Dona');
    const P = await conta(env, 'Comproprietária');
    await casa(env, D, 'h1');
    await comproprietario(env, D, P, ['h1']);
    await dadoGlobal(env, D, 'rec', 'solto', plan({ tx: { kind: 'expense', amount: 9.9, label: 'Seguro' } }));
    await dadoGlobal(env, D, 'tpl', 'molde', plan());   // outro kind de user_records
    const m = await atrasosPorPessoa(env, HOJE);
    assert.deepEqual(doMapa(m, D), ['-/solto/' + dia(-3)]);
    assert.equal([...m.get(D.id).values()][0].linha.casa, SEM_IMOVEL);
    assert.deepEqual(doMapa(m, P), []);
  });

  test('ficam de fora: os avisos desligados, os Planeados desligados (ou os Movimentos), a conta apagada e, em produção, a conta de teste', async () => {
    const montar = async (env) => {
      const D = await conta(env, 'Dona');
      const Desl = await conta(env, 'Desligou os avisos');
      const SemPl = await conta(env, 'Sem Planeados');
      const SemMov = await conta(env, 'Sem Movimentos');
      const Apag = await conta(env, 'Apagada');
      const T = await conta(env, 'De teste');
      await casa(env, D, 'h1');
      await registo(env, 'h1', 'rec', 'r1', plan(), D);
      await comproprietario(env, D, Desl, ['h1']);
      await comproprietario(env, D, SemPl, ['h1']);
      await comproprietario(env, D, SemMov, ['h1']);
      await comproprietario(env, D, Apag, ['h1']);
      await comproprietario(env, D, T, ['h1']);
      await env.DB.prepare('UPDATE users SET avisos_email = 0 WHERE id = ?').bind(Desl.id).run();
      await desligar(env, SemPl, 'recurring');
      await desligar(env, SemMov, 'transactions');
      await env.DB.prepare('UPDATE users SET deleted_at = 1 WHERE id = ?').bind(Apag.id).run();
      await env.DB.prepare("UPDATE users SET test_owner = 'dev1' WHERE id = ?").bind(T.id).run();
      return { D, Desl, SemPl, SemMov, Apag, T };
    };

    const prod = ambiente({ RESEND_API_KEY: 'k' });
    delete prod.ENV_NAME;
    let enviados = resendFalso();
    const p = await montar(prod);
    await correr(prod);
    assert.deepEqual(enviados.map((e) => e.to[0]), [p.D.email], 'em produção só a dona');
    assert.ok(!/^\[/.test(enviados[0].subject), 'sem prefixo em produção');

    const dev = ambiente({ RESEND_API_KEY: 'k' });
    enviados = resendFalso();
    const d = await montar(dev);
    await correr(dev);
    assert.deepEqual(enviados.map((e) => e.to[0]).sort(), [d.D.email, d.T.email].sort(),
      'fora de produção a conta de teste entra (o enviarEmail desvia só as @teste.rendorium.com)');
    assert.match(enviados[0].subject, /^\[teste\] /);
  });
});

/* ------------------------- uma vez por atraso -------------------------- */

describe('uma vez por atraso', () => {
  test('o primeiro dia manda, o segundo sem novos não, e um atraso novo manda com o antigo em «Continuam»', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1', { name: 'Casa Soure' });
    await registo(env, 'h1', 'rec', 'r1', plan({ next: dia(-2), tx: { kind: 'expense', amount: 40, label: 'Condomínio' } }), D);

    const r1 = await correr(env);
    assert.deepEqual([r1.ok, r1.pessoas, r1.enviados], [true, 1, 1]);
    assert.equal(enviados.length, 1);
    assert.match(enviados[0].text, /Novo em atraso[\s\S]*Condomínio/);
    assert.doesNotMatch(enviados[0].text, /Continua/);
    assert.equal(await um(env, 'SELECT enviado FROM avisos_atraso WHERE rec_id = ?', 'r1'), AGORA, 'gravado com a hora do envio');

    const r2 = await correr(env, AGORA + DIA);
    assert.deepEqual([r2.pessoas, r2.enviados], [0, 0]);
    assert.equal(enviados.length, 1, 'sem novos não há email');

    await registo(env, 'h1', 'rec', 'r2', plan({ next: dia(-1), tx: { kind: 'income', amount: 750, label: 'Renda' } }), D);
    await correr(env, AGORA + 2 * DIA);
    assert.equal(enviados.length, 2);
    const t = enviados[1].text;
    assert.match(enviados[1].subject, /Tens 2 movimentos em atraso$/);
    assert.ok(t.indexOf('Novo em atraso') < t.indexOf('Renda') && t.indexOf('Renda') < t.indexOf('Continua em atraso') &&
      t.indexOf('Continua em atraso') < t.indexOf('Condomínio'), 'o novo em «Novo», o antigo em «Continua»');

    // confirmar avança o next; quando o novo next passa, é um atraso novo da mesma recorrência
    await env.DB.prepare("UPDATE records SET data = ? WHERE id = 'r1'")
      .bind(JSON.stringify(plan({ id: 'r1', next: dia(1), tx: { kind: 'expense', amount: 40, label: 'Condomínio' } }))).run();
    await correr(env, AGORA + 3 * DIA);
    assert.equal(enviados.length, 3);
    assert.match(enviados[2].text, /Novo em atraso[\s\S]*Condomínio[\s\S]*Continua em atraso[\s\S]*Renda/);
    assert.equal(await um(env, "SELECT COUNT(*) FROM avisos_atraso WHERE rec_id = 'r1'"), 2, 'uma linha por next');
  });

  test('sem RESEND_API_KEY nada se envia nem se grava, sem ser uma falha; com a chave, o dia seguinte manda', async () => {
    const env = ambiente();
    const enviados = resendFalso();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'r1', plan(), D);
    const r = await correr(env);
    assert.equal(r.ok, true);
    assert.equal(r.enviados, 0);
    assert.match(r.detalhe, /^1 pessoa, 0 emails enviados \(sem RESEND_API_KEY\)$/);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM avisos_atraso'), 0);
    env.RESEND_API_KEY = 'k';
    await correr(env, AGORA + DIA);
    assert.equal(enviados.length, 1);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM avisos_atraso'), 1);
  });

  test('com o Resend a recusar nada se grava, o resultado diz porquê, e o dia seguinte tenta outra vez', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    let enviados = resendFalso(500);
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'r1', plan(), D);
    const r = await correr(env);
    assert.equal(r.ok, false);
    assert.equal(enviados.length, 1, 'tentou');
    assert.match(r.detalhe, /^1 pessoa, 0 emails enviados; 1 falha: resend 500/);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM avisos_atraso'), 0);
    enviados = resendFalso(200);
    const r2 = await correr(env, AGORA + DIA);
    assert.deepEqual([r2.ok, r2.enviados], [true, 1]);
    assert.match(enviados[0].text, /Novo em atraso/, 'continua a ser novo');
  });

  test('uma pessoa que falha não trava as outras', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = [];
    const D = await conta(env, 'Dona');
    const P = await conta(env, 'Comproprietária');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'r1', plan(), D);
    await comproprietario(env, D, P, ['h1']);
    globalThis.fetch = async (url, op) => {
      const b = JSON.parse(op.body);
      if (b.to[0] === D.email) throw new Error('rede em baixo');
      enviados.push(b);
      return new Response('{}', { status: 200 });
    };
    const r = await correr(env);
    assert.equal(r.ok, false);
    assert.deepEqual(enviados.map((e) => e.to[0]), [P.email]);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM avisos_atraso WHERE user_id = ?', P.id), 1);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM avisos_atraso WHERE user_id = ?', D.id), 0);
  });

  test('as linhas com mais de 400 dias saem no mesmo passo', async () => {
    const env = ambiente();
    await env.DB.prepare("INSERT INTO avisos_atraso (user_id, casa, rec_id, data, enviado) VALUES ('u', 'h', 'velho', '2025-01-01', ?), ('u', 'h', 'novo', '2026-01-01', ?)")
      .bind(AGORA - 401 * DIA, AGORA - 399 * DIA).run();
    await correr(env);
    const ficam = (await env.DB.prepare('SELECT rec_id FROM avisos_atraso').all()).results.map((r) => r.rec_id);
    assert.deepEqual(ficam, ['novo']);
  });

  test('o resumo nunca lança, mesmo com a base em baixo', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    env.DB.prepare = () => { throw new Error('D1 em baixo'); };
    const r = await correr(env);
    assert.equal(r.ok, false);
    assert.match(r.detalhe, /^0 pessoas, 0 emails enviados; 1 falha: D1 em baixo/);
  });
});

/* ------------------------------- a carta ------------------------------- */

describe('a carta', () => {
  const dev = { ENV_NAME: 'dev' };
  const renda = { casa: 'Casa Soure', descricao: 'Renda de Ana', data: '2026-10-01', montante: 1250.5, fluxo: 'in' };
  const imi = { casa: 'Casa Soure', descricao: 'IMI', data: '2026-09-30', montante: 300, fluxo: 'out' };
  const seguro = { casa: SEM_IMOVEL, descricao: 'Seguro <b>', data: '2026-10-10', montante: 9.9, fluxo: 'out' };
  const transf = { casa: 'Apartamento Porto', descricao: 'Acerto', data: '2026-10-11', montante: 20, fluxo: 'none' };

  test('a data e o montante como a app os escreve', () => {
    assert.equal(dataDoAviso('2026-10-01'), '01/10/2026');
    assert.equal(dataDoAviso('nada'), '');
    assert.equal(montanteDoAviso(750), '750,00' + NBSP + '€');
    assert.equal(montanteDoAviso(1250.5), '1' + NBSP + '250,50' + NBSP + '€');
    assert.equal(montanteDoAviso(1234567.891), '1' + NBSP + '234' + NBSP + '567,89' + NBSP + '€');
    assert.equal(montanteDoAviso('x'), '0,00' + NBSP + '€');
  });

  test('o assunto no singular e no plural, por tu, sem «!» nem «(s)»', () => {
    const um1 = cartaAtrasos(dev, [renda], []);
    assert.equal(um1.assunto, 'Tens um movimento em atraso');
    assert.match(um1.texto, /^Tens um movimento em atraso\n\nEste movimento planeado passou a data e ainda não está confirmado na app\./);
    assert.match(um1.texto, /\nNovo em atraso\n/);
    const tres = cartaAtrasos(dev, [renda, imi], [seguro]);
    assert.equal(tres.assunto, 'Tens 3 movimentos em atraso');
    assert.match(tres.texto, /Estes movimentos planeados passaram a data e ainda não estão confirmados na app\./);
    assert.match(tres.texto, /\nNovos em atraso\n/);
    assert.match(tres.texto, /\nContinua em atraso\n/);
    assert.match(cartaAtrasos(dev, [renda], [imi, seguro]).texto, /\nContinuam em atraso\n/);
    for (const c of [um1, tres]) {
      for (const parte of [c.assunto, c.texto, c.html.replace(/<style>[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '')]) {
        assert.doesNotMatch(parte, /!|\(s\)/, 'nem «!» nem «(s)»');
      }
    }
  });

  test('as casas agrupadas, cada linha com a descrição, a data, o montante e o sentido, em html e em texto', () => {
    const c = cartaAtrasos(dev, [imi, renda, transf], [seguro]);
    // o texto
    assert.match(c.texto, /Casa Soure\n- IMI · previsto para 30\/09\/2026 · 300,00 € a pagar\n- Renda de Ana · previsto para 01\/10\/2026 · 1 250,50 € a receber/);
    assert.match(c.texto, /Apartamento Porto\n- Acerto · previsto para 11\/10\/2026 · 20,00 €\n/);
    assert.match(c.texto, /Sem imóvel\n- Seguro <b> · previsto para 10\/10\/2026 · 9,90 € a pagar/);
    assert.match(c.texto, /Abrir os Planeados: https:\/\/dev\.rendorium\.com\/\?planeados/);
    assert.match(c.texto, /Não queres estes avisos\? Desliga-os nas Definições: https:\/\/dev\.rendorium\.com\/\?avisos$/);
    // o html
    assert.match(c.html, /^<!doctype html>/);
    assert.match(c.html, /<title>Tens 4 movimentos em atraso<\/title>/);
    assert.equal(c.html.split('>Casa Soure<').length - 1, 1, 'a casa uma vez, com as duas linhas por baixo');
    assert.match(c.html, />Sem imóvel</);
    assert.match(c.html, /Previsto para 01\/10\/2026/);
    assert.match(c.html, /1 250,50 €/);
    assert.match(c.html, />a receber</);
    assert.match(c.html, />a pagar</);
    assert.match(c.html, /Seguro &lt;b&gt;/, 'a descrição escapada');
    assert.doesNotMatch(c.html, /Seguro <b>/);
    assert.match(c.html, /<a href="https:\/\/dev\.rendorium\.com\/\?planeados"[^>]*>Abrir os Planeados<\/a>/);
    assert.match(c.html, /Não queres estes avisos\? <a href="https:\/\/dev\.rendorium\.com\/\?avisos"[^>]*>Desliga-os nas Definições<\/a>\./);
    assert.ok(c.html.indexOf('Novos em atraso') < c.html.indexOf('Continua em atraso'));
  });

  test('duas casas com o mesmo nome ficam cada uma no seu grupo (agrupa-se pelo id)', () => {
    const c = cartaAtrasos(dev, [{ ...renda, casaId: 'a' }, { ...imi, casaId: 'b' }], []);
    assert.equal(c.html.split('>Casa Soure<').length - 1, 2);
    assert.equal(c.texto.split('\nCasa Soure\n').length - 1, 2);
  });

  test('em produção as ligações são as da app.rendorium.com', () => {
    const c = cartaAtrasos({}, [renda], []);
    assert.match(c.html, /href="https:\/\/app\.rendorium\.com\/\?planeados"/);
    assert.match(c.html, /href="https:\/\/app\.rendorium\.com\/\?avisos"/);
  });

  test('o email que sai: do no-reply, com html e texto, as casas por nome e o «Sem imóvel» no fim', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'hz', { name: 'Vivenda Zambujeira' });
    await casa(env, D, 'ha', { name: 'Apartamento Aveiro' });
    await registo(env, 'hz', 'rec', 'r1', plan({ next: dia(-3), tx: { kind: 'income', amount: 750, label: 'Renda do Rui', contractId: 'c' } }), D);
    await registo(env, 'ha', 'rec', 'r2', plan({ next: dia(-9), name: 'IMI', tx: { kind: 'expense', amount: 120 } }), D);
    await registo(env, 'ha', 'rec', 'r3', plan({ next: dia(-2), name: '', tx: { kind: 'repay', amount: 5, category: 'Juros' } }), D);
    await dadoGlobal(env, D, 'rec', 'r4', plan({ next: dia(-1), tx: { kind: 'expense', amount: 30, label: 'Contabilista' } }));
    await correr(env);
    assert.equal(enviados.length, 1);
    const e = enviados[0];
    assert.equal(e.from, 'Rendorium <no-reply@rendorium.com>');
    assert.equal(e.subject, '[teste] Tens 4 movimentos em atraso');
    assert.ok(e.html && e.text);
    const t = e.text;
    const ordem = ['Apartamento Aveiro', '- IMI · previsto para ' + dataDoAviso(dia(-9)), '- Juros · previsto para ' + dataDoAviso(dia(-2)),
      'Vivenda Zambujeira', '- Renda do Rui', 'Sem imóvel', '- Contabilista'];
    ordem.reduce((antes, s) => { const i = t.indexOf(s); assert.ok(i > antes, s + ' na ordem'); return i; }, -1);
    assert.match(t, /Renda do Rui · previsto para \d\d\/\d\d\/\d{4} · 750,00 € a receber/);
  });
});

/* ------------------------------- o cron -------------------------------- */

describe('o cron de hora a hora', () => {
  /* Um cron inteiro, à espera do que ficou em fundo.
     Recebe: env; cron — o horário ('0 * * * *' ou o CRON_DIARIO); quando — o scheduledTime (ms).
     Devolve: a promessa do fim. */
  const cron = async (env, cronDe, quando) => {
    const fundo = [];
    await worker.scheduled({ cron: cronDe, scheduledTime: quando }, env, { waitUntil(p) { fundo.push(p); } });
    await Promise.all(fundo);
  };
  const HORA = '0 * * * *';

  /* Uma dona com um planeado em atraso.
     Recebe: env.
     Devolve: a promessa da conta. */
  const comAtraso = async (env) => {
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'r1', plan({ next: '2026-01-02' }), D);
    return D;
  };

  test('o de hora a hora corre o resumo depois da vigia e deixa uma linha «atrasos» no op_log', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    const D = await comAtraso(env);
    await cron(env, HORA, AGORA);
    assert.equal(para(enviados, D).length, 1);
    const ops = (await env.DB.prepare('SELECT op, ok, detalhe FROM op_log ORDER BY rowid').all()).results;
    assert.deepEqual(ops.map((o) => o.op), ['vigia', 'atrasos'], 'a vigia primeiro');
    assert.equal(ops[1].ok, 1);
    assert.equal(ops[1].detalhe, '1 pessoa, 1 email enviado');
  });

  test('o cron diário já não manda avisos', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    await comAtraso(env);
    await cron(env, CRON_DIARIO, AGORA);
    assert.equal(enviados.length, 0);
    assert.equal(await um(env, "SELECT COUNT(*) FROM op_log WHERE op = 'atrasos'"), 0);
  });

  test('só a partir das 9h em Lisboa: 8h59 não corre, 9h corre, com a mudança da hora contada', () => {
    assert.equal(horaDosAvisos(Date.UTC(2026, 6, 14, 7, 59)), false, 'verão: 08:59 em Lisboa');
    assert.equal(horaDosAvisos(Date.UTC(2026, 6, 14, 8, 0)), true, 'verão: 09:00 em Lisboa às 08:00 UTC');
    assert.equal(horaDosAvisos(Date.UTC(2026, 0, 14, 8, 59)), false, 'inverno: 08:59 em Lisboa');
    assert.equal(horaDosAvisos(Date.UTC(2026, 0, 14, 9, 0)), true, 'inverno: 09:00 em Lisboa às 09:00 UTC');
    assert.equal(horaDosAvisos(Date.UTC(2026, 9, 24, 8, 0)), true, 'a véspera da mudança: ainda verão');
    assert.equal(horaDosAvisos(Date.UTC(2026, 9, 25, 8, 0)), false, 'no dia da mudança, 08:00 UTC já é 08:00 em Lisboa');
    assert.equal(horaDosAvisos(Date.UTC(2026, 2, 29, 8, 0)), true, 'no dia em que se adianta, 08:00 UTC já é 09:00');
    assert.equal(horaDosAvisos(Date.UTC(2026, 6, 14, 22, 30)), true, '23:30 em Lisboa');
    assert.equal(horaDosAvisos(Date.UTC(2026, 6, 14, 23, 30)), false, '00:30 em Lisboa');
  });

  test('pelo cron: às 8h59 de Lisboa não corre nem deixa linha; às 9h corre', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    await comAtraso(env);
    await cron(env, HORA, Date.UTC(2026, 9, 29, 8, 59));
    assert.equal(enviados.length, 0);
    assert.equal(await um(env, "SELECT COUNT(*) FROM op_log WHERE op = 'atrasos'"), 0);
    await cron(env, HORA, Date.UTC(2026, 9, 29, 9, 0));
    assert.equal(enviados.length, 1);
  });

  test('um erro dos avisos não deita abaixo a vigia nem o batimento, e a linha diz que falhou', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k', HEARTBEAT_URL: 'https://batimento.x/ok' });
    const batidas = [];
    globalThis.fetch = async (url) => { if (String(url).includes('batimento')) batidas.push(url); return new Response('', { status: 200 }); };
    await comAtraso(env);
    const prepare = env.DB.prepare.bind(env.DB);
    env.DB.prepare = (sql) => { if (/json_valid/.test(sql)) throw new Error('D1 em baixo'); return prepare(sql); };
    await cron(env, HORA, AGORA);
    env.DB.prepare = prepare;
    const ops = (await env.DB.prepare('SELECT op, ok, detalhe FROM op_log ORDER BY rowid').all()).results;
    const de = (nome) => ops.find((o) => o.op === nome);
    assert.equal(de('vigia').ok, 1, 'a vigia correu');
    assert.equal(batidas.length, 1, 'o batimento bateu');
    assert.equal(de('atrasos').ok, 0);
    assert.match(de('atrasos').detalhe, /D1 em baixo/);
  });
});

/* -------------------- consultas fixas, teto e um por dia ------------------- */

describe('o que uma execução gasta', () => {
  /* Embrulha a base num contador: cada prepare é uma consulta à D1 (e cada
     instrução de um batch também).
     Recebe: env.
     Devolve: { n } — o contador, que vai subindo. */
  function contar(env) {
    const conta1 = { n: 0 };
    const prepare = env.DB.prepare.bind(env.DB);
    const batch = env.DB.batch.bind(env.DB);
    env.DB.prepare = (sql) => { conta1.n++; return prepare(sql); };
    env.DB.batch = (stmts) => batch(stmts);   // as instruções já contaram no prepare
    return conta1;
  }

  /* N casas da dona, todas com uma comproprietária por partilha, um membro
     de um grupo e uma colaboradora com «Ver planeados», cada casa com um
     planeado em atraso; e um «Sem imóvel» da dona.
     Recebe: n — quantas casas.
     Devolve: a promessa de { env, pessoas }. */
  async function muitas(n) {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const D = await conta(env, 'Dona');
    const P = await conta(env, 'Partilha');
    const G = await conta(env, 'Grupo');
    const C = await conta(env, 'Colaboradora');
    const ids = [];
    for (let i = 0; i < n; i++) {
      ids.push('h' + i);
      await casa(env, D, 'h' + i, { name: 'Casa ' + i });
      await registo(env, 'h' + i, 'rec', 'r' + i, plan({ tx: { kind: 'income', amount: 500 + i, label: 'Renda ' + i, contractId: 'c' + i } }), D);
    }
    await comproprietario(env, D, P, ids);
    await grupo(env, D, [G], ids);
    await colaborador(env, D, C, ['rec.view'], ids);
    await dadoGlobal(env, D, 'rec', 'solto', plan());
    return { env, pessoas: [D, P, G, C] };
  }

  test('o número de consultas é o mesmo com 1 casa e com 60, e não passa de 15', async () => {
    const medidas = [];
    for (const n of [1, 60]) {
      const { env, pessoas } = await muitas(n);
      const enviados = resendFalso();
      const c = contar(env);
      const r = await correr(env);
      assert.equal(r.enviados, 4, n + ' casas: um email por pessoa');
      assert.deepEqual(enviados.map((e) => e.to[0]).sort(), pessoas.map((p) => p.email).sort());
      medidas.push(c.n);
      // e a segunda vez, sem novos e sem emails, gasta menos ainda
      const c2 = contar(env);
      await correr(env, AGORA + DIA);
      assert.ok(c2.n <= 9, 'sem emails: ' + c2.n);
    }
    assert.equal(medidas[0], medidas[1], 'consultas com 1 casa e com 60: ' + medidas.join(' e '));
    assert.ok(medidas[0] <= 15, medidas[0] + ' consultas');
  });

  test('no máximo 20 emails por execução: o resto vai na hora seguinte, e quem já recebeu não recebe outra vez', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    let enviados = resendFalso();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'r1', plan(), D);
    const outros = [];
    for (let i = 0; i < 26; i++) outros.push(await conta(env, 'Pessoa ' + i));
    for (const o of outros) await comproprietario(env, D, o, ['h1']);
    assert.equal(MAX_EMAILS_POR_EXECUCAO, 20);
    const r = await correr(env);
    assert.deepEqual([r.pessoas, r.enviados, r.restantes], [20, 20, 7]);
    assert.equal(r.detalhe, '20 pessoas, 20 emails enviados, 7 para a próxima hora');
    const primeiros = new Set(enviados.map((e) => e.to[0]));
    enviados = resendFalso();
    const r2 = await correr(env, AGORA + 3600000);
    assert.deepEqual([r2.enviados, r2.restantes], [7, 0]);
    assert.equal(r2.detalhe, '7 pessoas, 7 emails enviados');
    assert.ok(enviados.every((e) => !primeiros.has(e.to[0])), 'os da primeira hora não recebem outra vez');
    assert.equal(await um(env, 'SELECT COUNT(DISTINCT user_id) FROM avisos_atraso'), 27);
  });

  test('um por dia: um atraso novo no mesmo dia espera pelo dia seguinte, e vai em «Novo»', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'r1', plan({ tx: { kind: 'expense', amount: 40, label: 'Condomínio' } }), D);
    await correr(env);
    assert.equal(enviados.length, 1);
    await registo(env, 'h1', 'rec', 'r2', plan({ next: dia(-1), tx: { kind: 'expense', amount: 9, label: 'Água' } }), D);
    const r = await correr(env, AGORA + 5 * 3600000);   // 14:00 do mesmo dia
    assert.deepEqual([r.pessoas, r.enviados], [0, 0]);
    assert.equal(enviados.length, 1, 'nada no mesmo dia');
    await correr(env, AGORA + DIA);
    assert.equal(enviados.length, 2);
    assert.match(enviados[1].text, /Novo em atraso[\s\S]*Água[\s\S]*Continua em atraso[\s\S]*Condomínio/);
  });

  test('o dia do «um por dia» é o de Lisboa: um email às 23:30 UTC de verão já é do dia seguinte', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    const enviados = resendFalso();
    const D = await conta(env, 'Dona');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'r1', plan({ next: '2026-07-01' }), D);
    await correr(env, Date.UTC(2026, 6, 14, 22, 0));   // 23:00 de 14 em Lisboa
    await registo(env, 'h1', 'rec', 'r2', plan({ next: '2026-07-02' }), D);
    await correr(env, Date.UTC(2026, 6, 14, 23, 30));  // 00:30 de 15 em Lisboa: outro dia
    assert.equal(enviados.length, 2);
  });
});

/* ------------------------------- a rota -------------------------------- */

describe('GET/POST /api/conta/avisos', () => {
  let env, A;
  beforeEach(async () => { env = ambiente(); A = await conta(env, 'Ana'); });

  test('ligados por omissão; desligar e voltar a ligar', async () => {
    assert.deepEqual(await resp(pedir(env, A, '/api/conta/avisos')), { status: 200, email: true });
    assert.deepEqual(await resp(pedir(env, A, '/api/conta/avisos', 'POST', { email: false })), { status: 200, email: false });
    assert.deepEqual(await resp(pedir(env, A, '/api/conta/avisos')), { status: 200, email: false });
    assert.equal(await um(env, 'SELECT avisos_email FROM users WHERE id = ?', A.id), 0);
    assert.deepEqual(await resp(pedir(env, A, '/api/conta/avisos', 'POST', { email: true })), { status: 200, email: true });
    assert.equal(await um(env, 'SELECT avisos_email FROM users WHERE id = ?', A.id), 1);
  });

  test('um corpo mau é 400 e não mexe em nada', async () => {
    await pedir(env, A, '/api/conta/avisos', 'POST', { email: false });
    for (const corpo of [{}, { email: 'true' }, { email: 1 }, { email: null }, '{nao json', '[]', 'true']) {
      const r = await resp(pedir(env, A, '/api/conta/avisos', 'POST', corpo));
      assert.equal(r.status, 400, JSON.stringify(corpo));
    }
    assert.equal(await um(env, 'SELECT avisos_email FROM users WHERE id = ?', A.id), 0);
  });

  test('sem sessão é 401', async () => {
    assert.equal((await pedir(env, null, '/api/conta/avisos')).status, 401);
    assert.equal((await pedir(env, null, '/api/conta/avisos', 'POST', { email: false })).status, 401);
    assert.equal(await um(env, 'SELECT avisos_email FROM users WHERE id = ?', A.id), 1);
  });

  test('a preferência de uma conta não mexe na de outra', async () => {
    const B = await conta(env, 'Berta');
    await pedir(env, A, '/api/conta/avisos', 'POST', { email: false });
    assert.deepEqual(await resp(pedir(env, B, '/api/conta/avisos')), { status: 200, email: true });
  });
});

/* --------------------------- apagar a conta ---------------------------- */

describe('apagar a conta', () => {
  test('apaga as linhas dela em avisos_atraso; as dos outros ficam', async () => {
    const env = ambiente({ RESEND_API_KEY: 'k' });
    resendFalso();
    const D = await conta(env, 'Dona');
    const P = await conta(env, 'Comproprietária');
    await casa(env, D, 'h1');
    await registo(env, 'h1', 'rec', 'r1', plan(), D);
    await comproprietario(env, D, P, ['h1']);
    await correr(env);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM avisos_atraso'), 2);
    await purgeAccount(env, P.id);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM avisos_atraso WHERE user_id = ?', P.id), 0);
    assert.equal(await um(env, 'SELECT COUNT(*) FROM avisos_atraso WHERE user_id = ?', D.id), 1);
  });
});
