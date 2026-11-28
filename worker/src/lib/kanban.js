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
     mexe no pedido. Um cartão numa coluna de fim (Staging, Adiado,
     Produção) só sai de lá sozinho para «A fazer».

   As colunas de depois de Human Tests (migrations/0032_staging_adiado.sql,
   as decisões do Martinho, 2026-11-24): quem testa aceita com uma de duas
   saídas — Staging (KAN_STAGING: vai no próximo promove) ou Adiado
   (KAN_ADIADO: resolvido, fica no dev) — e quem leva a Produção
   (KAN_PRODUCAO, o id 'concluido' de sempre) é o promove, depois do deploy.

   Nada aqui importa nada: é usado pelo worker e pelo Node dos scripts. */

// As chaves dos cartões: KAN-N, como no Jira de onde vieram.
export const PREFIXO = 'KAN-';

// Os tipos de cartão, pela ordem dos menus.
export const TIPOS = ['epico', 'historia', 'tarefa', 'subtarefa', 'erro'];
export const NOMES_DOS_TIPOS = { epico: 'Épico', historia: 'História', tarefa: 'Tarefa', subtarefa: 'Subtarefa', erro: 'Erro' };

// As prioridades: 1 é a mais alta. A 3 (Média) é a de omissão.
export const PRIORIDADES = [1, 2, 3, 4, 5];
export const NOMES_DAS_PRIORIDADES = { 1: 'Mais alta', 2: 'Alta', 3: 'Média', 4: 'Baixa', 5: 'Mais baixa' };

// As colunas que a automação usa (kanban_colunas.fixa = 1): renomeiam-se, não se removem.
export const COLUNAS_FIXAS = ['a-fazer', 'auto-tests', 'human-tests', 'staging', 'adiado', 'concluido'];

// Para onde vai um cartão aceite em Human Tests: Staging, que vai no próximo promove (o
// scripts/promover.mjs leva só os commits destes cartões), ou Adiado, resolvido mas a ficar no dev.
export const KAN_STAGING = 'staging';
export const KAN_ADIADO = 'adiado';
// Produção: o id de sempre (Concluído até à 0032), para onde o promove leva os de Staging.
export const KAN_PRODUCAO = 'concluido';

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
// A coluna onde fica quando se resolve: quem testa aceita e passa-o a Staging ou a Adiado.
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

/* Os subtickets (KAN-162, as decisões do Martinho, 2026-11-25): um cartão
   que testa várias coisas diferentes parte-se em cartões próprios, um por
   teste, com a chave do pai e «-X» no fim (KAN-126-1, KAN-126-2…), cada um
   aceite ou comentado à parte, e o pai segue-os (passosDoPaiSegue). São
   Subtarefas do pai (pai_id) com a coluna sub (migrations/0033_subtickets.sql)
   a guardar o X; o numero, que é NOT NULL UNIQUE desde a 0028, é o do pai e o
   X codificados num inteiro NEGATIVO, -(N × SUB_BASE + X): nunca colide com
   uma chave KAN-N (sempre positiva), não mexe no contador (que sobe pelo
   MAX(numero)) e deixa o chaveDe e o numeroDaChave de sempre servirem os
   dois — as rotas, o quadro, a pesquisa e os scripts procuram pelo numero. */

// Quantos subtickets cabem num pai: o X vai de 1 a SUB_BASE - 1.
export const SUB_BASE = 1000;

/* O numero de um subticket.
   Recebe: pai — o N do pai (inteiro positivo); x — o X (1 a 999).
   Devolve: o inteiro negativo -(N × 1000 + X). */
export function numeroDoSubticket(pai, x) {
  return -(Number(pai) * SUB_BASE + Number(x));
}

/* A chave de um cartão a partir do número: KAN-N, ou KAN-N-X num subticket
   (o numero negativo de numeroDoSubticket).
   Recebe: numero — o N (inteiro positivo) ou o de um subticket (negativo).
   Devolve: o texto 'KAN-N' ou 'KAN-N-X'. */
export function chaveDe(numero) {
  const n = Number(numero);
  if (n < 0) return PREFIXO + Math.floor(-n / SUB_BASE) + '-' + (-n % SUB_BASE);
  return PREFIXO + n;
}

/* O número de uma chave, aceite com ou sem o prefixo e em qualquer caixa
   ('KAN-77', 'kan-77', '77'), e a de um subticket ('KAN-126-1', '126-1').
   Recebe: chave — o texto.
   Devolve: o inteiro (positivo num cartão, negativo num subticket:
   numeroDoSubticket), ou null quando o texto não é uma chave. */
export function numeroDaChave(chave) {
  const m = /^(?:kan-)?([1-9]\d{0,8})(?:-([1-9]\d{0,2}))?$/i.exec(String(chave == null ? '' : chave).trim());
  if (!m) return null;
  return m[2] ? numeroDoSubticket(m[1], m[2]) : Number(m[1]);
}

/* O número do pai de uma chave de subticket (KAN-126-1 → 126), ou o da
   própria chave quando não é de um subticket.
   Recebe: numero — o de numeroDaChave.
   Devolve: o inteiro positivo, ou null. */
export function numeroDoPai(numero) {
  const n = Number(numero);
  if (!n) return null;
  return n < 0 ? Math.floor(-n / SUB_BASE) : n;
}

/* Os passos de um «O que testar» (KAN-159: «Os passos a seguir para testar
   devem estar formatados como lista numerada»): parte o texto em blocos (pelas
   linhas em branco) e, em cada bloco, os passos «1. … 2. … 3. …», numa linha
   só ou em linhas, numerados de seguida a partir do 1 (também «1)»); o que
   vem antes do 1 fica como o começo do bloco («O que testar:»). Um bloco com
   menos de dois passos fica como está. É a regra única da pílula e do back
   office: a pílula (web/cloud/qa.js) não importa módulos e tem a cópia
   qaPassosDoTexto, que o testes/kanban-subtickets.test.js obriga a ser esta
   letra a letra, e o guião do back office tem outra, kbPassosDoTexto
   (worker/src/equipa-kanban.js), presa pelo mesmo teste. Por isso é ES5,
   sem nada de fora e sem crases nem cifrões.
   Recebe: texto — o texto (qualquer valor).
   Devolve: null quando nenhum bloco tem passos (quem chama mostra o texto
   como sempre); ou a lista dos blocos, cada um {texto} (sem passos) ou
   {antes, passos: [texto, …]} (dois ou mais). */
export function passosDoTexto(texto) {
  var t = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n');
  var algum = false;
  var blocos = t.split(/\n[ \t]*\n/).map(function (b) {
    var re = /(^|\s)(\d{1,2})[.)](?=\s)/g, marcas = [], m, n = 1;
    while ((m = re.exec(b))) {
      if (Number(m[2]) !== n) continue;
      marcas.push({ i: m.index + m[1].length, fim: re.lastIndex });
      n++;
    }
    if (marcas.length < 2) return { texto: b.trim() };
    var passos = marcas.map(function (x, j) { return b.slice(x.fim, j + 1 < marcas.length ? marcas[j + 1].i : b.length).replace(/\s+/g, ' ').trim(); });
    if (passos.some(function (p) { return !p; })) return { texto: b.trim() };
    algum = true;
    return { antes: b.slice(0, marcas[0].i).trim(), passos: passos };
  }).filter(function (x) { return x.passos || x.texto; });
  return algum ? blocos : null;
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
       antigos) nasce em Produção: não há nada para testar */
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

/* Para onde vai um ticket de QA quando alguém comenta nele (pedido do
   Martinho, 2026-11-15, KAN-140: «em vez de auto tests deve ir para A
   Fazer»): para A fazer, a fila de quem programa — Auto Tests só o marca o
   Claude, quando pega nele (qa.mjs comecar). Um ticket que já está na fila
   (A fazer ou Auto Tests) fica onde está: o comentário entra como por
   responder, e quem já pegou nele não o perde.
   Recebe: status — a coluna do ticket agora.
   Devolve: o id da coluna depois do comentário. */
export function colunaDoComentarioQa(status) {
  return status === QA_NOVO || status === QA_EM_CURSO ? status : QA_NOVO;
}

/* Os passos de um comentário num ticket de QA (pedido do Martinho,
   2026-11-11, e a coluna desde 2026-11-15, KAN-140), numa transação só: o
   ticket passa a A fazer (colunaDoComentarioQa: fica, se já está na fila;
   ticketQaNaColuna), o cartão nasce se o ticket ainda
   não o tinha e vai com ele (passosDaSincronizacao, com a linha «coluna» do
   histórico assinada por quem comentou), o comentário fica no cartão, e o
   cartão sobe na «Última alteração». Os comentários do ticket SÃO os do
   cartão (kanban_comentarios): não há outra tabela. Correm-no a rota da app
   e do back office (rotas/qa.js:comentarTicket) e o comentar do kanban num
   cartão de QA (rotas/kanban.js:comentar).
   Recebe: c — {ticket: {id, body, severity, status}, autor: {id, nome}, texto (já
   aparado), uuid (o id do comentário), cartaoUuid (o id do cartão, se for
   preciso criá-lo), agora (ms)}.
   Devolve: a lista de {sql, params}. */
export function passosDoComentarioQa(c) {
  const t = c.ticket, agora = Number(c.agora) || 0, para = colunaDoComentarioQa(t.status);
  return [ticketQaNaColuna(t.id, para, agora)].concat(
    passosDaSincronizacao({
      tipo: 'qa', id: t.id, estado: para, agora, autor: c.autor,
      novo: Object.assign({ uuid: c.cartaoUuid }, cartaoDoTicketQa(t)),
      comentario: { uuid: c.uuid, texto: c.texto },
    }),
    [{ sql: "UPDATE kanban_cartoes SET updated_at = ? WHERE origem_tipo = 'qa' AND origem_id = ? AND removed_at IS NULL", params: [agora, String(t.id)] }],
  );
}

/* Um ticket de QA e o seu cartão saem e voltam juntos (pedido do Martinho,
   2026-11-12, KAN-115: «quero que o pill seja uma vista do kanban»):
   remover o ticket na pílula remove o cartão, remover o cartão no kanban
   remove o ticket, e cada Anular repõe os dois. Os dois ficam com o mesmo
   removed_at, e é por ele que o Anular reconhece o par: só volta o que saiu
   na mesma remoção (um ticket removido antes, por outra mão, fica onde está).
   Correm no lote da rota que remove ou repõe (rotas/qa.js, rotas/kanban.js).

   O ticket que sai com o cartão. Recebe: ticketId — o origem_id do cartão;
   agora — ms (o removed_at do cartão). Devolve: {sql, params}. */
export function ticketSaiComOCartao(ticketId, agora) {
  return {
    sql: 'UPDATE qa_tickets SET removed_at = ?, updated_at = ? WHERE id = ? AND removed_at IS NULL',
    params: [agora, agora, String(ticketId)],
  };
}

/* O ticket que volta com o cartão (o Anular do kanban): só o que saiu com
   ele, no mesmo instante.
   Recebe: ticketId — o origem_id do cartão; removidoEm — o removed_at que o
   cartão tinha; agora — ms.
   Devolve: {sql, params}. */
export function ticketVoltaComOCartao(ticketId, removidoEm, agora) {
  return {
    sql: 'UPDATE qa_tickets SET removed_at = NULL, updated_at = ? WHERE id = ? AND removed_at = ?',
    params: [agora, String(ticketId), Number(removidoEm)],
  };
}

/* O cartão que sai com o ticket (remover na pílula): o cartão vivo do
   ticket fica removido no mesmo instante, por quem removeu, com a linha
   «removido» no histórico.
   Recebe: ticketId — o id do ticket; autor — {id, nome}; agora — ms (o
   removed_at do ticket).
   Devolve: a lista de {sql, params}. */
export function cartaoSaiComOTicket(ticketId, autor, agora) {
  const vivo = "origem_tipo = 'qa' AND origem_id = ? AND removed_at IS NULL";
  const a = autor && autor.id ? autor : AUTOMATICO;
  return [
    {
      sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'removido', NULL, NULL FROM kanban_cartoes WHERE " + vivo,
      params: [agora, a.id, a.nome || '', String(ticketId)],
    },
    {
      sql: 'UPDATE kanban_cartoes SET removed_at = ?, removed_by = ?, updated_at = ? WHERE ' + vivo,
      params: [agora, a.id, agora, String(ticketId)],
    },
  ];
}

/* O cartão que volta com o ticket (o Anular da pílula): só o que saiu com
   ele, no mesmo instante; volta à coluna onde estava (a A fazer, se ela
   entretanto saiu, como o repor do kanban) e deixa a linha «reposto».
   Recebe: ticketId; removidoEm — o removed_at que o ticket tinha; autor;
   agora — ms.
   Devolve: a lista de {sql, params}. */
export function cartaoVoltaComOTicket(ticketId, removidoEm, autor, agora) {
  const par = "origem_tipo = 'qa' AND origem_id = ? AND removed_at = ?";
  const a = autor && autor.id ? autor : AUTOMATICO;
  return [
    {
      sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'reposto', NULL, NULL FROM kanban_cartoes WHERE " + par,
      params: [agora, a.id, a.nome || '', String(ticketId), Number(removidoEm)],
    },
    {
      sql: 'UPDATE kanban_cartoes SET removed_at = NULL, removed_by = NULL, updated_at = ?,' +
        " coluna_id = CASE WHEN EXISTS (SELECT 1 FROM kanban_colunas c WHERE c.id = kanban_cartoes.coluna_id) THEN coluna_id ELSE 'a-fazer' END" +
        ' WHERE ' + par,
      params: [agora, String(ticketId), Number(removidoEm)],
    },
  ];
}

/* Os passos de um cartão que muda de coluna pela pílula (um cartão sem ticket
   de QA: mover, reabrir, Enviar para produção, Adiar a produção, Recusar): vai para o topo da
   coluna, como o mover do kanban com o índice 0, com o concluido_at posto ao
   entrar numa coluna de fim (mantido se já estava numa) e tirado nas outras,
   e a linha «coluna» no histórico assinada por quem mexeu. Já nessa coluna,
   nada muda.
   Recebe: cartaoId; coluna — o id da coluna (que existe); autor — {id, nome}; agora — ms.
   Devolve: a lista de {sql, params}. */
export function passosDoCartaoNaColuna(cartaoId, coluna, autor, agora) {
  const a = autor && autor.id ? autor : AUTOMATICO;
  const muda = 'id = ? AND removed_at IS NULL AND coluna_id <> ?';
  return [
    {
      sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'coluna', coluna_id, ? FROM kanban_cartoes WHERE " + muda,
      params: [agora, a.id, a.nome || '', coluna, cartaoId, coluna],
    },
    {
      sql: 'UPDATE kanban_cartoes SET' +
        ' posicao = (SELECT COALESCE(MIN(x.posicao), 1024) - 1024 FROM kanban_cartoes x WHERE x.coluna_id = ? AND x.removed_at IS NULL),' +
        ' concluido_at = CASE WHEN ? IN (SELECT id FROM kanban_colunas WHERE fim = 1)' +
        ' THEN CASE WHEN coluna_id IN (SELECT id FROM kanban_colunas WHERE fim = 1) THEN COALESCE(concluido_at, ?) ELSE ? END ELSE NULL END,' +
        ' coluna_id = ?, updated_at = ? WHERE ' + muda,
      params: [coluna, coluna, agora, agora, coluna, agora, cartaoId, coluna],
    },
  ];
}

// Para depois (a coluna da 0028, que não é fixa): o que fica de lado, que o Claude não pega (a fila é A fazer e Auto Tests).
export const KAN_PARA_DEPOIS = 'para-depois';

/* As idas de quem testa entre Human Tests e Para depois (KAN-171: «Devo
   poder mover um ticket de Human tests para Depois»): «Para depois» é o
   «agora não consigo testar isto», que tira o ticket da frente, e «Voltar a
   Human Tests» desfaz-o. Cada uma só parte da sua coluna (de) e só vai para
   a outra (para): nunca leva a Staging, a Adiado nem a Produção. */
export const IDAS_DE_QUEM_TESTA = {
  'para-depois': { de: QA_RESOLVIDO, para: KAN_PARA_DEPOIS },
  voltar: { de: KAN_PARA_DEPOIS, para: QA_RESOLVIDO },
};

/* A coluna de onde um cartão veio da última vez que mudou de coluna (a
   linha «coluna» mais recente do histórico), em SQL: é por ela que um
   cartão em Para depois sabe se volta a Human Tests (IDAS_DE_QUEM_TESTA.voltar).
   Recebe: eu — o nome (ou o alias) da tabela do cartão na instrução.
   Devolve: a subconsulta (texto). */
export function sqlVeioDe(eu) {
  return "(SELECT h.antes FROM kanban_historico h WHERE h.cartao_id = " + eu + ".id AND h.campo = 'coluna' ORDER BY h.at DESC, h.id DESC LIMIT 1)";
}

/* Os passos de uma ida de quem testa (IDAS_DE_QUEM_TESTA), para qualquer
   cartão da pílula, com ou sem ticket de QA (o gatilho kanban_qa_coluna da
   0029 leva o ticket com o cartão): a linha no rasto (audit_log,
   kanban.mover, com o papel de quem mexeu) e os passos de
   passosDoCartaoNaColuna (a linha «coluna» no histórico, o topo da coluna),
   todos só com o cartão ainda na coluna de partida — se outra mão o mexeu
   entretanto, nada muda. Os passos do pai que segue (passosDoPaiSegue)
   juntam-se à parte, num subticket.
   Recebe: acao — 'para-depois' ou 'voltar'; k — {id, chave}; autor — {id,
   nome}; papel — o do rasto ('utilizador' numa conta, os da sessão de
   equipa no back office); agora — ms.
   Devolve: a lista de {sql, params} (vazia com uma ação que não existe). */
export function passosDeQuemTesta(acao, k, autor, papel, agora) {
  const ida = Object.prototype.hasOwnProperty.call(IDAS_DE_QUEM_TESTA, acao) ? IDAS_DE_QUEM_TESTA[acao] : null;
  if (!ida || !k || !k.id) return [];
  const a = autor && autor.id ? autor : AUTOMATICO;
  const rasto = {
    sql: "INSERT INTO audit_log (at, quem, nome, papel, acao, alvo, detalhe) SELECT ?, ?, ?, ?, 'kanban.mover', ?, ? FROM kanban_cartoes" +
      ' WHERE id = ? AND removed_at IS NULL AND coluna_id = ?',
    params: [agora, String(a.id), String(a.nome || ''), String(papel || 'utilizador'), String(k.chave || ''), ida.de + ' → ' + ida.para + ' (pílula)', k.id, ida.de],
  };
  return [rasto].concat(passosDoCartaoNaColuna(k.id, ida.para, a, agora).map((p) => ({ sql: p.sql + ' AND coluna_id = ?', params: p.params.concat([ida.de]) })));
}

// Quem assina, no histórico e no rasto, o que o pai faz por seguir os subtickets (passosDoPaiSegue).
export const SUBTICKETS = { id: 'subtickets', nome: 'Subtickets' };

// As colunas onde um pai segue os subtickets: as de quem testa e as de fim. Em A fazer, em Auto Tests
// (alguém está a trabalhar nele: só o resolver o tira de lá) ou noutra coluna, o pai fica onde está.
export const COLUNAS_QUE_SEGUEM = [QA_RESOLVIDO, KAN_STAGING, KAN_ADIADO, KAN_PRODUCAO];

/* A coluna para onde o pai vai, pelos subtickets vivos dele, em SQL (as
   decisões do Martinho, 2026-11-25, e os pressupostos do KAN-162): algum em
   A fazer ou em Auto Tests (comentado ou reaberto) → A fazer; todos em
   Produção → Produção; todos em Staging (ou já em Produção) → Staging; todos
   em Staging ou Adiado, com algum Adiado → Adiado (um commit não se promove
   aos bocados: o promove lê o KAN-N do pai); senão (algum em Human Tests,
   em Para depois ou noutra) → Human Tests.
   Recebe: eu — o nome (ou o alias) da tabela do pai na instrução.
   Devolve: a expressão (texto). */
function sqlAlvoDoPai(eu) {
  const algum = (cond) => 'EXISTS (SELECT 1 FROM kanban_cartoes f WHERE f.pai_id = ' + eu + '.id AND f.sub IS NOT NULL AND f.removed_at IS NULL AND ' + cond + ')';
  return 'CASE WHEN ' + algum("f.coluna_id IN ('" + QA_NOVO + "', '" + QA_EM_CURSO + "')") + " THEN '" + QA_NOVO + "'" +
    ' WHEN NOT ' + algum("f.coluna_id <> '" + KAN_PRODUCAO + "'") + " THEN '" + KAN_PRODUCAO + "'" +
    ' WHEN NOT ' + algum("f.coluna_id NOT IN ('" + KAN_STAGING + "', '" + KAN_PRODUCAO + "')") + " THEN '" + KAN_STAGING + "'" +
    ' WHEN NOT ' + algum("f.coluna_id NOT IN ('" + KAN_STAGING + "', '" + KAN_ADIADO + "', '" + KAN_PRODUCAO + "')") + " THEN '" + KAN_ADIADO + "'" +
    " ELSE '" + QA_RESOLVIDO + "' END";
}

/* Os passos de «o pai segue os subtickets», a juntar ao lote de qualquer
   escrita que mexa num subticket (mover, aceitar, comentar, remover, repor:
   as rotas do kanban e da pílula, e os scripts kanban.mjs e promover.mjs):
   se o cartão é um subticket e o pai dele está numa das COLUNAS_QUE_SEGUEM,
   o pai vai para a coluna que os subtickets dizem (sqlAlvoDoPai), para o
   topo dela, com o concluido_at acertado (posto ao entrar numa de fim,
   mantido entre duas de fim, tirado nas outras), a linha «coluna» no
   histórico do pai e a kanban.seguir no rasto, as duas assinadas pelos
   Subtickets (SUBTICKETS) com o subticket e quem mexeu: é assim que se vê que
   foi por causa dos filhos. O ticket de QA do pai vai com ele (o gatilho
   kanban_qa_coluna da 0029). Num cartão que não é um subticket, ou com o pai
   já na coluna certa, nada muda: os passos podem ir sempre.
   Recebe: filhoId — o id do cartão que mudou; porque — {chave (a do
   subticket), nome (de quem mexeu; pode faltar)}; agora — ms.
   Devolve: a lista de {sql, params} (três). */
export function passosDoPaiSegue(filhoId, porque, agora) {
  const p = porque || {};
  const motivo = String(p.chave || 'subticket') + (p.nome ? ', ' + p.nome : '');
  const doPai = '(SELECT pai_id FROM kanban_cartoes WHERE id = ? AND sub IS NOT NULL)';
  const segue = (eu) => eu + '.id = ' + doPai + ' AND ' + eu + '.removed_at IS NULL AND ' + eu + ".coluna_id IN ('" + COLUNAS_QUE_SEGUEM.join("', '") + "')" +
    ' AND EXISTS (SELECT 1 FROM kanban_cartoes f WHERE f.pai_id = ' + eu + '.id AND f.sub IS NOT NULL AND f.removed_at IS NULL)' +
    ' AND ' + eu + '.coluna_id <> (' + sqlAlvoDoPai(eu) + ')' +
    ' AND EXISTS (SELECT 1 FROM kanban_colunas c WHERE c.id = (' + sqlAlvoDoPai(eu) + '))';
  const alvo = sqlAlvoDoPai('kanban_cartoes');
  const fim = 'SELECT id FROM kanban_colunas WHERE fim = 1';
  return [
    {
      sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT p.id, ?, ?, ?, 'coluna', p.coluna_id, " + sqlAlvoDoPai('p') +
        ' FROM kanban_cartoes p WHERE ' + segue('p'),
      params: [agora, SUBTICKETS.id, SUBTICKETS.nome + ' (' + motivo + ')', filhoId],
    },
    {
      sql: "INSERT INTO audit_log (at, quem, nome, papel, acao, alvo, detalhe) SELECT ?, ?, ?, 'automatico', 'kanban.seguir', '" + PREFIXO + "' || p.numero," +
        " p.coluna_id || ' → ' || " + sqlAlvoDoPai('p') + " || ' (' || ? || ')' FROM kanban_cartoes p WHERE " + segue('p'),
      params: [agora, SUBTICKETS.id, SUBTICKETS.nome, 'pelos subtickets: ' + motivo, filhoId],
    },
    {
      sql: 'UPDATE kanban_cartoes SET' +
        ' posicao = (SELECT COALESCE(MIN(x.posicao), 1024) - 1024 FROM kanban_cartoes x WHERE x.coluna_id = (' + alvo + ') AND x.removed_at IS NULL),' +
        ' concluido_at = CASE WHEN (' + alvo + ') IN (' + fim + ')' +
        ' THEN CASE WHEN coluna_id IN (' + fim + ') THEN COALESCE(concluido_at, ?) ELSE ? END ELSE NULL END,' +
        ' updated_at = ?, coluna_id = (' + alvo + ') WHERE ' + segue('kanban_cartoes'),
      params: [agora, agora, agora, filhoId],
    },
  ];
}

// Quem comenta sem ser uma pessoa: o Claude (o scripts/kanban.mjs assina «claude») e a sincronização.
const NAO_PESSOAS = ['claude', AUTOMATICO.id];

/* Para onde vai um cartão quando alguém comenta nele (pedido do Martinho,
   2026-11-12, KAN-116, e a coluna desde 2026-11-15, KAN-140): em Human Tests
   decide-se, e recusar é comentar o que está mal — o comentário de uma
   pessoa devolve o cartão a A fazer, a fila de quem programa (Auto Tests só
   o marca o Claude, quando pega nele). Fica onde está um cartão noutra
   coluna e o comentário do Claude ou da sincronização (a nota do resolver é
   escrita com o cartão já em Human Tests). O cartão de um pedido entra na
   regra desde 2026-11-16 (KAN-137: «Este ticket não passou para a fazer
   quando comentei. Porquê?»): ficava de fora porque a coluna dele seguia o
   pedido, mas desde 2026-11-15 o cartão de um pedido da produção vai a
   Human Tests à mão com a correção no dev, e testa-se no quadro como os
   outros. O pedido não muda (decide-se nos Pedidos), e a sincronização só
   volta a mover o cartão quando o estado do pedido mudar
   (passosDaSincronizacao). O cartão de um ticket de QA com o ticket vivo
   não passa por aqui (passosDoComentarioQa).
   Recebe: k — o cartão ({coluna_id, origem_tipo}); autorId — o id de quem comenta.
   Devolve: o id da coluna depois do comentário. */
export function colunaDepoisDoComentario(k, autorId) {
  const col = k && k.coluna_id;
  if (col !== QA_RESOLVIDO || NAO_PESSOAS.indexOf(String(autorId)) > -1) return col;
  return QA_NOVO;
}

/* Os passos de um comentário num cartão que não é de um ticket de QA vivo,
   numa transação só: o comentário fica no cartão e, se ele volta a A fazer
   (colunaDepoisDoComentario), vai para o topo dela como o mover com o índice
   0 (um passo acima do primeiro, ou 0 na coluna vazia), com o concluido_at
   limpo (posto, se o master a marcou de fim) e a linha «coluna» no histórico assinada por quem comentou; noutro
   caso só sobe na «Última alteração». A mudança de coluna só acontece se o
   cartão ainda estiver em Human Tests quando o lote corre.
   Recebe: c — {cartao: {id, coluna_id, origem_tipo}, autor: {id, nome},
   texto (já aparado), uuid (o id do comentário), agora (ms)}.
   Devolve: a lista de {sql, params}. */
export function passosDoComentario(c) {
  const k = c.cartao, autor = c.autor || AUTOMATICO, agora = Number(c.agora) || 0;
  const passos = [{
    sql: 'INSERT INTO kanban_comentarios (id, cartao_id, autor_id, autor_nome, texto, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    params: [c.uuid, k.id, autor.id, autor.nome || '', c.texto, agora, agora],
  }];
  const para = colunaDepoisDoComentario(k, autor.id);
  if (para === k.coluna_id) {
    passos.push({ sql: 'UPDATE kanban_cartoes SET updated_at = ? WHERE id = ?', params: [agora, k.id] });
    return passos;
  }
  const ainda = 'id = ? AND coluna_id = ? AND removed_at IS NULL';
  passos.push({
    sql: "INSERT INTO kanban_historico (cartao_id, at, autor_id, autor_nome, campo, antes, depois) SELECT id, ?, ?, ?, 'coluna', coluna_id, ? FROM kanban_cartoes WHERE " + ainda,
    params: [agora, autor.id, autor.nome || '', para, k.id, k.coluna_id],
  });
  passos.push({
    sql: 'UPDATE kanban_cartoes SET coluna_id = ?,' +
      ' posicao = (SELECT COALESCE(MIN(x.posicao), 1024) - 1024 FROM kanban_cartoes x WHERE x.coluna_id = ? AND x.removed_at IS NULL),' +
      ' concluido_at = CASE WHEN ? IN (SELECT id FROM kanban_colunas WHERE fim = 1) THEN ? ELSE NULL END, updated_at = ? WHERE ' + ainda,
    params: [para, para, para, agora, agora, k.id, k.coluna_id],
  });
  passos.push({ sql: 'UPDATE kanban_cartoes SET updated_at = ? WHERE id = ?', params: [agora, k.id] });
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
