// As armações dos testes do back office: a sessão de equipa de cada papel e a
// chamada às rotas como o index.js a faz (a sessão vai em `eu`). As contas que
// o back office vê fazem-se com testes/lib/api.js:novaConta.

import assert from 'node:assert/strict';
import { rotasEquipaApi } from '../../worker/src/equipa-api.js';

export const MASTER = { discordId: 'm1', nome: 'Mestre', papel: 'master', papeis: ['master'] };
export const SUPORTE = { discordId: 's1', nome: 'Sofia', papel: 'suporte', papeis: ['suporte'] };
export const DEV = { discordId: 'd1', nome: 'Dina', papel: 'dev', papeis: ['dev'] };
export const ADMIN = { discordId: 'a1', nome: 'Ana', papel: 'admin', papeis: ['admin'] };
export const ADMIN_E_DEV = { discordId: 'ad1', nome: 'Adélia', papel: 'admin', papeis: ['admin', 'dev'] };
export const SUPORTE_E_DEV = { discordId: 'sd1', nome: 'Sílvio', papel: 'suporte', papeis: ['suporte', 'dev'] };
// cargos que o papeis.js não conhece: veem tanto como quem não tem cargo nenhum
export const COMERCIAL = { discordId: 'c1', nome: 'Carlos', papel: 'comercial', papeis: ['comercial'] };
export const MARKETING = { discordId: 'k1', nome: 'Marta', papel: 'marketing', papeis: ['marketing'] };
export const SEM_CARGO = { discordId: 'z1', nome: 'Zé', papel: '', papeis: [] };

/* Chama as rotas do back office como o index.js chama: o caminho, o método,
   a sessão de equipa e o corpo.
   Recebe: env; eu — a sessão de equipa (um dos papéis acima); method; path;
   corpo (opcional) — vai em JSON; query (opcional) — '?a=b', junta-se ao URL.
   Devolve: a promessa da Response (ou de undefined, se nenhuma rota servir). */
export function chamar(env, eu, method, path, corpo, query) {
  const url = new URL('https://x.pt' + path + (query || ''));
  const request = new Request(url, corpo
    ? { method, body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } }
    : { method });
  return rotasEquipaApi({ env, request, path, method, url, eu });
}

/* O estado da resposta junto com o JSON dela.
   Recebe: resposta — a Response de chamar.
   Devolve: {status, ...o JSON}; falha a asserção se nenhuma rota respondeu. */
export async function corpoDe(resposta) {
  assert.ok(resposta, 'a rota respondeu');
  return { status: resposta.status, ...(await resposta.json()) };
}
