/* O que a ferramenta de equipa pode fazer.
   ----------------------------------------
   As mesmas regras do bot, pelos mesmos papéis: o suporte vê os pedidos
   contados por pessoas, quem programa vê os erros, e nenhum deles vê o do
   outro. A diferença é a forma — aqui procura-se e navega-se, que é o que
   um canal de Discord não sabe fazer.

   Nada aqui devolve dados de imóveis, contratos ou movimentos. Quem faz
   suporte precisa de saber com quem fala e o que essa pessoa escreveu, não
   de lhe ver as contas. */

import { json, err, body, now, badId } from './lib/http.js';
import { CATS_DO_PAPEL } from './discord.js';

const cortar = (s, n) => {
  const t = String(s == null ? '' : s);
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

function categoriasDe(pap) {
  return CATS_DO_PAPEL[pap] || [];
}

/* A ficha de quem escreveu. É a mesma informação que o bot mostra, e pela
   mesma razão: responder sem saber quem é a pessoa é responder às cegas. */
async function ficha(env, userId) {
  if (!userId) return null;
  const u = await env.DB.prepare(
    'SELECT id, name, email, plan, created_at, deleted_at, terms_version FROM users WHERE id = ?'
  ).bind(userId).first();
  if (!u) return { id: userId, desconhecido: true };
  const q = async (sql) => ((await env.DB.prepare(sql).bind(userId).first()) || {}).n || 0;
  return {
    id: u.id,
    nome: u.name || '',
    email: u.email,
    plano: u.plan,
    desde: u.created_at,
    apagada: !!u.deleted_at,
    aceitouTermos: !!u.terms_version,
    casas: await q('SELECT COUNT(*) AS n FROM houses WHERE owner_id = ? AND deleted = 0'),
    registos: await q(
      'SELECT COUNT(*) AS n FROM records r JOIN houses h ON h.id = r.house_id WHERE h.owner_id = ? AND r.deleted = 0'
    ),
    pedidos: await q("SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND category = 'user'"),
    errosApanhados: await q('SELECT COUNT(*) AS n FROM ticket_users WHERE user_id = ?'),
  };
}

export async function rotasEquipaApi(c) {
  const { env, request, path, method, url, eu } = c;
  const cats = categoriasDe(eu.papel);
  if (!cats.length) return err(403, 'O teu papel não vê pedidos.');

  const marcas = cats.map(() => '?').join(',');

  /* ---- lista, com procura e filtro ---- */
  if (path === '/api/equipa/pedidos' && method === 'GET') {
    const estado = (url.searchParams.get('estado') || '').trim();
    const procura = (url.searchParams.get('q') || '').trim().slice(0, 80);
    const onde = ['category IN (' + marcas + ')'];
    const vals = [...cats];
    if (estado === 'abertos') onde.push("status <> 'concluido'");
    else if (estado) { onde.push('status = ?'); vals.push(estado); }
    if (procura) {
      // procura pelo assunto, pelo corpo ou por quem escreveu
      onde.push('(subject LIKE ? OR body LIKE ? OR user_id IN (SELECT id FROM users WHERE email LIKE ? OR name LIKE ?))');
      const p = '%' + procura + '%';
      vals.push(p, p, p, p);
    }
    const rows = (await env.DB.prepare(
      `SELECT t.id, t.kind, t.subject, t.status, t.category, t.user_id, t.n, t.versao,
              t.created_at, t.updated_at, t.reply,
              u.name AS nome, u.email AS email,
              (SELECT COUNT(*) FROM ticket_users x WHERE x.fingerprint = t.fingerprint) AS pessoas
         FROM tickets t LEFT JOIN users u ON u.id = t.user_id
        WHERE ` + onde.join(' AND ') +
      ' ORDER BY (t.status <> \'concluido\') DESC, t.updated_at DESC LIMIT 100'
    ).bind(...vals).all()).results;
    return json({ pedidos: rows, papel: eu.papel, categorias: cats });
  }

  /* ---- um pedido, com a ficha de quem escreveu ---- */
  const mDetalhe = /^\/api\/equipa\/pedidos\/([^/]+)$/.exec(path);
  if (mDetalhe && method === 'GET') {
    const id = decodeURIComponent(mDetalhe[1]);
    if (badId(id)) return err(400, 'Id inválido.');
    const t = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
    if (!t) return err(404, 'Pedido não encontrado.');
    if (cats.indexOf(t.category) < 0) return err(403, 'Esse pedido é de outro papel.');
    const outros = (await env.DB.prepare(
      `SELECT id, subject, status, created_at FROM tickets
        WHERE user_id = ? AND id <> ? AND category = 'user' ORDER BY created_at DESC LIMIT 10`
    ).bind(t.user_id, id).all()).results;
    return json({ pedido: t, quem: await ficha(env, t.user_id), outros });
  }

  /* ---- responder e fechar ---- */
  const mAcao = /^\/api\/equipa\/pedidos\/([^/]+)\/(responder|fechar|reabrir)$/.exec(path);
  if (mAcao && method === 'POST') {
    const id = decodeURIComponent(mAcao[1]), acao = mAcao[2];
    if (badId(id)) return err(400, 'Id inválido.');
    const t = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
    if (!t) return err(404, 'Pedido não encontrado.');
    if (cats.indexOf(t.category) < 0) return err(403, 'Esse pedido é de outro papel.');

    const b = await body(request);
    const texto = String((b && b.texto) || '').trim().slice(0, 2000);
    const estado = acao === 'fechar' ? 'concluido' : acao === 'reabrir' ? 'criado' : 'resolucao';
    if (acao === 'responder' && !texto) return err(400, 'Escreve a resposta.');

    await env.DB.prepare(
      'UPDATE tickets SET status = ?, reply = COALESCE(?, reply), updated_at = ? WHERE id = ?'
    ).bind(estado, texto || null, now(), id).run();

    /* Fica registo de quem mexeu. Enquanto não houver auditoria a sério, é o
       mínimo: sem isto, uma resposta na ferramenta não tem autor nenhum. */
    const marca = '\n\n[' + eu.papel + ' ' + eu.nome + ' · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ']';
    await env.DB.prepare('UPDATE tickets SET context = COALESCE(context, \'\') || ? WHERE id = ?')
      .bind(cortar(marca, 120), id).run();

    const novo = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
    return json({ pedido: novo });
  }

  /* ---- procurar uma pessoa ---- */
  if (path === '/api/equipa/pessoas' && method === 'GET') {
    if (cats.indexOf('user') < 0) return err(403, 'O teu papel não vê pessoas.');
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    if (q.length < 3) return err(400, 'Escreve pelo menos três caracteres.');
    const p = '%' + q + '%';
    const rows = (await env.DB.prepare(
      `SELECT id, name, email, plan, created_at, deleted_at FROM users
        WHERE email LIKE ? OR name LIKE ? OR id = ?
        ORDER BY created_at DESC LIMIT 20`
    ).bind(p, p, q.toUpperCase()).all()).results;
    return json({ pessoas: rows });
  }

  const mPessoa = /^\/api\/equipa\/pessoas\/([^/]+)$/.exec(path);
  if (mPessoa && method === 'GET') {
    if (cats.indexOf('user') < 0) return err(403, 'O teu papel não vê pessoas.');
    const id = decodeURIComponent(mPessoa[1]);
    if (badId(id)) return err(400, 'Id inválido.');
    const f = await ficha(env, id);
    if (!f || f.desconhecido) return err(404, 'Conta não encontrada.');
    const pedidos = (await env.DB.prepare(
      `SELECT id, subject, status, kind, created_at FROM tickets
        WHERE user_id = ? AND category = 'user' ORDER BY created_at DESC LIMIT 20`
    ).bind(id).all()).results;
    return json({ quem: f, pedidos });
  }

  return null;
}
