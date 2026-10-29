/* A escrita de uma operação — uma casa, um registo de casa ou um dado global
   do utilizador —, num sítio só. O POST /api/sync é um ciclo sobre ela e as
   rotas REST de rotas/casas.js são um adaptador de uma operação.

   Existiam duas cópias, linha a linha: a recusa por serviço desligado, o
   acesso com o grau, a fusão da ficha e do planeado para um colaborador, a
   regra dos anexos, o UPSERT e o linkFiles. Cada regra nova tinha de entrar
   nos dois — e no dia em que um ficasse para trás, o teste que exercita o
   REST passava e o cliente, que usa o sync, ficava com o comportamento
   errado. Agora uma regra de escrita entra aqui, e vale para os dois.

   EM LOTE. Um pedido com N operações gasta as mesmas consultas à D1 que um
   com uma (aplicarOps): lê de uma vez as casas que o pedido toca e o acesso
   a elas (lerCasas), lê de uma vez as linhas dos registos (lerLinhas) e os
   anexos que a regra dos anexos tem de ver (lerPresos), decide tudo em
   memória com as regras de sempre, e grava com env.DB.batch — um lote para
   as casas, um para os registos, um para prender os anexos. A D1 do plano
   gratuito deixa 50 consultas por invocação do worker e conta um batch como
   UMA, seja qual for o número de instruções lá dentro: «a db.batch() call
   counts as a single query against it, not one query per statement»
   (https://developers.cloudflare.com/d1/platform/limits/, «Queries per
   Worker invocation»; o limite de cada instrução — 100 parâmetros, 100 KB de
   SQL — vale para cada uma dentro do lote). Antes, cada operação gastava três
   consultas sequenciais: um pedido de 200 rebentava o teto à ~15.ª, o resto
   falhava com 500, e o cliente voltava a tentar de 30 em 30 segundos — o «1 a
   1» de quem preencheu 600 rendas (ticket de QA a3a6d2d4).
   Um lote é tudo ou nada: se falhar (outra escrita mudou uma casa — o
   trigger da revisão —, ou outra falha qualquer), cada instrução corre
   sozinha, e uma que falhe é o 500 só da sua operação. Uma escrita
   condicional que não pegou (outra escrita a meio no mesmo registo) volta a
   ler e a fundir na volta seguinte, até três voltas — e à terceira é o 409 de
   sempre. */

import { linkFiles, fileIdsIn } from '../files.js';
import {
  acessoACasa, acessosACasas, regraDoRegisto, planeadoAGravar, apagarCasa, preserveOwnership,
  gravarCasa, comCasaFresca, casaMudou, FRASE_CASA_MUDOU,
} from './acesso.js';
import { fundirCasa, fundirCasaComBase, fusaoIguais, fusaoObjeto, fraseRecusa, temPerm } from './permissoes.js';
import {
  servicosDesligados, kindsDesligados, userKindsDesligados, casaDesligada, servicoDoKind, FRASE_DESLIGADO,
} from './servicos.js';
import { badId, cleanData, tooBig, now } from './http.js';

// O que as escritas de um pedido partilham: os serviços desligados desta
// conta, lidos UMA vez (com o fecho dos que os requerem), o acesso a cada
// casa, resolvido uma vez com o grau (dono, comproprietário ou colaborador),
// e as linhas das casas lidas (com o que este pedido já lá gravou).
// Recebe: env — o ambiente do worker; me — o utilizador com sessão.
// Devolve: promessa do contexto a passar a aplicarOps/aplicarOp.
export async function prepararEscritas(env, me) {
  const desligados = await servicosDesligados(env, me.id);
  return {
    env,
    me,
    kindsOff: kindsDesligados(desligados),
    userKindsOff: userKindsDesligados(desligados),
    semCasas: casaDesligada(desligados),
    acessos: new Map(),
    casas: new Map(),
  };
}

// A forma de uma data AAAA-MM-DD no princípio de um texto.
const DATA_ISO = /^\d{4}-\d{2}-\d{2}/;

// A data AAAA-MM-DD de um valor, ou nada.
// Recebe: v — o valor (texto ISO, com ou sem horas; qualquer outro conta como vazio).
// Devolve: 'AAAA-MM-DD' ou ''.
function dataISO(v) {
  const s = String(v == null ? '' : v);
  return DATA_ISO.test(s) ? s.slice(0, 10) : '';
}

// Uma data AAAA-MM-DD como a app a escreve: DD/MM/AAAA.
// Recebe: iso — 'AAAA-MM-DD'.
// Devolve: o texto 'DD/MM/AAAA'.
function dataPT(iso) {
  return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
}

/* Nada começa antes da compra do imóvel (decisões do Martinho, ticket de QA
   a3a6d2d4, 2026-10-29): um contrato (start), uma receita de uma casa (um
   movimento com kind 'income', pela date) e um crédito da casa
   (loans[].start) não podem ter data anterior à data de compra (purchaseDate
   da casa); as despesas, as prestações e os outros movimentos gravam com
   qualquer data. Sem data de compra, não há limite. Só se recusa o que é
   novo, ou cuja data mudou para antes da compra (numa receita, também a que
   passou a ser receita): um registo que já estava antes (dados de hoje) e
   não mudou continua a gravar — senão contas com dados assim deixavam de
   sincronizar —, e mudar a data de compra de uma casa para depois do que lá
   está não é recusado. Uma lápide (registo apagado) que volta com a mesma
   data é o «desfazer», e passa também.
   Recebe: kind — 'contract', 'tx' ou 'house' (os outros passam sempre);
   novo — o que se vai gravar (já fundido); antigo — o que está na base
   (objeto; null quando não há linha); compra — a data de compra da casa
   (numa casa, a da própria ficha nova).
   Devolve: null quando pode, ou { ok: false, status: 422, error } com a
   frase para o cliente. */
export function recusaPelaCompra(kind, novo, antigo, compra) {
  const c = dataISO(compra);
  if (!c || !novo) return null;
  const recusa = (quem) => ({ ok: false, status: 422, error: quem + ' antes da compra do imóvel (' + dataPT(c) + ').' });
  if (kind === 'contract' || kind === 'tx') {
    const receita = (x) => !!x && x.kind === 'income';
    if (kind === 'tx' && !receita(novo)) return null;
    const campo = kind === 'contract' ? 'start' : 'date';
    const d = dataISO(novo[campo]);
    if (!d || d >= c) return null;
    if (antigo && dataISO(antigo[campo]) === d && (kind === 'contract' || receita(antigo))) return null;
    return recusa(kind === 'contract' ? 'O contrato começa' : 'A receita tem data');
  }
  if (kind === 'house' && Array.isArray(novo.loans)) {
    const antes = new Map();
    ((antigo && Array.isArray(antigo.loans)) ? antigo.loans : []).forEach((l) => { if (l && l.id) antes.set(l.id, l); });
    for (const l of novo.loans) {
      const d = dataISO(l && l.start);
      if (!d || d >= c) continue;
      const velho = l.id ? antes.get(l.id) : null;
      if (velho && dataISO(velho.start) === d) continue;
      return recusa('O crédito «' + String(l.name || l.bank || 'Hipoteca').slice(0, 60) + '» começa');
    }
  }
  return null;
}

// O resultado de uma operação que passou: o que fez, e a quê.
// Recebe: scope — 'house', 'record' ou 'user'; kind — o kind ('house' numa
// casa); acao — 'criado', 'editado' ou 'removido'.
// Devolve: { ok: true, acao, scope, kind }.
function feito(scope, kind, acao) {
  return { ok: true, acao, scope, kind };
}

// O 500 de uma operação: a exceção fica em _erro, para o sync a registar e o
// REST (aplicarOp) a deixar subir até ao index.js, como sempre.
// Recebe: erro — a exceção.
// Devolve: { ok: false, status: 500, _erro }.
function falha(erro) {
  return { ok: false, status: 500, _erro: erro };
}

// O JSON de um objeto, ou null quando o texto não se lê.
// Recebe: s — o texto (a coluna data).
// Devolve: o valor lido, ou null.
function lerJSON(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

/* As instruções que o linkFiles (files.js) correria, sem as correr: um env
   de faz-de-conta apanha cada UPDATE preparado, para entrarem no lote dos
   anexos (prenderAnexos) em vez de gastarem uma consulta cada. As regras do
   filtro (de quem grava, o estrito do colaborador) são as do linkFiles, sem
   cópia.
   Recebe: env — o ambiente do worker; os outros — os do linkFiles (houseId,
   data, kind, recordId, userId, estrito).
   Devolve: promessa da lista das instruções preparadas (vazia sem anexos). */
async function instrucoesDosAnexos(env, houseId, data, kind, recordId, userId, estrito) {
  const lista = [];
  const gravador = {
    DB: {
      prepare: (sql) => {
        const st = env.DB.prepare(sql);
        return { bind: (...a) => { lista.push(st.bind(...a)); return { run: async () => ({ meta: { changes: 0 } }) }; } };
      },
    },
  };
  await linkFiles(gravador, houseId, data, kind, recordId, userId, estrito);
  return lista;
}

/* Corre um lote de instruções. Num lote que falha (a D1 desfá-lo todo), cada
   instrução corre sozinha, para uma má não estragar as outras.
   Recebe: env — o ambiente do worker; stmts — as instruções preparadas.
   Devolve: promessa de uma lista, pela mesma ordem: as linhas que cada uma
   mudou (meta.changes), ou o Error com que falhou. */
async function correrLote(env, stmts) {
  if (!stmts.length) return [];
  try {
    const rs = await env.DB.batch(stmts);
    return stmts.map((s, k) => Number((rs && rs[k] && rs[k].meta && rs[k].meta.changes) || 0));
  } catch (e) {
    const out = [];
    for (const s of stmts) {
      try {
        const r = await s.run();
        out.push(Number((r && r.meta && r.meta.changes) || 0));
      } catch (erro) { out.push(erro instanceof Error ? erro : new Error(String(erro))); }
    }
    return out;
  }
}

/* Lê de uma vez as casas que um pedido toca e o acesso a cada uma
   (acesso.js:acessosACasas) — uma consulta, mais até duas para as que não
   são minhas. As que já estão no contexto não se leem outra vez.
   Recebe: e — o contexto de prepararEscritas; ids — os ids das casas.
   Devolve: promessa de nada — enche e.casas (id → linha {id, owner_id,
   deleted, data, rev}, ou null) e e.acessos. */
async function lerCasas(e, ids) {
  const falta = [...new Set(ids)].filter((id) => !e.casas.has(id));
  if (!falta.length) return;
  const rows = (await e.env.DB.prepare(
    'SELECT id, owner_id, deleted, data, rev FROM houses WHERE id IN (SELECT value FROM json_each(?))'
  ).bind(JSON.stringify(falta)).all()).results;
  falta.forEach((id) => e.casas.set(id, null));
  rows.forEach((r) => e.casas.set(r.id, r));
  const semAcesso = falta.filter((id) => !e.acessos.has(id));
  if (semAcesso.length) (await acessosACasas(e.env, e.me.id, semAcesso, e.casas)).forEach((a, id) => e.acessos.set(id, a));
}

// A recusa de uma operação de um serviço desligado nesta conta. O `servico`
// diz ao cliente QUAL — é o que a distingue do 403 de permissão
// (web/cloud/nucleo.js:servicoRecusado).
// Recebe: id — o id do serviço.
// Devolve: o resultado { ok: false, status: 403, error, servico }.
function desligado(id) {
  return { ok: false, status: 403, error: FRASE_DESLIGADO(id), servico: id };
}

/* A escrita da ficha de um imóvel, decidida em memória com a linha e o
   acesso já lidos — devolve a instrução, não a corre (escreverCasas mete-a
   num lote; umaCasa corre-a sozinha): criar, gravar a ficha, ressuscitar (só o dono: é o
   «desfazer» da app). Gravar uma ficha que já existe é sempre uma fusão com o
   que está na base (permissoes.js:fundirCasaComBase): com a base que o
   cliente leu, só entra o que ele mudou; sem ela, nada sai das listas com
   ids. Um colaborador (só com house.edit) passa ainda pelo fundirCasa — o
   cliente dele não tem hipotecas nem valor, e o que o cargo não vê nem entra
   nem sai. Um crédito que começa antes da compra (recusaPelaCompra) recusa a
   ficha. Uma fusão que deixa a casa como estava não grava (não gasta a
   escrita nem muda a revisão), mas volta a prender os anexos.
   Recebe: e — o contexto; o — a operação validada ({houseId, data, base});
   linha — a linha de houses ({owner_id, deleted, data, rev}) ou null.
   Devolve: { res, dados?, estrito?, criada?, sql? } — o resultado, a ficha a
   gravar, se quem grava é colaborador, se a casa nasce (ou renasce), e a
   instrução a correr (gravarCasa por cima da revisão lida, ou o INSERT). */
function escreverCasa(e, o, linha) {
  const { env, me } = e;
  const { houseId, data, base } = o;
  if (linha && !linha.deleted) {
    const a = e.acessos.get(houseId);
    if (!a || !a.ok) return { res: { ok: false, status: 403, error: fraseRecusa('acesso') } };
    if (a.collab && !a.collab.perms.has('house.edit')) return { res: { ok: false, status: 403, error: fraseRecusa('casa') } };
    let dados = fundirCasaComBase(linha.data, data, base);
    if (a.collab) dados = fundirCasa(linha.data, dados, a.collab.perms);
    dados = preserveOwnership(linha.data, dados);
    const antes = lerJSON(linha.data);
    const recusa = recusaPelaCompra('house', dados, antes, dados.purchaseDate);
    if (recusa) return { res: recusa };
    if (fusaoIguais(dados, antes)) return { res: Object.assign(feito('house', 'house', 'editado'), { igual: true }), dados, estrito: !!a.collab };
    return {
      res: feito('house', 'house', 'editado'), dados, estrito: !!a.collab,
      sql: gravarCasa(env, houseId, linha.rev, { data: JSON.stringify(dados) }, now()),
    };
  }
  if (linha && linha.owner_id !== me.id) return { res: { ok: false, status: 403 } };
  const dados = preserveOwnership('', data);
  const recusa = recusaPelaCompra('house', dados, linha ? lerJSON(linha.data) : null, dados.purchaseDate);
  if (recusa) return { res: recusa };
  return {
    res: feito('house', 'house', 'criado'), dados, estrito: false, criada: true,
    sql: linha
      ? gravarCasa(env, houseId, linha.rev, { data: JSON.stringify(dados), deleted: 0 }, now())
      : env.DB.prepare('INSERT INTO houses (id, owner_id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0)')
        .bind(houseId, me.id, JSON.stringify(dados), now()),
  };
}

/* Depois de a ficha de uma casa ficar gravada (ou de se ver que não havia
   nada a gravar): o contexto passa a saber a ficha nova (os registos do
   mesmo pedido olham para a data de compra dela), quem cria fica dono, e os
   anexos da ficha entram no lote dos anexos.
   Recebe: e — o contexto; o — a operação; d — a decisão de escreverCasa;
   anexos — a lista das instruções do linkFiles do pedido.
   Devolve: promessa de nada. */
async function casaGravada(e, o, d, anexos) {
  const antes = e.casas.get(o.houseId);
  e.casas.set(o.houseId, {
    id: o.houseId, owner_id: d.criada ? e.me.id : antes.owner_id, deleted: 0,
    data: JSON.stringify(d.dados), rev: d.sql ? null : antes.rev,
  });
  if (d.criada) e.acessos.set(o.houseId, { ok: true, owner: true, coowner: false, collab: null, ownerId: e.me.id });
  anexos.push(...(await instrucoesDosAnexos(e.env, o.houseId, d.dados, 'house', o.houseId, e.me.id, d.estrito)));
}

/* As fichas de imóveis de um pedido: decididas com as linhas e os acessos
   lidos de uma vez (lerCasas) e gravadas num lote. Se o lote falhar — outra
   escrita mudou uma das casas entre a leitura e a escrita (o trigger da
   revisão desfaz o lote todo), ou outra falha —, cada casa grava-se
   sozinha, como antes (umaCasa). A mesma casa duas vezes no pedido: a
   segunda vai sozinha, depois, por cima da primeira.
   Recebe: e — o contexto; lista — as operações put de casas, validadas;
   res — os resultados do pedido (preenchidos aqui); anexos — a lista das
   instruções do linkFiles do pedido.
   Devolve: promessa de nada. */
async function escreverCasas(e, lista, res, anexos) {
  const vistas = new Set(), lote = [];
  let sozinhas = [];
  for (const o of lista) {
    if (vistas.has(o.houseId)) { sozinhas.push(o); continue; }
    vistas.add(o.houseId);
    const d = escreverCasa(e, o, e.casas.get(o.houseId));
    if (d.sql) { lote.push({ o, d }); continue; }
    res[o.i] = d.res;
    if (d.res.ok) await casaGravada(e, o, d, anexos);
  }
  if (lote.length) {
    try {
      await e.env.DB.batch(lote.map((x) => x.d.sql));
      for (const x of lote) { res[x.o.i] = x.d.res; await casaGravada(e, x.o, x.d, anexos); }
    } catch (erro) {
      sozinhas = sozinhas.concat(lote.map((x) => x.o)).sort((a, b) => a.i - b.i);
    }
  }
  for (const o of sozinhas) res[o.i] = await umaCasa(e, o, anexos);
}

/* Uma ficha de imóvel gravada sozinha: lê a casa (com a revisão) e o acesso,
   decide (escreverCasa) e grava por cima da revisão lida
   (acesso.js:gravarCasa); outra escrita a meio repete tudo (a fusão
   incluída), e à terceira desiste com um 409 que não mexeu em nada.
   Recebe: e — o contexto; o — a operação; anexos — a lista das instruções
   do linkFiles do pedido.
   Devolve: promessa do resultado da operação (uma exceção é o seu 500). */
async function umaCasa(e, o, anexos) {
  try {
    return await comCasaFresca(async () => {
      const linha = await e.env.DB.prepare('SELECT id, owner_id, deleted, data, rev FROM houses WHERE id = ?')
        .bind(o.houseId).first();
      e.casas.set(o.houseId, linha);
      if (linha && !linha.deleted) e.acessos.set(o.houseId, await acessoACasa(e.env, e.me.id, o.houseId));
      const d = escreverCasa(e, o, linha);
      if (d.sql) await d.sql.run();
      if (d.res.ok) await casaGravada(e, o, d, anexos);
      return d.res;
    });
  } catch (erro) {
    if (casaMudou(erro)) return { ok: false, status: 409, error: FRASE_CASA_MUDOU };
    return falha(erro);
  }
}

/* Apagar um imóvel (só o dono): a casa e tudo o que lhe está preso
   (acesso.js:apagarCasa). Apagar o que já não existe é { ok, gone }.
   Recebe: e — o contexto; houseId — o id da casa.
   Devolve: promessa do resultado da operação (uma exceção é o seu 500). */
async function apagarImovel(e, houseId) {
  const { env, me } = e;
  try {
    return await comCasaFresca(async () => {
      const existing = await env.DB.prepare('SELECT owner_id, deleted FROM houses WHERE id = ?').bind(houseId).first();
      if (!existing || existing.deleted) return { ok: true, gone: true };
      if (existing.owner_id !== me.id) return { ok: false, status: 403 };
      await apagarCasa(env, houseId, me.id);
      e.acessos.delete(houseId);
      e.casas.delete(houseId);
      return feito('house', 'house', 'removido');
    });
  } catch (erro) {
    if (casaMudou(erro)) return { ok: false, status: 409, error: FRASE_CASA_MUDOU };
    return falha(erro);
  }
}

// O acesso de quem não chega a uma casa (inexistente, apagada, ou de outros).
const SEM_ACESSO = { ok: false, owner: false, coowner: false, collab: null, ownerId: null };

// O separador das partes de uma chave de linha (não aparece num id: badId).
const SEP = '\u0000';

// A chave de uma operação de registo ou de dado global, a mesma da leitura.
// Recebe: o — a operação validada ({scope, houseId, kind, id}).
// Devolve: o texto da chave.
function chaveDe(o) {
  return (o.scope === 'user' ? 'u' : 'r' + o.houseId) + SEP + o.kind + SEP + o.id;
}

/* Lê de uma vez as linhas que as operações de registos e de dados globais
   tocam: uma consulta para os registos das casas e uma para os dados da
   conta, com as chaves numa lista JSON (o json_each põe os 200 de um pedido
   num só parâmetro — a D1 aceita 100 por instrução).
   Recebe: e — o contexto; ops — as operações validadas (scope 'record' ou 'user').
   Devolve: promessa de um Map chaveDe → linha ({data, deleted, created_by?}). */
async function lerLinhas(e, ops) {
  const out = new Map();
  const reg = ops.filter((o) => o.scope === 'record'), glob = ops.filter((o) => o.scope === 'user');
  if (reg.length) {
    const rows = (await e.env.DB.prepare(
      `SELECT r.house_id, r.kind, r.id, r.data, r.deleted, r.created_by
         FROM json_each(?) j
         JOIN records r ON r.house_id = json_extract(j.value, '$[0]')
                       AND r.kind = json_extract(j.value, '$[1]') AND r.id = json_extract(j.value, '$[2]')`
    ).bind(JSON.stringify(reg.map((o) => [o.houseId, o.kind, o.id]))).all()).results;
    rows.forEach((r) => out.set('r' + r.house_id + SEP + r.kind + SEP + r.id, r));
  }
  if (glob.length) {
    const rows = (await e.env.DB.prepare(
      `SELECT u.kind, u.id, u.data, u.deleted
         FROM json_each(?2) j
         JOIN user_records u ON u.user_id = ?1
                            AND u.kind = json_extract(j.value, '$[0]') AND u.id = json_extract(j.value, '$[1]')`
    ).bind(e.me.id, JSON.stringify(glob.map((o) => [o.kind, o.id]))).all()).results;
    rows.forEach((r) => out.set('u' + SEP + r.kind + SEP + r.id, r));
  }
  return out;
}

// Se a regra dos anexos tem de olhar para esta escrita: um colaborador sem
// file.add (os outros juntam o que quiserem).
// Recebe: a — o objeto de acessoACasa.
// Devolve: true quando tem.
function vigiaAnexos(a) {
  return !!(a && a.collab && !temPerm(a.collab.perms, 'file.add'));
}

/* Lê de uma vez onde estão presos os anexos que a regra dos anexos tem de
   ver: os que as escritas de um colaborador sem file.add referem — no que
   chega e no que está na base, que é de onde a fusão os tira. Uma consulta,
   e só quando há escritas assim; os que já se leram não se leem outra vez.
   Recebe: e — o contexto; ops — as operações; linhas — as de lerLinhas;
   presos — o Map id → {house_id, record_kind, record_id} (ou null), cheio aqui.
   Devolve: promessa de nada. */
async function lerPresos(e, ops, linhas, presos) {
  const ids = new Set();
  ops.forEach((o) => {
    if (o.scope !== 'record' || !o.put || !vigiaAnexos(e.acessos.get(o.houseId))) return;
    const row = linhas.get(chaveDe(o));
    fileIdsIn(o.data).concat(row ? fileIdsIn(lerJSON(row.data)) : []).forEach((id) => { if (!presos.has(id)) ids.add(id); });
  });
  if (!ids.size) return;
  const lista = [...ids];
  lista.forEach((id) => presos.set(id, null));
  const rows = (await e.env.DB.prepare(
    'SELECT id, house_id, record_kind, record_id FROM files WHERE id IN (SELECT value FROM json_each(?))'
  ).bind(JSON.stringify(lista)).all()).results;
  rows.forEach((r) => presos.set(r.id, r));
}

/* A regra dos anexos numa escrita de registo: um colaborador só junta anexos
   a um registo com file.add. «Juntar» é referir um id que ainda não esteja
   preso a ESTE registo — o tuplo completo (casa, kind, id) — e o que já lá
   estava (posto pelo dono, ou por ele próprio antes) não conta, para editar o
   registo sem mexer nos anexos continuar a passar. Sem isto, carregar solto
   (PUT /api/files/:id sem ?casa=) e gravar o registo era o caminho por onde o
   file.add não se via. É a regra de files.js:regraDosAnexos, com os anexos
   lidos de uma vez para o pedido inteiro (lerPresos).
   Recebe: a — o objeto de acessoACasa; houseId, kind, rid — a linha; dados —
   o registo que se vai gravar; presos — o Map de lerPresos.
   Devolve: null quando pode, ou { ok: false, status: 403, error } com a frase. */
function recusaDosAnexos(a, houseId, kind, rid, dados, presos) {
  if (!vigiaAnexos(a)) return null;
  const ids = [...new Set(fileIdsIn(dados))];
  const preso = (id) => {
    const f = presos.get(id);
    return !!f && f.house_id === houseId && f.record_kind === String(kind) && f.record_id === String(rid);
  };
  return ids.every(preso) ? null : { ok: false, status: 403, error: fraseRecusa('anexo') };
}

// A data de compra de uma casa do pedido (a ficha mais recente que ele
// conhece, a que acabou de gravar incluída), lida uma vez por ficha.
// Recebe: e — o contexto; houseId — o id da casa.
// Devolve: 'AAAA-MM-DD', ou '' sem data (ou sem casa).
function compraDe(e, houseId) {
  const l = e.casas.get(houseId);
  if (!l) return '';
  if (l._compra === undefined) l._compra = dataISO((lerJSON(l.data) || {}).purchaseDate);
  return l._compra;
}

/* A escrita de um registo de casa ou de um dado global, decidida em memória
   com a linha já lida — devolve a instrução, não a corre (escreverLinhas
   junta as de um pedido num lote).
   Um registo de uma casa: a regra única (acesso.js:regraDoRegisto); ao
   apagar, uma casa inacessível conta como «já não existe». A gravar, funde
   com o que está na base como a casa: com a base que o cliente leu, só entra
   o que ele mudou; sem ela, os campos que chegam ganham e nada sai
   (permissoes.js:fundirCasaComBase). Um registo apagado (a lápide) ou novo
   grava-se como chega — criar e ressuscitar não fundem. O planeado do dono
   confirmado por um colaborador continua a só mudar next/until/muted
   (acesso.js:planeadoAGravar, por cima da fusão); depois a regra dos anexos
   (recusaDosAnexos) e a da data de compra (recusaPelaCompra). Uma fusão que
   deixa o registo como estava não grava (nem muda o autor).
   Um dado global (user_records): só da conta, sem casa; funde da mesma
   maneira — dois aparelhos da mesma conta não se esmagam.
   A escrita só pega se a linha ainda for a que se leu (o data e o deleted
   na condição do UPDATE; o INSERT de um novo não pisa um que entretanto
   apareceu): quem chama vê as linhas mudadas e repete.
   Recebe: e — o contexto; o — a operação validada; row — a linha lida, ou
   null; presos — o Map de lerPresos.
   Devolve: { res, dados?, estrito?, sql? } — o resultado se a escrita
   pegar, o que se grava, se quem grava é colaborador, e a instrução. */
function gravarRegisto(e, o, row, presos) {
  const { env, me } = e;
  const user = o.scope === 'user';
  const vivo = !!row && !row.deleted;
  // author é o último a escrever (o sino usa-o); created_by é o criador e
  // nunca muda — é o que decide «só o que criou»
  const chave = user ? [me.id, o.kind, o.id] : [o.houseId, o.kind, o.id];
  const tabela = user ? 'user_records' : 'records';
  const onde = user ? 'user_id = ? AND kind = ? AND id = ?' : 'house_id = ? AND kind = ? AND id = ?';
  let a = null, dados = o.data;
  if (!user) {
    a = e.acessos.get(o.houseId) || SEM_ACESSO;
    const veredicto = regraDoRegisto(me, a, o.kind, row, o.put);
    if (veredicto) {
      return { res: veredicto.gone ? { ok: true, gone: true } : { ok: false, status: veredicto.status, error: veredicto.error } };
    }
  }
  if (!o.put) {
    return {
      res: vivo ? feito(o.scope, o.kind, 'removido') : { ok: true },
      sql: env.DB.prepare(`UPDATE ${tabela} SET deleted = 1, updated_at = ? WHERE ${onde}`).bind(now(), ...chave),
    };
  }
  const antes = row ? lerJSON(row.data) : null;
  if (vivo) dados = fundirCasaComBase(row.data, o.data, o.base);
  if (!user) {
    // o planeado de outrem que um colaborador confirma: só next/until/muted
    // entram, por cima do que a fusão deu
    dados = planeadoAGravar(me, a, o.kind, row, dados);
    const recusa = recusaDosAnexos(a, o.houseId, o.kind, o.id, dados, presos)
      || recusaPelaCompra(o.kind, dados, antes, compraDe(e, o.houseId));
    if (recusa) return { res: recusa };
  }
  const estrito = !!(a && a.collab);
  if (vivo && fusaoIguais(dados, antes)) {
    return { res: Object.assign(feito(o.scope, o.kind, 'editado'), { igual: true }), dados, estrito };
  }
  const texto = JSON.stringify(dados), t = now();
  let sql;
  if (row) {
    sql = user
      ? env.DB.prepare(
        `UPDATE user_records SET data = ?, updated_at = ?, deleted = 0
          WHERE user_id = ? AND kind = ? AND id = ? AND data IS ? AND deleted IS ?`
      ).bind(texto, t, ...chave, row.data, row.deleted)
      : env.DB.prepare(
        `UPDATE records SET data = ?, updated_at = ?, deleted = 0, author = ?, created_by = COALESCE(created_by, ?)
          WHERE house_id = ? AND kind = ? AND id = ? AND data IS ? AND deleted IS ?`
      ).bind(texto, t, me.id, me.id, ...chave, row.data, row.deleted);
  } else {
    sql = user
      ? env.DB.prepare(
        `INSERT INTO user_records (user_id, kind, id, data, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT (user_id, kind, id) DO NOTHING`
      ).bind(...chave, texto, t)
      : env.DB.prepare(
        `INSERT INTO records (house_id, kind, id, data, updated_at, deleted, author, created_by)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?) ON CONFLICT (house_id, kind, id) DO NOTHING`
      ).bind(...chave, texto, t, me.id, me.id);
  }
  return { res: feito(o.scope, o.kind, vivo ? 'editado' : 'criado'), dados, estrito, sql };
}

// Uma operação de registo ou de dado global que ficou decidida: o resultado
// entra na lista, e os anexos de um registo gravado (ou igual) entram no
// lote dos anexos.
// Recebe: e — o contexto; o — a operação; d — a decisão de gravarRegisto;
// res — os resultados do pedido; anexos — as instruções do linkFiles.
// Devolve: promessa de nada.
async function linhaDecidida(e, o, d, res, anexos) {
  res[o.i] = d.res;
  if (o.scope === 'record' && o.put && d.res.ok && d.dados) {
    anexos.push(...(await instrucoesDosAnexos(e.env, o.houseId, d.dados, o.kind, o.id, e.me.id, d.estrito)));
  }
}

/* Os registos das casas e os dados globais de um pedido, em voltas: cada
   volta lê as linhas que faltam decidir (lerLinhas, e os anexos de
   lerPresos), decide tudo em memória (gravarRegisto) e grava num lote
   (correrLote). Uma escrita condicional que não pegou — outra escrita mudou a
   linha entre a leitura e a escrita — volta a ler e a fundir na volta
   seguinte; à terceira desiste com o 409 da casa, sem mexer em nada. Uma
   remoção pega sempre. A mesma linha duas vezes no pedido (confirmar o
   planeado e logo apagá-lo): cada volta leva só a primeira, e a seguinte vai
   na volta a seguir, por cima do que a primeira deixou — como se fossem uma
   a uma. Num pedido sem linhas repetidas, uma volta chega.
   Recebe: e — o contexto; ops — as operações validadas, pela ordem do
   pedido; res — os resultados do pedido (preenchidos aqui); anexos — as
   instruções do linkFiles.
   Devolve: promessa de nada. */
async function escreverLinhas(e, ops, res, anexos) {
  let pendentes = ops;
  const presos = new Map(), tentativas = new Map();
  while (pendentes.length) {
    const vez = [], seguintes = [], vistas = new Set();
    pendentes.forEach((o) => {
      const k = chaveDe(o);
      if (vistas.has(k)) seguintes.push(o);
      else { vistas.add(k); vez.push(o); }
    });
    const linhas = await lerLinhas(e, vez);
    await lerPresos(e, vez, linhas, presos);
    const lote = [];
    for (const o of vez) {
      const d = gravarRegisto(e, o, linhas.get(chaveDe(o)) || null, presos);
      if (d.sql) lote.push({ o, d });
      else await linhaDecidida(e, o, d, res, anexos);
    }
    const mexeu = await correrLote(e.env, lote.map((x) => x.d.sql));
    for (let k = 0; k < lote.length; k++) {
      const { o, d } = lote[k];
      if (mexeu[k] instanceof Error) res[o.i] = falha(mexeu[k]);
      else if (!o.put || mexeu[k] > 0) await linhaDecidida(e, o, d, res, anexos);
      else if ((tentativas.get(o.i) || 0) + 1 >= 3) res[o.i] = { ok: false, status: 409, error: FRASE_CASA_MUDOU };
      else { tentativas.set(o.i, (tentativas.get(o.i) || 0) + 1); seguintes.push(o); }
    }
    pendentes = seguintes.sort((a, b) => a.i - b.i);
  }
}

/* Prende os anexos das escritas que pegaram, num lote (as instruções do
   linkFiles, apanhadas por instrucoesDosAnexos). Uma falha não estraga a
   gravação, como sempre no linkFiles: o anexo pode ainda não ter chegado.
   Recebe: e — o contexto; anexos — as instruções.
   Devolve: promessa de nada. */
async function prenderAnexos(e, anexos) {
  await correrLote(e.env, anexos);
}

/* Valida uma operação { op: 'put'|'del', scope: 'house'|'record'|'user',
   houseId, kind, id, data, base? } sozinha: ids pela forma de badId, o corpo
   e a base por cleanData — o id da linha manda — e tooBig. A base (um
   objeto: os campos que o cliente mudou, como os leu) vale nos três âmbitos;
   sem ela, ou com null, a fusão é a de sem base.
   Recebe: op — a operação (o data é limpo no próprio sítio).
   Devolve: { res } com a recusa (400/413), ou a operação normalizada
   { put, scope, houseId, kind, id, data, base } — numa casa, kind 'house' e
   id = houseId. */
function validarOp(op) {
  const nao = (status) => ({ res: { ok: false, status } });
  if (!op || (op.op !== 'put' && op.op !== 'del')) return nao(400);
  if (op.scope !== 'house' && op.scope !== 'record' && op.scope !== 'user') return nao(400);
  const put = op.op === 'put';
  if (op.scope !== 'user' && badId(op.houseId)) return nao(400);
  if (op.scope !== 'house' && (badId(op.kind) || badId(op.id))) return nao(400);
  if (put) {
    op.data = cleanData(op.data, op.scope === 'house' ? String(op.houseId) : String(op.id));
    if (!op.data) return nao(400);
    if (tooBig(op.data)) return nao(413);
  }
  let base;
  if (put && op.base != null) {
    if (!fusaoObjeto(op.base)) return nao(400);
    base = cleanData(op.base);
    if (tooBig(base)) return nao(413);
  }
  const casa = op.scope === 'house';
  return {
    put, scope: op.scope,
    houseId: op.scope === 'user' ? undefined : String(op.houseId),
    kind: casa ? 'house' : String(op.kind),
    id: casa ? String(op.houseId) : String(op.id),
    data: op.data, base,
  };
}

/* Aplica as operações de um pedido, com as consultas à D1 que não crescem com
   o número delas (o cabeçalho deste ficheiro). Cada uma é validada sozinha
   (validarOp) e escrita com as regras do seu âmbito; uma com o kind num
   serviço desligado (ou sem Imóveis) não entra nem sai. Por fases, pela ordem
   em que o cliente as manda (web/cloud/nucleo.js:pushNow): as fichas das
   casas (os registos precisam delas, e da data de compra que trazem), depois
   os registos e os dados globais, depois as casas apagadas, e por fim os
   anexos de tudo o que ficou gravado. Uma falha numa operação não trava as
   outras.
   Recebe: e — o contexto de prepararEscritas; ops — a lista de operações.
   Devolve: promessa da lista dos resultados, pela mesma ordem: { ok: true,
   acao: 'criado'|'editado'|'removido', scope, kind, igual? } (igual: a
   fusão deixou-o como estava e nada se gravou), { ok: true } (apagar uma
   linha já apagada), { ok: true, gone: true } (apagar o que já não existe),
   ou { ok: false, status, error?, servico?, _erro? } — _erro é a exceção de
   um 500. */
export async function aplicarOps(e, ops) {
  const res = new Array(ops.length);
  const casas = [], apagar = [], linhas = [];
  ops.forEach((op, i) => {
    const v = validarOp(op);
    if (v.res) { res[i] = v.res; return; }
    const o = Object.assign({ i }, v);
    if (o.scope === 'house') {
      if (e.semCasas) res[i] = desligado('properties');
      else (o.put ? casas : apagar).push(o);
    } else if (o.scope === 'record') {
      if (e.kindsOff.has(o.kind)) res[i] = desligado(servicoDoKind(o.kind));
      else if (e.semCasas) res[i] = desligado('properties');
      else linhas.push(o);
    } else if (e.userKindsOff.has(o.kind)) res[i] = desligado(servicoDoKind(o.kind, 'user'));
    else linhas.push(o);
  });
  const anexos = [];
  await lerCasas(e, casas.concat(linhas.filter((o) => o.scope === 'record')).map((o) => o.houseId));
  await escreverCasas(e, casas, res, anexos);
  await escreverLinhas(e, linhas, res, anexos);
  for (const o of apagar) res[o.i] = await apagarImovel(e, o.houseId);
  await prenderAnexos(e, anexos);
  return res;
}

/* Aplica uma operação sozinha — a das rotas REST de rotas/casas.js — pelo
   mesmo caminho do /api/sync (aplicarOps). Uma exceção sobe até ao
   index.js, como sempre no REST.
   Recebe: e — o contexto de prepararEscritas; op — a operação.
   Devolve: promessa do resultado da operação (a forma de aplicarOps). */
export async function aplicarOp(e, op) {
  const [r] = await aplicarOps(e, [op]);
  if (r && r._erro) throw r._erro;
  return r;
}
