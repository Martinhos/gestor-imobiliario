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
  colaboradores: 'Colaboradores e cargos',
  anexos: 'Fotos e documentos',
  conta: 'Conta e entrada',
  suporte: 'Pedidos de ajuda',
};

var AVISOS = [
  {
    v: 32,
    data: '2026-09-09',
    titulo: 'Uma correção de arranque, e os documentos com nome',
    seccoes: [
      {
        titulo: 'A app voltou a abrir',
        afeta: ['app'],
        itens: [
          'Houve arranques em que a app ficava num ecrã em branco, sem chegar a abrir. Acontecia quando uma atualização apanhava a app a meio de carregar: metade dos ficheiros vinha da versão nova e metade da anterior, e as duas metades não se entendem.',
          'Deixou de poder acontecer: uma atualização só entra quando está inteira. E se alguma vez o arranque falhar por outra razão, a app limpa o que tem guardado e recarrega sozinha, em vez de ficar em branco.',
        ],
      },
      {
        titulo: 'Os documentos dizem quem opera o serviço',
        afeta: ['conta'],
        itens: [
          'Os Termos e Condições e a Política de Privacidade passam a identificar quem trata os teus dados e como falar com essa pessoa — é o que a lei pede, e é o que te permite exercer os direitos que os próprios documentos prometem. Por isso a app pede a aceitação outra vez.',
          'E deixaram de viver só dentro da app: estão em rendorium.com/termos e rendorium.com/privacidade, para se poderem ler antes de criar conta.',
        ],
      },
      {
        titulo: 'Não há planos',
        afeta: ['app'],
        itens: [
          'A app deixou de ter escalões. Não há limites ao número de imóveis, contratos ou movimentos que podes criar, não há subscrições e não há cartão para pôr — e os Termos deixaram de prometer limites que não existem.',
        ],
      },
    ],
  },
  {
    v: 31,
    data: '2026-09-09',
    titulo: 'Colaboradores com cargos, e uma ligação em vez do id',
    seccoes: [
      {
        titulo: 'Convida quem te ajuda a gerir',
        afeta: ['colaboradores', 'partilha'],
        itens: [
          'Podes dar acesso a um imóvel, ou a vários, a quem não é dono: um contabilista, quem faz as visitas, um familiar que só quer ver. Não têm quota-parte nem entram nas contas entre proprietários.',
          'Cada colaborador tem um cargo, e cada cargo diz o que se pode ver e adicionar — movimentos, planeados, visitas, contratos, inquilinos, hipotecas, documentos, avaliação. Crias os cargos que quiseres, ou começas por um dos três prontos: Gestor de visitas, Contabilista, Ver tudo.',
          'O convite é uma ligação de uso único: escolhes o cargo e os imóveis, copias, envias. Quem a abrir entra (ou cria conta) e fica logo com o acesso. Tudo no menu, em Pessoas → Colaboradores.',
          'Quem adiciona um registo pode editá-lo e apagá-lo; o que é teu, só tu e os comproprietários mexem. O sino diz quem fez o quê, e com que cargo.',
        ],
      },
      {
        titulo: 'Partilhar por ligação',
        afeta: ['partilha'],
        itens: [
          'Em Definições → Conta e partilha há agora uma ligação permanente tua: quem a abrir escolhe que imóveis quer partilhar contigo e tu aceitas ou recusas cada pedido — sem escrever o id. Podes desativá-la quando quiseres.',
        ],
      },
      {
        titulo: 'As prestações reconhecem o crédito',
        afeta: ['creditos', 'movimentos'],
        itens: [
          'Um movimento criado a partir de uma prestação planeada já vem com a hipoteca certa preenchida — antes ficava sem crédito atribuído e tinhas de o escolher a cada mês.',
          'A prestação segue a divisão que puseste no planeado: quem paga e por quem se divide passam para o movimento como estão.',
        ],
      },
      {
        titulo: 'Os cartões dos movimentos levam ao filtro',
        afeta: ['movimentos'],
        itens: [
          'Abrir um dos seis cartões de resumo — receitas, despesas, prestações, dívidas pagas e recebidas, saldo — dá-te agora o botão para ver só esses movimentos. O saldo mostra tudo.',
        ],
      },
      {
        titulo: 'A app responde ao toque',
        afeta: ['app'],
        itens: [
          'Tudo o que se toca reage: os botões, as opções, os separadores e os cartões afundam-se enquanto tens o dedo em cima. No telemóvel não havia sinal nenhum entre o toque e o resultado.',
          'As janelas sobem em vez de aparecerem feitas, os menus abrem do lado por onde nascem, as secções que abres deixam o conteúdo entrar e os gráficos desenham-se em vez de surgirem prontos.',
          'A navegação por teclado passa a mostrar onde está: o que se alcança com Tab ganha um contorno visível, também dentro da gaveta escura.',
          'Se pediste ao teu sistema menos movimento, não recebes nenhum — a app respeita essa definição em toda a parte.',
        ],
      },
      {
        titulo: 'Um contrato que ainda não começou',
        afeta: ['contratos', 'movimentos'],
        itens: [
          'Um contrato assinado para começar mais tarde deixa de contar como se já estivesse em vigor: não soma à renda do imóvel, não põe o imóvel como arrendado e não entra no yield nem na avaliação. Nas projeções conta a partir do mês em que começa — e um contrato que acaba a meio do horizonte deixa de contar depois disso.',
          'E passa a ver-se: leva o selo «por começar» na lista, tem filtro próprio, a ficha diz «Por começar · a 15-03-2028», e na ficha do inquilino aparece em «Vai morar em» em vez de «Contratos anteriores».',
          'A renda dele fica planeada para o mês e dia certos, e se mudares a data de início para mais tarde a renda planeada vai com ela.',
          'O cartão do imóvel deixa de dizer só «Vago» quando já está prometido: leva o selo «1 contrato por começar», com o inquilino, a renda e a data em que começa. Quem olha para a lista tem como saber antes de o anunciar outra vez.',
          'E o filtro dos inquilinos passa a ter três estados, em vez de dois: com contrato, com contrato por começar, e sem contrato. Quem assinou para 2028 caía em «Sem contrato», ao lado de um cartão que mostrava o contrato.',
        ],
      },
      {
        titulo: 'A renda acompanha o contrato',
        afeta: ['contratos', 'movimentos'],
        itens: [
          'Se corrigires as datas de um contrato, a renda planeada acompanha-o nos dois sentidos — para a frente e para trás — e nunca volta a pedir um mês que já tem um movimento desse contrato.',
          'Confirmar um planeado num mês que já foi lançado deixa de criar um movimento repetido: salta para o mês seguinte e diz que saltou.',
          'Os movimentos já confirmados não se mexem com o contrato — a data de um movimento diz quando o dinheiro entrou, e mudá-la mudava a receita do ano. Se algum ficar fora das datas novas, antes do início ou depois do fim, a app aponta-os para os poderes rever um a um.',
        ],
      },
      {
        titulo: 'Ver sem editar',
        afeta: ['app', 'colaboradores'],
        itens: [
          'O que não podes alterar abre agora numa ficha de leitura, com os dados escritos por extenso e um botão para editar quando tens permissão. Antes abria o formulário de edição com os campos apagados: mostrava tudo o que não podias fazer, e chamava-lhe leitura.',
          'São seis: o movimento, o contrato, o imóvel, a pessoa, a hipoteca e o planeado.',
        ],
      },
      {
        titulo: 'As datas leem-se como cá se escrevem',
        afeta: ['app'],
        itens: [
          'Em toda a app, 09/09/2026 — dia, mês e ano, por essa ordem. Nas listas, nas fichas, nos avisos, nos balões dos gráficos e na data que fica escrita nas notas de uma visita. Antes apareciam em vários sítios ao contrário, com o ano à frente.',
        ],
      },
      {
        titulo: 'Mudar de ecrã',
        afeta: ['app'],
        itens: [
          'Tocar num separador da barra de baixo vira o painel para o lado — para a direita se o separador está à direita, para a esquerda se está à esquerda. A gaveta não faz isso: ali os treze destinos estão agrupados por assunto e não têm lado.',
          'As listas deixaram de se refazer inteiras. Escrever na pesquisa, mudar um filtro ou confirmar um movimento mexe só nas linhas que mudaram — o resto fica quieto, e o que estavas a ler não salta.',
        ],
      },
      {
        titulo: 'A visão geral abre com tudo no sítio',
        afeta: ['app', 'movimentos'],
        itens: [
          'A variação face ao ano anterior aparece logo ao abrir, em vez de chegar um segundo depois, e o ano a que se refere passou para uma linha própria, onde cabe.',
          'O sino, o cartão dos movimentos por confirmar, o número nos Planeados e o cartão dos prazos deixaram de contar antes de o servidor responder. Havia cerca de um segundo em que apareciam notificações e movimentos por confirmar que não existiam — e num deles dava para carregar em «Confirmar» e criar a renda duas vezes.',
          'Num aparelho onde os teus dados ainda não chegaram — o primeiro acesso, uma janela anónima, ou uma segunda conta no mesmo aparelho — a app diz que está à espera do servidor, em vez de dizer que não tens nada registado.',
          'E os lembretes do telemóvel passam a ser refeitos com o que vem do servidor: uma renda confirmada no computador já não te avisa no telemóvel no dia seguinte.',
        ],
      },
      {
        titulo: 'As opções estão sempre no mesmo sítio',
        afeta: ['app'],
        itens: [
          'O botão que abre as opções de um registo — editar, duplicar, apagar, selecionar vários — é agora o mesmo em todas as listas: o mesmo desenho, o mesmo sítio e um alvo maior. Nos imóveis, inquilinos e planeados era mais pequeno e diferente do dos movimentos; não é preciso descobrir o toque longo para lá chegar.',
          'Os ecrãs que ainda não têm nada passam a dizer por onde se começa, com um botão: a avaliação e as projeções sem imóveis, os contratos e as hipotecas antes do primeiro imóvel.',
          'Um aviso já não tapa os botões de uma janela aberta, e o «Anular» que aparece depois de apagar alguma coisa é agora um botão a sério, e não texto sublinhado.',
        ],
      },
      {
        titulo: 'Se és colaborador',
        afeta: ['colaboradores'],
        itens: [
          'Ao entrar, a app diz de quem és colaborador, em que imóveis e com que cargo. Os cartões desses imóveis levam o selo «de Maria · Contabilista», e a vista geral avisa que os inclui, por inteiro.',
        ],
      },
    ],
  },
  {
    v: 30,
    data: '2026-09-07',
    titulo: 'Visitas, calendário, prazos, um sino, e as contas revistas',
    seccoes: [
      {
        titulo: 'Créditos antigos: as prestações que faltam, na hipoteca certa',
        afeta: ['creditos', 'movimentos'],
        itens: [
          'Ao criar uma hipoteca com início no passado, ou ao recuar o início de uma que já existe, a app pergunta se queres inserir as prestações em falta desde essa data. Ficam com os juros, o selo e o capital do plano, e o capital em dívida desce com elas, como se as confirmasses uma a uma.',
          'O capital em dívida é o da data de início: com as prestações registadas até hoje, o prazo restante e a prestação ficam certos.',
          'Com duas hipotecas no mesmo imóvel, o preenchimento das prestações antigas ia às vezes parar à hipoteca errada. Agora identifica a hipoteca pelo nome, banco e início, e um pagamento de crédito novo pede-te que escolhas a hipoteca em vez de assumir a primeira.',
        ],
      },
      {
        titulo: 'As contas revistas',
        afeta: ['movimentos', 'partilha', 'imoveis'],
        itens: [
          'A divisão «por ajuste» passa a ser o que o nome diz: um extra por cima da parte igual. Ao total tira-se a soma dos ajustes, o resto divide-se por todos e cada um soma o seu (15 € com 5 de extra para um de dois → 10 € e 5 €). Se tinhas movimentos guardados nesse modo, os saldos entre proprietários mudam — confere-os.',
          'Os rácios de rentabilidade (yield bruto, cap rate, sobre a aquisição, LTV) saem da vista geral e vivem só na Avaliação, com a explicação e a evolução ao toque.',
          'A avaliação por rendimento e o cap rate anualizam o ano corrente em vez de capitalizar só os meses já lançados; as cauções e os empréstimos recebidos deixam de contar como receita; as amortizações antecipadas aparecem à parte das prestações.',
          'Na vista por proprietário, os movimentos de grupo entram pela tua quota em cada imóvel; com um grupo em foco, a evolução e os saldos entre donos funcionam. «Pagar todas as dívidas» inclui os movimentos sem imóvel.',
          'A renda líquida de impostos usa por omissão a taxa especial de IRS conforme a duração do contrato (25 %, e 15/10/5 % nos contratos de 5, 10 e 20 anos ou mais) — é uma estimativa, e diz que é.',
          'O yield bruto compara rendas e valor sobre o mesmo conjunto de imóveis; a projeção parte das despesas do último ano completo (ou anualiza o corrente), e diz qual é a base.',
        ],
      },
      {
        titulo: 'Dois menus novos: Visitas e Calendário',
        afeta: ['imoveis', 'contratos'],
        itens: [
          'As visitas às casas têm agora registo próprio: quem vem (sem precisar de ficha — ainda não é inquilino), a que imóvel ou quarto, quando (com horas), o estado e o desfecho, e os teus comentários.',
          'Quando uma visita corre bem, o menu da visita converte-a numa ficha de inquilino num toque, com nome e contacto já preenchidos.',
          'O Calendário mostra o mês de relance: visitas agendadas e movimentos planeados, dia a dia. Tocar num dia realça-o e mostra por baixo da grelha o que ele tem — e há sempre o botão para marcar visita nesse dia.',
        ],
      },
      {
        titulo: 'Um sino com tudo o que pede atenção',
        afeta: ['app', 'movimentos'],
        itens: [
          'A vista geral ganha um sino de notificações: movimentos em atraso, por confirmar, prazos, e — novidade — o que os outros fizeram nas casas partilhadas contigo, com nome e hora.',
          '«Marcar tudo como lido» sincroniza entre aparelhos: ler num, cala o sino nos outros.',
          'Na barra de baixo do telemóvel, o Calendário tomou o lugar dos Planeados — que vivem lá dentro, dia a dia, e continuam no cartão «por confirmar» da vista geral.',
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
