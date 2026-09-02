/* O que a ferramenta de equipa pode fazer.
   ----------------------------------------
   As mesmas regras do bot, pelos mesmos papéis: o suporte vê os pedidos
   contados por pessoas, quem programa vê os erros, quem opera vê as
   máquinas — e nenhum vê o canto dos outros. A diferença é a forma: aqui
   procura-se e navega-se, que é o que um canal de Discord não sabe fazer.

   Nada aqui devolve dados de imóveis, contratos ou movimentos. Quem faz
   suporte precisa de saber com quem fala e o que essa pessoa escreveu, não
   de lhe ver as contas.

   Desde que isto ganhou poderes de escrita, vale uma regra sem exceções:
   toda a ação que muda alguma coisa escreve primeiro no audit_log. Nas
   ações sobre contas é mesmo primeiro — se o rasto não se conseguir
   escrever, a ação não acontece. Mexer numa conta sem deixar registo é o
   género de atalho que só se nota quando já ninguém sabe o que se passou. */

import { json, err, body, now, badId, CATEGORIAS } from './lib/http.js';
import { catsDe } from './discord.js';
import { auditar, registarOp } from './lib/auditoria.js';

const cortar = (s, n) => {
  const t = String(s == null ? '' : s);
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

// A mesma regra do bot, e de propósito a mesma função: duas cópias disto
// acabavam a discordar uma da outra na primeira mudança de papéis.
function categoriasDe(eu) {
  return catsDe(eu.papeis || eu.papel);
}

// As ações sobre contas são só do master. Não por desconfiança dos outros —
// por serem as únicas ações daqui que mexem na vida de quem usa a app, e
// isso quer um responsável único enquanto a equipa couber numa mão.
const eMaster = (eu) => ((eu.papeis || [eu.papel]).indexOf('master') > -1);

/* A ficha de quem escreveu. É a mesma informação que o bot mostra, e pela
   mesma razão: responder sem saber quem é a pessoa é responder às cegas. */
async function ficha(env, userId) {
  if (!userId) return null;
  const u = await env.DB.prepare(
    `SELECT id, name, email, plan, created_at, deleted_at, suspended_at,
            terms_version, terms_at, pass_hash, google_sub
       FROM users WHERE id = ?`
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
    suspensa: u.suspended_at || null,
    aceitouTermos: !!u.terms_version,
    termos: u.terms_version || null,
    // como entra: é a primeira pergunta de qualquer "não consigo entrar"
    entrada: [u.pass_hash ? 'password' : null, u.google_sub ? 'google' : null]
      .filter(Boolean).join(' + ') || 'nenhuma',
    casas: await q('SELECT COUNT(*) AS n FROM houses WHERE owner_id = ? AND deleted = 0'),
    registos: await q(
      'SELECT COUNT(*) AS n FROM records r JOIN houses h ON h.id = r.house_id WHERE h.owner_id = ? AND r.deleted = 0'
    ),
    pedidos: await q("SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND category = 'user'"),
    errosApanhados: await q('SELECT COUNT(*) AS n FROM ticket_users WHERE user_id = ?'),
  };
}

/* O resto da vista a 360º: só na página da pessoa, porque são mais seis
   consultas e a ficha básica também serve dentro de cada pedido. */
async function ficha360(env, userId) {
  const f = await ficha(env, userId);
  if (!f || f.desconhecido) return f;
  const t = now();

  // metade dos "não consigo entrar" resolve-se a ver, sem mexer
  const atividade = await env.DB.prepare(
    `SELECT MAX(m) AS m FROM (
       SELECT MAX(updated_at) AS m FROM houses WHERE owner_id = ?
       UNION ALL SELECT MAX(updated_at) FROM user_records WHERE user_id = ?)`
  ).bind(userId, userId).first();
  f.ultimaAtividade = (atividade && atividade.m) || null;

  const v = await env.DB.prepare(
    'SELECT versao FROM tickets WHERE user_id = ? AND versao IS NOT NULL ORDER BY updated_at DESC LIMIT 1'
  ).bind(userId).first();
  f.versaoApp = (v && v.versao) || null;

  f.limites = (await env.DB.prepare(
    "SELECT k, n, expires_at FROM rate_limits WHERE expires_at > ? AND k LIKE '%' || ? || '%' LIMIT 10"
  ).bind(t, userId).all()).results || [];

  f.ligacoes = (await env.DB.prepare(
    `SELECT c.id, c.status, c.created_at,
            CASE WHEN c.requester_id = ? THEN 'enviada' ELSE 'recebida' END AS sentido,
            u.id AS outro_id, u.name AS outro_nome, u.email AS outro_email,
            (SELECT COUNT(*) FROM shares s WHERE s.connection_id = c.id) AS casas_partilhadas
       FROM connections c
       JOIN users u ON u.id = CASE WHEN c.requester_id = ? THEN c.target_id ELSE c.requester_id END
      WHERE c.requester_id = ? OR c.target_id = ?
      ORDER BY c.created_at DESC LIMIT 20`
  ).bind(userId, userId, userId, userId).all()).results || [];

  // propostas de quotas por resolver: é onde as partilhas ficam penduradas
  f.propostas = (await env.DB.prepare(
    `SELECT p.house_id, p.proposed_by, p.created_at FROM share_proposals p
       LEFT JOIN houses h ON h.id = p.house_id
      WHERE h.owner_id = ? OR p.proposed_by = ? LIMIT 10`
  ).bind(userId, userId).all()).results || [];

  return f;
}

/* ----------------------------- ações de conta ----------------------------

   Cada uma valida, escreve o rasto, e só depois mexe. O motivo é
   obrigatório: daqui a seis meses, "porquê?" é a única pergunta que
   interessa, e ninguém se lembra. */
const ACOES_DE_CONTA = {
  // terminar as sessões todas: conta comprometida, telemóvel perdido
  async sessoes(env, u) {
    await env.DB.prepare('UPDATE users SET sess_epoch = COALESCE(sess_epoch, 0) + 1 WHERE id = ?')
      .bind(u.id).run();
    return 'sessões terminadas em todos os aparelhos';
  },
  // um utilizador legítimo preso num limite não tem de esperar a janela
  async 'limpar-limites'(env, u) {
    const r = await env.DB.prepare("DELETE FROM rate_limits WHERE k LIKE '%' || ? || '%'")
      .bind(u.id).run();
    return 'limites limpos (' + (((r || {}).meta || {}).changes || 0) + ')';
  },
  async plano(env, u, valor) {
    if (['free', 'plus', 'pro'].indexOf(valor) < 0) throw new Error('Plano desconhecido: usa free, plus ou pro.');
    await env.DB.prepare('UPDATE users SET plan = ? WHERE id = ?').bind(valor, u.id).run();
    return 'plano: ' + u.plan + ' → ' + valor;
  },
  /* Suspender também termina as sessões: uma suspensão com as sessões vivas
     só travava a pessoa no próximo login, que podia ser daqui a um mês. */
  async suspender(env, u) {
    if (u.suspended_at) throw new Error('Já está suspensa.');
    await env.DB.prepare(
      'UPDATE users SET suspended_at = ?, sess_epoch = COALESCE(sess_epoch, 0) + 1 WHERE id = ?'
    ).bind(now(), u.id).run();
    return 'conta suspensa';
  },
  async reativar(env, u) {
    if (!u.suspended_at) throw new Error('Não está suspensa.');
    await env.DB.prepare('UPDATE users SET suspended_at = NULL WHERE id = ?').bind(u.id).run();
    return 'conta reativada';
  },
  async email(env, u, valor) {
    const email = String(valor || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Esse email não parece um email.');
    const outro = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id <> ?')
      .bind(email, u.id).first();
    if (outro) throw new Error('Já há uma conta com esse email (' + outro.id + ').');
    await env.DB.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, u.id).run();
    return 'email: ' + u.email + ' → ' + email;
  },
  /* Só com password definida: uma conta criada pelo Google não tem outra
     porta, e desligar-lhe o Google era trancar a pessoa fora de vez. */
  async 'desligar-google'(env, u) {
    if (!u.google_sub) throw new Error('Esta conta não tem Google ligado.');
    if (!u.pass_hash) throw new Error('É uma conta só-Google: sem password, desligar o Google trancava-a fora.');
    await env.DB.prepare('UPDATE users SET google_sub = NULL WHERE id = ?').bind(u.id).run();
    return 'Google desligado';
  },
};

export async function rotasEquipaApi(c) {
  const { env, request, path, method, url, eu } = c;
  const cats = categoriasDe(eu);
  if (!cats.length) return err(403, 'O teu papel não vê pedidos.');

  const marcas = cats.map(() => '?').join(',');

  /* ---- lista, com procura e filtro ---- */
  if (path === '/api/equipa/pedidos' && method === 'GET') {
    const estado = (url.searchParams.get('estado') || '').trim();
    const tipo = (url.searchParams.get('tipo') || '').trim();
    const procura = (url.searchParams.get('q') || '').trim().slice(0, 80);
    const onde = ['category IN (' + marcas + ')'];
    const vals = [...cats];
    // o mesmo balcão serve as pessoas e os erros; o separador é a categoria
    if (tipo === 'pessoas') onde.push("category = 'user'");
    else if (tipo === 'erros') onde.push("category <> 'user'");
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
              t.created_at, t.updated_at, t.reply, t.assignee, t.assignee_nome,
              u.name AS nome, u.email AS email,
              (SELECT COUNT(*) FROM ticket_users x WHERE x.fingerprint = t.fingerprint) AS pessoas
         FROM tickets t LEFT JOIN users u ON u.id = t.user_id
        WHERE ` + onde.join(' AND ') +
      ' ORDER BY (t.status <> \'concluido\') DESC, t.updated_at DESC LIMIT 100'
    ).bind(...vals).all()).results;
    return json({ pedidos: rows, papel: eu.papel, categorias: cats });
  }

  /* ---- um pedido, com o fio e a ficha de quem escreveu ---- */
  const mDetalhe = /^\/api\/equipa\/pedidos\/([^/]+)$/.exec(path);
  if (mDetalhe && method === 'GET') {
    const id = decodeURIComponent(mDetalhe[1]);
    if (badId(id)) return err(400, 'Id inválido.');
    const t = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
    if (!t) return err(404, 'Pedido não encontrado.');
    if (cats.indexOf(t.category) < 0) return err(403, 'Esse pedido é de outro papel.');
    const msgs = (await env.DB.prepare(
      'SELECT id, tipo, texto, autor, nome, papel, at FROM ticket_msgs WHERE ticket_id = ? ORDER BY at'
    ).bind(id).all()).results;
    const outros = (await env.DB.prepare(
      `SELECT id, subject, status, created_at FROM tickets
        WHERE user_id = ? AND id <> ? AND category = 'user' ORDER BY created_at DESC LIMIT 10`
    ).bind(t.user_id, id).all()).results;
    return json({ pedido: t, msgs, quem: await ficha(env, t.user_id), outros });
  }

  /* ---- agir sobre um pedido ---- */
  const mAcao = /^\/api\/equipa\/pedidos\/([^/]+)\/(responder|fechar|reabrir|nota|atribuir|categoria)$/.exec(path);
  if (mAcao && method === 'POST') {
    const id = decodeURIComponent(mAcao[1]), acao = mAcao[2];
    if (badId(id)) return err(400, 'Id inválido.');
    const t = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
    if (!t) return err(404, 'Pedido não encontrado.');
    if (cats.indexOf(t.category) < 0) return err(403, 'Esse pedido é de outro papel.');

    const b = await body(request);
    const texto = String((b && b.texto) || '').trim().slice(0, 2000);
    const agora = now();

    const msg = (tipo) => env.DB.prepare(
      'INSERT INTO ticket_msgs (id, ticket_id, tipo, texto, autor, nome, papel, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), id, tipo, texto, eu.discordId || '?', eu.nome || '', eu.papel || '', agora).run();

    if (acao === 'nota') {
      if (!texto) return err(400, 'Escreve a nota.');
      await msg('nota');
      await auditar(env, eu, 'pedido.nota', id, cortar(texto, 120));
    } else if (acao === 'atribuir') {
      /* Tomar ou largar — e o UPDATE exige o estado que se leu, senão duas
         pessoas a clicar ao mesmo tempo ficavam ambas convencidas de que
         tomaram, e uma delas enganada. */
      const tomar = !(t.assignee === (eu.discordId || '?'));
      const r = await (tomar
        ? env.DB.prepare(
            'UPDATE tickets SET assignee = ?, assignee_nome = ?, updated_at = ? WHERE id = ? AND assignee IS NULL'
          ).bind(eu.discordId || '?', eu.nome || '', agora, id)
        : env.DB.prepare(
            'UPDATE tickets SET assignee = NULL, assignee_nome = NULL, updated_at = ? WHERE id = ? AND assignee = ?'
          ).bind(agora, id, eu.discordId || '?')
      ).run();
      if (!r.meta || r.meta.changes !== 1) {
        const agora2 = await env.DB.prepare('SELECT assignee_nome FROM tickets WHERE id = ?').bind(id).first();
        return err(409, ((agora2 && agora2.assignee_nome) || 'Outra pessoa') + ' chegou primeiro a este pedido.');
      }
      await auditar(env, eu, 'pedido.atribuir', id, tomar ? 'tomou' : 'largou');
    } else if (acao === 'categoria') {
      const nova = String((b && b.categoria) || '').trim();
      if (CATEGORIAS.indexOf(nova) < 0) return err(400, 'Categoria desconhecida.');
      if (nova === t.category) return err(400, 'Já está nessa categoria.');
      /* A categoria 'user' é também o interruptor do que a pessoa vê na
         Ajuda da app. Tirar um pedido de 'user' fazia-o desaparecer (com a
         resposta) do ecrã de quem o escreveu; passar um erro para 'user'
         punha um stack trace na Ajuda de uma pessoa real. Entre os dois
         mundos não se muda — para "isto afinal é um bug", responde-se à
         pessoa e deixa-se uma nota interna. */
      if ((nova === 'user') !== (t.category === 'user')) {
        return err(400, 'Entre pedidos de pessoas e categorias técnicas não se muda: ' +
          'a categoria decide o que a pessoa vê na app. Responde e deixa uma nota interna.');
      }
      await env.DB.prepare('UPDATE tickets SET category = ?, updated_at = ? WHERE id = ?')
        .bind(nova, agora, id).run();
      await auditar(env, eu, 'pedido.categoria', id, t.category + ' → ' + nova);
    } else {
      /* responder, fechar, reabrir. A resposta entra no fio E na coluna
         reply — a app do utilizador lê a reply, e passa a ser sempre a
         última resposta em vez de a única. */
      const estado = acao === 'fechar' ? 'concluido' : acao === 'reabrir' ? 'criado' : 'resolucao';
      if (acao === 'responder' && !texto) return err(400, 'Escreve a resposta.');
      /* Numa só transação: com dois statements soltos, um erro entre eles
         deixava o fio e a coluna reply a contarem histórias diferentes —
         e o retry de quem viu o 500 duplicava a mensagem no fio. */
      const ops = [];
      if (texto) {
        ops.push(env.DB.prepare(
          'INSERT INTO ticket_msgs (id, ticket_id, tipo, texto, autor, nome, papel, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), id, 'resposta', texto, eu.discordId || '?', eu.nome || '', eu.papel || '', agora));
      }
      ops.push(env.DB.prepare(
        'UPDATE tickets SET status = ?, reply = COALESCE(?, reply), updated_at = ? WHERE id = ?'
      ).bind(estado, texto || null, agora, id));
      await env.DB.batch(ops);
      await auditar(env, eu, 'pedido.' + acao, id, texto ? cortar(texto, 120) : null);
    }

    const novo = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
    const msgs = (await env.DB.prepare(
      'SELECT id, tipo, texto, autor, nome, papel, at FROM ticket_msgs WHERE ticket_id = ? ORDER BY at'
    ).bind(id).all()).results;
    return json({ pedido: novo, msgs });
  }

  /* ---- respostas-tipo ---- */
  if (path === '/api/equipa/modelos' && method === 'GET') {
    const rows = (await env.DB.prepare(
      'SELECT id, titulo, texto, autor, at FROM reply_templates ORDER BY titulo LIMIT 50'
    ).all()).results;
    return json({ modelos: rows });
  }
  if (path === '/api/equipa/modelos' && method === 'POST') {
    const b = await body(request);
    const titulo = String((b && b.titulo) || '').trim().slice(0, 80);
    const texto = String((b && b.texto) || '').trim().slice(0, 2000);
    if (!titulo || !texto) return err(400, 'Um modelo precisa de título e de texto.');
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO reply_templates (id, titulo, texto, autor, at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, titulo, texto, eu.discordId || '?', now()).run();
    await auditar(env, eu, 'modelo.criar', id, titulo);
    return json({ id }, 201);
  }
  const mModelo = /^\/api\/equipa\/modelos\/([^/]+)$/.exec(path);
  if (mModelo && method === 'DELETE') {
    const id = decodeURIComponent(mModelo[1]);
    if (badId(id)) return err(400, 'Id inválido.');
    const m = await env.DB.prepare('SELECT autor, titulo FROM reply_templates WHERE id = ?').bind(id).first();
    if (!m) return err(404, 'Esse modelo não existe.');
    // apaga quem o escreveu, ou o master — não se apagam os modelos dos outros
    if (m.autor !== (eu.discordId || '?') && !eMaster(eu)) {
      return err(403, 'Esse modelo é de outra pessoa.');
    }
    await env.DB.prepare('DELETE FROM reply_templates WHERE id = ?').bind(id).run();
    await auditar(env, eu, 'modelo.apagar', id, m.titulo);
    return json({ ok: true });
  }

  /* ---- procurar uma pessoa ---- */
  if (path === '/api/equipa/pessoas' && method === 'GET') {
    if (cats.indexOf('user') < 0) return err(403, 'O teu papel não vê pessoas.');
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    if (q.length < 3) return err(400, 'Escreve pelo menos três caracteres.');
    const p = '%' + q + '%';
    const rows = (await env.DB.prepare(
      `SELECT id, name, email, plan, created_at, deleted_at, suspended_at FROM users
        WHERE email LIKE ? OR name LIKE ? OR id = ?
        ORDER BY created_at DESC LIMIT 20`
    ).bind(p, p, q.toUpperCase()).all()).results;
    // procurar pessoas é tocar em dados pessoais: fica registado quem procurou o quê
    await auditar(env, eu, 'pessoa.procurar', null, q);
    return json({ pessoas: rows });
  }

  const mPessoa = /^\/api\/equipa\/pessoas\/([^/]+)$/.exec(path);
  if (mPessoa && method === 'GET') {
    if (cats.indexOf('user') < 0) return err(403, 'O teu papel não vê pessoas.');
    const id = decodeURIComponent(mPessoa[1]);
    if (badId(id)) return err(400, 'Id inválido.');
    const f = await ficha360(env, id);
    if (!f || f.desconhecido) return err(404, 'Conta não encontrada.');
    // abrir a ficha completa de alguém também: é a leitura mais sensível daqui
    await auditar(env, eu, 'pessoa.ver', id, null);
    const pedidos = (await env.DB.prepare(
      `SELECT id, subject, status, kind, created_at FROM tickets
        WHERE user_id = ? AND category = 'user' ORDER BY created_at DESC LIMIT 20`
    ).bind(id).all()).results;
    return json({ quem: f, pedidos, master: eMaster(eu) });
  }

  /* ---- agir sobre uma conta (só o master) ---- */
  const mConta = /^\/api\/equipa\/pessoas\/([^/]+)\/acao$/.exec(path);
  if (mConta && method === 'POST') {
    if (!eMaster(eu)) return err(403, 'Mexer em contas é só do master.');
    const id = decodeURIComponent(mConta[1]);
    if (badId(id)) return err(400, 'Id inválido.');
    const b = await body(request);
    const acao = String((b && b.acao) || '');
    const motivo = String((b && b.motivo) || '').trim().slice(0, 300);
    /* hasOwnProperty e não [acao] a seco: 'constructor' e afins são
       propriedades herdadas de qualquer objeto — [acao] devolvia a função
       Object, que chamada com (env, ...) devolvia o env inteiro, segredos
       incluídos, como "resultado". */
    const fazer = Object.prototype.hasOwnProperty.call(ACOES_DE_CONTA, acao)
      ? ACOES_DE_CONTA[acao] : null;
    if (!fazer) return err(400, 'Ação desconhecida.');
    if (motivo.length < 5) return err(400, 'Escreve o motivo — daqui a seis meses é a única coisa que interessa.');

    const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    if (!u) return err(404, 'Conta não encontrada.');
    if (u.deleted_at) return err(409, 'Essa conta foi apagada; já não há onde mexer.');

    // o rasto primeiro: se não se conseguir escrever, não se mexe
    const registado = await auditar(env, eu, 'conta.' + acao, id, motivo);
    if (!registado) return err(500, 'A auditoria não está a escrever — sem rasto não se mexe em contas.');

    let resultado;
    try {
      resultado = await fazer(env, u, b && b.valor);
    } catch (e) {
      await auditar(env, eu, 'conta.' + acao + '.falhou', id, String(e && e.message));
      return err(400, String((e && e.message) || 'Não deu.'));
    }
    // fora do try de propósito: a ação já aconteceu, e uma consulta da
    // ficha a falhar não pode fazer o rasto dizer que a ação falhou
    await auditar(env, eu, 'conta.' + acao + '.feito', id, resultado);
    let quem = null;
    try { quem = await ficha360(env, id); } catch (e) { /* a ficha é vitrine */ }
    return json({ ok: true, resultado, quem });
  }

  /* ---- a sala das máquinas (quem vê a infraestrutura) ---- */
  if (path.startsWith('/api/equipa/operacao')) {
    if (cats.indexOf('infra') < 0) return err(403, 'A operação é de quem vê a infraestrutura.');

    if (path === '/api/equipa/operacao' && method === 'GET') {
      const { usageFields } = await import('./notify.js');
      const { listar, estado } = await import('./salvaguarda.js');
      const { modoDemo } = await import('./lib/planos.js');
      // o batimento: a última execução de cada operação agendada.
      // O alarme é a ausência — a idade calcula-se do lado de quem vê.
      const crons = (await env.DB.prepare(
        'SELECT op, at, ok, detalhe FROM op_log WHERE id IN (SELECT MAX(id) FROM op_log GROUP BY op)'
      ).all()).results;
      const historico = (await env.DB.prepare(
        "SELECT at, ok, detalhe FROM op_log WHERE op = 'copia' ORDER BY at DESC LIMIT 30"
      ).all()).results;
      /* O R2 em baixo não pode derrubar o batimento e o consumo, que vivem
         na D1 — cada fonte falha sozinha. */
      let copias = [], estadoCopias;
      try {
        copias = (await listar(env)).slice(0, 40);
        estadoCopias = await estado(env);
      } catch (e) {
        estadoCopias = { erro: String((e && e.message) || e), texto: '🔴 Não deu para ler as cópias.' };
      }
      return json({
        consumo: await usageFields(env),
        copias,
        estadoCopias,
        crons,
        historico,
        demo: await modoDemo(env),
        master: eMaster(eu),
      });
    }

    /* Ligar ou desligar o modo de demonstração. Desligá-lo é o momento em
       que os limites dos planos passam a valer para toda a gente — por isso
       é só do master, pede motivo, e fica no rasto antes de acontecer. */
    if (path === '/api/equipa/operacao/demo' && method === 'POST') {
      if (!eMaster(eu)) return err(403, 'O modo de demonstração é só do master.');
      const b = await body(request);
      const ligar = !!(b && b.ligado);
      const motivo = String((b && b.motivo) || '').trim().slice(0, 300);
      if (motivo.length < 5) return err(400, 'Escreve o motivo — fica no rasto.');
      const registado = await auditar(env, eu, 'operacao.demo', null,
        (ligar ? 'ligado' : 'desligado — os limites dos planos passam a valer') + ' · ' + motivo);
      if (!registado) return err(500, 'A auditoria não está a escrever — sem rasto não se muda isto.');
      const { definirDemo } = await import('./lib/planos.js');
      await definirDemo(env, ligar);
      return json({ demo: ligar });
    }

    if (path === '/api/equipa/operacao/copiar' && method === 'POST') {
      const { copiar } = await import('./salvaguarda.js');
      await auditar(env, eu, 'operacao.copiar', null, 'cópia manual');
      const r = await copiar(env);
      await registarOp(env, 'copia', !r.erro, JSON.stringify(Object.assign({ manual: true }, r)).slice(0, 490));
      if (r.erro) return err(500, r.erro);
      return json({ copia: r });
    }

    /* Espreitar uma cópia sem a descarregar: descomprime em fluxo e conta
       linhas por tabela, comparando com a base viva. É a verificação de
       integridade possível dentro do worker — uma cópia truncada rebenta na
       descompressão, uma coxa aparece com contagens a divergir. */
    const mResumo = /^\/api\/equipa\/operacao\/copias\/(\d{4}-\d{2}-\d{2})\/resumo$/.exec(path);
    if (mResumo && method === 'GET') {
      const { PREFIXO } = await import('./salvaguarda.js');
      const chave = PREFIXO + mResumo[1] + '.ndjson.gz';
      const obj = await env.FILES.get(chave);
      if (!obj) return err(404, 'Não há cópia desse dia.');
      // o plano gratuito dá pouco CPU: uma cópia grande inspeciona-se em
      // casa, com scripts/restaurar.js --resumo, não aqui
      // o plano gratuito dá ~10 ms de CPU: acima disto, inspeciona-se em casa
      if (obj.size > 2 * 1024 * 1024) {
        return err(413, 'Cópia grande de mais para inspecionar no worker. Descarrega-a e corre scripts/restaurar.js --resumo.');
      }
      const tabelas = {};
      let resto = '', total = 0, mas = 0;
      const leitor = obj.body.pipeThrough(new DecompressionStream('gzip')).getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await leitor.read();
        resto += done ? '' : dec.decode(value, { stream: true });
        const partes = resto.split('\n');
        resto = done ? '' : partes.pop();
        for (const linha of partes) {
          if (!linha) continue;
          total++;
          const m = /^\{"t":"([A-Za-z0-9_]+)"/.exec(linha);
          if (m) tabelas[m[1]] = (tabelas[m[1]] || 0) + 1;
          else if (total > 1) mas++;   // a primeira linha é o cabeçalho
        }
        if (done) break;
      }
      // o cabeçalho não é um registo: assim o número bate com o do copiar()
      const linhas = Math.max(0, total - 1);
      // e a base viva, para se ver a deriva desde o dia da cópia
      const vivas = {};
      for (const t of Object.keys(tabelas)) {
        try {
          vivas[t] = ((await env.DB.prepare('SELECT COUNT(*) AS n FROM "' + t + '"').first()) || {}).n || 0;
        } catch (e) { vivas[t] = null; }   // tabela que já não existe
      }
      return json({ chave, bytes: obj.size, linhas, tabelas, vivas, irreconheciveis: mas });
    }

    const mDescarga = /^\/api\/equipa\/operacao\/copias\/(\d{4}-\d{2}-\d{2})\/descarregar$/.exec(path);
    if (mDescarga && method === 'GET') {
      const { PREFIXO } = await import('./salvaguarda.js');
      const chave = PREFIXO + mDescarga[1] + '.ndjson.gz';
      const obj = await env.FILES.get(chave);
      if (!obj) return err(404, 'Não há cópia desse dia.');
      // descarregar uma cópia é sair com a base toda: fica no rasto
      await auditar(env, eu, 'operacao.descarregar', chave, obj.size + ' bytes');
      return new Response(obj.body, {
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Disposition': 'attachment; filename="' + mDescarga[1] + '.ndjson.gz"',
          'Cache-Control': 'no-store',
        },
      });
    }

    return null;
  }

  /* ---- o rasto (só o master) ---- */
  if (path === '/api/equipa/auditoria' && method === 'GET') {
    if (!eMaster(eu)) return err(403, 'O rasto é só do master.');
    const alvo = (url.searchParams.get('alvo') || '').trim().slice(0, 64);
    const rows = (await (alvo
      ? env.DB.prepare('SELECT * FROM audit_log WHERE alvo = ? ORDER BY at DESC LIMIT 200').bind(alvo)
      : env.DB.prepare('SELECT * FROM audit_log ORDER BY at DESC LIMIT 200')
    ).all()).results;
    return json({ registos: rows });
  }

  return null;
}
