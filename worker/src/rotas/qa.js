// Tickets de QA do ambiente de desenvolvimento: quem testa a app escreve-os
// no próprio ecrã (web/cloud/qa.js) e o Claude lê-os com scripts/qa.mjs.
// Em produção (sem env.ENV_NAME) nenhuma destas rotas existe.
//
// Vivem na tabela qa_tickets (migrations/0023_qa_tickets.sql), à parte dos
// pedidos de ajuda: não são suporte, não vão ao Discord. Todas as contas do
// dev veem e mexem em todos os tickets (a decisão do Martinho, 2026-10-28) —
// o user_id é só quem o escreveu. A captura de ecrã vive no R2 em qa/<id>.
// Cada ticket tem o seu cartão no kanban da equipa (rotas/kanban.js) e está
// sempre na coluna dele: status é o id da coluna (a-fazer, auto-tests,
// human-tests, concluido, para-depois…). Mover o ticket aqui move o cartão;
// mover o cartão no kanban move o ticket (o gatilho da migração 0029).
//
// A pílula é uma vista do kanban (pedido do Martinho, 2026-11-12, KAN-115):
// o GET lista os cartões do tipo Erro, venham de onde vierem, com o ticket
// junto nos de QA, e as ações valem para todos. Um item com ticket usa o id
// do ticket; um Erro sem ticket usa a chave do cartão (KAN-N), que estas
// rotas também aceitam (cartaoDaPilula). Remover e repor andam aos pares:
// o ticket e o cartão saem e voltam juntos (lib/kanban.js:cartaoSaiComOTicket).
import { json, err, body, badId, now, CSP_ANEXO } from '../lib/http.js';
import { rateLimit } from '../lib/limites.js';
import { lerAte, tipoDaImagem } from '../lib/imagens.js';
import { catsDe } from '../lib/papeis.js';

// as duas vivem em lib/imagens.js (o kanban também as usa); ficam exportadas daqui para quem já as lia cá
export { lerAte, tipoDaImagem };
import {
  cartaoDoTicketQa, ticketQaNaColuna, eIdDeColuna, passosDoComentarioQa, passosDoComentario, colunaDepoisDoComentario,
  cartaoSaiComOTicket, cartaoVoltaComOTicket, passosDoCartaoNaColuna, chaveDe, QA_NOVO, QA_EM_CURSO,
} from '../lib/kanban.js';

// A chave de um cartão nas rotas da pílula: KAN-N, sempre com o prefixo (um id de ticket nunca tem esta forma).
const CHAVE_DO_CARTAO = /^KAN-([1-9]\d{0,8})$/i;

// As gravidades que um ticket pode ter; qualquer outra coisa fica sem nenhuma.
const GRAVIDADES = ['bloqueia', 'incomoda', 'detalhe'];
// A descrição, depois de aparada, tem de 1 a MAX_TEXTO caracteres.
const MAX_TEXTO = 4000;
// O contexto guarda-se em JSON até 16 KB (em bytes de UTF-8).
const MAX_CONTEXTO = 16 * 1024;
// A captura de ecrã até 3 MB — o cliente já a encolhe antes de subir.
const MAX_IMAGEM = 3 * 1024 * 1024;
// Quantos tickets um GET devolve, no máximo.
const TETO_LISTA = 200;
// Quanto tempo um ticket removido espera pelo Anular antes de se apagar de vez.
const GUARDA_REMOVIDO = 24 * 3600 * 1000;
// Quantos removidos se apagam de cada passagem (o resto fica para a seguinte).
const LOTE_LIMPEZA = 50;
// Tickets novos por pessoa e por hora.
const TETO_HORA = 30;
// Comentários por pessoa e por hora (uma conversa sobre um ticket pede mais do que os tickets novos).
const TETO_COMENTARIOS_HORA = 60;
// Os comentários que a leitura de um ticket traz, no máximo (os mais antigos primeiro).
const TETO_COMENTARIOS = 500;

// Os tipos de imagem aceites, cada um com a assinatura dos primeiros bytes.
const TIPOS_IMAGEM = ['image/png', 'image/jpeg', 'image/webp'];

/* A resposta ao ticket que não existe, que foi removido ou cujo id nem tem
   forma de id — os três respondem igual.
   Recebe: nada.
   Devolve: a Response 404 «Ticket não encontrado.». */
function naoExiste() {
  return err(404, 'Ticket não encontrado.');
}

/* Rotas dos tickets de QA (/api/qa…), só fora de produção. Sem
   env.ENV_NAME respondem 404 antes de lerem o corpo, como se não existissem.
   POST /api/qa cria; GET /api/qa lista; DELETE /api/qa/:id remove (brando,
   para o Anular); POST …/repor desfaz a remoção; POST …/reabrir volta a pôr
   o ticket em A fazer; POST …/mover {coluna} passa-o a outra coluna do
   kanban; PUT e GET …/imagem gravam e servem a captura; POST …/comentarios
   {texto} comenta (e devolve o ticket a Auto Tests) e GET …/comentarios
   lê os comentários do ticket.
   O :id é o de um ticket ou a chave de um cartão Erro (KAN-N): a de um
   cartão com o ticket vivo vale o mesmo que o id dele; a de um Erro sem
   ticket vai às rotasDoCartao.
   O back office do dev chega aqui pelo rotasQaDaEquipa, com a sessão de
   equipa no lugar da conta.
   Recebe: c — o contexto do pedido montado pelo handleApi (env, request,
   ctx, path, method, seg e o utilizador em c.me), ou o do rotasQaDaEquipa
   (com c.autor já feito, c.vePedidos e sem c.me).
   Devolve: a Response da rota que casar com o pedido, ou nada (undefined)
   para o encaminhador tentar a seguinte. */
export async function rotasQa(c) {
  const { env, request, method, seg, me } = c;
  if (seg[1] !== 'qa') return;
  if (!env.ENV_NAME) return err(404, 'Rota desconhecida.');

  if (seg.length === 2) {
    if (method === 'POST') return criarTicket(env, request, c.autor || (await autorDaConta(env, me)));
    if (method === 'GET') return listarTickets(env, !!c.vePedidos);
    return err(404, 'Rota desconhecida.');
  }

  let id = seg[2];
  if (badId(id) || seg.length > 4) return naoExiste();
  if (CHAVE_DO_CARTAO.test(id)) {
    const k = await cartaoDaPilula(env, id, !!c.vePedidos);
    if (!k) return naoExiste();
    if (!k.ticket_vivo) return rotasDoCartao(c, k);
    id = k.origem_id;
  }

  if (seg.length === 3 && method === 'DELETE') {
    return removerTicket(env, id, autorDoComentario(c.autor || (await autorDaConta(env, me)), me));
  }
  if (seg[3] === 'repor' && method === 'POST') {
    return reporTicket(env, id, autorDoComentario(c.autor || (await autorDaConta(env, me)), me));
  }
  if (seg[3] === 'reabrir' && method === 'POST') return moverTicket(env, id, QA_NOVO);
  if (seg[3] === 'mover' && method === 'POST') {
    const b = await body(request);
    return moverTicket(env, id, b && b.coluna);
  }
  if (seg[3] === 'imagem' && method === 'PUT') return gravarImagem(env, request, id);
  if (seg[3] === 'imagem' && method === 'GET') return servirImagem(env, id);
  if (seg[3] === 'comentarios' && (method === 'POST' || method === 'GET')) {
    const quem = autorDoComentario(c.autor || (await autorDaConta(env, me)), me);
    return method === 'POST' ? comentarTicket(env, request, id, quem) : lerComentarios(env, id, quem);
  }
  return err(404, 'Rota desconhecida.');
}

/* As mesmas rotas para o back office do dev (/api/equipa/qa…, a pílula
   que o worker/src/equipa-qa.js lá põe), com a sessão de equipa no lugar
   da conta: o autor é a pessoa da equipa, pelo Discord — user_id
   'equipa:<id do Discord>' (sem chave estrangeira, como os outros),
   discord_id e discord_nome da sessão. Em produção, 404 como as da app. Um
   cartão de um pedido mudado para Erro só o vê quem vê os pedidos (a
   categoria 'user' dos papéis, como a descrição dele no kanban); nas contas
   da app nunca.
   Recebe: c — o contexto do pedido do back office ({env, request, method,
   path, eu}, com eu a sessão de equipa de getEquipa).
   Devolve: a Response, ou nada (undefined) quando o caminho não é do QA. */
export async function rotasQaDaEquipa(c) {
  const path = c.path, eu = c.eu;
  if (path !== '/api/equipa/qa' && !path.startsWith('/api/equipa/qa/')) return;
  const seg = ['api', 'qa'].concat(path.slice('/api/equipa/qa'.length).split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }));
  const autor = { id: autorDaEquipa(eu), discordId: String(eu.discordId), discordNome: eu.nome ? String(eu.nome) : null };
  const vePedidos = catsDe(eu && (eu.papeis || eu.papel)).indexOf('user') > -1;
  return rotasQa(Object.assign({}, c, { seg, me: null, autor, vePedidos }));
}

/* O user_id de um ticket escrito no back office: 'equipa:' e o id do
   Discord da sessão. É também o CW.user.id que a camada da pílula do back
   office dá ao qa.js, para o «(eu)» das linhas bater certo.
   Recebe: eu — a sessão de equipa ({discordId, …}).
   Devolve: o texto. */
export function autorDaEquipa(eu) {
  return 'equipa:' + String(eu.discordId);
}

/* O autor de um ticket escrito numa conta da app: o id da conta e, numa
   conta de teste, a conta do Discord que pediu o /test (teste.js:discordDoAutor).
   Recebe: env — o ambiente do worker; me — o utilizador com sessão.
   Devolve: promessa de {id, discordId, discordNome}. */
async function autorDaConta(env, me) {
  const { discordDoAutor } = await import('../teste.js');
  const d = await discordDoAutor(env, me);
  return { id: me.id, discordId: d.id, discordNome: d.nome };
}

/* POST /api/qa: grava um ticket novo de quem tem a sessão. A descrição é
   aparada e tem de ter de 1 a 4000 caracteres; uma gravidade fora das três
   fica nula; o contexto, se for um objeto, guarda-se em JSON cortado aos
   16 KB (contextoParaGuardar). Trava aos 30 por hora por pessoa e leva de
   passagem os removidos há mais de 24 h. O ticket ganha o seu cartão no
   kanban da equipa (kanbanDoTicket); remover, repor e reabrir levam-no atrás.
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES);
   request — o pedido, com o corpo {body, severity?, context}; autor — quem
   o escreve ({id, discordId, discordNome}: autorDaConta, ou o do back office
   em rotasQaDaEquipa).
   Devolve: promessa da Response — 201 {ok, id}, 400 sem descrição ou com
   descrição longa de mais, 429 com o travão. */
async function criarTicket(env, request, autor) {
  if (!(await rateLimit(env, 'qa:' + autor.id, TETO_HORA, 3600))) {
    return err(429, 'Já enviaste muitos tickets seguidos. Espera um pouco.');
  }
  const b = await body(request);
  const texto = b && typeof b.body === 'string' ? b.body.trim() : '';
  if (!texto) return err(400, 'Escreve o que viste.');
  if (texto.length > MAX_TEXTO) {
    return err(400, 'A descrição passa dos ' + MAX_TEXTO + ' caracteres. Encurta-a.');
  }
  const gravidade = GRAVIDADES.includes(b.severity) ? b.severity : null;
  const contexto = contextoParaGuardar(b.context);
  await limparRemovidos(env);
  const id = crypto.randomUUID(), t = now();
  await env.DB.prepare(
    `INSERT INTO qa_tickets (id, user_id, discord_id, discord_nome, body, severity, context, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, autor.id, autor.discordId || null, autor.discordNome || null, texto, gravidade, contexto, QA_NOVO, t, t).run();
  // o cartão dele no kanban da equipa, em A fazer
  await kanbanDoTicket(env, {
    tipo: 'qa', id, estado: QA_NOVO, agora: t,
    novo: { uuid: crypto.randomUUID(), ...cartaoDoTicketQa({ id, body: texto, severity: gravidade }) },
  });
  return json({ ok: true, id }, 201);
}

/* Leva um acontecimento de um ticket de QA ao kanban da equipa: o cartão
   nasce com o ticket e vai para a coluna que o ticket tomou (a regra em
   lib/kanban.js, corrida por rotas/kanban.js:sincronizarKanban). Só fora de
   produção, e nunca muda a resposta do ticket: uma falha fica no
   console.error e o ticket segue como se o kanban não existisse.
   Recebe: env — o ambiente do worker; ev — o acontecimento ({tipo: 'qa', id,
   estado, agora, novo?}).
   Devolve: promessa de nada (nunca lança). */
async function kanbanDoTicket(env, ev) {
  if (!env.ENV_NAME) return;
  try {
    const { sincronizarKanban } = await import('./kanban.js');
    await sincronizarKanban(env, ev);
  } catch (e) {
    console.error('kanban: o cartão do ticket de QA ' + ev.id + ' não acompanhou', e);
  }
}

/* Corre passos do kanban (lib/kanban.js) num lote, depois de o ticket já
   ter mudado: como em kanbanDoTicket, uma falha do kanban fica no
   console.error e o ticket segue (a mesma regra de ticketQaNaColuna, que
   corre antes dos passos do cartão).
   Recebe: env — o ambiente do worker; passos — a lista de {sql, params};
   falha — a frase para o registo.
   Devolve: promessa de true quando o lote correu, false quando falhou. */
async function passosNoKanban(env, passos, falha) {
  try {
    await env.DB.batch(passos.map((p) => env.DB.prepare(p.sql).bind(...p.params)));
    return true;
  } catch (e) {
    console.error('kanban: ' + falha, e);
    return false;
  }
}

/* O contexto de um ticket pronto a gravar: o objeto em JSON até 16 KB.
   Quando não cabe, corta primeiro o rasto pelos passos mais antigos (o rasto
   cresce pelo fim: web/cloud/nucleo.js empurra o novo e larga o primeiro) e,
   se mesmo sem rasto não couber, larga as chaves de topo maiores até caber.
   Um contexto cortado leva cortado: true, para quem o lê saber que falta
   algo — nunca se inventa o que lá não vinha.
   Recebe: v — o context do corpo do pedido (devia ser um objeto simples).
   Devolve: o JSON (texto) a gravar, ou null quando não veio um objeto (ou
   quando nem se deixa medir: um objeto aninhado sem fim rebenta o
   JSON.stringify, e isso não pode deitar abaixo o ticket). */
export function contextoParaGuardar(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  try {
    return cortarContexto({ ...v });
  } catch (e) {
    return null;
  }
}

/* O corte de contextoParaGuardar, sobre uma cópia rasa do objeto (a de quem
   chamou não muda).
   Recebe: o — a cópia do contexto, que este corte altera.
   Devolve: o JSON (texto) com até 16 KB. */
function cortarContexto(o) {
  let s = JSON.stringify(o);
  if (bytes(s) <= MAX_CONTEXTO) return s;
  o.cortado = true;
  if (Array.isArray(o.rasto)) {
    // os passos que cabem, do mais recente para trás, no espaço que sobra
    const livre = MAX_CONTEXTO - bytes(JSON.stringify({ ...o, rasto: [] }));
    const fica = [];
    let usado = 0;
    for (let i = o.rasto.length - 1; i >= 0; i--) {
      const n = bytes(JSON.stringify(o.rasto[i] === undefined ? null : o.rasto[i])) + 1;
      if (usado + n > livre) break;
      usado += n;
      fica.push(o.rasto[i]);
    }
    o.rasto = fica.reverse();
    s = JSON.stringify(o);
    if (bytes(s) <= MAX_CONTEXTO) return s;
    delete o.rasto;
  }
  // sem rasto e ainda grande: saem as chaves maiores, uma a uma. O tamanho
  // vai-se descontando (a chave, o valor, as aspas, os dois pontos e a
  // vírgula) e só se volta a medir o todo quando a conta diz que já cabe —
  // um objeto com milhares de chaves não pode custar milhares de medições.
  let total = bytes(JSON.stringify(o));
  const chaves = Object.keys(o).filter((k) => k !== 'cortado')
    .map((k) => ({ k, n: bytes(JSON.stringify(o[k]) || '') + bytes(JSON.stringify(k)) + 2 }))
    .sort((a, z) => z.n - a.n);
  for (const { k, n } of chaves) {
    delete o[k];
    total -= n;
    if (total > MAX_CONTEXTO) continue;
    s = JSON.stringify(o);
    if (bytes(s) <= MAX_CONTEXTO) return s;
    total = bytes(s);
  }
  return JSON.stringify({ cortado: true });
}

/* Quantos bytes um texto ocupa em UTF-8 — é assim que se mede o teto.
   Recebe: s — o texto.
   Devolve: o número de bytes. */
function bytes(s) {
  return new TextEncoder().encode(s).length;
}

/* GET /api/qa: a pílula é uma vista do kanban — as colunas, pela ordem do
   quadro, e os cartões do tipo Erro que não estão removidos, venham de onde
   vierem (de um ticket de QA, criados à mão, os da skill ticket), até 200.
   Os das colunas que não são de fim primeiro, pela ordem das colunas; em
   cada coluna, os por resolver pela prioridade do cartão (Mais alta a Mais
   baixa) com os mais recentes à frente, e os resolvidos (Human Tests e as
   de fim) com os resolvidos há menos tempo à frente; no fim os das colunas
   de fim. Ao cartão de um ticket de QA vivo junta-se o ticket (o contexto,
   a captura, o autor, a resolução). Um cartão de um pedido que alguém
   tenha mudado para Erro só o vê quem vê os pedidos (a descrição é o texto
   que a pessoa escreveu na Ajuda, e as contas da app nunca a veem; para os
   outros não está cá, e as rotas também não lhe chegam: cartaoDaPilula).
   Leva de passagem os removidos há mais de 24 h, e
   põe o nome do Discord nos tickets que ficaram só com o id (nomesEmFalta).
   Um ticket sem cartão (os de antes do kanban) não está no kanban, e por
   isso não está aqui: continua no scripts/qa.mjs listar.
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES);
   vePedidos — se quem pede vê os pedidos.
   Devolve: promessa da Response {colunas: [{id, nome, fim}], tickets: [Item]}
   (o Item em itemParaFora). */
async function listarTickets(env, vePedidos) {
  await limparRemovidos(env);
  const rows = (
    await env.DB.prepare(
      `SELECT k.numero, k.titulo, k.descricao, k.coluna_id, k.prioridade, k.origem_tipo, k.relator_id, k.relator_nome,
              k.created_at AS k_criado, k.updated_at AS k_mudado, k.concluido_at, COALESCE(c.fim, 0) AS fim,
              q.id, q.severity, q.context, q.image_key, q.resolution, q.resolved_at, q.created_at, q.updated_at,
              q.user_id, q.discord_id, q.discord_nome, u.name, u.email
         FROM kanban_cartoes k
         LEFT JOIN kanban_colunas c ON c.id = k.coluna_id
         LEFT JOIN qa_tickets q ON k.origem_tipo = 'qa' AND q.id = k.origem_id AND q.removed_at IS NULL
         LEFT JOIN users u ON u.id = q.user_id
        WHERE k.tipo = 'erro' AND k.removed_at IS NULL${vePedidos ? '' : " AND COALESCE(k.origem_tipo, '') <> 'pedido'"}
        ORDER BY COALESCE(c.fim, 0), COALESCE(c.ordem, 999), k.coluna_id,
                 CASE WHEN k.coluna_id = 'human-tests' OR c.fim = 1 THEN 0 ELSE k.prioridade END,
                 CASE WHEN k.coluna_id = 'human-tests' OR c.fim = 1 THEN COALESCE(q.resolved_at, k.concluido_at, k.updated_at)
                      ELSE COALESCE(q.created_at, k.created_at) END DESC,
                 k.numero DESC
        LIMIT ?`
    ).bind(TETO_LISTA).all()
  ).results;
  await nomesEmFalta(env, rows);
  return json({ colunas: await colunasDoKanban(env), tickets: rows.map(itemParaFora) });
}

/* Um cartão Erro da pílula, pela chave (KAN-N): vivo, do tipo Erro e, se
   for de um pedido, só para quem vê os pedidos — o mesmo que o GET mostra.
   Diz se o ticket de QA dele está vivo (então as rotas são as do ticket).
   Recebe: env; chave — 'KAN-N'; vePedidos — se quem pede vê os pedidos.
   Devolve: promessa de {id, numero, coluna_id, origem_tipo, origem_id,
   ticket_vivo (0/1)}, ou de null. */
async function cartaoDaPilula(env, chave, vePedidos) {
  const m = CHAVE_DO_CARTAO.exec(String(chave));
  if (!m) return null;
  return env.DB.prepare(
    `SELECT k.id, k.numero, k.coluna_id, k.origem_tipo, k.origem_id,
            (k.origem_tipo = 'qa' AND EXISTS (SELECT 1 FROM qa_tickets q WHERE q.id = k.origem_id AND q.removed_at IS NULL)) AS ticket_vivo
       FROM kanban_cartoes k
      WHERE k.numero = ? AND k.tipo = 'erro' AND k.removed_at IS NULL` + (vePedidos ? '' : " AND COALESCE(k.origem_tipo, '') <> 'pedido'")
  ).bind(Number(m[1])).first();
}

/* As rotas de um Erro sem ticket de QA (a chave KAN-N no lugar do id): as
   mesmas ações da pílula, escritas no cartão. Mover e reabrir levam-no a
   outra coluna (moverCartao); comentar é o comentário do kanban
   (comentarCartao); remover e repor são do master, no kanban (403); não há
   captura (404).
   Recebe: c — o contexto do pedido (como em rotasQa); k — o cartão (cartaoDaPilula).
   Devolve: promessa da Response. */
async function rotasDoCartao(c, k) {
  const { env, request, method, seg, me } = c;
  const quem = async () => autorDoComentario(c.autor || (await autorDaConta(env, me)), me);
  if ((seg.length === 3 && method === 'DELETE') || (seg[3] === 'repor' && method === 'POST')) {
    return err(403, 'Este cartão não veio de um ticket de QA: remove-se no kanban, e só o master o faz.');
  }
  if (seg[3] === 'reabrir' && method === 'POST') return moverCartao(env, k, QA_NOVO, await quem());
  if (seg[3] === 'mover' && method === 'POST') {
    const b = await body(request);
    return moverCartao(env, k, b && b.coluna, await quem());
  }
  if (seg[3] === 'imagem' && (method === 'GET' || method === 'PUT')) return err(404, 'Este cartão não tem captura.');
  if (seg[3] === 'comentarios' && method === 'POST') return comentarCartao(env, request, k, await quem());
  if (seg[3] === 'comentarios' && method === 'GET') return lerComentariosDoCartao(env, k, await quem());
  return err(404, 'Rota desconhecida.');
}

/* POST /api/qa/KAN-N/mover {coluna} e …/reabrir num Erro sem ticket: o
   cartão vai para o topo dessa coluna, com a linha «coluna» no histórico
   assinada por quem mexeu (lib/kanban.js:passosDoCartaoNaColuna).
   Recebe: env; k — o cartão; coluna — o id da coluna (do corpo, por
   validar); quem — {id, nome}.
   Devolve: promessa da Response {ok}, ou 400 com uma coluna que o kanban não tem. */
async function moverCartao(env, k, coluna, quem) {
  const col = eIdDeColuna(coluna) ? await env.DB.prepare('SELECT id FROM kanban_colunas WHERE id = ?').bind(coluna).first() : null;
  if (!col) return err(400, 'Essa coluna não existe no kanban.');
  const passos = passosDoCartaoNaColuna(k.id, col.id, quem, now());
  await env.DB.batch(passos.map((p) => env.DB.prepare(p.sql).bind(...p.params)));
  return json({ ok: true });
}

/* POST /api/qa/KAN-N/comentarios {texto} num Erro sem ticket: o comentário
   do kanban (lib/kanban.js:passosDoComentario) — fica no cartão e, em Human
   Tests, devolve-o a Auto Tests (recusar é comentar o que está mal); noutra
   coluna fica onde está. O texto e o travão são os do comentário de um
   ticket (comentarTicket).
   Recebe: env; request — com o corpo {texto}; k — o cartão; quem — {id, nome}.
   Devolve: promessa da Response 201 {ok, coluna (a do cartão depois), comentario}, 400 ou 429. */
async function comentarCartao(env, request, k, quem) {
  if (!(await rateLimit(env, 'qa-comentario:' + quem.id, TETO_COMENTARIOS_HORA, 3600))) {
    return err(429, 'Já comentaste muitas vezes seguidas. Espera um pouco.');
  }
  const b = await body(request);
  const texto = b && typeof b.texto === 'string' ? b.texto.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim() : '';
  if (!texto) return err(400, 'Escreve o comentário.');
  if (texto.length > MAX_TEXTO) return err(400, 'O comentário passa dos ' + MAX_TEXTO + ' caracteres. Encurta-o.');
  const uuid = crypto.randomUUID(), agora = now();
  const cartao = { id: k.id, coluna_id: k.coluna_id, origem_tipo: k.origem_tipo };
  const passos = passosDoComentario({ cartao, autor: quem, texto, uuid, agora });
  await env.DB.batch(passos.map((p) => env.DB.prepare(p.sql).bind(...p.params)));
  return json({
    ok: true, coluna: colunaDepoisDoComentario(cartao, quem.id),
    comentario: comentarioParaFora({ id: uuid, autor_id: quem.id, autor_nome: quem.nome, texto, created_at: agora, updated_at: agora }, quem.id),
  }, 201);
}

/* GET /api/qa/KAN-N/comentarios num Erro sem ticket: os comentários do
   cartão, sem os removidos, do mais antigo para o mais recente, até 500.
   Recebe: env; k — o cartão; quem — {id, nome} de quem pede (para o meu).
   Devolve: promessa da Response {comentarios: [...]}. */
async function lerComentariosDoCartao(env, k, quem) {
  const r = (await env.DB.prepare(
    `SELECT id, autor_id, autor_nome, texto, created_at, updated_at FROM kanban_comentarios
      WHERE cartao_id = ? AND removed_at IS NULL ORDER BY created_at, rowid LIMIT ?`
  ).bind(k.id, TETO_COMENTARIOS).all()).results || [];
  return json({ comentarios: r.map((c) => comentarioParaFora(c, quem.id)) });
}

/* As colunas do kanban pela ordem do quadro, como a pílula as mostra.
   Recebe: env — o ambiente do worker (D1 em env.DB).
   Devolve: promessa da lista [{id, nome, fim (bool)}]. */
async function colunasDoKanban(env) {
  const r = (await env.DB.prepare('SELECT id, nome, fim FROM kanban_colunas ORDER BY ordem, nome').all()).results || [];
  return r.map((c) => ({ id: c.id, nome: c.nome, fim: !!c.fim }));
}

// quantos devs sem nome se perguntam ao bot num pedido só
const TETO_NOMES = 5;

/* Os tickets de contas de teste que ficaram só com o id do Discord (a
   ligação não trouxe o nome e o bot não respondeu quando foram criados):
   pergunta o nome (teste.js:nomeDoDevNoDiscord, até TETO_NOMES devs por
   pedido) e grava-o na linha, para o scripts/qa.mjs, que lê a base, também
   o ver. Uma falha deixa o id, como estava.
   Recebe: env — o ambiente do worker; rows — as linhas do SELECT (mudam-se
   no sítio: discord_nome).
   Devolve: promessa de nada. */
async function nomesEmFalta(env, rows) {
  const ids = [...new Set(rows.filter((r) => r.discord_id && !r.discord_nome).map((r) => String(r.discord_id)))].slice(0, TETO_NOMES);
  if (!ids.length) return;
  try {
    const { nomeDoDevNoDiscord } = await import('../teste.js');
    for (const id of ids) {
      const nome = await nomeDoDevNoDiscord(env, id);
      if (!nome) continue;
      await env.DB.prepare('UPDATE qa_tickets SET discord_nome = ? WHERE discord_id = ? AND discord_nome IS NULL').bind(nome, id).run();
      for (const r of rows) if (String(r.discord_id) === id && !r.discord_nome) r.discord_nome = nome;
    }
  } catch (e) {}
}

/* Um cartão Erro da pílula (com o ticket de QA junto, quando o tem) na
   forma que a app e a camada do back office leem.
   Recebe: r — a linha do SELECT de listarTickets.
   Devolve: o item {id (o do ticket, ou a chave do cartão sem ticket),
   cartao ('KAN-N'), ticket (bool: tem ticket de QA), titulo, body (a
   descrição do cartão),
   prioridade (1 a 5), status (o id da coluna do cartão), severity (a do
   ticket, ou null), context (objeto ou null), imagem (bool), resolution,
   resolved_at, created_at, updated_at, autor}.
   O resolved_at de um cartão sem ticket é o concluido_at, ou, em Human
   Tests, a última alteração; o updated_at é o maior do cartão e do ticket.
   O autor é o do ticket — com discord: {id, nome} quando veio de uma conta
   de teste (a conta do Discord que pediu o /test), null nas outras —, ou,
   sem ticket, o relator do cartão. */
function itemParaFora(r) {
  const temTicket = !!r.id;
  let contexto = null;
  try { contexto = temTicket && r.context ? JSON.parse(r.context) : null; } catch (e) { contexto = null; }
  const chave = chaveDe(r.numero);
  const resolvido = r.coluna_id === 'human-tests' || !!r.fim;
  return {
    id: temTicket ? r.id : chave,
    cartao: chave,
    ticket: temTicket,
    titulo: r.titulo || '',
    body: r.descricao || '',
    prioridade: Number(r.prioridade) || 3,
    status: r.coluna_id,
    severity: (temTicket && r.severity) || null,
    context: contexto,
    imagem: temTicket && !!r.image_key,
    resolution: (temTicket && r.resolution) || null,
    resolved_at: temTicket ? r.resolved_at || null : resolvido ? r.concluido_at || r.k_mudado || null : null,
    created_at: temTicket ? r.created_at : r.k_criado,
    updated_at: Math.max(Number(r.k_mudado) || 0, Number(r.updated_at) || 0),
    autor: temTicket
      ? {
        id: r.user_id, nome: r.name || '', email: r.email || '',
        discord: r.discord_id ? { id: r.discord_id, nome: r.discord_nome || '' } : null,
      }
      : { id: r.relator_id || '', nome: r.relator_nome || r.relator_id || '', email: '', discord: null },
  };
}

/* Apaga de vez os tickets removidos há mais de 24 h, com a captura de cada
   um no R2 — primeiro o R2, depois a linha: se o R2 falhar, a linha fica e a
   próxima passagem tenta de novo. Corre de passagem no POST e no GET; uma
   falha aqui nunca deita abaixo o pedido que a trouxe.
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES).
   Devolve: promessa de quantos tickets saíram (0 também quando falha). */
async function limparRemovidos(env) {
  try {
    const limite = now() - GUARDA_REMOVIDO;
    const velhos = (
      await env.DB.prepare(
        `SELECT id, image_key FROM qa_tickets
          WHERE removed_at IS NOT NULL AND removed_at < ? LIMIT ?`
      ).bind(limite, LOTE_LIMPEZA).all()
    ).results;
    if (!velhos.length) return 0;
    const chaves = velhos.map((r) => r.image_key).filter(Boolean);
    if (chaves.length) await env.FILES.delete(chaves);
    const ids = velhos.map((r) => r.id);
    // os ? são um por id; os valores vão todos pelo bind
    const r = await env.DB.prepare(
      `DELETE FROM qa_tickets WHERE removed_at < ? AND id IN (${ids.map(() => '?').join(', ')})`
    ).bind(limite, ...ids).run();
    return (r && r.meta && r.meta.changes) || 0;
  } catch (e) {
    return 0;
  }
}

/* DELETE /api/qa/:id: remoção branda — fica com removed_at, sai da lista e
   espera 24 h pelo Anular (reporTicket) antes de se apagar de vez. O cartão
   dele no kanban sai com ele, com o mesmo removed_at e a linha «removido»
   assinada por quem removeu (lib/kanban.js:cartaoSaiComOTicket): o ticket e
   o cartão são a mesma coisa nos dois sítios. O ticket muda primeiro; uma
   falha do kanban não o desfaz (passosNoKanban).
   Recebe: env — o ambiente do worker (D1 em env.DB); id — o id do ticket;
   quem — {id, nome} de quem remove (autorDoComentario).
   Devolve: promessa da Response {ok}, ou 404 se não existe ou já foi removido. */
async function removerTicket(env, id, quem) {
  const vivo = await env.DB.prepare('SELECT id FROM qa_tickets WHERE id = ? AND removed_at IS NULL').bind(id).first();
  if (!vivo) return naoExiste();
  const t = now();
  await env.DB.prepare('UPDATE qa_tickets SET removed_at = ?, updated_at = ? WHERE id = ? AND removed_at IS NULL').bind(t, t, id).run();
  await passosNoKanban(env, cartaoSaiComOTicket(id, quem, t), 'o cartão do ticket de QA ' + id + ' não saiu com ele');
  return json({ ok: true });
}

/* POST /api/qa/:id/repor: o Anular de uma remoção — o ticket volta à lista
   como estava, e o cartão que saiu com ele volta ao kanban
   (lib/kanban.js:cartaoVoltaComOTicket, o do mesmo removed_at). Um removido
   há mais de 24 h já não volta (é como se tivesse sido apagado, mesmo que a
   limpeza ainda não tenha passado); um que nunca foi removido responde ok
   sem mudar nada.
   Recebe: env — o ambiente do worker (D1 em env.DB); id — o id do ticket;
   quem — {id, nome} de quem repõe.
   Devolve: promessa da Response {ok}, ou 404 se não existe. */
async function reporTicket(env, id, quem) {
  const t = now();
  const antes = await env.DB.prepare('SELECT removed_at FROM qa_tickets WHERE id = ?').bind(id).first();
  if (!antes) return naoExiste();
  if (antes.removed_at == null) return json({ ok: true });
  if (antes.removed_at < t - GUARDA_REMOVIDO) return naoExiste();
  await env.DB.prepare('UPDATE qa_tickets SET removed_at = NULL, updated_at = ? WHERE id = ? AND removed_at = ?').bind(t, id, antes.removed_at).run();
  await passosNoKanban(env, cartaoVoltaComOTicket(id, antes.removed_at, quem, t), 'o cartão do ticket de QA ' + id + ' não voltou com ele');
  return json({ ok: true });
}

/* POST /api/qa/:id/mover {coluna} e POST /api/qa/:id/reabrir (a A fazer):
   o ticket passa a outra coluna do kanban, e o cartão vai com ele (criado
   nessa coluna, se o ticket ainda não tinha). A resolution fica — quem pegar
   outra vez no ticket vê o que já se tentou (a app mostra-a como «Resolução
   anterior»); o resolved_at acompanha a coluna (lib/kanban.js:ticketQaNaColuna).
   Recebe: env — o ambiente do worker (D1 em env.DB); id — o id do ticket;
   coluna — o id da coluna (do corpo, por validar).
   Devolve: promessa da Response {ok}, 400 com uma coluna que o kanban não
   tem, ou 404 se o ticket não existe ou foi removido. */
async function moverTicket(env, id, coluna) {
  const col = eIdDeColuna(coluna) ? await env.DB.prepare('SELECT id FROM kanban_colunas WHERE id = ?').bind(coluna).first() : null;
  if (!col) return err(400, 'Essa coluna não existe no kanban.');
  const t = now();
  const p = ticketQaNaColuna(id, col.id, t);
  const r = await env.DB.prepare(p.sql).bind(...p.params).run();
  if (!r.meta.changes) return naoExiste();
  const q = await env.DB.prepare('SELECT body, severity FROM qa_tickets WHERE id = ?').bind(id).first();
  await kanbanDoTicket(env, {
    tipo: 'qa', id, estado: col.id, agora: t,
    novo: { uuid: crypto.randomUUID(), ...cartaoDoTicketQa({ id, body: q.body, severity: q.severity }) },
  });
  return json({ ok: true });
}

/* Quem assina um comentário no cartão de um ticket: a pessoa do Discord
   quando a há — a da sessão de equipa no back office, ou a que pediu o /test
   numa conta de teste —, com o id do Discord, como o kanban assina os
   comentários de quem lá escreve (rotas/kanban.js:quem): a mesma pessoa é a
   mesma autora na pílula e no kanban, e lá muda e remove os seus. Sem
   Discord (uma conta normal do dev), a conta, com o nome (ou o email).
   Recebe: autor — o de autorDaConta ou o do rotasQaDaEquipa ({id,
   discordId, discordNome}); me — o utilizador da sessão (null no back office).
   Devolve: {id, nome}. */
export function autorDoComentario(autor, me) {
  if (autor && autor.discordId) {
    const id = String(autor.discordId);
    return { id, nome: autor.discordNome ? String(autor.discordNome) : 'Discord ' + id };
  }
  return { id: String((autor && autor.id) || (me && me.id) || '?'), nome: String((me && (me.name || me.email)) || '') };
}

/* Um comentário do cartão na forma que a pílula lê.
   Recebe: c — a linha de kanban_comentarios; eu — o id de quem pede (autorDoComentario).
   Devolve: {id, autor: {id, nome}, texto, created_at, updated_at, meu}. */
function comentarioParaFora(c, eu) {
  return {
    id: c.id, autor: { id: c.autor_id, nome: c.autor_nome || '' }, texto: c.texto,
    created_at: c.created_at, updated_at: c.updated_at, meu: c.autor_id === eu,
  };
}

/* POST /api/qa/:id/comentarios {texto}: um comentário de quem testa no
   ticket. Fica no cartão do ticket no kanban (os comentários do ticket são
   os do cartão; o cartão nasce se o ticket ainda não o tinha) e o ticket, com
   o cartão, passa a Auto Tests de qualquer coluna, numa transação só
   (lib/kanban.js:passosDoComentarioQa): é o sinal de que há o que responder,
   e quem programa responde ao resolver (scripts/qa.mjs resolver, cuja nota
   entra como comentário). O texto é aparado, com as mudanças de linha, e tem
   de 1 a 4000 caracteres. Trava aos 60 por hora por pessoa. Com o cartão
   removido do kanban o comentário não teria onde ficar: 409, e o ticket fica
   onde está.
   Recebe: env — o ambiente do worker (D1 em env.DB); request — o pedido, com
   o corpo {texto}; id — o id do ticket; quem — {id, nome} (autorDoComentario).
   Devolve: promessa da Response — 201 {ok, coluna (Auto Tests), comentario}, 404 sem o
   ticket, 429 com o travão, 400 sem texto ou com texto longo de mais, 409
   com o cartão removido. */
async function comentarTicket(env, request, id, quem) {
  const q = await env.DB.prepare(
    `SELECT q.id, q.body, q.severity,
            (SELECT COUNT(*) FROM kanban_cartoes k WHERE k.origem_tipo = 'qa' AND k.origem_id = q.id) AS cartoes,
            (SELECT COUNT(*) FROM kanban_cartoes k WHERE k.origem_tipo = 'qa' AND k.origem_id = q.id AND k.removed_at IS NULL) AS vivos
       FROM qa_tickets q WHERE q.id = ? AND q.removed_at IS NULL`
  ).bind(id).first();
  if (!q) return naoExiste();
  if (!(await rateLimit(env, 'qa-comentario:' + quem.id, TETO_COMENTARIOS_HORA, 3600))) {
    return err(429, 'Já comentaste muitas vezes seguidas. Espera um pouco.');
  }
  const b = await body(request);
  const texto = b && typeof b.texto === 'string' ? b.texto.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim() : '';
  if (!texto) return err(400, 'Escreve o comentário.');
  if (texto.length > MAX_TEXTO) return err(400, 'O comentário passa dos ' + MAX_TEXTO + ' caracteres. Encurta-o.');
  if (q.cartoes > 0 && !q.vivos) return err(409, 'O cartão deste ticket foi removido do kanban. Repõe-o lá para poderes comentar.');
  const uuid = crypto.randomUUID(), agora = now();
  const passos = passosDoComentarioQa({
    ticket: { id: q.id, body: q.body, severity: q.severity }, autor: quem, texto, uuid, cartaoUuid: crypto.randomUUID(), agora,
  });
  await env.DB.batch(passos.map((p) => env.DB.prepare(p.sql).bind(...p.params)));
  return json({
    ok: true, coluna: QA_EM_CURSO,
    comentario: comentarioParaFora({ id: uuid, autor_id: quem.id, autor_nome: quem.nome, texto, created_at: agora, updated_at: agora }, quem.id),
  }, 201);
}

/* GET /api/qa/:id/comentarios: os comentários do ticket — os do cartão dele
   no kanban, sem os removidos, do mais antigo para o mais recente, até 500.
   Vêm à parte da lista (o GET /api/qa não os traz): só a janela de um ticket
   os pede. Sem cartão, a lista vazia.
   Recebe: env — o ambiente do worker (D1 em env.DB); id — o id do ticket;
   quem — {id, nome} de quem pede (para o meu).
   Devolve: promessa da Response {comentarios: [...]}, ou 404 sem o ticket. */
async function lerComentarios(env, id, quem) {
  const q = await env.DB.prepare('SELECT id FROM qa_tickets WHERE id = ? AND removed_at IS NULL').bind(id).first();
  if (!q) return naoExiste();
  const r = (await env.DB.prepare(
    `SELECT c.id, c.autor_id, c.autor_nome, c.texto, c.created_at, c.updated_at
       FROM kanban_comentarios c JOIN kanban_cartoes k ON k.id = c.cartao_id
      WHERE k.origem_tipo = 'qa' AND k.origem_id = ? AND k.removed_at IS NULL AND c.removed_at IS NULL
      ORDER BY c.created_at, c.rowid LIMIT ?`
  ).bind(id, TETO_COMENTARIOS).all()).results || [];
  return json({ comentarios: r.map((c) => comentarioParaFora(c, quem.id)) });
}

/* PUT /api/qa/:id/imagem: a captura de ecrã de um ticket, com o corpo em
   bytes. Só PNG, JPEG ou WebP — pelo Content-Type e pelos próprios bytes
   (tipoDaImagem), para nunca se servir outra coisa com cara de imagem — e
   até 3 MB. Grava no R2 em qa/<id> (uma segunda substitui a primeira) e só
   depois marca o image_key na linha.
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES);
   request — o pedido, com os bytes no corpo; id — o id do ticket.
   Devolve: promessa da Response {ok}, ou 404 (ticket), 415 (tipo), 413
   (tamanho) ou 400 (vazia). */
async function gravarImagem(env, request, id) {
  const linha = await env.DB.prepare('SELECT id FROM qa_tickets WHERE id = ? AND removed_at IS NULL').bind(id).first();
  if (!linha) return naoExiste();
  const dito = String(request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!TIPOS_IMAGEM.includes(dito)) return err(415, 'A captura tem de ser uma imagem PNG, JPEG ou WebP.');
  const tamanhoDito = Number(request.headers.get('Content-Length') || 0);
  if (tamanhoDito > MAX_IMAGEM) return err(413, 'A captura é grande de mais (máx. 3 MB).');
  const corpo = await lerAte(request, MAX_IMAGEM);
  if (!corpo) return err(413, 'A captura é grande de mais (máx. 3 MB).');
  if (!corpo.byteLength) return err(400, 'A captura chegou vazia.');
  const tipo = tipoDaImagem(corpo);
  if (!tipo) return err(415, 'A captura tem de ser uma imagem PNG, JPEG ou WebP.');
  const chave = 'qa/' + id;
  await env.FILES.put(chave, corpo, { httpMetadata: { contentType: tipo } });
  await env.DB.prepare('UPDATE qa_tickets SET image_key = ?, updated_at = ? WHERE id = ?')
    .bind(chave, now(), id).run();
  return json({ ok: true });
}

/* GET /api/qa/:id/imagem: os bytes da captura, com o tipo lido dos próprios
   bytes, sem cache (private, no-store) e na caixa de areia dos anexos
   (CSP_ANEXO, nosniff).
   Recebe: env — o ambiente do worker (D1 em env.DB, R2 em env.FILES); id —
   o id do ticket.
   Devolve: promessa da Response com a imagem, ou 404 sem ticket ou sem imagem. */
async function servirImagem(env, id) {
  const linha = await env.DB.prepare(
    'SELECT image_key FROM qa_tickets WHERE id = ? AND removed_at IS NULL'
  ).bind(id).first();
  if (!linha || !linha.image_key) return err(404, 'Este ticket não tem captura.');
  const obj = await env.FILES.get(linha.image_key);
  if (!obj) return err(404, 'Este ticket não tem captura.');
  const corpo = new Uint8Array(await new Response(obj.body).arrayBuffer());
  return new Response(corpo, {
    headers: {
      'Content-Type': tipoDaImagem(corpo) || 'application/octet-stream',
      'Content-Length': String(corpo.byteLength),
      'Cache-Control': 'private, no-store',
      // o index.js deixa passar este valor exato pelo harden (PODE_APERTAR)
      'Content-Security-Policy': CSP_ANEXO,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
