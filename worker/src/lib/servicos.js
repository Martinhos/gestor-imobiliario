// Os serviços da app, do lado do servidor: o espelho do catálogo do cliente
// (web/app/servicos.js — um teste compara os dois), a leitura e a gravação
// dos desligados por utilizador (user_services, migração 0015; ausência =
// ligado), e as perguntas que as rotas fazem: que kinds não saem nem entram,
// se as casas ou as tabelas de colaboradores estão fora, e a frase da recusa.
// Desligar um serviço desliga os que o requerem (fechoDesligados), sempre —
// aqui e no cliente, com a mesma regra. Tudo puro menos as duas funções que
// leem e escrevem na base.

// O catálogo, na ordem dos separadores. `kinds` são os kinds de records do
// serviço, `userKinds` os de user_records, `casa` o scope house (só os
// imóveis), `colab` as tabelas de cargos e partilha, `requer` os serviços
// sem os quais este não faz sentido.
export const SERVICOS = [
  { id: 'dashboard', nome: 'Visão geral', requer: [], kinds: [], userKinds: [], casa: false, colab: false },
  { id: 'properties', nome: 'Imóveis', requer: [], kinds: [], userKinds: [], casa: true, colab: false },
  { id: 'contracts', nome: 'Contratos', requer: ['properties', 'tenants'], kinds: ['contract'], userKinds: [], casa: false, colab: false },
  { id: 'visits', nome: 'Visitas', requer: ['properties'], kinds: ['visit'], userKinds: [], casa: false, colab: false },
  { id: 'tenants', nome: 'Inquilinos', requer: [], kinds: ['tenant'], userKinds: ['tenant'], casa: false, colab: false },
  { id: 'owners', nome: 'Proprietários', requer: [], kinds: [], userKinds: [], casa: false, colab: false },
  { id: 'colaboradores', nome: 'Colaboradores', requer: ['properties'], kinds: [], userKinds: [], casa: false, colab: true },
  { id: 'transactions', nome: 'Movimentos', requer: [], kinds: ['tx'], userKinds: ['tx'], casa: false, colab: false },
  { id: 'recurring', nome: 'Planeados', requer: ['transactions'], kinds: ['rec'], userKinds: ['rec', 'tpl'], casa: false, colab: false },
  { id: 'calendar', nome: 'Calendário', requer: [], kinds: [], userKinds: [], casa: false, colab: false },
  { id: 'credits', nome: 'Créditos', requer: ['properties'], kinds: [], userKinds: [], casa: false, colab: false },
  { id: 'projections', nome: 'Projeções', requer: [], kinds: [], userKinds: [], casa: false, colab: false },
  { id: 'reports', nome: 'Avaliação', requer: [], kinds: [], userKinds: [], casa: false, colab: false },
  { id: 'fisco', nome: 'Declaração', requer: [], kinds: [], userKinds: [], casa: false, colab: false },
];
const POR_ID = new Map(SERVICOS.map((s) => [s.id, s]));

// O manifesto de um serviço do catálogo.
// Recebe: id — o id do serviço.
// Devolve: o manifesto, ou null se não existe.
export function servicoDe(id) {
  return POR_ID.get(String(id || '')) || null;
}

// O nome que se lê de um serviço.
// Recebe: id — o id do serviço.
// Devolve: o nome; o próprio id se não existir.
export function nomeDoServico(id) {
  const s = servicoDe(id);
  return s ? s.nome : String(id || '');
}

// A frase da recusa e do botão escondido — a mesma no servidor e no cliente
// (web/app/servicos.js:hintServicoDesligado).
// Recebe: id — o id do serviço.
// Devolve: a frase.
export function FRASE_DESLIGADO(id) {
  return 'O serviço ' + nomeDoServico(id) + ' está desligado nesta conta.';
}

// A lista de desligados mais os que requerem um desligado, transitivamente,
// pela ordem do catálogo. Ids fora do catálogo caem.
// Recebe: ids — ids de serviços desligados (array).
// Devolve: um array novo com o fecho.
export function fechoDesligados(ids) {
  const off = new Set((ids || []).map(String).filter((id) => POR_ID.has(id)));
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const s of SERVICOS) {
      if (!off.has(s.id) && s.requer.some((r) => off.has(r))) { off.add(s.id); mudou = true; }
    }
  }
  return SERVICOS.filter((s) => off.has(s.id)).map((s) => s.id);
}

// Os serviços desligados de um utilizador, com o fecho aplicado — mesmo que
// uma linha antiga não tenha os dependentes escritos.
// Recebe: env — o ambiente (DB); userId — o utilizador.
// Devolve: um array de ids (vazio quando está tudo ligado).
export async function servicosDesligados(env, userId) {
  const r = await env.DB.prepare('SELECT service FROM user_services WHERE user_id = ? AND enabled = 0')
    .bind(String(userId)).all();
  return fechoDesligados((r.results || []).map((x) => x.service));
}

// Liga ou desliga um serviço de um utilizador. Desligar escreve também os
// dependentes (o fecho), para o back office os mostrar desligados e o
// cliente receber a lista inteira; ligar exige que os que ele requer estejam
// ligados — senão lança {status: 400, error} com a frase — e não liga os
// dependentes (o suporte liga-os um a um, de propósito).
// Recebe: env — o ambiente (DB); userId — o utilizador; id — o serviço;
// ligado — true para ligar, false para desligar; quem — quem mexeu (o id de
// quem está no back office), fica no rasto da linha.
// Devolve: a lista resultante dos desligados (array de ids).
export async function guardarServico(env, userId, id, ligado, quem) {
  const s = servicoDe(id);
  if (!s) { const e = new Error('Serviço desconhecido.'); e.status = 400; e.error = e.message; throw e; }
  const atuais = await servicosDesligados(env, userId);
  const agora = Date.now();
  const quemS = String(quem || '');
  const escreve = (servico, enabled) => env.DB.prepare(
    `INSERT INTO user_services (user_id, service, enabled, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, service) DO UPDATE SET enabled = excluded.enabled,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`
  ).bind(String(userId), servico, enabled, agora, quemS).run();
  if (ligado) {
    const faltam = s.requer.filter((r) => atuais.includes(r));
    if (faltam.length) {
      const e = new Error('Para ligar ' + s.nome + ' é preciso ligar primeiro ' + faltam.map(nomeDoServico).join(', ') + '.');
      e.status = 400; e.error = e.message; throw e;
    }
    /* os dependentes que só estavam desligados por fecho (uma linha antiga só
       com o pai) ficam escritos a 0 antes de o pai passar a 1 — senão ligar o
       pai ligava-os todos de uma vez, e o «um a um» era mentira. Só onde não
       há linha: as que existem guardam o seu rasto. */
    for (const x of atuais) {
      if (x === s.id) continue;
      await env.DB.prepare(
        `INSERT INTO user_services (user_id, service, enabled, updated_at, updated_by)
         VALUES (?, ?, 0, ?, ?) ON CONFLICT (user_id, service) DO NOTHING`
      ).bind(String(userId), x, agora, quemS).run();
    }
    await escreve(s.id, 1);
  } else {
    const fecho = fechoDesligados(atuais.concat([s.id]));
    for (const x of fecho) if (!atuais.includes(x)) await escreve(x, 0);
  }
  return servicosDesligados(env, userId);
}

// Os kinds de records que não saem nem entram, dados os serviços desligados.
// Recebe: lista — ids de serviços desligados (o fecho aplica-se aqui também).
// Devolve: um Set de kinds.
export function kindsDesligados(lista) {
  const off = fechoDesligados(lista);
  return new Set(off.flatMap((id) => servicoDe(id).kinds));
}

// Os kinds de user_records que não saem nem entram, dados os serviços desligados.
// Recebe: lista — ids de serviços desligados.
// Devolve: um Set de kinds.
export function userKindsDesligados(lista) {
  const off = fechoDesligados(lista);
  return new Set(off.flatMap((id) => servicoDe(id).userKinds));
}

// As casas (o scope house) estão fora nesta conta?
// Recebe: lista — ids de serviços desligados.
// Devolve: true quando os Imóveis estão desligados.
export function casaDesligada(lista) {
  return fechoDesligados(lista).some((id) => servicoDe(id).casa);
}

// As tabelas de colaboradores (cargos, convites, ligação, pedidos) estão fora?
// Recebe: lista — ids de serviços desligados.
// Devolve: true quando os Colaboradores estão desligados.
export function colabDesligado(lista) {
  return fechoDesligados(lista).some((id) => servicoDe(id).colab);
}

// O serviço dono de um kind, para a recusa dizer o nome certo.
// Recebe: kind — o kind ('tx', 'contract', 'tpl'…); scope — 'record' (por
// omissão) ou 'user' (kinds de user_records).
// Devolve: o id do serviço, ou '' quando o kind é da base.
export function servicoDoKind(kind, scope) {
  const chave = scope === 'user' ? 'userKinds' : 'kinds';
  const s = SERVICOS.find((x) => x[chave].includes(String(kind)));
  return s ? s.id : '';
}
