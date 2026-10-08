/* Rasto do que a equipa faz e do que as máquinas fazem.
   ----------------------------------------------------
   Duas tabelas, duas perguntas:

   audit_log — quem fez o quê sobre quem, e porquê. Escreve-se em cada ação
   do back office e nunca se altera nem se apaga: no primeiro desentendimento
   sobre "quem mudou isto?", ou o registo existe ou já não se reconstrói.

   op_log — as operações agendadas deixam uma linha por execução. O alarme
   não é uma linha com erro: é a ausência de linhas novas, que era o que
   ninguém via quando o cron morria de todo. */

import { now } from './http.js';

// O horário do cron diário (a cópia da base e o resumo): o mesmo texto que o
// wrangler.toml agenda em [triggers] crons. O index.js compara o event.cron
// com ele — um prefixo de texto desalinhava-se sem erro nenhum ao mudar o
// horário lá — e testes/correcao-api.test.js confere que os dois batem.
// Mudar o horário é mudar os dois.
export const CRON_DIARIO = '0 9 * * *';

// Nunca lança: a auditoria não pode ser o motivo de uma ação falhar. Mas
// também não engole em silêncio — devolve se escreveu, e quem chama uma
// ação sensível pode recusar-se a agir sem rasto.
// Recebe: env — o ambiente do worker (D1 em env.DB); eu — quem age (objeto
// com discordId, nome e papeis ou papel); acao — o que fez (string curta);
// alvo (opcional) — sobre quem ou o quê; detalhe (opcional) — texto livre,
// cortado a 500 caracteres.
// Devolve: true se a linha ficou escrita, false se a escrita falhou.
export async function auditar(env, eu, acao, alvo, detalhe) {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (at, quem, nome, papel, acao, alvo, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      now(),
      String((eu && eu.discordId) || '?'),
      String((eu && eu.nome) || ''),
      ((eu && eu.papeis) || [(eu && eu.papel)]).filter(Boolean).join('+'),
      String(acao),
      alvo == null ? null : String(alvo),
      detalhe == null ? null : String(detalhe).slice(0, 500)
    ).run();
    return true;
  } catch (e) {
    return false;
  }
}

// Uma linha por execução de uma operação agendada (ou manual). A poda dos
// registos velhos vai de caminho: 90 dias chegam para ver tendências, e uma
// tabela de batimentos não pode crescer para sempre.
// Recebe: env — o ambiente do worker (D1 em env.DB); op — o nome da operação
// ('copia', 'vigia', 'resumo', ...); ok — se correu bem (vira 1/0 na tabela);
// detalhe (opcional) — texto livre, cortado a 500 caracteres.
// Devolve: true se o batimento ficou registado, false se falhou.
export async function registarOp(env, op, ok, detalhe) {
  try {
    const t = now();
    await env.DB.prepare(
      'INSERT INTO op_log (op, at, ok, detalhe) VALUES (?, ?, ?, ?)'
    ).bind(String(op), t, ok ? 1 : 0, detalhe == null ? null : String(detalhe).slice(0, 500)).run();
    await env.DB.prepare('DELETE FROM op_log WHERE at < ?').bind(t - 90 * 86400000).run();
    return true;
  } catch (e) {
    return false;   // um batimento que falha não pode travar a operação
  }
}
