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

   A regra: um cartão só se move sozinho quando o estado da origem MUDA
   (origem_estado guarda o último que se viu), e mover um cartão à mão nunca
   mexe no ticket. Um cartão numa coluna de fim (Concluído) só sai de lá
   sozinho para «A fazer», quando o ticket reabre.

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

// Os estados de origem que a regra conhece, por tipo de origem.
const ESTADOS = {
  qa: ['aberto', 'em_resolucao', 'resolvido', 'removido', 'reposto'],
  pedido: ['aceite', 'resolucao', 'proposta', 'concluido'],
};

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
   Recebe: tipo — 'qa' ou 'pedido'; estado — o estado da origem (ESTADOS).
   Devolve: o id da coluna, ou null quando o estado não move o cartão
   (removido e reposto só deixam uma linha no histórico). */
export function colunaDaOrigem(tipo, estado) {
  if (tipo === 'qa') {
    return { aberto: 'a-fazer', em_resolucao: 'auto-tests', resolvido: 'human-tests' }[estado] || null;
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
   mesmo acontecimento não muda nada.
   - Com ev.novo (e um estado que tem coluna): cria o cartão se a origem
     ainda não tem nenhum — sobe o contador, insere-o no topo da coluna, com
     as etiquetas e a linha «criado» do histórico.
   - Depois, se o estado mudou desde o último visto: a linha do histórico
     (coluna, ou origem para removido/reposto), o comentário (ev.comentario),
     a mudança de coluna (para o topo da coluna nova; nunca para fora de uma
     coluna de fim, a não ser para a-fazer) e, por fim, o origem_estado novo.
   Recebe: ev — {tipo: 'qa' | 'pedido', id: o id da origem, estado (ver
   colunaDaOrigem), agora: ms, autor?: {id, nome} (AUTOMATICO por omissão),
   novo?: {uuid, tipo, titulo, descricao, prioridade, etiquetas} (um uuid
   novo, para o caso de o cartão ainda não existir), comentario?: {uuid,
   texto}}.
   Devolve: a lista de {sql, params} (vazia para um tipo ou estado que a
   regra não conhece). */
export function passosDaSincronizacao(ev) {
  const tipo = ev && ev.tipo, estado = ev && ev.estado;
  if (!ESTADOS[tipo] || ESTADOS[tipo].indexOf(estado) < 0 || !ev.id) return [];
  const agora = Number(ev.agora) || 0;
  const autor = ev.autor && ev.autor.id ? ev.autor : AUTOMATICO;
  const origem = String(ev.id);
  const coluna = colunaDaOrigem(tipo, estado);
  const passos = [];
  // a condição de «o estado mudou», que todos os passos de baixo repetem
  const mudou = 'origem_tipo = ? AND origem_id = ? AND removed_at IS NULL AND (origem_estado IS NULL OR origem_estado <> ?)';

  if (ev.novo && coluna) {
    const n = ev.novo;
    /* um pedido que já chega concluído (o primeiro sincronizar encontra os
       antigos) nasce em Concluído: não há nada para testar */
    const colunaNova = tipo === 'pedido' && estado === 'concluido' ? 'concluido' : coluna;
    const naoTem = 'NOT EXISTS (SELECT 1 FROM kanban_cartoes WHERE origem_tipo = ? AND origem_id = ?)';
    passos.push({
      sql: 'UPDATE kanban_contador SET ultimo = MAX(ultimo, (SELECT COALESCE(MAX(numero), 0) FROM kanban_cartoes)) + 1 WHERE id = 1 AND ' + naoTem,
      params: [tipo, origem],
    });
    passos.push({
      sql: 'INSERT INTO kanban_cartoes (id, numero, tipo, titulo, descricao, coluna_id, posicao, prioridade, relator_id, relator_nome,' +
        ' origem_tipo, origem_id, origem_estado, created_at, updated_at, concluido_at)' +
        ' SELECT ?, (SELECT ultimo FROM kanban_contador WHERE id = 1), ?, ?, ?, ?,' +
        ' (SELECT COALESCE(MIN(posicao), 1024) - 1024 FROM kanban_cartoes WHERE coluna_id = ? AND removed_at IS NULL),' +
        ' ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IN (SELECT id FROM kanban_colunas WHERE fim = 1) THEN ? ELSE NULL END WHERE ' + naoTem,
      params: [n.uuid, TIPOS.indexOf(n.tipo) > -1 ? n.tipo : 'tarefa', String(n.titulo || 'Sem título'), String(n.descricao || ''),
        colunaNova, colunaNova, PRIORIDADES.indexOf(n.prioridade) > -1 ? n.prioridade : 3, autor.id, autor.nome || '',
        tipo, origem, estado, agora, agora, colunaNova, agora, tipo, origem],
    });
    (n.etiquetas || []).forEach((e) => {
      passos.push({ sql: 'INSERT OR IGNORE INTO kanban_etiquetas (cartao_id, etiqueta) SELECT id, ? FROM kanban_cartoes WHERE id = ?', params: [e, n.uuid] });
    });
    passos.push({
      sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'criado', NULL, coluna_id FROM kanban_cartoes WHERE id = ?",
      params: [agora, autor.id, autor.nome || '', n.uuid],
    });
  }

  // o histórico, antes de mexer: a coluna de onde sai, ou só a origem
  if (coluna) {
    passos.push({
      sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'coluna', coluna_id, ? FROM kanban_cartoes" +
        ' WHERE ' + mudou + ' AND coluna_id <> ? AND (? = \'a-fazer\' OR coluna_id NOT IN (SELECT id FROM kanban_colunas WHERE fim = 1))',
      params: [agora, autor.id, autor.nome || '', coluna, tipo, origem, estado, coluna, coluna],
    });
  } else {
    passos.push({
      sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'origem', origem_estado, ? FROM kanban_cartoes WHERE " + mudou,
      params: [agora, autor.id, autor.nome || '', estado, tipo, origem, estado],
    });
  }
  if (ev.comentario && ev.comentario.uuid && String(ev.comentario.texto || '').trim()) {
    passos.push({
      sql: 'INSERT INTO kanban_comentarios (id, cartao_id, autor_id, autor_nome, texto, created_at, updated_at) SELECT ?, id, ?, ?, ?, ?, ? FROM kanban_cartoes WHERE ' + mudou,
      params: [ev.comentario.uuid, autor.id, autor.nome || '', String(ev.comentario.texto).trim(), agora, agora, tipo, origem, estado],
    });
  }
  if (coluna) {
    passos.push({
      sql: 'UPDATE kanban_cartoes SET coluna_id = ?,' +
        ' posicao = (SELECT COALESCE(MIN(k.posicao), 1024) - 1024 FROM kanban_cartoes k WHERE k.coluna_id = ? AND k.removed_at IS NULL),' +
        ' concluido_at = CASE WHEN ? IN (SELECT id FROM kanban_colunas WHERE fim = 1) THEN ? ELSE NULL END, updated_at = ?' +
        ' WHERE ' + mudou + ' AND coluna_id <> ? AND (? = \'a-fazer\' OR coluna_id NOT IN (SELECT id FROM kanban_colunas WHERE fim = 1))',
      params: [coluna, coluna, coluna, agora, agora, tipo, origem, estado, coluna, coluna],
    });
  }
  // por fim, o estado visto (só depois: é ele que os passos de cima comparam)
  if (estado !== 'removido' && estado !== 'reposto') {
    passos.push({
      sql: 'UPDATE kanban_cartoes SET origem_estado = ?, updated_at = ? WHERE ' + mudou,
      params: [estado, agora, tipo, origem, estado],
    });
  }
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
