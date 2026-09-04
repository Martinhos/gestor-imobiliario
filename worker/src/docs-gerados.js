// GERADO por scripts/gerar-docs.js — não editar à mão; corre no deploy.
export const DOCS = {
 "geradoEm": "local",
 "comandos": [
  {
   "nome": "pedidos",
   "descricao": "Pedidos de ajuda por tratar",
   "quem": "admin, dev, suporte (e master)"
  },
  {
   "nome": "pedido",
   "descricao": "Ver um pedido e agir sobre ele",
   "quem": "admin, dev, suporte (e master)"
  },
  {
   "nome": "responder",
   "descricao": "Responder e marcar como em resolução",
   "quem": "admin, dev, suporte (e master)"
  },
  {
   "nome": "fechar",
   "descricao": "Marcar um pedido como concluído",
   "quem": "admin, dev, suporte (e master)"
  },
  {
   "nome": "erros",
   "descricao": "Erros recentes da aplicação",
   "quem": "dev (e master)"
  },
  {
   "nome": "uso",
   "descricao": "Consumo da infraestrutura agora",
   "quem": "admin (e master)"
  },
  {
   "nome": "comandos",
   "descricao": "O que podes fazer com o teu papel",
   "quem": "admin, dev, suporte (e master)"
  },
  {
   "nome": "entrar",
   "descricao": "Abrir a ferramenta de suporte no browser",
   "quem": "admin, dev, suporte (e master)"
  },
  {
   "nome": "docs",
   "descricao": "Como isto funciona por dentro (gerado do código)",
   "quem": "admin, dev, suporte (e master)"
  },
  {
   "nome": "test",
   "descricao": "Ligação temporária para o ambiente de teste, numa conta lavada",
   "quem": "dev, suporte (e master)"
  },
  {
   "nome": "access",
   "descricao": "Quem pode que comandos (só o master)",
   "quem": "só o master"
  },
  {
   "nome": "copias",
   "descricao": "Cópias da base de dados no R2",
   "quem": "admin (e master)"
  },
  {
   "nome": "resumo",
   "descricao": "Enviar o resumo diário para o canal de administração",
   "quem": "admin (e master)"
  }
 ],
 "capitulos": [
  {
   "titulo": "O worker",
   "nota": "O servidor: API, Discord, correio, landing e o ambiente de teste.",
   "itens": [
    {
     "nome": "acessos.js",
     "texto": "Acessos dados ou retirados a uma pessoa em concreto.\r\n\nO papel continua a ser a regra: é dele que vem quase tudo, e é o que se\r\ngere no Discord com cargos. Isto é a exceção — dar a alguém um comando que\r\no papel não dá, ou tirar-lhe um que dá, sem ter de inventar um cargo novo\r\npara uma pessoa só.\r\n\nAs exceções vivem no KV e são lidas em cada interação. São poucas por\r\nnatureza: se um dia forem muitas, isso quer dizer que falta um cargo, não\r\nque falta espaço aqui."
    },
    {
     "nome": "api.js",
     "texto": "API REST do Rendorium.\n\nModelo de dados: cada utilizador é dono das suas casas; os registos\n(inquilinos, contratos, movimentos, ...) pertencem a uma casa. Um utilizador\npode ligar-se a outro através do id curto e, dentro dessa conexão, cada um\nescolhe que casas partilha. Casas partilhadas são visíveis e editáveis pelo\noutro utilizador; apagar a casa ou gerir a partilha é só do dono.\n\nEste ficheiro é só o encaminhador: monta o contexto, corre as rotas por\nordem e devolve a primeira resposta. Cada área vive no seu módulo, em\nrotas/, e os ajudantes partilhados em lib/."
    },
    {
     "nome": "auth.js",
     "texto": "Autenticação: hash de palavras-passe (PBKDF2 via WebCrypto) e sessões em KV."
    },
    {
     "nome": "discord.js",
     "texto": "Bot do Discord, alojado no próprio worker: o Discord envia as interações\npor HTTP e nós respondemos. Duas vistas — quem programa trata dos pedidos\ne dos erros, quem opera vê o consumo da infraestrutura."
    },
    {
     "nome": "docs-gerados.js",
     "texto": "GERADO por scripts/gerar-docs.js — não editar à mão; corre no deploy."
    },
    {
     "nome": "docs-vista.js",
     "texto": "A documentação da casa, servida em /equipa/docs.\r\n\nNão se escreve documentação aqui: ela vem do próprio código — o\r\ncomentário de abertura de cada ficheiro, extraído no deploy pelo\r\nscripts/gerar-docs.js. Se um ficheiro muda e o cabeçalho muda com ele,\r\na página muda no deploy seguinte, sem ninguém se lembrar de nada.\r\n\nÉ da equipa: pede a mesma sessão que o resto do /equipa."
    },
    {
     "nome": "equipa-api.js",
     "texto": "O que a ferramenta de equipa pode fazer.\r\n\nAs mesmas regras do bot, pelos mesmos papéis: o suporte vê os pedidos\r\ncontados por pessoas, quem programa vê os erros, quem opera vê as\r\nmáquinas — e nenhum vê o canto dos outros. A diferença é a forma: aqui\r\nprocura-se e navega-se, que é o que um canal de Discord não sabe fazer.\r\n\nNada aqui devolve dados de imóveis, contratos ou movimentos. Quem faz\r\nsuporte precisa de saber com quem fala e o que essa pessoa escreveu, não\r\nde lhe ver as contas.\r\n\nDesde que isto ganhou poderes de escrita, vale uma regra sem exceções:\r\ntoda a ação que muda alguma coisa escreve primeiro no audit_log. Nas\r\nações sobre contas é mesmo primeiro — se o rasto não se conseguir\r\nescrever, a ação não acontece. Mexer numa conta sem deixar registo é o\r\ngénero de atalho que só se nota quando já ninguém sabe o que se passou."
    },
    {
     "nome": "equipa-vista.js",
     "texto": "A página da ferramenta de equipa.\r\n\nServida pelo worker e não pelos ficheiros da app: quem faz suporte não\r\ncarrega a aplicação de quem a usa, nem partilha código com ela. São duas\r\ncoisas com públicos diferentes, e mantê-las separadas evita que um dia\r\numa sessão de equipa consiga chamar alguma coisa da outra.\r\n\nÉ uma página escrita à mão, sem dependências. Cresceu de fila de pedidos\r\npara back office — pedidos, erros, pessoas, operação e rasto — mas o\r\nprincípio mantém-se: uma ferramenta usada por meia dúzia de pessoas não\r\njustifica mais do que isto."
    },
    {
     "nome": "equipa.js",
     "texto": "Sessões de quem trabalha no serviço.\r\n\nEntra-se a partir do Discord e mais lado nenhum. Quem faz suporte corre\r\n/entrar no servidor, o bot responde com uma ligação de uso único, e essa\r\nligação cria a sessão. Não há botão de \"entrar com Discord\" no ecrã de\r\nquem usa a app, nem sequer uma página onde tentar.\r\n\nPorquê assim e não por OAuth: a interação do Discord já traz quem é\r\n(i.member.user.id) e que cargos tem (i.member.roles), assinada com a\r\nchave do Discord. Um OAuth pediria à pessoa uma autorização para saber o\r\nque o bot já sabe, e obrigaria a expor um endereço de entrada.\r\n\nA sessão de equipa é deliberadamente separada da de quem usa a app: outro\r\ncookie, outro espaço no KV, outra função de leitura. Nenhuma das duas se\r\npode fazer passar pela outra."
    },
    {
     "nome": "files.js",
     "texto": "Anexos: o conteúdo vive no R2, os metadados na D1. Quem pode ver um anexo\né quem pode ver a casa a que ele pertence; enquanto não estiver guardado\nnuma casa, só quem o carregou."
    },
    {
     "nome": "index.js",
     "texto": "Worker do Rendorium (nome interno: gestor-imobiliario): /api/* vai para a API (D1 + KV);\ntudo o resto é servido pelos assets estáticos (a PWA em web/)."
    },
    {
     "nome": "landing.js",
     "texto": "A página de entrada do rendorium.com.\n\nServida pelo worker quando o pedido chega pelo domínio raiz (ou www) —\na app vive em app.rendorium.com e não se mistura. É uma página escrita à\nmão, sem dependências, com a mesma cara da app: quem clica em \"Abrir a\napp\" não pode sentir que mudou de produto.\n\nO Rendorium é um projeto pessoal, sem planos nem pagamentos — a página\ndiz o que a ferramenta faz e mais nada. As funcionalidades vivem num\ncarrossel: no telemóvel desliza-se, no computador há setas e pontos."
    },
    {
     "nome": "notify.js",
     "texto": "Avisos para o Discord: um canal para quem programa (pedidos e erros) e\noutro para quem opera (consumo da infraestrutura). Sem webhook configurado,\ntudo isto não faz nada — a app funciona à mesma."
    },
    {
     "nome": "oauth.js",
     "texto": "Verificação de ID tokens (JWT RS256) do Google e da Apple, sem dependências:\nvai buscar as chaves públicas (JWKS) do fornecedor, valida a assinatura com\nWebCrypto e confere emissor, audiência e validade."
    },
    {
     "nome": "salvaguarda.js",
     "texto": "Cópia da base de dados para fora da base de dados.\n\nO Time Travel da D1 repõe a base num instante do passado, mas no plano\ngratuito só guarda 7 dias — e vive dentro da própria base: não serve de\nnada se a base for apagada, se a conta se perder, ou se um erro só der\npela falta de dados duas semanas depois. Daí uma cópia diária no R2, que é\noutro serviço, com outro ciclo de vida.\n\nFormato: NDJSON comprimido. Uma linha por registo, `{\"t\":tabela,\"r\":{...}}`,\nprecedida de um cabeçalho com a data e as tabelas incluídas. É um formato\nque se lê com o olho e se restaura com um ciclo — ver scripts/restaurar.js."
    },
    {
     "nome": "teste.js",
     "texto": "O ambiente de teste, a um /test de distância.\r\n\nO comando /test no Discord responde com uma ligação temporária para o\r\nambiente de dev. Abri-la faz três coisas, por esta ordem: apaga as contas\r\nde teste anteriores (cada visita começa lavada), cria uma conta de teste\r\nnova, e entra com ela — com ou sem dados de exemplo.\r\n\nA ligação é um bilhete ASSINADO, não um estado: HMAC sobre a validade e\r\nas opções, com uma chave derivada do token do bot do Discord — o único\r\nsegredo que os dois ambientes já partilham. Assim o worker de produção\r\n(que é quem responde ao Discord depois da promoção) consegue emitir\r\nligações para o dev sem os dois falarem um com o outro.\r\n\nNada disto existe em produção: sem ENV_NAME, a rota é um 404 e ponto —\r\nprodução nunca cria contas de teste, venha a assinatura de onde vier."
    }
   ]
  },
  {
   "titulo": "As bibliotecas do worker",
   "nota": "As peças partilhadas: acesso, auditoria, correio, planos.",
   "itens": [
    {
     "nome": "acesso.js",
     "texto": "Quem pode ver e mexer em que casa, e o que acontece quando uma conta\ndesaparece. E aqui que vive a regra de ouro: o me.id vem sempre da\nsessao, nunca do pedido."
    },
    {
     "nome": "auditoria.js",
     "texto": "Rasto do que a equipa faz e do que as máquinas fazem.\r\n\nDuas tabelas, duas perguntas:\r\n\naudit_log — quem fez o quê sobre quem, e porquê. Escreve-se em cada ação\r\ndo back office e nunca se altera nem se apaga: no primeiro desentendimento\r\nsobre \"quem mudou isto?\", ou o registo existe ou já não se reconstrói.\r\n\nop_log — as operações agendadas deixam uma linha por execução. O alarme\r\nnão é uma linha com erro: é a ausência de linhas novas, que era o que\r\nninguém via quando o cron morria de todo."
    },
    {
     "nome": "correio.js",
     "texto": "O correio do Rendorium, pelo Resend.\r\n\nTrês remetentes, três papéis:\r\n\nno-reply@rendorium.com   o que a máquina diz sozinha (reset de password,\r\navisos) — com Reply-To para o support, porque\r\nas pessoas respondem na mesma e alguém tem de ler\r\nsupport@rendorium.com    respostas a pedidos de ajuda\r\ngeneral@rendorium.com    o resto (contacto, anúncios)\r\n\nSem RESEND_API_KEY definido, tudo isto é um no-op que diz que não enviou\r\n— a app funciona na mesma, como sempre foi a regra com o Discord. Fora\r\nde produção o assunto leva o prefixo do ambiente, para um teste nunca\r\nse confundir com um email a sério."
    },
    {
     "nome": "enderecos.js",
     "texto": "Os endereços @rendorium.com, geridos do back office.\r\n\nNão há caixas de correio: um endereço é uma REGRA de reencaminhamento no\r\nEmail Routing do Cloudflare — o que chega a nome@rendorium.com segue para\r\num destino verificado (o Gmail de quem gere). Por isso um endereço não\r\ntem palavra-passe: não há onde entrar. Enviar é outra história, e já\r\nestá resolvida — o Resend assina o domínio inteiro, e qualquer\r\nfrom@rendorium.com serve sem se criar nada aqui.\r\n\nFala-se com a API do Cloudflare com um token próprio (CF_EMAIL_TOKEN,\r\ncom Email Routing de zona em edição e Zone em leitura). Sem token, a\r\nsecção explica o que falta em vez de fingir que funciona."
    },
    {
     "nome": "http.js",
     "texto": "Peças de HTTP partilhadas por todas as rotas: respostas, leitura do corpo,\nvalidação de identificadores e os limites de tamanho."
    },
    {
     "nome": "limites.js",
     "texto": "Travão contra força bruta e abuso. Os contadores vivem na D1: o KV gratuito\nsó aceita mil escritas por dia e cada gravação de dados gastava uma."
    },
    {
     "nome": "planos.js",
     "texto": "Os planos, com dentes.\r\n\nO campo users.plan existia e nada o lia na hora de decidir. Aqui vive a\r\nregra: o que cada plano deixa CRIAR. Nunca o que deixa ver — os termos\r\nprometem que nada do que existe é apagado ou fica inacessível, e o código\r\ntem de cumprir a promessa.\r\n\nO interruptor do modo de demonstração suspende os limites todos. Vive no\r\nKV e só o master lhe toca, pelo back office. Enquanto estiver ligado, a\r\napp comporta-se como sempre se comportou; desligá-lo é o momento em que\r\nos planos passam a valer."
    },
    {
     "nome": "relatos.js",
     "texto": "Erros apanhados sozinhos abrem um pedido na mesma fila dos que as\npessoas contam, agrupados por assinatura para nao encher o canal."
    }
   ]
  },
  {
   "titulo": "As rotas da API",
   "nota": "Cada grupo de rotas com sessão, um ficheiro.",
   "itens": [
    {
     "nome": "anexos.js",
     "texto": "Anexos: o conteudo vive no R2, o acesso segue a casa."
    },
    {
     "nome": "auth.js",
     "texto": "Registo, entrada, saida e entrada com Google. Corre antes da sessao."
    },
    {
     "nome": "casas.js",
     "texto": "Casas, quotas, registos de cada casa e dados globais do utilizador."
    },
    {
     "nome": "conexoes.js",
     "texto": "Ligacoes entre utilizadores e escolha das casas partilhadas."
    },
    {
     "nome": "conta.js",
     "texto": "A conta de quem esta ligado: dados, termos, palavra-passe, sessoes e apagar."
    },
    {
     "nome": "estado.js",
     "texto": "O estado completo que este utilizador pode ver, numa so leitura."
    },
    {
     "nome": "relatos.js",
     "texto": "Erros apanhados no browser de quem usa a app.\n\nCorre antes da verificação de sessão de propósito. O ecrã de entrada é onde\num erro custa mais — quem não consegue entrar não tem como contar o que se\npassou — e era exatamente aí que os relatos se perdiam, porque o cliente só\nos enviava depois de haver sessão. Com sessão o relato fica em nome de quem\no viu; sem ela fica anónimo, limitado por endereço."
    },
    {
     "nome": "sync.js",
     "texto": "Sincronizacao em lote das alteracoes pendentes do cliente."
    },
    {
     "nome": "tickets.js",
     "texto": "Pedidos de ajuda e erros comunicados pela app."
    }
   ]
  },
  {
   "titulo": "O cliente — nuvem",
   "nota": "Sessão, sincronização, filtros e ajuda.",
   "itens": [
    {
     "nome": "ajuda.js",
     "texto": "Documentos legais, aceitacao dos termos e pedidos de ajuda."
    },
    {
     "nome": "anexos.js",
     "texto": "Anexos: sobem para o servidor e voltam de la quando faltam no aparelho."
    },
    {
     "nome": "entrada.js",
     "texto": "Ecras de entrada: sessao, aviso inicial e ligacao com a Google."
    },
    {
     "nome": "filtros.js",
     "texto": "Faz a lista de imoveis flutuar por cima do painel de filtros, sem cortes."
    },
    {
     "nome": "guia.js",
     "texto": "Primeiros passos e tutoriais.\r\n\nQuem chega a uma app de gestão de imóveis com o ecrã vazio não sabe por\r\nonde começar, e a ordem importa: sem perfil os contratos saem sem os dados\r\ndo senhorio, sem imóveis não há onde pendurar um contrato, e sem contrato\r\nas rendas não se geram sozinhas.\r\n\nNada disto obriga a nada. É um cartão na vista geral com o que falta, e\r\ntutoriais para quem quiser ser levado pela mão. Fecha-se e não volta.\r\n\nO tutorial é um cartão a flutuar, não um modal: quem está a seguir os\r\npassos tem de conseguir mexer na app por baixo enquanto o lê."
    },
    {
     "nome": "novidades.js",
     "texto": "Atualizações e novidades.\r\n\nTrês coisas, por esta ordem de importância:\r\n\n1. A app verifica sozinha, ao abrir, se há versão nova, e instala-a.\r\n2. Se a versão em uso já não for aceitável, tranca e obriga a atualizar.\r\n3. Havendo novidades, mostra o que mudou — só as partes que dizem\r\nrespeito a quem está a ver."
    },
    {
     "nome": "nucleo.js",
     "texto": "Sessao, sincronizacao com o servidor e reconstrucao dos dados locais."
    },
    {
     "nome": "painel.js",
     "texto": "Visao geral: movimentos por tras dos indicadores, pendentes e ordem dos cartoes."
    },
    {
     "nome": "partilha.js",
     "texto": "Pagina Conta e partilha: id, ligacoes, seguranca e apagar a conta."
    },
    {
     "nome": "selecao-listas.js",
     "texto": "Selecionar vários — imóveis e contratos.\r\n\nO toque longo passou a ter UM significado na app inteira: selecionar\r\nvários. Nos movimentos já era assim; aqui ganha o mesmo comportamento\r\npara as duas listas onde apagar em massa faz sentido — e apagar um\r\nimóvel arrasta os contratos e movimentos dele, por isso a confirmação\r\ndiz os números e o Anular repõe tudo.\r\n\nAs opções de um cartão continuam no kebab. O toque longo deixa de abrir\r\nmenus em qualquer lado: ou seleciona (onde há seleção) ou não faz nada."
    },
    {
     "nome": "selecao.js",
     "texto": "Selecionar vários movimentos e tratá-los de uma vez.\r\n\nO toque longo num movimento passa a entrar em modo de seleção, com esse já\r\nmarcado. As opções de um movimento sozinho passam para um kebab na própria\r\nlinha — ficam a um toque em vez de a um toque longo, que ninguém adivinha.\r\n\nEm seleção há três níveis de marca: cada movimento, cada mês, e um global.\r\nO global e o do mês acompanham o scroll, senão a meio de uma lista de\r\nduzentos movimentos deixa de haver como marcar tudo sem voltar ao topo.\r\n\nEste ficheiro transforma o HTML que o vTransactions devolve, em vez de o\r\nreescrever. É o mesmo caminho que o painel.js já usava para os cartões da\r\nvista geral: a vista continua a ser de quem a escreveu, e isto acrescenta."
    },
    {
     "nome": "utilizadores.js",
     "texto": "Os proprietarios sao os utilizadores: perfil proprio e quotas por proposta."
    }
   ]
  },
  {
   "titulo": "O cliente — aplicação",
   "nota": "Os ecrãs e componentes da app em si.",
   "itens": [
    {
     "nome": "anexos.js",
     "texto": "================= ANEXOS (IndexedDB) ================="
    },
    {
     "nome": "arranque.js",
     "texto": "================= EXEMPLO ================="
    },
    {
     "nome": "auxiliares.js",
     "texto": "================= AUXILIARES ================="
    },
    {
     "nome": "avaliacao.js",
     "texto": "================= AVALIAÇÃO ================="
    },
    {
     "nome": "componentes.js",
     "texto": "================= COMPONENTES ================="
    },
    {
     "nome": "contrato-pdf.js",
     "texto": "================= NÚMEROS POR EXTENSO ================="
    },
    {
     "nome": "contrato.js",
     "texto": "================= CONTRATO ================="
    },
    {
     "nome": "copias.js",
     "texto": "================= CÓPIAS ================="
    },
    {
     "nome": "credito.js",
     "texto": "================= CRÉDITO ================="
    },
    {
     "nome": "creditos.js",
     "texto": "================= CRÉDITOS (todas as hipotecas) ================="
    },
    {
     "nome": "dados.js",
     "texto": "================= ARMAZENAMENTO ================="
    },
    {
     "nome": "definicoes.js",
     "texto": "================= DADOS ================="
    },
    {
     "nome": "graficos.js",
     "texto": "================= GRÁFICOS ================="
    },
    {
     "nome": "imovel.js",
     "texto": "================= IMÓVEL ================="
    },
    {
     "nome": "metricas.js",
     "texto": "================= MÉTRICAS ================="
    },
    {
     "nome": "movimento.js",
     "texto": "================= MOVIMENTO ================="
    },
    {
     "nome": "navegacao.js",
     "texto": "================= NAVEGAÇÃO ================="
    },
    {
     "nome": "pessoas.js",
     "texto": "================= PESSOAS (inquilinos e proprietários) ================="
    },
    {
     "nome": "planeados.js",
     "texto": "================= MODELOS E RECORRÊNCIAS ================="
    },
    {
     "nome": "splitwise.js",
     "texto": "================= SPLITWISE ================="
    },
    {
     "nome": "vistas.js",
     "texto": "================= VISTAS ================="
    }
   ]
  },
  {
   "titulo": "As migrações",
   "nota": "A história do esquema da base, uma decisão de cada vez.",
   "itens": [
    {
     "nome": "0001_init.sql",
     "texto": "Esquema inicial: utilizadores, conexões entre utilizadores, partilha de casas\ne armazenamento dos dados da app (casas + registos por casa + dados globais\ndo utilizador). Os dados de domínio guardam-se como JSON por registo — o\nworker valida a propriedade/partilha e o cliente mantém a lógica de negócio."
    },
    {
     "nome": "0002_share_proposals.sql",
     "texto": "Propostas de divisão de percentagens de uma casa partilhada.\nUma proposta por casa; entra em vigor quando todos os comproprietários\n(dono + utilizadores com quem a casa está partilhada) a aprovarem."
    },
    {
     "nome": "0003_oauth.sql",
     "texto": "Entrada com Google / Apple: liga a conta ao \"sub\" do fornecedor.\nContas criadas por OAuth ficam com pass_hash/pass_salt vazios."
    },
    {
     "nome": "0004_account_deletion.sql",
     "texto": "Eliminação de conta ao estilo do Reddit: a linha do utilizador fica como\nlápide anónima (\"[deleted]\") para que as referências noutros dados — quem\npagou um movimento numa casa partilhada, por exemplo — continuem legíveis\nsem revelar quem era. Todos os dados próprios são apagados."
    },
    {
     "nome": "0005_session_epoch.sql",
     "texto": "Permite invalidar todas as sessões de um utilizador de uma vez: cada sessão\nguarda a \"época\" em que nasceu e deixa de valer quando a época do utilizador\navança (mudança de palavra-passe ou \"terminar sessão nos outros aparelhos\")."
    },
    {
     "nome": "0006_terms_and_limits.sql",
     "texto": "Aceitação dos termos (guardada por versão, para se poder pedir de novo\nquando mudarem) e plano de subscrição da conta."
    },
    {
     "nome": "0007_tickets_reports.sql",
     "texto": "Pedidos de ajuda e sugestões dos utilizadores, e relatórios automáticos de\nerros. Ambos alimentam o canal de dev no Discord."
    },
    {
     "nome": "0008_files_and_categories.sql",
     "texto": "Anexos no R2: a tabela guarda quem carregou e a que casa pertence, que é\no que decide quem os pode ver. O conteúdo vive no bucket, com o id à chave."
    },
    {
     "nome": "0009_contexto_dos_erros.sql",
     "texto": "Contexto dos erros, para se poder decidir o que corrigir primeiro.\n\nAté agora um erro repetido só somava no contador `n`. Duzentas ocorrências\nda mesma pessoa e duzentas de duzentas pessoas contavam igual — e são\nproblemas de gravidade muito diferente.\n\nQuem apanhou cada erro. Uma linha por pessoa e por assinatura: o índice\núnico faz com que a mesma pessoa a repetir o mesmo erro não conte duas\nvezes, e é o que permite responder a \"quantas pessoas?\"."
    },
    {
     "nome": "0010_ligacoes_de_equipa.sql",
     "texto": "Ligações de uso único para a ferramenta de equipa.\n\nEstavam no KV, e foi o sítio errado. O KV só fica consistente entre\nregiões ao fim de algum tempo: a ligação era escrita no ponto de presença\nque atende o Discord e lida no de quem clica, que quase nunca é o mesmo.\nUma ligação acabada de criar aparecia como inexistente, e o erro que se\nvia era \"já foi usada ou expirou\" — que era falso nas duas metades.\n\nNa base a leitura vê sempre a escrita. E o uso único passa a fazer-se numa\nsó instrução (UPDATE ... WHERE used_at IS NULL), em vez de ler-e-depois-\napagar: se dois pedidos chegarem ao mesmo tempo, só um altera a linha."
    },
    {
     "nome": "0011_back_office.sql",
     "texto": "O portal de equipa vira back office: ganha poderes de escrita sobre contas\ne pedidos. Tudo o que escreve passa a deixar rasto — a auditoria vem na\nmesma migração que os poderes, de propósito: não há um dia em que um\nexistiu sem a outra.\n\nQuem fez o quê, sobre quem, e porquê. Só se escreve e lê: não há UPDATE\nnem DELETE em lado nenhum do código, e é copiada para o R2 com o resto."
    },
    {
     "nome": "0012_dono_das_contas_de_teste.sql",
     "texto": "Cada conta de teste sabe que dev a criou: e o que permite ao seletor do\nambiente de dev mostrar a cada um so as suas, e ao /test lavar so as de\nquem pediu. NULL para toda a gente normal - a coluna nao muda nada fora\ndo ambiente de teste."
    }
   ]
  },
  {
   "titulo": "Os workflows",
   "nota": "O que o CI faz por nós: testes, deploy, comandos, limpeza.",
   "itens": [
    {
     "nome": "comandos.yml",
     "texto": "Regista os comandos do bot a pedido, a partir do ramo que se escolher.\n\nO deploy de produção já o faz sozinho, mas isso só serve o que está no\nmain. Para experimentar um comando novo no ambiente de dev antes de o\npromover, é preciso poder registá-lo a partir do ramo onde ele existe —\ne é isto.\n\nOs comandos são globais ao bot, não por ambiente: registá-los daqui torna-os\nvisíveis em qualquer servidor onde o bot esteja. O que muda por ambiente é\nquem responde, que é o worker de cada um."
    },
    {
     "nome": "interface.yml",
     "texto": "Corre a app a sério num browser e verifica o interface em todos os estados.\nSeparado dos testes unitários porque é lento (descarrega um browser) e\nporque falha por razões diferentes: ali é a lógica, aqui é o que se vê."
    },
    {
     "nome": "limpar-dev.yml",
     "texto": "Limpar as contas do ambiente de DEV — e só do dev.\n\nApaga todas as contas de utilizador e o que lhes pertence (casas, registos,\nligações, partilhas, pedidos, ficheiros, contadores). O rasto fica: o\naudit_log e o op_log não se tocam — a história do que a equipa fez não\nse apaga com os dados de quem testou.\n\nCorre-se à mão, e obriga a escrever \"limpar\" de propósito: uma limpeza\ntotal não pode estar a um clique distraído de distância. O UUID da base\nsai do terraform.tfstate pelo NOME do recurso de dev (db_dev) — não há\nmaneira de este workflow acertar na base de produção."
    },
    {
     "nome": "testes.yml",
     "texto": "Corre em cada pull request e em cada push aos ramos principais. É o que\nimpede uma alteração de chegar a produção com as contas erradas."
    }
   ]
  }
 ]
};
