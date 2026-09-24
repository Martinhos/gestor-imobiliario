// A lista dos comandos do bot, como DADOS: o que o Discord recebe no registo
// (scripts/discord-register.js) e o que a documentação mostra
// (scripts/gerar-docs.js, a lista dos comandos do /equipa/docs). Um sítio só.
//
// Antes o gerador lia as opções do código do registo com uma expressão
// regular por opção, com type, name, description e required por esta ordem e
// numa linha: uma opção escrita em duas linhas, ou com outra ordem, sumia da
// documentação sem erro nenhum. Lida como dados, a forma de a escrever deixa
// de importar.
//
// Sem nada à volta — nem rede, nem variáveis de ambiente: requerer isto só
// devolve a lista.

/* Os tipos de opção do Discord (application command option types). */
const TIPOS = { TEXTO: 3, INTEIRO: 4, BOOLEANO: 5, UTILIZADOR: 6 };
const { TEXTO, INTEIRO, BOOLEANO, UTILIZADOR } = TIPOS;

/* Quem vê cada comando.
   O Discord não conhece os nossos papéis, só as permissões dele. O que se
   pode fazer daqui é esconder por omissão o que é de operação — quem não
   gere o servidor deixa de ver /uso, /resumo e /copias. Para afinar por
   cargo (dar /erros aos devs, /pedidos ao suporte), é no servidor:
   Definições do servidor → Integrações → o bot → Permissões dos comandos.
   O bot valida sempre o papel outra vez, mesmo que alguém veja o comando. */
const GERIR_SERVIDOR = '32';   // MANAGE_GUILD
const soOperacao = { default_member_permissions: GERIR_SERVIDOR };

const comandos = [
  {
    name: 'pedidos',
    description: 'Pedidos de ajuda por tratar',
    options: [
      {
        type: TEXTO, name: 'categoria', description: 'De onde veio', required: false,
        choices: [
          { name: 'contado por alguém', value: 'user' },
          { name: 'erro na app', value: 'client' },
          { name: 'erro no servidor', value: 'server' },
          { name: 'infraestrutura', value: 'infra' },
          { name: 'segurança', value: 'seguranca' },
        ],
      },
      {
        type: TEXTO, name: 'estado', description: 'Filtrar por estado', required: false,
        choices: [
          { name: 'recebidos', value: 'criado' },
          { name: 'em resolução', value: 'resolucao' },
          { name: 'concluídos', value: 'concluido' },
        ],
      },
    ],
  },
  {
    name: 'pedido',
    description: 'Ver um pedido e agir sobre ele',
    options: [{ type: TEXTO, name: 'id', description: 'Id do pedido (bastam os primeiros caracteres)', required: true }],
  },
  {
    name: 'responder',
    description: 'Responder e marcar como em resolução',
    options: [
      { type: TEXTO, name: 'id', description: 'Id do pedido', required: true },
      { type: TEXTO, name: 'texto', description: 'Resposta que a pessoa vai ler na app', required: true },
    ],
  },
  {
    name: 'fechar',
    description: 'Marcar um pedido como concluído',
    options: [
      { type: TEXTO, name: 'id', description: 'Id do pedido', required: true },
      { type: TEXTO, name: 'texto', description: 'Resposta final (opcional)', required: false },
    ],
  },
  {
    name: 'erros',
    description: 'Erros recentes da aplicação',
    options: [{ type: INTEIRO, name: 'horas', description: 'Janela em horas (24 por omissão)', required: false }],
  },
  Object.assign({ name: 'uso', description: 'Consumo da infraestrutura agora' }, soOperacao),
  { name: 'comandos', description: 'O que podes fazer com o teu papel' },
  { name: 'entrar', description: 'Abrir a ferramenta de suporte no browser' },
  { name: 'docs', description: 'Como isto funciona por dentro (gerado do código)' },
  {
    name: 'test',
    description: 'Ligação temporária para o ambiente de teste, numa conta lavada',
    options: [
      { type: BOOLEANO, name: 'dados', description: 'Com dados de exemplo (ao criar)', required: false },
      { type: BOOLEANO, name: 'extra', description: 'Criar uma conta extra, sem tocar nas existentes', required: false },
      { type: BOOLEANO, name: 'limpar', description: 'Apagar as tuas contas de teste e começar do zero', required: false },
      { type: TEXTO, name: 'email', description: 'Para onde vai o correio das tuas contas de teste (fica guardado)', required: false },
    ],
  },
  Object.assign({
    name: 'access',
    description: 'Quem pode que comandos (só o master)',
    // uma opção só: o que se muda, muda-se nas caixas da própria resposta
    options: [
      { type: UTILIZADOR, name: 'utilizador', description: 'De quem', required: true },
    ],
  }, soOperacao),
  Object.assign({
    name: 'copias',
    description: 'Cópias da base de dados no R2',
    options: [{
      type: BOOLEANO, name: 'agora', description: 'Fazer uma cópia já', required: false,
    }],
  }, soOperacao),
  Object.assign({ name: 'resumo', description: 'Enviar o resumo diário para o canal de administração' }, soOperacao),
];

module.exports = { TIPOS, comandos };
