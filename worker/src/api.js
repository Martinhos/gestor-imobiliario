// API REST do Gestor Imobiliário.
//
// Modelo de dados: cada utilizador é dono das suas casas; os registos
// (inquilinos, contratos, movimentos, ...) pertencem a uma casa. Um utilizador
// pode ligar-se a outro através do id curto e, dentro dessa conexão, cada um
// escolhe que casas partilha. Casas partilhadas são visíveis e editáveis pelo
// outro utilizador; apagar a casa ou gerir a partilha é só do dono.
//
// Este ficheiro é só o encaminhador: monta o contexto, corre as rotas por
// ordem e devolve a primeira resposta. Cada área vive no seu módulo, em
// rotas/, e os ajudantes partilhados em lib/.

import { getSessionUser } from './auth.js';
import {
  json, err, body, now, tooBig, badId, cleanData, clientIp,
  TERMS_VERSION, CATEGORIAS,
} from './lib/http.js';
import { rateLimit } from './lib/limites.js';
import {
  canAccessHouse, participantsOf, preserveOwnership, connectionForUser, purgeAccount,
} from './lib/acesso.js';
import { recordReport } from './lib/relatos.js';

import { rotasAuth } from './rotas/auth.js';
import { rotasRelatos } from './rotas/relatos.js';
import { rotasConta } from './rotas/conta.js';
import { rotasEstado } from './rotas/estado.js';
import { rotasSync } from './rotas/sync.js';
import { rotasTickets } from './rotas/tickets.js';
import { rotasAnexos } from './rotas/anexos.js';
import { rotasCasas } from './rotas/casas.js';
import { rotasConexoes } from './rotas/conexoes.js';

export { recordReport, CATEGORIAS };

// Rotas que exigem sessão iniciada, pela ordem em que são tentadas.
const COM_SESSAO = [
  rotasConta,
  rotasEstado,
  rotasSync,
  rotasTickets,
  rotasAnexos,
  rotasCasas,
  rotasConexoes,
];

export async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const seg = path.split('/').filter(Boolean);   // ['api', ...]

  const c = {
    request, env, ctx, url, path, method, seg, me: null,
    json, err, body, now, tooBig, badId, cleanData, clientIp,
    rateLimit, canAccessHouse, participantsOf, preserveOwnership, connectionForUser,
    purgeAccount, TERMS_VERSION, CATEGORIAS, recordReport,
  };

  // sem sessão: registo, entrada, saída e entrada com Google
  const semSessao = await rotasAuth(c);
  if (semSessao) return semSessao;

  // relatos de erro não esperam por sessão: os que mais interessam vêm de
  // quem ficou preso no ecrã de entrada
  const relato = await rotasRelatos(c);
  if (relato) return relato;

  c.me = await getSessionUser(env, request);
  if (!c.me) return err(401, 'Sessão inválida — inicia sessão de novo.');

  for (const rota of COM_SESSAO) {
    const r = await rota(c);
    if (r) return r;
  }

  return err(404, 'Rota desconhecida.');
}
