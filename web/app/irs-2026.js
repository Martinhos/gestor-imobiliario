/* ================= IRS 2026 =================
   As regras dos rendimentos de 2026: a declaração que se entrega de 1 de
   abril a 30 de junho de 2027. O formato é o do irs-2025.js.

   O que mudou de 2025 para cá: a taxa de 10 % nas rendas moderadas, criada
   pelo DL 97/2026 de 20 de maio (art. 45.º-C do EBF, ao abrigo da Lei
   9-A/2026), com efeitos desde 1 de janeiro de 2026 e até aos rendimentos de
   2029 — contrato exclusivamente para habitação (permanente ou não; a lei não
   o pede), renda mensal até 2,5 × a retribuição mínima de 2026 (920 €), ou
   seja 2 300 €; o não habitacional continua a 28 %, e uma taxa mais baixa
   pela duração (5 %, ou menos de 10 % com renovações) ganha. A retenção na
   fonte nessas rendas passa a 10 % (CIRS art. 101.º n.º 1 f)). E o RSAA
   (anexo III do mesmo DL), que isenta de IRS desde 1 de setembro de 2026 e
   substitui o PAA, com os limites de renda da Portaria 454/2026/1.

   PROVISÓRIO: o Anexo F para os rendimentos de 2026 ainda não foi aprovado
   (a 2026-11-17 não há portaria; nos últimos anos saiu entre fevereiro e
   março do ano da entrega). Os quadros, as colunas, os nomes do impresso e os
   códigos aqui (naturezas, quadro 5, quadro 10) são os do modelo de 2025;
   quando a portaria sair, confirma-se tudo e muda-se o `modelo` para oficial.
   O OE 2027 (Proposta de Lei 110/XVII, entregue a 2026-10-08) não mexe na
   categoria F.

   Fontes (consultadas a 2026-10-08): DL 97/2026 (DR 1.ª série n.º 97,
   2026-05-20), arts. 2.º, 3.º, 9.º, 14.º, 15.º, 17.º e 18.º e o anexo III;
   EBF art. 45.º-C; CIRS arts. 72.º e 101.º; a informação vinculativa
   PIV 30751 (2026-09-15, a taxa de 10 % com uma empresa inquilina); e o
   Doutor Finanças («10%? IRS sobre rendimentos prediais: o que muda com o OE
   2026?», 2026-01-05) — que atribui a taxa ao OE e lhe pede habitação
   permanente; seguiu-se a lei.

   Revisão de 2026-11-17 (auditoria ao IRS, KAN-126), com estas fontes:
   - a Portaria 454/2026/1, de 13 de outubro (DR n.º 198/2026, Série I,
     2026-10-13; ficha da AT «Estado: vigente», info.portaldasfinancas.gov.pt,
     diplomas_legislativos/portaria-454-2026-1.pdf, lida a 2026-11-17): os
     limites máximos de renda do RSAA por tipologia e concelho (art. 2.º e
     anexo), com as majorações de 10 % por estacionamento privativo e por
     certificado energético A ou superior (art. 2.º n.º 4); revoga a Portaria
     176/2019 com efeitos a 1 de setembro de 2026 (arts. 6.º b) e 7.º n.º 2);
     entra em vigor a 14 de outubro (art. 7.º n.º 1), e de 1 de setembro a 13
     de outubro valem os valores da Portaria 176/2019 (art. 7.º n.º 3);
   - o DL 97/2026 no Portal das Finanças (decreto-lei-97-2026.pdf, lido a
     2026-11-17): art. 14.º b) — desde 1 de setembro de 2026 as referências aos
     limites da Portaria 176/2019 leem-se como os limites do art. 4.º do anexo
     III (o RSAA); art. 15.º n.º 2 — os contratos do PAA em vigor quando o RSAA
     começou mantêm a isenção; art. 18.º n.º 1 — o RSAA e a revogação do DL
     68/2019 produzem efeitos a 1 de setembro de 2026; anexo III, art. 6.º
     n.os 3 e 4 — sem a cópia do contrato e o comprovativo da comunicação na
     plataforma do IHRU até 15 de janeiro do ano seguinte, não há isenção;
   - a Portaria 480-A/2025/1, de 30 de dezembro (IAS de 2026: 537,13 €);
   - para as naturezas, o quadro 5, o quadro 10, os nomes do impresso, as
     isenções 6F e 6H e o n.º 24, as do irs-2025.js (o modelo de 2025);
   - para o quadro 4.3, a taxa do DHD e os benefícios do quadro 6 (6A, 6B,
     6C — ronda 2 da auditoria, KAN-128), as do irs-2025.js. */
registarAnoIrs({
  ano:2026,
  revisto:'2026-11-17',
  entrega:{de:'2027-04-01',ate:'2027-06-30'},
  modelo:{oficial:false,
    texto:'Ainda não há Anexo F aprovado para os rendimentos de 2026 — a portaria costuma sair entre fevereiro e março do ano da entrega. Até lá esta página segue os quadros do modelo de 2025, e o campo onde se assinala a taxa de 10 % ainda não se conhece.'},
  /* Portaria 480-A/2025/1, de 30 de dezembro, art. 2.º: o IAS de 2026 é
     537,13 €. A dispensa dos recibos de 2027 mede as rendas de 2026 contra
     2 × 537,13 = 1 074,26 €. */
  ias:537.13,
  /* A retenção na fonte das rendas (CIRS art. 101.º n.º 1 e)): 25 %; nas
     rendas moderadas de habitação (o 10 % do rendaModerada, alínea f)
     acrescentada pelo DL 97/2026) 10 %. O dia em que a alínea f) começa a
     valer na retenção não está confirmado (INCERTO): com o moderadaDesde
     vazio a app aceita as duas taxas o ano todo e nunca acusa os 25 %. O
     mínimo abaixo do qual não se retém fica por confirmar (INCERTO). */
  retencao:{taxa:25,moderada:10,moderadaDesde:'',minimo:null,minimoDesde:''},
  taxas:{
    habitacional:25,
    naoHabitacional:28,
    duracao:[
      {desde:'2023-10-07',escaloes:[{meses:240,taxa:5,n:5},{meses:120,taxa:10,n:4},{meses:60,taxa:15,n:3,porRenovacao:2,minimo:5}]},
      {desde:'2019-01-01',ate:'2023-10-06',escaloes:[{meses:240,taxa:10,n:5},{meses:120,taxa:14,n:4},{meses:60,taxa:23,n:3,porRenovacao:5,minimo:14},{meses:24,taxa:26,n:2,porRenovacao:2,minimo:14}]}],
    /* EBF art. 45.º-C: 10 % até aos rendimentos de 2029, renda até 2 300 €/mês */
    rendaModerada:{taxa:10,limiteMensal:2300,ate:2029},
    /* CIRS art. 72.º n.º 23 e n.º 24, como em 2025 (os comentários e os pontos
       INCERTOS estão no irs-2025.js). A portaria dos limites do n.º 23 muda a
       meio do ano: até 31 de agosto de 2026 a 176/2019; desde 1 de setembro
       os limites do RSAA (DL 97/2026, art. 14.º b)), fixados pela Portaria
       454/2026/1 — mas de 1 de setembro a 13 de outubro com os valores da
       176/2019 (Portaria 454/2026/1, art. 7.º n.º 3). A app não tem as
       tabelas: a pergunta ao senhorio fica a mesma, e a portaria serve para
       lhe dizer onde as procurar.
       INCERTO: a data que escolhe o intervalo. Lê-se a da celebração (o n.º
       23 é dos contratos celebrados desde 2024); se, nas rendas de 2026, um
       contrato de 2024 se mede pela tabela nova não é claro, e o Anexo F de
       2026 ainda não saiu para o dizer. */
    limiteRendaAlta:{desde:'2024-01-01',percentagem:150,
      portaria:[
        {desde:'2024-01-01',ate:'2026-08-31',portaria:'Portaria 176/2019',valoresDa:'Portaria 176/2019',
          texto:'os limites gerais por tipologia e concelho das tabelas 1 e 2 do anexo I à Portaria 176/2019, de 6 de junho'},
        {desde:'2026-09-01',ate:'2026-10-13',portaria:'Portaria 454/2026/1',valoresDa:'Portaria 176/2019',
          texto:'os limites do arrendamento acessível, que de 1 de setembro a 13 de outubro de 2026 são ainda os valores da Portaria 176/2019 (Portaria 454/2026/1, art. 7.º n.º 3)'},
        {desde:'2026-10-14',ate:'',portaria:'Portaria 454/2026/1',valoresDa:'Portaria 454/2026/1',
          texto:'os limites máximos de renda do arrendamento acessível por tipologia e concelho, do anexo à Portaria 454/2026/1, de 13 de outubro'}]},
    bonusRendaMenor:{desde:'2023-10-07',rendaMenorPct:5,pontos:5,minimo:5},
    /* CIRS art. 72.º n.º 5: a prestação mensal de um DHD a 5 % (como em 2025;
       a taxa das rendas moderadas é do arrendamento e nunca fica abaixo) */
    dhd:5},
  /* As isenções (o formato e as fontes do 6D, 6F e 6H estão no irs-2025.js).
     O PAA acabou a 1 de setembro de 2026 (DL 97/2026, arts. 17.º e 18.º), mas
     os contratos que lá estavam nesse dia mantêm a isenção (art. 15.º n.º 2):
     fica na lista, só para os celebrados até 31 de agosto de 2026 — e sem o
     envio ao IHRU, que o art. 15.º n.º 2 não lhes aplica (só os n.os 1, 2, 4
     e 5 do art. 6.º do RSAA). O RSAA (anexo III do DL 97/2026) isenta desde 1
     de setembro de 2026 os contratos celebrados desde então, para residência
     permanente ou temporária (art. 3.º n.º 1), com a renda até ao limite da
     Portaria 454/2026/1 (art. 4.º) e pelo menos 3 anos ou 3 meses (art. 5.º),
     e só com a cópia do contrato na plataforma do IHRU até 15 de janeiro do
     ano seguinte à celebração (art. 6.º n.os 3 e 4): `pedeIhru`, e
     `prazoIhru` o dia (MM-DD) desse ano seguinte — prazos.js avisa-o.
     INCERTO: o código do RSAA no quadro 6D — o Anexo F dos rendimentos de
     2026 ainda não foi aprovado, e pode trazer um código novo ou um quadro
     próprio (o art. 14.º a) do DL manda ler as referências ao PAA como feitas
     ao RSAA, o que pode querer dizer o código 01); fica vazio até a portaria
     sair. INCERTO, pela mesma razão: o RSAA não está nas tabelas do quadro 10
     de 2025 (regime e motivos). */
  isencoes:[
    {id:'paa',nome:'Programa de Apoio ao Arrendamento (PAA)',curto:'PAA',quadro:'6D',codigo:'01',lei:'DL 68/2019, art. 20.º; DL 97/2026, art. 15.º',
      celebradoAte:'2026-08-31',finalidade:['hp','hnp'],
      texto:'Contrato que já estava no Programa de Apoio ao Arrendamento: o programa acabou a 1 de setembro de 2026, mas estes contratos mantêm a isenção de IRS. Um contrato celebrado depois não pode ser do PAA.'},
    {id:'rsaa',nome:'Regime Simplificado de Arrendamento Acessível (RSAA)',curto:'RSAA',quadro:'6D',codigo:'',lei:'DL 97/2026, anexo III; Portaria 454/2026/1',
      desde:'2026-09-01',pedeIhru:true,prazoIhru:'01-15',finalidade:['hp','hnp'],
      texto:'Contrato de habitação celebrado desde 1 de setembro de 2026, com a renda até ao limite da tipologia no concelho da Portaria 454/2026/1 (mais 10 % com estacionamento privativo e mais 10 % com certificado energético A ou superior; nos celebrados até 13 de outubro de 2026, os valores da Portaria 176/2019), e com pelo menos 3 anos (3 meses na residência temporária). A cópia do contrato e o comprovativo da comunicação às Finanças vão à plataforma do IHRU até 15 de janeiro do ano seguinte ao da celebração; sem isso não há isenção.'},
    {id:'pma',nome:'Programa municipal de arrendamento acessível (PMA)',curto:'programa municipal',quadro:'6D',codigo:'02',lei:'EBF art. 71.º-A',finalidade:['hp','hnp'],
      texto:'Contrato celebrado num programa municipal de habitação a renda acessível: as rendas ficam isentas de IRS durante o contrato.'},
    {id:'pmae',nome:'Programa municipal de alojamento estudantil (PMAE)',curto:'alojamento estudantil municipal',quadro:'6D',codigo:'03',lei:'EBF art. 71.º-A',finalidade:['hp','hnp'],
      texto:'Contrato celebrado num programa municipal de alojamento para estudantes: as rendas ficam isentas de IRS durante o contrato.'},
    {id:'prerau',nome:'Renda antiga: contrato anterior ao RAU, sujeito ao NRAU',curto:'renda antiga (anterior ao RAU)',quadro:'6H',codigo:'',semCodigo:true,lei:'EBF art. 46.º-A',
      pede:'nrau3536',finalidade:['hp','hnp'],
      texto:'Contrato de habitação celebrado antes do Regime do Arrendamento Urbano (o RAU, de 1990) e que ficou sujeito aos artigos 35.º ou 36.º do NRAU — o inquilino com rendimentos baixos, ou com 65 ou mais anos ou deficiência de 60 % ou mais: as rendas ficam isentas de IRS enquanto o contrato durar.'},
    {id:'al',nome:'Ex-alojamento local passado a arrendamento',curto:'ex-alojamento local',quadro:'6F',codigo:'',semCodigo:true,lei:'EBF art. 74.º-A',
      pede:'alRegistado2022',celebradoAte:'2024-12-31',ateAno:2029,finalidade:['hp'],
      texto:'Imóvel que estava em alojamento local registado até 31 de dezembro de 2022 e passou a arrendamento para habitação permanente, com o contrato celebrado e inscrito no Portal das Finanças até 31 de dezembro de 2024: as rendas ficam isentas de IRS até às de 2029.'}],
  colunas:['conservacao','condominio','imi','selo','taxas','outros'],
  colunasNomes:{
    apos:{titulo:'Após início do arrendamento',conservacao:'Conservação e manutenção',condominio:'Condomínio',imi:'Imposto municipal sobre imóveis',selo:'Imposto do selo',taxas:'Taxas autárquicas',outros:'Outros'},
    obras:{titulo:'Com obras de conservação e manutenção',inicioContrato:'Data de início do contrato de arrendamento (ano, mês)',inicioGastos:'Data de início dos gastos (ano, mês)',valor:'Valor'},
    /* a última coluna das linhas do 4.1 e do 4.2, nos contratos em vigor antes de 2022 (D76) */
    atualizacao:'Atualização da renda superior a 1,02?'},
  naturezas:{habitacional:'07',naoHabitacional:'06',indemnizacao:'05',outras:'02',dhd:'01'},
  naturezasTexto:{'01':'Arrendamento (anos de 2015 a 2022)','02':'Cedência de uso do prédio ou de parte dele, que não arrendamento',
    '03':'Aluguer de maquinismos e mobiliários instalados no imóvel locado',
    '04':'Constituição, a título oneroso, de direitos reais de gozo temporários, ainda que vitalícios, sobre prédios rústicos, urbanos ou mistos',
    '05':'Indemnizações que visem compensar perdas de rendimentos da categoria F','06':'Arrendamento não habitacional','07':'Arrendamento habitacional'},
  quadro5:{naturezas:{habitacional:'02',naoHabitacional:'01'},
    naturezasTexto:{'01':'Subarrendamento não habitacional','02':'Subarrendamento habitacional'}},
  /* O quadro 4.3 e os benefícios do quadro 6 (6A, 6B, 6C): o formato, as
     fontes e os pontos INCERTOS estão no irs-2025.js. Iguais aos de 2025 —
     o modelo destes rendimentos ainda não saiu. O 6C está em vigor até 31 de
     dezembro de 2026 (Lei 73-A/2025, art. 260.º n.º 3): a versão de 2027
     copia o vigenteAte, e o benefício só volta se o Orçamento de 2027 o
     prorrogar e alguém o mudar aqui. */
  quadro43:{
    colunas:[['numero','Contrato – Número'],['inicio','Contrato – Data de início'],['escritura','Escritura pública ou documento particular – Data da celebração'],
      ['caucao','Escritura pública ou documento particular – Valor da caução'],['titular','Titular'],['matriz','Identificação matricial dos prédios'],
      ['valor','Rendimento – Valor ilíquido'],['natureza','Rendimento – Natureza'],['retencoes','Retenções na fonte'],['moradores','NIF morador(es)'],
      ['atualizacao','Atualização da renda superior a 1,02?'],['gastos','Gastos obrigatórios suportados e pagos'],['cessacao','Cessação dos efeitos do DHD']],
    naturezas:{prestacao:'01',caucao:'02',deducaoCaucao:'03'},
    naturezasTexto:{'01':'Prestação pecuniária mensal (rendas)','02':'Prestação pecuniária anual (caução) - 11.º ano e seguintes',
      '03':'Dedução ao montante da caução por incumprimento dos deveres do morador'},
    reduzidas:['01'],
    gastos:[['conservacaoExtra','Conservação extraordinária'],['condominio','Condomínio'],['outros','Outros']],
    motivos:[
      {codigo:'01',regulariza:true,curto:'Por acordo das partes',texto:'Cessação do DHD por acordo das partes (n.º 20 do artigo 72.º do Código do IRS)'},
      {codigo:'02',curto:'Morte do morador',texto:'Caducidade por morte do morador(es) (artigo 16.º do Decreto-Lei n.º 1/2020, de 9 de janeiro)'},
      {codigo:'03',curto:'Renúncia do morador',texto:'Extinção do DHD por renúncia do morador (artigo 17.º do Decreto-Lei n.º 1/2020, de 9 de janeiro)'},
      {codigo:'04',curto:'Incumprimento do proprietário',texto:'Resolução do DHD por incumprimento definitivo imputável ao proprietário (artigo 18.º do Decreto-Lei n.º 1/2020, de 9 de janeiro)'},
      {codigo:'05',curto:'O morador comprou o imóvel',texto:'Extinção do DHD por aquisição da propriedade pelo morador'},
      {codigo:'06',quem:'fim',curto:'Fim do prazo',texto:'Cessação do DHD no final do prazo'}]},
  beneficios:[
    {id:'reab71',quadro:'6A',campos:['01','02','03','04','05'],marca:'imovel.reabilitacao',taxa:5,
      tipos:['aru','nrau'],certificado:true,inicioDesde:'2008-01-02',inicioAte:'2023-10-06',concluida:true,donoEm:'2023-10-06',
      nome:'Imóvel reabilitado (ARU ou NRAU)',curto:'imóvel reabilitado',
      lei:'EBF art. 71.º n.º 7, revogado pela Lei 56/2023; EBF art. 11.º n.º 1; PIV 28153',
      texto:'Imóvel numa área de reabilitação urbana recuperado, ou arrendado no NRAU e objeto de ações de reabilitação, com o início e a conclusão certificados pela câmara: as rendas pagam 5 %, se a reabilitação começou entre 2 de janeiro de 2008 e 6 de outubro de 2023 e já eras dono a 6 de outubro de 2023.',
      taxaTexto:'Nas rendas de imóveis reabilitados com certificado da câmara, se já eras dono a 6 de outubro de 2023',
      aviso:'Os 5 % seguem a posição mais recente da AT (informação vinculativa 28153, de setembro de 2026): a lei que os dava foi revogada em 2023, e em 2025 a AT chegou a dizer que só valiam até às rendas de 2024 (informação vinculativa 23119). Confirma antes de entregar.'},
    {id:'lojaHistoria',quadro:'6B',campos:['08','09','10','11','12'],marca:'imovel.lojaComHistoria',fatorObras24:1.1,finalidade:['nh'],
      nome:'Loja com História (Lei 42/2017)',curto:'Loja com História',
      lei:'EBF art. 59.º-I n.º 2; Lei 42/2017',
      texto:'Imóvel reconhecido pelo município como Loja com História e inscrito no inventário nacional: as obras de conservação dos 24 meses antes do arrendamento contam 110 %.'},
    {id:'egf',quadro:'6C',campos:['13','14','15','16','17'],marca:'contrato.egf',fator:0.5,tipoPredio:'R',contratosAte:'2020-12-31',anos:12,vigenteAte:'2026-12-31',
      nome:'Prédio rústico arrendado a uma entidade de gestão florestal (EGF ou UGF)',curto:'arrendado a uma EGF',
      lei:'EBF art. 59.º-G n.os 11, 14 e 15; Lei 45-A/2024, art. 333.º; Lei 73-A/2025, art. 260.º n.º 3',
      texto:'Prédio rústico florestal arrendado até 31 de dezembro de 2020 a uma entidade ou unidade de gestão florestal reconhecida: as rendas contam 50 %, durante 12 anos a contar do ano do contrato.'}],
  quadro10:{
    regimes:[
      {codigo:'01',texto:'Artigo 72.º, n.º 2, do Código do IRS',n:2},
      {codigo:'02',texto:'Artigo 72.º, n.º 3, do Código do IRS',n:3},
      {codigo:'03',texto:'Artigo 72.º, n.º 4, do Código do IRS',n:4},
      {codigo:'04',texto:'Artigo 72.º, n.º 5, do Código do IRS',n:5},
      {codigo:'05',texto:'Apoio ao Arrendamento',isencao:'paa'},
      {codigo:'06',texto:'Apoio ao Subarrendamento',isencao:'paa',sub:true},
      {codigo:'07',texto:'Arrendamento Municipal',isencao:'pma'},
      {codigo:'08',texto:'Subarrendamento Municipal',isencao:'pma',sub:true},
      {codigo:'09',texto:'Arrendamento para Alojamento Estudantil',isencao:'pmae'},
      {codigo:'10',texto:'Subarrendamento para Alojamento Estudantil',isencao:'pmae',sub:true}],
    motivos:[
      {codigo:'01',para:'reducao',quem:'senhorio',regulariza:true,curto:'Acabou antes do prazo, por motivo do senhorio',
        texto:'Cessação do contrato de arrendamento antes de decorridos os prazos de duração dos mesmos ou das suas renovações por motivo imputável ao senhorio/locador (número 20 do artigo 72.º do Código do IRS)'},
      {codigo:'02',para:'reducao',quem:'inquilino',curto:'Acabou antes do prazo, por motivo do inquilino',
        texto:'Cessação do contrato de arrendamento antes de decorridos os prazos de duração dos mesmos ou das suas renovações por motivo imputável ao inquilino/locatário'},
      {codigo:'03',para:'reducao',quem:'fim',curto:'Acabou no fim do prazo ou de uma renovação',
        texto:'Cessação do contrato de arrendamento no final dos prazos de duração dos mesmos ou das suas renovações'},
      {codigo:'04',para:'paa',quem:'senhorio',curto:'Saiu do PAA por motivo do senhorio',
        texto:'Cessação do enquadramento no Programa de Apoio ao Arrendamento por motivos imputáveis ao prestador (senhorio/locador/sublocador)'},
      {codigo:'05',para:'paa',quem:'inquilino',curto:'Saiu do PAA por motivo do inquilino',
        texto:'Cessação do enquadramento no Programa de Apoio ao Arrendamento por motivos imputáveis ao candidato (inquilino/locatário/sublocatário)'},
      {codigo:'06',para:'pma',quem:'senhorio',curto:'Saiu do programa municipal por motivo do senhorio',
        texto:'Cessação do enquadramento nos Programas Municipais para arrendamento habitacional a custos acessíveis, por motivo imputável ao prestador (senhorio/locador/sublocador)'},
      {codigo:'07',para:'pma',quem:'inquilino',curto:'Saiu do programa municipal por motivo do inquilino',
        texto:'Cessação do enquadramento nos Programas Municipais para arrendamento habitacional a custos acessíveis, por motivo imputável ao candidato (inquilino/locatário/sublocatário)'},
      {codigo:'08',para:'paa',quem:'fim',curto:'Saiu do PAA no fim do prazo ou de uma renovação',
        texto:'Cessação do enquadramento no Programa de Apoio ao Arrendamento – contratos no final dos prazos de duração dos mesmos ou das suas renovações'},
      {codigo:'09',para:'pma',quem:'fim',curto:'Saiu do programa municipal no fim do prazo ou de uma renovação',
        texto:'Cessação do enquadramento nos Programas Municipais para arrendamento habitacional a custos acessíveis – contratos no final dos prazos de duração dos mesmos ou das suas renovações'},
      {codigo:'10',para:'pmae',quem:'senhorio',curto:'Saiu do alojamento estudantil municipal por motivo do senhorio',
        texto:'Cessação do enquadramento nos Programas municipais para alojamento estudantil por motivos imputáveis ao prestador (senhorio/locador/sublocador)'},
      {codigo:'11',para:'pmae',quem:'inquilino',curto:'Saiu do alojamento estudantil municipal por motivo do inquilino',
        texto:'Cessação do enquadramento nos Programas municipais para alojamento estudantil por motivos imputáveis ao candidato (inquilino/locatário/sublocatário)'},
      {codigo:'12',para:'pmae',quem:'fim',curto:'Saiu do alojamento estudantil municipal no fim do prazo ou de uma renovação',
        texto:'Cessação do enquadramento nos Programas municipais para alojamento estudantil - contratos no final dos prazos de duração dos mesmos ou das suas renovações'}]},
  /* Anexo J: os rendimentos prediais de um imóvel fora de Portugal vão ao quadro
     7A, com o código F01 (Tabela IV das instruções do Anexo J; Q12: sem estimativa) */
  anexoJ:{quadro:'7A',codigo:'F01'},
  quadros:{semReducao:'4.1',comReducao:'4.2',datas:'4.2A',dhd:'4.3',mudanca100km:'4.4',sublocacao:'5',anosAnteriores:'8',englobamento:'6G',aimi:'9',cessados:'10',
    /* 9: as linhas dos prédios do quadro 9 (campos 9001 a 9020 do impresso do
       Anexo F, lidos pelo voto da lei do D71) */
    campos:{'4.1':4001,'4.2':4501,'4.3':4901,'9':9001}},
  prazos:{comunicacaoDuracao:'2027-02-15'},
  /* As taxas gerais do CIRS art. 68.º dos rendimentos de 2026, na redação da
     Lei 73-A/2025, de 30 de dezembro (OE 2026) — a versão em vigor no Portal
     das Finanças (info.portaldasfinancas.gov.pt, cirs_rep/irs68.aspx,
     consultado a 2026-10-11), confirmada pelas taxas médias publicadas. O
     formato e as parcelas como no irs-2025.js. A taxa adicional de
     solidariedade (art. 68.º-A) fica nos 80 000 € — só a proposta do OE 2027 a
     muda. */
  englobamento:{
    escaloes:[{ate:8342,taxa:12.5,parcela:0},{ate:12587,taxa:15.7,parcela:266.94},{ate:17838,taxa:21.2,parcela:959.23},
      {ate:23089,taxa:24.1,parcela:1476.53},{ate:29397,taxa:31.1,parcela:3092.76},{ate:43090,taxa:34.9,parcela:4209.85},
      {ate:46566,taxa:43.1,parcela:7743.23},{ate:86634,taxa:44.6,parcela:8441.72},{ate:null,taxa:48,parcela:11387.27}],
    solidariedade:[{acima:80000,taxa:2.5},{acima:250000,taxa:5}]},
  novidades:[
    'Taxa de 10 % nas rendas de habitação até 2 300 € por mês, em contratos novos e já existentes, de 2026 a 2029 (Decreto-Lei 97/2026). Conta a renda inteira do contrato, com móveis e serviços. Se a duração já dá uma taxa mais baixa, fica essa; o não habitacional continua a 28 %.',
    'O inquilino com contabilidade organizada passa a reter 10 %, e não 25 %, nessas rendas. A retenção é um adiantamento do imposto: o que se reteve a mais acerta-se na declaração.',
    'Regime Simplificado de Arrendamento Acessível (RSAA), desde 1 de setembro de 2026: rendas isentas de IRS em contratos de habitação até ao limite por tipologia e concelho da Portaria 454/2026/1, de 13 de outubro, com pelo menos três anos, submetidos ao IHRU até 15 de janeiro do ano seguinte. Os mesmos limites contam, desde setembro, para a renda acima de 150 % que faz perder a redução pela duração.',
    'O Programa de Apoio ao Arrendamento acabou a 1 de setembro de 2026; os contratos que já estavam nele mantêm a isenção.',
    'O Anexo F destes rendimentos ainda não foi aprovado e deve trazer um campo para a taxa de 10 % e outro para o RSAA. Até a portaria sair, esta versão é provisória — e esta página di-lo.'],
  passos:[
    {titulo:'Antes de abrir o Portal',
      texto:'Confirma nesta página que não falta nada: cada contrato com o número que a AT lhe deu, cada imóvel com o código da freguesia, o tipo e o artigo, cada inquilino com NIF ou país. O que falta está em «A tratar antes de entregar», e cada ponto abre o sítio onde se trata.'},
    {titulo:'O rosto da declaração',
      texto:'No Portal das Finanças, IRS › Entregar declaração, ano {ano}. Confirma o estado civil e se vais em tributação conjunta ou separada. Na coluna «Titular» do Anexo F, A e B são as posições no rosto: A é o sujeito passivo A (quadro 3 do rosto) e B o sujeito passivo B (quadro 5A), só em conjunta — quem é A e quem é B decide-o o casal no rosto. Em conjunta entram as rendas dos dois. Com rendas não há IRS Automático.'},
    {titulo:'Quadros 4.1 e 4.2: uma linha por contrato',
      texto:'No 4.1 os contratos sem redução pela duração; no 4.2 os de habitação permanente com redução, e para cada um o 4.2A com as datas do contrato e da última renovação. De cada linha desta página copias o n.º do contrato, a data de início, a freguesia, o tipo, o artigo, a fração, o titular, a renda ilíquida, a natureza (07 habitacional, 06 não habitacional, 05 indemnizações que compensam rendas perdidas, 02 cedência de uso que não é arrendamento), as retenções e o NIF ou o país do inquilino. Nos contratos com renda até 2 300 €, procura no modelo novo o campo da taxa de 10 %.'},
    {titulo:'Os gastos, na mesma linha',
      texto:'Na tabela de baixo, pelo mesmo número de campo, no grupo «Após início do arrendamento»: conservação e manutenção, condomínio, imposto municipal sobre imóveis pago no ano, imposto do selo, taxas autárquicas e outros — só os do período em que o imóvel esteve arrendado. As obras de conservação dos 24 meses antes de um contrato vão no grupo «Com obras de conservação e manutenção», no ano em que ele começa, com o ano e o mês do início do contrato e do primeiro pagamento — e só se, entretanto, o imóvel não teve outro uso (a tua casa, a de férias, alojamento local). Guarda as faturas com o teu NIF: a AT pode pedi-las durante quatro anos.'},
    {titulo:'Sublocação e casa nova a mais de 100 km (quadros 5 e 4.4)',
      texto:'Se arrendas um imóvel e o subarrendas, não vai ao 4.1: vai ao quadro 5, com a renda que recebes, a que pagas ao senhorio e o NIF dele, e paga-se sobre a diferença, sem gastos. Se mudaste a tua casa para mais de 100 km da antiga, onde viveste pelo menos 12 meses, e arrendaste a antiga, o quadro 4.4 deduz às rendas dela a renda que pagas na nova — com os dois contratos registados no Portal.'},
    {titulo:'Rendas de anos anteriores (quadro 8)',
      texto:'Uma renda de outro ano recebida em {ano} já está no valor da linha. No quadro 8 dizes que parte é de que ano: no 8A se englobares (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares declarações de substituição desses anos, até cinco para trás.'},
    {titulo:'Englobar ou não (quadro 6G)',
      texto:'Sem englobamento, as rendas pagam a taxa especial: 10 % nas rendas moderadas, 25 % na restante habitação, 28 % no resto, menos nos contratos longos, 5 % nos imóveis reabilitados do quadro 6A e na prestação de um direito real de habitação duradoura (quadro 4.3). Com englobamento somam-se aos teus outros rendimentos e pagam a taxa dos escalões — com rendas a 10 % quase nunca compensa (o primeiro escalão do ano é de 12,5 %). A opção vale para todas as rendas: simula as duas no Portal.'},
    {titulo:'AIMI e contratos que acabaram (quadros 9 e 10)',
      texto:'Se pagaste o Adicional ao IMI, o quadro 9 abate-o ao imposto na parte dos prédios arrendados (não é um gasto do 4.1). Cada contrato com redução de taxa, ou isento num programa de arrendamento acessível, que acabou no ano vai ao quadro 10, seja qual for o motivo: o regime, o n.º, o ano de início do benefício, a data e o motivo (nos contratos com redução, a data e o motivo também se comunicam no Portal até 15 de fevereiro do ano seguinte). Se acabou antes do prazo por motivo do senhorio, a redução perde-se desde o início do contrato ou da renovação, e a diferença de imposto de cada ano paga-se nesta declaração, com juros compensatórios.'},
    {titulo:'Simular e entregar',
      texto:'Simula, confere o valor a pagar ou a receber e entrega até {ate}. Um resultado negativo das rendas não se perde: abate às rendas dos seis anos seguintes.'}],
});
