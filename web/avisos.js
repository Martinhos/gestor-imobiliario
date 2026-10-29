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
    v: 47,
    data: '2026-10-29',
    titulo: 'Datas a partir da compra do imóvel',
    seccoes: [
      {
        titulo: 'Contratos, receitas e créditos',
        afeta: ['contratos', 'movimentos', 'creditos'],
        itens: [
          'Um contrato, uma receita ou uma hipoteca de um imóvel já não podem ter data antes da compra dele, quando a ficha tem a data de aquisição. As despesas continuam a poder ser de antes, como o sinal do contrato-promessa.',
          'O preenchimento das rendas em falta começa na compra, e não no início do contrato.',
          'Registar muitos movimentos de uma vez já não os envia aos poucos: vão todos no mesmo envio.',
        ],
      },
      {
        titulo: 'Apresentações',
        afeta: ['app'],
        itens: [
          'Quem fecha uma apresentação a meio escolhe entre voltar a ela ou não ver mais nenhuma. Se escolheres não ver mais, a de cada ecrã continua no «?».',
          'Os campos de valores e percentagens deixaram de mostrar sugestões de valores escritos antes.',
        ],
      },
      {
        titulo: 'O rasto de utilização',
        afeta: ['app', 'conta'],
        itens: [
          'Se aceitaste ajudar a melhorar o Rendorium, o rasto passa a contar também quantos registos adicionas, editas ou removes, e de que tipo (um imóvel, três movimentos). Nunca o conteúdo deles.',
          'A Política de Privacidade diz isto, e por isso os termos pedem uma nova aceitação.',
        ],
      },
    ],
  },
  {
    v: 46,
    data: '2026-10-29',
    titulo: 'A apresentação de cada ecrã no «?»',
    seccoes: [
      {
        titulo: 'Apresentações e ligação',
        afeta: ['app'],
        itens: [
          'O «?» no cabeçalho abre a apresentação do ecrã onde estás, para a reveres quando quiseres. Não aparece nas Definições.',
          'A Ajuda saiu do fundo do menu, onde fica o cartão da tua conta: está nas Definições, em «Ajuda e sugestões».',
          'A nuvem da sincronização saiu do cabeçalho. Quando não há ligação ao servidor aparece uma faixa vermelha por cima do ecrã, com quantas alterações esperam para ser enviadas, e sai sozinha quando a ligação volta.',
        ],
      },
    ],
  },
  {
    v: 45,
    data: '2026-10-29',
    titulo: 'Avisos por email dos movimentos em atraso',
    seccoes: [
      {
        titulo: 'Os planeados em atraso',
        afeta: ['movimentos', 'conta'],
        itens: [
          'Quando um movimento planeado fica em atraso, os proprietários do imóvel recebem um email com o imóvel, a data e o montante, e um botão que abre os Planeados. No máximo um email por dia, e só nos dias em que há atrasos novos; os que continuam em atraso vêm lembrados no mesmo email.',
          'Os colaboradores que veem os contratos do imóvel também recebem, só com o que o cargo deles deixa ver na app.',
          'Vem ligado. Desligas em Definições, «Avisos por email», ou pela ligação no fundo do próprio email.',
        ],
      },
      {
        titulo: 'Pequenas correções',
        afeta: ['app'],
        itens: [
          'Tocar em Ajuda na gaveta, já dentro das Definições, fecha a gaveta.',
          'Na Visão geral sem movimentos, o botão dos filtros abre um painel que diz porquê e leva ao primeiro movimento.',
        ],
      },
    ],
  },
  {
    v: 44,
    data: '2026-10-29',
    titulo: 'Ajudar a melhorar o Rendorium',
    seccoes: [
      {
        titulo: 'O rasto de utilização',
        afeta: ['app', 'conta'],
        itens: [
          'Podes ajudar-nos a melhorar o Rendorium: se aceitares, a app guarda onde tocas e que ecrãs abres, com um identificador sem o teu nome, para percebermos o que é difícil de usar. Nunca o que escreves nem os teus dados.',
          'A app pergunta uma vez. Mudas quando quiseres em Definições, «Ajudar a melhorar», e desligar apaga o que já foi registado. O que fica registado apaga-se ao fim de 90 dias.',
          'A Política de Privacidade explica tudo numa secção nova, e por isso os termos pedem uma nova aceitação.',
        ],
      },
    ],
  },
  {
    v: 43,
    data: '2026-10-27',
    titulo: 'A app apresenta-se, e o ícone fica cobalto',
    seccoes: [
      {
        titulo: 'Boas-vindas e apresentações',
        afeta: ['app'],
        itens: [
          'Quem cria conta é recebido com uma apresentação do essencial: como se adicionam um imóvel, um inquilino e um contrato, o que são os planeados e de onde vêm, e o que poupam os modelos.',
          'Cada separador explica-se uma vez, na primeira visita depois desta versão: um carrossel curto com o que mostra, como está arrumado e onde se toca. Fecha-se no ✕ ou no «Percebi», e não volta. Se fechares uma antes do fim, a app pergunta se queres continuar a vê-las.',
          'Reveem-se todas na Ajuda, em «Apresentações», onde também as podes marcar todas como vistas. Rever uma até ao fim conta como vista.',
        ],
      },
      {
        titulo: 'Visão geral e filtros',
        afeta: ['app', 'imoveis', 'contratos', 'movimentos', 'creditos', 'partilha'],
        itens: [
          'As entradas e saídas da Visão geral mostram o ano inteiro: os meses que faltam trazem, esbatido, o que os planeados preveem.',
          'O seletor da Visão geral filtra também por proprietário: os teus imóveis, ou os de cada pessoa com quem partilhas.',
          'Nos Contratos, nos Planeados e nos Créditos, o filtro do imóvel tem também os grupos de imóveis, depois dos imóveis.',
          'Tocar num aviso das casas partilhadas abre o imóvel e marca esse aviso como lido.',
          'Nas categorias, o «Fora dos totais» ligado fica a vermelho.',
        ],
      },
      {
        titulo: 'O ícone',
        afeta: ['app'],
        itens: [
          'O ícone da app passou a cobalto, a cor da marca.',
          'No iPhone, para o ver no ecrã principal, remove a app de lá e adiciona-a de novo. Na app Android, descarrega o APK nas Definições e instala por cima.',
        ],
      },
      {
        titulo: 'Pequenas correções',
        afeta: ['app', 'anexos', 'creditos', 'colaboradores', 'movimentos', 'imoveis', 'contratos'],
        itens: [
          'Quando adicionas um imóvel, um contrato, um movimento, uma visita, uma pessoa, uma hipoteca, um planeado ou um modelo, o aviso traz «Ver»: leva-te ao separador e abre o que acabaste de adicionar.',
          'Uma hipoteca que começa no futuro tem o plano de pagamento e a prestação planeada a começar no mês do início, e não hoje.',
          'Os movimentos do mesmo dia ficam pela ordem em que os adicionaste: o mais recente em cima.',
          'No telemóvel, as alterações por enviar mostram-se só no ícone da nuvem, e o cabeçalho deixa de saltar a cada gravação.',
          'Na janela de uma foto, o botão que a leva para o aparelho chama-se «Descarregar».',
          'A taxa de uma hipoteca variável ou mista mostra a soma arredondada: «2,15% + 0,95% = 3,1%», sem casas a mais.',
          'As frases que falam contigo já não presumem o género: «Colaboras com Maria em 3 imóveis», «Tens dispensa dos recibos de renda eletrónicos».',
        ],
      },
    ],
  },
  {
    v: 42,
    data: '2026-10-25',
    titulo: 'Transferir o controlo, e as fotos a chegar',
    seccoes: [
      {
        titulo: 'Transferir o controlo de um imóvel',
        afeta: ['imoveis', 'partilha'],
        itens: [
          'Num imóvel que criaste e que tem comproprietários, podes transferir o controlo na app a um deles: no ⋯ da ficha, ou selecionando vários nas Casas. Quem recebe passa a gerir as partilhas, os colaboradores e o apagar; tu continuas comproprietário, e nada muda nas quotas, nos grupos nem nos outros comproprietários.',
          'Todos os comproprietários têm de aceitar, no sino: o imóvel só passa quando todos aceitarem, e uma recusa faz cair o pedido. Até lá nada muda e podes cancelar. Os teus colaboradores nesse imóvel ficam com o mesmo cargo e passam a ser geridos por quem recebe.',
          'Quem ainda não estiver ligado a quem recebe fica ligado a ele ao aceitar.',
        ],
      },
      {
        titulo: 'Fotos',
        afeta: ['anexos'],
        itens: [
          'O nome de cada foto vê-se inteiro: um nome comprido passa para a linha de baixo, até três linhas.',
          'A arrastar uma foto para a reordenar, perto do topo ou do fundo do ecrã a janela rola sozinha, para a levares a qualquer lugar da lista.',
          'Enquanto as fotos descem noutro telemóvel, cada uma mostra um círculo a rodar até aparecer.',
        ],
      },
    ],
  },
  {
    v: 41,
    data: '2026-10-25',
    titulo: 'Nada se perde numa casa partilhada',
    seccoes: [
      {
        titulo: 'Duas contas na mesma casa',
        afeta: ['partilha', 'imoveis'],
        itens: [
          'Quando duas contas mexem na mesma casa, cada uma só muda o que mudou: as tarefas, as fotos e os campos que a outra adicionou ficam. Se as duas mudarem a mesma coisa, fica a última.',
          'O mesmo vale para os contratos, os movimentos, os planeados, as visitas e as fichas dos inquilinos: os documentos, as chaves e as tarefas que a outra conta adicionou já não desaparecem.',
          'Esta versão é obrigatória: as anteriores ainda gravavam a casa inteira por cima.',
        ],
      },
      {
        titulo: 'Tarefas',
        afeta: ['imoveis', 'contratos'],
        itens: [
          'A lista de tarefas guarda-se de uma vez: marca, adiciona e arruma à vontade, e só o «Guardar» grava. Fechar com alterações pergunta antes de as deitar fora.',
        ],
      },
      {
        titulo: 'Fotos',
        afeta: ['anexos'],
        itens: [
          'Mudar o nome e a ordem das fotos ficou rápido no telemóvel: o campo já não foge do dedo e a foto largada pousa no lugar sem saltos.',
          'Noutro telemóvel, as fotos aparecem depressa: descem só as miniaturas, e a foto inteira só quando a abres.',
        ],
      },
    ],
  },
  {
    v: 40,
    data: '2026-10-17',
    titulo: 'Uma cara nova',
    seccoes: [
      {
        titulo: 'A mesma app, com outra cara',
        afeta: ['app'],
        itens: [
          'Cores novas: o cobalto para o que se carrega, um azul-noite na barra lateral, e o dinheiro com três cores que se distinguem também pela luz — o que entra a verde, o que sai a laranja, as prestações a roxo. O vermelho fica só para o que está em atraso, para os erros e para o que apaga.',
          'Letras novas, que vêm com a app e funcionam sem rede: a Geist no texto e a Bricolage Grotesque nos títulos e nos números grandes.',
          'Cartões com contorno e sem sombra, botões de 44 px, selos retangulares, e o tema escuro redesenhado com as mesmas cores, mais claras.',
          'Um campo que falta diz-o logo por baixo, a vermelho, e não só num aviso em baixo.',
        ],
      },
      {
        titulo: 'Cinco grupos, iguais no telemóvel e no computador',
        afeta: ['app'],
        itens: [
          'O menu passou a ter cinco grupos: Visão geral, Casas (Imóveis, Grupos, Contratos, Pessoas, Visitas), Dinheiro (Movimentos, Planeados, Créditos), Análise (Avaliação, Projeções) e Agenda. Em baixo, as Definições, a Ajuda e a tua conta.',
          'No telemóvel, a barra de baixo é Início, Casas, «+», Dinheiro e Agenda. Casas e Dinheiro abrem com separadores no topo, e lembram-se de onde ficaste.',
          'As Pessoas juntam os Inquilinos e os Proprietários, com um separador para cada.',
        ],
      },
      {
        titulo: '«Criar» e «Pede atenção»',
        afeta: ['app', 'movimentos'],
        itens: [
          'O botão «Criar» (na barra lateral e no «+» do telemóvel) abre uma folha com os cinco tipos de movimento, os teus modelos e os outros registos, com o do ecrã onde estás em primeiro. No computador, o botão principal de cada ecrã fica no cabeçalho («Novo movimento», «Novo contrato», …).',
          'O sino abre «Pede atenção»: o que está por confirmar (confirmas ali mesmo), os prazos legais e fiscais, os pedidos por responder e o que os outros fizeram nas casas partilhadas, com filtros por cima.',
          'O estado da sincronização vive no cabeçalho: Guardado, alterações por enviar, ou sem ligação.',
        ],
      },
      {
        titulo: 'Os ecrãs, um a um',
        afeta: ['app', 'imoveis', 'contratos', 'movimentos', 'creditos', 'partilha', 'conta'],
        itens: [
          'A Visão geral começa pelo que pede atenção, segue com os quatro números do ano, e arruma os gráficos e as contas entre proprietários em filas. Os prazos legais e fiscais mostram os quatro mais urgentes, e o resto está a um toque.',
          'Os Imóveis têm a foto de capa (ou um padrão com cor própria), o estado, três números e o que pede atenção. Os chips de cima filtram num toque, e a pesquisa também encontra os inquilinos. A ficha mostra tudo pela ordem em que se lê, com as ações rápidas por cima.',
          'Os Movimentos têm a pesquisa sempre à vista e chips para o período, o tipo, o imóvel e a categoria. No computador a lista é uma tabela com colunas; marcar uma caixa entra na seleção, e a barra de baixo diz quanto somam os selecionados.',
          'No formulário de um movimento o tipo escolhe-se num toque, o montante é grande, e o «pago por» escolhe-se num toque.',
          'Os Planeados abrem com o que vem de trás para registar de uma vez, os por confirmar (Confirmar, Rever, e o resto no ⋯), chips para filtrar e um selo que diz de onde vem cada um.',
          'Os Créditos mostram a dívida, as prestações e os juros até ao fim, um cartão por hipoteca, e no computador o plano ano a ano ao lado.',
          'O Calendário mostra o mês num cartão, com pontos nos dias com visitas e planeados, e o dia escolhido por baixo (ou ao lado, no computador).',
          'A Avaliação abre com o valor de mercado ao lado do valor por rendimento, as métricas em cartões e uma tabela por imóvel; tocar numa linha abre a avaliação desse imóvel. As Projeções ganharam o mesmo arranjo.',
          'Os Contratos aparecem por imóvel: no telemóvel uma linha por contrato, no computador uma tabela com o período, a renda, o imposto, a líquida e o que falta perante a AT. A ficha abre pelos prazos que pedem decisão (Renovar, Terminar), e «Contrato em PDF» mostra o que vai no documento e o que falta antes de o gerar.',
          'As Pessoas mostram cada inquilino numa linha com as iniciais, onde mora e a renda, e selos só do que importa (renda em atraso, cartão de cidadão a caducar). A ficha de um inquilino lê-se primeiro: onde mora, os contactos (tocas para ligar ou escrever), a identificação e os documentos.',
          'As Visitas separam as próximas das passadas, com o dia num bloco à esquerda e o estado num selo: agendada, realizada ou faltou.',
          'Os primeiros passos de uma conta nova são uma lista: o que já fizeste, o passo de agora com o botão que o faz, e quantos faltam.',
          'Entrar e criar conta, os termos novos, a ajuda, os pedidos ao suporte, as novidades e o tutorial guiado têm a cara nova. Recusar um pedido de partilha deixou de ser um botão vermelho: recusar não apaga nada.',
          'As Definições arrumam-se em Conta, Dinheiro e IRS, e App. As categorias, as etiquetas e as colunas do Anexo F vivem numa página só: Definições → Categorias, etiquetas e IRS. Convidar um colaborador abre uma janela, e o convite pronto mostra-se logo.',
        ],
      },
      {
        titulo: 'Fora da app',
        afeta: ['app', 'suporte'],
        itens: [
          'A página rendorium.com, os Termos e a Privacidade têm a cara nova.',
          'Os emails (o pedido de ajuda recebido, a resposta do suporte e o de repor a palavra-passe) também, e leem-se bem no telemóvel e no tema escuro do email.',
        ],
      },
      {
        titulo: 'Ajustes depois de usar',
        afeta: ['app', 'imoveis', 'contratos', 'movimentos', 'creditos', 'partilha', 'colaboradores', 'anexos'],
        itens: [
          'O plano de amortização de uma hipoteca mostra o primeiro ano mês a mês, prestação a prestação, e depois os anos seguintes somados, um por linha.',
          'As barras da dívida, nos Créditos, leem-se com o dedo, como os gráficos da Visão geral.',
          'Todas as listas filtram como os Movimentos: a pesquisa sempre à vista, os filtros mais usados em chips e o resto no botão ao lado da pesquisa, com o «Limpar» e o «Fechar» no topo. Nos Imóveis, nos Contratos e nos Planeados, o botão do cabeçalho é o «Selecionar vários».',
          'Nos Movimentos, filtras também pelas etiquetas: escolhes várias, e aparece o que tiver pelo menos uma.',
          'Os Colaboradores estão nas Pessoas, ao lado dos Inquilinos e dos Proprietários, com quantos são.',
          'As tarefas arrumam-se melhor: ao adicionar escolhes a secção, ou crias uma ali mesmo; as secções recolhem-se; e arrastas as tarefas pela pega para outra secção ou para entre duas tarefas.',
          'A nuvem do cabeçalho diz se a app está ligada ao servidor: laranja com um relógio enquanto liga, verde quando liga, vermelha com uma cruz sem ligação.',
          'Na ficha de um imóvel, «Movimentos» é o primeiro botão, em destaque e com quantos tem.',
          'No telemóvel, desliza de lado para passar de um separador ao seguinte nas Casas e no Dinheiro: dos Imóveis aos Contratos, dos Movimentos aos Planeados. As abas ficam no sítio, o realce passa de uma para a outra com o dedo, e vês o separador seguinte a entrar.',
          'O Início tem um ícone próprio, de quatro quadrados, e já não se confunde com as Casas. A marca no topo do menu voltou a ser a casa.',
          'Num modelo, o montante é opcional: em branco, escreves o valor quando usares o modelo.',
          'O «Pago por» mostra o nome inteiro de cada proprietário, em chips que passam à linha seguinte quando não cabem.',
          'No calendário, os dias do mês vizinho já não passam por cima da legenda enquanto arrastas.',
          'O fundo da barra lateral, com as Definições, a Ajuda e a tua conta, fica rente ao fundo do ecrã.',
          'O formulário do imóvel já não salta ao passar a uso próprio ou a imóvel inteiro.',
          'A escolha acesa dos seletores (o destino e o tipo do imóvel, o tipo do movimento, o tema) tem um contorno azul, e vê-se também no modo escuro do Samsung Internet.',
          'Na ficha de um imóvel, tocar na foto abre as fotos todas.',
          'Ao ver uma foto de um imóvel, desliza de lado para passar à seguinte; depois da última volta a primeira. No computador há setas.',
          'Marcar uma visita num quarto livre já vem com esse quarto escolhido.',
          'Num imóvel por quartos, a casa inteira ou um quarto arrendado escolhem-se se o contrato começar quando os dos quartos acabam; tocar em «livre a …» põe o início nessa data.',
          'No contrato, um contacto do senhorio com o nome ou o email comprido já não sai da caixa.',
          'O início e o fim de uma visita ficam lado a lado e enchem a linha por igual.',
          'Nos Planeados podes selecionar vários planeados (ou vários modelos) e silenciá-los, reativá-los ou apagá-los de uma vez. Tocar e segurar num deles começa a seleção com ele já marcado, como no resto da app.',
          'O «Selecionar vários» é uma caixa com um visto (☑).',
          'Selecionar vários é igual em toda a app: nos Movimentos, a barra de baixo diz quantos marcaste e mantém o Mudar categoria, as Etiquetas, o Editar e o Apagar.',
          'Os Inquilinos e as Visitas também se selecionam: tocar e segurar começa a seleção. Apagas vários inquilinos de uma vez, e marcas várias visitas como realizadas ou como falta, ou apagas várias.',
          'O cartão do «Anular» que aparece quando apagas alguma coisa desliza para baixo com o dedo, para veres o que está por trás.',
          'No calendário, um cartão «Por confirmar» mostra os planeados do número no ícone da Agenda, e confirmas ali mesmo.',
          'As Projeções e a Avaliação filtram por imóvel num chip, e o horizonte, o aumento das rendas, a inflação e o yield exigido estão na roda dentada do cabeçalho.',
          'Na Avaliação, partilhar e exportar o CSV estão num só botão de partilha, ao lado do chip do imóvel.',
          'A partilha com outras contas passou para Pessoas › Proprietários. Quem já está ligado a ti aparece na lista; por baixo ficam os convites por responder e o campo para ligar. Na ficha de cada um, «Editar casas partilhadas» adiciona e remove casas e propõe novas quotas, e o ⋯ ao lado do X remove a ligação.',
          'Em «Como se chega aos saldos», o movimento mais recente fica no topo e o mais antigo no fundo.',
          'Um menu ⋯ aberto fecha quando rolas a página ou carregas em Escape.',
          'Saiu o «Proprietário em foco»: os valores são sempre por inteiro. Para ver o que é de um proprietário, procura-o na pesquisa dos Imóveis ou abre a ficha dele.',
          'Tocar numa aba ou num botão já não o deixa realçado — nem depois de deslizares para o lado, nem depois de fechares uma janela.',
          'A lista dos Proprietários mostra só as outras contas com quem partilhas — uma casa em comum, uma ligação ou um grupo —, e tu já não apareces nela. Os proprietários deixam de se criar à mão: chegam pela partilha.',
          'Na ficha de outro proprietário, «Editar casas partilhadas» abre onde adicionas e removes as casas que partilhas com ele.',
          'As listas dos Imóveis, Inquilinos, Visitas e Contratos separam o que é teu, o que te partilham e onde colaboras, e o filtro «Origem» mostra só uma dessas partes.',
          'Os Grupos passaram para as Casas, a seguir aos Imóveis, e saíram das Definições. O cartão da tua conta, no fundo do menu, abre o teu perfil.',
          '«Conta e partilha» passou a «Segurança», só com a palavra-passe, as sessões e o apagar da conta. O teu id está agora em Pessoas › Proprietários, ao lado do campo para ligar.',
          'As secções «Os meus…» das listas aparecem sempre com o título, mesmo quando só há casas tuas.',
          'Num grupo de proprietários, o teu nome leva «(eu)» no fim — ao escolher quem adicionar, nos membros do grupo e no cartão dele.',
          'Os grupos selecionam-se como as outras listas: segura um cartão para marcar vários e apagá-los de uma vez. Um toque abre o grupo, e trocar entre Imóveis, Proprietários e Contratos sai da seleção.',
          'Para criar um grupo, usa o + em baixo: «Grupo» deixa-te escolher se é de imóveis, de proprietários, de contratos ou partilhado.',
          'No telemóvel, as janelas fecham-se a puxar para baixo, pela barra ou pelo título. Se tiveres alterações por guardar, a app pergunta primeiro.',
          'As abas das Casas e do Dinheiro têm cada uma a largura do seu nome, e as cinco das Casas cabem no ecrã sem teres de as arrastar para o lado.',
          'Apagar um imóvel em que colaboras tira-o da tua lista e retira as tuas permissões nele. O dono deixa de te ver como colaborador e recebe um aviso. Não se desfaz: para voltares, pedes-lhe um convite novo.',
          'Apagar um imóvel que alguém partilha contigo faz-te deixar de ser comproprietário dele. A tua quota é dividida pelos que ficam, na proporção das quotas deles, e todos recebem um aviso. Para voltares, quem o criou tem de o partilhar contigo outra vez.',
        ],
      },
    ],
  },
  {
    v: 39,
    data: '2026-10-12',
    titulo: 'A Declaração segue as regras de cada ano',
    seccoes: [
      {
        titulo: 'Uma versão das regras do IRS por ano',
        afeta: ['contratos', 'movimentos'],
        itens: [
          'A página Declaração abre com o IRS do ano escolhido: os rendimentos de que ano são, quando se entregam, se o Anexo F desse ano já foi aprovado, e o que mudou nesse ano. Os rendimentos de 2026 já têm as regras de 2026 — marcadas como provisórias até a AT aprovar o modelo da declaração, no início de 2027.',
          'Em baixo, «Como preencher, passo a passo»: do rosto da declaração ao englobamento, com o que é de cada quadro do Anexo F.',
        ],
      },
      {
        titulo: 'As taxas certas para cada contrato',
        afeta: ['contratos'],
        itens: [
          'Desde 2026 as rendas de habitação até 2 300 € por mês pagam 10 % de IRS (Decreto-Lei 97/2026), em contratos novos e antigos, até 2029. A renda líquida, as projeções e a Declaração passam a contar com isso; um contrato longo que já pague menos pela duração fica com a taxa dele.',
          'Um arrendamento não habitacional (uma loja, um escritório, uma garagem à parte) paga 28 %, e não 25 %: escolhe a finalidade na secção Declaração do contrato. A redução pela duração passa a ser só da habitação permanente, conta as renovações registadas, e um contrato começado entre 2019 e outubro de 2023 fica com a taxa do regime desse tempo até renovar.',
          'Na ficha do contrato, o imposto diz porque é o que é: pela duração, renda moderada, não habitacional.',
        ],
      },
      {
        titulo: 'Um resumo do Anexo F mais certo',
        afeta: ['contratos', 'movimentos'],
        itens: [
          'Os contratos de habitação permanente com redução pela duração vão para o quadro 4.2, com as datas que o 4.2A pede; os outros ficam no 4.1.',
          'Os gastos de um imóvel com um contrato declarado e outro não declarado (ou com rendas sem contrato) já não caem todos no declarado: cada contrato leva a sua parte.',
          'Só contam os gastos pagos com o imóvel arrendado — o condomínio de um mês em que a casa estava vazia fica fora, e a página diz quantos ficaram. O IMI e o imposto do selo contam sempre no ano em que o imóvel deu rendas.',
          'Uma renda de um ano anterior recebida este ano aparece à parte, para o quadro 8; e um contrato que começou no ano sem o imposto do selo nos gastos é lembrado, porque é dedutível.',
          'À cabeça, o rendimento líquido e o imposto estimado, à taxa de cada contrato, com as retenções já pagas descontadas.',
        ],
      },
      {
        titulo: 'O contrato diz ao IRS o que as datas não dizem',
        afeta: ['contratos'],
        itens: [
          'Renova um contrato pelo «Renovar…» da ficha e a renovação fica guardada, com o fim novo; mudar a data de fim no formulário pergunta se é uma renovação ou uma correção.',
          'Marca na ficha a comunicação de fevereiro como feita, e o aviso desse ano desaparece.',
          'Indica a isenção do contrato (PAA, RSAA, programas municipais) e, nos contratos desde 2024, se a renda passa o limite do concelho ou é mais baixa do que a do contrato anterior — a taxa estimada acompanha.',
          'Com o RSAA, a app lembra o envio ao IHRU até 15 de janeiro; com a dispensa dos recibos eletrónicos, lembra o Modelo 44.',
        ],
      },
      {
        titulo: 'A Declaração sabe a tua situação',
        afeta: ['contratos', 'movimentos'],
        itens: [
          'Diz no cartão «A tua situação» se entregas em conjunto (e quem é o titular A ou B) e se tens dispensa dos recibos: cada linha mostra o titular, e as Obrigações ganham o Modelo 44.',
          'Os quadros 4.2B, 4.2C, 6D e 9 (AIMI) aparecem quando se aplicam, e o 4.2A diz contrato a contrato se a comunicação de fevereiro foi feita.',
          'Escreve os outros rendimentos do agregado e a página simula se compensa englobar as rendas.',
        ],
      },
      {
        titulo: 'Listas de tarefas nos imóveis e nos contratos',
        afeta: ['imoveis', 'contratos'],
        itens: [
          'A ficha de um imóvel e a de um contrato têm agora «Tarefas»: o que há para fazer nele, arrumado em secções (Obras, Documentos, o que quiseres), com cada tarefa marcada como cumprida ou por cumprir.',
          'Na lista pesquisas pelo nome da tarefa ou da secção, e filtras pela secção e pelas que estão por cumprir ou já cumpridas.',
        ],
      },
      {
        titulo: 'Selecionar movimentos sem a lista saltar',
        afeta: ['movimentos'],
        itens: [
          'Ao selecionar vários movimentos, a contagem e o «marcar tudo» vão para o cabeçalho, e a lista fica onde estava.',
        ],
      },
    ],
  },
  {
    v: 38,
    data: '2026-09-13',
    titulo: 'A app passa a ser feita de serviços',
    seccoes: [
      {
        titulo: 'Um grupo de casas partilha-se como grupo',
        afeta: ['partilha', 'imoveis'],
        itens: [
          'No separador Grupos, cada grupo de imóveis que já tens tem o botão «Partilhar» — ou cria-se um novo. Se um grupo ainda não se pode partilhar (está vazio, ou os imóveis são de outra pessoa), a app diz porquê e leva-te a editá-lo. Quem está no grupo é comproprietário de todas as casas dele — vê e edita contratos, movimentos e pessoas, e entra nas quotas — e uma casa que entre no grupo mais tarde chega logo a toda a gente. Antes partilhava-se casa a casa.',
          'Entra-se por uma ligação do dono do grupo, que vale sete dias e serve várias pessoas — mas ninguém entra sem o dono aceitar. Quem abre a ligação pede para entrar; o pedido aparece ao dono em «Pedidos por responder», no sino e na janela do grupo, com Aceitar e Recusar. Uma ligação enviada à pessoa errada já não dá acesso a nada.',
          'O dono vê quem entrou, remove, roda ou desativa a ligação, e apaga o grupo (as casas ficam). Cada membro pode adicionar ao grupo casas suas, e removê-las; ao sair do grupo, as casas que adicionou são removidas dele. O cartão «Grupos partilhados», no cimo do separador Grupos, lista os teus, os em que entraste e os pedidos à espera; o separador leva no menu quantos pedidos esperam a tua resposta.',
        ],
      },
      {
        titulo: 'O menu lateral arruma-se em secções que se recolhem',
        afeta: ['app'],
        itens: [
          'Património, Pessoas, Finanças e Análise passam a recolher-se com um toque no título, e a app lembra-se do que deixaste recolhido neste aparelho. A secção onde estás abre-se sozinha, e uma secção recolhida mostra no título os avisos que tem lá dentro.',
          'A Visão geral e o Calendário ficam ao cimo, sem secção, e as Definições ao fundo. Os Grupos saíram das Definições e passaram a separador próprio, em Património, ao lado dos Imóveis.',
          'Há uma secção nova, Análise, com as Projeções e a Avaliação. As Finanças ficam com os Movimentos, os Planeados, os Créditos e a Declaração. A Avaliação e a Declaração ganharam ícones próprios.',
        ],
      },
      {
        titulo: 'Os formulários dizem o que é obrigatório',
        afeta: ['app', 'imoveis', 'contratos', 'movimentos', 'conta'],
        itens: [
          'Em todos os formulários, os campos que não podem ficar em branco têm um asterisco vermelho — o nome de um grupo, de um imóvel, de uma pessoa, a renda, o montante de um movimento. Os outros dizem «Opcional».',
          'Os exemplos dentro dos campos começam por «Ex: » e são exemplos a sério; o que antes era uma instrução dentro do campo passou para o rótulo ou para uma nota por baixo, e os valores que contam quando deixas em branco (o imposto, o aumento, o prazo da hipoteca) estão escritos.',
          'O ecrã de entrar e de criar conta tem os nomes dos campos à vista, em vez de desaparecerem ao escrever.',
          'O capital em dívida de uma hipoteca passa a ser pedido também ao editar.',
        ],
      },
      {
        titulo: 'Os gráficos leem-se no canto, sem tapar o desenho',
        afeta: ['app'],
        itens: [
          'Ao percorrer um gráfico com o dedo, os valores da coluna aparecem num cartão fixo no canto de baixo, à direita, ao lado da legenda — já não tapam as barras mais altas. O cartão não muda de tamanho de mês para mês, e os nomes compridos (de um crédito, por exemplo) levam reticências sem cortar o valor.',
        ],
      },
      {
        titulo: 'O calendário arrasta-se e planeia',
        afeta: ['movimentos'],
        itens: [
          'O mês do calendário arrasta-se para os lados com o dedo (ou com o rato): o mês anterior e o seguinte espreitam enquanto arrastas, e um gesto rápido ou um quarto do caminho chegam para virar a página.',
          'O dia escolhido no calendário tem o botão «Adicionar movimento recorrente», com a primeira vez já nesse dia.',
        ],
      },
      {
        titulo: 'Selecionar vários movimentos desliza',
        afeta: ['movimentos'],
        itens: [
          'Ao segurar num movimento, o mês desliza para o meio do título e as caixas de marcar aparecem a desvanecer; ao cancelar, tudo volta ao sítio pelo mesmo caminho.',
        ],
      },
      {
        titulo: 'Um movimento de vários imóveis fica em cada imóvel',
        afeta: ['movimentos', 'partilha'],
        itens: [
          'Um movimento de um grupo de imóveis, ou de «Todos os imóveis», passa a ser guardado em partes, uma por imóvel, com a divisão que escolheste. Cada parte vive no seu imóvel, e por isso quem partilha esse imóvel contigo vê-a — nos movimentos, nos totais e nas contas entre proprietários. Antes ficava só contigo, e as contas de cada um não batiam certo.',
          'Na lista continua a ser uma linha só, com o total e «dividido por N imóveis»; com o filtro num imóvel, vês a parte dele e o total. Editar ou apagar mexe no movimento inteiro.',
          'As contas já gravadas deixam de mudar quando um grupo ganha ou perde um imóvel. Os movimentos de grupo que já tinhas partem-se sozinhos da próxima vez que abrires a app, com os mesmos valores.',
        ],
      },
      {
        titulo: 'A vista geral começa pela jornada',
        afeta: ['app'],
        itens: [
          'Enquanto não tens movimentos, a vista geral mostra a jornada — os primeiros passos numa fita, com o passo em que estás em destaque e o botão dele — e o portefólio quando já há imóveis, em vez de quatro indicadores a 0 € e dois gráficos vazios. O primeiro movimento traz os números.',
          'A jornada aparece também sem conta; com conta, o passo do perfil entra.',
        ],
      },
      {
        titulo: 'O movimento diz quem és e pode ficar sem imóvel',
        afeta: ['movimentos'],
        itens: [
          'Ao registar um movimento com mais do que um proprietário à escolha, o teu nome leva «(eu)» no fim — em «Pago por», «Recebido por», «Quem paga», «Quem recebe» e na divisão entre proprietários.',
          '«Todos os imóveis» e «Sem imóvel» passam a ser duas opções. «Todos os imóveis» divide o valor pelos imóveis que tinhas na data do movimento, e conta na avaliação de cada um. «Sem imóvel» conta só nos totais da vista geral, nunca num imóvel, e deixa de aparecer quando filtras os movimentos por um imóvel. Os movimentos sem imóvel que já tinhas ficam «Sem imóvel», e nenhum número muda.',
          'Num acerto entre proprietários, «Todos os imóveis» continua a ser o acerto de todas as contas.',
        ],
      },
      {
        titulo: 'Cada separador é um serviço',
        afeta: ['app'],
        itens: [
          'Por dentro, cada separador da barra lateral — imóveis, contratos, movimentos, planeados, visitas, pessoas, colaboradores, créditos, calendário, projeções, avaliação e declaração — passou a ser um serviço com manifesto próprio. As Definições e os Grupos são a base. Para ti nada muda: os mesmos ecrãs, no mesmo sítio.',
          'O suporte pode ligar ou desligar um serviço a uma conta. Um serviço desligado sai do menu e os seus dados ficam guardados no servidor, à espera de o voltar a ligar; nada se apaga.',
          'Se chegares a um separador desligado por um atalho antigo, a app diz-te o nome do serviço e que o suporte o liga — em vez de dar erro.',
        ],
      },
      {
        titulo: 'Quem colabora vê logo o que pode fazer',
        afeta: ['colaboradores'],
        itens: [
          'A visão geral de quem colabora abre com «O que podes fazer»: um botão por cada coisa que o cargo deixa — marcar visita, adicionar inquilino, novo contrato, registar movimento, confirmar planeados, editar a ficha — e as próximas visitas.',
          'No telemóvel, a barra de baixo dá o lugar dos separadores que o cargo não abre aos que abre: um gestor de visitas tem as Visitas a um toque.',
          'A ficha do imóvel diz o que podes fazer nele e tem os botões; já não diz «só de leitura» a quem a pode editar. O cartão do imóvel, o menu ⋯ e «Imóveis onde colaboras» dizem o mesmo.',
          'Quem marca visitas tem nos primeiros passos «Marca a primeira visita», com o tutorial.',
          'Os Movimentos e os Planeados já não aparecem vazios a quem só vê hipotecas ou valores.',
        ],
      },
      {
        titulo: 'O IMI, o condomínio e o seguro vivem na ficha do imóvel',
        afeta: ['imoveis', 'movimentos'],
        itens: [
          'A ficha do imóvel ganhou «Despesas fixas do imóvel»: o IMI anual, a quota mensal do condomínio e o seguro anual. Cada valor cria sozinho um planeado que te pede confirmação na data — como a renda de um contrato e a prestação de uma hipoteca já faziam.',
          'O IMI sai nas prestações da lei: até 100 € numa só, em maio; de 100 a 500 € em maio e novembro; acima de 500 € em maio, agosto e novembro. O condomínio no dia 1 de cada mês; o seguro uma vez por ano, no mês que escolheres.',
          'As Projeções deixaram de adivinhar as despesas pelo histórico: uma obra de 5 000 € aparecia como se voltasse todos os anos. Agora contam os planeados de despesa (os da ficha e os que marcaste) a crescer com a inflação, e o IRS sobre as rendas à taxa de cada contrato — contado no ano das rendas, pago até 31 de agosto do ano seguinte.',
          'A página diz quanto gastaste no último ano em despesas de uma vez (obras, reparações), que não se projetam. A vista geral e a Avaliação continuam a somar todas as despesas.',
          'Mudar o nome a uma categoria já não a devolve aos totais nem lhe perde a coluna do IRS, e já não se pode dar a uma categoria o nome de outra.',
        ],
      },
      {
        titulo: 'Um + a meio da barra de baixo',
        afeta: ['app'],
        itens: [
          'No telemóvel, o botão redondo do canto deu lugar a uma tecla + em relevo a meio da barra de baixo, sempre no mesmo sítio. Abre a lista do que podes adicionar — movimento, imóvel, contrato, inquilino, visita, planeado, hipoteca — com a ação do ecrã onde estás em primeiro; quem colabora vê só o que o cargo lhe dá.',
          'No ecrã largo o botão do canto fica como estava.',
          'Cada lista vazia — imóveis, movimentos, inquilinos, proprietários, planeados, modelos, hipotecas, contratos — tem agora o botão verde da sua ação, como a vista geral já tinha, em vez de contar só com o botão do canto.',
        ],
      },
      {
        titulo: 'A partilha com portas à vista',
        afeta: ['partilha', 'colaboradores'],
        itens: [
          'Um pedido de partilha ou um convite de ligação que recebas aparece no topo da vista geral — mesmo numa conta acabada de criar — em «Pedidos por responder», com Aceitar e Recusar ali mesmo. Antes só se via em Definições → Conta e partilha.',
          'Ao escolher uma casa para partilhar com outro proprietário, as quotas de cada um definem-se na própria escolha, e a proposta de divisão segue logo com a partilha; ficam em partes iguais até o outro confirmar. Antes a pergunta só vinha depois, casa a casa.',
          'Em Colaboradores, quando ainda não há imóveis (ou cargos), o botão para os criar está ali — e sem imóveis o cartão «Colaboradores», que mandava criar uma ligação de convite que ainda não se pode criar, deixa de aparecer.',
        ],
      },
      {
        titulo: 'Um movimento de grupo mostra a parte, não o total',
        afeta: ['movimentos', 'partilha'],
        itens: [
          'Um movimento de um grupo de imóveis, visto com o filtro num imóvel do grupo ou num proprietário, mostrava o valor inteiro. Agora a lista mostra a parte que cabe a essa vista — e diz «parte de <grupo> · total …» — e o saldo do mês, os indicadores e a ordenação por montante contam a parte.',
          'A divisão entre os imóveis de um grupo e entre proprietários foi confirmada modo a modo. Dois arredondamentos corrigidos: a parte de um dono sem divisão escolhida podia diferir um cêntimo da ficha, e uma divisão «por valor» com valores acima do total somava um cêntimo a mais.',
        ],
      },
      {
        titulo: 'Os formulários dizem o que é opcional',
        afeta: ['app'],
        itens: [
          'Nos formulários, cada campo de texto que podes deixar em branco diz «Opcional»; onde o campo já mostrava um exemplo do formato (o IBAN, o NIF, o código postal), o exemplo fica e o rótulo diz «(opcional)». Os obrigatórios levam o asterisco.',
          'No iPhone, um campo de data vazio mostra «dd/mm/aaaa» em vez de ficar em branco — no Android e no Chrome já era assim.',
        ],
      },
      {
        titulo: 'Correções que se sentem',
        afeta: ['app'],
        itens: [
          'Com a conta iniciada, voltaram duas portas que tinham desaparecido das Definições: Definições → Filtros comuns e Definições → IRS e dedução.',
          'O que fizeres sem rede — um movimento novo, uma edição, uma remoção — sobrevive ao arranque seguinte e sobe quando a rede voltar. A primeira leitura do servidor chegava a passar-lhe por cima.',
          'Quando o servidor recusa um envio por estar ocupado, o selo fica em «por enviar» e diz-te o que ele respondeu, em vez de «Sem ligação».',
          'Os CSV abrem no Excel com os acentos certos, e uma célula que comece por = já não é lida como fórmula.',
          'Nos menus de escolha, as setas, o Home e o End andam pelas opções, e o Escape fecha só a lista.',
          'No iPhone, a app instalada pelo Safari passa a chamar-se Rendorium debaixo do ícone.',
        ],
      },
      {
        titulo: 'Contratos, visitas e rendas',
        afeta: ['contratos', 'movimentos', 'imoveis'],
        itens: [
          'O contrato em PDF deixou de ter cláusulas inventadas: sem dia de pagamento, sem rendas antecipadas ou sem IBAN, a frase que precisava delas sai; sem início, fim, senhorio ou morada, a app diz o que falta em vez de gerar o PDF.',
          'A renda do primeiro mês já não é dada como lançada só por haver a caução registada nesse mês — e uma renda paga no mês seguinte conta para o mês a que respeita.',
          'O menu do toque longo de uma visita agendada volta a abrir.',
          'No calendário e nos prazos, tocar num aviso abre a ficha do registo, para leres antes de editares.',
        ],
      },
      {
        titulo: 'Créditos e declaração',
        afeta: ['creditos', 'contratos', 'movimentos'],
        itens: [
          'O capital em dívida de uma hipoteca passa a sair do capital da data de início e dos pagamentos registados: dois aparelhos a gravar ao mesmo tempo já não o deixam errado.',
          'A amortização abre-se nos Créditos mesmo sem os Movimentos, e o fim da taxa fixa tem uma data só — a mesma no aviso e na simulação.',
          'O botão «Nova hipoteca» só aparece a quem pode criar uma, e só lista os imóveis onde pode.',
          'Na Declaração, as obras dos 24 meses antes de um contrato entram no primeiro ano em que ele tem rendas.',
        ],
      },
      {
        titulo: 'Conta, partilha e pedidos',
        afeta: ['conta', 'partilha', 'suporte'],
        itens: [
          'Errar a palavra-passe atual ao mudá-la já não te põe fora da conta.',
          'A sessão passa a viver num cookie protegido, que nenhum script da página consegue ler. Se o teu browser bloquear os cookies deste site, vais ter de entrar de cada vez que abrires a app.',
          'Num aparelho partilhado, a ligação de partilha de uma conta já não fica à vista de quem entrar a seguir.',
          'Se a lista dos teus pedidos de ajuda não carregar, a app diz-to e dá-te um botão para tentares de novo — em vez de dizer que nunca enviaste nenhum.',
        ],
      },
    ],
  },
  {
    v: 37,
    data: '2026-09-12',
    titulo: 'O IRS deixa de ser uma promessa',
    seccoes: [
      {
        titulo: 'Declaração: o Anexo F, linha a linha',
        afeta: ['app', 'contratos', 'movimentos'],
        itens: [
          'Há uma página nova, Declaração, em Finanças. Por cada ano e por cada proprietário, mostra as linhas do quadro 4.1 do Anexo F tal como a AT as pede: o contrato, o imóvel, os inquilinos, as rendas e as retenções na fonte.',
          'Os gastos do imóvel aparecem já repartidos pelas colunas do Anexo F — conservação, condomínio, IMI, selo, taxas e outros — a partir da categoria de cada despesa.',
          'As obras feitas nos 24 meses antes de o contrato começar, com a casa vazia, ficam à parte: são a coluna própria que o Anexo F lhes reserva.',
          'O que ainda falta para a declaração — um NIF, o código da freguesia, um estado por indicar — fica apontado linha a linha, em vez de se descobrir no Portal das Finanças.',
          'Podes exportar o resumo em CSV ou em texto, para o contabilista ou para ti.',
        ],
      },
      {
        titulo: 'O contrato diz o que é perante a AT',
        afeta: ['contratos'],
        itens: [
          'Cada contrato tem agora um estado perante a AT, com três respostas: por indicar, declarado, ou não declarado. A escolha é tua.',
          'Um contrato não declarado fica fora do resumo do Anexo F e dos prazos da AT, listado à parte, sem mais. A app não julga nem lembra.',
          'Um contrato declarado guarda o número que a AT lhe deu, a finalidade, a data de celebração e as renovações — o que o Modelo 2 e o quadro 4.2A do Anexo F pedem.',
        ],
      },
      {
        titulo: 'Imóveis e pessoas com o que a AT pergunta',
        afeta: ['imoveis', 'contratos'],
        itens: [
          'A ficha do imóvel ganha o código da freguesia, o tipo de prédio, a tipologia, o valor patrimonial tributário e a data de aquisição. É o que identifica o prédio no Anexo F.',
          'A ficha de uma pessoa ganha o país, para quem não tem NIF português, e a marca de reter na fonte, para os inquilinos que são empresas.',
          'Um NIF que não bate certo com o dígito de controlo avisa logo ao escrever, antes de ir para o contrato ou para a declaração.',
        ],
      },
      {
        titulo: 'Os movimentos sabem de IRS',
        afeta: ['movimentos'],
        itens: [
          'Uma renda pode dizer a que mês respeita e quanto o inquilino reteve na fonte — o que entrou e a renda ilíquida deixam de se confundir.',
          'Numa renda de contrato declarado marcas se o recibo eletrónico já foi emitido. Enquanto não estiver, a app lembra-te.',
          'Numa despesa podes escolher à mão a coluna do Anexo F, quando a categoria não chega. Essa escolha manda sobre a regra geral.',
        ],
      },
      {
        titulo: 'Os prazos da AT',
        afeta: ['app', 'contratos'],
        itens: [
          'Um contrato por indicar lembra o Modelo 2 até ao fim do mês seguinte ao início — e diz como calar o aviso: marca-o como declarado, ou como não declarado, na ficha.',
          'Um contrato declarado que terminou lembra a cessação, até ao fim do mês seguinte ao fim.',
          'As rendas dos últimos três meses sem recibo eletrónico avisam até ao fim do mês seguinte, e abrem o movimento para o marcares.',
          'De 1 de abril a 30 de junho, o aviso do IRS leva-te à página Declaração com o Anexo F do ano anterior.',
          'Nos contratos declarados com taxa reduzida, o 15 de fevereiro avisa a tempo de comunicar a duração e as renovações. Sem isso perde-se a redução.',
        ],
      },
      {
        titulo: 'IRS e dedução, nas Definições',
        afeta: ['app', 'movimentos'],
        itens: [
          'Em Definições → Categorias, etiquetas e IRS dizes em que coluna do Anexo F cai cada categoria e subcategoria de pagamentos, com o que o artigo 41.º do CIRS deixa deduzir explicado em poucas linhas.',
          'As regras de origem já separam o que a lei deixa de fora — juros, mobiliário, eletrodomésticos, beneficiações — e podes repô-las quando quiseres.',
        ],
      },
    ],
  },
  {
    v: 36,
    data: '2026-09-12',
    titulo: 'A app volta a abrir para quem já a tinha',
    seccoes: [
      {
        titulo: 'O erro ao abrir a app',
        afeta: ['app'],
        itens: [
          'Quem já tinha usado a app neste aparelho podia dar com a página «Não é possível aceder a este site» ao abri-la. O defeito estava na forma como a app se guarda para abrir sem rede, e não nos teus dados: nada se perdeu.',
          'Se a app deste aparelho ainda mostrar esse erro, recarrega a página: a versão corrigida instala-se sozinha.',
        ],
      },
    ],
  },
  {
    v: 35,
    data: '2026-09-12',
    titulo: 'A barra de baixo passa a vidro',
    seccoes: [
      {
        titulo: 'Vidro por cima da página',
        afeta: ['app'],
        itens: [
          'No telemóvel, a barra de baixo passa a ser de vidro, como o cabeçalho: deixa ver, desfocado, o que vai passando por baixo. E os dois deixam atravessar as cores vivas, em vez de acinzentadas.',
          'A linha por baixo do cabeçalho só aparece quando já desceste na página. No topo não há nada por baixo dela para separar.',
        ],
      },
      {
        titulo: 'E segue o que pediste ao aparelho',
        afeta: ['app'],
        itens: [
          'Se pediste menos transparência nas definições do aparelho, o cabeçalho e a barra de baixo ficam sólidos.',
          'Se pediste mais contraste, as linhas que separam cartões, listas e campos ficam mais marcadas.',
        ],
      },
    ],
  },
  {
    v: 34,
    data: '2026-09-11',
    titulo: 'A app mexe-se melhor, e arranca mais segura',
    seccoes: [
      {
        titulo: 'As janelas fecham-se, em vez de desaparecerem',
        afeta: ['app'],
        itens: [
          'Uma janela — um formulário, a ficha de um registo, uma pergunta — entrava a deslizar e depois desaparecia de repente. Agora sai como entrou: desvanece-se, e no telemóvel desce por onde tinha subido.',
          'O painel dos filtros passa a abrir-se a partir do botão, como os outros menus, e fecha-se sozinho quando mudas de ecrã — deixou de ficar aberto por cima da lista quando voltavas. Os filtros que escolheste continuam lá; o que se fecha é só o painel.',
          'O botão de voltar ao topo aparece e sai a desvanecer, em vez de surgir e sumir de repente a meio da página a deslizar.',
        ],
      },
      {
        titulo: 'O calendário deixou de saltar',
        afeta: ['app'],
        itens: [
          'Tocar noutro dia trocava o cartão do que está marcado de um instante para o outro, e tudo o que estava por baixo saltava com ele. Agora o cartão cresce ou encolhe até ao tamanho do dia que escolheste.',
          'Ao mudar de mês, os dias viram a página para o lado a que foste e o cartão cresce para acolher o mês novo — incluindo os meses que precisam de uma sexta semana, que antes davam um salto.',
        ],
      },
      {
        titulo: 'E arranca mais segura',
        afeta: ['app'],
        itens: [
          'Quando a app se repara sozinha depois de um arranque falhado, passa a confirmar primeiro que há rede. Sem rede, o que está guardado no aparelho é a única cópia que existe, e apagá-la deixava-te sem app nenhuma até a ligação voltar.',
          'O aviso de atualização voltou a aparecer a quem está no ecrã de entrada — que é precisamente quem mais precisa dele, se ficou preso por causa de um erro entretanto corrigido.',
          'Uma atualização só entra quando chega inteira, e as duas primeiras leituras ao servidor passaram a partir ao mesmo tempo: a app fica pronta um pouco mais cedo.',
        ],
      },
    ],
  },
  {
    v: 33,
    data: '2026-09-09',
    titulo: 'Dois defeitos de ecrã grande',
    seccoes: [
      {
        titulo: 'As janelas deixaram de aparecer por trás do menu',
        afeta: ['app'],
        itens: [
          'Em ecrã grande, onde o menu lateral está sempre à vista, as janelas — confirmar um movimento, as novidades, adicionar um registo — apareciam por trás dele: o título ficava cortado e metade do conteúdo escondido. Agora ficam por cima, e o menu escurece enquanto a janela está aberta.',
        ],
      },
      {
        titulo: 'E o botão do menu deixou de trancar a página',
        afeta: ['app'],
        itens: [
          'Num telemóvel ou tablet a pedir a versão para computador, aparecia um botão de menu que não abria nada — e que deixava a página sem se poder deslizar. Nesses ecrãs o menu já está à vista, portanto o botão deixou de existir.',
        ],
      },
    ],
  },
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
          'A prestação segue a divisão que escolheste no planeado: quem paga e por quem se divide passam para o movimento como estão.',
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
        titulo: 'Se colaboras',
        afeta: ['colaboradores'],
        itens: [
          'Ao entrar, a app diz com quem colaboras, em que imóveis e com que cargo. Os cartões desses imóveis levam o selo «de Maria · Contabilista», e a vista geral avisa que os inclui, por inteiro.',
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
var VERSAO_MINIMA = 41;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AVISOS: AVISOS, VERSAO: VERSAO, VERSAO_MINIMA: VERSAO_MINIMA, FUNCIONALIDADES: FUNCIONALIDADES };
}
