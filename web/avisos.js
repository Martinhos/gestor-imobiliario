/* Novidades de cada publicação.
   ------------------------------
   Ficheiro só de dados: é lido pela app e também pelo service worker (com
   importScripts), por isso não pode tocar em `document` nem em `window`.

   A versão não se escreve à mão em lado nenhum — é a da primeira entrada
   desta lista. Assim não há como publicar novidades e esquecer o número, nem
   subir o número sem dizer o que mudou.

   Cada secção declara que funcionalidades toca. É por funcionalidade e não
   por papel de propósito: quando houver permissões parciais, quem tiver
   acesso a uma funcionalidade vê o que lhe diz respeito, sem precisar de
   pertencer a um papel inteiro. */

var FUNCIONALIDADES = {
  app: 'A aplicação em geral',
  imoveis: 'Imóveis e portefólio',
  contratos: 'Contratos e inquilinos',
  movimentos: 'Movimentos e planeados',
  creditos: 'Créditos à habitação',
  partilha: 'Partilha entre proprietários',
  anexos: 'Fotos e documentos',
  conta: 'Conta e entrada',
  suporte: 'Pedidos de ajuda',
};

var AVISOS = [
  {
    v: 25,
    data: '2026-09-01',
    titulo: 'A vista geral começa pelos números',
    seccoes: [
      {
        titulo: 'A vista geral volta a ser uma vista geral',
        afeta: ['app'],
        itens: [
          'Os movimentos por confirmar deixam de ocupar o ecrã todo: ficam recolhidos, com a contagem e o total à vista, e abrem-se com um toque.',
          'Assim a primeira coisa que vês ao abrir são os indicadores do teu património, que é para isso que a vista serve.',
          'Se preferires a lista sempre aberta, abre-a uma vez — fica assim nesse aparelho.',
        ],
      },
      {
        titulo: 'Movimentos por confirmar mais fáceis de ler',
        afeta: ['movimentos'],
        itens: [
          'A periodicidade (mensal, anual...) passou para junto da data, em vez de andar sozinha no canto.',
          'O cabeçalho passa a somar quanto está à espera de confirmação.',
        ],
      },
      {
        titulo: 'O ícone da app',
        afeta: ['app'],
        itens: [
          'A app instalada pelo browser passa a ter o mesmo ícone da versão Android — antes pareciam duas apps diferentes no ecrã inicial.',
        ],
      },
    ],
  },
  {
    v: 24,
    data: '2026-09-01',
    titulo: 'Vista geral arrumada, e a app passa a contar o que muda',
    seccoes: [
      {
        titulo: 'A vista geral está mais arrumada',
        afeta: ['app'],
        itens: [
          'Os cartões ficam em duas colunas no telemóvel e em quatro no computador. Deitando o telemóvel, os indicadores passam todos para a mesma linha.',
          'Os cartões da mesma fila passam a ter a mesma altura.',
          'A arrumar os cartões, deixaram de trocar de sítio sozinhos quando o dedo pára a meio caminho.',
          'A arrastar um cartão para junto da margem, a página acompanha — já dá para o levar do fundo até ao topo.',
          'O cartão dos movimentos por confirmar fecha-se com um toque, e fica como o deixaste.',
        ],
      },
      {
        titulo: 'Possíveis mais-valias no portefólio',
        afeta: ['imoveis'],
        itens: [
          'O cartão do portefólio passa a mostrar a diferença entre o valor de mercado e o de aquisição.',
          'Só contam os imóveis que têm os dois valores preenchidos — se faltar algum, o cartão diz quantos ficaram de fora.',
          'É o valor em bruto: ao vender, o que é tributado ainda desconta o IMT e o selo da compra, as obras dos últimos 12 anos e as despesas da venda.',
        ],
      },
      {
        titulo: 'O tema segue melhor o telemóvel',
        afeta: ['conta'],
        itens: [
          'O modo automático deixou de ficar preso no claro em alguns browsers.',
          'Nas definições, o botão do automático diz agora o que está a resolver — e, se o browser não estiver a passar a preferência, explica onde se liga.',
        ],
      },
      {
        titulo: 'Esta janela',
        afeta: ['app'],
        itens: [
          'A app passa a verificar se há versão nova quando a abres, e a instalá-la sozinha.',
          'Sempre que houver novidades, aparece este resumo — só com as partes que te dizem respeito.',
          'Podes voltar a lê-las a qualquer momento em Definições → Novidades.',
        ],
      },
    ],
  },
  {
    v: 23,
    data: '2026-08-31',
    titulo: 'Fotos e documentos na nuvem, e ajuda dentro da app',
    seccoes: [
      {
        titulo: 'Fotos e documentos deixam de viver só num aparelho',
        afeta: ['anexos'],
        itens: [
          'O que carregas passa a ficar guardado online e aparece nos teus outros aparelhos.',
          'Quem recebe uma casa partilhada passa a ver os documentos dela.',
          'Continuam a ficar também no aparelho, para a app abrir depressa e funcionar sem rede.',
        ],
      },
      {
        titulo: 'Pedir ajuda sem sair da app',
        afeta: ['suporte'],
        itens: [
          'Em Definições → Ajuda e sugestões podes contar um problema ou pedir uma melhoria.',
          'Vês ali as respostas e o estado de cada pedido.',
        ],
      },
    ],
  },
];

// A versão em vigor é a da entrada mais recente.
var VERSAO = AVISOS[0].v;

/* Versão mínima aceite. Subir isto obriga toda a gente a atualizar antes de
   continuar a usar a app — é para quando uma versão antiga passa a estar
   errada, não para empurrar novidades. */
var VERSAO_MINIMA = 0;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AVISOS: AVISOS, VERSAO: VERSAO, VERSAO_MINIMA: VERSAO_MINIMA, FUNCIONALIDADES: FUNCIONALIDADES };
}
