// As permissões dos cargos: a lista canónica, as implicações entre elas, o
// que cada kind de registo exige, e as projeções que despem uma casa ou um
// registo para o que um cargo pode ver. Tudo puro — sem base, sem pedido —
// para o cliente (web/app/acessos.js) ter uma cópia igual e um teste as
// comparar. A regra da casa: o servidor decide, o cliente esconde.

// A lista canónica. A ordem é a ordem canónica: normalizarPerms devolve
// sempre nesta ordem, para duas listas iguais serem iguais em texto.
export const PERMS = [
  'tx.view', 'tx.add',
  'rec.view', 'rec.add',
  'visit.view', 'visit.add',
  'contract.view', 'contract.add',
  'tenant.view', 'tenant.add',
  'loan.view',
  'file.view', 'file.add',
  'report.view',
  'house.edit',
];

// O que cada permissão arrasta consigo. Aplica-se transitivamente:
// contract.add ⇒ rec.add ⇒ rec.view.
export const IMPLICA = {
  'tx.add': ['tx.view'],
  'rec.add': ['rec.view'],
  'visit.add': ['visit.view'],
  'contract.add': ['contract.view', 'rec.add'],
  'tenant.add': ['tenant.view'],
  'file.add': ['file.view'],
  'house.edit': ['loan.view', 'file.view'],
};

// kind de registo → prefixo da permissão (kind + '.view' para ver, '.add'
// para criar). Um kind fora daqui é 403 para qualquer colaborador.
export const KIND_PERM = { tx: 'tx', rec: 'rec', visit: 'visit', contract: 'contract', tenant: 'tenant' };

// Os cargos de exemplo que a UI oferece com «Usar este». Iguais no cliente
// (web/app/acessos.js), com a mesma forma: {nome, perms, sub}.
export const CARGOS_EXEMPLO = [
  { nome: 'Gestor de visitas',
    perms: ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'],
    sub: 'Marca visitas e cria fichas de quem quer arrendar.' },
  { nome: 'Contabilista',
    perms: ['tx.view', 'tx.add', 'rec.view', 'rec.add', 'contract.view', 'loan.view',
      'file.view', 'file.add', 'report.view'],
    sub: 'Regista movimentos e vê contratos, hipotecas e avaliação. Não mexe nas fichas.' },
  { nome: 'Ver tudo',
    perms: PERMS.filter((p) => p.endsWith('.view')),
    sub: 'Vê tudo sobre o imóvel, sem alterar nada.' },
];

// O nome de cada kind na frase de recusa («adicionar movimentos»).
const NOME_DO_KIND = { tx: 'movimentos', rec: 'planeados', visit: 'visitas', contract: 'contratos', tenant: 'inquilinos' };

// Uma permissão está na lista? Aceita um Set (o que acessoACasa devolve) ou
// um array (o que vem da base já normalizado).
// Recebe: perms — Set ou array de permissões; perm — a permissão a procurar.
// Devolve: true se está.
export function temPerm(perms, perm) {
  if (perms instanceof Set) return perms.has(perm);
  return Array.isArray(perms) && perms.includes(perm);
}

// O prefixo de permissão de um kind, sem cair no protótipo: 'constructor'
// vindo de fora devolvia uma função (docs/armadilhas.md).
// Recebe: kind — o kind do registo (texto vindo do cliente).
// Devolve: o prefixo ('tx', 'contract', ...) ou null quando o kind não tem cargo que o cubra.
export function permDoKind(kind) {
  return Object.prototype.hasOwnProperty.call(KIND_PERM, kind) ? KIND_PERM[kind] : null;
}

// Filtra pelo que existe em PERMS, aplica as implicações (transitivamente)
// e devolve na ordem canónica, sem repetidos. Lixo e não-strings caem.
// Recebe: lista — array de permissões, tal como vem do cliente (ou nada).
// Devolve: array de permissões válidas, com as implicadas, na ordem de PERMS.
export function normalizarPerms(lista) {
  const out = new Set();
  const poe = (p) => {
    if (out.has(p)) return;
    out.add(p);
    (IMPLICA[p] || []).forEach(poe);
  };
  (Array.isArray(lista) ? lista : []).forEach((p) => {
    if (typeof p === 'string' && PERMS.includes(p)) poe(p);
  });
  return PERMS.filter((p) => out.has(p));
}

// Pode ver os registos deste kind por inteiro?
// Recebe: perms — Set ou array de permissões; kind — o kind do registo.
// Devolve: true se tem KIND_PERM[kind] + '.view'.
export function podeVerKind(perms, kind) {
  const p = permDoKind(kind);
  return !!p && temPerm(perms, p + '.view');
}

// Pode criar registos deste kind (e editar/apagar os que criou)?
// Recebe: perms — Set ou array de permissões; kind — o kind do registo.
// Devolve: true se tem KIND_PERM[kind] + '.add'.
export function podeAddKind(perms, kind) {
  const p = permDoKind(kind);
  return !!p && temPerm(perms, p + '.add');
}

// Os registos deste kind chegam ao cliente, ainda que despidos? É podeVerKind
// mais o caso especial: contract.view traz os inquilinos dos contratos só
// com {id, name}.
// Recebe: perms — Set ou array de permissões; kind — o kind do registo.
// Devolve: true se algum registo deste kind vai na resposta.
export function kindVisivel(perms, kind) {
  return podeVerKind(perms, kind) || (kind === 'tenant' && temPerm(perms, 'contract.view'));
}

// Os kinds cujos registos se vão buscar à base para este cargo.
// Recebe: perms — Set ou array de permissões.
// Devolve: array de kinds (subconjunto das chaves de KIND_PERM), pode ser vazio.
export function kindsVisiveis(perms) {
  return Object.keys(KIND_PERM).filter((k) => kindVisivel(perms, k));
}

// A casa como um cargo a vê: sem hipotecas salvo loan.view, sem fotos salvo
// file.view, sem valor/aquisição salvo report.view, sem notas/anúncio salvo
// house.edit, e nunca as quotas. O que fica é o que qualquer colaborador vê:
// nome, morada, quartos, dados registais.
// Recebe: data — o JSON da casa já interpretado (objeto); perms — Set ou array.
// Devolve: um objeto novo, despido; data não é alterado.
export function projetarCasa(data, perms) {
  const d = Object.assign({}, data && typeof data === 'object' ? data : {});
  delete d.ownerShares;
  if (!temPerm(perms, 'loan.view')) delete d.loans;
  if (!temPerm(perms, 'file.view')) delete d.photos;
  if (!temPerm(perms, 'report.view')) { delete d.value; delete d.purchase; }
  if (!temPerm(perms, 'house.edit')) { delete d.notes; delete d.listing; }
  return d;
}

// Um registo como um cargo o vê: inteiro quando vê o kind; um inquilino sem
// tenant.view mas com contract.view fica em {id, name}; o resto não vai.
// Recebe: kind — o kind do registo; data — o JSON já interpretado (objeto);
// perms — Set ou array de permissões.
// Devolve: o objeto a enviar (o próprio data, ou o {id, name}), ou null
// quando o registo não pode ir.
export function projetarRegisto(kind, data, perms) {
  if (podeVerKind(perms, kind)) return data;
  if (kind === 'tenant' && temPerm(perms, 'contract.view')) {
    return { id: data && data.id, name: (data && data.name) || '' };
  }
  return null;
}

// A ficha do imóvel que um colaborador com house.edit grava, fundida sobre a
// que está na base: só entram os campos que o cargo pode ver — o cliente
// dele não tem o valor de mercado nem as hipotecas, e gravar a casa inteira
// punha zeros por cima do que o dono escreveu. Donos e quotas nunca entram.
// Recebe: existenteStr — o JSON da casa na base, em texto; incoming — o
// objeto que o cliente mandou (já passado por cleanData); perms — Set ou array.
// Devolve: um objeto novo com a casa fundida, pronto a gravar.
export function fundirCasa(existenteStr, incoming, perms) {
  let base = {};
  try { const ex = JSON.parse(existenteStr); if (ex && typeof ex === 'object') base = ex; } catch (e) {}
  const out = Object.assign({}, base);
  const bloqueado = (k) =>
    k === 'ownerIds' || k === 'ownerShares' ||
    (k === 'loans' && !temPerm(perms, 'loan.view')) ||
    (k === 'photos' && !temPerm(perms, 'file.view')) ||
    ((k === 'value' || k === 'purchase') && !temPerm(perms, 'report.view')) ||
    ((k === 'notes' || k === 'listing') && !temPerm(perms, 'house.edit'));
  Object.keys(incoming || {}).forEach((k) => { if (!bloqueado(k)) out[k] = incoming[k]; });
  return out;
}

// Os campos de um planeado que confirmar e silenciar tocam — os únicos que um
// colaborador com rec.add pode mudar num planeado que não criou.
const CAMPOS_DE_CONFIRMAR = ['next', 'until', 'muted'];

// O planeado de outrem que um colaborador com rec.add grava, fundido sobre o
// que está na base: só next, until e muted entram (o que confirmar e silenciar
// tocam); nome, cadência, montante, imóvel, contrato e o resto ficam como o
// dono os deixou. Uma reescrita com amount/propertyId/tx diferentes não dá
// erro — simplesmente não tem efeito nesses campos, e o put do cliente que
// manda o planeado inteiro com o next avançado continua a passar.
// Recebe: existenteStr — o JSON do planeado na base, em texto; incoming — o
// objeto que o cliente mandou (já passado por cleanData).
// Devolve: um objeto novo com o planeado fundido, pronto a gravar; quando o
// JSON guardado não se lê, o próprio incoming (não há nada a preservar).
export function fundirPlaneado(existenteStr, incoming) {
  let base = null;
  try { const ex = JSON.parse(existenteStr); if (ex && typeof ex === 'object') base = ex; } catch (e) {}
  if (!base) return incoming;
  const out = Object.assign({}, base);
  CAMPOS_DE_CONFIRMAR.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(incoming || {}, k)) out[k] = incoming[k];
  });
  return out;
}

// Quantos dias tem um mês.
// Recebe: y — o ano (número); m — o mês 1-12 (número).
// Devolve: 28 a 31 (número).
function diasDoMes(y, m) {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

// A data seguinte de um planeado pela cadência — a mesma aritmética do
// nextDate de web/app/planeados.js, em texto e sem Date (nunca toISOString:
// o worker não sabe o fuso de quem escreveu a data). Uma semana soma 7 dias;
// mês, trimestre e ano somam meses e prendem o dia ao último do mês de
// chegada (31 de janeiro + 1 mês = 28 ou 29 de fevereiro).
// Recebe: iso — a data de partida em AAAA-MM-DD (texto); every — a cadência:
// 'week', 'month', 'quarter' ou 'year' (qualquer outra conta como mês).
// Devolve: a data seguinte em AAAA-MM-DD, ou '' quando iso não tem essa forma.
export function proximaData(iso, every) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  let y = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDoMes(y, mes)) return '';
  if (every === 'week') {
    dia += 7;
    while (dia > diasDoMes(y, mes)) {
      dia -= diasDoMes(y, mes);
      mes += 1;
      if (mes > 12) { mes = 1; y += 1; }
    }
  } else {
    const n = every === 'year' ? 12 : every === 'quarter' ? 3 : 1;
    const total = mes - 1 + n;
    y += Math.floor(total / 12);
    mes = (total % 12) + 1;
    dia = Math.min(dia, diasDoMes(y, mes));
  }
  return y + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}

// Este planeado termina na próxima confirmação? É o que decide se um
// colaborador com rec.add pode apagar um planeado que não criou: o cliente
// (recAdvance) apaga-o quando é «uma só vez» ou quando o next seguinte passa
// o fim — e um del recusado ressuscitava o planeado ainda «por confirmar»,
// com o movimento a duplicar-se à segunda confirmação. Um planeado sem fim,
// ou cujo fim ainda não chegou, não termina — e esse continua a ser só do
// dono. Sem next legível não se sabe: não termina.
// Recebe: data — o JSON do planeado já interpretado (objeto; olha para every,
// next e end).
// Devolve: true quando every é 'once', ou quando há end e a data seguinte a
// next pela cadência é posterior a end.
export function planeadoTermina(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.every === 'once') return true;
  if (typeof data.end !== 'string' || !data.end) return false;
  const seguinte = proximaData(data.next, data.every);
  return !!seguinte && seguinte > data.end;
}

// A frase que explica a um colaborador por que a escrita não passou — o
// cliente mostra-a tal e qual num toast e tira o registo da base local.
// Recebe: motivo — 'add' (falta o .add do kind), 'proprio' (não criou o
// registo), 'casa' (sem house.edit), 'kind' (kind sem cargo que o cubra),
// 'anexo' (junta anexos sem file.add) ou 'acesso'; kind (opcional) — o kind
// do registo, para a frase de 'add'.
// Devolve: a frase em português.
export function fraseRecusa(motivo, kind) {
  if (motivo === 'add') {
    return 'Sem permissão para adicionar ' + (NOME_DO_KIND[kind] || 'registos deste tipo') + ' neste imóvel.';
  }
  if (motivo === 'proprio') return 'Só podes alterar ou apagar o que tu criaste neste imóvel.';
  if (motivo === 'anexo') return 'Sem permissão para adicionar fotos e documentos neste imóvel.';
  if (motivo === 'casa') return 'Sem permissão para editar a ficha deste imóvel.';
  if (motivo === 'kind') return 'Sem permissão para alterar este tipo de registo neste imóvel.';
  return 'Sem acesso a esta casa.';
}
