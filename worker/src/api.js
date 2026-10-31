// API REST do Rendorium.
//
// Modelo de dados: cada utilizador é dono das suas casas; os registos
// (inquilinos, contratos, movimentos, ...) pertencem a uma casa. Um utilizador
// pode ligar-se a outro através do id curto e, dentro dessa conexão, cada um
// escolhe que casas partilha. Casas partilhadas são visíveis e editáveis pelo
// outro utilizador; apagar a casa ou gerir a partilha é só do dono. Além dos
// comproprietários há colaboradores: pessoas com um cargo (lista de
// permissões) numa lista de casas do dono, que veem e fazem só o que o cargo
// deixa e nunca entram nas quotas (rotas/colaboradores.js). E há grupos
// partilhados: um conjunto de casas com membros, em que cada membro é
// comproprietário de todas as casas do grupo (rotas/grupos.js). O criador
// de uma casa pode transferi-la a um proprietário ligado a si, que aceita ou
// recusa (rotas/casas.js:rotasTransferencias).
//
// Este ficheiro é só o encaminhador: monta o contexto, corre as rotas por
// ordem e devolve a primeira resposta. Cada área vive no seu módulo, em
// rotas/, e os ajudantes partilhados em lib/.

import { getSessionUser } from './auth.js';
import { json, err, body, CATEGORIAS } from './lib/http.js';
import { recordReport } from './lib/relatos.js';

import { rotasAuth, estadoDoEmail } from './rotas/auth.js';
import { rotasRelatos } from './rotas/relatos.js';
import { rotasConta } from './rotas/conta.js';
import { rotasEstado } from './rotas/estado.js';
import { rotasSync } from './rotas/sync.js';
import { rotasTickets } from './rotas/tickets.js';
import { rotasQa } from './rotas/qa.js';
import { rotasRasto } from './rotas/rasto.js';
import { rotasAnexos } from './rotas/anexos.js';
import { rotasCasas, rotasTransferencias } from './rotas/casas.js';
import { rotasConexoes } from './rotas/conexoes.js';
import { rotasColaboradores, rotasPreVisualizacao } from './rotas/colaboradores.js';
import { rotasGrupos, rotasPreVisualizacaoGrupo } from './rotas/grupos.js';
import { rotasContasDeTeste } from './teste.js';

export { recordReport, CATEGORIAS };

// Rotas que exigem sessão iniciada, pela ordem em que são tentadas.
const COM_SESSAO = [
  rotasContasDeTeste,
  rotasConta,
  rotasEstado,
  rotasSync,
  rotasTickets,
  rotasQa,
  rotasRasto,
  rotasAnexos,
  rotasColaboradores,
  rotasGrupos,
  rotasCasas,
  rotasTransferencias,
  rotasConexoes,
];

/* O que uma conta com o email por confirmar há mais de 7 dias ainda pode
   fazer (rotas/auth.js:GRACA_EMAIL_MS): ler quem é (GET /api/me, que diz à
   app para mostrar o ecrã «Confirma o teu email»), reenviar o email, os
   termos (aceitar, ou recusar e apagar), apagar a conta, pedir ajuda (criar
   um pedido e ler os seus, rotas/tickets.js: o «Pedir ajuda» do ecrã —
   decisão do Martinho, 2026-10-29), e, no ambiente de dev, trocar de conta
   de teste. Sair é do rotasAuth, antes da sessão. A
   exportação dos dados é do aparelho (Definições › Importar e cópias), sem
   rota no servidor. Chaves 'MÉTODO caminho'; /api/teste/ vai por prefixo. */
const PASSA_SEM_EMAIL = new Set([
  'GET /api/me',
  'POST /api/me/confirmar/reenviar',
  'DELETE /api/me',
  'POST /api/me/terms',
  'POST /api/tickets',
  'GET /api/tickets',
]);

/* O portão do email no servidor: o ecrã da app não chega, porque sem isto a
   API ficava aberta a quem a chamasse sem a app. Uma conta por confirmar há
   mais de 7 dias recebe 403 com { erro: 'email_por_confirmar' } em tudo o
   que não está em PASSA_SEM_EMAIL, e a app abre o ecrã ao lê-lo
   (cloud/nucleo.js:api). As outras passam sem consulta nenhuma: a sessão
   já traz o created_at e o email_verified_at (auth.js:sessaoDe).
   Recebe: c — o contexto do pedido, já com c.me.
   Devolve: promessa da Response 403, ou de null quando o pedido segue. */
async function portaoDoEmail(c) {
  if (PASSA_SEM_EMAIL.has(c.method + ' ' + c.path) || c.path.startsWith('/api/teste/')) return null;
  const em = await estadoDoEmail(c.env, c.me);
  if (!em.travada) return null;
  return json({
    error: 'Confirma o teu email para continuar. Abre a ligação que te enviámos, ou pede outra em «Reenviar».',
    erro: 'email_por_confirmar',
  }, 403);
}

/* Ponto de entrada de todos os /api/*: normaliza o caminho, monta o contexto
   partilhado e corre as rotas por ordem — primeiro as que dispensam sessão
   (autenticação e relatos de erro), depois, já com o utilizador resolvido,
   as de COM_SESSAO. A primeira Response ganha; sem nenhuma, 404.
   Recebe: request — o pedido HTTP (Request); env — o ambiente do worker (D1,
   KV, R2 e segredos); ctx — o contexto de execução (waitUntil).
   Devolve: a Response da primeira rota que casar com o pedido — 401 sem
   sessão válida nas rotas que a exigem, 404 quando nenhuma responde. */
export async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const seg = path.split('/').filter(Boolean);   // ['api', ...]

  /* O contexto do pedido: o que é DESTE pedido (request, env, ctx, url,
     path, method, seg e, depois da sessão, me). As bibliotecas (json, err,
     body, rateLimit…) importa-as cada rota de lib/ — assim a cabeça de um
     ficheiro diz de que depende. json, err e body ficam também aqui só para
     o teste.js, que ainda os tira do contexto. */
  const c = { request, env, ctx, url, path, method, seg, me: null, json, err, body };

  // sem sessão: registo, entrada, saída e entrada com Google
  const semSessao = await rotasAuth(c);
  if (semSessao) return semSessao;

  // relatos de erro não esperam por sessão: os que mais interessam vêm de
  // quem ficou preso no ecrã de entrada
  const relato = await rotasRelatos(c);
  if (relato) return relato;

  // o que uma ligação de convite ou de partilha é, antes de haver sessão:
  // só mostra, nunca gasta nem cria nada
  const previa = await rotasPreVisualizacao(c);
  if (previa) return previa;
  // e o que uma ligação de grupo partilhado é, pelas mesmas regras
  const previaGrupo = await rotasPreVisualizacaoGrupo(c);
  if (previaGrupo) return previaGrupo;

  c.me = await getSessionUser(env, request);
  if (!c.me) return err(401, 'Sessão inválida — inicia sessão de novo.');

  // passados os 7 dias sem confirmar o email, só o essencial passa
  const travada = await portaoDoEmail(c);
  if (travada) return travada;

  for (const rota of COM_SESSAO) {
    const r = await rota(c);
    if (r) return r;
  }

  return err(404, 'Rota desconhecida.');
}
