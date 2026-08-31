/* =====================================================================
   Termos e Condições e Política de Privacidade.
   Ficam num ficheiro à parte por serem longos e mudarem por outras razões
   que não o código. Ao alterá-los, muda também TERMS_VERSION no worker
   (worker/src/api.js) para a app voltar a pedir a aceitação a toda a gente.

   ATENÇÃO: os campos entre [ ] têm de ser preenchidos com a identificação
   real de quem opera o serviço. É obrigatório por lei num serviço online.
   ===================================================================== */
window.LEGAL = (function () {
  'use strict';

  var VERSION = '2026-08-31';
  var OPERADOR = '[NOME COMPLETO OU EMPRESA]';
  var MORADA = '[MORADA COMPLETA]';
  var NIF = '[NIF]';
  var EMAIL = '[EMAIL DE CONTACTO]';

  var h = function (t) { return '<h3 class="lg-h">' + t + '</h3>'; };
  var p = function (t) { return '<p>' + t + '</p>'; };
  var ul = function (items) {
    return '<ul>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
  };

  /* ---------------------- TERMOS E CONDIÇÕES ---------------------- */

  var TERMOS =
    p('<b>Em vigor desde ' + VERSION + '.</b> Estes termos regulam a utilização do Gestor Imobiliário ' +
      '(“a aplicação”), um serviço acessível em gestor-imobiliario.martinhos.workers.dev.') +

    h('1. Quem opera o serviço') +
    p('O serviço é operado por ' + OPERADOR + ', com morada em ' + MORADA + ' e NIF ' + NIF + '. ' +
      'Para qualquer questão relacionada com estes termos, com a tua conta ou com os teus dados, ' +
      'escreve para ' + EMAIL + '.') +

    h('2. O que a aplicação é — e o que não é') +
    p('A aplicação é uma <b>ferramenta de gestão</b> para quem tem imóveis arrendados: permite registar ' +
      'imóveis, contratos, inquilinos, movimentos financeiros e créditos, e ver indicadores sobre esse ' +
      'património.') +
    p('A aplicação <b>não é</b>:') +
    ul([
      '<b>Mediação imobiliária.</b> Não intermediamos arrendamentos nem compras e vendas, não procuramos ' +
      'inquilinos nem senhorios, e não recebemos qualquer comissão por negócios celebrados. Não exercemos ' +
      'atividade sujeita a licença AMI.',
      '<b>Aconselhamento profissional.</b> Os valores, indicadores e projeções são estimativas calculadas a ' +
      'partir do que introduzes e de pressupostos simplificados. Não substituem contabilista certificado, ' +
      'advogado, solicitador nem intermediário de crédito.',
      '<b>Um serviço de pagamentos.</b> Não recebemos nem transferimos rendas. Os movimentos que registas ' +
      'são apontamentos teus, não transações reais.',
      '<b>Um serviço de arquivo garantido.</b> Guardamos os teus dados com cuidado, mas continuas ' +
      'responsável por manter as tuas próprias cópias de segurança.',
    ]) +
    p('Os modelos de contrato de arrendamento gerados em PDF são <b>minutas genéricas</b>, não validadas ' +
      'por advogado, que podem não refletir a legislação em vigor nem a tua situação concreta. Deves ' +
      'submetê-las a revisão profissional antes de as assinar. Não assumimos responsabilidade pelo ' +
      'conteúdo, validade ou consequências dos documentos gerados.') +

    h('3. Fase de demonstração') +
    p('A aplicação está em <b>fase de demonstração</b>. É disponibilizada tal como está, pode mudar ou ' +
      'ser descontinuada, e não há compromisso de disponibilidade, desempenho ou conservação de dados. ' +
      'Enquanto esta fase durar, o número de contas é limitado e o serviço é gratuito.') +

    h('4. Conta') +
    ul([
      'Tens de ter <b>pelo menos 18 anos</b> e capacidade para celebrar contratos.',
      'A conta é <b>pessoal</b>: és responsável por tudo o que nela acontece e por manter a palavra-passe ' +
      'em segredo. Avisa-nos assim que suspeitares de acesso indevido.',
      'Os dados que indicas têm de ser verdadeiros e atualizados.',
      'Podes apagar a conta a qualquer momento em <b>Definições → Conta e partilha</b>.',
    ]) +
    p('Ao apagares a conta, os teus dados são eliminados e a tua identidade passa a aparecer como ' +
      '“[deleted]” nas referências que existam nos dados de outros utilizadores — por exemplo, num ' +
      'movimento que tenhas pago numa casa partilhada. Os dados dessas outras pessoas não são apagados.') +

    h('5. Partilha entre utilizadores') +
    p('Podes ligar a tua conta à de outro utilizador e escolher que casas partilhas com ele. Ao fazê-lo, ' +
      'dás-lhe acesso a <b>tudo o que essa casa contém</b>: contratos, movimentos, documentos e fichas de ' +
      'pessoas associadas. Cada utilizador continua dono das casas que criou; a divisão de quotas entre ' +
      'comproprietários só muda com a confirmação de todos.') +
    p('A partilha é uma decisão tua e da tua responsabilidade, incluindo quanto aos dados de terceiros ' +
      'que essa casa contenha.') +

    h('6. Planos e pagamento') +
    p('Quando a fase de demonstração terminar, a aplicação passa a ter planos de subscrição mensal:') +
    ul([
      '<b>Gratuito</b> — gestão até 3 imóveis próprios, com movimentos e créditos. Sem criação de ' +
      'contratos nem funcionalidades que envolvam inquilinos, sem movimentos planeados e sem ' +
      'indicadores e estatísticas. Inclui publicidade.',
      '<b>Plus</b> — até 10 imóveis próprios, com criação de contratos, movimentos planeados e acesso ' +
      'aos indicadores e estatísticas. Sem publicidade.',
      '<b>Pro</b> — a definir, para quem tem mais imóveis ou precisa de funcionalidades adicionais.',
    ]) +
    ul([
      'Os preços em vigor são os anunciados na aplicação no momento da subscrição, e incluem IVA à taxa ' +
      'legal quando aplicável.',
      'A subscrição é <b>mensal e renova-se automaticamente</b> até ser cancelada. Podes cancelar a ' +
      'qualquer momento, com efeito no fim do período já pago.',
      'Alterações de preço são comunicadas com <b>pelo menos 30 dias</b> de antecedência e só se aplicam ' +
      'a períodos seguintes. Se não concordares, podes cancelar.',
      'Se a subscrição terminar, a conta passa ao plano gratuito. Os dados que excedam os limites desse ' +
      'plano <b>não são apagados</b>: ficam acessíveis para consulta e exportação, mas não podes criar ' +
      'novos registos acima do limite enquanto não voltares a subscrever.',
      'Os limites dos planos <b>não se aplicam durante a fase de demonstração</b> e só entram em vigor ' +
      'depois de aviso com pelo menos 30 dias.',
    ]) +
    p('<b>Direito de livre resolução.</b> Sendo consumidor, tens 14 dias para desistir de uma subscrição ' +
      'sem indicar motivo. Se pedires para começar a usar o serviço pago de imediato, esse direito ' +
      'cessa quando o serviço for integralmente prestado, e em caso de desistência a meio pagas a parte ' +
      'proporcional ao que já usaste.') +

    h('7. Publicidade no plano gratuito') +
    p('O plano gratuito inclui publicidade. Os anúncios não dão a terceiros acesso aos dados que registas ' +
      'na aplicação — imóveis, contratos, movimentos ou fichas de pessoas — e esses dados nunca são ' +
      'vendidos nem cedidos para fins publicitários. Se a publicidade vier a usar cookies ou tecnologias ' +
      'semelhantes, será pedido o teu consentimento antes.') +

    h('8. Utilização aceitável') +
    p('Não podes usar a aplicação para atividades ilegais, para guardar conteúdos que não tens direito de ' +
      'guardar, para tentar aceder a dados de outros utilizadores, para contornar limites técnicos ou ' +
      'de plano, para sobrecarregar o serviço, nem para recolher dados de terceiros de forma automatizada. ' +
      'Podemos suspender ou encerrar contas que violem estas regras.') +

    h('9. Os teus conteúdos') +
    p('Os dados que introduzes continuam teus. Concedes-nos apenas a autorização técnica necessária para ' +
      'os alojar, processar e mostrar-te, e para os disponibilizar aos utilizadores com quem <b>tu</b> ' +
      'escolheste partilhá-los. Não os usamos para mais nada.') +
    p('O software, a marca, o desenho e os textos da aplicação são nossos e não podem ser copiados ou ' +
      'reutilizados sem autorização.') +

    h('10. Disponibilidade e responsabilidade') +
    p('Não garantimos que o serviço esteja sempre disponível, livre de erros ou que os resultados sejam ' +
      'exatos. Na medida máxima permitida por lei, não respondemos por danos indiretos, perda de dados, ' +
      'perda de lucros, nem por decisões tomadas com base na informação da aplicação, incluindo ' +
      'incumprimentos legais ou fiscais.') +
    p('Nada nestes termos exclui a responsabilidade que a lei não permite excluir, designadamente perante ' +
      'consumidores.') +

    h('11. Cessação') +
    p('Podes deixar de usar a aplicação quando quiseres. Podemos encerrar ou suspender a tua conta em caso ' +
      'de violação destes termos, de exigência legal, ou de descontinuação do serviço — neste último caso, ' +
      'com aviso prévio razoável e tempo para exportares os teus dados.') +

    h('12. Alterações a estes termos') +
    p('Podemos alterar estes termos. Alterações significativas são comunicadas na aplicação e, quando ' +
      'existir email confirmado, também por email. Ao voltares a entrar, será pedida a aceitação da nova ' +
      'versão; se não aceitares, podes apagar a conta e exportar os teus dados antes disso.') +

    h('13. Lei aplicável e resolução de litígios') +
    p('Aplica-se a lei portuguesa. Em caso de litígio de consumo, podes recorrer a uma entidade de ' +
      'resolução alternativa de litígios de consumo, e também apresentar reclamação no <b>Livro de ' +
      'Reclamações eletrónico</b> em livroreclamacoes.pt. Sendo consumidor, podes ainda usar a plataforma ' +
      'europeia de resolução de litígios em linha.') +
    p('Sem prejuízo do foro que a lei atribua ao consumidor, é competente o foro da comarca do domicílio ' +
      'do prestador.');

  /* ------------------- POLÍTICA DE PRIVACIDADE ------------------- */

  var PRIVACIDADE =
    p('<b>Em vigor desde ' + VERSION + '.</b> Esta política explica que dados pessoais tratamos, porquê, ' +
      'durante quanto tempo e que direitos tens.') +

    h('1. Responsável pelo tratamento') +
    p(OPERADOR + ', ' + MORADA + ', NIF ' + NIF + '. Contacto para assuntos de dados pessoais: ' + EMAIL + '.') +

    h('2. Dois papéis diferentes — é importante') +
    p('Nesta aplicação há dois tipos de dados pessoais, com regimes distintos:') +
    ul([
      '<b>Os teus dados de utilizador.</b> Aqui somos nós o responsável pelo tratamento: decidimos ' +
      'porquê e como são tratados, e é isso que o resto desta política descreve.',
      '<b>Os dados de terceiros que tu introduzes</b> — inquilinos, fiadores, comproprietários. Aqui ' +
      '<b>o responsável és tu</b> e nós somos apenas subcontratante: limitamo-nos a alojá-los e a ' +
      'mostrá-los a quem tu autorizares. As condições dessa subcontratação estão no ponto 9.',
    ]) +

    h('3. Que dados tratamos') +
    ul([
      '<b>Conta:</b> email, nome, palavra-passe (guardada apenas como resumo criptográfico, nunca em ' +
      'texto) e, se entrares com o Google, o identificador que o Google nos devolve.',
      '<b>Perfil:</b> os dados que optares por preencher — telemóvel, NIF, cartão de cidadão e validade, ' +
      'data de nascimento, estado civil, nacionalidade e morada fiscal. Servem para te identificar como ' +
      'senhorio nos contratos que a app gera.',
      '<b>Dados da tua atividade:</b> imóveis, contratos, movimentos, créditos, documentos e notas.',
      '<b>Dados técnicos:</b> endereço IP e registos de acesso, usados para segurança e para travar abusos.',
      '<b>Pagamento:</b> quando existirem planos pagos, os dados do cartão são tratados diretamente pelo ' +
      'prestador de pagamentos; nós guardamos apenas o registo da subscrição e da faturação.',
    ]) +

    h('4. Para quê e com que fundamento') +
    ul([
      '<b>Prestar o serviço</b> (criar a conta, guardar e sincronizar os teus dados, partilhar casas com ' +
      'quem indicares) — execução do contrato entre nós.',
      '<b>Segurança e prevenção de abusos</b> (limites de tentativas, registos de acesso) — interesse ' +
      'legítimo em manter o serviço a funcionar e protegido.',
      '<b>Cumprir obrigações legais</b> — designadamente fiscais e contabilísticas, quando existir faturação.',
      '<b>Comunicações sobre o serviço</b> (confirmação de email, avisos de segurança, alterações aos ' +
      'termos) — execução do contrato. Comunicações de marketing, se as houver, só com o teu consentimento.',
    ]) +
    p('Não fazemos decisões automatizadas com efeitos jurídicos sobre ti, nem definição de perfis.') +

    h('5. Quem tem acesso') +
    p('Não vendemos dados pessoais nem os cedemos para fins publicitários. Recorremos aos seguintes ' +
      'subcontratantes:') +
    ul([
      '<b>Cloudflare, Inc.</b> — alojamento da aplicação, base de dados e sessões.',
      '<b>Google Ireland Ltd.</b> — apenas se optares por entrar com a conta Google.',
      '<b>Prestador de envio de email</b> — para confirmação de email e avisos, quando estiver ativo.',
      '<b>Prestador de pagamentos</b> — quando existirem planos pagos.',
      '<b>Rede de publicidade</b> — quando existir publicidade no plano gratuito, e sem acesso aos dados ' +
      'que registas na aplicação.',
    ]) +
    p('Os outros utilizadores só veem o que <b>tu</b> decidires partilhar: quem recebe uma casa tua vê os ' +
      'dados dessa casa, e quem aceita ligar-se a ti vê o teu perfil. Um convite ainda não aceite não dá ' +
      'acesso a nada.') +

    h('6. Transferências fora da União Europeia') +
    p('Alguns destes prestadores podem tratar dados fora do Espaço Económico Europeu. Nesses casos, a ' +
      'transferência assenta em decisões de adequação da Comissão Europeia ou em Cláusulas Contratuais-Tipo, ' +
      'com as garantias adicionais aplicáveis.') +

    h('7. Durante quanto tempo') +
    ul([
      'Os dados da conta e da tua atividade são conservados enquanto a conta existir.',
      'Ao apagares a conta, os dados são eliminados de imediato e a identidade fica anonimizada como ' +
      '“[deleted]”, para as referências nos dados de outros utilizadores continuarem legíveis.',
      'As cópias de segurança podem manter os dados por mais algum tempo até serem substituídas no ciclo ' +
      'normal de rotação.',
      'Os registos técnicos de segurança são conservados por um período curto, proporcional à sua ' +
      'finalidade.',
      'Os documentos de faturação são conservados pelo prazo legal.',
    ]) +

    h('8. Os teus direitos') +
    p('Podes pedir <b>acesso</b> aos teus dados, <b>retificação</b>, <b>apagamento</b>, <b>limitação</b> ' +
      'do tratamento, <b>portabilidade</b> e <b>oposição</b>, e retirar consentimentos a qualquer momento. ' +
      'Na prática, a aplicação já te dá dois destes diretamente: podes exportar tudo em ' +
      '<b>Definições → Importar e cópias</b> e apagar a conta em <b>Definições → Conta e partilha</b>.') +
    p('Para os restantes, escreve para ' + EMAIL + '. Se entenderes que os teus dados não estão a ser ' +
      'tratados corretamente, podes reclamar junto da <b>Comissão Nacional de Proteção de Dados</b> ' +
      '(cnpd.pt).') +

    h('9. Condições de subcontratação (artigo 28.º do RGPD)') +
    p('Quando introduzes dados de terceiros — o NIF de um inquilino, por exemplo — <b>és tu o responsável ' +
      'pelo tratamento</b> e nós somos subcontratante. Ao aceitares estes documentos, ficam acordadas as ' +
      'seguintes condições, que valem como contrato escrito entre nós:') +
    ul([
      '<b>Objeto e duração:</b> alojamento e processamento desses dados para te prestar o serviço, ' +
      'enquanto a tua conta existir.',
      '<b>Instruções:</b> tratamos os dados apenas segundo as tuas instruções, dadas através da utilização ' +
      'da aplicação, e nunca para finalidades próprias.',
      '<b>Confidencialidade:</b> quem tem acesso está vinculado a sigilo.',
      '<b>Segurança:</b> aplicamos as medidas descritas no ponto 10.',
      '<b>Subcontratantes ulteriores:</b> os listados no ponto 5, com autorização geral; qualquer alteração ' +
      'é comunicada com antecedência e podes opor-te, cessando o contrato.',
      '<b>Apoio:</b> ajudamos-te, na medida do razoável, a responder a pedidos de titulares e a cumprir as ' +
      'tuas obrigações de segurança e de notificação.',
      '<b>Violações de dados:</b> avisamos-te sem demora injustificada depois de termos conhecimento.',
      '<b>Fim do contrato:</b> ao apagares a conta, os dados são eliminados, salvo obrigação legal de ' +
      'conservação.',
      '<b>Auditoria:</b> disponibilizamos a informação necessária para demonstrar o cumprimento destas ' +
      'obrigações.',
    ]) +
    p('Recorda que, como responsável, cabe-te a ti ter fundamento legítimo para guardar esses dados, ' +
      'informar as pessoas em causa e recolher apenas o que for necessário.') +

    h('10. Segurança') +
    p('As palavras-passe são guardadas apenas como resumo criptográfico com sal, a ligação é encriptada, ' +
      'as sessões podem ser revogadas em todos os aparelhos e o acesso aos dados é verificado a cada ' +
      'pedido. Ainda assim, nenhum sistema é infalível: usa uma palavra-passe única e forte, e mantém ' +
      'cópias dos teus registos.') +

    h('11. Cookies e armazenamento local') +
    ul([
      '<b>Cookie de sessão</b> — estritamente necessário para te manter com sessão iniciada. Não precisa ' +
      'de consentimento.',
      '<b>Armazenamento local do navegador</b> — guarda os teus dados para a app funcionar offline, mais ' +
      'preferências como o tema e a página onde estavas. Fica no teu aparelho.',
      '<b>Google</b> — se usares a entrada com Google, esse serviço define cookies próprios, sujeitos à ' +
      'política de privacidade do Google.',
    ]) +
    p('Não usamos cookies de análise nem de publicidade. Se vierem a ser usados, será pedido consentimento ' +
      'prévio.') +

    h('12. Menores') +
    p('O serviço destina-se a maiores de 18 anos. Não recolhemos conscientemente dados de menores; se ' +
      'soubermos que o fizemos, apagamo-los.') +

    h('13. Alterações') +
    p('Se esta política mudar de forma significativa, avisamos na aplicação e pedimos nova aceitação. A ' +
      'data no início indica a versão em vigor.');

  return { version: VERSION, termos: TERMOS, privacidade: PRIVACIDADE, email: EMAIL, operador: OPERADOR };
})();
