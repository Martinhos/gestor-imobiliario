/* =====================================================================
   Termos e Condições e Política de Privacidade.
   Ficam num ficheiro à parte por serem longos e mudarem por outras razões
   que não o código. Ao alterá-los, muda também TERMS_VERSION no worker
   (worker/src/lib/http.js — o api.js só a reexporta) para a app voltar a pedir
   a aceitação a toda a gente. As duas têm de ficar iguais; há um teste que o
   verifica (testes/legal.test.js).

   ATENÇÃO: preenche a identificação de quem opera o serviço.

   Sobre a MORADA: não tens de publicar a tua morada de casa. O que a lei
   pede é um endereço de contacto onde possas ser alcançado. Alternativas,
   da mais simples à mais formal:
     · um apartado dos CTT (poucos euros por ano);
     · um serviço de domiciliação / escritório virtual (dá-te uma morada
       comercial real, tipicamente 10–30 €/mês);
     · a sede de uma sociedade unipessoal, se e quando criares uma.
   Enquanto o serviço for gratuito e pessoal, podes deixar MORADA e NIF
   vazios: os documentos escondem essas linhas sozinhos. A partir do
   momento em que cobrares, precisas de morada e NIF publicados.
   ===================================================================== */
window.LEGAL = (function () {
  'use strict';

  var VERSION = '2026-10-30';
  var OPERADOR = 'Martinho Fé Santos';
  var MORADA = '';                       // apartado, escritório virtual ou sede
  var NIF = '';                          // obrigatório quando houver cobrança
  var EMAIL = 'general@rendorium.com';

  /* A VERSION é uma CHAVE: é ela que o servidor compara com a TERMS_VERSION
     para saber se alguém já aceitou esta versão, e por isso fica em ISO. O que
     se ESCREVE nos documentos é outra coisa — lê-se como as outras datas da
     app, em dd/mm/aaaa (a regra vem de formato.js:dPT, que aqui não se pode
     chamar: este ficheiro é lido também pela página /termos e /privacidade do
     worker, worker/src/legal-vista.js, sem a app carregada). */
  var DATA = VERSION.slice(8, 10) + '/' + VERSION.slice(5, 7) + '/' + VERSION.slice(0, 4);

  // monta a identificação com o que estiver preenchido, sem linhas vazias
  var ident = function () {
    var s = OPERADOR;
    if (MORADA) s += ', com morada de contacto em ' + MORADA;
    if (NIF) s += ', NIF ' + NIF;
    return s;
  };

  var h = function (t) { return '<h3 class="lg-h">' + t + '</h3>'; };
  var p = function (t) { return '<p>' + t + '</p>'; };
  var ul = function (items) {
    return '<ul>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
  };

  /* ---------------------- TERMOS E CONDIÇÕES ---------------------- */

  var TERMOS =
    p('<b>Em vigor desde ' + DATA + '.</b> Estes termos regulam a utilização do Rendorium ' +
      '(“a aplicação”), um serviço acessível em app.rendorium.com.') +

    h('1. Quem opera o serviço') +
    p('O serviço é operado por ' + ident() + '. Para qualquer questão relacionada com estes termos, ' +
      'com a tua conta ou com os teus dados, escreve para <b>' + EMAIL + '</b> — respondemos por essa via.') +

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

    h('3. Fase experimental (demonstração)') +
    p('A aplicação encontra-se em <b>fase experimental</b>: é uma versão de demonstração, disponibilizada ' +
      'tal como está, e evolui continuamente — funcionalidades podem mudar ou ser descontinuadas.') +
    p('Fazemos cópias de segurança diárias, mas deves manter as tuas próprias cópias dos dados que te ' +
      'importam (Definições → Importar e cópias).') +

    h('4. Conta') +
    ul([
      'Tens de ter <b>pelo menos 18 anos</b> e capacidade para celebrar contratos.',
      'A conta é <b>pessoal</b>: és responsável por tudo o que nela acontece e por manter a palavra-passe ' +
      'em segredo. Avisa-nos assim que suspeitares de acesso indevido.',
      'Os dados que indicas têm de ser verdadeiros e atualizados.',
      'Podes apagar a conta a qualquer momento em <b>Definições → Segurança</b>.',
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

    h('6. Utilização gratuita') +
    p('O Rendorium é um <b>projeto pessoal</b> e a utilização é <b>gratuita</b>: não há subscrições, ' +
      'pagamentos, escalões nem publicidade, e não há limites ao número de imóveis, contratos ou ' +
      'movimentos que podes criar.') +

    h('7. Utilização aceitável') +
    p('Não podes usar a aplicação para atividades ilegais, para guardar conteúdos que não tens direito de ' +
      'guardar, para tentar aceder a dados de outros utilizadores, para contornar limites técnicos, ' +
      'para sobrecarregar o serviço, nem para recolher dados de terceiros de forma automatizada. ' +
      'Podemos suspender ou encerrar contas que violem estas regras.') +

    h('8. Os teus conteúdos') +
    p('Os dados que introduzes continuam teus. Concedes-nos apenas a autorização técnica necessária para ' +
      'os alojar, processar e mostrar-te, e para os disponibilizar aos utilizadores com quem <b>tu</b> ' +
      'escolheste partilhá-los. Não os usamos para mais nada.') +
    p('O software, a marca, o desenho e os textos da aplicação são nossos e não podem ser copiados ou ' +
      'reutilizados sem autorização.') +

    h('9. Disponibilidade e responsabilidade') +
    p('Não garantimos que o serviço esteja sempre disponível, livre de erros ou que os resultados sejam ' +
      'exatos. Na medida máxima permitida por lei, não respondemos por danos indiretos, perda de dados, ' +
      'perda de lucros, nem por decisões tomadas com base na informação da aplicação, incluindo ' +
      'incumprimentos legais ou fiscais.') +
    p('Nada nestes termos exclui a responsabilidade que a lei não permite excluir, designadamente perante ' +
      'consumidores.') +

    h('10. Cessação') +
    p('Podes deixar de usar a aplicação quando quiseres. Podemos encerrar ou suspender a tua conta em caso ' +
      'de violação destes termos, de exigência legal, ou de descontinuação do serviço — neste último caso, ' +
      'com aviso prévio razoável e tempo para exportares os teus dados.') +

    h('11. Alterações a estes termos') +
    p('Podemos alterar estes termos. Alterações significativas são comunicadas na aplicação e, quando ' +
      'existir email confirmado, também por email. Ao voltares a entrar, será pedida a aceitação da nova ' +
      'versão; se não aceitares, podes apagar a conta e exportar os teus dados antes disso.') +

    h('12. Lei aplicável e resolução de litígios') +
    p('Aplica-se a lei portuguesa. Em caso de litígio de consumo, podes recorrer a uma entidade de ' +
      'resolução alternativa de litígios de consumo, e também apresentar reclamação no <b>Livro de ' +
      'Reclamações eletrónico</b> em livroreclamacoes.pt. Sendo consumidor, podes ainda usar a plataforma ' +
      'europeia de resolução de litígios em linha.') +
    p('Sem prejuízo do foro que a lei atribua ao consumidor, é competente o foro da comarca do domicílio ' +
      'do prestador.');

  /* ------------------- POLÍTICA DE PRIVACIDADE ------------------- */

  var PRIVACIDADE =
    p('<b>Em vigor desde ' + DATA + '.</b> Esta política explica que dados pessoais tratamos, porquê, ' +
      'durante quanto tempo e que direitos tens.') +

    h('1. Responsável pelo tratamento') +
    p(ident() + '. Contacto para assuntos de dados pessoais: <b>' + EMAIL + '</b>.') +

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
      '<b>Rasto de utilização</b>, só se aceitares: onde tocas e o que abres na app e em rendorium.com, ' +
      'debaixo de um identificador sem nome. Nunca o que escreves. Está explicado no ponto 12.',
    ]) +

    h('4. Para quê e com que fundamento') +
    ul([
      '<b>Prestar o serviço</b> (criar a conta, guardar e sincronizar os teus dados, partilhar casas com ' +
      'quem indicares) — execução do contrato entre nós.',
      '<b>Segurança e prevenção de abusos</b> (limites de tentativas, registos de acesso) — interesse ' +
      'legítimo em manter o serviço a funcionar e protegido.',
      '<b>Cumprir obrigações legais</b> — quando alguma norma nos obrigar a conservar ou fornecer informação.',
      '<b>Comunicações sobre o serviço</b> (confirmação de email, avisos de segurança, alterações aos ' +
      'termos, e os avisos dos movimentos planeados em atraso dos imóveis que geres, que podes desligar ' +
      'nas Definições) — execução do contrato. Comunicações de marketing, se as houver, só com o teu consentimento.',
      '<b>Perceber o que é difícil de usar e melhorar a app e a página</b> (o rasto de utilização do ' +
      'ponto 12) — o teu consentimento, que podes retirar quando quiseres.',
    ]) +
    p('Não fazemos decisões automatizadas com efeitos jurídicos sobre ti. O rasto de utilização (ponto 12) ' +
      'não é usado para decisões automáticas nem para te avaliar: serve só para perceber onde a interface ' +
      'confunde.') +

    h('5. Quem tem acesso') +
    p('Não vendemos dados pessoais nem os cedemos para fins publicitários. Recorremos aos seguintes ' +
      'subcontratantes:') +
    ul([
      '<b>Cloudflare, Inc.</b> — alojamento da aplicação, base de dados e sessões.',
      '<b>Google Ireland Ltd.</b> — apenas se optares por entrar com a conta Google.',
      '<b>Resend, Inc.</b> — envio dos emails do serviço (confirmações, avisos e respostas do suporte).',
    ]) +
    p('Os outros utilizadores só veem o que <b>tu</b> decidires partilhar: quem é comproprietário de um ' +
      'imóvel teu vê os dados desse imóvel e o teu perfil; colaboradores veem só o que o cargo permite. ' +
      'Um convite ainda não aceite não dá acesso a nada.') +

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
      'O rasto de utilização apaga-se ao fim de <b>90 dias</b>, logo que o recusares e logo que apagares a ' +
      'conta. As cópias de segurança não o levam.',
    ]) +

    h('8. Os teus direitos') +
    p('Podes pedir <b>acesso</b> aos teus dados, <b>retificação</b>, <b>apagamento</b>, <b>limitação</b> ' +
      'do tratamento, <b>portabilidade</b> e <b>oposição</b>, e retirar consentimentos a qualquer momento. ' +
      'Na prática, a aplicação já te dá dois destes diretamente: podes exportar tudo em ' +
      '<b>Definições → Importar e cópias</b> e apagar a conta em <b>Definições → Segurança</b>.') +
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
      '<b>rd_escolha</b> — guarda a tua resposta sobre o rasto de utilização (aceitar ou recusar) e quando a ' +
      'deste, durante 180 dias, para não voltarmos a perguntar. É necessário para respeitar essa resposta.',
      '<b>rd_vis</b> — só existe se aceitares: o identificador aleatório deste aparelho para o rasto de ' +
      'utilização (ponto 12), durante 180 dias. Recusar apaga-o.',
    ]) +
    p('O rd_escolha e o rd_vis valem em rendorium.com e em app.rendorium.com, para a resposta ser uma só. ' +
      'Não usamos cookies de publicidade, e o rd_vis é o único que mede a utilização, só com o teu ' +
      'consentimento.') +

    '<h3 class="lg-h" id="rasto-de-utilizacao">12. Rasto de utilização, só com o teu consentimento</h3>' +
    p('Se aceitares, na faixa de rendorium.com ou na pergunta da app, registamos como usas a app e a ' +
      'página, para percebermos o que é difícil de usar e o melhorarmos. Sem o teu sim não se regista ' +
      'nada, e a página nem carrega o código que o faz.') +
    p('O que fica registado:') +
    ul([
      '<b>onde tocas:</b> a posição na janela e o elemento em que tocaste (um botão, uma ligação), nunca o ' +
      'texto da página;',
      '<b>o que abres:</b> os ecrãs, as janelas e as páginas que abres e fechas, e as partes de ' +
      'rendorium.com que chegas a ver;',
      '<b>quando guardas</b>, e quando um campo dá erro ao guardar (qual o campo, nunca o valor);',
      '<b>quantos registos adicionas, editas ou removes</b>, e de que tipo (um imóvel, três movimentos), ' +
      'nunca o conteúdo deles;',
      '<b>o tamanho da janela</b> do aparelho.',
    ]) +
    p('<b>Nunca</b> registamos o que escreves, os valores dos campos nem os dados da tua conta e dos teus ' +
      'imóveis.') +
    p('<b>Com que identificador:</b> um código sem nome (por exemplo P-7K2QXM), sorteado ao acaso e não ' +
      'tirado da tua conta nem do teu email. Não é anónimo: se tiveres conta, o código fica ligado a ela, e ' +
      'o que se registou antes de entrares, no mesmo aparelho, junta-se-lhe.') +
    p('<b>Fundamento:</b> o teu consentimento (artigo 6.º, n.º 1, alínea a) do RGPD), que podes retirar a ' +
      'qualquer momento, sem afetar o que foi feito antes.') +
    p('<b>Quem vê:</b> só a equipa do Rendorium, no back office. Quem administra o serviço vê o rasto de ' +
      'todos e pode chegar à conta a que pertence; quem dá suporte só vê o de quem lhe abriu um pedido de ' +
      'ajuda. Não o partilhamos com mais ninguém nem o usamos para publicidade.') +
    p('<b>Durante quanto tempo:</b> cada registo apaga-se ao fim de <b>90 dias</b>. Apagar a conta apaga ' +
      'o rasto dela. As cópias de segurança diárias não levam o rasto.') +
    p('<b>Como mudar de ideias:</b> em rendorium.com, no fundo da página; na app, nas <b>Definições</b>. ' +
      'Vale a resposta mais recente: a que deres num sítio passa para o outro quando abrires a app nesse ' +
      'aparelho, para a conta e para o aparelho. Recusar depois de aceitar deixa de registar e <b>apaga ' +
      'logo</b> o que já se registou deste aparelho e, se tiveres sessão iniciada, da tua conta, com o ' +
      'identificador do aparelho.') +

    h('13. Menores') +
    p('O serviço destina-se a maiores de 18 anos. Não recolhemos conscientemente dados de menores; se ' +
      'soubermos que o fizemos, apagamo-los.') +

    h('14. Alterações') +
    p('Se esta política mudar de forma significativa, avisamos na aplicação e pedimos nova aceitação. A ' +
      'data no início indica a versão em vigor.');

  return { version: VERSION, termos: TERMOS, privacidade: PRIVACIDADE, email: EMAIL, operador: OPERADOR };
})();
