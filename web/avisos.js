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
    v: 30,
    data: '2026-09-04',
    titulo: 'Visitas, calendário, e os prazos deixam de se perder',
    seccoes: [
      {
        titulo: 'Dois menus novos: Visitas e Calendário',
        afeta: ['imoveis', 'contratos'],
        itens: [
          'As visitas às casas têm agora registo próprio: quem vem (sem precisar de ficha — ainda não é inquilino), a que imóvel ou quarto, quando (com horas), o estado e o desfecho, e os teus comentários.',
          'Quando uma visita corre bem, o menu da visita converte-a numa ficha de inquilino num toque, com nome e contacto já preenchidos.',
          'O Calendário mostra o mês de relance: visitas agendadas e movimentos planeados, dia a dia. Tocar num dia abre a lista dele — e um dia vazio oferece logo marcar visita ali.',
        ],
      },
      {
        titulo: 'A vista geral ganha o cartão «Prazos»',
        afeta: ['contratos', 'imoveis', 'creditos'],
        itens: [
          'O fim de cada contrato avisa com antecedência — incluindo a janela legal de oposição à renovação (120 dias), enquanto ainda vais a tempo.',
          'O aumento anual da renda avisa a tempo de o comunicar ao inquilino com os 30 dias de pré-aviso.',
          'A validade do cartão de cidadão de inquilinos e proprietários, e o certificado energético de cada imóvel, avisam antes de caducarem.',
          'Nos créditos mistos, o fim da fase de taxa fixa avisa com 90 dias — o momento certo para comparar propostas.',
          'Cada aviso pode ser silenciado; quando a data mudar (contrato renovado, documento novo), volta sozinho. Na app instalada, os prazos também chegam como notificações.',
        ],
      },
    ],
  },
  {
    v: 29,
    data: '2026-09-02',
    titulo: 'Nada se perde sem perguntar',
    seccoes: [
      {
        titulo: 'As janelas protegem o que escreveste',
        afeta: ['app'],
        itens: [
          'Fechar uma janela com alterações por guardar — no fundo escurecido, no X ou com o botão voltar — passa a perguntar primeiro. Um toque acidental deixou de deitar fora um formulário meio preenchido.',
          'Apagar uma fotografia ou um ficheiro passa a pedir confirmação, e o botão afastou-se do puxador de arrastar.',
        ],
      },
      {
        titulo: 'A app inteira anda a teclado',
        afeta: ['app'],
        itens: [
          'O menu, os cartões e as listas passaram a ser alcançáveis com Tab e a abrir com Enter.',
          'Dentro de uma janela, o foco fica na janela — e ao fechar volta para onde estava.',
          'As confirmações («Guardado», «Apagado») passam a ser anunciadas por leitores de ecrã.',
        ],
      },
      {
        titulo: 'Apagar com rede por baixo',
        afeta: ['movimentos', 'imoveis', 'contratos'],
        itens: [
          'Apagar um movimento deixa de perguntar — apaga e dá seis segundos de «Anular». Apagar um imóvel, um contrato ou uma seleção inteira continua a confirmar, mas também ganha o «Anular».',
          'Ao abrir, se a app estiver a atualizar-se, passa a dizê-lo: versão de destino e passo a passo, em vez de um recarregamento mudo.',
        ],
      },
      {
        titulo: 'Recuperar a palavra-passe, e respostas por email',
        afeta: ['conta', 'suporte'],
        itens: [
          '«Esqueci-me da palavra-passe» no ecrã de entrada: chega-te uma ligação por email, válida 1 hora, para definires uma nova — também serve a quem entra pela Google e quer ter palavra-passe.',
          'Quando respondemos a um pedido de ajuda, recebes um email — deixa de ser preciso ir à app ver se já há resposta.',
        ],
      },
      {
        titulo: 'A app passou a chamar-se Rendorium',
        afeta: ['app'],
        itens: [
          'Nome novo, casa nova: rendorium.com, com a app em app.rendorium.com. O endereço antigo continua a funcionar — nada muda para quem já a tem instalada.',
        ],
      },
      {
        titulo: 'Filtros comuns, datas e perguntas frequentes',
        afeta: ['app', 'movimentos'],
        itens: [
          'Filtros comuns: define um conjunto de escolhas com nome (Definições → Filtros comuns) e aplica-o num toque no funil de qualquer vista — cada uma usa o que lhe diz respeito.',
          'Os movimentos passam a filtrar-se entre datas (De/Até no funil).',
          'Definições → Perguntas frequentes: as dúvidas mais comuns, respondidas com o caminho concreto.',
          'O botão do topo dos documentos longos diz «Voltar» e acompanha o scroll.',
        ],
      },
      {
        titulo: 'O toque longo passou a significar uma coisa só',
        afeta: ['imoveis', 'contratos', 'movimentos'],
        itens: [
          'Segurar num cartão seleciona vários — nos movimentos, nos imóveis e nos contratos. As opções de um cartão vivem no botão ⋮.',
          'Imóveis e contratos podem apagar-se em massa: a confirmação diz quantos contratos e movimentos vão junto, e o «Anular» repõe tudo.',
        ],
      },
      {
        titulo: 'O teu perfil preenche-se sozinho',
        afeta: ['conta'],
        itens: [
          'O email da conta (do registo ou da Google) e o nome entram sozinhos nos campos vazios do perfil.',
        ],
      },
      {
        titulo: 'Filtros com um só feitio',
        afeta: ['app'],
        itens: [
          'Todos os painéis de filtro aplicam no momento: mexes, a lista muda logo atrás. «Limpar» à esquerda, «Fechar» à direita, em todo o lado.',
          'No modo de seleção, as ações desceram para uma barra em baixo, à mão do polegar.',
        ],
      },
      {
        titulo: 'Apagar tudo diz a verdade',
        afeta: ['app', 'conta'],
        itens: [
          'Com sessão iniciada, «Apagar tudo» apagava também na conta e nos outros aparelhos — dizendo «deste dispositivo». Agora explica as duas opções em vez de arriscar.',
        ],
      },
    ],
  },
  {
    v: 28,
    data: '2026-09-01',
    titulo: 'Tutoriais na ajuda, e a funcionar com janelas abertas',
    seccoes: [
      {
        titulo: 'Os tutoriais estão todos na ajuda',
        afeta: ['app'],
        itens: [
          'Em Definições → Ajuda e sugestões, secção “Como se faz”, com todos listados e o número de passos de cada.',
          'Deixa de ser preciso esperar que a app to ofereça, ou não ter dispensado o cartão dos primeiros passos.',
        ],
      },
      {
        titulo: 'Correções nos tutoriais',
        afeta: ['app'],
        itens: [
          'Um passo já não abre janelas por sua conta: aparecia uma a meio do tutorial sem ninguém ter pedido.',
          'Com uma janela aberta, o cartão do tutorial continua à vista e a funcionar. Antes desaparecia por baixo dela e não havia como continuar.',
          'Quem não quiser preencher os dados pode continuar o tutorial na mesma.',
        ],
      },
    ],
  },
  {
    v: 27,
    data: '2026-09-01',
    titulo: 'Primeiros passos e tutoriais',
    seccoes: [
      {
        titulo: 'Um caminho para quem chega',
        afeta: ['app'],
        itens: [
          'A vista geral passa a mostrar o que falta fazer: preencher o perfil, adicionar imóveis, registar contratos e confirmar movimentos.',
          'São sugestões, não obrigações — o cartão fecha-se e não volta.',
          'Cada passo tem um tutorial: um cartão que flutua por cima da app, com o que fazer, e que se pode percorrer para a frente e para trás.',
        ],
      },
      {
        titulo: 'Correções',
        afeta: ['app'],
        itens: [
          'O painel de filtros passa a acompanhar a página. Ficava preso ao topo e desaparecia ao primeiro deslize.',
          'Nos telemóveis com as barras do browser à mostra, o topo das janelas deixa de ficar escondido.',
        ],
      },
    ],
  },
  {
    v: 26,
    data: '2026-09-01',
    titulo: 'Tratar vários movimentos de uma vez',
    seccoes: [
      {
        titulo: 'Selecionar vários movimentos',
        afeta: ['movimentos'],
        itens: [
          'Toque longo num movimento entra em modo de seleção, já com esse marcado.',
          'Cada movimento tem a sua caixa, cada mês tem a sua, e há uma para marcar tudo.',
          'A caixa de marcar tudo e a do mês acompanham a página: numa lista longa já não é preciso voltar ao topo para marcar tudo.',
          'Com movimentos marcados, o botão do canto abre “Editar seleção” e “Eliminar seleção”, e o X ao lado sai da seleção.',
        ],
      },
      {
        titulo: 'Editar muitos de uma vez',
        afeta: ['movimentos'],
        itens: [
          'Podes mudar a categoria, a subcategoria e acrescentar etiquetas a todos os movimentos marcados ao mesmo tempo.',
          'Só se altera o que preencheres: o resto de cada movimento fica como está, e nenhuma etiqueta é removida.',
          'Eliminar em massa mostra quanto somam os movimentos antes de confirmar.',
        ],
      },
      {
        titulo: 'As opções de um movimento sozinho',
        afeta: ['movimentos'],
        itens: [
          'Passaram para um botão na própria linha, em vez do toque longo — que agora serve para selecionar.',
        ],
      },
      {
        titulo: 'Correções',
        afeta: ['app'],
        itens: [
          'Em Definições → Novidades, as secções abrem e fecham logo. Antes era preciso sair e voltar a entrar para ver a diferença.',
        ],
      },
    ],
  },
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
