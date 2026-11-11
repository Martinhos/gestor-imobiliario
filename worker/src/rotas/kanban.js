/* O kanban da equipa no servidor: as rotas /api/equipa/kanban.
   ------------------------------------------------------------
   O board onde vivem as tarefas da equipa (migrations/0028_kanban.sql), no
   lugar do board KAN do Jira e com as mesmas chaves (KAN-N). Vive só no dev:
   sem env.ENV_NAME todas as rotas respondem 404 antes de lerem o corpo, como
   se não existissem. Quem tem um papel da equipa (lib/papeis.js:PAPEIS) vê e
   mexe nos cartões; as colunas e o remover e repor de cartões são do master.
   A descrição do cartão de um pedido (o texto que a pessoa escreveu na Ajuda)
   fica inteira na base, mas só a vê e muda quem vê os pedidos (a categoria
   'user': hoje, o suporte e o master) — a decisão do Martinho, 2026-11-09.

   Como o resto do back office, toda a escrita vai primeiro ao audit_log
   (kanban.<ação>, com a chave KAN-N ou o id da coluna como alvo), e sem rasto
   não se escreve. No criar, a linha do rasto vai no mesmo lote que o cartão:
   é a única forma de levar a chave que o contador dá nessa transação.

   O quadro lê-se num número fixo de consultas, seja qual for o número de
   cartões (a D1 tem um teto por invocação): as contagens de cada cartão —
   comentários, anexos, subtarefas, bloqueado — vêm de subconsultas agrupadas
   juntas ao SELECT dos cartões, nunca de uma consulta por cartão. Pela mesma
   razão, as listas (etiquetas, histórico, a ordem nova de uma coluna) vão
   numa instrução só, por json_each, e não numa por elemento.

   A ordem dentro de uma coluna é a posicao (real, a menor em cima): mover
   põe o cartão a meio dos vizinhos e, quando o intervalo fica pequeno de
   mais, renumera a coluna de 1024 em 1024.

   Os tickets de QA e os pedidos aceites criam e movem os seus cartões
   sozinhos por sincronizarKanban (a regra vive em lib/kanban.js), chamado de
   rotas/qa.js e de equipa-api.js. */

import { json, err, body, badId, now, CSP_ANEXO } from '../lib/http.js';
import { auditar } from '../lib/auditoria.js';
import { PAPEIS, comoLista, catsDe } from '../lib/papeis.js';
import { PREFIXO, TIPOS, PRIORIDADES, AUTOMATICO, QA_EM_CURSO, chaveDe, numeroDaChave, passosDaSincronizacao, passosDoComentarioQa } from '../lib/kanban.js';
import { tipoDaImagem, lerAte } from '../lib/imagens.js';

// O começo de todos os caminhos daqui.
const BASE = '/api/equipa/kanban';
// Os tetos do que se escreve, em caracteres.
const MAX_TITULO = 200;
const MAX_DESCRICAO = 20000;
const MAX_ETIQUETA = 40;
const MAX_COMENTARIO = 8000;
const MAX_NOME_COLUNA = 60;
// Quantas etiquetas um cartão leva.
const MAX_ETIQUETAS = 20;
// Quantas colunas o quadro pode ter.
const MAX_COLUNAS = 20;
// Um anexo de imagem até 5 MB.
const MAX_ANEXO = 5 * 1024 * 1024;
// O nome de um anexo guarda-se até aqui.
const MAX_NOME_ANEXO = 120;
// Quantos valores cada filtro do quadro aceita (tipo=erro,tarefa…).
const MAX_FILTRO = 20;
// O passo das posições numa coluna.
const PASSO = 1024;
// Abaixo deste intervalo entre dois vizinhos, a coluna renumera-se.
const INTERVALO_MINIMO = 1 / 1024;
// O antes e o depois de uma descrição no histórico cortam-se aqui.
const MAX_NO_HISTORICO = 1000;
// O resumo da origem (o texto de um ticket de QA) no detalhe de um cartão.
const MAX_RESUMO = 600;
// Os comentários e as linhas do histórico que o detalhe de um cartão traz, no máximo.
const TETO_DETALHE = 500;
// Os tipos de ligação que se pedem; 'bloqueado' grava-se como 'bloqueia' ao contrário.
const LIGACOES = ['bloqueia', 'bloqueado', 'relaciona'];
// O Claude entra nas pessoas do quadro mesmo sem ter passado pelo back office.
const CLAUDE = { id: 'claude', nome: 'Claude' };

// As colunas com o total de cartões de cada uma (sem filtros); junta-se o WHERE e o ORDER BY.
const SQL_COLUNAS = 'SELECT c.id, c.nome, c.ordem, c.fim, c.fixa, COALESCE(n.total, 0) AS total FROM kanban_colunas c' +
  ' LEFT JOIN (SELECT coluna_id, COUNT(*) AS total FROM kanban_cartoes WHERE removed_at IS NULL GROUP BY coluna_id) n' +
  ' ON n.coluna_id = c.id';

// Quem aparece no rasto da equipa e nos cartões, com o instante mais recente de cada um.
const SQL_PESSOAS = "SELECT quem AS id, nome, papel, MAX(at) AS t FROM audit_log WHERE papel <> 'utilizador' GROUP BY quem" +
  ' UNION ALL SELECT responsavel_id, COALESCE(responsavel_nome, \'\'), NULL, MAX(updated_at) FROM kanban_cartoes' +
  ' WHERE responsavel_id IS NOT NULL GROUP BY responsavel_id' +
  ' UNION ALL SELECT relator_id, relator_nome, NULL, MAX(created_at) FROM kanban_cartoes GROUP BY relator_id';

/* As rotas do kanban (/api/equipa/kanban…), chamadas de
   equipa-api.js:rotasEquipaApi antes do portão das categorias: o kanban é de
   toda a equipa, seja qual for o canto de cada um. Sem env.ENV_NAME, 404 antes
   de ler o corpo; sem um papel da equipa, 403. As recusas da validação vêm
   como {error, campo}, com o campo do corpo que falhou.
   Recebe: c — o contexto do pedido ({env, request, method, path, url, eu}),
   com a sessão de equipa em eu já verificada.
   Devolve: promessa da Response, ou de null quando o caminho não é do kanban
   (ou é, mas nenhuma rota casa: quem chama responde 404). */
export async function rotasKanban(c) {
  const { env, request, method, path, url } = c;
  const eu = c.eu;
  if (path !== BASE && !path.startsWith(BASE + '/')) return null;
  if (!env.ENV_NAME) return err(404, 'Rota desconhecida.');
  if (!temPapel(eu)) return err(403, 'O kanban é da equipa: o teu cargo não o abre.');
  const seg = path.slice(BASE.length).split('/').filter(Boolean).map(descodificar);
  try {
    return await encaminhar(env, request, method, url, eu, seg);
  } catch (e) {
    if (!e || !e.recusa) throw e;
    const r = e.recusa;
    return json(r.campo ? { error: r.frase, campo: r.campo } : { error: r.frase }, r.status);
  }
}

/* Escolhe a rota pelo caminho (já sem /api/equipa/kanban) e pelo método.
   Recebe: env; request; method; url; eu — a sessão de equipa; seg — os
   pedaços do caminho, descodificados.
   Devolve: promessa da Response, ou de null quando nenhuma rota casa. */
async function encaminhar(env, request, method, url, eu, seg) {
  const [a, b, d] = seg;
  if (seg.length > 3) return null;
  if (!a) return method === 'GET' ? lerQuadro(env, url, eu) : null;
  if (a === 'pessoas') return seg.length === 1 && method === 'GET' ? json({ pessoas: await pessoasDoQuadro(env, eu) }) : null;
  if (a === 'cartoes') {
    if (seg.length === 1) return method === 'POST' ? criarCartao(env, request, eu) : null;
    if (seg.length === 2) {
      if (method === 'GET') return lerCartao(env, eu, b);
      if (method === 'PATCH') return editarCartao(env, request, eu, b);
      if (method === 'DELETE') return removerCartao(env, eu, b);
      return null;
    }
    if (d === 'mover' && method === 'POST') return moverCartao(env, request, eu, b);
    if (d === 'repor' && method === 'POST') return reporCartao(env, eu, b);
    if (d === 'comentarios' && method === 'POST') return comentar(env, request, eu, b);
    if (d === 'ligacoes' && method === 'POST') return ligar(env, request, eu, b);
    if (d === 'anexos' && method === 'PUT') return anexar(env, request, eu, b);
    return null;
  }
  if (a === 'comentarios' && seg.length === 2) {
    if (method === 'PATCH') return editarComentario(env, request, eu, b);
    if (method === 'DELETE') return removerComentario(env, eu, b);
    return null;
  }
  if (a === 'ligacoes' && seg.length === 2) return method === 'DELETE' ? desligar(env, eu, b) : null;
  if (a === 'anexos' && seg.length === 2) {
    if (method === 'GET') return servirAnexo(env, b);
    if (method === 'DELETE') return removerAnexo(env, eu, b);
    return null;
  }
  if (a === 'colunas' && seg.length <= 2) {
    const rota = seg.length === 1 ? (method === 'POST' ? 'criar' : null)
      : b === 'ordem' ? (method === 'POST' ? 'ordem' : null)
        : method === 'PATCH' ? 'mudar' : method === 'DELETE' ? 'remover' : null;
    if (!rota) return null;
    if (!eMaster(eu)) return err(403, 'Só o master mexe nas colunas.');
    if (rota === 'criar') return criarColuna(env, request, eu);
    if (rota === 'ordem') return ordenarColunas(env, request, eu);
    if (rota === 'mudar') return mudarColuna(env, request, eu, b);
    return removerColuna(env, eu, b);
  }
  return null;
}

/* ------------------------------ a sincronização ------------------------------ */

/* Corre um acontecimento de uma origem (um ticket de QA ou um pedido) no
   kanban: os passos de lib/kanban.js:passosDaSincronizacao, ligados com bind,
   num batch (uma transação). É o gancho de rotas/qa.js e de equipa-api.js:
   sem env.ENV_NAME não faz nada (na produção o kanban não existe), e nunca
   lança — uma falha fica no console.error e a ação do ticket segue.
   Recebe: env — o ambiente do worker; ev — o acontecimento ({tipo, id, estado,
   agora, autor?, novo?, comentario?}, como passosDaSincronizacao o lê).
   Devolve: promessa de true quando o lote correu, false quando não havia nada a
   correr, não havia kanban ou falhou. */
export async function sincronizarKanban(env, ev) {
  if (!env || !env.ENV_NAME) return false;
  try {
    const passos = passosDaSincronizacao(ev);
    if (!passos.length) return false;
    await env.DB.batch(passos.map((p) => env.DB.prepare(p.sql).bind(...p.params)));
    return true;
  } catch (e) {
    console.error('kanban: a sincronização de ' + (ev && ev.tipo) + ' ' + (ev && ev.id) + ' falhou', e);
    return false;
  }
}

/* --------------------------------- peças --------------------------------- */

/* Uma recusa para lançar a meio da validação: rotasKanban apanha-a e
   responde {error, campo} com o estado dado.
   Recebe: status — o estado HTTP; frase — o erro, em português; campo
   (opcional) — o campo do corpo que falhou, para o formulário o marcar.
   Devolve: o Error com a recusa em .recusa, pronto a lançar. */
function recusa(status, frase, campo) {
  const e = new Error(frase);
  e.recusa = { status, frase, campo: campo || null };
  return e;
}

/* Um pedaço do caminho descodificado; um % mal formado fica como veio (e
   depois não casa com nada).
   Recebe: s — o pedaço.
   Devolve: o texto. */
function descodificar(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

/* Se a sessão tem um dos papéis da equipa.
   Recebe: eu — a sessão de equipa (papeis ou papel).
   Devolve: booleano. */
function temPapel(eu) {
  return comoLista(eu && (eu.papeis || eu.papel)).some((p) => PAPEIS.indexOf(p) > -1);
}

/* Se a sessão é do master.
   Recebe: eu — a sessão de equipa.
   Devolve: booleano. */
function eMaster(eu) {
  return comoLista(eu && (eu.papeis || eu.papel)).indexOf('master') > -1;
}

/* Quem age, como fica nos cartões, nos comentários e no histórico.
   Recebe: eu — a sessão de equipa.
   Devolve: {id: o id do Discord, nome}. */
function quem(eu) {
  return { id: String((eu && eu.discordId) || '?'), nome: String((eu && eu.nome) || '') };
}

/* Os papéis da sessão como o audit_log os guarda (os mesmos de lib/auditoria.js:auditar).
   Recebe: eu — a sessão de equipa.
   Devolve: o texto ('master', 'admin+dev', …). */
function papelDe(eu) {
  return ((eu && eu.papeis) || [eu && eu.papel]).filter(Boolean).join('+');
}

/* Corta um texto a n caracteres, com reticências quando corta.
   Recebe: s — o texto (null conta como vazio); n — o máximo.
   Devolve: o texto cortado. */
function cortar(s, n) {
  const t = String(s == null ? '' : s);
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/* Uma lista guardada em JSON (json_group_array), em ordem alfabética.
   Recebe: v — o texto JSON (ou null).
   Devolve: a lista de textos (vazia quando não se lê). */
function lerLista(v) {
  try {
    const l = JSON.parse(v || '[]');
    return Array.isArray(l) ? l.filter((x) => typeof x === 'string').sort() : [];
  } catch (e) {
    return [];
  }
}

/* A resposta de um cartão que não existe (ou foi removido, ou nem tem forma de chave).
   Recebe: nada.
   Devolve: a Response 404. */
function naoHaCartao() {
  return err(404, 'Cartão não encontrado.');
}

/* A resposta quando a auditoria não escreveu: sem rasto, o kanban não se mexe.
   Recebe: nada.
   Devolve: a Response 500. */
function semRasto() {
  return err(500, 'A auditoria não está a escrever — sem rasto não se mexe no kanban.');
}

/* O corpo do pedido como objeto, ou a recusa.
   Recebe: request — o pedido.
   Devolve: promessa do objeto. Lança a recusa 400 quando não é um objeto JSON. */
async function corpoObjeto(request) {
  const b = await body(request);
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw recusa(400, 'O pedido tem de levar um objeto JSON.');
  return b;
}

/* ------------------------------- a validação ------------------------------- */

/* O tipo de um cartão. Recebe: v — o valor do corpo.
   Devolve: o tipo (um de TIPOS). Lança a recusa 400 noutro caso. */
function tipoValido(v) {
  if (TIPOS.indexOf(v) < 0) throw recusa(400, 'Escolhe o tipo: épico, história, tarefa, subtarefa ou erro.', 'tipo');
  return v;
}

/* O título, aparado e numa linha só. Recebe: v — o valor do corpo.
   Devolve: o título (1 a 200 caracteres). Lança a recusa 400 noutro caso. */
function tituloValido(v) {
  const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  if (!t) throw recusa(400, 'Escreve o título.', 'titulo');
  if (t.length > MAX_TITULO) throw recusa(400, 'O título passa dos 200 caracteres. Encurta-o.', 'titulo');
  return t;
}

/* A descrição, aparada. Recebe: v — o valor do corpo (null é vazia).
   Devolve: o texto (até 20 000 caracteres). Lança a recusa 400 noutro caso. */
function descricaoValida(v) {
  if (v == null) return '';
  if (typeof v !== 'string') throw recusa(400, 'A descrição tem de ser texto.', 'descricao');
  const t = v.replace(/\r\n?/g, '\n').trim();
  if (t.length > MAX_DESCRICAO) throw recusa(400, 'A descrição passa dos 20 000 caracteres. Encurta-a.', 'descricao');
  return t;
}

/* A prioridade, de 1 (mais alta) a 5 (mais baixa). Recebe: v — o valor do
   corpo (número, ou o número em texto).
   Devolve: o inteiro. Lança a recusa 400 noutro caso. */
function prioridadeValida(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (PRIORIDADES.indexOf(n) < 0) throw recusa(400, 'A prioridade vai de 1 (mais alta) a 5 (mais baixa).', 'prioridade');
  return n;
}

/* Uma etiqueta normalizada: minúsculas, sem espaços (os espaços e as
   vírgulas viram hífen), como no Jira (a-espera).
   Recebe: v — o texto.
   Devolve: a etiqueta ('' quando não sobra nada). */
function etiquetaNormal(v) {
  return String(v).normalize('NFC').trim().toLowerCase().replace(/[\s,]+/g, '-');
}

/* As etiquetas de um cartão, normalizadas, sem repetidas e por ordem.
   Recebe: v — a lista do corpo (null é nenhuma).
   Devolve: a lista (até 20, cada uma até 40 caracteres). Lança a recusa 400 noutro caso. */
function etiquetasValidas(v) {
  if (v == null) return [];
  if (!Array.isArray(v)) throw recusa(400, 'As etiquetas vão numa lista.', 'etiquetas');
  const out = [];
  for (const x of v) {
    if (typeof x !== 'string') throw recusa(400, 'Cada etiqueta é um texto.', 'etiquetas');
    const e = etiquetaNormal(x);
    if (!e) continue;
    if (/[\u0000-\u001f\u007f]/.test(e)) throw recusa(400, 'Uma etiqueta não leva caracteres de controlo.', 'etiquetas');
    if (e.length > MAX_ETIQUETA) throw recusa(400, 'Uma etiqueta tem até 40 caracteres.', 'etiquetas');
    if (out.indexOf(e) < 0) out.push(e);
    if (out.length > MAX_ETIQUETAS) throw recusa(400, 'Um cartão leva até 20 etiquetas.', 'etiquetas');
  }
  return out.sort();
}

/* O prazo: um dia que exista, escrito AAAA-MM-DD.
   Recebe: v — o valor do corpo (null ou '' é sem prazo).
   Devolve: o texto, ou null. Lança a recusa 400 noutro caso. */
function prazoValido(v) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw recusa(400, 'O prazo escreve-se AAAA-MM-DD.', 'prazo');
  const d = new Date(v + 'T00:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw recusa(400, 'Esse prazo não é um dia que exista.', 'prazo');
  return v;
}

/* A referência ao cartão pai que vem no corpo.
   Recebe: v — a chave (KAN-N, kan-N ou N), ou null/'' para sem pai.
   Devolve: {numero}, ou null. Lança a recusa 400 quando não é uma chave. */
function refDoPai(v) {
  if (v == null || v === '') return null;
  const n = numeroDaChave(v);
  if (!n) throw recusa(400, 'O pai escreve-se com a chave do cartão (KAN-N).', 'pai');
  return { numero: n };
}

/* O cartão pai, pelas regras: um épico não tem pai; uma subtarefa tem de ter
   um, e não pode ser um épico; nenhum cartão é pai de si mesmo nem de um
   antepassado seu (um WITH RECURSIVE sobe a árvore numa consulta só).
   Recebe: env; k — o cartão que vai ter o pai (null quando ainda não existe);
   tipo — o tipo que o cartão vai ter; ref — {numero} ou {id} do pai, ou null.
   Devolve: promessa da linha do pai ({id, numero, tipo}), ou de null sem pai.
   Lança a recusa 400 quando alguma regra falha. */
async function paiValido(env, k, tipo, ref) {
  if (!ref) {
    if (tipo === 'subtarefa') throw recusa(400, 'Uma subtarefa precisa de um cartão pai.', 'pai');
    return null;
  }
  if (tipo === 'epico') throw recusa(400, 'Um épico não tem pai.', 'pai');
  const pai = await env.DB.prepare('SELECT id, numero, tipo FROM kanban_cartoes WHERE ' + (ref.id ? 'id' : 'numero') + ' = ? AND removed_at IS NULL')
    .bind(ref.id || ref.numero).first();
  if (!pai) throw recusa(400, 'Esse cartão pai não existe.', 'pai');
  if (tipo === 'subtarefa' && pai.tipo === 'epico') {
    throw recusa(400, 'Uma subtarefa fica debaixo de uma tarefa, de uma história ou de um erro, nunca de um épico.', 'pai');
  }
  if (k && pai.id === k.id) throw recusa(400, 'Um cartão não é pai de si mesmo.', 'pai');
  if (k) {
    const ciclo = await env.DB.prepare(
      'WITH RECURSIVE acima(id, pai_id, n) AS (SELECT id, pai_id, 0 FROM kanban_cartoes WHERE id = ?' +
      ' UNION ALL SELECT c.id, c.pai_id, a.n + 1 FROM kanban_cartoes c JOIN acima a ON c.id = a.pai_id WHERE a.n < 100)' +
      ' SELECT 1 AS sim FROM acima WHERE id = ? LIMIT 1'
    ).bind(pai.id, k.id).first();
    if (ciclo) throw recusa(400, chaveDe(pai.numero) + ' está debaixo deste cartão: não pode ser o pai dele.', 'pai');
  }
  return pai;
}

/* O responsável de um cartão: alguém das pessoas do quadro (quem está no
   rasto da equipa ou nos cartões, a sessão e o Claude).
   Recebe: env; eu — a sessão de equipa; v — o id (null ou '' é ninguém).
   Devolve: promessa de {id, nome}, ou de null. Lança a recusa 400 quando o id
   não é de ninguém da equipa. */
async function responsavelValido(env, eu, v) {
  if (v == null || v === '') return null;
  const id = String(v);
  const p = badId(id) ? null : (await pessoasDoQuadro(env, eu)).find((x) => x.id === id);
  if (!p) throw recusa(400, 'Essa pessoa não está na equipa.', 'responsavel_id');
  return p;
}

/* ------------------------------ o que se lê ------------------------------ */

/* O SELECT dos cartões na forma do CartaoCurto, com as contagens por
   subconsultas agrupadas (uma consulta só, seja qual for o número de cartões).
   Recebe: onde — a condição do WHERE (com ? para os valores); completo —
   true para trazer também a descrição e o relator (o detalhe de um cartão).
   Devolve: o texto do SQL, por coluna e posição. */
function sqlDosCartoes(onde, completo) {
  return 'SELECT k.id, k.numero, k.tipo, k.titulo, k.coluna_id, k.posicao, k.prioridade, k.responsavel_id, k.responsavel_nome,' +
    ' k.prazo, k.origem_tipo, k.origem_id, k.origem_estado, k.created_at, k.updated_at, k.concluido_at,' +
    (completo ? ' k.descricao, k.relator_id, k.relator_nome,' : '') +
    ' p.numero AS pai_numero, p.titulo AS pai_titulo, p.tipo AS pai_tipo,' +
    ' COALESCE(cm.n, 0) AS n_comentarios, COALESCE(ax.n, 0) AS n_anexos,' +
    ' COALESCE(st.total, 0) AS sub_total, COALESCE(st.feitas, 0) AS sub_feitas,' +
    ' (bl.para_id IS NOT NULL) AS bloqueado, et.lista AS etiquetas,' +
    // se o ticket de origem está nesta base (um pedido sincronizado da produção não está): um EXISTS pela chave primária
    " CASE k.origem_tipo WHEN 'pedido' THEN EXISTS (SELECT 1 FROM tickets ot WHERE ot.id = k.origem_id)" +
    " WHEN 'qa' THEN EXISTS (SELECT 1 FROM qa_tickets oq WHERE oq.id = k.origem_id) END AS origem_existe" +
    ' FROM kanban_cartoes k' +
    ' LEFT JOIN kanban_colunas col ON col.id = k.coluna_id' +
    ' LEFT JOIN kanban_cartoes p ON p.id = k.pai_id AND p.removed_at IS NULL' +
    ' LEFT JOIN (SELECT cartao_id, COUNT(*) AS n FROM kanban_comentarios WHERE removed_at IS NULL GROUP BY cartao_id) cm' +
    ' ON cm.cartao_id = k.id' +
    ' LEFT JOIN (SELECT cartao_id, COUNT(*) AS n FROM kanban_anexos GROUP BY cartao_id) ax ON ax.cartao_id = k.id' +
    ' LEFT JOIN (SELECT f.pai_id, COUNT(*) AS total, SUM(CASE WHEN fc.fim = 1 THEN 1 ELSE 0 END) AS feitas' +
    ' FROM kanban_cartoes f LEFT JOIN kanban_colunas fc ON fc.id = f.coluna_id' +
    ' WHERE f.removed_at IS NULL AND f.pai_id IS NOT NULL GROUP BY f.pai_id) st ON st.pai_id = k.id' +
    ' LEFT JOIN (SELECT DISTINCT l.para_id FROM kanban_ligacoes l' +
    ' JOIN kanban_cartoes bk ON bk.id = l.de_id AND bk.removed_at IS NULL' +
    ' LEFT JOIN kanban_colunas bc ON bc.id = bk.coluna_id' +
    " WHERE l.tipo = 'bloqueia' AND COALESCE(bc.fim, 0) = 0) bl ON bl.para_id = k.id" +
    ' LEFT JOIN (SELECT cartao_id, json_group_array(etiqueta) AS lista FROM kanban_etiquetas GROUP BY cartao_id) et' +
    ' ON et.cartao_id = k.id' +
    ' WHERE ' + onde +
    ' ORDER BY COALESCE(col.ordem, 999999), k.posicao, k.numero';
}

/* Se a sessão vê os pedidos das pessoas: a categoria 'user' dos papéis
   (lib/papeis.js:catsDe; hoje, o suporte e o master). A quem não a tem, a
   descrição de um cartão de um pedido (o texto que a pessoa escreveu) não se
   mostra — a decisão do Martinho, 2026-11-09: «Inteiro, mas só para quem vê
   pedidos».
   Recebe: eu — a sessão de equipa.
   Devolve: booleano. */
function vePedidos(eu) {
  return catsDe(eu && (eu.papeis || eu.papel)).indexOf('user') > -1;
}

/* Se a descrição de um cartão se esconde a uma sessão: é de um pedido e a
   sessão não vê pedidos.
   Recebe: r — a linha do cartão (com origem_tipo); ve — vePedidos da sessão.
   Devolve: booleano. */
function descricaoOculta(r, ve) {
  return r.origem_tipo === 'pedido' && !ve;
}

/* Uma linha de sqlDosCartoes na forma que sai (o CartaoCurto do contrato).
   Recebe: r — a linha; ve — se a sessão vê os pedidos (vePedidos).
   Devolve: o cartão {id, chave, numero, tipo, titulo, coluna_id, posicao,
   prioridade, etiquetas, responsavel, pai, prazo, origem, comentarios,
   anexos, subtarefas, bloqueado, created_at, updated_at, concluido_at}, e
   descricaoOculta: true quando a descrição dele não é para esta sessão. A
   origem leva existe: se o ticket dela está nesta base (um pedido que o
   scripts/kanban.mjs sincronizar trouxe da produção não está). */
function cartaoCurto(r, ve) {
  const c = {
    id: r.id,
    chave: chaveDe(r.numero),
    numero: r.numero,
    tipo: r.tipo,
    titulo: r.titulo,
    coluna_id: r.coluna_id,
    posicao: r.posicao,
    prioridade: r.prioridade,
    etiquetas: lerLista(r.etiquetas),
    responsavel: r.responsavel_id ? { id: r.responsavel_id, nome: r.responsavel_nome || '' } : null,
    pai: r.pai_numero != null ? { chave: chaveDe(r.pai_numero), titulo: r.pai_titulo, tipo: r.pai_tipo } : null,
    prazo: r.prazo || null,
    origem: r.origem_tipo ? { tipo: r.origem_tipo, id: r.origem_id, estado: r.origem_estado || null, existe: !!r.origem_existe } : null,
    comentarios: r.n_comentarios || 0,
    anexos: r.n_anexos || 0,
    subtarefas: { total: r.sub_total || 0, feitas: r.sub_feitas || 0 },
    bloqueado: !!r.bloqueado,
    created_at: r.created_at,
    updated_at: r.updated_at,
    concluido_at: r.concluido_at == null ? null : r.concluido_at,
  };
  if (descricaoOculta(r, ve)) c.descricaoOculta = true;
  return c;
}

/* Uma coluna na forma que sai.
   Recebe: r — a linha de SQL_COLUNAS.
   Devolve: {id, nome, ordem, fim, fixa, total}, com fim e fixa booleanos. */
function colunaParaFora(r) {
  return { id: r.id, nome: r.nome, ordem: r.ordem, fim: !!r.fim, fixa: !!r.fixa, total: r.total || 0 };
}

/* Um cartão por mexer, pela chave: a linha toda, o número do pai, se a
   coluna é de fim e as etiquetas (em JSON), numa consulta.
   Recebe: env; chave — 'KAN-77', 'kan-77' ou '77'; comRemovidos — true para
   encontrar também um removido (o repor).
   Devolve: promessa da linha, ou de null. */
async function cartaoParaMexer(env, chave, comRemovidos) {
  const n = numeroDaChave(chave);
  if (!n) return null;
  return env.DB.prepare(
    'SELECT k.*, p.numero AS pai_numero, col.fim AS coluna_fim,' +
    ' (SELECT json_group_array(e.etiqueta) FROM kanban_etiquetas e WHERE e.cartao_id = k.id) AS etiquetas_json' +
    ' FROM kanban_cartoes k LEFT JOIN kanban_cartoes p ON p.id = k.pai_id LEFT JOIN kanban_colunas col ON col.id = k.coluna_id' +
    ' WHERE k.numero = ?' + (comRemovidos ? '' : ' AND k.removed_at IS NULL')
  ).bind(n).first();
}

/* A resposta {cartao} de um cartão, lido de novo da base.
   Recebe: env; id — o id do cartão; eu — a sessão (para a descrição oculta);
   status (opcional) — o estado HTTP (200).
   Devolve: promessa da Response (404 se entretanto desapareceu). */
async function devolverCartao(env, id, eu, status) {
  const r = await env.DB.prepare(sqlDosCartoes('k.id = ?')).bind(id).first();
  return r ? json({ cartao: cartaoCurto(r, vePedidos(eu)) }, status || 200) : naoHaCartao();
}

/* As pessoas do quadro: quem aparece no rasto da equipa (com um papel da
   equipa) e nos cartões (responsável ou relator), mais a sessão e o Claude,
   sem repetidos — cada uma com o nome mais recente que tiver — e por nome. A
   Sincronização não é uma pessoa e não entra. Uma consulta.
   Recebe: env; eu — a sessão de equipa.
   Devolve: promessa da lista de {id, nome}. */
async function pessoasDoQuadro(env, eu) {
  const linhas = (await env.DB.prepare(SQL_PESSOAS).all()).results || [];
  linhas.sort((a, b) => (b.t || 0) - (a.t || 0));
  const vistas = new Map();
  const juntar = (id, nome) => {
    if (!id || id === '?' || id === AUTOMATICO.id) return;
    const ja = vistas.get(id);
    if (!ja) vistas.set(id, { id, nome: nome || '' });
    else if (!ja.nome && nome) ja.nome = nome;
  };
  // primeiro os nomes certos: a sessão (o mais fresco) e o Claude (que nos cartões importados pode vir «Claude (Jira)»)
  const eu1 = quem(eu);
  juntar(eu1.id, eu1.nome);
  juntar(CLAUDE.id, CLAUDE.nome);
  for (const r of linhas) {
    if (r.papel != null && !String(r.papel).split('+').some((p) => PAPEIS.indexOf(p) > -1)) continue;
    juntar(String(r.id), r.nome ? String(r.nome) : '');
  }
  return [...vistas.values()].sort((a, b) => (a.nome || a.id).localeCompare(b.nome || b.id, 'pt'));
}

/* Os filtros do quadro, da query: q (chave, título ou descrição), tipo,
   etiqueta, responsavel (um id, ou eu), prioridade e pai (a chave de um
   épico). Cada um aceita vários valores separados por vírgula (ou repetidos),
   que somam (um OU dentro do filtro, um E entre filtros).
   Recebe: url — o URL do pedido; eu — a sessão de equipa.
   Devolve: {onde: as condições, vals: os valores}. Lança a recusa 400 com um
   valor que não existe. */
function filtrosDoQuadro(url, eu) {
  const p = url.searchParams;
  const onde = ['k.removed_at IS NULL'], vals = [];
  // sem repetidos e com teto: a D1 aceita até 100 valores ligados por instrução (aqui, no pior caso, 73)
  const lista = (nome) => [...new Set(p.getAll(nome).join(',').split(',').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_FILTRO);
  const marcas = (n) => new Array(n).fill('?').join(', ');
  const q = (p.get('q') || '').trim().slice(0, 100);
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, (m) => '\\' + m) + '%';
    // a quem não vê os pedidos, a descrição de um pedido não se procura: senão a pesquisa adivinhava-a
    const naDescricao = vePedidos(eu) ? "k.descricao LIKE ? ESCAPE '\\'"
      : "(k.descricao LIKE ? ESCAPE '\\' AND COALESCE(k.origem_tipo, '') <> 'pedido')";
    onde.push("(k.numero = ? OR k.titulo LIKE ? ESCAPE '\\' OR " + naDescricao + ')');
    vals.push(numeroDaChave(q) || -1, like, like);
  }
  const tipos = lista('tipo');
  if (tipos.length) {
    if (tipos.some((t) => TIPOS.indexOf(t) < 0)) throw recusa(400, 'Esse tipo de cartão não existe.', 'tipo');
    onde.push('k.tipo IN (' + marcas(tipos.length) + ')');
    vals.push(...tipos);
  }
  const etiquetas = [...new Set(lista('etiqueta').map(etiquetaNormal).filter(Boolean))];
  if (etiquetas.length) {
    onde.push('k.id IN (SELECT cartao_id FROM kanban_etiquetas WHERE etiqueta IN (' + marcas(etiquetas.length) + '))');
    vals.push(...etiquetas);
  }
  const resp = lista('responsavel').map((r) => (r === 'eu' ? quem(eu).id : r));
  if (resp.length) {
    onde.push('k.responsavel_id IN (' + marcas(resp.length) + ')');
    vals.push(...resp);
  }
  const prios = [...new Set(lista('prioridade').map(Number))];
  if (prios.length) {
    if (prios.some((n) => PRIORIDADES.indexOf(n) < 0)) throw recusa(400, 'A prioridade vai de 1 (mais alta) a 5 (mais baixa).', 'prioridade');
    onde.push('k.prioridade IN (' + marcas(prios.length) + ')');
    vals.push(...prios);
  }
  const pais = [...new Set(lista('pai').map(numeroDaChave))];
  if (pais.length) {
    if (pais.some((n) => !n)) throw recusa(400, 'O épico escreve-se com a chave (KAN-N).', 'pai');
    onde.push('k.pai_id IN (SELECT id FROM kanban_cartoes WHERE numero IN (' + marcas(pais.length) + '))');
    vals.push(...pais);
  }
  return { onde, vals };
}

/* GET /api/equipa/kanban: o quadro inteiro, filtrado pela query, em quatro
   consultas fixas — as colunas com o total de cada uma (sem filtros), os
   cartões com as contagens, as etiquetas que existem e as pessoas.
   Recebe: env; url — o URL do pedido (os filtros); eu — a sessão de equipa.
   Devolve: promessa da Response {colunas, cartoes, etiquetas, pessoas, eu: {id, nome, master}}. */
async function lerQuadro(env, url, eu) {
  const f = filtrosDoQuadro(url, eu);
  const [colunas, cartoes, etiquetas, pessoas] = await Promise.all([
    env.DB.prepare(SQL_COLUNAS + ' ORDER BY c.ordem, c.nome').all(),
    env.DB.prepare(sqlDosCartoes(f.onde.join(' AND '))).bind(...f.vals).all(),
    env.DB.prepare('SELECT DISTINCT e.etiqueta FROM kanban_etiquetas e JOIN kanban_cartoes k ON k.id = e.cartao_id' +
      ' WHERE k.removed_at IS NULL ORDER BY e.etiqueta').all(),
    pessoasDoQuadro(env, eu),
  ]);
  const eu1 = quem(eu), ve = vePedidos(eu);
  return json({
    colunas: (colunas.results || []).map(colunaParaFora),
    cartoes: (cartoes.results || []).map((r) => cartaoCurto(r, ve)),
    etiquetas: (etiquetas.results || []).map((r) => r.etiqueta),
    pessoas,
    eu: { id: eu1.id, nome: eu1.nome, master: eMaster(eu) },
  });
}

/* GET /api/equipa/kanban/cartoes/:chave: um cartão inteiro — o CartaoCurto
   com a descrição e o relator, as subtarefas, os comentários (meu: os da
   sessão), o histórico, as ligações dos dois lados, os anexos e a origem com
   o resumo (o texto do ticket de QA, ou o assunto do pedido). Consultas fixas.
   O cartão de um pedido, a quem não vê os pedidos (vePedidos), sai com a
   descrição vazia e descricaoOculta, sem o resumo da origem e sem o antes e o
   depois das linhas «descricao» do histórico.
   Recebe: env; eu — a sessão de equipa; chave — KAN-77, kan-77 ou 77.
   Devolve: promessa da Response, ou 404. */
async function lerCartao(env, eu, chave) {
  const n = numeroDaChave(chave);
  if (!n) return naoHaCartao();
  const r = await env.DB.prepare(sqlDosCartoes('k.numero = ? AND k.removed_at IS NULL', true)).bind(n).first();
  if (!r) return naoHaCartao();
  const id = r.id, eu1 = quem(eu), ve = vePedidos(eu), oculta = descricaoOculta(r, ve);
  const origemSql = r.origem_tipo === 'qa' ? 'SELECT body AS resumo FROM qa_tickets WHERE id = ?'
    : r.origem_tipo === 'pedido' && !oculta ? 'SELECT subject AS resumo FROM tickets WHERE id = ?' : null;
  const [subs, coms, hist, ligs, anexos, origem] = await Promise.all([
    env.DB.prepare(sqlDosCartoes('k.pai_id = ? AND k.removed_at IS NULL')).bind(id).all(),
    env.DB.prepare('SELECT id, autor_id, autor_nome, texto, created_at, updated_at FROM kanban_comentarios' +
      ' WHERE cartao_id = ? AND removed_at IS NULL ORDER BY created_at, rowid LIMIT ?').bind(id, TETO_DETALHE).all(),
    env.DB.prepare('SELECT at, autor_id, autor_nome, campo, antes, depois FROM kanban_historico WHERE cartao_id = ?' +
      ' ORDER BY at DESC, id DESC LIMIT ?').bind(id, TETO_DETALHE).all(),
    env.DB.prepare('SELECT l.id, l.tipo, l.de_id, o.numero, o.titulo, o.tipo AS cartao_tipo, o.coluna_id FROM kanban_ligacoes l' +
      ' JOIN kanban_cartoes o ON o.id = CASE WHEN l.de_id = ? THEN l.para_id ELSE l.de_id END' +
      ' WHERE (l.de_id = ? OR l.para_id = ?) AND o.removed_at IS NULL ORDER BY l.created_at, o.numero').bind(id, id, id).all(),
    env.DB.prepare('SELECT id, nome, tipo, tamanho, autor_id, autor_nome, created_at FROM kanban_anexos' +
      ' WHERE cartao_id = ? ORDER BY created_at, rowid').bind(id).all(),
    origemSql ? env.DB.prepare(origemSql).bind(r.origem_id).first() : Promise.resolve(null),
  ]);
  const cartao = Object.assign(cartaoCurto(r, ve), {
    descricao: oculta ? '' : r.descricao || '',
    relator: { id: r.relator_id, nome: r.relator_nome || '' },
  });
  return json({
    cartao,
    subtarefas: (subs.results || []).map((s) => cartaoCurto(s, ve)),
    comentarios: (coms.results || []).map((c) => comentarioParaFora(c, eu1.id)),
    historico: (hist.results || []).reverse().map((h) => {
      // a descrição de um pedido também não passa pelo histórico
      const tapa = oculta && h.campo === 'descricao';
      return {
        at: h.at, autor: { id: h.autor_id, nome: h.autor_nome || '' }, campo: h.campo,
        antes: tapa || h.antes == null ? null : h.antes, depois: tapa || h.depois == null ? null : h.depois,
      };
    }),
    ligacoes: (ligs.results || []).map((l) => ({
      id: l.id,
      tipo: l.tipo === 'relaciona' ? 'relaciona' : l.de_id === id ? 'bloqueia' : 'bloqueado',
      cartao: { chave: chaveDe(l.numero), titulo: l.titulo, tipo: l.cartao_tipo, coluna_id: l.coluna_id },
    })),
    anexos: (anexos.results || []).map(anexoParaFora),
    origem: r.origem_tipo ? {
      tipo: r.origem_tipo, id: r.origem_id, estado: r.origem_estado || null, existe: !!r.origem_existe,
      resumo: origem && origem.resumo != null ? cortar(origem.resumo, MAX_RESUMO) : null,
    } : null,
  });
}

/* Um comentário na forma que sai.
   Recebe: c — a linha de kanban_comentarios; eu — o id da sessão.
   Devolve: {id, autor: {id, nome}, texto, created_at, updated_at, meu}. */
function comentarioParaFora(c, eu) {
  return {
    id: c.id, autor: { id: c.autor_id, nome: c.autor_nome || '' }, texto: c.texto,
    created_at: c.created_at, updated_at: c.updated_at, meu: c.autor_id === eu,
  };
}

/* Um anexo na forma que sai, com o endereço de onde se lê.
   Recebe: a — a linha de kanban_anexos.
   Devolve: {id, nome, tipo, tamanho, url, autor: {id, nome}, created_at}. */
function anexoParaFora(a) {
  return {
    id: a.id, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, url: BASE + '/anexos/' + a.id,
    autor: { id: a.autor_id, nome: a.autor_nome || '' }, created_at: a.created_at,
  };
}

/* ------------------------------ os cartões ------------------------------ */

/* POST /api/equipa/kanban/cartoes: um cartão novo, no topo da coluna (a-fazer
   sem coluna), com o relator a sessão. O número sobe pelo kanban_contador
   (MAX(último, maior número) + 1) no mesmo lote que o INSERT, e a linha do
   audit_log vai à frente nesse lote, com a chave que o contador vai dar.
   Recebe: env; request — o corpo {tipo*, titulo*, descricao, coluna_id,
   prioridade, etiquetas, responsavel_id, pai, prazo}; eu — a sessão.
   Devolve: promessa da Response 201 {cartao}, ou a recusa. */
async function criarCartao(env, request, eu) {
  const b = await corpoObjeto(request);
  const tipo = tipoValido(b.tipo);
  const titulo = tituloValido(b.titulo);
  const descricao = descricaoValida(b.descricao);
  const prioridade = b.prioridade == null || b.prioridade === '' ? 3 : prioridadeValida(b.prioridade);
  const etiquetas = etiquetasValidas(b.etiquetas);
  const prazo = prazoValido(b.prazo);
  const colunaId = b.coluna_id == null || b.coluna_id === '' ? 'a-fazer' : b.coluna_id;
  const coluna = typeof colunaId === 'string' && !badId(colunaId)
    ? await env.DB.prepare('SELECT id, fim FROM kanban_colunas WHERE id = ?').bind(colunaId).first() : null;
  if (!coluna) throw recusa(400, 'Essa coluna não existe.', 'coluna_id');
  const pai = await paiValido(env, null, tipo, refDoPai(b.pai));
  const resp = await responsavelValido(env, eu, b.responsavel_id);

  const id = crypto.randomUUID(), agora = now(), autor = quem(eu);
  const proximo = 'MAX(ultimo, (SELECT COALESCE(MAX(numero), 0) FROM kanban_cartoes)) + 1';
  const passos = [
    // o rasto primeiro, com a chave que o contador vai dar já a seguir (tudo na mesma transação)
    env.DB.prepare('INSERT INTO audit_log (at, quem, nome, papel, acao, alvo, detalhe)' +
      " SELECT ?, ?, ?, ?, 'kanban.criar', ? || (" + proximo + '), ? FROM kanban_contador WHERE id = 1')
      .bind(agora, autor.id, autor.nome, papelDe(eu), PREFIXO, cortar(titulo, 120)),
    env.DB.prepare('UPDATE kanban_contador SET ultimo = ' + proximo + ' WHERE id = 1'),
    env.DB.prepare('INSERT INTO kanban_cartoes (id, numero, tipo, titulo, descricao, coluna_id, posicao, prioridade,' +
      ' responsavel_id, responsavel_nome, relator_id, relator_nome, pai_id, prazo, created_at, updated_at, concluido_at)' +
      ' VALUES (?, (SELECT ultimo FROM kanban_contador WHERE id = 1), ?, ?, ?, ?,' +
      ' (SELECT COALESCE(MIN(posicao), ?) - ? FROM kanban_cartoes WHERE coluna_id = ? AND removed_at IS NULL),' +
      ' ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, tipo, titulo, descricao, coluna.id, PASSO, PASSO, coluna.id, prioridade,
        resp ? resp.id : null, resp ? resp.nome : null, autor.id, autor.nome, pai ? pai.id : null, prazo,
        agora, agora, coluna.fim ? agora : null),
  ];
  if (etiquetas.length) {
    passos.push(env.DB.prepare('INSERT INTO kanban_etiquetas (cartao_id, etiqueta) SELECT ?, value FROM json_each(?)')
      .bind(id, JSON.stringify(etiquetas)));
  }
  passos.push(env.DB.prepare("INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) VALUES (?, ?, ?, ?, 'criado', NULL, ?)")
    .bind(id, agora, autor.id, autor.nome, coluna.id));
  await env.DB.batch(passos);
  return devolverCartao(env, id, eu, 201);
}

/* PATCH /api/equipa/kanban/cartoes/:chave: muda os campos que vierem (tipo,
   titulo, descricao, prioridade, etiquetas, responsavel_id, pai, prazo; null
   tira o responsável, o pai e o prazo). Cada campo que mudou deixa uma linha
   no histórico (a descrição cortada aos 1000 caracteres; o responsável pelo
   nome; o pai pela chave). Com o tipo, revalida o pai: um épico não tem pai
   (nem subtarefas debaixo), uma subtarefa tem. Sem mudanças, não escreve. A
   descrição de um pedido só a muda quem vê os pedidos (403 aos outros).
   Recebe: env; request — o corpo; eu — a sessão; chave — a do cartão.
   Devolve: promessa da Response {cartao}, 404 ou a recusa. */
async function editarCartao(env, request, eu, chave) {
  const k = await cartaoParaMexer(env, chave);
  if (!k) return naoHaCartao();
  const b = await corpoObjeto(request);
  const tem = (c) => Object.prototype.hasOwnProperty.call(b, c);
  const sets = [], valores = [], mudas = [];
  const muda = (campo, coluna, valor, antes, depois) => {
    sets.push(coluna + ' = ?');
    valores.push(valor);
    mudas.push({ campo, antes, depois });
  };

  const tipo = tem('tipo') ? tipoValido(b.tipo) : k.tipo;
  if (tipo !== k.tipo) muda('tipo', 'tipo', tipo, k.tipo, tipo);
  if (tem('titulo')) {
    const t = tituloValido(b.titulo);
    if (t !== k.titulo) muda('titulo', 'titulo', t, k.titulo, t);
  }
  if (tem('descricao')) {
    // quem não vê a descrição de um pedido também não a muda (os outros campos, sim)
    if (descricaoOculta(k, vePedidos(eu))) throw recusa(403, 'Só quem vê os pedidos muda a descrição de um pedido.', 'descricao');
    const d = descricaoValida(b.descricao);
    if (d !== k.descricao) muda('descricao', 'descricao', d, cortar(k.descricao, MAX_NO_HISTORICO) || null, cortar(d, MAX_NO_HISTORICO) || null);
  }
  if (tem('prioridade')) {
    const p = prioridadeValida(b.prioridade);
    if (p !== k.prioridade) muda('prioridade', 'prioridade', p, String(k.prioridade), String(p));
  }
  if (tem('prazo')) {
    const p = prazoValido(b.prazo);
    if (p !== (k.prazo || null)) muda('prazo', 'prazo', p, k.prazo || null, p);
  }
  let etiquetas = null;
  if (tem('etiquetas')) {
    const novas = etiquetasValidas(b.etiquetas), antes = lerLista(k.etiquetas_json);
    if (novas.join(',') !== antes.join(',')) {
      etiquetas = novas;
      mudas.push({ campo: 'etiquetas', antes: antes.join(',') || null, depois: novas.join(',') || null });
    }
  }
  if (tem('responsavel_id')) {
    const r = await responsavelValido(env, eu, b.responsavel_id);
    if ((r ? r.id : null) !== (k.responsavel_id || null)) {
      sets.push('responsavel_id = ?', 'responsavel_nome = ?');
      valores.push(r ? r.id : null, r ? r.nome : null);
      mudas.push({ campo: 'responsavel', antes: k.responsavel_id ? (k.responsavel_nome || k.responsavel_id) : null, depois: r ? (r.nome || r.id) : null });
    }
  }
  // o pai valida-se quando muda, e também quando muda o tipo (um épico não tem pai, uma subtarefa tem)
  if (tem('pai') || tipo !== k.tipo) {
    const pai = await paiValido(env, k, tipo, tem('pai') ? refDoPai(b.pai) : (k.pai_id ? { id: k.pai_id } : null));
    if ((pai ? pai.id : null) !== (k.pai_id || null)) {
      muda('pai', 'pai_id', pai ? pai.id : null, k.pai_numero != null ? chaveDe(k.pai_numero) : null, pai ? chaveDe(pai.numero) : null);
    }
  }
  if (tipo === 'epico' && k.tipo !== 'epico') {
    const sub = await env.DB.prepare("SELECT numero FROM kanban_cartoes WHERE pai_id = ? AND tipo = 'subtarefa' AND removed_at IS NULL LIMIT 1")
      .bind(k.id).first();
    if (sub) throw recusa(400, 'Este cartão tem subtarefas (' + chaveDe(sub.numero) + '): uma subtarefa não fica debaixo de um épico.', 'tipo');
  }
  if (!mudas.length) return devolverCartao(env, k.id, eu);

  if (!(await auditar(env, eu, 'kanban.editar', chaveDe(k.numero), mudas.map((m) => m.campo).join(', ')))) return semRasto();
  const agora = now(), autor = quem(eu);
  const passos = [env.DB.prepare('UPDATE kanban_cartoes SET ' + sets.concat('updated_at = ?').join(', ') + ' WHERE id = ?')
    .bind(...valores, agora, k.id)];
  if (etiquetas) {
    passos.push(env.DB.prepare('DELETE FROM kanban_etiquetas WHERE cartao_id = ?').bind(k.id));
    if (etiquetas.length) {
      passos.push(env.DB.prepare('INSERT INTO kanban_etiquetas (cartao_id, etiqueta) SELECT ?, value FROM json_each(?)')
        .bind(k.id, JSON.stringify(etiquetas)));
    }
  }
  passos.push(env.DB.prepare('INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois)' +
    " SELECT ?, ?, ?, ?, json_extract(value, '$.campo'), json_extract(value, '$.antes'), json_extract(value, '$.depois')" +
    ' FROM json_each(?)').bind(k.id, agora, autor.id, autor.nome, JSON.stringify(mudas)));
  await env.DB.batch(passos);
  return devolverCartao(env, k.id, eu);
}

/* O lugar de um cartão que entra na posição i de uma coluna: a meio dos
   vizinhos (ou um passo antes do primeiro, ou depois do último). Quando os
   vizinhos estão perto de mais para caber outro a meio, pede-se a
   renumeração e o lugar é o da contagem nova.
   Recebe: lista — os cartões da coluna sem o que se move ({id, posicao}, por
   ordem); i — o índice de destino (0 a lista.length).
   Devolve: {posicao, renumerar}. */
function lugarNaColuna(lista, i) {
  const antes = i > 0 ? lista[i - 1].posicao : null;
  const depois = i < lista.length ? lista[i].posicao : null;
  if (antes == null && depois == null) return { posicao: 0, renumerar: false };
  if (antes == null) return { posicao: depois - PASSO, renumerar: false };
  if (depois == null) return { posicao: antes + PASSO, renumerar: false };
  if (depois - antes > INTERVALO_MINIMO) return { posicao: (antes + depois) / 2, renumerar: false };
  return { posicao: (i + 1) * PASSO, renumerar: true };
}

/* POST /api/equipa/kanban/cartoes/:chave/mover: o cartão vai para a coluna
   e o lugar pedidos ({coluna_id, indice}; indice 0 é o topo, contado sem o
   próprio cartão, e maior do que a coluna é o fim). A posição fica a meio
   dos vizinhos; com o intervalo pequeno de mais, a coluna inteira renumera-se
   de 1024 em 1024 numa instrução (a ordem nova por json_each). Mudar de
   coluna deixa a linha «coluna» no histórico e acerta o concluido_at pela
   coluna de fim; reordenar não deixa linha. O ticket de QA de origem vai com o cartão (o gatilho kanban_qa_coluna da migração 0029); um pedido nunca muda.
   Recebe: env; request — o corpo; eu — a sessão; chave — a do cartão.
   Devolve: promessa da Response {cartao}, 404 ou a recusa. */
async function moverCartao(env, request, eu, chave) {
  const k = await cartaoParaMexer(env, chave);
  if (!k) return naoHaCartao();
  const b = await corpoObjeto(request);
  const colunaId = typeof b.coluna_id === 'string' ? b.coluna_id : '';
  if (!colunaId || badId(colunaId)) throw recusa(400, 'Escolhe a coluna para onde vai.', 'coluna_id');
  if (b.indice != null && (typeof b.indice !== 'number' || !Number.isInteger(b.indice) || b.indice < 0)) {
    throw recusa(400, 'O lugar na coluna é um número inteiro, de 0 para cima.', 'indice');
  }
  const col = await env.DB.prepare('SELECT id, fim FROM kanban_colunas WHERE id = ?').bind(colunaId).first();
  if (!col) throw recusa(400, 'Essa coluna não existe.', 'coluna_id');
  const todos = (await env.DB.prepare('SELECT id, posicao FROM kanban_cartoes WHERE coluna_id = ? AND removed_at IS NULL ORDER BY posicao, numero')
    .bind(col.id).all()).results || [];
  const atual = todos.findIndex((x) => x.id === k.id);
  const lista = todos.filter((x) => x.id !== k.id);
  const i = Math.min(b.indice == null ? 0 : b.indice, lista.length);
  // já está ali: nada a escrever
  if (atual === i) return devolverCartao(env, k.id, eu);

  const lugar = lugarNaColuna(lista, i);
  const mudaColuna = col.id !== k.coluna_id;
  const agora = now(), autor = quem(eu);
  const concluido = !mudaColuna ? (k.concluido_at == null ? null : k.concluido_at)
    : col.fim ? (k.coluna_fim ? (k.concluido_at || agora) : agora) : null;
  const detalhe = mudaColuna ? k.coluna_id + ' → ' + col.id : 'reordenado em ' + col.id + ' (lugar ' + i + ')';
  if (!(await auditar(env, eu, 'kanban.mover', chaveDe(k.numero), detalhe))) return semRasto();
  const passos = [env.DB.prepare('UPDATE kanban_cartoes SET coluna_id = ?, posicao = ?, concluido_at = ?, updated_at = ? WHERE id = ?')
    .bind(col.id, lugar.posicao, concluido, agora, k.id)];
  if (lugar.renumerar) {
    const ordem = lista.map((x) => x.id);
    ordem.splice(i, 0, k.id);
    passos.push(env.DB.prepare('UPDATE kanban_cartoes SET posicao = (SELECT (j.key + 1) * ? FROM json_each(?) j WHERE j.value = kanban_cartoes.id)' +
      ' WHERE id IN (SELECT value FROM json_each(?))').bind(PASSO, JSON.stringify(ordem), JSON.stringify(ordem)));
  }
  if (mudaColuna) {
    passos.push(env.DB.prepare("INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) VALUES (?, ?, ?, ?, 'coluna', ?, ?)")
      .bind(k.id, agora, autor.id, autor.nome, k.coluna_id, col.id));
  }
  await env.DB.batch(passos);
  return devolverCartao(env, k.id, eu);
}

/* DELETE /api/equipa/kanban/cartoes/:chave (só o master): remoção branda
   (removed_at), para o Anular; sai do quadro e deixa a linha «removido».
   Recebe: env; eu — a sessão; chave — a do cartão.
   Devolve: promessa da Response {ok}, 403 ou 404. */
async function removerCartao(env, eu, chave) {
  if (!eMaster(eu)) return err(403, 'Só o master remove cartões.');
  const k = await cartaoParaMexer(env, chave);
  if (!k) return naoHaCartao();
  if (!(await auditar(env, eu, 'kanban.remover', chaveDe(k.numero), cortar(k.titulo, 120)))) return semRasto();
  const agora = now(), autor = quem(eu);
  await env.DB.batch([
    env.DB.prepare('UPDATE kanban_cartoes SET removed_at = ?, removed_by = ?, updated_at = ? WHERE id = ? AND removed_at IS NULL')
      .bind(agora, autor.id, agora, k.id),
    env.DB.prepare("INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) VALUES (?, ?, ?, ?, 'removido', NULL, NULL)")
      .bind(k.id, agora, autor.id, autor.nome),
  ]);
  return json({ ok: true });
}

/* POST /api/equipa/kanban/cartoes/:chave/repor (só o master): o Anular de
   uma remoção — o cartão volta ao sítio onde estava (a A fazer, se a coluna
   dele entretanto saiu) e deixa a linha «reposto». Um que não está removido
   responde como está, sem escrever.
   Recebe: env; eu — a sessão; chave — a do cartão.
   Devolve: promessa da Response {cartao}, 403 ou 404. */
async function reporCartao(env, eu, chave) {
  if (!eMaster(eu)) return err(403, 'Só o master repõe cartões.');
  const k = await cartaoParaMexer(env, chave, true);
  if (!k) return naoHaCartao();
  if (k.removed_at == null) return devolverCartao(env, k.id, eu);
  if (!(await auditar(env, eu, 'kanban.repor', chaveDe(k.numero), cortar(k.titulo, 120)))) return semRasto();
  const agora = now(), autor = quem(eu);
  await env.DB.batch([
    env.DB.prepare('UPDATE kanban_cartoes SET removed_at = NULL, removed_by = NULL, updated_at = ?,' +
      " coluna_id = CASE WHEN EXISTS (SELECT 1 FROM kanban_colunas c WHERE c.id = kanban_cartoes.coluna_id) THEN coluna_id ELSE 'a-fazer' END" +
      ' WHERE id = ?').bind(agora, k.id),
    env.DB.prepare("INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) VALUES (?, ?, ?, ?, 'reposto', NULL, NULL)")
      .bind(k.id, agora, autor.id, autor.nome),
  ]);
  return devolverCartao(env, k.id, eu);
}

/* ------------------------------ os comentários ------------------------------ */

/* O texto de um comentário, aparado. Recebe: v — o valor do corpo.
   Devolve: o texto (1 a 8000 caracteres). Lança a recusa 400 noutro caso. */
function textoDoComentario(v) {
  const t = typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : '';
  if (!t) throw recusa(400, 'Escreve o comentário.', 'texto');
  if (t.length > MAX_COMENTARIO) throw recusa(400, 'O comentário passa dos 8000 caracteres. Encurta-o.', 'texto');
  return t;
}

/* POST /api/equipa/kanban/cartoes/:chave/comentarios: um comentário novo da sessão.
   O cartão de um ticket de QA que ainda existe faz como o comentário na
   pílula (rotas/qa.js:comentarTicket): o ticket e o cartão passam a Auto
   Tests, de qualquer coluna, no mesmo lote que o comentário
   (lib/kanban.js:passosDoComentarioQa) — um comentário é o que há para
   responder. Os outros cartões ficam onde estão.
   Recebe: env; request — o corpo {texto*}; eu — a sessão; chave — a do cartão.
   Devolve: promessa da Response {comentario, coluna_id (a do cartão depois)}, 404 ou a recusa. */
async function comentar(env, request, eu, chave) {
  const k = await cartaoParaMexer(env, chave);
  if (!k) return naoHaCartao();
  const texto = textoDoComentario((await corpoObjeto(request)).texto);
  if (!(await auditar(env, eu, 'kanban.comentar', chaveDe(k.numero), cortar(texto, 120)))) return semRasto();
  const id = crypto.randomUUID(), agora = now(), autor = quem(eu);
  const q = k.origem_tipo === 'qa' && k.origem_id
    ? await env.DB.prepare('SELECT id, body, severity FROM qa_tickets WHERE id = ? AND removed_at IS NULL').bind(k.origem_id).first()
    : null;
  if (q) {
    const passos = passosDoComentarioQa({ ticket: { id: q.id, body: q.body, severity: q.severity }, autor, texto, uuid: id, cartaoUuid: crypto.randomUUID(), agora });
    await env.DB.batch(passos.map((p) => env.DB.prepare(p.sql).bind(...p.params)));
    return json({
      comentario: comentarioParaFora({ id, autor_id: autor.id, autor_nome: autor.nome, texto, created_at: agora, updated_at: agora }, autor.id),
      coluna_id: QA_EM_CURSO,
    });
  }
  await env.DB.batch([
    env.DB.prepare('INSERT INTO kanban_comentarios (id, cartao_id, autor_id, autor_nome, texto, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, k.id, autor.id, autor.nome, texto, agora, agora),
    env.DB.prepare('UPDATE kanban_cartoes SET updated_at = ? WHERE id = ?').bind(agora, k.id),
  ]);
  return json({ comentario: comentarioParaFora({ id, autor_id: autor.id, autor_nome: autor.nome, texto, created_at: agora, updated_at: agora }, autor.id), coluna_id: k.coluna_id });
}

/* Um comentário por mexer, com a chave do cartão (que não pode estar removido).
   Recebe: env; id — o id do comentário.
   Devolve: promessa da linha (com numero), ou de null. */
async function comentarioParaMexer(env, id) {
  if (badId(id)) return null;
  return env.DB.prepare('SELECT c.*, k.numero FROM kanban_comentarios c JOIN kanban_cartoes k ON k.id = c.cartao_id AND k.removed_at IS NULL' +
    ' WHERE c.id = ? AND c.removed_at IS NULL').bind(id).first();
}

/* PATCH /api/equipa/kanban/comentarios/:id: muda o texto — só quem o escreveu.
   Recebe: env; request — o corpo {texto}; eu — a sessão; id — o do comentário.
   Devolve: promessa da Response {comentario}, 403, 404 ou a recusa. */
async function editarComentario(env, request, eu, id) {
  const c = await comentarioParaMexer(env, id);
  if (!c) return err(404, 'Comentário não encontrado.');
  const autor = quem(eu);
  if (c.autor_id !== autor.id) return err(403, 'Só quem escreveu o comentário o pode mudar.');
  const texto = textoDoComentario((await corpoObjeto(request)).texto);
  if (texto === c.texto) return json({ comentario: comentarioParaFora(c, autor.id) });
  if (!(await auditar(env, eu, 'kanban.comentario.editar', chaveDe(c.numero), cortar(texto, 120)))) return semRasto();
  const agora = now();
  await env.DB.prepare('UPDATE kanban_comentarios SET texto = ?, updated_at = ? WHERE id = ?').bind(texto, agora, c.id).run();
  return json({ comentario: comentarioParaFora(Object.assign({}, c, { texto, updated_at: agora }), autor.id) });
}

/* DELETE /api/equipa/kanban/comentarios/:id: remove (brando) — só quem o escreveu.
   Recebe: env; eu — a sessão; id — o do comentário.
   Devolve: promessa da Response {ok}, 403 ou 404. */
async function removerComentario(env, eu, id) {
  const c = await comentarioParaMexer(env, id);
  if (!c) return err(404, 'Comentário não encontrado.');
  if (c.autor_id !== quem(eu).id) return err(403, 'Só quem escreveu o comentário o pode remover.');
  if (!(await auditar(env, eu, 'kanban.comentario.remover', chaveDe(c.numero), cortar(c.texto, 120)))) return semRasto();
  await env.DB.prepare('UPDATE kanban_comentarios SET removed_at = ? WHERE id = ?').bind(now(), c.id).run();
  return json({ ok: true });
}

/* ------------------------------- as ligações ------------------------------- */

/* O tipo de uma ligação visto do outro cartão.
   Recebe: tipo — 'bloqueia' | 'bloqueado' | 'relaciona'.
   Devolve: o tipo do outro lado. */
function inverso(tipo) {
  return tipo === 'bloqueia' ? 'bloqueado' : tipo === 'bloqueado' ? 'bloqueia' : 'relaciona';
}

/* POST /api/equipa/kanban/cartoes/:chave/ligacoes: liga este cartão a outro
   ({tipo: 'bloqueia' | 'bloqueado' | 'relaciona', chave}). 'bloqueado'
   grava-se como 'bloqueia' ao contrário; 'relaciona' grava-se uma vez, e
   conta como repetida nos dois sentidos. Deixa a linha «ligacao» no
   histórico dos dois cartões.
   Recebe: env; request — o corpo; eu — a sessão; chave — a deste cartão.
   Devolve: promessa da Response {ligacao: {id, tipo, cartao}}, 404, 409
   (repetida, ou o próprio) ou a recusa. */
async function ligar(env, request, eu, chave) {
  const k = await cartaoParaMexer(env, chave);
  if (!k) return naoHaCartao();
  const b = await corpoObjeto(request);
  const tipo = b.tipo;
  if (LIGACOES.indexOf(tipo) < 0) throw recusa(400, 'Escolhe o tipo de ligação: bloqueia, é bloqueado por, ou relaciona-se com.', 'tipo');
  const n = numeroDaChave(b.chave);
  if (!n) throw recusa(400, 'Escreve a chave do outro cartão (KAN-N).', 'chave');
  if (n === k.numero) return err(409, 'Um cartão não se liga a si mesmo.');
  const outro = await env.DB.prepare('SELECT id, numero, titulo, tipo, coluna_id FROM kanban_cartoes WHERE numero = ? AND removed_at IS NULL')
    .bind(n).first();
  if (!outro) return err(404, 'O cartão ' + chaveDe(n) + ' não existe.');
  const de = tipo === 'bloqueado' ? outro : k, para = tipo === 'bloqueado' ? k : outro;
  const guardado = tipo === 'relaciona' ? 'relaciona' : 'bloqueia';
  const ja = await (guardado === 'relaciona'
    ? env.DB.prepare("SELECT id FROM kanban_ligacoes WHERE tipo = 'relaciona' AND ((de_id = ? AND para_id = ?) OR (de_id = ? AND para_id = ?))")
      .bind(de.id, para.id, para.id, de.id)
    : env.DB.prepare("SELECT id FROM kanban_ligacoes WHERE tipo = 'bloqueia' AND de_id = ? AND para_id = ?").bind(de.id, para.id)
  ).first();
  if (ja) return err(409, 'Essa ligação já existe.');
  const aqui = chaveDe(k.numero), ali = chaveDe(outro.numero);
  if (!(await auditar(env, eu, 'kanban.ligar', aqui, tipo + ' ' + ali))) return semRasto();
  const id = crypto.randomUUID(), agora = now(), autor = quem(eu);
  const linha = "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) VALUES (?, ?, ?, ?, 'ligacao', NULL, ?)";
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO kanban_ligacoes (id, de_id, para_id, tipo, autor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, de.id, para.id, guardado, autor.id, agora),
      env.DB.prepare(linha).bind(k.id, agora, autor.id, autor.nome, tipo + ' ' + ali),
      env.DB.prepare(linha).bind(outro.id, agora, autor.id, autor.nome, inverso(tipo) + ' ' + aqui),
      env.DB.prepare('UPDATE kanban_cartoes SET updated_at = ? WHERE id IN (?, ?)').bind(agora, k.id, outro.id),
    ]);
  } catch (e) {
    // duas pessoas a ligar o mesmo ao mesmo tempo: a segunda bate no UNIQUE
    if (/UNIQUE/i.test(String(e && e.message))) return err(409, 'Essa ligação já existe.');
    throw e;
  }
  return json({ ligacao: { id, tipo, cartao: { chave: ali, titulo: outro.titulo, tipo: outro.tipo, coluna_id: outro.coluna_id } } });
}

/* DELETE /api/equipa/kanban/ligacoes/:id: desfaz uma ligação, com a linha
   «ligacao» (o antes) no histórico dos dois cartões.
   Recebe: env; eu — a sessão; id — o da ligação.
   Devolve: promessa da Response {ok}, ou 404. */
async function desligar(env, eu, id) {
  const l = badId(id) ? null : await env.DB.prepare('SELECT l.*, a.numero AS de_numero, b.numero AS para_numero FROM kanban_ligacoes l' +
    ' JOIN kanban_cartoes a ON a.id = l.de_id JOIN kanban_cartoes b ON b.id = l.para_id WHERE l.id = ?').bind(id).first();
  if (!l) return err(404, 'Ligação não encontrada.');
  const de = chaveDe(l.de_numero), para = chaveDe(l.para_numero);
  if (!(await auditar(env, eu, 'kanban.desligar', de, l.tipo + ' ' + para))) return semRasto();
  const agora = now(), autor = quem(eu);
  const linha = "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) VALUES (?, ?, ?, ?, 'ligacao', ?, NULL)";
  await env.DB.batch([
    env.DB.prepare('DELETE FROM kanban_ligacoes WHERE id = ?').bind(l.id),
    env.DB.prepare(linha).bind(l.de_id, agora, autor.id, autor.nome, l.tipo + ' ' + para),
    env.DB.prepare(linha).bind(l.para_id, agora, autor.id, autor.nome, inverso(l.tipo) + ' ' + de),
    env.DB.prepare('UPDATE kanban_cartoes SET updated_at = ? WHERE id IN (?, ?)').bind(agora, l.de_id, l.para_id),
  ]);
  return json({ ok: true });
}

/* -------------------------------- os anexos -------------------------------- */

/* O nome de um anexo, do cabeçalho X-Nome (codificado com encodeURIComponent):
   sem caracteres de controlo nem barras, até 120 caracteres.
   Recebe: v — o valor do cabeçalho (ou null); tipo — o tipo verdadeiro da imagem.
   Devolve: o nome ('imagem.png' e afins quando não veio nenhum). */
function nomeDoAnexo(v, tipo) {
  let s = String(v || '');
  try { s = decodeURIComponent(s); } catch (e) { /* fica como veio */ }
  s = s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/]+/g, '-').trim().slice(0, MAX_NOME_ANEXO);
  return s || 'imagem.' + ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[tipo] || 'img');
}

/* PUT /api/equipa/kanban/cartoes/:chave/anexos: uma imagem no cartão, com
   os bytes no corpo. Só PNG, JPEG ou WebP, pelos próprios bytes
   (lib/imagens.js:tipoDaImagem), até 5 MB (lido aos bocados por lib/imagens.js:lerAte).
   Vai para o R2 em kanban/<cartao_id>/<anexo_id> e só depois para a base; se
   a base falhar, o ficheiro sai do R2.
   Recebe: env; request — o pedido (os bytes, e o nome em X-Nome); eu — a
   sessão; chave — a do cartão.
   Devolve: promessa da Response 201 {anexo}, ou 404, 413, 415 ou 400 (vazia). */
async function anexar(env, request, eu, chave) {
  const k = await cartaoParaMexer(env, chave);
  if (!k) return naoHaCartao();
  if (Number(request.headers.get('Content-Length') || 0) > MAX_ANEXO) return err(413, 'A imagem é grande de mais (máx. 5 MB).');
  const corpo = await lerAte(request, MAX_ANEXO);
  if (!corpo) return err(413, 'A imagem é grande de mais (máx. 5 MB).');
  if (!corpo.byteLength) return err(400, 'A imagem chegou vazia.');
  const tipo = tipoDaImagem(corpo);
  if (!tipo) return err(415, 'O anexo tem de ser uma imagem PNG, JPEG ou WebP.');
  const nome = nomeDoAnexo(request.headers.get('X-Nome'), tipo);
  if (!(await auditar(env, eu, 'kanban.anexar', chaveDe(k.numero), nome + ' (' + corpo.byteLength + ' bytes)'))) return semRasto();
  const id = crypto.randomUUID(), agora = now(), autor = quem(eu);
  const chaveR2 = 'kanban/' + k.id + '/' + id;
  await env.FILES.put(chaveR2, corpo, { httpMetadata: { contentType: tipo } });
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO kanban_anexos (id, cartao_id, chave, nome, tipo, tamanho, autor_id, autor_nome, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, k.id, chaveR2, nome, tipo, corpo.byteLength, autor.id, autor.nome, agora),
      env.DB.prepare("INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) VALUES (?, ?, ?, ?, 'anexo', NULL, ?)")
        .bind(k.id, agora, autor.id, autor.nome, nome),
      env.DB.prepare('UPDATE kanban_cartoes SET updated_at = ? WHERE id = ?').bind(agora, k.id),
    ]);
  } catch (e) {
    try { await env.FILES.delete(chaveR2); } catch (e2) { /* fica órfão no R2; a base não o conhece */ }
    throw e;
  }
  return json({
    anexo: anexoParaFora({ id, nome, tipo, tamanho: corpo.byteLength, autor_id: autor.id, autor_nome: autor.nome, created_at: agora }),
  }, 201);
}

/* GET /api/equipa/kanban/anexos/:id: os bytes de um anexo, com o tipo lido
   dos próprios bytes, sem cache e na caixa de areia dos anexos (CSP_ANEXO,
   nosniff), como o servirImagem do QA.
   Recebe: env; id — o do anexo.
   Devolve: promessa da Response com a imagem, ou 404. */
async function servirAnexo(env, id) {
  const a = badId(id) ? null : await env.DB.prepare('SELECT chave FROM kanban_anexos WHERE id = ?').bind(id).first();
  if (!a) return err(404, 'Anexo não encontrado.');
  const obj = await env.FILES.get(a.chave);
  if (!obj) return err(404, 'Anexo não encontrado.');
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

/* DELETE /api/equipa/kanban/anexos/:id: tira o anexo do R2 e depois da base
   (se o R2 falhar, a linha fica e pode tentar-se outra vez), com a linha
   «anexo» (o antes) no histórico.
   Recebe: env; eu — a sessão; id — o do anexo.
   Devolve: promessa da Response {ok}, ou 404. */
async function removerAnexo(env, eu, id) {
  const a = badId(id) ? null : await env.DB.prepare('SELECT a.*, k.numero FROM kanban_anexos a JOIN kanban_cartoes k ON k.id = a.cartao_id WHERE a.id = ?')
    .bind(id).first();
  if (!a) return err(404, 'Anexo não encontrado.');
  if (!(await auditar(env, eu, 'kanban.anexo.remover', chaveDe(a.numero), a.nome))) return semRasto();
  await env.FILES.delete(a.chave);
  const agora = now(), autor = quem(eu);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM kanban_anexos WHERE id = ?').bind(a.id),
    env.DB.prepare("INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) VALUES (?, ?, ?, ?, 'anexo', ?, NULL)")
      .bind(a.cartao_id, agora, autor.id, autor.nome, a.nome),
    env.DB.prepare('UPDATE kanban_cartoes SET updated_at = ? WHERE id = ?').bind(agora, a.cartao_id),
  ]);
  return json({ ok: true });
}

/* -------------------------------- as colunas -------------------------------- */

/* O nome de uma coluna, aparado. Recebe: v — o valor do corpo.
   Devolve: o nome (1 a 60 caracteres). Lança a recusa 400 noutro caso. */
function nomeDeColuna(v) {
  const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  if (!t) throw recusa(400, 'Escreve o nome da coluna.', 'nome');
  if (t.length > MAX_NOME_COLUNA) throw recusa(400, 'O nome da coluna passa dos 60 caracteres. Encurta-o.', 'nome');
  return t;
}

/* O «fim» de uma coluna (os cartões dela contam como feitos).
   Recebe: v — o valor do corpo (true/false, ou 1/0).
   Devolve: 1 ou 0. Lança a recusa 400 noutro caso. */
function fimValido(v) {
  if (v === true || v === 1) return 1;
  if (v === false || v === 0 || v == null) return 0;
  throw recusa(400, 'O fim de uma coluna é sim ou não.', 'fim');
}

/* Uma coluna com o total de cartões, pelo id.
   Recebe: env; id — o da coluna.
   Devolve: promessa da coluna na forma que sai, ou de null. */
async function colunaPorId(env, id) {
  const r = await env.DB.prepare(SQL_COLUNAS + ' WHERE c.id = ?').bind(id).first();
  return r ? colunaParaFora(r) : null;
}

/* POST /api/equipa/kanban/colunas (só o master): uma coluna nova, no fim do
   quadro ({nome*, fim}). Até 20 colunas, sem dois nomes iguais.
   Recebe: env; request — o corpo; eu — a sessão.
   Devolve: promessa da Response {coluna}, 409 ou a recusa. */
async function criarColuna(env, request, eu) {
  const b = await corpoObjeto(request);
  const nome = nomeDeColuna(b.nome);
  const fim = fimValido(b.fim);
  const todas = (await env.DB.prepare('SELECT id, nome, ordem FROM kanban_colunas').all()).results || [];
  if (todas.length >= MAX_COLUNAS) return err(409, 'O quadro já tem 20 colunas: remove uma antes de adicionar outra.');
  if (todas.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) throw recusa(409, 'Já há uma coluna com esse nome.', 'nome');
  const id = crypto.randomUUID(), agora = now();
  const ordem = todas.reduce((m, c) => Math.max(m, c.ordem), 0) + 1;
  if (!(await auditar(env, eu, 'kanban.coluna.criar', id, nome + (fim ? ' (fim)' : '')))) return semRasto();
  await env.DB.prepare('INSERT INTO kanban_colunas (id, nome, ordem, fim, fixa, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
    .bind(id, nome, ordem, fim, agora, agora).run();
  return json({ coluna: { id, nome, ordem, fim: !!fim, fixa: false, total: 0 } });
}

/* PATCH /api/equipa/kanban/colunas/:id (só o master): o nome e o fim. As
   colunas fixas (as da sincronização) só mudam de nome. Mudar o fim acerta o
   concluido_at dos cartões da coluna.
   Recebe: env; request — o corpo {nome, fim}; eu — a sessão; id — o da coluna.
   Devolve: promessa da Response {coluna}, 404, 409 ou a recusa. */
async function mudarColuna(env, request, eu, id) {
  const col = badId(id) ? null : await env.DB.prepare('SELECT * FROM kanban_colunas WHERE id = ?').bind(id).first();
  if (!col) return err(404, 'Coluna não encontrada.');
  const b = await corpoObjeto(request);
  const tem = (c) => Object.prototype.hasOwnProperty.call(b, c);
  const nome = tem('nome') ? nomeDeColuna(b.nome) : col.nome;
  const fim = tem('fim') ? fimValido(b.fim) : col.fim;
  if (fim !== col.fim && col.fixa) return err(409, 'Esta coluna é da sincronização: muda-se o nome, não o fim.');
  if (nome !== col.nome) {
    // em JS e não com o lower() do SQLite, que só passa a minúsculas o ASCII («Concluído» e «CONCLUÍDO»)
    const outras = (await env.DB.prepare('SELECT nome FROM kanban_colunas WHERE id <> ?').bind(col.id).all()).results || [];
    if (outras.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) throw recusa(409, 'Já há uma coluna com esse nome.', 'nome');
  }
  if (nome === col.nome && fim === col.fim) return json({ coluna: await colunaPorId(env, col.id) });
  const detalhe = (nome !== col.nome ? col.nome + ' → ' + nome : nome) + (fim !== col.fim ? (fim ? ' (passa a fim)' : ' (deixa de ser fim)') : '');
  if (!(await auditar(env, eu, 'kanban.coluna.mudar', col.id, detalhe))) return semRasto();
  const agora = now();
  const passos = [env.DB.prepare('UPDATE kanban_colunas SET nome = ?, fim = ?, updated_at = ? WHERE id = ?').bind(nome, fim, agora, col.id)];
  if (fim !== col.fim) {
    passos.push(env.DB.prepare('UPDATE kanban_cartoes SET concluido_at = CASE WHEN ? = 1 THEN COALESCE(concluido_at, ?) ELSE NULL END WHERE coluna_id = ?')
      .bind(fim, agora, col.id));
  }
  await env.DB.batch(passos);
  return json({ coluna: await colunaPorId(env, col.id) });
}

/* POST /api/equipa/kanban/colunas/ordem (só o master): a ordem nova das
   colunas ({ids: todas, cada uma uma vez}), numa instrução (json_each).
   Recebe: env; request — o corpo; eu — a sessão.
   Devolve: promessa da Response {colunas} (todas, pela ordem nova), ou a recusa. */
async function ordenarColunas(env, request, eu) {
  const b = await corpoObjeto(request);
  const ids = b.ids;
  const todas = ((await env.DB.prepare('SELECT id FROM kanban_colunas').all()).results || []).map((r) => r.id);
  const valida = Array.isArray(ids) && ids.length === todas.length && new Set(ids).size === ids.length &&
    ids.every((x) => typeof x === 'string' && todas.indexOf(x) > -1);
  if (!valida) throw recusa(400, 'Manda as colunas todas, cada uma uma vez, pela ordem nova.', 'ids');
  if (!(await auditar(env, eu, 'kanban.coluna.ordenar', null, ids.join(' → ')))) return semRasto();
  await env.DB.prepare('UPDATE kanban_colunas SET ordem = (SELECT j.key + 1 FROM json_each(?) j WHERE j.value = kanban_colunas.id), updated_at = ?')
    .bind(JSON.stringify(ids), now()).run();
  const linhas = (await env.DB.prepare(SQL_COLUNAS + ' ORDER BY c.ordem, c.nome').all()).results || [];
  return json({ colunas: linhas.map(colunaParaFora) });
}

/* DELETE /api/equipa/kanban/colunas/:id (só o master): só uma coluna vazia e
   que não seja fixa (as da sincronização ficam sempre).
   Recebe: env; eu — a sessão; id — o da coluna.
   Devolve: promessa da Response {ok}, 404 ou 409. */
async function removerColuna(env, eu, id) {
  const col = badId(id) ? null : await colunaPorId(env, id);
  if (!col) return err(404, 'Coluna não encontrada.');
  if (col.fixa) return err(409, 'Esta coluna é da sincronização: não se remove.');
  if (col.total) return err(409, 'A coluna tem cartões: move-os para outra antes de a remover.');
  if (!(await auditar(env, eu, 'kanban.coluna.remover', col.id, col.nome))) return semRasto();
  await env.DB.prepare('DELETE FROM kanban_colunas WHERE id = ? AND fixa = 0').bind(col.id).run();
  return json({ ok: true });
}
