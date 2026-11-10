/* O kanban da equipa: as regras que o worker e os scripts partilham.
   -----------------------------------------------------------------
   O kanban vive só no dev (migrations/0028_kanban.sql). Os tickets de QA e
   os pedidos aceites criam o seu cartão sozinhos e movem-no quando mudam de
   estado — e quem os muda são três sítios diferentes: as rotas do worker
   (worker/src/rotas/qa.js, worker/src/equipa-api.js), o scripts/qa.mjs, que
   escreve por SQL direto na D1 do dev, e o scripts/kanban.mjs sincronizar,
   que lê os pedidos da produção. Para os três dizerem o mesmo, a regra e o
   SQL vivem aqui, uma vez: passosDaSincronizacao devolve as instruções
   ({sql, params}); o worker liga-as com bind e corre-as num batch, e os
   scripts escrevem-nas em texto com sqlEmTexto.

   Duas regras, uma por origem:
   - Um ticket de QA está sempre na coluna do seu cartão (pedido do Martinho,
     2026-11-10: «as mesmas colunas»): qa_tickets.status guarda o id da
     coluna. Quando o ticket muda de coluna (comecar, resolver, reabrir,
     mover), o cartão vai para essa coluna, venha de onde vier; quando o
     cartão se move à mão, o gatilho kanban_qa_coluna
     (migrations/0029_qa_no_kanban.sql) leva o ticket com ele.
   - Um pedido: o cartão só se move sozinho quando o estado do pedido MUDA
     (origem_estado guarda o último que se viu), e mover o cartão à mão nunca
     mexe no pedido. Um cartão numa coluna de fim (Concluído) só sai de lá
     sozinho para «A fazer».

   Nada aqui importa nada: é usado pelo worker e pelo Node dos scripts. */

// As chaves dos cartões: KAN-N, como no Jira de onde vieram.
export const PREFIXO = 'KAN-';

// Os tipos de cartão, pela ordem dos menus.
export const TIPOS = ['epico', 'historia', 'tarefa', 'subtarefa', 'erro'];
export const NOMES_DOS_TIPOS = { epico: 'Épico', historia: 'História', tarefa: 'Tarefa', subtarefa: 'Subtarefa', erro: 'Erro' };

// As prioridades: 1 é a mais alta. A 3 (Média) é a de omissão.
export const PRIORIDADES = [1, 2, 3, 4, 5];
export const NOMES_DAS_PRIORIDADES = { 1: 'Mais alta', 2: 'Alta', 3: 'Média', 4: 'Baixa', 5: 'Mais baixa' };

// As colunas que a sincronização usa (kanban_colunas.fixa = 1): renomeiam-se, não se removem.
export const COLUNAS_FIXAS = ['a-fazer', 'auto-tests', 'human-tests', 'concluido'];

// Quem assina o que a sincronização faz sozinha, no histórico e nos comentários.
export const AUTOMATICO = { id: 'automatico', nome: 'Sincronização' };

// Os estados de um pedido que a regra conhece. Os de um ticket de QA são as
// colunas (qualquer id de kanban_colunas), mais as duas marcas de QA_MARCAS.
const ESTADOS_DO_PEDIDO = ['aceite', 'resolucao', 'proposta', 'concluido'];

// O que acontece a um ticket de QA sem o mudar de coluna: só deixa uma linha no histórico do cartão.
export const QA_MARCAS = ['removido', 'reposto'];

// A forma de um id de coluna: os slugs das fixas ('a-fazer') e os uuid das que o master cria.
const ID_DE_COLUNA = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

// A coluna onde um ticket de QA fica quando alguém pega nele (qa.mjs comecar).
export const QA_EM_CURSO = 'auto-tests';
// A coluna onde fica quando se resolve: quem testa confirma e passa-o a Concluído.
export const QA_RESOLVIDO = 'human-tests';
// A coluna onde nasce e para onde volta ao reabrir.
export const QA_NOVO = 'a-fazer';

/* Se um texto tem a forma de um id de coluna (não diz se a coluna existe:
   isso vê-se na base).
   Recebe: v — o valor.
   Devolve: booleano. */
export function eIdDeColuna(v) {
  return typeof v === 'string' && ID_DE_COLUNA.test(v);
}

/* A instrução que põe um ticket de QA numa coluna, do lado do ticket: o
   status passa a ser a coluna e o resolved_at acompanha (posto ao chegar a
   Human Tests ou a uma coluna de fim, mantido se já estava; tirado nas
   outras). Corre ANTES dos passos do cartão (passosDaSincronizacao), e é por
   isso que o ticket muda mesmo quando o kanban falha. Só toca num ticket que
   não esteja removido.
   Recebe: id — o do ticket; coluna — o id da coluna; agora — ms; extra
   (opcional) — {sql: ', resolution = ?', params: [...]} a juntar ao SET.
   Devolve: {sql, params}. */
export function ticketQaNaColuna(id, coluna, agora, extra) {
  const e = extra || { sql: '', params: [] };
  return {
    sql: 'UPDATE qa_tickets SET status = ?,' +
      ' resolved_at = CASE WHEN ? = \'human-tests\' OR ? IN (SELECT id FROM kanban_colunas WHERE fim = 1) THEN COALESCE(resolved_at, ?) ELSE NULL END,' +
      ' updated_at = ?' + e.sql + ' WHERE id = ? AND removed_at IS NULL',
    params: [coluna, coluna, coluna, agora, agora, ...e.params, id],
  };
}

/* A chave de um cartão a partir do número.
   Recebe: numero — o N (inteiro positivo).
   Devolve: o texto 'KAN-N'. */
export function chaveDe(numero) {
  return PREFIXO + Number(numero);
}

/* O número de uma chave, aceite com ou sem o prefixo e em qualquer caixa
   ('KAN-77', 'kan-77', '77').
   Recebe: chave — o texto.
   Devolve: o inteiro positivo, ou null quando o texto não é uma chave. */
export function numeroDaChave(chave) {
  const m = /^(?:kan-)?([1-9]\d{0,8})$/i.exec(String(chave == null ? '' : chave).trim());
  return m ? Number(m[1]) : null;
}

/* A coluna para onde vai o cartão de uma origem que chegou a um estado.
   Recebe: tipo — 'qa' ou 'pedido'; estado — num ticket de QA, a coluna (ou
   uma de QA_MARCAS); num pedido, um de ESTADOS_DO_PEDIDO.
   Devolve: o id da coluna, ou null quando o estado não move o cartão
   (removido e reposto só deixam uma linha no histórico). */
export function colunaDaOrigem(tipo, estado) {
  if (tipo === 'qa') {
    return QA_MARCAS.indexOf(estado) < 0 && eIdDeColuna(estado) ? estado : null;
  }
  if (tipo === 'pedido') {
    return { aceite: 'a-fazer', resolucao: 'auto-tests', proposta: 'human-tests', concluido: 'human-tests' }[estado] || null;
  }
  return null;
}

/* O estado de um pedido, como a regra o lê: só os pedidos de pessoas
   (category 'user') que alguém da equipa aceitou têm cartão. Concluído
   ganha a tudo; depois a resposta proposta por enviar; depois o em resolução;
   aceite e por pegar é 'aceite'. Um recusado não tem cartão.
   Recebe: t — a linha de tickets (category, status, accepted_at, refused_at,
   draft_reply).
   Devolve: 'aceite' | 'resolucao' | 'proposta' | 'concluido', ou null quando
   o pedido não tem (nem deve ter) cartão. */
export function estadoDoPedido(t) {
  if (!t || t.category !== 'user' || t.accepted_at == null || t.refused_at != null) return null;
  if (t.status === 'concluido') return 'concluido';
  if (t.draft_reply != null && String(t.draft_reply) !== '') return 'proposta';
  if (t.status === 'resolucao') return 'resolucao';
  return 'aceite';
}

/* A prioridade de um cartão de QA, pela gravidade do ticket.
   Recebe: gravidade — 'bloqueia' | 'incomoda' | 'detalhe' | outra coisa.
   Devolve: 1 (Mais alta), 2 (Alta), 4 (Baixa) ou 3 (Média, sem gravidade). */
export function prioridadeDaGravidade(gravidade) {
  return { bloqueia: 1, incomoda: 2, detalhe: 4 }[gravidade] || 3;
}

/* O título de um cartão tirado de um texto livre: a primeira linha com
   texto, sem espaços a mais, cortada aos 120 caracteres com reticências.
   Recebe: texto — o texto (qualquer valor).
   Devolve: o título (nunca vazio: «Sem título» quando não há texto). */
export function tituloDe(texto) {
  const linha = String(texto == null ? '' : texto).split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).find(Boolean) || '';
  if (!linha) return 'Sem título';
  return linha.length > 120 ? linha.slice(0, 119).trimEnd() + '…' : linha;
}

/* O cartão que um ticket de QA cria: um Erro, com o texto inteiro na
   descrição e de onde veio, a gravidade como prioridade e a etiqueta qa.
   Recebe: q — a linha de qa_tickets (id, body, severity).
   Devolve: {tipo, titulo, descricao, prioridade, etiquetas}. */
export function cartaoDoTicketQa(q) {
  const curto = String(q.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  const grav = q.severity ? ' · gravidade: ' + q.severity : '';
  return {
    tipo: 'erro',
    titulo: tituloDe(q.body),
    descricao: String(q.body || '').trim() + '\n\nTicket de QA #' + curto + grav + '.',
    prioridade: prioridadeDaGravidade(q.severity),
    etiquetas: ['qa'],
  };
}

/* O cartão que um pedido aceite cria: uma História, com o pedido na
   descrição e, quando a aceitação as trouxe, as alterações (que mandam mais
   do que o pedido).
   Recebe: t — a linha de tickets (id, subject, body, accepted_changes).
   Devolve: {tipo, titulo, descricao, prioridade, etiquetas}. */
export function cartaoDoPedido(t) {
  const curto = String(t.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  const mudancas = t.accepted_changes ? '\n\nAlterações ao pedido (mandam mais do que o pedido):\n' + String(t.accepted_changes).trim() : '';
  return {
    tipo: 'historia',
    titulo: tituloDe(t.subject || t.body),
    descricao: String(t.body || '').trim() + mudancas + '\n\nPedido #' + curto + '.',
    prioridade: 3,
    etiquetas: ['suporte'],
  };
}

/* As instruções SQL de um acontecimento numa origem (um ticket de QA ou um
   pedido). Correm todas, pela ordem, numa transação (o batch da D1, ou um
   ficheiro de SQL no wrangler d1 execute), e são idempotentes: repetir o
   mesmo acontecimento não muda nada (um comentário repetido só entra uma vez
   com o mesmo uuid).
   Num ticket de QA (ev.estado = a coluna para onde foi):
   - com ev.novo: cria o cartão nessa coluna se o ticket ainda não tem
     nenhum (nem removido) e a coluna existe — sobe o contador, insere-o no
     topo, com as etiquetas e a linha «criado» do histórico;
   - a linha «coluna» do histórico, o comentário (ev.comentario) e a
     mudança para o topo da coluna, sempre que o cartão não esteja já lá —
     de qualquer coluna, também de uma de fim; e o origem_estado novo.
   - removido e reposto (QA_MARCAS) só deixam a linha «origem» no histórico.
   Num pedido (ev.estado um de ESTADOS_DO_PEDIDO):
   - com ev.novo (e um estado que tem coluna): cria o cartão como acima;
   - depois, se o estado mudou desde o último visto: a linha do histórico,
     o comentário, a mudança de coluna (para o topo da coluna nova; nunca
     para fora de uma coluna de fim, a não ser para a-fazer) e, por fim, o
     origem_estado novo.
   Recebe: ev — {tipo: 'qa' | 'pedido', id: o id da origem, estado (ver
   colunaDaOrigem), agora: ms, autor?: {id, nome} (AUTOMATICO por omissão),
   novo?: {uuid, tipo, titulo, descricao, prioridade, etiquetas} (um uuid
   novo, para o caso de o cartão ainda não existir), comentario?: {uuid,
   texto}}.
   Devolve: a lista de {sql, params} (vazia para um tipo ou estado que a
   regra não conhece). */
export function passosDaSincronizacao(ev) {
  const tipo = ev && ev.tipo, estado = ev && ev.estado;
  if (!ev || !ev.id) return [];
  if (tipo === 'qa') {
    if (QA_MARCAS.indexOf(estado) < 0 && !eIdDeColuna(estado)) return [];
  } else if (tipo !== 'pedido' || ESTADOS_DO_PEDIDO.indexOf(estado) < 0) {
    return [];
  }
  const agora = Number(ev.agora) || 0;
  const autor = ev.autor && ev.autor.id ? ev.autor : AUTOMATICO;
  const origem = String(ev.id);
  const coluna = colunaDaOrigem(tipo, estado);
  if (tipo === 'qa') return passosDoQa(ev, origem, estado, coluna, agora, autor);

  const passos = [];
  // a condição de «o estado mudou», que todos os passos de baixo repetem
  const mudou = 'origem_tipo = ? AND origem_id = ? AND removed_at IS NULL AND (origem_estado IS NULL OR origem_estado <> ?)';

  if (ev.novo && coluna) {
    /* um pedido que já chega concluído (o primeiro sincronizar encontra os
       antigos) nasce em Concluído: não há nada para testar */
    passos.push(...passosDeCriar(tipo, origem, estado, estado === 'concluido' ? 'concluido' : coluna, ev.novo, autor, agora));
  }

  // o histórico, antes de mexer: a coluna de onde sai
  passos.push({
    sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'coluna', coluna_id, ? FROM kanban_cartoes" +
      ' WHERE ' + mudou + ' AND coluna_id <> ? AND (? = \'a-fazer\' OR coluna_id NOT IN (SELECT id FROM kanban_colunas WHERE fim = 1))',
    params: [agora, autor.id, autor.nome || '', coluna, tipo, origem, estado, coluna, coluna],
  });
  if (ev.comentario && ev.comentario.uuid && String(ev.comentario.texto || '').trim()) {
    passos.push({
      sql: 'INSERT INTO kanban_comentarios (id, cartao_id, autor_id, autor_nome, texto, created_at, updated_at) SELECT ?, id, ?, ?, ?, ?, ? FROM kanban_cartoes WHERE ' + mudou,
      params: [ev.comentario.uuid, autor.id, autor.nome || '', String(ev.comentario.texto).trim(), agora, agora, tipo, origem, estado],
    });
  }
  passos.push({
    sql: 'UPDATE kanban_cartoes SET coluna_id = ?,' +
      ' posicao = (SELECT COALESCE(MIN(k.posicao), 1024) - 1024 FROM kanban_cartoes k WHERE k.coluna_id = ? AND k.removed_at IS NULL),' +
      ' concluido_at = CASE WHEN ? IN (SELECT id FROM kanban_colunas WHERE fim = 1) THEN ? ELSE NULL END, updated_at = ?' +
      ' WHERE ' + mudou + ' AND coluna_id <> ? AND (? = \'a-fazer\' OR coluna_id NOT IN (SELECT id FROM kanban_colunas WHERE fim = 1))',
    params: [coluna, coluna, coluna, agora, agora, tipo, origem, estado, coluna, coluna],
  });
  // por fim, o estado visto (só depois: é ele que os passos de cima comparam)
  passos.push({
    sql: 'UPDATE kanban_cartoes SET origem_estado = ?, updated_at = ? WHERE ' + mudou,
    params: [estado, agora, tipo, origem, estado],
  });
  return passos;
}

/* Os passos de um ticket de QA (ver passosDaSincronizacao): o cartão vai
   para a coluna do ticket, esteja onde estiver.
   Recebe: ev — o acontecimento; origem — o id do ticket; estado — a coluna
   ou uma marca; coluna — a coluna (null numa marca); agora; autor.
   Devolve: a lista de {sql, params}. */
function passosDoQa(ev, origem, estado, coluna, agora, autor) {
  const passos = [];
  const vivo = "origem_tipo = 'qa' AND origem_id = ? AND removed_at IS NULL";
  if (!coluna) {
    // removido / reposto: só a linha «origem», com a coluna onde o ticket estava
    passos.push({
      sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'origem', origem_estado, ? FROM kanban_cartoes WHERE " + vivo,
      params: [agora, autor.id, autor.nome || '', estado, origem],
    });
    return passos;
  }
  if (ev.novo) passos.push(...passosDeCriar('qa', origem, coluna, coluna, ev.novo, autor, agora));
  // a coluna tem de existir: um id que não está em kanban_colunas não move nada
  const existe = ' AND EXISTS (SELECT 1 FROM kanban_colunas WHERE id = ?)';
  passos.push({
    sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'coluna', coluna_id, ? FROM kanban_cartoes" +
      ' WHERE ' + vivo + ' AND coluna_id <> ?' + existe,
    params: [agora, autor.id, autor.nome || '', coluna, origem, coluna, coluna],
  });
  if (ev.comentario && ev.comentario.uuid && String(ev.comentario.texto || '').trim()) {
    passos.push({
      sql: 'INSERT OR IGNORE INTO kanban_comentarios (id, cartao_id, autor_id, autor_nome, texto, created_at, updated_at) SELECT ?, id, ?, ?, ?, ?, ? FROM kanban_cartoes WHERE ' + vivo,
      params: [ev.comentario.uuid, autor.id, autor.nome || '', String(ev.comentario.texto).trim(), agora, agora, origem],
    });
  }
  passos.push({
    sql: 'UPDATE kanban_cartoes SET coluna_id = ?,' +
      ' posicao = (SELECT COALESCE(MIN(k.posicao), 1024) - 1024 FROM kanban_cartoes k WHERE k.coluna_id = ? AND k.removed_at IS NULL),' +
      ' concluido_at = CASE WHEN ? IN (SELECT id FROM kanban_colunas WHERE fim = 1) THEN ? ELSE NULL END, updated_at = ?' +
      ' WHERE ' + vivo + ' AND coluna_id <> ?' + existe,
    params: [coluna, coluna, coluna, agora, agora, origem, coluna, coluna],
  });
  passos.push({
    sql: 'UPDATE kanban_cartoes SET origem_estado = ? WHERE ' + vivo + ' AND origem_estado IS NOT ?' + existe,
    params: [coluna, origem, coluna, coluna],
  });
  return passos;
}

/* Os passos que criam o cartão de uma origem que ainda não tem nenhum (nem
   removido): sobe o contador, insere-o no topo da coluna, as etiquetas e a
   linha «criado» do histórico. Nada acontece se a coluna não existir.
   Recebe: tipo; origem — o id; estado — o origem_estado a guardar; coluna —
   onde nasce; n — {uuid, tipo, titulo, descricao, prioridade, etiquetas};
   autor; agora.
   Devolve: a lista de {sql, params}. */
function passosDeCriar(tipo, origem, estado, coluna, n, autor, agora) {
  const passos = [];
  const naoTem = 'NOT EXISTS (SELECT 1 FROM kanban_cartoes WHERE origem_tipo = ? AND origem_id = ?) AND EXISTS (SELECT 1 FROM kanban_colunas WHERE id = ?)';
  passos.push({
    sql: 'UPDATE kanban_contador SET ultimo = MAX(ultimo, (SELECT COALESCE(MAX(numero), 0) FROM kanban_cartoes)) + 1 WHERE id = 1 AND ' + naoTem,
    params: [tipo, origem, coluna],
  });
  passos.push({
    sql: 'INSERT INTO kanban_cartoes (id, numero, tipo, titulo, descricao, coluna_id, posicao, prioridade, relator_id, relator_nome,' +
      ' origem_tipo, origem_id, origem_estado, created_at, updated_at, concluido_at)' +
      ' SELECT ?, (SELECT ultimo FROM kanban_contador WHERE id = 1), ?, ?, ?, ?,' +
      ' (SELECT COALESCE(MIN(posicao), 1024) - 1024 FROM kanban_cartoes WHERE coluna_id = ? AND removed_at IS NULL),' +
      ' ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IN (SELECT id FROM kanban_colunas WHERE fim = 1) THEN ? ELSE NULL END WHERE ' + naoTem,
    params: [n.uuid, TIPOS.indexOf(n.tipo) > -1 ? n.tipo : 'tarefa', String(n.titulo || 'Sem título'), String(n.descricao || ''),
      coluna, coluna, PRIORIDADES.indexOf(n.prioridade) > -1 ? n.prioridade : 3, autor.id, autor.nome || '',
      tipo, origem, estado, agora, agora, coluna, agora, tipo, origem, coluna],
  });
  (n.etiquetas || []).forEach((e) => {
    passos.push({ sql: 'INSERT OR IGNORE INTO kanban_etiquetas (cartao_id, etiqueta) SELECT id, ? FROM kanban_cartoes WHERE id = ?', params: [e, n.uuid] });
  });
  passos.push({
    sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'criado', NULL, coluna_id FROM kanban_cartoes WHERE id = ?",
    params: [agora, autor.id, autor.nome || '', n.uuid],
  });
  return passos;
}

/* Uma instrução com os valores escritos lá dentro, para os scripts, que
   correm o SQL pelo wrangler d1 execute (que não aceita parâmetros ligados).
   Os textos vão entre plicas com as plicas dobradas; números como estão;
   null e undefined como NULL. O SQL dos passos não tem nenhum ? dentro de
   um literal, por isso cada ? é um parâmetro.
   Recebe: passo — {sql, params}.
   Devolve: o texto da instrução, sem o ; do fim.
   Lança: Error quando o número de ? não bate com o de params. */
export function sqlEmTexto(passo) {
  const params = passo.params || [];
  let i = 0;
  const sql = String(passo.sql).replace(/\?/g, () => {
    if (i >= params.length) throw new Error('faltam parâmetros para o SQL');
    const v = params[i++];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    return "'" + String(v).replace(/'/g, "''") + "'";
  });
  if (i !== params.length) throw new Error('sobram parâmetros para o SQL');
  return sql;
}
