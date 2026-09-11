/* Papéis
   ------
   master     dono: pode tudo, hoje e o que vier a existir
   admin      opera o serviço: consumo, cópias, e tudo o que os outros veem
   dev        constrói: erros da app e do servidor, infraestrutura, segurança
   suporte    fala com quem usa: só os pedidos contados por pessoas

   admin, dev e suporte são irmãos: nenhum manda nos outros e nenhum contém
   os outros. Cada um tem o seu canto — quem opera vê o consumo e as cópias,
   quem programa vê os erros, quem atende vê as pessoas. Só o master está
   acima dos três, e é o único que decide quem pode o quê.

   Cada lista aceita ids de pessoa ou ids de cargo do Discord: com cargos,
   entra e sai gente sem mexer nos segredos.

   Estar em duas listas soma em vez de escolher: quem for admin e dev corre
   os comandos dos dois. Enquanto o admin podia tudo isto não se notava; com
   irmãos, escolher uma só tirava acessos a quem ganhasse um segundo cargo.

   Vive aqui, e não no discord.js, porque é lido de mais do que um lado: o
   bot, o back office (equipa-vista.js, equipa-api.js) e o gerador de docs.
   Com o bloco dentro do discord.js, o back office importava o bot para ler
   uma tabela, e o bot importava o back office para abrir a entrada — um
   ciclo, que em módulos ES pode dar zona morta temporal em runtime e num
   Worker aparece como um 500 sem explicação. */
export const PAPEIS = ['master', 'admin', 'dev', 'suporte'];

// Papéis que podem tudo, incluindo comandos que ainda não existem.
export const PODEM_TUDO = ['master'];

/* Comandos que nem o admin herda e que não se dão por exceção. Quem decide
   quem pode o quê tem de ser um só — senão o controlo de acessos passa a
   poder dar-se a si próprio. */
export const SO_MASTER = ['access'];

// O que cada papel pode correr. Os de cima não aparecem nas listas.
export const PERMISSOES = {
  pedidos: ['admin', 'dev', 'suporte'],
  pedido: ['admin', 'dev', 'suporte'],
  responder: ['admin', 'dev', 'suporte'],
  fechar: ['admin', 'dev', 'suporte'],
  erros: ['dev'],
  uso: ['admin'],
  resumo: ['admin'],
  copias: ['admin'],
  comandos: ['admin', 'dev', 'suporte'],
  entrar: ['admin', 'dev', 'suporte'],
  test: ['dev', 'suporte'],
  docs: ['admin', 'dev', 'suporte'],
  access: [],
};

/* As categorias de pedido que cada papel vê. Os pedidos são dos três, mas
   cada um só vê os do seu canto: o suporte não precisa de ver rastreios de
   erro para responder a quem escreveu — e não deve.

   'seguranca' está de propósito no dev e no admin ao mesmo tempo. É a única
   sobreposição, e é deliberada: um aviso de segurança que ninguém vê é pior
   do que um aviso visto duas vezes. */
export const CATS_DO_PAPEL = {
  master: ['user', 'client', 'server', 'infra', 'seguranca'],
  admin: ['infra', 'seguranca'],
  dev: ['client', 'server', 'seguranca'],
  suporte: ['user'],
};

// Um papel ou vários: daqui para baixo aceita-se qualquer um dos dois.
// Recebe: p — um papel (string), uma lista de papéis, ou nada.
// Devolve: sempre uma lista de papéis, sem entradas vazias.
export const comoLista = (p) => (Array.isArray(p) ? p.filter(Boolean) : p ? [p] : []);
// Os papéis por extenso, para as mensagens: "admin + dev", ou "nenhum".
// Recebe: p — um papel (string) ou lista de papéis.
// Devolve: string com os papéis unidos por " + ", ou "nenhum" se não houver.
export const nomeDoPapel = (p) => comoLista(p).join(' + ') || 'nenhum';

const COR_PAPEL = { master: 0xb94a48, admin: 0x8a7bb8, dev: 0xd6a34a, suporte: 0x2f7d5b };
// A cor dos embeds segue o papel mais alto que a pessoa tem.
// Recebe: p — um papel (string) ou lista de papéis, do mais alto para o mais baixo.
// Devolve: número — a cor (inteiro RGB) do primeiro papel; verde se não houver.
export const cor = (p) => COR_PAPEL[comoLista(p)[0]] || 0x2f7d5b;

// As categorias que esta pessoa vê, somando os papéis que tiver.
// Recebe: pap — um papel (string) ou lista de papéis.
// Devolve: lista de categorias ('user', 'client', …) sem repetidos.
export function catsDe(pap) {
  const vistas = [];
  comoLista(pap).forEach((p) => (CATS_DO_PAPEL[p] || []).forEach((c) => {
    if (vistas.indexOf(c) < 0) vistas.push(c);
  }));
  return vistas;
}

// Parte uma variável de ambiente numa lista de ids (aceita vírgulas e espaços).
// Recebe: v — o valor da variável (string com ids separados por vírgulas ou espaços, ou nada).
// Devolve: lista de ids (strings), sem entradas vazias.
const lista = (v) => String(v || '').split(/[,\s]+/).filter(Boolean);

// Diz se quem fala está na lista da variável de ambiente `chave`: pelo id de
// pessoa ou por qualquer um dos cargos de Discord que tem.
// Recebe: env — variáveis de ambiente; i — a interação do Discord (usa o id de
// quem fala e os cargos em member.roles); chave — o nome da variável com a lista.
// Devolve: booleano — true se o id da pessoa ou um dos cargos está na lista.
function pertence(env, i, chave) {
  const l = lista(env[chave]);
  if (!l.length) return false;
  const uid = (i.member && i.member.user && i.member.user.id) || (i.user && i.user.id);
  const cargos = (i.member && i.member.roles) || [];
  return l.indexOf(uid) > -1 || cargos.some((r) => l.indexOf(r) > -1);
}

// Sem nenhuma lista configurada, quem tiver acesso ao servidor de Discord é
// admin — é o dono que decide, ao configurar.
const CHAVE_DO_PAPEL = {
  master: 'DISCORD_MASTER', admin: 'DISCORD_ADMINS',
  dev: 'DISCORD_DEVS', suporte: 'DISCORD_SUPORTE',
};

// Todos os papéis de quem está a falar, do mais alto para o mais baixo.
// Recebe: env — variáveis de ambiente (as listas DISCORD_MASTER/ADMINS/DEVS/SUPORTE);
// i — a interação do Discord.
// Devolve: lista de papéis do mais alto para o mais baixo; ['master'] quando
// nenhuma lista está configurada; vazia se a pessoa não está em nenhuma.
export function papeisDe(env, i) {
  const configurado = PAPEIS.some((p) => lista(env[CHAVE_DO_PAPEL[p]]).length);
  if (!configurado) return ['master'];
  return PAPEIS.filter((p) => pertence(env, i, CHAVE_DO_PAPEL[p]));
}

// O papel principal, para mostrar e para dar cor: o mais alto que a pessoa tem.
// Recebe: env — variáveis de ambiente; i — a interação do Discord.
// Devolve: string com o papel mais alto, ou null se não tiver nenhum.
export function papel(env, i) {
  return papeisDe(env, i)[0] || null;
}
